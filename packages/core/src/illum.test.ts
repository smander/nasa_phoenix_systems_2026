import { describe, expect, it } from 'vitest';
import { latLonToXY } from './horizon';
import { bestNearby, illumAt } from './illum';
import type { IllumGrid, IllumInset } from './illum';

// 3 x 3 grid at 1 km around the pole: layers sun %, Earth %, permanent shadow
const grid: IllumGrid = { n: 3, halfWidthM: 1000, spacingM: 1000, data: Uint8Array.from([
  10, 20, 30, 40, 50, 60, 70, 80, 90,   // sun
  1, 2, 3, 4, 5, 6, 7, 8, 9,            // earth
  0, 0, 0, 0, 1, 0, 0, 0, 0,            // psr
]) };

describe('illumAt', () => {
  it('reads the pixel at the pole', () => {
    expect(illumAt(grid, -90, 0)).toEqual({ sunPct: 50, earthPct: 5, psr: true });
  });
  it('is null outside the grid and north of the maps', () => {
    expect(illumAt(grid, -89, 0)).toBeNull();
    expect(illumAt(grid, 10, 0)).toBeNull();
  });
});

describe('bestNearby', () => {
  // 5 x 5 inset at 1 km centred on a site 30 km from the pole; one bright pixel 1 km "up" (+Y) and 1 km right (+X)
  const c = latLonToXY(-89, 0);
  const sun = new Uint8Array(25).fill(40), earth = new Uint8Array(25).fill(40);
  sun[1 * 5 + 3] = 95; earth[1 * 5 + 3] = 90;
  sun[0] = 100; earth[0] = 100; // brighter, but 2.8 km away
  const inset: IllumInset = { n: 5, halfWidthM: 2000, spacingM: 1000, cx: c.x, cy: c.y, data: Uint8Array.from([...sun, ...earth]) };
  it('finds the best spot within the radius', () => {
    const b = bestNearby(inset, 2)!;
    expect(b.sunPct).toBe(95);
    expect(b.earthPct).toBe(90);
    expect(b.km).toBeCloseTo(Math.SQRT2, 1);
    expect(b.here).toEqual({ sunPct: 40, earthPct: 40 });
  });
  it('reaches the far corner only with a larger radius', () => {
    expect(bestNearby(inset, 3)!.sunPct).toBe(100);
  });
});
