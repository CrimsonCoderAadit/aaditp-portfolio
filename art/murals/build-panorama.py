"""Builds the room's cosmic panorama: one continuous painting that wraps the
front wall, the left (wardrobe / display figure) wall and the window wall, so
features run unbroken across both corners. The right (workstation) wall keeps
its own pixel-art mural and is not part of this.

The strip reads left to right as a viewer turning right inside the room:

    FRONT (right-wall corner -> left-wall corner)
    LEFT  (front corner, door -> back corner, bed)
    BACK  (left corner -> window -> right-wall corner)

The window wall is the master. Its painting (art/murals/source/back-wall-
galactic.png) is placed at 90% of the wall height so the ringed planet sits
whole below the ceiling, with its rings clear of the window. The quiet sky
around the window is widened to fill the longer wall, the spire city follows
it, and the rest of the strip is painted procedurally in the source's own
palette: one shared horizon, layered terrain, sky, nebula, stars, a sparse
skyline that thins toward the display figure and returns faintly on the front
wall, one crescent (the secondary moon) and one faint distant planet.

Outputs, in public/murals:
    panorama-{front,left,back}.webp         colour, 212 px per scene unit
    panorama-{front,left,back}-small.webp   half size, for small screens
    panorama-{front,left,back}-glow.png     half-size emission data read by the
        shell shader: R = emission, G = shimmers, B = shimmer phase

Usage: python art/murals/build-panorama.py [preview.png]  (Pillow and NumPy)
"""
import sys

import numpy as np
from PIL import Image

rng = np.random.default_rng(20260924)

# --- Room, in scene units (see components/scene/roomLayout.ts) --------------
WALL_HEIGHT = 5.25 - .035
H = 1107
PX = H / WALL_HEIGHT
WALLS = [("front", 19.3), ("left", 13.2), ("back", 19.3)]
WIDTHS = {name: round(length * PX) for name, length in WALLS}
START = {}
x = 0
for name, _ in WALLS:
    START[name] = x
    x += WIDTHS[name]
W = x
BACK = START["back"]
LEFT = START["left"]

def col(units):
    return int(round(units * PX))

def unit_cols():
    return np.arange(W, dtype=np.float32) / PX

# --- Source placement on the window wall ------------------------------------
SCALE = .9
source = Image.open("art/murals/source/back-wall-galactic.png").convert("RGB")
SH = round(H * SCALE)
SW = round(source.width * SH / source.height)
src = np.asarray(source.resize((SW, SH), Image.LANCZOS), dtype=np.float32) / 255
# Extend the dark foreground under the scaled painting to the floor.
KEEP = SH - 96
foot = np.asarray(Image.fromarray((src[KEEP:] * 255).astype(np.uint8)).resize((SW, H - KEEP), Image.LANCZOS), dtype=np.float32) / 255
src = np.concatenate([src[:KEEP], foot], axis=0)

def smoothstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def lum(a):
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722

# The horizon: the brightest row in the quiet middle of the painting.
middle = src[:, int(SW * .45):int(SW * .62)]
HR = int(np.argmax(lum(middle).mean(axis=1)[SH // 2:SH - 100])) + SH // 2
SKY = middle.mean(axis=1)
# Smoothed per-row palette, top to floor: the painting's stars and cloud
# streaks averaged out so the painted sky carries no banding.
_k = np.ones(41) / 41
_smooth = np.stack([np.convolve(np.pad(SKY[:, k], 20, mode="edge"), _k, mode="valid") for k in range(3)], axis=1)
_keep = smoothstep(HR - 160, HR - 110, np.arange(len(SKY), dtype=np.float32))[:, None]
SKY = (_smooth * (1 - _keep) + SKY * _keep).astype(np.float32)

# Back wall layout, in columns of the wall: a margin of painted sky, the planet
# (source 0 .. .43), the widened quiet sky with the window (.43 .. .67), the
# spire city (.67 .. 1), then painted outskirts to the workstation corner.
A0 = col(.4)
A_SRC = (3, round(SW * .43))
B_SRC = (A_SRC[1], round(SW * .67))
C_SRC = (B_SRC[1], SW)
A1 = A0 + A_SRC[1] - A_SRC[0]
B1 = col(9.95)
C1 = B1 + (C_SRC[1] - C_SRC[0])
WINDOW = (col(-3.15 + 9.65), col(-.35 + 9.65))
assert A1 < WINDOW[0] - col(1.2) and WINDOW[1] < B1, "planet or city would meet the window"

# --- Noise -------------------------------------------------------------------
def noise(w, h, cells_x, cells_y, seed):
    r = np.random.default_rng(seed)
    grid = r.random((cells_y + 3, cells_x + 3)).astype(np.float32)
    image = Image.fromarray(grid, mode="F").resize((w, h), Image.BICUBIC, box=(1, 1, cells_x + 1, cells_y + 1))
    return np.asarray(image)

def fbm(w, h, cells_x, cells_y, seed, octaves=5, falloff=.5):
    total, weight, amp = np.zeros((h, w), np.float32), 0, 1
    for k in range(octaves):
        total += noise(w, h, cells_x * 2 ** k, cells_y * 2 ** k, seed + k * 101) * amp
        weight += amp
        amp *= falloff
    return np.clip(total / weight, 0, 1)

def ridge(seed, cells, octaves=6):
    return fbm(W, 1, cells, 1, seed, octaves, .55)[0]

def envelope(points):
    """Piecewise-linear profile along the strip, from (units, value) pairs."""
    xs, ys = zip(*points)
    return np.interp(unit_cols(), xs, ys).astype(np.float32)

rows = np.arange(H, dtype=np.float32)[:, None]
U = unit_cols()[None, :]
L_START, B_START = LEFT / PX, BACK / PX
VADER = L_START + 8.25
CRESCENT = (L_START + 6.8, 4.45, .15)

# --- Profiles along the strip ------------------------------------------------
# Brightness of the painted world relative to the window wall's sky.
light = envelope([(0, .7), (6, .74), (12, .7), (L_START, .6), (L_START + 3.5, .58), (VADER, .56),
                  (B_START - 1.2, .74), (B_START + .45, .72), (B_START + 2, 1), (BACK / PX + 13.6, 1), (W / PX, .9)])
warm = envelope([(0, 0), (B_START - 2.2, 0), (B_START + .4, 1), (W / PX, 1)])
nebula = envelope([(0, .45), (4, .3), (12, .22), (L_START, .16), (VADER - 1, .16), (B_START, .2),
                   (B_START + 13.6, 1.4), (B_START + 15.5, .8), (W / PX, .35)])
star_density = envelope([(0, .8), (L_START, .7), (L_START + 3.5, .55), (VADER, .45), (B_START - 1.5, .5), (B_START + .5, .22),
                         (B_START + 13.6, .25), (B_START + 15.5, .5), (W / PX, .6)])

# --- Sky -----------------------------------------------------------------------
img = np.empty((H, W, 3), np.float32)
profile = SKY[:, None, :]
img[:] = profile * light[None, :, None]
# The warm glow low over the horizon beside the planet, carried round the corner.
glow_band = np.exp(-((rows - HR + 40) / 90) ** 2)[..., None]
warm_colour = np.array([.62, .42, .26], np.float32)
img += glow_band * warm[None, :, None] * .10 * warm_colour
# A cool haze band along the horizon everywhere else.
haze = np.exp(-((rows - HR + 12) / 55) ** 2)[..., None]
img += haze * (1 - warm[None, :, None]) * light[None, :, None] * .05 * np.array([.5, .62, .78], np.float32)

# Nebula and dust: two colours from the painting's own nebula, noise-shaped.
dust = fbm(W, H, 18, 2, 11)
detail = fbm(W, H, 60, 6, 23)
cloud = smoothstep(.5, .78, dust) * (.55 + .45 * detail)
mix = smoothstep(.3, .7, detail)[..., None]
violet, blue = np.array([.42, .32, .66], np.float32), np.array([.24, .34, .62], np.float32)
sky_mask = smoothstep(HR + 5, HR - 60, rows)
img += (violet * mix + blue * (1 - mix)) * (cloud * nebula[None, :] * .32 * sky_mask)[..., None]
# Long thin cloud streaks near the horizon, as in the painting.
streak = fbm(W, H, 40, 14, 37, 4)
streaks = smoothstep(.56, .8, streak) * np.exp(-((rows - HR + 150) / 120) ** 2)
img += streaks[..., None] * light[None, :, None] * .05 * np.array([.55, .6, .7], np.float32)

# The veil behind the display figure: a soft cool field that separates the
# black helmet and cape from the wall without any bright detail.
veil = np.exp(-(((U - VADER) / 1.6) ** 2 + ((rows - (H - 3.0 * PX)) / (1.6 * PX)) ** 2))
img += veil[..., None] * np.array([.035, .05, .1], np.float32)
# A faint violet drift at the pixel-wall corner of the front wall.
drift = np.exp(-(((U - 0) / 2.4) ** 2 + ((rows - H * .4) / (H * .45)) ** 2))
img += drift[..., None] * np.array([.05, .025, .08], np.float32)

# --- Celestial bodies --------------------------------------------------------
def disc(cx_units, cy_units, r_units):
    cx, cy, r = cx_units * PX, H - cy_units * PX, r_units * PX
    x0, x1 = max(0, int(cx - r * 1.5)), min(W, int(cx + r * 1.5) + 1)
    y0, y1 = max(0, int(cy - r * 1.5)), min(H, int(cy + r * 1.5) + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    return (slice(y0, y1), slice(x0, x1)), (xx - cx) / r, (yy - cy) / r

# Secondary: a crescent between the wardrobe and the display figure.
(sl, dx, dy) = disc(*CRESCENT)
d = np.hypot(dx, dy)
inside = smoothstep(1.02, .98, d)
lit = smoothstep(.2, .55, np.hypot(dx - .45, dy + .25) - .55) * inside
img[sl] = img[sl] * (1 - inside[..., None] * .8) + inside[..., None] * np.array([.035, .045, .08])
img[sl] += lit[..., None] * np.array([.55, .62, .78], np.float32) * .75
img[sl] += (np.exp(-((d - 1) / .2) ** 2) * (1 - inside) * .08)[..., None] * np.array([.5, .6, .9], np.float32)

# Tertiary: the glow of a giant just below the front wall's horizon, and one
# tiny far planet high up.
planet_glow = np.exp(-(((U - 8.6) / 2.6) ** 2 + ((rows - HR + 30) / 70) ** 2))
img += planet_glow[..., None] * np.array([.07, .055, .05], np.float32)
(sl, dx, dy) = disc(15.6, 4.05, .07)
d = np.hypot(dx, dy)
inside = smoothstep(1.05, .95, d)
img[sl] = img[sl] * (1 - inside[..., None]) + inside[..., None] * np.array([.3, .4, .55]) * (.45 + .55 * smoothstep(.6, -.6, dx + dy))[..., None]

# --- Terrain -------------------------------------------------------------------
# The painting's own layered landscape, rebuilt round the room from varied,
# never-mirrored stretches of its quiet middle, rescaled and cross-faded, and
# dimmed with the world's light. Its sky feathers into the painted sky above.
TOP = HR - 75
# Stretches of the painting with no landmark peak, so nothing recognisable repeats.
QUIET = [(.12, .27), (.36, .64)]
land = np.zeros((H, W), np.float32)
def band(c0, c1, seed, ranges, span_range):
    """Cross-faded stretches of the painting, full height from TOP down."""
    r = np.random.default_rng(seed)
    strip = np.zeros((H - TOP, c1 - c0, 3), np.float32)
    weight = np.zeros(c1 - c0, np.float32)
    x = -60
    while x < c1 - c0:
        span = int(r.integers(*span_range))
        stretch = r.uniform(.95, 1.35)
        take = int(span / stretch)
        lo, hi = ranges[int(r.integers(len(ranges)))]
        sx = int(r.integers(int(SW * lo), max(int(SW * lo) + 1, int(SW * hi) - take)))
        piece = np.asarray(Image.fromarray((src[TOP:, sx:sx + take] * 255).astype(np.uint8)).resize((span, H - TOP), Image.LANCZOS), np.float32) / 255
        piece *= r.uniform(.9, 1.08)
        ramp = np.minimum(1, np.minimum(np.arange(span) + 1, span - np.arange(span)) / 100).astype(np.float32)
        d0, d1 = max(0, x), min(c1 - c0, x + span)
        if d1 > d0:
            strip[:, d0:d1] += piece[:, d0 - x:d1 - x] * ramp[None, d0 - x:d1 - x, None]
            weight[d0:d1] += ramp[d0 - x:d1 - x]
        x += span - 100
    return strip / np.maximum(weight, 1e-3)[None, :, None]

def terrain(c0, c1, seed):
    # The far band (distant ridges) and the near band (foreground rock) come
    # from independent stretches, so their combinations never repeat.
    far = band(c0, c1, seed, QUIET, (380, 600))
    near = band(c0, c1, seed + 1000, [(.02, .64)], (300, 520))
    split = smoothstep(HR + 50, HR + 110, rows[TOP:])[..., None]
    strip = far * (1 - split) + near * split
    shade = light[c0:c1] * (.9 + .1 * warm[c0:c1])
    strip *= shade[None, :, None]
    # Feather in below the painting's warm cloud line, just above the ridges.
    fade = smoothstep(HR - 48, HR - 26, rows[TOP:])[..., None]
    img[TOP:, c0:c1] = img[TOP:, c0:c1] * (1 - fade) + strip * fade
    land[HR - 26:, c0:c1] = 1

terrain(0, BACK + A0 + 140, 301)
terrain(BACK + C1 - 130, W, 302)

# --- Skyline -----------------------------------------------------------------
emission = np.zeros((H, W), np.float32)
LIGHT_WARM = np.array([1.0, .8, .52], np.float32)
SLATE = np.array([.17, .2, .27], np.float32)

def spire(cx, height, width, haze, lights, seed):
    """A tapering tower from the horizon, hazed toward the sky colour."""
    r = np.random.default_rng(seed)
    x0, x1 = int(cx - width * 3), int(cx + width * 3) + 1
    y_top, y_base = int(HR - height), HR + 12
    yy, xx = np.mgrid[y_top:y_base, x0:x1].astype(np.float32)
    t = np.clip((yy - y_top) / height, 0, 1)
    half = width * (.08 + .92 * t ** 1.6)
    shape = smoothstep(half + .7, half - .7, np.abs(xx - cx))
    body = SLATE * (1 - haze) + SKY[HR - 30] * .85 * haze
    target = img[y_top:y_base, x0:x1]
    img[y_top:y_base, x0:x1] = target * (1 - shape[..., None]) + body * shape[..., None]
    for _ in range(lights):
        ly = int(y_top + height * (.25 + .7 * r.random()))
        lx = int(cx + (r.random() - .5) * width * (.1 + .9 * (ly - y_top) / height))
        light_dot(lx, ly, .45 + .5 * r.random() * (1 - haze), r)

def light_dot(x, y, strength, r=None):
    if not (0 <= x < W and 0 <= y < H):
        return
    img[y, x] = img[y, x] * (1 - strength) + LIGHT_WARM * strength
    emission[y, x] = max(emission[y, x], strength * .9)

def craft(cx, cy, size, seed):
    """A tiny aircraft silhouette with one navigation light."""
    yy, xx = np.mgrid[int(cy - size):int(cy + size), int(cx - size * 2):int(cx + size * 2)].astype(np.float32)
    shape = smoothstep(1.05, .9, np.hypot((xx - cx) / (size * 1.6), (yy - cy) / (size * .35)))
    region = (slice(int(cy - size), int(cy + size)), slice(int(cx - size * 2), int(cx + size * 2)))
    img[region] = img[region] * (1 - shape[..., None] * .8) + SKY[HR - 60] * .35 * shape[..., None] * .8
    light_dot(int(cx + size * 1.4), int(cy), .55)

def citadel(cx_units, width_units, tall, haze, lights, seed):
    """A cluster of spires on a low plinth, tallest near the middle, like the
    painting's city, hazed by distance."""
    r = np.random.default_rng(seed)
    cx, half = cx_units * PX, width_units * PX / 2
    plinth = max(3, tall * .08)
    body = SLATE * (1 - haze) + SKY[HR - 30] * .85 * haze
    x0, x1 = int(cx - half), int(cx + half)
    yy, xx = np.mgrid[int(HR - plinth):HR + 10, x0:x1].astype(np.float32)
    edge = np.clip(1 - np.abs(xx - cx) / half, 0, 1)
    base = smoothstep(0, .5, edge) * smoothstep(HR - plinth * edge - 1, HR - plinth * edge + 2, yy) * (1 - haze * .6)
    region = (slice(int(HR - plinth), HR + 10), slice(x0, x1))
    img[region] = img[region] * (1 - base[..., None]) + body * base[..., None]
    for _ in range(int(3 + width_units * 14)):
        offset = r.normal(0, .42) * half
        falloff = max(0, 1 - abs(offset) / half)
        height = tall * falloff ** 1.3 * r.uniform(.35, 1)
        if height < 6:
            continue
        spire(cx + offset, height, height * r.uniform(.045, .08), haze, 0, int(r.integers(1 << 30)))
    for _ in range(lights):
        light_dot(int(cx + r.normal(0, .35) * half), int(HR - plinth * r.uniform(.2, .9)), .55 * (1 - haze * .5))
        if r.random() < .5:
            light_dot(int(cx + r.normal(0, .15) * half), int(HR - tall * r.uniform(.2, .6)), .4 * (1 - haze * .5))

# Outskirts of the spire city toward the workstation corner: a near citadel,
# smaller and hazier ones scattering out, and two small aircraft.
city_end = (BACK + C1) / PX
corner = W / PX
citadel(city_end + .9, 1.0, 170, .45, 14, 1)
citadel(city_end + 2.6, .6, 95, .62, 7, 2)
citadel(city_end + 4.1, .45, 60, .72, 4, 3)
citadel(city_end + 5.2, .3, 38, .8, 2, 4)
craft((city_end + 3.2) * PX, HR - 450, 8, 6)
craft((city_end + 4.6) * PX, HR - 560, 6, 7)

# A far, low city along the horizon beside the window, below the sill line.
citadel(B_START + A1 / PX + .9, .7, 40, .75, 3, 8)
citadel(B_START + WINDOW[1] / PX + .3, .5, 34, .78, 2, 9)
craft(BACK + col(5.9), HR - 560, 8, 10)
craft(BACK + col(10.4), HR - 470, 6, 11)
# Scattered distant towers toward the bed corner, fading out before the figure.
citadel(B_START - 1.2, .5, 55, .78, 2, 12)
citadel(B_START - 2.6, .25, 30, .85, 1, 15)
# A faint reappearance on the front wall, clear of the name's corner.
citadel(7.2, .9, 70, .72, 5, 13)
citadel(10.4, .5, 40, .8, 2, 14)
citadel(4.3, .35, 28, .85, 1, 16)

# --- Window wall painting ------------------------------------------------------
section = np.zeros((H, WIDTHS["back"], 3), np.float32)
present = np.zeros((H, WIDTHS["back"]), np.float32)
def place(dest0, dest1, s0, s1):
    part = src[:, s0:s1]
    if dest1 - dest0 != s1 - s0:
        part = np.asarray(Image.fromarray((part * 255).astype(np.uint8)).resize((dest1 - dest0, H), Image.LANCZOS), np.float32) / 255
    section[:, dest0:dest1] = part
    present[:, dest0:dest1] = 1
place(A0, A1, *A_SRC)
place(A1, B1, *B_SRC)
place(B1, C1, *C_SRC)

# The painted surroundings meet the painting's edges gradually: near each edge
# they lean toward that edge's own row colours (a median, so a thin spire at
# the very edge never smears sideways), and the painting feathers in.
def edge_colour(c0, c1):
    return np.median(section[:, c0:c1], axis=1)
left_edge, right_edge = edge_colour(A0, A0 + 6), edge_colour(C1 - 8, C1)
# The rings cross the left edge; the lean uses the sky around them instead.
EDGE_COL = 3
ring_col = src[:, EDGE_COL]
sky_level = np.median(lum(src[:HR - 200, EDGE_COL:EDGE_COL + 1]), axis=0)[0]
ring_alpha = smoothstep(sky_level + .04, sky_level + .16, lum(ring_col[None, :])[0])
ring_alpha[int(SH * .34):] = 0
clear = np.convolve(ring_alpha, np.ones(15) / 15, mode="same") < .02
def ring_alpha_at(c):
    a = smoothstep(sky_level + .03, sky_level + .12, lum(src[:, c]))
    a[int(SH * .34):] = 0
    return a
for k in range(3):
    left_edge[:, k] = np.interp(np.arange(H), np.flatnonzero(clear), left_edge[clear, k])
# The platform at the city's edge would streak sideways: its rows take the
# sky around them instead.
_wide = np.stack([np.convolve(np.pad(right_edge[:, k], 60, mode="edge"), np.ones(121) / 121, mode="valid") for k in range(3)], axis=1)
calm = np.abs(lum(right_edge) - lum(_wide)) < .025
calm[TOP:] = True
for k in range(3):
    right_edge[:, k] = np.interp(np.arange(H), np.flatnonzero(calm), right_edge[calm, k])
# Vertically softened, so a platform or spire at an edge never streaks sideways.
_v = np.ones(61) / 61
for edge in (left_edge, right_edge):
    for k in range(3):
        edge[:, k] = np.convolve(np.pad(edge[:, k], 30, mode="edge"), _v, mode="valid")
pan = img[:, BACK:]
cols_back = np.arange(WIDTHS["back"], dtype=np.float32)
reach = .45 * PX
# Only the sky leans; the terrain below is already the painting's own.
sky_rows = smoothstep(TOP + 30, TOP, rows)[..., None]
# The painting's first columns are the thin halo round the planet's limb;
# the left lean is short so it never widens into a pale column.
reach_left = .12 * PX
lean_left = (np.exp(-np.maximum(A0 - cols_back, 0) / reach_left) * (cols_back < A0))[None, :, None] * sky_rows
lean_right = (np.exp(-np.maximum(cols_back - C1, 0) / (reach * 2.5)) * (cols_back >= C1 - 70))[None, :, None] * sky_rows
pan[:] = pan * (1 - lean_left) + left_edge[:, None, :] * lean_left
pan[:] = pan * (1 - lean_right) + right_edge[:, None, :] * lean_right
# The left corner of the back wall lies inside the painted margin; the lean
# must also reach round it onto the left wall.
d_left = (A0 + (BACK - np.arange(LEFT, BACK))).astype(np.float32)
lean_wrap = np.exp(-d_left / reach_left)[None, :, None] * sky_rows
img[:, LEFT:BACK] = img[:, LEFT:BACK] * (1 - lean_wrap) + left_edge[:, None, :] * lean_wrap
alpha = present.copy()
rise = smoothstep(0, 1, (cols_back[None, :] - A0) / (10 + 100 * smoothstep(TOP, TOP + 40, rows)))
alpha = np.where(cols_back[None, :] >= A0, np.minimum(alpha, rise), alpha)
# The city edge: a short feather in the sky keeps the platform crisp, a long
# one in the terrain lets the two landscapes merge.
reach_edge = 30 + 80 * smoothstep(TOP, TOP + 40, rows)
fall = smoothstep(0, 1, (C1 - cols_back[None, :]) / reach_edge)
alpha = np.where(cols_back[None, :] < C1, np.minimum(alpha, fall), alpha)
pan[:] = pan * (1 - alpha[..., None]) + section * alpha[..., None]

# The nebula carries on past the city edge: a patch of the painting's own,
# nebula from above the moon (clear of it and the spires), faded in
# over the edge and out toward the corner.
n0, n1 = int(SW * .8), int(SW * .95)
patch = src[:, n0:n1]
width = n1 - n0
at = BACK + C1 - 70
ramp = np.minimum(smoothstep(0, 70, np.arange(width)), smoothstep(width, width * .35, np.arange(width)))
vertical = smoothstep(385, 330, rows)
nebula_alpha = ramp[None, :] * vertical * .85
img[:, at:at + width] = img[:, at:at + width] * (1 - nebula_alpha[..., None]) + patch * nebula_alpha[..., None]

# The painting cuts the ring just short of its left tip (its inner opening
# already closes inside the frame). A short reflected cap of the ring's own
# edge columns, fading out, closes the tip in the margin; the sky there is
# the lean colour above.
CAP = 30
for d in range(1, CAP):
    a = ring_alpha_at(A_SRC[0] + d - 1) * smoothstep(CAP, CAP * .3, d)
    dest = BACK + A0 - d
    img[:, dest] = img[:, dest] * (1 - a[:, None]) + src[:, A_SRC[0] + d - 1] * a[:, None]

# --- Stars ---------------------------------------------------------------------
glow = np.zeros((H // 2, W // 2, 3), np.float32)
target = int(W * H * 1100 / 1e6)
xs = rng.random(target * 4) * W
ys = rng.random(target * 4) * (TOP - 10)
keep = rng.random(xs.size) < star_density[xs.astype(int)] * (.35 + .65 * smoothstep(.35, .75, dust[ys.astype(int), xs.astype(int)]) + .4 * cloud[ys.astype(int), xs.astype(int)])
xs, ys = xs[keep][:target], ys[keep][:target]
# The painting already has its stars; keep ours off it, off the veil's core and the crescent.
xi, yi = xs.astype(int), ys.astype(int)
on_painting = (xi >= BACK + A0) & (xi < BACK + C1) & (xi < BACK + A1 + 4 * PX)
off_veil = np.random.default_rng(3).random(xi.size) > veil[yi, xi] * .45
cx_, cy_, cr_ = CRESCENT[0] * PX, H - CRESCENT[1] * PX, CRESCENT[2] * PX
off_moon = np.hypot(xs - cx_, ys - cy_) > cr_ * 1.2
sel = ~on_painting & off_veil & off_moon & (land[yi, xi] < .5)
# Beside the window the painting's stretched sky takes new stars too.
xs, ys = xs[sel], ys[sel]
magnitude = rng.random(xs.size) ** 6
tones = np.array([[214, 226, 255], [240, 242, 255], [255, 236, 206], [255, 206, 170]], np.float32) / 255
tone = tones[np.searchsorted([.52, .8, .95, 1.0], rng.random(xs.size))]
for x_, y_, m, t in zip(xs, ys, magnitude, tone):
    xi_, yi_ = int(x_), int(y_)
    if m < .08:
        a = .1 + m * 2
        img[yi_, xi_] = img[yi_, xi_] * (1 - a) + t * a
        continue
    radius = .45 + m * 1.35
    r_ = int(radius * 3.5) + 1
    y0, y1, x0, x1 = max(0, yi_ - r_), min(H, yi_ + r_ + 1), max(0, xi_ - r_), min(W, xi_ + r_ + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    dist = np.hypot(xx + .5 - x_, yy + .5 - y_)
    core = np.clip(1 - dist / (radius + .5), 0, 1) * min(1, .2 + m * .85)
    halo = np.exp(-(dist / (radius * 1.6)) ** 2) * .16 * m * (m > .85)
    a = np.clip(core + halo, 0, 1)[..., None]
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + t * a
    if m >= .45:
        gx, gy, gr = x_ / 2, y_ / 2, .5 + m * 1.1
        shimmer = rng.random() < .45
        phase = rng.random()
        gy0, gy1, gx0, gx1 = max(0, int(gy - gr - 1)), min(H // 2, int(gy + gr) + 2), max(0, int(gx - gr - 1)), min(W // 2, int(gx + gr) + 2)
        yy, xx = np.mgrid[gy0:gy1, gx0:gx1].astype(np.float32)
        fall = np.clip(1 - np.hypot(xx + .5 - gx, yy + .5 - gy) / (gr + .5), 0, 1)
        value = fall * fall * (40 + m * 190) / 255
        region = glow[gy0:gy1, gx0:gx1]
        stronger = value > region[..., 0]
        region[..., 0] = np.where(stronger, value, region[..., 0])
        region[..., 1] = np.where(stronger, 1.0 if shimmer else 0.0, region[..., 1])
        region[..., 2] = np.where(stronger, phase, region[..., 2])

# City lights (painted, and the painting's own) glow steadily.
luma = lum(img)
def box(a, r):
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if k == axis else (0, 0) for k in (0, 1)], mode="edge"), axis=axis)
        a = (np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return a
local = box(luma, 6)
spots = np.zeros((H, W), np.float32)
region = (slice(HR - 700, HR + 40), slice(BACK + A1, BACK + WIDTHS["back"]))
warm_px = (img[..., 0] > img[..., 2] * 1.15)
point = np.clip((luma - local - .12) * 4, 0, 1) * (luma > .42) * warm_px
spots[region] = point[region]
spots = np.maximum(spots, emission)
half = np.asarray(Image.fromarray(spots, mode="F").resize((W // 2, H // 2), Image.BOX)) * 2.2
glow[..., 0] = np.maximum(glow[..., 0], np.clip(half, 0, 1) * .85)

# --- Write -----------------------------------------------------------------------
out = np.clip(img, 0, 1)
colour = Image.fromarray((out * 255 + .5).astype(np.uint8))
glow_image = Image.fromarray((np.clip(glow, 0, 1) * 255 + .5).astype(np.uint8))
for name, _ in WALLS:
    c0 = START[name]
    wall = colour.crop((c0, 0, c0 + WIDTHS[name], H))
    wall.save(f"public/murals/panorama-{name}.webp", quality=90, method=6)
    wall.resize((wall.width // 2, H // 2), Image.LANCZOS).save(f"public/murals/panorama-{name}-small.webp", quality=88, method=6)
    glow_image.crop((c0 // 2, 0, (c0 + WIDTHS[name]) // 2, H // 2)).save(f"public/murals/panorama-{name}-glow.png", optimize=True)
    print(name, wall.size)
print("horizon", HR, "=", round((H - HR) / PX, 3), "units above the floor")
if len(sys.argv) > 1:
    colour.save(sys.argv[1])
