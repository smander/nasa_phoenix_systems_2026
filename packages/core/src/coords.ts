// Coordinates typed by people, and the global LOLA terrain tiles (ldem_16: 16 px/deg, 15 x 15 degree tiles) that let
// any point on the Moon be analysed in the browser.
import type { TerrainSampler } from './horizon';

const PPD = 16, TILE_DEG = 15, TILE_PX = PPD * TILE_DEG, R_KM = 1737.4;

/** One coordinate: "-84.5", "84.5S", "84.5 S", "84.5° S", "S 84.5". `pos`/`neg` are the hemisphere letters. */
function parseOne(text: string, pos: string, neg: string, max: number, name: string): number | { error: string } {
  const t = text.trim().toUpperCase().replace(/°/g, ' ').replace(/\s+/g, ' ');
  if (!t) return { error: `Enter a ${name}.` };
  const m = /^([NSEW])?\s*([+-]?\d+(?:\.\d+)?)\s*([NSEW])?$/.exec(t);
  if (!m) return { error: `${name[0].toUpperCase() + name.slice(1)} must be a number, e.g. ${name === 'latitude' ? '-84.5 or 84.5 S' : '29.2 or 29.2 E'}.` };
  const letter = m[1] || m[3];
  if (letter && letter !== pos && letter !== neg) return { error: `Use ${pos} or ${neg} for ${name}.` };
  let v = +m[2];
  if (letter) { if (v < 0) return { error: `Use either a minus sign or ${neg}, not both.` }; if (letter === neg) v = -v; }
  if (Math.abs(v) > max) return { error: `${name[0].toUpperCase() + name.slice(1)} must be between -${max} and ${max}.` };
  return v;
}

/** Parse typed latitude and longitude; longitude is returned in (-180, 180]. */
export function parseCoord(latText: string, lonText: string): { lat: number; lonE: number } | { error: string } {
  const lat = parseOne(latText, 'N', 'S', 90, 'latitude');
  if (typeof lat !== 'number') return lat;
  const lon = parseOne(lonText, 'E', 'W', 360, 'longitude');
  if (typeof lon !== 'number') return lon;
  let l = ((lon % 360) + 360) % 360; if (l > 180) l -= 360; if (l === -180) l = 180;
  return { lat, lonE: Math.round(l * 1e9) / 1e9 };
}

/** Keys "lat0_lon0" (northern and western edges) of the 15-degree tiles a disc of `rangeKm` around the point touches. */
export function tilesFor(lat: number, lonE: number, rangeKm: number): string[] {
  const dLat = (rangeKm / R_KM) * (180 / Math.PI) + 0.5;
  const lo = Math.max(-90, lat - dLat), hi = Math.min(90, lat + dLat);
  const cosMin = Math.cos((Math.min(89.9, Math.max(Math.abs(lo), Math.abs(hi))) * Math.PI) / 180);
  const dLon = Math.max(-1, Math.abs(hi) >= 89.5 || Math.abs(lo) >= 89.5 ? 361 : dLat / cosMin);
  const keys = new Set<string>();
  for (let band = 90; band > -90; band -= TILE_DEG) {
    if (band - TILE_DEG > hi || band < lo) continue;
    if (dLon >= 180) { for (let l0 = 0; l0 < 360; l0 += TILE_DEG) keys.add(`${band}_${l0}`); continue; }
    for (let l = lonE - dLon; l <= lonE + dLon + 1e-9; l += 1) {
      const w = ((Math.floor(((l % 360) + 360) % 360 / TILE_DEG) * TILE_DEG) % 360);
      keys.add(`${band}_${w}`);
    }
    const wEnd = ((Math.floor((((lonE + dLon) % 360) + 360) % 360 / TILE_DEG) * TILE_DEG) % 360);
    keys.add(`${band}_${wEnd}`);
  }
  return [...keys];
}

/** Bilinear heights (m) from loaded global tiles (int16, 0.5 m units), wrapping in longitude; null where a tile is missing. */
export function globalSampler(tiles: Map<string, Int16Array>, stepM = 1895.21): TerrainSampler {
  const px = (row: number, col: number): number | null => {
    const r = Math.max(0, Math.min(180 * PPD - 1, row)), c = ((col % (360 * PPD)) + 360 * PPD) % (360 * PPD);
    const t = tiles.get(`${90 - Math.floor(r / TILE_PX) * TILE_DEG}_${Math.floor(c / TILE_PX) * TILE_DEG}`);
    return t ? t[(r % TILE_PX) * TILE_PX + (c % TILE_PX)] * 0.5 : null;
  };
  return (lat, lon) => {
    const row = (90 - lat) * PPD - 0.5, col = ((((lon % 360) + 360) % 360) * PPD) - 0.5;
    const r0 = Math.floor(row), c0 = Math.floor(col), fr = row - r0, fc = col - c0;
    const a = px(r0, c0), b = px(r0, c0 + 1), c = px(r0 + 1, c0), d = px(r0 + 1, c0 + 1);
    if (a === null || b === null || c === null || d === null) return null;
    return { z: (a * (1 - fc) + b * fc) * (1 - fr) + (c * (1 - fc) + d * fc) * fr, stepM };
  };
}

// ---- loader (browser) ----
const tileCache = new Map<string, Promise<Int16Array | null>>();

/** Fetch the tiles around a point (cached); resolves to the map the sampler reads. */
export async function loadGlobalTiles(lat: number, lonE: number, rangeKm = 300): Promise<Map<string, Int16Array>> {
  const keys = tilesFor(lat, lonE, rangeKm), out = new Map<string, Int16Array>();
  await Promise.all(keys.map(async (k) => {
    if (!tileCache.has(k)) tileCache.set(k, fetch(`data/global16/${k}.bin`).then(async (r) => (r.ok ? new Int16Array(await r.arrayBuffer()) : null)).catch(() => null));
    const t = await tileCache.get(k)!;
    if (t) out.set(k, t);
  }));
  return out;
}
