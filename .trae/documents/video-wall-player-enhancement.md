# VideoWallPlayer 组件增强计划

## 目标
为 `VideoWallPlayer` 组件新增一系列属性（Props），以增强其配置灵活性和扩展性，满足更多场景下的使用需求。

## 新增属性 (Props)

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `autoplay` | `boolean` | `false` | 是否在加载完成后自动开始播放。注意：浏览器可能会拦截带声音的自动播放。 |
| `muted` | `boolean` | `false` | 是否默认静音。 |
| `loop` | `boolean` | `false` | 是否循环播放。当播放列表结束时，自动从头开始。 |
| `aspectRatio` | `number` | `16 / 9` | 视频网格中每个视频单元的宽高比。 |
| `gap` | `number` | `8` | 视频网格之间的间距（像素）。 |
| `showControls` | `boolean` | `true` | 是否显示底部的播放控制栏。 |
| `objectFit` | `'contain' \| 'cover' \| 'fill'` | `'contain'` | 视频画面在容器中的填充模式。 |

## 实现细节

1.  **Autoplay & Muted**:
    *   在 `onMounted` 或 `watch` 资源变化后，根据 `autoplay` 属性调用 `playAllVideos`。
    *   初始化 `individualMutedStates` 时，根据 `muted` 属性设置初始值。
    *   注意处理浏览器的自动播放策略（通常需要静音才能自动播放）。

2.  **Loop**:
    *   修改 `handlePrimaryEnded` 方法。当播放到最后一个分片且结束时，检查 `loop` 属性。
    *   如果 `loop` 为 `true`，则重置 `activeChunkIndex` 为 0 并继续播放。

3.  **Layout Props (aspectRatio, gap)**:
    *   将 props 传入 `useVideoWallLayout` 钩子，替代硬编码的值。
    *   更新 `gridStyle` 中的 `gap` 属性。

4.  **Show Controls**:
    *   使用 `v-if` 控制 `PlayerControls` 组件的渲染。

5.  **Object Fit**:
    *   将 `objectFit` prop 应用到 `<video>` 标签的 `class` 或 `style` 中。

## 任务列表

- [ ] **Task 1: 定义 Props**: 在 `index.vue` 中更新 `defineProps`，添加上述所有新属性。
- [ ] **Task 2: 实现布局相关属性**: 实现 `aspectRatio` 和 `gap` 的逻辑。
- [ ] **Task 3: 实现播放控制属性**: 实现 `autoplay`、`muted` 和 `loop` 的逻辑。
- [ ] **Task 4: 实现 UI 相关属性**: 实现 `showControls` 和 `objectFit` 的逻辑。
- [ ] **Task 5: 更新 Demo**: 在 `demo/App.vue` 中添加控制面板或预设值，以测试这些新属性。

## 验证清单

- [ ] 设置 `autoplay` 为 `true`，页面加载后视频应自动播放。
- [ ] 设置 `muted` 为 `true`，视频应默认静音。
- [ ] 设置 `loop` 为 `true`，视频播放结束后应自动重新开始。
- [ ] 修改 `aspectRatio`，网格形状应变化。
- [ ] 修改 `gap`，网格间距应变化。
- [ ] 设置 `showControls` 为 `false`，控制栏应消失。
- [ ] 修改 `objectFit` 为 `cover`，视频应填满格子（可能会被裁剪）。
