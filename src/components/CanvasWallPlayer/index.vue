<script setup lang="ts">
import { ref, onMounted, watch, toRefs, nextTick } from 'vue';
import { useFullscreen, onKeyStroke } from '@vueuse/core';
import { Play } from 'lucide-vue-next';
import PlayerControls from '../PlayerControls/index.vue';
import SegmentNav from '../SegmentNav/index.vue';
import { PLAYBACK_RATE_LEVELS } from '../../utils';
import { useVideoWall } from '../../core/useVideoWall';
import { useCanvasWall } from './useCanvasWall';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { VideoWallLayoutMode } from '../VideoWallPlayer/types';
import type { ControlSize } from '../../core/types';
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
  controlSize: 'normal' as ControlSize,
  useTextureMode: false,
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
  useTextureMode,
} = toRefs(props);

// --- Wall engine (composes useMediaSync internally; ADR-0001 Slice 1) ---
// ponytail: pass SCALAR options unwrapped (props.X) — useVideoWall/useMediaSync
// expect plain values, not Refs. `resources` stays a Ref (useVideoWallState handles
// isRef). TODO v1.0: make these options MaybeRef so consumers can pass refs reactively.
const wall = useVideoWall({
  resources,
  batchSize: props.batchSize,
  autoplay: props.autoplay,
  muted: props.muted,
  loop: props.loop,
  autoSkipOnStall: props.autoSkipOnStall,
  stallThresholdMs: props.stallThresholdMs,
  maxSkipAttempts: props.maxSkipAttempts,
  onError: (msg) => emit('error', msg),
  onStreamReady: (id) => emit('streamReady', id),
  onReady: () => {
    emit('ready');
    canvasState.syncSprites();
  },
});

// --- Canvas wall (renders the pool via PixiJS) ---
const canvasState = useCanvasWall({
  resources,
  videoPool: wall.videoPool,
  targetFps,
  backgroundColor,
  aspectRatio,
  gap,
  layoutMode,
  enableFocus,
  useTextureMode,
});

// --- Interaction (double-tap focus) ---
const interaction = useCanvasInteraction({
  enableFocus,
  onFocus: (id) => canvasState.focusOn(id),
  hitTest: (x, y) => canvasState.hitTest(x, y),
});

const wallRef = ref<HTMLElement>();
const { toggle: toggleFullscreen } = useFullscreen(wallRef);

// --- PlayerControls handlers (delegate to wall) ---
const handlePlayPause = () =>
  wall.state.value.isPlaying ? wall.pause() : void wall.play();

const handleRateChange = (rate: number) => wall.setRate(rate);

const handleSpeedDown = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(wall.state.value.playbackRate);
  if (idx < PLAYBACK_RATE_LEVELS.length - 1)
    handleRateChange(PLAYBACK_RATE_LEVELS[idx + 1]!);
};

const handleSpeedUp = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(wall.state.value.playbackRate);
  if (idx > 0) handleRateChange(PLAYBACK_RATE_LEVELS[idx - 1]!);
};

const handleSeek = (seconds: number) => {
  void wall.seek(seconds);
};

const handleVolumeChange = (vol: number) => {
  wall.setVolumeAll(vol);
  wall.setMutedAll(false);
};

const handleVolumeToggle = () => {
  wall.setMutedAll(!wall.state.value.muted);
};

// --- SegmentNav (chunk nav, slotted into PlayerControls affixes) ---
const handlePrevChunk = () => {
  if (wall.activeChunkIndex.value > 0) {
    void wall.switchChunk(
      wall.activeChunkIndex.value - 1,
      0,
      wall.state.value.isPlaying,
    );
  }
};

const handleNextChunk = () => {
  if (wall.activeChunkIndex.value < wall.segmentCount.value - 1) {
    void wall.switchChunk(
      wall.activeChunkIndex.value + 1,
      0,
      wall.state.value.isPlaying,
    );
  }
};

const handleStepBack = (seconds: number) => {
  void wall.seek(Math.max(0, wall.state.value.currentTime - seconds));
};

const handleStepForward = (seconds: number) => {
  void wall.seek(
    Math.min(wall.state.value.duration, wall.state.value.currentTime + seconds),
  );
};

// --- Canvas pointer events (double-tap focus hit testing) ---
function handleCanvasPointerDown(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  interaction.handlePointerDown(x, y);
}

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

onKeyStroke('[', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handlePrevChunk();
});

onKeyStroke(']', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleNextChunk();
});

onKeyStroke(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  const idx = parseInt(e.key) - 1;
  const item = props.resources[idx];
  // ponytail: MediaResourceInput includes string shorthand (no id); skip those.
  // Object shapes both carry `.id` from MediaResourceObjectBase.
  if (item && typeof item !== 'string') {
    interaction.focusedId.value = item.id;
    canvasState.focusOn(item.id);
  }
});

onKeyStroke('0', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  interaction.focusedId.value = null;
  canvasState.focusOn(null);
});

onKeyStroke('ArrowLeft', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  // ponytail: Canvas has no stepSeconds prop — hardcode DOM's default (5s)
  handleStepBack(5);
});

onKeyStroke('ArrowRight', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleStepForward(5);
});

onKeyStroke('ArrowUp', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeChange(Math.min(100, wall.state.value.volume + 10));
});

onKeyStroke('ArrowDown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeChange(Math.max(0, wall.state.value.volume - 10));
});

// --- Lifecycle ---
onMounted(async () => {
  // Wait for DOM to have real dimensions
  await nextTick();
  await canvasState.initApp();
  canvasState.attachResizeObserver();
  // Force layout after init
  canvasState.layoutSprites();
  await wall.loadAll();
  // Layout again after videos are ready and sprites created
  canvasState.layoutSprites();
});

// Watch resources change — canvas needs to resync sprites; useVideoWall
// reconciles the pool itself via its own watch.
watch(
  () => props.resources,
  () => {
    canvasState.syncSprites();
  },
  { deep: true },
);
</script>

<template>
  <div
    ref="wallRef"
    class="canvas-wall-player video-wall-player absolute inset-0 overflow-hidden bg-black"
  >
    <!-- Hidden video container (useVideoWall appends pooled <video> here) -->
    <div
      :ref="(el) => { wall.containerEl.value = el as HTMLElement | null }"
      class="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
      aria-hidden="true"
    ></div>

    <!-- Canvas container — bottom padding to avoid control bar overlap -->
    <div
      :ref="(el) => { canvasState.canvasContainerEl.value = el as HTMLElement | null }"
      class="absolute top-0 left-0 right-0"
      :style="{ bottom: showControls ? '48px' : '0' }"
      @pointerdown="handleCanvasPointerDown"
    ></div>

    <!-- Play-button overlay: shown when not playing. Covers the black paused
         canvas with a clear "click to play" affordance. Pure DOM — reliable,
         unlike the flaky force-first-frame approach. Canvas black is fine underneath. -->
    <div
      v-if="!wall.state.value.isPlaying"
      class="absolute top-0 left-0 right-0 z-40 flex items-center justify-center cursor-pointer"
      :style="{ bottom: showControls ? '48px' : '0' }"
      @click="wall.play()"
    >
      <div class="flex items-center justify-center w-20 h-20 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm hover:bg-black/80 hover:scale-110 transition-all shadow-lg">
        <Play class="w-9 h-9 text-white fill-current ml-1" />
      </div>
    </div>

    <!-- Controls -->
    <div v-if="showControls" class="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
      <PlayerControls
        :is-playing="wall.state.value.isPlaying"
        :current-time="wall.state.value.currentTime"
        :duration="wall.state.value.duration"
        :playback-rates="PLAYBACK_RATE_LEVELS"
        :playback-rate="wall.state.value.playbackRate"
        :volume="wall.state.value.volume"
        :muted="wall.state.value.muted"
        :show-stop="false"
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
      >
        <template #leftAffix>
          <SegmentNav
            direction="prev"
            :disabled="wall.activeChunkIndex.value <= 0"
            :control-size="controlSize"
            @activate="handlePrevChunk"
          />
        </template>
        <template #rightAffix>
          <SegmentNav
            direction="next"
            :disabled="wall.activeChunkIndex.value >= wall.segmentCount.value - 1"
            :control-size="controlSize"
            @activate="handleNextChunk"
          />
        </template>
      </PlayerControls>
    </div>
  </div>
</template>
