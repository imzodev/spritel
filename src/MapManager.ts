import Phaser from 'phaser';

interface MapData {
  version: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: string;
  renderorder: string;
  tilesets: any[];
  layers: any[];
}

interface MapCoordinate {
  x: number;
  y: number;
}

class MapManager {
  private game: Phaser.Scene;
  private currentMap: MapData | null;
  private currentMapX: number;
  private currentMapY: number;
  public readonly mapWidth: number;
  public readonly mapHeight: number;
  public readonly tileSize: number;
  private mapCoordinates: MapCoordinate[];

  constructor(game: Phaser.Scene) {
    this.game = game;
    this.currentMap = null;
    this.currentMapX = 0;
    this.currentMapY = 0;
    this.mapWidth = 24;
    this.mapHeight = 15;
    this.tileSize = 16;
    this.mapCoordinates = [];
  }

  loadMap(x: number, y: number): void {
  if (this.isMapLoaded(x, y)) return;

  const mapName = `map_${x}_${y}.json`;
  this.game.load.json(mapName, `assets/maps/${mapName}`);
  this.game.load.tilemapTiledJSON(mapName, `assets/maps/${mapName}`); // Use mapName as the key

  this.game.load.once('complete', () => {
    this.currentMap = this.game.cache.json.get(mapName);
    this.currentMapX = x;
    this.currentMapY = y;
    this.mapCoordinates.push({ x, y });
    this.createMap();
  });
  this.game.load.start();
}

  private isMapLoaded(x: number, y: number): boolean {
    return this.mapCoordinates.some(coord => coord.x === x && coord.y === y);
  }

  getAdjacentMaps(): { north: MapCoordinate | null, south: MapCoordinate | null, east: MapCoordinate | null, west: MapCoordinate | null } {
    return {
      north: this.getMapAt(this.currentMapX, this.currentMapY - 1),
      south: this.getMapAt(this.currentMapX, this.currentMapY + 1),
      east: this.getMapAt(this.currentMapX + 1, this.currentMapY),
      west: this.getMapAt(this.currentMapX - 1, this.currentMapY)
    };
  }

  private getMapAt(x: number, y: number): MapCoordinate | null {
    const mapExists = this.mapCoordinates.some(coord => coord.x === x && coord.y === y);
    return mapExists ? {x, y} : null;
  }

  private createMap(): void {
    // Create the map layers and tiles here
  }

  checkMapTransition(player: Phaser.Physics.Arcade.Sprite): void {
    const playerX = player.x / this.tileSize;
    const playerY = player.y / this.tileSize;

    if (playerX < 0) {
      this.transitionToMap('west', player);
    } else if (playerX >= this.mapWidth) {
      this.transitionToMap('east', player);
    }

    if (playerY < 0) {
      this.transitionToMap('north', player);
    } else if (playerY >= this.mapHeight) {
      this.transitionToMap('south', player);
    }
  }

  private transitionToMap(direction: 'north' | 'south' | 'east' | 'west', player: Phaser.Physics.Arcade.Sprite): void {
    let newX = this.currentMapX;
    let newY = this.currentMapY;

    switch (direction) {
      case 'north':
        newY--;
        player.y = (this.mapHeight - 1) * this.tileSize;
        break;
      case 'south':
        newY++;
        player.y = 0;
        break;
      case 'east':
        newX++;
        player.x = 0;
        break;
      case 'west':
        newX--;
        player.x = (this.mapWidth - 1) * this.tileSize;
        break;
    }

    this.loadMap(newX, newY);
  }

  getCurrentMap(): { key: string, data: MapData } {
    if (!this.currentMap) {
      throw new Error('No map loaded');
    }
    return {
      key: `map_${this.currentMapX}_${this.currentMapY}`,
      data: this.currentMap
    };
  }

  getZoomLevel(): number {
    const width = this.game.scale.width;
    if (width < 768) return 0.8;
    if (width < 1024) return 1.0;
    return 1.2;
  }
}

export default MapManager;
