# Visual language

## Routing

If the `bang-motion` skill is installed, use it for the style brief, scene
concepts, and anti-slideshow direction. This skill owns the production
contract: timing, HTML structure, captions, audio, render, QA.

If `bang-motion` is not installed, use the compact menu below. Do not try to
imitate its entire style system.

## The one rule

A scene is a **world**, not a slide. The camera moves through it, the subject
keeps existing, and new information enters the world. If the only thing that
changes between two shots is a title fading out and another fading in, it is a
slideshow.

## Compact style menu

Pick one and commit. A consistent B-grade style beats a mix of five A-grade
styles.

| Style | Background | Type | Motion | Good for |
|---|---|---|---|---|
| Paper / editorial | warm cream, ink, one red accent | huge grotesque, tight leading | camera push, torn-paper wipes, ruler lines | explainers, essays, data |
| Flat vector | solid color fields | heavy sans, one display face | pop-in, slide, bounce, shape wipes | product, finance, social |
| Neon grid | near-black, glow, perspective grid | chrome/condensed sans | camera fly-through, scanlines, glitch | tech, music, AI |
| Collage | paper texture, halftone, cutouts | mixed serif + marker | camera pans across a collage, parallax layers | culture, history, commentary |
| Whiteboard | white or light gray | marker/handwritten | draw-on lines, hand wipes | education, tutorials |
| Retro TV | beige plastic, CRT scanlines | chunky rounded sans | channel change, tracking distortion | nostalgia, entertainment |

## Camera language

Use at least one real camera move per scene:

- **Push in** — reveals detail, raises tension.
- **Pull out** — reveals context.
- **Pan / truck** — follows a subject or connects two ideas.
- **Orbit** — makes a flat composition feel dimensional.
- **Parallax** — foreground moves faster than background.
- **Whip / match cut** — carries energy across a cut.
- **Wipe** — a physical object crosses the frame and changes the world.

A camera that only breathes (scale 1.0 → 1.05) is not a move. It is a still
image with a pulse.

## Scene recipe

Per scene:

1. One dominant shape or subject (50–70% of attention).
2. One support element (type, object, or diagram).
3. One ambient layer (grid, grain, light, texture).
4. One action that changes the scene.
5. One exit: cut, wipe, match cut, or camera move.

Three to five elements. If you need more, split the scene.

## Type

- Maximum two type levels per scene: one big statement + one small label.
- Do not stack eyebrow + title + body + caption + footnote. That is a slide.
- Big type should be readable at 360 px wide. If it disappears on a phone,
  it is too small.
- Keep one accent color for the word that matters. Do not rainbow-highlight.
- Captions are a separate layer from the scene type. They can use a pill,
  stroke, or solid bar for contrast.

## Color

- 1 background, 1 ink, 2 accents. That is enough.
- Check contrast at 40% brightness; social video is watched on dim screens.
- Avoid pure `#000` and pure `#fff` for large fields; use near-black and warm
  off-white. It looks less like a template.
- If the brand palette is low contrast, use a dark pill behind the caption
  instead of changing the brand colors.

## Safe areas

### 9:16 (1080 × 1920)

- Top: keep 10% clear (status bar / platform header).
- Bottom: keep 20–22% clear for captions and platform UI.
- Right: keep 12% clear on TikTok/Reels (like/comment buttons).
- Caption baseline: around 20% from the bottom, not 5%.

### 16:9 (1920 × 1080)

- Keep 5% margin.
- Captions at 8–10% from the bottom.
- Avoid the lower-third if the platform adds a title bar.

### 1:1 (1080 × 1080)

- Keep 8% margin.
- Captions at 12% from the bottom.

## Motion rhythm

- Change something every 2–3 seconds: camera, subject, color field, or caption.
- Hold a strong frame for at least 0.5 seconds; do not machine-gun cuts.
- Use one signature move (a red wipe, a ruler, a paper tear) across the film.
  Repetition makes it feel directed, not random.
- Put the biggest visual change at the emotional turn, not at the first second.

## Anti-slideshow check

Before rendering, inspect the code and the contact sheet:

- [ ] No scene is just a `<section>` fading in and out.
- [ ] Every scene has a camera move or a subject action.
- [ ] Three to five elements per scene, entering in stages.
- [ ] No scene has three stacked type levels.
- [ ] No scene relies only on Ken Burns.
- [ ] Text lives inside the world, not in a floating card over a photo.
- [ ] The palette and type are consistent across scenes.
- [ ] Captions are inside the safe area and readable at 360 px.

If one box is unchecked, fix it before the full render.

## Accessibility

- No flashing faster than 3 times per second.
- Avoid rapid full-frame glitch sequences; if used, keep them under 0.3 s and
  never repeat more than three times.
- Captions must be burned in for silent autoplay.
- Do not encode meaning in color alone; pair color with a label or shape.
