import Phaser from "phaser";
import { MapManager } from "../managers/MapManager";
import { Player } from "../entities/Player";
import { NetworkManager } from "../managers/NetworkManager";
import { NPCManager } from "../managers/NPCManager";
import { NPCState } from '../types/npc';

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
    private otherPlayersPhysics: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
    private initialized: boolean = false;
    private npcManager!: NPCManager;
    private interactKey!: Phaser.Input.Keyboard.Key;
    private colliders: Phaser.Physics.Arcade.Collider[] = [];

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
        // Change 'tiles' to 'beginnertileset' to match the tileset name in the map files
        this.load.image("beginnertileset", "/assets/beginnertileset.png");
        this.load.image("1_terrain", "/assets/1_terrain.png");
        this.load.image("3_plants", "/assets/3_plants.png");
        this.load.image("4_buildings", "/assets/4_buildings.png");
        this.load.image("4_buildings_x05", "/assets/4_buildings_x05.png");
        this.load.image("11_roofs", "/assets/11_roofs.png");
        this.load.image("spr_tileset_sunnysideworld_16px", "/assets/spr_tileset_sunnysideworld_16px.png");
        this.load.image("House", "/assets/House.png");
        this.load.image("Floors", "/assets/Floors.png");
        this.load.image("Floors_Tiles", "/assets/Floors_Tiles.png");
        this.load.image("Props", "/assets/Props.png");
        this.load.image("Roofs", "/assets/Roofs.png");
        this.load.image("Shadows", "/assets/Shadows.png");
        this.load.image("Rocks", "/assets/Rocks.png");
        this.load.image("Trees_Size_03", "/assets/Trees_Size_03.png");
        this.load.image("Walls", "/assets/Walls.png");
        this.load.image("Furniture", "/assets/Furniture.png")

        this.load.spritesheet("player", "/assets/player.png", {
            frameWidth: 64,
            frameHeight: 64,
        });
        
        this.load.spritesheet("npc_1", "/assets/npc_1.png", {
            frameWidth: 64,
            frameHeight: 64
        });

        // Add load complete handler
        this.load.on("complete", () => {
            console.log("Assets loaded:", this.textures.list);
            if (this.textures.exists("npc_1")) {
                console.log("NPC texture loaded successfully");
            } else {
                console.error("NPC texture failed to load");
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
        
        // First create the animations
        this.createNPCAnimations();
        
        // Initialize NPCManager after player is created
        this.initializeNPCManager();

        // Add interaction key
        if (this.input.keyboard) {
            this.interactKey = this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.E
            );
            console.log('Interaction key added', this.interactKey);
        } else {
            console.error("Keyboard input not available");
        }

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
        if (this.playerCollider) {
            this.physics.world.removeCollider(this.playerCollider);
            this.playerCollider = null;
        }
        
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

            // Only add collider if we're not transitioning and have a valid player
            if (this.player && !this.isTransitioning && newLayer.tilemap) {
                this.playerCollider = this.physics.add.collider(
                    this.player.getSprite(),
                    newLayer
                );
            }

            // Add collision for NPCs
            if (this.npcManager) {
                this.npcManager.setCollisionLayer(newLayer);
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
        
        // Remove all colliders first
        if (this.playerCollider) {
            this.physics.world.removeCollider(this.playerCollider);
            this.playerCollider = null;
        }
        
        // Clear collision layer
        this.setCollisionLayer(null);
        
        // Clear all other players' sprites and physics bodies
        this.otherPlayers.forEach(sprite => sprite.destroy());
        this.otherPlayers.clear();
        this.otherPlayersPhysics.forEach(sprite => sprite.destroy());
        this.otherPlayersPhysics.clear();
    }

    public endMapTransition(): void {
        // Make sure we have both player and collision layer before creating collider
        if (this.player && this.collisionLayer && this.collisionLayer.tilemap) {
            try {
                this.playerCollider = this.physics.add.collider(
                    this.player.getSprite(),
                    this.collisionLayer
                );
            } catch (error) {
                console.error("Failed to create player collider:", error);
            }
        }
        
        this.isTransitioning = false;
        // Send updated position to network after transition
        this.networkManager.updatePlayerState(this.player);
    }

    public getOtherPlayersData(): Array<{id: string, x: number, y: number, animation: string}> {
        const data: Array<{id: string, x: number, y: number, animation: string}> = [];
        this.otherPlayers.forEach((sprite, id) => {
            data.push({
                id,
                x: sprite.x,
                y: sprite.y,
                animation: sprite.anims.currentAnim?.key || 'idle-down'
            });
        });
        return data;
    }

    public restoreOtherPlayers(
        playersData: Array<{id: string, x: number, y: number, animation: string}>,
        transitionDirection: string
    ): void {
        // Clear existing sprites first
        this.otherPlayers.forEach(sprite => sprite.destroy());
        this.otherPlayers.clear();
        
        // Also clear physics sprites
        this.otherPlayersPhysics.forEach(sprite => sprite.destroy());
        this.otherPlayersPhysics.clear();

        const mapWidth = this.mapManager.getMapWidth();
        const mapHeight = this.mapManager.getMapHeight();

        playersData.forEach(playerData => {
            let newX = playerData.x;
            let newY = playerData.y;

            // Adjust positions based on transition direction
            switch (transitionDirection) {
                case 'east':
                    newX = playerData.x - mapWidth;
                    break;
                case 'west':
                    newX = playerData.x + mapWidth;
                    break;
                case 'south':
                    newY = playerData.y - mapHeight;
                    break;
                case 'north':
                    newY = playerData.y + mapHeight;
                    break;
            }

            // Create visible sprite
            const sprite = this.add.sprite(newX, newY, 'player');
            sprite.setScale(0.5);
            this.otherPlayers.set(playerData.id, sprite);
            sprite.play(playerData.animation);
            sprite.setDepth(20);

            // Create physics sprite (invisible)
            const physicsSprite = this.physics.add.sprite(newX, newY, 'player');
            physicsSprite.setVisible(false);
            physicsSprite.setScale(0.5);
            physicsSprite.setImmovable(true);
            physicsSprite.body.setSize(32, 32);
            this.otherPlayersPhysics.set(playerData.id, physicsSprite);

            // Add collision with the main player
            this.physics.add.collider(this.player.getSprite(), physicsSprite);
        });
    }

    public restoreNPCs(mapPosition: { x: number, y: number }): void {
        if (mapPosition.x === 0 && mapPosition.y === 0) {
            this.networkManager.requestNPCStates(mapPosition);
            console.log('[GameScene] Requested NPC states for map', mapPosition);
        }
    }

    public setupNetworkHandlers(): void {
        this.networkManager.on('game-state', (data) => {
            console.log('Received game-state:', data);
            // First game state received - set our player's ID but keep our position
            if (!this.player.getId() && data.players.length > 0) {
                const myPlayer = data.players[data.players.length - 1];
                this.player.setId(myPlayer.id);
                this.networkManager.updatePlayerState(this.player);
            }

            // Process all players - let handlePlayerUpdate handle map filtering
            data.players.forEach((playerData: any) => {
                if (playerData.id && playerData.id !== this.player.getId()) {
                    this.handlePlayerUpdate(playerData, 'game-state');
                }
            });
        });

        this.networkManager.on('player-update', (data) => {
            
            if (!data.player.id || data.player.id === this.player.getId()) {
                console.log('[NetworkHandler] Ignoring update for self');
                return;
            }
            
            // Only handle updates for players in our current map
            const currentMapData = this.mapManager.getCurrentMap();
            if (!currentMapData) return;

            const [_, currentX, currentY] = currentMapData.key.match(/map_(-?\d+)_(-?\d+)/) || [];
            const currentMap = { 
                x: parseInt(currentX), 
                y: parseInt(currentY) 
            };

            if (data.player.mapPosition.x === currentMap.x && 
                data.player.mapPosition.y === currentMap.y) {
                this.handlePlayerUpdate(data.player, 'player-update');
            }
        });

        this.networkManager.on('player-map-changed', (data) => {
            if (data.player) {
                this.handlePlayerUpdate(data.player, 'player-map-changed');
            }
        });

        this.networkManager.on('player-left', (data) => {
            const existingSprite = this.otherPlayers.get(data.playerId);
            const existingPhysicsSprite = this.otherPlayersPhysics.get(data.playerId);
            
            if (existingSprite) {
                existingSprite.destroy();
                this.otherPlayers.delete(data.playerId);
            }
            if (existingPhysicsSprite) {
                existingPhysicsSprite.destroy();
                this.otherPlayersPhysics.delete(data.playerId);
            }
        });

        this.networkManager.on('player-left-map', (data) => {
            const existingSprite = this.otherPlayers.get(data.playerId);
            const existingPhysicsSprite = this.otherPlayersPhysics.get(data.playerId);
            
            if (existingSprite) {
                existingSprite.destroy();
                this.otherPlayers.delete(data.playerId);
            }
            if (existingPhysicsSprite) {
                existingPhysicsSprite.destroy();
                this.otherPlayersPhysics.delete(data.playerId);
            }
        });

        this.networkManager.on('initial-npc-states', (data) => {
            data.npcs.forEach((npcData: NPCState) => {
                if (!this.npcManager.getNPC(npcData.id)) {
                    const npcConfig = {
                        id: npcData.id,
                        name: npcData.name,
                        personalityType: npcData.personalityType,
                        x: npcData.x,
                        y: npcData.y,
                        texture: npcData.texture,
                        scale: npcData.scale,
                        interactionRadius: npcData.interactionRadius,
                        mapCoordinates: npcData.mapCoordinates
                    };
                    this.npcManager.createNPC(npcConfig);
                }
            });
        });

        this.networkManager.on('npc-update', (data) => {
            const npc = this.npcManager.getNPC(data.npc.id);
            if (npc) {
                npc.updateFromNetwork(data.npc);
            }
        });

        this.networkManager.on('npc-states', (message: any) => {
            console.log('[GameScene] Received NPC states:', message);
            // Assuming message.npcs is an array of NPC configurations
            if (message && message.npcs && Array.isArray(message.npcs)) {
                message.npcs.forEach((npcConfig: any) => {
                    if (!this.npcManager.getNPC(npcConfig.id)) {
                        this.npcManager.createNPC(npcConfig);
                        console.log(`[GameScene] Created NPC: ${npcConfig.id}`);
                    } else {
                        this.npcManager.updateNPC(npcConfig);
                        console.log(`[GameScene] Updated NPC: ${npcConfig.id}`);
                    }
                });
            }
        });
    }

    public getPlayer(): Player {
        return this.player;
    }

    public getNetworkManager(): NetworkManager {
        return this.networkManager;
    }

    public getColliders(): Phaser.Physics.Arcade.Collider[] {
        return this.colliders;
    }

    public getNPCManager(): NPCManager {
        return this.npcManager;
    }

    private initializeNPCManager(): void {
        this.npcManager = new NPCManager(this);
    }

    private handlePlayerUpdate(playerData: any, source: string): void {
        // Guard against invalid player data
        if (!playerData.id) {
            console.warn('[HandlePlayerUpdate] Received player update with empty ID, ignoring');
            return;
        }

        // Get current map position
        const currentMapData = this.mapManager.getCurrentMap();
        if (!currentMapData) {
            console.warn('[HandlePlayerUpdate] No current map data available');
            return;
        }

        // Extract current map coordinates
        const [_, currentX, currentY] = currentMapData.key.match(/map_(-?\d+)_(-?\d+)/) || [];
        const currentMap = { 
            x: parseInt(currentX), 
            y: parseInt(currentY) 
        };
        
        // If player is in a different map, remove their sprite
        if (!playerData.mapPosition || 
            playerData.mapPosition.x !== currentMap.x || 
            playerData.mapPosition.y !== currentMap.y) {
            console.log('[HandlePlayerUpdate] Removing player from different map:', {
                playerId: playerData.id,
                playerMap: playerData.mapPosition,
                currentMap: currentMap
            });
            const existingSprite = this.otherPlayers.get(playerData.id);
            const existingPhysicsSprite = this.otherPlayersPhysics.get(playerData.id);
            
            if (existingSprite) {
                existingSprite.destroy();
                this.otherPlayers.delete(playerData.id);
            }
            if (existingPhysicsSprite) {
                existingPhysicsSprite.destroy();
                this.otherPlayersPhysics.delete(playerData.id);
            }
            return;
        }

        // Normalize the player data structure
        const normalizedData = {
            id: playerData.id,
            x: playerData.x ?? playerData.position?.x ?? 100,
            y: playerData.y ?? playerData.position?.y ?? 100,
            animation: playerData.animation ?? 'idle-down'
        };

        let existingSprite = this.otherPlayers.get(normalizedData.id);
        let existingPhysicsSprite = this.otherPlayersPhysics.get(normalizedData.id);

        if (existingSprite && existingPhysicsSprite) {
            existingSprite.setPosition(normalizedData.x, normalizedData.y);
            existingPhysicsSprite.setPosition(normalizedData.x, normalizedData.y);
            if (normalizedData.animation && existingSprite.anims.currentAnim?.key !== normalizedData.animation) {
                existingSprite.play(normalizedData.animation, true);
            }
        } else {
            // Create visible sprite
            const sprite = this.add.sprite(normalizedData.x, normalizedData.y, 'player');
            sprite.setScale(0.5);
            this.ensureAnimationsExist();
            this.otherPlayers.set(normalizedData.id, sprite);
            sprite.play(normalizedData.animation);
            sprite.setDepth(20);

            // Create physics sprite (invisible)
            const physicsSprite = this.physics.add.sprite(normalizedData.x, normalizedData.y, 'player');
            physicsSprite.setVisible(false);
            physicsSprite.setScale(0.5);
            physicsSprite.setImmovable(true);
            physicsSprite.body.setSize(32, 32); // Adjust collision box size as needed
            this.otherPlayersPhysics.set(normalizedData.id, physicsSprite);

            // Add collision with the main player
            this.physics.add.collider(this.player.getSprite(), physicsSprite);
        }
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

    private createNPCAnimations(): void {
        if (!this.anims.exists('npc_1_idle_down')) {
            this.anims.create({
                key: 'npc_1_idle_up',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 0 * 24, // Row 0 (idle up)
                    end: 0 * 24 + (2 - 1),
                }),
                frameRate: 0.5,
                repeat: -1,
                yoyo: true
            });

            this.anims.create({
                key: 'npc_1_idle_left',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 1 * 24, // Row 1 (idle left)
                    end: 1 * 24 + (2 - 1),
                }),
                frameRate: 0.5,
                repeat: -1,
                yoyo: true
            });
            this.anims.create({
                key: 'npc_1_idle_down',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 2 * 24, // Row 2 (idle down)
                    end: 2 * 24 + (2 - 1),
                }),
                frameRate: 0.5,
                repeat: -1,
                yoyo: true
            });


            this.anims.create({
                key: 'npc_1_idle_right',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 3 * 24, // Row 3 (idle right)
                    end: 3 * 24 + (2 - 1),
                }),
                frameRate: 0.5,
                repeat: -1,
                yoyo: true
            });

            // Walking animations
            // Down
            this.anims.create({
                key: 'npc_1_walk_down',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 10 * 24, // Row 10 (walk down)
                    end: 10 * 24 + (9 - 1)
                }),
                frameRate: 8,
                repeat: -1  // Set to -1 for continuous walking animation
            });

            // Up
            this.anims.create({
                key: 'npc_1_walk_up',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 8 * 24, // Row 8 (walk up)
                    end: 8 * 24 + (9 - 1)
                }),
                frameRate: 8,
                repeat: -1
            });

            // Left
            this.anims.create({
                key: 'npc_1_walk_left',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 9 * 24, // Row 9 (walk left)
                    end: 9 * 24 + (9 - 1)
                }),
                frameRate: 8,
                repeat: -1
            });

            // Right
            this.anims.create({
                key: 'npc_1_walk_right',
                frames: this.anims.generateFrameNumbers('npc_1', { 
                    start: 11 * 24, // Row 11 (walk right)
                    end: 11 * 24 + (9 - 1)
                }),
                frameRate: 8,
                repeat: -1
            });
        }
    }

    update(time: number, delta: number): void {
        if (!this.player || !this.cursors || this.isTransitioning) return;

        const movement = this.getMovementInput();
        const isAttackTriggered = this.attackKey.isDown || this.virtualAttackTriggered;

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

        // Only send updates when there are actual changes
        if (movement.x !== 0 || movement.y !== 0 || isAttackTriggered) {
            this.networkManager.updatePlayerState(this.player);
        }

        // Debug: Log NPC position
        if (this.npcManager) {  // Add null check
            const npc = this.npcManager.getNPC('merchant');
            if (npc) {
                const sprite = npc.getSprite();
                if (sprite.x === 0 || sprite.y === 0) {
                    console.warn('NPC at origin point!');
                }
            }
        } else {
            console.error('NPCManager is not initialized!');
        }

        // Only update NPCManager if it exists
        if (this.npcManager) {
            this.npcManager.update();
        }

        // Check for NPC interactions only when player moves or presses interact key
        if (movement.x !== 0 || movement.y !== 0 || Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            if (this.npcManager) {
                const npcsInRange = this.npcManager.getNPCsInRange();
                // Only handle interaction if the interact key was pressed
                if (this.interactKey?.isDown && npcsInRange.length > 0) {
                    const npc = npcsInRange[0];
                    npc.setState('talking');
                    console.log('Interacting with NPC:', npc);
                    // Add this line to properly trigger the interaction
                    this.handleNPCInteraction(npc);
                }
            }
        }
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

    private isSameMap(otherMapPosition: { x: number, y: number }): boolean {
        const currentMapData = this.mapManager.getCurrentMap();
        if (!currentMapData) return false;
        
        const [_, x, y] = currentMapData.key.match(/map_(-?\d+)_(-?\d+)/) || [];
        return parseInt(x) === otherMapPosition.x && parseInt(y) === otherMapPosition.y;
    }

    public handleNPCInteraction(npc: NPC): void {
        console.log('[GameScene] handleNPCInteraction called with NPC config:', npc.config);
        
        // Start the interaction and emit the event
        npc.startInteraction();
        
        const context = {
            timeOfDay: 'day', // For now, hardcode or implement getTimeOfDay() if needed
            weather: 'clear', // For now, hardcode or implement getCurrentWeather() if needed
            playerLevel: this.player?.level || 1,
            location: 'village', // For now, hardcode or implement getCurrentLocation() if needed
            activeQuests: [] // Empty array for now
        };

        const eventData = {
            npcId: npc.config.id,
            npcName: npc.config.name,
            personalityType: npc.config.personalityType,
            context
        };

        console.log('[GameScene] Emitting npcInteraction event with data:', eventData);
        this.events.emit("npcInteraction", eventData);
    }

    private getTimeOfDay(): string {
        // Implement based on your game's time system
        return "morning";
    }

    private getCurrentWeather(): string {
        // Implement based on your weather system
        return "clear";
    }

    private getCurrentLocation(): string {
        // Implement based on your map system
        return "village_square";
    }
}
