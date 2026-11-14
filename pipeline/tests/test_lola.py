from __future__ import annotations

import unittest

import numpy as np

from pipeline import lola


class Projection(unittest.TestCase):
    def test_round_trip(self):
        rng = np.random.default_rng(1)
        lat = rng.uniform(-89.99, -75, 200)
        lon = rng.uniform(-180, 180, 200)
        x, y = lola.latlon_to_xy(lat, lon)
        lat2, lon2 = lola.xy_to_latlon(x, y)
        np.testing.assert_allclose(lat2, lat, atol=1e-9)
        np.testing.assert_allclose(((lon2 - lon + 180) % 360) - 180, 0, atol=1e-9)

    def test_orientation_convention(self):
        # 0 E is up (+y), 90 E is right (+x); 85 S lies 2R tan(2.5 deg) from the pole
        x, y = lola.latlon_to_xy(-85.0, 0.0)
        self.assertAlmostEqual(float(x), 0.0, places=6)
        self.assertAlmostEqual(float(y), 2 * lola.R_M * np.tan(np.radians(2.5)), places=3)
        x, y = lola.latlon_to_xy(-85.0, 90.0)
        self.assertGreater(float(x), 150000)

    def test_label_parse(self):
        import tempfile, pathlib
        p = pathlib.Path(tempfile.mkdtemp()) / 'x.lbl'
        p.write_text('LINES = 3812\n MAP_SCALE = 240 <m/pix>\n MAP_PROJECTION_TYPE = "POLAR STEREOGRAPHIC"\n')
        d = lola.parse_label(p)
        self.assertEqual(d['LINES'], 3812.0)
        self.assertEqual(d['MAP_SCALE'], 240.0)
        self.assertEqual(d['MAP_PROJECTION_TYPE'], 'POLAR STEREOGRAPHIC')


@unittest.skipUnless((lola.RAW_DIR / 'ldem_75s_240m.img').exists(), 'LOLA DEM not downloaded')
class DemOrientation(unittest.TestCase):
    """A mirrored projection would put Cabeus on a mountain (+6390 m); these must hold."""

    @classmethod
    def setUpClass(cls):
        cls.lbl = lola.parse_label(lola.RAW_DIR / 'ldem_75s_240m.lbl')
        cls.dem = lola.read_dem(lola.RAW_DIR / 'ldem_75s_240m.img', cls.lbl)

    def h(self, lat, lon):
        return float(lola.sample(self.dem, self.lbl, np.array([lat]), np.array([lon]))[0])

    def test_crater_floors_are_low(self):
        for lat, lon in [(-89.67, 129.78), (-88.137, 45.911), (-85.3303, -42.1327), (-87.1832, 84.3099), (-87.45, -5.17)]:
            self.assertLess(self.h(lat, lon), -2000, (lat, lon))

    def test_massifs_are_high(self):
        for lat, lon in [(-85.9799, -0.2558), (-85.4258, 31.8273)]:
            self.assertGreater(self.h(lat, lon), 4000, (lat, lon))


if __name__ == '__main__':
    unittest.main()


@unittest.skipUnless((lola.RAW_DIR / 'illum' / 'avgvisib_65s_240m_201608.img').exists(), 'illumination maps not downloaded')
class Illumination(unittest.TestCase):
    """NASA LOLA average visibility maps: scaling, coverage and orientation."""

    @classmethod
    def setUpClass(cls):
        files = lola.download_illumination()
        cls.maps = {k: (lola.read_scaled(i, lola.parse_label(l)), lola.parse_label(l)) for k, (i, l) in files.items()}

    def value(self, key, lat, lon):
        arr, lbl = self.maps[key]
        return float(lola.sample_map(arr, lbl, lat, lon))

    def test_label_scaling(self):
        lbl = self.maps['sun'][1]
        self.assertAlmostEqual(float(lbl['SCALING_FACTOR']), 0.00004)
        self.assertAlmostEqual(float(lbl['LINE_PROJECTION_OFFSET']), 3209.5)

    def test_values_are_fractions(self):
        v = self.value('sun', -89.9, 0)
        self.assertTrue(0.0 <= v <= 1.0)

    def test_outside_coverage_is_nan(self):
        self.assertTrue(np.isnan(self.value('sun', -50.0, 0.0)))
        self.assertTrue(np.isnan(self.value('sun', 60.0, 0.0)))

    def test_orientation_shadowed_floors_lit_rims(self):
        # a mirrored or rotated projection would put the shadow somewhere else
        self.assertEqual(self.value('psr', -89.67, 129.8), 1.0)        # Shackleton crater floor
        self.assertEqual(self.value('sun', -89.67, 129.8), 0.0)
        self.assertGreater(self.value('sun', -89.44, -137.2), 0.7)     # Connecting Ridge peak C1
