import { describe, expect, it } from 'vitest';
import { countdowns, nextChange } from './analysis';
import { fmtCountdown } from './format';
import type { Evaluation } from './types';

const ev = (sun: number[], earth: number[]): Evaluation => {
  const n = sun.length;
  return { sunUp: Uint8Array.from(sun), earthUp: Uint8Array.from(earth), state: Uint8Array.from(sun.map((s, i) => s + 2 * earth[i])), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: new Float32Array(n) };
};

describe('countdowns', () => {
  it('counts hours to the next change', () => {
    expect(nextChange(Uint8Array.from([1, 1, 1, 0, 0]), 0, 1)).toEqual({ up: true, hours: 3 });
    expect(nextChange(Uint8Array.from([0, 0, 1]), 0, 2)).toEqual({ up: false, hours: 4 });
  });
  it('gives null when nothing changes before the end of the period', () => {
    expect(nextChange(Uint8Array.from([0, 0, 0]), 1, 1)).toEqual({ up: false, hours: null });
    expect(nextChange(Uint8Array.from([1, 0]), 1, 1)).toEqual({ up: false, hours: null });
  });
  it('reports Sun and Earth together, and a far-side site where Earth never rises', () => {
    const c = countdowns(ev([1, 1, 0, 0], [0, 0, 0, 0]), { t0Ms: 0, stepMin: 60, n: 4 }, 0);
    expect(c.sun).toEqual({ up: true, hours: 2 });
    expect(c.earth).toEqual({ up: false, hours: null });
  });
});

describe('fmtCountdown', () => {
  it('words the next event', () => {
    expect(fmtCountdown({ up: true, hours: 5 + 20 / 60 }, 'Sun')).toEqual({ label: 'Sunset in', value: '5 h 20 m' });
    expect(fmtCountdown({ up: false, hours: 3 }, 'Earth')).toEqual({ label: 'Earthrise in', value: '3 h 0 m' });
    expect(fmtCountdown({ up: true, hours: 76.8 }, 'Earth')).toEqual({ label: 'Earthset in', value: '3.2 d' });
  });
  it('says when the event does not happen in this period', () => {
    expect(fmtCountdown({ up: false, hours: null }, 'Earth')).toEqual({ label: 'No Earthrise this period', value: '—' });
    expect(fmtCountdown({ up: true, hours: null }, 'Sun')).toEqual({ label: 'Sun up all period', value: '—' });
  });
});
