import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import api from './src/server/api.js';

function netflexApiPlugin(): Plugin {
  return {
    name: 'netflex-api',
    configureServer(server) {
      server.middlewares.use(api);
    },
  };
}

export default defineConfig({
  plugins: [react(), netflexApiPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});
