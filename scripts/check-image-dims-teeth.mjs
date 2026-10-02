#!/usr/bin/env node
/**
 * `scripts/check-image-dims.rb` 的牙齿台账。
 *
 * 它要回答的问题只有一个：那一本 36 条断言里，每一支判据是不是真的咬得动。
 * 做法是把 `_plugins/image_dims.rb` 复制一份到临时目录、在副本上下一刀，
 * 再拿副本去跑门禁——断言三件事同时成立才算这颗牙存在：
 *   ① 退码非 0 且非 2（2 是夹具坏了，那种红不算红）；
 *   ② 输出里有 `dims: RED`（证明确实跑到了判据，不是 ruby 自己崩了）；
 *   ③ 输出里逐字出现这一刀预期点名的那条断言 id（证明红的是它，不是别的）。
 * 另外每一刀都先自证「副本的字节真的变了」，替换没命中就抛——
 * 否则那一档会退化成「注入了一刀而门禁仍绿」，把量具没咬到误诊成门禁是假牙。
 *
 * 与 `check-seo-teeth.mjs` 的分工：那一本变异的是产物与站点源（Liquid / yml / scss），
 * 这一本只变异 Ruby 滤镜自己——所有刀口都落在 `<scratch>/image_dims.rb` 这一枚副本上，
 * 工作树从头到尾只读（连 `_config.yml` 与 `scripts/image-variants.json` 都是直接读真的），
 * 所以这里不需要整树副本，一轮毫秒级。
 *
 * 用法：node scripts/check-image-dims-teeth.mjs [--root=仓库根] [--only=子串]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(process.argv.find((a) => a.startsWith('--root=')) ? process.argv.find((a) => a.startsWith('--root=')).slice(7) : process.cwd());
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const PLUGIN = path.join(ROOT, '_plugins', 'image_dims.rb');
const GATE = path.join(ROOT, 'scripts', 'check-image-dims.rb');

for (const f of [PLUGIN, GATE]) {
  if (!fs.existsSync(f)) {
    console.error(`牙齿台账跑不动：认不到 ${path.relative(ROOT, f)}（用 --root= 指到仓库根）`);
    process.exit(2);
  }
}

const SRC = fs.readFileSync(PLUGIN, 'utf8');

/** 跑一遍门禁：@param plugin [string] 被核验的那本 rb 路径 @returns {{code:number,out:string}} */
function runGate(plugin) {
  const r = spawnSync('ruby', [GATE, ROOT, plugin], { encoding: 'utf8', cwd: ROOT });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'dims-teeth-'));
const MUTANT = path.join(SCRATCH, 'image_dims.rb');

/** 在副本上下一刀：每条 [from, to] 必须真的命中，一处不命中就把副本原文抛回去重跑 */
function carve(edits) {
  let text = SRC;
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`这一刀的锚点不在滤镜里：${from.slice(0, 60)}`);
    text = text.split(from).join(to);
  }
  if (text === SRC) throw new Error('变异没改变一个字节');
  fs.writeFileSync(MUTANT, text);
}

// 每颗牙：name 是给人看的，expect 是判据 id（带尾空格，免得 S1 命中 S10/S1b）。
const TEETH = [
  { name: '换源时把 baseurl 前缀弄丢了', expect: 'RED S1 ', edits: [[`src.sub(/\\.png(?=([?#]|\\z))/i, '.webp')`, `path.sub(/\\.png\\z/, '.webp')`]] },
  { name: '换源锚定放宽成「第一处 .png」', expect: 'RED S11 ', edits: [[`sub(/\\.png(?=([?#]|\\z))/i`, `sub(/\\.png/i`]] },
  { name: 'swap 档干脆不换源了', expect: 'RED S7 ', edits: [[`        if webp\n`, `        if webp && !swap_only\n`]] },
  { name: 'swap 档开始补尺寸（postCover 的分支会翻）', expect: 'RED S7b ', edits: [[`        next tag if swap_only\n`, ``]] },
  { name: '一趟调用里每张图都领了提权', expect: 'RED S5 ', edits: [[`lcp && seen.zero? && eager`, `lcp && eager`]] },
  { name: '提权落到第二张而不是第一张', expect: 'RED S5b ', edits: [[`lcp && seen.zero? &&`, `lcp && seen == 1 &&`]] },
  { name: '提权不看已有的 loading=lazy', expect: 'RED S6 ', edits: [[`&& eager && !tag.match?(/\\bfetchpriority\\s*=/i)`, `&& !tag.match?(/\\bfetchpriority\\s*=/i)`]] },
  {
    name: '作者写过的尺寸被再补一对',
    expect: 'RED S9 ',
    edits: [
      [`&& !(has_w && has_h)`, `&& true`],
      [`unless has_w && has_h`, `unless false`],
    ],
  },
  { name: '换源时把 ?v=2 弄丢了', expect: 'RED S10 ', edits: [[`src.sub(/\\.png(?=([?#]|\\z))/i, '.webp')`, `src.split('?').first.sub(/\\.png\\z/, '.webp')`]] },
  { name: '自闭合标签补完属性变成 >', expect: 'RED S12 ', edits: [[`closed ? ' />' : '>'`, `'>'`]] },
  { name: '单引号 src 被改写成双引号', expect: 'RED S13 ', edits: [[`"src=#{m[1]}#{webp}#{m[1]}"`, `'src="' + webp + '"'`]] },
  { name: 'nil 进来不再原样回传', expect: 'RED S14 ', edits: [[`return content if content.nil? || content.empty?`, `return content.to_s if content.nil?\n      return content if content.empty?`]] },
  { name: '缺省 mode 也给首图提权', expect: 'RED S8 ', edits: [[`lcp = mode.to_s == 'lcp'`, `lcp = mode.to_s != 'swap'`]] },
  { name: '非常规 src 那道守卫整行删掉', expect: 'RED S32 ', edits: [[`      return nil if src.match?(%r{\\A(?:https?:)?//|data:|\\{\\{|\\{%|\\$\\{})\n`, ``]] },
  { name: '没有 webp 兄弟也照样换源', expect: 'RED S2 ', edits: [[`      return nil unless File.file?(webp)\n`, ``]] },
  {
    name: '顺便把 .jpg 也换源',
    expect: 'RED S2b ',
    edits: [
      [`path&.end_with?('.png')`, `path&.end_with?('.png', '.jpg')`],
      [`path.sub(/\\.png\\z/, '.webp')`, `path.sub(/\\.(?:png|jpg)\\z/, '.webp')`],
      [`src.sub(/\\.png(?=([?#]|\\z))/i, '.webp')`, `src.sub(/\\.(?:png|jpg)(?=([?#]|\\z))/i, '.webp')`],
    ],
  },
  { name: 'webp 那一支不再参与尺寸对账', expect: 'RED S4 ', edits: [[`return webp(data)  if data[0, 4] == 'RIFF' && data[8, 4] == 'WEBP'`, `return webp(data)  if false && data[8, 4] == 'WEBP'`]] },
  { name: 'PNG 宽高读到 IHDR 块头那一格', expect: 'RED D1 ', edits: [[`w = data[16, 4]&.unpack1('N')`, `w = data[12, 4]&.unpack1('N')`]] },
  { name: 'GIF 按大端读小端字段', expect: 'RED D2 ', edits: [[`w = data[6, 2]&.unpack1('v')`, `w = data[6, 2]&.unpack1('n')`]] },
  { name: 'BMP 负高不取绝对值（自上而下行序被判成坏文件）', expect: 'RED D3 ', edits: [[`        h = h.abs\n`, ``]] },
  { name: 'JPEG 把先高后宽读成先宽后高', expect: 'RED D4 ', edits: [[`return w && h && w > 0 && h > 0 ? [w, h] : nil`, `return w && h && w > 0 && h > 0 ? [h, w] : nil`]] },
  { name: 'WebP VP8X 忘了画布字段是「尺寸减一」', expect: 'RED D5 ', edits: [[`w && h ? [w + 1, h + 1] : nil`, `w && h ? [w, h] : nil`]] },
  { name: 'WebP VP8L 的高位偏移写错', expect: 'RED D6 ', edits: [[`((bits >> 14) & 0x3FFF)`, `((bits >> 16) & 0x3FFF)`]] },
  { name: 'WebP 有损关键帧没掩掉那 2 位缩放位', expect: 'RED D7 ', edits: [[`w && h ? [w & 0x3FFF, h & 0x3FFF] : nil`, `w && h ? [w, h] : nil`]] },
  { name: 'SVG 无视 width/height 属性', expect: 'RED D8 ', edits: [[`        return [w.to_f.round, h.to_f.round] if w && h && w.to_f > 0 && h.to_f > 0\n`, ``]] },
  {
    name: 'SVG 的 viewBox 退路又退回「拿整段命中串当 MatchData 索引」',
    expect: 'RED D9 ',
    edits: [
      [`vw = box[1].to_f`, `vw = box[3].to_f`],
      [`vh = box[2].to_f`, `vh = box[4].to_f`],
    ],
  },
  { name: '认不出的格式猜一个尺寸而不是回 nil', expect: 'RED D10 ', edits: [[`        return svg(data)   if abs_path.end_with?('.svg') || data[0, 5] == '<?xml'\n        nil`, `        return svg(data)   if abs_path.end_with?('.svg') || data[0, 5] == '<?xml'\n        [0, 0]`]] },
];

const base = runGate(PLUGIN);
if (base.code !== 0) {
  console.error(`基线就是红的，牙齿台账无从谈起：\n${base.out}`);
  process.exit(2);
}
console.log(`副本就绪（${SCRATCH}）；基线（未注入任何变异）：exit=0`);
console.log(base.out.trim().split('\n').pop());

let pass = 0;
const problems = [];
for (const t of TEETH) {
  if (ONLY && !t.name.includes(ONLY) && !t.expect.includes(ONLY)) continue;
  let why;
  try {
    carve(t.edits);
  } catch (e) {
    problems.push(`${t.name}：${e.message}`);
    console.log(`✗ ${t.name}\n    ${e.message}`);
    continue;
  }
  const r = runGate(MUTANT);
  if (r.code === 2) why = `门禁退 2（夹具坏了），这一刀让判据整块没跑：\n${r.out}`;
  else if (r.code === 0) why = '注入变异后门禁仍绿——这一支判据无牙';
  else if (!r.out.includes('dims: RED')) why = `退 ${r.code} 但输出里没有 dims: RED，不像判据红：\n${r.out.slice(0, 400)}`;
  else if (!r.out.includes(t.expect))
    why = `红了，但没点到 ${t.expect.trim()}：\n${r.out
      .split('\n')
      .filter((l) => l.includes('dims: RED'))
      .join('\n')}`;
  else if (!r.out.includes('跑了 36/36'))
    why = `红得不对：断言计数没跑满 36，说明这一刀跳过了某一块\n${r.out
      .split('\n')
      .filter((l) => l.includes('---'))
      .join('\n')}`;
  if (why) problems.push(`${t.name}：${why.split('\n')[0]}`);
  else pass += 1;
  console.log(`${why ? '✗' : '✓'} ${t.name}${why ? `\n    ${why}` : ''}`);
}

fs.rmSync(SCRATCH, { recursive: true, force: true });
const again = runGate(PLUGIN);
if (again.code !== 0) {
  console.error(`跑完牙齿后基线复跑不绿（工作树只读，这一定是别处坏了）：\n${again.out}`);
  process.exit(2);
}

console.log(`\n牙齿台账：${pass}/${TEETH.length} 刀变异如期变红`);
if (problems.length) {
  console.error(`其中 ${problems.length} 刀不合格：\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('✓ 每一刀都在临时副本上，工作树一字未动；复跑基线仍绿');
