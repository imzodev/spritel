import Phaser from "phaser";
import { PlayerConfig, AnimationConfig } from "../types/GameTypes";

export class Player {
    private sprite: Phaser.Physics.Arcade.Sprite;
    private config: PlayerConfig;
    private animConfig: AnimationConfig;
    private lastDirection: string = "down";
    private scene: Phaser.Scene;
    private isAttacking: boolean = false; // Add this to track attack state
    private id: string | null = null;  // Start with null ID
    private currentAnimation: string = 'idle-down';
    private mapPosition: { x: number, y: number } = { x: 0, y: 0 };

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

    public setId(id: string) {
        this.id = id;
    }

    public getId(): string {
        return this.id || '';
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

        // Set player depth between lower and upper decoration layers
        sprite.setDepth(20);
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
        // Update facing direction even during attack
        if (movement.x !== 0 || movement.y !== 0) {
            this.updateFacingDirection(movement);
        }

        // If we're in the middle of an attack animation, don't allow movement
        if (this.isAttacking) {
            return;
        }

        // Start new attack if requested
        if (isAttacking) {
            this.attack();
            return;
        }

        // Handle regular movement
        this.move(movement);
    }

    private updateFacingDirection(movement: { x: number; y: number }): void {
        if (movement.y < 0) this.lastDirection = "up";
        else if (movement.y > 0) this.lastDirection = "down";
        else if (movement.x < 0) this.lastDirection = "left";
        else if (movement.x > 0) this.lastDirection = "right";
    }

    private move(movement: { x: number; y: number }): void {
        const { x, y } = movement;

        // Set velocity based on input
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

        // Play walk animation in the current direction
        if (x !== 0 || y !== 0) {
            const walkAnim = `walk-${this.lastDirection}`;
            this.currentAnimation = walkAnim;
            this.sprite.anims.play(walkAnim, true);
        } else {
            this.playIdle();
        }
    }

    private attack(): void {
        const attackAnim = `attack-${this.lastDirection}`;
        this.currentAnimation = attackAnim;
        this.isAttacking = true;
        this.sprite.setVelocity(0, 0); // Stop movement during attack
        this.sprite.anims.play(attackAnim, true);

        // Return to normal state when animation completes
        this.sprite.once("animationcomplete", () => {
            this.isAttacking = false;
            this.playIdle();
        });
    }

    private playIdle(): void {
        const idleAnim = `idle-${this.lastDirection}`;
        this.currentAnimation = idleAnim;
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

    public getCurrentAnimation(): string {
        return this.currentAnimation;
    }

    public getMapPosition(): { x: number, y: number } {
        return this.mapPosition;
    }

    public setMapPosition(x: number, y: number): void {
        this.mapPosition = { x, y };
    }
}
