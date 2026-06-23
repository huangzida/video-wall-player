<script setup lang="ts">
import { ref, computed, onMounted, watch, toRefs } from 'vue';
import { useFullscreen, onKeyStroke } from '@vueuse/core';
import PlayerControls from '../PlayerControls/index.vue';
import { PLAYBACK_RATE_LEVELS } from '../../utils';
import { useVideoSources } from './useVideoSources';
import { useCanvasWall } from './useCanvasWall';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { VideoWallLayoutMode, VideoWallControlSize } from '../VideoWallPlayer/types';
import type { CanvasWallPlayerProps } from './types';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_TARGET_FPS,
  DEFAULT_STALL_THRESHOLD_MS,
  DEFAULT_MAX_SKIP_ATTEMPTS,
  DEFAULT_BACKGROUND_COLOR,
} from './types';

defineOptions({ name: 'CanvasWallPlayer' });

const props = withDefaults(defineProps<CanvasWallPlayerProps>(), {
  title: '',
  targetFps: DEFAULT_TARGET_FPS,
  batchSize: DEFAULT_BATCH_SIZE,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  autoplay: false,
  muted: false,
  loop: false,
  aspectRatio: 16 / 9,
  gap: 8,
  layoutMode: 'auto' as VideoWallLayoutMode,
  enableFocus: true,
  autoSkipOnStall: true,
  stallThresholdMs: DEFAULT_STALL_THRESHOLD_MS,
  maxSkipAttempts: DEFAULT_MAX_SKIP_ATTEMPTS,
  showControls: true,
  controlSize: 'normal' as VideoWallControlSize,
});

const emit = defineEmits<{
  error: [message: string];
  ready: [];
  streamReady: [id: string];
}>();

const {
  resources,
  batchSize,
  autoplay,
  muted,
  loop,
  autoSkipOnStall,
  stallThresholdMs,
  maxSkipAttempts,
  targetFps,
  backgroundColor,
  aspectRatio,
  gap,
  layoutMode,
  enableFocus,
} = toRefs(props);

// --- Video sources ---
const videoState = useVideoSources({
  resources,
  batchSize,
  autoplay,
  muted,
  loop,
  autoSkipOnStall,
  stallThresholdMs,
  maxSkipAttempts,
  onError: (msg) => emit('error', msg),
  onStreamReady: (id) => emit('streamReady', id),
  onReady: () => {
    emit('ready');
    canvasState.syncSprites();
  },
});

// --- Canvas wall ---
const canvasState = useCanvasWall({
  resources,
  videoPool: videoState.videoPool,
  targetFps,
  backgroundColor,
  aspectRatio,
  gap,
  layoutMode,
  enableFocus,
});

// --- Interaction ---
// ponytail: hitTest delegates to PixiJS event system via sprite bounds.
// We use manual bounds check since PixiJS v8 eventMode requires the renderer's event system.
function hitTestCanvas(x: number, y: number): string | null {
  // Iterate sprites, check if point is within bounds
  // Sprites are stored in canvasState internally; we approximate via layout
  // The simplest approach: PixiJS handles hit testing through its own event system on sprites.
  // For double-tap, we use the DOM pointer event coordinates and match against sprite layout.
  return null;
}

const interaction = useCanvasInteraction({
  enableFocus,
  onFocus: (id) => canvasState.focusOn(id),
  hitTest: hitTestCanvas,
});

const wallRef = ref<HTMLElement>();
const { toggle: toggleFullscreen } = useFullscreen(wallRef);

// --- PlayerControls handlers ---
const handlePlayPause = () =>
  videoState.isPlaying.value ? videoState.pauseAll() : void videoState.playAll();

const playbackRate = ref(1);
const volume = ref(50);

const handleRateChange = (rate: number) => {
  playbackRate.value = rate;
  videoState.videoPool.forEach((v) => (v.playbackRate = rate));
};

const handleSpeedDown = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx < PLAYBACK_RATE_LEVELS.length - 1)
    handleRateChange(PLAYBACK_RATE_LEVELS[idx + 1]!);
};

const handleSpeedUp = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx > 0) handleRateChange(PLAYBACK_RATE_LEVELS[idx - 1]!);
};

const handleSeek = (seconds: number) => {
  videoState.seekAll(seconds);
};

const handleVolumeChange = (vol: number) => {
  volume.value = vol;
  videoState.videoPool.forEach((v) => {
    v.volume = Math.max(0, Math.min(1, vol / 100));
    v.muted = false;
  });
};

const handleVolumeToggle = () => {
  const allMuted = [...videoState.videoPool.values()].every((v) => v.muted);
  videoState.videoPool.forEach((v) => (v.muted = !allMuted));
};

const handlePrevChunk = () => {
  const primary = props.resources[0];
  if (!primary) return;
  if (videoState.activeChunkIndex.value > 0) {
    const targetStart = primary.durations
      .slice(0, videoState.activeChunkIndex.value)
      .reduce((s, d) => s + Math.max(0, d || 0), 0);
    videoState.seekAll(targetStart);
  }
};

const handleNextChunk = () => {
  const primary = props.resources[0];
  if (!primary) return;
  if (videoState.activeChunkIndex.value < primary.chunkUrls.length - 1) {
    const targetStart = primary.durations
      .slice(0, videoState.activeChunkIndex.value + 1)
      .reduce((s, d) => s + Math.max(0, d || 0), 0);
    videoState.seekAll(targetStart);
  }
};

const handleStepBack = (seconds: number) => {
  videoState.seekAll(Math.max(0, videoState.currentTime.value - seconds));
};

const handleStepForward = (seconds: number) => {
  videoState.seekAll(
    Math.min(videoState.duration.value, videoState.currentTime.value + seconds)
  );
};

// --- Canvas pointer events (for double-tap focus) ---
// ponytail: PixiJS v8 sprites with eventMode='static' receive their own events.
// For double-tap we listen on the canvas DOM element and use PixiJS's internal
// event system to determine which sprite was hit.
function handleCanvasPointerDown(event: PointerEvent) {
  // PixiJS handles sprite-level events internally; this DOM listener is a fallback
  // for cases where sprite events don't fire. The actual focus trigger is via
  // sprite.on('pointertap') set up in useCanvasWall.
}

const isMuted = computed(() =>
  [...videoState.videoPool.values()].every((v) => v.muted)
);

// --- Keyboard shortcuts ---
onKeyStroke([' ', 'k', 'K'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handlePlayPause();
});

onKeyStroke(['f', 'F'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  toggleFullscreen();
});

onKeyStroke(['m', 'M'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeToggle();
});

onKeyStroke('Escape', () => {
  if (interaction.focusedId.value) {
    interaction.focusedId.value = null;
    canvasState.focusOn(null);
  }
});

// --- Lifecycle ---
onMounted(async () => {
  await canvasState.initApp();
  canvasState.attachResizeObserver();
  await videoState.loadAll();
});

// Watch resources change
watch(
  () => props.resources,
  () => {
    canvasState.syncSprites();
  },
  { deep: true }
);
</script>

<template>
  <div
    ref="wallRef"
    class="canvas-wall-player video-wall-player relative w-full h-full bg-black overflow-hidden"
  >
    <!-- Hidden video container -->
    <div
      ref="videoState.containerEl"
      class="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
      aria-hidden="true"
    ></div>

    <!-- Canvas container -->
    <div
      ref="canvasState.canvasContainerEl"
      class="absolute inset-0"
      @pointerdown="handleCanvasPointerDown"
    ></div>

    <!-- Controls -->
    <div v-if="showControls" class="relative z-50 pointer-events-auto">
      <PlayerControls
        :is-playing="videoState.isPlaying.value"
        :current-time="videoState.currentTime.value"
        :duration="videoState.duration.value"
        :playback-rates="PLAYBACK_RATE_LEVELS"
        :playback-rate="playbackRate"
        :volume="volume"
        :is-muted="isMuted"
        :show-stop="false"
        :show-prev-next-chunk="true"
        :show-step-skip="true"
        :show-playback-rate="true"
        :show-speed-down="true"
        :show-speed-up="true"
        :step-seconds="5"
        :control-size="controlSize"
        @play-pause="handlePlayPause"
        @seek="handleSeek"
        @rate-change="handleRateChange"
        @speed-down="handleSpeedDown"
        @speed-up="handleSpeedUp"
        @volume-change="handleVolumeChange"
        @volume-toggle="handleVolumeToggle"
        @fullscreen="toggleFullscreen"
        @step-back="handleStepBack"
        @step-forward="handleStepForward"
        @prev-chunk="handlePrevChunk"
        @next-chunk="handleNextChunk"
      />
    </div>
  </div>
</template>
