---
type: cover
topic: diagram-design-981-faces
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
backend: runtime-native image tool (ImageGen); fallback = hand-written SVG + headless Chrome
candidates: this is candidate B — the single <link> bar is the anchor and 981 ticks pour out of it
            into a wide ink tray, while a second narrow mustard tray beside it stays empty. Kept only
            if A fails the 320px test.
watermark: must be none — measure the bottom band of the raster before acceptance
palette: warm off-white ground + deep ink shapes + mustard/teal accents
text: ASCII short label only — "981 slices · 0 for SC" (5 words, 2 groups, each word ≤20 chars)
---

# Cover prompt B (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for an open-source measurement article.

THE ONE CONFLICT THIS IMAGE MUST STATE: one short horizontal bar at the top stands for a single
HTML `<link>` tag. From its lower edge, ONE thin dashed vertical line drops into a wide ink tray
packed with hundreds of tiny teal ticks. Beside that tray sits a second, narrower mustard-outlined
tray of the same height holding nothing at all. The single bar on top versus the two trays below —
one overflowing, one empty — is the entire subject. No warning sign, no alarm, no bug.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1024, subject vertically centered as one column about 460px tall so it fills the
  40%-60% band instead of forming a thin strip.
- At least 40% of the canvas is empty warm ground (#F2EFE9). Nothing touches the top or bottom edge.
- TOP of the subject: one deep ink (#1E2A32) rounded bar, about 340px wide and 46px tall, containing
  three short cream monospace bars inside it. It sits left of center.
- From the middle of that bar's lower edge, ONE thin dashed vertical mustard (#C8892E) line drops
  about 90px and meets the wide tray. No arrowhead.
- BOTTOM of the subject, side by side on one baseline, separated by at least 90px of bare ground:
  1. LEFT (about 58% of canvas width): a deep ink rounded tray, open at the top, packed with a
     dense even field of about 160 thin vertical teal (#2E7D74) hairline ticks of slightly varying
     height, filling the tray from left edge to right edge.
  2. RIGHT (about 13% of canvas width): a mustard outlined rounded tray, same height and corner
     radius, and completely EMPTY inside — zero ticks, zero marks.
- The right tenth of the canvas stays open ground as gaze exit.

TEXT (only this, nothing else):
- `981 slices · 0 for SC` in a clean geometric sans, deep ink, small caps, letter-spaced, centered
  below the two trays, legible at 320px width. ASCII only. No other letters, no other numbers, no
  Chinese characters anywhere in the image.

STYLE AND COLOR:
- Flat vector, crisp 2px outlines, no gradients, no shadows, no texture, no isometric, no 3D.
- Accents: mustard #C8892E and teal #2E7D74 only; everything else deep ink or warm ground.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing orbs, isometric tech cubes, circuit boards, padlocks, shields, keys,
  skulls, bugs, magnifying glasses, hacker figures, red alarm text, explosions, sirens, speech
  bubbles, confetti, alphabets, letter blocks, "Aa" glyphs, globe or map shapes.
- all-dark canvas; all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, logo.

## Outcome

Lost the §8.2.2 320px test to A: the `<link>` bar collapses to a dot at 320px, so the sentence
that carries the hook is unreadable at card size. Raster deleted; this prompt file kept as the
record of the second candidate.
