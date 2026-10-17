#!/usr/bin/env node
/**
 * check-sw.mjs 的牙齿自证：七组判据每一组都注入一处最小变异，确认门禁**会变红**、
 * 并且红在正确的那一组。全绿的报警器如果没人验证过，等于没有报警器——这一条在离线层上
 * 尤其要紧，因为那七组判据核的是"六个地方说同一件事"，任何一处判据静默失效都不会有构建错误。
 *
 * 变异分两类，代价不同：
 *   - 产物侧（清单 / 桶名 / 兜底页 / 注册面）：把 `_site` 复制一份影子目录再改，真仓库零风险；
 *   - 源侧（模板引用面）：门禁直读仓库源文件，只能就地改、跑完立即还原，每条变异都留内存备份，
 *     脚本开头注册 exit 钩子批量还原（中途 Ctrl-C 也不留脏文件）。
 *
 * 影子只拷**一次**：`_site` 是 79MB / 960 个文件，每条变异重拷一遍就是按条数那么多次全量拷贝，
 * 而每条变异只动一两个文件——所以影子建立后按文件备份、跑完还原，下一轮接着用同一份影子。
 * 拷一次的风险是"上一轮的变异漏还原活到下一轮"，所以还原排在 finally 里而不是 case 末尾，
 * 且基线那一跑就打在影子刚建好、还没改过任何东西的时候（下面 shadow 基线那一格）。
 *
 * 两条脚手架自己的自证（都是过去真踩过的说谎方式）：
 *   1. `String.replace` 找不到目标时**原样返回**——变异若静默不命中，那一格就变成
 *      "注入 nothing、门禁仍绿"的假牙，所以 shadowEdit / mutateSrc 都在写完前比对字节，
 *      没改动就直接抛错，不把"没生效"冒充"生效了但门禁没抓住"。
 *   2. 基线必须双份：真 `_site` 绿 + **未改过的影子 `_site`** 也绿。后者证明 `--site=` 这条
 *      路径本身不会让门禁假红（它把 SITE_REL 当基准去扫产物，路径口径一旦漂了，
 *      那一轮所有变异都会红，而红的原因与判据无关）。
 *
 * 用法：node scripts/check-sw-teeth.mjs
 * 前置：先 `bundle exec jekyll build`，且 `node scripts/check-sw.mjs` 是绿的。
 * 失败形状：任一条变异没让门禁红、或红错了组，末尾汇总并退 1。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(ROOT, 'scripts/check-sw.mjs');
// 每次跑各给一份 scratch：共用一个目录名会被并行的另一路（子智能体、另一个会话的同一条命令）
// rm -rf 掉，那一轮的测量整批作废，而且作废方式是"影子文件不见了"式的崩。
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-teeth-'));
const SHADOW = path.join(SCRATCH, '_site');
const srcBackups = new Map();
const shadowBackups = new Map();

/**
 * 就地改仓库源文件：先备份，改完注册还原。
 * @param {string} rel 仓库内相对路径
 * @param {Function} fn (原文) => 新文本
 * @returns {void}
 */
function mutateSrc(rel, fn) {
  const p = path.join(ROOT, rel);
  const before = fs.readFileSync(p, 'utf8');
  if (!srcBackups.has(rel)) srcBackups.set(rel, before);
  const after = fn(before);
  if (after === before) throw new Error(`变异没命中源文件：${rel}`);
  fs.writeFileSync(p, after);
}

/**
 * 改影子产物里的一个文件：首次改动前把原件备份下来，供本条变异跑完后还原。
 * @param {string} rel 相对影子 `_site` 的路径
 * @param {Function} fn (原文) => 新文本
 * @returns {void}
 */
function shadowEdit(rel, fn) {
  const p = path.join(SHADOW, rel);
  const before = fs.readFileSync(p, 'utf8');
  if (!shadowBackups.has(rel)) shadowBackups.set(rel, before);
  const after = fn(before);
  if (after === before) throw new Error(`变异没命中产物：_site/${rel}（口径漂了，这条是假牙）`);
  fs.writeFileSync(p, after);
}

/** 往影子里新建一个文件（用来模拟"sw.js 被放错目录"这种新增物） */
function shadowAdd(rel, content) {
  const p = path.join(SHADOW, rel);
  if (fs.existsSync(p)) throw new Error(`影子里已存在 ${rel}，这条变异该改成编辑而不是新建`);
  shadowBackups.set(`__new__${rel}`, '');
  fs.writeFileSync(p, content);
}

function restoreAll() {
  for (const [rel, buf] of srcBackups) fs.writeFileSync(path.join(ROOT, rel), buf);
  srcBackups.clear();
  for (const [rel, buf] of shadowBackups) {
    if (rel.startsWith('__new__')) fs.rmSync(path.join(SHADOW, rel.slice(7)), { force: true });
    else fs.writeFileSync(path.join(SHADOW, rel), buf);
  }
  shadowBackups.clear();
}
process.on('exit', () => {
  restoreAll();
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});
process.on('SIGINT', () => { restoreAll(); process.exit(130); });
// 同 §check-tools-surface-teeth 那一发：SIGTERM 的默认动作是直接终止，不跑 `exit` 监听，
// 而那几刀改的是仓库自己的源文件——留下来就是一树假源码。本脚本全同步（零 await、门禁走
// `spawnSync`），2026-10-17 实测：变异进行中收到 SIGTERM，那一轮仍会跑完、由 `exit` 钩子还原、
// 退码 0（监听注册过的信号不杀人，只排队）；换掉的是"当场死、还原轮不到"那一种。
process.on('SIGTERM', () => { restoreAll(); process.exit(143); });

/**
 * baseurl 从产物自己的 canonical 现推，不写死 `/better-blog`：写死之后站点一改挂载路径，
 * 这些变异就静默不命中（而"没命中"在 `replace` 的语义里长得和"命中了但门禁没抓住"一样）。
 * @returns {string} 带尾斜杠的 baseurl
 */
function baseFromArtifact() {
  const h = fs.readFileSync(path.join(ROOT, '_site/sw.js'), 'utf8');
  const m = /const BASE\s*=\s*'([^']*)'/.exec(h);
  if (!m) throw new Error('产物 sw.js 里读不到 BASE 常量，门禁的变异口径没法自推');
  return m[1];
}

/**
 * @param {string|null} siteOverride 影子路径；null 表示用真 `_site`
 * @returns {{code: number, out: string}} 退出码与合并输出
 */
function runGate(siteOverride) {
  const args = [GATE];
  if (siteOverride) args.push(`--site=${siteOverride}`);
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 16 << 20 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// 影子建立：整份拷一次，之后只按被改到的文件备份/还原
fs.cpSync(path.join(ROOT, '_site'), SHADOW, { recursive: true });

const BASE = baseFromArtifact();
/** sw.js 产物里那几行清单锚点，用于"插一条 / 删一条"型变异 */
const SW = () => ({
  insertShell: (line) => shadowEdit('sw.js', (s) => s.replace('const SHELL_URLS = [', `const SHELL_URLS = [\n  ${line},`)),
  insertDefer: (line) => shadowEdit('sw.js', (s) => s.replace('const DEFERRED_URLS = [', `const DEFERRED_URLS = [\n  ${line},`)),
  insertDoc: (line) => shadowEdit('sw.js', (s) => s.replace('const DOC_URLS = [', `const DOC_URLS = [\n  ${line},`)),
});

const cases = [
  // ── 1 清单地址 ────────────────────────────────────────────────
  {
    name: '文档清单里少拼一次 baseurl 前缀',
    group: '清单',
    // DOC_URLS 里 Liquid 生成那几条是**字面量**（`'/better-blog/tools.html'`），
    // 骨架/豁免那几条是 `BASE + '…'` 拼接——两类写法不一样，锚点也得分别对准。
    artifact: () => shadowEdit('sw.js', (s) => s.replace(`'${BASE}/tools.html',`, "'/tools.html',")),
  },
  {
    name: '骨架清单指向产物里不存在的文件',
    group: '清单',
    artifact: () => shadowEdit('sw.js', (s) => s.replace("BASE + '/favicon.ico'", "BASE + '/favicon-nope.ico'")),
  },
  {
    name: '封面清单不做去重（两张文章共用一张）',
    group: '清单',
    // 拆掉 Array.from(new Set(...))：ai-sdd 与 ai-sdd-github 共用 banner-3.png，去重一撤
    // 同一张就出现两次——这一条正是当初抓出那个重复的判据，别让它变成只能靠肉眼。
    artifact: () => shadowEdit('sw.js', (s) => s.replace('Array.from(new Set(COVER_RAW))', 'COVER_RAW.slice()')),
  },

  // ── 2 骨架完整性 ──────────────────────────────────────────────
  {
    name: '模板新加一份公共 CSS 却忘了骨架清单',
    group: '骨架完整性',
    src: () => mutateSrc('_includes/headAssets.html', (s) => s.replace(
      '<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/index.min.css">',
      '<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/index.min.css">\n'
      + '<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/teeth-only.min.css">',
    )),
  },
  {
    name: '骨架清单漏掉全站都在加载的 editorial.min.js',
    group: '骨架完整性',
    artifact: () => shadowEdit('sw.js', (s) => s.replace("  BASE + '/assets/js/editorial.min.js',\n", '')),
  },
  {
    name: '同一件既在骨架又在豁免表',
    group: '骨架完整性',
    artifact: () => { const w = SW(); w.insertDefer(`'${BASE}/assets/js/editorial.min.js'`); },
  },
  {
    name: '豁免表里藏一件谁都没引用的（表自己会过期）',
    group: '骨架完整性',
    // 挑一件**产物里真存在**但模板/页面/CSS 都不引用的图：判据 1 过得去，红的只有"藏死条目"那条。
    artifact: () => { const w = SW(); w.insertDefer(`'${BASE}/assets/img/tools/idcard-tool.svg'`); },
  },

  // ── 3 文档集合 ────────────────────────────────────────────────
  {
    name: '文档清单漏掉 sitemap 里的一篇文章',
    group: '文档集合',
    artifact: () => shadowEdit('sw.js', (s) => s.replace(`  '${BASE}/2016/06/18/hello-jekyll.html',\n`, '')),
  },
  {
    name: '文档清单多收一个 sitemap 外的页面（翻页视图）',
    group: '文档集合',
    // `/page2/` 在产物里存在（_site/page2/index.html），所以判据 1 不红，红的只有"两边口径分家"。
    artifact: () => { const w = SW(); w.insertDoc(`'${BASE}/page2/'`); },
  },

  // ── 4 透传名单 ────────────────────────────────────────────────
  {
    name: '把 feed.xml 写进预缓存清单',
    group: '透传名单',
    artifact: () => { const w = SW(); w.insertShell(`'${BASE}/feed.xml'`); },
  },

  // ── 5 桶名 ────────────────────────────────────────────────────
  {
    name: 'BUILD 不再是 12 位构建时刻',
    group: '桶名',
    artifact: () => shadowEdit('sw.js', (s) => s.replace(/const BUILD\s*=\s*'\d{12}'/, "const BUILD = '2026'")),
  },
  {
    name: '两个桶重名（文档与骨架写进同一桶）',
    group: '桶名',
    artifact: () => shadowEdit('sw.js', (s) => s.replace("shell: BASE + '-shell-'", "shell: BASE + '-doc-'")),
  },
  {
    name: '桶名不带 baseurl',
    group: '桶名',
    artifact: () => shadowEdit('sw.js', (s) => s.replace("img: BASE + '-img-'", "img: '' + '-img-'")),
  },

  // ── 6 兜底页 ──────────────────────────────────────────────────
  {
    name: '兜底页引外部样式表',
    group: '兜底页',
    artifact: () => shadowEdit('offline.html', (s) => s.replace('</head>',
      `<link rel="stylesheet" href="${BASE}/assets/css/index.min.css"></head>`)),
  },
  {
    name: '兜底页漏掉 robots noindex',
    group: '兜底页',
    artifact: () => shadowEdit('offline.html', (s) => s.replace('noindex, nofollow', 'nofollow')),
  },
  {
    name: '兜底页链向一个不在文档清单里的地址',
    group: '兜底页',
    artifact: () => shadowEdit('offline.html', (s) => s.replace('</body>',
      `<p><a href="${BASE}/page3/">翻页</a></p></body>`)),
  },
  {
    name: '兜底页被写进站点地图',
    group: '兜底页',
    artifact: () => shadowEdit('sitemap.xml', (s) => s.replace('</urlset>',
      `<url><loc>https://liaolongdong.github.io${BASE}/offline.html</loc></url></urlset>`)),
  },

  // ── 7 注册面 ──────────────────────────────────────────────────
  {
    // 这一条是台账里唯一"先做成假牙、再回头修判据"的：最初写的变异只删掉一处 isSecureContext，
    // 门禁仍绿——因为产物里 isSecureContext 有两处用途（剪贴板与离线注册），而判据 7 当时只判
    // "这个串在不在"。判据改成"swdev 闸门 ±300 字符内必须同时有 isSecureContext 与 serviceWorker"
    // 之后，这一条删掉注册那处的探测就必红，剪贴板那处离得 38,634 字符，顶不住判据。
    name: '注册代码里摘掉安全上下文探测（http 与 file:// 每页一条 reject）',
    group: '注册面',
    artifact: () => shadowEdit('assets/js/editorial.min.js', (s) => s.replace(
      '"serviceWorker"in navigator&&window.isSecureContext',
      '"serviceWorker"in navigator',
    )),
  },
  {
    name: '注册代码里摘掉 swdev 那道本地闸门（localhost 也注册）',
    group: '注册面',
    // 摘掉 `swdev` 就没有"本地默认不注册、显式才开"这条路，`jekyll serve` 下 SW 会接管页面，
    // verify-idcard-browser.mjs 的 5a 会把 SW 代发的资源量成 0 字节——红的是量具而不是实现。
    artifact: () => shadowEdit('assets/js/editorial.min.js', (s) => s.replace('swdev=1', 'swall=1')),
  },
  {
    name: 'sw.js 被放到 assets/js/ 下（作用域只剩那个目录）',
    group: '注册面',
    artifact: () => shadowAdd('assets/js/sw.js', '/* 位置错的那一份 */'),
  },
  {
    name: '页面 HTML 里出现内联注册',
    group: '注册面',
    artifact: () => shadowEdit('index.html', (s) => s.replace('</body>',
      '<script>navigator.serviceWorker.register("/x/sw.js");</script></body>')),
  },
  {
    name: 'sw.js 涨破 gzip 上限',
    group: '注册面',
    // 随机字节压不动，加 30KB 就必然越过 16,384B 那条线；变异落在清单切点之后，
    // 门禁沙箱求值的那一段常量不受影响——红的只有体积这一条，不是"读不到清单"。
    artifact: () => shadowEdit('sw.js', (s) => `${s}\nvar __TEETH_PAD='${crypto.randomBytes(30000).toString('base64')}';`),
  },
];

// ── 基线：真产物与影子产物都必须绿 ──────────────────────────────────────────
const realBase = runGate(null);
console.log(`基线一（真 _site）：exit=${realBase.code}`);
if (realBase.code !== 0) {
  console.log(`✗ 基线不绿，先修门禁再说牙齿：\n${realBase.out}`);
  process.exit(1);
}
const shadowBase = runGate(SHADOW);
console.log(`基线二（未改过的影子 _site）：exit=${shadowBase.code}`);
if (shadowBase.code !== 0) {
  console.log(`✗ 影子副本自己就让门禁红，后面的"变红"说明不了任何事：\n${shadowBase.out}`);
  process.exit(1);
}

let pass = 0;
const problems = [];
for (const c of cases) {
  restoreAll();
  try {
    if (c.src) c.src();
    if (c.artifact) c.artifact();
    const got = runGate(c.artifact ? SHADOW : null);
    if (got.code === 0) problems.push(`✗ ${c.name}：注入后门禁仍是绿的（假牙）`);
    else if (!got.out.includes(`[${c.group}]`)) {
      problems.push(`✗ ${c.name}：红了但没红在「${c.group}」组：\n${got.out.split('\n').filter((l) => l.startsWith('[')).slice(0, 3).join('\n')}`);
    } else {
      pass += 1;
      const extra = got.out.split('\n').filter((l) => l.startsWith('[')).length;
      console.log(`✓ ${c.name} → [${c.group}]（该轮红 ${extra} 条）`);
    }
  } catch (e) {
    problems.push(`✗ ${c.name}：变异脚本自己崩了 — ${e.message}`);
  } finally {
    restoreAll();
  }
}

console.log(`\n牙齿台账：${pass}/${cases.length} 条变异如期变红且红在对的组`);
if (problems.length) {
  for (const p of problems) console.error(p);
  console.error('✗ check-sw 的判据有盲区，按上面逐条补');
  process.exit(1);
}
// 收尾自证：变异全部还原之后，真仓库必须还是绿的（源侧变异漏还原会在这里露出来）
const after = runGate(null);
if (after.code !== 0) {
  console.error(`✗ 跑完台账后基线不绿了，说明有源侧变异没还原干净：\n${after.out}`);
  process.exit(1);
}
console.log('✓ 收尾复核：真 _site 基线仍绿，源侧变异已全部还原');
