import { Server } from "bun";

// Constants for tile-based calculations
const TILE_SIZE = 16; // Size of each tile in pixels
const MAP_WIDTH_TILES = 24;
const MAP_HEIGHT_TILES = 15;
const NPC_BUFFER_TILES = 2; // Keep NPCs 2 tiles away from edges

// Convert to pixels when needed
const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;

interface TilePosition {
  tileX: number;
  tileY: number;
}

// Helper functions for conversion
function pixelsToTiles(x: number, y: number): TilePosition {
  return {
    tileX: Math.floor(x / TILE_SIZE),
    tileY: Math.floor(y / TILE_SIZE)
  };
}

function tilesToPixels(tileX: number, tileY: number): { x: number, y: number } {
  return {
    x: (tileX * TILE_SIZE) + (TILE_SIZE / 2), // Center of tile
    y: (tileY * TILE_SIZE) + (TILE_SIZE / 2)  // Center of tile
  };
}

interface Player {
  id: string;
  x: number;
  y: number;
  animation: string;
  mapPosition: { x: number; y: number };
}

interface NPCMovementState {
  lastPosition: { tileX: number, tileY: number };
  distanceTraveled: number;
  targetDistance: number;
}

interface NPCState {
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
}

interface GameState {
  players: Map<string, Player>;
}

const state: GameState = {
  players: new Map(),
};

const connectedClients = new Set<any>();

// Map structure to store NPCs by map coordinates
const npcStatesByMap = new Map<string, Set<string>>();  // Map<"x,y", Set<npcId>>
const npcStates = new Map<string, NPCState>();         // Map<npcId, NPCState>

function getMapKey(x: number, y: number): string {
  return `${x},${y}`;
}

// When adding/updating an NPC's position
function updateNPCPosition(npcId: string, npc: NPCState, oldMapCoords?: { x: number, y: number }) {
  // Remove from old map position if it exists
  if (oldMapCoords) {
    const oldMapKey = getMapKey(oldMapCoords.x, oldMapCoords.y);
    npcStatesByMap.get(oldMapKey)?.delete(npcId);
  }

  // Add to new map position
  const mapKey = getMapKey(npc.mapCoordinates.x, npc.mapCoordinates.y);
  if (!npcStatesByMap.has(mapKey)) {
    npcStatesByMap.set(mapKey, new Set());
  }
  npcStatesByMap.get(mapKey)!.add(npcId);
  npcStates.set(npcId, npc);
}

// Initialize default NPCs with complete configuration
function initializeNPCs() {
  const merchant: NPCState = {
    id: 'merchant',
    x: 200,
    y: 70,
    texture: 'npc_1',
    scale: 0.5,
    interactionRadius: 50,
    defaultAnimation: 'npc_1_idle_down',
    mapCoordinates: { x: 0, y: 0 },
    state: 'walking',
    facing: 'down',
    currentVelocity: { x: 0, y: 1 },
    isColliding: false,
    lastCollisionTime: 0,
    movementState: initializeNPCMovement()
  };

  // Update the movement state with actual position after NPC is created
  merchant.movementState.lastPosition = { x: merchant.x, y: merchant.y };
  
  updateNPCPosition('merchant', merchant);

  // Add more NPCs here as needed
}

const MathUtils = {
  Between(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  Distance: {
    Between(x1: number, y1: number, x2: number, y2: number): number {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
  },

  Angle: {
    Between(x1: number, y1: number, x2: number, y2: number): number {
      return Math.atan2(y2 - y1, x2 - x1);
    }
  },

  DegToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
};

function initializeNPCMovement(): NPCMovementState {
  return {
    lastPosition: { tileX: 0, tileY: 0 },
    distanceTraveled: 0,
    targetDistance: MathUtils.Between(3, 8) // Now in tiles instead of pixels
  };
}

function decideNPCMovement(npc: NPCState): void {
  const currentTilePos = pixelsToTiles(npc.x, npc.y);
  const lastTilePos = npc.movementState.lastPosition;

  // Calculate distance in tiles
  const tileDistanceMoved = MathUtils.Distance.Between(
    currentTilePos.tileX, currentTilePos.tileY,
    lastTilePos.tileX, lastTilePos.tileY
  );

  npc.movementState.distanceTraveled += tileDistanceMoved;
  npc.movementState.lastPosition = currentTilePos;

  const shouldChangeDirection = 
    npc.movementState.distanceTraveled >= npc.movementState.targetDistance ||
    Math.random() < 0.02;  // 2% chance to change direction randomly

  if (shouldChangeDirection) {
    npc.movementState.distanceTraveled = 0;
    npc.movementState.targetDistance = MathUtils.Between(3, 8); // 3-8 tiles

    if (Math.random() < 0.2) {  // 20% chance to pause
      npc.currentVelocity = { x: 0, y: 0 };
      npc.state = 'idle';
      
      setTimeout(() => {
        if (!npc) return;
        chooseNewDirection(npc);
      }, MathUtils.Between(1000, 3000));  // Pause for 1-3 seconds
    } else {
      chooseNewDirection(npc);
    }
  }
}

function chooseNewDirection(npc: NPCState): void {
  const currentTilePos = pixelsToTiles(npc.x, npc.y);
  
  // Define possible directions
  const directions = [
    { x: 0, y: -1, facing: 'up' },    // up
    { x: 0, y: 1, facing: 'down' },   // down
    { x: -1, y: 0, facing: 'left' },  // left
    { x: 1, y: 0, facing: 'right' }   // right
  ] as const;

  let availableDirections = [...directions];

  // If near map edges, filter out directions that would move towards the edge
  if (currentTilePos.tileX < NPC_BUFFER_TILES) {
    availableDirections = availableDirections.filter(dir => dir.x >= 0);
  }
  if (currentTilePos.tileX > MAP_WIDTH_TILES - NPC_BUFFER_TILES) {
    availableDirections = availableDirections.filter(dir => dir.x <= 0);
  }
  if (currentTilePos.tileY < NPC_BUFFER_TILES) {
    availableDirections = availableDirections.filter(dir => dir.y >= 0);
  }
  if (currentTilePos.tileY > MAP_HEIGHT_TILES - NPC_BUFFER_TILES) {
    availableDirections = availableDirections.filter(dir => dir.y <= 0);
  }

  // If no directions are available (shouldn't happen with proper buffer), use all directions
  if (availableDirections.length === 0) {
    availableDirections = [...directions];
  }

  // Choose random direction from available ones
  const newDirection = availableDirections[Math.floor(Math.random() * availableDirections.length)];
  
  npc.currentVelocity = { x: newDirection.x, y: newDirection.y };
  npc.state = 'walking';
  npc.facing = newDirection.facing;
}

// Call this when server starts
initializeNPCs();

function logGameState() {
  console.log('\n=== Current Game State ===');
  console.log('Connected players:', state.players.size);
  state.players.forEach((player, id) => {
    console.log(`Player ${id}:`, {
      position: { x: player.x, y: player.y },
      animation: player.animation,
      mapPosition: player.mapPosition
    });
  });
  console.log('========================\n');
}

const server = Bun.serve<{ id: string }>({
  port: 3001,
  fetch(req, server) {
    if (server.upgrade(req, {
      data: { id: crypto.randomUUID() }
    })) {
      return;
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const id = ws.data.id;
      connectedClients.add(ws);

      // Initialize player with default position
      state.players.set(id, {
        id,
        x: 100,  // Default position matching client
        y: 100,  // Default position matching client
        animation: "idle-down",
        mapPosition: { x: 0, y: 0 },
      });

      console.log(`\n👤 Player ${id} connected at default position`);
      logGameState();

      // First send current state to new player
      ws.send(JSON.stringify({
        type: "game-state",
        players: Array.from(state.players.values()),
      }));

      // Send initial NPC states to new player
      ws.send(JSON.stringify({
        type: 'initial-npc-states',
        npcs: Array.from(npcStates.values())
      }));

      // Then broadcast new player to others
      broadcast({
        type: "player-joined",
        player: state.players.get(id),
      }, ws);
    },
    message(ws, message) {
      const data = JSON.parse(String(message));
      const playerId = ws.data.id;

      switch (data.type) {
        case "player-update":
          const player = state.players.get(playerId);
          if (player) {
            const oldMapPosition = { ...player.mapPosition };
            
            // Update player state
            Object.assign(player, data.player);
            
            console.log('[Server] Processing player update:', {
              playerId,
              oldMap: oldMapPosition,
              newMap: player.mapPosition
            });
            
            // If map position changed, notify everyone about the transition
            if (oldMapPosition.x !== player.mapPosition.x || 
                oldMapPosition.y !== player.mapPosition.y) {
              
              console.log('[Server] Player changed maps:', {
                playerId,
                from: oldMapPosition,
                to: player.mapPosition
              });
              
              // First notify players in the old map that this player left
              broadcast({ 
                type: "player-left-map",
                playerId,
                mapPosition: oldMapPosition
              }, ws, oldMapPosition);

              // Then notify players in the new map about the player
              broadcast({ 
                type: "player-update", 
                player 
              }, ws, player.mapPosition);
            } else {
              // Regular update to players in the same map
              broadcast({ 
                type: "player-update", 
                player 
              }, ws, player.mapPosition);
            }
          }
          break;
        case "player-attack":
          broadcast({ 
            type: "player-attack", 
            playerId,
            position: data.position 
          }, ws);
          break;
        case "request-npc-states": {
          const { mapPosition } = data;
          const mapKey = getMapKey(mapPosition.x, mapPosition.y);
          const npcIds = npcStatesByMap.get(mapKey) || new Set();
          
          const mapNPCs = Array.from(npcIds).map(id => npcStates.get(id));
          
          ws.send(JSON.stringify({
            type: "initial-npc-states",
            npcs: mapNPCs
          }));
          break;
        }
        case "npc-collision":
          handleNPCCollision(data.npcId, data.collision);
          break;
      }
    },
    close(ws) {
      const playerId = ws.data.id;
      const player = state.players.get(playerId);
      const mapPosition = player?.mapPosition; // Get the last known map position
      
      state.players.delete(playerId);
      connectedClients.delete(ws);
      
      console.log(`\n👋 Player ${playerId} disconnected`);
      logGameState();

      // Send player-left to everyone
      broadcast({
        type: "player-left",
        playerId,
      }, ws);

      // If we have the player's last map position, also send player-left-map
      if (mapPosition) {
        broadcast({
          type: "player-left-map",
          playerId,
          mapPosition
        }, ws, mapPosition);
      }
    },
  },
});

function broadcast(
  message: any, 
  sender?: { data: { id: string } },
  mapPosition?: { x: number, y: number }
) {
  const messageStr = JSON.stringify(message);
  for (const client of connectedClients) {
    // Skip sender
    if (sender && client.data.id === sender.data.id) continue;
    
    // If mapPosition specified, only send to players on that map
    if (mapPosition) {
      const playerState = state.players.get(client.data.id);
      if (!playerState) continue;
      
      if (playerState.mapPosition.x !== mapPosition.x || 
          playerState.mapPosition.y !== mapPosition.y) {
        continue;
      }
    }
    
    client.send(messageStr);
  }
}

console.log(`WebSocket server running on port ${server.port}`);

function handleNPCCollision(npcId: string, collision: any) {
  const npc = npcStates.get(npcId);
  if (!npc) return;

  console.log(`[Server] NPC ${npcId} collision:`, collision);
  
  // Immediately stop the NPC
  npc.isColliding = true;
  npc.lastCollisionTime = Date.now();
  npc.currentVelocity = { x: 0, y: 0 };
  npc.state = 'idle';

  // Broadcast the stopped state immediately
  broadcast({
    type: 'npc-update',
    npc: npc
  });

  // Wait before trying to move again
  setTimeout(() => {
    if (!npc) return;
    
    // Reset collision state
    npc.isColliding = false;
    
    // Choose a new direction avoiding the collision
    const possibleDirections = [
      { x: 0, y: 1 },   // down
      { x: 0, y: -1 },  // up
      { x: 1, y: 0 },   // right
      { x: -1, y: 0 }   // left
    ].filter(dir => {
      if (collision.up && dir.y < 0) return false;
      if (collision.down && dir.y > 0) return false;
      if (collision.left && dir.x < 0) return false;
      if (collision.right && dir.x > 0) return false;
      return true;
    });

    if (possibleDirections.length > 0) {
      const newDir = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
      npc.currentVelocity = newDir;
      npc.state = 'walking';
      npc.facing = getFacingFromVelocity(newDir);
      
      // Broadcast the new movement state
      broadcast({
        type: 'npc-update',
        npc: npc
      });
    }
  }, 2000); // Wait 2 seconds before trying to move again
}

function getFacingFromVelocity(velocity: { x: number, y: number }): 'up' | 'down' | 'left' | 'right' {
  if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
    return velocity.x > 0 ? 'right' : 'left';
  } else {
    return velocity.y > 0 ? 'down' : 'up';
  }
}

function handleNPCMapEdge(npcId: string, edges: { up: boolean, down: boolean, left: boolean, right: boolean }) {
  const npc = npcStates.get(npcId);
  if (!npc) return;

  console.log(`[Server] NPC ${npcId} reached map edge:`, edges);
  
  // Immediately stop the NPC
  npc.currentVelocity = { x: 0, y: 0 };
  npc.state = 'idle';

  // Broadcast the stopped state immediately
  broadcast({
    type: 'npc-update',
    npc: npc
  });

  // Wait before choosing new direction
  setTimeout(() => {
    if (!npc) return;
    
    // Choose a new direction avoiding the edges
    const possibleDirections = [
      { x: 0, y: 1 },   // down
      { x: 0, y: -1 },  // up
      { x: 1, y: 0 },   // right
      { x: -1, y: 0 }   // left
    ].filter(dir => {
      if (edges.up && dir.y < 0) return false;
      if (edges.down && dir.y > 0) return false;
      if (edges.left && dir.x < 0) return false;
      if (edges.right && dir.x > 0) return false;
      return true;
    });

    if (possibleDirections.length > 0) {
      const newDir = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
      npc.currentVelocity = newDir;
      npc.state = 'walking';
      npc.facing = getFacingFromVelocity(newDir);
      
      broadcast({
        type: 'npc-update',
        npc: npc
      });
    }
  }, 2000);
}

// Update the movement interval for smoother updates
setInterval(() => {
  npcStates.forEach((npc, npcId) => {
    // First decide if we need to change movement
    if (npc.state !== 'idle') {
      decideNPCMovement(npc);
    }

    // Then handle actual movement
    if (!npc.isColliding && npc.state === 'walking') {
      const newX = npc.x + npc.currentVelocity.x * 1;
      const newY = npc.y + npc.currentVelocity.y * 1;

      // Convert buffer tiles to pixels
      const NPC_BUFFER = NPC_BUFFER_TILES * TILE_SIZE;

      // Check for map edges
      if (newX <= NPC_BUFFER || newX >= MAP_WIDTH - NPC_BUFFER || 
          newY <= NPC_BUFFER || newY >= MAP_HEIGHT - NPC_BUFFER) {
        
        const edges = {
          up: newY <= NPC_BUFFER,
          down: newY >= MAP_HEIGHT - NPC_BUFFER,
          left: newX <= NPC_BUFFER,
          right: newX >= MAP_WIDTH - NPC_BUFFER
        };

        handleNPCMapEdge(npcId, edges);
        return;
      }

      // If we reach here, the movement is valid
      npc.x = newX;
      npc.y = newY;
      
      broadcast({
        type: 'npc-update',
        npc: npc
      });
    }
  });
}, 50); // Updated from 100ms to 50ms for more frequent updates
