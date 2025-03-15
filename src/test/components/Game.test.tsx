import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import Game from '../../components/Game'
import GameScene from '../../scenes/GameScene'

// Define mock objects outside
const mockGameScene = {
  setVirtualControlDirection: vi.fn(),
  triggerVirtualAttack: vi.fn()
};

const mockGame = {
  scene: {
    getScene: vi.fn()
  },
  destroy: vi.fn()
};

// Mock Phaser at the top level
vi.mock('phaser', () => {
  class Scene {
    add: any;
    physics: any;
    input: any;
    cameras: any;
    anims: any;
    load: any;
    scene: any;

    constructor() {
      this.scene = { key: 'GameScene' };
      this.add = {
        sprite: vi.fn().mockReturnValue({
          setScale: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          play: vi.fn()
        })
      };
      this.physics = {
        add: {
          sprite: vi.fn().mockReturnValue({
            setVisible: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            body: { setSize: vi.fn() }
          })
        }
      };
      this.input = {
        keyboard: {
          createCursorKeys: vi.fn().mockReturnValue({}),
          addKey: vi.fn()
        }
      };
      this.cameras = {
        main: {
          startFollow: vi.fn(),
          setZoom: vi.fn()
        }
      };
      this.anims = {
        create: vi.fn(),
        generateFrameNumbers: vi.fn()
      };
      this.load = {
        spritesheet: vi.fn(),
        image: vi.fn()
      };
    }
  }

  const MockPhaser = {
    Game: vi.fn().mockImplementation(() => {
      return mockGame;
    }),
    Scene,
    AUTO: 'AUTO',
    Scale: {
      FIT: 'FIT',
      CENTER_BOTH: 'CENTER_BOTH',
    },
    Physics: {
      ARCADE: 'ARCADE',
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          SPACE: 32,
          LEFT: 37,
          UP: 38,
          RIGHT: 39,
          DOWN: 40
        }
      }
    }
  };
  return { default: MockPhaser };
});

describe('Game Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Reset mocks
    mockGame.scene.getScene.mockReset();
    mockGame.destroy.mockReset();
    mockGameScene.setVirtualControlDirection.mockReset();
    mockGameScene.triggerVirtualAttack.mockReset();
    
    // Setup mock game scene
    mockGame.scene.getScene.mockReturnValue(mockGameScene);
    
    // Mock requestAnimationFrame
    window.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as any).requestAnimationFrame;
  });

  it('should render game container', () => {
    render(<Game />)
    const container = screen.getByTestId('game-container')
    expect(container).toBeInTheDocument()
  });

  it('should initialize Phaser game with correct config', async () => {
    const { rerender } = render(<Game />);
    
    await act(async () => {
      vi.advanceTimersByTime(100);
      rerender(<Game />);
    });
    
    const mockPhaserModule = await import('phaser');
    expect(mockPhaserModule.default.Game).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AUTO',
        width: 768,
        height: 480,
        physics: {
          default: 'arcade',
          arcade: { gravity: { x: 0, y: 0 }, debug: true },
        },
        pixelArt: true,
        scale: {
          mode: 'FIT',
          autoCenter: 'CENTER_BOTH',
        },
        scene: GameScene
      })
    );
  });

  it('should cleanup game instance on unmount', async () => {
    const { unmount } = render(<Game />);
    
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    
    unmount();
    
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    
    expect(mockGame.destroy).toHaveBeenCalledWith(true);
  });

  it('should handle mobile control direction events', async () => {
    render(<Game />);
    
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    
    // Find the up button using its aria-label
    const upButton = screen.getByRole('button', { 
      name: 'Move Up'
    });
    
    await act(async () => {
      fireEvent.pointerDown(upButton);
    });

    expect(mockGameScene.setVirtualControlDirection).toHaveBeenCalledWith('up');

    await act(async () => {
      fireEvent.pointerUp(upButton);
    });

    expect(mockGameScene.setVirtualControlDirection).toHaveBeenCalledWith(null);
  });

  it('should handle mobile control attack events', async () => {
    render(<Game />);
    
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    
    // Find the attack button using its aria-label
    const attackButton = screen.getByRole('button', {
      name: 'Attack'
    });
    
    await act(async () => {
      fireEvent.pointerDown(attackButton);
    });

    expect(mockGameScene.triggerVirtualAttack).toHaveBeenCalled();
  });
});
