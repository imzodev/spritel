import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import MobileControls from "./MobileControls";
import GameScene from "../scenes/GameScene";

const Game = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
    const [gameScene, setGameScene] = useState<GameScene | null>(null);

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

        // Get a reference to the game scene for mobile controls
        const checkForScene = () => {
            try {
                const scene = game.scene.getScene("GameScene") as GameScene;
                if (scene) {
                    setGameScene(scene);
                    return true;
                }
            } catch (e) {
                console.log("Scene not ready yet");
            }
            return false;
        };

        // Try immediately
        if (!checkForScene()) {
            // If not available, try again after a short delay
            const intervalId = setInterval(() => {
                if (checkForScene()) {
                    clearInterval(intervalId);
                }
            }, 100);
        }

        return () => game.destroy(true);
    }, []);

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
                className="fixed inset-0 w-screen h-screen z-10"
            ></div>
            {/* Only show mobile controls on mobile devices */}
            <div className="pointer-events-none z-20">
                <MobileControls
                    onDirectionPress={handleDirectionPress}
                    onAttackPress={handleAttackPress}
                />
            </div>
        </div>
    );
};

export default Game;
