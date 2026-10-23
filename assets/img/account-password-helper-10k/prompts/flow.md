---
type: flowchart
skill: hand-authored
rendering: html
watermark: false
backend: headless chrome screenshot
---

# 一次填充在本机走的四步

1600x700 视口渲染源。

<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 700px; overflow: hidden; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", -apple-system, sans-serif;
    background: #f5f2ea; color: #18202e; padding: 52px 74px 38px;
  }
  .eyebrow { font-size: 14px; letter-spacing: .18em; color: #a05e12; font-weight: 700; }
  h1 { margin: 10px 0 0; font-size: 44px; letter-spacing: -1.2px; line-height: 1.2; }
  h1 em { font-style: normal; color: #b4690e; }
  .sub { margin-top: 10px; font-size: 17px; color: #666e66; }
  .flow { display: flex; align-items: stretch; gap: 16px; margin-top: 30px; }
  .step {
    flex: 1; background: #fffdf7; border: 1px solid #e3dccd; border-radius: 16px;
    padding: 22px 20px 18px; position: relative; min-height: 336px;
    display: flex; flex-direction: column;
  }
  .step.hot { background: #18202e; border-color: #18202e; color: #fff; }
  .num {
    width: 36px; height: 36px; border-radius: 50%; background: #efe6d5; color: #9a5a11;
    font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  }
  .step.hot .num { background: #b4690e; color: #fff; }
  .t { margin-top: 16px; font-size: 21px; font-weight: 800; letter-spacing: -.3px; }
  .d { margin-top: 10px; font-size: 14px; line-height: 1.65; color: #5e665e; }
  .step.hot .d { color: #aab4c4; }
  .d b { color: #18202e; font-weight: 700; }
  .step.hot .d b { color: #f5d3a8; }
  .meta { margin-top: auto; padding-top: 14px; border-top: 1px dashed #ddd5c5; font-size: 12px; color: #8b9187; line-height: 1.5; }
  .step.hot .meta { border-color: #354052; color: #8793a7; }
  .arrow {
    align-self: center; font-size: 24px; color: #b8ae9c; font-weight: 300; margin: 0 -4px;
  }
  .branch {
    margin-top: 18px; border: 1px dashed #c8873a; background: rgba(180,105,14,.06);
    border-radius: 14px; padding: 14px 22px; display: flex; align-items: center; gap: 18px;
  }
  .branch .tag { background: #b4690e; color: #fff; font-size: 12px; font-weight: 800; border-radius: 5px; padding: 4px 8px; letter-spacing: .06em; white-space: nowrap; }
  .branch .txt { font-size: 15px; color: #5a4a35; line-height: 1.55; }
  .branch .txt b { color: #8a4c08; }
  .foot { margin-top: 14px; display: flex; justify-content: space-between; font-size: 12px; color: #8b9187; }
  .foot b { color: #5f665d; }
</style>
</head>
<body>
  <div class="eyebrow">ONE SHORTCUT · FIVE STEPS · ALL LOCAL</div>
  <h1>一次 <em>Ctrl / ⌘ + Shift + F</em>，实际发生了什么</h1>
  <div class="sub">填充只是第 4 步。真正决定体验的，是前 3 步的判断和第 5 步的收尾。</div>

  <div class="flow">
    <div class="step">
      <div class="num">1</div>
      <div class="t">识别登录页</div>
      <div class="d">在页面里找账号框、密码框、验证码框。SPA 换页不刷新？<b>MutationObserver</b> 继续盯着，分批扫描，不改宿主页面样式。</div>
      <div class="meta">不是只看 input 标签：容器、按钮文案、弹窗特征一起判</div>
    </div>
    <div class="arrow">›</div>
    <div class="step">
      <div class="num">2</div>
      <div class="t">按 host 取账号</div>
      <div class="d">默认 <b>hostname 全等</b>才出现；可放宽到通配条目或同主域名两档。localhost 按端口隔离，<b>dev 和 prod 不串号</b>。</div>
      <div class="meta">内置 27 条两段式 ccTLD，避免把 com.cn 截错</div>
    </div>
    <div class="arrow">›</div>
    <div class="step">
      <div class="num">3</div>
      <div class="t">本机解密</div>
      <div class="d">主密码经 <b>PBKDF2-SHA256 600,000 次</b>迭代派生密钥，敏感字段用 <b>AES-256-GCM</b> 逐字段加密。磁盘上始终是密文。</div>
      <div class="meta">全部走 Web Crypto API，不引第三方加密库</div>
    </div>
    <div class="arrow">›</div>
    <div class="step">
      <div class="num">4</div>
      <div class="t">写进输入框</div>
      <div class="d">React / Vue 受控输入框不认直接赋值。填充按 <b>Native Setter → execCommand → 模拟键盘</b> 三级降级，逐级回退。</div>
      <div class="meta">顺带勾上「记住我 / 同意条款」</div>
    </div>
    <div class="arrow">›</div>
    <div class="step hot">
      <div class="num">5</div>
      <div class="t">把登录走完</div>
      <div class="d">默认只填 + 勾选；<b>自动点登录是可选项</b>。两步验证页面出现 <b>TOTP 活码胶囊</b>，同域名直接接力。</div>
      <div class="meta">默认不提交，避免在没准备好的页面上误登录</div>
    </div>
  </div>

  <div class="branch">
    <span class="tag">兜底分支</span>
    <div class="txt">遇到拿不准的自建登录页：给这个域名手写账号 / 密码框的 <b>CSS 选择器</b>，支持 <b>Shadow DOM 穿透</b>；规则可导出 JSON，在同事和多台机器之间共用。</div>
  </div>

  <div class="foot">
    <div>每一步都只在本机发生 · 唯一出站是每 6 小时一次的匿名版本检查，不携带任何账号数据</div>
    <div>实现细节：<b>README / docs/ARCHITECTURE.md</b></div>
  </div>
</body>
</html>
