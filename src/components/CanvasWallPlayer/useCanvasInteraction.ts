import { ref, type Ref } from 'vue';

export interface CanvasInteractionState {
  focusedId: Ref<string | null>;
  handlePointerDown: (x: number, y: number) => void;
}

interface UseCanvasInteractionOptions {
  enableFocus: Ref<boolean>;
  onFocus: (id: string | null) => void;
  // Returns the sprite id at given canvas coordinates, or null
  hitTest: (x: number, y: number) => string | null;
}

const DOUBLE_TAP_MS = 300;

export function useCanvasInteraction(
  options: UseCanvasInteractionOptions
): CanvasInteractionState {
  const { enableFocus, onFocus, hitTest } = options;
  const focusedId = ref<string | null>(null);
  let lastTapTime = 0;
  let lastTapId: string | null = null;

  function handlePointerDown(x: number, y: number) {
    if (!enableFocus.value) return;

    const now = Date.now();
    const hitId = hitTest(x, y);

    if (hitId && now - lastTapTime < DOUBLE_TAP_MS && hitId === lastTapId) {
      // Double tap → toggle focus
      if (focusedId.value === hitId) {
        focusedId.value = null;
        onFocus(null);
      } else {
        focusedId.value = hitId;
        onFocus(hitId);
      }
      lastTapTime = 0;
      lastTapId = null;
    } else {
      lastTapTime = now;
      lastTapId = hitId;
    }
  }

  return {
    focusedId,
    handlePointerDown,
  };
}
