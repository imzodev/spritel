import Phaser from "phaser";
import { PlayerConfig, AnimationConfig } from "../types/GameTypes";

export class Player {
    private sprite: Phaser.Physics.Arcade.Sprite;
    private config: PlayerConfig;
    private animConfig: AnimationConfig;
    private lastDirection: string = "down";
    private scene: Phaser.Scene;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        config: PlayerConfig,
        animConfig: AnimationConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.animConfig = animConfig;
        this.sprite = this.createSprite(x, y);
        this.setupAnimations();
    }

    private createSprite(x: number, y: number): Phaser.Physics.Arcade.Sprite {
        console.log("Creating player sprite at:", x, y);
        const sprite = this.scene.physics.add.sprite(x, y, "player");
        console.log("Sprite created:", sprite);
        sprite.setScale(this.config.scale);
        sprite.setCollideWorldBounds(true);

        if (sprite.body) {
            sprite.body.setSize(
                this.config.bodySize.width,
                this.config.bodySize.height
            );
            sprite.body.setOffset(
                this.config.bodyOffset.x,
                this.config.bodyOffset.y
            );
        }

        // Set a high depth to ensure player renders above all layers
        sprite.setDepth(100);
        return sprite;
    }

    private setupAnimations(): void {
        const { frameRate, framesPerRow, rows } = this.animConfig;

        // Create idle animations
        ["up", "left", "down", "right"].forEach((direction, index) => {
            const row = [
                rows.idleUp,
                rows.idleLeft,
                rows.idleDown,
                rows.idleRight,
            ][index];
            this.createAnimation(`idle-${direction}`, row, 2, 1.5, true);
        });

        // Create walk animations
        ["up", "left", "down", "right"].forEach((direction, index) => {
            const row = [
                rows.walkUp,
                rows.walkLeft,
                rows.walkDown,
                rows.walkRight,
            ][index];
            this.createAnimation(`walk-${direction}`, row, 9, frameRate);
        });

        // Create attack animations
        ["up", "left", "down", "right"].forEach((direction, index) => {
            const row = [
                rows.attackUp,
                rows.attackLeft,
                rows.attackDown,
                rows.attackRight,
            ][index];
            this.createAnimation(`attack-${direction}`, row, 6, 12, false);
        });
    }

    private createAnimation(
        key: string,
        row: number,
        frameCount: number,
        frameRate: number,
        yoyo: boolean = false
    ): void {
        this.scene.anims.create({
            key,
            frames: this.scene.anims.generateFrameNumbers("player", {
                start: row * this.animConfig.framesPerRow,
                end: row * this.animConfig.framesPerRow + (frameCount - 1),
            }),
            frameRate,
            repeat: yoyo ? -1 : 0,
            yoyo,
        });
    }

    public update(
        movement: { x: number; y: number },
        isAttacking: boolean
    ): void {
        if (isAttacking) {
            this.attack();
            return;
        }

        this.move(movement);
    }

    private move(movement: { x: number; y: number }): void {
        const { x, y } = movement;

        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const factor = Math.SQRT1_2;
            this.sprite.setVelocity(
                x * this.config.speed * factor,
                y * this.config.speed * factor
            );
        } else {
            this.sprite.setVelocity(
                x * this.config.speed,
                y * this.config.speed
            );
        }

        // Update animation
        let direction = "";
        if (y < 0) direction = "up";
        else if (y > 0) direction = "down";
        else if (x < 0) direction = "left";
        else if (x > 0) direction = "right";

        if (direction) {
            this.lastDirection = direction;
            this.sprite.anims.play(`walk-${direction}`, true);
        } else {
            this.playIdle();
        }
    }

    private attack(): void {
        const attackAnim = `attack-${this.lastDirection}`;
        if (
            !this.sprite.anims.isPlaying ||
            !this.sprite.anims.currentAnim?.key.startsWith("attack-")
        ) {
            this.sprite.anims.play(attackAnim, true);
        }
    }

    private playIdle(): void {
        const idleAnim = `idle-${this.lastDirection}`;
        if (
            !this.sprite.anims.isPlaying ||
            !this.sprite.anims.currentAnim?.key.startsWith("idle-")
        ) {
            this.sprite.anims.play(idleAnim, true);
        }
    }

    public getSprite(): Phaser.Physics.Arcade.Sprite {
        return this.sprite;
    }

    public setPosition(x: number, y: number): void {
        this.sprite.setPosition(x, y);
    }
}
