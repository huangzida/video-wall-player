<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { CanvasWallPlayer } from '../src/index';
import type { VideoWallLayoutMode, VideoWallControlSize } from '../src/components/VideoWallPlayer/types';

// ponytail: use local test.mp4 for reliable testing without network dependency
const testUrl = './test.mp4';
const testDuration = 30;

const videoCount = useStorage('canvas-demo-video-count', 20);
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
    chunkUrls: [testUrl],
    durations: [testDuration],
  }));
});
</script>

<template>
  <div class="canvas-wall-demo-root" style="position: fixed; inset: 0; background: #000;">
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
      @stream-ready="(id: string) => console.log('[CanvasWall] Stream ready:', id)"
    />

    <!-- Settings panel -->
    <div style="position: absolute; top: 8px; right: 8px; z-index: 100; background: rgba(0,0,0,0.85); color: #fff; font-size: 12px; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: 200px; max-height: 80vh; overflow-y: auto;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">CanvasWall Settings</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span>Video Count</span>
        <input v-model.number="videoCount" type="number" min="1" max="30" style="width: 60px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 4px; padding: 2px 4px;" />
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span>Target FPS</span>
        <input v-model.number="targetFps" type="number" min="1" max="60" style="width: 60px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 4px; padding: 2px 4px;" />
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span>Batch Size</span>
        <input v-model.number="batchSize" type="number" min="1" max="10" style="width: 60px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 4px; padding: 2px 4px;" />
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span>Gap</span>
        <input v-model.number="gap" type="number" min="0" max="40" style="width: 60px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 4px; padding: 2px 4px;" />
      </div>
      <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;">
        <input v-model="autoplay" type="checkbox" />
        <span>Autoplay</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;">
        <input v-model="muted" type="checkbox" />
        <span>Muted</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;">
        <input v-model="loop" type="checkbox" />
        <span>Loop</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;">
        <input v-model="enableFocus" type="checkbox" />
        <span>Double-tap Focus</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input v-model="autoSkipOnStall" type="checkbox" />
        <span>Auto Skip on Stall</span>
      </label>
    </div>
  </div>
</template>
