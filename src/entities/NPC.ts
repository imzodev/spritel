import Phaser from "phaser";
import GameScene from "../scenes/GameScene";

export interface NPCConfig {
    id: string;
    x: number;
    y: number;
    texture: string;
    scale?: number;
    interactionRadius?: number;
    defaultAnimation?: string;
    mapCoordinates: { x: number, y: number };
}

export class NPC {
    private sprite: Phaser.Physics.Arcade.Sprite;
    private config: NPCConfig;
    private scene: GameScene
    private interactionZone: Phaser.GameObjects.Arc;
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
    private mapCoordinates: { x: number, y: number };
    private isColliding: boolean = false;
    private lastCollisionTime: number = 0;
    private collisionCooldown: number = 500; // 500ms cooldown between collision reports
    private colliders: Phaser.Physics.Arcade.Collider[] = [];
    private readonly INTERPOLATION_SPEED = 0.3; // Adjust this value to change smoothing (0-1)
    private targetPosition = { x: 0, y: 0 };
    
    constructor(scene: Phaser.Scene, config: NPCConfig) {
        this.scene = scene;
        this.config = config;
        this.interactionRadius = config.interactionRadius || 50;
        this.mapCoordinates = config.mapCoordinates;

        // Create the NPC sprite
        this.sprite = scene.physics.add.sprite(config.x, config.y, config.texture);
        this.sprite.setScale(config.scale || 0.5);
        
        // Enable physics on the sprite
        scene.physics.world.enable(this.sprite);
        
        // Configure physics body
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        
        // Adjust these values based on your sprite's actual size
        const bodyWidth = 28;  // Width of collision box
        const bodyHeight = 28; // Height of collision box
        
        // Calculate offsets to center the collision box
        const offsetX = (this.sprite.width - bodyWidth) / 2;
        const offsetY = (this.sprite.height - bodyHeight);
        
        body.setSize(bodyWidth, bodyHeight);
        body.setOffset(offsetX, offsetY);
        
        console.log('[NPC] Physics body configured:', {
            width: body.width,
            height: body.height,
            offset: { x: body.offset.x, y: body.offset.y },
            spriteSize: { width: this.sprite.width, height: this.sprite.height }
        });
        
        body.setImmovable(true);
        
        // Don't allow the NPC to be pushed by collisions
        this.sprite.setImmovable(true);
        
        // Ensure the sprite is visible and at the correct depth
        this.sprite.setVisible(true);
        this.sprite.setDepth(20); // Same depth as player for consistency
        
        // Start default animation if provided
        if (config.defaultAnimation) {
            this.sprite.play(config.defaultAnimation);
            console.log('Playing animation:', config.defaultAnimation);
        }
        
        // Create interaction zone
        this.interactionZone = scene.add.arc(
            config.x,
            config.y,
            this.interactionRadius,
            0,                  // startAngle
            360,               // endAngle
            false,             // anticlockwise
            0x00ff00,          // color (green)
            0.3                // alpha - increased from 0.2
        );
        this.interactionZone.setVisible(false);  // Still starts invisible, but will be shown when in range
        this.interactionZone.setDepth(19); // Below the NPC

        // Set up physics body for interaction zone
        scene.physics.add.existing(this.interactionZone, true);

        // Store initial position as home position
        this.homePosition = { x: config.x, y: config.y };
    }

    public update(): void {
        // Update interaction zone position to follow NPC
        this.interactionZone.setPosition(this.sprite.x, this.sprite.y);

        // Handle collisions before updating position
        this.handleCollisions();

        if (!this.isColliding) {
            // Smooth position interpolation
            if (this.state === 'walking') {
                const dx = this.targetPosition.x - this.sprite.x;
                const dy = this.targetPosition.y - this.sprite.y;
                
                if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                    this.sprite.x += dx * this.INTERPOLATION_SPEED;
                    this.sprite.y += dy * this.INTERPOLATION_SPEED;
                    
                    // Update velocity for animation
                    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
                    body.setVelocity(
                        this.currentVelocity.x * this.walkSpeed,
                        this.currentVelocity.y * this.walkSpeed
                    );
                }
            }
        }

        // Update animation based on current state and facing
        this.updateAnimation();
    }

    private handleCollisions(): void {
        const now = Date.now();
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        
        const isCollidingNow = body.blocked.up || 
                              body.blocked.down || 
                              body.blocked.left || 
                              body.blocked.right;

        if (isCollidingNow && (!this.isColliding || now - this.lastCollisionTime > this.collisionCooldown)) {
            this.lastCollisionTime = now;
            
            const collision = {
                up: body.blocked.up,
                down: body.blocked.down,
                left: body.blocked.left,
                right: body.blocked.right
            };

            console.log('[NPC] Collision detected:', { id: this.getId(), collision });

            // Stop movement immediately
            this.currentVelocity = { x: 0, y: 0 };
            body.setVelocity(0, 0);

            // Send collision to server
            this.scene.game.events.emit('npc-collision', {
                npcId: this.getId(),
                collision
            });

            // Update state
            this.state = 'idle';
            this.isColliding = true;
        } else if (!isCollidingNow) {
            this.isColliding = false;
        }
    }

    public getId(): string {
        return this.config.id;
    }

    public updateFromNetwork(data: any): void {
        // Only update if NPC is in current map
        if (this.shouldBeVisible(data.mapCoordinates)) {
            // Update target position
            this.targetPosition = { x: data.x, y: data.y };
            
            // Update state and facing immediately
            this.state = data.state;
            this.facing = data.facing;
            this.currentVelocity = data.currentVelocity;

            // If we're too far from target, snap to it
            const distance = Phaser.Math.Distance.Between(
                this.sprite.x, this.sprite.y,
                this.targetPosition.x, this.targetPosition.y
            );
            
            if (distance > 100) { // Threshold for snapping
                this.sprite.x = this.targetPosition.x;
                this.sprite.y = this.targetPosition.y;
            }

            // Handle collision state
            if (this.isColliding) {
                const body = this.sprite.body as Phaser.Physics.Arcade.Body;
                body.setVelocity(0, 0);
                this.currentVelocity = { x: 0, y: 0 };
            }
        }
    }


    public isInInteractionRange(): boolean {
        const gameScene = this.scene as GameScene;
        const player = gameScene.getPlayer();
        if (!player) {
            return false;
        }

        const playerSprite = player.getSprite();
        const distance = Phaser.Math.Distance.Between(
            playerSprite.x,
            playerSprite.y,
            this.sprite.x,
            this.sprite.y
        );

        const inRange = distance <= this.interactionRadius;
        this.interactionZone.setVisible(inRange);
        
        return inRange;
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

    public getInteractionZone(): Phaser.GameObjects.Arc {
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

    public getMapCoordinates(): { x: number, y: number } {
        return this.mapCoordinates;
    }

    public shouldBeVisible(currentMapCoords: { x: number, y: number }): boolean {
        return this.mapCoordinates.x === currentMapCoords.x && 
               this.mapCoordinates.y === currentMapCoords.y;
    }

    private updateAnimation(): void {
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        const isMoving = Math.abs(body.velocity.x) > 0.1 || Math.abs(body.velocity.y) > 0.1;
        
        // Determine animation state
        const animState = isMoving ? 'walk' : 'idle';
        const animationKey = `npc_1_${animState}_${this.facing}`;
        
        // Only change animation if it's different
        if (this.currentAnimation !== animationKey) {
            this.currentAnimation = animationKey;
            this.sprite.play(animationKey, true);
        }
    }

    public setColliders(colliders: Phaser.Physics.Arcade.Collider[]): void {
        this.colliders = colliders;
    }

    public destroy(): void {
        // Remove all colliders
        this.colliders.forEach(collider => {
            if (collider) {
                collider.destroy();
            }
        });
        
        // Destroy sprite and interaction zone
        if (this.sprite) {
            this.sprite.destroy();
        }
        if (this.interactionZone) {
            this.interactionZone.destroy();
        }
    }

    private getAnimationKey(): string {
        const state = this.state === 'walking' ? 'walk' : 'idle';
        return `npc_1_${state}_${this.facing}`;
    }
}
