---
topic: gdp-ts-proof-forgery-3-gaps
type: comparison
style: sketch-notes
lang: zh context, labels restricted to ASCII (AI-rendered Chinese glyphs are error-prone)
aspect: 16:9
watermark: disabled
---

# Illustration prompt — 两个闸门，五道伪造

Purpose: sits between the 痛点 section and the 快速上手 section of a Chinese article about
`rauchg/gdp-ts`. The article measured two different layers on the same library. The type
checker is the strong one: five honest mistakes in the author's own code produced seven
errors. The bundled strict lint preset is the weaker one: five ways of forging a proof all
compiled, and that preset reported only two of them. The figure has to make that asymmetry
obvious at a glance — same number of items on both sides, opposite outcome.

Both counts come from this post's evidence file: `5 mistakes -> 7 errors` (tsc, strict
config) and `5 forgeries -> 2 flagged` (the library's own strict ESLint preset).

Layout: hand-drawn sketch-notes on cool off-white paper with faint grain, two panels of equal
width separated by a thin vertical ink line. 40–55% breathing room. No realistic humans.

LEFT PANEL — small caption label exactly: `tsc`
Five small paper slips stacked loosely in a column, each drawn with a DIFFERENT visible wiring
fault: one with two plugs crossed over, one with a bare wire end and no connector, one with a
missing third pin, one with a frayed split, one with a label tab peeled off. To the right of
every slip, a bold hand-drawn check mark in slate blue ink, and beneath the column a short
hand-drawn tally of seven small strokes grouped as five-plus-two (a tally, not a digit).
Nothing on this side escapes: all five slips carry a check mark.

RIGHT PANEL — small caption label exactly: `strict lint`
Five seals in a column, each a rounded rectangle with a scalloped top edge, each showing a
different tampering mark (resewn seam / peeled corner / filled crack / over-stamped scrape /
cut-and-pasted patch). Only the top two seals carry a bold round ink stamp over them in muted
terracotta. The bottom three seals have nothing on them — no stamp, no mark, no cross — they
just sit there with their tampering still visible. One thin wobbly arrow exits the third seal
downward and off the panel edge, showing it slipping past.

Accent rule: slate blue only on the left panel's check marks (that layer works); muted
terracotta only on the two stamped seals (that layer's partial coverage); the three unstamped
seals stay plain cream.

Style: black ink linework with slight wobble, flat, no gradient mesh, no 3D render, no
photorealism, no realistic humans, no robots, no logos, no watermark, no signature, no border
frame. The only text anywhere is the two ASCII labels above plus nothing else — no digits, no
words, no captions.
