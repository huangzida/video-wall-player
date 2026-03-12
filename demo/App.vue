<script setup lang="ts">
import { ref, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { VideoWallPlayer } from '../src/index';

// const testUrl = '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4';
// const testDuration = 90;
const testUrl = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const testDuration = 52;
const testPoster = 'https://media.w3.org/2010/05/sintel/poster.png';

const resources = ref([
  {
    id: 'res-1',
    name: 'Stream 1',
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
    poster: testPoster,
  },
  {
    id: 'res-2',
    name: 'Stream 2',
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
    poster: testPoster,
  },
  {
    id: 'res-3',
    name: 'Stream 3',
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
    poster: testPoster,
  },
  {
    id: 'res-4',
    name: 'Stream 4',
    chunkUrls: [testUrl, testUrl],
    durations: [testDuration, testDuration],
    poster: testPoster,
  },
]);

const autoplay = useStorage('demo-autoplay', false);
const muted = useStorage('demo-muted', false);
const loop = useStorage('demo-loop', false);
const showControls = useStorage('demo-show-controls', true);
const aspectRatio = useStorage('demo-aspect-ratio', 16 / 9);
const gap = useStorage('demo-gap', 8);
const objectFit = useStorage<'contain' | 'cover' | 'fill'>('demo-object-fit', 'contain');

const showSettings = ref(false);
</script>

<template>
  <div class="w-screen h-screen overflow-hidden relative bg-black">
    <VideoWallPlayer
      :resources="resources"
      title="Demo Wall"
      :autoplay="autoplay"
      :muted="muted"
      :loop="loop"
      :show-controls="showControls"
      :aspect-ratio="aspectRatio"
      :gap="gap"
      :object-fit="objectFit"
    />

    <!-- Settings Toggle -->
    <button
      class="absolute top-4 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700 shadow border border-gray-600 transition-colors"
      @click="showSettings = !showSettings"
    >
      ⚙️ Settings
    </button>

    <!-- Settings Panel -->
    <div
      v-if="showSettings"
      class="absolute top-16 right-4 z-50 bg-gray-900/90 text-white p-4 rounded-lg shadow-xl w-72 backdrop-blur-sm border border-gray-700"
    >
      <h3 class="font-bold mb-4 text-lg border-b border-gray-700 pb-2">Configuration</h3>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label>Autoplay</label>
          <input type="checkbox" v-model="autoplay" class="w-4 h-4 accent-blue-500" />
        </div>

        <div class="flex items-center justify-between">
          <label>Muted (Initial)</label>
          <input type="checkbox" v-model="muted" class="w-4 h-4 accent-blue-500" />
        </div>

        <div class="flex items-center justify-between">
          <label>Loop</label>
          <input type="checkbox" v-model="loop" class="w-4 h-4 accent-blue-500" />
        </div>

        <div class="flex items-center justify-between">
          <label>Show Controls</label>
          <input type="checkbox" v-model="showControls" class="w-4 h-4 accent-blue-500" />
        </div>

        <div class="space-y-1">
          <div class="flex justify-between text-sm text-gray-400">
            <label>Gap</label>
            <span>{{ gap }}px</span>
          </div>
          <input
            type="range"
            v-model.number="gap"
            min="0"
            max="32"
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-sm text-gray-400 block">Aspect Ratio</label>
          <select
            v-model.number="aspectRatio"
            class="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option :value="16 / 9">16:9 (Landscape)</option>
            <option :value="4 / 3">4:3 (SD)</option>
            <option :value="1">1:1 (Square)</option>
            <option :value="9 / 16">9:16 (Portrait)</option>
          </select>
        </div>

        <div class="space-y-1">
          <label class="text-sm text-gray-400 block">Object Fit</label>
          <select
            v-model="objectFit"
            class="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Fill</option>
          </select>
        </div>

        <div class="text-xs text-gray-500 mt-4 italic">
          Note: Autoplay/Muted changes may require reload to take effect fully.
        </div>
      </div>
    </div>
  </div>
</template>
