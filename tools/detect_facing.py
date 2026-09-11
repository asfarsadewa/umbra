"""
Determine a Hunyuan model's facing by silhouette IoU against its reference
image, then print the Blender yaw that turns the model to face +X (UMBRA's
convention, matching the runtime's `setFacing`).

  python tools/detect_facing.py --ref output/imagegen/refs/pillar.png \
      --model output/3d/pillar-<stamp>/model.glb --out-dir output/3d/review/pillar

Renders four orthographic views with the image-to-3d skill's blender_review.py
(the same script the MCP flow uses), then compares alpha masks.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

REVIEW = os.path.expanduser("~/.codex/skills/image-to-3d/scripts/blender_review.py")
BLENDER = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"

# A render that matches this view means the model faces this direction in
# Blender; the yaw is what rotates that direction onto +X.
YAW_FOR_VIEW = {
    "front": 90.0,   # faces -Y -> +X
    "back": -90.0,   # faces +Y -> +X
    "left": 180.0,   # faces -X -> +X
    "right": 0.0,    # faces +X -> +X
}


def mask(path: Path, size: int = 256) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema()[1] < 8:
        # No alpha; treat non-background as subject.
        grey = image.convert("L")
        alpha = grey.point(lambda v: 255 if v > 24 else 0)
    bbox = alpha.getbbox()
    if bbox:
        alpha = alpha.crop(bbox)
    # Pad to square, then resize, preserving aspect ratio.
    side = max(alpha.width, alpha.height)
    square = Image.new("L", (side, side), 0)
    square.paste(alpha, ((side - alpha.width) // 2, (side - alpha.height) // 2))
    return square.resize((size, size), Image.LANCZOS)


def iou(a: Image.Image, b: Image.Image) -> float:
    pa, pb = a.load(), b.load()
    inter = union = 0
    for y in range(a.height):
        for x in range(a.width):
            va = pa[x, y] > 127
            vb = pb[x, y] > 127
            if va or vb:
                union += 1
                if va and vb:
                    inter += 1
    return inter / union if union else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--height", type=float, default=1.7)
    parser.add_argument("--views", nargs="+", default=["front", "back", "left", "right"])
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cache = out_dir / ".rendered"
    if not all((out_dir / f"{v}.png").exists() for v in args.views):
        subprocess.run(
            [
                BLENDER,
                "--background",
                "--factory-startup",
                "--disable-autoexec",
                "--python",
                REVIEW,
                "--",
                "--model",
                args.model,
                "--out-dir",
                str(out_dir),
                "--height",
                str(args.height),
                "--views",
                *args.views,
            ],
            check=True,
        )

    reference = mask(Path(args.ref))
    scores = {}
    for view in args.views:
        path = out_dir / f"{view}.png"
        if not path.exists():
            continue
        scores[view] = round(iou(reference, mask(path)), 4)

    best = max(scores, key=scores.get) if scores else None
    report = {
        "reference": args.ref,
        "model": args.model,
        "scores": scores,
        "best": best,
        "yaw": YAW_FOR_VIEW.get(best, 0.0) if best else 0.0,
    }
    print(json.dumps(report, indent=2))
    (out_dir / "facing.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    sys.exit(main())
