import { computed, ref, unref, type Ref } from 'vue';
import { useResizeObserver } from '@vueuse/core';

export interface UseVideoWallOptions {
  aspectRatio?: number;
  gap?: number;
  width?: number;
  height?: number;
}

export function useVideoWallLayout(
  itemCountRes: Ref<number> | number,
  options: Ref<UseVideoWallOptions> | UseVideoWallOptions = {},
) {
  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  // Initialize width/height from options if provided (non-reactive initial value)
  const initialOptions = unref(options);
  if (initialOptions.width) containerWidth.value = initialOptions.width;
  if (initialOptions.height) containerHeight.value = initialOptions.height;

  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (entry) {
      const { width, height } = entry.contentRect;
      containerWidth.value = width;
      containerHeight.value = height;
    }
  });

  const layout = computed(() => {
    const n = unref(itemCountRes);
    const w = containerWidth.value;
    const h = containerHeight.value;
    
    // Unwrap options to get latest values
    const currentOptions = unref(options);
    const aspectRatio = currentOptions.aspectRatio ?? (16 / 9);
    const gap = currentOptions.gap ?? 0;

    if (n <= 0 || w <= 0 || h <= 0) {
      return { cols: 1, itemHeight: 0, itemWidth: 0, rows: 1 };
    }

    let bestW = 0;
    let bestH = 0;
    let bestCols = 1;
    let bestRows = 1;
    let bestScore = 0;

    // Iterate through possible column counts to find best layout
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      
      // Calculate available space for items after subtracting gaps
      // Gap logic: (cols - 1) gaps horizontally, (rows - 1) gaps vertically
      const totalGapW = Math.max(0, c - 1) * gap;
      const totalGapH = Math.max(0, r - 1) * gap;
      
      const availableW = w - totalGapW;
      const availableH = h - totalGapH;

      if (availableW <= 0 || availableH <= 0) continue;

      const slotW = availableW / c;
      const slotH = availableH / r;

      let itemW;
      let itemH;

      // Fit item into slot maintaining aspect ratio
      if (slotW / slotH > aspectRatio) {
        // Slot is wider than item, height is the constraint
        itemH = slotH;
        itemW = slotH * aspectRatio;
      } else {
        // Slot is taller than item, width is the constraint
        itemW = slotW;
        itemH = slotW / aspectRatio;
      }

      // Score based on total area occupied
      // Weight optimization: prefer layouts where cols >= rows (landscape-ish)
      const area = itemW * itemH * n;
      // const score = area * (c >= r ? 1.05 : 1); // Slight preference for wider layouts
      // Simply maximizing item width usually works well for visibility
      const score = itemW * (c >= r ? 1.1 : 1);

      if (score > bestScore) {
        bestScore = score;
        bestW = itemW;
        bestH = itemH;
        bestCols = c;
        bestRows = r;
      }
    }

    return {
      cols: bestCols,
      itemHeight: bestH,
      itemWidth: bestW,
      rows: bestRows,
    };
  });

  return {
    containerRef,
    layout,
  };
}
