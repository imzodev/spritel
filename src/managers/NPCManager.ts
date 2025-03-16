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
        // Check if NPC already exists
        if (this.npcs.has(id)) {
            return this.npcs.get(id)!;
        }

        const npc = new NPC(this.scene, config);
        this.npcs.set(id, npc);

        // Only add collision if the NPC is on the current map
        const currentMapCoords = this.player.getMapPosition();
        if (npc.shouldBeVisible(currentMapCoords)) {
            this.setupNPCCollision(npc);
        }

        return npc;
    }

    private setupNPCCollision(npc: NPC): void {
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
    }

    public clearNPCsForTransition(): void {
        // Remove all colliders and destroy sprites
        this.npcs.forEach(npc => {
            // Remove collision with player
            if (this.scene.physics.world.colliders.getActive().length > 0) {
                this.scene.physics.world.colliders.getActive().forEach(collider => {
                    if (collider.object2 === npc.getSprite()) {
                        collider.destroy();
                    }
                });
            }
            
            // Destroy the NPC sprite and interaction zone
            npc.getSprite().destroy();
            npc.getInteractionZone().destroy();
        });
        
        // Clear the NPCs map
        this.npcs.clear();
        this.collisionLayer = null;
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer | null): void {
        // Remove existing collisions first
        if (this.collisionLayer) {
            this.npcs.forEach(npc => {
                this.scene.physics.world.colliders.getActive().forEach(collider => {
                    if (collider.object2 === npc.getSprite()) {
                        collider.destroy();
                    }
                });
            });
        }

        this.collisionLayer = layer;
        
        // Only add new collisions if we have a valid layer
        if (layer) {
            this.npcs.forEach(npc => {
                const currentMapCoords = this.player.getMapPosition();
                if (npc.shouldBeVisible(currentMapCoords)) {
                    this.setupNPCCollision(npc);
                }
            });
        }
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

    public updateNPCVisibility(): void {
        const currentMapCoords = this.player.getMapPosition();
        this.npcs.forEach((npc, id) => {
            const shouldBeVisible = npc.shouldBeVisible(currentMapCoords);
            npc.getSprite().setVisible(shouldBeVisible);
            const body = npc.getSprite().body;
            if (body) {
                body.enable = shouldBeVisible;
            }
        });
    }
}
