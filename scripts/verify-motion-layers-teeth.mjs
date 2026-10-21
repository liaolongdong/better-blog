#!/usr/bin/env node
/**
 * 牙齿：证明 verify-motion-layers 的「退场必须经过中间值」这条判据不是空话。
 *
 * 做法与既有牙齿家族不同——**一个跟踪文件都不改**：把 _site 做成符号链接农场（1133 个软链，
 * 源快照逐字节不动），只把要改的那一条 CSS 换成真副本并删掉 ⌘K 容器的退场过渡，跑量具，
 * 断言这一层报红且退出码 1，然后把软链装回去。
 * 为什么值得另开一本：scripts/verify-*-teeth 那几本会就地改写跟踪源文件、且只挂 exit 与 SIGINT，
 * 机器被 kill 时源码就停在被毒化的状态（memory 记过）。这一本改成只动 gitignore 目录，
 * 并把 SIGTERM/SIGHUP 也接上。
 *
 * 用法：node scripts/verify-motion-layers-teeth.mjs [--site=_site]
 * 退出码：0 牙齿成立 / 1 判据是空的（删掉过渡还绿）/ 2 环境或锚点问题。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SRC = path.resolve(REPO, opt('site', '_site'));
const FARM = path.join(REPO, 'spark-output/site-teeth');
const CSS_REL = 'assets/css/index.min.css';
const CSS = path.join(FARM, CSS_REL);
// 锚点是 minified 文本，改样式必须重钉（memory：拆包后锚点会静默失效）。
const FROM = '.cmdk{-webkit-transition:opacity var(--dur-2) var(--ease-out), display var(--dur-2) allow-discrete;transition:opacity var(--dur-2) var(--ease-out), display var(--dur-2) allow-discrete}';
const TARGET = path.join(REPO, 'scripts/verify-motion-layers.mjs');

let linkBack = null;
const restore = () => {
  if (!linkBack) return;
  try { fs.rmSync(CSS, { force: true }); fs.symlinkSync(linkBack, CSS); } catch (e) { console.log(`✗ 软链没装回去（${e.message}）：手工删掉 ${FARM} 重建即可，_site 未被改动`); }
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

console.log(`· 建符号链接农场：${path.relative(REPO, FARM)}（源快照 ${path.relative(REPO, SRC)} 只读）`);
buildFarm();
if (!fs.existsSync(CSS)) { console.log('✗ 农场里没有那条 CSS'); process.exit(2); }
const real = fs.realpathSync(CSS);
const css = fs.readFileSync(real, 'utf8');
if (!css.includes(FROM)) { console.log('✗ 牙齿锚点没命中——minified 文本变了，先重钉 FROM 再跑'); process.exit(2); }
linkBack = real;
fs.rmSync(CSS);
fs.writeFileSync(CSS, css.replace(FROM, '/*teeth:删掉 ⌘K 容器的退场过渡*/'));
console.log('· 已从副本里删掉 ⌘K 的退场过渡（源快照未动）');

let code = 0; let out = '';
try {
  out = execFileSync('node', [TARGET, '--site=spark-output/site-teeth', '--only=⌘K'], { cwd: REPO, encoding: 'utf8' });
} catch (e) {
  code = e.status === undefined ? -1 : e.status;
  out = (e.stdout || '') + (e.stderr || '');
}
restore();
console.log(out.trimEnd());
if (code === -1) { console.log('✗ 量具自己没跑起来（退出码 -1），这一条记缺账，不算牙齿成立'); process.exit(2); }
const red = /✗ ⌘K 面板/.test(out) && /中间帧 0 个/.test(out);
if (code === 1 && red) console.log('✓ 牙齿成立：删掉退场过渡 → 这一层报红、退出码 1');
else { console.log(`✗ 牙齿不成立：退出码 ${code}、红色读数=${red}——判据是空的，别宣称这一格可信`); process.exit(1); }
