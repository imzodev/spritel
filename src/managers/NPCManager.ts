import { NPC } from '../entities/NPC';
import GameScene from '../scenes/GameScene';

export class NPCManager {
    private npcs: Map<string, NPC>;
    private scene: GameScene;
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    constructor(scene: GameScene) {
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
        this.npcs.forEach(npc => {
            if (npc) {
                npc.update();
            }
        });
    }

    public createNPC(id: string, config: any): NPC {
        const npc = new NPC(this.scene, { id, ...config });
        this.npcs.set(id, npc);
        
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
