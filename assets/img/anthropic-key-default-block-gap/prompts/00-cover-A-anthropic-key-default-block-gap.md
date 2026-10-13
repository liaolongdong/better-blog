---
type: cover
topic: anthropic-key-default-block-gap
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
backend: runtime-native image tool (ImageGen); if it errors, documented fallback = hand-written SVG
         rasterized with headless Chrome (see the "Selected source" section appended after selection)
candidates: 2 (A: ink card left + 48-slot switch panel right, joined by ≠; B: 48-slot panel fills the
            band and the claim is a single mustard bar floating above it, not connected) — selection
            by the §8.2.2 320px thumbnail test, loser deleted
watermark: must be none — measure the bottom band of the raster before acceptance
palette: warm off-white ground + deep ink shapes + mustard/teal accents
text: ASCII short label only — "says default · 45 of 48 off"  (6 words, 2 groups, each word ≤20 chars)
---

# Cover prompt A (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for a security-configuration fact-check article.

THE ONE CONFLICT THIS IMAGE MUST STATE: an official changelog line says a new block rule applies
"by default", and the repository switch panel on the other side of the image shows that the same
rule is OFF in 45 out of 48 slots. Nothing else in the image may compete with that idea. Do NOT
draw a hack, a thief, a virus, an alarm, or a warning triangle — the conflict is a documentation
claim versus a config reading, and it must look like that.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1024. The entire subject sits inside the horizontal band between 40% and 60% of the
  canvas height counted as the band's CENTER LINE: the two objects together must be about 340px
  tall and vertically centered, so they fill the band instead of forming a thin crowded strip.
- At least 40% of the canvas is empty ground. No element touches the top or bottom edge.
- Two objects, side by side, same height, separated by a visible gap of at least 90px:
  1. LEFT: a documentation card — one deep ink (#1E2A32) rounded rectangle containing 4 short cream
     monospace bars standing in for text lines. The SECOND bar is mustard (#C8892E) and slightly
     longer than the others; it stands for the phrase "by default". Nothing labels it.
  2. RIGHT: a switch panel — one teal (#2E7D74) outlined rounded rectangle containing an exact
     8-column x 6-row grid of 48 small rounded squares. 45 of them are HOLLOW (teal outline only,
     ground showing through = off). Exactly 3 are SOLID mustard (#C8892E) and they are scattered,
     not adjacent. The hollow field must dominate the panel.
- Between the two objects, at their vertical center, exactly one typographic mark: `≠` in deep ink,
  medium weight. No arrow, no glow, no connector line.

TEXT (only this, nothing else):
- `says default · 45 of 48 off` set in a clean geometric sans, deep ink, small caps, letter-spaced,
  placed BELOW the two objects and horizontally centered under the gap, large enough to be legible
  when the whole canvas is scaled down to 320px wide. ASCII characters only. No other letters,
  no other numbers, no Chinese characters anywhere in the image.

STYLE AND COLOR:
- Warm off-white ground (#F2EFE9), flat vector shapes with crisp 2px outlines, no gradients,
  no shadows, no texture, no isometric perspective, no 3D.
- Two accents only: mustard #C8892E and teal #2E7D74. Everything else is deep ink or ground.
- High figure-to-ground contrast so the hollow-versus-solid grid still reads at 320px wide.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing spheres/orbs, isometric tech cubes, circuit boards, padlocks, shields,
  keys, skulls, bugs, magnifying glasses, hooded hacker figures, red alarm text, explosions,
  sirens, arrows pointing at things, speech bubbles, confetti.
- an all-dark canvas, or an all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, or logo.

---

## Selection record (2026-10-14, unattended run)

Three rasters were produced and all three are rejected as final:

| raster | backend | why rejected |
|---|---|---|
| candidate A | ImageGen (native) | label rendered correctly, but the grid has **6** solid cells while the label says 45 of 48 off |
| candidate B | ImageGen (native) | the ink card came back as garbled pseudo-text (`Ua ge tasc- Suve…`), which is §5.1 T3 |
| candidate A2 | ImageGen (native, counting constraint restated) | exactly 3 solid cells, but the grid is 6x7 = **42** cells, not 48 |

A cover whose own numbers contradict the article's numbers cannot ship, so the accepted raster is
the documented local fallback: the geometry below written as SVG and screenshotted with headless
Chrome. That guarantees 48 cells, 3 lit, the exact label string, and no watermark.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1792,1024 --virtual-time-budget=15000 \
  --user-data-dir=/tmp/shot-$(date +%s) --screenshot=coverA.png file:///tmp/cover-1014/coverA.svg
```

## Selected source (SVG)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1024" width="1792" height="1024">
  <rect width="1792" height="1024" fill="#F2EFE9"/>
  <rect x="230" y="240" width="470" height="520" rx="22" fill="#1E2A32"/>
  <rect x="290" y="340" width="280" height="34" rx="17" fill="#F2EFE9" opacity="0.88"/>
  <rect x="290" y="430" width="340" height="34" rx="17" fill="#C8892E"/>
  <rect x="290" y="520" width="240" height="34" rx="17" fill="#F2EFE9" opacity="0.88"/>
  <rect x="290" y="610" width="300" height="34" rx="17" fill="#F2EFE9" opacity="0.88"/>
  <g stroke="#1E2A32" stroke-width="12" stroke-linecap="round">
    <line x1="852" y1="492" x2="940" y2="478"/>
    <line x1="852" y1="546" x2="940" y2="532"/>
  </g>
  <line x1="905" y1="452" x2="872" y2="576" stroke="#1E2A32" stroke-width="12" stroke-linecap="round"/>
  <rect x="1120" y="240" width="470" height="520" rx="22" fill="none" stroke="#2E7D74" stroke-width="7"/>
  <g fill="none" stroke="#2E7D74" stroke-width="6">
    <!-- 8 columns x 6 rows = 48 cells, x = 1160 + i*48.5, y = 281 + j*73, 36x36 rx 9.
         Solid mustard (#C8892E, no stroke) at (row, col) = (1,4), (3,6), (4,2); all others hollow. -->
  </g>
  <text x="896" y="852" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="54"
        letter-spacing="4" fill="#1E2A32" text-anchor="middle">says default · 45 of 48 off</text>
</svg>
```

## 320px thumbnail test (§8.2.2)

`sips -Z 320 banner.png` — the card / `≠` / panel trio still reads as one conflict, the label
`says default · 45 of 48 off` is legible at 320px, top and bottom margins are balanced, and there
is a single clear focal point (the lit cells). Pass.

