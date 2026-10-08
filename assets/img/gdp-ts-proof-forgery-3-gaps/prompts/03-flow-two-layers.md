---
topic: gdp-ts-proof-forgery-3-gaps
type: flow
style: sketch-notes
lang: zh context, labels restricted to ASCII (AI-rendered Chinese glyphs are error-prone)
aspect: 16:9
watermark: disabled
---

# Illustration prompt — 两层门，各管一种人

Purpose: sits inside the 和同类比 section of a Chinese article about `rauchg/gdp-ts`. The
section argues the library puts the real work in two different layers, and that they catch
different things. The type checker catches people who wire it wrong — five mistakes in the
author's own code produced seven errors, nothing escaped. The bundled lint preset is supposed
to catch people who forge a proof on purpose, but of five forgery shapes it reported only two.
So the figure is a two-gate corridor read left to right, with two rows of travelers whose
fates diverge at different gates.

Both readings come from this post's evidence file: every one of the five forgery shapes
compiled clean, and exactly two of them were flagged by the strict preset.

Layout: hand-drawn sketch-notes on cool off-white paper with faint grain, wide 16:9, a
corridor running left to right. Two vertical gate posts, evenly spaced, drawn as heavy ink
doorframes. The first post carries a small caption label exactly: `tsc`. The second post
carries a small caption label exactly: `lint`. 40–50% breathing room, no realistic humans.

UPPER ROW — five travelers drawn as simple round-headed paper slips with a crossed-over wiring
fault on each (a plug reversed, a bare end, a missing pin, a frayed split, a peeled tab). They
walk right and are stopped dead at the first post: a solid slate-blue bar drawn across the
corridor at `tsc`, with all five slips piling up against it. None of them reaches the second
post. The corridor beyond `tsc` on this row is empty.

LOWER ROW — five travelers drawn as scalloped-top seals, each with a different visible
tampering mark (resewn seam, peeled corner, filled crack, over-stamped scrape, cut-and-pasted
patch). They walk right and pass straight through the first post — show this by drawing that
post's gate as an open outline with a thin dashed passage through it. At the second post, only
two of the five are stopped, marked with a bold round terracotta stamp. The remaining three
continue out past the right edge of the frame with short motion lines, unmarked.

Accent rule: slate blue only on the `tsc` barrier and the upper row; muted terracotta only on
the two stamps at the `lint` post; the three escaping seals stay plain cream with thin ink
outlines.

Style: black ink linework with slight wobble, flat, no gradient mesh, no 3D render, no
photorealism, no realistic humans, no robots, no logos, no watermark, no signature, no border
frame. The only text anywhere is the two ASCII labels `tsc` and `lint` — no digits, no other
words.
