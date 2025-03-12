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
    private currentLayers: { [key: string]: Phaser.Tilemaps.TilemapLayer | null } = {};
    private isTransitioning: boolean = false;

    private static readonly AVAILABLE_MAPS: Set<string> = new Set([
        'map_0_0',   // Starting map
        'map_0_1',   // South
        'map_0_-1',  // North
        'map_1_0',   // East
        'map_-1_0',  // West
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
        } catch (error) {
            console.error(`Failed to load map ${mapKey}:`, error);
            throw error; // Propagate the error to handle it in the transition
        }
    }

    private async loadMapAssets(mapKey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.scene.load.json(mapKey, `/assets/maps/${mapKey}.json`);
            this.scene.load.tilemapTiledJSON(
                mapKey,
                `/assets/maps/${mapKey}.json`
            );

            this.scene.load.once("complete", resolve);
            this.scene.load.once("loaderror", reject);
            this.scene.load.start();
        });
    }

    private destroyCurrentMap(): void {
        try {
            // Destroy all current layers
            Object.values(this.currentLayers).forEach(layer => {
                if (layer) {
                    layer.destroy();
                }
            });
            this.currentLayers = {};

            // Destroy the current tilemap
            const tilemap = this.scene.make.tilemap({ key: this.getMapKey(this.currentPosition.x, this.currentPosition.y) });
            if (tilemap) {
                tilemap.destroy();
            }
        } catch (error) {
            console.error('Error destroying current map:', error);
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

    private getMapAt(x: number, y: number): MapCoordinate | null {
        return this.isMapLoaded(x, y) ? { x, y } : null;
    }

    private createMap(): void {
        if (!this.currentMap) return;

        const mapKey = this.getMapKey(
            this.currentPosition.x,
            this.currentPosition.y
        );
        const map = this.scene.make.tilemap({ key: mapKey });
        const tileset = map.addTilesetImage("beginnertileset", "tiles");

        if (!tileset) {
            console.error("Failed to add tileset");
            return;
        }

        this.currentLayers = {
            ground: map.createLayer("Ground", tileset, 0, 0),
            decoration: map.createLayer("Decoration", tileset, 0, 0),
            collision: map.createLayer("Collision", tileset, 0, 0)
        };

        this.scene.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        const gameScene = this.scene as GameScene;
        if (gameScene.setCollisionLayer && this.currentLayers.collision) {
            gameScene.setCollisionLayer(this.currentLayers.collision);
        }
    }

    public checkMapTransition(player: Phaser.Physics.Arcade.Sprite): void {
        if (!this.currentMap || this.isTransitioning) return;

        const mapWidth = this.mapDimensions.width * this.tileSize;
        const mapHeight = this.mapDimensions.height * this.tileSize;

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
        
        const newPosition = { ...this.currentPosition };
        
        // Calculate new position first
        switch (direction) {
            case "north":
                newPosition.y--;
                break;
            case "south":
                newPosition.y++;
                break;
            case "east":
                newPosition.x++;
                break;
            case "west":
                newPosition.x--;
                break;
        }

        // Check if the target map exists before proceeding
        if (!this.isMapAvailable(newPosition.x, newPosition.y)) {
            // Prevent player from moving further in that direction
            this.bouncePlayer(player, direction);
            return;
        }
        
        try {
            this.isTransitioning = true;
            player.setImmovable(true);
            
            const newPlayerPosition = { x: player.x, y: player.y };

            // Set player position on new map
            switch (direction) {
                case "north":
                    newPlayerPosition.y = (this.mapDimensions.height - 1) * this.tileSize;
                    break;
                case "south":
                    newPlayerPosition.y = this.tileSize;
                    break;
                case "east":
                    newPlayerPosition.x = this.tileSize;
                    break;
                case "west":
                    newPlayerPosition.x = (this.mapDimensions.width - 1) * this.tileSize;
                    break;
            }

            // Store the final position before loading
            const finalPosition = { ...newPlayerPosition };

            // Load the new map
            await this.loadMap(newPosition.x, newPosition.y);
            
            // Update player position
            player.setPosition(finalPosition.x, finalPosition.y);
            
        } catch (error) {
            console.error('Map transition failed:', error);
        } finally {
            player.setImmovable(false);
            this.isTransitioning = false;
        }
    }

    private bouncePlayer(player: Phaser.Physics.Arcade.Sprite, direction: string): void {
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
}
