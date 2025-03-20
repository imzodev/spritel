import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import MobileControls from "./MobileControls";
import DialogueBox from "./DialogueBox";
import GameScene from "../scenes/GameScene";
import { NPCAIService } from "../services/NPCAIService";

const Game = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
    const [gameScene, setGameScene] = useState<GameScene | null>(null);
    const [dialogueState, setDialogueState] = useState({
        isOpen: false,
        npcName: "",
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
        setGameInstance(game);

        const checkForScene = () => {
            try {
                const scene = game.scene.getScene("GameScene") as GameScene;
                if (scene) {
                    setGameScene(scene);
                    
                    // Subscribe to NPC interaction events
                    scene.events.on("npcInteraction", handleNPCInteraction);
                    return true;
                }
            } catch (e) {
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
            if (gameScene) {
                gameScene.events.off("npcInteraction", handleNPCInteraction);
            }
        };
    }, []);

    // useEffect(() => {
    //     if (gameScene) {
    //         // Add the event listener
    //         const handleNPCInteractionEvent = (data: any) => {
    //             console.log('[Game] NPC interaction event received:', data);
    //             handleNPCInteraction(data);
    //         };

    //         gameScene.events.on("npcInteraction", handleNPCInteractionEvent);

    //         return () => {
    //             // Clean up the listener
    //             gameScene.events.off("npcInteraction", handleNPCInteractionEvent);
    //         };
    //     }
    // }, [gameScene]);

    const handleNPCInteraction = async (data: {
        npcId: string;
        npcName: string;
        personalityType: string;
        context?: any;
    }) => {
        console.log('[Game] Received NPC interaction event:', data);
        
        // Pause the game scene
        if (gameScene) {
            gameScene.scene.pause();
        }

        // Get initial NPC response
        try {
            console.log('[Game] Setting dialogue state to open');
            setDialogueState(prev => {
                console.log('[Game] Previous dialogue state:', prev);
                const newState = {
                    isOpen: true,
                    npcName: data.npcName,
                    message: "Hello traveler! How may I help you today?",
                    options: [
                        "Tell me about yourself",
                        "What goods do you have?",
                        "Any interesting news?",
                        "Goodbye",
                    ],
                };
                console.log('[Game] New dialogue state:', newState);
                return newState;
            });
        } catch (error) {
            console.error('[Game] Failed to show dialogue:', error);
        }
    };

    const handleDialogueOption = async (option: string) => {
        if (option === "Goodbye") {
            handleCloseDialogue();
            return;
        }

        // Simple response without AI service for now
        setDialogueState(prev => ({
            ...prev,
            message: `You selected: ${option}`,
        }));
    };

    const handleCloseDialogue = () => {
        if (gameScene) {
            // Just resume the scene
            gameScene.scene.resume();
        }
        
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
