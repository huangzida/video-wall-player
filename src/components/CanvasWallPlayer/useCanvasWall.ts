import { ref, watch, onUnmounted, type Ref, computed } from 'vue';
import { Application, Sprite, Texture, VideoSource, Container } from 'pixi.js';
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
  let renderTimer: ReturnType<typeof setInterval> | null = null;
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

    // ponytail: PixiJS v8 requires async init(), constructor no longer accepts options
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

    // Stop auto-render, use manual render at target fps
    app.ticker.stop();
    startRenderLoop();

    isReady.value = true;
  }

  function startRenderLoop() {
    if (renderTimer) clearInterval(renderTimer);
    const fps = Math.max(1, targetFps.value);
    const interval = 1000 / fps;
    renderTimer = setInterval(() => {
      if (app) app.render();
    }, interval);
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

    // ponytail: PixiJS v8 uses Texture + VideoSource, no separate VideoTexture class.
    // autoUpdate defaults to true; updateFPS=0 means update every render.
    const source = new VideoSource({
      resource: video,
      autoPlay: false,
    });
    const texture = new Texture({ source });
    textures.set(id, texture);
    return texture;
  }

  function createSprite(id: string) {
    if (sprites.has(id)) return;
    const texture = textures.get(id) || createTextureForVideo(id);
    if (!texture) return;

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
    if (currentLayout.itemWidth <= 0 || currentLayout.itemHeight <= 0) return;

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
    spriteList.forEach((sprite, index) => {
      const row = Math.floor(index / currentLayout.cols);
      const col = index % currentLayout.cols;
      sprite.visible = true;
      sprite.width = currentLayout.itemWidth;
      sprite.height = currentLayout.itemHeight;
      sprite.position.set(
        col * (currentLayout.itemWidth + gap.value),
        row * (currentLayout.itemHeight + gap.value)
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
    startRenderLoop();
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
    if (renderTimer) {
      clearInterval(renderTimer);
      renderTimer = null;
    }
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
