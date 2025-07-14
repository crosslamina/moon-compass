import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  optimizeDeps: {
    include: ['astronomia'],
  },
  resolve: {
    alias: {
      'astronomia/moon': path.resolve(__dirname, 'node_modules/astronomia/lib/moon.cjs'),
      'astronomia/observer': path.resolve(__dirname, 'node_modules/astronomia/lib/observer.cjs'),
      'astronomia/search': path.resolve(__dirname, 'node_modules/astronomia/lib/search.cjs'),
      'astronomia/julian': path.resolve(__dirname, 'node_modules/astronomia/lib/julian.cjs'),
    },
  },
});
