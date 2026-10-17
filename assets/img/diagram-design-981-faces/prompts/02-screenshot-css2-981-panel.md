---
type: illustration
topic: diagram-design-981-faces
image: 02-screenshot-css2-981-panel.webp  (940x1300, 68,192 B)
kind: real screenshot — no generated pixels in this file
watermark: none
text-in-image: only what the browser painted (my probe page printing its own measurements)
---

# What this image is

One headless Chrome capture of `/tmp/ja1016/r/cjkprobe.html` — a page whose `<head>` holds the
8-family `<link>` copied verbatim from `skills/diagram-design/references/style-guide.md:103`
(identical to the one in `assets/template.html` and to `U-08` in the evidence manifest). The page
prints `document.fonts.size`, the per-family face counts, and the result of
`document.fonts.load('16px "<family>"', text)` for two sample strings: `hans = 认证服务`,
`hant = 認證服務`.

Readings as painted: `fontFaceCount=981`, then `face Noto Sans KR x372`, `face Noto Sans TC x324`,
`face Noto Serif KR x124`, `face Noto Serif TC x108`, `face Geist Mono x18`, `face Noto Serif x16`,
`face Geist x15`, `face Instrument Serif x4` (sum = 981). The four Latin families return `0` for
both `hans` and `hant`; the KR/TC families return 1-4. Bottom two lines are the width check:
`w40px TC-stack hans = 160.0 | generic serif = 160.0` and `w40px SC-recommend = 160.0` — all three
equal, which is exactly why this figure does NOT claim the woff2 rendered. Panel finished with
`DONE 9408ms` (an earlier `--dump-dom` run of the same page printed `DONE 9296ms`).

# Commands (verbatim)

```bash
# 2x device scale so the 13px monospace panel stays legible after the crop
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --no-sandbox --user-data-dir=/tmp/ja1016/r/prof-cjkshot2 \
  --force-device-scale-factor=2 --window-size=520,700 --virtual-time-budget=25000 \
  --screenshot=/tmp/ja1016/r/cjkpanel2.png "file:///tmp/ja1016/r/cjkprobe.html"
ffmpeg -y -i cjkpanel2.png -vf "crop=940:1300:20:20" -c:v libwebp -quality 82 \
  02-screenshot-css2-981-panel.webp
```

Same-page DOM dump kept as text: `/tmp/ja1016/r/dom-cjk.html`. Killed by pid after 16 s.
