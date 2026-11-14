import { describe, expect, it } from 'vitest';
import { siteFrame } from '@core/ephemeris';
import { latLonToXY } from '@core/horizon';
import { buildLocalGrid, localFrame, polarFrame } from './terrainFrame';

const flat = { n: 3, half: 1, sp: 1, h: new Float32Array(9) };

describe('terrain frames', () => {
  it('polar frame matches the pole-centred projection used so far', () => {
    const f = polarFrame(flat), p = f.toXY(-86, 30), q = latLonToXY(-86, 30);
    expect(p.x).toBeCloseTo(q.x / 1000, 6);
    expect(p.y).toBeCloseTo(q.y / 1000, 6);
    const back = f.fromXY(p.x, p.y);
    expect(back.lat).toBeCloseTo(-86, 6);
    expect(f.bodyRaw([0, 0, -1])).toEqual([0, 0, 1]); // up at the south pole is body -z
  });
  it('local frame puts the site at the origin with north up and east right', () => {
    const site = { lat: 26.13, lonE: 3.63 }, f = localFrame(site, flat);
    const o = f.toXY(site.lat, site.lonE);
    expect(Math.hypot(o.x, o.y)).toBeLessThan(1e-9);
    const north = f.toXY(site.lat + 10 / 30.3233, site.lonE);
    expect(north.x).toBeCloseTo(0, 6);
    expect(north.y).toBeCloseTo(10, 2);
    const east = f.toXY(site.lat, site.lonE + 0.5);
    expect(east.x).toBeGreaterThan(0);
    const back = f.fromXY(north.x, north.y);
    expect(back.lat).toBeCloseTo(site.lat + 10 / 30.3233, 6);
  });
  it('local frame maps the site zenith to up', () => {
    const site = { lat: -45.46, lonE: 177.59 }, f = localFrame(site, flat), up = siteFrame(site.lat, site.lonE).up;
    const r = f.bodyRaw(up);
    expect(r[0]).toBeCloseTo(0, 9); expect(r[1]).toBeCloseTo(0, 9); expect(r[2]).toBeCloseTo(1, 9);
  });
  it('builds a site-centred height grid from a sampler', () => {
    const g = buildLocalGrid({ lat: 0, lonE: 0 }, (lat) => ({ z: lat > 0 ? 1000 : 0, stepM: 1895 }), 10, 5);
    expect(g.n).toBe(5);
    expect(g.h[0]).toBe(1);          // row 0 is the northern edge: 1000 m = 1 km
    expect(g.h[4 * 5]).toBe(0);      // southern edge
  });
});
