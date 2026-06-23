# CanvasWallPlayer 设计文档

## 背景与动机

VideoWallPlayer 在同屏 20 路视频时，因浏览器为每个 `<video>` 元素创建独立合成层（Compositing Layer），导致 GPU 合成压力大、主线程 DOM 开销高，在 HD 530 等较弱 GPU 上出现持续 loading 和卡顿。

CanvasWallPlayer 用 PixiJS 将所有视频帧合成到单个 Canvas，减少合成层数量并支持可配置渲染帧率，降低渲染层开销。

### 明确的边界

- 本方案只改善**合成/渲染层**开销，不解决**视频解码**瓶颈
- `<video>` 元素仍全速解码，解码器实例数由 GPU 硬件决定
- 真正降低解码压力需服务端提供低分辨率/低帧率版本

## 技术选型

| 维度 | 选择 | 原因 |
|---|---|---|
| 视频源 | `<video>` + `VideoTexture` | 保留音频，实现简单 |
| 渲染引擎 | PixiJS v8 | 成熟的 WebGL/WebGPU 2D 引擎，VideoTexture 支持完善 |
| 帧率控制 | 自定义 ticker 节流 | 控制 `app.render()` 频率 |
| 同步模型 | 主从同步（复用现有逻辑） | 与 VideoWallPlayer 一致 |

## 架构

### 组件结构

```
CanvasWallPlayer/
├── index.vue                  # 组件入口，管理生命周期和 props
├── types.ts                   # 复用 VideoWallResource，新增 CanvasWallProps
├── useCanvasWall.ts           # PixiJS app + 渲染循环 + 布局映射
├── useVideoSources.ts         # 隐藏 video 管理 + 分批加载 + 主从同步 + 卡顿检测
└── useCanvasInteraction.ts    # 双击聚焦 + 命中检测
```

### 与现有代码的关系

- **零修改** VideoWallPlayer 及其子模块
- 复用 `useVideoWallLayout`（只读引用，不修改）
- 复用 `PlayerControls`（直接引用，不修改）
- 同步逻辑在 `useVideoSources` 中独立实现，不抽取 VideoWallPlayer 的代码

### 数据流

```
props.resources
     ↓
useVideoSources: 创建隐藏 <video> 池 (preload="none")
     ↓
分批赋值 src (每批 4 路) → 各自 canplay
     ↓
useCanvasWall: 为每路创建 VideoTexture + Sprite
     ↓
useVideoWallLayout: 计算网格 → 映射到 sprite 位置/尺寸
     ↓
自定义 ticker: 按 targetFps 调用 app.render()
```

## 核心设计

### 1. 隐藏 video 元素池

不通过 Vue 模板渲染（避免响应式开销），用 JS 动态创建：

```ts
const videoPool = new Map<string, HTMLVideoElement>();

function createVideoElement(id: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.preload = 'none';
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'none';
  return video;
}
```

挂载到隐藏容器：`position:absolute; opacity:0; pointer-events:none; width:0; height:0; overflow:hidden`

### 2. 分批加载

```ts
const BATCH_SIZE = 4;

async function loadInBatches(resources: VideoWallResource[]) {
  for (let i = 0; i < resources.length; i += BATCH_SIZE) {
    const batch = resources.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(r => loadSingle(r)));
  }
}
```

每路加载成功后 `emit('streamReady', id)`，全部完成 `emit('ready')`。

### 3. PixiJS 渲染

```ts
const app = new Application({
  background: '#000',
  antialias: false,
  autoDensity: true,
  resolution: window.devicePixelRatio,
  powerPreference: 'high-performance',
});
```

### 4. 帧率控制

```ts
app.ticker.stop();
let lastRender = 0;
const renderInterval = 1000 / targetFps;

app.ticker.add(() => {
  const now = performance.now();
  if (now - lastRender < renderInterval) return;
  lastRender = now;
  app.render();
});
app.ticker.start();
```

VideoTexture 内部通过 `requestVideoFrameCallback` 自动更新纹理，降帧只影响渲染频率不影响纹理更新。

### 5. 布局映射

复用 `useVideoWallLayout` 的 `cols/rows/itemWidth/itemHeight`：

```ts
function layoutSprites(sprites: Map<string, Sprite>, layout: LayoutResult) {
  const entries = [...sprites.values()];
  entries.forEach((sprite, index) => {
    const row = Math.floor(index / layout.cols);
    const col = index % layout.cols;
    sprite.width = layout.itemWidth;
    sprite.height = layout.itemHeight;
    sprite.position.set(
      col * (layout.itemWidth + gap),
      row * (layout.itemHeight + gap)
    );
  });
}
```

容器尺寸变化时（ResizeObserver）重新布局。

### 6. 双击聚焦

```ts
function focusOn(id: string) {
  const target = sprites.get(id);
  if (!target) return;
  sprites.forEach(s => s.visible = s === target);
  target.width = app.renderer.width;
  target.height = app.renderer.height;
  target.position.set(0, 0);
}
```

Sprite 设置 `eventMode: 'static'`，通过 `on('pointertap')` + 时间差（< 300ms）判断双击。

### 7. 主从同步

独立实现，逻辑与 VideoWallPlayer 一致：
- 主流 = `resources[0]`
- `playAll()` / `pauseAll()` / `seekAll()` 遍历 video 池
- 主流 `timeupdate` → 更新进度条
- 主流 `ended` → 分片切换（保留 chunkUrls 支持）

### 8. 卡顿恢复

复用现有 AutoSkip 策略：`stallThresholdMs` 后跳帧，指数退避，最多 `maxSkipAttempts` 次。

## API

### Props

```ts
interface CanvasWallPlayerProps {
  // 资源
  resources: VideoWallResource[];
  title?: string;

  // Canvas 渲染控制
  targetFps?: number;           // 默认 15
  batchSize?: number;           // 默认 4
  backgroundColor?: number;     // 默认 0x000000

  // 播放控制
  autoplay?: boolean;           // 默认 false
  muted?: boolean;              // 默认 false
  loop?: boolean;               // 默认 false
  aspectRatio?: number;         // 默认 16/9
  gap?: number;                 // 默认 8
  layoutMode?: VideoWallLayoutMode;

  // 交互
  enableFocus?: boolean;        // 默认 true

  // 卡顿恢复
  autoSkipOnStall?: boolean;    // 默认 true
  stallThresholdMs?: number;    // 默认 500
  maxSkipAttempts?: number;     // 默认 10

  // 控制栏
  showControls?: boolean;       // 默认 true
  controlSize?: VideoWallControlSize;
}
```

### Emits

```ts
interface CanvasWallPlayerEmits {
  error: [message: string];
  ready: [];
  streamReady: [id: string];
}
```

### 导出

`src/index.ts` 新增（不改动现有导出）：

```ts
export { CanvasWallPlayer } from './components/CanvasWallPlayer/index.vue';
```

## 错误处理

- **单路加载失败**：sprite 显示灰色占位（`tint = 0x333333`），不阻塞下一批
- **Canvas/WebGL 不可用**：`emit('error', ...)`，不做 DOM fallback
- **内存清理**：onUnmounted 销毁 textures/sprites/app/video 池
- **资源动态增减**：watch resources，增量创建/销毁

## 测试策略

独立 HTML demo 页面验证（不做单测框架）：
1. 20 路视频分批加载无 `ERR_CONTENT_LENGTH_MISMATCH`
2. 降帧渲染时 canvas 实际 fps 符合 targetFps
3. 双击聚焦切换正常
4. 卸载后无内存泄漏

## 依赖

```bash
pnpm add pixi.js
```

PixiJS v8（最新稳定版，WebGPU 支持）。

## 预期收益（诚实评估）

| 指标 | 改善程度 |
|---|---|
| DOM 合成层 | 20 层 → 1 层，合成开销降低约 60-80% |
| CPU 主线程 | DOM 操作减少，预计降低 10-20% |
| 渲染帧率 | 可配置降帧，GPU 绘制压力降低 |
| 视频解码 | **无改善**，瓶颈仍在 GPU 解码器 |

不是 3-5 倍提升，预计整体体验从"无法预览"改善到"基本可用"。
