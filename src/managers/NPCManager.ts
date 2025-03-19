import { NPC } from '../entities/NPC';
import GameScene from '../scenes/GameScene';

interface NPCConfig {
    id: string;
    x: number;
    y: number;
    texture: string;
    scale?: number;
    interactionRadius?: number;
    mapCoordinates: { x: number; y: number };
}

export class NPCManager {
    private scene: GameScene;
    private npcs: Map<string, NPC>;
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    constructor(scene: GameScene) {
        console.log('[NPCManager] Initializing');
        this.scene = scene;
        this.npcs = new Map();
    }

    public clearAllNPCs(): void {
        this.npcs.forEach(npc => {
            if (npc) {
                npc.destroy();
            }
        });
        this.npcs.clear();
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer): void {
        this.collisionLayer = layer;
        // Add collision for all existing NPCs
        this.npcs.forEach(npc => {
            if (npc && layer) {
                this.scene.physics.add.collider(npc.getSprite(), layer);
            }
        });
    }

    public update(): void {
        this.npcs.forEach((npc, id) => {
            if (npc) {
                npc.update();
            }
        });
    }

    public createNPC(config: NPCConfig): NPC {
        console.log('[NPCManager] Creating NPC with config:', config);
        if (!config.id || !config.texture) {
            console.error('[NPCManager] Invalid NPC config:', config);
            throw new Error(`[NPCManager] Invalid NPC config: ${JSON.stringify(config)}`);
        }

        const npc = new NPC(this.scene, config);
        this.npcs.set(config.id, npc);
        console.log('[NPCManager] NPC created successfully:', config.id);
        
        // Add collision with the current layer if it exists
        if (this.collisionLayer) {
            this.scene.physics.add.collider(npc.getSprite(), this.collisionLayer);
        }
        return npc;
    }

    public getNPC(id: string): NPC | undefined {
        return this.npcs.get(id);
    }

    public updateNPC(npcData: any): void {
        const npc = this.npcs.get(npcData.id);
        if (npc) {
            npc.updateFromNetwork(npcData);
        }
    }

    public getAllNPCs(): Map<string, NPC> {
        return this.npcs;
    }

    public getNPCsInRange(): NPC[] {
        const npcsInRange: NPC[] = [];
        this.npcs.forEach(npc => {
            if (npc && npc.isInInteractionRange()) {
                npcsInRange.push(npc);
            }
        });
        return npcsInRange;
    }
}
