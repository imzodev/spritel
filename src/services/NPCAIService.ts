import { NPC_PERSONALITIES, NPCPersonalityTemplate } from '../data/npc-personalities';

export class NPCAIService {
    private memories: Map<string, NPCMemory> = new Map();

    public async generateResponse(
        npcId: string, 
        playerMessage: string, 
        gameContext?: GameContext
    ): Promise<string> {
        const personality = NPC_PERSONALITIES[npcId];
        if (!personality) {
            throw new Error(`No personality template found for NPC: ${npcId}`);
        }

        const memory = this.getOrCreateMemory(npcId);
        const prompt = this.constructPrompt(personality, memory, playerMessage, gameContext);

        try {
            // Here you would make the actual OpenAI API call
            const response = await this.callOpenAI(prompt);
            this.updateMemory(npcId, playerMessage, response);
            return response;
        } catch (error) {
            console.error(`Failed to generate response for NPC ${npcId}:`, error);
            return this.getFallbackResponse(personality);
        }
    }

    private constructPrompt(
        personality: NPCPersonalityTemplate,
        memory: NPCMemory,
        playerMessage: string,
        gameContext?: GameContext
    ): string {
        const recentMessages = memory.conversationHistory
            .slice(-6) // Keep last 3 exchanges (6 messages)
            .join('\n');

        return `${personality.systemPrompt}

Recent conversation:
${recentMessages}

Game context:
${this.formatGameContext(gameContext)}

Player: ${playerMessage}

Response as ${personality.name}:`;
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

    private formatGameContext(context?: GameContext): string {
        if (!context) return 'No specific context';
        
        return `Time: ${context.timeOfDay}
Weather: ${context.weather}
Player Level: ${context.playerLevel}
Location: ${context.location}
Active Quests: ${context.activeQuests.join(', ')}`;
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