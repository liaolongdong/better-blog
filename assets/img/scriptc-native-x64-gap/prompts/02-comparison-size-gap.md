---
topic: scriptc-native-x64-gap
type: comparison
style: sketch-notes
lang: zh (labels restricted to ASCII — AI-rendered Chinese glyphs are error-prone)
aspect: 16:9
watermark: disabled
---

# Illustration prompt — 同一个 hello，两块体积

Purpose: sits in the 痛点 section of a Chinese article about `scriptc`. It must read
in one glance as "the thing you actually have to hand over is dozens of times bigger
than the thing scriptc hands over". Both figures come from measurements recorded in
the evidence file for this post (`72,016` bytes for the compiled binary,
`113,823,696` bytes for the local `node` executable), so the labels are exact, not
decorative.

Layout: hand-drawn sketch-notes on warm off-white paper with faint grain, two panels
separated by a thin vertical ink line. Left panel ~3× wider than the right one, so
the areas themselves carry the ratio.

LEFT PANEL — caption label exactly: `node hello.js`
A large box drawn in heavy black ink, filled with soft muted graphite hatching, and
inside it a smaller labelled core drawn as a dotted sphere meaning "the V8 runtime
rides along". A short arrow from the box points down to a bold label exactly:
`113 MB`.

RIGHT PANEL — caption label exactly: `./hello`
One small solid dark rounded block, heavy outline, warm terracotta shadow, nothing
inside it. A short arrow points down to a bold label exactly: `72 KB`.

Between the two bottom labels, at the divider, a tiny hand-drawn brace with the words
exactly: `no Node, no V8` (this is the verbatim clause from the project README, so
keep it ASCII and legible).

REVISED (v2, the version actually rendered): the clause must sit **directly beneath
the right panel's `72 KB` label**, written once, in the same hand-lettered ASCII
style, with **no arrow, no brace, and no line pointing at anything** — because the
clause describes the small right block, not the big left one. The first render put an
arrow from that clause up into the left box, which states the opposite of the truth,
so it was regenerated.

Rules: only two accent colours (muted graphite grey + one soft terracotta). Loose but
confident ink linework, slightly uneven baselines. No charts, no percentages, no
other text, no letters beyond the four labels above plus the clause, no realistic
humans, no watermark.
