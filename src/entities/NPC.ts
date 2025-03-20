import Phaser from "phaser";
import GameScene from "../scenes/GameScene";

// Constants for tile-based calculations
const TILE_SIZE = 16; // Size of each tile in pixels
const MAP_WIDTH_TILES = 24;
const MAP_HEIGHT_TILES = 15;
const NPC_BUFFER_TILES = 1; // Keep NPCs 1 tiles away from edges

// Convert to pixels when needed
const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;

// Add these interfaces and constants
interface TilePosition {
    tileX: number;
    tileY: number;
}

function tilesToPixels(tileX: number, tileY: number): { x: number, y: number } {
    return {
        x: (tileX * TILE_SIZE) + (TILE_SIZE / 2),
        y: (tileY * TILE_SIZE) + (TILE_SIZE / 2)
    };
}

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
    private scene: GameScene;
    private sprite: Phaser.Physics.Arcade.Sprite;
    private config: NPCConfig;
    private isMoving: boolean = false;
    private moveSpeed: number = 1;
    private stepsRemaining: number = 0;
    private currentDirection: string = 'down';
    private state: string = 'idle';
    private facing: string = 'down';
    private interactionZone: Phaser.GameObjects.Arc;
    private interactionRadius: number;
    private mapCoordinates: { x: number, y: number };
    private currentAnimation: string | null = null;
    private colliders: Phaser.Physics.Arcade.Collider[] = []; // Initialize as empty array
    private currentPath: TilePosition[] = [];
    private currentTileIndex: number = 0;
    private movementProgress: number = 0;
    private homePosition: { x: number, y: number };
    private debugGraphics: Phaser.GameObjects.Graphics;
    private targetPosition: { x: number, y: number } | null = null;

    constructor(scene: GameScene, config: NPCConfig) {
        this.scene = scene;
        this.config = config;
        this.interactionRadius = config.interactionRadius || 50;
        this.mapCoordinates = config.mapCoordinates;

        // Create the NPC sprite
        this.sprite = scene.physics.add.sprite(config.x, config.y, config.texture);
        this.sprite.setScale(config.scale || 0.5);
        
        // Enable physics on the sprite
        scene.physics.world.enable(this.sprite);
        
        // Bind the handler to this instance
        this.handleMovementInstruction = this.handleMovementInstruction.bind(this);
        
        // Listen for movement instructions from NetworkManager instead of game events
        this.scene.getNetworkManager().on('npc-movement-instruction', (data: any) => {
            if (data.npcId === this.config.id) {
                this.handleMovementInstruction(data);
            }
        });
        
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
        
        body.setImmovable(true);
        
        // Don't allow the NPC to be pushed by collisions
        this.sprite.setImmovable(true);
        
        // Ensure the sprite is visible and at the correct depth
        this.sprite.setVisible(true);
        this.sprite.setDepth(20); // Same depth as player for consistency
        
        // Start default animation if provided
        if (config.defaultAnimation) {
            this.sprite.play(config.defaultAnimation);
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

        // Create debug graphics
        this.debugGraphics = scene.add.graphics();
        this.debugGraphics.setDepth(1); // Set depth to be above ground but below sprites
        
        // Initial debug draw
        this.drawDebugTiles();
    }

    public update(): void {
        if (this.isMoving) {
            const speed = (16 * this.moveSpeed) / 60; // Convert to pixels per frame
            let velocityX = 0;
            let velocityY = 0;

            switch (this.currentDirection) {
                case 'up':
                    velocityY = -speed;
                    break;
                case 'down':
                    velocityY = speed;
                    break;
                case 'left':
                    velocityX = -speed;
                    break;
                case 'right':
                    velocityX = speed;
                    break;
            }

            // Update sprite position
            this.sprite.x += velocityX;
            this.sprite.y += velocityY;

            // Update interaction zone position
            if (this.interactionZone) {
                this.interactionZone.setPosition(this.sprite.x, this.sprite.y);
            }

            // Check if we've reached the target position
            if (this.hasReachedTarget()) {
                console.log(`[NPC ${this.config.id}] Reached target position`);
                this.isMoving = false;
                this.state = 'idle';
                this.updateAnimation();
                
                // Notify server that movement is complete
                this.scene.getNetworkManager().sendNPCMovementComplete({
                    npcId: this.config.id,
                    x: this.sprite.x,
                    y: this.sprite.y
                });
            }
        }
        
        // Update collision and animation
        this.handleCollisions();
        this.handleEdgeOfMap();
        this.updateAnimation();

        // Add at the end of existing update method
        this.drawDebugTiles();
    }

    private handleCollisions(): void {
        if (!this.isMoving) return;
        
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        if (body.blocked.up || body.blocked.down || body.blocked.left || body.blocked.right) {
            this.isMoving = false;
            this.state = 'idle';
            this.scene.getNetworkManager().sendNPCCollision({
                npcId: this.getId(),
                collision: {
                    up: body.blocked.up,
                    down: body.blocked.down,
                    left: body.blocked.left,
                    right: body.blocked.right
                },
                currentTile: pixelsToTiles(this.sprite.x, this.sprite.y),
                x: this.sprite.x,
                y: this.sprite.y,
                facing: this.facing
            });
        }
    }

        
    private handleEdgeOfMap(): void {
        if (!this.isMoving) return;

        // Get tile coordinates
        const { tileX, tileY } = pixelsToTiles(this.sprite.x, this.sprite.y);

        // Check if NPC is within the buffer zone from the edge
        const atTopEdge = tileY <= NPC_BUFFER_TILES;
        const atBottomEdge = tileY >= MAP_HEIGHT_TILES - NPC_BUFFER_TILES - 1;
        const atLeftEdge = tileX <= NPC_BUFFER_TILES;
        const atRightEdge = tileX >= MAP_WIDTH_TILES - NPC_BUFFER_TILES - 1;

        const npcOnTheEdge = atTopEdge || atBottomEdge || atLeftEdge || atRightEdge;

        if (npcOnTheEdge) {
            this.isMoving = false;
            this.state = 'idle';
            
            // Stop the NPC's movement
            const body = this.sprite.body as Phaser.Physics.Arcade.Body;
            body.setVelocity(0, 0);
            // Notify server through NetworkManager
            this.scene.getNetworkManager().sendNPCMapEdge({
                npcId: this.getId(),
                edges: { up: atTopEdge, down: atBottomEdge, left: atLeftEdge, right: atRightEdge },
                currentTile: pixelsToTiles(this.sprite.x, this.sprite.y),
                x: this.sprite.x,
                y: this.sprite.y,
                facing: this.facing
            });

            console.log(`[NPC ${this.config.id}] Reached map edge at (${tileX}, ${tileY}) facing ${this.facing}`);
        }
    }

    public getId(): string {
        return this.config.id;
    }

    public updateFromNetwork(data: any): void {
        if (data.path) {
            this.currentPath = data.path;
            this.currentTileIndex = 0;
            this.isMoving = true;
            this.movementProgress = 0;
            this.facing = data.facing;
            this.state = data.state;
            
            // Snap to start of path if too far
            const startTile = this.currentPath[0];
            const startPos = tilesToPixels(startTile.tileX, startTile.tileY);
            const distance = Phaser.Math.Distance.Between(
                this.sprite.x, this.sprite.y,
                startPos.x, startPos.y
            );
            
            if (distance > TILE_SIZE * 2) {
                this.sprite.setPosition(startPos.x, startPos.y);
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
        // Remove the event listener
        this.scene.getNetworkManager().off('npc-movement-instruction', this.handleMovementInstruction);
        this.scene.getNetworkManager().off('npc-collision', this.handleCollisions);
        this.scene.getNetworkManager().off('npc-map-edge', this.handleEdgeOfMap);
        
        // Remove all colliders if they exist
        if (this.colliders && Array.isArray(this.colliders)) {
            this.colliders.forEach(collider => {
                if (collider) {
                    collider.destroy();
                }
            });
        }
        
        // Destroy sprite and interaction zone
        if (this.sprite) {
            this.sprite.destroy();
        }
        if (this.interactionZone) {
            this.interactionZone.destroy();
        }

        // Add to existing destroy method
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
        }
    }

    private getAnimationKey(): string {
        const state = this.state === 'walking' ? 'walk' : 'idle';
        return `npc_1_${state}_${this.facing}`;
    }

    private handleMovementInstruction(data: {
        npcId: string,
        targetX: number,
        targetY: number,
        facing: string,
        state: string
    }): void {
        this.isMoving = true;
        this.facing = data.facing;
        this.state = data.state;
        
        const speed = 60; // Pixels per second
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;

        // Simple velocity setting based on direction
        if (data.facing === 'up') body.setVelocity(0, -speed);
        else if (data.facing === 'down') body.setVelocity(0, speed);
        else if (data.facing === 'left') body.setVelocity(-speed, 0);
        else if (data.facing === 'right') body.setVelocity(speed, 0);
        
        this.updateAnimation();
    }

    private hasReachedTarget(): boolean {
        // Allow for a small threshold of error in position matching
        const threshold = 1;
        const targetX = this.targetPosition?.x ?? this.sprite.x;
        const targetY = this.targetPosition?.y ?? this.sprite.y;
        
        return Math.abs(this.sprite.x - targetX) < threshold && 
               Math.abs(this.sprite.y - targetY) < threshold;
    }

    private drawDebugTiles(): void {
        this.debugGraphics.clear();

        // Get current NPC position in tiles
        const { tileX, tileY } = pixelsToTiles(this.sprite.x, this.sprite.y);

        // Draw a 5x5 grid centered on the NPC
        for (let y = tileY - 2; y <= tileY + 2; y++) {
            for (let x = tileX - 2; x <= tileX + 2; x++) {
                // Different colors for different zones
                let color = 0x00ff00; // Default green for safe tiles
                let alpha = 0.2;

                // Edge buffer zone
                if (x <= NPC_BUFFER_TILES || 
                    x >= MAP_WIDTH_TILES - NPC_BUFFER_TILES - 1 ||
                    y <= NPC_BUFFER_TILES || 
                    y >= MAP_HEIGHT_TILES - NPC_BUFFER_TILES - 1) {
                    color = 0xff0000; // Red for buffer zone
                    alpha = 0.3;
                }

                // Current tile
                if (x === tileX && y === tileY) {
                    color = 0x0000ff; // Blue for current tile
                    alpha = 0.4;
                }

                // Draw tile
                this.debugGraphics.lineStyle(1, 0x000000, 0.5);
                this.debugGraphics.fillStyle(color, alpha);
                this.debugGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                this.debugGraphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}
function pixelsToTiles(x: number, y: number): { tileX: number, tileY: number } {
    return {
        tileX: Math.floor(x / TILE_SIZE),
        tileY: Math.floor(y / TILE_SIZE)
    };
}

