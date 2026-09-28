#!/usr/bin/env node
/**
 * 编码页浏览器判据的"仍有牙"自证（段 3 Task 8；§8.1 开头那句"每条判据都必须能变红"的落地）。
 *
 * 做什么：往**一份产物副本**里注入五处已知错误，每注入一处立刻重跑
 * `scripts/verify-codec-browser.mjs`，看红的是不是预期的那一条判据；跑完立刻按 md5 还原，
 * 还原不上就整轮中止——否则下一轮读到的"红"归因不到这一轮的注入。
 *
 * 为什么必须有这一本：run3→run4 之间改了八条判据，其中三条是把**假红**改成**真绿**
 * （4a 的 `<noscript>` 那句、8d 的负判据、9b/10a/10b 的三个计数器）。"改到绿"和"改到没牙"
 * 是同一个动作的两种结果，只有往产物里注入错才能把它们分开。这一本也是那三条计数器判据的
 * 唯一自证——钩子没挂上时 `ab` 恒为 0，看着像"没读进内存"，其实一行都没拦过。
 *
 * 副本必须是副本：仓库的 `_site` 是共享资源（`pnpm dev` 的 jekyll serve 与并行会话都在写它），
 * 指到那里去注错等于往别人的现场放火，所以这一本对 `ROOT/_site` 直接拒绝（退出码 2）。
 *
 * 前置：一次 `npx vite build` + 一次 `bundle exec jekyll build --destination "$副本"`，
 * 副本里要有 `tools/codec.html` 与 `assets/js/{toolCodec,toolkitCore}.min.js`。
 *
 * 跑法：
 *   TK_SITE_DIR=/tmp/codec-teeth/_site node scripts/verify-codec-browser-teeth.mjs
 *   TEETH_ONLY=M4,M5 node scripts/... — 只跑其中几刀（复跑崩场用；**别拿一次崩场当"没牙"的证据**：
 *   本轮 M4 第一刀曾因 `Page.navigate` 25s 无应答崩场被报成"未点燃"，单跑一次即 `✓ 红在 [4a]`）。
 *
 * 退出码：0 = 每一刀都点燃且每轮还原成功；1 = 有刀没点燃；2 = 环境不对（副本缺失 / 目标串找不到）；
 * 3 = 还原失败，后面的轮次全部中止。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.TK_SITE_DIR ? path.resolve(process.env.TK_SITE_DIR) : null;
const HARNESS = path.join(ROOT, 'scripts', 'verify-codec-browser.mjs');

if (!SITE) {
  console.log('✗ 必须用 TK_SITE_DIR 指到一份产物副本（不能是仓库的 _site——那是共享的）');
  process.exit(2);
}
if (SITE === path.join(ROOT, '_site')) {
  console.log('✗ TK_SITE_DIR 指的是仓库的 _site，这一本只允许打在副本上');
  process.exit(2);
}
if (!fs.existsSync(path.join(SITE, 'tools/codec.html'))) {
  console.log(`✗ ${SITE} 里没有 tools/codec.html——先构建那份副本`);
  process.exit(2);
}

/** 允许被改的文件（副本内的相对路径）；每刀的 `targets` 只能从这里选 */
const REL = ['assets/js/toolCodec.min.js', 'assets/js/toolkitCore.min.js', 'tools/codec.html'];
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const snapshot = () => Object.fromEntries(REL.map((r) => [r, md5(path.join(SITE, r))]));

const BAKE = fs.mkdtempSync(path.join(os.tmpdir(), 'codec-teeth-'));
/**
 * 每一刀的 harness 原始输出落在这里，**跑完不删**——"红在哪几条"这件事只有对着读数才复核得动，
 * 打完就焚的自证等于没做（这一本初稿把日志写进 `BAKE`、末尾连着一起删。两份副本各跑过一次全五刀，
 * M3 那轮的红集都是 `9a、9b、9c` 三条，但那一轮当时只留下了汇总行，逐条读数拿不到——正是这一档
 * "看着像复现了、其实没证据"的形状）。
 */
const LOGDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'codec-teeth-logs-'));
REL.forEach((r) => {
  const dir = path.join(BAKE, path.dirname(r));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(SITE, r), path.join(BAKE, r));
});
const PRISTINE = snapshot();
/** 每轮跑完都调这一只；对不上就退 3——带着脏产物继续跑，之后的红全是假证据 */
const restore = () => {
  REL.forEach((r) => fs.copyFileSync(path.join(BAKE, r), path.join(SITE, r)));
  const now = snapshot();
  const bad = REL.filter((r) => now[r] !== PRISTINE[r]);
  if (bad.length) {
    console.log(`✗ 还原失败：${bad.join(' ')}——后面的轮次全部中止`);
    process.exit(3);
  }
};

/**
 * 五处注入。`expect` 是**唯一**允许红的判据编号（真产物上这五条本来全绿，见收口读数）；
 * `targets` 点名允许被改的文件，避免"顺手改了另一个文件"把红因归错地方。
 *
 * @type {Array<{id:string,name:string,expect:string,targets:string[],from:string,to:string}>}
 */
const MUTS = [
  { id: 'M1', name: '文件闸门那句「不读进内存」换成近义词（口径消失一档）', expect: '10a',
    targets: ['assets/js/toolCodec.min.js'], from: '不读进内存', to: '不读入内存' },
  { id: 'M2', name: '字节通道从 arrayBuffer() 改成 text()（文件摘要掉进字符串通道）', expect: '10b',
    targets: ['assets/js/toolCodec.min.js'], from: 'arrayBuffer', to: 'text' },
  { id: 'M3', name: '1 MiB 闸门从 1048576 抬到 1048577（边界让位一格）', expect: '9a',
    targets: ['assets/js/toolCodec.min.js'], from: '1048576', to: '1048577' },
  { id: 'M4', name: 'noscript 那一句的类名改掉（禁 JS 专属文案消失）', expect: '4a',
    targets: ['tools/codec.html'], from: 'tk-compliance--noscript', to: 'tk-compliance--noscripts' },
  { id: 'M5', name: '复制成功的改口文案换字（3f 判的那次真按键回话）', expect: '3f',
    targets: ['assets/js/toolkitCore.min.js', 'assets/js/toolCodec.min.js'], from: '已复制', to: '已复制咯' },
];

const ONLY = process.env.TEETH_ONLY ? process.env.TEETH_ONLY.split(',') : null;
console.log(`# 副本 ${SITE}\n# 基线 md5 ${JSON.stringify(PRISTINE)}\n# 备份 ${BAKE}`);

const rows = [];
for (const m of MUTS) {
  if (ONLY && !ONLY.includes(m.id)) continue;
  let touched = 0;
  for (const rel of m.targets) {
    const f = path.join(SITE, rel);
    const txt = fs.readFileSync(f, 'utf8');
    const n = txt.split(m.from).length - 1;
    if (n > 0) { fs.writeFileSync(f, txt.split(m.from).join(m.to)); touched += n; }
  }
  if (touched === 0) {
    restore();
    console.log(`✗ ${m.id} ${m.name} — 目标串「${m.from}」在副本里找不到，注入没落地（这一刀是空的）`);
    rows.push({ m, code: 2, touched: 0, red: [], lit: false });
    continue;
  }
  const log = path.join(LOGDIR, `teeth-${m.id}.log`);
  const fd = fs.openSync(log, 'w');
  let code = 0;
  try {
    execFileSync('node', [HARNESS], { cwd: ROOT, env: { ...process.env, TK_SITE_DIR: SITE }, stdio: ['ignore', fd, fd] });
  } catch (err) { code = err.status ?? -1; }
  fs.closeSync(fd);
  restore();
  const red = [...fs.readFileSync(log, 'utf8').matchAll(/^✗ (\S+)/gm)].map((x) => x[1]);
  const lit = red.includes(m.expect);
  rows.push({ m, code, touched, red, lit });
  console.log(`${lit ? '✓' : '✗'} ${m.id} ${m.name} — 注入 ${touched} 处，退出码 ${code}，`
    + `红在 [${red.join('、') || '无'}]，期望 ${m.expect} ${lit ? '点燃' : '没点燃'}`);
}

const failed = rows.filter((r) => !r.lit);
console.log(`\n合计 ${rows.length} 个注入，点燃 ${rows.length - failed.length} 个，`
  + `未点燃 ${failed.length} 个`
  + (failed.length ? `：${failed.map((r) => `${r.m.id}(期望 ${r.m.expect}，实红 ${r.red.join('/') || '无'})`).join('；')}` : ''));
fs.rmSync(BAKE, { recursive: true, force: true });
console.log(`# 每刀的红项读数留在 ${LOGDIR}（不删，供后来的人复核）`);
process.exit(failed.length ? 1 : 0);
