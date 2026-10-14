#!/usr/bin/env python3
"""Generates this fork's free cosmetics catalog and skin images.

Everything here is original and free for every player:
  resources/cosmetics/cosmetics.json   the catalog (patterns, palettes,
                                       skins, trails and other effects)
  resources/cosmetics/skins/*.png      the territory skin stamps

Run from the repo root:  python3 scripts/generate-free-cosmetics.py
Needs Pillow (pip install pillow).
"""

import base64
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = "resources/cosmetics"
SKIN_DIR = os.path.join(OUT_DIR, "skins")


# ---------------------------------------------------------------- patterns
def encode_pattern(rows, scale):
    """rows: list of equal-length strings, '#' = secondary colour, '.' = primary."""
    h, w = len(rows), len(rows[0])
    assert 2 <= w <= 129 and 2 <= h <= 65 and 0 <= scale <= 7
    out = bytearray(
        [0, (scale & 0x07) | (((w - 2) & 0x1F) << 3), (((w - 2) >> 5) & 0x03) | (((h - 2) & 0x3F) << 2)]
    )
    bits = bytearray((w * h + 7) // 8)
    for y, row in enumerate(rows):
        assert len(row) == w
        for x, ch in enumerate(row):
            if ch == "#":
                i = y * w + x
                bits[i >> 3] |= 1 << (i & 7)
    out += bits
    return base64.urlsafe_b64encode(bytes(out)).decode().rstrip("=")


def grid(w, h, fn):
    return ["".join("#" if fn(x, y) else "." for x in range(w)) for y in range(h)]


PATTERNS = {
    "stripes": (grid(8, 8, lambda x, y: y < 2), 1, "common"),
    "checker": (grid(8, 8, lambda x, y: (x < 4) != (y < 4)), 1, "common"),
    "diagonal": (grid(8, 8, lambda x, y: (x + y) % 8 < 2), 1, "uncommon"),
    "dots": (grid(8, 8, lambda x, y: (x - 3.5) ** 2 + (y - 3.5) ** 2 < 4), 1, "uncommon"),
    "grid": (grid(8, 8, lambda x, y: x == 0 or y == 0), 1, "uncommon"),
    "diamonds": (grid(8, 8, lambda x, y: abs(x - 3.5) + abs(y - 3.5) < 3), 1, "rare"),
    "waves": (
        grid(16, 8, lambda x, y: abs(y - (3.5 + 2.5 * math.sin(x / 16 * 2 * math.pi))) < 1.1),
        1,
        "rare",
    ),
    "scales": (
        grid(8, 8, lambda x, y: abs(math.hypot(x - 3.5, y - (0 if y < 4 else 8)) - 3.5) < 0.9),
        1,
        "epic",
    ),
    "circuit": (
        grid(
            16,
            16,
            lambda x, y: (y == 3 and x < 11)
            or (x == 10 and 3 <= y <= 12)
            or (y == 12 and x >= 10)
            or (x == 4 and y >= 8)
            or (x - 4) ** 2 + (y - 8) ** 2 < 2
            or (x - 10) ** 2 + (y - 3) ** 2 < 2,
        ),
        0,
        "legendary",
    ),
}

PALETTES = {
    "chrome": ("#e5e7eb", "#6b7280"),
    "silver": ("#cbd5e1", "#334155"),
    "neon": ("#22d3ee", "#d946ef"),
    "ocean": ("#38bdf8", "#1e3a8a"),
    "sunset": ("#fb923c", "#9f1239"),
    "forest": ("#86efac", "#14532d"),
    "gold": ("#fde68a", "#a16207"),
    "midnight": ("#a5b4fc", "#0f172a"),
}


def cosmetic(name, rarity, **extra):
    return {"name": name, "product": None, "rarity": rarity, "artist": "OpenFront fork", **extra}


# ---------------------------------------------------------------- skins
SIZE = 512


def metal_fill(size, light, dark):
    """A vertical metallic gradient with a bright band, like polished chrome."""
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        band = math.exp(-(((t - 0.38) / 0.09) ** 2)) * 0.9
        k = min(1.0, (1 - t) * 0.65 + band)
        c = tuple(int(dark[i] + (light[i] - dark[i]) * k) for i in range(3))
        for x in range(size):
            px[x, y] = c + (255,)
    return img


def stamp(mask, light, dark, outline=(30, 30, 35)):
    fill = metal_fill(SIZE, light, dark)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    edge = mask.filter(ImageFilter.MaxFilter(9))
    out.paste(Image.new("RGBA", (SIZE, SIZE), outline + (230,)), (0, 0), edge)
    out.paste(fill, (0, 0), mask)
    return out


def star_points(cx, cy, r_out, r_in, n=5, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def mask_of(draw_fn):
    m = Image.new("L", (SIZE, SIZE), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def make_skins():
    os.makedirs(SKIN_DIR, exist_ok=True)
    c = SIZE / 2
    chrome = ((250, 250, 252), (95, 100, 112))
    skins = {
        "chrome_star": stamp(
            mask_of(lambda d: d.polygon(star_points(c, c * 1.04, 230, 95), fill=255)), *chrome
        ),
        "silver_shield": stamp(
            mask_of(
                lambda d: d.polygon(
                    [(c - 190, 60), (c + 190, 60), (c + 190, 250), (c, 470), (c - 190, 250)], fill=255
                )
            ),
            (235, 240, 248),
            (70, 82, 104),
        ),
        "neon_bolt": stamp(
            mask_of(
                lambda d: d.polygon(
                    [(300, 30), (130, 290), (240, 290), (190, 480), (390, 200), (275, 200), (350, 30)],
                    fill=255,
                )
            ),
            (165, 243, 252),
            (126, 34, 206),
            outline=(20, 10, 40),
        ),
        "golden_crown": stamp(
            mask_of(
                lambda d: (
                    d.polygon(
                        [(60, 400), (60, 150), (160, 270), (c, 90), (352, 270), (452, 150), (452, 400)],
                        fill=255,
                    ),
                    d.rectangle([60, 410, 452, 460], fill=255),
                )
            ),
            (254, 240, 138),
            (146, 64, 14),
        ),
        "target_rings": stamp(
            mask_of(
                lambda d: [
                    d.ellipse([c - r, c - r, c + r, c + r], outline=255, width=34)
                    for r in (230, 150, 70)
                ]
            ),
            (254, 202, 202),
            (153, 27, 27),
        ),
    }
    for name, img in skins.items():
        img.save(os.path.join(SKIN_DIR, f"{name}.png"), optimize=True)
    return {
        name: cosmetic(name, rarity, url=f"cosmetics/skins/{name}.png")
        for name, rarity in zip(skins, ["rare", "rare", "epic", "legendary", "uncommon"])
    }


# ---------------------------------------------------------------- effects
RAINBOW = ["#ff0000", "#ff8800", "#ffee00", "#22cc44", "#0088ff", "#8833ff"]
CHROME = ["#f8fafc", "#94a3b8", "#e2e8f0", "#475569"]
NEON = ["#22d3ee", "#d946ef", "#a3e635"]
FIRE = ["#fef08a", "#fb923c", "#dc2626", "#450a0a"]
ICE = ["#ecfeff", "#67e8f9", "#0e7490"]
GOLD = ["#fef3c7", "#facc15", "#a16207"]


def effect(effect_type, name, rarity, attributes):
    return cosmetic(name, rarity, effectType=effect_type, attributes=attributes)


def make_effects():
    e = {
        "transportShipTrail": [
            ("rainbow_wake", "rare", {"type": "gradient", "colors": RAINBOW, "colorSize": 3, "movementSpeed": 6}),
            ("chrome_wake", "uncommon", {"type": "gradient", "colors": CHROME, "colorSize": 2, "movementSpeed": 4}),
            ("neon_pulse", "rare", {"type": "transition", "colors": NEON, "frequency": 2}),
            ("ice_wake", "common", {"type": "gradient", "colors": ICE, "colorSize": 3, "movementSpeed": 3}),
        ],
        "nukeTrail": [
            ("fire_tail", "uncommon", {"type": "gradient", "colors": FIRE, "colorSize": 3, "movementSpeed": 8}),
            ("chrome_spiral", "epic", {"type": "spiral", "colors": CHROME, "radius": 6, "strands": 3, "rotationSpeed": 6}),
            ("plasma_spiral", "legendary", {"type": "spiral", "colors": NEON, "radius": 8, "strands": 4, "rotationSpeed": 8}),
            ("rainbow_tail", "rare", {"type": "gradient", "colors": RAINBOW, "colorSize": 4, "movementSpeed": 10}),
        ],
        "nukeExplosion": [],
        "structures": [
            ("chrome_shine", "rare", {"type": "gradient", "colors": CHROME, "colorSize": 2, "movementSpeed": 3}),
            ("rainbow_buildings", "epic", {"type": "transition", "colors": RAINBOW, "frequency": 1}),
        ],
        "warship": [
            ("chrome_fleet", "rare", {"type": "gradient", "colors": CHROME, "colorSize": 2, "movementSpeed": 3}),
            ("neon_fleet", "epic", {"type": "transition", "colors": NEON, "frequency": 1.5}),
        ],
        "train": [
            ("gold_express", "rare", {"type": "gradient", "colors": GOLD, "colorSize": 2, "movementSpeed": 4}),
            ("rainbow_express", "epic", {"type": "transition", "colors": RAINBOW, "frequency": 2}),
        ],
        "railroad": [
            ("silver_rails", "uncommon", {"type": "gradient", "colors": CHROME, "colorSize": 3, "movementSpeed": 2}),
            ("neon_rails", "rare", {"type": "transition", "colors": NEON, "frequency": 1}),
        ],
    }
    explosion_looks = [
        ("chrome_shockwave", "rare", {"type": "shockwave", "colors": CHROME, "size": 40, "speed": 30, "thickness": 3, "transitionSpeed": 2}),
        ("neon_sparkles", "epic", {"type": "sparkles", "colors": NEON, "size": 45, "speed": 25, "thickness": 1.5, "transitionSpeed": 3, "density": 120}),
        ("fire_embers", "rare", {"type": "embers", "colors": FIRE, "size": 40, "speed": 20, "thickness": 1.5, "transitionSpeed": 2, "density": 150}),
    ]
    sizes = {"atom": 1.0, "hydro": 2.2, "mirvWarhead": 0.6}
    for nuke_type, mult in sizes.items():
        for name, rarity, attrs in explosion_looks:
            a = dict(attrs, nukeType=nuke_type, size=round(attrs["size"] * mult, 1))
            e["nukeExplosion"].append((f"{name}_{nuke_type.lower()}", rarity, a))
    return {
        t: {name: effect(t, name, rarity, attrs) for name, rarity, attrs in items}
        for t, items in e.items()
    }


def main():
    catalog = {
        "colorPalettes": {name: {"name": name, "primaryColor": a, "secondaryColor": b} for name, (a, b) in PALETTES.items()},
        "patterns": {
            name: cosmetic(
                name,
                rarity,
                pattern=encode_pattern(rows, scale),
                colorPalettes=[{"name": p, "isArchived": False} for p in PALETTES],
            )
            for name, (rows, scale, rarity) in PATTERNS.items()
        },
        "flags": {},
        "skins": make_skins(),
        "effects": make_effects(),
    }
    with open(os.path.join(OUT_DIR, "cosmetics.json"), "w") as f:
        json.dump(catalog, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
