import { App } from 'vue';
import VideoWallPlayer from './components/VideoWallPlayer/index.vue';
import CanvasWallPlayer from './components/CanvasWallPlayer/index.vue';
import PlayerControls from './components/PlayerControls/index.vue';
import SegmentNav from './components/SegmentNav/index.vue';

// --- Core headless primitives (ADR-0001 v1.0: layered architecture) ---
// useMediaSync: element-level sync engine (works standalone for one <video>)
// useVideoWallState: pure wall state & segment math (shared by both players)
// useVideoWall: wall orchestration + hidden <video> pool (used by CanvasWallPlayer)
export { useMediaSync } from './core/useMediaSync';
export { useVideoWallState } from './core/useVideoWallState';
export { useVideoWall } from './core/useVideoWall';
export {
  normalizeResource,
  getSegmentStarts,
  sumDurations,
  locateByGlobalTime,
  clampDuration,
} from './core/media-math';

// --- Core types (canonical public type surface) ---
export type {
  MediaResource,
  MediaResourceInput,
  PlayerState,
  SegmentLocation,
  ControlSize,
  TimelineTag,
} from './core/types';

// --- Presentational + batteries components ---
export { VideoWallPlayer, CanvasWallPlayer, PlayerControls, SegmentNav };

// --- Wall-specific types (DOM player features: themes, layout modes) ---
export type { VideoWallTheme, VideoWallLayoutMode } from './components/VideoWallPlayer/types';

export default {
  install(app: App) {
    app.component('VideoWallPlayer', VideoWallPlayer);
    app.component('CanvasWallPlayer', CanvasWallPlayer);
    app.component('PlayerControls', PlayerControls);
    app.component('SegmentNav', SegmentNav);
  },
};
