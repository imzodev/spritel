import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import MobileControls from "./MobileControls";
import DialogueBox from "./DialogueBox";
import GameScene from "../scenes/GameScene";
import { NPCAIService } from "../services/NPCAIService";
import { DialogueManager, DialogueState } from "../managers/DialogueManager";

const Game = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    // Removed unused gameInstance state
    const [gameScene, setGameScene] = useState<GameScene | null>(null);
    const [dialogueState, setDialogueState] = useState<DialogueState>({
        isOpen: false,
        npcName: "",
        personalityType: "",
        message: "",
        options: [],
    });
    
    const aiService = useRef(new NPCAIService());
    const dialogueManager = useRef<DialogueManager | null>(null);



    // Initialize dialogue manager
    useEffect(() => {
        dialogueManager.current = new DialogueManager(
            aiService.current,
            dialogueState,
            setDialogueState
        );
    }, []);

    // Update dialogue manager when dialogue state changes
    useEffect(() => {
        if (dialogueManager.current) {
            dialogueManager.current.updateDialogueState(dialogueState);
        }
    }, [dialogueState]);

    // Initialize dialogue manager
    useEffect(() => {
        dialogueManager.current = new DialogueManager(
            aiService.current,
            dialogueState,
            setDialogueState
        );
    }, []);

    // Update dialogue manager when dialogue state changes
    useEffect(() => {
        if (dialogueManager.current) {
            dialogueManager.current.updateDialogueState(dialogueState);
        }
    }, [dialogueState]);

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
                    if (dialogueManager.current) {
                        dialogueManager.current.setGameScene(scene);
                    }
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

    // AI service is now responsible for game context and response generation

    // Delegate NPC interaction handling to DialogueManager
    const handleNPCInteraction = async (data: {
        npcId: string;
        npcName: string;
        personalityType: string;
        context?: any;
    }) => {
        if (dialogueManager.current) {
            await dialogueManager.current.handleNPCInteraction(data);
        }
    };

    // Delegate dialogue option handling to DialogueManager
    const handleDialogueOption = async (option: string) => {
        if (dialogueManager.current) {
            await dialogueManager.current.handleDialogueOption(option);
        }
    };

    // Delegate dialogue closing to DialogueManager
    const handleCloseDialogue = () => {
        if (dialogueManager.current) {
            dialogueManager.current.handleCloseDialogue();
        }
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
