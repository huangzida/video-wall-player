# ADR-0001: Headless 重建（v1.0）

- **状态**: Accepted
- **日期**: 2026-06-27
- **决策者**: 维护者（huangzida）+ 架构 review
- **取代**: 0.0.x 的内联同步引擎 + 耦合 wall 语义的 PlayerControls

## 背景

video-wall-player 当前（0.0.12）存在以下结构性问题，阻碍"更通用 + 更傻瓜"的目标：

1. **同步引擎抄了两遍** — `VideoWallPlayer/index.vue` 把多流同步逻辑内联（`StallState`、`switchChunk`、`seekAll`、`checkAndRecoverStall`、`performAutoSkip`、`playAllVideos`…），`CanvasWallPlayer/useVideoSources.ts` 是同一套逻辑抽成的 hook。两份实现已经漂移：
   - DOM 版有可配 `skipStepMs`，Canvas 版硬编码 `0.1s`
   - DOM 版有 5 套 theme / sidebar / 拖拽 / tile meta，Canvas 版全无
   - emit 不一致：DOM 发 `close`，Canvas 发 `ready`/`streamReady`
2. **resources 格式对常见场景过重** — `{ id, name, chunkUrls: string[], durations: number[], poster? }`，两个平行数组必须手动对齐，单视频也得写 `chunkUrls:[url], durations:[120]`，`durations` 还必填（实际往往要等 metadata 加载）。
3. **PlayerControls 已导出但无法独立** — 类型从 `VideoWallPlayer/types` 渗漏（`VideoWallTag`/`VideoWallControlSize` 带 "Wall" 语义）；`prevChunk`/`nextChunk` 这类墙专属 emit 长在"通用控件条"上；**无配套 state hook**，用户要手焊 12 个 props + 12 个 emits。
4. **Props 爆炸** — VideoWallPlayer ~32 个 prop，CanvasWallPlayer ~17 个。
5. **双 player 选择负担 + 功能不对称** — 用户得自己判断何时用 DOM/Canvas；选 Canvas = 失去全部墙 UX。
6. **零测试** — 状态机密集的同步/seek/分段逻辑无任何回归保护。

## 决策

采用 **headless 优先的分层重建**，v1.0 一次性完整发布、硬切、不软化。共 11 项子决策：

| # | 分支 | 决定 | 拒绝的备选 |
|---|---|---|---|
| 1 | 范围 | C — headless 重建，v1.0 多周 | A（只改用户面）/ B（用户面+引擎合并）/ D（只导出 PlayerControls） |
| 2 | 架构形态 | 分层：hooks 核心 + 展示组件 + batteries player | A（纯 hooks）/ B（复合组件 scoped slot） |
| 3 | 核心原语边界 | `useMediaSync(elements)` 吃元素；`useVideoWall(resources)` 在上层建池+分段 | B（吃 resources）/ C（两个 hook 不共享） |
| 4 | resources 格式 | 加法简写 + 归一化 → `MediaResource` | B（segments 数组）/ C（sources 对象 + HLS） |
| 5 | PlayerControls 契约 | 纯展示 + `useMediaSync([ref])` 退化单元素；`<SegmentNav>` 拆出 | B（batteries `:media` 简写）/ C（双模） |
| 6 | DOM/Canvas 合并 | 保持两个显式组件，都消费 `useVideoWall`，统一推 v1.1+ | B（v1.0 合并 + auto）/ C（合并名字显式 renderer） |
| 7 | 样式定位 | 混合：样式默认 + 5 theme 迁 CSS 变量 + ~10 token（v1.0）；class slot API 推 v1.1 | A（全样式无逃逸口）/ B（彻底 unstyled） |
| 8 | 迁移策略 | 纯硬切，不软化，无 compat shim | A（硬切+0.x 软化）/ B（shim）/ C（并行包） |
| 9 | v1.0 scope | 完整 11 项（原语 + 两个 batteries + 主题 + 迁移指南） | B（原语+薄 batteries）/ C（只发原语） |
| 10 | 测试 | 关键路径单测（归一化器/seek 数学/分段数学/布局） | A（零测试）/ C（全面含假 media element） |
| 11 | Canvas 功能对齐 | Canvas 保持 0.0.12 特性集（薄），只重建到新核心 | (b)（Canvas 补齐 sidebar/dnd/themes） |

## 架构

```
核心层（headless）
  useMediaSync(elements)      元素级同步引擎：事件接线/主源追踪/seek 协调/音量/卡顿恢复
                              单元素退化 → PlayerControls 独立使用的基础
  useVideoWall(resources)     墙编排：建池/归一化/分段切换/布局/聚焦/拖拽/主源选择
                              内部创建元素并喂给 useMediaSync
  normalizeResource()         MediaResource 归一化（纯函数，三种输入形态 → 规范形）

展示层
  <PlayerControls>            纯展示：吃 PlayerState + 发标准 intents（play/pause/seek/...）
  <SegmentNav>                墙分段导航（从 PlayerControls 拆出，墙专属）

batteries 层
  <VideoWallPlayer>           DOM 渲染，全特性（theme/sidebar/dnd/tile meta），消费 useVideoWall
  <CanvasWallPlayer>          WebGL 渲染，0.0.12 特性集（薄），消费 useVideoWall

类型与样式
  MediaResource, PlayerState, intents    5 theme（CSS 变量驱动）+ ~10 token
```

### 数据流（墙场景）

```
props.resources（src 简写 / chunkUrls / chunkUrls+durations）
      ↓
useVideoWall: normalizeResource() → MediaResource
      ↓
建 videoPool + 分段表（segmentStarts 由 durations 计算）
      ↓
useVideoWall 把元素集合交给 useMediaSync
      ↓
useMediaSync: 接线媒体事件 + 暴露 PlayerState + 提供 play/pause/seekAll/setVolume 意图
      ↓
<VideoWallPlayer> / <CanvasWallPlayer> 组合渲染 + <PlayerControls> + <SegmentNav>
```

### PlayerControls 独立用法（v1.0 核心交付物）

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useMediaSync, PlayerControls } from 'video-wall-player';

const videoRef = ref<HTMLVideoElement>();
const { state, intents } = useMediaSync([videoRef]); // 单元素退化
</script>

<template>
  <video ref="videoRef" src="x.mp4" />
  <PlayerControls v-bind="state" v-on="intents" />
</template>
```

### 关键契约（冻结）

- **`PlayerState`** = `{ isPlaying, currentTime, duration, volume(0-100), muted, playbackRate }`
- **intents**（对齐 HTMLMediaElement 概念）= `play / pause / seek(t) / setVolume(v) / setMuted(b) / setRate(r) / stepBy(±s) / stop` + `fullscreen`（UI-only）
- **`volume` 统一 0-100**（hook 内部换算 0-1 喂给 `media.volume`）
- **`MediaResource`** 接受三种输入，归一化为规范形；`VideoWallResource` 不保留 alias（硬切）

## 后果

### 正面

- **PlayerControls 真正可独立** — 用户拿一个 `<video>` + 3 行代码即可用上控件条，零 wall 语义渗漏
- **杀掉引擎漂移** — `useMediaSync` 统一，DOM/Canvas 不再各写一份；未来 Canvas 加功能有干净基础
- **resources 大幅降门槛** — 单视频写 `{ id, name, src }`，告别 chunkUrls/durations 仪式
- **headless 高阶用户拿原语** — `useMediaSync`/`useVideoWall` 可被组合进自定义 UI
- **关键路径有测试护栏** — seek/分段/归一化的回归会被单测抓住

### 负面（清醒接受）

- **用户一次性吃全部 break** — PlayerControls 的 props/events 标准化、theme 换 CSS 变量、类型改名，升级即破坏（硬切，无 shim）
- **Canvas 功能不对称保留** — v1.0 的 Canvas 仍无 sidebar/dnd/themes，用户若需这些得留 0.0.12 或等 v1.1+
- **多月重建 + 单人 + 零测试基础** — 完整 11 项一次性落地，是项目失败经典剧本的形状；唯一护栏是 Q10 的关键路径测试纪律
- **分段场景 durations 省略时降级** — 跨段 seek 在所有分段 metadata 加载完前无法精确计算 `segmentStarts`（单视频无影响）

## 关联

- 取代：`docs/superpowers/specs/2026-06-22-canvas-wall-player-design.md` 中"同步逻辑在 useVideoSources 中独立实现，不抽取 VideoWallPlayer 的代码"——v1.0 起两 player 共享 `useMediaSync`/`useVideoWall`，该独立性不再保留
- 后续：`docs/superpowers/plans/` 下应产出 v1.0 实施计划（按本文 11 项拆垂直切片）

## 后续里程碑（v1.0 之外，明确推迟）

- **v1.1**: class slot API（结构覆盖逃逸口）；评估 Canvas 功能对齐（DOM overlay on PixiJS）；评估 `<VideoWall mode="auto">` 统一入口
- **v1.x**: HLS / 流媒体协议支持（独立 ADR，因引入新依赖）
