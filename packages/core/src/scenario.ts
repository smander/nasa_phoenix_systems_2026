// Re-planning: a scenario is a landing site plus a landing time. These pure functions summarise one stay, the same
// stay with the landing slipped by days, and the best nearby sites for the same dates.
import { checkMission, landingDays, longestRun, stayLength, timeAt } from './analysis';
import type { Evaluation, Settings, SiteDef, TimeGrid } from './types';

export interface ScenarioSummary {
  verdictPass: number; rules: number;
  sunPct: number; contactPct: number; longestDarkH: number; meanPowerW: number;
  firstSunsetH: number | null; firstEarthsetH: number | null;
  startMs: number; endMs: number; inRange: boolean;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Hours from `start` to the first up→down change of `a` (the next set, after a rise if down at `start`). */
function firstSet(a: Uint8Array, start: number, stepH: number): number | null {
  for (let k = Math.max(1, start + 1); k < a.length; k++) if (a[k - 1] === 1 && a[k] === 0) return (k - start) * stepH;
  return null;
}

/** One stay starting at step `start`: rules passing, and sunlight, contact, darkness and power over the stay. */
export function summarize(ev: Evaluation, grid: TimeGrid, start: number, s: Settings): ScenarioSummary {
  const len = stayLength(grid, s), stepH = grid.stepMin / 60;
  const mc = checkMission(ev, grid, start, s, iso);
  const from = mc.startIndex, to = mc.endIndex, n = Math.max(1, to - from);
  let sun = 0, earth = 0, p = 0;
  for (let i = from; i < to; i++) { sun += ev.sunUp[i]; earth += ev.earthUp[i]; p += ev.powerW[i]; }
  return {
    verdictPass: mc.rules.filter((r) => r.holds).length, rules: mc.rules.length,
    sunPct: (100 * sun) / n, contactPct: (100 * earth) / n,
    longestDarkH: longestRun(ev.sunUp, 0, from, to) * stepH, meanPowerW: p / n,
    firstSunsetH: firstSet(ev.sunUp, start, stepH), firstEarthsetH: firstSet(ev.earthUp, start, stepH),
    startMs: timeAt(grid, from), endMs: timeAt(grid, to), inRange: start >= 0 && start + len <= grid.n - 1,
  };
}

/** Landing slips shown in the what-if table, in days. */
export const SLIP_DAYS = [-3, -2, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 28];

export interface SlipRow { days: number; start: number; summary: ScenarioSummary | null }

/** The same stay with the landing moved by each of SLIP_DAYS; `summary` is null when the slipped stay leaves the period. */
export function slipTable(ev: Evaluation, grid: TimeGrid, start: number, s: Settings): SlipRow[] {
  const perDay = Math.round(1440 / grid.stepMin), len = stayLength(grid, s);
  return SLIP_DAYS.map((days) => {
    const st = start + days * perDay;
    return { days, start: st, summary: st >= 0 && st + len <= grid.n - 1 ? summarize(ev, grid, st, s) : null };
  });
}

/** The first later landing that passes fewer rules than on time, with a short reason. */
export function firstBreak(rows: SlipRow[]): { days: number; why: string } | null {
  const base = rows.find((r) => r.days === 0)?.summary;
  if (!base) return null;
  for (const r of rows) {
    const x = r.summary;
    if (r.days <= 0 || !x || x.verdictPass >= base.verdictPass) continue;
    const why = x.longestDarkH > base.longestDarkH ? `adds a ${Math.round(x.longestDarkH)}-hour dark spell`
      : x.contactPct < base.contactPct - 0.5 ? `cuts Earth contact to ${Math.round(x.contactPct)}%`
      : x.sunPct < base.sunPct - 0.5 ? `cuts sunlight to ${Math.round(x.sunPct)}%` : 'breaks a mission rule';
    return { days: r.days, why };
  }
  return null;
}

const R_MOON_KM = 1737.4, D2R = Math.PI / 180;
type LatLon = { lat: number; lonE: number };

/** Great-circle distance on the Moon's mean sphere (km). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lonE - a.lonE) * D2R;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_MOON_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b as one of eight compass points. */
export function bearing8(a: LatLon, b: LatLon): string {
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lonE - a.lonE) * D2R;
  const t = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((t / D2R) % 360) + 360) % 360 / 45) % 8];
}

export interface Alternative { site: SiteDef; km: number; bearing: string; summary: ScenarioSummary }

/** Other sites within `radiusKm` of `origin`, judged on the same landing step; best first (rules, then contact, then sunlight). */
export function rankAlternatives(origin: SiteDef, candidates: { site: SiteDef; ev: Evaluation }[], grid: TimeGrid, start: number, s: Settings, radiusKm: number): Alternative[] {
  return candidates
    .filter((c) => c.site.id !== origin.id)
    .map((c) => ({ site: c.site, km: distanceKm(origin, c.site), bearing: bearing8(origin, c.site), summary: summarize(c.ev, grid, start, s) }))
    .filter((c) => c.km <= radiusKm)
    .sort((x, y) => y.summary.verdictPass - x.summary.verdictPass || y.summary.contactPct - x.summary.contactPct || y.summary.sunPct - x.summary.sunPct);
}

export interface MonthStat { monthMs: number; sunPct: number; earthPct: number; feasibleDays: number; days: number }

/** Per calendar month (UTC): sunlight and Earth-visibility percentages and the number of feasible landing days. */
export function monthlyStats(ev: Evaluation, grid: TimeGrid, s: Settings): MonthStat[] {
  const out: MonthStat[] = [], byKey = new Map<number, { sun: number; earth: number; n: number; feas: number; days: number }>();
  const monthOf = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  for (let i = 0; i < grid.n; i++) {
    const k = monthOf(timeAt(grid, i));
    let m = byKey.get(k); if (!m) { m = { sun: 0, earth: 0, n: 0, feas: 0, days: 0 }; byKey.set(k, m); }
    m.sun += ev.sunUp[i]; m.earth += ev.earthUp[i]; m.n++;
  }
  for (const d of landingDays(ev, grid, s)) { const m = byKey.get(monthOf(d.dayMs))!; m.days++; if (d.cls >= 1) m.feas++; }
  const stepH = grid.stepMin / 60;
  for (const [k, m] of byKey) if (m.n * stepH >= 24) out.push({ monthMs: k, sunPct: (100 * m.sun) / m.n, earthPct: (100 * m.earth) / m.n, feasibleDays: m.feas, days: m.days });
  return out.sort((x, y) => x.monthMs - y.monthMs);
}
