<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import type {
  VideoWallControlSize,
  VideoWallLayoutMode,
  VideoWallTheme,
} from '../../src/components/VideoWallPlayer/types';

type Lang = 'zh-CN' | 'en';

const props = defineProps<{
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  showControls: boolean;
  aspectRatio: number;
  gap: number;
  objectFit: 'contain' | 'cover' | 'fill';
  theme: VideoWallTheme;
  draggable: boolean;
  showTileTitle: boolean;
  showTileMute: boolean;
  showTileFullscreen: boolean;
  showSidebar: boolean;
  showPrevNextChunk: boolean;
  showStepSkip: boolean;
  showPlaybackRate: boolean;
  showSpeedControl: boolean;
  fixedTileMeta: boolean;
  stepSeconds: number;
  controlSize: VideoWallControlSize;
  sidebarWidth: number;
  videoWallPadding: number;
  videoCount: number;
  layoutMode: VideoWallLayoutMode;
  autoSkipOnStall: boolean;
  skipStepMs: number;
  maxSkipAttempts: number;
  stallThresholdMs: number;
}>();

const emit = defineEmits<{
  'update:autoplay': [value: boolean];
  'update:muted': [value: boolean];
  'update:loop': [value: boolean];
  'update:showControls': [value: boolean];
  'update:aspectRatio': [value: number];
  'update:gap': [value: number];
  'update:objectFit': [value: 'contain' | 'cover' | 'fill'];
  'update:theme': [value: VideoWallTheme];
  'update:draggable': [value: boolean];
  'update:showTileTitle': [value: boolean];
  'update:showTileMute': [value: boolean];
  'update:showTileFullscreen': [value: boolean];
  'update:showSidebar': [value: boolean];
  'update:showPrevNextChunk': [value: boolean];
  'update:showStepSkip': [value: boolean];
  'update:showPlaybackRate': [value: boolean];
  'update:showSpeedControl': [value: boolean];
  'update:fixedTileMeta': [value: boolean];
  'update:stepSeconds': [value: number];
  'update:controlSize': [value: VideoWallControlSize];
  'update:sidebarWidth': [value: number];
  'update:videoWallPadding': [value: number];
  'update:videoCount': [value: number];
  'update:layoutMode': [value: VideoWallLayoutMode];
  'update:autoSkipOnStall': [value: boolean];
  'update:skipStepMs': [value: number];
  'update:maxSkipAttempts': [value: number];
  'update:stallThresholdMs': [value: number];
}>();

const open = ref(false);
const lang = useStorage<Lang>('demo-lang', 'en');

const t = computed(() => {
  const zh = lang.value === 'zh-CN';
  return {
    settings: zh ? '设置' : 'Settings',
    config: zh ? '配置' : 'Configuration',
    autoplay: zh ? '自动播放' : 'Autoplay',
    muted: zh ? '静音（初始）' : 'Muted (Initial)',
    loop: zh ? '循环播放' : 'Loop',
    showControls: zh ? '显示控制条' : 'Show Controls',
    videoCount: zh ? '视频数量' : 'Video Count',
    gap: zh ? '间距' : 'Gap',
    aspectRatio: zh ? '画面比例' : 'Aspect Ratio',
    theme: zh ? '主题' : 'Theme',
    objectFit: zh ? '填充模式' : 'Object Fit',
    note: zh
      ? '提示：Autoplay/Muted 的变更可能需要刷新后才能完全生效。'
      : 'Note: Autoplay/Muted changes may require reload to take effect fully.',
    uiToggles: zh ? '界面开关' : 'UI Toggles',
    showSidebar: zh ? '显示侧边栏' : 'Show Sidebar',
    draggable: zh ? '允许拖拽' : 'Draggable',
    tileTitle: zh ? '显示标题' : 'Tile Title',
    tileMute: zh ? '显示单格静音' : 'Tile Mute',
    tileFullscreen: zh ? '显示单格全屏' : 'Tile Fullscreen',
    fixedTileMeta: zh ? '固定单格信息' : 'Fixed Tile Meta',
    controls: zh ? '控制项' : 'Controls',
    prevNext: zh ? '上一段/下一段' : 'Prev/Next Chunk',
    stepSkip: zh ? '步进跳转' : 'Step Skip',
    playbackRate: zh ? '倍速选择' : 'Playback Rate',
    speedControl: zh ? '快退/快进按钮' : 'Speed Control (Rewind/FF)',
    stepSeconds: zh ? '步进秒数' : 'Step Seconds',
    controlSize: zh ? '控制条尺寸' : 'Control Size',
    layout: zh ? '布局' : 'Layout',
    layoutMode: zh ? '布局模式' : 'Layout Mode',
    sidebarWidth: zh ? '侧边栏宽度' : 'Sidebar Width',
    wallPadding: zh ? '视频墙内边距' : 'Video Wall Padding',
    lang: zh ? '语言' : 'Language',
    langZh: '中文',
    langEn: 'EN',
    autoSkip: zh ? '自动跳帧' : 'Auto Skip on Stall',
    skipStep: zh ? '跳帧步长' : 'Skip Step (ms)',
    maxAttempts: zh ? '最大尝试次数' : 'Max Attempts',
    stallThreshold: zh ? '卡顿检测阈值' : 'Stall Threshold (ms)',
  };
});

function toggleLang() {
  lang.value = lang.value === 'zh-CN' ? 'en' : 'zh-CN';
}

const modelAutoplay = computed({
  get: () => props.autoplay,
  set: (v: boolean) => emit('update:autoplay', v),
});
const modelMuted = computed({
  get: () => props.muted,
  set: (v: boolean) => emit('update:muted', v),
});
const modelLoop = computed({
  get: () => props.loop,
  set: (v: boolean) => emit('update:loop', v),
});
const modelShowControls = computed({
  get: () => props.showControls,
  set: (v: boolean) => emit('update:showControls', v),
});
const modelAspectRatio = computed({
  get: () => props.aspectRatio,
  set: (v: number) => emit('update:aspectRatio', v),
});
const modelGap = computed({
  get: () => props.gap,
  set: (v: number) => emit('update:gap', v),
});
const modelObjectFit = computed({
  get: () => props.objectFit,
  set: (v: 'contain' | 'cover' | 'fill') => emit('update:objectFit', v),
});
const modelTheme = computed({
  get: () => props.theme,
  set: (v: VideoWallTheme) => emit('update:theme', v),
});
const modelDraggable = computed({
  get: () => props.draggable,
  set: (v: boolean) => emit('update:draggable', v),
});
const modelShowTileTitle = computed({
  get: () => props.showTileTitle,
  set: (v: boolean) => emit('update:showTileTitle', v),
});
const modelShowTileMute = computed({
  get: () => props.showTileMute,
  set: (v: boolean) => emit('update:showTileMute', v),
});
const modelShowTileFullscreen = computed({
  get: () => props.showTileFullscreen,
  set: (v: boolean) => emit('update:showTileFullscreen', v),
});
const modelShowSidebar = computed({
  get: () => props.showSidebar,
  set: (v: boolean) => emit('update:showSidebar', v),
});
const modelShowPrevNextChunk = computed({
  get: () => props.showPrevNextChunk,
  set: (v: boolean) => emit('update:showPrevNextChunk', v),
});
const modelShowStepSkip = computed({
  get: () => props.showStepSkip,
  set: (v: boolean) => emit('update:showStepSkip', v),
});
const modelShowPlaybackRate = computed({
  get: () => props.showPlaybackRate,
  set: (v: boolean) => emit('update:showPlaybackRate', v),
});
const modelShowSpeedControl = computed({
  get: () => props.showSpeedControl,
  set: (v: boolean) => emit('update:showSpeedControl', v),
});
const modelFixedTileMeta = computed({
  get: () => props.fixedTileMeta,
  set: (v: boolean) => emit('update:fixedTileMeta', v),
});
const modelStepSeconds = computed({
  get: () => props.stepSeconds,
  set: (v: number) => emit('update:stepSeconds', v),
});
const modelControlSize = computed({
  get: () => props.controlSize,
  set: (v: VideoWallControlSize) => emit('update:controlSize', v),
});
const modelSidebarWidth = computed({
  get: () => props.sidebarWidth,
  set: (v: number) => emit('update:sidebarWidth', v),
});
const modelVideoWallPadding = computed({
  get: () => props.videoWallPadding,
  set: (v: number) => emit('update:videoWallPadding', v),
});
const modelVideoCount = computed({
  get: () => props.videoCount,
  set: (v: number) => emit('update:videoCount', v),
});
const modelLayoutMode = computed({
  get: () => props.layoutMode,
  set: (v: VideoWallLayoutMode) => emit('update:layoutMode', v),
});
const modelAutoSkipOnStall = computed({
  get: () => props.autoSkipOnStall,
  set: (v: boolean) => emit('update:autoSkipOnStall', v),
});
const modelSkipStepMs = computed({
  get: () => props.skipStepMs,
  set: (v: number) => emit('update:skipStepMs', v),
});
const modelMaxSkipAttempts = computed({
  get: () => props.maxSkipAttempts,
  set: (v: number) => emit('update:maxSkipAttempts', v),
});
const modelStallThresholdMs = computed({
  get: () => props.stallThresholdMs,
  set: (v: number) => emit('update:stallThresholdMs', v),
});
</script>

<template>
  <button class="demo-settings-toggle" @click="open = !open">
    ⚙️ {{ t.settings }}
  </button>

  <div v-if="open" class="demo-settings">
    <div class="demo-settings-header">
      <h3>{{ t.config }}</h3>
      <button class="demo-lang-toggle" @click="toggleLang">
        {{ t.lang }}: {{ lang === 'zh-CN' ? t.langZh : t.langEn }}
      </button>
    </div>

    <div>
      <div class="row">
        <label>{{ t.autoplay }}</label>
        <input type="checkbox" v-model="modelAutoplay" />
      </div>

      <div class="row">
        <label>{{ t.muted }}</label>
        <input type="checkbox" v-model="modelMuted" />
      </div>

      <div class="row">
        <label>{{ t.loop }}</label>
        <input type="checkbox" v-model="modelLoop" />
      </div>

      <div class="row">
        <label>{{ t.showControls }}</label>
        <input type="checkbox" v-model="modelShowControls" />
      </div>

      <div>
        <div class="row">
          <label>{{ t.videoCount }}</label>
          <span class="muted">{{ modelVideoCount }}</span>
        </div>
        <input
          type="range"
          v-model.number="modelVideoCount"
          min="1"
          max="25"
        />
      </div>

      <div>
        <div class="row">
          <label>{{ t.gap }}</label>
          <span class="muted">{{ modelGap }}px</span>
        </div>
        <input type="range" v-model.number="modelGap" min="0" max="32" />
      </div>

      <div>
        <label class="muted">{{ t.aspectRatio }}</label>
        <select v-model.number="modelAspectRatio">
          <option :value="16 / 9">{{ lang === 'zh-CN' ? '16:9（横屏）' : '16:9 (Landscape)' }}</option>
          <option :value="4 / 3">{{ lang === 'zh-CN' ? '4:3（标清）' : '4:3 (SD)' }}</option>
          <option :value="1">{{ lang === 'zh-CN' ? '1:1（方形）' : '1:1 (Square)' }}</option>
          <option :value="9 / 16">{{ lang === 'zh-CN' ? '9:16（竖屏）' : '9:16 (Portrait)' }}</option>
        </select>
      </div>

      <div>
        <label class="muted">{{ t.theme }}</label>
        <select v-model="modelTheme">
          <option value="default">{{ lang === 'zh-CN' ? '默认（经典暗色）' : 'Default (Classic Dark)' }}</option>
          <option value="cyberpunk">{{ lang === 'zh-CN' ? '赛博朋克' : 'Cyberpunk (Sci-Fi)' }}</option>
          <option value="industrial">{{ lang === 'zh-CN' ? '工业风' : 'Industrial (Brutalist)' }}</option>
          <option value="minimalist">{{ lang === 'zh-CN' ? '极简' : 'Minimalist (Clean)' }}</option>
          <option value="glass">{{ lang === 'zh-CN' ? '玻璃拟态' : 'Glass (Futuristic)' }}</option>
        </select>
      </div>

      <div>
        <label class="muted">{{ t.objectFit }}</label>
        <select v-model="modelObjectFit">
          <option value="contain">{{ lang === 'zh-CN' ? '完整显示' : 'Contain' }}</option>
          <option value="cover">{{ lang === 'zh-CN' ? '裁剪填充' : 'Cover' }}</option>
          <option value="fill">{{ lang === 'zh-CN' ? '拉伸填充' : 'Fill' }}</option>
        </select>
      </div>

      <div class="muted" style="margin-top: 12px; font-style: italic;">
        {{ t.note }}
      </div>

      <h4>{{ t.uiToggles }}</h4>

      <div class="row">
        <label>{{ t.showSidebar }}</label>
        <input type="checkbox" v-model="modelShowSidebar" />
      </div>
      <div class="row">
        <label>{{ t.draggable }}</label>
        <input type="checkbox" v-model="modelDraggable" />
      </div>
      <div class="row">
        <label>{{ t.tileTitle }}</label>
        <input type="checkbox" v-model="modelShowTileTitle" />
      </div>
      <div class="row">
        <label>{{ t.tileMute }}</label>
        <input type="checkbox" v-model="modelShowTileMute" />
      </div>
      <div class="row">
        <label>{{ t.tileFullscreen }}</label>
        <input type="checkbox" v-model="modelShowTileFullscreen" />
      </div>
      <div class="row">
        <label>{{ t.fixedTileMeta }}</label>
        <input type="checkbox" v-model="modelFixedTileMeta" />
      </div>

      <h4>{{ t.controls }}</h4>

      <div class="row">
        <label>{{ t.prevNext }}</label>
        <input type="checkbox" v-model="modelShowPrevNextChunk" />
      </div>
      <div class="row">
        <label>{{ t.stepSkip }}</label>
        <input type="checkbox" v-model="modelShowStepSkip" />
      </div>
      <div class="row">
        <label>{{ t.playbackRate }}</label>
        <input type="checkbox" v-model="modelShowPlaybackRate" />
      </div>
      <div class="row">
        <label>{{ t.speedControl }}</label>
        <input type="checkbox" v-model="modelShowSpeedControl" />
      </div>
      <div>
        <div class="row">
          <label>{{ t.stepSeconds }}</label>
          <span class="muted">{{ modelStepSeconds }}s</span>
        </div>
        <input
          type="range"
          v-model.number="modelStepSeconds"
          min="1"
          max="30"
        />
      </div>

      <div>
        <label class="muted">{{ t.controlSize }}</label>
        <select v-model="modelControlSize">
          <option value="small">{{ lang === 'zh-CN' ? '小' : 'Small' }}</option>
          <option value="normal">{{ lang === 'zh-CN' ? '中' : 'Normal' }}</option>
          <option value="large">{{ lang === 'zh-CN' ? '大' : 'Large' }}</option>
        </select>
      </div>

      <h4>{{ lang === 'zh-CN' ? '自动跳帧恢复' : 'Auto Skip Recovery' }}</h4>

      <div class="row">
        <label>{{ t.autoSkip }}</label>
        <input type="checkbox" v-model="modelAutoSkipOnStall" />
      </div>

      <div>
        <div class="row">
          <label>{{ t.skipStep }}</label>
          <span class="muted">{{ modelSkipStepMs }}ms</span>
        </div>
        <input
          type="range"
          v-model.number="modelSkipStepMs"
          min="50"
          max="1000"
          step="50"
        />
      </div>

      <div>
        <div class="row">
          <label>{{ t.maxAttempts }}</label>
          <span class="muted">{{ modelMaxSkipAttempts }}</span>
        </div>
        <input
          type="range"
          v-model.number="modelMaxSkipAttempts"
          min="1"
          max="20"
        />
      </div>

      <div>
        <div class="row">
          <label>{{ t.stallThreshold }}</label>
          <span class="muted">{{ modelStallThresholdMs }}ms</span>
        </div>
        <input
          type="range"
          v-model.number="modelStallThresholdMs"
          min="200"
          max="3000"
          step="100"
        />
      </div>

      <h4>{{ t.layout }}</h4>
      <div>
        <label class="muted">{{ t.layoutMode }}</label>
        <select v-model="modelLayoutMode">
          <option value="auto">{{ lang === 'zh-CN' ? '自动（响应式）' : 'Auto (Responsive)' }}</option>
          <option value="1x1">1x1</option>
          <option value="2x2">2x2</option>
          <option value="3x3">3x3</option>
          <option value="4x4">4x4</option>
          <option value="1+5">1+5</option>
          <option value="1+7">1+7</option>
        </select>
      </div>
      <div>
        <div class="row">
          <label>{{ t.sidebarWidth }}</label>
          <span class="muted">{{ modelSidebarWidth }}px</span>
        </div>
        <input
          type="range"
          v-model.number="modelSidebarWidth"
          min="200"
          max="500"
        />
      </div>
      <div>
        <div class="row">
          <label>{{ t.wallPadding }}</label>
          <span class="muted">{{ modelVideoWallPadding }}px</span>
        </div>
        <input
          type="range"
          v-model.number="modelVideoWallPadding"
          min="0"
          max="50"
        />
      </div>
    </div>
  </div>
</template>

