// Terrain horizon masks. Presets ship masks at observer heights 0, 2, 5, 10, 20, 50 m (pipeline/horizon.py);
// heights in between are interpolated (the skyline only drops as the observer rises). Custom points are
// ray-marched in the browser on the 480 m tile with the same geometry as the pipeline.
import type { DemGrid, HorizonProfile } from './types';

export const R_M = 1737400;
export const N_AZ = 720;
export const HEIGHTS_M = [0, 2, 5, 10, 20, 50];
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function dipDeg(heightM: number): number { return Math.acos(R_M / (R_M + Math.max(0, heightM))) * R2D; }

export function elevationDeg(distM: number, terrainM: number, observerM: number): number {
  const th = distM / R_M, rt = R_M + terrainM;
  return Math.atan2(rt * Math.cos(th) - (R_M + observerM), rt * Math.sin(th)) * R2D;
}

/** Smooth-sphere horizon (no terrain): the skyline sits at minus the geometric dip. */
export function flatProfile(siteId: string, elevM = 0): HorizonProfile {
  return {
    siteId, elevM, heightsM: HEIGHTS_M.slice(), azStepDeg: 0.5,
    maskDeg: HEIGHTS_M.map((h) => new Array(N_AZ).fill(-dipDeg(h))),
    distKm: new Array(N_AZ).fill(Math.sqrt(2 * R_M * 2) / 1000), coverage: 1, resM: 0, source: 'flat',
  };
}

/** The 720-direction skyline for an observer `heightM` above the ground. */
export function maskForHeight(p: HorizonProfile, heightM: number): Float32Array {
  const hs = p.heightsM, h = Math.max(hs[0], Math.min(hs[hs.length - 1], heightM));
  let k = 0;
  while (k < hs.length - 2 && h > hs[k + 1]) k++;
  const f = hs[k + 1] === hs[k] ? 0 : (h - hs[k]) / (hs[k + 1] - hs[k]);
  const a = p.maskDeg[k], b = p.maskDeg[k + 1], out = new Float32Array(N_AZ);
  for (let i = 0; i < N_AZ; i++) out[i] = a[i] + (b[i] - a[i]) * f;
  return out;
}

/** Skyline elevation toward azimuth `az`, linear between the 0.5-degree bins (wraps at 360). */
export function maskAt(mask: Float32Array, az: number): number {
  const x = (((az % 360) + 360) % 360) * (N_AZ / 360), i0 = Math.floor(x) % N_AZ, f = x - Math.floor(x);
  return mask[i0] * (1 - f) + mask[(i0 + 1) % N_AZ] * f;
}

// ---- custom points on the 480 m tile ----

export function latLonToXY(lat: number, lonE: number): { x: number; y: number } {
  const rho = 2 * R_M * Math.tan(((90 - Math.abs(lat)) * D2R) / 2);
  return { x: rho * Math.sin(lonE * D2R), y: rho * Math.cos(lonE * D2R) };
}

export function xyToLatLon(x: number, y: number): { lat: number; lonE: number } {
  const rho = Math.hypot(x, y);
  return { lat: -(90 - 2 * Math.atan(rho / (2 * R_M)) * R2D), lonE: Math.atan2(x, y) * R2D };
}

export function demHeight(dem: DemGrid, lat: number, lonE: number): number | null {
  const { x, y } = latLonToXY(lat, lonE);
  return bilinear(dem, (x - dem.x0M) / dem.scaleM, (dem.y0M - y) / dem.scaleM);
}

function bilinear(dem: DemGrid, col: number, row: number): number | null {
  if (!(col >= 0 && row >= 0 && col <= dem.width - 1 && row <= dem.height - 1)) return null;
  const c0 = Math.min(Math.floor(col), dem.width - 2), r0 = Math.min(Math.floor(row), dem.height - 2);
  const fc = col - c0, fr = row - r0, w = dem.width, d = dem.data;
  const v = (d[r0 * w + c0] * (1 - fc) + d[r0 * w + c0 + 1] * fc) * (1 - fr) + (d[(r0 + 1) * w + c0] * (1 - fc) + d[(r0 + 1) * w + c0 + 1] * fc) * fr;
  return v * dem.heightScale;
}

/** A terrain sampler: height (m above the 1737.4 km sphere) at a latitude/longitude and the step to take there, or null
 *  where no terrain data is loaded. */
export type TerrainSampler = (latDeg: number, lonDeg: number) => { z: number; stepM: number } | null;

/** Ray-march 720 directions to `maxRangeM` over any terrain sampler; returns masks for every standard observer height.
 *  Rays start at `startM` (the site's own pixel encodes only its slope) and advance half the local pixel size. */
export function profileFromSampler(sample: TerrainSampler, siteId: string, lat: number, lonE: number, maxRangeM = 300000,
  startM?: number, source: HorizonProfile['source'] = 'lola1900'): HorizonProfile {
  const here = sample(lat, lonE), elev = here?.z ?? 0, res = here?.stepM ?? 950;
  const start = startM ?? 2 * res;
  const p1 = lat * D2R, l1 = lonE * D2R, sp1 = Math.sin(p1), cp1 = Math.cos(p1);
  const masks = HEIGHTS_M.map(() => new Array<number>(N_AZ).fill(-90));
  const dist = new Array<number>(N_AZ).fill(0);
  let reached = 0;
  for (let k = 0; k < N_AZ; k++) {
    const a = (k * 360 / N_AZ) * D2R, sa = Math.sin(a), ca = Math.cos(a);
    let out = false, d = start;
    while (d <= maxRangeM) {
      const th = d / R_M, st = Math.sin(th), ct = Math.cos(th);
      const sp2 = Math.max(-1, Math.min(1, sp1 * ct + cp1 * st * ca));
      const p2 = Math.asin(sp2), l2 = l1 + Math.atan2(sa * st * cp1, ct - sp1 * sp2);
      const hit = sample(p2 * R2D, l2 * R2D);
      if (hit === null) { out = true; break; }
      const rt = R_M + hit.z, h0 = rt * ct, h1 = rt * st;
      for (let j = 0; j < HEIGHTS_M.length; j++) {
        const el = Math.atan2(h0 - (R_M + elev + HEIGHTS_M[j]), h1) * R2D;
        if (el > masks[j][k]) { masks[j][k] = el; if (j === 1) dist[k] = d / 1000; }
      }
      d += hit.stepM / 2;
    }
    if (!out) reached++;
  }
  return { siteId, elevM: Math.round(elev * 10) / 10, heightsM: HEIGHTS_M.slice(), azStepDeg: 0.5, maskDeg: masks, distKm: dist, coverage: reached / N_AZ, resM: res, source };
}

/** Sampler over polar stereographic tiles, near-first (480 m tile, then the 960 m far-field tile). */
export function polarSampler(dems: DemGrid | DemGrid[]): TerrainSampler {
  const tiles = Array.isArray(dems) ? dems : [dems];
  return (la, lo) => {
    if (la > -60) return null;
    const { x, y } = latLonToXY(la, lo);
    for (const d of tiles) {
      const z = bilinear(d, (x - d.x0M) / d.scaleM, (d.y0M - y) / d.scaleM);
      if (z !== null) return { z, stepM: d.scaleM };
    }
    return null;
  };
}

/** Ray-march on the polar tiles (custom points near the south pole); same geometry as the 240 m pipeline. */
export function profileFromDem(dems: DemGrid | DemGrid[], siteId: string, lat: number, lonE: number, maxRangeM = 300000): HorizonProfile {
  const tiles = Array.isArray(dems) ? dems : [dems];
  return profileFromSampler(polarSampler(tiles), siteId, lat, lonE, maxRangeM, Math.max(480, tiles[0].scaleM), 'lola480');
}
