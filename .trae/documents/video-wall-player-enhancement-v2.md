# VideoWallPlayer 组件增强设计方案 (V2)

## 1. 需求概述

基于用户提出的 9 点需求，本方案旨在进一步增强 `VideoWallPlayer` 组件的功能性、可配置性和用户体验。主要涵盖以下方面：

*   **主题定制**：提供多套内置主题，方便用户切换。
*   **播放控制增强**：优化自动播放逻辑，新增步进跳转、片段切换控制。
*   **UI 配置增强**：新增拖拽、标题、静音、控制按钮等 UI 元素的显示开关。
*   **交互体验优化**：新增时间轴打点（Tags）及 Hover 提示，支持左侧列表显隐切换。

## 2. 详细设计

### 2.1 主题切换 (Theme Support)

*   **Props**: 新增 `theme` 属性。
    *   类型: `'default' | 'modern' | 'industrial' | 'minimalist'`
    *   默认值: `'default'`
*   **实现**:
    *   使用 CSS Variables 定义主题色（背景、前景色、强调色、边框色等）。
    *   在组件根元素上根据 `theme` prop 挂载对应的 CSS 类（如 `theme-modern`），利用 CSS 作用域覆盖变量。
    *   **预设主题**:
        *   `default`: 当前的深色风格。
        *   `modern`: 科技感，蓝/青色调，磨砂玻璃效果（即之前的优化版）。
        *   `industrial`: 工业风，黑/黄配色，高对比度，直角边框。
        *   `minimalist`: 极简风，纯黑白，无阴影，扁平化。

### 2.2 自动播放修复 (Autoplay Fix)

*   **问题**: 浏览器自动播放策略限制，未静音时无法自动播放。
*   **解决方案**:
    *   保留 `autoplay` 和 `muted` 属性。
    *   在 `onMounted` 中检测 `autoplay`。
    *   **关键策略**: 尝试自动播放 -> 若失败（被拦截）-> 自动静音并重试播放 -> 若成功，显示“已自动静音，点击取消静音”的提示（Toast）。
    *   确保 Demo 页面的 `useStorage` 读取配置后能正确应用到组件。

### 2.3 UI 开关配置 (UI Toggles)

新增以下 Props 控制 UI 元素的显示：

| Prop 名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `draggable` | `boolean` | `true` | 是否允许拖拽交换视频位置。 |
| `showTileTitle` | `boolean` | `true` | 是否显示视频左上角的名称浮层。 |
| `showTileMute` | `boolean` | `true` | 是否显示视频右下角的静音按钮。 |
| `showSidebar` | `boolean` | `true` | 是否显示左侧片段列表侧边栏。 |

### 2.4 时间轴打点 (Tags)

*   **Props**: 新增 `tags` 属性。
    *   类型: `Array<{ time: number, name: string }>`
    *   默认值: `[]`
*   **实现**:
    *   在 `PlayerControls` 的进度条组件中渲染打点标记（小圆点或竖线）。
    *   计算位置: `left: (tag.time / duration) * 100%`。
    *   **交互**:
        *   Hover 标记点时，显示 Tooltip（`tag.name`）。
        *   点击标记点时，跳转到对应时间 (`seek`).

### 2.5 控制栏增强 (Advanced Controls)

*   **片段切换**:
    *   新增“上一个片段”和“下一个片段”按钮。
    *   逻辑: 切换 `activeChunkIndex`。
*   **步进跳转**:
    *   新增“快退 N 秒”和“快进 N 秒”按钮。
    *   Props: `stepSeconds` (默认 5s)。
    *   逻辑: `currentTime +/- stepSeconds`。
*   **按钮开关 Props**:

| Prop 名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `showPrevNextChunk` | `boolean` | `true` | 是否显示上一个/下一个片段按钮。 |
| `showStepSkip` | `boolean` | `true` | 是否显示快退/快进按钮。 |
| `stepSeconds` | `number` | `5` | 步进跳转的秒数。 |

## 3. 接口定义更新

```typescript
// src/components/VideoWallPlayer/types.ts

export interface VideoWallTag {
  time: number;
  name: string;
}

export interface VideoWallProps {
  // ...现有 props
  theme?: 'default' | 'modern' | 'industrial' | 'minimalist';
  draggable?: boolean;
  showTileTitle?: boolean;
  showTileMute?: boolean;
  showSidebar?: boolean;
  tags?: VideoWallTag[];
  showPrevNextChunk?: boolean;
  showStepSkip?: boolean;
  stepSeconds?: number;
}
```

## 4. 实施步骤

1.  **重构 Props**: 更新 `VideoWallPlayer` 和 `PlayerControls` 的 Props 定义。
2.  **实现主题系统**: 定义 CSS 变量，创建主题样式文件，应用主题类名。
3.  **完善控制栏**: 修改 `PlayerControls` 组件，添加新按钮（步进、片段切换），并绑定事件。
4.  **实现 Tags**: 在进度条上渲染 Tags，添加 Tooltip 交互。
5.  **实现 UI 开关**: 在 `VideoWallPlayer` 模板中添加 `v-if` 判断，控制各元素的显隐。
6.  **优化自动播放**: 在 `index.vue` 中增强 `playAllVideos` 的错误处理和自动静音重试逻辑。
7.  **更新 Demo**: 在 Demo 设置面板中添加所有新属性的配置项，方便测试。

## 5. 验证计划

*   [ ] 切换不同主题，检查颜色和样式是否正确应用。
*   [ ] 设置 `autoplay=true, muted=false`，刷新页面，检查是否能自动播放（或静音播放）。
*   [ ] 切换 `draggable`，测试是否还能拖拽。
*   [ ] 切换 `showTileTitle`, `showTileMute`，检查覆盖层元素显隐。
*   [ ] 传入 `tags` 数据，检查进度条打点显示及 Hover 提示。
*   [ ] 点击步进按钮，检查视频是否跳转指定秒数。
*   [ ] 点击片段切换按钮，检查是否切换到上下一个片段。
*   [ ] 切换 `showSidebar`，检查侧边栏显隐及布局自适应。
