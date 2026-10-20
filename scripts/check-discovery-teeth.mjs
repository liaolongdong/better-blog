#!/usr/bin/env node
/**
 * `check-discovery.mjs` 的守卫自证层：往一份 `_site` 副本里注入四处最小变异，
 * 每一处都必须让门禁变红。
 *
 * 为什么要有这一份：一条从来没有红过的判据，无法区分「实现是对的」与「判据根本没在跑」。
 * 本批四组 IndexNow + 四组 changelog 里，I1/I2/C2/C3/C4 都是新写的正则，
 * 一个字符写错（比如把 `changelog.html` 写成 `changelog`）就会永远绿着。
 *
 * 只改副本不改源：与 check-sw-teeth 同法，源文件一旦被就地改过，mtime 一推进
 * `check-seo.mjs` 那道「源比产物新就拒跑」的闸，后面所有门禁都会红得莫名其妙。
 *
 * C5 的覆盖是不对称的，这是刻意的，别误读成"整条判据都有牙齿"：
 * 产物那一半（区块里冒出 <script>/<iframe>）在这里用副本里的 changelog.html 实测能红；
 * 源侧那一半（`_plugins/changelog.rb` 里摘壳的 gsub 不见了）在这里**没法测**——
 * 它读的是仓库真源，改它就等于就地改源，正撞上上面那条 mtime 闸。
 * 那一半只能算"删了就立刻红"的 Presence 警报，它防的是"日后有人觉得这行多余顺手删掉"，
 * 不是一条被变异测过的判据。为什么非留不可：kramdown 在这个版本里放行为块级原始 HTML
 * （实测 `:remove_html_blocks` 取 true / "strip" 都拦不住），摘壳只能自己做，
 * 而自己做的那道口子没有天然症状——删掉之后站点照建、页面照看，只有真粘进一段尖括号才露馅。
 *
 * 用法：node scripts/check-discovery-teeth.mjs
 * 通过形状：`✓ 可发现性守卫 4/4 处变异都被判据逮住`；任一漏网退 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 底样目录与 check-discovery 同一个开关：默认 `_site`，但本机常驻的 `jekyll serve`
// 会用 dev 配置（url=http://localhost:4000）反复覆盖仓库 `_site`，拿它当底样会连累
// 基线那一跑。CI 与本地都传 `--site=<一份生产构建的隔离产物>`。
const SRC = path.resolve(ROOT, (process.argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));
if (!fs.existsSync(path.join(SRC, 'changelog.html'))) {
  console.log(`✗ ${SRC} 里没有 changelog.html——先构建一份生产产物，本脚本要它当底`);
  process.exit(2);
}

const cfg = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
const KEY = (/^\s{2}key:\s*['"]?([0-9a-f]{32})['"]?/m.exec(cfg) || [])[1];
if (!KEY) { console.log('✗ _config.yml 读不到 indexnow.key'); process.exit(2); }

/** 一刀要真的落在肉上：替换没命中就抛，让这一格记成「这一刀没下成」而不是假绿。 */
function mustReplace(dir, rel, from, to) {
  const f = path.join(dir, rel);
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(from)) throw new Error(`${rel} 里找不到要改的那一串：${from.slice(0, 40)}`);
  fs.writeFileSync(f, s.replace(from, to));
}

const MUTATIONS = [
  {
    name: '把一段 <script> 塞进某个版本区块（模拟发版时从 commit message 粘进原始 HTML）',
    group: 'C5',
    apply: (d) => {
      const f = path.join(d, 'changelog.html');
      const s = fs.readFileSync(f, 'utf8');
      const m = /<section class="cat-section"[^>]*>/.exec(s);
      if (!m) throw new Error('副本里找不到 <section class="cat-section"> 这个锚，这一刀没处下');
      fs.writeFileSync(f, s.slice(0, m.index + m[0].length)
        + '\n<script>inject()</script>\n<iframe src="https://x.example"></iframe>\n'
        + s.slice(m.index + m[0].length));
    },
  },
  {
    name: 'key 文件内容与 _config.yml 脱钩',
    group: 'I1',
    apply: (d) => fs.writeFileSync(path.join(d, `${KEY}.txt`), KEY.split('').reverse().join('')),
  },
  {
    name: 'key 文件被塞进站点地图',
    group: 'I2',
    apply: (d) => mustReplace(d, 'sitemap.xml', '</urlset>', `    <url><loc>https://x.example/${KEY}.txt</loc></url>\n</urlset>`),
  },
  {
    name: 'changelog 从站点地图里被删掉（页面仍在、地址不再申报）',
    group: 'C3',
    apply: (d) => {
      const f = path.join(d, 'sitemap.xml');
      const s = fs.readFileSync(f, 'utf8');
      const cut = s.replace(/ {4}<url>[\s\S]*?\/changelog\.html[\s\S]*?<\/url>\n?/, '');
      if (cut === s) throw new Error('sitemap.xml 里没找到 changelog 那条 <url>，这一刀没处下');
      fs.writeFileSync(f, cut);
    },
  },
  {
    name: 'CHANGELOG.md 多一个版本而页面没跟上（模拟解析器静默吞条目）',
    group: 'C2',
    apply: (d) => {
      const f = path.join(d, 'changelog.html');
      const s = fs.readFileSync(f, 'utf8');
      const cut = s.indexOf('<section class="cat-section" id="v-');
      if (cut < 0) throw new Error('底样里找不到版本区块，这一刀没处下');
      const end = s.indexOf('</section>', cut);
      if (end < 0) throw new Error('版本区块没有 </section>，底样形状与预期不符');
      fs.writeFileSync(f, s.slice(0, cut) + s.slice(end + 10));
    },
  },
  {
    name: '页面上出现产物 CSS 里没有的类（模拟「顺手加一条新 CSS」）',
    group: 'C4',
    apply: (d) => mustReplace(d, 'changelog.html',
      'class="g-container archive-content"', 'class="g-container archive-content bb-tmp-not-in-css"'),
  },
];

const runGate = (dir) => {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/check-discovery.mjs'), `--site=${dir}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status === undefined ? 1 : e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-teeth-'));
const caught = [];
const missed = [];
let baselineOk = false;

try {
  const clean = path.join(base, 'clean');
  fs.cpSync(SRC, clean, { recursive: true });
  const b = runGate(clean);
  baselineOk = b.code === 0;
  if (!baselineOk) {
    console.log('✗ 未变异的副本就红了，后面每一刀都无从判断：\n' + b.out);
    process.exit(1);
  }
  console.log('· 底样（未变异）绿 ✓');

  for (const m of MUTATIONS) {
    const dir = path.join(base, 'm' + caught.length + missed.length);
    fs.cpSync(SRC, dir, { recursive: true });
    try {
      m.apply(dir);
    } catch (e) {
      missed.push(`${m.name}（这一刀没下成：${e.message}）`);
      continue;
    }
    const r = runGate(dir);
    const hit = r.code !== 0 && r.out.includes(`[${m.group}`);
    if (hit) caught.push(m.name);
    else missed.push(`${m.name} → 门禁 ${r.code === 0 ? '仍然全绿' : `红了但没报 [${m.group}] 组`}`);
  }
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

caught.forEach((n) => console.log(`✓ 逮住：${n}`));
missed.forEach((n) => console.log(`✗ 漏网：${n}`));
console.log(`\n可发现性守卫 ${caught.length}/${MUTATIONS.length} 处变异都被判据逮住（底样绿=${baselineOk}）`);
process.exit(missed.length ? 1 : 0);
