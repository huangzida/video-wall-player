import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// Copy demo video files to dist-pages during build
function copyDemoVideos() {
  return {
    name: 'copy-demo-videos',
    writeBundle() {
      const demoDir = path.resolve(__dirname, 'demo');
      const outDir = path.resolve(__dirname, 'dist-pages');
      const files = fs.readdirSync(demoDir).filter(f => f.endsWith('.mp4'));
      for (const f of files) {
        fs.copyFileSync(path.join(demoDir, f), path.join(outDir, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [vue(), basicSsl(), copyDemoVideos()],
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
