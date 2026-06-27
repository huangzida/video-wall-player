<script setup lang="ts">
// SegmentNav — wall-specific chunk navigation button (ADR-0001 Q5).
//
// Extracted from PlayerControls so PlayerControls stays a generic media control
// bar with no wall semantics in its type signature. VideoWallPlayer / CanvasWallPlayer
// fill PlayerControls' `#leftAffix` / `#rightAffix` slots with this component.
//
// Visual classes mirror PlayerControls' chunk buttons exactly so the rendered
// wall control bar is identical before/after the switch-over.

import { computed } from 'vue';
import { ChevronsLeft, ChevronsRight } from 'lucide-vue-next';
import type { ControlSize } from '../../core/types';

interface Props {
  direction: 'prev' | 'next';
  disabled?: boolean;
  controlSize?: ControlSize;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  controlSize: 'normal',
  title: '',
});

const emit = defineEmits<{ activate: [] }>();

const sizeClasses = computed(() => {
  switch (props.controlSize) {
    case 'small':
      return { button: 'p-1.5', icon: 'w-4 h-4' };
    case 'large':
      return { button: 'p-2.5', icon: 'w-6 h-6' };
    case 'normal':
    default:
      return { button: 'p-2', icon: 'w-5 h-5' };
  }
});

const resolvedTitle = computed(
  () => props.title || (props.direction === 'prev' ? 'Previous Chunk' : 'Next Chunk'),
);

function handleClick() {
  if (props.disabled) return;
  emit('activate');
}
</script>

<template>
  <div
    class="flex items-center justify-center rounded-full transition-all active:scale-90 vwp-text-secondary"
    :class="[
      sizeClasses.button,
      disabled
        ? 'opacity-30 cursor-not-allowed'
        : 'cursor-pointer hover:bg-[var(--vwp-hover)] hover:text-[var(--vwp-text-primary)]',
    ]"
    :title="resolvedTitle"
    @click="handleClick"
  >
    <ChevronsLeft v-if="direction === 'prev'" :class="sizeClasses.icon" />
    <ChevronsRight v-else :class="sizeClasses.icon" />
  </div>
</template>
