import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import MobileControls from "./MobileControls";

const Game = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const [gameScene, setGameScene] = useState<GameScene | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current) return;
    
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 768,
      height: 480,
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: true } // Enable debug mode to see collision boxes
      },
      scene: GameScene,
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT, // Use STRETCH to fill the entire screen
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    const game = new Phaser.Game(config);
    setGameInstance(game);
    
    // Get a reference to the game scene for mobile controls
    const checkForScene = () => {
      try {
        const scene = game.scene.getScene('GameScene') as GameScene;
        if (scene) {
          setGameScene(scene);
          return true;
        }
      } catch (e) {
        console.log('Scene not ready yet');
      }
      return false;
    };

    // Try immediately
    if (!checkForScene()) {
      // If not available, try again after a short delay
      const intervalId = setInterval(() => {
        if (checkForScene()) {
          clearInterval(intervalId);
        }
      }, 100);
    }

    return () => game.destroy(true);
  }, []);

  // Handle mobile control events
  const handleDirectionPress = (direction: string | null) => {
    if (!gameScene) return;
    gameScene.setVirtualControlDirection(direction);
  };

  const handleAttackPress = () => {
    if (!gameScene) return;
    gameScene.triggerVirtualAttack();
  };

  return (
    <div className="relative w-full h-full">
      <div id="game-container" ref={gameContainerRef} className="fixed inset-0 w-screen h-screen z-10"></div>
      {/* Only show mobile controls on mobile devices */}
      <div className="pointer-events-none z-20">
        <MobileControls 
          onDirectionPress={handleDirectionPress}
          onAttackPress={handleAttackPress}
        />
      </div>
    </div>
  );
};

class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: string = 'down';  // Track the last direction for idle animations
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer | null;
  
  // Virtual controls for mobile
  private virtualDirection: string | null = null;
  private virtualAttackTriggered: boolean = false;

  constructor() {
    super({
      key: "GameScene"
    });
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
    this.collisionLayer = map.createLayer('Collision', tileset, 0, 0);

    if (!groundLayer || !decorationLayer || !this.collisionLayer) {
      console.error('Failed to create layers');
      return;
    }
    
    // Set collision on the collision layer
    this.collisionLayer.setCollisionByExclusion([-1, 0]);
    
    // Set the collision callback to improve accuracy
    this.physics.world.setFPS(60); // Higher FPS for better collision detection
    this.physics.world.TILE_BIAS = 8; // Reduce the tile bias to improve collision detection
    
    // For debugging - show collision areas
    this.collisionLayer.renderDebug(this.add.graphics(), {
      tileColor: null,
      collidingTileColor: new Phaser.Display.Color(255, 0, 0, 200), // Bright red with higher opacity
      faceColor: new Phaser.Display.Color(0, 255, 0, 200) // Bright green with higher opacity
    });

    // Create player
    this.player = this.physics.add.sprite(100, 100, 'player');
    this.player.setCollideWorldBounds(true);
    
    // Scale the player since LPC sprites are 64x64
    this.player.setScale(0.5); // This will make it 32x32
    
    // Adjust the player's physics body to better match the visible sprite
    if (this.player.body) {
      this.player.body.setSize(20, 28); // Make hitbox smaller to match visible character
      this.player.body.setOffset(22, 36); // Adjust hitbox position to be at the character's feet
    } else {
      console.error('Failed to set player physics body');
    }
    
    // Set up collision between player and collision layer
    if (this.player && this.collisionLayer) {
      this.physics.add.collider(this.player, this.collisionLayer);
    }

    // Camera follows player
    this.cameras.main.startFollow(this.player);
    let zoom = 2.0; // Set a fixed zoom of 2.0 for all devices
    this.cameras.main.setZoom(zoom);

    // Set world bounds based on map size
    this.physics.world.bounds.width = map.widthInPixels;
    this.physics.world.bounds.height = map.heightInPixels;

    // Keyboard input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    } else {
      console.error("Keyboard input not available");
      return;
    }

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


  

  
  // Methods for virtual controls (mobile)
  public setVirtualControlDirection(direction: string | null) {
    console.log('Setting virtual direction:', direction);
    this.virtualDirection = direction;
  }

  public triggerVirtualAttack() {
    console.log('Virtual attack triggered');
    this.virtualAttackTriggered = true;
  }

  update() {
    if (!this.player || !this.cursors || !this.collisionLayer) {
      return;
    }

    const speed = 160;
    this.player.setVelocity(0);

    // Handle attack animation (keyboard or virtual)
    if (Phaser.Input.Keyboard.JustDown(this.attackKey) || this.virtualAttackTriggered) {
      this.virtualAttackTriggered = false; // Reset virtual attack trigger
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

    // Handle keyboard input
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
    
    // Handle virtual controls (mobile)
    if (this.virtualDirection) {
      switch (this.virtualDirection) {
        case 'left':
          velocityX = -speed;
          direction = 'left';
          break;
        case 'right':
          velocityX = speed;
          direction = 'right';
          break;
        case 'up':
          velocityY = -speed;
          if (!direction) direction = 'up';
          break;
        case 'down':
          velocityY = speed;
          if (!direction) direction = 'down';
          break;
      }
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
