import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Player } from '../../entities/Player'

describe('Player', () => {
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
})