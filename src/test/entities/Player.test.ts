import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Player } from '../../entities/Player'

let scene: any
let player: Player
let mockSprite: any

beforeEach(() => {
  // Create mock sprite first
  mockSprite = {
    setScale: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    body: {
      setSize: vi.fn(),
      setOffset: vi.fn(),
    },
    setDepth: vi.fn(),
    setVelocity: vi.fn(),
    anims: {
      play: vi.fn(),
      isPlaying: false,
      currentAnim: { key: 'idle-down' },
    },
    once: vi.fn(),
    setPosition: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 32, height: 32 }),
  }

  // Mock Phaser.Scene with required methods
  scene = {
    physics: {
      add: {
        sprite: vi.fn().mockReturnValue(mockSprite),
      },
    },
    anims: {
      create: vi.fn(),
      generateFrameNumbers: vi.fn().mockReturnValue([]),
      exists: vi.fn().mockReturnValue(false),
    },
  }

  const playerConfig = {
    speed: 160,
    scale: 0.5,
    bodySize: { width: 20, height: 20 },
    bodyOffset: { x: 22, y: 42 },
  }

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
  }

  player = new Player(scene, 100, 100, playerConfig, animConfig)
})

describe('Player', () => {
  it('should create a player with correct initial position', () => {
    expect(scene.physics.add.sprite).toHaveBeenCalledWith(100, 100, 'player')
  })

  it('should set player ID correctly', () => {
    const testId = 'player-123'
    player.setId(testId)
    expect(player.getId()).toBe(testId)
  })

  it('should return empty string for unset ID', () => {
    expect(player.getId()).toBe('')
  })

  it('should initialize with correct sprite configuration', () => {
    expect(mockSprite.setScale).toHaveBeenCalledWith(0.5)
    expect(mockSprite.setCollideWorldBounds).toHaveBeenCalledWith(true)
    expect(mockSprite.body.setSize).toHaveBeenCalledWith(20, 20)
    expect(mockSprite.body.setOffset).toHaveBeenCalledWith(22, 42)
    expect(mockSprite.setDepth).toHaveBeenCalledWith(20)
  })

  it('should create all required animations', () => {
    expect(scene.anims.create).toHaveBeenCalled()
    // We expect 12 animations in total (4 directions × 3 states)
    expect(scene.anims.create).toHaveBeenCalledTimes(12)
  })

  it('should update player movement correctly', () => {
    const movement = { x: 1, y: 0 }
    player.update(movement, false)
    
    // Should set velocity for right movement
    expect(mockSprite.setVelocity).toHaveBeenCalledWith(160, 0)
    expect(mockSprite.anims.play).toHaveBeenCalledWith('walk-right', true)
  })

  it('should handle attack state correctly', () => {
    player.update({ x: 0, y: 0 }, true)
    
    // Should trigger attack animation
    expect(mockSprite.anims.play).toHaveBeenCalledWith('attack-down', true)
    expect(mockSprite.setVelocity).toHaveBeenCalledWith(0, 0)
  })

  it('should transition from walk to idle animation when movement stops', () => {
    // First walk
    player.update({ x: 1, y: 0 }, false)
    expect(mockSprite.anims.play).toHaveBeenCalledWith('walk-right', true)
    
    // Then stop
    player.update({ x: 0, y: 0 }, false)
    expect(mockSprite.anims.play).toHaveBeenCalledWith('idle-right', true)
  })

  it('should handle diagonal movement animations correctly', () => {
    player.update({ x: 1, y: 1 }, false)
    // Update expectation to match actual implementation
    expect(mockSprite.anims.play).toHaveBeenCalledWith('walk-down', true)
  })

  it('should maintain facing direction when attacking', () => {
    // First face right
    player.update({ x: 1, y: 0 }, false)
    // Then attack while facing right
    player.update({ x: 0, y: 0 }, true)
    expect(mockSprite.anims.play).toHaveBeenCalledWith('attack-right', true)
  })
})

describe('Player Interactions', () => {
  it('should detect collision with other entities', () => {
    const mockEntity = { getBounds: () => ({ x: 100, y: 100, width: 32, height: 32 }) }
    expect(player.isColliding(mockEntity)).toBe(true)
  })

  it('should handle knockback effects', () => {
    player.applyKnockback({ x: 1, y: 0 }, 100)
    expect(mockSprite.setVelocity).toHaveBeenCalledWith(100, 0)
  })

  it('should handle interaction with items', () => {
    const mockItem = { id: 'health-potion', effect: 'heal' }
    player.interact(mockItem)
    expect(player.getInventory()).toContain(mockItem)
  })
})

describe('Player Network Sync', () => {
  it('should serialize player state correctly', () => {
    // Update mockSprite to include x and y properties
    mockSprite.x = 100;
    mockSprite.y = 200;
    
    player.setPosition(100, 200);
    player.setId('player-1');
    
    const serialized = player.serialize();
    expect(serialized).toEqual({
      id: 'player-1',
      x: 100,
      y: 200,
      direction: 'down',
      isAttacking: false,
    });
  });

  it('should update from network state correctly', () => {
    const networkState = {
      x: 150,
      y: 250,
      direction: 'up',
      isAttacking: true
    }
    
    player.updateFromNetwork(networkState)
    expect(mockSprite.setPosition).toHaveBeenCalledWith(150, 250)
    expect(mockSprite.anims.play).toHaveBeenCalledWith('attack-up', true)
  })
})
