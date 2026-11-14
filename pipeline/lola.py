"""NASA LRO LOLA polar elevation model: download, PDS3 label parsing, reading and projection.

Product: LOLA GDR ldem_75s_240m (PDS Geosciences), 3812 x 3812 int16 LSB, height = DN * 0.5 m relative to
the 1737.4 km sphere, south polar stereographic, 0 deg longitude up, 90 deg E to the right.
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

R_M = 1737400.0
PRIMARY = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m'
MIRROR = 'http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M'
IMG_BYTES = 29062688
RAW_DIR = Path(__file__).resolve().parent.parent / 'data' / 'raw' / 'lola'


def download(dest_dir: Path = RAW_DIR) -> Tuple[Path, Path]:
    """Download the .img and .lbl if missing or truncated. Returns (img, lbl)."""
    import requests

    dest_dir.mkdir(parents=True, exist_ok=True)
    img = dest_dir / 'ldem_75s_240m.img'
    lbl = dest_dir / 'ldem_75s_240m.lbl'
    for path, suffix, size in ((lbl, '.lbl', None), (img, '.img', IMG_BYTES)):
        if path.exists() and (size is None or path.stat().st_size == size):
            continue
        last_err: Optional[Exception] = None
        for base in (PRIMARY, MIRROR):
            url = base + (suffix.upper() if 'imbrium' in base else suffix)
            try:
                with requests.get(url, stream=True, timeout=120) as r:
                    r.raise_for_status()
                    tmp = path.with_suffix(path.suffix + '.part')
                    with open(tmp, 'wb') as f:
                        for chunk in r.iter_content(1 << 20):
                            f.write(chunk)
                if size is not None and tmp.stat().st_size != size:
                    raise IOError(f'{url}: got {tmp.stat().st_size} bytes, expected {size}')
                tmp.rename(path)
                break
            except Exception as e:  # try the mirror
                last_err = e
        else:
            raise RuntimeError(f'could not download {path.name}: {last_err}')
    return img, lbl


def parse_label(path: Path) -> Dict[str, object]:
    """Parse the KEY = VALUE lines of a PDS3 label; strips <units> and quotes; numbers become float."""
    out: Dict[str, object] = {}
    for line in Path(path).read_text(errors='replace').splitlines():
        m = re.match(r'^\s*([A-Z_][A-Z0-9_:]*)\s*=\s*(.*?)\s*$', line)
        if not m:
            continue
        key, raw = m.group(1), re.sub(r'<[^>]*>', '', m.group(2)).strip().strip('"')
        try:
            out[key] = float(raw)
        except ValueError:
            out[key] = raw
    return out


def read_dem(img: Path, lbl: Dict[str, object]) -> np.ndarray:
    """Heights in metres above the 1737.4 km sphere, float32, shape (LINES, LINE_SAMPLES)."""
    n_lines, n_samples = int(lbl['LINES']), int(lbl['LINE_SAMPLES'])
    data = np.fromfile(img, dtype='<i2', count=n_lines * n_samples).reshape(n_lines, n_samples)
    return data.astype(np.float32) * float(lbl['SCALING_FACTOR'])


def latlon_to_xy(lat, lon_e):
    """South polar stereographic on the sphere: metres, x toward 90 E, y toward 0 E."""
    lat = np.asarray(lat, dtype=np.float64)
    lon = np.radians(np.asarray(lon_e, dtype=np.float64))
    rho = 2 * R_M * np.tan(np.radians(90 - np.abs(lat)) / 2)
    return rho * np.sin(lon), rho * np.cos(lon)


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    lat = -(90 - np.degrees(2 * np.arctan(rho / (2 * R_M))))
    lon = np.degrees(np.arctan2(x, y))
    return lat, lon


def xy_to_pixel(x, y, lbl: Dict[str, object]):
    """0-based (row, col) of pixel centres; col = x/scale + SAMPLE_OFFSET, row = -y/scale + LINE_OFFSET."""
    scale = float(lbl['MAP_SCALE'])
    return -np.asarray(y) / scale + float(lbl['LINE_PROJECTION_OFFSET']), np.asarray(x) / scale + float(lbl['SAMPLE_PROJECTION_OFFSET'])


def sample(dem: np.ndarray, lbl: Dict[str, object], lat, lon_e) -> np.ndarray:
    """Bilinear height at lat/lon; NaN outside the grid."""
    from scipy.ndimage import map_coordinates

    x, y = latlon_to_xy(lat, lon_e)
    r, c = xy_to_pixel(x, y, lbl)
    shape = np.shape(r)
    return map_coordinates(dem, [np.ravel(r), np.ravel(c)], order=1, mode='constant', cval=np.nan).reshape(shape)


def destination(lat, lon_e, bearing_deg, dist_m):
    """Great-circle destination point on the 1737.4 km sphere (vectorised)."""
    p1, l1 = np.radians(lat), np.radians(lon_e)
    th, a = np.asarray(dist_m) / R_M, np.radians(bearing_deg)
    p2 = np.arcsin(np.sin(p1) * np.cos(th) + np.cos(p1) * np.sin(th) * np.cos(a))
    l2 = l1 + np.arctan2(np.sin(a) * np.sin(th) * np.cos(p1), np.cos(th) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 180.0) % 360.0 - 180.0



# ---- NASA LOLA average illumination products (PDS LOLA EXTRAS, "not supported by the PDS or the LOLA Science Team") ----
# Mazarico et al. averages over the long-term lunar precession cycle, 240 m/pixel, polar stereographic to 65 S.
ILLUM_BASE = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/img/'
ILLUM_FILES = {
    'sun': 'avgvisib_65s_240m_201608',          # average fraction of the solar disc visible
    'earth': 'avgvisib_65s_240m_201608_earth',  # average fraction of the Earth disc visible
    'psr': 'lpsr_65s_240m_201608',              # 1 = permanently shadowed
}
ILLUM_BYTES = 6420 * 6420 * 2


def download_illumination(dest_dir: Path = RAW_DIR / 'illum') -> Dict[str, Tuple[Path, Path]]:
    """Download the three south-pole maps if missing or truncated. Returns {name: (img, lbl)}."""
    import requests

    dest_dir.mkdir(parents=True, exist_ok=True)
    out = {}
    for key, stem in ILLUM_FILES.items():
        img, lbl = dest_dir / (stem + '.img'), dest_dir / (stem + '.lbl')
        for path, size in ((lbl, None), (img, ILLUM_BYTES)):
            if path.exists() and (size is None or path.stat().st_size == size):
                continue
            tmp = path.with_suffix(path.suffix + '.part')
            with requests.get(ILLUM_BASE + path.name, stream=True, timeout=120) as r:
                r.raise_for_status()
                with open(tmp, 'wb') as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            if size is not None and tmp.stat().st_size != size:
                raise IOError(f'{path.name}: got {tmp.stat().st_size} bytes, expected {size}')
            tmp.rename(path)
        out[key] = (img, lbl)
    return out


def read_scaled(img: Path, lbl: Dict[str, object]) -> np.ndarray:
    """A polar map product as float32: DN * SCALING_FACTOR + OFFSET (fractions for the illumination maps)."""
    n_lines, n_samples = int(lbl['LINES']), int(lbl['LINE_SAMPLES'])
    data = np.fromfile(img, dtype='<i2', count=n_lines * n_samples).reshape(n_lines, n_samples)
    return data.astype(np.float32) * float(lbl['SCALING_FACTOR']) + float(lbl.get('OFFSET', 0.0))


def sample_map(arr: np.ndarray, lbl: Dict[str, object], lat, lon_e) -> np.ndarray:
    """Bilinear value of a polar map at lat/lon; NaN outside the map (e.g. north of its coverage)."""
    from scipy.ndimage import map_coordinates

    lat = np.asarray(lat, dtype=np.float64)
    x, y = latlon_to_xy(lat, lon_e)
    r, c = xy_to_pixel(x, y, lbl)
    shape = np.shape(r)
    v = map_coordinates(arr, [np.ravel(r), np.ravel(c)], order=1, mode='constant', cval=np.nan).reshape(shape)
    return np.where(lat > 0, np.nan, v)  # the projection would otherwise fold the northern hemisphere onto the map



# ---- NASA LOLA global elevation model, 16 pixels/degree (~1.9 km at the equator), simple cylindrical ----
GLOBAL_URL = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16'
GLOBAL_BYTES = 2880 * 5760 * 2
GLOBAL_PPD = 16


def download_global(dest_dir: Path = RAW_DIR) -> Tuple[Path, Path]:
    import requests

    dest_dir.mkdir(parents=True, exist_ok=True)
    img, lbl = dest_dir / 'ldem_16.img', dest_dir / 'ldem_16.lbl'
    for path, size in ((lbl, None), (img, GLOBAL_BYTES)):
        if path.exists() and (size is None or path.stat().st_size == size):
            continue
        tmp = path.with_suffix(path.suffix + '.part')
        with requests.get(GLOBAL_URL + path.suffix, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(tmp, 'wb') as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        if size is not None and tmp.stat().st_size != size:
            raise IOError(f'{path.name}: got {tmp.stat().st_size} bytes, expected {size}')
        tmp.rename(path)
    return img, lbl


def read_global(img: Path) -> np.ndarray:
    """Heights (m) above the 1737.4 km sphere, (2880, 5760): row 0 at 90 N, column 0 at 0 E, pixel-registered.
    The label's OFFSET is the reference radius, not a height offset, so only SCALING_FACTOR (0.5 m) applies."""
    return np.fromfile(img, dtype='<i2', count=GLOBAL_BYTES // 2).reshape(2880, 5760).astype(np.float32) * 0.5


def sample_global(dem16: np.ndarray, lat, lon_e) -> np.ndarray:
    """Bilinear height from the global model, wrapping in longitude."""
    from scipy.ndimage import map_coordinates

    lat = np.asarray(lat, dtype=np.float64)
    row = np.clip((90.0 - lat) * GLOBAL_PPD - 0.5, 0, dem16.shape[0] - 1)
    col = (np.mod(np.asarray(lon_e, dtype=np.float64), 360.0) * GLOBAL_PPD - 0.5) % dem16.shape[1]
    shape = np.shape(row)
    return map_coordinates(dem16, [np.ravel(row), np.ravel(col)], order=1, mode='grid-wrap').reshape(shape)


if __name__ == '__main__':
    i, l = download()
    print('ok', i, i.stat().st_size, l)
