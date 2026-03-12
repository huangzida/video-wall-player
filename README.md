# Video Wall Player

A powerful Vue 3 component for playing synchronized video streams in a responsive grid layout. Perfect for surveillance systems, multi-camera playback, and video wall applications.

## 在线演示
[点击查看 Live Demo](https://huangzida.github.io/video-wall-player/)

[中文文档](./README.zh-CN.md) | [Demo](https://huangzida.github.io/video-wall-player/)

## Features

- 🎥 **Multi-stream Sync**: Synchronize multiple video/audio streams based on a primary stream.
- 🧩 **Responsive Grid**: Automatically calculates optimal grid layout based on stream count and container size.
- 🖱️ **Drag & Drop**: Reorder video tiles with drag and drop support.
- 🔊 **Audio Support**: Handles both video and audio chunks (.wav support).
- 🎛️ **Advanced Controls**: Playback speed, seeking, volume control, fullscreen.
- 🎨 **Tailwind CSS**: Styled with Tailwind CSS for easy customization.

## Installation

```bash
npm install video-wall-player
# or
pnpm add video-wall-player
```

Ensure you have `vue` and `@vueuse/core` installed.

## Usage

```vue
<script setup lang="ts">
import { VideoWallPlayer } from 'video-wall-player';
import 'video-wall-player/dist/style.css'; // If needed

const resources = [
  {
    id: 'camera-01',
    name: 'Camera 1',
    chunkUrls: ['https://example.com/video1_part1.mp4', 'https://example.com/video1_part2.mp4'],
    durations: [120, 120]
  },
  // ...
];
</script>

<template>
  <div class="h-screen w-full">
    <VideoWallPlayer
      :resources="resources"
      title="Surveillance Wall"
      @error="console.error"
    />
  </div>
</template>
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `resources` | `VideoWallResource[]` | List of resources to play. |
| `title` | `string` | Optional title. |

### VideoWallResource Interface

```typescript
interface VideoWallResource {
  id: string;          // Unique identifier
  name: string;        // Display name
  chunkUrls: string[]; // List of chunk URLs
  durations: number[]; // List of durations for each chunk (in seconds)
}
```

## License

MIT
