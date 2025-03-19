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
    y: 100,
    texture: 'npc_1',
    scale: 0.5,
    interactionRadius: 50,
    defaultAnimation: 'npc_1_idle_down',
    mapCoordinates: { x: 0, y: 0 },
    state: 'idle',
    facing: 'down',
    currentVelocity: { x: 0, y: 0 }
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

// Add NPC movement/behavior update loop
setInterval(() => {
  npcStates.forEach((npc) => {
    // Update NPC state based on behavior (random movement, etc.)
    if (npc.state === 'walking') {
      npc.x += npc.currentVelocity.x;
      npc.y += npc.currentVelocity.y;
      
      // Random direction change
      if (Math.random() < 0.02) { // 2% chance per update
        // Choose a random cardinal direction (0: up, 1: right, 2: down, 3: left)
        const direction = Math.floor(Math.random() * 4);
        const speed = 1; // Base movement speed
        
        // Reset velocities and set new direction
        npc.currentVelocity = { x: 0, y: 0 };
        
        switch (direction) {
          case 0: // up
            npc.currentVelocity.y = -speed;
            npc.facing = 'up';
            break;
          case 1: // right
            npc.currentVelocity.x = speed;
            npc.facing = 'right';
            break;
          case 2: // down
            npc.currentVelocity.y = speed;
            npc.facing = 'down';
            break;
          case 3: // left
            npc.currentVelocity.x = -speed;
            npc.facing = 'left';
            break;
        }
      }
    } else if (Math.random() < 0.01) { // 1% chance to start walking
      // Choose a random cardinal direction (0: up, 1: right, 2: down, 3: left)
      const direction = Math.floor(Math.random() * 4);
      const speed = 1; // Base movement speed
      
      npc.state = 'walking';
      npc.currentVelocity = { x: 0, y: 0 }; // Reset velocity
      
      switch (direction) {
        case 0: // up
          npc.currentVelocity.y = -speed;
          npc.facing = 'up';
          break;
        case 1: // right
          npc.currentVelocity.x = speed;
          npc.facing = 'right';
          break;
        case 2: // down
          npc.currentVelocity.y = speed;
          npc.facing = 'down';
          break;
        case 3: // left
          npc.currentVelocity.x = -speed;
          npc.facing = 'left';
          break;
      }
    }

    // Broadcast NPC updates to all clients in the same map
    broadcast({
      type: 'npc-update',
      npc: {
        id: npc.id,
        x: npc.x,
        y: npc.y,
        state: npc.state,
        facing: npc.facing,
        mapCoordinates: npc.mapCoordinates
      }
    }, null, npc.mapCoordinates);
  });
}, 100); // Update every 100ms

// The determineNPCFacing function has been removed as it's no longer needed
// The facing direction is now set directly when choosing movement direction
