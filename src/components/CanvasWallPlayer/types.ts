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
