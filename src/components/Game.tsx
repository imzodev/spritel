import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import MobileControls from "./MobileControls";
import DialogueBox from "./DialogueBox";
import GameScene from "../scenes/GameScene";
import { NPCAIService } from "../services/NPCAIService";

const Game = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    // Removed unused gameInstance state
    const [gameScene, setGameScene] = useState<GameScene | null>(null);
    const [dialogueState, setDialogueState] = useState({
        isOpen: false,
        npcName: "",
        personalityType: "", // Add personality type for AI responses
        message: "",
        options: [] as string[],
    });
    
    const aiService = useRef(new NPCAIService());



    useEffect(() => {
        if (!gameContainerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 768,
            height: 480,
            physics: {
                default: "arcade",
                arcade: { gravity: { x: 0, y: 0 }, debug: true }, // Enable debug mode to see collision boxes
            },
            scene: GameScene,
            pixelArt: true,
            scale: {
                mode: Phaser.Scale.FIT, // Use STRETCH to fill the entire screen
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        };

        const game = new Phaser.Game(config);

        const checkForScene = () => {
            try {
                const scene = game.scene.getScene("GameScene") as GameScene;
                if (scene) {
                    setGameScene(scene);
                    return true;
                }
            } catch (event) {
                console.log("Scene not ready yet");
            }
            return false;
        };

        if (!checkForScene()) {
            const intervalId = setInterval(() => {
                if (checkForScene()) {
                    clearInterval(intervalId);
                }
            }, 100);
        }

        return () => {
            game.destroy(true);
            setGameScene(null); // Ensure gameScene is reset
        };
    }, []);

    useEffect(() => {
        if (!gameScene) return;

        // Subscribe to NPC interaction and end events
        gameScene.events.on("npcInteraction", handleNPCInteraction);
        gameScene.events.on("npcInteractionEnd", handleCloseDialogue);

        return () => {
            // Cleanup NPC interaction and end event listeners
            gameScene.events.off("npcInteractionEnd", handleCloseDialogue);
            gameScene.events.off("npcInteraction", handleNPCInteraction);
        };
    }, [gameScene]);

    // Create a reusable function to get game context
    const getGameContext = () => {
        return {
            timeOfDay: 'day', // Could be dynamic based on game time
            weather: 'clear', // Could be dynamic based on game weather
            playerLevel: 1, // Could be dynamic based on player stats
            location: 'village', // Could be dynamic based on map
            activeQuests: ['tutorial'] // Could be dynamic based on quest log
        };
    };

    // Create a reusable function to get AI response
    const getAIResponse = async (npcType: string, message: string) => {
        try {
            return await aiService.current.generateResponse(
                npcType,
                message,
                getGameContext()
            );
        } catch (error) {
            console.error("[Game] Failed to get AI response:", error);
            return null; // Return null to indicate failure
        }
    };

    const handleNPCInteraction = async (data: {
        npcId: string;
        npcName: string;
        personalityType: string;
        context?: any;
    }) => {
        console.log("[Game] Received NPC interaction event:", data);
        // Pause the game scene
        gameScene?.scene.pause();

        // Get initial NPC response
        try {
            console.log('[Game] Setting dialogue state to open');
            
            // Default message and options
            let initialMessage = "Hello traveler! How may I help you today?";
            let options = [
                "Tell me about yourself",
                "What goods do you have?",
                "Any interesting news?",
                "Goodbye",
            ];
            
            // Get AI-generated greeting
            const aiResponse = await getAIResponse(
                data.personalityType || 'merchant',
                "Hello, I'm a new traveler here."
            );
            
            if (aiResponse) {
                initialMessage = aiResponse;
            }
            
            setDialogueState(prev => {
                console.log('[Game] Previous dialogue state:', prev);
                const newState = {
                    isOpen: true,
                    npcName: data.npcName,
                    personalityType: data.personalityType || 'merchant', // Store personality type for later use
                    message: initialMessage,
                    options: options,
                };
                console.log('[Game] New dialogue state:', newState);
                return newState;
            });
        } catch (error) {
            console.error("[Game] Failed to show dialogue:", error);
        }
    };

    const handleDialogueOption = async (option: string) => {
        if (option === "Goodbye") {
            handleCloseDialogue();
            return;
        }

        // Show loading state
        setDialogueState((prev) => ({
            ...prev,
            message: "...",
            options: [], // Remove options while loading
        }));

        try {
            // Use the stored personality type from dialogue state
            const npcType = dialogueState.personalityType || dialogueState.npcName.toLowerCase();
            const response = await getAIResponse(npcType, option);
            
            setDialogueState((prev) => ({
                ...prev,
                message: response || "I'm sorry, I seem to be distracted. What were you saying?",
                options: [
                    "Tell me more",
                    "Ask another question",
                    "Thank you",
                    "Goodbye"
                ],
            }));
        } catch (error) {
            console.error("[Game] Failed to get dialogue response:", error);
            setDialogueState((prev) => ({
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
    };

    const handleCloseDialogue = () => {
        // Just resume the scene
        gameScene?.scene.resume();
        
        setDialogueState(prev => ({
            ...prev,
            isOpen: false,
            npcName: '',
            message: '',
            options: []
        }));
    };

    // Handle mobile control events
    const handleDirectionPress = (direction: string | null) => {
        if (!gameScene) return;
        gameScene.setVirtualControlDirection(direction);
    };

    const handleAttackPress = () => {
        if (!gameScene) return;
        gameScene.triggerVirtualAttack();
    };



    return (
        <div className="relative w-full h-full">
            <div 
                id="game-container"
                data-testid="game-container"
                ref={gameContainerRef}
                className="absolute inset-0 w-full h-full z-10"
            />
            
            <div className="pointer-events-none absolute inset-0 z-20">
                <MobileControls
                    onDirectionPress={handleDirectionPress}
                    onAttackPress={handleAttackPress}
                />
            </div>

            {/* DialogueBox with highest z-index */}
            <div className="absolute inset-0 z-30 pointer-events-auto">
                <DialogueBox
                    npcName={dialogueState.npcName}
                    message={dialogueState.message}
                    options={dialogueState.options}
                    onOptionSelect={handleDialogueOption}
                    onClose={handleCloseDialogue}
                    isOpen={dialogueState.isOpen}
                />
            </div>


        </div>
    );
};

export default Game;
