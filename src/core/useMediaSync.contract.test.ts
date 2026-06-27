// Composition contract test for useMediaSync.
//
// Proves the Q3 risk is resolved: useMediaSync's registry + onPrimaryEnded +
// primary-promotion API can be driven the way useVideoWall will drive it.
// This is NOT media-behavior testing (deferred to manual per Q10) — it exercises
// the composition glue with a minimal interface stub that records calls and
// stores listeners. seekAllLocal's internal coordination is preserved verbatim
// from 0.0.12 and covered by code review, not re-tested here.

import { describe, it, expect } from 'vitest';
import { useMediaSync } from './useMediaSync';

// Minimal HTMLMediaElement stub: stores listeners, records calls, no real media
// behavior. Cast at the register boundary to satisfy the HTMLMediaElement type.
class FakeMediaElement {
  currentTime = 0;
  duration = NaN;
  volume = 1;
  muted = false;
  playbackRate = 1;
  paused = true;
  ended = false;
  readyState = 4; // HAVE_ENOUGH_DATA
  loop = false;
  src = '';
  private listeners: Record<string, Array<(e: { type: string; target: unknown }) => void>> = {};

  addEventListener(type: string, fn: (e: { type: string; target: unknown }) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: (e: { type: string; target: unknown }) => void): void {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  // Test helper: fire a synthetic event to all registered listeners of `type`.
  emit(type: string): void {
    (this.listeners[type] || []).forEach((fn) => fn({ type, target: this }));
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
}

const asMedia = (fake: FakeMediaElement) => fake as unknown as HTMLMediaElement;

describe('useMediaSync — composition contract', () => {
  it('auto-promotes the first registered element to primary', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    sync.register('a', asMedia(a));
    expect(sync.primaryId.value).toBe('a');
    expect(sync.getPrimaryElement()).toBe(asMedia(a));
    sync.destroy();
  });

  it('tracks multiple registered elements and switches primary via setPrimary', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    const b = new FakeMediaElement();
    sync.register('a', asMedia(a));
    sync.register('b', asMedia(b));
    expect(sync.primaryId.value).toBe('a'); // first stays primary

    sync.setPrimary('b');
    expect(sync.primaryId.value).toBe('b');

    // setPrimary on unknown id is a no-op (ponytail: ignore unknown id)
    sync.setPrimary('nonexistent');
    expect(sync.primaryId.value).toBe('b');
    sync.destroy();
  });

  it('onPrimaryEnded fires only for the primary element, not for others', () => {
    let endedId = '';
    const sync = useMediaSync({
      onPrimaryEnded: (id) => {
        endedId = id;
      },
    });
    const a = new FakeMediaElement();
    const b = new FakeMediaElement();
    sync.register('a', asMedia(a));
    sync.register('b', asMedia(b));

    // Non-primary ending: ignored.
    b.emit('ended');
    expect(endedId).toBe('');

    // Primary ending: hook fires.
    a.emit('ended');
    expect(endedId).toBe('a');
    expect(sync.state.value.isPlaying).toBe(false);
    sync.destroy();
  });

  it('unregister promotes the next surviving element to primary', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    const b = new FakeMediaElement();
    sync.register('a', asMedia(a));
    sync.register('b', asMedia(b));

    sync.unregister('a');
    expect(sync.primaryId.value).toBe('b'); // insertion-order promotion
    expect(a.paused).toBe(true); // unregistered element is paused

    // Unregistering the last element clears primary.
    sync.unregister('b');
    expect(sync.primaryId.value).toBe('');
    expect(sync.state.value.isPlaying).toBe(false);
    sync.destroy();
  });

  it('exposes a PlayerState-shaped state object', () => {
    const sync = useMediaSync({ volume: 60, muted: true, playbackRate: 1.5 });
    const a = new FakeMediaElement();
    sync.register('a', asMedia(a));

    const s = sync.state.value;
    expect(s).toMatchObject({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 60,
      muted: true,
      playbackRate: 1.5,
    });
    // Options flowed through to the element (volume 0-100 → 0-1, muted).
    expect(a.volume).toBeCloseTo(0.6, 2);
    expect(a.muted).toBe(true);
    expect(a.playbackRate).toBe(1.5);
    sync.destroy();
  });

  it('standalone single-element use via initialElements works (the PlayerControls path)', () => {
    const a = new FakeMediaElement();
    const sync = useMediaSync({ initialElements: [{ id: 'main', el: asMedia(a) }] });

    // The exact shape the ADR documents for standalone PlayerControls wiring:
    expect(sync.primaryId.value).toBe('main');
    expect(sync.state.value).toMatchObject({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 50,
      muted: false,
      playbackRate: 1,
    });
    sync.destroy();
  });

  it('applies settings to all registered elements via applySettings', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    const b = new FakeMediaElement();
    sync.register('a', asMedia(a));
    sync.register('b', asMedia(b));

    sync.setVolumeAll(30);
    expect(a.volume).toBeCloseTo(0.3, 2);
    expect(b.volume).toBeCloseTo(0.3, 2);

    sync.setRate(2);
    expect(a.playbackRate).toBe(2);
    expect(b.playbackRate).toBe(2);

    sync.setMutedAll(true);
    expect(a.muted).toBe(true);
    expect(b.muted).toBe(true);
    sync.destroy();
  });

  it('per-element volume override beats aggregate (setVolume)', () => {
    const sync = useMediaSync({ volume: 50 });
    const a = new FakeMediaElement();
    sync.register('a', asMedia(a));

    sync.setVolume('a', 80); // per-id override
    expect(a.volume).toBeCloseTo(0.8, 2);

    // Re-applying aggregate settings preserves the per-id override.
    sync.setMutedAll(false); // triggers applySettings internally
    expect(a.volume).toBeCloseTo(0.8, 2);
    sync.destroy();
  });

  it('toggleMute flips only the targeted element', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    const b = new FakeMediaElement();
    sync.register('a', asMedia(a));
    sync.register('b', asMedia(b));

    sync.toggleMute('a');
    expect(a.muted).toBe(true);
    expect(b.muted).toBe(false);

    sync.toggleMute('a');
    expect(a.muted).toBe(false);
    sync.destroy();
  });

  it('destroy unwires events (no further primary updates) and pauses elements', () => {
    const sync = useMediaSync();
    const a = new FakeMediaElement();
    sync.register('a', asMedia(a));
    a.paused = false; // simulate playing

    sync.destroy();
    expect(a.paused).toBe(true); // paused on destroy
    expect(sync.primaryId.value).toBe('');

    // Emitting after destroy has no observable effect on state.
    a.emit('timeupdate');
    expect(sync.state.value.currentTime).toBe(0);
  });
});
