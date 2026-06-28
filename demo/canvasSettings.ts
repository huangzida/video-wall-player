import { useStorage } from '@vueuse/core';
import type { VideoWallLayoutMode } from '../src/components/VideoWallPlayer/types';
import type { ControlSize as VideoWallControlSize } from '../src';

// ponytail: 模块级单例 — DemoSettings 与 CanvasWallDemo 共享同一组 ref。
// 改任一处响应式同步，无需经 App.vue props 中转（useStorage 同 tab 跨实例
// 默认不同步，故必须共享同一 ref 对象）。
export const canvasVideoCount = useStorage('canvas-demo-video-count', 20);
export const canvasTargetFps = useStorage('canvas-demo-target-fps', 15);
export const canvasBatchSize = useStorage('canvas-demo-batch-size', 4);
export const canvasAutoplay = useStorage('canvas-demo-autoplay', true);
export const canvasMuted = useStorage('canvas-demo-muted', true);
export const canvasLoop = useStorage('canvas-demo-loop', true);
export const canvasGap = useStorage('canvas-demo-gap', 8);
export const canvasAspectRatio = useStorage('canvas-demo-aspect-ratio', 16 / 9);
export const canvasControlSize = useStorage<VideoWallControlSize>('canvas-demo-control-size', 'normal');
export const canvasLayoutMode = useStorage<VideoWallLayoutMode>('canvas-demo-layout-mode', 'auto');
export const canvasEnableFocus = useStorage('canvas-demo-enable-focus', true);
export const canvasAutoSkipOnStall = useStorage('canvas-demo-auto-skip-on-stall', true);
export const canvasStallThresholdMs = useStorage('canvas-demo-stall-threshold-ms', 500);
export const canvasMaxSkipAttempts = useStorage('canvas-demo-max-skip-attempts', 10);
export const canvasUseTextureMode = useStorage('canvas-demo-use-texture-mode', false);
