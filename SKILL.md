---
name: director
description: "End-to-end AI video director for HTML-based motion videos: explainers, educational, promo, kinetic typography, 9:16/16:9/1:1. Turns a brief or script into a finished MP4: story beats, deterministic HTML/Canvas/GSAP timeline, VO alignment, karaoke captions, SFX, frame-perfect Chromium render, ffmpeg mux, QA, and delivery. Use when the user asks to make a video with HTML, render an HTML animation to MP4, export frame-perfect video, add voice-over/captions/audio to a motion piece, review a video with a contact sheet, or when a session hits \"inlined media exceeds the 33554432 byte total limit\". For pure visual style direction, prefer bang-motion if installed."
license: MIT
metadata:
  author: Francesa de nayra
  version: "0.1.0"
  updated: "2026-11-05"
  homepage: https://github.com/alwaysResa/director-skill
---

# Director

Director is the production layer for HTML motion videos. It takes a brief,
script, or existing `index.html` and carries it to a finished MP4 with audio,
captions, a deterministic timeline, QA, and delivery.

It is not a magic video generator. The agent writes the animation; Director
enforces the contract that makes it render correctly.

## Positioning

- If `bang-motion` is installed, use it for style, scene concepts, and
  anti-slideshow direction. Use Director for **production**: timing, HTML
  contract, audio, captions, render, QA, delivery.
- If `bang-motion` is not installed, use the compact style menu in
  `references/visual-language.md`.
- If the user already has an `index.html` animation, start at Phase 4 or 5.
- If the user only wants a quick fix to an existing video, use the relevant
  phase and skip the rest.

Do not duplicate a full style system here. Do not copy text or assets from
`bang-motion`; link to it instead.

## Non-negotiables

1. **Audio-led.** Get the VO or final audio duration before animating. Never
   time-stretch a real voice to fit a cut.
2. **Deterministic HTML.** Every frame must be renderable from a time `t` via
   `window.__seek(t)`. No wall-clock time or unseeded randomness in render.
3. **Frames, not screen recording.** Render frame by frame with Chromium. A
   screen recording drops frames and is not acceptable for delivery.
4. **Review small.** 3–6 keyframes and one contact sheet before the full
   render. Never read 20 full-resolution frames into the model.
5. **QA before delivery.** Full decode, loudness, duration, frame count, first
   and last frame, caption safe area. A successful encode is not acceptance.
6. **Protect the session.** Respect the 32 MiB inline-media budget. A dead
   session costs more than a smaller contact sheet.

## Preflight

Run these checks before planning:

```bash
node --version                 # >= 22 (global WebSocket)
ffmpeg -version
ffprobe -version
which chromium || which google-chrome || echo "set CHROME_BIN"
```

Inspect the project:

- `index.html` or the intended HTML file
- voice-over / audio mix
- script, cue sheet, `word-cues.json`
- existing render, frames, contact sheet
- `README.md` or production notes

Confirm:

- aspect ratio (default 9:16)
- duration (default 30 s; use the audio duration if VO exists)
- fps (default 24; do not convert 24 to 30 without a reason)
- language and voice
- whether the user wants a preview gate or "langsung gas"

If an existing HTML has no `window.__seek(t)`, add one before rendering. See
`references/html-contract.md`.

## The seven phases

### Phase 1 — Intake

Ask only for missing information. Write `brief.md` with the locked decisions:

- topic, audience, platform
- ratio, duration, fps
- language, voice-over mode
- brand assets and claims
- delivery format

Gate: no need for approval if the user already gave a complete brief. If key
choices are missing, ask once, in one message.

### Phase 2 — Script

Write the script to `script.md` with timecodes. Use the word budget in
`references/story-and-script.md`.

- Hook in the first 2–3 seconds.
- One idea per 3–5 seconds.
- 45 s ≈ 100–130 words, not 180.
- End with one action, not three.
- Keep facts sourced; never invent a statistic.

Gate: show the script and/or VO to the user before building the full animation.
If they say "gas" after seeing it, proceed.

### Phase 3 — Audio

1. Get the VO file. Keep the original untouched.
2. Measure duration with `ffprobe`.
3. Align words with Whisper or a manual cue sheet → `word-cues.json`.
4. Add SFX/music. Duck under the VO.
5. Mix and normalize to -16 LUFS, true peak ≤ -1.0 dBTP.
6. Set `DUR` from the final mix, plus a short tail if needed.

Gate: the first and last cue match the audio. The user should listen before the
final render; the agent cannot judge intelligibility.

### Phase 4 — Storyboard and HTML

Write a storyboard table: time, shot, camera, action, caption, SFX.

Build a single `index.html` from `assets/starter/index.html` or the existing
project. Follow `references/html-contract.md`.

Minimum:

- fixed design size (1080×1920, 1920×1080, or 1080×1080)
- `window.DUR`, `window.FPS`, `window.__seek(t)`
- one camera move or subject action per scene
- 3–5 elements per scene
- captions inside the safe area
- `?clean=1` hides UI; `#ui` is the hide target
- local fonts and audio; no CDN at playback

Gate: render 3–6 keyframes and one contact sheet. Inspect before the full
render.

### Phase 5 — Review

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out review/frames \
  --width 540 --height 960 --fps 24 --duration 45.6 \
  --start 0 --end 120 \
  --format jpeg --quality 82 --hide "#ui"
```

Then:

```bash
python3 scripts/contact-sheet.py review/frames/f*.jpg \
  --out review/contact-sheet.jpg --cols 6 --width 216 --fps 24
```

Read the sheet, not 20 individual frames. If a detail is unclear, crop that
area and read the crop. Fix the HTML and re-render only the affected frames.

Gate: composition, caption legibility, cut boundaries, and safe area pass.

### Phase 6 — Render

```bash
node scripts/render-frames.mjs \
  --url "file:///abs/path/index.html" \
  --out render/frames \
  --width 1080 --height 1920 --fps 24 --duration 45.6 \
  --hide "#ui"
```

Mux:

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

Make a 720p preview for sharing. Keep the master.

Gate: frame count matches `ceil(duration × fps)`. No page errors in
`render-info.json`.

### Phase 7 — QA and delivery

```bash
node scripts/qa-video.mjs internet-mati-total.mp4 \
  --width 1080 --height 1920 --fps 24 --duration 45.6
```

Check:

- full decode
- loudness and true peak
- first/last frame
- both sides of every cut
- captions and safe area
- no UI in frame

Deliver:

- master MP4
- 720p preview
- contact sheet
- `README.md` with specs and render command
- optional SRT/VTT, poster, audio mix

Ask the user to watch with sound. Do not declare done from an encode alone.

## HTML contract (summary)

- `window.__seek(t)` renders synchronously.
- `window.DUR` and `window.FPS` are exposed.
- All motion derives from `T`.
- Fonts are local and awaited.
- The renderer hides `#ui`; the page also supports `?clean=1`.
- Audio is muxed later; it is not played during capture.
- The last frame is held for the audio tail.

Full details and a skeleton: `references/html-contract.md`.

## Audio and captions (summary)

- VO first; duration drives the video.
- Word cues in one JSON; captions generated from it.
- One line per cue; 56–64 px at 1080×1920; bottom 20–22%.
- Highlight one keyword, not every word.
- Mix to -16 LUFS, true peak ≤ -1 dBTP.
- The user listens; the agent checks numbers.

Full details: `references/audio-captions.md`.

## The 32 MiB rule

The gateway rejects a request when total inlined media exceeds **33,554,432
bytes (32 MiB)**. Base64 adds ~33%; earlier images are re-sent on every step.

Before reading review media:

```bash
node scripts/media-budget.mjs review/*.jpg
```

Rules:

- 360–405 px JPEG, 20–60 KB per frame.
- Max 4–6 images per message.
- One contact sheet instead of 20 frames.
- Crop small text instead of sending the full frame.
- Never attach WAV/MP3/MP4 to chat.

If the error already happened: start a new session, reference files by path,
do not re-read the old images. Compaction often fails because it sends the same
media again. Full recovery: `references/media-budget.md`.

## Renderer

`scripts/render-frames.mjs` drives one Chromium instance over CDP:

- no Puppeteer/Playwright
- Node >= 22 + Chromium + ffmpeg
- resumable (`--resume`)
- PNG for master, JPEG for review
- hides `#ui`
- waits for fonts, then two `requestAnimationFrame`
- fails on JavaScript exceptions
- writes `render-info.json`

Flags and troubleshooting: `references/render-pipeline.md`.

## QA

`scripts/qa-video.mjs` checks:

- H.264, width/height, fps, `yuv420p`
- AAC audio
- duration and frame count
- full decode
- integrated loudness and true peak

Plus human checks: contact sheet, cuts, captions, safe area, actual playback
with sound. Full checklist: `references/delivery-qa.md`.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `inlined media exceeds 33554432` | too many full-res frames | new session + small contact sheet |
| black frames | page not ready / no seek | wait fonts, add `--ready`, check JS |
| UI in video | `#ui` not hidden | `--hide "#ui"` + `?clean=1` |
| audio drift | video/audio duration mismatch | audio-led `DUR`, hold last frame |
| dropped/duplicate frames | wrong `-framerate`/`-r` | use `-framerate 24` and 24 fps source |
| huge MP4 | CRF too low | CRF 20–23, 720p preview |
| text overflow | no max width / safe area | wrap, shrink, or split cue |
| session dead | media history already over limit | new session, handoff file |

## References

| File | Use |
|---|---|
| `references/story-and-script.md` | intake, word budget, structures, cue JSON |
| `references/visual-language.md` | style menu, camera, safe areas, anti-slideshow |
| `references/html-contract.md` | `window.__seek`, determinism, fonts, captions |
| `references/audio-captions.md` | VO, alignment, karaoke, SFX, mix |
| `references/render-pipeline.md` | renderer, ffmpeg, preview, troubleshooting |
| `references/media-budget.md` | 32 MiB error, review protocol, recovery |
| `references/delivery-qa.md` | structural QA, contact sheet, final checklist |

## Definition of done

- [ ] Brief and script approved (or user said "gas" after seeing them).
- [ ] VO and word cues match; first/last cue verified.
- [ ] HTML exposes `window.__seek(t)` and is deterministic.
- [ ] 3–6 frame review + contact sheet passed.
- [ ] Full render frame count matches.
- [ ] Full decode passes; loudness and true peak in range.
- [ ] No UI, no black gaps, captions safe.
- [ ] User watched the actual MP4 with sound.
- [ ] Master + 720p + contact sheet + README delivered.
- [ ] No large media attached to chat; paths only.
