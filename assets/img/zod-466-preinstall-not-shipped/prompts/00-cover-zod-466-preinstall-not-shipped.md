---
type: cover
topic: zod-466-preinstall-not-shipped
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
backend: runtime-native image tool (ImageGen) — returned HTTP 403 `{"code":"112"}` twice, so the
         documented fallback was used: hand-written SVG rasterized with headless Chrome
candidates: 2 (A: commit card left / dashed slot right; B: mirrored composition) — A selected by
         the 320px thumbnail test (same horizontal line for mustard bar and empty slot, label below
         the subject keeps top/bottom whitespace balanced); B deleted
watermark: none possible — the raster came from local SVG + headless Chrome, no third-party
           image backend was involved
palette: warm off-white ground + deep ink shapes + mustard/teal accents
text: ASCII short label only — "in git · not in npm"
---

# Cover prompt (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for a software-supply-chain forensics article.

THE ONE CONFLICT THIS IMAGE MUST STATE: the same version number exists in two places with two
different contents — a git commit that contains a malicious `preinstall` hook, and the npm package
that was actually published, which does not contain it. Nothing else in the image may compete
with that idea.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1024. Put the entire subject inside the horizontal band between 40% and 60% of the
  canvas height, and make the subject TALL enough to fill that band (it must read as two big
  objects, never as a thin crowded strip of small marks).
- At least 40% of the canvas is empty ground. No element may touch the top or bottom edge.
- Subject sits left-of-center; the right third is open ground (gaze exit).
- Exactly two objects, side by side, same height, clearly separated by a visible gap:
  1. LEFT: a git commit card — a deep ink (#1E2A32) rounded rectangle with 4 short cream monospace
     bars standing in for diff lines. The third bar is mustard (#C8892E), slightly longer than the
     others, and carries a tiny solid dot. This is the malicious hook line.
  2. RIGHT: an npm package box — a teal (#2E7D74) outlined rectangle, same height, with 3 cream
     bars, and in the position matching the left card's mustard bar an EMPTY dashed slot
     (dashed mustard outline, nothing inside). The emptiness is the point: it must be the largest
     negative space in the image.
- Between the two objects, at their vertical center, one clean typographic mark: `≠`
  (not-equal sign), deep ink, medium weight, no glow, no arrow.

TEXT (only this, nothing else):
- `in git · not in npm` set in a clean geometric sans, deep ink, small caps, placed BELOW the two
  objects, horizontally centered under the gap. ASCII characters only. No other letters, no
  numbers, no Chinese characters anywhere in the image.

STYLE AND COLOR:
- Warm off-white ground (#F2EFE9), flat vector shapes with crisp 2px outlines, no gradients,
  no shadows, no texture, no isometric perspective, no 3D.
- Two accents only: mustard #C8892E and teal #2E7D74. Everything else is deep ink or ground.
- High figure-to-ground contrast so the two objects still read at 320px wide.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing spheres/orbs, isometric tech cubes, circuit boards, padlocks, shields,
  skulls, bugs, magnifying glasses, hooded hacker figures, red alarm text, explosions, sirens,
  arrows pointing at things, speech bubbles, confetti.
- an all-dark canvas, or an all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, or logo.

---

## Selected source (fallback path: SVG -> headless Chrome)

Rasterized with:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --window-size=1600,906 --default-background-color=00000000 \
  --user-data-dir=/tmp/shot-$(date +%s) --screenshot=banner-A.png file:///tmp/pret1012/coverA.svg
```

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 906" width="1600" height="906">
  <rect width="1600" height="906" fill="#F2EFE9"/>
  <rect x="200" y="283" width="460" height="340" rx="18" fill="#1E2A32"/>
  <rect x="240" y="330" width="300" height="26" rx="13" fill="#F2EFE9" opacity="0.86"/>
  <rect x="240" y="386" width="240" height="26" rx="13" fill="#F2EFE9" opacity="0.86"/>
  <rect x="240" y="442" width="330" height="26" rx="13" fill="#C8892E"/>
  <circle cx="600" cy="455" r="13" fill="#C8892E" stroke="#F2EFE9" stroke-width="4"/>
  <rect x="240" y="498" width="210" height="26" rx="13" fill="#F2EFE9" opacity="0.86"/>
  <rect x="780" y="283" width="460" height="340" rx="18" fill="none" stroke="#2E7D74" stroke-width="6"/>
  <rect x="820" y="330" width="300" height="26" rx="13" fill="#1E2A32"/>
  <rect x="820" y="386" width="240" height="26" rx="13" fill="#1E2A32"/>
  <rect x="820" y="442" width="210" height="26" rx="13" fill="#1E2A32"/>
  <rect x="820" y="498" width="330" height="26" rx="13" fill="none" stroke="#C8892E" stroke-width="5" stroke-dasharray="14 11"/>
  <g stroke="#1E2A32" stroke-width="9" stroke-linecap="round">
    <line x1="694" y1="438" x2="746" y2="428"/>
    <line x1="694" y1="470" x2="746" y2="460"/>
  </g>
  <text x="720" y="712" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="46" letter-spacing="7" fill="#1E2A32" text-anchor="middle">in git · not in npm</text>
</svg>
```
