#!/usr/bin/env node
/**
 * 牙齿：证明 check-release.mjs 的每组判据都真能红。
 *
 * 与既有牙齿家族的区别：**不改任何一个跟踪文件**。把三份版本台账与 tag 清单复制到 gitignore 的
 * spark-output 里，只在副本上做 mutation，再经 check-release 的 `--package/--config/--changelog`
 * 覆盖口喂回去。这样「机器被 kill」最多留下一堆临时文件，源码不会停在被毒化的状态。
 *
 * 版本号一律从 `package.json` 现读，不在本文件里写死：2026-11-01 把台账推到 2.2.0 的那一刻，
 * 这一份 6 把刀里 5 把同时空转（K1/K2/K3 的 `replace` 找不到 `2.1.0` 就原样返回，门禁读到
 * 一份没被改过的副本 → 判全绿；K5/K6 的 `expect` 钉着「而包体是 2.1.0」，红的其实是另一句）。
 * 写死当前版本 = 把牙齿的寿命绑在两次发版之间，而这正是牙齿唯一该守住的时刻。
 *
 * 用法：node scripts/check-release-teeth.mjs
 * 退出码：0 每一把都如期（该红的红、K7 该绿的绿）/ 1 有刀空转 / 2 环境或锚点问题。
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

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 当前版本就是判据要守的那个值，所以它必须是这份台账唯一的真实来源 */
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(String(BASE))) {
  console.error(`✗ package.json 的 version 不是 X.Y.Z（读到 ${JSON.stringify(BASE)}）——牙齿无从派生变异值`);
  process.exit(2);
}
const [MAJ, MIN, PAT] = BASE.split('.').map(Number);
const PATCH_UP = `${MAJ}.${MIN}.${PAT + 1}`; // K1：包体领先一位
const TWO_SEG = `${MAJ}.${MIN}`; // K3：形状退化成两段
/** K5/K6 需要「比当前旧一档」与「比当前新一档」的两个版本号；0 位不够减时降一档 minor */
const PREV = PAT > 0 ? `${MAJ}.${MIN}.${PAT - 1}` : `${MAJ}.${MIN - 1}.0`;

/**
 * K5 变异值必须**不可能等于本机真实 tag 集里的最新一枚**，否则这把刀分不清"读了夹具"与
 * "压根没读夹具、退回去读了 git tag"（2026-11-02 现场：PREV 恰好是 2.1.0，而本机 `git tag`
 * 的最新就是 2.1.0 —— `--tags-file` 那一整条口被摘掉，K5 的期望串仍然命中）。
 * 用一个从没人会打的版本号，并在这里就地确认它确实不在真实 tag 集里（哪天有人真打了，
 * 这把刀当场退 2，而不是悄悄变成假牙）。
 */
const SENTINEL_OLD = '0.8.8';
const realTags = (() => {
  try {
    return execFileSync('git', ['tag', '--list'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim().replace(/^v/, '')).filter(Boolean);
  } catch { return null; }
})();
if (realTags && realTags.includes(SENTINEL_OLD)) {
  console.error(`✗ 本机 git tag 里已经有 ${SENTINEL_OLD}——K5 的哨兵值失效，换一个再谈牙齿`);
  process.exit(2);
}

const run = (extra = []) => {
  try {
    const out = execFileSync('node', [GATE, '--package=spark-output/release-teeth/package.json',
      '--config=spark-output/release-teeth/_config.yml', '--changelog=spark-output/release-teeth/CHANGELOG.md', ...extra],
      { cwd: ROOT, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) { return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') }; }
};

/** 副本里把某一段换成另一段；找不到落点就抛，静默 no-op 是假牙的制造工序 */
const mutate = (file, from, to, where) => {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error(`${where}：副本里没有 ${JSON.stringify(from.slice(0, 40))}，这一刀没有落点`);
  put(file, s.replace(from, to));
};
const mutateRe = (file, re, to, where) => {
  const s = fs.readFileSync(file, 'utf8');
  if (!re.test(s)) throw new Error(`${where}：副本里没有匹配 ${re} 的形状，这一刀没有落点`);
  put(file, s.replace(re, to));
};

/** 日志顶两条版本号，K4 拿它们互换位置（不写死 2.1.0 / 2.0.1） */
const topTwo = (s) => [...s.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1]).slice(0, 2);

const KNIVES = [
  { name: 'K1 包体领先一位', group: 'V1 三处一致',
    apply: () => mutate(PKG, `"version": "${BASE}"`, `"version": "${PATCH_UP}"`, 'K1 包体'),
    // 钉的是「package.json vs _config.yml」那一支。上一版写成了「包体与页脚对不上」，
    // 词序反了，K1 实际是靠另一支（pkg vs CHANGELOG）过的——等于没证明它声称的那一条。
    expect: new RegExp(`package\\.json vs _config\\.yml：${esc(PATCH_UP)} ≠ ${esc(BASE)}`) },
  { name: 'K2 site.version 被写歪', group: 'V1 三处一致',
    apply: () => mutateRe(CFG, new RegExp(`\\n(\\s*)version:\\s*["']?${esc(BASE)}["']?`), '\n$1version: "9.9.9"', 'K2 配置'),
    expect: /package\.json vs _config\.yml/ },
  { name: 'K3 版本形状退化成两段', group: 'V2 版本形状',
    apply: () => mutateRe(CFG, new RegExp(`version:\\s*["']?${esc(BASE)}["']?`), `version: "${TWO_SEG}"`, 'K3 形状'),
    expect: /不是 X\.Y\.Z/ },
  {
    name: 'K4 日志条目顺序倒过来', group: 'V3 顶条即最新',
    apply: () => {
      const s = fs.readFileSync(LOG, 'utf8');
      const [a, b] = topTwo(s);
      if (!a || !b) throw new Error(`K4 日志：副本里只数到 ${[a, b].filter(Boolean).length} 条形如 \`## X.Y.Z\` 的条目，换不了序`);
      put(LOG, s.replace(`## ${a}`, '## __SWAP__').replace(`## ${b}`, `## ${a}`).replace('## __SWAP__', `## ${b}`));
    },
    expect: /条目顺序错了/ },
  { name: 'K5 tag 落后于包体（发版没收口）', group: 'T1 tag 收口', tagOnly: true,
    extra: ['--require-tag', '--tags-file=spark-output/release-teeth/tags-old.txt'],
    // 清单里只放这一枚哨兵：门禁是**按版本排序**取最新的（K5 第一次下刀就撞见了这件事——
    // 两行写 `0.8.8` + `1.0.0` 时它报的是 1.0.0）。排序与 v 前缀那一面由 K6 钉。
    apply: () => put(TAGS.replace(/\.txt$/, '-old.txt'), `${SENTINEL_OLD}\n`),
    expect: new RegExp(`停在 ${esc(SENTINEL_OLD)} 而包体是 ${esc(BASE)}`) },
  {
    /**
     * K6 钉的是「读 tag 要自己排序、并且认得 v 前缀」这一条：清单故意按升序写、
     * 最新那枚带 `v`。排序与剥前缀两件事只要有一件没做，报出来的"最新"就不是 ${PATCH_UP}
     * （不排序会照清单顺序取第一行 = ${PREV}，不剥前缀会报成 v${PATCH_UP}），正则就对不上——
     * 刀因此能真区分修没修。
     */
    name: 'K6 升序清单 + v 前缀最新 tag', group: 'T1 tag 收口', tagOnly: true,
    extra: ['--require-tag', '--tags-file=spark-output/release-teeth/tags-unsorted.txt'],
    apply: () => put(TAGS.replace(/\.txt$/, '-unsorted.txt'), `${PREV}\n${BASE}\nv${PATCH_UP}\n`),
    expect: new RegExp(`停在 ${esc(PATCH_UP)} 而包体是 ${esc(BASE)}`),
  },
  {
    /**
     * 反向对照：tag 已经收口（最新一枚就是包体版本，清单还故意乱序、还带 v 前缀）时，
     * `--require-tag` 必须**退 0**。T1 这一档要是被写成"永远红"，上面两把照样各红一次、
     * 整份台账一路通过——而它守的那件事（发版收口）其实已经没人判了。
     */
    name: 'K7 expectGreen：tag 已收口（升序清单 + v 前缀 + 最新就是包体）', group: 'T1 tag 收口',
    tagOnly: true, expectGreen: true,
    extra: ['--require-tag', '--tags-file=spark-output/release-teeth/tags-equal.txt'],
    apply: () => put(TAGS.replace(/\.txt$/, '-equal.txt'), `1.0.0\n${PREV}\nv${BASE}\n`),
  },
];

let fails = 0;
const base = run();
if (base.code !== 0) { console.log('✗ 基线就是红的，牙齿无从判起——先看 check-release 的产物档：\n' + base.out); process.exit(2); }
console.log(`· 基线绿（副本喂进去也判全绿），从 package.json 派生变异值：BASE=${BASE} → 升一位=${PATCH_UP} 退一位=${PREV} 退化形状=${TWO_SEG}，开始下刀`);

const ORIG = { pkg: fs.readFileSync(PKG, 'utf8'), cfg: fs.readFileSync(CFG, 'utf8'), log: fs.readFileSync(LOG, 'utf8') };
const unchanged = () => fs.readFileSync(PKG, 'utf8') === ORIG.pkg && fs.readFileSync(CFG, 'utf8') === ORIG.cfg && fs.readFileSync(LOG, 'utf8') === ORIG.log;
for (const k of KNIVES) {
  put(PKG, ORIG.pkg); put(CFG, ORIG.cfg); put(LOG, ORIG.log);
  try {
    k.apply();
  } catch (e) {
    console.log(`✗ ${k.name}：锚点失效——${e.message}`);
    fails++;
    continue;
  }
  /** 只写 tag 清单的两把不碰三份副本，这条对照对它们没有意义 */
  if (!k.tagOnly && unchanged()) { console.log(`✗ ${k.name} 没改到任何东西——锚点写死了或被搬走，这一刀没有落点`); fails++; continue; }
  const r = run(k.extra || []);
  if (k.expectGreen) {
    if (r.code === 0) { console.log(`✓ ${k.name} → 该绿的确实绿`); continue; }
    console.log(`✗ ${k.name} 要求全绿却红了：\n${r.out.trim().slice(0, 260)}`); fails++; continue;
  }
  const hit = k.expect.test(r.out);
  if (r.code === 1 && hit) console.log(`✓ ${k.name} → 红在 [${k.group}]`);
  else { console.log(`✗ ${k.name} 空转：退出码 ${r.code}，判据命中=${hit}\n${r.out.trim().slice(0, 260)}`); fails++; }
}
console.log(fails ? `✗ ${fails}/${KNIVES.length} 把不如期（该红的没红、该绿的没绿）` : `✓ ${KNIVES.length} 把刀全部如期，check-release 的判据不是空话`);
process.exit(fails ? 1 : 0);
