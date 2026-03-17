# Video Wall Player

一个功能强大的 Vue 3 组件，用于在响应式网格布局中播放同步视频流。非常适合监控系统、多摄像头回放和视频墙应用。

## 在线演示
[点击查看在线演示](https://huangzida.github.io/video-wall-player/)

[English Documentation](./README.md)

## 功能特性

- 🎥 **多流同步**: 基于主视频流同步多个视频/音频流。
- 🧩 **响应式网格**: 根据视频流数量和容器尺寸自动计算最佳网格布局。
- 🖱️ **拖拽排序**: 支持通过拖放重新排序视频画面。
- 🔍 **双击聚焦**: 双击任意视频格子可将其最大化并聚焦。
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

### 样式说明（自动注入且不污染全局）

- **无需手动引入 CSS**：安装并 `import` 组件后会自动注入样式。
- **Tailwind 工具类已作用域化**：所有 Tailwind utility 都限制在 `.video-wall-player` 容器内，不会影响宿主页面全局。
- **已关闭 Tailwind Preflight**：避免重置宿主项目的基础标签样式（如 `button/img` 等）。

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
| `showTileFullscreen` | `boolean` | `true` | 是否显示视频格子的全屏按钮。 |
| `showSidebar` | `boolean` | `true` | 是否显示侧边栏。 |
| `showPrevNextChunk` | `boolean` | `true` | 是否显示上一个/下一个片段按钮。 |
| `showStepSkip` | `boolean` | `true` | 是否显示快退/快进按钮。 |
| `showSpeedControl` | `boolean` | `true` | 是否显示播放按钮两侧的快进/快退（倍速调整）按钮。 |
| `showPlaybackRate` | `boolean` | `true` | 是否显示倍速切换按钮（如 1x）。 |
| `stepSeconds` | `number` | `5` | 快退/快进的步进秒数。 |
| `fixedTileMeta` | `boolean` | `true` | 视频格子的标题和静音按钮是固定显示 (true) 还是悬停显示 (false)。 |
| `controlSize` | `'small' \| 'normal' \| 'large'` | `'normal'` | 底部控制栏（图标和文字）的尺寸。 |
| `sidebarWidth` | `number` | `280` | 侧边栏的宽度（像素）。 |
| `videoWallPadding` | `number` | `10` | 右侧视频墙区域的内边距（像素）。 |
| `layoutMode` | `'auto' \| '1x1' \| '2x2' \| '3x3' \| '4x4' \| '1+5' \| '1+7'` | `'auto'` | 网格布局模式。'auto' 自动计算，其他为固定或焦点布局。 |
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
  id?: string | number; // 可选的唯一标识符
  time: number; // 时间点（秒）
  name: string; // Tooltip 显示的打点名称
  color?: string; // 可选的打点颜色（如 '#ff0000', 'red'）
}
```

### 事件 (Events)

| 事件名 | 参数 | 描述 |
| --- | --- | --- |
| `error` | `message: string` | 当发生错误（如视频加载失败）时触发。 |
| `close` | - | 当触发关闭操作时触发（如果适用）。 |

### 暴露方法 (Exposed Methods)

可以通过组件引用的 ref 访问以下方法：

| 方法名 | 参数 | 描述 |
| --- | --- | --- |
| `play` | - | 恢复所有视频的播放。 |
| `pause` | - | 暂停所有视频的播放。 |
| `seek` | `time: number` | 将所有视频跳转到指定时间（秒）。 |

## 键盘快捷键

| 按键 | 动作 |
| --- | --- |
| `Space` / `k` | 播放 / 暂停 |
| `f` | 全屏切换 |
| `m` | 静音切换 |
| `ArrowLeft` | 快退 (默认 5秒) |
| `ArrowRight` | 快进 (默认 5秒) |
| `ArrowUp` | 音量增加 (+10%) |
| `ArrowDown` | 音量减少 (-10%) |
| `Esc` | 退出全屏 / 退出聚焦模式 |
| `双击` | 切换聚焦模式 (最大化当前视频) |

## 许可证

MIT
