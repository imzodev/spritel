import { vi } from 'vitest';

// Test-controlled mock instances and helpers
export const mockGame = {
  scene: {
    getScene: vi.fn(),
  },
  destroy: vi.fn(),
};

export class MockScene {
  scene = { key: 'GameScene' };
  add = {
    sprite: vi.fn().mockReturnValue({
      setScale: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      play: vi.fn(),
      destroy: vi.fn(),
    }),
  };
  physics = {
    add: {
      sprite: vi.fn().mockReturnValue({
        setVisible: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setImmovable: vi.fn().mockReturnThis(),
        body: { setSize: vi.fn() },
        destroy: vi.fn(),
      }),
      collider: vi.fn(),
    },
    world: { removeCollider: vi.fn() },
  };
  load = { image: vi.fn(), spritesheet: vi.fn(), on: vi.fn() };
  cameras = { main: { startFollow: vi.fn(), setZoom: vi.fn() } };
  anims = { create: vi.fn(), generateFrameNumbers: vi.fn(), exists: vi.fn() } as any;
  textures = { exists: vi.fn(), list: [] as any[] };
  input = { keyboard: { createCursorKeys: vi.fn(), addKey: vi.fn() } } as any;
}

export const MockPhaser = {
  Game: vi.fn().mockImplementation(() => mockGame),
  Scene: MockScene,
  AUTO: 'AUTO',
  Scale: { RESIZE: 'RESIZE', FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
  Physics: { ARCADE: 'ARCADE', Arcade: { Sprite: class {}, Collider: class {} } },
  GameObjects: { Sprite: class {} },
  Geom: { Rectangle: { Overlaps: vi.fn().mockReturnValue(true) } },
  Types: { Input: { Keyboard: { CursorKeys: class {} } } },
  Input: { Keyboard: { KeyCodes: { SPACE: 32, E: 69 } } },
};

// Register the actual mock for the 'phaser' module
vi.mock('phaser', () => ({ default: MockPhaser }));

// Helper to control what getScene returns
export function setMockScene(scene: any) {
  mockGame.scene.getScene.mockReturnValue(scene);
}

export function resetPhaserMocks() {
  // Reset all vi.fn in exported structures
  mockGame.scene.getScene.mockReset();
  mockGame.destroy.mockReset();
  // Reset selected nested fns
  (MockPhaser.Game as any).mockClear?.();
}
