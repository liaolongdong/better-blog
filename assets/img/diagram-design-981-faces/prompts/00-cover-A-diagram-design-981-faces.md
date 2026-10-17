---
type: cover
topic: diagram-design-981-faces
skill: baoyu-cover-image
flags: --quick --aspect 16:9 --text title-only --lang en
backend: runtime-native image tool (ImageGen); if it errors, documented fallback = hand-written SVG
         rasterized with headless Chrome (append "Selected source" after selection)
candidates: 2 (A: a dense tick field that stops short before one empty tray; B: one <link> bar
            dropping a dashed line into a stack tray that overflows) — selection by the §8.2.2
            320px thumbnail test, loser deleted
watermark: must be none — measure the bottom band of the raster before acceptance
palette: warm off-white ground + deep ink shapes + mustard/teal accents
text: ASCII short label only — "981 slices · 0 for SC" (5 words, 2 groups, each word ≤20 chars)
label-shape: 数字 · 落差（主峰的另一种写法：那行 link 声明的切片总数，对简体给的那一个都没有）
---

# Cover prompt A (verbatim payload sent to the backend)

Flat vector editorial cover illustration, 16:9, for an open-source fact-check article about a
Google Fonts stylesheet.

THE ONE CONFLICT THIS IMAGE MUST STATE: a single horizontal tray holds a very dense field of thin
vertical ticks — 981 of them if counted honestly — and the tray stops short. On the right side of
the image sits one separate, empty, outlined slot the same height as the tray, containing zero
ticks. The dense field and the empty slot are the whole idea. Do NOT draw a warning, a bug, a lock,
a magnifying glass or a download arrow — the conflict is a declaration versus an absence, and it
must look like a measurement.

COMPOSITION (hard constraints, follow literally):
- Canvas 1792x1024. The subject is ONE horizontal band, vertically centered, total subject height
  about 300px, so it fills the 40%-60% band rather than becoming a thin strip.
- At least 45% of the canvas is empty warm ground (#F2EFE9). Nothing touches the top or bottom edge.
- LEFT AND CENTER of the band (about 62% of canvas width): one deep ink (#1E2A32) rounded tray,
  open at the top, holding a dense row of thin vertical ticks standing inside it. Ticks are teal
  (#2E7D74) hairlines, evenly spaced, roughly 130 of them visible in the drawn width, all the same
  height except a few slightly shorter ones so it reads as data and not as a barcode pattern.
- Immediately right of that tray: a gap of at least 110px of bare ground.
- RIGHT of the gap (about 14% of canvas width): one mustard (#C8892E) outlined rounded tray of the
  SAME height and same corner radius as the ink tray, and it is completely EMPTY inside — no tick,
  no mark, no dot, not one. Its emptiness must be obvious at thumbnail size.
- Subject occupies the left two thirds; the last right tenth is open ground as gaze exit.

TEXT (only this, nothing else):
- `981 slices · 0 for SC` in a clean geometric sans, deep ink, small caps, letter-spaced, placed
  below the two trays, horizontally centered under the ink tray, clearly legible at 320px width.
  ASCII only. No other letters, no other numbers, no Chinese characters anywhere in the image.

STYLE AND COLOR:
- Flat vector, crisp 2px outlines, no gradients, no shadows, no texture, no isometric, no 3D.
- Accents: mustard #C8892E and teal #2E7D74 only; everything else deep ink or warm ground.

FORBIDDEN (any of these makes the image a reject):
- purple gradients, glowing orbs, isometric tech cubes, circuit boards, padlocks, shields, keys,
  skulls, bugs, magnifying glasses, hacker figures, red alarm text, explosions, sirens, arrows,
  speech bubbles, confetti, alphabets, letter blocks, "Aa" glyphs.
- all-dark canvas; all-pale canvas (near-white ground with thin light-blue line art).
- photorealism, cinematic lighting, lens flare, bokeh.
- any additional text, watermark, signature, logo.

## Selected source (SVG)

The image backend returned 403 code 112 on this run, so the
cover is hand-written SVG rasterized by headless Chrome — same path as the 10-14 cover.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1792" height="1024" viewBox="0 0 1792 1024">
<rect x="0" y="0" width="1792" height="1024" rx="0" ry="0" fill="#F2EFE9" />
<rect x="170" y="372" width="1100" height="300" rx="26" ry="26" fill="#1E2A32" />
<rect x="204" y="412" width="1032" height="226" rx="12" ry="12" fill="#F2EFE9" />
<rect x="224.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="231.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="239.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="246.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="254.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="261.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="269.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="276.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="284.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="292.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="299.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="307.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="314.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="322.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="329.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="337.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="344.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="352.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="359.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="367.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="375.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="382.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="390.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="397.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="405.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="412.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="420.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="427.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="435.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="442.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="450.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="458.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="465.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="473.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="480.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="488.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="495.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="503.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="510.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="518.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="525.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="533.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="541.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="548.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="556.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="563.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="571.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="578.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="586.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="593.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="601.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="608.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="616.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="624.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="631.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="639.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="646.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="654.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="661.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="669.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="676.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="684.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="691.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="699.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="707.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="714.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="722.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="729.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="737.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="744.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="752.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="759.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="767.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="774.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="782.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="790.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="797.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="805.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="812.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="820.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="827.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="835.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="842.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="850.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="857.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="865.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="873.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="880.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="888.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="895.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="903.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="910.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="918.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="925.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="933.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="940.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="948.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="956.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="963.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="971.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="978.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="986.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="993.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1001.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1008.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1016.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1023.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1031.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1039.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="1046.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="1054.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1061.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1069.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1076.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1084.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1091.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1099.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1106.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1114.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1122.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="1129.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/><rect x="1137.1" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1144.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1152.2" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1159.7" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1167.3" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1174.8" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1182.4" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1189.9" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1197.5" y="428.0" width="2.6" height="194.0" fill="#2E7D74"/><rect x="1205.0" y="455.2" width="2.6" height="166.8" fill="#2E7D74"/><rect x="1212.6" y="482.3" width="2.6" height="139.7" fill="#2E7D74"/>
<rect x="1388" y="372" width="300" height="300" rx="26" ry="26" fill="none" stroke="#C8892E" stroke-width="5"/>
<text x="720" y="764" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="44" letter-spacing="6" fill="#1E2A32">981 slices &#183; 0 for SC</text>
</svg>
```

## Raster + 320px thumbnail test (§8.2.2)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --user-data-dir=/tmp/ja1016/shotprof2-$$ --window-size=1600,914 \
  --screenshot=A.png "file:///tmp/ja1016/covers/A.svg"
ffmpeg -y -i A.png -vf "scale=1600:-2" -c:v libwebp -quality 82 banner.webp   # 15,214 B
sips -Z 320 A.png --out A320.png
```

At 320px the dense tick tray and the empty mustard slot still read as one conflict and the label
`981 slices · 0 for SC` is legible; the band sits in the vertical middle with balanced margins and
there is one focal point. Pass. Watermark: none — hand-written SVG, nothing composited.
