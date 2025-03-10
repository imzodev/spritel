import Phaser from "phaser";
import { MapData, MapCoordinate, AdjacentMaps } from "../types/GameTypes";
import GameScene from "../scenes/GameScene";

export class MapManager {
    private scene: Phaser.Scene;
    private currentMap: MapData | null;
    private currentPosition: MapCoordinate;
    private readonly mapDimensions: { width: number; height: number };
    private readonly tileSize: number;
    private readonly transitionThreshold: number;
    private loadedMaps: Set<string>;

    constructor(
        scene: Phaser.Scene,
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
        if (this.isMapLoaded(x, y)) return;

        try {
            await this.loadMapAssets(mapKey);
            this.currentMap = this.scene.cache.json.get(mapKey);
            this.currentPosition = { x, y };
            this.loadedMaps.add(mapKey);
            this.createMap();
        } catch (error) {
            console.error(`Failed to load map ${mapKey}:`, error);
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

    private getMapKey(x: number, y: number): string {
        return `map_${x}_${y}`;
    }

    private isMapLoaded(x: number, y: number): boolean {
        return this.loadedMaps.has(this.getMapKey(x, y));
    }

    public getAdjacentMaps(): AdjacentMaps {
        const { x, y } = this.currentPosition;
        return {
            north: this.getMapAt(x, y - 1),
            south: this.getMapAt(x, y + 1),
            east: this.getMapAt(x + 1, y),
            west: this.getMapAt(x - 1, y),
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

        const layers = {
            ground: map.createLayer("Ground", tileset, 0, 0),
            decoration: map.createLayer("Decoration", tileset, 0, 0),
            collision: map.createLayer("Collision", tileset, 0, 0),
        };

        this.scene.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        const gameScene = this.scene as GameScene;
        if (gameScene.setCollisionLayer && layers.collision) {
            gameScene.setCollisionLayer(layers.collision);
        }
    }

    public checkMapTransition(player: Phaser.Physics.Arcade.Sprite): void {
        if (!this.currentMap) return;

        const mapWidth = this.currentMap.width * this.currentMap.tilewidth;
        const mapHeight = this.currentMap.height * this.currentMap.tileheight;

        if (player.x <= this.transitionThreshold) {
            console.log("Triggering WEST transition");
            this.handleTransition("west", player);
        } else if (player.x >= mapWidth - this.transitionThreshold) {
            console.log("Triggering EAST transition");
            this.handleTransition("east", player);
        } else if (player.y <= this.transitionThreshold) {
            console.log("Triggering NORTH transition");
            this.handleTransition("north", player);
        } else if (player.y >= mapHeight - this.transitionThreshold) {
            console.log("Triggering SOUTH transition");
            this.handleTransition("south", player);
        }
    }

    private handleTransition(
        direction: "north" | "south" | "east" | "west",
        player: Phaser.Physics.Arcade.Sprite
    ): void {
        const newPosition = { ...this.currentPosition };
        let newPlayerPosition = { x: player.x, y: player.y };

        switch (direction) {
            case "north":
                newPosition.y--;
                newPlayerPosition.y =
                    (this.mapDimensions.height - 1) * this.tileSize;
                break;
            case "south":
                newPosition.y++;
                newPlayerPosition.y = this.tileSize;
                break;
            case "east":
                newPosition.x++;
                newPlayerPosition.x = this.tileSize;
                break;
            case "west":
                newPosition.x--;
                newPlayerPosition.x =
                    (this.mapDimensions.width - 1) * this.tileSize;
                break;
        }

        this.loadMap(newPosition.x, newPosition.y);
        player.setPosition(newPlayerPosition.x, newPlayerPosition.y);
    }

    public getCurrentMap(): { key: string; data: MapData } | null {
        if (!this.currentMap) return null;
        return {
            key: this.getMapKey(this.currentPosition.x, this.currentPosition.y),
            data: this.currentMap,
        };
    }
}
