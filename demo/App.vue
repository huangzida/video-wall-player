<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { VideoWallPlayer } from '../dist/index.mjs';
import DemoSettings from './components/DemoSettings.vue';
import type { VideoWallTag, VideoWallTheme, VideoWallControlSize, VideoWallLayoutMode } from '../src/components/VideoWallPlayer/types';

// const testUrl = '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4';
// const testDuration = 90;
const testUrl = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const testDuration = 52;
const testPoster = 'https://media.w3.org/2010/05/sintel/poster.png';

const resources = computed(() => {
  return Array.from({ length: videoCount.value }, (_, i) => ({
    id: `res-${i + 1}`,
    name: `Stream ${i + 1}`,
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
    poster: testPoster,
  }));
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

const tags = ref<VideoWallTag[]>([
  { time: 10, name: 'Intro End', color: '#ef4444' },
  { time: 25, name: 'Action Start', color: '#3b82f6' },
  { time: 40, name: 'Climax', color: '#10b981' },
]);
</script>

<template>
  <div class="demo-root">
    <VideoWallPlayer
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
    />

    <DemoSettings
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
    />
  </div>
</template>
