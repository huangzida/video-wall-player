// Wall-orchestration layer (headless core, ADR-0001 Slice 1).
//
// Creates a hidden <video> pool, normalizes resources, manages chunk-switching
// across segments, and DELEGATES per-element sync to useMediaSync. Exposes
// GLOBAL state (segment-summed duration; global currentTime = segmentStart +
// local). useMediaSync owns LOCAL (per-chunk) state.
//
// Loop is wall-owned (last chunk -> chunk 0) and NOT forwarded to useMediaSync:
// forwarding it makes useMediaSync set el.loop=true, the browser loops the
// current chunk silently, 'ended' never fires, and chunk-switching breaks
// (ADR-0001 slice1 composition contract, point 3).

import {
  ref,
  computed,
  watch,
  onUnmounted,
  getCurrentInstance,
  toValue,
  type Ref,
  type MaybeRef,
} from 'vue';
import { useMediaSync } from './useMediaSync';
import { useVideoWallState } from './useVideoWallState';
import { clampDuration } from './media-math';
import type { MediaResource, MediaResourceInput, PlayerState } from './types';

export interface UseVideoWallOptions {
  resources: MediaResourceInput[] | Ref<MediaResourceInput[]>;
  autoplay?: MaybeRef<boolean>;
  muted?: MaybeRef<boolean>;
  loop?: MaybeRef<boolean>; // wall-level (last chunk -> chunk 0); do NOT forward to useMediaSync
  volume?: MaybeRef<number>; // 0-100
  playbackRate?: MaybeRef<number>;
  batchSize?: MaybeRef<number>; // default 4
  skipStepMs?: MaybeRef<number>;
  stallThresholdMs?: MaybeRef<number>;
  maxSkipAttempts?: MaybeRef<number>;
  stallCheckIntervalMs?: MaybeRef<number>;
  autoSkipOnStall?: MaybeRef<boolean>;
  onError?: (msg: string) => void;
  // Fired once per stream when its first chunk reaches 'canplay' (0.0.12 parity:
  // both players exposed streamReady). The wall owns this — useMediaSync is
  // element-level and has no notion of "a stream" vs "an element".
  onStreamReady?: (id: string) => void;
  // Fired after loadAll completes (all batches settled, primary pinned).
  onReady?: () => void;
  containerEl?: Ref<HTMLElement | null>; // where hidden <video> elements are appended
  // ponytail: test seam — inject fake elements. Defaults to real <video> creation.
  createElement?: () => HTMLMediaElement;
}

// Hidden <video> used as a decode-only sync source (mirrors Canvas
// createVideoElement line 75). Not rendered; useVideoWall owns its lifecycle.
function createVideoElement(id: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.preload = 'metadata'; // ponytail: load metadata only, not full data
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

// ponytail: resolve a possibly-relative url to absolute for src-equality checks.
// The source's bare `new URL(url, location.href)` throws under SSR/node tests
// where `location` is undefined; guard so the lib stays isomorphic.
function resolveUrl(url: string): string {
  try {
    return typeof location !== 'undefined'
      ? new URL(url, location.href).href
      : url;
  } catch {
    return url;
  }
}

export function useVideoWall(options: UseVideoWallOptions) {
  const {
    resources: resourcesOpt,
    onError,
    onStreamReady,
    onReady,
    containerEl: containerElOpt,
    createElement,
  } = options;

  // ponytail: normalize the scalar options useVideoWall uses directly. The
  // pass-through options (muted/volume/playbackRate/skip*/stall*/autoSkipOnStall)
  // are forwarded to useMediaSync below, which accepts MaybeRef and normalizes.
  const loop = toValue(options.loop) ?? false;
  const autoplay = toValue(options.autoplay) ?? false;
  const batchSize = toValue(options.batchSize) ?? 4;

  const containerEl = containerElOpt ?? ref<HTMLElement | null>(null);

  const videoPool = new Map<string, HTMLVideoElement>();

  // --- wall state/math (shared with VideoWallPlayer via useVideoWallState) ---
  // The pure segment math + chunk progression lives in useVideoWallState so both
  // players (Canvas pool + Video template-tiles) share a single source of truth.
  const {
    normalized,
    primaryResource,
    segmentCount,
    activeChunkIndex,
    computeGlobalState,
    locateSeek,
    nextChunkOnEnded,
    setActiveChunk,
    getResource,
  } = useVideoWallState({ resources: resourcesOpt, loop });

  // --- useMediaSync composition (LOCAL / per-chunk semantics) ---
  // CRITICAL: `loop` is intentionally NOT forwarded. useVideoWall owns
  // loop-at-segment-boundaries via nextChunkOnEnded on primary ended.
  const sync = useMediaSync({
    muted: options.muted,
    volume: options.volume,
    playbackRate: options.playbackRate,
    skipStepMs: options.skipStepMs,
    stallThresholdMs: options.stallThresholdMs,
    maxSkipAttempts: options.maxSkipAttempts,
    stallCheckIntervalMs: options.stallCheckIntervalMs,
    autoSkipOnStall: options.autoSkipOnStall,
    onError,
    onPrimaryEnded: () => {
      // 'ended' only fires when playback reached the segment end naturally (the
      // user was playing) — useMediaSync has already set isPlaying=false by now,
      // so we can't read it back. Always continue into the next segment.
      const next = nextChunkOnEnded();
      if (next !== null) void switchChunk(next, 0, true);
    },
  });

  // --- GLOBAL state bridge (segment-summed duration; global currentTime) ---
  const state = computed<PlayerState>(() => computeGlobalState(sync.state.value));

  // --- pool lifecycle ---
  function ensureVideo(id: string): HTMLVideoElement {
    let video = videoPool.get(id);
    if (video) return video;
    video = createElement
      ? (createElement() as HTMLVideoElement)
      : createVideoElement(id);
    videoPool.set(id, video);
    if (containerEl.value) containerEl.value.appendChild(video);
    // register borrows the element into useMediaSync's registry + event wiring;
    // settings are applied here (useMediaSync has no separate applySettings export).
    sync.register(id, video);
    return video;
  }

  // --- chunk switching (delegates seek-coordination to useMediaSync) ---
  async function switchChunk(
    chunkIndex: number,
    localTime = 0,
    autoPlay = false,
  ): Promise<void> {
    if (normalized.value.length === 0) return;
    const primary = primaryResource.value!;
    const maxIndex = Math.max(0, (primary.chunkUrls.length || 1) - 1);
    const safeChunkIndex = Math.max(0, Math.min(chunkIndex, maxIndex));

    // ponytail: pause before chunk swap to prevent async drift (mirrors source;
    // useMediaSync.seekAllLocal also pauses, but src swap + load must happen paused).
    sync.pause();

    setActiveChunk(safeChunkIndex);

    const segDur = primary.durations[safeChunkIndex] || 0;
    const safeTime = clampDuration(localTime, segDur);

    // Swap src for ALL elements to the new chunk.
    normalized.value.forEach((r) => {
      const video = videoPool.get(r.id);
      if (!video) return;
      const url = r.chunkUrls[safeChunkIndex] || '';
      if (video.src !== url && video.src !== resolveUrl(url)) {
        video.src = url;
        video.load();
      }
    });

    // Delegate seek-coordination (pause-all -> each el.currentTime -> wait all
    // 'seeked' -> 3s timeout -> applySettings) to useMediaSync.seekAllLocal.
    // This drops the inline seekPromises/seeked-wait block that lived in both
    // 0.0.12 engines — that coordination is now useMediaSync's single job.
    await sync.seekAllLocal(safeTime);

    if (autoPlay) {
      await sync.play();
    }
  }

  // --- global seek ---
  async function seek(globalTime: number): Promise<void> {
    if (!primaryResource.value) return;
    const { chunkIndex, localTime } = locateSeek(globalTime);
    await switchChunk(chunkIndex, localTime, sync.state.value.isPlaying);
  }

  // --- batch loading (Canvas loadSingle line 286 / loadAll line 348) ---
  function loadSingle(r: MediaResource): Promise<void> {
    return new Promise((resolve) => {
      const video = ensureVideo(r.id);
      const chunkUrl = r.chunkUrls[0] || '';
      if (!chunkUrl) {
        resolve();
        return;
      }

      // ponytail: skip reload if same src already loaded or loading.
      if (video.src === chunkUrl || video.src === resolveUrl(chunkUrl)) {
        if (video.readyState >= 2) {
          onStreamReady?.(r.id);
          resolve();
          return;
        }
        // Same src but not ready yet — wait for the existing load.
        let settled = false;
        const onSameSrcReady = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener('canplay', onSameSrcReady);
          video.removeEventListener('error', onErr);
          onStreamReady?.(r.id);
          resolve();
        };
        const onErr = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener('canplay', onSameSrcReady);
          video.removeEventListener('error', onErr);
          resolve();
        };
        video.addEventListener('canplay', onSameSrcReady);
        video.addEventListener('error', onErr);
        return;
      }

      let settled = false;
      const onCanPlayOnce = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', onCanPlayOnce);
        video.removeEventListener('error', onErrorOnce);
        onStreamReady?.(r.id);
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

  async function loadAll(): Promise<void> {
    const items = normalized.value;
    if (items.length === 0) return;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((r) => loadSingle(r)));
    }
    // primary is always resources[0] (register auto-promotes it; this is explicit).
    sync.setPrimary(items[0].id);

    onReady?.();

    if (autoplay) {
      await sync.play();
    }
  }

  // --- reactive resource reconciliation ---
  function reconcilePool(): void {
    const nextIds = new Set(normalized.value.map((r) => r.id));
    // remove gone: unwire + tear down elements useVideoWall created.
    for (const id of [...videoPool.keys()]) {
      if (!nextIds.has(id)) {
        sync.unregister(id);
        const video = videoPool.get(id);
        video?.pause();
        video?.removeAttribute('src');
        if (video?.parentNode) video.parentNode.removeChild(video);
        videoPool.delete(id);
      }
    }
    // add new + reload changed srcs. loadSingle short-circuits when the src is
    // unchanged, so calling it for every surviving id is cheap (no-op for same
    // src) and handles BOTH "new resource added at runtime" AND "same id, new src".
    // Fires async — reconcilePool is sync (watch callback), doesn't await.
    // Limitation: loadSingle loads chunk 0; if activeChunkIndex>0 and a non-zero
    // chunk's src changed, the active display refreshes on next switchChunk/seek.
    for (const r of normalized.value) {
      if (!videoPool.has(r.id)) ensureVideo(r.id);
      void loadSingle(r);
    }
    // primary is always resources[0].
    const firstId = normalized.value[0]?.id;
    if (firstId && sync.primaryId.value !== firstId) sync.setPrimary(firstId);
    // clamp active chunk into range of the (possibly shorter) new primary.
    const maxChunk = Math.max(
      0,
      (primaryResource.value?.chunkUrls.length || 1) - 1,
    );
    if (activeChunkIndex.value > maxChunk) setActiveChunk(maxChunk);
  }

  watch(normalized, reconcilePool, { deep: true });

  // --- lifecycle ---
  function destroy(): void {
    sync.destroy(); // unwires events + pauses (borrowed-view cleanup)
    // pool teardown: useVideoWall CREATED these elements, so it owns full
    // lifecycle (pause + release src + remove from DOM). Mirrors Canvas
    // destroyAll line 502 — the part useMediaSync deliberately does NOT do
    // (it doesn't own elements; useVideoWall does).
    videoPool.forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (video.parentNode) video.parentNode.removeChild(video);
    });
    videoPool.clear();
    setActiveChunk(0);
  }

  // --- delegated intents (useMediaSync owns the implementation) ---
  function play(): Promise<void> {
    return sync.play();
  }
  function pause(): void {
    sync.pause();
  }
  function setVolume(id: string, vol: number): void {
    sync.setVolume(id, vol);
  }
  function toggleMute(id: string): void {
    sync.toggleMute(id);
  }
  function setRate(rate: number): void {
    sync.setRate(rate);
  }
  function setMutedAll(m: boolean): void {
    sync.setMutedAll(m);
  }
  function setVolumeAll(vol: number): void {
    sync.setVolumeAll(vol);
  }

  // ponytail: only hook onUnmounted inside a component instance; standalone
  // usage outside setup must call destroy() manually.
  if (getCurrentInstance()) {
    onUnmounted(() => destroy());
  }

  return {
    // GLOBAL state (segment-summed duration, global currentTime)
    state: state as Readonly<Ref<PlayerState>>,
    activeChunkIndex: activeChunkIndex as Readonly<Ref<number>>,
    segmentCount: segmentCount as Readonly<Ref<number>>,
    primaryId: sync.primaryId,
    // wall intents
    play,
    pause,
    seek,
    switchChunk,
    setVolume,
    toggleMute,
    setRate,
    setMutedAll,
    setVolumeAll,
    loadAll,
    getResource,
    destroy,
    // exposed for the batteries players (Slice 1 step 3)
    videoPool,
    containerEl,
  };
}

export type UseVideoWallApi = ReturnType<typeof useVideoWall>;
