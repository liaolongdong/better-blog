# 03-diagram-six-counters.webp — 结构示意图（手写 SVG，非生成图、非真实截图）
源文件同目录 `03-diagram-six-counters.svg`（1400×900，手写）。图中每个数都反查得到：
77 = `shared/types.ts` 的 Platform 联合成员数；76 = `providers/index.ts` 里 `register(` 调用数；
44 = docs 平台表数据行；41 / 442 / 483 = 目录快照 counts；36 = 快照里有 chat 行的 distinct platform；
34 / 474 / 635 = README 第 5 与 237 行；395 / 38 / 335 / 438 = models.html 同一份 HTML 的两处。
渲染：headless Chrome 截图 + ffmpeg 转 webp。第一版把对照框画在右侧、压住了三行结尾文字，
已重排为底部横条（这版是第二版）。
