import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    vue(),
    cssInjectedByJsPlugin(),
    dts({
      tsconfigPath: './tsconfig.json',
      outDir: 'dist/types',
      cleanVueFileName: true,
      exclude: ['src/test/**']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VideoWallPlayer',
      fileName: (format) => {
        if (format === 'es') return 'index.mjs';
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
