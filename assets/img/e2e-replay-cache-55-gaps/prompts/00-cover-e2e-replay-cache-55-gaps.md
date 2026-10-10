# Cover prompt · e2e-replay-cache-55-gaps

- backend: 运行时原生出图工具 `ImageGen`（本机无 DASHSCOPE_API_KEY，禁止 dashscope provider）
- type: conceptual | palette: cool | rendering: flat-vector | text: none | mood: balanced | aspect: 16:9
- 用途：文章封面（`assets/img/e2e-replay-cache-55-gaps/banner.webp`，正文 alt「三条用例从安装、连上浏览器到失败落盘的管线示意」）
- 约束：**画面里不许出现任何文字、字母、数字、logo、水印**（无字封面，避开中文错字；正文要求的「生成的图片不能带水印」同样适用）

## Prompt

Wide 16:9 flat vector illustration, cool muted palette (deep slate blue, desaturated steel gray, pale
blue-gray paper, one soft amber accent, one muted green accent), generous negative space with 50–60%
breathing room, no text, no letters, no numbers, no logos, no watermark, no signature, simplified
geometric shapes only, no realistic humans.

Scene: a single horizontal rail runs left to right across the lower third of the frame. On the rail sit
three plain rounded cards, evenly spaced, each marked only by three short horizontal squiggle lines
(abstract "case" tokens, deliberately identical — no numbering). The cards travel from a closed cardboard
box at the far left (installation: a box with an open flap and one card sliding out) toward a checkpoint
arch on the right.

The checkpoint arch is the anchor: a slim steel gate with an arm, and a small tray beneath it where a
single loose sheet of paper has landed, covered in horizontal squiggle lines of uneven length — the
readable plain-text artifact that a failing run drops. One of the three cards is stopped at the gate arm,
tilted, while the other two have passed and are stamped with a plain two-stroke check mark shape.

Above and behind the gate, a second branch: a short pipe that leaves the rail upward, ends in mid-air, and
 terminates in an unplugged socket and its dangling mate plug — a pair of connector halves that visibly do
 not meet, with a soft amber glow inside the empty socket. Nothing travels this branch; it is drawn thinner
 and lighter than the main rail so it reads as the half that is not running.

Bottom right, off the rail: a wide shallow drawer pulled open, its interior a grid of small row slots. A
minority of the slots are filled with flat solid tiles; a clear long run of them are left as empty dashed
outlines — absence shown as dashed gaps, never as digits.

Mood: matter-of-fact, procedural, quiet. The composition should read as a working pipeline plus one
disconnected branch, not as a breakdown: no sparks, no damage, no alarm, no dramatic lighting. Soft
top-left light, flat shadows, faint paper-grain texture. Keep the unplugged connector pair and the dashed
drawer rows as the two secondary details; the gate with the landed sheet is the largest element.

## 实际落地（后端偏离）

运行时原生 `ImageGen` 两次 403 `{"code":"112"}`（1792×1024 各一次），`preferred_image_backend: auto`
且本机无 `DASHSCOPE_API_KEY` → 无备选后端。按 2026-10-02 那轮先例改**手绘 SVG + headless Chrome 栅格化**
（`--headless=new --window-size=1600,900 --user-data-dir=<每图独立> --virtual-time-budget=3000 --screenshot`，
写完 PNG 进程不自退，按 pid kill）。天然无水印，故无需量带裁切；画面按上文 Prompt 逐要素落图，无文字。
SVG 源随附如下（这份文件就是可复现来源）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D9A05B" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#D9A05B" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1600" height="900" fill="#EDF1F5"/>

  <!-- rail -->
  <rect x="110" y="556" width="1330" height="10" rx="5" fill="#C2CEDA"/>
  <rect x="110" y="580" width="1330" height="4" rx="2" fill="#D7DFE8"/>

  <!-- install box (far left) -->
  <g>
    <rect x="128" y="452" width="150" height="104" rx="6" fill="#B99A6E"/>
    <rect x="128" y="452" width="150" height="26" rx="6" fill="#A9885C"/>
    <path d="M278 452 L306 424 L306 508 L278 530 Z" fill="#C9AC80"/>
    <rect x="196" y="470" width="16" height="86" fill="#8F7346" opacity="0.55"/>
  </g>

  <!-- three case cards on the rail -->
  <g>
    <rect x="330" y="482" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#64788C" stroke-width="3"/>
    <rect x="348" y="502" width="70" height="7" rx="3.5" fill="#8FA0B2"/>
    <rect x="348" y="519" width="52" height="7" rx="3.5" fill="#B4C1CE"/>
    <rect x="348" y="536" width="62" height="7" rx="3.5" fill="#B4C1CE"/>

    <rect x="500" y="482" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#64788C" stroke-width="3"/>
    <rect x="518" y="502" width="70" height="7" rx="3.5" fill="#8FA0B2"/>
    <rect x="518" y="519" width="46" height="7" rx="3.5" fill="#B4C1CE"/>
    <rect x="518" y="536" width="58" height="7" rx="3.5" fill="#B4C1CE"/>

    <rect x="670" y="482" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#64788C" stroke-width="3"/>
    <rect x="688" y="502" width="70" height="7" rx="3.5" fill="#8FA0B2"/>
    <rect x="688" y="519" width="50" height="7" rx="3.5" fill="#B4C1CE"/>
    <rect x="688" y="536" width="64" height="7" rx="3.5" fill="#B4C1CE"/>
  </g>

  <!-- checkpoint arch -->
  <g>
    <rect x="892" y="352" width="18" height="228" rx="6" fill="#5A6B7C"/>
    <rect x="1072" y="352" width="18" height="228" rx="6" fill="#5A6B7C"/>
    <rect x="884" y="340" width="214" height="22" rx="8" fill="#465665"/>
    <!-- gate arm, half swung -->
    <rect x="908" y="470" width="150" height="10" rx="5" fill="#D9A05B" transform="rotate(-16 908 475)"/>
    <!-- card stopped at the arm -->
    <g transform="rotate(-9 830 480)">
      <rect x="766" y="452" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#5A6B7C" stroke-width="3"/>
      <rect x="784" y="472" width="66" height="7" rx="3.5" fill="#8FA0B2"/>
      <rect x="784" y="489" width="48" height="7" rx="3.5" fill="#B4C1CE"/>
      <rect x="784" y="506" width="58" height="7" rx="3.5" fill="#B4C1CE"/>
    </g>
  </g>

  <!-- plain-text artifact landed in the tray under the gate -->
  <g>
    <path d="M930 604 L1074 604 L1074 700 L930 700 Z" fill="#FFFFFF" stroke="#C2CEDA" stroke-width="3"/>
    <rect x="946" y="622" width="96" height="6" rx="3" fill="#7C8EA0"/>
    <rect x="946" y="638" width="64" height="6" rx="3" fill="#AEBDCA"/>
    <rect x="946" y="654" width="84" height="6" rx="3" fill="#AEBDCA"/>
    <rect x="946" y="670" width="48" height="6" rx="3" fill="#C24E4E" opacity="0.75"/>
    <rect x="946" y="684" width="72" height="6" rx="3" fill="#AEBDCA"/>
    <path d="M912 700 L1092 700 L1104 730 L900 730 Z" fill="#DDE4EB" stroke="#B7C4D2" stroke-width="3"/>
  </g>

  <!-- two passed cards with check marks -->
  <g>
    <rect x="1176" y="482" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#64788C" stroke-width="3"/>
    <path d="M1214 512 l14 15 l30 -33" fill="none" stroke="#6FA084" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="1336" y="482" width="128" height="74" rx="10" fill="#FFFFFF" stroke="#64788C" stroke-width="3"/>
    <path d="M1374 512 l14 15 l30 -33" fill="none" stroke="#6FA084" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- disconnected branch: pipe up out of the rail, ending unplugged -->
  <g>
    <path d="M740 470 L740 300 L1150 300" fill="none" stroke="#C2CEDA" stroke-width="8" stroke-dasharray="18 14"/>
    <rect x="1150" y="256" width="120" height="88" rx="12" fill="#E4EAF0" stroke="#93A5B7" stroke-width="4"/>
    <circle cx="1188" cy="300" r="9" fill="#93A5B7"/>
    <circle cx="1232" cy="300" r="9" fill="#93A5B7"/>
    <path d="M1330 300 C1300 258 1272 268 1258 292" fill="none" stroke="#93A5B7" stroke-width="5"/>
    <rect x="1330" y="276" width="66" height="48" rx="10" fill="#FFFFFF" stroke="#5A6B7C" stroke-width="4"/>
    <rect x="1396" y="290" width="16" height="7" rx="3.5" fill="#5A6B7C"/>
    <rect x="1396" y="304" width="16" height="7" rx="3.5" fill="#5A6B7C"/>
    <ellipse cx="1292" cy="300" rx="52" ry="34" fill="url(#glow)"/>
  </g>

  <!-- drawer of migration slots: a long run left dashed and empty -->
  <g>
    <rect x="196" y="716" width="600" height="126" rx="10" fill="#FFFFFF" stroke="#B7C4D2" stroke-width="4"/>
    <rect x="196" y="700" width="600" height="20" rx="8" fill="#DDE4EB"/>
    <g fill="#8FA0B2">
      <rect x="222" y="744" width="54" height="18" rx="4"/>
      <rect x="286" y="744" width="54" height="18" rx="4"/>
      <rect x="350" y="744" width="54" height="18" rx="4"/>
      <rect x="222" y="776" width="54" height="18" rx="4"/>
      <rect x="286" y="776" width="54" height="18" rx="4"/>
      <rect x="414" y="776" width="54" height="18" rx="4"/>
      <rect x="350" y="776" width="54" height="18" rx="4"/>
    </g>
    <g fill="none" stroke="#C2CEDA" stroke-width="3" stroke-dasharray="8 7">
      <rect x="414" y="744" width="54" height="18" rx="4"/>
      <rect x="478" y="744" width="54" height="18" rx="4"/>
      <rect x="542" y="744" width="54" height="18" rx="4"/>
      <rect x="606" y="744" width="54" height="18" rx="4"/>
      <rect x="670" y="744" width="54" height="18" rx="4"/>
      <rect x="478" y="776" width="54" height="18" rx="4"/>
      <rect x="542" y="776" width="54" height="18" rx="4"/>
      <rect x="606" y="776" width="54" height="18" rx="4"/>
      <rect x="670" y="776" width="54" height="18" rx="4"/>
      <rect x="222" y="808" width="54" height="18" rx="4"/>
      <rect x="286" y="808" width="54" height="18" rx="4"/>
      <rect x="350" y="808" width="54" height="18" rx="4"/>
      <rect x="414" y="808" width="54" height="18" rx="4"/>
      <rect x="478" y="808" width="54" height="18" rx="4"/>
      <rect x="542" y="808" width="54" height="18" rx="4"/>
      <rect x="606" y="808" width="54" height="18" rx="4"/>
      <rect x="670" y="808" width="54" height="18" rx="4"/>
    </g>
  </g>
</svg>
```
