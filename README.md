# Spritel

A web-based game built with React, TypeScript, Vite, and Phaser. Features include:

- Pixel art graphics with smooth animations
- Mobile-friendly controls
- Tile-based map system with seamless transitions
- Physics-based movement and collisions

## Tech Stack

- React 19 with TypeScript
- Vite 6 for fast development and building
- Phaser 3 for game engine
- TailwindCSS for UI styling
- ESLint for code quality

## Development

First, install dependencies:

```bash
bun install
```

To start the development server:

```bash
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
- `/public` - Static assets
  - `/assets` - Game assets (maps, tilesets, etc.)

## License

[Add your license here]
