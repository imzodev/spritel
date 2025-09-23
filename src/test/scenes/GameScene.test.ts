import { describe, it, expect, beforeEach, vi } from 'vitest'
import GameScene from '../../scenes/GameScene'
import { Player } from '../../entities/Player'
import { MapManager } from '../../managers/MapManager'
import { NetworkManager } from '../../managers/NetworkManager'
import { NPCManager } from '../../managers/NPCManager'; // Import the class
import Phaser from 'phaser'

// Mock dependencies
vi.mock('../../entities/Player')
vi.mock('../../managers/MapManager')
vi.mock('../../managers/NetworkManager')
vi.mock('../../managers/NPCManager')

describe('GameScene', () => {
    let gameScene: GameScene
    let mockPlayer: any
    let mockMapManager: any
    let mockNetworkManager: any
    let mockCollisionLayer: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPlayer = {
            getSprite: vi.fn().mockReturnValue({
                x: 100,
                y: 100,
                body: {
                    setSize: vi.fn(),
                },
            }),
            update: vi.fn(),
            getId: vi.fn(),
            setId: vi.fn(),
        }
        
        mockMapManager = {
            loadMap: vi.fn(),
            checkMapTransition: vi.fn(),
            getCurrentMap: vi.fn().mockReturnValue({
                key: 'map_0_0'
            }),
            getCurrentPosition: vi.fn().mockReturnValue({ x: 0, y: 0 })
        }

        mockNetworkManager = {
            updatePlayerState: vi.fn(),
            on: vi.fn(),
        }

        mockCollisionLayer = {
            tilemap: {},
            setCollisionByExclusion: vi.fn(),
        }

        gameScene = new GameScene()
        ;(gameScene as any).player = mockPlayer
        ;(gameScene as any).mapManager = mockMapManager
        ;(gameScene as any).networkManager = mockNetworkManager
        ;(gameScene as any).collisionLayer = mockCollisionLayer
        ;(gameScene as any).playerCollider = { destroy: vi.fn() }
    })

    describe('Initialization', () => {
        it('should initialize with correct scene key', () => {
            expect(gameScene.scene.key).toBe('GameScene')
        })

        it('should initialize map manager with correct config', () => {
            gameScene.preload()
            expect(MapManager).toHaveBeenCalledWith(gameScene, {
                mapWidth: 24,
                mapHeight: 15,
                tileSize: 16,
                transitionThreshold: 5
            })
        })

        it('should load required assets', () => {
            gameScene.preload()
            expect(gameScene.load.image).toHaveBeenCalledWith('beginnertileset', '/assets/beginnertileset.png')
            expect(gameScene.load.image).toHaveBeenCalledWith('1_terrain', '/assets/1_terrain.png')
            expect(gameScene.load.image).toHaveBeenCalledWith('3_plants', '/assets/3_plants.png')
            expect(gameScene.load.image).toHaveBeenCalledWith('4_buildings', '/assets/4_buildings.png')
            expect(gameScene.load.image).toHaveBeenCalledWith('11_roofs', '/assets/11_roofs.png')
            expect(gameScene.load.spritesheet).toHaveBeenCalledWith('player', '/assets/player.png', {
                frameWidth: 64,
                frameHeight: 64
            })
        })
    })

    describe('Collision Management', () => {
        it('should set up collision layer correctly', () => {
            const mockLayer = {
                tilemap: {},
                setCollisionByExclusion: vi.fn()
            }

            gameScene.setCollisionLayer(mockLayer as any)

            expect(mockLayer.setCollisionByExclusion).toHaveBeenCalledWith([-1, 0])
            expect((gameScene as any).physics.add.collider).toHaveBeenCalled()
        })

        it('should handle null collision layer', () => {
            gameScene.setCollisionLayer(null)
            expect(gameScene['playerCollider']).toBeNull()
            expect(gameScene['collisionLayer']).toBeNull()
        })

        it('should handle invalid collision layer', () => {
            const mockLayer = {
                setCollisionByExclusion: vi.fn()
            }

            gameScene.setCollisionLayer(mockLayer as any)
            expect((gameScene as any).physics.add.collider).not.toHaveBeenCalled()
        })
    })

    describe('Map Transitions', () => {
        it('should handle start of map transition', () => {
            const mockOtherPlayer = {
                destroy: vi.fn()
            }
            ;(gameScene as any).otherPlayers = new Map([['player1', mockOtherPlayer]])
            ;(gameScene as any).otherPlayersPhysics = new Map([['player1', mockOtherPlayer]])

            gameScene.startMapTransition()

            expect(gameScene['isTransitioning']).toBe(true)
            expect(mockOtherPlayer.destroy).toHaveBeenCalled()
            expect(gameScene['otherPlayers'].size).toBe(0)
            expect(gameScene['otherPlayersPhysics'].size).toBe(0)
        })

        it('should handle end of map transition', () => {
            gameScene['collisionLayer'] = mockCollisionLayer
            gameScene.endMapTransition()
            
            expect(gameScene['isTransitioning']).toBe(false)
            expect(mockNetworkManager.updatePlayerState).toHaveBeenCalledWith(mockPlayer)
        })
    })

    describe('Virtual Controls', () => {
        it('should handle virtual direction control', () => {
            gameScene.setVirtualControlDirection('up')
            expect(gameScene['virtualDirection']).toBe('up')
        })

        it('should handle virtual attack control', () => {
            gameScene.triggerVirtualAttack()
            expect(gameScene['virtualAttackTriggered']).toBe(true)
        })
    })

    describe('Update Loop', () => {
        beforeEach(() => {
            
            gameScene['isTransitioning'] = false;
            gameScene['cursors'] = {
                left: { isDown: false },
                right: { isDown: false },
                up: { isDown: false },
                down: { isDown: false }
            };
            gameScene['attackKey'] = { isDown: false };
            gameScene['interactKey'] = { isDown: false };
            gameScene['virtualDirection'] = null;
            gameScene['virtualAttackTriggered'] = false;
            gameScene['isAttacking'] = false;
        });
    
        afterEach(() => {
            vi.clearAllMocks();
        });
    
        it('should not update when player is not initialized', () => {
            ;(gameScene as any).player = null;
            gameScene.update(0, 0);
            expect(mockMapManager.checkMapTransition).not.toHaveBeenCalled();
        });
    
        it('should not update during transition', () => {
            ;(gameScene as any).isTransitioning = true;
            gameScene.update(0, 0);
            expect(mockPlayer.update).not.toHaveBeenCalled();
        });
    
        it('should update player and check map transition during normal gameplay', () => {
            // Ensure Phaser.Input.Keyboard.JustDown exists and returns false
            const mockJustDown = vi.fn().mockReturnValue(false);
            Phaser.Input.Keyboard.JustDown = mockJustDown;
            
            // Run update
            gameScene.update(0, 0);
    
            // Verify expected behavior
            expect(mockPlayer.update).toHaveBeenCalledWith({ x: 0, y: 0 }, false);
            expect(mockMapManager.checkMapTransition).toHaveBeenCalledWith(mockPlayer.getSprite());
            expect(mockJustDown).toHaveBeenCalledWith(gameScene['interactKey']);
        });
    })

    describe('Network Player Management', () => {
        it('should handle player updates from network', () => {
            const playerData = {
                id: 'player1',
                mapPosition: { x: 0, y: 0 },
                x: 100,
                y: 100,
                animation: 'idle-down',
            }

            gameScene['handlePlayerUpdate'](playerData, 'network')
            
            expect(mockMapManager.getCurrentPosition).toHaveBeenCalled()
            expect(gameScene['otherPlayers'].has('player1')).toBe(true)
        })

        it('should return other players data correctly', () => {
            const mockSprite = {
                x: 100,
                y: 100,
                anims: { currentAnim: { key: 'idle-down' } }
            }
            ;(gameScene as any).otherPlayers = new Map([['player1', mockSprite]])

            const data = gameScene.getOtherPlayersData()
            
            expect(data).toHaveLength(1)
            expect(data[0]).toEqual({
                id: 'player1',
                x: 100,
                y: 100,
                animation: 'idle-down'
            })
        })
    })
})
