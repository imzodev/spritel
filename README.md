# Spritel

A web-based multiplayer game built with React, TypeScript, Vite, and Phaser. Features include:

- Real-time multiplayer with WebSocket communication
- Pixel art graphics with smooth animations
- Mobile-friendly controls
- Tile-based map system with seamless transitions
- Physics-based movement and collisions
- Player-to-player interactions and collision detection

## Tech Stack

- React 19 with TypeScript
- Vite 6 for fast development and building
- Phaser 3 for game engine
- WebSocket server with Bun runtime
- TailwindCSS for UI styling
- ESLint for code quality

## Development

First, install dependencies:

```bash
bun install
```

To start both the game client and WebSocket server:

```bash
bun run dev:all
```

Or run them separately:

```bash
# Start WebSocket server
bun run server

# Start development server
bun run dev
```

To build for production:

```bash
bun run build
```

To preview the production build:

```bash
bun run preview
```

## Network Architecture

The game uses a WebSocket server for real-time communication between players. Features include:

- Real-time player position synchronization
- Map transition coordination
- Player join/leave events
- Map-specific player interactions
- Physics-based collision detection

## ESLint Configuration

The project uses a modern ESLint setup with TypeScript support. To enable stricter type checking, update `eslint.config.js`:

```js
export default tseslint.config({
  extends: [
    ...tseslint.configs.recommendedTypeChecked,
    // For stricter rules:
    ...tseslint.configs.strictTypeChecked,
    // For style consistency:
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

For React-specific linting, you can add these plugins:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## Project Structure

- `/src` - Source code
  - `/components` - React components
  - `/assets` - Game assets
  - `/scenes` - Phaser game scenes
  - `/managers` - Game system managers (Network, Map, etc.)
  - `/entities` - Game entities (Player, etc.)
- `/server` - WebSocket server implementation
- `/public` - Static assets
  - `/assets` - Game assets (maps, tilesets, etc.)

## Contributing
TODO: There will be a point where we will be receiving many NPC collision detections from players, the server will be sending X amount
of updates, so we will need a way to handle collisions and synchronization of NPC positions more efficiently.

## License

[Add your license here]
