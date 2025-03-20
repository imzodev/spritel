import { Player } from "../entities/Player";

type MessageHandler = (data: any) => void;

export enum EventTypes {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  INTERACTION_START = 'INTERACTION_START',
  INTERACTION_END = 'INTERACTION_END',
  NPC_PAUSED = 'NPC_PAUSED'
}

export class NetworkManager extends EventTarget {
  private ws: WebSocket;
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  constructor() {
    super();
    this.ws = new WebSocket('ws://localhost:3001');
    
    this.ws.onopen = () => {
      console.log('Connected to server');
      this.dispatchEvent(new Event(EventTypes.CONNECT));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // console.log('[NetworkManager] Received message:', data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.dispatchEvent(new Event(EventTypes.DISCONNECT));
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
      const mapPosition = player.getMapPosition();
      
      console.log('[NetworkManager] Sending player update:', {
        id: player.getId(),
        mapPosition: mapPosition,
        position: {
          x: player.getSprite().x,
          y: player.getSprite().y
        }
      });
      
      this.ws.send(JSON.stringify({
        type: 'player-update',
        player: {
          id: player.getId(),
          x: player.getSprite().x,
          y: player.getSprite().y,
          animation: currentAnimation,
          mapPosition: mapPosition,
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

  public requestNPCStates(mapPosition: { x: number, y: number }): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'request-npc-states',
        mapPosition: mapPosition
      }));
    }
  }

  public sendNPCCollision(data: { npcId: string, collision: { up: boolean, down: boolean, left: boolean, right: boolean }, currentTile: { tileX: number, tileY: number }, x: number, y: number, facing: string }): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'npc-collision',
        ...data
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  public sendNPCMovementComplete(data: { npcId: string, x: number, y: number }): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'npc-movement-complete',
        npcId: data.npcId,
        x: data.x,
        y: data.y
      }));
    }
  }

  public sendNPCMapEdge(data: {
    npcId: string,
    edges: { up: boolean, down: boolean, left: boolean, right: boolean },
    currentTile: { tileX: number, tileY: number },
    x: number,
    y: number,
    facing: string
  }): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'npc-map-edge',
        ...data
      }));
    }
  }

  public sendInteractionStart(npcId: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: EventTypes.INTERACTION_START,
        npcId,
      }));
    }
  }

  public sendInteractionEnd(npcId: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: EventTypes.INTERACTION_END,
        npcId,
      }));
    }
  }

  private handleMessage(message: any): void {
    // Dispatch the event
    this.dispatchEvent(new CustomEvent(message.type, { detail: message }));
  }
}
