import { NPC_PERSONALITIES, NPCPersonalityTemplate } from '../data/npc-personalities';
import { GameContext, NPCMemory } from './ai';

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class NPCAIService {
    private memories: Map<string, NPCMemory> = new Map();
    
    constructor() {
        // No longer need to initialize AI service as we'll use the server API
    }

    public async generateResponse(
        npcId: string, 
        playerMessage: string, 
        gameContext?: GameContext
    ): Promise<string> {
        // First try to find personality by ID directly
        let personality = NPC_PERSONALITIES[npcId];
        
        // If not found, try to find by name (case-insensitive)
        if (!personality) {
            const lowerNpcId = npcId.toLowerCase();
            const match = Object.values(NPC_PERSONALITIES).find(
                p => p.name.toLowerCase() === lowerNpcId
            );
            
            if (match) {
                personality = match;
                npcId = match.id; // Use the correct ID for memory storage
            }
        }
        
        if (!personality) {
            console.error(`No personality found for NPC: ${npcId}`);
            throw new Error(`No personality template found for NPC: ${npcId}`);
        }

        const memory = this.getOrCreateMemory(npcId);
        
        try {
            // Format conversation history for the API call
            const conversationHistory = this.formatConversationHistory(memory);
            
            // Make API request to the server
            const response = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personalityType: personality.role,
                    message: playerMessage,
                    gameContext,
                    conversationHistory
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
        } catch (error) {
            console.error(`Failed to generate response for NPC ${npcId}:`, error);
            return this.getFallbackResponse(personality);
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

    private getFallbackResponse(personality: NPCPersonalityTemplate): string {
        const fallbacks = {
            merchant: "I'm a bit busy with inventory right now. Come back in a moment?",
            innkeeper: "Just a moment, dear. Dealing with something in the kitchen.",
            blacksmith: "Can't talk now. In the middle of some delicate work."
        };
        
        return fallbacks[personality.role] || "One moment, please.";
    }
}