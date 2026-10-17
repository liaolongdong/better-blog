---
type: cover
topic: anthropic-scion-attribution-diff
skill: hand-written SVG (house fallback path; no image backend on this run)
aspect: 16:9 (1600x914, matches every other post banner in this repo)
palette: warm off-white ground #F2EFE9 + deep ink #1E2A32 + mustard #C8892E + teal #2E7D74
text: ASCII short labels only — BEFORE / AFTER / 1157 / TEXT UNCHANGED / FOOTNOTE / 0 -> 1
watermark: none — hand-written SVG, nothing composited
label-shape: 数字 · 落差（左边两段正文各 1157 字符且逐字相等，右边脚注从 0 条长到 1 条）
---

# Cover — anthropic-scion-attribution-diff

THE ONE CONFLICT THIS IMAGE MUST STATE: the article body did not change (two identical
1157-character blocks with an equals sign between them), while exactly one new footnote appeared
(an empty outlined slot becomes a single filled bar). Do NOT draw a warning, a bug, a lock, a
magnifying glass, a shield, or hacker imagery — the conflict is sameness versus a small addition.

## Composition (hard constraints)

- Canvas 1600x914, warm ground #F2EFE9, subject band vertically centered with balanced margins.
- LEFT (about 55% width): two deep ink (#1E2A32) rounded text cards of identical size and identical
  inner lines, each labelled `1157` above with `BEFORE` / `AFTER` in small letter-spaced caps.
  Between them a teal (#2E7D74) equals sign. Below, `TEXT UNCHANGED`.
- RIGHT (about 30% width): an empty mustard-outlined rounded slot, then a mustard arrow, then one
  filled mustard bar carrying a superscript `1`. Below, `0 -> 1`. The slot must read as completely
  empty at thumbnail size, and the filled bar as the only added element.

## Forbidden

- Any second added element on the right side; the count must be obviously one.
- Photorealism, gradients, shadows, 3D, glowing orbs, circuit boards, padlocks, speech bubbles.
- Any letters other than the labels listed above; no Chinese characters in the raster.

## Selected source (SVG)

The image backend is not used: all text here is a measured claim (1157 / 0 / 1), and generated
glyphs would risk misrendering the numbers. Hand-written SVG, rasterized by headless Chrome.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="914" viewBox="0 0 1600 914">
  <rect x="0" y="0" width="1600" height="914" fill="#F2EFE9"/>
  <g transform="translate(0,58)">
  <text x="290" y="250" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="9" fill="#696E7A">BEFORE</text>
  <text x="290" y="306" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="46" letter-spacing="5" fill="#1E2A32">1157</text>
  <rect x="150" y="336" width="280" height="180" rx="20" fill="#1E2A32"/>
  <rect x="180" y="372" width="206" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="180" y="401" width="170" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="180" y="430" width="222" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="180" y="459" width="188" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="180" y="488" width="132" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="516" y="406" width="68" height="13" rx="6.5" fill="#2E7D74"/>
  <rect x="516" y="443" width="68" height="13" rx="6.5" fill="#2E7D74"/>
  <text x="830" y="250" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="9" fill="#696E7A">AFTER</text>
  <text x="830" y="306" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="46" letter-spacing="5" fill="#1E2A32">1157</text>
  <rect x="690" y="336" width="280" height="180" rx="20" fill="#1E2A32"/>
  <rect x="720" y="372" width="206" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="720" y="401" width="170" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="720" y="430" width="222" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="720" y="459" width="188" height="9" rx="4.5" fill="#F2EFE9"/>
  <rect x="720" y="488" width="132" height="9" rx="4.5" fill="#F2EFE9"/>
  <text x="560" y="586" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="7" fill="#1E2A32">TEXT UNCHANGED</text>
  <rect x="1000" y="336" width="2" height="180" fill="#D8D3C7"/>
  <text x="1230" y="250" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="9" fill="#696E7A">FOOTNOTE</text>
  <rect x="1020" y="336" width="190" height="180" rx="20" fill="none" stroke="#C8892E" stroke-width="5"/>
  <line x1="1245" y1="426" x2="1315" y2="426" stroke="#C8892E" stroke-width="7" stroke-linecap="round"/>
  <polygon points="1310,408 1342,426 1310,444" fill="#C8892E"/>
  <text x="1372" y="394" font-family="Helvetica,Arial,sans-serif" font-size="32" fill="#C8892E">1</text>
  <rect x="1362" y="404" width="148" height="24" rx="12" fill="#C8892E"/>
  <text x="1230" y="586" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="7" fill="#1E2A32">0 &#8594; 1</text>
  </g>
</svg>
```

## Raster + 320px thumbnail test

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --user-data-dir=$(mktemp -d) --window-size=1600,914 \
  --screenshot=/tmp/attribution-cover.png "file:///tmp/attribution-cover.svg"
ffmpeg -y -i /tmp/attribution-cover.png -vf "scale=1600:-2" -c:v libwebp -quality 82 banner.webp
sips -Z 320 /tmp/attribution-cover.png --out /tmp/attribution-cover-320.png
```

At 320px the two identical `1157` cards, the teal equals, the empty mustard slot and the single
filled bar still read as one conflict; the numbers remain legible. Pass. Watermark: none.
