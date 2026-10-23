---
type: timeline
skill: hand-authored
rendering: html
watermark: false
backend: headless chrome screenshot
---

# 时间线：三个月、48 个版本、10,000 用户

1600x900 视口渲染源，数据为制图时快照。

<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 900px; overflow: hidden; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", -apple-system, sans-serif;
    background: #f5f2ea; color: #18202e; padding: 58px 74px 40px;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-end; }
  .eyebrow { font-size: 15px; letter-spacing: .18em; color: #a05e12; font-weight: 700; }
  h1 { margin: 12px 0 0; font-size: 48px; line-height: 1.16; letter-spacing: -1.4px; }
  h1 em { font-style: normal; color: #b4690e; }
  .note { font-size: 15px; color: #6f766f; text-align: right; line-height: 1.7; }
  .note b { color: #18202e; }

  .stats { display: flex; gap: 18px; margin-top: 26px; }
  .stat {
    background: #fffdf7; border: 1px solid #e3dccd; border-radius: 14px;
    padding: 16px 22px; min-width: 246px;
  }
  .stat .n { font-size: 38px; font-weight: 800; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
  .stat .n span { font-size: 16px; color: #7b8178; font-weight: 500; margin-left: 4px; letter-spacing: 0; }
  .stat .l { font-size: 14px; color: #6f766f; margin-top: 4px; }
  .stat.amber { background: #b4690e; border-color: #b4690e; color: #fff; }
  .stat.amber .n span, .stat.amber .l { color: #f3dcc2; }
  .stat.dark { background: #18202e; border-color: #18202e; color: #fff; }
  .stat.dark .n span, .stat.dark .l { color: #9aa4b5; }

  .chart-card {
    margin-top: 20px; background: #fffdf7; border: 1px solid #e3dccd; border-radius: 18px;
    padding: 22px 28px 14px; position: relative;
  }
  .chart-head { display: flex; justify-content: space-between; align-items: baseline; }
  .chart-title { font-size: 18px; font-weight: 700; }
  .chart-legend { font-size: 13px; color: #7b8178; display: flex; align-items: center; gap: 16px; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
  .chart { position: relative; height: 286px; margin-top: 8px; }
  .band { position: absolute; top: 0; bottom: 0; background: rgba(180,105,14,.07); border-left: 1px dashed rgba(180,105,14,.45); }
  .band-label {
    position: absolute; top: -4px; right: 12px; font-size: 12px; color: #9a5a11; font-weight: 700;
    letter-spacing: .08em;
  }
  .bars { position: absolute; left: 0; right: 0; bottom: 28px; height: 250px; display: flex; align-items: flex-end; }
  .slot { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
  .bar { width: 44px; border-radius: 5px 5px 2px 2px; background: #c9c3b5; position: relative; }
  .bar.hot { background: #b4690e; }
  .bar.zero { height: 3px !important; background: #ddd6c8; }
  .val { font-size: 12px; color: #7b8178; margin-bottom: 5px; font-variant-numeric: tabular-nums; }
  .val.hot { color: #9a5a11; font-weight: 700; }
  .m { position: absolute; bottom: -26px; font-size: 12px; color: #8b9187; white-space: nowrap; }
  .m.big { color: #18202e; font-weight: 700; }

  .timeline { position: relative; margin-top: 28px; height: 132px; }
  .line { position: absolute; left: 8px; right: 8px; top: 36px; height: 2px; background: linear-gradient(90deg, #d7d0c1, #b4690e); }
  .events { display: grid; grid-template-columns: repeat(6, 1fr); position: relative; }
  .ev { position: relative; padding-top: 54px; }
  .ev::before {
    content: ""; position: absolute; left: 0; top: 29px; width: 16px; height: 16px; border-radius: 50%;
    background: #fffdf7; border: 4px solid #b4690e;
  }
  .ev.muted::before { border-color: #9aa0a6; }
  .ev .d { font-size: 13px; font-weight: 700; color: #9a5a11; letter-spacing: .02em; }
  .ev.muted .d { color: #7d837b; }
  .ev .t { margin-top: 4px; font-size: 14px; color: #3d4654; line-height: 1.45; max-width: 210px; }
  .ev .t b { font-weight: 700; }

  .foot { position: absolute; left: 74px; right: 74px; bottom: 26px; display: flex; justify-content: space-between; font-size: 12px; color: #8b9187; }
  .foot b { color: #5f665d; font-weight: 600; }
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="eyebrow">3 MONTHS AFTER LAUNCH · 2026.07 — 2026.10</div>
      <h1>上架不是终点：<em>3 个月又改了 808 次</em></h1>
    </div>
    <div class="note">Chrome Web Store 读数 <b>2026-10-22</b><br />版本 <b>v3.16.0</b> · 安装包 <b>821 KiB</b></div>
  </div>

  <div class="stats">
    <div class="stat amber"><div class="n">10,000<span>用户</span></div><div class="l">商店显示 · 5 星（3 个评分）</div></div>
    <div class="stat dark"><div class="n">808<span>次提交</span></div><div class="l">7—10 月 · 占全部提交 72%</div></div>
    <div class="stat"><div class="n">48<span>个版本</span></div><div class="l">从 v1.0.0 到 v3.16.0</div></div>
    <div class="stat"><div class="n">3,951<span>项测试</span></div><div class="l">269 个测试文件，2026-10-22 全绿</div></div>
  </div>

  <div class="chart-card">
    <div class="chart-head">
      <div class="chart-title">每月提交数：真正的曲线在商店上架之后</div>
      <div class="chart-legend"><span><i class="sw" style="background:#c9c3b5"></i>上架前</span><span><i class="sw" style="background:#b4690e"></i>上架后</span></div>
    </div>
    <div class="chart">
      <div class="band" style="left: 71.43%; right: 0;"></div>
      <div class="band-label">2026-07-20 商店链接进仓库</div>
      <div class="bars">
        <div class="slot"><div class="val">17</div><div class="bar" style="height:11px"></div><div class="m">25/09</div></div>
        <div class="slot"><div class="val">20</div><div class="bar" style="height:13px"></div><div class="m">10</div></div>
        <div class="slot"><div class="bar zero"></div><div class="m">11</div></div>
        <div class="slot"><div class="val">1</div><div class="bar" style="height:3px"></div><div class="m">12</div></div>
        <div class="slot"><div class="val">11</div><div class="bar" style="height:7px"></div><div class="m">26/01</div></div>
        <div class="slot"><div class="val">29</div><div class="bar" style="height:19px"></div><div class="m">02</div></div>
        <div class="slot"><div class="bar zero"></div><div class="m">03</div></div>
        <div class="slot"><div class="val">15</div><div class="bar" style="height:10px"></div><div class="m">04</div></div>
        <div class="slot"><div class="val">83</div><div class="bar" style="height:54px"></div><div class="m">05</div></div>
        <div class="slot"><div class="val">141</div><div class="bar" style="height:92px"></div><div class="m">06</div></div>
        <div class="slot"><div class="val hot">145</div><div class="bar hot" style="height:94px"></div><div class="m big">07</div></div>
        <div class="slot"><div class="val hot">102</div><div class="bar hot" style="height:66px"></div><div class="m big">08</div></div>
        <div class="slot"><div class="val hot">175</div><div class="bar hot" style="height:114px"></div><div class="m big">09</div></div>
        <div class="slot"><div class="val hot">386</div><div class="bar hot" style="height:250px"></div><div class="m big">10</div></div>
      </div>
    </div>
  </div>

  <div class="timeline">
    <div class="line"></div>
    <div class="events">
      <div class="ev muted"><div class="d">2025.09.25</div><div class="t">第一行提交，<b>项目初始化</b></div></div>
      <div class="ev muted"><div class="d">2026.05.25</div><div class="t">第一篇推广博客上线</div></div>
      <div class="ev"><div class="d">2026.07.20</div><div class="t">商店链接第一次进仓库</div></div>
      <div class="ev"><div class="d">2026.09.09</div><div class="t">一版草稿被驳回：<b>关键词堆砌</b></div></div>
      <div class="ev"><div class="d">2026.10.14</div><div class="t">v3.16.0 发布：<b>站点规则入口</b></div></div>
      <div class="ev"><div class="d">2026.10.22</div><div class="t">商店显示 <b>10,000 用户</b></div></div>
    </div>
  </div>

  <div class="foot">
    <div>提交数按 <b>feature-dev</b> 分支 <b>git log</b> 逐月统计：开发分支共 <b>1,125</b> 次，主分支 <b>931</b> 次。</div>
    <div>用户 / 评分 / 体积：Chrome Web Store 商店页与发布产物；测试数：本机全量重跑。</div>
  </div>
</body>
</html>
