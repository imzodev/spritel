
import { Player } from "../entities/Player";

type MessageHandler = (data: any) => void;

export class NetworkManager extends EventTarget {
  private ws: WebSocket;
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  constructor() {
    super();
    this.ws = new WebSocket('ws://localhost:3001');
    
    this.ws.onopen = () => {
      console.log('Connected to server');
      this.dispatchEvent(new Event('connect'));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.dispatchEvent(new CustomEvent(data.type, { detail: data }));
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.dispatchEvent(new Event('disconnect'));
    };
  }

  public on(type: string, handler: MessageHandler) {
    const wrappedHandler = (event: Event) => {
      if (event instanceof CustomEvent) {
        handler(event.detail);
      } else {
        handler({});
      }
    };

    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)?.add(handler);
    
    this.addEventListener(type, wrappedHandler);
  }

  public off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  public updatePlayerState(player: Player) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const currentAnimation = player.getCurrentAnimation();
      this.ws.send(JSON.stringify({
        type: 'player-update',
        player: {
          id: player.getId(),
          x: player.getSprite().x,
          y: player.getSprite().y,
          animation: currentAnimation,
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