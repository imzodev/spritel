import { Server } from "bun";

interface Player {
  id: string;
  x: number;
  y: number;
  animation: string;
  mapPosition: { x: number; y: number };
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
    lastCollisionTime: 0
  };
  updateNPCPosition('merchant', merchant);

  // Add more NPCs here as needed
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

// Update the movement interval to respect collision state
setInterval(() => {
  npcStates.forEach((npc, npcId) => {
    if (!npc.isColliding && npc.state === 'walking') {
      // Move the NPC
      npc.x += npc.currentVelocity.x * 2;
      npc.y += npc.currentVelocity.y * 2;
      
      // Broadcast update
      broadcast({
        type: 'npc-update',
        npc: npc
      });
    }
  });
}, 100); // Update every 100ms
