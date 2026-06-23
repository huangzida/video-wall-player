import { App } from 'vue';
import VideoWallPlayer from './components/VideoWallPlayer/index.vue';
import PlayerControls from './components/PlayerControls/index.vue';
import CanvasWallPlayer from './components/CanvasWallPlayer/index.vue';

export * from './components/VideoWallPlayer/types';
export * from './components/CanvasWallPlayer/types';
export { VideoWallPlayer, PlayerControls, CanvasWallPlayer };

export default {
  install(app: App) {
    app.component('VideoWallPlayer', VideoWallPlayer);
    app.component('PlayerControls', PlayerControls);
    app.component('CanvasWallPlayer', CanvasWallPlayer);
  },
};
