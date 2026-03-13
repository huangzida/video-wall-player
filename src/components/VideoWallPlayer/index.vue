<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted } from "vue";
import { useFullscreen } from "@vueuse/core";
import { AudioLines, Volume2, VolumeX } from "lucide-vue-next";
import PlayerControls from "../PlayerControls/index.vue";
import { useVideoWallLayout } from "../../hooks/useVideoWallLayout";
import { formatTime, PLAYBACK_RATE_LEVELS } from "../../utils";
import type { VideoWallResource, VideoWallTag, VideoWallTheme } from "./types";

defineOptions({ name: "VideoWallPlayer" });

const props = withDefaults(
  defineProps<{
    resources: VideoWallResource[];
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    aspectRatio?: number;
    gap?: number;
    showControls?: boolean;
    objectFit?: "contain" | "cover" | "fill";
    theme?: VideoWallTheme;
    draggable?: boolean;
    showTileTitle?: boolean;
    showTileMute?: boolean;
    showSidebar?: boolean;
    tags?: VideoWallTag[];
    showPrevNextChunk?: boolean;
    showStepSkip?: boolean;
    showPlaybackRate?: boolean;
    showSpeedControl?: boolean;
    stepSeconds?: number;
    fixedTileMeta?: boolean;
    sidebarWidth?: number;
    videoWallPadding?: number;
  }>(),
  {
    resources: () => [],
    title: "",
    autoplay: false,
    muted: false,
    loop: false,
    aspectRatio: 16 / 9,
    gap: 8,
    showControls: true,
    objectFit: "contain",
    theme: "default",
    draggable: true,
    showTileTitle: true,
    showTileMute: true,
    showSidebar: true,
    tags: () => [],
    showPrevNextChunk: true,
    showStepSkip: true,
    showPlaybackRate: true,
    showSpeedControl: true,
    stepSeconds: 5,
    fixedTileMeta: true,
    sidebarWidth: 280,
    videoWallPadding: 10,
  }
);

const emit = defineEmits<{
  error: [message: string];
  close: [];
}>();

const activeChunkIndex = ref(0);
const isPlaying = ref(false);
const currentTime = ref(0);
const playbackRate = ref(1);
const volume = ref(50);
const individualMutedStates = ref<Record<string, boolean>>({});

const wallRef = ref<HTMLElement>();
const mediaRefs = ref<Record<string, HTMLMediaElement>>({});
const suppressTimeUpdate = ref(false);

const itemCount = computed(() => props.resources.length);
const showPerTileMeta = computed(() => itemCount.value > 1);
const canReorderWall = computed(() => itemCount.value > 1);

const primaryResourceId = ref("");
const draggingId = ref("");
const dragOverId = ref("");

// Local copy of resources to support reordering
const localResources = ref<VideoWallResource[]>([]);

watch(
  () => props.resources,
  (newResources) => {
    localResources.value = [...newResources];

    if (newResources.length > 0) {
      if (props.muted) {
        newResources.forEach((item) => {
          individualMutedStates.value[item.id] = true;
        });
      }
    }
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  if (props.autoplay && localResources.value.length > 0) {
    // Give a small buffer for elements to be ready
    setTimeout(() => {
      void playAllVideos();
    }, 500);
  }
});

const { containerRef, layout } = useVideoWallLayout(
  itemCount,
  computed(() => ({
    aspectRatio: props.aspectRatio,
    gap: props.gap,
  }))
);

const gridStyle = computed(() => ({
  display: "grid",
  gridTemplateColumns: `repeat(${layout.value.cols}, ${layout.value.itemWidth}px)`,
  gridTemplateRows: `repeat(${layout.value.rows}, ${layout.value.itemHeight}px)`,
  gap: `${props.gap}px`,
  justifyContent: "center",
  alignContent: "center",
  width: "100%",
  height: "100%",
}));

const itemStyle = computed(() => ({
  width: `${layout.value.itemWidth}px`,
  height: `${layout.value.itemHeight}px`,
}));

const { toggle: toggleFullscreen } = useFullscreen(wallRef);

// Derived from the first resource
const primaryResource = computed(() => localResources.value[0]);
const segmentDurations = computed(() => primaryResource.value?.durations || []);

const duration = computed(() =>
  segmentDurations.value.reduce((sum, item) => sum + Math.max(0, item || 0), 0)
);

const segmentStarts = computed(() => {
  const starts: number[] = [];
  let total = 0;
  segmentDurations.value.forEach((item) => {
    starts.push(total);
    total += Math.max(0, item || 0);
  });
  return starts;
});

const primaryId = computed(
  () => primaryResourceId.value || localResources.value[0]?.id || ""
);

const isMuted = computed(() => {
  const allIds = localResources.value.map((item) => item.id);
  if (allIds.length === 0) return false;
  return allIds.every((id) => individualMutedStates.value[id]);
});

const segmentList = computed(() => {
  if (!primaryResource.value) return [];

  const total = primaryResource.value.chunkUrls.length;

  return Array.from({ length: total }, (_, index) => {
    const chunkNo = index + 1;
    const url = primaryResource.value!.chunkUrls[index] || "";
    // Infer suffix from URL
    const match = url.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
    const suffix = match ? `.${match[1]}` : "";

    return {
      index,
      name: `${chunkNo}${suffix}`,
      duration: Math.max(0, Number(segmentDurations.value[index]) || 0),
    };
  });
});

const isAudioChunk = computed(() => {
  if (!primaryResource.value) return false;
  const url = primaryResource.value.chunkUrls[activeChunkIndex.value] || "";
  return url.toLowerCase().includes(".wav");
});

function setMediaRef(id: string, el: HTMLMediaElement | null) {
  if (!el) {
    delete mediaRefs.value[id];
    return;
  }
  mediaRefs.value[id] = el;
}

watch(
  localResources,
  (next) => {
    if (next.length === 0) {
      primaryResourceId.value = "";
      return;
    }
    const hasPrimary = next.some((item) => item.id === primaryResourceId.value);
    if (!hasPrimary) {
      primaryResourceId.value = next[0]?.id || "";
    }
  },
  { deep: true }
);

// Drag and Drop Logic
function handleTileDragStart(event: DragEvent, id: string) {
  if (!canReorderWall.value) {
    event.preventDefault();
    return;
  }
  draggingId.value = id;
  dragOverId.value = "";
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }
}

function handleTileDragOver(event: DragEvent, targetId: string) {
  if (
    !canReorderWall.value ||
    !draggingId.value ||
    draggingId.value === targetId
  ) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOverId.value = targetId;
}

function handleTileDrop(event: DragEvent, targetId: string) {
  if (
    !canReorderWall.value ||
    !draggingId.value ||
    draggingId.value === targetId
  ) {
    return;
  }
  event.preventDefault();
  const sourceIndex = localResources.value.findIndex(
    (item) => item.id === draggingId.value
  );
  const targetIndex = localResources.value.findIndex(
    (item) => item.id === targetId
  );

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    dragOverId.value = "";
    return;
  }

  const next = [...localResources.value];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) return;
  next.splice(targetIndex, 0, moved);
  localResources.value = next;
  dragOverId.value = "";
}

function handleTileDragEnd() {
  draggingId.value = "";
  dragOverId.value = "";
}

// Playback Logic
function applyVideoSettings() {
  localResources.value.forEach((item) => {
    const media = mediaRefs.value[item.id];
    if (!media) return;
    media.playbackRate = playbackRate.value;
    media.volume = Math.max(0, Math.min(1, volume.value / 100));
    media.muted = !!individualMutedStates.value[item.id];
  });
}

function syncIsPlayingFromPrimary() {
  const id = primaryId.value;
  if (!id) {
    isPlaying.value = false;
    return;
  }
  const media = mediaRefs.value[id];
  if (!media) {
    isPlaying.value = false;
    return;
  }
  isPlaying.value = !media.paused && !media.ended;
}

async function playAllVideos() {
  const tasks = localResources.value.map(async (item) => {
    const media = mediaRefs.value[item.id];
    if (!media) return;
    try {
      await media.play();
    } catch {
      // ignore
    }
  });
  await Promise.allSettled(tasks);
  syncIsPlayingFromPrimary();
}

function pauseAllVideos() {
  localResources.value.forEach((item) => {
    const media = mediaRefs.value[item.id];
    if (!media) return;
    media.pause();
  });
  syncIsPlayingFromPrimary();
}

function syncCurrentTimeFromPrimary() {
  if (suppressTimeUpdate.value) return;
  const id = primaryId.value;
  if (!id) return;
  const media = mediaRefs.value[id];
  if (!media) return;

  const segmentStart = segmentStarts.value[activeChunkIndex.value] || 0;
  currentTime.value = Math.min(
    duration.value,
    segmentStart + media.currentTime
  );
  syncIsPlayingFromPrimary();
}

async function switchChunk(
  chunkIndex: number,
  localTime = 0,
  autoPlay = false
) {
  if (localResources.value.length === 0) return;

  const maxIndex = Math.max(
    0,
    (localResources.value[0]?.chunkUrls.length || 1) - 1
  );
  const safeChunkIndex = Math.max(0, Math.min(chunkIndex, maxIndex));

  suppressTimeUpdate.value = true;
  try {
    activeChunkIndex.value = safeChunkIndex;
    await nextTick();

    localResources.value.forEach((item) => {
      const media = mediaRefs.value[item.id];
      if (!media) return;

      const chunkDuration =
        segmentDurations.value[safeChunkIndex] || media.duration || 0;
      const safeLocalTime = Math.max(
        0,
        Math.min(localTime, Math.max(0, chunkDuration - 0.05))
      );
      media.currentTime = Number.isFinite(safeLocalTime) ? safeLocalTime : 0;
    });

    applyVideoSettings();

    const segmentStart = segmentStarts.value[safeChunkIndex] || 0;
    currentTime.value = Math.min(duration.value, segmentStart + localTime);
  } finally {
    suppressTimeUpdate.value = false;
  }

  if (autoPlay) {
    void playAllVideos();
  } else {
    pauseAllVideos();
  }
}

function locateByGlobalTime(target: number) {
  const safeTarget = Math.max(0, Math.min(duration.value, target));
  if (segmentDurations.value.length === 0) {
    return { chunkIndex: 0, localTime: 0 };
  }

  for (let index = 0; index < segmentDurations.value.length; index += 1) {
    const start = segmentStarts.value[index] || 0;
    const end = start + (segmentDurations.value[index] || 0);

    if (safeTarget < end || index === segmentDurations.value.length - 1) {
      return { chunkIndex: index, localTime: Math.max(0, safeTarget - start) };
    }
  }
  return { chunkIndex: segmentDurations.value.length - 1, localTime: 0 };
}

async function handlePrimaryEnded() {
  const totalChunks = segmentList.value.length;
  if (totalChunks <= 0) return;

  if (activeChunkIndex.value >= totalChunks - 1) {
    if (props.loop) {
      await switchChunk(0, 0, true);
      return;
    }
    isPlaying.value = false;
    return;
  }
  await switchChunk(activeChunkIndex.value + 1, 0, true);
}

// Handlers for PlayerControls
const handlePlayPause = () =>
  isPlaying.value ? pauseAllVideos() : void playAllVideos();
const handleRateChange = (value: number) => {
  playbackRate.value = value;
  applyVideoSettings();
};
const handleSpeedDown = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx < PLAYBACK_RATE_LEVELS.length - 1)
    handleRateChange(PLAYBACK_RATE_LEVELS[idx + 1]!);
};
const handleSpeedUp = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx > 0) handleRateChange(PLAYBACK_RATE_LEVELS[idx - 1]!);
};
const handleSeek = async (value: number) => {
  const { chunkIndex, localTime } = locateByGlobalTime(value);
  const primaryMedia = mediaRefs.value[primaryId.value];
  const shouldPlay = primaryMedia ? !primaryMedia.paused : isPlaying.value;
  await switchChunk(chunkIndex, localTime, shouldPlay);
};
const handleVolumeToggle = () => {
  const nextMuted = !isMuted.value;
  localResources.value.forEach((item) => {
    individualMutedStates.value[item.id] = nextMuted;
  });
  applyVideoSettings();
};
const handleVolumeChange = (value: number) => {
  volume.value = value;
  localResources.value.forEach((item) => {
    individualMutedStates.value[item.id] = false;
  });
  applyVideoSettings();
};
const toggleIndividualMute = (id: string) => {
  individualMutedStates.value[id] = !individualMutedStates.value[id];
  applyVideoSettings();
};
const handleStepBack = (seconds: number) => {
  void handleSeek(Math.max(0, currentTime.value - seconds));
};
const handleStepForward = (seconds: number) => {
  void handleSeek(Math.min(duration.value, currentTime.value + seconds));
};
const handlePrevChunk = () => {
  if (activeChunkIndex.value > 0) {
    void switchChunk(activeChunkIndex.value - 1, 0, isPlaying.value);
  }
};
const handleNextChunk = () => {
  if (activeChunkIndex.value < segmentList.value.length - 1) {
    void switchChunk(activeChunkIndex.value + 1, 0, isPlaying.value);
  }
};
const handleSegmentClick = (index: number) => {
  void switchChunk(index, 0, true);
};

defineExpose({
  play: playAllVideos,
  pause: pauseAllVideos,
  seek: handleSeek,
});
</script>

<template>
  <div
    class="flex w-full h-full min-h-[500px] gap-4 text-gray-100 font-sans transition-colors duration-300 vwp-bg-main vwp-font"
    :class="[`theme-${theme}`]"
  >
    <!-- Sidebar -->
    <div
      v-if="showSidebar"
      class="flex flex-col overflow-hidden backdrop-blur-sm transition-all duration-300 vwp-bg-sidebar vwp-border border vwp-radius vwp-shadow"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div
        class="px-4 py-3 border-b vwp-border flex justify-between items-center bg-white/[0.02]"
      >
        <span
          class="text-sm font-semibold tracking-wide uppercase vwp-text-primary"
          >{{ title || "Segments" }}</span
        >
        <span
          class="text-xs font-mono vwp-accent-bg-soft px-2 py-0.5 rounded-full vwp-accent"
          >{{ formatTime(duration) }}</span
        >
      </div>
      <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        <div
          v-for="segment in segmentList"
          :key="segment.index"
          class="group relative cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-all duration-200 border border-transparent"
          :class="
            activeChunkIndex === segment.index
              ? 'vwp-accent-bg-soft vwp-border vwp-accent'
              : 'hover:bg-white/5 vwp-text-secondary hover:text-gray-200'
          "
          @click="handleSegmentClick(segment.index)"
        >
          <div class="flex justify-between items-center relative z-10">
            <span class="truncate font-medium">{{ segment.name }}</span>
            <span
              class="text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity"
              >{{ formatTime(segment.duration) }}</span
            >
          </div>
          <div
            v-if="activeChunkIndex === segment.index"
            class="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg vwp-accent-bg"
          ></div>
        </div>
      </div>
    </div>

    <!-- Main Wall -->
    <div
      ref="wallRef"
      class="relative flex flex-1 flex-col overflow-hidden vwp-bg-main vwp-shadow vwp-border border ring-1 ring-white/5 vwp-radius group/wall"
    >
      <div
        ref="containerRef"
        class="flex flex-1 items-center justify-center overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/50 to-black mb-[64px]"
        :style="{ padding: `${videoWallPadding}px` }"
      >
        <div
          :style="gridStyle"
          class="mx-auto my-auto transition-all duration-500 ease-out"
        >
          <div
            v-for="item in localResources"
            :key="item.id"
            class="wall-tile relative overflow-hidden vwp-bg-tile vwp-border border transition-all duration-300 group vwp-radius"
            :class="[
              draggable ? 'cursor-grab active:cursor-grabbing' : '',
              draggingId === item.id
                ? 'opacity-50 scale-95 ring-2 ring-blue-500/50'
                : 'hover:shadow-lg',
              dragOverId === item.id
                ? 'ring-2 ring-blue-500 scale-[1.02] z-10'
                : '',
            ]"
            :style="itemStyle"
            :draggable="draggable"
            @dragstart="handleTileDragStart($event, item.id)"
            @dragover="handleTileDragOver($event, item.id)"
            @drop="handleTileDrop($event, item.id)"
            @dragend="handleTileDragEnd"
          >
            <!-- Media Element -->
            <audio
              v-if="isAudioChunk"
              :ref="(el) => setMediaRef(item.id, el as HTMLAudioElement)"
              :src="item.chunkUrls[activeChunkIndex] || ''"
              preload="metadata"
              @timeupdate="
                item.id === primaryId ? syncCurrentTimeFromPrimary() : undefined
              "
              @play="
                item.id === primaryId ? syncIsPlayingFromPrimary() : undefined
              "
              @pause="
                item.id === primaryId ? syncIsPlayingFromPrimary() : undefined
              "
              @ended="item.id === primaryId ? handlePrimaryEnded() : undefined"
            ></audio>
            <video
              v-else
              :ref="(el) => setMediaRef(item.id, el as HTMLVideoElement)"
              class="h-full w-full bg-transparent transition-transform duration-700"
              :style="{ objectFit: objectFit }"
              :src="item.chunkUrls[activeChunkIndex] || ''"
              :poster="item.poster"
              playsinline
              preload="metadata"
              @timeupdate="
                item.id === primaryId ? syncCurrentTimeFromPrimary() : undefined
              "
              @play="
                item.id === primaryId ? syncIsPlayingFromPrimary() : undefined
              "
              @pause="
                item.id === primaryId ? syncIsPlayingFromPrimary() : undefined
              "
              @ended="item.id === primaryId ? handlePrimaryEnded() : undefined"
            ></video>

            <!-- Audio Placeholder -->
            <div
              v-if="isAudioChunk"
              class="absolute inset-0 flex flex-col items-center justify-center gap-4 vwp-text-secondary pointer-events-none bg-gradient-to-b from-transparent to-black/20"
            >
              <div
                class="p-4 rounded-full bg-white/5 border vwp-border backdrop-blur-sm"
              >
                <AudioLines class="w-8 h-8 vwp-accent" />
              </div>
              <span
                class="text-xs font-mono tracking-widest uppercase opacity-60"
                >Audio Stream</span
              >
            </div>

            <!-- Meta Overlay -->
            <div
              v-if="showTileTitle"
              class="absolute left-0 top-0 right-0 p-3 transition-opacity duration-200 bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
              :class="
                fixedTileMeta
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              "
            >
              <div
                class="inline-flex items-center gap-2 px-2 py-1 rounded bg-black/40 border border-white/10 backdrop-blur-md"
              >
                <div
                  class="w-1.5 h-1.5 rounded-full"
                  :class="
                    isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                  "
                ></div>
                <span
                  class="text-[10px] font-medium tracking-wide text-gray-200"
                  >{{ item.name || item.id }}</span
                >
              </div>
            </div>

            <!-- Mute Button -->
            <div
              v-if="showTileMute"
              class="absolute bottom-3 right-3 z-30 cursor-pointer rounded-full bg-black/40 p-2 text-white/80 border border-white/5 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white hover:scale-110 active:scale-95"
              :class="
                fixedTileMeta
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              "
              @click.stop="toggleIndividualMute(item.id)"
            >
              <VolumeX
                v-if="individualMutedStates[item.id]"
                class="w-3.5 h-3.5"
              />
              <Volume2 v-else class="w-3.5 h-3.5" />
            </div>

            <!-- Loading/Empty State Placeholder -->
            <div
              v-if="!item.chunkUrls[activeChunkIndex]"
              class="absolute inset-0 flex items-center justify-center vwp-bg-main"
            >
              <div
                class="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div
        v-if="showControls"
        class="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto"
      >
        <PlayerControls
          :is-playing="isPlaying"
          :current-time="currentTime"
          :duration="duration"
          :playback-rates="PLAYBACK_RATE_LEVELS"
          :playback-rate="playbackRate"
          :volume="volume"
          :is-muted="isMuted"
          :show-stop="false"
          :tags="tags"
          :show-prev-next-chunk="showPrevNextChunk"
          :show-step-skip="showStepSkip"
          :show-playback-rate="showPlaybackRate"
          :show-speed-down="showSpeedControl"
          :show-speed-up="showSpeedControl"
          :step-seconds="stepSeconds"
          @speed-down="handleSpeedDown"
          @play-pause="handlePlayPause"
          @speed-up="handleSpeedUp"
          @seek="handleSeek"
          @rate-change="handleRateChange"
          @volume-toggle="handleVolumeToggle"
          @volume-change="handleVolumeChange"
          @fullscreen="toggleFullscreen"
          @step-back="handleStepBack"
          @step-forward="handleStepForward"
          @prev-chunk="handlePrevChunk"
          @next-chunk="handleNextChunk"
        />
      </div>
    </div>
  </div>
</template>

<style>
@import "../../styles/themes.css";
</style>
