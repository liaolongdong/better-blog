---
type: cover
topic: anthropic-key-default-block-gap
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
backend: runtime-native image tool (ImageGen); fallback = hand-written SVG + headless Chrome
candidates: this is candidate B — the panel alone carries the image and the claim is a separate
            mustard bar hovering above it with a dashed drop line that STOPS in mid-air before
            reaching the grid (the default never lands). Kept only if A fails the 320px test.

## Rejected (2026-10-14, unattended run)

B was rasterized by the native backend and is NOT the shipped cover: the dark card came back with
garbled pseudo-text (`Ua ge tasc- Suve…`), which §5.1 forbids as a T3 claim. The raster was deleted;
this prompt file stays as the reproducibility record. See candidate A's `## Selection record`.
---

# Cover prompt B (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for a security-configuration fact-check article.

THE ONE CONFLICT THIS IMAGE MUST STATE: a "by default" claim sits above a panel of repository
switches, and it never reaches them — every slot in the panel is off. The distance between the
claim and the panel IS the point.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1024, subject vertically centered, total subject height about 420px so it fills the
  40%-60% band instead of becoming a thin strip.
- At least 40% empty warm ground (#F2EFE9). Nothing touches the top or bottom edge.
- TOP PART of the subject: one deep ink (#1E2A32) rounded bar, wide and short, containing 3 cream
  monospace text-line bars; the middle bar is mustard (#C8892E). This is the changelog sentence.
- From the mustard bar, ONE thin dashed vertical line in mustard drops downward and STOPS in empty
  ground about 60px above the panel — it must not touch the panel. That unfinished drop is the
  conflict. No arrowhead.
- BOTTOM PART of the subject: one teal (#2E7D74) outlined rounded rectangle, slightly wider than
  the ink bar above it, holding an exact 8-column x 6-row grid of 48 small rounded squares. ALL 48
  are hollow (teal outline, ground showing through), except exactly 3 solid mustard squares placed
  at scattered positions.
- Subject left-of-center; the right third is open ground (gaze exit).

TEXT (only this, nothing else):
- `says default · 45 of 48 off` in a clean geometric sans, deep ink, small caps, letter-spaced,
  placed below the panel, horizontally centered, legible at 320px width. ASCII only. No other
  letters, no other numbers, no Chinese characters anywhere in the image.

STYLE AND COLOR:
- Flat vector, crisp 2px outlines, no gradients, no shadows, no texture, no isometric, no 3D.
- Accents: mustard #C8892E and teal #2E7D74 only; the rest is deep ink or warm ground.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing orbs, isometric tech cubes, circuit boards, padlocks, shields, keys,
  skulls, bugs, magnifying glasses, hacker figures, red alarm text, explosions, sirens, arrows,
  speech bubbles, confetti.
- all-dark canvas; all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, logo.
