import { Player } from "../entities/Player";

type MessageHandler = (data: any) => void;

export class NetworkManager {
  private ws: WebSocket;
  private handlers: Map<string, MessageHandler[]> = new Map();

  constructor() {
    this.ws = new WebSocket('ws://localhost:3001');
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const handlers = this.handlers.get(data.type) || [];
      handlers.forEach(handler => handler(data));
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic here if needed
    };
  }

  public on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)?.push(handler);
  }

  public updatePlayerState(player: Player) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'player-update',
        player: {
          id: player.getId(),
          x: player.getSprite().x,
          y: player.getSprite().y,
          animation: player.getCurrentAnimation(),
          mapPosition: player.getMapPosition(),
        },
      }));
    }
  }

  public sendAttack(position: { x: number, y: number }) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'player-attack',
        position,
      }));
    }
  }
}