---
type: cover
skill: hand-authored
rendering: html
watermark: false
backend: headless chrome screenshot
---

# 封面：10,000 人把密码交给一个不联网的 Chrome 插件

1600x900 视口渲染源，headless Chrome 截图后转 webp。

<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 900px; overflow: hidden; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", -apple-system, sans-serif;
    background: #080d18;
    color: #f5f7fc;
    position: relative;
  }
  .bg-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: linear-gradient(90deg, #000 0%, rgba(0,0,0,.75) 52%, transparent 100%);
  }
  .glow-a {
    position: absolute; width: 720px; height: 720px; left: -260px; top: -300px;
    background: radial-gradient(circle, rgba(245,181,68,.22), transparent 66%);
    filter: blur(10px);
  }
  .glow-b {
    position: absolute; width: 820px; height: 820px; right: -260px; bottom: -360px;
    background: radial-gradient(circle, rgba(96,165,250,.20), transparent 66%);
    filter: blur(14px);
  }
  .wrap {
    position: relative; z-index: 2;
    width: 1600px; height: 900px;
    padding: 70px 76px 58px;
    display: grid;
    grid-template-columns: 900px 1fr;
    gap: 56px;
  }
  .eyebrow {
    display: flex; align-items: center; gap: 14px;
    font-size: 17px; letter-spacing: .16em; text-transform: uppercase;
    color: #f5b544; font-weight: 600;
  }
  .eyebrow::before { content: ""; width: 38px; height: 2px; background: #f5b544; }
  h1 {
    margin: 34px 0 0;
    font-size: 172px; line-height: .92; letter-spacing: -7px; font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  h1 .arrow { color: #f5b544; font-weight: 500; margin: 0 12px; }
  h1 .tenk { color: #fff; }
  .kicker {
    margin-top: 30px;
    font-size: 44px; line-height: 1.36; font-weight: 700; letter-spacing: -.6px;
    color: #eef1f8;
  }
  .kicker em {
    font-style: normal; color: #f5b544;
    background: linear-gradient(transparent 68%, rgba(245,181,68,.22) 68%);
    padding: 0 4px;
  }
  .desc {
    margin-top: 22px; font-size: 22px; color: #97a3ba; letter-spacing: .02em;
  }
  .stats {
    margin-top: 44px; display: flex; gap: 52px;
  }
  .stat .n {
    font-size: 44px; font-weight: 800; color: #fff; letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
  }
  .stat .n small { font-size: 20px; font-weight: 500; color: #97a3ba; margin-left: 4px; letter-spacing: 0; }
  .stat .l { margin-top: 6px; font-size: 17px; color: #7f8ba3; letter-spacing: .08em; }
  .source {
    position: absolute; left: 76px; bottom: 48px; font-size: 15px; color: #667289;
    letter-spacing: .02em;
  }
  .source b { color: #9aa7c0; font-weight: 500; }

  /* right product card */
  .stage { position: relative; height: 100%; display: flex; align-items: center; justify-content: center; }
  .app {
    width: 560px; height: 660px; position: relative;
    background: linear-gradient(180deg, #111a2c 0%, #0c1424 100%);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 28px;
    box-shadow: 0 40px 90px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
    overflow: hidden;
    transform: rotate(-2.2deg);
  }
  .app::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, rgba(255,255,255,.08), transparent 36%);
  }
  .bar { height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 18px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #2a3447; }
  .url { margin-left: 14px; height: 26px; flex: 1; border-radius: 7px; background: #0a1120; color: #7e8ba4; font-size: 13px; display: flex; align-items: center; padding: 0 12px; }
  .body { padding: 26px 28px; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .brand svg { width: 40px; height: 40px; border-radius: 10px; }
  .brand .t { font-size: 16px; font-weight: 600; color: #dbe2f1; }
  .brand .s { font-size: 12px; color: #78859d; margin-top: 3px; }
  .form { background: #f7f9fd; border-radius: 18px; padding: 24px; color: #172033; }
  .form .h { font-size: 20px; font-weight: 700; }
  .form .sub { font-size: 12px; color: #7b8497; margin-top: 4px; }
  .field { margin-top: 16px; }
  .field label { font-size: 11px; color: #7b8497; letter-spacing: .06em; }
  .input { margin-top: 6px; height: 40px; border: 1px solid #dbe1ec; background: #fff; border-radius: 9px; display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #2a3447; }
  .input.dots { letter-spacing: 3px; font-size: 18px; color: #35415a; }
  .btn { margin-top: 18px; height: 44px; border-radius: 9px; background: #2f6fed; color: #fff; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; letter-spacing: .04em; }
  .cap { margin-top: 10px; text-align: center; font-size: 11px; color: #8b94a6; }
  .rows { margin-top: 20px; display: grid; gap: 10px; }
  .row { display: flex; align-items: center; gap: 11px; background: #0e1728; border: 1px solid rgba(255,255,255,.09); border-radius: 12px; padding: 12px 14px; }
  .avatar { width: 28px; height: 28px; border-radius: 50%; background: #2f6fed; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .row .who { flex: 1; min-width: 0; }
  .row .who .u { font-size: 13px; color: #e7ecf7; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .who .m { font-size: 11px; color: #77849c; margin-top: 3px; }
  .tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(96,165,250,.14); color: #8fc0ff; }
  .totp { font-size: 15px; font-weight: 700; color: #f5b544; letter-spacing: .08em; font-variant-numeric: tabular-nums; }
  .keycap {
    position: absolute; right: 8px; bottom: 6px; z-index: 4;
    background: #f5b544; color: #17130a; border-radius: 14px; padding: 14px 20px;
    font-size: 17px; font-weight: 800; letter-spacing: .04em;
    box-shadow: 0 14px 30px rgba(245,181,68,.24);
    transform: rotate(2.6deg);
  }
  .badge5 {
    position: absolute; left: 26px; top: -16px; z-index: 4;
    background: #f7f9fd; color: #172033; border-radius: 50px; padding: 10px 16px;
    font-size: 14px; font-weight: 700; box-shadow: 0 12px 28px rgba(0,0,0,.35);
    transform: rotate(-5deg);
  }
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="glow-a"></div>
<div class="glow-b"></div>
<div class="wrap">
  <div>
    <div class="eyebrow">Account Password Helper · Chrome Extension</div>
    <h1>0<span class="arrow">→</span><span class="tenk">10,000</span></h1>
    <div class="kicker">上架 3 个月，<br /><em>一个密码插件的笨功夫</em></div>
    <div class="desc">不云端 · 不同步 · 主密码不出本机</div>
    <div class="stats">
      <div class="stat"><div class="n">1,125<small>次</small></div><div class="l">累计提交</div></div>
      <div class="stat"><div class="n">48<small>个</small></div><div class="l">正式版本</div></div>
      <div class="stat"><div class="n">3,951<small>项</small></div><div class="l">自动化测试</div></div>
    </div>
  </div>

  <div class="stage">
    <div class="badge5">5 星 · 3 个评分</div>
    <div class="app">
      <div class="bar">
        <i class="dot"></i><i class="dot"></i><i class="dot"></i>
        <div class="url">admin.example.com/login</div>
      </div>
      <div class="body">
        <div class="brand">
          <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="28" fill="#409EFF"/><circle cx="64" cy="46" r="20" fill="#fff"/><circle cx="64" cy="46" r="8" fill="#409EFF"/><rect x="59" y="62" width="10" height="48" rx="4" fill="#fff"/><rect x="69" y="86" width="8" height="6" rx="1.5" fill="#fff"/><rect x="69" y="98" width="11" height="6" rx="1.5" fill="#fff"/></svg>
          <div><div class="t">账号密码管理助手</div><div class="s">本机加密 · 精确域名匹配</div></div>
        </div>
        <div class="form">
          <div class="h">Sign in</div>
          <div class="sub">Acme Admin Console</div>
          <div class="field"><label>EMAIL</label><div class="input">demo-admin@example.com</div></div>
          <div class="field"><label>PASSWORD</label><div class="input dots">••••••••••••</div></div>
          <div class="btn">填充并登录</div>
        </div>
        <div class="rows">
          <div class="row"><div class="avatar">A</div><div class="who"><div class="u">demo-admin@example.com</div><div class="m">生产 · 管理员</div></div><span class="tag">已匹配</span></div>
          <div class="row"><div class="avatar" style="background:#12b76a">A</div><div class="who"><div class="u">auditor@example.com</div><div class="m">生产 · 只读账号</div></div><span class="totp">125 732</span></div>
        </div>
      </div>
    </div>
    <div class="keycap">Ctrl / ⌘ + Shift + F</div>
  </div>
</div>
<div class="source">数据截至 <b>2026-10-22</b> · Chrome Web Store 显示 <b>10,000 用户</b> · 提交与测试数取自 <b>feature-dev</b> 分支实测</div>
</body>
</html>
