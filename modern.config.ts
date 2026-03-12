import { moduleTools, defineConfig } from '@modern-js/module-tools';
import { vuePlugin } from '@modern-js/plugin-vue';
import { tailwindcssPlugin } from '@modern-js/plugin-tailwindcss';

export default defineConfig({
  plugins: [moduleTools(), vuePlugin(), tailwindcssPlugin()],
  buildConfig: [
    {
      buildType: 'bundleless',
      format: 'esm',
      target: 'es2020',
      outDir: './dist/es',
      dts: {
        distPath: '../types'
      }
    },
    {
      buildType: 'bundleless',
      format: 'cjs',
      target: 'es2020',
      outDir: './dist/lib'
    }
  ]
});
