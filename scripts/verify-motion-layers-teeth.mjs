#!/usr/bin/env node
/**
 * 牙齿：证明 verify-motion-layers 的判据不是空话。
 *
 * 与既有牙齿家族的区别：**一个跟踪文件都不改**。把 _site 做成符号链接农场（逐个 `ln -s`，
 * 源快照逐字节不动），只把要动的那条 CSS 换成真副本改一处，跑量具，断言对应的层报红。
 * 为什么必须有第二把刀：第一版只毒 ⌘K，而「书架遮罩」那一格当时写的是「遮罩只看收没收到、
 * 不要求中间值」——把 ::backdrop 的过渡整条删掉它照样绿。判据能空转到这个程度，
 * 不给它下一把刀就永远看不见。现在两格都要求「开要真被排版出来、退场要经过中间值」，
 * 两把刀各钉一条。
 *
 * 用法：node scripts/verify-motion-layers-teeth.mjs [--site=_site]
 * 退出码：0 每把刀都见红 / 1 有刀空转 / 2 环境、基线或锚点问题。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SRC = path.resolve(ROOT, opt('site', '_site'));
const FARM = path.join(ROOT, 'spark-output/site-teeth');
const GATE = path.join(ROOT, 'scripts/verify-motion-layers.mjs');
const CSS_REL = 'assets/css/index.min.css';
const CSS = path.join(FARM, CSS_REL);

let linkBack = null;
const restore = () => {
  if (!linkBack) return;
  try { fs.rmSync(CSS, { force: true }); fs.symlinkSync(linkBack, CSS); } catch (e) { console.log(`✗ 软链没装回去（${e.message}）：删掉 ${FARM} 重建即可，_site 未被改动`); }
  linkBack = null;
};
['exit', 'SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => process.on(sig, restore));

const buildFarm = () => {
  if (!fs.existsSync(path.join(SRC, 'index.html'))) { console.log(`✗ 没有 ${SRC}/index.html——先构建`); process.exit(2); }
  fs.rmSync(FARM, { recursive: true, force: true });
  fs.mkdirSync(FARM, { recursive: true });
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(SRC, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      const abs = path.join(SRC, r);
      if (fs.statSync(abs).isDirectory()) { fs.mkdirSync(path.join(FARM, r), { recursive: true }); walk(r); }
      else fs.symlinkSync(abs, path.join(FARM, r));
    }
  };
  walk('');
};

const runGate = (only) => {
  try { return { code: 0, out: execFileSync('node', [GATE, '--site=spark-output/site-teeth', `--only=${only}`], { cwd: ROOT, encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') }; }
};

/** 把某个选择器规则里的 transition 声明抠掉，其它属性一个不动（抠整条规则会连背景一起丢，
 *  那量到的就是「遮罩本来就没有」而不是「没有回程」，判据会红错原因）。 */
const stripTransition = (css, selRe) => {
  const m = selRe.exec(css);
  if (!m) return null;
  const body = m[1];
  if (!/(?:-webkit-)?transition:/.test(body)) return null;
  const cut = body.replace(/(?:-webkit-)?transition:[^;}]+;?/g, '');
  const at = css.indexOf(m[0]);
  return css.slice(0, at) + m[0].replace(body, cut) + css.slice(at + m[0].length);
};

const KNIVES = [
  { name: 'K1 删掉 ⌘K 容器的退场过渡', only: '⌘K', layer: '⌘K 面板',
    sel: /\.cmdk\{([^{}]*transition[^{}]*)\}/ },
  { name: 'K2 删掉 ::backdrop 的退场过渡', only: '书架遮罩', layer: '书架遮罩',
    sel: /dialog\.shelf::backdrop,[^{]*\{([^{}]*)\}/ },
];

console.log(`· 建符号链接农场：${path.relative(ROOT, FARM)}（源快照 ${path.relative(ROOT, SRC)} 只读）`);
buildFarm();
if (!fs.existsSync(CSS)) { console.log('✗ 农场里没有那条 CSS'); process.exit(2); }
const real = fs.realpathSync(CSS);
const ORIG = fs.readFileSync(real, 'utf8');

// 基线必须先绿：农场没被改动时这两层都要判过。少了这一步，「改动后报红」可能只是它本来就红。
linkBack = real;
const base = runGate('⌘K,书架遮罩');
if (base.code !== 0 || !/✓ ⌘K 面板/.test(base.out) || !/✓ 书架遮罩/.test(base.out)) {
  console.log('✗ 基线不绿，牙齿无从判起——先单独跑量具看这两层：\n' + base.out.trimEnd().split('\n').slice(-4).join('\n'));
  process.exit(2);
}
console.log('· 基线绿（⌘K 与书架遮罩在未改动农场上都过），开始下刀');

let fails = 0; let notJudged = 0;
for (const k of KNIVES) {
  const patched = stripTransition(ORIG, k.sel);
  if (patched === null) { console.log(`✗ ${k.name} 锚点没命中（minified 文本变了）——重钉 sel 再跑`); fails++; continue; }
  fs.rmSync(CSS);
  fs.writeFileSync(CSS, patched);
  const r = runGate(k.only);
  restore();
  // 退出码 2 是量具自己拒数（宿主没给帧、夹具缺前置条件），既不是「刀空转」也不是「判据成立」。
  // 把它算成失败会冤枉判据：2026-10-21 load 28.7 时 K1 就是这么被记成「绿是空的」的。
  if (r.code === 2) { console.log(`⚠ ${k.name} 没判成：量具拒数（机器此刻不空或夹具缺前置），重跑这一刀`); notJudged++; continue; }
  const hitRed = new RegExp(`✗ ${k.layer}`).test(r.out) && /中间帧 0 个/.test(r.out);
  if (r.code === 1 && hitRed) console.log(`✓ ${k.name} → ${k.layer} 报红、退出码 1`);
  else { console.log(`✗ ${k.name} 空转：退出码 ${r.code}，红色读数=${hitRed}——删掉过渡还判过，这一格的绿是空的\n${r.out.trim().split('\n').slice(-2).join('\n')}`); fails++; }
}
if (fails) console.log(`✗ ${fails}/${KNIVES.length} 把刀空转——对应那格的绿是空的，别宣称判过`);
else if (notJudged) console.log(`⚠ ${notJudged} 把刀没判成（拒数），${KNIVES.length - notJudged} 把见红——没有一条被证明是空的，但也没跑齐`);
else console.log(`✓ ${KNIVES.length} 把刀全部见红，开与退场两条判据都有牙`);
process.exit(fails ? 1 : (notJudged ? 2 : 0));
