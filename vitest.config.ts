import { defineConfig } from 'vitest/config';

// ponytail: minimal vitest config. Needed because vite.config.ts sets
// root: './demo', which would otherwise point vitest at the demo dir for test
// discovery. Keep the lib root at the project root and include only src tests.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
