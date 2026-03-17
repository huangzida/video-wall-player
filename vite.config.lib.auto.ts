import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/auto.ts'),
      name: 'VideoWallPlayerAuto',
      fileName: (format) => {
        if (format === 'es') return 'auto.mjs';
        return `auto.${format}.js`;
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core', 'lucide-vue-next'],
      output: {
        globals: {
          vue: 'Vue',
          '@vueuse/core': 'VueUse',
          'lucide-vue-next': 'LucideVue',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});

