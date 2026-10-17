---
type: timeline
topic: nist-curve-seed-lrand48
skill: hand-written SVG (house fallback path; no image backend on this run)
aspect: 16:9 (1600x900)
palette: warm off-white ground #F2EFE9 + deep ink #1E2A32 + mustard #C8892E + teal #2E7D74
text: ASCII short labels only — 1997 / srand48(t) / 2000 / FIPS 186-2 / 2015 / Solinas' guess / 2023 / line goes cold / 2026 / recomputed, 665 ms / 14/14 / 14 MATCHED · 1 UNEXPLAINED
watermark: none
---

# 03 — timeline: the 29-year seed hunt

THE ONE SHAPE THIS IMAGE MUST STATE: a clock at the left feeds a short teal byte stream into a
straight line of dated nodes; the line goes cold at 2023 (hollow node), then a dashed mustard
segment reaches a laptop in 2026 where the seeds were recomputed. The article's point is that the
missing ingredient for 29 years was not compute but a checkable recipe.

## Composition

- Clock left, three teal byte squares entering the line, four filled/hollow nodes at 1997, 2000,
  2015, 2023; labels above (year) and below (event).
- 2023 node is hollow: the trail is cold there. Dashed mustard continues to 2026 laptop with
  `14/14`, labelled `recomputed, 665 ms`.
- Bottom caption `14 MATCHED · 1 UNEXPLAINED` keeps the B-163 caveat visible in the image itself.

## Forbidden

- Any claim that the curves were broken; no locks, cracks, skulls, warning triangles.
- Gradients, shadows, 3D, glowing effects, realistic devices.
- Letters beyond the labels listed above; no Chinese characters in the raster.

## Selected source (SVG)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect x="0" y="0" width="1600" height="900" fill="#F2EFE9"/>

  <text x="120" y="132" font-family="Helvetica,Arial,sans-serif" font-size="22" letter-spacing="9" fill="#696E7A">1997 — 2026</text>

  <line x1="205" y1="450" x2="1180" y2="450" stroke="#1E2A32" stroke-width="4"/>
  <line x1="1180" y1="450" x2="1350" y2="450" stroke="#C8892E" stroke-width="5" stroke-dasharray="14 12" stroke-linecap="round"/>

  <circle cx="140" cy="450" r="62" fill="none" stroke="#1E2A32" stroke-width="6"/>
  <line x1="140" y1="450" x2="140" y2="404" stroke="#1E2A32" stroke-width="6" stroke-linecap="round"/>
  <line x1="140" y1="450" x2="174" y2="468" stroke="#1E2A32" stroke-width="5" stroke-linecap="round"/>
  <circle cx="140" cy="450" r="7" fill="#1E2A32"/>

  <g fill="#2E7D74">
    <rect x="230" y="440" width="20" height="20" rx="4"/>
    <rect x="264" y="440" width="20" height="20" rx="4"/>
    <rect x="298" y="440" width="20" height="20" rx="4"/>
  </g>

  <g font-family="Helvetica,Arial,sans-serif" text-anchor="middle">
    <circle cx="400" cy="450" r="12" fill="#1E2A32"/>
    <text x="400" y="398" font-size="32" font-weight="600" fill="#1E2A32">1997</text>
    <text x="400" y="508" font-size="19" letter-spacing="2" fill="#696E7A">srand48(t)</text>

    <circle cx="660" cy="450" r="12" fill="#1E2A32"/>
    <text x="660" y="398" font-size="32" font-weight="600" fill="#1E2A32">2000</text>
    <text x="660" y="508" font-size="19" letter-spacing="2" fill="#696E7A">FIPS 186-2</text>

    <circle cx="910" cy="450" r="12" fill="#1E2A32"/>
    <text x="910" y="398" font-size="32" font-weight="600" fill="#1E2A32">2015</text>
    <text x="910" y="508" font-size="19" letter-spacing="2" fill="#696E7A">Solinas' guess</text>

    <circle cx="1180" cy="450" r="14" fill="#F2EFE9" stroke="#1E2A32" stroke-width="5"/>
    <text x="1180" y="398" font-size="32" font-weight="600" fill="#1E2A32">2023</text>
    <text x="1180" y="508" font-size="19" letter-spacing="2" fill="#696E7A">line goes cold</text>

    <text x="1425" y="322" font-size="32" font-weight="600" fill="#1E2A32">2026</text>
    <text x="1425" y="548" font-size="19" letter-spacing="2" fill="#696E7A">recomputed, 665 ms</text>
  </g>

  <rect x="1350" y="360" width="150" height="110" rx="9" fill="#1E2A32"/>
  <rect x="1364" y="374" width="122" height="82" rx="4" fill="#F2EFE9"/>
  <text x="1425" y="426" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="600" fill="#2E7D74">14/14</text>
  <rect x="1330" y="470" width="190" height="14" rx="7" fill="#1E2A32"/>

  <text x="800" y="726" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="9" fill="#1E2A32">14 MATCHED · 1 UNEXPLAINED</text>
</svg>
```

## Render + thumbnail test

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1600,900 \
  --screenshot=/tmp/nist-timeline.png file:///tmp/nist-timeline.svg
ffmpeg -y -i /tmp/nist-timeline.png -c:v libwebp -lossless 0 -q:v 90 \
  -compression_level 6 assets/img/nist-curve-seed-lrand48/03-timeline-seed-hunt.webp
ffmpeg -y -i /tmp/nist-timeline.png -vf "scale=320:-2" /tmp/nist-timeline-320.png
```

At 320px the four nodes and the dashed 2026 segment still read as one line; years remain legible.
Verified: 1600x900, 23,464 bytes.
