# 工具页档位进 URL 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 JSON 页与对比页的档位（视图 / 缩进 / 排序；模式 / 布局 / 上下文 / 忽略空白 / 区分大小写）成为可分享的地址，并给四页立一条「用户输入不进地址栏」的不变量。

**Architecture:** 读写规则落在 `dev/js/tools/url-state.js`，经 `toolkitCore.js` 挂成 `window.Tk.url` 的第四个面（两个入口各自 import 同一模块会被 Rollup 提成共享 chunk、被 `iife-wrap` 包进函数体后当场 SyntaxError，这条红线写在 `toolkitCore.js:5-9`）；两页装配层只在「档位真的变了」的那几个点调 `Tk.url.sync`，进站那一次读落在现有挂载序之前。

**Tech Stack:** 原生 ES 模块 + Vite 6（每个 `dev/js/*.js` 一枚独立入口）+ Jekyll 4.3.4；门禁是 Node（`node:test`）与 headless Chrome（CDP）。

规格：`_docs/superpowers/specs/2026-10-02-tool-url-state-design.md`（键名表、读写规则、不做清单都在那里，本计划不重抄理由，只写落地形状）。

---

## 开工前必读的三条仓规

1. **只按 pathspec 暂存自己的文件**，每次提交后 `git diff --cached --name-only` 复核。并发会话在主工作树有十几个暂存项；`vendor` 那枚符号链接永不入库。
2. **`dev/js/*.js` 不过 prettier**（只有 `check-*.mjs` 与 markdown 过）。本仓没有 prettier 配置文件，跑 `--check` 时必须显式给 `--single-quote --print-width 320`。
3. **`_docs/superpowers/plans/` 里那五份计划是镜像的宿主**：`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 把 `jsonWorkbench.js` / `toolJson.js` / `diffWorkbench.js` / `toolDiff.js` / `toolkitCore.js` / `check-tools-surface.mjs` **整本**钉成「计划里必须有一段逐字节相同的块」。改这些文件之后必须跑 `--fix` 换镜像块并连同计划一起提交，否则这道门红。新计划（本文件）不在 `PLANS` 里，不产镜像。

**工作树**：`.worktrees/sp2-tool-url-state`（分支 `sp2-tool-url-state`，起点 `d717c17`）。基线已验：`node scripts/toolkit-tests.mjs` exit=0、`node scripts/check-tools-surface.mjs --site=_site` exit=0、`node scripts/verify-plan-blocks.mjs` = `✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`。

---

### Task 1：量具先行——`Tk.url` 的纯函数与它的 Node 单测

**Files:**
- Create: `dev/js/tools/url-state.js`
- Create: `scripts/tool-url-state-tests.mjs`
- Modify: `dev/js/toolkitCore.js`

- [x] **Step 1：先写单测，让它红**

`scripts/tool-url-state-tests.mjs` 用 `node:test` + `node:assert/strict`，直接 `import … from '../dev/js/tools/url-state.js'`。为什么不在 `scripts/toolkit-tests.mjs` 里加一节：那本按 `// ── §([B-Z]\d*) ` 切段（`verify-plan-blocks.mjs:276`），每一段都要在五份计划里有一枚逐字节全等的镜像块；新起一段就得往段 5 那份 diff 页的计划里贴一整块不属于它的代码。独立一本、不挂镜像，是把「新增」与「既有镜像账」分开的最便宜形状。

十二判，覆盖这几档形状（每判都要断到**具体串**，不许只断「不抛」）：

```js
const KEYS = [
  { name: 'jt-view', kind: 'select', options: ['text', 'tree'], dflt: 'text' },
  { name: 'jt-indent', kind: 'select', options: ['two', 'four', 'tab'], dflt: 'two' },
  { name: 'df-ws', kind: 'check', dflt: false },
];
test('U0-1 读：白名单内的值才回来', () => {
  const r = parse('?utm_source=x&jt-view=tree&jt-indent=tab', KEYS);
  assert.deepEqual(r.found, { 'jt-view': 'tree', 'jt-indent': 'tab' });
  assert.deepEqual(r.ignored, []);
});
test('U0-2 读：白名单外的值点名进 ignored，且不回来任何值', () => {
  const r = parse('?jt-view=dark', KEYS);
  assert.deepEqual(r.found, {});
  assert.deepEqual(r.ignored, ['jt-view']);
});
test('U0-3 读：空串与缺席同档（都算「这一格没人说话」）', () => {
  assert.deepEqual(parse('?jt-view=', KEYS).found, {});
  assert.deepEqual(parse('', KEYS).found, {});
});
test('U0-4 读：check 只认 '1'，'0' 与 'yes' 都进 ignored', () => {
  assert.equal(parse('?df-ws=1', KEYS).found['df-ws'], true);
  assert.deepEqual(parse('?df-ws=0', KEYS).ignored, ['df-ws']);
  assert.deepEqual(parse('?df-ws=yes', KEYS).ignored, ['df-ws']);
});
test('U0-5 读：畸形 search 不抛（URLSearchParams 自己会解，但空键名那类要给 {}）', () => {
  assert.deepEqual(parse('=?&=&jt-view=tree', KEYS).found, { 'jt-view': 'tree' });
});
```

同步侧七判：`sync(loc, hist, KEYS, values)` 在「我的键一个都没变」时**必须返回 false 且一次 `replaceState` 都不发生**（用假 `history` 数调用次数）；值落回默认要把键删掉（`{ 'jt-view':'text' }` 从 `?jt-view=tree` 出来是 `utm` 保留、`jt-view` 消失）；别人的键逐键保留且**顺序不变**（`?z=9&utm_source=x` 之后仍是这个顺序，我新增的排末尾）；只用 `replaceState`、不许碰 `pushState`（假 history 里只给 `replaceState`，给了 `pushState` 就是测试夹具的错）；`history.state` 原样带走（`{a:1}` 要能在第三次入参里读回）；写出的 URL = `pathname + '?' + search + hash`，`hash` 在带 `#section-3` 时不许丢；`replaceState` 抛（Safari 限流的形状）时 `sync` 返回 false 而不是上抛。

- [x] **Step 2：跑起来确认它红**

Run: `node scripts/tool-url-state-tests.mjs`
Expected: `Cannot find module …/dev/js/tools/url-state.js`，exit ≠ 0。

- [x] **Step 3：写实现**

`dev/js/tools/url-state.js`（零 import，与 `view.js` / `ui.js` 同一档）：

```js
export function parse(search, keys) { /* URLSearchParams 解一遍，found 只收白名单 */ }
export function nextSearch(search, keys, values) { /* 只 set/delete 自己的键；等价则 null */ }
export function sync(location, history, keys, values) { /* 调 nextSearch，null 就返回 false */ }
```

（落地时把这一行删了：`export default { parse, nextSearch, sync }`。理由是 `import * as url` 会把 `default` 一起挂进 `Tk`，而 `view.js` / `ui.js` 两本同形先例都只有具名导出——J12 现在按 `Object.keys(window.Tk.url)` 数这三格，多一格就红。）

三条实现口径钉死在代码里：`nextSearch` 从**现有** `search` 起建 `URLSearchParams`（别人的键因此原样保留、原样有序），只在 `changed` 为真时返回串；`sync` 里 `history.replaceState(history.state ?? null, '', …)` 那一格与 `dev/js/tools/panel-dom.js:165` 同形；整个 `sync` 包 `try { … } catch { return false }`。

- [x] **Step 4：跑绿**

Run: `node scripts/tool-url-state-tests.mjs` → `pass 12 / fail 0`。

- [x] **Step 5：挂进 `Tk`**

`dev/js/toolkitCore.js`：第 30 行后加 `import * as url from './tools/url-state.js';`，末行改成
`window.Tk = { createPanelWorkspace, createPanelDom, view, ui, url };`
并把文件头那段「只挂这四个名字」的注释改成五个、追加一条扩面记录（这一段是 `:15-18` 自己要求的「显式扩面要写在这里」）。

Run: `node scripts/verify-plan-blocks.mjs --fix && node scripts/verify-plan-blocks.mjs`
Expected: `✓ …（未落地 0 节）`——`toolkitCore.js` 的镜像换成了新内容。

Run: `npx vite build && node scripts/check-tools-surface.mjs --site=_site`
Expected: exit=0（组 5 的 `import{` 计数仍为 0）。

**落地补记（这一格比计划多改了三处，都是门自己要求的）**：`window.Tk` 的挂面在 `toolkit-tests.mjs`
里被钉死了三次——J12（`Object.keys(tk)` 四只清单）、O13(c)（同一份清单 + `core` 必须 import 那本）、
Q2（按源码文本数 `window.Tk = {…}` 里的名字，标题写着「不许多出第五只」）。加第五只必然三处同红，
所以三处一起改口五只（Q2 的标题改「第六只」），并给 J12 补一条 `Object.keys(tk.url)` 恰为
`['nextSearch','parse','sync']`、给 O13(c) 补一条 `core` 必须 `import` `url-state.js`。
镜像账跟着换：`verify-plan-blocks.mjs --fix` 重写段 2 两块（`toolkitCore.js` 整本 + §J）与
段 3 两块（§O、§Q）。`toolkit-tests.mjs` 439 pass / 0 fail。尺寸不进这一格的账，归 Task 7。

- [x] **Step 6：提交**

```bash
git add dev/js/tools/url-state.js scripts/tool-url-state-tests.mjs dev/js/toolkitCore.js \
  _docs/superpowers/plans/ _docs/superpowers/specs/2026-10-02-tool-url-state-design.md \
  _docs/superpowers/plans/2026-10-02-tool-url-state.md
git diff --cached --name-only
git commit -F /tmp/sp2/msg-1.txt
```

---

### Task 2：JSON 页接入——键表、进站读、四个同步点

**Files:**
- Modify: `dev/js/toolJson.js:159-177`
- Modify: `dev/js/tools/jsonWorkbench.js`

- [ ] **Step 1：入口把环境给它（红线：环境只在入口读）**

`toolJson.js` 的 `createJsonWorkbench({…})` 里加两格，紧跟 `navigator` 那格之后：

```js
    location: win.location,
    history: win.history,
```

- [ ] **Step 2：装配层建键表**

键表由 `JSON_SPEC` 现产，不写第二份清单——`options` 与 `dflt` 都从那张表读，`dflt` 取 `options[0]`（骨架钉的是「第一枚 `<option>` 就是默认档」，与 `:808-809` 那两处 `?? 'two'` / `?? 'off'` 同源）。`jt-query` / `jt-doc` / `jt-memorize` 明确不在表里。

```js
  const URL_KEYS = JSON_SPEC[PANEL].sides[SIDE].controls
    .filter((c) => c.type === 'select' && c.id !== 'query')
    .map((c) => ({ name: `${prefix}-${c.id}`, control: c.id, kind: 'select', options: c.options, dflt: c.options[0] }));
```

（`query` 是 `type: 'text'`，这一行 filter 天然把它挡在外面；写出来是为了让读代码的人在原地看见「它是文本、所以不在这里」。）

- [ ] **Step 3：进站那一次读，落在挂载三笔之前**

`wireAll()` 尾部那三笔（`:939-943`）之前插一段：`Tk.url` 缺席就整段跳过；读到的值逐键写进控件，
**只写控件、不解析**（红线 4「挂载期一次计算都不做」在 `:26`）。

```js
    if (urlMod && loc) {
      const got = urlMod.parse(loc.search, URL_KEYS);
      for (const k of URL_KEYS) {
        if (got.found[k.name] === undefined) continue;
        const el = node(fieldId(prefix, PANEL, k.control));
        if (el) el.value = got.found[k.name];
      }
    }
```

`URL_KEYS` 每格因此带两个名字：`name`（地址栏里那枚键）与 `control`（`JSON_SPEC` 里的裸控件 id，
用来拼真实 DOM id）。模块只吃 `name` / `kind` / `options` / `dflt` 四格，多出来的 `control` 它按
「不认识字段」忽略——这一步是门禁⑥ 能同时反查「键名由前缀 + 控件拼出」与「名单里没有裸控件名」
两件事的前提。`got.ignored` 不写提示行（spec §3：地址栏不是缺陷）。

- [ ] **Step 4：四个同步点**

`view` 的 change 处理末尾、`query` 的 change（新增一枚，只同步、不计算）、`indent` 与 `sort` 各新增一枚**只写地址栏**的 change 监听、`reset` 那族不涉及（JSON 页没有 reset 按钮动这三格）。抽一个局部量：

```js
  const syncUrl = () => {
    if (!urlMod || !loc || !hist) return;
    const values = {};
    for (const k of URL_KEYS) {
      const el = node(fieldId(prefix, PANEL, k.control));
      values[k.name] = el && typeof el.value === 'string' ? el.value : k.dflt;
    }
    try { urlMod.sync(loc, hist, URL_KEYS, values); } catch { /* 地址栏是镜像，不是来源 */ }
  };
```

`doc` 与 `memorize` 那条路上一个字节都不许调它。

- [ ] **Step 5：重建 + 一条 smoke**

```bash
npx vite build && bundle exec jekyll build
node -e "const h=require('fs').readFileSync('_site/tools/json.html','utf8');console.log(h.includes('jt-in-workbench-view'))"
```

Expected: `true`；`grep -c 'import{' assets/js/toolJson.min.js` = 0。

- [ ] **Step 6：提交**（`dev/js/toolJson.js`、`dev/js/tools/jsonWorkbench.js` + `--fix` 换掉的镜像 + 计划勾选）

---

### Task 3：对比页接入——三个下拉、两枚 checkbox、两条程序化路径

**Files:**
- Modify: `dev/js/toolDiff.js:200-214`
- Modify: `dev/js/tools/diffWorkbench.js`

- [ ] **Step 1：入口注入 `location` / `history`**（与 Task 2 Step 1 同一形状）

- [ ] **Step 2：键表从 `DIFF_SPEC` + `DEFAULTS` 现产**

```js
  const URL_KEYS = [
    ...['mode', 'layout', 'context'].map((id) => ({
      name: `${env.prefix}-${id}`, control: id, kind: 'select',
      options: id === 'context' ? Object.keys(CONTEXT_VALUE) : (id === 'mode' ? MODE_OPTIONS : LAYOUT_OPTIONS),
      dflt: DEFAULTS[id],
    })),
    ...['ws', 'case'].map((id) => ({ name: `${env.prefix}-${id}`, control: id, kind: 'check', dflt: false })),
  ];
```

`dflt` 用 `DEFAULTS`（`:81`，「重置」那一段用的也是它），不另立一份——这一格与 JSON 页取 `options[0]` 不同，是因为这一页本来就有一份写死的默认表，取 `options[0]` 反而造出第二个口径。

- [ ] **Step 3：进站读，落在 `refreshGate()` 之前**（`mount:806` 那一句之前）；值写进 `field(id)`，select 用 `.value`、check 用 `.checked = true`（只有 `found` 里有才置真，缺席不动）。仍然一次计算都不做：`readControls()` 不在这条路上跑，第一次比对照旧是用户按「比较」。

- [ ] **Step 4：三个同步点**

`syncUrl` 同 Task 2 那一段（check 那两枚读 `field(id).checked === true`）；调用点三处：
`retune()` 末尾（一次覆盖 `mode` / `layout` / `context` 三个下拉与折叠那三枚快捷键，`:645-649` 走的就是 `retune`）、
`ws` / `case` 的 change 处理里（`:794-803`，`run()` 之后）、
`reset` 那一段（`:635-641`，`readControls()` 之后——不按这一条，地址栏会留在重置前那一档，刷新就复活）。

- [ ] **Step 5：重建 + smoke**（同 Task 2 Step 5，产物名换 `toolDiff.min.js` / `_site/tools/diff.html`）

- [ ] **Step 6：提交**

---

### Task 4：浏览器门禁 `scripts/verify-tool-url.mjs`（U1–U7）

**Files:**
- Create: `scripts/verify-tool-url.mjs`

- [ ] **Step 1：把 SP3 那本量具的四段脚手架逐字抄进来**（`scripts/verify-search-deeplink.mjs` 的抢端口 + `md5` 自证 + 负载闸 + `until()` 轮询那四段），三处改动：环境变量名 `TU_SITE_DIR`（沿用 `verify-tools-browser.mjs:66-74` 那条「指到仓库 `_site` 就退 2」的隔离门）、页面清单换成 `tools/json.html` 与 `tools/diff.html` 两枚 + 四页名单、收尾行文案。

- [ ] **Step 2：写 U1（进站按参数落定）与 U2（非法值忽略且不抹）**

U1 的判据形状是逐键两读：`location.search` 与那枚控件的 `.value`（对比页 check 读 `.checked`）。合法值从产物里现取，不写死——

```js
const OPTS = await evalJs(`(() => {
  const el = document.getElementById('${fid}');
  return [...el.options].map((o) => o.value);
})()`);
```

每键取 `OPTS` 里**非默认**的那一档打进去（`dflt` 由 Node 侧从 `_site` 的骨架里数第一枚 `<option>`，与 `check-tools-surface` 的骨架读法同源，不抄装配层的表）。U2 打 `?${k}=不存在的档&keep=1&utm_source=x`，断言三件：控件仍是骨架给的那一档、`keep=1` 与 `utm_source=x` 逐字节在、`search` 里那枚非法值**没被抹掉**（那是别人的参数）。

- [ ] **Step 3：U3（只用 replace）——`history.length` 增量**

抄 SP3 那一条的形状（`verify-search-deeplink.mjs` 的 J2）：连改 20 次档位前后各读一次 `history.length`，断言差 0。**不要**用 `getEntriesByType('navigation')`——那个条目数每文档恒 1，`pushState` 不往里加（SP3 spec §11.4 第 3 条记的就是这枚计划级假牙）。

- [ ] **Step 4：U4（除自己的键以外一字不动）与 U5（程序化路径也跟）**

U4：进站带 `?keep=1&utm_source=x`，动一次档位后 `URLSearchParams` 逐键读回两键同值，且新键排在末尾。
U5：对比页点「全部展开」（`df-btn-workbench-fold-all`，走 `:645-649` 那条程序化写回）→ 地址栏要出现 `df-context=all`；点「重置」→ 该键要消失。这两子格抓的是「挂在 change 上就算全了」那个假口径。

- [ ] **Step 5：U6（输入不进地址栏）四页全判**

往每页的第一枚 `textarea` / 主输入格打一枚唯一 token（`ZQX` + 随机 6 位），然后按该页一个会重绘的动作，断言 `location.href` 不含它。JSON 页额外打 `jt-in-workbench-query`（它**是**输入，且明确不在名单里），对比页两栏各打一次。证件页与编码页同样判——它们这一轮不加新键，这一格是给它们上的**回归锁**。

- [ ] **Step 6：U7（落回默认删键 + `hash` 共存）**

`?df-context=all#section-2` 进站 → 点重置 → `search` 里没有 `df-context`、`location.hash === '#section-2'`（这一子格钉的是「`sync` 不许把 hash 洗掉」，锚点与档位要能共存，见 spec §1.8）。

- [ ] **Step 7：跑绿**

```bash
node scripts/toolkit-tests.mjs >/dev/null && TU_SITE_DIR=/tmp/sp2-teeth/_site node scripts/verify-tool-url.mjs
```
Expected: `✓ 工具页地址栏验证：全绿（N 条）`（先建一份 `_site` 副本到 `/tmp/sp2-teeth/_site`）。

- [ ] **Step 8：提交**

---

### Task 5：牙齿 `scripts/verify-tool-url-teeth.mjs`

**Files:**
- Create: `scripts/verify-tool-url-teeth.mjs`

- [ ] **Step 1：抄 SP3 那本的骨架**（副本 md5 自证、逐刀 apply→重建→跑门→还原，锚点必须命中恰好 1 次否则退 2）

- [ ] **Step 2：九刀，每格至少一刀**

| 刀 | 破法 | 该红的那格 |
| --- | --- | --- |
| T1 | 进站读那一段整段摘掉（`parse` 的调用点变空） | U1 |
| T2 | 白名单门摘掉（任何值都收） | U2 |
| T3 | 非法值顺手抹掉（`delete` 别人的键） | U2 的后半格 |
| T4 | `replaceState` 换成 `pushState` | U3 |
| T5 | 从空 `search` 起建新串（别人的键丢） | U4 |
| T6 | `retune()` 末尾那句同步摘掉 | U5 |
| T7 | `reset` 那一段的同步摘掉 | U5 的后半格 |
| T8 | 名单里塞进 `query`（输入进地址栏） | U6 |
| T9 | 写 URL 时不带 `location.hash` | U7 |

每刀的 `expect` 必须是门禁红点汇总行里的逐字片段；`cascade` 逐条写明必然连带红的那几格与理由（与 `verify-search-deeplink-teeth.mjs` 同一条口径）。

- [ ] **Step 3：三项自检**（S1 空刀必须退 2 / S2 `TU_SITE_DIR` 指到仓库 `_site` 或不设都必须退 2 / S3 写坏副本必须按 md5 复原）

- [ ] **Step 4：跑齐**：`TU_SITE_DIR=/tmp/sp2-teeth/_site node scripts/verify-tool-url-teeth.mjs` → 12 项全点燃。

- [ ] **Step 5：提交**

---

### Task 6：静态门禁——`check-tools-surface.mjs` 追加组 6 `urlState`

**Files:**
- Modify: `scripts/check-tools-surface.mjs`
- Modify: `scripts/check-tools-surface-teeth.mjs`

- [ ] **Step 1：四条判据**

1. 名单逐键能由「前缀 + 控件」拼出真实 DOM id：`_site/tools/json.html` 与 `diff.html` 里必须存在 `id="{prefix}-in-workbench-{control}"`；前缀取 `_data/onlineTools.yml` 的 `prefix`（不另写一份）。
2. 每枚 select 的 `options` 与骨架里那串 `<option value="…">` **同序同字**，且 `dflt` 那一格：JSON 页 `options[0]` 必须就是骨架第一枚 option，对比页 `DEFAULTS[id]` 必须就是带 `selected` 的那一枚（骨架 `context` 的 `selected` 在 `value="3"` 上）。这一条钉的是「默认档换了而名单没换 → 分享链接静默变档」那条最阴的漂。
3. 负判据：`doc` / `query` / `a-text` / `b-text` / `memorize` 五格出现在名单里就红。
4. 名单之外不许有键：门禁读产物 `assets/js/tool{Json,Diff}.min.js` 里那枚名单数组的字面量长度与表一致（这一条若太脆就退而求其次：断言两本装配层源码里 `URL_KEYS` 的条目数与表一致，口径写进注释）。

- [ ] **Step 2：跑门确认红**（还没改 `GROUPS`）→ **Step 3：把组加进 `GROUPS` 与汇总行** → **Step 4：跑绿**。

- [ ] **Step 5：牙齿补四刀**（名单少一键 / `options` 顺序反了 / 负判据那五格塞一个进去 / 默认档取错那一枚 option），落在 `check-tools-surface-teeth.mjs` 的 `cases` 末尾，group 一律写 `'urlState'`。

- [ ] **Step 6：`--fix` 换镜像 + 提交**

```bash
node scripts/verify-plan-blocks.mjs --fix && node scripts/verify-plan-blocks.mjs
```
Expected: `✓ …（未落地 0 节）`（`check-tools-surface.mjs` 的镜像被换掉，计划文件跟着进这次提交）。

---

### Task 7：A/B 三个数

- [ ] **Step 1：两棵干净树**

head 树 = 纯 `d717c17` 导出树重建（写死提交号，不用 `HEAD~N`）；new 树 = 本工作树内容 rsync 出去重建。两棵树的 `assets/js/toolJson.min.js` 与工作树产物分别对 md5。

- [ ] **Step 2：① 八枚键逐个进站对账**（同一份 `verify-tool-url.mjs` 跑两棵树；head 树全部落默认档、new 树按参数落定），合法 / 非法各一遍，读数从产物骨架现取。

- [ ] **Step 3：② 地址栏卫生**：连改 20 次档位的 `history.length` 增量（0）、最长 URL 实测字节数、`keep` / `utm_source` 两键逐字节存活。

- [ ] **Step 4：③ 首屏代价**（Pages 口径：fast3g + gzip，5 轮/侧取中位数，SW 接管过的轮次不计）：带三枚参数 vs 不带参数的 `load` / DOMContentLoaded / 首次动作耗时。预期 ≈0，量出来证明它不劣化。

- [ ] **Step 5：全量门禁回归**（`toolkit-tests` / `tool-url-state-tests` / `check-seo` / `check-seo-teeth` / `check-image-dims` / `check-tools-surface` + 其牙齿 / `verify-plan-blocks` / `verify-tool-url` + 其牙齿 / `verify-tools-browser`），逐条记退出码，管道不许吞退出码（`cmd > log 2>&1; echo exit=$?`）。负载超阈值时按房规拒测、不算绿也不算是红。

---

### Task 8：交付实录与提交

- [ ] **Step 1：把 §7 交付实录写进 spec**（落地清单逐行号、门禁台账逐道退出码、A/B 三个数、与计划的偏离、量具自己踩的坑、未做与移交）。台账里的每个数都要能照着命令复算；复算不了的就改成「实测形状」而不是硬编数字。

- [ ] **Step 2：`git add` 按 pathspec 逐文件，提交，`git diff --cached --name-only` 复核**。**不 push**。
