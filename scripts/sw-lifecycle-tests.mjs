#!/usr/bin/env node
/**
 * `sw.js` 离线层生命周期的 Node 单测（2026-10-16 那三处修动的行为证据）。
 *
 * 为什么不并进 `scripts/toolkit-tests.mjs`：同 `tool-url-state-tests.mjs` 文件头那条——
 * 那本按 `// ── §([B-Z]\d*) ` 切段，每一段都必须在 `_docs/superpowers/plans/` 里有一枚
 * 逐字节全等的镜像块（`verify-plan-blocks.mjs:276`）。而 `§SW` 这种两字母的节名根本不被
 * 那个标记认，它会被并进上一节 §Z 的尾巴，把 diff 页那份计划里的 §Z 镜像盖成不等。
 *
 * 为什么读**源文件**而不是 `_site/sw.js`：这一本要能在干净检出、没构建过的树里跑。源里那三处
 * Liquid 常量按字面换成合成值，注释块与循环整块摘掉，摘完先过一遍 `new vm.Script` 再进沙箱——
 * 所以它同时钉住「这份源仍是可解析的 JS」这件事本身。
 *
 * 合成 BASE 是 `/base-probe`：这一本任何一条判据只要依赖真实前缀就会立刻红，因为源里没有
 * 那一串。产物侧的前缀对不对归 `scripts/check-sw.mjs` 的判据 1 管，不在这里重复。
 *
 * 真机那一条路（装进 Chrome、断网、看桶）归 `scripts/verify-sw-offline.mjs` 的 S1–S10。
 * 这一本钉的是五件在真机上最难复现、又最难归因的形状：整批预缓存失败时的取舍、activate 删桶的
 * 范围、淘汰时谁被豁免、补全停在中途之后有没有人接着跑、部分失败那一版发上去旧桶留不留。
 * 每条都配正反两头：正向测实现，反向（SW11–SW14、SW16、SW22–SW24）把那一处改回修之前的写法，
 * 测的是判据自己有没有牙。后两件是 2026-10-17 存量评审补的（SW17–SW24）。
 *
 * `SW15/SW16` 那两条反过来站在**源侧**：沙箱为了跑得起来把 Liquid 循环整块摘掉，于是
 * 「index-all 那一行排在正文循环之前还是之后」在沙箱看来毫无区别，只有源文本判得了。
 * 而这一挪在线上的后果是豁免名单吞下整份正文清单、条数闸从此删不掉任何东西。
 *
 * 用法：`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/sw-lifecycle-tests.mjs`
 * 判断成败看退出码，别用 `| tail` 之后的 $?（管道会吞退出码）。
 * 本机 `/usr/local/bin/node` 是 v16 残留，看到 `bad option: --disable-warning` 或 `exit=9`
 * 是环境错——先 `node -v` 确认 v22。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW_REL = 'sw.js';

/** 沙箱里当作 sw.js 自己的地址：`self.location` 在 ServiceWorkerGlobalScope 里就是这一本脚本。 */
const SW_URL = 'https://sw-probe.test/base-probe/sw.js';
const ORIGIN = 'https://sw-probe.test';

/**
 * 源里的三处 Liquid 常量 → 合成值。顺序在前、摘除在后，因为这两串带引号的字面量只有
 * 赋值那三行长得一样；每条必须**恰好命中一次**，命不中就是这一版锚点过期。
 */
const SW_CONSTS = [
  ["'{{ site.version }}'", "'v-probe'"],
  ['\'{{ site.time | date: "%Y%m%d%H%M" }}\'', "'build-probe'"],
  ["'{{ site.baseurl }}'", "'/base-probe'"],
];

/** 沙箱里要能跑起来的顶层名字。少一个就是脚本加载期 ReferenceError，不会静默。 */
const SW_EXPORTS = [
  'BASE', 'BUILD', 'BUCKET', 'OFFLINE_URL', 'SHELL_URLS', 'DEFERRED_URLS', 'DOC_URLS',
  'ENTRY_CUT', 'PIN_URLS', 'COVER_URLS', 'LIMIT', 'isPassthrough', 'canonicalOf',
  'bucketFor', 'trim', 'storeInto', 'mayFill', 'fillIdle', 'fill',
];

/**
 * 替换并自证命中数。`String.replace` 匹配不到时静默返回原串，那种「什么都没换」的探针
 * 测的是模板本身，不再是判据——所以这里按 split 数命中，不等于 1 就直接抛。
 */
function swapOnce(text, from, to, label) {
  const hits = text.split(from).length - 1;
  if (hits !== 1) {
    throw new Error(`${label}：在 ${SW_REL} 源里命中 ${hits} 处，只接受 1 处——锚点已经不对，这一格作废而不是凑合跑`);
  }
  return text.replace(from, to);
}

/**
 * 把 Liquid 摘干净：注释块 → for/endfor 整块 → 剩下的单标记 → 顶部的空 front matter。
 * 末尾自证「代码里一处标记都不剩」，自证之前先摘 JS 块注释——文档里本来就可能写 `{{ … }}`。
 */
function stripLiquid(text) {
  let s = text.replace(/^---\n[\s\S]*?^---\n/m, '');
  s = s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  s = s.replace(/\{%-?\s*for\b[\s\S]*?\{%-?\s*endfor\s*-?%\}/g, '');
  s = s.replace(/\{%-?[^%]*?%\}/g, '');
  const code = s.replace(/\/\*[\s\S]*?\*\//g, '');
  const left = code.match(/\{\{|\{%/g) || [];
  if (left.length) throw new Error(`Liquid 没摘干净：代码里还剩 ${left.length} 处标记`);
  if (/\{%-?\s*(?:end)?(?:for|if|unless)\b/.test(s)) throw new Error('成对的块标记只摘掉了一半');
  return s;
}

/** 一个 `Response` 替身：`trim` 的字节账读 `blob().size`，补全读 `headers.get('content-length')`。 */
function swRes(bytes, ok = true) {
  return {
    ok,
    status: ok ? 200 : 503,
    type: 'basic',
    headers: { get: (h) => (String(h).toLowerCase() === 'content-length' ? String(bytes) : null) },
    blob: async () => ({ size: bytes }),
    clone() { return this; },
    body: null,
  };
}

/** 一个 `Cache` 替身：按写入序存（与 Chrome 实测一致），键一律收成绝对地址，与浏览器同尺。 */
function swCache(name, abs) {
  const store = new Map();
  return {
    name,
    store,
    async put(req, res) { store.set(abs(typeof req === 'string' ? req : req.url), res); },
    async match(req) { return store.get(abs(typeof req === 'string' ? req : req.url)); },
    async keys() { return [...store.keys()].map((url) => ({ url })); },
    async delete(req) { return store.delete(abs(typeof req === 'string' ? req : req.url)); },
    async add(req) {
      const res = await req.__fetch(req.url, { cache: req.cache });
      if (!res || !res.ok) throw new Error(`Cache.add 拿到非 ok 响应：${req.url}`);
      store.set(abs(req.url), res);
    },
  };
}

/**
 * 装一份沙箱：`self` 就是全局对象（SW 作用域的形状），`caches`/`fetch`/`Request` 全是假件。
 * @param {object} opts 可选：`edits` 源侧文本改动、`fetch` 回源行为、`connection` 网络类型
 * @returns {object} 沙箱与读得到的账
 */
function loadSw(opts = {}) {
  let src = fs.readFileSync(path.join(ROOT, SW_REL), 'utf8');
  for (const [from, to] of SW_CONSTS) src = swapOnce(src, from, to, `常量「${from}」`);
  for (const [from, to] of opts.edits || []) src = swapOnce(src, from, to, `改动「${from.slice(0, 28)}」`);
  const js = stripLiquid(src);
  new vm.Script(js, { filename: `${SW_REL}#probe` }); // 只验可解析，报错原样上抛

  const abs = (u) => new URL(u, SW_URL).href;
  const seen = { fetch: [], deleted: [], idle: [], timeout: [], skipWaiting: 0, claim: 0 };
  const buckets = new Map();
  const handlers = Object.create(null);
  const fetchImpl = opts.fetch || (async () => swRes(16));

  const fetchStub = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    seen.fetch.push({ url, init });
    return fetchImpl(url, seen.fetch.length - 1, init);
  };
  const cachesStub = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, swCache(name, abs));
      return buckets.get(name);
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { seen.deleted.push(name); return buckets.delete(name); },
    async has(name) { return buckets.has(name); },
    // 全局查找：`networkFirst` 离线回落那一格用的就是它（兜底页住在骨架桶，跨桶找）。
    // 沙箱缺这个方法时那条路径不是"回落到 503"而是当场 TypeError，测出来的是假件缺件。
    async match() { return undefined; },
  };
  class FakeRequest {
    constructor(url, init = {}) {
      this.url = String(url);
      this.cache = init.cache;
      this.destination = init.destination;
      this.__fetch = fetchStub;
    }
  }

  const sandbox = {
    caches: cachesStub,
    fetch: fetchStub,
    Request: FakeRequest,
    Response: class { constructor(body, init = {}) { Object.assign(this, init); } },
    URL,
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (cb, ms) => { seen.timeout.push(ms); return seen.timeout.length; },
    addEventListener: (type, fn) => { (handlers[type] || (handlers[type] = [])).push(fn); },
    skipWaiting: async () => { seen.skipWaiting += 1; },
    clients: { claim: async () => { seen.claim += 1; } },
    requestIdleCallback: (cb) => { seen.idle.push(cb); return seen.idle.length; },
    location: { href: SW_URL, origin: ORIGIN, pathname: '/base-probe/sw.js' },
    navigator: { connection: opts.connection === undefined ? null : opts.connection },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  const epilogue = `;(()=>{const o={};${SW_EXPORTS.map((k) => `o.${k}=${k};`).join('')}globalThis.__sw=o;})();`;
  new vm.Script(js + epilogue, { filename: `${SW_REL}#run` }).runInContext(sandbox);

  const env = { abs, seen, buckets, handlers, self: sandbox, caches: cachesStub, g: sandbox.__sw };
  return env;
}

/** 一次事件派发的账：`waitUntil` 收下的 promise 全部等到底，成败由调用方按 status 判。 */
function swEvent() {
  const jobs = [];
  return { jobs, waitUntil: (p) => jobs.push(p), respondWith: (p) => jobs.push(p) };
}

/** 触发某类事件并等它排进来的活跑完。 */
async function fire(env, type) {
  const ev = swEvent();
  for (const fn of env.handlers[type] || []) fn(ev);
  const settled = await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  return { ev, settled };
}

/** 桶里现在的地址（绝对形），按写入序。 */
async function urlsIn(cache) {
  return (await cache.keys()).map((r) => r.url);
}

/**
 * 沙箱里造出来的数组带着它自己那个 realm 的 `Array.prototype`，`assert/strict` 会比原型，
 * 于是"结构全等却报不相等"（2026-10-16 第一次跑就是这四格这么红的）。要比清单的场合一律
 * 先在宿主侧摊平一次——数组是新的，元素是原始值。
 */
const host = (list) => [...list];

/** 正文那一批的假地址：不属于入口段，专门用来当被淘汰的那一类。 */
const filler = (i) => `/base-probe/2026/1016/post-${i}.html`;

/**
 * SW7 与它的反向对照共用那一屋子桶名。三组各一枚以上才判得出"删的是哪一族"：
 * 只放旧同族桶的话，"把整个 origin 都删了"和"删对了"在读数上一模一样。
 */
async function seedBuckets(env) {
  const B = env.g.BASE;
  const stale = [`${B}-shell-202510101200`, `${B}-doc-202510101200`, `${B}-img-202510101200`];
  const foreign = ['other-app-shell-v1', `x${B}-doc-202510101200`, `${B}-page-cache`, `shell-${B}`];
  const live = Object.values(env.g.BUCKET);
  for (const n of [...stale, ...foreign, ...live]) await env.caches.open(n);
  return { stale, foreign, live };
}

/**
 * SW8 一族用例共用的那一只文档桶：入口段在前、正文在后，与 fillIdle 的写入序同形
 * （正文里那条 `PIN_URLS` 恰好在最前面，不豁免就会被自己挤出去——见 sw.js 里那段注释）。
 */
async function seedDoc(env, nFill, pinBytes = 10, fillBytes = pinBytes) {
  const cache = await env.caches.open(env.g.BUCKET.doc);
  for (const p of env.g.PIN_URLS) await cache.put(p, swRes(pinBytes));
  for (let i = 1; i <= nFill; i += 1) await cache.put(filler(i), swRes(fillBytes));
  return cache;
}

// ── 探针自证 ────────────────────────────────────────────────────────────────

test('SW1 摘掉 Liquid 之后的这份源仍可解析，且清单里每一件都只带合成前缀', () => {
  const raw = fs.readFileSync(path.join(ROOT, SW_REL), 'utf8');
  const open = (raw.match(/\{%-?\s*comment\s*-?%\}/g) || []).length;
  const close = (raw.match(/\{%-?\s*endcomment\s*-?%\}/g) || []).length;
  assert.equal(open, close, '注释块开合不等，摘除正则会把半截注释当代码');
  assert.ok(open > 0, '前提：这份源里确实有注释块，否则上面那条对账是空集');
  const { g } = loadSw();
  assert.ok(g.SHELL_URLS.length > 1, `骨架清单只剩 ${g.SHELL_URLS.length} 件，这一本判的会是空集`);
  assert.ok(g.SHELL_URLS.every((u) => u.startsWith(g.BASE)), '骨架清单里有不带 baseurl 的地址');
  assert.ok(g.DOC_URLS.every((u) => u.startsWith(g.BASE)), '文档清单里有不带 baseurl 的地址');
  assert.equal(g.BASE, '/base-probe', '合成前缀没换上去——这一本测的会是模板字符串本身');
});

// ── 入口段（PIN_URLS）──────────────────────────────────────────────────────

test('SW2 入口段的钉子落在 index-all 那格为止：首页与入口页钉住，正文一格都不钉', () => {
  const { g } = loadSw({
    edits: [[
      "  BASE + '/index-all.html',",
      "  BASE + '/tools.html',\n  BASE + '/index-all.html',\n  BASE + '/2016/0926/a.html',\n  BASE + '/2016/0926/b.html',",
    ]],
  });
  assert.equal(g.ENTRY_CUT, 2, 'index-all 不在清单第 3 位——补全顺序变了，钉的这一段也跟着变了，要人来看一眼');
  assert.deepEqual(host(g.PIN_URLS), [g.BASE + '/', g.BASE + '/tools.html', g.BASE + '/index-all.html']);
  // 入口段之外必须真的还有条目，否则「不钉正文」那一半判的是空集。写成派生而不是硬填条数：
  // 2026-10 起真源里 index-all 之后还有 changelog 一格，任何按字面条数写的前提都会跟着清单加一格就红。
  assert.ok(g.DOC_URLS.length > g.PIN_URLS.length, '前提：清单里入口段之外还有条目，否则「不钉入口段之外」那一半判的是空集');
  assert.ok(g.DOC_URLS.slice(g.ENTRY_CUT + 1).every((u) => !g.PIN_URLS.includes(u)),
    '正文混进了豁免名单：桶满时最先被挤掉的恰是它们该留的位置');
});

test('SW3 清单里读不到 index-all 时退回「只钉首页」，而不是一个都不钉', () => {
  const { g } = loadSw({ edits: [["  BASE + '/index-all.html',\n", '']] });
  assert.equal(g.ENTRY_CUT, -1);
  assert.deepEqual(host(g.PIN_URLS), [g.BASE + '/'],
    '回落写成空集等于把豁免整族关掉——淘汰照旧发生，只是谁都没保住');
});

// ── install ────────────────────────────────────────────────────────────────

test('SW4 骨架整批拉不到 ⇒ install 拒绝接管，skipWaiting 一次都不许调', async () => {
  const env = loadSw({ fetch: () => Promise.reject(new Error('network down')) });
  assert.ok(env.g.SHELL_URLS.length >= 10, `前提不成立：清单只有 ${env.g.SHELL_URLS.length} 件，全失败的形状量不出来`);
  const { settled } = await fire(env, 'install');
  assert.equal(settled.length, 1, 'install 应当只排一条 waitUntil');
  assert.equal(settled[0].status, 'rejected', '整批全失败却放行了——旧版就是这个形状');
  assert.match(String(settled[0].reason && settled[0].reason.message), /全部失败/);
  assert.equal(env.seen.skipWaiting, 0,
    'skipWaiting 一旦调出去，activate 会删掉上一版那三个桶：一次源站抖动就把读者攒下的离线层清零');
  assert.equal(env.self.__bbFailed, undefined, '整批失败不是「少装几件」，不该留部分失败的账');
});

test('SW5 骨架部分失败 ⇒ 照旧放行，失败条数落进 __bbFailed', async () => {
  const env = loadSw({ fetch: (url, i) => (i === 0 ? Promise.reject(new Error('404')) : Promise.resolve(swRes(16))) });
  const { settled } = await fire(env, 'install');
  assert.equal(settled[0].status, 'fulfilled', '单条装不上不该否掉整次接管');
  assert.equal(env.seen.skipWaiting, 1);
  assert.equal(env.self.__bbFailed, 1, '__bbFailed 没记账：BB_PONG 那条读数会把它报成 0');
});

test('SW6 骨架全成功 ⇒ 逐条按清单回源且带 cache: reload，接管照常', async () => {
  const env = loadSw();
  const { settled } = await fire(env, 'install');
  assert.equal(settled[0].status, 'fulfilled');
  assert.equal(env.seen.skipWaiting, 1);
  assert.deepEqual(env.seen.fetch.map((f) => f.url), host(env.g.SHELL_URLS), '拉的这批不等于清单');
  assert.ok(env.seen.fetch.every((f) => f.init && f.init.cache === 'reload'),
    '少了 cache: reload，发版后骨架拿的是上一版');
  const inBucket = await urlsIn(env.buckets.get(env.g.BUCKET.shell));
  assert.deepEqual(inBucket, host(env.g.SHELL_URLS).map(env.abs));
});

// ── activate ───────────────────────────────────────────────────────────────

test('SW7 activate 只清自己那一族的桶：同域下别的应用自建的桶一条不动', async () => {
  const env = loadSw();
  const { stale, foreign, live } = await seedBuckets(env);
  const { settled } = await fire(env, 'activate');
  assert.equal(settled[0].status, 'fulfilled', String(settled[0].reason && settled[0].reason.message));
  assert.deepEqual(env.seen.deleted.slice().sort(), stale.slice().sort(), '删的不是「旧的同族桶」那一族');
  const left = (await env.caches.keys()).filter((k) => !live.includes(k)).sort();
  assert.deepEqual(left, foreign.slice().sort(),
    'caches.keys() 给的是整个 origin 的桶：只按「不在 live 里」删，会连带清空共存应用的桶');
  assert.equal(env.seen.claim, 1);
  assert.equal(env.seen.idle.length, 1, 'activate 之后要把补全排一次队');
  assert.equal(env.seen.fetch.length, 0, '排进去的那一批在探针里不许真的跑出去');
});

// ── trim ───────────────────────────────────────────────────────────────────

test('SW8 条数闸挤的是正文：入口段那几格一条不许被挤出去', async () => {
  const env = loadSw();
  const name = env.g.BUCKET.doc;
  const cache = await seedDoc(env, 6);
  await env.g.trim(name, { entries: 5, bytes: Number.MAX_SAFE_INTEGER });
  const left = await urlsIn(cache);
  assert.equal(left.length, 5, `桶该收到上限 5，实际 ${left.length} 条`);
  for (const p of env.g.PIN_URLS) {
    assert.ok(left.includes(env.abs(p)), `${p} 被挤掉了：断网点开首页得到的是 503，不是缓存那一份`);
  }
  assert.deepEqual(left, [...host(env.g.PIN_URLS).map(env.abs), env.abs(filler(4)), env.abs(filler(5)),
    env.abs(filler(6))]);
});

test('SW9 字节闸同一把尺：从头部删起时先跳过入口段，到线就停', async () => {
  const env = loadSw();
  const name = env.g.BUCKET.doc;
  const pinBytes = 100;
  const fillBytes = 400;
  const cache = await seedDoc(env, 5, pinBytes, fillBytes);
  const nPin = env.g.PIN_URLS.length;
  assert.equal(nPin * pinBytes + 5 * fillBytes, 2200,
    `前提：这一轮的账面总量按 ${nPin} 枚入口页算要等于 2200B，不等就是入口段的条数变了`);
  await env.g.trim(name, { entries: 100, bytes: 1000 });
  const left = await urlsIn(cache);
  for (const p of env.g.PIN_URLS) {
    assert.ok(left.includes(env.abs(p)), `${p} 被字节账挤掉了：入口段一共 ${nPin * pinBytes}B，远没到 1000B 的上限`);
  }
  assert.deepEqual(left, [...env.g.PIN_URLS.map(env.abs), env.abs(filler(4)), env.abs(filler(5))],
    '挤到 1000B 就该停手（2×100B 入口 + 2×400B 正文 = 恰好 1000B），多删一条是把闸当成了清仓');
});

test('SW10 骨架桶不进淘汰，文档桶进：同一个 storeInto 走两条路', async () => {
  const env = loadSw();
  const shellName = env.g.BUCKET.shell;
  const shell = await env.caches.open(shellName);
  const many = [];
  for (let i = 0; i < 200; i += 1) many.push(`${env.g.BASE}/assets/x${i}.js`);
  for (const u of many) await shell.put(u, swRes(8));
  const evShell = swEvent();
  env.g.storeInto(shell, env.g.OFFLINE_URL, swRes(8), shellName, null, evShell);
  await Promise.allSettled(evShell.jobs.map((p) => Promise.resolve(p)));
  const nShell = (await shell.keys()).length;
  assert.equal(nShell, 201, `兜底页住在这个桶里，按条数从头部删起第一个撞上的就是它（实测剩 ${nShell} 条）`);
  assert.equal(env.self.__bbPutErr, undefined, '骨架桶这一路不该留下任何写入失败的账');

  const docName = env.g.BUCKET.doc;
  const doc = await seedDoc(env, 6, 8, 8);
  const evDoc = swEvent();
  env.g.storeInto(doc, filler(7), swRes(8), docName, { entries: 5, bytes: Number.MAX_SAFE_INTEGER }, evDoc);
  await Promise.allSettled(evDoc.jobs.map((p) => Promise.resolve(p)));
  const leftDoc = await urlsIn(doc);
  assert.equal(leftDoc.length, 5, 'cap 给的是真上限，这一路必须淘汰');
  for (const p of env.g.PIN_URLS) assert.ok(leftDoc.includes(env.abs(p)), '文档桶的淘汰要绕开入口段');
});

// ── 反向对照：把这一版修动逐一摘回旧形状，上面那几条要红在各自那一格上 ──────────

/**
 * 这四格不重复测实现，测的是**判据有没有牙**：每格把 sw.js 里对应那一处改回修之前的写法
 * （只改内存里的那份文本，磁盘一个字不动），再断言旧形状确实复现。
 * 锚点走 `swapOnce`，命中数不等于 1 就直接抛——那一行哪天漂了，这一格喊出来，
 * 不会安静地"摘掉一个已经不存在的东西"然后报绿。
 */

test('SW11 反向对照：摘掉「整批全失败就否掉接管」那一句，install 又变成无条件放行', async () => {
  const env = loadSw({
    fetch: () => Promise.reject(new Error('network down')),
    edits: [[
      '        throw new Error(`骨架预缓存 ${failed.length} 条全部失败，放弃这次接管以保住旧离线层`);',
      '        self.__bbNoThrow = failed.length;',
    ]],
  });
  const { settled } = await fire(env, 'install');
  assert.equal(settled[0].status, 'fulfilled', '旧形状这里就是放行：这一格绿才说明 SW4 那条拒绝不是空话');
  assert.equal(env.seen.skipWaiting, 1, '放行之后 skipWaiting 直接把接管交出去，activate 紧跟着删旧桶');
});

test('SW12 反向对照：activate 只按「不在 live 里」删桶，同域共存应用的桶被连带清空', async () => {
  const env = loadSw({
    edits: [[
      '(await caches.keys()).filter((k) => live.indexOf(k) === -1 && isOwn(k))',
      '(await caches.keys()).filter((k) => live.indexOf(k) === -1)',
    ]],
  });
  const { stale, foreign } = await seedBuckets(env);
  const { settled } = await fire(env, 'activate');
  assert.equal(settled[0].status, 'fulfilled');
  assert.equal(env.seen.deleted.length, stale.length + foreign.length,
    `旧形状把 ${(await env.caches.keys()).length} 枚桶删到只剩本次那几枚：共存那 ${foreign.length} 枚也一起没了`);
});

test('SW13 反向对照：没有那一道豁免，桶满时最先被挤出去的正是首页与入口页', async () => {
  const env = loadSw({
    edits: [[
      '  const pin = name === BUCKET.doc\n'
      + '    ? new Set(PIN_URLS.map((u) => canonicalOf(new URL(u, self.location.href).href)))\n'
      + '    : null;\n'
      + '  const keep = (req) => (pin ? pin.has(canonicalOf(req.url)) : false);',
      '  const keep = () => false;',
    ]],
  });
  const cache = await seedDoc(env, 6);
  await env.g.trim(env.g.BUCKET.doc, { entries: 5, bytes: Number.MAX_SAFE_INTEGER });
  const left = await urlsIn(cache);
  assert.equal(left.length, 5, '条数闸照样在跑——旧形状不是没淘汰，是淘汰错了对象');
  assert.ok(!left.includes(env.abs(env.g.PIN_URLS[0])), '旧形状下首页正是这样被挤出去的：SW8 那条豁免判的就是这一格');
  assert.deepEqual(left, [2, 3, 4, 5, 6].map((i) => env.abs(filler(i))),
    '从头部删起：先没的是两枚入口页，接着才是正文第一条');
});

test('SW14 反向对照：豁免名单拿相对路径去比绝对 Request.url，整个文档桶的淘汰静默停摆', async () => {
  const env = loadSw({ edits: [['canonicalOf(new URL(u, self.location.href).href)', 'canonicalOf(u)']] });
  const name = env.g.BUCKET.doc;
  const cache = await seedDoc(env, 6);
  const err = await env.g.trim(name, { entries: 5, bytes: Number.MAX_SAFE_INTEGER }).then(() => null, (e) => e);
  assert.ok(err, '旧形状这一路应当直接抛；不抛就是这一格在判空集');
  assert.equal(err.name, 'TypeError', `抛的应当是 new URL 的 TypeError，实际 ${err.name}: ${err.message}`);
  assert.equal((await urlsIn(cache)).length, 8, '一条都没减：淘汰整族停摆，比挤错对象更糟');

  const ev = swEvent();
  env.g.storeInto(cache, filler(7), swRes(10), name, { entries: 5, bytes: Number.MAX_SAFE_INTEGER }, ev);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.self.__bbPutErr, 1, '这条抛错只落在 __bbPutErr 上，页面上一处痕迹都没有——正是它静默的原因');
  assert.equal((await urlsIn(cache)).length, 9, '写进去了却没淘汰：桶从此只会一直涨');
});

// ── 豁免段的边界（源侧不变量） ────────────────────────────────────────────────

/**
 * 量「豁免段的边界」这一条不变量，返回毛病清单（空数组 = 没问题）。
 *
 * 为什么单独立一条：沙箱里 `stripLiquid` 会把 Liquid 的 for 循环整块摘掉，于是源里
 * 「index-all 排在正文循环之前还是之后」这件事在沙箱看来**完全一样**——SW2 的合成清单
 * 照样是入口段在前、正文在后，14 条全绿。可线上不是沙箱：那一行若被挪到 `site.posts`
 * 循环之后，`ENTRY_CUT` 就成了清单最后一格，`PIN_URLS` 吞下全部 114 条正文，
 * 文档桶的条数闸从此一条都删不掉（字节闸也只剩它一道），而这一本其余沙箱判据没有一条会红。
 *
 * 2026-10-16 在产物上量过的真读数：`ENTRY_CUT=12`、`PIN_URLS` 13 枚
 * （首页 + 7 枚导航 + 4 枚 ready 工具 + 全站索引），钉外第一条是当期最新那篇正文。
 */
function entrySegmentProblems(src) {
  const problems = [];
  const arrStart = src.indexOf('const DOC_URLS = [');
  if (arrStart === -1) return ['源里找不到 const DOC_URLS = [ ——清单换了写法，这一条判据要跟着重写'];
  const arrEnd = src.indexOf('\n];', arrStart);
  const arr = src.slice(arrStart, arrEnd);

  // 注释不参与认定边界：`sw.js` 里数组中间是可以写说明的（changelog 那一格就带了一段），
  // 而这段说明合法地提到 index-all。按整行数「带 index-all 的行」会把注释算成一条发出，
  // 于是「恰好 1 条」判红——红的不是清单漂了，是这条判据把注释当成了代码。
  // 这里先把 Liquid 注释块与 JS 行注释摘掉，再数真正的数组元素行。
  const codeOnly = arr
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

  const emitLines = codeOnly.split('\n').filter((l) => l.includes('index-all'));
  if (emitLines.length !== 1) {
    return [`DOC_URLS 里带 index-all 的**元素行**有 ${emitLines.length} 条，应当恰好 1 条——边界无从认定`];
  }
  const emitted = emitLines[0].trim().replace(/,$/, '');

  const lookup = src.match(/const ENTRY_CUT = DOC_URLS\.indexOf\((.+?)\);/);
  if (!lookup) {
    problems.push('ENTRY_CUT 那一行不见了，或它的写法已不是 DOC_URLS.indexOf(...)');
  } else if (lookup[1] !== emitted) {
    // 两边必须逐字符相同：清单发出的是 `BASE + '/index-all.html'` 这个**表达式**，
    // 查找键少写一个 `BASE +` 就退化成拿相对路径去比，indexOf 恒 -1、钉子塌回一枚。
    problems.push(`两边不是同一把尺：清单发出「${emitted}」，ENTRY_CUT 找的是「${lookup[1]}」`);
  }

  const postsLoop = codeOnly.indexOf('for post in site.posts');
  if (postsLoop === -1) {
    problems.push('DOC_URLS 里找不到 site.posts 那个循环——清单形状变了，这一条判据要重写');
  } else if (codeOnly.indexOf('index-all') > postsLoop) {
    problems.push('index-all 排在 site.posts 循环之后：豁免段会吞掉整份正文清单，条数闸等于停摆');
  }
  return problems;
}

/**
 * 摘掉 Liquid 之后 DOC_URLS 数组里还看得见的行（去首尾空白、去空行）。
 * 沙箱能看见的只有这些：三段 for 循环整块消失，于是「index-all 在循环前还是循环后」
 * 这个区别在沙箱里根本不存在——这正是 SW15/SW16 必须站在源侧的原因。
 */
function docUrlsAfterStrip(text) {
  let s = text;
  for (const [from, to] of SW_CONSTS) s = swapOnce(s, from, to, `常量「${from}」`);
  const stripped = stripLiquid(s);
  const a = stripped.indexOf('const DOC_URLS = [');
  const body = stripped.slice(a, stripped.indexOf('\n];', a));
  return body.split('\n').map((l) => l.trim()).filter(Boolean);
}

test('SW15 源侧不变量：index-all 那一行与 ENTRY_CUT 的查找键同一把尺，且排在正文循环之前', () => {
  const src = fs.readFileSync(path.join(ROOT, SW_REL), 'utf8');
  assert.deepEqual(entrySegmentProblems(src), [],
    '豁免段的边界漂了：这不会让上面任何一条沙箱判据变红，却会让线上钉住的入口页数悄悄改变');
});

test('SW16 反向对照：把 index-all 挪到正文循环之后，沙箱看不出而不变量报红', () => {
  const src = fs.readFileSync(path.join(ROOT, SW_REL), 'utf8');
  const line = "  BASE + '/index-all.html',\n";
  assert.equal(src.split(line).length - 1, 1, '锚点行应当恰好一处，否则这一格的变异没注进去');
  const arrStart = src.indexOf('const DOC_URLS = [');
  const arrEnd = src.indexOf('\n];', arrStart);
  const arr = src.slice(arrStart, arrEnd);
  // 挪法就是"有人把这一行剪到数组末尾"：落在正文循环的 endfor 之后、`];` 之前。
  const moved = src.slice(0, arrStart) + arr.replace(line, '') + '\n' + line.slice(0, -1) + src.slice(arrEnd);
  assert.notEqual(moved, src, '变异没改动任何字节，等于没注入');

  const problems = entrySegmentProblems(moved);
  assert.equal(problems.length, 1, `应当恰好报一条，实际：${problems.join(' / ')}`);
  assert.match(problems[0], /排在 site\.posts 循环之后/);

  const seen = docUrlsAfterStrip(src);
  assert.ok(seen.includes("BASE + '/index-all.html',"),
    `正向对照：摘完 Liquid 应当还看得见那一行，实际读到 ${JSON.stringify(seen)}`);
  // 2026-10 起 index-all 不再是可见清单的最后一格（changelog 排在它后面），
  // 「行序一模一样」这个前提已不成立：这一挪会改可见顺序。这条反向对照要证的从来不是顺序，
  // 而是沙箱看不出**钉住语义**的变化：摘掉循环后两种写法是同一批元素换序，
  // 而运行时那份真清单里把 index-all 挪到循环之后＝把整份正文都钉住，沙箱永远碰不到那个规模。
  assert.deepEqual([...docUrlsAfterStrip(moved)].sort(), [...seen].sort(),
    '沙箱能看见的应当只是同一批元素换了序——若连集合都变了，上面那条不变量就不是唯一看得见这一挪的地方');
});

// ── 补全续跑与部分失败留桶（2026-10-17 存量评审补的六刀）──────────────────────

/**
 * 给补全那几条用例撑清单：源里三段 Liquid 循环被 `stripLiquid` 摘平，于是 `DOC_URLS` 只剩
 * 首页与 index-all 两格、`COVER_URLS` 干脆是空集——"跑完一趟""接着上一趟跑""封面预算"
 * 在沙箱里全都判不出形状（队列不到 4 条，`fillBatch` 那一档根本没被跨过）。
 * 这里只改内存里那份文本，磁盘一个字不动：文档撑到 8 条、封面给 2 张，顺序与线上同形
 * （文档在前、封面在后），队列合计 10 条 = 两批半。
 */
const FILL_EDITS = [
  [
    "  BASE + '/index-all.html',",
    "  BASE + '/index-all.html',\n"
    + "  BASE + '/2026/1016/p1.html',\n  BASE + '/2026/1016/p2.html',\n"
    + "  BASE + '/2026/1016/p3.html',\n  BASE + '/2026/1016/p4.html',\n"
    + "  BASE + '/2026/1016/p5.html',\n  BASE + '/2026/1016/p6.html',",
  ],
  [
    'const COVER_URLS = Array.from(new Set(COVER_RAW));',
    "const COVER_URLS = [BASE + '/assets/img/c1.png', BASE + '/assets/img/c2.png'];",
  ],
];

/** 导航请求的替身：`fetch` 事件那一格只读 method / mode / destination / url 四件。 */
function swNavigate(env, url) {
  const ev = swEvent();
  const req = { method: 'GET', mode: 'navigate', destination: 'document', url };
  for (const fn of env.handlers.fetch || []) fn({ request: req, respondWith: ev.respondWith, waitUntil: ev.waitUntil });
  return ev;
}

/** 把 idle 队列排着走完（每批自己排下一批，跑完或停下就不排了）；返回跑了多少批。 */
async function drainIdle(env, limit = 40) {
  let batches = 0;
  while (env.seen.idle.length && batches < limit) {
    const cb = env.seen.idle.shift();
    await cb();
    batches += 1;
  }
  return batches;
}

/** 导航用的地址：故意取清单外的一页，免得 `networkFirst` 那一发回源混进补全的账里。 */
const NAV_URL = 'https://sw-probe.test/base-probe/offline-check.html';

test('SW17 补全正排着的时候再叫一次不另起一串；省流量模式依旧一格都不排', async () => {
  const env = loadSw({ edits: FILL_EDITS });
  env.g.fillIdle();
  assert.equal(env.seen.idle.length, 1, '第一次调用应当排进去一批');
  assert.equal(env.g.fill.running, true, 'running 没立起来：后面那两道互斥判的是空集');
  env.g.fillIdle();
  env.g.fillIdle();
  assert.equal(env.seen.idle.length, 1, '另起了串：两趟并发写同一批桶，封面预算那本账也串了味');
  assert.equal(env.self.__bbFillPasses, 1, '被挡回来的那两次不该把趟数刷上去——那一格是"续跑过没有"的读数');

  const saver = loadSw({ edits: FILL_EDITS, connection: { saveData: true, effectiveType: '4g' } });
  saver.g.fillIdle();
  assert.equal(saver.seen.idle.length, 0, 'saveData 那一档一个都不许排（可重入不该把这条例外改掉）');
});

test('SW18 停在中途的补全被一次导航接上：游标接着走，桶里已有的那条一度也不重下', async () => {
  const env = loadSw({ edits: FILL_EDITS });
  const docs = host(env.g.DOC_URLS);
  assert.ok(docs.length >= 8, `前提：合成清单至少撑到 8 条文档，实际 ${docs.length} 条`);
  const doc = await env.caches.open(env.g.BUCKET.doc);
  for (const u of docs.slice(0, 4)) await doc.put(u, swRes(16));
  const img = await env.caches.open(env.g.BUCKET.img);
  await img.put(env.g.COVER_URLS[0], swRes(1234));

  env.g.fill.cursor = 4;                     // 上一趟装完第 1 批就随 SW 一起没了
  const ev = swNavigate(env, NAV_URL);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.seen.idle.length, 1, '导航没把补全重新排队：那半截离线层会永远停在这半截上');

  await env.seen.idle.shift()();             // start：先从桶里重算封面账，再走 step
  assert.equal(env.self.__bbCoverBytes, 1234,
    '续跑没从桶里重算封面账：内存那格是 0，等于每被终止一次就多发一份 2.5MB 的配额');
  const filled = env.seen.fetch.filter((f) => f.url !== NAV_URL).map((f) => f.url);
  assert.ok(filled.every((u) => !docs.slice(0, 4).includes(u)),
    `已入桶的那 4 条被重下了一遍：${JSON.stringify(filled)}`);
  assert.deepEqual(filled.slice(0, 4), docs.slice(4, 8), '续跑该从游标那一格接着往下走');
});

test('SW19 整批失败那一停不是终点：放开 running，下一次导航照样接得上', async () => {
  const env = loadSw({ edits: FILL_EDITS, fetch: () => Promise.reject(new Error('offline')) });
  env.g.fillIdle();
  await drainIdle(env);
  assert.match(String(env.self.__bbFillStop), /整批失败/, '整批失败没留下停下的原因');
  assert.equal(env.self.__bbFillDone, undefined, '离线停半路不等于跑完：done 一旦被立起来，核验就再也不会重试');
  assert.equal(env.g.fill.running, false, '停下没放开互斥：后面任何一次导航都再也排不进去');
  assert.equal(env.g.fill.cursor, 4, `第 1 批走完该停在 4，实际 ${env.g.fill.cursor}`);

  const ev = swNavigate(env, NAV_URL);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.seen.idle.length, 1, '停过之后导航不接盘：隧道出来再点开一页，补全还是那半截');
  await env.seen.idle.shift()();
  assert.equal(env.self.__bbFillPasses, 2, '续跑那一趟没记进趟数');
});

test('SW20 队列跑到底才算 done：跑完之后导航一个请求都不再补排', async () => {
  const env = loadSw({ edits: FILL_EDITS });
  env.g.fillIdle();
  const batches = await drainIdle(env);
  assert.equal(env.self.__bbFillDone, true, `队列走不到底（跑了 ${batches} 批）：done 这一格是核验唯一的落定信号`);
  assert.equal(env.g.fill.cursor, env.g.DOC_URLS.length + env.g.COVER_URLS.length, '游标没走到清单末尾');
  assert.equal(env.g.fill.running, false);
  assert.equal(env.self.__bbFilled, env.g.DOC_URLS.length + env.g.COVER_URLS.length, `入桶条数应为清单全长 ${env.g.DOC_URLS.length + env.g.COVER_URLS.length}，实际 ${env.self.__bbFilled}`);

  const seenBefore = env.seen.fetch.length;
  const ev = swNavigate(env, NAV_URL);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.seen.idle.length, 0, '跑完了还续排：每次导航都重跑一遍全清单匹配，白给');
  assert.equal(env.seen.fetch.length, seenBefore + 1, '那一次回源只该是导航自己那一条');
});

test('SW21 骨架部分失败 ⇒ activate 留着最新一代旧桶、更旧的照删，兜底页那条全桶查找还有货', async () => {
  const env = loadSw();
  const B = env.g.BASE;
  const older = ['202510101200', '202512200900'];
  const stale = older.flatMap((g) => [`${B}-shell-${g}`, `${B}-doc-${g}`, `${B}-img-${g}`]);
  const foreign = ['other-app-shell-v1', `x${B}-doc-202512200900`, `${B}-page-cache`];
  const live = Object.values(env.g.BUCKET);
  for (const n of [...stale, ...foreign, ...live]) await env.caches.open(n);
  env.self.__bbFailed = 2;                   // install 那一格记下的部分失败条数
  const { settled } = await fire(env, 'activate');
  assert.equal(settled[0].status, 'fulfilled', String(settled[0].reason && settled[0].reason.message));
  assert.deepEqual(host(env.seen.deleted).sort(), stale.filter((k) => k.endsWith(older[0])).sort(),
    '删的不是"更旧的那一代"：这一次没装上骨架，却把上一版攒下的离线层一起清了');
  assert.equal(env.self.__bbKeptStale, 3, '留一代是刻意的（3 枚 = shell/doc/img），留两代就是漏删');
  const left = (await env.caches.keys()).filter((k) => !live.includes(k)).sort();
  assert.deepEqual(left, [...foreign, ...stale.filter((k) => k.endsWith(older[1]))].sort(),
    '共存应用的桶、以及留下的那一代，都该原样还在');
});

test('SW22 反向对照：旧形状无条件删光，于是"部分失败那次发版"正好是把兜底页删掉的那一次', async () => {
  const env = loadSw({
    edits: [['const doomed = stale.filter((k) => gen(k) !== keepGen);', 'const doomed = stale;']],
  });
  const B = env.g.BASE;
  const older = ['202510101200', '202512200900'];
  const stale = older.flatMap((g) => [`${B}-shell-${g}`, `${B}-doc-${g}`, `${B}-img-${g}`]);
  for (const n of [...stale, ...Object.values(env.g.BUCKET)]) await env.caches.open(n);
  env.self.__bbFailed = 2;
  const { settled } = await fire(env, 'activate');
  assert.equal(settled[0].status, 'fulfilled');
  assert.equal(env.seen.deleted.length, stale.length,
    `旧形状这一族被清空（实测删了 ${env.seen.deleted.length} 枚）——SW21 那条留一代的判据判的就是这一格`);
});

test('SW23 反向对照：导航那一格不接盘，停在中途的补全就永远停在中途', async () => {
  const env = loadSw({
    edits: FILL_EDITS.concat([[
      '    fillIdle();\n    event.respondWith(networkFirst(req, LIMIT.doc, event));',
      '    event.respondWith(networkFirst(req, LIMIT.doc, event));',
    ]]),
  });
  env.g.fill.cursor = 4;
  const ev = swNavigate(env, NAV_URL);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.seen.idle.length, 0,
    '旧形状里导航不碰补全：这一格若也排进去了，SW18 那条"导航接盘"判的就不是这一发而是别的什么');
  assert.equal(env.self.__bbFillPasses, undefined, '趟数一格都没记：续跑确实没发生');
});

test('SW24 反向对照：整批失败不放开 running，那一次停下就成了永久的停', async () => {
  const env = loadSw({
    edits: FILL_EDITS.concat([[
      '      fill.running = false;\n      self.__bbFillStop =',
      '      self.__bbFillStop =',
    ]]),
    fetch: () => Promise.reject(new Error('offline')),
  });
  env.g.fillIdle();
  await drainIdle(env);
  assert.match(String(env.self.__bbFillStop), /整批失败/, '停下的原因照样在——旧形状不是没停，是停完再也起不来');
  assert.equal(env.g.fill.running, true, '互斥没放开：后面每一次导航都撞在这一个格上');
  const ev = swNavigate(env, NAV_URL);
  await Promise.allSettled(ev.jobs.map((p) => Promise.resolve(p)));
  assert.equal(env.seen.idle.length, 0, '读者走出隧道再点开一页，补全依旧不动');
});
