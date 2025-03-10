import Phaser from "phaser";
import { MapManager } from "../managers/MapManager";
import { Player } from "../entities/Player";

export default class GameScene extends Phaser.Scene {
    private player!: Player;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private attackKey!: Phaser.Input.Keyboard.Key;
    private mapManager!: MapManager;
    private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private playerCollider: Phaser.Physics.Arcade.Collider | null = null;
    private virtualDirection: string | null = null;
    private virtualAttackTriggered: boolean = false;

    constructor() {
        super({ key: "GameScene" });
    }

    preload(): void {
        this.initializeMapManager();
        this.loadAssets();
    }

    private initializeMapManager(): void {
        this.mapManager = new MapManager(this, {
            mapWidth: 24,
            mapHeight: 15,
            tileSize: 16,
            transitionThreshold: 5,
        });
        this.mapManager.loadMap(0, 0);
    }

    private loadAssets(): void {
        this.load.image("tiles", "/assets/beginnertileset.png");
        this.load.spritesheet("player", "/assets/player.png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        // Add load complete handler
        this.load.on("complete", () => {
            console.log("Assets loaded:", this.textures.list);
            if (this.textures.exists("player")) {
                console.log("Player texture loaded successfully");
            } else {
                console.error("Player texture failed to load");
            }
        });
    }

    create(): void {
        this.initializeControls();
        this.createPlayer();
        this.setupCamera();
    }

    private initializeControls(): void {
        if (!this.input.keyboard) {
            console.error("Keyboard input not available");
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
    }

    private createPlayer(): void {
        const playerConfig = {
            speed: 160,
            scale: 0.5,
            bodySize: { width: 20, height: 28 },
            bodyOffset: { x: 22, y: 36 },
        };

        const animConfig = {
            frameRate: 8,
            framesPerRow: 13,
            rows: {
                idleUp: 22,
                idleLeft: 23,
                idleDown: 24,
                idleRight: 25,
                walkUp: 8,
                walkLeft: 9,
                walkDown: 10,
                walkRight: 11,
                attackUp: 12,
                attackLeft: 13,
                attackDown: 14,
                attackRight: 15,
            },
        };

        this.player = new Player(this, 100, 100, playerConfig, animConfig);
    }

    private setupCamera(): void {
        this.cameras.main.startFollow(this.player.getSprite());
        this.cameras.main.setZoom(2.0);
    }

    public setCollisionLayer(newLayer: Phaser.Tilemaps.TilemapLayer): void {
        this.destroyCurrentLayers();

        if (this.player) {
            newLayer.setCollisionByExclusion([-1, 0]);
            this.playerCollider = this.physics.add.collider(
                this.player.getSprite(),
                newLayer
            );
            this.collisionLayer = newLayer;
        }
    }

    private destroyCurrentLayers(): void {
        if (this.playerCollider) {
            this.physics.world.removeCollider(this.playerCollider);
            this.playerCollider = null;
        }
    }

    public setVirtualControlDirection(direction: string | null): void {
        this.virtualDirection = direction;
    }

    public triggerVirtualAttack(): void {
        this.virtualAttackTriggered = true;
    }

    update(time: number, delta: number): void {
        if (!this.player || !this.cursors) return;

        const movement = this.getMovementInput();
        const isAttacking =
            Phaser.Input.Keyboard.JustDown(this.attackKey) ||
            this.virtualAttackTriggered;

        this.player.update(movement, isAttacking);
        this.mapManager.checkMapTransition(this.player.getSprite());

        this.virtualAttackTriggered = false;
    }

    private getMovementInput(): { x: number; y: number } {
        let x = 0;
        let y = 0;

        if (this.virtualDirection) {
            switch (this.virtualDirection) {
                case "up":
                    y = -1;
                    break;
                case "down":
                    y = 1;
                    break;
                case "left":
                    x = -1;
                    break;
                case "right":
                    x = 1;
                    break;
            }
        } else {
            if (this.cursors.left.isDown) x = -1;
            else if (this.cursors.right.isDown) x = 1;
            if (this.cursors.up.isDown) y = -1;
            else if (this.cursors.down.isDown) y = 1;
        }

        return { x, y };
    }
}
