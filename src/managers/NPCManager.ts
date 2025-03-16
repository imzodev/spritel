import { NPC, NPCConfig } from "../entities/NPC";
import { Player } from "../entities/Player";

export class NPCManager {
    private npcs: Map<string, NPC> = new Map();
    private scene: Phaser.Scene;
    private player: Player;
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    constructor(scene: Phaser.Scene, player: Player) {
        this.scene = scene;
        this.player = player;
    }

    public createNPC(id: string, config: NPCConfig): NPC {
        const npc = new NPC(this.scene, config);
        this.npcs.set(id, npc);

        // Add collision with player
        this.scene.physics.add.collider(
            this.player.getSprite(),
            npc.getSprite()
        );

        // Add collision with map if collision layer exists
        if (this.collisionLayer) {
            this.scene.physics.add.collider(
                npc.getSprite(),
                this.collisionLayer
            );
        }

        return npc;
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer | null): void {
        this.collisionLayer = layer;
        
        // Update collision for all existing NPCs
        this.npcs.forEach(npc => {
            if (layer) {
                this.scene.physics.add.collider(
                    npc.getSprite(),
                    layer
                );
            }
        });
    }

    public update(): void {
        this.npcs.forEach(npc => {
            npc.update();
            
            // Check for player interaction
            if (npc.isPlayerInRange(this.player.getSprite())) {
                // Visual feedback that NPC is interactable
                npc.getInteractionZone().setVisible(true);
            } else {
                npc.getInteractionZone().setVisible(false);
            }
        });
    }

    public getNPC(id: string): NPC | undefined {
        return this.npcs.get(id);
    }

    public getNPCsInRange(): NPC[] {
        return Array.from(this.npcs.values()).filter(npc => 
            npc.isPlayerInRange(this.player.getSprite())
        );
    }
}