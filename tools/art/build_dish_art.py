# Build the Earth-link dish artwork from design/assets/dish-states.jpg (left: active, right: inactive).
# The inactive drawing is aligned onto the active one (shift + slight shear, found by edge correlation),
# the light background is removed, and both are written on the same canvas so only the state changes.
# Usage: .venv/bin/python tools/art/build_dish_art.py design/assets/dish-states.jpg public/dish
# Writes the two layers to apps/web/public/dish and the wave geometry to apps/web/src/views/hud/dish-art.json.
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
A = np.asarray(Image.open(src).convert('RGB')).astype(float)
Y0, Y1, X0, X1 = 110, 950, 230, 1010                    # frame around the active dish and its waves
yy, xx = np.mgrid[Y0:Y1, X0:X1]
active = A[Y0:Y1, X0:X1]
Xs = xx + 896 + 0.04 * (yy - 560)                       # where the inactive dish sits in the source
inactive = np.dstack([ndimage.map_coordinates(A[..., c], [yy, Xs], order=1, mode='nearest') for c in range(3)])
Image.fromarray(active.astype(np.uint8)).save(f'{out}/dish-active-tile.jpg', quality=92)
Image.fromarray(inactive.astype(np.uint8)).save(f'{out}/dish-inactive-tile.jpg', quality=92)

def cutout(a, glow, body=None):
    mn, mx = a.min(2), a.max(2); sat = mx - mn; blu = a[..., 2] - a[..., 0]
    light = mn > 150
    lab, _ = ndimage.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outer = np.isin(lab, list(border))
    w = (outer & (sat < 20)).astype(float)
    den = ndimage.gaussian_filter(w, 30)
    bg = np.maximum(np.where(den > 1e-3, ndimage.gaussian_filter(mn * w, 30) / np.maximum(den, 1e-3), 244), 200)
    al = np.clip((bg - mn) / (bg - 55), 0, 1)
    al = np.where(sat < 25, np.clip((al - 0.12) / 0.88, 0, 1), al)
    alpha = np.where(outer, al, 1.0)
    col = np.clip((a - (1 - alpha[..., None]) * bg[..., None]) / np.maximum(alpha[..., None], 0.02), 0, 255)
    solid = ~outer | (al > 0.9)
    if glow:
        # The waves are white arcs inside a blue haze cone. On a dark page: crisp white-cyan arcs,
        # a soft cyan bloom around them, and the haze as a faint blue glow.
        strong = ndimage.uniform_filter((blu > 40).astype(float), 25)
        arcs = outer & ~body & (mn > 222) & (blu < 28) & (strong > 0.3)
        arcs = ndimage.binary_opening(arcs, iterations=1)
        arcA = np.clip(ndimage.gaussian_filter(arcs.astype(float), 1.0) * 1.6, 0, 1)
        bloom = np.clip(ndimage.gaussian_filter(arcs.astype(float), 5) * 1.4, 0, 1) * 0.55
        haze = np.clip((blu - 25) / 70, 0, 1) * 0.4 * outer
        arcC = np.array([232, 246, 255.]); bloomC = np.array([120, 200, 255.]); hazeC = np.array([80, 160, 255.])
        ga = np.maximum.reduce([arcA, bloom, haze])
        gc = np.where((arcA >= np.maximum(bloom, haze))[..., None], arcC, np.where((bloom >= haze)[..., None], bloomC, hazeC))
        use = outer & ~body & (ga > alpha * 0.8)
        col = np.where(use[..., None], gc, col); alpha = np.where(use, ga, alpha)
    else:
        # drop faint specks and the drop shadow; keep the dish and anything attached to it
        alpha = np.where(outer & (al < 0.45), 0, alpha)
        if body is not None:                              # inside the dish silhouette everything is solid
            alpha = np.where(body, 1.0, alpha); col = np.where(body[..., None], a, col)
    lab2, n2 = ndimage.label(alpha > 0.3)
    if n2 and not glow:
        sizes = ndimage.sum(np.ones_like(alpha), lab2, index=np.arange(n2 + 1)); sizes[0] = 0
        alpha = np.where((lab2 > 0) & (sizes[lab2] < 400), 0, alpha)
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    return Image.fromarray(np.dstack([col, np.clip(alpha, 0, 1) * 255]).astype(np.uint8))

off = cutout(inactive, False)
body = ndimage.binary_fill_holes(ndimage.binary_closing(np.asarray(off.getchannel('A')) > 128, iterations=4))
body = ndimage.binary_erosion(body, iterations=2)
on = cutout(active, False, body)                         # the dish body only; the page draws the radio waves
# fixed canvas: both dishes plus room for the waves, which spread up and right from the feed horn
FX, FY = 680 - X0, 378 - Y0                              # wave centre (just behind the feed horn), frame coords
RADII, A0, A1 = [135, 185, 250], -65, 22                 # wave radii (px) and angular span (deg, y down)
bb = [im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for im in (on, off)]
box = [min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb)]
box[1] = min(box[1], int(FY - RADII[-1] * np.sin(np.radians(-A0))) - 14)
box[2] = max(box[2], int(FX + RADII[-1]) + 14)
on, off = on.crop(tuple(box)), off.crop(tuple(box))
on.save(f'{out}/dish-active.png', optimize=True); off.save(f'{out}/dish-inactive.png', optimize=True)
H = 260; sc = H / on.height; size = (round(on.width * sc), H)
on.resize(size, Image.LANCZOS).save(f'{out}/dish-active.webp', quality=86, method=6)
off.resize(size, Image.LANCZOS).save(f'{out}/dish-inactive.webp', quality=86, method=6)
geo = {'width': size[0], 'height': size[1], 'fx': round((FX - box[0]) * sc, 2), 'fy': round((FY - box[1]) * sc, 2),
       'radii': [round(r * sc, 2) for r in RADII], 'a0': A0, 'a1': A1}
json.dump(geo, open('apps/web/src/views/hud/dish-art.json', 'w'), indent=1)
print(geo)
