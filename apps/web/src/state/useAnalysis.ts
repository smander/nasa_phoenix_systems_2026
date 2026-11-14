// Everything the views need for the selected point, derived from the store and memoised.
import { useMemo } from 'react';
import { checkMission, firstFeasibleStart, landingDays, sapleOutputLines, splModel, splText, stateSegments, stayLength, timeAt } from '@core/analysis';
import { fmtShort } from '@core/format';
import type { SiteDef } from '@core/types';
import { evalFor, gridFor, maskFor, metricsFor, tracksFor } from './compute';
import { useStore } from './store';

export function useAnalysis() {
  const s = useStore();
  const site: SiteDef | undefined = s.sites.find((x) => x.id === s.selectedId);
  const profile = site ? s.profiles[site.id] : undefined;
  const grid = useMemo(() => gridFor(s.fromMs, s.toMs), [s.fromMs, s.toMs]);

  const core = useMemo(() => {
    if (!site) return null;
    const tracks = tracksFor(grid, site);
    const ev = evalFor(grid, site, profile, s.settings);
    const m = metricsFor(grid, site, profile, s.settings);
    const mask = maskFor(profile, site.id, s.settings.mastM);
    return { tracks, ev, m, mask };
  }, [site, profile, grid, s.settings]);

  const mission = useMemo(() => {
    if (!site || !core) return null;
    const len = stayLength(grid, s.settings);
    const days = landingDays(core.ev, grid, s.settings);
    const fallback = firstFeasibleStart(core.ev, grid, s.settings);
    const start = Math.max(0, Math.min(grid.n - 1 - len, s.landing ?? fallback));
    const mc = checkMission(core.ev, grid, start, s.settings, fmtShort);
    const fileName = 'polar_window_' + site.id.replace(/-/g, '_') + '.spl';
    const spl = splModel(site, core.tracks, core.ev, grid, mc, s.settings, fmtShort);
    const output = sapleOutputLines(fileName, mc, fmtShort);
    return { len, days, mc, fileName, spl, source: splText(spl), output, start };
  }, [site, core, grid, s.settings, s.landing]);

  const t = Math.max(0, Math.min(grid.n - 1, Math.round(s.t)));
  const nowMs = timeAt(grid, t);
  const segments = useMemo(() => (core ? stateSegments(core.ev) : []), [core]);

  /** Month metrics for every preset (pick list and ranking). */
  const all = useMemo(() => {
    const out: Record<string, { sun: number; earth: number; both: number; dark: number; segs: ReturnType<typeof stateSegments> }> = {};
    for (const x of s.sites) {
      const ev = evalFor(grid, x, s.profiles[x.id], s.settings);
      const m = metricsFor(grid, x, s.profiles[x.id], s.settings);
      out[x.id] = { sun: m.sunPct, earth: m.earthPct, both: m.bothPct, dark: m.longestDarkH, segs: stateSegments(ev) };
    }
    return out;
  }, [s.sites, s.profiles, grid, s.settings]);

  return { store: s, site, profile, grid, t, nowMs, segments, all, ...(core || {}), mission } as const;
}

export type Analysis = ReturnType<typeof useAnalysis>;
