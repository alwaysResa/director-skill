# Render pipeline

## Preflight

```bash
node --version        # must be >= 22 (global WebSocket)
ffmpeg -version
ffprobe -version
which chromium || which google-chrome || echo "set CHROME_BIN"
```

The renderer has **no npm dependencies**. It drives Chromium over the DevTools
Protocol using Node's built-in `WebSocket`.

## One frame first

Never start with the full render. Render 3–6 keyframes, inspect one contact
sheet, then render everything.

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out "review/frames" \
  --width 1080 --height 1920 --fps 24 --duration 45 \
  --start 20 --end 25 \
  --format jpeg --quality 85 \
  --hide "#ui"
```

## Full render

### 9:16, 45.6 s, 24 fps

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out "render/frames" \
  --width 1080 --height 1920 --fps 24 --duration 45.6 \
  --hide "#ui"
```

Frame count: `ceil(45.6 × 24) = 1095` frames (`f00000` … `f01094`).

### 16:9, 30 s, 30 fps

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out "render/frames" \
  --width 1920 --height 1080 --fps 30 --duration 30 \
  --hide "#ui"
```

### Review frames only

Use JPEG at a smaller viewport; it renders faster and the files are safe to
attach (still respect the 32 MiB budget):

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out "review/frames" \
  --width 540 --height 960 --fps 24 --duration 45.6 \
  --start 0 --end 120 \
  --format jpeg --quality 82 --hide "#ui"
```

## Useful flags

| Flag | Use |
|---|---|
| `--resume` | skip frames that already exist (safe after a crash) |
| `--force` | overwrite existing frames (default) |
| `--format png\|jpeg` | PNG for the master, JPEG for review |
| `--quality 1-100` | JPEG quality |
| `--scale 2` | device scale factor; output is 2× the CSS size |
| `--hide "#ui,.debug"` | selectors to hide; pass `""` to disable |
| `--seek-fn "window.__seek"` | custom seek function |
| `--ready "window.__ready"` | wait for an extra readiness flag |
| `--chrome /path/to/chrome` | explicit browser |
| `--gpu` | do not pass `--disable-gpu` (WebGL/Three.js) |
| `--timeout 180000` | page readiness timeout |

## Mux master

```bash
ffmpeg -y -v error \
  -framerate 24 -start_number 0 \
  -i render/frames/f%05d.png \
  -i audio-mix.m4a \
  -c:v libx264 -preset slow -tune animation -crf 18 \
  -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 192k -ar 44100 \
  -shortest -movflags +faststart \
  internet-mati-total.mp4
```

Why these flags:

- `-framerate 24` is the input rate; `-r 24` is the output rate. Keep them
  consistent or ffmpeg will duplicate/drop frames.
- `-tune animation` helps flat vector/cartoon content.
- `-crf 18` is visually transparent for most animation. Raise to 20–23 if the
  file is too large.
- `-pix_fmt yuv420p` is required by most players and platforms.
- `+faststart` moves the moov atom to the front for web playback.
- `-shortest` ends at the shorter stream. If the audio has a tail, render
  frames to the audio duration and hold the last frame.

## Preview 720p

```bash
ffmpeg -y -v error -i internet-mati-total.mp4 \
  -vf scale=720:1280:flags=lanczos \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart \
  internet-mati-total-720p.mp4
```

A 45 s 1080×1920 animation typically lands at 20–60 MB for the master and
8–15 MB for the 720p preview. The preview is for sharing; the master is the
delivery.

## GIF / README preview

```bash
ffmpeg -y -v error -i docs/demo.mp4 \
  -vf "fps=12,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  docs/demo.gif
```

Keep the GIF under 2 MB. If it is larger, reduce `fps` to 10 or width to 320.

## Contact sheet

```bash
python3 scripts/contact-sheet.py render/frames/f00000.png render/frames/f00024.png \
  render/frames/f00048.png render/frames/f00072.png \
  --out review/contact-sheet.jpg --cols 4 --width 270 --fps 24
```

For a full-film review, sample 12–22 frames: one per scene, both sides of each
cut, and the first/last frame. One sheet is safer than 20 separate images.

## Resume after a crash

```bash
node scripts/render-frames.mjs ... --resume
```

The renderer skips existing files larger than 1 KB. If you changed the HTML,
delete the frames or use `--force`; stale frames are worse than a slow render.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Chromium not found` | pass `--chrome` or set `CHROME_BIN` |
| `The page does not expose a seek function` | add `window.__seek(t)` or pass `--seek-fn` |
| Render hangs at navigation | check the URL; use an absolute `file://` path or a local server |
| Frames are black | wait for `document.fonts.ready`; add `--ready`; check JS errors |
| UI appears in the video | add `--hide "#ui"` or support `?clean=1` |
| Output is 1080×2080 | viewport includes browser chrome; set `--width`/`--height` to the stage size |
| Audio is ahead/behind | match video duration to audio; use `-shortest`; hold the last frame |
| Render is very slow | use JPEG for review, PNG only for the master; don't launch Chromium per frame |
| Out of disk | render to a data drive, not `/tmp`; a 45 s 1080×1920 PNG sequence is ~1 GB |

## Hardware notes

- 1080×1920 PNG frames are roughly 0.7–1.2 MB each. A 45 s/24 fps render needs
  about 1 GB. Keep at least 2 GB free.
- One Chromium instance is reused for all frames. Do not spawn a browser per
  frame.
- `--disable-gpu` is the default for reliability. Use `--gpu` only if the page
  uses WebGL/Three.js and the software renderer is too slow or broken.
- On a headless Linux box, `--no-sandbox` is included. On macOS/Windows, the
  renderer still passes it; Chromium ignores it safely.
