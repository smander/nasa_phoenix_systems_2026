// Analysis engine. Stage A: shared Moon-centred geometry per time step (ephemGrid) and per-site topocentric
// tracks. Stage B (cheap, re-run on every slider move): visibility against the terrain mask, power,
// metrics, landing-date classes, the five mission rules and the generated SPL model.
import { R_EARTH_KM, R_SUN_KM, angularRadiusDeg, moonCentred, siteFrame, topocentric, earthLitFraction } from './ephemeris';
import { maskAt } from './horizon';
import type { EphemGrid, Evaluation, Metrics, MissionCheck, RuleResult, Settings, SiteDef, SkyState, TimeGrid, Tracks } from './types';

const HOUR = 3600e3;
const D2R = Math.PI / 180;
export const S0_WM2 = 1361;
export const STATE_NAMES: SkyState[] = ['none', 'sun', 'earth', 'both'];

export const DEFAULT_SETTINGS: Settings = { mastM: 2, minEarthElDeg: -90, eta: 0.3, stayDays: 6.5, reserveH: 50, goPct: 25 };

/** Hourly grid by default; coarser for long ranges so a run stays under ~9,000 steps. */
export function autoStepMin(fromMs: number, toMs: number): number {
  const days = (toMs - fromMs) / 86400e3;
  return days <= 400 ? 60 : days <= 1500 ? 180 : 360;
}

export function buildGrid(fromMs: number, toMs: number, stepMin = autoStepMin(fromMs, toMs)): TimeGrid {
  return { t0Ms: fromMs, stepMin, n: Math.floor((toMs - fromMs) / (stepMin * 60e3)) + 1 };
}

export function timeAt(g: TimeGrid, i: number): number { return g.t0Ms + i * g.stepMin * 60e3; }

/** Stage A, shared by every site: body-fixed Sun and Earth vectors for each time step. */
export function ephemGrid(grid: TimeGrid): EphemGrid {
  const sun = new Float64Array(grid.n * 3), earth = new Float64Array(grid.n * 3), sunDistAU = new Float64Array(grid.n);
  for (let i = 0; i < grid.n; i++) {
    const m = moonCentred(timeAt(grid, i));
    sun.set(m.sun, i * 3); earth.set(m.earth, i * 3); sunDistAU[i] = m.sunDistAU;
  }
  return { grid, sun, earth, sunDistAU };
}

/** Stage A, per site: topocentric az/el of the Sun and Earth, apparent radii and Earth's lit fraction. */
export function siteTracks(eg: EphemGrid, site: Pick<SiteDef, 'lat' | 'lonE' | 'elevM'>): Tracks {
  const n = eg.grid.n, f = siteFrame(site.lat, site.lonE, site.elevM || 0);
  const t: Tracks = {
    sunAz: new Float32Array(n), sunEl: new Float32Array(n), sunR: new Float32Array(n),
    earthAz: new Float32Array(n), earthEl: new Float32Array(n), earthR: new Float32Array(n), earthKm: new Float32Array(n), earthLit: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const s: [number, number, number] = [eg.sun[i * 3], eg.sun[i * 3 + 1], eg.sun[i * 3 + 2]];
    const e: [number, number, number] = [eg.earth[i * 3], eg.earth[i * 3 + 1], eg.earth[i * 3 + 2]];
    const a = topocentric(s, f), b = topocentric(e, f);
    t.sunAz[i] = a.az; t.sunEl[i] = a.el; t.sunR[i] = angularRadiusDeg(R_SUN_KM, a.rangeKm);
    t.earthAz[i] = b.az; t.earthEl[i] = b.el; t.earthR[i] = angularRadiusDeg(R_EARTH_KM, b.rangeKm); t.earthKm[i] = b.rangeKm;
    t.earthLit[i] = earthLitFraction(s, e, f);
  }
  return t;
}

/** Stage B: visibility (any part of the disc above the skyline), state and electrical power per step. */
export function evaluate(eg: EphemGrid, tr: Tracks, mask: Float32Array, s: Settings): Evaluation {
  const n = eg.grid.n;
  const ev: Evaluation = { sunUp: new Uint8Array(n), earthUp: new Uint8Array(n), state: new Uint8Array(n), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const ms = maskAt(mask, tr.sunAz[i]), me = Math.max(maskAt(mask, tr.earthAz[i]), s.minEarthElDeg);
    ev.maskSun[i] = ms; ev.maskEarth[i] = me;
    const r = tr.sunR[i], frac = Math.min(1, Math.max(0, (tr.sunEl[i] - ms + r) / (2 * r)));
    ev.sunUp[i] = frac > 0 ? 1 : 0;
    ev.earthUp[i] = tr.earthEl[i] + tr.earthR[i] > me ? 1 : 0;
    ev.state[i] = ev.sunUp[i] + 2 * ev.earthUp[i];
    const S = S0_WM2 / (eg.sunDistAU[i] * eg.sunDistAU[i]);
    ev.powerW[i] = s.eta * S * frac * Math.cos(tr.sunEl[i] * D2R); // vertical array turning to face the Sun
  }
  return ev;
}

export function longestRun(a: Uint8Array, value: number, from = 0, to = a.length): number {
  let best = 0, cur = 0;
  for (let i = from; i < to; i++) { if (a[i] === value) { cur++; if (cur > best) best = cur; } else cur = 0; }
  return best;
}

export function metrics(ev: Evaluation, grid: TimeGrid): Metrics {
  const n = grid.n, stepH = grid.stepMin / 60;
  let s = 0, e = 0, b = 0, z = 0, p = 0;
  for (let i = 0; i < n; i++) { s += ev.sunUp[i]; e += ev.earthUp[i]; b += ev.state[i] === 3 ? 1 : 0; z += ev.state[i] === 0 ? 1 : 0; p += ev.powerW[i]; }
  const perDay = Math.round(24 / stepH), days = Math.floor((n - 1) / perDay);
  const dailyKWh: number[] = [], dailyContactH: number[] = [];
  for (let d = 0; d < days; d++) {
    let kwh = 0, ch = 0;
    for (let i = d * perDay; i < (d + 1) * perDay; i++) { kwh += ev.powerW[i] * stepH / 1000; ch += ev.earthUp[i] * stepH; }
    dailyKWh.push(kwh); dailyContactH.push(ch);
  }
  const meanPowerW = p / n;
  return {
    sunPct: 100 * s / n, earthPct: 100 * e / n, bothPct: 100 * b / n, nonePct: 100 * z / n,
    longestDarkH: longestRun(ev.sunUp, 0) * stepH, longestGapH: longestRun(ev.earthUp, 0) * stepH,
    meanPowerW, energyKWh: (p * stepH) / 1000, areaFor10kWm2: meanPowerW > 1 ? 10000 / meanPowerW : null,
    dailyKWh, dailyContactH,
  };
}

export interface Countdown { up: boolean; hours: number | null }

/** Hours from step `i` until `a` changes value; null when it stays the same to the end of the period. */
export function nextChange(a: Uint8Array, i: number, stepH: number): Countdown {
  const up = a[i] === 1;
  for (let k = i + 1; k < a.length; k++) if (a[k] !== a[i]) return { up, hours: (k - i) * stepH };
  return { up, hours: null };
}

/** Time to the next sunset or sunrise, and the next Earthset or Earthrise, from step `i`. */
export function countdowns(ev: Evaluation, grid: TimeGrid, i: number): { sun: Countdown; earth: Countdown } {
  const stepH = grid.stepMin / 60, k = Math.max(0, Math.min(grid.n - 1, Math.round(i)));
  return { sun: nextChange(ev.sunUp, k, stepH), earth: nextChange(ev.earthUp, k, stepH) };
}

/** Runs of identical values as fractions of the range, for month bars. */
export function segments(values: Uint8Array, from = 0, to = values.length): { from: number; to: number; value: number }[] {
  const out: { from: number; to: number; value: number }[] = [], len = to - from;
  let s0 = from;
  for (let i = from + 1; i <= to; i++) {
    if (i === to || values[i] !== values[s0]) { out.push({ from: (s0 - from) / len, to: (i - from) / len, value: values[s0] }); s0 = i; }
  }
  return out;
}

export function stateSegments(ev: Evaluation, from = 0, to = ev.state.length) {
  return segments(ev.state, from, to).map((r) => ({ from: r.from, to: r.to, state: STATE_NAMES[r.value] }));
}

export function laneRanges(a: Uint8Array, from = 0, to = a.length): [number, number][] {
  return segments(a, from, to).filter((r) => r.value === 1).map((r) => [r.from, r.to] as [number, number]);
}

// ---- mission check ----

export function stayLength(grid: TimeGrid, s: Settings): number { return Math.round((s.stayDays * 24 * 60) / grid.stepMin); }

/** 2 = sunlit stay with enough Earth contact, 1 = sunlit only, 0 = a dark spell during the stay. */
export function startClass(ev: Evaluation, start: number, len: number, s: Settings): 0 | 1 | 2 {
  let contact = 0;
  for (let i = start; i < start + len; i++) { if (!ev.sunUp[i]) return 0; contact += ev.earthUp[i]; }
  return (100 * contact) / len >= s.goPct ? 2 : 1;
}

/** One entry per calendar day: the best landing hour that day and its class. */
export function landingDays(ev: Evaluation, grid: TimeGrid, s: Settings): { dayMs: number; startIndex: number; cls: 0 | 1 | 2 }[] {
  const len = stayLength(grid, s), perDay = Math.round(1440 / grid.stepMin), out = [];
  for (let d = 0; d * perDay + len < grid.n; d++) {
    let best = { idx: d * perDay, cls: 0 as 0 | 1 | 2 };
    for (let k = 0; k < perDay; k++) {
      const idx = d * perDay + k;
      if (idx + len >= grid.n) break;
      const c = startClass(ev, idx, len, s);
      if (c > best.cls) best = { idx, cls: c };
      if (c === 2) break;
    }
    out.push({ dayMs: timeAt(grid, d * perDay), startIndex: best.idx, cls: best.cls });
  }
  return out;
}

export function firstFeasibleStart(ev: Evaluation, grid: TimeGrid, s: Settings): number {
  const len = stayLength(grid, s);
  for (let i = 0; i + len < grid.n; i++) if (startClass(ev, i, len, s) > 0) return i;
  return 0;
}

export function checkMission(ev: Evaluation, grid: TimeGrid, start: number, s: Settings, fmt: (ms: number) => string): MissionCheck {
  const len = stayLength(grid, s), end = Math.min(grid.n - 1, start + len), stepH = grid.stepMin / 60;
  let firstDark = -1, contact = 0, firstEarth = -1, blackout = -1, run = 0, worst = 0, batteryFail = -1;
  const battery = new Float32Array(end - start);
  let reserve = s.reserveH;
  for (let i = start; i < end; i++) {
    if (!ev.sunUp[i] && firstDark < 0) firstDark = i;
    if (ev.earthUp[i]) { contact++; if (firstEarth < 0) firstEarth = i; }
    if (!ev.sunUp[i] && !ev.earthUp[i] && blackout < 0) blackout = i;
    if (!ev.sunUp[i]) { run += stepH; worst = Math.max(worst, run); reserve -= stepH; if (reserve < 0 && batteryFail < 0) batteryFail = i; }
    else { run = 0; reserve = s.reserveH; }
    battery[i - start] = reserve;
  }
  const cov = (100 * contact) / Math.max(1, end - start);
  const T = (i: number) => fmt(timeAt(grid, i));
  const rules: RuleResult[] = [
    { id: 'SunlitStay', title: 'Sunlight for the whole stay', kind: 'invariant', expr: 'sun == UP', holds: firstDark < 0, firstFailMs: firstDark < 0 ? null : timeAt(grid, firstDark),
      why: firstDark < 0 ? 'The Sun never drops behind the terrain while you are there.' : 'The Sun drops behind the terrain at ' + T(firstDark) + '.' },
    { id: 'BatterySafe', title: 'Battery never runs out', kind: 'invariant', expr: 'reserveH >= 0', holds: batteryFail < 0, firstFailMs: batteryFail < 0 ? null : timeAt(grid, batteryFail),
      why: (worst === 0 ? 'No dark spell during the stay' : 'Longest dark spell ' + fmtHours(worst)) + '; the battery covers ' + s.reserveH + ' h.' },
    { id: 'DteWindow', title: 'Earth comes into view', kind: 'reachable', expr: 'earth == UP', holds: firstEarth >= 0, firstFailMs: null,
      why: firstEarth >= 0 ? 'First line of sight to Earth at ' + T(firstEarth) + '.' : 'Earth never clears the terrain during the stay.' },
    { id: 'DteCoverage', title: 'Enough time in contact with Earth', kind: 'invariant', expr: 'contactH * 100 >= ' + s.goPct + ' * stayH', holds: cov >= s.goPct, firstFailMs: null,
      why: 'Earth is in view ' + Math.round(cov) + '% of the stay; the rule needs ' + s.goPct + '%.' },
    { id: 'Blackout', title: 'Never without both power and radio', kind: 'unreachable', expr: 'blackoutH > 0', holds: blackout < 0, firstFailMs: blackout < 0 ? null : timeAt(grid, blackout),
      why: blackout < 0 ? 'There is always either sunlight or Earth contact.' : 'Both are lost at ' + T(blackout) + '.' },
  ];
  return { startIndex: start, endIndex: end, startMs: timeAt(grid, start), endMs: timeAt(grid, end), rules, battery, coveragePct: cov, longestDarkH: worst, firstEarthMs: firstEarth < 0 ? null : timeAt(grid, firstEarth) };
}

export function fmtHours(h: number): string { return h >= 48 ? (h / 24).toFixed(1) + ' d' : Math.round(h) + ' h'; }

// ---- SAPLE model generation: see spl.ts ----
export { sapleOutputLines, splModel, splSource, splText } from './spl';
export type { SplToken } from './spl';
