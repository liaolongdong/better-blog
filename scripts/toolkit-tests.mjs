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
//  文件头就有（只有 H7 读源文本用它）。view.js 这 14 个名字全是新面孔，六个 `h*` 前缀的辅助
//  （`hHead` / `hBody` / `hLabels` / `hTagAudit` / `hText` / `hBanks`）与 §G 的 `dupes` / `gNames` 不重名。）
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
    Tk: { view: J_VIEW },
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

test('J12 toolkitCore 只把框架层那三只挂成 `window.Tk`，业务模块不下沉', async () => {
  const mod = { ns: null };
  globalThis.window = {};
  try {
    mod.ns = await import('../dev/js/toolkitCore.js?j12');
    const tk = globalThis.window.Tk;
    assert.deepEqual(Object.keys(tk).sort(), ['createPanelDom', 'createPanelWorkspace', 'view'],
      '口径 1：只挂这三个名字，不顺手暴露别的');
    assert.equal(tk.createPanelWorkspace, createPanelWorkspace, '挂的必须是 §D 判过的那一只');
    assert.equal(tk.createPanelDom, createPanelDom, '挂的必须是 §I 判过的那一只');
    assert.equal(tk.view.batchBlock, J_VIEW.batchBlock, 'view 必须是 §H 判过的那一份');
    assert.equal(typeof tk.view.parseBlock, 'function');
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

  // ③ 三条源码红线：这一层的 HTML 出口只有一处，找节点只按派生 id，跨页共用的三本不许 import
  const src = read('dev/js/tools/workbench.js');
  assert.equal(jCount(src, '.innerHTML ='), 1, 'innerHTML 只许出现在 paint() 一处');
  assert.equal(src.includes('querySelector('), false, '控件一律按派生 id 找：querySelector 会绕过前缀与 spec 这套账');
  for (const shared of ['./panel.js', './panel-dom.js', './view.js']) {
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
  const banned = [['import', /^\s*import[\s{*]/], ['export from', /export\s+\{[^}]*\}\s+from/],
    ['require(', /\brequire\s*\(/], ['document', /\bdocument\b/], ['window', /\bwindow\b/],
    ['localStorage', /\blocalStorage\b/], ['navigator', /\bnavigator\b/], ['fetch(', /\bfetch\s*\(/],
    ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /\bTextEncoder\b/], ['TextDecoder', /\bTextDecoder\b/],
    ['Date.now', /Date\.now/], ['new Date(', /new Date\(/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['crypto', /\bcrypto\b/],
    ['unescape', /\bunescape\s*\(/], ['eval', /\beval\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `codec.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 21, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
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
