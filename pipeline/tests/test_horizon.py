from __future__ import annotations

import unittest

import numpy as np

from pipeline import horizon, lola


def synthetic(peak=None):
    """A 1001 x 1001 grid at 240 m centred on the pole, flat at 0 m, optionally with a square peak."""
    n = 1001
    dem = np.zeros((n, n), dtype=np.float32)
    lbl = {'MAP_SCALE': 240.0, 'LINE_PROJECTION_OFFSET': (n - 1) / 2, 'SAMPLE_PROJECTION_OFFSET': (n - 1) / 2}
    if peak:
        lat, lon, height = peak
        x, y = lola.latlon_to_xy(lat, lon)
        r, c = lola.xy_to_pixel(x, y, lbl)
        r, c = int(round(float(r))), int(round(float(c)))
        dem[r - 3:r + 4, c - 3:c + 4] = height
    return dem, lbl


class Masks(unittest.TestCase):
    def test_flat_ground_gives_geometric_dip(self):
        dem, lbl = synthetic()
        out = horizon.horizon_masks(dem, lbl, -89.0, 30.0, heights_m=(0.0, 10.0), max_range_m=60000)
        m10 = np.array(out['maskDeg'][1])
        dip = np.degrees(np.arccos(lola.R_M / (lola.R_M + 10.0)))
        # on a smooth sphere the skyline from 10 m sits close to -dip (bounded by the ray length)
        self.assertTrue(np.all(m10 < 0))
        self.assertLess(abs(float(np.median(m10)) + dip), 0.12)

    def test_single_peak_appears_in_its_direction(self):
        # a 1 km peak ~20 km grid-north of a site at the pole meridian
        site = (-89.0, 0.0)
        peak_lat = -89.0 + 20000 / lola.R_M * 180 / np.pi
        dem, lbl = synthetic((peak_lat, 0.0, 1000.0))
        out = horizon.horizon_masks(dem, lbl, site[0], site[1], heights_m=(0.0,), max_range_m=60000)
        m = np.array(out['maskDeg'][0])
        expected = horizon.elevation_deg(20000.0, 1000.0, 0.0)
        self.assertAlmostEqual(float(m[0]), float(expected), delta=0.25)
        self.assertLess(float(np.median(m)), 0.1)

    def test_higher_observer_never_raises_the_horizon(self):
        dem, lbl = synthetic((-88.9, 10.0, 800.0))
        out = horizon.horizon_masks(dem, lbl, -89.0, 0.0, max_range_m=60000)
        m = np.array(out['maskDeg'])
        self.assertTrue(np.all(np.diff(m, axis=0) <= 1e-9))


if __name__ == '__main__':
    unittest.main()


class GlobalMasks(unittest.TestCase):
    def test_flat_world_gives_geometric_dip(self):
        dem16 = np.zeros((2880, 5760), dtype=np.float32)
        dem, lbl = synthetic()
        out = horizon.horizon_masks_any(dem, lbl, dem16, 10.0, 20.0, heights_m=(0.0, 10.0), max_range_m=60000)
        dip = np.degrees(np.arccos(lola.R_M / (lola.R_M + 10.0)))
        self.assertAlmostEqual(float(np.median(out['maskDeg'][1])), -dip, delta=0.03)
        self.assertEqual(out['resM'], 1895.21)

    def test_wraps_across_the_antimeridian(self):
        dem16 = np.zeros((2880, 5760), dtype=np.float32)
        dem16[1400:1480, 5755:5760] = 3000.0   # a ridge just west of 0/360 E
        dem16[1400:1480, 0:5] = 3000.0          # continuing east of it
        dem, lbl = synthetic()
        out = horizon.horizon_masks_any(dem, lbl, dem16, 0.0, -1.0, heights_m=(2.0,), max_range_m=100000)
        east = out['maskDeg'][0][180]  # azimuth 90 (east) looks across 0 E
        self.assertGreater(east, 0.5)


@unittest.skipUnless((lola.RAW_DIR / 'ldem_16.img').exists(), 'global LOLA model not downloaded')
class GlobalReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dem16 = lola.read_global(lola.RAW_DIR / 'ldem_16.img')

    def test_known_heights(self):
        self.assertAlmostEqual(float(lola.sample_global(self.dem16, 0.6742, 23.4731)), -1920, delta=150)   # Tranquility Base
        self.assertLess(float(lola.sample_global(self.dem16, -45.4561, 177.5886)), -5000)                   # Von Karman floor

    def test_apollo_15_sees_the_apennines(self):
        dem, lbl = synthetic()
        out = horizon.horizon_masks_any(dem, lbl, self.dem16, 26.1322, 3.6339, heights_m=(2.0,))
        self.assertGreater(max(out['maskDeg'][0]), 1.0)
