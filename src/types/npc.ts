export interface TilePosition {
  tileX: number;
  tileY: number;
}

export interface NPCMovementState {
  currentPath: Array<TilePosition>;  // Current path of tiles to traverse
  currentTileIndex: number;          // Current position in path
  isMoving: boolean;                 // Whether NPC is currently moving
  targetTile: TilePosition | null;   // Next tile to move to
}

export interface NPCState {
  id: string;
  x: number;
  y: number;
  texture: string;
  scale: number;
  interactionRadius: number;
  defaultAnimation: string;
  mapCoordinates: { x: number; y: number };
  state: 'idle' | 'walking' | 'talking' | 'busy';
  facing: 'up' | 'down' | 'left' | 'right';
  currentVelocity: { x: number; y: number };
  isColliding: boolean;
  lastCollisionTime: number;
  movementState: NPCMovementState;
  currentTile: TilePosition;         // Current tile position
}
