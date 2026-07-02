# Video Wall Player

A Vue 3 component for playing synchronized video streams in a responsive grid. Built for surveillance systems, multi-camera playback, and video wall applications.

[![npm version](https://img.shields.io/npm/v/video-wall-player.svg)](https://www.npmjs.com/package/video-wall-player)
[![npm downloads](https://img.shields.io/npm/dm/video-wall-player.svg)](https://www.npmjs.com/package/video-wall-player)
[Live Demo](https://huangzida.github.io/video-wall-player/)

## Features

- 🎥 **Multi-stream sync** — multiple video/audio streams kept in lock-step against a primary source (coordinated seek, drift correction).
- 🧩 **Responsive grid** — optimal layout calculated from stream count + container size. Focus modes (`1+5`, `1+7`) for spotlight + surround.
- 🖱️ **Drag & drop** — reorder tiles.
- 🔍 **Spotlight** — double-click a tile to maximize it.
- 🎚️ **Headless core** — `useMediaSync` / `useVideoWallState` / `useVideoWall` primitives let you build custom UIs; `<PlayerControls>` is usable standalone on a single `<video>`.
- 🎨 **Themed via CSS variables** — 5 built-in themes (default / cyberpunk / industrial / minimalist / glass); override tokens to customize.
- 🧰 **Batteries included** — `<VideoWallPlayer>` composes everything; drop in and it works.
- 🔊 **Audio chunks** — handles `.wav` segments alongside video.

## Install

```bash
npm install video-wall-player
# or
pnpm add video-wall-player
```

Peer dep: `vue` ^3.3. Other dependencies (`@vueuse/core`, `lucide-vue-next`, `pixi.js`) are bundled. Import styles:

```ts
import 'video-wall-player/style.css';
```

## Quick start

```vue
<script setup lang="ts">
import { VideoWallPlayer } from 'video-wall-player';
import 'video-wall-player/style.css';

const resources = [
  { id: 'cam-1', name: 'Camera 1', src: '/feeds/cam-1.mp4' },
  { id: 'cam-2', name: 'Camera 2', src: '/feeds/cam-2.mp4' },
  // ...
];
</script>

<template>
  <div class="h-screen w-full">
    <VideoWallPlayer :resources="resources" title="Surveillance Wall" @error="console.error" />
  </div>
</template>
```

## Resources format

`resources` accepts flexible input — `normalizeResource()` aligns everything into a canonical `MediaResource`:

```ts
// Single video (the common case)
{ id: 'cam-1', name: 'Camera 1', src: '/feeds/cam-1.mp4' }

// Bare URL string (id auto-generated)
'/feeds/cam-1.mp4'

// Multi-segment without durations (auto-detected from metadata)
{ id: 'cam-1', name: 'Camera 1', chunkUrls: ['seg-0.mp4', 'seg-1.mp4'] }

// Full shape (segment durations known up-front — enables instant cross-segment seek)
{ id: 'cam-1', name: 'Camera 1', chunkUrls: ['seg-0.mp4', 'seg-1.mp4'], durations: [120, 120], poster: 'poster.png' }

// With custom segment names (sidebar shows these instead of auto-derived "1.mp4")
{ id: 'cam-1', name: 'Camera 1', chunkUrls: ['seg-0.mp4', 'seg-1.mp4'], durations: [120, 120], segmentNames: ['Morning Patrol', 'Afternoon Patrol'] }

// With per-segment dates (grouped into a date tree in the sidebar; ISO string or epoch ms)
{ id: 'cam-1', name: 'Camera 1', chunkUrls: ['seg-0.mp4', 'seg-1.mp4'], segmentDates: ['2026-07-01', '2026-07-02'] }
```

Empty `chunkUrls` throws (fail-loud). `durations` defaults to `0` (unknown) and is padded/clamped to match `chunkUrls` length. `segmentNames` (optional) sets custom display names per segment in the sidebar; defaults to URL-derived names (e.g. `1.mp4`). `segmentDates` (optional) groups segments by date in the sidebar as a collapsible tree; accepts ISO strings or epoch ms. Groups are sorted ascending (earliest first), collapsed by default, auto-expand on seek. Per-segment `undefined` → "Other" bucket (last). Absent → flat list (backward compatible).

## `<VideoWallPlayer>` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `resources` | `MediaResourceInput[]` | `[]` | Streams to play (see format above). |
| `title` | `string` | `''` | Sidebar heading. |
| `autoplay` | `boolean` | `false` | Start playing on load. |
| `muted` | `boolean` | `false` | Mute all on load. |
| `loop` | `boolean` | `false` | Loop the whole wall (last segment → first). |
| `aspectRatio` | `number` | `16/9` | Per-tile aspect ratio. |
| `gap` | `number` | `8` | Tile gap (px). |
| `showControls` | `boolean` | `true` | Show the bottom control bar. |
| `objectFit` | `'contain' \| 'cover' \| 'fill'` | `'contain'` | Tile video fit. |
| `theme` | `'default' \| 'cyberpunk' \| 'industrial' \| 'minimalist' \| 'glass'` | `'default'` | UI theme. |
| `controlSize` | `'small' \| 'normal' \| 'large'` | `'normal'` | Control bar sizing. |
| `layoutMode` | `'auto' \| '1x1' \| '2x2' \| '3x3' \| '4x4' \| '1+5' \| '1+7'` | `'auto'` | Grid layout. `'auto'` picks by count. |
| `draggable` | `boolean` | `true` | Drag-and-drop reordering. |
| `showTileTitle` / `showTileMute` / `showTileFullscreen` | `boolean` | `true` | Per-tile overlay buttons. |
| `showSidebar` | `boolean` | `true` | Segment-list sidebar. |
| `tags` | `TimelineTag[]` | `[]` | Timeline markers on the progress bar. |
| `showPrevNextChunk` / `showStepSkip` / `showPlaybackRate` / `showSpeedControl` | `boolean` | `true` | Control-bar button visibility. |
| `stepSeconds` | `number` | `5` | Step-back / step-forward size. |
| `fixedTileMeta` | `boolean` | `true` | Tile meta always visible (`true`) vs hover-only (`false`). |
| `sidebarWidth` / `videoWallPadding` | `number` | `280` / `10` | Layout spacing (px). |
| `autoSkipOnStall` | `boolean` | `true` | Auto-recover stalled streams (exponential backoff skip). |
| `skipStepMs` / `stallThresholdMs` / `maxSkipAttempts` | `number` | `100` / `500` / `10` | Stall-recovery tuning. |

### `TimelineTag`

```ts
interface TimelineTag { id?: string | number; time: number; name: string; color?: string }
```

### Events

| Event | Payload | Description |
|---|---|---|
| `error` | `message: string` | A stream failed to load. |
| `close` | — | Close action. |

### Exposed methods (template ref)

| Method | Description |
|---|---|
| `play()` / `pause()` | Resume / pause all streams. |
| `seek(time)` | Seek the whole wall to `time` (seconds, global across segments). |

## Keyboard shortcuts

All shortcuts work in both `<VideoWallPlayer>` and `<CanvasWallPlayer>`.

| Key | Action |
|---|---|
| `Space` / `k` | Play / pause |
| `f` | Fullscreen |
| `m` | Mute toggle |
| `[` / `]` | Previous / next segment |
| `1`-`9` | Spotlight tile N |
| `0` | Exit spotlight |
| `←` / `→` | Step back / forward (`stepSeconds`) |
| `↑` / `↓` | Volume up / down (±10) |
| `Esc` | Exit focus / fullscreen |
| Double-click tile | Spotlight |

## Theming

The 5 themes are CSS-variable driven. Set `theme="cyberpunk"` on the player, or override tokens globally on `:root` / `.video-wall-player`:

```css
.video-wall-player {
  --vwp-accent: #ff6600;        /* primary accent */
  --vwp-bg-main: #111;          /* main background */
  --vwp-text-primary: #fff;     /* primary text */
  --vwp-radius: 4px;            /* corner radius */
  /* ... see themes.css for the full token list (~20 tokens) */
}
```

Both the wall tiles AND the control bar (`<PlayerControls>`) respond to the active theme.

## Standalone `<PlayerControls>` (headless payoff)

Need just a control bar on your own `<video>`, no wall? Use `useMediaSync` to drive one element + bind `PlayerControls` to its state:

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { useMediaSync, PlayerControls } from 'video-wall-player';
import 'video-wall-player/style.css';

const videoRef = ref(null);
const sync = useMediaSync();
onMounted(() => { if (videoRef.value) sync.register('main', videoRef.value); });
</script>

<template>
  <video ref="videoRef" src="x.mp4" />
  <PlayerControls
    :is-playing="sync.state.value.isPlaying"
    :current-time="sync.state.value.currentTime"
    :duration="sync.state.value.duration"
    :volume="sync.state.value.volume"
    :muted="sync.state.value.muted"
    :playback-rate="sync.state.value.playbackRate"
    @play-pause="sync.state.value.isPlaying ? sync.pause() : void sync.play()"
    @seek="(t) => sync.seekAllLocal(t)"
    @volume-change="(v) => sync.setVolumeAll(v)"
    @volume-toggle="() => sync.setMutedAll(!sync.state.value.muted)"
    @rate-change="(r) => sync.setRate(r)"
  />
</template>
```

For multi-segment chunk nav, slot `<SegmentNav>` into `#leftAffix` / `#rightAffix`.

## Headless primitives

```ts
import {
  useMediaSync,        // element-level sync engine (events, primary tracking, coordinated seek, stall recovery)
  useVideoWallState,   // pure wall state + segment math (resources → segments, global time)
  useVideoWall,        // wall orchestration + hidden <video> pool (used by CanvasWallPlayer)
  normalizeResource,   // resource input → canonical MediaResource
  // pure helpers: getSegmentStarts, sumDurations, locateByGlobalTime, clampDuration
  SegmentNav,          // chunk-navigation button (for PlayerControls affix slots)
} from 'video-wall-player';
```

`useMediaSync` / `useVideoWall` options accept `MaybeRef<T>` for scalar values — pass plain values or refs. Options are read once at setup; use the reactive setters (`setVolumeAll`, `setMutedAll`, `setRate`) for runtime changes.

## `<CanvasWallPlayer>` (alternative WebGL renderer)

A second renderer that composites all streams onto a single WebGL canvas via [PixiJS](https://pixijs.com/). Use it when you specifically want canvas-based compositing or per-frame WebGL effects.

```vue
<CanvasWallPlayer :resources="resources" :target-fps="15" :batch-size="4" :use-texture-mode="false" />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `targetFps` | `number` | `15` | Render frame rate (lower = less GPU load). |
| `batchSize` | `number` | `4` | Streams loaded concurrently on init. |
| `backgroundColor` | `number` | `0x000000` | Canvas clear color (hex). |
| `useTextureMode` | `boolean` | `false` | Direct `Texture.from(video)` (lower overhead; may trigger Chrome `glCopySubTextureCHROMIUM` errors — default bridge mode is safer). |
| `enableFocus` | `boolean` | `true` | Double-tap spotlight. |
| *(+ shared props: `resources`, `title`, `autoplay`, `muted`, `loop`, `aspectRatio`, `gap`, `layoutMode`, `autoSkipOnStall`, `stallThresholdMs`, `maxSkipAttempts`, `showControls`, `controlSize`)* |

Canvas-specific events: `ready` (all streams loaded), `streamReady(id)`.

> ### ⚠️ On 20+ stream performance
> A common reason to reach for canvas is the hope that consolidating `<video>` elements into one canvas will make large walls faster. **In practice this rarely helps**: for 20+ simultaneous streams the bottleneck is **decoding** (hardware decoder limits, CPU for software fallback, memory bandwidth), not rendering/compositing. WebGL consolidation reduces compositing-layer cost but does NOT reduce per-stream decode load.
>
> For real gains on large walls, look at decode-side and network-side strategies (server-provided low-res / low fps transcodes, tile virtualization, server-side mosaic, adaptive streaming). The DOM `<VideoWallPlayer>` is near-zero-compositing-cost and is the recommended default — `<CanvasWallPlayer>` should be chosen only when you need its specific rendering features, not as a performance optimization.

## Styling notes

- Tailwind utility rules are scoped under `.video-wall-player` (via `tailwind.config.ts` `important`) so they won't clash with your app's global styles.
- Tailwind preflight is disabled to avoid resetting your site's base element styles.
- Optional auto-injection (no manual `style.css` import): `import 'video-wall-player/auto'`.

## License

MIT
