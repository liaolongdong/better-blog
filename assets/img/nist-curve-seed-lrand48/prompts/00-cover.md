---
type: cover
topic: nist-curve-seed-lrand48
skill: hand-written SVG (house fallback path; no image backend on this run)
aspect: 16:9 (1600x914, matches every other post banner in this repo)
palette: warm off-white ground #F2EFE9 + deep ink #1E2A32 + mustard #C8892E + teal #2E7D74
text: ASCII short labels only — SEED / C4 9D 36 08 86 / 20 BYTES / 29 YEARS / BROKEN LINK / UNIX TIME / 14 / 14 MATCHED / 665 MS ON NODE
watermark: none — hand-written SVG, nothing composited
label-shape: 数字 · 落差（20 字节的种子摆在左边，右边时钟的指针停在它上面，中间断开的 29 年）
---

# Cover — nist-curve-seed-lrand48

THE ONE CONFLICT THIS IMAGE MUST STATE: the seed is five hex bytes (C4 9D 36 08 86), and the
Unix clock that produced it sits 29 years away across a broken link. The bytes and the clock are
the same object seen from two ends. Do NOT draw a lock, a shield, a hacker, a cracking wall, or
any "broken crypto" metaphor — the article says the curves are not broken; only the provenance
was unknown.

## Composition (hard constraints)

- Canvas 1600x914, warm ground #F2EFE9, subject band vertically centered.
- LEFT: five deep ink tiles carrying `C4 9D 36 08 86`, threaded by a teal line, labelled `SEED`
  above and `20 BYTES` below.
- RIGHT: a large outlined clock face; its mustard hand extends left across the gap. Labels
  `29 YEARS` / `BROKEN LINK` sit below the gap, `UNIX TIME` below the clock — none may touch the
  clock rim. The teal line stops short of the hand: that gap is the 29-year missing link.
- BOTTOM: `14 / 14 MATCHED` and `665 MS ON NODE` — the reproduction result, not a verdict.

## Forbidden

- Any text implying the curves are unsafe; no padlocks, cracks, warning triangles, skulls.
- Photorealism, gradients, shadows, 3D, glowing orbs, circuit boards.
- Any letters other than the labels listed above; no Chinese characters in the raster.

## Selected source (SVG)

The image backend is not used: every number here is a measured claim, so hand-written SVG avoids
generated-glyph drift. Rasterized by headless Chrome.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="914" viewBox="0 0 1600 914">
  <rect x="0" y="0" width="1600" height="914" fill="#F2EFE9"/>

  <line x1="72" y1="395" x2="972" y2="395" stroke="#2E7D74" stroke-width="12" stroke-linecap="round"/>
  <line x1="1020" y1="395" x2="1140" y2="395" stroke="#2E7D74" stroke-width="12" stroke-linecap="round"/>

  <text x="120" y="262" font-family="Helvetica,Arial,sans-serif" font-size="22" letter-spacing="10" fill="#696E7A">SEED</text>

  <g font-family="Helvetica,Arial,sans-serif" font-size="46" fill="#F2EFE9" text-anchor="middle">
    <rect x="120" y="320" width="150" height="150" rx="26" fill="#1E2A32"/>
    <text x="195" y="412">C4</text>
    <rect x="292" y="320" width="150" height="150" rx="26" fill="#1E2A32"/>
    <text x="367" y="412">9D</text>
    <rect x="464" y="320" width="150" height="150" rx="26" fill="#1E2A32"/>
    <text x="539" y="412">36</text>
    <rect x="636" y="320" width="150" height="150" rx="26" fill="#1E2A32"/>
    <text x="711" y="412">08</text>
    <rect x="808" y="320" width="150" height="150" rx="26" fill="#1E2A32"/>
    <text x="883" y="412">86</text>
  </g>

  <text x="120" y="552" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="8" fill="#696E7A">20 BYTES</text>

  <circle cx="1340" cy="395" r="150" fill="none" stroke="#1E2A32" stroke-width="10"/>
  <g stroke="#1E2A32" stroke-width="5" stroke-linecap="round">
    <line x1="1340" y1="253" x2="1340" y2="272"/>
    <line x1="1340" y1="518" x2="1340" y2="537"/>
    <line x1="1198" y1="395" x2="1217" y2="395"/>
    <line x1="1463" y1="395" x2="1482" y2="395"/>
    <line x1="1240" y1="295" x2="1253" y2="308"/>
    <line x1="1427" y1="482" x2="1440" y2="495"/>
    <line x1="1240" y1="495" x2="1253" y2="482"/>
    <line x1="1427" y1="308" x2="1440" y2="295"/>
  </g>
  <line x1="1340" y1="395" x2="1352" y2="330" stroke="#1E2A32" stroke-width="9" stroke-linecap="round"/>
  <line x1="1340" y1="395" x2="1140" y2="395" stroke="#C8892E" stroke-width="12" stroke-linecap="round"/>
  <circle cx="1340" cy="395" r="15" fill="#1E2A32"/>

  <text x="1340" y="600" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="8" fill="#696E7A">UNIX TIME</text>

  <text x="996" y="540" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="9" fill="#C8892E">29 YEARS</text>
  <text x="996" y="578" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="19" letter-spacing="7" fill="#696E7A">BROKEN LINK</text>

  <text x="800" y="660" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="40" letter-spacing="10" fill="#1E2A32">14 / 14 MATCHED</text>
  <text x="800" y="706" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="22" letter-spacing="8" fill="#2E7D74">665 MS ON NODE</text>
</svg>
```

## Raster + 320px thumbnail test

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1600,914 --screenshot=/tmp/nist-cover.png file:///tmp/nist-cover.svg
ffmpeg -y -i /tmp/nist-cover.png -c:v libwebp -lossless 0 -q:v 90 -compression_level 6 banner.webp
ffmpeg -y -i /tmp/nist-cover.png -vf "scale=320:-2" /tmp/nist-cover-320.png
```

At 320px the five byte tiles, the clock and the broken teal line still read as one object; the
`14 / 14 MATCHED` line remains legible. Labels were moved off the clock rim after the first render
(`29 YEARS` / `BROKEN LINK` now sit under the gap; `UNIX TIME` under the clock), and the outcome
line was pulled up to y=660/706 because the post hero caps images at 420px with `object-fit: cover`
— at the 1140px hero width only source y≈162–752 survives the crop.
