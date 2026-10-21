#!/usr/bin/env node
/**
 * 牙齿：证明 check-release.mjs 的每组判据都真能红。
 *
 * 与既有牙齿家族的区别：**不改任何一个跟踪文件**。把三份版本台账复制到 gitignore 的
 * spark-output 里，只在副本上做 mutation，再经 check-release 的 `--package/--config/--changelog`
 * 覆盖口喂回去。这样「机器被 kill」最多留下一堆临时文件，源码不会停在被毒化的状态。
 *
 * 用法：node scripts/check-release-teeth.mjs
 * 退出码：0 每把刀都红过 / 1 有刀空转 / 2 环境或锚点问题。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'spark-output/release-teeth');
const GATE = path.join(ROOT, 'scripts/check-release.mjs');
fs.mkdirSync(DIR, { recursive: true });

const PKG = path.join(DIR, 'package.json');
const CFG = path.join(DIR, '_config.yml');
const LOG = path.join(DIR, 'CHANGELOG.md');
const TAGS = path.join(DIR, 'tags.txt');
const put = (f, s) => fs.writeFileSync(f, s);
put(PKG, fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
put(CFG, fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8'));
put(LOG, fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'));
put(TAGS, '2.1.0\n2.0.1\n1.0.0\n');

const run = (extra = []) => {
  try {
    const out = execFileSync('node', [GATE, '--package=spark-output/release-teeth/package.json',
      '--config=spark-output/release-teeth/_config.yml', '--changelog=spark-output/release-teeth/CHANGELOG.md', ...extra],
      { cwd: ROOT, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) { return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') }; }
};

const KNIVES = [
  { name: 'K1 包体领先一位', group: 'V1 三处一致',
    apply: () => { const s = fs.readFileSync(PKG, 'utf8'); put(PKG, s.replace('"version": "2.1.0"', '"version": "2.1.1"')); },
    expect: /包体与页脚对不上|最新一版没有更新日志/ },
  { name: 'K2 site.version 被写歪', group: 'V1 三处一致',
    apply: () => { const s = fs.readFileSync(CFG, 'utf8'); put(CFG, s.replace(/\n(\s*)version:\s*["']?2\.1\.0["']?/, '\n$1version: "9.9.9"')); },
    expect: /package\.json vs _config\.yml/ },
  { name: 'K3 版本形状退化成两段', group: 'V2 版本形状',
    apply: () => { const s = fs.readFileSync(CFG, 'utf8'); put(CFG, s.replace(/version:\s*["']?2\.1\.0["']?/, 'version: "2.1"')); },
    expect: /不是 X\.Y\.Z/ },
  { name: 'K4 日志条目顺序倒过来', group: 'V3 顶条即最新',
    apply: () => { const s = fs.readFileSync(LOG, 'utf8'); put(LOG, s.replace(/^## \[?v?(2\.1\.0)/m, '## [9.9.9]').replace(/^## \[?v?(2\.0\.1)/m, '## [2.1.0]').replace('## [9.9.9]', '## [2.0.1]')); },
    expect: /条目顺序错了/ },
  { name: 'K5 tag 落后于包体（发版没收口）', group: 'T1 tag 收口', extra: ['--require-tag', '--tags-file=spark-output/release-teeth/tags-old.txt'],
    apply: () => put(TAGS.replace(/\.txt$/, '-old.txt'), '2.0.1\n1.0.0\n'),
    expect: /tag 停在 2\.0\.1/ },
];

let fails = 0;
const base = run();
if (base.code !== 0) { console.log('✗ 基线就是红的，牙齿无从判起——先看 check-release 的产物档：\n' + base.out); process.exit(2); }
console.log('· 基线绿（副本喂进去也判全绿），开始下刀');

const ORIG = { pkg: fs.readFileSync(PKG, 'utf8'), cfg: fs.readFileSync(CFG, 'utf8'), log: fs.readFileSync(LOG, 'utf8') };
for (const k of KNIVES) {
  put(PKG, ORIG.pkg); put(CFG, ORIG.cfg); put(LOG, ORIG.log);
  k.apply();
  if (k.name === 'K2' || k.name === 'K3') { if (!fs.readFileSync(CFG, 'utf8').includes(k.name === 'K2' ? '9.9.9' : '"2.1"')) { console.log(`✗ ${k.name} 没改到东西——锚点失效`); fails++; continue; } }
  const r = run(k.extra || []);
  const hit = k.expect.test(r.out);
  if (r.code === 1 && hit) console.log(`✓ ${k.name} → 红在 [${k.group}]`);
  else { console.log(`✗ ${k.name} 空转：退出码 ${r.code}，判据命中=${hit}\n${r.out.trim().slice(0, 260)}`); fails++; }
}
console.log(fails ? `✗ ${fails}/${KNIVES.length} 把刀空转` : `✓ ${KNIVES.length} 把刀全部见红，check-release 的判据不是空话`);
process.exit(fails ? 1 : 0);
