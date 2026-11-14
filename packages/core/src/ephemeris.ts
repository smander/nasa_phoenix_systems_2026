// Sun and Earth as seen from a point on the lunar surface.
// astronomy-engine supplies Moon-centred light-time + aberration corrected vectors (BackdatePosition) and the
// IAU/WGCCRE lunar orientation (RotationAxis, TT-based). We rotate into the Moon's body-fixed frame,
// subtract the site position (topocentric parallax: ~0.25 deg for Earth) and project onto east/north/up.
// Validated against JPL Horizons (packages/core/fixtures/horizons.json).
import { BackdatePosition, Body, KM_PER_AU, MakeTime, RotationAxis, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';

export const R_MOON_KM = 1737.4;
export const R_EARTH_KM = 6371.0084;
export const R_SUN_KM = 695700;
export const POLE_LAT = -89.9999;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

function rz(t: number): Mat3 { const c = Math.cos(t), s = Math.sin(t); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; }
function rx(t: number): Mat3 { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, s], [0, -s, c]]; }
function mul(a: Mat3, b: Mat3): Mat3 {
  const r: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return r;
}
function apply(m: Mat3, v: Vec3): Vec3 {
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
}

/** ICRF -> lunar body-fixed rotation: M = Rz(W) Rx(90 - dec0) Rz(90 + ra0), passive matrices. */
export function bodyFixedMatrix(ms: number): Mat3 {
  const ax = RotationAxis(Body.Moon, MakeTime(new Date(ms)));
  return mul(rz(ax.spin * D2R), mul(rx((90 - ax.dec) * D2R), rz((90 + ax.ra * 15) * D2R)));
}

/** Moon-centred body-fixed vectors (km) to the Sun and Earth, and the Sun distance in AU. */
export function moonCentred(ms: number): { sun: Vec3; earth: Vec3; sunDistAU: number } {
  const t = MakeTime(new Date(ms));
  const m = bodyFixedMatrix(ms);
  const s = BackdatePosition(t, Body.Moon, Body.Sun, true);
  const e = BackdatePosition(t, Body.Moon, Body.Earth, true);
  return {
    sun: apply(m, [s.x * KM_PER_AU, s.y * KM_PER_AU, s.z * KM_PER_AU]),
    earth: apply(m, [e.x * KM_PER_AU, e.y * KM_PER_AU, e.z * KM_PER_AU]),
    sunDistAU: Math.hypot(s.x, s.y, s.z),
  };
}

/** Local east/north/up basis and position for a site; latitude -90 is clamped so north is the 0 E meridian. */
export function siteFrame(lat: number, lonE: number, heightM = 0) {
  const la = Math.max(lat, POLE_LAT) * D2R, lo = lonE * D2R;
  const up: Vec3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const r = R_MOON_KM + heightM / 1000;
  return { up, east, north, pos: [up[0] * r, up[1] * r, up[2] * r] as Vec3 };
}

export interface AzElRange { az: number; el: number; rangeKm: number }

/** Azimuth clockwise from north, elevation above the local horizontal plane, and range (km). */
export function topocentric(v: Vec3, f: ReturnType<typeof siteFrame>): AzElRange {
  const d: Vec3 = [v[0] - f.pos[0], v[1] - f.pos[1], v[2] - f.pos[2]];
  const e = d[0] * f.east[0] + d[1] * f.east[1] + d[2] * f.east[2];
  const n = d[0] * f.north[0] + d[1] * f.north[1] + d[2] * f.north[2];
  const u = d[0] * f.up[0] + d[1] * f.up[1] + d[2] * f.up[2];
  return { az: ((Math.atan2(e, n) * R2D) % 360 + 360) % 360, el: Math.atan2(u, Math.hypot(e, n)) * R2D, rangeKm: Math.hypot(d[0], d[1], d[2]) };
}

export function angularRadiusDeg(radiusKm: number, rangeKm: number): number { return Math.asin(Math.min(1, radiusKm / rangeKm)) * R2D; }

/** Fraction of Earth's disc that looks sunlit from the site: (1 - cos(angle Sun-site-Earth)) / 2. */
export function earthLitFraction(sun: Vec3, earth: Vec3, f: ReturnType<typeof siteFrame>): number {
  const a: Vec3 = [sun[0] - f.pos[0], sun[1] - f.pos[1], sun[2] - f.pos[2]];
  const b: Vec3 = [earth[0] - f.pos[0], earth[1] - f.pos[1], earth[2] - f.pos[2]];
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  return (1 - c) / 2;
}

/** Convenience: everything about the Sun and Earth at one instant for one site. */
export function sunEarthAt(ms: number, lat: number, lonE: number, heightM = 0) {
  const mc = moonCentred(ms), f = siteFrame(lat, lonE, heightM);
  const sun = topocentric(mc.sun, f), earth = topocentric(mc.earth, f);
  return {
    sun: { ...sun, radiusDeg: angularRadiusDeg(R_SUN_KM, sun.rangeKm), distAU: mc.sunDistAU },
    earth: { ...earth, radiusDeg: angularRadiusDeg(R_EARTH_KM, earth.rangeKm), lit: earthLitFraction(mc.sun, mc.earth, f) },
  };
}

/** Greenwich apparent sidereal angle in degrees (Earth's rotation), for orienting the Earth globe. */
export function greenwichSiderealDeg(ms: number): number { return SiderealTime(MakeTime(new Date(ms))) * 15; }

/** ICRF (J2000) -> Earth-fixed rotation: precession and nutation to the true equator of date, then Earth's
 *  rotation by the Greenwich apparent sidereal angle. v_earthFixed = R v_icrf. */
export function icrfToEarthFixed(ms: number): number[][] {
  const t = MakeTime(new Date(ms));
  const r = Rotation_EQJ_EQD(t).rot; // astronomy-engine convention: v'_j = sum_i rot[i][j] v_i
  const pn = [[r[0][0], r[1][0], r[2][0]], [r[0][1], r[1][1], r[2][1]], [r[0][2], r[1][2], r[2][2]]];
  const th = SiderealTime(t) * 15 * D2R, c = Math.cos(th), s = Math.sin(th);
  const rz = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
  return rz.map((row) => pn[0].map((_, j) => row[0] * pn[0][j] + row[1] * pn[1][j] + row[2] * pn[2][j]));
}
