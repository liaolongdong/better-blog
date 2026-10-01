#!/usr/bin/env node
/**
 * 在线工具页的算法与数据判据（Node 22 内置 test runner；无新增依赖、不联网、不需要 DOM）。
 *
 * "不联网"的准确口径：全部用例只碰 127.0.0.1，且 A10/A11 在跑之前先把生成器副本里的
 * 上游 URL 换掉（A10 指向一个没人听信的端口，A11 指向本文件自己起的临时服务器）。
 * 换没换成由 rewriteUpstreamUrls 数命中条数钉住的——replace 匹配不到时静默返回原串，
 * 实测那样做 A10 会"因为 DNS 挂了"而假绿。
 * 仓库里的 scripts/fixtures/region-source/ 与产物一份都不写：A7–A11 全在 tmpdir 副本上跑，
 * 每条用例结尾都比对"仓库快照与产物的字节没被动过"——A7/A8/A9 那三条由两个 helper
 * （runGeneratorOn / importRegionWithPatchedSource）逐条兜，A10/A11 另外自己点名断言。
 *
 * 运行：
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs
 * 判断成败看退出码，不要用 `| tail` 之后的 $?（管道会吞退出码）。
 *
 * 用例分布（后续每段往这个文件里加，不另起测试入口。2026-09-29 整表重算：段 2 落了
 * §E0/§F0/§F–§J、段 3 又叠了 §K–§R，这张表原来只写到 §E「后续段追加」，已经过期三个段）：
 *   §A 区划码表 12 —— 生成物结构与六档回落（§2.2 / §5.4）；A7–A11 另测生成侧的输入闸门
 *                （`assertShape` 那四道在内）与读侧载入自检有没有牙，A12 测六个读入口的入参口径是否还是同一套
 *   §B 身份证 15 —— 校验位、三态、解码、生成、与站内旧库对拍（§2.2 / §5.1）
 *   §C 统一代码 9 —— 31 字符集、两套权重、双校验位自洽（§2.2 / §5.1）；C9 另测入参闸门
 *                与批量入口的空文本那一格是否和 §B 同档（两个模块逐格对照，不许分叉）
 *   §D 面板框架 5 —— ARIA、roving tabindex、hash、方向键（§6.3）
 *   §E0 银行卡码表数据形状 4 / §F0 号段数据形状 1 —— 快照 → 生成物那一步的字节与结构闸门
 *   §E 银行卡 23 / §F 手机号 15 —— Luhn 判定与运营商号段归属
 *   §G 随机合成数据 15 —— 种子化姓名·地址·邮箱的可复现合成
 *   §H 视图层 16 —— `view.js` 的纯字符串渲染；§I 面板 DOM 绑定 16 —— 手写假 DOM 上的 `panel-dom.js`
 *   §J 证件页装配层与入口 16 —— `tools/workbench.js` / `toolkitCore.js` / `toolIdcard.js`
 *   §K 时间戳 ⇄ 日期换算 18 / §L Base64（UTF-8）与 URL 编解码 20 / §M 摘要算法 18 /
 *   §N 正则测试 20 / §O 复制三件套抽离 13 —— 编码页的纯逻辑与公共件（段 3 Task 1–5）
 *   §Q 编码页视图层 16 / §R 编码页装配层与入口 16 —— `codecView.js`（Task 6a）与
 *                `codecWorkbench.js` / `toolCodec.js`（Task 6b）
 *   §U 内置件与三对互转 18 —— 前五条（U1–U5）钉 vendored `js-yaml` 进仓库那一步（段 4 Task 1），
 *                后十三条（U6–U18）跟着 `json-convert.js` 落在同一节末尾，节名不另起（段 4 Task 4）
 *   §S JSON 核心 21 —— `json-core.js` 的解析、行列定位、格式化、排序、Pointer（段 4 Task 2）；
 *                S21 是段 4 Task 6 评审回合补的一刀（`stringifyJson` 与 `formatJson` 共用同一只 serialize）
 *   §T interface 生成 10 —— `json-ts.js`：从样本推断 TS 类型的那一族口径（段 4 Task 3）
 *   §V 树拍平与只渲染可视行 19 —— `json-tree.js`：V2–V13 在 plain array 上钉行集形状，
 *                V14–V16 在自建假 DOM 上钉「只渲染可视」那四条外部证据，V17–V18 是 Task 5
 *                评审回合补的两刀（选项袋的形状尺、浏览器替自写 scrollTop 补发的那一次 scroll），
 *                V19 是 Task 6 评审回合补的一刀（`renderRow` 那一格：给了就只叫它）
 *   §W JSON 工作台视图层与装配层 27 —— `jsonView.js` / `jsonWorkbench.js` / `toolJson.js`（段 4 Task 6）：
 *                W1–W18 立那六条红线，W19–W27 是同一 Task 的评审回合补的九判（八枚 helper 的产出
 *                字面量、十二枚动作逐个按一遍、树的点击代理、下载、存储一碰就抛、两枚复制、
 *                树的化石、代价说明上页、读条只取窗口）
 *   §X 行级与 token 级对齐引擎 29 —— `diff-core.js`：最短性（与朴素 LCS 对拍）、降级、归一化只进判等、
 *                CRLF 与末行换行、行内 token 与预算、配对与五个统计量、unified 与折叠（段 5 Task 2）
 *   §Y JSON 感知比对 18 —— `diff-json.js`：与 `json-core` 的**对拍**（Y1，三件同结论）、键顺序无关、
 *                类型变化单列、Pointer 同规则、预览截断不切代理对、数组按索引、两个预算闸门（段 5 Task 3）
 *   §Z 对比页视图层与装配层 29 —— 前半 `diffView.js` 12 判（零 import 与前缀派生 Z1、Z3，两栏行数相等 Z4，
 *                行内高亮各半边 Z5，CRLF 符号与折叠条同源 Z6、Z7，转义与属性位 Z8、Z9，JSON 表六列与
 *                代价说明同屏 Z10，坏输入一句话 Z11，读数与结论的词表 Z12）；后半 Task 5 续写的 16 判
 *                钉 `diffWorkbench.js` / `toolDiff.js`：import 面与 reach 唯一（Z13）、装配层零环境词
 *                与那一处 `innerHTML`（Z14）、入口那八件各恰好一处（Z15）、id 只由 spec 派生（Z16）、
 *                三栏 nodes 与十四枚动作的名单（Z17）、挂载期零计算（Z18）、复制与下载同字（Z19）、
 *                两档布局共一份行流（Z20）、折叠四档单一口径（Z21）、跳转与钳位（Z22）、
 *                交换/恢复默认/清空（Z23）、归一化只进判等（Z24）、JSON 档整屏（Z25）、
 *                两类失败分两条路（Z26）、文件读手的拒读时机（Z27）、换前缀整页自证（Z28）；
 *                Task 6 补 Z29（折叠条那枚按钮真的能点开，且点开的就是「全部展开」）。
 *                **节名不另起，先例是 §U**——另起一节会让下面那张表少算一格
 *   合计 439。**段序里没有 §P**：那一格从来没落地过（不是"后来删掉了"），编码页从 §O 直接跳到 §Q。
 *   这张表不许手抄，重算口径固定为「按行首 `^test(` 数每段条数」：
 *     awk '/^\/\/ ── §/{if(s)print s": "n; s=$3; n=0} /^test\(/{n++} END{if(s)print s": "n}' scripts/toolkit-tests.mjs
 *   （§A 有两道横幅，各 6 条，合计 12 —— 第二条是 Task 8 那批闸门。）
 *   条数合计必须等于 runner 汇总行 `# tests N`；不等就是这张表过期了，**改表而不是改口径**。
 *
 * 关于 §C 的真实样本：设计文档 §11 要求"≥5 条可公开核实的真实码"，实际只拿到
 * GB 32100-2015 的标准示例 1 条——凭记忆写的 4 条候选码有 3 条校验位不通，故不收录。
 * 该缺口由 C8 显式记录为"未充分验证"，不许悄悄当成已过。
 *
 * 两个环境口径，都是踩过的坑：
 *   看到 `bad option: --disable-warning` 或 `exit=9` 是环境错——本机 /usr/local/bin/node 是 v16 残留，
 *   别把它当判据红；先 `node -v` 确认 v22。跑 node 命令时不要把 /usr/local/bin 排在 PATH 前面。
 *   必须显式传本文件路径：裸 `node --test` 匹配不到 toolkit-tests.mjs 这个文件名，实测静默报 0 条且退出码 0。
 *
 * 本文件刻意保持"平铺 test()"、不用 describe/suite：Task 8 的变异判据按行首 `^not ok <用例名>` 锚定，
 * 而 suite 形状下失败用例的 not ok 行是缩进的（实测 `    not ok 2 - A2`），行首锚定只会看到 §A/§B 这种
 * 组名，点名不到具体该红的判据。
 *
 * "某段模块还没落地"这一档的红**不长成上面那种形状**，2026-09-26 在 /tmp 镜像里把
 * `dev/js/tools/panel.js` 移走复跑实测：红的是**文件级**那一行 `not ok 1 - scripts/toolkit-tests.mjs`
 * （`# tests 37 / # pass 36 / # fail 1`），排在缺失那次 `await import()` **之前**注册的 36 条照跑照绿。
 * 也就是说红阶段看不到 `not ok D1 …` 这样的行——Task 8 若要判"模块还没实现所以该红"，
 * 只能锚文件名加报错正文里的模块路径（`ERR_MODULE_NOT_FOUND: Cannot find module '…/panel.js'`），
 * 按 `^not ok <用例名>` 去点名会点名不到，那不是判据没牙，是锚错了层。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { execFileSync, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const execFileAsync = promisify(execFile);

/** 固定"今天"，让年龄与日期上限类判据可复现。必须是字符串：idcard 的 toDay() 对 Date
 *  走本地分量，`new Date(Date.UTC(2026,8,25))` 在 TZ=America/Los_Angeles 下是 09-24，
 *  而 §B 里另一批用例直接传 '2026-09-25'——两种基准会随跑测试的时区翻脸。 */
const TODAY = '2026-09-25';

// ── §A 区划码表 ────────────────────────────────────────────────────────────

const { REGION_META, resolveRegion, provinceCodes, currentCityCodes,
  currentCountyCodes, historicalCodes, isGeneratable, provinceName, cityName }
  = await import('../dev/js/tools/region.js');

test('A1 元信息里的条数与数据截止日（快照实读值）', () => {
  assert.deepEqual(REGION_META.counts, {
    provinces: 31, cities: 342, counties: 2978, historical: 1229, legacyTotal: 3465,
  });
  assert.equal(REGION_META.datasetVersion, '2022-10-31', '现行层必须带数据截止日');
  // 旧表命中现行的条数 + 历史层条数 == 旧表总条数：两层设计的自检等式
  assert.equal(REGION_META.counts.legacyTotal - REGION_META.counts.historical, 2236);
});

test('A2 三级表条数与元信息吻合，码唯一，历史层可分级', () => {
  assert.equal(provinceCodes().length, REGION_META.counts.provinces);
  assert.equal(currentCityCodes().length, REGION_META.counts.cities);
  assert.equal(currentCountyCodes().length, REGION_META.counts.counties);
  assert.equal(historicalCodes().length, REGION_META.counts.historical);
  assert.equal(new Set(currentCountyCodes()).size, currentCountyCodes().length, '县级码重复');
  assert.equal(new Set(historicalCodes()).size, historicalCodes().length, '历史码重复');
  // 三层形态都要进对照集：只放县级 + 市级+'00' 的话，快照一旦带出历史省级码就静默漏判
  const cur = new Set([...currentCountyCodes(),
    ...currentCityCodes().map((c) => `${c}00`), ...provinceCodes().map((p) => `${p}0000`)]);
  for (const code of historicalCodes()) assert.equal(cur.has(code), false, `${code} 同时出现在两层`);
  assert.deepEqual(REGION_META.historicalLevels, { county: 1159, city: 70 });
});

test('A3 产物体积在预算内（gzip ≤ 36KB，设计文档 §7）', () => {
  const gz = gzipSync(Buffer.from(read('dev/js/tools/region-data.js'))).length;
  // 实测同一份字节（2026-09-25，100,020B 原文 / 34,807B gzip）：level 6→9 差 194B（34,613B），
  // 这就是 36KB 预算吸收的全部压缩器抖动。它吸收不了 strategy：Z_FILTERED 在默认 level 下是
  // 37,082B，比 36,864B 的预算高 218B，真出现那种 zlib 参数就应当红着（level 9 + Z_FILTERED 是
  // 36,843B，勉强过）。
  // 抬预算不等于放宽口径。"退回朴素 JSON.stringify 会不会红"这句必须连着构造一起给，
  // 因为反解回行对象的写法有好几种，字节随构造浮动：只让 counties 多带一个 provinceCode，
  // 原文就从 262,233B 涨到 321,793B，而 L6 只从 47,559B 涨到 49,510B——涨的是重复键名，
  // gzip 压掉了大半。上一版抄在这里的 260,533B / 47,443B / 44,425B 正是栽在这上面：把那三个
  // 数的候选写法摊成网格复算（四表各自的列集与键序 × 历史层五种取法 × 四种包裹方式，320 格），
  // 最接近的原文只有 262,183B，那一版压根没有对应构造，已删。
  // 下面两版是照着构造跑得出来的（输入 = scripts/fixtures/region-source/ 的四份快照，
  // 历史层走生成器 build() 里 curCounty/curCity/curProv 三个 Set 那道按层级查现行的判据，
  // 得 1,229 条 = 1,159 县 + 70 市）：
  //   单对象 {provinces,cities,counties,historical}，行形状 provinces{code,name} /
  //     cities{code,provinceCode,name} / counties{code,cityCode,name} / historical{code,name}
  //     —— 262,233B 原文 / 47,559B(L6) / 44,578B(L9)
  //   同形状但快照原样 stringify（counties 连 provinceCode 一起带上、键序按快照、
  //     历史层是 3,465 条全量）—— 451,217B / 66,821B / 62,819B
  // 但"朴素编码必超预算"是半句假话：第一版只去掉历史层剩三表是 189,401B / 34,475B /
  // 32,309B，朴素编码照样过得了预算。超的量具体出在那 1,229 条历史码上（同构造下朴素口径
  // 多 13,084B gzip）。所以这条判据咬的是"编码退回朴素 **且** 数据仍然带着历史层"这一整件
  // 事，不是单独一种口径变化——想让它红，砍历史层或换编码方式都只挪动一半。
  assert.ok(gz <= 36 * 1024, `区划表 gzip ${(gz / 1024).toFixed(1)}KB 超预算`);
});

test('A4 生成物是确定性字节：重跑 --check 必须说一致', () => {
  // 用 process.execPath 而不是字面量 'node'：本机 /usr/local/bin/node 是 v16 残留，
  // 谁把 PATH 顺序改一下，生成器就会被 Node 16 执行，报出的 bad option 会被误读成生成器的 bug。
  const out = execFileSync(process.execPath, ['scripts/build-region-data.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  // 必须是「与快照一致」而不是「一致」：后者是前者的子串，"不一致"也能匹配上，等于没闸
  assert.match(out, /与快照一致/);
  assert.doesNotMatch(out, /不一致/);
});

test('A5 六档回落链每一档的结论（样本全部 2026-09-25 实读自快照）', () => {
  const a = resolveRegion('110101');
  assert.deepEqual({ status: a.status, level: a.level, fullName: a.fullName },
    { status: 'current', level: 'county', fullName: '北京市东城区' });

  // 440524（南澳县）两张表都不见 → 落市级，且不下"无效"、绝不产出"未知地区"。
  // 选它正因为它是 §2.2 那条反面教材的同一码：旧库对同一个码吐「广东省汕头市未知地区」。
  const b = resolveRegion('440524');
  assert.equal(b.status, 'uncoded');
  assert.equal(b.level, 'city');
  assert.equal(b.fullName, '广东省汕头市');
  // note 缺字段时 assert.match 报的是"argument must be of type string"，不指认是谁；补 ?? 与 message
  assert.match(b.note ?? '', /未收录/, 'uncoded 结论必须带「未收录」说明');

  // 历史县级（2010 撤销的崇文区）与历史市级（2019 并入济南的莱芜市）及其下辖县
  const c = resolveRegion('110103');
  assert.equal(c.status, 'abolished');
  assert.equal(c.fullName, '北京市崇文区');
  assert.equal(resolveRegion('371200').fullName, '山东省莱芜市');
  assert.equal(resolveRegion('371202').fullName, '山东省莱芜市莱城区');
  assert.equal(resolveRegion('110221').fullName, '北京市昌平县');
  // fullName 那一句测不到历史层的 level：region.js 里历史码的 level 是按码尾算的
  // （0000→province / 00→city / 其余→county），而它同时决定 note 用「所属地市」还是
  // 「该区划」、county 字段挂不挂名。把整条 ternary 硬编码成 'county' 之后
  // 12 条判据一条都不红（实测），所以这里三样各钉一条。
  const laiWu = resolveRegion('371200');
  assert.equal(laiWu.level, 'city', '莱芜市是历史市级，不是历史县级');
  assert.equal(laiWu.status, 'abolished');
  assert.match(laiWu.note ?? '', /^所属地市/, '历史市级必须说「所属地市」，不能说「该区划」');
  assert.equal(laiWu.county, '', '市级历史码不得把市名挂进 county');
  assert.match(resolveRegion('110103').note ?? '', /^该区划/, '县级历史码反过来，不得说「所属地市」');
  // §5.4 那句「不得断言已撤销建制」此前只是文档里的话，代码改一个字都不许红。三样各钉一条：
  // 括号里必须是**现行表的截止日**（历史层 2015 口径不在这句文案里）、不许出现"已撤销"、
  // 尾句必须是"可能是"而不是"通常是"（四种成因没做逐条统计，"通常是"是编不出来的话）。
  const histNote = resolveRegion('110103').note ?? '';
  assert.match(histNote, /未见于现行区划表（截止 2022-10-31）/, histNote);
  assert.doesNotMatch(histNote, /已撤销/, '历史层命中不得断言「已撤销」（§5.4）');
  assert.match(histNote, /可能是/, '成因只能给可能性：' + histNote);
  // 历史层里省级形（XX0000）实测 0 条，上面那条 ternary 的 province 分支在当前产物下不可达。
  // 留着它的理由：--fetch 换进来的旧表完全可能带省本级条目（历史层的码形闸门只要求 6 位数字）。
  // 所以这条断言测的不是那个分支，是把"它现在不可达"钉成一件会变红的事。
  assert.equal(historicalCodes().filter((x) => x.endsWith('0000')).length, 0,
    '历史层出现了省级形的码：那条 province 分支从没测过的代码变成必须测的代码，补判据再放行');

  // 6 位「市级码 + 00」是统一社会信用代码区划段的常见形态（示例 350100 即福州市），
  // 必须按现行市级解出来，不能落进「未收录」——这条是 §C 的 USCC 面板的地基。
  assert.deepEqual({ s: resolveRegion('110100').status, l: resolveRegion('110100').level, n: resolveRegion('110100').fullName },
    { s: 'current', l: 'city', n: '北京市' });
  assert.equal(resolveRegion('350100').fullName, '福建省福州市');
  assert.equal(resolveRegion('110000').level, 'province', '省级码 + 0000 按现行省级解');

  // 一级都落不到
  const d = resolveRegion('990101');
  assert.equal(d.status, 'unknown');
  assert.equal(d.level, 'none');

  // 直辖市与省直辖县级的占位市名不得拼进全名；地区/州这一级不是占位名，要照常拼进去
  assert.equal(resolveRegion('310101').fullName, '上海市黄浦区');
  assert.equal(resolveRegion('500103').fullName, '重庆市渝中区');
  assert.equal(resolveRegion('429004').fullName, '湖北省仙桃市');
  assert.equal(resolveRegion('469001').fullName, '海南省五指山市');
  assert.equal(resolveRegion('653201').fullName, '新疆维吾尔自治区和田地区和田市');
  assert.equal(resolveRegion('522702').fullName, '贵州省黔南布依族苗族自治州福泉市');

  // 第五档"自己哪一档都不在、只有父级市在历史层"（region.js 的 histCity 分支）。
  // 整档此前零判据：把它删掉之后 12 条判据一条都不红（2026-09-25 实测），而 371299 从
  // abolished/city「山东省莱芜市」退成 uncoded/province「山东省」——用户看到的是省名，
  // 建制结论整档丢了。3712 是 2019 年并入济南的莱芜市市码，现行市级表没有它，
  // 而 371299 这个「市码+99」连旧表里也没有，所以全链条只有这一档接得住。
  const underHistCity = resolveRegion('371299');
  assert.deepEqual(
    { s: underHistCity.status, l: underHistCity.level, n: underHistCity.fullName },
    { s: 'abolished', l: 'city', n: '山东省莱芜市' },
    '市级父码在历史层这一档必须独立成立，不得退到省级回落');
  assert.match(underHistCity.note ?? '', /^所属地市/, '这一档走市级的半句文案');
  assert.equal(underHistCity.county, '', '这一档没有县级名可挂');

  // 同一段地名不得在fullName里出现两次。快照实读两类共 19 条：
  //   市名==县名 4 条（441900 东莞市、442000 中山市、460400 儋州市、620201 嘉峪关市）；
  //   县名本身以市名开头 15 条（130272「唐山市汉沽管理区」挂在 1302 唐山市 下等，
  //   全是 2022 口径里的功能区）。朴素拼接给出「广东省东莞市东莞市」「河北省唐山市唐山市
  //   汉沽管理区」。整改前把剥离那一行摘掉，12 条判据一条都不红——那 19 条既不在 A5 的
  //   抽样里，A5 的全表扫描又只查「未知」。现在摘它红的是 A5 一处（`# pass 11 / # fail 1`）。
  assert.equal(resolveRegion('441900').fullName, '广东省东莞市');
  assert.equal(resolveRegion('620201').fullName, '甘肃省嘉峪关市');
  assert.equal(resolveRegion('130272').fullName, '河北省唐山市汉沽管理区');
  assert.equal(resolveRegion('410773').fullName, '河南省新乡市平原城乡一体化示范区');
  // 前缀剥离只剥得掉重复的那一段：同一个市下不以市名开头的县，名字一个字都不许少
  assert.equal(resolveRegion('130204').fullName, '河北省唐山市古冶区');
  assert.equal(resolveRegion('130207').fullName, '河北省唐山市丰南区');
  for (const code of [...currentCountyCodes(), ...historicalCodes()]) {
    const { fullName } = resolveRegion(code);
    assert.doesNotMatch(fullName, /(.{2,})\1/u, `${code} 的全名有相邻重复：${fullName}`);
  }

  // 结构非法的输入不得抛异常，只能落到 none
  for (const bad of ['', '11010', '1101010', 'abcdef', null, undefined, 110101]) {
    assert.equal(resolveRegion(bad).level, 'none', `${String(bad)} 应落到 none`);
  }
  // 样本判据只覆盖抽到的那 4 个码，653201 之类回归成「未知」不会红；把这条升格成全表扫描
  for (const code of [...currentCountyCodes(), ...historicalCodes()]) {
    assert.doesNotMatch(resolveRegion(code).fullName, /未知/, `${code} 解出了「未知」`);
  }
  assert.equal(/未知/.test(JSON.stringify([a, b, c, d])), false, '任何结论里都不许出现「未知」');
});

test('A6 生成侧只暴露现行码，历史码不进级联', () => {
  const beijing = currentCountyCodes('11');
  assert.ok(beijing.includes('110101'));
  assert.equal(beijing.includes('110103'), false, '崇文区不得出现在现行候选里');
  assert.equal(beijing.includes('110221'), false, '昌平县不得出现在现行候选里');
  assert.equal(currentCountyCodes('3712').length, 0, '莱芜不得出现在现行候选里');
  const shiXiaQu = currentCountyCodes('1101');
  assert.equal(shiXiaQu.length, 16, '北京市市辖区现行 16 个县级单位');
  assert.ok(shiXiaQu.every((c) => c.startsWith('1101')));
  // 快照独立对账，逐市比条数。原来那两行北京断言是退化的：11 省下只有 1101 一个市，
  // 两行数的是同一批记录，而且"按 cityCode 数"与生成器"按码前缀分"是同一个判定的两种写法——
  // 只能抓漏记录，抓不到归错市。全表逐市比才钉得住"某个市少 3 条、另一个市多 3 条"这种内部搬运。
  const snapshot = JSON.parse(read('scripts/fixtures/region-source/areas.json'));
  const perCity = new Map();
  for (const x of snapshot) perCity.set(x.cityCode, (perCity.get(x.cityCode) ?? 0) + 1);
  for (const city of currentCityCodes()) {
    assert.equal(currentCountyCodes(city).length, perCity.get(city) ?? 0, `${city} 的县级数与快照对不上`);
  }
  assert.equal(currentCityCodes('35').includes('3501'), true, '福州市应在现行市级里');
  assert.equal(currentCityCodes('37').includes('3712'), false, '莱芜市不得出现在现行市级候选里');
});

// ── §A 生成器与解析器的闸门（A7 输入形状 / A8 哈希清单 / A9 载入自检 / A10 参数白名单
//     / A11 --fetch 成功路径 / A12 读侧入参口径）──
//
// A1–A6 检查的是"产物对不对"，这一组检查的是"闸门还在不在"。这些闸门此前大多只有人肉
// 遵守过，实测每一道都能安静放过一种坏数据（各用例注释里写明了是哪一种）。

/** 仓库里的快照目录、生成器与产物路径。闸门用例一律在 tmpdir 的副本上跑：
 *  scripts/fixtures/region-source/ 是哈希钉死、git 跟踪的可复现输入，动一下就没了。 */
const FIXDIR = resolve(HERE, 'fixtures/region-source');
const GENERATOR = resolve(HERE, 'build-region-data.mjs');
const ARTIFACT = resolve(ROOT, 'dev/js/tools/region-data.js');
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * 仓库侧的写入指纹：四份快照（连 SOURCES.json 一起）与生成物。
 * 判据全在 tmpdir 副本上跑，但"跑在副本里"这件事本身没人验过——A10/A11 各自在结尾断言，
 * 而 A7/A8/A9 用同一套 helper 却没人断言。这里把它下沉进 helper，让文件头那句
 * "每条用例结尾都断言仓库字节没被动过"从陈述变成机器读得过的事实。
 * @returns {{artifact:string, fixtures:Object<string,string>}}
 */
function repoFingerprint() {
  return {
    artifact: readFileSync(ARTIFACT, 'utf8'),
    fixtures: Object.fromEntries(
      readdirSync(FIXDIR).sort().map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))]),
    ),
  };
}

/** 与 repoFingerprint 的起点比对，红就说明某条判据往仓库里写了东西 */
function assertRepoUntouched(before, who) {
  const now = repoFingerprint();
  assert.deepEqual(now.fixtures, before.fixtures, `${who} 动过仓库里的快照`);
  assert.equal(now.artifact, before.artifact, `${who} 动过仓库里的产物`);
}

/** 把 SOURCES.json 里四条快照声明的 sha256/bytes 按磁盘现状重算。
 *  A7 必须先过这一道：不重封清单，生成器红在「快照哈希不符」，与被测的形状闸门无关，等于没测。
 *  A8 反过来要的是"不重封"，所以这条由 runGeneratorOn 的 seal 开关控制，不在改写函数里顺手做。 */
function reSealAll(fixDir) {
  const manifestPath = resolve(fixDir, 'SOURCES.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const entry of manifest.files.concat([manifest.historical])) {
    const buf = readFileSync(resolve(fixDir, entry.file));
    entry.sha256 = sha256Of(buf);
    entry.bytes = buf.length;
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** 改一份 JSON 快照（areas / cities / gb2260 通用） */
function patchJson(fixDir, file, mutate) {
  const p = resolve(fixDir, file);
  const data = JSON.parse(readFileSync(p, 'utf8'));
  mutate(data);
  writeFileSync(p, JSON.stringify(data));
}

/** 找出一段 JSON 里的某条记录（县级/市级行用 code 字段，历史层用键本身） */
function findRow(data, code) {
  const hit = Array.isArray(data) ? data.find((x) => x.code === code) : data[code];
  assert(hit !== undefined, `快照里没有 ${code} 这一条，注入无从下手`);
  return hit;
}

/**
 * 生成器源码里那三个上游 URL 的形状，A10/A11 的重定向共用这一个模式。
 * 带 g 标志：既要数命中，也要一次换干净。
 */
const UPSTREAM_URL = /https:\/\/raw\.githubusercontent\.com[^'\s]+/g;

/**
 * 造一个 mutateGenerator：把副本里的上游 URL 全换成 repl 给的目标。
 * 必须数命中条数。`String.replace` 匹配不到时静默返回原串，重定向就成了"没发生也没人知道"，
 * 而 A10/A11 声称验的是"重定向之后的抓取行为"。实测把生成器里的域名换成
 * raw.github.example.com（重定向归零）之后只有 A11 红，A10 整条照旧全绿：它"抓不到所以不许
 * 改文件"那一格变成靠 DNS 解析失败蒙对的，与重定向有没有生效再无关系。
 * @param {(url:string)=>string} repl 逐个 URL 的替换目标
 * @returns {(src:string)=>string} 交给 makeTmpRepo 的生成器改写函数
 */
function rewriteUpstreamUrls(repl) {
  return (src) => {
    const hits = src.match(UPSTREAM_URL) ?? [];
    assert.equal(hits.length, 3, `副本源码里的上游 URL 命中 ${hits.length} 处，这两条判据假设的是 3 处`);
    return src.replace(UPSTREAM_URL, repl);
  };
}

/**
 * 把四份快照 + 生成器复制进一个临时仓库根。生成器用 import.meta.url 推 ROOT，
 * 所以产物只会落在 tmp 里，仓库的 region-data.js 一个字节都不碰。
 * @param {{withArtifact?:boolean, mutateGenerator?:(s:string)=>string}} [opts]
 *   withArtifact 预先把当前产物拷一份过去（--check 那条要知道"本来是一致的"）；
 *   mutateGenerator 改写副本源码，A10 用它把 --fetch 的三个 URL 换成不可能听的网络地址，
 *   这样这条判据在联网与断网两台机器上跑出的结果完全一样。
 */
function makeTmpRepo({ withArtifact = false, mutateGenerator = (s) => s } = {}) {
  // 先算改写结果再建目录：rewriteUpstreamUrls 会抛，那时候还没留下任何待清的 tmpdir
  const genSrc = mutateGenerator(readFileSync(GENERATOR, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'region-gate-'));
  const fixDir = resolve(tmp, 'scripts/fixtures/region-source');
  mkdirSync(fixDir, { recursive: true });
  for (const f of readdirSync(FIXDIR)) copyFileSync(resolve(FIXDIR, f), resolve(fixDir, f));
  const gen = resolve(tmp, 'scripts/build-region-data.mjs');
  writeFileSync(gen, genSrc);
  const artifact = resolve(tmp, 'dev/js/tools/region-data.js');
  // 输出目录一律先建好：生成器的写分支只管 writeFileSync，不建目录的话"没目录"会被误读成闸门红
  mkdirSync(dirname(artifact), { recursive: true });
  if (withArtifact) copyFileSync(ARTIFACT, artifact);
  return { tmp, fixDir, gen, artifact, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/**
 * 在临时副本上跑一次生成器（默认就是"生成 / 覆盖"那一支），报告退出码、输出与有没有落盘。
 * @param {(fixDir:string)=>void} [corrupt] 对副本动手的函数，默认什么都不做
 * @param {{seal?:boolean, withArtifact?:boolean}} [opts] seal=false 时故意留着旧清单，
 *   用来测哈希闸门本身（A8）
 */
function runGeneratorOn(corrupt = () => {}, { seal = true, withArtifact = false } = {}) {
  const before = repoFingerprint();
  const repo = makeTmpRepo({ withArtifact });
  let result;
  try {
    corrupt(repo.fixDir);
    if (seal) reSealAll(repo.fixDir);
    let code = 0;
    let text = '';
    try {
      text = execFileSync(process.execPath, [repo.gen], { cwd: repo.tmp, encoding: 'utf8' });
    } catch (e) {
      code = typeof e.status === 'number' ? e.status : -1;
      text = `${e.stderr ?? ''}${e.stdout ?? ''}`;
    }
    result = {
      code,
      // 未捕获异常的输出前面是"文件:行号 + 源码行 + 栈"，只留 Error: 之后的正文，
      // 免得断言被 build-region-data.mjs 自身的行号漂移牵动
      out: text.replace(/^.*\bError: /gm, ''),
      wroteArtifact: existsSync(repo.artifact),
      artifactSameBytes: existsSync(repo.artifact)
        && readFileSync(repo.artifact, 'utf8') === readFileSync(ARTIFACT, 'utf8'),
    };
  } finally {
    repo.cleanup();
  }
  assertRepoUntouched(before, 'runGeneratorOn');
  return result;
}

/** 在 tmpdir 里造一份"改过的产物"再 import region.js，看读侧那道载入自检拦不拦。
 *  region.js 只 `import './region-data.js'`，所以把两个文件放进同一个临时目录：
 *  region-data.js 是被改过的那份，region.js 是仓库原件。A9 因此既不改判据也不碰仓库产物。
 *  @param {(src:string)=>string} patchSrc 对产物整份源码的改动
 *  @returns {Promise<{loaded:boolean, err:string}>} loaded 为 true 说明自检漏了 */
async function importRegionWithPatchedSource(patchSrc) {
  const before = repoFingerprint();
  const tmp = mkdtempSync(join(tmpdir(), 'region-read-'));
  const dir = resolve(tmp, 'tools');
  let result;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'region-data.js'), patchSrc(readFileSync(ARTIFACT, 'utf8')));
    copyFileSync(resolve(ROOT, 'dev/js/tools/region.js'), resolve(dir, 'region.js'));
    try {
      await import(resolve(dir, 'region.js'));
      result = { loaded: true, err: '' };
    } catch (e) {
      result = { loaded: false, err: String(e && e.message ? e.message : e) };
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  assertRepoUntouched(before, 'importRegionWithPatchedSource');
  return result;
}

/** 只改产物里某张表（`export const NAME = '…'`）的原文，其余字节不动。
 *  生成器的 q() 禁止数据里出现单引号，所以这一段整体就是 /'[^']*'/。 */
const patchTable = (exportName, mutate) => (src) => {
  const re = new RegExp(`(export const ${exportName} = )(')([^']*)\\2;`);
  const m = re.exec(src);
  assert(m, `产物里找不到 ${exportName} 这一段`);
  return `${src.slice(0, m.index)}${m[1]}'${mutate(m[3])}';${src.slice(m.index + m[0].length)}`;
};

test('A7 生成器的输入闸门：十种坏形状各自独立被拒，且点名到码与闸门', () => {
  // 十条各打一道不同的规则，不让它们互相顶包（同一道规则的两个分支算两道，见市/县那两条
  // 引用完整性）：名称闸门（缺字段 / 空串 / null）、码类型闸门、历史层码形闸门（5 位键，
  // 分隔符检查看不见它）、父子码前缀闸门（名字全对，只有分组依据坏了）、父码引用完整性闸门
  // （父码形状对、前缀也对，但表里没有那个父亲）、分隔符闸门（形状全对，只有名称里带了
  // 编码格式用的标点——去掉 assertNoDelimiters 那一次调用，只有第 7 条会红）。
  // 每条注入后都重封 SOURCES.json，所以红的一定是形状闸门而不是哈希闸门。
  const cases = [
    // [注入, 改哪份快照, 怎么改, 报错必须点名的码, 报错必须出现的那道闸门/表名]
    ['县级行删掉 name 字段', 'areas.json', (d) => { delete findRow(d, '110102').name; }, '110102', '县级'],
    ['县级行的 name 是空字符串', 'areas.json', (d) => { findRow(d, '110105').name = ''; }, '110105', '县级'],
    ['历史层某条的值是 null', 'gb2260-2015.json', (d) => { d['110224'] = null; }, '110224', '历史层'],
    ['历史层出现 5 位键', 'gb2260-2015.json', (d) => { d['11022'] = d['110224']; delete d['110224']; }, '11022', '历史层'],
    ['市级行的父码对不上', 'cities.json', (d) => { findRow(d, '1101').provinceCode = '99'; }, '1101', '父级码应逐字等于'],
    // 这一条打的不是"父码不相等"，而是"父码短了一位还算不算相等"：'1' 是 '1101' 的合法前缀，
    // 原本那道 startsWith 会放行，只有逐字等式拦得住。实测注入它之后旧闸门 exit 0、
    // 12 条判据全绿，产物里 currentCityCodes('11') 是空数组（1101 挂到了 '1' 名下）。
    ['市级行的父码只剩一位：前缀成立、位数不成立', 'cities.json',
      (d) => { findRow(d, '1101').provinceCode = '1'; }, '1101', '父级码应逐字等于'],
    ['县级名里带全角逗号：形状全对，只有分隔符违规', 'areas.json',
      (d) => { findRow(d, '110108').name = '海淀区，北京'; }, '110108', '名称含分隔符'],
    // 码必须是字符串。`String(row.code)` 会把数值 1101 洗成合法的 '1101' 过掉码形正则，
    // 可 §build 那三个"查现行"的集合存的是原始值（Set 里有数字 1101、没有字符串 '1101'），
    // 于是旧表里的 110100 按市级查不到，凭空多出一条历史码。实测注入之后生成器 exit 0，
    // 红的是 A1「historical: 1230 期望 1229」与 A2「110100 同时出现在两层」两道条数/层级判据
    // （A7 也红，但红在它自己的 findRow 助手找不到 1101 那行，与闸门无关），
    // 没有一道的报错说得出"1101 这一行的 code 类型不对"。（读侧看不出任何异常：110100 照样解成北京市。）
    ['市级行的 code 是数值：String() 洗白、按层级查现行时漏配', 'cities.json',
      (d) => { findRow(d, '1101').code = 1101; }, '1101', '码不是字符串'],
    ['县级行的父码表里根本没有：形状对、引用悬空', 'areas.json',
      (d) => { d.push({ code: '119901', name: '孤儿区', cityCode: '1199', provinceCode: '11' }); },
      '119901', '不在市级表'],
    // 引用完整性那道有两个分支（市查省、县查市），各钉一条才谈得上"独立被拒"：只留县那一条，
    // 删掉市那个 for 循环没有任何判据会红。这一条的父码 '99' 与 code 前 2 位逐字相等，
    // 前缀等式那道拦不住它，只有"表里到底有没有这个父亲"拦得住。
    ['市级行的父码形对、等式也对，可省级表里没有 99', 'cities.json',
      (d) => { d.push({ code: '9901', name: '新设市', provinceCode: '99' }); }, '9901', '不在省级表'],
  ];
  for (const [what, file, mutate, code, gate] of cases) {
    const r = runGeneratorOn((fix) => patchJson(fix, file, mutate));
    assert.notEqual(r.code, 0, `${what}：生成器竟然退出 0，坏数据会一路编进产物`);
    assert.equal(r.wroteArtifact, false, `${what}：已经判定拒绝，却还是落了盘`);
    assert.doesNotMatch(r.out, /快照哈希不符/, `${what}：红的是哈希闸门而不是形状闸门，等于没测到`);
    assert.match(r.out, new RegExp(`\\b${code}\\b`), `${what}：报错没点名 ${code}`);
    assert.match(r.out, new RegExp(gate), `${what}：报错没指认是哪张表/哪道闸门（${gate}）`);
  }
  // 正向对照：同一套闸门必须放过干净快照，且产物字节与仓库里那份逐字节相同。
  // 少了这一句，上面十条可以是因为"怎么跑都红"而变绿。
  const clean = runGeneratorOn();
  assert.equal(clean.code, 0, `干净快照被拒：${clean.out}`);
  assert.equal(clean.artifactSameBytes, true, '干净快照生成的产物与仓库产物不是同一份字节');
});

test('A8 清单哈希的两条消费路径都盖住历史层快照，人读注解字段与真实字节一致', () => {
  const manifest = JSON.parse(read('scripts/fixtures/region-source/SOURCES.json'));
  const declared = new Map(manifest.files.map((f) => [f.file, f.sha256])
    .concat([[manifest.historical.file, manifest.historical.sha256]]));
  // 路径一：写进产物的 REGION_META.sha256。清单里历史层那一条是被 .concat([[码, 哈希]])
  // 追加进数组的，"简化"成 .concat([码, 哈希]) 之后 Object.fromEntries 会把两个字符串按字符
  // 拆开，得到 {"g":"b"} 这种键：产物少一条真哈希、多一条假键，而这条断言立刻红。
  assert.equal(Object.keys(REGION_META.sha256).length, declared.size, 'REGION_META.sha256 条数不对');
  assert.ok(Object.hasOwn(REGION_META.sha256, manifest.historical.file), 'REGION_META.sha256 漏了历史层快照');
  assert.deepEqual(new Map(Object.entries(REGION_META.sha256)), declared, 'REGION_META.sha256 与 SOURCES.json 不同步');
  // 路径二：verifyManifest。只改 gb2260 的字节、故意不重封清单 → 必须点名 gb2260-2015.json。
  // 追加的是一个换行，JSON 照样解析得动，所以这里过的确实只有哈希闸门一道；
  // 把 manifest.historical 那两条 concat 去掉，这一句就红在"退出 0"。
  const r = runGeneratorOn((fix) => {
    const p = resolve(fix, 'gb2260-2015.json');
    writeFileSync(p, Buffer.concat([readFileSync(p), Buffer.from('\n')]));
  }, { seal: false });
  assert.notEqual(r.code, 0, '历史层快照换了字节，verifyManifest 竟然放过');
  assert.match(r.out, /快照哈希不符：gb2260-2015\.json/, '哈希闸门没指到历史层那一份');
  assert.equal(r.wroteArtifact, false, '哈希不符还继续生成产物');
  // 路径三（人读的那一半）：清单里除哈希还有 schema / bytes / count，生成器一个都不看——
  // 它只认 sha256，那是唯一的机器闸门。这三样一旦腐烂就没有任何自动机制会发现，而 §B 的
  // --fetch 流程恰恰要求人照着 bytes 与 count 核对新抓下来的数据，等于把对不上号的注解
  // 当成核对基准。所以这里按真实字节复算：注解字段不进门，但必须与门里的东西一致。
  // 只核 bytes 不核 sha 的反面不成立：bytes 相同而内容不同是可能的，那道由 sha256 管。
  // 不核 historical.extractedFromSha256——那是站内旧副本 demo/idCardDemo/lib/GB2260.js 的哈希，
  // 段 5 删掉 demo 之后这条断言必然挂，而清单里的这个字段是归属证据、不是输入依赖。
  assert.equal(manifest.schema, 1, '清单的 schema 版本变了，读它的判据要一起改');
  for (const e of manifest.files.concat([manifest.historical])) {
    const buf = readFileSync(resolve(ROOT, 'scripts/fixtures/region-source', e.file));
    const table = JSON.parse(buf.toString('utf8'));
    assert.equal(e.bytes, buf.length, `${e.file} 的 bytes 注解与真实字节不符`);
    assert.equal(e.count, Array.isArray(table) ? table.length : Object.keys(table).length,
      `${e.file} 的 count 注解与表里实际条数不符`);
  }
});

test('A9 读侧对产物自检：schema、条数、分隔符漂移，坏一处必须抛', async () => {
  // 正向对照先跑：一个字节都不改必须能加载。否则后面几条"抛了"可以是因为什么都加载不了。
  const clean = await importRegionWithPatchedSource(patchTable('RAW_CITIES', (s) => s));
  assert.equal(clean.loaded, true, `正常产物反而加载不了：${clean.err}`);

  // 截断：在组边界切，字符串完整闭合、语法零告警。此前模块照样加载成功，
  // 浏览器里就是 2,389 个县对着一份声明 2,978 条的元信息，全静默。
  const cut = await importRegionWithPatchedSource(
    patchTable('RAW_COUNTIES', (s) => s.slice(0, s.lastIndexOf('|', Math.floor(s.length * 0.8)))),
  );
  assert.equal(cut.loaded, false, '截掉 20% 的县级表没人报错');
  assert.match(cut.err, /解析出 \d+ 条 counties，元信息声明 2978 条/, cut.err);

  // 分隔符漂移：逗号换成全角冒号，四张表各注入一次。这条测的是"条数一个都不变也拦得住"——
  // 上面截断那条能拦是因为条数变了，而漂移之后的行数照旧（实测摘掉字段闸门再注入，
  // provinces/cities/counties/historical 仍然报出 31/342/2978/1229，四项全对得上元信息），
  // 坏行仍是一条语法完整、看起来正常的记录。省级/市级/历史层三张只有字段闸门看得见，
  // 县级另有 `at < 0` 那道兜着。
  for (const tbl of ['RAW_PROVINCES', 'RAW_CITIES', 'RAW_COUNTIES', 'RAW_HISTORICAL']) {
    const r = await importRegionWithPatchedSource(
      patchTable(tbl, (s) => `${s.slice(0, s.indexOf(','))}：${s.slice(s.indexOf(',') + 1)}`),
    );
    assert.equal(r.loaded, false, `${tbl} 的分隔符被换掉后模块安静加载`);
    assert.match(r.err, new RegExp(tbl), `${tbl}：报错没点名到这张表`);
  }

  // 县级组内的坏项：把某个县的 2 位序号前缀抹掉。上面两道都看不见它——字段闸门只看组头
  // （组头完好），条数自检也看不见（它照样产出一条，只是码变成 1101东城、名字变成空串，
  // COUNTIES.size 仍是 2,978）。这是县级表独有的编码形态（一名多字符、组内空格分隔），
  // 所以只有 token 闸门拦得住，摘掉它 A9 必须红。
  const badToken = await importRegionWithPatchedSource(
    patchTable('RAW_COUNTIES', (s) => s.replace('01东城区', '东城区')),
  );
  assert.equal(badToken.loaded, false, '县级组里少了序号前缀的 token 安静加载，编出了一个假县');
  assert.match(badToken.err, /RAW_COUNTIES/, badToken.err);

  // schema：REGION_META.schema 此前写了没人读，产物换版与解析器不同步时不会有任何反应
  const wrongSchema = await importRegionWithPatchedSource((s) => s.replace('  "schema": 1,', '  "schema": 2,'));
  assert.equal(wrongSchema.loaded, false, 'schema 改成 2 没人报错');
  assert.match(wrongSchema.err, /schema/, wrongSchema.err);
});

test('A10 参数白名单：拼错的开关不得落到生成分支，--check 不许顺手覆盖', () => {
  const repoBytes = readFileSync(ARTIFACT, 'utf8');
  // URL 换成 127.0.0.1:1（没有任何服务会在那儿监听，且不需要外网），
  // 这样 --fetch 那条断言在联网与断网的机器上跑出同一个结果，不会变成随机红的判据。
  const repo = makeTmpRepo({
    withArtifact: true,
    mutateGenerator: rewriteUpstreamUrls(() => 'http://127.0.0.1:1/x.json'),
  });
  const spawn = (...args) => spawnSync(process.execPath, [repo.gen, ...args], { cwd: repo.tmp, encoding: 'utf8' });
  try {
    for (const flag of ['--chek', '--CHECK', '--help', '-h', '--fetchh', '--dry-run']) {
      const r = spawn(flag);
      assert.notEqual(r.status, 0, `${flag} 被当成没写参数，直接跑进生成分支`);
      assert.match(r.stderr, /未知参数/, `${flag} 的报错没说是参数问题：${r.stderr}`);
      assert.match(r.stderr, /用法：node scripts\/build-region-data\.mjs/, `${flag} 的报错没带用法行`);
      assert.equal(r.stdout, '', `${flag} 报错的同时还把产物生成了一遍`);
    }
    // --check 承诺只比对：一致的副本必须绿且不写文件；把副本改成"落后一行"之后必须红，
    // 而且不许"顺手"把它写回一致 —— 那正是 CI 里 --check 失去意义的方式。
    const ok = spawn('--check');
    assert.equal(ok.status, 0, `一致的副本上 --check 却红了：${ok.stderr}`);
    assert.match(ok.stdout, /与快照一致/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '--check 动过一致状态下的产物');
    const staleBytes = `${repoBytes}\n`;
    writeFileSync(repo.artifact, staleBytes);
    const chk = spawn('--check');
    assert.notEqual(chk.status, 0, '--check 在不匹配时退出 0，等于没有闸门');
    assert.match(chk.stderr, /与快照不一致/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), staleBytes, '--check 把比对做成了覆盖');

    // 两个开关互斥：--check 承诺不写文件，--fetch 承诺写快照，同时给必须拒
    const both = spawn('--check', '--fetch');
    assert.notEqual(both.status, 0, '--check --fetch 同时给居然照常跑');
    assert.match(both.stderr, /互斥/);
    assert.match(both.stderr, /用法：node scripts\/build-region-data\.mjs/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), staleBytes, '互斥报错的路上还是改了产物');
    // --fetch 抓不到任何一份时：必须非零退出，且明说没改任何文件；四份快照哈希逐条不变
    const f = spawn('--fetch');
    assert.notEqual(f.status, 0, '--fetch 抓取全失败却退出 0');
    assert.match(f.stderr, /未修改任何文件/, `--fetch 失败时没说没改文件：${f.stderr}`);
    const manifest = JSON.parse(readFileSync(resolve(repo.fixDir, 'SOURCES.json'), 'utf8'));
    for (const entry of manifest.files.concat([manifest.historical])) {
      const buf = readFileSync(resolve(repo.fixDir, entry.file));
      assert.equal(sha256Of(buf), entry.sha256, `--fetch 之后 ${entry.file} 被改过`);
    }
    // 正向对照：不带参数仍然要能生成，且字节与仓库产物一致（白名单不能把默认支路一起关掉）
    const plain = spawn();
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /已生成/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '默认支路生成的字节变了');
  } finally {
    repo.cleanup();
  }
  assert.equal(readFileSync(ARTIFACT, 'utf8'), repoBytes, '整条 A10 动过仓库里的产物');
});

/**
 * A11：--fetch 的成功路径。A10 只能把 URL 指向一个没人听信的端口，于是它验的是"全失败时
 * 不改文件"——抓取真的成功之后那半段（改写过快照就不生成、退出 1 并给两步说明；形状不过
 * 一个字节都不落）在此之前从没被执行过。这里用一个只监听 127.0.0.1 随机端口的临时 http
 * 服务当真上游，把三个场景都跑起来。不碰外网、不碰仓库里的 fixtures。
 *
 * 两个必须写在一起的约束，缺一条这条判据就变成挂死：
 *   1. 子进程要用**异步** execFile 起。一开始用的 spawnSync，父进程停在系统调用里，
 *      事件循环转不动，那台服务器就永远发不出响应，子进程卡在 fetch() 上——实测
 *      `--test-timeout=6000` 下 A11 恒为 "test timed out after 6000ms"。
 *   2. 显式 timeout 不能省。判据挂死比判据红更糟：红会指名道姓，挂死只让整份 §A 不出结果。
 */
test('A11 --fetch 抓回来的三种上游：一致才生成、变了只写快照、坏形状一个字节都不落',
  { timeout: 20000 }, async () => {
  const files = ['provinces.json', 'cities.json', 'areas.json'];
  const pristine = Object.fromEntries(files.map((f) => [f, readFileSync(resolve(FIXDIR, f))]));
  const server = createServer((req, res) => {
    const key = req.url.replace(/^\//, '');
    if (!Object.hasOwn(server.__body, key)) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(server.__body[key]);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const repoBytes = readFileSync(ARTIFACT, 'utf8');

  /** 把副本里的三个 URL 换成本地假上游，路径末段保持一致（命中条数由 helper 断言） */
  const localUrls = rewriteUpstreamUrls((u) => `http://127.0.0.1:${port}/${u.split('/').pop()}`);

  /** 跑一次 --fetch。必须异步：父进程要当事件循环里的服务器，spawnSync 会把这条判据挂死 */
  const runFetch = async (repo) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [repo.gen, '--fetch'],
        { cwd: repo.tmp, encoding: 'utf8' });
      return { code: 0, out: `${stdout}${stderr}` };
    } catch (e) {
      return { code: typeof e.code === 'number' ? e.code : -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  try {
    /**
     * 一个场景一份临时副本：body 是"上游此时该回什么"，run 拿到副本与 fetch 结果做断言。
     * @param {Record<string, Buffer>} body 上游响应表
     */
    const scenario = async (body, act) => {
      server.__body = body;
      const repo = makeTmpRepo({ mutateGenerator: localUrls });
      try {
        // 先 await 再起断言：act 是同步的，把未落定的 promise 直接传进去也能跑，
        // 但那样这条判据的正确性就依赖"act 恰好不返回 promise"这一件无关的事
        await act(repo, await runFetch(repo));
      } finally {
        repo.cleanup();
      }
    };
    const hashesOf = (fixDir) => Object.fromEntries(
      files.map((f) => [f, sha256Of(readFileSync(resolve(fixDir, f)))]),
    );

    // S1 上游与本地逐字节一致：不改写快照，直接生成产物，退出 0
    await scenario(pristine, (repo, { code, out }) => {
      assert.equal(code, 0, `上游与本地完全一致时 --fetch 却非零退出：${out}`);
      assert.equal((out.match(/（一致）/g) || []).length, 3, `三份都该报"一致"：${out}`);
      assert.deepEqual(hashesOf(repo.fixDir), Object.fromEntries(files.map((f) => [f, sha256Of(pristine[f])])),
        '一致的场景里快照被改写过');
      assert.ok(existsSync(repo.artifact), '一致时应该接着生成产物');
      assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '一致时生成的产物字节与仓库那份不同');
    });

    // S2 上游多了一条合法新县：只改写那一份快照，不生成产物，退出 1 并给出两步说明
    const grown = JSON.parse(pristine['areas.json'].toString('utf8'));
    grown.push({ code: '110199', name: '判据演练区', cityCode: '1101', provinceCode: '11' });
    await scenario({ ...pristine, 'areas.json': Buffer.from(JSON.stringify(grown)) }, (repo, { code, out }) => {
      const after = hashesOf(repo.fixDir);
      const changed = files.filter((f) => after[f] !== sha256Of(pristine[f]));
      assert.deepEqual(changed, ['areas.json'], `只该改写 areas.json，实际动了 ${changed.join(',')}`);
      assert.equal(existsSync(repo.artifact), false, `快照刚换过、清单还是旧的，居然还是生成了产物：${out}`);
      assert.equal(code, 1, `改写过快照却退出 ${code}：CI 里这一步必须挡住`);
      assert.match(out, /SOURCES\.json/, '没说要同步 SOURCES.json');
      assert.match(out, /重跑 node scripts\/build-region-data\.mjs/, '没说要重跑生成');
      assert.equal(readFileSync(resolve(repo.fixDir, 'SOURCES.json'), 'utf8'),
        readFileSync(resolve(FIXDIR, 'SOURCES.json'), 'utf8'), '--fetch 悄悄把清单也改了（哈希闸门会被自己喂平）');
    });

    // S3 上游回来的内容有坏形状：三份快照一个字节都不动、不生成产物，且明写磁盘没改
    const broken = JSON.parse(pristine['areas.json'].toString('utf8'));
    delete broken.find((x) => x.code === '110102').name;
    await scenario({ ...pristine, 'areas.json': Buffer.from(JSON.stringify(broken)) }, (repo, { code, out }) => {
      assert.notEqual(code, 0, '上游回来的形状是坏的，--fetch 却退出 0');
      assert.deepEqual(hashesOf(repo.fixDir), Object.fromEntries(files.map((f) => [f, sha256Of(pristine[f])])),
        '形状没过的响应已经落盘了');
      assert.equal(existsSync(repo.artifact), false, '坏形状还生成了产物');
      assert.match(out, /磁盘上的快照一个字节都没改/, `没声明磁盘未改：${out}`);
      assert.match(out, /110102/, `报错没点名坏行：${out}`);
      assert.match(out, /县级/, `报错没指认是哪张表：${out}`);
    });
  } finally {
    server.close();
  }
  // 仓库里的 fixtures 是哈希钉死的输入，这条演练一份都不许动
  for (const f of files) {
    assert.equal(sha256Of(readFileSync(resolve(FIXDIR, f))), sha256Of(pristine[f]), `A11 动过仓库快照 ${f}`);
  }
  assert.equal(readFileSync(ARTIFACT, 'utf8'), repoBytes, 'A11 动过仓库里的产物');
});

test('A12 读侧六个入口的入参口径一致，结构非法不得带出派生字段', () => {
  // resolveRegion / isGeneratable / provinceName / cityName 共用 normalizeCode，
  // currentCountyCodes / currentCityCodes 共用 normalizePrefix，两条归一只差一件事：
  // 前缀入口里 '' 的含义是"不收窄、给全表"，所以非字符串只能归一成 null→空集，
  // 归一成 '' 等于把一次类型错误放大成 2,978 条候选地址。除这一处之外，
  // "这算不算一个合法入参"在六个入口只能是同一个答案。此前各处各写各的 String()，实测：
  //   isGeneratable(110101) 为 true 而 resolveRegion(110101) 落 none；
  //   isGeneratable(' 110101 ') 为 false 而 resolveRegion(' 110101 ') 解出北京市东城区；
  //   currentCountyCodes(null) 返回 2,978 条（`null ?? ''` 落进"全表"那一支）；
  //   currentCountyCodes(1101) 返回 16 条而 isGeneratable(1101, 'city') 为 false；
  //   currentCountyCodes(Object.create(null)) 直接抛 TypeError。
  // 本层"任何入参都不抛"是自己定的契约（§5.4 只规定"区划查不到时其余项照常判定"，
  // 那是不能抛的理由，不是"永不抛"这句话的出处）。
  const KEYS = ['code', 'status', 'level', 'provinceCode', 'cityCode', 'countyCode',
    'province', 'city', 'county', 'fullName', 'note'];
  const DERIVED = ['province', 'city', 'county', 'fullName', 'provinceCode', 'cityCode', 'countyCode'];
  const REJECTED = [110101, null, undefined, ['110101'], Object.create(null), {}, '11010', ' 1101 01 ', 'abcdef'];
  // 标签不能用 String(bad)：Object.create(null) 正是在这一步抛
  // "Cannot convert object to primitive value"，判据自己先违反它要守的规矩
  const labelOf = (v) => `${typeof v}:${JSON.stringify(v)}`;
  for (const bad of REJECTED) {
    const label = labelOf(bad);
    const r = resolveRegion(bad);
    assert.deepEqual(Object.keys(r), KEYS, `${label} 的返回形状不是那 11 个键`);
    assert.equal(r.level, 'none', `${label} 应落到 none`);
    assert.equal(r.status, 'unknown', `${label} 应落 unknown，不得给任何建制结论`);
    // 被拒绝的输入旁边挂一个地名，正是这层设计要防的"看着像成功了"
    for (const k of DERIVED) assert.equal(r[k], '', `${label} 被拒了却带出 ${k}=${JSON.stringify(r[k])}`);
    assert.notEqual(r.note, '', `${label} 被拒了但没给出原因文案`);
    assert.equal(r.code, typeof bad === 'string' ? bad.trim() : '', `${label} 的 code 不该回显原文`);
    for (const lvl of ['county', 'city', 'province']) {
      assert.equal(isGeneratable(bad, lvl), false, `${label} 在 isGeneratable(…, '${lvl}') 那里被放行了`);
    }
    // provinceName / cityName 只做"前缀查表"，不做合法性判定：面板会拿 6 位县码问省名，
    // 所以字符串入参即使位数不对也能解出名字（'11010' → 北京市，见下面的显式断言）。
    // 这里要钉住的是它们对非字符串同样不猜——四处共用 normalizeCode，接受口径不能分叉。
    if (typeof bad !== 'string') {
      assert.equal(provinceName(bad), '', `${label} 不该解出省名`);
      assert.equal(cityName(bad), '', `${label} 不该解出市名`);
    }
  }

  // 前缀型入口（收窄候选集，供随机生成用）：非字符串一律空集，一个都不许给全表。
  // undefined 例外，它命中的是默认参数——语义是"没传"而不是"传了个坏值"。
  const FULL_COUNTY = currentCountyCodes().length;
  const FULL_CITY = currentCityCodes().length;
  assert.equal(FULL_COUNTY, 2978, '县级全表条数变了，下面这道"空集 vs 全表"的判据就失去意义');
  assert.equal(FULL_CITY, 342, '市级全表条数变了，同上');
  for (const bad of REJECTED.filter((b) => typeof b !== 'string')) {
    const label = labelOf(bad);
    if (bad === undefined) {
      assert.equal(currentCountyCodes(undefined).length, FULL_COUNTY, `${label} 该走默认参数拿全表`);
      assert.equal(currentCityCodes(undefined).length, FULL_CITY, `${label} 该走默认参数拿全表`);
      continue;
    }
    assert.deepEqual(currentCountyCodes(bad), [], `${label} 必须空集，给全表等于一次类型错误出货 2,978 条地址`);
    assert.deepEqual(currentCityCodes(bad), [], `${label} 必须空集，不给收窄不许回落成全表`);
  }

  // 首尾空白是"同一入参"：六个入口必须一起接受
  for (const padded of [' 110101 ', '\t110101\n']) {
    assert.equal(resolveRegion(padded).level, 'county', JSON.stringify(padded));
    assert.equal(isGeneratable(padded, 'county'), true, JSON.stringify(padded));
    assert.equal(provinceName(padded), '北京市', JSON.stringify(padded));
    assert.equal(cityName(padded), '市辖区', JSON.stringify(padded));
    assert.equal(currentCountyCodes(padded).length, 1, JSON.stringify(padded));
  }
  // 前缀入口同样 trim：不 trim 的话 ' 1101 ' 会被当成 6 位前缀去 startsWith，静默空集
  for (const [padded, bare] of [[' 1101 ', '1101'], ['\t11\t', '11']]) {
    assert.equal(currentCountyCodes(padded).length, currentCountyCodes(bare).length,
      `${JSON.stringify(padded)} 与不带空白的必须同一个答案`);
    assert.equal(currentCityCodes(padded).length, currentCityCodes(bare).length,
      `${JSON.stringify(padded)}：市级入口同理，两个入口不能一个 trim 一个不 trim`);
    assert.ok(currentCountyCodes(bare).length > 0, `前缀 ${bare} 一个结果都没有，这条对照本身坏了`);
  }
  // 前缀只收窄、绝不放宽，两个入口必须是同一个意思。市级入口旧写法把任意长前缀一律
  // `slice(0, 2)` 回去查省索引，实测 currentCityCodes('4419') 给 21 条（整个广东省）
  // 而 currentCountyCodes('4419') 给 1 条——'4419' 在县级入口是"东莞市的县"，
  // 在市级入口却变成"广东省的市"。随机地址面板同时用这两个入口，口径分叉就是错数据。
  // 条数是 2026-09-25 快照实读值，'44' 一档同时钉住"省级前缀仍走省索引"：
  // 收窄不等于把 2 位前缀也当成 4 位码的前缀去筛。
  for (const [p, expect] of [['44', 21], ['441', 8], ['4419', 1], ['44190', 0], ['441900', 0]]) {
    const got = currentCityCodes(p);
    assert.equal(got.length, expect, `前缀 ${p} 的收窄结果不对：${got.join(' ')}`);
    assert.ok(got.every((c) => c.startsWith(p)), `前缀 ${p} 收窄出了不匹配前缀的市码：${got}`);
  }
  assert.deepEqual(currentCityCodes('4419'), ['4419'], '4 位前缀只能收窄到那一个市码');
  // 前缀查表的口径写死在这里，免得哪天被当成"入口漏了校验"顺手收紧掉：
  // 传长码取省名/市名是面板的正常用法，位数不等于建制结论
  assert.equal(provinceName('110101'), '北京市');
  assert.equal(cityName('110101'), '市辖区');
  assert.equal(provinceName('99'), '', '不存在的省码得空串，不许造名字');
  assert.equal(cityName('9901'), '', '不存在的市码得空串，不许造名字');

  // 未知层级不得静默落进市级：旧写法是 `level === 'county' ? 县级表 : 市级表`，
  // 于是 isGeneratable('1101', 'province') 拿 4 位市码查市级表，给出一个看着成立的 true
  for (const lvl of ['town', '', 'state', 'county ', 1, null, {}]) {
    assert.equal(isGeneratable('110101', lvl), false, `未知层级 ${String(lvl)} 必须一律 false`);
    assert.equal(isGeneratable('1101', lvl), false, `未知层级 ${String(lvl)} 不该放行 4 位码`);
  }

  // 全表扫一遍，不接受"只覆盖抽到的那几个码"：每一层的现行码在该层必须是可生成档，
  // 且 resolveRegion 说"解到县级"的码 isGeneratable 必须一起说 true（两个入口的口径
  // 只在这一处有正当分叉：441900 / 442000 / 460400 三个不设区地级市，它们的 4 位市码
  // 在市级表里，"市码+00"在县级表里也有，所以 level 是 county —— 见 isGeneratable 的注释）
  for (const c of currentCountyCodes()) assert.equal(isGeneratable(c, 'county'), true, c);
  for (const c of currentCityCodes()) assert.equal(isGeneratable(c, 'city'), true, `${c} 市级现行码应可生成`);
  for (const p of provinceCodes()) assert.equal(isGeneratable(p, 'province'), true, `${p} 省级现行码应可生成`);
  for (const h of historicalCodes()) {
    assert.equal(isGeneratable(h, 'county'), false, `${h} 历史码永远不进级联`);
    // 市级表存的是 4 位键，6 位历史码即使前 4 位撞上一个现行市，也不能按市级放行
    assert.equal(isGeneratable(h, 'city'), false, `${h} 位数不对，不该在市级档命中`);
  }
  // 与 resolveRegion 的横向一致性：凡 level 为 county 的现行码，两个入口都说可生成
  for (const c of currentCountyCodes()) {
    if (resolveRegion(c).level === 'county') assert.equal(isGeneratable(c, 'county'), true, c);
  }
});

// ── §B 身份证 ──────────────────────────────────────────────────────────────

const { parseIdCard, parseIdCardList, generateIdCards, computeCheckDigit,
  WEIGHTS, CHECK_MAP, BIRTH_FLOOR, GENERATE_MAX, USE_NOTE, isLeapYear, daysInMonth,
} = await import('../dev/js/tools/idcard.js');
const { seededRandom } = await import('../dev/js/tools/random.js');

const FX = JSON.parse(read('scripts/fixtures/id-validator-checkbit-1000.json'));
/** 用已钉死的校验位算法造合法输入：判据里不再手算末位 */
const mk = (body17) => body17 + computeCheckDigit(body17);
const p = (c) => parseIdCard(c.id, { today: c.today });
const failedKeys = (r) => r.checks.filter((k) => k.ok === false).map((k) => k.key);
const rowOf = (r, key) => r.checks.find((k) => k.key === key);

test('B1 校验位：§2.2 实跑样本 + 权重表等价性 + 非法输入返回 null 不抛', () => {
  // 这 9 条里前 8 条的期望值来自 2026-09-25 对 demo/idCardDemo/lib/IDValidator.js 的实跑，
  // 不是自家算完自说自话。440524…0014 就是 §2.2 那条"示例号末位是 4 不是 8"。
  // '11010119900307001' 那一档实跑是 1（旧库对 …011 放行、对 …013 拒绝），计划早期写的 3
  // 是抄自上面那条 350 结尾的样本，B4 的三处期望值同步跟。
  // 第 9 条 `99010119900307001 → '5'` **不是**旧库给的：省码 99 不在 GB2260 里，旧库的
  // `isValid` 在区划那一关就返回 false，11 个候选末位它一个都不接受（实跑
  // `['0'..'9','X'].map(c => oracle.isValid('99010119900307001' + c))` 全 false）。
  // '5' 是按标准算式（ISO 7064 MOD 11-2，与上面那条权重表和查表串）算出来的，
  // 这一条的出处是"照标准算"，与旧库无关——上一版注释把它一起记成"来自旧库实跑"，是假的。
  const known = {
    '11010119900307350': '3', '44052418800101001': '4', '11010118991231001': 'X',
    '11010119000101001': '4', '11010119900307001': '1', '11011419900307001': '3',
    '11010120000229001': '8', '11010119990229001': '8', '99010119900307001': '5',
  };
  for (const [body, want] of Object.entries(known)) {
    assert.equal(computeCheckDigit(body), want, `${body} 校验位应为 ${want}`);
  }
  // I-9 的"牙"：上面那段"实跑"此前只写在注释里，而注释里的实测数字复算不出来就是假的
  // （上一版正是把第 9 条一起记成"来自旧库"）。这里把可复算的那半句钉成断言：
  // 旧库对前 8 个 body **恰好只放行我们记下的那一个末位**，对 990101… 则 11 个候选全不放行
  // ——省码 99 不在 GB2260 里，它那一格的 '5' 只能来自标准算式，与旧库无关。
  // 旧库随段 5 删除后这一整块退场（长期守卫是 B7 吃的夹具），已记进计划的段 5 待办。
  const legacyDir = resolve(ROOT, 'demo/idCardDemo/lib');
  const idLib = resolve(legacyDir, 'IDValidator.js');
  if (existsSync(idLib)) {
    const req = createRequire(import.meta.url);
    const legacyGb2260 = req(resolve(legacyDir, 'GB2260.js'));
    const Oracle = req(idLib);
    const oracle = new Oracle(legacyGb2260);
    const CAND = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'];
    for (const [body, want] of Object.entries(known)) {
      const acc = CAND.filter((c) => oracle.isValid(body + c) === true);
      if (body.startsWith('99')) {
        assert.deepEqual(acc, [], `${body}：旧库居然放行了 ${acc.join('/')}，那"第 9 条不来自旧库"这句就是假的`);
      } else {
        assert.deepEqual(acc, [want],
          `${body}：旧库放行的末位是 ${acc.join('/') || '(none)'}，不是记下的 ${want}，"前 8 条来自旧库实跑"就是假的`);
      }
    }
  }

  assert.equal(WEIGHTS.length, 17);
  for (let i = 0; i < 17; i += 1) {
    assert.equal(WEIGHTS[i], 2 ** (17 - i) % 11, `第 ${i + 1} 位权重与 2^(18-i) mod 11 不符`);
  }
  assert.equal(CHECK_MAP, '10X98765432');
  assert.equal(computeCheckDigit('1101011990030735'), null, '16 位 body 要返回 null 而不是抛');
  assert.equal(computeCheckDigit('11010119900307350X'), null, 'body 含非数字要返回 null');
  assert.equal(computeCheckDigit(null), null);
});

test('B2 三态判定与逐项表：三种结论分得开，且看得见是谁否决的', () => {
  const ok = parseIdCard('110101199003073503', { today: TODAY });
  assert.equal(ok.state, 'valid');
  assert.deepEqual(failedKeys(ok), []);
  assert.deepEqual(ok.checks.map((k) => k.key),
    ['charset', 'length', 'region', 'birth', 'order', 'checkBit']);
  assert.equal(ok.info.region.fullName, '北京市东城区');
  assert.equal(ok.info.sex, '女');                                  // 顺序码 350 → 偶 → 女（旧库同结论）
  assert.equal(CHECK_MAP[ok.info.checkWork.sum % 11], ok.info.expectedCheckBit);

  const bad = parseIdCard('110101199003073504', { today: TODAY });   // 末位应为 3
  assert.equal(bad.state, 'checkdigit');
  assert.deepEqual(failedKeys(bad), ['checkBit']);
  assert.equal(bad.expectedCheckBit, '3');
  assert.equal(bad.value, '110101199003073504', '必须原样保留用户填的错末位');
  assert.equal(bad.suggestedId18, '110101199003073503');

  const malformed = parseIdCard('110101199902290018', { today: TODAY });
  assert.equal(malformed.state, 'malformed');
  assert.deepEqual(failedKeys(malformed), ['birth']);
  assert.equal(rowOf(malformed, 'checkBit').ok, true);               // 校验位本身是通的
  assert.equal(parseIdCard('', { today: TODAY }).state, 'empty');
  assert.equal(parseIdCard('   ', { today: TODAY }).state, 'empty');
});

test('B3 字符集与长度：13 组实测边界，含旧库放过而我们不放的', () => {
  const cases = [
    // 小写 x 的样本必须是末位真的该是 X 的号：'…350x' 那一版本体算出来是 3，
    // 拿它当"小写也接受"的用例只会测到 checkdigit 分支（实跑旧库对 …002x 也是 true）
    ['11010119900307002x', 'valid'],
    [' 110101199003073503 ', 'valid'],       // 只 trim 首尾
    ['110101 199003073503', 'malformed'],    // 内部空格不吞，并给出原因
    ['1101011990030735031', 'malformed'],    // 19 位
    ['11010119900307350', 'malformed'],      // 17 位
    ['11010A199003073503', 'malformed'],
    ['1101011990030735X3', 'malformed'],     // X 只允许出现在 18 位串末位
    ['000000000000000000', 'malformed'],     // 省码不存在
    ['11010190030700A', 'malformed'],        // 旧库判有效（checkOrder 恒真），我们不放过
    ['110101900307001', 'valid'],            // 15 位
    ['11010190030700', 'malformed'],         // 14 位
    [null, 'empty'],
    [12345678901234567, 'malformed'],        // 数字入参：转字符串后按长度判（旧库对 >15 位的数字直接拒）
  ];
  for (const [input, want] of cases) {
    assert.equal(parseIdCard(input, { today: TODAY }).state, want, `${String(input)} 应判 ${want}`);
  }
  const spaced = parseIdCard('110101 199003073503', { today: TODAY });
  assert.match(rowOf(spaced, 'charset').detail, /空格/);
  assert.equal(spaced.repairedHint, '110101199003073503');
});

test('B4 15 位与 18 位互为等价写法，且只在无歧义时给', () => {
  const from15 = parseIdCard('110101900307001', { today: TODAY });
  assert.equal(from15.state, 'valid');
  assert.equal(from15.id18, '110101199003070011');   // body 用「区划 + 19 + yyMMdd + 顺序码」拼，不是错位取 8 位
  assert.equal(from15.id15, '110101900307001');

  const from18 = parseIdCard('110101199003070011', { today: TODAY });
  assert.equal(from18.id15, '110101900307001');
  assert.match(from18.id15Note, /由 18 位去世纪位得来/);

  const y2003 = parseIdCard(mk('11010120030701001'), { today: TODAY });
  assert.equal(y2003.state, 'valid');
  assert.equal(y2003.id15, '', '20xx 出生不得给 15 位等价写法（§2.2：造出来是给人埋坑）');
  assert.equal(y2003.id15Note, '');

  // 校验位不符时也要保留用户末位，同时给出建议形态：判据要显示的就是那个错的位
  const wrong = parseIdCard('110101199003070014', { today: TODAY });
  assert.equal(wrong.state, 'checkdigit');
  assert.equal(wrong.id18, '110101199003070014');
  assert.equal(wrong.suggestedId18, '110101199003070011');
});

test('B5 出生日期：闰年、非闰年、上下界、周岁', () => {
  const leap = parseIdCard('110101200002290018', { today: '2026-09-25' });
  assert.equal(leap.state, 'valid');
  assert.equal(leap.info.birth, '2000-02-29');
  assert.equal(leap.info.ageYears, 26);
  assert.equal(parseIdCard('110101190001010014', { today: '2026-09-25' }).state, 'valid', `${BIRTH_FLOOR} 本身在界内`);
  const tooEarly = parseIdCard('11010118991231001X', { today: '2026-09-25' });
  assert.equal(tooEarly.state, 'malformed');
  assert.match(rowOf(tooEarly, 'birth').detail, /1900-01-01/);
  assert.equal(tooEarly.info.birth, '1899-12-31', '越出我们自设下界，仍要把解出来的日期给用户看');
  const notADate = parseIdCard('110101199902290018', { today: '2026-09-25' });
  assert.equal(notADate.info.birth, null, '连真实日期都不成立时不给日期');
  assert.equal(notADate.info.birthRaw, '19990229');
  const future = parseIdCard(mk('11010120270101001'), { today: '2026-09-25' });
  assert.equal(future.state, 'malformed');
  assert.match(rowOf(future, 'birth').detail, /晚于今天/);

  // 生日未到 → 周岁减一；整日比较，不受本机时区影响
  const b = parseIdCard(mk('11010120001231001'), { today: '2026-09-25' });
  assert.equal(b.state, 'valid');
  assert.equal(b.info.ageYears, 25);
  assert.equal(parseIdCard('110101200002290018', { today: '2026-09-25' }).info.ageYears, 26);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(daysInMonth(2100, 2), 28);
});

test('B6 区划查不到不下"无效"结论，且任何输出里不出现「未知」', () => {
  const uncollected = parseIdCard(mk('11019919900307001'), { today: TODAY });
  assert.equal(uncollected.state, 'valid', '县级码查不到不能判无效（§5.4）');
  assert.equal(rowOf(uncollected, 'region').ok, null, '未收录是"不下结论"，不是 false');
  assert.equal(uncollected.hasCaveat, true);
  assert.match(uncollected.caveat, /未收录/);

  const historical = parseIdCard(mk('11010319900307001'), { today: TODAY });   // 崇文区，2010 撤销
  assert.equal(historical.state, 'valid');
  assert.equal(historical.info.region.status, 'abolished');
  assert.match(historical.caveat, /未见于现行区划表/, '历史层措辞要诚实，不能断言"已撤销建制"');
  assert.equal(historical.info.region.fullName, '北京市崇文区');

  // 反面对手：站内旧库对 440524 吐的是「广东省汕头市未知地区」（§2.2 末尾）
  const fallback = parseIdCard(mk('44052419900307001'), { today: TODAY });
  assert.equal(fallback.state, 'valid');
  assert.doesNotMatch(JSON.stringify(fallback.info), /未知/, '我们的输出里不允许出现「未知地区」');
  assert.ok(fallback.info.region.fullName.length > 0);

  // 顺序码 000：记一条但不下无效结论
  const seqZero = parseIdCard(mk('11010119900307000'), { today: TODAY });
  assert.equal(seqZero.state, 'valid');
  assert.equal(rowOf(seqZero, 'order').ok, null);
  assert.match(rowOf(seqZero, 'order').detail, /未分配/);

  for (const code of ['110101', '110103', '110199', '440524', '371202', '500101', '990101', 'abcdef', '', null]) {
    assert.doesNotMatch(resolveRegion(code).fullName, /未知/, `${code} 解出了「未知」`);
  }
});

/**
 * 七组配额与三个取样池的大小。**期望值写死在判据这一侧**，不读夹具自报的 `groupCounts`——
 * 这是 C-3 的整改：原先那三行（`total === 1000`、"自报配额合计 == total"、"自报配额 == 自数组长度"）
 * 两个数出自同一个文件，等于让夹具自己确认自己。本轮在 /tmp 镜像里两种病灶都复算过，都一条不红：
 *   ① `feb29_nonleap: 0` + 名额挪给 `birth_before_1900` ② `agree18: 1 / agree15: 769`
 * ——第 ② 种之下 670 条 agree18 样本塌成 1 条（老判据下的 uniq/n 实测是 `agree18=1/1`），
 * 而三条自证断言照旧全绿（复核者在上一版那 21 条上量到的是 `# pass 21 / # fail 0`；本轮把
 * 老三条装回现在这套判据里跑，是 `# pass 26 / # fail 0`——多出来的 5 条与本组无关，不改变结论）。
 * 换成下面这两个写死的常量之后，同样的两种病灶各自跑一遍都是 `# tests 26 / # pass 25 / # fail 1`，
 * 红的都是本条（B7），报的是"配额与计划规定值不符"。
 * 这两个常量是外部事实：配额是计划 §4.1 规定值，池子大小是四份哈希钉死的快照的函数
 * （与 A1/A2 钉 `REGION_META.counts` 同一形状）。换快照 = 池子变 = 这里红，是设计意图。
 */
const EXPECT_QUOTA = {
  agree18: 670, agree15: 100, name_current_only: 100, renamed: 50,
  birth_before_1900: 30, birth_after_today: 30, feb29_nonleap: 20,
};
const EXPECT_POOLS = {
  sameName: 1776, renamed: 156, onlyCurrent: 1046,
  renamedByCounty: 62, renamedByLegacyPrefix: 93, renamedByPlaceholder: 1,
};

test('B7 与站内旧库对拍：同结论组守住，分歧组方向守住', () => {
  const quotaTotal = Object.values(EXPECT_QUOTA).reduce((a, b) => a + b, 0);
  assert.equal(quotaTotal, 1000, '判据这一侧写死的七组配额合计不再是 1000，先想清楚再改');
  assert.deepEqual(FX.groupCounts, EXPECT_QUOTA, '生成器的分组配额与计划规定值不符');
  assert.deepEqual(FX.pools, EXPECT_POOLS, '取样池大小与快照实读值不符（换了快照要同步这里）');
  // F7-6：生成器注释里那句「`pools` 里的三个数之和要等于 RENAMED.length」（在 `sameNameAsLegacy`
  // 的 JSDoc 末尾）与 §4.11 的 I-7 行都写着"三个成因之和 == RENAMED.length，B7 钉着"，
  // 而 B7 此前只做一次 deepEqual 六个常数，一次都没算过和——那句话不是事实。现在钉上：
  // 上面那道 deepEqual 已经逐个数比过，所以这一行咬的是"改了三分中的某一个、忘了改 renamed"
  // 那一种未来编辑（deepEqual 那一条会红，但红的是"数字不符"而不是"这句话不成立"，
  // 后者只有这一行说得出）。两条各比一侧，判据侧与夹具侧都要自洽。
  const causeSum = EXPECT_POOLS.renamedByCounty + EXPECT_POOLS.renamedByLegacyPrefix + EXPECT_POOLS.renamedByPlaceholder;
  assert.equal(causeSum, EXPECT_POOLS.renamed,
    `renamed 的三类成因之和 ${causeSum} 与判据侧写死的 renamed ${EXPECT_POOLS.renamed} 不符——那句"之和等于池子"的话就假了`);
  const fxSum = FX.pools.renamedByCounty + FX.pools.renamedByLegacyPrefix + FX.pools.renamedByPlaceholder;
  assert.equal(fxSum, FX.pools.renamed, `夹具自报的三类成因之和 ${fxSum} 不等于自报的 renamed ${FX.pools.renamed}`);
  assert.equal(FX.total, quotaTotal);
  assert.deepEqual(Object.keys(FX.cases).sort(), Object.keys(EXPECT_QUOTA).sort(), '夹具的组名集合变了');
  for (const [g, n] of Object.entries(EXPECT_QUOTA)) {
    assert.equal(FX.cases[g].length, n, `${g} 组实际条数与计划规定的 ${n} 不符`);
    // 覆盖力要按**取样池那一维**去重：每组内部的多样性只来自区划码（生日与顺序码每条独立摇，
    // 整串号码去重数因此几乎恒等于 1.000，塌不掉）。上一版注释写的"取样池塌掉时 uniq 会跟着塌"
    // 是假话，本轮在镜像里量过：把生成器的 `pick(arr)` 换成 `arr[0]`（1,000 条共用一个区划码）
    // 重跑生成器，老的那三条自证断言一条都不红（台账 C-2b：`# pass 26 / # fail 0`），
    // 只把下面这一行摘掉、病灶留着，同样全绿（台账 C-2c）——两件事合起来说明老判据没牙、
    // 而这一行是唯一咬得住的那一口。实读七组的去重区划码：557/670、97/100、94/100、41/50、
    // 30/30、30/30、20/20，一半这个门槛留有一倍以上的余量。
    const areas = new Set(FX.cases[g].map((c) => c.id.slice(0, 6)));
    assert.ok(areas.size >= Math.ceil(n / 2),
      `${g} 只取了 ${areas.size}/${n} 个不同区划码，取样池塌了，判据没有覆盖力`);
    // 整串号码那一维换一条判法：不许有重复（同一条号码交两次考卷 = 那一格没测新东西）。
    // 实读七组都是 n/n，所以这里钉的是"相等"而不是"不少于一半"。
    assert.equal(new Set(FX.cases[g].map((c) => c.id)).size, n, `${g} 组内有重复号码`);
  }

  // m-6：这一组循环跑 1,000 条，报错文案里没有 `c.id` 的那几条，红了只知道"某一条不一致"、
  // 不知道是哪一条（agree18 第 400 条红，报的只有 `'男' !== '女'`）。全部补上 c.id。
  for (const c of FX.cases.agree18) {
    assert.equal(c.oracleValid, true, `agree18 ${c.id} 旧库判了无效，这组不成立`);
    const r = p(c);
    assert.equal(r.state, 'valid', `agree18 ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.fullName, c.oracleAddr, `${c.id} 地址名与旧库不一致`);
    assert.equal(r.info.birth, c.oracleBirth, `agree18 ${c.id} 出生日期与旧库不一致`);
    assert.equal(r.info.sex, c.oracleSex, `agree18 ${c.id} 性别与旧库不一致`);
  }
  for (const c of FX.cases.agree15) {
    const r = p(c);
    assert.equal(r.state, 'valid', `agree15 ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.fullName, c.oracleAddr, `agree15 ${c.id} 地址名与旧库不一致`);
    assert.equal(r.id18.slice(0, 17), `${c.id.slice(0, 6)}19${c.id.slice(6, 12)}${c.id.slice(-3)}`,
      `agree15 ${c.id} 的 18 位等价写法本体不对`);
  }

  // 我们更新（一）：旧库在"仅现行表有"的码上回落到市级并吐「未知地区」
  for (const c of FX.cases.name_current_only) {
    assert.match(c.oracleAddr, /未知地区/, `name_current_only ${c.id} 夹具里旧库结论应带「未知地区」，否则这组不成立`);
    const r = p(c);
    assert.equal(r.state, 'valid', `name_current_only ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.status, 'current', `name_current_only ${c.id} 不是现行县级码`);
    assert.equal(r.info.region.county, c.currentName, `${c.id} 没解出现行县级名`);
    assert.doesNotMatch(r.info.region.fullName, /未知/, `name_current_only ${c.id} 解出了「未知」`);
  }
  // 我们更新（二）：同码异名，旧库给 2015 年前后的旧名。156 条按成因分三类（实读，见 `FX.pools`）：
  // 62 条县名自己改过、93 条县名没变而旧表那一段市名/省名是旧口径、1 条（620201 嘉峪关市）
  // 旧表在市级码下挂的是「市辖区」占位条——三类都是"我们给现行名、旧库给旧串"，方向同一个，
  // 但第三类不是改名，别把它记进"县名改过"那一档（上一版就是这么记错的）。
  for (const c of FX.cases.renamed) {
    assert.equal(c.oracleValid, true, `renamed ${c.id} 旧库判了无效，这组不成立`);
    assert.doesNotMatch(c.legacyName, new RegExp(`^${c.currentName}$`), `renamed ${c.id} 旧名与新名一字不差`);
    const r = p(c);
    assert.equal(r.state, 'valid', `renamed ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.county, c.currentName, `${c.id} 应当给现行名`);
    assert.equal(r.info.region.fullName.endsWith(c.currentName), true, `renamed ${c.id} 全名末段不是现行县级名`);
    assert.notEqual(r.info.region.fullName, c.oracleAddr, `${c.areaCode} 新旧同名，不该进这组`);
  }

  // 我们更严：只允许由出生日期单独否决，别把校验位算术也污染了
  for (const g of ['birth_before_1900', 'birth_after_today', 'feb29_nonleap']) {
    for (const c of FX.cases[g]) {
      assert.equal(c.oracleValid, true, `${g}: 旧库判了无效，这组的分歧方向不成立`);
      const r = p(c);
      assert.equal(r.state, 'malformed', `${g} ${c.id} 判成 ${r.state}`);
      assert.deepEqual(failedKeys(r), ['birth'], `${g} 应只由出生日期否决`);
      assert.equal(rowOf(r, 'checkBit').ok, true, `${g} 的校验位算术被污染了`);
    }
  }
});

test('B8 生成：确定性、边界、只用现行码、每条自检为有效', () => {
  const a = generateIdCards({ count: 5, today: TODAY, rng: seededRandom(20260925), provinceCode: '11' });
  const b = generateIdCards({ count: 5, today: TODAY, rng: seededRandom(20260925), provinceCode: '11' });
  assert.deepEqual(a.map((x) => x.id18), b.map((x) => x.id18), '同种子必须同输出');
  assert.equal(a.length, 5);
  for (const g of a) {
    assert.match(g.areaCode, /^11/);
    assert.equal(resolveRegion(g.areaCode).status, 'current', `${g.areaCode} 不是现行县级码（历史码禁止用于生成）`);
    assert.equal(parseIdCard(g.id18, { today: TODAY }).state, 'valid', `${g.id18} 自检不过`);
    assert.ok(g.id18.endsWith(g.checkBit));
    // 顺序码的不变量是「三位数字且不为 000」（§5.4：实际取 001–999），不是"首位非零"。
    // 上一轮写的 `/[1-9]\d{2}/` 把 055、007 这类合法顺序码一并判死——本轮 C-1 改了随机流
    // 消耗顺序后它当场误伤一条 `055`，正好证明它从一开始就是错的，只是没被抽到而已。
    assert.ok(/^\d{3}$/.test(g.seq) && g.seq !== '000', `顺序码 ${g.seq} 应落在 001..999`);
  }
  assert.equal(generateIdCards({ count: 1, today: TODAY, rng: seededRandom(1), sex: 'male' })[0].sex, '男');
  assert.equal(generateIdCards({ count: 20, today: TODAY, rng: seededRandom(7), sex: 'female' })
    .every((x) => x.sex === '女'), true, '指定性别却出了男，奇偶调整有洞');
  assert.equal(generateIdCards({ count: 3, today: TODAY, rng: seededRandom(8), birthDate: '2005-04-01' })
    .every((x) => x.birth === '2005-04-01'), true);
  // 边界一律抛，不静默截断（§7 输入硬上限口径）
  for (const bad of [0, -1, 51, 1.5, '5', null]) {
    assert.throws(() => generateIdCards({ count: bad, today: TODAY }), RangeError, `count=${String(bad)} 应抛`);
  }
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, birthDate: '2099-01-01' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, birthDate: '1899-01-01' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, areaCode: '990101' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, minAge: 60, maxAge: 18 }), RangeError);
  assert.equal(GENERATE_MAX, 50, '上限 50：不提供"批量导出 1 万条"（§11 风险表）');
  assert.match(USE_NOTE, /不得用于任何真实身份用途/);
  assert.match(USE_NOTE, /仅供开发与测试用途/);
});

test('B9 批量粘贴：逐行独立、行号与粘贴对齐、空行也占一条', () => {
  const rows = parseIdCardList(
    '110101199003073503\n\n440524188001010014\n110101199003073504',
    { today: TODAY },
  );
  assert.equal(rows.length, 4, '空行也要占一条，用户看的是同一个行号');
  assert.deepEqual(rows.map((r) => r.no), [1, 2, 3, 4]);
  assert.equal(rows[0].result.state, 'valid');
  assert.equal(rows[1].result.state, 'empty');
  // 第 3 行是 §2.2 那条 1880 年出生的样本：单条与批量必须同结论（出生日期早于下界）
  assert.equal(rows[2].result.state, 'malformed');
  assert.deepEqual(failedKeys(rows[2].result), ['birth']);
  assert.equal(rows[3].result.state, 'checkdigit');
  assert.equal(parseIdCardList(null, { today: TODAY }).length, 0);
  assert.equal(parseIdCardList('110101199003073503\r\n110101199003073504', { today: TODAY }).length, 2);
});

/**
 * B10–B12 是 2026-09-25 第四轮质量复核（3 Critical + 7 Important + 4 Minor）的整改判据。
 * 每条先写出来跑一遍看它今天红不红（红的才是"今天还坏着"的证据），再改实现，再跑变异。
 */

/** 跑一次 generateIdCards，只把抛出的错误拿回来；不抛则返回 null。 */
const genError = (options) => {
  try {
    generateIdCards({ count: 1, rng: seededRandom(4242), ...options });
    return null;
  } catch (e) {
    return e;
  }
};

test('B10 入参闸门：坏类型与坏日历日期在入参阶段点名，随机源任何整数都是一条独立流', () => {
  // I-6：`birthDate: '1999-02-30'` 此前只查格式不查日历，一路摇到自检那一关，抛出来的是
  // `Error: 内部不变量：生成的 420581199902302791 自检为 malformed（出生日期：1999 年 2 月没有
  // 30 日（该月最多 28 天））`——调用方的一次类型错误被记成"实现有 bug"。现在报错必须点名
  // options.birthDate。那句里的号连着构造抄（m-5）：镜像上把 `toDay` 的日历校验摘回只查格式
  // 那一行，跑 `generateIdCards({ count: 1, today: '2026-09-25', rng: seededRandom(4242),
  // birthDate: '1999-02-30' })`；抛的是裸 `Error`，不是 `RangeError`（上一版把类型记错过一次，
  // 还举了另一条 `451022199902309415`——那条走的是时间种子，谁也复现不出来）。
  const gate = [
    [{ birthDate: '1999-02-30' }, /options\.birthDate/, '格式对、日历不存在的出生日期'],
    [{ birthDate: '1999-13-01' }, /options\.birthDate/, '月份 13 的出生日期'],
    [{ birthDate: '1999-2-3' }, /options\.birthDate/, '没补零的出生日期'],
    [{ birthDate: '昨天' }, /options\.birthDate/, '不是日期的出生日期'],
    [{ birthDate: 20050401 }, /options\.birthDate/, '数值型出生日期（M-11 同族：不许 String() 洗白）'],
    [{ today: '昨天' }, /options\.today/, 'M-12：不是 YYYY-MM-DD 的 today 此前静默取墙钟'],
    [{ today: '1999-02-30' }, /options\.today/, '日历不存在的 today'],
    [{ rng: () => 2 }, /options\.rng/, '返回区间外值的 rng 此前一路摇出 undefined192225011999null'],
    [{ rng: 'not-a-function' }, /options\.rng/, '非函数的 rng'],
    [{ areaCode: 110101 }, /options\.areaCode/, 'M-11：数值区划码被 String() 洗成合法前缀'],
    [{ provinceCode: 11 }, /options\.provinceCode/, 'M-11：数值省码同上，且 region.js 刚堵掉过这一族'],
    [{ cityCode: null }, /options\.cityCode/, 'M-11：null 此前等于"不收窄"，静默出货全表地址'],
    // F3：`prefixOf` 那句"空串 / 全空白也抛"此前只有 JSDoc 与 §4.11 的 M-11 行在承诺，
    // 而这三个键注入过的是 110101 / 11 / null——一次 ''、一次 '   ' 都没有。本轮在镜像上实测：
    // 摘掉 `|| v.trim() === ''` 之后 27 条判据一条不红，而
    // `generateIdCards({ count: 1, today: '2026-09-25', rng: seededRandom(4242), areaCode: '   ' })`
    // 安静出货 `420581197709189310`（湖北省宜昌市宜都市）——地址取自整张 2,978 条现行表，
    // `''` 与三个键各自的空白串一并如此（同一条流，所以四条出货一模一样）。
    // 闸门在循环里是**逐键**的，所以三个键各钉两条（空串 / 全空白），一条都不许只靠"另一个键红过"。
    [{ areaCode: '' }, /options\.areaCode/, 'F3：空串收窄＝"候选为零"，与"没收窄"是两种用户意图'],
    [{ areaCode: '   ' }, /options\.areaCode/, 'F3：全空白串同一条，此前只被 v.trim() 那一支守着'],
    [{ cityCode: '' }, /options\.cityCode/, 'F3：空串那一支对 cityCode 同样必须成立'],
    [{ cityCode: '\t ' }, /options\.cityCode/, 'F3：全空白对 cityCode 同样必须成立'],
    [{ provinceCode: '' }, /options\.provinceCode/, 'F3：空串对省码同样必须成立'],
    [{ provinceCode: '   ' }, /options\.provinceCode/, 'F3：全空白对省码同样必须成立'],
    // m-4：`shapeOf` 把 Invalid Date 报成 `Date`，报错于是自己跟自己打架——
    // 「应为 YYYY-MM-DD 字符串或 Date，收到 Date」。修的是文案那一侧（实现的选择保留）。
    [{ today: new Date('nope') }, /Invalid Date/, 'Invalid Date 必须被点出来，不许只说"收到 Date"'],
    [{ minAge: 18.5 }, /options\.minAge/, '非整数周岁下界'],
    [{ maxAge: '60' }, /options\.maxAge/, '字符串周岁上界'],
  ];
  for (const [options, want, why] of gate) {
    const err = genError(options);
    // 报错文案要"点名入参"，但消息本身要等到确实没抛时才去跑第二遍——
    // 写成 `assert(err, \`…${JSON.stringify(generateIdCards(options))}\`)` 会在**通过**的那一轮
    // 就把模板字符串算出来，于是坏入参自己先抛穿判据（本轮实测踩过一次）。
    if (!err) {
      const shipped = JSON.stringify(generateIdCards({ count: 1, rng: seededRandom(4242), ...options }));
      assert.fail(`${why}：居然安静出货 ${shipped}`);
    }
    assert.match(err.message, want, `${why}：报错没点名是哪个入参 → ${err.message}`);
    assert.doesNotMatch(err.message, /内部不变量/, `${why}：入参错误被记成实现有 bug → ${err.message}`);
  }
  // 两个入口的入参口径必须一致（M-14）：today 收 Date 而 birthDate 拒 Date 是分裂。
  const dated = generateIdCards({ count: 2, today: new Date(2026, 8, 25), birthDate: new Date(2000, 2, 7) });
  assert.ok(dated.every((g) => g.birth === '2000-03-07'), 'Date 型 birthDate 与 today 必须同口径被接受');
  assert.equal(parseIdCard('110101199003073503', { today: new Date(2026, 8, 25) }).info.ageYears, 36);
  // M-14：`parseIdCard(x, null)` 此前抛 "Cannot read properties of null"，而 opts 是可选参数。
  assert.equal(parseIdCard('110101199003073503', null).state, 'valid', 'opts 传 null 等于没传，不该抛');
  // F4：M-14 只修了那一半。`generateIdCards(null)` 抛的是
  // `TypeError: Cannot read properties of null (reading 'areaCode')`——一个入参名字都不点，
  // 把调用方传进来的 null 报成引擎崩溃；而 `generateIdCards` 开头那句 `const o = options ?? {}`
  // 说明作者本来就预期 null，JSDoc 也写着"入参口径与 parseIdCard 一致"。两个入口现在都得守这一条。
  assert.equal(generateIdCards(undefined).length, 1, 'options 传 undefined 等于没传，默认一条');
  const nullOptions = generateIdCards(null);
  assert.equal(nullOptions.length, 1, 'options 传 null 等于没传，默认一条');
  assert.match(nullOptions[0].id18, /^\d{17}[0-9X]$/, 'null 入参也要出货一个形态完整的号');
  assert.equal(parseIdCard(nullOptions[0].id18).state, 'valid', '两个入口都不传 today 时必须自洽');
  // m-2：`todayOf` 与 `checkedRng` 各有一条"null 算没传"的分支，此前零判据——把 null 改成
  // 抛 TypeError，26 条判据一条都不红（实测）。两条各钉一次，注释里那半句"面板发的就是 null"
  // 也才有东西撑着：它是段 2 的**计划**，不是今天的调用方（`dev/js/toolIdcard.js` 还没写）。
  assert.equal(parseIdCard('110101199003073503', { today: null }).state, 'valid',
    'today 传 null 等于没传：按墙钟判，不许抛');
  const nullDefaults = generateIdCards({ count: 1, today: null, rng: null });
  assert.equal(nullDefaults.length, 1, 'today / rng 传 null 等于没传，不许抛');
  assert.equal(parseIdCard(nullDefaults[0].id18).state, 'valid', '时间种子那条流也要出货自洽');
  assert.throws(() => parseIdCard('110101199003073503', { today: '昨天' }), /options\.today/, 'M-12');
  assert.throws(() => parseIdCardList('110101199003073503', { today: '昨天' }), /options\.today/,
    '批量入口与单条入口必须同一个报错口径');
  // 正向对照：闸门不许把合法入参一起关掉
  const fine = generateIdCards({
    count: 3, today: TODAY, rng: seededRandom(7), areaCode: '110101', birthDate: '2000-03-07', sex: 'female',
  });
  assert.equal(fine.length, 3);
  assert.ok(fine.every((g) => g.areaCode === '110101' && g.birth === '2000-03-07' && g.sex === '女'));

  // I-10：文件头原先写「mulberry32 在种子 0 下退化」，实测是假话——`a` 先自增再被使用，
  // 种子 0 是一条正常流。真正做过的事是 `(seed >>> 0) || 1` 把 0 改写成 1，代价是
  // 「0 与 1 是同一条流」（实测两边前三个输出逐字相同：0.627074, 0.002736, 0.527447）。
  // 现在不再改写种子，任何整数各占一条流。
  const stream = (seed) => { const f = seededRandom(seed); return [0, 1, 2, 3, 4, 5, 6, 7].map(() => f()); };
  const s0 = stream(0);
  const s1 = stream(1);
  assert.deepEqual(stream(0), s0, '同种子必须同流（可注入随机源的存在理由）');
  assert.notDeepEqual(s0, s1, '种子 0 不得再被改写成 1：两条流必须分得开');
  assert.equal(new Set(s0).size, 8, '种子 0 的流退化（输出出现重复值）');
  for (const v of s0) assert.ok(v >= 0 && v < 1, `输出越界：${v}`);
  assert.ok(s0.some((v) => v > 0.5), '种子 0 的流全挤在低区，不像一条健康的流');
});

test('B11 生成的生日真的落在请求的周岁区间里：生日没过不许少算一岁', () => {
  // C-1：原先写 `year = today.y - age`，没算"今年的生日过没过"，minAge:18 会生成 17 周岁的人。
  // 复算口径（第八轮本轮跑过）：把 randomBirthDay 换回整改前那七行，跑
  // `generateIdCards({ count: 50, today: '2026-09-25', rng: seededRandom(s) })`，s = 1..60
  // → 3,000 条里 **19 条** 17 周岁。同一个病灶换个种子集会给出 18 / 20 / 24 / 30，所以这里
  // 只把"构造 + 结果"一起写，不单独留一个复算不出来的计数（上一版那句"20 条"就是这么留下的，
  // 复核者按 s = 20260925..84 跑给的是 18）。`23082820081021721X` 是手搓的样例不是生成结果
  // （2008-10-21 生、today 2026-09-25 → 17 周岁，parseIdCard 判 valid），它只用来示意形状。
  // 周岁在判据这一侧独立复算一遍，不读 info.ageYears（读它就等于让被测侧自己作证）。
  const todayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
  const fullYears = (birthIso, todayIso) => {
    const b = todayOf(birthIso); const t = todayOf(todayIso);
    return t.y - b.y - (t.m < b.m || (t.m === b.m && t.d < b.d) ? 1 : 0);
  };
  const windows = [[18, 60], [0, 0], [0, 120], [18, 18], [30, 30], [65, 120], [1, 2]];
  const todays = ['2026-09-25', '2024-02-29', '2026-01-01', '2026-12-31', '2023-02-28'];
  for (const today of todays) {
    for (const [minAge, maxAge] of windows) {
      for (let s = 0; s < 4; s += 1) {
        for (const g of generateIdCards({ count: 25, today, rng: seededRandom(9100 + s), minAge, maxAge })) {
          const age = fullYears(g.birth, today);
          assert.ok(age >= minAge && age <= maxAge,
            `today=${today} 请求 [${minAge},${maxAge}] 周岁，实给 ${age}（生日 ${g.birth}）`);
          assert.equal(g.age, age, `today=${today} ${g.id18} 自报 age=${g.age} 与复算 ${age} 不符`);
          assert.ok(g.birth <= today, `today=${today} 生成了未来日期 ${g.birth}`);
          assert.equal(parseIdCard(g.id18, { today }).state, 'valid', `${g.id18} 自检不过`);
        }
      }
    }
  }
  // 退一年落到 2/29 的那一格：today 是 2/29、目标生成年非闰时，不许写出 2/30 之类的假日期
  for (const g of generateIdCards({ count: 50, today: '2024-02-29', rng: seededRandom(31), minAge: 0, maxAge: 60 })) {
    const [by, bm, bd] = g.birth.split('-').map(Number);
    const back = new Date(Date.UTC(by, bm - 1, bd));
    assert.equal(back.getUTCFullYear(), by, `${g.birth} 不是一个真实存在的日历日期`);
    assert.equal(back.getUTCMonth() + 1, bm, `${g.birth} 不是一个真实存在的日历日期`);
    assert.equal(back.getUTCDate(), bd, `${g.birth} 不是一个真实存在的日历日期`);
    assert.ok(fullYears(g.birth, '2024-02-29') <= 60, `${g.birth} 的周岁越出请求的 [0,60]`);
  }
  // 窗口为空：本站下界 1900-01-01 之上取不到 [18,60] 的周岁时，必须点名"周岁区间"而不是摇出坏号
  const err = genError({ today: '1900-06-01', minAge: 18, maxAge: 60 });
  if (!err) assert.fail('周岁窗口与下界无交集时居然安静出货了');
  assert.match(err.message, /周岁区间/, `空窗口必须点名"周岁区间"：${err.message}`);
});

test('B12 区划 unknown 判结构非法；结构非法不出货解释性结论', () => {
  // I-4：`regionOk` 的 false 那一支此前零判据——把 unknown 归成 null 之后 21 条判据一条都不红，
  // 而 990101199003070015 会被判成 valid。B3 里的 000000000000000000 是被"月份 00"双重故障
  // 顺手拦下的，不替这一支作证（摘掉 false 那一支它照旧 malformed）。
  const unknown = parseIdCard('990101199003070015', { today: TODAY });
  assert.equal(unknown.state, 'malformed', '省码根本不在表里 = 结构非法，不是"不下结论"');
  assert.equal(rowOf(unknown, 'region').ok, false, 'unknown 必须落 false');
  assert.deepEqual(failedKeys(unknown), ['region']);
  // 与"未收录"那一档分得开：440524 / 110199 是 null（§5.4 查不到不等于无效），两档不能合并
  assert.equal(rowOf(parseIdCard(mk('11019919900307001'), { today: TODAY }), 'region').ok, null);
  assert.equal(rowOf(parseIdCard(mk('44052419900307001'), { today: TODAY }), 'region').ok, null);
  assert.equal(rowOf(parseIdCard(mk('11010319900307001'), { today: TODAY }), 'region').ok, true);
  // 三档各钉一条，让"两档不能合并"这件事本身可红：unknown→false、uncoded→null、current→true
  assert.equal(resolveRegion('990101').status, 'unknown');
  assert.equal(resolveRegion('110199').status, 'uncoded');
  assert.equal(resolveRegion('440524').status, 'uncoded');
  assert.equal(resolveRegion('110101').status, 'current');

  // I-5：结构非法的号码照旧出货派生字段（Task 3 刚在区划侧修过同族缺陷）。实测清单：
  // 990101199003070015 与 000000199003070015 都是 malformed，却给 seq=001 | sex=男 |
  // ageYears=36 | birth=1990-03-07 | body17=…；110101290001010012（2900 年出生）malformed 却给 sex=男；
  // 110101199902290018（非闰年 2/29）malformed 却给 seq=001 | sex=男。
  const RAW = ['areaCode', 'birthRaw', 'seq', 'body17'];
  const FORM = ['id18', 'id15', 'id15Note', 'suggestedId18'];
  // 走到解码之后才被判死的：info 在，但解释性结论（sex）与四个形态字段必须空
  //
  // F2：`parseIdCard` 末尾那两条 `ship` 分支（18 位一条、15 位一条），15 位这一条此前**一次
  // 都没被结构非法的输入走过**：下面这个名单当时只有五条 18 位的，而 B3 的 `11010190030700A`
  // 在字符集那一关就 return 了、走不到这里。整改前把 15 位那一支改成无条件 `} else {`，
  // 当时的 26 条判据一条不红。本轮在镜像上自己复跑了两组：摘闸门 → 27 条里只 B12 红；
  // 补上判据之前同样的针子 → 一条不红。出货差别也是本轮实跑的（today 一律 '2026-09-25'）：
  //   990101900307001（省码 99 不在表）   现状 id18=""  id15=""
  //   110101900230001（1990-02-30 不存在） 现状 id18=""  id15=""
  //   摘掉闸门：前者 id18="990101199003070015" id15="990101900307001"；后者 id18="110101199002300014" id15="110101900230001"
  for (const id of ['990101199003070015', '000000199003070015', '110101290001010012',
    '110101199902290018', '11010118991231001X', '990101900307001', '110101900230001']) {
    const r = parseIdCard(id, { today: TODAY });
    assert.equal(r.state, 'malformed', `${id} 这一版应当还是 malformed，判据才测得到出货口径`);
    if (!r.info) assert.fail(`${id} 结构非法到连 info 都不给——sex/形态字段那一条就无从判起，见 B12 后半段的分档`);
    assert.equal(r.info.sex, '', `${id} 结构非法却给出 sex=${JSON.stringify(r.info.sex)}`);
    for (const k of FORM) {
      assert.equal(r[k], '', `${id} 结构非法却给出 ${k}=${JSON.stringify(r[k])}`);
    }
    // 原始回显一律留着：逐项表要说得出"坏在哪一段"，B5 还指着 birthRaw 与越界日期
    for (const k of RAW) assert.ok(typeof r.info[k] === 'string', `${id} 的原始字段 ${k} 不能消失`);
    assert.equal(r.info.areaCode, id.slice(0, 6), `${id} 的区划段回显不对`);
    assert.ok(r.checks.some((c) => c.ok === false), `${id} 总得有一行 false 说清坏在哪`);
  }
  // 连长度 / 字符集这关都过不去的：整个 info 不给（此时没有任何"解出来"的东西可描述，
  // 面板对这一类的活是把原始输入与那一行 false 摆出来），形态字段同样为空
  for (const id of ['110101 199003073503', '11010119900307350']) {
    const r = parseIdCard(id, { today: TODAY });
    assert.equal(r.state, 'malformed', `${id} 这一版应当还是 malformed`);
    assert.equal(r.info, null, `${id} 长度/字符集未过，不该凭空拼出一个解码对象`);
    for (const k of FORM) assert.equal(r[k], '', `${id} 长度/字符集未过却给出 ${k}=${JSON.stringify(r[k])}`);
    assert.equal(r.value.length > 0, true, `${id} 的原始回显（value）不能消失`);
  }
  // 越下界但仍是一个真日历日期 → 日期照给（B5 已钉那一条），解释性结论照样收回去
  const early = parseIdCard('11010118991231001X', { today: TODAY });
  assert.equal(early.info.birth, '1899-12-31', '越出本站下界仍要把解出来的日期给用户看（§5.4 口径不变）');
  assert.equal(early.info.ageYears, null, '越下界不给周岁');
  assert.equal(early.info.sex, '');
  // checkdigit 态是另一回事：号码其余部分确实可解，面板的活就是给出"算得 X / 你填 Y"和可抄的建议形态
  const cd = parseIdCard('110101199003073504', { today: TODAY });
  assert.equal(cd.state, 'checkdigit');
  assert.equal(cd.info.sex, '女');
  assert.equal(cd.id15, '110101900307350');
  assert.equal(cd.suggestedId18, '110101199003073503');
  assert.equal(cd.expectedCheckBit, '3');
  const cd15 = parseIdCard('11010190030700A', { today: TODAY });
  assert.equal(cd15.state, 'malformed');
  assert.equal(cd15.id15, '', '15 位末位混进字母的那一条旧库放行、我们判非法，非法就不出货');
});

test('B13 2 月 29 逐年前后各扫一遍：闰年成立、非闰只由出生日期否决', () => {
  // M-13：夹具的 agree 组里 2/29 样本实测 0 条（1,000 条中只有 feb29_nonleap 那 20 条是 2/29），
  // 而生成器里那句 `if (isLeap(y)) y -= 2` 不可达（y 已被前一行减成奇数，闰年必为偶数），
  // 所以"闰年 2/29 判有效"此前只有 B5 一条硬编码在守。这里按年扫，闰律在判据一侧独立写一遍。
  const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  for (let y = 1901; y <= 2100; y += 1) {
    const r = parseIdCard(mk(`110101${y}0229001`), { today: '2100-12-31' });
    assert.equal(daysInMonth(y, 2), leap(y) ? 29 : 28, `${y} 年的 2 月天数不对`);
    if (leap(y)) {
      assert.equal(r.state, 'valid', `${y} 是闰年，2/29 必须成立`);
      assert.deepEqual(failedKeys(r), []);
    } else {
      assert.equal(r.state, 'malformed', `${y} 不是闰年，2/29 必须判结构非法`);
      assert.deepEqual(failedKeys(r), ['birth'], `${y} 的否决项必须是出生日期单独那一条`);
      assert.equal(rowOf(r, 'checkBit').ok, true, `${y}：校验位算术不许被连累`);
      assert.equal(r.info.birth, null);
    }
  }
  // 2/28 在两种年份都成立：别把"闰年判断"写成"2 月只许 28 天"之外的样子
  for (const y of [1900, 2000, 2100, 2024]) {
    assert.equal(parseIdCard(mk(`110101${y}0228001`), { today: '2100-12-31' }).state, 'valid', `${y}-02-28`);
  }
});

/** 身份证夹具生成器与它的输入。判据全在临时副本上跑：夹具是提交进仓库的产物，动一下就没了。 */
const ID_GEN = resolve(HERE, 'build-id-fixture.mjs');
const ID_FIXTURE = resolve(ROOT, 'scripts/fixtures/id-validator-checkbit-1000.json');

/**
 * 把生成器、四份区划快照、旧库两份 lib 与当前夹具搬进一个临时仓库根。
 * @param {{mutateGenerator?:(s:string)=>string}} [opts] mutateGenerator 改写副本里的生成器源码
 *   （B14 用它把配额改成"合计 995"，量那道"总数闸门"的报法）。仓库里那份一个字节都不碰。
 */
function makeIdTmpRepo({ mutateGenerator = (s) => s } = {}) {
  // 先改写再建目录：mutateGenerator 里的锚点计数会抛，那时候还没留下任何待清的 tmpdir
  const genSrc = mutateGenerator(readFileSync(ID_GEN, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'id-fixture-'));
  const fixtureDir = resolve(tmp, 'scripts/fixtures');
  const regionDir = resolve(fixtureDir, 'region-source');
  const libDir = resolve(tmp, 'demo/idCardDemo/lib');
  mkdirSync(regionDir, { recursive: true });
  mkdirSync(libDir, { recursive: true });
  for (const f of readdirSync(FIXDIR)) copyFileSync(resolve(FIXDIR, f), resolve(regionDir, f));
  for (const f of ['GB2260.js', 'IDValidator.js']) {
    copyFileSync(resolve(ROOT, 'demo/idCardDemo/lib', f), resolve(libDir, f));
  }
  copyFileSync(ID_FIXTURE, resolve(fixtureDir, 'id-validator-checkbit-1000.json'));
  writeFileSync(resolve(tmp, 'scripts/build-id-fixture.mjs'), genSrc);
  return {
    tmp,
    gen: resolve(tmp, 'scripts/build-id-fixture.mjs'),
    fixture: resolve(fixtureDir, 'id-validator-checkbit-1000.json'),
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

test('B14 夹具生成器的参数闸门：拼错的开关不得落到覆盖夹具那一支，--check 不许顺手写', () => {
  // I-8：`node scripts/build-id-fixture.mjs --nope` 此前退 0 并**覆盖夹具**——
  // `build-region-data.mjs` 早就为同一件事加了白名单（由 A10 钉着），本生成器此前
  // 一次都没被任何判据跑过。判据形状照 A10 写：报错必须非零退出 + 点名参数 + 一个字节都不写。
  const repoBytes = readFileSync(ID_FIXTURE, 'utf8');
  const regionBefore = Object.fromEntries(readdirSync(FIXDIR).sort()
    .map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))]));
  const repo = makeIdTmpRepo();
  const spawn = (...args) => spawnSync(process.execPath, [repo.gen, ...args], { cwd: repo.tmp, encoding: 'utf8' });
  try {
    for (const flag of ['--nope', '--chek', '--CHECK', '--help', '-h', '--check=1']) {
      const r = spawn(flag);
      assert.notEqual(r.status, 0, `${flag} 被当成没写参数，直接跑进覆盖夹具那一支`);
      assert.match(r.stderr, /未知参数/, `${flag} 的报错没说是参数问题：${r.stderr}`);
      assert.match(r.stderr, /用法：node scripts\/build-id-fixture\.mjs/, `${flag} 的报错没带用法行`);
      assert.equal(r.stdout, '', `${flag} 报错的同时还把夹具生成了一遍`);
      assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, `${flag} 动过副本里的夹具`);
    }
    // --check 承诺只比对：一致必须绿且不写文件；改成"落后一个换行"之后必须红，
    // 而且不许"顺手"把它写回一致——那正是 CI 里 --check 失去意义的方式。
    const ok = spawn('--check');
    assert.equal(ok.status, 0, `一致的副本上 --check 却红了：${ok.stderr}`);
    assert.match(ok.stdout, /与生成器一致/);
    assert.doesNotMatch(ok.stdout, /不一致/, '"不一致"是"与生成器一致"的子串反例，必须分开说');
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '--check 动过一致状态下的夹具');
    const staleBytes = `${repoBytes}\n`;
    writeFileSync(repo.fixture, staleBytes);
    const chk = spawn('--check');
    assert.notEqual(chk.status, 0, '--check 在不匹配时退出 0，等于没有闸门');
    assert.match(chk.stderr, /与生成器不一致/);
    assert.equal(readFileSync(repo.fixture, 'utf8'), staleBytes, '--check 把比对做成了覆盖');
    // 字节幂等：连跑两次生成器必须同一份字节，且与仓库里那份逐字节相同
    const once = spawn();
    assert.equal(once.status, 0, once.stderr);
    assert.match(once.stdout, /1000 条/);
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '重跑生成器得到的字节与仓库里那份不同');
    assert.equal(spawn().status, 0);
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '连跑两次不幂等，--check 就没有意义');
  } finally {
    repo.cleanup();
  }
  // m-8：`夹具总数 != 1000` 这一道此前是裸 `throw`，打一整段堆栈到 stderr，而同一个脚本刚把
  // "参数打错"那一类做成一行 stderr + 退 1。同一类事（操作者的失误，不是引擎崩溃）必须同一种
  // 报法。判据形状照上面那六格：非零退出 + 一行说清是多少 + 不打堆栈 + 一个字节都不写。
  // 触发方式：把副本里的 agree18 配额从 670 改成 665（合计 995），锚点命中数必须先数过。
  const broken = makeIdTmpRepo({
    mutateGenerator: (s) => {
      const hits = s.split('agree18: 670').length - 1;
      assert.equal(hits, 1, `变异锚点 "agree18: 670" 在生成器里命中 ${hits} 处，不等于 1 —— 静默不匹配的变异本身就是一条缺陷`);
      return s.replace('agree18: 670', 'agree18: 665');
    },
  });
  try {
    const q = spawnSync(process.execPath, [broken.gen], { cwd: broken.tmp, encoding: 'utf8' });
    assert.notEqual(q.status, 0, '配额塌成 995 而生成器退 0，这道闸门等于没有');
    assert.match(q.stderr, /夹具总数 995 != 1000/, `必须说清算到的是多少条：${q.stderr}`);
    assert.doesNotMatch(q.stderr, /^\s+at /m, `操作者的失误不该打整段堆栈：${q.stderr}`);
    assert.equal(q.stdout, '', `总数不对还照样打出生成摘要：${q.stdout}`);
    assert.equal(readFileSync(broken.fixture, 'utf8'), repoBytes, '夹具总数这一道红的时候把坏产物写进了盘');
  } finally {
    broken.cleanup();
  }
  assert.equal(readFileSync(ID_FIXTURE, 'utf8'), repoBytes, '整条 B14 动过仓库里的夹具');
  assert.deepEqual(Object.fromEntries(readdirSync(FIXDIR).sort()
    .map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))])), regionBefore, 'B14 动过仓库里的区划快照');
});

/**
 * B15 是第九轮（5 Important + 9 Minor）里 F1 那条 Critical 级缺陷的判据。
 * 判据先写、先跑红，再改实现——整改前它红的就是下面这整条。
 * 第十轮复跑又往同一条里接了 G1：那道界只管"太早"，公元 10000 年那一头此前是开的。
 */
test('B15 年份 1..9999：出生年补齐四位再比下界，"今天"两头越界谁传谁被点名', () => {
  // F1：整改前 `makeDay` 写的是 `iso: `${y}-${pad2(m)}-${pad2(d)}``，年份不补零，而
  // `parseIdCard` 里 `b.day.iso < BIRTH_FLOOR` 那一句拿这个串做**字典序**比较 ⇒ `'50-06-01' > '1900-01-01'`，
  // 10..999 年整段绕过下界；
  // 而 `utc` 走 `Date.UTC(y, …)`，JS 把 0..99 折成 1900..1999，于是同一个号算出来的周岁
  // 又错一次。整改前在同一份代码上实跑（today 一律 '2026-09-25'）：
  //   110101005006010016 → state=valid  birth="50-06-01"   age=1976
  //   110101099912310010 → state=valid  birth="999-12-31"  age=1026
  //   110101000101010011 → malformed    birth="1-01-01"    （年 1 恰好被字典序抓住，纯属巧合）
  // 夹具的 birth_before_1900 组取的是 1880–1899，四位数，所以 1,000 条对拍一次都没碰到这个洞。
  const cases = [
    ['110101005006010016', '0050-06-01'],  // 年 50：补零与 Date.UTC 折算两处病灶同时咬
    ['110101099912310010', '0999-12-31'],  // 年 999：只咬补零那一条
    ['110101000101010011', '0001-01-01'],
    ['110101009602290016', '0096-02-29'],  // 年 96 按闰律是真闰年：日期成立，只越下界
  ];
  for (const [id, want] of cases) {
    const r = parseIdCard(id, { today: TODAY });
    assert.equal(r.state, 'malformed', `${id} 的出生年在 1..999，必须被本站下界拦住（整改前判 ${r.state}）`);
    assert.deepEqual(failedKeys(r), ['birth'], `${id} 只能由出生日期这一行否决：${r.checks.filter((k) => k.ok === false).map((k) => k.key).join()}`);
    assert.equal(rowOf(r, 'checkBit').ok, true, `${id} 的校验位算术不许被连累`);
    assert.match(rowOf(r, 'birth').detail, /1900-01-01/, `${id} 必须点名下界是哪一道：${rowOf(r, 'birth').detail}`);
    // 解出来的日期照给（B5 同一条口径），但必须是**四位**年份——面板拿它回显，'999-12-31' 这种
    // 少一位的串会让人以为是数据里掉了字
    assert.equal(r.info.birth, want, `${id} 的日期回显必须是四位年份`);
    assert.equal(r.info.ageYears, null, `${id} 越出下界不给周岁（整改前给的是 1976 / 1026）`);
    assert.equal(r.info.sex, '', `${id} 结构非法不出货解释性结论（B12 同一条契约）`);
  }
  // 生成侧的入参同族：整改前 `today: '0050-06-01'` 一路放过，最后死在自检那一步的
  // `parseIdCard(id18, { today: today.iso })` 上，报的是「**parseIdCard** 的 options.today
  // 应为 YYYY-MM-DD 字符串或 Date，收到 "50-06-01"」——不补零的 `today.iso` 回头喂不进自己的正则，
  // 而调用方按提示去查 parseIdCard 什么也查不到（m-1 与 F1 同一病灶）。
  const todayErr = genError({ today: '0050-06-01' });
  assert.ok(todayErr, 'today 早于本站下界时居然安静出货');
  assert.match(todayErr.message, /generateIdCards 的 options\.today/, `必须点名是 generateIdCards 这条入参：${todayErr.message}`);
  assert.doesNotMatch(todayErr.message, /parseIdCard/, `报错不许甩锅给另一个入口：${todayErr.message}`);
  assert.match(todayErr.message, /1900-01-01/, `必须点名是哪道界：${todayErr.message}`);
  assert.doesNotMatch(todayErr.message, /内部不变量/, `入参错误不许记成实现有 bug：${todayErr.message}`);
  // 两个入口同一条界、各点各的名（M-14 那条"口径一致"的延伸）
  assert.throws(() => parseIdCard('110101199003070011', { today: '0050-06-01' }),
    /parseIdCard 的 options\.today/, '解析侧的 today 早于下界必须点名自己');
  const birthErr = genError({ birthDate: '0050-06-01' });
  assert.ok(birthErr, 'birthDate 早于下界时居然安静出货');
  assert.match(birthErr.message, /options\.birthDate/, birthErr.message);
  assert.match(birthErr.message, /1900-01-01/, birthErr.message);

  // G1：界只管"太早"，**太晚那一侧此前是开的**。`toDay` 的字符串正则只收四位年，而 `Date`
  // 形状走 `getFullYear()` 不受宽度约束 ⇒ 公元 10000 年用串传被拒、用 Date 传被接受；
  // `pad4` 又只补不截，`today.iso` 成了五位，回头喂不进自检那句
  // `parseIdCard(id18, { today: today.iso })`。整改前的实跑（today = 公元 10000-01-01 那一天的
  // `Date`，上界那三行摘掉之后在同一份代码上跑）：解析侧照给结论
  // （`110101199003070011` → `state = 'valid'`、周岁 8009），生成侧抛
  // `TypeError: parseIdCard 的 options.today 应为 YYYY-MM-DD 字符串或 Date，收到 "10000-01-01"`
  // ——m-1 那一类甩锅在另一头复活。
  // 这两个 Date 一律用**本地分量**构造（与 B10 那句 `new Date(2026, 8, 25)` 同一口径）：
  // `toDay` 取的是 `getFullYear()`，`new Date(0)` 上再 `setUTCFullYear(10000, 0, 1)` 是 UTC
  // 零点，负偏移时区里本地读到的是 9999-12-31 —— 判据就会在没被变异的代码上红
  // （n-4 记的那条下界时区分叉，同一病灶的另一头）。9999 与 '10000-01-01' 在这里写死、
  // 不从模块导入 `YEAR_CEILING`：界要是哪天挪了，写死的判据该红，跟着常量改的判据不会。
  const y10k = new Date(10000, 0, 1);
  const farErr = genError({ today: y10k });
  assert.ok(farErr, 'today 的年宽过四位时居然安静出货');
  assert.ok(farErr instanceof RangeError, `年越界是"本站不接这个值"，不是形状错：${farErr.name}`);
  assert.match(farErr.message, /generateIdCards 的 options\.today/, farErr.message);
  assert.doesNotMatch(farErr.message, /parseIdCard/, `报错不许甩锅给另一个入口：${farErr.message}`);
  assert.match(farErr.message, /10000-01-01/, `要说得出越界的是哪一天：${farErr.message}`);
  assert.throws(() => parseIdCard('110101199003070011', { today: y10k }),
    (e) => e instanceof RangeError && /parseIdCard 的 options\.today/.test(e.message),
    '解析侧对同一个 Date 必须同判且点名自己（整改前它给结论）');
  // 两种入参形状对同一天可以错在不同档（串连形状都不成立 → `TypeError`；Date 形状合法、值越界
  // → `RangeError`），但**不许一个拒一个放**——那是 §5.4 回落链之外多出来的第二条口径
  assert.throws(() => parseIdCard('110101199003070011', { today: '10000-01-01' }), TypeError,
    '五位年份的串在形状那一关就该出局');
  assert.ok(genError({ today: '10000-01-01' }) instanceof TypeError, '生成侧的串侧同判 TypeError');
  // 同一条上界必须也压在 `birthDate` 上：那里此前没有这一刀，五位年份被 `iso < BIRTH_FLOOR`
  // 的字典序"顺手"拦下，报的是「不得早于 1900-01-01」——越的是上界、理由指着下界
  const bdErr = genError({ birthDate: y10k });
  assert.ok(bdErr instanceof RangeError, `birthDate 的年宽过四位时必须拒，且是 RangeError：${bdErr && bdErr.name}`);
  assert.match(bdErr.message, /options\.birthDate/, `必须点名是 birthDate 这条入参：${bdErr.message}`);
  assert.match(bdErr.message, /四位年份口径/, `要说清越的是哪道界：${bdErr.message}`);
  assert.doesNotMatch(bdErr.message, /不得早于/, `不许把上界越界报成下界：${bdErr.message}`);
  // 上界不许咬到界内：9999-12-31 是四位年格的最后一格，两入口都得照常工作
  const y9999 = new Date(9999, 11, 31);
  assert.equal(parseIdCard('110101199003070011', { today: y9999 }).state, 'valid',
    '9999-12-31 是四位年格的最后一格，越出界就是误伤（解析侧不设年龄上限，周岁 8009 照解）');
  const far9999 = generateIdCards({ count: 1, today: y9999, minAge: 18, maxAge: 60, rng: seededRandom(7) });
  assert.match(far9999[0].birth, /^\d{4}-\d{2}-\d{2}$/, `出货的生日必须是四位年：${far9999[0].birth}`);
  assert.equal(parseIdCard(far9999[0].id18, { today: y9999 }).state, 'valid', '自检回喂必须走得通');

  // 正向对照：这一刀不许退化成"四位以下的年份一律拒"，界内的一格都不许误伤
  const old18 = generateIdCards({ count: 4, today: '1950-01-01', minAge: 0, maxAge: 50, rng: seededRandom(11) });
  assert.equal(old18.length, 4);
  for (const g of old18) {
    assert.ok(g.birth >= BIRTH_FLOOR && g.birth <= '1950-01-01', `today=1950-01-01 却生成了 ${g.birth}`);
    assert.ok(Number.isInteger(g.age) && g.age >= 0 && g.age <= 50,
      `today=1950-01-01 的 [0,50] 窗口里给出周岁 ${g.age}（生日 ${g.birth}）`);
    assert.equal(parseIdCard(g.id18, { today: '1950-01-01' }).state, 'valid', `${g.id18} 自检不过`);
  }
  const onFloor = generateIdCards({ count: 1, today: TODAY, birthDate: '1900-01-01' });
  assert.equal(onFloor[0].birth, '1900-01-01', `${BIRTH_FLOOR} 这一格本来就在界内`);
  assert.equal(onFloor[0].age, 126, 'born 1900-01-01 / today 2026-09-25 → 126 周岁');
  assert.equal(parseIdCard('110101190001010014', { today: TODAY }).state, 'valid');
  assert.equal(parseIdCard('11010118991231001X', { today: TODAY }).state, 'malformed');
});
// ── §C 统一社会信用代码 ─────────────────────────────────────────────────────

const { parseUscc, parseUsccList, generateUsccCodes, computeCheckChar,
  computeOrgCheckValue, charValue, USCC_CHARSET, USCC_WEIGHTS, ORG_WEIGHTS,
  FORBIDDEN_CHARS, GENERATE_MAX: USCC_GENERATE_MAX, USE_NOTE: USCC_USE_NOTE,
  REFERENCE_NOTE } = await import('../dev/js/tools/uscc.js');

/**
 * 可公开核实的真实码清单。设计文档 §11 原本要求"≥5 条"，本轮只坐实 1 条
 * （GB 32100-2015 正文示例）；凭记忆写的 4 条候选有 3 条末位不通，故不收录。
 * 这条判据的唯一用途：以后往里加样本时必须连带核实来源与日期，
 * 而不是让"≥5 条真实码"这句话悄悄变成既成事实。
 */
const REAL_SAMPLES = [
  { code: '91350100M000100Y43', source: 'GB 32100-2015 正文示例', verifiedOn: '2026-09-25' },
];

/**
 * 这 13 条不是手推的：每条的期望值都由 C3–C7 里的一句机器判据核着
 * （口径见 §5.0：加权和、余数、末位字符都从 charValue / 两套权重现算）。
 * 换句话说，这 13 个常量是判据的输入而不是判据的结论——谁改了字符集或权重，
 * 引用到它们的那几条当场红。
 */
const NATIONAL = '91350100M000100Y43';    // 内层本体含字母的国标示例
const R_ZERO = '913501000000001660';      // Σ mod 31 == 0 → 末位 '0'，且内层自洽（整码可判 valid）
const R_X = '91350100000000004X';         // 校验值 29 → 'X'
const R_Y = '91350100000000014Y';         // 校验值 30 → 'Y'
const ORG_TEN_X = '9135010000000006XH';   // 内层值 10，第 17 位写作 'X'
const ORG_TEN_A = '9135010000000006AN';   // 内层值 10，第 17 位写作 'A'（末位随之改变）
const ORG_OK = '91350100000000019E';      // 内层值 9，第 17 位 '9'
const ORG_LETTER = '9135010000000001YF';  // 内层值 9，第 17 位 'Y' → 不下结论
const ORG_BAD = '913501000000000152';     // 内层值 9，第 17 位 '5' → 不符
const REGION_UNCODED = '91440524000000019E';
const REGION_PROVINCE = '91110000000000019B';
const REGION_HIST = '91110103000000019U';
const REGION_NONE = '91990101000000019M';
const failedC = (r) => r.checks.filter((k) => k.ok === false).map((k) => k.key);
const uncertainC = (r) => r.checks.filter((k) => k.ok === null).map((k) => k.key);
const rowC = (r, key) => r.checks.find((k) => k.key === key);

test('C1 31 字符集：长度、剔除的五个字母、值即下标、非法输入返回 null 不抛', () => {
  assert.equal(USCC_CHARSET.length, 31);
  assert.equal(new Set(USCC_CHARSET).size, 31, '字符集里有重复字符');
  assert.deepEqual(FORBIDDEN_CHARS, ['I', 'O', 'S', 'Z', 'V']);
  for (const ch of FORBIDDEN_CHARS) {
    assert.equal(USCC_CHARSET.includes(ch), false, `${ch} 不得出现在字符集里`);
  }
  // 整张表由规则反推，而不是"用到的那几个字符刚好没被改"。上面四句只钉了长度、唯一性、
  // 五个剔除项和 `0 9 A Y` 四个下标点，而 §C 的 13 条常量只用到 `0-9 A M X Y`：本轮把下标 28
  // 的 `W` **原地**换成 `-`（长度仍 31、仍唯一、仍不含这五个字母），九条全绿（2026-09-26 实测）。
  // 这一句把顺序也一起钉住——`charValue` 拿 `indexOf` 当值用，"值即下标"依赖的就是这个顺序。
  assert.equal(USCC_CHARSET,
    [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => !FORBIDDEN_CHARS.includes(c)).join(''),
    '字符集必须逐字符等于「0-9 与大写 A-Z 去掉 FORBIDDEN_CHARS」');
  assert.equal(charValue('0'), 0);
  assert.equal(charValue('9'), 9);
  assert.equal(charValue('A'), 10);
  assert.equal(charValue('Y'), 30);
  assert.equal(charValue('I'), null, '被剔除的字母必须是 null');
  assert.equal(charValue('i'), null, '小写不属于代码字符集，不做隐式大写');
  assert.equal(charValue(''), null);
  assert.equal(charValue('01'), null);
  assert.equal(charValue(null), null);
  assert.equal(charValue(9), null, '数字入参也走 null：调用方负责先转字符串');
});

test('C2 两套权重：与幂算式互验，不靠手抄', () => {
  assert.deepEqual(USCC_WEIGHTS, [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]);
  assert.equal(USCC_WEIGHTS.length, 17);
  for (let i = 0; i < 17; i += 1) {
    assert.equal(USCC_WEIGHTS[i], 3 ** i % 31, `第 ${i + 1} 位权重应为 3^${i} mod 31`);
  }
  assert.deepEqual(ORG_WEIGHTS, [3, 7, 9, 10, 5, 8, 4, 2]);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(ORG_WEIGHTS[i], 2 ** (8 - i) % 11, `内层第 ${i + 1} 位权重应为 2^(8-${i}) mod 11`);
  }
});

test('C3 国标示例：双校验位自洽，且不变式 Σ(1..18) ≡ 0 (mod 31)', () => {
  const r = parseUscc(NATIONAL);
  assert.equal(r.state, 'valid');
  assert.deepEqual(failedC(r), []);
  assert.deepEqual(uncertainC(r), []);
  assert.equal(r.caveat, '');
  assert.deepEqual(r.checks.map((k) => k.key),
    ['charset', 'length', 'region', 'orgCheck', 'checkBit']);
  assert.equal(r.info.region.fullName, '福建省福州市', '350100 按现行市级解（A5 已钉这一档）');
  assert.equal(r.info.body8, 'M000100Y');
  assert.deepEqual(r.info.orgChecksum, { sum: 128, remainder: 7, value: 4 });
  assert.deepEqual(r.info.checksum, { sum: 1640, remainder: 28, value: 3 });
  assert.equal(r.info.expectedCheckBit, '3');
  assert.equal(r.info.checkBit, '3');
  // 不变式：把末位一起加权必须整除 31。这条独立于上面所有中间量
  const total = r.code.split('')
    .reduce((t, ch, i) => t + charValue(ch) * (i < 17 ? USCC_WEIGHTS[i] : 1), 0);
  assert.equal(total % 31, 0);
});

test('C4 末位计算：余数为 0 取 0、值 29/30 取字母、结构非法返回 null 不抛', () => {
  assert.equal(computeCheckChar(R_ZERO.slice(0, 17)), '0', 'Σ mod 31 == 0 → 末位是字符 0');
  assert.equal(computeCheckChar(R_X.slice(0, 17)), 'X');
  assert.equal(computeCheckChar(R_Y.slice(0, 17)), 'Y');
  assert.equal(computeCheckChar(NATIONAL.slice(0, 17)), '3');
  // 第 17 位按 31 字符集取值参与外层加权：同一条内层本体，写 X 与写 A 会得到不同末位
  assert.equal(computeCheckChar(ORG_TEN_X.slice(0, 17)), 'H');
  assert.equal(computeCheckChar(ORG_TEN_A.slice(0, 17)), 'N');
  assert.equal(computeCheckChar(R_ZERO.slice(0, 16)), null, '16 位要 null 而不是抛');
  assert.equal(computeCheckChar('9135010I000000024'), null, '含被剔除字母要 null');
  assert.equal(computeCheckChar(null), null);
  assert.equal(computeCheckChar(''), null);
  assert.deepEqual(computeOrgCheckValue('00000006'), { sum: 12, remainder: 1, value: 10 });
  assert.deepEqual(computeOrgCheckValue('M000100Y'), { sum: 128, remainder: 7, value: 4 });
  assert.equal(computeOrgCheckValue('0000006'), null, '7 位本体要 null');
  assert.equal(computeOrgCheckValue('0000000i'), null);
});

test('C5 三态、大小写归一、批量：只有 false 拖垮结论，null 只进 caveat', () => {
  assert.deepEqual({ s: parseUscc('').state, c: parseUscc('').checks.length }, { s: 'empty', c: 0 });
  assert.deepEqual({ s: parseUscc(null).state, c: parseUscc(null).checks.length }, { s: 'empty', c: 0 });

  const lower = parseUscc('91350100m000100y43');
  assert.equal(lower.state, 'valid');
  assert.equal(lower.code, NATIONAL, '按字符集转大写后判定');
  assert.equal(lower.normalized, true);
  assert.match(lower.caveat, /转大写/);
  assert.equal(parseUscc(` ${NATIONAL} `).normalized, false, '只有首尾空白不算归一');

  const short = parseUscc(NATIONAL.slice(0, 17));
  assert.equal(short.state, 'malformed');
  assert.deepEqual(failedC(short), ['length']);
  const badChar = parseUscc('9135010O000000019E');
  assert.equal(badChar.state, 'malformed');
  assert.deepEqual(failedC(badChar), ['charset'], 'O 是被剔除字母，判字符集不符而不是给个"未知"');
  assert.match(rowC(badChar, 'charset').detail, /含非法字符 O/);

  const spaced = parseUscc('9135 0100M000100Y 43');
  assert.equal(spaced.state, 'malformed');
  assert.deepEqual(failedC(spaced), ['charset']);
  assert.equal(spaced.repairedHint, NATIONAL, '去掉内部空格后就是合法码，提示要有');

  const wrong = parseUscc('91350100M000100Y44');
  assert.equal(wrong.state, 'checkdigit');
  assert.deepEqual(failedC(wrong), ['checkBit']);
  assert.equal(rowC(wrong, 'checkBit').detail, '期望 3，实际 4');

  // 结构档 malformed 递给用户什么：与 idcard 的 B12 同族——算术量在这条路上没有可信输入，
  // 一格都不许出货。本轮在镜像上把早退分支改成
  // `out.code = compact; out.info = {…}; out.caveat = '未知主体类型'; out.hasCaveat = true`
  // 复跑，§C 九条**全绿**（2026-09-26 实测）：C6 那句 doesNotMatch 的输入集是四条区划样本，
  // 全是能走满五档的码，charset/length 这一档一条都没喂进去过——「未知」照样从这条通道进得来。
  for (const r of [short, badChar, spaced]) {
    assert.equal(r.code, '', `${r.input}：结构非法不许把洗过的串当"就是这条码"递出去`);
    assert.equal(r.info, null, `${r.input}：结构非法不许出 info`);
    assert.equal(r.caveat, '', `${r.input}：结构非法不许出解释性文案`);
    assert.equal(r.hasCaveat, false, `${r.input}：hasCaveat 必须跟着 caveat 一起为假`);
  }
  assert.equal(short.repairedHint, '', '17 位不是"去掉内部空格就能修好"，不许给假提示');
  assert.equal(badChar.repairedHint, '', '含被剔除字母，去空格也修不好，不许给假提示');
  assert.equal(spaced.repairedHint, NATIONAL, '唯一该给提示的一档：去内部空格后就是合法码');
  // 「未知」禁令覆盖到早退这一档（C6 那句只管走满五档的码）
  assert.doesNotMatch(JSON.stringify([short, badChar, spaced, lower, wrong]), /未知/,
    '结构档与 checkdigit 档的任何输出里都不许出现「未知」这类文案');

  const list = parseUsccList(`${NATIONAL}\n\n${R_ZERO}\r\nabc`);
  assert.deepEqual(list.map((x) => x.no), [1, 2, 3, 4], '空行必须占一行号，不能悄悄压缩');
  assert.deepEqual(list.map((x) => x.result.state), ['valid', 'empty', 'valid', 'malformed']);
  assert.deepEqual(list.map((x) => x.raw), [NATIONAL, '', R_ZERO, 'abc']);
});

test('C6 区划段复用 §A：未收录与历史码都不下"无效"，绝不产出「未知」', () => {
  const uncoded = parseUscc(REGION_UNCODED);
  assert.equal(uncoded.state, 'valid', '区划未收录不否决整码');
  assert.deepEqual(uncertainC(uncoded), ['region']);
  assert.equal(uncoded.info.region.fullName, '广东省汕头市');
  assert.match(uncoded.caveat, /未收录/);

  const province = parseUscc(REGION_PROVINCE);
  assert.equal(province.state, 'valid');
  assert.equal(province.info.region.level, 'province');
  assert.equal(province.info.region.fullName, '北京市');
  assert.deepEqual(uncertainC(province), [], '省级码 + 0000 是现行码，不该留"不下结论"');
  assert.equal(province.caveat, '');

  const hist = parseUscc(REGION_HIST);
  assert.equal(hist.state, 'valid');
  assert.equal(hist.info.region.status, 'abolished');
  assert.match(rowC(hist, 'region').detail, /历史码/);
  assert.match(hist.caveat, /未见于现行区划表/,
    '措辞要诚实，不能断言"已撤销建制"——同码改名的账落在 scripts/build-id-fixture.mjs 的'
    + '四成因统计与 region.js 文件头的历史层注释里，B7 的 EXPECT_POOLS 钉着那四个数');

  const none = parseUscc(REGION_NONE);
  assert.equal(none.state, 'malformed');
  assert.deepEqual(failedC(none), ['region']);
  // 区划档 malformed 与结构档**故意不同**（口径写在 parseUscc 的 JSDoc 里）：前 17 位的算术
  // 都成立，所以 code 与纯算术量照旧给——用户靠 `expectedCheckBit` 才能看出"是区划段写错了、
  // 不是末位错了"。解释性字段必须为空，页面只许在 valid / checkdigit 下渲染区划名与主体类型。
  assert.equal(none.code, REGION_NONE, '区划档保留 code：这条码的字符集与长度都是对的');
  assert.equal(none.info.expectedCheckBit, 'M', '区划档保留纯算术量（与结构档的 info:null 分档）');
  assert.equal(none.info.region.fullName, '', '区划档的解释性字段必须是空串，不能是任何地名');
  // 「算术量在场」与「解释性四格为空」是两件事，上一版只钉了 `expectedCheckBit` 一格。
  // before 版实测（2026-09-26，把本轮新加的三句逐句摘掉复跑）：往 `info.region.province`
  // 填一个**真地名**（'北京市'）41 条全绿；只把**区划档**那一档的 `info.checksum` 摘成
  // `null` 也 41 条全绿。两句各补一颗牙之后，同一针分别只红 C6。
  // 另有一针是填「未知」，整改前后都红 C5 + C6——下面那句全 `JSON.stringify` 的「未知」
  // 扫描早就拦着那个措辞了，所以这一格的牙不在"未知"这两个字，而在"填任何地名都不行"。
  assert.ok(Number.isFinite(none.info.checksum.sum), '区划档必须保留 `checksum.sum` 这类纯算术量');
  for (const k of ['province', 'city', 'county']) {
    assert.equal(none.info.region[k], '', `区划档的 ${k} 必须是空串，不许填任何地名`);
  }
  assert.equal(none.caveat, '', '区划落不到只由 checks 那一行说，不重复写进 caveat');
  // 整条结果入串，不是只 stringify checks：旧写法只比 checks，于是把 caveat 改成
  // 「未知主体类型」判据照旧绿（镜像复跑：# tests 35 / # pass 35 / # fail 0）。
  // B6 同一族 stringify 的是 `fallback.info`（比 checks 宽一档），这里再宽一档收整条——
  // checks、caveat、hasCaveat、info、region.note、repairedHint 一格都不许漏
  assert.doesNotMatch(JSON.stringify([uncoded, province, hist, none]), /未知/,
    '任何输出里都不许出现「未知地区」这类文案（站内旧库的反面教材）');
});

test('C7 内层第 17 位：数字不符才判错、字母不下结论、值 10 两种写法都放行', () => {
  assert.equal(rowC(parseUscc(ORG_OK), 'orgCheck').ok, true);
  const letter = parseUscc(ORG_LETTER);
  assert.equal(rowC(letter, 'orgCheck').ok, null);
  assert.equal(letter.state, 'valid', '字母落在"不下结论"档，不拖垮整体');
  assert.match(letter.caveat, /第 17 位/);
  const bad = parseUscc(ORG_BAD);
  assert.equal(rowC(bad, 'orgCheck').ok, false);
  assert.equal(bad.state, 'checkdigit');
  assert.deepEqual(failedC(bad), ['orgCheck'], '内层不符的判定不能被末位抢走');
  for (const code of [ORG_TEN_X, ORG_TEN_A]) {
    const r = parseUscc(code);
    assert.equal(rowC(r, 'orgCheck').ok, true, `${code} 的内层值 10 应当放行`);
    assert.equal(r.state, 'valid');
    assert.equal(r.info.orgChecksum.value, 10);
    assert.match(rowC(r, 'orgCheck').detail, /X 或 A/, '措辞要说明这是两种口径都认');
  }
});

test('C8 生成侧自洽 + 未验证缺口显式登记', () => {
  const a = generateUsccCodes({ count: 5, rng: seededRandom(20260925) });
  const b = generateUsccCodes({ count: 5, rng: seededRandom(20260925) });
  assert.deepEqual(a.map((x) => x.code), b.map((x) => x.code), '同种子必须同输出');
  // 生成侧的字段集是面板的直接契约。下面那句 `Object.keys(one.info[key])` 只钉了**解析侧**，
  // 而计划 §5.1 的原话是"防止后来人凭记忆补一张表进去"——面板渲染的恰恰是生成侧这一份：
  // 本轮在 `list.push({…})` 里加 `registryName: '工商', categoryName: '企业'`，§C 九条全绿
  // （2026-09-26 实测）。这一句把九个键按名字钉死：多一个、少一个、改名，当场红。
  // 钉的是**每一条**而不是只有 `a[0]`：复核实测（同日）只核头一条时，"第 2 条起多塞一键"
  // 那种变异全绿——而面板是按行渲染的，键集逐行漂移正是它要防的形状。
  const GEN_KEYS = ['categoryChar', 'caveat', 'checkBit', 'code', 'orgCheckBit', 'regionCode',
    'regionName', 'registryChar', 'subject'];
  for (const [i, g] of a.entries()) {
    assert.deepEqual(Object.keys(g).sort(), GEN_KEYS,
      `生成侧第 ${i + 1} 条的键集就是面板契约，要改必须连 §5.1 的口径与这段注释一起改`);
  }
  for (const g of a) {
    assert.equal(g.code.length, 18);
    const self = parseUscc(g.code);
    assert.equal(self.state, 'valid');
    assert.deepEqual(self.checks.map((k) => k.ok), [true, true, true, true, true],
      '每条生成后逐项都必须是 true——生成器是校验器的对手');
    assert.equal(self.caveat, '');
    assert.equal(resolveRegion(g.regionCode).status, 'current', '区划段只能出自现行表（§5.4）');
    assert.equal(/^[0-9]$/.test(g.code[16]), true, '第 17 位不得落在未核实的"值 10 写法"分支');
    assert.equal(g.code[17], computeCheckChar(g.code.slice(0, 17)));
  }
  // 「生成侧永不产出值 10」原先只靠上面那三行 a/b（各 5 条）加下面的 7 号 3 条、9 号 2 条守着，
  // 而这 10 条的第 17 位实算落在 05386 / 530 / 77（构造：`generateUsccCodes({ count, rng: seededRandom(s) })`，
  // s/count 三组 = 20260925/5、7/3、9/2）——一次都没触到避让那一格，所以那句断言等于没牙：
  // 本轮在镜像上摘掉 rollBody8 里避让的那三行复跑过，那时 §C 八条全绿（# tests 35 / # pass 35 /
  // # fail 0）。换成下面这段扫种子：同样那三行摘掉再跑，s = 1..8 各自在第
  // 9 / 3 / 10 / 36 / 11 / 7 / 6 / 6 条抛「内部不变量被破坏」，第一条是
  // `916403001913143610N`——内层校验值 10 被 `${org.value}` 写成两个字符，整码 19 位，
  // 索引 16 是 '1'、索引 17 是 '0'，length 检查先炸。守卫在的时候这 8×50 条全部成立。
  for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const scanned = generateUsccCodes({ count: 50, rng: seededRandom(s) });
    assert.equal(scanned.length, USCC_GENERATE_MAX, `种子 ${s} 应出满 ${USCC_GENERATE_MAX} 条`);
    for (const g of scanned) {
      assert.equal(/^[0-9]$/.test(g.code[16]), true,
        `种子 ${s} 的 ${g.code} 第 17 位落进了未核实的"值 10 写法"分支`);
      assert.deepEqual(parseUscc(g.code).checks.map((k) => k.ok), [true, true, true, true, true],
        `种子 ${s} 的 ${g.code} 逐项不全是 true`);
    }
  }
  // 342 个现行市级码 + '00' 全都能当区划段（那个 342 由 A1 写死的 `REGION_META.counts.cities`
  // 与 A2 的 `currentCityCodes().length === REGION_META.counts.cities` 钉住，2026-09-26 实读
  // 两边都是 342；这里不重复计数，只核**每一档**都能按现行市级解——市级表若退化成空，
  // 这一圈会空转，但那时 A2 已经先红了）
  for (const c of currentCityCodes()) {
    assert.equal(resolveRegion(`${c}00`).status, 'current', `${c}00 应可用于生成`);
  }
  assert.ok(generateUsccCodes({ count: 3, provinceCode: '35', rng: seededRandom(7) })
    .every((g) => g.regionCode.startsWith('35')));
  assert.ok(generateUsccCodes({ count: 2, regionCode: '110100', rng: seededRandom(9) })
    .every((g) => g.regionCode === '110100'));
  // 四条一律用 `{ name, message }` 的对象式：第二参数给构造子、第三参数给正则时，
  // 那个正则会被当成**失败信息**而不是匹配器（2026-09-26 实测：类型不符会红、文案不符照旧绿），
  // 于是"钉文案"那句是假的。对象式两项都核（探针四格：类型不符 FAIL / 文案不符 FAIL / 全对 PASS）。
  // 对照 idcard 的 B8 只写了 `assert.throws(…, RangeError)`，C9 全程用 `err.constructor.name`，
  // regionCode 这一条路径的异常类型从前零判据：把 `regionPool` 那句改成 TypeError，§C 全绿。
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: '110103' }),
    { name: 'RangeError', message: /历史码只许解、不许生成/ },
    '历史码只许解、不许生成');
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: 'abc' }),
    { name: 'RangeError', message: /不是现行码/ }, '形状就不对的区划段');
  // `regionPool` 的 `why` 四支文案，从前只有 abolished 与"非 6 位数字"两支被钉着：
  // 2026-09-26 把 uncoded 与 unknown-6 位这两支各换成 `XYZ` 复跑，41/41 照旧全绿（零判据）。
  // 下面两句钉的是探针跑出来的实测原样，不是凭记忆写的：
  //   440524 → `区划段 440524 不是现行码（未收录码不能用于生成）：区划码未收录（可能是…）`
  //   999999 → `区划段 999999 不是现行码（省 / 市 / 县三级都落不到）：省级代码不存在`
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: '440524' }),
    { name: 'RangeError', message: /未收录码不能用于生成/ }, 'uncoded 档点名"未收录"这档成因');
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: '999999' }),
    { name: 'RangeError', message: /省 \/ 市 \/ 县三级都落不到/ },
    '6 位数字、形状对，但三级都落不到——这一档才许说"三级都落不到"');
  // note 自己就带一层括号（「区划码未收录（可能是…）」「现行区划表（截止 …）」），
  // 外层再套一层 `（${note}）` 就是 2026-09-26 实测到的「（区划码未收录（…））」双层括号。
  // 四档一律核：括号不许嵌套，且开头必须回显用户写的那个区划段。
  for (const rc of ['110103', '440524', '999999', 'abc', '1101']) {
    let nested = null;
    try {
      generateUsccCodes({ count: 1, regionCode: rc });
    } catch (e) {
      nested = e;
    }
    assert.ok(nested, `regionCode ${rc} 居然安静出货`);
    assert.doesNotMatch(nested.message, /（[^（）]*（/, `${rc} 的文案出现嵌套括号 → ${nested.message}`);
    assert.ok(nested.message.startsWith(`区划段 ${rc} 不是现行码`),
      `${rc} 的文案没以回显入参开头 → ${nested.message}`);
  }
  assert.throws(() => generateUsccCodes({ count: USCC_GENERATE_MAX + 1 }),
    { name: 'RangeError', message: /1\.\./ }, '条数越界');
  assert.throws(() => generateUsccCodes({ count: 1, registry: 'Z' }),
    { name: 'RangeError', message: /31 字符集/ }, '第 1 位不在字符集内');
  // 形状不对那一档的文案必须**只说形状**：`resolveRegion` 的 `status:'unknown'` 同时装着
  // "根本不是 6 位数字"与"6 位但表里没有"两种结论，从前这里对 'abc' 也断言
  // 「省 / 市 / 县三级都落不到」——一句假话（2026-09-26 实测旧文案为
  // `区划段 ABC 不是现行码（行政区划码应为 6 位数字字符串）；省 / 市 / 县三级都落不到`）。
  // 回显同样要紧：用户写的是 `abc`，不许被 `toUpperCase()` 洗成 `ABC` 再报给他。
  const shapeErr = (() => {
    try {
      generateUsccCodes({ count: 1, regionCode: 'abc' });
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.ok(shapeErr, 'regionCode 形状不对时居然安静出货');
  assert.match(shapeErr.message, /区划段应为 6 位数字/, `形状档要点明是形状 → ${shapeErr.message}`);
  assert.doesNotMatch(shapeErr.message, /三级都落不到/, `非 6 位数字不许被说成"三级都试过" → ${shapeErr.message}`);
  assert.ok(shapeErr.message.includes('abc'), `回显要用用户写的那个形状 → ${shapeErr.message}`);

  // 合规与口径文案由模块出，页面直接取用，别在页面里另抄一版
  assert.equal(USCC_GENERATE_MAX, 50);
  assert.match(USCC_USE_NOTE, /不得用于任何真实主体/);
  assert.match(REFERENCE_NOTE, /第 1、2 位/);
  const one = parseUscc(NATIONAL);
  // 两个键各钉一次：从前只管 registry，往 info.category 里塞一个 `name: '机关'` 判据照旧绿
  for (const key of ['registry', 'category']) {
    assert.deepEqual(Object.keys(one.info[key]).sort(), ['char', 'value'],
      `info.${key} 只给字符与值、不给名称：含义表没取到可核实来源（§5.1）`);
  }
  assert.equal(one.info.registry.char, '9');
  assert.equal(one.info.registry.value, 9);
  assert.equal(one.info.category.char, '1');
  assert.equal(one.info.category.value, 1);
  assert.equal(REAL_SAMPLES.length, 1, '本轮只坐实 1 条真实码，加样本时同步改设计文档 §11');
  for (const s of REAL_SAMPLES) {
    assert.equal(s.verifiedOn, '2026-09-25');
    assert.equal(parseUscc(s.code).state, 'valid');
  }
});

/**
 * 同一格入参形状分别喂两个模块：idcardOpts 给 generateIdCards、usccOpts 给 generateUsccCodes，
 * 各自只把结果拿回来（抛错记 err，安静出货记 rows）。
 * rows 在 try 里就取好、绝不当着通过的那一轮去 stringify——B10 踩过这一条：把
 * `JSON.stringify(generateXxx(options))` 写进 assert 的消息模板，坏入参会在**判据本来该绿**
 * 的那一轮自己先抛穿。§B 那边有 genError，但它只喂 generateIdCards，而这条要的是两个模块
 * 并排同档，所以自带一份对称的版本（idcard 侧多传 today，让流可复现）。
 */
const bothGates = (idcardOpts, usccOpts) => {
  const grab = (run) => {
    try {
      return { err: null, rows: run() };
    } catch (e) {
      return { err: e, rows: null };
    }
  };
  return {
    generateIdCards: grab(() => generateIdCards({ count: 1, today: TODAY, rng: seededRandom(4242), ...idcardOpts })),
    generateUsccCodes: grab(() => generateUsccCodes({ count: 1, rng: seededRandom(4242), ...usccOpts })),
  };
};

/** 两模块并排断言：坏形状这一档必须同类、同点名、都不许把调用方的错记成"内部不变量" */
const assertBothReject = (r, kind, want, why) => {
  for (const [mod, got] of Object.entries(r)) {
    if (!got.err) {
      assert.fail(`${mod}：${why} —— 居然安静出货 ${JSON.stringify(got.rows)}`);
    }
    assert.equal(got.err.constructor.name, kind,
      `${mod}：${why} 的异常类型应当是 ${kind} → ${got.err.constructor.name}: ${got.err.message}`);
    assert.match(got.err.message, want, `${mod}：${why} 的报错文案 → ${got.err.message}`);
    assert.doesNotMatch(got.err.message, /内部不变量/,
      `${mod}：${why} —— 入参错误被记成实现有 bug → ${got.err.message}`);
  }
};

test('C9 入参闸门与身份证模块同档：坏形状点名到键、空文本零行，两个模块一格都不许分叉', () => {
  // 这一条把 uscc.js 落地后复核坐实的入参分叉逐格钉住。idcard.js 那批闸门各自被 B8 / B10 钉过
  // （count 只认 undefined、rng 先验类型再验取值、区划键只认非空字符串、整个 options 传 null
  // 等于没传、批量入口的空文本给 0 行），uscc.js 整改前同一批形状的行为——每条都在整改前
  // 那一版（`83675ca`，本模块首次落地那次提交；`22d7147` 才把它们治掉）上跑过，
  // 出的号能不能复算写在括号里：
  //   `parseUsccList('')` / `parseUsccList(null)` 各给 **1 行**（idcard 给 0 行，而注释写着"同形"）；
  //   `generateUsccCodes({ count: null })` 安静出货 1 条（`options.count ?? 1`，正是 B8 点名拆掉的写法）；
  //   `generateUsccCodes(null)` 抛 `TypeError: Cannot read properties of null (reading 'rng')`；
  //   `generateUsccCodes({ rng: 'nope' })` 静默回落**时间种子**出货 1 条（号随墙钟、复算不出，
  //     当天摇到 91130100969112487K）；
  //   `generateUsccCodes({ rng: () => 2 })` 摇出 `91undefined20202020202020202B`（这条是确定流：
  //     池子索引 `Math.floor(2 * pool.length)` 越界取到 undefined、每个数字位都摇成 2），
  //     再由自检那一关抛「内部不变量被破坏」——同一件事 idcard 的 I-6 治过；
  //   `generateUsccCodes({ provinceCode: '' })` 放开整张现行市级池，当天出货
  //     91620600124270547W（甘肃省武威市）；
  //   `generateUsccCodes({ regionCode: 110100 })` 数值被 String() 收下、照常出货区划段 110100 的码。
  // 两份 shapeOf / checkedRng 各自留在自己文件里是刻意的取舍（同级工具模块互不 import，
  // 理由写在 uscc.js 的 shapeOf 注释），代价就是"跨模块口径一致"没有编译期保证——只能由这条钉。
  const reject = [
    [{ count: null }, 'RangeError', /数量应为 1\.\.\d+ 的整数，收到 null/,
      'count 传 null：`?? 1` 把它吞成"默认一条"，一次类型错误静默出货'],
    [{ count: 0 }, 'RangeError', /数量应为 1\.\.\d+ 的整数，收到 number 0/, '零条不是"没传"，不许静默补一条'],
    [{ count: 1.5 }, 'RangeError', /收到 number 1\.5/, '非整数条数'],
    [{ count: '5' }, 'RangeError', /收到 string 5/, '字符串条数（旧文案只写"收到 5"，看不出是串）'],
    [{ rng: 'nope' }, 'TypeError', /options\.rng[^\n]*应为 \(\) => number[^\n]*收到 string nope/,
      '非函数 rng 不许静默回落时间种子'],
    [{ rng: () => 2 }, 'TypeError', /options\.rng[^\n]*每次应给出 \[0, 1\) 内的有限数[^\n]*收到 number 2/,
      '取值越界第一次就报，不许摇到自检那一关才抛"内部不变量"'],
    [{ provinceCode: '' }, 'TypeError', /options\.provinceCode[^\n]*应为非空字符串[^\n]*收到 string/,
      '空串收窄＝零候选，与"没收窄"是两种用户意图'],
    [{ provinceCode: '   ' }, 'TypeError', /options\.provinceCode[^\n]*应为非空字符串/,
      '全空白串同一条'],
    [{ provinceCode: 11 }, 'TypeError', /options\.provinceCode[^\n]*应为非空字符串[^\n]*收到 number 11/,
      '数值省码不许被 String() 洗成合法前缀（M-11 同族）'],
    [{ provinceCode: null }, 'TypeError', /options\.provinceCode[^\n]*应为非空字符串[^\n]*收到 null/,
      'null 省码不得等于放开整张现行表'],
  ];
  for (const [options, kind, want, why] of reject) {
    // 两边各断一次同一个 kind —— 这本身就是"同档"断言：任何一边松口（或哪天改类型），这里红
    assertBothReject(bothGates(options, options), kind, want, why);
  }
  assert.equal(USCC_GENERATE_MAX, GENERATE_MAX,
    '两个模块的批量上限必须同值，否则上面那句「1..50」的对照文案就是假的（§11 风险表）');

  // 用 uscc 独有的 regionCode 对 idcard 的 areaCode：键名不同、档位必须相同
  const perKey = [
    [{ areaCode: 110101 }, { regionCode: 110100 }, 'TypeError', /应为非空字符串[^\n]*收到 number/,
      '数值区划码：uscc 从前 String() 收下照常出货'],
    [{ areaCode: '' }, { regionCode: '' }, 'TypeError', /应为非空字符串/,
      '空串区划码：与"没传"是两回事'],
    [{ areaCode: '   ' }, { regionCode: '   ' }, 'TypeError', /应为非空字符串/, '全空白串同上'],
    [{ areaCode: null }, { regionCode: null }, 'TypeError', /应为非空字符串[^\n]*收到 null/,
      'null 区划码不得等于放开整张现行表'],
  ];
  for (const [idcardOpts, usccOpts, kind, want, why] of perKey) {
    assertBothReject(bothGates(idcardOpts, usccOpts), kind, want, why);
  }

  // 正向对照：闸门不许把合法入参一起关掉。两边同形状、同条数，且各自出货自检得过。
  // 文案只说这一圈真正断言的东西（条数 + 自检 + 默认字符）——`bothGates` 恒注入确定种子，
  // 所以"时间种子那一档"不在这一圈里（由下面的 noOptions 循环与 B8/C8 的时间种子用例钉），
  // "收窄到 35 省"也不在这一圈里（由 C8 那句 every(regionCode.startsWith('35')) 钉）。
  const accept = [
    [{}, {}, 1, '什么都不传 = 一条，且确定流自洽'],
    [{ count: 3 }, { count: 3 }, 3, '条数在界内'],
    [{ rng: null }, { rng: null }, 1, 'rng 传 null = 没传（B10 钉过的同一档）'],
    [{ provinceCode: '35' }, { provinceCode: '35' }, 1, '非空字符串省码不被闸门误拒（收窄由 C8 钉）'],
  ];
  for (const [idcardOpts, usccOpts, want, why] of accept) {
    const r = bothGates(idcardOpts, usccOpts);
    for (const [mod, got] of Object.entries(r)) {
      if (got.err) assert.fail(`${mod}：${why} —— 不该抛 → ${got.err.constructor.name}: ${got.err.message}`);
      assert.equal(got.rows.length, want, `${mod}：${why} 的条数`);
    }
    assert.ok(r.generateIdCards.rows.every((g) => parseIdCard(g.id18, { today: TODAY }).state === 'valid'),
      `${why}：idcard 出货自检不过`);
    assert.ok(r.generateUsccCodes.rows.every((g) => parseUscc(g.code).state === 'valid'),
      `${why}：uscc 出货自检不过`);
    assert.ok(r.generateUsccCodes.rows.every((g) => g.code.startsWith('91')),
      `${why}：第 1、2 位的默认字符没落到 9 与 1`);
  }

  // 整个 options 传 null / undefined = 没传。整改前 `generateUsccCodes(null)` 抛的是
  // `TypeError: Cannot read properties of null (reading 'rng')`——一个入参名字都不点，
  // 把调用方传进来的 null 报成引擎崩溃（idcard 的 F4 早就治过同一格）
  for (const noOptions of [null, undefined]) {
    const ids = generateIdCards(noOptions);
    assert.equal(ids.length, 1, `generateIdCards(${String(noOptions)}) 应出一条而不是抛`);
    assert.equal(parseIdCard(ids[0].id18, { today: TODAY }).state, 'valid');
    const codes = generateUsccCodes(noOptions);
    assert.equal(codes.length, 1, `generateUsccCodes(${String(noOptions)}) 应出一条而不是抛`);
    assert.equal(parseUscc(codes[0].code).state, 'valid', `generateUsccCodes(${String(noOptions)}) 出的码自检不过`);
  }

  // 省码合法但底下零候选：`省码 … 下没有现行市级区划` 这道抛从前零判据。镜像上摘掉它
  // （锚点命中 1 处）跑 `generateUsccCodes({ count: 1, rng: seededRandom(4242), provinceCode: '99' })`
  // 抛的是裸 `Error: 内部不变量被破坏：生成的 91undefined295622439Y 自检未通过
  // （state=malformed,charset=false,length=false）`——空池子取回 undefined，又一次把调用方的
  // 入参问题记成实现的 bug。所以下面那两句要的就是"必须是 RangeError 且点名省码 99"。
  // idcard 的同一格并排：两边同档，文案各点各的名。
  const emptyPool = bothGates({ provinceCode: '99' }, { provinceCode: '99' });
  assertBothReject(emptyPool, 'RangeError', /99/, '省码 99 底下没有现行市级区划');
  assert.match(emptyPool.generateUsccCodes.err.message, /省码 99 下没有现行市级区划/,
    'uscc 这一格必须点名省码，而不是含糊一句"没有候选"');
  // 尾句「（区划数据截止 …）」从前零判据：2026-09-26 把它摘掉复跑，C9 只 match 前半串、照旧全绿。
  // 这一句是用户能不能把"省码 99 查不到"读成"数据过时"的关键，且日期必须由 `REGION_META` 来——
  // 所以两句一起钉：既有截止日这一档，又是 `datasetVersion` 那个值本身。
  assert.match(emptyPool.generateUsccCodes.err.message, /区划数据截止 \d{4}-\d{2}-\d{2}）$/,
    `空池文案必须带数据截止日尾句 → ${emptyPool.generateUsccCodes.err.message}`);
  assert.ok(emptyPool.generateUsccCodes.err.message
    .includes(`区划数据截止 ${REGION_META.datasetVersion}`),
    `尾句的日期必须取 REGION_META.datasetVersion（实测 ${REGION_META.datasetVersion}）`
    + ` → ${emptyPool.generateUsccCodes.err.message}`);
  assert.match(emptyPool.generateIdCards.err.message, /没有可生成的行政区划/, 'idcard 同一格的文案');

  // 第 1、2 位这两格是 uscc 独有的（idcard 没有对等键），整改前只有 registry 被 C8 钉过一条 'Z'，
  // category 这一格一次判据都没碰过；数值 9 与 0 从前被 String() 收成合法字符
  const chars = [
    [{ registry: 9 }, /options\.registry/, '数值 9 被 String() 洗成合法字符'],
    [{ category: 0 }, /options\.category/, '数值 0 同上'],
    [{ category: 'ZZ' }, /options\.category/, '两个字符不是单字符（C8 只钉过 registry）'],
    [{ category: 'I' }, /options\.category/, '被剔除的字母 I'],
    [{ registry: '   ' }, /options\.registry/, '全空白串不是单字符'],
  ];
  for (const [options, want, why] of chars) {
    let err = null;
    // 出货的行走完 try 再 stringify（`assertBothReject` 同一档：坏入参那一轮本来该红，
    // 不该因为消息模板里 stringify 而抛穿；绿的那一轮才拿 rows 去拼失败信息）
    let rows = null;
    try {
      rows = generateUsccCodes({ count: 1, rng: seededRandom(4242), ...options });
    } catch (e) {
      err = e;
    }
    if (!err) assert.fail(`generateUsccCodes：${why} —— 居然安静出货 ${JSON.stringify(rows)}`);
    assert.equal(err.constructor.name, 'RangeError', `generateUsccCodes：${why} 的异常类型`);
    assert.match(err.message, want, `generateUsccCodes：${why} 没点名是哪个键 → ${err.message}`);
    assert.match(err.message, /31 字符集内的单个字符/, `generateUsccCodes：${why} 的文案 → ${err.message}`);
    assert.doesNotMatch(err.message, /内部不变量/, `generateUsccCodes：${why} —— 记成了实现有 bug`);
  }
  assert.equal(
    generateUsccCodes({ count: 1, rng: seededRandom(4242), registry: null, category: null })[0].code.slice(0, 2),
    '91', 'registry / category 传 null 等于没传（与 idcard 的 minAge ?? 18 同一档），默认字符仍是 9 与 1');

  // 单条解析入口的 raw 形状：两边都不许抛，且同一形状必须给同一个 state
  // （七个形状 2026-09-25 逐个实跑过：两个模块逐格同态。`String(raw)` 是唯一的洗白通道，
  // 于是数组落到空串、对象落到 `[object Object]`、那条 17 位数字字面量落到
  // `12345678901234568`（double 精度丢了一位）——两边都只按串判定，谁也不许自己崩）
  const rawShapes = [
    ['', 'empty'], [null, 'empty'], [undefined, 'empty'], ['  ', 'empty'], [[], 'empty'],
    [{}, 'malformed'], [12345678901234567, 'malformed'],
  ];
  for (const [raw, want] of rawShapes) {
    assert.equal(parseIdCard(raw).state, want, `parseIdCard(${String(raw)}) 应当是 ${want}`);
    assert.equal(parseUscc(raw).state, want, `parseUscc(${String(raw)}) 应当是 ${want}`);
  }

  // 表外那一格：**单元素数组**的 `String()` 就是那条码本身，于是它落的不是"空串/对象串"
  // 那一档。2026-09-26 实测 `parseUscc(['91350100M000100Y43'])` 是 valid、把生成的 id18 包进
  // 数组喂 `parseIdCard` 也是 valid，与各自的裸串输入逐格同态（`value` 都归一到同一条）。
  // 这一格只能表外单独钉：两个模块的合法码不同形（18 位纯数字 vs 含字母的 31 字符集码），
  // 一条数组不可能同时是两边的合法码，塞进上面那张"两边同态"表会让那一行变成假对照。
  // 它是 `@param` JSDoc 那句"归一之后照样可能是一条合法码"的唯一牙齿。
  const idWrapped = generateIdCards({ count: 1, rng: seededRandom(4242) })[0].id18;
  for (const [label, fn, code] of [['idcard', parseIdCard, idWrapped], ['uscc', parseUscc, NATIONAL]]) {
    const bare = fn(code);
    const wrapped = fn([code]);
    assert.equal(bare.state, 'valid', `${label} 的样本裸串应当是 valid（这一格的前置）`);
    assert.equal(wrapped.state, bare.state,
      `${label}：单元素数组归一成那条码本身，不许降成 malformed → ${wrapped.state}`);
    assert.equal(wrapped.value, bare.value,
      `${label}：单元素数组与裸串必须归一到同一条 → ${wrapped.value}`);
    assert.equal(fn(['x']).state, 'malformed', `${label}：['x'] 落到 "x" 仍按 malformed 判`);
    // 两元素那一格才是"只 String() 一次、不递归拆包"的牙齿：将来谁给入口加了
    // `Array.isArray(raw) ? raw[0] : …` 的"贴心拆包"，上面三格照旧全绿（`[code]` 与
    // `[code,'x']` 的 `raw[0]` 完全同形），只有这一格会红。
    assert.equal(fn([code, 'x']).state, 'malformed',
      `${label}：两元素数组落到 "${code},x"，不许被拆包成首元素再判 valid`);
  }

  // 无原型对象这一格（`Object.create(null)`）：上面那张表里没有它，因为 `String(naked)` 自己就抛。
  // `shapeOf` 的注释从前写着"绝不 String() 一个 Symbol / 无原型对象"，读起来像整个模块都不 String()
  // 它——实际入口是在 `String(raw)` 那一行抛的。2026-09-26 实测：四个字符串入口逐格同抛
  // `TypeError: Cannot convert object to primitive value`，`resolveRegion` 不抛（它先做类型判断），
  // 两个 generate 把它当普通对象收下、照常出一条。
  // 本站口径是**不吞**：这类入参只能是装配层写错，抛出来比静默降成 empty / malformed 好定位，
  // 而且静默给结论会让"面板报了一条 empty"看起来像用户真的粘了空。所以这一圈钉的是"两边同档"，
  // 不是钉这句原生文案（将来真要收类型闸门，两个模块必须一起收、这里一起改）。
  const naked = Object.create(null);
  for (const [label, fn] of [['parseIdCard', parseIdCard], ['parseUscc', parseUscc],
    ['parseIdCardList', parseIdCardList], ['parseUsccList', parseUsccList]]) {
    assert.throws(() => fn(naked), { name: 'TypeError' },
      `${label}：无原型对象在两个模块里必须同抛 TypeError，谁也不许自己静默洗成一条结论`);
  }

  // 批量入口的空文本那一格：idcard 早就给 0 行，uscc 从前给 1 行却注释着"与 parseIdCardList 同形"
  for (const text of ['', null, undefined, '\n', '\n\n', 'a\n\nb', `${NATIONAL}\n\n${R_ZERO}\r\nabc`]) {
    const rows = parseUsccList(text);
    const ids = parseIdCardList(text);
    assert.deepEqual(rows.map((r) => ({ no: r.no, raw: r.raw })), ids.map((r) => ({ no: r.no, raw: r.raw })),
      `同一份粘贴在两个批量入口的行数 / 行号 / 原文不一致：${JSON.stringify(text)}`);
  }
  assert.equal(parseUsccList('').length, 0, '空文本 = 根本没粘贴 = 0 行，不许凭空造一行 empty 结论');
  assert.equal(parseUsccList(null).length, 0, 'null 同上');
  assert.equal(parseUsccList('\n\n').length, 3, '例外只有空文本：空行照旧各占一行号');
});

// ── §D 面板框架纯状态机 ─────────────────────────────────────────────────────

const { createPanelWorkspace, parseHash, keyAction } = await import('../dev/js/tools/panel.js');

/** 设计文档 §5.1 / §5.2 的两页锚点，本段页面还不存在，先按文档里的名字测 */
const TOOLKIT = ['idcard', 'uscc', 'bankcard', 'mobile', 'random'];
const CODEC = ['timestamp', 'base64', 'url', 'digest', 'regex'];

test('D1 属性表：ARIA 骨架齐，id 命名可预期', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT });
  assert.deepEqual(ws.ids(), TOOLKIT, '顺序就是文档顺序，DOM 层要照它渲染');
  assert.equal(ws.active(), 'idcard', '无 hash 时选中第一个');
  const first = ws.tabAttr('idcard');
  assert.deepEqual({
    id: first.id, role: first.role, sel: first['aria-selected'],
    controls: first['aria-controls'], tab: first.tabindex,
  }, {
    id: 'tk-tab-idcard', role: 'tab', sel: 'true',
    controls: 'tk-panel-idcard', tab: '0',
  });
  assert.equal(Object.keys(first).sort().join(','),
    'aria-controls,aria-selected,id,role,tabindex');
  const panel = ws.panelAttr('idcard');
  assert.deepEqual({
    id: panel.id, role: panel.role, labelled: panel['aria-labelledby'],
    tab: panel.tabindex, hidden: panel.hidden,
  }, {
    id: 'tk-panel-idcard', role: 'tabpanel', labelled: 'tk-tab-idcard',
    tab: '0', hidden: false,
  });
  // 页面里两块隐藏内容不是 tabpanel 该管的：本模块不产 role="region" 那套退化形态
  assert.equal(Object.keys(panel).sort().join(','),
    'aria-labelledby,hidden,id,role,tabindex');
  assert.equal(ws.panelAttr('uscc').hidden, true, '未选中的面板必须 hidden');
  // tablist 容器那一格：§6.3 要求页面里有 `role="tablist"`，而本模块的契约是"装配层只写
  // 模块算出来的属性表"。这一格从前不存在（`tabAttr` / `panelAttr` 之外没有第三个属性表），
  // 段 2 只能自己手抄 `role` 与 `aria-label`——同一个节点上两套口径正是这个模块要消灭的。
  const list = ws.tablistAttr();
  assert.deepEqual(Object.keys(list).sort().join(','),
    'aria-label,aria-orientation,id,role',
    '容器属性表只该这四格：多一格就是装配层要猜怎么写');
  assert.deepEqual(list, {
    id: 'tk-tablist', role: 'tablist', 'aria-label': '工具面板', 'aria-orientation': 'vertical',
  }, '默认前缀 / 默认 label / 默认走向（§6.3 的索引条是左侧粘性那一档）');
  const wide = createPanelWorkspace({
    ids: CODEC, prefix: 'jt', label: '编码工具', orientation: 'horizontal',
  });
  assert.deepEqual(wide.tablistAttr(), {
    id: 'jt-tablist', role: 'tablist', 'aria-label': '编码工具', 'aria-orientation': 'horizontal',
  }, '三个构造参数必须一起进容器属性表，`tabAttr` 那边已经吃了前缀');
  assert.equal(wide.tabAttr('timestamp').id, 'jt-tab-timestamp', '同一前缀贯穿 tab 侧');
  // 走向只接受两个值：写错的 `'vertical '` / `'Vertical'` 会被浏览器原样当无效值吞掉，
  // 读屏照旧播报水平条——这种"看起来配了其实没配"的形状只能在构造时就炸。
  for (const bad of ['Vertical', 'vertical ', 'both', 1, null]) {
    assert.throws(() => createPanelWorkspace({ ids: TOOLKIT, orientation: bad }),
      { name: 'RangeError', message: /options\.orientation/ },
      `orientation 收到 ${String(bad)} 必须点名是哪一个键`);
  }
  // `prefix` / `label` 只有"形状或空"这一类错，所以四档共用一个异常类型；写成循环而不是
  // 四行，是因为这两格从前一次判据都没碰过（旧 §D 的 3 格 throws 全在别处）。
  for (const bad of [1, null, '', '   ']) {
    assert.throws(() => createPanelWorkspace({ ids: TOOLKIT, prefix: bad }),
      { name: 'TypeError', message: /options\.prefix/ }, `prefix 收到 ${String(bad)}`);
    assert.throws(() => createPanelWorkspace({ ids: TOOLKIT, label: bad }),
      { name: 'TypeError', message: /options\.label/ }, `label 收到 ${String(bad)}`);
  }
  // JSON 工作台换前缀时，tab 与 panel 两侧的配对必须一起换，否则 aria-labelledby 指空
  const jt = createPanelWorkspace({ ids: ['format', 'convert'], prefix: 'jt' });
  assert.deepEqual({
    controls: jt.tabAttr('format')['aria-controls'],
    labelled: jt.panelAttr('format')['aria-labelledby'],
  }, { controls: 'jt-panel-format', labelled: 'jt-tab-format' });
});

test('D2 roving tabindex：整条 tablist 上只有一个是 0', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT, hash: '#mobile' });
  const tabs = TOOLKIT.map((id) => ws.tabAttr(id));
  assert.deepEqual(tabs.filter((t) => t.tabindex === '0').map((t) => t.id), ['tk-tab-mobile'],
    'tabindex=0 的数量不是 1，键盘用户就会掉进 tab 黑洞');
  assert.equal(tabs.every((t) => t.tabindex === '0' || t.tabindex === '-1'), true,
    'tabindex 只能是字符串 0 / -1，写成布尔或数字会让属性丢失');
  assert.deepEqual(tabs.filter((t) => t['aria-selected'] === 'true').map((t) => t.id), ['tk-tab-mobile']);
  ws.move('next');
  assert.equal(ws.tabAttr('random').tabindex, '0', '切换后 roving 要跟着走');
  assert.equal(ws.tabAttr('mobile').tabindex, '-1');
  assert.equal(ws.tabAttr('random')['aria-selected'], 'true');
  assert.equal(ws.tabAttr('mobile')['aria-selected'], 'false', 'aria-selected 与 tabindex 必须互锁');
  assert.equal(ws.panelAttr('mobile').hidden, true, '自动激活：焦点走的同时面板就换');
  assert.equal(ws.panelAttr('random').hidden, false);
});

test('D3 方向键与 Home/End：首尾回绕，非索引键不动状态', () => {
  const ws = createPanelWorkspace({ ids: CODEC });
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual(ws.move('next'), { active: 'base64', changed: true });
  assert.deepEqual(ws.move('prev'), { active: 'timestamp', changed: true });
  assert.deepEqual(ws.move('prev'), { active: 'regex', changed: true }, '首位再 prev 回绕到末位');
  assert.deepEqual(ws.move('last'), { active: 'regex', changed: false }, '已在末位，last 是空操作');
  ws.move('first');
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual(ws.move('nonsense'), { active: 'timestamp', changed: false },
    '不认识的动作文本必须是空操作而不是跳空白');
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual({ a: keyAction({ key: 'ArrowDown' }), b: keyAction({ key: 'ArrowUp' }),
    c: keyAction({ key: 'Home' }), d: keyAction({ key: 'End' }),
    e: keyAction({ key: 'ArrowRight' }), f: keyAction({ key: 'ArrowLeft' }) },
  { a: 'next', b: 'prev', c: 'first', d: 'last', e: 'next', f: 'prev' });
  assert.equal(keyAction({ key: 'ArrowDown', ctrlKey: true }), '', '带修饰键的上下键是系统快捷键，不抢');
  assert.equal(keyAction({ key: 'ArrowUp', shiftKey: true }), '');
  assert.equal(keyAction({ key: 'a' }), '');
  assert.equal(keyAction({}), '');
  assert.equal(keyAction(null), '');
});

test('D4 hash 双向：解析容错、未知不下沉、无 hash 不写 hash', () => {
  assert.deepEqual(parseHash('#uscc', TOOLKIT), { id: 'uscc', unknown: false });
  assert.deepEqual(parseHash('uscc', TOOLKIT), { id: 'uscc', unknown: false }, '漏了 # 也要认');
  assert.deepEqual(parseHash('#USCC', TOOLKIT), { id: 'uscc', unknown: false }, '大小写不敏感');
  assert.deepEqual(parseHash('  #uscc  ', TOOLKIT), { id: 'uscc', unknown: false });
  assert.deepEqual(parseHash('', TOOLKIT), { id: null, unknown: false }, '无 hash 不是异常');
  assert.deepEqual(parseHash('#', TOOLKIT), { id: null, unknown: false });
  assert.deepEqual(parseHash(null, TOOLKIT), { id: null, unknown: false });
  assert.deepEqual(parseHash('#nope', TOOLKIT), { id: null, unknown: true });
  assert.deepEqual(parseHash('#idcard/../x', TOOLKIT), { id: null, unknown: true },
    '奇奇怪怪的 hash 只能当不认识，不能进 id');
  const ws = createPanelWorkspace({ ids: TOOLKIT, hash: '#bankcard' });
  assert.equal(ws.active(), 'bankcard');
  assert.equal(ws.unknownHash(), false);
  assert.equal(ws.toHash(), '#bankcard', '写回页面的 hash 由模块给，DOM 层不自己拼');
  assert.equal(ws.select('nope'), false);
  assert.equal(ws.active(), 'bankcard', '未知 id 不得把面板切成空白');
  // §6.0 第四条口径：`select` 的返回值只回答"有没有这块面板"，不回答"换没换"。
  // 点已经亮着的那块是合法操作，这里若报 false，装配层会对一次正常点击弹"没有这个面板"。
  // 写的是严格相等，所以同一格顺带钉住"返回的是布尔 true，不是 `move` 那种 `{active,
  // changed}` 对象"——装配层拿它只能做一件事（`false` 就什么也不写）。`changed` 判据在 D3。
  assert.equal(ws.select('bankcard'), true, '点已选中的 tab 必须返回布尔 true');
  assert.equal(ws.active(), 'bankcard', '再点一次不动状态，也不报错');
  // 两条副作用与"换没换"无关：点的就是当前这块也照样置 `touched`、清 `unknown`。
  // 装配层据此实现"坏 hash 提示 → 用户一动手就消失"，所以这两格必须钉在 select 上，
  // 不许哪天优化成"没换就不动状态"。
  const hinted = createPanelWorkspace({ ids: TOOLKIT, hash: '#nope' });
  assert.equal(hinted.unknownHash(), true, '开局坏 hash 要留得下线索');
  assert.equal(hinted.active(), 'idcard', '坏 hash 回落到第一块，不是空白');
  assert.equal(hinted.toHash(), '', '开局坏 hash 时不往地址栏写东西');
  assert.equal(hinted.select('idcard'), true, '点的就是回落的那一块，仍然是合法点击');
  assert.equal(hinted.unknownHash(), false, '用户动手后那条坏 hash 提示该消失');
  assert.equal(hinted.toHash(), '#idcard', '同上：没有换面板，但从这一刻起该写 hash 了');
  const cleared = createPanelWorkspace({ ids: TOOLKIT });
  assert.equal(cleared.applyHash('#nope'), false);
  assert.equal(cleared.unknownHash(), true);
  cleared.select('idcard');
  assert.equal(cleared.unknownHash(), false, 'applyHash 留下的 unknown 也由 select 清');
  assert.equal(ws.applyHash('#random'), true);
  assert.equal(ws.active(), 'random');
  assert.equal(ws.applyHash('#nope'), false, 'applyHash 把 unknown 变成返回值，DOM 层据此提示');
  assert.equal(ws.unknownHash(), true);
  assert.equal(ws.active(), 'random');
  assert.equal(ws.applyHash(''), false, 'hash 被清空时不动当前面板');
  assert.equal(ws.active(), 'random');
  // 首次进入且 URL 里没有 #：选中第一块，但不产生 hash、不改历史
  const bare = createPanelWorkspace({ ids: TOOLKIT });
  assert.equal(bare.active(), 'idcard');
  assert.equal(bare.toHash(), '', '没有用户动作就不该往地址栏写东西');
  bare.select('uscc');
  assert.equal(bare.toHash(), '#uscc', '点过之后才开始写 hash');
  // 构造期的 `hash` 闸门：非串是装配层写错，抛 `TypeError` 点名 options.hash。
  // 与上面第 8 格（`parseHash(null, ids)` 安静返回"没有 hash"）**口径故意不同**：
  // `parseHash` 是纯工具、也会被 `applyHash` 拿去吃实时 `location.hash`，那里抛等于把
  // 一次浏览器事件变成未捕获异常；构造参数只有装配层会传，写错了要当场炸在接线处。
  const hashGates = [['null', null], ['number 1', 1], ['Array(1)', ['uscc']],
    ['object', { hash: 'uscc' }]];
  for (const [label, bad] of hashGates) {
    assert.throws(() => createPanelWorkspace({ ids: TOOLKIT, hash: bad }),
      { name: 'TypeError', message: /options\.hash/ }, `hash 收到 ${label}`);
  }
});

test('D5 单块塌了不整页塌：错误只记在那一块上', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT });
  assert.equal(ws.brokenOf('idcard'), '');
  ws.markBroken('uscc', '区划数据未就绪');
  assert.equal(ws.brokenOf('uscc'), '区划数据未就绪');
  assert.equal(ws.brokenOf('idcard'), '', '别的面板不得被连坐');
  assert.equal(ws.tabAttr('uscc')['aria-selected'], 'false', '坏掉的面板照样能选中，用户才看得见错误条');
  assert.equal(ws.panelAttr('uscc').hidden, true, '未选中时照样 hidden：错误条在面板里，不该飘在页面上');
  ws.select('uscc');
  assert.equal(ws.active(), 'uscc');
  assert.equal(ws.panelAttr('uscc').hidden, false);
  ws.markBroken('uscc', '换了个原因');
  assert.equal(ws.brokenOf('uscc'), '换了个原因', '重复标记是覆盖而不是叠加，否则错误条会越长越长');
  assert.deepEqual(ws.brokenIds(), ['uscc']);
  ws.clearBroken('uscc');
  assert.equal(ws.brokenOf('uscc'), '');
  assert.deepEqual(ws.brokenIds(), []);
  ws.markBroken('random', 'x');
  ws.markBroken('idcard', 'y');
  assert.deepEqual(ws.brokenIds(), ['idcard', 'random'], '按面板顺序报，DOM 层据此渲染汇总条');
  // 不认识的面板 id：`markBroken` / `clearBroken` 同档抛 `RangeError`（形状对、值不能用），
  // 且两句都回显那一个 id。整改前三格是裸 `Error` + 只有一句话，`clearBroken` 那一格
  // 干脆静默"没这块、没事发生"——装配层把 `clearBroken('ucc')` 的笔误吞了，页面上那块
  // 面板的错误条会一直挂着，而控制台一个字没有。
  for (const [label, act] of [
    ['markBroken', () => ws.markBroken('nope', 'x')],
    ['clearBroken', () => ws.clearBroken('nope')],
  ]) {
    let err = null;
    try {
      act();
    } catch (e) {
      err = e;
    }
    if (!err) assert.fail(`${label}：不认识的面板 id 必须抛，不许静默`);
    assert.equal(err.constructor.name, 'RangeError', `${label}：异常类型（形状对而值不能用）`);
    assert.match(err.message, /nope/, `${label}：要回显那一个 id → ${err.message}`);
    assert.match(err.message, /不在 ids 里/, `${label}：要说是 ids 的事 → ${err.message}`);
    assert.doesNotMatch(err.message, /undefined|\[object |TypeError/, `${label}：回显不许是类型噪声`);
  }
  // 构造期四道闸门：缺 ids / 非数组 / 空数组 / 逐项，两类异常各归其位。
  // 空数组是 `RangeError`（形状是数组、值不能用），非数组是 `TypeError`——这一档从前混成
  // 一句 `Error`，`config.map(...)` 漏 filter 与 `config` 忘了解构两类笔误报同一句话。
  assert.throws(() => createPanelWorkspace({}), { name: 'TypeError', message: /options\.ids 必填/ },
    '缺 ids 要点名 options.ids');
  assert.throws(() => createPanelWorkspace(), { name: 'TypeError', message: /options\.ids 必填/ },
    '整个参数不传也是同一句话，不许落到解构后面的某一行');
  // 表写成对象行：本会话第一版写成 `[['idcard'], …]`，把"字符串不是数组"那一格误写成
  // 一个合法的单元素数组，靠下面那句 `assert.fail`（"居然安静构造出来了"）当场暴露——
  // 元组表在 ids 本身就是数组/字符串时读不出层次，正是这种格子会静默改测试口径。
  const ctorGates = [
    { ids: 'idcard', name: 'TypeError', msg: /应为非空字符串数组/, why: '字符串不是数组' },
    { ids: null, name: 'TypeError', msg: /应为非空字符串数组/, why: 'null 不是数组' },
    { ids: { id: 'a' }, name: 'TypeError', msg: /应为非空字符串数组/, why: '对象不是数组' },
    { ids: [], name: 'RangeError', msg: /是空数组/, why: '空数组是值不能用而不是形状不对' },
    { ids: ['a', 1], name: 'TypeError', msg: /options\.ids\[1\]/, why: '逐项错要报到下标' },
    { ids: ['a', ''], name: 'TypeError', msg: /options\.ids\[1\]/, why: '空串那一格同上' },
    {
      ids: ['a', '   '], name: 'TypeError', msg: /options\.ids\[1\]/,
      why: '全空白不是有效 id：装配层多半是 trim 漏了',
    },
    {
      ids: ['a', 'b', 'a'], name: 'RangeError',
      msg: /options\.ids\[2\] 与第 0 项重复（a）/, why: '重复报到第二次出现的下标',
    },
  ];
  for (const { ids, name: wantName, msg: wantMsg, why } of ctorGates) {
    let err = null;
    try {
      createPanelWorkspace({ ids });
    } catch (e) {
      err = e;
    }
    if (!err) assert.fail(`createPanelWorkspace：${why} —— 居然安静构造出来了`);
    assert.equal(err.constructor.name, wantName, `createPanelWorkspace：${why} 的异常类型`);
    assert.match(err.message, wantMsg, `createPanelWorkspace：${why} 没点到那一格 → ${err.message}`);
    assert.doesNotMatch(err.message, /Cannot read|is not iterable/,
      `createPanelWorkspace：${why} —— 落到原生报错等于没闸门 → ${err.message}`);
  }
});

// ── §E0 银行卡码表数据形状（快照 → 生成物） ──────────────────────────────
const { BANKS, BIN_META, BIN_ROWS } = await import('../dev/js/tools/bank-bin-data.js');
test('E0-1 生成物与快照同步：--check 必须退 0', () => {
  // 这条判据不看内容只看退出码：它防的是"改了快照忘了重跑生成器"这一整类漂移。
  const r = spawnSync(process.execPath, ['scripts/build-prefix-data.mjs', '--check'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `生成物落后于快照：\n${r.stdout}${r.stderr}`);
});
test('E0-2 BIN 表：形状、行别下标、并列登记按字典序且一条不丢', () => {
  assert.equal(BANKS.length, 260, '行别码条数与快照实测不一致');
  const rows = BIN_ROWS.split(';');
  assert.equal(rows.length, 1709, '条目数少于快照行数——并列登记被去掉了');
  assert.deepEqual([...rows].sort(), rows, '条目没有按文本排序，取哪一条不确定');
  const counts = new Map();
  for (const row of rows) {
    const [bin, idx, type, len] = row.split(' ');
    assert.match(bin, /^\d{3,10}$/);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
    assert.ok(Number.isInteger(+idx) && +idx >= 0 && +idx < BANKS.length, `${bin} 的行别下标越界`);
    assert.ok(['DC', 'CC', 'PC', 'SCC'].includes(type), `${bin} 的卡种类 ${type} 不在已知的四种里`);
    // 快照实测只有 15–19 五档（15:5、16:1005、17:52、18:89、19:558）。出现 14 或 20
    // 就是上游加了新卡种，读侧的"长度不符"文案要人重看，所以这里钉死而不是给区间。
    assert.ok([15, 16, 17, 18, 19].includes(+len), `${bin} 的卡号长度 ${len} 不在五档里`);
  }
  // 上游本来就有 12 个 BIN 挂着两条登记（快照实测 1,709 行 / 1,697 个不同 BIN）。
  // 这一格把"读到几条并列"钉住，读侧据此决定要不要把候选都列出来（Task 2 的 E6）。
  const dup = [...counts.entries()].filter(([, n]) => n > 1);
  assert.equal(counts.size, 1697);
  assert.equal(dup.length, 12, `并列登记的 BIN 个数变了：${dup.map(([b]) => b).join(' ')}`);
  assert.ok(dup.every(([, n]) => n === 2), '出现了三条以上的并列登记，读侧的展示口径要重定');
});

test('E0-3 每一位数档都有代表，最长前缀不是只对着 6 位一种写', () => {
  const byLen = new Map();
  for (const row of BIN_ROWS.split(';')) {
    const n = row.split(' ')[0].length;
    byLen.set(n, (byLen.get(n) ?? 0) + 1);
  }
  // 快照实测：3 位 2 条、4 位 3 条、5 位 30 条、6 位 1,594 条、7 位 2 条、8 位 28 条、
  // 9 位 48 条、10 位 2 条。少任何一档，说明读侧的分桶在生成器里就没被写全。
  for (const [n, want] of [[3, 2], [4, 3], [5, 30], [6, 1594], [7, 2], [8, 28], [9, 48], [10, 2]]) {
    assert.equal(byLen.get(n) ?? 0, want, `${n} 位 BIN 条数变了`);
  }
});

test('E0-4 表里确实有嵌套前缀：8 个父 BIN、32 组、9 条登记生成时会挨挡', () => {
  // 这一段钉的是**生成侧避让**赖以成立的数据形状。旧口径说"表里唯一一组嵌套是 9558 ⊂ 95588"，
  // 实测是 32 组、8 个父 BIN，其中 9 条登记的本体位数够补齐自家子前缀——那 9 条正是
  // `603265 / 621059 / 621241 / 621260×2 / 622421 / 622498 / 940046 / 9558`。
  const rows = BIN_ROWS.split(';').map((r) => r.trim().split(' '));
  const bins = [...new Set(rows.map((r) => r[0]))];
  const kids = (b) => bins.filter((x) => x.length > b.length && x.startsWith(b));
  const parents = bins.filter((b) => kids(b).length > 0);
  assert.equal(parents.length, 8, '有更长子前缀的 BIN 个数变了，生成侧的避让口径要重看');
  assert.equal(parents.reduce((n, b) => n + kids(b).length, 0), 32, '嵌套前缀对数变了，同上');
  assert.deepEqual(parents.sort(), ['603265', '621059', '621241', '621260', '622421', '622498', '940046', '9558']);
  const risky = rows.filter(([b, , , len]) => kids(b).some((c) => c.length <= +len - 1));
  assert.equal(risky.length, 9, '生成时会被自家更长前缀盖住的登记条数变了');
  // 最挤的一支（621260 下 62126010 开头）挡 8 个数字、仍留 2 个可走；十个全被占满的分支必须有界
  const branch = new Map();
  for (const b of parents) for (const c of kids(b)) {
    const pre = c.slice(0, c.length - 1);
    if (!branch.has(pre)) branch.set(pre, new Set());
    branch.get(pre).add(c[c.length - 1]);
  }
  assert.equal([...branch.values()].reduce((n, s) => Math.max(n, s.size), 0), 8, '单支挡路数字上限变了');
  assert.ok([...branch.values()].every((s) => s.size < 10), '有分支把 0-9 全占满，避让会退化成重取');
  // 子前缀长度**正好等于**登记位数的那一支今天要不存在，生成侧自检那格才够得着
  assert.equal(rows.filter(([b, , , len]) => kids(b).some((c) => c.length === +len)).length, 0,
    '出现了与登记位数等长的子前缀，生成侧要连校验位一起撞，自检那格从不可达变可达');
});

// ── §F0 号段数据形状 ─────────────────────────────────────────────────────
const { CARRIER_SEGMENTS } = await import('../dev/js/tools/carrier-data.js');
test('F0-1 五家运营商、56 个三位段、彼此不重叠', () => {
  assert.equal(CARRIER_SEGMENTS.length, 5);
  const owner = new Map();
  let total = 0;
  for (const [carrier, segsText] of CARRIER_SEGMENTS) {
    const segs = segsText.split(' ');
    assert.ok(segs.length > 0, `${carrier} 一个号段都没有`);
    total += segs.length;
    for (const s of segs) {
      assert.match(s, /^1[3-9]\d$/, `${carrier} 的号段 ${s} 不是合法的三位移动段`);
      assert.ok(!owner.has(s), `号段 ${s} 同时属于 ${owner.get(s)} 与 ${carrier}`);
      owner.set(s, carrier);
    }
  }
  assert.equal(total, 56);
});

// ── §E 银行卡 ──────────────────────────────────────────────────────────────
const { BANK_CAVEAT, BANK_OPTIONS, BIN_SOURCE, CARD_TYPES,
  GENERATE_MAX: BANK_GENERATE_MAX, PAN_MAX, PAN_MIN, TOP_BANKS,
  formatCardGroup, generateBankCards, lookupBin, luhnCheckDigit, luhnValid, luhnWork,
  parseBankCard, parseBankCardList } = await import('../dev/js/tools/bankcard.js');

const ck = (r) => Object.fromEntries(r.checks.map((c) => [c.key, c.ok]));
/** 本体 → 补好校验位的整串 */
const pan = (body) => body + luhnCheckDigit(body);

test('E1 Luhn 官方向量与逐位算式', () => {
  assert.equal(luhnValid('4242424242424242'), true);
  assert.equal(luhnValid('4242424242424241'), false);
  const w = luhnWork('7992739871');
  assert.equal(w.sum, 67);
  assert.equal(w.mod, 7);
  assert.equal(w.expected, '3');
  assert.equal(luhnCheckDigit('7992739871'), '3');
  assert.equal(luhnValid('79927398713'), true, '11 位：Luhn 成立但位数不在 13–19，由 E6 单独管');
});

test('E2 逐位算式的每一步都能手算对上', () => {
  const w = luhnWork('424242424242424');
  assert.equal(w.steps.length, 15);
  assert.deepEqual(w.steps.slice(0, 3), [
    { d: 4, pos: 15, double: true, value: 8 },
    { d: 2, pos: 14, double: false, value: 2 },
    { d: 4, pos: 13, double: true, value: 8 },
  ]);
  assert.deepEqual(w.steps.at(-1), { d: 4, pos: 1, double: true, value: 8 }, '本体最右位必须翻倍');
  for (const s of w.steps) {
    const doubled = s.d * 2;
    assert.equal(s.value, s.double ? (doubled > 9 ? doubled - 9 : doubled) : s.d, `第 ${s.pos} 位`);
  }
  assert.equal(w.sum % 10, w.mod);
  assert.equal(w.expected, String((10 - w.mod) % 10));
  assert.equal(w.sum, w.steps.reduce((n, s) => n + s.value, 0));
});

test('E3 本体不合规时算式返回 null，不抛', () => {
  for (const bad of ['', '12a45', null, undefined, 4242, ['4242']]) {
    assert.equal(luhnWork(bad), null, `收到 ${JSON.stringify(bad)}`);
  }
  assert.equal(luhnCheckDigit('12a45'), null);
  assert.equal(luhnValid('7'), false, '单字符没有"本体"可言，一律算不成立而不是抛');
});

test('E4 五态各命中一次，且硬结论优先于软参考', () => {
  assert.equal(parseBankCard('').state, 'empty');
  assert.equal(parseBankCard('622588013763447x').state, 'malformed');
  assert.equal(parseBankCard('9999999999999999').state, 'luhn');
  assert.equal(parseBankCard('4242424242424242').state, 'unlisted');
  assert.equal(parseBankCard('6212601500012345').state, 'valid');
  // 999999 恰好是华夏银行在表内的 BIN，所以它落 luhn 而不是 unlisted：
  // Luhn 不过这条**硬**结论必须排在"表外"这条**软**参考之前。
  assert.equal(ck(parseBankCard('9999999999999999')).bin, true, '校验位不对也照样报行别');
  assert.equal(parseBankCard('9999999999999995').state, 'valid');
});

test('E5 各状态转换处 checks 的行数与三态分布', () => {
  assert.deepEqual(parseBankCard('').checks, [], '空输入不摆四行表，面板按 state 显示引导文案');
  const short = parseBankCard('111111111113');
  assert.deepEqual(ck(short), { charset: true, length: false });
  assert.equal(short.info, null, '位数这一关就出局的，不给 info');
  assert.equal(ck(parseBankCard('622588013763447x')).charset, false);
  assert.deepEqual(ck(parseBankCard('622588013763447x')), { charset: false, length: true },
    '字符不过时只走两行，不给后面的 Luhn 与行别');
  assert.deepEqual(ck(parseBankCard('6212601500012345')),
    { charset: true, length: true, luhn: true, bin: true });
});

test('E6 位数闸门按 13–19 两侧各切一刀', () => {
  assert.equal(PAN_MIN, 13);
  assert.equal(PAN_MAX, 19);
  assert.equal(parseBankCard(pan('1'.repeat(11))).digits.length, 12);
  assert.equal(parseBankCard(pan('1'.repeat(11))).state, 'malformed', '12 位在门外');
  assert.equal(parseBankCard(pan('1'.repeat(12))).state, 'unlisted', '13 位进门');
  assert.equal(parseBankCard(pan('1'.repeat(18))).state, 'unlisted', '19 位仍在门内');
  assert.equal(parseBankCard(pan('1'.repeat(19))).digits.length, 20);
  assert.equal(parseBankCard(pan('1'.repeat(19))).state, 'malformed', '20 位出界');
});

test('E7 分组分隔符不算错，六种写法同一结论', () => {
  const want = parseBankCard('6212601500012345');
  for (const form of ['6212 6015 0001 2345', '6212-6015-0001-2345',
    '6212\u30006015\u30000001\u30002345', '6212\u00A06015\u00A00001\u00A02345',
    '6212\t6015\t0001\t2345', '  6212601500012345  ']) {
    const r = parseBankCard(form);
    assert.equal(r.state, want.state, form);
    assert.equal(r.digits, '6212601500012345', form);
    assert.equal(r.checks[0].ok, true, form);
  }
  assert.equal(parseBankCard('-').state, 'malformed', '整串只有分隔符：去掉之后 0 位，位数那一行红');
  assert.equal(parseBankCard('-').digits, '');
  const bad = parseBankCard('6212 6015 0001 234a');
  assert.equal(bad.state, 'malformed');
  assert.match(bad.checks[0].detail, /「a」（去掉分组空格与连字符后的第 16 位）/);
});

test('E8 最长前缀：95588 赢过 9558，试过的档位按降序留痕', () => {
  const r = parseBankCard('9558891712345678908');
  assert.equal(r.state, 'valid');
  assert.equal(r.info.bin, '95588');
  assert.equal(r.info.binLength, 5);
  assert.deepEqual(r.info.triedLengths, [10, 9, 8, 7, 6, 5]);
  assert.equal(lookupBin('9558891712345678908').bin, '95588', '表里 9558 与 95588 同属 ICBC，取最长');
  assert.equal(lookupBin('9896123456789012').bin, '9896', '四位 BIN 要在试完 10–5 之后仍被命中');
  assert.deepEqual(lookupBin('9896123456789012').tried, [10, 9, 8, 7, 6, 5, 4]);
  assert.equal(lookupBin('4242424242424242'), null);
});

test('E9 前缀不得吃掉整串：至少留一位给账号体', () => {
  assert.equal(lookupBin('103'), null, '三位串不许拿三位 BIN 命中（103 确实在表里，是 ABC）');
  assert.equal(lookupBin('1034').bin, '103', '四位串就可以；3 是表内最短的一档');
  assert.equal(lookupBin('95588').bin, '9558', '五位串拿不到 95588（它自己就等于串长），退到 9558');
  assert.equal(lookupBin('1'.repeat(13)), null, '谁的延伸都没命中，就是 null');
  assert.deepEqual(parseBankCard(pan('1'.repeat(12))).info.triedLengths,
    [10, 9, 8, 7, 6, 5, 4, 3], '13 位串从 10 试到 3；13 本身不落进候选（前缀必须给账号体留一位）');
});

test('E10 并列登记：主结论按位数挑，文案点名另一条', () => {
  const as16 = parseBankCard('6212601500012345');
  assert.equal(as16.ambiguous, true);
  assert.equal(as16.matches.length, 2);
  assert.equal(as16.info.primary.bankCode, 'SPABANK');
  assert.equal(as16.info.primary.cardType, 'CC');
  assert.equal(as16.checks[3].ok, true);
  assert.match(as16.checks[3].detail, /^平安银行（SPABANK）· 贷记卡 · 表内登记 16 位/);
  assert.match(as16.checks[3].detail, /另有 1 条并列登记（CSRCB\/借记卡\/19 位）/);
  const as19 = parseBankCard(pan('621260150001234567'.padEnd(18, '8')));
  assert.equal(as19.digits.length, 19);
  assert.equal(as19.state, 'valid');
  assert.equal(as19.info.primary.bankCode, 'CSRCB', '19 位串必须挑中登记 19 位的那条，而不是字典序第一条');
  assert.match(as19.checks[3].detail, /^常熟农商银行（CSRCB）· 借记卡 · 表内登记 19 位/);
  assert.deepEqual(as19.matches.map((m) => m.lengthMatches), [false, true]);
});

test('E11 登记位数不一致只记 null，不拖垮结论', () => {
  const off = parseBankCard('621260150001234567');
  assert.equal(off.digits.length, 18);
  assert.equal(off.state, 'valid', 'Luhn 过、前缀在表内但两条登记都对不上 18 位——只降 bin 行');
  assert.equal(off.checks[3].ok, null);
  assert.match(off.checks[3].detail, /此号 18 位（登记可能有缺漏，不据此判无效）/);
  assert.equal(parseBankCard('621260150001234').state, 'luhn', '15 位那条同时栽在 Luhn，硬的排在前面');
  assert.equal(ck(parseBankCard('621260150001234')).bin, null);
});

test('E12 未收录前缀：null 而不是 false，caveat 每条都在', () => {
  const r = parseBankCard('4242424242424242');
  assert.equal(ck(r).bin, null);
  assert.deepEqual(r.matches, []);
  assert.equal(r.ambiguous, false);
  assert.equal(r.info.bin, '');
  assert.equal(r.info.binLength, null);
  assert.deepEqual(r.info.triedLengths, [10, 9, 8, 7, 6, 5, 4, 3]);
  assert.match(r.checks[3].detail, /^前缀未收录（最长试到 10 位），不据此判无效$/);
  assert.equal(r.hasCaveat, true);
  assert.match(r.caveat, /不承诺全量/);
  assert.match(r.caveat, /查不到不等于号码无效/);
  assert.equal(r.info.source, BIN_SOURCE);
  assert.match(BIN_SOURCE, /^hexindai\/bcbc @ de63182（快照 2026-09-26）$/);
});

test('E13 建议形态只在 Luhn 那一档给', () => {
  const bad = parseBankCard('6212601500012340');
  assert.equal(bad.state, 'luhn');
  assert.equal(bad.info.luhnGiven, '0');
  assert.equal(bad.suggestedCard, '6212601500012345');
  assert.equal(parseBankCard(bad.suggestedCard).state, 'valid');
  assert.equal(parseBankCard('622588013763447x').suggestedCard, '', '结构非法不给建议号');
  assert.equal(parseBankCard('4242424242424242').suggestedCard, '', '本来就成立的更不给');
});

test('E14 入参形状：null / undefined / 数值都按字符串走，不抛', () => {
  for (const [v, want] of [[null, 'empty'], [undefined, 'empty'], [0, 'malformed'],
    [false, 'malformed'], [{}, 'malformed']]) {
    assert.equal(parseBankCard(v).state, want, `${JSON.stringify(v)} 必须安静地给出结论而不是抛`);
  }
  assert.equal(parseBankCard(null).state, 'empty');
  assert.equal(parseBankCard(undefined).state, 'empty');
  assert.equal(parseBankCard(621260150001234).state, 'luhn', '15 位数值：位数在区间内，只剩 Luhn');
  const r = parseBankCard(1234567890123456789);
  assert.equal(r.digits, '1234567890123456800', '19 位数值超出 2^53，进函数前末位就已经被舍掉');
  assert.equal(r.state, 'luhn', '舍出来的串仍按 19 位判：报的是"末位与算式不符"，不是"位数非法"');
  assert.equal(r.info.luhnGiven, '0');
});

test('E15 生成侧：任意收窄都自洽，产出的号必被自己判 valid', () => {
  // 钉种子：这一段本来用默认 rng（`seededRandom(Date.now())`），一旦红了就没法复现当时那组号。
  // 默认 rng 那条路径由 E16 的 `rng: null` 覆盖，不靠这里。
  for (const opts of [{}, { count: 5 }, { bankCode: 'ICBC' }, { cardType: 'CC' },
    { bin: '95588', length: 19 }, { length: 15 }, { bankCode: 'CMB', cardType: 'DC' }]) {
    const list = generateBankCards({ ...opts, rng: seededRandom(20260927) });
    assert.equal(list.length, opts.count ?? 1, JSON.stringify(opts));
    for (const item of list) {
      assert.equal(item.number.length, item.panLength);
      assert.equal(item.number.startsWith(item.bin), true);
      assert.equal(item.formatted, formatCardGroup(item.number));
      assert.equal(item.caveat, BANK_CAVEAT);
      const back = parseBankCard(item.number);
      assert.equal(back.state, 'valid', `${item.number} 自检为 ${back.state}`);
      assert.equal(back.info.primary.bankCode, item.bankCode);
      assert.equal(back.info.primary.cardType, item.cardType);
      assert.equal(back.info.bin, item.bin);
    }
  }
  assert.equal(BANK_GENERATE_MAX, 50);
});

test('E16 固定 rng 可复现，取值口径与身份证侧同档', () => {
  const rngSeed = () => { let s = 7; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
  const a = generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.number);
  const b = generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.number);
  assert.deepEqual(a, b);
  // 定值 LCG 下这 8 条是确定的 8 个不同 BIN（实测 8/8）；`> 1` 那种写法漏掉"退化成两三条轮转"
  assert.equal(new Set(a).size, 8, '同一个种子连出 8 条不是 8 个不同号，说明随机体没充分参与');
  assert.equal(new Set(generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.bin)).size, 8);
  assert.throws(() => generateBankCards({ rng: () => 2 }), /options\.rng 每次应给出 \[0, 1\)/);
  assert.throws(() => generateBankCards({ rng: 'x' }), TypeError);
  assert.equal(generateBankCards({ count: 1, rng: null }).length, 1, 'null = 没传，与 generateIdCards 同档');
});

test('E17 生成侧闸门点名到具体键', () => {
  assert.throws(() => generateBankCards({ count: 0 }), RangeError);
  assert.throws(() => generateBankCards({ count: BANK_GENERATE_MAX + 1 }), /options\.count 应为 1\.\.50/);
  assert.throws(() => generateBankCards({ count: '5' }), RangeError);
  assert.throws(() => generateBankCards({ bankCode: 'NOPE' }), /不在表内 260 个行别码里/);
  assert.throws(() => generateBankCards({ bankCode: 622588 }), TypeError);
  assert.throws(() => generateBankCards({ bankCode: '   ' }), TypeError);
  assert.throws(() => generateBankCards({ cardType: 'X' }), /只能是 DC \/ CC \/ PC \/ SCC/);
  assert.throws(() => generateBankCards({ bin: '62a' }), /options\.bin 只能含数字/);
  assert.throws(() => generateBankCards({ length: 12 }), /options\.length 应为 13\.\.19/);
  assert.throws(() => generateBankCards({ length: 20 }), RangeError);
  assert.throws(() => generateBankCards({ length: 16.5 }), TypeError);
  assert.throws(() => generateBankCards({ bankCode: 'ICBC', cardType: 'PC' }),
    /表内没有符合条件的 BIN（bankCode=ICBC cardType=PC）/);
  assert.equal(generateBankCards(null).length, 1, '整个 options 传 null 等于没传');
});

test('E18 行别下拉与表自洽，且与生成物头部计数三方对账', () => {
  assert.equal(BANK_OPTIONS.length, BANKS.length);
  assert.equal(BANK_OPTIONS.length, 260);
  // `binCount` 之和 = 表体条目数，这句话单独看是恒等式（两边同源），所以拿生成器写在文件头的
  // 三个计数当第三方来对：`BIN_META` 目前没有任何消费者，不对账就等于白生成。
  const entries = BIN_ROWS.split(';');
  assert.equal(BIN_META.rows, entries.length, '生成物头部的 rows 与表体条目数脱节——生成器计数口径漂了');
  assert.equal(BANK_OPTIONS.reduce((n, b) => n + b.binCount, 0), BIN_META.rows);
  const byBin = new Map();
  for (const row of entries) {
    const [bin, , , len] = row.split(' ');
    if (!byBin.has(bin)) byBin.set(bin, []);
    byBin.get(bin).push(+len);
  }
  assert.equal(byBin.size, BIN_META.distinctBins, '头部 distinctBins 与实际不同 BIN 个数脱节');
  const dup = [...byBin.values()].filter((v) => v.length > 1);
  assert.equal(dup.length, BIN_META.ambiguousBins, '头部 ambiguousBins 与并列登记个数脱节');
  // 读侧 `primary` 从并列里挑"位数与实测一致"的那一条，靠的就是同一 BIN 的两条登记位数不同。
  assert.ok([...byBin.values()].every((v) => new Set(v).size === v.length),
    '出现了同 BIN 同位数的两条登记，primary 的挑法不再唯一');
  const codes = BANK_OPTIONS.map((b) => b.code);
  assert.deepEqual(codes, [...codes].sort(), '下拉顺序按行别码升序，不依赖 locale 折叠');
  assert.ok(BANK_OPTIONS.every((b) => b.binCount > 0 && b.name !== ''));
  assert.equal(TOP_BANKS.length, 20);
  assert.equal(TOP_BANKS[0].code, 'ICBC', '表内 BIN 最多的 90 条必须排在第一位');
  assert.ok(TOP_BANKS[0].binCount >= TOP_BANKS.at(-1).binCount);
  const tie = TOP_BANKS.filter((b) => b.binCount === TOP_BANKS.at(-1).binCount).map((b) => b.code);
  assert.deepEqual(tie, [...tie].sort(), '并列必须按行别码升序收口，否则顺序随引擎');
});

test('E19 文案边界：只说"参考"，不冒充权威也不越界', () => {
  assert.equal(Object.keys(CARD_TYPES).join(','), 'DC,CC,PC,SCC');
  const types = new Set(BIN_ROWS.split(';').map((r) => r.split(' ')[2]));
  assert.deepEqual([...types].sort(), Object.keys(CARD_TYPES).sort(),
    '快照里出现了 CARD_TYPES 之外的卡种类，码表与文案要一起补');
  assert.doesNotMatch(BANK_CAVEAT, /VISA|MASTERCARD|银联|JCB|卡组织/);
  assert.doesNotMatch(BIN_SOURCE, /银联|官方/);
  for (const n of ['6212601500012345', '4242424242424242', '9999999999999999']) {
    assert.equal(parseBankCard(n).caveat, BANK_CAVEAT, `${n}：每条结果自带同一句 caveat，面板不必再拼`);
  }
});

test('E20 批量入口：跳空行、行号是原行号', () => {
  const rows = parseBankCardList('6212601500012345\n\n4242424242424242\n乱码\n');
  assert.deepEqual(rows.map((r) => r.line), [1, 3, 4]);
  assert.deepEqual(rows.map((r) => r.result.state), ['valid', 'unlisted', 'malformed']);
  assert.equal(rows[0].raw, '6212601500012345');
  assert.deepEqual(parseBankCardList(''), []);
  assert.deepEqual(parseBankCardList(null), []);
});

/** 把表体解成行对象，顺序与 `ROWS` 一致——E21 要用它自己算一遍生成池，不能只信生成器 */
const BIN_TABLE = BIN_ROWS.split(';').map((row) => {
  const [bin, idx, cardType, len] = row.split(' ');
  return { bin, bankCode: BANKS[+idx][0], cardType, panLength: +len };
});
/** 表内比 `bin` 更长、又以它为前缀的登记行 */
const longerKids = (bin) => BIN_TABLE.filter((r) => r.bin.length > bin.length && r.bin.startsWith(bin));

test('E21 挨过挡的收窄条件逐个扫种子：不抛，且读回来的前缀就是声明的那个', () => {
  // 2026-09-27 复核发现：表里 9 条登记的号码会被**自家更长的登记前缀**盖住（E0-4 钉着这个形状），
  // 旧实现在那些分支上直接抛「内部不变量」。实测旧的构造方式：
  //   `generateBankCards({ bin: '9558', length: 19, rng: seededRandom(s) })`，s=1..3000 → 抛 148 轮（4.93%）
  //   `generateBankCards({ count: 50, rng: seededRandom(s) })`，s=1..3000 → 抛 26 轮（0.87%）
  // 这一格把"面板点一次生成不该看到内部错误"钉成判据，并且要求读侧结论与声明一致。
  for (const opts of [{ bin: '9558', length: 19 }, { bin: '622421', length: 19 },
    { bin: '621260' }, { bin: '621059', length: 16 }, { bankCode: 'ICBC', length: 19 },
    { bankCode: 'BHB', length: 19 }, { bankCode: 'JSBANK', length: 16 },
    { bankCode: 'BOSZ', length: 19 }, { count: 20 }]) {
    for (let s = 1; s <= 120; s += 1) {
      const list = generateBankCards({ ...opts, rng: seededRandom(s) });
      for (const item of list) {
        const back = parseBankCard(item.number);
        assert.equal(back.state, 'valid', `${JSON.stringify(opts)} seed=${s} → ${item.number} 自检 ${back.state}`);
        assert.equal(back.info.bin, item.bin, `${JSON.stringify(opts)} seed=${s} 读回 ${back.info.bin} ≠ 声明 ${item.bin}`);
        assert.equal(back.info.primary.bankCode, item.bankCode, `${JSON.stringify(opts)} seed=${s} 行别被换掉了`);
      }
    }
  }
  // 上面那串收窄是**手挑的**，扫 120 个种子也只保证"挑中的那几行没问题"。这一格把覆盖面换成
  // 从表里现算：9 条挨挡登记（E0-4 同一判据）各自把四条收窄凑齐，池子里每一档都要能被点中、
  // 生成出来、并且读回自己。实测 9 个键共 32 档（`621260/CSRCB/19` 一支就占 18 档）。
  const riskyKeys = [...new Set(BIN_TABLE.filter((r) => longerKids(r.bin).some((c) => c.bin.length <= r.panLength - 1))
    .map((r) => `${r.bankCode} ${r.cardType} ${r.bin} ${r.panLength}`))].sort();
  assert.equal(riskyKeys.length, 9, '挨挡登记的个数变了，下面的覆盖面判据要跟着重看');
  let slots = 0;
  for (const key of riskyKeys) {
    const [bankCode, cardType, bin, panLength] = key.split(' ');
    const pool = BIN_TABLE.filter((r) => r.bankCode === bankCode && r.cardType === cardType
      && r.bin.startsWith(bin) && r.panLength === +panLength);
    assert.ok(pool.some((r) => r.bin === bin), `${key}：自己都不在自己的池里，收窄口径不一致`);
    for (let i = 0; i < pool.length; i += 1) {
      const row = pool[i];
      // 恒定取值 `roll` 只负责点中池内第 i 档（`Math.floor(roll * pool.length) === i` 恒成立）。
      // 本体的取值是**敌意**的：按这条登记最长的那个子前缀的尾巴轮转，专门去补自家前缀。
      // 为什么必须敌意：2026-09-27 十六刀台账实测，取值恒定时 M8（摘掉避让）在这 32 档里
      // 一档都碰不出来——`9558` 那档恒定取 0.25 → 本体全 2，压根不撞 `95588`，E21 于是全绿，
      // 避让只剩 E22 一条在守。换成敌意取值后 M8 在 `622498` 这一档直接抛内部不变量。
      const roll = (i + 0.5) / pool.length;
      const kids = longerKids(row.bin).map((r) => r.bin)
        .filter((c) => c.length <= row.panLength).sort((a, b) => b.length - a.length);
      const tail = kids.length > 0
        ? [...kids[0].slice(row.bin.length)].map((d) => (Number(d) + 0.5) / 10) : [0.5];
      let n = 0;
      let draws = 0;
      const [card] = generateBankCards({ bankCode, cardType, bin, length: +panLength,
        rng: () => { const v = n === 0 ? roll : tail[(n - 1) % tail.length]; n += 1; draws += 1; return v; } });
      slots += 1;
      const back = parseBankCard(card.number);
      assert.equal(card.bin, row.bin, `${key} 池内第 ${i} 档选错行了`);
      assert.equal(back.state, 'valid', `${key} 第 ${i} 档 → ${card.number} 自检 ${back.state}`);
      assert.equal(back.info.bin, row.bin, `${key} 第 ${i} 档被读侧换成了 ${back.info.bin}`);
      // 取值次数 = 选池 1 次 + 本体每位 1 次；避让挪位不吃随机数，重取才会。
      // 敌意取值下"不避让"必然撞子前缀，所以这一格同时盯着避让与自检两条链。
      assert.equal(draws, card.panLength - card.bin.length,
        `${key} 第 ${i} 档取了 ${draws} 次，期望 ${card.panLength - card.bin.length} 次：多出来的次数只能来自重取`);
    }
  }
  assert.equal(slots, 32, '九个键的池子总档数变了（实测 18+5+2+2+1×5 = 32），上面那段覆盖面的形状要重看');
});

test('E22 避让是构造期发生的：定值 rng 下逐字符可复现', () => {
  // 前提先钉住：`{bin:'9558', length:19}` 的池子按表内顺序是 `9558`、`95588` 两档，
  // 第一位取 0 才落到 `9558`。这句从表里现算，不靠"我记得它是 pool[0]"——表序一变，
  // 这个前提比号本身先红，红的理由才说得清。
  const pool = BIN_TABLE.filter((r) => r.bin.startsWith('9558') && r.panLength === 19);
  assert.deepEqual(pool.map((r) => `${r.bin} ${r.bankCode} ${r.cardType} ${r.panLength}`),
    ['9558 ICBC DC 19', '95588 ICBC DC 19']);
  // 紧接一位 0.8 → 算得 8，正好把子前缀 `95588` 补满，于是顺位挪到 9。剩下的 13 位取 0，
  // 校验位由 Luhn 算出。摘掉避让这一格（M8）后第一次取号会撞 95588、被自检拦下重取，
  // 产出的号就不是这一条，这条断言随即红——红的理由是"号变了"而不是"抛了"，这比 E21 更尖。
  const script = (vals) => { let i = 0; const f = () => vals[i++ % vals.length]; f.calls = () => i; return f; };
  const vals = [0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const drawn = script(vals);
  const [card] = generateBankCards({ bin: '9558', length: 19, rng: drawn });
  const body = '955890000000000000';
  assert.equal(card.bin, '9558');
  assert.equal(card.bankCode, 'ICBC');
  assert.equal(card.number, body + luhnCheckDigit(body), '第五位没被挪开，或挪开之后又走了别的分支');
  assert.equal(card.number.slice(4, 5), '9', '本体第五位本该由 0.8 算成 8（撞上 95588），避让要把它挪成 9');
  assert.equal(parseBankCard(card.number).info.bin, '9558');
  assert.equal(drawn.calls(), vals.length, '取值次数超过序列长度，说明中途重取过（避让没生效）');
  // 同一串取值再来一次，必须一字不差（避让不吃额外随机数，所以序列长度是确定的 15 次）
  const again = script(vals.slice());
  assert.deepEqual(generateBankCards({ bin: '9558', length: 19, rng: again })[0], card);
});

test('E23 三张派生表是只读的：谁都改不动共享行，第二次查询不受第一次影响', () => {
  // `lookupBin` 把 `BY_BIN` 里那个数组原样交出去（每查一次号都要省这一份拷贝），
  // `info.primary` 也是表内的行对象本身。不冻结的话，面板或调用方改一次就把生成池和之后
  // 所有查询一起改脏，且**不会有任何报错**。解冻其中任一处，这一格立刻红。
  const hit = lookupBin('6212601500012345');
  assert.equal(hit.rows.length, 2);
  assert.throws(() => { hit.rows.push({ bin: 'INJECT' }); }, TypeError);
  assert.equal(lookupBin('6212601500012345').rows.length, 2, '上一次的 push 渗到了这一次');
  const first = parseBankCard('6212601500012345');
  assert.throws(() => { first.info.primary.panLength = 999; }, TypeError);
  assert.equal(parseBankCard('6212601500012345').matches.map((m) => m.panLength).join(','), '16,19');
  assert.throws(() => { first.info.primary.bankCode = 'HACK'; }, TypeError);
  // `matches` 与 `triedLengths` 是**每次调用现生成**的，正相反：改它们只影响调用方自己那一份，
  // 所以不许抛，但必须证明改动漏不出去。两条路径各拿一份：命中时 `triedLengths` 来自
  // `lookupBin` 内部攒的 `tried`，未收录时来自 `tryableLengths` 现算，两边都得是新鲜的。
  const copy = parseBankCard('6212601500012345');
  copy.matches[0].panLength = 999;
  copy.info.triedLengths.push(99);
  const after = parseBankCard('6212601500012345');
  assert.equal(after.matches[0].panLength, 16, 'matches 原来是共享行，改一份就串了');
  assert.deepEqual(after.info.triedLengths, [10, 9, 8, 7, 6]);
  const miss = parseBankCard('4242424242424242');
  miss.info.triedLengths.push(99);
  assert.deepEqual(parseBankCard('4242424242424242').info.triedLengths, [10, 9, 8, 7, 6, 5, 4, 3]);
  // 生成侧同样读的是这些行：把整张表换掉要还能生成并自检通过
  assert.equal(generateBankCards({ bin: '9558', length: 19, rng: seededRandom(7) })[0].bankCode, 'ICBC');
});

// ── §F 手机号 ──────────────────────────────────────────────────────────────
//（CARRIER_SEGMENTS 由 Task 1 的 §F0 那行声明，这里只补 CARRIER_META——同一个模块里同名
//  const 声明两次是 SyntaxError，而 §F 的 LISTED 与 F1/F8 都靠那一份表作证。）
const { CARRIER_META } = await import('../dev/js/tools/carrier-data.js');
const { CARRIERS, CARRIER_NOTE, CARRIER_SOURCE, GENERATE_MAX: MOBILE_GENERATE_MAX,
  MOBILE_CAVEAT, MOBILE_LENGTH, MOBILE_RE, formatMobile, generateMobiles,
  lookupCarrier, parseMobile } = await import('../dev/js/tools/phone.js');

// §F0 已把号段表钉成"5 家 / 56 段 / 不重叠 / 形状合法"，§F 因此只断 phone.js 这一层的
// 行为与派生：不重复判数据，也不断任何外部正确性（单一来源，见 CARRIER_NOTE 与计划 §0.4）。
const mck = (r) => Object.fromEntries(r.checks.map((c) => [c.key, c.ok]));
const mrow = (r, key) => r.checks.find((c) => c.key === key);
/** 三位段 + 补零到十一位（尾数随便填，§F 只关心前缀那一档） */
const pad11 = (s) => (s + '0000000000').slice(0, 11);
/** `1[3-9]\d` 的全部 70 个三位组合——表内 56 段与表外补集都由它派生，不写死号段 */
/** 表内号段清单：唯一权威是 §F0 那张 CARRIER_SEGMENTS，这里从它派生，
 *  不引 phone.js 的同名派生值——判据要能看出"读侧自己数出来的段"和"表里的段"不一致。 */
const LISTED = [];
for (const [, segsText] of CARRIER_SEGMENTS) LISTED.push(...segsText.split(' '));
const ALL70 = [];
for (let a = 3; a <= 9; a += 1) for (let b = 0; b <= 9; b += 1) ALL70.push(`1${a}${b}`);

test('F1 合法手机号判 valid，运营商按表内口径给出', () => {
  const r = parseMobile('13800138000');
  assert.equal(r.state, 'valid');
  assert.equal(r.carrier, '中国移动');
  assert.equal(r.segment, '138');
  assert.deepEqual(Object.values(mck(r)), [true, true, true, true]);
  assert.equal(r.checks.length, 4);
  assert.equal(r.info.formatted, '138 0013 8000');
  assert.equal(r.hasCaveat, true);
  // 每家都取一条：五家在表里各挂 ≥1 段，取各自第一个号段
  for (const [carrier, segsText] of CARRIER_SEGMENTS) {
    const first = segsText.split(' ')[0];
    const one = parseMobile(pad11(first));
    assert.equal(one.state, 'valid', `${carrier} 的 ${first}`);
    assert.equal(one.carrier, carrier, `${carrier} 的 ${first} 读成了 ${one.carrier}`);
  }
});

test('F2 书写变体归一到同一结论，并在逐项表点名', () => {
  const forms = ['138 0013 8000', '138-0013-8000', '138　0013　8000',
    '(138)0013 8000', '+86 13800138000', '008613800138000', '8613800138000',
    '  13800138000  ', '138-0013-8000'.replace(/-/g, '\u00A0')];
  for (const form of forms) {
    const r = parseMobile(form);
    assert.equal(r.digits, '13800138000', form);
    assert.equal(r.state, 'valid', form);
    assert.equal(r.value, form.trim(), 'value 必须是 trim 后的原样回显');
  }
  assert.equal(parseMobile('+86 13800138000').normalized, '去掉了国际前缀 +86');
  assert.match(mrow(parseMobile('+86 13800138000'), 'charset').detail, /去掉了国际前缀 \+86/);
  assert.equal(parseMobile('13800138000').normalized, '', '没剥东西就不许凭空点名');
});

test('F3 国际前缀只在该剥的时候剥', () => {
  // `+86` 后头不是 `1[3-9]`：不剥，于是 `+` 留在数字里被字符行点名——不猜用户想输入什么
  const odd = parseMobile('+8623800138000');
  assert.equal(odd.digits, '+8623800138000');
  assert.equal(odd.state, 'malformed');
  assert.equal(mck(odd).charset, false);
  assert.match(mrow(odd, 'charset').detail, /含非数字字符「\+」/);
  // 裸 `86` 只在"整串 13 位"时才当国家码；14 位那种一律不剥，免得把真号剪成合法号
  assert.equal(parseMobile('86138001380000').state, 'malformed');
  assert.equal(parseMobile('86138001380000').normalized, '');
  assert.equal(parseMobile('86038001380').normalized, '');
  assert.equal(parseMobile('86038001380').state, 'malformed');
});

test('F4 位数不合规只给前两行、info 为 null', () => {
  for (const short of ['1380013800', '1', '', '138 0013 800']) {
    const r = parseMobile(short);
    if (short === '') continue;
    assert.equal(r.state, 'malformed', short);
    assert.equal(r.checks.length, 2, short);
    assert.equal(r.info, null, short);
    assert.equal(r.checks[1].ok, false, short);
    assert.match(r.checks[1].detail, /应为 11 位/, short);
  }
  const long = parseMobile('138001380000');
  assert.equal(long.state, 'malformed');
  assert.equal(long.checks.length, 2);
  assert.equal(long.info, null);
  assert.equal(MOBILE_LENGTH, 11);
});

test('F5 含非数字字符时点名第几位', () => {
  const r = parseMobile('13800138o00');
  assert.equal(r.state, 'malformed');
  assert.equal(mck(r).charset, false);
  assert.match(mrow(r, 'charset').detail, /第 9 位/);
  assert.equal(r.checks.length, 2);
  assert.equal(r.info, null);
});

test('F6 开头不是 1[3-9]：malformed，但四行照给、运营商收空', () => {
  const r = parseMobile('12800138000');
  assert.equal(r.state, 'malformed');
  assert.equal(r.checks.length, 4, '位数过了就是解出了十一位结构，四行都要在');
  assert.equal(mck(r).segment, false);
  assert.equal(mck(r).carrier, null, '在假号段旁边挂一个"未收录"等于凭空造结论');
  assert.equal(r.carrier, '');
  assert.equal(r.segment, '128');
  assert.ok(r.info !== null);
  assert.equal(r.info.carrier, '');
  assert.equal(r.hasCaveat, true);
  assert.match(mrow(r, 'segment').detail, /不是移动号段开头/);
  assert.equal(mrow(r, 'carrier').detail, '号段不成立，不判运营商');
});

test('F7 号段合法但表里没这一格 → unlisted，不据此判无效', () => {
  const inTable = new Set(LISTED);
  const missing = ALL70.filter((s) => !inTable.has(s));
  assert.equal(missing.length, ALL70.length - inTable.size, '表内段与补集必须互补');
  assert.ok(missing.length > 0, '号段表若一次覆盖 70 档，这一格就该改成"无未收录样本"');
  for (const s of missing) {
    const r = parseMobile(pad11(s));
    assert.equal(r.state, 'unlisted', s);
    assert.equal(mck(r).segment, true, s);
    assert.equal(mck(r).carrier, null, s);
    assert.match(mrow(r, 'carrier').detail, /不据此判无效/, s);
    assert.equal(r.carrier, '', s);
    assert.equal(r.checks.filter((c) => c.ok === false).length, 0, `${s} 不许出现硬红`);
  }
});
test('F8 表内 56 段逐段覆盖：都能判 valid 且运营商与表一致', () => {
  const listed = LISTED;
  assert.equal(listed.length, CARRIERS.reduce((n, c) => n + c.count, 0));
  for (const s of listed) {
    const r = parseMobile(pad11(s));
    assert.equal(r.state, 'valid', s);
    assert.equal(r.segment, s);
    const owner = CARRIER_SEGMENTS.find(([, t]) => t.split(' ').includes(s))[0];
    assert.equal(r.carrier, owner, s);
  }
  assert.equal(CARRIERS.length, 5);
});

test('F9 MOBILE_RE 与 parseMobile 的硬结论同口径', () => {
  for (const s of ALL70) {
    assert.equal(MOBILE_RE.test(pad11(s)), parseMobile(pad11(s)).state !== 'malformed', s,
      '正则说合法而 parseMobile 判 malformed（或反之）就是两套格式口径');
  }
  assert.equal(MOBILE_RE.test('1380013800'), false, '少一位');
  assert.equal(MOBILE_RE.test('12800138000'), false, '开头 12');
  assert.equal(MOBILE_RE.test('13800138000X'), false);
  assert.equal(parseMobile(13800138000).state, 'valid', '11 位在 2^53 内，数值入参不掉末位');
  assert.equal(parseMobile(13800138000).digits, '13800138000');
});

test('F10 formatMobile 只认十一位纯数字', () => {
  assert.equal(formatMobile('13800138000'), '138 0013 8000');
  assert.equal(formatMobile('1380013800'), '1380013800', '形状不对就原样返回，不猜');
  assert.equal(formatMobile('1380013800a'), '1380013800a');
  assert.equal(formatMobile(null), '');
  assert.equal(formatMobile(13800138000), '', '数值不进格式化：String() 的口径归 parseMobile，这里不各做一遍');
});

test('F11 lookupCarrier 的形状闸门与返回形状', () => {
  assert.deepEqual(lookupCarrier('13800138000'), { segment: '138', carrier: '中国移动' });
  assert.deepEqual(lookupCarrier('19000138000'), { segment: '190', carrier: '中国电信' });
  assert.deepEqual(lookupCarrier('14000138000'), { segment: '140', carrier: null });
  assert.deepEqual(lookupCarrier('13'), { segment: '13', carrier: null }, '不足三位也有 segment，供面板说"坏在哪一段"');
  assert.equal(lookupCarrier('1380013800a'), null, '含非数字一律 null');
  assert.equal(lookupCarrier(null), null);
  assert.equal(lookupCarrier(13800138000), null, '不替调用方做 String()');
});

test('F12 生成侧自洽：50 条全判 valid 且号段就是表内段', () => {
  const list = generateMobiles({ count: MOBILE_GENERATE_MAX });
  assert.equal(list.length, MOBILE_GENERATE_MAX);
  assert.equal(MOBILE_GENERATE_MAX, 50);
  for (const item of list) {
    const back = parseMobile(item.number);
    assert.equal(back.state, 'valid', item.number);
    assert.equal(back.segment, item.segment);
    assert.equal(back.carrier, item.carrier);
    assert.equal(item.formatted, formatMobile(item.number));
    assert.ok(LISTED.includes(item.segment), `${item.segment} 不在表内`);
    assert.equal(item.note, CARRIER_NOTE);
    assert.equal(item.caveat, MOBILE_CAVEAT);
  }
  const seeded = () => {
    const s = generateMobiles({ count: 5, rng: () => 0.42 });
    return s.map((x) => x.number).join(',');
  };
  assert.equal(seeded(), seeded(), '同一个 rng 必须给同一批号');
  assert.equal(generateMobiles().length, 1, '不传参就是 1 条');
});

test('F13 生成侧收窄：carrier 与 segment，两者冲突时报归属', () => {
  const telecom = generateMobiles({ count: 20, carrier: '中国电信' });
  assert.equal(telecom.length, 20);
  for (const item of telecom) assert.equal(item.carrier, '中国电信', item.number);
  const guangdian = generateMobiles({ count: 4, segment: '192' });
  for (const item of guangdian) {
    assert.equal(item.segment, '192');
    assert.equal(item.carrier, '中国广电');
  }
  assert.throws(() => generateMobiles({ carrier: '中国移动', segment: '192' }),
    (e) => e instanceof RangeError && /号段 192 不属于 中国移动（表内它归 中国广电）/.test(e.message));
});

test('F14 生成侧入参闸门', () => {
  const bad = (options, Kind, re) => assert.throws(() => generateMobiles(options),
    (e) => e instanceof Kind && re.test(e.message), JSON.stringify(options));
  bad({ count: 0 }, RangeError, /count 应为 1\.\.50/);
  bad({ count: MOBILE_GENERATE_MAX + 1 }, RangeError, /count 应为 1\.\.50/);
  bad({ count: 2.5 }, RangeError, /count/);
  bad({ count: '5' }, RangeError, /count 应为 1\.\.50 的整数，收到 string 5/);
  bad({ carrier: '中国移动通讯' }, RangeError, /carrier（中国移动通讯）不在表内 5 家/);
  bad({ carrier: 123 }, TypeError, /carrier 应为非空字符串，收到 number 123/);
  bad({ carrier: '  ' }, TypeError, /carrier 应为非空字符串/);
  bad({ segment: '128' }, RangeError, /segment（128）不在表内 56 个号段里/);
  bad({ segment: '13' }, TypeError, /segment 应为匹配 \/\^\\d\{3\}\$/);
  bad({ segment: 'abc' }, TypeError, /segment/);
  bad({ rng: 1 }, TypeError, /rng 应为 \(\) => number，收到 number 1/);
  bad({ rng: () => 1 }, TypeError, /rng 每次应给出 \[0, 1\) 内的有限数，收到 number 1/);
  bad({ rng: () => Number.NaN }, TypeError, /收到 number NaN/);
  assert.equal(generateMobiles({ carrier: null, segment: undefined }).length, 1,
    'null / undefined 等于没给收窄条件，不抛');
});

test('F15 文案边界：单一来源、三位号段、不做归属地三句都在', () => {
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.provider.replace('/', '\\/')));
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.ref.slice(0, 7)));
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.fetchedAt));
  assert.match(MOBILE_CAVEAT, /格式判定.*硬结论/);
  assert.match(MOBILE_CAVEAT, /运营商按三位号段判定/);
  assert.match(CARRIER_NOTE, /单一来源/);
  assert.match(CARRIER_NOTE, /携号转网/);
  assert.match(CARRIER_NOTE, /不做号码归属地/);
  assert.match(CARRIER_NOTE, /三位号段/);
  assert.ok(CARRIER_NOTE.includes(CARRIER_SOURCE), '面板里那句必须带上来源与快照日期');
  for (const r of [parseMobile('13800138000'), parseMobile('14000138000'),
    parseMobile('12800138000'), parseMobile('1380013800')]) {
    assert.equal(r.note, CARRIER_NOTE);
    assert.equal(r.caveat, MOBILE_CAVEAT);
  }
  assert.equal(parseMobile('13800138000').hasCaveat, true);
  assert.equal(parseMobile('1380013800').hasCaveat, false, '位数没过就没有"参考"可提示');
  assert.equal(parseMobile('').state, 'empty');
  assert.deepEqual(parseMobile('').checks, []);
  assert.equal(parseMobile(null).state, 'empty');
  assert.equal(parseMobile(undefined).state, 'empty');
});

// ── §G 随机合成数据 ────────────────────────────────────────────────────────
//（`seededRandom` / `currentCountyCodes` / `resolveRegion` / `USE_NOTE` 与身份证那个 `GENERATE_MAX`
//  都已在 §B、§C 顶层解构过，同名 const 再声明一次是 SyntaxError；本节只新引 random-data.js，
//  上限那个键别名成 RAND_GENERATE_MAX，好与身份证那一档比"上限同档"。）
const {  ADDRESS_NOTE, EMAIL_DOMAINS, EMAIL_NOTE, EMAIL_RE, EMAIL_WORDS, GIVEN_CHARS, NAME_NOTE,
  RANDOM_CAVEAT, STREET_SUFFIXES, STREET_WORDS, SURNAMES,
  GENERATE_MAX: RAND_GENERATE_MAX,
  generateAddresses, generateEmails, generateNames, generateProfiles,
} = await import('../dev/js/tools/random-data.js');

const dupes = (arr) => arr.filter((v, i) => arr.indexOf(v) !== i);
const CJK1 = /^[㐀-鿿]$/;
const gNames = (seed) => generateNames({ count: 30, rng: seededRandom(seed) });
const gAddr = seed => generateAddresses({ count: 30, rng: seededRandom(seed) });
const gMails = seed => generateEmails({ count: 30, rng: seededRandom(seed) });

test('G1 词表自洽：五张字表各自无重复、形状合法、规模不缩水', () => {
  for (const [who, arr] of [['SURNAMES', SURNAMES], ['GIVEN_CHARS', GIVEN_CHARS],
    ['STREET_WORDS', STREET_WORDS], ['STREET_SUFFIXES', STREET_SUFFIXES], ['EMAIL_WORDS', EMAIL_WORDS]]) {
    assert.deepEqual(dupes(arr), [], `${who} 表内有重复`);
    assert.ok(Array.isArray(arr) && arr.length > 0, `${who} 是空表`);
  }
  assert.ok(SURNAMES.every((s) => CJK1.test(s)), '姓氏表混进了非单字汉字');
  assert.ok(GIVEN_CHARS.every((c) => CJK1.test(c)), '字表混进了非单字汉字');
  assert.ok(STREET_WORDS.every((w) => /^[㐀-鿿]{2}$/.test(w)), '街道词不是两个汉字');
  assert.ok(STREET_SUFFIXES.every((s) => /^[㐀-鿿]{1,2}$/.test(s)), '街道后缀不是一到两个汉字');
  assert.ok(EMAIL_WORDS.every((w) => /^[a-z]{2,14}$/.test(w)), '邮箱词根不是纯小写字母');
  // 规模下限：表被误删一截时"高频"这句就该红，而不是安静地少一批候选
  assert.ok(SURNAMES.length >= 90, `姓氏表只剩 ${SURNAMES.length} 字`);
  assert.ok(GIVEN_CHARS.length >= 110, `字表只剩 ${GIVEN_CHARS.length} 字`);
  assert.ok(STREET_WORDS.length >= 20, `街道词只剩 ${STREET_WORDS.length} 条`);
  assert.ok(EMAIL_WORDS.length >= 20, `邮箱词根只剩 ${EMAIL_WORDS.length} 条`);
});

test('G2 EMAIL_RE 是从 EMAIL_DOMAINS 拼出来的，且点号是真点号', () => {
  assert.deepEqual(EMAIL_DOMAINS, ['example.com', 'example.net', 'example.org']);
  for (const d of EMAIL_DOMAINS) assert.ok(EMAIL_RE.test(`pear21@${d}`), `${d} 过不了自家正则`);
  assert.equal(EMAIL_RE.test('pear21@example.info'), false, '非保留域不得通过');
  assert.equal(EMAIL_RE.test('pear21@example!com'), false, '点号没转义：example!com 蒙混过关');
  assert.equal(EMAIL_RE.test('pear21@examplecom'), false, '点号没转义：少了点也过关');
  assert.equal(EMAIL_RE.test('Pear21@example.com'), false, '大写不得通过');
  assert.equal(EMAIL_RE.test('pear2@example.com'), false, '1 位数字不得通过');
  assert.equal(EMAIL_RE.test('pear2111@example.com'), true, '4 位数字该过');
  assert.equal(EMAIL_RE.test('pear21111@example.com'), false, '5 位数字不得通过');
  assert.equal(EMAIL_RE.test('.pear21@example.com'), false, 'local 以点开头不得通过');
  assert.equal(EMAIL_RE.test('pe.rr21@example.com'), true, '两段式词根该过');
  assert.equal(EMAIL_RE.test('p.ar21@example.com'), false, '词根短于 2 个字母不得通过');
  assert.equal(EMAIL_RE.test('pear.21@example.com'), false, '点号后面接数字不得通过');
});

test('G3 generateNames 每条都是「表内姓 + 表内字」，字段齐', () => {
  const list = gNames(7);
  assert.equal(list.length, 30);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['given', 'givenLength', 'name', 'surname']);
    assert.ok(SURNAMES.includes(it.surname), `${it.name} 的姓不在表内`);
    assert.ok([1, 2].includes(it.givenLength), `${it.name} 的名不是 1–2 字`);
    assert.equal(it.name, it.surname + it.given);
    assert.equal(it.given.length, it.givenLength);
    assert.ok(it.given.split('').every((c) => GIVEN_CHARS.includes(c)), `${it.name} 的字不在表内`);
  }
});

test('G4 givenLength：1 / 2 各钉死一档，不传则两档都有，null 等于没传', () => {
  assert.ok(generateNames({ count: 10, givenLength: 1, rng: seededRandom(3) })
    .every((i) => i.givenLength === 1 && i.given.length === 1));
  assert.ok(generateNames({ count: 10, givenLength: 2, rng: seededRandom(3) })
    .every((i) => i.givenLength === 2 && i.given.length === 2 && i.name.length === 3));
  const dflt = generateNames({ count: 40, rng: seededRandom(11) });
  assert.deepEqual([...new Set(dflt.map((i) => i.givenLength))].sort(), [1, 2],
    '默认档位只出一头，"1–2 字"那句是假的');
  assert.deepEqual(generateNames({ count: 40, givenLength: null, rng: seededRandom(11) }), dflt,
    'givenLength: null 应当等于没传（含取值次数一致）');
  for (const bad of [3, 0, '1', 1.5, true]) {
    assert.throws(() => generateNames({ givenLength: bad }), TypeError, `givenLength ${String(bad)} 该抛`);
  }
});

test('G5 批内不重复：正常随机源不撞重，恒定源必须当场抛而不是凑重复条', () => {
  for (const [who, list] of [['姓名', gNames(5)], ['邮箱', gMails(5)], ['地址', gAddr(5)]]) {
    const key = who === '姓名' ? 'name' : who === '邮箱' ? 'email' : 'text';
    const keys = list.map((i) => i[key]);
    assert.equal(new Set(keys).size, 30, `${who}批内出现了重复`);
  }
  // 这一档才是判重真正的牙：恒定 rng 把组合空间压成 1 格，
  // 摘掉 uniqueBatch 的判重就会安静返回 30 条一模一样的结果、一条都不红。
  for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
    ['generateAddresses', generateAddresses]]) {
    assert.throws(() => fn({ count: 5, rng: () => 0.5 }),
      (e) => e instanceof RangeError && /只凑到 1 条/.test(e.message) && /不重复/.test(e.message),
      `${who} 的批内判重没有牙`);
  }
});

test('G6 count 闸门：1..50 之外一律 RangeError，上限与身份证 / 银行卡 / 手机号同一档', () => {
  assert.equal(RAND_GENERATE_MAX, 50);
  assert.equal(RAND_GENERATE_MAX, GENERATE_MAX, '随机数据与身份证的条数上限不同档');
  // 四个生成器共用 1..50 这一档，是靠**这四个常量相等**钉住的，不是靠注释里那句"同一档"。
  // 只比身份证一格的话，银行卡或手机号哪天改成 20，这边的主张就只剩字面好看了。
  assert.equal(RAND_GENERATE_MAX, BANK_GENERATE_MAX, '随机数据与银行卡的条数上限不同档');
  assert.equal(RAND_GENERATE_MAX, MOBILE_GENERATE_MAX, '随机数据与手机号的条数上限不同档');
  for (const bad of [0, -1, 51, 100, '5', 1.5, NaN, null, true]) {
    for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
      ['generateAddresses', generateAddresses], ['generateProfiles', generateProfiles]]) {
      assert.throws(() => fn({ count: bad }),
        (e) => e instanceof RangeError && e.message.includes(who) && /1\.\.50 的整数/.test(e.message),
        `${who} 的 count ${String(bad)} 没按口径抛`);
    }
  }
  assert.equal(generateNames().length, 1, '不传 count 应给 1 条');
  assert.equal(generateNames(null).length, 1, '整个 options 传 null 应等于没传');
  assert.equal(generateNames(undefined).length, 1);
});

test('G7 rng 闸门：非函数抛、越界的取值抛、null 当没传，两句话各点一次名', () => {
  for (const bad of ['nope', 1, {}, []]) {
    assert.throws(() => generateNames({ rng: bad }),
      (e) => e instanceof TypeError && /options\.rng 应为 \(\) => number/.test(e.message));
  }
  for (const bad of [1, -0.1, NaN, Infinity, '0.5']) {
    assert.throws(() => generateNames({ rng: () => bad }),
      (e) => e instanceof TypeError && /每次应给出 \[0, 1\) 内的有限数/.test(e.message),
      `rng 返回 ${String(bad)} 没被拦`);
  }
  // `rng: null` 走的是"没传"那一支（时间播种），不在这两道闸里：把它当坏值抛，就和
  // `generateIdCards` / `generateBankCards` 的 null 语义不一致；把它当函数，就是漏了守卫。
  for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
    ['generateAddresses', generateAddresses], ['generateProfiles', generateProfiles]]) {
    assert.equal(fn({ count: 3, rng: null }).length, 3, `${who} 的 rng:null 没按"没传"处理`);
  }
});

test('G8 地址只出现行县级码，整串以区划全名开头', () => {
  const current = new Set(currentCountyCodes());
  const list = gAddr(9);
  assert.equal(list.length, 30);
  // 不收窄时一批 2,978 个县码里抽 30 条，全落在同一个县的概率是 10^-88 量级——
  // 这一句是给"`pick` 被换成 `pool[0]`"这一类静默退化留的牙，不是给随机性留的。
  assert.ok(new Set(list.map((i) => i.areaCode)).size > 1, '不收窄的 30 条地址全落在同一个县');
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(),
      ['areaCode', 'city', 'county', 'fullName', 'house', 'province', 'street', 'text']);
    assert.ok(current.has(it.areaCode), `${it.areaCode} 不在现行县码表里`);
    const r = resolveRegion(it.areaCode);
    assert.equal(r.status, 'current');
    assert.equal(r.level, 'county');
    assert.equal(it.fullName, r.fullName);
    assert.ok(it.text.startsWith(it.fullName), `${it.text} 不是以全名开头`);
    assert.ok(it.text.includes(it.county), `${it.text} 里没有县名`);
    assert.ok(it.text.includes(it.province), `${it.text} 里没有省名`);
    assert.match(it.street, new RegExp(`^(${STREET_WORDS.join('|')})(${STREET_SUFFIXES.join('|')})$`));
    assert.match(it.house, /^([1-9]|[1-9][0-9]|1[0-9]{2}|200)号$/);
    assert.equal(it.text, `${it.fullName}${it.street}${it.house}`);
  }
});

test('G9 区划收窄三键各按自己的长度生效，优先级 areaCode > cityCode > provinceCode', () => {
  for (const it of generateAddresses({ count: 20, provinceCode: '11', rng: seededRandom(1) })) {
    assert.ok(it.areaCode.startsWith('11'), `省码收窄漏了 ${it.areaCode}`);
    assert.equal(it.province, '北京市');
  }
  for (const it of generateAddresses({ count: 20, cityCode: '1101', rng: seededRandom(1) })) {
    assert.ok(it.areaCode.startsWith('1101'), `市码收窄漏了 ${it.areaCode}`);
  }
  const one = generateAddresses({ count: 5, areaCode: '110101', rng: seededRandom(1) });
  assert.equal(one.length, 5);
  assert.ok(one.every((i) => i.areaCode === '110101'), '县码收窄后还出了别的县');
  // 三键同时给：只认优先级最高的那一个，不取交集也不报错
  const mixed = generateAddresses({ count: 5, areaCode: '110101', cityCode: '3301',
    provinceCode: '44', rng: seededRandom(1) });
  assert.ok(mixed.every((i) => i.areaCode === '110101'), '三键优先级没按 areaCode 生效');
  // 前后空白裁掉再收窄
  assert.ok(generateAddresses({ count: 3, provinceCode: ' 32 ', rng: seededRandom(1) })
    .every((i) => i.areaCode.startsWith('32')));
});

test('G10 区划键的形状闸门：数值与 null 与空串都抛，挑不出县码的前缀 RangeError', () => {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    for (const bad of [110101, 11, null, '', '   ', true, {}]) {
      assert.throws(() => generateAddresses({ [key]: bad }),
        (e) => e instanceof TypeError && e.message.includes(`options.${key}`)
          && /非空字符串/.test(e.message),
        `${key}: ${JSON.stringify(bad)} 没被拦`);
    }
  }
  for (const bad of ['999999', '99', '1101010', 'abc']) {
    assert.throws(() => generateAddresses({ areaCode: bad }),
      (e) => e instanceof RangeError && /没有前缀/.test(e.message) && e.message.includes(bad),
      `前缀 ${bad} 该报挑不出县码`);
  }
  assert.throws(() => generateAddresses({ areaCode: '3712' }), RangeError, '莱芜（历史市码）不得当候选前缀用');
});

test('G11 邮箱形状与保留域：每条过自家正则，domain 只认那三个', () => {
  const list = gMails(13);
  assert.equal(list.length, 30);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['domain', 'email', 'local']);
    assert.ok(EMAIL_RE.test(it.email), `${it.email} 过不了自家正则`);
    assert.equal(it.email, `${it.local}@${it.domain}`);
    assert.ok(EMAIL_DOMAINS.includes(it.domain), `${it.domain} 不是保留域`);
    assert.match(it.local, /^[a-z.]+\d{2,4}$/);
    assert.ok(it.local.length <= 32);
    const [stem] = it.local.split(/\d/);
    assert.ok(stem.split('.').every((w) => EMAIL_WORDS.includes(w)), `${it.local} 的词根不在表内`);
  }
  const net = generateEmails({ count: 10, domain: ' EXAMPLE.NET ', rng: seededRandom(2) });
  assert.ok(net.every((i) => i.domain === 'example.net'), 'domain 没 trim + 小写');
  assert.ok(net.every((i) => i.email.endsWith('@example.net')));
  assert.throws(() => generateEmails({ domain: 'gmail.com' }),
    (e) => e instanceof RangeError && /不在保留域/.test(e.message) && e.message.includes('gmail.com'));
  // `null` 与 `undefined` 一样算"没传"（与 `idcard.js` 的 minAge / sex 同一族口径）：
  // 这一键的默认值本身就是安全的（三个保留域里挑），不像区划键那样"没传＝放开整张表"。
  assert.deepEqual(generateEmails({ count: 10, domain: null, rng: seededRandom(2) }),
    generateEmails({ count: 10, rng: seededRandom(2) }), 'domain:null 应当等于没传');
  for (const bad of [1, '', '   ', true, {}]) {
    assert.throws(() => generateEmails({ domain: bad }),
      (e) => e instanceof TypeError && /options\.domain 应为非空字符串/.test(e.message),
      `domain ${JSON.stringify(bad)} 没被拦`);
  }
  assert.ok(gMails(17).some((i) => i.local.includes('.')), '两段式词根一次都没出现过');
  // 前导零这一条直接断两次：一次断自家正则收得下，一次断生成器真会给出来。
  // 报错文案里那笔"数字尾巴 10²+10³+10⁴ = 11100 格"的账全靠第一句成立——哪天尾巴改成
  // `[1-9]\d{1,3}`，空间就缩回 9990，而组合空间的口径只在"凑不满"那句报错里露面，没人会发现。
  assert.ok(EMAIL_RE.test('harvest0054@example.com'),
    '前导零尾巴被自家正则判死，11100 的空间算式随之作废');
  const tails = [7, 11, 13, 17, 19, 23, 29, 31].flatMap((s) => gMails(s).map((i) => i.local));
  assert.equal(tails.length, 240);
  assert.ok(tails.some((t) => t.match(/\d+$/)[0].startsWith('0')),
    '240 条尾巴里没有一条前导零：逐位取 0..9 不该这么偏（实测占一成）');
});

test('G12 generateProfiles：三类同批、形状与单类逐字段一致、且不挂身份证号', () => {
  const list = generateProfiles({ count: 10, provinceCode: '32', domain: 'example.org',
    givenLength: 2, rng: seededRandom(21) });
  assert.equal(list.length, 10);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['address', 'email', 'name'],
      '三元组多出了别的格——§5.1 只点三类，身份证号是刻意不挂的');
    assert.deepEqual(Object.keys(it.name).sort(), ['given', 'givenLength', 'name', 'surname']);
    assert.deepEqual(Object.keys(it.address).sort(),
      ['areaCode', 'city', 'county', 'fullName', 'house', 'province', 'street', 'text']);
    assert.deepEqual(Object.keys(it.email).sort(), ['domain', 'email', 'local']);
    assert.equal(it.name.givenLength, 2);
    assert.ok(it.address.areaCode.startsWith('32'));
    assert.equal(it.email.domain, 'example.org');
    assert.ok(EMAIL_RE.test(it.email.email));
  }
  assert.equal(new Set(list.map((i) => i.name.name)).size, 10, '三元组里的姓名撞了');
  assert.equal(new Set(list.map((i) => i.address.text)).size, 10, '三元组里的地址撞了');
  assert.equal(new Set(list.map((i) => i.email.email)).size, 10, '三元组里的邮箱撞了');
  assert.throws(() => generateProfiles({ count: 5, areaCode: 110101 }), TypeError,
    'generateProfiles 没把区划键的闸门透给内层');
});

test('G13 四条对外口径：§5.5 原文逐字一致，各自的边界句都在', () => {
  assert.equal(RANDOM_CAVEAT,
    '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。');
  assert.equal(RANDOM_CAVEAT, USE_NOTE, '随机数据的生成提示与身份证面板那句漂移了（§5.5 只有一句）');
  assert.ok(NAME_NOTE.includes('不指向任何真实个人'), '§5.1 那句"明写"没落地');
  assert.ok(NAME_NOTE.includes('自造'), '姓名口径没说明词表来源');
  assert.ok(ADDRESS_NOTE.includes('现行') && ADDRESS_NOTE.includes('不指向真实门牌'));
  assert.ok(EMAIL_NOTE.includes('example.com') && EMAIL_NOTE.includes('RFC 2606'));
  assert.ok(!EMAIL_NOTE.includes('@'), '邮箱口径里不得出现可直接投递的地址');
  for (const [who, s] of [['RANDOM_CAVEAT', RANDOM_CAVEAT], ['NAME_NOTE', NAME_NOTE],
    ['ADDRESS_NOTE', ADDRESS_NOTE], ['EMAIL_NOTE', EMAIL_NOTE]]) {
    assert.ok(typeof s === 'string' && s.length > 10 && !s.includes('<') && !s.includes('&lt;'),
      `${who} 形状不对`);
  }
});

test('G14 同种子必同输出，换种子就该换输出', () => {
  assert.deepEqual(gNames(31), gNames(31));
  assert.deepEqual(gAddr(31), gAddr(31));
  assert.deepEqual(gMails(31), gMails(31));
  assert.notDeepEqual(gNames(31).map((i) => i.name), gNames(32).map((i) => i.name));
  assert.notDeepEqual(gMails(31).map((i) => i.email), gMails(32).map((i) => i.email));
  assert.notDeepEqual(gAddr(31).map((i) => i.text), gAddr(32).map((i) => i.text));
  assert.deepEqual(generateProfiles({ count: 3, rng: seededRandom(41) }),
    generateProfiles({ count: 3, rng: seededRandom(41) }));
});

test('G15 单类与三元组共用同一套闸门：错误文案点的是出事那一格', () => {
  assert.throws(() => generateProfiles({ count: 51 }),
    (e) => e instanceof RangeError && e.message.startsWith('generateProfiles'));
  assert.throws(() => generateProfiles({ count: 5, rng: 'nope' }),
    (e) => e instanceof TypeError && e.message.startsWith('generateNames'),
    '内层出错时点名被外层吞了');
  assert.throws(() => generateProfiles({ count: 5, areaCode: '999999' }),
    (e) => e instanceof RangeError && /没有前缀「999999」/.test(e.message));
  assert.throws(() => generateProfiles({ count: 5, givenLength: 9 }),
    (e) => e instanceof TypeError && e.message.startsWith('generateNames'),
    '内层的 givenLength 闸门被外层吞了');
  assert.throws(() => generateProfiles({ count: 5, provinceCode: '3712' }),
    RangeError, '莱芜（历史市码）当收窄前缀该抛，而不是安静地放开整张表');
  assert.throws(() => generateProfiles({ count: 5, domain: 'qq.com' }),
    (e) => e instanceof RangeError && e.message.startsWith('generateEmails'));
});

// ── §H 视图层 ──────────────────────────────────────────────────────────────
//（本节只新引 `view.js` 一个模块：`parseIdCard` / `parseUscc` / `parseBankCard` / `parseMobile`、
//  八个 `generate*`、以及 `USE_NOTE` / `REFERENCE_NOTE` / `BANK_CAVEAT` / `MOBILE_CAVEAT` / `NAME_NOTE`
//  已在 §B、§C、§E、§F、§G 的顶层解构过，同名 `const` 再声明一次是 SyntaxError；`readFileSync`
//  文件头就有（只有 H7 读源文本用它）。view.js 这 14 个名字全是新面孔，七个 `h*` 前缀的辅助
//  （`hHead` / `hBody` / `hLabels` / `hWideLabels` / `hTagAudit` / `hText` / `hBanks`）与 §G 的 `dupes` / `gNames` 不重名。）
const { BATCH_KINDS, EMPTY_CELL, READ_KINDS, STATE_META, batchBlock, checksTable, detailTable, echoLines, esc, listTable, noteLines, parseBlock, stateBadge, suggestLine
} = await import('../dev/js/tools/view.js');



/** 表头的列数（只认 `<thead>` 里那一行，别把表体的 `<tr>` 数进来） */
function hHead(html) {
  const m = html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
  return m ? (m[1].match(/<th\b/g) || []).length : 0;
}
/** 表体每一行的格数 */
function hBody(html) {
  const m = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!m) return [];
  return (m[1].match(/<tr>[\s\S]*?<\/tr>/g) || []).map((row) => (row.match(/<td\b/g) || []).length);
}
/**
 * 只审计"真的标签"：转义过的内容里 `&lt;img …&gt;` 是文本，不会在这里露面；
 * 一旦视图少转一次，这里就会长出一个带 `on*=` 的标签或一个白名单外的标签。
 */
function hTagAudit(html) {
  const bad = [];
  for (const tag of html.match(/<\/?[a-zA-Z][^>]*>/g) || []) {
    const name = (tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/) || [])[1];
    if (!['div', 'p', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'].includes((name || '').toLowerCase())) {
      bad.push(`标签 ${name}`);
    }
    if (/\son[a-z]+\s*=/i.test(tag) || /\sstyle\s*=/i.test(tag) || /\s(src|href|action)\s*=/i.test(tag)) {
      bad.push(`属性 ${tag.slice(0, 20)}`);
    }
  }
  return bad;
}
/** 表头文字（判"这一列在不在、叫什么名"用它，改类名不会误红） */
function hLabels(html) {
  const m = html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
  return m ? [...m[1].matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]) : [];
}
/** 剥掉标签只看文字（判"这一句在不在"时不必连类名一起抄，改样式不会误红） */
const hText = (html) => html.replace(/<[^>]*>/g, '');
/** 带 `tk-wide` 下限的那几列的列名（判"长文本列有没有漏标"用它，改样式不误红） */
function hWideLabels(html) {
  const m = html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
  return m ? [...m[1].matchAll(/<th\b[^>]*class="[^"]*\btk-wide\b[^"]*"[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]) : [];
}
const hBanks = (seed) => generateBankCards({ count: 20, rng: seededRandom(seed) });

test('H1 esc 是本文件唯一的转义出口：五个字符各转一次，非文本一律抛', () => {
  assert.equal(esc('&'), '&amp;');
  assert.equal(esc('<'), '&lt;');
  assert.equal(esc('>'), '&gt;');
  assert.equal(esc('"'), '&quot;');
  assert.equal(esc("'"), '&#39;');
  assert.equal(esc('a&amp;b'), 'a&amp;amp;b', '已转义过的串再走一次也必须被继续转义（不做二次识别）');
  assert.equal(esc(0), '0', '数字要能直接出货，否则"0 岁""0 位"会变成空');
  assert.equal(esc(19), '19');
  assert.equal(esc('北京市东城区'), '北京市东城区');
  assert.equal(esc('<a href="x">A&B\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;A&amp;B&#39;&lt;/a&gt;',
    '五个特殊字符同时出现时必须每个都转——把 /g 去掉就只有第一个被换掉');
  for (const bad of [null, undefined, {}, [], true, NaN, Infinity]) {
    assert.throws(() => esc(bad), TypeError, `esc(${JSON.stringify(bad)}) 竟然没抛`);
  }
});

test('H2 六档 state → 三态 + 两档中性：类名与文案逐格钉住，未知状态抛', () => {
  assert.deepEqual(Object.keys(STATE_META).sort(),
    ['checkdigit', 'empty', 'luhn', 'malformed', 'unlisted', 'valid'].sort());
  const want = {
    valid: ['有效', 'ok'], checkdigit: ['校验位不符', 'warn'], luhn: ['校验位不符', 'warn'],
    unlisted: ['表内未收录', 'unknown'], malformed: ['结构非法', 'bad'], empty: ['等待输入', 'idle'],
  };
  for (const [state, [label, tone]] of Object.entries(want)) {
    const html = stateBadge(state);
    assert.equal(html, `<span class="tk-state tk-state--${tone}">${label}</span>`, `${state} 的徽章形状不对`);
  }
  assert.equal(stateBadge('checkdigit'), stateBadge('luhn'), '模 11 与 Luhn 对用户是同一句结论，必须同字同档');
  assert.ok(!stateBadge('unlisted').includes('bad'), '查不到不得渲染成"不通过"（§5.4 那句不下无效结论）');
  assert.ok(!stateBadge('unlisted').includes('ok'), '查不到也不许渲染成绿的');
  for (const bad of ['expired', '', 'OK', 'VALID', null, 0, {}]) {
    assert.throws(() => stateBadge(bad), TypeError, `未知状态 ${JSON.stringify(bad)} 竟然没抛`);
  }
});

test('H3 五个读侧真实向量：外层类名跟着 state 走，未知状态从 parseBlock 也炸', () => {
  const cases = [
    ['idcard', parseIdCard('110101199003070011'), 'ok'],
    ['idcard', parseIdCard('110101199003070015'), 'warn'],
    ['idcard', parseIdCard('123'), 'bad'],
    ['uscc', parseUscc('91350100M000100Y43'), 'ok'],
    ['uscc', parseUscc('91350100M000100Y42'), 'warn'],
    ['bank', parseBankCard('6222-0219-9003-0700-15'), 'ok'],
    ['bank', parseBankCard('4900000000000003'), 'unknown'],
    ['mobile', parseMobile('13800138000'), 'ok'],
    ['mobile', parseMobile('14000000000'), 'unknown'],
    ['mobile', parseMobile('12800138000'), 'bad'],
  ];
  for (const [kind, result, tone] of cases) {
    const html = parseBlock(kind, result);
    assert.ok(html.startsWith(`<div class="tk-result tk-result--${tone}">`),
      `${kind}/${result.state} 的外层类名不是 ${tone}：${html.slice(0, 60)}`);
    assert.doesNotMatch(html, /undefined|null(?![a-z])/g, '渲染结果里漏出了内部值');
  }
  const stray = parseIdCard('110101199003070011');
  stray.state = 'expired';
  assert.throws(() => parseBlock('idcard', stray), TypeError, '未知状态从 parseBlock 走竟然不抛');
});

test('H4 列数一致：十二张表里每一行的格数都等于表头格数', () => {
  /** 列名是 UI 契约：静默少一列＝少一项信息，用户看不出来，只能由判据看住 */
  const WANT_LABELS = {
    idcard: ['号码', '区划', '出生日期', '年龄', '性别'],
    uscc: ['代码', '区划', '主体标识', '校验位'],
    bank: ['卡号', '发卡行', '卡种', '登记位数'],
    mobile: ['号码', '号段', '运营商'],
    name: ['姓名', '姓', '名', '名字数'],
    address: ['地址', '区划码'],
    email: ['邮箱', '域'],
    profile: ['姓名', '地址', '邮箱'],
  };
  const WANT_DETAIL = {
    idcard: ['区划', '出生日期', '年龄', '性别', '顺序码', '校验位', '校验算式', '18 位写法', '15 位写法', '区划数据截止'],
    uscc: ['区划', '登记管理部门码', '机构类别码', '主体标识', '组织机构代码', '组织机构代码校验位', '校验位', '校验算式'],
    bank: ['位数', '命中前缀', '发卡行', '卡种', '表内登记位数', 'Luhn', 'Luhn 算式', '行别来源'],
    mobile: ['位数', '号段', '运营商', '展示格式', '号段来源'],
  };
  assert.deepEqual(Object.keys(WANT_LABELS), BATCH_KINDS.slice(), '列契约的 kind 集合没跟 BATCH_KINDS 同步');
  assert.deepEqual(Object.keys(WANT_DETAIL), READ_KINDS.slice(), '明细契约的 kind 集合没跟 READ_KINDS 同步');
  const rng = seededRandom(11);
  const batches = {
    idcard: generateIdCards({ count: 12, rng }),
    uscc: generateUsccCodes({ count: 12, rng }),
    bank: hBanks(12),
    mobile: generateMobiles({ count: 12, rng }),
    name: generateNames({ count: 12, rng }),
    address: generateAddresses({ count: 12, rng }),
    email: generateEmails({ count: 12, rng }),
    profile: generateProfiles({ count: 12, rng }),
  };
  for (const [kind, rows] of Object.entries(batches)) {
    const html = listTable(kind, rows);
    const cols = hHead(html);
    const body = hBody(html);
    assert.ok(cols >= 2, `${kind} 的列数少到不能承载信息`);
    assert.deepEqual(hLabels(html), WANT_LABELS[kind], `${kind} 的生成表列名与契约不一致`);
    assert.equal(body.length, rows.length, `${kind} 的表格行数与结果条数不一致`);
    assert.deepEqual(body, new Array(rows.length).fill(cols), `${kind} 出现了 ${[...new Set(body)].join('/')} 格混排`);
    assert.ok(batchBlock(kind, rows, []).startsWith(`<div class="tk-batch tk-batch--${kind}">`),
      `${kind} 的生成块没带 kind 类名，样式没法按档区分`);
  }
  // 等宽那一族在样式层同时是**不许折行**那一族（`toolkit.scss` 的 `.tk-table .tk-mono`）。
  // 2026-09-28 那张现场截图里 `1988-02-03` 断在连字符上、表头「年龄」竖着排，就是这一格
  // 没带 nowrap 的形状——所以哪几列走等宽不是观感问题，是列契约的一部分，连类名一起钉住。
  const idFirstRow = /<tbody><tr>(.*?)<\/tr>/.exec(listTable('idcard', batches.idcard))?.[1] ?? '';
  assert.equal((idFirstRow.match(/<td class="tk-mono">/g) || []).length, 2,
    'idcard 生成表只有「号码」与「出生日期」两格等宽：多钉一格就是多一列不许折行');
  assert.equal(/<td class="tk-mono">\d{4}-\d{2}-\d{2}<\/td>/.test(idFirstRow), true,
    '出生日期没走等宽：它会在一串 `1988-02-03` 的连字符后面折成两行');
  // `tk-wide` 是长文本列的宽度下限（样式层 `min-width`）。生成表里只有它能折，容器一窄就先被
  // 压成一个字宽的竖条——2026-09-28 在 940 视口实测「内蒙古自治区乌海市海勃湾区」折到 13 行，
  // 那比横向滚难读得多（滚这条退路 `.tk-out` 早就给了）。哪几列带它，同样是列契约的一部分。
  const WANT_WIDE = {
    idcard: ['区划'], uscc: ['区划'], bank: ['发卡行'], mobile: [], name: [],
    address: ['地址'], email: [], profile: ['地址'],
  };
  assert.deepEqual(Object.keys(WANT_WIDE), Object.keys(WANT_LABELS), 'wide 契约的 kind 集合没跟生成表同步');
  for (const [kind, rows] of Object.entries(batches)) {
    assert.deepEqual(hWideLabels(listTable(kind, rows)), WANT_WIDE[kind], `${kind} 的长文本列（tk-wide）与契约不一致`);
  }
  const reads = {
    idcard: parseIdCard('110101199003070011'),
    uscc: parseUscc('91350100M000100Y43'),
    bank: parseBankCard('6222-0219-9003-0700-15'),
    mobile: parseMobile('13800138000'),
  };
  for (const [kind, result] of Object.entries(reads)) {
    const html = detailTable(kind, result);
    assert.ok(hHead(html) >= 5, `${kind} 的明细表列太少，摊不开解码量`);
    assert.deepEqual(hLabels(html), WANT_DETAIL[kind], `${kind} 的明细表列名与契约不一致`);
    assert.deepEqual(hBody(html), [hHead(html)], `${kind} 的明细表行列不匹配`);
    const c = checksTable(result.checks);
    assert.equal(hHead(c), 3, `${kind} 的判定表不是三列`);
    assert.deepEqual(hLabels(c), ['判定项', '结论', '依据'], `${kind} 的判定表三列名字变了`);
    assert.deepEqual(hBody(c), new Array(result.checks.length).fill(3), `${kind} 的判定表行列不匹配`);
  }
  const zero = listTable('idcard', [{ id18: '110101202601010011', region: '北京市市辖区', birth: '2026-01-01', age: 0, sex: '男' }]);
  assert.ok(zero.includes('>0<'), '0 岁被显示成了空（cell 一旦用 falsy 判断就会这样）');
  assert.ok(!zero.includes(EMPTY_CELL), '这一条五格都有值，不该出现空值形状');
});

test('H5 不判定那一档只有三种真实形状，一律不给"不通过"', () => {
  const uncoded = parseIdCard('610199199003070011');
  assert.equal(uncoded.checks.find((c) => c.key === 'region').ok, null, '前提变了：区划这行不再是 null 档');
  assert.ok(checksTable(uncoded.checks).includes('>未收录<'), '区划未收录没走"未收录"这一格');
  const fifteen = parseIdCard('110101900307001');
  assert.equal(fifteen.state, 'valid');
  assert.equal(fifteen.checks.find((c) => c.key === 'checkBit').ok, null);
  assert.equal(STATE_META[fifteen.state].tone, 'ok', '15 位无校验位却把整块降了档');
  const short = parseBankCard('6222 0219 9003 0700 11');
  assert.equal(short.checks.find((c) => c.key === 'bin').ok, null, '前提变了：登记位数不吻合那格不再是 null');
  const badSegment = parseMobile('12800138000');
  assert.equal(badSegment.checks.find((c) => c.key === 'carrier').ok, null);
  const html = checksTable(badSegment.checks);
  assert.deepEqual(hBody(html), new Array(badSegment.checks.length).fill(3));
  assert.ok(!html.includes('不通过</td><td>号段不成立'), '运营商"不判定"被渲染成了"不通过"');
  const allOk = checksTable(parseIdCard('110101199003070011').checks);
  assert.ok(hText(allOk).includes('通过'), '全判据通过时一行"通过"都没有');
  assert.ok(!hText(allOk).includes('不通过'), '全通过的向量里冒出了"不通过"（三态映射的 true/false 被换了）');
  for (const checks of [[{ key: 'x', label: 'a', ok: 'yes', detail: 'b' }], [{ key: 'x', label: 'a', ok: true }], 'nope', null]) {
    assert.throws(() => checksTable(checks), TypeError, `判据表居然收下了 ${JSON.stringify(checks)}`);
  }
});

test('H6 kind 与列定义一一对应：读侧与生成侧不能互相串门，未知 kind 抛', () => {
  assert.deepEqual(READ_KINDS, ['idcard', 'uscc', 'bank', 'mobile']);
  assert.deepEqual(BATCH_KINDS, ['idcard', 'uscc', 'bank', 'mobile', 'name', 'address', 'email', 'profile']);
  for (const kind of READ_KINDS) {
    const r = kind === 'idcard' ? parseIdCard('110101199003070011')
      : kind === 'uscc' ? parseUscc('91350100M000100Y43')
        : kind === 'bank' ? parseBankCard('6222-0219-9003-0700-15')
          : parseMobile('13800138000');
    assert.ok(detailTable(kind, r).includes('<table'), `${kind} 的明细表没出货`);
  }
  for (const kind of ['name', 'address', 'email', 'profile']) {
    assert.throws(() => detailTable(kind, { info: {} }), TypeError, `生成侧的 ${kind} 居然能走读侧明细表`);
  }
  for (const bad of ['json', '', 'IdCard', null, 0]) {
    assert.throws(() => listTable(bad, []), TypeError, `listTable 居然收下了 kind=${JSON.stringify(bad)}`);
    assert.throws(() => detailTable(bad, { info: {} }), TypeError, `detailTable 居然收下了 kind=${JSON.stringify(bad)}`);
  }
});

test('H7 view.js 零 import、不碰 DOM：跨页共享层的体积红线由判据守着', () => {
  const src = readFileSync(new URL('../dev/js/tools/view.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /^\s*import[\s({]/m, 'view.js 里出现了 import——它会被 toolkitCore 拖进三页共用层');
  assert.doesNotMatch(code, /\bimport\s*\(/, 'view.js 里出现了动态 import');
  assert.doesNotMatch(code, /\bexport\s.*\bfrom\b/, 'view.js 里出现了 re-export（同样是一条 import 边）');
  for (const domWord of ['document', 'window', 'innerHTML', 'querySelector', 'createElement', 'Node']) {
    assert.ok(!code.includes(domWord), `view.js 里出现了 ${domWord}`);
  }
  assert.doesNotMatch(code, /style\s*=\s*"/, 'view.js 里写了内联样式（颜色与尺寸归 toolkit.scss）');
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,6}\b/, 'view.js 里写了颜色字面量（§6.4 只允许语义令牌）');
});

test('H8 口径行原样透传：模块给的句子一字不动，视图不自己另写一套', () => {
  const bank = batchBlock('bank', hBanks(21), [USE_NOTE, BANK_CAVEAT]);
  for (const note of [USE_NOTE, BANK_CAVEAT]) {
    assert.ok(bank.includes(`<p class="tk-note">${note}</p>`), `口径句被改写了：${note.slice(0, 20)}`);
  }
  assert.ok(bank.indexOf(USE_NOTE) < bank.indexOf(BANK_CAVEAT), 'notes 的顺序要照调用方给的顺序出');
  const mobileHtml = parseBlock('mobile', parseMobile('13800138000'));
  assert.ok(mobileHtml.includes(esc(MOBILE_CAVEAT)), '手机号的硬/软结论那句话没落地');
  assert.ok(mobileHtml.includes('运营商按三位号段判定'), '携号转网与发号口径的限定语没落地');
  assert.deepEqual(noteLines(['', null, undefined, '有一句']), ['<p class="tk-note">有一句</p>']);
  assert.deepEqual(noteLines(['含 <b>标签</b> 与 & 的口径句']),
    ['<p class="tk-note">含 &lt;b&gt;标签&lt;/b&gt; 与 &amp; 的口径句</p>'],
    '口径句也得走同一个转义出口：notes 由装配层递进来，对视图就不是可信输入');
  assert.throws(() => noteLines('不是数组'), TypeError);
  const usccHtml = parseBlock('uscc', parseUscc('91350100M000100Y43'), [REFERENCE_NOTE]);
  assert.ok(usccHtml.includes(esc(REFERENCE_NOTE)), '信用代码"第 1、2 位不给名称"的缺口说明没落地');
  assert.throws(() => parseBlock('uscc', parseUscc('91350100M000100Y43'), '不是数组'), TypeError);
  assert.ok(!parseBlock('uscc', parseUscc('91350100M000100Y43')).includes(REFERENCE_NOTE),
    '没传 notes 时视图不许自己去 import 那句——那是装配层的活');
});

test('H9 判定表已经说过的话不再重复一遍：同一句只落地一次', () => {
  const html = parseBlock('idcard', parseIdCard('610199199003070011'));
  const sentence = '区划码未收录（可能是已撤销建制、经济功能区，或晚于区划数据截止日的调整）';
  assert.equal(html.includes(sentence), true, '这句话根本没落地');
  assert.equal(html.split(sentence).length - 1, 1, `「${sentence.slice(0, 12)}…」重复出现了 ${html.split(sentence).length - 1} 次`);
  const withNote = parseBlock('idcard', parseIdCard('110101900307001'));
  assert.ok(withNote.includes('15 位为第一代号码，无校验位'), 'id15Note 那句没落地（它不在判定表里，不该被去重掉）');
  const bank = parseBlock('bank', parseBankCard('4900000000000003'));
  assert.equal(bank.split('前缀未收录').length - 1, 1, '银行卡未收录那句在表外又说了一遍');
  assert.ok(bank.includes(BANK_CAVEAT), '未收录时那句参考口径也得在');
});

test('H10 明细表把解码量摊开：区划带命中级别，算式带 Σ 与模数；结构不成立时不摆空表', () => {
  const idHtml = detailTable('idcard', parseIdCard('110101199003070011'));
  assert.ok(idHtml.includes('110101 · 北京市东城区（县级 · 现行）'), idHtml.match(/<tr>.*?区划.*?<\/tr>/)?.[0]);
  assert.ok(idHtml.includes('36 岁'));
  assert.ok(idHtml.includes('Σ 154 · mod 11 = 0 · 对照表 10X98765432'));
  assert.ok(idHtml.includes('号码末位 1，算得 1'));
  assert.ok(idHtml.includes('2022-10-31'), '区划数据截止日没落地');
  assert.ok(idHtml.includes('<td class="tk-mono">1990-03-07</td>'),
    '明细表的出生日期与生成表同族：定形串一律等宽，两本表里同一个字段不该一个折一个不折');
  const city = detailTable('uscc', parseUscc('91350100M000100Y43'));
  assert.ok(city.includes('350100 · 福建省福州市（市级 · 现行）'), '市级命中被写成了县级');
  const history = detailTable('idcard', parseIdCard('371299199003070011'));
  assert.ok(history.includes('（市级 · 历史）'), '历史码的命中级别没落地');
  for (const bad of ['123', '']) {
    const r = parseIdCard(bad);
    assert.equal(r.info, null, '前提变了：这一档 info 不再是 null');
    assert.equal(detailTable('idcard', r), '', '结构不成立还要摆明细表，等于把一排破折号说成"解出来了"');
  }
});

test('H11 回显分清"原样输入"与"参与判定的是哪一串"，四种归一各有说法', () => {
  const bank = echoLines(parseBankCard('6222-0219-9003-0700-15')).join('');
  assert.ok(bank.includes('6222-0219-9003-0700-15') && bank.includes('622202199003070015'), '分隔符归一没显示');
  assert.ok(bank.startsWith('<p class="tk-echo">原样输入'), bank);
  const plain = echoLines(parseIdCard('110101199003070011')).join('');
  assert.ok(plain.includes('判定对象'), '输入与判定串相同时还写"原样输入 …，参与判定的是…"');
  const inner = parseIdCard('110101 19900307001 1');
  assert.equal(inner.state, 'malformed', '前提变了：身份证内部空格不再是原样判');
  assert.ok(echoLines(inner).join('').includes('去掉中间的分隔符后是 <span class="tk-mono">110101199003070011</span>'));
  const lowered = echoLines(parseUscc('91350100m000100y43')).join('');
  assert.ok(lowered.includes('字母按大写解释'));
  const plus = echoLines(parseMobile('+86 13800138000')).join('');
  assert.ok(plus.includes('去掉了国际前缀 +86'), '手机号自己给的那句归一说明没落地');
});

test('H12 同前缀多行命中时另起一张前缀表，五列且标出位数是否吻合', () => {
  const amb = parseBankCard('622307920707762365');
  assert.equal(amb.ambiguous, true, '前提变了：这个号不再多义');
  assert.equal(amb.matches.length, 2);
  const html = parseBlock('bank', amb);
  const tableHtml = (html.match(/<table class="tk-table tk-matches">[\s\S]*?<\/table>/) || [])[0];
  assert.ok(tableHtml, '多义时没出前缀表');
  assert.equal(hHead(tableHtml), 5, '前缀表表头不是 5 列');
  assert.deepEqual(hBody(tableHtml), [5, 5], '前缀表行格数与表头不一致');
  assert.ok(tableHtml.includes('中国工商银行') && tableHtml.includes('九江银行'));
  assert.equal((tableHtml.match(/>是</g) || []).length, 1, '位数吻合应当只有一条"是"');
  assert.equal((tableHtml.match(/>否</g) || []).length, 1);
  const single = parseBlock('bank', parseBankCard('6222-0219-9003-0700-15'));
  assert.ok(!single.includes('tk-matches'), '单义号码不该摆前缀表');
});

test('H13 建议行只在真有建议时出现，且点名"只改校验位"', () => {
  const wrong = parseIdCard('110101199003070015');
  assert.equal(wrong.suggestedId18, '110101199003070011');
  const html = parseBlock('idcard', wrong);
  assert.ok(html.includes('只改校验位就能自洽：<span class="tk-mono">110101199003070011</span>'), html.slice(-260));
  assert.equal(suggestLine('idcard', parseIdCard('110101199003070011')), '', '校验位本来就对还给建议');
  assert.equal(suggestLine('uscc', parseUscc('91350100M000100Y42')), '', '信用代码没有 suggested 键，视图不许自己拼一个');
  assert.ok(!parseBlock('mobile', parseMobile('12800138000')).includes('只改校验位'), '手机号没有校验位，不该出现建议');
  assert.equal(suggestLine('bank', parseBankCard('9000000000000001')), '', '位数不吻合那档不该给"只改校验位"的号');
});

test('H14 空输入与零结果各有明确说法，不摆空表', () => {
  const idle = parseBlock('idcard', parseIdCard(''));
  assert.ok(idle.startsWith('<div class="tk-result tk-result--idle">'), idle.slice(0, 60));
  assert.ok(idle.includes('还没有可判定的内容。'));
  assert.ok(!idle.includes('<table'), '空输入摆了表格，读屏会念出一串空的判定项');
  const emptyBatch = batchBlock('name', [], [NAME_NOTE]);
  assert.ok(emptyBatch.includes('<p class="tk-count">共 0 条</p>'));
  assert.ok(emptyBatch.includes('这次没有产出任何结果。'));
  assert.ok(!emptyBatch.includes('<table'));
  assert.ok(emptyBatch.includes(NAME_NOTE), '零结果时口径行也得照给');
  const full = batchBlock('name', generateNames({ count: 7, rng: seededRandom(31) }), [NAME_NOTE]);
  assert.ok(full.includes('<p class="tk-count">共 7 条</p>'));
  assert.equal(full.split('<tr>').length - 1, 8, '七条结果应当是表头 + 7 行');
  assert.throws(() => listTable('name', '不是数组'), TypeError);
  assert.throws(() => batchBlock('name', [], '不是数组'), TypeError);
});

test('H15 深样本：把 HTML 与脚本片段塞进输入、行别名与地址，落地只剩文本', () => {
  const evil = '</script><img src=x onerror=alert(1)>';
  const html = parseBlock('idcard', parseIdCard(evil));
  assert.deepEqual(hTagAudit(html), [], '产物里长出了白名单外的标签或危险属性');
  assert.equal((html.match(/<script/g) || []).length, 0, '产物里出现了 <script');
  assert.ok(html.includes('&lt;/script&gt;'), '该转义的串反而没转义');
  assert.ok(html.includes('alert(1)'), '转义之后文本内容还得在（只转义不吞字）');
  const rows = [{
    formatted: evil, bankName: 'A&B「」', cardTypeName: '<b>借记卡</b>', panLength: 19,
  }];
  const listHtml = listTable('bank', rows);
  assert.ok(listHtml.includes('A&amp;B'), '发卡行里的 & 没转义');
  assert.ok(!listHtml.includes('<b>借记卡</b>'), '卡种被当成了标签');
  const deep = generateProfiles({ count: 3, rng: seededRandom(41) });
  deep[0].address.text = evil;
  const profileHtml = batchBlock('profile', deep, []);
  assert.equal((profileHtml.match(/<script|<img/g) || []).length, 0, '嵌套路径上的值没走同一条转义');
  assert.ok(profileHtml.includes('&lt;/script&gt;'));
  assert.throws(() => listTable('profile', [{ name: { name: '甲' }, address: {}, email: { email: 'a@b' } }]),
    /缺「text」/, '嵌套字段少了却静默显示成空');
  assert.equal(listTable('mobile', [{ formatted: '138 0013 8000', segment: '138', carrier: null }])
    .includes(EMPTY_CELL), true, '运营商为空时应出空值形状');
});

test('H16 视图写下的折行钩子，样式层必须真的接住：类名没人认领就是静默失效', () => {
  // H4 钉的是"哪一格带哪个类名"，可类名自己不改布局——生效的地方在 `toolkit.scss` 那四条声明。
  // 删掉任何一条，视图层的判据依旧全绿，页面上却回到 2026-09-28 那个截图形状：「年龄」拆两行、
  // `1988-02-03` 断在连字符上、「内蒙古自治区乌海市海勃湾区」折成 13 行竖排（940 视口实测）。
  // 注释先剥掉：规则体里那些 `//` 说明讲的正是这几条为什么存在，连着匹配会让判据对格式敏感。
  const scss = read('dev/sass/toolkit.scss').replace(/^\s*\/\/.*$/gm, '');
  /** 行首选择器 → 规则体。逐字给选择器，`.tk-table .tk-mono` 才不会误命中裸 `.tk-mono` 那条 */
  const ruleBody = (selector) => {
    const flat = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const m = new RegExp(`^${flat}\\s*\\{([^}]*)\\}`, 'm').exec(scss);
    assert.ok(m, `样式层找不到「${selector}」这条规则，视图层那些类名就是空写的`);
    return m[1];
  };
  assert.match(ruleBody('.tk-table thead th'), /white-space:\s*nowrap/,
    '表头没 nowrap：auto 布局下没人钉列宽的下限，表头一折等于把列压到内容之下');
  assert.match(ruleBody('.tk-table .tk-mono'), /white-space:\s*nowrap/,
    '.tk-mono 只留等宽字体，"不许折"那半条意思丢了：出生日期又会断成 `1988-02-` + `03`');
  assert.match(ruleBody('.tk-table .tk-wide'), /min-width:\s*7em/,
    '.tk-wide 没有下限：整表被压窄时长文本列独自吞下缺口（7em = 12.5px × 7 = 87.5px，'
    + '下沿容 7 个汉字、上沿不许在 1280 宽屏顶出滚动条，两个数都写在样式层的注释里）');
  assert.match(ruleBody('.tk-list td:not(.tk-wide)'), /white-space:\s*nowrap/,
    '长文本之外的格子没钉住 nowrap：列的下限退回表头那两三个字，「借记卡」又要一字一行'
    + '（这一条写成 `min-width: max-content` 是无效的，Chrome 的自动表格布局不采纳 td 上的该关键字）');
  assert.match(ruleBody('.tk-out'), /overflow-x:\s*auto/,
    '下限之上的退路：`.tk-out` 不横向滚，前面三条就只是把折行换成了裁切');
});

// ── §I 面板 DOM 绑定（手写假 DOM） ─────────────────────────────────────────
//（本节只新引 `panel-dom.js` 一个模块：`createPanelWorkspace` 与两份 id 清单
//  `TOOLKIT` / `CODEC` 在 §D 顶层已经解构过了，同名 `const` 再声明一次是 SyntaxError；
//  假 DOM 与六个 `i*` 前缀的辅助（`iPage` / `iAttr` / `iOf` / `iVisible` / `iBanner` / `iEvts`）
//  全是本节新名字，与 §B–§H 的顶层名字不重名。）
const { createPanelDom } = await import('../dev/js/tools/panel-dom.js');

/**
 * 手写假 DOM。绑定层用到的读写口子一共十四个：document 两个（`getElementById` /
 * `createElement`）、节点八个（`setAttribute` / `removeChild` / `insertBefore` / `firstChild` /
 * `textContent` 写 / `hidden` / `focus` / `addEventListener`）、外面四个（`location.hash`、
 * `history.state`、`history.replaceState`、`window.addEventListener('hashchange')`）。
 * 判据自己还要读 `getAttribute` 与 `childNodes`，那是测试侧的观察口，绑定层一个都不碰。
 * 站内没有 jsdom（§0.5 实测：devDeps 只有 autoprefixer / concurrently / postcss /
 * postcss-px-to-viewport / sass / terser / vite），为一个绑定层加依赖要动 `package.json`
 * 与锁文件，正撞 0.6 那条并发面。
 *
 * 三处刻意的"不像真 DOM"，每一处都是为了少一处假绿：
 * 1. **没有 `innerHTML`**。绑定层若写了它，只会长出一个普通属性、一个子节点都不多——
 *    I12 判的就是"错误条里没有长出元素"。真 DOM 反而会把标签解析出来，把这条判据洗白。
 * 2. **`removeChild` 找不到节点就抛**。真 DOM 抛 `NotFoundError`；这里静默的话"撤条没撤干净"看不见。
 * 3. **`replaceState` 会同步改 `location.hash`**，跟浏览器一致。不改的话 I4 那条
 *    "重复点同一块不重复写地址栏"永远测不到（比对 `location.hash` 那一步恒假）。
 *
 * **§J 借的是这一个工厂**，所以它多开五张读写口子（`value` / `disabled` / `select()` /
 * `document.body` / `document.execCommand`）与三个观察口（`mk` / `selLog` / `commandLog`）。
 * 上面三条"不像真 DOM"一条没撤，本节十六判也没有一条读这些新口子——`value` 与 `disabled`
 * 是表单控件的事，绑定层只碰属性表与 `hidden`；两节共用一份工厂，是为了不让假 DOM 长第二套。
 */
function iPage({
  ids = TOOLKIT, prefix = 'tk', hash = '', dropTab = [], dropPanel = [], withTablist = true,
} = {}) {
  const nodes = new Map();
  const focusLog = [];
  const historyCalls = [];
  let created = 0;

  const mkText = (text) => ({ nodeType: 3, tagName: '#text', textContent: String(text) });
  /** §J 的复制兜底与下拉填充要这三张口子；§I 的十六判一条都不读它们（见 §J 开头第 0 条） */
  const selLog = [];
  const commandLog = [];
  const made = [];

  const mkEl = (tag, id = '', seed = {}) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), id, attrs, childNodes: [], hidden: false,
      value: '', disabled: false,
      get firstChild() { return el.childNodes.length ? el.childNodes[0] : null; },
      get textContent() { return el.childNodes.map((n) => n.textContent).join(''); },
      set textContent(v) { el.childNodes = v === '' ? [] : [mkText(v)]; },
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => { attrs.set(k, String(v)); },
      removeAttribute: (k) => { attrs.delete(k); },
      appendChild: (n) => { el.childNodes.push(n); return n; },
      insertBefore: (n, ref) => {
        const i = ref ? el.childNodes.indexOf(ref) : -1;
        if (i < 0) el.childNodes.push(n);
        else el.childNodes.splice(i, 0, n);
        return n;
      },
      removeChild: (n) => {
        const i = el.childNodes.indexOf(n);
        if (i < 0) throw new Error('removeChild：假 DOM 的这个父节点下没有它');
        el.childNodes.splice(i, 1);
        return n;
      },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatch: (type, evt = {}) => {
        for (const fn of listeners.get(type) || []) fn(evt);
        return evt;
      },
      focus: () => { focusLog.push(el.id); },
      /** 临时 `<textarea>` 那条兜底路径要 `select()`；记下来供 §J 判"用完有没有摘掉" */
      select: () => { selLog.push(el); },
    };
    for (const [k, v] of Object.entries(seed)) {
      if (k === 'hidden') el.hidden = Boolean(v);
      else attrs.set(k, String(v));
    }
    if (id !== '') nodes.set(id, el);
    made.push(el);
    return el;
  };

  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => { created += 1; return mkEl(tag); },
    createTextNode: mkText,
    /** §J 的 `legacyCopy` 要往 `body` 上挂临时节点，`execCommand` 的返回值由夹具说了算 */
    body: mkEl('body'),
    copyOk: true,
    execCommand: (name) => { commandLog.push(name); return doc.copyOk === true; },
  };
  const location = { hash };
  const history = {
    state: null,
    replaceState(state, title, url) {
      historyCalls.push({ state, title, url });
      location.hash = url;
    },
  };
  const winListeners = new Map();
  const win = {
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatch: (type) => { for (const fn of winListeners.get(type) || []) fn({}); },
  };

  const ws = createPanelWorkspace({ ids, prefix, hash });
  if (withTablist) mkEl('nav', `${prefix}-tablist`, { class: 'tk-index' });
  for (const id of ids) {
    // 骨架里预置**错的** role / aria-selected：绑定层要是手抄而不是覆写，I1 当场红。
    // `class` / `href` / `aria-live` 是骨架自己的东西，属性表里没有，必须原样留着（I1 一并判）。
    if (!dropTab.includes(id)) {
      mkEl('a', `${prefix}-tab-${id}`, {
        class: 'tk-index__link', href: `#${id}`, role: 'link', 'aria-selected': 'maybe',
      });
    }
    if (!dropPanel.includes(id)) {
      mkEl('section', `${prefix}-panel-${id}`, { class: 'tk-panel', 'aria-live': 'polite' })
        .appendChild(mkText(`body:${id}`));
    }
  }
  const notice = mkEl('p', `${prefix}-notice`, { class: 'tk-notice', hidden: true });

  return {
    doc, ws, location, history, win, notice, focusLog, historyCalls, nodes,
    mk: mkEl, selLog, commandLog, made,
    tab: (id) => nodes.get(`${prefix}-tab-${id}`) ?? null,
    panel: (id) => nodes.get(`${prefix}-panel-${id}`) ?? null,
    created: () => created,
  };
}

/** 节点上现在带着哪些键（用来判"绑定层没发明表外的键、也没删骨架的键"） */
function iAttr(el) {
  return Object.fromEntries([...el.attrs.entries()]);
}
/** 只读属性表里那几键的落值：`hidden` 走属性，其余走 `getAttribute` */
function iOf(el, table) {
  return Object.fromEntries(Object.keys(table).map((k) => [k, k === 'hidden' ? el.hidden : el.getAttribute(k)]));
}
/** 当前可见的面板 id（`hidden === false`；缺节点的那块算不可见） */
function iVisible(page) {
  return page.ws.ids().filter((id) => {
    const el = page.panel(id);
    return Boolean(el) && el.hidden === false;
  });
}
/** 面板里的错误条（按类名认，不按位置认） */
function iBanner(page, id) {
  const el = page.panel(id);
  if (!el) return null;
  return el.childNodes.find((n) => n.nodeType === 1 && n.getAttribute('class') === 'tk-panel__error') ?? null;
}
const iEvts = {
  click: (over = {}) => ({
    button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...over,
  }),
  key: (key, over = {}) => ({
    key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...over,
  }),
};

test('I1 属性表原样落地：骨架的错值被覆写，多余的键一个不动', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  const list = page.doc.getElementById('tk-tablist');
  assert.deepEqual(iOf(list, page.ws.tablistAttr()), {
    id: 'tk-tablist', role: 'tablist', 'aria-label': '工具面板', 'aria-orientation': 'vertical',
  }, 'tablist 容器那一格也得由属性表给');
  assert.equal(list.getAttribute('class'), 'tk-index', '骨架自己的 class 不许被抹掉');
  for (const id of TOOLKIT) {
    const table = page.ws.tabAttr(id);
    assert.deepEqual(iOf(page.tab(id), table), table, `tab ${id} 的落值与属性表不一致`);
    assert.equal(page.tab(id).getAttribute('role'), 'tab', '骨架里预置的 role="link" 必须被覆写');
    assert.equal(page.tab(id).getAttribute('href'), `#${id}`, 'href 不在属性表里，它是禁 JS 时的深链保险');
    const pTable = page.ws.panelAttr(id);
    assert.deepEqual(iOf(page.panel(id), pTable), pTable, `panel ${id} 的落值`);
    assert.equal(page.panel(id).getAttribute('aria-live'), 'polite', '骨架上的多余键不许被 removeAttribute');
  }
  assert.deepEqual(Object.keys(iAttr(page.tab('idcard'))).sort(),
    ['aria-controls', 'aria-selected', 'class', 'href', 'id', 'role', 'tabindex'],
    '节点上只有"表里那几键 + 骨架自带那几键"，绑定层不发明键');
});

test('I2 一次只显示一块：任意时刻恰好一个面板 hidden 为假', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['idcard']);
  assert.equal(page.panel('idcard').getAttribute('role'), 'tabpanel', '隐藏的是可见性，不是把面板降级');
  page.tab('mobile').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['mobile']);
  assert.deepEqual(
    TOOLKIT.map((id) => page.tab(id).getAttribute('aria-selected')).join(','),
    'false,false,false,true,false');
  assert.deepEqual(
    TOOLKIT.map((id) => page.tab(id).getAttribute('tabindex')).join(','),
    '-1,-1,-1,0,-1', 'roving tabindex 跟着可见那块走（§D 的互锁在 DOM 上成立）');
});

test('I3 深链进入即展开对应面板，一个 replaceState 都不发', () => {
  const page = iPage({ hash: '#bankcard' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['bankcard']);
  assert.deepEqual(page.historyCalls, [], '地址栏本来就对，不许再写一次');
  assert.equal(page.ws.unknownHash(), false);
  const plain = iPage();
  createPanelDom({
    workspace: plain.ws, document: plain.doc, location: plain.location,
    history: plain.history, window: plain.win,
  }).mount();
  assert.deepEqual(plain.historyCalls, [], '无 hash 进入时不写 hash（§6.0 第三条的 DOM 侧）');
  assert.deepEqual(iVisible(plain), ['idcard']);
  // 地址栏以裸一个 `#` 结尾时（人从别处复制网址常带上），`location.hash` 是 '#' 而不是 ''：
  // 这时状态机既没 touched 也没 unknown，只有"target 是空串就别写"这一格挡得住回写。
  const bare = iPage({ hash: '#' });
  createPanelDom({
    workspace: bare.ws, document: bare.doc, location: bare.location,
    history: bare.history, window: bare.win,
  }).mount();
  assert.deepEqual(bare.historyCalls, [], '一个裸 # 不去动它：把它"修"成没有 hash 属于多事');
  assert.deepEqual(iVisible(bare), ['idcard']);
  assert.equal(bare.ws.unknownHash(), false, '`#` 不算坏 hash，不该唠叨');
});

test('I4 点 tab：拦住锚点跳转、只换那一块、地址栏写一次', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  const evt = page.tab('uscc').dispatch('click', iEvts.click());
  assert.equal(evt.defaultPrevented, true, '不 preventDefault 就会跳锚点（§6.3 那句"不触发滚动跳动"）');
  assert.deepEqual(iVisible(page), ['uscc']);
  assert.equal(page.location.hash, '#uscc');
  assert.deepEqual(page.historyCalls, [{ state: null, title: '', url: '#uscc' }]);
  page.tab('uscc').dispatch('click', iEvts.click());
  assert.equal(page.historyCalls.length, 1, '点已经亮着的那块不该再写一遍地址栏');
  assert.deepEqual(iVisible(page), ['uscc']);
  assert.equal(page.notice.hidden, true);
});

test('I5 修饰键与中键的点击整个不接：深链的开新标签语义留着', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  for (const [why, over] of [
    ['ctrlKey', { ctrlKey: true }], ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }], ['altKey', { altKey: true }], ['中键', { button: 1 }],
  ]) {
    const evt = page.tab('random').dispatch('click', iEvts.click(over));
    assert.equal(evt.defaultPrevented, false, `${why}：不许拦浏览器的默认动作`);
    assert.deepEqual(iVisible(page), ['idcard'], `${why}：不许换面板`);
  }
  assert.deepEqual(page.historyCalls, [], '带修饰键与中键的点击都不写地址栏');
});

test('I6 方向键自动激活：首尾回绕、焦点跟随、滚动被拦住', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  const evts = [];
  for (let i = 0; i < TOOLKIT.length; i += 1) {
    evts.push(page.tab(page.ws.active()).dispatch('keydown', iEvts.key('ArrowDown')));
  }
  assert.deepEqual(
    page.focusLog,
    [...TOOLKIT.slice(1), 'idcard'].map((id) => `tk-tab-${id}`),
    '每次换面板焦点都跟到新那块的 tab 上（自动激活）');
  assert.equal(page.ws.active(), 'idcard', '五块面板按五次回到第一块');
  assert.deepEqual(iVisible(page), ['idcard']);
  for (const evt of evts) assert.equal(evt.defaultPrevented, true, '方向键的默认动作是滚整页');
  assert.deepEqual(page.historyCalls.map((c) => c.url),
    ['#uscc', '#bankcard', '#mobile', '#random', '#idcard'], '无 hash 进入后，第一次按键就开始写');
});

test('I7 Home/End 到位；只有一块面板时按方向键既不动作也不炸', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  page.tab('idcard').dispatch('keydown', iEvts.key('End'));
  assert.equal(page.ws.active(), 'random');
  assert.deepEqual(page.focusLog, ['tk-tab-random']);
  page.tab('random').dispatch('keydown', iEvts.key('Home'));
  assert.equal(page.ws.active(), 'idcard');
  assert.deepEqual(iVisible(page), ['idcard']);
  const solo = iPage({ ids: ['only'] });
  const soloDom = createPanelDom({
    workspace: solo.ws, document: solo.doc, location: solo.location,
    history: solo.history, window: solo.win,
  });
  soloDom.mount();
  solo.tab('only').dispatch('keydown', iEvts.key('ArrowRight'));
  assert.deepEqual(iVisible(solo), ['only']);
  assert.deepEqual(solo.focusLog, [], '没换面板就不抢焦点');
  assert.deepEqual(solo.historyCalls, [], '只有一块：无 hash 进入仍然不写地址栏');
});

test('I8 无关按键与带修饰键的按键不动状态，也不顺手 preventDefault', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  for (const [why, over] of [
    ['Shift+ArrowUp', { key: 'ArrowUp', shiftKey: true }],
    ['Ctrl+Home', { key: 'Home', ctrlKey: true }],
    ['Enter', { key: 'Enter' }], ['字母 a', { key: 'a' }], ['PageDown', { key: 'PageDown' }],
  ]) {
    const evt = page.tab('idcard').dispatch('keydown', iEvts.key(over.key, over));
    assert.equal(evt.defaultPrevented, false, `${why}：不抢浏览器的默认动作`);
    assert.equal(page.ws.active(), 'idcard', `${why}：不该换面板`);
  }
  assert.deepEqual(page.focusLog, []);
  assert.deepEqual(page.historyCalls, []);
});

test('I9 外部改地址栏：面板跟着换，但焦点不跳、地址栏不回写', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  page.location.hash = '#mobile';
  page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(page), ['mobile']);
  assert.deepEqual(page.focusLog, [], 'hashchange 抢焦点＝把用户正在读的位置跳走');
  assert.deepEqual(page.historyCalls, [], '地址栏已经是它了，回写一次就是自己再触发一轮');
  assert.equal(page.tab('mobile').getAttribute('aria-selected'), 'true');
  assert.equal(page.tab('mobile').getAttribute('tabindex'), '0');
});

test('I10 坏 hash：不切成空白、不改地址栏，只给一条提示，随后自己收回去', () => {
  const page = iPage({ hash: '#mobile' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['mobile']);
  page.location.hash = '#nope';
  page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(page), ['mobile'], '全部 hidden 与"退回第一块"都是把深链用户扔下不管');
  assert.equal(page.notice.hidden, false, '坏 hash 要给一条看得见的说法');
  assert.match(page.notice.textContent, /#nope/);
  assert.deepEqual(page.historyCalls, [], '地址栏保持原样，坏 hash 留着给人复制排查');
  page.tab('random').dispatch('click', iEvts.click());
  assert.equal(page.notice.hidden, true, '用户自己动手之后不再唠叨那条坏 hash');
  assert.deepEqual(page.historyCalls.map((c) => c.url), ['#random'], '动手之后地址栏归位');
  assert.deepEqual(iVisible(page), ['random']);
});

test('I11 渲染抛错只塌那一块：其余四块可点可键盘，塌那块的面板还在', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: {
      idcard: (el) => el.appendChild(page.doc.createTextNode('ok:idcard')),
      uscc: () => { throw new Error('号段表读不出来'); },
      bankcard: (el) => el.appendChild(page.doc.createTextNode('ok:bankcard')),
      mobile: (el) => el.appendChild(page.doc.createTextNode('ok:mobile')),
      random: (el) => el.appendChild(page.doc.createTextNode('ok:random')),
    },
  });
  const report = dom.mount();
  assert.deepEqual(report.mounted, TOOLKIT, '五块都升级了，uscc 塌的是内容不是面板');
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.rendered, ['idcard', 'bankcard', 'mobile', 'random']);
  assert.deepEqual(report.broken, ['uscc'], '错误记在 uscc 那一格上');
  const banner = iBanner(page, 'uscc');
  assert.ok(banner, '塌了的面板顶部要有就地错误条');
  assert.match(banner.textContent, /号段表读不出来/);
  assert.match(banner.textContent, /其余面板不受影响/);
  assert.equal(banner.tagName, 'P');
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.equal(page.panel('uscc').firstChild, banner, '错误条排在原有内容前面');
  assert.match(page.panel('uscc').textContent, /body:uscc/, '骨架内容不许被连带清掉');
  assert.match(page.panel('idcard').textContent, /ok:idcard/);
  assert.equal(iBanner(page, 'idcard'), null);
  page.tab('bankcard').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['bankcard'], '塌一块不影响换面板');
  page.tab('bankcard').dispatch('keydown', iEvts.key('ArrowDown'));
  assert.equal(page.ws.active(), 'mobile', '键盘也照旧：bankcard 的下一块是 mobile');
  assert.deepEqual(iVisible(page), ['mobile']);
});

test('I12 错误条与提示行只写文本：message 里的标签不会长成元素', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const page = iPage({ hash: `#${hostile}` });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
    renderers: { idcard: () => { throw new Error(`坏输入：${hostile}`); } },
  });
  dom.mount();
  assert.equal(page.created(), 1, '整页只允许多出一个错误条节点：message 与 hash 都不许被解析成标签');
  const banner = iBanner(page, 'idcard');
  assert.deepEqual(banner.childNodes.map((n) => n.nodeType), [3], '错误条里只有一个文本子节点');
  assert.equal(banner.innerHTML, undefined, '绑定层不许走 innerHTML');
  assert.match(banner.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(page.notice.childNodes.length, 1);
  assert.match(page.notice.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(page.notice.hidden, false);
  assert.deepEqual(iVisible(page), ['idcard'], '坏 hash 依旧不切空白');
});

test('I13 run() 二次修好：撤掉错误条、状态归零、不留残节点；不认识的 id 抛', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: { uscc: () => { throw new Error('第一次炸'); } },
  });
  dom.mount();
  const before = page.panel('uscc').childNodes.length;
  assert.ok(iBanner(page, 'uscc'));
  assert.equal(dom.run('uscc', (el) => el.appendChild(page.doc.createTextNode('补好了'))), true);
  assert.equal(iBanner(page, 'uscc'), null, '修好了还挂着错误条，等于骗人');
  assert.deepEqual(page.ws.brokenIds(), []);
  assert.equal(page.panel('uscc').childNodes.length, before, '撤一条、追加一条，总数不变＝没有残节点');
  assert.match(page.panel('uscc').textContent, /补好了/);
  assert.equal(dom.run('uscc', () => { throw new Error('又炸'); }), false);
  assert.deepEqual(page.ws.brokenIds(), ['uscc']);
  assert.match(iBanner(page, 'uscc').textContent, /又炸/, '二次失败要覆写文案，不能留着上一句');
  assert.equal(page.panel('uscc').childNodes.filter((n) => n.nodeType === 1).length, 1, '错误条还是那一张，没长第二张');
  assert.throws(() => dom.run('nope', () => {}), RangeError, '装配层写错面板名要当场炸');
  assert.throws(() => dom.run('uscc', '不是函数'), TypeError);
});

test('I14 幂等：sync 连跑三次属性表与错误条都不变，mount 只许跑一次', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
    renderers: { mobile: () => { throw new Error('幂等样本'); } },
  });
  dom.mount();
  const snap = () => JSON.stringify({
    attrs: TOOLKIT.map((id) => [iAttr(page.tab(id)), iAttr(page.panel(id))]),
    kids: TOOLKIT.map((id) => page.panel(id).childNodes.map((n) => n.nodeType)),
    hidden: TOOLKIT.map((id) => [page.tab(id).hidden, page.panel(id).hidden]),
    notice: [page.notice.hidden, page.notice.textContent],
    created: page.created(),
    writes: page.historyCalls.length,
  });
  const first = snap();
  dom.sync();
  dom.sync();
  dom.sync();
  assert.equal(snap(), first, 'sync 幂等：多跑一次既不长节点、不改属性、也不写地址栏');
  assert.equal(page.panel('mobile').childNodes.filter((n) => n.nodeType === 1).length, 1, '错误条一张，不是三张');
  assert.throws(() => dom.mount(), RangeError, '重复 mount 会把渲染函数再跑一遍，那种双份内容比当场炸难查');
  assert.deepEqual(page.ws.brokenIds(), ['mobile']);
});

test('I15 缺节点分两种：没有索引条当场抛，缺一块只标坏那一块', () => {
  const noList = iPage({ withTablist: false });
  assert.equal(noList.doc.getElementById('tk-tablist'), null, '假 DOM 自证：这一页就是没有索引条');
  assert.equal(noList.panel('idcard') !== null, true, '五块面板都在，缺的只有容器');
  const noListDom = createPanelDom({
    workspace: noList.ws, document: noList.doc, location: noList.location,
    history: noList.history, window: noList.win,
  });
  assert.throws(() => noListDom.mount(), (err) => {
    assert.equal(err.constructor.name, 'RangeError', '形状对而页面上没有那个节点，是 RangeError 那一档');
    assert.match(err.message, /tk-tablist/, '要点名是哪个节点找不到');
    return true;
  });
  const page = iPage({ dropTab: ['uscc'], dropPanel: ['bankcard'] });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: { uscc: () => { throw new Error('不该被调用'); }, idcard: () => {} },
  });
  const report = dom.mount();
  assert.deepEqual(report.missing, ['uscc', 'bankcard']);
  assert.deepEqual(report.mounted, ['idcard', 'mobile', 'random']);
  assert.deepEqual(report.rendered, ['idcard']);
  assert.deepEqual(page.ws.brokenIds(), ['uscc', 'bankcard']);
  assert.match(page.ws.brokenOf('uscc'), /tk-tab-uscc.*tab 节点/);
  assert.match(page.ws.brokenOf('bankcard'), /tk-panel-bankcard.*panel 节点/);
  assert.deepEqual(iVisible(page), ['idcard'], '缺 tab 的那块面板仍然参与互锁：一次还是只显示一块');
  const degraded = iBanner(page, 'uscc');
  assert.ok(degraded, '骨架缺陷也要在那块面板上说出来，不是只记在状态里');
  assert.match(degraded.textContent, /tk-tab-uscc/);
  assert.equal(iBanner(page, 'bankcard'), null, '连面板节点都没有，错误条无处可插（也不许凭空造一块）');
  assert.equal(page.created(), 1, '整页只长出那一张错误条');
  assert.equal(dom.run('uscc', () => { throw new Error('骨架没修好之前不该被调用'); }), false);
  assert.equal(dom.run('bankcard', () => { throw new Error('同上'); }), false);
  assert.match(page.ws.brokenOf('uscc'), /tab 节点/, 'run() 报 false 时不许把"缺节点"这条真话洗成"好了"');
  page.tab('idcard').dispatch('keydown', iEvts.key('ArrowDown'));
  assert.equal(page.ws.active(), 'uscc', '状态机只管 ids，不认"缺不缺节点"');
  assert.deepEqual(iVisible(page), ['uscc'], 'uscc 只是没有 tab，面板还在，切过去看得见那句降级提示');
  assert.deepEqual(page.focusLog, [], '那块没有 tab 节点，焦点无处可去（不抛）');
  page.tab('mobile').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['mobile'], '缺 panel 的那块点过去看不到东西，但整页不崩');
});

test('I16 换的是构造参数不是代码：.jt- 那套工作台共用同一份绑定', () => {
  const page = iPage({ ids: CODEC, prefix: 'jt', hash: '#digest' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['digest']);
  assert.equal(page.doc.getElementById('jt-tablist').getAttribute('role'), 'tablist');
  assert.equal(page.nodes.has('tk-tablist'), false, '换了前缀就不该再长出 tk- 的节点');
  assert.deepEqual(iOf(page.tab('digest'), page.ws.tabAttr('digest')), page.ws.tabAttr('digest'));
  assert.equal(page.tab('digest').getAttribute('id'), 'jt-tab-digest');
  assert.equal(page.tab('base64').getAttribute('aria-controls'), 'jt-panel-base64');
  page.tab('url').dispatch('click', iEvts.click());
  assert.deepEqual(page.historyCalls.map((c) => c.url), ['#url'], 'hash 也走同一套，只是 id 换了名字');
});

// ── §J 证件页装配层与入口（`tools/workbench.js` / `toolkitCore.js` / `toolIdcard.js`） ──
//
// 本节把 `workbench.js` 开头那五条口径逐条咬一遍，并且是**接真的三方**咬：绑定层用
// `panel-dom.js` 本尊、结果 HTML 用 `view.js` 本尊、六本业务模块与 `region.js` 也都是本尊。
// mock 掉任何一样，§B–§H 那十九节判据就从"这一层没错"变成"这一层没测"。
//
// 四条夹具口径：
//
// 0. **假 DOM 复用 §I 那一份**（多开的五张读写口子见 `iPage` 的注释头）。结果区走的是
//    `out.innerHTML = 字符串`——假 DOM 上它只长成一个普通属性、不解析标签，所以本节读的是
//    **那一串文本**。这正好也是真页面唯一吃进 HTML 的地方，J13 就数它的赋值次数。
// 1. **每一判都从"按真的按钮 / 派发真的事件"起步**，只有要问 `runGuarded` 走没走时才看返回值。
//    装配层的价值全在接线上，绕开接线等于没测。
// 2. **随机源钉住**（`seededRandom`），于是"共 5 条""前缀 110101"不是运气。
// 3. **夹具的节点清单来自 `controlIds(prefix)` 与 `WORKBENCH_SPEC` 本身**，不在测试里重抄
//    一份 id 清单——重抄的那份会跟着 spec 一起错，Task 9 拿 spec 对账骨架也就失去了第三者。
//    代价是：spec 与骨架同时漏一格时本节不红，那是 Task 9 的活（它比的是磁盘上的 HTML）。
const J_VIEW = await import('../dev/js/tools/view.js');
/** 段 3 Task 5 起 `Tk` 多一只 `ui`（复制三件套从 `workbench.js` 搬过去），挂载夹具跟着供它 */
const J_UI = await import('../dev/js/tools/ui.js');
const {
  createWorkbench, WORKBENCH_SPEC, PANEL_IDS, MAX_READ_LINES, controlIds,
  fieldId, buttonId, copyId, outId, whenId,
} = await import('../dev/js/tools/workbench.js');

/** §J 的默认随机种子：钉住"这一页第一次画什么"，让条数与前缀这类断言可复算 */
const J_SEED = 20260927;
/** 骨架里主按钮与复制按钮的文案。装配层只负责"改口之后改回原文"，句子本身是夹具替身 */
const J_MAIN_LABEL = { gen: '生成', read: '判定' };
const J_COPY_LABEL = {
  'idcard:gen': '复制这批号码', 'idcard:read': '复制判定有效的号码',
  'uscc:gen': '复制这批代码', 'uscc:read': '复制判定有效的代码',
  'bankcard:gen': '复制这批卡号', 'bankcard:read': '复制判定有效的卡号',
  'mobile:gen': '复制这批号码', 'mobile:read': '复制判定有效的号码',
  'random:gen': '复制这批结果',
};

/** spec 的 `type` → 骨架用的标签；缺省那一档全是 `<select>`（静态的也好、待填充的也好） */
const jTag = (type) => (type === 'area' ? 'textarea' : type === 'number' || type === 'date' ? 'input' : 'select');

/** 字符串在另一串里出现几次（`split` 计数，不用正则：句子里满是正则元字符） */
const jCount = (hay, needle) => hay.split(needle).length - 1;

/**
 * 造一页"骨架"：§I 的索引条 + 五块面板 + 提示行，再按 spec 长出 30 个控件、9 条主按钮、
 * 9 条复制按钮、9 个结果区与 4 个受开关控制的字段组。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {string} [o.hash] 进页面时地址栏里的 hash
 * @param {Record<string, string|number>} [o.seed] `'panel:control' → 初值`；`count` 缺省 `'5'`
 * @param {string[]} [o.drop] **不**要长的 id（造"骨架缺一格"那一类缺陷）
 * @returns {object} §I 的那份 page，外加 `ctl` / `btn` / `html` / `set` / `change` 等观察口
 */
function jPage({ prefix = 'tk', hash = '', seed = {}, drop = [] } = {}) {
  // `tk-tab-*` / `tk-panel-*` 这两类骨架节点由 §I 的 `iPage` 长出，摘掉它们的活也在那儿；
  // 本节只把 id 翻译成它的两张清单，其余 id 才归下面的 spec 循环管。
  const slugOf = (id, word) => {
    const at = `${prefix}-${word}-`;
    if (!id.startsWith(at)) return null;
    const slug = id.slice(at.length);
    return PANEL_IDS.includes(slug) && id === `${at}${slug}` ? slug : null;
  };
  const dropTab = drop.map((id) => slugOf(id, 'tab')).filter((s) => s !== null);
  const dropPanel = drop.map((id) => slugOf(id, 'panel')).filter((s) => s !== null);
  const page = iPage({ ids: PANEL_IDS, prefix, hash, dropTab, dropPanel });
  const gone = new Set(drop);
  const mk = page.mk;
  const doc = page.doc;

  for (const [panel, cfg] of Object.entries(WORKBENCH_SPEC)) {
    for (const side of ['gen', 'read']) {
      const cfgSide = cfg.sides[side];
      if (!cfgSide) continue;
      for (const c of cfgSide.controls) {
        const id = fieldId(prefix, panel, c.id);
        if (gone.has(id)) continue;
        const el = mk(jTag(c.type), id);
        // 骨架里每条 select 都自带一句占位项（"不限省份"之类）；`#random-kind` 是唯一
        // 没有空占位的那一条，它的第一项 `name` 就是浏览器的默认选中值。
        // 占位项的"值"走**属性**——`firstValueOf()` 与 `fill()` 读的都是属性，真 DOM 同一条路。
        if (jTag(c.type) === 'select') {
          const ph = mk('option');
          ph.setAttribute('value', c.id === 'kind' ? 'name' : '');
          ph.textContent = '占位';
          el.appendChild(ph);
        }
        const key = `${panel}:${c.id}`;
        if (seed[key] !== undefined) el.value = String(seed[key]);
        else if (c.id === 'count') el.value = '5';
      }
      const bid = buttonId(prefix, panel, side);
      if (!gone.has(bid)) mk('button', bid).textContent = J_MAIN_LABEL[side];
      const cid = copyId(prefix, panel, side);
      if (!gone.has(cid)) {
        const cb = mk('button', cid);
        cb.textContent = J_COPY_LABEL[`${panel}:${side}`];
        cb.disabled = true;                      // 骨架写死 disabled：第一次画完之前没东西可复制
      }
      const oid = outId(prefix, panel, side);
      if (!gone.has(oid)) mk('div', oid);
    }
  }
  for (const id of controlIds(prefix).when) if (!gone.has(id)) mk('p', id);

  const at = (id) => doc.getElementById(id);
  return Object.assign(page, {
    prefix,
    ctl: (panel, control) => at(fieldId(prefix, panel, control)),
    btn: (panel, side) => at(buttonId(prefix, panel, side)),
    copy: (panel, side) => at(copyId(prefix, panel, side)),
    outNode: (panel, side) => at(outId(prefix, panel, side)),
    whenNode: (panel, key) => at(whenId(prefix, panel, key)),
    /** 结果区里那一串 HTML；节点被 `drop` 掉时给空串，判据照样跑得动（那一判要的就是"没画"） */
    html: (panel, side) => String(at(outId(prefix, panel, side))?.innerHTML ?? ''),
    set: (panel, control, v) => { const el = at(fieldId(prefix, panel, control)); el.value = String(v); return el; },
    change: (panel, control) => at(fieldId(prefix, panel, control)).dispatch('change', {}),
    click: (panel, side) => at(buttonId(prefix, panel, side)).dispatch('click', {}),
    clickCopy: (panel, side) => at(copyId(prefix, panel, side)).dispatch('click', {}),
    keyOn: (panel, control, evt) => at(fieldId(prefix, panel, control)).dispatch('keydown', evt),
  });
}

/**
 * 装配层 + 绑定层 + 挂载，一路接成页面上那个样子。
 *
 * 两种"填格子"要分开，因为它们在页面上根本不是同一时刻的事：
 * - `seed`：**骨架自带的初值**（只有 `count` 那条 `value="5"` 属于这里）。它在挂载之前就在
 *   DOM 上，会参与挂载期的第一次生成。
 * - `pick`：**用户改的选择**。挂载时每条 select 都被 `refill()` 重建过一遍并 reset 成
 *   `''`（真页面也是这样：省格刚填上 31 条选项，默认落在占位那条），所以任何"我选了北京"
 *   的事实只能在挂载之后写下，并且要跟着派发 `change`——级联与开关全挂在 `change` 上，
 *   不派发就等于用户在 DOM 里偷偷改了值。
 *
 * @param {object} o 透给 `jPage` 的选项，外加 `clipboard` / `rng` / `pick`
 * @returns {object} `{ page, wb, dom, report, timers, guarded, flush }`
 */
function jMount(o = {}) {
  const prefix = o.prefix ?? 'tk';
  const page = jPage({ prefix, hash: o.hash, seed: o.seed, drop: o.drop });
  const timers = [];
  /** `runGuarded` 的调用记录：口径 2 说"挂载期一次都不许走它"，这一格就是它的观察口 */
  const guarded = [];
  const host = { dom: null };
  const wb = createWorkbench({
    document: page.doc,
    Tk: { view: J_VIEW, ui: J_UI },
    prefix,
    today: TODAY,
    ...(o.rng === null ? {} : { rng: o.rng ?? seededRandom(J_SEED) }),
    navigator: o.clipboard ? { clipboard: o.clipboard } : undefined,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    runGuarded: (id, fn) => { guarded.push(id); return host.dom.run(id, fn); },
  });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location, history: page.history,
    window: page.win, renderers: wb.renderers, notice: page.notice,
  });
  host.dom = dom;
  const report = dom.mount();
  for (const [who, v] of Object.entries(o.pick ?? {})) {
    const [panel, control] = who.split(':');
    page.set(panel, control, v);
    page.change(panel, control);
  }
  const flush = () => {
    const due = timers.splice(0, timers.length);
    for (const t of due) t.fn();
    return due;
  };
  return { page, wb, dom, report, timers, guarded, flush, prefix };
}

/** 一条有效号码：把 17 位本体交给 §B 的 `mk()` 补校验位，本节不另算一遍模 11 */
const jIds = (bodies) => bodies.map((b) => mk(b));
/** 复制按钮当前那句文案（`textContent` 走的是子节点，与真 DOM 同一张脸） */
const jLabel = (page, panel, side) => page.copy(panel, side).textContent;
/**
 * 排空微任务：`navigator.clipboard.writeText` 那一级的成败是异步的，而 `later` 被夹具
 * 换成了"只记账不执行"，所以 `await` 这一发只等 Promise 链落地，不等那 1600 ms。
 * 用的是全局 `setTimeout`，不是注入给装配层的那只——后者一执行就会把按钮文案改回去。
 * @returns {Promise<void>} 微任务队列清空
 */
const jSettle = () => new Promise((r) => { setTimeout(r, 0); });

test('J1 口径 1：没选的格子整键不传；选了的格子必须真的落到号码上', () => {
  // 左半边：一格不填（只有骨架自带的 count=5）在挂载期跑完五块面板。
  // 这一格是**行为**证据不是读数证据：六本模块收到空串各抛各的（`sex:''` 抛 RangeError、
  // `areaCode:''`/`domain:''`/`givenLength:''` 抛 TypeError），空串只要递下去一块就进 broken 名单。
  const bare = jMount();
  assert.deepEqual(bare.report.broken, [], '有一格把空串递下去了：五块面板应当在挂载期全部画好');
  assert.deepEqual(bare.report.rendered, PANEL_IDS);
  assert.deepEqual(bare.report.missing, [], '夹具自证：五块面板的 tab 与 panel 节点都在');
  for (const panel of PANEL_IDS) {
    assert.match(bare.page.html(panel, 'gen'), /<p class="tk-count">共 5 条<\/p>/, `${panel}：挂载期没画出 5 条`);
  }
  // 空着的 registry / category 让模块走它自己的默认**字符**（不是随机）：这是"不写键"唯一
  // 能被看出来的方式——写成 `''` 早就抛了，写成随机又和默认字符对不上。
  const codes = bare.wb.copyTextOf('uscc', 'gen').split('\n');
  assert.equal(codes.length, 5);
  for (const c of codes) {
    assert.equal(c.length, 18, `${c}：不是 18 位`);
    assert.equal(c[0], '9', '登记管理部门代码没选，模块的默认字符应当是 9');
    assert.equal(c[1], '1', '机构类别代码没选，模块的默认字符应当是 1');
  }
  // 空着的位数 → 行别登记位数，卡号长度落在 13–19 且每一条都过 Luhn
  for (const n of bare.wb.copyTextOf('bankcard', 'gen').split('\n')) {
    assert.equal(n.length >= PAN_MIN && n.length <= PAN_MAX, true, `${n}：位数越界`);
    assert.equal(parseBankCard(n).state, 'valid', `${n}：空位数生成的卡号不自洽`);
  }
  // 空着的号段 / 运营商 → 11 位且首位形状合法；空着的字数 → 名字 2 或 3 字
  for (const n of bare.wb.copyTextOf('mobile', 'gen').split('\n')) {
    assert.match(n, /^1[3-9]\d{9}$/, `${n}：号段形状不对`);
  }
  for (const nm of bare.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.match(nm, /^[一-鿿]{2,3}$/, `${nm}：不限字数时名字长度不对`);
  }
  // 右半边：同样的格子填上值，值必须真的改号码——不然"不写键"和"写了键"就分不出来。
  // 走 `pick`（挂载后改 + 派发 change）而不是 `seed`：省格与字符集格在挂载期被 `refill()`
  // 重建过，构造时写下的值会被 reset 成空，页面上"用户选的"从来都发生在挂载之后。
  const set = jMount({
    pick: {
      'idcard:sex': 'male', 'idcard:province': '11', 'uscc:registry': 'A', 'uscc:category': '2',
      'bankcard:length': 16, 'mobile:segment': '138', 'random:givelen': '2',
    },
  });
  assert.deepEqual(set.report.broken, []);
  for (const panel of PANEL_IDS) set.page.click(panel, 'gen');
  for (const id of set.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(Number(id.slice(16, 17)) % 2, 1, `${id}：选了男却出了女`);
    assert.equal(id.slice(0, 2), '11', `${id}：选了北京市却没落在 11`);
  }
  for (const c of set.wb.copyTextOf('uscc', 'gen').split('\n')) {
    assert.equal(c[0], 'A', `${c}：第 1 位不是选中的 A`);
    assert.equal(c[1], '2', `${c}：第 2 位不是选中的 2`);
  }
  for (const n of set.wb.copyTextOf('bankcard', 'gen').split('\n')) {
    assert.equal(n.length, 16, `${n}：指定了 16 位却画成 ${n.length} 位`);
  }
  for (const n of set.wb.copyTextOf('mobile', 'gen').split('\n')) {
    assert.equal(n.slice(0, 3), '138', `${n}：指定了 138 段`);
  }
  for (const nm of set.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.equal(nm.length, 3, `${nm}：名字字数选了 2 个字`);
  }
});

test('J2 区划级联：占位项留住、禁用跟着上游走、优先级是县 > 市 > 省', () => {
  const m = jMount();
  const prov = m.page.ctl('idcard', 'province');
  const city = m.page.ctl('idcard', 'city');
  const county = m.page.ctl('idcard', 'county');
  assert.equal(prov.childNodes.length, 1 + provinceCodes().length, '省格：占位项 + 31 条');
  assert.equal(prov.childNodes[0].getAttribute('value'), '', '骨架那条占位项必须还在第一位');
  assert.equal(city.disabled, true, '省没选，市格要禁用，不是留一格空白让人猜');
  assert.equal(county.disabled, true);
  assert.equal(city.childNodes.length, 1, '禁用状态下市格里只该有占位那一条');
  const cityPh = city.firstChild;
  const countyPh = county.firstChild;

  m.page.set('idcard', 'province', '11');
  m.page.change('idcard', 'province');
  assert.equal(currentCityCodes('11').length, 1, '夹具自证：北京市下面只有"市辖区"一个市');
  assert.equal(city.disabled, false);
  assert.equal(city.childNodes.length, 2);
  assert.equal(city.childNodes[1].getAttribute('value'), '1101');
  assert.equal(city.childNodes[1].textContent, cityName('1101'));
  assert.equal(city.firstChild, cityPh, 'fill 要把骨架那条占位项留住，不是重新造一条');
  // 省下恰好一个市 → 县格不等用户选市就先行放开（4 个直辖市都是这个形状）
  assert.equal(county.disabled, false);
  assert.equal(county.childNodes.length, 1 + currentCountyCodes('1101').length);
  assert.equal(county.firstChild, countyPh);

  // 优先级：三级都选上，号码只认县
  m.page.set('idcard', 'city', '1101');
  m.page.change('idcard', 'city');
  m.page.set('idcard', 'county', '110101');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 6), '110101', `${id}：县都选了，前六位却不是它`);
  }
  // 清掉县 → 只认市；再清掉市 → 只认省。三级各留一条口径，谁在上面听谁的
  m.page.set('idcard', 'county', '');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 4), '1101', `${id}：没有县时应退到市`);
  }
  m.page.set('idcard', 'city', '');
  m.page.change('idcard', 'city');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 2), '11', `${id}：市也空了，应退到省`);
    assert.equal(resolveRegion(id.slice(0, 6)).provinceCode, '11', `${id}：退到省之后跑出省去了`);
  }
  // 省改选到"下面不止一个市"的省，县格必须重新禁用（它无从选起）
  m.page.set('idcard', 'province', '32');
  m.page.change('idcard', 'province');
  assert.equal(city.disabled, false);
  assert.equal(city.childNodes.length, 1 + currentCityCodes('32').length);
  assert.equal(county.disabled, true, '江苏省 13 个市，没选市之前县格不该亮着');
  assert.equal(county.childNodes.length, 1, '上游断了，县格要退回只剩占位项');
  assert.equal(county.firstChild, countyPh, '退回时占位项还是原来那一条');
});

test('J3 口径 3 的两条路：缺日期是提示行不是坏面板，超范围的日期才交给模块标坏', () => {
  const m = jMount();
  const when = m.page.whenNode('idcard', 'birth');
  assert.equal(when.hidden, true, '年龄段停在占位那一条时，出生日期那一格不该先露出来');
  assert.equal(m.guarded.length, 0, '口径 2：挂载期一次都不许走 runGuarded');

  // 开关：选到 custom 才现身，退回去又藏起来（藏走的是 `hidden` 属性，不是 class / style）
  m.page.set('idcard', 'ageband', 'custom');
  m.page.change('idcard', 'ageband');
  assert.equal(when.hidden, false);
  assert.equal(when.getAttribute('class'), null, '显隐不许写进 class，也不许留 style 痕迹');
  assert.equal(when.attrs.has('style'), false);

  // 第一条路：选了 custom 却没填日期 → FieldError → 结果区一句提示，面板不进 broken
  m.page.click('idcard', 'gen');
  const hinted = m.page.html('idcard', 'gen');
  assert.match(hinted, /^<p class="tk-hint">/, '提示行要单独占结果区，不该还挂着半张表');
  assert.match(hinted, /指定出生日期/);
  assert.equal(hinted.includes('tk-count'), false, '一行都没生成就别报"共 N 条"');
  assert.deepEqual(m.page.ws.brokenIds(), [], '把"你少填了个日期"说成"这块面板坏了"是口径 3 禁止的');
  assert.equal(iBanner(m.page, 'idcard'), null);
  assert.equal(m.wb.copyTextOf('idcard', 'gen'), '', '提示行没有可复制的东西');
  assert.equal(m.page.copy('idcard', 'gen').disabled, true);
  assert.deepEqual(m.guarded, ['idcard'], '这一按走的是 createPanelDom().run 那一道闸门');

  // 修好：填上日期再按一次，提示行整段换掉、复制按钮活过来
  m.page.set('idcard', 'birth', '1990-05-06');
  m.page.click('idcard', 'gen');
  const ok = m.page.html('idcard', 'gen');
  assert.equal(ok.includes('tk-hint'), false, '提示行留在原地，人会以为还是没填');
  assert.match(ok, /共 5 条/);
  assert.equal(m.page.copy('idcard', 'gen').disabled, false);
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', `${id}：指定的出生日期没落到号码上`);
  }

  // 年龄段那一档：换了档，日期格要重新藏回去，号码的年龄跟着落进区间
  m.page.set('idcard', 'ageband', '18-30');
  m.page.change('idcard', 'ageband');
  assert.equal(when.hidden, true, '从 custom 换回年龄段，日期格必须再藏起来');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    const age = parseIdCard(id, { today: TODAY }).info.ageYears;
    assert.equal(age >= 18 && age <= 30, true, `${id}：${age} 岁不在 18–30 里`);
  }

  // 第二条路：日期形状合法但超出模块的范围——那是模块的话，由它说，并且只塌这一块
  m.page.set('idcard', 'ageband', 'custom');
  m.page.change('idcard', 'ageband');
  m.page.set('idcard', 'birth', '2099-01-01');
  m.page.click('idcard', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), ['idcard'], '模块抛出来的一律原样交出去，且只塌这一块');
  assert.match(m.page.ws.brokenOf('idcard'), /2099-01-01/);
  assert.match(m.page.ws.brokenOf('idcard'), /不得晚于今天/);
  const banner = iBanner(m.page, 'idcard');
  assert.ok(banner);
  assert.match(banner.textContent, /其余面板不受影响/);
  assert.match(m.page.html('idcard', 'gen'), /共 5 条/, '标坏之前画好的那一张表不许被拖没');
  // 自我修复：改回合法日期再按一次，错误条撤掉、状态归零
  m.page.set('idcard', 'birth', '1990-05-06');
  m.page.click('idcard', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), []);
  assert.equal(iBanner(m.page, 'idcard'), null);
});

test('J4 #random 四档 kind：该现身的现身、该带上的键带上，非法值只塌这一块', () => {
  const m = jMount();
  const shown = () => ['givelen', 'addr', 'domain']
    .map((k) => `${k}=${m.page.whenNode('random', k).hidden ? 'hidden' : 'shown'}`).join(' ');
  // kind 一格在骨架里没有空占位项，浏览器默认选中 `name` → 假 DOM 里读作 ''，
  // 装配层退到 `firstValueOf()`：这一格正是那个退路存在的理由。
  assert.equal(m.page.ctl('random', 'kind').value, '');
  assert.equal(shown(), 'givelen=shown addr=hidden domain=hidden', '默认档是「姓名」');
  assert.match(m.page.html('random', 'gen'), /tk-batch--name/);

  for (const [kind, want, marker] of [
    ['address', 'givelen=hidden addr=shown domain=hidden', /tk-batch--address/],
    ['email', 'givelen=hidden addr=hidden domain=shown', /tk-batch--email/],
    ['profile', 'givelen=shown addr=shown domain=shown', /tk-batch--profile/],
    ['name', 'givelen=shown addr=hidden domain=hidden', /tk-batch--name/],
  ]) {
    m.page.set('random', 'kind', kind);
    m.page.change('random', 'kind');
    assert.equal(shown(), want, `kind=${kind} 那一档的显隐不对`);
    m.page.click('random', 'gen');
    assert.match(m.page.html('random', 'gen'), marker, `kind=${kind} 画出来的不是这一档`);
    assert.equal(m.page.ws.brokenOf('random'), '');
  }

  // 用不上的格子不许偷偷带上：地址档选的区划，切到邮箱档之后不能跟着走
  m.page.set('random', 'kind', 'address');
  m.page.change('random', 'kind');
  m.page.set('random', 'province', '32');
  m.page.change('random', 'province');
  m.page.click('random', 'gen');
  for (const line of m.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.equal(line.slice(0, 2), '江苏', `${line}：江苏省的地址前缀不对`);
  }
  m.page.set('random', 'kind', 'email');
  m.page.change('random', 'kind');
  m.page.click('random', 'gen');
  const mails = m.wb.copyTextOf('random', 'gen').split('\n');
  assert.equal(mails.length, 5);
  for (const e of mails) {
    assert.match(e, /^[A-Za-z0-9._-]+@example\.(com|net|org)$/, `${e}：邮箱形状不对`);
  }
  // 三格同时生效：profile 那一档要把字数、区划、域名三个键一起带上，少一个都是"看着对、其实漏"
  m.page.set('random', 'kind', 'profile');
  m.page.change('random', 'kind');
  m.page.set('random', 'givelen', '2');
  m.page.set('random', 'domain', 'example.org');
  m.page.click('random', 'gen');
  const rows = m.wb.copyTextOf('random', 'gen').split('\n');
  assert.equal(rows.length, 5);
  for (const line of rows) {
    const [nm, addr, mail] = line.split('\t');
    assert.equal(line.split('\t').length, 3, `${line}：一组资料不是一条姓名/地址/邮箱`);
    assert.equal(nm.length, 3, `${nm}：名字字数 2 没进 profile`);
    assert.equal(addr.slice(0, 2), '江苏', `${addr}：区划没进 profile`);
    assert.equal(mail.endsWith('@example.org'), true, `${mail}：域名没进 profile`);
  }

  // 非法 kind：RangeError 原样交出去，只塌这一块，其余四块的内容一张都没掉
  m.page.set('random', 'kind', 'nope');
  m.page.change('random', 'kind');
  m.page.click('random', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), ['random']);
  assert.match(m.page.ws.brokenOf('random'), /kind 格取到「nope」/);
  assert.match(m.page.ws.brokenOf('random'), /只认 name \/ address \/ email \/ profile/);
  for (const panel of PANEL_IDS.filter((p) => p !== 'random')) {
    assert.match(m.page.html(panel, 'gen'), /共 5 条/, `${panel} 不该被 #random 拖下水`);
  }
  m.page.set('random', 'kind', 'name');
  m.page.click('random', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), [], '改回合法值就该自愈');
  assert.equal(iBanner(m.page, 'random'), null);
});

test('J5 读侧：原始行号、空行只占号不占位、50 行上限、空框给提示', () => {
  const good = mk('11010119900307001');
  const hist = mk('11010319900307001');                 // 崇文区：有效，但带一句动态 caveat
  const bad = good[17] === '9' ? `${good.slice(0, 17)}8` : `${good.slice(0, 17)}9`;
  assert.notEqual(bad, good, '夹具自证：这一条只改了校验位');
  const m = jMount();
  // 挂载期那一格是提示，不是空着
  assert.match(m.page.html('idcard', 'read'), /<p class="tk-hint">把号码粘进来/);
  assert.equal(m.page.copy('idcard', 'read').disabled, true);
  m.page.click('idcard', 'read');
  assert.match(m.page.html('idcard', 'read'), /粘贴框里还没有号码/);

  m.page.set('idcard', 'read', ['', good, '   ', hist, bad].join('\n'));
  m.page.click('idcard', 'read');
  const h = m.page.html('idcard', 'read');
  assert.equal(jCount(h, '<section class="tk-line">'), 3, '三条不空的行 = 三个结果块');
  assert.match(h, /第 2 行/, '行号要用原始行号：第 2 行就是第 2 行');
  assert.match(h, /第 4 行/);
  assert.match(h, /第 5 行/);
  assert.equal(h.includes('第 1 行'), false, '全空行不进表格');
  assert.equal(h.includes('第 3 行'), false, '只有一串空格的行也不进表格，但号还是要占');
  assert.equal(h.includes('第 6 行'), false, '粘贴框只有 5 行，别凭空多出一块');
  // 复制只交判定有效的那几条，顺序跟粘贴一致
  assert.equal(m.wb.copyTextOf('idcard', 'read'), [good, hist].join('\n'));
  assert.equal(m.page.copy('idcard', 'read').disabled, false);
  // 原样回显：连号都别给我改
  assert.match(h, new RegExp(`<span class="tk-line__raw">${hist}</span>`));
  // 1900–1999 出生的那一行同时给 15 位写法（骨架那句 help 文案说的就是这一格）
  assert.match(h, /15 位写法/);
  assert.equal(h.includes(`${hist.slice(0, 6)}${hist.slice(8, 14)}${hist.slice(14, 17)}`), true,
    '15 位写法 = 6 位区划 + 6 位年月日（去年世纪）+ 3 位顺序码');

  // Windows 粘贴带来的 \\r\\n 要归一，不许留下半个 \\r 把回显撑坏
  m.page.set('idcard', 'read', `${good}\r\n${bad}\r`);
  m.page.click('idcard', 'read');
  const cr = m.page.html('idcard', 'read');
  assert.equal(jCount(cr, '<section class="tk-line">'), 2);
  assert.equal(cr.includes('\r'), false, '行尾的回车没被吃掉');
  assert.match(cr, /第 2 行/);

  // 上限：粘 60 行只判前 50 行，多出来的行数在提示里报数，不进表格
  const pool = generateIdCards({ count: 50, today: TODAY, rng: seededRandom(J_SEED + 1) })
    .map((r) => r.id18);
  m.page.set('idcard', 'read', Array.from({ length: 60 }, (_, i) => pool[i % pool.length]).join('\n'));
  m.page.click('idcard', 'read');
  const big = m.page.html('idcard', 'read');
  assert.equal(jCount(big, '<section class="tk-line">'), MAX_READ_LINES, `只该判前 ${MAX_READ_LINES} 行`);
  assert.match(big, new RegExp(`这次粘进来 60 行，只判定前 ${MAX_READ_LINES} 行`));
  assert.equal(m.wb.copyTextOf('idcard', 'read').split('\n').length, MAX_READ_LINES);
  // 恰好 50 行时那句上限提示不许出现
  m.page.set('idcard', 'read', pool.join('\n'));
  m.page.click('idcard', 'read');
  assert.equal(m.page.html('idcard', 'read').includes('这次粘进来'), false, '没超上限就别报数');
  assert.equal(jCount(m.page.html('idcard', 'read'), '<section class="tk-line">'), 50);
});

test('J6 下拉按 spec 填充：常用行不包组、号段按运营商分五组、字符集只标默认那一个', () => {
  const m = jMount();
  const { page } = m;
  /**
   * 一条 `<select>` 填完之后的形状。分组与裸选项分开数：`fillGrouped` 里
   * `label === ''` 那一组必须直接长出 `<option>`，所以它会算进 `bare` 而不是 `groups`。
   * @param {string} panel 面板
   * @param {string} control 控件
   * @returns {object} `{ el, head, bare, groups, sizes, values, labels }`
   */
  const shape = (panel, control) => {
    const el = page.ctl(panel, control);
    const boxes = el.childNodes.filter((n) => n.tagName === 'OPTGROUP');
    const flat = [
      ...el.childNodes.filter((n) => n.tagName === 'OPTION'),
      ...boxes.flatMap((b) => b.childNodes),
    ];
    return {
      el,
      head: el.firstChild,
      bare: el.childNodes.length - boxes.length,
      groups: boxes.map((b) => b.getAttribute('label')),
      sizes: boxes.map((b) => b.childNodes.length),
      values: flat.map((o) => o.getAttribute('value')),
      labels: flat.map((o) => o.textContent),
    };
  };

  // ① 发卡行：常用那 20 行是裸选项（包进组会让读屏先念一句"选项 空"），其余 240 行才分组
  const bank = shape('bankcard', 'bank');
  assert.equal(bank.head.tagName, 'OPTION', '骨架那条占位项必须是第一个子节点');
  assert.equal(bank.head.getAttribute('value'), '', '占位项没有值，选中它等于没选');
  assert.equal(bank.bare, 1 + TOP_BANKS.length, '占位项 + 常用行那 20 条都不该被包进 <optgroup>');
  assert.deepEqual(bank.groups, ['其余行别（按行别码）']);
  assert.deepEqual(bank.sizes, [BANK_OPTIONS.length - TOP_BANKS.length]);
  assert.deepEqual(bank.labels.slice(1, 1 + TOP_BANKS.length),
    TOP_BANKS.map((b) => `${b.name}（${b.binCount} 条 BIN）`), '常用行要把 BIN 条数写在脸上');
  assert.equal(new Set(bank.values.slice(1)).size, BANK_OPTIONS.length, '260 个行别码不该有重复或遗漏');

  // ② 卡种四条、邮箱域三条、运营商五条：顺序跟着模块那张表走，测试不替它重排
  const ctype = shape('bankcard', 'type');
  assert.deepEqual(ctype.values, ['', ...Object.keys(CARD_TYPES)]);
  assert.deepEqual(ctype.labels.slice(1), Object.values(CARD_TYPES));
  const domain = shape('random', 'domain');
  assert.deepEqual(domain.values, ['', ...EMAIL_DOMAINS], '邮箱域这一格没有第二条路');
  const carrier = shape('mobile', 'carrier');
  assert.deepEqual(carrier.groups, [], '运营商这一格不该有 <optgroup>：五条并列');
  assert.deepEqual(carrier.labels.slice(1), CARRIERS.map((c) => `${c.carrier}（${c.count} 个号段）`),
    '括号里那个数就是 §F0 钉住的号段数，让用户先看见池子有多大');

  // ③ 号段按运营商分五组：成员数与 `CARRIERS` 的 count 逐格对上；平铺那份比对 §F 从号段表独立数出的 `LISTED`——与被测取数链不同源，才看得出装配层掉段
  const seg = shape('mobile', 'segment');
  assert.deepEqual(seg.groups, CARRIERS.map((c) => c.carrier));
  assert.deepEqual(seg.sizes, CARRIERS.map((c) => c.count));
  assert.deepEqual([...seg.values.slice(1)].sort(), [...LISTED].sort(), '56 段一段都不能少');
  assert.equal(seg.bare, 1, '号段格除了占位项，其余必须都在组里');

  // ④ 统一社会信用代码那两格：31 个字符挨条填上，「（默认）」只许出现在默认那个字符上
  for (const [control, dflt] of [['registry', '9'], ['category', '1']]) {
    const cs = shape('uscc', control);
    assert.deepEqual(cs.values, ['', ...USCC_CHARSET], '字符集表里没有的第二条路');
    const marked = cs.labels.filter((l) => l.includes('（默认）'));
    assert.deepEqual(marked, [`${dflt}（默认）`],
      `${control}：默认那一格要标出来，别的格子不能跟着标`);
  }

  // ⑤ spec 里没打标记的格子，装配层一条都不动：省份之外的文案是骨架自己的
  assert.equal(page.ctl('idcard', 'sex').childNodes.length, 1, 'sex 没有 options / cascade 标记，不该被重建');
  assert.equal(page.ctl('idcard', 'ageband').childNodes.length, 1);

  // ⑥ 同一格反复填充不叠加：清不干净旧选项就会越点越长，最后一份列表没人认识
  const city = page.ctl('idcard', 'city');
  const cityPh = city.firstChild;
  page.set('idcard', 'province', '32');
  page.change('idcard', 'province');
  const once = city.childNodes.length;
  page.change('idcard', 'province');
  page.change('idcard', 'province');
  assert.equal(city.childNodes.length, once, '换省三次之后市格还是那 13 条');
  assert.equal(city.firstChild, cityPh, '三次重建之后留在第一位的仍是骨架那条占位项');
});

test('J8 一块塌下去别块照旧：跨面板隔离，与数量格那两句话', () => {
  const m = jMount();
  const { page } = m;
  // 登记管理部门码填成字符集外的 `!`：模块抛 RangeError，闸门只塌这一块
  page.set('uscc', 'registry', '!');
  page.change('uscc', 'registry');
  page.click('uscc', 'gen');
  assert.deepEqual(page.ws.brokenIds(), ['uscc'], '只该有 uscc 这一块进 broken 名单');
  assert.match(page.ws.brokenOf('uscc'), /登记管理部门代码/);
  assert.match(page.ws.brokenOf('uscc'), /31 字符集内的单个字符/);
  assert.match(iBanner(page, 'uscc').textContent, /其余面板不受影响/);
  for (const id of PANEL_IDS) {
    if (id === 'uscc') continue;
    assert.equal(iBanner(page, id), null, `${id} 跟着隔壁一起塌了`);
  }
  // 别块该照旧生成：四块各点一次，一张表都不许少
  for (const id of ['idcard', 'bankcard', 'mobile', 'random']) {
    assert.equal(m.wb.run(id, 'gen'), true, `${id} 被隔壁的失败拖坏了`);
    assert.match(page.html(id, 'gen'), /共 5 条/);
  }
  // 塌掉那一块也不是绝症：改回合法字符再按一次，错误条自己撤
  page.set('uscc', 'registry', 'A');
  page.change('uscc', 'registry');
  page.click('uscc', 'gen');
  assert.deepEqual(page.ws.brokenIds(), []);
  assert.equal(iBanner(page, 'uscc'), null);
  for (const c of m.wb.copyTextOf('uscc', 'gen').split('\n')) {
    assert.equal(c[0], 'A', `${c}：改回去的登记管理部门码没落到代码上`);
  }

  // 数量格的两句话：空、和不是 1–50 的整数。都是提示行，一块面板都不许因此标坏
  for (const [raw, line] of [
    ['', `^<p class="tk-hint">数量这一格是空的，填 1–${GENERATE_MAX} 之间的整数`],
    ['999', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「999」`],
    ['0', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「0」`],
    ['2.5', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「2.5」`],
  ]) {
    page.set('idcard', 'count', raw);
    page.click('idcard', 'gen');
    const h = page.html('idcard', 'gen');
    assert.match(h, new RegExp(line), `「${raw}」这一档的文案对不上`);
    assert.equal(h.includes('tk-count'), false, `「${raw}」一条都没生成，别报"共 N 条"`);
    assert.deepEqual(page.ws.brokenIds(), [], `「${raw}」是用户填错了，不是这块面板坏了`);
    assert.equal(page.copy('idcard', 'gen').disabled, true);
  }
  page.set('idcard', 'count', '3');
  page.click('idcard', 'gen');
  assert.match(page.html('idcard', 'gen'), /共 3 条/);

  // 位数那一格同一档：越界要说清是哪一格、范围是多少，不许静默当成"没填"（那一档等于
  // 把用户明确填的 20 变成"按行别登记位数随机"，屏幕上还一切正常）。走的是 `intOf` 同一条路。
  for (const [raw, line] of [
    ['20', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「20」`],
    ['12', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「12」`],
    ['13.5', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「13.5」`],
  ]) {
    page.set('bankcard', 'length', raw);
    page.click('bankcard', 'gen');
    const h = page.html('bankcard', 'gen');
    assert.match(h, new RegExp(`^<p class="tk-hint">${line}。`), `位数「${raw}」这一档的文案对不上`);
    assert.equal(h.includes('tk-count'), false, `位数「${raw}」一条都没生成，别报"共 N 条"`);
    assert.deepEqual(page.ws.brokenIds(), [], `位数「${raw}」是用户填错了，不是这块面板坏了`);
    assert.equal(page.copy('bankcard', 'gen').disabled, true);
  }
  // 清空即回到"按行别登记位数"：这句话管的是越界，不是"填了就不许改回去"
  page.set('bankcard', 'length', '');
  page.click('bankcard', 'gen');
  assert.match(page.html('bankcard', 'gen'), /共 5 条/, '清掉位数之后这块面板该照常出表');
});

test('J9 派生 id 的五种形状与那份清单的自洽（骨架与 Task 9 的账都靠它）', () => {
  // 形状逐条钉死：`tools-idcard.html`（仓库根，permalink 才是 `/tools/idcard.html`）里的
  // id 必须长成这五个样子之一
  assert.equal(fieldId('tk', 'idcard', 'birth'), 'tk-in-idcard-birth');
  assert.equal(buttonId('tk', 'idcard', 'gen'), 'tk-btn-idcard-gen');
  assert.equal(copyId('tk', 'uscc', 'read'), 'tk-copy-uscc-read');
  assert.equal(outId('tk', 'mobile', 'gen'), 'tk-out-mobile-gen');
  assert.equal(whenId('tk', 'random', 'addr'), 'tk-when-random-addr');

  const c = controlIds('tk');
  assert.deepEqual(PANEL_IDS, Object.keys(WORKBENCH_SPEC), '面板清单与 spec 的键不是同一份');
  assert.deepEqual(PANEL_IDS, ['idcard', 'uscc', 'bankcard', 'mobile', 'random'],
    '面板顺序就是索引条顺序，改了要连带改骨架与 yml');

  // 五份清单合起来不许有重复 id：真 DOM 里同名两个节点，`getElementById` 只认第一个
  const all = [...c.in, ...c.btn, ...c.copy, ...c.out, ...c.when];
  assert.equal(new Set(all).size, all.length, '派生 id 撞车了');
  assert.equal(all.every((id) => id.startsWith('tk-')), true, '每条 id 都得带前缀');
  // 按钮 / 复制 / 结果区三张一一对应：`random` 没有判定侧，所以是 5 + 4 = 9 而不是 10
  assert.deepEqual([c.btn.length, c.copy.length, c.out.length], [9, 9, 9]);
  const withRead = PANEL_IDS.filter((id) => WORKBENCH_SPEC[id].sides.read !== null);
  assert.equal(c.btn.length, PANEL_IDS.length + withRead.length);
  assert.deepEqual(c.when, [
    'tk-when-idcard-birth', 'tk-when-random-givelen', 'tk-when-random-addr', 'tk-when-random-domain',
  ], '受开关控制的字段组只有这四格');
  // 读侧上限与生成侧上限同档（口径 4 的那句话），且四块面板各有且只有一条粘贴框
  assert.equal(MAX_READ_LINES, GENERATE_MAX, '读侧与生成侧不该各长一个上限');
  assert.equal(withRead.length, 4);
  assert.equal(c.in.filter((id) => /-read$/.test(id)).length, 4);

  // 夹具自证（口径 3 的代价清单）：清单里每一条 id 在骨架上都得有节点
  const page = jPage();
  for (const id of all) assert.ok(page.doc.getElementById(id), `清单说有 ${id}，骨架上却没有`);
});

test('J10 换前缀是整套换：行为一位不改，旧前缀一个节点都不留', () => {
  const jt = jMount({ prefix: 'jt' });
  assert.deepEqual(jt.report.broken, [], '换了前缀就不该有面板挂不上');
  assert.deepEqual(jt.report.missing, []);
  // 清单跟着换：`controlIds('jt')` 的每一条都在骨架上，且逐条等于 tk 那套换个前缀
  const a = controlIds('jt');
  const b = controlIds('tk');
  for (const group of Object.keys(a)) {
    assert.deepEqual(a[group], b[group].map((id) => `jt-${id.slice(3)}`), `${group} 这一份没跟着换`);
    for (const id of a[group]) assert.ok(jt.page.doc.getElementById(id), `缺 ${id}`);
  }
  // 旧前缀不残留：节点表里一条 `tk-` 开头的 id 都不许有（面板框架与装配层共用同一只前缀）
  assert.deepEqual([...jt.page.nodes.keys()].filter((id) => id.startsWith('tk-')), []);
  // 前缀只是地址，不是行为输入：同一颗随机源下两套前缀生出的号码必须一模一样
  const tk = jMount({ prefix: 'tk' });
  for (const id of PANEL_IDS) {
    assert.equal(jt.wb.copyTextOf(id, 'gen'), tk.wb.copyTextOf(id, 'gen'), `${id} 换了前缀就换了内容`);
  }
  jt.page.click('bankcard', 'read');
  assert.match(jt.page.html('bankcard', 'read'), /<p class="tk-hint">粘贴框里还没有号码/,
    '提示行的类名是样式钩子，不跟着前缀换（`toolkit.scss` 只有一份）');
});

test('J11 事件接线：Enter 接在数字与日期上，判定走组合键，裸 Enter 还是换行', () => {
  const m = jMount();
  const { page } = m;
  let pd = 0;
  const ev = (key, extra = {}) => ({ key, preventDefault: () => { pd += 1; }, ...extra });

  // ① 数量格里的裸 Enter = 按一次生成按钮：走的是同一条闸门、同一个回调
  page.set('idcard', 'count', '2');
  const before = m.guarded.length;
  page.keyOn('idcard', 'count', ev('Enter'));
  assert.equal(m.guarded.length, before + 1, '一次按键只该走一次闸门，监听器不许叠加');
  assert.equal(m.guarded[m.guarded.length - 1], 'idcard');
  assert.match(page.html('idcard', 'gen'), /共 2 条/, 'Enter 之后画的就是刚改的那个数量');
  assert.equal(pd, 1, '默认行为（提交表单 / 换行）要被挡住');

  // ② 带任何修饰键的 Enter 都不算"我要生成"
  for (const mod of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
    const n = m.guarded.length;
    page.keyOn('idcard', 'count', ev('Enter', { [mod]: true }));
    assert.equal(m.guarded.length, n, `${mod} + Enter 不该触发生成`);
  }
  assert.equal(pd, 1, '不触发就不该顺手 preventDefault');
  // 别的键也不算
  const n1 = m.guarded.length;
  page.keyOn('idcard', 'count', ev('a'));
  assert.equal(m.guarded.length, n1);

  // ③ 日期格同档：填完日期直接回车就该出结果
  page.set('idcard', 'ageband', 'custom');
  page.change('idcard', 'ageband');
  page.set('idcard', 'birth', '1990-05-06');
  page.keyOn('idcard', 'birth', ev('Enter'));
  assert.match(page.html('idcard', 'gen'), /共 2 条/);
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', '日期格里按回车，日期得真的落进号码');
  }
  // ④ 下拉里的 Enter 没有"提交"语义：焦点停在省格回车，不许变成"点了一次生成"
  const n2 = m.guarded.length;
  const pdBefore = pd;
  page.keyOn('idcard', 'province', ev('Enter'));
  page.keyOn('random', 'kind', ev('Enter'));
  assert.equal(m.guarded.length, n2, '级联下拉里回车就是回车');
  assert.equal(pd, pdBefore, '不触发的按键不该顺手把默认行为挡掉');

  // ⑤ 粘贴框：Ctrl / ⌘ + Enter 判定，裸 Enter 留给换行
  page.set('idcard', 'read', mk('11010119900307001'));
  const n3 = m.guarded.length;
  page.keyOn('idcard', 'read', ev('Enter'));
  assert.equal(m.guarded.length, n3, '裸 Enter 在多行框里必须是换行');
  assert.equal(pd, pdBefore, '多行框里的裸回车要留给换行，挡它就是缺陷');
  page.keyOn('idcard', 'read', ev('Enter', { ctrlKey: true }));
  assert.equal(m.guarded.length, n3 + 1);
  assert.equal(m.guarded[m.guarded.length - 1], 'idcard');
  // 挡住了默认动作才算这一次按键"是命令不是换行"：不 preventDefault，多行框里会同时
  // 插入一个换行符（用户每按一次判定，输入内容就多一行空白）
  assert.equal(pd, pdBefore + 1, 'Ctrl + Enter 触发了判定，就得把默认动作（换行）挡掉');
  assert.match(page.html('idcard', 'read'), /第 1 行/);
  page.keyOn('idcard', 'read', ev('Enter', { metaKey: true }));
  assert.equal(m.guarded.length, n3 + 2, 'macOS 的 ⌘ + Enter 同档');
  assert.equal(pd, pdBefore + 2, '⌘ + Enter 同一条路，也别漏 preventDefault');

  // ⑥ `change` 上挂的是级联 + 开关那两件事；uscc 没有县格，重建下游时对不存在的格子静默
  assert.doesNotThrow(() => { page.set('uscc', 'province', '32'); page.change('uscc', 'province'); });
  assert.equal(page.ctl('uscc', 'city').childNodes.length, 1 + currentCityCodes('32').length);
  assert.equal(page.ctl('uscc', 'county'), null, '夹具自证：uscc 的 spec 里本来就没有县格');
  // ⑦ 主按钮与复制按钮各就各位：点判定按钮走的是与 Enter 同一条路
  const n4 = m.guarded.length;
  page.click('uscc', 'gen');
  assert.equal(m.guarded.length, n4 + 1);
  assert.equal(m.guarded[m.guarded.length - 1], 'uscc');
  assert.equal(page.ctl('random', 'domain').disabled, false, '没打标记的格子不该被级联禁用');
});

test('J12 toolkitCore 只把框架层那四只挂成 `window.Tk`，业务模块不下沉', async () => {
  const mod = { ns: null };
  globalThis.window = {};
  try {
    mod.ns = await import('../dev/js/toolkitCore.js?j12');
    const tk = globalThis.window.Tk;
    assert.deepEqual(Object.keys(tk).sort(), ['createPanelDom', 'createPanelWorkspace', 'ui', 'view'],
      '口径 1：只挂这四个名字，不顺手暴露别的（段 3 Task 5 起 `ui` 是第四只，§O13 与这里必须同步）');
    assert.equal(tk.createPanelWorkspace, createPanelWorkspace, '挂的必须是 §D 判过的那一只');
    assert.equal(tk.createPanelDom, createPanelDom, '挂的必须是 §I 判过的那一只');
    assert.equal(tk.view.batchBlock, J_VIEW.batchBlock, 'view 必须是 §H 判过的那一份');
    assert.equal(typeof tk.view.parseBlock, 'function');
    assert.equal(tk.ui.copyInto, J_UI.copyInto, 'ui 必须是 §O 判过的那一份：两页共用同一只兜底，不许各长一份');
    assert.equal('parseIdCard' in tk, false, '口径 3：业务模块走 workbench 内联，不下到共用层');
    assert.equal('generateUsccCodes' in tk, false);
    assert.equal(tk.version, undefined, '不加版本号：将来扩面是显式改动');
    // 顶层不 export：产物被 `(function(){…})();` 包住，函数体里的 export 是语法错误
    assert.deepEqual(Object.keys(mod.ns), [], 'toolkitCore 一条 export 都不许有');
  } finally {
    delete globalThis.window;
  }
});

test('J13 骨架缺一格：缺结果区与缺 tab 标坏这一块，缺复制按钮不该牵连内容', () => {
  // ① 缺结果区：这块面板没法交付内容，标坏，且只标坏这一块
  const a = jMount({ drop: ['tk-out-uscc-gen'] });
  assert.deepEqual(a.report.broken, ['uscc']);
  assert.deepEqual(a.report.missing, [], 'tab 与 panel 两半都在，不算骨架不完整');
  assert.deepEqual(a.report.rendered, PANEL_IDS.filter((id) => id !== 'uscc'));
  assert.equal(a.page.html('uscc', 'gen'), '', '没有地方放内容，就不该凭空生成一份');
  assert.match(a.page.ws.brokenOf('uscc'), /tk-out-uscc-gen/);
  assert.match(iBanner(a.page, 'uscc').textContent, /其余面板不受影响/);
  for (const id of PANEL_IDS) {
    if (id === 'uscc') continue;
    assert.match(a.page.html(id, 'gen'), /共 5 条/, `${id} 被隔壁缺的一格拖坏了`);
  }
  // 一崩崩的是**一块面板**而不是一栏：一块面板只有一个渲染函数，先画生成侧，
  // 所以生成侧画不出来时判定侧那句提示也跟着没画。反过来缺判定侧的结果区，
  // 生成侧那张表已经画上——塌的范围就是渲染函数的执行顺序，本节把它如实钉下来。
  assert.equal(a.page.html('uscc', 'read'), '', '渲染函数在生成侧就抛了，判定侧没轮到画');
  const a2 = jMount({ drop: ['tk-out-uscc-read'] });
  assert.deepEqual(a2.report.broken, ['uscc']);
  assert.match(a2.page.html('uscc', 'gen'), /共 5 条/, '抛错之前画好的生成侧不许被拖没');
  assert.equal(a2.page.html('uscc', 'read'), '');
  assert.match(a2.page.ws.brokenOf('uscc'), /tk-out-uscc-read/);

  // ② 缺 tab：这一块切不到，渲染函数干脆不跑（凭空画一份只是把缺陷藏起来）
  const b = jMount({ drop: ['tk-tab-idcard'] });
  assert.deepEqual(b.report.missing, ['idcard']);
  assert.deepEqual(b.report.broken, ['idcard']);
  assert.deepEqual(b.report.rendered, PANEL_IDS.filter((id) => id !== 'idcard'));
  assert.equal(b.page.html('idcard', 'gen'), '');
  assert.equal(b.page.copy('idcard', 'gen').disabled, true, '没渲染过，复制按钮该停在骨架的禁用态');
  // 它仍然是"当前那一块"（hash 空 → 第一块），只是没有内容可看——错误条就是用户唯一看得见的说明。
  assert.deepEqual(iVisible(b.page), ['idcard']);
  assert.match(iBanner(b.page, 'idcard').textContent, /tk-tab-idcard/);
  // 互锁对它照样生效：切走之后它的 `hidden` 被人覆写了，不会留下一块永远显示的面板
  b.page.tab('mobile').dispatch('click', {});
  assert.deepEqual(iVisible(b.page), ['mobile'], '缺 tab 那块还赖在可见位上');
  for (const id of ['uscc', 'bankcard', 'random']) {
    assert.match(b.page.html(id, 'gen'), /共 5 条/);
  }

  // ③ 缺复制按钮：内容照样能看，不该因此把面板判坏（`syncCopy` 找不到按钮就静默返回）
  const c = jMount({ drop: ['tk-copy-idcard-gen'] });
  assert.deepEqual(c.report.broken, [], '复制按钮缺失不影响这一块的交付');
  assert.equal(c.page.copy('idcard', 'gen'), null);
  assert.match(c.page.html('idcard', 'gen'), /共 5 条/);
  assert.doesNotThrow(() => c.page.click('idcard', 'gen'), '再点一次生成也不该因为没按钮而抛');
  assert.equal(c.wb.copyTextOf('idcard', 'gen').split('\n').length, 5, '复制文本照旧备着，别人接上去就能用');

  // ④ 开关的目标段没了（骨架漏写一格 `tk-when-*`）：少一段显隐，不该把整块面板送进 broken
  const d = jMount({ drop: ['tk-when-idcard-birth'] });
  assert.deepEqual(d.report.broken, [], '缺的是包着日期格的那段 <p>，不是交付内容的地方');
  assert.equal(d.page.whenNode('idcard', 'birth'), null, '夹具自证：这一格本来就没建');
  assert.doesNotThrow(() => {
    d.page.set('idcard', 'ageband', 'custom');
    d.page.change('idcard', 'ageband');
  }, 'applySwitch 撞上缺节点就抛，用户切档时这块面板当场进 broken 名单');
  // 日期格还在，值照样进号码：显隐少一段 ≠ 这一格不能填
  d.page.set('idcard', 'birth', '1990-05-06');
  d.page.click('idcard', 'gen');
  assert.match(d.page.html('idcard', 'gen'), /共 5 条/);
  for (const id of d.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', '缺一段显隐容器，不该牵连生成');
  }
  assert.deepEqual(d.page.ws.brokenIds(), [], '按过一次生成也不该因此标坏');
  // 别块的开关照旧生效：`#random-kind` 换档，三段该现的现、该藏的藏
  d.page.set('random', 'kind', 'address');
  d.page.change('random', 'kind');
  assert.equal(d.page.whenNode('random', 'addr').hidden, false);
  assert.equal(d.page.whenNode('random', 'givelen').hidden, true);
  assert.equal(d.page.whenNode('random', 'domain').hidden, true);
});

test('J14 动态文本一律过 `esc`，源码里那三条红线一条都不许断', () => {
  const m = jMount();
  const { page } = m;
  // ① 粘贴框把原样字符回显出来：那里头可能是任何文本，不许被当成 HTML 解析
  const evil = '<img src=x onerror=alert(1)>';
  page.set('idcard', 'read', [evil, mk('11010119900307001')].join('\n'));
  page.click('idcard', 'read');
  const h = page.html('idcard', 'read');
  assert.equal(h.includes('<img'), false, '原样回显漏了转义，粘进来的一行就能挂脚本');
  assert.equal(h.includes('&lt;img src=x onerror=alert(1)&gt;'), true, '要转义，但也要看得见原样');
  assert.match(h, /第 1 行/);

  // ② 提示行会把用户填的那一格原样带进句子里，那一句同样只许是文本
  page.set('idcard', 'count', '<script>alert(1)</script>');
  page.click('idcard', 'gen');
  const hint = page.html('idcard', 'gen');
  assert.equal(hint.includes('<script'), false, 'FieldError 的 message 拼进结果区前必须过 esc');
  assert.match(hint, /^<p class="tk-hint">数量应为 1–\d+ 的整数，现在这格是「&lt;script&gt;alert\(1\)&lt;\/script&gt;」。/);

  // ③ 三条源码红线：这一层的 HTML 出口只有一处，找节点只按派生 id，跨页共用的四本不许 import
  const src = read('dev/js/tools/workbench.js');
  assert.equal(jCount(src, '.innerHTML ='), 1, 'innerHTML 只许出现在 paint() 一处');
  assert.equal(src.includes('querySelector('), false, '控件一律按派生 id 找：querySelector 会绕过前缀与 spec 这套账');
  for (const shared of ['./panel.js', './panel-dom.js', './view.js', './ui.js']) {
    assert.equal(src.includes(`from '${shared}'`), false,
      `workbench.js 不许 import ${shared}：两个入口 reach 同一模块就成共享 chunk，产物当场变废文件`);
  }
  // 两个入口文件都不许有顶层 export：它们各自是独立产物，却被同一个 IIFE 包法包住
  for (const f of ['dev/js/toolkitCore.js', 'dev/js/toolIdcard.js']) {
    assert.equal(/^export /m.test(read(f)), false, `${f} 是入口，顶层 export 在产物里是语法错误`);
  }
  // 产物里真不许有 `import{`：判据在 Task 9 对账构建产物，这里先钉住"入口只有这两个"
  assert.equal(/^export /m.test(src), true, 'workbench.js 不是入口：它必须还能被入口 import');
});

test('J15 整栏通用的那几句口径：栏尾说一次，逐行的结论留在行里', () => {
  const m = jMount();
  const { page } = m;
  const last = (h) => h.lastIndexOf('</section>');

  // ① 银行卡：常量 caveat 摘到栏尾一次，五十行也不该五十遍
  const cards = generateBankCards({ count: 3, rng: seededRandom(J_SEED + 2) }).map((r) => r.number);
  page.set('bankcard', 'read', [...cards, '1234'].join('\n'));
  page.click('bankcard', 'read');
  let h = page.html('bankcard', 'read');
  assert.equal(jCount(h, BANK_CAVEAT), 1, '同一句话每行说一遍，等于没说');
  assert.ok(last(h) < h.indexOf(BANK_CAVEAT), '整栏口径要排在逐行结果之后');
  assert.equal(jCount(h, '<section class="tk-line">'), 4);

  // ② 手机号：caveat 与 note 两条各一次，且都在最后一行之后
  const nums = generateMobiles({ count: 2, rng: seededRandom(J_SEED + 3) }).map((r) => r.number);
  page.set('mobile', 'read', [...nums, '10000000000'].join('\n'));
  page.click('mobile', 'read');
  h = page.html('mobile', 'read');
  assert.equal(jCount(h, MOBILE_CAVEAT), 1);
  assert.equal(jCount(h, CARRIER_NOTE), 1);
  assert.ok(last(h) < h.indexOf(MOBILE_CAVEAT));
  assert.ok(last(h) < h.indexOf(CARRIER_NOTE));

  // ③ 身份证的 caveat 随号码而变，摘错了就是把结论从号码旁边搬走：它必须留在自己那一行里
  const good = mk('11010119900307001');
  const hist = mk('11010319900307001');
  page.set('idcard', 'read', [good, hist].join('\n'));
  page.click('idcard', 'read');
  h = page.html('idcard', 'read');
  const dyn = '该区划未见于现行区划表';
  assert.equal(jCount(h, dyn), 1, '动态 caveat 只该出现在它那一行');
  assert.ok(h.indexOf(dyn) < last(h), '动态 caveat 留在行内，不许被提到栏尾');
  assert.ok(h.indexOf(dyn) > h.indexOf('第 2 行'), '而且要贴着它所属的那一行，不是贴到第 1 行去');
  assert.equal(h.includes(USE_NOTE), false, '身份证读侧不补整栏句：它的 caveat 随号码而变，没有可上墙的那一句');

  // ④ 信用代码：转大写那句是动态的留在行内，`REFERENCE_NOTE` 是整栏的排在栏尾
  const code = generateUsccCodes({ count: 1, rng: seededRandom(J_SEED + 4) })[0].code;
  page.set('uscc', 'read', [code.toLowerCase(), 'x'].join('\n'));
  page.click('uscc', 'read');
  h = page.html('uscc', 'read');
  assert.equal(jCount(h, '已按 31 字符集转大写后判定'), 1);
  assert.ok(h.indexOf('已按 31 字符集转大写后判定') < last(h), '这句是关于第 1 行的，不能上墙');
  assert.equal(jCount(h, REFERENCE_NOTE), 1);
  assert.ok(last(h) < h.indexOf(REFERENCE_NOTE));

  // ⑤ 生成侧：每栏的口径行各一次，不因为表里有五行就重复五遍
  const gen = {
    idcard: [USE_NOTE], uscc: [USCC_USE_NOTE], bankcard: [BANK_CAVEAT],
    mobile: [MOBILE_CAVEAT, CARRIER_NOTE], random: [RANDOM_CAVEAT, NAME_NOTE],
  };
  for (const [panel, notes] of Object.entries(gen)) {
    const g = page.html(panel, 'gen');
    for (const note of notes) assert.equal(jCount(g, note), 1, `${panel} 生成侧的口径句重复了`);
  }
});

test('J16 入口只读骨架那四格数据；启动失败不装死，成功路径把两条 <script> 接起来', async () => {
  /**
   * 入口文件在 import 的那一刻就 `start(document, window)`，所以每一档都得：
   * 先把 `globalThis.document` / `globalThis.window` 摆好，再换一个 **查询串** 去 import
   * （同一 URL 只执行一次），最后把两个全局摘干净。`toolkitCore.js` 与入口用同一个查询串，
   * 于是真核心把 `Tk` 挂到我给的 window 上，入口再从我给的 document 里找节点。
   */
  const run = async (tag, page, fn) => {
    globalThis.document = page.doc;
    globalThis.window = Object.assign({}, page.win, {
      location: page.location, history: page.history, navigator: {},
    });
    try {
      return await fn(tag);
    } finally {
      delete globalThis.document;
      delete globalThis.window;
    }
  };
  const withCore = (tag) => import(`../dev/js/toolkitCore.js?j16-${tag}`);

  // ── 成功：两条 script 的先后接对了，页面就是它该有的样子 ──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', {
      'data-tk-ids': PANEL_IDS.join(', '), 'data-tk-prefix': 'tk',
      'data-tk-label': '证件与常用信息', 'data-tk-notice': 'tk-notice',
    });
    await run('ok', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolIdcard.js?j16-${tag}`);
      for (const id of PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab', `${id} 没被升级成 tab`);
      }
      assert.match(page.html('idcard', 'gen'), /共 5 条/, '骨架的 count=5 该在挂载期就画上');
      assert.equal(page.copy('idcard', 'gen').disabled, false);
      assert.equal(page.notice.hidden, true, '启动成功就别留提示行');
      // 口径 2 的晚绑：按钮回调拿到的是 `createPanelDom().run` 而不是那只占位函数
      page.set('idcard', 'count', '2');
      page.btn('idcard', 'gen').dispatch('click', {});
      assert.match(page.html('idcard', 'gen'), /共 2 条/, '按了没反应＝占位函数还在位上');
      // hashchange 接在 window 上：地址栏换面板，入口这一层负责把两边接起来
      page.location.hash = '#mobile';
      page.win.dispatch('hashchange', {});
      assert.deepEqual(iVisible(page), ['mobile']);
      assert.equal(page.tab('mobile').getAttribute('aria-selected'), 'true');
    });
  }

  // ── 失败一档：容器都没有（脚本被挪进 <head> 就是这个形状）──
  {
    const page = jPage();
    await run('nocontainer', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /tk-workspace/);
      assert.equal(page.notice.hidden, false, '启动失败必须留下一句能抄下来问人的话');
      assert.match(page.notice.textContent, /这一页的交互层没能启动/);
      assert.match(page.notice.textContent, /tk-workspace/);
      assert.match(page.notice.textContent, /正文仍然读得到/);
    });
  }

  // ── 失败二档：容器在，`data-tk-ids` 是空的（yml 漏了 slug）──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', { 'data-tk-ids': ' , ', 'data-tk-prefix': 'tk' });
    await run('emptyids', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /data-tk-ids/);
      assert.match(page.notice.textContent, /onlineTools\.yml/);
    });
  }

  // ── 失败三档：`window.Tk` 没挂上来（core 404 或排在入口之后）──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', { 'data-tk-ids': PANEL_IDS.join(','), 'data-tk-prefix': 'tk' });
    await run('notk', page, async (tag) => {
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /window\.Tk/);
      assert.match(page.notice.textContent, /toolkitCore\.min\.js/);
      // 这一档最像"禁了脚本"：正文与骨架节点一个不少，只是没人接线
      assert.equal(page.tab('idcard').getAttribute('role'), 'link', '框架层没跑，骨架的 role 原样留着');
      assert.equal(page.html('idcard', 'gen'), '');
    });
  }

  // ── 换前缀：骨架写 `data-tk-prefix: zx`，行为那副面孔就得整套跟着换（容器 id 仍归本页自己）──
  //     这一档盯的是"页面地址"与"行为前缀"分家这件事（口径 1）：写死 `tk` 的入口在证件页
  //     看起来一切正常，拿到 JSON 页（`jt`）就是一整页找不到节点。
  {
    const page = jPage({ prefix: 'zx' });
    page.mk('div', 'tk-workspace', {
      'data-tk-ids': PANEL_IDS.join(','), 'data-tk-prefix': 'zx', 'data-tk-notice': 'zx-notice',
    });
    await run('zx', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolIdcard.js?j16-${tag}`);
      for (const id of PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab',
          `${id} 没被升级成 tab：绑定层找的是 tk-tab-*，骨架写的是 zx-tab-*`);
      }
      assert.match(page.html('idcard', 'gen'), /共 5 条/, 'zx 前缀下找不到结果区，等于什么都没画');
      assert.equal(page.copy('idcard', 'gen').disabled, false);
      page.set('idcard', 'count', '2');
      page.btn('idcard', 'gen').dispatch('click', {});
      assert.match(page.html('idcard', 'gen'), /共 2 条/);
      assert.equal(page.notice.hidden, true, '这一档是成功路径，不该留提示行');
    });
  }

  // ── 容器在，但它读不到属性：要报"哪一格、往哪儿查"，不能把裸 TypeError 丢出去 ──
  //     `start()` 的兜底写的就是这一格，所以这一档同时判"失败的那句话仍然落在页面上"。
  {
    const page = jPage();
    const box = page.mk('div', 'tk-workspace', { 'data-tk-ids': PANEL_IDS.join(',') });
    delete box.getAttribute;
    await run('noattr', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /tk-workspace/,
        'TypeError 里既没有容器 id 也没有排查方向，抄下来问不到人');
      assert.match(page.notice.textContent, /两条 <script>/,
        '这一档最像"脚本顺序错了"，那句话就得指向脚本顺序');
    });
  }
});

test('J7 复制三级兜底：clipboard → 临时 textarea + execCommand → 一句"请手动选中"', async () => {
  /**
   * 兜底造出来的那些临时框：骨架里 4 条粘贴框是 `<textarea>` 但没有 `readonly`，
   * `legacyCopy` 那一条有——用属性把它们分开数，不靠"造了几个节点"猜。
   * @param {object} page 夹具
   * @returns {object[]} 临时框清单
   */
  const boxes = (page) => page.made.filter((e) => e.tagName === 'TEXTAREA'
    && e.getAttribute('readonly') === 'readonly');

  // ── (a) 首选 `navigator.clipboard`：不碰 execCommand，也不往 body 上挂东西 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
    m.page.clickCopy('idcard', 'gen');
    await jSettle();
    assert.deepEqual(writes, [m.wb.copyTextOf('idcard', 'gen')], '复制的内容是这一栏那份纯文本，不是 HTML');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    assert.equal(m.timers.length, 1, '改口要能改回来，就得留下一条恢复用的定时器');
    assert.equal(m.timers[0].ms, 1600);
    assert.deepEqual(m.page.commandLog, [], '这一级根本不需要 execCommand');
    assert.equal(m.page.doc.body.childNodes.length, 0, '走剪贴板就不该在页面上长出临时输入框');
    m.flush();
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制这批号码', '改回的是骨架里那句原文案');
  }

  // ── (b) 剪贴板被拒 → 退到临时 textarea + execCommand，用完立刻摘掉 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.reject(new Error('NotAllowedError')); } } });
    m.page.clickCopy('uscc', 'gen');
    await jSettle();
    assert.equal(writes.length, 1, '先试过剪贴板，退路才是 execCommand');
    assert.deepEqual(m.page.commandLog, ['copy']);
    assert.equal(m.page.selLog.length, 1, '复制之前要把临时框选中');
    assert.equal(m.page.selLog[0].value, m.wb.copyTextOf('uscc', 'gen'));
    assert.equal(m.page.selLog[0].tagName, 'TEXTAREA');
    assert.equal(boxes(m.page).length, 1, '兜底只该造一条临时框');
    assert.equal(boxes(m.page)[0], m.page.selLog[0], '选中、复制、摘掉的是同一条临时框');
    assert.equal(m.page.doc.body.childNodes.length, 0, '用完必须从 body 上摘掉：留在页里就是一个能被 Tab 走到的隐形输入框');
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '已复制', '兜底成功了就别报失败');
  }

  // ── (c) 没有 clipboard（http 页面）→ 直接走兜底 ──
  {
    const m = jMount();
    m.page.clickCopy('bankcard', 'gen');
    assert.deepEqual(m.page.commandLog, ['copy'], '没有 navigator.clipboard 时不该什么都不做');
    assert.equal(jLabel(m.page, 'bankcard', 'gen'), '已复制');
  }

  // ── (d) 兜底也说"不行"：一句失败文案，恢复时长比成功那句长 ──
  {
    const m = jMount();
    m.page.doc.copyOk = false;
    m.page.clickCopy('mobile', 'gen');
    assert.equal(jLabel(m.page, 'mobile', 'gen'), '复制失败，请手动选中');
    assert.equal(m.timers[0].ms, 2600, '失败那句要给人时间读完');
    assert.equal(m.timers[0].ms > 1600, true);
    m.flush();
    assert.equal(jLabel(m.page, 'mobile', 'gen'), '复制这批号码');
    assert.equal(m.page.doc.body.childNodes.length, 0, '连失败都不许留下临时框');
  }

  // ── (e) 兜底自己抛错（`execCommand` 在个别浏览器里会抛）：不塌页面，也不留节点 ──
  {
    const m = jMount();
    m.page.doc.execCommand = () => { throw new Error('boom'); };
    assert.doesNotThrow(() => m.page.clickCopy('idcard', 'gen'),
      '任何一级抛到页面外面，用户看到的就是"按了没反应"');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制失败，请手动选中');
    assert.equal(m.page.doc.body.childNodes.length, 0, '抛错那条路也要摘掉临时框');
    assert.equal(boxes(m.page).length, 1);
  }

  // ── (f) `writeText` 同步抛错与异步拒绝同一条路 ──
  {
    const m = jMount({ clipboard: { writeText: () => { throw new Error('SecurityError'); } } });
    assert.doesNotThrow(() => m.page.clickCopy('random', 'gen'));
    await jSettle();
    assert.deepEqual(m.page.commandLog, ['copy'], '同步抛错也要退到 execCommand');
    assert.equal(jLabel(m.page, 'random', 'gen'), '已复制');
  }

  // ── (g) 没内容就别动剪贴板：可用与否由那份纯文本说话，不由 disabled 猜 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
    assert.equal(m.page.copy('idcard', 'read').disabled, true, '判定栏还没内容，按钮是禁用的');
    m.page.clickCopy('idcard', 'read');
    await jSettle();
    assert.deepEqual(writes, [], '空文本一次都不该写');
    assert.deepEqual(m.page.commandLog, []);
    assert.equal(m.timers.length, 0, '什么都没复制，就别改口');
    assert.equal(jLabel(m.page, 'idcard', 'read'), '复制判定有效的号码');
    // 粘进去判一次，这一栏的复制件只装判定有效的那几条
    const good = mk('11010119900307001');
    const bad = good[17] === '9' ? `${good.slice(0, 17)}8` : `${good.slice(0, 17)}9`;
    m.page.set('idcard', 'read', [good, bad].join('\n'));
    m.page.click('idcard', 'read');
    assert.equal(m.page.copy('idcard', 'read').disabled, false);
    m.page.clickCopy('idcard', 'read');
    await jSettle();
    assert.deepEqual(writes, [good], '判定无效的那一条不该跟着被复制走');
  }

  // ── (h) 改口期间再按一次：原文案取自挂载时记下的那份，不是当前那句"已复制" ──
  {
    const m = jMount();
    m.page.clickCopy('idcard', 'gen');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    m.page.clickCopy('idcard', 'gen');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    assert.equal(m.timers.length, 2, '两次点击各留一条恢复用的定时器');
    m.flush();
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制这批号码',
      '把"已复制"当成原文案存下来，按钮就会永远停在改口状态');
  }

  // ── (i) 连 `execCommand` 都没有（个别环境把 document 裁过）：这一级算失败，不许当成功 ──
  {
    const m = jMount();
    m.page.doc.execCommand = undefined;
    m.page.clickCopy('uscc', 'gen');
    assert.deepEqual(m.page.commandLog, [], '没有 `execCommand` 就不该假装调用过它');
    assert.equal(m.page.selLog.length, 1, '临时框照样选中：这一级的失败要留一条能被手动 Ctrl+C 的框');
    assert.equal(boxes(m.page).length, 1);
    assert.equal(m.page.doc.body.childNodes.length, 0, '这一级也要在 finally 里摘掉临时框');
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '复制失败，请手动选中',
      '没复制上却说"已复制"，用户粘出来才发现是空的——这是这一节最不该有的结果');
    assert.equal(m.timers[0].ms, 2600, '走的是失败那一句的恢复时长');
    m.flush();
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '复制这批代码');
  }
});

// ── §K 时间戳 ⇄ 日期换算（`tools/time.js`，段 3 Task 1）─────────────────────
//（这一格的模块只干两件事：**判档而不猜档**、**不读运行环境**。所以本节的期望值全部可以
//  拿 `date -u` 独立复算——每个硬编码的 ISO 串旁边注了它的秒数锚点，复算命令一并写进
//  `dev/js/tools/time.js` 的文件头。判据编号 K1–K19 对齐计划 Task 1 的判据清单，
//  其中 **K19 不是 test()**：它是"把实现改坏、看哪几条红"的变异自证，写在计划 Task 1 Step 3。）
const { EPOCH_MS_LIMIT, MAX_INPUT_LEN, TIME_CAVEAT, dateDiff, fromEpoch,
  parseCivilDate, parseTimestamp, relativeTime } = await import('../dev/js/tools/time.js');

/** 去掉注释之后的 time.js 源码：K13 / K14 / K17 扫的是代码，不是文档里的自我声明 */
const kCode = () => read('dev/js/tools/time.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 递归找 NaN / Infinity：返回字段里出现任何一个，面板就会把 "NaN" 印给用户 */
const kBadNumbers = (v, seen = []) => {
  if (typeof v === 'number' && !Number.isFinite(v)) seen.push(v);
  else if (Array.isArray(v)) for (const x of v) kBadNumbers(x, seen);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) kBadNumbers(x, seen);
  return seen;
};
/** 报错消息里的入参回显：Symbol 与无原型对象都不能 String()（§C 末尾那条同一档） */
const kLabel = (v) => {
  if (typeof v === 'symbol' || typeof v === 'function') return typeof v;
  try { return String(v); } catch { return `unstringifiable ${typeof v}`; }
};

/**
 * K6 用的固定用例表。父进程与两个子进程跑的是**同一个数组**（序列化过去），
 * 所以"两边逐字节相同"这条比对不可能因为两份用例表漂移而假绿。
 */
const K_CASES = [
  { fn: 'parseTimestamp', args: ['0'] },
  { fn: 'parseTimestamp', args: ['1000000000'] },
  { fn: 'parseTimestamp', args: ['1000000000000'] },
  { fn: 'parseTimestamp', args: ['999999999'] },
  { fn: 'parseTimestamp', args: ['10000000000000'] },
  { fn: 'parseTimestamp', args: ['-2208988800000'] },
  { fn: 'parseTimestamp', args: ['1000000000.5'] },
  { fn: 'parseTimestamp', args: ['1_000_000_000'] },
  { fn: 'parseTimestamp', args: ['NaN'] },
  { fn: 'parseTimestamp', args: ['99999999999999999999'] },
  { fn: 'fromEpoch', args: [1709164800000, 480] },
  { fn: 'fromEpoch', args: [-1500, -840] },
  { fn: 'fromEpoch', args: [2147483647000, 0] },
  { fn: 'fromEpoch', args: [1709161200000, 690] },
  { fn: 'relativeTime', args: [1709164800000, 1709164859000] },
  { fn: 'relativeTime', args: [1709164800000 + 365 * 864e5, 1709164800000] },
  { fn: 'dateDiff', args: [1577750400000, 1609459200000] },
  { fn: 'dateDiff', args: [1704150000000, 1704157200000] },
  { fn: 'parseCivilDate', args: ['2024-02-29T00:00Z', 480] },
  { fn: 'parseCivilDate', args: ['2024-02-29 08:00:00+08:00', -840] },
  { fn: 'parseCivilDate', args: ['2023-02-29', 0] },
];
/** 子进程正文：不能带反引号，否则嵌进父进程的字符串字面量会先把这条判据炸掉 */
const K_CHILD = [
  'const t = await import(process.env.K_MOD);',
  'const cs = JSON.parse(process.env.K_CASES);',
  'const out = cs.map((c) => ({ fn: c.fn, args: c.args, r: t[c.fn](...c.args) }));',
  'process.stdout.write(JSON.stringify(out, null, 1));',
].join('\n');
/** 在指定 TZ 下把 K_CASES 全跑一遍，返回 stdout 原文 */
const kRunIn = (tz) => spawnSync(process.execPath,
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '--eval', K_CHILD],
  {
    encoding: 'utf8',
    env: {
      ...process.env, TZ: tz,
      K_MOD: new URL('../dev/js/tools/time.js', import.meta.url).href,
      K_CASES: JSON.stringify(K_CASES),
    },
  });

test('K1 十位判秒、十三位判毫秒，两种写法落到同一毫秒', () => {
  const s = parseTimestamp('1000000000');      // date -u -r 1000000000 → 2001-09-09T01:46:40Z
  assert.equal(s.verdict, 'second');
  assert.equal(s.epochMs, 1000000000000);
  assert.equal(s.reason, null);
  assert.deepEqual(s.readings, [], '判得出的档不许另附一份"两种解释"，那是 ambiguous 的形状');
  const m = parseTimestamp('1000000000000');
  assert.equal(m.verdict, 'milli');
  assert.equal(m.epochMs, 1000000000000);
  assert.equal(fromEpoch(1000000000000, 0).isoUtc, '2001-09-09T01:46:40Z');
  assert.equal(fromEpoch(s.epochMs, 0).isoUtc, fromEpoch(m.epochMs, 0).isoUtc);
});

test('K2 一位/九位/十一位/十二位不猜档：readings 恰两条、秒在前', () => {
  for (const text of ['5', '999999999', '10000000000', '100000000000']) {
    const r = parseTimestamp(text);
    assert.equal(r.verdict, 'ambiguous', text);
    assert.equal(r.epochMs, null, `${text}：不猜档就不能同时给一个"主答案"`);
    assert.equal(r.readings.length, 2, text);
    assert.deepEqual(r.readings.map((x) => x.kind), ['second', 'milli'], text);
    assert.equal(r.readings[0].epochMs, Number(text) * 1000, text);
    assert.equal(r.readings[1].epochMs, Number(text), text);
    assert.equal(r.readings[0].isoUtc, fromEpoch(r.readings[0].epochMs, 0).isoUtc, text);
    assert.ok(typeof r.reason === 'string' && r.reason.includes('位'), `${text}：不猜也要说为什么猜不出`);
    assert.deepEqual(kBadNumbers(r), []);
  }
  // 十四位是"按秒必然越界"的那一档：不猜 ≠ 硬给两条解释
  const v14 = parseTimestamp('10000000000000');
  assert.equal(v14.verdict, 'milli', '秒档解释越过了 EPOCH_MS_LIMIT，能留下的只有毫秒档');
  assert.equal(v14.epochMs, 10000000000000);
  assert.deepEqual(v14.readings, []);
});

test('K3 形状各档各有结论，NaN / Infinity 不许出现在任何返回字段', () => {
  const cases = [
    ['  1000000000  ', 'second', 1000000000000],
    ['-1000000000', 'second', -1000000000000],
    ['+1000000000', 'second', 1000000000000],
    ['1000000000.5', 'second', 1000000000500],
    ['1000000000.500', 'second', 1000000000500],
    ['1 000 000 000', 'invalid', null],
    ['1_000_000_000', 'invalid', null],
    ['0x3b9aca00', 'invalid', null],
    ['1e9', 'invalid', null],
    ['1000000000000.5', 'invalid', null],
    ['1000000000.5000', 'invalid', null],
    ['Infinity', 'invalid', null],
    ['-Infinity', 'invalid', null],
    ['NaN', 'invalid', null],
    ['', 'invalid', null],
    ['   ', 'invalid', null],
    ['--1000000000', 'invalid', null],
    ['1000000000-', 'invalid', null],
  ];
  for (const [text, verdict, epochMs] of cases) {
    const r = parseTimestamp(text);
    assert.equal(r.verdict, verdict, JSON.stringify(text));
    assert.equal(r.epochMs, epochMs, JSON.stringify(text));
    assert.deepEqual(kBadNumbers(r), [], JSON.stringify(text));
    if (verdict === 'invalid') {
      assert.ok(typeof r.reason === 'string' && r.reason !== '', `${text}：invalid 必须给人话原因`);
    } else {
      assert.equal(r.reason, null, JSON.stringify(text));
    }
  }
  // 拒绝的理由要点名是"哪一形状"不对，只写"格式错误"等于把用户支走
  assert.match(parseTimestamp('1 000 000 000').reason, /空白/);
  assert.match(parseTimestamp('1_000_000_000').reason, /下划线/);
  assert.match(parseTimestamp('Infinity').reason, /不是十进制/);
  assert.match(parseTimestamp('1000000000000.5').reason, /小数/);
  assert.match(parseTimestamp('1000000000.5000').reason, /小数/);
  assert.equal(parseTimestamp('').reason, '输入为空');
});

test('K4 越界判 invalid，理由点名上限值；上限本身仍在范围内', () => {
  assert.equal(EPOCH_MS_LIMIT, 8640000000000000, '这就是 Date 的 UTC 上限，改成别的数要连 §K 的边界样本一起改');
  const over = parseTimestamp('9999999999999999999');       // 19 位
  assert.equal(over.verdict, 'invalid');
  assert.equal(over.epochMs, null);
  assert.match(over.reason, /8640000000000000/);
  assert.match(over.reason, /273,?790/);
  assert.equal(parseTimestamp('-9999999999999999999').verdict, 'invalid', '负号不是免死金牌');
  // 边界：恰好等于上限可判，越一格就拒
  assert.equal(parseTimestamp('8640000000000000').verdict, 'milli');
  assert.equal(fromEpoch(EPOCH_MS_LIMIT, 0).isoUtc, '275760-09-13T00:00:00Z');
  const oneOver = parseTimestamp('8640000000000001');
  assert.equal(oneOver.verdict, 'invalid');
  assert.match(oneOver.reason, /8640000000000000/);
  assert.doesNotMatch(oneOver.reason, /未进入解析/, '越界的理由不许写成"被长度闸门挡下"，那是另一件事');
});

test('K5 parseCivilDate：Z 与 ±hh:mm 两种写法同一毫秒，缺标记才用入参 offset', () => {
  const A = 1709164800000;                 // date -u -r 1709164800 → 2024-02-29T00:00:00Z
  for (const t of ['2024-02-29T00:00Z', '2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z',
    '2024-02-29 00:00Z', '2024-02-29T08:00+08:00', '2024-02-29T08:00+0800',
    '2024-02-28T16:00-08:00']) {
    const r = parseCivilDate(t, -840);
    assert.equal(r.ok, true, t);
    assert.equal(r.epochMs, A, `${t}：串里带了时区标记，offsetMinutes 就不许再参与换算`);
    assert.equal(r.reason, null, t);
  }
  assert.equal(parseCivilDate('2024-02-29', 0).epochMs, A);
  assert.equal(parseCivilDate('2024-02-29', 480).epochMs, A - 28800000, '+08:00 的本地零点 = UTC 前一日 16:00');
  assert.equal(parseCivilDate('2024-02-29 08:00', 480).epochMs, A);
  for (const bad of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-01-32', '2024-1-31',
    '2024-02-29T24:00', '2024-02-29T12:60', '2024-02-29T12:00:61', '2024-02-29+08:00',
    'not-a-date', '2024-02- 29', '2024-02-29T12', '2024-02-29T08:00+99:99', '']) {
    const r = parseCivilDate(bad, 0);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.epochMs, null, JSON.stringify(bad));
    assert.ok(typeof r.reason === 'string' && r.reason !== '', JSON.stringify(bad));
  }
  assert.match(parseCivilDate('2023-02-29', 0).reason, /2 月|闰/);
  assert.match(parseCivilDate('2024-1-31', 0).reason, /两位/);
  assert.match(parseCivilDate('2024-02-29T24:00', 0).reason, /小时/);
});

test('K6 全程不读环境：同一批入参在 TZ=UTC 与 TZ=Asia/Shanghai 里逐字节相同', () => {
  const utc = kRunIn('UTC');
  const sh = kRunIn('Asia/Shanghai');
  assert.equal(utc.status, 0, utc.stderr);
  assert.equal(sh.status, 0, sh.stderr);
  assert.equal(utc.stderr, '', '子进程有噪声：这条比对的"相同"就不干净');
  const a = utc.stdout;
  assert.equal(a, sh.stdout, '两个时区下的输出不同——本模块在某处偷偷读了环境');
  const parsed = JSON.parse(a);
  assert.equal(parsed.length, K_CASES.length, '空集上的相等不算数：先证明两边真的把整批用例跑完了');
  assert.equal(parsed.filter((x) => x.r === null || x.r === undefined).length, 0, '有用例返回了 null');
  for (const x of parsed) assert.deepEqual(kBadNumbers(x.r), [], `${x.fn}(${x.args})`);
  // 反向自证：这批用例里确实含"读环境就会不一样"的格子（本地日期、星期、偏移串）
  const localFields = parsed.filter((x) => x.fn === 'fromEpoch')
    .map((x) => x.r.isoLocal + '|' + x.r.weekday);
  assert.ok(new Set(localFields).size > 1, 'fromEpoch 的本地字段全一样，说明用例没覆盖到跨日界的偏移');
});

test('K7 闰年与 2/29：2024 有、2023 没有、2100 没有、2000 有，fromEpoch 能还原 2/29', () => {
  assert.equal(parseCivilDate('2024-02-29', 0).ok, true);
  assert.equal(parseCivilDate('2023-02-29', 0).ok, false);
  assert.equal(parseCivilDate('2100-02-29', 0).ok, false, '百年不闰');
  assert.equal(parseCivilDate('2000-02-29', 0).ok, true, '四百年再闰');
  const r = fromEpoch(1709164800000, 0);   // date -u -r 1709164800 → 周四
  assert.equal(r.isoUtc, '2024-02-29T00:00:00Z');
  assert.equal(r.monthName, '二月');
  assert.equal(r.weekday, '周四');
});

test('K8 dateDiff 的 ymd 是日历分解：跨年、月末、闰日各有专断，反向同解', () => {
  const D = 86400000;
  // 2019-12-31 → 2021-01-01：整 1 年再加 1 天（12-31 加一年是 2020-12-31）
  assert.deepEqual(dateDiff(1577750400000, 1609459200000).ymd, { years: 1, months: 0, days: 1 });
  // 2024-01-31 → 2024-03-01：1 月 31 日加一个月要夹到 2/29（闰年），余 1 天
  assert.deepEqual(dateDiff(1706659200000, 1709251200000).ymd, { years: 0, months: 1, days: 1 });
  // 2024-02-29 → 2025-02-28：整一年，不许报成"11 个月 30 天"
  assert.deepEqual(dateDiff(1709164800000, 1740700800000).ymd, { years: 1, months: 0, days: 0 });
  // 同一对样本反着给：分解不变，方向由 sign 说
  const back = dateDiff(1609459200000, 1577750400000);
  assert.deepEqual(back.ymd, { years: 1, months: 0, days: 1 });
  assert.equal(back.sign, -1);
  assert.equal(back.totalMs, -367 * D, '2019-12-31 → 2021-01-01 跨 367 天：2020 整年 366 天，再加到 1/1 的那 1 天');
  assert.equal(dateDiff(1609459200000, 1609459200000).sign, 0);
});

test('K9 calendarDays 与 totalDays 允许不等，负差向 −∞ 取整', () => {
  const r = dateDiff(1704150000000, 1704157200000);  // 2024-01-01T23:00Z → 01-02T01:00Z
  assert.equal(r.totalMs, 7200000);
  assert.equal(r.totalDays, 0);
  assert.equal(r.calendarDays, 1);
  assert.notEqual(r.totalDays, r.calendarDays, '这对样本本来就是"两个口径不等价"的证据');
  assert.deepEqual(r.ymd, { years: 0, months: 0, days: 1 });
  const neg = dateDiff(1704157200000, 1704150000000);
  assert.equal(neg.totalMs, -7200000);
  assert.equal(neg.totalDays, -1, 'floor(-0.083) = -1：向零取整会把"不足一天"报成 0 天');
  assert.equal(neg.calendarDays, -1);
  const subSec = dateDiff(1704150000000, 1704150000000 - 500);
  assert.deepEqual(subSec.breakdown.map((x) => [x.unit, x.value]),
    [['ms', -500], ['s', -1], ['min', -1], ['h', -1], ['d', -1], ['wk', -1]],
    'breakdown 与 totalDays 同一下取整口径，否则同一页会摆出互相矛盾的两串数');
  assert.deepEqual(r.breakdown.map((x) => [x.unit, x.value]),
    [['ms', 7200000], ['s', 7200], ['min', 120], ['h', 2], ['d', 0], ['wk', 0]]);
});

test('K10 边界时刻都能出完整表示：0、32 位溢出点、负 epoch、非整秒的负毫秒', () => {
  const z = fromEpoch(0, 0);
  assert.equal(z.isoUtc, '1970-01-01T00:00:00Z');
  assert.equal(z.rfc3339Utc, '1970-01-01T00:00:00.000Z');
  assert.equal(z.weekday, '周四', '1970-01-01 是星期四（date -u -r 0）');
  const y2038 = fromEpoch(2147483647000, 0);
  assert.equal(y2038.isoUtc, '2038-01-19T03:14:07Z');
  assert.equal(y2038.unixSeconds, 2147483647);
  const y1900 = fromEpoch(-2208988800000, 0);   // 70 年 × 365 + 17 闰日 = 25,567 天
  assert.equal(y1900.isoUtc, '1900-01-01T00:00:00Z');
  assert.equal(y1900.unixSeconds, -2208988800);
  const n = fromEpoch(-1500, 0);
  assert.equal(n.isoUtc, '1969-12-31T23:59:58Z', '秒档向下取整：-1.5 s → -2 s');
  assert.equal(n.rfc3339Utc, '1969-12-31T23:59:58.500Z');
  assert.equal(n.unixSeconds, -2);
  assert.equal(n.unixMillis, -1500);
  assert.equal(n.tzOffsetMinutes, 0);
});

test('K11 超长输入不进解析：闸门在形状判定之前，且"超过"不是"达到"', () => {
  assert.equal(MAX_INPUT_LEN, 64);
  const r = parseTimestamp('1'.repeat(MAX_INPUT_LEN + 1));
  assert.equal(r.verdict, 'invalid');
  assert.equal(r.epochMs, null);
  assert.match(r.reason, /64/);
  assert.match(r.reason, /未进入解析/);
  const atLimit = parseTimestamp('9'.repeat(MAX_INPUT_LEN));   // 64 个 9：进了解析、被判越界
  assert.equal(atLimit.verdict, 'invalid');
  assert.match(atLimit.reason, /8640000000000000/, '到限的串要真的走完解析，理由才会落到越界那一档');
  assert.doesNotMatch(atLimit.reason, /未进入解析/);
});

test('K12 入参口径与四个兄弟模块同档：文本归一不抛、数值抛 TypeError', () => {
  // 文本档：`parseIdCard(123)` / `parseMobile(null)` 都不抛（照 `String(text ?? '')` 归一后判定），
  // time.js 不许自己发明一条"非字符串就抛"的规矩——那等于给装配层多添一种要处理的异常。
  for (const v of [null, undefined]) {
    assert.equal(parseTimestamp(v).verdict, 'invalid', kLabel(v));
    assert.equal(parseTimestamp(v).reason, '输入为空', kLabel(v));
    assert.equal(parseCivilDate(v, 0).ok, false, kLabel(v));
    assert.equal(parseCivilDate(v, 0).reason, '输入为空', kLabel(v));
  }
  assert.equal(parseTimestamp(true).verdict, 'invalid', 'String(true) = "true" → 字符集这一档拒');
  assert.equal(parseTimestamp(Symbol('s')).verdict, 'invalid', 'String(Symbol) = "Symbol(s)" → 同样拒');
  assert.equal(parseTimestamp(new Date(0)).verdict, 'invalid', 'Date 串里有空白 → 内部空白这一档拒');
  assert.deepEqual(parseTimestamp(123).readings.map((x) => x.kind), ['second', 'milli'],
    '123 归一成 "123"，三位正是"不猜档"的那一档');
  assert.deepEqual(parseTimestamp([1]).readings.map((x) => x.kind), ['second', 'milli']);
  // 唯一的例外：无原型对象由 `String()` 自己抛——§C 末尾"两个模块必须同抛"这一条照办
  for (const [label, call] of [['parseTimestamp', (x) => parseTimestamp(x)],
    ['parseCivilDate', (x) => parseCivilDate(x, 0)]]) {
    assert.throws(() => call(Object.create(null)), { name: 'TypeError' },
      `${label}：无原型对象必须同抛 TypeError，谁也不许自己静默洗成一条结论`);
  }
  // 数值档：这些是装配层算出来的量，形状不对就是写错了，必须抛且点名是哪个入参
  for (const [fn, argName] of [[fromEpoch, 'epochMs'], [relativeTime, 'epochMs'], [dateDiff, 'aEpochMs']]) {
    assert.throws(() => fn(1000.5, 0), (e) => {
      assert.equal(e.name, 'TypeError');
      assert.match(e.message, new RegExp(`^${fn.name} 的 ${argName} 应为整数毫秒，收到 `));
      return true;
    }, fn.name);
  }
  assert.throws(() => relativeTime(0, NaN), { name: 'TypeError', message: /nowMs 应为整数毫秒/ });
  assert.throws(() => dateDiff(0, '0'), { name: 'TypeError', message: /bEpochMs 应为整数毫秒/ });
  assert.throws(() => fromEpoch(1000, 480.5), { name: 'TypeError', message: /offsetMinutes 应为整数分钟/ });
  assert.throws(() => fromEpoch(1000, undefined), { name: 'TypeError', message: /offsetMinutes/ });
  assert.throws(() => fromEpoch(1000, 841), { name: 'TypeError', message: /±14 小时|840/ });
  assert.doesNotThrow(() => fromEpoch(1000, -840));
  // 值越界与形状不对同档（都抛 TypeError）：`parseIdCard` 对 `today: '10000-01-01'` 就是这个口径
  assert.throws(() => fromEpoch(EPOCH_MS_LIMIT + 1, 0),
    { name: 'TypeError', message: /fromEpoch 的 epochMs 超出 Date 可表示的时间范围/ });
  assert.throws(() => relativeTime(0, EPOCH_MS_LIMIT + 1),
    { name: 'TypeError', message: /relativeTime 的 nowMs 超出 Date 可表示的时间范围/ });
  assert.throws(() => parseCivilDate('2024-01-01', '0'), { name: 'TypeError', message: /offsetMinutes/ });
  // 三个模块的报错尾巴都是「收到 <shapeOf(值)>」这一段：口径分叉在这里红
  // （拿真正会抛的那三类比：`generateUsccCodes` / `generateMobiles` 的 options 闸门与本页的数值闸门）
  const tails = [
    grab(() => fromEpoch(1000.5, 0), 'fromEpoch'),
    grab(() => generateUsccCodes({ rng: 'nope' }), 'generateUsccCodes'),
    grab(() => generateMobiles({ rng: 'nope' }), 'generateMobiles'),
  ];
  for (const [who, msg] of tails) {
    assert.match(msg, /收到 (null|undefined|number|string|boolean|bigint|object|function|symbol|Date|Array\(\d+\))/,
      `${who}：${msg}`);
  }
  function grab(fn, who) { try { fn(); } catch (e) { return [who, e.message]; } return [who, '']; }
});

test('K13 星期与月份是内置中文表：逐字钉住，源码里不许出现 Intl / toLocale', () => {
  const code = kCode();
  assert.ok(!code.includes('Intl'), '出现了 Intl——输出会随 Node / 浏览器的 ICU 与 locale 漂');
  assert.doesNotMatch(code, /toLocale(String|DateString|TimeString|NumberFormat)/, 'toLocale* 同样是环境依赖');
  const week = [];
  for (let i = 0; i < 7; i += 1) week.push(fromEpoch(i * 86400000, 0).weekday);
  assert.deepEqual(week, ['周四', '周五', '周六', '周日', '周一', '周二', '周三']);
  const months = [];
  for (let m = 1; m <= 12; m += 1) {
    const text = `2024-${String(m).padStart(2, '0')}-15`;
    months.push(fromEpoch(parseCivilDate(text, 0).epochMs, 0).monthName);
  }
  assert.deepEqual(months, ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月']);
});

test('K14 扫源：无 Date.now()、无无参 new Date()、不读环境、零 import', () => {
  const code = kCode();
  assert.equal(code.split('Date.now(').length - 1, 0, 'Date.now() 一旦出现，判据就随跑测试的时刻漂');
  assert.doesNotMatch(code, /new Date\(\s*\)/, '无参 new Date() 同上');
  assert.doesNotMatch(code, /getTimezoneOffset|process\.env|Date\.parse/, '本地时区只能由调用方传进来');
  assert.doesNotMatch(code, /^\s*import[\s({]/m, 'time.js 是叶子模块：import 会把数据表拖进 codec 页');
  assert.doesNotMatch(code, /\bimport\s*\(/, '动态 import 也算一条依赖边');
});

test('K15 偏移全域：+8h、+11:30、−14h、−5:30、0，五档的本地串与后缀自洽', () => {
  const MS = 1709161200000;   // date -u -r 1709161200 → 2024-02-28T23:00:00Z（周三）
  const east = fromEpoch(MS, 480);
  assert.equal(east.isoLocal, '2024-02-29T07:00:00+08:00');
  assert.equal(east.localDisplay, '2024-02-29 07:00:00 (UTC+08:00) 周四');
  assert.equal(east.weekday, '周四', '本地已跨到 2/29：星期跟着本地日，不是 UTC 日');
  assert.equal(fromEpoch(MS, 0).weekday, '周三');
  const half = fromEpoch(MS, 690);
  assert.equal(half.isoLocal, '2024-02-29T10:30:00+11:30', '23:00 UTC + 11:30 = 次日 10:30');
  assert.equal(half.localDisplay, '2024-02-29 10:30:00 (UTC+11:30) 周四');
  assert.equal(half.tzOffsetMinutes, 690);
  const west = fromEpoch(MS, -840);
  assert.equal(west.isoLocal, '2024-02-28T09:00:00-14:00');
  assert.equal(west.localDisplay, '2024-02-28 09:00:00 (UTC-14:00) 周三');
  assert.equal(fromEpoch(MS, -330).isoLocal, '2024-02-28T17:30:00-05:30');
  for (const off of [0, 480, 690, -840, -330]) {
    const r = fromEpoch(MS, off);
    assert.equal(r.isoUtc, '2024-02-28T23:00:00Z', `offset ${off} 不该动 UTC 那一档`);
    assert.equal(r.rfc3339Utc, '2024-02-28T23:00:00.000Z');
    assert.equal(r.unixMillis, MS);
    assert.ok(r.localDisplay.includes(r.isoLocal.slice(11, 19)), 'localDisplay 的时刻要与 isoLocal 一致');
  }
});

test('K16 relativeTime 阈值表逐档命中，含"此刻"与未来镜像', () => {
  const NOW = 1709164800000;
  const S = 1000; const M = 60000; const H = 3600000; const D = 86400000;
  const at = (deltaMs) => relativeTime(NOW + deltaMs, NOW);
  assert.deepEqual({ ...at(0) }, { text: '此刻', past: false, future: false });
  assert.equal(at(-59 * S).text, '59 秒前');
  assert.equal(at(-60 * S).text, '1 分钟前', '满一分钟就进下一档，不许留"60 秒前"');
  assert.equal(at(-59 * M).text, '59 分钟前');
  assert.equal(at(-60 * M).text, '1 小时前');
  assert.equal(at(-(23 * H + 59 * M + 59 * S)).text, '23 小时前');
  assert.equal(at(-30 * D).text, '1 个月前');
  assert.equal(at(-364 * D).text, '12 个月前');
  assert.equal(at(-365 * D).text, '1 年前');
  assert.equal(at(-366 * D).text, '1 年前', '满一年不满两年不再细化到天：固定档口径，写在 TIME_CAVEAT 里');
  assert.equal(at(-730 * D).text, '2 年前');
  assert.equal(at(45 * S).text, '45 秒后');
  assert.equal(at(3 * D).text, '3 天后');
  const f = at(45 * S);
  assert.equal(f.past, false); assert.equal(f.future, true);
  assert.equal(at(-45 * S).past, true);
});

test('K17 口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', () => {
  const NOW = 1709164800000; const D = 86400000;
  const amb = parseTimestamp('999999999');
  const rows = [
    [/10 位当秒/, parseTimestamp('1000000000').verdict === 'second'],
    [/13 位当毫秒/, parseTimestamp('1000000000000').verdict === 'milli'],
    [/其余位数不猜/, amb.verdict === 'ambiguous' && amb.readings.length === 2 && amb.epochMs === null],
    [/只按「10 位整数 \+ 1–3 位小数的秒」/, parseTimestamp('1000000000.5').epochMs === 1000000000500
      && parseTimestamp('1000000000000.5').verdict === 'invalid'],
    [/按 30 天/, relativeTime(NOW - 30 * D, NOW).text === '1 个月前'],
    [/按 365 天/, relativeTime(NOW - 365 * D, NOW).text === '1 年前'],
    [/不读运行环境时区/, !/process\.env|getTimezoneOffset|Intl|toLocale|Date\.now|new Date\(\s*\)/.test(kCode())],
  ];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(TIME_CAVEAT), holds,
      `文案与实现分叉：${claim}（文案里有=${claim.test(TIME_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 7, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(TIME_CAVEAT.length > 80 && TIME_CAVEAT.length <= 240,
    `口径句要够说清楚、又不能长到把面板挤爆（实际 ${TIME_CAVEAT.length} 字）`);
});

test('K18 零重叠：dev/js/tools/ 不成 vite 入口', () => {
  const top = readdirSync(resolve(ROOT, 'dev/js')).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
  assert.equal(top.includes('time.js'), false, 'time.js 被挪到 dev/js/ 顶层，会变成构建入口、进产物');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/time.js')), true,
    '文件不在它该在的位置时，上面那条断言是空转的');
  const vite = read('vite.config.js');
  assert.match(vite, /function getDevJsEntries\(\)[\s\S]{0,400}readDirSorted\(jsDir\)[\s\S]{0,200}endsWith\('\.js'\)/,
    'vite 的入口扫描不再是"dev/js 一层 + .js 后缀"，本条与 §6.1 的零重叠口径要一起重写');
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const hits = readdirSync(siteJs).filter((f) => f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('parseTimestamp'));
    assert.deepEqual(hits, [], '构建产物里出现了 time.js 的导出名');
  }
});


// ── §L Base64（UTF-8）与 URL 编解码（tools/codec.js，段 3 Task 2）──────────────
// 编码侧拿 Node 的 Buffer 当外部判据源对拍（不把自己的输出当标准）；解码侧把
// 两档口径（strict / 宽容）的边界逐格咬住。刻意不测浏览器 atob 的怪癖：本站不用它。
const { MAX_INPUT_BYTES, BASE64_CAVEAT, URL_CAVEAT, byteLen, encodeBase64, decodeBase64,
  encodeDataUri, decodeDataUri, encodeUrlComponent, encodeUrl, decodeUrlComponent,
  urlPair, splitQuery } = await import('../dev/js/tools/codec.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K 的 kCode 同一形状） */
const lCode = () => read('dev/js/tools/codec.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 对拍源：字符串 ↔ Node 的标准 base64 */
const b64Of = (s) => Buffer.from(s, 'utf8').toString('base64');
/** 尾块三档余数 + UTF-8 多字节 + 控制字符 + emoji + 代理对 + 空串 */
const L_SAMPLES = ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'hello world',
  '\u4e2d\u6587', '\uD83D\uDE00', '\uD83D', '\uDE00',
  '\u0000\u007F\u00FF', 'a=b&c', '  ', '\n\t'];
test('L1 编码与 Node 的 base64 逐字符对拍，空串是一等公民', () => {
  for (const s of L_SAMPLES) {
    const r = encodeBase64(s);
    if (r.reason !== null) continue;   // 落单代理项那两条由 L3 专门判
    assert.equal(r.out, b64Of(s), JSON.stringify(s));
    assert.equal(r.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
  }
  const e = encodeBase64('');
  assert.equal(e.ok, true); assert.equal(e.out, ''); assert.equal(e.bytes, 0);
  assert.equal(decodeBase64('').out, '');
});
test('L2 编→解往返逐样本原样回来（含 emoji、控制字符、BMP 之外的字符）', () => {
  for (const s of L_SAMPLES) {
    const enc = encodeBase64(s);
    if (!enc.ok) continue;
    const back = decodeBase64(enc.out);
    assert.equal(back.ok, true, JSON.stringify(s));
    assert.equal(back.out, s, `往返丢了字符：${JSON.stringify(s)}`);
  }
});
test('L3 落单代理项点名拒绝，不许静默变成替换字符', () => {
  for (const [s, at] of [['\uD83D', 1], ['a\uD83Db', 2], ['\uDE00', 1], ['ab\uDE00c', 3]]) {
    const r = encodeBase64(s);
    assert.equal(r.ok, false, JSON.stringify(s));
    assert.equal(r.out, '', '拒绝就不能给半截产物');
    assert.match(r.reason, /落单代理项/);
    assert.match(r.reason, new RegExp(`第 ${at} 位`), `${JSON.stringify(s)} → ${r.reason}`);
    assert.equal(s[at - 1].charCodeAt(0) >= 0xD800, true, '锚点自己得对得上');
  }
  assert.equal(encodeBase64('\uD83D\uDE00').ok, true, '成对的代理项是合法字符，不能一起拒了');
  assert.equal(decodeBase64(b64Of('\uD83D\uDE00')).out, '\uD83D\uDE00');
});
test('L4 strict 档：空白、非 4 倍数、padding 不配余数，三格各自拒绝', () => {
  const cases = [['YQ== ', '空白'], ['YWJj\n', '空白'], ['YQ=', 'padding'], ['YWJ', '长度']];
  for (const [s, kind] of cases) {
    const r = decodeBase64(s, { strict: true });
    assert.equal(r.ok, false, `${JSON.stringify(s)}（${kind}）`);
    assert.equal(r.strict, true, 'strict 要回显真正生效的那一档');
    assert.match(r.reason, new RegExp(kind), `${JSON.stringify(s)} → ${r.reason}`);
  }
  assert.equal(decodeBase64('YWJj', { strict: true }).ok, true, '无 padding 的 4 倍数是合法的');
  assert.equal(decodeBase64('YQ==', { strict: true }).out, 'a');
  assert.equal(decodeBase64('YWI=', { strict: true }).out, 'ab');
  // 尾部那几个填充比特（'YR' 与 'YQ' 都解出 'a'）**两档都不校验**：这一档必须写死，否则哪天有人
  // "顺手"补一道 RFC 4648 的非规范检查，L1 的往返样本会莫名其妙少一条还看不出为什么
  assert.equal(decodeBase64('YR==', { strict: true }).out, 'a', 'strict 也不管尾部比：Node 的解码器同样忽略');
  assert.equal(decodeBase64('YR==').out, 'a');
});
test('L5 宽容档：剥掉的空白与 padding 一律计数报告，缺的 padding 也报', () => {
  const ws = decodeBase64('YW\tJj\r\n');
  assert.equal(ws.ok, true); assert.equal(ws.out, 'abc');
  assert.equal(ws.strict, false, '默认档就是宽容档，回显要如实');
  assert.equal(ws.whitespaceDropped, 3, ws.whitespaceDropped);
  const pad = decodeBase64('YQ==');
  assert.equal(pad.out, 'a'); assert.equal(pad.paddingDropped, 2);
  assert.equal(pad.paddingImplied, 0);
  const bare = decodeBase64('YQ');
  assert.equal(bare.out, 'a'); assert.equal(bare.paddingDropped, 0);
  assert.equal(bare.paddingImplied, 2, '不静默补：补了几位必须写在报告里');
  const over = decodeBase64('YQ====');
  assert.equal(over.ok, false, '多出来的等号在字母表之外，不是"看着像 padding"');
  assert.match(over.reason, /第 5 位/);
});
test('L6 字母表外的字符两档都拒，并点名第几位是哪个字符', () => {
  for (const s of ['YQ*@', 'é', 'Y Q*=', '_-8']) {
    const tol = decodeBase64(s);
    const str = decodeBase64(s, { strict: true });
    assert.equal(tol.ok, false, JSON.stringify(s));
    assert.equal(str.ok, false, JSON.stringify(s));
    assert.match(tol.reason, /不在 Base64 字母表/);
    assert.equal(tol.out, '');
  }
  const r = decodeBase64('YWJ*');
  assert.match(r.reason, /第 4 位字符「\*」/, r.reason);
  assert.equal(r.badAt, 4);
  // 单字符余数（%4===1）在结构上不可能，两档都拒
  for (const s of ['Y', 'YWJjA']) {
    assert.equal(decodeBase64(s).ok, false, s);
    assert.match(decodeBase64(s).reason, /长度不合法|不是 4 的倍数/, s);
    assert.equal(decodeBase64(s, { strict: true }).ok, false, s);
  }
});
test('L7 解出来的字节不是合法 UTF-8 时报字节位，不吐替换字符', () => {
  const bad = Buffer.from([0xff]).toString('base64');          // '/w=='
  const cut = Buffer.from([0xe4, 0xb8]).toString('base64');    // 半个「中」
  for (const [s, at] of [[bad, 1], [cut, 1]]) {
    const r = decodeBase64(s);
    assert.equal(r.ok, false, s);
    assert.equal(r.out, '', '不许把非法序列洗成 U+FFFD 交给用户');
    assert.match(r.reason, /不是合法 UTF-8/, r.reason);
    assert.match(r.reason, new RegExp(`第 ${at} 字节`), `${s} → ${r.reason}`);
  }
  assert.equal(decodeBase64(Buffer.from([0x41]).toString('base64')).out, 'A');
});
test('L8 MAX_INPUT_BYTES 闸门：四入口同档拒绝，点名实测与上限，绝不截断', () => {
  assert.equal(MAX_INPUT_BYTES, 1048576, '§7 表里"文本类工具 1MB"那一行就是 MiB 这一档');
  const big = 'a'.repeat(MAX_INPUT_BYTES);
  assert.equal(encodeBase64(big).ok, true, '正好到上限是允许的（闸门是"超过"）');
  assert.equal(encodeBase64(big).bytes, MAX_INPUT_BYTES);
  const over = encodeBase64(big + 'a');
  assert.equal(over.ok, false);
  assert.equal(over.out, '', '拒绝就是拒绝，不许给截断后的半截 base64');
  assert.match(over.reason, /1048577 字节/, over.reason);
  assert.match(over.reason, /1048576 字节上限/, over.reason);
  assert.equal(encodeUrl(big + 'a').ok, false);
  assert.equal(encodeUrlComponent(big + 'a').ok, false);
  assert.equal(decodeUrlComponent('%'.repeat(MAX_INPUT_BYTES + 1)).ok, false);
  assert.match(decodeBase64(b64Of(big + 'a')).reason, /上限/, '解码侧的闸门按解出的字节数算');
  assert.equal(byteLen('中'), 3); assert.equal(byteLen('中文'), 6); assert.equal(byteLen('\uD83D\uDE00'), 4);
  assert.equal(byteLen('a'), 1); assert.equal(byteLen(''), 0);
  assert.equal(byteLen(big), MAX_INPUT_BYTES, 'byteLen 与闸门必须是同一把尺子，否则"1MB"有两种算法');
});
test('L9 data URI 往返：mime、charset、base64 标志各归其位', () => {
  const e = encodeDataUri('中');
  assert.equal(e.ok, true);
  assert.equal(e.out, 'data:text/plain;charset=utf-8;base64,' + b64Of('中'));
  const d = decodeDataUri(e.out);
  assert.equal(d.ok, true); assert.equal(d.data, '中');
  assert.equal(d.mime, 'text/plain'); assert.equal(d.charset, 'utf-8');
  assert.equal(d.isBase64, true); assert.equal(d.percentHits, 0);
  const gbk = decodeDataUri('data:text/html;charset=gbk;base64,PGI+');
  assert.equal(gbk.ok, false, '声明了非 UTF-8 的 charset：不许假装按 UTF-8 解出"能看"的东西');
  assert.match(gbk.reason, /charset/, gbk.reason); assert.equal(gbk.data, '');
  const up = decodeDataUri('data:text/html;charset=UTF-8;base64,PGI+');
  assert.equal(up.ok, true); assert.equal(up.charset, 'utf-8', 'charset 归一小写再回显');
  assert.equal(up.charsetDefaulted, false, '写了 charset 就不能说成是补的');
  assert.equal(up.data, '<b>');
  const bareMime = decodeDataUri('data:,abc');
  assert.equal(bareMime.charsetDefaulted, true, '没写 charset 要说明是补的');
  assert.equal(bareMime.mimeDefaulted, true, '没写 mime 同样是补的，两个"补"都得说出来');
  assert.equal(bareMime.mime, 'text/plain'); assert.equal(bareMime.data, 'abc');
});
test('L10 data URI 的载荷里带换行照吃，百分号序列按次数报', () => {
  const wrapped = 'data:text/plain;charset=utf-8;base64,' + b64Of('中文').replace(/(.{4})/g, '$1\r\n');
  const w = decodeDataUri(wrapped);
  assert.equal(w.ok, true, '§5.2 点名要支持"带换行的 data URI 场景"');
  assert.equal(w.data, '中文');
  assert.equal(w.whitespaceDropped, 4, '剥了几处空白要报得出（两组 \\r\\n 共 4 个字符）');
  const pct = decodeDataUri('data:image/svg+xml,%3Csvg%20id%3D%22a%22%3E');
  assert.equal(pct.isBase64, false);
  assert.equal(pct.data, '<svg id="a">');
  assert.equal(pct.percentHits, 6, '%3C/%20/%3D/%22/%22/%3E 六个，逐个计数不是一句"含百分号"');
  assert.equal(pct.charsetDefaulted, true, '非 base64 那档同样补 charset，但只在报告里说');
});
test('L10b 不是 data URI / 空载荷：两侧同档拒绝并说清楚缺哪一段', () => {
  for (const [s, why] of [['http://a/b', /^不是 data URI/], ['dat', /^不是 data URI/],
    ['data:', /^缺/], ['data:text/plain;base64', /^缺/], ['data:text/plain;base64,', /^载荷/]]) {
    const r = decodeDataUri(s);
    assert.equal(r.ok, false, s);
    assert.match(r.reason, why, `${s} → ${r.reason}`);
    assert.equal(r.data, '');
  }
  const e = encodeDataUri('a', 'text plain');
  assert.equal(e.ok, false); assert.match(e.reason, /mime 形状/);
  // 编码侧同一档：空载荷不给"看起来成功其实没内容"的一串
  const empty = encodeDataUri('');
  assert.equal(empty.ok, false, 'encodeDataUri("") 必须与 decodeDataUri("data:…;base64,") 同档拒绝');
  assert.match(empty.reason, /载荷为空/, empty.reason); assert.equal(empty.out, '');
  for (const v of [null, undefined]) assert.equal(encodeDataUri(v).ok, false, String(v));
});
test('L11 URL 两档口径：18 个保留字符逐字符对拍原生函数，差异集合恰好 11 个', () => {
  const RESERVED = ":/?#[]@!$&'()*+,;=";
  assert.equal(RESERVED.length, 18, 'RFC 3986 的保留字符就是 18 个；表变了本条要连口径句一起重写');
  const diff = [];
  for (const ch of RESERVED) {
    const u = encodeUrl(ch); const c = encodeUrlComponent(ch);
    assert.equal(u.ok, true, ch); assert.equal(c.ok, true, ch);
    assert.equal(u.out, encodeURI(ch), `encodeURI(${ch})`);
    assert.equal(c.out, encodeURIComponent(ch), `encodeURIComponent(${ch})`);
    if (u.out !== c.out) diff.push(ch);
  }
  // 差异集合钉死：面板上"两档不一样"这件事靠的就是这 11 个字符，谁也不许悄悄改口径
  assert.equal(diff.join(''), ':/?#@$&+,;=', `两档差异集合变了：${JSON.stringify(diff.join(''))}`);
  for (const s of [' ', '中', '\uD83D\uDE00', 'a b/c?d=e&f', '%', '+', '~', '-', '.', '_']) {
    const u = encodeUrl(s); const c = encodeUrlComponent(s);
    assert.equal(u.out, encodeURI(s), JSON.stringify(s));
    assert.equal(c.out, encodeURIComponent(s), JSON.stringify(s));
    assert.equal(u.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
    assert.equal(c.bytes, u.bytes, '两档的 bytes 都是**入参**的字节数，不是输出的');
  }
  assert.equal(encodeUrlComponent('a b').out, 'a%20b', '空格是 %20，不是 +（那是 form 编码的口径）');
  assert.equal(encodeUrl('%').out, '%25', '百分号自己必须被编码，否则解码侧无从分辨');
  assert.equal(encodeUrlComponent('').out, ''); assert.equal(encodeUrlComponent('').ok, true);
});
test('L12 解码侧：非法序列一律 ok:false 并点名位置，绝不把 URIError 抛穿到面板', () => {
  for (const [s, at] of [['%', 1], ['%zz', 1], ['a%4', 2], ['%2G', 1], ['%E4%B8%zz', 7]]) {
    const r = decodeUrlComponent(s);
    assert.equal(r.ok, false, s); assert.equal(r.out, '', s);
    assert.match(r.reason, /百分号/, `${s} → ${r.reason}`);
    assert.match(r.reason, new RegExp(`第 ${at} 位`), `${s} → ${r.reason}`);
  }
  for (const [s, at] of [['%E4%B8', 1], ['%FF', 1], ['%ED%A0%80', 1], ['a%E4%B8', 2]]) {
    const r = decodeUrlComponent(s);
    assert.equal(r.ok, false, s); assert.equal(r.out, '', s);
    assert.match(r.reason, /不是合法 UTF-8/, `${s} → ${r.reason}`);
    assert.match(r.reason, new RegExp(`第 ${at} 字节`), `${s} → ${r.reason}`);
  }
  assert.equal(decodeUrlComponent('a+b').out, 'a+b', '「+」在 form 编码里是空格，本站不猜、原样留着（口径句里有这句）');
  assert.equal(decodeUrlComponent('a%20b').out, 'a b');
  assert.doesNotMatch(decodeUrlComponent('%zz').reason, /字节/, '两类位置口径不许混：语法错只说「位」');
  assert.doesNotMatch(decodeUrlComponent('%FF').reason, /第 \d+ 位/, '字节错只说「字节」，不给人一个假的字符位');
  for (const s of ['', ' ', '中', '\uD83D\uDE00', 'a+b', '&=?#/', '%25', '0123456789']) {
    assert.equal(decodeUrlComponent(encodeUrlComponent(s).out).out, s, JSON.stringify(s));
    assert.equal(decodeUrlComponent(encodeUrl(s).out).out, s, JSON.stringify(s));
  }
  for (const [s, at] of [['\uD83D', 1], ['a\uDE00b', 2]]) {
    for (const [who, fn] of [['encodeUrl', encodeUrl], ['encodeUrlComponent', encodeUrlComponent]]) {
      const r = fn(s);
      assert.equal(r.ok, false, `${who} ${JSON.stringify(s)}`);
      assert.equal(r.out, '', `${who}：拒绝就不给半截产物`);
      assert.match(r.reason, /落单代理项/, `${who} → ${r.reason}`);
      assert.match(r.reason, new RegExp(`第 ${at} 位`), `${who} → ${r.reason}`);
    }
  }
});
test('L13 urlPair：两档编码 + 两档解码四格并列，闸门同生同死、解码单独失败不牵连编码', () => {
  const p = urlPair('a b/c?d=e&f&g=中');
  assert.equal(p.ok, true); assert.equal(p.reason, null);
  assert.equal(p.encodeURI, encodeURI('a b/c?d=e&f&g=中'));
  assert.equal(p.encodeURIComponent, encodeURIComponent('a b/c?d=e&f&g=中'));
  assert.notEqual(p.encodeURI, p.encodeURIComponent, '这串样本必须让两档分开，否则本条测不到差异');
  assert.equal(p.bytes, Buffer.byteLength('a b/c?d=e&f&g=中', 'utf8'));
  assert.deepEqual(p.decodeTries.map((x) => x.field), ['decodeURI', 'decodeURIComponent']);
  assert.equal(p.decodeTries.length, 2, '解码侧就两档，多一少一都说明面板的表变了形');
  const enc = urlPair('%3A%2F');
  assert.equal(enc.decodeTries[0].out, decodeURI('%3A%2F'));
  assert.equal(enc.decodeTries[1].out, decodeURIComponent('%3A%2F'));
  assert.notEqual(enc.decodeTries[0].out, enc.decodeTries[1].out, 'decodeURI 不动保留字符，两档必须分开摆');
  for (const x of enc.decodeTries) assert.equal(x.ok, true, x.field);
  const over = urlPair('a'.repeat(MAX_INPUT_BYTES + 1));
  assert.equal(over.ok, false); assert.match(over.reason, /上限/, over.reason);
  assert.equal(over.encodeURI, ''); assert.equal(over.encodeURIComponent, '');
  for (const x of over.decodeTries) {
    assert.equal(x.ok, false, `${x.field}：闸门越界时四格一起停，不许只停编码那两格`);
    assert.equal(x.out, ''); assert.equal(x.reason, over.reason, '同一个理由，面板才不会写出两种解释');
  }
  const half = urlPair('%zz');
  assert.equal(half.ok, true, '编码侧做得成，解码档失败是个案、不能把整格判死');
  assert.equal(half.encodeURI, '%25zz');
  for (const x of half.decodeTries) { assert.equal(x.ok, false, x.field); assert.match(x.reason, /百分号/); }
  const empty = urlPair('');
  assert.equal(empty.ok, true); assert.equal(empty.encodeURI, ''); assert.equal(empty.encodeURIComponent, '');
  for (const x of empty.decodeTries) { assert.equal(x.ok, true, x.field); assert.equal(x.out, ''); }
});
test('L14 splitQuery：只按 & 切、键值只在第一个 = 处切一次、空段丢弃不编号', () => {
  const rows = splitQuery('a=1&&b=2&noequals&=v&k=a=b');
  assert.deepEqual(rows.map((r) => r.raw), ['a=1', 'b=2', 'noequals', '=v', 'k=a=b'],
    JSON.stringify(rows.map((r) => r.raw)));
  assert.deepEqual(rows.map((r) => r.hasEquals), [true, true, false, true, true]);
  assert.deepEqual(rows.map((r) => [r.key, r.value]),
    [['a', '1'], ['b', '2'], ['noequals', ''], ['', 'v'], ['k', 'a=b']]);
  for (const r of rows) { assert.equal(r.keyOk, true, r.raw); assert.equal(r.valueOk, true, r.raw); assert.equal(r.reason, null); }
  assert.equal(splitQuery('a=1&a=2').length, 2, '重复键各自成行：这里不是解析器，不去重');
  assert.equal(splitQuery('a=1;b=2').length, 1, '「;」不作分隔符（口径句里点名，L17 对账）');
  assert.equal(splitQuery('a=1;b=2')[0].value, '1;b=2');
  assert.equal(splitQuery('&&').length, 0, '空段一律丢弃：不给人一行"看起来有内容其实是壳"的行');
  assert.deepEqual(splitQuery('a=1& &b=2').map((r) => r.raw), ['a=1', ' ', 'b=2'],
    '只含空白的段是用户的真实输入，本模块不替人丢');
  assert.equal(splitQuery('').length, 0); assert.equal(splitQuery(null).length, 0);
});
test('L14b splitQuery 的解码档：解不开就留着原文并标哪一档，单项越界单独拒', () => {
  const bad = splitQuery('%zz=%E4%B8&ok=1');
  assert.equal(bad.length, 2);
  const [first] = bad;
  assert.equal(first.keyOk, false); assert.equal(first.key, '%zz', '解不开时 key 位放原文，不许变空');
  assert.equal(first.valueOk, false); assert.equal(first.value, '%E4%B8');
  assert.match(first.reason, /^键：/, first.reason); assert.match(first.reason, /值：/, first.reason);
  assert.match(first.reason, /百分号/, first.reason); assert.match(first.reason, /UTF-8/, first.reason);
  assert.equal(bad[1].reason, null, '同一串里解得开的那行不能被邻居连坐');
  assert.equal(splitQuery('%20=1')[0].key, ' ', '解得开就解码：键「%20」的真实值是空格');
  assert.equal(splitQuery('q=a+b')[0].value, 'a+b', '与 L12 同一口径：+ 不是空格');
  const long = splitQuery(`k=${'x'.repeat(MAX_INPUT_BYTES + 1)}`);
  assert.equal(long.length, 1); assert.equal(long[0].valueOk, false); assert.match(long[0].reason, /上限/);
  assert.equal(long[0].value.length, MAX_INPUT_BYTES + 1, '越界那一项保留原文：长度一位都不许少');
});
test('L15 入参口径与兄弟模块同档：文本归一不抛、options 抛 TypeError', () => {
  const DATA_URI_EMPTY = 'data:text/plain;charset=utf-8;base64,';
  for (const v of [null, undefined]) {
    assert.equal(encodeBase64(v).out, '', kLabel(v)); assert.equal(encodeBase64(v).ok, true, kLabel(v));
    assert.equal(decodeBase64(v).out, '', kLabel(v));
    assert.equal(encodeUrl(v).out, ''); assert.equal(encodeUrlComponent(v).out, '');
    assert.equal(decodeUrlComponent(v).out, ''); assert.equal(splitQuery(v).length, 0);
    assert.equal(urlPair(v).bytes, 0, kLabel(v));
    assert.equal(encodeDataUri(v).ok, false, '归一成空串之后就是"空载荷"，照 L10b 那一档拒绝');
    assert.match(encodeDataUri(v).reason, /载荷为空/, kLabel(v));
    assert.equal(decodeDataUri(v).ok, false, 'data URI 那一位为空就是"不是 data URI"，照 L10b 拒绝');
  }
  // 文本档里非字符串照样归一（`parseIdCard(123)` 同一档）：数字、布尔、Symbol、Date 都不许抛
  assert.equal(encodeBase64(123).out, b64Of('123')); assert.equal(encodeBase64(true).out, b64Of('true'));
  assert.equal(encodeUrlComponent(Symbol('s')).out, encodeURIComponent('Symbol(s)'));
  assert.equal(decodeBase64(Symbol('x')).ok, false, '"Symbol(x)" 含字母表外的字符，归一之后照 L6 那一档拒');
  assert.match(decodeBase64(Symbol('x')).reason, /不在 Base64 字母表/);
  // 唯一的例外还是无原型对象：`String()` 自己抛，本站不兜（§C 末尾与 K12 同一档）
  const noProto = Object.create(null);
  for (const [who, call] of [['encodeBase64', (x) => encodeBase64(x)], ['decodeBase64', (x) => decodeBase64(x)],
    ['encodeUrlComponent', (x) => encodeUrlComponent(x)], ['decodeUrlComponent', (x) => decodeUrlComponent(x)],
    ['urlPair', (x) => urlPair(x)], ['splitQuery', (x) => splitQuery(x)],
    ['encodeDataUri', (x) => encodeDataUri(x)], ['decodeDataUri', (x) => decodeDataUri(x)]]) {
    assert.throws(() => call(noProto), { name: 'TypeError' }, `${who}：无原型对象必须同抛，不许静默洗成结论`);
  }
  // options 档：`decodeBase64` 唯一的键是 strict，值只收布尔；拼错键名必须响
  assert.throws(() => decodeBase64('YQ==', { strict: 'yes' }), (e) => {
    assert.equal(e.name, 'TypeError');
    assert.match(e.message, /^decodeBase64 的 options\.strict 应为布尔，收到 /);
    return true;
  });
  assert.throws(() => decodeBase64('YQ==', { strictz: true }),
    { name: 'TypeError', message: /未知 options 键/ }, '拼错的键静默当默认＝用户的 strict 白开了');
  assert.throws(() => decodeBase64('YQ==', 'strict'), { name: 'TypeError', message: /options 应为对象/ });
  for (const o of [undefined, null, {}]) assert.doesNotThrow(() => decodeBase64('YQ==', o), JSON.stringify(o));
  assert.equal(decodeBase64('YQ==', { strict: undefined }).strict, false, '键在值缺席＝走默认档，不是抛');
  // mime 那一位是文本档：缺席补默认，给了但形状不对就拒（都不是抛）
  assert.equal(encodeDataUri('a', undefined).out, DATA_URI_EMPTY + 'YQ==');
  assert.equal(encodeDataUri('a', null).out, DATA_URI_EMPTY + 'YQ==', '缺席位（null 与 undefined）在归一**之前**判，补默认 mime');
  assert.equal(encodeDataUri('a', '').ok, false, '空串是"给了但没用"，与缺席不同档：必须说清 mime 形状');
  assert.match(encodeDataUri('a', '').reason, /mime 形状/);
  // 报错尾巴统一是「收到 <shapeOf(值)>」那一段（K12 的三档类比，口径分叉在这里红）
  const grab = (fn, who) => { try { fn(); } catch (e) { return [who, e.message]; } return [who, '']; };
  const tails = [grab(() => decodeBase64('YQ==', { strict: 'yes' }), 'decodeBase64'),
    grab(() => fromEpoch(1000.5, 0), 'fromEpoch'), grab(() => generateUsccCodes({ rng: 'nope' }), 'generateUsccCodes')];
  assert.notEqual(tails[0][1], '', 'codec 这一格要是没抛，下面那条 /收到/ 就只是在测兄弟模块');
  for (const [who, msg] of tails) {
    assert.match(msg, /收到 (null|undefined|number|string|boolean|bigint|object|function|symbol|Date|Array\(\d+\))/,
      `${who}：${msg}`);
  }
});
test('L16 扫源：零 import、不碰 DOM、不读环境、不用 Buffer/atob/btoa/TextEncoder', () => {
  const src = lCode();
  // `m` 标志不能少：`^` 不带 `m` 只锚整份源码的开头，"中段插一条 import" 全绿（评审 2026-09-28）
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /export\s+\{[^}]*\}\s+from/],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/],
    ['require(', /\brequire\s*\(/], ['document', /\bdocument\b/], ['window', /\bwindow\b/],
    ['localStorage', /\blocalStorage\b/], ['navigator', /\bnavigator\b/], ['fetch(', /\bfetch\s*\(/],
    ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /\bTextEncoder\b/], ['TextDecoder', /\bTextDecoder\b/],
    ['Date.now', /Date\.now/], ['new Date(', /new Date\(/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['crypto', /\bcrypto\b/],
    ['unescape', /\bunescape\s*\(/], ['eval', /\beval\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `codec.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 23, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  // 三件事必须有牙：闸门常量导出、UTF-8 与 base64 都是自己实现的、位置信息是自己算的
  assert.match(src, /export const MAX_INPUT_BYTES/, '闸门常量必须导出，面板与 §7 的账才对得上');
  assert.equal(/String\.fromCharCode/.test(src), false, '拼字符串走自己那套 UTF-8，不用 fromCharCode 绕');
  assert.match(src, /0xD800/, '代理区这一档必须在代码里判（L3 的拒绝全靠它，只在注释里提等于没实现）');
  assert.ok((src.match(/BASE64_ALPHABET/g) || []).length >= 2, '字母表要"定义 + 使用"两处都在');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/codec.js')), false,
    'codec.js 被挪到 dev/js/ 顶层会变成 vite 入口、进产物（§6.1 零重叠，同 K18）');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/codec.js')), true, '文件不在它该在的位置时，上面那条是空转的');
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const hits = readdirSync(siteJs).filter((f) => f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('splitQuery'));
    assert.deepEqual(hits, [], '构建产物里出现了 codec.js 的导出名');
  }
});
test('L17 两句口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', () => {
  const b64rows = [
    [/按 UTF-8 字节/, encodeBase64('\u4e2d\u6587').out === '5Lit5paH'],
    [/剥掉空白/, decodeBase64('YW Jj').out === 'abc' && decodeBase64('YW Jj').whitespaceDropped === 1],
    [/缺的尾部 padding 补齐并注明/, decodeBase64('YQ').paddingImplied === 2],
    [/字母表外/, decodeBase64('YWJ*').ok === false && /字母表/.test(decodeBase64('YWJ*').reason)],
    [/长度不合法/, decodeBase64('Y').ok === false && /长度/.test(decodeBase64('Y').reason)],
    [/不是合法 UTF-8/, decodeBase64('/w==').ok === false],
    [/1 MiB\uff081048576 字节\uff09/, MAX_INPUT_BYTES === 1048576],
    [/整体拒绝、不截断/, encodeBase64('a'.repeat(MAX_INPUT_BYTES + 1)).out === ''],
  ];
  const urlRows = [
    [/encodeURI 与 encodeURIComponent 两档/, urlPair('a/b').encodeURI === 'a/b'
      && urlPair('a/b').encodeURIComponent === 'a%2Fb'],
    [/「\+」不当作空格/, decodeUrlComponent('a+b').out === 'a+b'],
    [/只按「&」切分/, splitQuery('a=1&b=2').length === 2],
    [/「;」不切/, splitQuery('a=1;b=2').length === 1],
    [/第一个「=」处切一次/, splitQuery('k=a=b')[0].value === 'a=b'],
    [/保留原文并标注/, splitQuery('%zz=1')[0].key === '%zz' && splitQuery('%zz=1')[0].keyOk === false],
  ];
  for (const [table, text] of [[b64rows, BASE64_CAVEAT], [urlRows, URL_CAVEAT]]) {
    for (const [claim, holds] of table) {
      assert.equal(claim.test(text), holds,
        `文案与实现分叉：${claim}（文案里有=${claim.test(text)}，实现做得到=${holds}）`);
    }
    assert.ok(text.length > 80 && text.length <= 240, `口径句长度不在档内（实际 ${text.length} 字）：${text}`);
  }
  assert.equal(b64rows.length, 8, 'Base64 那张对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.equal(urlRows.length, 6, 'URL 那张对账表同上');
  assert.notEqual(BASE64_CAVEAT, URL_CAVEAT, '两句一模一样等于面板上那两格没有各自的口径');
});
test('L18 导出面：13 个名字一个不多一个不少，面板绑定按这张表', async () => {
  const wanted = ['BASE64_CAVEAT', 'MAX_INPUT_BYTES', 'URL_CAVEAT', 'byteLen', 'decodeBase64',
    'decodeDataUri', 'decodeUrlComponent', 'encodeBase64', 'encodeDataUri', 'encodeUrl',
    'encodeUrlComponent', 'splitQuery', 'urlPair'];
  const got = Object.keys(await import('../dev/js/tools/codec.js')).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} 少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 13, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
});

// ── §M 摘要算法（tools/digest.js，段 3 Task 3）───────────────────────────────
// 两条外部判据源，都不拿自己的输出当标准：MD5 拿 Node 的 `createHash('md5')` 对拍，
// SHA-* 同时拿 `node:crypto` 与 Node 22 的 `globalThis.crypto.subtle` 对拍（后者就是浏览器里
// 那套 WebCrypto 的同一份实现，所以"SHA 走 subtle"这条在测试环境里也量得到）。
// 真浏览器里 `crypto.subtle` 缺席的那条路（非安全上下文）在这里只能靠 `{subtle}` 注入档演，
// 页面侧的实测留给 Task 8——这一格欠了什么，M13 的注释里写着。
const { MAX_TEXT_BYTES, MAX_BYTES, ALGORITHMS, HEX_LEN, DIGEST_CAVEAT,
  byteLen: dByteLen, isBytes, normalizeAlgo, digest, digestAll } = await import('../dev/js/tools/digest.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K 的 kCode、§L 的 lCode 同一形状） */
const dCode = () => read('dev/js/tools/digest.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 判据侧的 UTF-8 编码器：测试环境有 TextEncoder，模块里没有（M16 正是核这件事） */
const bytesOf = (s) => new TextEncoder().encode(s);
/** 外部判据源：算法名 → Node 的 hash 名。这张表**故意与模块无关**，模块里那份漂了这里要红 */
const NODE_NAME = { md5: 'md5', 'sha-1': 'sha1', 'sha-256': 'sha256', 'sha-384': 'sha384', 'sha-512': 'sha512' };
const refHex = (algo, bytes) => createHash(NODE_NAME[algo]).update(bytes).digest('hex');
/** 对拍样本：空串、尾块四个余数、UTF-8 多字节、代理对、控制字符、BMP 边界 */
const M_SAMPLES = ['', 'a', 'ab', 'abc', 'abcd', 'hello world', '\u4e2d\u6587', '\u4e2d',
  '\uD83D\uDE00', '\u0000\u007F\u00FF\u0100', '\u0800', '\uFFFF', '\u{10000}',
  'a=b&c', '  ', '\n\t', 'message digest', '0123456789'];
/** 假 subtle：记调用参数，返回一段确定字节，好把"到底调没调、用什么名字调的"量出来 */
const fakeSubtle = (name = 'SHA-256', fill = [0, 1, 2, 3]) => {
  const calls = [];
  return { calls, subtle: { digest: (algo, data) => {
    calls.push([algo, data]);
    return Promise.resolve(new Uint8Array(fill).buffer);
  } } };
};
test('M1 MD5 对 RFC 1321 A.5 的七条官方向量逐字符相等', async () => {
  const rfc = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a'],
  ];
  assert.equal(rfc.length, 7, '官方向量就七条，少一条等于某一档分支从此不核');
  for (const [s, want] of rfc) {
    const r = await digest('md5', s);
    assert.equal(r.ok, true, JSON.stringify(s.slice(0, 12)));
    assert.equal(r.hex, want, `RFC 1321 向量不等：${JSON.stringify(s.slice(0, 12))}`);
    assert.equal(r.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s.slice(0, 12)));
    assert.equal(refHex('md5', bytesOf(s)), want, '判据源自己得站得住：Node 的 MD5 也必须是这个值');
  }
});
test('M2 MD5 与 Node 的 createHash 逐样本对拍，字节档与文本档同源', async () => {
  for (const s of M_SAMPLES) {
    const r = await digest('md5', s);
    assert.equal(r.ok, true, JSON.stringify(s));
    assert.equal(r.hex, refHex('md5', bytesOf(s)), JSON.stringify(s));
    assert.equal(r.via, 'self', 'MD5 由本站自己实现，走 subtle 就是假结果');
    const b = await digest('md5', bytesOf(s));
    assert.equal(b.hex, r.hex, '同一份字节的文本档与字节档必须同结果');
  }
  // 256 个字节值全跑一遍：单字节值域里藏得住索引与位移的错，两条样本抓不到
  const all = new Uint8Array(256);
  for (let i = 0; i < 256; i++) all[i] = i;
  assert.equal((await digest('md5', all)).hex, refHex('md5', all));
});
test('M3 分组与补位边界：55/56/63/64/65/119/120/127/128/129 全部与 Node 对拍', async () => {
  // 55→56 是"长度字段挤进下一个分组"的那道坎，63→64 是"整块不带补位"的坎，
  // 127→128→129 是两块变三块的坎。MD5 的错九成九长在这几个位置。
  const lens = [0, 1, 54, 55, 56, 57, 62, 63, 64, 65, 71, 118, 119, 120, 127, 128, 129, 191, 192, 320];
  for (const n of lens) {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = (i * 31 + n) & 0xFF;
    const r = await digest('md5', bytes);
    assert.equal(r.ok, true, `n=${n}`);
    assert.equal(r.bytes, n, `n=${n} 的字节数报错了`);
    assert.equal(r.hex, refHex('md5', bytes), `分组边界 n=${n} 与 Node 不等`);
  }
});
test('M4 五档输出形状：小写十六进制、长度按 HEX_LEN 表，SHA 四档与 Node 同结果', async () => {
  for (const algo of ALGORITHMS) {
    const r = await digest(algo, 'abc');
    assert.equal(r.ok, true, algo);
    assert.equal(r.algo, algo, '回显必须是归一之后的规范名');
    assert.equal(r.hex.length, HEX_LEN[algo], `${algo} 的 hex 长度`);
    assert.equal(r.hex, r.hex.toLowerCase(), `${algo} 出大写就等于面板两行看着不一样`);
    assert.match(r.hex, /^[0-9a-f]+$/, `${algo} 的输出必须是十六进制`);
    assert.equal(r.hex, refHex(algo, bytesOf('abc')), `${algo} 与 Node 不等`);
    assert.equal(r.reason, null, algo);
  }
  assert.equal(HEX_LEN.md5, 32); assert.equal(HEX_LEN['sha-1'], 40);
  assert.equal(HEX_LEN['sha-256'], 64); assert.equal(HEX_LEN['sha-384'], 96); assert.equal(HEX_LEN['sha-512'], 128);
  // RFC 3174 / FIPS 180 的 'abc' 官方向量各钉一条，防止"对拍源跟着实现一起漂"
  assert.equal((await digest('sha-1', 'abc')).hex, 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal((await digest('sha-256', 'abc')).hex,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('M5 文本通道与字节通道同结果，脱落的缓冲区单独一档不冒充空输入', async () => {
  const s = '中文😀\n带换行的 data URI 场景';
  const bytes = bytesOf(s);
  for (const algo of ALGORITHMS) {
    const asText = await digest(algo, s);
    const asView = await digest(algo, bytes);
    const asBuffer = await digest(algo, bytes.buffer);
    assert.equal(asText.hex, asView.hex, `${algo}：Uint8Array 与字符串不同`);
    assert.equal(asText.hex, asBuffer.hex, `${algo}：ArrayBuffer 与 Uint8Array 不同`);
    assert.equal(asText.bytes, asView.bytes, `${algo}：两条通道的字节数必须同口径`);
  }
  // 视图的偏移档：一个错位视图必须算成"另一份字节"，不能偷偷从 buffer 头部开始读
  const big = new Uint8Array([0, 0, ...bytesOf('abc')]);
  const view = big.subarray(2);
  assert.equal((await digest('md5', view)).hex, (await digest('md5', 'abc')).hex,
    '带 byteOffset 的视图必须按视图自己的起点读');
  assert.notEqual((await digest('md5', big)).hex, (await digest('md5', view)).hex,
    '整块与尾段同结果＝偏移被吞了，这一条就是那件事的哨兵');
  // 脱落档：`transfer` 出去的缓冲区与它下面的视图，`byteLength` 已经是 0，但它是"读不到"而不是
  // "空输入"。这一条牙齿存在的理由很直白：少了 try，`digest` 会**reject**，破掉规矩 3 的
  // "数据入参永不 reject"，而且整批五格连本该出结果的 MD5 一起丢（评审 2026-09-28）。
  const detached = [];
  const shapes = (() => {
    const a = new ArrayBuffer(1024); const b = new ArrayBuffer(64); const c = new ArrayBuffer(32);
    const u8 = new Uint8Array(b); const dv = new DataView(c);
    structuredClone(a, { transfer: [a] });
    structuredClone(b, { transfer: [b] });
    structuredClone(c, { transfer: [c] });
    return [['ArrayBuffer', a], ['Uint8Array', u8], ['DataView', dv]];
  })();
  for (const [label, v] of shapes) {
    assert.equal(isBytes(v), true, `${label}：脱落后仍然是字节形状，不许掉进文本档被归一成 "..."`);
    const r = await digest('md5', v);
    assert.equal(r.ok, false, `${label}：脱落必须拒，不许当空输入`);
    assert.equal(r.hex, '', label); assert.equal(r.bytes, 0, `${label}：读到的字节数就是 0`);
    assert.match(r.reason, /脱离|detached/, `${label} 的理由要点名脱档：${r.reason}`);
    detached.push(r.reason);
  }
  assert.equal(new Set(detached).size, 1, '三种脱落形状同一句理由，面板才不会写出三种解释');
  const emptyish = await digest('md5', new ArrayBuffer(0));
  assert.equal(emptyish.ok, true, '长度为 0 的缓冲区是空输入（M6 那一档），不许被脱落档误伤');
  assert.equal((await digest('md5', new Uint8Array(0))).ok, true, '同上：视图形状');
  const allDetached = await digestAll(shapes[0][1]);
  assert.equal(allDetached.ok, false); assert.equal(allDetached.reason, allDetached.rows[0].reason);
  assert.equal(allDetached.rows.every((r) => r.ok === false && r.hex === ''), true,
    '并列入口里脱落也是五格同拒—— reject 会让这一格整批消失，包括 MD5');
});
test('M6 空输入是一等公民：五档空串都出官方值，不是拒绝', async () => {
  const empty = {
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    'sha-1': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    'sha-256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'sha-384': '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    'sha-512': 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2'
      + '877eec2f63b931bd47417a81a538327af927da3e',
  };
  assert.equal(empty['sha-512'].length, 128, '硬编码向量自己得先是 128 位，抄漏一位这里就红');
  for (const algo of ALGORITHMS) {
    const r = await digest(algo, '');
    assert.equal(r.ok, true, `${algo}：空串的摘要是有定义的标准结果，不是"没输入"`);
    assert.equal(r.bytes, 0, algo);
    assert.equal(r.hex, refHex(algo, new Uint8Array(0)), `${algo} 与 Node 的空输入不等`);
    assert.equal(r.hex, empty[algo], `${algo} 的官方空值`);
    assert.equal((await digest(algo, new Uint8Array(0))).hex, r.hex, '空字节与空字符串同档');
  }
});
test('M7 算法名归一到规范名，认不出的不猜、digest 直接抛', async () => {
  for (const [v, want] of [['sha256', 'sha-256'], ['SHA-256', 'sha-256'], [' Sha_256 ', 'sha-256'],
    ['SHA256', 'sha-256'], ['md5', 'md5'], ['MD5', 'md5'], ['sha1', 'sha-1'], ['SHA-1', 'sha-1'],
    ['sha-512', 'sha-512']]) {
    assert.equal(normalizeAlgo(v), want, JSON.stringify(v));
    assert.equal((await digest(v, 'abc')).algo, want, `digest 的归一与 normalizeAlgo 分叉：${v}`);
  }
  for (const v of ['sha-0', 'sha-265', 'md4', '', ' ', null, undefined, 256, {}, [], Symbol('x')]) {
    assert.equal(normalizeAlgo(v), null, `normalizeAlgo 应安静地给 null：${String(v)}`);
  }
  for (const v of ['sha-265', '', null, undefined, 256]) {
    await assert.rejects(() => digest(v, 'abc'), (e) => {
      assert.equal(e.name, 'TypeError', JSON.stringify(v));
      assert.match(e.message, /算法名/, e.message);
      assert.match(e.message, /收到 (null|undefined|number|string)/, e.message);
      return true;
    }, `未认出的算法名必须响：${String(v)}`);
  }
  // 静默回落 md5 是最坏的一种"看着有结果"，这里点名它
  await assert.rejects(() => digest('sha-256x', 'abc'), { name: 'TypeError' });
});
test('M8 入参两档与兄弟模块同档：文本归一不抛、无原型对象同抛、字节档直通、只剩对象标签的要拒', async () => {
  const shaOf = (s) => refHex('sha-256', bytesOf(s));
  for (const [v, want] of [[123, '123'], [true, 'true'], [Symbol('s'), 'Symbol(s)'],
    [0, '0'], [NaN, 'NaN'], [[1, 2], '1,2']]) {
    const r = await digest('sha-256', v);
    assert.equal(r.ok, true, String(v));
    assert.equal(r.hex, shaOf(want), `文本归一档位与兄弟模块分叉：${String(v)} → ${want}`);
  }
  const d = await digest('md5', new Date('2026-09-28T00:00:00Z'));
  assert.equal(d.ok, true, 'Date 走文本归一（`parseIdCard(123)` 同一档），不许抛');
  assert.equal(d.hex, refHex('md5', bytesOf(String(new Date('2026-09-28T00:00:00Z')))));
  for (const v of [null, undefined]) {
    const r = await digest('md5', v);
    assert.equal(r.ok, true, String(v)); assert.equal(r.bytes, 0, `${String(v)} 归一成空串`);
    assert.equal(r.hex, 'd41d8cd98f00b204e9800998ecf8427e', '空输入那一档的官方值（与 M6 同一格）');
  }
  const noProto = Object.create(null);
  for (const call of [() => digest('md5', noProto), () => digestAll(noProto)]) {
    await assert.rejects(() => call(), { name: 'TypeError' }, '无原型对象必须同抛，不许静默洗成结论');
  }
  assert.equal(isBytes(new Uint8Array(1)), true);
  assert.equal(isBytes(new ArrayBuffer(1)), true);
  assert.equal(isBytes(Buffer.from('x')), true, 'Node 的 Buffer 是 Uint8Array 的子类，浏览器侧的字节档同一条路');
  assert.equal(isBytes('abc'), false); assert.equal(isBytes(null), false); assert.equal(isBytes(1), false);
  // 归一不抛**不等于**照单全收：`String(new Blob(['x']))` 得到的是 `[object Blob]` 这个**标签**，
  // 给它一个合法摘要就是静默的假成功——`#digest` 的文件那一格会显示"算出来了"（评审 2026-09-28）。
  const tagged = [new Blob(['x']), new File(['abc'], 'a.txt'), {}, { a: 1 }, new Map(), new Set([1])];
  for (const v of tagged) {
    const tag = Object.prototype.toString.call(v);
    const r = await digest('md5', v);
    assert.equal(r.ok, false, `${tag}：只剩默认标签的对象必须拒`);
    assert.equal(r.hex, '', tag);
    assert.match(r.reason, /对象标签/, `${tag} 的理由要点名标签：${r.reason}`);
    assert.notEqual(r.hex, refHex('md5', bytesOf(tag)), `${tag}：不许是"标签串的摘要"`);
  }
  const fileAll = await digestAll(new Blob(['x']));
  assert.equal(fileAll.ok, false);
  assert.equal(fileAll.rows.every((r) => r.ok === false), true, '并列入口里 Blob 五格同拒');
  assert.equal(fileAll.bytes, 13, '字节数照实回显（`[object Blob]` 就是 13 字节），不许谎报 0');
  // 反向哨兵：有实际文本形状的对象照常归一，不许被这条误伤
  assert.equal((await digest('md5', { toString: () => 'mine' })).hex,
    refHex('md5', bytesOf('mine')), '自定义 toString 的内容要认');
  assert.equal((await digest('md5', new String('x'))).hex, refHex('md5', bytesOf('x')),
    'String 包装对象的标签是 `[object String]`，归一结果是 `x`，两者不等就不算标签');
  assert.equal((await digest('md5', [])).ok, true, '空数组归一成空串，是真空值那一档（与 M6 同）');
});
test('M9 文本闸门按字节判：1 MiB 恰好放行、+1 整体拒绝，且与 codec 的闸门同值', async () => {
  assert.equal(MAX_TEXT_BYTES, 1048576, MAX_TEXT_BYTES);
  const { MAX_INPUT_BYTES } = await import('../dev/js/tools/codec.js');
  assert.equal(MAX_TEXT_BYTES, MAX_INPUT_BYTES,
    '两个模块的文本闸门必须同一个数：§7 那句"文本类工具 1MB"只有一份口径');
  assert.equal(dByteLen('中'), 3); assert.equal(dByteLen('中文'), 6); assert.equal(dByteLen('\uD83D\uDE00'), 4);
  assert.equal(dByteLen('abc'), 3); assert.equal(dByteLen(null), 0);
  // 两本模块各带一份 UTF-8 计数（同级模块互不 import 的代价），这把尺子必须两处同长：
  // 只核上面四条硬编码值的话，某一档漂了（比如把代理对算成 2）这里才会红。
  for (const s of M_SAMPLES) assert.equal(dByteLen(s), byteLen(s), `byteLen 与 codec 的分叉：${JSON.stringify(s)}`);
  // 半代理项那一档也要两处同尺：`M_SAMPLES` 里没有一个落单代理项，而 `utf8Len` 恰好在这一档
  // 有分支（按 3 字节计，反正下一档会拒）。两个模块各带一份计数器，这一档漂了没人核就是静默分叉
  // （评审 2026-09-28 的 Minor 5）。
  for (const s of ['\uD83D', '\uD83Dabc', 'ab\uDE00', '\uD83D\uDE00\uD83D']) {
    assert.equal(dByteLen(s), byteLen(s), `半代理项档的分叉：${JSON.stringify(s)}`);
  }
  assert.equal(dByteLen('\uD83D'), 3, '半代理项按 3 字节计：上面那组对拍的锚，钉住绝对值才防得住两处一起漂');
  const atLimit = await digest('md5', 'x'.repeat(MAX_TEXT_BYTES));
  assert.equal(atLimit.ok, true, '正好 1 MiB 是"超过"才拒');
  assert.equal(atLimit.bytes, MAX_TEXT_BYTES);
  const over = await digest('sha-256', 'x'.repeat(MAX_TEXT_BYTES + 1));
  assert.equal(over.ok, false); assert.equal(over.hex, '', '拒绝就不给半截产物');
  assert.equal(over.bytes, MAX_TEXT_BYTES + 1, '越界也要报真实字节数，面板才说得出"你这串多长"');
  assert.match(over.reason, /超过/); assert.match(over.reason, /不截断/);
  assert.match(over.reason, new RegExp(String(MAX_TEXT_BYTES + 1)), over.reason);
  assert.doesNotMatch(over.reason, /第 \d+ 位/, '闸门按字节算，不许给人一个假的字符位');
  // 汉字那一条：闸门是字节、不是字符，1 MiB 的汉字串必须拒（按字符判的实现会在这里红）
  const cjk = await digest('md5', '中'.repeat(349526));
  assert.equal(cjk.ok, false, `按字符判的闸门在这里会放行：${cjk.bytes} 字节`);
  assert.equal(cjk.bytes, 1048578);
});
test('M10 字节闸门单独一档：5 MiB 恰好放行、+1 拒绝，且不能反过来放过文本', async () => {
  assert.equal(MAX_BYTES, 5242880, MAX_BYTES);
  assert.ok(MAX_BYTES > MAX_TEXT_BYTES, '字节通道比文本通道宽，否则"文件走 ArrayBuffer"这条没有意义');
  const atLimit = await digest('sha-256', new Uint8Array(MAX_BYTES));
  assert.equal(atLimit.ok, true); assert.equal(atLimit.bytes, MAX_BYTES);
  const over = await digest('sha-256', new Uint8Array(MAX_BYTES + 1));
  assert.equal(over.ok, false); assert.equal(over.hex, '');
  assert.equal(over.bytes, MAX_BYTES + 1); assert.match(over.reason, /上限|超过/);
  assert.match(over.reason, /字节/);
  // 同一段字节走文本通道就要按文本闸门算：两条通道的闸门不许互相借光
  const textBig = 'x'.repeat(MAX_TEXT_BYTES + 1);
  assert.equal((await digest('sha-256', textBig)).ok, false);
  assert.equal((await digest('sha-256', bytesOf(textBig.slice(0, 100)))).ok, true,
    '字节档的 100 字节当然在两道闸门之内');
  assert.equal((await digest('md5', new Uint8Array(MAX_BYTES + 1))).ok, false,
    'MD5 也吃字节闸门：越界与否与算法无关');
});
test('M11 落单代理项两侧都拒并给位，成对的代理项放行且与 Node 同结果', async () => {
  for (const [s, at] of [['\uD83D', 1], ['a\uDE00b', 2], ['ab\uD83D', 3]]) {
    for (const algo of ['md5', 'sha-256']) {
      const r = await digest(algo, s);
      assert.equal(r.ok, false, `${algo} ${JSON.stringify(s)}`);
      assert.equal(r.hex, '', `${algo}：拒绝就不给半截产物`);
      assert.match(r.reason, /落单代理项/, `${algo} → ${r.reason}`);
      assert.match(r.reason, new RegExp(`第 ${at} 位`), `${algo} → ${r.reason}`);
      assert.equal(r.bytes, dByteLen(s), `${algo} ${JSON.stringify(s)}：拒绝也要回显实测字节数，`
        + '面板那句"你这串多少字节"才有出处（M9 钉了半代理项按 3 字节，这里不是两处一起漂）');
    }
  }
  const pair = await digest('md5', '\uD83D\uDE00');
  assert.equal(pair.ok, true); assert.equal(pair.bytes, 4, '成对代理项是 4 字节，不是 2 字符');
  assert.equal(pair.hex, refHex('md5', bytesOf('\uD83D\uDE00')));
  assert.equal((await digest('sha-512', '😀abc')).hex, refHex('sha-512', bytesOf('😀abc')));
  // 越界优先于代理项：两道都中时先报闸门，免得给一个"第 1048577 位"的假位置
  const both = await digest('md5', 'x'.repeat(MAX_TEXT_BYTES) + '\uD83D');
  assert.equal(both.ok, false); assert.match(both.reason, /上限|超过/, both.reason);
});
test('M12 options 档：只认 subtle 一键、拼错必须响，注入的假 subtle 真被调用', async () => {
  await assert.rejects(() => digest('sha-256', 'abc', { subtlez: 1 }),
    { name: 'TypeError', message: /未知 options 键/ }, '拼错的键静默当默认＝注入白开了');
  await assert.rejects(() => digest('sha-256', 'abc', 'subtle'),
    { name: 'TypeError', message: /options 应为对象/ });
  for (const o of [undefined, null, {}]) {
    const r = await digest('sha-256', 'abc', o);
    assert.equal(r.ok, true, JSON.stringify(o));
    assert.equal(r.hex, refHex('sha-256', bytesOf('abc')), '默认档就是浏览器/Node 的真 subtle');
  }
  await assert.rejects(() => digest('sha-256', 'abc', { subtle: 1 }), (e) => {
    assert.equal(e.name, 'TypeError');
    assert.match(e.message, /options\.subtle/, e.message);
    assert.match(e.message, /收到 number/, e.message);
    return true;
  });
  const { calls, subtle } = fakeSubtle();
  const r = await digest('sha-256', 'abc', { subtle });
  assert.equal(r.ok, true); assert.equal(r.hex, '00010203', '注入档的产物原样回显，才测得到"走的是它"');
  assert.equal(r.via, 'subtle');
  assert.equal(calls.length, 1, `SHA 档必须恰好调一次 subtle，实际 ${calls.length}`);
  assert.deepEqual(calls[0][0], 'SHA-256', 'WebCrypto 认的是大写带横杠那一名');
  assert.equal(calls[0][1] instanceof Uint8Array, true, '喂给 subtle 的必须是 Uint8Array 本体');
  assert.equal(Array.from(calls[0][1]).join(','), Array.from(bytesOf('abc')).join(','));
  const m = fakeSubtle();
  const sync = await digest('md5', 'abc', { subtle: m.subtle });
  assert.equal(sync.ok, true); assert.equal(sync.via, 'self');
  assert.equal(m.calls.length, 0, 'MD5 一次都不许碰 subtle——Node 的 subtle 根本不认 MD5，调了就红');
  assert.equal(typeof digest('md5', 'abc').then, 'function', '五档同一条异步路径，面板才只有一种写法');
});
test('M13 取不到 subtle：SHA 四档明确降级、MD5 不受影响，且 digest 永不 reject', async () => {
  const r = await digest('sha-256', 'abc', { subtle: null });
  assert.equal(r.ok, false); assert.equal(r.hex, '');
  assert.equal(r.via, 'unavailable');
  assert.match(r.reason, /安全上下文/, r.reason);
  assert.match(r.reason, /MD5/, r.reason, '降级文案必须点出"只有 SHA 档受影响"，否则用户以为整格坏了');
  assert.equal(r.bytes, 3, '字节数与能不能算无关');
  assert.equal((await digest('md5', 'abc', { subtle: null })).hex, refHex('md5', bytesOf('abc')),
    '非安全上下文里 MD5 照样出结果——它是本站自己实现的');
  for (const algo of ['sha-1', 'sha-384', 'sha-512']) {
    assert.equal((await digest(algo, 'abc', { subtle: null })).ok, false, algo);
  }
  // 两种坏形状：subtle.digest 同步抛、以及返回 rejected promise，都不许把异常送出模块
  const badSubtle = {
    同步抛: () => { throw new Error('同步炸'); },
    异步拒: () => Promise.reject(new Error('异步炸')),
  };
  for (const [kind, fn] of Object.entries(badSubtle)) {
    const bad = await digest('sha-256', 'abc', { subtle: { digest: fn } });
    assert.equal(bad.ok, false, kind); assert.equal(bad.hex, '', kind);
    assert.match(bad.reason, /同步炸|异步炸/, `${kind}：底层报错文本要带出来，不然面板只能说"失败了"：${bad.reason}`);
    const all = await digestAll('abc', { subtle: { digest: fn } });
    assert.equal(all.ok, false, kind);
    assert.equal(all.rows[0].ok, true, `${kind}：MD5 那一格不该被邻居的炸牵连`);
  }
  // 缺 digest 方法的物件（有人把 window.crypto 整个塞进来）也算不可用，不许 TypeError 出模块
  const weird = await digest('sha-256', 'abc', { subtle: {} });
  assert.equal(weird.ok, false, weird.reason);
  assert.match(weird.reason, /安全上下文|subtle/, weird.reason);
});
test('M14 digestAll：五格并列、行序照 ALGORITHMS、闸门失败同句、单档失败不牵连', async () => {
  const all = await digestAll('a b/c?d=e&f&g=中');
  assert.equal(all.ok, true); assert.equal(all.reason, null);
  assert.deepEqual(all.rows.map((r) => r.algo), ALGORITHMS, '行序就是面板的表序，漂一格面板就错一行');
  assert.equal(all.rows.length, 5);
  assert.deepEqual(Object.keys(all.rows[0]).sort(), Object.keys(await digest('md5', 'x')).sort(),
    '单档入口与并列入口的键集必须一致，否则面板要写两套读法');
  assert.equal(all.bytes, Buffer.byteLength('a b/c?d=e&f&g=中', 'utf8'));
  for (const row of all.rows) {
    assert.equal(row.bytes, all.bytes, '字节数只算一次，五格报同一个数');
    assert.equal(row.hex, refHex(row.algo, bytesOf('a b/c?d=e&f&g=中')), row.algo);
  }
  const over = await digestAll('x'.repeat(MAX_TEXT_BYTES + 1));
  assert.equal(over.ok, false); assert.match(over.reason, /上限|超过/, over.reason);
  for (const row of over.rows) {
    assert.equal(row.ok, false, row.algo); assert.equal(row.hex, '', row.algo);
    assert.equal(row.reason, over.reason, '闸门理由五格同一句，面板才不会写出五种解释');
  }
  const degraded = await digestAll('abc', { subtle: null });
  assert.equal(degraded.ok, false, '有一格不成就是不成，顶层不许报全绿');
  assert.equal(degraded.reason, null, '闸门通过、只是个别档失败时，顶层不另编一句理由');
  assert.equal(degraded.rows[0].ok, true, 'MD5 那格必须还成——并列展示的价值就在这里');
  assert.equal(degraded.rows.filter((r) => !r.ok).length, 4);
  assert.equal(degraded.bytes, 3);
  const lone = await digestAll('\uD83D');
  assert.equal(lone.ok, false); assert.match(lone.reason, /落单代理项/, lone.reason);
  assert.equal(lone.rows.every((r) => r.reason === lone.reason), true, '代理项也是五格同句');
});
test('M15 导出面：10 个名字一个不多一个不少，两张表互相核得住', async () => {
  const wanted = ['ALGORITHMS', 'DIGEST_CAVEAT', 'HEX_LEN', 'MAX_BYTES', 'MAX_TEXT_BYTES',
    'byteLen', 'digest', 'digestAll', 'isBytes', 'normalizeAlgo'];
  const got = Object.keys(await import('../dev/js/tools/digest.js')).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} 少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 10, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
  assert.deepEqual([...ALGORITHMS], ['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512'],
    '顺序也是契约：面板的五行按它排');
  assert.deepEqual(Object.keys(HEX_LEN).sort(), [...ALGORITHMS].sort(),
    'HEX_LEN 的键集与 ALGORITHMS 必须同集，少一档就有一行面板没尺子');
  assert.equal(Object.isFrozen(ALGORITHMS), true, '共享表必须冻结（段 2 的共享表只读口径）');
  assert.equal(Object.isFrozen(HEX_LEN), true);
});
test('M16 扫源：零 import、不碰 DOM、不用 Node 专属件，MD5 的常数必须在代码里', () => {
  const src = dCode();
  // `m` 标志不能少：`^` 不带 `m` 只锚整份源码的开头，"中段插一条 `import … from './codec.js'`"全绿
  // （评审 2026-09-28 实测；§L 同一处同病，两处一起改。`export * from` 与动态 `import()` 也在补的两条里）
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /export\s+\{[^}]*\}\s+from/],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/],
    ['require(', /\brequire\s*\(/], ['node:crypto', /node:crypto/], ['createHash', /\bcreateHash\b/],
    ['document', /\bdocument\b/], ['window', /\bwindow\b/], ['localStorage', /\blocalStorage\b/],
    ['navigator', /\bnavigator\b/], ['fetch(', /\bfetch\s*\(/], ['FileReader', /\bFileReader\b/],
    ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /\bTextEncoder\b/], ['TextDecoder', /\bTextDecoder\b/],
    ['Date.now', /Date\.now/], ['new Date(', /new Date\(/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['unescape', /\bunescape\s*\(/], ['eval', /\beval\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `digest.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 25, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  // 自实现的证据：初值、K 表 64 项、移位表 64 项，三样都得在代码里，不是注释里
  assert.match(src, /0x67452301/, 'MD5 的 A 初值必须在（换成 crypto.subtle 的假 MD5 时这里就没了）');
  assert.match(src, /0x10325476/, 'MD5 的 D 初值必须在');
  const kTable = (src.match(/0xd76aa478[\s\S]*?0xeb86d391/) || [''])[0].match(/0x[0-9a-f]{8}/gi) || [];
  assert.equal(kTable.length, 64, `K 表要恰好 64 项常数，读到 ${kTable.length} 项`);
  assert.equal(/Math\.sin/.test(src), false, 'K 表必须是硬编码常数：引擎的 Math.sin 不保证逐位一致');
  assert.ok((src.match(/globalThis/g) || []).length >= 1, '取 subtle 走 globalThis，不写 window.crypto');
  assert.equal(/\bwindow\.crypto\b/.test(src), false, '同上：window 在违禁清单里，这一条是它的正面');
  assert.match(src, /subtle/, 'SHA 档确实经过 subtle');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/digest.js')), false,
    'digest.js 被挪到 dev/js/ 顶层会变成 vite 入口、进产物（§6.1 零重叠，同 K18）');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/digest.js')), true, '文件不在它该在的位置时，上面那条是空转的');
  // **口径在段 3 Task 7 收窄过一次**（原来写的是"任何产物里都搜不到"）：那句成立于 Task 3 落
  // 地时——那时仓库里只有证件页那一本入口。`toolCodec.js` 一存在，`digestAll` 的家就有了，
  // 旧句子不再是"发现渗透"，而是每次构建后必红的假警报。剩下的不变量因此是**排除式的**：
  // 除了编码页那一本，谁都不许出现这个名字（证件页那本、公共层那本、以及哪天 Rollup 真的
  // 切出共享 chunk 都会被抓回来）。正向那一半同样要人看：名字来自 `digest.js` 里
  // `gateOptions('digestAll', …)` 那句自报家门的诊断串，它要是从产物里没了，就是接线断了的
  // 那一刻——改诊断写法可以，但得同时来改这一格，别让它静默变成一句谁都不核的话。
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const HOME = 'toolCodec.min.js';
    const hits = readdirSync(siteJs).filter((f) => f !== HOME && f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('digestAll'));
    assert.deepEqual(hits, [], `digest.js 的导出名渗进了 ${HOME} 以外的产物`);
    if (existsSync(resolve(siteJs, HOME))) {
      assert.ok(readFileSync(resolve(siteJs, HOME), 'utf8').includes('digestAll'),
        `${HOME} 在产物里却没有 digestAll：digest.js 没被打进编码页那本，接线与这条判据要一起改`);
    }
  }
});
test('M17 口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', async () => {
  const rows = [
    [/MD5 由本站自己实现/, (await digest('md5', 'abc')).via === 'self'],
    [/SHA-1、SHA-256、SHA-384、SHA-512 走浏览器/, (await digest('sha-256', 'abc')).via === 'subtle'],
    [/取不到时给明确提示/, (await digest('sha-256', 'abc', { subtle: null })).via === 'unavailable'],
    [/文本按 UTF-8 字节/, (await digest('md5', '中')).bytes === 3],
    [/1 MiB（1048576 字节）/, MAX_TEXT_BYTES === 1048576],
    [/5 MiB（5242880 字节）/, MAX_BYTES === 5242880],
    [/整体拒绝、不截断/, (await digest('md5', 'x'.repeat(MAX_TEXT_BYTES + 1))).hex === ''],
    [/文件走字节、不进字符串/, (await digest('sha-256', bytesOf('abc'))).hex === (await digest('sha-256', 'abc')).hex],
  ];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(DIGEST_CAVEAT), holds,
      `文案与实现分叉：${claim}（文案里有=${claim.test(DIGEST_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 8, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(DIGEST_CAVEAT.length > 80 && DIGEST_CAVEAT.length <= 240,
    `口径句长度不在档内（实际 ${DIGEST_CAVEAT.length} 字）：${DIGEST_CAVEAT}`);
  const { BASE64_CAVEAT, URL_CAVEAT } = await import('../dev/js/tools/codec.js');
  const { TIME_CAVEAT } = await import('../dev/js/tools/time.js');
  const others = [BASE64_CAVEAT, URL_CAVEAT, TIME_CAVEAT];
  for (const o of others) assert.notEqual(DIGEST_CAVEAT, o, '四格口径句各写各的，一模一样等于这一格没自己的口径');
  assert.equal(dByteLen('中'), 3, '口径句里的"UTF-8 字节"这把尺子自己得先对');
});
test('M18 跨块大输入与闸门边界同档：1 MiB 的 MD5 与 Node 逐字符等', async () => {
  const big = new Uint8Array(MAX_TEXT_BYTES);
  big.fill(0xAA);
  const r = await digest('md5', big);
  assert.equal(r.ok, true); assert.equal(r.bytes, MAX_TEXT_BYTES);
  assert.equal(r.hex, refHex('md5', big), '16384 个分组里出错，跨块那条判据才抓得到');
  const five = await digest('sha-256', new Uint8Array(MAX_BYTES).fill(7));
  assert.equal(five.ok, true); assert.equal(five.bytes, MAX_BYTES);
  assert.equal(five.hex, refHex('sha-256', new Uint8Array(MAX_BYTES).fill(7)));
  const text = '中'.repeat(100000);
  assert.equal((await digest('sha-512', text)).hex, refHex('sha-512', bytesOf(text)),
    'UTF-8 编码器在长多字节串上必须与 Node 同字节');
});

// ── §N 正则测试（tools/regex.js，段 3 Task 4）───────────────────────
// 这一格的对拍源是**引擎自己**：正则语义以 native `RegExp` / `matchAll` / `replace` 为准
// （不像 §M 拿 Node crypto 当外部标准），所以判据只核两件事——
//   ① 本模块交给面板的结果必须与 native 逐格一致（不许自己重发明一套 `$` 或 lastIndex 口径）；
//   ② 四道闸门必须真的在：模式长度、输入字节、静态可疑形状、匹配次数与档间预算。
// "防炸页"的主牙齿是②里的静态检测。JS 没有可打断的回溯步数计数器，**单次 `exec` 内部无法熔断**，
// 所以 §7 那句"匹配步数上限 + 超时保护"落地成四档事实，N9 与 N14 各钉一处，不许写成假承诺。
// 下面每一档形状的去留都是本机 Node 22.19 / V8 实测（同一进程、必须是"匹配失败"的输入形状）：
//   `(a+)+$` 22 字符 839ms、28 >2s ┊ `(?:\s*\w+)*$` 20 字符 30.8ms ┊ `(\w*\s?)+$` 20 字符 66.1ms
//   `(x+a+)+$` 20 字符 0.0ms（迭代边界被必填的定宽字符钉住，故列不进真阳性）
//   `(a{1,3})+$` 32 字符 5.4s 与 `(?:[([]{2,})+` 28 字符 29.4ms 起草时列在"不得误判"，实测归入真阳性。
// F2 一族的阈值同样实测过（同一失败形状下逐档加倍）：`(a|a)+` 24→1012ms、`(x|xx|xxx)+` 32→5518ms、
// `(x|xx)+` 40→6356ms、`(aa|aaaa)+` 64→247ms（每 8 字符 ×60，128 字符就是天文数字）——
// 起草时把 `(-|--)\s*$` 当作 F2 样本，实测 28 字符 0.0ms：组上没有量词就没有放大，样本已换成 `(-|--)+`
// （24→4.0ms、28→40.1ms，斐波那契档）。`(\d{1,3}|\d)+` 起草时列在"不得误判"，实测 16 字符 823ms、
// 20 字符 4319ms，已移进 N11 的真阳性族。
const { REGEX_CAVEAT, ALLOWED_FLAGS, MAX_PATTERN_CHARS, MAX_INPUT_BYTES: RE_INPUT_BYTES, MAX_MATCHES,
  MEDIUM_MAX_INPUT_CHARS, TIME_BUDGET_MS, byteLen: nByteLen, normalizeFlags, compile, riskScan,
  findMatches, previewReplace } = await import('../dev/js/tools/regex.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§L/§M 同一形状） */
const nCode = () => read('dev/js/tools/regex.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('N1 flags 白名单七位各自可用、重复归一、未知那位点名拒绝', () => {
  assert.equal(ALLOWED_FLAGS, 'gimsuyd', '白名单就这七位：加一位要有新判据，删一位要改 CAVEAT');
  for (const ch of ALLOWED_FLAGS) {
    const r = normalizeFlags(ch);
    assert.equal(r.ok, true, `${ch} 必须在白名单内`);
    assert.equal(r.flags, ch);
    assert.equal(r.deduplicated, false);
  }
  assert.equal(normalizeFlags('gi').flags, 'gi');
  assert.equal(normalizeFlags('gig').flags, 'gi', '重复位归一：native 对 gg 直接抛，面板不该拿一个抛');
  assert.equal(normalizeFlags('gig').deduplicated, true, '归一了要回显，否则用户以为两位都在');
  assert.equal(normalizeFlags('').flags, '');
  assert.equal(normalizeFlags(null).flags, '', '文本档：null 归一成空串，不抛');
  for (const bad of ['A', 'v', 'U', 'gp', 'gGG', 'uv']) {
    const r = normalizeFlags(bad);
    assert.equal(r.ok, false, `${bad} 里有不在白名单的位，必须拒`);
    assert.equal(r.flags, '', '拒了就不给半截 flags');
    assert.match(r.reason, /不在白名单/);
    for (const ch of bad) {
      if (ALLOWED_FLAGS.includes(ch)) continue;
      assert.match(r.reason, new RegExp(ch), `${bad} → ${r.reason}：要点名是哪一位`);
    }
  }
  assert.equal(compile('a', 'g').ok, true);
  assert.equal(compile('a', 'gg').ok, true, 'compile 先过归一再过 native，gg 不再是抛的口径');
  assert.equal(compile('a', 'gg').flags, 'g');
  assert.equal(compile('a', 'A').ok, false);
  assert.equal(compile('a', 'A').kind, 'flags');
});
test('N2 编译失败逐类给 V8 原话，并分成 pattern / flags / 长度三档', () => {
  const cases = [['(', 'Unterminated group'], [')', "Unmatched ')'"], ['[a', 'Unterminated character class'],
    ['*', 'Nothing to repeat'], ['(?', 'Invalid group'], ['a{3,2}', 'numbers out of order'],
    ['[z-a]', 'Range out of order'], ['a\\', '\\ at end of pattern'], ['(?<', 'Invalid capture group name'],
    ['(?<1a>x)', 'Invalid capture group name'], ['(a', 'Unterminated group']];
  for (const [src, msg] of cases) {
    const r = compile(src, '');
    assert.equal(r.ok, false, `${src} 必须编译失败`);
    assert.equal(r.regex, null, '失败时不许把一个半残 RegExp 交出去');
    assert.equal(r.kind, 'pattern', `${src} 的档位应是 pattern：${r.reason}`);
    assert.match(r.reason, new RegExp(msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${src} 应当报「${msg}」，实际「${r.reason}」`);
  }
  assert.equal(cases.length, 11, '报错分类表要有条数：漏一类等于那一类从此静默归到别的档');
  assert.equal(compile('a', 'A').kind, 'flags');
  assert.equal(compile('a'.repeat(MAX_PATTERN_CHARS + 1), '').kind, 'length');
  assert.match(compile('a'.repeat(MAX_PATTERN_CHARS + 1), '').reason, /超过/);
  assert.equal(compile('a'.repeat(MAX_PATTERN_CHARS), '').ok, true, '正好到上限要放行（"超过"才拒）');
  assert.equal(compile('', '').ok, true, '空模式是合法的：它匹配空串');
  assert.equal(compile('(?<=a)b', '').ok, true, '后行断言 native 认，别在分词器里当非法语法');
});
test('N3 模式长度闸门排在最前：报实测数与上限，拒了不跑静态检测', () => {
  const long = '((((a+)+)))'.padEnd(MAX_PATTERN_CHARS + 1, 'b');
  const r = findMatches(long, '', 'aaa');
  assert.equal(r.ok, false); assert.equal(r.executed, false);
  assert.equal(r.matches.length, 0, '越界时不许给半截结果');
  assert.match(r.reason, new RegExp(String(long.length)));
  assert.match(r.reason, new RegExp(String(MAX_PATTERN_CHARS)));
  assert.equal(r.level, null, '长度这一档排在静态检测之前，level 不该被填上');
  assert.equal(r.bytes, undefined, '长度拒时不该报字节，字节是输入那一层的数');
  assert.equal(previewReplace(long, '', 'x', 'y').ok, false, '替换预览吃同一道闸门');
  assert.equal(previewReplace(long, '', 'x', 'y').out, '', '同样不给半截产物');
});
test('N4 单次匹配与 native 逐格一致：整段、组序、命名组、未参与组', () => {
  const m = findMatches('(\\d+)-(\\d+)', '', 'no 2026-0928 here');
  assert.equal(m.ok, true); assert.equal(m.count, 1);
  assert.equal(m.matches[0].text, '2026-0928');
  assert.equal(m.matches[0].index, 3);
  assert.equal(m.matches[0].length, 9);
  assert.deepEqual(m.matches[0].groups.map((g) => g.text), ['2026', '0928']);
  const oracle = new RegExp('(\\d+)-(\\d+)').exec('no 2026-0928 here');
  assert.equal(m.matches[0].index, oracle.index, 'index 必须与 native 同格，不许自己数');
  const none = findMatches('(a)|(b)', '', 'b');
  assert.equal(none.matches[0].groups[0].participated, false, '第 1 组没参与');
  assert.equal(none.matches[0].groups[0].text, undefined);
  assert.equal(none.matches[0].groups[1].participated, true);
  const named = findMatches('(?<y>\\d{4})-(?<m>\\d{2})', '', 'x 2026-09');
  assert.equal(named.matches[0].named.y.text, '2026');
  assert.equal(named.matches[0].named.m.text, '09');
  assert.deepEqual(Object.keys(named.matches[0].named), ['y', 'm'], '命名表按声明顺序，面板才排得出列');
  const empty = findMatches('()x', '', 'x');
  assert.equal(empty.matches[0].groups[0].participated, true, '空串命中也叫"参与了"：只有 undefined 才是没参与');
  assert.equal(empty.matches[0].groups[0].text, '', '组文本原样给空串，面板才显示得出"这一组存在但为空"');
  const emptyNamed = findMatches('(?<e>)x', '', 'x');
  assert.equal(emptyNamed.matches[0].named.e.participated, true, '命名组同一档：拿 !== undefined 判才分得开空串与没参与');
  assert.equal(emptyNamed.matches[0].named.e.text, '');
  assert.equal(findMatches('(a)', '', 'b').count, 0, '没命中是 count 0，不是 ok false');
});
test('N5 有 d 才有组位置，没 d 时位置是 null 而不是猜', () => {
  const noD = findMatches('a(b)(c)', '', 'xxabcxx');
  assert.equal(noD.ok, true);
  assert.equal(noD.matches[0].index, 2, '整段位置不依赖 d');
  assert.equal(noD.matches[0].groups[0].index, null, '没有 d 就没有 indices，猜出来的位置是假数据');
  assert.equal(noD.matches[0].groups[0].length, null);
  assert.equal(noD.matches[0].groups[0].text, 'b', '文本仍然给：那一档 exec 本来就有');
  const withD = findMatches('a(?<x>b)(c)', 'd', 'xxabcxx');
  assert.equal(withD.ok, true);
  assert.equal(withD.matches[0].groups[0].index, 3);
  assert.equal(withD.matches[0].groups[1].index, 4);
  assert.equal(withD.matches[0].named.x.index, 3, '命名组的位置来自 indices.groups');
  assert.equal(withD.matches[0].named.x.length, 1);
  const miss = findMatches('(a)(b)', 'd', 'cb');
  assert.equal(miss.ok, true); assert.equal(miss.count, 0);
  assert.equal(miss.matched, false, 'matched 给面板当"没匹配上"用，与 ok 分开');
  assert.equal(findMatches('a(b)', 'd', 'zzz').matches.length, 0);
  assert.equal(findMatches('a', '', 'a').matched, true);
});
test('N6 多匹配的 index 序列与 matchAll 逐格对拍（含多字节与换行）', () => {
  const samples = [['\\d+', 'g', 'a1 bb222 ccc33 d4e5'], ['[a-z]+', 'gi', 'AbC-ddd-e'],
    ['\\w+', 'g', '中文 abc 123 éè'], ['.', 'g', 'a\nb'], ['.', 'gs', 'a\nb'],
    ['^a', 'gm', 'a\nba\nb'], ['a$', 'gm', 'a\nba\nb'], ['(a)(b)', 'g', 'aabb'],
    ['\\p{L}+', 'gu', 'abc中文'], ['(?<k>[a-z]+)', 'gd', 'x yy zzz'], ['a*', 'g', 'xaxa']];
  for (const [src, flags, input] of samples) {
    const gflags = flags.includes('g') ? flags : `${flags}g`;
    const r = findMatches(src, flags, input);
    assert.equal(r.ok, true, `${src}/${flags} → ${r.reason}`);
    const all = [...input.matchAll(new RegExp(src, gflags))];
    assert.deepEqual(r.matches.map((m) => m.index), all.map((m) => m.index), `${src}/${gflags} 的 index 序列`);
    assert.deepEqual(r.matches.map((m) => m.text), all.map((m) => m[0]), `${src}/${gflags} 的整段文本`);
  }
  const noG = findMatches('\\d+', '', 'a1 b2 c3');
  assert.equal(noG.count, 1, '不带 g 只给第一次命中：这是 native 口径，不是本模块的阉割');
  assert.equal(noG.matches[0].text, '1');
  const sticky = findMatches('a', 'y', 'baa');
  assert.equal(sticky.count, 0, 'sticky 从 0 起算，b 不命中：与 native 同档');
  assert.equal(findMatches('a', 'gy', 'ab').count, 1);
});
test('N7 零宽匹配手动推进，不死循环也不漏格', () => {
  const r = findMatches('a*', 'g', 'bbb');
  assert.equal(r.ok, true);
  assert.equal(r.count, 4, `'bbb'.match(/a*/g) 实测 4 格，少一格是多算、多一格是死循环前兆`);
  assert.deepEqual(r.matches.map((m) => m.index), [0, 1, 2, 3]);
  assert.deepEqual(r.matches.map((m) => m.length), [0, 0, 0, 0]);
  const mid = findMatches('x*', 'g', 'xaxa');
  assert.deepEqual(mid.matches.map((m) => m.text), ['x', '', 'x', '', '']);
  assert.equal(findMatches('', 'g', 'ab').count, 3, '空模式在 n 个字符上有 n+1 个零宽命中');
  assert.equal(findMatches('', 'g', 'ab').hitLimit, false);
  assert.equal(findMatches('\\b', 'g', 'a b cd').count, [...'a b cd'.matchAll(/\b/g)].length,
    '词边界全是零宽，推进一档都不能错');
  assert.equal(findMatches('(?=x)', 'g', 'xxy').count, [...'xxy'.matchAll(/(?=x)/g)].length);
});
test('N8 匹配次数上限：hitLimit 的语义是"还有一格没列出来"', () => {
  const more = 'a '.repeat(MAX_MATCHES + 1).trim();
  const r = findMatches('a', 'g', more);
  assert.equal(r.ok, true);
  assert.equal(r.count, MAX_MATCHES);
  assert.equal(r.hitLimit, true, '后面还有一格没列出来时必须报 hitLimit');
  assert.match(r.reason, /上限/); assert.match(r.reason, new RegExp(String(MAX_MATCHES)));
  const exact = findMatches('a', 'g', 'a '.repeat(MAX_MATCHES).trim());
  assert.equal(exact.count, MAX_MATCHES);
  assert.equal(exact.hitLimit, false, '正好用满不算截断：这一格的红绿就是"静默截断"的分界');
  assert.equal(exact.reason, null);
  const capped = findMatches('a', 'g', 'aaaaaa', { maxMatches: 3 });
  assert.equal(capped.count, 3); assert.equal(capped.capped, 3); assert.equal(capped.hitLimit, true);
  const over = findMatches('a', 'g', 'aaaaaa', { maxMatches: MAX_MATCHES + 10 });
  assert.equal(over.capped, MAX_MATCHES, 'options 只能往下调，不许越过面板的硬上限');
  const zero = findMatches('a', 'g', 'aaa', { maxMatches: 0 });
  assert.equal(zero.capped, 1, '给了 0 / 负数按 1 兜，不给"一个都不算"的静默档');
  assert.equal(zero.count, 1);
  const neg = findMatches('a', 'g', 'aaa', { maxMatches: -5 });
  assert.equal(neg.capped, 1);
});
test('N9 档间时间预算靠注入时钟，没给时钟就只按次数收口', () => {
  let tick = 0;
  const now = () => (tick += 12);
  const r = findMatches('a', 'g', 'a '.repeat(200).trim(), { now, timeBudgetMs: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.timedOut, true, '每格 12ms、预算 50ms → 必须在中途收口');
  assert.equal(r.count, 4, '第 4 格后累计 48ms 不超、第 5 格前 60ms 超：这个数字就是预算的牙');
  assert.equal(r.hitLimit, false, '时间到点不是次数到点，两面旗子不许互相顶');
  assert.equal(r.elapsedMs, 60);
  assert.match(r.reason, /时间预算/);
  const noClock = findMatches('a', 'g', 'a '.repeat(200).trim());
  assert.equal(noClock.elapsedMs, null, '本模块不许自己读时钟：没注入就报 null');
  assert.equal(noClock.timedOut, false);
  assert.equal(noClock.count, 200);
  const nan = findMatches('a', 'g', 'aaa', { now: () => Number.NaN });
  assert.equal(nan.timedOut, false, '时钟给了非数字就当没时钟，不许因为 NaN 比较而永远不超时');
  assert.equal(nan.count, 3);
  const defaultBudget = findMatches('a', 'g', 'a '.repeat(200).trim(), { now });
  assert.equal(defaultBudget.timedOut, true, '不给 timeBudgetMs 时用 TIME_BUDGET_MS 这一档默认');
  assert.equal(defaultBudget.count, Math.floor(TIME_BUDGET_MS / 12));
  assert.equal(typeof TIME_BUDGET_MS, 'number');
});
test('N10 输入字节闸门：超 1 MiB 整体拒，正好到线放行，字节数按 UTF-8 那把尺', () => {
  const big = 'a'.repeat(RE_INPUT_BYTES + 1);
  const r = findMatches('a', '', big);
  assert.equal(r.ok, false); assert.equal(r.executed, false);
  assert.equal(r.bytes, RE_INPUT_BYTES + 1);
  assert.match(r.reason, /1048576/); assert.match(r.reason, /不截断/);
  assert.equal(r.matches.length, 0);
  const atLimit = findMatches('zzz', '', 'a'.repeat(RE_INPUT_BYTES));
  assert.equal(atLimit.ok, true, '正好 1 MiB 放行：越界才拒');
  assert.equal(atLimit.bytes, RE_INPUT_BYTES);
  assert.equal(findMatches('a', '', '中'.repeat(2)).bytes, 6, '中文按 UTF-8 三字节计，不是字符数');
  assert.equal(nByteLen('中'), 3); assert.equal(nByteLen('\uD83D\uDE00'), 4);
  assert.equal(findMatches('a', '', null).bytes, 0, 'null 走文本档归一成空串');
  const repl = previewReplace('a', 'g', big, 'b');
  assert.equal(repl.ok, false); assert.match(repl.reason, /1048576/);
  assert.equal(repl.out, '', '替换预览越界时给空串，不给半截');
});
test('N11 静态检测 F1：组外无界重复 + 组内没有钉死边界的定宽元素，全族报 high', () => {
  const family = ['(a+)+', '(a*)*', '(?:a+)+', '((a+)+)', '(\\d+)+', '([a-z]+)+', '([ )]+)+',
    '(a+){2,}', '(a{1,3})+', '(a{2,})+', '(\\w*\\s?)+', '([)]+)+', '(?:\\s*\\w+)*', '(?:[([]{2,})+',
    '(\\d{1,3}|\\d)+'];
  assert.equal(family.length, 15, '真阳性族要有条数：少一条等于那一档形状没人守');
  for (const src of family) {
    const r = riskScan(src);
    assert.equal(r.level, 'high', `${src} 应是 high，实际 ${r.level} ${JSON.stringify(r.findings)}`);
    assert.equal(r.parsed, true, `${src} 必须能被分词器走完`);
    assert.ok(r.findings.length >= 1, `${src} 要给出命中的构造位置`);
    assert.ok(r.findings[0].at >= 0 && r.findings[0].at < src.length,
      `${src} 的位置 ${r.findings[0].at} 落在串外`);
    assert.equal(r.findings.every((f) => /F[1-4]/.test(f.rule)), true, `${src} 每条命中都要点规则名`);
    assert.match(r.findings[0].hint, /收紧|量词|拆成|改写/, `${src} 的提示要给出改写方向`);
  }
  assert.equal(riskScan('^(\\d{1,3})+$').level, 'high', '带锚不改变形状：锚不是牙齿');
  assert.equal(riskScan('a(b(c+)+d)e').level, 'high', '嵌套三层里的 F1 也要抓到');
  assert.equal(riskScan('(a+)').level, 'none', '组外没有量词就没有放大');
});
test('N12 静态检测 F2：分支互为整数倍重复 + 组外无界，报 high；同长不重叠不报', () => {
  const high = ['(a|a)*', '(a|aa)+', '(aa|aaaa)*', '(ab|abab)+', '(x|xx|xxx)*', '(-|--)+',
    '(\\d|\\d\\d)+', '(?:a|aa){3}'];
  assert.equal(high.length, 8, 'F2 族同样要有条数：这一族的阈值实测在 24–64 字符之间，缺一条就没人守');
  for (const src of high) {
    const r = riskScan(src);
    assert.equal(r.findings.some((f) => f.rule === 'F2'), true,
      `${src} 的分支互为整数倍，应点名 F2：${JSON.stringify(r.findings)}`);
  }
  assert.equal(riskScan('(?:a|aa){3}').level, 'medium', '组外是有限重复 → medium 而非 high');
  const safe = ['(a|b)*', '(ab|abc)+', '(test|testing)+', '(\\w|\\d)+', '([a-z]|[0-9])+', '(a|ab)*',
    '(x|xx)', '(a|aa)'];
  for (const src of safe) {
    const r = riskScan(src);
    assert.equal(r.findings.some((f) => f.rule === 'F2'), false,
      `${src} 的分支不构成整数倍包含或组外无重复，不该报 F2：${JSON.stringify(r.findings)}`);
  }
  assert.equal(riskScan('(a|a)').level, 'none', '形状本身不犯忌，组外的无界重复才是');
});
test('N13 静态检测不许误杀：类里的括号、转义、被定宽元素钉住的组尾、单一无界量词', () => {
  const none = ['[(]', '[)]', '([)]+)', '[(a+)+]', '(?:[([]{2,})', 'a+b+', '(a+)b', '(a+)?',
    '(a+){1}', '(a{3})+', '(\\d{1,3},)*', '(\\d+,)+\\d+', '([a-z]+\\s)+', '(a\\s*)+', '^[a-z]+$',
    'x?', '(a|b|ab)+', '[\\]]+\\(', '\\(a\\+\\)\\+', '(?:\\d{1,3}\\.){4}', '([a-z]+)([0-9]+)',
    '((a)(b))+', 'a{100,}', '(x+a+)+', '([a-z]+[0-9]+)+', 'a*a?b', '(?<name>[a-z]+)', '[]a[]',
    '[^]]*', '(a)', '\\d{4}-\\d{4}', '(?:[\\d.]+)', '^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$',
    '(?:[ab]+c)+', '(a|b)*[^a-z]*'];
  for (const src of none) {
    const r = riskScan(src);
    assert.equal(r.level, 'none', `${src} 不该被判风险，实际 ${r.level} ${JSON.stringify(r.findings)}`);
    assert.equal(r.parsed, true, `${src} 分词器要能走完，走不完等于检测器自己哑了`);
  }
  assert.equal(none.length, 35, '假阳性红线要有条数：漏一条等于那一档形状没人守');
  assert.equal(riskScan('([)]+)').level, 'none', '类里的 ) 不算闭组：这条是 35 个样本里最容易失守的一处');
  assert.equal(riskScan('(?:[([]{2,})+').level, 'high', '形似样本的另一半：类里两个字符 + {2,} + 组外 + 是真阳性');
  const med = ['a*a*a*a*a', '.*.*.*', '(a+){3}', '(a+){4}', '\\w*\\w*', '[a-z]*[a-z]*', 'a+a+'];
  for (const src of med) assert.equal(riskScan(src).level, 'medium', `${src} 应是 medium`);
  assert.equal(riskScan('a*a*a*a*a').findings[0].rule, 'F3', '串联同源的无界量词点 F3');
  assert.equal(riskScan('(?').level, 'none', '非法语法交给 compile 报原话，静态检测不越权报错');
  assert.equal(riskScan('[a').parsed, false, '走不完就标 parsed:false，不许把半成品当"没风险"');
});
test('N14 high 根本不进引擎；medium 把输入压到 128 字符，越线拒', () => {
  const r = findMatches('(a+)+$', '', 'a'.repeat(30));
  assert.equal(r.ok, false); assert.equal(r.level, 'high');
  assert.equal(r.executed, false, '这一格的牙齿就是"引擎一次都没被调用"');
  assert.equal(r.matches.length, 0);
  assert.match(r.reason, /疑似灾难性回溯/); assert.match(r.reason, /F1/);
  assert.match(r.reason, /一次都不执行/, '要明说没执行，否则用户以为算过了');
  assert.equal(findMatches('(a+)+$', '', '').ok, false, '空输入也不给放行后门');
  assert.throws(() => findMatches('(a+)+$', '', 'aaa', { allowRisky: true }), /不认识的键：allowRisky/,
    '没有 allowRisky 这一档后门：能绕的闸门不是闸门，options 闸门先把它响掉');
  const med = findMatches('a*a*a*a*a', '', 'a'.repeat(100));
  assert.equal(med.level, 'medium'); assert.equal(med.ok, true); assert.equal(med.executed, true);
  assert.match(med.reason, /可疑/);
  const medLong = findMatches('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS + 1));
  assert.equal(medLong.ok, false); assert.equal(medLong.executed, false);
  assert.equal(medLong.level, 'medium');
  assert.match(medLong.reason, new RegExp(String(MEDIUM_MAX_INPUT_CHARS)));
  assert.match(medLong.reason, /不截断/, '拒的时候要连"没截断"一起说：只报"实际 129 字符"，面板看着像只算了前 128 格');
  assert.equal(findMatches('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS)).ok, true, '正好 128 放行');
  const clean = findMatches('\\d{1,3}', '', '123456');
  assert.equal(clean.level, 'none'); assert.equal(clean.reason, null, '没风险就别糊黄条');
  assert.equal(previewReplace('(a|aa)*', 'g', 'a'.repeat(30), 'x').executed, false,
    '替换预览走同一道静态闸门');
  assert.equal(previewReplace('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS + 1), 'x').ok, false);
});
test('N15 替换预览与 native 逐字节一致，$ 的四种写法各有硬账', () => {
  const cases = [['(a+)(b+)', 'g', 'xx aabb yy', '[$1|$2<$1>$$&$`$\'|$0]'],
    ['(x*)', 'g', 'ab', '<$0>'], ['(\\w+)', 'g', 'a b', '$&-$1|$$'],
    ['(?<k>[a-z]+)', 'g', 'aa bb', '[$<k>]'], ['a', 'g', 'banana', '$$'],
    ['(a)(b)?', 'g', 'ac', '[$1][$2]'], ['a', '', 'aaa', 'X'], ['(a)', 'gy', 'baa', 'X'],
    ['\\s*', 'g', 'a  b', '|'], ['(?<a>x)(y)?', 'g', 'xx', '[$<a>][$<b>]']];
  for (const [src, flags, input, repl] of cases) {
    const mine = previewReplace(src, flags, input, repl);
    assert.equal(mine.ok, true, `${src} → ${mine.reason}`);
    assert.equal(mine.out, input.replace(new RegExp(src, flags), repl),
      `${src}/${flags} 的替换结果必须与 native 逐字节相同`);
    assert.equal(mine.changed, mine.out !== input, 'changed 就是"产物与原文是否不同"，面板靠它决定要不要给复制');
  }
  assert.equal(cases.length, 10, '对拍样本要有条数');
  assert.equal(previewReplace('(a+)(b+)', 'g', 'aabb', '[$1|$2]').out, '[aa|bb]');
  assert.equal(previewReplace('(x*)', 'g', 'ab', '<$0>').out, '<$0>a<$0>b<$0>',
    '$0 不是替换记号：这是 native 口径，"顺手修正"它等于改出个新语言');
  assert.equal(previewReplace('a', 'g', 'aaa', '$$').out, '$$$',
    '$$ 出一个字面 $，三处命中就是三个 $（native 实测，别按直觉写成 $a$a$）');
  assert.equal(previewReplace('aa', 'g', 'aaa', '$&$&').out, 'aaaaa',
    '$& 是整段命中：开头两处 aa 各换成 aaaa，尾部剩的那个 a 原样留着（native 实测， lastIndex 落在 2 之后不再命中）');
  assert.equal(previewReplace('(a)', 'g', 'ab', '[$`$\'|x]').out, '[b|x]b', '前导/后随切片按 native 原样给');
  assert.equal(previewReplace('(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)', 'g', 'abcdefghijk', '$11').out, 'k',
    '$11 在 11 个组时是第 11 组，不是 $1 后接字符 1');
  assert.equal(previewReplace('a', 'g', 'abc', 123).out, '123bc', '替换串走文本档归一，不抛');
});
test('N16 两档入参：文本档归一不抛，options 档走 TypeError 并报出形状', () => {
  for (const v of [null, undefined, 123, true, ['a'], { toString: () => 'x' }, new Date(0)]) {
    const r = findMatches('a', '', v);
    assert.equal(typeof r.bytes, 'number', `文本入参 ${String(v)} 不该抛`);
    assert.equal(typeof r.ok, 'boolean');
  }
  assert.equal(findMatches('a', '', undefined).bytes, 0);
  assert.equal(findMatches('a', '', 123).matches.length, 0, '123 → "123"，里面没有 a');
  assert.equal(findMatches('1', '', 123).count, 1, '数字进文本档要按十进制串算');
  assert.equal(findMatches(null, '', 'x').ok, true, 'pattern 也走文本档：null 当空模式，不抛');
  assert.equal(findMatches('a', '', Symbol('x')).bytes, 9,
    'String(Symbol) 出 "Symbol(x)"：与 §K/§L/§M 同档，归一之后照文本算');
  assert.equal(findMatches('a', '', Symbol('x')).count, 0, '"Symbol(x)" 里没有裸 a，归一成串之后照样判');
  assert.throws(() => findMatches('a', '', Object.create(null)), TypeError,
    '无原型对象是唯一会抛的那一档：String() 自己抛，本站不替它兜');
  assert.equal(previewReplace('a', 'g', 'aa', Symbol('y')).out, 'Symbol(y)Symbol(y)',
    '替换串同样走文本档：Symbol 归一成 "Symbol(y)"，与 §L 的 encodeUrlComponent 同一口径');
  for (const bad of [1, 'x', true, ['a'], new Date(0)]) {
    assert.throws(() => findMatches('a', '', 'x', bad), /options 只收对象，收到 /);
    assert.throws(() => findMatches('a', '', 'x', bad), TypeError);
  }
  assert.throws(() => findMatches('a', '', 'x', { now: 1 }), /now 要的是函数，收到 number/);
  assert.throws(() => findMatches('a', '', 'x', { maxMatches: 'x' }), /maxMatches 要的是数字，收到 string/);
  assert.throws(() => findMatches('a', '', 'x', { timeBudgetMs: 'x' }), /timeBudgetMs 要的是数字，收到 string/);
  assert.throws(() => findMatches('a', '', 'x', { sloppy: 1 }), /options 里有不认识的键：sloppy/);
  assert.equal(findMatches('a', '', 'x', { now: null, maxMatches: null }).ok, true,
    'null / undefined 的键走默认档，不是报错档');
  assert.throws(() => compile('a', 123, 456), /收到 number/, 'compile 没有 options 档：多给一位同样要响');
});
test('N17 闸门先后有账：形状在前、字节在后，medium 的 128 数的是字符不是字节', () => {
  const riskyHuge = findMatches('(a+)+$', '', 'a'.repeat(RE_INPUT_BYTES + 1));
  assert.equal(riskyHuge.level, 'high', '高危形状要先响：否则用户把输入改小还是一句"太大"');
  assert.match(riskyHuge.reason, /疑似灾难性回溯/);
  assert.equal(riskyHuge.bytes, undefined, '形状这一档排在字节之前，不该报字节');
  const medShapeCjk = findMatches('a*a*a*a*a', '', '中'.repeat(200));
  assert.equal(medShapeCjk.ok, false);
  assert.equal(medShapeCjk.bytes, 600, '600 字节远在 1 MiB 之内，拦住它的是 128 字符这一档');
  assert.match(medShapeCjk.reason, /128/);
  const cleanCjk = findMatches('\\d+', 'g', '中'.repeat(500));
  assert.equal(cleanCjk.ok, true); assert.equal(cleanCjk.bytes, 1500);
  assert.equal(cleanCjk.level, 'none');
  const medCjkOk = findMatches('a*a*a*a*a', '', '中'.repeat(100));
  assert.equal(medCjkOk.ok, true, '100 个汉字：字节 300 早过 128，字符没超——这一档数的是字符，按字节判的实现在这条红');
  assert.equal(medCjkOk.bytes, 300, '放行也要把实测字节照实回显，别让"过了"看起来像没量');
  assert.equal(medCjkOk.executed, true); assert.match(medCjkOk.reason, /128 字符/);
  const tooLongPattern = findMatches('('.repeat(MAX_PATTERN_CHARS + 1), '', 'x');
  assert.equal(tooLongPattern.level, null, '长度这一档在形状之前，level 留 null');
  assert.equal(tooLongPattern.bytes, undefined, '连输入都没读，字节当然没有');
});
test('N18 CAVEAT 里承诺的每一个数都得是导出的那个常数', async () => {
  const rows = [[/1 MiB（1048576 字节）/, () => RE_INPUT_BYTES === 1048576],
    [/500 字符/, () => MAX_PATTERN_CHARS === 500],
    [/前 1000 个/, () => MAX_MATCHES === 1000],
    [/128 字符/, () => MEDIUM_MAX_INPUT_CHARS === 128],
    [/g i m s u y d/, () => ALLOWED_FLAGS === 'gimsuyd'],
    [/疑似灾难性回溯/, () => riskScan('(a+)+').level === 'high'],
    [/一次都不执行/, () => findMatches('(a+)+', '', 'aaa').executed === false],
    [/不静默截断/, () => findMatches('a', 'g', 'a '.repeat(MAX_MATCHES + 1).trim()).hitLimit === true]];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(REGEX_CAVEAT), holds(),
      `文案与实现分叉：${claim}（文案里有=${claim.test(REGEX_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 8, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(REGEX_CAVEAT.length > 80 && REGEX_CAVEAT.length <= 260,
    `口径句长度不在档内（实际 ${REGEX_CAVEAT.length} 字）：${REGEX_CAVEAT}`);
  const { BASE64_CAVEAT, URL_CAVEAT } = await import('../dev/js/tools/codec.js');
  const { TIME_CAVEAT } = await import('../dev/js/tools/time.js');
  const { DIGEST_CAVEAT } = await import('../dev/js/tools/digest.js');
  for (const o of [BASE64_CAVEAT, URL_CAVEAT, TIME_CAVEAT, DIGEST_CAVEAT]) {
    assert.notEqual(REGEX_CAVEAT, o, '五格口径句各写各的，一模一样等于这一格没自己的口径');
  }
  assert.equal(nByteLen('中'), 3, '口径句里"UTF-8 字节"这把尺子自己得先对');
});
test('N19 违禁源扫描、零重叠、不成 vite 入口', () => {
  const src = nCode();
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /^\s*export.*from/m],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/], ['require(', /\brequire\s*\(/],
    ['node:', /['"]node:/], ['createHash', /\bcreateHash\b/], ['document', /\bdocument\b/],
    ['window', /\bwindow\b/], ['getElementById', /getElementById/], ['querySelector', /querySelector/],
    ['addEventListener', /addEventListener/], ['localStorage', /localStorage/], ['fetch(', /\bfetch\s*\(/],
    ['FileReader', /FileReader/], ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /TextEncoder/], ['TextDecoder', /TextDecoder/], ['Date.now', /Date\.now/],
    ['new Date(', /new Date\(/], ['performance.now', /performance\.now/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['unescape', /\bunescape\s*\(/],
    ['eval', /\beval\s*\(/], ['new Function', /new\s+Function\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `regex.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 29, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  assert.equal(/new\s+RegExp\s*\(/.test(src), true, '这一格的本职就是构造 RegExp，正向断言防它哪天换成 eval');
  assert.match(src, /lastIndex\s*\+=\s*1/, '零宽推进必须写在代码里，不是注释里');
  assert.equal(/\bwhile\s*\(\s*true\s*\)/.test(src), false, '不许出现无边界的 while(true)');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/regex.js')), false, '旧位置 dev/js/regex.js 不该存在');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/regex.js')), true, '新位置必须在，否则上一条是空转的');
  const vite = read('vite.config.js');
  const at = vite.indexOf('getDevJsEntries');
  assert.ok(at > -1, '入口表由 getDevJsEntries 决定，找不到这个名字说明地基变了');
  assert.match(vite.slice(at, at + 900), /readDirSorted/,
    'dev/js 一层扫描走 readDirSorted（内部是 readdirSync(dir).sort()，不递归）：改成递归就该来改这条');
  assert.equal(/tools/.test(vite.slice(at, at + 900)), false, '这一层里没有 tools/ 字样，子目录不成入口');
  // 与 M16 同一条收窄（段 3 Task 7）：`findMatches` 的家是编码页那本产物，判据因此改成
  // 排除式——除它以外谁都不许有；正向那一半盯的是 `regex.js` 里 `readOptions(opts, 'findMatches')`
  // 那句自报家门的诊断串，它进不了产物就说明装配层的接线断了。
  const site = resolve(ROOT, '_site/assets/js');
  if (existsSync(site)) {
    const HOME = 'toolCodec.min.js';
    for (const f of readdirSync(site)) {
      if (!f.endsWith('.js') || f === HOME) continue;
      assert.equal(read(join(site, f)).includes('findMatches'), false, `产物 ${f} 里不该出现 regex 的导出名`);
    }
    if (existsSync(join(site, HOME))) {
      assert.ok(read(join(site, HOME)).includes('findMatches'),
        `${HOME} 在产物里却没有 findMatches：regex.js 没被打进编码页那本，接线与这条判据要一起改`);
    }
  }
});
test('N20 导出面：13 个名字一个不多一个不少，Task 6 的面板绑定按这张表', async () => {
  const wanted = ['ALLOWED_FLAGS', 'MAX_INPUT_BYTES', 'MAX_MATCHES', 'MAX_PATTERN_CHARS',
    'MEDIUM_MAX_INPUT_CHARS', 'REGEX_CAVEAT', 'TIME_BUDGET_MS', 'byteLen', 'compile', 'findMatches',
    'normalizeFlags', 'previewReplace', 'riskScan'];
  const mod = await import('../dev/js/tools/regex.js');
  const got = Object.keys(mod).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} `
    + `少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 13, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
  for (const k of ['byteLen', 'compile', 'findMatches', 'normalizeFlags', 'previewReplace', 'riskScan']) {
    assert.equal(typeof mod[k], 'function', `${k} 必须是函数：面板按这个名字直接调`);
  }
  for (const k of ['ALLOWED_FLAGS', 'REGEX_CAVEAT']) {
    assert.equal(typeof mod[k], 'string', `${k} 必须是串：白名单与口径句都是要显示给用户的东西`);
  }
  for (const k of ['MAX_INPUT_BYTES', 'MAX_MATCHES', 'MAX_PATTERN_CHARS', 'MEDIUM_MAX_INPUT_CHARS',
    'TIME_BUDGET_MS']) assert.equal(typeof mod[k], 'number', `${k} 必须是数字：闸门常数写成串会静默放行`);
});

// ── §O 复制三件套抽离（`tools/ui.js`，段 3 Task 5）─────────────────────────
// 本节测的是**从 `workbench.js` 搬出来的那三个辅助**，不测页面接线：接线仍由 §J 那十六判
// 原样兜着（J7 的九个小节就是这次搬迁的回归网，一条都没改、也不许改）。搬迁有两条约言在先
// 的红线，本节各钉一处：
//   ① **`ui.js` 必须像 `view.js` 一样零 import**。它一旦被 import 进两本装配层，两个页面入口
//      就各 reach 一份，产物立刻变成带 `import{` 的废文件（实测记录在 `toolkitCore.js` 开头）。
//      O2 拿源码文本守这一条，J14 那份"不许 import"的名单里也必须有它。
//   ② **只搬不改行为**：三级兜底的顺序、两条时长、四句文案，逐字符照搬段 2 落地的那一份。
//      O4–O12 按"输入形状 → 文案 / 时长 / 副作用"三条观察口逐档钉死，J7 再从页面那一头复认一次。
// 一处口径先写在这儿，免得读代码时以为谁手滑多写了一遍：`copyInto` 里那道"没按钮 / 没文本
// 就早退"与调用方 `doCopy` 的同一条判断是**故意重复**的。codec 页要直接调 `copyInto`，那时
// 没有人替它判空；早退被摘掉的后果是"按一条还没内容的复制按钮 → 剪贴板是空的、按钮却说已复制"。
// O12 咬的就是这一档。
const { COPY_RESET_MS, COPY_FAIL_MS, flash, legacyCopy, copyInto } = await import('../dev/js/tools/ui.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§L/§M/§N 同一形状） */
const oCode = () => read('dev/js/tools/ui.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 假 DOM 仍只有 §I 那一份工厂（`iPage`）——不为复制这一件小事长第二套夹具。
 * 本节只取它的 `doc` / `mk` 与三张观察口（`selLog` / `commandLog` / `created`），
 * 面板骨架那一半一次都不读。
 * @returns {object} §I 的 page
 */
const oPage = () => iPage();

/** 造一条带原文案的按钮；`textContent` 走子节点，与真 DOM 同一张脸 */
const oBtn = (page, text = '复制这批号码') => {
  const btn = page.mk('button', 'o-btn');
  btn.textContent = text;
  return btn;
};

/** `later` 的夹具：只记账不执行，`flush()` 才把还原那一下放出来（与 §J 的 `timers` 同形状） */
const oTimers = () => {
  const due = [];
  return {
    due,
    later: (fn, ms) => { due.push({ fn, ms }); return due.length; },
    flush: () => { const list = due.splice(0, due.length); for (const t of list) t.fn(); return list; },
  };
};

/** 兜底造出来的临时框只认带 `readonly` 的那几条（与 §J7 同一个数法，不靠"造了几个节点"猜） */
const oBoxes = (page) => page.made.filter((e) => e.tagName === 'TEXTAREA'
  && e.getAttribute('readonly') === 'readonly');

/**
 * 等微任务队列落地：`writeText` 那一级的成败是异步的，而注入的 `later` 只记账不跑。
 * 用的是全局 `setTimeout`，不是注入给 `ui.js` 的那只——后者一执行就会把按钮文案改回去。
 * @returns {Promise<void>} Promise 链落地
 */
const oSettle = () => new Promise((r) => { setTimeout(r, 0); });

test('O1 导出面：五个名字一个不多一个不少，两常数三函数', async () => {
  const mod = await import('../dev/js/tools/ui.js');
  const wanted = ['COPY_FAIL_MS', 'COPY_RESET_MS', 'copyInto', 'flash', 'legacyCopy'];
  const got = Object.keys(mod).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} `
    + `少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 5, '这五名就是 `window.Tk.ui` 的全部家当：加一个名字要同步 J12 的清单与 toolkitCore 的注释');
  for (const k of ['flash', 'legacyCopy', 'copyInto']) {
    assert.equal(typeof mod[k], 'function', `${k} 必须是函数：两页的装配层按这个名字直接调`);
  }
  for (const k of ['COPY_RESET_MS', 'COPY_FAIL_MS']) {
    assert.equal(typeof mod[k], 'number', `${k} 必须是数字：时长写成串会静默变成"永不还原"`);
  }
});

test('O2 源码红线：零 import、零宿主全局，注入的那三样就是它的全部世界', () => {
  const src = oCode();
  assert.equal(/\bimport\b/.test(src), false,
    '一条 import 都不许有：两个入口 reach 同一模块就成共享 chunk，产物当场变废文件（toolkitCore.js 开头那条实测）');
  assert.equal(/\brequire\(/.test(src), false, 'CommonJS 同理，而且浏览器里压根不存在');
  for (const glob of ['window.', 'document.', 'navigator.', 'localStorage', 'globalThis']) {
    assert.equal(src.includes(glob), false,
      `${glob} 不许直接读：宿主对象一律由调用方注入（doc / clipboard / later），否则假 DOM 驱动不了这一本`);
  }
  assert.equal((src.match(/\bsetTimeout\b/g) || []).length, 1,
    '全文件只许 `flash` 缺省那一档碰宿主计时器；时长口径归注入的 `later`，多一处就没法在测试里钉住');
  assert.equal(src.includes('innerHTML'), false, '这一本只改 `textContent`、只挂临时节点，不产 HTML：产 HTML 是 view.js 的活');
});

test('O3 两条时长：值钉死 1600 / 2600，失败那句必须比成功那句长', () => {
  assert.equal(COPY_RESET_MS, 1600, '成功那句的停留时长是段 2 定下的口径，改它要有新判据，不是顺手调参');
  assert.equal(COPY_FAIL_MS, 2600);
  for (const [name, ms] of [['COPY_RESET_MS', COPY_RESET_MS], ['COPY_FAIL_MS', COPY_FAIL_MS]]) {
    assert.equal(Number.isInteger(ms), true, `${name} 要的是整数毫秒：小数或 NaN 走进宿主 setTimeout 是哪一档没人管`);
    assert.equal(ms > 0, true, `${name} 必须是正数：0 或负数等于"改口之后立刻还原"，用户看不见那一句`);
  }
  assert.equal(COPY_FAIL_MS > COPY_RESET_MS, true,
    '两句的相对长短是口径不是巧合：失败那句要被人读完才动得起来，倒过来挂就等于没说');
});

test('O4 flash：改口立刻生效、还原排进注入的 later、时长原样透传', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  flash(btn, '已复制', 1600, '复制这批号码', t.later);
  assert.equal(btn.textContent, '已复制', '调用当期就要看到新文案，异步改口等于没有反馈');
  assert.equal(t.due.length, 1, '改口要能改回来，就得留下一条恢复用的回调');
  assert.equal(t.due[0].ms, 1600, '时长原样透传给宿主：ui 层不替页面决定停留多久');
  assert.equal(page.doc.body.childNodes.length, 0, 'flash 只动文案，不往页面上挂任何东西');
  const released = t.flush();
  assert.equal(released.length, 1);
  assert.equal(btn.textContent, '复制这批号码', '排下去的那条必须真的还原成传进来的原文案');
  // 同一格排两次（连点）：两条各还原各的，先排的那条不许被后一条顶掉
  const btn2 = oBtn(page, '复制这批代码');
  flash(btn2, '已复制', COPY_RESET_MS, '复制这批代码', t.later);
  flash(btn2, '复制失败，请手动选中', COPY_FAIL_MS, '复制这批代码', t.later);
  assert.equal(btn2.textContent, '复制失败，请手动选中');
  assert.deepEqual(t.due.map((x) => x.ms), [COPY_RESET_MS, COPY_FAIL_MS]);
  t.flush();
  assert.equal(btn2.textContent, '复制这批代码', '原文案只有一份，两条回调落在同一格上不会把"已复制"存成新原文案');
});

test('O5 flash 不给 later：落回宿主 setTimeout，还原照样发生', async () => {
  const page = oPage();
  const btn = oBtn(page);
  flash(btn, '已复制', 0, '复制这批号码');
  assert.equal(btn.textContent, '已复制');
  await new Promise((r) => { setTimeout(r, 20); });
  assert.equal(btn.textContent, '复制这批号码',
    '缺省那一档被摘掉的话，页面没注入 `later` 时按钮永远停在"已复制"——这一档没人看，只有真跑一次才暴露');
  assert.equal(page.doc.body.childNodes.length, 0, '缺省路径同样不许往页面上留东西');
});

test('O6 legacyCopy 成功：readonly 框挂 body → select → execCommand("copy") → 摘净、返回 true', () => {
  const page = oPage();
  const before = page.created();
  const ok = legacyCopy(page.doc, '110101199003070018');
  assert.equal(ok, true, 'execCommand 返回 true 就是复制上了，别再要求第二样证据');
  assert.equal(page.created() - before, 1, '一次复制只造一条临时框');
  assert.deepEqual(page.commandLog, ['copy']);
  assert.equal(page.selLog.length, 1, '不 select 就 execCommand，复制的是用户的选区不是临时框');
  assert.equal(page.selLog[0].tagName, 'TEXTAREA');
  assert.equal(page.selLog[0].value, '110101199003070018', '复制的必须是传进去的那份文本');
  assert.equal(page.selLog[0].getAttribute('readonly'), 'readonly',
    '不写 readonly，select() 就把用户的页面变成一次真编辑（光标跳走、原有选区丢掉）');
  assert.equal(oBoxes(page).length, 1);
  assert.equal(page.doc.body.childNodes.length, 0, '用完必须从 body 上摘掉：留在页里就是一个能被 Tab 走到的隐形输入框');
});

test('O7 legacyCopy 的两种"没复制上"：execCommand 说不行 / 根本没这只手，都返回 false 且摘净', () => {
  const a = oPage();
  a.doc.copyOk = false;
  assert.equal(legacyCopy(a.doc, 'x'), false, 'execCommand 返回 false 就是失败，不许当成功报');
  assert.deepEqual(a.commandLog, ['copy'], 'execCommand 在，就要真的问过它');
  assert.equal(a.selLog.length, 1, '失败也要留一条被选中过的框：这一级的失败靠用户手动 Ctrl+C 兜');
  assert.equal(a.doc.body.childNodes.length, 0);
  assert.equal(oBoxes(a).length, 1);

  const b = oPage();
  b.doc.execCommand = undefined;
  assert.equal(legacyCopy(b.doc, 'x'), false, '连 execCommand 都没有（个别环境把 document 裁过）时这一级算失败');
  assert.deepEqual(b.commandLog, [], '没有 execCommand 就不该假装调用过它');
  assert.equal(b.selLog.length, 1);
  assert.equal(b.doc.body.childNodes.length, 0, '这一级也要在 finally 里摘掉临时框');
});

test('O8 legacyCopy：`appendChild` 自己抛时不许再调 `removeChild`（那会把一次失败变成一次抛出）', () => {
  const page = oPage();
  let removed = 0;
  page.doc.body.appendChild = () => { throw new Error('boom'); };
  page.doc.body.removeChild = (n) => { removed += 1; return n; };
  let ok;
  assert.doesNotThrow(() => { ok = legacyCopy(page.doc, 'x'); },
    '挂不上去是这一级的失败，不是抛出——抛出会顺着按钮回调跑到页面外面');
  assert.equal(ok, false);
  assert.equal(removed, 0, '临时框根本没挂上去，对着它 removeChild 必抛 NotFoundError');
  assert.equal(page.selLog.length, 0, '没挂上就别 select：选中一个不在文档里的节点没有意义');
  assert.deepEqual(page.commandLog, [], '没挂上就别 execCommand：那复制的是用户原来的选区');
});

test('O9 legacyCopy：`select()` 与 `execCommand()` 抛错都走 finally，临时框照样摘净', () => {
  const a = oPage();
  const realCreate = a.doc.createElement;
  a.doc.createElement = (tag) => {
    const el = realCreate(tag);
    el.select = () => { throw new Error('boom'); };
    return el;
  };
  let okA;
  assert.doesNotThrow(() => { okA = legacyCopy(a.doc, 'x'); });
  assert.equal(okA, false, 'select 抛就是这一级失败，不许报成功');
  assert.equal(a.selLog.length, 0, '抛掉的那次 select 没成功选中');
  assert.deepEqual(a.commandLog, [], 'select 都没过去，就不该问 execCommand');
  assert.equal(a.doc.body.childNodes.length, 0, 'finally 那条摘节点的口子是这一节唯一的兜底，摘一次就留下一个隐形输入框');
  assert.equal(oBoxes(a).length, 1, '临时框确实造出来过：这一刀测的是"挂上之后抛"');

  const b = oPage();
  b.doc.execCommand = () => { throw new Error('boom'); };
  let okB;
  assert.doesNotThrow(() => { okB = legacyCopy(b.doc, 'x'); });
  assert.equal(okB, false);
  assert.equal(b.selLog.length, 1);
  assert.equal(b.doc.body.childNodes.length, 0);
});

test('O10 copyInto 没有可用的 clipboard：兜底成败对应那两句文案与那两条时长', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  copyInto({ btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later });
  assert.deepEqual(page.commandLog, ['copy'], '没有 navigator.clipboard 时不该什么都不做');
  assert.equal(btn.textContent, '已复制');
  assert.equal(t.due.length, 1);
  assert.equal(t.due[0].ms, COPY_RESET_MS);
  t.flush();
  assert.equal(btn.textContent, '复制这批号码');

  // 兜底也说"不行" → 失败那一句，时长走失败档
  page.doc.copyOk = false;
  copyInto({ btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later });
  assert.equal(btn.textContent, '复制失败，请手动选中');
  assert.equal(t.due[0].ms, COPY_FAIL_MS, '失败那句要给人时间读完');
  assert.equal(t.due[0].ms > COPY_RESET_MS, true);
  assert.equal(page.doc.body.childNodes.length, 0, '连失败都不许留下临时框');
  t.flush();
  assert.equal(btn.textContent, '复制这批号码');

  // 有 `clipboard` 这只手、却没有 `writeText` 那根手指：同步走兜底，不许留下一条永远不落的 Promise
  const c = oPage();
  const btnC = oBtn(c);
  const tC = oTimers();
  copyInto({ btn: btnC, text: 'abc', original: '复制这批号码', clipboard: {}, doc: c.doc, later: tC.later });
  assert.deepEqual(c.commandLog, ['copy'], 'writeText 缺席就直接退到 execCommand');
  assert.equal(btnC.textContent, '已复制');
  assert.equal(tC.due.length, 1, '这一条必须同步排下去：等一个永远不会来的 Promise 就是把反馈吞了');
});

test('O11 copyInto 的三条剪贴板路：成功 / 异步拒绝 / 同步抛，一条都不许抛到页面外面', async () => {
  // (a) 首选 `navigator.clipboard`：不碰 execCommand，也不往 body 上挂东西
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    const writes = [];
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: (v) => { writes.push(v); return Promise.resolve(); } },
    });
    await oSettle();
    assert.deepEqual(writes, ['abc'], '复制的是那串纯文本，不是结果区的 HTML');
    assert.equal(btn.textContent, '已复制');
    assert.equal(t.due[0].ms, COPY_RESET_MS);
    assert.deepEqual(page.commandLog, [], '这一级根本不需要 execCommand');
    assert.equal(page.doc.body.childNodes.length, 0, '走剪贴板就不该在页面上长出临时输入框');
    t.flush();
    assert.equal(btn.textContent, '复制这批号码');
  }
  // (b) 剪贴板被拒（异步 reject）→ 退到临时框，兜底成功了就别报失败
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    const writes = [];
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: (v) => { writes.push(v); return Promise.reject(new Error('NotAllowedError')); } },
    });
    await oSettle();
    assert.equal(writes.length, 1, '先试过剪贴板，退路才是 execCommand');
    assert.deepEqual(page.commandLog, ['copy']);
    assert.equal(oBoxes(page).length, 1, '兜底只该造一条临时框');
    assert.equal(btn.textContent, '已复制', '兜底成功了就别报失败');
    assert.equal(t.due[0].ms, COPY_RESET_MS, '退路成功走的也是成功那一档时长');
    assert.equal(page.doc.body.childNodes.length, 0);
  }
  // (c) `writeText` 直接同步抛（不返回 Promise）：与异步拒绝同一条退路
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    assert.doesNotThrow(() => copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: () => { throw new Error('SecurityError'); } },
    }), '权限策略拒绝时 writeText 可能直接抛，那正是"不许抛到页面外面"点名的场景');
    await oSettle();
    assert.deepEqual(page.commandLog, ['copy'], '同步抛错也要退到 execCommand');
    assert.equal(btn.textContent, '已复制');
  }
  // (d) 剪贴板与兜底双双失败 → 一句失败文案，仍然不抛
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    page.doc.copyOk = false;
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
    });
    await oSettle();
    assert.equal(btn.textContent, '复制失败，请手动选中');
    assert.equal(t.due[0].ms, COPY_FAIL_MS);
    assert.equal(page.doc.body.childNodes.length, 0);
  }
});

test('O12 copyInto 的"没东西可复制"早退：剪贴板、临时框、按钮文案三样都不碰', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  let writes = 0;
  const clipboard = { writeText: () => { writes += 1; return Promise.resolve(); } };
  const before = page.created();
  copyInto({ btn, text: '', original: '复制这批号码', clipboard, doc: page.doc, later: t.later });
  assert.equal(writes, 0, '空文本一次都不该写');
  assert.deepEqual(page.commandLog, [], '空文本也不该走兜底');
  assert.equal(page.created(), before, '空文本一次都不该造临时框');
  assert.equal(t.due.length, 0, '什么都没复制，就别改口');
  assert.equal(btn.textContent, '复制这批号码');
  // 按钮缺席（骨架缺那一格）：不抛、也不碰剪贴板
  copyInto({ btn: null, text: 'abc', original: '复制这批号码', clipboard, doc: page.doc, later: t.later });
  assert.equal(writes, 0, '没有按钮就没地方改口，剪贴板也不该被白写一次');
  assert.equal(page.created(), before);
  // 整包什么都没给（`{}`）：同一早退，不抛
  assert.doesNotThrow(() => copyInto({}), '调用方漏传不等于页面塌：这一本的第一句话就该是"没得复制，收工"');
  assert.doesNotThrow(() => copyInto());
});

test('O13 抽离不留第二份实现：装配层经 `Tk.ui` 拿，缺它就构造期抛；core 挂第四只', async () => {
  // (a) `createWorkbench` 的闸门：缺 `Tk.ui.copyInto` 必须当场点名，
  //     而不是等用户第一次点复制按钮时才从回调里抛出去（那时结果是"按了没反应"）。
  const bare = { document: oPage().doc, Tk: { view: J_VIEW }, runGuarded: () => true };
  assert.throws(() => createWorkbench(bare),
    (err) => err instanceof TypeError && /Tk\.ui/.test(err.message) && /copyInto/.test(err.message),
    '闸门没拦住"缺 ui"，或者拦住了却没点名 copyInto');
  assert.throws(() => createWorkbench({ ...bare, Tk: { view: J_VIEW, ui: {} } }),
    (err) => err instanceof TypeError && /copyInto/.test(err.message),
    '挂了一只没有 copyInto 的 ui 也算缺：装配层只认它要调的那一根手指');

  // (b) `workbench.js` 源码里那四处定义一处不留——搬迁要一次搬干净，
  //     留下第二份实现的下场是"改了一份、页面上跑的是另一份"。
  const wb = read('dev/js/tools/workbench.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const shape of ['const flash =', 'function legacyCopy', 'const COPY_RESET_MS', 'const COPY_FAIL_MS']) {
    assert.equal(wb.includes(shape), false, `workbench.js 里还留着 ${shape}`);
  }
  assert.equal(/ui\.copyInto\(/.test(wb), true, 'doCopy 必须真的改口去调 Tk.ui.copyInto，不然 (a) 那道闸门白加');

  // (c) `toolkitCore.js` 挂第四只，且它是唯一 import `ui.js` 的地方。
  //     这里重开一次 `globalThis.window` 再按新 query 载 core——同一个 query 会被模块缓存
  //     挡住，那样读到的是 J12 那一次的注册结果，本节就没真的验到"四只"这一格。
  const core = read('dev/js/toolkitCore.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/from '\.\/tools\/ui\.js'/.test(core), true, 'core 要 import 它才挂得上');
  assert.equal(/window\.Tk\s*=\s*\{[^}]*\bui\b[^}]*\}/.test(core), true, 'window.Tk 里必须有 ui 这一格');
  globalThis.window = {};
  try {
    const mod = await import('../dev/js/toolkitCore.js?o13');
    assert.deepEqual(Object.keys(mod), [], 'core 仍是入口形状：一条 export 都不许有');
    const tk = globalThis.window.Tk;
    assert.deepEqual(Object.keys(tk).sort(), ['createPanelDom', 'createPanelWorkspace', 'ui', 'view'],
      'Tk 面就是这四只：J12 那份清单与这里必须同步改，两处不同步说明有人在偷偷扩面');
    assert.equal(tk.ui.copyInto, copyInto, '挂上去的必须是本节判的那一只，不是页面上另长出来的一份');
    assert.equal(tk.ui.legacyCopy, legacyCopy);
  } finally {
    delete globalThis.window;
  }
});

// ── §Q 编码页视图层（`tools/codecView.js`，段 3 Task 6a）────────────────────
// 本节测的是**纯字符串那一层**：模型进、HTML 出，不碰 DOM、不碰四本纯模块。四条红线先说清，
// 整套判据都围着它们转：
//   ① **零 import，且不进 `window.Tk`**（Q2）。它只由 `codecWorkbench.js` 一本 import——只有
//      一个入口 reach 它就不会成 chunk，这是它敢 import 出去的前提；反过来它自己一旦 import，
//      那前提就没了。而它挂进 `Tk` 的后果是证件页替编码页的五块面板付 gzip，§7 的余量只剩
//      4,173B，所以这一格由 `toolkitCore` 的源码扫守住（Q2 后半），`O13` 那份四只清单不许被扩成五只。
//   ② **转义只有一处出口**（Q3）。`esc` / `EMPTY_CELL` / `checksTable` / `noteLines` 四样都来自
//      注入的那只 `view`，本文件里不许长出第二只 `esc`、第二张实体表、第二个 `'—'`。
//      表格那一半**允许**自带（`view.js` 的 `table` 是私有函数，共享它就要开 import 边），
//      但每一格必须逐格经注入的 `esc`——Q15 拿一条带 `<script>` 与引号的输入验这一句。
//   ③ **未知 verdict 与跨面板错配都抛**（Q5）。与 `view.js` 的 `stateMetaOf` 同一条口径：
//      没定论的结果不许被渲成绿的。
//   ④ **五块面板外层骨架同形**（Q6）。`tk-result tk-result--{tone}` 与徽章那一行是要求不是巧合，
//      `toolkit.scss` 只认那五个 tone 词。
const Q_VIEW = await import('../dev/js/tools/view.js');
const { CODEC_TONES, CODEC_META, PANEL_VERDICTS, createCodecView } = await import('../dev/js/tools/codecView.js');

/**
 * 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§O 同一形状）。
 * `import` 那一格另算：本文件的报错文案与注释里都要正写"不许 import"（`view.js` 的同族报错
 * 就是这口径），所以判"有没有 import 语句"时先去掉字符串与模板串。这不是给红线放水——
 * 真那一行 `import x from './y.js'` 剥掉模块名之后 `import` 关键字还在，Q2 末尾拿它自证。
 */
const qCode = () => read('dev/js/tools/codecView.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const qStripStrings = (code) => code.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
const qImportScan = () => qStripStrings(qCode());

/** 每节都现造一只：注入的 `view` 换了要当场看出来，不让上一节那只闭包替本节兜着 */
const qCv = () => createCodecView(Q_VIEW);

/** 外层那一只 tone（`tk-result--x`），别把徽章的 `tk-state--x` 数进来 */
const qTone = (html) => /class="tk-result tk-result--(\w+)"/.exec(html)?.[1];

/** 五块面板各自的最小模型：只补本节要看的那几个字段，其余留空 */
const Q_MINIMAL = {
  timestamp: { verdict: 'empty', input: '', readings: [], fields: [], diff: null },
  base64: { verdict: 'empty', input: '', out: '', bytes: 0, fields: [] },
  url: { verdict: 'empty', input: '', pair: [], differs: [], decodeTries: [], queryRows: [], bytes: 0 },
  digest: { verdict: 'empty', kind: 'text', bytes: 0, rows: [] },
  regex: { verdict: 'empty', pattern: '', flags: '', input: '', level: 'none', findings: [], count: 0,
    // `capped` 在 `regex.js` 里是**本次生效的上限次数**（数字，见 N8），不是"到没到"的那面旗；
    // 最小模型给的是没往下调时的 `MAX_MATCHES`，三面旗按各节的需要各自覆盖。
    matches: [], groups: [], replaced: null, capped: 1000, hitLimit: false, timedOut: false, elapsedMs: null },
};
const qModel = (panel, over = {}) => ({ ...Q_MINIMAL[panel], ...over });

test('Q1 导出面恰好四个名字，CODEC_META 十三档的文案与 tone 逐字钉死', async () => {
  const mod = await import('../dev/js/tools/codecView.js');
  assert.deepEqual(Object.keys(mod).sort(), ['CODEC_META', 'CODEC_TONES', 'PANEL_VERDICTS', 'createCodecView'],
    '视图层就交这四样：一张 tone 表、一张 verdict 表、一张白名单、一只工厂');
  const TABLE = {
    converted: ['已换算', 'ok'], encoded: ['已编码', 'ok'], decoded: ['已解码', 'ok'],
    computed: ['已算出', 'ok'], matched: ['有命中', 'ok'],
    ambiguous: ['长度两可', 'unknown'], nomatch: ['零命中', 'unknown'],
    lossy: ['有还原损耗', 'warn'], partial: ['部分可用', 'warn'], capped: ['已到上限', 'warn'],
    invalid: ['不成立', 'bad'], rejected: ['已拒收', 'bad'],
    empty: ['等待输入', 'idle'],
  };
  assert.deepEqual(Object.keys(CODEC_META), Object.keys(TABLE),
    '键序也是契约：白名单与这张表按同序取词，谁重排谁红');
  for (const [k, [label, tone]] of Object.entries(TABLE)) {
    assert.deepEqual(CODEC_META[k], { label, tone }, `CODEC_META.${k} 的措辞或档位变了`);
    assert.equal(CODEC_TONES.includes(tone), true, `${k} 的 tone 不在样式层认的那五个词里`);
  }
  assert.deepEqual(CODEC_TONES, ['ok', 'warn', 'bad', 'unknown', 'idle'],
    'toolkit.scss 只写了这五档徽章（.tk-state--ok/warn/bad/unknown/idle），多一档就是没有样式的类名');
  assert.deepEqual(Object.keys(CODEC_META).filter((k) => CODEC_META[k].tone === 'ok'),
    ['converted', 'encoded', 'decoded', 'computed', 'matched'],
    '五个"成了"各说各话：换算 / 编码 / 解码 / 算出 / 命中，不许塌成一句"成功"');
  assert.deepEqual(Object.keys(CODEC_META).filter((k) => CODEC_META[k].tone === 'warn'),
    ['lossy', 'partial', 'capped'],
    'warn 三档都是"东西给你了但要说清楚"：还原有损耗 / 只有部分能用 / 到上限了');
});

test('Q2 零 import 与不进 Tk 都靠源码文本：本文件一条 import 都不许有，toolkitCore 也不许多出第五只', () => {
  const code = qCode();
  assert.equal(/\bimport\b/.test(qImportScan()), false,
    '它一旦被第二本 import，"只有一个入口 reach 它"这条前提就没了，产物立刻变成带 `import{` 的废文件');
  assert.equal(/\bimport\b/.test(qStripStrings("import view from './tools/view.js';\n")), true,
    '剥字符串只是为了让报错文案里的"不许 import"不算命中，不是给这条扫描开后门：真那一行 import 剥完照样红');
  assert.equal(/require\(/.test(code), false);
  const core = read('dev/js/toolkitCore.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/codecView/.test(core), false,
    '把只有编码页要的视图层挂进共用的 toolkitCore，等于让证件页替五块它没有的面板付 gzip（§7 余量只剩 4,173B）');
  assert.deepEqual(core.match(/window\.Tk\s*=\s*\{([^}]*)\}/)[1].split(',').map((s) => s.trim()),
    ['createPanelWorkspace', 'createPanelDom', 'view', 'ui'],
    'Tk 仍是四只：这一格扩面了，O13 与 J12 那两份清单要跟着改，别在这儿偷偷加');
});

test('Q3 转义只有一处出口：注入的 esc 是唯一插值路径，第二只 esc / 第二张实体表 / 第二个破折号都不许有', () => {
  const code = qCode();
  assert.equal(/function esc\b|const esc\s*=\s*\(|esc\s*=\s*\(/.test(code), false,
    'esc 只能是注入进来的那一只（解构赋值不算定义），本地再写一份的下场是"改了一份、页面上跑的是另一份"');
  assert.equal(/ESC_MAP|&amp;|&lt;/.test(code), false,
    '实体映射表只有 view.js 那一份，这里出现第二张就说明有人又写了一个转义器');
  assert.equal((code.match(/'—'/g) || []).length, 0,
    '空值那一格取注入的 EMPTY_CELL：两个破折号长得不一样时，没人会去对表');
  assert.equal(/EMPTY_CELL/.test(code), true, '空值必须走 EMPTY_CELL，不许各写各的占位符');
  assert.equal(/checksTable/.test(code), true, '逐项判定表要复用注入的那一张，不重造 tk-checks');
  assert.equal(/noteLines/.test(code), true, '口径行走注入的 noteLines，转义与跳过空串的规则只有一处');
});

test('Q4 构造期闸门：注入的 view 缺哪一样就点名哪一样，缺四样就把四样一次说全', () => {
  for (const miss of ['esc', 'EMPTY_CELL', 'checksTable', 'noteLines']) {
    const partial = { ...Q_VIEW };
    delete partial[miss];
    assert.throws(() => createCodecView(partial),
      (err) => err instanceof TypeError && err.message.includes(miss),
      `缺 ${miss} 必须当场点名——视图层缺依赖的后果是渲染期才炸，那时已经在一个具体面板里了`);
  }
  assert.throws(() => createCodecView(), TypeError, '整包没给也要抛，不许退化成"先用着，等第一次渲染再说"');
  assert.throws(() => createCodecView({}), (err) => {
    const m = err.message;
    return /esc/.test(m) && /EMPTY_CELL/.test(m) && /checksTable/.test(m) && /noteLines/.test(m);
  }, '缺四样只点名第一样，调用方要试四轮才知道补齐了没有');
  assert.throws(() => createCodecView({ ...Q_VIEW, EMPTY_CELL: 42 }), /EMPTY_CELL/,
    'EMPTY_CELL 是字符串常量：按 typeof 判，不按"在不在"判，否则给了个数字也照样放行');
  const cv = qCv();
  for (const name of ['badge', 'fieldsTable', 'timestampBlock', 'base64Block', 'urlBlock', 'digestBlock', 'regexBlock', 'block']) {
    assert.equal(typeof cv[name], 'function', `工厂交出的 ${name} 必须在`);
  }
});

test('Q5 未知 verdict 抛、跨面板错配抛、白名单与总表互相对账，block 的分派也只认那五块', () => {
  const cv = qCv();
  assert.throws(() => cv.badge('expired'), (e) => e instanceof TypeError && /expired/.test(e.message),
    '将来模块新增一档（比如 expired）必须当场炸给装配层，而不是把没定论的结果显示成绿的');
  assert.throws(() => cv.badge(undefined), TypeError);
  assert.throws(() => cv.badge(''), TypeError);
  assert.throws(() => cv.timestampBlock({ verdict: 'encoded' }, []),
    (e) => /timestamp/.test(e.message) && /encoded/.test(e.message),
    '时间戳面板报"已编码"是装配层映射写错，要在渲染之前炸——渲染出来的那句文案用户会当事实读');
  assert.deepEqual(PANEL_VERDICTS.timestamp, ['converted', 'ambiguous', 'invalid', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.base64, ['encoded', 'decoded', 'lossy', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.url, ['encoded', 'decoded', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.digest, ['computed', 'partial', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.regex, ['matched', 'nomatch', 'capped', 'invalid', 'rejected', 'empty']);
  for (const [panel, list] of Object.entries(PANEL_VERDICTS)) {
    for (const v of list) assert.ok(CODEC_META[v], `${panel} 的白名单里有 CODEC_META 不认识的「${v}」`);
  }
  const used = [...new Set(Object.values(PANEL_VERDICTS).flat())].sort();
  assert.deepEqual(used, Object.keys(CODEC_META).sort(),
    '表里有、没人用的档是死文案：新增一档要同时有一块面板真的会走到它');
  assert.deepEqual(Object.keys(PANEL_VERDICTS), ['timestamp', 'base64', 'url', 'digest', 'regex'],
    '面板清单与 panel.js 那五个 id 同序，Task 7 的收录面判据读的就是这个顺序');
  assert.throws(() => cv.block('idcard', {}, []), RangeError, '视图层只服务编码页那五块，别的页面的块不该在这儿渲染');
});

test('Q6 五块面板外层骨架同形：一只 tk-result、恰好一个徽章、tone 由 verdict 决定，分派点也只有一处', () => {
  const cv = qCv();
  const cases = [
    ['timestamp', 'converted', 'ok'], ['base64', 'encoded', 'ok'], ['url', 'decoded', 'ok'],
    ['digest', 'computed', 'ok'], ['regex', 'matched', 'ok'],
    ['timestamp', 'ambiguous', 'unknown'], ['regex', 'nomatch', 'unknown'],
    ['base64', 'lossy', 'warn'], ['digest', 'partial', 'warn'], ['regex', 'capped', 'warn'],
    ['url', 'invalid', 'bad'], ['digest', 'rejected', 'bad'], ['base64', 'empty', 'idle'],
  ];
  for (const [panel, verdict, tone] of cases) {
    const html = cv.block(panel, qModel(panel, { verdict }), []);
    assert.equal((html.match(/class="tk-result tk-result--/g) || []).length, 1, `${panel}/${verdict} 的外层不止一只`);
    assert.equal(qTone(html), tone, `${panel}/${verdict} 外层 tone 应为 ${tone}`);
    assert.equal((html.match(/class="tk-state tk-state--/g) || []).length, 1, '徽章那一行恰好一个');
    assert.equal(html.includes(`<p class="tk-verdict"><span class="tk-state tk-state--${tone}">${CODEC_META[verdict].label}</span></p>`), true,
      `${panel} 的徽章行形状与 view.parseBlock 那一条不一致`);
    assert.equal(html.startsWith(`<div class="tk-result tk-result--${tone}">`), true);
    assert.equal(html.endsWith('</div>'), true);
  }
});

test('Q7 timestampBlock：ambiguous 两读并列且谁都没被标成对的；invalid 那一档不许出现明细表', () => {
  const cv = qCv();
  // `kind` 给的是 `time.js` 那两个 token（K2 钉的 `['second','milli']`），中文说法归视图：
  // 与 VIA_CN / LEVEL_CN / DECODE_CN 同一条口径，装配层只交事实、措辞只在视图这一层写。
  const readings = [
    { kind: 'second', epochMs: 1700000000000, isoUtc: '2023-11-14T22:13:20Z' },
    { kind: 'milli', epochMs: 1700000000, isoUtc: '1970-01-20T16:13:20Z' },
  ];
  const amb = cv.timestampBlock(qModel('timestamp', { verdict: 'ambiguous', input: '1700000000', readings }), []);
  assert.equal((amb.match(/<tr><td>/g) || []).length, 2, '两读要两行，不是挤在一条文案里说（表头是 <tr><th，不计）');
  assert.equal((amb.match(/<td/g) || []).length, 6, '两读 × 三列（解释 / epoch / UTC）= 六格');
  assert.equal(amb.includes('按秒'), true);
  assert.equal(amb.includes('按毫秒'), true);
  assert.throws(() => cv.timestampBlock(qModel('timestamp', { verdict: 'ambiguous', readings: [{ kind: '秒', epochMs: 1, isoUtc: 'x' }] }), []),
    (e) => e instanceof TypeError && /second \/ milli/.test(e.message),
    'token 写错（比如传了中文）说明装配层把视图的活儿抢了过去，当场点名比页面上少一列读数好查');
  assert.equal(amb.includes('tk-state--ok'), false, '长度两可时不许把任何一种解释标成"已换算"');
  assert.equal(amb.includes('1700000000'), true, '用户那一行要回显，否则两张读数对不上是谁的');
  const long = cv.base64Block(qModel('base64', { verdict: 'encoded', input: 'a'.repeat(400), out: 'YQ' }), []);
  assert.equal(long.includes('输入共 400 字符'), true,
    '编码页的输入允许到 1 MiB：回显不封顶就是让结果区把刚粘进去的东西再打一遍，节点数直接翻倍');
  assert.equal(/a{200}…/.test(long), true, '截断点就在 200 个码点上');
  assert.equal(/a{201}/.test(long), false, '多打一个字就等于没有封顶');
  const pair = cv.base64Block(qModel('base64', { verdict: 'encoded', input: '😀'.repeat(250), out: 'YQ' }), []);
  assert.equal(pair.includes('😀'.repeat(200)) && pair.includes('输入共 250 字符'), true,
    '按码点切，不按码元切：250 个 emoji 要显示前 200 个完整的，切到第 201 个的一半就是页面上一个替换字符');
  const bad = cv.timestampBlock(qModel('timestamp', { verdict: 'invalid', input: 'abc', reason: '第 1 位不是数字' }), []);
  assert.equal(bad.includes('<table'), false, '不成立那一档没有可显示的明细，摆一张空表读起来像"全都通过了"');
  assert.equal(bad.includes('第 1 位不是数字'), true, 'reason 要落在结果里，§5.4 那句"让用户看得见为什么不行"');
  const ok = cv.timestampBlock(qModel('timestamp', {
    verdict: 'converted', input: '1700000000000',
    readings: [{ kind: 'milli', epochMs: 1700000000000, isoUtc: '2023-11-14T22:13:20Z' }],
    fields: [{ label: '本地', value: '2023-11-15 06:13:20 (UTC+08:00)', mono: true }],
    relative: '2 年前',
  }), ['口径一句']);
  assert.equal(ok.includes('2 年前'), true, 'relative 由视图补一行「相对时间」，装配层只给那句短语');
  assert.equal(ok.includes('相对时间'), true);
  assert.equal(/<p class="tk-note">口径一句<\/p>/.test(ok), true);
});

test('Q8 base64Block：结果走等宽那一族、字节数按"数字 + 字节"给，lossy 那一档必须把损耗说出来', () => {
  const cv = qCv();
  const enc = cv.base64Block(qModel('base64', { verdict: 'encoded', input: '中', out: '5Lit', bytes: 3 }), []);
  assert.equal(/class="tk-line__raw">5Lit</.test(enc), true,
    '结果那一格走证件页那一族的 `.tk-line__raw`（toolkit.scss 里它自带 $tk-meta 与 break-all）：再叠一个 tk-mono 就是同一条规则写两处');
  assert.equal(enc.includes('<p class="tk-line__head">结果</p>'), true,
    'head 那一句有块级 margin，必须是 <p>；写成 <span> 的话 margin 静默失效，两行结果挤成一坨');
  assert.equal(enc.includes('<div class="tk-lines"><section class="tk-line">'), true,
    '一行的外层是 .tk-lines > section.tk-line，与 workbench.js 的 renderRead 同形');
  assert.equal(enc.includes('3 字节'), true, '输入字节数是这一档唯一和"1MB 闸门"对得上的数');
  assert.equal(enc.includes('1,234'), false, '千分位会让这串数不能被复制下来再核对');
  const lossy = cv.base64Block(qModel('base64', {
    verdict: 'lossy', input: 'YQ', out: 'a', bytes: 2,
    fields: [{ label: '补齐的 padding', value: 1, mono: true }, { label: '剥掉的空白', value: 2, mono: true }],
  }), []);
  assert.equal(lossy.includes('有还原损耗'), true, '宽松档补了 padding 就不能只报"已解码"');
  assert.equal(lossy.includes('补齐的 padding'), true, '补了几位 padding 要说出来');
  assert.equal(lossy.includes('剥掉的空白'), true, '剥了几处空白也要说出来');
  const rej = cv.base64Block(qModel('base64', { verdict: 'rejected', input: '超大', out: '', bytes: 1048577, reason: '超过 1 MiB 上限' }), []);
  assert.equal(rej.includes('tk-line__raw'), false, '闸门拦下时 out 是空串，不该摆一个空的结果行');
  assert.equal(rej.includes('超过 1 MiB 上限'), true);
});

test('Q9 urlBlock：两档并列 + 那 11 个差异字符成句、query 行的解码列不许把"解不出"显示成通过', () => {
  const cv = qCv();
  const html = cv.urlBlock(qModel('url', {
    verdict: 'encoded', input: 'a?b=c d',
    pair: [{ name: 'encodeURI', out: 'a?b=c%20d' }, { name: 'encodeURIComponent', out: 'a%3Fb%3Dc%20d' }],
    differs: ['?', '/', ':', '@', '&', '=', '+', '$', ',', ';', '#'],
    decodeTries: [{ field: 'decodeURI', ok: true, out: 'a?b=c d', reason: '' }],
    queryRows: [{ raw: 'b=c d', key: 'b', value: 'c d', keyOk: true, valueOk: false, reason: '第 3 位不是合法百分号转义' }],
    bytes: 9,
  }), ['URL_CAVEAT']);
  assert.equal(html.includes('encodeURI') && html.includes('encodeURIComponent'), true, '两档并列是 §5.2 那句"口径差异并列展示"');
  assert.equal(/a\?b=c%20d/.test(html) && /a%3Fb%3Dc%20d/.test(html), true);
  assert.equal(html.includes('11 个字符在这一档不编码、在那一档编码'), true, '差异要说得出数量，L11 钉的就是这 11 个');
  for (const ch of ['?', '/', ':', '@', '&', '=', '+', '$', ',', ';', '#']) {
    assert.equal(html.includes(ch), true, `差异字符 ${ch} 没出现在那一句里`);
  }
  assert.equal(html.includes('解不出'), true, 'valueOk 为 false 的那一格必须说"解不出"');
  assert.equal(html.includes('第 3 位不是合法百分号转义'), true);
  assert.equal(/<td>可以<\/td>/.test(html), true, 'keyOk 为 true 的那一格要说"可以"，空着会被读成"没判"');
});

test('Q10 digestBlock：五格恒定按算法序、via 那一列三档各有说法，unavailable 不许显示成空', () => {
  const cv = qCv();
  const rows = [
    { algo: 'md5', ok: true, hex: '9dd4e461268c8034f5c8564e155c67a6', bytes: 5, via: 'self', reason: '' },
    { algo: 'sha-1', ok: false, hex: '', bytes: 5, via: 'unavailable', reason: 'crypto.subtle 不可用' },
    { algo: 'sha-256', ok: true, hex: 'abc', bytes: 5, via: 'subtle', reason: '' },
    { algo: 'sha-384', ok: true, hex: 'def', bytes: 5, via: 'subtle', reason: '' },
    { algo: 'sha-512', ok: true, hex: 'ghi', bytes: 5, via: 'subtle', reason: '' },
  ];
  const html = cv.digestBlock(qModel('digest', { verdict: 'partial', kind: 'text', bytes: 5, rows }), ['DIGEST_CAVEAT']);
  assert.equal((html.match(/<tr>/g) || []).length, 6, '五格 + 一行表头 = 6，五档一格都不许少');
  const order = [...html.matchAll(/<tr><td>(md5|sha-[\d]+)</g)].map((m) => m[1]);
  assert.deepEqual(order, ['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512'], '行序按算法表来，不按谁先算完来');
  assert.equal(html.includes('本站自实现'), true, 'MD5 那一格要说清是自己算的');
  assert.equal(html.includes('浏览器 crypto'), true, '四档要走 crypto.subtle，回显与 MD5 分开');
  assert.equal(html.includes('环境不支持'), true, '取不到的那格显示"环境不支持"，不许留空——空着读起来像"没算"');
  assert.equal(html.includes('crypto.subtle 不可用'), true, '那一格的 reason 要跟着出来，否则"部分可用"说不服人');
  assert.equal(/<td class="tk-mono">9dd4e461268c8034f5c8564e155c67a6<\/td>/.test(html), true, '摘要走等宽');
  assert.equal(html.includes('5 字节'), true);
  assert.equal(/<td class="tk-mono">—<\/td>/.test(html), true, '算不成的那格 hex 是空串，显示 EMPTY_CELL 而不是空单元格');
});

test('Q11 regexBlock：没开 d 时组位置是空值而不是 0、两面旗与那个上限数各说各话、零命中是 unknown 不是 bad', () => {
  const cv = qCv();
  const html = cv.regexBlock(qModel('regex', {
    verdict: 'matched', pattern: '(a)(b)', flags: 'g', input: 'xxab', level: 'none',
    count: 1, matches: [{ i: 1, index: 2, length: 2, text: 'ab' }],
    groups: [{ match: 1, label: '#1', index: null, length: null, text: 'a' }, { match: 1, label: '#2', index: null, length: null, text: 'b' }],
    replaced: 'X', elapsedMs: null,
  }), []);
  assert.equal(html.includes('有命中'), true);
  assert.equal((html.match(/tk-mono">a</g) || []).length, 1, '捕获组内容要显示');
  assert.equal(/<td>—<\/td>/.test(html), true, '没开 d 时位置是 null，走 EMPTY_CELL');
  assert.equal(html.includes('>0<'), false, '把"没位置"显示成 0 就是在报一个假位置');
  assert.equal(html.includes('替换预览'), true);
  assert.equal(html.includes('>X<'), true, '预览产物要落在结果里');
  const limited = cv.regexBlock(qModel('regex', { verdict: 'capped', count: 900, capped: 1000, hitLimit: true }), []);
  assert.equal(limited.includes('命中次数已到本次上限 1000 次'), true,
    '要把"上限是多少"一起说：只说"到了上限"，用户不知道是本站硬闸门还是这一档的预算');
  assert.equal(limited.includes('剩下的没有再算'), true, '没算完这件事不许藏');
  const timed = cv.regexBlock(qModel('regex', { verdict: 'capped', count: 4, capped: 1000, timedOut: true }), []);
  assert.equal(timed.includes('档间时间预算已用完'), true);
  assert.equal(timed.includes('命中次数已到本次上限'), false, 'timedOut 不许借次数那句话：N8 钉的是"时间到点不是次数到点，两面旗子不许互相顶"');
  const quiet = cv.regexBlock(qModel('regex', { verdict: 'matched', count: 2, capped: 1000 }), []);
  assert.equal(quiet.includes('命中次数已到本次上限'), false, 'capped 那一格次次都有值（它就是本次生效的上限），拿它当旗读会永远说"已到上限"');
  assert.throws(() => cv.regexBlock(qModel('regex', { verdict: 'capped', count: 900, capped: true, hitLimit: true }), []),
    (e) => e instanceof TypeError && /capped/.test(e.message),
    '装配层把 capped 当布尔传进来时，那句话会渲成「上限 true 次」——一句话骗人，必须当场抛');
  const none = cv.regexBlock(qModel('regex', { verdict: 'nomatch', count: 0, matches: [] }), []);
  assert.equal(none.includes('零命中'), true, '编译成功但没匹配上是"零命中"');
  assert.equal(none.includes('tk-state--bad'), false, '零命中不是错误，不该上 bad 那一档');
  assert.equal(none.includes('<table'), false, '零命中不摆空表');
});

test('Q12 空数组一律给一句明说的话，不摆空表；五块面板各验一处', () => {
  const cv = qCv();
  const cases = [['base64', { verdict: 'decoded', out: '', fields: [] }],
    ['url', { verdict: 'decoded', queryRows: [], pair: [] }],
    ['digest', { verdict: 'computed', rows: [] }],
    ['regex', { verdict: 'matched', matches: [], findings: [] }],
    ['timestamp', { verdict: 'converted', readings: [], fields: [] }]];
  for (const [panel, over] of cases) {
    const html = cv.block(panel, qModel(panel, { input: 'x', ...over }), []);
    assert.equal(html.includes('<table'), false, `${panel}：空的行集不许摆一张只有表头的表`);
    assert.equal(/class="tk-hint">[^<]+<\/p>/.test(html), true, `${panel}：没有可显示的内容时要说一句明说的话`);
  }
});

test('Q13 notes 去重：同一句口径若已经在判定表里说过，就不再重复一遍', () => {
  const cv = qCv();
  const same = '该区划未见于现行区划表';
  const html = cv.base64Block(qModel('base64', {
    verdict: 'invalid', out: '', reason: '第 4 位不是 Base64 字符',
    checks: [{ key: 'charset', label: '字符集', ok: false, detail: same }],
  }), [same, '另一句', '', null]);
  assert.equal((html.match(new RegExp(same, 'g')) || []).length, 1, '判定表说过了就不再拿口径行重复一遍——两遍会让用户以为有两件事');
  assert.equal((html.match(/<p class="tk-note">/g) || []).length, 1, '空串与 null 都要被滤掉，只剩那一句新的');
  assert.equal(/<p class="tk-note">另一句<\/p>/.test(html), true);
});

test('Q14 数字口径：字节一律"数字 + 字节"，不做千分位、不做 KB 换算', () => {
  const cv = qCv();
  const html = cv.digestBlock(qModel('digest', {
    verdict: 'computed', bytes: 1234567,
    rows: [{ algo: 'md5', ok: true, hex: 'h', bytes: 1234567, via: 'self', reason: '' }],
  }), []);
  assert.equal(html.includes('1234567 字节'), true, '§7 那条预算是字节口径，视图里换成"1.2 MB"就对不上了');
  assert.equal(/1,234/.test(html), false, '千分位会让这串数字不能被复制下来再核对');
  assert.equal(/MB|KiB|KB/.test(html), false, '不做单位换算：换算就把 §7 的字节口径弄断了');
});

test('Q15 五块面板都只经注入的 esc：同一条含 <script> 与引号的输入，产物里 < 只以 &lt; 出现', () => {
  const cv = qCv();
  const nasty = `"><script>alert(1)</script>&'`;
  const inputs = {
    timestamp: qModel('timestamp', { verdict: 'converted', input: nasty, readings: [{ kind: 'second', epochMs: 1, isoUtc: nasty }], fields: [{ label: nasty, value: nasty }] }),
    base64: qModel('base64', { verdict: 'encoded', input: nasty, out: nasty, fields: [{ label: nasty, value: nasty }] }),
    url: qModel('url', { verdict: 'encoded', input: nasty, pair: [{ name: nasty, out: nasty }], queryRows: [{ raw: nasty, key: nasty, value: nasty, keyOk: true, valueOk: null, reason: nasty }], differs: [] }),
    digest: qModel('digest', { verdict: 'computed', rows: [{ algo: nasty, ok: true, hex: nasty, bytes: 1, via: 'self', reason: nasty }] }),
    regex: qModel('regex', { verdict: 'matched', pattern: nasty, flags: 'g', input: nasty, matches: [{ i: 1, index: 0, length: 1, text: nasty }], groups: [{ match: 1, label: nasty, index: 0, length: 1, text: nasty }], replaced: nasty, findings: [{ rule: nasty, at: 0, hint: nasty, level: 'high' }] }),
  };
  for (const [panel, m] of Object.entries(inputs)) {
    const html = cv.block(panel, m, [nasty]);
    assert.equal(html.includes('<script>'), false, `${panel}：裸的 <script> 进了产物`);
    assert.equal(html.includes('&lt;script&gt;'), true, `${panel}：该转义的没转义，或整段被吞了`);
    assert.equal(/&quot;&gt;&lt;script&gt;/.test(html), true, `${panel}：夹具没真的进产物，上面两条是假绿`);
    assert.equal(html.includes('"&gt;'), false, `${panel}：属性里的引号要经 esc`);
    assert.equal(/class="[^"]*"/.test(html), true);
  }
});

test('Q16 模型里放不进 HTML 的东西：fieldsTable 收到对象/数组/NaN 当场抛并点名第几行', () => {
  const cv = qCv();
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: {} }]),
    (e) => e instanceof TypeError && /第 1 行/.test(e.message), '显示成 [object Object] 就是"结果区在骗人"');
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: [1, 2] }]), TypeError);
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: NaN }]), TypeError, 'NaN 走注入的 esc 会抛，视图不替它兜');
  assert.throws(() => cv.fieldsTable('not an array'), TypeError);
  assert.throws(() => cv.fieldsTable([{ label: 'a' }]), TypeError, '缺 value 也算形状不对，不许静默渲成空');
  const html = cv.fieldsTable([{ label: '空的一格', value: null }, { label: '数字', value: 0, mono: true }]);
  assert.equal(/<td>—<\/td>/.test(html), true, 'null 是"这一格没值"，显示 EMPTY_CELL');
  assert.equal(html.includes('<td class="tk-mono">0</td>'), true, '0 不是空值，不许被当成空');
});

// ── §R 编码页装配层与入口（`tools/codecWorkbench.js` / `toolCodec.js`，段 3 Task 6b）─────
//
// 本节测的是**接线**：四本纯模块 + `codecView` 的纯字符串 + `panel-dom` 的绑定，接成
// `tools-codec.html` 那个样子。和 §J 一样，三方全部接真的——mock 掉任何一样，§K–§Q 那五节的
// 判据就从"这一层没错"变成"这一层没测"。
//
// 五条红线，整套判据围着它们转：
//
// 1. **装配层不读运行环境**（R3）。时钟、时区偏移、`crypto.subtle` 三样一律由 `env` 递进来：
//    `codecWorkbench.js` 里 `Date.now(` / `getTimezoneOffset` / `performance.` / `window` /
//    `globalThis` 五个词一个都不许出现，而入口那一份**恰好各一处**（同一条尺子反过来量）。
//    理由与 §K 同源：读了环境就不能复算，而"相对时间那一行"与"档间耗时那一行"在 CI 里
//    必须是注入时钟的函数，否则同一份产物在两台机器上给出两个答案。
// 2. **id 只由 spec 派生**（R2）。五只 `fieldId` / `buttonId` / `copyId` / `outId` / `whenId`
//    是唯一的地址来源，`controlIds(prefix)` 与 spec 互相对账；测试夹具的节点清单也全部由
//    它们长出，不在本节重抄一份 id 表——重抄的那份会跟着 spec 一起错，Task 9 就没了第三者。
// 3. **两类失败分两条路**（R13）。用户填的格子不能用 → `FieldError` → 结果区一句提示，
//    面板不算坏；模块或骨架自己抛的 → 原样上抛，交给 `createPanelDom.run` 标坏那一块。
// 4. **异步那一栏既不抢跑也不逃逸**（R11 / R13）。`#digest` 是五块里唯一要 `await` 的：
//    挂载期一律不计算（那时算的话，reject 落在 `mount()` 返回值之外，`report.broken` 记不到它），
//    而画结果与报错这两条异步回写都必须重新过一遍 `runGuarded`。
// 5. **跨页共用面不许扩**（R3）。本文件 import 的四本纯模块 + `codecView.js` 是闭合清单，
//    `panel` / `panel-dom` / `view` / `ui` 四只一律从 `env.Tk` 拿；`codecView.js` 在全仓库
//    只许被 `codecWorkbench.js` 一本 import——多一个入口 reach 它，产物立刻变成带 `import{`
//    的废文件（实测记录在 `dev/js/toolkitCore.js` 开头）。
//
// 三条夹具口径与 §J 同形：假 DOM 复用 §I 那一份（`out.innerHTML = 串` 在假 DOM 上只长成
// 一个属性，所以本节读的是那一串文本，而那也正是真页面唯一吃进 HTML 的地方）；每一判从
// 按真的按钮 / 派发真的事件起步；`type` → 标签的映射由 spec 反推，spec 里长出词汇表外的
// `type` 夹具当场抛，不让它静默长成一个 `<select>`。
const {
  createCodecWorkbench, CODEC_SPEC, CODEC_PANEL_IDS,
  controlIds: rControlIds, fieldId: rField, buttonId: rButton, copyId: rCopy,
  outId: rOut, whenId: rWhen,
} = await import('../dev/js/tools/codecWorkbench.js');

/** spec 的 `type` → 骨架标签。这张表**必须**覆盖 spec 里出现的每一个 type，多一个就当场抛 */
const R_TAGS = { text: 'input', number: 'input', date: 'input', area: 'textarea', file: 'input', select: 'select' };
const rTag = (type) => {
  const tag = R_TAGS[type];
  if (!tag) throw new Error(`夹具：CODEC_SPEC 里出现了词汇表外的 type「${String(type)}」（认得 ${Object.keys(R_TAGS).join(' / ')}）`);
  return tag;
};

/** 一栏的骨架文案：主按钮与复制按钮。装配层只负责"改口之后改回原文"，句子本身归夹具 */
const R_MAIN_LABEL = '计算';
const R_COPY_LABEL = {
  'timestamp:main': '复制换算结果', 'timestamp:diff': '复制差值',
  'base64:main': '复制结果', 'url:main': '复制两档结果',
  'digest:main': '复制摘要', 'regex:main': '复制命中',
};

/** 两栏的名字：`main` 每块都有，`diff` 只有 `#timestamp` 有（R1 钉这一条） */
const R_SIDES = ['main', 'diff'];

/** spec 摊平成 `{panel, side, control}` 清单，夹具与判据都从它长，不各抄一份 */
const rControls = () => {
  const out = [];
  for (const [panel, cfg] of Object.entries(CODEC_SPEC)) {
    for (const side of R_SIDES) {
      const s = cfg.sides[side];
      if (!s) continue;
      for (const c of s.controls) out.push({ panel, side, c });
    }
  }
  return out;
};

/** 剥注释再剥字符串字面量：报错文案与 JSDoc 里的字样都不算命中（与 §Q 的 qCode 同一形状） */
const rBare = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
/** 只剥注释（判 import 边时用：字符串里的路径要留着） */
const rCode = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rCount = (hay, needle) => hay.split(needle).length - 1;

/**
 * 造一页"骨架"：§I 的索引条 + 五块面板 + 提示行，再按 `CODEC_SPEC` 长出控件、主按钮、
 * 复制按钮、结果区与受开关控制的字段组。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {string} [o.hash] 进页面时地址栏里的 hash
 * @param {Record<string, string|number>} [o.seed] `'panel:control' → 初值`（挂载前就在 DOM 上）
 * @param {Record<string, object|object[]>} [o.files] `'panel:control' → File 替身`
 * @param {string[]} [o.drop] **不**要长的 id（造"骨架缺一格"那一类缺陷）
 * @returns {object} §I 的那份 page，外加 `ctl` / `btn` / `html` / `set` / `change` 等观察口
 */
function rPage({ prefix = 'tk', hash = '', seed = {}, files = {}, drop = [] } = {}) {
  const slugOf = (id, word) => {
    const at = `${prefix}-${word}-`;
    if (!id.startsWith(at)) return null;
    const slug = id.slice(at.length);
    return CODEC_PANEL_IDS.includes(slug) && id === `${at}${slug}` ? slug : null;
  };
  const dropTab = drop.map((id) => slugOf(id, 'tab')).filter((s) => s !== null);
  const dropPanel = drop.map((id) => slugOf(id, 'panel')).filter((s) => s !== null);
  const page = iPage({ ids: CODEC_PANEL_IDS, prefix, hash, dropTab, dropPanel });
  const gone = new Set(drop);
  const mk = page.mk;
  const doc = page.doc;

  for (const { panel, side, c } of rControls()) {
    const id = rField(prefix, panel, c.id);
    if (gone.has(id)) continue;
    const el = mk(rTag(c.type), id);
    if (c.type === 'select') {
      // 占位项的"值"走**属性**（与 §J 同一条口径）；`options` 里那些才是骨架的真选项。
      const ph = mk('option');
      ph.setAttribute('value', '');
      ph.textContent = '占位';
      el.appendChild(ph);
      for (const opt of c.options ?? []) {
        const o = mk('option');
        o.setAttribute('value', opt);
        o.textContent = opt;
        el.appendChild(o);
      }
    }
    if (c.type === 'file') el.files = [];
    const at = `${panel}:${c.id}`;
    if (seed[at] !== undefined) el.value = String(seed[at]);
    if (files[at] !== undefined) el.files = Array.isArray(files[at]) ? files[at] : [files[at]];
  }
  for (const panel of CODEC_PANEL_IDS) {
    for (const side of R_SIDES) {
      if (!CODEC_SPEC[panel].sides[side]) continue;
      const bid = rButton(prefix, panel, side);
      if (!gone.has(bid)) mk('button', bid).textContent = R_MAIN_LABEL;
      const cid = rCopy(prefix, panel, side);
      if (!gone.has(cid)) {
        const cb = mk('button', cid);
        cb.textContent = R_COPY_LABEL[`${panel}:${side}`];
        cb.disabled = true;                       // 骨架写死 disabled：第一次画完之前没东西可复制
      }
      const oid = rOut(prefix, panel, side);
      if (!gone.has(oid)) mk('div', oid);
    }
  }
  for (const id of rControlIds(prefix).when) if (!gone.has(id)) mk('p', id);

  const at = (id) => doc.getElementById(id);
  return Object.assign(page, {
    prefix,
    ctl: (panel, control) => at(rField(prefix, panel, control)),
    btn: (panel, side) => at(rButton(prefix, panel, side)),
    copy: (panel, side) => at(rCopy(prefix, panel, side)),
    outNode: (panel, side) => at(rOut(prefix, panel, side)),
    whenNode: (panel, key) => at(rWhen(prefix, panel, key)),
    /** 结果区里那一串 HTML；节点被 `drop` 掉时给空串，判据照样跑得动（那一判要的就是"没画"） */
    html: (panel, side) => String(at(rOut(prefix, panel, side))?.innerHTML ?? ''),
    set: (panel, control, v) => { const el = at(rField(prefix, panel, control)); el.value = String(v); return el; },
    setFiles: (panel, control, list) => {
      const el = at(rField(prefix, panel, control));
      el.files = Array.isArray(list) ? list : [list];
      return el;
    },
    change: (panel, control) => at(rField(prefix, panel, control)).dispatch('change', {}),
    click: (panel, side) => at(rButton(prefix, panel, side)).dispatch('click', {}),
    clickCopy: (panel, side) => at(rCopy(prefix, panel, side)).dispatch('click', {}),
    keyOn: (panel, control, evt) => at(rField(prefix, panel, control)).dispatch('keydown', evt),
  });
}

/**
 * 装配层 + 绑定层 + 挂载，一路接成页面上那个样子。
 *
 * `offsetMinutes` 与 §J 的 `rng` 一样有默认档：夹具给 `480`（东八区），因为"本地那一行"
 * 在偏移 0 下与 UTC 完全重合，任何写反符号的缺陷都量不出来。给 `null` 是**故意缺席**，
 * R8 用它判"没有偏移可注入时页面落在哪一档"。`now` 没有默认档：缺席就是缺席（R8）。
 *
 * @param {object} o 透给 `rPage` 的选项，外加 `clipboard` / `now` / `offsetMinutes` / `subtle` / `pick`
 * @returns {object} `{ page, wb, dom, report, timers, guarded, flush, subtle }`
 */
function rMount(o = {}) {
  const prefix = o.prefix ?? 'tk';
  const page = rPage({ prefix, hash: o.hash, seed: o.seed, files: o.files, drop: o.drop });
  const timers = [];
  /** `runGuarded` 的调用记录：口径 2 说"挂载期一次都不许走它"，这一格就是它的观察口 */
  const guarded = [];
  const host = { dom: null };
  const subtle = o.subtle === undefined ? undefined : o.subtle;
  const offset = 'offsetMinutes' in o ? o.offsetMinutes : 480;
  const wb = createCodecWorkbench({
    document: page.doc,
    Tk: { view: Q_VIEW, ui: J_UI },
    prefix,
    runGuarded: (id, fn) => { guarded.push(id); return host.dom.run(id, fn); },
    navigator: o.clipboard ? { clipboard: o.clipboard } : undefined,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    ...(o.now === undefined ? {} : { now: o.now }),
    ...(offset === null ? {} : { offsetMinutes: offset }),
    ...(subtle === undefined ? {} : { subtle }),
  });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location, history: page.history,
    window: page.win, renderers: wb.renderers, notice: page.notice,
  });
  host.dom = dom;
  const report = dom.mount();
  for (const [who, v] of Object.entries(o.pick ?? {})) {
    const [panel, control] = who.split(':');
    page.set(panel, control, v);
    page.change(panel, control);
  }
  const flush = () => {
    const due = timers.splice(0, timers.length);
    for (const t of due) t.fn();
    return due;
  };
  return { page, wb, dom, report, timers, guarded, flush, prefix, subtle };
}

/**
 * 摘要那一只假 `crypto.subtle`：`digest` 记算法名并回一个可控的三字节串。
 * 它同时是"预闸门有没有真的拦住模块"的计数器——MD5 走本站自实现、不碰 subtle，
 * 所以四档 SHA 一次都没被调，就等于 `digestAll` 根本没进。
 */
function rSubtle() {
  const calls = [];
  return {
    calls,
    digest: (name, buf) => {
      calls.push({ name, byteLength: new Uint8Array(buf).byteLength });
      return Promise.resolve(new Uint8Array([0, 1, 2]).buffer);
    },
  };
}

/**
 * File 替身：假 DOM 上它就是一个普通对象，页面读 `name` / `size` / `arrayBuffer()` 三样。
 * `oversize` 用来造"声明的字节数超过 5 MiB 通道上限"那一档，`fail` 用来造读盘失败。
 */
function rFile(name, content, { fail = false, size = null } = {}) {
  const bytes = typeof content === 'string' ? bytesOf(content) : content;
  const box = {
    name, size: size === null ? bytes.byteLength : size, type: '', calls: 0,
    arrayBuffer() {
      box.calls += 1;
      if (fail) return Promise.reject(new Error('读不到这个文件（磁盘上它已经不在了）'));
      return Promise.resolve(bytes.buffer);
    },
  };
  return box;
}

/** 排空微任务：`digestAll` 与 `file.arrayBuffer()` 都是异步的，而 `later` 被夹具换成只记账 */
const rSettle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((r) => { setTimeout(r, 0); });
};

/** 十六位固定"此刻"：比 `1700000000` 那发秒数正好晚 730 天，`relativeTime` 的固定年档给「2 年前」 */
const R_NOW = 1700000000000 + 730 * 86400000;

test('R1 导出面九个名字与 spec 骨架：只有 #timestamp 有第二栏，kind 必须在视图白名单里', async () => {
  const mod = await import('../dev/js/tools/codecWorkbench.js');
  assert.deepEqual(Object.keys(mod).sort(),
    ['CODEC_PANEL_IDS', 'CODEC_SPEC', 'buttonId', 'controlIds', 'copyId', 'createCodecWorkbench', 'fieldId', 'outId', 'whenId'],
    '装配层就交这九样：一只工厂、两张表、五只 id 派生、一份对账清单');
  assert.deepEqual(CODEC_PANEL_IDS, CODEC, '面板清单必须与 §D 那份两页锚点逐字同序——顺序就是索引条的顺序');
  assert.deepEqual(Object.keys(CODEC_SPEC), CODEC_PANEL_IDS, 'spec 的键序就是 tab 序，重排等于把索引条打乱');
  for (const panel of CODEC_PANEL_IDS) {
    const sides = CODEC_SPEC[panel].sides;
    assert.deepEqual(Object.keys(sides).sort(), panel === 'timestamp' ? ['diff', 'main'] : ['main'],
      `${panel} 的栏位集合不对：只有 #timestamp 有"两个日期之差"那一栏`);
    for (const [side, cfg] of Object.entries(sides)) {
      assert.equal(typeof cfg.kind, 'string', `${panel}.${side} 没有 kind`);
      assert.equal(Object.prototype.hasOwnProperty.call(PANEL_VERDICTS, cfg.kind), true,
        `${panel}.${side} 的 kind「${cfg.kind}」不在 codecView 的白名单里——渲染时才知道就是页面上当场抛`);
      assert.equal(Array.isArray(cfg.controls), true, `${panel}.${side} 的 controls 应为数组`);
      const ids = cfg.controls.map((c) => c.id);
      assert.deepEqual(ids.slice().sort(), [...new Set(ids)].sort(), `${panel}.${side} 有重名控件`);
      for (const c of cfg.controls) {
        assert.equal(Object.prototype.hasOwnProperty.call(R_TAGS, c.type), true,
          `${panel}.${side} 的控件「${c.id}」type「${String(c.type)}」不在夹具词汇表里`);
        assert.equal(R_SIDES.includes(side), true);
      }
      const sw = cfg.switch;
      if (sw) {
        assert.equal(ids.includes(sw.control), true, `${panel}.${side} 的开关控件「${sw.control}」不在自己的控件清单里`);
        for (const t of sw.targets) {
          assert.equal(ids.includes(t.key), true, `${panel}.${side} 的开关目标「${t.key}」不是本栏的控件 id`);
          assert.equal(Array.isArray(t.when) && t.when.length > 0, true, `${t.key} 的 when 是空的，那段字段永远藏起来`);
          if (sw.control === 'mode') {
            const mode = cfg.controls.find((c) => c.id === 'mode');
            for (const w of t.when) {
              assert.equal((mode.options ?? []).includes(w), true,
                `${panel}.${side}：开关说「${t.key}」在 mode=${w} 时出现，而 mode 的选项里没有 ${w}`);
            }
          }
        }
      }
    }
  }
  // 四档方向与两档摘要通道是这页的骨架事实，写错一个 token 就是"点了没反应"
  assert.deepEqual(CODEC_SPEC.base64.sides.main.controls.find((c) => c.id === 'mode').options,
    ['encode', 'decode', 'dataUri', 'dataUriDecode']);
  assert.deepEqual(CODEC_SPEC.digest.sides.main.controls.find((c) => c.id === 'mode').options, ['text', 'file']);
  assert.deepEqual(CODEC_SPEC.base64.sides.main.switch,
    { control: 'mode', targets: [{ key: 'strict', when: ['decode'] }, { key: 'mime', when: ['dataUri'] }] },
    'strict 只管解码、mime 只管包装：多一档或少一档都是页面上的一格死字段');
});

test('R2 五只 id 派生与 controlIds 自洽，换前缀整套跟着换', () => {
  assert.equal(rField('tk', 'base64', 'text'), 'tk-in-base64-text');
  assert.equal(rButton('tk', 'base64', 'main'), 'tk-btn-base64-main');
  assert.equal(rCopy('tk', 'timestamp', 'diff'), 'tk-copy-timestamp-diff');
  assert.equal(rOut('tk', 'regex', 'main'), 'tk-out-regex-main');
  assert.equal(rWhen('tk', 'digest', 'payload'), 'tk-when-digest-payload');
  const got = rControlIds('tk');
  assert.deepEqual(Object.keys(got).sort(), ['btn', 'copy', 'in', 'out', 'when']);
  // 逐项与 spec 对账：两个方向都红才算这份 spec 是骨架的真值而不是它的影子
  const wantIn = rControls().map(({ panel, c }) => rField('tk', panel, c.id));
  assert.deepEqual(got.in.slice().sort(), wantIn.slice().sort(), 'controlIds 与 spec 的控件清单对不上');
  assert.equal(new Set(got.in).size, got.in.length, '控件 id 有重复：同一格挂两处事件就是双份渲染');
  assert.equal(got.btn.length, 6, '六栏（五块主栏 + 时间戳差值栏）各一条主按钮');
  // 三张清单按**位置**一一对应，比的是各自去掉 `<prefix>-btn|copy|out-` 之后剩下的那半截
  // （`tk-copy-*` 与 `tk-btn-*` 天生不同字，逐字比 id 串是判据自己写歪了——顺序照样钉得住）。
  const tail = (word) => (id) => id.slice(`tk-${word}-`.length);
  assert.deepEqual(got.copy.map(tail('copy')), got.btn.map(tail('btn')), '有主按钮的地方就必须有复制按钮');
  assert.deepEqual(got.out.map(tail('out')), got.btn.map(tail('btn')), '有主按钮的地方就必须有结果区');
  assert.deepEqual(got.when.slice().sort(),
    ['tk-when-base64-mime', 'tk-when-base64-strict', 'tk-when-digest-payload', 'tk-when-digest-upload']);
  const zx = rControlIds('zx');
  assert.equal(zx.in.every((id) => id.startsWith('zx-')) && zx.btn.every((id) => id.startsWith('zx-')), true,
    '换前缀就是整套换：残留一处 `tk-` 等于那一格在页面上永远找不到');
  assert.deepEqual(zx.in.slice().sort(), wantIn.map((id) => `zx-${id.slice(3)}`).sort());
  assert.deepEqual(rControlIds('tk', ['url']).in, ['tk-in-url-text'], 'panels 参数得真的生效，Task 9 按条目对账要用它');
});

test('R3 源码红线：一处 innerHTML、零 querySelector、import 边闭合、共用面不扩、时钟只在入口', () => {
  const bare = rBare('dev/js/tools/codecWorkbench.js');
  const code = rCode('dev/js/tools/codecWorkbench.js');
  assert.equal(rCount(bare, 'innerHTML'), 1, 'innerHTML 只许出现在 paint() 一处：两处就有第二条插值路径');
  for (const banned of ['querySelector', 'Date.now(', 'getTimezoneOffset', 'performance.', 'window', 'globalThis']) {
    assert.equal(bare.includes(banned), false, `装配层不许碰 ${banned}（口径 1 与口径 2：环境量一律从 env 进来）`);
  }
  const specs = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(specs.slice().sort(), ['./codecView.js', './digest.js', './regex.js', './time.js', './codec.js'].slice().sort(),
    'import 边就是这五本：panel / panel-dom / view / ui 走 window.Tk，多一本就有第二个入口 reach 它，产物变成带 import{ 的废文件');
  assert.equal(code.includes('workbench.js'), false, '证件页那本装配层不许被复用：它 import 六本业务模块，接过来编码页就替证件页付 gzip');
  // `codecView.js` 全仓库只许一本 reach 它（§Q2 的前提），这一判把前提钉在消费侧
  const importers = ['dev/js/toolkitCore.js', 'dev/js/toolIdcard.js', 'dev/js/toolCodec.js',
    'dev/js/webLab.js', 'dev/js/editorial.js', 'dev/js/index.js', 'dev/js/about.js', 'dev/js/bottomFixedBtn.js', 'dev/js/cat.js']
    .concat(readdirSync(resolve(ROOT, 'dev/js/tools')).filter((f) => f.endsWith('.js')).map((f) => `dev/js/tools/${f}`))
    .filter((rel) => rel !== 'dev/js/tools/codecWorkbench.js')
    .filter((rel) => rCode(rel).includes("from './codecView.js'") || rCode(rel).includes("from '../js/tools/codecView.js'"));
  assert.deepEqual(importers, [], 'codecView 多了一个 importer：两个入口 reach 同一模块 = 共享 chunk = 整页 SyntaxError');
  const entry = rCode('dev/js/toolCodec.js');
  assert.deepEqual([...entry.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]), ['./tools/codecWorkbench.js'],
    '入口只许 import 装配层一本，框架那四只从 window.Tk 拿');
  assert.equal(/^\s*export\b/m.test(entry), false, '入口有顶层 export 就是语法错误：iifeWrapPlugin 包成 (function(){…})() 且不补 use strict');
  assert.equal(rCount(rBare('dev/js/toolCodec.js'), 'Date.now('), 1, '时钟只在这一处读，且必须还能被 env 覆盖');
  assert.equal(rCount(rBare('dev/js/toolCodec.js'), 'getTimezoneOffset'), 1, '时区偏移只在这一处读');
});

test('R4 构造期闸门：缺哪一样点名哪一样，注入的偏移与时钟必须是能用形状', () => {
  const base = {
    document: rPage().doc, Tk: { view: Q_VIEW, ui: J_UI },
    runGuarded: () => true,
  };
  assert.throws(() => createCodecWorkbench({ ...base, document: undefined }),
    (e) => e instanceof TypeError && /env\.document/.test(e.message), '缺 document 的后果是第一次点击才炸，构造期点名才有意义');
  assert.throws(() => createCodecWorkbench({ ...base, Tk: { view: { esc: () => '' }, ui: J_UI } }),
    (e) => e instanceof TypeError && /view/.test(e.message), 'view 缺一只能抛，不许静默把整页渲成空');
  assert.throws(() => createCodecWorkbench({ ...base, Tk: { view: Q_VIEW, ui: {} } }),
    (e) => e instanceof TypeError && /copyInto/.test(e.message), '缺 ui.copyInto 的下场是"用户点复制没反应"');
  assert.throws(() => createCodecWorkbench({ ...base, runGuarded: undefined }),
    (e) => e instanceof TypeError && /runGuarded/.test(e.message), '按钮回调不许自己 try/catch 出第二套错误口径');
  assert.throws(() => createCodecWorkbench({ ...base, now: 5 }),
    (e) => e instanceof TypeError && /env\.now/.test(e.message), '非函数的 now 会让"相对时间"那一行静默消失');
  assert.throws(() => createCodecWorkbench({ ...base, offsetMinutes: '480' }),
    (e) => e instanceof TypeError && /offsetMinutes/.test(e.message), '字符串偏移会一路传到 fromEpoch 那口才响，早一格点名少一块面板塌');
  assert.throws(() => createCodecWorkbench({ ...base, offsetMinutes: 900 }),
    (e) => e instanceof TypeError && /offsetMinutes/.test(e.message), '±840 之外 time.js 一律不收，装配层不许替它兜');
  // 前缀缺省与空串：空串会让所有派生 id 前面挂一个 `-`，等于整页找不到节点
  const page = rPage();
  assert.doesNotThrow(() => createCodecWorkbench({ ...base, document: page.doc, prefix: '' }));
});

test('R5 挂载期：六栏全画"等待输入"、不走 runGuarded、不出现证件页那句「未收录」', () => {
  const m = rMount();
  assert.deepEqual(m.report.broken, [], '五块面板应当在挂载期全部画好');
  assert.deepEqual(m.report.rendered, CODEC_PANEL_IDS);
  assert.deepEqual(m.report.missing, [], '夹具自证：五块面板的 tab 与 panel 节点都在');
  assert.deepEqual(m.guarded, [], '挂载期一次都不许走 runGuarded：那时 mounted 还是 false');
  for (const [panel, side] of [['timestamp', 'main'], ['timestamp', 'diff'], ['base64', 'main'],
    ['url', 'main'], ['digest', 'main'], ['regex', 'main']]) {
    const html = m.page.html(panel, side);
    assert.equal(/class="tk-result tk-result--idle"/.test(html), true, `${panel}.${side} 的外层骨架不对`);
    assert.equal(html.includes('等待输入'), true, `${panel}.${side} 挂载期没画上"等待输入"`);
    assert.equal(html.includes('未收录'), false, '「未收录」是证件页判定表的措辞：checks 里出现 ok:null 就是把它带过来了');
    assert.equal(m.page.copy(panel, side).disabled, true, `${panel}.${side} 还没有可复制的文本`);
  }
  assert.equal(m.subtle, undefined, '这一判没注入 subtle：挂载期就不该有任何 SHA 计算');
});

test('R6 时间戳主栏：十位按秒、十三位按毫秒、十一位两读并列、民用日期回落要说口径', () => {
  const m = rMount({ now: () => R_NOW, seed: { 'timestamp:value': '1700000000' } });
  m.page.click('timestamp', 'main');
  const html = m.page.html('timestamp', 'main');
  assert.equal(html.includes('已换算'), true, '10 位是秒档唯一解，不该并列两读');
  assert.equal(html.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行要按注入的 epoch 复算');
  assert.equal(html.includes('2023-11-15T06:13:20+08:00'), true, '本地那一行走 env.offsetMinutes，不是 UTC');
  assert.equal(/2023-11-15 06:13:20 \(UTC\+08:00\)/.test(html), true, '可读那一行的括号里必须带偏移');
  assert.equal(html.includes('2 年前'), true, '相对时间来自注入时钟：730 天在固定年档就是 2 年');
  assert.equal(html.includes('按民用日期'), false, '数字串这一档不该出现民用日期的口径行');
  const copy = m.wb.copyTextOf('timestamp', 'main');
  assert.equal(copy.includes('UTC：2023-11-14T22:13:20Z'), true, '复制的是明细表那些行，不是 HTML');
  assert.equal(copy.includes('相对时间：2 年前'), true);

  const milli = rMount({ seed: { 'timestamp:value': '1700000000000' } });
  milli.page.click('timestamp', 'main');
  assert.equal(milli.page.html('timestamp', 'main').includes('2023-11-14T22:13:20Z'), true, '13 位按毫秒');

  // 十一位：两种解释都成立，页面必须并列给，谁都不许被标成"已换算"（§K 的 K2 那一档）
  const amb = rMount({ seed: { 'timestamp:value': '17000000000' } });
  amb.page.click('timestamp', 'main');
  const ambHtml = amb.page.html('timestamp', 'main');
  assert.equal(ambHtml.includes('长度两可'), true);
  assert.equal(ambHtml.includes('按秒') && ambHtml.includes('按毫秒'), true, '两读要两行，中文说法归视图');
  assert.equal(ambHtml.includes('tk-state--ok'), false, '长度两可时不许把任何一种解释标成对');

  // 民用日期回落：`2026-09-01` 不是时间戳，但按 +08:00 解释成立，结果区必须说清用了哪一口径
  const civil = rMount({ seed: { 'timestamp:value': '2026-09-01' } });
  civil.page.click('timestamp', 'main');
  const civilHtml = civil.page.html('timestamp', 'main');
  assert.equal(civilHtml.includes('按民用日期'), true, '回落要留痕：不然用户以为 2026-09-01 是一串时间戳');
  assert.equal(civilHtml.includes('2026-09-01T00:00:00+08:00'), true, '不带时区标记的日期按注入偏移解释（K5）');
  assert.equal(civilHtml.includes('已换算'), true);

  // 两档都不成立：两条理由都要出现，只报一条等于把用户支走（§K 的 K3 同一条口径）
  const bad = rMount({ seed: { 'timestamp:value': '2026-02-29' } });
  bad.page.click('timestamp', 'main');
  const badHtml = bad.page.html('timestamp', 'main');
  assert.equal(badHtml.includes('不成立'), true);
  assert.equal(badHtml.includes('不是闰年'), true, `民用日期那一档的理由没进结果区：${JSON.stringify(badHtml.slice(0, 200))}`);
  assert.equal(badHtml.includes(parseTimestamp('2026-02-29').reason), true, '时间戳那一档的理由也要原样交出去');
  assert.equal(badHtml.includes('<table'), false, '不成立那一档没有可显示的明细');

  // `offset` 格填了就以它为准，且只动本地那一行——UTC 那一行是绝对量，谁都不该拿去乘偏移
  const local = rMount({ now: () => R_NOW, seed: { 'timestamp:value': '1700000000', 'timestamp:offset': '-120' } });
  local.page.click('timestamp', 'main');
  const localHtml = local.page.html('timestamp', 'main');
  assert.equal(localHtml.includes('2023-11-14T20:13:20-02:00'), true, '用户填的 ±分钟数应压过 env 的默认偏移');
  assert.equal(localHtml.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行不许被本地偏移改动');
  // 越界的偏移是"这一格不能用"，不是"这块面板坏了"（口径 3）。
  // 注意走的仍是同一道闸门——`guarded` 记的是"过没过闸门"，不是"有没有出错"，
  // 两条路的分别只在结果区里那一行是提示还是错误条，所以这一判量的是 `brokenOf`。
  const oob = rMount({ seed: { 'timestamp:value': '1700000000', 'timestamp:offset': '900' } });
  oob.page.click('timestamp', 'main');
  assert.match(oob.page.html('timestamp', 'main'), /class="tk-hint">/, '偏移越界应当是一行提示');
  assert.equal(oob.page.html('timestamp', 'main').includes('tk-result'), false, '提示行不该包在结果骨架里');
  assert.deepEqual(oob.guarded, ['timestamp'], 'FieldError 走的仍是同一道闸门，不另开第二条路');
  assert.equal(oob.page.ws.brokenOf('timestamp'), '', '把"你填的这格不能用"标成面板坏了，错误条那句"其余面板不受影响"就是废话');
});

test('R7 差值栏：三种口径同给、缺哪端点名的、两端相同就是 0', () => {
  const m = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': '2026-09-25' } });
  m.page.click('timestamp', 'diff');
  const html = m.page.html('timestamp', 'diff');
  assert.equal(html.includes('已换算'), true);
  assert.equal(html.includes('0 年 0 个月 24 天'), true, '日历分解那一行');
  assert.equal(html.includes('24 天'), true, '整 24 小时那一行');
  assert.equal(html.includes('跨 UTC 日历日'), true, '三种口径同时给，不替用户挑一种（K9）');
  assert.equal(html.includes('整 24 小时与跨 UTC 日历日是两种口径'), false, '这一对数值相同，不该多插一句口径行');
  assert.equal(m.wb.copyTextOf('timestamp', 'diff'),
    '日历分解：0 年 0 个月 24 天\n整 24 小时：24 天\n跨 UTC 日历日：24 天', '复制那三行就是结果区那三行');

  // 23:00 → 次日 01:00：整 24 小时是 0、跨日历日是 1，两种口径**必须不等**，页面要并列并且补一句
  const near = rMount({ seed: { 'timestamp:from': '2026-09-01T23:00Z', 'timestamp:to': '2026-09-02T01:00Z' } });
  near.page.click('timestamp', 'diff');
  const nearHtml = near.page.html('timestamp', 'diff');
  assert.equal(nearHtml.includes('整 24 小时与跨 UTC 日历日是两种口径'), true, '两口径分叉时那句说明由视图补，装配层不许自己写');
  assert.equal(nearHtml.includes('1 天'), true);
  assert.equal(nearHtml.includes('结束那一端在开始那一端之前'), false, '正差不该被标成反向');

  // 反向：ymd 说的是绝对值，方向必须另说一句，否则"1 年 0 个月 1 天"会被读成正向那一种
  const back = rMount({ seed: { 'timestamp:from': '2026-09-25', 'timestamp:to': '2026-09-01' } });
  back.page.click('timestamp', 'diff');
  assert.equal(back.page.html('timestamp', 'diff').includes('结束那一端在开始那一端之前'), true);

  const same = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': '2026-09-01' } });
  same.page.click('timestamp', 'diff');
  assert.equal(same.page.html('timestamp', 'diff').includes('0 年 0 个月 0 天'), true, '两端相同就是 0，不是一句"没差别"');

  // 缺哪一端就说哪一端还没填；填了但不成立要说清是哪一栏
  const half = rMount({ seed: { 'timestamp:from': '2026-09-01' } });
  half.page.click('timestamp', 'diff');
  assert.equal(half.page.html('timestamp', 'diff').includes('等待输入'), true, '只填一端就还没到算的时候');
  const wrong = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': 'abc' } });
  wrong.page.click('timestamp', 'diff');
  const wrongHtml = wrong.page.html('timestamp', 'diff');
  assert.equal(wrongHtml.includes('不成立'), true);
  assert.equal(wrongHtml.includes('终点'), true, `理由必须点名是哪一端：${JSON.stringify(wrongHtml.slice(0, 200))}`);
  assert.equal(wrongHtml.includes('起点'), false, '另一端是好的，不许一起挨打');
});

test('R8 时钟与偏移都缺席时的降级形状：不问环境，就把 UTC 那一档交出去', () => {
  const m = rMount({ now: undefined, offsetMinutes: null, seed: { 'timestamp:value': '1700000000' } });
  m.page.click('timestamp', 'main');
  const html = m.page.html('timestamp', 'main');
  assert.equal(html.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行与偏移无关，永远给得出');
  assert.equal(html.includes('2023-11-14T22:13:20+00:00'), true, '没有偏移可注入就按 +00:00，而不是拿本地时区猜');
  // 「相对时间」这四个字在 `TIME_CAVEAT` 里也出现一次（"相对时间的「月」按 30 天"），
  // 只比短语就会把口径行当成明细行。明细行在产物里的形状是 `<td>相对时间</td>`，量它。
  assert.equal(html.includes('<td>相对时间</td>'), false, '没有时钟就没有"几年前"那一行——静默读 Date.now() 才是缺陷');
  assert.equal(m.wb.copyTextOf('timestamp', 'main').includes('相对时间'), false);

  // 正则那一只时钟同理：注入才有"档间耗时"那一行，缺席就不给一个假数字
  const withClock = rMount({ now: () => 1000, seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  withClock.page.click('regex', 'main');
  assert.match(withClock.page.html('regex', 'main'), /档间累计耗时 \d+ms/);
  const noClock = rMount({ seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  noClock.page.click('regex', 'main');
  assert.equal(noClock.page.html('regex', 'main').includes('档间累计耗时'), false,
    '没注入时钟时 elapsedMs 是 null，视图那一格必须整行不出现');
});

test('R9 base64 四档方向、strict 档、mime 格与那两道损耗计数', () => {
  const enc = rMount({ seed: { 'base64:mode': 'encode', 'base64:text': '中' } });
  enc.page.click('base64', 'main');
  assert.equal(enc.page.html('base64', 'main').includes('>5Lit<'), true, '编码结果走那一族等宽行');
  assert.equal(enc.page.html('base64', 'main').includes('3 字节'), true, '字节数是输入侧的 UTF-8 字节数');
  assert.equal(enc.wb.copyTextOf('base64', 'main'), b64Of('中'));

  // 解码：模块那句"不在 Base64 字母表"必须原样进结果区（invalid 的理由归模块，装配层不重写）
  const dec = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': '5Lit' } });
  dec.page.click('base64', 'main');
  assert.equal(dec.page.html('base64', 'main').includes('已解码'), true);
  assert.equal(dec.page.html('base64', 'main').includes('>中<'), true);
  assert.equal(dec.wb.copyTextOf('base64', 'main'), '中');
  const nope = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': '!!!!' } });
  nope.page.click('base64', 'main');
  assert.equal(nope.page.html('base64', 'main').includes(decodeBase64('!!!!').reason), true);
  assert.equal(nope.page.html('base64', 'main').includes('不成立'), true);

  // 宽松档替用户补了 padding / 剥了空白，就不能只报"已解码"（Q8 钉的那两个词）
  const padded = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'YQ' } });
  padded.page.click('base64', 'main');
  const paddedHtml = padded.page.html('base64', 'main');
  assert.equal(paddedHtml.includes('有还原损耗'), true, '补了 2 位 padding 就是损耗，不是无损解码');
  assert.equal(paddedHtml.includes('补齐的 padding'), true);
  const even = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'YQ==' } });
  even.page.click('base64', 'main');
  assert.equal(even.page.html('base64', 'main').includes('有还原损耗'), false, '原文自带两位 = 时没有任何还原损耗');
  const spaced = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'Y Q' } });
  spaced.page.click('base64', 'main');
  assert.equal(spaced.page.html('base64', 'main').includes('剥掉的空白'), true);
  // strict 档只在解码那一档有意义：同一串输入在 strict 下是"不成立"，不是"有损耗"
  const strict = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'Y Q', 'base64:strict': 'strict' } });
  strict.page.click('base64', 'main');
  assert.equal(strict.page.html('base64', 'main').includes('不成立'), true, 'strict 档不接受空白');
  assert.equal(strict.page.html('base64', 'main').includes('有还原损耗'), false);

  // data URI 包装与解包：mime 格空白就是"用默认值"，模块自己会写成 text/plain
  const uri = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a', 'base64:mime': 'text/html' } });
  uri.page.click('base64', 'main');
  assert.equal(uri.page.html('base64', 'main').includes('data:text/html;charset=utf-8;base64,'), true);
  const def = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a' } });
  def.page.click('base64', 'main');
  assert.equal(def.page.html('base64', 'main').includes('data:text/plain;charset=utf-8;base64,'), true,
    'mime 格空着要把 null 递下去（空串会被模块判成"形状不合法"）');
  const badMime = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a', 'base64:mime': 'bog' } });
  badMime.page.click('base64', 'main');
  assert.equal(badMime.page.html('base64', 'main').includes('mime 形状不合法'), true);
  const unpack = rMount({ seed: { 'base64:mode': 'dataUriDecode', 'base64:text': 'data:;base64,YQ==' } });
  unpack.page.click('base64', 'main');
  const unpackHtml = unpack.page.html('base64', 'main');
  assert.equal(unpackHtml.includes('已解码'), true);
  assert.equal(unpackHtml.includes('text/plain'), true, 'mime 缺省这件事必须让用户看得见，否则复制下来是一串变了味的 URI');
  assert.equal(unpackHtml.includes('>a<'), true);

  // 页面级预闸门：超限的输入不进模块，也就不会长出模块那句按位置拒绝的话。
  // 尺子取模块的原句而不是"字母表"三个字——`BASE64_CAVEAT` 本来就含「字母表外的字符」，
  // 口径行常驻这一栏，用宽词量等于永远红。
  const huge = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'a'.repeat(MAX_INPUT_BYTES + 2) } });
  huge.page.click('base64', 'main');
  const hugeHtml = huge.page.html('base64', 'main');
  assert.equal(hugeHtml.includes('已拒收'), true, '整栏不处理是"已拒收"，不是"不成立"');
  assert.equal(hugeHtml.includes(String(MAX_INPUT_BYTES + 2)), true, '越界那一句必须报得出实际字节数');
  assert.equal(hugeHtml.includes('不在 Base64 字母表'), false, '预闸门拦下时不该再调模块');
  assert.equal(hugeHtml.includes('tk-line__raw'), false, '闸门拦下时没有结果行可摆');
  // 空输入与没选方向：两种"还没开始"都落在等待输入，且不许偷算
  for (const seed of [{ 'base64:mode': 'encode' }, { 'base64:text': 'abc' }]) {
    const idle = rMount({ seed });
    idle.page.click('base64', 'main');
    assert.equal(idle.page.html('base64', 'main').includes('等待输入'), true, `${JSON.stringify(seed)} 这一档不该算`);
  }
});

test('R10 URL 栏：两档并列 + 那 11 个差异字符 + 解码两条口径 + query 拆解', () => {
  const m = rMount({ seed: { 'url:text': 'a?b=c d' } });
  m.page.click('url', 'main');
  const html = m.page.html('url', 'main');
  assert.equal(html.includes('已编码'), true);
  assert.equal(html.includes('a?b=c%20d'), true, 'encodeURI 档保留 ? 与 =');
  assert.equal(html.includes('a%3Fb%3Dc%20d'), true, 'encodeURIComponent 档把 ? 与 = 一起编掉');
  assert.equal(html.includes('11 个字符在这一档不编码'), true, '差异数量由模块那两档实测出来，不是抄一个常数');
  // 字节那一格取自 `urlPair.bytes`，而 L11 钉死了它是**入参**字节数（不是编码结果长度）：
  // `a?b=c d` 是 7 个 ASCII 字符 = 7 字节，写成 9 就是把 `a%3Fb%3Dc%20d` 的长度当成了口径。
  assert.equal(html.includes('7 字节'), true);
  assert.equal(html.includes('a?b'), true, 'query 拆解按 & 切、只在第一个 = 处切一次');
  assert.deepEqual(m.wb.copyTextOf('url', 'main').split('\n'),
    ['encodeURI：a?b=c%20d', 'encodeURIComponent：a%3Fb%3Dc%20d']);

  // 百分号串：解得开就是"已解码"，两档的解码结果都要摆出来
  const dec = rMount({ seed: { 'url:text': 'a%3Fb%20c' } });
  dec.page.click('url', 'main');
  const decHtml = dec.page.html('url', 'main');
  assert.equal(decHtml.includes('已解码'), true, '带 %XX 且解得开，说"已编码"就是把用户刚粘的东西说反了');
  assert.equal(decHtml.includes('a?b c'), true);

  // 两档解码都失败：不是"没编"，是"这串百分号不成立"
  const bad = rMount({ seed: { 'url:text': '%zz' } });
  bad.page.click('url', 'main');
  const badHtml = bad.page.html('url', 'main');
  assert.equal(badHtml.includes('不成立'), true, '两档都解不开就是坏输入');
  assert.equal(badHtml.includes('十六进制'), true, `模块那句理由要原样进结果区：${JSON.stringify(badHtml.slice(0, 200))}`);

  // 落单代理项：模块那两道闸门之一，页面不许自己算一遍代理项
  const lone = rMount({ seed: { 'url:text': '\uD83D' } });
  lone.page.click('url', 'main');
  assert.equal(lone.page.html('url', 'main').includes('落单代理项'), true);

  const huge = rMount({ seed: { 'url:text': 'a'.repeat(MAX_INPUT_BYTES + 1) } });
  huge.page.click('url', 'main');
  assert.equal(huge.page.html('url', 'main').includes('已拒收'), true);
  assert.equal(huge.page.html('url', 'main').includes('1 MiB'), true);

  const idle = rMount({ seed: { 'url:text': '   ' } });
  idle.page.click('url', 'main');
  assert.equal(idle.page.html('url', 'main').includes('等待输入'), true, '整格空白也算还没输入');
});

test('R11 摘要栏：文本档五格恒定、通道预闸门与那个"没算"的计数器', async () => {
  // 挂载期不抢跑：文本已经 seeded，摘要一次都不算
  const fake = rSubtle();
  const idle = rMount({ subtle: fake, seed: { 'digest:mode': 'text', 'digest:payload': 'abc' } });
  assert.deepEqual(idle.guarded, [], '挂载期不许走 runGuarded');
  assert.deepEqual(fake.calls, [], '摘要那一栏异步，挂载期抢跑的话 reject 会落在 mount() 返回值之外');
  assert.equal(idle.page.html('digest', 'main').includes('等待输入'), true);

  idle.page.click('digest', 'main');
  await rSettle();
  const html = idle.page.html('digest', 'main');
  assert.equal(html.includes('已算出'), true);
  assert.equal(html.includes('900150983cd24fb0d6963f7d28e17f72'), true, 'MD5 走本站自实现，与外部判据源同一值');
  assert.equal(html.includes('000102'), true, 'SHA-* 走注入的 subtle：可控的三字节串就是可控的六字符 hex');
  assert.equal(html.includes('浏览器 crypto'), true, '谁算的必须说清');
  assert.equal(html.includes('文本 3 字节'), true, '文本档的计数行要点名通道');
  assert.deepEqual(idle.guarded, ['digest', 'digest'], '计算与画结果各过一遍闸门：异步回写不许逃逸');
  assert.deepEqual(fake.calls.map((c) => c.name), ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
    '四档 SHA 各一次、按规范名的大写带横杠形态传给 WebCrypto，MD5 不碰 subtle');
  assert.equal(idle.wb.copyTextOf('digest', 'main').split('\n')[0], 'md5=900150983cd24fb0d6963f7d28e17f72');

  // subtle 明确缺席（非安全上下文）：md5 还在、四档没了 → 部分可用，且来源列要说"环境不支持"
  const noSubtle = rMount({ subtle: null, seed: { 'digest:mode': 'text', 'digest:payload': 'abc' } });
  noSubtle.page.click('digest', 'main');
  await rSettle();
  const noHtml = noSubtle.page.html('digest', 'main');
  assert.equal(noHtml.includes('部分可用'), true, '五格里有四格算不成，报"已算出"就是骗人');
  assert.equal(noHtml.includes('环境不支持'), true);

  // 文件通道：只读一次盘，计数行不再点名通道（否则读起来是"字节 3 字节"），并补一句来源
  const file = rFile('report.csv', 'abc');
  const up = rMount({ subtle: rSubtle(), files: { 'digest:upload': file }, pick: { 'digest:mode': 'file' } });
  up.page.click('digest', 'main');
  await rSettle();
  const upHtml = up.page.html('digest', 'main');
  assert.equal(file.calls, 1, '一次计算只读一次盘');
  assert.equal(upHtml.includes('3 字节'), true);
  assert.equal(upHtml.includes('字节 3 字节'), false, 'kind 传 bytes 会让这一行变成"字节 3 字节"');
  assert.equal(upHtml.includes('report.csv'), true, '文件档要让用户看见读的是哪一个文件');
  assert.equal(upHtml.includes('不上传、不留存'), true, '隐私那句口径由页面自己说出来');

  // 声明尺寸越界的文件：预闸门拦在 `arrayBuffer()` 之前，一个大文件不许被读进内存
  const fat = rFile('big.bin', 'abc', { size: MAX_BYTES + 1 });
  const gated = rMount({ subtle: rSubtle(), files: { 'digest:upload': fat }, pick: { 'digest:mode': 'file' } });
  gated.page.click('digest', 'main');
  await rSettle();
  assert.equal(fat.calls, 0, '超限文件根本不该读盘');
  assert.equal(gated.page.html('digest', 'main').includes('已拒收'), true);
  assert.equal(gated.page.html('digest', 'main').includes(String(MAX_BYTES + 1)), true);

  // 文本档的页面级预闸门：`digestAll` 一次都不进（MD5 之外没有任何 subtle 调用）
  const fatText = rMount({ subtle: rSubtle(), seed: { 'digest:mode': 'text', 'digest:payload': 'a'.repeat(MAX_TEXT_BYTES + 1) } });
  fatText.page.click('digest', 'main');
  await rSettle();
  assert.deepEqual(fatText.subtle.calls, [], '超限文本不该走进模块');
  assert.equal(fatText.page.html('digest', 'main').includes('已拒收'), true);

  // 选了文件档却没选文件 / 文本档空着：两种"还没开始"
  const none = rMount({ subtle: rSubtle(), pick: { 'digest:mode': 'file' } });
  none.page.click('digest', 'main');
  await rSettle();
  assert.equal(none.page.html('digest', 'main').includes('等待输入'), true);
  assert.deepEqual(none.subtle.calls, []);
});

test('R12 正则栏：六档结论、静态形状拦在引擎之前、上限格与 flags 归一', () => {
  const m = rMount({ now: () => 5000, seed: { 'regex:pattern': '(\\d+)-(?<tail>\\w+)', 'regex:flags': 'g', 'regex:text': '12-ab 34-cd' } });
  m.page.click('regex', 'main');
  const html = m.page.html('regex', 'main');
  assert.equal(html.includes('有命中'), true);
  assert.equal(html.includes('共 2 处'), true);
  assert.equal(html.includes('序号'), true, '命中表要有');
  assert.equal(html.includes('tail'), true, '命名组那一行与位置组并存');
  assert.equal(html.includes('没开 d 就没有捕获组位置'), true, '位置那一列是空的，必须说一句为什么是空的');
  assert.equal(html.includes('生效的 flags：g'), true);
  assert.deepEqual(m.wb.copyTextOf('regex', 'main').split('\n'), ['12-ab', '34-cd']);

  // 开了 d 才有组位置：同一发输入换 flags，位置那一列从 — 变成数字
  const idx = rMount({ seed: { 'regex:pattern': '(\\d+)', 'regex:flags': 'gd', 'regex:text': 'a12' } });
  idx.page.click('regex', 'main');
  assert.equal(idx.page.html('regex', 'main').includes('没开 d 就没有捕获组位置'), false);
  assert.equal(/<td>1<\/td>/.test(idx.page.html('regex', 'main')), true, 'd 档下位置 1 要真出现');

  // 零命中是"零命中"，不是错误；替换预览只在填了那格时才给
  const none = rMount({ seed: { 'regex:pattern': 'z+', 'regex:text': 'abc' } });
  none.page.click('regex', 'main');
  assert.equal(none.page.html('regex', 'main').includes('零命中'), true);
  assert.equal(none.page.html('regex', 'main').includes('tk-state--bad'), false);
  const repl = rMount({ seed: { 'regex:pattern': 'a(b)c', 'regex:text': 'aXbYc', 'regex:repl': '$1' } });
  repl.page.click('regex', 'main');
  assert.equal(repl.page.html('regex', 'main').includes('替换预览'), true, '填了替换格就该给预览');
  const noRepl = rMount({ seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  noRepl.page.click('regex', 'main');
  assert.equal(noRepl.page.html('regex', 'main').includes('替换预览'), false, '替换格空着不是"全删掉"');

  // 次数上限：往下调才算得出"已到上限"，那一句话必须带上生效的那个数。
  // flags 必须给 'g'：不开全局，`a` 打 `aaaaaaaaaa` 永远只有 1 处，"已到上限"这一档根本长不出来。
  const capped = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'g', 'regex:text': 'a'.repeat(10), 'regex:limit': '3' } });
  capped.page.click('regex', 'main');
  const capHtml = capped.page.html('regex', 'main');
  assert.equal(capHtml.includes('已到上限'), true);
  assert.equal(capHtml.includes('上限 3 次'), true, 'capped 是本次生效的上限次数，不是布尔');
  assert.equal(capHtml.includes('共 3 处'), true);
  // 越界与不合法是"这一格不能用"，一次都不许进引擎
  // （同样开 'g'：这一发输入本来能算出「共 3 处」，上限格一坏就必须整栏不跑，否则这句断言是白给的）
  for (const limit of ['2000', '0', '-1', 'abc']) {
    const bad = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'g', 'regex:text': 'aaa', 'regex:limit': limit } });
    bad.page.click('regex', 'main');
    assert.match(bad.page.html('regex', 'main'), /class="tk-hint">/, `上限「${limit}」应当是一行提示`);
    assert.equal(bad.page.html('regex', 'main').includes('共 3 处'), false, `${limit} 这一档不该算出命中`);
  }

  // 灾难性回溯形状：静态检测先于执行，结论是"已拒收"，命中表一格都不许有
  const scary = rMount({ seed: { 'regex:pattern': '(a+)+$', 'regex:text': `${'a'.repeat(30)}b` } });
  scary.page.click('regex', 'main');
  const scaryHtml = scary.page.html('regex', 'main');
  assert.equal(scaryHtml.includes('已拒收'), true);
  assert.equal(scaryHtml.includes('序号'), false, '引擎一次都没跑，就不该有命中表');
  assert.equal(scaryHtml.includes('高危'), true, 'findings 那张表要跟着出来，用户才知道为什么被拒');

  // 编译不过：level 是 null，走"不成立"那一档，理由原样取自模块
  const badPattern = rMount({ seed: { 'regex:pattern': '(', 'regex:text': 'abc' } });
  badPattern.page.click('regex', 'main');
  assert.equal(badPattern.page.html('regex', 'main').includes('不成立'), true);
  assert.equal(badPattern.page.html('regex', 'main').includes(findMatches('(', '', 'abc').reason), true,
    'native 的报错文案随引擎版本变，本节只判"原样交出去"，不判它长什么样');

  // flags 里重复位由模块归一：页面把归一这件事说出来，而不是悄悄改了用户的输入
  const dup = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'gg', 'regex:text': 'aaa' } });
  dup.page.click('regex', 'main');
  const dupHtml = dup.page.html('regex', 'main');
  assert.equal(dupHtml.includes('生效的 flags：g'), true);
  assert.equal(dupHtml.includes('重复'), true, '归一是改动用户输入，必须在判定表里留一行');

  // 空白 pattern 或空白待测文本：还没开始，不进模块（静态形状那一步也不许跑）
  for (const seed of [{ 'regex:pattern': 'a', 'regex:text': '' }, { 'regex:text': 'abc' }]) {
    const idle = rMount({ seed });
    idle.page.click('regex', 'main');
    assert.equal(idle.page.html('regex', 'main').includes('等待输入'), true, `${JSON.stringify(seed)} 这一档不该进引擎`);
    assert.equal(idle.page.html('regex', 'main').includes('高危'), false);
  }
});

test('R13 两条失败路：FieldError 是一行提示，骨架缺一格与读盘失败只标坏这一块', async () => {
  // ① 缺主栏结果区：这块面板抛穿到绑定层，其余四块照旧
  const a = rMount({ drop: ['tk-out-base64-main'] });
  assert.deepEqual(a.report.broken, ['base64']);
  assert.deepEqual(a.report.missing, [], 'tab 与 panel 两半都在，不算骨架不完整');
  assert.deepEqual(a.report.rendered, CODEC_PANEL_IDS.filter((id) => id !== 'base64'));
  assert.match(a.page.ws.brokenOf('base64'), /tk-out-base64-main/);
  assert.match(iBanner(a.page, 'base64').textContent, /其余面板不受影响/);
  for (const [panel, side] of [['timestamp', 'main'], ['url', 'main'], ['digest', 'main'], ['regex', 'main']]) {
    assert.equal(a.page.html(panel, side).includes('等待输入'), true, `${panel}.${side} 被隔壁缺的一格拖坏了`);
  }
  // 缺的是差值栏那一格：塌的范围是那一栏，主栏已经画好的内容不许被拖没
  const a2 = rMount({ drop: ['tk-out-timestamp-diff'] });
  assert.deepEqual(a2.report.broken, ['timestamp']);
  assert.equal(a2.page.html('timestamp', 'main').includes('等待输入'), true);
  assert.equal(a2.page.html('timestamp', 'diff'), '');

  // ② 缺复制按钮：内容照样能看，不该因此把面板判坏
  const c = rMount({ drop: ['tk-copy-url-main'] });
  assert.deepEqual(c.report.broken, []);
  assert.equal(c.page.copy('url', 'main'), null);
  c.page.set('url', 'text', 'a?b');
  assert.doesNotThrow(() => c.page.click('url', 'main'), '再点一次计算也不该因为没按钮而抛');
  assert.equal(c.wb.copyTextOf('url', 'main').includes('encodeURIComponent'), true, '复制文本照旧备着');

  // ③ 缺开关目标那一段：少一段显隐，不该把整块面板送进 broken 名单
  const d = rMount({ drop: ['tk-when-base64-mime'] });
  assert.deepEqual(d.report.broken, []);
  assert.equal(d.page.whenNode('base64', 'mime'), null, '夹具自证：这一格本来就没建');
  assert.doesNotThrow(() => {
    d.page.set('base64', 'mode', 'dataUri');
    d.page.change('base64', 'mode');
  }, 'applySwitch 撞上缺节点就抛，用户切档时这块面板当场进 broken 名单');

  // ④ 读盘失败：异步 reject 必须回到同一道闸门，只标坏摘要这一块
  const broken = rFile('gone.csv', 'abc', { fail: true });
  const e = rMount({ subtle: rSubtle(), files: { 'digest:upload': broken }, pick: { 'digest:mode': 'file' } });
  assert.deepEqual(e.report.broken, [], '挂载期不算，所以此刻还没有任何东西坏掉');
  e.page.click('digest', 'main');
  await rSettle();
  assert.deepEqual(e.guarded, ['digest', 'digest'], '异步回写要重新走 runGuarded，否则 reject 就逃逸到控制台了');
  assert.match(e.page.ws.brokenOf('digest'), /读不到这个文件/);
  assert.match(iBanner(e.page, 'digest').textContent, /其余面板不受影响/);
  assert.equal(e.page.html('regex', 'main').includes('等待输入'), true, '一块塌不该连着四块');
  // 换回一个能读的文件再算一次：错误条撤掉，同一块面板恢复可用
  e.page.setFiles('digest', 'upload', rFile('ok.csv', 'abc'));
  e.page.click('digest', 'main');
  await rSettle();
  assert.equal(e.page.ws.brokenOf('digest'), '', '成功一次就把错误条撤掉，否则那块面板永远红着');
  assert.match(e.page.html('digest', 'main'), /已算出/);
});

test('R14 接线：Enter 的分档、mode 驱动显隐、复制三级兜底与改口改回', async () => {
  const writes = [];
  const m = rMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } },
    seed: { 'timestamp:value': '1700000000' } });
  // 单行格与数字格：裸 Enter 就是提交
  m.page.keyOn('timestamp', 'value', { key: 'Enter' });
  assert.equal(m.page.html('timestamp', 'main').includes('已换算'), true, '文本格里的 Enter 该触发主栏');
  assert.deepEqual(m.guarded, ['timestamp']);
  m.page.keyOn('timestamp', 'offset', { key: 'Enter', ctrlKey: true });
  assert.deepEqual(m.guarded, ['timestamp'], '带修饰键的 Enter 在数字格上没有提交语义');

  // 多行粘贴框：裸 Enter 必须是换行，只有 Ctrl / ⌘ + Enter 触发
  const u = rMount({ seed: { 'url:text': 'a?b' } });
  u.page.keyOn('url', 'text', { key: 'Enter' });
  assert.equal(u.page.html('url', 'main').includes('等待输入'), true, '粘贴框里的 Enter 吞掉换行是缺陷');
  let prevented = 0;
  u.page.keyOn('url', 'text', { key: 'Enter', ctrlKey: true, preventDefault: () => { prevented += 1; } });
  assert.equal(u.page.html('url', 'main').includes('已编码'), true);
  assert.equal(prevented, 1, '组合键提交要吃掉默认动作，否则浏览器可能再走一遍表单');
  u.page.keyOn('url', 'text', { key: 'Enter', metaKey: true });
  assert.equal(u.guarded.filter((x) => x === 'url').length, 2, '⌘ + Enter 与 Ctrl + Enter 同一条路');

  // mode 那一格驱动字段组显隐：切到哪一档，另一档的字段就藏起来
  const b = rMount({ seed: { 'base64:mode': 'decode' } });
  assert.equal(b.page.whenNode('base64', 'strict').hidden, false);
  assert.equal(b.page.whenNode('base64', 'mime').hidden, true, 'mime 只在包装那一档出现');
  b.page.set('base64', 'mode', 'dataUri');
  b.page.change('base64', 'mode');
  assert.equal(b.page.whenNode('base64', 'mime').hidden, false);
  assert.equal(b.page.whenNode('base64', 'strict').hidden, true);
  // 挂载时 mode 是占位项：两段都该藏着，页面上不留一格用不上的字段
  const fresh = rMount();
  assert.equal(fresh.page.whenNode('base64', 'strict').hidden, true);
  assert.equal(fresh.page.whenNode('digest', 'payload').hidden, true);

  // 复制：纯文本、按钮改口、1600 ms 之后改回骨架那句原文
  b.page.set('base64', 'text', '中');
  b.page.set('base64', 'mode', 'encode');
  b.page.change('base64', 'mode');
  b.page.click('base64', 'main');
  assert.equal(b.page.copy('base64', 'main').disabled, false, '有结果就该能复制');
  b.page.clickCopy('base64', 'main');
  await rSettle();
  assert.equal(writes.length, 0, '这一发夹具没给 clipboard，走的是 execCommand 兜底');
  assert.deepEqual(b.page.commandLog, ['copy']);
  assert.equal(b.page.copy('base64', 'main').textContent, '已复制');
  assert.equal(b.timers.length, 1, '改口要能改回来，就得留下一条恢复用的定时器');
  assert.equal(b.timers[0].ms, 1600);
  b.flush();
  assert.equal(b.page.copy('base64', 'main').textContent, '复制结果', '恢复的是骨架那句原文案，不是写死的一句');

  // 用剪贴板那一只：复制的必须是这一栏的纯文本，且 disabled 跟着文本走
  const withClip = rMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
  withClip.page.click('regex', 'main');
  assert.equal(withClip.page.copy('regex', 'main').disabled, true, '空结果不该留一条能点的复制按钮');
  withClip.page.set('regex', 'pattern', 'a');
  withClip.page.set('regex', 'flags', 'g');
  withClip.page.set('regex', 'text', 'aaa');
  withClip.page.click('regex', 'main');
  assert.equal(withClip.page.copy('regex', 'main').disabled, false);
  withClip.page.clickCopy('regex', 'main');
  await rSettle();
  assert.deepEqual(writes, ['a\na\na'], '复制的是三处命中的纯文本、用换行相连，不是那一叠 HTML');

  // 换 hash 走的是绑定层那一条：装配层只管把六栏画上，不碰地址栏
  const h = rMount({ hash: '#regex' });
  assert.deepEqual(iVisible(h.page), ['regex']);
  h.page.location.hash = '#url';
  h.page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(h.page), ['url']);
  assert.equal(h.page.tab('url').getAttribute('aria-selected'), 'true');

  // `wb.run` 走的是与按钮完全同一条路（含 runGuarded），不给测试留第二条后门
  const direct = rMount({ seed: { 'url:text': 'a?b' } });
  const before = direct.guarded.length;
  assert.equal(direct.wb.run('url', 'main'), true);
  assert.equal(direct.guarded.length, before + 1);
  assert.equal(direct.page.html('url', 'main').includes('已编码'), true);
  assert.equal(direct.wb.run('digest', 'nosuch'), false, '栏位名不在 spec 里就是调用方写错了，不许凭空画一栏');
});

test('R15 每块面板的口径行在自己那块恰好一次，跨栏不串', () => {
  const NOTES = { timestamp: TIME_CAVEAT, base64: BASE64_CAVEAT, url: URL_CAVEAT, digest: DIGEST_CAVEAT, regex: REGEX_CAVEAT };
  const m = rMount();
  // 量的是**转义之后**的那一句：视图唯一的插值出口是 `view.esc`，而 `URL_CAVEAT` 里带着一个
  // 「&」（`query 只按「&」切分`），原样串在产物里根本不存在。转义是双射，比转义后的串
  // 仍然钉住同一句话——一个字不缺、一个字不多。
  const inHtml = (note) => Q_VIEW.esc(note);
  for (const [panel, note] of Object.entries(NOTES)) {
    for (const side of R_SIDES) {
      if (!CODEC_SPEC[panel].sides[side]) continue;
      assert.equal(rCount(m.page.html(panel, side), inHtml(note)), 1, `${panel}.${side} 挂载期就该带自己的那句口径，而且只带一次`);
    }
  }
  // 算完之后仍然只有一句：口径行不随计算次数叠加
  m.page.set('base64', 'mode', 'encode');
  m.page.set('base64', 'text', 'a');
  for (let i = 0; i < 3; i += 1) m.page.click('base64', 'main');
  assert.equal(rCount(m.page.html('base64', 'main'), inHtml(BASE64_CAVEAT)), 1, '点三次只留一句，否则那块结果区每点一次长一行');
  // 各块面板的口径句不许跑到别人家
  for (const [panel, note] of Object.entries(NOTES)) {
    for (const other of Object.keys(NOTES)) {
      if (other === panel) continue;
      assert.equal(m.page.html(other, 'main').includes(inHtml(note)), false, `${note.slice(0, 12)}… 串到了 ${other}`);
    }
  }
});

test('R16 入口只读骨架那四格数据；启动失败不装死，成功路径把两条 <script> 接起来', async () => {
  /** 与 §J 的 `run` 同一条路：入口在 import 那一刻就 `start(document, window)`，
   *  所以每一档都要先把两个全局摆好、再换查询串 import（同一 URL 只执行一次）。 */
  const run = async (tag, page, fn) => {
    globalThis.document = page.doc;
    globalThis.window = Object.assign({}, page.win, {
      location: page.location, history: page.history, navigator: {},
    });
    try {
      return await fn(tag);
    } finally {
      delete globalThis.document;
      delete globalThis.window;
    }
  };
  const withCore = (tag) => import(`../dev/js/toolkitCore.js?r16-${tag}`);
  const box = (page, attrs) => page.mk('div', 'tk-workspace', {
    'data-tk-ids': CODEC_PANEL_IDS.join(','), 'data-tk-prefix': 'tk',
    'data-tk-label': '编码与换算', 'data-tk-notice': 'tk-notice', ...attrs,
  });

  // ── 成功：时钟与偏移由入口读环境，装配层只收注入 ──
  {
    const page = rPage();
    box(page);
    await run('ok', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolCodec.js?r16-${tag}`);
      for (const id of CODEC_PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab', `${id} 没被升级成 tab`);
      }
      assert.equal(page.html('timestamp', 'main').includes('等待输入'), true, '入口接错了就一格都画不上');
      assert.equal(page.notice.hidden, true, '启动成功就别留提示行');
      page.set('timestamp', 'value', '1700000000');
      page.btn('timestamp', 'main').dispatch('click', {});
      assert.equal(page.html('timestamp', 'main').includes('2023-11-14T22:13:20Z'), true);
      // 本地那一行走的是入口注入的宿主偏移：装配层自己问环境的话，这一行在 CI 上会漂。
      // 期望值不手拼——按 `time.js` 在同一偏移下现算（`22:13:20Z` 在东八区已经是**次日**
      // `06:13:20+08:00`，把 UTC 那一串直接接上偏移后缀会漏掉跨日界，那一版判据是白给的）。
      const host = -new Date().getTimezoneOffset();
      assert.equal(page.html('timestamp', 'main').includes(fromEpoch(1700000000000, host).isoLocal), true,
        `入口该把 -getTimezoneOffset() 当偏移递进去（本机偏移 ${host} 分钟）`);
      page.location.hash = '#regex';
      page.win.dispatch('hashchange');
      assert.deepEqual(iVisible(page), ['regex']);
    });
  }

  // ── 失败一档：容器都没有（脚本被挪进 <head> 就是这个形状）──
  {
    const page = rPage();
    await run('nocontainer', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /tk-workspace/);
      assert.equal(page.notice.hidden, false, '启动失败必须留下一句能抄下来问人的话');
      assert.match(page.notice.textContent, /这一页的交互层没能启动/);
      assert.match(page.notice.textContent, /正文仍然读得到/);
    });
  }

  // ── 失败二档：容器在，`data-tk-ids` 是空的（yml 漏了 slug）──
  {
    const page = rPage();
    box(page, { 'data-tk-ids': ' , ' });
    await run('emptyids', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /data-tk-ids/);
      assert.match(page.notice.textContent, /onlineTools\.yml/);
    });
  }

  // ── 失败三档：`window.Tk` 没挂上来（core 404 或排在入口之后）──
  {
    const page = rPage();
    box(page);
    await run('notk', page, async (tag) => {
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /window\.Tk/);
      assert.match(page.notice.textContent, /toolkitCore\.min\.js/);
      assert.equal(page.tab('url').getAttribute('role'), 'link', '框架层没跑，骨架的 role 原样留着');
      assert.equal(page.html('url', 'main'), '');
    });
  }

  // ── 容器在但它读不到属性：报错正文里要有容器 id 与排查方向 ──
  {
    const page = rPage();
    const b = box(page);
    delete b.getAttribute;
    await run('noattr', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /tk-workspace/,
        'TypeError 里既没有容器 id 也没有排查方向，抄下来问不到人');
      assert.match(page.notice.textContent, /两条 <script>/);
    });
  }

  // ── 换前缀：骨架写 `data-tk-prefix: zx`，行为那副面孔整套跟着换 ──
  {
    const page = rPage({ prefix: 'zx' });
    box(page, { 'data-tk-prefix': 'zx', 'data-tk-notice': 'zx-notice' });
    await run('zx', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolCodec.js?r16-${tag}`);
      for (const id of CODEC_PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab',
          `${id} 没被升级成 tab：绑定层找的是 tk-tab-*，骨架写的是 zx-tab-*`);
      }
      assert.equal(page.html('base64', 'main').includes('等待输入'), true);
      page.set('base64', 'mode', 'encode');
      page.set('base64', 'text', '中');
      page.click('base64', 'main');
      assert.equal(page.html('base64', 'main').includes('>5Lit<'), true);
      assert.equal(page.notice.hidden, true, '这一档是成功路径，不该留提示行');
    });
  }
});

// ── §U YAML/XML/CSV 互转（tools/json-convert.js，段 4 Task 1 起）────────────────
//   本段第一格只立**内置上游件**那一族（U1–U5）。YAML 的实现要到 Task 4 才落，但
//   "仓库里躺着一本别人写的浏览器端产物"这件事必须当天就有人盯着：将来谁"顺手修一下
//   这个 minified 文件"（改一个空格、剥掉尾部那条 sourcemap 引用、换个版本），
//   THIRD-PARTY-NOTICES.md 第一节里"逐字节比对已确证（就是上游那一份）"那句话就变成谎话。
//   为什么它是内置件而不是依赖：段 4 计划 §0.4 那三条理由（package.json 当时被另一路会话
//   占着 / 本仓库浏览器代码的既有做法就是 dev/libJs 内置 / 内置的价钱量得出来——探针实测
//   toolJson 那一族 16,912B gzip），口径与复算命令都写在那一格，这里不抄第二遍。
//   两条计量口径的坑提前挡掉：`grep -c` 数的是**行**而这些产物是单行的（U3 用 split 数次数）；
//   注释里出现的那个路径不是 import 边（U4 先剥注释再数，否则本文件自己就是第一条假命中）。

/** 内置件在仓库里的位置与它的上游身份，三个数一起才钉得住"这一本 = 那一份"。 */
const YAML_LIB_PATH = 'dev/libJs/js-yaml.esm.min.mjs';
const YAML_LIB_BYTES = 78721;
/** npm tarball js-yaml-5.4.2 里 `package/dist/browser/js-yaml.esm.min.mjs` 那个成员 */
const YAML_LIB_SHA256 = '154ea2da9e53404fb206f19cb9ce6c3a9880295fa34b96e40855be7cbc02f082';
/** `https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz` 整包（363,341B，2026-09-29 curl 实读） */
const YAML_TGZ_SHA256 = '0003d2f51f6717c17a708449d05f2f8d8c90a52e9ba4587ff7e8e474c9792209';
/** 唯一被允许 import 它的那一本装配层之外的纯逻辑模块（§0.4 落地规矩第三条） */
const YAML_LIB_CONSUMER = 'dev/js/tools/json-convert.js';

test('U1 内置件逐字节等于上游 tarball 的那个成员，尾部 sourcemap 引用不许剥', () => {
  const abs = resolve(ROOT, YAML_LIB_PATH);
  const bytes = readFileSync(abs);
  assert.equal(bytes.length, YAML_LIB_BYTES,
    `字节数不是 §0.4 探针那格记的 ${YAML_LIB_BYTES}——内置件被改写过，或上游换了版本而没人改判据`);
  assert.equal(sha256Of(bytes), YAML_LIB_SHA256,
    `与 js-yaml 5.4.2 那个成员的 sha256 不符：换版本要走 §0.4 的升级口径（换文件 + 改本判据 + 复跑 §U/§W），`
    + `整包哈希 ${YAML_TGZ_SHA256} 记在这里是为了能从 tarball 复算，不是让人顺手 sed 这个文件`);
  const text = bytes.toString('utf8');
  assert.match(text, /\/\/# sourceMappingURL=js-yaml\.esm\.min\.mjs\.map$/,
    '尾部那条 map 引用被剥掉了——它指向站内不存在的文件，但"逐字节等于上游"比"少一行注释"值钱（ jquery.min.js 同样挂着一条，线上多年无人受害）');
});

test('U2 banner 里的版本与许可就是判据与 THIRD-PARTY-NOTICES 写的那一串', () => {
  const first = readFileSync(resolve(ROOT, YAML_LIB_PATH), 'utf8').split('\n', 1)[0];
  assert.equal(first, '/*! js-yaml 5.4.2 https://github.com/nodeca/js-yaml @license MIT */',
    '首行 banner 变了就是身份变了：版本串、上游地址或许可任一项都不许靠记忆改');
});

test('U3 浏览器端产物：四个 Node 专属词各 0 次（数次数不是数行）', () => {
  const code = readFileSync(resolve(ROOT, YAML_LIB_PATH), 'utf8');
  for (const word of ['require(', 'process.', 'Buffer', 'module.exports']) {
    assert.equal(code.split(word).length - 1, 0,
      `内置件里出现了 ${word}——它就不再是"只给浏览器用"的那一本了（spec §7 指定的是 dist/browser 入口）`);
  }
});

test('U4 全仓库只有一本 import 它，且那一本就是 json-convert.js', () => {
  const importers = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const abs = join(dir, f);
      if (statSync(abs).isDirectory()) {
        // dev/libJs 是内置件自己的家：扫它只会把"文件名里带这个串"当成 import 边
        if (resolve(abs) !== resolve(ROOT, 'dev/libJs')) walk(abs);
        continue;
      }
      if (!/\.(js|mjs)$/.test(f) || f.endsWith('.min.js')) continue;
      const code = readFileSync(abs, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (code.includes('libJs/js-yaml')) importers.push(relative(ROOT, abs).split(sep).join('/'));
    }
  };
  walk(resolve(ROOT, 'dev'));
  assert.deepEqual(importers, [YAML_LIB_CONSUMER],
    `import 内置件的文件应当恰好只有 ${YAML_LIB_CONSUMER} 一本，实读 ${JSON.stringify(importers)}——`
    + `多一本就是给"两个入口同时 import 同一模块 → Rollup 提共享 chunk → iife-wrap 后产物里是 import{…}"`
    + `那一族坑递刀（toolkitCore.js:5-9 记的正是它，牙齿在门禁④）`);
});

test('U5 它不是 npm 依赖：package.json 与 pnpm-lock.yaml 里 js-yaml 出现 0 次', () => {
  for (const rel of ['package.json', 'pnpm-lock.yaml']) {
    assert.equal(read(rel).split('js-yaml').length - 1, 0,
      `${rel} 里出现了 js-yaml——§0.4 拍的是"内置不加依赖"。若这一格改成依赖，`
      + `要同时删掉 U1–U4 与内置件本体，并改 THIRD-PARTY-NOTICES.md 那一行的判据口径，不许两套并存`);
  }
});

// §U 续（Task 4 落地三对互转）：这一族钉的是"站在内置件上面写出去的三对转换"。
//   上面 U1–U5 钉的是"仓库里躺着的那一本上游件"，两族各有各的盯法，不重名也不重口径。
//   方向不对称，判据也得分开写：
//     · JSON → X 是**本站写出去**的东西，形状按逐字相等来断（缩进、引号、换行、结尾），
//       因为它要给人复制走、贴进别人的文件里；
//     · X → JSON 是**别人写来的**东西，只能立一个"无损子集"：子集内逐字往返，子集外点名拒绝，
//       绝不"尽力而为"地把读不懂的东西猜成某个值（设计文档 §5.4「给依据不给黑箱」）。
//   YAML 那一族读侧用的 schema 是 YAML11 而不是默认的 CORE：CORE 连 `!!binary` 都不认
//   （实测抛 unknown scalar tag），而 §0.6 承诺了"binary → base64 串、Date → ISO 串"两条，
//   只有 YAML11 给得出这两个类型。价钱是 YAML 1.1 那族历史包袱会真的生效：`yes/no/y/n/on/off`
//   是布尔、`0755` 是八进制、`2024-01-01` 是日期、连键位上单个 `y` 也是布尔。写侧全部靠引号挡住
//   （dump 自己会加，U7 逐字钉住），读侧挡不住的那几档由 U8 逐条点名、并由 YAML_NOTES 如实告诉用户。
//   深度那一格是**实测出来的数**：内置件的读侧自己带一道嵌套闸门，2026-09-29 在它上面二分得到
//   98 层（第 99 层抛 nesting exceeded maxDepth (100)；报错里那个 100 是它自己的内部计数器，
//   与"用户能嵌套几层"差 2，所以判据钉实测的 98，不钉消息里的 100）。写侧用同一个数，理由只有一条：
//   **写出去就必须读得回来**。它比 §7 的深样本（200 层）窄，所以 roundTrips().yaml 在那一档会给
//   false，面板照实显示，不假装能转。
//   XML 只支持本站自己写的那个子集：`t` 属性标类型、数组元素一律 `<item>`、空白不 trim；
//   命名空间、DOCTYPE、外部实体、非预定义实体一律拒（U12 逐条）。
//   CSV 按 RFC 4180 补三处（引号转义、内嵌换行、CRLF），读回来一律是字符串——它没有类型可保
//   （CSV_NOTES 那一格就是这句）。
const U_MOD = await import('../dev/js/tools/json-convert.js');
const { YAML_LIB, YAML_NOTES, YAML_DEPTH_LIMIT, XML_CONVENTION, CSV_NOTES,
  jsonToYaml, yamlToJson, jsonToXml, xmlToJson, jsonToCsv, csvToJson, roundTrips } = U_MOD;
// 这一族要自己算"闸门那一档该报哪一格"，所以借 core 的五件：`locate` 与 `lineRange` 用来对账
// （error 里的行列必须由 index 推得出来，两套数字不许各说各话；snippet 必须是那一行、不含 `\r`），
// `gate` 用来对消息原话。别名是必须的——
// `MAX_INPUT_BYTES` 这一格在 §L 已经被 codec.js 的 1 MiB 占了顶层名。
const { MAX_INPUT_BYTES: U_JSON_BYTES, MAX_INPUT_LINES: U_LINES, MAX_DEPTH: U_MAX_DEPTH,
  gate: uGate, locate: uLocate, lineRange: uLineRange } = await import('../dev/js/tools/json-core.js');

/** 剥注释扫源码：与 §S/§T 同形，扫的是代码不是注释里的自我声明 */
const uCode = () => read('dev/js/tools/json-convert.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 写侧成功：失败就让测试红在"实读了什么"上，不红在一句 undefined 上 */
const uWrite = (r, what = '写侧') => {
  if (!r.ok) throw new Error(`${what}应当成功，实读 error=${JSON.stringify(r.error)}`);
  return r.text;
};
const uWriteErr = (r, what = '写侧') => {
  if (r.ok) throw new Error(`${what}应当被拒，却成功产出 ${JSON.stringify(r.text).slice(0, 70)}`);
  return r.error;
};
const uRead = (r, what = '读侧') => {
  if (!r.ok) throw new Error(`${what}应当成功，实读 error=${JSON.stringify(r.error)}`);
  return r.value;
};
const uReadErr = (r, what = '读侧') => {
  if (r.ok) throw new Error(`${what}应当被拒，却解析成 ${JSON.stringify(r.value).slice(0, 70)}`);
  return r.error;
};
/** 只挂 own 键的原型污染样本：`o.__proto__ = v` 改的是原型，必须 defineProperty 才落成真属性 */
const uWithProtoKey = (value) => {
  const o = { b: 2 };
  Object.defineProperty(o, '__proto__', { value, enumerable: true, writable: true, configurable: true });
  return o;
};
/** 造 n 层嵌套数组（U6 与 U8 的两档深度样本都用它，别再各写一遍循环） */
const uDeep = (n) => { let v = 1; for (let i = 0; i < n; i++) v = [v]; return v; };
/** U+FEFF：CSV（U15、U16）与 XML（U12、U13）两族都要它，字面量里不写转义，一律 chr 造 */
const U_BOM = String.fromCharCode(0xfeff);
/** 深相等（走 assert 的严格口径：-0 与 +0 是两格，NaN 自等）；U17 的"手工往返"用它 */
const uEq = (a, b) => {
  try { assert.deepStrictEqual(a, b); return true; } catch { return false; }
};
/** 一趟往返：写侧不抛且 ok、读侧 ok、回来与原值深相等——roundTrips 的定义就是这三件事 */
const uRound = (value, write, read) => {
  const w = write(value);
  if (w.ok !== true) return false;
  const r = read(w.text);
  return r.ok === true && uEq(r.value, value);
};

test('U6 JSON→YAML→JSON 逐值原样：本站写出去的东西一定读得回来', () => {
  const U6_SAMPLES = [
    ['空对象', {}],
    ['空数组', []],
    ['纯标量数组', [1, 'a', true, null]],
    ['两层对象', { a: 1, b: 'x' }],
    ['深嵌套', { a: { b: { c: { d: 'deep' } } } }],
    ['数组里套对象', { arr: [{ k: 1 }, { k: 2 }], n: null }],
    ['空键名', { '': 'x', b: 2 }],
    ['中文键值', { 中文: '值', 键: { 内: [1, 2] } }],
    ['引号与撇号', { s: 'a"b\'c', t: 'it\'s' }],
    ['多行串', { m: '第一行\n第二行\n' }],
    ['制表与前空格', { tab: 'a\tb', lead: ' x ' }],
    ['数字族', { n: [0, -0.5, 1e21, -1e-7, 3.14159, 9007199254740991] }],
    ['歧义串全族', {
      yes: 'yes', no: 'no', on: 'On', y: 'y', n: 'n', nul: 'null', tilde: '~',
      inf: '.inf', nan: '.nan', oct: '0755', hex: '0x10', date: '2024-01-01', exp: '1e5', bool: 'true',
    }],
    ['YAML 指示符起始', {
      bang: '!x', hash: '#c', amp: '&a', star: '*a', at: '@x', pct: '%x', pipe: '|x',
      gt: '>', dash: '-', plus: '+', qm: '?', colon: 'a: b', comma: 'a,b',
    }],
    ['长串', { long: 'x'.repeat(500) }],
    ['__proto__ 是真属性', uWithProtoKey('x')],
    ['嵌套到闸门那一层', uDeep(YAML_DEPTH_LIMIT)],
  ];
  for (const [label, v] of U6_SAMPLES) {
    const text = uWrite(jsonToYaml(v), label);
    assert.ok(text.endsWith('\n'), `${label}：YAML 文本必须以换行结尾——复制框里少这一个换行，黏上来的就是下一行`);
    assert.equal(text, uWrite(jsonToYaml(v), label), `${label}：同一份输入两次产出逐字相同（不许有随机键序或时间戳）`);
    // deepStrictEqual 而不是 deepEqual：后者把 -0 与 0、null 与 undefined 判等，正是"原样回来"不能容忍的
    assert.deepStrictEqual(uRead(yamlToJson(text), label), v, `${label}：往返改了值`);
  }
});

test('U7 歧义值写侧必须带引号——值位与键位各一档，负零单列', () => {
  const U7_VALUE = [
    [{ a: 'yes' }, 'a: \'yes\'\n'], [{ a: 'no' }, 'a: \'no\'\n'], [{ a: 'On' }, 'a: \'On\'\n'],
    [{ a: 'y' }, 'a: \'y\'\n'], [{ a: 'n' }, 'a: \'n\'\n'], [{ a: 'true' }, 'a: \'true\'\n'],
    [{ a: 'null' }, 'a: \'null\'\n'], [{ a: '~' }, 'a: \'~\'\n'], [{ a: '.inf' }, 'a: \'.inf\'\n'],
    [{ a: '0755' }, 'a: \'0755\'\n'], [{ a: '0x10' }, 'a: \'0x10\'\n'], [{ a: '1e5' }, 'a: \'1e5\'\n'],
    [{ a: '2024-01-01' }, 'a: \'2024-01-01\'\n'],
    [{ a: '2024-01-01T00:00:00.000Z' }, 'a: \'2024-01-01T00:00:00.000Z\'\n'],
  ];
  const U7_KEY = [
    [{ y: 1 }, '\'y\': 1\n'], [{ n: 1 }, '\'n\': 1\n'], [{ '0755': 5 }, '\'0755\': 5\n'],
    [{ null: 7 }, '\'null\': 7\n'], [{ '~': 8 }, '\'~\': 8\n'], [{ true: 9 }, '\'true\': 9\n'],
    [{ '1e5': 10 }, '\'1e5\': 10\n'], [{ '2024-01-01': 11 }, '\'2024-01-01\': 11\n'],
  ];
  for (const [v, want] of U7_VALUE) assert.equal(uWrite(jsonToYaml(v), JSON.stringify(v)), want);
  for (const [v, want] of U7_KEY) assert.equal(uWrite(jsonToYaml(v), JSON.stringify(v)), want);
  // 负零那一档：JSON 文本里根本没有 -0（`JSON.stringify(-0) === '0'`），面板走不到这里。
  // 钉它不是为用户体验，是为了"实现别自创第二种写法"——比如先把值过一遍 JSON 再 dump，
  // 那样 -0 会静默变成 0，而 U6 那张表里没有任何一格能抓到这一条。
  assert.equal(uWrite(jsonToYaml({ a: -0 }), '负零'), 'a: -0.0\n');
  // 2026-09-29 实测：YAML11 的 float 记号走的是 `Number('-0.0')`，回来的**还是 -0**——
  // 这一档在 YAML 与 XML 两族都保得住，只有 CSV 保不住（它连类型都没有，见 U17 那一格）。
  // 钉成"实测如此"而不是"YAML 大概不行"：换内置件版本时这一格会红，逼人来重审。
  assert.equal(Object.is(uRead(yamlToJson('a: -0.0\n')).a, -0), true,
    'dump 写 -0.0、读侧给回 -0：roundTrips({a:-0}).yaml 那个 ✓ 靠的就是这一格');
});

test('U8 写侧的归一与拒、读侧的 YAML 1.1 包袱：每一档都得点名', () => {
  // ── 写侧归一：两种"JSON 里没有、JS 里常见"的值各自变成一个字符串 ──
  // 先变成串再交给 dump，而不是让 dump 写 `!!binary` / 裸时间戳：本站交出去的 YAML 必须与
  // 交进来的 JSON 同形（别人拿别的 yaml→json 工具转一圈，还得是同一份数据）。
  assert.equal(uWrite(jsonToYaml({ a: new Date('2024-06-01T08:30:00+08:00') }), '日期'),
    'a: \'2024-06-01T00:30:00.000Z\'\n', 'Date 走 UTC 的 ISO 串，+08:00 那一档必须折进 00:30Z');
  assert.equal(uWrite(jsonToYaml([new Date('2024-01-01T00:00:00Z')]), '数组里的日期'),
    '- \'2024-01-01T00:00:00.000Z\'\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array([104, 105]) }), '两字节'), 'a: aGk=\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array([0, 1, 2]) }), '三字节'), 'a: AAEC\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array(0) }), '零字节'), 'a: \'\'\n',
    '空字节串编码成空字符串——写成 `a:` 会被读成 null，那是第二种值');

  // ── 写侧拒：JSON 里装不下的东西，逐个点名并给出 Pointer ──
  const U8_REJECT = [
    ['undefined 在根', undefined, ''],
    ['函数在根', () => {}, ''],
    ['Symbol 在根', Symbol('s'), ''],
    ['BigInt 在根', 10n, ''],
    ['NaN 在根', NaN, ''],
    ['+Infinity 在根', Infinity, ''],
    ['-Infinity 在根', -Infinity, ''],
    ['Map 在根', new Map([['k', 1]]), ''],
    ['undefined 在键位', { a: undefined }, '/a'],
    ['函数在数组里', { a: [() => {}] }, '/a/0'],
    ['NaN 在键位', { a: NaN }, '/a'],
    ['BigInt 在数组里', [10n], '/0'],
    ['-Infinity 在第二个元素', [null, -Infinity], '/1'],
    ['Infinity 在三层里', { a: { b: { c: Infinity } } }, '/a/b/c'],
    ['Map 在键位', { a: new Map() }, '/a'],
    ['Set 在键位', { a: new Set() }, '/a'],
    ['非 Uint8Array 的 typed array', { a: new Int16Array([1]) }, '/a'],
    ['带原型的类实例', { a: new (class Thing { constructor() { this.k = 1; } })() }, '/a'],
    // 这一族站得住的理由与上面不同：面板喂给这三个写函数的值一律来自 parseJson，那里头没有 getter
    // 与 Proxy——但 json-convert.js 是**模块的公开面**，别人拿它接别的数据源（DOM 属性、类实例的
    // 快照）就会撞上"读这一格时它自己抛了"。约束是"绝不抛给调用方"，所以这一族也必须在闸门里落地。
    ['抛异常的 getter', { get a() { throw new Error('boom'); } }, '/a'],
    ['读 trap 抛的 Proxy', new Proxy({ a: 1 }, {
      get() { throw new Error('nope'); },
      ownKeys() { return ['a']; },
      getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
    }), '/a'],
  ];
  for (const [label, v, path] of U8_REJECT) {
    const e = uWriteErr(jsonToYaml(v), label);
    assert.equal(e.kind, 'non-json', `${label} 的 kind 应当是 non-json，实读 ${e.kind}`);
    assert.equal(e.path, path, `${label} 的 Pointer 应当是 ${JSON.stringify(path)}，实读 ${JSON.stringify(e.path)}`);
    assert.match(e.message, /JSON/, `${label} 的消息要点名"JSON 里装不下"这件事`);
  }
  // 同一个理由，三个写函数一个都不许漏：面板上 YAML/XML/CSV 三格并排站着，任何一格把异常抛到
  // 调用方外面，就是把整块面板打成一次未捕获异常（"绝不抛"这条约束见本节开头）。
  // 上面那一族只用 jsonToYaml 走过一遍——它对这三格是同一道闸门（scanJson），所以这里补另两个。
  for (const [label, v] of U8_REJECT.slice(-2)) {
    for (const [name, fn] of [['jsonToXml', jsonToXml], ['jsonToCsv', jsonToCsv]]) {
      let r;
      try { r = fn(v); } catch (err) { throw new Error(`${name} 对 ${label} 抛了：${err.message}`); }
      assert.equal(r.ok, false, `${name} 对 ${label} 必须交回 error，实读 ${JSON.stringify(r)}`);
      assert.equal(r.error.kind, 'non-json', `${name} 对 ${label} 的 kind 实读 ${r.error.kind}`);
      assert.equal(r.error.path, '/a', `${name} 对 ${label} 的 Pointer 实读 ${r.error.path}`);
    }
  }
  // dump 遇到 undefined 键是**静默丢键**（实测 `dump({v:undefined})` → `'{}\n'`），函数/BigInt/Symbol 才抛。
  // 上面那一族全在 dump 之前拦住，这一格留着只为说清"不拦会是什么样"：键无声消失，用户看不出来。
  assert.equal(uWrite(jsonToYaml({ a: 1 }), '对照'), 'a: 1\n');

  // ── 写侧拒：环。判据只用"祖先栈"，不用全局 seen ──
  // 同一个对象被两个键引用（DAG）在 JSON 里就是两份拷贝，`JSON.stringify` 也照样写两份，
  // 那是**正确行为**不是坑；只有回到祖先自己的环才必须拒。用 seen 判环会把前者一起拒掉。
  const cyc = { a: 1 }; cyc.self = cyc;
  const e1 = uWriteErr(jsonToYaml(cyc), '对象环');
  assert.equal(e1.kind, 'cycle'); assert.equal(e1.path, '/self');
  const arr = [1]; arr.push(arr);
  const e2 = uWriteErr(jsonToYaml(arr), '数组环');
  assert.equal(e2.kind, 'cycle'); assert.equal(e2.path, '/1');
  const shared = { k: 1 };
  // 实测的键位引号（`'y':`）不是多余的：本站读侧用的是 YAML11，那里 `y` 是布尔——写出去不带引号，
  // 读回来就成了 `{true: {k:1}}`。dump 自己会挡这一族（U7 键位那一表钉的就是它），这里顺手把 DAG 钉全。
  assert.equal(uWrite(jsonToYaml({ x: shared, y: shared }), '共享但不成环'), 'x:\n  k: 1\n\'y\':\n  k: 1\n',
    'DAG 写两份：与 JSON.stringify 同形，不许把它当环拒');

  // ── 写侧拒：深度。U6 那格放行 98 层，这一格拒 99 层，两个数必须一起出现在消息里 ──
  const deep = uWriteErr(jsonToYaml(uDeep(YAML_DEPTH_LIMIT + 1)), '深一层');
  assert.equal(deep.kind, 'depth');
  assert.equal(deep.path.split('/').length - 1, YAML_DEPTH_LIMIT,
    `越界那一格的 Pointer 应当正好 ${YAML_DEPTH_LIMIT} 段（它就是被拒的那个节点），实读 ${deep.path}`);
  assert.match(deep.message, new RegExp(String(YAML_DEPTH_LIMIT + 1)), '消息要点名当前深度');
  assert.match(deep.message, new RegExp(String(YAML_DEPTH_LIMIT)), '消息要点名上限');
  assert.equal(jsonToYaml({ a: uDeep(YAML_DEPTH_LIMIT - 1) }).ok, true,
    '根对象 + 97 层数组 = 98 层容器，放行');
  assert.equal(jsonToYaml({ a: uDeep(YAML_DEPTH_LIMIT) }).error.kind, 'depth',
    '层数只数容器，不数它外面那个根：99 层就得拒');

  // ── 读侧：YAML 1.1 的历史包袱会真的生效，逐条钉成"实际就是这样"，而不是"我们承诺不是这样" ──
  const U8_COERCE = [
    ['布尔词 yes', 'a: yes\n', { a: true }],
    ['布尔词 no', 'a: no\n', { a: false }],
    ['布尔词 on', 'a: on\n', { a: true }],
    ['布尔词 off', 'a: off\n', { a: false }],
    ['布尔词 y', 'a: y\n', { a: true }],
    ['布尔词 n', 'a: n\n', { a: false }],
    ['布尔词 True', 'a: True\n', { a: true }],
    ['八进制 0755', 'a: 0755\n', { a: 493 }],
    ['十六进制 0x10', 'a: 0x10\n', { a: 16 }],
    ['二进制 0b101', 'a: 0b101\n', { a: 5 }],
    ['下划线 1_000', 'a: 1_000\n', { a: 1000 }],
    ['六十进制 12:30', 'a: 12:30\n', { a: 750 }],
    ['日期当值', 'a: 2024-01-01\n', { a: '2024-01-01T00:00:00.000Z' }],
    ['日期时间不带时区', 'a: 2024-01-01 10:00:00\n', { a: '2024-01-01T10:00:00.000Z' }],
    ['日期在数组里', '- 2024-01-01\n', ['2024-01-01T00:00:00.000Z']],
    ['正无穷掉成 null', 'a: .inf\n', { a: null }],
    ['非数掉成 null', 'a: .nan\n', { a: null }],
    ['键位上的 y', 'y: 1\n', { true: 1 }],
    ['键位上的 n', 'n: 1\n', { false: 1 }],
    ['!!binary 转 base64 串', 'a: !!binary aGk=\n', { a: 'aGk=' }],
    ['!!binary 在数组里', '- !!binary AAEC\n', ['AAEC']],
    ['!!str 强制字符串', 'a: !!str 1\n', { a: '1' }],
    ['没给值的键', 'a:\n', { a: null }],
    ['根是数字', '42\n', 42],
    ['根是裸串', 'hello\n', 'hello'],
    ['根是 null', 'null\n', null],
    ['流嵌套', '[1, [2]]\n', [1, [2]]],
    ['只有文档起始符', '---\n', null],
    ['起始加结束', '---\n...\n', null],
    // 2026-09-29 实测：内置件把"文档结束符之后再来一个 `...`"当同一份文档（它只对 `---` 计份数），
    // 本站的预扫一度把它判成两份——那是**误拒合法输入**，比漏拒更伤用户。U9 里补的是反方向那一格。
    ['连续两个点线还是一份', 'a: 1\n...\n...\n', { a: 1 }],
    ['注释加文档', '# c\n---\na: 1\n', { a: 1 }],
    ['尾部空行', 'a: 1\n\n', { a: 1 }],
  ];
  for (const [label, text, want] of U8_COERCE) {
    assert.deepStrictEqual(uRead(yamlToJson(text), label), want, label);
  }
  // `.inf` 那一档要说清是谁在动手：实测内置件的 YAML11 读侧自己就把 `.inf` / `.nan` 落成交集外的
  // 空值（本站再兜一层：非有限的数一律折成 null），最终交出去的是 `null` 而不是 `Infinity`——
  // 与 `JSON.stringify({a:Infinity}) === '{"a":null}'` 同一条口径。不折的话，交出去的就不是合法 JSON，
  // 而"给 JSON 工作台喂一个 JSON 里没有的值"这一族坑，面板上一个高亮都抓不到。
  assert.equal(JSON.stringify(uRead(yamlToJson('a: .inf\n'), '.inf')), '{"a":null}', '折成 null 而不是留着 Infinity');
  // `---` 算一份文档、`...` 与注释不算——上一格里两档各给了一次，这里只留一句为什么：
  // 空文档是 YAML 的合法成员（值是 null），"没有文档"才是没有输入。

  // ── 读侧不许污染原型：这一条盯的是**依赖**，不是自己的代码 ──
  // 换掉内置件、或它哪天改了构造对象的方式，这一格就会红，逼人来重新审一遍。
  const polluted = uRead(yamlToJson('a: { __proto__: { polluted: 1 } }\n'), '__proto__');
  assert.equal({}.polluted, undefined, 'Object.prototype 被污染了——后面每一个对象都带上了 polluted');
  assert.equal(Object.prototype.hasOwnProperty.call(polluted.a, '__proto__'), true,
    '__proto__ 必须是 own 属性，与 json-core 的 setOwn 同一条口径');
  assert.equal(polluted.a.polluted, undefined, '它读的是自己那个 __proto__ 值，不是原型');
  assert.deepStrictEqual(Object.keys(polluted.a), ['__proto__']);
});

test('U9 读侧 error 的形状与位置：六格齐活、行列自洽、闸门那一档交回原话', () => {
  const flow99 = '['.repeat(YAML_DEPTH_LIMIT + 1) + '1' + ']'.repeat(YAML_DEPTH_LIMIT + 1) + '\n';
  // [档位, 样本, kind, index, line, column, snippet, 这一格的位置为什么是它]
  const U9_ROWS = [
    ['空文本', '', 'empty', 0, 1, 1, '', '没有内容可指，EOF 就是 0 那一格'],
    ['只有空白', '   \n ', 'empty', 5, 2, 2, ' ', '换行只有那一个 \\n，所以第 2 行、行内第 2 列'],
    ['只有制表', '\t\n', 'empty', 2, 2, 1, '', 'EOF 落在第 2 行的开头，那一行是空的'],
    ['只有点线', '...\n', 'empty', 4, 2, 1, '', '`...` 是文档结束符，不构成文档，所以仍算"没有输入"'],
    ['只有注释', '# only comment\n', 'empty', 15, 2, 1, '', '注释不是内容：与 `...` 同一档，指 EOF'],
    ['超字节上限', 'y: ' + 'x'.repeat(U_JSON_BYTES), 'too-long', U_JSON_BYTES + 3, 1, U_JSON_BYTES + 4, '',
      '闸门那一档不给 snippet（一行就是 5 MiB），index = text.length'],
    ['超行数上限', 'a\n'.repeat(U_LINES + 1), 'too-many-lines', 2 * (U_LINES + 1), U_LINES + 2, 1, '',
      '行口径只认 \\n：末格是那个换行之后、空掉的第 200002 行'],
    // 内置件自己给的 position 是 4（它的消息写 (1:5)，那里 column 从 0 起）——行列一律由 index 经 locate 推，
    // 不读 mark.line/mark.column，否则两套尺会在 CRLF 与 emoji 上分家。
    ['映射里套映射', 'a: b: c\n', 'parse', 4, 1, 5, 'a: b: c', '指认第二个冒号（下标 4）'],
    ['流序列没闭合', 'a: [1,\n', 'parse', 7, 2, 1, '', 'EOF 在下标 7：逗号之后该来下一个元素'],
    ['流映射没闭合', '{a: 1\n', 'parse', 6, 2, 1, '', '流集合一直读到 EOF'],
    ['双引号串没闭合', '"unterminated\n', 'parse', 14, 2, 1, '', '同上，EOF 那一格'],
    ['缩进多一格', 'a: 1\n b: 2\n', 'parse', 7, 2, 3, ' b: 2', '第二行的 b 落在下标 7，列 = 7 - 5 + 1'],
    ['重复键', 'a: 1\na: 2\n', 'parse', 5, 2, 1, 'a: 2', '内置件自己判重复键，指认后写那一行的开头'],
    ['未知标签', 'a: !!python/object:x {}\n', 'unknown-tag', 3, 1, 4, 'a: !!python/object:x {}',
      '指认标签起始的 `!`（下标 3），不是它后面的名字'],
    ['binary 内容坏了', 'a: !!binary "@@@"\n', 'parse', 3, 1, 4, 'a: !!binary "@@@"',
      '标签认得、内容解不开：这一档归 parse，不新开一档'],
    ['指令没收尾', '%TAG ! x\na: 1\n', 'parse', 9, 2, 1, 'a: 1', '它要的是 directives 结束标记，实读到第 2 行开头'],
    ['合并键没有来源', '<<: 1\n', 'parse', 0, 1, 1, '<<: 1', '合并源必须是个映射'],
    ['两行文档', 'a: 1\n---\nb: 2\n', 'multi-document', 5, 2, 1, '---', '上面已经有内容，这一行就是第二份的开头'],
    ['首行就是分隔符', '---\na: 1\n---\nb: 2\n', 'multi-document', 9, 3, 1, '---',
      '第一个 `---` 只是"显式起始"，它上面没有内容，所以不算第二份'],
    ['点线分文档', 'a: 1\n...\nb: 2\n', 'multi-document', 5, 2, 1, '...', '`...` 之后还有内容，同样算第二份'],
    // 空文档也算文档：`---` 开了它，`...` 关掉它，后面那个 `---` 就是第二份。上一格钉的是"点线后面跟内容"，
    // 这一格钉"点线后面跟起始符"——两处都指认**把文本切成两份的第一个边界**，尺子只有一把。
    ['空文档关掉后又起一份', '---\n...\n---\n...\n', 'multi-document', 4, 2, 1, '...',
      '`...`（下标 4）关掉第一份，第二个 `---` 开第二份：指认前者，与上一格同一条口径'],
    ['尾部点线', 'a: 1\n---\nb: 2\n...\n', 'multi-document', 5, 2, 1, '---', '报的是**第一个**越界处，不是最后一个'],
    ['注释后起文档', '# c\n---\na: 1\n---\nb: 2\n', 'multi-document', 13, 4, 1, '---', '注释行不算内容：下标 13 那个才是第二份'],
    ['流式两文档', '[1]\n---\n[2]\n', 'multi-document', 4, 2, 1, '---', '列 1：分隔符行永远顶格'],
    ['嵌套过深', flow99, 'depth', 99, 1, 100, flow99.slice(0, -1),
      '内置件在第 99 层就停，指认它当时站的那一格（下标 99 是第 100 个 `[`）'],
  ];
  for (const [label, text, kind, index, line, column, snippet, why] of U9_ROWS) {
    const e = uReadErr(yamlToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：error 的六格必须齐活`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}（${why}）`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}——${why}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}——${why}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}——${why}`);
    assert.equal(e.snippet, snippet, `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    // 自洽：行列必须由 index 推出来，两套数字不许各说各话
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：locate(text, index) 与 error 的行列不一致`);
    assert.equal(e.index >= 0 && e.index <= text.length, true, `${label}：index 越界`);
  }
  // 消息口径：有位置的那几档自己带"第 N 行第 M 列"，闸门那一档交回 core 的原话（同一句只有一处口径）
  for (const label of ['未知标签', '两行文档', '嵌套过深']) {
    const row = U9_ROWS.find((r) => r[0] === label);
    const e = uReadErr(yamlToJson(row[1]), label);
    assert.equal(e.message.includes(`第 ${row[4]} 行第 ${row[5]} 列`), true, `${label}：消息要带行列`);
  }
  for (const label of ['超字节上限', '超行数上限']) {
    const row = U9_ROWS.find((r) => r[0] === label);
    assert.equal(uReadErr(yamlToJson(row[1]), label).message, uGate(row[1]).message,
      `${label}：闸门那一档的消息必须是 json-core 的原话，站内不许有第二句"超出上限"`);
  }
  // 类型闸门：非字符串入参当场 TypeError，与 parseJson 同形（坏输入是返回值，入参错是编程错）
  assert.throws(() => yamlToJson(null), TypeError);
  assert.throws(() => yamlToJson(42), TypeError);
  assert.throws(() => xmlToJson([]), TypeError);
  assert.throws(() => csvToJson(undefined), TypeError);
});

test('U10 XML 写侧的逐字形状：类型靠 t 属性、数组元素一律 item、三档缩进、结尾一个换行', () => {
  const X = (...lines) => lines.join('\n') + '\n';
  const v = { a: 1, b: 'x', c: [1, true, null], d: { e: {} }, f: [] };
  assert.equal(uWrite(jsonToXml(v)), X(
    '<json t="obj">',
    '  <a t="num">1</a>',
    '  <b t="str">x</b>',
    '  <c t="arr">',
    '    <item t="num">1</item>',
    '    <item t="bool">true</item>',
    '    <item t="null"></item>',
    '  </c>',
    '  <d t="obj">',
    '    <e t="obj"></e>',
    '  </d>',
    '  <f t="arr"></f>',
    '</json>',
  ), '行序、缩进、属性写法一格都不许改：这是要给人贴进别人文件里的东西');
  assert.equal(uWrite(jsonToXml([[1]], { indent: 'four' })), X(
    '<json t="arr">', '    <item t="arr">', '        <item t="num">1</item>', '    </item>', '</json>'),
    'four 档就是每一层四个空格：拿 two 档做字符串替换是写不出这一条的');
  assert.equal(uWrite(jsonToXml([[1]], { indent: 'tab' })), X(
    '<json t="arr">', '\t<item t="arr">', '\t\t<item t="num">1</item>', '\t</item>', '</json>'));
  assert.equal(uWrite(jsonToXml({ a: 1 }, { root: 'payload' })),
    X('<payload t="obj">', '  <a t="num">1</a>', '</payload>'));
  // 根可以不是对象：JSON 的根本来就是任意值
  assert.equal(uWrite(jsonToXml('hi')), X('<json t="str">hi</json>'));
  assert.equal(uWrite(jsonToXml(42)), X('<json t="num">42</json>'));
  assert.equal(uWrite(jsonToXml(true)), X('<json t="bool">true</json>'));
  assert.equal(uWrite(jsonToXml(null)), X('<json t="null"></json>'));
  assert.equal(uWrite(jsonToXml([1, 2])),
    X('<json t="arr">', '  <item t="num">1</item>', '  <item t="num">2</item>', '</json>'));
  assert.equal(uWrite(jsonToXml([])), X('<json t="arr"></json>'),
    '空容器写成对标签而不是自闭合：两种都读得懂，选**读侧只有一种解释**的那一个');
  // 转义只有四格：`&` `<` `>` `\r`。`\n` 与 `\t` 原样留着（它们在线文本里就是自己），
  // `"` 与 `'` 在文本节点里不需要转义（本站不把用户数据写进属性值）。
  assert.equal(uWrite(jsonToXml({ s: 'a<b>&c"d\'e' })),
    X('<json t="obj">', '  <s t="str">a&lt;b&gt;&amp;c"d\'e</s>', '</json>'));
  assert.equal(uWrite(jsonToXml({ s: 'p\rq' })), X('<json t="obj">', '  <s t="str">p&#13;q</s>', '</json>'),
    '回车必须数字化：不转义的话读侧会按平台规矩把它当行尾吃掉，那是静默改数据');
  assert.equal(uWrite(jsonToXml({ s: 'l1\nl2' })), X('<json t="obj">', '  <s t="str">l1', 'l2</s>', '</json>'),
    '换行原样写出：包一层 CDATA 也能过，但"本站写的东西"就有了两种形状');
  assert.equal(uWrite(jsonToXml({ s: ']]>' })), X('<json t="obj">', '  <s t="str">]]&gt;</s>', '</json>'));
  assert.equal(uWrite(jsonToXml({ n: [0, -0.5, 1e21, 1e-7, 3.5] })), X(
    '<json t="obj">', '  <n t="arr">', '    <item t="num">0</item>', '    <item t="num">-0.5</item>',
    '    <item t="num">1e+21</item>', '    <item t="num">1e-7</item>', '    <item t="num">3.5</item>',
    '  </n>', '</json>'), '数字用 String(n)：那本来就是 JSON 的记号，读侧按同一把尺验它');
  assert.equal(uWrite(jsonToXml({ a: -0 })), X('<json t="obj">', '  <a t="num">-0</a>', '</json>'),
    '负零是这一族唯一要偏离 String(n) 的地方：`String(-0)` 给 "0"，那一格就把 -0 弄丢了——'
    + 'U13 的往返表里有 {a:-0}，而 JSON 文本里根本没有 -0，只有本站自己写的 XML 保得住它');
  assert.equal(uWrite(jsonToXml({ 中文键: '值' })),
    X('<json t="obj">', '  <中文键 t="str">值</中文键>', '</json>'));
  assert.equal(uWrite(jsonToXml({ 'x-m': 1, 'a.b': 2, _u: 3 })), X(
    '<json t="obj">', '  <x-m t="num">1</x-m>', '  <a.b t="num">2</a.b>', '  <_u t="num">3</_u>', '</json>'));
  // 参数口径：indent 不在 INDENT_MODES 里就当场 RangeError（静默回退默认档，是把"参数写错"藏成"输出莫名其妙"）
  assert.throws(() => jsonToXml(v, { indent: '2' }), /INDENT_MODES/);
  assert.throws(() => jsonToXml(v, { indent: 2 }), /INDENT_MODES/);
});

test('U11 XML 写侧的拒绝：非法键名一次列全，非法根名单列', () => {
  // 名字的规矩只有一条：`[字母 或 _]` 起始，后面跟 `[字母 数字 . _ -]`；外加 `xml` 前缀（不分大小写）
  // 与带冒号那一档（命名空间）拒。中文与希腊字母都算 `\p{L}`，所以合法——上一格刚钉过中文键。
  const U11_LEGAL = ['end-', 'a.b', '_u', 'x-m', 'n1', '中文键', 'Ωmega', 'A_b.C-d', '__proto__'];
  assert.equal(jsonToXml(Object.fromEntries(U11_LEGAL.map((k, i) => [k, i]))).ok, true,
    '这一族名字一个都不许拒：多禁一格就是把用户的键弄丢');
  const U11_BAD = ['1a', 'a b', '#x', 'a/b', '', '<x', 'a"', 'xml', 'XMLName', 'Xml:id', 'a:b', 'a\nb', '-lead', '.dot', 'a\tb', 'a\rb'];
  const e = uWriteErr(jsonToXml(Object.fromEntries(U11_BAD.map((k, i) => [k, i]))), '一堆非法键');
  assert.equal(e.kind, 'invalid-key');
  assert.deepEqual(e.keys, U11_BAD, '非法键要**一次列全**（按出场顺序），不许只报第一个就让人改三轮');
  assert.deepEqual(Object.keys(e).sort(), ['keys', 'kind', 'message', 'path'],
    '写侧 error 就这四格：指针不是文档，没有行列可言（读侧那六格见 U9）');
  assert.equal(e.path, '/1a', 'Pointer 给第一个越界者，面板拿它做"跳到那一行"');
  assert.match(e.message, /键名/);
  assert.deepEqual(uWriteErr(jsonToXml({ a: 1, 'b c': 2, x: 3 }), '混着合法键').keys, ['b c']);
  for (const root of ['a b', '1x', '', 'xml', 'a:b']) {
    const bad = uWriteErr(jsonToXml({ a: 1 }, { root }), `非法根名 ${JSON.stringify(root)}`);
    assert.equal(bad.kind, 'invalid-root');
    assert.equal(bad.path, '', '根没有父路径可指：Pointer 就是空串');
    assert.match(bad.message, /根/);
  }
  // 字符闸门：XML 1.0 连数字引用都容不下的那几位（C0 里除 `\t` `\n` 之外的一切），加上落单代理项。
  // "静默删掉"是最省事也最坏的写法：用户看不出少了什么。码点一律用 chr() 造，字面量里不写转义。
  const chr = (c) => String.fromCharCode(c);
  const U11_CHARS = [
    ['C0 控制符', { a: 'x' + chr(1) + 'y' }, '/a', 'U+0001'],
    ['垂直制表', { a: chr(11) }, '/a', 'U+000B'],
    ['换页符', { a: chr(12) }, '/a', 'U+000C'],
    ['单元控制符', { a: 'q' + chr(31) }, '/a', 'U+001F'],
    ['落单代理项（前件）', { a: chr(0xD800) }, '/a', 'U+D800'],
    ['落单代理项（后件）', { a: 'x' + chr(0xDC00) + 'y' }, '/a', 'U+DC00'],
    ['数组里的深一层', { a: [{ b: chr(2) }] }, '/a/0/b', 'U+0002'],
  ];
  for (const [label, v, path, code] of U11_CHARS) {
    const err = uWriteErr(jsonToXml(v), label);
    assert.equal(err.kind, 'bad-char', `${label} 的 kind 应当是 bad-char，实读 ${err.kind}`);
    assert.equal(err.path, path, `${label} 的 Pointer 实读 ${err.path}`);
    assert.ok(err.message.includes(code), `${label} 的消息要点名码点 ${code}，实读 ${err.message}`);
  }
  assert.ok(jsonToXml({ a: 'x\r\ty\nz' }).text.includes('&#13;'),
    '回车走数字引用、制表与换行走原样：这一档不归字符闸门管（各自的写法见 U10）');
  assert.equal(jsonToXml({ a: chr(0x7F) + chr(0x80) + chr(0x2028) }).ok, true,
    'DEL、U+0080 与行分隔符都在 XML 1.0 的合法字符集里，闸门不许顺手多禁');
  assert.equal(uWrite(jsonToXml({ s: '🎉' })), '<json t="obj">\n  <s t="str">🎉</s>\n</json>\n',
    '成对的代理项是一个字符，不是落单：原样写出，不许转成 \\ud83c\\udf89 那种字面量');

  // 深度只许一把尺，而且**写出去的必须读得回来**。读侧那道闸门数的是**元素层数**（根算第 1 层，
  // U12 最后那一族逐个钉的就是它），而本站的 XML 编码里"一个值恰好一个元素"——最深那一格是标量时
  // 元素层数 = 容器层数 + 1。写侧原先只数容器，于是放行了自己读不回来的东西：2026-09-29 实测
  // `jsonToXml(uDeep(1000))` 交回 ok，而 `xmlToJson` 对同一份文本判 depth（"第 1001 层"），
  // 面板上就是一格亮着 ✓ 却转不回来。改口只改写侧的尺，读侧那一把一字不动（它是 U12 的既成事实）。
  assert.equal(jsonToXml(uDeep(U_MAX_DEPTH - 1)).ok, true,
    '999 层容器 + 最深那一格标量 = 1000 层元素，正好在闸门口，必须放行');
  const xd = uWriteErr(jsonToXml(uDeep(U_MAX_DEPTH)), 'XML 深一层');
  assert.equal(xd.kind, 'depth', `实读 ${xd.kind}：${xd.message}`);
  assert.equal(xd.path.split('/').length - 1, U_MAX_DEPTH,
    `越界那一格的 Pointer 应当正好 ${U_MAX_DEPTH} 段（它就是被拒的那个标量叶），实读 ${xd.path}`);
  assert.match(xd.message, new RegExp(String(U_MAX_DEPTH + 1)), '消息要点名当前层数');
  assert.match(xd.message, new RegExp(String(U_MAX_DEPTH)), '消息要点名上限');
  for (const n of [U_MAX_DEPTH - 1, U_MAX_DEPTH]) {
    const w = jsonToXml(uDeep(n));
    assert.equal(w.ok ? xmlToJson(w.text).ok : false, w.ok,
      `${n} 层容器：写侧与读侧在这一格必须同结论（写出即可读回）`);
  }
  assert.equal(roundTrips(uDeep(U_MAX_DEPTH)).xml, false,
    '转不回来的那一档，面板上那个 ✓ 必须是 ✗：roundTrips 与写侧闸门不许各说各话');
});

test('U12 XML 读侧的子集边界：坏样本逐个钉 kind 与那一处位置', () => {
  // 读侧只认写器发得出来的那一族（`XML_CONVENTION` 那句人话就是这张表的目录），越界整体拒绝并指认位置。
  // index 一律指向**越界的那一个字符**，不指向它后面也不指向它的父标签；行口径借 §S 那把尺（只认 `\n`）。
  // 六格 = 位置五件套 + message：§S 那一本多一个 `length`，是因为它自己扫记号能给；这里给不出，宁缺不假。
  const U12_ROWS = [
    ['空输入', '', 'empty', 0, 1, 1],
    ['只有空白', '  \n ', 'empty', 4, 2, 2],
    ['只有注释', '<!-- only -->\n', 'empty', 14, 2, 1],
    ['只有声明', '<?xml version="1.0"?>', 'empty', 21, 1, 22],
    // BOM 三族同一条口径（CSV 见 U15、U16，YAML 走内置件）：剥掉它再解析，但**位置一律指原文**——
    // 面板高亮吃的是用户粘进去的那份文本，BOM 占第 1 行第 1 列这一格。
    ['只有 BOM', U_BOM, 'empty', 1, 1, 2],
    ['开始标签没闭合', '<a t="num">1', 'unterminated', 12, 1, 13],
    ['闭合名不匹配', '<a t="str">x</b>\n', 'bad-name', 12, 1, 13],
    ['闭合标签带属性', '<a t="str">x</a k>', 'bad-attr', 15, 1, 16],
    // 三格都指"根元素之后的第一个越界字符"：`<a t="str">` 占 0–10、`x` 在 11、`</a>` 占 12–15，所以越界者在 16
    ['根之后有裸文本', '<a t="str">x</a>y', 'trailing', 16, 1, 17],
    ['根之后有第二个根', '<a t="str">x</a><b t="num">1</b>', 'trailing', 16, 1, 17],
    ['根之后有注释', '<a t="str">x</a><!-- tail -->', 'trailing', 16, 1, 17],
    // 同一档前面加一格 BOM：越界者在原文里是第 17 格、第 18 列（剥 BOM 只用于解析，位置指原文）
    ['BOM 之后的越界者', U_BOM + '<a t="str">x</a>y', 'trailing', 17, 1, 18],
    ['num 装非数字', '<a t="num">x</a>', 'bad-value', 11, 1, 12],
    ['num 带正号', '<a t="num">+1</a>', 'bad-value', 11, 1, 12],
    ['num 有前导零', '<a t="num">01</a>', 'bad-value', 11, 1, 12],
    ['num 装 Infinity', '<a t="num">Infinity</a>', 'bad-value', 11, 1, 12],
    // `t="bool"` 与 `t="null"` 比 `t="num"` 长一格，所以这两档的内容起始是 12 不是 11——
    // 指认的是内容里第一个非空白字符，不是标签。
    ['bool 装 TRUE', '<a t="bool">TRUE</a>', 'bad-value', 12, 1, 13],
    ['null 有内容', '<a t="null">z</a>', 'bad-value', 12, 1, 13],
    ['缺 t 属性', '<a>1</a>', 'bad-shape', 0, 1, 1],
    ['t 值不在册', '<a t="int">1</a>', 'bad-shape', 5, 1, 6],
    ['多一个属性', '<a t="str" k="v">x</a>', 'bad-attr', 11, 1, 12],
    ['属性没有等号', '<a t="str" x>', 'bad-attr', 11, 1, 12],
    ['t 写了两遍', '<a t="str" t="num">x</a>', 'bad-attr', 11, 1, 12],
    ['arr 的子元素名不是 item', '<a t="arr"><b t="num">1</b></a>', 'bad-shape', 11, 1, 12],
    ['arr 里有裸文本', '<a t="arr">txt<item t="num">1</item></a>', 'bad-shape', 11, 1, 12],
    ['str 里有子元素', '<a t="str"><b t="num">1</b></a>', 'bad-shape', 11, 1, 12],
    ['未注册的具名实体', '<a t="str">&weird;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用是 0', '<a t="str">&#0;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用是落单代理项', '<a t="str">&#xD800;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用超出码位上限', '<a t="str">&#x110000;</a>', 'bad-entity', 11, 1, 12],
    ['裸的 &', '<a t="str">a&b</a>', 'bad-entity', 12, 1, 13],
    ['实体少分号', '<a t="str">&amp</a>', 'bad-entity', 11, 1, 12],
    ['DOCTYPE 打头', '<!DOCTYPE json SYSTEM "x.dtd">\n<a t="num">1</a>', 'doctype', 0, 1, 1],
    ['声明后跟 DOCTYPE', '<?xml version="1.0"?>\n<!DOCTYPE a>\n<a t="num">1</a>', 'doctype', 22, 2, 1],
    // 名字越界一律指认**整个名字那一段的开头**（扫到空白 / `/` / `>` 为止的那一段），不指认段内第几个字符：
    // `a!`、`1a`、`XMLa`、`a:b` 四档的病灶都是"这一段不是合法名字"，把光标放到段首最容易看懂。
    ['注释没闭合', '<a t="str"><!-- unterminated</a>', 'unterminated', 11, 1, 12],
    ['CDATA 没闭合', '<a t="str"><![CDATA[x</a>', 'unterminated', 11, 1, 12],
    ['根之前有垃圾', 'junk<a t="num">1</a>', 'bad-document', 0, 1, 1],
    ['尖括号之后不是名字', '<a! t="num">1</a>', 'bad-name', 1, 1, 2],
    ['元素名数字打头', '<1a t="num">1</a>', 'bad-name', 1, 1, 2],
    ['元素名撞 xml 前缀', '<XMLa t="str">x</XMLa>', 'bad-name', 1, 1, 2],
    ['元素名带冒号', '<a:b t="str">x</a:b>', 'bad-name', 1, 1, 2],
    ['属性名带冒号', '<a t="str" x:y="1">x</a>', 'bad-name', 11, 1, 12],
    ['只有一个尖括号', '<', 'unterminated', 0, 1, 1],
    ['先出现闭合标签', '</a>', 'bad-document', 0, 1, 1],
    ['闭合标签半截', '<a t="str">x</a', 'unterminated', 12, 1, 13],
    ['t 的引号没合上', '<a t="str>x</a>', 'unterminated', 5, 1, 6],
    ['处理指令没闭合', '<?xml version="1.0"?>\n<?pi tail\n<a t="num">1</a>', 'unterminated', 22, 2, 1],
    ['声明写两遍', '<?xml version="1.0"?><?xml version="1.0"?>\n<a t="num">1</a>', 'bad-document', 21, 1, 22],
    ['声明半截', '<?xml version="1.0"', 'unterminated', 0, 1, 1],
  ];
  const seen = new Set();
  for (const [label, text, kind, index, line, column] of U12_ROWS) {
    seen.add(kind);
    const e = uReadErr(xmlToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：读侧 error 的六格必须齐活（与 U9 同一条口径）`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}，期望 ${kind}`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}`);
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：行列必须由 index 推出来，两套数字不许各说各话`);
    // snippet 就是"那一行"，切法借 §S 的 lineRange（所以 CRLF 不会多带一个 \r）
    const rng = uLineRange(text, e.line);
    assert.equal(e.snippet, text.slice(rng.start, rng.end), `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    assert.equal(e.message.includes(`第 ${line} 行第 ${column} 列`), true,
      `${label}：消息要带人话的行列，实读 ${e.message}`);
  }
  // 十档 kind 一档都不许缺：缺了就意味着实现里那条分支从来没被踩过
  for (const k of ['empty', 'unterminated', 'bad-name', 'bad-attr', 'bad-value', 'bad-shape',
    'bad-entity', 'doctype', 'trailing', 'bad-document']) {
    assert.ok(seen.has(k), `样本集没覆盖 ${k}：那一档的拒绝路径等于没测`);
  }

  // 深度：闸门只有一把（`MAX_DEPTH`，与 parseJson 同一档），且必须**边扫边判**——
  // 递归下降在这里会先炸调用栈，那样给出的就是"栈溢出"而不是行列号。
  const U12_DEEP = `<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH)}`;
  const deep = uReadErr(xmlToJson(U12_DEEP), '嵌套超过 MAX_DEPTH');
  assert.equal(deep.kind, 'depth', `实读 ${deep.kind}：${deep.message}`);
  assert.equal(deep.line, U_MAX_DEPTH + 1, '根算第 1 层，越界的是第 1001 行');
  assert.equal(deep.column, 1, '那一行顶格就是越界的 `<`');
  assert.equal(deep.index, 15 * U_MAX_DEPTH, 'index = 每行 15 格 × 1000 行');
  assert.equal(deep.snippet, '<item t="arr">', 'snippet 只给那一行，不许把 1 MB 输入整条塞进消息');
  assert.match(deep.message, new RegExp(String(U_MAX_DEPTH)));
  // 边界另一侧：刚好卡在闸门内的最深**闭合**样本必须读得回来（只测拒绝侧抓不到"多禁一层"）
  const closer = '</item>\n'.repeat(U_MAX_DEPTH - 1);
  const okInside = xmlToJson(`<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH - 1)}${closer}</json>\n`);
  assert.equal(okInside.ok, true, `1000 层必须放行：${JSON.stringify(okInside.error)}`);
  assert.equal(Array.isArray(okInside.value) && okInside.value.length === 1, true, '根是一元数组');
  let walk = okInside.value;
  for (let i = 0; i < U_MAX_DEPTH - 1; i++) walk = walk[0];
  assert.deepEqual(walk, [], '最里那一层是空数组：1000 层一格都没被吞');
  // 再深一层就拒，且位置随那一行走（不是固定指根，也不是 EOF）
  const oneMore = uReadErr(xmlToJson(`<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH)}${closer}</item>\n`),
    '1001 层');
  assert.equal(oneMore.kind, 'depth');
  assert.equal(oneMore.line, U_MAX_DEPTH + 1);
  assert.equal(oneMore.column, 1);
  assert.equal(deep.message.includes('第 1001 行第 1 列'), true, '深度那一档的行列也要进消息');
});

test('U13 XML 往返 26 例 + 读侧的接受面：本站写出去的必须原样回来，别人手写合法的也要认', () => {
  // 设计文档 §8.1 的"JSON→X→JSON 深比较"落到 XML 这一族就是这张表。
  // 表里**没有**空键名、`"引号"开头的键` 这类形状——它们归 U11 的非法键那一档，写侧就出不来东西。
  const U13_ROUND = [
    {}, [], 'hi', 42, true, null,
    { a: 1, b: 'x', c: true, d: null, e: [1, 2], f: { g: {} }, h: [] },
    [[1, 'a'], [null, true]],
    '&<>',
    ']]> 结束符',
    'CRLF\r\n换行',
    '🎉 代理对',
    '  前后空格与制表\t  ',
    { 'a.b': 1, 'x-y': 2, '_u': 3, '中文键': '值' },
    { a: -0 },
    { a: 1e21, b: 1e-7 },
    { a: 0.30000000000000004 },
    { a: 9007199254740991 },
    { a: 'x'.repeat(2000) },
    uWithProtoKey({ nested: 1 }),
    '</script>',
    { '单引号': "it's" },
    { 嵌套: [{ k: 'v' }, {}, []] },
    { a: { b: { c: { d: { e: '深一层' } } } } },
    { a: '\n\n连续空行\n' },
    [null, null],
  ];
  assert.ok(U13_ROUND.length >= 20, 'plan §Task 4 明写"写→读深相等覆盖 20 例"，这一族不许缩水');
  for (const v of U13_ROUND) {
    const label = `往返 ${JSON.stringify(v === undefined ? 'undef' : v).slice(0, 44)}`;
    const text = uWrite(jsonToXml(v), label);
    const back = xmlToJson(text);
    assert.equal(back.ok, true, `${label}：写出去的东西读不回来，实读 ${JSON.stringify(back.error)}`);
    assert.deepEqual(Object.keys(back).sort(), ['ok', 'value'],
      'XML 读侧成功只有这两格：meta 是 CSV 的事（U16），这里塞一份只会让面板多读一个空格子');
    assert.deepStrictEqual(back.value, v, `${label}：深相等没过`);
    assert.equal(roundTrips(v).xml, true, `${label}：面板那个 ✓ 读的就是这一格，必须与手工往返同结论`);
  }
  // 确定性：同一个值两次写出逐字节相同（否则"复制走的内容每次不一样"这种抱怨没法追）
  const once = uWrite(jsonToXml({ a: [1, { b: 'x' }], c: null }));
  assert.equal(uWrite(jsonToXml({ a: [1, { b: 'x' }], c: null })), once, '两次写出必须逐字节相同');
  // 原型那一格：读回来的对象原型还是 Object.prototype，污染只许停在 own 键上
  const polluted = uRead(xmlToJson(uWrite(jsonToXml(uWithProtoKey({ nested: 1 })))));
  assert.equal(Object.getPrototypeOf(polluted), Object.prototype, '读侧不许把 __proto__ 当构造器');
  assert.deepEqual(Object.keys(polluted), ['b', '__proto__'], 'own 键序与写侧一致');
  assert.equal({}.nested, undefined, 'Object.prototype 一个键都没多');

  // 接受面：写器自己不发这些形状，但手改过的合法 XML 要认——这一族是"子集"不是"自家产物"，
  // 只认自家写法等于把"编辑后再读"这条路堵死（面板上那句说明承诺的是子集）。
  const ACCEPT = [
    ['自闭合空数组', '<json t="arr"/>', []],
    ['自闭合空对象', '<json t="obj"/>', {}],
    ['自闭合 null', '<json t="null"/>', null],
    ['自闭合空串', '<json t="str"/>', ''],
    ['num 带包围空白', '<json t="num"> 42 </json>', 42],
    ['bool 带换行', '<json t="bool">\ntrue\n</json>', true],
    ['null 带空白', '<json t="null"> \n </json>', null],
    ['属性用单引号', "<json t='str'>x</json>", 'x'],
    ['属性四周留白', '<json   t = "str"  >x</json  >', 'x'],
    ['注释夹在元素间', '<json t="obj">\n<!-- c -->\n<a t="num">1</a>\n</json>\n', { a: 1 }],
    ['CDATA 里的尖括号不算标签', '<json t="str"><![CDATA[<a> & raw]]></json>', '<a> & raw'],
    ['五类预定义实体', '<json t="str">&amp;&lt;&gt;&quot;&apos;</json>', '&<>"\''],
    ['数字引用十进制与十六进制', '<json t="str">&#65;&#x42;</json>', 'AB'],
    ['同名兄弟归并成数组', '<json t="obj"><b t="num">1</b><b t="num">2</b></json>', { b: [1, 2] }],
    ['同名兄弟只有一个就还是标量', '<json t="obj"><b t="num">1</b></json>', { b: 1 }],
    ['三个同名兄弟', '<json t="obj"><b t="num">1</b><b t="num">2</b><b t="num">3</b></json>', { b: [1, 2, 3] }],
    ['CRLF 排版的文档', '<json t="obj">\r\n  <b t="str">x</b>\r\n</json>\r\n', { b: 'x' }],
    ['声明与处理指令跳过', '<?xml version="1.0" encoding="UTF-8"?>\n<?php x ?>\n<json t="num">1</json>', 1],
    ['根元素名不必叫 json', '<payload t="obj"><a t="num">1</a></payload>', { a: 1 }],
    ['str 里的换行是内容', '<json t="str">a\nb</json>', 'a\nb'],
    ['str 不 trim', '<json t="str">  空格  </json>', '  空格  '],
    ['arr 里的 item 是空容器', '<json t="arr"><item t="arr"/><item t="obj"/></json>', [[], {}]],
    ['obj 里可以有个键就叫 item', '<json t="obj"><item t="num">1</item></json>', { item: 1 }],
    ['BOM 开头的一份文档', U_BOM + '<json t="obj"><a t="str">x</a></json>', { a: 'x' }],
    ['BOM 之后还有声明', U_BOM + '<?xml version="1.0"?>\n<json t="num">1</json>', 1],
  ];
  for (const [label, text, want] of ACCEPT) {
    assert.deepStrictEqual(uRead(xmlToJson(text), label), want, `${label}：读侧的接受面实读不符`);
  }
  // root 选项写出去的东西，读侧不靠"json"这个名字认路
  assert.deepStrictEqual(uRead(xmlToJson(uWrite(jsonToXml({ a: 1 }, { root: 'payload' })))), { a: 1 },
    '根名换成 payload 也要读得回来');
});

test('U14 CSV 写侧：形状闸门、表头口径与逐字输出', () => {
  // CSV 没有类型、没有嵌套、也没有"这一格是 null 还是空串"的分别——所以写侧只有两档收：
  // **对象数组**与**单个对象**（当一行看）。其余一律拒，并说明要求（plan §Task 4 明写这一条）。
  // 嵌套容器不拒：压成一行 JSON 写进单元格，读回来是字符串——比"你的数据转不了"有用，
  // 且不撒谎（CSV_NOTES.fidelity 那句就是说这件事，见 U16）。
  const U14_OK = [
    ['一行对象数组', [{ a: 1, b: 'x' }], undefined, 'a,b\r\n1,x\r\n'],
    ['单个对象当一行', { a: 1, b: 'x' }, undefined, 'a,b\r\n1,x\r\n'],
    ['后行有新键就追加', [{ a: 1 }, { b: 2, c: 3 }], undefined, 'a,b,c\r\n1,,\r\n,2,3\r\n'],
    ['同键两行', [{ a: 1 }, { a: 2 }], undefined, 'a\r\n1\r\n2\r\n'],
    ['分号当分隔符', [{ a: 1 }], ';', 'a\r\n1\r\n'],
    ['制表符当分隔符', [{ a: 'x\ty' }], '\t', 'a\r\n"x\ty"\r\n'],
    ['键名里有空格', [{ 名字: 1, 'x y': 2 }], undefined, '名字,x y\r\n1,2\r\n'],
    ['键名里有逗号要引起来', [{ 'a,b': 1 }], undefined, '"a,b"\r\n1\r\n'],
    ['空键名给个占位名', [{ '': 1 }], undefined, 'col_1\r\n1\r\n'],
    ['null 是空格子', [{ a: null }], undefined, 'a\r\n\r\n'],
    ['空串也是空格子：与上一格逐字相同', [{ a: '' }], undefined, 'a\r\n\r\n'],
    ['布尔小写、数字走 String', [{ a: true, b: false, c: 1e21 }], undefined, 'a,b,c\r\ntrue,false,1e+21\r\n'],
    ['负零写成 0', [{ a: -0 }], undefined, 'a\r\n0\r\n'],
    ['对象压成一行 JSON 进单元格', [{ a: { b: 1 } }], undefined, 'a\r\n"{""b"":1}"\r\n'],
    ['数组同样压进单元格', [{ a: [1, 'x'] }], undefined, 'a\r\n"[1,""x""]"\r\n'],
    ['嵌套里的 null 不丢', [{ a: { b: null } }], undefined, 'a\r\n"{""b"":null}"\r\n'],
    ['含分隔符的值引起来', [{ a: 'x,y' }], undefined, 'a\r\n"x,y"\r\n'],
    ['含引号的值 doubling', [{ a: 'a"b' }], undefined, 'a\r\n"a""b"\r\n'],
    ['含换行的值引起来、换行原样', [{ a: 'l1\nl2' }], undefined, 'a\r\n"l1\nl2"\r\n'],
    ['含 CRLF 的值也原样', [{ a: 'l1\r\nl2' }], undefined, 'a\r\n"l1\r\nl2"\r\n'],
    ['制表与行首空格不需要引号', [{ a: '\ttab' }, { b: ' lead' }], undefined, 'a,b\r\n\ttab,\r\n, lead\r\n'],
    ['__proto__ 是普通键名', uWithProtoKey('v'), undefined, 'b,__proto__\r\n2,v\r\n'],
    ['日期先变 ISO 串（与 YAML 那一族同一条口径）', { at: new Date('2024-06-01T00:30:00Z') }, undefined,
      'at\r\n2024-06-01T00:30:00.000Z\r\n'],
    ['字节串先变 base64（同上）', { a: new Uint8Array([104, 105]) }, undefined, 'a\r\naGk=\r\n'],
  ];
  for (const [label, v, delimiter, want] of U14_OK) {
    const r = delimiter === undefined ? jsonToCsv(v) : jsonToCsv(v, { delimiter });
    assert.deepEqual(Object.keys(r).sort(), ['ok', 'text'], `${label}：写侧成功就这两格，实读 ${JSON.stringify(r)}`);
    assert.equal(r.text, want, `${label}：逐字实读 ${JSON.stringify(r.text)}`);
    assert.equal(r.text.endsWith('\r\n'), true, `${label}：每一行都以 CRLF 收尾，最后一行也一样`);
  }
  // 两次写出逐字节相同：表头顺序由出场顺序决定，不许有实现把键序交给哈希
  assert.equal(uWrite(jsonToCsv([{ b: 1, a: 2 }])), 'b,a\r\n1,2\r\n', '表头就是首行的键序');

  const U14_SHAPE = [
    ['空数组', [], 'empty'], ['零个键的一行', [{}], 'empty'], ['空对象', {}, 'empty'],
    ['数字', 42, 'shape'], ['字符串', 'x', 'shape'], ['null', null, 'shape'], ['纯标量数组', [1, 2], 'shape'],
    ['数组里混标量', [{ a: 1 }, 2], 'shape'], ['数组套数组', [[1]], 'shape'], ['布尔', true, 'shape'],
  ];
  for (const [label, v, kind] of U14_SHAPE) {
    const e = uWriteErr(jsonToCsv(v), label);
    assert.deepEqual(Object.keys(e).sort(), ['kind', 'message', 'path'], `${label}：写侧 error 就这三格`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}，期望 ${kind}`);
    assert.equal(e.path, '', `${label}：整份输入的毛病，Pointer 是空串`);
    assert.match(e.message, /对象数组|对象/, `${label}：要说清楚收什么形状，实读 ${e.message}`);
  }
  // `[]` 与 `[{}]` 是"没有列可写"，与"形状不对"分开两档：面板给的下一步不一样
  for (const v of [[], [{}], {}]) {
    assert.equal(uWriteErr(jsonToCsv(v)).kind, 'empty', `${JSON.stringify(v)} 应当落在 empty`);
  }
  for (const v of [42, 'x', null, [1, 2], true]) {
    assert.equal(uWriteErr(jsonToCsv(v)).kind, 'shape', `${JSON.stringify(v)} 应当落在 shape`);
  }

  const U14_BAD = [
    ['undefined 在格子里', [{ a: undefined }], '/0/a'],
    ['函数在格子里', { a: () => {} }, '/a'],
    ['NaN 在格子里', { a: NaN }, '/a'],
    ['+Infinity 在格子里', { a: Infinity }, '/a'],
    ['BigInt 在格子里', [{ a: 10n }], '/0/a'],
    ['Map 在格子里', { a: new Map() }, '/a'],
    ['Set 在格子里', { a: new Set() }, '/a'],
    ['非 Uint8Array 的 typed array', { a: new Int16Array([1]) }, '/a'],
    ['嵌套里的 undefined', { a: { b: undefined } }, '/a/b'],
    ['嵌套里的 NaN', [{ a: [NaN] }], '/0/a/0'],
  ];
  for (const [label, v, path] of U14_BAD) {
    const e = uWriteErr(jsonToCsv(v), label);
    assert.equal(e.kind, 'non-json', `${label}：kind 实读 ${e.kind}`);
    assert.equal(e.path, path, `${label}：Pointer 实读 ${JSON.stringify(e.path)}，期望 ${path}`);
    assert.match(e.message, /JSON/, `${label}：消息要点名"JSON 里装不下"`);
  }
  const cyc = { a: 1 }; cyc.self = cyc;
  const c = uWriteErr(jsonToCsv(cyc), '环');
  assert.equal(c.kind, 'cycle');
  assert.equal(c.path, '/self');
  const shared = { k: 1 };
  assert.equal(jsonToCsv({ x: shared, y: shared }).ok, true, 'DAG 不算环，与 YAML 那一族同一条判据（见 U8）');
  // 单元格里的嵌套深度借 §S 的 MAX_DEPTH 那一把尺，不另立第二个数
  const deepCell = uWriteErr(jsonToCsv({ a: uDeep(U_MAX_DEPTH) }), '单元格套 1000 层');
  assert.equal(deepCell.kind, 'depth', `实读 ${deepCell.kind}`);
  assert.match(deepCell.message, new RegExp(String(U_MAX_DEPTH)), '消息要点名上限');

  // 分隔符是"档位"不是"字符串"：与 §S 的 modeOf 同形，非法值当场编程错，不返回 error。
  // `undefined` 不在这一族里——面板的控件会把"没选"传成 undefined，那一格走默认逗号（下一格钉它）。
  for (const bad of ['', ',,', 'ab', '"', '\n', '\r', 42, null]) {
    assert.throws(() => jsonToCsv([{ a: 1 }], { delimiter: bad }), RangeError,
      `分隔符 ${JSON.stringify(bad)} 必须 RangeError`);
  }
  assert.equal(jsonToCsv([{ a: 1 }], { delimiter: undefined }).text, 'a\r\n1\r\n',
    '不传选项走逗号；显式传 undefined 也一样（面板的控件会把"没选"传成 undefined）');
  assert.throws(() => csvToJson('a', { delimiter: ',,' }), RangeError, '读侧的分隔符必须走同一条尺');
});

test('U15 读侧的 RFC 4180 五族：引号转义、内嵌换行、CRLF、BOM、尾行无换行', () => {
  const bomChar = String.fromCharCode(0xFEFF);
  // [档位, CSV 文本, 期望值]（meta 那一格归 U16，这一族只管"读回来的东西对不对"）
  const U15_ROWS = [
    ['基本一行', 'a,b\r\n1,2\r\n', [{ a: '1', b: '2' }]],
    ['引号里的分隔符算内容', 'a\r\n"x,y"\r\n', [{ a: 'x,y' }]],
    ['两连引号解成一个', 'a\r\n"a""b"\r\n', [{ a: 'a"b' }]],
    ['引号里的 LF 是内容', 'a\r\n"l1\nl2"\r\n', [{ a: 'l1\nl2' }]],
    ['引号里的 CRLF 也原样', 'a\r\n"l1\r\nl2"\r\n', [{ a: 'l1\r\nl2' }]],
    ['引号里的裸 CR 也原样', 'a\r\n"l1\rl2"\r\n', [{ a: 'l1\rl2' }]],
    ['尾行没有换行', 'a,b\r\n1,2', [{ a: '1', b: '2' }]],
    ['只有表头', 'a,b', []],
    ['LF 排版的文件', 'a,b\n1,2\n', [{ a: '1', b: '2' }]],
    ['CR 排版的文件（老 Mac）', 'a,b\r1,2\r', [{ a: '1', b: '2' }]],
    ['BOM 吃掉但值不变', bomChar + 'a,b\r\n1,2\r\n', [{ a: '1', b: '2' }]],
    ['短行补空串', 'a,b,c\r\n1\r\n', [{ a: '1', b: '', c: '' }]],
    ['中间的空行是一行', 'a\r\n1\r\n\r\n2\r\n', [{ a: '1' }, { a: '' }, { a: '2' }]],
    ['表头自己带引号', '"a""b",c\r\n1,2\r\n', [{ 'a"b': '1', c: '2' }]],
    ['表头空位给占位名', ',x\r\n1,2\r\n', [{ col_1: '1', x: '2' }]],
    ['重复表头追加序号', 'a,a,a\r\n1,2,3\r\n', [{ a: '1', a__2: '2', a__3: '3' }]],
    ['重复表头与空位混着来', 'a,,a\r\n1,2,3\r\n', [{ a: '1', col_2: '2', a__2: '3' }]],
    ['占位名撞上真名继续加序号', 'a,a__2,a\r\n1,2,3\r\n', [{ a: '1', a__2: '2', a__3: '3' }]],
    ['字段中间的裸引号容忍', 'a\r\nb"c\r\n', [{ a: 'b"c' }]],
    ['闭合引号后面还有字就拼上', 'a\r\n"x"y\r\n', [{ a: 'xy' }]],
    ['一对引号就是空串', 'a\r\n""\r\n', [{ a: '' }]],
    ['引号里就是一个换行', 'a\r\n"\n"\r\n', [{ a: '\n' }]],
    ['分号分隔', 'a;b\r\n1;2\r\n', [{ a: '1', b: '2' }], ';'],
    ['分号分隔里的逗号不算分隔符', 'a\r\n"x,y"\r\n', [{ a: 'x,y' }], ';'],
    ['行首空格是内容', 'a\r\n lead\r\n', [{ a: ' lead' }]],
    ['行尾空格是内容', 'a\r\ntrail \r\n', [{ a: 'trail ' }]],
    ['表头两侧空格也留着', ' a , b \r\n1,2\r\n', [{ ' a ': '1', ' b ': '2' }]],
    ['引号字段跨行之后仍对齐表头', 'a,b\r\n"x\ny",2\r\n', [{ a: 'x\ny', b: '2' }]],
    ['一行三格带空尾格', 'a,b,\r\n1,2,\r\n', [{ a: '1', b: '2', col_3: '' }]],
  ];
  for (const [label, text, want, delimiter] of U15_ROWS) {
    const r = delimiter === undefined ? csvToJson(text) : csvToJson(text, { delimiter });
    assert.deepStrictEqual(uRead(r, label), want, `${label}：值实读 ${JSON.stringify(r.value)}`);
  }

  // 写→读成对：本站自己写出去的三族（引号、内嵌换行、CRLF）读回来逐格等于原值
  const PAIRS = [
    [{ a: 'x,y' }, { a: 'b\nc' }],
    [{ a: 'say "hi"' }],
    [{ a: 'r1\r\nr2' }],
    [{ a: '列,与"引号"混排', b: '换\n行' }],
    [{ 名: '值', 空: '' }],
  ];
  for (const rows of PAIRS) {
    const label = `成对 ${JSON.stringify(rows).slice(0, 40)}`;
    assert.deepStrictEqual(uRead(csvToJson(uWrite(jsonToCsv(rows)), label), label), rows, label);
  }
  // 读→写的幂等：读一份合规 CSV 再写回去，逐字不变（面板"导入后重新导出"那条路）
  const IDEMPOTENT = ['a,b\r\n1,2\r\n', 'a\r\n"x,y"\r\n', 'a,b\r\n1,\r\n', '名字,x y\r\n1,2\r\n'];
  for (const text of IDEMPOTENT) {
    const back = uRead(csvToJson(text));
    assert.equal(uWrite(jsonToCsv(back)), text, `幂等实读 ${JSON.stringify(uWrite(jsonToCsv(back)))}`);
  }
  // 非法形状只有一档：分隔符（RangeError 见 U14），非字符串入参在 U9 钉过
});

test('U16 回读一律字符串、meta 六格与拒绝位置：形状与 U9 同一条口径', () => {
  const bomChar = String.fromCharCode(0xFEFF);
  const r = csvToJson('a,b\r\n1,2\r\n');
  assert.deepEqual(Object.keys(r).sort(), ['meta', 'ok', 'value'],
    'CSV 读侧成功是这三格：比 YAML/XML 多一个 meta，因为"几行几列、什么换行"是用户要看的');
  assert.deepEqual(Object.keys(r.meta).sort(), ['allStrings', 'bom', 'columns', 'delimiter', 'lineEnding', 'rows'],
    'meta 六格一个不多一个不少：面板直接读这几格，多一格就要改面板');
  assert.deepStrictEqual(r.meta, { rows: 1, columns: 2, delimiter: ',', allStrings: true, bom: false, lineEnding: 'crlf' },
    `meta 实读 ${JSON.stringify(r.meta)}`);

  // 一律字符串：这一条是 CSV 这一族的**全部代价**，面板那句 fidelity 说的就是它
  const mixed = uRead(csvToJson('s,n,b,z,e\r\n1,2.5,true,,\r\n'));
  assert.deepStrictEqual(mixed, [{ s: '1', n: '2.5', b: 'true', z: '', e: '' }],
    '看着像数字与布尔的一律是字符串，空格子也是');
  const stringy = uRead(csvToJson(uWrite(jsonToCsv([{ a: 1, b: true, c: null, d: { e: 1 } }]))));
  for (const [k, v] of Object.entries(stringy[0])) {
    assert.equal(typeof v, 'string', `${k} 那一格写出去再读回来是 ${typeof v}`);
  }
  // allStrings 是真话：拿一份什么花样都有的输入逐格验类型
  const wild = uRead(csvToJson('a,b\r\n"x""y",\r\n,1e3\r\n"l1\nl2",true\r\n'));
  assert.equal(wild.length, 3, '三行数据');
  for (const row of wild) {
    for (const [k, v] of Object.entries(row)) {
      assert.equal(typeof v, 'string', `${k} 那一格实读 ${typeof v}`);
    }
  }
  assert.equal(wild[0].a, 'x"y');
  assert.equal(wild[2].a, 'l1\nl2');

  // lineEnding 五档：由**实际出现过的**终止符决定，出现两种以上就是 mixed
  const LE = [
    ['全 CRLF', 'a,b\r\n1,2\r\n', 'crlf'],
    ['全 LF', 'a,b\n1,2\n', 'lf'],
    ['全 CR', 'a,b\r1,2\r', 'cr'],
    ['混着排', 'a,b\r\n1,2\n', 'mixed'],
    ['整份没有终止符', 'a,b', 'none'],
    ['只有一行表头也算 none', 'a', 'none'],
    ['引号里的换行不参与统计', 'a\r\n"x\ny"\r\n', 'crlf'],
    ['引号里的裸 CR 不参与统计', 'a\r\n"x\ry"\r\n', 'crlf'],
    ['尾行没有终止符不影响判定', 'a,b\r\n1,2', 'crlf'],
    ['BOM 不影响判定', bomChar + 'a,b\n1\n', 'lf'],
  ];
  for (const [label, text, want] of LE) {
    assert.equal(csvToJson(text).meta.lineEnding, want, `${label}：实读 ${csvToJson(text).meta.lineEnding}`);
  }
  // BOM 只认开头那一个；正文里出现的 U+FEFF 是内容
  assert.equal(csvToJson(bomChar + 'a\r\n1\r\n').meta.bom, true, '开头的 BOM 要报出来');
  assert.equal(uRead(csvToJson(bomChar + 'a\r\n1\r\n'))[0].a, '1', 'BOM 不进表头');
  const zws = String.fromCharCode(0xFEFF);
  assert.equal(csvToJson('a\r\n' + zws + 'x\r\n').meta.bom, false, '正文里的 U+FEFF 不是 BOM');
  assert.equal(uRead(csvToJson('a\r\n' + zws + 'x\r\n'))[0].a, zws + 'x', '它是内容，一个字符都不许丢');
  assert.equal(csvToJson('a;b\r\n1;2\r\n', { delimiter: ';' }).meta.delimiter, ';', 'meta 回显读的时候用的分隔符');
  assert.equal(csvToJson('a,b\r\n1,2\r\n').meta.delimiter, ',', '不传选项就是逗号');
  assert.equal(csvToJson('a,b\r\n1,2\r\n3,4\r\n').meta.rows, 2, 'rows 只数数据行，不含表头');
  assert.equal(csvToJson('a,b\r\n1,2\r\n').meta.columns, 2, 'columns 数的是表头格数');

  // 拒绝那一族：三档（empty / unterminated / ragged）+ 闸门两档，六格形状与位置口径同 U9
  const U16_ERR = [
    ['空文本', '', 'empty', 0, 1, 1],
    ['只有空白', '  \n ', 'empty', 4, 2, 2],
    ['只有终止符', '\r\n', 'empty', 2, 2, 1],
    // 两处都指认**那个没合上的引号自己**（不是它后面的内容，也不是 EOF）：面板把选区放到引号上才看得懂
    ['引号没合上', 'a\r\n"b', 'unterminated', 3, 2, 1],
    ['引号没合上（到 EOF）', 'a,b\n"c', 'unterminated', 4, 2, 1],
    ['多出来的格', 'a,b\r\n1,2,3\r\n', 'ragged', 9, 2, 5],
    ['多出来的格在跨行字段之后', 'a,b\r\n"x\ny",2,3\r\n', 'ragged', 13, 3, 6],
  ];
  for (const [label, text, kind, index, line, column] of U16_ERR) {
    const e = uReadErr(csvToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：六格齐活（与 U9/U12 同一条口径）`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}`);
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：行列必须由 index 推出来`);
    const rng = uLineRange(text, e.line);
    assert.equal(e.snippet, text.slice(rng.start, rng.end), `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    assert.equal(e.message.includes(`第 ${line} 行第 ${column} 列`), true, `${label}：消息要带行列`);
  }
  // 行号是**物理行**，不是"第几条记录"：上一格第三行那一档已经钉住了这件事。
  // ragged 只指认多出来的那一格，不去数前面有几格（消息里给期望与实际）
  const rag = uReadErr(csvToJson('a,b\r\n1,2,3\r\n'), 'ragged 的消息');
  assert.match(rag.message, /2/, `消息要给表头格数，实读 ${rag.message}`);
  assert.match(rag.message, /3/, `消息要给实际格数，实读 ${rag.message}`);

  // 闸门两档与 YAML/XML 走同一把尺，消息交回 core 的原话
  const tooLong = 'a,' + 'x'.repeat(U_JSON_BYTES);
  const gl = uReadErr(csvToJson(tooLong), 'CSV 超字节上限');
  assert.equal(gl.kind, 'too-long');
  assert.equal(gl.message, uGate(tooLong).message, '闸门消息只有一处口径');
  assert.equal(gl.index, tooLong.length);
  const tooMany = 'a,b\n'.repeat(U_LINES + 1);
  const gm = uReadErr(csvToJson(tooMany), 'CSV 超行数上限');
  assert.equal(gm.kind, 'too-many-lines');
  assert.equal(gm.message, uGate(tooMany).message);
  assert.equal(gm.index, tooMany.length);
  assert.deepStrictEqual(uLocate(tooMany, gm.index), { line: gm.line, column: gm.column }, '闸门那一档的行列也自洽');
});

test('U17 roundTrips：面板那三个 ✓ 读的就是这一格，判据与手工往返同结论', () => {
  // 这一格只服务面板上那三个"是否等价"读数，所以它的定义必须与 U6/U13/U15 的**手工往返**逐字一致：
  // 写侧不抛 && 写侧 ok && 读侧 ok && 深相等。任何一个条件单列出去，面板就会显示一个假 ✓。
  assert.deepEqual(Object.keys(roundTrips({})).sort(), ['csv', 'xml', 'yaml'], '三档，一档都不许多给');
  assert.deepEqual(roundTrips([{ a: '1', b: 'x' }]), { yaml: true, xml: true, csv: true },
    '全字符串的一行：三族都等价（CSV 里 "1" 本来就是串）');
  assert.deepEqual(roundTrips([{ a: 1 }]), { yaml: true, xml: true, csv: false },
    'CSV 没有类型：数字回来是字符串，所以 csv 必须 false——这不是缺陷，是这一族的代价');
  assert.deepEqual(roundTrips([{ a: { b: 1 } }]), { yaml: true, xml: true, csv: false },
    '嵌套压进单元格，回来是串');
  assert.deepEqual(roundTrips({ a: -0 }), { yaml: true, xml: true, csv: false },
    '负零只有 CSV 保不住：YAML 写 -0.0 读回 -0（U7 那格钉的是实测），本站的 XML 显式写 -0（U10），'
    + '而 CSV 那一格连类型都没有');
  assert.deepEqual(roundTrips([]), { yaml: true, xml: true, csv: false }, '空数组没有列名，CSV 写不出去');
  assert.deepEqual(roundTrips('hi'), { yaml: true, xml: true, csv: false }, '根是标量：CSV 只收对象与对象数组');
  const deep200 = uDeep(200);
  assert.deepEqual(roundTrips(deep200), { yaml: false, xml: true, csv: false },
    '200 层那一档：YAML 读侧撑不住（98 层），XML 撑得住（1000 层）——面板照实显示，不假装');
  assert.deepEqual(roundTrips(uWithProtoKey(1)).yaml, true, '__proto__ 那一格与 U6 同结论');
  assert.deepEqual(roundTrips(uWithProtoKey(1)).xml, true, '与 U13 同结论');

  // 非 JSON 入参：三个 false，且**不抛**——面板拿它做即时读数，抛一次就是整块面板空白
  const cyc = { a: 1 }; cyc.self = cyc;
  for (const v of [undefined, () => {}, Symbol('s'), 10n, NaN, Infinity, -Infinity, new Map(), new Set(), cyc]) {
    assert.deepEqual(roundTrips(v), { yaml: false, xml: false, csv: false },
      `${String(v?.toString ? v.toString() : v)}：roundTrips 不许抛，也不许给半个 ✓`);
  }

  // 与手工往返逐格一致：这一族是"实现不许自创第二套判定"的牙齿
  const CHECK = [
    {}, [], 'hi', 42, true, null, 0, -0, 1e21, { a: 1 }, { a: 'x' }, { a: [1, 2] },
    [{ a: 'x,y' }], [{ a: '1' }, { b: '' }], { a: { b: { c: '深' } } }, uDeep(98), uDeep(99),
    uWithProtoKey({ n: 1 }), { 键: '值' }, new Date('2024-01-01T00:00:00Z'),
  ];
  for (const v of CHECK) {
    const label = `一致性 ${JSON.stringify(v instanceof Date ? 'Date' : v).slice(0, 34)}`;
    const rt = roundTrips(v);
    assert.equal(rt.yaml, uRound(v, jsonToYaml, yamlToJson), `${label}：yaml 读数与手工往返不一致`);
    assert.equal(rt.xml, uRound(v, jsonToXml, xmlToJson), `${label}：xml 读数与手工往返不一致`);
    assert.equal(rt.csv, uRound(v, jsonToCsv, csvToJson), `${label}：csv 读数与手工往返不一致`);
  }
});

test('U18 常量、纯度与依赖边：三对互转只站在内置件与 json-core 上面', () => {
  assert.deepEqual(Object.keys(U_MOD).sort(), ['CSV_NOTES', 'XML_CONVENTION', 'YAML_DEPTH_LIMIT', 'YAML_LIB',
    'YAML_NOTES', 'csvToJson', 'jsonToCsv', 'jsonToXml', 'jsonToYaml', 'roundTrips', 'xmlToJson', 'yamlToJson'],
    '导出清单逐格钉住：多一格就是面板之外还有人能拿到内部件');
  // 版本串不许靠记忆：它必须与内置件首行 banner、与判据里的路径同源（U1/U2 钉的是文件，这一格钉的是字符串）
  assert.equal(YAML_LIB, 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs');
  const banner = read(YAML_LIB_PATH).split('\n', 1)[0];
  assert.equal(banner.includes(YAML_LIB.split(' ')[1]), true, `YAML_LIB 的版本与内置件 banner 不一致：${banner}`);
  assert.equal(YAML_LIB.includes(YAML_LIB_PATH), true, 'YAML_LIB 里的路径就是那一本文件');
  assert.equal(YAML_DEPTH_LIMIT, 98, '98 是实测出来的（见本节开头），改它要重跑二分，不许顺着消息里的 100 填');
  assert.equal(typeof XML_CONVENTION, 'string');
  assert.ok(XML_CONVENTION.length > 30 && XML_CONVENTION.length < 200,
    `XML_CONVENTION 是面板上的一句话（${XML_CONVENTION.length} 字），长过这一档就该拆进 help 而不是堆在面板`);
  for (const word of ['item', 't=']) assert.ok(XML_CONVENTION.includes(word), `那句话要提到 ${word}，实读 ${XML_CONVENTION}`);
  assert.deepEqual(Object.keys(YAML_NOTES).sort(), ['ambiguous', 'date']);
  assert.deepEqual(Object.keys(CSV_NOTES).sort(), ['fidelity']);
  assert.match(YAML_NOTES.ambiguous, /布尔|yes/i);
  assert.match(YAML_NOTES.date, /日期|时间/);
  assert.match(CSV_NOTES.fidelity, /字符串/, 'fidelity 那句必须明说"回来一律字符串"，否则 csv 的 false 读数没人解释');

  // 纯度：浏览器里跑的纯计算，不读环境、不外包转义与解析
  const code = uCode();
  for (const banned of ['document.', 'window.', 'localStorage', 'process.', 'Buffer', 'TextEncoder',
    'fetch(', 'require(', 'atob(', 'btoa(', 'JSON.parse', 'JSON.stringify', 'DOMParser', 'XMLSerializer',
    'eval(', 'new Function']) {
    assert.equal(code.includes(banned), false, `json-convert 不许出现 ${banned}：纯计算、不读环境、转义与解析都不外包`);
  }
  // 依赖边只有两把：内置件 + json-core；面板与 DOM 那一族一概不碰（§W 才接）
  const imports = [...code.matchAll(/^import .*$/gm)].map((m) => m[0]);
  assert.equal(imports.length, 2, `只许两本依赖，实读 ${JSON.stringify(imports)}`);
  assert.equal(imports.some((s) => s.includes('libJs/js-yaml')), true, 'YAML 走内置件');
  assert.match(code, /from '.\/json-core\.js'/);
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean).sort();
  assert.deepEqual(names, ['INDENT_MODES', 'MAX_DEPTH', 'escapeText', 'gate', 'lineRange', 'locate', 'pointerChild'],
    `借的那几把尺逐格钉住，实读 ${JSON.stringify(names)}——多借一格就该先加判据`);
  // 深度只有一把尺：本站的 XML 两向都吃 MAX_DEPTH，不许写一个字面量 1000
  assert.equal(code.includes('1000'), false, `出现字面量 1000 就是自创了第二把深度尺：借 MAX_DEPTH`);
});

// ── §S JSON 核心（tools/json-core.js，段 4 Task 2）───────────────────────────
// 这一节钉的只有一件事：**位置说得准**。设计文档 §5.3 要"错误处标出精确行列号"，
// 而位置错了和没报错一样有害，所以 S1 那张表逐个断 {kind,index,length,line,column,snippet}
// 六格，不断"有没有抛"（parseJson 全程不抛，坏输入是返回值——只有入参类型不对才抛 TypeError）。
// 位置口径写死在这里，实现不许自创第二套：
//   · line 与 column 都从 1 起；
//   · column 数的是 UTF-16 **码元**，所以一个 emoji 占两列（它本来就是这个长度，
//     `setSelectionRange` 用的也是这个单位，两把尺一致才对得上选区）；
//   · 换行只认 `\n`，于是 CRLF 一行只推进一次、`\r` 留在行内被 lineRange 切掉；
//   · BOM（U+FEFF）不吞，它就是第 1 行第 1 列那一个字符；
//   · EOF 那一格的 index = text.length、length = 0，列号 = 最后一行的长度 + 1。
// 与原生 `JSON.parse` 只要求**结论**同形（同一个输入两边要么都收、要么都拒），
// 不要求错误消息同形——V8 的消息没有列号，且各引擎文案不同（S16 量的是这一条）。
// MAX_INPUT_BYTES 在 §L 那一本 codec.js 里已经占了顶层名（1 MiB 那一档），这里借别名读 JSON 那一档的
// 5 MiB——两个数不同名就会互相盖掉，node --check 当场报"已声明"，不会静默读错闸门（§P 的 RE_INPUT_BYTES 同理）。
const { MAX_INPUT_BYTES: MAX_JSON_BYTES, MAX_INPUT_LINES, MAX_DEPTH, SORT_MODES, INDENT_MODES, CORE_NOTES,
  gate, locate, lineStarts, lineRange, parseJson, formatJson, minifyJson, stringifyJson, sortJson,
  toPointer, fromPointer, pointerChild, escapeText, unescapeText, statsOf } =
  await import('../dev/js/tools/json-core.js');

/** 坏样本的返回部分：不是 {ok:true} 就叫人红，免得断言里到处 .error.xxx */
const sErr = (text) => {
  const r = parseJson(text);
  if (r.ok) throw new Error(`样本应当被拒，却解析成功：${JSON.stringify(text)}`);
  return r.error;
};
/** 剥注释扫源码：闸门只许有一处口径，扫的是代码不是文档里的自我声明（与 §K/§L 同一形状） */
const sCode = () => read('dev/js/tools/json-core.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 确定性伪随机：S10 那一百次往返不能靠 Math.random，红第二次就得能原样重放 */
const sRng = (seed = 20260929) => {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7FFFFFFF; return s / 0x7FFFFFFF; };
};

/**
 * S1 的表：`[编号, 样本, kind, index, length, line, column, snippet, 为什么是这个位置]`。
 * 最后一列不是装饰——每一格的列号都得说得出理由，否则这张表只是在抄实现的输出。
 */
const S_BAD = [
  ['S1a', '', 'empty', 0, 0, 1, 1, '', '空文本没有内容可指，EOF 就是 0 那一格'],
  ['S1b', '   \n ', 'empty', 5, 0, 2, 2, ' ',
    '全是空白也判"没有内容"；index 落在 EOF（5），换行只有那一个 \\n，所以是第 2 行、行内第 2 列'],
  ['S1c', '{', 'unterminated', 1, 0, 1, 2, '{', '对象刚开就没了，EOF 在下标 1'],
  ['S1d', '{"a"', 'unterminated', 4, 0, 1, 5, '{"a"', '键读完等冒号，等到的是 EOF'],
  ['S1e', '{"a":', 'unterminated', 5, 0, 1, 6, '{"a":', '冒号读完等值，等到的是 EOF'],
  ['S1f', '[1,', 'unterminated', 3, 0, 1, 4, '[1,', '逗号读完等下一个元素，等到的是 EOF'],
  ['S1g', '[1,,]', 'unexpected-char', 3, 1, 1, 4, '[1,,]',
    '指认的是第二个逗号（下标 3）：第一个逗号是合法分隔符，"该放元素的位置"来的是它后面那一个'],
  ['S1h', '{,}', 'unexpected-char', 1, 1, 1, 2, '{,}', '空对象里容不下逗号，列 = 下标 + 1'],
  ['S1i', '{"a":1}{"b":2}', 'trailing', 7, 1, 1, 8, '{"a":1}{"b":2}',
    '根值已经收完，第二个 { 是"多出来的内容"，指认它的起始格'],
  ['S1j', "'a':1", 'unexpected-char', 0, 1, 1, 1, "'a':1",
    '单引号不是 JSON 的字符串定界符（本站不认 JSON5 方言，也不猜用户想要哪种）'],
  ['S1k', '{"a":1,}', 'unexpected-char', 7, 1, 1, 8, '{"a":1,}',
    '尾随逗号：逗号之后该来键，来的是 } —— 这一格就是计划里那句"尾随逗号点名拒"'],
  ['S1l', '{"a":"\\x41"}', 'bad-escape', 6, 2, 1, 7, '{"a":"\\x41"}',
    'index 指向反斜杠本身，length=2 是那两格；\\xNN 不是 JSON 的转义序列'],
  ['S1m', '{"a":"\\u12g4"}', 'bad-escape', 6, 2, 1, 7, '{"a":"\\u12g4"}',
    '同样是反斜杠那一格：\\u 后必须四位十六进制，g 把它打断，但错的是这个转义序列不是那个字母'],
  ['S1n', '01', 'bad-number', 0, 2, 1, 1, '01',
    '数字记号一次读完再验语法，所以指认的是整记号（长度 2）而不是第二个 1'],
  ['S1o', '1.', 'bad-number', 0, 2, 1, 1, '1.', '小数点后面必须有数字；记号长度就是 2'],
  ['S1p', '.5', 'unexpected-char', 0, 1, 1, 1, '.5', '. 不能起始一个值，压根进不了数字分支'],
  ['S1q', '+1', 'unexpected-char', 0, 1, 1, 1, '+1', '同理：+ 不是值的起始字符'],
  ['S1r', 'NaN', 'unexpected-char', 0, 1, 1, 1, 'NaN',
    'N 也不能起始一个值——本站不产 NaN/Infinity，parse 阶段就拒'],
  ['S1s', '0.1.2', 'bad-number', 0, 5, 1, 1, '0.1.2',
    '与 S1n 同一口径：贪婪读满 [0-9+.eE-] 那一串再验，所以是整记号而非中间那个点'],
  ['S1t', null, 'depth', MAX_DEPTH, 1, 1, MAX_DEPTH + 1, '['.repeat(MAX_DEPTH + 1),
    '第 1001 个容器（下标 1000）越闸门：列 = 下标 + 1 = 1001，正好等于 MAX_DEPTH + 1'],
];

test('S1 二十个坏样本逐个钉行与列，六格一起断（不是断"抛错"）', () => {
  for (const [id, text, kind, index, length, line, column, snippet, why] of S_BAD) {
    const src = text === null ? '['.repeat(MAX_DEPTH + 1) : text;
    const e = sErr(src);
    assert.equal(e.kind, kind, `${id} 的 kind`);
    assert.equal(e.index, index, `${id} 的 index —— ${why}`);
    assert.equal(e.length, length, `${id} 的 length —— ${why}`);
    assert.equal(e.line, line, `${id} 的 line —— ${why}`);
    assert.equal(e.column, column, `${id} 的 column —— ${why}`);
    assert.equal(e.snippet, snippet, `${id} 的 snippet（出错行原样，供读条与选区用）`);
  }
});

test('S2 坏样本还各带一句人话：message 非空、含行与列两个读数', () => {
  for (const [id, text] of S_BAD) {
    if (id === 'S1t') continue;   // 深度那一档的 message 由 S20 单独核
    const e = sErr(text === null ? '['.repeat(MAX_DEPTH + 1) : text);
    assert.ok(typeof e.message === 'string' && e.message.length > 0, `${id} 的 message 不能是空串`);
    assert.match(e.message, /第\s*\d+\s*行/, `${id} 的 message 要给出行号：${e.message}`);
    assert.match(e.message, /第\s*\d+\s*列/, `${id} 的 message 要给出列号：${e.message}`);
  }
});

test('S3 闸门按 UTF-8 字节数算，不是 .length：一个汉字三字节的那一档', () => {
  const cn = '中'.repeat(MAX_JSON_BYTES / 3 - 2);
  const src = JSON.stringify({ a: cn });
  const g = gate(src);
  assert.equal(typeof g.bytes, 'number');
  assert.ok(g.bytes > src.length, 'UTF-8 字节数必须大于码元数');
  assert.equal(g.bytes, Buffer.byteLength(src, 'utf8'),
    '字节口径必须等于 Node 的 utf8 编码长度（本站不许用 Buffer，但判据拿它当外部尺）');
});

test('S4 正好 5 MiB 放行、多一字节整体拒绝且不回显那一大串', () => {
  const atLimit = 'a'.repeat(MAX_JSON_BYTES);
  assert.equal(gate(atLimit).ok, true, '正好 5 MiB 必须放行（边界不许多算一字节）');
  assert.equal(gate(atLimit).bytes, MAX_JSON_BYTES);
  const over = `${atLimit}a`;
  const g = gate(over);
  assert.equal(g.ok, false);
  assert.equal(g.kind, 'too-long');
  assert.equal(g.limit, MAX_JSON_BYTES);
  assert.match(g.message, /超出/, '闸门的话术要出现"超出"两个字（S4 判据点名的就是它）');
  assert.match(g.message, /5242880/, `闸门要把上限说出来：${g.message}`);
  const e = sErr(over);
  assert.equal(e.kind, 'too-long', 'parseJson 的第一步就是 gate：越界时给的是闸门那一格，不是解析错误');
  assert.ok(!/aaaa/.test(e.message) && !/aaaa/.test(e.snippet),
    '拒绝时不许把那一大串回显进 message 或 snippet（§5.4 那句的反面就是黑箱刷屏）');
  assert.match(e.message, /超出\s*1\s*字节/,
    `message 要给出差额数字，口径是"超出 N 字节"：${e.message}`);
  assert.ok(e.message.includes(String(MAX_JSON_BYTES)),
    `message 要同时给出上限，用户才知道该删多少：${e.message}`);
});

test('S5 正好 20 万行放行、多一行拒；行口径与 lineStarts 同源', () => {
  const atLimit = `${'a\n'.repeat(MAX_INPUT_LINES - 1)}a`;
  assert.equal(lineStarts(atLimit).length - 1, MAX_INPUT_LINES, '行数以 lineStarts 为准：行数 + 1 格');
  assert.equal(gate(atLimit).ok, true, '正好 20 万行必须放行');
  assert.equal(gate(atLimit).lines, MAX_INPUT_LINES);
  const over = `${atLimit}\n`;
  const g = gate(over);
  assert.equal(g.ok, false);
  assert.equal(g.kind, 'too-many-lines');
  assert.equal(g.limit, MAX_INPUT_LINES);
  assert.equal(sErr(over).kind, 'too-many-lines');
});

test('S6 locate：CRLF 只算一次换行，\\r 留在行内不算第二行', () => {
  const t = '{\r\n  "a": ,\r\n}';
  assert.deepEqual(locate(t, t.indexOf(',')), { line: 2, column: 8 },
    'CRLF 是一行，不是两行；列从第 2 行的行首（下标 3）起算，逗号在那一行第 8 列');
  assert.deepEqual(locate(t, t.indexOf('}')), { line: 3, column: 1 });
  assert.deepEqual(locate(t, 0), { line: 1, column: 1 });
  assert.deepEqual(lineStarts(t), [0, 3, 13, 14],
    '\\r\\n 只在 \\n 处断行，所以第 2 行从下标 3 起、第 3 行从 13 起，末格是 length');
  assert.equal(sErr(t).line, 2, '出错的是第二行那个逗号');
  assert.equal(sErr(t).column, 8);
});

test('S7 locate：BOM 不吞，它就是第 1 行第 1 列那一个字符', () => {
  // 样本里的 BOM 一律写成 \uFEFF 转义而不是隐形字符：计划镜像、diff、grep 都看得见它
  const t = '\uFEFF{"a":';
  assert.equal(t.charCodeAt(0), 0xFEFF, '夹具自检：这一格真的带 BOM，否则下面几条断言全在骗人');
  assert.equal(t.length, 6);
  assert.deepEqual(lineStarts(t), [0, 6], 'BOM 不单独成行，也不许被当空白跳掉');
  assert.deepEqual(locate(t, 0), { line: 1, column: 1 }, 'BOM 占第 1 列，后面的列号依次右移');
  assert.deepEqual(locate(t, 1), { line: 1, column: 2 });
  const e = sErr(t);
  assert.equal(e.kind, 'unterminated');
  assert.equal(e.index, 6);
  assert.equal(e.column, 7, '带 BOM 的坏输入，列号把 BOM 也算进去（与原生"跳过 BOM"不同，但选区口径必须一致）');
  assert.equal(e.snippet, t);
  // 容忍与位置是两件事：解析器只跳过头部**那一个** BOM，列号照旧把它算进第 1 列
  const good = '\uFEFF{"a":1}';
  assert.equal(parseJson(good).ok, true, '从 Windows 文件里粘出来的带头 BOM 要收，不能让用户删了才知道能解析');
  assert.throws(() => JSON.parse(good),
    '这是本站与原生的一处**故意**分歧（原生拒 BOM），S16 把它和 1e999 一起记成两条明说的例外');
  assert.equal(parseJson(good).value.a, 1);
  assert.equal(sErr('\uFEFF\uFEFF{"a":1}').kind, 'unexpected-char', '第二个 BOM 不是空白：只容一个');
  const tail = sErr('{"a":1}\uFEFF');
  assert.equal(tail.kind, 'trailing', 'BOM 出现在值之后就不是空白，按多余内容点名');
  assert.deepEqual([tail.index, tail.column], [7, 8]);
});

test('S8 locate：emoji 是代理对，列号按 UTF-16 码元走（与选区同一把尺）', () => {
  const t = '{"a":"\uD83D\uDE00",';
  assert.equal(t.length, 10, '一个 emoji 在这里就是两个码元');
  assert.deepEqual(locate(t, 9), { line: 1, column: 10 },
    '列号必须与 setSelectionRange 的下标口径一致，否则高亮会错一格');
  assert.deepEqual(locate(t, 5), { line: 1, column: 6 }, '高代理那一个码元本身也是一列');
  assert.equal(sErr(t).kind, 'unterminated');
  assert.equal(sErr(t).index, 10);
});

test('S9 lineRange 给出「行内 \\r 之前」的区间，供读条与选区直接用', () => {
  const t = 'a\r\nbb\nccc';
  assert.deepEqual(lineRange(t, 1), { start: 0, end: 1 }, '\\r 不算进行内容');
  assert.deepEqual(lineRange(t, 2), { start: 3, end: 5 });
  assert.deepEqual(lineRange(t, 3), { start: 6, end: 9 });
  assert.deepEqual(lineRange(t, 0), { start: 0, end: 1 }, '行号从 1 起，第 0 档钳在第 1 行而不是越界');
  assert.deepEqual(lineRange(t, 99), { start: 6, end: 9 }, '越界那一档钳到最后一行');
  assert.equal(t.slice(lineRange(t, 2).start, lineRange(t, 2).end), 'bb');
});

test('S10 Pointer：~0/~1 编码与解码互为逆函数，100 次种子往返逐个键原样回来', () => {
  assert.equal(toPointer([]), '', '空段数组就是根，指针是空串而不是 /');
  assert.deepEqual(fromPointer(''), { ok: true, segments: [] }, '根反过来也解成空段，两边对称');
  assert.equal(toPointer(['a', 'b']), '/a/b');
  assert.equal(toPointer(['m~n']), '/m~0n');
  assert.equal(toPointer(['a/b']), '/a~1b');
  assert.equal(toPointer(['a~1b']), '/a~01b', '编码先做 ~→~0 再做 /→~1，反了就歧义');
  assert.deepEqual(fromPointer('/a~01b'), { ok: true, segments: ['a~1b'] },
    '解码先做 ~1→/ 再做 ~0→~：反了会把 a~1b 读成 a/b，那是把用户的数据改坏（~01b 正是这一刀的分界样本）');
  assert.deepEqual(fromPointer('/~0~1'), { ok: true, segments: ['~/'] });
  assert.deepEqual(fromPointer('/'), { ok: true, segments: [''] }, '单个 / 指向「键名是空串」那一格，不是根');
  assert.deepEqual(fromPointer('/0'), { ok: true, segments: ['0'] }, '数组段是十进制下标的**字符串**，怎么用由消费侧定');
  const rnd = sRng();
  const alphabet = ['~', '/', '0', 'a', '', '中', '\u{1F600}', ' ', ':', '"', '\\', '.'];
  for (let i = 0; i < 100; i++) {
    const segs = [];
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      let s = '';
      const m = 1 + Math.floor(rnd() * 3);
      for (let c = 0; c < m; c++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      segs.push(s);
    }
    const p = toPointer(segs);
    assert.ok(p.startsWith('/'), `非空指针必须以 / 起始：${JSON.stringify(p)}`);
    assert.deepEqual(fromPointer(p), { ok: true, segments: segs }, `第 ${i} 次往返不回来：${JSON.stringify(segs)}`);
  }
});

test('S11 fromPointer 的两类拒：不以 / 起始、~ 后面不是 0 或 1，各自点名那一列', () => {
  for (const [p, column, why] of [
    ['a/b', 1, '整条指针没有以 / 起始，错在下标 0'],
    [' ~x', 1, '开头的空格也算一格：位置要说用户按下去的那一列'],
    ['/~x', 2, '~ 后面跟了 x，指认那个 ~ 本身（下标 1）'],
    ['/a~2', 3, '第二段里的坏转义，~ 在下标 2'],
    ['/a~', 3, '结尾孤零零一个 ~：后面没有字符，仍然指认它'],
  ]) {
    const r = fromPointer(p);
    assert.equal(r.ok, false, `这条指针应当被拒：${JSON.stringify(p)}`);
    assert.deepEqual(Object.keys(r.error).sort(), ['column', 'message'],
      '契约里这一格只有 {message, column} 两栏：指针不是文档，没有行列可言');
    assert.equal(r.error.column, column, why);
    assert.ok(r.error.message.length > 0, `拒的时候要给出人话：${JSON.stringify(p)}`);
  }
});

test('S12 pointerChild 与 toPointer 自洽：父指针 + 子键 == 段数组追加后整条重编', () => {
  assert.equal(pointerChild('', 'a'), '/a', '根的孩子就是 /键');
  assert.equal(pointerChild('/a', 'b'), '/a/b');
  assert.equal(pointerChild('/a~1b', 'c'), '/a~1b/c', '父指针原样接上，不再解一遍再编一次（会丢转义）');
  assert.equal(pointerChild('/list', 3), '/list/3', '数组下标收数字也收字符串');
  assert.equal(pointerChild('/list', '3'), '/list/3');
  assert.equal(pointerChild('/a', 'm~n'), '/a/m~0n');
  assert.equal(pointerChild('/a', ''), '/a/');
  const rnd = sRng(20260930);
  const keys = ['~', '/', '~0', '~1', '', '0', 'a b', '中文', '\u{1F600}', 'x"y'];
  for (let i = 0; i < 60; i++) {
    const segs = [];
    for (let k = 0, n = Math.floor(rnd() * 3); k < n; k++) segs.push(keys[Math.floor(rnd() * keys.length)]);
    const key = keys[Math.floor(rnd() * keys.length)];
    assert.equal(pointerChild(toPointer(segs), key), toPointer([...segs, key]),
      `第 ${i} 次：segs=${JSON.stringify(segs)} key=${JSON.stringify(key)}`);
  }
});

test('S13 sortJson 三档：off 交回同一个引用、shallow 只动根、deep 连数组元素一起动', () => {
  assert.deepEqual(SORT_MODES, ['off', 'shallow', 'deep']);
  const src = { zeta: 1, alpha: 2, mid: { z: 1, a: 2 }, arr: [{ y: 1, x: 2 }] };
  assert.equal(sortJson(src, 'off') === src, true, 'off 连克隆都不做：装配层靠这一格判断"没动过"');
  const shallow = sortJson(src, 'shallow');
  assert.deepEqual(Object.keys(shallow), ['alpha', 'arr', 'mid', 'zeta']);
  assert.deepEqual(Object.keys(shallow.mid), ['z', 'a'], 'shallow 不进第二层');
  assert.deepEqual(Object.keys(shallow.arr[0]), ['y', 'x']);
  const deep = sortJson(src, 'deep');
  assert.deepEqual(Object.keys(deep), ['alpha', 'arr', 'mid', 'zeta']);
  assert.deepEqual(Object.keys(deep.mid), ['a', 'z']);
  assert.deepEqual(Object.keys(deep.arr[0]), ['x', 'y'],
    'deep 进数组元素——§5.3 那一格「按键排序（含嵌套）」就是这一档');
  assert.deepEqual(Object.keys(src), ['zeta', 'alpha', 'mid', 'arr'], '入参的键序一位都没动');
  assert.throws(() => sortJson(src, 'deepish'), /SORT_MODES/, '不在三档里的模式要当场拒绝并点名 SORT_MODES');
});

test('S14 排序口径是 UTF-16 码元序，不是 localeCompare（相邻键谁前谁后钉死）', () => {
  const obj = {};
  for (const k of ['a', 'Z', 'ä', 'B', '_', '0', 'A', '\u{1F600}']) obj[k] = 1;
  assert.deepEqual(Object.keys(sortJson(obj, 'shallow')),
    ['0', 'A', 'B', 'Z', '_', 'a', 'ä', '\u{1F600}'],
    '码元序：数字 < 大写 < 下划线 < 小写 < 变音符 < 代理对；localeCompare 会把 ä 塞到 a 旁边，本站不用它');
  assert.deepEqual(Object.keys(sortJson({ ab: 1, a: 1, abc: 1, 'a-b': 1, 'a.b': 1 }, 'shallow')),
    ['a', 'a-b', 'a.b', 'ab', 'abc'],
    '互为前缀的两个键：短的那一个在前；连字符 45 < 句号 46 < 小写 b 98');
  assert.ok(!sCode().includes('localeCompare'),
    '实现里不许出现 localeCompare：它跟着 ICU 与 locale 走，同一份输入在两台机器上会给出两种"稳定"输出');
});

test('S15 sortJson 不改入参：深比较、逐层键序，以及一份 Object.freeze 的输入', () => {
  const sKeys = (v) => (v && typeof v === 'object'
    ? (Array.isArray(v) ? v.map(sKeys) : Object.keys(v).map((k) => [k, sKeys(v[k])]))
    : null);
  const src = { b: { d: 1, c: [3, { f: 1, e: 2 }] }, a: 1, z: [1, 2] };
  const valueSnap = structuredClone(src);
  const orderSnap = sKeys(src);
  const deep = sortJson(src, 'deep');
  assert.notEqual(deep, src, 'deep 必须交回新对象（off 才交回同一个引用，见 S13）');
  assert.deepEqual(src, valueSnap, '排完以后原对象逐格等于排之前');
  assert.deepEqual(sKeys(src), orderSnap, '原对象每一层的键序都没动');
  assert.deepEqual(sKeys(deep), [['a', null],
    ['b', [['c', [null, [['e', null], ['f', null]]]], ['d', null]]], ['z', [null, null]]],
    'deep 交回的那一份：每一层都排过，数组顺序一个元素都没挪');
  const frozen = Object.freeze({ b: 1, a: Object.freeze([Object.freeze({ d: 1, c: 2 })]) });
  assert.doesNotThrow(() => sortJson(frozen, 'deep'),
    '实现若就地写键，冻结的输入会当场 TypeError——这一条就是「不改入参」的牙');
  assert.deepEqual(Object.keys(sortJson(frozen, 'deep')), ['a', 'b']);
  assert.deepEqual(Object.keys(sortJson(frozen, 'deep').a[0]), ['c', 'd']);
});

test('S16 与原生 JSON.parse 对拍：同结论、同值；两处故意分歧明写在断言里', () => {
  const deep200 = `${'['.repeat(200)}1${']'.repeat(200)}`;
  const GOOD = ['{}', '[]', 'null', 'true', 'false', '0', '-0', '1e3', '1E+3', '0e0', '-1.5',
    '12345678901234567890', '""', '"a"', '"\\u0041"', '"\\""', '"\\\\"', '"\\/"', '"\\b\\f\\n\\r\\t"',
    '"中文"', '"\u{1F600}"', '{"a":[1,{"b":null}]}', '[1,2,3]', '  {"a" : 1 }  ', '[\n 1 ,\n 2\n]',
    '{"":""}', '[[],[[]]]', deep200];
  for (const t of GOOD) {
    const mine = parseJson(t);
    assert.equal(mine.ok, true,
      `本站应当收：${JSON.stringify(t.slice(0, 40))}｜${mine.error ? mine.error.message : ''}`);
    assert.deepStrictEqual(mine.value, JSON.parse(t),
      `值必须与原生逐格相等（含 -0 与 1e3 这类形状）：${JSON.stringify(t.slice(0, 40))}`);
  }
  const BAD = S_BAD.map(([, text]) => (text === null ? '['.repeat(MAX_DEPTH + 1) : text)).concat([
    '"abc', '{"a": }', '[1 2]', '{"a" 1}', 'nul', 'tru', '"\\u00"', '1 2', '{"a":1,,}', '[]]',
    '"a" "b"', '1e', '-', '00', '{"a"::1}', '"\\x"', '"\\u00ZZ"', '[,]', '{"a":,}', 'undefined',
  ]);
  for (const t of BAD) {
    assert.throws(() => JSON.parse(t), `夹具自检：样本在原生那边本来就该拒 ${JSON.stringify(t.slice(0, 24))}`);
    const r = parseJson(t);
    assert.equal(r.ok, false, `本站也必须拒：${JSON.stringify(t.slice(0, 24))}`);
    assert.ok(typeof r.error.kind === 'string' && r.error.kind.length > 0, '拒的时候要给出 kind');
  }
  // 两条明说的分歧，钉在这里而不是散在注释里（其余一律同结论）
  assert.equal(parseJson('\uFEFF{}').ok, true, '分歧一：原生拒 BOM，本站收（从 Windows 文件粘出来的常见形状）');
  assert.throws(() => JSON.parse('\uFEFF{}'), '分歧一的另一半：原生确实拒');
  const inf = parseJson('1e999');
  assert.equal(inf.ok, false, '分歧二：原生把 1e999 收成 Infinity，本站不产 Infinity——下游算不动的形状不给进来');
  assert.equal(inf.error.kind, 'bad-number');
  assert.match(inf.error.message, /超出/);
  assert.ok(Object.is(JSON.parse('1e999'), Infinity), '分歧二的另一半：原生给 Infinity，这条分歧是真的');
});

test('S17 重复键：后写生效，duplicateKeys 用 Pointer 把每一处报出来', () => {
  const t = '{"a":1,"a":2,"a":3,"b":{"c":1,"c":2},"arr":[{"k":1},{"k":9}],"~x":1,"~x":2}';
  const r = parseJson(t);
  assert.equal(r.ok, true, '重复键不是错误，是要报告的形状（原生也收）');
  assert.equal(r.value.a, 3, '后写覆盖：与原生同结论');
  assert.equal(r.value.b.c, 2);
  assert.deepEqual(r.value.arr, [{ k: 1 }, { k: 9 }], '两个不同对象里的同名键不算重复');
  assert.deepEqual(r.duplicateKeys, [
    { pointer: '/a', times: 3 },
    { pointer: '/b/c', times: 2 },
    { pointer: '/~0x', times: 2 },
  ], '顺序按首次出现，pointer 走 RFC 6901 转义');
  assert.deepEqual(parseJson('{"a":1}').duplicateKeys, [], '没有重复时给空数组，不给 undefined');
  assert.match(CORE_NOTES.dupKey, /重复键/, '面板那句要出现「重复键」这三个字（§5.4 给依据不给黑箱）');
});

test('S18 formatJson：三种缩进逐字钉死，与 sort 组合、控制字符再转义、bytes 与 length 分家', () => {
  assert.deepEqual(INDENT_MODES, ['two', 'four', 'tab']);
  const v = { a: [{ b: 1 }, 2], c: '中文', d: null, e: [], f: {} };
  const src = JSON.stringify(v);
  assert.equal(formatJson(src, { indent: 'two' }).text, JSON.stringify(v, null, 2), 'two 档与原生逐字同形');
  assert.equal(formatJson(src, { indent: 'four' }).text, JSON.stringify(v, null, 4), 'four 档同上');
  assert.equal(formatJson(src, { indent: 'tab' }).text, JSON.stringify(v, null, '\t'), 'tab 档同上');
  assert.equal(formatJson('{"b":1,"a":2}', { indent: 'two', sort: 'deep' }).text, '{\n  "a": 2,\n  "b": 1\n}');
  assert.equal(formatJson('{"a":[{"y":1,"x":2}]}', { indent: 'two', sort: 'deep' }).text,
    '{\n  "a": [\n    {\n      "x": 2,\n      "y": 1\n    }\n  ]\n}', 'sort 进得去数组元素里那一层');
  assert.equal(formatJson('[]').text, '[]', '空数组不换行');
  assert.equal(formatJson('{}').text, '{}');
  assert.equal(formatJson('null').text, 'null', '标量根原样');
  assert.equal(formatJson('"a"').text, '"a"');
  assert.equal(formatJson('{"a":"\\u0000"}').text, '{\n  "a": "\\u0000"\n}',
    '输入是六个字符的 \\u0000 转义，输出还得是六个字符的转义：不许把裸 U+0000 写回产物');
  const cn = formatJson('{"a":"中文"}');
  assert.equal(cn.text, '{\n  "a": "中文"\n}');
  assert.equal(cn.text.length, 15, '码元数：那一个汉字在这里是 1 个码元');
  assert.equal(cn.bytes, 19, '字节数是 19 不是 15——一个汉字三字节');
  assert.equal(cn.bytes, Buffer.byteLength(cn.text, 'utf8'),
    'bytes 那把尺就是 UTF-8（判据拿 Node 当外部尺，模块内不许用 Buffer，见 S20）');
  const bad = formatJson('{"a":');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.kind, 'unterminated', 'formatJson 的坏输入要把 parseJson 那一格原样交出去，不许吞');
  assert.deepEqual([bad.error.line, bad.error.column], [1, 6]);
  const deep1000 = `${'['.repeat(MAX_DEPTH)}1${']'.repeat(MAX_DEPTH)}`;
  const f = formatJson(deep1000, { indent: 'two' });
  assert.equal(f.ok, true, '1000 层要格式化得动：递归实现在这里会先炸自己的调用栈（§S Step 2 那句硬规定）');
  assert.equal(minifyJson(f.text).text, deep1000, '格式化→压缩一圈回来必须逐字节等于最初那一串');
});

test('S19 minifyJson：只删容器之间的空白，字符串内部一个空格都不动', () => {
  const f = minifyJson('{ "a" : [ 1 , 2 ] , "b" : "  x  " }');
  assert.equal(f.ok, true);
  assert.equal(f.text, '{"a":[1,2],"b":"  x  "}', '"  x  " 里那四个空格是数据，不是缩进');
  assert.equal(f.text.length, 23);
  assert.equal(f.bytes, 23);
  assert.equal(minifyJson('["a\\nb"," a "]').text, '["a\\nb"," a "]', '转义序列与串内空格都原样');
  assert.equal(minifyJson('[\n  1,\r\n  2\n]').text, '[1,2]', 'CRLF 与行首缩进一起删掉');
  assert.equal(minifyJson('{"a": [ 1 , 2 ] }').text, '{"a":[1,2]}');
  const src = '{"b":[1,{"c":"  两格  "}],"d":{"e":[[[]]]}}';
  assert.deepStrictEqual(parseJson(minifyJson(src).text).value, parseJson(src).value,
    '压缩一圈以后值树逐格相等（deepStrictEqual：1 与 "1" 在这里不许混）');
  const bad = minifyJson('{');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.kind, 'unterminated');
  const deep = `${'['.repeat(200)}1${']'.repeat(200)}`;
  assert.equal(minifyJson(deep).text, deep, '本来就紧凑的深样本，压缩以后一个字都不该变');
});

test('S20 收尾三件：转义往返与点名、八类 kind 全覆盖、纯函数红线与 stats 一致', () => {
  assert.equal(escapeText('a"b'), 'a\\"b');
  assert.equal(escapeText('\\'), '\\\\');
  assert.equal(escapeText('\n\t'), '\\n\\t', '短转义用 \\n 与 \\t，与原生一致');
  assert.equal(escapeText('\u0000'), '\\u0000', '其余控制字符走六个字符的 \\uXXXX');
  assert.equal(escapeText('\u0008'), '\\b', '退格有短转义，不许写成 \\u0008');
  assert.equal(escapeText('中文\u{1F600}'), '中文\u{1F600}', '非 ASCII 不转义：与原生一致，字节账由调用方管');
  assert.equal(escapeText('\ud800'), '\\ud800', '落单的高代理项要转义出去：裸的半个 emoji 交出去就不再是合法 JSON（与原生 well-formed JSON.stringify 同形）');
  assert.equal(escapeText('\udfff'), '\\udfff', '落单的低代理项同理，不分高低');
  assert.equal(escapeText('\ud83d\ude00'), '\ud83d\ude00', '成对的代理项原样走：那是一个 emoji，不是两个坏字符');
  assert.deepEqual([unescapeText('\\ud800').ok, unescapeText('\\ud800').text], [true, '\ud800'], '反向认 \\ud800：解回那落单的半个，往返不丢格');
  assert.equal(unescapeText('a\\u0041b').text, 'aAb', '输入是 a + 转义A + b，回来三格：aAb（转义只吃反斜杠那一段）');
  assert.equal(unescapeText('\\/').text, '/', '\\/ 是合法的，要解成 /');
  assert.equal(unescapeText('\\b\\f\\n\\r\\t').text, '\b\f\n\r\t');
  for (const [frag, index, length] of [
    ['a\\x41b', 1, 2], ['a\\\'b', 1, 2], ['a\\qb', 1, 2], ['a\\u12g4', 1, 2], ['a\\u00', 1, 2], ['a\\', 1, 1],
  ]) {
    const r = unescapeText(frag);
    assert.equal(r.ok, false, `这一串不是合法的 JSON 字符串内容：${JSON.stringify(frag)}`);
    assert.equal(r.error.kind, 'bad-escape');
    assert.deepEqual([r.error.index, r.error.length], [index, length],
      `反斜杠那一格要指准：${JSON.stringify(frag)}`);
  }
  const rnd = sRng(20261001);
  const pool = ['"', '\\', '\n', '\t', '\u0000', '\u007f', '中', '\u{1F600}', 'a', ' ', ':', '/', '~', 'é'];
  for (let i = 0; i < 100; i++) {
    let s = '';
    for (let k = 0, n = 1 + Math.floor(rnd() * 8); k < n; k++) s += pool[Math.floor(rnd() * pool.length)];
    const back = unescapeText(escapeText(s));
    assert.equal(back.ok, true, `自己编出来的转义自己必须能解回来：${JSON.stringify(escapeText(s))}`);
    assert.equal(back.text, s, `第 ${i} 次往返：${JSON.stringify(s)}`);
  }

  const r = parseJson('{"a":[1,2],"b":{"c":"中文"}}');
  assert.equal(r.depth, 2, 'depth 数容器层数：根第 1 层，里面的数组与内层对象都在第 2 层');
  assert.equal(r.nodeCount, r.stats.nodes, 'nodeCount 与 stats.nodes 必须是同一个数（装配层只读 stats 那一格）');
  assert.equal(r.stats.nodes, 6, '六个值：根对象、数组、1、2、内层对象、那串中文');
  assert.equal(r.stats.depth, 2);
  assert.equal(r.stats.keys, 3, '键总数：a、b、c');
  assert.equal(r.stats.arrayItems, 2);
  assert.equal(r.stats.longestStringChars, 2, '最长的串是那串中文（键也一起量，它们只有 1 个码元）');
  assert.equal(r.stats.bytes, Buffer.byteLength('{"a":[1,2],"b":{"c":"中文"}}', 'utf8'));
  assert.equal(r.stats.lines, 1);
  assert.deepStrictEqual(statsOf(JSON.parse('1')), { nodes: 1, depth: 0, keys: 0, arrayItems: 0, longestStringChars: 0 },
    '标量根：depth 是 0，一个容器都没有');
  assert.deepStrictEqual(statsOf(JSON.parse('{}')), { nodes: 1, depth: 1, keys: 0, arrayItems: 0, longestStringChars: 0 });
  const deep200 = parseJson(`${'['.repeat(200)}1${']'.repeat(200)}`);
  assert.equal(deep200.ok, true, '§7 那一档深样本是 200 层，必须放行');
  assert.deepEqual([deep200.depth, deep200.stats.nodes, deep200.stats.arrayItems, deep200.stats.lines],
    [200, 201, 200, 1]);
  assert.equal(parseJson(`${'['.repeat(MAX_DEPTH)}1${']'.repeat(MAX_DEPTH)}`).ok, true, '正好 1000 层放行');

  const kindOf = (t) => sErr(t).kind;
  assert.deepEqual([kindOf(''), kindOf('{,}'), kindOf('"\\x"'), kindOf('01'), kindOf('"abc'),
    kindOf('{'), kindOf('1 2'), kindOf('['.repeat(MAX_DEPTH + 1))],
    ['empty', 'unexpected-char', 'bad-escape', 'bad-number', 'unterminated-string',
      'unterminated', 'trailing', 'depth'],
    '契约列出的十类 kind 里，除闸门那两档（S4/S5 各钉一刀）以外，这里八档必须全出一次场');

  assert.deepEqual([MAX_JSON_BYTES, MAX_INPUT_LINES, MAX_DEPTH], [5242880, 200000, 1000],
    '三格常量就是 §7 预算表里的那三个数，改一个就要同时改判据');

  const code = sCode();
  for (const banned of ['Buffer.', 'TextEncoder', 'process.', 'localStorage', 'document.', 'window.',
    'JSON.parse', 'JSON.stringify', 'fetch(', 'require(']) {
    assert.ok(!code.includes(banned), `json-core 不许出现 ${banned}：纯计算、不读环境、位置与转义都不外包给原生`);
  }
  assert.ok(!/^\s*import\s/m.test(code), 'json-core 一本都不 import：它是这一族的底座，不许有依赖边');
  assert.match(code, /function parseJson\([\s\S]{0,400}?=\s*gate\(/,
    'parseJson 的第一步必须是 gate：全仓库只有一处字节与行数的口径');
});

test('S21 stringifyJson：值 → 文本与 formatJson 同一只 serialize，深度 1000 不炸栈、undefined 不吞键', () => {
  // 这一格是 Task 6 装配层缺的那半扇门：互转那一族（YAML / XML / CSV 转回）手里已经是**值**了，
  // 只交 text→text 的两扇门，装配层就得先序列化成文本、再让 formatJson 把它解析回来——
  // 同一份数据搬三次。而它也不许自己用 `JSON.stringify`：S20 那条红线说的是"转义不外包给原生"。
  const v = { b: [1, { d: 'x' }], a: null, e: [], f: {} };
  for (const indent of INDENT_MODES) {
    const direct = stringifyJson(v, { indent });
    const viaText = formatJson(JSON.stringify(v), { indent });
    assert.equal(direct.text, viaText.text, `${indent} 档：两扇门出来的串必须逐字相同，否则页面上会同时存在两种缩进`);
    assert.equal(direct.bytes, viaText.bytes, 'bytes 也是同一把尺（UTF-8，不是码元数）');
  }
  assert.equal(stringifyJson({ b: 1, a: 2 }, { sort: 'deep' }).text, '{\n  "a": 2,\n  "b": 1\n}');
  assert.throws(() => stringifyJson(v, { indent: 'wild' }),
    (e) => e instanceof RangeError && /INDENT_MODES/.test(e.message),
    '档位写错要停在开发期：静默按 two 档出货，用户拿到的是他从来没点过的那一种');
  assert.throws(() => stringifyJson(v, { sort: 'wild' }),
    (e) => e instanceof RangeError && /SORT_MODES/.test(e.message));
  // 标量根、空容器、以及"值里没有 undefined 这件事"——三条快捷路在门外面也得走得到。
  assert.equal(stringifyJson('a').text, '"a"');
  assert.equal(stringifyJson(null).text, 'null');
  assert.equal(stringifyJson(undefined).text, 'null', 'undefined 出 null，不出空串：空串读不回去');
  assert.equal(stringifyJson({}).text, '{}', '空对象一对括号，不换行（与 S18 那条同形）');
  assert.equal(stringifyJson([]).text, '[]');
  assert.equal(stringifyJson({ a: undefined }).text, '{\n  "a": null\n}',
    '原生会把 "a" 那一整个键删掉，这里不许：键没了是数据丢失，不是排版差异');
  assert.equal(stringifyJson([undefined, 1]).text, '[\n  null,\n  1\n]', '数组那一支同一条口径');
  // 深值：`serialize` 是显式栈（S18 那条 1000 层的硬规定就是它），门外面这一条得单独再量一次。
  let deep = 1;
  for (let i = 0; i < MAX_DEPTH; i++) deep = [deep];
  const d = stringifyJson(deep, { indent: 'two' });
  assert.equal(d.ok, true, '1000 层的值要序列化得动：递归实现在这里会先炸自己的调用栈');
  assert.equal(parseJson(d.text).ok, true, '序列化出去的那一串得读得回来：门外面写的若不是合法 JSON，用户复制走就是一份坏文件');
  assert.equal(stringifyJson(v).text, stringifyJson(v, { indent: 'two', sort: 'off' }).text,
    '两格都缺席时按 two / off：与 formatJson 的默认档同一对默认值');
});

// ── §T interface 生成（tools/json-ts.js，段 4 Task 3）─────────────────────────
// 这一节钉的是"从样本推断出来的类型长成什么样"。`text` 是要给人复制走的东西，所以它按**逐字相等**来断，
// 不按"看起来像 TS"来断——一个缩进、一对括号、一处 `?:` 换了位置，复制出去的文件就归别人 debug 了。
// 三格返回各有各的口径：
//   · `text` = 一行注释（`TS_HEADER_NOTE`）+ 空行 + 若干声明块，块之间空一行，**结尾不留换行**；
//   · `names` = 具名 interface 的出场顺序（根那一格若是 `type Root = …` 就不在里面）；
//   · `notes` = 并集 / 可选键 / 索引签名三句**该说的时候**才说的话，句子里不许带计数器
//     （带了就得再钉一遍"数的是什么"，而这里三句都只是"这类形状怎么读"，不是样本统计）。
// 命名口径只有一套，写死在这里，实现不许自创第二套：
//   · 数组元素里的对象 → 具名接口 `父名 + PascalCase(键名)`；**键名给出的是元素的名字**
//     （`users: RootUsers[]`，接口叫 `RootUsers`），只有数组套数组与根数组没有键名，才追加 `Item`；
//   · 同名冲突按出场顺序追加 2、3……一个槽一份声明，形状相同也不合并（合并要做结构相等判断，
//     而"结构相等"和"同一个槽"根本不是一回事，宁可让输出重复）；
//   · 其余对象一律内联；内联对象里出现的数组，它的元素照样按"父名 + 键名"提升成具名接口。
// 并集成员的排序按档来：标量 → 数组 → 具名 interface → 内联对象 → null，同档内按渲染串升序。
// 这条把设计文档 §5.3 的"JSON → TypeScript interface"拆成了可断的格子：嵌套、数组、联合、null、
// 可选键五样都在 T1–T8 里各有一次逐字相等；T9 管参数口径，T10 管纯度与兜底。
const { TS_HEADER_NOTE, toInterfaceName, generateTs } = await import('../dev/js/tools/json-ts.js');

/** 剥注释扫源码：这一族的禁令跟 §S 同形，扫的是代码不是注释里的自我声明 */
const tCode = () => read('dev/js/tools/json-ts.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 只要声明部分：注释头 + 那个空行是所有形状共有的开头，剥掉它才好逐块写逐字相等 */
const tBody = (text) => {
  const head = `// ${TS_HEADER_NOTE}\n\n`;
  if (!text.startsWith(head)) throw new Error(`text 的开头不是"注释 + 空行"那一格：${JSON.stringify(text.slice(0, 40))}`);
  return text.slice(head.length);
};
const tOf = (value, options) => generateTs(value, options).text;

test('T1 三格返回的逐字形状：注释头、块序、names 出场顺序、notes 只说该说的', () => {
  const v = { users: [{ id: 1, name: 'a', nick: 'n' }, { id: 2, name: 'b' }], total: 3, tags: ['x', 'y'], ok: true };
  const out = generateTs(v);
  assert.equal(out.text, [
    `// ${TS_HEADER_NOTE}`,
    '',
    'interface Root {',
    '  users: RootUsers[];',
    '  total: number;',
    '  tags: string[];',
    '  ok: boolean;',
    '}',
    '',
    'interface RootUsers {',
    '  id: number;',
    '  name: string;',
    '  nick?: string;',
    '}',
  ].join('\n'), '行序、缩进、分号、空行一格都不许改');
  assert.ok(!out.text.endsWith('\n'), '结尾不留换行：复制框里多出来的那个空行也要算进字节');
  assert.deepEqual(out.names, ['Root', 'RootUsers'], 'names 就是声明块的出场顺序，跟 text 里的顺序一致');
  assert.equal(out.notes.length, 1, '这里只有"可选键"该说话：没并集、没引号键');
  assert.match(out.notes[0], /不是每条都有/);
  assert.match(TS_HEADER_NOTE, /样本/, '顶部那句得说清"这是按样本推断的"，不是 schema');
  assert.ok(!/[\r\n]/.test(TS_HEADER_NOTE), '那句注释必须是单行，不然 T1 的行序就不是上面这个形状了');
  assert.equal(tBody(tOf(v)).split('\n\n').length, 2, '两个声明块之间恰好一个空行');
});

test('T2 toInterfaceName 的六档：renamed 与 reason 是同一件事的两半', () => {
  assert.deepEqual(toInterfaceName('Root'), { name: 'Root', renamed: false, reason: '' });
  assert.deepEqual(toInterfaceName('users'), { name: 'Users', renamed: true, reason: '首字母改大写' });
  assert.deepEqual(toInterfaceName('orderID'), { name: 'OrderID', renamed: true, reason: '首字母改大写' });
  assert.deepEqual(toInterfaceName('a-b'), { name: 'AB', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('1st'), { name: '_1st', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('中文'), { name: 'Unnamed', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('$ok'), { name: 'Ok', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName(''), { name: 'Unnamed', renamed: true, reason: '空串' });
  const long = toInterfaceName('x'.repeat(60));
  assert.deepEqual([long.name.length, long.renamed, long.reason], [48, true, '超长截断']);
  assert.equal(long.name, `X${'x'.repeat(47)}`);
  // 四格自洽：renamed 当且仅当名字与原串不等；reason 空当且仅当没改名；名字永远是合法标识符
  for (const raw of ['Root', 'users', 'a-b', '', '1st', '中文', 'z'.repeat(70), '$ok', '_A1']) {
    const r = toInterfaceName(raw);
    assert.equal(r.renamed, r.name !== raw, `${raw} 的 renamed 与 name 对不上`);
    assert.equal(r.reason === '', !r.renamed, `${raw} 的 reason 与 renamed 分叉了`);
    assert.match(r.name, /^[A-Za-z_$][A-Za-z0-9_$]*$/, `${raw} → ${r.name} 不是合法标识符`);
  }
  for (const bad of [42, null, undefined, {}, [], true]) {
    assert.throws(() => toInterfaceName(bad), TypeError, `${typeof bad} 该抛 TypeError`);
  }
});

test('T3 键名要不要加引号：合法标识符与保留字都直写，其余双引号带转义', () => {
  const v = {
    ok: 1, $a: 2, _b: 3, '1st': 4, 'a-b': 5, 'a b': 6, '': 7, 中文: 8,
    class: 9, if: 10, 'a"b': 11, 'a\\b': 12, 'a\nb': 13, 'a\u0001b': 14, '\ud800': 15,
  };
  const out = generateTs(v);
  assert.equal(tBody(out.text), [
    'interface Root {',
    '  ok: number;',
    '  $a: number;',
    '  _b: number;',
    '  "1st": number;',
    '  "a-b": number;',
    '  "a b": number;',
    '  "": number;',
    '  "中文": number;',
    '  class: number;',
    '  if: number;',
    '  "a\\"b": number;',
    '  "a\\\\b": number;',
    '  "a\\nb": number;',
    '  "a\\u0001b": number;',
    '  "\\ud800": number;',
    '}',
  ].join('\n'), '属性位置允许保留字：`class`、`if` 不加引号；数字开头与空白与引号都只能加引号');
  assert.equal(out.notes.length, 1, '只有"索引签名"那一句该说');
  assert.match(out.notes[0], /索引签名/);
  const code = tCode();
  assert.match(code, /escapeText\(/, '转义外包给 json-core 的 escapeText：本站只有一套"串怎么变成字面量"');
});

test('T4 数组的三档：同构 T[]、异构 (A | B)[] 稳定升序、空数组 unknown[]', () => {
  assert.equal(tBody(tOf({ a: [1, 2] })), 'interface Root {\n  a: number[];\n}');
  assert.equal(tBody(tOf({ a: [1, 'x'] })), 'interface Root {\n  a: (number | string)[];\n}');
  assert.equal(tOf({ a: ['x', 1] }), tOf({ a: [1, 'x'] }), '等价输入必须给同一串：并集不跟着样本顺序走');
  assert.equal(tBody(tOf({ a: [null, 1, true, 'x', null] })),
    'interface Root {\n  a: (boolean | number | string | null)[];\n}', 'null 永远排在并集最后，其余按类型名升序');
  assert.equal(tBody(tOf({ a: [null] })), 'interface Root {\n  a: null[];\n}', '只有 null 时它就是那一个成员，不写成 unknown');
  assert.equal(tBody(tOf({ a: [] })), 'interface Root {\n  a: unknown[];\n}', '空数组没有样本可推断');
  assert.equal(tBody(tOf({ a: [[]] })), 'interface Root {\n  a: unknown[][];\n}');
  assert.equal(tBody(tOf({ a: [[1, 'x'], true] })),
    'interface Root {\n  a: (boolean | (number | string)[])[];\n}', '数组里并了标量：内层括号是元素自己的，外层括号是数组要的');
  assert.equal(tBody(tOf({ a: [[1, 'x'], [true]] })),
    'interface Root {\n  a: (boolean | number | string)[][];\n}',
    '一个数组只有一个元素槽：两层元素的形状并成一份，括号只在该并集的时候才加');
  assert.match(generateTs({ a: [1, 'x'] }).notes[0], /并集/);
});

test('T5 提升只发生在数组元素：键名给元素命名，冲突追加 2，内联对象里的数组照样提升', () => {
  const v = { aB: [{ q: 1 }], 'a-b': [{ r: 2 }], xs: [[{ z: 1 }]] };
  assert.equal(tBody(tOf(v)), [
    'interface Root {',
    '  aB: RootAB[];',
    '  "a-b": RootAB2[];',
    '  xs: RootXsItem[][];',
    '}',
    '',
    'interface RootAB {',
    '  q: number;',
    '}',
    '',
    'interface RootAB2 {',
    '  r: number;',
    '}',
    '',
    'interface RootXsItem {',
    '  z: number;',
    '}',
  ].join('\n'), '`aB` 与 `a-b` 都推出 RootAB：先出场的那个拿原名，后面追加 2');
  assert.deepEqual(generateTs(v).names, ['Root', 'RootAB', 'RootAB2', 'RootXsItem']);
  assert.equal(tBody(tOf([{ a: 1 }])),
    'type Root = RootItem[];\n\ninterface RootItem {\n  a: number;\n}', '根数组没有键名，元素用 Item');
  assert.equal(tBody(tOf({ p: [{ a: 1 }], s: [{ a: 2 }] })), [
    'interface Root {',
    '  p: RootP[];',
    '  s: RootS[];',
    '}',
    '',
    'interface RootP {',
    '  a: number;',
    '}',
    '',
    'interface RootS {',
    '  a: number;',
    '}',
  ].join('\n'), '形状相同也不合并：一个槽一份声明');
  assert.equal(tBody(tOf({ meta: { list: [{ q: 1 }] } })), [
    'interface Root {',
    '  meta: {',
    '    list: RootMetaList[];',
    '  };',
    '}',
    '',
    'interface RootMetaList {',
    '  q: number;',
    '}',
  ].join('\n'), '内联对象自己是 RootMeta，它里面的数组元素照样按父名+键名提升');
  // 数组套数组时名字一路追加 Item，48 字符那一档把链条截住（截断在冲突追加之前）
  let nested = { z: 1 };
  for (let i = 0; i < 15; i++) nested = [nested];
  assert.deepEqual(generateTs(nested).names, [`Root${'Item'.repeat(15)}`.slice(0, 48)],
    '根数组套 15 层：元素接口名截到 48 字符，链条不许越截越长');
  // 追加过 2、3 的那一格，孩子跟着**声明出去的名字**走，父子链在 text 里连得上
  const collide = { aB: [{ m: [{ p: 1 }] }], 'a-b': [{ m: [{ q: 2 }] }] };
  assert.deepEqual(generateTs(collide).names, ['Root', 'RootAB', 'RootABM', 'RootAB2', 'RootAB2M'],
    '两个槽都推出 RootAB：抢不到名字的那个追加 2，它里面的元素接口跟着叫 RootAB2M');
  assert.match(tBody(tOf(collide)), /interface RootAB2 \{\n {2}m: RootAB2M\[\];/,
    '声明与引用用同一格名字：RootAB2 的成员指着 RootAB2M，不指着断掉的 RootABM');
});

test('T6 内联对象与空容器：`{}`、`unknown[]`、根空对象、根标量走 type 别名', () => {
  assert.equal(tBody(tOf({ meta: { k: 1 }, empty: {}, list: [[1]] })), [
    'interface Root {',
    '  meta: {',
    '    k: number;',
    '  };',
    '  empty: {};',
    '  list: number[][];',
    '}',
  ].join('\n'), '内联对象一行一个成员，闭合的 `}` 退回上一层缩进');
  assert.equal(tBody(tOf({})), 'interface Root {}');
  assert.deepEqual(generateTs({}).names, ['Root']);
  assert.deepEqual(generateTs({}).notes, [], '空对象三句都不该说');
  for (const [value, want] of [[42, 'number'], ['s', 'string'], [true, 'boolean'], [null, 'null'],
    [[1, 2], 'number[]'], [[1, 'x'], '(number | string)[]']]) {
    assert.equal(tBody(tOf(value)), `type Root = ${want};`, `${JSON.stringify(value)} 的根不是对象，走别名`);
    assert.deepEqual(generateTs(value).names, [], '没有 interface 时 names 是空数组，不是 undefined');
  }
  assert.equal(tBody(tOf({ v: { k: 1 } })), 'interface Root {\n  v: {\n    k: number;\n  };\n}', '属性槽的对象是内联，不提升');
});

test('T7 可选键只在合并槽出现：`?:` 是"样本里没每条都有"，与 `| null` 是两回事', () => {
  const out = generateTs({ rows: [{ id: 1, tag: 'a' }, { id: 2 }, { id: 3, tag: null }] });
  assert.equal(tBody(out.text), [
    'interface Root {',
    '  rows: RootRows[];',
    '}',
    '',
    'interface RootRows {',
    '  id: number;',
    '  tag?: string | null;',
    '}',
  ].join('\n'), 'tag 有两条样本、其中一条是 null：既 `?:` 又并 `null`，两件事都要说');
  assert.match(out.notes.join('\n'), /不是每条都有/);
  assert.match(out.notes.join('\n'), /并集/);
  assert.equal(tBody(tOf([{ a: 1 }, { b: 'x' }])),
    'type Root = RootItem[];\n\ninterface RootItem {\n  a?: number;\n  b?: string;\n}', '键序取首次出现的顺序');
  assert.equal(tBody(tOf({ rows: [{ id: 1 }, { id: 2 }] })),
    'interface Root {\n  rows: RootRows[];\n}\n\ninterface RootRows {\n  id: number;\n}',
    '每条都有 → 不加 `?`：合并槽里"缺席"才谈得上可选');
  const same = { rows: [{ id: 1, s: 'x' }, { id: 2, s: 'y' }] };
  assert.deepEqual(generateTs(same).notes, [], '没有可选键也没有并集：notes 是空数组');
});

test('T8 notes 三句的条件出场：该说才说、说完就止，句子里不带计数器', () => {
  assert.deepEqual(generateTs({ a: 1 }).notes, [], '三句都不该说的时候交回空数组，不是三个空串');
  const onlyUnion = generateTs({ a: [1, 'x'] });
  assert.deepEqual(onlyUnion.notes.length, 1);
  assert.match(onlyUnion.notes[0], /并集/);
  const onlyQuoted = generateTs({ 'a b': 1 });
  assert.deepEqual(onlyQuoted.notes.length, 1);
  assert.match(onlyQuoted.notes[0], /索引签名/);
  const all3 = generateTs({ 'a-b': [{ c: 1 }, {}], d: [1, 'x'] });
  assert.deepEqual(all3.notes.map((s) => (/并集/.test(s) ? 'u' : /不是每条都有/.test(s) ? 'o' : 'i'))
    , ['u', 'o', 'i'], '出场顺序固定：并集 → 可选键 → 索引签名');
  for (const s of all3.notes) {
    assert.ok(!/\d/.test(s), `句子里不许带计数：${s}`);
    assert.ok(!/[\r\n]/.test(s), `一句必须是一行：${s}`);
    assert.equal(s, s.trim(), `句子两头不留空格：${s}`);
  }
  assert.equal(new Set(all3.notes).size, 3, '三句互不重复');
});

test('T9 indent 三档与 root 一档：模式不认就抛，静默回退默认档是把写错藏成莫名其妙', () => {
  const v = { a: { b: 1 } };
  assert.equal(tOf(v, { indent: 'two' }), tOf(v, {}), '缺省档就是 two');
  assert.equal(tBody(tOf(v, { indent: 'four' })), 'interface Root {\n    a: {\n        b: number;\n    };\n}');
  assert.equal(tBody(tOf(v, { indent: 'tab' })), 'interface Root {\n\ta: {\n\t\tb: number;\n\t};\n}');
  assert.equal(tBody(tOf(v, { root: 'payload' })),
    'interface Payload {\n  a: {\n    b: number;\n  };\n}', 'root 也过 toInterfaceName：小写首字母照样改大写');
  assert.equal(tBody(tOf([{ q: 1 }], { root: 'row' })),
    'type Row = RowItem[];\n\ninterface RowItem {\n  q: number;\n}', '根别名与它派生的元素名共用同一格 root');
  for (const bad of ['one', '2spaces', '', 'TWO']) {
    assert.throws(() => tOf(v, { indent: bad }), (e) => e instanceof RangeError
      && /INDENT_MODES/.test(e.message) && /two \| four \| tab/.test(e.message), `${bad} 该点名 INDENT_MODES`);
  }
  assert.deepEqual(INDENT_MODES, ['two', 'four', 'tab'], '这一族的档位与 json-core 同一条清单');
  assert.throws(() => tOf(v, { root: 42 }), TypeError);
  assert.throws(() => generateTs(undefined), TypeError, 'undefined 不是 JSON 值，点名比推断成 unknown 有用');
});

test('T10 纯度、显式栈与深度兜底：不读环境、不吃 JSON、1000 层与环都出得来', () => {
  const code = tCode();
  for (const banned of ['Buffer.', 'TextEncoder', 'process.', 'localStorage', 'document.', 'window.',
    'JSON.parse', 'JSON.stringify', 'fetch(', 'require(', 'eval(', 'Math.random']) {
    assert.ok(!code.includes(banned), `json-ts 不许出现 ${banned}：纯计算、不读环境、转义与解析都不外包给原生`);
  }
  assert.equal((code.match(/^import /gm) || []).length, 1, '只有一本依赖：json-core 的那几把尺');
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(names, ['INDENT_MODES', 'MAX_DEPTH', 'escapeText'], '只借三样：缩进档位、深度闸门、转义口径');
  assert.match(code, /const buildShape[\s\S]{0,900}?while \(stack\.length\)/, '收集样本形状走显式栈，不靠调用栈');
  // 深度：闸门之外不设第二道。1000 层是 parseJson 肯放行的最深输入，这里必须渲染得出来
  let deep = 1;
  for (let i = 0; i < 1000; i++) deep = { a: deep };
  const out = tOf(deep);
  assert.equal((out.match(/\{/g) || []).length, 1000, '一层容器一对花括号，兜底不许把中间某层悄悄压成 unknown');
  assert.equal((out.match(/number;/g) || []).length, 1, '最深那一格是 1 → number，它还在');
  // 环：同一格对象被反复走到，靠 MAX_DEPTH 收口，最深那一格交回 unknown
  const cyc = {};
  cyc.self = cyc;
  const c = tOf(cyc);
  assert.match(tBody(c), /unknown;/, '环走到深度闸门就停');
  assert.ok(c.length < 200000, `环不许把输出撑爆（实际 ${c.length} 字节）`);
  const v = { a: [{ b: 1 }], 'a-b': [{ c: 2 }] };
  tOf(v);
  assert.deepEqual(v, { a: [{ b: 1 }], 'a-b': [{ c: 2 }] }, '入参一个都不许改：推断只读不写');
});

// ── §V 树拍平与只渲染可视行（tools/json-tree.js，段 4 Task 5）─────────────────
// 这一节钉两样东西：**树的数据形状**（V2–V13，全在 plain array 上断，不碰 DOM）与
// **「只渲染可视」那四条外部证据**（V14–V16，假 DOM 夹具形状照 §I，但本节自建，不复用 `iPage`）。
// 为什么把拍平做成纯函数：折叠态、搜索命中、可见行集这三件事必须共用同一个真值源，
// 否则"匹配到的行在不在屏幕上"这种话只能靠 DOM 猜——而 §V 契约那一句要的正是纯函数级的证据。
// 行对象十二格（V2 逐行钉这个键集；加一格是一次契约变更）：
//   id · pointer · parent · depth · keyLabel · kind · display · childCount ·
//   expanded · hiddenCount · truncatedFrom · matched
// 两处口径是本段**选的形状**，不是实现细节，所以各有一条判据钉着：
//   · `id === pointer`，只有截断行例外（它的 id 是 `<父 pointer>~more`、pointer 留空串）——V7。
//     用行当下标的话，数据一刷新折叠态就落到别的行上，而"只渲染可视"那族判据抓不到这种漂。
//   · `hiddenCount` 数的是**这一行下面直接少了几行**，不是整棵子树的行数——V4、V13 各钉一次。
//     拍平只有一趟，要数后代就得再来一趟，而这一格的用户读数是"还有几个没列出"。
// `matched` 只有一个写入点：`searchRows`（V12），`flatten` 一律给 false。
const { ROW_KEYS_LIMIT, RENDER_WINDOW, DEFAULT_EXPAND_DEPTH, ROW_KINDS,
  flatten, expandOf, searchRows, createTreeController } = await import('../dev/js/tools/json-tree.js');

/** 剥注释扫源码：这一族的禁令与 §S/§T/§U 同形，扫的是代码不是注释里的自我声明 */
const vCode = () => read('dev/js/tools/json-tree.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 行对象的十二格，一格不多一格不少 */
const V_FIELDS = ['childCount', 'depth', 'display', 'expanded', 'hiddenCount', 'id',
  'keyLabel', 'kind', 'matched', 'parent', 'pointer', 'truncatedFrom'];
/** 行序那一族八格的投影：depth / pointer / parent / keyLabel / kind / childCount / expanded / hiddenCount */
const vPick = (r) => [r.depth, r.pointer, r.parent, r.keyLabel, r.kind, r.childCount, r.expanded, r.hiddenCount];
/** 一小棵混合树：六个直接子项，覆盖六类 kind、「数组套数组」与「折叠的嵌套空对象」 */
const vMix = () => ({ s: 'x', n: -0.5, b: false, z: null, a: [1, [2]], o: { k: {} } });
/**
 * 一层纯标量的行集：n 个键 → n+1 行；`extra` 在最前面插一格，用来造「行号漂而 id 不漂」。
 * `maxKeys` 顶到安全整数上限，因为这批夹具要的是"五千行就是五千行"——截断那一档由 V5、V6 单独量，
 * 别让默认的 2000 混进 V15、V16 的窗口判据里（那两条要数的是渲染，不是列表上限）。
 */
const vSet = (n, extra = false) => {
  const value = {};
  if (extra) value.extra = -1;
  for (let i = 0; i < n; i++) value['r' + i] = i;
  return flatten(value, { maxKeys: Number.MAX_SAFE_INTEGER });
};
/** 搜索样本：键里有 `Key`，值里有 `ITEM` 与 `123`，还有一支藏在 `/deep` 下面 */
const vHay = () => ({ Key: 'value', list: ['ITEM', 12], n: 123, deep: { k: 'key inside' } });
/** 把 vHay 那份数据「全展开」的那一行集（三个容器的 pointer 都在展开集里，故一轮就到底） */
const vAll = (value) => flatten(value, { expanded: new Set(['', '/list', '/deep']) });
/** 逐码元扫落单代理项：display 的截断点不许把一个 emoji 劈成两半 */
const vHasLoneSurrogate = (s) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const nx = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (nx < 0xdc00 || nx > 0xdfff) return true;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
};

test('V1 三格常量的值、只借两把尺、显式栈与环：这一本不吃环境，也不吃调用栈', () => {
  assert.deepEqual([ROW_KEYS_LIMIT, RENDER_WINDOW, DEFAULT_EXPAND_DEPTH], [2000, 80, 2],
    '这三个数是 §7 那一格预算与页面文案的共同分母：改一个就得回来重开一次判据');
  assert.deepEqual(ROW_KINDS, ['object', 'array', 'string', 'number', 'boolean', 'null']);
  const code = vCode();
  for (const banned of ['window.', 'localStorage', 'sessionStorage', 'globalThis', 'process.', 'Buffer',
    'fetch(', 'require(', 'eval(', 'new Function', 'Date.now', 'navigator', 'getComputedStyle',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'JSON.parse', 'JSON.stringify', 'document.cookie',
    'requestAnimationFrame']) {
    assert.ok(!code.includes(banned), `json-tree 不许出现 ${banned}：环境一律注入，落 DOM 只走 textContent`);
  }
  assert.equal((code.match(/^import /gm) || []).length, 1, '只有一本依赖：json-core 的那两把尺');
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(names, ['escapeText', 'pointerChild'], '只借两样：串的转义口径、Pointer 的拼接口径');
  // 显式栈：五千层容器 + 最里那一格标量，全展开就是五千零一行，且不许是 RangeError
  let deep = 1;
  for (let i = 0; i < 5000; i++) deep = { a: deep };
  const full = new Set();
  for (let i = 0, p = ''; i < 5000; i++, p += '/a') full.add(p);
  assert.equal(flatten(deep, { expanded: new Set() }).length, 1, '谁都不展开就只剩根那一行');
  assert.equal(flatten(deep, { expanded: full }).length, 5001, '五千层容器 + 最里那格标量，一层不落');
  // 环：默认档走不到环那里，所以不抛；显式喂一份能让它绕回来的展开集就当场点名
  const cyc = { a: { b: { c: null } } };
  cyc.a.b.c = cyc;
  assert.equal(flatten(cyc).length, 3, '默认只到第 2 层：/a/b 那一格是折叠的，压根走不到环');
  assert.throws(() => flatten(cyc, { expanded: new Set(['', '/a', '/a/b', '/a/b/c']) }),
    (e) => e instanceof TypeError && /环|自引用/.test(e.message) && /\/a\/b\/c/.test(e.message),
      '环要指认到绕回来那一格的 Pointer，而不是"栈溢出"');
  // 非 JSON 的值是入参错：与 §U 同一条口径——拒，而不是渲染成 null
  const U = undefined;
  for (const [label, bad] of [['undefined', U], ['函数', () => 1], ['symbol', Symbol('s')],
    ['NaN', NaN], ['Infinity', Infinity], ['bigint', 10n]]) {
    assert.throws(() => flatten({ k: bad }),
      (e) => e instanceof TypeError && /\/k/.test(e.message), `${label} 不是 JSON 能表达的值`);
  }
  assert.throws(() => flatten(U), TypeError, '整份输入就是 undefined 也点名');
  assert.equal(flatten(42).length, 1, '根是一格标量：一行，不是一棵');
});

test('V2 前序深度优先：一张十行的表钉住行序、parent、depth、childCount 与那十二格', () => {
  const rows = flatten(vMix());
  assert.equal(rows.length, 10, '六个直接子项里 a 与 o 各带一支，一共十行');
  assert.deepEqual(rows.map(vPick), [
    [0, '', null, '', 'object', 6, true, 0],
    [1, '/s', '', 's', 'string', 0, false, 0],
    [1, '/n', '', 'n', 'number', 0, false, 0],
    [1, '/b', '', 'b', 'boolean', 0, false, 0],
    [1, '/z', '', 'z', 'null', 0, false, 0],
    [1, '/a', '', 'a', 'array', 2, true, 0],
    [2, '/a/0', '/a', '0', 'number', 0, false, 0],
    [2, '/a/1', '/a', '1', 'array', 1, false, 1],
    [1, '/o', '', 'o', 'object', 1, true, 0],
    [2, '/o/k', '/o', 'k', 'object', 0, false, 0],
  ], '行的先后就是人眼从上往下读的先后：父在子前，兄弟按数据里的键序');
  for (const r of rows) {
    assert.deepEqual(Object.keys(r).sort(), V_FIELDS, '行对象就是那十二格，不多不少');
    assert.equal(r.matched, false, 'flatten 不上色：matched 只由 searchRows 写（V12）');
    assert.equal(r.truncatedFrom, -1, '这一趟没截断，-1 就是"没有起点"');
    assert.equal(r.id, r.pointer);
    assert.ok(ROW_KINDS.includes(r.kind), `${r.pointer} 的 kind 得在 ROW_KINDS 里`);
  }
  assert.equal(rows[0].parent, null, '根没有父：那一格是 null，不是空串');
  assert.deepEqual(rows.map((r) => r.display),
    ['', '"x"', '-0.5', 'false', 'null', '', '1', '[1 项]', '', '{}'],
    '展开的容器行不留概览串，折叠的才有（V9 逐类钉）');
});

test('V3 DEFAULT_EXPAND_DEPTH=2：默认档只展开到第 2 层，给了 Set 就完全不看默认档', () => {
  const chain = { l1: { l2: { l3: { l4: { l5: 'end' } } } } };
  const P3 = '/l1/l2/l3';
  assert.deepEqual(flatten(chain).map((r) => [r.depth, r.pointer, r.expanded]),
    [[0, '', true], [1, '/l1', true], [2, '/l1/l2', false]],
    '首屏最深的一行是 depth 2，而它是折叠的——"看到第 2 层"是"第 2 层在、第 3 层不在"');
  assert.deepEqual(flatten(chain, { expanded: new Set() }).map((r) => r.pointer), [''],
    '空 Set 是"谁都不展开"，不是"用默认档"');
  assert.deepEqual(flatten(chain, { expanded: new Set(['', '/l1', '/l1/l2', P3]) }).map((r) => r.pointer),
    ['', '/l1', '/l1/l2', P3, `${P3}/l4`], '展开集里点到的那一支一路到底，直到你没点的那一格');
  assert.equal(flatten(chain, { expanded: new Set(['', '/l1/l2']) }).length, 2,
    '展开集里的 /l1/l2 这一轮用不上（它的父 /l1 是折叠的），但不算错、也不许抛');
  assert.deepEqual(flatten(chain, { expanded: null }).map((r) => r.depth), [0, 1, 2], 'null 走默认档');
  for (const bad of [[''], ['x'], 0, true, {}, new Map()]) {
    assert.throws(() => flatten(chain, { expanded: bad }),
      (e) => e instanceof TypeError && /expanded/.test(e.message), 'expanded 只收 Set 或干脆不给');
  }
});

test('V4 折叠换的是「行集」：hiddenCount 数直接子项，不数整棵子树', () => {
  const v = { a: { b: 1, c: 1, d: { e: 1 } }, f: 2 };
  assert.deepEqual(flatten(v, { expanded: new Set(['', '/a', '/a/d']) }).map((r) => r.pointer),
    ['', '/a', '/a/b', '/a/c', '/a/d', '/a/d/e', '/f'], '全展开那一份的行序');
  const closed = flatten(v, { expanded: new Set(['']) });
  assert.deepEqual(closed.map((r) => [r.pointer, r.childCount, r.hiddenCount]),
    [['', 2, 0], ['/a', 3, 3], ['/f', 0, 0]]);
  assert.equal(closed.length, 3, '收起 /a 之后它下面四行都不在行集里');
  assert.equal(closed[1].hiddenCount, 3, '但 hiddenCount 报 3——那一格是"直接少了几行"');
  assert.equal(closed[1].display, '{3 键}', '概览串与 hiddenCount 是同一个数，两处不许分叉');
});

test('V5 ROW_KEYS_LIMIT 截断：多出来的那一行是唯一 pointer 留空的行', () => {
  const ten = {};
  for (let i = 0; i < 10; i++) ten['k' + i] = i;
  const rows = flatten(ten, { maxKeys: 3 });
  assert.deepEqual(rows.map((r) => r.id), ['', '/k0', '/k1', '/k2', '~more'],
    '根的 pointer 是空串，所以它的截断行 id 就长成 ~more');
  const root = rows[0];
  const more = rows[4];
  assert.deepEqual([root.childCount, root.hiddenCount, root.truncatedFrom], [10, 7, 3],
    '父行自己报"从第 3 格起没列、还差 7 个"');
  assert.deepEqual([more.pointer, more.parent, more.depth, more.kind, more.keyLabel],
    ['', '', 1, 'object', ''], '截断行点不出 Pointer，也不带键名');
  assert.deepEqual([more.childCount, more.expanded, more.hiddenCount, more.truncatedFrom], [0, false, 0, 3],
    '计数只归父行一处：两处都报 7 的话，搜索那一格的 truncated 会加两遍（V13）');
  assert.equal(more.display, '还有 7 个键未列出');
  assert.equal(more.matched, false);
  assert.deepEqual(Object.keys(more).sort(), V_FIELDS, '截断行也是那十二格');
  assert.equal(flatten(ten, { maxKeys: 0 }).length, 2, 'maxKeys=0 是合法档：根 + 截断行');
  assert.equal(flatten(ten, { maxKeys: 0 })[1].truncatedFrom, 0, '起点是"第一个未列出的子序号"');
  assert.equal(flatten(ten).length, 11, '不传就是默认那一档，十键一个都不截');
  assert.equal(flatten(ten, { maxKeys: 10 }).length, 11, '恰好等于子项数不算截断');
  assert.deepEqual(flatten(ten, { maxKeys: null }).map((r) => r.id).length, 11, 'null 走默认档，与 expanded 同一口径');
  for (const bad of [-1, 2.5, NaN]) {
    assert.throws(() => flatten(ten, { maxKeys: bad }),
      (e) => e instanceof RangeError && /maxKeys/.test(e.message), `${bad} 不是合法的键数档`);
  }
  assert.throws(() => flatten(ten, { maxKeys: '3' }), TypeError, '字符串档是入参错，不是"截个字符串长度"');
});

test('V6 数组那一族的文案、折叠优先于截断、截断行自己不可展开', () => {
  const arr = Array.from({ length: 10 }, (_, i) => i);
  const rows = flatten({ a: arr }, { maxKeys: 4 });
  assert.deepEqual(rows.map((r) => r.id), ['', '/a', '/a/0', '/a/1', '/a/2', '/a/3', '/a~more']);
  assert.equal(rows.length, 7);
  const more = rows[6];
  assert.deepEqual([more.display, more.kind, more.parent, more.depth],
    ['还有 6 个元素未列出', 'array', '/a', 2], '截断行替的是那些子行的位置，所以 depth 也跟着父 +1');
  assert.deepEqual([rows[1].hiddenCount, rows[1].truncatedFrom], [6, 4]);
  const closed = flatten({ a: arr }, { expanded: new Set(['']), maxKeys: 4 });
  assert.deepEqual(closed.map((r) => r.id), ['', '/a'], '折叠优先：子行本来就不出现，也就没有截断行');
  assert.deepEqual([closed[1].hiddenCount, closed[1].truncatedFrom, closed[1].display], [10, -1, '[10 项]']);
  const fed = flatten({ a: arr }, { expanded: new Set(['', '/a', '/a~more']), maxKeys: 4 });
  assert.deepEqual(fed.map((r) => r.id), rows.map((r) => r.id),
    '把截断行的 id 塞进展开集，行集一个字都不变——它不是一格容器');
  const deepCut = flatten({ a: { b: arr } }, { expanded: new Set(['', '/a', '/a/b']), maxKeys: 2 });
  assert.deepEqual(deepCut.map((r) => r.id), ['', '/a', '/a/b', '/a/b/0', '/a/b/1', '/a/b~more']);
  assert.equal(deepCut[5].depth, 3, '深层那一支的截断行也跟在它自己那一层，不许冒到第 2 层去');
});

test('V7 id 就是 Pointer：前面插一格之后折叠态跟着 Pointer 走，不跟着行号走', () => {
  const rows = flatten(vMix(), { expanded: new Set(['', '/a']) });
  for (const r of rows) assert.equal(r.id, r.pointer, `${r.pointer} 的 id 必须还是那条 Pointer`);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, '一轮行集里 id 唯一');
  const before = flatten({ a: 1, target: { x: 1 } }, { expanded: new Set(['', '/target']) });
  const after = flatten({ z: 0, a: 1, target: { x: 1 } }, { expanded: new Set(['', '/target']) });
  const idxOf = (rs, id) => rs.findIndex((r) => r.id === id);
  assert.deepEqual([idxOf(before, '/target'), idxOf(before, '/target/x')], [2, 3]);
  assert.deepEqual([idxOf(after, '/target'), idxOf(after, '/target/x')], [3, 4], '行号整体 +1，数据却还是同一份');
  assert.equal(after[idxOf(after, '/target')].expanded, true, '展开状态认的是 id，不是"第 2 行"');
  assert.equal(after[idxOf(after, '/target')].keyLabel, 'target');
  const cut = flatten({ a: 1, b: 2, c: 3 }, { maxKeys: 1 });
  assert.equal(cut[2].id, '~more');
  assert.equal(cut[2].pointer, '', '截断行是 id 口径的唯一例外：那一格点不出、也复制不出 Pointer');
  assert.equal(new Set(cut.map((r) => r.id)).size, cut.length, '连截断行一起算，id 仍然唯一');
});

test('V8 Pointer 的转义与「自有键」口径：~0/~1、空键、原型上那几个名字', () => {
  const v = { 'a/b': 1, 'c~d': 2, '': 3, 'e~1f': 4, 'g~0h': 5 };
  const rows = flatten(v, { expanded: new Set(['']) });
  assert.deepEqual(rows.slice(1).map((r) => r.pointer), ['/a~1b', '/c~0d', '/', '/e~01f', '/g~00h']);
  assert.deepEqual(rows.slice(1).map((r) => r.keyLabel), ['a/b', 'c~d', '', 'e~1f', 'g~0h'],
    'keyLabel 是原样键名：转义只发生在 Pointer 那一格');
  for (const r of rows.slice(1)) {
    const back = fromPointer(r.pointer);
    assert.equal(back.ok, true, `${r.pointer} 解不回去：拼与解必须是同一族口径`);
    assert.equal(back.segments.length, 1);
  }
  assert.equal(fromPointer('/e~01f').segments[0], 'e~1f',
    '与 json-core 同一条回路；先 ~1 再 ~0 的两趟写法会把它读成 e/1f');
  assert.deepEqual(flatten([1, 2], { expanded: new Set(['']) }).map((r) => [r.pointer, r.keyLabel]),
    [['', ''], ['/0', '0'], ['/1', '1']], '数组下标不转义，也不写成 [0]：那一层排版归视图层');
  const polluted = parseJson('{"__proto__":{"a":1},"constructor":2}');
  assert.equal(polluted.ok, true);
  const pr = flatten(polluted.value, { expanded: new Set(['']) });
  assert.deepEqual(pr.map((r) => r.pointer), ['', '/__proto__', '/constructor']);
  assert.equal(pr[1].childCount, 1, '__proto__ 那一格是真数据：它里面还有一个键');
  assert.equal(Object.getPrototypeOf(polluted.value), Object.prototype, '拍平一趟不许把原型改掉');
  assert.ok(!pr.some((r) => r.pointer === '/toString'),
    '只枚举自有键：for...in 那种把原型上的方法也枚举进来的写法不许用');
});

test('V9 display 的六档与长串截断：截断在转义之前，代理对不被劈成半个', () => {
  const show = (value) => flatten({ k: value }, { expanded: new Set(['']) })[1].display;
  assert.equal(show('x'), '"x"');
  assert.equal(show('a"b\\c\nd'), '"a\\"b\\\\c\\nd"', '引号、反斜杠、换行各走短转义');
  assert.equal(show(String.fromCharCode(1)), '"\\u0001"', '其余控制字符走 \\uXXXX，与 json-core 同一条口径');
  assert.equal(show(String.fromCharCode(7)), '"\\u0007"');
  assert.equal(show('1e21'), '"1e21"', '那是串不是数：引号区分得开');
  assert.equal(show(1e21), '1e+21');
  assert.equal(show(-0), '0', '与 String(-0)、JSON.stringify(-0) 同形：display 管"读起来"，-0 保不保是文本视图那一格的事（§S）');
  assert.equal(show(0.1 + 0.2), '0.30000000000000004');
  assert.equal(show(true), 'true');
  assert.equal(show(false), 'false');
  assert.equal(show(null), 'null');
  assert.equal(show({}), '{}');
  assert.equal(show({ a: 1, b: 2 }), '{2 键}');
  assert.equal(show([]), '[]');
  assert.equal(show([1, 2, 3]), '[3 项]');
  assert.equal(flatten({ k: { a: 1 } }, { expanded: new Set(['', '/k']) })[1].display, '',
    '展开的容器不留概览串：子行就在下面，再来一遍 {} 是噪音');
  const at200 = 'a'.repeat(200);
  assert.equal(show(at200), `"${at200}"`, '刚到那一格不截');
  assert.equal(show(at200 + 'b'), `"${at200}…"`, '越一格才截：截的是码元数，不是"看着长了"');
  assert.equal(show('"'.repeat(300)), `"${'\\"'.repeat(200)}…"`,
    '截断发生在转义**之前**，所以留出来的是整整 200 组 \\"，不会剩半根反斜杠');
  const emoji = 'x'.repeat(199) + '👍'.repeat(4);
  assert.equal(show(emoji), `"${'x'.repeat(199)}…"`,
    '第 200 格正好落在一个 emoji 上：宁可整个不收，也不留半个代理项');
  assert.equal(vHasLoneSurrogate(show(emoji)), false, 'display 里不许有落单的代理项');
  assert.equal(vHasLoneSurrogate(show('👍'.repeat(300))), false, '整串都是 emoji 也一样');
});

test('V10 expandOf 交回的是新 Set：不改行对象，折叠一支就把支内的展开态一起带走', () => {
  const rows = flatten(vMix());
  const a = expandOf(rows, '/o', false);
  assert.ok(a instanceof Set);
  assert.deepEqual([...a].sort(), ['', '/a'], 'rows 里展开着的是 ""、/a、/o 三格，关掉 /o 就剩两格');
  const b = expandOf(rows, '/a/1', true);
  assert.deepEqual([...b].sort(), ['', '/a', '/a/1', '/o']);
  assert.notEqual(a, b, '每一次都是一份新 Set');
  assert.equal(a.has('/a/1'), false, '两份之间互不影响');
  const before = rows.map((r) => [r.id, r.expanded]);
  expandOf(rows, '/s', true);
  assert.deepEqual(rows.map((r) => [r.id, r.expanded]), before, '行对象一格都不许被 expandOf 改');
  a.delete('');
  assert.deepEqual([...expandOf(rows, '/o', false)].sort(), ['', '/a'],
    '刚才那份被调用方改了也不影响下一次：每次都从 rows 重建');
  assert.deepEqual([...expandOf(rows, '/nope', true)].sort(), ['', '/a', '/nope', '/o'],
    '行集里没有的 id 照收（与 V3 同一口径：不算错）');
  assert.equal(flatten(vMix(), { expanded: expandOf(rows, '/nope', true) }).length, rows.length,
    '多出来的那一个没用的 id 不改变行集');
  assert.deepEqual([...expandOf(rows, '/nope', false)].sort(), ['', '/a', '/o'], '关掉一格没开着的也算没发生');
  const chain = { l1: { l2: { l3: 1 } } };
  const wide = flatten(chain, { expanded: new Set(['', '/l1', '/l1/l2']) });
  assert.equal(wide.length, 4);
  const shut = expandOf(wide, '/l1', false);
  assert.deepEqual([...shut].sort(), ['', '/l1/l2'], '/l1/l2 的展开态还在这份里，但它已经是一格过期 id');
  const back = expandOf(flatten(chain, { expanded: shut }), '/l1', true);
  assert.deepEqual([...back].sort(), ['', '/l1'],
    '再展开 /l1 时 /l1/l2 已经不在这一轮行集里，于是被丢掉：折叠一支会把支内的展开态一起带走');
  assert.deepEqual(flatten(chain, { expanded: back }).map((r) => r.pointer), ['', '/l1', '/l1/l2']);
  assert.throws(() => expandOf(rows, 42, true), TypeError);
  assert.throws(() => expandOf('not rows', '', true), TypeError);
});

test('V11 搜索三档 scope：key 只认键、value 只认标量的渲染串、both 取并，档位不认就抛', () => {
  const rows = vAll(vHay());
  assert.equal(rows.length, 8, '四个直接子项 + list 的两个元素 + deep 的一个键 + 根');
  assert.deepEqual(searchRows(rows, 'key', { scope: 'key' }).matchedIds, ['/Key']);
  assert.deepEqual(searchRows(rows, 'key', { scope: 'value' }).matchedIds, ['/deep/k'],
    '/deep/k 的渲染串是 "key inside"');
  assert.deepEqual(searchRows(rows, 'key', {}).matchedIds, ['/Key', '/deep/k'], '缺省档就是 both');
  assert.deepEqual(searchRows(rows, 'both', { scope: 'both' }).matchedIds, [], '档位名不是搜索词：这一趟谁都别命中');
  assert.deepEqual(searchRows(rows, 'ITEM', { scope: 'value' }).matchedIds, ['/list/0']);
  assert.deepEqual(searchRows(rows, '12', { scope: 'value' }).matchedIds, ['/list/1', '/n'],
    '值搜的是渲染串，所以 12 也命中 123——"子串"这一档写死，不许谁来实现期改成整词匹配');
  assert.deepEqual(searchRows(rows, '"', { scope: 'value' }).matchedIds, ['/Key', '/list/0', '/deep/k'],
    '引号算进渲染串：搜一个 " 就是"所有字符串行"');
  for (const bad of ['all', 'KEY', '', 'keys', 'Both']) {
    assert.throws(() => searchRows(rows, 'key', { scope: bad }),
      (e) => e instanceof RangeError && /key \| value \| both/.test(e.message), `${bad} 不是本站的档位`);
  }
  assert.throws(() => searchRows(rows, 42), TypeError, '搜索词是字符串：数字不是"没搜到"而是写错了');
  assert.throws(() => searchRows(rows, null), TypeError);
  assert.throws(() => searchRows('not rows', 'x'), TypeError);
  const empty = searchRows(rows, '');
  assert.deepEqual([empty.total, empty.truncated], [0, 0], '空串不是"匹配一切"');
  assert.equal(rows.some((r) => r.matched), false, '空串这一趟还要把上一轮的色洗掉');
});

test('V12 matched 只有一处上色：顺序随行集走，重跑不留上一轮的色，容器概览串不算值', () => {
  const rows = vAll(vHay());
  const r1 = searchRows(rows, 'E', { scope: 'key' });
  assert.deepEqual(r1.matchedIds, ['/Key', '/deep'], '按行序给，不是按"先命中谁"给');
  assert.equal(r1.total, r1.matchedIds.length, 'total 就是 matchedIds 的长度，不是"扫描过的行数"');
  assert.deepEqual(rows.filter((r) => r.matched).map((r) => r.id), ['/Key', '/deep']);
  const r2 = searchRows(rows, 'zzz', { scope: 'both' });
  assert.equal(r2.total, 0);
  assert.equal(rows.every((r) => r.matched === false), true, '上一轮的 /Key 必须被洗掉');
  assert.deepEqual(searchRows(rows, 'KEY', { scope: 'key' }).matchedIds, ['/Key'], 'ASCII 大小写折掉');
  assert.deepEqual(searchRows(rows, 'inside', { scope: 'value' }).matchedIds, ['/deep/k']);
  assert.deepEqual(searchRows(rows, '中文', { scope: 'both' }).matchedIds, [], '没大小写可折的照原样比');
  const part = flatten(vHay(), { expanded: new Set(['']) });
  assert.deepEqual([part[2].display, part[4].display], ['[2 项]', '{1 键}'], '这一份里有两格折叠概览串');
  for (const q of ['键', '项', '[2 项]', '{1 键}']) {
    assert.deepEqual(searchRows(part, q, { scope: 'value' }).matchedIds, [],
      `${q}：容器行不参与值搜索，否则搜一个 2 就命中一堆 [2 项]`);
  }
  const cut = flatten(vHay(), { maxKeys: 3 });
  assert.equal(cut[cut.length - 1].id, '~more');
  assert.deepEqual(searchRows(cut, '列出', { scope: 'both' }).matchedIds, [],
    '截断行那句文案不是数据：搜"列出"不许把它算成一次命中');
  assert.equal(searchRows(cut, '列出', { scope: 'both' }).truncated, 1, '但它下面确实少扫了一格');
});

test('V13 truncated 是"这次没扫到的直接子项数"：全展开归 0，折叠与截断都算进去', () => {
  const rows = vAll(vHay());
  assert.equal(searchRows(rows, 'ITEM', { scope: 'value' }).truncated, 0, '全展开、无截断：这一趟吃下了整棵树');
  const part = flatten(vHay(), { expanded: new Set(['']) });
  const s = searchRows(part, 'ITEM', { scope: 'value' });
  assert.deepEqual([s.total, s.truncated], [0, 3],
    'ITEM 藏在 /list 里而 /list 折叠着：搜不到，truncated 报 3（/list 的 2 项 + /deep 的 1 键）');
  const cut = flatten(vHay(), { maxKeys: 3 });
  const s2 = searchRows(cut, 'ITEM', { scope: 'value' });
  assert.deepEqual([s2.matchedIds, s2.truncated], [['/list/0'], 1], '截断那一格同样计入：还差一个 deep 没扫');
  const nested = flatten({ a: { b: { c: 1 } } }, { expanded: new Set(['']) });
  assert.equal(searchRows(nested, 'zzz').truncated, 1,
    '只报"直接少了几格"，不是"整棵子树少了几行"——后者要第二趟扫描，而拍平只有一趟（V4 同一条口径）');
  assert.equal(typeof searchRows(rows, 'x').truncated, 'number', '那一格是数字不是布尔：装配层要把它写进提示里');
  assert.equal(searchRows(vSet(0), 'x').truncated, 0, '根是一格空对象：没有子项，也就没有"没扫到"');
});

/**
 * 假 DOM（本节自建，形状照 §I 的 `iPage` 但只开 json-tree 用到的那几张口子）。
 * 三处刻意的"不像真 DOM"，每一处都是为了少一处假绿：
 * 1. **没有 `innerHTML`**。控制器若写了它，只会长出一个普通属性、一个子节点都不多——V14 判的正是
 *    "三块与行是真的节点"。真 DOM 反而会把标签解析出来，把这条判据洗白。
 * 2. **`removeChild` 找不到节点就抛**。静默的话"撤行没撤干净"看不见。
 * 3. **`dispatch` 只调真的挂上去的监听**，`removeEventListener` 之后调不到——V16 那条
 *    "destroy 摘干净"量的就是这个。
 * `scrollTop` 是可写的普通字段：真浏览器里由滚动条决定，这里由判据决定，而控制器读它的方式一模一样。
 * 也正因为它是个普通字段，**控制器自己写它的时候这里不会补发 `scroll`**——真浏览器一定会补发，
 * 而那一次回声会把"锚点是视口首行"这条口径反过来吃掉判据想要的行为，所以 V18 手动 `dispatch` 一次，
 * 把那一刀补在夹具够不着的地方（这是本节唯一一处"判据替浏览器说话"，别的都让夹具自己说）。
 * `focus` 记的是 `[id, 实参]` 两元：不带 `preventScroll` 的 `focus()` 在真浏览器里会为视口外的
 * 缓冲行滚一次，光看 id 那一格永远测不到。
 */
function vTree({ rowHeight = 24 } = {}) {
  const focusLog = [];
  let active = null;
  const mk = (tag) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), attrs, childNodes: [], style: {}, textContent: '',
      setAttribute: (k, v) => { attrs.set(k, String(v)); },
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      appendChild: (n) => { el.childNodes.push(n); return n; },
      removeChild: (n) => {
        const i = el.childNodes.indexOf(n);
        if (i < 0) throw new Error('假 DOM：这个父节点下没有它');
        el.childNodes.splice(i, 1);
        return n;
      },
      addEventListener: (t, fn) => {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t).add(fn);
      },
      removeEventListener: (t, fn) => {
        const s = listeners.get(t);
        if (s) s.delete(fn);
      },
      dispatch: (t) => { for (const fn of [...(listeners.get(t) || [])]) fn({ type: t }); },
      listenerCount: (t) => (listeners.get(t) || new Set()).size,
      focus: (arg) => { active = el; focusLog.push([el.getAttribute('data-jt-id'), arg]); },
    };
    return el;
  };
  const doc = { createElement: (tag) => mk(tag), get activeElement() { return active; } };
  const container = mk('div');
  container.scrollTop = 0;
  container.clientHeight = 480;
  const holder = () => container.childNodes[1];
  return {
    doc, container, focusLog, holder,
    rowCount: () => (holder() ? holder().childNodes.length : 0),
    rowIds: () => holder().childNodes.map((n) => n.getAttribute('data-jt-id')),
    rowTexts: () => holder().childNodes.map((n) => n.textContent),
    rowAt: (i) => holder().childNodes[i],
    rowIndexOf: (id) => holder().childNodes.map((n) => n.getAttribute('data-jt-id')).indexOf(id),
    pad: (i) => container.childNodes[i],
    /** 三块的总高：垫块读 style.height，行按 rowHeight 算——契约② 的外部证据就是这一个数 */
    contentHeight: () => {
      const px = (n) => Number.parseInt(n.style.height || '', 10) || 0;
      const pads = container.childNodes.filter((n) => n !== holder()).reduce((s, n) => s + px(n), 0);
      return pads + (holder() ? holder().childNodes.length * rowHeight : 0);
    },
    get activeId() { return active ? active.getAttribute('data-jt-id') : null; },
  };
}

test('V14 契约①② ：容器里只有三块常驻节点，垫块高度让总长 == 行数 × rowHeight', () => {
  const page = vTree({ rowHeight: 24 });
  const c = createTreeController({ document: page.doc, container: page.container, rowHeight: 24, windowSize: 40 });
  const rows = vSet(299);
  c.setData(rows);
  assert.equal(rows.length, 300);
  assert.deepEqual(page.container.childNodes.map((n) => n.tagName), ['DIV', 'DIV', 'DIV'],
    '常驻的就三块，一行动态节点都不许挂在这一层');
  assert.deepEqual(page.container.childNodes.map((n) => n.getAttribute('class')),
    ['jt-tree__pad', 'jt-tree__rows', 'jt-tree__pad']);
  assert.equal(page.holder().getAttribute('role'), 'tree');
  assert.equal(page.contentHeight(), 300 * 24, '上下垫块 + 窗口里的行 = 总高——"只渲染可视"唯一的外部证据');
  const el = page.rowAt(0);
  assert.deepEqual([el.tagName, el.getAttribute('role'), el.getAttribute('tabindex')], ['DIV', 'treeitem', '0']);
  assert.equal(el.getAttribute('aria-level'), '1', 'aria-level 从 1 起、depth 从 0 起，两把尺差一格');
  assert.equal(el.getAttribute('data-jt-id'), '');
  assert.equal(el.getAttribute('data-jt-pointer'), '');
  assert.equal(el.textContent, '', '根展开着：那一行只有折叠三角（CSS 给），不许挤出一句假文案');
  assert.equal(el.getAttribute('aria-expanded'), 'true', '容器行把折叠与否写在 aria-expanded 上');
  const second = page.rowAt(1);
  assert.deepEqual([second.getAttribute('data-jt-id'), second.getAttribute('aria-level'),
    second.getAttribute('data-jt-pointer'), second.textContent], ['/r0', '2', '/r0', 'r0: 0']);
  assert.equal(second.getAttribute('aria-expanded'), null, '标量行没有这一格');
  assert.deepEqual([el.style.paddingLeft, second.style.paddingLeft], ['0px', '12px'],
    '缩进写在行元素自己身上，默认一档 12px（装配层要换密度就传 indentStep）');
  const first0 = page.pad(0).style.height;
  page.container.scrollTop = 1200;
  page.container.dispatch('scroll');
  const range = c.visibleRange();
  assert.equal(page.pad(0).style.height, `${range.first * 24}px`);
  assert.equal(page.pad(2).style.height, `${(300 - range.last - 1) * 24}px`);
  assert.equal(page.contentHeight(), 300 * 24, '滚到哪里总高都不变，变的只是三块内部的分摊');
  assert.notEqual(page.pad(0).style.height, first0, '垫块真的跟着滚动走');
  assert.equal(page.rowAt(0).getAttribute('data-jt-id'), '/r39',
    '窗口上面还留着十行缓冲：滚到 1200 就是第 50 行开头，进 DOM 的第一行是第 40 行');
  const mixed = vTree({ rowHeight: 24 });
  const cm = createTreeController({ document: mixed.doc, container: mixed.container, rowHeight: 24 });
  cm.setData(flatten(vMix()));
  const cls = (id) => mixed.rowAt(mixed.rowIndexOf(id)).getAttribute('class');
  assert.ok(cls('/a').includes('is-open'), '/a 展开着');
  assert.ok(cls('/a/1').includes('is-closed'), '/a/1 折叠着');
  assert.ok(cls('/o/k').includes('is-closed'), '空容器也是一格折叠：它的概览串是 {}');
  assert.ok(cls('/s').includes('jt-tree__row--string'), 'kind 进 class，视图层照它上色');
  cm.setData(flatten(vMix(), { maxKeys: 1 }));
  assert.ok(cls('~more').includes('jt-tree__row--more'), '截断行有自己的 class');
  assert.equal(mixed.rowAt(mixed.rowIndexOf('~more')).getAttribute('role'), 'treeitem',
    '那一行是一个动作，但 `role=tree` 只认 treeitem / group 当子节点——button 挂在这一层是 ARIA 违规，'
    + '真要一颗按钮由 §W 的 treeRow 在行内再挂一层');
  assert.equal(mixed.rowAt(mixed.rowIndexOf('~more')).getAttribute('aria-expanded'), null,
    '截断行自己没有子行，不许占一格 aria-expanded');
  assert.equal(mixed.rowAt(mixed.rowIndexOf('~more')).textContent, '还有 5 个键未列出');
  // 空串键：`{ "": … }` 是合法 JSON，而按 keyLabel 空不空来判"是不是根"会把它渲染成一格空白（V14 上面
  // 那条"根那一行的 textContent 是空串"要留住，所以判据得看 depth 与截断行，不能看 keyLabel）。
  const blank = vTree({ rowHeight: 24 });
  const cb = createTreeController({ document: blank.doc, container: blank.container, rowHeight: 24 });
  cb.setData(flatten({ '': { deep: 1 }, k: { deep: 2 } }, { expanded: new Set(['', '/', '/k']) }));
  assert.deepEqual(blank.rowIds(), ['', '/', '//deep', '/k', '/k/deep'],
    '空串键的 Pointer 是 "/"，再往里是 "//deep"——pointerChild 在这一格不许省那一段');
  assert.deepEqual(blank.rowTexts(), ['', '""', 'deep: 1', 'k', 'deep: 2'],
    '根那一格还是空串，空串键那一格给成对的空引号：一行都不许是"看不见内容"的');
  // matched 那一格要落到 class 上——它是搜索高亮唯一的外部证据，纯函数级判据（V11–V13）看不到这一环
  const hl = vTree({ rowHeight: 24 });
  const ch = createTreeController({ document: hl.doc, container: hl.container, rowHeight: 24 });
  const hlRows = vAll(vHay());
  ch.setData(hlRows);
  assert.equal(searchRows(hlRows, 'ITEM').total, 1);
  ch.refresh();
  assert.ok(hl.rowAt(hl.rowIndexOf('/list/0')).getAttribute('class').includes('is-matched'),
    '命中那一行要带上 is-matched：视图层的底色就认这一个 class');
  assert.ok(!hl.rowAt(hl.rowIndexOf('/n')).getAttribute('class').includes('is-matched'),
    '没命中的不许跟着沾色');
  searchRows(hlRows, '没有这一格');
  ch.refresh();
  assert.ok(!hl.rowAt(hl.rowIndexOf('/list/0')).getAttribute('class').includes('is-matched'),
    '下一轮搜空了要洗掉：残留的高亮比没有高亮更骗人');
  // 缩进那一格是注入的，不是写死的：换密度只换 indentStep，行属性表其余各格一个字都不动
  const tight = vTree({ rowHeight: 24 });
  const ct = createTreeController({ document: tight.doc, container: tight.container, rowHeight: 24, indentStep: 0 });
  ct.setData(flatten(vMix()));
  assert.deepEqual([tight.rowAt(0).style.paddingLeft, tight.rowAt(1).style.paddingLeft, tight.rowAt(6).style.paddingLeft],
    ['0px', '0px', '0px'], 'indentStep=0 就是一格都不缩，但 aria-level 照旧');
  assert.equal(ct.state().indentStep, 0, 'state() 要把这一格交回去：装配层的读数要说当前密度');
  const wide = vTree({ rowHeight: 24 });
  const cw = createTreeController({ document: wide.doc, container: wide.container, rowHeight: 24, indentStep: 30 });
  cw.setData(flatten(vMix()));
  assert.deepEqual([wide.rowAt(0).style.paddingLeft, wide.rowAt(1).style.paddingLeft, wide.rowAt(6).style.paddingLeft],
    ['0px', '30px', '60px'], 'depth × indentStep：/a/0 是第 2 层，所以 60px');
  assert.equal(wide.rowAt(6).getAttribute('aria-level'), '3', '缩进换了，aria-level 跟着 depth 走、不跟着像素走');
  cm.setData([]);
  assert.deepEqual(cm.visibleRange(), { first: -1, last: -1, count: 0 }, '空行集：区间用 -1 表达"没有"');
  assert.deepEqual([mixed.rowCount(), mixed.contentHeight()], [0, 0], '两块垫块都得归零，不然滚动条留着骗人');
  assert.equal(mixed.container.childNodes.length, 3, '空数据也不许把三块拆了');
});

test('V15 契约③：五千行、任意 scrollTop，一次进 DOM 的行数不超过 windowSize 且窗口盖住视口首行', () => {
  const total = 5000;
  const rowHeight = 20;
  const windowSize = RENDER_WINDOW;
  const page = vTree({ rowHeight });
  const calls = [];
  const c = createTreeController({
    document: page.doc, container: page.container, rowHeight, windowSize,
    onViewChange: (p) => calls.push(p),
  });
  c.setData(vSet(total - 1));
  assert.equal(c.state().total, total);
  assert.equal(c.state().windowSize, windowSize, '窗口那一格要在 state() 里读得回来：装配层的文案要说"一次渲染 80 行"');
  let maxNodes = 0;
  for (let i = 0; i < total; i += 37) {
    page.container.scrollTop = i * rowHeight;
    page.container.dispatch('scroll');
    const n = page.rowCount();
    maxNodes = Math.max(maxNodes, n);
    const r = c.visibleRange();
    assert.ok(n <= windowSize, `第 ${i} 行处渲染了 ${n} 行，越过 windowSize=${windowSize}`);
    assert.ok(r.first <= i && i <= r.last, `视口首行 ${i} 不在窗口 [${r.first}, ${r.last}] 里`);
    assert.equal(r.last - r.first + 1, n, 'visibleRange 报的区间必须就是 DOM 里的行数，两处一把尺');
    if (i > 0) {
      assert.equal(page.rowAt(i - r.first).getAttribute('data-jt-id'), `/r${i - 1}`,
        `窗口里第 ${i} 行那一格的 id 与行序对不上`);
    }
  }
  assert.equal(maxNodes, windowSize, '窗口是用满的：判据要的是"上界卡住"，不是"少渲染"');
  page.container.scrollTop = 10 ** 9;
  page.container.dispatch('scroll');
  assert.deepEqual(c.visibleRange(), { first: total - windowSize, last: total - 1, count: windowSize }, '越界往下滚就贴底');
  page.container.scrollTop = -5;
  page.container.dispatch('scroll');
  assert.deepEqual(c.visibleRange(), { first: 0, last: windowSize - 1, count: windowSize }, '越界往上滚就贴顶');
  const before = calls.length;
  page.container.scrollTop = 4000;
  page.container.dispatch('scroll');
  assert.equal(calls.length, before + 1, '窗口区间换了才叫这一次');
  page.container.scrollTop = 4010;
  page.container.dispatch('scroll');
  assert.equal(calls.length, before + 1,
    '同一区间的两个 scrollTop（4000 与 4010 都从第 200 行起）别再刷读数：装配层每叫一次都要重算一行状态');
  assert.deepEqual(calls[calls.length - 1], { first: 180, last: 259, count: 80, total, scrollTop: 4000 });
  const small = vTree({ rowHeight });
  const cs = createTreeController({ document: small.doc, container: small.container, rowHeight, windowSize });
  cs.setData(vSet(4));
  assert.deepEqual(cs.visibleRange(), { first: 0, last: 4, count: 5 }, '数据比窗口短就全渲染');
  assert.deepEqual([small.pad(0).style.height, small.pad(2).style.height], ['0px', '0px']);
  assert.equal(small.rowCount(), 5);
  assert.equal(small.contentHeight(), 5 * rowHeight);
});

test('V16 契约④：锚点与焦点只认 id，setExpanded 抓"行集与展开集不同轮"，destroy 摘干净', () => {
  const rowHeight = 24;
  const windowSize = 40;
  const page = vTree({ rowHeight });
  const c = createTreeController({ document: page.doc, container: page.container, rowHeight, windowSize });
  c.setData(vSet(4999));
  assert.equal(c.scrollToPointer('/r2500'), true);
  assert.equal(page.container.scrollTop, 2501 * rowHeight,
    '落点精确到那一行的行首：/r2500 是第 2501 行（第 0 行是根），所以滚到 2501 × 行高');
  assert.equal(c.state().anchorId, '/r2500');
  assert.equal(c.visibleRange().first, 2491, '窗口上面留着十行缓冲，所以进 DOM 的第一行比锚点早十行');
  assert.equal(page.rowAt(10).getAttribute('data-jt-id'), '/r2500', '锚点那一行确实在窗口里，不是只改了个 scrollTop');
  assert.equal(c.scrollToPointer('/nope'), false, '行集里没有的那一格：不动滚动，回报 false');
  assert.equal(page.container.scrollTop, 2501 * rowHeight);
  assert.equal(c.scrollToPointer(''), true, '根永远在第 0 行');
  assert.equal(page.container.scrollTop, 0);
  c.scrollToPointer('/r2500');
  c.setData(vSet(4999, true));
  assert.equal(page.container.scrollTop, 2502 * rowHeight, '锚点前面插了一行，scrollTop 就跟着补一行——不然锚点落到别人那格');
  assert.equal(page.rowAt(10).getAttribute('data-jt-id'), '/r2500', '窗口里那十行缓冲之后，锚点还是这一条数据');
  assert.equal(c.state().anchorId, '/r2500');
  c.scrollToPointer('/r3000');
  c.setData(vSet(10));
  assert.equal(c.state().anchorId, '/r3000', '锚点那一行这轮没了也照样记着，等它回来');
  assert.equal(page.container.scrollTop, (11 - 1) * rowHeight, '行集缩到 11 行，滚动条贴到最底那一格，不许悬在半空');
  assert.equal(page.rowCount(), 11, '行集比窗口短就全渲染');
  c.setData(vSet(4999));
  c.scrollToPointer('/r20');
  const focused = page.rowAt(10);
  assert.equal(focused.getAttribute('data-jt-id'), '/r20');
  focused.focus();
  c.refresh();
  assert.notEqual(page.doc.activeElement, focused, 'refresh 重建了节点，被点的那个旧节点已经不在树里');
  assert.equal(page.activeId, '/r20', '焦点跟着 id 回来，而不是被丢回 body');
  assert.equal(page.focusLog.length, 2, '一次是人点的、一次是控制器交回的，不许多补');
  const rows = flatten(vMix());
  c.setData(rows);
  c.setExpanded(new Set(['', '/a', '/o']));
  assert.throws(() => c.setExpanded(new Set([''])),
    (e) => e instanceof TypeError && /展开集/.test(e.message) && /行集/.test(e.message),
      '行集里 /a 与 /o 是展开的，喂进来的展开集却没有——这是不同轮的两份东西，当场点名');
  c.setExpanded(new Set(['', '/a', '/o']));
  assert.equal(c.state().expanded.size, 3, '同一份喂两次总是合法');
  assert.throws(() => c.setData('not rows'), TypeError, 'setData 只收 flatten 交回的行集');
  assert.throws(() => c.setData([{ id: 1 }]), TypeError,
    '行集里那一格不是行对象：当场点名，别渲染出一树 undefined');
  assert.equal(c.state().total, rows.length, '闸门抛在改状态之前：行集还是上一轮那一份');
  c.destroy();
  assert.deepEqual(page.container.childNodes, [], '常驻三块都得摘干净');
  assert.equal(page.container.listenerCount('scroll'), 0, 'scroll 监听留在页上就是给下一次 mount 叠一份');
  c.destroy();
  page.container.scrollTop = 100;
  page.container.dispatch('scroll');
  assert.equal(page.container.childNodes.length, 0, '拆完之后的事件不许复活任何节点');
  const gatePage = vTree({ rowHeight });
  assert.throws(() => createTreeController({ container: gatePage.container, rowHeight: 24 }),
    (e) => e instanceof TypeError && /document/.test(e.message));
  assert.throws(() => createTreeController({ document: gatePage.doc, rowHeight: 24 }),
    (e) => e instanceof TypeError && /container/.test(e.message));
  assert.throws(() => createTreeController({ document: {}, container: gatePage.container, rowHeight: 24 }), TypeError);
  assert.throws(() => createTreeController({ document: gatePage.doc, container: {}, rowHeight: 24 }), TypeError);
  for (const bad of [0, -1, NaN, Infinity, '24', undefined, null]) {
    assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container, rowHeight: bad }),
      (e) => e instanceof TypeError && /rowHeight/.test(e.message), `${bad} 不是合法的 rowHeight`);
  }
  for (const bad of [0, -1, 2.5, NaN]) {
    assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container,
      rowHeight: 24, windowSize: bad }), (e) => e instanceof RangeError && /windowSize/.test(e.message));
  }
  assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container,
    rowHeight: 24, onViewChange: 42 }), TypeError);
  assert.equal(gatePage.container.childNodes.length, 0, '闸门抛在挂节点之前，别留下半棵树');
});

test('V17 选项袋只认对象字面量：把展开集直接塞进第二格要当场抛，不许静默走默认档', () => {
  const chain = { l1: { l2: { l3: 'end' } } };
  // 数组与 Set 都过得了 `typeof === 'object'` 那一关，于是 flatten(v, new Set([''])) 会当成"没给选项"
  // 走默认档——同一份写错的调用在 expandOf 那里是抛的（第三格要布尔、id 要字符串），两把尺不一样长
  // 就是装配层迟早踩的那种坑：它看着绿，只是错了三行。
  class Config { constructor() { this.expanded = new Set(['', '/l1']); } }
  for (const [label, bad] of [['数组', ['/l1']], ['Set', new Set(['', '/l1'])], ['Map', new Map()],
    ['类实例', new Config()]]) {
    assert.throws(() => flatten(chain, bad),
      (e) => e instanceof TypeError && /第二格/.test(e.message), `${label} 不是 { expanded, maxKeys } 那个形状`);
  }
  assert.deepEqual(flatten(chain, Object.create(null)).map((r) => r.pointer), ['', '/l1', '/l1/l2'],
    'null 原型那一份照样收：这一格判的是"是不是一个空的选项袋"，不是"是不是 {…} 写出来的"');
  assert.deepEqual(flatten(chain, { expanded: new Set(['', '/l1']) }).map((r) => r.pointer),
    ['', '/l1', '/l1/l2'], '对象字面量那一档是正对照：闸门不许把合法调用一起拦掉');
  const rows = vSet(3);
  for (const bad of [['数组', ['key']], ['Set', new Set(['key'])]]) {
    assert.throws(() => searchRows(rows, 'r1', bad[1]),
      (e) => e instanceof TypeError && /第三格/.test(e.message), `searchRows 那一格同一条尺：${bad[0]}`);
  }
  assert.deepEqual(searchRows(rows, 'r1', Object.create(null)), { matchedIds: ['/r1'], total: 1, truncated: 0 },
    'scope 不给就走 both（null 原型的选项袋不是错误）：这一格命中只可能是键那一半给的');
  assert.equal(searchRows(rows, 'r1', { scope: 'value' }).total, 0,
    '同一份搜索词换成只搜值就一格不中：both 确实生效了，不是"闸门放行了一切"');
});

test('V18 真浏览器会替自写的 scrollTop 补发一次 scroll：那一次回声不许换锚点、也不许重画一遍', () => {
  const rowHeight = 24;
  const windowSize = 40;
  const page = vTree({ rowHeight });
  const c = createTreeController({ document: page.doc, container: page.container, rowHeight, windowSize });
  c.setData(vSet(4999));
  c.scrollToPointer('/r2500');
  page.container.dispatch('scroll');
  assert.equal(c.state().anchorId, '/r2500',
    'V16 那条"锚点留着等它回来"在真浏览器里只有一句承诺：回声事件把 scrollTop 之外的东西改掉了，判据就得自己补这一次');
  assert.equal(page.container.scrollTop, 2501 * rowHeight, '回声也不许把落点改写走');

  // 行集缩到比锚点短：scrollTop 被夹回范围内，紧跟着的那一次回声照样不该把锚点换成"新的视口首行"
  c.setData(vSet(10));
  assert.equal(page.container.scrollTop, (11 - 1) * rowHeight, '夹还是要夹，那一格是滚动条的边界，不是锚点的');
  page.container.dispatch('scroll');
  assert.equal(c.state().anchorId, '/r2500', '夹过之后补发的回声不许把 /r2500 判成"用户滚到了第 10 行"');
  c.setData(vSet(4999));
  assert.equal(page.container.scrollTop, 2501 * rowHeight, '行集长回来要带回原处——这就是契约④那句"折叠→展开不漂"');

  // 回声之外的那一次是用户滚的：视口首行换了人，锚点必须跟着换（否则 V16 那族判据就白钉了）
  page.container.scrollTop = 100 * rowHeight;
  page.container.dispatch('scroll');
  assert.equal(c.state().anchorId, '/r99', '真滚动之后锚点就是视口首行那一格');

  // 焦点交回带 preventScroll：窗口上面那十行缓冲在视口外，裸 focus() 会把视口为它拽上去
  page.container.scrollTop = 1200;
  page.container.dispatch('scroll');
  assert.equal(page.rowAt(0).getAttribute('data-jt-id'), '/r39', '窗口第一行比视口首行早十行');
  page.rowAt(0).focus();
  c.refresh();
  assert.deepEqual(page.focusLog[page.focusLog.length - 1], ['/r39', { preventScroll: true }],
    '交回焦点要带 preventScroll：不然这一次 focus 自己就是一第三次滚动');
  assert.equal(page.activeId, '/r39', '焦点还是按 id 回来的');

  // 回声不重画：render 已经在 setData / scrollToPointer 里做过一次，再来一次就是白拆一遍节点
  const churn = vTree({ rowHeight });
  let built = 0;
  const rawCreate = churn.doc.createElement;
  churn.doc.createElement = (tag) => { built += 1; return rawCreate(tag); };
  const cc = createTreeController({ document: churn.doc, container: churn.container, rowHeight, windowSize });
  const base = built;
  cc.setData(vSet(499));
  const afterSet = built;
  churn.container.dispatch('scroll');
  assert.equal(built, afterSet, '自己写出去的那一次 scrollTop，回声到了不许再建一遍行节点');
  assert.ok(afterSet > base, '正对照：setData 自己确实是建过节点的');
});

test('V19 renderRow 那一格：给了就只叫它，控制器自己一个字都不写；结构照旧，抛错不吞', () => {
  const seen = [];
  const page = vTree();
  const c = createTreeController({
    document: page.doc, container: page.container, rowHeight: 24,
    renderRow: (el, row) => { seen.push(row.id); el.innerHTML = `<b>${row.id}</b>`; },
  });
  c.setData(flatten({ a: 1, b: { c: 2 } }));
  const rows = page.holder().childNodes;
  assert.ok(rows.length > 0, '给了 renderRow 结果一行都没长：那是 §W 的树视图整个空着');
  assert.deepEqual(seen, page.rowIds(), 'renderRow 按行进 DOM 的顺序叫，叫的是窗口里那几行');
  assert.deepEqual(rows.map((n) => n.innerHTML), rows.map((n) => `<b>${n.getAttribute('data-jt-id')}</b>`),
    '行内那串只许出自回调：控制器再写一遍就是两处写、一处赢');
  assert.deepEqual(rows.map((n) => n.textContent), rows.map(() => ''),
    '给了 renderRow 之后控制器不许再碰 textContent——两处写法的先后决定用户看见哪一个');
  // 结构那一半照旧：renderRow 只管行内，attribute / 缩进 / role 还是控制器的（§W 的分工写在文件头）
  assert.equal(rows[0].getAttribute('role'), 'treeitem');
  assert.equal(rows[0].getAttribute('data-jt-pointer'), '');
  assert.ok(rows.every((n) => /px$/.test(n.style.paddingLeft)), '缩进仍按 depth 写在这一格自己的 style 上');
  // 正对照：不给这一格就走原来那条 textContent 的路。根那一行是**空的**——`rowText` 对 depth 0 只给 display，
  // 而展开中的容器 display 是空串；这正是 §W 的 treeRow 要接管行内的理由（它给那一格写「根」）。
  const plain = vTree();
  createTreeController({ document: plain.doc, container: plain.container, rowHeight: 24 })
    .setData(flatten({ a: 1 }));
  assert.deepEqual(plain.rowTexts(), ['', 'a: 1'], '不给 renderRow 时一个字都不许多：这一条路是默认档，不是废弃档');
  assert.equal(plain.holder().childNodes[0].innerHTML, undefined);
  assert.throws(() => createTreeController({
    document: vTree().doc, container: vTree().container, rowHeight: 24, renderRow: 5,
  }), (e) => e instanceof TypeError && /renderRow/.test(e.message), '非函数的 renderRow 静默回退 textContent，页面上是"树在但样式没接上"');
  const boom = vTree();
  const bad = createTreeController({
    document: boom.doc, container: boom.container, rowHeight: 24,
    renderRow: () => { throw new Error('行内生成器坏了'); },
  });
  assert.throws(() => bad.setData(flatten({ a: 1 })), /行内生成器坏了/,
    '吞掉回调的错，页面就是一棵没人知道为什么空着的树；装配层那一侧有 runGuarded 接得住');
});

// ── §W JSON 工作台视图层与装配层（`tools/jsonView.js` / `tools/jsonWorkbench.js` / `toolJson.js`，段 4 Task 6）──
//
// 这一节测的是**这一页怎么接起来**，不是四本纯模块对不对（§S–§V 各管各的）。三方全接真的：
// 视图层吃真的 `window.Tk.view`，装配层调真的 `json-core` / `json-ts` / `json-convert` / `json-tree`，
// 骨架由本节自建的 `wPage` 长出——照 §V 而不是 §R 那条"复用 §I 的 `iPage`"，因为这一页要的四样
// （`checked` / `setSelectionRange` / `scrollTop`+`scrollLeft` / `innerHTML` 只当普通属性读）
// §I 那份一件都没有，而"补进 §I"等于把证件页与编码页三节的夹具一起改动。
//
// 六条红线，判据围着它们转：
//
// 1. **视图层零 import**（W2）。`jsonView.js` 与 `view.js` / `codecView.js` 同一条红线：它一旦 import
//    什么，两个入口 reach 同一模块 → Rollup 提共享 chunk → iife-wrap 之后产物里是 `import{…}` →
//    整页 SyntaxError 而构建 exit=0（`toolkitCore.js:5-9` 记的正是这个坑，牙齿在门禁④）。
// 2. **环境只在入口**（W10、W11）。`Date.now(` / `localStorage` / `URL.createObjectURL` / `URL.revokeObjectURL` /
//    `win.Blob` / `setTimeout(` / `win.navigator` 七个词在装配层源码里 0 命中、在入口那一份各**恰好一处**；
//    `window` / `globalThis` / `querySelector` 两本都 0 命中。`getComputedStyle` 分两档：装配层 0 命中、
//    入口**恰好一处**——行号槽与树行高那把尺由 Task 7 的入口读样式上的 `--jt-row-h` 一次再注入
//    `env.rowHeight`，读不到就落装配层那个 `ROW_HEIGHT = 24` 的退路值（它是样式给的环境量，在本层读
//    一次就要在夹具里多造一件假件，W10 那条判据会从判据退化成注释）。
//    `js-yaml` 那本内置件只许被 `json-convert.js` 够一次，`json-convert.js` 只许被装配层够一次——
//    两跳各一枚（W11 数的是 import 语句，不是文件名出现次数），入口与装配层都不许直接够内置件。
// 3. **id 只由 spec 派生**（W13、W18、W19）。八枚 helper 是唯一的地址来源，`controlIds(prefix)` 与 `JSON_SPEC`
//    与 `JSON_ACTIONS` 三个方向对账；夹具的节点清单也从它们长，不在本节重抄一份 id 表。
//    W19 把八枚 helper 的**产出字面量**逐个钉死——门禁⑤ 在产物里只正则拼 `-in-` 那一族（`check-tools-surface.mjs:479`），
//    其余七族写错只有这一判会红。
// 4. **挂载期一次计算都不做**（W14、W16）。`mount()`（`renderers.workbench` 就是叫它）只接线与画空态；
//    解析只在按动作时发生，所以 20 次 `input` 之后注入的 `runGuarded` 计数必须是 0（W16）。
// 5. **两类失败分两条路**（W14）。用户那一格不能用 → `FieldError` → 结果区一句提示，别的什么都不塌；
//    模块或骨架自己抛的 → 原样上抛，交给注入的 `runGuarded` 记"这一块坏了"。
// 6. **记住上次输入默认关**（W15）。`jt.memory.on` 那一格总写（否则这功能等于没有），
//    `jt.memory.input` 只在开关为 on 时写，正文超过 256 KiB 就连那一格都不写、改在读数里说明。
//
// 六条红线之外，W20–W27 这八判咬的是**只有真按一遍才看得见**的那一族形状：十二枚动作各
// 画得出哪一栏（W20）、树容器上 Pointer 那一支赢过展开那一支（W21）、下载的文件名与 MIME 跟着当前类别
// 且摘节点/撤 URL 排在 `finally`（W22）、存储一碰就抛时页面照样起（W23，评审 P0-2 的隐私模式）、两枚
// 复制按钮各改各的口且连点不把"已复制"转正（W24）、换输入与坏输入要拆掉旧树（W25）、那一族代价说明要
// 上得了页面（W26）、读条只取窗口而整行进不了 DOM（W27）。
//
// 三条夹具口径与 §R 同形：每一判从**按真的按钮 / 派发真的事件**起步；`type` → 标签的映射由 spec
// 反推，spec 里长出词汇表外的 `type` 夹具当场抛；`innerHTML` 在假 DOM 上只长成一个普通属性，
// 所以本节读的就是那一串文本——那也正是真页面唯一吃进 HTML 的地方。
const {
  createJsonView, JT_TONES, JSON_VIEW_LABELS, OUT_KINDS,
} = await import('../dev/js/tools/jsonView.js');
const {
  createJsonWorkbench, JSON_SPEC, JSON_PANEL_IDS, JSON_ACTIONS,
  controlIds: wControlIds, fieldId: wField, buttonId: wButton, copyId: wCopy,
  outId: wOut, whenId: wWhen, gutterId: wGutter, statusId: wStatus, treeId: wTree,
} = await import('../dev/js/tools/jsonWorkbench.js');
// 四本纯模块的名字**不在这儿重抄一遍**：`CORE_NOTES` / `MAX_JSON_BYTES` / `gate` / `parseJson` /
// `formatJson`（§S）、`TS_HEADER_NOTE`（§T）、`YAML_NOTES` / `XML_CONVENTION` / `CSV_NOTES`（§U）、
// `RENDER_WINDOW`（§V）已经是本文件的顶层名，本节直接吃上面那几行 import 的结果。
// 再 import 一次不是风格问题：`MAX_INPUT_BYTES` 有两个不同的值（§L 的 1 MiB 与 JSON 的 5 MiB），
// 顶层重名会让其中一档静默变成另一档的数——§S 那行别名注释写的就是这件事。

/** spec 的 `type` → 骨架标签：这一页比编码页多一枚 `checkbox`，词汇表外当场抛（同 R 那条口径） */
const W_TAGS = { text: 'input', area: 'textarea', select: 'select', checkbox: 'input' };
const wTag = (type) => {
  const tag = W_TAGS[type];
  if (!tag) throw new Error(`夹具：JSON_SPEC 里出现了词汇表外的 type「${String(type)}」（认得 ${Object.keys(W_TAGS).join(' / ')}）`);
  return tag;
};

/** 结果区与状态读数的栏位名：这一页只有一栏，工具栏那十四枚按钮的 `side` 位用的是动作 key */
const W_OUT_SIDES = ['main'];

/** 剥注释再剥字符串字面量：报错文案与 JSDoc 里的字样都不算命中（与 §R 的 `rBare` 同一形状） */
const wBare = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
/** 只剥注释（判 import 边时用：字符串里的路径要留着） */
const wCode = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/**
 * 摘出**以 `mark` 起头**的字符串字面量（评审 P0-1：旧口径只数 `'jt-`，模板串与双引号里的地址一概漏网，
 * 而装配层派生地址时写错的那一枚恰恰是 `` `jt-…` `` 这种形状）。
 * 只挑"整格以 `mark` 起头"的那些：`<pre class="jt-out__body">` 那种是排版，第一个字符是 `<`，
 * 与本条红线（地址只由那八枚 helper 派生）无关。
 * 第二格 `mark` 是给 §Z 复用的：那一页的前缀是 `df`，而**同一件事只该有一把尺**——再造一本
 * `zHandTypedIds` 就是"两本里有一本漂了也没人红"的那种形状（X4 第一轮抓到的同族病）。
 * @param {string} rel 源码路径
 * @param {string} [mark] 要挑的地址前缀，默认 JSON 页的 `jt-`
 * @returns {string[]} 命中的字面量原文
 */
const wHandTypedIds = (rel, mark = 'jt-') => {
  const hits = [];
  wCode(rel).replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (s) => {
    if (s.slice(1, 1 + mark.length) === mark) hits.push(s);
    return "''";
  });
  return hits;
};
/** 三种引号的 import 都算一次（W11 数的是"谁够到了那一本"，引号是风格不是事实） */
const wImports = (rel) => [...wCode(rel).matchAll(/\bfrom\s+(['"`])([^'"`]+)\1/g)].map((m) => m[2]);
const wCount = (hay, needle) => hay.split(needle).length - 1;
/** HTML 串里摘某一段：假 DOM 没有 querySelector，本节按类名把那一块切出来读 */
const wSlice = (html, cls) => {
  const at = html.indexOf(`class="${cls}"`);
  if (at < 0) return null;
  const open = html.lastIndexOf('<', at);
  const close = html.indexOf('</', at);
  return { tag: /^<(\w+)/.exec(html.slice(open))[1], inner: html.slice(html.indexOf('>', at) + 1, close < 0 ? html.length : close) };
};
/** 属性值：只在视图层那几件的产出串上找（`style="…"` / `data-jt-copy="…"`） */
const wAttr = (html, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};

/** JSON 视图层要注入的那份 `Tk.view`：本节一律接真的 */
const W_VIEW = { esc: J_VIEW.esc, EMPTY_CELL: J_VIEW.EMPTY_CELL };
/** 视图层产出的串里，用户文本一律经过这一只：判据按它算期望，转义表本身归 §O 判 */
const wEsc = W_VIEW.esc;

/** 一个合法的坏样本：三行输入、第三行那个多余的逗号是病灶 */
const W_BAD = () => {
  const text = '{\n  "a": 1,\n  "b": 2,,\n}';
  const err = parseJson(text).error;
  return { text, err };
};

// ── 假 DOM：JSON 这一页自己的一份（§I 那份缺 `checked` / `setSelectionRange` / 滚动两格） ──

/**
 * 造一页骨架：提示行 + 工作台容器 + 按 `JSON_SPEC` 长出的六枚控件、行号槽、树容器、状态读数、
 * 结果区，再按 `JSON_ACTIONS` 长出十四枚按钮与那一枚复制按钮。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀（W13 的 `zx` 那一档量的就是它）
 * @param {Record<string, string|boolean>} [o.seed] `'panel:control' → 初值`（挂载前就在 DOM 上）
 * @param {string[]} [o.drop] **不**要长的 id，造"骨架缺一格"那一类缺陷
 * @param {number} [o.rowHeight] 注入给控制器的那一行高，默认 24
 * @returns {object} 节点表 + 观察口（`set` / `input` / `click` / `html` / `text` / `sel` / `made`）
 */
function wPage({ prefix = 'jt', seed = {}, drop = [], rowHeight = 24 } = {}) {
  const nodes = new Map();
  const created = { list: [] };
  const sel = [];
  const selects = [];
  const focusLog = [];
  const mk = (tag, id = '', attrs = {}) => {
    const el = {
      nodeType: 1, tagName: String(tag).toUpperCase(), id, hidden: false, disabled: false,
      value: '', checked: false, innerHTML: '', files: undefined, style: {}, scrollTop: 0, scrollLeft: 0,
      parentNode: null,
      attrs: new Map(), childNodes: [], listeners: new Map(),
      get firstChild() { return this.childNodes.length > 0 ? this.childNodes[0] : null; },
      get textContent() { return this.childNodes.map((c) => c.textContent).join(''); },
      set textContent(v) { this.childNodes = v === '' ? [] : [mkText(v)]; },
      getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; },
      setAttribute(n, v) { this.attrs.set(n, String(v)); },
      removeAttribute(n) { this.attrs.delete(n); },
      // 只认 `[attr]` 这一种选择器：装配层的树代理用到的就只有这两种形状，多支持一件就是夹具悄悄
      // 给了真页面没有的能力。往**上**走靠 appendChild 维护的那一格 `parentNode`。
      closest(sel) {
        const name = /^\[([\w-]+)\]$/.exec(String(sel));
        if (!name) return null;
        for (let cur = this; cur; cur = cur.parentNode) {
          if (cur.attrs && cur.attrs.has(name[1])) return cur;
        }
        return null;
      },
      appendChild(c) { this.childNodes.push(c); c.parentNode = this; return c; },
      insertBefore(c, ref) {
        const at = this.childNodes.indexOf(ref);
        if (at < 0) this.childNodes.push(c); else this.childNodes.splice(at, 0, c);
        c.parentNode = this;
        return c;
      },
      removeChild(c) {
        const at = this.childNodes.indexOf(c);
        if (at < 0) throw new Error('removeChild：这个节点不在里面');
        this.childNodes.splice(at, 1);
        c.parentNode = null;
        return c;
      },
      addEventListener(t, fn) {
        if (!this.listeners.has(t)) this.listeners.set(t, []);
        this.listeners.get(t).push(fn);
      },
      dispatch(t, evt = {}) {
        for (const fn of this.listeners.get(t) || []) fn(evt);
        return evt;
      },
      // 真 DOM 的 `el.click()` 会派发一个真的 `click`：下载那一格靠它，所以这里同形而不是再添一个观察口
      click() { return this.dispatch('click', {}); },
      focus(arg) { focusLog.push([this.id, arg]); },
      // `Tk.ui.legacyCopy` 那一级要摸这一根手指：没有它，兜底那一档在 §W 里永远走不到
      // （它抛在 `legacyCopy` 自己的 try 里，于是"execCommand 在也复制不上"会伪装成"这一级本来就失败"）。
      // 单独记一笔，不混进 `sel`：那一串量的是"装配层有没有抢用户的选区"，与兜底复制无关。
      select() { selects.push(this.id); },
      setSelectionRange(a, b, dir) { sel.push([a, b, dir]); },
      scrollIntoView() { sel.push(['scrollIntoView', this.id]); },
    };
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'hidden') el.hidden = v; else el.setAttribute(k, v);
    }
    if (id !== '') nodes.set(id, el);
    return el;
  };
  const mkText = (text) => ({ nodeType: 3, tagName: '#text', textContent: String(text) });
  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => { const el = mk(tag); created.list.push(el); return el; },
    createTextNode: (text) => mkText(text),
    body: mk('body'),
    activeElement: null,
  };
  const gone = new Set(drop);
  const want = (id) => (gone.has(id) ? null : mk('div', id));

  want(`${prefix}-notice`);
  const box = want(`${prefix}-workspace`);
  if (box) {
    box.setAttribute('data-jt-ids', JSON_PANEL_IDS.join(','));
    box.setAttribute('data-jt-prefix', prefix);
    box.setAttribute('data-jt-label', 'JSON 工作台');
    box.setAttribute('data-jt-notice', `${prefix}-notice`);
  }
  for (const panel of JSON_PANEL_IDS) {
    const sides = JSON_SPEC[panel].sides;
    for (const side of W_OUT_SIDES) {
      const cfg = sides[side];
      if (!cfg) continue;
      for (const c of cfg.controls) {
        const id = wField(prefix, panel, c.id);
        if (gone.has(id)) continue;
        const el = mk(wTag(c.type), id);
        if (c.type === 'select') {
          const ph = mk('option');
          ph.setAttribute('value', '');
          ph.textContent = '占位';
          el.appendChild(ph);
          for (const opt of c.options ?? []) {
            const o = mk('option');
            o.setAttribute('value', opt);
            o.textContent = opt;
            el.appendChild(o);
          }
        }
        const at = `${panel}:${c.id}`;
        if (c.type === 'checkbox') { if (seed[at] !== undefined) el.checked = seed[at] === true; }
        else if (seed[at] !== undefined) el.value = String(seed[at]);
      }
      for (const tg of cfg.switch?.targets ?? []) {
        const id = wWhen(prefix, panel, tg.key);
        if (gone.has(id)) continue;
        const p = mk('p', id);
        p.setAttribute('data-jt-when', tg.when.join(' '));
        // 搜索那一组住在显隐段里：那一格控件的 id 已经由 controls 长过，这里只挂个父节点
        const q = doc.getElementById(wField(prefix, panel, 'query'));
        if (q) p.appendChild(q);
      }
      want(wOut(prefix, panel, side));
      want(wStatus(prefix, panel, side));
      want(wTree(prefix, panel, side));
      const cb = want(wCopy(prefix, panel, side));
      if (cb) cb.textContent = '复制这一栏';
    }
    // 行号槽跟着输入那一格长：它的 id 由 `gutterId` 派生，页面源与装配层都不许再手打一遍
    const g = want(wGutter(prefix, panel, 'doc'));
    if (g) g.setAttribute('aria-hidden', 'true');
  }
  for (const a of JSON_ACTIONS) {
    const id = wButton(prefix, JSON_PANEL_IDS[0], a.key);
    if (gone.has(id)) continue;
    mk('button', id).textContent = a.label;
  }
  const treeBox = doc.getElementById(wTree(prefix, JSON_PANEL_IDS[0], 'main'));
  if (treeBox) { treeBox.scrollTop = 0; treeBox.rowHeight = rowHeight; }

  const ctl = (panel, control) => doc.getElementById(wField(prefix, panel, control));
  const set = (panel, control, v) => { ctl(panel, control).value = String(v); };
  const check = (panel, control, v) => { ctl(panel, control).checked = v; };
  const input = (panel, control) => ctl(panel, control).dispatch('input', {});
  const change = (panel, control) => ctl(panel, control).dispatch('change', {});
  const click = (key) => doc.getElementById(wButton(prefix, JSON_PANEL_IDS[0], key)).dispatch('click', {});
  const clickCopy = () => {
    const el = doc.getElementById(wCopy(prefix, JSON_PANEL_IDS[0], 'main'));
    if (el) el.dispatch('click', {});
  };
  const html = (which = 'main') => {
    const el = doc.getElementById(wOut(prefix, JSON_PANEL_IDS[0], which));
    return el ? String(el.innerHTML) : '';
  };
  const text = (id) => { const el = doc.getElementById(id); return el ? el.textContent : null; };
  return {
    doc, nodes, mk, box, sel, selects, focusLog, created,
    htmlOf: html, text,
    ctl, set, check, input, change, click, clickCopy, html,
    attr: (id, name) => { const el = doc.getElementById(id); return el ? el.getAttribute(name) : null; },
    made: () => created.list.length,
    madeOf: (tag) => created.list.filter((el) => el.tagName === String(tag).toUpperCase()),
    tree: treeBox,
    gutter: () => doc.getElementById(wGutter(prefix, JSON_PANEL_IDS[0], 'doc')),
    status: () => doc.getElementById(wStatus(prefix, JSON_PANEL_IDS[0], 'main')),
    notice: doc.getElementById(`${prefix}-notice`),
  };
}

/** 假 storage：`log` 记每一次 `setItem` 的键，关着那一档就要数它 */
function wStore(init = {}) {
  const map = new Map(Object.entries(init));
  const log = [];
  return {
    map, log,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); log.push(k); },
    removeItem: (k) => { map.delete(k); log.push(`-${k}`); },
  };
}

/** 下载那三件的注入替身：`Blob` 收块与类型，两条 URL 各记一次 */
function wDownload() {
  const blobs = [];
  const urls = { made: [], revoked: [] };
  let n = 0;
  return {
    blobs, urls,
    BlobCtor: (parts, options) => { blobs.push({ parts, options }); return { __blob: blobs.length }; },
    createObjectURL: (blob) => { n += 1; const u = `blob:w-${n}`; urls.made.push([u, blob]); return u; },
    revokeObjectURL: (u) => { urls.revoked.push(u); },
  };
}

/**
 * 接一页：`wPage` 长骨架，`createJsonWorkbench` 接装配层，注入的 `runGuarded` 既数调用也记"这一格抛了"。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {Record<string, string|boolean>} [o.seed] 控件初值
 * @param {string[]} [o.drop] 骨架要缺的 id
 * @param {object} [o.storage] 假 storage，缺席就是"这台浏览器不给存"
 * @param {object} [o.dl] `wDownload()` 的那份，缺席就是不注入下载三件
 * @param {number|null} [o.now] 注入时钟，`null` 代表故意缺席
 * @param {number} [o.rowHeight] 行高
 * @param {boolean} [o.exec] 给假 `document` 装一根 `execCommand`（复制的第二级退路，W24 量的就是它）
 * @param {Function} [o.stub] 换掉某一本纯模块（W14 用它造"模块自己抛"那一档）
 * @returns {object} `{ page, wb, report, guarded, threw, timers, flush }`
 */
function wMount(o = {}) {
  const page = wPage({ prefix: o.prefix || 'jt', seed: o.seed || {}, drop: o.drop || [], rowHeight: o.rowHeight || 24 });
  if (o.exec === true) page.doc.execCommand = () => true;
  const guarded = [];
  const threw = [];
  const timers = [];
  const dl = o.dl === undefined ? wDownload() : o.dl;
  const wb = createJsonWorkbench({
    document: page.doc,
    Tk: { view: W_VIEW, ui: J_UI },
    prefix: o.prefix || 'jt',
    runGuarded: (id, fn) => {
      guarded.push(id);
      try { fn(page.doc.getElementById(id)); return true; } catch (err) {
        threw.push([id, err && err.message]); return false;
      }
    },
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    ...(o.storage === undefined ? {} : { storage: o.storage }),
    ...(o.now === undefined || o.now === null ? {} : { now: () => o.now }),
    ...(o.rowHeight === undefined ? {} : { rowHeight: o.rowHeight }),
    ...(dl === null ? {} : {
      BlobCtor: dl.BlobCtor, createObjectURL: dl.createObjectURL, revokeObjectURL: dl.revokeObjectURL,
    }),
    navigator: { clipboard: o.clipboard === undefined ? null : o.clipboard },
  });
  const report = wb.mount();
  return {
    page, wb, report, guarded, threw, timers,
    flush: () => { const list = timers.splice(0); for (const t of list) t.fn(); },
  };
}

test('W1 视图层的对外面：四个常量与九件生成器，一格不多一格不少', () => {
  assert.deepEqual(JT_TONES.slice(), ['ok', 'warn', 'bad', 'idle']);
  assert.deepEqual(OUT_KINDS.slice(), ['json', 'ts', 'yaml', 'xml', 'csv']);
  assert.deepEqual(JSON_VIEW_LABELS, { text: '文本', tree: '树' });
  const v = createJsonView(W_VIEW);
  assert.deepEqual(Object.keys(v).sort(),
    ['emptyHint', 'errBlock', 'esc', 'noteLines', 'resultHead', 'statsLine', 'tone', 'treePad', 'treeRow'],
    '九件里加一格或改名，§V 的控制器与装配层就有一处叫不到它');
  for (const [k, fn] of Object.entries(v)) {
    assert.equal(typeof fn, 'function', `${k} 不是函数：这一件到页面上就是"点了没反应"`);
  }
  assert.deepEqual(modNames('dev/js/tools/jsonView.js'),
    ['JT_TONES', 'JSON_VIEW_LABELS', 'OUT_KINDS', 'createJsonView'].sort(),
    'jsonView.js 的导出面多了名字：它只该出这四格，第五格就是第二条渲染路径');
});

/** 一本模块的顶层导出名（按磁盘源码扫，`export {}` 那种再导出算不算多一格由判据自己说） */
function modNames(rel) {
  const src = wCode(rel);
  return [...src.matchAll(/export\s+(?:const|function|class|async\s+function)\s+(\w+)/g)]
    .map((m) => m[1]).sort();
}

/** 全仓库工具侧源码的相对路径清单（W11 数 import 边要吃它，别把 `dev/js/*.js` 漏成一半） */
function wAllSources() {
  const tools = readdirSync(resolve(ROOT, 'dev/js/tools'))
    .filter((f) => f.endsWith('.js')).map((f) => `dev/js/tools/${f}`);
  const roots = readdirSync(resolve(ROOT, 'dev/js'))
    .filter((f) => f.endsWith('.js')).map((f) => `dev/js/${f}`);
  return tools.concat(roots);
}

test('W2 视图层零 import：它的 esc 只能来自注入的那一份', () => {
  const src = wCode('dev/js/tools/jsonView.js');
  assert.equal(/\bimport\b/.test(src), false, 'jsonView 一旦 import 什么，两个入口就 reach 同一模块 → Rollup 切共享 chunk → iife-wrap 后产物里是 import{ → 整页 SyntaxError 而构建 exit=0');
  assert.equal(/\brequire\s*\(/.test(src), false, '同上：require 在这儿等于第二条跨模块的边');
  const bare = wBare('dev/js/tools/jsonView.js');
  for (const word of ['window', 'document', 'localStorage', 'Date.now(', 'getComputedStyle']) {
    assert.equal(bare.includes(word), false, `视图层不许碰 ${word}：它是纯串生成器，碰一次就多一处不可复算`);
  }
  const v = createJsonView(W_VIEW);
  assert.equal(v.esc, W_VIEW.esc, 'esc 必须是注入的那一份：视图层自己抄一份转义表，站内就有两种"什么算需要转义"');
});

test('W3 createJsonView 的构造闸门：缺哪一件点名哪一件', () => {
  assert.throws(() => createJsonView(), (e) => e instanceof TypeError && /view|第一格/.test(e.message));
  assert.throws(() => createJsonView({}), (e) => e instanceof TypeError && /esc/.test(e.message),
    '缺 esc 的下场是整页结果区空白，构造期点名才有意义');
  assert.throws(() => createJsonView({ esc: (s) => String(s) }), (e) => e instanceof TypeError && /EMPTY_CELL/.test(e.message),
    '缺 EMPTY_CELL 那一族点会渲染成"没有那一格"，而不是给一个能读的占位');
  assert.throws(() => createJsonView({ esc: 'not-a-function', EMPTY_CELL: '—' }),
    (e) => e instanceof TypeError && /esc/.test(e.message), 'esc 给了但不是函数：形状对而值不能用比缺席更难查');
  assert.doesNotThrow(() => createJsonView(W_VIEW));
});

test('W4 resultHead 的 kind 白名单与四格产出：写错一个词渲染时抛', () => {
  const v = createJsonView(W_VIEW);
  const html = v.resultHead({ kind: 'json', tone: 'ok', title: '格式化 <结果>', note: '2 处重复键' });
  assert.equal(wAttr(html, 'data-jt-kind'), 'json', 'kind 要挂在 attribute 上，样式才不用认第五个词');
  assert.equal(wSlice(html, 'jt-out__title').inner, '格式化 &lt;结果&gt;', '标题是模块给的文案，一样只许走 esc');
  assert.equal(wSlice(html, 'jt-out__note').inner, '2 处重复键');
  assert.ok(html.includes('jt-tone--ok'));
  assert.equal(wSlice(v.resultHead({ kind: 'ts', tone: 'idle', title: 'T' }), 'jt-out__note'), null,
    'note 缺席时长出一格空白，读起来像"这里本来有字，后来没了"');
  for (const kind of OUT_KINDS) assert.doesNotThrow(() => v.resultHead({ kind, tone: 'idle', title: 'x' }));
  assert.throws(() => v.resultHead({ kind: 'jsonx', tone: 'ok', title: 'x' }), TypeError,
    '白名单外的 kind 不许静默渲成一栏：那是把按钮表写错藏成"输出区少了个头"');
  assert.throws(() => v.resultHead({ kind: 'json', tone: 'ok' }), /title/, '没有标题的那一栏读不出这是哪一次结果');
});

test('W5 tone 的四档与 JT_TONES 逐字对齐，第五档抛', () => {
  const v = createJsonView(W_VIEW);
  assert.deepEqual(JT_TONES.map((t) => v.tone(t)), JT_TONES.map((t) => `jt-tone--${t}`));
  assert.throws(() => v.tone('hurry'), (e) => e instanceof TypeError && /tone|档位/.test(e.message));
  assert.throws(() => v.tone(undefined), (e) => e instanceof TypeError && /tone|档位/.test(e.message));
});

test('W6 errBlock：行列 + 三行读条 + 插入符落在列上，串里的尖括号进不了标记', () => {
  const v = createJsonView(W_VIEW);
  const { err } = W_BAD();
  const ctx = { prev: '  "a": 1,', at: '  "b": 2,,', next: '}', select: true };
  const html = v.errBlock(err, ctx);
  // 读条里的三行是**用户文本**，所以期望值按注入的那只 esc 算（转义表本身归 §O 判，这一格判的是"结构"）。
  const e = wEsc;
  assert.ok(wSlice(html, 'jt-err__where').inner.includes(`第 ${err.line} 行第 ${err.column} 列`),
    '行列必须在读条之外单说一句：等宽块里找第几列是让用户替机器做活');
  const lines = wSlice(html, 'jt-err__ctx').inner.split('\n');
  assert.deepEqual(lines.slice(0, 2), [e(ctx.prev), e(ctx.at)]);  assert.equal(lines[2], `${' '.repeat(err.column - 1)}^`, '插入符的列口径与 setSelectionRange 同源（码元）');
  assert.equal(lines[3], e(ctx.next));
  assert.ok(wSlice(html, 'jt-err__act') !== null, '真的选中了就要说出来，用户不必自己确认光标');
  const one = v.errBlock({ ...err, line: 1, column: 1 }, { prev: '', at: '{', next: '', select: false });
  assert.equal(wSlice(one, 'jt-err__ctx').inner, '{\n^');
  assert.equal(wSlice(one, 'jt-err__act'), null, '没能选中时不许谎报"已选中"');
  const evil = v.errBlock({ ...err, message: '<script>坏</script>' }, { prev: '', at: '<b>', next: '&"', select: true });
  assert.equal(evil.includes('<script>'), false);
  assert.ok(evil.includes('&lt;script&gt;'));
  assert.ok(evil.includes('&amp;&quot;'), '上下文行的引号与 & 一样要转义，否则读条自己就是标记');
  // `ctx.caret` 是那第三把尺（评审 P2-6 的第二半）：那一栏只给得出病灶左右各 120 码元的窗口，
  // 窗口里的列号与原文里的列号就不是一回事了。旧口径没有这一格，调用方只能改 `err.column` 去对插入符，
  // 代价是那句"第 N 行第 M 列"跟着一起换成窗口里的相对列——而抄得去 `jq` 的只有原文里的那一列。
  const win = v.errBlock(err, { ...ctx, at: '"b": 2,,', caret: 6 });
  assert.equal(wSlice(win, 'jt-err__ctx').inner.split('\n')[2], `${' '.repeat(6)}^`, '插入符落在窗口里那一格');
  assert.ok(wSlice(win, 'jt-err__where').inner.includes(`第 ${err.column} 列`), '给了窗口列也不许动那句行列');
  const zero = v.errBlock({ ...err, column: 40 }, { prev: '', at: '1,,', next: '', caret: 0 });
  assert.equal(wSlice(zero, 'jt-err__ctx').inner.split('\n')[1], '^',
    '窗口第一格就是病灶时 caret 是 0：把 `> 0` 当门就会退回去按原文列铺，插入符就飞出窗口外');
  assert.throws(() => v.errBlock(null, ctx), TypeError);
  assert.throws(() => v.errBlock(err, null), TypeError, 'ctx 缺席就没法拼读条：抛，别渲一行 undefined');
});

test('W7 treeRow 的四种行与 treePad 的高度串：Pointer 按钮只长在点得出的行上', () => {
  const v = createJsonView(W_VIEW);
  const row = (over) => Object.assign({
    id: '/a', pointer: '/a', parent: '', depth: 1, keyLabel: 'a', kind: 'number',
    display: '1', childCount: 0, expanded: false, hiddenCount: 0, truncatedFrom: -1, matched: false,
  }, over);
  const scalar = v.treeRow(row({}));
  assert.equal(wAttr(scalar, 'data-jt-tri'), 'leaf', '标量行给占位的三角而不是省掉：缩进与行高靠这一格对齐');
  assert.equal(wSlice(scalar, 'jt-tree__key').inner, 'a');
  assert.equal(wSlice(scalar, 'jt-tree__val').inner, '1');
  assert.equal(wAttr(scalar, 'data-jt-copy'), '/a');
  assert.equal(scalar.includes('disabled'), false);
  const obj = v.treeRow(row({ kind: 'object', display: '{3 键}', childCount: 3 }));
  assert.equal(wAttr(obj, 'data-jt-tri'), 'closed');
  assert.equal(wAttr(obj, 'data-jt-copy'), '/a', '容器也有 Pointer，指的就是这一格——不给按钮等于少一种引用方式');
  const open = v.treeRow(row({ kind: 'array', display: '', childCount: 4, expanded: true }));
  assert.equal(wAttr(open, 'data-jt-tri'), 'open');
  assert.equal(wSlice(open, 'jt-tree__val').inner, '4 项', '展开行的概览串是空的，那一格由视图层补数');
  const more = v.treeRow(row({ id: '/x~more', pointer: '', parent: '/x', display: '还有 2 个键未列出', kind: 'object' }));
  assert.equal(wAttr(more, 'data-jt-copy'), null, '截断行没有 Pointer 可复制，给按钮就是给一个复制出空串的家伙');
  assert.equal(wSlice(more, 'jt-tree__key').inner, '还有 2 个键未列出');
  const root = v.treeRow(row({ depth: 0, id: '', pointer: '', keyLabel: '', kind: 'object', display: '', childCount: 2, expanded: true }));
  assert.equal(wSlice(root, 'jt-tree__key').inner, '根', '根那一格不能是空的：空串键已经有它自己的那一档（V14）');
  assert.equal(wAttr(root, 'data-jt-copy'), null);
  assert.equal(wSlice(v.treeRow(row({ keyLabel: '' })), 'jt-tree__key').inner, wEsc('""'),
    '`{ "": 1 }` 的键是空串，屏幕上要看得见那对引号');
  assert.ok(v.treeRow(row({ matched: true })).includes('jt-tree__key is-matched'), '类名顺序要稳定，SCSS 才认这一格');
  assert.equal(v.treeRow(row({ keyLabel: '<b>&"' })).includes('&lt;b&gt;&amp;&quot;'), true, '用户键名里的标记永远进不了标记');
  assert.equal(v.treePad(0, 24), '0px');
  assert.equal(v.treePad(3, 24), '72px');
  assert.throws(() => v.treePad(-1, 24), RangeError);
  assert.throws(() => v.treePad(2.5, 24), RangeError, '半行高的垫块会把滚动条总长算歪（§V 契约②）');
});

test('W8 statsLine 只吃那七格，多出来的读数进不了那一行；emptyHint 是空态唯一的样子', () => {
  const v = createJsonView(W_VIEW);
  const stats = { bytes: 12, lines: 3, nodes: 5, depth: 2, keys: 4, arrayItems: 1, longestStringChars: 7 };
  assert.equal(wSlice(v.statsLine(stats), 'jt-out__stats').inner,
    '字节 12 · 行 3 · 节点 5 · 深度 2 · 键 4 · 数组项 1 · 最长串 7');
  // 出去的是带类名的那一格，不是裸文本：装配层要排版就得自己手打第二个类名，而类名词汇表只在这一本里（W10）
  assert.equal(wSlice(v.statsLine(stats), 'jt-out__stats').tag, 'p', '读数那一行没有自己的那一格，样式那边无处可挂');
  assert.equal(v.statsLine(Object.assign({}, stats, { evil: 999, kind: 'x' })), v.statsLine(stats),
    '只读那七格：模块以后加读数不该让这一行静默变样');
  assert.equal(wSlice(v.statsLine({}), 'jt-out__stats').inner, '字节 0 · 行 0 · 节点 0 · 深度 0 · 键 0 · 数组项 0 · 最长串 0');
  assert.throws(() => v.statsLine(null), TypeError);
  const hint = v.emptyHint('还没有算过。粘贴进来，再按上面任意一个动作。');
  assert.equal(wSlice(hint, 'jt-empty').inner, '还没有算过。粘贴进来，再按上面任意一个动作。');
  assert.equal(v.emptyHint('<i>').includes('<i>'), false);
});

test('W9 noteLines 去重保序、逐条转义；四族备注常量非空', () => {
  const v = createJsonView(W_VIEW);
  assert.equal(v.noteLines([]), '', '没有备注时长出一个空的 ul，页面上是一条没人看的分隔线');
  assert.equal(v.noteLines(null), '');
  const html = v.noteLines(['深度闸门是 1000 层', '深度闸门是 1000 层', '重复键 <b> 取后写']);
  assert.deepEqual([...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]),
    ['深度闸门是 1000 层', '重复键 &lt;b&gt; 取后写'], '同句只留一条，顺序按给进来的走');
  assert.ok(html.startsWith('<ul class="jt-notes">'));
  for (const note of [CORE_NOTES.deepSample, CORE_NOTES.dupKey, TS_HEADER_NOTE, XML_CONVENTION,
    ...Object.values(YAML_NOTES), ...Object.values(CSV_NOTES)]) {
    assert.equal(typeof note, 'string', '备注族里出了一格非字符串：它到页面上是 undefined');
    assert.notEqual(note.trim(), '', '备注族里有空的那一格 = 那一族没人说明代价');
  }
});

test('W10 装配层不读环境：七个词 0 命中，写 HTML 只有一个出口', () => {
  const bare = wBare('dev/js/tools/jsonWorkbench.js');
  for (const word of ['Date.now(', 'localStorage', 'sessionStorage', 'navigator.', 'new Blob',
    'URL.', 'window', 'globalThis', 'getComputedStyle', 'querySelector', 'setTimeout(']) {
    assert.equal(bare.includes(word), false, `装配层不许碰 ${word}：环境量一律从 env 进来，否则 §W 的每一判在两台机器上给两个答案`);
  }
  assert.equal(wCount(bare, 'innerHTML'), 1,
    'innerHTML 只许有一个出口：第二个就是第二条 markup 路径，§V 的行内 HTML 必须从 renderRow 走进这一只');
  assert.equal(wCount(wBare('dev/js/tools/jsonView.js'), 'innerHTML'), 0, '视图层只产串，不碰节点');
  // 三种引号都数（评审 P0-1）：旧口径只认 `'jt-`，而装配层那两枚地址恰恰是模板串——拼错的那一版
  // 在这条判据下是"自洽地绿"。这里挑的是"整格以 `jt-` 起头"的字面量：`<pre class="jt-out__body">`
  // 那一格是排版（视图层没导出它），第一个字符不是 `j`，与本条红线无关。
  assert.deepEqual(wHandTypedIds('dev/js/tools/jsonWorkbench.js'), [],
    "装配层不许手打以 jt- 开头的地址串（' / \" / ` 三种引号都算，注释里的不算）：地址只由那八枚 helper 派生");
});

test('W11 import 边闭合与入口那三格常量：门禁⑤ 组 5 用正则找的就是这几个字', () => {
  assert.deepEqual(wImports('dev/js/tools/jsonWorkbench.js').sort(),
    ['./json-convert.js', './json-core.js', './json-tree.js', './json-ts.js', './jsonView.js'].sort(),
    '装配层只 import 这四本纯模块加视图层一本：panel / panel-dom / view / ui 走 window.Tk，codecView 与 codecWorkbench 一本都不许碰');
  assert.deepEqual(wImports('dev/js/toolJson.js'), ['./tools/jsonWorkbench.js'],
    '入口只许 import 装配层一本，框架那四只从 window.Tk 拿');
  const entry = wCode('dev/js/toolJson.js');
  assert.equal(/^\s*export\b/m.test(entry), false, '入口有顶层 export 就是语法错误：iifeWrapPlugin 包成 (function(){…})() 且不补 use strict');
  for (const line of [
    "const CONTAINER_ID = 'jt-workspace';",
    "const NOTICE_ID = 'jt-notice';",
    "const ATTR = { ids: 'data-jt-ids', prefix: 'data-jt-prefix', label: 'data-jt-label', notice: 'data-jt-notice' };",
  ]) {
    assert.ok(entry.includes(line), `门禁⑤ 组 5 在入口源码里正则找的是这一行原文：${line}`);
  }
  const bareEntry = wBare('dev/js/toolJson.js');
  for (const word of ['Date.now(', 'localStorage', 'URL.createObjectURL', 'URL.revokeObjectURL',
    'win.Blob', 'setTimeout(', 'win.navigator']) {
    assert.equal(wCount(bareEntry, word), 1, `入口里 ${word} 应恰好一处：多一处就是第二份环境读法，§R 立的"只在入口读一次"塌了`);
  }
  // 「下载结果」给出去的必须是**工厂**而不是裸构造器。上面那圈词频守卫数得出 `win.Blob` 只出现一处，
  // 数不出它前面有没有 `new`——而装配层是按 `env.BlobCtor(parts, options)` 的写法调它的（§W10 红线 2
  // 「本层不写 `new Blob`」），`Blob` 不带 `new` 直接调必抛 `TypeError`。§I 的假 DOM 给的是箭头函数，
  // 所以这一格在 363 判里一条都抓不到；抓到它的是真浏览器核验的 `json/10a`（点下载、`create` 记到 0）。
  assert.match(bareEntry, /BlobCtor:\s*\([^)]*\)\s*=>\s*new\s+win\.Blob\b/,
    '入口给 env.BlobCtor 的必须是 `(…) => new win.Blob(…)`：给裸构造器 = 页面上点「下载结果」必抛，一次下载都不会发生');
  // 行高是 Task 7 加进来的**第二只环境量**：它的权威在 `dev/sass/toolJson.scss` 的 `--jt-row-h`，
  // 入口读一次、注入 `env.rowHeight`。数死一处的理由是"两把尺"：读第二处就可能与第一处不一样，
  // 而 §V 的窗口密度与行号槽那次 `style.height` 只认一个整数。装配层那一头由 W10 判 0 命中。
  assert.equal(wCount(bareEntry, 'getComputedStyle'), 1,
    '入口只许读一次样式（`--jt-row-h` → env.rowHeight）：多一处就是第二把尺，装配层那一头必须是 0 命中');
  // 唯一 import 点**就是装配层那一本**，所以判据数的是"谁在 import 它"，不是"除了它自己没人 import"——
  // 后一种写法会把装配层自己那一条当成 0 命中，反而永远抓不到"入口也够过去"这件事。
  const importers = wAllSources()
    .filter((rel) => rel !== 'dev/js/tools/json-convert.js')
    .filter((rel) => wImports(rel).some((p) => /json-convert\.js$/.test(p)));
  assert.deepEqual(importers, ['dev/js/tools/jsonWorkbench.js'],
    'json-convert 的 import 点只许一处：入口或别的页够过去，就是第二个入口 reach 内置件那本 → 共享 chunk');
  // 内置件那一本自己是第三个入口的候选：谁 import 它，谁就把 90 KB 拖进自己的产物，
  // 而两个入口 reach 它时 Rollup 切的是共享 chunk——那条路的下场写在红线 1。
  const yamlUsers = wAllSources().filter((rel) => wImports(rel).some((p) => /js-yaml/.test(p)));
  assert.deepEqual(yamlUsers, ['dev/js/tools/json-convert.js'],
    'js-yaml 只许被 json-convert 够一次：入口与装配层都不许直接够它，YAML 那一族要经 `jsonToYaml` / `yamlToJson` 两扇门');
});

test('W12 构造期闸门：缺哪一样点名哪一样，注入的那几件必须能用形状', () => {
  const base = { document: wPage().doc, Tk: { view: W_VIEW, ui: J_UI }, runGuarded: () => true };
  assert.throws(() => createJsonWorkbench({ ...base, document: undefined }),
    (e) => e instanceof TypeError && /document/.test(e.message), '缺 document 的后果是第一次点击才炸');
  assert.throws(() => createJsonWorkbench({ ...base, document: { getElementById: () => null } }),
    (e) => e instanceof TypeError && /createElement/.test(e.message), '缺 createElement 的 DOM 接不出 §V 的行');
  assert.throws(() => createJsonWorkbench({ ...base, Tk: { view: null, ui: J_UI } }),
    (e) => e instanceof TypeError && /view/.test(e.message));
  assert.throws(() => createJsonWorkbench({ ...base, Tk: { view: W_VIEW, ui: {} } }),
    (e) => e instanceof TypeError && /copyInto/.test(e.message), '缺 ui.copyInto 的下场是点复制没反应');
  assert.throws(() => createJsonWorkbench({ ...base, runGuarded: undefined }),
    (e) => e instanceof TypeError && /runGuarded/.test(e.message), '按钮回调不许自己 try/catch 出第二套错误口径');
  assert.throws(() => createJsonWorkbench({ ...base, storage: {} }),
    (e) => e instanceof TypeError && /storage/.test(e.message), '给了 storage 但三个方法都没有：记住上次输入会静默不生效');
  assert.throws(() => createJsonWorkbench({ ...base, now: 5 }),
    (e) => e instanceof TypeError && /now/.test(e.message));
  assert.throws(() => createJsonWorkbench({ ...base, later: 5 }),
    (e) => e instanceof TypeError && /later/.test(e.message), '非函数的 later 让"粘贴不自动解析"那一条 debounce 静默消失');
  assert.throws(() => createJsonWorkbench({ ...base, rowHeight: 0 }),
    (e) => e instanceof RangeError && /rowHeight/.test(e.message), '行高 0 让 §V 的窗口折算除不尽，滚动条总长跟着歪');
  assert.throws(() => createJsonWorkbench({ ...base, prefix: '' }),
    (e) => e instanceof TypeError && /prefix/.test(e.message));
  assert.doesNotThrow(() => createJsonWorkbench(base), 'storage / now / later / 下载三件都允许缺席');
});

test('W13 controlIds ↔ JSON_SPEC ↔ JSON_ACTIONS 三向对账，骨架缺一格只报不缺不塌', () => {
  const ids = wControlIds('jt');
  assert.deepEqual(Object.keys(ids).sort(),
    ['btn', 'copy', 'gutter', 'in', 'out', 'status', 'tree', 'when']);
  assert.deepEqual(Object.keys(wControlIds('jt')), Object.keys(wControlIds('zx')), '换前缀只换地址，不换形状');
  assert.deepEqual(ids.in.map((s) => s.split('-').pop()), ['doc', 'view', 'query', 'indent', 'sort', 'memorize'],
    '六枚控件就是 JSON_SPEC 那一条声明，门禁⑤ DOM 组比的也是它');
  assert.equal(ids.btn.length, JSON_ACTIONS.length, '按钮清单只能从 JSON_ACTIONS 长');
  assert.deepEqual(ids.when, ['jt-when-workbench-tree']);
  assert.deepEqual(ids.out, ['jt-out-workbench-main']);
  assert.deepEqual(ids.gutter, ['jt-gutter-workbench-doc']);
  const seen = new Set();
  for (const list of Object.values(ids)) {
    for (const id of list) {
      assert.ok(id.startsWith('jt-'), `${id} 不在前缀下面：装配层里有人手打了地址`);
      assert.equal(seen.has(id), false, `${id} 派生了两次：接线会挂两遍监听`);
      seen.add(id);
    }
  }
  const page = wPage();
  const extra = [...page.nodes.keys()].filter((k) => !seen.has(k));
  assert.deepEqual(extra.sort(), ['jt-notice', 'jt-workspace'],
    '骨架上只许多这两格（入口自己的地址），多第三格就是有个没人接的格子');
  const m = wMount({ drop: [wCopy('jt', 'workbench', 'main')] });
  assert.ok(m.report.missing.includes(wCopy('jt', 'workbench', 'main')),
    '缺一格要报出来：静默少一枚复制按钮，用户只会以为这页坏了');
  assert.deepEqual(m.threw, [], '缺一格不是异常：找不到节点就少接那一根线，别把整页拖塌');
  assert.deepEqual(Object.keys(m.wb.renderers), JSON_PANEL_IDS, 'renderers 的键就是面板清单，多一块少一块都接不上 panel-dom');
  assert.deepEqual(Object.keys(m.wb.actions).sort(), JSON_ACTIONS.map((a) => a.key).sort(),
    '动作清单只能有一份：按钮按 `JSON_ACTIONS` 长，可调用的面也按它长，少一枚就是页面上有一枚点了没反应的按钮');
  const twice = wMount();
  twice.wb.mount();
  assert.equal(twice.page.nodes.get(wButton('jt', 'workbench', 'format')).listeners.get('click').length, 1,
    'mount() 重入不许挂第二根线：一次按键跑两遍计算');
});

test('W14 一次闭环与两类失败分两条路：用户那一格走提示，模块坏了走 guarded', () => {
  const m = wMount({ seed: { 'workbench:doc': '{"a":1,"b":2}' } });
  assert.deepEqual(m.guarded, [], '挂载期一次计算都不做（红线 4）');
  assert.ok(m.page.html().includes('jt-empty'), '挂载画的是空态，不是把上次输入偷偷算一遍');
  m.page.click('format');
  assert.deepEqual(m.guarded, [wButton('jt', 'workbench', 'format')], '按钮走的必须是被 runGuarded 包过的那一条');
  assert.ok(m.page.html().includes('&quot;a&quot;'), '格式化结果进的是转义后的那一栏');
  assert.equal(m.wb.state().tone, 'ok');
  assert.equal(m.wb.state().kind, 'json');
  assert.deepEqual(m.threw, [], '一次正常动作不该被记成"这块坏了"（`equal` 比两个新数组永远红，这一格要的是内容）');
  m.page.set('workbench', 'doc', W_BAD().text);
  m.page.click('validate');
  assert.ok(m.page.html().includes('jt-err'), '坏输入给的是行列 + 读条，不是一句"错了"');
  assert.equal(m.wb.state().tone, 'bad');
  assert.deepEqual(m.threw, [], '用户的输入坏了不是这块坏了，不许记进 broken');
  assert.equal(m.page.sel.length, 1, '定位一次就好：选区落在病灶那一格');
  assert.deepEqual(m.page.sel[0].slice(0, 2), [W_BAD().err.index, W_BAD().err.index + W_BAD().err.length]);
  m.page.set('workbench', 'doc', '   ');
  m.page.click('format');
  assert.ok(m.page.html().includes('jt-hint'), '空输入走 FieldError 那一格：读条没有可指的地方');
  assert.equal(m.page.sel.length, 1, '空输入不该动选区');
  assert.deepEqual(m.threw, []);
  m.page.set('workbench', 'doc', '{"a":1}');
  m.page.set('workbench', 'sort', 'wild');
  m.page.click('format');
  assert.equal(m.threw.length, 1, '骨架给了 spec 之外的值 = spec 与骨架漂移，那是内部不变量坏了，原样上抛');
  assert.equal(m.threw[0][0], wButton('jt', 'workbench', 'format'));
  assert.ok(m.page.html().includes('jt-hint'), '坏了这一次不许把上一格的结果擦掉：用户手里那份还在');
});

test('W15 记住上次输入：关着零次写入，开着恰好一格，超长只说没存', () => {
  const off = wStore();
  const a = wMount({ storage: off, seed: { 'workbench:doc': '{"a":1}' } });
  assert.equal(a.page.ctl('workbench', 'memorize').checked, false, '默认档必须是关');
  a.page.click('validate');
  assert.deepEqual(off.log, [], '关着的这一次 setItem 零次：默认就在往本机写东西，页面那句"默认关"就成了假话');
  const on = wStore();
  const b = wMount({ storage: on, seed: { 'workbench:doc': '{"a":1}' } });
  b.page.check('workbench', 'memorize', true);
  b.page.change('workbench', 'memorize');
  assert.deepEqual(on.log, ['jt.memory.on'], '开关本身总写：不写的话下次打开又回到关，这功能等于没有');
  b.page.click('validate');
  assert.deepEqual(on.log, ['jt.memory.on', 'jt.memory.input']);
  assert.equal(JSON.parse(on.map.get('jt.memory.input')).text, '{"a":1}');
  b.page.check('workbench', 'memorize', false);
  b.page.change('workbench', 'memorize');
  assert.deepEqual(on.log.slice(2), ['jt.memory.on', '-jt.memory.input'], '关回去要把正文删干净：留着就是"关了但还在存"');
  const restored = wMount({
    storage: wStore({ 'jt.memory.on': '1', 'jt.memory.input': JSON.stringify({ text: '{"z":9}', at: 111 }) }),
  });
  assert.equal(restored.page.ctl('workbench', 'memorize').checked, true, '开关状态要跟着回来');
  assert.equal(restored.page.ctl('workbench', 'doc').value, '{"z":9}', '正文回填，但只回填不算');
  assert.deepEqual(restored.guarded, [], '挂载期连恢复都不解析（红线 4）');
  assert.ok(restored.page.status().textContent.includes('已恢复上次输入'));
  const broken = wMount({ storage: wStore({ 'jt.memory.on': '1', 'jt.memory.input': '{not json' }) });
  assert.equal(broken.page.ctl('workbench', 'doc').value, '', '存的那一格读不出形状就当没有：宁可少恢复一次，也不把半截东西塞进输入区');
  assert.deepEqual(broken.threw, []);
  const hugeStore = wStore();
  const huge = wMount({ storage: hugeStore, seed: { 'workbench:doc': `{"a":"${'x'.repeat(300000)}"}` } });
  huge.page.check('workbench', 'memorize', true);
  huge.page.change('workbench', 'memorize');
  huge.page.click('validate');
  assert.deepEqual(hugeStore.log, ['jt.memory.on'], '超过 256 KiB 就连正文那一格都不写：那一格里塞 300 KB 是把用户的整份数据留在浏览器里');
  assert.ok(huge.page.status().textContent.includes('没存'), '超长要说"没存"，静默不写让用户以为存住了');
  const nostore = wMount({ storage: null });
  assert.equal(nostore.page.ctl('workbench', 'memorize').disabled, true, '这台浏览器不给存就把开关置灰：按下去没反应的一枚开关比没有更糟');
  // 复制那两枚的可用性是**两格**决定的（评审 P3-14）：这一栏有没有可复制的文本 × 这台浏览器还有没有
  // 一条能用的退路。旧口径只在挂载期按后一格置灰，可一旦算出结果，`syncCopy` 只看前一格就把按钮点亮——
  // 两条退路都断的那台机器上，按下去只会把文案改成"复制失败，请手动选中"。
  // 所以这里必须**先算出一格结果**再量：挂载期 `out` 本来就是空的，那一判量不到第二格。
  const nodl = wMount({ dl: null, clipboard: null, seed: { 'workbench:doc': '{"a":1}' } });
  const copies = [wCopy('jt', 'workbench', 'main'), wButton('jt', 'workbench', 'copy')];
  assert.deepEqual(copies.map((id) => nodl.page.doc.getElementById(id).disabled), [true, true],
    '还没算过：两枚都没有可复制的文本');
  nodl.page.click('validate');
  assert.deepEqual(copies.map((id) => nodl.page.doc.getElementById(id).disabled), [true, true],
    '既无 clipboard 也无 execCommand 的两条退路都断了，算出结果也不点亮：按下去只会改一次文案的按钮不如没有');
  assert.equal(nodl.page.doc.getElementById(wButton('jt', 'workbench', 'download')).disabled, true, '缺 Blob 那三件就 disable 下载');
  const backstop = wMount({ exec: true, clipboard: null, seed: { 'workbench:doc': '{"a":1}' } });
  backstop.page.click('validate');
  assert.deepEqual(copies.map((id) => backstop.page.doc.getElementById(id).disabled), [false, false],
    'http 场景下 `execCommand` 在，那条退路就算数：两枚都该照常可用（真页面的判据归 §X 的浏览器核验）');
});

test('W16 粘贴不自动解析：二十次 input 一次计算都不做；输出超上限只拒进 DOM', () => {
  const m = wMount({ seed: { 'workbench:doc': '{"a":1}' } });
  assert.equal(m.page.made(), 0,
    '挂载期一个新节点都不许长：树控制器与行节点都在按动作之后才存在，挂载就长等于把 §V 的窗口算了一遍');
  const before = m.page.html();
  for (let i = 0; i < 20; i++) m.page.input('workbench', 'doc');
  assert.equal(m.timers.length, 20, '每次 input 排一个，不排第二个：真正的合并交给那个令牌');
  m.flush();
  assert.deepEqual(m.guarded, [], '解析只在按动作时发生：input 只更新闸门读数');
  assert.equal(m.page.html(), before, '空态那一栏不该被 input 换掉');
  assert.equal(m.page.sel.length, 0, 'input 不许动选区：粘贴到一半被抢走光标是能用键盘的人最烦的事');
  assert.equal(m.page.tree.childNodes.length, 0, '树也没被 input 喂过');
  assert.ok(m.page.status().textContent.includes('字节'), '闸门读数要更新，否则"零网络请求"这一格没人看得见');
  // 两档量的其实是同一件事的两头：**上限与输入那一档同源**，所以两兆的结果必须上得了页面，
  // 而只有"结果比输入大得多"的那一族（XML 一个元素摊到 25 字节）才该被拒。
  const big = `{"big":"${'A'.repeat(2100000)}"}`;
  const m2 = wMount({ seed: { 'workbench:doc': big } });
  m2.page.click('format');
  assert.deepEqual(m2.threw, [], '两兆的结果不是这块坏了');
  assert.ok(m2.page.html().includes('AAAA'), '越过的只是 2 MiB 那一档旧口径：它本该摆上页面');
  assert.ok(m2.wb.state().out.length > 2097152, '这一份确实大于 2 MiB，所以它量的是"两档口径不是一回事"');
  assert.equal(m2.wb.state().tone, 'ok');
  // 拒样只让**输入侧**长到 6 MiB：那一条闸门由 `json-core` 自己挡，装配层不进口 `parseJson`，
  // 所以这里量的就是"拒话里给得出上限那个数"，代价是 145 ms 而不是 2.4 s。
  const huge = `{"a":"${'x'.repeat(MAX_JSON_BYTES + 1000)}"}`;
  const m3 = wMount({ seed: { 'workbench:doc': huge } });
  m3.page.click('format');
  assert.deepEqual(m3.threw, [], '超限不是这块坏了：它是有话要说的一种结果');
  assert.ok(m3.page.html().includes('jt-refuse'), '要有一句能读的话');
  assert.ok(m3.page.html().includes(String(MAX_JSON_BYTES)), `话里给得出上限那个数：${huge.length} 字节的输入被谁挡的`);
  assert.equal(m3.wb.state().tone, 'warn');
  assert.equal(m3.wb.state().out, '', '输入就没过闸门，手里不该留一份结果');
});

test('W17 行号槽与输入同源：末格行号 == 闸门读到的行数，纵跟横不跟', () => {
  const m = wMount();
  const text = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}';
  m.page.set('workbench', 'doc', text);
  m.page.input('workbench', 'doc');
  m.flush();
  const nums = m.page.gutter().textContent.split('\n');
  assert.equal(nums.length, gate(text).lines, '行号槽与闸门不同源就是两个行数：读条那一格已经在指第 7 行，槽上只到 6');
  assert.equal(nums[nums.length - 1], String(gate(text).lines));
  assert.equal(nums[0], '1');
  assert.equal(m.page.gutter().style.height, `${gate(text).lines * 24}px`, '槽的高度按行数 × 行高，与 §V 的垫块同一把尺');
  const empty = wMount();
  empty.page.input('workbench', 'doc');
  empty.flush();
  assert.equal(empty.page.gutter().textContent, '1', '空输入也有一行：槽里全空会让人以为这页没接上');
  m.page.ctl('workbench', 'doc').scrollTop = 40;
  m.page.ctl('workbench', 'doc').dispatch('scroll', {});
  assert.equal(m.page.gutter().style.transform, 'translateY(-40px)');
  m.page.ctl('workbench', 'doc').scrollLeft = 30;
  m.page.ctl('workbench', 'doc').dispatch('scroll', {});
  assert.equal(m.page.gutter().style.transform, 'translateY(-40px)', '横向故意不跟：行号是固定在左边的定宽列，跟着横滚会滑出视野');
  assert.equal(m.page.gutter().style.marginLeft, undefined);
  assert.equal(m.page.attr(wGutter('jt', 'workbench', 'doc'), 'aria-hidden'), 'true', '读屏不该把行号读成内容');
});

test('W18 换前缀端到端自证：整页在 zx 下面重新跑一遍，storage 的键也跟着换', () => {
  const store = wStore();
  const m = wMount({ prefix: 'zx', storage: store, seed: { 'workbench:doc': '{"a":[1,2]}' } });
  assert.deepEqual(m.report.missing, [], '装配层里只要有一处手打了 jt，换前缀之后这一格就找不到');
  const all = Object.values(wControlIds('zx')).flat();
  assert.deepEqual(m.report.rendered.slice().sort(), all.slice().sort(), '每一格都接上了线，一格不多一格不少');
  m.page.set('workbench', 'view', 'tree');
  m.page.change('workbench', 'view');
  assert.equal(m.page.doc.getElementById(wWhen('zx', 'workbench', 'tree')).hidden, false, '切到树要露出搜索那一组');
  m.page.click('validate');
  assert.ok(m.page.tree.childNodes.length > 0, '树容器里长出了 §V 的三块常驻节点（上垫块 / 行容器 / 下垫块）');
  // 行在**行容器**那一块里，不在树容器的第一格：§V 的 `childNodes[0]` 是上垫块，它永远没有内容。
  const rowsBox = m.page.tree.childNodes.find((el) => el.getAttribute('class') === 'jt-tree__rows');
  assert.ok(rowsBox, '控制器那三块里的行容器不见了：§V 的常驻节点形状变了，装配层的 renderRow 也就无处可写');
  assert.ok(rowsBox.childNodes.length > 0, '树视图的行真的长出来了（§V 的控制器接的是这一页的行高）');
  assert.ok(String(rowsBox.childNodes[0].innerHTML).includes('jt-tree__'),
    '行内 markup 走 renderRow，不再是一坨 textContent');
  assert.ok(m.page.html().includes('&quot;a&quot;'));
  m.page.check('workbench', 'memorize', true);
  m.page.change('workbench', 'memorize');
  m.page.click('format');
  assert.deepEqual(store.log, ['zx.memory.on', 'zx.memory.input'], '存储的键也跟前缀走：两页共用一台浏览器时不许互相覆盖');
  m.page.set('workbench', 'view', 'text');
  m.page.change('workbench', 'view');
  assert.equal(m.page.doc.getElementById(wWhen('zx', 'workbench', 'tree')).hidden, true);
  assert.equal(m.page.tree.childNodes.length, 0, '切回文本要把树的行撤掉：留着的话两种视图会同时挂在 DOM 上');
});

test('W19 八枚 helper 的字面量逐个钉死：门禁⑤ 只认 `-in-` 那一族，其余七族只有这一判管', () => {
  assert.equal(wField('jt', 'workbench', 'doc'), 'jt-in-workbench-doc');
  assert.equal(wField('jt', 'workbench', 'view'), 'jt-in-workbench-view');
  assert.equal(wField('jt', 'workbench', 'query'), 'jt-in-workbench-query');
  assert.equal(wField('jt', 'workbench', 'indent'), 'jt-in-workbench-indent');
  assert.equal(wField('jt', 'workbench', 'sort'), 'jt-in-workbench-sort');
  assert.equal(wField('jt', 'workbench', 'memorize'), 'jt-in-workbench-memorize');
  assert.equal(wButton('jt', 'workbench', 'format'), 'jt-btn-workbench-format');
  assert.equal(wCopy('jt', 'workbench', 'main'), 'jt-copy-workbench-main');
  assert.equal(wOut('jt', 'workbench', 'main'), 'jt-out-workbench-main');
  assert.equal(wWhen('jt', 'workbench', 'tree'), 'jt-when-workbench-tree');
  assert.equal(wGutter('jt', 'workbench', 'doc'), 'jt-gutter-workbench-doc');
  assert.equal(wStatus('jt', 'workbench', 'main'), 'jt-status-workbench-main');
  assert.equal(wTree('jt', 'workbench', 'main'), 'jt-tree-workbench-main');
  // 评审 P0-1 的现场就是这一形状：模板串里 `${panel}` 打成 `{panel}`，产出 `jt-copy-{panel}-{side}`。
  // W10 那条"不许手打地址"抓不到它——派生与查找用的是同一只错函数，在装配层内部完全自洽，
  // 代价是页面上那一枚复制按钮永远找不到节点。只有逐字钉死产出串（或像下面这样查花括号）才看得见。
  for (const list of Object.values(wControlIds('jt'))) {
    for (const id of list) {
      assert.equal(/[{}]/.test(id), false, `${id} 里还有没被替换的花括号：这一格在骨架上永远找不到`);
    }
  }
  const m = wMount();
  assert.deepEqual(m.report.missing, [], '上面那十三格与骨架长出来的那一串必须逐字相等');
  const ids = wControlIds('jt');
  for (const [family, list] of Object.entries(ids)) {
    for (const id of list) {
      assert.ok(m.report.rendered.includes(id),
        `${family} 一族里的 ${id} 骨架没给：门禁⑤ 只按 \`-in-\` 拼那一族（check-tools-surface.mjs:479），`
        + 'btn / copy / out / status / tree / when / gutter 这七族漏了只有这里报');
    }
  }
});

test('W20 十二枚动作逐个按一遍：每一枚都画得出一栏，标题与类别跟着动作走', () => {
  const IN = '{"a":1,"b":[true,null,"x<y"]}';
  const vIn = parseJson(IN).value;
  const inputs = {
    validate: IN,
    format: IN,
    minify: IN,
    escape: 'he said "hi"',
    unescape: 'he said \\"hi\\"',
    ts: IN,
    yamlOut: IN,
    xmlOut: IN,
    csvOut: IN,
    yamlIn: jsonToYaml(vIn).text,
    xmlIn: jsonToXml(vIn, { indent: 'two' }).text,
    csvIn: jsonToCsv([{ a: 1 }, { a: 2 }]).text,
  };
  const m = wMount();
  const skipped = [];
  for (const a of JSON_ACTIONS) {
    if (a.key === 'copy' || a.key === 'download') { skipped.push(a.key); continue; }
    m.page.set('workbench', 'doc', inputs[a.key]);
    m.page.click(a.key);
    const html = m.page.html();
    assert.deepEqual(m.threw, [], `${a.key}：按下去被记成"这一块坏了"`);
    assert.equal(m.wb.state().tone, 'ok', `${a.key}：这一份输入本来是好的`);
    assert.equal(m.wb.state().kind, a.kind,
      `${a.key} 的类别要跟着动作走：按「生成 TypeScript」得到一栏 json，下载就跟着错（评审 P2-10）`);
    assert.equal(wAttr(html, 'data-jt-kind'), a.kind, 'kind 落在 attribute 上，样式那边不用认第五个词');
    assert.equal(wSlice(html, 'jt-out__title').inner, wEsc(a.label),
      `${a.key} 的栏头标题就是按钮那句文案：两处不一致时用户读不出自己按的是哪一枚`);
    assert.ok(wSlice(html, 'jt-out__body') !== null, `${a.key} 有栏头却没有正文`);
    assert.notEqual(m.wb.state().out, '', `${a.key} 算得出空正文，那一栏就是装的空的`);
  }
  assert.deepEqual(skipped, ['copy', 'download'],
    '这两枚不画栏（W22 与 W24 各量一件）：清单多谁就是有人加了一枚没人量的按钮');
  // 转义那一族的对称（评审 P1-3 的第二半）：`转义 → 反转义` 要能回到原样。
  m.page.set('workbench', 'doc', 'he said "hi"');
  m.page.click('escape');
  assert.equal(m.wb.state().out, JSON.stringify('he said "hi"'),
    '转义产出的是"能直接贴进 JSON 字符串字面量"的那一段，外层引号要在');
  m.page.set('workbench', 'doc', m.wb.state().out);
  m.page.click('unescape');
  assert.equal(m.wb.state().out, 'he said "hi"',
    '带着外层引号反转义也要回原样：那一层是转义加的，就该由反转义剥掉');
  // 三个"转回"读回来的值：YAML / XML 精确回到写出去的那一份，CSV 按它自己的口径全成字符串
  m.page.set('workbench', 'doc', inputs.yamlIn);
  m.page.click('yamlIn');
  assert.deepEqual(JSON.parse(m.wb.state().out), vIn, 'YAML 转回的正文里就是那一份值：类型不能在这一跳里悄悄变');
  m.page.set('workbench', 'doc', inputs.xmlIn);
  m.page.click('xmlIn');
  assert.deepEqual(JSON.parse(m.wb.state().out), vIn, 'XML 的 t= 那一套要真的把类型带回来，不然它只是标签名');
  m.page.set('workbench', 'doc', inputs.csvIn);
  m.page.click('csvIn');
  assert.deepEqual(JSON.parse(m.wb.state().out), [{ a: '1' }, { a: '2' }],
    'CSV 读回来每格都是字符串（§U 的口径），页面上那一族说明讲的正是这件事（W26 量它上没上页面）');
  // 用户文本进标记只有一条路：视图层注入的那一只 `esc`
  m.page.set('workbench', 'doc', IN);
  m.page.click('format');
  assert.ok(m.page.html().includes('x&lt;y'), '尖括号在正文那一栏里也是转义过的');
  assert.equal(m.page.html().includes('"x<y"'), false, '原始形状出现在 HTML 串里 = 有一处没走 esc');
});

test('W21 树容器的点击代理：Pointer 那一支赢过展开那一支，展开态读 aria-expanded 不查行内三角', async () => {
  const got = [];
  const clipboard = { writeText: (t) => { got.push(t); return Promise.resolve(); } };
  const m = wMount({ clipboard, seed: { 'workbench:doc': '{"a":[1,2]}', 'workbench:view': 'tree' } });
  m.page.click('validate');
  const rowsBox = () => {
    const box = m.page.tree.childNodes.find((el) => el.getAttribute('class') === 'jt-tree__rows');
    return box || { childNodes: [] };
  };
  const rowsOf = () => rowsBox().childNodes.filter((el) => el.getAttribute('data-jt-id') !== null);
  assert.equal(rowsOf().length, 4, '默认深度 2：根 / a / a[0] / a[1] 四行');
  // Pointer 那一支必须**先**判：它住在行内，而它的父级是一行容器（有 `aria-expanded`）。
  // 两档顺序写反了就是"复制一格的 Pointer，顺手把这一支折叠了"——用户看到的是树跳了、剪贴板没东西。
  const arrayRow = rowsBox().childNodes[1];
  assert.equal(arrayRow.getAttribute('data-jt-id'), '/a');
  assert.equal(arrayRow.getAttribute('aria-expanded'), 'true');
  const btn = m.page.mk('button', '', { 'data-jt-copy': '/a' });
  arrayRow.appendChild(btn);
  m.page.tree.dispatch('click', { target: btn });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(got, ['/a'], '复制的是这一格的 Pointer 地址，不是整棵树的文本');
  assert.equal(rowsOf().length, 4, '复制走完就 return：再往下走会把这一支整个折叠掉');
  assert.equal(btn.textContent, '已复制', '那一枚按钮要自己给反馈：Pointer 短，复制成了没人看得见');
  // 点行本身翻展开态。读的是行上的 `aria-expanded`，不是行内那枚 `<span data-jt-tri>`——
  // 后者要从 DOM 里再找一次就得用 `querySelector`，那一个词在 W10 的红线上是 0 命中。
  m.page.tree.dispatch('click', { target: rowsBox().childNodes[0] });
  assert.equal(rowsOf().length, 1, '折叠根只留根一行');
  assert.equal(rowsBox().childNodes[0].getAttribute('aria-expanded'), 'false', '翻的是当前那一档，不是猜的');
  m.page.tree.dispatch('click', { target: rowsBox().childNodes[0] });
  assert.equal(rowsOf().length, 2,
    '再展开只回来两行：`/a` 那一支的展开态随整支离开了行集，§V 的 V10 判的就是这一档（不是这里放松）');
  m.page.tree.dispatch('click', { target: rowsBox().childNodes[1] });
  assert.equal(rowsOf().length, 4, '点开 `/a` 才把两项数组摊回来');
  const scalar = rowsBox().childNodes.find((el) => el.getAttribute('aria-expanded') === null);
  assert.ok(scalar, '标量行上没有 aria-expanded');
  m.page.tree.dispatch('click', { target: scalar });
  assert.equal(rowsOf().length, 4, '第三档什么都不做：点标量行不许把树翻乱');
  m.page.tree.dispatch('click', { target: m.page.tree });
  assert.equal(rowsOf().length, 4);
  assert.deepEqual(got, ['/a'], '点容器与垫片（两格都 `closest` 不到）不许静默复制或塌陷');
});

test('W22 下载那一枚：文件名与 MIME 跟着当前类别，摘节点与撤销 URL 排在 finally', () => {
  const dl = wDownload();
  const m = wMount({ dl, seed: { 'workbench:doc': '{"a":1}' } });
  m.page.click('download');
  assert.deepEqual(dl.blobs, [], '还没算过就没有可下载的东西：给一个空文件比按下去没反应更坏');
  assert.equal(dl.urls.made.length, 0);
  m.page.click('validate');
  m.page.click('download');
  assert.equal(dl.blobs.length, 1);
  assert.deepEqual(dl.blobs[0].parts, [m.wb.state().out], '下载的是当前那一栏的正文，不是输入原文');
  assert.equal(dl.blobs[0].options.type, 'application/json');
  assert.equal(m.page.madeOf('a')[0].download, 'data.json');
  assert.deepEqual(dl.urls.revoked, dl.urls.made.map(([u]) => u),
    'made 与 revoked 一对一且同一个 URL：漏一次就是一个 blob URL 泄漏到页面关掉');
  assert.equal(m.page.doc.body.childNodes.length, 0, '那一枚 <a> 用完要摘掉，不许留在 body 上');
  m.page.click('ts');
  m.page.click('download');
  assert.equal(dl.blobs[1].options.type, 'text/plain', '按「生成 TypeScript」拿到 .json 是另一回事（评审 P2-10）');
  assert.equal(m.page.madeOf('a')[1].download, 'data.ts', '扩展名跟着那一栏的类别');
  const before = { state: m.wb.state(), html: m.page.html() };
  const orig = m.page.doc.createElement;
  m.page.doc.createElement = (tag) => {
    const el = orig(tag);
    if (String(tag).toLowerCase() === 'a') el.click = () => { throw new Error('下载被拦'); };
    return el;
  };
  m.page.click('download');
  assert.equal(m.threw.length, 1, '抛出去交给注入的 runGuarded：这一层不自己吞掉一次真失败');
  assert.equal(dl.urls.revoked.length, 3,
    '旧口径把 revoke 排在 click() 之后，这一抛就整条跳过——实测泄漏一个 blob URL（评审 P2-10 那一档的 finally）');
  assert.equal(m.page.doc.body.childNodes.length, 0, '游离的 <a> 也不能因为抛错就留在页面上');
  assert.deepEqual(m.wb.state(), before.state, '下载失败不许改动结果区（红线 5）');
  assert.equal(m.page.html(), before.html);
});

test('W23 存储一碰就抛：页面照样起、按钮照样能按（评审 P0-2 的隐私模式那一档）', () => {
  /** 隐私模式那一下的真形状：`localStorage` 取到了，第一次 `getItem` 就抛 */
  class SecurityError extends Error { }
  const boom = () => { throw new SecurityError('这台浏览器不给读'); };
  const store = { getItem: boom, setItem: boom, removeItem: boom };
  const m = wMount({ storage: store, seed: { 'workbench:doc': '{"a":1}' } });
  assert.ok(m.page.html().includes('jt-empty'), '挂载没抛：空态照常画。旧口径里这一档是整页起不来');
  assert.ok(m.page.status().textContent.includes('字节'), '闸门读数照常给');
  assert.deepEqual(m.threw, []);
  assert.equal(m.page.ctl('workbench', 'memorize').disabled, false,
    '有 storage 对象就按"能用"接线：真抛了再退。因为怕抛就把开关永久置灰，是把概率性故障当成没有这功能');
  m.page.check('workbench', 'memorize', true);
  m.page.change('workbench', 'memorize');
  m.page.click('validate');
  assert.deepEqual(m.threw, [], '读与写都抛：一次按动作不许被记成"这一块坏了"');
  assert.equal(m.wb.state().tone, 'ok', '结果是算出来的，跟存不存得住没有关系');
  assert.ok(m.page.html().includes('&quot;a&quot;'));
});

test('W24 两枚复制各改各的口：没有剪贴板时那一走是同步的，连点两次不许把"已复制"转正', () => {
  const m = wMount({ exec: true, clipboard: null, seed: { 'workbench:doc': '{"a":1}' } });
  m.page.click('validate');
  const toolbar = m.page.doc.getElementById(wButton('jt', 'workbench', 'copy'));
  const result = m.page.doc.getElementById(wCopy('jt', 'workbench', 'main'));
  assert.equal(result.textContent, '复制这一栏');
  m.page.click('copy');
  assert.equal(toolbar.textContent, '已复制', '工具栏那一枚改的是自己那一格');
  assert.equal(result.textContent, '复制这一栏',
    'clipboard 缺席时走的是同步那条兜底：另一枚跟着改口就是替用户按了第二下');
  m.page.clickCopy();
  assert.equal(result.textContent, '已复制');
  m.page.click('copy');
  m.page.click('copy');
  assert.equal(toolbar.textContent, '已复制');
  m.flush();
  assert.equal(toolbar.textContent, '复制',
    '第二次的 original 取的是接线那一下记下的文案（评审 P2-9）：取当时的 textContent 就等于让"已复制"永久转正');
  assert.equal(result.textContent, '复制这一栏', '两枚各有自己的原文案，不许共用一句');
  assert.equal(m.page.selects.length, 4, '四次都真走到了兜底那一走（临时 textarea 被 select 过）');
  assert.equal(m.page.doc.body.childNodes.length, 0,
    '兜底用的临时 textarea 用完要摘干净：留在页面上就是一枚能被 Tab 走到的隐形输入框');
});

test('W25 树的化石：切视图只重画上一次那一份，坏输入与"没碰树"的动作都要拆掉旧树', () => {
  const m = wMount({ seed: { 'workbench:doc': '{"a":[1,2]}' } });
  const rowCount = () => {
    const box = m.page.tree.childNodes.find((el) => el.getAttribute('class') === 'jt-tree__rows');
    return box ? box.childNodes.length : 0;
  };
  m.page.set('workbench', 'view', 'tree');
  m.page.change('workbench', 'view');
  assert.equal(m.page.tree.childNodes.length, 0, '一次都没算过就不许有树：切视图那条路上解析就是踩红线 4');
  assert.ok(m.page.status().textContent.includes('换了输入'),
    '要有一句能读的话说清"树为什么不跟"，否则用户以为这一页坏了');
  m.page.click('validate');
  assert.ok(m.page.tree.childNodes.length > 0, '按过动作之后树长出来了');
  assert.equal(rowCount(), 4);
  m.page.set('workbench', 'view', 'text');
  m.page.change('workbench', 'view');
  assert.equal(m.page.tree.childNodes.length, 0, '切回文本要把那三块常驻节点撤干净');
  m.page.set('workbench', 'view', 'tree');
  m.page.change('workbench', 'view');
  assert.equal(rowCount(), 4, '输入没动，来回切两次就要拿上一份的值重画（评审 P1-5：`lastTreeText` 不跟着树一起抹）');
  assert.equal(m.page.status().textContent.includes('换了输入'), false,
    '这句在这一档是假话：那棵树展示的确实是眼前这一段文本');
  m.page.set('workbench', 'doc', W_BAD().text);
  m.page.click('validate');
  assert.equal(m.page.tree.childNodes.length, 0,
    '坏输入不许让上一份的树挂着当旁证：读数照着新输入报，树里却是旧文件的键（评审 P1-4）');
  m.page.set('workbench', 'view', 'text');
  m.page.change('workbench', 'view');
  m.page.set('workbench', 'doc', '{"z":9}');
  m.page.set('workbench', 'view', 'tree');
  m.page.change('workbench', 'view');
  assert.equal(m.page.tree.childNodes.length, 0, '换了输入没再按动作：那一棵树是别人家的');
  assert.ok(m.page.status().textContent.includes('换了输入'));
  // 转义那一族排在解析之前（评审 P1-3），永远走不到 `buildTree`，它自己不碰树就得由 `dropStaleTree` 收尾
  const e = wMount({ seed: { 'workbench:doc': '{"a":1}', 'workbench:view': 'tree' } });
  e.page.click('validate');
  assert.ok(e.page.tree.childNodes.length > 0, 'validate 在树视图下顺手把树建好');
  e.page.set('workbench', 'doc', 'he said "hi"');
  e.page.click('escape');
  assert.equal(e.page.tree.childNodes.length, 0,
    '输入已经换成 he said "hi"，树里还挂着 {"a":1} ——同一份文本刚算过的可以留，换了就得拆');
});

/** `jt-notes` 那一整块的原文：`wSlice` 只切到第一个 `</`，多条说明会落在它以外 */
const wNotes = (html) => {
  const at = html.indexOf('class="jt-notes"');
  return at < 0 ? '' : html.slice(at, html.indexOf('</ul>', at));
};

test('W26 那一族代价说明要上得了页面：转家族逐条列出，闸门只在真的靠近时说', () => {
  const IN = '{"a":1,"b":[true,null,"x<y"]}';
  const m = wMount({ seed: { 'workbench:doc': IN } });
  m.page.click('yamlOut');
  assert.ok(m.page.html().includes('class="jt-notes"'),
    '§U 钉的是那四族常量"非空"，把其中一句放上页面的是这一格：装配层一次都不叫 `cv.noteLines`，那四族在页面上就是 0 处命中');
  for (const [key, note] of Object.entries(YAML_NOTES)) {
    assert.ok(wNotes(m.page.html()).includes(wEsc(note)), `YAML_NOTES.${key} 没出现在转 YAML 那一栏`);
  }
  m.page.click('xmlOut');
  assert.ok(wNotes(m.page.html()).includes(wEsc(XML_CONVENTION)), 'XML 那一族的 t= / item 约定必须说');
  m.page.click('csvOut');
  assert.ok(wNotes(m.page.html()).includes(wEsc(CSV_NOTES.fidelity)));
  m.page.click('ts');
  assert.ok(wNotes(m.page.html()).includes(wEsc(TS_HEADER_NOTE)),
    'TS 那一族只靠正文第一行那句注释不够：判据要量的是说明那一块里也有它，否则这一断言被正文白送');
  m.page.set('workbench', 'doc', 'a: 1\n');
  m.page.click('yamlIn');
  assert.ok(wNotes(m.page.html()).includes(wEsc(YAML_NOTES.ambiguous)), '读回来那一族摊的代价一样要说');
  m.page.set('workbench', 'doc', '{"a":1}');
  m.page.click('validate');
  assert.equal(wNotes(m.page.html()), '',
    '浅输入既没重复键也没靠近深度闸门：每一栏都堆一段说明就是没人看的噪音');
  m.page.set('workbench', 'doc', '{"a":1,"a":2}');
  m.page.click('validate');
  assert.equal(wSlice(m.page.html(), 'jt-out__note').inner, '1 处重复键', '数量写在栏头，读第一行就知道要不要展开看');
  assert.ok(wNotes(m.page.html()).includes(wEsc(CORE_NOTES.dupKey)));
  assert.ok(m.page.html().includes('/a'), '重复键的 Pointer 那一格从模块给到正文');
  m.page.set('workbench', 'doc', '['.repeat(200) + ']'.repeat(200));
  m.page.click('validate');
  assert.ok(wNotes(m.page.html()).includes(wEsc(CORE_NOTES.deepSample)),
    '§7 的深样本按 200 层量：这一档必须放行并且给得出统计');
  const html = m.page.html();
  assert.ok(html.indexOf('class="jt-notes"') < html.indexOf('jt-out__stats'), '头 → 说明 → 读数 → 正文');
  assert.ok(html.indexOf('jt-out__stats') < html.indexOf('jt-out__body'),
    '同一件事在两栏之间换了位置就是两条排版路径（评审 P3-11：validate 曾把读数拼在正文之后）');
});

test('W27 读条只取窗口：整行进不了 DOM，插入符落在窗口里而那句行列说的是原文', () => {
  // 三档病灶位置各查一头：`from` 按 `col - 120` 又要被 `raw.length - 240` 夹住，所以行尾那一档
  // 窗口是**贴着行尾**的——那一头不该有省略号（有了就是谎报"后面还有"），行首那一档反过来。
  const CTX = 120;
  // 样本一律只用数字与逗号：`"` 与 `<` 会被 `esc` 摊成 `&quot;` / `&lt;`，那一档量的是转义表（§O），
  // 混进来就让"窗口最长 242 码元"这一判的分子变成两回事。
  const cases = [
    { name: '病灶在行尾', text: `[1,${'1,'.repeat(1200)}1,,]`, left: true, right: false },
    { name: '病灶在行首', text: `[1,,${'1,'.repeat(300)}1]`, left: false, right: true },
    { name: '病灶在行中', text: `[${'1,'.repeat(600)}1,,${'1,'.repeat(600)}1]`, left: true, right: true },
  ];
  for (const c of cases) {
    const err = parseJson(c.text).error;
    assert.equal(err.line, 1, `${c.name}：样本得是一行才量得到窗口`);
    const m = wMount({ seed: { 'workbench:doc': c.text } });
    m.page.click('validate');
    const html = m.page.html();
    const ctx = wSlice(html, 'jt-err__ctx').inner.split('\n');
    const shown = ctx[0];
    const caretAt = ctx[1].indexOf('^');
    assert.ok(shown.length <= CTX * 2 + 2, `${c.name}：窗口最长 242 码元（左右各 ${CTX} 再加两头省略号），这里是 ${shown.length}`);
    assert.equal(shown[0] === '…', c.left,
      `${c.name}：左边切了才写 …，没切就要让人按看到的第一个字符数——那一格不是行首就是谎报`);
    assert.equal(shown[shown.length - 1] === '…', c.right, `${c.name}：右头的 ${c.right ? '窗口没贴到行尾，要写 …' : '窗口贴着行尾，不该再写 …'}`);
    assert.equal(html.includes(c.text), false,
      `${c.name}：整行进 DOM，5 MiB 上限之内的一条压缩 JSON 能摊出 10 MiB 的串（评审 P2-6）`);
    assert.ok(wSlice(html, 'jt-err__where').inner.includes(`第 ${err.line} 行第 ${err.column} 列`),
      `${c.name}：那句行列说的是**原文**里的那一列，只有那一个数字抄得去 jq`);
    assert.equal(shown[caretAt], c.text[err.index],
      `${c.name}：插入符底下那一格就是病灶本身，窗口列与原文列两把尺一错位这一判必红（评审 P2-6 的第一档）`);
  }
  // 制符展成**一格**空格：`<pre>` 的 tab-size 默认是 8，而插入符数的是空格（评审 P2-7，页面上没有开关能改这一档）
  const tabs = '[\n\t\t1,,]';
  const terr = parseJson(tabs).error;
  const t = wMount({ seed: { 'workbench:doc': tabs } });
  t.page.click('validate');
  const tc = wSlice(t.page.html(), 'jt-err__ctx').inner.split('\n');
  assert.deepEqual(tc.slice(0, 1), ['['], '第一行是上一行：`[` 那一格离病灶一行，读条要给它');
  assert.equal(tc.length, 3, '上一行 + 病灶行 + 插入符三行：末行没有下一行，不该再抄一遍');
  assert.equal(tc[1].includes('\t'), false, '读条里不许留制表符：留着就是一格占八个码元');
  assert.equal(tc[2], `${' '.repeat(terr.column - 1)}^`, '行短没切窗口时，插入符就按原文列铺（caret 与 column 同源）');
  assert.equal(tc[1][tc[2].indexOf('^')], tabs[terr.index], '同一把尺在短行那一档也得落在病灶上');
  // 越界的行号要当"没有这一行"：`lineRange` 按 §S 的口径把越界**夹到末行**，读条照抄就是把病灶行
  // 再摊一遍——上面那一档 `html.includes(c.text)` 为真的现场正是这一格（W27 第一次跑就抓到了它）。
  const last = wMount({ seed: { 'workbench:doc': `[1,${'1,'.repeat(20)}1,,]` } });
  last.page.click('validate');
  const lc = wSlice(last.page.html(), 'jt-err__ctx').inner.split('\n');
  assert.equal(lc.length, 2, '单行输入只有"病灶行 + 插入符"两行：末行没有下一行，第三行不该是整行重抄');
  // 三行吃同一个窗口：只裁病灶行、上一行留全文，等宽对齐的读条就自己换了列（同一档缺陷的第二张脸）
  const long = `[${'1,'.repeat(1500)}`;
  const two = `${long}\n2,,]`;
  const m2 = wMount({ seed: { 'workbench:doc': two } });
  m2.page.click('validate');
  const h2 = m2.page.html();
  const c2 = wSlice(h2, 'jt-err__ctx').inner.split('\n');
  assert.equal(wAttr(h2, 'data-jt-kind'), 'json');
  assert.ok(wSlice(h2, 'jt-err__where').inner.includes('第 2 行第 3 列'), '病灶在第二行，那句行列说的是原文的那一格');
  assert.equal(c2.length, 3, '第一行是上一行、第二行是病灶行、第三行是插入符：末行没有下一行');
  assert.ok(c2[0].length <= 242, `上一行也得裁进同一个窗口，这里 ${c2[0].length} 码元`);
  assert.equal(c2[0].endsWith('…'), true, '上一行被切了右头，要写 …');
  assert.equal(h2.includes(long), false, '上一行整行进 DOM：三行里只有病灶行有窗口，这一格就是漏的那两头');
  assert.equal(c2[1], '2,,]', '病灶行短，窗口就贴着它自己的长度');
  assert.equal(c2[2], '  ^', '插入符落在病灶行那一格，与上面的窗口同一条列');
});

// ── §X 行级与 token 级对齐引擎（`tools/diff-core.js`，段 5 Task 2）─────────────
// 这一族只钉一件事：**对齐的结论必须最短、而展示的必须还是原文**。
// 口径写死在这里，实现不许自创第二套：
//   · 断行只认 `\n`，行尾那个 `\r` 剥出来记进 `crlf[]`，行内的 `\r` 是正文（X1）；
//   · 空串是**零行**、一枚 `\n` 是**一行空行**，两档并成一条的话空文件比空文件会报出非零增删（X1）；
//   · 归一化（`ws` / `case`）只进**比较键**，行号、`textA/textB`、`unifiedText` 一律是原文（X6）；
//   · `ws` 是"并成空格"不是"删掉空白"，所以 `'ab'` 与 `'a b'` 必须判不同（X7）；
//   · 降级与退化都必须上页面，因为它们给出的编辑脚本比最短的**长**（X13、X14、X17、X29）；
//   · 配对规则只有一句 `pairs = min(删, 增)`，"改 K 处"、`change` 行、unified 内容行、折叠条四件事同源（X18）。
// 最短性不靠"看着对"：X4 拿测试侧自己写的朴素 LCS DP 对拍 200 组，X5 在同一批样本上逐组验 ops 三条不变式。
// `gate` 与 §S 那一本的 `gate` 同名（一个是按侧双输入、一个是单输入返回 {kind,message}），别名读；
// `MAX_INPUT_BYTES` / `MAX_INPUT_LINES` 在 §S 顶层已经占了名字，这里一律 `X_` 前缀，别互相盖掉。
const {
  MAX_INPUT_BYTES: X_BYTES, MAX_INPUT_LINES: X_LINES, MAX_COST: X_COST,
  MAX_INLINE_TOKENS: X_TOKENS, MAX_INLINE_WORK: X_WORK, DEFAULT_CONTEXT: X_CTX, CR_GLYPH: X_CR,
  splitLines: dSplit, compareKey: dKey, diffSeq: dSeq, gate: dGate, diffLines: dLines,
  inlineDiff: dInline, hunksOf: dHunks, unifiedText: dUnified, DIFF_NOTES: X_NOTES,
} = await import('../dev/js/tools/diff-core.js');

/** 固化种子（xorshift32）：X4/X5 那 200 组不能靠 `Math.random`，红第二次就得原样重放 */
const xRng = (seed = 20260930) => {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};
/** 朴素 LCS 长度：编辑脚本长度的**对侧口径**（`cost = n + m − 2·LCS`），滚动数组够用就行 */
const xLcs = (a, b) => {
  const m = b.length;
  let prev = new Uint32Array(m + 1);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Uint32Array(m + 1);
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[m];
};
/**
 * ops 的三条不变式（X5）：① 文档顺序不回退 ② 段与段之间不留空洞也不重叠
 * ③ 两侧各自覆盖到末行。`equal` 两侧必须等长，否则 `rowsOfRun` 那套配对规则从源头就是假的。
 */
const xInvariants = (ops, n, m, tag) => {
  const errs = [];
  let pa = 0;
  let pb = 0;
  for (const o of ops) {
    if (o.op === 'equal' && o.aLen !== o.bLen) errs.push(`${tag}: equal 两侧不等长`);
    if (o.a < pa) errs.push(`${tag}: a 侧文档顺序倒退（${o.a} < ${pa}）`);
    if (o.b < pb) errs.push(`${tag}: b 侧文档顺序倒退（${o.b} < ${pb}）`);
    if (o.a + o.aLen > n) errs.push(`${tag}: a 侧越界 ${o.a}+${o.aLen}>${n}`);
    if (o.b + o.bLen > m) errs.push(`${tag}: b 侧越界 ${o.b}+${o.bLen}>${m}`);
    if (o.op === 'del' && o.a !== pa) errs.push(`${tag}: a 侧有空洞或重叠（del 起点 ${o.a}，期望 ${pa}）`);
    if (o.op === 'ins' && o.b !== pb) errs.push(`${tag}: b 侧有空洞或重叠（ins 起点 ${o.b}，期望 ${pb}）`);
    if (o.op === 'equal' && (o.a !== pa || o.b !== pb)) errs.push(`${tag}: equal 起点错位`);
    pa = o.a + o.aLen;
    pb = o.b + o.bLen;
  }
  if (pa !== n) errs.push(`${tag}: a 侧没覆盖到尾（${pa} != ${n}）`);
  if (pb !== m) errs.push(`${tag}: b 侧没覆盖到尾（${pb} != ${m}）`);
  return errs;
};
/** 把 ops 分别按两侧重建回原序列：这是"ops 就是这份输入的编辑脚本"最硬的一条自证 */
const xRebuild = (ops, a, b) => {
  let ra = '';
  let rb = '';
  for (const o of ops) {
    if (o.op !== 'ins') ra += a.slice(o.a, o.a + o.aLen).join('');
    if (o.op !== 'del') rb += b.slice(o.b, o.b + o.bLen).join('');
  }
  return [ra, rb];
};
/** 造 n 行样本：`tag` 里带上行号，保证"每行都独一无二"，前后缀裁剪才量得准 */
const xRows = (n, tag, from = 0) => Array.from({ length: n }, (_, i) => `${tag}${i + from}`);
const xJoin = (arr) => `${arr.join('\n')}\n`;

test('X1 splitLines 六档形状：空串 / 只有换行 / LF / CRLF / 行内裸 \\r / 末行无换行', () => {
  // 空串是零行，一枚 `\n` 是一行空行——并成一条的话"空文件 vs 空文件"会报出非零的增删
  assert.deepEqual(dSplit(''), { lines: [], count: 0, crlf: [], finalNewline: true, bytes: 0 });
  assert.deepEqual(dSplit('\n'), { lines: [''], count: 1, crlf: [false], finalNewline: true, bytes: 1 });
  assert.deepEqual(dSplit('a\nb\n'),
    { lines: ['a', 'b'], count: 2, crlf: [false, false], finalNewline: true, bytes: 4 });
  assert.deepEqual(dSplit('a\r\nb\r\n'),
    { lines: ['a', 'b'], count: 2, crlf: [true, true], finalNewline: true, bytes: 6 },
    'CRLF 只算一次断行，行内容里不留 \\r');
  assert.deepEqual(dSplit('a\rb\n'),
    { lines: ['a\rb'], count: 1, crlf: [false], finalNewline: true, bytes: 4 },
    '行内裸 \\r 是正文：只认 \\n，剥 \\r 只剥行尾那一枚。bytes 量的是**输入全文**（含行内 \\r 和行尾 \\n），闸门那一只尺');
  assert.deepEqual(dSplit('a\nb'),
    { lines: ['a', 'b'], count: 2, crlf: [false, false], finalNewline: false, bytes: 3 },
    '末行没有换行符要单独说得出，不许静默补一个');
  // 字节口径是 UTF-8：代理对算 4，与 §S 那一本同一把尺（闸门按字节判，量错一寸就放过 4 MiB）
  assert.equal(dSplit('😀\n').bytes, 5, '一枚 emoji 是 4 字节 UTF-8 + 换行 1');
  assert.equal(dSplit('中\n').bytes, 4);
  assert.equal(dSplit('\r\n').lines.length, 1, '只有 CRLF 也是一行空行');
  assert.equal(dSplit('\r\n').crlf[0], true);
  assert.equal(dSplit('a\n\nb\n').lines.join('|'), 'a||b', '中间那行空行不能丢');
});

test('X2 两侧同空：verdict same、ops 一条 equal、五个统计量全 0', () => {
  const r = dLines('', '');
  assert.equal(r.verdict, 'same');
  assert.equal(r.blocked, null);
  assert.equal(r.ops.length, 1, '两侧都空也给一条 equal，视图层不必为"零段"再开一档');
  assert.deepEqual(r.ops[0], { op: 'equal', a: 0, aLen: 0, b: 0, bLen: 0 });
  assert.deepEqual(r.stats, { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 });
  assert.equal(r.cost, 0);
  assert.equal(r.degraded, false);
  assert.equal(dHunks(r, 3).length, 0, '没有差异段就没有块');
  // 空 vs 非空那一档才是"增 N 行"，别和上面那格混成一件事
  const one = dLines('', 'a\n');
  assert.equal(one.verdict, 'diff');
  assert.deepEqual([one.stats.added, one.stats.removed, one.stats.changed], [1, 0, 0]);
  assert.deepEqual([one.a.count, one.b.count], [0, 1]);
});

test('X3 公共前后缀裁剪：50 行前缀与 30 行后缀原样成两条 equal', () => {
  const pre = xRows(50, 'p');
  const tail = xRows(30, 't');
  // 中段第一行两侧就不同（mid-1 对 mid-X），前缀才恰好裁到 50 那一格；
  // 尾行两侧唯一，后缀才恰好裁到 30——样本里留一格共同的行，这两条数字就都成了 51 / 31。
  const a = [...pre, 'mid-1', 'mid-2', 'mid-3', ...tail];
  const b = [...pre, 'mid-X', ...tail];
  const r = dSeq(a, b, (x, y) => x === y, X_COST);
  assert.equal(r.ops.length, 4, '法式：equal + 一条 del + 一条 ins + equal，中间那段不许再碎');
  assert.deepEqual(r.ops, [
    { op: 'equal', a: 0, aLen: 50, b: 0, bLen: 50 },
    { op: 'del', a: 50, aLen: 3, b: 50, bLen: 0 },
    { op: 'ins', a: 53, aLen: 0, b: 50, bLen: 1 },
    { op: 'equal', a: 53, aLen: 30, b: 51, bLen: 30 },
  ]);
  assert.equal(r.cost, 4, '删 3 行增 1 行 = 4，最短脚本就这么多');
  assert.equal(r.degraded, false);
  // 前后缀**都**没有的极端：整份重写，裁剪一步都不该生效
  const all = dSeq(xRows(40, 'a'), xRows(40, 'b'), (x, y) => x === y, X_COST);
  assert.equal(all.cost, 80);
  assert.equal(all.ops.length, 2, '整份重写就是一块 del + 一块 ins');
});

test('X4 最短性对拍：200 组小样本与朴素 LCS 逐组相等，不许多一格少一格', () => {
  const rnd = xRng();
  const alphas = [2, 3, 5, 8];
  const bad = [];
  for (let g = 0; g < 200; g++) {
    const alpha = alphas[g % alphas.length];
    const n = Math.floor(rnd() * 41);
    const m = Math.floor(rnd() * 41);
    const a = Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const b = Array.from({ length: m }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const r = dSeq(a, b, (x, y) => x === y, 100000);
    const want = n + m - 2 * xLcs(a, b);
    // 上限给到 10 万 = 这一族根本不该降级：降了就是把最短脚本换成了"整块删 + 整块增"
    if (r.degraded) bad.push(`g${g}(n=${n},m=${m}): 不该降级`);
    if (r.cost > want) bad.push(`g${g}(n=${n},m=${n}): cost ${r.cost} > 最短 ${want}`);
    // 也不许"短于"最短：那说明 ops 少覆盖了行，对拍当场就该红
    if (r.cost < want) bad.push(`g${g}(n=${n},m=${m}): cost ${r.cost} < 最短 ${want}，等于凭空丢了行`);
  }
  assert.deepEqual(bad, [], `对拍 200 组，失败 ${bad.length} 项：\n${bad.slice(0, 8).join('\n')}`);
});

test('X5 ops 三条不变式在 X4 那 200 组上逐组成立，且两侧都能重建回原序列', () => {
  const rnd = xRng();
  const alphas = [2, 3, 5, 8];
  const bad = [];
  for (let g = 0; g < 200; g++) {
    const alpha = alphas[g % alphas.length];
    const n = Math.floor(rnd() * 41);
    const m = Math.floor(rnd() * 41);
    const a = Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const b = Array.from({ length: m }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const r = dSeq(a, b, (x, y) => x === y, 100000);
    for (const e of xInvariants(r.ops, n, m, `g${g}(n=${n},m=${m})`)) bad.push(e);
    const [ra, rb] = xRebuild(r.ops, a, b);
    if (ra !== a.join('')) bad.push(`g${g}: a 侧重建不一致`);
    if (rb !== b.join('')) bad.push(`g${g}: b 侧重建不一致`);
    // `mergeRuns` 的法式：一段里只许"一条 del + 一条 ins"相邻，不许出现 ins 紧跟 ins
    for (let i = 1; i < r.ops.length; i++) {
      if (r.ops[i].op === 'ins' && r.ops[i - 1].op === 'ins') bad.push(`g${g}: 第 ${i} 条是连续两条 ins，没归一`);
      if (r.ops[i].op === 'del' && r.ops[i - 1].op === 'del') bad.push(`g${g}: 第 ${i} 条是连续两条 del，没归一`);
      if (r.ops[i].op === 'equal' && r.ops[i - 1].op === 'equal') bad.push(`g${g}: 第 ${i} 条是连续两条 equal，没归一`);
    }
  }
  assert.deepEqual(bad, [], `200 组的不变式检查失败 ${bad.length} 项：\n${bad.slice(0, 8).join('\n')}`);
});

test('X6 归一化只影响判等：ignored 那几行的 textA/textB 仍是原文、行号仍按原文', () => {
  // 第 2 行两侧原文不同（一个空格对两个空格），勾了 ws 才算相同；第 4 行是真改动。
  // 必须留一格真改动：全都判等就没有差异块，hunksOf 按设计返回空数组，"递原文"那一格反而没人验。
  const a = 'x\na b\ny\nZ\n';
  const b = 'x\na  b\ny\nQ\n';
  const on = dLines(a, b, { ws: true });
  assert.equal(on.verdict, 'diff');
  assert.equal(on.stats.ignored, 1, '被归一化抹平的那一行要计数，否则页面上那句"忽略过空白"没有着落');
  assert.equal(on.stats.changed, 1, '只有 Z→Q 那一格算改动');
  assert.equal(on.stats.unchanged, 3);
  assert.equal(dLines(a, b).stats.changed, 2, '不勾 ws，那两格都算改动');
  const rows = dHunks(on, X_CTX).flatMap((h) => h.rows);
  const flat = rows.find((r) => r.kind === 'equal' && r.textA !== r.textB);
  assert.ok(flat, '归一化只进比较键：hunksOf 递出来的还是原文');
  assert.equal(flat.textA, 'a b');
  assert.equal(flat.textB, 'a  b');
  assert.deepEqual([flat.a, flat.b], [1, 1], '行号按原文数，不许因为归一化就少一行');
  // 原文与行号同源第三条路：unified 文本里出现的也必须是原文那一格
  const uni = dUnified(on);
  assert.match(uni, / a b\n/, `上下文行写的是原文：${JSON.stringify(uni)}`);
  assert.equal(uni.includes('a  b'), false, '上下文行不许"顺手归一化"过再写出去');
});

test('X7 ws 档：并成空格算相同，删空白不等于把词也并掉', () => {
  assert.equal(dKey('a b', { ws: true }), dKey('a  b', { ws: true }), '连续空白并成一格');
  assert.equal(dKey(' x', { ws: true }), dKey('x', { ws: true }), '首尾空白去掉');
  assert.equal(dKey('\tx\t', { ws: true }), 'x', '制表符也是空白');
  assert.notEqual(dKey('ab', { ws: true }), dKey('a b', { ws: true }),
    "'ab' 与 'a b' 必须判不同：把空白全删掉会造出一批用户读不出来的'相同'");
  assert.equal(dKey('a b'), 'a b', '不勾就是原文');
  const r = dLines('foo 1\t2\n', 'foo 1 2\n', { ws: true });
  assert.equal(r.verdict, 'same');
  assert.equal(r.stats.ignored, 1);
  assert.equal(dLines('foo 1 2\n', 'foo1 2\n', { ws: true }).verdict, 'diff',
    '同一个口径在主入口那一层也得成立');
});

test('X8 case 档：Foo 与 foo 判相同，数字串不受影响', () => {
  assert.equal(dKey('Foo', { case: true }), 'foo');
  assert.equal(dKey('123', { case: true }), '123', 'toLowerCase 对数字是恒等，别把它写成"只改字母"的样子货');
  assert.notEqual(dKey('Foo'), dKey('foo'), '不勾就是两行');
  assert.equal(dKey('中', { case: true }), '中');
  // 两档同时勾：先后是定死的（先 ws 后 case），交错写出来就不是同一个键
  assert.equal(dKey('  Foo BAR ', { ws: true, case: true }), 'foo bar');
  const r = dLines('Foo\nbar\n', 'foo\nbar\n', { case: true });
  assert.equal(r.verdict, 'same');
  assert.equal(r.stats.ignored, 1);
  assert.equal(dLines('Foo\nbar\n', 'foo\nbar\n').verdict, 'diff');
  // 行内细化跟着同一把尺：勾了 case 就不该在行里再标一处"改动"
  assert.deepEqual(dInline('Foo bar', 'foo bar', { case: true }), [{ t: 'equal', text: 'Foo bar' }]);
  assert.deepEqual(dInline('Foo bar', 'foo bar', {}),
    [{ t: 'del', text: 'Foo' }, { t: 'ins', text: 'foo' }, { t: 'equal', text: ' bar' }]);
});

test('X9 CRLF：默认算差异且 crlfA/crlfB 说得清，勾了 ws 之后并入空白档不算', () => {
  const r = dLines('a\nb\n', 'a\r\nb\r\n');
  assert.equal(r.verdict, 'diff', '行尾形状也是内容：LF 文件对 CRLF 文件必须报差异');
  assert.deepEqual([r.stats.added, r.stats.removed], [2, 2]);
  const rows = dHunks(r, X_CTX).flatMap((h) => h.rows);
  const chg = rows.filter((x) => x.kind === 'change');
  assert.equal(chg.length, 2);
  assert.equal(chg[0].crlfA, false);
  assert.equal(chg[0].crlfB, true, '视图层拿这两格画 ␍，行号与原文都不受影响');
  assert.equal(chg[0].textB, 'a', '剥出来的 \\r 不在行内容里，只在 crlfB 那一格');
  const on = dLines('a\nb\n', 'a\r\nb\r\n', { ws: true });
  assert.equal(on.verdict, 'same', '勾了忽略空白之后行尾回车并进同一档，不再算差异');
  assert.equal(on.stats.ignored, 2, '"归一化抹平了几行"要数得出来，那句说明才有数字');
  assert.deepEqual(dKey('a', { crlf: true }), 'a\r', 'crlf 那一档是补上 \\r 再比，不是比较时特殊对待');
  assert.throws(() => dInline('a', 'b', { crlf: true }), TypeError,
    'inlineDiff 不认 crlf：行尾形状在行级已经判过等，这里递下去就是拼错的开关');
});

test('X10 末行缺换行符单独成档：finalNewline 两侧各一格，那句说明非空', () => {
  const r = dLines('a\nb', 'a\nb\n');
  assert.equal(r.a.finalNewline, false);
  assert.equal(r.b.finalNewline, true);
  assert.equal(r.verdict, 'same', '那一档不是"少一行"：行数相同、内容相同，缺的只是一个换行');
  assert.deepEqual([r.a.count, r.b.count], [2, 2]);
  assert.equal(typeof X_NOTES.finalNewline, 'string');
  assert.ok(X_NOTES.finalNewline.length > 0, '点亮时要用的那句话不许是空串');
  assert.ok(X_NOTES.finalNewline.includes(X_CR), `那句话要说清回车上屏长什么样：${X_NOTES.finalNewline}`);
  // 末行缺换行的两侧都是缺：那一档在 unified 里是 `\ No newline`，不是"两边都一样"就完事
  const both = dLines('a\nb', 'a\nb');
  assert.equal(both.verdict, 'same');
  assert.equal(both.a.finalNewline, false);
  assert.equal(both.b.finalNewline, false);
  assert.equal(both.stats.ignored, 0, '没勾归一化就没有"抹平"，这一格不许凭空非零');
});

// 闸门那一档要"真超线"才量得准：5 MiB + 7 字节，跟着常量拼，别手抄 5242880。
const X_HUGE = 'q'.repeat(X_BYTES + 7);
const X_TOO_MANY = 'a\n'.repeat(X_LINES + 3);

test('X11 gate 按侧拒：只 A 超字节 / 只 B 超字节 / 两侧都超 / 只 A 超行数，四种形状各自的 which 与 over', () => {
  const shape = (g) => ({ ok: g.ok, which: g.which, reason: g.reason, over: g.over });
  assert.deepEqual(shape(dGate('a\n', 'b\n')), {
    ok: true, which: null, reason: null, over: { bytesA: 0, bytesB: 0, linesA: 0, linesB: 0 },
  }, '没超线时四格差额都必须是 0，页面那句"超出 N"不许凭空报一个数');
  assert.deepEqual(shape(dGate(X_HUGE, 'b\n')), {
    ok: false, which: 'a', reason: 'bytes', over: { bytesA: 7, bytesB: 0, linesA: 0, linesB: 0 },
  }, '只 A 超字节：which 说的是 a，over 里也只有 bytesA 非零');
  assert.equal(shape(dGate('b\n', X_HUGE)).over.bytesB, 7, '换一侧超，报的就得换一侧');
  assert.deepEqual(shape(dGate(X_HUGE, X_HUGE)), {
    ok: false, which: 'both', reason: 'bytes', over: { bytesA: 7, bytesB: 7, linesA: 0, linesB: 0 },
  });
  const lines = shape(dGate(X_TOO_MANY, 'b\n'));
  assert.deepEqual([lines.ok, lines.which, lines.reason, lines.over.linesA], [false, 'a', 'lines', 3],
    '超行数那一档：量纲是行，不是字节');
  // 两档先后是定死的：先字节、后行数。同一侧都超时报字节，另一侧的差额仍留在表里。
  const mixed = shape(dGate(X_HUGE, X_TOO_MANY));
  assert.deepEqual([mixed.which, mixed.reason], ['a', 'bytes'], 'B 侧超行数排在字节之后，先说量纲大的那件');
  assert.deepEqual([mixed.over.bytesA, mixed.over.bytesB, mixed.over.linesA, mixed.over.linesB], [7, 0, 0, 3],
    '差额四格是同一本账：页面能一次说清"这侧超字节、那侧超行数"两处');
  // 按侧判而不是合计判：一侧塞满、一侧空着，合计口径会把整页拒掉（spec §5.6 第 1 条）
  const g = dGate(X_HUGE, 'b\n');
  assert.equal(g.a.count, 1, '闸门不过也得把两份拆行结果递出去，页面要报"你这侧多少行、多少字节"');
  assert.equal(g.b.bytes, 2);
  assert.equal(g.b.count, 1);
});

test('X12 拒时给差额，且闸门不过时 diffLines 不做任何对齐：verdict blocked、ops 空、形状照样齐', () => {
  const r = dLines(X_HUGE, 'b\n');
  assert.equal(r.verdict, 'blocked');
  assert.deepEqual(r.ops, [], '一行都不许对齐：那才是"闸门"，不是"建议"');
  assert.deepEqual(r.segments, []);
  assert.equal(r.cost, 0);
  assert.equal(r.degraded, false);
  assert.deepEqual(r.stats, { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 });
  assert.deepEqual(r.blocked, { which: 'a', reason: 'bytes', over: { bytesA: 7, bytesB: 0, linesA: 0, linesB: 0 } });
  assert.equal(r.a.bytes, X_BYTES + 7, '差额之外还要给实测值，那句"你这侧 5.0 MB"从它出');
  assert.ok(r.inlineByKey instanceof Map && r.inlineByKey.size === 0,
    '视图层拿 inlineByKey 是无条件的：闸门那一档少这一格就是 undefined.size');
  assert.deepEqual(dHunks(r, X_CTX), [], '没有对齐结果就没有块');
  assert.equal(dUnified(r), '', 'unified 那一栏在拒的那一档必须是空串，不是报错');
});

test('X13 MAX_COST 降级：中段整块 del + 整块 ins，两侧行数一行不少（降级不是截断）', () => {
  const midA = xRows(1200, 'A');
  const midB = xRows(900, 'B');
  const a = [...xRows(10, 'c'), ...midA, ...xRows(10, 't')];
  const b = [...xRows(10, 'c'), ...midB, ...xRows(10, 't')];
  const r = dSeq(a, b, (x, y) => x === y, X_COST);
  assert.equal(r.degraded, true, '中段 1200×900 全不相干，D 越了 MAX_COST 那一档');
  assert.deepEqual(r.ops.map((o) => `${o.op}:${o.a},${o.aLen},${o.b},${o.bLen}`), [
    'equal:0,10,0,10', 'del:10,1200,10,0', 'ins:1210,0,10,900', 'equal:1210,10,910,10',
  ], '降级只换掉那一段的配对方式：前后两段 equal 原样留着');
  assert.equal(r.cost, midA.length + midB.length);
  const [ra, rb] = xRebuild(r.ops, a, b);
  assert.equal(ra, a.join(''), '降级那一档也不许丢行');
  assert.equal(rb, b.join(''));
  const res = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.equal(res.degraded, true);
  assert.equal(res.verdict, 'diff');
  assert.deepEqual([res.stats.removed, res.stats.added, res.stats.unchanged, res.stats.blocks], [1200, 900, 20, 1]);
  const rows = dHunks(res, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.filter((x) => x.a !== null).length, res.a.count, 'a 侧 1220 行一行不少');
  assert.equal(rows.filter((x) => x.b !== null).length, res.b.count, 'b 侧 920 行同理');
});

test('X14 DIFF_NOTES.degraded 非空且带 MAX_COST 那个数，降级档的脚本不短于不降级档', () => {
  const rnd = xRng(20260931);
  const mk = (n, alpha) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
  const a = mk(80, 4);
  const b = mk(70, 4);
  const capped = dSeq(a, b, (x, y) => x === y, 3);
  const free = dSeq(a, b, (x, y) => x === y, 1e9);
  assert.equal(capped.degraded, true);
  assert.equal(free.degraded, false);
  assert.ok(free.cost > 3, '这份样本必须真越得过那道闸门，否则两条走同一条路，这一判就成了空判');
  assert.ok(capped.cost >= free.cost, `降级给的是"整块删+整块增"，只会更长不会更短：${capped.cost} vs ${free.cost}`);
  assert.deepEqual(xInvariants(capped.ops, a.length, b.length, 'degraded'), [], '降级档的 ops 照样得守三条不变式');
  assert.ok(X_NOTES.degraded.length > 0);
  assert.ok(X_NOTES.degraded.includes(String(X_COST)), `那句话里的数字要从常量插：${X_NOTES.degraded}`);
  assert.ok(X_NOTES.degraded.includes('一行'), '那句还得说清"行数不会少"，用户才不会被"变了样"吓到');
});

test('X15 inlineDiff 四类 token：ASCII 词、空白串、标点、逐码点的 CJK——改一个汉字只标那一个字的 token', () => {
  assert.deepEqual(dInline('改成汉字好', '改成中文字好', {}), [
    { t: 'equal', text: '改成' }, { t: 'del', text: '汉' }, { t: 'ins', text: '中文' }, { t: 'equal', text: '字好' },
  ], 'CJK 逐码点成一枚：删的那一侧就是"汉"这一个字，不许把整句标红');
  assert.deepEqual(dInline('let a = 1;', 'let a = 2;', {}), [
    { t: 'equal', text: 'let a = ' }, { t: 'del', text: '1' }, { t: 'ins', text: '2' }, { t: 'equal', text: ';' },
  ], 'ASCII 词只吃 [A-Za-z0-9_]+，词间空白各成一枚，标点 ; 单独一枚');
  assert.deepEqual(dInline('a.b', 'a-c', {}), [
    { t: 'equal', text: 'a' }, { t: 'del', text: '.b' }, { t: 'ins', text: '-c' },
  ], '标点不是词的一部分：a. 与 a- 里只有 a 能对上');
  assert.deepEqual(dInline('x  y', 'x y', {}), [
    { t: 'equal', text: 'x' }, { t: 'del', text: '  ' }, { t: 'ins', text: ' ' }, { t: 'equal', text: 'y' },
  ], '连续空白并成一枚：两格对一格正好一对，不是拆成两枚各删一枚');
  assert.deepEqual(dInline('中文 abc 123', '中文 abcd 123', {}), [
    { t: 'equal', text: '中文 ' }, { t: 'del', text: 'abc' }, { t: 'ins', text: 'abcd' }, { t: 'equal', text: ' 123' },
  ], '数字跟着词（123 是一枚），不另起第三条');
  for (const [a, b] of [['改成汉字好', '改成中文字好'], ['let a = 1;', 'let a = 2;'], ['a.b', 'a-c']]) {
    const s = dInline(a, b, {});
    assert.equal(s.filter((x) => x.t !== 'ins').map((x) => x.text).join(''), a, `重建 a 侧不许吞字：${a}`);
    assert.equal(s.filter((x) => x.t !== 'del').map((x) => x.text).join(''), b, `重建 b 侧不许吞字：${b}`);
  }
  assert.deepEqual(dInline('', '', {}), [], '两行都空就是零段，不许造一条 equal:""');
  assert.deepEqual(dInline('abc', 'abc', {}), [{ t: 'equal', text: 'abc' }]);
});

test('X16 emoji：代理对 / ZWJ 序列 / 旗标 / 变体选择符，切完不得出现孤立代理项', () => {
  // 孤立代理项上屏是  或空白，而行内高亮正是"逐段塞进 <span>"——那一格坏了用户只会说"字少了"。
  const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const samples = [
    ['a😀b', 'a😃b'],
    ['👩‍💻 ok', '👨‍💻 ok'],
    ['🇨🇳🇺🇸', '🇨🇳🇩🇪'],
    ['❤️ red', '💗 red'],
  ];
  for (const [a, b] of samples) {
    const s = dInline(a, b, {});
    assert.ok(Array.isArray(s), `这一对不该被形状闸门拦下：${a}`);
    for (const x of s) {
      assert.equal(LONE.test(x.text), false, `段里有孤立代理项：${JSON.stringify(x.text)}`);
      assert.doesNotThrow(() => encodeURIComponent(x.text), `encodeURIComponent 都拒的段就是坏段：${JSON.stringify(x.text)}`);
    }
    assert.equal(s.filter((x) => x.t !== 'ins').map((x) => x.text).join(''), a, '重建 a 侧');
    assert.equal(s.filter((x) => x.t !== 'del').map((x) => x.text).join(''), b, '重建 b 侧');
  }
  assert.deepEqual(dInline('a😀b', 'a😃b', {}), [
    { t: 'equal', text: 'a' }, { t: 'del', text: '😀' }, { t: 'ins', text: '😃' }, { t: 'equal', text: 'b' },
  ], '一枚 emoji 是一枚 token：不许把代理对劈成两半各标一次');
});

test('X17 MAX_INLINE_TOKENS 退化：越线那一对 inline:null，且 stats.inlineSkipped 计数 +1', () => {
  const longA = '字'.repeat(X_TOKENS + 1000);
  const longB = `${longA}改`;
  assert.equal(dInline(longA, longB, {}), null, '单侧切到上限零一枚就收手，不为一行建那张百万项的表');
  const r = dLines(`${longA}\nq1\n`, `${longB}\nq2\n`);
  assert.deepEqual([r.stats.changed, r.stats.inlineSkipped], [2, 1], '只有越线那一对退化，另一对照常细化');
  assert.equal(r.inlineByKey.has('0:0'), false, '越线那一对不举行内结果');
  assert.equal(r.inlineByKey.has('1:1'), true, '同一次调用里，下一对不该被连坐');
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.find((x) => x.a === 0).inline, null, '视图层拿到的那一格必须是 null，不是 undefined 也不是空表');
  assert.ok(X_NOTES.inlineSkipped.length > 0);
  assert.ok(X_NOTES.inlineSkipped.includes(String(X_TOKENS)), `那句话里的数字从常量插：${X_NOTES.inlineSkipped}`);
});

test('X18 五个统计量逐格定义 + 那条自洽关系（added ≥ changed、removed ≥ changed、blocks 数法）', () => {
  const a = 'k1\nk2\nD1\nD2\nk3\nk4\nk5\nk6\nk7\nX1\nX2\n';
  const b = 'k1\nk2\nk3\nk4\nk5\nk6\nk7\nY1\nY2\nY3\nk8\n';
  const r = dLines(a, b);
  assert.deepEqual(r.stats, { added: 4, removed: 4, changed: 2, unchanged: 7, blocks: 2, inlineSkipped: 0, ignored: 0 });
  assert.equal(r.stats.unchanged + r.stats.removed, r.a.count, 'a 侧每一行要么对上、要么只在 a 侧出现');
  assert.equal(r.stats.unchanged + r.stats.added, r.b.count, 'b 侧同理');
  assert.ok(r.stats.added >= r.stats.changed && r.stats.removed >= r.stats.changed, '改动行同时计入增与删');
  assert.ok(r.stats.blocks <= r.segments.length, 'blocks 数的是极大非等段，一段既删又增只算一块');
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.deepEqual(rows.map((x) => x.kind), ['equal', 'equal', 'del', 'del', 'equal', 'equal', 'equal', 'equal', 'equal', 'change', 'change', 'ins', 'ins']);
  assert.equal(rows.filter((x) => x.kind === 'change').length, r.stats.changed, '"改 K 处"与 change 行同源');
  assert.equal(rows.filter((x) => x.kind === 'del').length + r.stats.changed, r.stats.removed);
  assert.equal(rows.filter((x) => x.kind === 'ins').length + r.stats.changed, r.stats.added);
  assert.equal(dHunks(r, 0).length, r.stats.blocks, 'context 0 时一块就是一段：折叠条数与"处"数是同一件事');
  assert.deepEqual([dLines('a\n', 'a\nb\n').stats.added, dLines('a\n', 'a\nb\n').stats.changed], [1, 0], '纯增：changed 必须是 0');
  assert.equal(dLines('a\nb\n', 'a\n').stats.changed, 0, '纯删同理');
  assert.deepEqual(dLines('x\ny\n', 'x\ny\n').stats, { added: 0, removed: 0, changed: 0, unchanged: 2, blocks: 0, inlineSkipped: 0, ignored: 0 });
});

test('X19 stats.ignored 只在归一化开启时非零，关掉就是 0', () => {
  const a = 'a b\nc\n';
  const b = 'a  b\nd\n';
  assert.equal(dLines(a, b).stats.ignored, 0, '没勾任何归一化就不许有"被抹平"的行');
  assert.equal(dLines(a, b, { ws: false, case: false }).stats.ignored, 0, '显式写 false 与不写同一条路');
  assert.equal(dLines(a, b, { ws: true }).stats.ignored, 1);
  const cs = dLines('Foo\nbar\n', 'foo\nbar\n', { case: true });
  assert.equal(cs.stats.ignored, 1);
  assert.equal(cs.verdict, 'same', 'ignored 那几行进的是 unchanged，不是 added/removed');
  assert.equal(dLines('a\n', 'a\r\n', { ws: true }).stats.ignored, 1, '行尾回车并进空白那一档，也算被抹平');
  assert.equal(dLines('a\n', 'a\r\n').stats.ignored, 0, '不勾 ws，行尾形状是差异而不是被忽略的行');
  for (const r of [dLines(a, b), dLines(a, b, { ws: true }), cs, dLines('a\n', 'a\r\n', { ws: true })]) {
    assert.equal(r.stats.unchanged + r.stats.removed, r.a.count,
      'ignored 不许从 unchanged 里再扣一次：它只是 unchanged 中"原文其实不同"的那几行');
    assert.equal(r.stats.unchanged + r.stats.added, r.b.count);
  }
});

test('X20 hunksOf(result, 3)：块内首尾各 3 行 equal，skipped 数的是被折掉的行数', () => {
  const a = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const r = dLines(a, a.replace('C1', 'Z1').replace('C2', 'Z2'));
  const hk = dHunks(r, 3);
  assert.equal(hk.length, 2);
  assert.deepEqual(hk[0].rows.map((x) => x.kind), ['equal', 'equal', 'equal', 'change', 'equal', 'equal', 'equal'], '首尾各 3 行上下文');
  assert.deepEqual([hk[0].aFrom, hk[0].aTo, hk[0].skipped, hk[0].tailSkipped], [7, 14, 7, 0], 'skipped 是折掉的行数：前 10 行只留 3 行');
  assert.deepEqual([hk[1].aFrom, hk[1].aTo, hk[1].skipped, hk[1].tailSkipped], [28, 35, 14, 7], '只有末块那一格才带尾折');
  assert.equal(hk[0].rows[0].a, 7);
  assert.equal(hk[0].rows[0].textA, 'e7');
  assert.equal(hk[1].rows[0].textA, 'm17');
  const folded = hk.reduce((s, h) => s + h.skipped + h.rows.length, 0) + hk[hk.length - 1].tailSkipped;
  assert.equal(folded, 42, '折掉的 + 露出的 + 尾折的 == 虚拟行流全长，少一行就是折叠算错了');
  const one = dHunks(r, 1);
  assert.deepEqual(one[0].rows.map((x) => x.kind), ['equal', 'change', 'equal']);
  assert.deepEqual([one[0].skipped, one[1].skipped, one[1].tailSkipped], [9, 18, 9]);
  // 并块的那一档边界：间距恰好 2×context 时两块必须并成一块。Task 8 的 X-5 那一刀（`lo <= last.hi`
  // 改成 `lo < last.hi`）在上面那两份样本里量不到——它们的间距是 20 与 10，都不是 6，而分成两块时
  // 行集仍逐格相同（7+7 == 14），只是"共几处 / 第几处"的读数与折叠条的归属会变。钉住这一格，
  // `<=` 才不是写着好看的保险。
  const tA = [...xRows(4, 'a'), 'C1', ...xRows(6, 'e'), 'C2', ...xRows(4, 'b')].join('\n');
  const tH = dHunks(dLines(tA, tA.replace('C1', 'Z1').replace('C2', 'Z2')), 3);
  assert.equal(tH.length, 1, '间距 == 2×context：前后上下文正好相接，该并成一块而不是贴着的两块');
  assert.equal(tH[0].rows.length, 14, '并块那一格的行数：3+1+3 与 3+1+3 相接，中间那 6 行不重复也不缺席');
  const gA = [...xRows(4, 'a'), 'C1', ...xRows(7, 'e'), 'C2', ...xRows(4, 'b')].join('\n');
  const gH = dHunks(dLines(gA, gA.replace('C1', 'Z1').replace('C2', 'Z2')), 3);
  assert.deepEqual(gH.map((h) => h.rows.length), [7, 7], '间距 = 2×context + 1：中间多出的那一行被折掉，才分得出两块');
  assert.deepEqual(gH.map((h) => h.skipped), [1, 1], '两块各带自己的省略数：第一块的 1 是头尾钳位后的账');
});

test('X21 context=Infinity 摊出全部行；context 传非数值 / 负数 / 小数一律 TypeError', () => {
  const a = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const r = dLines(a, a.replace('C1', 'Z1').replace('C2', 'Z2'));
  const inf = dHunks(r, Infinity);
  assert.equal(inf.length, 1, '全展开就是一块');
  assert.equal(inf[0].rows.length, 42, '全部行：42 格一行不少');
  assert.deepEqual([inf[0].skipped, inf[0].tailSkipped], [0, 0], '全展开没有折掉的行');
  assert.deepEqual([inf[0].aFrom, inf[0].aTo, inf[0].bFrom, inf[0].bTo], [0, 42, 0, 42]);
  assert.equal(dHunks(r, 0).length, 2, 'context 0 就是两块，各带 0 行上下文');
  for (const bad of ['all', true, null, {}, NaN, -1, 1.5]) {
    assert.throws(() => dHunks(r, bad), TypeError, `context=${String(bad)} 必须点名拒，不许当 0 用`);
  }
  assert.throws(() => dHunks({ ops: 'no' }, 3), TypeError, 'result 不是 diffLines 的返回值也要点名');
});

test('X22 边界：差异就在第 1 行 / 就在末行时，首块与末块的 skipped 不得为负、不得凭空多上下文', () => {
  const first = dHunks(dLines('C1\nb\nc\nd\ne\nf\ng\n', 'Z1\nb\nc\nd\ne\nf\ng\n'), 3);
  assert.equal(first.length, 1);
  assert.deepEqual([first[0].aFrom, first[0].aTo, first[0].skipped, first[0].tailSkipped], [0, 4, 0, 3], '前头只有 0 行可给，不许凑出 -3 行');
  assert.deepEqual(first[0].rows.map((x) => x.kind), ['change', 'equal', 'equal', 'equal']);
  assert.equal(first[0].rows[0].a, 0);
  const last = dHunks(dLines('a\nb\nc\nd\ne\nf\nC7\n', 'a\nb\nc\nd\ne\nf\nZ7\n'), 3);
  assert.deepEqual([last[0].aFrom, last[0].aTo, last[0].skipped, last[0].tailSkipped], [3, 7, 3, 0], '末行之后没有行，尾折必须是 0');
  assert.deepEqual(last[0].rows.map((x) => x.kind), ['equal', 'equal', 'equal', 'change']);
  // 只有一侧有行的块：本侧区间是空的，落点也得是个有限的数
  const del = dHunks(dLines('a\nb\nc\nd\ne\n', 'a\ne\n'), 1)[0];
  assert.deepEqual([del.aFrom, del.aTo, del.bFrom, del.bTo], [0, 5, 0, 2]);
  const ins = dHunks(dLines('a\ne\n', 'a\nb\nc\nd\ne\n'), 1)[0];
  assert.deepEqual([ins.aFrom, ins.aTo, ins.bFrom, ins.bTo], [0, 2, 0, 5]);
  const empty = dHunks(dLines('', 'a\nb\n'), 3)[0];
  assert.deepEqual([empty.aFrom, empty.aTo, empty.bFrom, empty.bTo], [0, 0, 0, 2], '整侧为空：区间退化成锚点，不许是 Infinity');
  assert.equal(dUnified(dLines('', 'a\nb\n'), { context: 3 }), '--- A\n+++ B\n@@ -1,0 +1,2 @@\n+a\n+b\n', '空侧的头写 ,0——那是"插在这里"的唯一写法');
});

test('X23 unifiedText 的 @@ -a,b +c,d @@ 与手算逐字符对照，单行区间不省略 ,1', () => {
  const r = dLines('a\nb\nc\nd\n', 'a\nX\nc\nd\n');
  assert.equal(dUnified(r, { a: 'A.txt', b: 'B.txt', context: 1 }),
    '--- A.txt\n+++ B.txt\n@@ -1,3 +1,3 @@\n a\n-b\n+X\n c\n');
  assert.equal(dUnified(r, { context: 0 }),
    '--- A\n+++ B\n@@ -2,1 +2,1 @@\n-b\n+X\n',
    '单行区间也得写 ,1：省略是 git 的排版偏好，不是格式的必要部分，而本站的对照判据逐字符');
  const a2 = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const two = dLines(a2, a2.replace('C1', 'Z1').replace('C2', 'Z2'));
  assert.equal(dUnified(two, { context: 3 }),
    '--- A\n+++ B\n@@ -8,7 +8,7 @@\n e7\n e8\n e9\n-C1\n+Z1\n m0\n m1\n m2\n@@ -29,7 +29,7 @@\n m17\n m18\n m19\n-C2\n+Z2\n f0\n f1\n f2\n',
    '两块的头、上下文、改动行全部逐字符钉住');
  assert.deepEqual(dUnified(two, { context: 1 }).split('\n').filter((l) => l.startsWith('@@')),
    ['@@ -10,3 +10,3 @@', '@@ -31,3 +31,3 @@'], '头里的行号从 1 起，长度是"这一块的行数"');
  assert.equal(dUnified(dLines('a\nb\nc\nd\ne\n', 'a\ne\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,5 +1,2 @@\n a\n-b\n-c\n-d\n e\n', '纯删：+ 侧只有 2 行');
  assert.equal(dUnified(dLines('a\ne\n', 'a\nb\nc\nd\ne\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,2 +1,5 @@\n a\n+b\n+c\n+d\n e\n', '纯增：镜像那一档');
});

test('X24 unifiedText 两侧都空只有头两行；两名默认 A/B，传入才换', () => {
  const empty = dLines('', '');
  assert.equal(dUnified(empty), '--- A\n+++ B\n', '一块都没有，就只有那两行文件头');
  assert.equal(dUnified(empty, { a: 'x.txt', b: 'y.txt' }), '--- x.txt\n+++ y.txt\n');
  assert.equal(dUnified(empty, { a: '', b: '' }), '--- A\n+++ B\n', '空串名回落成默认，不许写出 "--- " 那种半截头');
  assert.equal(dUnified(empty, { a: 42 }), '--- A\n+++ B\n', '非字符串的名同样回落，不许把 42 拼进头里');
  assert.equal(dUnified(empty, { context: 99 }), '--- A\n+++ B\n', 'context 再大也不许凭空造出一块');
  assert.equal(dUnified(dLines(X_HUGE, 'b\n')), '', 'blocked 那一档是空串，连文件头都不写');
});

test('X25 unifiedText 里 \\r 的处理与 X1/X9 同口径：行尾回车原样带出去，不许悄悄吃掉', () => {
  assert.equal(dUnified(dLines('a\r\nb\r\n', 'a\nb\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,2 +1,2 @@\n-a\r\n+a\n-b\r\n+b\n', 'CRLF 对 LF 是差异，两个 \\r 都得在文本里看得见');
  assert.equal(dLines('a\r\nb\r\n', 'a\r\nb\r\n').verdict, 'same');
  assert.equal(dUnified(dLines('a\r\nb\r\n', 'a\r\nb\r\n')), '--- A\n+++ B\n', '判等就没有内容行');
  const ctx = dLines('q\na\r\nz\n', 'q\na\r\nZ\n', { ws: true });
  assert.equal(dUnified(ctx, { context: 1 }), '--- A\n+++ B\n@@ -2,2 +2,2 @@\n a\r\n-z\n+Z\n',
    '上下文行的行尾取 a 侧：两侧到这里已判等，那一格差别只在勾了归一化时才可能存在');
  assert.equal(dUnified(dLines('a\nb', 'a\nB'), { context: 0 }),
    '--- A\n+++ B\n@@ -2,1 +2,1 @@\n-b\n+B\n\\ No newline at end of file\n',
    '末行缺换行要写 git 那一句，不许静默补一个换行');
});

test('X26 入参闸门：非字符串一律 TypeError 点名，报错要说清是哪个调用的哪一个参数', () => {
  const bad = [null, undefined, 42, {}, ['a\n'], Symbol('x'), true];
  const callSites = [
    ['splitLines(text)', (v) => dSplit(v)],
    ['compareKey(line, opts)', (v) => dKey(v)],
    ['gate(textA, textB)', (v) => dGate(v, 'a\n')],
    ['gate(textA, textB)', (v) => dGate('a\n', v)],
    ['diffLines(textA, textB, opts)', (v) => dLines(v, 'a\n')],
    ['inlineDiff(lineA, lineB, opts)', (v) => dInline(v, 'a', {})],
  ];
  for (const [site, fn] of callSites) {
    for (const v of bad) assert.throws(() => fn(v), TypeError, `${site} 对 ${String(v)} 必须红`);
    try {
      fn(42);
      assert.fail(`${site} 放行了 number`);
    } catch (e) {
      assert.ok(e instanceof TypeError);
      assert.ok(e.message.includes(site), `${site} 的报错没点名调用处：${e.message}`);
    }
  }
  assert.throws(() => dHunks(null, 3), TypeError);
  assert.throws(() => dUnified(null), TypeError);
  assert.throws(() => dUnified(dLines('a\n', 'b\n'), []), TypeError, 'names 是数组也算非法形状');
  assert.throws(() => dSeq(null, [], (x, y) => x === y, 10), TypeError);
  assert.throws(() => dSeq(['a'], 'b', (x, y) => x === y, 10), TypeError);
  assert.throws(() => dSeq(['a'], ['b'], 'no', 10), TypeError, 'equals 不是函数同样点名，不许静默当"全不等"');
  assert.throws(() => dSeq(['a'], ['b'], (x, y) => x === y, 0), TypeError, 'maxCost=0 会让每一格都降级，是拼错的常量不是档位');
  assert.equal(dLines('a\n', 'a\n', undefined).verdict, 'same', 'opts 的 undefined 是"不传"，不是"传了个非法值"');
});

test('X27 opts 取值档：truthy 但非法的值一律 TypeError，未知键也拒', () => {
  for (const v of ['yes', 1, [], {}, 'true']) {
    assert.throws(() => dLines('a\n', 'b\n', { ws: v }), TypeError, `ws=${String(v)} 是 truthy，但不是布尔`);
    assert.throws(() => dLines('a\n', 'b\n', { case: v }), TypeError);
    assert.throws(() => dInline('a', 'b', { ws: v }), TypeError);
  }
  assert.throws(() => dLines('a\n', 'b\n', { ignoreWs: true }), TypeError, '拼错的键名不许静默忽略：那个勾选框就成了装饰品');
  assert.throws(() => dLines('a\n', 'b\n', { crlf: true }), TypeError, 'crlf 只有 compareKey 认这一格');
  assert.throws(() => dLines('a\n', 'b\n', 'ws'), TypeError);
  assert.throws(() => dLines('a\n', 'b\n', ['ws']), TypeError);
  assert.throws(() => dKey('a', { ws: null }), TypeError, 'null 也是"非法值"，不许当成 falsy 放行');
  assert.equal(dLines('a\n', 'a\n', { ws: false, case: false }).verdict, 'same', '显式 false 是合法档位');
  assert.equal(dKey('A', { ws: true, case: true, crlf: true }), 'a', '三格同开：先补 \\r、再并空白、最后落小写');
  assert.equal(dKey('a', { ws: true, case: true, crlf: true }), dKey('a', { ws: true, case: true }),
    '勾了 ws 之后行尾回车并进空白档——这正是 X9 那句"不算差异"的来处');
});

test('X28 幂等：同一输入两次调用 diffLines，ops 与 stats 与行内结果逐格深相等', () => {
  const a = 'k1\nD1\nk2\nk3\nk4\nk5\n中文 abc\n';
  const b = 'k1\nZ1\nk2\nk3\nk4\nk6\n中文 abcd\n';
  for (const o of [{}, { ws: true }, { case: true }]) {
    const r1 = dLines(a, b, o);
    const r2 = dLines(a, b, o);
    assert.deepEqual(r2.ops, r1.ops);
    assert.deepEqual(r2.stats, r1.stats);
    assert.equal(r2.cost, r1.cost);
    assert.deepEqual([...r2.inlineByKey.keys()], [...r1.inlineByKey.keys()], '行内细化按文档顺序记账，两次必须同序同集合');
    assert.deepEqual(dHunks(r2, 3), dHunks(r1, 3), '连行内分段也得同源：视图层重绘不许变色');
    assert.equal(dUnified(r2, { context: 1 }), dUnified(r1, { context: 1 }));
  }
});

test('X29 MAX_INLINE_WORK 预算：装不下那一对就跳过它，后面装得下的照常细化（跳过不是掐断）', () => {
  const big = (tag, n) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');
  // 一对约 790 枚 token 的行，按 4·rest² 记的就是 249 万格：第一对装得下，第二对同一档装不下
  const a = [big('p1', 198), big('p2', 198), 'x1', 'x2', 'x3'];
  const b = [big('q1', 198), big('q2', 198), 'y1', 'y2', 'y3'];
  const r = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.equal(r.stats.changed, 5, '五对都配上行了：预算掐的是行内细化，不是行级对齐');
  assert.deepEqual([...r.inlineByKey.keys()], ['0:0', '2:2', '3:3', '4:4'],
    '预算只掐掉装不下的那一格，后面的小配对照常细化——写成"后面全掐"就少了这一判');
  assert.equal(r.stats.inlineSkipped, 1);
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.find((x) => x.a === 1).inline, null);
  assert.ok(rows.find((x) => x.a === 2).inline.length > 0, '排在超预算那一对后面的行必须有高亮');
  assert.ok(X_NOTES.inlineSkipped.includes(String(X_WORK)), `那句要说清预算数额：${X_NOTES.inlineSkipped}`);
  const again = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.deepEqual([...again.inlineByKey.keys()], [...r.inlineByKey.keys()], '同一档必须可重放，不许"刷新一下又高亮了"');
  assert.equal(again.stats.inlineSkipped, r.stats.inlineSkipped);
});

// ── §Y JSON 感知比对（`tools/diff-json.js`，段 5 Task 3）─────────────────────
// 这一族钉两件事：**两本独立实现必须同结论**，以及**这一页的比对口径只有一套**。
// §0.4 那条构建层的硬约束（`json-core.js` 已被 `toolJson.js` 那一个入口 reach，第二本入口再 reach 它
// 就被 Rollup 切成共享 chunk → 整页 SyntaxError 而构建 exit=0）换来的代价全在 Y1：
// **自带一份读侧不等于"复制一份就完事"**——同一批样本喂两本，合法/非法、非法时的行列、解出的值
// 三件必须同结论，先例是 §B 的"与站内旧库对拍"（两个独立实现同结论才算过）。
// 比对口径写死在这里，实现不许自创第二套：
//   · 对象按**键名**比、键顺序无关，只有顺序不同判 `same-key-order`，不许判 `same`（Y3）；
//   · 数组按**索引**比，"把 x[3] 挪到 x[1]"报成一串改而不是一处移动（Y5，spec §5.6 明写不做）；
//   · 两侧类型档不同单列一档 `type`，并且**不再往里比**（Y4、Y14）——`null` 是一种值，不是"没有值"；
//   · 一侧存在另一侧缺席是一档 `add` / `remove`，**整棵子树只报一格**（Y9）；
//   · Pointer 与 `json-core` 那份逐字符同规则，转义先 `~` 后 `/`（Y6、Y7）；
//   · 深度闸门 `MAX_DEPTH` 两本必须是同一个数，而 `diff-json.js` 源码里 `json-core` 出现 **0 次**（Y2）；
//   · 字节与行数两档闸门**只有 `diff-core.gate` 一处口径**、按侧判（Y16），`readJson` 自己不设闸门；
//   · `stats.compared` 数的是"两侧都有节点、因此逐格判过一次"的格数（判出不一致的也算判过）。
// §X 那两份顶层常量（`X_BYTES` / `X_HUGE` / `X_TOO_MANY` / `dGate`）在本节直接复用——
// 同一把尺要由同一个变量递过去，重新 import 一遍就成了两份。
const {
  MAX_DEPTH: Y_DEPTH, MAX_CHANGES: Y_CHANGES, PREVIEW_CHARS: Y_PREVIEW,
  readJson: yRead, pointerOf: yPointer, diffJson: yDiff, DIFF_JSON_NOTES: Y_NOTES,
} = await import('../dev/js/tools/diff-json.js');

/** 剥注释扫源码：闸门与 import 面只看代码，不看文档里的自我声明（与 §S 的 sCode 同一形状） */
const yCode = () => read('dev/js/tools/diff-json.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 对拍用的好样本，每条各挑一件事（写死的串，不是生成时现造——红了第二次要能原样重放）：
 * 空白与 BOM、转义与 `\u`、代理对与**落单**的半个、`__proto__`、重复键、数字的各档形状、空容器、深容器。
 */
const Y_GOOD = [
  '{}', '[]', 'null', 'true', 'false', '0', '-0', '1e2', '3.5e-2',
  '{"a":1,"b":[1,2,{"c":"d"}]}',
  '{"a":{"a":{"a":[]}}}',
  '  \t\n{"k" : [ 1 , 2 ] }\r\n',
  '{"e":"\\u00e9\\n\\t\\"\\\\/"}',
  '{"emoji":"😀🦄","中":"键"}',
  '{"__proto__":{"polluted":1},"constructor":"x"}',
  '{"dup":1,"dup":2}',
  '\ufeff{"bom":true}',
  '{"neg":-1.5e-3,"max":1.7976931348623157e308}',
  '{"deep":[[[[[[1]]]]]]}',
  '{"esc":"\\ud83d\\ude00","lone":"\\ud83d"}',
  '{"s":"a\\/b\\tc \u007f"}',
  '{"n":null,"m":"","z":[]}',
  '[null,false,true,0,-0,"",[],{}]',
  '{"a":[[1],[2],{"b":null}],"c":{},"d":"x"}',
];

/** §S 那 20 格没走到的分支：`colon` 与 `sep` 两个状态、第二个 BOM、串内换行与没闭合到 EOF 的串 */
const Y_BAD_EXTRA = ['1e999', '{"a" 1}', '[1 2]', '{"a":}', '{"a":1\'}', '\ufeff\ufeff{}',
  '{"k":v}', '[,]', '{"a":1,,"b":2}', 'tru', '{"a":[1,2]', '{"a":1}}', '{"a":"x', '{"a":"b\nc"}'];

test('Y1 与 json-core 对拍：同一批样本两本读侧三件同结论（合法/非法、非法的行列、解出的值）', () => {
  const bad = S_BAD.map(([id, text]) => [id, text === null ? '['.repeat(MAX_DEPTH + 1) : text]);
  for (const [k, t] of Y_BAD_EXTRA.entries()) bad.push([`Y1x${k}`, t]);
  const good = Y_GOOD.map((t, k) => [`Y1g${k}`, t]);
  assert.equal(bad.length, 34, '样本集是本格的承重墙：§S 那 20 格一格都不许掉，少的这一格就是少的那一片分支');
  assert.ok(good.length >= 24, '好样本缩到一组以下，对拍就退化成"两边都收"');
  for (const [tag, src] of [...bad, ...good]) {
    const p = parseJson(src);
    const r = yRead(src);
    assert.equal(r.ok, p.ok, `${tag} 的合法/非法结论必须同：${JSON.stringify(src.slice(0, 24))}`);
    if (p.ok) {
      assert.deepStrictEqual(r.value, p.value, `${tag} 解出的值必须逐格同（键序与原型污染那两处最容易分叉）`);
    } else {
      assert.equal(r.kind, p.error.kind, `${tag} 的 kind —— ${JSON.stringify(src.slice(0, 24))}`);
      assert.equal(r.line, p.error.line, `${tag} 的 line —— 位置差一格和没报错一样有害`);
      assert.equal(r.column, p.error.column, `${tag} 的 column —— 数的是 UTF-16 码元，一个 emoji 占两列`);
      assert.ok(typeof r.reason === 'string' && r.reason.length > 0, `${tag} 要给得出那句人话`);
    }
  }
  // 量具自己要有牙：八类 kind 必须由这批样本**真的**踩到，否则"两边都拒"可能只是拒在同一处
  const kinds = new Set(bad.map(([, t]) => yRead(t).kind));
  for (const k of ['empty', 'unterminated', 'unexpected-char', 'bad-escape', 'bad-number',
    'unterminated-string', 'depth', 'trailing']) {
    assert.ok(kinds.has(k), `样本集没踩到 ${k} 那一类，这一族的对拍对它就没有牙`);
  }
});

test('Y2 深度闸门两本是同一个数，而 diff-json.js 的源码里 json-core 出现 0 次（§0.4 那条构建红线）', () => {
  assert.equal(Y_DEPTH, MAX_DEPTH, 'MAX_DEPTH 分叉 = 同一份输入两页一个收一个拒');
  assert.equal(Y_DEPTH, 1000, '改这一档要同时改 json-core、spec §7 与本判据，三处一起才算数');
  const src = yCode();
  assert.equal(src.includes('json-core'), false,
    '自带一份的前提是真的不 import：两本入口 reach 同一模块就是共享 chunk，包完整页 SyntaxError');
  const declared = src.match(/export const MAX_DEPTH = (\d+);/);
  assert.ok(declared, '深度那一档在源码里必须是写死的字面量，不许从别处读');
  assert.equal(declared[1], String(Y_DEPTH));
  assert.equal(yRead('['.repeat(Y_DEPTH + 1)).kind, 'depth', '第 1001 层容器照样拒，与 json-core 同档');
});

test('Y3 键顺序无关：只有顺序不同判 same-key-order 而不是 same，数组换了位置仍判 diff', () => {
  for (const [a, b] of [
    ['{"b":2,"a":1}', '{"a":1,"b":2}'],
    ['{"x":{"b":2,"a":1},"y":[1]}', '{"x":{"a":1,"b":2},"y":[1]}'],
  ]) {
    const r = yDiff(a, b);
    assert.equal(r.verdict, 'same-key-order', `${a} ↔ ${b} 只差键顺序，直接报"完全相同"是这一页最容易说谎的一处`);
    assert.equal(r.changes.length, 0, '顺序差不是变更，列出来就是把同一件事说两遍');
    assert.equal(r.truncated, false);
    assert.strictEqual(r.error, null);
    assert.ok(r.stats.compared > 0, '这一档仍然真的比过，compared 不许跟着变 0');
  }
  assert.equal(yDiff('{"a":1,"b":2}', '{"a":1,"b":2}').verdict, 'same', '逐格同序才配得上 same');
  assert.equal(yDiff('[1,2]', '[2,1]').verdict, 'diff', '数组按索引比，换了位置就是两处不同（Y5 那一句）');
  assert.equal(yDiff('{"a":[1,2]}', '{"a":[1,2]}').verdict, 'same');
});

test('Y4 类型变化单列一档 type：1→"1"、{}→[]、null→缺键 三档各自的 kind 与 aType/bType', () => {
  const one = yDiff('{"v":1}', '{"v":"1"}');
  const c1 = one.changes[0];
  assert.equal(c1.kind, 'type', '类型变了不许混进 change——那两个数读出来是两回事');
  assert.deepEqual([c1.pointer, c1.aType, c1.bType, c1.owner, c1.depth], ['/v', 'number', 'string', 'both', 1]);
  assert.deepEqual([one.stats.type, one.stats.change], [1, 0], 'change 那一档必须真的是 0');
  const two = yDiff('{}', '[]').changes[0];
  assert.deepEqual([two.kind, two.pointer, two.aType, two.bType], ['type', '', 'object', 'array']);
  const three = yDiff('{"a":null}', '{}').changes[0];
  assert.equal(three.kind, 'remove', 'null 是值、缺键是没有值，两档不许并成一档');
  assert.deepEqual([three.aType, three.bType], ['null', 'absent']);
  const four = yDiff('{"a":null}', '{"a":1}').changes[0];
  assert.equal(four.kind, 'type', 'null 与 number 也是两档——null 是一种值，不是"没有值"');
  assert.equal(yDiff('{"a":[1]}', '{"a":{"0":1}}').changes[0].kind, 'type', '数组与对象在同一路径下就是类型变');
  assert.equal(yDiff('{"a":1}', '{"a":[1]}').changes[0].kind, 'type');
  assert.equal(yDiff('{"a":1}', '{"a":[1]}').changes.length, 1, '类型变之后不再往里比，免得把一格报成两格');
});

test('Y5 数组按索引比：中间插一项会报成一串改，这是设计而不是缺陷，那句说明必须给得出', () => {
  const r = yDiff('[1,2,3,4]', '[1,9,2,3,4]');
  assert.equal(r.verdict, 'diff');
  assert.deepEqual(r.changes.map((c) => [c.pointer, c.kind, c.owner]),
    [['/1', 'change', 'both'], ['/2', 'change', 'both'], ['/3', 'change', 'both'], ['/4', 'add', 'only-b']],
    '把 9 插在中间，报的是"其后每一格都变了"——识别移动这件事本站明写不做');
  assert.deepEqual([r.stats.change, r.stats.add, r.stats.remove, r.stats.type], [3, 1, 0, 0]);
  assert.ok(Y_NOTES.arrayMove.includes('索引') && Y_NOTES.arrayMove.includes('移动'),
    `那句要说清"按索引比"与"不识别移动"：${Y_NOTES.arrayMove}`);
});

test('Y6 Pointer 的转义与 json-core 那份逐字符同规则：~、/、空串键、数字键四种', () => {
  for (const k of ['~', '/', '', '0', '10', 'a/b', 'a~b', '~/']) {
    assert.equal(yPointer([k]), toPointer([k]), `${JSON.stringify(k)} 这一段两本必须编出同一个串`);
    assert.deepEqual(fromPointer(yPointer([k])), { ok: true, segments: [k] },
      '编出去还得解得回来，且解回原样——指针是给用户粘进 RFC 6901 的实现里用的');
  }
  assert.equal(yPointer(['a', 'b/c', 3]), toPointer(['a', 'b/c', 3]), '数字段两本都按十进制字符串进指针');
  assert.equal(yPointer([]), '', '根那一格就是空串，与 json-core 的 toPointer([]) 同形');
  const r = yDiff('{"a/b":1,"c~d":2}', '{"a/b":9,"c~d":8}');
  assert.deepEqual(r.changes.map((c) => c.pointer), ['/a~1b', '/c~0d']);
  assert.deepEqual(yDiff('{"":1}', '{"":2}').changes.map((c) => c.pointer), ['/'],
    '空串键的指针是一格 /，与根那个空串不是同一格');
});

test('Y7 转义次序钉死：先 ~ 后 /，两趟反过来会把 ~1 再转义一次', () => {
  assert.equal(yPointer(['~1']), '/~01', '键名本身写着 ~1 时必须编成 ~01；先 / 后 ~ 的两趟写法会解错');
  assert.equal(yPointer(['~/']), '/~0~1', '这一格是两种次序唯一能分开的形状：反过来得到的是 ~0~01');
  assert.equal(yPointer(['~01']), '/~001');
  for (const k of ['~1', '~0', '/~', '~01', '~0~1']) {
    assert.deepEqual(fromPointer(yPointer([k])), { ok: true, segments: [k] }, `${k} 必须原样回来`);
  }
});

test('Y8 预览串：越 PREVIEW_CHARS 才带省略号，切点不许切断代理对', () => {
  const lone = 'x'.repeat(Y_PREVIEW - 2) + '😀' + 'z';
  const preview = yDiff(`{"a":"${lone}"}`, '{"a":"other"}').changes[0].aPreview;
  assert.equal(preview, `"${'x'.repeat(Y_PREVIEW - 2)}…`,
    '切点正好落在代理对中间：那一枚高位代理项必须退回，省略号还要算进预算内');
  assert.ok(preview.length <= Y_PREVIEW, `预算是含省略号的总长：${preview.length} > ${Y_PREVIEW}`);
  for (let k = 0; k < preview.length; k++) {
    const c = preview.charCodeAt(k);
    if (c >= 0xd800 && c <= 0xdbff) {
      const nx = preview.charCodeAt(k + 1);
      assert.ok(nx >= 0xdc00 && nx <= 0xdfff, `切出孤立高位代理项（第 ${k} 格），交出去的就不再是合法 JSON`);
      k += 1;
    } else assert.ok(!(c >= 0xdc00 && c <= 0xdfff), `第 ${k} 格是孤立低位代理项`);
  }
  const short = yDiff('{"a":"1"}', '{"a":"2"}').changes[0];
  assert.deepEqual([short.aPreview, short.bPreview], ['"1"', '"2"'], '没越线就一个字符都不许切');
  assert.deepEqual([yDiff('{"a":[1,2,3]}', '{"a":"x"}').changes[0].aPreview,
    yDiff('{"a":{"b":1}}', '{"a":"x"}').changes[0].aPreview], ['[1,2,3]', '{"b":1}'],
    '容器给的是紧凑形式，不是"（对象）"这种没信息量的占位');
  const wide = yDiff(`{"a":{"k":"${'y'.repeat(Y_PREVIEW + 40)}"}}`, '{"a":1}');
  assert.ok(wide.changes[0].aPreview.length <= Y_PREVIEW, '整棵子树一起压进预算，不许先拼再切出天文数字');
});

test('Y9 owner 三档在深层路径下的形状：缺席一侧给 null 预览，整棵子树只报一格', () => {
  const add = yDiff('{}', '{"a":{"b":{"c":[1,2]}}}').changes;
  assert.equal(add.length, 1, '新增一整棵子树是一格变更，摊成五格就是把同一个决定说五遍');
  assert.deepEqual([add[0].pointer, add[0].kind, add[0].owner, add[0].depth, add[0].aPreview, add[0].aType],
    ['/a', 'add', 'only-b', 1, null, 'absent']);
  assert.equal(typeof add[0].bPreview, 'string', '在场那一侧的预览照给，否则这一格读起来是空的');
  const rm = yDiff('{"a":{"b":1}}', '{}').changes;
  assert.deepEqual([rm[0].pointer, rm[0].kind, rm[0].owner, rm[0].aType, rm[0].bPreview],
    ['/a', 'remove', 'only-a', 'object', null]);
  const both = yDiff('{"a":{"b":[0,{"z":1}]}}', '{"a":{"b":[0,{"z":2}]}}');
  assert.deepEqual([both.changes.length, both.changes[0].pointer, both.changes[0].owner, both.changes[0].depth],
    [1, '/a/b/1/z', 'both', 4]);
  assert.deepEqual([both.changes[0].aPreview, both.changes[0].bPreview], ['1', '2']);
  assert.equal(yDiff('[1]', '[]').changes[0].owner, 'only-a', '数组尾部少一项是 remove，指针是那个下标');
});

test('Y10 一侧非法：error.which 点名是哪一侧，另一侧即使合法也不比', () => {
  const r = yDiff('{', '1');
  assert.equal(r.verdict, 'invalid');
  assert.deepEqual([r.error.which, r.error.line, r.error.column], ['a', 1, 2], '行列给的是坏的那一侧');
  assert.equal(r.error.reason, yRead('{').reason, '那句理由直接来自读侧，不在这里另编一套');
  assert.deepEqual([r.changes.length, r.truncated, r.stats], [0, false,
    { add: 0, remove: 0, change: 0, type: 0, compared: 0, depth: 0 }], '坏输入那一档七个数全给 0，而不是"没有这一格"');
  const b = yDiff('1', '[1,');
  assert.deepEqual([b.error.which, b.error.line, b.error.column], ['b', 1, 4]);
  assert.equal(b.changes.length, 0, '一侧坏了就不比——比出来的表会把人引向另一侧');
});

test('Y11 两侧都非法：which 是 both，行列报 A 那一侧，两句理由都给', () => {
  const r = yDiff('{', "'a':1");
  assert.equal(r.verdict, 'invalid');
  assert.equal(r.error.which, 'both');
  const ea = yRead('{').reason;
  const eb = yRead("'a':1").reason;
  assert.deepEqual([r.error.line, r.error.column], [1, 2], '顺序口径写死：两侧都坏时报 A 的行列');
  assert.ok(r.error.reason.includes(ea) && r.error.reason.includes(eb),
    `两侧都坏时不许只说一侧：${r.error.reason}`);
  assert.equal(r.error.reason.includes('B'), true, '那一句要让人知道两侧都得修');
});

test('Y12 MAX_CHANGES 越线：truncated 为真、只列前 5000 格，四个计数仍是全量', () => {
  const over = Array.from({ length: Y_CHANGES + 1000 }, (_, k) => `"k${k}":1`).join(',');
  const r = yDiff('{}', `{${over}}`);
  assert.equal(r.truncated, true);
  assert.equal(r.changes.length, Y_CHANGES, '列出的格子必须正好卡在预算上，多一格都不许');
  assert.equal(r.stats.add, Y_CHANGES + 1000, '截了列表不许顺手把总数也截了——那句"还有没列出的"靠它');
  assert.equal(r.verdict, 'diff');
  assert.ok(Y_NOTES.truncated.includes(String(Y_CHANGES)), `那句要给得出预算数额：${Y_NOTES.truncated}`);
  const under = yDiff('{}', `{${Array.from({ length: Y_CHANGES - 1 }, (_, k) => `"k${k}":1`).join(',')}}`);
  assert.equal(under.truncated, false, '卡在线上那一格以内不许报截断——报了就是又一次说谎');
  assert.equal(under.changes.length, Y_CHANGES - 1);
});

test('Y13 stats 四档与 changes 自洽：compared 与 depth 按构造算得出', () => {
  const r = yDiff('{"a":1,"b":{"c":3},"d":[1,2],"x":true}', '{"a":"1","b":{"c":3},"d":[1,2,9],"y":null}');
  assert.deepEqual(r.stats, { add: 2, remove: 1, change: 0, type: 1, compared: 7, depth: 2 },
    'compared 数的是"两侧都有节点、因此逐格判过一次"的格数（根与 /a 那格判出不一致也算判过）');
  for (const kind of ['add', 'remove', 'change', 'type']) {
    assert.equal(r.changes.filter((c) => c.kind === kind).length, r.stats[kind],
      `${kind} 的计数必须等于它自己那一档的条数`);
  }
  assert.equal(r.changes.length, r.stats.add + r.stats.remove + r.stats.change + r.stats.type,
    '不截断时四档之和就是列出的格数——这是"没有静默丢"的唯一可读证据');
  assert.deepEqual(r.changes.map((c) => c.kind), ['type', 'add', 'remove', 'add'],
    '变更按文档顺序给：先 A 侧的键、再 B 侧多出来的键，同一份输入两次同序');
});

test('Y14 空档：{} vs {}、[] vs [] 判 same，{} vs [] 是 type，空容器与缺席键不是一回事', () => {
  for (const t of ['{}', '[]', '0', '""']) {
    const r = yDiff(t, t);
    assert.equal(r.verdict, 'same', `${t} 与自己比必须判 same`);
    assert.deepEqual([r.changes.length, r.stats.compared, r.stats.depth], [0, 1, 0]);
  }
  const e = yDiff('{}', '[]');
  assert.deepEqual([e.verdict, e.changes.length, e.changes[0].kind, e.changes[0].pointer],
    ['diff', 1, 'type', ''], '空对象与空数组是类型变，不是"都空所以相同"');
  assert.equal(yDiff('{}', '{"a":{}}').changes[0].kind, 'add');
  assert.equal(yDiff('{"a":{}}', '{"a":{}}').verdict, 'same', '空容器相等，不许因为"没内容"就漏报成两侧缺席');
  assert.equal(yDiff('[]', '[1]').changes[0].kind, 'add');
  assert.deepEqual([yDiff('', '').verdict, yDiff('', '').error.which], ['invalid', 'both'],
    '两侧都空是"没内容可读"，不是"两份空文件相同"');
});

test('Y15 depth 读数：每下一段加一，根那一格是 0，1000 层的合法输入照样走得完', () => {
  const build = (leaf, levels) => {
    let v = String(leaf);
    for (let k = 0; k < levels; k++) v = `{"a":${v}}`;
    return v;
  };
  const r = yDiff(build(1, 8), build(2, 8));
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].pointer, '/a/a/a/a/a/a/a/a');
  assert.deepEqual([r.changes[0].depth, r.stats.depth], [8, 8]);
  assert.equal(r.changes[0].aPreview, '1', '叶子那一格的预览就是它自己');
  const deep = yDiff(build(1, Y_DEPTH), build(2, Y_DEPTH));
  assert.equal(deep.changes.length, 1, '1000 层比栈深敏感——这一族走的是显式栈，抛 RangeError 就是整页空白');
  assert.deepEqual([deep.changes[0].depth, deep.stats.depth], [Y_DEPTH, Y_DEPTH]);
  assert.equal(deep.truncated, false);
});

test('Y16 入参口径：非字符串抛 TypeError，字节与行数两档走 diff-core 那一把尺（按侧判）', () => {
  for (const [name, call] of [
    ['readJson', () => yRead(1)], ['readJson', () => yRead(null)], ['readJson', () => yRead(['{"a":1}'])],
    ['diffJson(textA, textB)', () => yDiff(1, '1')], ['diffJson(textA, textB)', () => yDiff('1', undefined)],
    ['pointerOf(segments)', () => yPointer('a')], ['pointerOf(segments)', () => yPointer(null)],
  ]) {
    assert.throws(call, (e) => e instanceof TypeError && e.message.includes(name),
      `${name} 要抛点名的 TypeError——入参形状不对是调用侧的错，不许咽进返回值`);
  }
  const bytes = yDiff(X_HUGE, '1');
  assert.equal(bytes.verdict, 'invalid', '闸门排在读之前，不许先把 5MB 解析完再拒');
  assert.deepEqual([bytes.error.which, bytes.error.line, bytes.error.column], ['a', null, null],
    '闸门这一档没有"出错的那一格"可指，行列给 null 而不是硬编一个 1');
  assert.ok(bytes.error.reason.includes(String(X_BYTES)) && bytes.error.reason.includes(String(X_BYTES + 7)),
    `那句要给得出上限与实测：${bytes.error.reason}`);
  assert.equal(dGate(X_HUGE, '1').over.bytesA, 7, '同一把尺：这一档的差额由 diff-core 的 gate 出，不是第二套');
  assert.equal(yDiff('1', X_HUGE).error.which, 'b',
    '按侧判不按两侧合计判——合起来判会让"一侧塞满、一侧空着"整页不可用');
  const lines = yDiff(X_TOO_MANY, '1');
  assert.ok(lines.error.reason.includes(String(X_LINES)), `行数那一档说的是行数：${lines.error.reason}`);
  assert.equal(lines.error.reason.includes(String(X_LINES + 3)), true, '上限之外还要给实测');
});

test('Y17 数字口径按值不按字面：1 与 1.0 与 1e0 同值，"1" 是 type，1 与 1.5 是 change', () => {
  assert.equal(yDiff('1', '1.0').verdict, 'same');
  assert.equal(yDiff('1', '1e0').verdict, 'same');
  assert.equal(yDiff('{"n":[1,1.0,1e0]}', '{"n":[1,1,1]}').verdict, 'same', '数组里的数字同口径');
  assert.equal(yDiff('-0', '0').verdict, 'same', '按 JSON 值判就是按 === 判：-0 与 0 是同一个数');
  assert.equal(yDiff('1', '0').verdict, 'diff', '别把 1 和 0 看成同值');
  assert.equal(yDiff('1', '"1"').changes[0].kind, 'type');
  assert.equal(yDiff('1', '1.5').changes[0].kind, 'change');
  assert.equal(yDiff('1e2', '100').stats.compared, 1, '同值那一档只判一根格，不许因为字面不同就多比一次');
});

test('Y18 DIFF_JSON_NOTES 六句各管一件事：非空、带自己那个数、不许留占位（上页面那一半由 §Z 接）', () => {
  const keys = ['keyOrder', 'arrayMove', 'typeChange', 'truncated', 'depth', 'previewCut'];
  assert.deepEqual(Object.keys(Y_NOTES), keys, '六句就是六句，多一句少一句都得先改 §1.2 的契约');
  for (const k of keys) {
    assert.equal(typeof Y_NOTES[k], 'string', `缺 ${k} 那一句`);
    assert.ok(Y_NOTES[k].length > 20, `${k} 那句短得不像在说一件事：${Y_NOTES[k]}`);
    assert.notEqual(Y_NOTES[k], '…', '起草时契约里写的就是这个占位串，落地时不许原样留着');
  }
  assert.ok(Y_NOTES.keyOrder.includes('键顺序'), Y_NOTES.keyOrder);
  assert.ok(Y_NOTES.typeChange.includes('类型'), Y_NOTES.typeChange);
  assert.ok(Y_NOTES.depth.includes(String(Y_DEPTH)), `深度那句要给得出闸门：${Y_NOTES.depth}`);
  assert.ok(Y_NOTES.previewCut.includes(String(Y_PREVIEW)), `预览那句要给得出长度：${Y_NOTES.previewCut}`);
  assert.ok(Y_NOTES.truncated.includes('截'), `截断那句要明说"后面还有没列出的"：${Y_NOTES.truncated}`);
});

// ── §Z 对比页视图层与装配层（`tools/diffView.js` / `tools/diffWorkbench.js` / `toolDiff.js`，段 5 Task 4/5）──
// 本格（Task 4）只立前半 **Z1–Z12**，钉的是视图层那七件；后半 Z13–Z28 由 Task 5 在**同一节**续写
// ——节名不另起，先例是 §U（§S–§W 那几族里 §U 就是两格共用一节）。
// 三条红线写死在这里，实现不许自创第二套：
//   · **零 import**（Z1）：与 `jsonView.js` 同一条构建约束（§0.4）——这一本一旦 import 什么，
//     `toolDiff.js` 与 `toolkitCore.js` 就同时 reach 那个模块，Rollup 切出共享 chunk，
//     `iifeWrapPlugin` 包完的产物里留下 `import{`，整页 SyntaxError 而构建 exit=0。
//     所以 `esc`、类名前缀与 CR 符号三件全部由 `env` 注入，缺一件在**构造期**点名（Z2），
//     不许退化成"默认前缀 df"那种静默兜底。
//   · **类名与属性名只从 `env.prefix` 派生**（Z3）：本文件剥注释的源码里 `df-` 出现 **0 次**，
//     连整格字面量（§W10 那条口径，三种引号都算）也不许有。这不是洁癖——Task 5 的换前缀自证
//     （`df` ↔ `zx`）只有在派生是真的时才绿，手打过一处字面量就等于给那道门禁装假牙。
//   · **用户文本只出现在 `esc` 之后，且永远不进属性位**（Z8、Z9）：属性值只允许整数。
//     对齐引擎交出来的是 `textA/textB` 与 Pointer 这类文本；行号、栏内下标、省略行数、深度才是这一格的属性。
// 视图层另管三件"CSS 兜不了的事"：
//   ① 并排两栏各读同一份行流，**缺席那一侧长成 fill 而不是少一行**（Z4）——两栏行数不等时滚动一错位，
//      用户读到的是"这行没变"，实情是两侧各有一行；
//   ② 一个 `change` 行在两栏各出现一次，而高亮只有各自那一半（Z5），且分段拼回去必须还是整行原文；
//   ③ CRLF 那一格画注入的符号而不是留白（Z6），折叠条那句"省略 N 行"的 N 与 `hunksOf` 同源（Z7）。
// JSON 档那一表另有两格：`absent` 与"值真的是 null"必须分得开（Z10，§0.6 记的那格偏差），
// 而 `DIFF_JSON_NOTES` 那六句代价说明与表同屏——Y18 的第二半就落在这里。
// §W 那三把剥源码的尺（`wCode` / `wBare` / `wCount`）与 `modNames` 在本节直接复用：
// 同一件事只该有一把尺，重新写一遍就成了"两遍里有一遍是错的"（X4 第一轮抓到的那种形状）。
const {
  createDiffView: zCreate, DF_SIDES: Z_SIDES, DF_CORE_KINDS: Z_CORE_KINDS,
} = await import('../dev/js/tools/diffView.js');

/** 本节一律用真前缀与真符号：视图层不许自己存一份 `␍`（Z6 断的就是这件事） */
const Z_P = 'df';
const zEnv = (over) => ({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: X_CR, ...over });
/** 全展开的行流：`hunksOf(..., Infinity)` 摊平，Z4/Z5/Z6 要的是"没有折叠干扰"的那一份行档 */
const zRows = (a, b, o) => dHunks(dLines(a, b, o), Infinity).flatMap((h) => h.rows);
/** renderSide 的输出是一串并排的 `<div>`，按 `<div` 切开就能逐格读行档 */
const zBlocks = (html) => html.split(/(?=<div)/).filter((s) => s !== '');
/** 剥标签并把 esc 那五枚实体还原：断"这一格显示的正是原文"用得上（&amp; 必须最后还原） */
const zPlain = (html) => html.replace(/<[^>]*>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');
/** 行内容那一格：`<pre class="df-row__txt">` 到它的 `</pre>`——用 pre 而不是 span，行内再套多少枚 span 都切得干净 */
const zTxt = (html) => {
  const m = /<pre class="[^"]*row__txt">([\s\S]*?)<\/pre>/.exec(html);
  return m ? zPlain(m[1]) : null;
};
/** 属性清单：`\sname="value"` 的成对，Z9 数的是"这一页到底往属性位写了什么" */
const zAttrs = (html) => [...html.matchAll(/ ([-a-z]+)="([^"]*)"/g)].map((m) => ({ name: m[1], value: m[2] }));
/** 数出现次数：§W 那把尺在本节直接复用（同一件事只该有一把尺），换个本节读得通的名字 */
const zCount = wCount;

test('Z1 视图层零 import、零环境词：它只产串，节点与浏览器一律够不着', () => {
  const rel = 'dev/js/tools/diffView.js';
  assert.equal(/\bimport\b/.test(wCode(rel)), false, 'diffView 一旦 import 什么，两个入口就 reach 同一模块 → Rollup 切共享 chunk → iife-wrap 后产物里是 import{ → 整页 SyntaxError 而构建 exit=0（§0.4 那条红线，与 §W2 同一条）');
  assert.equal(/\brequire\s*\(/.test(wCode(rel)), false, '同上：require 在这儿等于第二条跨模块的边');
  assert.equal(wCount(wCode(rel), 'innerHTML'), 0, '视图层不许写节点：整页只有装配层那唯一的 innerHTML 出口（§W 同一条口径，这里连字符串里都不许出现）');
  const bare = wBare(rel);
  for (const word of ['window', 'document', 'localStorage', 'Date.now(', 'getComputedStyle', 'querySelector', 'FileReader', 'navigator']) {
    assert.equal(bare.includes(word), false, `视图层不许碰 ${word}：纯串生成器碰一次就多一处不可复算，而 FileReader 与 File 那一格归入口`);
  }
});

test('Z2 注入缺件在构造期就点名，导出面恰好这三格与那七件', () => {
  const v = zCreate(zEnv());
  assert.deepEqual(Object.keys(v).sort(),
    ['renderFoldBar', 'renderInline', 'renderJsonTable', 'renderNotice', 'renderSide', 'renderStats', 'renderVerdict'],
    '七件里加一件或改一名，装配层就有一处叫不到它；而"多一件"通常是第二条渲染路径');
  for (const [name, fn] of Object.entries(v)) assert.equal(typeof fn, 'function', `${name} 不是函数：这一件到页面上就是"点了没反应"`);
  assert.deepEqual(modNames('dev/js/tools/diffView.js'), ['DF_CORE_KINDS', 'DF_SIDES', 'createDiffView'].sort(),
    'diffView.js 的导出面多了名字：词表之外不许再有第二格公开的东西');
  assert.deepEqual(Z_SIDES, ['a', 'b'], '第三栏在这一页没有对应的事实');
  assert.deepEqual(Z_CORE_KINDS, ['equal', 'change', 'del', 'ins'], '对齐引擎只交得出这四档，第五档（fill）是视图层自己的，不许混进这一份词表');
  const missing = [
    [{ prefix: Z_P, crGlyph: X_CR }, /esc/, '缺 esc 的下场是用户文本被当标记插进结果区'],
    [{ esc: J_VIEW.esc, crGlyph: X_CR }, /prefix/, '缺前缀则整套类名与属性名无从派生'],
    [{ esc: J_VIEW.esc, prefix: Z_P }, /crGlyph/, '缺符号则"行尾有回车"与"这一格没渲染"混成同一档'],
  ];
  for (const [env, re, why] of missing) {
    assert.throws(() => zCreate(env), (e) => e instanceof TypeError && re.test(e.message) && /createDiffView/.test(e.message),
      `构造期没点名（${why}）：抛在挂载期就是整页空白，而这里连挂载都到不了`);
  }
  assert.throws(() => zCreate(), TypeError, '整格缺件也要抛，不许退化成"默认前缀 df"');
  assert.throws(() => zCreate({ esc: 'nope', prefix: Z_P, crGlyph: X_CR }), TypeError);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: 'df bad', crGlyph: X_CR }), /prefix/, '前缀里带空格：整套 class 名到页面上就是碎的');
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: '', crGlyph: X_CR }), /prefix/);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: 'df-row', crGlyph: X_CR }), /prefix/, '前缀自己带连字符，产出的类名读不出哪一段是词根');
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: '' }), /crGlyph/);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: 7 }), /crGlyph/);
});

test('Z3 类名与属性名全由 env.prefix 派生：本文件剥注释的源码里 df- 出现 0 次', () => {
  const rel = 'dev/js/tools/diffView.js';
  assert.equal(wCount(wCode(rel), 'df-'), 0, '手打 df- 字面量一处，Task 5 的换前缀自证就绿得没有牙：整页类名跟着 zx- 换才是真的派生');
  const hand = [];
  wCode(rel).replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (s) => {
    if (/^['"`]df-/.test(s)) hand.push(s);
    return "''";
  });
  assert.deepEqual(hand, [], '整格字面量口径（§W10 同一条，三种引号都算）：以 df- 起头的串在本文件里一处都不该有');
  const rows = zRows('keep\nold tail', 'keep\nnew tail');
  const asDf = zCreate(zEnv()).renderSide(rows, 'a');
  const asZx = zCreate(zEnv({ prefix: 'zx' })).renderSide(rows, 'a');
  assert.equal(asZx, asDf.replaceAll('df-', 'zx-'), '换前缀之后产出必须逐字符跟着换：这一格没跟着换的地方就是第二套类名');
  assert.equal(asZx.includes('df-'), false, '换档之后还留着 df- = 两处字面量没派生');
});

test('Z4 并排两栏的行数相等：缺席那一侧长成 fill 而不是少一行，且不给自己编行号', () => {
  const v = zCreate(zEnv());
  const rows = zRows('a\nb\nc', 'a\nX\nc\nlast');
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, ` data-${Z_P}-i=`), rows.length, '一栏一份行块：renderSide 不许把 fill 那一格省掉');
  assert.equal(zCount(B, ` data-${Z_P}-i=`), rows.length, '两栏行数不等 = 滚动一错位就错到底，对齐是视图层的责任不是 CSS 的');
  assert.deepEqual(zBlocks(A).map((bl) => /-row--(\w+)/.exec(bl)[1]), ['equal', 'change', 'equal', 'fill'],
    'A 栏那一列行档：新增行在 A 侧是 fill，不是凭空少一行');
  assert.deepEqual(zBlocks(B).map((bl) => /-row--(\w+)/.exec(bl)[1]), ['equal', 'change', 'equal', 'ins']);
  const fill = zBlocks(A)[3];
  assert.equal(fill.includes(` data-${Z_P}-ln=`), false, 'fill 不许有行号：那是"这一侧没有这一行"，不是第 0 行');
  assert.equal(zPlain(fill).trim(), '', 'fill 那一格除了行档什么都不写，占位交给 CSS 的行高');
  const bothRows = zBlocks(B)[3];
  assert.equal(new RegExp(` data-${Z_P}-ln="(\\d+)"`).exec(bothRows)[1], '3', '行号取的是这一侧的下标（0-based → 屏上 1-based）');
  // 上面那一句读的是**属性**里那个 0-based 下标，屏上画出来的那一格还得再钉一次：Task 8 的变异刀
  // （`ln + 1` 改成 `ln`）在这一格里量不到任何东西——整族 439 判全绿，而页面上每一行的行号都从 0 起。
  const noCell = (bl) => {
    const m = new RegExp(`<span class="${Z_P}-row__no">([^<]*)</span>`).exec(bl);
    return m ? m[1] : null;
  };
  assert.deepEqual(zBlocks(A).map(noCell), ['1', '2', '3', ''], '可见行号 = 下标 + 1：属性是 0-based 那一格已经钉过，这一句钉的是用户读到的那个数（fill 留空）');
  assert.deepEqual(zBlocks(B).map(noCell), ['1', '2', '3', '4'], '两栏各自数自己那一侧的行号：B 侧多出的第 4 行在 A 侧是 fill');
  assert.deepEqual(zRows('a\nb', 'a\nb'), [],
    '完全相同拿不出任何行：hunksOf 只切差异块。两栏各 0 行仍然等长，而"这里明明比过了"那句话归结论格（Z12）与装配层的空态（Task 5）');
  const same = v.renderSide(zRows('a\n\nb', 'a\n\nB'), 'a');
  assert.equal(zBlocks(same).length, 3, '有差异才切得出块：这一份的中间那行是空行');
  assert.equal(zCount(same, `${Z_P}-row__txt"></pre>`), 1, '空行那一格是空串，但行块照样在：视图层不许替它猜一个占位符');
  assert.throws(() => v.renderSide(rows, 'c'), /栏只认/);
  assert.throws(() => v.renderSide(null, 'a'), TypeError);
  assert.throws(() => v.renderSide(['x'], 'a'), TypeError, '行对象不是对象要说清第几行——静默渲一栏空白是这一层最难查的形状');
  assert.throws(() => v.renderSide([{ kind: 'weird', a: 0, b: 0, textA: '', textB: '', inline: null, crlfA: false, crlfB: false }], 'a'),
    /kind/, '对齐引擎多出一档而行视图不认识它，必须停在开发期，不许静默渲成一栏没有头的东西');
});

test('Z5 change 行在两栏各出现一次，而高亮只有各自那一半', () => {
  const v = zCreate(zEnv());
  const rows = zRows('foo bar baz', 'foo qux baz');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'change');
  assert.ok(Array.isArray(rows[0].inline), '这一对行该有行内细化；没有的话是夹具越了 token 档，要改样本不是改口径');
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, `${Z_P}-row--change`), 1, '同一次改动在两栏各出现一次');
  assert.equal(zCount(B, `${Z_P}-row--change`), 1);
  assert.equal(A.includes(`${Z_P}-inline--ins`), false, 'A 栏高亮对方新增的 token，等于把 B 的内容画在 A 的行上');
  assert.equal(B.includes(`${Z_P}-inline--del`), false, '同一件事的反方向');
  assert.equal(zCount(A, `${Z_P}-inline--del`), 1);
  assert.equal(zCount(B, `${Z_P}-inline--ins`), 1);
  assert.equal(zTxt(A), 'foo bar baz', '分段拼回去必须还是整行原文：少一段就是"页面上的行"不再是那一行');
  assert.equal(zTxt(B), 'foo qux baz');
  assert.equal(v.renderInline([{ t: 'equal', text: 'a' }, { t: 'del', text: 'b' }, { t: 'ins', text: 'c' }], 'a'),
    `a<span class="${Z_P}-inline--del">b</span>`, '一条片段序列里 del 与 ins 交替躺着：A 栏只读等价与自己被删的那半，另一侧那半是 B 栏的内容');
  assert.equal(v.renderInline([{ t: 'equal', text: 'a' }, { t: 'del', text: 'b' }, { t: 'ins', text: 'c' }], 'b'),
    `a<span class="${Z_P}-inline--ins">c</span>`, '同一份片段在 B 栏读的是另一半（少挑一次就是把对方的改动画在自己行上）');
  assert.throws(() => v.renderInline('x', 'a'), TypeError);
  assert.throws(() => v.renderInline([{ t: 'weird', text: 'y' }], 'a'), /档只认/,
    '词汇表外的着色档要抛：样式那边没有第四种颜色，静默忽略就是"高亮少了一块却看不出来"');
  assert.throws(() => v.renderInline([{ t: 'equal' }], 'a'), TypeError, '缺 text 的片段到了页面上是一串 undefined');
});

test('Z6 CRLF 那一格画注入的符号而不是留白，符号换了产出跟着换', () => {
  const v = zCreate(zEnv());
  const rows = zRows('a\r\nb\r\n', 'a\r\nb\n');
  assert.deepEqual(rows.map((r) => r.kind), ['equal', 'change'], '同一行文字、行尾形状不同 → 第二行是一处改动（crlf 进比较键，X1 与 X6 的口径）');
  assert.equal(rows[1].crlfA, true);
  assert.equal(rows[1].crlfB, false);
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, `${Z_P}-row__cr">${X_CR}<`), 2, '行尾那个回车必须画得出符号：留白与"这一格没渲染"在页面上是同一张脸');
  assert.equal(zCount(B, `${Z_P}-row__cr">${X_CR}<`), 1);
  assert.equal(zCount(B, `${Z_P}-row__cr`), 1, '不带回车的那一侧不许长出这一格（省一格是一格，别靠 CSS 藏）');
  assert.equal(zPlain(zBlocks(A)[1]).endsWith(`b${X_CR}`), true, '符号落在行内容之后，读起来就是"这一行以回车结尾"');
  const swapped = zCreate(zEnv({ crGlyph: 'CR' })).renderSide(rows, 'a');
  assert.equal(swapped, A.replaceAll(X_CR, 'CR'), '符号从注入里来：写死 ␍ 等于在视图层再存一份口径，而那一本已经在 diff-core');
  assert.equal(v.renderSide(zRows('a\nb', 'a\nb'), 'a').includes(`${Z_P}-row__cr`), false, '一格里都不该有');
});

test('Z7 折叠条那句"省略 N 行"的 N 与 hunksOf 同源，0 行那一档整条不长', () => {
  const v = zCreate(zEnv());
  const a = Array.from({ length: 40 }, (_, i) => `L${i}`).join('\n');
  const b = a.replace('L0', 'X0').replace('L30', 'Y30');
  const hs = dHunks(dLines(a, b), 1);
  assert.equal(hs.length, 2, '夹具该折叠出两块：context=1 而两段之间隔着 29 行相同');
  assert.equal(hs[0].skipped, 0, '夹具的第一块要从文件头开始，否则下面那句"第一条不许长条"是空跑');
  assert.ok(hs.slice(1).every((h) => h.skipped > 0), '省略行数不全是正数的话，这一串断言同样在空跑');
  const bars = hs.map((h) => v.renderFoldBar({ skipped: h.skipped, tail: false }));
  assert.equal(bars[0], '', '第一块前面没有东西，不许长出"省略 0 行"那种自证式空条');
  for (let k = 1; k < hs.length; k += 1) {
    const n = Number(new RegExp(` data-${Z_P}-skip="(\\d+)"`).exec(bars[k])[1]);
    assert.equal(n, hs[k].skipped, '条上的数字与 skipped 同源：两处各算一遍就是"折叠条说谎"的成因');
    assert.equal(zPlain(bars[k]).startsWith(`省略 ${n} 行`), true);
    assert.equal(zCount(bars[k], String(n)), 2, '属性一次、正文一次，别的格子不许出现这个数');
  }
  const last = hs[hs.length - 1];
  assert.ok(last.tailSkipped > 0, '夹具该在末尾留下一段折叠');
  const tail = v.renderFoldBar({ skipped: last.tailSkipped, tail: true });
  assert.equal(tail.includes(`${Z_P}-fold--tail`), true, '尾条与头条是两档：样式与点击行为都按这两档分');
  assert.equal(tail.includes(`${Z_P}-fold--head`), false);
  assert.equal(tail.includes(` data-${Z_P}-skip="${last.tailSkipped}"`), true);
  assert.equal(v.renderFoldBar({ skipped: 0, tail: true }), '');
  assert.equal(v.renderFoldBar({ skipped: last.skipped }), v.renderFoldBar({ skipped: last.skipped, tail: false }), 'tail 缺省就是 false，不许把"没给"读成"是尾条"');
  assert.throws(() => v.renderFoldBar({ skipped: 2.5 }), RangeError, '省略行数只该是整数：小数会把滚动条总长算歪（与 §V 的 treePad 同一条）');
  assert.throws(() => v.renderFoldBar({ skipped: -1 }), RangeError);
  assert.throws(() => v.renderFoldBar({ skipped: 3, tail: 'yes' }), TypeError);
  assert.throws(() => v.renderFoldBar(null), TypeError);
});

test('Z8 每一只渲染器都过 env.esc：三类载荷进去，出来的串里没有裸标记', () => {
  const v = zCreate(zEnv());
  const payloads = ['<script>alert("x")</script>', 'a"b\'c&d', '两行\n载荷'];
  for (const raw of payloads) {
    const want = J_VIEW.esc(raw);
    assert.equal(v.renderNotice(raw).includes(want), true, `renderNotice 没走注入的那只 esc：${raw}`);
    assert.equal(v.renderNotice(raw).includes('<script'), false);
    const rowHtml = v.renderSide([{ kind: 'equal', a: 4, b: 4, textA: raw, textB: raw, inline: null, crlfA: false, crlfB: false }], 'a');
    assert.equal(rowHtml.includes(want), true, `renderSide 的行内容没走 esc：${raw}`);
    assert.equal(zTxt(rowHtml), raw, '转义是可逆的这一层该做到的：屏上读到的还是那一行');
    assert.equal(v.renderSide([{ kind: 'change', a: 0, b: 0, textA: raw, textB: raw, inline: [{ t: 'del', text: raw }], crlfA: false, crlfB: false }], 'a').includes(want), true,
      '行内片段同样只出 esc 之后的串');
    const table = v.renderJsonTable({
      changes: [{ pointer: raw, kind: 'change', owner: 'both', depth: 1, aPreview: raw, bPreview: '1', aType: 'string', bType: 'number' }],
      stats: { add: 0, remove: 0, change: 1, type: 0, compared: 3, depth: 1 }, notes: [raw], truncated: false,
    });
    assert.equal(wCount(table, want) >= 3, true, 'Pointer、A 侧与表尾那一句三处都要过 esc，少一处就是有一格漏网');
    assert.equal(table.includes('<script'), false);
  }
  assert.equal(v.renderNotice('<b>粗</b>').includes('&lt;b&gt;'), true, '连强调标签都不许放过去');
});

test('Z9 行内容与 Pointer 不许落到属性位：属性名与属性值都只认那几格', () => {
  const v = zCreate(zEnv());
  const nasty = 'x" data-evil="1';
  const html = v.renderSide([{ kind: 'change', a: 2, b: 3, textA: nasty, textB: 'y', inline: [{ t: 'del', text: nasty }, { t: 'ins', text: 'y' }], crlfA: false, crlfB: false }], 'a')
    + v.renderJsonTable({
      changes: [{ pointer: nasty, kind: 'remove', owner: 'only-a', depth: 0, aPreview: nasty, bPreview: null, aType: 'string', bType: 'absent' }],
      stats: { add: 0, remove: 1, change: 0, type: 0, compared: 1, depth: 0 }, notes: [], truncated: false,
    })
    + v.renderFoldBar({ skipped: 7 });
  const attrs = zAttrs(html);
  assert.ok(attrs.length >= 6, `夹具该产出若干属性，实际 ${attrs.length} 个——空跑一遍等于没判`);
  assert.deepEqual([...new Set(attrs.map((x) => x.name))].filter((n) => n !== 'class' && n !== 'type').sort(),
    [`data-${Z_P}-depth`, `data-${Z_P}-i`, `data-${Z_P}-ln`, `data-${Z_P}-skip`],
    '属性名多一枚就是第二套口径：装配层与样式只认这几格');
  for (const { name, value } of attrs) {
    if (name === 'class' || name === 'type') continue;
    assert.match(value, /^\d+$/, `${name} 的属性位上出现了非整数值：${value}`);
  }
  assert.equal(/[A-Za-z]/.test(attrs.filter((x) => x.name !== 'class' && x.name !== 'type').map((x) => x.value).join('')), false,
    '属性值里出现字母就是文本进了属性位——那一格 esc 管不住');
  assert.equal(zPlain(html).includes(nasty), true, '载荷要作为正文原样到达，不许被"顺手剔掉"');
});

test('Z10 JSON 变更表：六列表头、absent 与真 null 分得开、代价说明同屏（Y18 的第二半）', () => {
  const v = zCreate(zEnv());
  const r = yDiff('{"a":1,"b":2}', '{"a":null}');
  assert.deepEqual([r.verdict, r.stats.type, r.stats.remove, r.stats.compared], ['diff', 1, 1, 2], '夹具形状：/a 是类型变（1 → null），/b 是删除');
  const html = v.renderJsonTable({ changes: r.changes, stats: r.stats, notes: Object.values(Y_NOTES), truncated: false });
  assert.deepEqual([...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]),
    ['位置', '变更', '归属', 'A 侧', 'B 侧', '深度'], '六列少一列或换了次序，表读起来就和 diff-json 交出的那六格对不上');
  const cellsOf = (tr) => [...tr.matchAll(/<td class="[^"]*">([\s\S]*?)<\/td>/g)].map((m) => zPlain(m[1]));
  const trs = html.split('<tr').slice(2);
  assert.equal(trs.length, 2);
  assert.deepEqual(cellsOf(trs[0]), ['/a', '类型变', '两侧', '1', 'null', '1'], '值真的是 null 的那一格写 null，不是"这一侧没有"（§0.6 记的偏差）');
  assert.deepEqual(cellsOf(trs[1]), ['/b', '删除', '仅 A', '2', '（这一侧没有）', '1']);
  assert.equal(zCount(html, '（这一侧没有）'), 1, '缺席档只在真缺席的那一格出现');
  assert.equal(html.includes('比对 2 格'), true, 'stats.compared 要上屏：不写这一格用户读不出"比了多久"');
  assert.equal(html.includes('最深 1 层'), true);
  assert.equal(zCount(html, '<li'), Object.keys(Y_NOTES).length, '六句代价说明与表同屏，拆到别处就没人读');
  for (const [k, sentence] of Object.entries(Y_NOTES)) assert.equal(html.includes(J_VIEW.esc(sentence)), true,
    `漏了 ${k} 那一句（或那一句没过 esc）：${sentence}`);
  assert.equal(html.includes('这里截断'), false);
  assert.equal(v.renderJsonTable({ changes: r.changes, stats: r.stats, notes: [], truncated: true }).includes('这里截断'), true,
    'truncated 那一档要说"列表截了、计数仍是全量"（Y12、Y18）');
  const empty = v.renderJsonTable({ changes: [], stats: { add: 0, remove: 0, change: 0, type: 0, compared: 3, depth: 2 }, notes: [], truncated: false });
  assert.equal(zCount(empty, '<tr class'), 0, '零变更就是一张没有体的表，不是"没有这张表"');
  assert.equal(empty.includes('比对 3 格'), true);
  const bad = (over, re, why) => assert.throws(() => v.renderJsonTable({
    changes: [{ pointer: '/a', kind: 'change', owner: 'both', depth: 0, aPreview: '1', bPreview: '2', aType: 'number', bType: 'number', ...over }],
    stats: {}, notes: [], truncated: false,
  }), re, why);
  bad({ kind: 'rename' }, /变更档/, '词汇表外的 kind 不许静默渲成一格空白的"变更"列');
  bad({ owner: 'only-c' }, /归属/, '同一件事在归属列');
  bad({ pointer: 1 }, TypeError, 'Pointer 是文本，不是编号');
  bad({ depth: 1.5 }, RangeError, '深度只该是整数');
  bad({ aPreview: undefined }, /预览/, '非缺席的一格预览缺席 = 表里出现空格子');
  assert.throws(() => v.renderJsonTable({ changes: 'x', stats: {}, notes: [] }), TypeError);
  assert.throws(() => v.renderJsonTable({ changes: [], stats: {}, notes: 'x' }), TypeError, 'notes 只收那六句的数组：装配层递错了要在这一层点名');
  assert.throws(() => v.renderJsonTable({ changes: [], stats: {}, notes: [], truncated: 'yes' }), TypeError);
  assert.throws(() => v.renderJsonTable(null), TypeError);
});

test('Z11 坏输入那一格只有一句话，且不吞掉别的文案', () => {
  const v = zCreate(zEnv());
  const reason = dGate(X_HUGE, '1').reason;
  const html = v.renderNotice(reason);
  assert.equal(zCount(html, '<p'), 1, '一句话就是一句话：拆成两段会让"闸门那一档"在页面上长得像一段说明');
  assert.equal(zCount(html, '</p>'), 1);
  assert.equal(zPlain(html), reason, '那句理由要逐字到达（上限与实测与超出都在里面）');
  assert.equal(html.includes(`${Z_P}-notice`), true);
  const page = html + v.renderStats(dLines('a', 'a').stats);
  assert.equal(zCount(page, '<p'), 2, 'notice 与读数各写各的格子，拼起来两处都还在');
  assert.throws(() => v.renderNotice(''), /一句话/);
  assert.throws(() => v.renderNotice(null), TypeError);
  assert.throws(() => v.renderNotice(['a', 'b']), TypeError, '两句话该由装配层挑一句递进来，视图层不许静默拼成一段');
});

test('Z12 读数只认那七个名字，结论按模式各有词表且 blocked / invalid 进不来', () => {
  const v = zCreate(zEnv());
  const s = { added: 1, removed: 2, changed: 3, unchanged: 4, blocks: 5, inlineSkipped: 6, ignored: 7 };
  const html = v.renderStats(s);
  assert.equal(html, `<p class="${Z_P}-stats">增 1 · 删 2 · 改 3 · 同 4 · 5 处 · 未行内 6 · 归一化抹平 7</p>`,
    '读数那一行的措辞与顺序钉死：装配层只挑递哪一份 stats，不挑这一行长什么样');
  assert.equal(html, v.renderStats({ ...s, future: 99, verdict: 'nope' }), '模块以后往 stats 里加一格，这一行的形状不许跟着变');
  assert.equal(v.renderStats({}), `<p class="${Z_P}-stats">增 0 · 删 0 · 改 0 · 同 0 · 0 处 · 未行内 0 · 归一化抹平 0</p>`,
    '缺的那一格给 0，不给空格也不给 —：那是"这一份里一处新增也没有"，不是"没测出来"');
  assert.throws(() => v.renderStats(null), TypeError);
  assert.throws(() => v.renderStats('x'), TypeError);
  const t = (over) => v.renderVerdict({ mode: 'text', verdict: 'same', stats: { ...s, ignored: 0 }, ...over });
  assert.equal(t().includes('逐字符相同'), true);
  assert.equal(t({ stats: { ...s, ignored: 9 } }).includes('归一化'), true, '勾了忽略空白之后的"相同"要说清是被归一化过的结论（X20、DIFF_NOTES.ignored）');
  const d = v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s });
  for (const piece of ['增 1 行', '删 2 行', '改 3 行', '5 处']) assert.equal(d.includes(piece), true, `结论那一格少说一件事：${piece}`);
  assert.equal(v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s, degraded: true }).includes('整块'), true, '降级必须在结论格里也说一句（X13、X14 上页的那一半）');
  assert.equal(d.includes('整块'), false, '没降级不许提');
  const jSame = v.renderVerdict({ mode: 'json', verdict: 'same', stats: { add: 0, remove: 0, change: 0, type: 0, compared: 3, depth: 1 } });
  assert.equal(jSame.includes('按 JSON 值判为相同'), true, 'json 档的"相同"不许写成"逐字符相同"——那是另一件事（Y3）');
  assert.equal(jSame.includes('键的书写次序也一致'), true);
  const sk = yDiff('{"a":1,"b":2}', '{"b":2,"a":1}');
  assert.equal(sk.verdict, 'same-key-order');
  assert.equal(v.renderVerdict({ mode: 'json', verdict: sk.verdict, stats: sk.stats }).includes('键的书写次序不同'), true);
  assert.equal(v.renderVerdict({ mode: 'json', verdict: 'diff', stats: { add: 1, remove: 2, change: 3, type: 4 } }).includes('10 处不同'), true,
    '四个数要在这一格里合得起来：用户读的是"几处"，表读的是"哪几处"');
  for (const word of ['blocked', 'invalid', 'same-key-order']) {
    assert.throws(() => v.renderVerdict({ mode: 'text', verdict: word, stats: s }), /renderNotice/,
      `text 档认得 ${word} 就是把"没比成"写成结论`);
  }
  for (const word of ['blocked', 'invalid']) {
    assert.throws(() => v.renderVerdict({ mode: 'json', verdict: word, stats: {} }), TypeError);
  }
  assert.throws(() => v.renderVerdict({ mode: 'yaml', verdict: 'same', stats: s }), /模式/);
  assert.throws(() => v.renderVerdict(null), TypeError);
  assert.throws(() => v.renderVerdict({ mode: 'text', verdict: 'same', stats: s, degraded: 'yes' }), TypeError);
  assert.equal(v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s }).includes(`${Z_P}-verdict--diff`), true, '结论档也进 class：样式只认那三个词');
});

// 装配层与入口（Task 5）落进**同一节**，所以这里不再立 `// ── §` 标记：`§Z` 那一格数的判据要连着
// Z1–Z28 一起报，另起一节会让 §A 那张用例分布表少算一格（段 4 的 §U 是同一形状的先例）。
//
// 本节后半钉的是"这一页跑不跑得起来"，六条红线各自的形状：
//   · **环境只在入口**（Z14、Z15）：词表比 §W10 多两枚——`FileReader` 与 `File` 这两只手归入口，
//     装配层里 `FileReader` 0 次、`instanceof` 0 次（本层不判断宿主类型，收到了就当对象读形状）。
//     `localStorage` 与 `Date.now(` 这一页**两本都不许出现**（本页不做"记住上次输入"，红线里
//     那句"输入不出本机"因此不需要任何退路可写）；入口那八件各恰好一处，数的是出现次数。
//   · **id 只由 `DIFF_SPEC` / `DIFF_ACTIONS` 派生**（Z16）：装配层源码里 `df-` 0 次、整格字面量 0 格，
//     `controlIds(prefix)` 与骨架与 spec 三个方向对账；入口那三行地址（`CONTAINER_ID` / `NOTICE_ID`
//     / `ATTR`）反过来**必须**是字面量——那是本页在 HTML 里的地址，门禁⑤ 组 5 靠正则找那三行。
//   · **挂载期与输入路径一次计算都不做**（Z18）：二十次 `input` 之后注入的 `runGuarded` 计数为 0，
//     结果区里一行 `df-row` 都不许有；防抖令牌只让最后一次真的读闸门（`state().gateReads` 数这件事）。
//   · **两类失败分两条路**（Z26）：用户那一格不能用（空输入 / 坏 JSON / 超闸门）→ 一句话进状态行，
//     上一格结果原样留着；spec 与骨架漂移（档位越界、节点缺席）→ 原样上抛交给 `runGuarded`，
//     同样**不许擦掉上一格**（`compute` 一律先算后画，抛在画之前）。
//   · **换前缀自证**（Z28）：`df` ↔ `zx` 整页 id 跟着换、门禁仍绿，照 §R16 / §W18 那一形状。
//   · **import 边闭合**（Z13）：正向核装配层只 reach 那三本，反向核用排除式写法（M16 / N19）数"谁 reach"。

const {
  createDiffWorkbench: zCreateWb, DIFF_PANEL_IDS: Z_PANEL_IDS, DIFF_SPEC: Z_SPEC,
  DIFF_ACTIONS: Z_ACTIONS, SIDES: Z_SIDE_NAMES, controlIds: zControlIds,
  fieldId: zField, buttonId: zButton, copyId: zCopy, outId: zOut, whenId: zWhen, statusId: zStatus,
} = await import('../dev/js/tools/diffWorkbench.js');

const Z_PANEL = 'workbench';
const Z_BAR = 'bar';
const Z_ASSEMBLY = 'dev/js/tools/diffWorkbench.js';
const Z_ENTRY = 'dev/js/toolDiff.js';
const Z_CORE_REL = 'dev/js/tools/diff-core.js';
const Z_JSON_REL = 'dev/js/tools/diff-json.js';

/** spec 的 `type` → 骨架标签：比 §W 多一枚 `file`（选本地文件那一格），词汇表外当场抛 */
const Z_TAGS = { text: 'input', area: 'textarea', select: 'select', checkbox: 'input', file: 'input' };
const zTag = (type) => {
  const tag = Z_TAGS[type];
  if (!tag) throw new Error(`夹具：DIFF_SPEC 里出现了词汇表外的 type「${String(type)}」（认得 ${Object.keys(Z_TAGS).join(' / ')}）`);
  return tag;
};
/** 节点族 → id：本层只认这三族，第四族（`tree`）在这一页没有对应的事实 */
const zFamId = (prefix, fam, side) => {
  if (fam === 'out') return zOut(prefix, Z_PANEL, side);
  if (fam === 'status') return zStatus(prefix, Z_PANEL, side);
  if (fam === 'copy') return zCopy(prefix, Z_PANEL, side);
  throw new Error(`夹具：${side} 栏声明了节点族「${String(fam)}」，而这一页只有 out / status / copy 三族`);
};
/** 整格字面量那把尺与 §W 共用一本（`mark` 换成本页前缀） */
const zHandIds = (rel, mark = `${Z_P}-`) => wHandTypedIds(rel, mark);

/**
 * 造一页对比骨架：提示行 + 容器 + 按 `DIFF_SPEC` 三栏长出的控件、显隐段、节点族，
 * 再按 `DIFF_ACTIONS` 长出十四枚按钮。
 *
 * 为什么是**第三本**假 DOM（§I 的证件页那份、§W 的 JSON 那份之外）：`wPage` 吃的是 `JSON_SPEC` /
 * `JSON_PANEL_IDS` 这两个全局名，它按 `sides.main` 一栏长；这一页的 spec 是三栏（a / b / bar）、
 * 控件 id 里编了栏位、节点族由每栏自己声明，还要多两样本节独有的观察口（`files` 与 `el.click()` 的
 * 落点日志）。把 `wPage` 改成能服务两页等于给 §W 那二十七判换地基——既有先例是 §R 与 §W 各留一份。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀（Z28 的 `zx` 那一档量的就是它）
 * @param {Record<string, string|boolean>} [o.seed] `'控件 id → 初值'`
 * @param {string[]} [o.drop] **不**要长的 id，造"骨架与 spec 漂移"那一类缺陷
 * @returns {object} 节点表 + 观察口
 */
function zPage({ prefix = Z_P, seed = {}, drop = [] } = {}) {
  const nodes = new Map();
  const created = { list: [] };
  const clicked = [];
  const mk = (tag, id = '', attrs = {}) => {
    const el = {
      nodeType: 1, tagName: String(tag).toUpperCase(), id, hidden: false, disabled: false,
      value: '', checked: false, innerHTML: '', files: undefined, scrollTop: 0, style: {},
      attrs: new Map(), childNodes: [], listeners: new Map(), parentNode: null,
      get textContent() { return this.childNodes.map((c) => c.textContent).join(''); },
      set textContent(v) { this.childNodes = v === '' ? [] : [{ nodeType: 3, tagName: '#text', textContent: String(v) }]; },
      getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; },
      setAttribute(n, v) { this.attrs.set(n, String(v)); },
      removeAttribute(n) { this.attrs.delete(n); },
      appendChild(c) { this.childNodes.push(c); c.parentNode = this; return c; },
      removeChild(c) {
        const at = this.childNodes.indexOf(c);
        if (at < 0) throw new Error('removeChild：这个节点不在里面');
        this.childNodes.splice(at, 1);
        c.parentNode = null;
        return c;
      },
      addEventListener(t, fn) {
        if (!this.listeners.has(t)) this.listeners.set(t, []);
        this.listeners.get(t).push(fn);
      },
      dispatch(t, evt = {}) {
        for (const fn of this.listeners.get(t) || []) fn(evt);
        return evt;
      },
      // 真 DOM 的 `el.click()` 会派发一次真的 click：`fileA` / `fileB` 两枚按钮靠它打开选择器，
      // 而**这一发要留痕**——判据问的是"装配层自己按了哪一枚"，派发过程本身不算答案。
      click() { clicked.push(this.id); return this.dispatch('click', {}); },
    };
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'hidden') el.hidden = v; else el.setAttribute(k, v);
    }
    if (id !== '') nodes.set(id, el);
    return el;
  };
  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => { const el = mk(tag); created.list.push(el); return el; },
    body: mk('body'),
  };
  const gone = new Set(drop);
  const want = (id) => (gone.has(id) ? null : mk('div', id));

  want(`${prefix}-notice`);
  const box = want(`${prefix}-workspace`);
  if (box) {
    box.setAttribute(`data-${prefix}-ids`, Z_PANEL_IDS.join(','));
    box.setAttribute(`data-${prefix}-prefix`, prefix);
    box.setAttribute(`data-${prefix}-label`, '文件对比');
    box.setAttribute(`data-${prefix}-notice`, `${prefix}-notice`);
  }
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    for (const c of cfg.controls) {
      const id = zField(prefix, Z_PANEL, c.id);
      if (gone.has(id)) continue;
      const el = mk(zTag(c.type), id);
      if (c.type === 'select') {
        for (const opt of c.options ?? []) {
          const o = mk('option');
          o.setAttribute('value', opt);
          o.textContent = opt;
          el.appendChild(o);
        }
      }
      if (seed[c.id] !== undefined) {
        if (c.type === 'checkbox' || c.type === 'file') el.checked = seed[c.id] === true;
        else el.value = String(seed[c.id]);
      }
      if (c.type === 'file') el.setAttribute('accept', '.txt,.md,.json');
    }
    for (const tg of cfg.switch?.targets ?? []) {
      const id = zWhen(prefix, Z_PANEL, tg.key);
      if (gone.has(id)) continue;
      const p = mk('p', id);
      p.setAttribute(`data-${prefix}-when`, tg.when.join(' '));
    }
    for (const fam of cfg.nodes ?? []) {
      const id = zFamId(prefix, fam, side);
      if (gone.has(id)) continue;
      if (fam === 'copy') {
        const b = mk('button', id);
        b.textContent = `复制 ${side} 侧`;
      } else if (fam === 'out') mk('div', id);
      else mk('p', id);
    }
  }
  for (const a of Z_ACTIONS) {
    const id = zButton(prefix, Z_PANEL, a.key);
    if (gone.has(id)) continue;
    mk('button', id).textContent = a.label;
  }

  const ctl = (id) => doc.getElementById(zField(prefix, Z_PANEL, id));
  const at = (id) => doc.getElementById(id);
  return {
    doc, nodes, mk, box, created, clicked,
    ctl,
    set: (id, v) => { ctl(id).value = String(v); },
    check: (id, v) => { ctl(id).checked = !!v; },
    val: (id) => (ctl(id) ? ctl(id).value : null),
    input: (id) => ctl(id).dispatch('input', {}),
    change: (id) => ctl(id).dispatch('change', {}),
    click: (key) => { const el = at(zButton(prefix, Z_PANEL, key)); return el.dispatch('click', {}); },
    clickCopy: (side) => at(zCopy(prefix, Z_PANEL, side)).dispatch('click', {}),
    area: (side) => ctl(`${side}-text`).value,
    name: (side) => ctl(`${side}-name`).value,
    out: () => { const el = at(zOut(prefix, Z_PANEL, Z_BAR)); return el ? String(el.innerHTML) : ''; },
    /** 结果区那一格到底有没有被写过（空串与"没这一格"是两件事，Z26 判的就是这个区别） */
    outWritten: () => (at(zOut(prefix, Z_PANEL, Z_BAR)) ? at(zOut(prefix, Z_PANEL, Z_BAR)).innerHTML !== '' : null),
    scrollTop: () => { const el = at(zOut(prefix, Z_PANEL, Z_BAR)); return el ? el.scrollTop : null; },
    line: () => { const el = at(zStatus(prefix, Z_PANEL, Z_BAR)); return el ? el.textContent : null; },
    read: (side) => { const el = at(zStatus(prefix, Z_PANEL, side)); return el ? el.textContent : null; },
    hidden: (key) => { const el = at(zWhen(prefix, Z_PANEL, key)); return el ? el.hidden === true : null; },
    disabled: (id) => (at(id) ? at(id).disabled === true : null),
    btnDisabled: (key) => at(zButton(prefix, Z_PANEL, key)).disabled === true,
    label: (id) => (at(id) ? at(id).textContent : null),
    /** 选文件：先给假 `files`，再派发 `change`（§W 那份夹具的 `files` 永远是 undefined，量不到这一路） */
    pickFile: (side, file) => { const el = ctl(`${side}-file`); el.files = file ? [file] : []; return el.dispatch('change', {}); },
    /** 拖放落点：每一侧的粘贴框自己 */
    drop: (side, files) => ctl(`${side}-text`).dispatch('drop', { dataTransfer: { files }, preventDefault: () => {} }),
    /**
     * 点结果区里的一条折叠条。真浏览器里 `evt.target` 就是那枚 `<button class="df-fold">`，
     * 而假 DOM 的 `innerHTML` 只是个串、里面根本不长节点，所以这一发自己造一枚带那格属性的按钮再派发
     * ——它量的仍是"装配层在那一发里做了什么"。`attr` 允许外部指定属性名（Z29 用它试"换了前缀
     * 还认不认得旧地址"那一刀）。
     */
    clickFold: (skip = 7, attr) => {
      const box = at(zOut(prefix, Z_PANEL, Z_BAR));
      if (!box) return null;
      return box.dispatch('click', { target: mk('button', '', { [attr || `data-${prefix}-skip`]: String(skip) }) });
    },
    /** 点结果区里一处**不是**折叠条的落点：行块只带 `data-{prefix}-ln`，点它不许动档 */
    clickRow: (ln = 3) => {
      const box = at(zOut(prefix, Z_PANEL, Z_BAR));
      if (!box) return null;
      return box.dispatch('click', { target: mk('div', '', { [`${`data-${prefix}-ln`}`]: String(ln) }) });
    },
    madeOf: (tag) => created.list.filter((el) => el.tagName === String(tag).toUpperCase()),
  };
}

/**
 * 接一页：`zPage` 长骨架，`createDiffWorkbench` 接装配层，注入的 `runGuarded` 既数调用也记"这一格抛了"。
 *
 * 与 `wMount` 的差别只有两处，且都是本页的形状：**不注入 `storage` 也不注入 `now`**（红线里那句
 * "这一页不做记住上次输入"，夹具给了就是替实现撒谎），**多两只文件读手**（`readFile` / `decode`）。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {Record<string, string|boolean>} [o.seed] 控件初值
 * @param {string[]} [o.drop] 骨架要缺的 id
 * @param {number} [o.rowHeight] 注入行高，缺席就是实现自己的退路值
 * @param {object|null} [o.dl] 下载三件的替身，`null` 代表不注入（下载按钮该置灰）
 * @param {object|null} [o.clipboard] 假剪贴板，`null` 代表没有这只手
 * @param {Function|null} [o.readFile] 读文件替身，`null` 代表不注入（选文件该置灰）
 * @param {Function|null} [o.decode] 解码替身，`null` 代表不注入
 * @returns {object} `{ page, wb, report, guarded, threw, timers, reads, copied, flush }`
 */
function zMount(o = {}) {
  const prefix = o.prefix || Z_P;
  const page = zPage({ prefix, seed: o.seed || {}, drop: o.drop || [] });
  const guarded = [];
  const threw = [];
  const timers = [];
  const reads = [];
  const copied = [];
  const dl = o.dl === undefined ? wDownload() : o.dl;
  const wb = zCreateWb({
    document: page.doc,
    Tk: { view: W_VIEW, ui: J_UI },
    prefix,
    runGuarded: (id, fn) => {
      guarded.push(id);
      try { fn(page.doc.getElementById(id)); return true; } catch (err) {
        threw.push([id, err && err.message]); return false;
      }
    },
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    navigator: { clipboard: o.clipboard === null ? undefined : (o.clipboard || { writeText: (t) => { copied.push(String(t)); return Promise.resolve(); } }) },
    ...(o.rowHeight === undefined ? {} : { rowHeight: o.rowHeight }),
    ...(dl === null ? {} : { BlobCtor: dl.BlobCtor, createObjectURL: dl.createObjectURL, revokeObjectURL: dl.revokeObjectURL }),
    ...(o.readFile === null ? {} : { readFile: o.readFile || ((f) => { reads.push(f.name); return Promise.resolve(f.__bytes); }) }),
    ...(o.decode === null ? {} : { decode: o.decode || ((b) => ({ ok: true, text: new TextDecoder('utf-8').decode(b) })) }),
  });
  const report = wb.mount();
  return {
    page, wb, report, guarded, threw, timers, reads, copied, dl,
    flush: () => { const list = timers.splice(0); for (const t of list) t.fn(); },
  };
}

/** 一个本地文件替身：`size` 给闸门看（拒收在**读之前**），`__bytes` 给注入的 `readFile` 交回 */
const zFile = (name, text, over) => {
  const bytes = new TextEncoder().encode(text);
  return { name, size: over === undefined ? bytes.length : over, __bytes: bytes };
};
/** 排空微任务：文件那一路是 Promise，而 `later` 被夹具换成"只记账不执行"（同 §J 的 `jSettle`） */
const zSettle = () => new Promise((r) => { setTimeout(r, 0); });

/** 一份能折叠出两块的输入：40 行，头行与第 31 行各改一处 */
const Z_A40 = Array.from({ length: 40 }, (_, i) => `L${i}`).join('\n');
const Z_B40 = Z_A40.replace('L0', 'X0').replace('L30', 'Y30');

test('Z13 import 边闭合：装配层只 reach 那三本，反向核数"谁 reach 这一本"', () => {
  assert.deepEqual(wImports(Z_ASSEMBLY).slice().sort(), ['./diff-core.js', './diff-json.js', './diffView.js'].sort(),
    '三本之外多一本 = 第二条跨模块的边；少一本 = 有一件事在本层自己重算了一遍（§0.4 那条构建红线的第二十八种写法）');
  assert.deepEqual(wImports(Z_ENTRY), ['./tools/diffWorkbench.js'],
    '入口只许 reach 装配层一本：视图层与两本算法由它带进来，入口再指一次就是两个入口 reach 同一模块 → 共享 chunk → 产物里 `import{` → 整页 SyntaxError 而构建退 0');
  assert.deepEqual(wImports(Z_CORE_REL), [], `${Z_CORE_REL} 是纯算法，import 边一多 §X 的夹具就要替它造环境`);
  assert.deepEqual(wImports(Z_JSON_REL), ['./diff-core.js'],
    '那一本只借闸门与两个上限；把 json-core.js 接过来就是 §0.4 那条买断没谈妥（重复的是读侧，不是闸门）');
  const reachersOf = (name) => wAllSources().filter((rel) => wImports(rel).some((p) => p.endsWith(`/${name}`)));
  assert.deepEqual(reachersOf('diffView.js'), [Z_ASSEMBLY], '视图层被第二个入口 reach = 共享 chunk');
  assert.deepEqual(reachersOf('diff-json.js'), [Z_ASSEMBLY], 'JSON 档的算法多了一个消费者：装配层就不再是唯一口径');
  assert.deepEqual(reachersOf('diff-core.js').slice().sort(), [Z_ASSEMBLY, Z_JSON_REL].sort(),
    '行级引擎的两本消费者就是这一对；第三本进来时 §X 的那二十九判要重算，而门禁不会替你说这句话');
  assert.deepEqual(reachersOf('diffWorkbench.js'), [Z_ENTRY], '装配层只有本入口一个消费者');
});

test('Z14 装配层零环境词：词表比 §W10 多两枚，而 innerHTML 那一处出口仍然只有一处', () => {
  const bare = wBare(Z_ASSEMBLY);
  for (const word of ['window', 'globalThis', 'Date.now(', 'localStorage', 'navigator.', 'new Blob',
    'URL.', 'getComputedStyle', 'querySelector', 'setTimeout(', 'FileReader', 'IntersectionObserver',
    'requestAnimationFrame', 'fetch(', 'alert(', 'instanceof']) {
    assert.equal(bare.includes(word), false,
      `装配层不许碰 ${word}：那一样由入口递进来，本层碰一次就多一处"两台机器给两个答案"（红线 2）。`);
  }
  // `instanceof` 是 `File` 那一枚的替身：裸词 `File` 在本层是合法名字（`fileName` / `readFile` 都归它），
  // 而这一格真正要钉的是"宿主类型判断不在本层"——那一档判断在入口的 `win.File` 上，Z15 数它恰好一处。
  assert.equal(wCount(bare, 'innerHTML'), 1, '整页只许一处 innerHTML（与 §W10 同一条口径）：第二处就是第二个"把串当标记"的出口');
  assert.equal(wCount(bare, 'createElement'), 1, '只有下载那一枚 `<a>` 需要造节点；再多一处就是第二条往 DOM 里塞东西的路');
  assert.equal(bare.includes('diff-core.js'), false, 'import 路径在 wBare 之后应当消失；还在说明有第二处动态取模块的写法');
});

test('Z15 入口那八件各恰好一处，而 localStorage 与 Date.now( 两本一起归零', () => {
  const src = wCode(Z_ENTRY);
  const counts = [
    ['win.FileReader(', 1, '选文件那一路的唯一一只读手'],
    ['win.TextDecoder', 1, 'UTF-8 那一档的唯一一处判编码（fatal 在入口，装配层只收 {ok,text}）'],
    ['win.Blob', 1, '下载三件的第一格：本层按工厂调用，不带 new'],
    ['URL.createObjectURL', 1, '第二格'],
    ['URL.revokeObjectURL', 1, '第三格（落在 finally，被拦下载也不泄）'],
    ['win.navigator', 1, '只取 clipboard'],
    ['setTimeout(', 1, '闸门读数的防抖'],
    ['getComputedStyle', 1, '行高：样式给的环境量，读一次就注入一次'],
  ];
  for (const [word, want, why] of counts) {
    assert.equal(wCount(src, word), want, `${word} 在入口里该恰好 ${want} 次（${why}），实测 ${wCount(src, word)} 次`);
  }
  // 计数口径：`win.FileReader` 里含着整格 `win.File`，不先剥掉它就会把同一只手数成两枚——
  // 而判据说的是"类型判断恰好一处"，那才是 `instanceof win.File` 那一格。
  const noReader = src.replace(/win\.FileReader/g, '');
  assert.equal(wCount(noReader, 'win.File'), 1, 'File 的类型判断该恰好一处（剥掉 FileReader 那一只之后数）');
  for (const rel of [Z_ENTRY, Z_ASSEMBLY]) {
    assert.equal(wBare(rel).includes('localStorage'), false, `${rel}：这一页不做"记住上次输入"，那句"输入不出本机"不需要任何退路可写`);
    assert.equal(wBare(rel).includes('Date.now('), false, `${rel}：没有要记的时间戳，时钟因此连入口都不该出现`);
  }
  assert.deepEqual(modNames(Z_ENTRY), [], '入口不许有顶层 export：iifeWrapPlugin 不补 use strict，留一条 export 就是整页语法错误');
  assert.equal(/\bDOMContentLoaded\b/.test(src), false, '脚本排在正文之后，接 DOMContentLoaded 就是第二个启动时机');
});

test('Z16 id 与类名只由 spec、actions 与 prefix 派生：装配层 0 处手打，入口那三行地址反过来必须是字面量', () => {
  assert.equal(wCount(wCode(Z_ASSEMBLY), `${Z_P}-`), 0,
    '装配层里一处手打前缀，Z28 的换前缀自证就绿得没有牙（§W10 同一条口径）');
  assert.deepEqual(zHandIds(Z_ASSEMBLY), [], '整格字面量口径：以 df- 起头的串在本文件一处都不该有');
  assert.deepEqual(zHandIds(Z_ASSEMBLY, 'zx-'), [], '换档之后也不该有——手打的地方只会跟着"当前那一页"漂');
  const ids = zControlIds(Z_P);
  const flat = Object.values(ids).reduce((acc, list) => acc.concat(list), []);
  assert.equal(new Set(flat).size, flat.length, `controlIds 里有重复 id：${flat.filter((x, i) => flat.indexOf(x) !== i).join(' ')}`);
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    for (const c of cfg.controls) assert.equal(flat.includes(zField(Z_P, Z_PANEL, c.id)), true, `${side} 栏的控件 ${c.id} 没进清单`);
    for (const fam of cfg.nodes ?? []) assert.equal(flat.includes(zFamId(Z_P, fam, side)), true, `${side} 栏的节点族 ${fam} 没进清单`);
    for (const tg of cfg.switch?.targets ?? []) assert.equal(flat.includes(zWhen(Z_P, Z_PANEL, tg.key)), true, `显隐段 ${tg.key} 没进清单`);
  }
  assert.equal(flat.length, new Set(flat).size, '清单总长要等于去重后的总长（上面那两条一起说同一件事的两面）');
  const page = zPage();
  const report = zMount().report;
  assert.deepEqual(report.missing, [], '骨架齐的时候不该报缺；报了就是 spec 与夹具两本漂了');
  for (const id of flat) assert.equal(page.nodes.has(id), true, `${id} 在 controlIds 里，骨架却没长：门禁⑤ 会在产物上红，这里先红`);
  const stray = [...page.nodes.keys()].filter((id) => new RegExp(`^${Z_P}-(?:in|when|btn|out|status|copy)-`).test(id) && !flat.includes(id));
  assert.deepEqual(stray, [], `骨架私自多长了这些格（装配层永远不会去读它）：${stray.join(' ')}`);
  // 入口那三行是**这一页在 HTML 里的地址**：门禁⑤ 组 5 用正则找它们，所以它们必须是字面量，
  // 而且必须写成能被那串正则找到的形状（照 toolJson.js 的同源格式）。
  const src = wCode(Z_ENTRY);
  assert.equal(/^const CONTAINER_ID = 'df-workspace';$/m.test(src), true, '容器 id 那一行是页面骨架的地址，跟着前缀派生就找不到容器了');
  assert.equal(/^const NOTICE_ID = 'df-notice';$/m.test(src), true);
  assert.equal(/^const ATTR = \{ ids: 'data-df-ids', prefix: 'data-df-prefix', label: 'data-df-label', notice: 'data-df-notice' \};$/m.test(src), true,
    '那四格属性名要与门禁⑤ 的 ATTR 正则逐字符一致');
});

test('Z17 对外面十一格、三栏的 nodes 声明与十四枚动作的三份名单', () => {
  assert.deepEqual(Z_PANEL_IDS, ['workbench'], '这一页没有面板清单：门禁⑤ 拿它比 DIFF_SPEC 的键');
  assert.deepEqual(Object.keys(Z_SPEC), Z_PANEL_IDS);
  assert.deepEqual(Z_SIDE_NAMES, ['a', 'b', Z_BAR], '两栏输入 + 一条控制栏；第三栏（对齐视图）在这一页没有对应的事实');
  assert.deepEqual(Object.keys(Z_SPEC[Z_PANEL].sides), Z_SIDE_NAMES);
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    assert.deepEqual(cfg.nodes ?? ['没有声明'], ['out', 'status', 'tree', 'copy'].filter((f) => (cfg.nodes || ['out', 'status', 'tree', 'copy']).includes(f)),
      `${side} 栏的节点族必须自己声明（收录面那颗牙按这一格拆）`);
    assert.deepEqual(cfg.nodes, [...new Set(cfg.nodes)], `${side} 栏的节点族里有重复`);
    for (const c of cfg.controls) {
      assert.equal(Object.keys(Z_TAGS).includes(c.type), true, `${side}/${c.id} 的 type ${c.type} 在词汇表外`);
      if (side === 'a' || side === 'b') {
        assert.equal(c.id.startsWith(`${side}-`), true,
          `${c.id} 没把栏位编进 id：门禁⑤ 的控件 id 公式是 {p}-in-{面板}-{控件}，没有栏位这一维（§0.6 记的偏差）`);
      }
      if (c.type === 'select') assert.ok(Array.isArray(c.options) && c.options.length > 0, `${c.id} 是下拉却没有取值白名单`);
      if (c.gutter !== undefined) assert.equal(c.gutter, false, 'gutter 只有"关掉"这一档：这一页的 area 不带行号槽');
    }
  }
  assert.deepEqual(Z_SPEC[Z_PANEL].sides[Z_BAR].switch.by, 'mode');
  assert.deepEqual(Z_SPEC[Z_PANEL].sides[Z_BAR].switch.targets.map((t) => t.key), ['text', 'json']);
  for (const tg of Z_SPEC[Z_PANEL].sides[Z_BAR].switch.targets) {
    assert.deepEqual(tg.when, [...new Set(tg.when)].filter((w) => Z_SPEC[Z_PANEL].sides[Z_BAR].controls.find((c) => c.id === 'mode').options.includes(w)),
      `显隐段 ${tg.key} 的档位里有 mode 认不得的词（静默永远隐藏）`);
  }
  assert.equal(Z_ACTIONS.length, 14, 'yml 的 actions 与 tools.html 的徽章数的是这一个数');
  assert.deepEqual([...new Set(Z_ACTIONS.map((a) => a.key))].length, 14, '动作 key 重复 = 同一枚按钮接两根线');
  for (const a of Z_ACTIONS) {
    assert.equal(typeof a.label, 'string');
    assert.ok(a.label.trim().length > 0, `${a.key} 的 label 是空的：门禁⑤ 比的是按钮文案与这一格同字`);
    assert.ok(['run', 'fold', 'goto', 'file', 'copy'].includes(a.group), `${a.key} 的 group ${a.group} 不在那五族里`);
  }
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'fold').map((a) => a.key), ['expand', 'fold', 'diffOnly'],
    '三枚快捷键都写回同一枚 context 下拉（单一口径），族名就是这件事的登记处');
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'goto').map((a) => a.key), ['firstDiff', 'prevDiff', 'nextDiff']);
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'file').map((a) => a.key), ['fileA', 'fileB']);
  const v = zCreateWb({ Tk: { view: W_VIEW }, prefix: Z_P });
  assert.deepEqual(Object.keys(v.view).sort(), ['renderFoldBar', 'renderInline', 'renderJsonTable', 'renderNotice', 'renderSide', 'renderStats', 'renderVerdict'],
    '装配层用的还是 Z2 那七件：多一件就是第二条渲染路径，少一件是有一格没人画');
  assert.deepEqual(Object.keys(v).sort(), ['mount', 'state', 'view'],
    '对外只这三格：`mount` 接线、`state` 是给本节的观察口、`view` 是那七件生成器——多一格就是第二条能从页面上叫到的路');
  assert.equal(typeof v.state().computes, 'number', '没有这两个计数器，"挂载期不计算"这件事在页面上根本读不出来');
});

// 装配层那六条红线各自的落点：Z18 挂载与输入、Z19 一次画全与导出同字、Z20 布局两档共一行流、
// Z21 折叠四档与三枚快捷键、Z22 跳转的块换算、Z23 整理三枚、Z24 归一化的同现同灭、Z25 JSON 档那一表、
// Z26 两类失败分两条路、Z27 文件三件、Z28 换前缀自证。
test('Z18 挂载与输入两条路都不算一次比对：读数只随防抖落地那一次', () => {
  const m = zMount();
  assert.equal(m.page.out().includes(`${Z_P}-row`), false, '挂载就把结果区画成行块 = 挂载期算了一遍（红线 4）');
  assert.deepEqual(m.guarded, [], '挂载期一次 runGuarded 都不该有：接线不是操作');
  assert.equal(m.wb.state().computes, 0, 'computes 是「挂载期不计算」唯一的量具：页面读不出这件事，判据读得出');
  assert.equal(m.wb.state().gateReads, 1, '挂载刷一次闸门读数：那一行「N 行 · KB」是这一页第一眼要给的东西');
  assert.match(String(m.page.read('a')), /0 行/);
  assert.match(String(m.page.read('b')), /0 行/);
  assert.equal(m.timers.length, 0, '挂载不排防抖：那一发延时是留给输入的');
  for (let k = 0; k < 20; k += 1) {
    m.page.set('a-text', `line-${k}`);
    m.page.input('a-text');
  }
  assert.equal(m.guarded.length, 0, 'input 那一发只排防抖、不进边界：进了就是二十次操作，而页面上什么也没算');
  assert.equal(m.wb.state().computes, 0, '二十次输入一次比对都不该有：比对只在按那一枚按钮时发生');
  assert.equal(m.page.out().includes(`${Z_P}-row`), false);
  m.flush();
  assert.equal(m.wb.state().gateReads, 2, '二十发延时只有最后那一发真的读数（防抖的牙就长在这两格里）');
});

test('Z19 一次对比画全：结论、读数、两栏行块、代价说明，而复制与下载读的是同一份 out', async () => {
  const m = zMount({ seed: { 'a-text': 'alpha\nbeta\ngamma', 'b-text': 'alpha\nBETA\ngamma', 'a-name': 'left.txt', 'b-name': 'right.txt' } });
  assert.equal(m.page.btnDisabled('copyDiff'), true, '还没有结果时那两枚该是灰的：按下去说一句「还没有」，不如让它按不动');
  assert.equal(m.page.btnDisabled('download'), true);
  m.page.click('compare');
  const out = m.page.out();
  assert.equal(m.wb.state().computes, 1);
  for (const cls of [`${Z_P}-verdict`, `${Z_P}-stats`, `${Z_P}-row `, `${Z_P}-col--a`, `${Z_P}-col--b`, `${Z_P}-notes`]) {
    assert.ok(out.includes(cls), `结果区少了 ${cls.trim()}：${out.slice(0, 120)}…`);
  }
  assert.equal(m.page.btnDisabled('copyDiff'), false, '比完了还灰着，就是「这一页没有导出」');
  const st = m.wb.state();
  assert.match(st.out, /^--- left\.txt\n\+\+\+ right\.txt\n@@ -1,3 \+1,3 @@\n/);
  m.page.click('copyDiff');
  await zSettle();
  assert.deepEqual(m.copied, [st.out], '复制的是那一份 unified 文本，不是第二次拼串：两处口径迟早会漂');
  m.page.click('download');
  assert.equal(m.dl.blobs.length, 1);
  assert.equal(m.dl.blobs[0].parts[0], st.out, '下载那一份与复制那一份必须逐字符同字');
  assert.equal(m.dl.blobs[0].options.type, 'text/plain;charset=utf-8');
  assert.equal(m.page.madeOf('a').length, 1, '整页只造那一枚 <a>：多一枚就是第二条往 DOM 里塞东西的路');
  assert.equal(m.page.madeOf('a')[0].download, 'changes.diff');
  assert.equal(m.dl.urls.made.length, 1);
  assert.equal(m.dl.urls.revoked.length, 1, '对象 URL 要在 finally 里收回：被拦住的下载不该往内存里挂一条永久 URL');
  m.page.clickCopy('a');
  await zSettle();
  assert.equal(m.copied[1], 'alpha\nbeta\ngamma', '栏内复制读的是那一侧的输入，不是结果区那一份');
  assert.equal(m.wb.state().computes, 1, '复制与下载都不重算：它们只读已经算完的那一格');
});

test('Z20 布局两档读同一份行流：并排两栏各一份，行内把 change 摊成两行', () => {
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  const hunks = dHunks(dLines(Z_A40, Z_B40, {}), 3);
  const rowsTotal = hunks.reduce((acc, h) => acc + h.rows.length, 0);
  const changes = hunks.reduce((acc, h) => acc + h.rows.filter((r) => r.kind === 'change').length, 0);
  assert.ok(hunks.length >= 1 && changes >= 1, '夹具自己先要成立：这份输入得有可拆的 change 行');
  m.page.click('compare');
  const side = m.page.out();
  assert.equal(wCount(side, `${Z_P}-row `), rowsTotal * 2, '并排档两栏各读同一份行流：行数必须正好翻倍');
  assert.equal(wCount(side, `${Z_P}-col--a`), hunks.length);
  assert.equal(wCount(side, `${Z_P}-col--b`), hunks.length);
  assert.equal(wCount(side, `${Z_P}-lines`), 0);
  m.page.set('layout', 'inline');
  m.page.change('layout');
  const inline = m.page.out();
  assert.equal(m.wb.state().computes, 1, '切布局不重算：它换的是看法，不是算法');
  assert.equal(wCount(inline, `${Z_P}-cols`), 0, '行内档不许还留着两栏那个壳');
  assert.equal(wCount(inline, `${Z_P}-lines`), hunks.length);
  assert.equal(wCount(inline, `${Z_P}-row `), rowsTotal + changes, '行内档把每个 change 摊成两行：A 那半读被删的高亮，B 那半读新增的高亮');
  assert.equal(wCount(inline, `${Z_P}-row--change`), changes * 2, '摊出来的两行都还是 change 档：着色由半边的片段决定，不由行档决定');
  m.page.set('layout', 'side');
  m.page.change('layout');
  assert.equal(m.page.out(), side, '切回来要逐字符同一份：两档共用行流，不是各拼一遍');
});

test('Z21 折叠四档真的改行集，三枚快捷键写回同一枚下拉', () => {
  const CTX = { diff: 0, 3: 3, 5: 5, all: Infinity };
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  m.page.click('compare');
  const expect = (sel) => {
    const list = dHunks(dLines(Z_A40, Z_B40, {}), CTX[sel]);
    const last = list[list.length - 1] || { tailSkipped: 0 };
    return {
      rows: list.reduce((acc, h) => acc + h.rows.length, 0),
      bars: list.filter((h) => h.skipped > 0).length + (last.tailSkipped > 0 ? 1 : 0),
    };
  };
  const check = (key, sel) => {
    m.page.click(key);
    assert.equal(m.page.val('context'), sel, `${key} 没写回那枚下拉：状态就有两份口径了（红线 6）`);
    const want = expect(sel);
    const out = m.page.out();
    assert.equal(wCount(out, `${Z_P}-row `), want.rows * 2, `${sel} 档的行集不对`);
    assert.equal(wCount(out, `${Z_P}-fold--`), want.bars, `${sel} 档的折叠条数不对（期望 ${want.bars}）`);
    assert.equal(m.wb.state().computes, 1, '换折叠档只换视图：行级那份 result 与折叠无关');
  };
  check('fold', '3');
  assert.ok(expect('3').rows < 40, '夹具先要成立：默认档必须真的把中间那段收起来');
  check('diffOnly', 'diff');
  assert.ok(expect('diff').rows < expect('3').rows, '只看差异要比上下文三行更窄，否则这一档没有意义');
  assert.ok(expect('diff').bars > 0, '只看差异那一档总要留下折叠条：两份四十行中间隔着三十来行呢');
  check('expand', 'all');
  assert.equal(expect('all').bars, 0, '全部展开之后不该有一条折叠条');
  assert.equal(expect('all').rows, 40, '展开之后那四十行要一行不少');
  const before = m.page.out();
  m.page.set('context', '9');
  m.page.change('context');
  assert.equal(m.threw.length, 1, 'spec 之外的档位是漂移，不是用户写坏的格子：要原样上抛给边界');
  assert.match(String(m.threw[0][1]), /只认/);
  assert.equal(m.page.out(), before, '抛出去之前不许画：上一格的结果不能因为档位漂了就整块不见');
});

test('Z22 跳转三枚：scrollTop 按块换算、两端钳住、状态行报第几处', () => {
  const m = zMount({ rowHeight: 40, seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  const list = dHunks(dLines(Z_A40, Z_B40, {}), 3);
  assert.equal(list.length, 2, `夹具先要成立：这份输入要折叠出两块，实测 ${list.length}`);
  m.page.click('compare');
  assert.equal(m.page.scrollTop(), 0);
  const u1 = list[0].skipped > 0 ? 1 : 0;
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u1 * 40);
  assert.equal(m.page.line(), `第 1 / ${list.length} 处差异`);
  const u2 = list[0].rows.length + (list[0].skipped > 0 ? 1 : 0) + (list[1].skipped > 0 ? 1 : 0);
  assert.ok(u2 > u1, '第二块要在第一块之下，否则这一判量不到「换算」这件事');
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u2 * 40, '那一块的顶上：前面所有块占的视觉行，加上它自己那条折叠条');
  assert.equal(m.page.line(), `第 2 / ${list.length} 处差异`);
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u2 * 40, '最后一块之后再按不许滚出页尾：钳位就是这一格的意思');
  m.page.click('prevDiff');
  assert.equal(m.page.scrollTop(), u1 * 40);
  m.page.click('prevDiff');
  m.page.click('prevDiff');
  assert.equal(m.page.line(), '第 1 / 2 处差异', '第一块之前同样钳住');
  m.page.click('firstDiff');
  assert.equal(m.page.line(), '第 1 / 2 处差异');
  const same = zMount({ seed: { 'a-text': 'one\ntwo', 'b-text': 'one\ntwo' } });
  same.page.click('compare');
  same.page.click('nextDiff');
  assert.equal(same.threw.length, 0, '没有差异块是用户那一档事实，不是骨架漂移');
  assert.equal(same.guarded.length, 2, '一次比对 + 一次跳转：都过了边界，都没有抛');
  assert.match(String(same.page.line()), /没有差异块/);
});

test('Z23 整理三枚：交换连文件名一起换、恢复默认档不碰输入、清空回空态并置灰', () => {
  const m = zMount({ seed: { 'a-text': 'one\ntwo', 'b-text': 'one\nTWO', 'a-name': 'left.txt', 'b-name': 'right.txt' } });
  m.page.click('swap');
  assert.equal(m.page.area('a'), 'one\nTWO', '交换只换正文不换文件名，导出的那一份头就指错了边');
  assert.equal(m.page.area('b'), 'one\ntwo');
  assert.equal(m.page.name('a'), 'right.txt');
  assert.equal(m.page.name('b'), 'left.txt');
  assert.match(m.wb.state().out, /^--- right\.txt\n\+\+\+ left\.txt/);
  assert.equal(m.wb.state().computes, 1, '交换自带一次对比：用户按的是「换个方向看」，不是「换个方向空着」');
  m.page.set('context', '5');
  m.page.change('context');
  m.page.check('ws', true);
  m.page.change('ws');
  m.page.click('reset');
  assert.equal(m.page.val('context'), '3', '恢复默认档管的是三枚下拉与两枚勾选');
  assert.equal(m.page.ctl('ws').checked, false);
  assert.equal(m.page.area('a'), 'one\nTWO', '这一枚不该把输入也清了：那是「清空输入」的活儿');
  assert.equal(m.wb.state().mode, 'text');
  m.page.click('clear');
  assert.equal(m.page.area('a'), '');
  assert.equal(m.page.name('a'), '');
  assert.equal(m.page.ctl('a-file').value, '', '清空要连文件那一格一起清：留着上一次的选择，下一次「读入」读的是旧文件');
  // 真浏览器里 `input.files` 是 FileList 的**只读访问器**，给它赋 `[]` 当场
  // `TypeError: Failed to set the 'files' property`——而假 DOM 量不到这件事（那里的 `files`
  // 是个普通属性，赋什么都行）。清空那一步会停在第一栏、第二栏没清，页面上是一句坏消息。
  // 这一格钉的是源码里不许再出现那一形写法：清文件只有 `value = ''` 那一条正路。
  assert.equal(/\.files\s*=[^=]/.test(wCode(Z_ASSEMBLY)), false,
    '装配层里出现了 `.files = …` 的赋值：那一格在真页面上读不回来');
  assert.equal(m.page.disabled(`${Z_P}-in-workbench-a-file`), false, '清空输入不许顺手把文件那一格也禁用——那是「这台浏览器不给读」那一档');
  assert.equal(m.page.btnDisabled('copyDiff'), true, '清空之后导出要重新灰回去');
  assert.equal(m.page.out().includes(`${Z_P}-row`), false, '清空要回到空态那一句话，而不是留着上一份结果');
});

test('Z24 归一化两枚：stats.ignored 与那句说明同现同灭', () => {
  const m = zMount({ seed: { 'a-text': 'hello world\nkeep', 'b-text': 'HELLO   WORLD\nkeep' } });
  m.page.click('compare');
  assert.equal(m.wb.state().produced.stats.ignored, 0, '没勾之前那一处是实打实的差异');
  assert.equal(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), false, '没发生的事不许写在页面上');
  m.page.check('ws', true);
  m.page.check('case', true);
  m.page.change('ws');
  assert.equal(m.wb.state().computes, 2, '勾一档必须重算一遍：拿旧结论配新档位，页面上那一句结论就是假的');
  assert.ok(m.wb.state().produced.stats.ignored > 0, '归一化抹平的那几行要进 stats.ignored');
  assert.match(m.page.out(), /归一化之后两份文本相同/);
  assert.ok(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), '结论被归一化过就必须明说：这一条是「同现」');
  m.page.check('ws', false);
  m.page.change('ws');
  assert.equal(m.wb.state().produced.stats.ignored > 0, false, '取消之后没抹平任何东西，那一格要回到 0');
  assert.equal(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), false, '这一条是「同灭」：说明不许留在页上');
});

test('Z25 JSON 档：三档结论、六列变更表与那六句代价说明同屏', () => {
  const m = zMount({ seed: { 'a-text': '{"a":1,"b":[1,2]}', 'b-text': '{"b":[1,3],"a":1,"c":true}' } });
  m.page.click('compare');
  assert.equal(m.page.out().includes(`${Z_P}-json`), false, '文本档不该有那张表');
  m.page.set('mode', 'json');
  m.page.change('mode');
  assert.equal(m.wb.state().computes, 2, '换口径要重算：两张账表数的是不同的事');
  const out = m.page.out();
  assert.ok(out.includes(`${Z_P}-verdict--diff`), `结论档不对：${out.slice(0, 160)}`);
  assert.ok(out.includes(`${Z_P}-json__meta`));
  assert.ok(out.includes(`${Z_P}-json__row--add`), '新增那一格 c 要在表里');
  assert.equal(wCount(out, `${Z_P}-notes`), 1);
  for (const note of Object.values(Y_NOTES)) {
    assert.ok(out.includes(J_VIEW.esc(note)), `那六句少了一句「${note.slice(0, 12)}…」：表与代价说明同屏是 Y18 第二半的承诺`);
  }
  for (const k of ['expand', 'fold', 'diffOnly', 'firstDiff', 'prevDiff', 'nextDiff']) {
    assert.equal(m.page.btnDisabled(k), true, `JSON 档按格比对，${k} 没有意义，该置灰而不是按了报错`);
  }
  assert.equal(m.page.hidden('text'), true, '换到 JSON 档，文本档那一段说明要藏起来');
  assert.equal(m.page.hidden('json'), false, '而 JSON 档那一段要露出来：显隐段与 mode 是同一件事的两面');
  const order = zMount({ seed: { 'a-text': '{"a":1,"b":2}', 'b-text': '{"b":2,"a":1}', mode: 'json' } });
  order.page.click('compare');
  assert.match(order.page.out(), /按 JSON 值判为相同，但键的书写次序不同/);
  assert.equal(order.page.out().includes('逐字符相同'), false, '键序不同那一档写成「逐字符相同」，就是把两件不同的事说成一件');
  const identical = zMount({ seed: { 'a-text': '{"a":1}', 'b-text': '{"a":1}', mode: 'json' } });
  identical.page.click('compare');
  assert.match(identical.page.out(), /键的书写次序也一致/);
});

test('Z26 两类失败分两条路：用户的空格子进状态行，骨架的漂移原样上抛，上一格都不擦', () => {
  const m = zMount();
  const before = m.page.out();
  m.page.click('compare');
  assert.equal(m.guarded.length, 1, '一次按钮一次边界：那份计数是页面上那行红字的账本');
  assert.equal(m.threw.length, 0, '两边都空是用户那一格的事实，不该记成「这一页坏了」');
  assert.match(String(m.page.line()), /两边都还空着/);
  assert.equal(m.page.out(), before, '坏消息走状态行那一格，结果区那一份原样留着');
  m.page.set('b-text', 'x');
  m.page.click('compare');
  assert.match(String(m.page.line()), /A 侧还是空的/);
  assert.equal(m.wb.state().computes, 0, '前两发都没算成：computes 只记真的算完的那一次');
  m.page.set('a-text', 'y');
  m.page.click('compare');
  assert.equal(m.wb.state().computes, 1);
  const painted = m.page.out();
  assert.notEqual(painted, before);
  m.page.set('a-text', Array.from({ length: X_LINES + 1 }, () => 'x').join('\n'));
  m.page.click('compare');
  assert.equal(m.threw.length, 0, '超闸门也是用户那一档，不是漂移');
  assert.match(String(m.page.line()), /超出闸门/);
  assert.match(String(m.page.line()), /上限 200,000 行/, '要把上限说在句子里：只说「超了」，用户读不出超到哪儿');
  assert.equal(m.page.out(), painted, '超闸门那一份不能把上一格的结果擦掉');
  const bad = zMount({ seed: { 'a-text': '{"a":}', 'b-text': '{"a":1}', mode: 'json' } });
  const badBefore = bad.page.out();
  bad.page.click('compare');
  assert.equal(bad.threw.length, 0);
  assert.match(String(bad.page.line()), /比不了/);
  assert.match(String(bad.page.line()), /第 1 行/);
  assert.equal(bad.page.out(), badBefore, '坏 JSON 那一发同样是擦不得的那一条');
  const drift = zMount({ seed: { 'a-text': 'p\nq', 'b-text': 'p\nr' }, drop: [`${Z_P}-in-workbench-b-name`] });
  assert.deepEqual(drift.report.missing, [`${Z_P}-in-workbench-b-name`], '缺格要在 mount 的清单里报出来，但不许拦启动');
  const kept = drift.page.out();
  drift.page.click('compare');
  assert.equal(drift.threw.length, 1, 'spec 与骨架漂了要原样上抛：这一类是坏消息，不是用户的空格子');
  assert.match(String(drift.threw[0][1]), /骨架/);
  assert.equal(drift.page.out(), kept, '抛在画之前：这一条与上面那三条说的是同一句红线的第四种写法');
});

test('Z27 文件三件：拒在 read 之前、非 UTF-8 明说、拖放同一条路、缺手就置灰', async () => {
  const m = zMount({ seed: { 'b-text': 'beta' } });
  m.page.pickFile('a', zFile('old.txt', 'alpha\nbeta'));
  await zSettle();
  assert.deepEqual(m.reads, ['old.txt']);
  assert.equal(m.page.area('a'), 'alpha\nbeta');
  assert.equal(m.page.name('a'), 'old.txt', '文件名不跟着上屏，导出的那一份头就永远是个占位符');
  assert.match(String(m.page.read('a')), /已读入/);
  m.page.click('compare');
  assert.match(m.wb.state().out, /^--- old\.txt/);
  m.page.pickFile('a', zFile('huge.txt', 'x', X_BYTES + 4096));
  await zSettle();
  assert.equal(m.reads.length, 1, '超限那一份必须在读之前就拒掉：五 MiB 不该先整份进内存再说「不行」');
  assert.match(String(m.page.read('a')), /超出闸门/);
  const nope = zMount({ seed: { 'b-text': 'beta' }, decode: () => ({ ok: false, text: '' }) });
  nope.page.pickFile('a', zFile('gbk.txt', '中文'));
  await zSettle();
  assert.match(String(nope.page.read('a')), /不是 UTF-8/);
  assert.equal(nope.page.area('a'), '', '读不成就不许把半份内容留在框里');
  // 两枚"读得成但根本不是文本"的样本：NUL 与替换字符。写成 fromCharCode 而不是字面转义，
  // 是因为测试文件里躺一枚真的 NUL 字节会让不少工具（与本节那三把剥源码的尺）先把它吃掉。
  const NUL = String.fromCharCode(0);
  const FFFD = String.fromCharCode(0xFFFD);
  const binaries = [['nul.txt', `a${NUL}b`], ['bad.txt', `a${FFFD}b`]];
  for (const pair of binaries) {
    const bin = zMount({ seed: { 'b-text': 'beta' } });
    bin.page.pickFile('a', zFile(pair[0], pair[1]));
    await zSettle();
    assert.match(String(bin.page.read('a')), /不是 UTF-8/, `${pair[0]}：{ok:true} 而内容是二进制，那一档也要说出来`);
  }
  const d = zMount({ seed: { 'b-text': 'beta' } });
  d.page.drop('a', [zFile('dropped.txt', 'q\nr')]);
  await zSettle();
  assert.deepEqual(d.reads, ['dropped.txt'], '拖放与选文件必须是同一条路：两条路迟早只修好一条');
  assert.equal(d.page.name('a'), 'dropped.txt');
  // 「选 A / B 侧文件」那两枚只**转发**、不自己读：真页面上打开选择器的那只手是旁边那枚原生
  // input，读的那一发归 `change`。假 DOM 的 `el.click()` 会往 `clicked` 里留痕，所以这一判
  // 量得到"按了哪一枚"；而 `reads` 那一本账钉的是"转发不等于读"。
  const fwd = zMount({ seed: { 'b-text': 'beta' } });
  fwd.page.click('fileB');
  assert.deepEqual(fwd.page.clicked, [`${Z_P}-in-workbench-b-file`],
    '那一枚按钮的文案是「选 B 侧文件」，它必须去开那台选择器，而不是复读自己那一格');
  assert.equal(fwd.reads.length, 0, '打开选择器不算读文件：readFile 一次都不许发生');
  assert.equal(String(fwd.page.read('b')).includes('没有读到文件'), false,
    '第一次按就当街报错，等于把每一次首发都变成一次坏消息');
  const none = zMount({ readFile: null });
  assert.equal(none.page.btnDisabled('fileA'), true, '这台浏览器没有那两只读手，按钮就该灰着');
  assert.equal(none.page.btnDisabled('fileB'), true);
  assert.equal(none.page.disabled(`${Z_P}-in-workbench-a-file`), true, '输入框也要灰：拖放那条路同样读不了');
  none.page.click('fileA');
  assert.equal(none.reads.length, 0);
});

test('Z28 换前缀自证：整页地址跟着 prefix 走，而产物里一处 df- 都不剩', () => {
  const Q = 'zx';
  const m = zMount({ prefix: Q, seed: { 'a-text': 'p\nq\nr', 'b-text': 'p\nx\nr' } });
  assert.deepEqual(m.report.missing, [], '前缀换了骨架就得整套跟着换：还按 df 找就一格也找不到');
  m.page.click('compare');
  const out = m.page.out();
  assert.equal(out.includes('df-'), false, '结果区里剩一处 df-，换前缀这件事就只做了一半');
  for (const cls of [`${Q}-verdict`, `${Q}-stats`, `${Q}-row `, `${Q}-col--a`, `${Q}-notes`]) {
    assert.ok(out.includes(cls), `换档之后少了 ${cls}`);
  }
  assert.ok(out.includes(`data-${Q}-i=`) && out.includes(`data-${Q}-ln=`), '属性名也带前缀：只换类名不换属性，样式与脚本就分家了');
  assert.notEqual(m.page.doc.getElementById(`${Q}-status-workbench-bar`), null);
  assert.equal(m.page.doc.getElementById('df-status-workbench-bar'), null);
  assert.match(String(m.page.line()), /比完了/);
  assert.equal(wCount(out, `${Q}-row `), 6, '两栏各三份行块：这一格数的就是「整页跟着前缀走」');
  assert.equal(wCount(out, `${Q}-fold--`), 0, '三行两份、上下文三行：一块到底，不该有折叠条');
});

test('Z29 折叠条真的能点开：那一发就是「全部展开」，不重算，而且只认带 skip 的那一枚', () => {
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  m.page.click('compare');
  m.page.click('diffOnly');
  const s0 = m.wb.state();
  const g0 = m.guarded.length;
  assert.ok(s0.hunks.length > 1, '前提：只看差异那一档确实折出了不止一块');
  assert.ok(wCount(m.page.out(), `${Z_P}-fold--`) > 0, '前提：页面上确实画出了折叠条');
  // 先试一处"不是折叠条"的落点：行块只带 `data-df-ln`，结果区里除了那枚按钮什么都不该动档。
  // 这一判是防"把容器上的 click 当成整块的重画信号"——那一形写法在这一格里同样能过"能展开"。
  m.page.clickRow();
  assert.equal(m.page.val('context'), 'diff', '点行块不许动上下文那一档：结果区里只有折叠条是按钮');
  assert.equal(m.guarded.length, g0, '不该发生的一发不许记进 guarded 的账：那一本数的是真做过的动作');
  m.page.clickFold(24);
  assert.equal(m.page.val('context'), 'all', '点开折叠条要写回那枚下拉：状态有第二份口径就是红线 6 破');
  assert.equal(wCount(m.page.out(), `${Z_P}-fold--`), 0, '展开之后一条折叠条都不该留');
  const all = dHunks(dLines(Z_A40, Z_B40, {}), Infinity);
  assert.equal(wCount(m.page.out(), `${Z_P}-row `), all.reduce((acc, h) => acc + h.rows.length, 0) * 2,
    '两栏各四十行：折叠只是阅读形状，展开之后行数一行不会少');
  assert.equal(m.wb.state().computes, s0.computes, '点开折叠条不是重算：行级那份 result 与折叠档无关');
  assert.match(String(m.page.line()), /已展开全部/, '状态行要说清"展开的是整页"，不是让读者猜那一发做了什么');
  assert.deepEqual(m.threw, [], '这一发要是抛了，用户得到的是一句坏消息而不是一份展开的结果');
  assert.equal(m.guarded[m.guarded.length - 1], `${Z_P}-out-workbench-bar`,
    '这一发发生在结果区，记的账就得是那只容器的地址，不能冒充成按钮按过');
  // 换前缀那一刀：装配层读的属性名从 `env.prefix` 派生，所以 `zx` 页面上的旧地址 `data-df-skip`
  // 必须**不**触发（触发了就说明有一处把这一页的地址写死在行为里）。
  const q = zMount({ prefix: 'zx', seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  q.page.click('compare');
  const qBars = wCount(q.page.out(), 'zx-fold--');
  assert.ok(qBars > 0, '前提：换前缀那一页同样折出了折叠条（不然下面两条判的是空集）');
  q.page.clickFold(6, 'data-df-skip');
  assert.equal(q.page.val('context'), '', '旧前缀的地址不该被认：认了就是本层手打过那一串（与 Z16 同一件事）');
  assert.equal(wCount(q.page.out(), 'zx-fold--'), qBars, '不认的那一发不许留下任何痕迹：折叠条要一条不少地留着');
  q.page.clickFold(6);
  assert.equal(q.page.val('context'), 'all', '而本页自己的属性名要认得：整页跟着前缀走');
  assert.equal(wCount(q.page.out(), 'zx-fold--'), 0, '认到之后那一发要真的展开，不是只写下拉不重画');
});
