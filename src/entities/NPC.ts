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
    
    // Add new properties for movement
    private moveTimer: number = 0;
    private currentVelocity: { x: number, y: number } = { x: 0, y: 0 };
    private walkSpeed: number = 50; // Slow walking speed
    private homePosition: { x: number, y: number };
    private wanderRadius: number = 100; // How far from home position the NPC can wander
    private currentAnimation: string = '';
    
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

        // Store initial position as home position
        this.homePosition = { x: config.x, y: config.y };
    }

    public update(): void {
        // Update interaction zone position to follow NPC
        this.interactionZone.setPosition(this.sprite.x, this.sprite.y);

        // Don't move if talking or busy
        if (this.state === 'talking' || this.state === 'busy') {
            this.sprite.setVelocity(0, 0);
            this.playAnimation('idle');
            return;
        }

        // Decrease move timer
        this.moveTimer -= this.scene.game.loop.delta;

        // Time to change direction or stop/start moving
        if (this.moveTimer <= 0) {
            this.decideNewMovement();
        }

        // Check if NPC has wandered too far from home
        const distanceFromHome = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.homePosition.x, this.homePosition.y
        );

        if (distanceFromHome > this.wanderRadius) {
            // Calculate direction to home
            const dx = this.homePosition.x - this.sprite.x;
            const dy = this.homePosition.y - this.sprite.y;
            
            // Reset current velocity
            this.currentVelocity.x = 0;
            this.currentVelocity.y = 0;

            // Choose either horizontal or vertical movement, not both
            if (Math.abs(dx) > Math.abs(dy)) {
                // Move horizontally
                this.currentVelocity.x = dx > 0 ? this.walkSpeed : -this.walkSpeed;
                this.setFacing(dx > 0 ? 'right' : 'left');
            } else {
                // Move vertically
                this.currentVelocity.y = dy > 0 ? this.walkSpeed : -this.walkSpeed;
                this.setFacing(dy > 0 ? 'down' : 'up');
            }
        }

        // Apply velocity
        this.sprite.setVelocity(this.currentVelocity.x, this.currentVelocity.y);

        // Update state and animation
        if (this.currentVelocity.x !== 0 || this.currentVelocity.y !== 0) {
            this.state = 'walking';
            this.playAnimation('walk');
        } else {
            this.state = 'idle';
            this.playAnimation('idle');
        }
    }

    private decideNewMovement(): void {
        // Random number between 2 and 5 seconds
        this.moveTimer = Phaser.Math.Between(2000, 5000);

        // 30% chance to stay idle
        if (Phaser.Math.Between(1, 100) <= 30) {
            this.currentVelocity.x = 0;
            this.currentVelocity.y = 0;
            return;
        }

        // Choose a random direction (0: up, 1: right, 2: down, 3: left)
        const direction = Phaser.Math.Between(0, 3);
        
        // Reset velocities
        this.currentVelocity.x = 0;
        this.currentVelocity.y = 0;

        switch (direction) {
            case 0: // up
                this.currentVelocity.y = -this.walkSpeed;
                this.setFacing('up');
                break;
            case 1: // right
                this.currentVelocity.x = this.walkSpeed;
                this.setFacing('right');
                break;
            case 2: // down
                this.currentVelocity.y = this.walkSpeed;
                this.setFacing('down');
                break;
            case 3: // left
                this.currentVelocity.x = -this.walkSpeed;
                this.setFacing('left');
                break;
        }
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
        if (this.facing !== direction) {
            this.facing = direction;
            // Update animation immediately when direction changes
            this.playAnimation(this.state === 'walking' ? 'walk' : 'idle');
        }
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

    private playAnimation(type: 'idle' | 'walk'): void {
        const animationKey = `${this.sprite.texture.key}_${type}_${this.facing}`;
        
        // Only change animation if it's different from the current one
        if (this.currentAnimation !== animationKey) {
            this.currentAnimation = animationKey;
            this.sprite.play(animationKey, true);
        }
    }
}
