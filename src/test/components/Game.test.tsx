import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import Game from '../../components/Game'
import GameScene from '../../scenes/GameScene'
import { setMockScene, mockGame } from '../mocks/phaser'

// Define mock objects outside
const mockGameScene = {
  setVirtualControlDirection: vi.fn(),
  triggerVirtualAttack: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

// Using shared mockGame from ../mocks/phaser

// Using shared Phaser mock from setup.ts (src/test/mocks/phaser.ts)

describe('Game Component', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    
    // Reset mocks
    mockGame.scene.getScene.mockReset();
    mockGame.destroy.mockReset();
    mockGameScene.setVirtualControlDirection.mockReset();
    mockGameScene.triggerVirtualAttack.mockReset();
    
    // Setup mock game scene
    setMockScene(mockGameScene);
    
    // Mock requestAnimationFrame with proper typing
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
      const id = setTimeout(() => cb(0), 0) as unknown as number
      return id
    })
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
