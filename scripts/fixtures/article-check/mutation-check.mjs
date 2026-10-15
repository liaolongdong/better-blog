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
/** 比对样本钉死在本目录的 `history/`（3 枚桩稿），不跟仓库 `_posts` 漂移——
 *  否则别人发一篇稿，M25/M26 这两条复用类变异就会换一批靶子。 */
const HIST = join(here, 'history');

/** @param {string} f @param {string} [man] @return {{code:number,out:string}} */
const run = (f, man = MAN) => {
  const r = spawnSync('node', [CHK, f, '--manifest', man, '--job', 'A'], { encoding: 'utf8', env: { ...process.env, ARTICLE_CHECK_HISTORY: HIST } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

/** [名称, 变异函数, 预期变红的门禁名, 可选：manifest 变异函数] */
const MUT = [
  ['M1 节名换成可移植空名', (s) => s.replace('## 8192 不是它压出来的，是页数先被折成预算', '## 它为什么值得看一眼').replace('## 退码 137 的那次 300 页合并件，412 字符的便宜我没占到', '## 和同类比谁强'), 'H2 带具体物'],
  ['M2 无来源精确数字', (s) => s.replace('## 装完直接指一个 pdf，0.9 秒出结果', '它的启动耗时是 41.7ms。\n\n## 装完直接指一个 pdf，0.9 秒出结果'), '数字反查 manifest'],
  ['M3 删开篇结论块', (s) => s.replace(/^> 一句话结论：.*\n^> 现在该做什么：.*\n/m, ''), '结论块行数'],
  ['M4 一级黑名单句式', (s) => s.replace('## 装完直接指一个 pdf，0.9 秒出结果', '这不仅仅是转换，更是工作流的重建。\n\n## 装完直接指一个 pdf，0.9 秒出结果'), '句式黑名单'],
  ['M5 表格写成 5 列', (s) => s.replace(/\| 维度 \| 它 \| 老牌那家 \|/, '| 维度 | 它 | 老牌那家 | 第四列 | 第五列 |'), '表格 1 尺寸'],
  ['M6 砍到只剩 2 节', (s) => s.replace(/^## 装完直接指一个 pdf[\s\S]*?(?=^## 如果 --pages)/m, ''), 'H2 数'],
  ['M7 全文超 4500', (s) => s.replace('## 如果 --pages', '这一节被人为拉长以试长度门。'.repeat(240) + '\n\n## 如果 --pages'), '全文篇幅'],
  ['M8 加粗 7 处', (s) => s.replace('## 装完直接指一个 pdf，0.9 秒出结果', '**甲** **乙** **丙** **丁** **戊** **己** **庚**\n\n## 装完直接指一个 pdf，0.9 秒出结果'), '加粗数'],
  ['M9 全文低于 1500', (s) => s.replace(/^## 我手上那份[\s\S]*?(?=^## 如果 --pages)/m, ''), '全文下限'],
  ['M10 categories 多值不带方括号', (s) => s.replace('categories: [AI, 开源实测]', 'categories: AI 开源实测'), 'categories 多分类写成列表'],
  ['M11 删结尾项目地址', (s) => s.replace(/^项目地址：.*\n/m, ''), '结尾项目地址'],
  /** href 换成 manifest 里另一条真实登记过的 URL：只该触发「自洽」，不该触发「URL 反查」 */
  ['M12 项目地址换地址', (s) => s.replace(/^项目地址：\[([^\]]+)\]\([^)]*\)/m, (m, a) => `项目地址：[${a}](https://github.com/mmorett/pdf2txt/issues/318)`), '项目地址链接自洽'],
  /** 删掉站点门要求的那一枚键：9 键那格必须变红，否则「协议 §8.1 与 SP4 同形」这件事就没有牙齿守着 */
  ['M13 删 seo_description 行', (s) => s.replace(/^seo_description: .*\n/m, ''), 'frontmatter'],
  ['M14 节名超 30 字', (s) => s.replace('## 装完直接指一个 pdf，0.9 秒出结果', '## ' + '这一枚节名被人为拉长到超出协议给整枚节名的格数上限以外'.repeat(2)), 'H2 形状'],
  ['M15 节名写成疑问句', (s) => s.replace('## 退码 137 的那次 300 页合并件，412 字符的便宜我没占到', '## 退码 137 那次到底会不会崩？'), 'H2 形状'],
  ['M16 节名用标题腔', (s) => s.replace('## 8192 不是它压出来的，是页数先被折成预算', '## 一文说清它到底省不省 token'), 'H2 形状'],
  ['M17 节名带 emoji', (s) => s.replace('## 装完直接指一个 pdf，0.9 秒出结果', '## 🚀 装完直接指一个 pdf，0.9 秒出结果'), 'H2 无 emoji'],
  /** M18–M19 抓协议 §4.5.0「第一眼」：窄屏卡片第一行 21 个汉字位（实测 460px / 22px / 单字 21.81px），
   *  标题不截断，所以前半折行 = 第一眼只剩一串名词。frontmatter 与正文 H1 必须同时改，
   *  否则先红的是「H1 与 title 一致」那道无关门。 */
  ['M18 标题没有后半', (s) => s.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份 24 页的扫描件吐给我 8192 个字符'), '标题二段式'],
  ['M19 标题前半超窄屏第一行', (s) => s.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份 24 页的双栏扫描合同我拿它跑了三遍才看清，版式全丢'), '标题前半屏宽'],
  ['M20 候选只剩 2 行', (s) => s, '标题候选落盘', (m) => m.replace(/^候选 0[345].*\n/gm, '')],
  ['M21 五候选同一类形状', (s) => s, '标题候选落盘', (m) => m.replace(/〈[^〉]+〉/g, '〈反差数字式〉')],
  ['M22 没有选用行', (s) => s, '标题候选落盘', (m) => m.replace(/^选用 = .*\n/m, '')],
  ['M23 没有淘汰理由', (s) => s, '标题候选落盘', (m) => m.replace(/^淘汰 = .*\n/m, '')],
  ['M24 选用不等于正文标题', (s) => s, '标题候选落盘', (m) => m.replace(/^候选 01 .*$/m, '候选 01 〈反差数字式〉 一个完全不同的标题全文')],
  ['M25 复用上一篇文章的节名', (s) => s.replace('## 如果 --pages 在 v1.0 前定稿，我就把它换进日报流程', '## 背景：它为什么出现'), '无跨篇复用行'],
  ['M26 复用上一篇文章的整句', (s) => s.replace('300 页那次只跑了一遍，剩下的我没测：', '我第一遍就没切，白折腾一趟。\n\n300 页那次只跑了一遍，剩下的我没测：'), '无跨篇复用行'],
  ['M27 首句不接住上一节的具体物', (s) => s.replace('跑完 stdout 是 8192 个字符，24 页每页前面还多一行页码。', '这类工具的定位还要再看几个版本。').replace('## 退码 137 的那次 300 页合并件，412 字符的便宜我没占到', '## 换大文件我就吃了另一个亏'), '节间承接'],
  ['M28 全篇没有边界自陈', (s) => s.replace('300 页那次只跑了一遍，剩下的我没测：换台机器、换个 node 版本是什么读数，我没验到。', '300 页那次跑过了，换台机器、换个 node 版本也是同样结论。'), '边界在场'],
  ['M29 句尾分析尾巴', (s) => s.replace('我会留它，但不进 CI。', '我会留着它，从而为长期可用性提供了保障。'), '句尾分析尾巴'],
  ['M30 并列整齐病', (s) => s.replace('\n\n跑完 stdout 是', '\n\n- 装得快\n- 跑得稳\n- 输出小\n\n这一段替上面三个列表收尾。\n\n- 页码少一行\n- 噪声少一层\n- 上下文少一截\n\n- 装得快\n- 跑得稳\n- 报错少\n\n跑完 stdout 是'), '并列整齐病'],
  ['M31 全文只剩 2 张图', (s) => s.replace('\n![它把双栏合同的左右顺序读串的那一步](/assets/img/pdf2txt-fixture/02-diagram-two-column-flow.webp)\n', '\n'), '插图下限'],
  ['M32 没有真实截图', (s) => s.replaceAll('01-screenshot-first-run.webp', '01-diagram-first-run.webp'), '真实截图在场'],
  ['M33 标题没有具体物', (s) => s.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份扫描件的转换，我读了两遍才看清'), '标题含具体物', (m) => m.replaceAll('一份 24 页的扫描件，它吐给我 8192 个字符', '一份扫描件的转换，我读了两遍才看清')],
  /** M34 补 §7.7 第 5 条的门牙：Task 8 三条形状门里只有 `节内自我复述` 没进变异集，
   *  10-13 反证时它因「首末句共享 impeccable 专名」假红才暴露了这个洞。
   *  把「装完」节末句换成首句的中文换说法（剔掉代码/链接/专名后中文 3-gram 重合 ≥40%）。 */
  ['M34 节内自我复述', (s) => s.replace(/那 24 行是噪声[\s\S]*?这种前缀。/, '跑出来的是 8192 个字符，每页前面都多一行页码。'), '节内自我复述'],
];

let bad = 0;
const base = run(SRC);
console.log(`正向  合规夹具  exit=${base.code}  ${(base.out.match(/结论: .*/) || ['?'])[0]}`);
if (base.code !== 0) bad++;

for (const [name, fn, expect, manFn] of MUT) {
  const text = fn(body0);
  /** 只改 manifest 的变异（M20–M24）正文本来就该原样，此时「文本未变」不是失灵。 */
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
