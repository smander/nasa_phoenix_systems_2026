import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/horizons.json';
import { bodyFixedMatrix, moonCentred, siteFrame, sunEarthAt, topocentric } from './ephemeris';

const wrap = (d: number) => ((d + 540) % 360) - 180;

describe('Sun and Earth vs JPL Horizons (lunar surface observer)', () => {
  let worst = { el: 0, az: 0, range: 0 };
  for (const c of fixtures.cases) {
    it(`${c.site} ${c.body} ${c.rows[0].utc}`, () => {
      for (const r of c.rows) {
        const s = sunEarthAt(Date.parse(r.utc), c.lat, c.lonE, 0);
        const b = c.body === 'sun' ? s.sun : s.earth;
        const dEl = Math.abs(b.el - r.elDeg);
        const dAz = Math.abs(wrap(b.az - r.azDeg)) * Math.cos((r.elDeg * Math.PI) / 180);
        const dR = Math.abs(b.rangeKm - r.rangeKm) / r.rangeKm;
        worst = { el: Math.max(worst.el, dEl), az: Math.max(worst.az, dAz), range: Math.max(worst.range, dR) };
        expect(dEl).toBeLessThan(0.01);
        expect(dAz).toBeLessThan(0.01);
        expect(dR).toBeLessThan(0.001);
      }
    });
  }
  it('reports the worst residuals', () => {
    console.log('worst residuals vs Horizons: el %s deg, az*cos(el) %s deg, range %s', worst.el.toFixed(5), worst.az.toFixed(5), worst.range.toExponential(2));
    expect(worst.el).toBeLessThan(0.01);
  });
});

describe('frame and parallax', () => {
  it('body-fixed matrix is a rotation', () => {
    const m = bodyFixedMatrix(Date.UTC(2027, 0, 16));
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    expect(det).toBeCloseTo(1, 9);
  });
  it('topocentric Earth sits about 0.255 deg lower than the Moon-centred direction near the pole', () => {
    const ms = Date.UTC(2026, 9, 11);
    const mc = moonCentred(ms);
    const f = siteFrame(-89.9, 0, 0);
    const topo = topocentric(mc.earth, f).el;
    const centred = topocentric(mc.earth, { ...f, pos: [0, 0, 0] }).el;
    expect(centred - topo).toBeGreaterThan(0.245);
    expect(centred - topo).toBeLessThan(0.265);
  });
  it('the pole itself gives finite angles', () => {
    const s = sunEarthAt(Date.UTC(2027, 0, 1), -90, 0, 0);
    expect(Number.isFinite(s.sun.az) && Number.isFinite(s.earth.el)).toBe(true);
  });
  it('Earth phase is between 0 and 1 and disc sizes are right', () => {
    const s = sunEarthAt(Date.UTC(2027, 0, 16, 16), -85.9799, -0.2558, 4815);
    expect(s.earth.lit).toBeGreaterThanOrEqual(0); expect(s.earth.lit).toBeLessThanOrEqual(1);
    expect(s.sun.radiusDeg).toBeGreaterThan(0.26); expect(s.sun.radiusDeg).toBeLessThan(0.275);
    expect(s.earth.radiusDeg).toBeGreaterThan(0.89); expect(s.earth.radiusDeg).toBeLessThan(1.03);
  });
});
