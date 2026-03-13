import { App } from 'vue';
import './styles/main.css';
import VideoWallPlayer from './components/VideoWallPlayer/index.vue';
import PlayerControls from './components/PlayerControls/index.vue';

export * from './components/VideoWallPlayer/types';
export { VideoWallPlayer, PlayerControls };

export default {
  install(app: App) {
    app.component('VideoWallPlayer', VideoWallPlayer);
    app.component('PlayerControls', PlayerControls);
  },
};
