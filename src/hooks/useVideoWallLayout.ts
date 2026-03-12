import { computed, ref, unref } from 'vue';
import { useResizeObserver } from '@vueuse/core';

export interface UseVideoWallOptions {
  aspectRatio?: number;
  gap?: number;
  width?: number;
  height?: number;
}

export function useVideoWallLayout(
  itemCountRes: any,
  options: UseVideoWallOptions = {},
) {
  const { aspectRatio = 16 / 9, gap = 0 } = options;

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(options.width || 0);
  const containerHeight = ref(options.height || 0);

  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (entry) {
      const { height, width } = entry.contentRect;
      containerWidth.value = width;
      containerHeight.value = height;
    }
  });

  const layout = computed(() => {
    const n = unref(itemCountRes);
    const w = containerWidth.value;
    const h = containerHeight.value;

    if (n <= 0 || w <= 0 || h <= 0) {
      return { cols: 1, itemHeight: 0, itemWidth: 0, rows: 1 };
    }

    let bestW = 0;
    let bestH = 0;
    let bestCols = 1;
    let bestRows = 1;
    let bestScore = 0;

    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const availableW = w - (c - 1) * gap; // Use c-1 for gaps between items
      const availableH = h - (r - 1) * gap;

      if (availableW <= 0 || availableH <= 0) continue;

      const slotW = availableW / c;
      const slotH = availableH / r;

      let itemW;
      let itemH;

      if (slotW / slotH > aspectRatio) {
        itemH = slotH;
        itemW = slotH * aspectRatio;
      } else {
        itemW = slotW;
        itemH = slotW / aspectRatio;
      }

      // 权重优化：优先考虑列数 >= 行数的布局
      const score = itemW * (c >= r ? 1.5 : 1);

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
