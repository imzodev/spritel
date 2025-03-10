export interface MapData {
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

export interface MapCoordinate {
    x: number;
    y: number;
}

export interface AdjacentMaps {
    north: MapCoordinate | null;
    south: MapCoordinate | null;
    east: MapCoordinate | null;
    west: MapCoordinate | null;
}

export interface PlayerConfig {
    speed: number;
    scale: number;
    bodySize: {
        width: number;
        height: number;
    };
    bodyOffset: {
        x: number;
        y: number;
    };
}

export interface AnimationConfig {
    frameRate: number;
    framesPerRow: number;
    rows: {
        idleUp: number;
        idleLeft: number;
        idleDown: number;
        idleRight: number;
        walkUp: number;
        walkLeft: number;
        walkDown: number;
        walkRight: number;
        attackUp: number;
        attackLeft: number;
        attackDown: number;
        attackRight: number;
    };
}
