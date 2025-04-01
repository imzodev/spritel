# Spritel

A web-based multiplayer game built with React, TypeScript, Vite, and Phaser. Features include:

- Real-time multiplayer with WebSocket communication
- Pixel art graphics with smooth animations
- Mobile-friendly controls
- Tile-based map system with seamless transitions
- Physics-based movement and collisions
- Player-to-player interactions and collision detection
- AI-powered NPC conversations using OpenAI/DeepSeek API

## Tech Stack

- React 19 with TypeScript
- Vite 6 for fast development and building
- Phaser 3 for game engine
- WebSocket server with Bun runtime
- TailwindCSS for UI styling
- ESLint for code quality
- OpenAI/DeepSeek API for intelligent NPC conversations

## Development

First, install dependencies:

```bash
bun install
```

To enable AI-powered NPC conversations, create a `.env` file in the project root based on the `.env.example` file and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
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
  - `/services` - Game services (NPCAIService, OpenAIService, etc.)
  - `/config` - Configuration files
  - `/data` - Game data (NPC personalities, etc.)
- `/server` - WebSocket server implementation
- `/public` - Static assets
  - `/assets` - Game assets (maps, tilesets, etc.)

## Contributing
TODO: There will be a point where we will be receiving many NPC collision detections from players, the server will be sending X amount
of updates, so we will need a way to handle collisions and synchronization of NPC positions more efficiently.

## NPC System

### Edge Detection
The NPC edge detection system has been implemented with the following key features:

1. The `handleEdgeOfMap` function detects when an NPC reaches a map edge and stops movement
2. The `pushAwayFromEdge` function moves the NPC 1 pixel away from the edge when it receives new movement instructions
3. Edge detection notifications are sent to the server when an NPC reaches a map edge
4. The server responds with new movement instructions

The implementation avoids repositioning NPCs too far from edges (just 1 pixel) to maintain a natural appearance while preventing them from getting stuck in movement loops.

### AI Conversations
NPCs are powered by OpenAI's API to provide dynamic and contextual conversations:

1. Each NPC has a defined personality and role (merchant, innkeeper, blacksmith, etc.)
2. Conversations maintain context and memory of previous interactions
3. NPCs respond based on game context (time of day, weather, player level, etc.)
4. Fallback responses are provided when the API is unavailable

## License

[Add your license here]
