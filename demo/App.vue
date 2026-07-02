<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { VideoWallPlayer } from '../src/index';
import CanvasWallDemo from './CanvasWallDemo.vue';
import DemoSettings from './components/DemoSettings.vue';
import type { VideoWallTheme, VideoWallLayoutMode } from '../src/components/VideoWallPlayer/types';
import type { TimelineTag as VideoWallTag, ControlSize as VideoWallControlSize } from '../src';

const useCanvasMode = useStorage('demo-use-canvas-mode', false);
// ponytail: switch demo source type — mp4 (20 copies, avoids browser cache-lock
// contention across simultaneous streams) or a single audio file (mp3/wav).
// Audio decode doesn't hit the same lock, so one shared URL is fine per type.
const mediaType = useStorage<'mp4' | 'mp3' | 'wav'>('demo-media-type', 'mp4');
const sourceUrlsByType: Record<string, string[]> = {
  mp4: [
    './test.mp4', './test2.mp4', './test3.mp4', './test4.mp4', './test5.mp4',
    './test6.mp4', './test7.mp4', './test8.mp4', './test9.mp4', './test10.mp4',
    './test11.mp4', './test12.mp4', './test13.mp4', './test14.mp4', './test15.mp4',
    './test16.mp4', './test17.mp4', './test18.mp4', './test19.mp4', './test20.mp4',
  ],
  mp3: ['./test.mp3', './test2.mp3', './test3.mp3', './test4.mp3', './test5.mp3'],
  wav: ['./test.wav', './test2.wav', './test3.wav', './test4.wav', './test5.wav'],
};

const resources = computed(() => {
  const urls = sourceUrlsByType[mediaType.value];
  // ponytail: known durations — mp4=90s, mp3/wav=97s (实测).
  const durByType: Record<string, number> = { mp4: 90, mp3: 97, wav: 97 };
  const dur = durByType[mediaType.value];
  return Array.from({ length: videoCount.value }, (_, i) => {
    const c = (offset: number) => urls[(i + offset) % urls.length];
    return {
      id: `res-${i + 1}`,
      name: `${mediaType.value.toUpperCase()} Stream ${i + 1}`,
      chunkUrls: [c(0), c(1), c(2), c(3)],
      durations: [dur, dur, dur, dur],
      segmentDates: ['2026-06-28', '2026-06-28', '2026-07-01', '2026-07-01'],
    };
  });
});

const autoplay = useStorage('demo-autoplay', false);
const muted = useStorage('demo-muted', false);
const loop = useStorage('demo-loop', false);
const showControls = useStorage('demo-show-controls', true);
const aspectRatio = useStorage('demo-aspect-ratio', 16 / 9);
const gap = useStorage('demo-gap', 8);
const objectFit = useStorage<'contain' | 'cover' | 'fill'>('demo-object-fit', 'contain');
const theme = useStorage<VideoWallTheme>('demo-theme', 'default');
const draggable = useStorage('demo-draggable', true);
const showTileTitle = useStorage('demo-show-tile-title', true);
const showTileMute = useStorage('demo-show-tile-mute', true);
const showTileFullscreen = useStorage('demo-show-tile-fullscreen', true);
const showSidebar = useStorage('demo-show-sidebar', true);
const showPrevNextChunk = useStorage('demo-show-prev-next-chunk', true);
const showStepSkip = useStorage('demo-show-step-skip', true);
const showPlaybackRate = useStorage('demo-show-playback-rate', true);
const showSpeedControl = useStorage('demo-show-speed-control', true);
const fixedTileMeta = useStorage('demo-fixed-tile-meta', true);
const stepSeconds = useStorage('demo-step-seconds', 5);
const controlSize = useStorage<VideoWallControlSize>('demo-control-size', 'normal');
const sidebarWidth = useStorage('demo-sidebar-width', 280);
const videoWallPadding = useStorage('demo-video-wall-padding', 10);
const videoCount = useStorage('demo-video-count', 4);
const layoutMode = useStorage<VideoWallLayoutMode>('demo-layout-mode', 'auto');
const autoSkipOnStall = useStorage('demo-auto-skip-on-stall', true);
const skipStepMs = useStorage('demo-skip-step-ms', 100);
const maxSkipAttempts = useStorage('demo-max-skip-attempts', 10);
const stallThresholdMs = useStorage('demo-stall-threshold-ms', 500);

const tags = ref<VideoWallTag[]>([
  { time: 10, name: 'Intro End', color: '#ef4444' },
  { time: 25, name: 'Action Start', color: '#3b82f6' },
  { time: 40, name: 'Climax', color: '#10b981' },
]);
</script>

<template>
  <div class="demo-root">
    <CanvasWallDemo v-if="useCanvasMode" />

    <VideoWallPlayer
      v-else
      :resources="resources as any"
      title="Demo Wall"
      :autoplay="autoplay"
      :muted="muted"
      :loop="loop"
      :show-controls="showControls"
      :aspect-ratio="aspectRatio"
      :gap="gap"
      :object-fit="objectFit"
      :theme="theme"
      :draggable="draggable"
      :show-tile-title="showTileTitle"
      :show-tile-mute="showTileMute"
      :show-tile-fullscreen="showTileFullscreen"
      :show-sidebar="showSidebar"
      :tags="tags as any"
      :show-prev-next-chunk="showPrevNextChunk"
      :show-step-skip="showStepSkip"
      :show-playback-rate="showPlaybackRate"
      :show-speed-control="showSpeedControl"
      :step-seconds="stepSeconds"
      :fixed-tile-meta="fixedTileMeta"
      :control-size="controlSize"
      :sidebar-width="sidebarWidth"
      :video-wall-padding="videoWallPadding"
      :layout-mode="layoutMode"
      :auto-skip-on-stall="autoSkipOnStall"
      :skip-step-ms="skipStepMs"
      :max-skip-attempts="maxSkipAttempts"
      :stall-threshold-ms="stallThresholdMs"
    />

    <DemoSettings
      v-model:use-canvas-mode="useCanvasMode"
      v-model:media-type="mediaType"
      v-model:autoplay="autoplay"
      v-model:muted="muted"
      v-model:loop="loop"
      v-model:show-controls="showControls"
      v-model:aspect-ratio="aspectRatio"
      v-model:gap="gap"
      v-model:object-fit="objectFit"
      v-model:theme="theme"
      v-model:draggable="draggable"
      v-model:show-tile-title="showTileTitle"
      v-model:show-tile-mute="showTileMute"
      v-model:show-tile-fullscreen="showTileFullscreen"
      v-model:show-sidebar="showSidebar"
      v-model:show-prev-next-chunk="showPrevNextChunk"
      v-model:show-step-skip="showStepSkip"
      v-model:show-playback-rate="showPlaybackRate"
      v-model:show-speed-control="showSpeedControl"
      v-model:fixed-tile-meta="fixedTileMeta"
      v-model:step-seconds="stepSeconds"
      v-model:control-size="controlSize"
      v-model:sidebar-width="sidebarWidth"
      v-model:video-wall-padding="videoWallPadding"
      v-model:video-count="videoCount"
      v-model:layout-mode="layoutMode"
      v-model:auto-skip-on-stall="autoSkipOnStall"
      v-model:skip-step-ms="skipStepMs"
      v-model:max-skip-attempts="maxSkipAttempts"
      v-model:stall-threshold-ms="stallThresholdMs"
    />
  </div>
</template>
