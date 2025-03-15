import Phaser from "phaser";
import { MapManager } from "../managers/MapManager";
import { Player } from "../entities/Player";
import { NetworkManager } from "../managers/NetworkManager";

export default class GameScene extends Phaser.Scene {
    private player!: Player;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private attackKey!: Phaser.Input.Keyboard.Key;
    private mapManager!: MapManager;
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private playerCollider: Phaser.Physics.Arcade.Collider | null = null;
    private virtualDirection: string | null = null;
    private virtualAttackTriggered: boolean = false;
    private isTransitioning: boolean = false;
    private isAttacking: boolean = false;
    private networkManager!: NetworkManager;
    private otherPlayers: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private initialized: boolean = false;

    constructor() {
        super({ key: "GameScene" });
    }

    preload(): void {
        this.initializeMapManager();
        this.loadAssets();
    }

    private initializeMapManager(): void {
        this.mapManager = new MapManager(this, {
            mapWidth: 24,
            mapHeight: 15,
            tileSize: 16,
            transitionThreshold: 5,
        });
        this.mapManager.loadMap(0, 0);
    }

    private loadAssets(): void {
        this.load.image("tiles", "/assets/beginnertileset.png");
        this.load.spritesheet("player", "/assets/player.png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        // Add load complete handler
        this.load.on("complete", () => {
            console.log("Assets loaded:", this.textures.list);
            if (this.textures.exists("player")) {
                console.log("Player texture loaded successfully");
            } else {
                console.error("Player texture failed to load");
            }
        });
    }

    create(): void {
        if (this.initialized) return;
        this.initialized = true;

        this.initializeControls();
        this.createPlayer();
        this.setupCamera();
        this.networkManager = new NetworkManager();
        this.setupNetworkHandlers();
    }

    private initializeControls(): void {
        if (!this.input.keyboard) {
            console.error("Keyboard input not available");
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
    }

    private createPlayer(): void {
        const playerConfig = {
            speed: 160,
            scale: 0.5,
            bodySize: { width: 20, height: 20 },
            bodyOffset: { x: 22, y: 42 },
        };

        const animConfig = {
            frameRate: 8,
            framesPerRow: 13,
            rows: {
                idleUp: 22,
                idleLeft: 23,
                idleDown: 24,
                idleRight: 25,
                walkUp: 8,
                walkLeft: 9,
                walkDown: 10,
                walkRight: 11,
                attackUp: 12,
                attackLeft: 13,
                attackDown: 14,
                attackRight: 15,
            },
        };

        // Create player at default position
        this.player = new Player(this, 100, 100, playerConfig, animConfig);
    }

    private setupCamera(): void {
        this.cameras.main.startFollow(this.player.getSprite());
        this.cameras.main.setZoom(2.0);
    }

    public setCollisionLayer(
        newLayer: Phaser.Tilemaps.TilemapLayer | null
    ): void {
        // First, clean up existing collision
        this.destroyCurrentLayers();

        // If we're just clearing the collision (newLayer is null), return early
        if (!newLayer) {
            this.collisionLayer = null;
            return;
        }

        // Validate the new layer
        if (!newLayer.tilemap) {
            console.error("Invalid collision layer provided - no tilemap");
            return;
        }

        try {
            newLayer.setCollisionByExclusion([-1, 0]);
            this.collisionLayer = newLayer;

            if (this.player && !this.isTransitioning) {
                this.playerCollider = this.physics.add.collider(
                    this.player.getSprite(),
                    newLayer
                );
            }
        } catch (error) {
            console.error("Failed to set up collision:", error);
            this.collisionLayer = null;
            this.playerCollider = null;
        }
    }

    private destroyCurrentLayers(): void {
        if (this.playerCollider) {
            this.physics.world.removeCollider(this.playerCollider);
            this.playerCollider = null;
        }
        this.collisionLayer = null;
    }

    public setVirtualControlDirection(direction: string | null): void {
        this.virtualDirection = direction;
    }

    public triggerVirtualAttack(): void {
        this.virtualAttackTriggered = true;
    }

    public startMapTransition(): void {
        this.isTransitioning = true;
        this.destroyCurrentLayers();
    }

    public endMapTransition(): void {
        this.isTransitioning = false;
        // Recreate collider if we have both player and collision layer
        if (this.player && this.collisionLayer) {
            this.playerCollider = this.physics.add.collider(
                this.player.getSprite(),
                this.collisionLayer
            );
        }
    }

    private setupNetworkHandlers(): void {
        this.networkManager.on('connect', () => {
            console.log('🎮 Connected to game server');
            // Send initial position to server right after connection
            this.networkManager.updatePlayerState(this.player);
        });

        this.networkManager.on('game-state', (data) => {
            console.log('📥 Received game state:', data.players);
            
            // First game state received - set our player's ID but keep our position
            if (!this.player.getId() && data.players.length > 0) {
                // Find our player in the received data (it will be the last one added)
                const myPlayer = data.players[data.players.length - 1];
                this.player.setId(myPlayer.id);
                
                console.log('🎮 Set player ID:', {
                    id: this.player.getId(),
                    x: this.player.getSprite().x,
                    y: this.player.getSprite().y
                });
                
                // Send our current position to server
                this.networkManager.updatePlayerState(this.player);
            }

            // Update other players
            data.players.forEach((playerData: any) => {
                if (playerData.id !== this.player.getId()) {
                    const existingSprite = this.otherPlayers.get(playerData.id);
                    if (existingSprite) {
                        // Update existing player position and animation
                        existingSprite.setPosition(playerData.x, playerData.y);
                        if (playerData.animation && existingSprite.anims.currentAnim?.key !== playerData.animation) {
                            existingSprite.play(playerData.animation, true);
                        }
                    } else {
                        // Create new player
                        console.log('➕ Creating other player:', playerData.id, 'at position:', playerData.x, playerData.y);
                        this.createOtherPlayer(playerData);
                    }
                }
            });
        });

        this.networkManager.on('player-joined', (data) => {
            console.log('👋 Player joined:', data.player);
            // Only create other players, not yourself
            if (data.player.id !== this.player.getId()) {
                this.createOtherPlayer(data.player);
            }
        });

        this.networkManager.on('player-left', (data) => {
            console.log('💨 Player left:', data.playerId);
            const sprite = this.otherPlayers.get(data.playerId);
            if (sprite) {
                sprite.destroy();
                this.otherPlayers.delete(data.playerId);
            }
        });

        this.networkManager.on('player-update', (data) => {
            // Ignore updates about our own player
            if (data.player.id === this.player.getId()) return;
            
            const sprite = this.otherPlayers.get(data.player.id);
            if (sprite) {
                // Update position
                sprite.setPosition(data.player.x, data.player.y);
                
                // Update animation if it's different
                if (data.player.animation && sprite.anims.currentAnim?.key !== data.player.animation) {
                    console.log('🎬 Updating player animation:', data.player.id, data.player.animation);
                    sprite.play(data.player.animation, true);
                }
            } else {
                console.log('➕ Late player creation:', data.player.id);
                this.createOtherPlayer(data.player);
            }
        });
    }

    private createOtherPlayer(playerData: any): void {
        if (this.otherPlayers.has(playerData.id)) {
            console.log('⚠️ Player already exists:', playerData.id);
            return;
        }
        
        console.log('🎮 Creating other player:', {
            id: playerData.id,
            position: { x: playerData.x, y: playerData.y }
        });
        
        const sprite = this.add.sprite(playerData.x, playerData.y, 'player');
        sprite.setScale(0.5);
        
        // Create animations if they don't exist yet
        this.ensureAnimationsExist();
        
        this.otherPlayers.set(playerData.id, sprite);
        sprite.play(playerData.animation || 'idle-down');
    }

    private ensureAnimationsExist(): void {
        const animConfig = {
            frameRate: 8,
            framesPerRow: 13,
            rows: {
                idleUp: 22,
                idleLeft: 23,
                idleDown: 24,
                idleRight: 25,
                walkUp: 8,
                walkLeft: 9,
                walkDown: 10,
                walkRight: 11,
                attackUp: 12,
                attackLeft: 13,
                attackDown: 14,
                attackRight: 15,
            },
        };

        ["up", "left", "down", "right"].forEach((direction) => {
            // Idle animations
            const idleKey = `idle-${direction}`;
            if (!this.anims.exists(idleKey)) {
                this.anims.create({
                    key: idleKey,
                    frames: this.anims.generateFrameNumbers("player", {
                        start: animConfig.rows[`idle${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow,
                        end: animConfig.rows[`idle${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow + 1,
                    }),
                    frameRate: 1.5,
                    repeat: -1,
                });
            }

            // Walk animations
            const walkKey = `walk-${direction}`;
            if (!this.anims.exists(walkKey)) {
                this.anims.create({
                    key: walkKey,
                    frames: this.anims.generateFrameNumbers("player", {
                        start: animConfig.rows[`walk${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow,
                        end: animConfig.rows[`walk${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow + 8,
                    }),
                    frameRate: 8,
                    repeat: -1,
                });
            }

            // Attack animations
            const attackKey = `attack-${direction}`;
            if (!this.anims.exists(attackKey)) {
                this.anims.create({
                    key: attackKey,
                    frames: this.anims.generateFrameNumbers("player", {
                        start: animConfig.rows[`attack${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow,
                        end: animConfig.rows[`attack${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof animConfig.rows] * animConfig.framesPerRow + 5,
                    }),
                    frameRate: 12,
                    repeat: 0,
                });
            }
        });
    }

    update(time: number, delta: number): void {
        if (!this.player || !this.cursors || this.isTransitioning) return;

        const movement = this.getMovementInput();

        // Simplified attack detection
        const isAttackTriggered =
            this.attackKey.isDown || this.virtualAttackTriggered;

        if (isAttackTriggered) {
            this.isAttacking = true;
        }

        this.player.update(movement, this.isAttacking);

        // Reset attack state after update
        this.isAttacking = false;
        this.virtualAttackTriggered = false;

        if (!this.isTransitioning) {
            this.mapManager.checkMapTransition(this.player.getSprite());
        }

        // Send player updates to server more frequently
        this.networkManager.updatePlayerState(this.player);
    }

    private getMovementInput(): { x: number; y: number } {
        let x = 0;
        let y = 0;

        // Handle keyboard input
        if (this.cursors.left.isDown) x = -1;
        else if (this.cursors.right.isDown) x = 1;
        if (this.cursors.up.isDown) y = -1;
        else if (this.cursors.down.isDown) y = 1;

        // Handle virtual input (mobile)
        if (this.virtualDirection) {
            switch (this.virtualDirection) {
                case "up":
                    y = -1;
                    break;
                case "down":
                    y = 1;
                    break;
                case "left":
                    x = -1;
                    break;
                case "right":
                    x = 1;
                    break;
            }
        }

        return { x, y };
    }
}
