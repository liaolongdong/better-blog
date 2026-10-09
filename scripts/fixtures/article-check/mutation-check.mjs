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
const dir = mkdtempSync('/tmp/mut-');

/** @param {string} f @return {{code:number,out:string}} */
const run = (f) => {
  const r = spawnSync('node', [CHK, f, '--manifest', MAN, '--job', 'A'], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

/** [名称, 变异函数, 预期变红的门禁名] */
const MUT = [
  ['M1 H2 换成谜题标题', (s) => s.replace('## 它解决什么痛点', '## 谁把这一刀补上了'), 'H2 名单与顺序'],
  ['M2 无来源精确数字', (s) => s.replace('## 快速上手', '它的启动耗时是 41.7ms。\n\n## 快速上手'), '数字反查 manifest'],
  ['M3 删开篇结论块', (s) => s.replace(/^> 一句话结论：.*\n^> 现在该做什么：.*\n/m, ''), '结论块行数'],
  ['M4 一级黑名单句式', (s) => s.replace('## 快速上手', '这不仅仅是转换，更是工作流的重建。\n\n## 快速上手'), '句式黑名单'],
  ['M5 表格写成 4 列', (s) => s.replace(/\| 维度 \| 它 \| 老牌那家 \|/, '| 维度 | 它 | 老牌那家 | 第四列 |'), '表格 1 尺寸'],
  ['M6 砍掉展望一节', (s) => s.replace(/^## 未来展望：什么条件下我会用它[\s\S]*?\n(?=项目地址：)/m, ''), 'H2 数'],
  ['M7 全文超 2000', (s) => s.replace('## 使用示例', '这一节被人为拉长以试长度门。'.repeat(95) + '\n\n## 使用示例'), '全文篇幅'],
  ['M8 加粗 5 处', (s) => s.replace('## 快速上手', '**甲** **乙** **丙** **丁** **戊**\n\n## 快速上手'), '加粗数'],
  ['M9 全文低于 1000', (s) => s.replace(/^## 使用示例[\s\S]*?(?=^## 和同类比)/m, ''), '全文下限'],
  ['M10 categories 多值不带方括号', (s) => s.replace('categories: [AI, 开源实测]', 'categories: AI 开源实测'), 'categories 多分类写成列表'],
  ['M11 删结尾项目地址', (s) => s.replace(/^项目地址：.*\n/m, ''), '结尾项目地址'],
  /** href 换成 manifest 里另一条真实登记过的 URL：只该触发「自洽」，不该触发「URL 反查」 */
  ['M12 项目地址换地址', (s) => s.replace(/^项目地址：\[([^\]]+)\]\([^)]*\)/m, (m, a) => `项目地址：[${a}](https://github.com/mmorett/pdf2txt/issues/318)`), '项目地址链接自洽'],
  /** 删掉站点门要求的那一枚键：9 键那格必须变红，否则「协议 §8.1 与 SP4 同形」这件事就没有牙齿守着 */
  ['M13 删 seo_description 行', (s) => s.replace(/^seo_description: .*\n/m, ''), 'frontmatter'],
];

let bad = 0;
const base = run(SRC);
console.log(`正向  合规夹具  exit=${base.code}  ${(base.out.match(/结论: .*/) || ['?'])[0]}`);
if (base.code !== 0) bad++;

for (const [name, fn, expect] of MUT) {
  const text = fn(body0);
  if (text === body0) {
    console.log(`${name}  !! 变异未改动文本 = 脚手架失灵`);
    bad++;
    continue;
  }
  /** 文件名必须合规，否则「文件名」这道无关门会先变红，掩盖真正要测的门 */
  const file = join(dir, '2026-09-27-mutation-probe.md');
  writeFileSync(file, text);
  const { code, out } = run(file);
  const delta = text.replace(/\s/g, '').length - body0.replace(/\s/g, '').length;
  const esc = expect.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const hit = new RegExp(`FAIL\\s+${esc}(\\s|：|$)`).test(out);
  const allFails = [...out.matchAll(/^FAIL\s+(\S[^\n]*?)  /gm)].map((x) => x[1]);
  if (code === 1 && hit) console.log(`${name}  变红  Δ${delta >= 0 ? '+' : ''}${delta}  因 ${expect}`);
  else (console.log(`${name}  !! 未因 ${expect} 变红（exit=${code} 命中=${hit} 实际 FAIL: ${allFails.join('、') || '无'}）`), bad++);
}
console.log(bad === 0 ? `\n结论: 正向 PASS + ${MUT.length} 项变异各自触发预期门禁` : `\n结论: ${bad} 项异常`);
process.exit(bad === 0 ? 0 : 1);
