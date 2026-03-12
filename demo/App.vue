<script setup lang="ts">
import { ref } from 'vue';
import { VideoWallPlayer } from '../src/index';

const testUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.mp4';
// Use a reasonable duration for the test stream (e.g., 10 minutes)
const testDuration = 600;

// Create 4 resources to demonstrate the wall capability
const resources = ref([
  {
    id: 'res-1',
    name: 'Stream 1',
    chunkUrls: [testUrl],
    durations: [testDuration],
  },
  {
    id: 'res-2',
    name: 'Stream 2',
    chunkUrls: [testUrl],
    durations: [testDuration],
  },
  {
    id: 'res-3',
    name: 'Stream 3',
    chunkUrls: [testUrl],
    durations: [testDuration],
  },
  {
    id: 'res-4',
    name: 'Stream 4',
    chunkUrls: [testUrl],
    durations: [testDuration],
  },
]);
</script>

<template>
  <div class="container mx-auto p-4 min-h-screen bg-gray-900 text-white">
    <h1 class="text-3xl font-bold mb-6 text-center">Video Wall Player Demo</h1>
    <div class="h-[600px] w-full border border-gray-700 rounded-lg overflow-hidden">
      <VideoWallPlayer
        :resources="resources"
        title="Demo Wall"
      />
    </div>
  </div>
</template>
