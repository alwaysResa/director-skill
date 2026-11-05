#!/usr/bin/env bash
# Build the README demo: 5-second master, 540p MP4, GIF, and contact sheet.
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"
mkdir -p docs tests/.tmp/demo-frames

bash assets/demo/make-audio.sh

node scripts/render-frames.mjs \
  --url "file://$(pwd)/assets/demo/index.html" \
  --out tests/.tmp/demo-frames \
  --width 1080 --height 1920 --fps 24 --duration 5 \
  --hide "#ui" --force --quiet

ffmpeg -y -v error \
  -framerate 24 -start_number 0 \
  -i tests/.tmp/demo-frames/f%05d.png \
  -i assets/demo/tone.m4a \
  -c:v libx264 -preset slow -tune animation -crf 18 \
  -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 128k -ar 44100 \
  -shortest -movflags +faststart \
  tests/.tmp/demo-master.mp4

ffmpeg -y -v error -i tests/.tmp/demo-master.mp4 \
  -vf scale=540:960:flags=lanczos \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart \
  docs/demo.mp4

ffmpeg -y -v error -i docs/demo.mp4 \
  -vf "fps=10,scale=300:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer" \
  docs/demo.gif

"$PYTHON" scripts/contact-sheet.py \
  tests/.tmp/demo-frames/f00018.png \
  tests/.tmp/demo-frames/f00030.png \
  tests/.tmp/demo-frames/f00042.png \
  tests/.tmp/demo-frames/f00060.png \
  tests/.tmp/demo-frames/f00072.png \
  tests/.tmp/demo-frames/f00084.png \
  tests/.tmp/demo-frames/f00101.png \
  tests/.tmp/demo-frames/f00110.png \
  --out docs/demo-contact-sheet.jpg --cols 4 --width 216 --fps 24

ls -lh docs/demo.mp4 docs/demo.gif docs/demo-contact-sheet.jpg
