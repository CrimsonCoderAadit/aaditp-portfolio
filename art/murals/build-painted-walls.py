"""Crops the painted murals to their walls' exact proportions and writes the
runtime textures: a full-width WebP for desktop and a half-width one for small
screens. Sources stay in art/murals/source; runtime files go to public/murals.

Usage: python art/murals/build-painted-walls.py  (needs Pillow with WebP)
"""
from PIL import Image

ROOM_HEIGHT = 4.7 - .035
WALLS = {
    # name: (source, wall width in scene units, vertical anchor 0 = top .. 1 = bottom)
    "back-wall-galactic": ("art/murals/source/back-wall-galactic.png", 13.8, .35),
    "left-wall-starfield": ("art/murals/source/left-wall-starfield.png", 9.25, .35),
}

for name, (source, width, anchor) in WALLS.items():
    try:
        image = Image.open(source).convert("RGB")
    except FileNotFoundError:
        continue
    aspect = width / ROOM_HEIGHT
    w, h = image.size
    if w / h < aspect:
        keep = round(w / aspect)
        top = round((h - keep) * anchor)
        image = image.crop((0, top, w, top + keep))
    else:
        keep = round(h * aspect)
        left = round((w - keep) / 2)
        image = image.crop((left, 0, left + keep, h))
    image.save(f"public/murals/{name}.webp", quality=90, method=6)
    half = image.resize((image.width // 2, image.height // 2), Image.LANCZOS)
    half.save(f"public/murals/{name}-small.webp", quality=88, method=6)
    print(name, image.size, half.size)
