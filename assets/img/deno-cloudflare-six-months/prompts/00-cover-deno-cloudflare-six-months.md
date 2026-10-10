---
type: cover
slug: deno-cloudflare-six-months
skill: baoyu-cover-image
options: --quick --aspect 16:9 --text none
backend: 原生出图工具不可用（ImageGen 三次一致返回 403 code 112 / pricing URL，含一枚最小探针 prompt），本机亦无 DASHSCOPE_API_KEY，协议 §8.2-3 明令不要尝试 dashscope。改走确定性本地图：这份 prompt 的构图由 `banner-source.svg`（同目录，已入仓）手写，再用 headless Chrome 光栅化。两处与 prompt 有出入：三根绳的水平落点实作 35% / 52% / 5.6%（虚线绳挂在齿轮左侧、垂到桌沿外），齿轮与罩壳的相对位置按桌沿重排；绳结数量 6 / 12 与「虚线绳末端空钩、无标签牌」全部照做。
generated_at: 2026-10-10T16:37Z（Chrome 出图）/ 16:39Z（转 webp）
generated_file: /tmp/jb1010/out/banner.png 1792×1024 / 48,587B / md5 e3013e128133c3fbc70e30114af0cbe5
watermark_removal: 本地图不经模型后端，无「Qoder AI 生成」水印，未做任何裁剪或补块。
bottom_band_check: 判据为底部 52px 亮度（crop=iw:52:0:ih-52,signalstats）——YMIN=218 / YAVG=222.853 / YMAX=223，整带是纸面本底、无深色字形；再单量原生水印常落的右下 292×104（crop=292:104:1500:920）得 YMIN=218 / YAVG=222.856，与全带同值 → 该区域无像素级异常。肉眼复核 1792×1024 全图无水印、无签名。
crop_recheck: 未裁，不适用。复现链：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --disable-extensions --user-data-dir=/tmp/jb1010/cprof --window-size=1792,1024 --screenshot=out/banner.png <本目录>/banner-source.svg`（⚠️ 系统 Chrome 打完图不自退，需按 pid 收；截图文件在挂起前已落盘）
webp: banner.webp 1600×914 / 14,278B，ffmpeg libwebp quality 82（scale='min(1600,iw)':-2）
---

# Cover prompt（16:9，无文字）

一次交接，加上三根长短不同的绳子。画面左下是一张简笔工作台，桌面上放一枚齿轮和一个半开的小罩壳（代表一个运行时），罩壳只用细描边画出，内部留空。从罩壳右侧引出一根水平细索，索的中段打了一个结，一直连到画面右上方一大片云的轮廓——云只有轮廓线，不填色，边缘比索略粗。

**关键构图是垂下来的三根绳，它们的长度与画法必须各不相同。**

第一根绳从云的下缘垂在画面左中位置，最短，绳身上打**六个**等距绳结，绳端挂一枚完全空白的长方形标签牌。第二根绳也从云下缘垂下，位置在第一根右边，长度约是第一根的**两倍**，打**十二个**等距绳结，绳端同样挂一枚空白标签牌。这两根绳都用实线、墨蓝细描边。

第三根绳挂在画面左下那枚齿轮上，垂向桌面，比前两根都短，**整根画成虚线**，末端是一个空钩，没有标签牌。三根绳的绳结是全图唯一的「计数」，绳结之间等距，不许有多余的结。

构图：工作台占左下 20%，云占右上 25%，三根绳落在画面水平方向的 35% / 52% / 15% 处；留白 45% 以上，背景是大面积浅色纸面感（暖白偏米，极淡纸张纹理）。

**硬性负面约束**：画面里不许出现任何可读文字、字母、数字、罗马数字、时钟刻度、标志、水印、签名、代码片段；标签牌必须是完全空白的；不要人物、不要人脸、不要机器人、不要地球、不要星空、不要箭头堆叠。

配色：cool + elegant 混合——主色 #2F4A63（墨蓝）、辅色 #7FA8C4（雾蓝）、点缀 #D9A441（暖金，只用于第二根绳末端那枚标签牌的极细描边，以及虚线绳的空钩）、底色 #F4F1EA（米纸）。线条 1.5–2px 细描边为主，局部极轻铅笔阴影。

风格：扁平矢量与手绘技术笔记之间，克制、干净、留白多，像高质量技术随笔的题图。对比度柔和，不要霓虹、不要 3D 渲染、不要玻璃质感、不要镜头光晕、不要渐变背景。
