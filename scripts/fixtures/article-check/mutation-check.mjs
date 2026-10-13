#!/usr/bin/env node
/**
 * 守卫自证（协议 §10.1）：正向合规夹具必须 PASS；每条注入变异必须**因它该触发的那道门**变红。
 *
 * 两条防「脚手架自己静默失灵」的硬断言：
 *   ① 变异必须真的改动文本（replace 未命中 = 假绿）；
 *   ② FAIL 行里必须出现预期的那道门禁名——只认 exit=1 会被「文件名不合规」这类无关门掩盖
 *      （2026-09-27 第一版就被这样掩盖过一整轮）。
 *
 * 用法：node scripts/fixtures/article-check/mutation-check.mjs
 * 改 scripts/article-check.mjs 之后必须重跑本文件。
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '2026-09-27-pdf2txt-fixture.md');
const MAN = join(here, 'manifest.md');
const CHK = join(here, '..', '..', 'article-check.mjs');
const body0 = readFileSync(SRC, 'utf8');
const man0 = readFileSync(MAN, 'utf8');
const dir = mkdtempSync('/tmp/mut-');

/** @param {string} f @param {string} [man] @return {{code:number,out:string}} */
const run = (f, man = MAN) => {
  const r = spawnSync('node', [CHK, f, '--manifest', man, '--job', 'A'], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

/** [名称, 变异函数, 预期变红的门禁名, 可选：manifest 变异函数] */
const MUT = [
  /** M1 抓的是协议 §7.5 那类「H2 写成谜题标题」。v3.1 之后角色词仍逐字锁死，所以这一条仍然变红。 */
  ['M1 H2 换成谜题标题', (s) => s.replace('## 它解决什么痛点', '## 谁把这一刀补上了'), 'H2 角色词与顺序'],
  ['M2 无来源精确数字', (s) => s.replace('## 快速上手', '它的启动耗时是 41.7ms。\n\n## 快速上手'), '数字反查 manifest'],
  ['M3 删开篇结论块', (s) => s.replace(/^> 一句话结论：.*\n^> 现在该做什么：.*\n/m, ''), '结论块行数'],
  ['M4 一级黑名单句式', (s) => s.replace('## 快速上手', '这不仅仅是转换，更是工作流的重建。\n\n## 快速上手'), '句式黑名单'],
  ['M5 表格写成 4 列', (s) => s.replace(/\| 维度 \| 它 \| 老牌那家 \|/, '| 维度 | 它 | 老牌那家 | 第四列 |'), '表格 1 尺寸'],
  ['M6 砍掉展望一节', (s) => s.replace(/^## 未来展望：什么条件下我会用它[\s\S]*?\n(?=项目地址：)/m, ''), 'H2 数'],
  ['M7 全文超 2400', (s) => s.replace('## 使用示例', '这一节被人为拉长以试长度门。'.repeat(130) + '\n\n## 使用示例'), '全文篇幅'],
  ['M8 加粗 5 处', (s) => s.replace('## 快速上手', '**甲** **乙** **丙** **丁** **戊**\n\n## 快速上手'), '加粗数'],
  ['M9 全文低于 1000', (s) => s.replace(/^## 使用示例[\s\S]*?(?=^## 和同类比)/m, ''), '全文下限'],
  ['M10 categories 多值不带方括号', (s) => s.replace('categories: [AI, 开源实测]', 'categories: AI 开源实测'), 'categories 多分类写成列表'],
  ['M11 删结尾项目地址', (s) => s.replace(/^项目地址：.*\n/m, ''), '结尾项目地址'],
  /** href 换成 manifest 里另一条真实登记过的 URL：只该触发「自洽」，不该触发「URL 反查」 */
  ['M12 项目地址换地址', (s) => s.replace(/^项目地址：\[([^\]]+)\]\([^)]*\)/m, (m, a) => `项目地址：[${a}](https://github.com/mmorett/pdf2txt/issues/318)`), '项目地址链接自洽'],
  /** 删掉站点门要求的那一枚键：9 键那格必须变红，否则「协议 §8.1 与 SP4 同形」这件事就没有牙齿守着 */
  ['M13 删 seo_description 行', (s) => s.replace(/^seo_description: .*\n/m, ''), 'frontmatter'],
  /** v3.1 的 H2 新牙齿：角色词之外那半句要有格数、不许悬念式提问、不许标题腔。三条各咬一次。 */
  ['M14 H2 退回裸角色词', (s) => s.replace('## 快速上手：装完直接指一个 pdf', '## 快速上手'), 'H2 自拟半句'],
  ['M15 H2 半句写成疑问句', (s) => s.replace('## 使用示例：两份并排会串行', '## 使用示例：到底会不会串行？'), 'H2 自拟半句'],
  ['M16 H2 半句超 20 字', (s) => s.replace('## 背景：它为什么出现', '## 背景：这一句被人为拉长到超过协议给那半句的格数上限以外'), 'H2 自拟半句'],
  ['M17 H2 半句用标题腔', (s) => s.replace('## 和同类比：强在哪、差在哪', '## 和同类比：一文说清差别'), 'H2 自拟半句'],
  /** M18–M19 抓协议 §4.5.0「第一眼」：窄屏卡片第一行 21 个汉字位（实测 460px / 22px / 单字 21.81px），
   *  标题不截断，所以前半折行 = 第一眼只剩一串名词。frontmatter 与正文 H1 必须同时改，
   *  否则先红的是「H1 与 title 一致」那道无关门。 */
  ['M18 标题没有后半', (s) => s.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份 24 页的扫描件吐给我 8192 个字符'), '标题二段式'],
  ['M19 标题前半超窄屏第一行', (s) => s.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份 24 页的双栏扫描合同我拿它跑了三遍才看清，版式全丢'), '标题前半屏宽'],
  /** M20–M22 抓 §4.5.2 五候选落盘的三个判据各一头：行数、类型多样性、选用行。 */
  ['M20 候选只剩 2 行', (s) => s, '标题候选落盘', (m) => m.replace(/^候选 0[345].*\n/gm, '')],
  ['M21 五候选同一类钩子', (s) => s, '标题候选落盘', (m) => m.replace(/〈[^〉]+〉/g, '〈缺口式〉')],
    ['M22 没有选用行', (s) => s, '标题候选落盘', (m) => m.replace(/^选用 = .*\n/m, '')],
  /** M23–M24 抓「打分走过场」：真实四篇 evidence 里每一条候选都是满分 6/6，等于没打。 */
  ['M23 五条候选全满分', (s) => s, '标题候选落盘', (m) => m.replace(/缺口 \d 后果 \d 易懂 \d 前半 \d/g, '缺口 2 后果 2 易懂 2 前半 2')],
  ['M24 选用的不是最高分', (s) => s, '标题候选落盘', (m) => m.replace(/^选用 = 01.*$/m, '选用 = 05（总分 4）')],
];

let bad = 0;
const base = run(SRC);
console.log(`正向  合规夹具  exit=${base.code}  ${(base.out.match(/结论: .*/) || ['?'])[0]}`);
if (base.code !== 0) bad++;

for (const [name, fn, expect, manFn] of MUT) {
  const text = fn(body0);
  /** 只改 manifest 的变异（M20–M22）正文本来就该原样，此时「文本未变」不是失灵。 */
  if (text === body0 && !manFn) {
    console.log(`${name}  !! 变异未改动文本 = 脚手架失灵`);
    bad++;
    continue;
  }
  /** 文件名必须合规，否则「文件名」这道无关门会先变红，掩盖真正要测的门 */
  const file = join(dir, '2026-09-27-mutation-probe.md');
  writeFileSync(file, text);
  let manArg = MAN;
  if (manFn) {
    const manText = manFn(man0);
    if (manText === man0) {
      console.log(`${name}  !! 变异未改动 manifest = 脚手架失灵`);
      bad++;
      continue;
    }
    manArg = join(dir, 'manifest-probe.md');
    writeFileSync(manArg, manText);
  }
  const { code, out } = run(file, manArg);
  const delta = text.replace(/\s/g, '').length - body0.replace(/\s/g, '').length;
  const esc = expect.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const hit = new RegExp(`FAIL\\s+${esc}(\\s|：|$)`).test(out);
  const allFails = [...out.matchAll(/^FAIL\s+(\S[^\n]*?)  /gm)].map((x) => x[1]);
  if (code === 1 && hit) console.log(`${name}  变红  Δ${delta >= 0 ? '+' : ''}${delta}  因 ${expect}`);
  else (console.log(`${name}  !! 未因 ${expect} 变红（exit=${code} 命中=${hit} 实际 FAIL: ${allFails.join('、') || '无'}）`), bad++);
}
console.log(bad === 0 ? `\n结论: 正向 PASS + ${MUT.length} 项变异各自触发预期门禁` : `\n结论: ${bad} 项异常`);
process.exit(bad === 0 ? 0 : 1);
