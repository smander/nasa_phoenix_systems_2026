import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './analysis';
import { SLIP_DAYS, bearing8, distanceKm, firstBreak, monthlyStats, rankAlternatives, slipTable, summarize } from './scenario';
import type { SiteDef } from './types';
import type { Evaluation, TimeGrid } from './types';

export const fakeEval = (sun: number[], earth: number[], power = 400): Evaluation => {
  const n = sun.length;
  return { sunUp: Uint8Array.from(sun), earthUp: Uint8Array.from(earth), state: Uint8Array.from(sun.map((s, i) => s + 2 * earth[i])), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: Float32Array.from(sun.map((s) => s * power)) };
};
const grid = (n: number): TimeGrid => ({ t0Ms: Date.UTC(2027, 0, 1), stepMin: 60, n });
const S = { ...DEFAULT_SETTINGS, stayDays: 0.5 }; // 12-hour stays keep the fakes short

describe('summarize', () => {
  it('reports sunlight, contact and power over the stay only', () => {
    const sun = Array(30).fill(1), earth = Array(30).fill(0).map((_, i) => (i % 2 ? 1 : 0));
    const r = summarize(fakeEval(sun, earth), grid(30), 2, S);
    expect(r.inRange).toBe(true);
    expect(r.sunPct).toBe(100);
    expect(r.contactPct).toBe(50);
    expect(r.firstSunsetH).toBeNull();
    expect(r.meanPowerW).toBe(400);
    expect(r.rules).toBe(5);
    expect(r.endMs - r.startMs).toBe(12 * 3600e3);
  });
  it('finds the longest dark spell and the first sunset after landing', () => {
    const sun = Array(30).fill(1); sun[6] = sun[7] = sun[8] = 0;
    const r = summarize(fakeEval(sun, Array(30).fill(1)), grid(30), 2, S);
    expect(r.longestDarkH).toBe(3);
    expect(r.firstSunsetH).toBe(4);
    expect(r.firstEarthsetH).toBeNull();
  });
  it('flags a start too close to the end of the period', () => {
    const r = summarize(fakeEval(Array(20).fill(1), Array(20).fill(1)), grid(20), 15, S);
    expect(r.inRange).toBe(false);
  });
});

describe('slipTable', () => {
  const day = 24, n = day * 40;
  const g = grid(n), S2 = { ...DEFAULT_SETTINGS, stayDays: 2 };
  // sunlit except a 30-hour dark spell starting on day 12
  const sun = Array(n).fill(1); for (let i = 12 * day; i < 12 * day + 30; i++) sun[i] = 0;
  const ev = fakeEval(sun, Array(n).fill(1));
  const rows = slipTable(ev, g, 8 * day, S2);
  it('has one row per slip, the on-time row equal to summarize', () => {
    expect(rows.map((r) => r.days)).toEqual(SLIP_DAYS);
    expect(rows.find((r) => r.days === 0)!.summary).toEqual(summarize(ev, g, 8 * day, S2));
  });
  it('moves the landing by whole days', () => {
    expect(rows.find((r) => r.days === 1)!.start).toBe(9 * day);
    expect(rows.find((r) => r.days === -3)!.start).toBe(5 * day);
  });
  it('marks slips beyond the period instead of inventing a verdict', () => {
    expect(slipTable(ev, g, 20 * day, S2).find((r) => r.days === 28)!.summary).toBeNull(); // day 48 is past the 40-day period
    expect(slipTable(ev, g, 1 * day, S2).find((r) => r.days === -3)!.summary).toBeNull();
  });
  it('names the first slip that breaks a rule and why', () => {
    const b = firstBreak(rows);
    expect(b?.days).toBe(3);
    expect(b?.why).toBe('adds a 24-hour dark spell'); // only the first 24 of the 30 dark hours fall before lift-off
  });
});

describe('nearby alternatives', () => {
  const site = (id: string, lat: number, lonE: number): SiteDef => ({ id, name: id, groups: ['reference'], lat, lonE, quality: 'exact', sourceUrl: '', notes: '', elevM: 0 });
  it('measures great-circle distance on the Moon', () => {
    expect(distanceKm({ lat: -90, lonE: 0 }, { lat: -89, lonE: 0 })).toBeCloseTo(30.32, 1);
    expect(distanceKm({ lat: 0, lonE: 179.5 }, { lat: 0, lonE: -179.5 })).toBeCloseTo(30.32, 1);
  });
  it('gives a compass bearing', () => {
    expect(bearing8({ lat: 0, lonE: 0 }, { lat: 1, lonE: 0 })).toBe('N');
    expect(bearing8({ lat: 0, lonE: 0 }, { lat: 0, lonE: -1 })).toBe('W');
    expect(bearing8({ lat: 0, lonE: 0 }, { lat: -1, lonE: 1 })).toBe('SE');
  });
  it('ranks by rules, then Earth contact, then sunlight; skips the origin and far sites', () => {
    const n = 48, g = grid(n), S1 = { ...DEFAULT_SETTINGS, stayDays: 1, goPct: 10 };
    const o = site('o', -89, 0), dark = Array(n).fill(1); dark[10] = 0;
    const cands = [
      { site: o, ev: fakeEval(Array(n).fill(1), Array(n).fill(1)) },
      { site: site('farside', -89.2, 10), ev: fakeEval(Array(n).fill(1), Array(n).fill(0)) },
      { site: site('best', -89.1, 0), ev: fakeEval(Array(n).fill(1), Array(n).fill(1)) },
      { site: site('darkspell', -89.1, 5), ev: fakeEval(dark, Array(n).fill(1)) },
      { site: site('toofar', -80, 0), ev: fakeEval(Array(n).fill(1), Array(n).fill(1)) },
    ];
    const r = rankAlternatives(o, cands, g, 2, S1, 100);
    expect(r.map((x) => x.site.id)).toEqual(['best', 'darkspell', 'farside']);
    expect(r[2].summary.contactPct).toBe(0);
    expect(r[0].km).toBeCloseTo(3.03, 1);
  });
});

describe('monthlyStats', () => {
  it('splits the period at calendar months and counts feasible landing days', () => {
    const n = 59 * 24, g = grid(n); // Jan 1 to Feb 28, 2027, hourly
    const sun = Array(n).fill(0).map((_, i) => (i < 31 * 24 ? 1 : 0)), earth = Array(n).fill(0).map((_, i) => (i % 2));
    const m = monthlyStats(fakeEval(sun, earth), g, { ...DEFAULT_SETTINGS, stayDays: 1, goPct: 10 });
    expect(m.map((x) => new Date(x.monthMs).toISOString().slice(0, 7))).toEqual(['2027-01', '2027-02']);
    expect(m[0].sunPct).toBe(100);
    expect(m[1].sunPct).toBe(0);
    expect(m[0].earthPct).toBe(50);
    expect(m[0].feasibleDays).toBe(31);
    expect(m[1].feasibleDays).toBe(0);
  });
  it('ignores a sliver month shorter than a day (the closing instant of a period)', () => {
    const n = 31 * 24 + 1, g = grid(n); // Jan 1 00:00 to Feb 1 00:00 inclusive
    const m = monthlyStats(fakeEval(Array(n).fill(1), Array(n).fill(1)), g, { ...DEFAULT_SETTINGS, stayDays: 1 });
    expect(m.length).toBe(1);
  });
});
