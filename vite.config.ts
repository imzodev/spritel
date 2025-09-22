import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,       // listen on 0.0.0.0 inside container
    port: 5173,       // fixed port mapped in docker-compose
    strictPort: true,
  },
})
