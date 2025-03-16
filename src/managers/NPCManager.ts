import { NPC, NPCConfig } from "../entities/NPC";
import { Player } from "../entities/Player";

export class NPCManager {
    private npcs: Map<string, NPC> = new Map();
    private scene: Phaser.Scene;
    private player: Player;

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

        return npc;
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