declare module '../dist/index.mjs' {
  import type { App } from 'vue';
  import VideoWallPlayer from '../dist/types/components/VideoWallPlayer/index';
  import PlayerControls from '../dist/types/components/PlayerControls/index';

  export * from '../dist/types/components/VideoWallPlayer/types';
  export { VideoWallPlayer, PlayerControls };

  const _default: {
    install(app: App): void;
  };
  export default _default;
}

