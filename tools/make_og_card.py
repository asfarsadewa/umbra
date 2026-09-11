"""
Compose UMBRA's social share card and app icons from the generated key art plus
deterministic typography.

    python tools/make_og_card.py

Input:  output/imagegen/og-backdrop.png
Output: public/og-card.png          (1200x630)
        public/og-card-square.png   (1080x1080)
        public/icons/{512,192,apple-touch,32}
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKDROP = os.path.join(ROOT, "output", "imagegen", "og-backdrop.png")
OUT = os.path.join(ROOT, "public", "og-card.png")
OUT_SQUARE = os.path.join(ROOT, "public", "og-card-square.png")
ICON_DIR = os.path.join(ROOT, "public", "icons")

GEORGIA = "C:/Windows/Fonts/georgia.ttf"
GEORGIA_BOLD = "C:/Windows/Fonts/georgiab.ttf"
GEORGIA_ITALIC = "C:/Windows/Fonts/georgiai.ttf"

INK = (242, 233, 214, 255)
DIM = (196, 186, 164, 255)
FAINT = (150, 140, 120, 255)
GOLD = (232, 180, 90, 255)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def tracked(draw, xy, text, fnt, tracking, fill, shadow=None):
    x, y = xy
    if shadow:
        sx, sy, color = shadow
        cursor = x
        for ch in text:
            draw.text((cursor + sx, y + sy), ch, font=fnt, fill=color, anchor="ls")
            cursor += draw.textlength(ch, font=fnt) + tracking
    cursor = x
    for ch in text:
        draw.text((cursor, y), ch, font=fnt, fill=fill, anchor="ls")
        cursor += draw.textlength(ch, font=fnt) + tracking
    return cursor - tracking


def vignette(image: Image.Image, strength: float = 0.55) -> Image.Image:
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([-width * 0.22, -height * 0.55, width * 1.22, height * 1.55], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(150))
    dark = Image.new("RGBA", image.size, (6, 5, 3, 0))
    dark.putalpha(mask.point(lambda v: int((255 - v) * strength)))
    return Image.alpha_composite(image, dark)


def cover(backdrop: Image.Image, size) -> Image.Image:
    width, height = size
    scale = max(width / backdrop.width, height / backdrop.height)
    resized = backdrop.resize(
        (int(backdrop.width * scale) + 1, int(backdrop.height * scale) + 1),
        Image.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def render(size) -> Image.Image:
    width, height = size
    backdrop = Image.open(BACKDROP).convert("RGBA")
    canvas = cover(backdrop, size)

    # Left-to-right darkening so the type always reads.
    gradient = Image.new("RGBA", (width, 1), (0, 0, 0, 0))
    for x in range(width):
        t = max(0.0, 1.0 - x / (width * 0.66))
        gradient.putpixel((x, 0), (7, 6, 4, int(240 * (t ** 1.3))))
    shade = gradient.resize((width, height))
    canvas = Image.alpha_composite(canvas, shade)
    canvas = vignette(canvas)

    draw = ImageDraw.Draw(canvas)
    u = height / 630.0
    pad = int(width * 0.062)

    tracked(
        draw,
        (pad, int(height * 0.30)),
        "A DETERMINISTIC PUZZLE OF LIGHT",
        font(GEORGIA, int(16 * u)),
        5.2 * u,
        GOLD,
    )

    tracked(
        draw,
        (pad, int(height * 0.50)),
        "UMBRA",
        font(GEORGIA_BOLD, int(96 * u)),
        20 * u,
        INK,
        shadow=(3, 4, (0, 0, 0, 160)),
    )

    rule_y = int(height * 0.55)
    draw.line(
        [(pad, rule_y), (pad + int(170 * u), rule_y)],
        fill=(232, 180, 90, 130),
        width=max(1, int(1.4 * u)),
    )

    tracked(
        draw,
        (pad, int(height * 0.65)),
        "You don't move the dead.",
        font(GEORGIA_ITALIC, int(30 * u)),
        0.4 * u,
        DIM,
    )
    tracked(
        draw,
        (pad, int(height * 0.715)),
        "You move the sun.",
        font(GEORGIA_ITALIC, int(30 * u)),
        0.4 * u,
        DIM,
    )

    tracked(
        draw,
        (pad, int(height * 0.92)),
        "UMBRA.ASFARLAB.FUN",
        font(GEORGIA, int(14 * u)),
        3.4 * u,
        FAINT,
    )

    handle = "@ashthepeasant"
    handle_font = font(GEORGIA_ITALIC, int(15 * u))
    handle_tracking = 1.6 * u
    handle_width = sum(draw.textlength(ch, font=handle_font) for ch in handle) + (
        handle_tracking * (len(handle) - 1)
    )
    cursor = width - pad - handle_width
    for ch in handle:
        draw.text((cursor, int(height * 0.92)), ch, font=handle_font, fill=GOLD, anchor="ls")
        cursor += draw.textlength(ch, font=handle_font) + handle_tracking

    return canvas.convert("RGB")


def make_icon(size: int) -> Image.Image:
    """A pillar casting a hard shadow under a high sun."""
    image = Image.new("RGBA", (size, size), (20, 16, 11, 255))

    # Warm sky glow behind the sun.
    glow = Image.new("L", (size, size), 0)
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse(
        [size * 0.46, size * 0.02, size * 1.04, size * 0.60],
        fill=120,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.10))
    amber = Image.new("RGBA", (size, size), (255, 200, 110, 0))
    amber.putalpha(glow)
    image = Image.alpha_composite(image, amber)

    draw = ImageDraw.Draw(image)

    # Sun disc.
    sun_r = size * 0.10
    sun_cx, sun_cy = size * 0.76, size * 0.22
    draw.ellipse(
        [sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
        fill=(255, 226, 168, 255),
    )

    # Ground band.
    ground_top = size * 0.70
    draw.rectangle([0, ground_top, size, size], fill=(206, 190, 156, 255))

    # Shadow: a hard parallelogram thrown to the lower-left from the pillar.
    shadow = [
        (size * 0.40, size * 0.70),
        (size * 0.56, size * 0.70),
        (size * 0.08, size * 1.0),
        (-size * 0.10, size * 1.0),
    ]
    draw.polygon(shadow, fill=(58, 60, 74, 255))

    # Pillar.
    px0, px1 = size * 0.40, size * 0.56
    py0, py1 = size * 0.26, size * 0.72
    draw.rectangle([px0, py0, px1, py1], fill=(226, 214, 184, 255))
    draw.rectangle([px0, py0, px0 + (px1 - px0) * 0.34, py1], fill=(240, 230, 202, 255))
    draw.rectangle(
        [px0 - size * 0.02, py0 - size * 0.03, px1 + size * 0.02, py0 + size * 0.02],
        fill=(210, 196, 164, 255),
    )

    # A tiny shade sheltering in the shadow.
    sx, sy = size * 0.26, size * 0.80
    draw.ellipse([sx - size * 0.022, sy - size * 0.09, sx + size * 0.022, sy - size * 0.05], fill=(10, 10, 14, 255))
    draw.polygon(
        [
            (sx - size * 0.05, sy),
            (sx + size * 0.05, sy),
            (sx + size * 0.03, sy - size * 0.09),
            (sx - size * 0.03, sy - size * 0.09),
        ],
        fill=(10, 10, 14, 255),
    )

    return image.convert("RGB")


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)
    render((1200, 630)).save(OUT, "PNG", optimize=True)
    render((1080, 1080)).save(OUT_SQUARE, "PNG", optimize=True)
    for size, name in (
        (512, "icon-512.png"),
        (192, "icon-192.png"),
        (180, "apple-touch-icon.png"),
        (32, "favicon-32.png"),
    ):
        make_icon(size).save(os.path.join(ICON_DIR, name), "PNG", optimize=True)
    print("wrote", OUT)
    print("wrote", OUT_SQUARE)
    print("wrote", ICON_DIR)


if __name__ == "__main__":
    main()
