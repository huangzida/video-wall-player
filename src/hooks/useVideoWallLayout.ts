import { computed, ref, unref, type Ref } from 'vue';
import { useResizeObserver } from '@vueuse/core';

export interface UseVideoWallOptions {
  aspectRatio?: number;
  gap?: number;
}

export function useVideoWallLayout(
  itemCount: Ref<number> | number,
  options: Ref<UseVideoWallOptions> | UseVideoWallOptions = {},
) {
  const containerRef = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);

  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (entry) {
      width.value = entry.contentRect.width;
      height.value = entry.contentRect.height;
    }
  });

  const layout = computed(() => {
    const count = unref(itemCount);
    const containerW = width.value;
    const containerH = height.value;
    
    const opts = unref(options);
    const aspectRatio = opts.aspectRatio ?? (16 / 9);
    const gap = opts.gap ?? 0;

    if (count <= 0 || containerW <= 0 || containerH <= 0) {
      return { cols: 1, rows: 1, itemWidth: 0, itemHeight: 0 };
    }

    let bestLayout = { cols: 1, rows: 1, itemWidth: 0, itemHeight: 0, area: 0 };

    // Try different column counts from 1 to count
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      
      // Calculate available space removing gaps
      const totalGapX = Math.max(0, cols - 1) * gap;
      const totalGapY = Math.max(0, rows - 1) * gap;
      
      const availableW = containerW - totalGapX;
      const availableH = containerH - totalGapY;
      
      if (availableW <= 0 || availableH <= 0) continue;

      // Calculate max possible item dimensions based on grid slots
      const maxItemW = availableW / cols;
      const maxItemH = availableH / rows;

      // Fit item maintaining aspect ratio
      let itemW = maxItemW;
      let itemH = itemW / aspectRatio;

      if (itemH > maxItemH) {
        itemH = maxItemH;
        itemW = itemH * aspectRatio;
      }

      const area = itemW * itemH; // Maximize individual item size

      // Prefer layouts that are more square-ish or match aspect ratio better if areas are close
      // But primary goal is maximizing size
      if (area > bestLayout.area) {
        bestLayout = { cols, rows, itemWidth: itemW, itemHeight: itemH, area };
      }
    }

    return {
      cols: bestLayout.cols,
      rows: bestLayout.rows,
      itemWidth: bestLayout.itemWidth,
      itemHeight: bestLayout.itemHeight,
    };
  });

  return {
    containerRef,
    layout,
  };
}
