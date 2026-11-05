# Delivery QA

A successful encode is not acceptance. Check the picture, the sound, and the
files before declaring done.

## 1. Structural QA

```bash
node scripts/qa-video.mjs internet-mati-total.mp4 \
  --width 1080 --height 1920 --fps 24 --duration 45.6
```

Pass criteria:

- Video stream: H.264, expected width/height, expected fps.
- Pixel format: `yuv420p`.
- Audio stream: AAC, 44.1 kHz or 48 kHz.
- Duration within ±0.2 s of the audio.
- Full decode: no errors.
- Integrated loudness: -16 LUFS ±2.
- True peak: ≤ -1.0 dBTP.

Warnings are not automatically failures. Read them. If the video is silent by
design, mark it as intentional.

## 2. Frame count

```bash
ls render/frames/f*.png | wc -l
```

Expected: `ceil(duration × fps)`.

- 5.0 s × 24 = 120
- 45.6 s × 24 = 1095
- 30 s × 30 = 900

If the count is short, the render crashed or `--end` was wrong. If it is long,
check `--duration` and the audio tail.

## 3. Contact sheet

Build one sheet from the encoded frames or the rendered frames:

```bash
python3 scripts/contact-sheet.py render/frames/f00000.png render/frames/f00024.png \
  render/frames/f00048.png render/frames/f00072.png \
  --out review/contact-sheet.jpg --cols 4 --width 270 --fps 24
```

Inspect:

- [ ] Every scene is present.
- [ ] Both sides of every cut are correct; no flash frame, no black gap.
- [ ] Captions are inside the safe area and not clipped.
- [ ] No UI buttons, debug panels, or browser chrome.
- [ ] No accidental 3-tier text stack.
- [ ] Palette and type are consistent.
- [ ] The first and last frames are intentional (not black by accident).
- [ ] No frame is a duplicate of the previous scene because the renderer
      failed to seek.

## 4. Key frames

Read 3–6 full-size (but small JPEG) frames:

- First frame of the film.
- The hook frame.
- One frame per scene.
- The emotional turn.
- The CTA / last frame.
- Both sides of the most complex cut.

Do not read 20 full-resolution PNGs. Use 405×720 JPEGs or crops.

## 5. Motion check

A contact sheet cannot show timing. Watch the actual MP4 at 1× speed:

- [ ] Captions are in sync with the voice.
- [ ] No caption flicker or double text.
- [ ] Camera moves are smooth, no jump at the loop point.
- [ ] Cuts land on the intended beat.
- [ ] The last frame holds long enough for the audio tail.
- [ ] No unintended flash or rapid strobing.

The agent cannot hear the mix. The user must listen on headphones or a phone
speaker. Mark that review as pending until they do it.

## 6. Caption check

- [ ] One line per cue; no overflow.
- [ ] Keyword highlight is readable on every background.
- [ ] Captions do not cover the subject's face or the key prop.
- [ ] 9:16: bottom 20% and right 12% are clear.
- [ ] 16:9: captions are above the lower-third.
- [ ] Spelling matches the approved script.
- [ ] The first and last cue are timed to the actual audio.

If karaoke was requested, note the deviation from semantic captions in the
delivery notes.

## 7. File checks

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels \
  -of default=noprint_wrappers=1 internet-mati-total.mp4
sha256sum internet-mati-total.mp4 internet-mati-total-720p.mp4
```

Deliver:

- Master MP4 (1080×1920 or 1920×1080, CRF 18).
- 720p preview (for sharing).
- Contact sheet (200–500 KB).
- `README.md` with the render command and specs.
- Optional: SRT/VTT sidecar, poster frame, project HTML, audio mix.

Do not deliver only a 51 MB master in chat. Give the path and a small preview.

## 8. User review

Ask the user to watch the actual file with sound. Specific prompts:

- "Apakah ada frame yang aneh atau caption yang kepotong?"
- "Apakah tempo terasa terlalu cepat/lambat?"
- "Apakah audio VO jelas di atas SFX?"
- "Apakah ending/CTA sudah sesuai?"

Do not ask "sudah bagus?" only. Specific questions get useful revisions.

## 9. Revision loop

When the user requests a change:

1. Identify the affected time range.
2. Edit the HTML/audio/caption source, not the rendered MP4.
3. Re-render only the affected frames if the renderer supports it, or re-render
   the full film if the timeline changed.
4. Rebuild the contact sheet and QA the changed region.
5. Keep the previous master until the new one passes.

Never patch the MP4 with a text overlay in ffmpeg if the HTML source is
available; the next render will lose the fix.

## 10. Final checklist

- [ ] Script and VO approved.
- [ ] HTML is deterministic (`window.__seek`).
- [ ] Audio mix is -16 LUFS / ≤ -1 dBTP.
- [ ] Full render frame count matches.
- [ ] Full decode passes.
- [ ] Contact sheet reviewed.
- [ ] Captions and safe area checked.
- [ ] User watched with sound.
- [ ] Master + 720p + README delivered.
- [ ] No large media attached to chat; paths only.
