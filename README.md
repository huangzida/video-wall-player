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

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `resources` | `VideoWallResource[]` | `[]` | List of resources to play. |
| `title` | `string` | `''` | Optional title displayed in the sidebar. |
| `autoplay` | `boolean` | `false` | Whether to start playing automatically. |
| `muted` | `boolean` | `false` | Whether to mute all videos by default. |
| `loop` | `boolean` | `false` | Whether to loop playback when the playlist ends. |
| `aspectRatio` | `number` | `16/9` | Aspect ratio of individual video tiles. |
| `gap` | `number` | `8` | Gap between video tiles in pixels. |
| `showControls` | `boolean` | `true` | Whether to show the bottom control bar. |
| `objectFit` | `'contain' \| 'cover' \| 'fill'` | `'contain'` | Object fit mode for video elements. |

| `theme` | `'default' \| 'cyberpunk' \| 'industrial' \| 'minimalist'` | `'default'` | UI theme of the player. |
| `draggable` | `boolean` | `true` | Whether to enable drag and drop reordering. |
| `showTileTitle` | `boolean` | `true` | Whether to show title overlay on video tiles. |
| `showTileMute` | `boolean` | `true` | Whether to show mute button on video tiles. |
| `showSidebar` | `boolean` | `true` | Whether to show the sidebar. |
| `showPrevNextChunk` | `boolean` | `true` | Whether to show prev/next chunk buttons. |
| `showStepSkip` | `boolean` | `true` | Whether to show step backward/forward buttons. |
| `stepSeconds` | `number` | `5` | Seconds to skip when using step buttons. |
| `tags` | `VideoWallTag[]` | `[]` | List of timeline tags. |

### VideoWallResource Interface

```typescript
interface VideoWallResource {
  id: string;          // Unique identifier
  name: string;        // Display name
  chunkUrls: string[]; // List of chunk URLs
  durations: number[]; // List of durations for each chunk (in seconds)
  poster?: string;     // Optional poster image URL
}
```

### VideoWallTag Interface

```typescript
interface VideoWallTag {
  time: number; // Time in seconds
  name: string; // Tag name displayed in tooltip
}
```

## License

MIT
