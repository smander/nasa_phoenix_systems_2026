import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, buildGrid, checkMission, ephemGrid, evaluate, firstFeasibleStart, landingDays, longestRun, metrics, sapleOutputLines, segments, siteTracks, splModel, splText } from './analysis';
import { dipDeg, flatProfile, maskAt, maskForHeight, profileFromDem } from './horizon';
import type { DemGrid, Evaluation, HorizonProfile, SiteDef } from './types';

const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const load = (p: string) => JSON.parse(readFileSync(new URL('../../../apps/web/public/data/' + p, import.meta.url), 'utf8'));
const sites: SiteDef[] = load('sites.json').sites;
const malapert = sites.find((s) => s.id === 'malapert-massif')!;
const profile: HorizonProfile = { ...load('horizons/malapert-massif.json'), source: 'lola240' };

function fakeEval(sun: number[], earth: number[]): Evaluation {
  const n = sun.length, ev = { sunUp: Uint8Array.from(sun), earthUp: Uint8Array.from(earth), state: new Uint8Array(n), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: new Float32Array(n) };
  for (let i = 0; i < n; i++) { ev.state[i] = sun[i] + 2 * earth[i]; ev.powerW[i] = sun[i] * 400; }
  return ev;
}

describe('horizon masks', () => {
  it('flat horizon sits at minus the geometric dip', () => {
    const m = maskForHeight(flatProfile('x'), 10);
    expect(maskAt(m, 123)).toBeCloseTo(-dipDeg(10), 6);
    expect(dipDeg(2)).toBeCloseTo(0.0869, 3);
  });
  it('interpolates between stored heights and never rises with height', () => {
    const m2 = maskForHeight(profile, 2), m3 = maskForHeight(profile, 3.5), m5 = maskForHeight(profile, 5);
    for (let i = 0; i < 720; i += 37) { expect(m3[i]).toBeLessThanOrEqual(m2[i] + 1e-6); expect(m3[i]).toBeGreaterThanOrEqual(m5[i] - 1e-6); }
  });
  it('wraps across north', () => {
    const m = maskForHeight(profile, 2);
    expect(Math.abs(maskAt(m, 359.99) - maskAt(m, 0))).toBeLessThan(0.05);
  });
  it('browser ray-march on the 480 m tile agrees with the 240 m pipeline horizon', () => {
    const tile = (name: string): DemGrid => { const buf = readFileSync(new URL('../../../apps/web/public/data/' + name + '.bin', import.meta.url)); return { ...load(name + '.json'), data: new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2) }; };
    const p = profileFromDem([tile('dem480'), tile('dem960')], 'c', malapert.lat, malapert.lonE);
    expect(p.coverage).toBe(1);
    const a = maskForHeight(p, 2), b = maskForHeight(profile, 2), diffs: number[] = [];
    for (let i = 0; i < 720; i++) diffs.push(Math.abs(a[i] - b[i]));
    diffs.sort((x, y) => x - y);
    expect(diffs[360]).toBeLessThan(0.35); // median difference: coarser grid, same geometry
    expect(Math.abs(p.elevM - malapert.elevM)).toBeLessThan(150);
  });
});

describe('metrics and mission rules on synthetic hours', () => {
  const grid = buildGrid(0, 23 * 3600e3, 60); // 24 hourly steps
  it('counts runs and percentages', () => {
    const ev = fakeEval([0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], new Array(24).fill(0).map((_, i) => (i >= 12 ? 1 : 0)));
    const m = metrics(ev, grid);
    expect(m.longestDarkH).toBe(3);
    expect(m.longestGapH).toBe(12);
    expect(Math.round(m.sunPct)).toBe(Math.round((20 / 24) * 100));
    expect(longestRun(ev.sunUp, 1)).toBe(16);
    expect(segments(ev.sunUp).length).toBe(4);
  });
  it('flags the first failing hour and the battery', () => {
    const sun = new Array(24).fill(1); sun[5] = sun[6] = sun[7] = 0;
    const earth = new Array(24).fill(0); earth[6] = 1;
    const ev = fakeEval(sun, earth);
    const s = { ...DEFAULT_SETTINGS, stayDays: 0.5, reserveH: 2, goPct: 25 };
    const mc = checkMission(ev, grid, 0, s, fmt);
    const r = Object.fromEntries(mc.rules.map((x) => [x.id, x]));
    expect(r.SunlitStay.holds).toBe(false); expect(r.SunlitStay.firstFailMs).toBe(5 * 3600e3);
    expect(r.BatterySafe.holds).toBe(false); expect(r.BatterySafe.firstFailMs).toBe(7 * 3600e3);
    expect(r.DteWindow.holds).toBe(true);
    expect(r.DteCoverage.holds).toBe(false);
    expect(r.Blackout.holds).toBe(false); expect(r.Blackout.firstFailMs).toBe(5 * 3600e3);
  });
});

describe('Malapert Massif, January 2027 (real geometry and terrain)', () => {
  const grid = buildGrid(Date.UTC(2027, 0, 1), Date.UTC(2027, 0, 31));
  const eg = ephemGrid(grid);
  const tr = siteTracks(eg, malapert);
  const ev = evaluate(eg, tr, maskForHeight(profile, 2), DEFAULT_SETTINGS);
  const m = metrics(ev, grid);
  it('matches the values in the design brief', () => {
    expect(Math.round(m.sunPct)).toBe(69);
    expect(Math.round(m.earthPct)).toBe(75);
    expect(Math.round(m.longestDarkH / 24 * 10) / 10).toBeCloseTo(6.2, 1);
    expect(m.dailyKWh.length).toBe(30);
  });
  it('raising the mast to 10 m keeps Earth in view all month', () => {
    const ev10 = evaluate(eg, tr, maskForHeight(profile, 10), { ...DEFAULT_SETTINGS, mastM: 10 });
    expect(Math.round(metrics(ev10, grid).earthPct)).toBe(100);
  });
  it('earliest feasible landing is Jan 2 06:00 and all five rules hold', () => {
    const start = firstFeasibleStart(ev, grid, DEFAULT_SETTINGS);
    const mc = checkMission(ev, grid, start, DEFAULT_SETTINGS, fmt);
    expect(fmt(mc.startMs)).toBe('2027-01-02 06:00');
    expect(mc.rules.every((r) => r.holds)).toBe(true);
    const days = landingDays(ev, grid, DEFAULT_SETTINGS);
    expect(days[8].cls).toBe(0); // Jan 9: a dark spell falls inside the stay
    const spl = splText(splModel(malapert, tr, ev, grid, mc, DEFAULT_SETTINGS, fmt));
    expect(spl).toContain('earthMargin : Array(Int, 156) = [');
    expect(spl).toContain('property unreachable Blackout');
    expect(sapleOutputLines('x.spl', mc, fmt).at(-1)).toContain('5 of 5 rules hold');
  });
});
