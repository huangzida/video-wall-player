// Composition contract test for useVideoWall.
//
// Proves the Slice 1 composition glue: useVideoWall creates a pool, registers
// elements with useMediaSync, drives chunk-switching via onPrimaryEnded, and
// bridges LOCAL (per-chunk) useMediaSync state into GLOBAL (segment-summed)
// state. This is NOT media-behavior testing (deferred to manual per Q10) — it
// uses a minimal interface stub and drives seek/switchChunk/ended via direct
// method calls + fake.emit. The FakeMediaElement is duplicated from
// useMediaSync.contract.test.ts on purpose: keep the two test files independent
// (no shared fixtures) so either can run/evolve standalone.

import { describe, it, expect } from 'vitest';
import { useVideoWall } from './useVideoWall';

// Minimal HTMLMediaElement stub. Two test-only conveniences over a plain stub:
//  - load() emits 'canplay' so loadSingle's await resolves (production fires
//    this when enough data is buffered).
//  - currentTime setter emits 'seeked' so seekAllLocal's await resolves
//    (production <video> fires this async after a seek completes).
// These exist to advance the async coordination under test, NOT to model media
// timing — the assertions are on pool/registry/chunk-index wiring.
class FakeMediaElement {
  private _currentTime = 0;
  duration = NaN;
  volume = 1;
  muted = false;
  playbackRate = 1;
  paused = true;
  ended = false;
  readyState = 4; // HAVE_ENOUGH_DATA
  loop = false;
  src = '';
  // ponytail: Element-shaped stubs so destroy()'s pool teardown (removeAttribute
  // + parentNode.removeChild) runs without a real DOM. parentNode stays null so
  // the removeChild branch is skipped — fakes are never attached to a container.
  parentNode: ParentNode | null = null;
  removeAttribute(): void {}
  private listeners: Record<string, Array<(e: { type: string }) => void>> = {};

  get currentTime(): number {
    return this._currentTime;
  }
  set currentTime(v: number) {
    this._currentTime = v;
    this.emit('seeked');
  }

  addEventListener(
    type: string,
    fn: (e: { type: string }) => void,
  ): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(
    type: string,
    fn: (e: { type: string }) => void,
  ): void {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  emit(type: string): void {
    (this.listeners[type] || []).forEach((fn) => fn({ type }));
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {
    if (this.src) this.emit('canplay');
  }
}

const asMedia = (fake: FakeMediaElement) => fake as unknown as HTMLMediaElement;

// Flush the microtask/macrotask queue so fire-and-forget async chains
// (onPrimaryEnded -> switchChunk -> seekAllLocal -> play) settle before asserts.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

interface MakeWallResult {
  wall: ReturnType<typeof useVideoWall>;
  fakes: FakeMediaElement[];
}

// Build a wall whose pool is populated by FakeMediaElement instances (in
// registration order, so fakes[0] is always the primary = resources[0]).
function makeWall(
  opts: Parameters<typeof useVideoWall>[0],
): MakeWallResult {
  const fakes: FakeMediaElement[] = [];
  const wall = useVideoWall({
    ...opts,
    createElement: () => {
      const f = new FakeMediaElement();
      fakes.push(f);
      return asMedia(f);
    },
  });
  return { wall, fakes };
}

describe('useVideoWall — composition contract', () => {
  it('normalizes mixed shorthand resources, populates the pool, sets primary to first', async () => {
    const { wall } = makeWall({
      resources: [
        { id: 'a', name: 'A', src: 'a.mp4' }, // {src} shorthand
        { id: 'b', name: 'B', chunkUrls: ['b1.mp4', 'b2.mp4'] }, // {chunkUrls}
        {
          id: 'c',
          name: 'C',
          chunkUrls: ['c1.mp4'],
          durations: [10],
        }, // full form
      ],
    });
    await wall.loadAll();
    expect(wall.videoPool.size).toBe(3);
    expect(wall.primaryId.value).toBe('a');
    wall.destroy();
  });

  it('state.duration is segment-summed (global), not per-chunk', async () => {
    const { wall } = makeWall({
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp4'],
          durations: [10, 20],
        },
      ],
    });
    await wall.loadAll();
    expect(wall.state.value.duration).toBe(30); // sumDurations([10,20])
    wall.destroy();
  });

  it('seek(globalTime) locates the right chunk via locateByGlobalTime and swaps every element src', async () => {
    const { wall, fakes } = makeWall({
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp3'],
          durations: [10, 20],
        },
        {
          id: 'q',
          name: 'Q',
          chunkUrls: ['q1.mp4', 'q2.mp3'],
          durations: [10, 20],
        },
      ],
    });
    await wall.loadAll();
    // chunk 0 loaded initially
    expect(fakes[0].src).toBe('p1.mp4');

    // globalTime 15 -> chunk 1 (segment starts [0,10]), local 5
    await wall.seek(15);
    expect(wall.activeChunkIndex.value).toBe(1);
    expect(fakes[0].src).toBe('p2.mp3'); // primary swapped
    expect(fakes[1].src).toBe('q2.mp3'); // non-primary also swapped (sync)
    wall.destroy();
  });

  it('primary ended advances activeChunkIndex to the next chunk (onPrimaryEnded wired)', async () => {
    const { wall, fakes } = makeWall({
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp4', 'p3.mp4'],
          durations: [10, 10, 10],
        },
      ],
    });
    await wall.loadAll();
    expect(wall.activeChunkIndex.value).toBe(0);

    fakes[0].emit('ended'); // useMediaSync fires onPrimaryEnded -> handlePrimaryEnded
    await flush();
    expect(wall.activeChunkIndex.value).toBe(1);
    wall.destroy();
  });

  it('loops back to chunk 0 when primary ends on the last chunk with loop=true', async () => {
    const { wall, fakes } = makeWall({
      loop: true,
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp4'],
          durations: [10, 10],
        },
      ],
    });
    await wall.loadAll();
    expect(wall.activeChunkIndex.value).toBe(0);

    fakes[0].emit('ended'); // 0 -> 1
    await flush();
    expect(wall.activeChunkIndex.value).toBe(1);

    fakes[0].emit('ended'); // last chunk + loop -> wrap to 0
    await flush();
    expect(wall.activeChunkIndex.value).toBe(0);
    wall.destroy();
  });

  it('does NOT loop (stops on last chunk) when loop is false/default', async () => {
    const { wall, fakes } = makeWall({
      // loop omitted -> default false; must NOT be forwarded to useMediaSync
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp4'],
          durations: [10, 10],
        },
      ],
    });
    await wall.loadAll();
    fakes[0].emit('ended'); // 0 -> 1
    await flush();
    expect(wall.activeChunkIndex.value).toBe(1);

    fakes[0].emit('ended'); // last chunk, no loop -> stay at last, isPlaying false
    await flush();
    expect(wall.activeChunkIndex.value).toBe(1);
    expect(wall.state.value.isPlaying).toBe(false);
    wall.destroy();
  });

  it('state.currentTime bridges global = segmentStart + local', async () => {
    const { wall, fakes } = makeWall({
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['p1.mp4', 'p2.mp4'],
          durations: [10, 20],
        },
      ],
    });
    await wall.loadAll();
    // seek to global 15 -> chunk 1, local 5. global = 10 + 5 = 15.
    await wall.seek(15);
    expect(wall.state.value.currentTime).toBe(15);

    // simulate primary reaching local 7 via timeupdate -> global = 10 + 7 = 17
    fakes[0].currentTime = 7;
    fakes[0].emit('timeupdate');
    expect(wall.state.value.currentTime).toBe(17);
    wall.destroy();
  });

  it('destroy clears the pool and tears down useMediaSync (primary cleared, events unwired)', async () => {
    const { wall, fakes } = makeWall({
      resources: [
        { id: 'p', name: 'P', src: 'p.mp4' },
        { id: 'q', name: 'Q', src: 'q.mp4' },
      ],
    });
    await wall.loadAll();
    expect(wall.videoPool.size).toBe(2);

    wall.destroy();
    expect(wall.videoPool.size).toBe(0);
    expect(wall.primaryId.value).toBe(''); // sync.destroy cleared primary

    // events unwired: emitting after destroy has no observable effect (no throw).
    fakes[0].emit('timeupdate');
    expect(wall.state.value.currentTime).toBe(0);
  });

  it('delegates element volume/mute/rate intents to useMediaSync', async () => {
    const { wall, fakes } = makeWall({
      resources: [{ id: 'p', name: 'P', src: 'p.mp4' }],
    });
    await wall.loadAll();

    wall.setVolume('p', 25);
    expect(fakes[0].volume).toBeCloseTo(0.25, 2); // 0-100 -> 0-1

    wall.setRate(2);
    expect(fakes[0].playbackRate).toBe(2);

    wall.toggleMute('p');
    expect(fakes[0].muted).toBe(true);
    wall.destroy();
  });

  it('switchChunk to a same-URL chunk resets currentTime to 0 (audio-wall: one file, multi-segment)', async () => {
    // ponytail: 音频墙常单文件切多片段；切换必须从头播放，不能因 src-equality
    // 短路 + localTime=0 不 seek 而卡在旧位置。
    const { wall, fakes } = makeWall({
      resources: [
        {
          id: 'p',
          name: 'P',
          chunkUrls: ['same.mp3', 'same.mp3'],
          durations: [10, 10],
        },
      ],
    });
    await wall.loadAll();
    // 播放到中段
    fakes[0].currentTime = 5;

    await wall.switchChunk(1, 0, false);

    expect(wall.activeChunkIndex.value).toBe(1);
    expect(fakes[0].currentTime).toBe(0); // 必须归零，从片段2开头播放
    wall.destroy();
  });
});
