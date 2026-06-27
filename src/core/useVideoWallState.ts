// useVideoWallState — pure wall state & math, NO elements.
//
// Shared single source of truth for segment math + chunk progression, consumed by:
//   - useVideoWall (Canvas: pool-based, composes this + useMediaSync)
//   - VideoWallPlayer (DOM: template <video>/<audio> tiles, composes this + useMediaSync)
//
// Extracting the pure wall logic here kills the drift between the two players'
// orchestration (ADR-0001 — the "two engines drifted" problem). Each player owns
// only its element-management + switchChunk specialization; the math/state lives here.
//
// LOCAL vs GLOBAL: this layer holds the segment math. The element layer
// (useMediaSync) holds LOCAL (per-chunk) currentTime/duration. computeGlobalState
// bridges them: global currentTime = segmentStart[activeChunk] + local.currentTime.

import { ref, computed, isRef, type Ref } from 'vue';
import {
  normalizeResource,
  getSegmentStarts,
  sumDurations,
  locateByGlobalTime,
} from './media-math';
import type {
  MediaResource,
  MediaResourceInput,
  PlayerState,
  SegmentLocation,
} from './types';

export interface UseVideoWallStateOptions {
  resources: MediaResourceInput[] | Ref<MediaResourceInput[]>;
  /** Wall-level loop: when the primary ends on the last segment, wrap to segment 0. */
  loop?: boolean;
}

export function useVideoWallState(options: UseVideoWallStateOptions) {
  const { resources: resourcesOpt, loop = false } = options;
  const resourcesRef = isRef(resourcesOpt) ? resourcesOpt : ref(resourcesOpt);

  const normalized = computed(() => resourcesRef.value.map(normalizeResource));
  const primaryResource = computed(() => normalized.value[0]);
  const segmentDurations = computed(() => primaryResource.value?.durations ?? []);
  const segmentStarts = computed(() => getSegmentStarts(segmentDurations.value));
  const totalDuration = computed(() => sumDurations(segmentDurations.value));
  const segmentCount = computed(() => primaryResource.value?.chunkUrls.length ?? 0);

  const activeChunkIndex = ref(0);

  /**
   * Bridge LOCAL (per-chunk, from useMediaSync) state into GLOBAL (segment-summed)
   * state. global.currentTime = segmentStart[activeChunk] + local.currentTime;
   * global.duration = totalDuration (segment-summed, NOT per-chunk).
   */
  function computeGlobalState(local: PlayerState): PlayerState {
    const segStart = segmentStarts.value[activeChunkIndex.value] || 0;
    return {
      ...local,
      currentTime: segStart + local.currentTime,
      duration: totalDuration.value,
    };
  }

  /** Global seek time → (chunkIndex, localTime) within the segment timeline. */
  function locateSeek(globalTime: number): SegmentLocation {
    return locateByGlobalTime(globalTime, segmentDurations.value);
  }

  /**
   * Chunk progression on primary ended. Returns the next chunk index to switch to,
   * or null if playback should stop (last segment reached and loop is off).
   * The CALLER owns the actual switch (element src swap is per-player).
   */
  function nextChunkOnEnded(): number | null {
    const total = segmentCount.value;
    if (total <= 0) return null;
    if (activeChunkIndex.value >= total - 1) {
      return loop ? 0 : null;
    }
    return activeChunkIndex.value + 1;
  }

  /** Set active chunk, clamped into the primary's valid range. */
  function setActiveChunk(idx: number): void {
    const max = Math.max(0, segmentCount.value - 1);
    activeChunkIndex.value = Math.max(0, Math.min(idx, max));
  }

  function getResource(id: string): MediaResource | undefined {
    return normalized.value.find((r) => r.id === id);
  }

  return {
    resourcesRef,
    normalized,
    primaryResource,
    segmentDurations,
    segmentStarts,
    totalDuration,
    segmentCount,
    activeChunkIndex: activeChunkIndex as Readonly<Ref<number>>,
    computeGlobalState,
    locateSeek,
    nextChunkOnEnded,
    setActiveChunk,
    getResource,
  };
}

export type UseVideoWallStateApi = ReturnType<typeof useVideoWallState>;
