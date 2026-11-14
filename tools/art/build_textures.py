# Turn the downloaded NASA imagery (public domain) into the web textures in public/textures.
# Usage: .venv/bin/python -I tools/art/build_textures.py <download dir> public/textures
#   world.topo.bathy.200401.3x5400x2700.jpg  Blue Marble: Next Generation, January 2004 (NASA Earth Observatory)
#   BlackMarble_2016_01deg.jpg                Black Marble 2016 night lights (NASA Earth Observatory)
#   cloud_combined_2048.jpg                   cloud cover (NASA Visible Earth)
#   latest_1024_HMIIC.jpg                     the Sun in visible light, SDO/HMI intensitygram (NASA SDO)
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = 60_000_000
src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
SIZE = (2048, 1024)

day = Image.open(src / 'world.topo.bathy.200401.3x5400x2700.jpg').convert('RGB').resize(SIZE, Image.LANCZOS)
day.save(out / 'earth-day.jpg', quality=86, optimize=True, progressive=True)

night = np.asarray(Image.open(src / 'BlackMarble_2016_01deg.jpg').convert('RGB').resize(SIZE, Image.LANCZOS)).astype(float) / 255
# city lights only: warm (red/green) light above the dim blue land and ice, as a greyscale glow map
lights = night[..., 0] * 0.6 + night[..., 1] * 0.4 - night[..., 2] * 0.25
lights = np.clip((lights - 0.09) / 0.55, 0, 1) ** 1.1
Image.fromarray((lights * 255).astype(np.uint8)).save(out / 'earth-night.jpg', quality=85, optimize=True, progressive=True)

clouds = Image.open(src / 'cloud_combined_2048.jpg').convert('L').resize(SIZE, Image.LANCZOS)
clouds.save(out / 'earth-clouds.jpg', quality=76, optimize=True, progressive=True)

# Sun: cut the solar disc out of the SDO frame (largest bright blob, ignores the caption text)
sun = Image.open(src / 'latest_1024_HMIIC.jpg').convert('RGB')
a = np.asarray(sun).astype(float)
lab, n = ndimage.label(a.max(2) > 30)
sizes = ndimage.sum(np.ones(lab.shape), lab, index=np.arange(n + 1)); sizes[0] = 0
disc = lab == sizes.argmax()
ys, xs = np.nonzero(disc)
cy, cx, r = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2, max(ys.max() - ys.min(), xs.max() - xs.min()) / 2
box = tuple(int(round(v)) for v in (cx - r, cy - r, cx + r, cy + r))
crop = sun.crop(box).resize((512, 512), Image.LANCZOS)
yy, xx = np.mgrid[0:512, 0:512]
d = np.hypot(xx - 255.5, yy - 255.5) / 256
alpha = np.clip((1.0 - d) / 0.012, 0, 1)                              # soft 1.2% edge
rgba = np.dstack([np.asarray(crop), (alpha * 255).astype(np.uint8)])
Image.fromarray(rgba).save(out / 'sun-disc.webp', quality=88, method=6)
for f in sorted(out.iterdir()): print(f.name, f.stat().st_size)
