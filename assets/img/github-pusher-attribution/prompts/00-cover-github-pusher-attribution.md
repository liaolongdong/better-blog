---
type: cover
topic: github-pusher-attribution
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
candidates: 2 (A: client commit card left + server pusher slot right with OFF toggle;
            B: mirrored — slot left, card right) — selection recorded in the run report
palette: cool light ground #EEF1F4 + deep ink #1B2A38 + rust #B4552D + teal #2F6F6A
text: ASCII labels only — "author" and "pusher" (2 tokens)
watermark: none — see fallback note in this file
---

# Cover prompt (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for an article about commit identity attribution.

THE ONE CONFLICT THIS IMAGE MUST STATE: the two names a commit carries are strings the pushing
client writes and can be anything, while the authenticated server-side record of who actually
pushed is a separate slot — and in this article that slot reads as switched off. Two objects, one
loud and filled, one quiet and empty. Nothing else in the image may compete with that idea.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1008. Put the entire subject inside the horizontal band between 40% and 60% of the
  canvas height, and make the two objects TALL enough to fill that band. They must read as two big
  objects, never as a thin crowded strip of small marks.
- At least 40% of the canvas is empty ground. No element may touch the top or bottom edge.
- Exactly two objects, side by side, same height, separated by a visible gap:
  1. LEFT: a commit card — a deep ink (#1B2A38) rounded rectangle containing three short cool-white
     bars standing in for metadata lines. The top two bars are rust (#B4552D) and IDENTICAL in
     length and shape, each ending in a small solid dot: the two writable client-side name fields.
     Label `author` in a clean geometric sans, rust, small caps, directly under those two bars,
     inside the card.
  2. RIGHT: a server-side record slot — a teal (#2F6F6A) outlined rectangle, same height as the
     card, mostly empty. Inside it, near the top, one toggle in the OFF position: a teal pill
     outline with the knob at the far left and no fill. Below the pill, one dashed empty row
     (dashed teal outline, nothing inside) — the largest negative space in the image.
     Label `pusher` in the same sans, teal, small caps, under the dashed row, inside the slot.
- The two labels are the ONLY text in the image. No numbers, no Chinese characters, no other words.

STYLE AND COLOR:
- Cool light ground (#EEF1F4), flat vector shapes, crisp 2px outlines, no gradients, no shadows,
  no texture, no isometric perspective, no 3D.
- Two accents only: rust #B4552D and teal #2F6F6A. Everything else is deep ink or ground.
- High figure-to-ground contrast so both objects and the empty slot still read at 320px wide.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing spheres or orbs, isometric tech cubes, circuit boards, padlocks,
  shields, skulls, bugs, magnifying glasses, hooded hacker figures, red alarm text, explosions,
  sirens, arrows pointing at things, speech bubbles, confetti.
- an all-dark canvas, or an all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, or logo.

CANDIDATE B: same brief with the two objects mirrored (teal slot on the left, ink card on the
right); everything else identical.

---

## Fallback note

If the runtime-native image backend fails (HTTP 403 `{"code":"112"}` on 2026-10-12), the documented
fallback applies: hand-write the SVG for each candidate, rasterize with headless Chrome
(`--headless=new --screenshot --window-size=1600,900 --user-data-dir=…`, kill by pid since the
process does not self-exit), crop, then convert with ffmpeg (`cwebp` has no libpng here, `sips`
cannot write webp from PNG reliably). The SVG source of the selected candidate is appended below
once chosen.
