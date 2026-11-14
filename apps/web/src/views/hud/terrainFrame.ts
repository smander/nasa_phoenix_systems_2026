// How the 3D Mission view maps the Moon onto its flat scene. Positions are kilometres in a frame (x, y) with "up" out of
// the surface; Terrain3D turns them into world space (x, K·up, -y). Two frames:
//   polar: centred on the south pole, x toward 90° E, y toward 0° E (the LOLA polar stereographic grid, as before);
//   local: centred on any site, azimuthal equidistant, x east, y north, built from NASA's global terrain tiles.
import { siteFrame } from '@core/ephemeris';
import { latLonToXY, xyToLatLon } from '@core/horizon';
import type { TerrainSampler } from '@core/horizon';

const R_KM = 1737.4, D2R = Math.PI / 180, R2D = 180 / Math.PI;

/** n x n heights (km above the 1737.4 km sphere) over ±half km; row 0 = +y, column 0 = -x. */
export interface Grid { n: number; half: number; sp: number; h: Float32Array }
type V3 = [number, number, number];

export interface TerrainFrame {
  key: string;
  kind: 'polar' | 'local';
  grid: Grid;
  toXY: (lat: number, lonE: number) => { x: number; y: number };
  fromXY: (x: number, y: number) => { lat: number; lonE: number };
  /** A Moon body-fixed direction as frame components [x, y, up] (unit-free, unstretched). */
  bodyRaw: (v: V3) => V3;
  /** Rows mapping body-fixed vectors to unstretched scene axes (scene x, scene y = up, scene z = -y). */
  sceneFromBody: number[][];
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function polarFrame(grid: Grid): TerrainFrame {
  return {
    key: 'polar', kind: 'polar', grid,
    toXY: (lat, lonE) => { const p = latLonToXY(lat, lonE); return { x: p.x / 1000, y: p.y / 1000 }; },
    fromXY: (x, y) => xyToLatLon(x * 1000, y * 1000),
    // map x (90 E) = body +y, map y (0 E) = body +x, up at the south pole = body -z
    bodyRaw: (v) => [v[1], v[0], -v[2]],
    sceneFromBody: [[0, 1, 0], [0, 0, -1], [-1, 0, 0]],
  };
}

/** Site-centred azimuthal equidistant frame: x east, y north (km), up = the site's zenith. */
export function localFrame(site: { lat: number; lonE: number }, grid: Grid): TerrainFrame {
  const f = siteFrame(site.lat, site.lonE), E = f.east as V3, N = f.north as V3, U = f.up as V3;
  const p1 = site.lat * D2R, l1 = site.lonE * D2R, sp1 = Math.sin(p1), cp1 = Math.cos(p1);
  return {
    key: `local:${site.lat.toFixed(4)}:${site.lonE.toFixed(4)}`, kind: 'local', grid,
    toXY: (lat, lonE) => {
      const p2 = lat * D2R, dl = lonE * D2R - l1;
      const c = Math.max(-1, Math.min(1, sp1 * Math.sin(p2) + cp1 * Math.cos(p2) * Math.cos(dl)));
      const d = Math.acos(c) * R_KM;
      if (d < 1e-9) return { x: 0, y: 0 };
      const b = Math.atan2(Math.sin(dl) * Math.cos(p2), cp1 * Math.sin(p2) - sp1 * Math.cos(p2) * Math.cos(dl));
      return { x: d * Math.sin(b), y: d * Math.cos(b) };
    },
    fromXY: (x, y) => {
      const th = Math.hypot(x, y) / R_KM, b = Math.atan2(x, y), st = Math.sin(th), ct = Math.cos(th);
      const sp2 = sp1 * ct + cp1 * st * Math.cos(b), p2 = Math.asin(Math.max(-1, Math.min(1, sp2)));
      const l2 = l1 + Math.atan2(Math.sin(b) * st * cp1, ct - sp1 * sp2);
      return { lat: p2 * R2D, lonE: ((((l2 * R2D) + 180) % 360) + 360) % 360 - 180 };
    },
    bodyRaw: (v) => [dot(v, E), dot(v, N), dot(v, U)],
    sceneFromBody: [E, U, N.map((c) => -c)],
  };
}

/** Heights around a site from a terrain sampler: n x n over ±half km (row 0 = north edge), in km. */
export function buildLocalGrid(site: { lat: number; lonE: number }, sample: TerrainSampler, half = 240, n = 253): Grid {
  const sp = (2 * half) / (n - 1), f = localFrame(site, { n: 1, half: 0, sp: 1, h: new Float32Array(1) }), h = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const ll = f.fromXY(-half + c * sp, half - r * sp), s = sample(ll.lat, ll.lonE);
    h[r * n + c] = s ? s.z / 1000 : 0;
  }
  return { n, half, sp, h };
}
