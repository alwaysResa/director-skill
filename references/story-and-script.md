# Story and script

The video is audio-led. Lock the words and the voice-over before you animate.
A beautiful timeline with a weak script is still a weak video.

## 1. Intake

Ask only for what is missing. Defaults in parentheses.

- Topic or brief (required)
- Audience and platform (social feed)
- Aspect ratio: `9:16` (default), `16:9`, `1:1`
- Duration: `15`, `30`, `45`, `60`, or `90` seconds (default 30)
- Language (match the user; default Indonesian if they write Indonesian)
- Voice-over: user-provided file, TTS, or none
- Brand assets: logo, colors, type, product shots
- Claims that need a source

Write the locked answers to `brief.md`. Do not silently change them later.

## 2. Word budget

Words per second is a planning number, not a rule. Indonesian and English
land around 2.3–3.0 words/second for clear narration with pauses.

| Duration | Words (safe range) | Beats |
|---|---|---|
| 15 s | 35–45 | hook, one point, payoff |
| 30 s | 70–90 | hook, context, 3 beats, payoff |
| 45 s | 100–130 | hook, premise, 3 escalations, turn, CTA |
| 60 s | 140–170 | add one evidence beat |
| 90 s | 210–250 | two-act structure, one mid-turn |

If the script is over budget, cut a sentence, not the pauses. A 45-second
video with 160 words will feel rushed no matter how good the animation is.

## 3. Structures

### 15 seconds
1. Hook (0–2 s): a question, a paradox, or a visual shock.
2. Point (2–10 s): one concrete idea, one example.
3. Payoff (10–15 s): the line people repeat.

### 30 seconds
1. Hook (0–3 s).
2. Context (3–8 s): why this matters now.
3. Three beats (8–23 s): one idea each, one visual each.
4. Payoff + CTA (23–30 s).

### 45 seconds
1. Hook (0–3 s): the promise.
2. Premise (3–9 s): the world before the turn.
3. Escalation (9–24 s): three concrete consequences.
4. Consequence (24–34 s): the human cost.
5. Turn (34–41 s): what changes.
6. CTA (41–45 s): one action, not three.

### 60–90 seconds
Add evidence between escalation and consequence: a number, a quote, a
before/after. Keep one idea per 4–6 seconds.

## 4. Hook patterns that work

- **Direct question:** "What happens tomorrow if the internet never comes back?"
- **Paradox:** "The most connected generation is the least reachable."
- **Countdown:** "Three things stop working in the first hour."
- **POV:** "You wake up. The phone says no service."
- **Visual shock:** a familiar object behaving wrong.

Avoid "In this video we will..." and "Let's dive in." They delay the hook.

## 5. Script format

Use a table or a plain text file with timecodes:

```text
00:00–00:03  HOOK        Besok pagi, internet mati total.
00:03–00:09  PREMISE     Bukan cuma HP. ATM, bursa, bandara.
00:09–00:15  BEAT 1     Jam pertama: aplikasi berhenti.
...
00:41–00:45  CTA         Siap hidup tanpa internet?
```

Each line should be speakable in one breath. If a line needs a comma to
survive, it is probably two lines.

## 6. Voice-over

- Prefer the user's own voice. Do not clone a real person's voice without
  explicit permission.
- Keep the original VO file untouched. Pad silence at the start/end instead of
  time-stretching the voice.
- For TTS, freeze the voice profile in `brief.md` and reuse it for the whole
  video. Do not change narrator mid-film.
- Normalize for consistency, not for loudness: the final mix gets loudness
  treatment later.

## 7. Word cues

Whisper with word timestamps is the default:

```bash
whisper narration.mp3 --model base --language id \
  --word_timestamps True --output_format json
```

Normalize the result to:

```json
{
  "method": "whisper-base/id",
  "cues": [
    { "text": "Besok", "start": 0.15, "end": 0.55 },
    { "text": "pagi", "start": 0.55, "end": 0.95 }
  ]
}
```

Rules:
- Times are seconds, monotonic, no overlaps.
- Keep the spoken word, not a cleaned-up paraphrase.
- If the user corrects a word, correct the text but keep the timing.
- Verify the first and last cue against the audio; Whisper often clips the
  first syllable.

No Whisper? Use `ffmpeg -af silencedetect` to find pauses, then split the
script manually. A rough cue sheet is better than captions that drift.

## 8. Storyboard

One row per beat:

| Time | Shot | Camera | Action | Caption | SFX |
|---|---|---|---|---|---|
| 0–3 | bedroom, phone | push in | phone lights up, no service | — | room tone |
| 3–9 | city | pan right | billboard corrupts | PERTAMA | glitch |

Rules:
- 3–5 visual elements per scene, entering in stages.
- A cut must change the world or the camera, not just the text.
- Put the caption on the storyboard, not only in the script.
- Mark the exact cut times.

## 9. Gate

Do not build the full animation until the script and VO are approved (or the
user explicitly says "gas" after seeing them). If the user changes the script
after animation starts, re-time the cues and re-render the affected scenes.

## 10. Facts

Never invent a statistic, quote, or product claim. If the video makes a factual
claim, put the source in `brief.md` and show it on screen when the claim is
specific. Fiction and metaphor are fine; fake evidence is not.
