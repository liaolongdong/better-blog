---
type: screenshot
topic: nist-curve-seed-lrand48
source: https://www.anthropic.com/research/ecdsa-curve-origins
captured: 2026-10-17 (live page, headless Chrome)
aspect: 16:9 (1600x900)
text: original page text, unretouched
watermark: none
---

# 01 — Anthropic research page, top of page

This is a real capture, not a generated image. It shows the title, the publish date
`Oct 16, 2026`, the line `It's just timestamps`, the sentence `There is no action to be taken...`,
and the start of the P-256 seed section, so a reader can check the article's central quotes without
leaving the page.

## Capture

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1600,1000 \
  --virtual-time-budget=5000 \
  --screenshot=/tmp/nist-01-page.png \
  "https://www.anthropic.com/research/ecdsa-curve-origins"
# screenshot is 1600x1000; crop the top 1600x900, then:
ffmpeg -y -i /tmp/nist-01-page.png -vf "crop=1600:900:0:0" -c:v libwebp -lossless 0 -q:v 90 \
  -compression_level 6 assets/img/nist-curve-seed-lrand48/01-screenshot-anthropic-seed-line.webp
```

Verified: 1600x900, 83,694 bytes. No text was overlaid. The page is dated 2026-10-16 and was read
on 2026-10-17 CST; if the page changes later this archive is the snapshot the article refers to.
