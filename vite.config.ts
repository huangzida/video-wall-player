import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

export default defineConfig({
  plugins: [vue(), basicSsl()],
  root: './demo',
  base: '/video-wall-player/',
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    https: true,
    fs: {
      allow: ['..'],
    },
  },
});
