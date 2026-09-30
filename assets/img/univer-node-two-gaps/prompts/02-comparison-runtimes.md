---
topic: univer-node-two-gaps
type: comparison
style: sketch-notes
lang: zh (labels restricted to ASCII — AI-rendered Chinese glyphs are error-prone)
aspect: 16:9
watermark: disabled
---

# Illustration prompt — 两条路，同一个 7

Purpose: sits in the 痛点 section of a Chinese article about `dream-num/univer`. The
section says that before this kind of kernel, making a program compute a spreadsheet
meant either driving a headless browser or hand-writing the aggregations. The point of
this figure is that the *answer* is the same on both paths while the *container* is
completely different — so the two panels must end on an identical value.

Both labels come from measurements recorded in this post's evidence file: the browser
path is the ordinary way, the in-process path printed `typeof document = undefined`
and `=SUM(A1:A2)` → `7` from a Node process with no DOM at all.

Layout: hand-drawn sketch-notes on cool off-white paper with faint grain, two panels
of equal width separated by a thin vertical ink line. 40–55% breathing room.

LEFT PANEL — caption label exactly: `headless Chrome`
A browser-window silhouette drawn in heavy black ink: rounded rectangle, one bar
across the top, three small dots on the left of that bar. Inside the window, a small
spreadsheet grid (thin even rows and columns). Below the window, a hand-drawn tether:
a short thick cable running down into a second, larger box labelled exactly `browser
process`, drawn with graphite hatching so it reads as "something you have to keep
alive". From the grid, one thin arrow points right to a bold label exactly: `=7`.

RIGHT PANEL — caption label exactly: `node process`
One simple terminal box, thin ink outline, with a small prompt chevron inside (no
glyphs, no readable characters). Nested directly in that box, the SAME spreadsheet
grid as the left panel, same size, same line weight — deliberately repeated, not
redrawn differently. No cable, no second box, nothing hanging underneath. One thin
arrow points right to a bold label exactly: `=7`.

Accent rule: slate blue only on the two grids and the two `=7` labels (they are the
shared part); muted terracotta only on the left panel's extra `browser process` box
and its cable (that is the part the right panel does not pay).

Style: black ink linework with slight wobble, flat, no gradient mesh, no 3D render,
no photorealism, no realistic humans, no robots, no logos, no watermark, no
signature, no border frame. The only text anywhere in the image is the four ASCII
labels above, spelled exactly.
