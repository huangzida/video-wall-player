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
  createSprite: (id: string) => Promise<void>;
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
  useTextureMode: Ref<boolean>;
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

  constructor(video: HTMLVideoElement) {
    this.video = video;
    // Use native video resolution — GPU handles scaling on upload.
    this.canvas = document.createElement('canvas');
    this.canvas.width = video.videoWidth || 16;
    this.canvas.height = video.videoHeight || 16;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Returns a Promise that resolves once the video is ready enough to create a
  // correctly-sized texture (readyState>=2 + videoWidth known). Robust against the
  // race where loadedmetadata/loadeddata already fired before we listened (which
  // would hang the promise and leave that sprite uncreated). Does NOT draw the
  // first frame — paused walls show a play-button overlay instead (reliable DOM
  // vs the flaky force-first-frame approach).
  waitForFirstFrame(): Promise<void> {
    return new Promise((resolve) => {
      const tryReady = (): boolean => {
        if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
          // Ensure canvas matches native video resolution BEFORE the texture is
          // created — texture dimensions are fixed at creation, and the constructor
          // may have sized this canvas 16x16 before metadata arrived.
          const vw = this.video.videoWidth;
          const vh = this.video.videoHeight;
          if (this.canvas.width !== vw || this.canvas.height !== vh) {
            this.canvas.width = vw;
            this.canvas.height = vh;
          }
          return true;
        }
        return false;
      };
      if (tryReady()) { resolve(); return; }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.video.removeEventListener('loadedmetadata', onReady);
        this.video.removeEventListener('loadeddata', onReady);
        this.video.removeEventListener('canplay', onReady);
        clearTimeout(fallback);
        tryReady();
        resolve();
      };
      // loadedmetadata brings videoWidth; loadeddata/canplay bring readyState>=2.
      // Listen to all three since any may have already fired by now.
      const onReady = () => { if (tryReady()) finish(); };
      this.video.addEventListener('loadedmetadata', onReady);
      this.video.addEventListener('loadeddata', onReady);
      this.video.addEventListener('canplay', onReady);
      // ponytail: never hang — resolve so the wall proceeds; the canvas may stay
      // black but the CanvasWallPlayer's play-button overlay covers it.
      const fallback = setTimeout(finish, 3000);
    });
  }

  // Draw current video frame to the bridge canvas. Called every render tick.
  // Returns true if a frame was actually drawn (video playing + data ready).
  // `force` overrides the paused-skip — used by waitForFirstFrame so the first
  // frame is drawn even when autoplay is off (otherwise the sprite stays black
  // until the user hits play, acting as a built-in poster).
  drawFrame(): boolean {
    if (this.video.paused) return false;
    if (this.video.readyState >= 2) {
      // Resize bridge canvas to native video resolution if dimensions are now
      // known but differ (constructor may have sized it 16x16 before metadata).
      const vw = this.video.videoWidth;
      const vh = this.video.videoHeight;
      if (vw > 0 && vh > 0 && (this.canvas.width !== vw || this.canvas.height !== vh)) {
        this.canvas.width = vw;
        this.canvas.height = vh;
      }
      try {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        return true;
      } catch (e) {
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
    return false;
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
    useTextureMode,
  } = options;

  const canvasContainerEl = ref<HTMLElement | null>(null);
  const isReady = ref(false);

  let app: Application | null = null;
  let stageContainer: Container | null = null;
  const sprites = new Map<string, Sprite>();
  const textures = new Map<string, Texture>();
  const bridges = new Map<string, VideoBridge>();
  // Combined entry for ticker hot path — avoids 2x Map.get per frame per sprite
  const spriteEntries = new Map<string, { sprite: Sprite; bridge?: VideoBridge; texture?: Texture }>();
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
      resolution: 1, // Fixed: avoid 4x GPU overhead on HiDPI screens
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
    // In texture mode, PixiJS VideoSource auto-updates — no manual work needed.
    // Performance: skip hidden sprites (e.g. when focused on one) and paused videos.
    app.ticker.add(() => {
      if (useTextureMode.value) return; // VideoSource handles updates automatically
      spriteEntries.forEach((entry) => {
        if (!entry.sprite.visible) return;
        if (!entry.bridge || !entry.texture) return;
        if (entry.bridge.drawFrame()) {
          entry.texture.source.update();
        }
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

    // Texture mode: direct Texture.from(video), let PixiJS VideoSource handle updates.
    // skipCache=true: avoid Cache returning stale/destroyed textures when video pool reuses elements.
    if (useTextureMode.value) {
      return new Promise((resolve) => {
        const createAndResolve = () => {
          // VideoSource.load() auto-registers canplay/canplaythrough and resolves when isValid.
          // We just need videoWidth>0 to ensure the VideoSource constructor gets valid dimensions.
          const texture = Texture.from(video, true);
          textures.set(id, texture);
          resolve(texture);
        };
        if (video.readyState >= 2 && video.videoWidth > 0) {
          createAndResolve();
        } else {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            if (video.videoWidth && video.videoHeight) {
              createAndResolve();
            } else {
              resolve(null);
            }
          };
          video.addEventListener('loadeddata', onReady);
        }
      });
    }

    // Bridge mode: 2D canvas intermediate to avoid Chrome video texture bug
    const bridge = new VideoBridge(video);
    bridges.set(id, bridge);

    return bridge.waitForFirstFrame().then(() => {
      const texture = Texture.from(bridge.canvas, true);
      textures.set(id, texture);
      return texture;
    }).catch(() => {
      bridge.destroy();
      bridges.delete(id);
      return null;
    });
  }

  function createSprite(id: string): Promise<void> {
    if (sprites.has(id)) return Promise.resolve();
    if (pendingTextureIds.has(id)) return Promise.resolve();

    const existingTexture = textures.get(id);
    if (existingTexture) {
      doCreateSprite(id, existingTexture);
      return Promise.resolve();
    }

    const video = videoPool.get(id);
    if (!video) return Promise.resolve();
    pendingTextureIds.add(id);

    return createTextureForVideoAsync(id).then((texture) => {
      pendingTextureIds.delete(id);
      if (!texture) return;
      doCreateSprite(id, texture);
    });
  }

  let layoutScheduled = false;
  function scheduleLayout() {
    if (layoutScheduled) return;
    layoutScheduled = true;
    requestAnimationFrame(() => {
      layoutScheduled = false;
      layoutSprites();
    });
  }

  function doCreateSprite(id: string, texture: Texture) {
    if (sprites.has(id)) return;
    const sprite = new Sprite(texture);
    sprite.eventMode = 'static';
    sprite.label = id;
    stageContainer?.addChild(sprite);
    sprites.set(id, sprite);
    spriteEntries.set(id, { sprite, bridge: bridges.get(id), texture });
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
    spriteEntries.delete(id);
    scheduleLayout();
  }

  function layoutSprites() {
    if (!app || !stageContainer) return;

    const { itemWidth, itemHeight, cols } = layout.value;

    // Wait for useVideoWallLayout to provide valid dimensions
    if (itemWidth <= 0 || itemHeight <= 0) return;

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
    const createPromises: Promise<void>[] = [];
    currentIds.forEach((id) => {
      if (!sprites.has(id) && videoPool.has(id)) {
        createPromises.push(createSprite(id));
      }
    });
    // Layout once after all sprites are created
    if (createPromises.length > 0) {
      void Promise.all(createPromises).then(() => layoutSprites());
    } else {
      layoutSprites();
    }
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
    spriteEntries.clear();
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
