# 视频播放卡顿自动跳帧功能实现计划

## 需求分析

用户报告视频播放时会在某些时刻卡住（估计是丢帧），希望实现：
- 当视频播放出错时，自动向前跳帧（例如从19s跳到19.1s）
- 如果跳帧后仍然出错，继续跳帧
- 直到成功播放或达到某个最大跳帧次数

## 当前代码分析

**VideoWallPlayer 组件** (`/root/git/video-wall-player/src/components/VideoWallPlayer/index.vue`)

现有相关函数：
- `handleError(id)` - 处理视频加载错误（第137-141行）
- `handleWaiting(id)` - 处理视频缓冲等待（第128-130行）
- `handleRetry(id)` - 重试加载视频（第143-152行）

现有状态：
- `errorStates` - 记录每个视频的错误状态
- `bufferingStates` - 记录每个视频的缓冲状态

## 实现方案

### 方案一：基于 `stalled` 事件 + 错误处理（推荐）

**原理**：
1. 监听 HTML5 Video 的 `stalled` 事件（数据获取停滞时触发）
2. 结合 `waiting` 和 `error` 事件
3. 检测当前播放时间是否停滞（通过 `timeupdate` + 时间戳对比）
4. 自动跳过一小段（100ms）并重试播放

**优点**：
- 利用原生事件，更准确检测卡顿
- 不会误判正常缓冲为卡顿
- 符合用户需求的"出错时跳帧"逻辑

### 方案二：基于时间停滞检测

**原理**：
1. 记录每次 `timeupdate` 的时间和时间戳
2. 如果当前时间与上次相同超过一定阈值（如500ms），判定为卡顿
3. 自动跳帧并重试

**优点**：
- 检测准确，不依赖事件
- 可配置检测阈值

**缺点**：
- 需要额外的定时器和状态管理

### 方案三：仅依赖 `error` 事件

**原理**：
1. 捕获 `error` 事件
2. 立即跳帧并重试

**缺点**：
- `error` 事件不一定在卡顿时触发（有时只是缓冲）
- 可能过于激进

## 推荐方案

**采用方案一 + 方案二混合**：结合 `stalled`/`waiting` 事件和时间停滞检测

### 实现细节

1. **新增 Props**（可选配置）：
   - `autoSkipOnStall: boolean` - 是否启用自动跳帧（默认 true）
   - `skipStepMs: number` - 跳帧步长，毫秒（默认 100ms）
   - `maxSkipAttempts: number` - 最大跳帧尝试次数（默认 5）
   - `stallThresholdMs: number` - 卡顿判定阈值（默认 500ms）

2. **新增状态**：
   - `stallTracking` - 记录每个视频的卡顿追踪数据

3. **新增函数**：
   - `handleStalled(id)` - 处理视频停滞事件
   - `startStallDetection(id)` - 启动卡顿检测定时器
   - `handleAutoSkip(id)` - 执行自动跳帧逻辑

4. **修改现有函数**：
   - `handleError` - 在错误时触发自动跳帧
   - `handleWaiting` - 在等待时启动卡顿检测

### 代码修改清单

1. **修改 `VideoWallPlayer/index.vue`**：

   a. Props 中添加新配置项（第13-70行区域）：
      ```typescript
      autoSkipOnStall?: boolean;
      skipStepMs?: number;
      maxSkipAttempts?: number;
      stallThresholdMs?: number;
      ```

   b. 添加新的响应式状态（第77-98行区域）：
      ```typescript
      const stallTracking = ref<Record<string, {
        lastTime: number;
        lastTimestamp: number;
        skipCount: number;
        timer: number | null;
      }>>({});
      ```

   c. 修改 `handleError` 函数（第137-141行）：
      - 调用 `handleAutoSkip(id)`

   d. 修改 `handleWaiting` 函数（第128-130行）：
      - 启动卡顿检测

   e. 添加新函数：
      - `handleStalled(id: string)` - 处理 stalled 事件
      - `startStallDetection(id: string)` - 启动卡顿检测
      - `handleAutoSkip(id: string)` - 执行自动跳帧逻辑
      - `clearStallTracking(id: string)` - 清理追踪数据

   f. 在 video/audio 元素上添加 `@stalled` 事件监听

2. **模板修改**：
   - video 元素添加 `@stalled="handleStalled(item.id)"`
   - audio 元素添加 `@stalled="handleStalled(item.id)"`

## 实施步骤

### 步骤 1：添加配置 Props
- 在 `withDefaults` 中添加新配置项的默认值

### 步骤 2：添加状态管理
- 创建 `stallTracking` 响应式状态

### 步骤 3：实现卡顿检测逻辑
- 实现 `startStallDetection` 函数
- 实现 `handleAutoSkip` 函数

### 步骤 4：修改事件处理
- 修改 `handleError` 和 `handleWaiting`
- 添加 `handleStalled` 处理

### 步骤 5：更新模板
- 为 video 和 audio 元素添加 stalled 事件绑定

### 步骤 6：测试验证
- 在 Demo 中测试卡顿场景
- 验证跳帧逻辑是否正常工作

## 关键实现代码

```typescript
// 自动跳帧处理函数
async function handleAutoSkip(id: string) {
  const media = mediaRefs.value[id];
  if (!media) return;

  const tracking = stallTracking.value[id];
  if (!tracking) return;

  // 超过最大尝试次数，放弃
  if (tracking.skipCount >= (props.maxSkipAttempts || 5)) {
    console.warn(`Video ${id} failed after max skip attempts`);
    return;
  }

  // 跳帧
  const skipAmount = (props.skipStepMs || 100) / 1000;
  const newTime = Math.min(media.duration, media.currentTime + skipAmount);
  media.currentTime = newTime;
  tracking.skipCount++;

  // 重试播放
  try {
    await media.play();
  } catch {
    // 如果播放失败，递归再次跳帧
    setTimeout(() => handleAutoSkip(id), 50);
  }
}

// 卡顿检测
function startStallDetection(id: string) {
  const media = mediaRefs.value[id];
  if (!media) return;

  const tracking = stallTracking.value[id] || {
    lastTime: 0,
    lastTimestamp: Date.now(),
    skipCount: 0,
    timer: null
  };

  // 清除之前的定时器
  if (tracking.timer) {
    clearInterval(tracking.timer);
  }

  tracking.lastTime = media.currentTime;
  tracking.lastTimestamp = Date.now();

  tracking.timer = window.setInterval(() => {
    const media = mediaRefs.value[id];
    if (!media) return;

    const now = Date.now();
    const timeDiff = now - tracking.lastTimestamp;
    const mediaTimeDiff = Math.abs(media.currentTime - tracking.lastTime);

    // 如果时间差超过阈值但媒体时间没变，说明卡顿
    if (timeDiff >= (props.stallThresholdMs || 500) && mediaTimeDiff < 0.01) {
      handleAutoSkip(id);
    }

    tracking.lastTime = media.currentTime;
    tracking.lastTimestamp = now;
  }, 200);

  stallTracking.value[id] = tracking;
}
```

## 注意事项

1. **不要影响正常缓冲**：需要区分"正常缓冲等待"和"卡顿死锁"
2. **边界情况**：接近视频末尾时跳帧可能导致跳过重要内容
3. **用户体验**：跳帧应该无感知，不应影响播放体验
4. **可配置性**：提供配置项让用户控制跳帧行为
