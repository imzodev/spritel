import { NPCAIService } from '../services/NPCAIService';
import GameScene from '../scenes/GameScene';

export interface DialogueState {
    isOpen: boolean;
    npcName: string;
    personalityType: string;
    message: string;
    options: string[];
}

export interface NPCInteractionData {
    npcId: string;
    npcName: string;
    personalityType: string;
    context?: any;
}

/**
 * DialogueManager handles all NPC dialogue interactions
 * This follows the Single Responsibility Principle by separating dialogue logic from the Game component
 */
export class DialogueManager {
    private aiService: NPCAIService;
    private gameScene: GameScene | null = null;
    private dialogueState: DialogueState;
    private setDialogueState: (state: DialogueState | ((prevState: DialogueState) => DialogueState)) => void;

    constructor(
        aiService: NPCAIService,
        initialDialogueState: DialogueState,
        setDialogueState: (state: DialogueState | ((prevState: DialogueState) => DialogueState)) => void
    ) {
        this.aiService = aiService;
        this.dialogueState = initialDialogueState;
        this.setDialogueState = setDialogueState;
    }

    /**
     * Set the game scene reference
     */
    public setGameScene(scene: GameScene | null): void {
        this.gameScene = scene;
    }

    /**
     * Handle initial NPC interaction
     */
    public async handleNPCInteraction(data: NPCInteractionData): Promise<void> {
        console.log("[DialogueManager] Received NPC interaction event:", data);
        
        // Pause the game scene
        this.gameScene?.scene.pause();

        // Get initial NPC response
        try {
            console.log('[DialogueManager] Setting dialogue state to open');
            
            // Default message and options
            const options = [
                "Tell me about yourself",
                "What goods do you have?",
                "Any interesting news?",
                "Goodbye",
            ];
            
            // First set the dialogue state with a loading message
            this.setDialogueState(() => ({
                isOpen: true,
                npcName: data.npcName,
                personalityType: data.personalityType || 'merchant', // Store personality type for later use
                message: "...",
                options: [], // No options while loading
            }));
            
            // Get AI-generated greeting with streaming
            try {
                await this.aiService.generateResponse(
                    data.personalityType || 'merchant',
                    "Hello, I'm a new traveler here.",
                    undefined, // Use default game context
                    this.handleStreamingResponse.bind(this) // Pass streaming callback
                );
            } catch (error) {
                console.error("[DialogueManager] Failed to get AI response:", error);
                // Fall back to default greeting
                this.setDialogueState(prev => ({
                    ...prev,
                    message: "Hello traveler! How may I help you today?",
                    options: options,
                }));
            }
        } catch (error) {
            console.error("[DialogueManager] Failed to show dialogue:", error);
        }
    }
    
    /**
     * Handle streaming response chunks
     */
    private handleStreamingResponse(chunk: string, isComplete: boolean): void {
        this.setDialogueState(prev => {
            // If this is the first chunk, replace the loading indicator
            const currentMessage = prev.message === "..." ? chunk : prev.message + chunk;
            
            return {
                ...prev,
                message: currentMessage,
                // Only show options when the response is complete
                options: isComplete ? [
                    "Tell me about yourself",
                    "What goods do you have?",
                    "Any interesting news?",
                    "Goodbye",
                ] : [],
            };
        });
    }

    /**
     * Handle dialogue option selection
     */
    public async handleDialogueOption(option: string): Promise<void> {
        if (option === "Goodbye") {
            this.handleCloseDialogue();
            return;
        }

        // Show loading state
        this.setDialogueState((prev) => ({
            ...prev,
            message: "...",
            options: [], // Remove options while loading
        }));

        try {
            // Use the stored personality type from dialogue state
            const npcType = this.dialogueState.personalityType || this.dialogueState.npcName.toLowerCase();
            
            // Use streaming response
            await this.aiService.generateResponse(
                npcType, 
                option, 
                undefined, // Use default game context
                this.handleStreamingResponse.bind(this) // Pass streaming callback
            );
            
            // Note: options are now added in the streaming callback when isComplete=true
        } catch (error) {
            console.error("[DialogueManager] Failed to get dialogue response:", error);
            this.setDialogueState((prev) => ({
                ...prev,
                message: "I'm sorry, I seem to be distracted. What were you saying?",
                options: [
                    "Tell me about yourself",
                    "What goods do you have?",
                    "Any interesting news?",
                    "Goodbye",
                ],
            }));
        }
    }

    /**
     * Close the dialogue
     */
    public handleCloseDialogue(): void {
        // Just resume the scene
        this.gameScene?.scene.resume();
        
        // Reset dialogue state
        this.setDialogueState((prev) => ({
            ...prev,
            isOpen: false,
        }));
    }

    /**
     * Update the internal dialogue state reference
     */
    public updateDialogueState(state: DialogueState): void {
        this.dialogueState = state;
    }
}
