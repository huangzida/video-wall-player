import { computed, ref, unref, type Ref } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import type { VideoWallLayoutMode } from '../components/VideoWallPlayer/types';

export interface UseVideoWallOptions {
  aspectRatio?: number;
  gap?: number;
  layoutMode?: VideoWallLayoutMode;
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
    const mode = opts.layoutMode ?? 'auto';

    if (count <= 0 || containerW <= 0 || containerH <= 0) {
      return { cols: 1, rows: 1, itemWidth: 0, itemHeight: 0, getItemStyle: () => ({}) };
    }

    let cols = 1;
    let rows = 1;
    let itemWidth = 0;
    let itemHeight = 0;
    let specialLayout = false;

    // Handle fixed grid modes
    if (mode === '1x1') { cols = 1; rows = 1; }
    else if (mode === '2x2') { cols = 2; rows = 2; }
    else if (mode === '3x3') { cols = 3; rows = 3; }
    else if (mode === '4x4') { cols = 4; rows = 4; }
    // Handle focus modes
    else if (mode === '1+5') { cols = 3; rows = 3; specialLayout = true; }
    else if (mode === '1+7') { cols = 4; rows = 4; specialLayout = true; }
    // Handle auto mode
    else {
      let bestLayout = { cols: 1, rows: 1, itemWidth: 0, itemHeight: 0, area: 0 };
      for (let c = 1; c <= count; c++) {
        const r = Math.ceil(count / c);
        const totalGapX = Math.max(0, c - 1) * gap;
        const totalGapY = Math.max(0, r - 1) * gap;
        const availableW = containerW - totalGapX;
        const availableH = containerH - totalGapY;
        if (availableW <= 0 || availableH <= 0) continue;
        const maxItemW = availableW / c;
        const maxItemH = availableH / r;
        let itemW = maxItemW;
        let itemH = itemW / aspectRatio;
        if (itemH > maxItemH) {
          itemH = maxItemH;
          itemW = itemH * aspectRatio;
        }
        const area = itemW * itemH;
        if (area > bestLayout.area) {
          bestLayout = { cols: c, rows: r, itemWidth: itemW, itemHeight: itemH, area };
        }
      }
      cols = bestLayout.cols;
      rows = bestLayout.rows;
      itemWidth = bestLayout.itemWidth;
      itemHeight = bestLayout.itemHeight;
    }

    // Recalculate item dimensions for fixed/special modes
    if (mode !== 'auto') {
      const totalGapX = Math.max(0, cols - 1) * gap;
      const totalGapY = Math.max(0, rows - 1) * gap;
      const availableW = containerW - totalGapX;
      const availableH = containerH - totalGapY;
      
      const maxItemW = availableW / cols;
      const maxItemH = availableH / rows;
      
      itemWidth = maxItemW;
      itemHeight = itemWidth / aspectRatio;
      
      if (itemHeight > maxItemH) {
        itemHeight = maxItemH;
        itemWidth = itemHeight * aspectRatio;
      }
    }

    // Helper to generate style for each item
    const getItemStyle = (index: number) => {
      const baseStyle = {
        width: '100%',
        height: '100%',
      };

      if (specialLayout) {
        // 1+5 Mode: First item takes 2x2 in a 3x3 grid
        if (mode === '1+5') {
          if (index === 0) {
            return {
              ...baseStyle,
              gridColumn: '1 / span 2',
              gridRow: '1 / span 2',
            };
          }
          // Remaining 5 items fill the rest:
          // 3x3 grid indices (0-based):
          // [0,0] [0,1] [0,2]
          // [1,0] [1,1] [1,2]
          // [2,0] [2,1] [2,2]
          // Main takes [0,0]-[1,1].
          // Remaining slots: [0,2], [1,2], [2,0], [2,1], [2,2]
          // We don't need to manually specify positions if we use dense packing or correct DOM order,
          // BUT Grid auto-placement can be tricky with spanning items.
          // Simpler approach: Grid Auto Flow Dense handles it if we just define the big one.
          // Let's rely on CSS Grid auto-placement which usually puts subsequent items in next available slots.
        }
        
        // 1+7 Mode: First item takes 3x3 in a 4x4 grid
        if (mode === '1+7') {
          if (index === 0) {
            return {
              ...baseStyle,
              gridColumn: '1 / span 3',
              gridRow: '1 / span 3',
            };
          }
        }
      }

      return baseStyle;
    };

    return {
      cols,
      rows,
      itemWidth,
      itemHeight,
      getItemStyle,
    };
  });

  return {
    containerRef,
    layout,
  };
}
