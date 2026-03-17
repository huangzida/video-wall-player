import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.json',
      outDir: 'dist/types',
      cleanVueFileName: true,
      exclude: ['src/test/**']
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        style: resolve(__dirname, 'src/style.ts'),
      },
      name: 'VideoWallPlayer',
      fileName: (format) => {
        if (format === 'es') return '[name].mjs';
        return `index.${format}.js`;
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core', 'lucide-vue-next'],
      output: {
        globals: {
          vue: 'Vue',
          '@vueuse/core': 'VueUse',
          'lucide-vue-next': 'LucideVue'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});
