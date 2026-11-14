// NASA LOLA long-term average illumination (Mazarico et al.; PDS LOLA extras, ground level, 240 m/pixel to 65 S).
// The pipeline ships a 1 km grid around the pole (sun %, Earth %, permanent shadow) and an 18 km inset per catalogued
// site at the native 240 m. These helpers read them; values are percentages of time the disc is visible.
import { latLonToXY, xyToLatLon } from './horizon';
import { bearing8 } from './scenario';

export type MapLayer = 'relief' | 'sun' | 'earth' | 'psr';

/** n x n pixels over ±halfWidthM around the pole; layers in order sun %, Earth %, permanent shadow (0/1); row 0 = +Y. */
export interface IllumGrid { n: number; halfWidthM: number; spacingM: number; data: Uint8Array }
/** n x n pixels over ±halfWidthM around a site at (cx, cy) in polar stereographic metres; layers sun %, Earth %. */
export interface IllumInset { n: number; halfWidthM: number; spacingM: number; cx: number; cy: number; data: Uint8Array }

export function illumAt(g: IllumGrid, lat: number, lonE: number): { sunPct: number; earthPct: number; psr: boolean } | null {
  if (lat > -55) return null;
  const { x, y } = latLonToXY(lat, lonE);
  const col = Math.round((x + g.halfWidthM) / g.spacingM), row = Math.round((g.halfWidthM - y) / g.spacingM);
  if (col < 0 || row < 0 || col >= g.n || row >= g.n) return null;
  const k = row * g.n + col, nn = g.n * g.n;
  return { sunPct: g.data[k], earthPct: g.data[nn + k], psr: g.data[2 * nn + k] === 1 };
}

export interface Nearby { lat: number; lonE: number; km: number; bearing: string; sunPct: number; earthPct: number; here: { sunPct: number; earthPct: number }; dxM: number; dyM: number }

/** The best pixel within `radiusKm` of the inset centre, scoring weightSun x sun + (1 - weightSun) x Earth. */
export function bestNearby(inset: IllumInset, radiusKm: number, weightSun = 0.5): Nearby | null {
  const { n, spacingM: sp, halfWidthM: half, data } = inset, nn = n * n, mid = (n - 1) / 2;
  const here = { sunPct: data[Math.round(mid) * n + Math.round(mid)], earthPct: data[nn + Math.round(mid) * n + Math.round(mid)] };
  let best = -1, bk = -1, bd = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const dx = c * sp - half, dy = half - r * sp, d = Math.hypot(dx, dy) / 1000;
    if (d > radiusKm + 1e-9) continue;
    const k = r * n + c, score = weightSun * data[k] + (1 - weightSun) * data[nn + k];
    if (score > best + 1e-9 || (Math.abs(score - best) < 1e-9 && d < bd)) { best = score; bk = k; bd = d; }
  }
  if (bk < 0) return null;
  const r = Math.floor(bk / n), c = bk % n;
  const p = xyToLatLon(inset.cx + c * sp - half, inset.cy + half - r * sp), o = xyToLatLon(inset.cx, inset.cy);
  return { lat: p.lat, lonE: p.lonE, km: bd, bearing: bearing8(o, p), sunPct: data[bk], earthPct: data[nn + bk], here, dxM: c * sp - half, dyM: half - r * sp };
}

// ---- loaders (browser) ----

interface IllumMeta { n: number; halfWidthM: number; spacingM: number; bin: string; inset: { halfWidthM: number; n: number; spacingM: number } }
let meta: Promise<IllumMeta> | null = null;
let grid: Promise<IllumGrid | null> | null = null;
const insets = new Map<string, Promise<IllumInset | null>>();

const getMeta = () => (meta ??= fetch('data/illum.json').then((r) => r.json()));

export function loadIllumGrid(): Promise<IllumGrid | null> {
  return (grid ??= getMeta().then(async (m) => ({ n: m.n, halfWidthM: m.halfWidthM, spacingM: m.spacingM, data: new Uint8Array(await (await fetch(m.bin)).arrayBuffer()) })).catch(() => null));
}

export function loadInset(url: string, lat: number, lonE: number): Promise<IllumInset | null> {
  if (!insets.has(url)) {
    insets.set(url, getMeta().then(async (m) => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const { x, y } = latLonToXY(lat, lonE);
      return { ...m.inset, cx: x, cy: y, data: new Uint8Array(await res.arrayBuffer()) };
    }).catch(() => null));
  }
  return insets.get(url)!;
}
