<script setup lang="ts">
import { toRefs, ref, watch, onUnmounted, computed } from 'vue';
import {
  ChevronsLeft,
  ChevronsRight,
  FastForward,
  Maximize,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next';
import { formatTime } from '../../utils';
import type { VideoWallTag, VideoWallControlSize } from '../VideoWallPlayer/types';

interface Props {
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  playbackRates?: number[];
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  tags?: VideoWallTag[];
  showSpeedDown?: boolean;
  showSpeedUp?: boolean;
  showPlaybackRate?: boolean;
  showStop?: boolean;
  showPrevNextChunk?: boolean;
  showStepSkip?: boolean;
  stepSeconds?: number;
  controlSize?: VideoWallControlSize;
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
  showPrevNextChunk: true,
  showStepSkip: true,
  stepSeconds: 5,
  controlSize: 'normal',
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
  prevChunk: [];
  nextChunk: [];
  stepBack: [seconds: number];
  stepForward: [seconds: number];
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
  showPrevNextChunk,
  showStepSkip,
  stepSeconds,
} = toRefs(props);

const showRateList = ref(false);
const showVolumeSlider = ref(false);
const isDraggingProgress = ref(false);
const draggingProgress = ref(0);

const progressBarRef = ref<HTMLDivElement>();
const volumeSliderRef = ref<HTMLDivElement>();
const volumeHideTimerRef = ref<any>(null);
const justDraggedRef = ref(false);

const sizeClasses = computed(() => {
  switch (props.controlSize) {
    case 'small':
      return {
        container: 'px-4 py-2',
        icon: 'w-4 h-4',
        playIcon: 'w-5 h-5',
        text: 'text-xs',
        button: 'p-1.5',
        sliderHeight: 'h-6',
        tag: 'w-1.5 h-1.5',
      };
    case 'large':
      return {
        container: 'px-6 py-4',
        icon: 'w-6 h-6',
        playIcon: 'w-8 h-8',
        text: 'text-md',
        button: 'p-2.5',
        sliderHeight: 'h-10',
        tag: 'w-2.5 h-2.5',
      };
    case 'normal':
    default:
      return {
        container: 'px-6 py-3',
        icon: 'w-5 h-5',
        playIcon: 'w-6 h-6',
        text: 'text-sm',
        button: 'p-2',
        sliderHeight: 'h-8',
        tag: 'w-2 h-2',
      };
  }
});

const handlePlayPause = () => emit('playPause');
const handleSpeedDown = () => emit('speedDown');
const handleSpeedUp = () => emit('speedUp');

const handleStepBack = () => emit('stepBack', stepSeconds.value);
const handleStepForward = () => emit('stepForward', stepSeconds.value);
const handlePrevChunk = () => emit('prevChunk');
const handleNextChunk = () => emit('nextChunk');

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
  // Horizontal slider logic
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const newVolume = Math.round(percent * 100);
  emit('volumeChange', newVolume);
};

const handleStopPlay = () => emit('stop');
const handleTagClick = (tag: VideoWallTag) => emit('seek', tag.time);
const handleFullscreen = () => emit('fullscreen');

onUnmounted(() => {
  if (volumeHideTimerRef.value) clearTimeout(volumeHideTimerRef.value);
});
</script>

<template>
  <div
    class="flex items-center gap-4 text-gray-200 bg-black/80 backdrop-blur-md border-t border-white/10 w-full select-none transition-all duration-300 hover:bg-black/90"
    :class="sizeClasses.container"
  >
    <!-- Left Controls -->
    <div class="flex items-center gap-1">
      <div
        v-if="showPrevNextChunk"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handlePrevChunk"
        title="Previous Chunk"
      >
        <ChevronsLeft :class="sizeClasses.icon" />
      </div>
      
      <div
        v-if="showStepSkip"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handleStepBack"
        :title="`Back ${stepSeconds}s`"
      >
        <SkipBack :class="sizeClasses.icon" />
      </div>

      <div
        v-if="showSpeedDown"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handleSpeedDown"
        title="Slower"
      >
        <Rewind :class="sizeClasses.icon" />
      </div>
      
      <div
        class="flex items-center justify-center cursor-pointer hover:bg-blue-500 hover:text-white rounded-full transition-all active:scale-90 mx-1"
        :class="sizeClasses.button"
        @click="handlePlayPause"
      >
        <Pause v-if="isPlaying" class="fill-current" :class="sizeClasses.playIcon" />
        <Play v-else class="fill-current" :class="sizeClasses.playIcon" />
      </div>
      
      <div
        v-if="showSpeedUp"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handleSpeedUp"
        title="Faster"
      >
        <FastForward :class="sizeClasses.icon" />
      </div>

      <div
        v-if="showStepSkip"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handleStepForward"
        :title="`Forward ${stepSeconds}s`"
      >
        <SkipForward :class="sizeClasses.icon" />
      </div>

      <div
        v-if="showPrevNextChunk"
        class="flex items-center justify-center cursor-pointer hover:bg-white/10 hover:text-white rounded-full transition-all active:scale-90 text-gray-400"
        :class="sizeClasses.button"
        @click="handleNextChunk"
        title="Next Chunk"
      >
        <ChevronsRight :class="sizeClasses.icon" />
      </div>
    </div>

    <!-- Center Progress -->
    <div class="flex-1 flex items-center gap-4 min-w-0 group/progress">
      <span class="font-mono text-gray-400 min-w-[48px] text-right" :class="sizeClasses.text">{{ formatTime(currentTime) }}</span>
      
      <div
        ref="progressBarRef"
        class="flex-1 flex items-center cursor-pointer relative group/bar"
        :class="[sizeClasses.sliderHeight, { 'cursor-grabbing': isDraggingProgress }]"
        @click="handleProgressTrackClick"
      >
        <!-- Track -->
        <div class="w-full h-1 bg-white/10 rounded-full relative overflow-visible transition-all duration-300 group-hover/bar:h-1.5 group-hover/bar:bg-white/20">
          <!-- Played -->
          <div
            class="absolute top-0 left-0 h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-[width] duration-100 ease-linear"
            :style="{ width: `${isDraggingProgress ? draggingProgress * 100 : (currentTime / duration) * 100 || 0}%` }"
          >
            <!-- Thumb (Only visible on hover) -->
            <div
              class="absolute right-0 top-1/2 w-3.5 h-3.5 bg-white rounded-full -translate-y-1/2 translate-x-1/2 shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200 scale-0 group-hover/progress:scale-100"
              :class="{ 'opacity-100 scale-100': isDraggingProgress }"
              @mousedown="handleThumbMouseDown"
            ></div>
          </div>
          
          <!-- Tags -->
          <div
            v-for="(tag, index) in tags"
            :key="tag.id || index"
            class="absolute top-1/2 rounded-full -translate-y-1/2 -translate-x-1/2 hover:scale-150 z-10 transition-all cursor-help group/tag"
            :class="[!tag.color ? 'bg-yellow-500 hover:bg-yellow-400' : '', sizeClasses.tag]"
            :style="{ left: `${(tag.time / duration) * 100}%`, backgroundColor: tag.color }"
            @click.stop="handleTagClick(tag)"
          >
            <!-- Tooltip -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover/tag:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 backdrop-blur-sm shadow-xl z-50">
              {{ tag.name }}
              <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/80"></div>
            </div>
          </div>
        </div>
      </div>

      <span class="font-mono text-gray-500 min-w-[48px]" :class="sizeClasses.text">{{ formatTime(duration) }}</span>
    </div>

    <!-- Right Controls -->
    <div class="flex items-center gap-2">
      <!-- Rate -->
      <div v-if="showPlaybackRate" class="relative group/rate">
        <div class="px-3 py-1.5 flex items-center justify-center bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 hover:text-white transition-colors border border-white/5" @click="handleRateClick">
          <span class="font-bold tracking-wider" :class="sizeClasses.text">{{ playbackRate }}×</span>
        </div>
        <div v-if="showRateList" class="absolute right-0 bottom-full mb-3 min-w-[80px] py-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl backdrop-blur-md overflow-hidden z-20">
          <div
            v-for="rate in playbackRates"
            :key="rate"
            class="px-4 py-2 text-center cursor-pointer transition-colors"
            :class="[rate === playbackRate ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white', sizeClasses.text]"
            @click="handleRateChange(rate)"
          >
            {{ rate }}x
          </div>
        </div>
      </div>

      <!-- Volume -->
      <div class="relative flex items-center" @mouseenter="handleVolumeMouseEnter" @mouseleave="handleVolumeMouseLeave">
        <div
          class="flex items-center justify-center rounded-full cursor-pointer hover:bg-white/10 hover:text-white text-gray-400 transition-colors"
          :class="sizeClasses.button"
          @click="handleVolumeClick"
        >
          <VolumeX v-if="isMuted || volume === 0" :class="sizeClasses.icon" />
          <Volume2 v-else :class="sizeClasses.icon" />
        </div>
        
        <!-- Volume Slider (Horizontal expand) -->
        <div 
          class="overflow-hidden transition-all duration-300 ease-out"
          :class="showVolumeSlider ? 'w-24 opacity-100 ml-2' : 'w-0 opacity-0'"
        >
           <div class="flex items-center px-1" :class="sizeClasses.sliderHeight">
             <div ref="volumeSliderRef" class="w-full h-1 bg-white/20 rounded-full cursor-pointer relative group/vol" @click="handleVolumeChange">
               <div
                 class="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                 :class="{ 'bg-gray-500': isMuted }"
                 :style="{ width: `${volume}%` }"
               ></div>
               <div
                 class="absolute top-1/2 w-3 h-3 bg-white rounded-full -translate-y-1/2 -translate-x-1/2 shadow-sm opacity-0 group-hover/vol:opacity-100 transition-opacity"
                 :style="{ left: `${volume}%` }"
               ></div>
             </div>
           </div>
        </div>
      </div>

      <div class="w-px h-6 bg-white/10 mx-1"></div>

      <!-- Stop -->
      <div
        v-if="showStop"
        class="flex items-center justify-center rounded-full cursor-pointer text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-90"
        :class="sizeClasses.button"
        @click="handleStopPlay"
      >
        <X :class="sizeClasses.icon" />
      </div>

      <!-- Fullscreen -->
      <div
        class="flex items-center justify-center rounded-full cursor-pointer text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        :class="sizeClasses.button"
        @click="handleFullscreen"
      >
        <Maximize :class="sizeClasses.icon" />
      </div>
    </div>
  </div>
</template>
