// Memoised analysis. Stage A (ephemeris grid, site tracks) is cached by date range and site position;
// Stage B (masks, evaluation, metrics) by observer height and settings. Everything is synchronous and fast:
// a month hourly is ~720 steps; a year ~8,760.
import { buildGrid, ephemGrid, evaluate, metrics, siteTracks } from '@core/analysis';
import { flatProfile, maskForHeight } from '@core/horizon';
import type { EphemGrid, Evaluation, HorizonProfile, Metrics, Settings, SiteDef, TimeGrid, Tracks } from '@core/types';

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T, limit = 400): T {
  if (cache.has(key)) return cache.get(key) as T;
  const v = make();
  cache.set(key, v);
  if (cache.size > limit) cache.delete(cache.keys().next().value as string);
  return v;
}

export function gridFor(fromMs: number, toMs: number): TimeGrid { return memo(`grid:${fromMs}:${toMs}`, () => buildGrid(fromMs, toMs)); }
export function ephemFor(g: TimeGrid): EphemGrid { return memo(`eg:${g.t0Ms}:${g.stepMin}:${g.n}`, () => ephemGrid(g), 8); }
export function tracksFor(g: TimeGrid, s: SiteDef): Tracks {
  return memo(`tr:${g.t0Ms}:${g.stepMin}:${g.n}:${s.id}:${s.lat}:${s.lonE}:${s.elevM}`, () => siteTracks(ephemFor(g), s), 200);
}
export function maskFor(p: HorizonProfile | undefined, siteId: string, mastM: number): Float32Array {
  const prof = p || flatProfile(siteId);
  return memo(`mask:${siteId}:${prof.source}:${mastM}`, () => maskForHeight(prof, mastM));
}
export function evalFor(g: TimeGrid, s: SiteDef, p: HorizonProfile | undefined, st: Settings): Evaluation {
  return memo(`ev:${g.t0Ms}:${g.n}:${s.id}:${p?.source ?? 'flat'}:${st.mastM}:${st.minEarthElDeg}:${st.eta}`,
    () => evaluate(ephemFor(g), tracksFor(g, s), maskFor(p, s.id, st.mastM), st), 200);
}
export function metricsFor(g: TimeGrid, s: SiteDef, p: HorizonProfile | undefined, st: Settings): Metrics {
  return memo(`m:${g.t0Ms}:${g.n}:${s.id}:${p?.source ?? 'flat'}:${st.mastM}:${st.minEarthElDeg}:${st.eta}`, () => metrics(evalFor(g, s, p, st), g), 200);
}

/** Twelve calendar months from the first of `fromMs`'s month, 3-hour steps (for the year view). */
export function yearGridFor(fromMs: number): TimeGrid {
  const d = new Date(fromMs), t0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), t1 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 12, 1);
  return memo(`ygrid:${t0}`, () => buildGrid(t0, t1, 180));
}
