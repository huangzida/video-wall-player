# VideoWallPlayer 组件增强设计方案 (V3)

## 1. 需求概述

基于用户提出的 9 点需求，并结合 Frontend Design 的高审美标准，本方案旨在将 `VideoWallPlayer` 升级为一个功能强大且视觉惊艳的组件。

## 2. 详细设计

### 2.1 主题系统 (Theme System)

通过 CSS Variables 和 Tailwind 插件实现多主题切换，确保每种主题都有独特的视觉语言。

*   **Props**: `theme: 'default' | 'cyberpunk' | 'industrial' | 'minimalist'`
*   **主题定义**:
    *   **Default (Classic Dark)**:
        *   风格: 经典深灰/黑色，标准圆角，阴影层次分明。
        *   适用: 通用监控场景。
    *   **Cyberpunk (Sci-Fi)**:
        *   风格: 深蓝/紫色调，半透明磨砂玻璃，霓虹青/粉色高亮，无圆角或切角设计，扫描线纹理背景。
        *   字体: Tech-mono 风格。
    *   **Industrial (Brutalist)**:
        *   风格: 高对比度黑/黄或黑/白配色，粗线条边框，斜线警示纹理，大号粗体字，无阴影，硬朗直角。
        *   适用: 工厂、工地监控。
    *   **Minimalist (Clean)**:
        *   风格: 浅灰/白色调（或柔和深色），无边框，大留白，极简图标，注重内容本身。
        *   交互: 仅在 Hover 时显示操作控件。

### 2.2 播放控制增强 (Advanced Controls)

*   **自动播放修复**:
    *   策略: `onMounted` 尝试播放 -> 失败 -> 静音播放 -> 成功 -> 显示 Toast "已自动静音"。
*   **控制栏组件**:
    *   新增 `SkipBack` / `SkipForward` 按钮（步进跳转，默认 5s）。
    *   新增 `ChevronsLeft` / `ChevronsRight` 按钮（片段切换）。
    *   **交互设计**: 按钮点击时增加微动效（缩放/发光），进度条增加平滑过渡。

### 2.3 UI 配置增强 (UI Toggles)

新增 Props 以精细控制界面元素：

| Prop | 类型 | 默认 | 说明 |
| :--- | :--- | :--- | :--- |
| `draggable` | `boolean` | `true` | 启用拖拽排序。 |
| `showTileTitle` | `boolean` | `true` | 显示视频左上角名称。 |
| `showTileMute` | `boolean` | `true` | 显示视频右下角静音按钮。 |
| `showSidebar` | `boolean` | `true` | 显示左侧列表。 |
| `showPrevNextChunk` | `boolean` | `true` | 显示片段切换按钮。 |
| `showStepSkip` | `boolean` | `true` | 显示步进跳转按钮。 |
| `stepSeconds` | `number` | `5` | 步进秒数。 |

### 2.4 时间轴打点 (Tags)

*   **Props**: `tags: Array<{ time: number, name: string }>`
*   **视觉设计**:
    *   在进度条上渲染高亮标记点。
    *   Hover 时显示带有主题样式的 Tooltip。
    *   点击标记点自动跳转。

## 3. 实施计划

1.  **重构样式架构**:
    *   创建 `src/styles/themes.css`，定义各主题的 CSS 变量（颜色、圆角、字体、阴影、边框等）。
    *   在 `index.vue` 中引入并根据 `theme` prop 动态绑定 class。
2.  **组件逻辑升级**:
    *   更新 `VideoWallPlayer` 和 `PlayerControls` 的 Props 和 Emits。
    *   实现自动播放的静音回退逻辑。
    *   实现步进和片段切换逻辑。
3.  **UI 细节打磨 (Frontend Design)**:
    *   为 Cyberpunk 主题添加发光效果和扫描线背景。
    *   为 Industrial 主题添加警示条纹和粗边框。
    *   为 Minimalist 主题移除多余装饰，优化间距。
4.  **Demo 升级**:
    *   在 Demo 页面的设置面板中添加所有新功能的控制项。
    *   添加主题切换下拉框，实时预览不同风格。

## 4. 验证计划

*   [ ] 四种主题切换正常，样式符合设计预期。
*   [ ] 自动播放（静音回退）在刷新后生效。
*   [ ] 拖拽、标题、静音按钮开关有效。
*   [ ] 步进跳转、片段切换功能正常。
*   [ ] 时间轴 Tags 显示正确，Hover 提示样式跟随主题。
*   [ ] 左侧列表显隐切换顺滑（添加过渡动画）。
