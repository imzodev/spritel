import Phaser from "phaser";
import { MapData, MapCoordinate, AdjacentMaps } from "../types/GameTypes";
import GameScene from "../scenes/GameScene";

export class MapManager {
    private scene: GameScene;
    private currentMap: MapData | null;
    private currentPosition: MapCoordinate;
    private readonly mapDimensions: { width: number; height: number };
    private readonly tileSize: number;
    private readonly transitionThreshold: number;
    private loadedMaps: Set<string>;
    private currentLayers: {
        [key: string]: Phaser.Tilemaps.TilemapLayer | null;
    } = {};
    private isTransitioning: boolean = false;

    private static readonly AVAILABLE_MAPS: Set<string> = new Set([
        "map_0_0", // Starting map
        "map_0_1", // South
        "map_0_-1", // North
        "map_1_0", // East
        "map_-1_0", // West
        "map_-1_-1", // South-West
        "map_1_-1", // South-East
        "map_-1_1", // North-West
        "map_1_1", // North-East
        "map_0_2",
        "map_-1_2",
        "map_1_2",
    ]);

    constructor(
        scene: GameScene,
        config: {
            mapWidth: number;
            mapHeight: number;
            tileSize: number;
            transitionThreshold: number;
        }
    ) {
        this.scene = scene;
        this.currentMap = null;
        this.currentPosition = { x: 0, y: 0 };
        this.mapDimensions = {
            width: config.mapWidth,
            height: config.mapHeight,
        };
        this.tileSize = config.tileSize;
        this.transitionThreshold = config.transitionThreshold;
        this.loadedMaps = new Set();
    }

    public async loadMap(x: number, y: number): Promise<void> {
        const mapKey = this.getMapKey(x, y);

        try {
            // Always destroy the current map before loading a new one
            this.destroyCurrentMap();

            // Clear the cache for this map to ensure fresh load
            this.scene.cache.tilemap.remove(mapKey);

            await this.loadMapAssets(mapKey);

            // Verify the map was loaded
            if (!this.scene.cache.tilemap.exists(mapKey)) {
                throw new Error(`Failed to load tilemap: ${mapKey}`);
            }

            this.currentMap = this.scene.cache.json.get(mapKey);
            this.currentPosition = { x, y };
            this.loadedMaps.add(mapKey);
            this.createMap();

            // Preload adjacent maps after current map is loaded
            await this.preloadAdjacentMaps();
        } catch (error) {
            console.error(`Failed to load map ${mapKey}:`, error);
            throw error;
        }
    }

    private async loadMapAssets(mapKey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(
                `[MapManager] Starting to load map assets for: ${mapKey}`
            );

            // Log the URL being used
            const mapUrl = `/assets/maps/${mapKey}.json`;
            console.log(`[MapManager] Loading from URL: ${mapUrl}`);

            this.scene.load.json(mapKey, mapUrl);
            this.scene.load.tilemapTiledJSON(mapKey, mapUrl);

            this.scene.load.once("complete", () => {
                // Verify the loaded data
                const jsonData = this.scene.cache.json.get(mapKey);
                console.log(`[MapManager] Loaded JSON data:`, jsonData);

                const tilemapData = this.scene.cache.tilemap.get(mapKey);
                console.log(`[MapManager] Loaded tilemap data:`, tilemapData);

                resolve();
            });

            this.scene.load.once("loaderror", (fileObj: any) => {
                console.error(
                    `[MapManager] Failed to load map asset:`,
                    fileObj
                );
                reject(new Error(`Failed to load map asset: ${mapKey}`));
            });

            this.scene.load.start();
        });
    }

    private destroyCurrentMap(): void {
        // Clear collision layer first
        const gameScene = this.scene as GameScene;
        
        // Clear NPCs before destroying the map
        const npcManager = gameScene.getNPCManager();
        if (npcManager && typeof npcManager.clearAllNPCs === 'function') {
            npcManager.clearAllNPCs();
        } else {
            console.warn('[MapManager] NPCManager not properly initialized');
        }
        
        gameScene.setCollisionLayer(null);

        // Destroy all colliders first
        if (gameScene.getColliders()) {
            gameScene.getColliders().forEach(collider => {
                if (collider) collider.destroy();
            });
        }

        // Then destroy the layers
        Object.values(this.currentLayers).forEach((layer) => {
            if (layer) {
                layer.setCollisionByProperty({ collides: true }, false); // Disable collisions
                layer.destroy();
            }
        });
        this.currentLayers = {};

        // Finally destroy the tilemap
        const mapKey = this.getMapKey(
            this.currentPosition.x,
            this.currentPosition.y
        );
        const tilemap = this.scene.make.tilemap({ key: mapKey });
        if (tilemap) {
            tilemap.destroy();
        }
    }

    private getMapKey(x: number, y: number): string {
        return `map_${x}_${y}`;
    }

    private isMapLoaded(x: number, y: number): boolean {
        return this.loadedMaps.has(this.getMapKey(x, y));
    }

    private isMapAvailable(x: number, y: number): boolean {
        return MapManager.AVAILABLE_MAPS.has(this.getMapKey(x, y));
    }

    public getAdjacentMaps(): AdjacentMaps {
        const { x, y } = this.currentPosition;
        return {
            north: this.isMapAvailable(x, y - 1) ? { x, y: y - 1 } : null,
            south: this.isMapAvailable(x, y + 1) ? { x, y: y + 1 } : null,
            east: this.isMapAvailable(x + 1, y) ? { x: x + 1, y } : null,
            west: this.isMapAvailable(x - 1, y) ? { x: x - 1, y } : null,
        };
    }

    private async createMap(): Promise<void> {
        const mapKey = this.getMapKey(this.currentPosition.x, this.currentPosition.y);
        console.log("Creating new map:", mapKey);

        const map = this.scene.make.tilemap({ key: mapKey });
        const tilesets: Phaser.Tilemaps.Tileset[] = [];

        // Get the tileset data from the map
        const mapData = this.scene.cache.json.get(mapKey);
        if (!mapData || !mapData.tilesets) {
            console.error("No tileset data found in map");
            return;
        }

        // Sort tilesets by firstgid to ensure correct ordering
        const sortedTilesets = [...mapData.tilesets].sort((a, b) => a.firstgid - b.firstgid);

        // Add each tileset in order
        for (const tilesetData of sortedTilesets) {
            const tilesetName = tilesetData.name;
            console.log(`Adding tileset: ${tilesetName} with firstgid: ${tilesetData.firstgid}`);
            
            const addedTileset = map.addTilesetImage(tilesetName, tilesetName);
            if (addedTileset) {
                tilesets.push(addedTileset);
                console.log(`Successfully added tileset: ${tilesetName}`);
            } else {
                console.error(`Failed to add tileset: ${tilesetName}`);
            }
        }

        if (tilesets.length === 0) {
            console.error("No tilesets were successfully added");
            return;
        }

        console.log("Creating map layers with tilesets:", tilesets);
        this.currentLayers = {
            collision: map.createLayer("Collision", tilesets, 0, 0),
            ground: map.createLayer("Ground", tilesets, 0, 0),
            groundUpper: map.createLayer("GroundUpper", tilesets, 0, 0),
            decorationUpper2: map.createLayer("DecorationUpper2", tilesets, 0, 0),
            decorationUpper1: map.createLayer("DecorationUpper1", tilesets, 0, 0),
            decorationUpper: map.createLayer("DecorationUpper", tilesets, 0, 0),
            decorationUpperShadow: map.createLayer("DecorationUpperShadow", tilesets, 0, 0),
            decorationMiddle2: map.createLayer("DecorationMiddle2", tilesets, 0, 0),
            decorationMiddle1: map.createLayer("DecorationMiddle1", tilesets, 0, 0),
            decorationMiddle: map.createLayer("DecorationMiddle", tilesets, 0, 0),
            decorationLowerShadow: map.createLayer("DecorationLowerShadow", tilesets, 0, 0),
            decorationLower: map.createLayer("DecorationLower", tilesets, 0, 0),
        };

        // Set proper depth for layers
        if (this.currentLayers.ground) {
            this.currentLayers.ground.setDepth(0);
        }
        if (this.currentLayers.groundUpper) {
            this.currentLayers.groundUpper.setDepth(1);
        }
        if (this.currentLayers.decorationLowerShadow) {
            this.currentLayers.decorationLowerShadow.setDepth(9);
        }
        if (this.currentLayers.decorationLower) {
            this.currentLayers.decorationLower.setDepth(10);
        }
        if (this.currentLayers.decorationMiddle) {
            this.currentLayers.decorationMiddle.setDepth(20);
        }
        if (this.currentLayers.decorationMiddle1) {
            this.currentLayers.decorationMiddle1.setDepth(21);
        }
        if (this.currentLayers.decorationMiddle2) {
            this.currentLayers.decorationMiddle2.setDepth(22);
        }
        if (this.currentLayers.decorationUpperShadow) {
            this.currentLayers.decorationUpperShadow.setDepth(29);
        }
        if (this.currentLayers.decorationUpper) {
            this.currentLayers.decorationUpper.setDepth(30);
        }
        if (this.currentLayers.decorationUpper1) {
            this.currentLayers.decorationUpper1.setDepth(31);
        }
        if (this.currentLayers.decorationUpper2) {
            this.currentLayers.decorationUpper2.setDepth(32);
        }
        if (this.currentLayers.collision) {
            this.currentLayers.collision.setDepth(5); // Keep collision layer below everything
        }

        console.log("Layers created:", {
            ground: !!this.currentLayers.ground,
            decorationLower: !!this.currentLayers.decorationLower,
            decorationUpper: !!this.currentLayers.decorationUpper,
            collision: !!this.currentLayers.collision,
        });

        if (this.currentLayers.collision) {
            console.log("Setting up collision layer...");
            const gameScene = this.scene as GameScene;
            gameScene.setCollisionLayer(this.currentLayers.collision);
            console.log("Collision layer set up complete");
        }

        this.scene.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );
    }

    public checkMapTransition(player: Phaser.Physics.Arcade.Sprite): void {
        if (!this.currentMap || this.isTransitioning) return;

        const mapWidth = this.mapDimensions.width * this.tileSize;
        const mapHeight = this.mapDimensions.height * this.tileSize;
        // console.log("Player position:", player.x, player.y, " Map Height: ", mapHeight);

        if (player.x <= this.transitionThreshold) {
            this.handleTransition("west", player);
        } else if (player.x >= mapWidth - this.transitionThreshold) {
            this.handleTransition("east", player);
        } else if (player.y <= this.transitionThreshold) {
            this.handleTransition("north", player);
        } else if (player.y >= mapHeight - this.transitionThreshold) {
            this.handleTransition("south", player);
        }
    }

    private async handleTransition(
        direction: "north" | "south" | "east" | "west",
        player: Phaser.Physics.Arcade.Sprite
    ): Promise<void> {
        if (this.isTransitioning) return;

        try {
            this.isTransitioning = true;
            const gameScene = this.scene as GameScene;

            const newPosition = this.calculateNewPosition(direction);
            const newMapKey = this.getMapKey(newPosition.x, newPosition.y);

            // Store other players' positions before transition
            const playersData = gameScene.getOtherPlayersData();

            gameScene.startMapTransition();

            // Calculate new player position before destroying current map
            const newPlayerPos = this.calculatePlayerTransitionPosition(
                player,
                direction
            );

            // Update position before destroying the map
            this.currentPosition = newPosition;

            // Update the player's map position BEFORE creating the new map
            const playerEntity = gameScene.getPlayer();
            if (playerEntity) {
                playerEntity.setMapPosition(newPosition.x, newPosition.y);
                gameScene.getNetworkManager().updatePlayerState(playerEntity);
            }

            // Clear old map after updating positions
            this.destroyCurrentMap();

            // Create new map and wait for it to complete
            await this.createMap();

            // Preload adjacent maps for the new position
            await this.preloadAdjacentMaps();

            // Update player position
            player.setPosition(newPlayerPos.x, newPlayerPos.y);

            // Restore other players in their relative positions
            gameScene.restoreOtherPlayers(playersData, direction);
            
            // Request fresh NPC states from server
            gameScene.getNetworkManager().requestNPCStates(newPosition);
        } catch (error) {
            console.error("[MapManager] Map transition failed:", error);
            this.bouncePlayer(player, direction);
        } finally {
            this.isTransitioning = false;
            const gameScene = this.scene as GameScene;
            gameScene.endMapTransition();
        }
    }

    private bouncePlayer(
        player: Phaser.Physics.Arcade.Sprite,
        direction: string
    ): void {
        const bounceDistance = 10;
        const bounceSpeed = 100;

        switch (direction) {
            case "north":
                player.setVelocityY(bounceSpeed);
                player.y += bounceDistance;
                break;
            case "south":
                player.setVelocityY(-bounceSpeed);
                player.y -= bounceDistance;
                break;
            case "east":
                player.setVelocityX(-bounceSpeed);
                player.x -= bounceDistance;
                break;
            case "west":
                player.setVelocityX(bounceSpeed);
                player.x += bounceDistance;
                break;
        }

        // Reset velocity after a short delay
        setTimeout(() => {
            player.setVelocity(0, 0);
        }, 100);
    }

    public getCurrentMap(): { key: string; data: MapData } | null {
        if (!this.currentMap) return null;
        return {
            key: this.getMapKey(this.currentPosition.x, this.currentPosition.y),
            data: this.currentMap,
        };
    }

    private async preloadAdjacentMaps(): Promise<void> {
        const adjacentMaps = this.getAdjacentMaps();
        const preloadPromises: Promise<void>[] = [];

        // Helper function to preload a single map
        const preloadMap = async (coord: MapCoordinate | null) => {
            if (coord && !this.isMapLoaded(coord.x, coord.y)) {
                const mapKey = this.getMapKey(coord.x, coord.y);
                try {
                    await new Promise<void>((resolve, reject) => {
                        this.scene.load.json(
                            mapKey,
                            `/assets/maps/${mapKey}.json`
                        );
                        this.scene.load.tilemapTiledJSON(
                            mapKey,
                            `/assets/maps/${mapKey}.json`
                        );

                        this.scene.load.once("complete", () => resolve());
                        this.scene.load.once("loaderror", reject);
                        this.scene.load.start();
                    });
                    this.loadedMaps.add(mapKey);
                } catch (error) {
                    console.error(`Failed to preload map ${mapKey}:`, error);
                }
            }
        };

        // Preload all adjacent maps
        if (adjacentMaps.north)
            preloadPromises.push(preloadMap(adjacentMaps.north));
        if (adjacentMaps.south)
            preloadPromises.push(preloadMap(adjacentMaps.south));
        if (adjacentMaps.east)
            preloadPromises.push(preloadMap(adjacentMaps.east));
        if (adjacentMaps.west)
            preloadPromises.push(preloadMap(adjacentMaps.west));

        await Promise.all(preloadPromises);
    }

    private calculateNewPosition(direction: string): MapCoordinate {
        const newPosition = { ...this.currentPosition };

        switch (direction) {
            case "north":
                newPosition.y++;
                break;
            case "south":
                newPosition.y--;
                break;
            case "east":
                newPosition.x++;
                break;
            case "west":
                newPosition.x--;
                break;
        }

        return newPosition;
    }

    private calculatePlayerTransitionPosition(
        player: Phaser.Physics.Arcade.Sprite,
        direction: string
    ): { x: number; y: number } {
        const mapWidth = this.mapDimensions.width * this.tileSize;
        const mapHeight = this.mapDimensions.height * this.tileSize;

        switch (direction) {
            case "north":
                return { x: player.x, y: mapHeight - this.tileSize * 2 };
            case "south":
                return { x: player.x, y: this.tileSize * 2 };
            case "east":
                return { x: this.tileSize * 2, y: player.y };
            case "west":
                return { x: mapWidth - this.tileSize * 2, y: player.y };
            default:
                return { x: player.x, y: player.y };
        }
    }

    public getMapWidth(): number {
        return this.mapDimensions.width * this.tileSize;
    }

    public getMapHeight(): number {
        return this.mapDimensions.height * this.tileSize;
    }

    public getCurrentPosition(): MapCoordinate {
        return this.currentPosition;
    }
}
