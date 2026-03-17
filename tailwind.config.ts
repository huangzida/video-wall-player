import type { Config } from 'tailwindcss';

const config: Config = {
  important: '.video-wall-player',
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}', './demo/**/*.{vue,js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
