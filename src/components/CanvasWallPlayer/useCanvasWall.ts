import { ref, watch, onUnmounted, type Ref, computed } from 'vue';
import { Application, Sprite, Texture, Container } from 'pixi.js';
import { useVideoWallLayout } from '../../hooks/useVideoWallLayout';
import type { VideoWallLayoutMode } from '../VideoWallPlayer/types';

export interface CanvasWallState {
  canvasContainerEl: Ref<HTMLElement | null>;
  isReady: Ref<boolean>;
  focusOn: (id: string | null) => void;
  hitTest: (x: number, y: number) => string | null;
  initApp: () => Promise<void>;
  attachResizeObserver: () => void;
  createSprite: (id: string) => void;
  removeSprite: (id: string) => void;
  syncSprites: () => void;
  layoutSprites: () => void;
  destroy: () => void;
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

// ponytail: VideoBridge — 2D canvas intermediate to avoid Chrome's glCopySubTextureCHROMIUM
// video texture optimization bug. Each video is drawn to its own small 2D canvas via
// drawImage(), then PixiJS creates a texture from the canvas (CanvasSource). CanvasSource
// uses a different GPU upload path that doesn't trigger the buggy video texture copy.
// The bridge canvas updates are driven by PixiJS ticker, throttled to targetFps.
// Ceiling: one extra canvas per video + drawImage per frame. For 20 videos at 15fps,
// that's 300 drawImage calls/sec — negligible vs the GPU decode savings.
class VideoBridge {
  readonly video: HTMLVideoElement;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private onFirstFrame: (() => void) | null = null;
  private _drawErrorLogged = false;

  constructor(video: HTMLVideoElement, maxBridgeWidth = 320) {
    this.video = video;
    // ponytail: Downscale bridge canvas to maxBridgeWidth for performance.
    // A 320x180 tile doesn't need a 640x360 bridge — halving resolution
    // cuts drawImage + GPU upload cost by ~4x per frame.
    const srcW = video.videoWidth || 16;
    const srcH = video.videoHeight || 16;
    const scale = Math.min(1, maxBridgeWidth / srcW);
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(srcW * scale);
    this.canvas.height = Math.round(srcH * scale);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Returns a Promise that resolves when the first frame is drawn to the bridge canvas.
  waitForFirstFrame(): Promise<void> {
    return new Promise((resolve) => {
      // If video already has data, draw immediately
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
        this.drawFrame();
        resolve();
        return;
      }
      this.onFirstFrame = resolve;
      // Listen for loadeddata as fallback
      const handler = () => {
        this.video.removeEventListener('loadeddata', handler);
        if (this.onFirstFrame) {
          this.drawFrame();
          this.onFirstFrame();
          this.onFirstFrame = null;
        }
      };
      this.video.addEventListener('loadeddata', handler);
    });
  }

  // Draw current video frame to the bridge canvas. Called every render tick.
  // ponytail: Only draw when video is actively playing. When paused, skip to avoid
  // triggering unnecessary range requests for video data the user hasn't requested.
  drawFrame(): void {
    if (this.video.paused) return;
    if (this.video.readyState >= 2) {
      try {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      } catch (e) {
        // ponytail: log once per bridge to avoid console spam
        if (!this._drawErrorLogged) {
          this._drawErrorLogged = true;
          console.error('[VideoBridge] drawImage failed', e, {
            readyState: this.video.readyState,
            videoWidth: this.video.videoWidth,
            videoHeight: this.video.videoHeight,
            canvasW: this.canvas.width,
            canvasH: this.canvas.height,
          });
        }
      }
    }
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.onFirstFrame = null;
  }
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
  } = options;

  const canvasContainerEl = ref<HTMLElement | null>(null);
  const isReady = ref(false);

  let app: Application | null = null;
  let stageContainer: Container | null = null;
  const sprites = new Map<string, Sprite>();
  const textures = new Map<string, Texture>();
  const bridges = new Map<string, VideoBridge>();
  let focusedId: string | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const itemCount = computed(() => resources.value.length);

  const layoutOpts = computed(() => ({
    aspectRatio: aspectRatio.value,
    gap: gap.value,
    layoutMode: layoutMode.value,
  }));

  const { containerRef, layout } = useVideoWallLayout(itemCount, layoutOpts);

  // Sync containerRef to canvasContainerEl
  watch(canvasContainerEl, (el) => {
    (containerRef as any).value = el;
  });

  async function initApp() {
    if (!canvasContainerEl.value) return;

    app = new Application();
    await app.init({
      background: backgroundColor.value,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      powerPreference: 'high-performance',
      width: canvasContainerEl.value.clientWidth || 800,
      height: canvasContainerEl.value.clientHeight || 600,
    });

    canvasContainerEl.value.appendChild(app.canvas);

    stageContainer = new Container();
    app.stage.addChild(stageContainer);

    // ponytail: Ticker callback draws all video frames to their bridge canvases, then
    // manually updates PixiJS texture sources. CanvasSource does NOT auto-detect canvas
    // content changes, so we must call source.update() after each drawImage().
    // Performance: skip hidden sprites (e.g. when focused on one) and paused videos.
    app.ticker.add(() => {
      sprites.forEach((sprite, id) => {
        if (!sprite.visible) return; // skip hidden sprites in focus mode
        const bridge = bridges.get(id);
        if (!bridge) return;
        bridge.drawFrame(); // internally skips if video.paused
        const tex = textures.get(id);
        if (tex) tex.source.update();
      });
    });

    applyTargetFps();
    isReady.value = true;
  }

  function applyTargetFps() {
    if (!app) return;
    app.ticker.maxFPS = Math.max(1, targetFps.value);
  }

  function resizeCanvas() {
    if (!app || !canvasContainerEl.value) return;
    app.renderer.resize(
      canvasContainerEl.value.clientWidth,
      canvasContainerEl.value.clientHeight
    );
    layoutSprites();
  }

  const pendingTextureIds = new Set<string>();

  // --- Texture/Sprite management ---
  function createTextureForVideoAsync(id: string): Promise<Texture | null> {
    const video = videoPool.get(id);
    if (!video) return Promise.resolve(null);

    const bridge = new VideoBridge(video);
    bridges.set(id, bridge);

    return bridge.waitForFirstFrame().then(() => {
      const texture = Texture.from(bridge.canvas);
      textures.set(id, texture);
      return texture;
    }).catch(() => {
      bridge.destroy();
      bridges.delete(id);
      return null;
    });
  }

  function createSprite(id: string) {
    if (sprites.has(id)) return;
    if (pendingTextureIds.has(id)) return;

    const existingTexture = textures.get(id);
    if (existingTexture) {
      doCreateSprite(id, existingTexture);
      return;
    }

    const video = videoPool.get(id);
    if (!video) return;
    pendingTextureIds.add(id);

    createTextureForVideoAsync(id).then((texture) => {
      pendingTextureIds.delete(id);
      if (!texture) return;
      doCreateSprite(id, texture);
    });
  }

  function doCreateSprite(id: string, texture: Texture) {
    if (sprites.has(id)) return;
    const sprite = new Sprite(texture);
    sprite.eventMode = 'static';
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
    const bridge = bridges.get(id);
    if (bridge) {
      bridge.destroy();
      bridges.delete(id);
    }
    layoutSprites();
  }

  function layoutSprites() {
    if (!app || !stageContainer) return;

    const currentLayout = layout.value;

    // ponytail: layout.value may have itemWidth=0 if ResizeObserver hasn't fired yet.
    // Fallback: compute directly from container dimensions.
    let itemWidth = currentLayout.itemWidth;
    let itemHeight = currentLayout.itemHeight;
    let cols = currentLayout.cols;

    if (itemWidth <= 0 || itemHeight <= 0) {
      const cw = canvasContainerEl.value?.clientWidth || 0;
      const ch = canvasContainerEl.value?.clientHeight || 0;
      if (cw <= 0 || ch <= 0) return;
      const count = sprites.size;
      if (count <= 0) return;
      let best = { cols: 1, rows: 1, area: 0 };
      for (let c = 1; c <= count; c++) {
        const r = Math.ceil(count / c);
        const totalGapX = Math.max(0, c - 1) * gap.value;
        const totalGapY = Math.max(0, r - 1) * gap.value;
        const aw = cw - totalGapX;
        const ah = ch - totalGapY;
        if (aw <= 0 || ah <= 0) continue;
        let iw = aw / c;
        let ih = iw / aspectRatio.value;
        if (ih > ah / r) {
          ih = ah / r;
          iw = ih * aspectRatio.value;
        }
        const area = iw * ih;
        if (area > best.area) {
          best = { cols: c, rows: r, area };
        }
      }
      cols = best.cols;
      itemWidth = best.area > 0 ? Math.sqrt(best.area * aspectRatio.value) : cw / cols;
      itemHeight = itemWidth / aspectRatio.value;
    }

    if (focusedId) {
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
    const totalRows = Math.ceil(spriteList.length / cols);
    const totalGridW = cols * itemWidth + Math.max(0, cols - 1) * gap.value;
    const totalGridH = totalRows * itemHeight + Math.max(0, totalRows - 1) * gap.value;
    const offsetX = Math.max(0, (app.renderer.width - totalGridW) / 2);
    const offsetY = Math.max(0, (app.renderer.height - totalGridH) / 2);

    spriteList.forEach((sprite, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      sprite.visible = true;
      sprite.width = itemWidth;
      sprite.height = itemHeight;
      sprite.position.set(
        offsetX + col * (itemWidth + gap.value),
        offsetY + row * (itemHeight + gap.value)
      );
    });
  }

  function focusOn(id: string | null) {
    focusedId = id;
    layoutSprites();
  }

  // ponytail: Manual hit test against sprite bounds. Iterates sprites and checks
  // if the point (in canvas CSS pixels) falls within any sprite's rectangle.
  function hitTest(x: number, y: number): string | null {
    for (const [id, sprite] of sprites) {
      if (!sprite.visible) continue;
      const sx = sprite.x;
      const sy = sprite.y;
      const sw = sprite.width;
      const sh = sprite.height;
      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return id;
      }
    }
    return null;
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
    [...sprites.keys()].forEach((id) => {
      if (!currentIds.has(id)) removeSprite(id);
    });
    currentIds.forEach((id) => {
      if (!sprites.has(id) && videoPool.has(id)) {
        createSprite(id);
      }
    });
    layoutSprites();
  }

  watch(targetFps, () => {
    applyTargetFps();
  });

  watch(backgroundColor, (newColor) => {
    if (app) app.renderer.background.color = newColor;
  });

  watch(layout, () => {
    layoutSprites();
  }, { deep: true });

  watch([aspectRatio, gap, layoutMode], () => {
    layoutSprites();
  });

  function attachResizeObserver() {
    if (!canvasContainerEl.value) return;
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvasContainerEl.value);
  }

  // --- Cleanup ---
  function destroy() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    bridges.forEach((b) => b.destroy());
    bridges.clear();
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
    hitTest,
    initApp,
    attachResizeObserver,
    createSprite,
    removeSprite,
    syncSprites,
    layoutSprites,
    destroy,
  };
}
