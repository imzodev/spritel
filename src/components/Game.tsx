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

    // Player animations based on LPC spritesheet format
    // The walking animations are in these rows:
    // Row 9: Walk Up (was labeled as Down)
    // Row 10: Walk Left (was labeled as Right)
    // Row 11: Walk Down (was labeled as Up)
    // Row 12: Walk Right (was labeled as Left)

    const frameRate = 8;
    const framesPerRow = 13;
    const walkUpRow = 8;     // Row 9 (0-based)
    const walkLeftRow = 9;   // Row 10
    const walkDownRow = 10;  // Row 11
    const walkRightRow = 11; // Row 12
    
    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('player', { 
        start: walkDownRow * framesPerRow, 
        end: walkDownRow * framesPerRow + 8
      }),
      frameRate,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('player', { 
        start: walkLeftRow * framesPerRow, 
        end: walkLeftRow * framesPerRow + 8
      }),
      frameRate,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('player', { 
        start: walkRightRow * framesPerRow, 
        end: walkRightRow * framesPerRow + 8
      }),
      frameRate,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('player', { 
        start: walkUpRow * framesPerRow, 
        end: walkUpRow * framesPerRow + 8
      }),
      frameRate,
      repeat: -1
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

    // Diagonal movement
    if (this.cursors.left.isDown || this.cursors.right.isDown || 
        this.cursors.up.isDown || this.cursors.down.isDown) {
      
      let velocityX = 0;
      let velocityY = 0;
      let animation = '';

      if (this.cursors.left.isDown) {
        velocityX = -speed;
        animation = 'walk-left';
      } else if (this.cursors.right.isDown) {
        velocityX = speed;
        animation = 'walk-right';
      }

      if (this.cursors.up.isDown) {
        velocityY = -speed;
        if (!animation) animation = 'walk-up';
      } else if (this.cursors.down.isDown) {
        velocityY = speed;
        if (!animation) animation = 'walk-down';
      }

      // Normalize diagonal movement
      if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= Math.SQRT1_2;
        velocityY *= Math.SQRT1_2;
      }

      this.player.setVelocity(velocityX, velocityY);
      this.player.anims.play(animation, true);
    } else {
      this.player.anims.stop();
    }
  }
}

export default Game;
