import { resolve } from 'path';
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
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VideoWallPlayer',
      fileName: (format) => {
        if (format === 'es') return 'es/index.js';
        if (format === 'cjs') return 'lib/index.js';
        return `index.${format}.js`;
      },
      formats: ['es', 'cjs']
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
