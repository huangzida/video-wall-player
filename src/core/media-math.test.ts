import { describe, it, expect } from 'vitest';
import {
  getSegmentStarts,
  sumDurations,
  locateByGlobalTime,
  clampDuration,
  normalizeResource,
} from './media-math';

// ----- getSegmentStarts -----
describe('getSegmentStarts', () => {
  it('accumulates starts as [0, d0, d0+d1, ...]', () => {
    expect(getSegmentStarts([10, 20, 5])).toEqual([0, 10, 30]);
  });

  it('returns [] for empty input', () => {
    expect(getSegmentStarts([])).toEqual([]);
  });

  it('single element yields [0]', () => {
    expect(getSegmentStarts([42])).toEqual([0]);
  });

  it('treats 0 values as 0', () => {
    expect(getSegmentStarts([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('treats negative values as 0 (Math.max)', () => {
    expect(getSegmentStarts([-5, 10, -3])).toEqual([0, 0, 10]);
  });
});

// ----- sumDurations -----
describe('sumDurations', () => {
  it('sums positive durations', () => {
    expect(sumDurations([10, 20, 5])).toBe(35);
  });

  it('returns 0 for empty input', () => {
    expect(sumDurations([])).toBe(0);
  });

  it('clamps negatives to 0', () => {
    expect(sumDurations([-5, 10, -3])).toBe(10);
  });
});

// ----- locateByGlobalTime -----
describe('locateByGlobalTime', () => {
  it('single segment: target within maps to chunk 0', () => {
    expect(locateByGlobalTime(5, [10])).toEqual({ chunkIndex: 0, localTime: 5 });
  });

  it('multi-segment: lands in correct chunk', () => {
    // segments: [0,10), [10,30), [30,35)
    expect(locateByGlobalTime(0, [10, 20, 5])).toEqual({ chunkIndex: 0, localTime: 0 });
    expect(locateByGlobalTime(10, [10, 20, 5])).toEqual({ chunkIndex: 1, localTime: 0 });
    expect(locateByGlobalTime(25, [10, 20, 5])).toEqual({ chunkIndex: 1, localTime: 15 });
    expect(locateByGlobalTime(30, [10, 20, 5])).toEqual({ chunkIndex: 2, localTime: 0 });
  });

  it('target=0 lands on first segment start', () => {
    expect(locateByGlobalTime(0, [10, 20])).toEqual({ chunkIndex: 0, localTime: 0 });
  });

  it('target exactly on a segment boundary prefers the next segment', () => {
    // boundary at 10 -> safeTarget(10) < end(10) is false for seg0, falls to seg1
    expect(locateByGlobalTime(10, [10, 20])).toEqual({ chunkIndex: 1, localTime: 0 });
  });

  it('target exceeding total duration clamps to last segment end', () => {
    expect(locateByGlobalTime(999, [10, 20, 5])).toEqual({
      chunkIndex: 2,
      localTime: 5,
    });
  });

  it('negative target clamps to 0 on first segment', () => {
    expect(locateByGlobalTime(-50, [10, 20])).toEqual({
      chunkIndex: 0,
      localTime: 0,
    });
  });

  it('empty durations returns { chunkIndex: 0, localTime: 0 }', () => {
    expect(locateByGlobalTime(100, [])).toEqual({ chunkIndex: 0, localTime: 0 });
  });
});

// ----- clampDuration -----
describe('clampDuration', () => {
  it('passes through values within range', () => {
    expect(clampDuration(5, 100)).toBe(5);
  });

  it('clamps values exceeding segDur to segDur - 0.05', () => {
    expect(clampDuration(150, 100)).toBe(99.95);
  });

  it('clamps negative values to 0', () => {
    expect(clampDuration(-5, 100)).toBe(0);
  });

  it('segDur=0 returns 0 (max(0, -0.05) = 0)', () => {
    expect(clampDuration(10, 0)).toBe(0);
  });

  it('NaN localTime returns 0', () => {
    expect(clampDuration(NaN, 100)).toBe(0);
  });

  it('Infinity localTime returns 0', () => {
    expect(clampDuration(Infinity, 100)).toBe(0);
  });
});

// ----- normalizeResource -----
describe('normalizeResource', () => {
  describe('string input', () => {
    it('wraps a bare string into a single-chunk resource with generated id', () => {
      const r = normalizeResource('https://x/a.mp4');
      expect(r.id).toBeTruthy();
      expect(typeof r.id).toBe('string');
      expect(r.name).toBe('');
      expect(r.chunkUrls).toEqual(['https://x/a.mp4']);
      expect(r.durations).toEqual([0]);
      expect(r.poster).toBeUndefined();
    });

    it('generates distinct ids for distinct strings', () => {
      const a = normalizeResource('a.mp4');
      const b = normalizeResource('b.mp4');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('{ src } shorthand', () => {
    it('expands src into a single-chunk resource', () => {
      const r = normalizeResource({ id: 'r1', name: 'vid', src: 'a.mp4' });
      expect(r).toEqual({
        id: 'r1',
        name: 'vid',
        chunkUrls: ['a.mp4'],
        durations: [0],
      });
    });

    it('passes poster through', () => {
      const r = normalizeResource({
        id: 'r1',
        name: 'vid',
        src: 'a.mp4',
        poster: 'p.jpg',
      });
      expect(r.poster).toBe('p.jpg');
    });
  });

  describe('{ chunkUrls } (no durations)', () => {
    it('fills durations with 0 aligned to chunkUrls', () => {
      const r = normalizeResource({
        id: 'r2',
        name: 'multi',
        chunkUrls: ['a.mp4', 'b.mp4', 'c.mp4'],
      });
      expect(r.chunkUrls).toEqual(['a.mp4', 'b.mp4', 'c.mp4']);
      expect(r.durations).toEqual([0, 0, 0]);
    });

    it('single chunk works', () => {
      const r = normalizeResource({ id: 'r3', name: 's', chunkUrls: ['a.mp4'] });
      expect(r.chunkUrls).toEqual(['a.mp4']);
      expect(r.durations).toEqual([0]);
    });

    it('passes poster through', () => {
      const r = normalizeResource({
        id: 'r3',
        name: 's',
        chunkUrls: ['a.mp4'],
        poster: 'p.jpg',
      });
      expect(r.poster).toBe('p.jpg');
    });
  });

  describe('{ chunkUrls, durations } full', () => {
    it('passes through aligned arrays unchanged', () => {
      const r = normalizeResource({
        id: 'r4',
        name: 'full',
        chunkUrls: ['a.mp4', 'b.mp4'],
        durations: [10, 20],
      });
      expect(r.chunkUrls).toEqual(['a.mp4', 'b.mp4']);
      expect(r.durations).toEqual([10, 20]);
    });

    it('clamps negative durations to 0', () => {
      const r = normalizeResource({
        id: 'r4',
        name: 'full',
        chunkUrls: ['a.mp4', 'b.mp4'],
        durations: [-5, 20],
      });
      expect(r.durations).toEqual([0, 20]);
    });

    it('truncates durations longer than chunkUrls', () => {
      const r = normalizeResource({
        id: 'r4',
        name: 'full',
        chunkUrls: ['a.mp4'],
        durations: [10, 20, 30],
      });
      expect(r.durations).toEqual([10]);
      expect(r.durations.length).toBe(r.chunkUrls.length);
    });

    it('pads durations shorter than chunkUrls with 0', () => {
      const r = normalizeResource({
        id: 'r4',
        name: 'full',
        chunkUrls: ['a.mp4', 'b.mp4', 'c.mp4'],
        durations: [10],
      });
      expect(r.durations).toEqual([10, 0, 0]);
    });

    it('passes poster through', () => {
      const r = normalizeResource({
        id: 'r4',
        name: 'full',
        chunkUrls: ['a.mp4'],
        durations: [10],
        poster: 'p.jpg',
      });
      expect(r.poster).toBe('p.jpg');
    });
  });

  describe('validation', () => {
    it('throws when chunkUrls is empty', () => {
      expect(() =>
        normalizeResource({ id: 'r5', name: 'bad', chunkUrls: [] }),
      ).toThrowError(/chunkUrls must have >= 1 entry/);
    });
  });
});
