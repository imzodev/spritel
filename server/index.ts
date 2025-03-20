import { Server } from "bun";
import { NPCState, TilePosition, NPCMovementState } from '../src/types/npc';

// Constants for tile-based calculations
const TILE_SIZE = 16; // Size of each tile in pixels
const MAP_WIDTH_TILES = 24;
const MAP_HEIGHT_TILES = 15;
const NPC_BUFFER_TILES = 2; // Keep NPCs 2 tiles away from edges

// Convert to pixels when needed
const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;

// Remove only the duplicate interface declarations, keep the functions
function pixelsToTiles(x: number, y: number): TilePosition {
    return {
        tileX: Math.floor(x / TILE_SIZE),
        tileY: Math.floor(y / TILE_SIZE)
    };
}

interface Player {
  id: string;
  x: number;
  y: number;
  animation: string;
  mapPosition: { x: number; y: number };
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
  // Create the merchant NPC
  const merchant: NPCState = {
    id: 'merchant',
    x: 200,
    y: 70,
    texture: 'npc_1',
    scale: 0.5,
    interactionRadius: 50,
    defaultAnimation: 'npc_1_idle_down',
    mapCoordinates: { x: 0, y: 0 },
    state: 'idle',
    facing: 'down',
    currentVelocity: { x: 0, y: 0 },
    isColliding: false,
    lastCollisionTime: 0,
    movementState: {
      currentPath: [],
      currentTileIndex: 0,
      isMoving: false,
      targetTile: null
    },
    currentTile: pixelsToTiles(200, 70)
  };

  // Add merchant to the game state and start initial movement
  updateNPCPosition('merchant', merchant);
  generateNewPath(merchant);
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
    currentPath: [],
    currentTileIndex: 0,
    isMoving: false,
    targetTile: null
  };
}

function generateNewPath(npc: NPCState): void {
  console.log('[Server] Attempting to generate new path for NPC:', npc.id);

  if (npc.movementState.isMoving) {
    console.log(`[Server] NPC ${npc.id} is already moving, skipping`);
    return;
  }

  const directions: ("up" | "down" | "left" | "right")[] = ['up', 'down', 'left', 'right'];
  const direction = directions[Math.floor(Math.random() * directions.length)];
  const steps = Math.floor(Math.random() * 3) + 2; // 2-4 steps

  console.log(`[Server] Sending movement instruction for NPC ${npc.id}:`, {
    direction,
    steps,
    state: 'walking'
  });

  broadcast({
    type: 'npc-movement-instruction',
    npcId: npc.id,
    direction: direction,
    steps: steps,
    facing: direction,
    state: 'walking'
  });

  // Update NPC state
  npc.state = 'walking';
  npc.facing = direction;
  npc.movementState.isMoving = false;
}

function chooseNewDirection(npc: NPCState): { x: number, y: number } {
  const directions = [
    { x: 0, y: -1 },    // up
    { x: 0, y: 1 },     // down
    { x: -1, y: 0 },    // left
    { x: 1, y: 0 }      // right
  ];

  // Shuffle directions
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }

  // Filter out directions that would move towards the map edge
  const currentTilePos = pixelsToTiles(npc.x, npc.y);
  const filteredDirections = directions.filter(dir => {
    const newTile = {
      tileX: currentTilePos.tileX + dir.x,
      tileY: currentTilePos.tileY + dir.y
    };
    return newTile.tileX >= NPC_BUFFER_TILES && 
           newTile.tileX < MAP_WIDTH_TILES - NPC_BUFFER_TILES &&
           newTile.tileY >= NPC_BUFFER_TILES && 
           newTile.tileY < MAP_HEIGHT_TILES - NPC_BUFFER_TILES;
  });

  return filteredDirections[Math.floor(Math.random() * filteredDirections.length)] || { x: 0, y: 0 };
}

function getFacingFromDirection(direction: { x: number, y: number }): 'up' | 'down' | 'left' | 'right' {
  if (direction.x === 0) {
    return direction.y > 0 ? 'down' : 'up';
  } else {
    return direction.x > 0 ? 'right' : 'left';
  }
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

      if (data.type === 'request-npc-states') {
        const mapPosition = data.mapPosition;
        const mapKey = getMapKey(mapPosition.x, mapPosition.y);
        const npcIds = npcStatesByMap.get(mapKey);
        const npcs: NPCState[] = [];
        if (npcIds) {
          npcIds.forEach((id) => {
            const npcState = npcStates.get(id);
            if (npcState) {
              npcs.push(npcState);
            }
          });
        }
        console.log(`[Server] Sending NPC states for map (${mapPosition.x}, ${mapPosition.y}):`, npcs);
        ws.send(JSON.stringify({
          type: 'npc-states',
          npcs: npcs
        }));
        return;
      }

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
        case "npc-movement-complete":
          handleNPCMovementComplete(data);
          break;
        case "npc-map-edge":
          handleNPCMapEdge(data);
          break;
        case "npc-collision":
          handleNPCCollision(data);
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

function handleNPCMovementComplete(data: { npcId: string, x: number, y: number }): void {
    const { npcId, x, y } = data;
    console.log(`[Server] NPC ${npcId} movement completed. Updating position to (${x}, ${y})`);
    
    const npc = npcStates.get(npcId);
    if (!npc) return;
    
    // Update NPC state
    npc.x = x;
    npc.y = y;
    npc.currentTile = pixelsToTiles(x, y);
    npc.movementState.isMoving = false;
    npc.state = 'idle';
    
    // Generate a new movement path after a short delay
    setTimeout(() => {
        if (!npc) return;
        generateNewPath(npc);
    }, 1000);
}

function handleNPCCollision(data: { npcId: string, collision: { up: boolean, down: boolean, left: boolean, right: boolean }, currentTile: { x: number, y: number }, x: number, y: number}): void {
  console.log(`[Server] NPC ${data.npcId} collision detected`);
  const npc = npcStates.get(data.npcId);
  if (!npc) return;
  npc.x = data.x;
  npc.y = data.y;
  npc.currentTile = pixelsToTiles(data.x, data.y);
  npc.isColliding = true;
  npc.movementState.isMoving = false;
  npc.state = 'idle';

  // Clear collision state and try new direction after 1 second
  setTimeout(() => {
    if (!npc) return;
    npc.isColliding = false;
    generateNewPath(npc);
  }, 1000);
}

function getFacingFromVelocity(velocity: { x: number, y: number }): 'up' | 'down' | 'left' | 'right' {
  if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
    return velocity.x > 0 ? 'right' : 'left';
  } else {
    return velocity.y > 0 ? 'down' : 'up';
  }
}

function handleNPCMapEdge(data: { 
    npcId: string, 
    edges: { up: boolean, down: boolean, left: boolean, right: boolean }, 
    currentTile: { tileX: number, tileY: number }, 
    x: number, 
    y: number, 
    facing: string 
}): void {
    const { npcId, edges, x, y } = data;
    const npc = npcStates.get(npcId);
    if (!npc) return;

    // Update NPC state
    npc.x = x;
    npc.y = y;
    npc.currentTile = pixelsToTiles(x, y);
    npc.movementState.isMoving = false;
    npc.state = 'idle';
    
    // Immediately stop the NPC
    npc.currentVelocity = { x: 0, y: 0 };

    console.log(`[Server] NPC ${npcId} reached map edge:`, edges);

    // Generate new path immediately but in opposite direction
    setTimeout(() => {
        if (!npc) return;
        generateNewPath(npc);
    }, 1000);
}


// Make sure movement generation happens regularly
setTimeout(() => {
  console.log('[Server] Checking NPCs for movement updates');
  npcStates.forEach((npc, id) => {
    console.log(`[Server] NPC ${id} state:`, {
      isMoving: npc.movementState.isMoving,
      state: npc.state
    });
    if (!npc.movementState.isMoving) {
      generateNewPath(npc);
    }
  });
}, 5000); // Every 3 seconds
