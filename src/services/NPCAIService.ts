import { GameContext } from './ai/types';
import { NPCMemory } from './ai/types';

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class NPCAIService {
    private memories: Map<string, NPCMemory> = new Map();
    
    constructor() {
        // No longer need to initialize AI service as we'll use the server API
    }

    /**
     * Get the default game context for AI interactions
     */
    public getGameContext(): GameContext {
        return {
            timeOfDay: 'day', // Could be dynamic based on game time
            weather: 'clear', // Could be dynamic based on game weather
            playerLevel: 1, // Could be dynamic based on player stats
            location: 'village', // Could be dynamic based on map
            activeQuests: ['tutorial'] // Could be dynamic based on quest log
        };
    }

    /**
     * Generate a response from the AI service
     * @param npcId The NPC ID (used as the role type)
     * @param playerMessage The player's message
     * @param gameContext Optional game context, uses default if not provided
     * @param onStreamingResponse Optional callback for streaming responses
     * @returns Promise with the complete response
     */
    public async generateResponse(
        npcId: string, 
        playerMessage: string, 
        gameContext?: GameContext,
        onStreamingResponse?: (chunk: string, isComplete: boolean) => void
    ): Promise<string> {
        // Use npcId as the role type
        const npcRole = npcId;
        const memory = this.getOrCreateMemory(npcId);
        
        try {
            // Format conversation history for the API call
            const conversationHistory = this.formatConversationHistory(memory);
            
            // Use provided game context or get the default one
            const context = gameContext || this.getGameContext();
            
            // Determine if we should use streaming based on callback presence
            const useStreaming = !!onStreamingResponse;
            
            if (useStreaming) {
                // Use streaming response
                const fullResponse = await this.generateStreamingResponse(
                    npcRole,
                    playerMessage,
                    context,
                    conversationHistory,
                    onStreamingResponse
                );
                
                // Update memory with the complete response
                this.updateMemory(npcId, playerMessage, fullResponse);
                return fullResponse;
            } else {
                // Use standard response
                // Make API request to the server
                const response = await fetch(`${API_URL}/api/ai/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalityType: npcRole,
                        message: playerMessage,
                        gameContext: context,
                        conversationHistory,
                        stream: false
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                
                const data = await response.json();
                const aiResponse = data.response;
                
                // Update memory with the new exchange
                this.updateMemory(npcId, playerMessage, aiResponse);
                return aiResponse;
            }
        } catch (error) {
            console.error(`Failed to generate response for NPC ${npcId}:`, error);
            return this.getFallbackResponse(npcRole);
        }
    }
    
    /**
     * Generate a streaming response from the AI service
     * @param npcRole The NPC role type
     * @param playerMessage The player's message
     * @param gameContext The game context
     * @param conversationHistory The conversation history
     * @param onChunk Callback for each chunk of the response
     * @returns Promise with the complete response
     */
    private async generateStreamingResponse(
        npcRole: string,
        playerMessage: string,
        gameContext: GameContext,
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        onChunk: (chunk: string, isComplete: boolean) => void
    ): Promise<string> {
        try {
            // Make streaming API request to the server
            const response = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personalityType: npcRole,
                    message: playerMessage,
                    gameContext,
                    conversationHistory,
                    stream: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            if (!response.body) {
                throw new Error('Response body is null');
            }
            
            // Process the stream using the ReadableStream API and EventSource-like parsing
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = '';
            
            console.log('[NPCAIService] Starting to process stream');
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('[NPCAIService] Stream complete');
                    // Process any remaining data in buffer
                    if (buffer.includes('data: ')) {
                        processSSEChunk(buffer);
                    }
                    // Signal completion
                    onChunk('', true);
                    break;
                }
                
                // Decode the chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete SSE messages
                while (buffer.includes('\n\n')) {
                    const endOfMessage = buffer.indexOf('\n\n') + 2;
                    const message = buffer.slice(0, endOfMessage);
                    buffer = buffer.slice(endOfMessage);
                    
                    if (message.startsWith('data: ')) {
                        processSSEChunk(message);
                    }
                }
            }
            
            // Helper function to process SSE chunks
            function processSSEChunk(chunk: string) {
                try {
                    const jsonStr = chunk.slice(6).trim(); // Remove 'data: ' prefix
                    console.log('[NPCAIService] Received chunk:', jsonStr);
                    const data = JSON.parse(jsonStr);
                    if (data.content) {
                        fullResponse += data.content;
                        onChunk(data.content, false);
                    }
                } catch (e) {
                    // Skip invalid JSON
                    console.warn('[NPCAIService] Invalid JSON in stream:', chunk, e);
                }
            }
            
            return fullResponse;
        } catch (error) {
            console.error('Error in streaming response:', error);
            const fallback = this.getFallbackResponse(npcRole);
            onChunk(fallback, true);
            return fallback;
        }
    }

    /**
     * Format the conversation history into a format suitable for the OpenAI API
     */
    private formatConversationHistory(memory: NPCMemory): Array<{ role: 'user' | 'assistant'; content: string }> {
        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        
        // Get the last 6 messages (3 exchanges) from conversation history
        const recentMessages = memory.conversationHistory.slice(-6);
        
        // Convert to the format expected by OpenAI API
        for (let i = 0; i < recentMessages.length; i++) {
            // Even indices are player messages, odd indices are NPC responses
            const role = i % 2 === 0 ? 'user' : 'assistant';
            messages.push({
                role,
                content: recentMessages[i]
            });
        }
        
        return messages;
    }

    private getOrCreateMemory(npcId: string): NPCMemory {
        if (!this.memories.has(npcId)) {
            this.memories.set(npcId, {
                conversationHistory: [],
                playerInteractions: [],
                lastInteraction: Date.now()
            });
        }
        return this.memories.get(npcId)!;
    }

    // formatGameContext is now handled on the server side

    private updateMemory(npcId: string, playerMessage: string, npcResponse: string): void {
        const memory = this.getOrCreateMemory(npcId);
        memory.conversationHistory.push(playerMessage);
        memory.conversationHistory.push(npcResponse);
        memory.playerInteractions.push(playerMessage);
        memory.lastInteraction = Date.now();
        
        // Limit memory size to prevent it from growing too large
        if (memory.conversationHistory.length > 20) {
            memory.conversationHistory = memory.conversationHistory.slice(-20);
        }
        if (memory.playerInteractions.length > 10) {
            memory.playerInteractions = memory.playerInteractions.slice(-10);
        }
    }

    private getFallbackResponse(role: string): string {
        const fallbacks: Record<string, string> = {
            merchant: "I'm a bit busy with inventory right now. Come back in a moment?",
            innkeeper: "Just a moment, dear. Dealing with something in the kitchen.",
            blacksmith: "Can't talk now. In the middle of some delicate work."
        };
        
        return fallbacks[role] || "One moment, please.";
    }
}