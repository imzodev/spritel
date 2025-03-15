vi.mock('phaser', () => ({
  default: {
    Game: class {
      constructor() {}
    },
    Scene: class {
      constructor() {}
      add = { 
        sprite: vi.fn() 
      }
      physics = { 
        add: { 
          sprite: vi.fn() 
        } 
      }
    },
    AUTO: 'AUTO',
    Scale: {
      RESIZE: 'RESIZE',
      CENTER_BOTH: 'CENTER_BOTH'
    },
    Physics: {
      ARCADE: 'ARCADE'
    },
    Geom: {
      Rectangle: {
        Overlaps: vi.fn().mockReturnValue(true)
      }
    }
  }
}))