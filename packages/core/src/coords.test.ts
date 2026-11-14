import { describe, expect, it } from 'vitest';
import { globalSampler, parseCoord, tilesFor } from './coords';
import { dipDeg, flatProfile, maskAt, maskForHeight, profileFromSampler } from './horizon';

describe('parseCoord', () => {
  const ok = (lat: string, lon: string) => parseCoord(lat, lon) as { lat: number; lonE: number };
  it('reads signed decimals and hemisphere letters', () => {
    expect(ok('-84.5', '29.2')).toEqual({ lat: -84.5, lonE: 29.2 });
    expect(ok('84.5S', '29.2E')).toEqual({ lat: -84.5, lonE: 29.2 });
    expect(ok('84.5 S', '29.2 W')).toEqual({ lat: -84.5, lonE: -29.2 });
    expect(ok('0.674° N', '23.47°E')).toEqual({ lat: 0.674, lonE: 23.47 });
  });
  it('normalises longitude to (-180, 180]', () => {
    expect(ok('0', '330.8').lonE).toBeCloseTo(-29.2, 6);
    expect(ok('0', '180').lonE).toBe(180);
    expect(ok('0', '-180').lonE).toBe(180);
    expect(ok('0', '360').lonE).toBe(0);
  });
  it('accepts the poles and rejects nonsense', () => {
    expect(ok('-90', '0').lat).toBe(-90);
    expect(parseCoord('90.1', '0')).toHaveProperty('error');
    expect(parseCoord('abc', '0')).toHaveProperty('error');
    expect(parseCoord('', '10')).toHaveProperty('error');
    expect(parseCoord('10', '400')).toHaveProperty('error');
    expect(parseCoord('-10 N', '0')).toHaveProperty('error');
  });
});

describe('tilesFor', () => {
  it('includes the tile across the antimeridian', () => {
    const k = tilesFor(0, 179, 300);
    expect(k).toContain('15_165');
    expect(k).toContain('15_180');
    expect(k).toContain('0_180');
  });
  it('takes every longitude near a pole', () => {
    expect(tilesFor(-85, 0, 300).filter((x) => x.startsWith('-75_')).length).toBe(24);
  });
});

describe('profileFromSampler', () => {
  it('a flat world gives the geometric dip', () => {
    const p = profileFromSampler(() => ({ z: 0, stepM: 950 }), 'x', 10, 20);
    const m = maskForHeight(p, 10);
    expect(maskAt(m, 45)).toBeCloseTo(maskAt(maskForHeight(flatProfile('x'), 10), 45), 1);
    expect(maskAt(m, 45)).toBeCloseTo(-dipDeg(10), 1);
  });
  it('reads tiled global heights with longitude wrap', () => {
    const tiles = new Map<string, Int16Array>();
    tiles.set('15_345', new Int16Array(240 * 240).fill(2000)); // 1000 m just west of 0 E
    tiles.set('15_0', new Int16Array(240 * 240).fill(4000));   // 2000 m just east of it
    const s = globalSampler(tiles);
    expect(s(5, -1)!.z).toBe(1000);
    expect(s(5, 1)!.z).toBe(2000);
    expect(s(5, 359)!.z).toBe(1000);
    expect(s(-20, 1)).toBeNull(); // tile not loaded
  });
});
