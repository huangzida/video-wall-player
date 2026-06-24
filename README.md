# Video Wall Player

A powerful Vue 3 component for playing synchronized video streams in a responsive grid layout. Perfect for surveillance systems, multi-camera playback, and video wall applications.

## Live Demo
[View Live Demo](https://huangzida.github.io/video-wall-player/)

[中文文档](./README.zh-CN.md)

## Features

- 🎥 **Multi-stream Sync**: Synchronize multiple video/audio streams based on a primary stream.
- 🧩 **Responsive Grid**: Automatically calculates optimal grid layout based on stream count and container size.
- 🖱️ **Drag & Drop**: Reorder video tiles with drag and drop support.
- 🔍 **Spotlight Focus**: Double-click any video tile to maximize it and focus on that stream.
- 🔊 **Audio Support**: Handles both video and audio chunks (.wav support).
- 🎛️ **Advanced Controls**: Playback speed, seeking, volume control, fullscreen.
- 🎨 **Tailwind CSS**: Styled with Tailwind CSS for easy customization.
- 🖼️ **Canvas Mode** (`CanvasWallPlayer`): WebGL-based rendering via PixiJS for 50+ stream walls or per-frame effects. Includes seek-sync, frame-rate control, and a video-bridge fallback for Chrome stability.

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
import 'video-wall-player/style.css';

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

### Styling

- **Default (recommended)**: explicitly import `video-wall-player/style.css` once.
- **Optional auto-injection**: for demos/lightweight usage, you can inject styles at runtime:

```ts
import 'video-wall-player/auto';
```

Notes:

- **Scoped Tailwind utilities**: Tailwind utility rules are scoped under `.video-wall-player` (via `tailwind.config.ts` `important`) so they won't affect your app's global styles.
- **No Tailwind preflight**: the library disables Tailwind preflight to avoid resetting your site's base element styles.

## CanvasWallPlayer (Canvas / WebGL Mode)

A WebGL-based alternative to `VideoWallPlayer`, powered by [PixiJS](https://pixijs.com/). Use it when you need **50+ simultaneous streams** or **per-frame visual effects**. For typical 1–20 stream playback, the DOM-based `VideoWallPlayer` offers better performance (near zero-copy GPU compositing).

```vue
<script setup lang="ts">
import { CanvasWallPlayer } from 'video-wall-player';
import 'video-wall-player/style.css';
</script>

<template>
  <CanvasWallPlayer
    :resources="resources"
    :target-fps="15"
    :batch-size="4"
    :use-texture-mode="false"
    @error="console.error"
  />
</template>
```

### CanvasWallPlayer Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `resources` | `VideoWallResource[]` | `[]` | Same resource format as `VideoWallPlayer`. |
| `title` | `string` | `''` | Optional title. |
| `targetFps` | `number` | `15` | Target render frame rate. Lower = less GPU load. |
| `batchSize` | `number` | `4` | How many streams to load concurrently on init. |
| `backgroundColor` | `number` | `0x000000` | Canvas background color (hex). |
| `autoplay` | `boolean` | `false` | Autoplay on load. |
| `muted` | `boolean` | `false` | Mute all streams. |
| `loop` | `boolean` | `false` | Loop playback. |
| `aspectRatio` | `number` | `16/9` | Tile aspect ratio. |
| `gap` | `number` | `8` | Gap between tiles (px). |
| `layoutMode` | `VideoWallLayoutMode` | `'auto'` | Grid layout mode. |
| `enableFocus` | `boolean` | `true` | Double-click to spotlight a stream. |
| `autoSkipOnStall` | `boolean` | `true` | Auto-recover stalled streams. |
| `stallThresholdMs` | `number` | `500` | Stall detection threshold. |
| `maxSkipAttempts` | `number` | `10` | Max recovery attempts. |
| `showControls` | `boolean` | `true` | Show bottom control bar. |
| `controlSize` | `VideoWallControlSize` | `'normal'` | Control bar size. |
| `useTextureMode` | `boolean` | `false` | Use direct `Texture.from(video)` (lower overhead, may trigger Chrome `glCopySubTextureCHROMIUM` errors). Default bridge mode is more stable. |

### DOM vs Canvas — Which to choose?

| Scenario | Recommended |
| --- | --- |
| 1–20 streams, pure playback | **`VideoWallPlayer`** (DOM) — near zero-copy, browser-optimized compositing |
| 50+ streams, DOM layout is slow | **`CanvasWallPlayer`** — single canvas, no DOM layout cost |
| Per-frame effects (overlays, filters, blending) | **`CanvasWallPlayer`** — full WebGL shader access |
| Maximum browser compatibility | **`VideoWallPlayer`** — no WebGL dependency |

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
| `showTileFullscreen` | `boolean` | `true` | Whether to show fullscreen button on video tiles. |
| `showSidebar` | `boolean` | `true` | Whether to show the sidebar. |
| `showPrevNextChunk` | `boolean` | `true` | Whether to show prev/next chunk buttons. |
| `showStepSkip` | `boolean` | `true` | Whether to show step backward/forward buttons. |
| `showSpeedControl` | `boolean` | `true` | Whether to show fast forward/rewind buttons. |
| `showPlaybackRate` | `boolean` | `true` | Whether to show playback rate multiplier button. |
| `stepSeconds` | `number` | `5` | Seconds to skip when using step buttons. |
| `fixedTileMeta` | `boolean` | `true` | Whether tile meta (title, mute) is always visible (true) or hover-only (false). |
| `controlSize` | `'small' \| 'normal' \| 'large'` | `'normal'` | Size of the bottom control bar (icons and text). |
| `sidebarWidth` | `number` | `280` | Width of the sidebar in pixels. |
| `videoWallPadding` | `number` | `10` | Padding inside the right-side video wall area in pixels. |
| `layoutMode` | `'auto' \| '1x1' \| '2x2' \| '3x3' \| '4x4' \| '1+5' \| '1+7'` | `'auto'` | Grid layout mode. 'auto' calculates based on count. Others are fixed or focus layouts. |
| `tags` | `VideoWallTag[]` | `[]` | List of timeline tags. |
| `autoSkipOnStall` | `boolean` | `true` | Enable automatic skip recovery when video stalls/fails. |
| `skipStepMs` | `number` | `100` | Milliseconds to skip forward on each recovery attempt (with exponential backoff). |
| `maxSkipAttempts` | `number` | `10` | Maximum number of auto-skip recovery attempts before giving up. |
| `stallThresholdMs` | `number` | `500` | Milliseconds to wait before triggering auto-skip after stall detection. |

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
  id?: string | number; // Optional unique identifier
  time: number; // Time in seconds
  name: string; // Tag name displayed in tooltip
  color?: string; // Optional color for the tag dot (e.g. '#ff0000', 'red')
}
```

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `error` | `message: string` | Emitted when an error occurs (e.g., video loading failed). |
| `close` | - | Emitted when a close action is triggered (if applicable). |

### Exposed Methods

You can access these methods via template ref:

| Method | Parameters | Description |
| --- | --- | --- |
| `play` | - | Resumes playback for all videos. |
| `pause` | - | Pauses playback for all videos. |
| `seek` | `time: number` | Seeks all videos to the specified time (in seconds). |

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` / `k` | Toggle Play/Pause |
| `f` | Toggle Fullscreen |
| `m` | Toggle Mute |
| `ArrowLeft` | Step Backward (default 5s) |
| `ArrowRight` | Step Forward (default 5s) |
| `ArrowUp` | Volume Up (+10%) |
| `ArrowDown` | Volume Down (-10%) |
| `Esc` | Exit Fullscreen / Exit Focus Mode |
| `Double Click` | Toggle Focus Mode (Spotlight) on a tile |

## License

MIT
