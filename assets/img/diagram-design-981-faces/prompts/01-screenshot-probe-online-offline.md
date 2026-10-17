---
type: illustration
topic: diagram-design-981-faces
image: 01-screenshot-probe-online-offline.webp  (1600x496, 29,340 B)
kind: real screenshot pair — no generated pixels in this file
watermark: none (captured locally, nothing composited)
text-in-image: only what the browser itself painted (the page's own copy + my probe panel)
---

# What this image is

Two headless Chrome captures of the SAME file, side by side, joined by ffmpeg `hstack`.
Left = network available, right = network pointed at a dead port. The bottom strip in each half
is a probe panel my script injected into a COPY of the file (the shipped file was not modified:
12,099 → 13,462 bytes, +1,363 for the probe only).

Readings as painted by the browser:

- left:  `fontFaceCount=37`  `families=Geist|Geist Mono|Instrument Serif`  `resourceReqs=1`  `titleTextWidth=265.9`
- right: `fontFaceCount=0`   `families=`                                   `resourceReqs=1`  `titleTextWidth=325.6`
- both halves: `checkInstrumentSerif=true` `checkGeist=true` — the pair that makes `fonts.check()`
  unusable as a loaded-ness test (evidence N-07).

# Source files (kept outside the repo, regenerable)

- subject: `/tmp/ja1016/repos/diagram-design/skills/diagram-design/assets/example-architecture.html`
  (shallow clone of `cathrynlavery/diagram-design` @ pushed 2026-10-15T20:04:11Z)
- probe copy: `/tmp/ja1016/r/probe.html` → written into `/tmp/ja1016/r/dom-online.html` /
  `dom-offline.html` runs; screenshots `/tmp/ja1016/r/neton.png` (62,042 B) and
  `/tmp/ja1016/r/netoff.png` (59,754 B), both 1000x620.

# Commands (verbatim)

```bash
# online
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --user-data-dir=/tmp/ja1016/ps-neton-$$ --window-size=1000,620 \
  --virtual-time-budget=20000 --screenshot=/tmp/ja1016/r/neton.png "file:///tmp/ja1016/r/probe.html"
# offline: same, plus  --proxy-server="http://127.0.0.1:9"   (port 9 has no listener; checked first)
# join
ffmpeg -i neton.png -i netoff.png -filter_complex "[0:v][1:v]hstack=inputs=2,scale=1600:-2" \
  -c:v libwebp -quality 82 01-screenshot-probe-online-offline.webp
```

Chrome does not exit after `--screenshot` on this machine, so each run was backgrounded and killed
by pid after 16-18 s.
