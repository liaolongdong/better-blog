#!/usr/bin/env node
/**
 * `scripts/build-image-variants.mjs --check` 的牙齿台账。
 *
 * 门禁本体管的是「台账 ↔ 磁盘」这一对账：转出去的 webp 还在不在、字节数有没有漂、
 * png 改过却没重转、候选清单里冒出一笔台账没有的账。这一本证明那十二支判据每支都咬得动。
 *
 * 为什么在桩目录里下刀而不是真语料：`--check` 只看三样东西——台账 JSON、磁盘上的字节、
 * 源文件里有没有引用那一串路径。桩目录把这三样都造得出来，而且造得出真语料里没有的形状
 * （no-gain 那一条、og 目录里的大图、贴着 SIZE_FLOOR 下沿的小图）。真树只跑一次基线，
 * 用来证明「台账本身是自洽的」，那一发红了就直接停——桩目录全绿也救不了它。
 *
 * 每一刀都落在一枚新铺的副本上（每例重新铺一次，不做还原），所以工作树从头到尾只读；
 * 锚点没命中就抛，不让「注入没生效」冒充「判据是假的」。
 *
 * 用法：node scripts/check-image-variants-teeth.mjs [--root=仓库根] [--keep]
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(process.cwd());
const SCRIPT = path.join(ROOT, 'scripts', 'build-image-variants.mjs');
const LEDGER = path.join(ROOT, 'scripts', 'image-variants.json');
const KEEP = process.argv.includes('--keep');

const KB = 1024;
/** @param n [number] 字节数 @param seed [number] 让每枚文件的 sha 互不相同 @returns {Buffer} */
function blob(n, seed) {
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i += 1) b[i] = (i * 31 + seed * 7) & 0xff;
  return b;
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const ENC = JSON.parse(fs.readFileSync(LEDGER, 'utf8')).encoder;
const FX = {
  a: { png: 'assets/img/fx/a.png', webp: 'assets/img/fx/a.webp' },
  c: { png: 'assets/img/fx/c.png', webp: 'assets/img/fx/c.webp' },
  b: { png: 'assets/img/fx/b.png' },
  dead: { png: 'assets/img/fx/dead.png' },
  og: { png: 'assets/img/og/big.png' },
  small: { png: 'assets/img/fx/small.png' },
};

/**
 * 铺一枚干净的桩仓库：三笔台账（两枚转出、一枚 no-gain）+ 三种「不该进台账」的形状。
 * @param {(dir: string) => void} [mut] 铺完之后在这一枚副本上下一刀
 * @returns {{dir: string, srcDir: string}}
 */
function layout(mut) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-variants-teeth-'));
  const srcDir = path.join(dir, 'src');
  const put = (rel, buf) => {
    const abs = path.join(srcDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    return abs;
  };
  fs.mkdirSync(path.join(srcDir, 'scripts'), { recursive: true });
  // 引用扫描面那四个目录必须都在：门禁的 walk 不认「目录不存在」，缺一个就整条崩
  for (const d of ['_posts', '_data', '_layouts', '_includes']) fs.mkdirSync(path.join(srcDir, d), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(srcDir, 'scripts', 'build-image-variants.mjs'));

  const aPng = put(FX.a.png, blob(700 * KB, 1));
  const aWebp = put(FX.a.webp, blob(300 * KB, 2));
  const cPng = put(FX.c.png, blob(660 * KB, 3));
  const cWebp = put(FX.c.webp, blob(240 * KB, 4));
  const bPng = put(FX.b.png, blob(640 * KB, 5));
  put(FX.dead.png, blob(700 * KB, 6));
  put(FX.og.png, blob(700 * KB, 7));
  put(FX.small.png, blob(100 * KB, 8));

  const variants = {
    [FX.a.png]: { sha256: sha(fs.readFileSync(aPng)), webp: FX.a.webp, pngBytes: fs.statSync(aPng).size, webpBytes: fs.statSync(aWebp).size },
    [FX.c.png]: { sha256: sha(fs.readFileSync(cPng)), webp: FX.c.webp, pngBytes: fs.statSync(cPng).size, webpBytes: fs.statSync(cWebp).size },
    [FX.b.png]: { sha256: sha(fs.readFileSync(bPng)), skip: 'no-gain', pngBytes: fs.statSync(bPng).size },
  };
  put('scripts/image-variants.json', Buffer.from(`${JSON.stringify({ encoder: ENC, variants }, null, 2)}\n`));

  const post = ['---', 'title: 桩稿', '---', '', `![a](${FX.a.png})`, `![b](${FX.b.png})`, `![c](${FX.c.png})`, `![og](/assets/img/og/big.png)`, `![small](/assets/img/fx/small.png)`, ''].join('\n');
  put('_posts/2026-01-01-fx.md', Buffer.from(post));

  if (mut) mut(srcDir);
  return { dir, srcDir };
}

/** @param srcDir [string] 桩仓库根 @returns {{code: number, out: string}} */
function run(srcDir) {
  const r = spawnSync(process.execPath, [path.join(srcDir, 'scripts', 'build-image-variants.mjs'), '--check'], { encoding: 'utf8', cwd: srcDir });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** 在副本的台账 JSON 上下一刀（读出来改对象再写回，不靠字符串锚点） */
function ledg(srcDir, fn) {
  const abs = path.join(srcDir, 'scripts/image-variants.json');
  const j = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const before = JSON.stringify(j);
  fn(j);
  if (JSON.stringify(j) === before) throw new Error('台账这一刀没改变一个字节');
  fs.writeFileSync(abs, `${JSON.stringify(j, null, 2)}\n`);
}

/** 在副本的脚本源码上下一刀：锚点必须命中，否则抛 */
function sub(srcDir, from, to, label) {
  const abs = path.join(srcDir, 'scripts', 'build-image-variants.mjs');
  const s = fs.readFileSync(abs, 'utf8');
  if (!s.includes(from)) throw new Error(`${label}：锚点没命中 ${from.slice(0, 60)}`);
  const t = s.split(from).join(to);
  if (t === s) throw new Error(`${label}：变异没改变一个字节`);
  fs.writeFileSync(abs, t);
}

/** 在副本的某个数据文件上下一刀 */
function subFile(srcDir, rel, from, to, label) {
  const abs = path.join(srcDir, rel);
  const s = fs.readFileSync(abs, 'utf8');
  if (!s.includes(from)) throw new Error(`${label}：锚点没命中 ${from.slice(0, 60)}`);
  fs.writeFileSync(abs, s.split(from).join(to));
}

const abs = (srcDir, rel) => path.join(srcDir, rel);

const TEETH = [
  {
    name: '台账的 encoder 那一栏漂了',
    expect: '台账编码器「',
    mut: (d) =>
      ledg(d, (j) => {
        j.encoder = j.encoder.replace('quality 82', 'quality 60');
      }),
  },
  { name: '脚本里的编码参数改了（台账字符串跟着 ENCODER 现算，这一刀必然对不上）', expect: '台账编码器「', mut: (d) => sub(d, `'82', '-compression_level'`, `'60', '-compression_level'`, '编码参数') },
  {
    name: '台账里少一笔而 webp 兄弟还在（滤镜会静默换过去）',
    expect: '有 webp 兄弟却不在台账里',
    mut: (d) =>
      ledg(d, (j) => {
        delete j.variants[FX.a.png];
      }),
  },
  {
    name: '候选没转也没记 no-gain（整笔账不见了）',
    expect: '是候选却不在台账里',
    mut: (d) => {
      ledg(d, (j) => {
        delete j.variants[FX.a.png];
      });
      fs.rmSync(abs(d, FX.a.webp));
    },
  },
  { name: 'png 改了一个字节而台账还是旧 sha', expect: '的 sha256 与台账不符', mut: (d) => fs.appendFileSync(abs(d, FX.a.png), Buffer.from('x')) },
  { name: '台账记着 webp 而文件不在', expect: '台账记着 webp 但文件不在', mut: (d) => fs.rmSync(abs(d, FX.a.webp)) },
  { name: 'webp 被重画过而字节数没回台账', expect: '的 webp 字节与台账不符', mut: (d) => fs.appendFileSync(abs(d, FX.a.webp), Buffer.from('xx')) },
  {
    name: '台账里的 pngBytes 被写成和 webpBytes 一样大',
    expect: '的 webp 不比 png 小',
    mut: (d) =>
      ledg(d, (j) => {
        j.variants[FX.a.png].pngBytes = j.variants[FX.a.png].webpBytes;
      }),
  },
  {
    name: '记着 no-gain 却留着一枚 webp 文件',
    expect: '记着 no-gain 却有 webp 文件',
    mut: (d) =>
      ledg(d, (j) => {
        const v = j.variants[FX.a.png];
        j.variants[FX.a.png] = { sha256: v.sha256, skip: 'no-gain', pngBytes: v.pngBytes };
      }),
  },
  {
    name: '台账里有一笔磁盘上不存在',
    expect: '在磁盘上不存在',
    mut: (d) =>
      ledg(d, (j) => {
        j.variants['assets/img/fx/ghost.png'] = { sha256: '0'.repeat(64), webp: 'assets/img/fx/ghost.webp', pngBytes: 1, webpBytes: 1 };
      }),
  },
  { name: '一张原先没人引用的图被稿件引用了', expect: '是候选却不在台账里', mut: (d) => subFile(d, '_posts/2026-01-01-fx.md', '![small]', `![dead](${FX.dead.png})\n![small]`, '加引用') },
  { name: 'og 目录那一档排除没了（og 里那枚大图进了候选却没账）', expect: '是候选却不在台账里', mut: (d) => sub(d, `    .filter((rel) => !rel.startsWith(EXCLUDE_DIR))\n`, '', 'EXCLUDE_DIR 那一支') },
  { name: '排除目录写成空串（startsWith 恒真 → 候选被清空，对账静默空转）', expect: '候选清单是空的', mut: (d) => sub(d, `const EXCLUDE_DIR = 'assets/img/og/';`, `const EXCLUDE_DIR = '';`, 'EXCLUDE_DIR 置空') },
  { name: '引用扫描面少了 _posts（所有候选都成了「没人引用」）', expect: '里没有一枚被引用', mut: (d) => sub(d, `  ['_posts', (f) => f.endsWith('.md')],\n`, '', 'REF_GLOBS') },
  { name: '体积阈值降到 0（小图也进候选）', expect: '是候选却不在台账里', mut: (d) => sub(d, `const SIZE_FLOOR = 512 * 1024;`, `const SIZE_FLOOR = 0;`, 'SIZE_FLOOR') },
];

const real = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8', cwd: ROOT });
console.log(`真树基线：${(real.stdout || real.stderr || '').trim().split('\n').pop()}`);
if (real.status !== 0) {
  console.error('真树台账本身就不自洽，先把 --check 跑绿再来数牙齿。');
  process.exit(2);
}

const clean = layout();
const cleanRun = run(clean.srcDir);
console.log(`桩树基线（未注入任何变异）：exit=${cleanRun.code} ${(cleanRun.out || '').trim()}`);
if (cleanRun.code !== 0) {
  console.error('桩树基线就是红的，牙齿台账无从谈起。');
  process.exit(2);
}

let pass = 0;
const bad = [];
for (const t of TEETH) {
  const one = layout(t.mut);
  let r;
  try {
    r = run(one.srcDir);
  } catch (e) {
    bad.push(`${t.name}：跑不动 ${e.message}`);
    console.log(`✗ ${t.name}\n    ${e.message}`);
    if (!KEEP) fs.rmSync(one.dir, { recursive: true, force: true });
    continue;
  }
  let why;
  if (r.code === 0) why = '注入变异后门禁仍绿——这一支判据无牙';
  else if (!r.out.includes('image-variants')) why = `退 ${r.code} 但输出不像门禁的判词：\n${r.out.slice(0, 400)}`;
  else if (!r.out.includes(t.expect))
    why = `红了，但没点到「${t.expect}」：\n${r.out
      .split('\n')
      .filter((l) => l.includes('RED'))
      .join('\n')}`;
  if (why) bad.push(`${t.name}：${why.split('\n')[0]}`);
  else pass += 1;
  console.log(`${why ? '✗' : '✓'} ${t.name}${why ? `\n    ${why}` : ''}`);
  if (!KEEP) fs.rmSync(one.dir, { recursive: true, force: true });
}
if (!KEEP) fs.rmSync(clean.dir, { recursive: true, force: true });

console.log(`\n牙齿台账：${pass}/${TEETH.length} 刀变异如期变红`);
if (bad.length) {
  console.error(`其中 ${bad.length} 刀不合格：\n` + bad.map((b) => `  - ${b}`).join('\n'));
  process.exit(1);
}
console.log('✓ 每一刀都落在临时副本上，工作树只读；桩树的三种「不该进台账」形状（无引用 / og 目录 / 低于阈值）在基线里都没误红');
