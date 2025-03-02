import Phaser from "phaser";
import { useEffect } from "react";

const Game = () => {
  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false }
      },
      scene: GameScene,
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    const game = new Phaser.Game(config);

    return () => game.destroy(true);
  }, []);

  return <div id="game-container"></div>;
};

class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: string = 'down';  // Track the last direction for idle animations

  constructor() {
    super("GameScene");
  }

  preload() {
    // Load map assets
    this.load.image('tiles', '/assets/beginnertileset.png');
    this.load.tilemapTiledJSON('map', '/assets/map.json');
    
    // Load player spritesheet (LPC character format)
    this.load.spritesheet('player', '/assets/player.png', {
      frameWidth: 64,  // LPC sprites are 64x64
      frameHeight: 64
    });
  }

  create() {
    // Create tilemap
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('beginnertileset', 'tiles');
    
    if (!tileset) {
      console.error('Failed to add tileset');
      return;
    }

    // Create layers
    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const decorationLayer = map.createLayer('Decoration', tileset, 0, 0);

    if (!groundLayer || !decorationLayer) {
      console.error('Failed to create layers');
      return;
    }

    // Create player
    this.player = this.physics.add.sprite(100, 100, 'player');
    this.player.setCollideWorldBounds(true);
    
    // Scale the player since LPC sprites are 64x64
    this.player.setScale(0.5); // This will make it 32x32

    // Camera follows player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(2);

    // Set world bounds based on map size
    this.physics.world.bounds.width = map.widthInPixels;
    this.physics.world.bounds.height = map.heightInPixels;

    // Keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Player animations based on LPC spritesheet format
    const frameRate = 8;
    const framesPerRow = 13;

    // Row indices for different animation types
    const idleUpRow = 22;     // Row 22
    const idleLeftRow = 23;   // Row 23
    const idleDownRow = 24;   // Row 24
    const idleRightRow = 25;  // Row 25
    
    const walkUpRow = 8;     // Row 9
    const walkLeftRow = 9;   // Row 10
    const walkDownRow = 10;  // Row 11
    const walkRightRow = 11; // Row 12

    const attackUpRow = 12;    // Row 12
    const attackLeftRow = 13;  // Row 13
    const attackDownRow = 14;  // Row 14
    const attackRightRow = 15; // Row 16
    
    // Create idle animations with 2 frames
    ['up', 'left', 'down', 'right'].forEach((direction, index) => {
      const row = [idleUpRow, idleLeftRow, idleDownRow, idleRightRow][index];
      this.anims.create({
        key: `idle-${direction}`,
        frames: this.anims.generateFrameNumbers('player', {
          start: row * framesPerRow,
          end: row * framesPerRow + 1 // Use both frames
        }),
        frameRate: 1.5,
        repeat: -1,
        yoyo: true // Make it ping-pong between frames
      });
    });

    // Create walk animations
    ['up', 'left', 'down', 'right'].forEach((direction, index) => {
      const row = [walkUpRow, walkLeftRow, walkDownRow, walkRightRow][index];
      this.anims.create({
        key: `walk-${direction}`,
        frames: this.anims.generateFrameNumbers('player', {
          start: row * framesPerRow,
          end: row * framesPerRow + 8
        }),
        frameRate,
        repeat: -1
      });
    });

    // Create attack animations
    ['up', 'left', 'down', 'right'].forEach((direction, index) => {
      const row = [attackUpRow, attackLeftRow, attackDownRow, attackRightRow][index];
      this.anims.create({
        key: `attack-${direction}`,
        frames: this.anims.generateFrameNumbers('player', {
          start: row * framesPerRow,
          end: row * framesPerRow + 5
        }),
        frameRate: 12,
        repeat: 0
      });
    });

    // Set camera bounds to map size
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  update() {
    if (!this.player || !this.cursors) {
      return;
    }

    const speed = 160;
    this.player.setVelocity(0);

    // Handle attack animation
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const attackAnim = `attack-${this.lastDirection}`;
      this.player.anims.play(attackAnim);
      
      // Listen for animation complete
      this.player.once('animationcomplete', () => {
        // Return to idle when attack finishes
        console.log('attack complete');
        console.log("Idle animation: ", `idle-${this.lastDirection}`);
        this.player.anims.play(`idle-${this.lastDirection}`);
        
      });
      
      return; // Don't allow movement during attack
    }

    // Don't allow movement if we're in the middle of an attack
    if (this.player.anims.currentAnim && 
        this.player.anims.currentAnim.key.startsWith('attack-') &&
        this.player.anims.isPlaying) {
      return;
    }

    // Movement and walking animations
    let velocityX = 0;
    let velocityY = 0;
    let direction = '';

    if (this.cursors.left.isDown) {
      velocityX = -speed;
      direction = 'left';
    } else if (this.cursors.right.isDown) {
      velocityX = speed;
      direction = 'right';
    }

    if (this.cursors.up.isDown) {
      velocityY = -speed;
      if (!direction) direction = 'up';
    } else if (this.cursors.down.isDown) {
      velocityY = speed;
      if (!direction) direction = 'down';
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= Math.SQRT1_2;
      velocityY *= Math.SQRT1_2;
    }

    this.player.setVelocity(velocityX, velocityY);

    // Update animations
    if (direction) {
      this.lastDirection = direction;
      this.player.anims.play(`walk-${direction}`, true);
    } else {
      // Play idle animation in the last direction when stopped
      const idleAnim = `idle-${this.lastDirection}`;
      if (!this.player.anims.isPlaying || !this.player.anims.currentAnim?.key.startsWith('idle-')) {
        console.log('Playing idle animation:', idleAnim);
        this.player.anims.play(idleAnim, true);
      }
    }
  }
}

export default Game;
