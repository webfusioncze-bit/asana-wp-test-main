import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'assets/build',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'assets/src/main.tsx'),
      name: 'AsanaTaskManager',
      formats: ['iife'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'main.css';
          return assetInfo.name || '';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'assets/src'),
    },
  },
});
