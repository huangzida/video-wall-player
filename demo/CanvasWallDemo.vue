<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { CanvasWallPlayer } from '../src/index';
import type { VideoWallLayoutMode, VideoWallControlSize } from '../src/components/VideoWallPlayer/types';

const testUrl = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const testDuration = 52;

const videoCount = useStorage('canvas-demo-video-count', 8);
const targetFps = useStorage('canvas-demo-target-fps', 15);
const batchSize = useStorage('canvas-demo-batch-size', 4);
const autoplay = useStorage('canvas-demo-autoplay', true);
const muted = useStorage('canvas-demo-muted', true);
const loop = useStorage('canvas-demo-loop', true);
const gap = useStorage('canvas-demo-gap', 8);
const aspectRatio = useStorage('canvas-demo-aspect-ratio', 16 / 9);
const controlSize = useStorage<VideoWallControlSize>('canvas-demo-control-size', 'normal');
const layoutMode = useStorage<VideoWallLayoutMode>('canvas-demo-layout-mode', 'auto');
const enableFocus = useStorage('canvas-demo-enable-focus', true);
const autoSkipOnStall = useStorage('canvas-demo-auto-skip-on-stall', true);
const stallThresholdMs = useStorage('canvas-demo-stall-threshold-ms', 500);
const maxSkipAttempts = useStorage('canvas-demo-max-skip-attempts', 10);

const resources = computed(() => {
  return Array.from({ length: videoCount.value }, (_, i) => ({
    id: `res-${i + 1}`,
    name: `Stream ${i + 1}`,
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
  }));
});
</script>

<template>
  <div class="h-screen w-full flex flex-col">
    <div class="flex-1 min-h-0">
      <CanvasWallPlayer
        :resources="resources"
        title="Canvas Wall Demo"
        :target-fps="targetFps"
        :batch-size="batchSize"
        :autoplay="autoplay"
        :muted="muted"
        :loop="loop"
        :gap="gap"
        :aspect-ratio="aspectRatio"
        :control-size="controlSize"
        :layout-mode="layoutMode"
        :enable-focus="enableFocus"
        :auto-skip-on-stall="autoSkipOnStall"
        :stall-threshold-ms="stallThresholdMs"
        :max-skip-attempts="maxSkipAttempts"
        @error="console.error"
        @ready="console.log('[CanvasWall] All streams ready')"
        @stream-ready="(id) => console.log('[CanvasWall] Stream ready:', id)"
      />
    </div>

    <!-- Settings panel -->
    <div class="absolute top-2 right-2 z-[100] bg-black/80 text-white text-xs p-3 rounded-lg backdrop-blur-sm border border-white/10 space-y-2 w-56">
      <div class="font-bold text-sm mb-2">CanvasWall Settings</div>
      <label class="flex items-center justify-between gap-2">
        <span>Video Count</span>
        <input v-model.number="videoCount" type="number" min="1" max="30" class="w-16 bg-white/10 rounded px-1 py-0.5" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>Target FPS</span>
        <input v-model.number="targetFps" type="number" min="1" max="60" class="w-16 bg-white/10 rounded px-1 py-0.5" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>Batch Size</span>
        <input v-model.number="batchSize" type="number" min="1" max="10" class="w-16 bg-white/10 rounded px-1 py-0.5" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>Gap</span>
        <input v-model.number="gap" type="number" min="0" max="40" class="w-16 bg-white/10 rounded px-1 py-0.5" />
      </label>
      <label class="flex items-center gap-2">
        <input v-model="autoplay" type="checkbox" />
        <span>Autoplay</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="muted" type="checkbox" />
        <span>Muted</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="loop" type="checkbox" />
        <span>Loop</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="enableFocus" type="checkbox" />
        <span>Double-tap Focus</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="autoSkipOnStall" type="checkbox" />
        <span>Auto Skip on Stall</span>
      </label>
    </div>
  </div>
</template>
