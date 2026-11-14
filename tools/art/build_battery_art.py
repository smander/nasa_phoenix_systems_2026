# Build the live battery artwork for the Power system panel from the 100% tile of
# design/assets/battery-states.jpg. One fixed frame (shell + solar panel) plus the cell stack as
# separate layers in green / amber / red, all on the same canvas, so only the lit cells change.
# Usage: .venv/bin/python tools/art/build_battery_art.py design/assets/battery-states.jpg public/battery
# Writes the layers to apps/web/public/battery and the clip geometry to apps/web/src/views/hud/battery-art.json.
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = 1453, 200, 1935, 950           # the 100% tile in the source image
a = np.asarray(Image.open(src).convert('RGB').crop((X0, Y0, X1, Y1))).astype(float)
H, W = a.shape[:2]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mn, mx = a.min(2), a.max(2); sat = mx - mn
yy, xx = np.mgrid[0:H, 0:W]

# --- background removal (unblend from the light grid background), as in slice_battery.py
light = mn > 150
lab, n = ndimage.label(light)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
outer = np.isin(lab, list(border))
w = (outer & (sat < 20)).astype(float)
bg = np.where(ndimage.gaussian_filter(w, 30) > 1e-3, ndimage.gaussian_filter(mn * w, 30) / np.maximum(ndimage.gaussian_filter(w, 30), 1e-3), 244)
bg = np.maximum(bg, 200)
al = np.clip((bg - mn) / (bg - 55), 0, 1)
al = np.where(sat < 25, np.clip((al - 0.12) / 0.88, 0, 1), al)
sizes = ndimage.sum(np.ones_like(mn), lab, index=np.arange(n + 1))
interior = light & ~outer & (sizes[lab] > 2500) & (sat < 35)
glow = ndimage.binary_dilation(outer, iterations=18) & (sat > 45) & (mx > 170) & ~outer
obj = ~(outer & (sat < 25) & (al < 0.35))
al = np.where((ndimage.distance_transform_edt(~obj) > 24) & (sat < 40), 0, al)
alpha = np.where(outer | interior | glow, al, 1.0)
alpha = np.where(interior, np.maximum(alpha, 0.18), alpha)
alpha = ndimage.gaussian_filter(alpha, 0.7)
col = np.where(alpha[..., None] > 0.02, (a - (1 - alpha[..., None]) * bg[..., None]) / np.maximum(alpha[..., None], 0.02), 0)
col = np.clip(col, 0, 255)

# --- the cell stack inside the glass
green = (g > r + 40) & (g > b + 25)
box = (xx >= 222) & (xx <= 394) & (yy >= 100) & (yy <= 392)
fill = ndimage.binary_fill_holes(ndimage.binary_closing(green & box, structure=np.ones((11, 3))))
fill = ndimage.binary_opening(fill, iterations=1) & box
fillA = ndimage.gaussian_filter(fill.astype(float), 0.8)

# --- shell: unlit cells as dim glass segments, every other green accent made neutral
lum = (0.3 * col[..., 0] + 0.59 * col[..., 1] + 0.11 * col[..., 2])[..., None]
grey = np.repeat(lum, 3, axis=2)
gacc = ((col[..., 1] > col[..., 0] + 30) & (col[..., 1] > col[..., 2] + 20)) & ~fill
# small green specks (particles, the "100%" label and icon) above the panel go away
glab, gn = ndimage.label(ndimage.binary_dilation(gacc, iterations=2))
gsz = ndimage.sum(np.ones_like(mn), glab, index=np.arange(gn + 1))
speck = gacc & (gsz[glab] < 900) & (yy < 520)
label_zone = (xx < 215) & (yy > 240) & (yy < 340)       # the "100%" readout left of the battery
shell = col.copy(); sa = alpha.copy()
shell[gacc] = grey[gacc] * 0.85 + 20                    # cable: neutral metal
solid = alpha > 0.9
sa[gacc & ~solid] = 0                                    # green glow: removed (the page draws a live glow)
sa[ndimage.binary_dilation(speck | (label_zone & gacc), iterations=4) & ~(solid & ~gacc & ~(label_zone))] = 0
sa[outer & (sat < 30) & (alpha < 0.6) & ~gacc] = 0         # grey drop-shadow haze on the old background
ghost = grey * 0.42 + np.array([18, 24, 30])            # dark cool glass with the cell relief
shell = shell * (1 - fillA[..., None]) + ghost * fillA[..., None]
sa = sa * (1 - fillA) + 0.55 * fillA

def rgba(c, al):
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8))

base = rgba(shell, sa)
bbox = base.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
cx0, cy0, cx1, cy1 = bbox
scale = 340 / (cy1 - cy0)
size = (round((cx1 - cx0) * scale), 340)
base.crop(bbox).resize(size, Image.LANCZOS).save(f'{out}/art-base.webp', quality=86, method=6)

# --- fill layers: green is the original; amber and red map the cells' brightness onto a colour ramp
L = lum[..., 0]; lo, hi = np.percentile(L[fill], 2), np.percentile(L[fill], 99.5)
t = np.clip((L - lo) / (hi - lo), 0, 1)[..., None]
def ramp(stops):
    xs = np.array([p for p, _ in stops]); cs = np.array([c for _, c in stops], float)
    return np.stack([np.interp(t[..., 0], xs, cs[:, k]) for k in range(3)], axis=2)
layers = {
    'green': col,
    'amber': ramp([(0, (70, 30, 0)), (0.45, (235, 120, 0)), (0.75, (255, 190, 40)), (1, (255, 246, 205))]),
    'red': ramp([(0, (60, 0, 4)), (0.45, (215, 30, 24)), (0.75, (255, 84, 60)), (1, (255, 215, 200))]),
}
for name, c in layers.items():
    rgba(c, fillA).crop(bbox).resize(size, Image.LANCZOS).save(f'{out}/art-fill-{name}.webp', quality=88, method=6)

# --- geometry for the live clip, in the output pixel space
seps = [140, 182, 224, 265, 307, 348]                   # separator lines at the stack centre (x = 308)
geo = {
    'width': size[0], 'height': size[1],
    'cx': round((308 - cx0) * scale, 2), 'rx': round(92 * scale, 2), 'sag': round(46 * scale, 2),
    'seps': [round((y - cy0) * scale, 2) for y in seps],
    'left': round((218 - cx0) * scale, 2), 'right': round((398 - cx0) * scale, 2),
    'bottom': round((396 - cy0) * scale, 2), 'glowY': round((372 - cy0) * scale, 2),
}
json.dump(geo, open('apps/web/src/views/hud/battery-art.json', 'w'), indent=1)
print(geo)
