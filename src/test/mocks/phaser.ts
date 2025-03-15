import { vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Game: class {
      constructor() {}
      scene: any = {
        getScene: vi.fn(),
      };
      destroy = vi.fn();
    },
    Scene: class {
      constructor() {}
      scene = { key: 'GameScene' }; // Fixed: scene property with key
      add = {
        sprite: vi.fn().mockReturnValue({
          setScale: vi.fn(),
          setDepth: vi.fn(),
          play: vi.fn(),
          destroy: vi.fn(),
        }),
      };
      physics = {
        add: {
          sprite: vi.fn().mockReturnValue({
            setVisible: vi.fn(),
            setScale: vi.fn(),
            setImmovable: vi.fn(),
            body: {
              setSize: vi.fn(),
            },
            destroy: vi.fn(),
          }),
          collider: vi.fn(),
        },
        world: {
          removeCollider: vi.fn(),
        },
      };
      load = {
        image: vi.fn(),
        spritesheet: vi.fn(),
        on: vi.fn(),
      };
      cameras = {
        main: {
          startFollow: vi.fn(),
          setZoom: vi.fn(),
        },
      };
      anims = {
        create: vi.fn(),
        generateFrameNumbers: vi.fn(),
      };
      textures = {
        exists: vi.fn(),
        list: [],
      };
    },
    AUTO: 'AUTO',
    Scale: {
      RESIZE: 'RESIZE',
      CENTER_BOTH: 'CENTER_BOTH',
    },
    Physics: {
      ARCADE: 'ARCADE',
      Arcade: {
        Sprite: class {},
        Collider: class {},
      },
    },
    GameObjects: {
      Sprite: class {},
    },
    Geom: {
      Rectangle: {
        Overlaps: vi.fn().mockReturnValue(true),
      },
    },
    Types: {
      Input: {
        Keyboard: {
          CursorKeys: class {},
        },
      },
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          SPACE: 32,
        },
      },
    },
  },
}));
