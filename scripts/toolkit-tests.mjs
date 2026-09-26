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
 * 用例分布（后续每段往这个文件里加，不另起测试入口）：
 *   §A 区划码表 —— 生成物结构与六档回落（§2.2 / §5.4）；A7–A11 另测生成侧的输入闸门
 *                （`assertShape` 那四道在内）与读侧载入自检有没有牙，A12 测六个读入口的入参口径是否还是同一套
 *   §B 身份证   —— 校验位、三态、解码、生成、与站内旧库对拍（§2.2 / §5.1）
 *   §C 统一代码 —— 31 字符集、两套权重、双校验位自洽（§2.2 / §5.1）；C9 另测入参闸门
 *                与批量入口的空文本那一格是否和 §B 同档（两个模块逐格对照，不许分叉）
 *   §D 面板框架 —— ARIA、roving tabindex、hash、方向键（§6.3）
 *   §E 后续段追加：银行卡 / 手机号 / 摘要 / JSON / 互转 / TS 生成
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
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { execFileSync, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
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
