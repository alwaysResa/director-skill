# HTML contract

The renderer is dumb on purpose: it asks the page for a time, waits two frames,
and captures the viewport. The page must be deterministic at any time `t`.

## Required globals

```js
window.DUR = 45;          // seconds
window.FPS = 24;          // frames per second
window.__seek = (t) => {  // must render the frame at t, synchronously
  T = clamp(t, 0, DUR);
  render();
};
```

The renderer calls `window.__seek(t)` then waits two `requestAnimationFrame`
callbacks before `Page.captureScreenshot`. It never plays the audio during
capture.

## Determinism rules

Every visual value must be a function of `T`:

- No `Date.now()`, `performance.now()`, or wall-clock time inside `render()`.
- No unseeded `Math.random()` in `render()`. Precompute a noise tile or use a
  seeded PRNG.
- GSAP timelines must be seeked, not left playing. Example:
  `tl.pause(); tl.time(T);` inside `render()`.
- CSS animations are not deterministic enough for frame rendering. Use JS or
  GSAP for anything that must be captured. A static CSS transition that has
  already finished is fine.
- Video elements are not deterministic across seeks. Avoid, or use a
  frame-accurate `currentTime` and wait for `seeked` (advanced).
- If a scene uses a canvas animation loop, the loop must draw from `T`; the
  renderer will not wait for a real-time loop to catch up.

## Stage and viewport

- Fixed design size: `1080 × 1920` for 9:16, `1920 × 1080` for 16:9,
  `1080 × 1080` for 1:1.
- Canvas width/height must equal the design size. Do not rely on
  `devicePixelRatio` for the final render; the renderer sets the viewport and
  scale explicitly.
- Center the stage with a `fit()` function for browser preview. At the exact
  render viewport, the transform must resolve to scale 1 and translate 0.
- `overflow: hidden` on `html, body`; no scrollbars in frame.

## Clean mode

The renderer hides `#ui` by default (`--hide "#ui"`). The page should also
support:

```js
const qp = new URLSearchParams(location.search);
if (qp.has('clean')) document.body.classList.add('clean');
```

```css
body.clean #ui { display: none }
```

Use `?clean=1` for manual screenshots and `--hide "#ui"` for the renderer.
Remove or hide any debug panel, scrub bar, FPS counter, or play button.

## Fonts

- Prefer local `@font-face` files next to the HTML. A render must not depend on
  a CDN.
- Wait for fonts before the first capture. The renderer does
  `document.fonts.ready`, but the page should also render once after fonts load:

```js
document.fonts.ready.then(() => { render(); });
```

- If a font fails to load, the fallback must still look acceptable. Test with
  the network disabled.
- Do not use `font-display: swap` for the final render unless you accept a
  flash of fallback; use `font-display: block` or preload.

## Audio

```html
<audio id="aud" src="audio-mix.m4a" preload="auto"></audio>
```

- The renderer does not play or capture audio. Mux it with ffmpeg after the
  frames are rendered.
- For browser preview, sync `audio.currentTime` to `T` when the drift exceeds
  ~0.2 s.
- Keep the original VO file; only pad silence or mix. Do not time-stretch the
  voice to fit the animation.
- The video duration may be longer than the animation; hold the last frame for
  the audio tail. Example: animation 45.0 s, audio 45.6 s, render 45.6 s with
  the last 0.6 s as a held frame.

## Captions

Captions can be DOM or canvas. DOM is easier to style and capture.

```html
<div id="caption"><span id="cap"></span></div>
```

Rules:

- One line, or at most two short lines.
- Bottom 20–22% for 9:16; 8–10% for 16:9.
- Set text only when the cue changes; do not thrash `innerHTML` every frame.
- Highlight one keyword with a `<b>` or a class; do not color every word.
- Keep the caption inside a solid pill, stroke, or shadow so it survives any
  background.
- Burned-in captions are required for silent autoplay. Sidecar SRT/VTT is
  optional.

## Camera pattern

```js
function render() {
  ctx.clearRect(0, 0, W, H);
  const k = smooth(T / DUR);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(lerp(-0.006, 0.01, k));
  ctx.scale(1.02 + 0.1 * k, 1.02 + 0.1 * k);
  ctx.translate(-W / 2, -H / 2);
  scene(T);
  ctx.restore();
  post(T);
}
```

Draw the background larger than the canvas (e.g. `-1200` to `W+1200`) so a
camera push never reveals an edge.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Black or blank frames | render happens before fonts/JS ready | wait `document.fonts.ready`, add `--ready` expression |
| UI buttons in the video | `#ui` not hidden | pass `--hide "#ui"` or support `?clean=1` |
| Frame is 1080×2080 with black bars | viewport taller than stage | set viewport exactly to stage size; don't screenshot browser chrome |
| Text reflows between frames | CSS layout depends on viewport or animation | fix the design size; use canvas or absolute positioning |
| Caption pops late/early | DOM uses real-time GSAP | drive caption text/scale from `T` |
| Audio drifts | video duration ≠ audio duration | audio-led duration; hold last frame for the tail |
| Render is slow | launching Chromium per frame | use one browser instance (the provided renderer does) |
| `Page.captureScreenshot` timeout | huge canvas or WebGL | reduce size for review; enable `--gpu` only if needed |
| Fonts wrong on another machine | CDN or missing font | bundle the font file and license |

## Manual test

```bash
# one frame at 3.2s, no UI
node scripts/render-frames.mjs \
  --url "file://$(pwd)/index.html" \
  --out /tmp/one --width 1080 --height 1920 --fps 24 \
  --start 76 --end 76 --hide "#ui"
```

Open the PNG. If it is blank, fix the page contract before rendering 1,000
frames.
