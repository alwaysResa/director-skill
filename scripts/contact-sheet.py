#!/usr/bin/env python3
"""Build a small, labelled contact sheet from rendered frames.

Usage:
  python3 scripts/contact-sheet.py frames/*.png --out review/sheet.jpg \
    --cols 6 --width 216 --fps 24

Requires Pillow. The output is intentionally small (usually 200-500 KB) so an
AI agent can inspect many frames without exhausting the 32 MiB inline-media
budget.
"""

import argparse
import glob
import os
import re
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.stderr.write("contact-sheet: Pillow is required (python3 -m pip install pillow)\n")
    sys.exit(2)


def natural_key(path):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", path)]


def label_for(path, index, fps):
    name = os.path.basename(path)
    m = re.search(r"f(\d+)\.(?:png|jpe?g)$", name, re.I)
    if m:
        frame = int(m.group(1))
        return f"{frame / fps:.2f}s"
    m = re.search(r"(?:shot_|frame_|t_)([0-9.]+)", name, re.I)
    if m:
        return f"{m.group(1)}s"
    return f"#{index + 1}"


def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except OSError:
                pass
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser(description="Build a labelled contact sheet.")
    ap.add_argument("inputs", nargs="+", help="frame files (globs are expanded)")
    ap.add_argument("--out", required=True, help="output JPEG/PNG")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--width", type=int, default=216, help="tile width in px")
    ap.add_argument("--fps", type=float, default=24.0)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--margin", type=int, default=12)
    ap.add_argument("--gap", type=int, default=6)
    args = ap.parse_args()

    files = []
    for pattern in args.inputs:
        expanded = glob.glob(pattern)
        files.extend(expanded if expanded else ([pattern] if os.path.isfile(pattern) else []))
    files = sorted(set(files), key=natural_key)
    if not files:
        sys.stderr.write("contact-sheet: no input files found\n")
        return 2

    cols = max(1, args.cols)
    rows = (len(files) + cols - 1) // cols
    label_h = max(18, args.width // 12)
    margin, gap = args.margin, args.gap

    first = Image.open(files[0]).convert("RGB")
    tile_h = max(1, round(args.width * first.height / first.width))
    sheet_w = margin * 2 + cols * args.width + (cols - 1) * gap
    sheet_h = margin * 2 + rows * (tile_h + label_h) + (rows - 1) * gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), (24, 24, 28))
    draw = ImageDraw.Draw(sheet)
    font = load_font(label_h - 4)

    for i, path in enumerate(files):
        try:
            im = Image.open(path).convert("RGB").resize((args.width, tile_h), Image.LANCZOS)
        except Exception as e:
            sys.stderr.write(f"contact-sheet: skip {path}: {e}\n")
            continue
        c, r = i % cols, i // cols
        x = margin + c * (args.width + gap)
        y = margin + r * (tile_h + label_h + gap)
        sheet.paste(im, (x, y))
        draw.text((x + 2, y + tile_h + 3), label_for(path, i, args.fps), fill=(255, 230, 0), font=font)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    if args.out.lower().endswith((".jpg", ".jpeg")):
        sheet.save(args.out, "JPEG", quality=args.quality, optimize=True)
    else:
        sheet.save(args.out)
    size = os.path.getsize(args.out)
    print(f"{args.out}  {sheet.width}x{sheet.height}  {size / 1024:.0f} KB  ({len(files)} frames)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
