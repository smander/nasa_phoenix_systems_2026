"""Build every data file the web app needs from the LOLA DEM and the curated site list.

Outputs (apps/web/public/data/):
  sites.json                 presets with provenance, elevation, horizon file link
  horizons/<id>.json         720-direction horizon masks at 6 observer heights
  relief.png + relief.json   south-pole relief shading (terrain shape, not lighting) for the map
  dem480.bin + dem480.json   480 m height tile (int16 LE, 0.5 m units) for custom points in the browser
  dem960.bin + dem960.json   960 m far-field tile covering the whole 75S grid (rays that leave the near tile)
"""
from __future__ import annotations

import io
import json
import time
from pathlib import Path

import numpy as np
from PIL import Image

from . import lola
from .horizon import horizon_masks_any

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps' / 'web' / 'public' / 'data'


def build_sites(dem, lbl, dem16) -> None:
    src = json.loads((Path(__file__).parent / 'sites.source.json').read_text())
    (OUT / 'horizons').mkdir(parents=True, exist_ok=True)
    sites = []
    t0 = time.time()
    for s in src['sites']:
        hz = horizon_masks_any(dem, lbl, dem16, s['lat'], s['lonE'])
        hz['siteId'] = s['id']
        (OUT / 'horizons' / f"{s['id']}.json").write_text(json.dumps(hz, separators=(',', ':')))
        entry = dict(s)
        entry['elevM'] = hz['elevM']
        entry['horizonUrl'] = f"data/horizons/{s['id']}.json"
        entry['maxHorizonDeg'] = round(max(hz['maskDeg'][1]), 2)
        sites.append(entry)
        print(f"  {s['id']:<30} res {hz['resM']:>6.0f} m  elev {hz['elevM']:>8.1f} m  horizon max {entry['maxHorizonDeg']:>6.2f} deg  coverage {hz['coverage']}")
    meta = {
        'version': 1,
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'demProduct': 'NASA LRO LOLA GDR ldem_75s_240m (240 m/pixel) near the south pole, ldem_16 (16 px/deg, ~1.9 km) elsewhere; PDS LRO-L-LOLA-4-GDR-V1.0',
        'sites': sites,
    }
    (OUT / 'sites.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(f'  {len(sites)} sites in {time.time() - t0:.1f} s')


def build_relief(dem, lbl, half_m: float = 240000.0, px: int = 720) -> None:
    from scipy.ndimage import map_coordinates

    xs = np.linspace(-half_m, half_m, px)
    ys = np.linspace(half_m, -half_m, px)
    X, Y = np.meshgrid(xs, ys)
    r, c = lola.xy_to_pixel(X, Y, lbl)
    z = map_coordinates(dem, [r.ravel(), c.ravel()], order=1, mode='nearest').reshape(px, px)
    res = 2 * half_m / (px - 1)
    gy, gx = np.gradient(z, res)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = np.radians(315), np.radians(40)
    hs = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    lo, hi = np.percentile(z, 1), np.percentile(z, 99)
    zn = np.clip((z - lo) / (hi - lo), 0, 1)
    v = np.clip(0.16 + 0.64 * hs + 0.20 * zn, 0, 1)
    buf = io.BytesIO()
    Image.fromarray((v * 255).astype(np.uint8), 'L').save(buf, 'PNG', optimize=True)
    (OUT / 'relief.png').write_bytes(buf.getvalue())
    (OUT / 'relief.json').write_text(json.dumps({'halfWidthM': half_m, 'px': px, 'label': 'LOLA relief shading (terrain shape, not lighting)'}))
    print(f'  relief.png {len(buf.getvalue()) // 1024} KB, +/-{half_m / 1000:.0f} km')


def build_terrain3d(dem, lbl, half_m: float = 240000.0, n: int = 321) -> None:
    """Regular n x n height grid (metres, int16 in 0.5 m units) over +/-half_m around the pole for the 3D view.
    Row 0 is +Y (toward 0 deg longitude / Earth), column 0 is -X (toward 90 W)."""
    from scipy.ndimage import map_coordinates, uniform_filter

    xs = np.linspace(-half_m, half_m, n)
    X, Y = np.meshgrid(xs, -xs)  # rows go from +Y to -Y
    r, c = lola.xy_to_pixel(X, Y, lbl)
    spacing = 2 * half_m / (n - 1)
    k = max(1, int(round(spacing / float(lbl['MAP_SCALE']))))
    smooth = uniform_filter(dem, size=k) if k > 1 else dem  # box-average to the grid spacing (no aliasing)
    z = map_coordinates(smooth, [r.ravel(), c.ravel()], order=1, mode='nearest').reshape(n, n)
    q = np.clip(np.round(z / 0.5), -32768, 32767).astype('<i2')
    (OUT / 'terrain3d.bin').write_bytes(q.tobytes())
    (OUT / 'terrain3d.json').write_text(json.dumps({'n': n, 'halfWidthM': half_m, 'spacingM': spacing, 'heightScale': 0.5,
        'rows': 'row 0 = +Y (0 deg longitude), column 0 = -X (90 W)', 'source': 'LOLA ldem_75s_240m, box-averaged', 'bin': 'data/terrain3d.bin'}))
    print(f'  terrain3d.bin {q.nbytes // 1024} KB, {n} x {n} at {spacing:.0f} m, +/-{half_m / 1000:.0f} km')


def build_far_tile(dem, lbl) -> None:
    """4x4 block mean of the whole 240 m grid -> 953 x 953 at 960 m (+/-457 km) for rays that leave the near tile."""
    n240 = dem.shape[0]                      # 3812
    n = n240 // 4                            # 953
    sub = dem[:n * 4, :n * 4]
    tile = sub.reshape(n, 4, n, 4).mean(axis=(1, 3))
    q = np.clip(np.round(tile / 0.5), -32768, 32767).astype('<i2')
    (OUT / 'dem960.bin').write_bytes(q.tobytes())
    off = float(lbl['LINE_PROJECTION_OFFSET'])  # 1905.5 in 240 m pixels
    c0 = (1.5 - off) * 240.0                     # centre of the first 960 m block, metres from the pole
    meta = {'width': n, 'height': n, 'scaleM': 960.0, 'x0M': c0, 'y0M': -c0, 'heightScale': 0.5, 'radiusKm': 1737.4,
            'dtype': 'int16le', 'source': 'LOLA ldem_75s_240m, 4x4 block mean', 'bin': 'data/dem960.bin'}
    (OUT / 'dem960.json').write_text(json.dumps(meta))
    print(f'  dem960.bin {q.nbytes // 1024} KB, {n} x {n} at 960 m')


def build_tile(dem, lbl) -> None:
    """2x2 block mean of the 240 m grid around the pole -> 1267 x 1267 at 480 m; pole at the centre of pixel 633."""
    off = float(lbl['LINE_PROJECTION_OFFSET'])  # 1905.5: the pole is the boundary between rows 1905 and 1906
    half_blocks = 633
    start = int(round(off - 0.5)) - 2 * half_blocks  # 1905 - 1266 = 639
    n = 2 * half_blocks + 1
    sub = dem[start:start + 2 * n, start:start + 2 * n]
    tile = sub.reshape(n, 2, n, 2).mean(axis=(1, 3))
    q = np.clip(np.round(tile / 0.5), -32768, 32767).astype('<i2')
    (OUT / 'dem480.bin').write_bytes(q.tobytes())
    meta = {'width': n, 'height': n, 'scaleM': 480.0, 'x0M': -half_blocks * 480.0, 'y0M': half_blocks * 480.0,
            'heightScale': 0.5, 'radiusKm': 1737.4, 'dtype': 'int16le',
            'source': 'LOLA ldem_75s_240m, 2x2 block mean', 'bin': 'data/dem480.bin'}
    (OUT / 'dem480.json').write_text(json.dumps(meta))
    print(f'  dem480.bin {q.nbytes // 1024} KB, {n} x {n} at 480 m, +/-{half_blocks * 0.48:.0f} km')



ILLUM_RAMPS = {
    'sun': [(0.0, (11, 15, 26)), (0.3, (90, 58, 18)), (0.7, (255, 181, 71)), (1.0, (255, 242, 200))],
    'earth': [(0.0, (11, 15, 26)), (0.3, (18, 52, 94)), (0.7, (79, 168, 255)), (1.0, (221, 238, 255))],
}


def _ramp(v: np.ndarray, stops) -> np.ndarray:
    xs = [p for p, _ in stops]
    return np.stack([np.interp(v, xs, [c[k] for _, c in stops]) for k in range(3)], axis=-1)


def build_illumination(half_map_m: float = 240000.0, map_px: int = 720, half_grid_m: float = 480000.0,
                       inset_half_m: float = 18000.0, inset_n: int = 151) -> None:
    """NASA LOLA average sunlight, Earth visibility and permanent shadow (Mazarico et al., PDS LOLA extras).
    Writes map overlays aligned with relief.png, a 1 km numeric grid for custom points, an 18 km inset per catalogued
    site, and avgSunPct / avgEarthPct / psr on each site in sites.json."""
    from scipy.ndimage import map_coordinates, uniform_filter

    files = lola.download_illumination()
    maps = {}
    for key, (img, lbl_path) in files.items():
        lbl = lola.parse_label(lbl_path)
        maps[key] = (lola.read_scaled(img, lbl), lbl)

    def grid_xy(half: float, n: int, cx: float = 0.0, cy: float = 0.0):
        xs = np.linspace(-half, half, n)
        return np.meshgrid(cx + xs, cy - xs)  # row 0 = +Y (toward 0 deg longitude)

    # 1. map overlays, same window and orientation as relief.png
    X, Y = grid_xy(half_map_m, map_px)
    for key in ('sun', 'earth'):
        arr, lbl = maps[key]
        r, c = lola.xy_to_pixel(X, Y, lbl)
        v = np.clip(map_coordinates(uniform_filter(arr, size=2), [r.ravel(), c.ravel()], order=1).reshape(X.shape), 0, 1)
        rgb = _ramp(v, ILLUM_RAMPS[key])
        rgba = np.dstack([rgb, np.full(v.shape, 225.0)]).astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(OUT / f'illum-{key}.png', optimize=True)
    arr, lbl = maps['psr']
    r, c = lola.xy_to_pixel(X, Y, lbl)
    v = map_coordinates(arr, [r.ravel(), c.ravel()], order=1).reshape(X.shape) > 0.5
    rgba = np.zeros(v.shape + (4,), np.uint8); rgba[v] = (122, 92, 255, 215)
    Image.fromarray(rgba, 'RGBA').save(OUT / 'illum-psr.png', optimize=True)

    # 2. numeric grid for custom points: 961 x 961 at 1 km, 3 layers uint8 (sun %, Earth %, permanent shadow 0/1)
    n = int(round(2 * half_grid_m / 1000)) + 1
    X, Y = grid_xy(half_grid_m, n)
    layers = []
    for key in ('sun', 'earth', 'psr'):
        arr, lbl = maps[key]
        r, c = lola.xy_to_pixel(X, Y, lbl)
        v = map_coordinates(uniform_filter(arr, size=4), [r.ravel(), c.ravel()], order=1).reshape(n, n)
        layers.append((v > 0.5).astype(np.uint8) if key == 'psr' else np.clip(np.round(v * 100), 0, 100).astype(np.uint8))
    np.stack(layers).tofile(OUT / 'illum.bin')

    # 3. per-site insets (native 240 m) and NASA averages on each site
    meta = json.loads((OUT / 'sites.json').read_text())
    (OUT / 'illum').mkdir(exist_ok=True)
    insets = 0
    for s in meta['sites']:
        for k in ('avgSunPct', 'avgEarthPct', 'psr', 'illumInset'):
            s.pop(k, None)
        vals = {k: float(lola.sample_map(maps[k][0], maps[k][1], s['lat'], s['lonE'])) for k in maps}
        if not np.isfinite(vals['sun']):
            continue
        s['avgSunPct'] = round(vals['sun'] * 100, 1)
        s['avgEarthPct'] = round(vals['earth'] * 100, 1)
        s['psr'] = bool(vals['psr'] > 0.5)
        sx, sy = lola.latlon_to_xy(s['lat'], s['lonE'])
        X, Y = grid_xy(inset_half_m, inset_n, float(sx), float(sy))
        inset = []
        for key in ('sun', 'earth'):
            arr, lbl = maps[key]
            r, c = lola.xy_to_pixel(X, Y, lbl)
            inset.append(np.clip(np.round(map_coordinates(arr, [r.ravel(), c.ravel()], order=1).reshape(inset_n, inset_n) * 100), 0, 100).astype(np.uint8))
        np.stack(inset).tofile(OUT / 'illum' / f"{s['id']}.bin")
        s['illumInset'] = f"data/illum/{s['id']}.bin"
        insets += 1
    meta['illumination'] = {
        'product': 'NASA LOLA average visibility of the Sun and Earth and permanently shadowed regions, 240 m/pixel to 65 S '
                   '(PDS LOLA extras illumination, release 2016-08; Mazarico et al.)',
        'groundLevel': True,
    }
    (OUT / 'sites.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    (OUT / 'illum.json').write_text(json.dumps({
        'n': n, 'halfWidthM': half_grid_m, 'spacingM': 1000.0, 'layers': ['sunPct', 'earthPct', 'psr'], 'dtype': 'uint8', 'bin': 'data/illum.bin',
        'map': {'halfWidthM': half_map_m, 'px': map_px, 'png': {'sun': 'data/illum-sun.png', 'earth': 'data/illum-earth.png', 'psr': 'data/illum-psr.png'}},
        'inset': {'halfWidthM': inset_half_m, 'n': inset_n, 'spacingM': 2 * inset_half_m / (inset_n - 1), 'layers': ['sunPct', 'earthPct']},
        'rows': 'row 0 = +Y (0 deg longitude), column 0 = -X (90 W); insets are centred on the site in the same projection',
        'source': 'NASA LRO LOLA avgvisib_65s_240m_201608, avgvisib_65s_240m_201608_earth, lpsr_65s_240m_201608 (ground level)',
    }))
    print(f'  illumination: overlays {map_px} px, grid {n} x {n} at 1 km, {insets} site insets')



def build_global_tiles(dem16, tile_deg: int = 15) -> None:
    """The global model as 15 x 15 degree int16 tiles (0.5 m units) for custom points anywhere: apps/web/public/data/global16/<lat0>_<lon0>.bin,
    lat0 = northern edge (90 ... -75), lon0 = western edge (0 ... 345 E). 240 x 240 pixels, row 0 = north, pixel-registered."""
    out = OUT / 'global16'
    out.mkdir(exist_ok=True)
    px = tile_deg * lola.GLOBAL_PPD
    q = np.clip(np.round(dem16 / 0.5), -32768, 32767).astype('<i2')
    for r0 in range(0, 2880, px):
        for c0 in range(0, 5760, px):
            lat0, lon0 = 90 - r0 // lola.GLOBAL_PPD, c0 // lola.GLOBAL_PPD
            (out / f'{lat0}_{lon0}.bin').write_bytes(q[r0:r0 + px, c0:c0 + px].tobytes())
    (OUT / 'global16.json').write_text(json.dumps({'ppd': lola.GLOBAL_PPD, 'tileDeg': tile_deg, 'px': px, 'heightScale': 0.5,
        'pattern': 'data/global16/{lat0}_{lon0}.bin', 'rows': 'row 0 = northern edge lat0; column 0 = western edge lon0 (0-345 E); pixel-registered',
        'source': 'NASA LRO LOLA ldem_16 (16 px/deg, simple cylindrical, heights relative to 1737.4 km)'}))
    print(f'  global16: {(2880 // px) * (5760 // px)} tiles of {px} x {px}')


def build_moon_relief(dem16, w: int = 2048) -> None:
    """Whole-Moon shaded relief, equirectangular, longitude -180 at the left, 0 in the middle, north up."""
    from scipy.ndimage import zoom

    z = np.roll(dem16, dem16.shape[1] // 2, axis=1)            # columns start at 180 W
    z = zoom(z, w / dem16.shape[1], order=1)
    h, res = z.shape[0], 2 * np.pi * lola.R_M / w
    lat = np.radians(90 - (np.arange(h) + 0.5) * 180 / h)[:, None]
    gy, gx = np.gradient(z, res)
    gx = gx / np.maximum(np.cos(lat), 0.05)                   # east-west pixels shrink toward the poles
    slope, aspect = np.arctan(np.hypot(gx, gy)), np.arctan2(-gx, gy)
    az, alt = np.radians(315), np.radians(35)
    hs = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    zn = np.clip((z - np.percentile(z, 1)) / (np.percentile(z, 99) - np.percentile(z, 1)), 0, 1)
    v = np.clip(0.12 + 0.62 * hs + 0.26 * zn, 0, 1)
    Image.fromarray((v * 255).astype(np.uint8), 'L').save(OUT / 'moon-relief.jpg', quality=84, optimize=True, progressive=True)
    print(f'  moon-relief.jpg {(OUT / "moon-relief.jpg").stat().st_size // 1024} KB, {w} x {h}')


def main() -> None:
    img, lbl_path = lola.download()
    lbl = lola.parse_label(lbl_path)
    dem = lola.read_dem(img, lbl)
    dem16 = lola.read_global(lola.download_global()[0])
    OUT.mkdir(parents=True, exist_ok=True)
    print('sites + horizons'); build_sites(dem, lbl, dem16)
    print('relief'); build_relief(dem, lbl)
    print('480 m tile'); build_tile(dem, lbl)
    print('960 m far tile'); build_far_tile(dem, lbl)
    print('3D terrain grid'); build_terrain3d(dem, lbl)
    print('illumination'); build_illumination()
    print('global tiles'); build_global_tiles(dem16)
    print('whole-Moon relief'); build_moon_relief(dem16)


if __name__ == '__main__':
    main()
