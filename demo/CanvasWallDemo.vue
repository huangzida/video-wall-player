<script setup lang="ts">
import { computed } from 'vue';
import { CanvasWallPlayer } from '../src/index';
import {
  canvasVideoCount as videoCount,
  canvasTargetFps as targetFps,
  canvasBatchSize as batchSize,
  canvasAutoplay as autoplay,
  canvasMuted as muted,
  canvasLoop as loop,
  canvasGap as gap,
  canvasAspectRatio as aspectRatio,
  canvasControlSize as controlSize,
  canvasLayoutMode as layoutMode,
  canvasEnableFocus as enableFocus,
  canvasAutoSkipOnStall as autoSkipOnStall,
  canvasStallThresholdMs as stallThresholdMs,
  canvasMaxSkipAttempts as maxSkipAttempts,
  canvasUseTextureMode as useTextureMode,
} from './canvasSettings';

// ponytail: use local test.mp4 for reliable testing without network dependency.
// Multiple copies (test.mp4, test2.mp4, ...) reduce browser cache lock contention
// when 20 streams request the same URL simultaneously.
const testUrl = './test.mp4';
const testDuration = 90; // actual duration of test.mp4 in seconds

// ponytail: rotate among 20 test files — each stream gets its own file,
// eliminating browser cache lock contention entirely.
const testUrls = [
  './test.mp4', './test2.mp4', './test3.mp4', './test4.mp4', './test5.mp4',
  './test6.mp4', './test7.mp4', './test8.mp4', './test9.mp4', './test10.mp4',
  './test11.mp4', './test12.mp4', './test13.mp4', './test14.mp4', './test15.mp4',
  './test16.mp4', './test17.mp4', './test18.mp4', './test19.mp4', './test20.mp4',
];

const resources = computed(() => {
  return Array.from({ length: videoCount.value }, (_, i) => ({
    id: `res-${i + 1}`,
    name: `Stream ${i + 1}`,
    chunkUrls: [testUrls[i % testUrls.length]],
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
      :use-texture-mode="useTextureMode"
      :key="useTextureMode ? 'texture' : 'bridge'"
      @error="console.error"
      @ready="console.log('[CanvasWall] All streams ready')"
      @stream-ready="(id: string) => console.log('[CanvasWall] Stream ready:', id)"
    />
  </div>
</template>
