---
type: cover
slug: video-shotcraft-stale-about
skill: baoyu-cover-image
options: --quick --aspect 16:9 --text none --palette cool --rendering flat-vector
candidate: A（选用）
backend: 原生 ImageGen 两次调用均返回 403 code 112（2026-10-12T15:07Z / 15:08Z，候选 A 与候选 B 各一次），
  本机无第二出图后端 → 按既有退路改**手绘 SVG + headless Chrome 光栅化**
backend_command: |
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
    --hide-scrollbars --window-size=1792,1024 --user-data-dir=/tmp/ja1012/cvs-e-<ts> \
    --virtual-time-budget=8000 --screenshot=cover_e.png file:///tmp/ja1012/cover_e.svg
  （9 秒后按 pid kill，进程不自退）
watermark: 手绘 SVG 不经图像模型，无「Qoder AI 生成」角标；仍按 §8.2.3 第 4 步实测三条底部带
  （整幅底 128px / 右下角 600×128 / 整幅底 200px）的 YMIN 均为 217、YAVG 224.9，
  即底部不存在任何比背景颗粒（211–231）更暗的像素 → 水印计数 0。
webp: banner.webp 1600×914 / 15,016 B，ffmpeg libwebp quality 82
thumbnail_test: |
  320px 三秒测试跑了四次迭代：
  · 第一版（上下各留 30%、主体只占画面高 20%）→ 缩到 320 像一张白纸上两个小方块，正是 SPEC §0 点名
    的 `plugin-manifest-only-gate` 那个毛病，否掉。
  · 第二版把主体放大到画面高 65% → 缩略图有了，但按站点真实裁剪反算：文章页 hero 上下各裁 17.7%、
    首页卡片各裁 16.4%，顶部括号线 y=158 会被切掉，否掉。
  · 选用版主体落在 y 210–760（画面 20.6%–74.1%），冲突点（断掉的箭头）在 y=478＝画面 46.7%，
    正好在 §8.2.1 要求的 40%–60% 带内；用 ffmpeg 按两种真实裁剪各裁一次再缩到 320，
    两本账本、划线、断箭头、蜘蛛网全部完整可读。
  · 落选那张（候选 B：卡片摞 + 没更新的影子）见 02-cover-shadow-not-updated.md。
---

# Cover prompt（16:9，画面内不含任何可读文字、字母或数字）

**一图一冲突**：同一个数在两个地方各存了一份，git 里那份改了，git 外那份没改，改动传不过去。

**左：被版本控制圈住的那本账。** 两条粗竖线加四段短横线组成一对方括号（`[` `]`，线宽 10px，
#2F4A63），方括号里面摊开一页纸——近白底 #FAFBFC、墨蓝 6px 描边、左边一条竖线当装订边。
页面上是一列等距横杠：**5 条实色**（#3F6E93，线宽 19，圆头）代表现在还在的条目，
下面接着 **2 条浅灰**（#C5CCD4）代表刚被删掉的条目，每条浅灰上压一道**赭黄斜线**
（#C9822E，线宽 10）划掉。横杠右边再来一列很短的浅灰细线当批注，不抢主体。

**中：过不去的那一下。** 从左边出发的一段**赭黄虚线**（两段、中间留一个明显的断口），
末端一个淡到几乎看不见的箭头（不透明度 0.26），紧接着**一条粗赭黄竖线**（线宽 15，
底下再叠一条线宽 32、不透明度 0.15 的柔光）挡在右边那页之前——改动走到这里就停了。
竖线必须比断口更醒目，它是这张图的题眼。

**右：没人碰过的那本账。** 一整页**虚线描边**的纸（#7B8794 6px，dasharray 22 16，
底 #F1F2F4），里面是**同一形状、同一间距、同一粗细**的 **9 条横杠**，颜色是中灰蓝 #8B96A3
（比左边那 5 条实色淡，但比左边的浅灰删除线深），右边同样配一列浅灰批注。
右上角画一张极淡的**蜘蛛网**（#B6BEC8 4px，四段弧线）表示很久没人动过。
这页比左边那页**明显高出一截**（左页底 y=680、右页底 y=760）——两页用同一种横杠语言，
所以「5 条 vs 9 条」和「这页更长」是同一件事被说两遍，缩到很小也能比出来。

**构图（自述取值，勿依赖 skill 默认）**：画布 1792×1024；主体全部落在 y 210–760，
冲突点（断箭头与竖线）在 y=478＝垂直 46.7%，落在 §8.2.1 要求的 40%–60% 横带内；
横向左账本 150–756、断口 786–956、右账本 990–1600，右侧留视线出口；
按面积算四周留白 >50%。背景一整片中偏浅冷灰 #DEE1E6 加极淡纸纹颗粒（7px 网格里两枚
#D3D7DE / #E6E9ED 小点），**既不是近白也不是深底**。

**配色**：线条 #2F4A63；左页实色横杠 #3F6E93；右页灰蓝横杠 #8B96A3；删除线底 #C5CCD4；
批注 #AEB9C5 / #C0C7D0；蜘蛛网 #B6BEC8；点缀赭黄 #C9822E（只用于斜线、断箭头与那根竖线）；
底 #DEE1E6。

**风格**：扁平矢量、克制、干净，像高质量技术随笔的题图。

**禁止**：紫色渐变、发光球体、等距 3D 科技立方体、电路板纹理、星空、地球、机器人、人脸、手、
可读文字、字母、数字、代码片段、logo、水印、霓虹、玻璃质感、镜头光晕、纯白底、纯深底。

---

## 实际落盘的 SVG 源（这就是最终画面，不是「重画提示」）

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1792" height="1024" viewBox="0 0 1792 1024">
  <defs>
    <pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse">
      <rect width="7" height="7" fill="#DEE1E6"/>
      <circle cx="1.5" cy="2.5" r="0.5" fill="#D3D7DE"/>
      <circle cx="5" cy="5.5" r="0.45" fill="#E6E9ED"/>
    </pattern>
  </defs>
  <rect width="1792" height="1024" fill="url(#grain)"/>
  <g stroke="#2F4A63" stroke-width="10" fill="none" stroke-linecap="round">
    <path d="M200 210 H150 V760 H200"/>
    <path d="M706 210 H756 V760 H706"/>
  </g>
  <rect x="210" y="240" width="486" height="440" rx="8" fill="#FAFBFC" stroke="#2F4A63" stroke-width="6"/>
  <line x1="252" y1="240" x2="252" y2="680" stroke="#2F4A63" stroke-width="3.5" opacity="0.5"/>
  <g stroke="#3F6E93" stroke-width="19" stroke-linecap="round">
    <line x1="282" y1="292" x2="536" y2="292"/><line x1="282" y1="344" x2="536" y2="344"/>
    <line x1="282" y1="396" x2="536" y2="396"/><line x1="282" y1="448" x2="536" y2="448"/>
    <line x1="282" y1="500" x2="536" y2="500"/>
  </g>
  <g stroke="#C5CCD4" stroke-width="19" stroke-linecap="round">
    <line x1="282" y1="552" x2="536" y2="552"/><line x1="282" y1="604" x2="536" y2="604"/>
  </g>
  <g stroke="#C9822E" stroke-width="10" stroke-linecap="round">
    <line x1="270" y1="565" x2="548" y2="539"/><line x1="270" y1="617" x2="548" y2="591"/>
  </g>
  <g stroke="#AEB9C5" stroke-width="7" stroke-linecap="round">
    <line x1="566" y1="292" x2="652" y2="292"/><line x1="566" y1="344" x2="634" y2="344"/>
    <line x1="566" y1="396" x2="646" y2="396"/><line x1="566" y1="448" x2="622" y2="448"/>
    <line x1="566" y1="500" x2="640" y2="500"/><line x1="566" y1="552" x2="612" y2="552"/>
    <line x1="566" y1="604" x2="644" y2="604"/>
  </g>
  <g stroke="#C9822E" stroke-width="14" stroke-linecap="round" fill="none">
    <line x1="786" y1="478" x2="850" y2="478"/><line x1="872" y1="478" x2="902" y2="478"/>
  </g>
  <path d="M920 450 L948 478 L920 506" fill="none" stroke="#C9822E" stroke-width="14"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.26"/>
  <line x1="956" y1="400" x2="956" y2="556" stroke="#C9822E" stroke-width="32" stroke-linecap="round" opacity="0.15"/>
  <line x1="956" y1="400" x2="956" y2="556" stroke="#C9822E" stroke-width="15" stroke-linecap="round"/>
  <rect x="990" y="240" width="610" height="520" rx="12" fill="#F1F2F4" stroke="#7B8794"
        stroke-width="6" stroke-dasharray="22 16"/>
  <g stroke="#8B96A3" stroke-width="19" stroke-linecap="round">
    <line x1="1040" y1="292" x2="1360" y2="292"/><line x1="1040" y1="344" x2="1360" y2="344"/>
    <line x1="1040" y1="396" x2="1360" y2="396"/><line x1="1040" y1="448" x2="1360" y2="448"/>
    <line x1="1040" y1="500" x2="1360" y2="500"/><line x1="1040" y1="552" x2="1360" y2="552"/>
    <line x1="1040" y1="604" x2="1360" y2="604"/><line x1="1040" y1="656" x2="1360" y2="656"/>
    <line x1="1040" y1="708" x2="1360" y2="708"/>
  </g>
  <g stroke="#C0C7D0" stroke-width="7" stroke-linecap="round">
    <line x1="1394" y1="292" x2="1500" y2="292"/><line x1="1394" y1="344" x2="1478" y2="344"/>
    <line x1="1394" y1="396" x2="1494" y2="396"/><line x1="1394" y1="448" x2="1462" y2="448"/>
    <line x1="1394" y1="500" x2="1486" y2="500"/><line x1="1394" y1="552" x2="1452" y2="552"/>
    <line x1="1394" y1="604" x2="1482" y2="604"/><line x1="1394" y1="656" x2="1466" y2="656"/>
    <line x1="1394" y1="708" x2="1444" y2="708"/>
  </g>
  <g stroke="#B6BEC8" stroke-width="4" fill="none" stroke-linecap="round">
    <path d="M1600 242 q-66 24 -88 88"/><path d="M1600 242 q-36 68 -118 118"/>
    <path d="M1600 242 q-12 84 -96 140"/><path d="M1534 266 q-8 40 -40 64"/>
  </g>
</svg>
```
