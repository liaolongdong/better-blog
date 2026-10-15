#!/usr/bin/env node
/**
 * 无人值守博客文章的确定性验收门禁（配套 `_drafts/WRITING_PROTOCOL.md` v3.2）。
 *
 * 存在的原因：v1 的 40 项自检靠运行 agent 自报，实测 8 篇里 6 篇正文超上限两倍却报「达标」
 * （它统计的是汉字数，而页面读时算的是非空白字符）。这一版把**所有能确定性判定的条款**搬进脚本，
 * 只把「事实对不对」留给人和网络。
 *
 * 用法：
 *   node scripts/article-check.mjs _posts/2026-09-27-demo.md \
 *        --manifest _drafts/evidence/demo.md --job A
 *
 * 退出码：0 = 无 FAIL；1 = 至少一条 FAIL；2 = 用法或文件错误。
 * 篇幅口径：正文去掉 frontmatter 后的**非空白字符**（含标题行、图片行、表格），协议 §4.1。
 *
 * @file scripts/article-check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------- 配置 */

/**
 * v4：H2 不再是逐字锁死的角色词名单。每篇按选题自己定 3–8 节、自己起节名。
 * 四个必须被覆盖的语义角色由内容门分别守着，不靠节名：
 *   主张 → 结论块两行（§4.2）｜证据 → 真实截图 + manifest 反查（§5.2/§8.2.0）
 *   动作 → 结论块第二行「现在该做什么」（§4.2）｜边界 → `边界在场`（§5.5）
 * 节名本身由两道门咬：`H2 带具体物`（不可移植）与 `无跨篇复用行`（不与最近 5 篇逐字相同）。
 */
const BOUNDARY_MARKERS = ['没验到', '我没测', '没碰到', '没跑', '不知道谁', '没能复现', '没找到来源', '没来源', '没做实测'];

/** 自拟那半句里禁掉的形状：§7.1 那八个标题腔 + 疑问句收尾（谜题标题是 §7.5 要点名修的对象）。 */
const H2_CLAUSE_BAN = ['一场', '从 0 到 1', '全面解析', '深度剖析', '一文说清', '保姆级', '硬核', '终极指南'];

/** 具体物 = 数字、拉丁专名、引号里的原话、反引号里的命令。没有具体物的节名/标题可以移植到任何一篇。 */
const CONCRETE = /\d[\d.,]{1,}|[A-Za-z][A-Za-z0-9@\/._+-]{1,}|「[^」]+」|`[^`]+`/;

/** 数值上限，全部对应协议 §4.1 / §4.4 / §4.5。 */
const L = {
  charsTotal: 4500,
  charsFloor: 1500,
  /** 单节上限：绝对值与占比取小的那一个（v4 取消逐节预算表）。 */
  sectionMax: 1800,
  sectionRatio: 0.45,
  blockMin: 60,
  blockMax: 120,
  codeBlocks: 4,
  codeLines: 14,
  codeLineLen: 72,
  codeChars: 900,
  tables: 3,
  tableCols: 4,
  tableRows: 8,
  cellChars: 20,
  lists: 4,
  listItems: 6,
  itemChars: 60,
  /** §4.1 插图下限：v3.2 只卡上限（3 张），实测两篇新稿「封面 + 1 枚纯 AI 示意」也全绿。
   *  这一格与 `真实截图在场` 一起在 Task 8 落地成门——常量不配门就是写了个没人读的数。 */
  imagesMin: 3,
  images: 7,
  /** 段落 120→200、句子 60→100：09-10 手写稿按本脚本口径段均 116.0 字（16 段超 120）、
   *  句均 41.0 字（111 句里 24 句超 60，最长 250）——旧上限把最好的写法判红。 */
  paraChars: 200,
  paraShortMin: 1,
  sentChars: 100,
  firstSentChars: 40,
  bold: 6,
  hr: 2,
  quotes: 3,
  quoteLines: 4,
  preciseTotal: 20,
  precisePerSent: 3,
  secondTimestamps: 2,
  capacity: 4,
  lineOrHash: 4,
  title: [15, 35],
  frontHalfWidth: 20,
  titleCandidates: 5,
  shortTitle: 28,
  subtitle: 45,
  /** §2 v4：节数与节名形状。 */
  h2Min: 3,
  h2Max: 8,
  h2Len: [6, 30],
  h2ConcreteRatio: 0.67,
  /** §4.6 承接：断链容差；≥7 节放宽到 2。 */
  carryTol: 1,
  /** 跨篇复用行的最小 unit 长度与比对篇数。 */
  reuseMin: 8,
  historyPosts: 5,
  outlookRatio: 0.18,
  outlookChars: 700,
};

/** frontmatter 必须正好这 9 个键、按此顺序（协议 §8.1 / SP4 描述 ①——seo_description 是站点门要求的那一枚）。 */
const KEYS = ['layout', 'title', 'subtitle', 'seo_short_title', 'seo_description', 'date', 'categories', 'cover', 'tags'];

/** 一级黑名单里正则判不了的部分（带语境限定），只报 WARN（协议 §7.1）。 */
const JUDGMENT_WORDS = ['闭环', '心智', '颗粒度', '方法论', '对齐', '下沉', '落地', '赋能', '抓手', '打通', '串起来', '拉齐', '智能', '优雅', '降维打击', '跑通', '组合拳', '护城河'];

/** 一级黑名单硬命中（协议 §7.1 / §5.5 / §6 禁令词）。 */
const HARD_WORDS = [
  // 黑话 / 咨询腔
  '全链路',
  '一体化',
  '生态位',
  '深水区',
  '无人区',
  '卡位',
  '破局',
  '突围',
  '重塑',
  '跃迁',
  '加持',
  '引领',
  '领航',
  '深耕',
  '发力',
  '加码',
  '拉通',
  '全域',
  '纵深',
  '势能',
  '打法',
  '组合拳式',
  '体系化',
  '多维度',
  '深层次',
  // 空洞强调
  '强大',
  '灵活',
  '高效',
  '便捷',
  '无缝',
  '一站式',
  '全方位',
  '系统性',
  '丝滑',
  '极致',
  '硬核',
  '天花板',
  '炸裂',
  '封神',
  '遥遥领先',
  '断崖式',
  '碾压式',
  '海量',
  '爆发式',
  '极大地',
  '显著地',
  '有效地',
  '充分地',
  '深入地',
  '全面地',
  '大幅',
  '革命性',
  '颠覆性',
  '突破性',
  '开创性',
  '划时代',
  '里程碑',
  '非常克制',
  '非常清晰',
  '超出预期',
  // 历史拔高
  '标志着',
  '见证了',
  '新纪元',
  '新篇章',
  '载入史册',
  '重新定义了',
  '先行者之一',
  '新范式',
  // 清嗓 / 元话语
  '值得注意的是',
  '值得一提的是',
  '需要指出的是',
  '不难发现',
  '不难看出',
  '由此可见',
  '综上所述',
  '总而言之',
  '一言以蔽之',
  '进一步地',
  '从根本上说',
  '究其根本',
  '本质上而言',
  '为了更直观',
  '也有它的边界',
  '仍面临一些挑战',
  // 时代开场
  '在当今',
  '放眼全球',
  '纵观',
  '近年来',
  '当下最火',
  '最近很火',
  '大行其道的',
  '这么多年我一直在思考',
  '身处',
  // 营销导读
  '深入浅出',
  '干货满满',
  '保姆级',
  '一文读懂',
  '万字长文',
  '看完这篇就够了',
  '建议收藏',
  '不容错过',
  '值得拥有',
  '强烈推荐',
  '让我们一起',
  '我们一起来看',
  '接下来让我们',
  '下面就带大家',
  '在阅读本文前',
  '本文将带',
  '就是这个答案',
  // 确定性滥用
  '众所周知',
  '毋庸置疑',
  '不言而喻',
  '显而易见',
  '可想而知',
  '无疑将',
  '必将',
  '终将',
  '必然会',
  '势必',
  // 功能占位
  '扮演着',
  '发挥着',
  '承担着',
  '强有力的支持',
  '这意味着什么',
  // 模糊归因
  '业内普遍认为',
  '业内人士指出',
  '专家表示',
  '专家认为',
  '网友纷纷',
  '有人质疑',
  '或许有人会问',
  '你可能会想',
  '不少开发者',
  '许多团队已经',
  '社区也在积极',
  // 情绪回扣尾句
  '这也是为什么',
  '正因如此',
  '的魅力所在',
  '的价值所在',
  '不得不感叹',
  '叹为观止',
  '我才意识到',
  // 万金油批评
  '文档有待加强',
  '生态尚不完善',
  '学习曲线陡峭',
  '社区活跃度有待',
  '存在一定局限性',
  '很大的提升空间',
  '有待验证',
  '需要时间检验',
  '快速迭代中',
  'issue 响应速度很快',
  '非常活跃',
  // 空心展望
  '相信在不久的将来',
  '值得期待',
  '未来可期',
  '拭目以待',
  '前景广阔',
  '大有可为',
  '星辰大海',
  '生态将进一步完善',
  '性能将持续提升',
  '社区会越来越大',
  '应用场景会更广',
  '从尝鲜功能变成标配',
  '从尝鲜变成标配',
  '推动这个转变',
  '道阻且长',
];

/** 一级黑名单里的句式型判据（协议 §7.1 骨架 / §2.4 翻译腔）。 */
const HARD_PATTERNS = [
  [/不仅仅是[^。\n]{0,12}更是/, '负向排比：不仅仅是…更是'],
  [/一方面[^。\n]{0,20}另一方面/, '骨架：一方面…另一方面'],
  [/首先[^。\n]{0,25}其次/, '骨架：首先…其次'],
  // 「第一…第二」必须带停顿号，否则「第一行…第三行」这类真引用会被误杀
  [/第[一二三][点]?\s*[，、：][^。\n]{0,40}第[一二三][点]?\s*[，、：]/, '骨架：第一，…第二，'],
  [/够[^。\n]{1,6}、够[^。\n]{1,6}、够/, '骨架：够X、够Y、够Z'],
  [/从个人到(?:企业|团队)/, '虚假范围：从个人到企业'],
  [/随着.{0,14}的(?:不断)?(?:发展|提升|成熟)/, '时代背景句：随着…的不断发展'],
  [/对.{1,12}进行了/, '翻译腔：对…进行了'],
  [/实现了.{0,10}的支持/, '翻译腔：实现了对…的支持'],
  [/作为.{1,10}(?:而存在|的角色)/, '翻译腔：作为…而存在/的角色'],
  [/被(?:广泛|普遍|认为|采用)/, '翻译腔：被广泛/被认为'],
  [/在.{1,10}(?:方面|情况下|场景中)/, '翻译腔：在…方面'],
  [/对于.{1,12}而言/, '翻译腔：对于…而言'],
  [/成为.{0,8}(?:的利器|的首选|的标杆)/, '功能占位：成为…的利器/首选/标杆'],
  [/具有.{0,8}的特性/, '功能占位：具有…的特性'],
];

/** 二级黑名单配额（协议 §7.3）。 */
const QUOTA = [
  [/说白了/g, 2, '说白了'],
  [/其实/g, 3, '其实'],
  [/反正/g, 1, '反正'],
  [/(?:我个人觉得|我猜)/g, 2, '我个人觉得/我猜'],
  [/换句话说/g, 1, '换句话说'],
  [/与此同时/g, 1, '与此同时'],
  [/——/g, 3, '——'],
  [/「/g, 2, '「」'],
  [/那么，[^？]{0,20}？/g, 1, '那么，…？'],
];

/* ---------------------------------------------------------------- 工具 */

/** 非空白字符数——全文唯一的长度口径。 */
const c = (s) => (s ? s.replace(/\s/g, '').length : 0);

const fails = [];
const warns = [];
const passes = [];

/** 记一条 PASS；cond 为假时记 FAIL。`fmt` 生成超标读数。 */
function gate(cond, name, detail, failDetail) {
  if (cond) passes.push(`${name}  ${detail}`);
  else fails.push(`${name}  ${failDetail ?? detail}`);
}

/** 把 fenced code block 换成等行空行，保持后续按行切片的位置感。 */
const hideCode = (s) => s.replace(/^```[\s\S]*?^```/gm, (m) => '\n'.repeat(m.split('\n').length - 1) + '\n');

/* ---------------------------------------------------------------- 入参 */

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (!file || !fs.existsSync(file)) {
  process.stderr.write(`用法：node scripts/article-check.mjs <正文.md> [--manifest <evidence.md>] [--job A|B]\n`);
  process.exit(2);
}
const manifestPath = flag('manifest');
const raw = fs.readFileSync(file, 'utf8');

/* ------------------------------------------------------------ 解析正文 */

const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
if (!fmMatch) {
  process.stderr.write('FAIL  frontmatter  缺 YAML 头（--- 包裹）\n');
  process.exit(1);
}
const fmText = fmMatch[1];
const body = raw.slice(fmMatch[0].length);
const fm = {};
for (const line of fmText.split('\n')) {
  const m = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
  if (m) fm[m[1]] = m[2].trim();
}
const fmKeys = [...fmText.matchAll(/^([A-Za-z_][\w]*)\s*:/gm)].map((m) => m[1]);

/* 任务归属：显式 --job 优先；没传就用「正文是否链向某个 GitHub 仓库」判，不再 exit 1。 */
const h2All = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
let job = (flag('job') || '').toUpperCase();
if (job !== 'A' && job !== 'B') job = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(body) ? 'A' : 'B';
if (!flag('job')) warns.push(`未传 --job，按正文 GitHub 链接推断为 Job ${job}——cron 里必须显式传`);

/* ------------------------------------------------------------ 检查：元 */

gate(JSON.stringify(fmKeys) === JSON.stringify(KEYS), 'frontmatter', `9 键顺序正确`, `键名或顺序不对：实际 [${fmKeys.join(', ')}]，必须 [${KEYS.join(', ')}]（§8.1）`);

const base = path.basename(file, '.md');
const m = base.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)$/);
gate(!!m, '文件名', base, `文件名不合规：${base}，必须 YYYY-MM-DD-小写kebab-slug.md（§8.1）`);
if (m) {
  gate(fm.date === m[1], 'date 一致性', fm.date, `frontmatter date=${fm.date} 与文件名日期 ${m[1]} 不一致（S24）`);
  gate(new Date(fm.date).getTime() <= Date.now() + 864e5, '未来日期', fm.date, `${fm.date} 是未来日期，Jekyll future:false 会静默丢弃`);
}

gate(c(fm.title) >= L.title[0] && c(fm.title) <= L.title[1], 'title 长度', `${c(fm.title)} 字符`, `title ${c(fm.title)} 不在 ${L.title[0]}–${L.title[1]}（§4.5）`);
/** §4.5.0「第一眼」：首页卡片标题不截断（实测 computed `overflow:visible`、`-webkit-line-clamp:none`、
 *  `white-space:normal`），窄屏那一档容器 460px / 字号 22px / 单个汉字 21.81px → 第一行 21 个汉字位。
 *  所以约束不是「会不会被裁」而是「第一行装不装得下前半句」——前半折行，第一眼就只剩一串名词。
 *  显示宽度口径：东亚宽字符（含全角标点）算 1，其余（拉丁、数字、空格、半角标点）算 0.5。 */
const isWide = (ch) => {
  const p = ch.codePointAt(0);
  return (p >= 0x1100 && p <= 0x115f) || (p >= 0x2e80 && p <= 0xa4cf) || (p >= 0xac00 && p <= 0xd7a3) || (p >= 0xe000 && p <= 0xf8ff) || (p >= 0xff00 && p <= 0xff60) || (p >= 0xffe0 && p <= 0xffe6);
};
const dispW = (s) => [...(s ?? '')].reduce((a, ch) => a + (isWide(ch) ? 1 : 0.5), 0);
const sepAt = (fm.title ?? '').search(/[，：；]/);
gate(sepAt > 0, '标题二段式', '有分隔符', `标题里没有「，」「：」「；」任何一个——本站标题的形状是前半抛具体物、后半兑现落差，没有后半，读者不知道这篇给他什么（§4.5.0）`);
const frontHalf = sepAt < 0 ? (fm.title ?? '') : (fm.title ?? '').slice(0, sepAt);
gate(dispW(frontHalf) <= L.frontHalfWidth, '标题前半屏宽', `${dispW(frontHalf).toFixed(1)} 个汉字位`, `前半「${frontHalf}」= ${dispW(frontHalf).toFixed(1)} 个汉字位 > ${L.frontHalfWidth}——窄屏卡片第一行只有 21 个位，前半折行等于第一眼没有钩子（§4.5.0）`);
gate(CONCRETE.test(fm.title ?? ''), '标题含具体物', fm.title ?? '', `标题里没有任何具体物（数字 / 拉丁专名 / 引号原话）：${fm.title}——读者看标题说不出「这篇讲的是哪个东西」就不算突出重点（§4.5）`);
gate(c(fm.seo_short_title) <= L.shortTitle, 'seo_short_title', `${c(fm.seo_short_title)} 字符`, `seo_short_title ${c(fm.seo_short_title)} > ${L.shortTitle}（§4.5）`);
gate(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(fm.seo_short_title ?? ''), 'seo_short_title 无 emoji', 'ok', 'seo_short_title 里出现了 emoji（§4.5）');
gate(c(fm.subtitle) <= L.subtitle, 'subtitle 长度', `${c(fm.subtitle)} 字符`, `subtitle ${c(fm.subtitle)} > ${L.subtitle}，首页 h3 无 truncate / line-clamp 会折成数行（§4.5）`);
gate((fm.tags ?? '').trim() !== '' && (fm.categories ?? '').trim() !== '', 'tags / categories', fm.tags, 'tags 或 categories 为空');
/** 与站点门同式（check-seo.mjs:1328-1339 的词表 ③）：多分类必须写成 [A, B]，裸标量且值中含空白才红。
 *  这一格只管 categories——tags 两种形状 Jekyll 都拆得对（check-seo.mjs:207 的 asList 注释就是这条口径），
 *  而 categories 只有方括号那一形能让归档页两栏都挂上，空格分隔的多值会让归档页读数撒谎。 */
const fmLines = fmText.split('\n');
const catLine = fmLines.find((l) => /^categories\s*:/.test(l));
const catVal = (catLine ?? '').replace(/^categories\s*:\s*/, '').trim();
gate(!(catVal !== '' && !catVal.startsWith('[') && /\S\s+\S/.test(catVal)), 'categories 多分类写成列表', 'ok', `categories 写了空格分隔的多值「${catVal}」——多分类必须写成 [A, B]，方括号之外 YAML 与 Jekyll 的拆法不同，归档页读数会撒谎（§8.1）`);

/* -------------------------------------------------------- 检查：结构顺序 */

const lines = body.split('\n');
const firstNonEmpty = lines.findIndex((l) => l.trim() !== '');
gate((lines[firstNonEmpty] ?? '').startsWith('# '), '正文首行', lines[firstNonEmpty] ?? '', `正文第一行必须是 \`# {title}\`，实际：${JSON.stringify(lines[firstNonEmpty] ?? '')}`);
gate((lines[firstNonEmpty] ?? '').slice(2).trim() === (fm.title ?? '').trim(), 'H1 与 title 一致', 'ok', 'H1 与 frontmatter title 不一致（§8.1）');
const secondNonEmpty = lines.findIndex((l, i) => i > firstNonEmpty && l.trim() !== '');
gate(/^!\[[^\]]*\]\(\/assets\/img\/[^)]+\.webp\)$/.test((lines[secondNonEmpty] ?? '').trim()), '封面图位置', (lines[secondNonEmpty] ?? '').trim().slice(0, 40), '第二行必须是绝对路径的 .webp 封面图（§8.1 / §8.2）');

/* 结论块：封面之后、第一个 H2 之前，有且只有一个两行 blockquote。 */
const headBlock = body.slice(0, body.search(/^## /m));
const bqLines = headBlock
  .split('\n')
  .filter((l) => l.trim().startsWith('>'))
  .map((l) => l.replace(/^>\s?/, '').trim())
  .filter(Boolean);
gate(bqLines.length === 2, '结论块行数', `${bqLines.length} 行`, `开篇 blockquote 必须正好两行，实际 ${bqLines.length} 行（§4.2）`);
gate(/^一句话结论：/.test(bqLines[0] ?? ''), '结论块第一行', '一句话结论：…', `第一行必须以「一句话结论：」开头，实际：${JSON.stringify(bqLines[0] ?? '')}`);
gate(/^现在该做什么：/.test(bqLines[1] ?? ''), '结论块第二行', '现在该做什么：…', `第二行必须以「现在该做什么：」开头，实际：${JSON.stringify(bqLines[1] ?? '')}`);
const blockChars = c(bqLines.join(''));
gate(blockChars >= L.blockMin && blockChars <= L.blockMax, '结论块字数', `${blockChars} 字符`, `结论块 ${blockChars} 不在 ${L.blockMin}–${L.blockMax}（§4.2）`);
{
  const t = bqLines.join(' ');
  const ugly = /\d{2}:\d{2}:\d{2}/.test(t) || /\d[\d,.]*\s*(?:字节|KB|MB|GB)/.test(t) || (t.match(/\b[0-9a-f]{7,40}\b/g) ?? []).some((h) => /[a-f]/.test(h)) || /\b[\w/.@-]+\.\w+:\d{1,5}\b/.test(t);
  gate(!ugly, '结论块不含上浮证据', 'ok', '结论块里出现了秒级时间戳 / 字节数 / hash / 行号（§4.2）');
}

/* ---- v4 结构门：节数自选，但节名必须不可移植、必须与最近几篇不同字 ---- */
gate(h2All.length >= L.h2Min && h2All.length <= L.h2Max, 'H2 数', `${h2All.length} 个`, `本篇 ${h2All.length} 节，v4 允许 ${L.h2Min}–${L.h2Max} 节按选题自选（§2）`);
const noConcrete = h2All.filter((t) => !CONCRETE.test(t));
const needConcrete = Math.max(1, Math.ceil(h2All.length * L.h2ConcreteRatio));
gate(h2All.length - noConcrete.length >= needConcrete, 'H2 带具体物', `${h2All.length - noConcrete.length}/${h2All.length} 节（需 ≥${needConcrete}）`, `这些节名可移植到任何一篇：${noConcrete.map((t) => `「${t}」`).join('、')}。多数节名必须含本篇独有的数字 / 专名 / 命令 / 原话（§2）`);
const badH2 = [];
for (const t of h2All) {
  const n = c(t);
  const banned = H2_CLAUSE_BAN.find((w) => t.includes(w));
  if (n < L.h2Len[0] || n > L.h2Len[1]) badH2.push(`${t.slice(0, 18)}=${n} 字（限 ${L.h2Len[0]}–${L.h2Len[1]}）`);
  else if (/[？?]$/.test(t)) badH2.push(`${t.slice(0, 18)}＝疑问句收尾`);
  else if (banned) badH2.push(`${t.slice(0, 18)}＝含「${banned}」`);
}
gate(badH2.length === 0, 'H2 形状', `${h2All.length} 节全部合格`, `${badH2.length} 节不合格：${badH2.join('、')}。节名 6–30 字、不许悬念式提问收尾、不许标题腔（§2 / §7.1）`);
gate(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h2All.join('')), 'H2 无 emoji', 'ok', 'H2 标题里出现了 emoji（§7.3）');
/** `plain` 原来定义在 `:596`，这里要先用它，所以上移：把那段定义整块删掉、放在这一行。 */
const plain = hideCode(body)
  .replace(/`[^`]*`/g, '')
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
const boundary = BOUNDARY_MARKERS.filter((w) => plain.includes(w));
gate(boundary.length >= 1, '边界在场', boundary.join('、') || '无', `全篇没有一处「没验到 / 没跑 / 我不知道谁在说真话」这类边界自陈——一条都没有说明这篇没有边界（§5.5 / §7.6 第 1 条）`);

/* -------------------------------------------------------- 检查：块与尺寸 */

const totalChars = c(body);
gate(totalChars <= L.charsTotal, '全文篇幅', `${totalChars} 字符 / 页面约 ${Math.ceil(totalChars / 400)} 分钟`, `全文 ${totalChars} > ${L.charsTotal} 非空白字符（§4.1）。只能删，不能砍结论块与诚实空白`);
gate(totalChars >= L.charsFloor, '全文下限', `${totalChars} 字符`, `全文 ${totalChars} < ${L.charsFloor}：材料撑不起一篇，按 §10 放弃本期，别用形容词把它填满`);

/** v4：取消逐节预算表（它把六节压成一样重）。单节只受「绝对上限」与「占全文比例上限」双重约束。 */
const secParts = body.split(/^## /m).slice(1);
const sections = h2All.map((title, i) => ({ title, i, chars: c(secParts[i] ?? '') }));
const secCeil = Math.min(L.sectionMax, Math.max(400, Math.floor(totalChars * L.sectionRatio)));
const overSection = sections.filter((s) => s.chars > secCeil);
gate(overSection.length === 0, '单节篇幅', `各节 ${sections.map((s) => s.chars).join('/')}，单节上限 ${secCeil}`, `${overSection.length} 节超上限：${overSection.map((s) => `${s.i + 1}·${s.title}=${s.chars}/${secCeil}`).join('、')}。全文 ${totalChars}，单节 ≤${L.sectionMax} 且 ≤${(L.sectionRatio * 100).toFixed(0)}%（§4.1）`);

/* 代码块 */
const codeBlocks = [...body.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((x) => x[1]);
gate(codeBlocks.length <= L.codeBlocks, '代码块数', `${codeBlocks.length} 个`, `代码块 ${codeBlocks.length} > ${L.codeBlocks}（§4.1）`);
const codeChars = codeBlocks.reduce((a, b) => a + c(b), 0);
gate(codeChars <= L.codeChars, '代码块合计', `${codeChars} 字符`, `代码块合计 ${codeChars} > ${L.codeChars}（§4.1）`);
const codeLineCounts = codeBlocks.map((b) => b.replace(/\n$/, '').split('\n').length);
gate(codeBlocks.length === 0 || Math.max(...codeLineCounts) <= L.codeLines, '单个代码块行数', codeBlocks.length ? `最长 ${Math.max(...codeLineCounts)} 行` : '无代码块', `有代码块超 ${L.codeLines} 行（§4.1），超长按「中间 N 行同类输出已略」裁，省略处要说明`);
const longLine = codeBlocks.flatMap((b) => b.split('\n')).find((l) => l.length > L.codeLineLen);
gate(!longLine, '代码块单行宽', 'ok', longLine ? `有代码行 ${longLine.length} 字符 > ${L.codeLineLen}，手机上静默横滚` : '有代码行超宽');

/* 表格 */
const tableBlocks = [];
{
  let cur = [];
  for (const l of lines) {
    if (/^\s*\|/.test(l)) cur.push(l);
    else {
      if (cur.length >= 2) tableBlocks.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) tableBlocks.push(cur);
}
gate(tableBlocks.length <= L.tables, '表格数', `${tableBlocks.length} 张`, `表格 ${tableBlocks.length} > ${L.tables}（§4.1）`);
for (const [i, t] of tableBlocks.entries()) {
  const rows = t.filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  const cols = Math.max(...rows.map((r) => r.split('|').length - 2));
  const cell = Math.max(
    ...rows.flatMap((r) =>
      r
        .split('|')
        .slice(1, -1)
        .map((x) => c(x)),
    ),
  );
  gate(cols <= L.tableCols && rows.length - 1 <= L.tableRows && cell <= L.cellChars, `表格 ${i + 1} 尺寸`, `${cols} 列 / ${rows.length - 1} 行 / 最宽格 ${cell}`, `表 ${i + 1} 是 ${cols} 列 × ${rows.length - 1} 行、最宽格 ${cell} 字，上限 ${L.tableCols} 列 × ${L.tableRows} 行 × ${L.cellChars} 字（§4.1）`);
}

/* 列表 */
const listRuns = [];
{
  let cur = [];
  for (const l of lines) {
    if (/^\s*(?:[-*+]|\d+\.)\s+\S/.test(l) && !hideCode(l).startsWith('```')) cur.push(l);
    else {
      if (cur.length) listRuns.push(cur);
      cur = [];
    }
  }
  if (cur.length) listRuns.push(cur);
}
gate(listRuns.length <= L.lists, '列表数', `${listRuns.length} 个`, `列表 ${listRuns.length} > ${L.lists}（§4.1）`);
for (const [i, r] of listRuns.entries()) {
  const nested = r.some((l) => /^\s{2,}/.test(l));
  const itemMax = Math.max(...r.map((l) => c(l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))));
  gate(r.length <= L.listItems && itemMax <= L.itemChars && !nested, `列表 ${i + 1} 尺寸`, `${r.length} 项 / 最长项 ${itemMax} 字`, `列表 ${i + 1}：${r.length} 项、最长项 ${itemMax} 字${nested ? '、有嵌套' : ''}，上限 ${L.listItems} 项 / ${L.itemChars} 字 / 0 层嵌套（§4.1）`);
}

/* 图片：张数与相邻 */
const imgLines = lines.map((l, i) => ({ l, i })).filter((x) => /^\s*!\[/.test(x.l));
gate(imgLines.length <= L.images, '插图数', `${imgLines.length} 张（含封面）`, `图片 ${imgLines.length} > 封面 + ${L.images - 1} 张插图（§4.1）`);
const adjacent = imgLines.slice(1).filter((x, i) => x.i - imgLines[i].i <= 2);
gate(adjacent.length === 0, '两图不相邻', 'ok', `第 ${adjacent.map((x) => x.i + 1).join('、')} 行与前一张图相邻，中间必须夹 ≥1 段正文`);
gate(imgLines.length >= L.imagesMin, '插图下限', `${imgLines.length} 张（含封面）`, `全文只有 ${imgLines.length} 张图，v4 要求 ≥${L.imagesMin}——「必要时配图辅助理解」是用户的第 2 条要求，两图文等于没配（§4.1 / §8.2）`);
/** 真实截图：只判「文件名含 screenshot」这一件形状上可判的事。
 *  文件在不在磁盘上由 scripts/build-image-variants.mjs --check 与 jekyll build 管；
 *  alt 说的是不是那张图里发生了什么，仍归 §10.2 第 7 项人工读。 */
const shots = imgLines.filter((x) => /screenshot/i.test(x.l)).length;
gate(shots >= 1, '真实截图在场', `${shots} 张`, `没有一枚文件名含 screenshot 的图，实有：${imgLines.map((x) => x.l.trim().slice(0, 44)).join(' | ')}——纯 AI 示意图证不了这篇真跑过（§8.2.0）`);

/* 加粗 / 分隔线 / 引语 */
const bolds = [...body.matchAll(/\*\*([^*\n]+)\*\*/g)];
gate(bolds.length <= L.bold, '加粗数', `${bolds.length} 处`, `加粗 ${bolds.length} > ${L.bold}（§4.1）`);
const hrLines = lines.filter((l) => /^(-{3,}|\*{3,})$/.test(l.trim()));
gate(hrLines.length <= L.hr, '分隔线', `${hrLines.length} 处`, `--- ${hrLines.length} > ${L.hr}（§4.1）`);
const quoteRuns = [];
{
  let cur = [];
  for (const l of lines) {
    if (/^\s*>/.test(l)) cur.push(l);
    else {
      if (cur.length) quoteRuns.push(cur);
      cur = [];
    }
  }
  if (cur.length) quoteRuns.push(cur);
}
const bodyQuotes = quoteRuns.filter((r) => !r.some((l) => /一句话结论：|现在该做什么：/.test(l)));
gate(bodyQuotes.length <= L.quotes && bodyQuotes.every((r) => r.length <= L.quoteLines), '引语 blockquote', `${bodyQuotes.length} 段`, `引语 ${bodyQuotes.length} 段、最长 ${Math.max(0, ...bodyQuotes.map((r) => r.length))} 行，上限 ${L.quotes} 段 × ${L.quoteLines} 行（§4.1）`);

/* 段落与句子：跳过标题 / 图片 / 引语 / 表格 / 列表（列表有各自的判据） */
const prose = hideCode(body)
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter(Boolean)
  .filter((p) => !/^(?:#|!|>|\||[-*+]|\d+\.)/.test(p))
  .map((p) => p.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
  .map((p) => p.replace(/`[^`]*`/g, ''));
const paraLens = prose.map((p) => c(p));
const longPara = paraLens.filter((n) => n > L.paraChars);
gate(longPara.length === 0, '段落长度', `最长 ${Math.max(0, ...paraLens)}`, `${longPara.length} 段超 ${L.paraChars} 字（最长 ${Math.max(...longPara)} 字）——760px 栏宽下 4 行封顶`);
gate(paraLens.filter((n) => n <= 40).length >= L.paraShortMin, '存在短段', `≤40 字的段 ${paraLens.filter((n) => n <= 40).length} 个`, `没有 ≤40 字的段落，全文节奏齐平是模板痕迹（§4.1）`);
/** 按句切：跳行为界，表格行不与正文连成一句。 */
const splitSents = (s) =>
  s
    .split(/[。！？]|\n/)
    .map((x) => x.trim())
    .filter(Boolean);

const sents = splitSents(prose.join('\n'))
  .map((s) => c(s))
  .filter(Boolean);
gate(sents.filter((n) => n > L.sentChars).length === 0, '句子长度', `最长 ${Math.max(0, ...sents)}`, `${sents.filter((n) => n > L.sentChars).length} 句超 ${L.sentChars} 字（最长 ${Math.max(...sents.filter((n) => n > L.sentChars))}）`);
gate(sents.filter((n) => n <= 6).length >= 1, '存在极短句', `≤6 字句 ${sents.filter((n) => n <= 6).length} 个`, '一个 ≤6 字短句都没有（「能跑。」「没了。」这类）');

/* ---- v4：§7.7 的 1/4/5 条进门（判据逐字照协议 §7.7 那张表，不自己另发明阈值）---- */
const tail = plain.match(/，(从而|使得|让.{0,8}(?:更|越)|为.{0,10}提供|体现了|印证了)/g) ?? [];
gate(tail.length === 0, '句尾分析尾巴', `${tail.length} 处`, `这些句子结尾在替读者做总结：${tail.map((x) => `「…${x.slice(1, 26)}」`).join('、')}。事实说完就收句，要判断就单独成句（§7.7 第 1 条）`);
const runs3 = listRuns.filter((r) => r.length === 3 && Math.max(...r.map((l) => c(l))) - Math.min(...r.map((l) => c(l))) <= 8);
gate(runs3.length < 3, '并列整齐病', `3 项等长列表 ${runs3.length} 处`, `${runs3.length} 个列表恰好 3 项且三项字数相差 ≤8（协议阈值：≥3 处即模板痕迹）：改成长短不齐的两项或四项（§7.7 第 4 条）`);
const selfEcho = [];
{
  const cjk = (s) => (s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).join('');
  const g3 = (s) => new Set([...Array(Math.max(0, s.length - 2))].map((_, k) => s.slice(k, k + 3)));
  for (let i = 0; i < secParts.length; i++) {
    const flat = hideCode(secParts[i]).split('\n').slice(1).map((l) => l.trim()).filter((l) => l && !/^[#|>!`-]/.test(l)).join('')
      .replace(/`[^`]*`/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '');
    const sents2 = flat.split(/[。！？]/).map((x) => cjk(x.trim())).filter((x) => x.length >= 6);
    if (sents2.length < 2) continue;
    const a = g3(sents2[0]), b = g3(sents2[sents2.length - 1]);
    if (!a.size || !b.size) continue;
    const inter = [...b].filter((x) => a.has(x)).length / Math.min(a.size, b.size);
    if (inter >= 0.4) selfEcho.push(`${(secParts[i].split('\n')[0] ?? '').trim().slice(0, 16)}`);
  }
}
gate(selfEcho.length === 0, '节内自我复述', `命中 ${selfEcho.length} 节`, `这些节把首句又用末句说了一遍（中文 3-gram 重合 ≥40%，已剔代码 / 链接 / 专名）：${selfEcho.join(' / ')}。删末句（§7.7 第 5 条：末句只是首句换个说法）`);

/* 每节第一句 ≤30 字 */
const badFirst = [];
for (const title of h2All) {
  const seg = body.split(/^## /m).find((s) => s.startsWith(title));
  if (!seg) continue;
  const firstPara = (
    hideCode(seg)
      .slice(title.length)
      .split(/\n\s*\n/)
      .find((p) => p.trim() && !/^[#|>!-]/.test(p.trim())) ?? ''
  ).trim();
  const firstSent = firstPara.split(/[。！？]/)[0] ?? '';
  if (c(firstSent) > L.firstSentChars) badFirst.push(`${title}=${c(firstSent)}`);
}
gate(badFirst.length === 0, '节内结论前置', 'ok', `${badFirst.length} 节首句超 ${L.firstSentChars} 字：${badFirst.join('、')}（§4.3）`);

/* ---- v4：节与节之间必须有具体物流转（治「六张卡片」而非「一条线」）---- */
const TOK = /\d[\d.,]{1,}|[A-Za-z][A-Za-z0-9@\/._+-]{2,}/g;
const toks = (s) => new Set([...(s.match(TOK) ?? [])].map((x) => x.toLowerCase()));
const firstLineOf = (seg) => {
  const ls = seg.split('\n');
  const title = ls[0] ?? '';
  const prose = hideCode(ls.slice(1).join('\n'))
    .split('\n')
    .filter((l) => !/^\s*(!\[|\||>)/.test(l.trim()))
    .join(' ')
    .trim();
  return `${title} ${(prose.split(/[。！？]/)[0] ?? '').slice(0, 80)}`;
};
const carry = [];
for (let i = 1; i < secParts.length; i++) {
  const prev = toks(hideCode(secParts[i - 1]));
  if (!prev.size) continue;
  const cur = toks(firstLineOf(secParts[i]));
  if (![...cur].some((t) => prev.has(t))) carry.push(((secParts[i].split('\n')[0] ?? '').trim()).slice(0, 22));
}
const carryTol = secParts.length >= 7 ? 2 : L.carryTol;
gate(carry.length <= carryTol, '节间承接', `可判 ${secParts.length - 1} 处，断链 ${carry.length}（容差 ${carryTol}）`, `这些节的首句没接住上一节出现过的任何一个具体物（数字 / 命令 / 报错 / 专名）：${carry.join(' / ')}。实测：09-10 手写稿断 1 处，10-14 那篇断 4 处（§4.6）`);

/* ---- v4：不许与最近发布的文章共用任何整句（含节名）——固定骨架时代的病根 ---- */
const normUnit = (s) => s.replace(/\s+/g, '').replace(/[`*#_]/g, '');
const unitsOf = (text) => {
  const b = text.replace(/^---[\s\S]*?---\n/, '').replace(/^```[\s\S]*?^```/gm, '');
  return new Set(
    b
      .split('\n')
      .filter((l) => !/^\s*(!\[|>\s*一句话结论|>\s*现在该做什么|项目地址：|在线演示：|\|)/.test(l.trim()))
      .flatMap((l) => normUnit(l).split(/[。！？]/))
      .filter((u) => u.length >= L.reuseMin),
  );
};
const histDir = process.env.ARTICLE_CHECK_HISTORY || '_posts';
const selfName = path.basename(file);
/* 窗口取「排在本篇之前的最后 N 篇」，不是「文件名最后 N 篇」：`_posts` 里有一枚
 * `2100-10-25-practice-demo.md`，按文件名取尾部会让它恒占一格、把真正的邻居挤出窗口；
 * 而新稿在 cron 里是「今天」这篇，取之前 N 篇正好等于最近发布的 N 篇。 */
const hist = fs.existsSync(histDir)
  ? fs
      .readdirSync(histDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f) && f !== selfName && f < selfName)
      .sort()
      .slice(-L.historyPosts)
  : [];
const pool = new Map();
for (const f of hist) for (const u of unitsOf(fs.readFileSync(path.join(histDir, f), 'utf8'))) if (!pool.has(u)) pool.set(u, f);
const reused = [...unitsOf(raw)].filter((u) => pool.has(u));
gate(reused.length === 0, '无跨篇复用行', `比对 ${hist.length} 篇，复用 0`, `这些整句（≥${L.reuseMin} 字）与排在本篇之前的 ${hist.length} 篇逐字相同：${reused.map((u) => `「${u.slice(0, 26)}」← ${pool.get(u)}`).join('、')}。同一枚节名或句子连着几篇复用，读者会读成上一篇的复制——v3.0 的固定骨架就是这么长出 6 篇同名的「背景：它为什么出现」（§2）`);
if (hist.length < 3) warns.push(`比对样本只有 ${hist.length} 篇（ARTICLE_CHECK_HISTORY=${histDir}）：复用行门的窗口不足，这一项不算真跑过`);

/* ------------------------------------------------------- 检查：词与句式 */

const hitHard = HARD_WORDS.filter((w) => plain.includes(w));
gate(hitHard.length === 0, '一级黑名单', '命中 0', `命中 ${hitHard.length} 个：${hitHard.join('、')}（§7.1，逐个换成数字/路径/命令，或整句删）`);
const hitPat = HARD_PATTERNS.filter(([re]) => re.test(plain)).map(([, n]) => n);
gate(hitPat.length === 0, '句式黑名单', '命中 0', `命中：${hitPat.join('、')}（§7.1 / §7.2）`);
const judged = JUDGMENT_WORDS.filter((w) => plain.includes(w));
if (judged.length) warns.push(`需人工判断（语境限定词，正则判不了）：${judged.join('、')}——技术实指合法，营销比喻必须删`);
for (const [re, cap, name] of QUOTA) {
  const n = (plain.match(re) ?? []).length;
  gate(n <= cap, `配额 ${name}`, `${n}/${cap}`, `${name} 用了 ${n} 次 > ${cap}（§7.3）`);
}
const bangInBody = (plain.match(/！/g) ?? []).length;
gate(bangInBody <= 3, '感叹号（正文）', `${bangInBody} 个`, `正文 ！ ${bangInBody} > 3（§7.3）`);
gate(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(plain), '正文无 emoji', 'ok', '正文里出现了 emoji（🚨 只许进标题）');

/* ------------------------------------------------- 检查：证据下沉 §4.4 */

const secondTs = (plain.match(/\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T/g) ?? []).length;
gate(secondTs <= L.secondTimestamps, '秒级时间戳', `${secondTs} 处`, `秒级时间戳 ${secondTs} > ${L.secondTimestamps}，秒级口径留在 manifest（§4.4）`);
const caps = (plain.match(/\d[\d,.]*\s*(?:字节|KB|MB|GB|B\b)/g) ?? []).length;
gate(caps <= L.capacity, '字节与容量数', `${caps} 处`, `字节/容量 ${caps} > ${L.capacity}（§4.4）`);
/** 行号引用（`src/x.ts:88`、`README.md:12`）与 commit hash（必须含 a-f，否则 7 位纯数字会误报）。 */
const lineRefs = plain.match(/\b[\w/.@-]+\.\w+:\d{1,5}\b/g) ?? [];
const hashRefs = (plain.match(/\b[0-9a-f]{7,40}\b/g) ?? []).filter((h) => /[a-f]/.test(h));
const lineHash = lineRefs.length + hashRefs.length;
gate(lineHash <= L.lineOrHash, '行号与 hash', `${lineHash} 处`, `行号 + hash ${lineHash} > ${L.lineOrHash}（§4.4）${lineHash > L.lineOrHash ? `：${[...lineRefs, ...hashRefs].join('、')}` : ''}`);

/** 精确数字：带千分位、带小数、或 ≥4 位整数；版本串按一个计。 */
const PRECISE = /(?:\d+\.\d+(?:\.\d+)?)|(?:\d{1,3}(?:,\d{3})+)|\d{4,}/g;
/** 日期串与中文年份不算「精确数字」，否则每篇写日期都白扣预算；但「2000 个测试」这类整数仍算。 */
const stripDates = (s) => s.replace(/\b(?:19|20)\d{2}(?:[-/]\d{1,2}){1,2}\b/g, ' ').replace(/\b(?:19|20)\d{2}\s*年(?:\s*\d{1,2}\s*月)?(?:\s*\d{1,2}\s*日)?/g, ' ');
const precise = stripDates(plain).match(PRECISE) ?? [];
gate(precise.length <= L.preciseTotal, '精确数字总量', `${precise.length} 个`, `精确数字 ${precise.length} > ${L.preciseTotal}（§4.4，可核对数字不必都写成精确式）`);
/* 单句堆积只判正文段落；表格与代码走 §4.1 的专门配额 */
const proseSents = splitSents(stripDates(prose.join('\n')));
const maxPerSent = Math.max(0, ...proseSents.map((s) => (s.match(PRECISE) ?? []).length));
const overSent = proseSents.filter((s) => (s.match(PRECISE) ?? []).length > L.precisePerSent);
gate(overSent.length === 0, '单句精确数字', `最多 ${maxPerSent} 个/句`, `${overSent.length} 句里堆了 >${L.precisePerSent} 个精确数字：${overSent.map((s) => s.trim().slice(0, 24)).join(' / ')}`);

/* ------------------------------------------------- 检查：展望节 §6 */

/** 展望节按位置取（最后一节），不再按标题字符串找——v3.1 之后那半句是自拟的。 */
const outlookRaw = (secParts[secParts.length - 1] ?? '').trim();
const outlookTitle = (outlookRaw.split('\n')[0] ?? '').trim();
/** §2 正文顺序里「结尾两行」不属于任何一节，不能算进展望的预算。 */
const outlookSeg = outlookRaw.replace(/^(项目地址：|在线演示：)[\s\S]*$/m, '');
const oc = c(outlookSeg.slice(outlookTitle.length));
/** §6 的收尾节预算：绝对上限 `L.outlookChars` 与「≤ 全文 `L.outlookRatio`」取小的那一个。 */
const outlookCap = Math.min(L.outlookChars, Math.floor(totalChars * L.outlookRatio));
gate(oc <= outlookCap, '展望篇幅', `${oc} 字符 / 占 ${((oc / totalChars) * 100).toFixed(1)}%`, `收尾节 ${oc} 字符 > ${outlookCap}（≤${L.outlookChars} 且 ≤ 全文 ${(L.outlookRatio * 100).toFixed(0)}%，本期为 ${Math.floor(totalChars * L.outlookRatio)}）——展望写成第二大节就是把重点挪走了（§6）`);
const anchors = (outlookSeg.match(/(?:#\d+|ROADMAP|CHANGELOG|milestone|dist-tag|beta|next|canary|v?\d+\.\d+)/gi) ?? []).length;
const cond = /如果/.test(outlookSeg);
gate(anchors >= 2 || cond, '展望有锚', `锚点 ${anchors} 个，条件句 ${cond}`, '展望既无 ≥2 个可核对锚点（编号 / ROADMAP / CHANGELOG / dist-tag / 版本号），也没有「如果 A 在 B 前没做 C 我就 D」的条件句（§6）');

/* ------------------------------------------- 检查：结尾（§2 末行 / §3） */

const proj = [...body.matchAll(/^项目地址：\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)\s]+)\)[ \t]*$/gm)];
const repoLinked = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(body);
if (job === 'A' || repoLinked) {
  gate(proj.length === 1, '结尾项目地址', `${proj.length} 处`, `${job === 'A' ? 'Job A' : '正文引用了 GitHub 仓库'}，结尾必须恰好一行 ` + '`项目地址：[url](url)`（§2 末行）');
  if (proj.length === 1) gate(proj[0][1] === proj[0][2], '项目地址链接自洽', 'ok', '链接文字与目标地址不一致，读者点开才知道被换了地址（§5.3 URL 行）');
}

/* ----------------------------------------------- 检查：数字反查 manifest */

if (manifestPath && fs.existsSync(manifestPath)) {
  const man = fs.readFileSync(manifestPath, 'utf8').replace(/,/g, '');
  const norm = (t) => t.replace(/,/g, '');
  const missing = [...new Set(precise.map(norm))].filter((t) => !man.includes(t));
  gate(missing.length === 0, '数字反查 manifest', `正文 ${new Set(precise.map(norm)).size} 个精确数全部可反查`, `${missing.length} 个数字在 manifest 里查不到：${missing.join('、')}。补真实来源，或改成自然说法，或删（§5.1）`);
  const ids = [...new Set(plain.match(/#\d{2,6}/g) ?? [])];
  const missingIds = ids.filter((id) => !man.includes(id.slice(1)));
  gate(missingIds.length === 0, '编号反查 manifest', `${ids.length} 个编号全部可反查`, `这些编号在 manifest 里查不到：${missingIds.join('、')}。禁止凭印象写编号，禁止改编号（§5.3）`);
  for (const id of ids) {
    const i = plain.indexOf(id);
    if (!/[\w.-]+\/[\w.-]+\s*$/.test(plain.slice(Math.max(0, i - 60), i))) {
      warns.push(`${id} 附近 60 字符内没有 owner/repo——09-26 就是这样把 BrowserSkill#275 记成了 json-render#275（实测 404）`);
      break;
    }
  }
  const urls = [...new Set(raw.match(/https?:\/\/[^\s)>\]"'(]+/g) ?? [])];
  const missingUrls = urls.filter((u) => !man.includes(u.replace(/\/$/, '')));
  gate(missingUrls.length === 0, 'URL 反查 manifest', `${urls.length} 条全部已登记`, `${missingUrls.length} 条 URL 不在 manifest：${missingUrls.join(' ').slice(0, 120)}（禁止按规律拼 URL）`);
  /** §4.5.2 v4：五候选必须五种不同形状，并且必须写清「淘汰那条为什么输」。
   *  v3.2 的 0/1/2 四项打分在四篇真稿里全是满分，那种「打分」与没打分无法区分，已删除。 */
  const candLines = man.split('\n').filter((l) => /^\s*候选\s+\d+\s*〈/.test(l));
  const candTypes = new Set(candLines.map((l) => (l.match(/〈([^〉]+)〉/) ?? ['', ''])[1]));
  const pickedLine = (man.split('\n').find((l) => /^\s*选用\s*=/.test(l)) ?? '').trim();
  const droppedLine = (man.split('\n').find((l) => /^\s*淘汰\s*=/.test(l)) ?? '').trim();
  const pickedNo = (pickedLine.match(/=\s*(\d+)/) ?? ['', ''])[1];
  const droppedNo = (droppedLine.match(/=\s*(\d+)/) ?? ['', ''])[1];
  const pickedText = (candLines.find((l) => new RegExp(`^\\s*候选\\s*0*${pickedNo}\\b`).test(l)) ?? '').replace(/^候选\s*\d+\s*〈[^〉]*〉\s*/, '').split('｜')[0].trim();
  const droppedWhy = c((droppedLine.match(/〈([^〉]+)〉/) ?? ['', ''])[1]);
  gate(
    candLines.length >= L.titleCandidates &&
      candTypes.size >= L.titleCandidates &&
      pickedNo !== '' &&
      droppedNo !== '' &&
      droppedNo !== pickedNo &&
      droppedWhy >= 12 &&
      pickedText !== '' &&
      pickedText === fm.title,
    '标题候选落盘',
    `${candLines.length} 行候选 / ${candTypes.size} 种形状 / 选用 ${pickedNo || '无'}、淘汰 ${droppedNo || '无'}（理由 ${droppedWhy} 字）`,
    `manifest 末尾要 ≥${L.titleCandidates} 行 \`候选 NN 〈钩子类型〉 标题全文\`，**五种类型必须互不相同**（实得 ${candTypes.size} 种），外加 \`选用 = NN\` 与 \`淘汰 = MM〈为什么淘汰，≥12 字〉\` 两行、NN≠MM，且 \`选用\` 那条的标题全文必须逐字等于 frontmatter 的 title。10-12/10-13 四篇的 0/1/2 打分全是满分，等于没打分——v4 改判形状与淘汰理由（§4.5.2）`,
  );
} else {
  warns.push('未提供 --manifest：数字 / 编号 / URL 的反查没跑。这一项在 v1 就是「自报达标」的漏口，别当成过了');
}

/* -------------------------------------------------------------- 输出 */

process.stdout.write(`article-check  ${file}  job=${job}  h2=${h2All.length} 节\n` + `chars ${totalChars}（汉字 ${(body.match(/[一-鿿]/g) ?? []).length}）→ 页面约 ${Math.ceil(totalChars / 400)} 分钟；上限 ${L.charsTotal}\n`);
for (const p of passes) process.stdout.write(`PASS  ${p}\n`);
for (const w of warns) process.stdout.write(`WARN  ${w}\n`);
for (const f of fails) process.stdout.write(`FAIL  ${f}\n`);
process.stdout.write(`\n结论: ${fails.length === 0 ? 'PASS' : 'FAIL'}（PASS ${passes.length} / WARN ${warns.length} / FAIL ${fails.length}）\n`);
if (fails.length) {
  process.stdout.write('修复手段只有三种：删 / 换说法 / 补真实来源。禁止为了过门编造 manifest 条目。\n' + '第 3 轮仍只超长度 → 按 §4.1 砍到达标放行，日志写明砍了什么与原读数。\n');
}
process.exit(fails.length ? 1 : 0);
