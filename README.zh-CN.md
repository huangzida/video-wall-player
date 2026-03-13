# Video Wall Player

一个功能强大的 Vue 3 组件，用于在响应式网格布局中播放同步视频流。非常适合监控系统、多摄像头回放和视频墙应用。

## 在线演示
[点击查看在线演示](https://huangzida.github.io/video-wall-player/)

[English Documentation](./README.md) | [Demo](https://huangzida.github.io/video-wall-player/)

## 功能特性

- 🎥 **多流同步**: 基于主视频流同步多个视频/音频流。
- 🧩 **响应式网格**: 根据视频流数量和容器尺寸自动计算最佳网格布局。
- 🖱️ **拖拽排序**: 支持通过拖放重新排序视频画面。
- 🔊 **音频支持**: 处理视频和音频分片（支持 .wav）。
- 🎛️ **高级控制**: 支持倍速播放、进度跳转、音量控制和全屏模式。
- 🎨 **Tailwind CSS**: 使用 Tailwind CSS 构建，易于定制。

## 安装

```bash
npm install video-wall-player
# 或
pnpm add video-wall-player
```

确保您的项目中已安装 `vue` 和 `@vueuse/core`。

## 使用方法

```vue
<script setup lang="ts">
import { VideoWallPlayer } from 'video-wall-player';
import 'video-wall-player/dist/style.css'; // 如果需要

const resources = [
  {
    id: 'camera-01',
    name: 'Camera 1',
    chunkUrls: ['https://example.com/video1_part1.mp4', 'https://example.com/video1_part2.mp4'],
    durations: [120, 120]
  },
  // ... 其他流
];
</script>

<template>
  <div class="h-screen w-full">
    <VideoWallPlayer
      :resources="resources"
      title="监控墙"
      @error="console.error"
    />
  </div>
</template>
```

## Props

| 属性名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `resources` | `VideoWallResource[]` | `[]` | 要播放的资源列表。 |
| `title` | `string` | `''` | 侧边栏显示的标题。 |
| `autoplay` | `boolean` | `false` | 是否自动播放。 |
| `muted` | `boolean` | `false` | 是否默认静音。 |
| `loop` | `boolean` | `false` | 是否循环播放。 |
| `aspectRatio` | `number` | `16/9` | 单个视频格子的宽高比。 |
| `gap` | `number` | `8` | 视频格子之间的间距（像素）。 |
| `showControls` | `boolean` | `true` | 是否显示底部控制栏。 |
| `objectFit` | `'contain' \| 'cover' \| 'fill'` | `'contain'` | 视频画面的填充模式。 |
| `theme` | `'default' \| 'cyberpunk' \| 'industrial' \| 'minimalist'` | `'default'` | 播放器 UI 主题。 |
| `draggable` | `boolean` | `true` | 是否启用拖拽排序。 |
| `showTileTitle` | `boolean` | `true` | 是否显示视频格子的标题浮层。 |
| `showTileMute` | `boolean` | `true` | 是否显示视频格子的静音按钮。 |
| `showSidebar` | `boolean` | `true` | 是否显示侧边栏。 |
| `showPrevNextChunk` | `boolean` | `true` | 是否显示上一个/下一个片段按钮。 |
| `showStepSkip` | `boolean` | `true` | 是否显示快退/快进按钮。 |
| `showSpeedControl` | `boolean` | `true` | 是否显示播放按钮两侧的快进/快退（倍速调整）按钮。 |
| `showPlaybackRate` | `boolean` | `true` | 是否显示倍速切换按钮（如 1x）。 |
| `stepSeconds` | `number` | `5` | 快退/快进的步进秒数。 |
| `fixedTileMeta` | `boolean` | `true` | 视频格子的标题和静音按钮是固定显示 (true) 还是悬停显示 (false)。 |
| `sidebarWidth` | `number` | `280` | 侧边栏的宽度（像素）。 |
| `wallPadding` | `number` | `10` | 视频墙容器的内边距（像素）。 |
| `tags` | `VideoWallTag[]` | `[]` | 时间轴打点列表。 |

### VideoWallResource 类型定义

```typescript
interface VideoWallResource {
  id: string;          // 唯一标识符
  name: string;        // 显示名称
  chunkUrls: string[]; // 分片 URL 列表
  durations: number[]; // 对应的分片时长列表（秒）
  poster?: string;     // 可选的封面图 URL
}
```

### VideoWallTag 类型定义

```typescript
interface VideoWallTag {
  time: number; // 时间点（秒）
  name: string; // Tooltip 显示的打点名称
  color?: string; // 可选的打点颜色（如 '#ff0000', 'red'）
}
```

## 许可证

MIT
