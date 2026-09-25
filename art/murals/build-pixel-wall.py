"""Rebuilds the generated pixel-art panorama on a true square pixel grid.

The generator paints "pixels" on a slightly drifting grid (~5.4 source px per
art pixel). This samples each target cell by the median of its central region,
so drift and soft edges never bleed into neighbours, then reduces the palette
without dithering. Output is a small PNG meant for nearest-neighbour sampling.

Usage: python art/murals/build-pixel-wall.py  (needs numpy + Pillow)
"""
import numpy as np
from PIL import Image

SOURCE = "art/murals/source/right-wall-pixel-raw.png"
OUT = "public/murals/right-wall-pixel.png"
WALL_ASPECT = 9.25 / 4.665          # right wall, scene units
WIDTH = 496                          # art pixels across the wall
COLOURS = 72

image = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float32)
h, w, _ = image.shape
keep = round(w / WALL_ASPECT)        # crop the lake from the bottom
image = image[:keep]
height = round(WIDTH / WALL_ASPECT)
cell_x, cell_y = w / WIDTH, keep / height

out = np.zeros((height, WIDTH, 3), np.uint8)
for j in range(height):
    y0, y1 = int(j * cell_y + cell_y * .25), max(int(j * cell_y + cell_y * .75), int(j * cell_y + cell_y * .25) + 1)
    for i in range(WIDTH):
        x0, x1 = int(i * cell_x + cell_x * .25), max(int(i * cell_x + cell_x * .75), int(i * cell_x + cell_x * .25) + 1)
        out[j, i] = np.median(image[y0:y1, x0:x1].reshape(-1, 3), axis=0)

pixels = Image.fromarray(out).quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
pixels.save(OUT, optimize=True)
print(OUT, pixels.size)
