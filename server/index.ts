import { Server } from "bun";

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

const server = Bun.serve<{ id: string }>({
  port: 3001,
  fetch(req, server) {
    if (server.upgrade(req, {
      data: { id: crypto.randomUUID() }
    })) {
      return; // Return if upgrade was successful
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const id = ws.data.id;
      connectedClients.add(ws);

      // Initialize player
      state.players.set(id, {
        id,
        x: 100,
        y: 100,
        animation: "idle-down",
        mapPosition: { x: 0, y: 0 },
      });

      // Broadcast new player to others
      broadcast({
        type: "player-joined",
        player: state.players.get(id),
      }, ws);

      // Send current state to new player
      ws.send(JSON.stringify({
        type: "game-state",
        players: Array.from(state.players.values()),
      }));
    },
    message(ws, message) {
      const data = JSON.parse(String(message));
      const playerId = ws.data.id;

      switch (data.type) {
        case "player-update":
          const player = state.players.get(playerId);
          if (player) {
            Object.assign(player, data.player);
            broadcast({ type: "player-update", player }, ws);
          }
          break;
        case "player-attack":
          broadcast({ 
            type: "player-attack", 
            playerId,
            position: data.position 
          }, ws);
          break;
      }
    },
    close(ws) {
      const playerId = ws.data.id;
      state.players.delete(playerId);
      connectedClients.delete(ws);
      broadcast({
        type: "player-left",
        playerId,
      }, ws);
    },
  },
});

function broadcast(message: any, sender?: { data: { id: string } }) {
  const messageStr = JSON.stringify(message);
  for (const client of connectedClients) {
    if (sender && client.data.id === sender.data.id) continue;
    client.send(messageStr);
  }
}

console.log(`WebSocket server running on port ${server.port}`);