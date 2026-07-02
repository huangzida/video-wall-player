// Core shared types for the headless media engine.
// Wall-agnostic: no imports from ../components/* — wall-specific types do not
// belong here (see ADR-0001 "core must be wall-agnostic").

/**
 * Canonical normalized resource (output of `normalizeResource`).
 * Invariants after normalization:
 * - `chunkUrls.length >= 1`
 * - `durations.length === chunkUrls.length`
 * - every duration is `>= 0` (`0` means "unknown / metadata not loaded")
 */
export interface MediaResource {
  id: string;
  name: string;
  chunkUrls: string[]; // always >= 1 entry after normalize
  durations: number[]; // always >= 1 entry, aligned with chunkUrls; 0 if unknown
  poster?: string;
  segmentNames?: string[]; // custom display names per segment, aligned with chunkUrls; falls back to "Segment N"
  segmentDates?: (string | number)[]; // per-segment date: ISO string ("2026-07-01" or "2026-07-01T14:30:00") OR epoch ms; aligned with chunkUrls; absent entry = no date
}

/** Shared required id/name/poster fields for the object input shapes. */
interface MediaResourceObjectBase {
  id: string;
  name: string;
  poster?: string;
}

/**
 * Accepted input shapes for `normalizeResource` (Q4 shorthand union):
 * - `string`                                → single src, id + duration unknown
 * - `{ id, name, src, poster? }`            → single src shorthand
 * - `{ id, name, chunkUrls, poster? }`      → multi-segment, durations unknown
 * - `{ id, name, chunkUrls, durations, poster? }` → full (0.0.12 shape)
 */
export type MediaResourceInput =
  | string
  | (MediaResourceObjectBase & { src: string })
  | (MediaResourceObjectBase & { chunkUrls: string[]; durations?: number[]; segmentNames?: string[]; segmentDates?: (string | number)[] });

/**
 * Player state shape (consumed by `<PlayerControls>`, exposed by
 * `useMediaSync`). `volume` is 0-100 (the hook converts to 0-1 for the media
 * element). `currentTime`/`duration` follow local (single-segment) semantics
 * under `useMediaSync`; `useVideoWall` wraps them into global semantics.
 */
export interface PlayerState {
  isPlaying: boolean;
  currentTime: number; // local (single-segment) semantics
  duration: number; // local
  volume: number; // 0-100
  muted: boolean;
  playbackRate: number;
}

/** Result of global-time -> segment lookup. */
export interface SegmentLocation {
  chunkIndex: number;
  localTime: number;
}

/**
 * Control bar sizing (was VideoWallControlSize). Generic — any presentational
 * media control can use it. Kept in core so PlayerControls doesn't import wall types.
 */
export type ControlSize = 'small' | 'normal' | 'large';

/**
 * Timeline marker on the progress bar (was VideoWallTag). Generic concept — any
 * media player can have tagged moments. Renamed to drop the wall prefix.
 */
export interface TimelineTag {
  id?: string | number;
  time: number;
  name: string;
  color?: string;
}
