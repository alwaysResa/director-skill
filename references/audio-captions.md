# Audio and captions

## Audio-led timing

1. Get the voice-over first.
2. Measure its duration (`ffprobe`).
3. Align words.
4. Build the animation to the audio.
5. Add SFX/music.
6. Mix and normalize.
7. Render the video to the final audio duration.

Do not animate first and squeeze the VO in later. That is how captions drift
and scenes feel rushed.

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 voice.mp3
```

## Voice-over rules

- Keep the original VO file untouched. Pad silence at the start/end if needed.
- Do not time-stretch or pitch-shift a real voice to fit a cut.
- If the VO is longer than the target, cut script lines, not syllables.
- If using TTS, freeze the voice profile (name, language, pace) in `brief.md`
  and use it for the whole video. Do not switch narrator mid-film.
- Do not clone a real person's voice without explicit permission.

## Word alignment

### Whisper

```bash
whisper voice.mp3 --model base --language id \
  --word_timestamps True --output_format json
```

Normalize to `word-cues.json`:

```json
{
  "method": "whisper-base/id",
  "cues": [
    { "text": "Besok", "start": 0.15, "end": 0.55 },
    { "text": "pagi", "start": 0.55, "end": 0.95 }
  ]
}
```

Check:

- First cue starts at the first audible syllable.
- Last cue ends before the file ends.
- No overlaps, no gaps longer than a breath.
- Text matches what is actually spoken. If the user corrected a word, keep the
  timing but fix the text.

### No Whisper

Use `ffmpeg` silence detection to find pauses, then split the script manually:

```bash
ffmpeg -i voice.mp3 -af silencedetect=noise=-32dB:d=0.18 -f null - 2>&1 \
  | grep silence
```

A rough manual cue sheet is better than automatic captions that drift.

## Caption design

- One line per cue. If a cue needs two lines, split it into two cues.
- Font size for 1080×1920: 56–64 px, weight 800–900.
- Bottom position: 20–22% from the bottom. Do not put captions at 5%.
- Maximum width: 86% of the frame.
- Use a solid pill or a thick stroke. White text alone disappears on light
  backgrounds.
- Highlight one keyword per cue. Example: `MATI` in yellow, the rest white.
- Keep punctuation; it helps reading.
- Do not animate every word with a different effect. One pop or slide is enough.

### Karaoke (only when requested)

If the user asks for word-by-word karaoke:

- One word per cue.
- Highlight the current word, keep the rest of the line visible if possible.
- Use a 0.15–0.2 s pop; do not bounce for 0.5 s.
- Keep the line width stable; do not re-center every word.
- Record the deviation from semantic captions in the delivery notes.

### Safe area

For 9:16, keep the caption above the bottom 20% and away from the right 12%
(TikTok/Reels UI). Preview on a phone-sized viewport, not only on the desktop.

## SFX and music

- SFX supports the cut, it does not replace it. A whoosh cannot fix a weak
  transition.
- Duck music under the VO. If the VO is the point, music should be felt, not
  heard.
- Keep one continuous bed for the whole film; do not restart the music every
  scene.
- Procedural SFX are fine and copyright-clean. Small palette: whoosh, click,
  impact, riser, glitch, pop, paper tear.
- Do not use a copyrighted track unless the user supplied it and has rights.

## Mix

Example: VO + SFX, ducking, loudness normalization.

```bash
ffmpeg -y \
  -i voice.mp3 -i sfx.wav \
  -filter_complex "\
[0:a]volume=1.0[vo];\
[1:a]volume=0.8,highpass=f=80[sfx];\
[vo][sfx]amix=inputs=2:duration=longest:normalize=0,\
loudnorm=I=-16:TP=-1.5:LRA=11[out]" \
  -map "[out]" -c:a aac -b:a 192k -ar 44100 audio-mix.m4a
```

Target for social video:

- Integrated loudness: **-16 LUFS** (acceptable -18 to -14).
- True peak: **≤ -1.0 dBTP** (-1.5 is safer).
- No clipping, no long silence at the head.

Check:

```bash
ffmpeg -i audio-mix.m4a -af loudnorm=print_format=summary -f null - 2>&1 \
  | grep -E "Input Integrated|Input True Peak|Input LRA"
```

The agent cannot hear the mix. The user must listen on headphones or a phone
speaker before delivery. A passing loudness number does not prove the VO is
intelligible.

## Audio in the HTML

```html
<audio id="aud" src="audio-mix.m4a" preload="auto"></audio>
```

- For preview, sync `audio.currentTime = T` when drift exceeds ~0.2 s.
- Do not autoplay with sound on page load; browsers block it. Start on the
  first click or the Play button.
- The renderer never plays the audio. It captures silent frames; mux later.
- If the animation is 45.0 s and the mix is 45.6 s, render 45.6 s and hold the
  last frame for the 0.6 s tail.

## Captions as data

Keep the cue list in one place. If you generate a VTT, parse it into the same
`words` array the renderer uses. Do not maintain two independent caption
timings.

```js
const words = cues.map(c => ({
  s: c.start, e: c.end, w: c.text
}));
```

When the user changes one word, change it in the cue JSON and regenerate the
VTT. Never hand-edit the rendered HTML text without updating the cue data.
