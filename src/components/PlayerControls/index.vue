<script setup lang="ts">
import { toRefs, ref, watch, onUnmounted } from 'vue';
import {
  FastForward,
  Maximize,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next';
import { formatTime } from '../../utils';

export interface Tag {
  id: string | number;
  time: number;
  text: string;
}

interface Props {
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  playbackRates?: number[];
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  tags?: Tag[];
  showSpeedDown?: boolean;
  showSpeedUp?: boolean;
  showPlaybackRate?: boolean;
  showStop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  playbackRates: () => [3, 2, 1.5, 1, 0.5],
  tags: () => [],
  showSpeedDown: true,
  showSpeedUp: true,
  showPlaybackRate: true,
  showStop: true,
});

const emit = defineEmits<{
  fullscreen: [];
  playPause: [];
  rateChange: [rate: number];
  seek: [seconds: number];
  speedDown: [];
  speedUp: [];
  stop: [];
  volumeChange: [volume: number];
  volumeToggle: [];
}>();

const {
  isPlaying,
  currentTime,
  duration,
  playbackRates,
  playbackRate,
  volume,
  isMuted,
  tags,
  showSpeedDown,
  showSpeedUp,
  showPlaybackRate,
  showStop,
} = toRefs(props);

const showRateList = ref(false);
const showVolumeSlider = ref(false);
const isDraggingProgress = ref(false);
const draggingProgress = ref(0);

const progressBarRef = ref<HTMLDivElement>();
const volumeSliderRef = ref<HTMLDivElement>();
const volumeHideTimerRef = ref<any>(null);
const justDraggedRef = ref(false);

const handlePlayPause = () => emit('playPause');
const handleSpeedDown = () => emit('speedDown');
const handleSpeedUp = () => emit('speedUp');

const handleProgressTrackClick = (e: MouseEvent) => {
  if (justDraggedRef.value) {
    justDraggedRef.value = false;
    return;
  }
  if (!progressBarRef.value || isDraggingProgress.value) return;

  const target = e.target as HTMLElement;
  if (target.closest('.progress-thumb') || target.classList.contains('progress-thumb')) {
    return;
  }

  const rect = progressBarRef.value.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const targetSeconds = Math.floor(duration.value * percent);
  emit('seek', targetSeconds);
};

const handleThumbMouseDown = (e: MouseEvent) => {
  isDraggingProgress.value = true;
  e.stopPropagation();
  e.preventDefault();
};

watch(isDraggingProgress, (dragging) => {
  if (!dragging) return;

  const handleMouseMove = (e: MouseEvent) => {
    if (!progressBarRef.value) return;
    const rect = progressBarRef.value.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    draggingProgress.value = percent;
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!progressBarRef.value) return;
    const rect = progressBarRef.value.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    justDraggedRef.value = true;
    isDraggingProgress.value = false;
    draggingProgress.value = 0;

    const targetSeconds = Math.floor(duration.value * percent);
    emit('seek', targetSeconds);

    setTimeout(() => {
      justDraggedRef.value = false;
    }, 100);

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});

const handleRateClick = () => {
  showRateList.value = !showRateList.value;
};

const handleRateChange = (rate: number) => {
  showRateList.value = false;
  emit('rateChange', rate);
};

const handleVolumeClick = () => emit('volumeToggle');

const handleVolumeMouseEnter = () => {
  if (volumeHideTimerRef.value) {
    clearTimeout(volumeHideTimerRef.value);
    volumeHideTimerRef.value = null;
  }
  showVolumeSlider.value = true;
};

const handleVolumeMouseLeave = () => {
  volumeHideTimerRef.value = setTimeout(() => {
    showVolumeSlider.value = false;
  }, 200);
};

const handleVolumeChange = (e: MouseEvent) => {
  if (!volumeSliderRef.value) return;
  const rect = volumeSliderRef.value.getBoundingClientRect();
  const percent = 1 - (e.clientY - rect.top) / rect.height;
  const newVolume = Math.max(0, Math.min(100, Math.round(percent * 100)));
  emit('volumeChange', newVolume);
};

const handleStopPlay = () => emit('stop');
const handleTagClick = (tag: Tag) => emit('seek', tag.time);
const handleFullscreen = () => emit('fullscreen');

onUnmounted(() => {
  if (volumeHideTimerRef.value) clearTimeout(volumeHideTimerRef.value);
});
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-1 text-white bg-gradient-to-t from-black/70 to-transparent absolute bottom-0 left-0 right-0 z-10 select-none">
    <!-- Left Controls -->
    <div class="flex items-center gap-2">
      <div v-if="showSpeedDown" class="p-1 cursor-pointer hover:bg-white/10 rounded transition-transform active:scale-95" @click="handleSpeedDown">
        <Rewind class="w-5 h-5" />
      </div>
      <div class="p-1 cursor-pointer hover:bg-white/25 rounded transition-transform active:scale-95" @click="handlePlayPause">
        <Pause v-if="isPlaying" class="w-6 h-6" />
        <Play v-else class="w-6 h-6" />
      </div>
      <div v-if="showSpeedUp" class="p-1 cursor-pointer hover:bg-white/10 rounded transition-transform active:scale-95" @click="handleSpeedUp">
        <FastForward class="w-5 h-5" />
      </div>
    </div>

    <!-- Center Progress -->
    <div class="flex-1 flex items-center gap-3 min-w-0">
      <div
        ref="progressBarRef"
        class="flex-1 h-8 flex items-center cursor-pointer relative group"
        :class="{ 'cursor-grabbing': isDraggingProgress }"
        @click="handleProgressTrackClick"
      >
        <!-- Track -->
        <div class="w-full h-1.5 bg-white/30 rounded-full relative overflow-visible transition-all group-hover:h-1.5">
          <!-- Played -->
          <div
            class="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-[width] duration-100 ease-linear"
            :style="{ width: `${isDraggingProgress ? draggingProgress * 100 : (currentTime / duration) * 100 || 0}%` }"
          ></div>
          
          <!-- Tags -->
          <div
            v-for="tag in tags"
            :key="tag.id"
            class="absolute top-1/2 w-3 h-3 bg-red-500 border-2 border-white rounded-full -translate-y-1/2 -translate-x-1/2 hover:scale-125 z-10 transition-transform"
            :style="{ left: `${(tag.time / duration) * 100}%` }"
            :title="tag.text"
            @click.stop="handleTagClick(tag)"
          ></div>

          <!-- Thumb -->
          <div
            class="absolute top-1/2 w-3 h-3 bg-white rounded-full -translate-y-1/2 -translate-x-1/2 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
            :class="{ 'opacity-100 w-4 h-4': isDraggingProgress }"
            :style="{ left: `${isDraggingProgress ? draggingProgress * 100 : (currentTime / duration) * 100 || 0}%` }"
            @mousedown="handleThumbMouseDown"
          ></div>
        </div>
      </div>

      <div class="flex items-center gap-1 font-mono text-sm text-white/90 whitespace-nowrap">
        <span>{{ formatTime(currentTime) }}</span>
        <span class="text-white/60">/</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- Right Controls -->
    <div class="flex items-center gap-3">
      <!-- Rate -->
      <div v-if="showPlaybackRate" class="relative">
        <div class="px-3 h-8 flex items-center justify-center bg-white/10 rounded cursor-pointer hover:bg-white/20 transition-colors" @click="handleRateClick">
          <span class="text-sm font-medium">{{ playbackRate }}x</span>
        </div>
        <div v-if="showRateList" class="absolute right-0 bottom-full mb-2 min-w-[60px] py-1 bg-black/85 rounded-md shadow-lg backdrop-blur-sm">
          <div
            v-for="rate in playbackRates"
            :key="rate"
            class="px-4 py-2 text-sm text-center cursor-pointer hover:bg-white/10 transition-colors"
            :class="{ 'text-blue-500 font-medium': rate === playbackRate }"
            @click="handleRateChange(rate)"
          >
            {{ rate }}x
          </div>
        </div>
      </div>

      <!-- Volume -->
      <div class="relative" @mouseenter="handleVolumeMouseEnter" @mouseleave="handleVolumeMouseLeave">
        <div class="w-8 h-8 flex items-center justify-center rounded cursor-pointer hover:bg-white/10" @click="handleVolumeClick">
          <VolumeX v-if="isMuted" class="w-5 h-5 opacity-50" />
          <Volume2 v-else-if="volume > 0" class="w-5 h-5" />
          <VolumeX v-else class="w-5 h-5 opacity-50" />
        </div>
        
        <!-- Volume Slider -->
        <div v-if="showVolumeSlider" class="absolute right-0 bottom-full pb-5">
           <div class="p-3 bg-black/85 rounded-md shadow-lg backdrop-blur-sm">
             <div ref="volumeSliderRef" class="w-8 h-28 flex justify-center cursor-pointer relative" @click="handleVolumeChange">
               <div class="w-1.5 h-full bg-white/30 rounded-full relative">
                 <div
                   class="absolute bottom-0 left-0 w-full bg-blue-500 rounded-full transition-[height] duration-100"
                   :class="{ 'bg-white/50': isMuted }"
                   :style="{ height: `${volume}%` }"
                 ></div>
                 <div
                   class="absolute left-1/2 w-2.5 h-2.5 bg-white rounded-full -translate-x-1/2 shadow-sm transition-all"
                   :class="{ 'bg-white/50': isMuted }"
                   :style="{ bottom: `${volume}%`, transform: 'translate(-50%, 50%)' }"
                 ></div>
               </div>
             </div>
           </div>
        </div>
      </div>

      <!-- Fullscreen -->
      <div class="w-8 h-8 flex items-center justify-center rounded cursor-pointer hover:bg-white/10" @click="handleFullscreen">
        <Maximize class="w-5 h-5" />
      </div>

      <!-- Stop -->
      <div v-if="showStop" class="w-8 h-8 flex items-center justify-center rounded cursor-pointer hover:text-red-500 transition-colors" @click="handleStopPlay">
        <X class="w-5 h-5" />
      </div>
    </div>
  </div>
</template>
