import Phaser from "phaser";

export interface NPCConfig {
    x: number;
    y: number;
    texture: string;
    scale?: number;
    interactionRadius?: number;
    defaultAnimation?: string;
}

export class NPC {
    private sprite: Phaser.Physics.Arcade.Sprite;
    private scene: Phaser.Scene;
    private interactionZone: Phaser.GameObjects.Circle;
    private state: 'idle' | 'walking' | 'talking' | 'busy' = 'idle';
    private interactionRadius: number;
    private facing: 'up' | 'down' | 'left' | 'right' = 'down';

    constructor(scene: Phaser.Scene, config: NPCConfig) {
        this.scene = scene;
        this.interactionRadius = config.interactionRadius || 50;

        // Create the NPC sprite
        this.sprite = scene.physics.add.sprite(config.x, config.y, config.texture);
        this.sprite.setScale(config.scale || 0.5);
        this.sprite.setImmovable(true);
        
        // Ensure the sprite is visible and at the correct depth
        this.sprite.setVisible(true);
        this.sprite.setDepth(20); // Same depth as player for consistency
        
        // Set up body size and offset for better collision
        this.sprite.body.setSize(32, 32);
        this.sprite.body.setOffset(16, 32);
        
        // Start default animation if provided
        if (config.defaultAnimation) {
            this.sprite.play(config.defaultAnimation);
            console.log('Playing animation:', config.defaultAnimation);
        }
        
        // Create interaction zone
        this.interactionZone = scene.add.circle(
            config.x,
            config.y,
            this.interactionRadius,
            0xffffff,
            0.2
        );
        this.interactionZone.setVisible(false);
        this.interactionZone.setDepth(19); // Below the NPC

        // Set up physics body for interaction zone
        scene.physics.add.existing(this.interactionZone, true);
    }

    public update(): void {
        // Update interaction zone position to follow NPC
        this.interactionZone.setPosition(this.sprite.x, this.sprite.y);
    }

    public isPlayerInRange(player: Phaser.Physics.Arcade.Sprite): boolean {
        const distance = Phaser.Math.Distance.Between(
            player.x,
            player.y,
            this.sprite.x,
            this.sprite.y
        );
        return distance <= this.interactionRadius;
    }

    public setState(newState: 'idle' | 'walking' | 'talking' | 'busy'): void {
        this.state = newState;
    }

    public getState(): string {
        return this.state;
    }

    public getSprite(): Phaser.Physics.Arcade.Sprite {
        return this.sprite;
    }

    public getInteractionZone(): Phaser.GameObjects.Circle {
        return this.interactionZone;
    }

    public setFacing(direction: 'up' | 'down' | 'left' | 'right'): void {
        this.facing = direction;
        const texture = this.sprite.texture.key;
        this.sprite.play(`${texture}_idle_${direction}`, true);
    }

    public getFacing(): string {
        return this.facing;
    }

    // Add getter for debugging
    public getPosition(): {x: number, y: number} {
        return {
            x: this.sprite.x,
            y: this.sprite.y
        };
    }
}
