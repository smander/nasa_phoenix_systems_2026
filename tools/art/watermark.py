# Mark the team's AI-generated artwork (made with Google Gemini) as required by the Space Apps SI rules:
# a visible "AI-generated · Gemini" watermark on every image big enough to read it, and a note in the file's
# metadata on every image. Images already marked are skipped, so running it twice changes nothing.
# Usage: python3 tools/art/watermark.py
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

ROOT = Path(__file__).resolve().parents[2]
NOTE = 'AI-generated with Google Gemini (Phoenix Systems artwork)'
MARK = 'AI-generated · Gemini'
MIN_VISIBLE = 160  # narrower images (favicons, HUD layers) get the metadata note; the app labels them on screen
# logos: the mark goes on a strip added under the artwork, so it never covers the lettering
STRIP = {'design/brand/phoenix-systems-logo.jpg', 'apps/web/public/brand/phoenix-systems-logo.png'}

VISIBLE = [
    'design/brand/phoenix-systems-logo.jpg',
    'design/assets/battery-states.jpg',
    'design/assets/battery-states-preview.jpg',
    'design/assets/dish-states.jpg',
    'apps/web/public/brand/phoenix-systems-logo.png',
    'apps/web/public/brand/phoenix-emblem-512.png',
    'apps/web/public/brand/phoenix-emblem-192.png',
    *[f'apps/web/public/battery/battery-{s}{e}' for s in ('50', '80', 'full', 'low') for e in ('.png', '-tile.jpg')],
    *[f'apps/web/public/dish/dish-{s}{e}' for s in ('active', 'inactive') for e in ('.png', '-tile.jpg')],
]
METADATA_ONLY = [
    'apps/web/public/brand/phoenix-emblem-96.png',
    'apps/web/public/battery/art-base.webp',
    *[f'apps/web/public/battery/art-fill-{c}.webp' for c in ('red', 'amber', 'green')],
    'apps/web/public/dish/dish-active.webp',
    'apps/web/public/dish/dish-inactive.webp',
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for f in ('/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def marked(im: Image.Image) -> bool:
    return NOTE in str(im.info.get('Comment', '')) or NOTE in str(im.info.get('comment', b''), 'utf8', 'ignore') \
        or NOTE.encode() in im.info.get('exif', b'')


def draw_mark(im: Image.Image, strip: bool = False) -> Image.Image:
    rgba = im.convert('RGBA')
    w, h = rgba.size
    size = max(11, round(w * 0.028))
    if strip:
        grown = Image.new('RGBA', (w, h + round(size * 1.9)), rgba.getpixel((0, h - 1)))
        grown.paste(rgba, (0, 0))
        rgba, h = grown, grown.height
    f = font(size)
    layer = Image.new('RGBA', rgba.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    stroke = max(1, size // 9)
    box = d.textbbox((0, 0), MARK, font=f, stroke_width=stroke)
    pad = max(4, round(w * 0.015))
    xy = (w - (box[2] - box[0]) - pad, h - (box[3] - box[1]) - pad)
    d.text(xy, MARK, font=f, fill=(255, 255, 255, 215), stroke_width=stroke, stroke_fill=(0, 0, 0, 170))
    return Image.alpha_composite(rgba, layer)


def save(im: Image.Image, path: Path, keep_alpha: bool) -> None:
    ext = path.suffix.lower()
    if ext == '.png':
        info = PngImagePlugin.PngInfo()
        info.add_text('Comment', NOTE)
        info.add_text('Software', 'Google Gemini (generation); Pillow (watermark)')
        im.save(path, pnginfo=info, optimize=True)
    elif ext in ('.jpg', '.jpeg'):
        im.convert('RGB').save(path, quality=92, optimize=True, progressive=True, comment=NOTE.encode())
    elif ext == '.webp':
        exif = Image.Exif()
        exif[0x010E] = NOTE  # ImageDescription
        exif[0x0131] = 'Google Gemini'  # Software
        im.save(path, quality=90, method=6, exif=exif.tobytes(), lossless=False)
    else:
        raise ValueError(path)


def main() -> None:
    for rel, visible in [(p, True) for p in VISIBLE] + [(p, False) for p in METADATA_ONLY]:
        path = ROOT / rel
        im = Image.open(path)
        if marked(im):
            print(f'  already marked  {rel}')
            continue
        alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
        out = draw_mark(im, rel in STRIP) if visible and im.width >= MIN_VISIBLE else im
        if not alpha and out.mode == 'RGBA':
            out = out.convert('RGB')
        save(out, path, alpha)
        print(f'  {"watermark + note" if out is not im else "note only      "}  {rel}')


if __name__ == '__main__':
    main()
