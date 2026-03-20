# 视频播放卡顿自动跳帧优化方案 V2

## 问题分析

从用户提供的日志中发现的问题：

1. **Tracking 被不断重置**：每次都是 "Attempt 1/10"，说明每次错误都在重新初始化 tracking
2. **闪屏问题**：跳帧过程中画面闪烁，用户体验很差
3. **过度重试**：每次错误都触发跳帧，但没有等待上一次跳帧完成

## 根本原因

`media.load()` 会触发新的 `error` 事件，导致 `handleError` 被递归调用并重新初始化 tracking。

## 新的设计方案

### 核心策略

1. **只使用时间停滞检测**：不再依赖 `error` 事件触发跳帧
2. **分离触发和执行**：错误只标记状态，超时定时器执行跳帧
3. **跳帧时隐藏画面**：避免闪屏问题

### 实现方案

#### 1. 新增 Props

```typescript
autoSkipOnStall?: boolean;      // 是否启用自动跳帧
skipStepMs?: number;            // 跳帧步长（毫秒）
maxSkipAttempts?: number;       // 最大尝试次数
stallThresholdMs?: number;      // 卡顿判定阈值
```

#### 2. 新增状态

```typescript
interface StallState {
  isStalled: boolean;           // 是否处于卡顿状态
  pendingSkip: boolean;          // 是否有待处理的跳帧
  skipCount: number;            // 当前跳帧次数
  startTime: number;            // 卡顿开始时间
  lastRetryTime: number;        // 上次重试时间
}

const stallStates = ref<Record<string, StallState>>({});
```

#### 3. 事件处理简化

**handleError**: 只标记卡顿状态，不执行跳帧
```typescript
function handleError(id: string) {
  bufferingStates.value[id] = false;
  errorStates.value[id] = true;
  emit("error", `Error loading video: ${id}`);

  if (props.autoSkipOnStall) {
    if (!stallStates.value[id]) {
      stallStates.value[id] = {
        isStalled: true,
        pendingSkip: false,
        skipCount: 0,
        startTime: Date.now(),
        lastRetryTime: 0,
      };
    } else {
      stallStates.value[id].isStalled = true;
    }
  }
}
```

**handleWaiting**: 启动卡顿检测
```typescript
function handleWaiting(id: string) {
  bufferingStates.value[id] = true;

  if (props.autoSkipOnStall && !stallStates.value[id]) {
    stallStates.value[id] = {
      isStalled: false,
      pendingSkip: false,
      skipCount: 0,
      startTime: Date.now(),
      lastRetryTime: 0,
    };
  }
}
```

**handlePlaying**: 清除卡顿状态
```typescript
function handlePlaying(id: string) {
  bufferingStates.value[id] = false;
  errorStates.value[id] = false;

  if (stallStates.value[id]) {
    delete stallStates.value[id];
  }
}
```

#### 4. 超时跳帧机制

**checkAndRecoverStall**: 检查并恢复卡顿的定时器函数
```typescript
function checkAndRecoverStall() {
  const now = Date.now();

  Object.keys(stallStates.value).forEach(id => {
    const state = stallStates.value[id];
    if (!state || !state.isStalled) return;

    const media = mediaRefs.value[id];
    if (!media) return;

    const stalledDuration = now - state.startTime;
    const timeSinceLastRetry = now - state.lastRetryTime;

    // 如果卡顿超过阈值且距离上次跳帧已过一定时间
    if (stalledDuration >= props.stallThresholdMs && timeSinceLastRetry >= 500) {
      if (state.skipCount < props.maxSkipAttempts) {
        performAutoSkip(id);
      } else {
        // 达到最大次数，放弃
        console.warn(`[AutoSkip] ${id}: Max attempts reached`);
        delete stallStates.value[id];
      }
    }
  });
}
```

#### 5. 跳帧执行

**performAutoSkip**: 实际执行跳帧（添加隐藏画面逻辑）
```typescript
function performAutoSkip(id: string) {
  const media = mediaRefs.value[id];
  if (!media) return;

  const state = stallStates.value[id];
  if (!state) return;

  const skipAmount = props.skipStepMs / 1000;
  const newTime = Math.min(media.duration, media.currentTime + skipAmount);

  console.log(`[AutoSkip] ${id}: Skip ${state.skipCount + 1}, ${media.currentTime.toFixed(2)}s -> ${newTime.toFixed(2)}s`);

  // 隐藏画面避免闪屏
  const tile = document.querySelector(`[data-tile-id="${id}"]`);
  if (tile) {
    tile.style.visibility = 'hidden';
  }

  // 执行跳帧
  media.currentTime = newTime;
  state.skipCount++;
  state.lastRetryTime = Date.now();

  // 延迟恢复显示
  setTimeout(() => {
    if (tile) {
      tile.style.visibility = 'visible';
    }
  }, 300);

  // 尝试播放
  if (isPlaying.value) {
    const playPromise = media.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log(`[AutoSkip] ${id}: Recovered at ${newTime.toFixed(2)}s`);
        delete stallStates.value[id];
      }).catch(() => {
        // 播放失败，等待下一次检查
      });
    }
  }
}
```

#### 6. 启动全局检测定时器

在组件 mounted 时启动定时器：
```typescript
let stallCheckTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  // 启动卡顿检测定时器
  if (props.autoSkipOnStall) {
    stallCheckTimer = setInterval(checkAndRecoverStall, 200);
  }
});

onUnmounted(() => {
  if (stallCheckTimer) {
    clearInterval(stallCheckTimer);
  }
});
```

### 解决闪屏问题的方案

1. **使用 visibility 控制**：跳帧时设置 `visibility: hidden`，300ms 后恢复
2. **或者使用 opacity 动画**：跳帧时设置 `opacity: 0`，配合 CSS transition
3. **或者显示 loading 图层**：跳帧时显示 loading 遮罩

推荐方案：使用 visibility + 短暂的 loading 遮罩

### 模板修改

添加 loading 遮罩：
```html
<div
  v-if="showTileTitle"
  class="absolute left-0 top-0 right-0 p-3 ..."
>
  <!-- 原有内容 -->
</div>

<!-- 跳帧时的 loading 遮罩 -->
<div
  v-if="stallStates[item.id]?.isStalled && stallStates[item.id]?.skipCount > 0"
  class="absolute inset-0 bg-black/80 flex items-center justify-center z-40"
>
  <div class="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin"></div>
</div>
```

## 实施步骤

1. 更新 Props 定义
2. 添加 StallState 接口和 stallStates 状态
3. 简化 handleError, handleWaiting, handlePlaying
4. 实现 checkAndRecoverStall 和 performAutoSkip
5. 添加组件级别的定时器管理
6. 更新模板添加 loading 遮罩
7. 添加 visibility 控制逻辑

## 预期效果

- 卡顿检测每 200ms 运行一次
- 检测到卡顿后 500ms 开始第一次跳帧
- 每次跳帧间隔 500ms
- 跳帧时画面隐藏，显示 loading
- 最大尝试 5-10 次后放弃
- 不再有无限循环
- 不再有闪屏问题
