import Phaser from 'phaser';
import GameScene from './GameScene';

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
  private sideTransitionSize: number; // Number of pixels to transition to the next map, if we are this amount of pixels away from the edge we will transition to the next map

  constructor(game: Phaser.Scene) {
    this.game = game;
    this.currentMap = null;
    this.currentMapX = 0;
    this.currentMapY = 0;
    this.mapWidth = 24;
    this.mapHeight = 15;
    this.tileSize = 16;
    this.sideTransitionSize = 5;
    this.mapCoordinates = [];
  }

  loadMap(x: number, y: number): void {
  if (this.isMapLoaded(x, y)) return;

  const mapName = `map_${x}_${y}.json`;
  console.log(`Loading map: ${mapName}`);
  
  this.game.load.json(mapName, `/assets/maps/${mapName}`);
  this.game.load.tilemapTiledJSON(mapName, `/assets/maps/${mapName}`); // Use mapName as the key

  this.game.load.once('complete', () => {
    this.currentMap = this.game.cache.json.get(mapName);
    this.currentMapX = x;
    this.currentMapY = y;
    console.log(`Loaded map at coordinates: (${x}, ${y})`);
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
    const mapKey = `map_${this.currentMapX}_${this.currentMapY}`;
    const map = this.game.make.tilemap({ key: mapKey });
    const tileset = map.addTilesetImage('beginnertileset', 'tiles');

    if (!tileset) {
      console.error('Failed to add tileset');
      return;
    }

    // Create layers
    map.createLayer('Ground', tileset, 0, 0);
    map.createLayer('Decoration', tileset, 0, 0);
    const collisionLayer = map.createLayer('Collision', tileset, 0, 0);

    // Update world bounds
    // this.game.physics.world.bounds.width = map.widthInPixels;
    // this.game.physics.world.bounds.height = map.heightInPixels;
    this.game.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const gameScene = this.game.scene.get('GameScene') as GameScene;
    if (gameScene && collisionLayer) {
      gameScene.setCollisionLayer(collisionLayer); // Must exist in GameScene
    }
  }
  checkMapTransition(player: Phaser.Physics.Arcade.Sprite): void {
    if (!this.currentMap) return;
    
    // Get actual map dimensions from loaded data
    const mapWidthPixels = this.currentMap.width * this.currentMap.tilewidth;
    const mapHeightPixels = this.currentMap.height * this.currentMap.tileheight;

    // Debugging logs
    // Print the player position every 5 seconds
    if (this.game.time.now % 5000 < 16.66) {
      console.log(`Player position: (${player.x}, ${player.y})`);
      console.log(`Current map: (${this.currentMapX}, ${this.currentMapY})`);
      console.log(`Map dimensions: ${this.currentMap.width}x${this.currentMap.height}`);
      console.log(`Tile dimensions: ${this.currentMap.tilewidth}x${this.currentMap.tileheight}`);
      console.log(`Map bounds: 0,0 to ${mapWidthPixels},${mapHeightPixels}`);
    }
    

    // Check horizontal transitions
    if (player.x <= this.sideTransitionSize) {
      console.log('Triggering WEST transition');
      this.transitionToMap('west', player);
    } else if (player.x >= mapWidthPixels) {
      console.log('Triggering EAST transition');
      this.transitionToMap('east', player);
    }

    // Check vertical transitions
    if (player.y < 0) {
      console.log('Triggering NORTH transition');
      this.transitionToMap('north', player);
    } else if (player.y >= mapHeightPixels) {
      console.log('Triggering SOUTH transition');
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
        console.log(`mapWidth: ${this.mapWidth}`);
        console.log(`tileSize: ${this.tileSize}`);
        console.log('Setting player position to:', (this.mapWidth - 1) * this.tileSize);
        player.x = (this.mapWidth - 1) * this.tileSize;
        // player.x = 379;
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
