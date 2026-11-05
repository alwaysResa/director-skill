# The 32 MiB inline-media budget

## The error

```text
Upstream request failed: [airlock_error] inlined media exceeds the 33554432 byte total limit
```

`33,554,432` bytes = **32 MiB**. This is not the size of the project on disk and
not the size of the final MP4. It is the total media **embedded in a model
request**.

## Why it happens

1. An image is read into the conversation. It is sent as base64, which is about
   **4/3** the file size.
2. The entire conversation is sent again on every step. Every earlier image is
   still in the payload.
3. A batch of 20 full-resolution screenshots (1080×2080 PNG, ~19 MB) becomes
   ~25 MB base64. Add earlier images and the next request crosses 32 MiB.
4. Once the gateway rejects the request, every later message in that session
   fails too — even a plain "lanjut" — because the old images are still in the
   history.

This is a session-level trap, not a one-frame problem.

## Proactive protocol

Before reading review images:

```bash
node scripts/media-budget.mjs review/*.jpg
```

Rules:

- Review frames at **360–405 px** wide, JPEG quality 65–70. A frame should be
  **20–60 KB**, not 1 MB.
- Maximum **4–6 images per message**.
- Prefer **one contact sheet** (6×4 at 180–216 px per tile) over 20 separate
  frames. A good sheet is 200–500 KB.
- If you need to check small text, crop the text area and send that crop instead
  of the full frame.
- Never attach WAV/MP3/MP4 to chat. Use `ffprobe`, a waveform PNG, or a small
  contact sheet.
- Do not "just read all frames to be safe." Read the sheet, then 3–4 suspect
  frames at a readable size.

## Budget math

| Item | Raw | Inlined (base64) |
|---|---:|---:|
| one 1080×1920 PNG | ~1.0 MB | ~1.33 MB |
| one 405×720 JPEG q70 | ~40 KB | ~53 KB |
| one 6×4 contact sheet | ~300 KB | ~400 KB |
| 22 full-res screenshots | ~19 MB | ~25 MB |
| 22 full-res + earlier 6 images | ~24 MB | ~32 MB |

The last row is how a session dies.

## Recovery

If the error already happened:

1. **Start a new session.** Do not keep retrying "lanjut" in the dead one.
2. Do not re-attach the old images. Reference files by path and read only the
   small review assets.
3. Write a short handoff file with: project path, current HTML, audio file,
   duration, fps, last approved frame, and what to do next.
4. Compaction may not help; it often sends the same media again. A fresh session
   is the reliable fix.
5. The project files are fine. Do not delete or "compress the video" to fix a
   model request error.

## What not to do

- Do not compress the final MP4 to fix this error. The MP4 is not in the
  request unless you attach it.
- Do not delete source frames or assets to "reduce the project size." The
  gateway counts request media, not folder size.
- Do not read 20 frames "just to compare." Use a sheet.
- Do not attach a 51 MB master to chat. If sharing is required, use the 720p
  preview (often 8–15 MB) and still prefer a file link over inline media.

## Script

```bash
# table with raw and base64 sizes
node scripts/media-budget.mjs review/contact-sheet.jpg review/crop-caption.jpg

# JSON for automation
node scripts/media-budget.mjs --json frames/*.png
```

Thresholds:

- `>= 24 MB` → WARN (close to the limit)
- `>= 32 MiB` → FAIL (exit 1; do not send)

The script only measures the new batch. The model also re-sends earlier images,
so a 20 MB batch can still fail if 15 MB of images are already in history.

## A safe review loop

1. Render 3–6 keyframes at 540×960 JPEG.
2. Make one contact sheet.
3. Read the sheet.
4. If something is wrong, crop that area (one small image) and read it.
5. Fix the HTML.
6. Re-render only the affected frames.
7. Full render.

This loop uses a few hundred KB of media instead of tens of megabytes.
