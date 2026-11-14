// App state (zustand). Data loads once from public/data; everything else is derived in views via state/compute.
import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '@core/analysis';
import { polarSampler, profileFromSampler } from '@core/horizon';
import { globalSampler, loadGlobalTiles } from '@core/coords';
import { fmtLatLon } from '@core/format';
import type { DemGrid, HorizonProfile, Mode, Settings, SiteDef, ViewName } from '@core/types';
import { isoDay, parseIsoDay } from '@core/format';

export type RangePreset = 'jan2027' | 'next30' | 'next90' | 'year' | 'custom';
export type Theme = 'system' | 'dark' | 'light';
export type HudTab = 'mission' | 'sky' | 'sites' | 'compare' | 'check';
/** A landing site and landing time (UTC ms), kept by time so it survives period changes. */
export interface Scenario { id: string; siteId: string; startMs: number }
export const MAX_SCENARIOS = 3;
const DAY = 86400e3;

export function presetRange(p: RangePreset, now = Date.now()): { fromMs: number; toMs: number } {
  const today = Math.floor(now / DAY) * DAY;
  switch (p) {
    case 'next30': return { fromMs: today, toMs: today + 30 * DAY };
    case 'next90': return { fromMs: today, toMs: today + 90 * DAY };
    case 'year': return { fromMs: today, toMs: today + 365 * DAY };
    default: return { fromMs: Date.UTC(2027, 0, 1), toMs: Date.UTC(2027, 0, 31) };
  }
}

export const DEFAULT_COMPARE = ['malapert-massif', 'connecting-ridge-c1', 'shackleton-rim', 'mons-mouton', 'haworth', 'de-gerlache-rim-2'];

interface Store {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  sites: SiteDef[];
  profiles: Record<string, HorizonProfile>;
  selectedId: string;
  compareIds: string[];
  preset: RangePreset;
  fromMs: number;
  toMs: number;
  t: number;
  playing: boolean;
  mode: Mode;
  theme: Theme;
  view: ViewName;
  tab: HudTab;
  zoom: number;
  centred: boolean;
  settings: Settings;
  landing: number | null; // start index of the mission window, null = earliest feasible
  customBusy: boolean;
  scenarios: Scenario[];
  /** Mission scene: the 3D overview or the lander's true-scale view of the sky. */
  sceneView: '3d' | 'sky';
  setSceneView: (v: '3d' | 'sky') => void;
  addScenario: (siteId: string, startMs: number) => void;
  removeScenario: (id: string) => void;
  load: () => Promise<void>;
  select: (id: string) => void;
  toggleCompare: (id: string) => void;
  setRange: (preset: RangePreset, fromMs?: number, toMs?: number) => void;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setMode: (m: Mode) => void;
  setTheme: (t: Theme) => void;
  setView: (v: ViewName) => void;
  setTab: (t: HudTab) => void;
  setZoom: (z: number) => void;
  setCentred: (c: boolean) => void;
  setSettings: (s: Partial<Settings>) => void;
  setLanding: (i: number | null) => void;
  addCustom: (lat: number, lonE: number, name?: string) => Promise<void>;
}

let tiles: Promise<DemGrid[]> | null = null;
async function loadTile(name: string): Promise<DemGrid> {
  const meta = await (await fetch(`data/${name}.json`)).json();
  const buf = await (await fetch(`data/${name}.bin`)).arrayBuffer();
  return { ...meta, data: new Int16Array(buf) };
}
function demTiles(): Promise<DemGrid[]> { return (tiles ??= Promise.all([loadTile('dem480'), loadTile('dem960')])); }

function readUrl() {
  const q = new URLSearchParams(location.search);
  const num = (k: string) => (q.get(k) != null && Number.isFinite(+q.get(k)!) ? +q.get(k)! : undefined);
  return {
    site: q.get('site') || undefined, preset: (q.get('range') as RangePreset) || undefined,
    from: parseIsoDay(q.get('from') || '') ?? undefined, to: parseIsoDay(q.get('to') || '') ?? undefined,
    t: num('t'), mode: (q.get('mode') as Mode) || undefined, view: (q.get('view') as ViewName) || undefined,
    tab: q.get('tab') || undefined, scene: q.get('scene') || undefined,
    mast: num('mast'), stay: num('stay'), reserve: num('reserve'), go: num('go'), land: num('land'),
  };
}

export const useStore = create<Store>((set, get) => {
  const u = readUrl();
  const preset: RangePreset = u.preset && ['jan2027', 'next30', 'next90', 'year', 'custom'].includes(u.preset) ? u.preset : 'jan2027';
  const r = preset === 'custom' && u.from != null && u.to != null && u.to > u.from ? { fromMs: u.from, toMs: Math.min(u.to, u.from + 731 * DAY) } : presetRange(preset === 'custom' ? 'jan2027' : preset);
  const clampN = (v: number | undefined, lo: number, hi: number, d: number) => (v == null ? d : Math.max(lo, Math.min(hi, v)));
  return {
    status: 'loading', error: null, sites: [], profiles: {},
    selectedId: u.site || 'malapert-massif', compareIds: DEFAULT_COMPARE.slice(),
    preset, ...r, t: clampN(u.t, 0, 1e6, 376), playing: false,
    mode: u.mode && ['explore', 'teach', 'plan'].includes(u.mode) ? u.mode : 'plan',
    theme: 'system', view: u.view === 'console' ? 'console' : 'results',
    tab: (['mission', 'sky', 'sites', 'compare', 'check'].includes(u.tab as string) ? u.tab : 'mission') as HudTab, zoom: 1, centred: false,
    settings: {
      ...DEFAULT_SETTINGS,
      mastM: clampN(u.mast, 0, 50, DEFAULT_SETTINGS.mastM),
      stayDays: [6.5, 10, 14].includes(u.stay as number) ? (u.stay as number) : DEFAULT_SETTINGS.stayDays,
      reserveH: clampN(u.reserve, 0, 120, DEFAULT_SETTINGS.reserveH),
      goPct: clampN(u.go, 0, 100, DEFAULT_SETTINGS.goPct),
    },
    landing: u.land ?? null, customBusy: false, scenarios: [], sceneView: u.scene === 'sky' ? 'sky' : '3d',

    load: async () => {
      try {
        const meta = await (await fetch('data/sites.json')).json();
        const sites: SiteDef[] = meta.sites;
        const profiles: Record<string, HorizonProfile> = {};
        await Promise.all(sites.map(async (s) => {
          try {
            const res = await fetch(s.horizonUrl!);
            if (!res.ok) throw new Error(String(res.status));
            const p = await res.json();
            profiles[s.id] = { ...p, source: p.resM > 1000 ? 'lola1900' : 'lola240' };
          } catch { /* missing terrain: flat horizon, flagged in the UI */ }
        }));
        const sel = sites.some((s) => s.id === get().selectedId) ? get().selectedId : 'malapert-massif';
        set({ sites, profiles, status: 'ready', selectedId: sel });
      } catch (e) {
        set({ status: 'error', error: 'Could not load the site data (' + (e as Error).message + '). Check your connection and reload.' });
      }
    },
    select: (id) => set({ selectedId: id, landing: null }),
    toggleCompare: (id) => set((s) => ({ compareIds: s.compareIds.includes(id) ? s.compareIds.filter((x) => x !== id) : s.compareIds.length >= 8 ? s.compareIds : [...s.compareIds, id] })),
    setRange: (p, fromMs, toMs) => {
      const r = p === 'custom' && fromMs != null && toMs != null ? { fromMs, toMs } : presetRange(p);
      set({ preset: p, ...r, t: 0, landing: null, playing: false });
    },
    setT: (t) => set({ t }),
    setPlaying: (playing) => set({ playing }),
    setMode: (mode) => set({ mode }),
    setTheme: (theme) => {
      if (theme === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('pw-theme', theme); } catch { /* storage unavailable */ }
      set({ theme });
    },
    setView: (view) => set({ view }),
    setTab: (tab) => set({ tab }),
    setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(4, zoom)) }),
    setCentred: (centred) => set({ centred }),
    setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s }, landing: s.stayDays != null ? null : st.landing })),
    setLanding: (landing) => set({ landing }),
    setSceneView: (sceneView) => set({ sceneView }),
    addScenario: (siteId, startMs) => set((s) => {
      const id = siteId + '@' + startMs;
      if (s.scenarios.some((x) => x.id === id)) return {};
      return { scenarios: [...s.scenarios, { id, siteId, startMs }].slice(-MAX_SCENARIOS) };
    }),
    removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
    addCustom: async (lat, lonE, name) => {
      set({ customBusy: true, error: null });
      try {
        const id = `custom-${lat.toFixed(3)}-${lonE.toFixed(3)}`;
        // Near the south pole: the 480 m / 960 m polar tiles, falling back to the global model where rays leave them.
        // Elsewhere: NASA's global model (16 px/deg, ~1.9 km), fetched as the few 15-degree tiles within 300 km.
        const glob = globalSampler(await loadGlobalTiles(lat, lonE));
        let profile;
        if (lat <= -70) {
          const polar = polarSampler(await demTiles());
          profile = profileFromSampler((la, lo) => polar(la, lo) ?? glob(la, lo), id, lat, lonE, 300000, 480, 'lola480');
        } else profile = profileFromSampler(glob, id, lat, lonE, 300000, undefined, 'lola1900');
        const terrain = profile.source === 'lola480' ? 'NASA LOLA 480 m polar tile' : 'NASA LOLA global model (~1.9 km pixels, so nearby hills are smoothed)';
        const site: SiteDef = {
          id, name: name?.trim() || `Custom point ${fmtLatLon(lat, lonE)}`, groups: ['custom'], lat, lonE,
          quality: 'custom', sourceUrl: '', notes: `Your point. Terrain from the ${terrain}` + (profile.coverage < 1 ? '; some sight lines leave the terrain data, so far terrain may be missing.' : '.'),
          elevM: profile.elevM,
        };
        set((s) => ({ sites: [...s.sites.filter((x) => x.id !== id), site], profiles: { ...s.profiles, [id]: profile }, selectedId: id, landing: null, customBusy: false }));
      } catch (e) {
        set({ customBusy: false, error: 'Could not compute that point (' + (e as Error).message + ').' });
      }
    },
  };
});

/** Mirror the shareable parts of the state into the URL (replaceState; no history spam). */
export function startUrlSync(): () => void {
  return useStore.subscribe((s) => {
    if (s.status !== 'ready' || s.selectedId.startsWith('custom-')) return;
    const q = new URLSearchParams();
    q.set('site', s.selectedId);
    q.set('range', s.preset);
    if (s.preset === 'custom') { q.set('from', isoDay(s.fromMs)); q.set('to', isoDay(s.toMs)); }
    q.set('t', String(Math.round(s.t)));
    q.set('mode', s.mode);
    if (s.tab !== 'mission') q.set('tab', s.tab);
    if (s.sceneView === 'sky') q.set('scene', 'sky');
    if (s.settings.mastM !== DEFAULT_SETTINGS.mastM) q.set('mast', String(s.settings.mastM));
    if (s.settings.stayDays !== DEFAULT_SETTINGS.stayDays) q.set('stay', String(s.settings.stayDays));
    if (s.settings.reserveH !== DEFAULT_SETTINGS.reserveH) q.set('reserve', String(s.settings.reserveH));
    if (s.settings.goPct !== DEFAULT_SETTINGS.goPct) q.set('go', String(s.settings.goPct));
    if (s.landing != null) q.set('land', String(s.landing));
    const next = '?' + q.toString();
    if (next !== location.search) history.replaceState(null, '', next + location.hash);
  });
}
