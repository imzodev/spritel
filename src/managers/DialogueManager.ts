import { NPCAIService } from '../services/NPCAIService';
import GameScene from '../scenes/GameScene';

export interface DialogueState {
    isOpen: boolean;
    npcName: string;
    personalityType: string;
    message: string;
    options: string[];
    awaitingCustomInput?: boolean;
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
    
    // Centralized default options to avoid repetition
    private getDefaultOptions(): string[] {
        return [
            "Tell me about yourself",
            "What goods do you have?",
            "Any interesting news?",
            "Custom message...",
            "Goodbye",
        ];
    }

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
            const options = this.getDefaultOptions();
            
            // First set the dialogue state with a loading message
            this.setDialogueState(() => ({
                isOpen: true,
                npcName: data.npcName,
                personalityType: data.personalityType || 'merchant', // Store personality type for later use
                message: "...",
                options: [], // No options while loading
                awaitingCustomInput: false,
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
                    awaitingCustomInput: false,
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
                options: isComplete ? this.getDefaultOptions() : [],
                awaitingCustomInput: isComplete ? false : prev.awaitingCustomInput,
            };
        });
    }

    // Helper to show loading state while awaiting AI response
    private showLoadingState(): void {
        this.setDialogueState((prev) => ({
            ...prev,
            message: "...",
            options: [],
            awaitingCustomInput: false,
        }));
    }

    /**
     * Handle dialogue option selection
     */
    public async handleDialogueOption(option: string): Promise<void> {
        if (option === "Custom message...") {
            // Enter custom input mode
            this.setDialogueState((prev) => ({
                ...prev,
                awaitingCustomInput: true,
                options: [],
                message: "Type your message below and press Enter or Send.",
            }));
            // Disable Phaser keyboard while typing custom input
            if (this.gameScene && this.gameScene.input && this.gameScene.input.keyboard) {
                this.gameScene.input.keyboard.enabled = false;
            }
            return;
        }
        if (option === "Goodbye") {
            this.handleCloseDialogue();
            return;
        }

        // Show loading state
        this.showLoadingState();

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
                options: this.getDefaultOptions(),
                awaitingCustomInput: false,
            }));
        }
    }

    /**
     * Submit a custom free-form message from the user
     */
    public async handleCustomMessage(message: string): Promise<void> {
        if (!message || message.trim().length === 0) {
            // Ignore empty submissions, keep input open
            return;
        }

        // Show loading state and exit input mode
        this.setDialogueState((prev) => ({
            ...prev,
            message: "...",
            options: [],
            awaitingCustomInput: false,
        }));

        // Re-enable Phaser keyboard now that we're leaving input mode
        if (this.gameScene && this.gameScene.input && this.gameScene.input.keyboard) {
            this.gameScene.input.keyboard.enabled = true;
        }

        try {
            const npcType = this.dialogueState.personalityType || this.dialogueState.npcName.toLowerCase();
            await this.aiService.generateResponse(
                npcType,
                message,
                undefined,
                this.handleStreamingResponse.bind(this)
            );
        } catch (error) {
            console.error("[DialogueManager] Failed to get dialogue response for custom message:", error);
            this.setDialogueState((prev) => ({
                ...prev,
                message: "Hmm, I didn't catch that. Care to try again?",
                options: this.getDefaultOptions(),
                awaitingCustomInput: false,
            }));
            // Ensure keyboard is re-enabled on error
            if (this.gameScene && this.gameScene.input && this.gameScene.input.keyboard) {
                this.gameScene.input.keyboard.enabled = true;
            }
        }
    }

    /**
     * Cancel custom message input and restore options
     */
    public cancelCustomMessage(): void {
        this.setDialogueState((prev) => ({
            ...prev,
            awaitingCustomInput: false,
            options: this.getDefaultOptions(),
        }));
        // Re-enable Phaser keyboard when exiting input mode
        if (this.gameScene && this.gameScene.input && this.gameScene.input.keyboard) {
            this.gameScene.input.keyboard.enabled = true;
        }
    }

    /**
     * Close the dialogue
     */
    public handleCloseDialogue(): void {
        // Just resume the scene
        this.gameScene?.scene.resume();
        // Ensure keyboard is enabled when closing dialogue
        if (this.gameScene && this.gameScene.input && this.gameScene.input.keyboard) {
            this.gameScene.input.keyboard.enabled = true;
        }
        
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
