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

    const onErrorEvt = () => {
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
    video.addEventListener('error', onErrorEvt);
    video.addEventListener('ended', onEnded);

    // Store cleanup refs on the element for removal later
    (video as any).__cleanup = () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onErrorEvt);
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

      // ponytail: skip reload if same src already loaded or loading
      if (video.src === chunkUrl || video.src === new URL(chunkUrl, location.href).href) {
        if (video.readyState >= 2) {
          onStreamReady(r.id);
          resolve();
          return;
        }
        // Same src but not ready yet — wait for existing load
        let settled = false;
        const onReady = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener('canplay', onReady);
          video.removeEventListener('error', onErr);
          onStreamReady(r.id);
          resolve();
        };
        const onErr = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener('canplay', onReady);
          video.removeEventListener('error', onErr);
          resolve();
        };
        video.addEventListener('canplay', onReady);
        video.addEventListener('error', onErr);
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
    videoPool.forEach((video) => {
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

  // Start stall check on creation
  startStallCheck();

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
