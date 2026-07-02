// Pure media math helpers. No state, no Vue refs, no wall types.
// Extracted from the 0.0.12 DOM (`VideoWallPlayer/index.vue`) and Canvas
// (`CanvasWallPlayer/useVideoSources.ts`) engines; see ADR-0001 Slice 0.

import type {
  MediaResource,
  MediaResourceInput,
  SegmentLocation,
} from './types';

/**
 * Cumulative segment start times: `[0, d0, d0+d1, ...]`.
 * Each `d` is clamped to `>= 0` (negatives/NaN treated as 0).
 * Empty input -> `[]`.
 *
 * (DOM `segmentStarts` compute / Canvas `getSegmentStarts` line 114, stripped
 * of the `resources.value` closure read.)
 */
export function getSegmentStarts(durations: number[]): number[] {
  const starts: number[] = [];
  let total = 0;
  for (const d of durations) {
    starts.push(total);
    total += Math.max(0, d || 0);
  }
  return starts;
}

/**
 * Sum of segment durations, each clamped to `>= 0`.
 * (DOM `duration` compute line 309 / Canvas `updateDuration` line 102.)
 */
export function sumDurations(durations: number[]): number {
  return durations.reduce((sum, d) => sum + Math.max(0, d || 0), 0);
}

/**
 * Map a global playback time onto `(chunkIndex, localTime)`.
 * `target` is clamped into `[0, totalDuration]`; a target past the end lands on
 * the last segment. Empty `durations` -> `{ chunkIndex: 0, localTime: 0 }`.
 *
 * (DOM `locateByGlobalTime` line 589, refactored to take `durations` and
 * compute starts internally via `getSegmentStarts`.)
 */
export function locateByGlobalTime(
  target: number,
  durations: number[],
): SegmentLocation {
  if (durations.length === 0) {
    return { chunkIndex: 0, localTime: 0 };
  }
  const total = sumDurations(durations);
  const safeTarget = Math.max(0, Math.min(total, target));
  const starts = getSegmentStarts(durations);
  for (let index = 0; index < durations.length; index += 1) {
    const start = starts[index];
    const end = start + Math.max(0, durations[index] || 0);
    if (safeTarget < end || index === durations.length - 1) {
      return { chunkIndex: index, localTime: Math.max(0, safeTarget - start) };
    }
  }
  return { chunkIndex: durations.length - 1, localTime: 0 };
}

/**
 * Clamp a local seek time into a segment: `[0, max(0, segDur - 0.05)]`.
 * NaN/non-finite `localTime` -> 0. The 0.05s headroom avoids seeking exactly
 * to a segment's end (which some browsers round up past the chunk boundary).
 *
 * (DOM `safeLocalTime` line 548 / Canvas `safeTime` line 240.)
 */
export function clampDuration(localTime: number, segDur: number): number {
  if (!Number.isFinite(localTime)) return 0;
  return Math.max(0, Math.min(localTime, Math.max(0, segDur - 0.05)));
}

// ponytail: crypto.randomUUID when available; fall back to Math.random for
// non-secure runtimes (SSR / old node). This is an identity key, not a
// security primitive — collisions across resources in one wall are tolerable.
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * Normalize any `MediaResourceInput` shorthand into the canonical
 * `MediaResource`. See ADR-0001 Q4.
 *
 * - `string` -> `{ id: genId(), name: '', chunkUrls: [s], durations: [0] }`
 * - `{ id, name, src }` -> single-chunk, duration unknown
 * - `{ id, name, chunkUrls }` -> durations all 0 (unknown)
 * - `{ id, name, chunkUrls, durations }` -> aligned/padded/clamped to chunkUrls
 *
 * Throws when `chunkUrls` is empty (fail loud — an empty resource is a caller
 * bug, not something to paper over with a sentinel).
 */
export function normalizeResource(input: MediaResourceInput): MediaResource {
  if (typeof input === 'string') {
    return { id: genId(), name: '', chunkUrls: [input], durations: [0] };
  }

  const { id, name, poster } = input;

  // `{ src }` shorthand -> single chunk.
  if ('src' in input) {
    const result: MediaResource = {
      id,
      name,
      chunkUrls: [input.src],
      durations: [0],
    };
    if (poster !== undefined) result.poster = poster;
    return result;
  }

  // `{ chunkUrls, durations? }` form.
  if (!input.chunkUrls || input.chunkUrls.length === 0) {
    throw new Error('normalizeResource: chunkUrls must have >= 1 entry');
  }

  const raw = input.durations ?? [];
  // Align to chunkUrls length: pad missing with 0, drop extras, clamp negatives.
  const durations = input.chunkUrls.map((_, i) => {
    const d = raw[i];
    return typeof d === 'number' && Number.isFinite(d) ? Math.max(0, d) : 0;
  });

  const result: MediaResource = { id, name, chunkUrls: input.chunkUrls, durations };
  if (poster !== undefined) result.poster = poster;
  // Align segmentNames to chunkUrls length (like durations), padding with undefined.
  const rawNames = input.segmentNames;
  if (rawNames && rawNames.length > 0) {
    result.segmentNames = input.chunkUrls.map((_, i) => rawNames[i] ?? `Segment ${i + 1}`);
  }
  // ponytail: pass-through segmentDates (mirror poster, not segmentNames). Per-index
  // undefined is meaningful (no date → UI "Other" bucket); padding would fabricate dates.
  if (input.segmentDates !== undefined) result.segmentDates = input.segmentDates;
  return result;
}
