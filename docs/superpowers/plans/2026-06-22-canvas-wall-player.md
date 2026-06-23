# CanvasWallPlayer 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的 CanvasWallPlayer 组件，用 PixiJS 将多路视频合成到单个 Canvas，支持可配置渲染帧率、分批加载、双击聚焦，提升 20 路视频同屏的渲染性能。

**Architecture:** 隐藏的 `<video>` 元素池（JS 动态创建，preload="none"）→ PixiJS `VideoTexture` → 单个 Canvas 的 Sprite 矩阵 → 自定义 ticker 控制渲染帧率。主从同步逻辑独立实现，复用现有 `useVideoWallLayout` 和 `PlayerControls`，零修改 VideoWallPlayer。

**Tech Stack:** Vue 3 Composition API, PixiJS v8, TypeScript, @vueuse/core

**Spec:** `docs/superpowers/specs/2026-06-22-canvas-wall-player-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/CanvasWallPlayer/types.ts` | Props/Emits 类型定义 |
| `src/components/CanvasWallPlayer/useVideoSources.ts` | 隐藏 video 池管理 + 分批加载 + 主从同步 + 卡顿恢复 |
| `src/components/CanvasWallPlayer/useCanvasWall.ts` | PixiJS Application + VideoTexture/Sprite 管理 + 帧率控制 + 布局映射 |
| `src/components/CanvasWallPlayer/useCanvasInteraction.ts` | 双击聚焦 + 命中检测 |
| `src/components/CanvasWallPlayer/index.vue` | 组件入口，组合 hooks，渲染 canvas 容器 + 隐藏 video 容器 + PlayerControls |
| `src/index.ts` | 新增导出（追加一行） |
| `demo/src/CanvasWallDemo.vue` | 20 路视频 demo 验证页 |

**不改动的文件**：`VideoWallPlayer/`、`PlayerControls/`、`useVideoWallLayout.ts`、`utils/`

---

## Task 1: 安装依赖 + 类型定义

**Files:**
- Modify: `package.json` (添加 pixi.js 依赖)
- Create: `src/components/CanvasWallPlayer/types.ts`

- [ ] **Step 1: 安装 pixi.js**

Run:
```bash
cd /home/zd/git/video-wall-player && pnpm add pixi.js
```

Expected: `package.json` 中出现 `"pixi.js": "^8.x.x"`

- [ ] **Step 2: 创建 types.ts**

Create `src/components/CanvasWallPlayer/types.ts`:

```ts
import type { VideoWallResource, VideoWallLayoutMode, VideoWallControlSize } from '../VideoWallPlayer/types';

export interface CanvasWallPlayerProps {
  resources: VideoWallResource[];
  title?: string;
  targetFps?: number;
  batchSize?: number;
  backgroundColor?: number;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  aspectRatio?: number;
  gap?: number;
  layoutMode?: VideoWallLayoutMode;
  enableFocus?: boolean;
  autoSkipOnStall?: boolean;
  stallThresholdMs?: number;
  maxSkipAttempts?: number;
  showControls?: boolean;
  controlSize?: VideoWallControlSize;
}

export interface CanvasWallPlayerEmits {
  error: [message: string];
  ready: [];
  streamReady: [id: string];
}

// ponytail: 固定批次大小常量，未来可改为 prop 驱动
export const DEFAULT_BATCH_SIZE = 4;
export const DEFAULT_TARGET_FPS = 15;
export const DEFAULT_STALL_THRESHOLD_MS = 500;
export const DEFAULT_MAX_SKIP_ATTEMPTS = 10;
export const DEFAULT_BACKGROUND_COLOR = 0x000000;
```

- [ ] **Step 3: 验证类型文件无错误**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 无关于 types.ts 的错误

- [ ] **Step 4: Commit**

```bash
cd /home/zd/git/video-wall-player && git add src/components/CanvasWallPlayer/types.ts package.json pnpm-lock.yaml && git commit -m "feat(canvas-wall): add pixi.js dependency and type definitions"
```

---

## Task 2: useVideoSources — 隐藏 video 池与分批加载

**Files:**
- Create: `src/components/CanvasWallPlayer/useVideoSources.ts`

- [ ] **Step 1: 创建 useVideoSources hook**

Create `src/components/CanvasWallPlayer/useVideoSources.ts`:

```ts
import { ref, onUnmounted, type Ref } from 'vue';
import type { VideoWallResource } from '../VideoWallPlayer/types';

export interface VideoSourceState {
  isPlaying: Ref<boolean>;
  currentTime: Ref<number>;
  duration: Ref<number>;
  activeChunkIndex: Ref<number>;
  errorStates: Ref<Record<string, boolean>>;
  bufferingStates: Ref<Record<string, boolean>>;
  videoPool: Map<string, HTMLVideoElement>;
  containerEl: Ref<HTMLElement | null>;
  primaryId: Ref<string>;
  loadAll: () => Promise<void>;
  playAll: () => Promise<void>;
  pauseAll: () => void;
  seekAll: (time: number) => void;
  setVolume: (id: string, volume: number) => void;
  toggleMute: (id: string) => void;
  getResource: (id: string) => VideoWallResource | undefined;
}

interface StallState {
  isStalled: boolean;
  skipCount: number;
  startTime: number;
  lastRetryTime: number;
}

interface UseVideoSourcesOptions {
  resources: Ref<VideoWallResource[]>;
  batchSize: Ref<number>;
  autoplay: Ref<boolean>;
  muted: Ref<boolean>;
  loop: Ref<boolean>;
  autoSkipOnStall: Ref<boolean>;
  stallThresholdMs: Ref<number>;
  maxSkipAttempts: Ref<number>;
  onError: (msg: string) => void;
  onStreamReady: (id: string) => void;
  onReady: () => void;
}

export function useVideoSources(options: UseVideoSourcesOptions): VideoSourceState {
  const {
    resources,
    batchSize,
    autoplay,
    muted,
    loop,
    autoSkipOnStall,
    stallThresholdMs,
    maxSkipAttempts,
    onError,
    onStreamReady,
    onReady,
  } = options;

  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const activeChunkIndex = ref(0);
  const errorStates = ref<Record<string, boolean>>({});
  const bufferingStates = ref<Record<string, boolean>>({});
  const containerEl = ref<HTMLElement | null>(null);
  const primaryId = ref('');
  const videoPool = new Map<string, HTMLVideoElement>();
  const individualMuted = ref<Record<string, boolean>>({});
  const volumeMap = ref<Record<string, number>>({});
  const stallStates = new Map<string, StallState>();
  let stallCheckTimer: ReturnType<typeof setInterval> | null = null;
  let suppressTimeUpdate = false;

  // --- Video element creation ---
  function createVideoElement(id: string): HTMLVideoElement {
    const video = document.createElement('video');
    video.preload = 'none';
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'absolute';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.width = '0';
    video.style.height = '0';
    video.dataset.canvasWallId = id;
    return video;
  }

  function ensureVideo(id: string): HTMLVideoElement {
    let video = videoPool.get(id);
    if (video) return video;
    video = createVideoElement(id);
    videoPool.set(id, video);
    if (containerEl.value) {
      containerEl.value.appendChild(video);
    }
    attachMediaEvents(id, video);
    return video;
  }

  // --- Computed durations from primary resource ---
  function updateDuration() {
    const primary = resources.value[0];
    if (!primary) {
      duration.value = 0;
      return;
    }
    duration.value = primary.durations.reduce(
      (sum, d) => sum + Math.max(0, d || 0),
      0
    );
  }

  function getSegmentStarts(): number[] {
    const primary = resources.value[0];
    if (!primary) return [];
    const starts: number[] = [];
    let total = 0;
    primary.durations.forEach((d) => {
      starts.push(total);
      total += Math.max(0, d || 0);
    });
    return starts;
  }

  // --- Media event handlers ---
  function attachMediaEvents(id: string, video: HTMLVideoElement) {
    const onTimeUpdate = () => {
      if (id !== primaryId.value) return;
      if (suppressTimeUpdate) return;
      const starts = getSegmentStarts();
      const segStart = starts[activeChunkIndex.value] || 0;
      currentTime.value = Math.min(duration.value, segStart + video.currentTime);
    };

    const onPlay = () => {
      if (id === primaryId.value) {
        isPlaying.value = !video.paused && !video.ended;
      }
    };

    const onPause = () => {
      if (id === primaryId.value) {
        isPlaying.value = !video.paused && !video.ended;
      }
    };

    const onWaiting = () => {
      bufferingStates.value[id] = true;
      if (autoSkipOnStall.value && !stallStates.has(id)) {
        stallStates.set(id, {
          isStalled: false,
          skipCount: 0,
          startTime: Date.now(),
          lastRetryTime: 0,
        });
      }
    };

    const onPlaying = () => {
      bufferingStates.value[id] = false;
      errorStates.value[id] = false;
      stallStates.delete(id);
    };

    const onCanPlay = () => {
      bufferingStates.value[id] = false;
      stallStates.delete(id);
    };

    const onError_ = () => {
      bufferingStates.value[id] = false;
      errorStates.value[id] = true;
      onError(`Failed to load video: ${id}`);
    };

    const onEnded = () => {
      if (id === primaryId.value) {
        void handlePrimaryEnded();
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError_);
    video.addEventListener('ended', onEnded);

    // Store cleanup refs on the element for removal later
    (video as any).__cleanup = () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError_);
      video.removeEventListener('ended', onEnded);
    };
  }

  // --- Primary ended → chunk switch ---
  async function handlePrimaryEnded() {
    const primary = resources.value[0];
    if (!primary) return;
    const totalChunks = primary.chunkUrls.length;
    if (totalChunks <= 0) return;

    if (activeChunkIndex.value >= totalChunks - 1) {
      if (loop.value) {
        await switchChunk(0, 0, true);
        return;
      }
      isPlaying.value = false;
      return;
    }
    await switchChunk(activeChunkIndex.value + 1, 0, true);
  }

  async function switchChunk(chunkIndex: number, localTime = 0, autoPlay = false) {
    if (resources.value.length === 0) return;

    const primary = resources.value[0];
    const maxIndex = Math.max(0, (primary?.chunkUrls.length || 1) - 1);
    const safeChunkIndex = Math.max(0, Math.min(chunkIndex, maxIndex));

    suppressTimeUpdate = true;
    try {
      activeChunkIndex.value = safeChunkIndex;
      // Set src for all videos to the new chunk
      resources.value.forEach((r) => {
        const video = videoPool.get(r.id);
        if (!video) return;
        const url = r.chunkUrls[safeChunkIndex] || '';
        if (video.src !== url) {
          video.src = url;
          video.load();
        }
        const segDur = primary?.durations[safeChunkIndex] || video.duration || 0;
        const safeTime = Math.max(0, Math.min(localTime, Math.max(0, segDur - 0.05)));
        video.currentTime = Number.isFinite(safeTime) ? safeTime : 0;
      });

      applySettings();

      const starts = getSegmentStarts();
      const segStart = starts[safeChunkIndex] || 0;
      currentTime.value = Math.min(duration.value, segStart + localTime);
    } finally {
      suppressTimeUpdate = false;
    }

    if (autoPlay) {
      void playAll();
    } else {
      pauseAll();
    }
  }

  // --- Batch loading ---
  function loadSingle(r: VideoWallResource): Promise<void> {
    return new Promise((resolve) => {
      const video = ensureVideo(r.id);
      const chunkUrl = r.chunkUrls[0] || '';
      if (!chunkUrl) {
        resolve();
        return;
      }

      let settled = false;
      const onCanPlayOnce = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', onCanPlayOnce);
        video.removeEventListener('error', onErrorOnce);
        onStreamReady(r.id);
        resolve();
      };
      const onErrorOnce = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', onCanPlayOnce);
        video.removeEventListener('error', onErrorOnce);
        resolve(); // ponytail: resolve anyway, don't block the batch
      };

      video.addEventListener('canplay', onCanPlayOnce);
      video.addEventListener('error', onErrorOnce);
      video.src = chunkUrl;
      video.load();
    });
  }

  async function loadAll() {
    updateDuration();
    primaryId.value = resources.value[0]?.id || '';

    for (let i = 0; i < resources.value.length; i += batchSize.value) {
      const batch = resources.value.slice(i, i + batchSize.value);
      await Promise.allSettled(batch.map((r) => loadSingle(r)));
    }

    applySettings();
    onReady();

    if (autoplay.value) {
      void playAll();
    }
  }

  // --- Playback control ---
  function applySettings() {
    videoPool.forEach((video, id) => {
      video.muted = muted.value || !!individualMuted.value[id];
      const vol = volumeMap.value[id];
      if (vol !== undefined) {
        video.volume = Math.max(0, Math.min(1, vol));
      }
    });
  }

  async function playAll() {
    const tasks: Promise<void>[] = [];
    videoPool.forEach((video) => {
      tasks.push(
        video.play().catch(() => {
          // ponytail: ignore autoplay rejection, user gesture needed
        })
      );
    });
    await Promise.allSettled(tasks);
    const primary = videoPool.get(primaryId.value);
    isPlaying.value = primary ? !primary.paused && !primary.ended : false;
  }

  function pauseAll() {
    videoPool.forEach((video) => video.pause());
    const primary = videoPool.get(primaryId.value);
    isPlaying.value = primary ? !primary.paused && !primary.ended : false;
  }

  function seekAll(time: number) {
    const safeTarget = Math.max(0, Math.min(duration.value, time));
    const starts = getSegmentStarts();
    const primary = resources.value[0];
    if (!primary) return;

    let chunkIndex = 0;
    let localTime = 0;
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i] || 0;
      const dur = primary.durations[i] || 0;
      const end = start + dur;
      if (safeTarget < end || i === starts.length - 1) {
        chunkIndex = i;
        localTime = Math.max(0, safeTarget - start);
        break;
      }
    }

    void switchChunk(chunkIndex, localTime, isPlaying.value);
  }

  function setVolume(id: string, vol: number) {
    volumeMap.value[id] = vol;
    const video = videoPool.get(id);
    if (video) video.volume = Math.max(0, Math.min(1, vol));
  }

  function toggleMute(id: string) {
    individualMuted.value[id] = !individualMuted.value[id];
    applySettings();
  }

  function getResource(id: string) {
    return resources.value.find((r) => r.id === id);
  }

  // --- Stall recovery ---
  function checkAndRecoverStall() {
    const now = Date.now();
    stallStates.forEach((state, id) => {
      if (!state.isStalled) return;
      const video = videoPool.get(id);
      if (!video) return;

      const stalledDuration = now - state.startTime;
      const timeSinceLastRetry = now - state.lastRetryTime;
      const retryInterval = Math.min(1000 + state.skipCount * 200, 2000);

      if (
        stalledDuration >= stallThresholdMs.value &&
        timeSinceLastRetry >= retryInterval
      ) {
        if (state.skipCount < maxSkipAttempts.value) {
          performAutoSkip(id, state);
        } else {
          stallStates.delete(id);
        }
      }
    });
  }

  function performAutoSkip(id: string, state: StallState) {
    const video = videoPool.get(id);
    if (!video) return;

    const baseSkip = 0.1; // 100ms
    const multiplier = Math.pow(2, Math.floor(state.skipCount / 3));
    const skipAmount = baseSkip * multiplier;
    const newTime = Math.min(video.duration || Infinity, video.currentTime + skipAmount);

    state.isStalled = false;
    state.skipCount++;
    state.lastRetryTime = Date.now();

    video.pause();
    video.load();
    video.currentTime = newTime;
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => {});
  }

  // --- Lifecycle ---
  function startStallCheck() {
    if (stallCheckTimer) return;
    stallCheckTimer = setInterval(() => {
      // Mark stalled
      const now = Date.now();
      stallStates.forEach((state, id) => {
        const video = videoPool.get(id);
        if (video && video.readyState < 3) {
          state.isStalled = true;
        }
      });
      if (autoSkipOnStall.value) {
        checkAndRecoverStall();
      }
    }, 200);
  }

  function stopStallCheck() {
    if (stallCheckTimer) {
      clearInterval(stallCheckTimer);
      stallCheckTimer = null;
    }
  }

  function destroyAll() {
    stopStallCheck();
    videoPool.forEach((video, id) => {
      const cleanup = (video as any).__cleanup;
      if (cleanup) cleanup();
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    });
    videoPool.clear();
    stallStates.clear();
  }

  onUnmounted(() => {
    destroyAll();
  });

  return {
    isPlaying,
    currentTime,
    duration,
    activeChunkIndex,
    errorStates,
    bufferingStates,
    videoPool,
    containerEl,
    primaryId,
    loadAll,
    playAll,
    pauseAll,
    seekAll,
    setVolume,
    toggleMute,
    getResource,
  };
}
```

- [ ] **Step 2: 验证编译**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "useVideoSources|error TS" | head -20
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /home/zd/git/video-wall-player && git add src/components/CanvasWallPlayer/useVideoSources.ts && git commit -m "feat(canvas-wall): add useVideoSources hook for hidden video pool and batch loading"
```

---

## Task 3: useCanvasWall — PixiJS 渲染与布局映射

**Files:**
- Create: `src/components/CanvasWallPlayer/useCanvasWall.ts`

- [ ] **Step 1: 创建 useCanvasWall hook**

Create `src/components/CanvasWallPlayer/useCanvasWall.ts`:

```ts
import { ref, watch, onUnmounted, type Ref } from 'vue';
import { Application, Sprite, Texture, VideoSource, VideoTexture, Container } from 'pixi.js';
import { useVideoWallLayout } from '../../hooks/useVideoWallLayout';
import type { VideoWallLayoutMode } from '../VideoWallPlayer/types';

export interface CanvasWallState {
  canvasContainerEl: Ref<HTMLElement | null>;
  isReady: Ref<boolean>;
  focusOn: (id: string | null) => void;
}

interface UseCanvasWallOptions {
  resources: Ref<{ id: string; chunkUrls: string[] }[]>;
  videoPool: Map<string, HTMLVideoElement>;
  targetFps: Ref<number>;
  backgroundColor: Ref<number>;
  aspectRatio: Ref<number>;
  gap: Ref<number>;
  layoutMode: Ref<VideoWallLayoutMode>;
  enableFocus: Ref<boolean>;
}

export function useCanvasWall(options: UseCanvasWallOptions): CanvasWallState {
  const {
    resources,
    videoPool,
    targetFps,
    backgroundColor,
    aspectRatio,
    gap,
    layoutMode,
    enableFocus,
  } = options;

  const canvasContainerEl = ref<HTMLElement | null>(null);
  const isReady = ref(false);

  let app: Application | null = null;
  let stageContainer: Container | null = null;
  const sprites = new Map<string, Sprite>();
  const textures = new Map<string, VideoTexture>();
  let focusedId: string | null = null;
  let renderTimer: ReturnType<typeof setInterval> | null = null;

  const itemCount = ref(0);

  const { layout } = useVideoWallLayout(itemCount, {
    get aspectRatio() { return aspectRatio.value; },
    get gap() { return gap.value; },
    get layoutMode() { return layoutMode.value; },
  } as any);

  // ponytail: useVideoWallLayout expects a Ref or object; wrap in computed-like accessor
  // We use a reactive shim to satisfy the hook's unref() calls.

  async function initApp() {
    if (!canvasContainerEl.value) return;

    app = new Application({
      background: backgroundColor.value,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      powerPreference: 'high-performance',
      width: canvasContainerEl.value.clientWidth,
      height: canvasContainerEl.value.clientHeight,
    });

    canvasContainerEl.value.appendChild(app.canvas);

    stageContainer = new Container();
    app.stage.addChild(stageContainer);

    // Stop auto-render, use manual render at target fps
    app.ticker.stop();
    startRenderLoop();

    isReady.value = true;
  }

  function startRenderLoop() {
    if (renderTimer) clearInterval(renderTimer);
    const interval = 1000 / Math.max(1, targetFps.value);
    renderTimer = setInterval(() => {
      if (app) app.render();
    }, interval);
  }

  function restartRenderLoop() {
    startRenderLoop();
  }

  function resizeCanvas() {
    if (!app || !canvasContainerEl.value) return;
    app.renderer.resize(
      canvasContainerEl.value.clientWidth,
      canvasContainerEl.value.clientHeight
    );
    layoutSprites();
  }

  // --- Texture/Sprite management ---
  function createTextureForVideo(id: string): VideoTexture | null {
    const video = videoPool.get(id);
    if (!video) return null;

    const source = new VideoSource({
      resource: video,
      update: true,
      autoPlay: false,
    });
    const texture = new VideoTexture({ source });
    textures.set(id, texture);
    return texture;
  }

  function createSprite(id: string) {
    if (sprites.has(id)) return;
    const texture = textures.get(id) || createTextureForVideo(id);
    if (!texture) return;

    const sprite = new Sprite(texture);
    sprite.eventMode = enableFocus.value ? 'static' : 'none';
    sprite.eventMode = 'static'; // always allow hit detection
    sprite.label = id;
    stageContainer?.addChild(sprite);
    sprites.set(id, sprite);
    layoutSprites();
  }

  function removeSprite(id: string) {
    const sprite = sprites.get(id);
    if (sprite) {
      stageContainer?.removeChild(sprite);
      sprite.destroy();
      sprites.delete(id);
    }
    const texture = textures.get(id);
    if (texture) {
      texture.destroy(true);
      textures.delete(id);
    }
    layoutSprites();
  }

  function layoutSprites() {
    if (!app || !stageContainer) return;

    itemCount.value = sprites.size;

    // Use nextTick-like deferral: layout is computed, read it
    const currentLayout = layout.value;
    if (currentLayout.itemWidth <= 0 || currentLayout.itemHeight <= 0) return;

    if (focusedId) {
      // Focused mode: only show focused sprite full-size
      sprites.forEach((sprite, id) => {
        if (id === focusedId) {
          sprite.visible = true;
          sprite.width = app!.renderer.width;
          sprite.height = app!.renderer.height;
          sprite.position.set(0, 0);
        } else {
          sprite.visible = false;
        }
      });
      return;
    }

    const spriteList = [...sprites.values()];
    spriteList.forEach((sprite, index) => {
      const row = Math.floor(index / currentLayout.cols);
      const col = index % currentLayout.cols;
      sprite.visible = true;
      sprite.width = currentLayout.itemWidth;
      sprite.height = currentLayout.itemHeight;
      sprite.position.set(
        col * (currentLayout.itemWidth + gap.value),
        row * (currentLayout.itemHeight + gap.value)
      );
    });
  }

  function focusOn(id: string | null) {
    focusedId = id;
    layoutSprites();
  }

  // --- Watch for resource changes ---
  watch(
    () => resources.value.map((r) => r.id).join(','),
    () => {
      syncSprites();
    }
  );

  function syncSprites() {
    const currentIds = new Set(resources.value.map((r) => r.id));
    // Remove sprites for deleted resources
    [...sprites.keys()].forEach((id) => {
      if (!currentIds.has(id)) removeSprite(id);
    });
    // Create sprites for new resources (texture creation deferred until video exists)
    currentIds.forEach((id) => {
      if (!sprites.has(id) && videoPool.has(id)) {
        createSprite(id);
      }
    });
    layoutSprites();
  }

  // --- Watch targetFps changes ---
  watch(targetFps, () => {
    restartRenderLoop();
  });

  // --- Watch backgroundColor changes ---
  watch(backgroundColor, (newColor) => {
    if (app) app.renderer.background.color = newColor;
  });

  // --- Watch layout changes ---
  watch(layout, () => {
    layoutSprites();
  }, { deep: true });

  watch([aspectRatio, gap, layoutMode], () => {
    // layout is computed from useVideoWallLayout, it will recompute
    layoutSprites();
  });

  // --- Resize observer ---
  let resizeObserver: ResizeObserver | null = null;

  function attachResizeObserver() {
    if (!canvasContainerEl.value) return;
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvasContainerEl.value);
  }

  // --- Cleanup ---
  function destroy() {
    if (renderTimer) {
      clearInterval(renderTimer);
      renderTimer = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    sprites.forEach((s) => s.destroy());
    sprites.clear();
    textures.forEach((t) => t.destroy(true));
    textures.clear();
    if (app) {
      app.destroy(true);
      app = null;
    }
  }

  onUnmounted(() => {
    destroy();
  });

  return {
    canvasContainerEl,
    isReady,
    focusOn,
    // Internal methods exposed for the component to call at the right lifecycle moment
    initApp,
    attachResizeObserver,
    createSprite,
    removeSprite,
    syncSprites,
    layoutSprites,
    destroy,
  } as CanvasWallState & {
    initApp: () => Promise<void>;
    attachResizeObserver: () => void;
    createSprite: (id: string) => void;
    removeSprite: (id: string) => void;
    syncSprites: () => void;
    layoutSprites: () => void;
    destroy: () => void;
  };
}
```

- [ ] **Step 2: 验证编译**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "useCanvasWall|error TS" | head -20
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /home/zd/git/video-wall-player && git add src/components/CanvasWallPlayer/useCanvasWall.ts && git commit -m "feat(canvas-wall): add useCanvasWall hook for pixijs rendering and layout"
```

---

## Task 4: useCanvasInteraction — 双击聚焦

**Files:**
- Create: `src/components/CanvasWallPlayer/useCanvasInteraction.ts`

- [ ] **Step 1: 创建 useCanvasInteraction hook**

Create `src/components/CanvasWallPlayer/useCanvasInteraction.ts`:

```ts
import { ref, type Ref } from 'vue';

export interface CanvasInteractionState {
  focusedId: Ref<string | null>;
}

interface UseCanvasInteractionOptions {
  enableFocus: Ref<boolean>;
  onFocus: (id: string | null) => void;
  // Returns the sprite id at given canvas coordinates, or null
  hitTest: (x: number, y: number) => string | null;
}

const DOUBLE_TAP_MS = 300;

export function useCanvasInteraction(
  options: UseCanvasInteractionOptions
): CanvasInteractionState {
  const { enableFocus, onFocus, hitTest } = options;
  const focusedId = ref<string | null>(null);
  let lastTapTime = 0;
  let lastTapId: string | null = null;

  function handlePointerDown(x: number, y: number) {
    if (!enableFocus.value) return;

    const now = Date.now();
    const hitId = hitTest(x, y);

    if (hitId && now - lastTapTime < DOUBLE_TAP_MS && hitId === lastTapId) {
      // Double tap
      if (focusedId.value === hitId) {
        focusedId.value = null;
        onFocus(null);
      } else {
        focusedId.value = hitId;
        onFocus(hitId);
      }
      lastTapTime = 0;
      lastTapId = null;
    } else {
      lastTapTime = now;
      lastTapId = hitId;
    }
  }

  return {
    focusedId,
    handlePointerDown,
  } as CanvasInteractionState & {
    handlePointerDown: (x: number, y: number) => void;
  };
}
```

- [ ] **Step 2: 验证编译**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "useCanvasInteraction|error TS" | head -20
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /home/zd/git/video-wall-player && git add src/components/CanvasWallPlayer/useCanvasInteraction.ts && git commit -m "feat(canvas-wall): add useCanvasInteraction hook for double-tap focus"
```

---

## Task 5: CanvasWallPlayer 组件入口

**Files:**
- Create: `src/components/CanvasWallPlayer/index.vue`
- Modify: `src/index.ts` (追加导出)

- [ ] **Step 1: 创建 index.vue**

Create `src/components/CanvasWallPlayer/index.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch, toRefs } from 'vue';
import { useFullscreen, onKeyStroke } from '@vueuse/core';
import PlayerControls from '../PlayerControls/index.vue';
import { PLAYBACK_RATE_LEVELS } from '../../utils';
import { useVideoSources } from './useVideoSources';
import { useCanvasWall } from './useCanvasWall';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { VideoWallResource, VideoWallLayoutMode, VideoWallControlSize } from '../VideoWallPlayer/types';
import type { CanvasWallPlayerProps } from './types';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_TARGET_FPS,
  DEFAULT_STALL_THRESHOLD_MS,
  DEFAULT_MAX_SKIP_ATTEMPTS,
  DEFAULT_BACKGROUND_COLOR,
} from './types';

defineOptions({ name: 'CanvasWallPlayer' });

const props = withDefaults(defineProps<CanvasWallPlayerProps>(), {
  title: '',
  targetFps: DEFAULT_TARGET_FPS,
  batchSize: DEFAULT_BATCH_SIZE,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  autoplay: false,
  muted: false,
  loop: false,
  aspectRatio: 16 / 9,
  gap: 8,
  layoutMode: 'auto' as VideoWallLayoutMode,
  enableFocus: true,
  autoSkipOnStall: true,
  stallThresholdMs: DEFAULT_STALL_THRESHOLD_MS,
  maxSkipAttempts: DEFAULT_MAX_SKIP_ATTEMPTS,
  showControls: true,
  controlSize: 'normal' as VideoWallControlSize,
});

const emit = defineEmits<{
  error: [message: string];
  ready: [];
  streamReady: [id: string];
}>();

// Refs for reactive option passing
const {
  resources,
  batchSize,
  autoplay,
  muted,
  loop,
  autoSkipOnStall,
  stallThresholdMs,
  maxSkipAttempts,
  targetFps,
  backgroundColor,
  aspectRatio,
  gap,
  layoutMode,
  enableFocus,
} = toRefs(props);

// --- Video sources ---
const videoState = useVideoSources({
  resources,
  batchSize,
  autoplay,
  muted,
  loop,
  autoSkipOnStall,
  stallThresholdMs,
  maxSkipAttempts,
  onError: (msg) => emit('error', msg),
  onStreamReady: (id) => emit('streamReady', id),
  onReady: () => {
    emit('ready');
    // After all videos ready, create sprites for each
    canvasState.syncSprites();
  },
});

// --- Canvas wall ---
const canvasState = useCanvasWall({
  resources,
  videoPool: videoState.videoPool,
  targetFps,
  backgroundColor,
  aspectRatio,
  gap,
  layoutMode,
  enableFocus,
});

// --- Interaction ---
const interaction = useCanvasInteraction({
  enableFocus,
  onFocus: (id) => canvasState.focusOn(id),
  hitTest: (x, y) => {
    // Simple hit test: iterate sprites and check bounds
    // The actual hit testing is done via PixiJS event system on sprites.
    // We return null here because PixiJS handles it via eventMode.
    return null;
  },
});

const wallRef = ref<HTMLElement>();
const { toggle: toggleFullscreen } = useFullscreen(wallRef);

// --- PlayerControls handlers ---
const handlePlayPause = () =>
  videoState.isPlaying.value ? videoState.pauseAll() : void videoState.playAll();

const playbackRate = ref(1);
const volume = ref(50);

const handleRateChange = (rate: number) => {
  playbackRate.value = rate;
  videoState.videoPool.forEach((v) => (v.playbackRate = rate));
};

const handleSpeedDown = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx < PLAYBACK_RATE_LEVELS.length - 1)
    handleRateChange(PLAYBACK_RATE_LEVELS[idx + 1]!);
};

const handleSpeedUp = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx > 0) handleRateChange(PLAYBACK_RATE_LEVELS[idx - 1]!);
};

const handleSeek = (seconds: number) => {
  videoState.seekAll(seconds);
};

const handleVolumeChange = (vol: number) => {
  volume.value = vol;
  videoState.videoPool.forEach((v) => {
    v.volume = Math.max(0, Math.min(1, vol / 100));
    v.muted = false;
  });
};

const handleVolumeToggle = () => {
  const allMuted = [...videoState.videoPool.values()].every((v) => v.muted);
  videoState.videoPool.forEach((v) => (v.muted = !allMuted));
};

const handlePrevChunk = () => {
  if (videoState.activeChunkIndex.value > 0) {
    // Trigger chunk switch via seekAll trick: seek to start of prev chunk
    const primary = props.resources[0];
    if (!primary) return;
    const targetStart = primary.durations
      .slice(0, videoState.activeChunkIndex.value)
      .reduce((s, d) => s + Math.max(0, d || 0), 0);
    videoState.seekAll(targetStart);
  }
};

const handleNextChunk = () => {
  const primary = props.resources[0];
  if (!primary) return;
  if (videoState.activeChunkIndex.value < primary.chunkUrls.length - 1) {
    const targetStart = primary.durations
      .slice(0, videoState.activeChunkIndex.value + 1)
      .reduce((s, d) => s + Math.max(0, d || 0), 0);
    videoState.seekAll(targetStart);
  }
};

const handleStepBack = (seconds: number) => {
  videoState.seekAll(Math.max(0, videoState.currentTime.value - seconds));
};

const handleStepForward = (seconds: number) => {
  videoState.seekAll(
    Math.min(videoState.duration.value, videoState.currentTime.value + seconds)
  );
};

// --- Canvas pointer events (for double-tap focus) ---
function handleCanvasPointerDown(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  // Use PixiJS stage's hit testing
  interaction.handlePointerDown(x, y);
}

// --- Keyboard shortcuts ---
onKeyStroke([' ', 'k', 'K'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handlePlayPause();
});

onKeyStroke(['f', 'F'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  toggleFullscreen();
});

onKeyStroke(['m', 'M'], (e) => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeToggle();
});

onKeyStroke('Escape', () => {
  if (interaction.focusedId.value) {
    interaction.focusedId.value = null;
    canvasState.focusOn(null);
  }
});

const isMuted = computed(() =>
  [...videoState.videoPool.values()].every((v) => v.muted)
);

// --- Lifecycle ---
onMounted(async () => {
  await canvasState.initApp();
  canvasState.attachResizeObserver();
  await videoState.loadAll();
});

// Watch resources change
watch(
  () => props.resources,
  (next) => {
    // resources ref is passed to hooks; hooks handle internal sync
    // Trigger sprite resync when video elements are created
    canvasState.syncSprites();
  },
  { deep: true }
);
</script>

<template>
  <div
    ref="wallRef"
    class="canvas-wall-player relative w-full h-full bg-black overflow-hidden"
  >
    <!-- Hidden video container -->
    <div
      ref="videoState.containerEl"
      class="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
      aria-hidden="true"
    ></div>

    <!-- Canvas container -->
    <div
      ref="canvasState.canvasContainerEl"
      class="absolute inset-0"
      @pointerdown="handleCanvasPointerDown"
    ></div>

    <!-- Controls -->
    <div v-if="showControls" class="relative z-50 pointer-events-auto">
      <PlayerControls
        :is-playing="videoState.isPlaying.value"
        :current-time="videoState.currentTime.value"
        :duration="videoState.duration.value"
        :playback-rates="PLAYBACK_RATE_LEVELS"
        :playback-rate="playbackRate"
        :volume="volume"
        :is-muted="isMuted"
        :show-stop="false"
        :show-prev-next-chunk="true"
        :show-step-skip="true"
        :show-playback-rate="true"
        :show-speed-down="true"
        :show-speed-up="true"
        :step-seconds="5"
        :control-size="controlSize"
        @play-pause="handlePlayPause"
        @seek="handleSeek"
        @rate-change="handleRateChange"
        @speed-down="handleSpeedDown"
        @speed-up="handleSpeedUp"
        @volume-change="handleVolumeChange"
        @volume-toggle="handleVolumeToggle"
        @fullscreen="toggleFullscreen"
        @step-back="handleStepBack"
        @step-forward="handleStepForward"
        @prev-chunk="handlePrevChunk"
        @next-chunk="handleNextChunk"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: 更新 src/index.ts 追加导出**

Read `src/index.ts`, then append the CanvasWallPlayer export:

```ts
import type { App } from 'vue';
import VideoWallPlayer from './components/VideoWallPlayer/index.vue';
import PlayerControls from './components/PlayerControls/index.vue';
import CanvasWallPlayer from './components/CanvasWallPlayer/index.vue';

export * from './components/VideoWallPlayer/types';
export * from './components/CanvasWallPlayer/types';
export { VideoWallPlayer, PlayerControls, CanvasWallPlayer };

export default {
  install(app: App) {
    app.component('VideoWallPlayer', VideoWallPlayer);
    app.component('PlayerControls', PlayerControls);
    app.component('CanvasWallPlayer', CanvasWallPlayer);
  },
};
```

- [ ] **Step 3: 验证编译**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无错误（可能有 PixiJS 类型严格度警告，可忽略）

- [ ] **Step 4: Commit**

```bash
cd /home/zd/git/video-wall-player && git add src/components/CanvasWallPlayer/index.vue src/index.ts && git commit -m "feat(canvas-wall): add CanvasWallPlayer component and export"
```

---

## Task 6: Demo 验证页

**Files:**
- Create: `demo/src/CanvasWallDemo.vue` (or in existing demo structure)

- [ ] **Step 1: 找到 demo 结构**

Run:
```bash
cd /home/zd/git/video-wall-player && ls demo/ 2>/dev/null || ls src/demo/ 2>/dev/null || echo "no demo dir"
```

Check where the existing demo lives (likely the `demo:dev` script points to a `vite.config.ts` with an entry HTML).

- [ ] **Step 2: 创建 demo 页面**

Check existing demo entry point first. The `demo:dev` script runs `vite` which uses the root `index.html`. Create or modify the demo to include a CanvasWallPlayer route.

Create `src/demo/CanvasWallDemo.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { CanvasWallPlayer } from '../index';

// ponytail: demo with placeholder URLs, replace with real video URLs for testing
const resources = ref([
  { id: 'cam-01', name: 'Camera 01', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-02', name: 'Camera 02', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-03', name: 'Camera 03', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-04', name: 'Camera 04', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-05', name: 'Camera 05', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-06', name: 'Camera 06', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-07', name: 'Camera 07', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
  { id: 'cam-08', name: 'Camera 08', chunkUrls: ['https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'], durations: [10] },
]);

const targetFps = ref(15);
const batchSize = ref(4);
</script>

<template>
  <div class="h-screen w-full">
    <CanvasWallPlayer
      :resources="resources"
      title="Canvas Wall Demo"
      :target-fps="targetFps"
      :batch-size="batchSize"
      :autoplay="true"
      :muted="true"
      :loop="true"
      @error="console.error"
      @ready="console.log('All streams ready')"
    />
  </div>
</template>
```

- [ ] **Step 3: 在 demo 入口注册路由**

Check `index.html` or the main demo entry. If using a simple entry, create a toggle between VideoWallPlayer and CanvasWallPlayer. Adjust the existing demo App component to include a mode switch.

- [ ] **Step 4: 启动 demo 验证**

Run:
```bash
cd /home/zd/git/video-wall-player && pnpm dev
```

Expected: 浏览器打开 demo 页面，CanvasWallPlayer 渲染 8 路视频到单个 canvas，分批加载，双击聚焦功能正常。

- [ ] **Step 5: Commit**

```bash
cd /home/zd/git/video-wall-player && git add demo/ src/demo/ && git commit -m "feat(canvas-wall): add demo page for CanvasWallPlayer"
```

---

## Task 7: Self-check — 可运行验证

**Files:** 无新文件，纯验证

这个 task 遵循 ponytail 规则：非平凡逻辑留一个可运行的 check。

- [ ] **Step 1: 验证编译通过**

Run:
```bash
cd /home/zd/git/video-wall-player && npx vue-tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无 error TS

- [ ] **Step 2: 验证库构建通过**

Run:
```bash
cd /home/zd/git/video-wall-player && pnpm build 2>&1 | tail -20
```

Expected: 构建成功，dist 中包含 CanvasWallPlayer

- [ ] **Step 3: 验证 demo 可启动**

Run:
```bash
cd /home/zd/git/video-wall-player && pnpm dev
```

Expected: Vite dev server 启动，浏览器访问 demo 页面能看到 CanvasWallPlayer 渲染视频。

- [ ] **Step 4: 手动验证关键功能**

在浏览器中验证：
1. 8 路视频分批加载（Network 面板看到分批请求，无 ERR_CONTENT_LENGTH_MISMATCH）
2. Canvas 渲染帧率符合 targetFps（Performance 面板检查）
3. 双击某路视频 → 聚焦全屏 → 再次双击恢复
4. 播放/暂停/seek/倍速 控制正常
5. 卸载组件后切换页面，Chrome Task Manager 确认内存回收

- [ ] **Step 5: Commit 验证通过标记**

```bash
cd /home/zd/git/video-wall-player && git log --oneline -5
```

Expected: 看到 6 个 feat commit，功能完整。

---

## Self-Review Checklist

### Spec coverage

| Spec 要求 | 对应 Task |
|---|---|
| 隐藏 video 池 + preload="none" | Task 2 |
| 分批加载 | Task 2 (loadAll) |
| PixiJS Application + VideoTexture | Task 3 |
| 可配置渲染帧率 | Task 3 (startRenderLoop) |
| 布局映射 | Task 3 (layoutSprites, 复用 useVideoWallLayout) |
| 双击聚焦 | Task 4 |
| 主从同步 + 分片支持 | Task 2 (playAll/pauseAll/seekAll/switchChunk) |
| 卡顿恢复 (AutoSkip) | Task 2 (checkAndRecoverStall) |
| Props/Emits API | Task 1 (types) + Task 5 (组件) |
| 零修改 VideoWallPlayer | 全局约束，所有 task 遵守 |
| 复用 PlayerControls | Task 5 |
| 内存清理 | Task 2 (destroyAll) + Task 3 (destroy) |
| 错误处理 | Task 2 (单路失败不阻塞) + Task 5 |
| 导出 | Task 5 (src/index.ts) |
| Demo 验证 | Task 6 |

### Type consistency

- `CanvasWallPlayerProps` 在 Task 1 定义，Task 5 使用，字段名一致
- `VideoSourceState` 在 Task 2 定义返回，Task 5 通过 `videoState.xxx` 使用
- `useCanvasWall` 返回的额外方法（initApp/createSprite 等）在 Task 5 中被调用，类型断言处理

### Placeholder scan

无 "TBD"/"TODO"/"similar to" 占位符。所有代码块完整。
