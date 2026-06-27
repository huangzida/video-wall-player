# ADR-0001 / Slice 0 — 边界分析与抽取规格

冻结 `useMediaSync` / `useVideoWall` / 纯助手 的函数级边界。fixer 据此机械抽取。

## 组合契约（解 Q3 的 tricky-glue 风险）

**`useMediaSync` 不消费 `useVideoWall` 的响应式 Map，而是暴露命令式注册 API：**

```ts
useMediaSync(options) → {
  // 命令式注册（useVideoWall 管池时调用）
  register(id: string, el: HTMLMediaElement): void;
  unregister(id: string): void;
  setPrimary(id: string): void;
  // 元素级
  setVolume(id, v): void;        // v: 0-100
  toggleMute(id): void;
  // 聚合 intents（协调所有已注册元素）
  play(): Promise<void>;
  pause(): void;
  seekAllLocal(time: number): Promise<void>;  // 局部时间，所有元素 seek 到同一位置 + 等 seeked
  setRate(r: number): void;
  setMutedAll(b: boolean): void;
  setVolumeAll(v: number): void;
  destroy(): void;
  // 状态（局部语义 — 单段/standalone 正确）
  state: { isPlaying, currentTime, duration, volume(0-100), muted, playbackRate };
}
```

`useVideoWall` 在 switchChunk 时：unregister 旧 → 换 src → register 新（元素复用，只是重绑事件）。或更简单：元素不换，只换 `el.src`，事件接线保持。**实现时取后者（元素复用，src 换；事件不重接）**。

## 语义层级（必须冻结）

| 量 | useMediaSync（局部/单段） | useVideoWall（全局/跨段） |
|---|---|---|
| `currentTime` | `primaryEl.currentTime` | `segmentStart[activeChunk] + mediaSync.currentTime` |
| `duration` | `primaryEl.duration` | `Σ segmentDurations` |
| seek 目标 | 局部时间（所有元素同位） | 全局→ (chunkIndex, local) 换算后调 `seekAllLocal(local)` |

- standalone 单视频：用户直接用 `useMediaSync`，局部=全局（单段，segmentStart=0），正确
- 墙：PlayerControls 绑 `useVideoWall.state`（全局）

## 函数级分类（逐个去哪）

### → 纯助手（`src/core/media-math.ts`，无状态，先抽先测）

| 函数 | 来源 | 签名 |
|---|---|---|
| `locateByGlobalTime(target, durations)` | DOM `locateByGlobalTime` (line 589) 已是纯的 | `(target, durations: number[]) → { chunkIndex, localTime }` |
| `getSegmentStarts(durations)` | Canvas `getSegmentStarts` (line 114) 提纯（去掉 resources 读取） | `(durations: number[]) → number[]` |
| `sumDurations(durations)` | 两版 `duration` 计算 | `(durations: number[]) → number` |
| `normalizeResource(input)` | 新增（Q4） | 接受 `string \| {src} \| {chunkUrls} \| {chunkUrls,durations}` → 规范 `MediaResource` |
| `clampDuration(localTime, segDur)` | 两版 switchChunk 里的 safeTime 计算 | 提纯 |

### → `useMediaSync`（`src/core/useMediaSync.ts`，元素级通用）

| 逻辑 | 来源 |
|---|---|
| 媒体事件接线（timeupdate/play/pause/waiting/playing/canplay/error/ended） | Canvas `attachMediaEvents` (127) + DOM handleWaiting/Playing/Error |
| 主源追踪（isPlaying/currentTime/duration 从 primary） | DOM `syncIsPlayingFromPrimary`/`syncCurrentTimeFromPrimary` + Canvas onTimeUpdate/onPlay/onPause |
| seek 协调（pause all → 各自 seek → 等 seeked → 3s 超时 → resume） | 两版 switchChunk 里的 seekPromises 块（DOM 556-574 / Canvas 244-269） |
| play/pause all（Promise.allSettled + 吞 autoplay rejection） | DOM `playAllVideos` (485) / Canvas `playAll` (376) |
| applySettings（rate/volume/mute → 所有元素） | DOM `applyVideoSettings` (461) / Canvas `applySettings` (366) |
| setVolume/toggleMute per id | 两版 |
| StallState + checkAndRecoverStall + performAutoSkip + 定时器 | 两版（DOM 211-259 / Canvas 434-476） |
| register/unregister/setPrimary | 新增（registry 模式） |

**注意**：`skipStepMs` 当前 DOM 有可配、Canvas 硬编码 0.1s —— 统一成 `useMediaSync` option（默认 0.1s，可配），消除漂移。

### → `useVideoWall`（`src/core/useVideoWall.ts`，墙专属，消费 useMediaSync）

| 逻辑 | 来源 |
|---|---|
| videoPool 生命周期（create/ensure/destroy） | Canvas `createVideoElement`/`ensureVideo`/`destroyAll` |
| 资源归一化 + segmentDurations/segmentStarts（用纯助手） | 两版 |
| switchChunk（换 src + 用 useMediaSync.seekAllLocal 协调） | 两版 switchChunk（去掉内联 seek 块，改调 useMediaSync） |
| handlePrimaryEnded（ended → 下一段） | 两版 |
| seek（全局，用 locateByGlobalTime + useMediaSync.seekAllLocal） | 两版 seekAll/handleSeek |
| loadSingle/loadAll（分批） | Canvas `loadSingle`/`loadAll` |
| activeChunkIndex 状态 | 两版 |
| 调 useMediaSync.register/unregister/setPrimary | 新增（组合胶水） |

### → 留在 player 组件（DOM/Canvas batteries，不在 Slice 0）

UI handler（PrevChunk/NextChunk/SegmentClick → SegmentNav；PlayPause/Seek/Volume → 绑 useVideoWall.state）、keyboard、focus、drag-drop、theme、tile meta。

## 文件布局（Slice 0 产出）

```
src/core/
├── media-math.ts          # 纯助手 + 单测
├── media-math.test.ts     # Q10 关键路径测试
├── useMediaSync.ts        # 元素级同步引擎
├── useVideoWall.ts        # 墙编排（薄，Slice 0 只到能验证组合）
└── types.ts               # MediaResource / PlayerState / MediaSyncState / intents
```

> ponytail: 现有 `useVideoSources.ts`（Canvas）和 VideoWallPlayer 内联引擎**先不动**（不破坏 0.0.12）。Slice 0 是**新建并行核心**，验证组合后 Slice 1+ 才把 player 切过去消费新核心。这是硬切策略下"先建新的、再一刀切"的安全姿势。

## 测试范围（Q10）

`media-math.test.ts` 必覆盖：
- `normalizeResource`: 4 种输入形态（string / {src} / {chunkUrls} / {chunkUrls,durations}）+ 边界（空数组、负 duration、缺字段）
- `locateByGlobalTime`: 单段、跨段、target 超出 duration、target=0、durations 空
- `getSegmentStarts`: 累加正确、空输入、含 0/负值
- `clampDuration`: 边界、segDur=0

useMediaSync/useVideoWall 的异步/媒体元素部分**不测**（手测覆盖）。
