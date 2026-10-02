# 搜索深链 / IME 保护 / 多词检索 / SearchAction 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `?q=` 在站内每一页都能打开 ⌘K 并当场出结果，中文输入法不再把「确认候选词」按成「跳文章」，多词查询按 AND 求交且逐词高亮，最后才把 `SearchAction` 递进首页的 WebSite 节点。

**Architecture:** 检索逻辑留在 `dev/js/editorial.js` 的 `initPalette()` 闭包里（`dev/js/*.js` 每个文件都是一个独立 vite 入口，抽新文件会在 `assets/js/` 落一枚孤儿产物），测试的家因此是一个新的 headless CDP 验证器 `scripts/verify-search-deeplink.mjs`：它在浏览器里驱动真面板，同时在 Node 侧用一份**独立实现**算出期望结果集，两边对账。结构化数据那一支由 `scripts/check-seo.mjs` 的第 11 组判据守着，并且交叉检查「面板与脚本真的在这页上」。

**Tech Stack:** Jekyll 4.3.4 + Vite 6、原生 ES5 风格 DOM API（`var` + `function`，与 editorial.js 现有写法一致）、`node:http` 静态服务 + Chrome headless + 裸 CDP、`node:test`（toolkit-tests 那套）。

**规格：** `_docs/superpowers/specs/2026-10-02-search-deeplink-design.md`（提交 `0bc51a1`）。D2 共享元素形变已在 spec §7 以证据退掉，本计划不含它。

---

## 全局约束（每个任务都受这些限制）

- 工作目录永远是 `.worktrees/sp3-motion-search`（分支 `sp3-motion-search`，基线 `76df2df`）。
- **只按 pathspec 暂存**，绝不 `git add .`；提交信息一律 `git commit -F <文件>`，绝不用 heredoc。
- **不 push**。不 `--no-verify`，不 amend，不 `reset --hard`。
- 不碰：`_config.yml`、`package.json`、`dev/sass/toolkit.scss`、`sw.js`、`offline.html`、`scripts/check-sw*.mjs`、`scripts/verify-motion-batch4.mjs`、`scripts/verify-nav-touch.mjs`（后两条属于并发会话的动效领地）。
- 格式化只有 prettier，且必须带这两个开关：`npx prettier --single-quote --print-width 320 --write <文件>`。`_docs/**` 下的 spec 与 plan **永不过 prettier**。
- 构建快照的标准动作（后续任务里的「重建」都指这四行）：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp3-motion-search
npx vite build && bundle exec jekyll build
```

- 验证器与牙齿一律跑在**干净导出树**上（`跑门的树必须等于提交的树`）：

```bash
rm -rf /tmp/sp3/head && mkdir -p /tmp/sp3/head
git archive HEAD | tar -x -C /tmp/sp3/head
ln -s /Users/liaolongdong/code/liaolongdong.github.io/vendor /tmp/sp3/head/vendor
cd /tmp/sp3/head && npx vite build && bundle exec jekyll build
```

---

## Task 1：验证器骨架 + 第 1 判据（深链进站应开到「已搜过」态）

先有量具，再改代码。这一条判据在 E1 落地前必须是红的——它就是本任务的「失败的测试」。

**Files:**
- Create: `scripts/verify-search-deeplink.mjs`
- 参考（逐字复制、不修改）：`scripts/verify-tools-browser.mjs:67-70`（CHROME/BASE/die）、`:320-400`（freePort + `node:http` 静态服务）、`:540-620`（Chrome 启动、`--remote-debugging-port=0`、从 stderr 认 ws 端点、attach target）、`:622-660`（`LOAD1`、`CDP_MS`、`evalJs`、`goto`、`wait`）

- [ ] **Step 1：把四段 harness 逐字抄进新文件，并按下面三处改动**

先补上这四段没带进来的四个顶层定义（抄完之后新文件的第一段自有代码）：

```js
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
/** 被测产物（默认就是当前树的 _site；A/B 时指到导出树） */
const SITE = path.resolve(opt('site', path.join(REPO, '_site')));
```

改动 ①：静态服务要能同时挂两棵树（HEAD 与新产物），所以把 `verify-tools-browser.mjs` 里那个 `http.createServer` 的根目录换成「按 URL 前缀查表」：

```js
/** 两棵树：`--head=` 给旧产物（只在 Task 4 的回归对账里用），默认只有一棵。 */
const TREES = { main: SITE };
const HEAD_SITE = opt('head', null);
if (HEAD_SITE) TREES.head = path.resolve(HEAD_SITE);
```

`BASE` 仍是 `'/better-blog'`（baseurl 烤在产物里，两棵树共用同一个前缀），路由里把 `req.url` 以 `BASE` 开头的那段剥掉后拼到 `TREES[which]`；两棵树需要两个端口，因此 `freePort()` 调两次（`PORT_MAIN`、`PORT_HEAD`），`ORIGIN_HEAD` 只在传了 `--head=` 时存在。

改动 ②：`freePort` 那段的**端口必须子进程自己抢、并打印出来**（房规：端口不能猜，Chrome 的端点在 stderr，http.server 的在 stdout）。新脚本用 Node 自己的 `server.listen(0)`，抄来后加一行自证：

```js
console.log(`· 服务端口 main=${PORT_MAIN}${PORT_HEAD ? ` head=${PORT_HEAD}` : ''}（都是从 0 抢到的）`);
```

改动 ③：开局负载自拒——照 `verify-tools-browser.mjs:998` 的写法，把阈值放在启动处：

```js
const LOAD1 = () => (os.loadavg ? os.loadavg()[0].toFixed(1) : '—');
if (os.loadavg()[0] > 8) {
  console.log(`✗ 拒测：1 分钟负载 ${LOAD1()} > 8。跨页转场与面板入场这类判据在高负载下会假红，宁可不交。`);
  process.exit(2);
}
```

- [ ] **Step 2：写第 1 判据（J1）与它的报告器**

报告器照 `verify-tools-browser.mjs` 的 `ok/bad/group` 三件套（红点累积到 `fails`，末尾 `process.exit(fails.length ? 1 : 0)`）。J1 本体：

```js
group('J1 深链进站：?q= 应当把面板开到「已经搜过」那一态');
{
  await goto(`${ORIGIN}${BASE}/?q=${encodeURIComponent('转场')}`);
  await wait(600);
  const s = await evalJs(`(() => {
      const p = document.getElementById('cmdk');
      const i = document.getElementById('cmdk-input');
      const r = document.getElementById('cmdk-results');
      return {
        hasPanel: !!p, hidden: p ? p.hidden : null, bodyCls: document.body.classList.contains('cmdk-open'),
        value: i ? i.value : null, rows: r ? r.children.length : 0,
        marks: r ? r.querySelectorAll('mark').length : 0,
        firstMark: r && r.querySelector('mark') ? r.querySelector('mark').textContent : null,
        innerWidth: window.innerWidth,
      };
    })()`);
  if (!s.hasPanel) bad('J1', '面板标记', '产物里没有 #cmdk——header.html 的 site.search 那一支没发出来，深链无处可开');
  else if (s.hidden) bad('J1', '深链开面板', `#cmdk 仍然 hidden（body.cmdk-open=${s.bodyCls}）：?q= 没人读`);
  else if (s.value !== '转场') bad('J1', '预填输入框', `期望「转场」，实得 ${JSON.stringify(s.value)}`);
  else if (s.rows === 0) bad('J1', '落地即出结果', '面板开了、词也塞进去了，但结果行是 0');
  else if (!s.marks) bad('J1', '命中高亮', `${s.rows} 行里一个 <mark> 都没有`);
  else ok('J1 深链进站', `${s.rows} 行 / ${s.marks} 处高亮，首个高亮「${s.firstMark}」（视口 ${s.innerWidth}）`);
}
```

`innerWidth` 必须打印出来：headless 的默认视口不是桌面宽度，不自我证明的话「行数为 0」会被误读成功能坏了。

- [ ] **Step 3：跑起来，确认它红**

```bash
node scripts/verify-search-deeplink.mjs 2>&1 | tail -20
```

期望：`✗ [J1] 深链开面板：#cmdk 仍然 hidden（body.cmdk-open=false）：?q= 没人读`，退出码 1（不是 2；2 是环境没起来）。

- [ ] **Step 4：给 J1 配牙齿**

Create `scripts/verify-search-deeplink-teeth.mjs`：把 `_site` 与源侧各抄一份到 `fs.mkdtempSync(os.tmpdir() + '/sdl-teeth-')`，逐条注入变异、跑主脚本、断言 `status !== 0 && status !== 2` 且红的是那一条判据的 `expect` 片段，跑完还原。变异落点必须是**副本里的构建产物** `assets/js/editorial.min.js` 的文本（真工作树一律不动），每条变异自己证明落进去了（`if (!changed) throw`）。

J1 的两条牙：

```js
  { name: '深链那一步被摘掉', site: true, expect: '#cmdk 仍然 hidden',
    mut: () => subOnce(minJs(), 'searchParams.get("q")', 'searchParams.get("zz")', '深链读取') },
  { name: 'open 收了 preset 却不塞输入框', site: true, expect: '期望「转场」，实得',
    mut: () => subOnce(minJs(), "input.value = preset || ''", "input.value = ''", 'preset 预填') },
```

（`minJs()` 返回副本里那份 `assets/js/editorial.min.js` 的路径。**注意**：terser 之后字符串字面量仍带引号，`input.value = preset || ''` 在产物里可能是 `input.value=preset||""`。落地时先 `grep -o 'input.value=[^;]*' _site/assets/js/editorial.min.js` 把真实形状读出来再写变异锚点，锚点写错会导致「变异没落地」的假牙——所以 `subOnce` 找不到目标必须抛。）

```bash
node scripts/verify-search-deeplink-teeth.mjs
```

期望：`✓ 牙齿 2/2`，退出码 0。

- [ ] **Step 5：提交**

```bash
git add -- scripts/verify-search-deeplink.mjs scripts/verify-search-deeplink-teeth.mjs
git commit -F /tmp/gate/sp3-t1.txt
```

信息里要写明「J1 此刻是红的，这是预期」，避免下一轮把它当回归。

---

## Task 2：E1 落地——深链读入口、preset 开面板、地址栏同步与关闭还原

**Files:**
- Modify: `dev/js/editorial.js:620-633`（`open` / `close`）、`:795`（`input` 监听）、`:799` 之前（`initPalette` 末尾）
- Modify: `scripts/verify-search-deeplink.mjs`（追加 J2/J3）
- Modify: `scripts/verify-search-deeplink-teeth.mjs`（追加 2 条牙）

- [ ] **Step 1：先写 J2（输入同步进地址栏）与 J3（关面板还原）**

```js
group('J2 输入时地址栏跟随（replaceState，且只动 q 这一个键）');
{
  // 带一个额外参数与一个片段进来，验证「别的都不许被吃掉」
  await goto(`${ORIGIN}${BASE}/?utm_source=keep&x=1#frag`);
  await wait(500);
  await evalJs(`(() => { const b = document.querySelector('[data-search-open]'); if (b) b.click(); return 1; })()`);
  await wait(250);
  await evalJs(`(() => {
      const i = document.getElementById('cmdk-input');
      i.value = '动效';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  await wait(300);
  const a = await evalJs('({ search: location.search, hash: location.hash, entries: performance.getEntriesByType("navigation").length })');
  const params = new URLSearchParams(a.search);
  if (params.get('q') !== '动效') bad('J2', 'q 跟随输入', `location.search=${JSON.stringify(a.search)}`);
  else if (params.get('utm_source') !== 'keep' || params.get('x') !== '1') bad('J2', '别的参数不许丢', `search=${a.search}`);
  else if (a.hash !== '#frag') bad('J2', '片段不许被吃掉', `hash=${JSON.stringify(a.hash)}`);
  else if (a.entries !== 1) bad('J2', '只准 replace', `导航条目 ${a.entries} 个：pushState 会产生历史，后退会先退回上一个词`);
  else ok('J2 输入同步', `search=${decodeURIComponent(a.search)} 保留 utm_source/x/hash，历史条目仍 1 条`);
}

group('J3 关面板把 q 抹回入口地址');
{
  await evalJs(`(() => { document.getElementById('cmdk-input')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1; })()`);
  await wait(250);
  const b = await evalJs('({ search: location.search, hash: location.hash, hidden: document.getElementById("cmdk").hidden })');
  if (!b.hidden) bad('J3', 'Esc 收面板', '面板还开着');
  else if (/[?&]q=/.test(b.search)) bad('J3', '关闭后不该留 q', `search=${b.search}`);
  else if (!/utm_source=keep/.test(b.search) || b.hash !== '#frag') bad('J3', '还原要回到入口那一份', `search=${b.search} hash=${b.hash}`);
  else ok('J3 关闭还原', `回到 ${b.search}${b.hash}`);
}
```

跑：`node scripts/verify-search-deeplink.mjs | tail -12` → 期望 J1 仍红、J2/J3 也红（功能未实现）。

- [ ] **Step 2：实现 E1**

`dev/js/editorial.js:620-633` 整段替换（`open` 加第二个参数、`close` 负责还原、新增 `entryUrl` 与 `syncUrl`）：

```js
        // 面板打开那一刻记下的入口地址（pathname + search + hash，不含本次输入）。
        // null 表示面板没开，syncUrl 于是任何事都不做。
        var entryUrl = null;

        /**
         * 打开面板。
         * @param {HTMLElement|null} trigger 触发元素（关闭后把焦点还给它）
         * @param {string} [preset] 预填的查询词。深链进站必须一次到位：先开后塞值会渲染两次，
         *   第二次把 .is-fresh 的错峰入场摘掉，观感就是「闪一下才出结果」。
         */
        function open(trigger, preset) {
            lastTrigger = trigger || null;
            entryUrl = location.pathname + location.search + location.hash;
            panel.hidden = false;
            document.body.classList.add('cmdk-open');
            input.value = preset || '';
            freshNext = true;
            window.setTimeout(function () { input.focus(); }, 0);
            render(input.value);
        }

        function close() {
            panel.hidden = true;
            document.body.classList.remove('cmdk-open');
            syncUrl('');
            entryUrl = null;
            if (lastTrigger) lastTrigger.focus();
        }

        /**
         * 把当前查询写进地址栏。只用 replaceState：一条面板不该产生历史条目。
         *
         * 整段包 try 的理由不是「万一不支持」。boot()（本文件末尾）把 20 个 init 平铺直叙
         * 排下来、没有逐条守护，initPalette 抛出会连带掐死后面 14 项；而 Safari 对
         * replaceState 有明确限流（30 秒内超过 100 次直接抛），快打字加粘贴撞得上。
         * 一次限流抛异常的代价，不该是「这一页的目录、书架、灯箱全没了」。
         * @param {string} value 已 trim 的查询词，空串表示删掉 q
         */
        function syncUrl(value) {
            if (entryUrl === null) return;
            try {
                var u = new URL(entryUrl, location.href);
                if (value) u.searchParams.set('q', value);
                else u.searchParams.delete('q');
                window.history.replaceState(null, '', u.pathname + u.search + u.hash);
            } catch (e) {
                /* 限流/解析失败：这一轮 URL 不跟，检索照常 */
            }
        }
```

`:795` 那行 `input.addEventListener('input', ...)` 换成：

```js
        input.addEventListener('input', function () {
            render(input.value);
            syncUrl(input.value.trim());
        });
```

`initPalette()` 收尾（原 `:798` 那个 `}` 之前）追加：

```js
        // 深链进站。放在所有监听器之后：这一次 open 于是走的是与手动打开完全同一条路径，
        // 错峰入场、setActive(0)、aria-activedescendant 一并生效，不是「看起来像但少了几步」。
        // 读 URLSearchParams 也包 try——同上，一条查询串不许带走 boot() 里后面 14 项能力。
        var preset = '';
        try {
            preset = (new URL(location.href).searchParams.get('q') || '').trim();
        } catch (e) {
            preset = '';
        }
        if (preset) open(null, preset);
```

- [ ] **Step 3：重建并确认 J1/J2/J3 全绿**

```bash
npx prettier --single-quote --print-width 320 --write dev/js/editorial.js
npx vite build && bundle exec jekyll build
node scripts/verify-search-deeplink.mjs | tail -12
```

期望：`✓ SEO/搜索深链验证 … 红点 0`，退出码 0。

- [ ] **Step 4：补两条牙齿**

```js
  { name: 'syncUrl 的 entryUrl 守护被摘掉（面板关着也改地址栏）', site: true, expect: '还原要回到入口那一份',
    mut: () => subOnce(minJs(), 'if(entryUrl===null)return;', '', 'syncUrl 守护') },
  { name: 'close 里不再抹 q', site: true, expect: '关闭后不该留 q',
    mut: () => subOnce(minJs(), 'syncUrl("");entryUrl=null;', 'entryUrl=null;', 'close 抹 q') },
```

产物里这两处的真实形状必须先用 `grep -o` 读出来再写锚点（terser 会去掉空格），锚点找不到目标时 `subOnce` 必须抛——「变异静默 no-op」就是假牙的制造工序。

- [ ] **Step 5：提交**

```bash
git add -- dev/js/editorial.js scripts/verify-search-deeplink.mjs scripts/verify-search-deeplink-teeth.mjs
git commit -F /tmp/gate/sp3-t2.txt
```

---

## Task 3：D3a IME 组合输入保护（修「组合中按 Enter 跳文章」）

**Files:**
- Modify: `dev/js/editorial.js`（`initPalette` 内：变量区、`:786` 之前的按键块、`:795` 的 input 监听）
- Modify: `scripts/verify-search-deeplink.mjs`（追加 J4）
- Modify: `scripts/verify-search-deeplink-teeth.mjs`（追加 2 条牙）

- [ ] **Step 1：先写 J4，两条子判据（不跳转 + 组合中不重绘）**

```js
group('J4 输入法组合中：Enter 不许跳文章，重绘不许跟着拼音串跑');
{
  await goto(`${ORIGIN}${BASE}/`);
  await wait(500);
  await evalJs(`(() => { const b = document.querySelector('[data-search-open]'); if (b) b.click(); return 1; })()`);
  await wait(250);
  const before = await evalJs('({ path: location.pathname, rows: document.getElementById("cmdk-results").children.length })');
  await evalJs(`(() => {
      const i = document.getElementById('cmdk-input');
      i.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      i.value = 'piao';                                  // 拼音串，还没选出汉字
      i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      return 1;
    })()`);
  await wait(350);
  const during = await evalJs('({ path: location.pathname, rows: document.getElementById("cmdk-results").children.length })');
  if (during.path !== before.path) bad('J4', '组合中按 Enter', `跳到 ${during.path} 了——那一下是「确认候选词」，不是打开第一条结果`);
  else if (during.rows !== before.rows) bad('J4', '组合中不重绘', `结果行从 ${before.rows} 变成 ${during.rows}：拼音串每跳一次就重排一次`);
  else ok('J4 组合中受保护', `地址与结果行都没动（${during.rows} 行）`);

  await evalJs(`(() => {
      const i = document.getElementById('cmdk-input');
      i.value = '飘';
      i.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  await wait(500);
  const after = await evalJs('({ rows: document.getElementById("cmdk-results").children.length, value: document.getElementById("cmdk-input").value, q: location.search })');
  if (after.value !== '飘') bad('J4', '组合结束后补一次渲染', `输入框实得 ${JSON.stringify(after.value)}`);
  else if (!/q=/.test(after.q)) bad('J4', '组合结束要同步 URL', `search=${after.q}`);
  else ok('J4 组合结束出结果', `「${after.value}」→ ${after.rows} 行，地址栏 ${decodeURIComponent(after.q)}`);
}
```

跑 → 期望 J4 红（`跳到 … 了`，因为今天没有守护）。

- [ ] **Step 2：实现**

`initPalette()` 变量区（`var freshNext = false;` 之后）加：

```js
        // 输入法组合态。标志位为主、事件上的 isComposing 为辅：Firefox 在「组合中按 Enter」
        // 这一路历史上不发 isComposing，只靠事件属性会漏；keyCode 229 是老 Chrome 的形状。
        var composing = false;
```

`:786`（`if (e.key === 'Escape') { ... }` 那一串的第一行）**之前**插入：

```js
            // 组合中的 Esc / ↑ / ↓ / Enter 整组归输入法。放在 panel.hidden 之后，所以 ⌘K 与 `/`
            // 这两个全局入口不受影响。
            if (composing || e.isComposing || e.keyCode === 229) return;
```

`input` 监听（Task 2 换过的那一条）改成三条：

```js
        input.addEventListener('compositionstart', function () { composing = true; });
        input.addEventListener('compositionend', function () {
            composing = false;
            render(input.value);
            syncUrl(input.value.trim());
        });
        input.addEventListener('input', function () {
            // 候选词还没落定就不重绘：拼音串每跳一次重排一次，打字看着像在闪。
            if (composing) return;
            render(input.value);
            syncUrl(input.value.trim());
        });
```

- [ ] **Step 3：重建、跑绿**

```bash
npx prettier --single-quote --print-width 320 --write dev/js/editorial.js
npx vite build && bundle exec jekyll build
node scripts/verify-search-deeplink.mjs | tail -8
```

期望 J1–J4 全绿。

- [ ] **Step 4：两条牙齿**

```js
  { name: '组合中的按键守护被摘掉', site: true, expect: '那一下是「确认候选词」',
    mut: () => subOnce(minJs(), 'if(composing||e.isComposing||229===e.keyCode)return;', '', 'IME 按键守护') },
  { name: 'compositionend 不补渲染', site: true, expect: '组合结束出结果',
    mut: () => cutOnce(minJs(), /composing=!1,/, 'IME 结束标志位') },
```

第二刀的具体锚点按产物实际形状定（落地时先 `grep -o 'composing[^;]\{0,24\}'` 列出所有出现点，挑唯一的那一处；不唯一就换更长的上下文，**绝不放宽成「找不到也不抛」**）。

- [ ] **Step 5：提交**

```bash
git add -- dev/js/editorial.js scripts/verify-search-deeplink.mjs scripts/verify-search-deeplink-teeth.mjs
git commit -F /tmp/gate/sp3-t3.txt
```

---

## Task 4：D3b 多词 AND 与逐词高亮（含单词口径的回归对账）

**Files:**
- Modify: `dev/js/editorial.js:642-662`（`score` / `mark`）、`:684-727`（`render` 里的调用点）
- Modify: `scripts/verify-search-deeplink.mjs`（追加 J5 期望集合对账 + J6 单词回归）
- Modify: `scripts/verify-search-deeplink-teeth.mjs`（追加 2 条牙）

- [ ] **Step 1：J5 —— Node 侧独立实现 + 浏览器实测集合对账**

`--head=` 之外再加一个语料参数，期望集合在 **Node 里另算一遍**（不是把 JS 里的逻辑抄第二遍，而是从 `search.json` 直接算），两边对账才有牙齿：

```js
group('J5 多词查询：结果集合等于 Node 侧独立算出的 AND 交集');
{
  const corpus = JSON.parse(fs.readFileSync(path.join(SITE, 'search.json'), 'utf8'));
  const fieldsOf = (it) => [it.title || '', it.tags || '', it.category || '', it.excerpt || ''];
  // 独立口径：四个字段里存在一个包含该词的（不区分大小写），就算该词命中。
  const andSet = (query) => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return corpus.filter((it) => terms.every((t) => fieldsOf(it).some((f) => f.toLowerCase().includes(t))))
      .map((it) => it.url);
  };
  const QUERIES = ['转场 搜索', '输入法 中文', 'diff 工具', 'seo 门禁 关键词', '不存在的词zz 转场'];
  for (const query of QUERIES) {
    await goto(`${ORIGIN}${BASE}/?q=${encodeURIComponent(query)}`);
    await wait(650);
    const got = await evalJs(`([...document.getElementById('cmdk-results').children]
        .map((li) => li.querySelector('a').getAttribute('href').replace(/^\\/better-blog/, '')))`);
    const want = andSet(query);
    const hit = new Set(got);
    const missing = want.filter((u) => !hit.has(u));
    if (got.length > 20) bad('J5', query, `返回 ${got.length} 行，超过 20 的上限`);
    else if (missing.length && want.length <= 20) bad('J5', query, `AND 里有 ${missing.length} 条没出现：${missing.slice(0, 3).join(' , ')}`);
    else if (!want.length && got.length) bad('J5', query, `独立口径判它零命中，面板却给了 ${got.length} 行——AND 没生效`);
    else ok('J5 多词集合', `「${query}」→ ${got.length} 行（独立口径 ${want.length} 条${want.length > 20 ? '，截到 20' : ''}）`);
  }
}
```

（`want.length > 20` 时只断言行数不越界、不回逐条：面板本来就有 top-20 截断，拿它跟「全部交集」比是量具口径错，不是产物错。）

- [ ] **Step 2：J6 —— 单词查询对 HEAD 逐条等序**

```js
group('J6 单词回归：结果集与顺序对 HEAD 产物逐条相等');
{
  if (!ORIGIN_HEAD) bad('J6', '回归对账', '没传 --head=，这一条判据无从对比');
  else {
    const WORDS = ['转场', '输入法', 'seo', 'diff', '性能', '缓存', '面试', 'nginx'];
    for (const w of WORDS) {
      const grab = async (origin) => {
        await goto(`${origin}${BASE}/?q=${encodeURIComponent(w)}`);
        await wait(650);
        return evalJs(`([...document.getElementById('cmdk-results').children]
            .map((li) => li.querySelector('a').getAttribute('href')))`);
      };
      const a = await grab(ORIGIN);
      const b = await grab(ORIGIN_HEAD);
      if (JSON.stringify(a) !== JSON.stringify(b)) bad('J6', `单词「${w}」`, `新 ${a.length} 行 vs 旧 ${b.length} 行，顺序也要紧：${a.slice(0, 3).join('|')} ≠ ${b.slice(0, 3).join('|')}`);
      else ok('J6 单词口径未变', `「${w}」${a.length} 行逐条等序`);
    }
  }
}
```

跑：`node scripts/verify-search-deeplink.mjs --head=/tmp/sp3/head/_site | tail -14` → 期望 J5 红（多词仍 0 行）、J6 绿（多词改动还没落地，单词自然等序）。

- [ ] **Step 3：实现 `score` / `mark` / `render`**

`dev/js/editorial.js:642-662`（`score` 与 `mark` 两个函数）整段替换：

```js
        /** 查询切成词：连续空白算一个分隔符。单词查询切出来就是它自己。 */
        function toTerms(query) {
            return query.split(/\s+/).filter(Boolean);
        }

        /**
         * 给单条结果打分：多个词之间是 AND —— 任一词在四个字段里都拿不到分，整条出局。
         *
         * 单词时走的仍是原来那条 `weights[i] - Math.min(idx, weights[i] - 1)` 的字段求和，
         * 一分没变：J6 拿 HEAD 产物对账，结果集与顺序必须逐条相等。
         * hits 允许出现重复下标（多词各命中同一字段时），消费点只做 indexOf(3) 判断，不去重。
         * @param {Object} item 检索条目
         * @param {string[]} terms 已小写化的词表
         * @returns {{score: number, hits: number[]}} score 为 0 表示不匹配
         */
        function score(item, terms) {
            var fields = [item.title || '', item.tags || '', item.category || '', item.excerpt || ''];
            var weights = [100, 40, 20, 8];
            var total = 0;
            var hits = [];
            for (var t = 0; t < terms.length; t++) {
                var termScore = 0;
                for (var i = 0; i < fields.length; i++) {
                    var idx = fields[i].toLowerCase().indexOf(terms[t]);
                    if (idx >= 0) {
                        termScore += weights[i] - Math.min(idx, weights[i] - 1);
                        hits.push(i);
                    }
                }
                if (!termScore) return { score: 0, hits: [] };
                total += termScore;
            }
            return { score: total, hits: hits };
        }

        /** 把用户输入当正则字面量使用之前必须转义，否则一个 `(` 就把构造打断。 */
        function escRe(s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        /**
         * 用 <mark> 包住每个词的每一次命中，帮用户确认「为什么这条被搜到」。
         *
         * 文本仍是一段一段 esc() 之后再拼（与旧版同一条转义链），词只进正则不进 HTML。
         * 词表按长度降序排：并列的 | 分支取先匹配到的那一支，长词不排前面，
         * 「搜索引擎」就会在同一起点上输给「搜索」。
         * @param {string} text 原文
         * @param {string[]} terms 小写词表
         * @returns {string} 已转义的 HTML 片段
         */
        function mark(text, terms) {
            var s = String(text);
            if (!terms.length) return esc(s);
            var re = new RegExp(
                '(' + terms.slice().sort(function (a, b) { return b.length - a.length; }).map(escRe).join('|') + ')',
                'gi'
            );
            var out = '';
            var last = 0;
            var m;
            while ((m = re.exec(s)) !== null) {
                if (!m[0]) { re.lastIndex++; continue; }
                out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
                last = m.index + m[0].length;
            }
            return out + esc(s.slice(last));
        }
```

`render()`（`:684-727`）里三处调用点跟着改：

```js
            var q = query.trim().toLowerCase();
            var terms = toTerms(q);
            if (!terms.length) {
```

```js
                    var s = score(data[i], terms);
```

```js
                        + '<span class="cmdk-item-title">' + mark(item.title || '', terms) + '</span>'
                        + '<span class="cmdk-item-snippet">' + mark(snippet.slice(0, 90), terms) + '</span>'
```

- [ ] **Step 4：重建、跑绿**

```bash
npx prettier --single-quote --print-width 320 --write dev/js/editorial.js
npx vite build && bundle exec jekyll build
node scripts/verify-search-deeplink.mjs --head=/tmp/sp3/head/_site | tail -10
```

期望 J1–J6 全绿（J6 尤其不许红：单词口径一变，回归对账就抓到它）。

- [ ] **Step 5：两条牙齿**

```js
  { name: 'AND 退化成「第一个词说了算」（后续词不再出局整条）', site: true, expect: '独立口径判它零命中',
    mut: () => subOnce(minJs(), 'if(!termScore)return{score:0,hits:[]};', '', 'AND 门') },
  { name: 'mark 只包第一处命中', site: true, expect: '处高亮',
    mut: () => subOnce(minJs(), "while(null!==(m=re.exec(s)))", 'if(null!==(m=re.exec(s)))', '逐词高亮') },
```

第一刀专门打「不存在的词zz 转场」那一条：AND 门被摘掉后它会返回一堆行，独立口径判 0 → 必须红。
锚点同样要先 `grep -o` 读产物实际形状再定，读不出唯一目标就抛。

- [ ] **Step 6：提交**

```bash
git add -- dev/js/editorial.js scripts/verify-search-deeplink.mjs scripts/verify-search-deeplink-teeth.mjs
git commit -F /tmp/gate/sp3-t4.txt
```

---

## Task 5：E2 SearchAction（先加组 11 与四条牙，再改模板）

**Files:**
- Modify: `_includes/jsonLd.html:132-142`
- Modify: `scripts/check-seo.mjs`（新组 + `GROUPS` 追加）
- Modify: `scripts/check-seo-teeth.mjs`（`cases` 追加 4 条）

- [ ] **Step 1：check-seo.mjs 组 11**

在「组 10：换源」那段之后、`// ── 跑 ──` 之前插入：

```js
// ── 组 11：searchAction（站内搜索的机器可读声明） ────────────────────────────
{
  const g = 'searchAction';
  const HOME = 'index.html';
  if (!hasSite(HOME)) {
    bad(g, '首页产物', '_site 里没有 index.html，这一组无从判起');
  } else {
    // 全站恰好一份，且落在首页。WebSite 只在 page.url == '/' 那一支发出去（jsonLd.html:124），
    // 翻页视图跟着各声明一遍等于给爬虫 N 个互相竞争的规范声明。
    const holders = [];
    for (const rel of htmlFiles) {
      for (const b of jsonLdBlocks(readSite(rel))) {
        if (b.error || !b.value || !b.value.potentialAction) continue; // 解析失败由组 3 判红，不重复报
        holders.push({ rel, v: b.value });
      }
    }
    if (holders.length !== 1) {
      bad(g, '全站份数', `potentialAction 出现在 ${holders.length} 份文档（要恰好 1 份，且是首页）`);
    } else {
      const { rel, v } = holders[0];
      if (rel !== HOME) bad(g, rel, `potentialAction 落在这一页，首页才是 WebSite 的落点`);
      const pa = v.potentialAction;
      const t = Array.isArray(pa['@type']) ? pa['@type'] : [pa['@type']];
      if (!t.includes('SearchAction')) bad(g, rel, `potentialAction.@type 是 ${JSON.stringify(pa['@type'])}，不是 SearchAction`);
      if (!pa.target || pa.target['@type'] !== 'EntryPoint') bad(g, rel, 'target 不是 EntryPoint');
      else if (pa.target.urlTemplate !== `${v.url}?q={search_term_string}`) {
        bad(g, rel, `urlTemplate 与本页 WebSite.url 不同口径：${JSON.stringify(pa.target.urlTemplate)} ≠ ${JSON.stringify(v.url)}?q={search_term_string}`);
      }
      if (pa['query-input'] !== 'required name=search_term_string') bad(g, rel, `query-input=${JSON.stringify(pa['query-input'])}`);
      // 诚实性交叉检查：这一页必须真的能接住 ?q=。面板或脚本不在，SearchAction 就是空头支票——
      // SP1 停掉它正是因为这个地址当时没人读。
      const homeText = readSite(HOME);
      if (!/id="cmdk"/.test(homeText)) bad(g, HOME, '声明了 SearchAction 却没有 #cmdk，?q= 无人接收');
      if (!/editorial\.min\.js/.test(homeText)) bad(g, HOME, '声明了 SearchAction 但这一页不加载 editorial.min.js，面板打不开');
    }
  }
}
```

并把 `GROUPS`（`:1145`）末尾追加 `'searchAction'`（这一行决定 `--list` 的输出与「N 组全绿」那句的计数）。

- [ ] **Step 2：跑门，确认红**

```bash
node scripts/check-seo.mjs --root=. --site=_site | tail -4
```

期望：`✗ [searchAction] 全站份数：potentialAction 出现在 0 份文档（要恰好 1 份，且是首页）`，退出码 1。

- [ ] **Step 3：改模板**

`_includes/jsonLd.html:140` 那行 `"description": {{ site.description | jsonify }}` 补一个逗号，并在 `}` 之前插入下面这段（`{search_term_string}` 是单层花括号，Liquid 不会碰它；`site_home` 就是同块里 `"url"` 用的那个变量，绝不再算第二遍地址）：

```liquid
  ,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "{{ site_home }}?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
```

（写成前置逗号还是后置逗号，以该文件现有风格为准：本块其余字段都是「行尾逗号」。落地时把 `:140` 改成 `"description": {{ site.description | jsonify }},` 再追加这一段。）

- [ ] **Step 4：重建，跑门确认绿**

```bash
bundle exec jekyll build
node scripts/check-seo.mjs --root=. --site=_site | tail -2
```

期望：`✓ SEO 门禁 11 组全绿（… / searchAction）；JSON-LD 206 块全部可解析`，退出码 0。字节增量：只在首页 +约 220 B raw（写进交付实录，不必重算全站）。

- [ ] **Step 5：四条牙齿（落在 check-seo-teeth.mjs 的 `cases` 末尾，group 一律写 `'searchAction'`）**

```js
  { name: 'potentialAction 整块删掉', group: 'searchAction', expect: 'potentialAction 出现在 0 份文档',
    mut: () => S.sitePatch(T.home.rel, /"@type":"WebSite"[\s\S]*?<\/script>/, (m) => m.replace(/,?"potentialAction":[\s\S]*?\n\}\n/, '\n}\n'), 'SearchAction 整块') },
  { name: 'urlTemplate 与 url 不同口径', group: 'searchAction', expect: 'urlTemplate 与本页 WebSite.url 不同口径',
    mut: () => S.siteSub(T.home.rel, '?q={search_term_string}', '?query={search_term_string}', 'urlTemplate') },
  { name: '占位符名字与 query-input 不一致', group: 'searchAction', expect: 'query-input=',
    mut: () => S.siteSub(T.home.rel, 'required name=search_term_string', 'required name=term', 'query-input') },
  { name: '首页那份被复制到 page2', group: 'searchAction', expect: 'potentialAction 出现在 2 份文档',
    mut: () => siteCopyWebSiteToPage2() },
```

四条的注意事项：
1. `S.sitePatch` 的回调必须**自证落到了位**（返回的串与原串不同，否则抛），这是台账第 1 条口径。
2. `T.home` / page2 的 rel 名要用该脚本已有的台账变量；如果 `T` 里没有首页，就在台账里补一条 `home: { rel: 'index.html' }` 并核对第 4 页翻页视图的真实文件名（`PAGE_RE` 那套映射：`/page2/` → `page2/index.html`）。
3. 第 4 条需要新 helper（把首页那份 WebSite `<script>` 整块插进 page2 的 `</head>` 之前）：

```js
/** 复制首页的 WebSite 块到翻页视图：模拟「paginate 复用同一份 index.html」那类回潮 */
function siteCopyWebSiteToPage2() {
  const home = fs.readFileSync(path.join(SHADOW, 'index.html'), 'utf8');
  const block = /<script type="application\/ld\+json">\s*\{\s*"@context"[^\n]*?[\s\S]*?"@type":\s*"WebSite"[\s\S]*?<\/script>/m.exec(home);
  if (!block) throw new Error('首页里找不到 WebSite 块，第四刀没法注入');
  return S.siteAfter('page2/index.html', '</head>', block[0], '翻页视图多出 SearchAction');
}
```

4. 跑：`node scripts/check-seo-teeth.mjs --root=/tmp/sp3/head --site=/tmp/sp3/head/_site --only=searchAction` → 期望 4/4 红得正确；再不带 `--only` 跑全量 → `✓ 牙齿 N/N`。

- [ ] **Step 6：提交**

```bash
git add -- _includes/jsonLd.html scripts/check-seo.mjs scripts/check-seo-teeth.mjs
git commit -F /tmp/gate/sp3-t5.txt
```

---

## Task 6：A/B 三条实测 + 全量门禁回归 + 交付实录

**Files:**
- Create: `_docs/superpowers/specs/2026-10-02-search-deeplink-design.md`（追加 §9 交付实录，不新建文档）
- Create: `/tmp/sp3/ab.mjs`（量具，一次性，不入库）

- [ ] **Step 1：干净导出树重建两棵树**

```bash
rm -rf /tmp/sp3/head /tmp/sp3/new && mkdir -p /tmp/sp3/head /tmp/sp3/new
# 基线写死成 spec 那一枚提交（Task 1 之前的树），不写 HEAD~N：
# 落地过程中提交数会随任务增减，相对位置一旦算错，A/B 量的就是两棵不存在的树。
git archive 0bc51a1 | tar -x -C /tmp/sp3/head
git archive HEAD | tar -x -C /tmp/sp3/new
git -C /tmp/sp3/new rev-parse HEAD >/dev/null   # 导出树是 detached 的，这里只确认 tar 落地成功
for d in head new; do ln -s /Users/liaolongdong/code/liaolongdong.github.io/vendor /tmp/sp3/$d/vendor; done
(cd /tmp/sp3/head && npx vite build && bundle exec jekyll build) && (cd /tmp/sp3/new && npx vite build && bundle exec jekyll build)
```

导出之后必须先自证两棵树真的不同，否则「head 恒 0 行」那种结论可能是同一棵树给了两遍：

```bash
grep -c 'searchParams.get("q")' /tmp/sp3/head/_site/assets/js/editorial.min.js \
  /tmp/sp3/new/_site/assets/js/editorial.min.js
grep -c 'SearchAction' /tmp/sp3/head/_site/index.html /tmp/sp3/new/_site/index.html
```

期望：head 那两个计数都是 0，new 都是正数。任何一边对不上就停下来查导出，别往下量。

期望：两个 `jekyll build` 都 `Auto-regeneration`/`Done`，`_site/index.html` 各自存在；`head` 那份的 `searchAction` 组应当**不适用**（它没有组 11）。

- [ ] **Step 2：三条数**

| 编号 | 量什么 | 口径 |
| --- | --- | --- |
| ① | 单词回归面 | `node scripts/verify-search-deeplink.mjs --site=/tmp/sp3/new/_site --head=/tmp/sp3/head/_site` 里 J6 的 8 条；逐条「等序」才算过 |
| ② | 多词收益 | 同一脚本 J5 的 5 条查询，`head` 树行数恒为 0（旧版切不出多词），`new` 树行数取实测值；报「head 0 行 → new N 行」的逐条对照 |
| ③ | 深链进站代价 | `Network.requestWillBeSent` 里 `search.json` 的请求次数：带 `q` 的进入 1 次 vs 不带的 0 次；再取 `Performance.getMetrics` 的 `loadEventsFiredTimestamp` 差值。**若 `navigator.serviceWorker.controller` 为真，这一条主动 exit 2 拒测**（SW 会把 search.json 从缓存里给出来，那个差值不是网络代价） |

③ 的 fast3g 档只在 SW 缺席时补测；测不出来就写「未测」，不许把不限量那一档的数当 fast3g 的数（房规：宁可少一个数）。

- [ ] **Step 3：全量门禁回归（逐条从干净导出树跑，管道不许吞退出码）**

```bash
set -o pipefail
i=0
for t in \
  "node scripts/toolkit-tests.mjs" \
  "node scripts/check-seo.mjs --root=. --site=_site" \
  "node scripts/check-seo-teeth.mjs --root=/tmp/sp3/new --site=/tmp/sp3/new/_site" \
  "node scripts/verify-search-deeplink.mjs" \
  "node scripts/verify-search-deeplink-teeth.mjs" \
  "node scripts/check-image-dims.rb" \
  "node scripts/check-image-dims-teeth.mjs --root=." \
  "node scripts/check-image-variants-teeth.mjs --root=." \
  "node scripts/check-tools-surface.mjs --site=_site" \
  "node scripts/check-tools-surface-teeth.mjs" \
  "node scripts/verify-plan-blocks.mjs"; do
  i=$((i+1)); echo "### [$i] $t"
  # 日志名按序号，不按命令内容裁剪：`tr -dc 'a-z'` 会把数字全剪掉，
  # 两条同族脚本（如 check-seo 与 check-seo-teeth）会撞进同一个文件，后写的覆盖前写的，
  # 于是「日志在、结论没丢」其实是假的。
  eval "$t" > "/tmp/sp3/log-$i.log" 2>&1; echo "exit=$?  log=/tmp/sp3/log-$i.log"
done
```

参数口径是逐条对过脚本头部的，别自创：`check-tools-surface.mjs` 只认 `--site=`（根目录由脚本位置推），
它的牙齿 `check-tools-surface-teeth.mjs` 不认 `--root=`——源侧变异只能在**脚本所在的那棵树**里就地改、
退出钩子还原；正因如此这一轮必须在本工作树跑，绝不在主工作树跑（那里挂着并发会话的暂存）。
`verify-plan-blocks-teeth.mjs` 不在表里：它自己用 `git status` 自护，导出树里没有 git，
必须在真仓库单独跑一次 `node scripts/verify-plan-blocks-teeth.mjs`（本工作树是真 worktree，可以直接跑）。

`verify-motion-batch4.mjs` / `verify-nav-touch.mjs` 这两道 Chrome 门属于并发会话的动效领地
（前者在他们那份暂存里正被删除），本轮不代替它们跑结论；只在时间允许时各跑一次做只读交叉检查，
**红了不许改它们的脚本**，改用 `/tmp/sp3/head` 那份纯基线导出树跑同一条脚本归因，把结论写进交接。

期望：每行 `exit=0`，并且 `/tmp/sp3/log-$i.log` 里那条脚本自己的汇总行确实存在（汇总行缺失＝半路被 SIGTERM，不等于通过）。任何一条非 0 都先用 `/tmp/sp3/head` 那份纯基线导出树跑同一条脚本归因，分清是自己引入的还是并发会话带进来的；红灯若来自机器人提交也要顺手修，否则推上去 main 还是红的。

- [ ] **Step 4：交付实录写进 spec（§9），必须照着能复算的口径写**

写：三条 A/B 数（含口径与用例名）、门禁新增条目（组 11 + J1–J6 + 牙齿 8 条）、字节增量（首页 +约 220 B raw / gzip 实测值，用 shell `gzip -9` 口径，不用 `zlib.gzipSync`）、D2 退掉的原文与那条续命实验、`index-all.html` 那句「无脚本」与产物不符的遗留。
**不过 prettier**，表格一行的改动要保住该列的原显示宽度。

- [ ] **Step 5：提交**

```bash
git add -- _docs/superpowers/specs/2026-10-02-search-deeplink-design.md
git commit -F /tmp/gate/sp3-t6.txt
git log --oneline -6
```

---

## Self-Review（写完后自查，已按结果改过）

- **覆盖**：spec §3→Task 2、§4→Task 3、§5→Task 4、§6→Task 5、§8.1→Task 5 Step 1、§8.2→Task 1–4 的 J1–J6 与牙齿、§8.3→Task 6、§7(D2) 无任务（本就不做）。无遗漏。
- **占位**：`/tmp/gate/sp3-tN.txt` 是提交信息文件的路径约定（房规：不许 heredoc），不是待填内容；Task 5 Step 3 那处逗号写法留了「以现有风格为准」的判定说明，属可执行的判据而非 TBD。
- **一致性**：`open(trigger, preset)`、`entryUrl`、`syncUrl(value)`、`composing`、`toTerms`、`escRe`、`score(item, terms)`、`mark(text, terms)` 在 Task 2/3/4 与各牙齿锚点中同名同签名；判据编号 J1–J6 与牙齿条目一一对应。
