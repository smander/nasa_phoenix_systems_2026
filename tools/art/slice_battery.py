# Slice design/assets/battery-states.jpg into four battery status images.
# Usage: .venv/bin/python tools/art/slice_battery.py design/assets/battery-states.jpg public/battery

import sys
from PIL import Image
import numpy as np
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); A = np.asarray(im).astype(float)
cuts = [0, 515, 984, 1453, 1935]
names = ['battery-low', 'battery-50', 'battery-80', 'battery-full']
for k, name in enumerate(names):
    x0, x1 = cuts[k], cuts[k + 1]
    im.crop((x0, 200, x1, 1075)).save(f'{out}/{name}-tile.jpg', quality=92)
    a = A[200:950, x0:x1]
    mn = a.min(2); mx = a.max(2); sat = mx - mn
    light = mn > 150
    lab, n = ndimage.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outer = np.isin(lab, list(border))
    # local background (gradient + vignette): blur of neutral outer pixels
    w = (outer & (sat < 20)).astype(float)
    num = ndimage.gaussian_filter(mn * w, 30); den = ndimage.gaussian_filter(w, 30)
    bg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 244)
    bg = np.maximum(bg, 200)
    al = np.clip((bg - mn) / (bg - 55), 0, 1)
    al = np.where(sat < 25, np.clip((al - 0.12) / 0.88, 0, 1), al)
    # glass interiors: large light regions not touching the border -> translucent, like the 50% one
    sizes = ndimage.sum(np.ones_like(mn), lab, index=np.arange(n + 1))
    interior = light & ~outer & (sizes[lab] > 2500) & (sat < 35)
    # glow just outside the object: saturated light pixels near the outer region
    near = ndimage.binary_dilation(outer, iterations=18)
    glow = near & (sat > 45) & (mx > 170) & ~outer
    unblend = outer | interior | glow
    # far from any object, neutral background is fully transparent
    obj = ~(outer & (sat < 25) & (al < 0.35))
    far = ndimage.distance_transform_edt(~obj) > 24
    al = np.where(far & (sat < 40), 0, al)
    alpha = np.where(unblend, al, 1.0)
    alpha = np.where(interior, np.maximum(alpha, 0.18), alpha)  # keep a hint of glass
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    bgc = bg[..., None]
    col = (a - (1 - alpha[..., None]) * bgc) / np.maximum(alpha[..., None], 0.02)
    col = np.where(alpha[..., None] > 0.02, col, 0)
    rgba = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba)
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    img = img.crop(bb); img.save(f'{out}/{name}.png', optimize=True)
    print(name, img.size)
