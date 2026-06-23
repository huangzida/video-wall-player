import { ref, watch, onUnmounted, type Ref, computed } from 'vue';
import { Application, Sprite, Texture, Container } from 'pixi.js';
import { useVideoWallLayout } from '../../hooks/useVideoWallLayout';
import type { VideoWallLayoutMode } from '../VideoWallPlayer/types';

export interface CanvasWallState {
  canvasContainerEl: Ref<HTMLElement | null>;
  isReady: Ref<boolean>;
  focusOn: (id: string | null) => void;
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

    // ponytail: Use PixiJS native ticker.maxFPS instead of manual setInterval.
    // VideoSource updates via Ticker.shared, so the ticker must stay running
    // for textures to update properly. maxFPS throttles both render + texture update.
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

  // --- Texture/Sprite management ---
  function createTextureForVideo(id: string): Texture | null {
    const video = videoPool.get(id);
    if (!video) return null;

    // ponytail: VideoSource requires video to have valid dimensions (loadedmetadata).
    // Use Texture.from() which handles VideoSource creation internally.
    if (!video.videoWidth || !video.videoHeight) return null;

    const texture = Texture.from(video);
    textures.set(id, texture);
    return texture;
  }

  function createSprite(id: string) {
    if (sprites.has(id)) return;
    const texture = textures.get(id) || createTextureForVideo(id);
    if (!texture) {
      // Video metadata not ready yet — retry on loadedmetadata event
      const video = videoPool.get(id);
      if (video) {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          createSprite(id);
        };
        video.addEventListener('loadedmetadata', onMeta);
      }
      return;
    }

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
      // Simple auto layout: find best cols/rows
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
      // Focused mode: only show focused sprite full-size
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

  // --- Watch for resource changes ---
  watch(
    () => resources.value.map((r) => r.id).join(','),
    () => {
      syncSprites();
    }
  );

  function syncSprites() {
    const currentIds = new Set(resources.value.map((r) => r.id));
    // Remove sprites for deleted resources
    [...sprites.keys()].forEach((id) => {
      if (!currentIds.has(id)) removeSprite(id);
    });
    // Create sprites for new resources (texture creation deferred until video exists)
    currentIds.forEach((id) => {
      if (!sprites.has(id) && videoPool.has(id)) {
        createSprite(id);
      }
    });
    layoutSprites();
  }

  // --- Watch targetFps changes ---
  watch(targetFps, () => {
    applyTargetFps();
  });

  // --- Watch backgroundColor changes ---
  watch(backgroundColor, (newColor) => {
    if (app) app.renderer.background.color = newColor;
  });

  // --- Watch layout changes ---
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
    initApp,
    attachResizeObserver,
    createSprite,
    removeSprite,
    syncSprites,
    layoutSprites,
    destroy,
  };
}
