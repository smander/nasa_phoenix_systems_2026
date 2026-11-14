from __future__ import annotations
import json, math, sys, base64, io
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image

DEM_PATH = sys.argv[1]
R = 1737400.0
N = 3812; SCALE = 240.0; OFF = 1905.5
dem = np.fromfile(DEM_PATH, dtype='<i2').reshape(N, N).astype(np.float32) * 0.5

def latlon_to_px(lat, lon):
    lat = np.asarray(lat, dtype=np.float64); lon = np.asarray(lon, dtype=np.float64)
    rho = 2 * R * np.tan(np.radians(90 - np.abs(lat)) / 2)
    x = rho * np.sin(np.radians(lon)); y = rho * np.cos(np.radians(lon))
    return -y / SCALE + OFF, x / SCALE + OFF   # row, col

def sample(lat, lon):
    r, c = latlon_to_px(lat, lon)
    return map_coordinates(dem, [r.ravel(), c.ravel()], order=1, mode='constant', cval=np.nan).reshape(np.shape(r))

def destination(lat, lon, az, d_m):
    p1 = np.radians(lat); l1 = np.radians(lon); th = d_m / R; a = np.radians(az)
    p2 = np.arcsin(np.sin(p1) * np.cos(th) + np.cos(p1) * np.sin(th) * np.cos(a))
    l2 = l1 + np.arctan2(np.sin(a) * np.sin(th) * np.cos(p1), np.cos(th) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 180) % 360 - 180

SITES = [
  ("malapert-massif", "Malapert Massif", -85.9799, -0.2558, "Artemis region (2022 & 2024)"),
  ("connecting-ridge-c1", "Connecting Ridge C1", -89.4398, -137.17, "Reference peak (Gläser 2018)"),
  ("shackleton-rim", "Shackleton rim", -89.7849, -156.03, "Reference point (Gläser 2018)"),
  ("mons-mouton", "Mons Mouton", -85.4258, 31.8273, "Artemis region (2024)"),
  ("haworth", "Haworth", -86.7530, -23.6718, "Artemis region (2022 & 2024)"),
  ("de-gerlache-rim-2", "de Gerlache Rim 2", -88.2226, -63.4349, "Artemis region (2022 & 2024)"),
]
NB = 720
az = np.arange(NB) * 0.5
d = np.arange(2 * SCALE, 300000.0, SCALE / 2)
out = []
for sid, name, lat, lon, grp in SITES:
    if lat < -89.9999: lat = -89.9999
    zs = float(sample(np.array([lat]), np.array([lon]))[0])
    A, Dm = np.meshgrid(az, d, indexing='ij')
    la, lo = destination(lat, lon, A, Dm)
    zt = sample(la, lo)
    th = Dm / R
    ho = zs + 2.0
    el = np.degrees(np.arctan2((R + zt) * np.cos(th) - (R + ho), (R + zt) * np.sin(th)))
    el = np.where(np.isnan(el), -90, el)
    k = np.argmax(el, axis=1)
    idx = np.arange(NB)
    out.append(dict(id=sid, name=name, lat=round(lat, 4), lonE=round(lon, 4), group=grp, elevM=round(zs, 1),
                    dKm=[round(float(v) / 1000, 2) for v in Dm[idx, k]],
                    hT=[round(float(v), 1) for v in zt[idx, k]],
                    el2m=[round(float(v), 3) for v in el[idx, k]]))
    print(name, 'elev', round(zs), 'mask range', round(float(el[idx, k].min()), 2), round(float(el[idx, k].max()), 2), file=sys.stderr)

# relief image: square centred on the pole, half-width 175 km, 560 px
HALF = 175000.0; PX = 560
xs = np.linspace(-HALF, HALF, PX); ys = np.linspace(HALF, -HALF, PX)
X, Y = np.meshgrid(xs, ys)
rows = -Y / SCALE + OFF; cols = X / SCALE + OFF
z = map_coordinates(dem, [rows.ravel(), cols.ravel()], order=1).reshape(PX, PX)
res = 2 * HALF / (PX - 1)
gy, gx = np.gradient(z, res)
slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
azr = np.radians(315); alt = np.radians(40)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(azr - aspect)
hs = np.clip(hs, 0, 1)
zn = (z - np.percentile(z, 1)) / (np.percentile(z, 99) - np.percentile(z, 1))
zn = np.clip(zn, 0, 1)
v = np.clip(0.18 + 0.62 * hs + 0.20 * zn, 0, 1)
img = Image.fromarray((v * 255).astype(np.uint8), 'L')
buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
relief = dict(halfWidthM=HALF, px=PX, png='data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
print('relief png bytes', len(buf.getvalue()), file=sys.stderr)
json.dump(dict(sites=out, relief=relief), open(sys.argv[2] if len(sys.argv) > 2 else 'terrain.json', 'w'))
