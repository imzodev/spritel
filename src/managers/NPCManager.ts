import { NPC, NPCConfig } from "../entities/NPC";
import { Player } from "../entities/Player";
import { GameScene } from "../scenes/GameScene";

export class NPCManager {
    private scene: GameScene;
    private npcs: Map<string, NPC> = new Map();
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private player: Player;

    constructor(scene: GameScene, player: Player) {
        this.scene = scene;
        this.player = player;
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer): void {
        console.log('[NPCManager] Setting collision layer');
        this.collisionLayer = layer;
        
        // Reconfigure collisions for all existing NPCs
        this.npcs.forEach(npc => {
            console.log('[NPCManager] Reconfiguring collision for NPC:', npc.getId());
            this.setupNPCCollision(npc);
        });
    }

    private setupNPCCollision(npc: NPC): void {
        if (!this.collisionLayer) {
            console.warn('[NPCManager] No collision layer available for NPC:', npc.getId());
            return;
        }

        console.log('[NPCManager] Setting up collision for NPC:', npc.getId());
        
        // Get the sprite and ensure it has a physics body
        const sprite = npc.getSprite();
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        
        if (!body) {
            console.error('[NPCManager] NPC sprite has no physics body:', npc.getId());
            return;
        }

        // Configure physics body
        body.setCollideWorldBounds(true);
        body.setImmovable(true);
        
        // Add collider with the map
        const mapCollider = this.scene.physics.add.collider(
            sprite,
            this.collisionLayer,
            () => {
                console.log('[NPCManager] NPC collided with map:', npc.getId());
                // Stop the NPC's movement when colliding
                body.setVelocity(0, 0);
            }
        );

        // Add collider with the player
        const playerCollider = this.scene.physics.add.collider(
            sprite,
            this.player.getSprite(),
            () => {
                console.log('[NPCManager] NPC collided with player:', npc.getId());
                // Stop the NPC's movement when colliding with player
                body.setVelocity(0, 0);
            }
        );

        // Store colliders in the NPC instance
        npc.setColliders([mapCollider, playerCollider]);
        
        console.log('[NPCManager] Collision setup complete for NPC:', npc.getId());
    }

    public createNPC(id: string, config: NPCConfig): NPC {
        console.log('[NPCManager] Creating NPC:', id);
        
        // Remove existing NPC if it exists
        const existingNPC = this.npcs.get(id);
        if (existingNPC) {
            console.log('[NPCManager] Removing existing NPC:', id);
            existingNPC.destroy();
            this.npcs.delete(id);
        }

        const npcConfig = {
            ...config,
            id: id
        };

        const npc = new NPC(this.scene, npcConfig);
        this.npcs.set(id, npc);

        // Set up collision immediately if we have a collision layer
        if (this.collisionLayer) {
            this.setupNPCCollision(npc);
        }

        return npc;
    }

    public update(): void {
        this.npcs.forEach(npc => npc.update());
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
