---
type: screenshot
topic: nist-curve-seed-lrand48
source: real local run — LibreSSL 3.3.6 + /tmp/seedcheck.mjs on Node 22
captured: 2026-10-17
aspect: 16:9 (1600x900)
text: exact stdout copied from `_drafts/evidence/nist-curve-seed-lrand48.md`; no invented lines
watermark: none
---

# 02 — terminal: LibreSSL seed line and 14/14 recomputation

This is a rendered terminal card, but every line in it is copied verbatim from the evidence draft's
recorded run: `openssl version` → `LibreSSL 3.3.6`, the P-256 `Seed:` bytes, then the 14 `PASS`
lines with candidate counts and seeds, ending `合计 PASS=14 FAIL=0  用时 665 ms`. The article's
claim is that these 14 seeds were independently recomputed; this image is the receipt.

## Exact content contract

- Command line 1: `openssl version` → `LibreSSL 3.3.6`
- Command line 2: `openssl ecparam -name prime256v1 -param_enc explicit -text -noout | grep -A3 -i seed`
- Seed: `c4:9d:36:08:86:e7:04:93:6a:66:78:e1:13:9d:26:b7:81:9f:7e:90`
- Command line 3: `node /tmp/seedcheck.mjs`
- 14 PASS lines: prime239v1 n=2185, prime239v2 n=2320, prime239v3 n=3048, P-192 n=139,
  prime192v3 n=5228, prime192v2 n=6013, P-521 n=1136, P-256 n=1842, P-384 n=2688, P-224 n=7026,
  B-233 n=155, B-283 n=32, B-409 n=60, B-571 n=73.
- Total: `合计 PASS=14 FAIL=0  用时 665 ms`
- Window title: `seedcheck — zsh`

## Render

The card is a 1600x900 HTML canvas (warm ground #F2EFE9, 1520x820 dark terminal, 20px/27px
monospace), rasterized by headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1600,900 \
  --screenshot=/tmp/nist-02.png file:///tmp/nist-02.html
ffmpeg -y -i /tmp/nist-02.png -c:v libwebp -lossless 0 -q:v 90 \
  -compression_level 6 assets/img/nist-curve-seed-lrand48/02-screenshot-terminal-recompute.webp
```

Verified: 1600x900, 129,226 bytes; all 14 rows legible at full width. This is a visualization of
recorded output, not a live terminal capture; the source of truth remains the evidence draft.
