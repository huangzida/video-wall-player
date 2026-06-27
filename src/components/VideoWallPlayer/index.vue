<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted } from "vue";
import type { ComponentPublicInstance } from "vue";
import { useFullscreen, onKeyStroke } from "@vueuse/core";
import { AudioLines, Volume2, VolumeX, AlertCircle, RefreshCw, Maximize2 } from "lucide-vue-next";
import PlayerControls from "../PlayerControls/index.vue";
import SegmentNav from "../SegmentNav/index.vue";
import { useVideoWallState } from "../../core/useVideoWallState";
import { useMediaSync } from "../../core/useMediaSync";
import { useVideoWallLayout } from "../../hooks/useVideoWallLayout";
import { formatTime, PLAYBACK_RATE_LEVELS } from "../../utils";
import type { MediaResource, MediaResourceInput, TimelineTag, ControlSize } from "../../core/types";
import type { VideoWallTheme, VideoWallLayoutMode } from "./types";

defineOptions({ name: "VideoWallPlayer" });

const props = withDefaults(
  defineProps<{
    resources: MediaResourceInput[];
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    aspectRatio?: number;
    gap?: number;
    showControls?: boolean;
    objectFit?: "contain" | "cover" | "fill";
    theme?: VideoWallTheme;
    controlSize?: ControlSize;
    layoutMode?: VideoWallLayoutMode;
    draggable?: boolean;
    showTileTitle?: boolean;
    showTileMute?: boolean;
    showTileFullscreen?: boolean;
    showSidebar?: boolean;
    tags?: TimelineTag[];
    showPrevNextChunk?: boolean;
    showStepSkip?: boolean;
    showPlaybackRate?: boolean;
    showSpeedControl?: boolean;
    stepSeconds?: number;
    fixedTileMeta?: boolean;
    sidebarWidth?: number;
    videoWallPadding?: number;
    autoSkipOnStall?: boolean;
    skipStepMs?: number;
    maxSkipAttempts?: number;
    stallThresholdMs?: number;
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
    controlSize: "normal",
    layoutMode: "auto",
    draggable: true,
    showTileTitle: true,
    showTileMute: true,
    showTileFullscreen: true,
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
    autoSkipOnStall: true,
    skipStepMs: 100,
    maxSkipAttempts: 10,
    stallThresholdMs: 500,
  }
);

const emit = defineEmits<{
  error: [message: string];
  close: [];
}>();

// --- Wall state/math (shared with CanvasWallPlayer via useVideoWallState) ---
const wallState = useVideoWallState({
  resources: computed(() => props.resources as MediaResource[]),
  loop: props.loop,
});
const {
  primaryResource,
  segmentCount,
  activeChunkIndex,
  computeGlobalState,
  locateSeek,
  nextChunkOnEnded,
  setActiveChunk,
} = wallState;

// --- Element-level sync (template <video>/<audio> tiles register here) ---
const sync = useMediaSync({
  muted: props.muted,
  volume: 50,
  playbackRate: 1,
  skipStepMs: props.skipStepMs,
  stallThresholdMs: props.stallThresholdMs,
  maxSkipAttempts: props.maxSkipAttempts,
  autoSkipOnStall: props.autoSkipOnStall,
  onError: (msg) => emit("error", msg),
    onPrimaryEnded: () => {
      // 'ended' only fires on natural segment-end (user was playing). Continue.
      const next = nextChunkOnEnded();
      if (next !== null) void switchChunk(next, 0, true);
    },
});

// Local refs to the rendered media elements (for retry / direct access).
// sync ALSO holds them in its registry; this is a thin UI-side handle.
const mediaRefs = ref<Record<string, HTMLMediaElement>>({});

// GLOBAL state (segment-summed duration, global currentTime).
const state = computed(() => computeGlobalState(sync.state.value));
const playbackRate = computed(() => sync.state.value.playbackRate);
const volume = computed(() => sync.state.value.volume);
const isMuted = computed(() => sync.state.value.muted);

// Per-tile mute UI mirror (paired with sync.toggleMute so they stay aligned).
const individualMutedStates = ref<Record<string, boolean>>({});

// Local reorderable copy of normalized resources (for drag & drop).
const localResources = ref<MediaResource[]>([]);
watch(
  wallState.normalized,
  (nr) => {
    localResources.value = [...nr];
    if (props.muted) {
      nr.forEach((item) => {
        individualMutedStates.value[item.id] = true;
      });
    }
  },
  { immediate: true }
);

const itemCount = computed(() => localResources.value.length);
const canReorderWall = computed(() => itemCount.value > 1);

const wallRef = ref<HTMLElement>();
const focusedResourceId = ref("");
const draggingId = ref("");
const dragOverId = ref("");

const effectiveLayoutMode = computed(() => {
  if (focusedResourceId.value) return "1x1";
  return props.layoutMode;
});

const { containerRef, layout } = useVideoWallLayout(
  itemCount,
  computed(() => ({
    aspectRatio: props.aspectRatio,
    gap: props.gap,
    layoutMode: effectiveLayoutMode.value,
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
  gridAutoFlow: "dense",
}));

const { toggle: toggleFullscreen } = useFullscreen(wallRef);

// Segment list for the sidebar (derived from normalized primary).
const segmentList = computed(() => {
  const primary = primaryResource.value;
  if (!primary) return [];
  return primary.chunkUrls.map((url, index) => {
    const chunkNo = index + 1;
    const match = url.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
    const suffix = match ? `.${match[1]}` : "";
    return {
      index,
      name: `${chunkNo}${suffix}`,
      duration: Math.max(0, primary.durations[index] || 0),
    };
  });
});

const isAudioChunk = computed(() => {
  const primary = primaryResource.value;
  if (!primary) return false;
  const url = primary.chunkUrls[activeChunkIndex.value] || "";
  return url.toLowerCase().includes(".wav");
});

// --- Media element ref binding: register with sync + keep local handle ---
// ponytail: idempotent on same-el — `:ref="setMediaVNodeRef(item.id)"` recreates
// the callback every render (Vue function-ref footgun), so we MUST no-op when
// the bound element hasn't actually changed. Without this guard, every render
// would unregister (which pauses the element!) then re-register.
function setMediaRef(id: string, el: HTMLMediaElement | null) {
  if (mediaRefs.value[id] === el) return; // same element, no-op (render churn guard)
  if (!el) {
    delete mediaRefs.value[id];
    sync.unregister(id);
    return;
  }
  mediaRefs.value[id] = el;
  sync.register(id, el);
}

function setMediaVNodeRef(id: string) {
  return (el: Element | ComponentPublicInstance | null) => {
    if (el && el instanceof HTMLMediaElement) {
      setMediaRef(id, el);
    } else {
      setMediaRef(id, null);
    }
  };
}

// --- Declarative chunk switch (template re-binds :src via activeChunkIndex) ---
async function switchChunk(
  chunkIndex: number,
  localTime = 0,
  autoPlay = false
): Promise<void> {
  if (localResources.value.length === 0) return;
  const primary = primaryResource.value;
  if (!primary) return;

  // ponytail: pause before chunk swap to prevent async drift; template then
  // reactively re-binds :src on all tiles when activeChunkIndex changes.
  sync.pause();
  setActiveChunk(chunkIndex);
  await nextTick(); // wait for DOM to apply the new :src bindings

  const segDur = primary.durations[activeChunkIndex.value] || 0;
  const safeTime = Math.max(0, Math.min(localTime, Math.max(0, segDur - 0.05)));
  const targetTime = Number.isFinite(safeTime) ? safeTime : 0;

  // Delegate seek-coordination (pause-all -> seek each -> wait 'seeked' -> 3s timeout)
  // to useMediaSync. The elements' src just changed; setting currentTime queues a
  // seek after the new chunk loads, and 'seeked' fires when it completes.
  await sync.seekAllLocal(targetTime);

  if (autoPlay) {
    await sync.play();
  }
}

// --- Global seek ---
async function seek(globalTime: number): Promise<void> {
  if (!primaryResource.value) return;
  const { chunkIndex, localTime } = locateSeek(globalTime);
  await switchChunk(chunkIndex, localTime, state.value.isPlaying);
}

// --- PlayerControls handlers ---
const handlePlayPause = () =>
  state.value.isPlaying ? sync.pause() : void sync.play();

const handleRateChange = (rate: number) => sync.setRate(rate);

const handleSpeedDown = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx < PLAYBACK_RATE_LEVELS.length - 1)
    handleRateChange(PLAYBACK_RATE_LEVELS[idx + 1]!);
};

const handleSpeedUp = () => {
  const idx = PLAYBACK_RATE_LEVELS.indexOf(playbackRate.value);
  if (idx > 0) handleRateChange(PLAYBACK_RATE_LEVELS[idx - 1]!);
};

const handleSeek = (seconds: number) => {
  void seek(seconds);
};

const handleVolumeChange = (vol: number) => {
  sync.setVolumeAll(vol);
  sync.setMutedAll(false);
  // clear per-tile mute UI mirror
  Object.keys(individualMutedStates.value).forEach((id) => {
    individualMutedStates.value[id] = false;
  });
};

const handleVolumeToggle = () => {
  const next = !isMuted.value;
  sync.setMutedAll(next);
  Object.keys(individualMutedStates.value).forEach((id) => {
    individualMutedStates.value[id] = next;
  });
};

const toggleIndividualMute = (id: string) => {
  individualMutedStates.value[id] = !individualMutedStates.value[id];
  sync.toggleMute(id);
};

const handlePrevChunk = () => {
  if (activeChunkIndex.value > 0) {
    void switchChunk(activeChunkIndex.value - 1, 0, state.value.isPlaying);
  }
};

const handleNextChunk = () => {
  if (activeChunkIndex.value < segmentCount.value - 1) {
    void switchChunk(activeChunkIndex.value + 1, 0, state.value.isPlaying);
  }
};

const handleStepBack = (seconds: number) => {
  void seek(Math.max(0, state.value.currentTime - seconds));
};

const handleStepForward = (seconds: number) => {
  void seek(Math.min(state.value.duration, state.value.currentTime + seconds));
};

const handleSegmentClick = (index: number) => {
  // ponytail: respect current play state — don't auto-play when paused.
  void switchChunk(index, 0, state.value.isPlaying);
};

// --- Retry (error overlay button) ---
function handleRetry(id: string) {
  const media = mediaRefs.value[id];
  if (media) {
    media.load();
    if (state.value.isPlaying) media.play().catch(() => {});
  }
}

function handleSingleFullscreen(id: string) {
  const el = document.querySelector(`[data-tile-id="${id}"]`) as HTMLElement | null;
  if (!el || !el.requestFullscreen) return;
  if (document.fullscreenElement === el) {
    document.exitFullscreen().catch(() => {});
  } else {
    el.requestFullscreen().catch(() => {});
  }
}

const handleTileDoubleClick = (id: string) => {
  focusedResourceId.value = focusedResourceId.value === id ? "" : id;
};

// --- Drag and Drop ---
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
  if (!canReorderWall.value || !draggingId.value || draggingId.value === targetId) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  dragOverId.value = targetId;
}

function handleTileDrop(event: DragEvent, targetId: string) {
  if (!canReorderWall.value || !draggingId.value || draggingId.value === targetId) return;
  event.preventDefault();
  const sourceIndex = localResources.value.findIndex((item) => item.id === draggingId.value);
  const targetIndex = localResources.value.findIndex((item) => item.id === targetId);
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

// primary follows the display order's first tile (original behavior preserved)
watch(
  localResources,
  (next) => {
    const firstId = next[0]?.id;
    if (firstId && sync.primaryId.value !== firstId) sync.setPrimary(firstId);
  },
  { deep: true }
);

// --- Keyboard shortcuts ---
onKeyStroke([" ", "k", "K"], (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handlePlayPause();
});

onKeyStroke(["f", "F"], (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  toggleFullscreen();
});

onKeyStroke(["m", "M"], (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeToggle();
});

onKeyStroke("Escape", () => {
  if (focusedResourceId.value) {
    focusedResourceId.value = "";
  }
});

onKeyStroke("ArrowLeft", (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleStepBack(props.stepSeconds);
});

onKeyStroke("ArrowRight", (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleStepForward(props.stepSeconds);
});

onKeyStroke("ArrowUp", (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeChange(Math.min(100, volume.value + 10));
});

onKeyStroke("ArrowDown", (e) => {
  if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
  e.preventDefault();
  handleVolumeChange(Math.max(0, volume.value - 10));
});

onMounted(() => {
  if (props.autoplay && localResources.value.length > 0) {
    setTimeout(() => {
      void sync.play();
    }, 500);
  }
});

defineExpose({
  play: sync.play,
  pause: sync.pause,
  seek,
});
</script>

<template>
  <div class="video-wall-player" :class="[`theme-${theme}`]" style="width: 100%; height: 100%;">
    <div
      class="flex w-full h-full min-h-[500px] gap-4 text-gray-100 font-sans transition-colors duration-300 vwp-bg-main vwp-font"
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
          >{{ formatTime(state.duration) }}</span
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
        class="flex flex-1 items-center justify-center overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/50 to-black"
        :style="{ padding: `${videoWallPadding}px` }"
      >
        <div
          :style="gridStyle"
          class="mx-auto my-auto transition-all duration-500 ease-out"
        >
          <!-- Empty State -->
          <div
            v-if="localResources.length === 0"
            class="absolute inset-0 flex flex-col items-center justify-center text-gray-500"
          >
            <AlertCircle class="w-16 h-16 mb-4 opacity-20" />
            <span class="text-lg font-medium opacity-40 tracking-widest uppercase">No Signal</span>
          </div>

          <div
            v-for="(item, index) in localResources"
            :key="item.id"
            :data-tile-id="item.id"
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
            :style="layout.getItemStyle(index)"
            :draggable="draggable && !focusedResourceId"
            v-show="!focusedResourceId || item.id === focusedResourceId"
            @dragstart="handleTileDragStart($event, item.id)"
            @dragover="handleTileDragOver($event, item.id)"
            @drop="handleTileDrop($event, item.id)"
            @dragend="handleTileDragEnd"
            @dblclick="handleTileDoubleClick(item.id)"
          >
            <!-- Media Element (events wired centrally by useMediaSync via register) -->
            <audio
              v-if="isAudioChunk"
              :ref="setMediaVNodeRef(item.id)"
              :src="item.chunkUrls[activeChunkIndex] || ''"
              preload="metadata"
            ></audio>
            <video
              v-else
              :ref="setMediaVNodeRef(item.id)"
              class="h-full w-full bg-transparent transition-transform duration-700"
              :style="{ objectFit: objectFit }"
              :src="item.chunkUrls[activeChunkIndex] || ''"
              :poster="item.poster"
              playsinline
              preload="metadata"
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
              class="absolute left-0 top-0 right-0 p-3 transition-opacity duration-200 bg-gradient-to-b from-black/80 to-transparent pointer-events-none flex justify-between items-start"
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
                    state.isPlaying && !sync.elementStates[item.id]?.isBuffering && !sync.elementStates[item.id]?.isError ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                  "
                ></div>
                <span
                  class="text-[10px] font-medium tracking-wide text-gray-200"
                  >{{ item.name || item.id }}</span
                >
              </div>

              <!-- Single Fullscreen Button -->
              <div 
                v-if="showTileFullscreen"
                style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; box-sizing: border-box; line-height: 1;"
                class="pointer-events-auto rounded-md bg-black/40 text-white/70 hover:text-white hover:bg-white/10 transition-colors border border-white/5 backdrop-blur-md"
                title="Fullscreen this tile"
                @click.stop="handleSingleFullscreen(item.id)"
              >
                <Maximize2 class="w-3.5 h-3.5" />
              </div>
            </div>

            <!-- AutoSkip Loading Overlay -->
            <div
              v-if="sync.elementStates[item.id]?.isStalled && sync.elementStates[item.id]!.skipCount > 0"
              class="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm"
            >
              <div class="flex flex-col items-center gap-3">
                <div class="w-10 h-10 border-3 border-white/20 border-t-blue-500 rounded-full animate-spin"></div>
                <span class="text-xs text-gray-300 font-medium">
                  Recovering... ({{ sync.elementStates[item.id]!.skipCount }}/{{ maxSkipAttempts }})
                </span>
              </div>
            </div>

            <!-- Mute Button -->
            <div
              v-if="showTileMute"
              style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; box-sizing: border-box; line-height: 1;"
              class="absolute bottom-3 right-3 z-30 cursor-pointer rounded-md bg-black/40 text-white/80 border border-white/5 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white hover:scale-110 active:scale-95"
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

            <!-- Loading/Buffering State -->
            <div
              v-if="!item.chunkUrls[activeChunkIndex] || sync.elementStates[item.id]?.isBuffering"
              class="absolute inset-0 flex items-center justify-center vwp-bg-main bg-black/20 backdrop-blur-[1px] z-20 pointer-events-none"
            >
              <div
                class="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin"
              ></div>
            </div>

            <!-- Error State -->
            <div
              v-if="sync.elementStates[item.id]?.isError"
              class="absolute inset-0 flex flex-col items-center justify-center vwp-bg-main bg-black/80 z-30 gap-3"
            >
              <AlertCircle class="w-8 h-8 text-red-500" />
              <span class="text-xs text-gray-400">Video Load Failed</span>
              <button 
                class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/5"
                @click.stop="handleRetry(item.id)"
              >
                <RefreshCw class="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div
        v-if="showControls"
        class="relative z-50 pointer-events-auto"
      >
        <PlayerControls
          :is-playing="state.isPlaying"
          :current-time="state.currentTime"
          :duration="state.duration"
          :playback-rates="PLAYBACK_RATE_LEVELS"
          :playback-rate="playbackRate"
          :volume="volume"
          :muted="isMuted"
          :show-stop="false"
          :show-prev-next-chunk="showPrevNextChunk"
          :tags="tags"
          :show-step-skip="showStepSkip"
          :show-playback-rate="showPlaybackRate"
          :show-speed-down="showSpeedControl"
          :show-speed-up="showSpeedControl"
          :step-seconds="stepSeconds"
          :control-size="controlSize"
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
        >
          <template v-if="showPrevNextChunk" #leftAffix>
            <SegmentNav
              direction="prev"
              :disabled="activeChunkIndex <= 0"
              :control-size="controlSize"
              @activate="handlePrevChunk"
            />
          </template>
          <template v-if="showPrevNextChunk" #rightAffix>
            <SegmentNav
              direction="next"
              :disabled="activeChunkIndex >= segmentCount - 1"
              :control-size="controlSize"
              @activate="handleNextChunk"
            />
          </template>
        </PlayerControls>
      </div>
    </div>
  </div>
  </div>
</template>
