# Illustration prompt · 01-infographic-gap

- backend: 运行时原生出图工具 `ImageGen`（本机无 DASHSCOPE_API_KEY，禁止 dashscope provider）→ 本轮 403，改手绘 SVG，见文末
- skill: `baoyu-article-illustrator` | type: infographic | style: sketch-notes 的暖纸底 + 扁平线框 | language: zh | aspect: 16:9
- 用途：文章插图（`assets/img/e2e-replay-cache-55-gaps/01-infographic-gap.webp`，正文 alt「录制与回放之间的那道闸」）
- 约束：图内中文逐字目视核对；不出现任何水印

## Prompt

16:9 横版信息图，暖米纸底（#F5F1E8），细黑线框 + 柔和色块，教育向示意，无水印、无 logo、无写实人物。

一条从左到右的五格流程链，每格是圆角矩形（236×116），格间用箭头连接：

1. 「人话步骤」，副标 `agent.act`，白底深灰描边。
2. 「模型跑一次」，副标「我这台无凭据」——**这一格必须是虚线描边 + 米灰填充**，读起来像没通电，
   指向它的箭头也画成虚线。它代表本轮没跑到的那一半。
3. 「断言钉住」，副标 `expect`，白底。
4. 「录进缓存」，副标「下次不再叫模型」，白底。
5. 「回放命中」，副标「绿灯不报是谁跑的」，白底。

在 3 与 4 之间的箭头上立一道闸：一根竖直木色柱 + 顶部横档，柱上方写「钉住的才录」——
表达「act 之后必须紧跟 expect，钉住的才进缓存」。

在第 5 格下方挂一枚琥珀色提示块（浅琥珀底 #FBEFD9、琥珀描边 #D9A05B），两行字：
「缺口在这」／「缓存键里没有模型身份」，用一条短线连回第 5 格。

画面底部两条横向括号，把「验过的」与「没验的」分开：
- 左括号只罩住第 2 格，下方写「这一半没跑到」（暖棕色字）。
- 右括号罩住第 3～5 格，下方写「这一半我实测过：三条跑绿，再故意挂一次，失败时落一份可读的文本」（深灰字）。

第 1 格正下方用一条浅灰虚线垂到一句小字「装得上，但 Node 版本要够新」，表示安装这一格是通的。

整体留白 45% 以上，文字全部水平居中，缩到 320px 宽时五格结构仍可辨。

## 实际落地（后端偏离）

运行时原生 `ImageGen` 两次 403 `{"code":"112"}`（1792×1024 各一次），`preferred_image_backend: auto`
且本机无 `DASHSCOPE_API_KEY` → 无备选后端。按 2026-10-02 那轮的先例改**手绘 SVG + headless Chrome 栅格化**
（`--headless=new --window-size=1600,900 --user-data-dir=<每图独立> --virtual-time-budget=3000 --screenshot`，
写完 PNG 进程不自退，按 pid kill）。手绘管线天然无水印；图内 14 处中文逐字目视核对通过。
SVG 源随附如下（这份文件就是可复现来源）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif">
  <rect width="1600" height="900" fill="#F5F1E8"/>

  <!-- nodes -->
  <g stroke-width="3">
    <!-- 1 人话步骤 -->
    <rect x="90" y="300" width="236" height="116" rx="14" fill="#FFFFFF" stroke="#3A4A5A"/>
    <text x="208" y="352" font-size="32" fill="#26333F" text-anchor="middle">人话步骤</text>
    <text x="208" y="394" font-size="22" fill="#7A8896" text-anchor="middle">agent.act</text>

    <!-- 2 模型跑一次 -->
    <rect x="386" y="300" width="236" height="116" rx="14" fill="#EDE6D8" stroke="#A9987E" stroke-dasharray="12 9"/>
    <text x="504" y="352" font-size="32" fill="#7A6C58" text-anchor="middle">模型跑一次</text>
    <text x="504" y="394" font-size="22" fill="#A0917B" text-anchor="middle">我这台无凭据</text>

    <!-- 3 断言钉住 -->
    <rect x="682" y="300" width="236" height="116" rx="14" fill="#FFFFFF" stroke="#3A4A5A"/>
    <text x="800" y="352" font-size="32" fill="#26333F" text-anchor="middle">断言钉住</text>
    <text x="800" y="394" font-size="22" fill="#7A8896" text-anchor="middle">expect</text>

    <!-- 4 录进缓存 -->
    <rect x="978" y="300" width="236" height="116" rx="14" fill="#FFFFFF" stroke="#3A4A5A"/>
    <text x="1096" y="352" font-size="32" fill="#26333F" text-anchor="middle">录进缓存</text>
    <text x="1096" y="394" font-size="22" fill="#7A8896" text-anchor="middle">下次不再叫模型</text>

    <!-- 5 回放命中 -->
    <rect x="1274" y="300" width="236" height="116" rx="14" fill="#FFFFFF" stroke="#3A4A5A"/>
    <text x="1392" y="352" font-size="32" fill="#26333F" text-anchor="middle">回放命中</text>
    <text x="1392" y="394" font-size="22" fill="#7A8896" text-anchor="middle">绿灯不报是谁跑的</text>
  </g>

  <!-- arrows -->
  <g stroke="#3A4A5A" stroke-width="4" fill="none">
    <path d="M326 358 L386 358"/>
    <path d="M622 358 L682 358" stroke-dasharray="12 9" stroke="#A9987E"/>
    <path d="M918 358 L978 358"/>
    <path d="M1214 358 L1274 358"/>
  </g>
  <g fill="#3A4A5A">
    <path d="M326 350 L346 358 L326 366 Z" transform="translate(34,0)"/>
    <path d="M918 350 L938 358 L918 366 Z" transform="translate(34,0)"/>
    <path d="M1214 350 L1234 358 L1214 366 Z" transform="translate(34,0)"/>
  </g>
  <g fill="#A9987E">
    <path d="M622 350 L642 358 L622 366 Z" transform="translate(34,0)"/>
  </g>

  <!-- the gate: only asserted steps get recorded -->
  <g>
    <rect x="940" y="214" width="8" height="184" rx="4" fill="#C8B79A"/>
    <rect x="900" y="214" width="80" height="12" rx="6" fill="#8A7A60"/>
    <text x="944" y="190" font-size="26" fill="#5E5140" text-anchor="middle">钉住的才录</text>
  </g>

  <!-- the flaw: model identity is not part of the key -->
  <g>
    <rect x="1236" y="486" width="300" height="126" rx="14" fill="#FBEFD9" stroke="#D9A05B" stroke-width="3"/>
    <text x="1386" y="530" font-size="27" fill="#7A5A22" text-anchor="middle">缺口在这</text>
    <text x="1386" y="570" font-size="24" fill="#8A6A2E" text-anchor="middle">缓存键里没有模型身份</text>
    <path d="M1386 486 L1392 420" stroke="#D9A05B" stroke-width="4" fill="none"/>
  </g>

  <!-- bottom brackets: which half I verified -->
  <g stroke="#A9987E" stroke-width="3" fill="none">
    <path d="M386 690 L386 712 L622 712 L622 690"/>
  </g>
  <text x="504" y="756" font-size="27" fill="#8A6A4E" text-anchor="middle">这一半没跑到</text>

  <g stroke="#3A4A5A" stroke-width="3" fill="none">
    <path d="M682 690 L682 712 L1510 712 L1510 690"/>
  </g>
  <text x="1096" y="756" font-size="27" fill="#26333F" text-anchor="middle">这一半我实测过：三条跑绿，再故意挂一次，失败时落一份可读的文本</text>

  <!-- install → rail entry, left note -->
  <text x="208" y="690" font-size="24" fill="#7A8896" text-anchor="middle">装得上，但 Node 版本要够新</text>
  <path d="M208 664 L208 420" stroke="#C2CEDA" stroke-width="3" stroke-dasharray="10 9" fill="none"/>
</svg>
```
