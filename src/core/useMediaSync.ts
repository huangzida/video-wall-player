// Element-level media sync engine (headless core, ADR-0001 Slice 0).
//
// Wall-agnostic: manages a registry of { id, HTMLMediaElement } pairs, wires
// media events, tracks the primary element's state, and exposes coordinated
// intents (play/pause/seek/volume/rate) over ALL registered elements.
//
// LOCAL / single-segment semantics: state.currentTime = primaryEl.currentTime,
// state.duration = primaryEl.duration. The wall layer (useVideoWall, later
// slice) composes this and wraps currentTime/duration into global/segment-summed
// values — not this file's concern.

import { ref, reactive, onUnmounted, getCurrentInstance, toValue, type Ref, type MaybeRef } from 'vue';
import type { PlayerState } from './types';

export interface RegisteredElement {
  id: string;
  el: HTMLMediaElement; // never null once registered
}

export interface MediaSyncOptions {
  autoplay?: MaybeRef<boolean>;
  muted?: MaybeRef<boolean>;
  loop?: MaybeRef<boolean>;
  volume?: MaybeRef<number>; // 0-100, default 50
  playbackRate?: MaybeRef<number>; // default 1
  skipStepMs?: MaybeRef<number>; // stall skip step, default 100 (unifies DOM's configurable vs Canvas's hardcoded 0.1s)
  stallThresholdMs?: MaybeRef<number>; // default 500
  maxSkipAttempts?: MaybeRef<number>; // default 10
  stallCheckIntervalMs?: MaybeRef<number>; // default 200
  autoSkipOnStall?: MaybeRef<boolean>; // default true (0.0.12 parity — both players expose this prop)
  onError?: (msg: string) => void;
  // Fires when the PRIMARY element emits 'ended' (non-primary ends are desync noise,
  // ignored). useVideoWall uses this to trigger chunk-switching. NOTE: with native
  // loop=true, browsers loop silently and 'ended' never fires — so useVideoWall
  // must NOT enable loop here; it owns loop-at-segment-boundaries via this hook.
  onPrimaryEnded?: (id: string, el: HTMLMediaElement) => void;
  // initial elements (standalone convenience): useMediaSync({ initialElements: [{id, el}] })
  initialElements?: Array<{ id: string; el: HTMLMediaElement | null }>;
  initialPrimaryId?: string;
}

interface ElementState {
  isStalled: boolean;
  skipCount: number;
  startTime: number;
  lastRetryTime: number;
  isBuffering: boolean;
  isError: boolean;
}

export function useMediaSync(options: MediaSyncOptions = {}) {
  // ponytail: accept MaybeRef options — normalize to plain values at entry via
  // toValue (snapshot at setup). Prevents the silent-NaN bug when a consumer
  // passes a Ref (e.g. from toRefs(props)) where a plain value was expected —
  // arithmetic on a Ref object yields NaN and breaks loops/intervals with no
  // error. For runtime changes, callers should use the reactive setters
  // (setVolumeAll/setMutedAll/setRate) rather than mutating the option.
  // Built explicitly (not via {...options, overrides}) so TS infers plain types.
  const {
    autoplay = false,
    muted = false,
    loop = false,
    volume = 50,
    playbackRate = 1,
    skipStepMs = 100,
    stallThresholdMs = 500,
    maxSkipAttempts = 10,
    stallCheckIntervalMs = 200,
    autoSkipOnStall = true,
  } = {
    autoplay: toValue(options.autoplay),
    muted: toValue(options.muted),
    loop: toValue(options.loop),
    volume: toValue(options.volume),
    playbackRate: toValue(options.playbackRate),
    skipStepMs: toValue(options.skipStepMs),
    stallThresholdMs: toValue(options.stallThresholdMs),
    maxSkipAttempts: toValue(options.maxSkipAttempts),
    stallCheckIntervalMs: toValue(options.stallCheckIntervalMs),
    autoSkipOnStall: toValue(options.autoSkipOnStall),
  };
  const onError = options.onError ?? (() => {});
  const onPrimaryEnded = options.onPrimaryEnded;
  const initialElements = options.initialElements ?? [];
  const initialPrimaryId = options.initialPrimaryId;

  // Registry: imperative (NOT a reactive Map consumer) per the composition
  // contract (ADR-0001 slice0-boundary Q3). useVideoWall drives it via
  // register/unregister/setPrimary.
  const registry = new Map<string, HTMLMediaElement>();
  const cleanups = new Map<string, () => void>();
  const volumeMap = new Map<string, number>(); // per-id 0-100 override
  const mutedMap = new Map<string, boolean>(); // per-id mute
  // Per-element state: recovery timing (isStalled/skipCount/startTime/lastRetryTime)
  // AND UI flags (isBuffering/isError). Reactive so the wall player's per-tile
  // overlays (Recovering / loading spinner / error retry) can bind directly.
  const elementStates = reactive<Record<string, ElementState>>({});

  const primaryId = ref<string>('');
  const state = ref<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume, // 0-100
    muted, // normalized from MaybeRef
    playbackRate,
  });

  let stallCheckTimer: ReturnType<typeof setInterval> | null = null;
  let suppressTimeUpdate = false;

  // --- primary accessors ---
  function getPrimaryElement(): HTMLMediaElement | null {
    const id = primaryId.value;
    return id ? (registry.get(id) ?? null) : null;
  }

  function syncIsPlayingFromPrimary(): void {
    const el = getPrimaryElement();
    state.value.isPlaying = el ? !el.paused && !el.ended : false;
  }

  function syncCurrentTimeFromPrimary(): void {
    if (suppressTimeUpdate) return;
    const el = getPrimaryElement();
    if (el) state.value.currentTime = el.currentTime;
  }

  function syncDurationFromPrimary(): void {
    const el = getPrimaryElement();
    state.value.duration = el && Number.isFinite(el.duration) ? el.duration : 0;
  }

  // --- settings application ---
  function applySettingsToEl(id: string, el: HTMLMediaElement): void {
    el.playbackRate = state.value.playbackRate;
    // ponytail: per-id volume overrides aggregate when set; divide by 100 for 0-1.
    const perVol = volumeMap.get(id);
    el.volume = Math.max(0, Math.min(1, (perVol ?? state.value.volume) / 100));
    el.muted = mutedMap.get(id) === true;
    el.loop = !!loop;
  }

  function applySettings(): void {
    registry.forEach((el, id) => applySettingsToEl(id, el));
  }

  // --- event wiring ---
  function wireEvents(id: string, el: HTMLMediaElement): () => void {
    const onTimeUpdate = () => {
      if (id !== primaryId.value || suppressTimeUpdate) return;
      state.value.currentTime = el.currentTime;
    };
    const onPlay = () => {
      if (id === primaryId.value) syncIsPlayingFromPrimary();
    };
    const onPause = () => {
      if (id === primaryId.value) syncIsPlayingFromPrimary();
    };
    const onDurationChange = () => {
      if (id === primaryId.value) syncDurationFromPrimary();
    };
    const onWaiting = () => {
      seedStall(id);
      if (elementStates[id]) elementStates[id].isBuffering = true;
    };
    const markHealthy = () => {
      // ponytail: clear UI/stall flags but PRESERVE skipCount + timing so the
      // exponential backoff escalates across chronic micro-stall cycles (the
      // 20+ decode-saturation pattern). Previously `delete elementStates[id]`
      // here wiped skipCount on every canplay, so backoff never engaged.
      // Decay happens in checkAndRecoverStall after sustained health.
      const s = elementStates[id];
      if (!s) return;
      s.isStalled = false;
      s.isBuffering = false;
      s.isError = false;
    };
    const onPlaying = () => { markHealthy(); };
    const onCanPlay = () => { markHealthy(); };
    const onErrorEvt = () => {
      onError(`Failed to load media: ${id}`);
      // ponytail: seed stall so the recovery timer may retry a stuck/errored
      // element (mirrors DOM VideoWallPlayer behavior; Canvas omits this).
      seedStall(id);
      if (elementStates[id]) {
        elementStates[id].isError = true;
        elementStates[id].isBuffering = false;
      }
    };
    const handleEnded = () => {
      if (id !== primaryId.value) return;
      state.value.isPlaying = false;
      onPrimaryEnded?.(id, el);
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onErrorEvt);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onErrorEvt);
      el.removeEventListener('ended', handleEnded);
    };
  }

  // --- stall helpers ---
  function seedStall(id: string): void {
    if (!elementStates[id]) {
      elementStates[id] = {
        isStalled: false,
        skipCount: 0,
        startTime: Date.now(),
        lastRetryTime: 0,
        isBuffering: false,
        isError: false,
      };
    }
  }

  // --- registry API ---
  function register(id: string, el: HTMLMediaElement): void {
    if (registry.has(id)) unregister(id);
    registry.set(id, el);
    cleanups.set(id, wireEvents(id, el));
    elementStates[id] = {
      isStalled: false,
      skipCount: 0,
      startTime: 0,
      lastRetryTime: 0,
      isBuffering: false,
      isError: false,
    };
    // ponytail: 新 tile 跟随当前全局静音意图（初始 = options.muted）。
    if (!mutedMap.has(id)) mutedMap.set(id, state.value.muted);
    applySettingsToEl(id, el);
    if (!primaryId.value) {
      setPrimary(id);
    } else if (primaryId.value === id) {
      syncIsPlayingFromPrimary();
      syncCurrentTimeFromPrimary();
      syncDurationFromPrimary();
    }
  }

  function unregister(id: string): void {
    const cleanup = cleanups.get(id);
    if (cleanup) cleanup();
    cleanups.delete(id);
    volumeMap.delete(id);
    mutedMap.delete(id);
    delete elementStates[id];
    const el = registry.get(id);
    el?.pause();
    registry.delete(id);
    if (primaryId.value === id) {
      // ponytail: promote the next surviving id (insertion order) to primary
      const next = registry.keys().next();
      primaryId.value = next.done ? '' : (next.value as string);
      if (primaryId.value) {
        syncIsPlayingFromPrimary();
        syncCurrentTimeFromPrimary();
        syncDurationFromPrimary();
      } else {
        state.value.isPlaying = false;
      }
    }
  }

  function setPrimary(id: string): void {
    if (!registry.has(id)) return; // ponytail: ignore unknown id
    primaryId.value = id;
    syncIsPlayingFromPrimary();
    syncCurrentTimeFromPrimary();
    syncDurationFromPrimary();
  }

  // --- element-level ---
  function setVolume(id: string, vol: number): void {
    volumeMap.set(id, vol); // 0-100
    const el = registry.get(id);
    if (el) el.volume = Math.max(0, Math.min(1, vol / 100));
  }

  function toggleMute(id: string): void {
    const next = !mutedMap.get(id);
    mutedMap.set(id, next);
    const el = registry.get(id);
    // ponytail: 方案A — el.muted 只看 perTile，无全局 OR 压制。
    if (el) el.muted = next;
  }

  // --- aggregate intents ---
  async function play(): Promise<void> {
    const tasks: Promise<void>[] = [];
    registry.forEach((el) => {
      tasks.push(
        el.play().catch(() => {
          // ponytail: ignore autoplay rejection, user gesture needed
        })
      );
    });
    await Promise.allSettled(tasks);
    syncIsPlayingFromPrimary();
  }

  function pause(): void {
    registry.forEach((el) => el.pause());
    syncIsPlayingFromPrimary();
  }

  async function seekAllLocal(time: number): Promise<void> {
    // ponytail: Pause all before seeking to prevent async drift.
    // Each media's seek completes at different times; if some are still playing
    // while others seek, they drift out of sync.
    pause();

    // ponytail: browser clamps currentTime to [0, duration] on assignment and
    // still fires 'seeked' at the clamped position — no manual clamp needed.
    const target = Number.isFinite(time) && time > 0 ? time : 0;

    suppressTimeUpdate = true;
    // ponytail: set currentTime optimistically to the target so the progress UI
    // shows the seek destination during the async seek wait — prevents the bar
    // from jumping back to the pre-seek position between drag-release and the
    // 'seeked' event firing.
    state.value.currentTime = target;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const seekPromises: Promise<void>[] = [];
      registry.forEach((el) => {
        // ponytail: wait for each element's 'seeked' event to ensure all reach
        // the same position before playback resumes.
        seekPromises.push(
          new Promise<void>((resolve) => {
            const onSeeked = () => {
              el.removeEventListener('seeked', onSeeked);
              resolve();
            };
            el.addEventListener('seeked', onSeeked);
            el.currentTime = target;
          })
        );
      });

      // Wait for all to finish seeking (3s timeout fallback). Capture the timer
      // so we can clear it when allSettled wins — otherwise frequent seeks (drag)
      // accumulate pending 3s timers each holding closure refs.
      await Promise.race([
        Promise.allSettled(seekPromises),
        new Promise<void>((resolve) => { fallbackTimer = setTimeout(resolve, 3000); }),
      ]);

      applySettings();

      const primary = getPrimaryElement();
      if (primary) state.value.currentTime = primary.currentTime;
    } finally {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      suppressTimeUpdate = false;
    }
  }

  function setRate(rate: number): void {
    state.value.playbackRate = rate;
    registry.forEach((el) => (el.playbackRate = rate));
  }

  function setMutedAll(muted: boolean): void {
    state.value.muted = muted;
    // ponytail: 方案A — 控制栏静音 = 批量 perTile（全静音/全取消），不靠 OR。
    registry.forEach((_, id) => mutedMap.set(id, muted));
    applySettings();
  }

  function setVolumeAll(vol: number): void {
    state.value.volume = vol;
    applySettings();
  }

  // --- wait for elements to be ready after a src swap (before play) ---
  // ponytail: used by switchChunk when localTime=0 (natural segment progression).
  // A fresh src starts at position 0 — seekAllLocal(0) is pointless (no 'seeked'
  // fires → 3s timeout wasted). This waits for canplay instead + applies settings.
  async function waitForReady(timeoutMs = 5000): Promise<void> {
    const promises: Promise<void>[] = [];
    registry.forEach((el) => {
      if (el.readyState >= 2) return; // already ready
      promises.push(
        new Promise<void>((resolve) => {
          let settled = false;
          const onReady = () => { if (!settled) { settled = true; done(); } };
          const onErr = () => { if (!settled) { settled = true; done(); } };
          const fallback = setTimeout(() => { if (!settled) { settled = true; done(); } }, timeoutMs);
          function done() {
            el.removeEventListener('canplay', onReady);
            el.removeEventListener('error', onErr);
            clearTimeout(fallback);
            resolve();
          }
          el.addEventListener('canplay', onReady);
          el.addEventListener('error', onErr);
        }),
      );
    });
    await Promise.allSettled(promises);
    applySettings();
  }

  // --- stall recovery ---
  function checkAndRecoverStall(): void {
    const now = Date.now();
    // ponytail: Object.entries snapshots keys, so deleting during iteration is safe.
    for (const [id, s] of Object.entries(elementStates)) {
      // ponytail: decay — healthy for 10s since last retry resets the backoff
      // counter, so a stream that stalled early doesn't stay escalated forever.
      if (!s.isStalled && s.skipCount > 0 && s.lastRetryTime > 0 && now - s.lastRetryTime > 10000) {
        s.skipCount = 0;
      }
      if (!s.isStalled) continue;
      const el = registry.get(id);
      if (!el) continue;

      const stalledDuration = now - s.startTime;
      const timeSinceLastRetry = now - s.lastRetryTime;
      const retryInterval = Math.min(1000 + s.skipCount * 200, 2000);

      if (stalledDuration >= stallThresholdMs && timeSinceLastRetry >= retryInterval) {
        if (s.skipCount < maxSkipAttempts) {
          performAutoSkip(id, s);
        } else {
          delete elementStates[id];
        }
      }
    }
  }

  function performAutoSkip(id: string, s: ElementState): void {
    const el = registry.get(id);
    if (!el) return;

    const baseSkipAmount = skipStepMs / 1000;
    // ponytail: exponential backoff — double the skip every 3 failed attempts.
    const multiplier = Math.pow(2, Math.floor(s.skipCount / 3));
    const skipAmount = baseSkipAmount * multiplier;
    const newTime = Math.min(el.duration || Infinity, el.currentTime + skipAmount);

    s.isStalled = false;
    s.skipCount++;
    s.lastRetryTime = Date.now();

    el.pause();
    el.load();
    el.currentTime = newTime;
    // ponytail: ignore autoplay rejection after stall recovery
    const playPromise = el.play();
    if (playPromise) playPromise.catch(() => {});
  }

  function startStallCheck(): void {
    if (stallCheckTimer) return;
    stallCheckTimer = setInterval(() => {
      for (const [id, s] of Object.entries(elementStates)) {
        const el = registry.get(id);
        // ponytail: only mark stalled when the element is actually playing but not
        // ready (buffering mid-playback). A paused/never-played element at
        // readyState<3 is just freshly loaded — recovering it would auto-play
        // videos the user never asked to play (the autoplay=false bug).
        if (el && !el.paused && el.readyState < 3) s.isStalled = true;
      }
      checkAndRecoverStall();
    }, stallCheckIntervalMs);
  }

  function stopStallCheck(): void {
    if (stallCheckTimer) {
      clearInterval(stallCheckTimer);
      stallCheckTimer = null;
    }
  }

  // --- lifecycle ---
  function destroy(): void {
    stopStallCheck();
    registry.forEach((el, id) => {
      const cleanup = cleanups.get(id);
      if (cleanup) cleanup();
      el.pause();
      // ponytail: do NOT removeChild / removeAttribute('src') — useMediaSync does
      // not own these elements (the caller's template ref or useVideoWall's pool
      // owns element lifecycle). Borrow only: unwire + pause.
    });
    cleanups.clear();
    volumeMap.clear();
    mutedMap.clear();
    Object.keys(elementStates).forEach((id) => delete elementStates[id]);
    registry.clear();
    primaryId.value = '';
    state.value.isPlaying = false;
  }

  // --- init ---
  for (const { id, el } of initialElements) {
    if (el) register(id, el);
  }
  if (initialPrimaryId) setPrimary(initialPrimaryId);

  if (autoSkipOnStall) {
    startStallCheck();
  }

  if (autoplay) {
    void play();
  }

  // ponytail: only hook onUnmounted when inside a component instance; standalone
  // usage outside setup (rare) must call destroy() manually.
  if (getCurrentInstance()) {
    onUnmounted(() => destroy());
  }

  return {
    // registry
    register,
    unregister,
    setPrimary,
    // element-level
    setVolume,
    toggleMute,
    // aggregate intents
    play,
    pause,
    seekAllLocal,
    waitForReady,
    setRate,
    setMutedAll,
    setVolumeAll,
    // lifecycle
    destroy,
    // reactive state (local / single-segment semantics — primary-driven)
    state: state as Readonly<Ref<PlayerState>>,
    // per-element UI/recovery state (reactive record; template reads [id]?.isStalled etc.)
    elementStates,
    getPrimaryElement,
    primaryId: primaryId as Readonly<Ref<string>>,
  };
}

export type MediaSyncApi = ReturnType<typeof useMediaSync>;
