#!/usr/bin/env node
/**
 * 把 _posts 里的一篇文章同步成**微信公众号草稿**——停在草稿箱，发布由人在后台点。
 *
 * 为什么需要这一层包装：文章和公众号草稿的入参对不上，直接调
 * baoyu-post-to-wechat 的 wechat-api.ts 会在三个地方失败，而且都是静默失败或难懂的失败：
 *
 * 1. **图片路径**。正文里的 `/assets/img/...` 是站点根路径，而 skill 的
 *    loadUploadAsset 见到 `path.isAbsolute()` 就当本机文件系统路径直读，
 *    于是每张图都抛 `Image not found: /assets/...`。这里改写成仓库内的真实绝对路径。
 *    改写只作用于代码围栏（``` / ~~~）之外——围栏里出现的路径字符串是示例内容，动了就改坏代码块。
 * 2. **封面格式**。封面走 `material/add_material` 换 thumb_media_id，而 skill 只在
 *    `uploadType === "body"` 时才做转码（needsWechatBodyImageProcessing 那条支路），
 *    material 通道是原样上传。本站配图被构建流程转成了 .webp（正文图没问题，
 *    body 通道会转码），封面却直接被 skill 原样递给微信，而 add_material 只收
 *    bmp/png/jpeg/jpg/gif。所以这里先用 ffmpeg 把 banner.webp 转成 jpg 再传。
 * 3. **元信息字段**。写作协议锁死 _posts 的 7 个键，里面没有 author / description /
 *    contentSourceUrl。这里从 subtitle 取摘要（微信摘要上限 120 字，超了截断并报告），
 *    从 _config.yml 的 url + baseurl 拼出该篇的真实 permalink 当「阅读原文」。
 *
 * 另外做两件事：正文首行的 `# {title}` 删掉（公众号标题是独立字段，留着就是标题出现两次），
 * 以及用 .wechat-sync/index.json 按内容哈希防重复同步（草稿箱没有幂等键，
 * 一篇重跑两次就多两条草稿，靠这里挡）。
 *
 * 不碰发布：调的是 skill 的 draft/add 链路，产物是草稿 + media_id。
 * 发表这个动作在 mp.weixin.qq.com 后台，本脚本从始至终不请求 freepublish。
 *
 * 用法：
 *   node scripts/wechat-draft.mjs --post _posts/2026-09-25-x.md --dry-run   # 只准备与校验，不联网
 *   node scripts/wechat-draft.mjs --post _posts/2026-09-25-x.md             # 真同步（需凭据与 IP 白名单）
 *   node scripts/wechat-draft.mjs --latest [--dry-run]                      # 取 _posts 里 date 最新的一篇
 *   附加：--theme default|grace|simple|modern  --author 廖小新  --force  --keep-links  --skill <dir>
 *
 * 前置（一次性，由维护者本人在微信后台与服务器上配）：
 *   .baoyu-skills/baoyu-post-to-wechat/EXTEND.md 的 remote_publish_host 等键已填真实值；
 *   .baoyu-skills/.env 里有 WECHAT_APP_ID / WECHAT_APP_SECRET；
 *   那台 SSH 主机的公网 IP 已加进公众号「IP 白名单」。
 *   这三处任一没配，--dry-run 照样能跑完，真跑会在那里报错并说明缺什么。
 */

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFm, postPermalink, readBody, readSiteBase } from './lib/post-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = path.join(ROOT, '.wechat-sync');
const STATE_FILE = path.join(STAGING, 'index.json');
const CONFIG_FILE = path.join(ROOT, '_config.yml');

/** 微信摘要字段的上限（字符数），与 skill 里 extractSummaryFromBody(body, 120) 同口径。 */
const DIGEST_MAX = 120;
/** 封面转 jpg 后要落在这个体积内；add_material 的图片上限是 10MB，这里按 1/10 留余量。 */
const COVER_MAX_BYTES = 1 * 1024 * 1024;
/** 封面压缩梯度：先降质量，再降宽度。 */
const COVER_LADDER = [
  { q: '4', width: null },
  { q: '7', width: null },
  { q: '9', width: 1400 },
  { q: '11', width: 1200 },
];

const argv = process.argv.slice(2);

/**
 * 取 `--key value` 形式的参数值。
 * @param {string} key 不含前导 --
 * @returns {string | undefined}
 */
const opt = (key) => {
  const i = argv.indexOf(`--${key}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const flag = (key) => argv.includes(`--${key}`);

/**
 * 打成一行可直接粘贴的 shell 命令：只有纯安全字符集的参数才裸写，其余一律单引号包住。
 * 标题里有 emoji、`！`、空格甚至引号，裸 join 出来的命令是不可用的。
 * @param {string[]} parts
 * @returns {string}
 */
const shq = (parts) =>
  parts
    .map((p) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(p) && p.length > 0 ? p : `'${p.replace(/'/g, `'\\''`)}'`))
    .join(' ');

const log = (...a) => console.log('[wechat-draft]', ...a);
const warn = (...a) => console.warn('[wechat-draft] ⚠', ...a);
const die = (msg) => {
  console.error(`[wechat-draft] ✗ ${msg}`);
  process.exit(1);
};

if (flag('help') || (!opt('post') && !flag('latest') && !flag('check-config'))) {
  console.log(`用法：node scripts/wechat-draft.mjs --post _posts/xxx.md [--dry-run]
          node scripts/wechat-draft.mjs --latest [--dry-run]
          node scripts/wechat-draft.mjs --check-config   只看真跑的前置齐没齐（齐 0 / 不齐 3）
  --theme <name>   default|grace|simple|modern（默认 default）
  --author <name>  不传则由 skill 读 EXTEND.md 的 default_author
  --keep-links     保留正文内链（默认把普通外链转成文末引用，微信内链不可点）
  --force          忽略「已同步过」闸门，重复建草稿
  --skill <dir>    baoyu-post-to-wechat 的目录（默认自动探测）`);
  process.exit(flag('post') || flag('latest') || flag('check-config') ? 0 : 1);
}

if (flag('check-config')) {
  const miss = missingPrereqs();
  if (miss.length) {
    console.error('[wechat-draft] 真跑的前置还没齐：');
    for (const m of miss) console.error(`  · ${m}`);
    process.exit(3);
  }
  log('前置齐了：EXTEND.md 的 host/author/私钥、.env 里的凭据都在位');
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * 1. 定位文章与 skill
 * ------------------------------------------------------------------ */

/**
 * 按 _posts 里 front matter 的 date 挑最新一篇（不是按文件名，理由见 postPermalink）。
 * 未来日期的稿子跳过：Jekyll `future: false` 根本不构建它，线上没有对应地址。
 * @returns {string} _posts 下某文件的绝对路径
 */
function latestPost() {
  const now = new Date();
  const rows = fs
    .readdirSync(path.join(ROOT, '_posts'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = path.join(ROOT, '_posts', f);
      const fm = parseFm(file);
      return { file, date: String(fm.date || '').slice(0, 10), title: fm.title };
    })
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.title)
    .filter((r) => new Date(`${r.date}T00:00:00`) <= now)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.file < b.file ? 1 : -1));
  if (!rows.length) die('_posts 里没有带 title 与 date 的文章，--latest 无从下手');
  log(`--latest 命中 ${path.relative(ROOT, rows[0].file)}（date ${rows[0].date}）`);
  return rows[0].file;
}

/**
 * 探测 baoyu-post-to-wechat 的安装位置：以能否解析到 scripts/wechat-api.ts 为准。
 * @param {string | undefined} explicit --skill 的值
 * @returns {string} skill 目录绝对路径
 */
function resolveSkillDir(explicit) {
  const home = process.env.HOME || os.homedir();
  const cands = [];
  if (explicit) cands.push(explicit);
  if (process.env.BAOYU_WECHAT_SKILL_DIR) cands.push(process.env.BAOYU_WECHAT_SKILL_DIR);
  cands.push(
    path.join(home, '.agents/skills/baoyu-post-to-wechat'),
    path.join(home, '.qoder-cn/skills/baoyu-post-to-wechat'),
    path.join(home, '.claude/skills/baoyu-post-to-wechat'),
  );
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'scripts', 'wechat-api.ts'))) return path.resolve(c);
  }
  die(`找不到 baoyu-post-to-wechat（试过 ${cands.join(', ')}）；用 --skill <dir> 指过去`);
}

/**
 * skill 的 .ts 脚本要 bun 跑。本机没装 bun，就走 npx 拉一次性的 bun。
 * @returns {string[]} 命令与前置参数
 */
function bunCmd() {
  const probe = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? ['bun'] : ['npx', '-y', 'bun'];
}

const postFile = opt('post') ? path.resolve(ROOT, opt('post')) : latestPost();
if (!fs.existsSync(postFile)) die(`文章不存在：${path.relative(ROOT, postFile)}`);

const fm = parseFm(postFile);
const title = (fm.title || '').trim();
const date = String(fm.date || '').slice(0, 10);
if (!title) die(`${path.relative(ROOT, postFile)} 的 front matter 没有 title，公众号标题不能空`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`${path.relative(ROOT, postFile)} 的 date 不是 YYYY-MM-DD，无法拼 permalink`);
// _config.yml 没开 future，日期在未来的稿子压根不进站点，permalink 指过去就是死链；
// 而 news 草稿的「阅读原文」一旦点开是 404，比不发更难堪。这里先挡住。
if (new Date(`${date}T00:00:00`) > new Date())
  die(`${path.relative(ROOT, postFile)} 的 date ${date} 在未来，Jekyll 不会构建它，线上没有这个地址，不同步`);

const site = readSiteBase(CONFIG_FILE);
if (!site.origin) die(`_config.yml 里没读到 url，无法拼「阅读原文」的绝对地址`);
const link = postPermalink({ file: postFile, fm, site });

const skillDir = resolveSkillDir(opt('skill'));
const apiScript = path.join(skillDir, 'scripts', 'wechat-api.ts');

/* ------------------------------------------------------------------ *
 * 2. 正文：删重复标题、改写图片路径（只在代码围栏外动手）
 * ------------------------------------------------------------------ */

/**
 * 把站点根路径的图片引用改成本机真实路径。
 *
 * 按 ``` / ~~~ 切成「正文 / 围栏」交替的片段，只有偶数段（正文）参与替换：
 * 文章里贴的配置文件、curl 示例经常带 `/assets/...` 字符串，那是内容不是引用。
 *
 * @param {string} body 去掉 front matter 的正文
 * @returns {{ body: string, rewritten: number }}
 */
function rewriteImages(body) {
  const repoPrefix = `${ROOT}/`;
  const parts = body.split(/(^```[^\n]*\n[\s\S]*?^```[^\n]*$|^~~~[^\n]*\n[\s\S]*?^~~~[^\n]*$)/m);
  let rewritten = 0;
  const out = parts.map((seg, i) => {
    if (i % 2 === 1) return seg; // 围栏内原样
    return seg
      .replace(/(!\[[^\]]*\]\()\/(assets\/[^)\s]+)([^)]*\))/g, (_m, p1, p2, p3) => {
        rewritten += 1;
        return `${p1}${repoPrefix}${p2}${p3}`;
      })
      .replace(/(<img[^>]*\ssrc=")\/(assets\/[^"]+)(")/g, (_m, p1, p2, p3) => {
        rewritten += 1;
        return `${p1}${repoPrefix}${p2}${p3}`;
      });
  });
  return { body: out.join(''), rewritten };
}

/**
 * 去掉正文首行的 `# {title}`：公众号的标题是独立字段，正文再顶一次会显示两遍。
 * 只认「第一处非空行」，且要求它确实等于 front matter 的 title，否则不动。
 * @param {string} body
 * @returns {{ body: string, dropped: boolean }}
 */
function dropLeadingTitle(body) {
  const lines = body.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  if (first < 0) return { body, dropped: false };
  const m = /^#\s+(.*)$/.exec(lines[first].trim());
  if (!m || m[1].trim() !== title) return { body, dropped: false };
  lines.splice(first, 1);
  return { body: lines.join('\n').replace(/^\n+/, ''), dropped: true };
}

/**
 * 摘要：优先 subtitle（写作协议要求它是真导语），压掉 markdown 记号后截到 120 字。
 * @param {string} raw
 * @returns {{ digest: string, truncated: boolean }}
 */
function buildDigest(raw) {
  const clean = (raw || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return { digest: '', truncated: false };
  if ([...clean].length <= DIGEST_MAX) return { digest: clean, truncated: false };
  return { digest: `${[...clean].slice(0, DIGEST_MAX - 1).join('')}…`, truncated: true };
}

/* ------------------------------------------------------------------ *
 * 3. 封面：webp → jpg（add_material 不收 webp，而 skill 的 material 通道不转码）
 * ------------------------------------------------------------------ */

/**
 * 解析封面源文件：优先 front matter cover，其次正文第一张图，且必须是本机可读文件。
 * @param {string} body 已改写路径的正文
 * @returns {string} 绝对路径
 */
function resolveCoverSource(body) {
  const cands = [];
  if (fm.cover) cands.push(fm.cover.startsWith('/') ? path.join(ROOT, fm.cover) : path.resolve(ROOT, fm.cover));
  const m = /!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(body);
  if (m) cands.push(m[1].startsWith('/') ? path.join(ROOT, m[1]) : path.resolve(ROOT, m[1]));
  for (const c of cands) {
    if (fs.existsSync(c) && fs.statSync(c).size > 0) return c;
    if (fs.existsSync(c)) warn(`封面是空文件，换下一个候选：${c}`);
  }
  die(
    `找不到可用封面（试过 ${cands.join(' → ') || '无'}）。news 类型草稿必须有 thumb_media_id，` +
      `而正文里没有可当封面的本地图。`,
  );
}

/**
 * ffmpeg 把任意位图转成 jpg，按 COVER_LADDER 递降压到体积线以内。
 * 本机已实测：cwebp 没编 libpng 读不了 PNG，sips 不能写 webp，ffmpeg 双向都行。
 * @param {string} src 源图绝对路径
 * @param {string} dest 目标 jpg 绝对路径
 * @returns {{ bytes: number, codec: string, attempt: object }}
 */
function transcodeCover(src, dest) {
  let last = null;
  for (const step of COVER_LADDER) {
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src];
    if (step.width) args.push('-vf', `scale='min(${step.width},iw)':-2`);
    args.push('-q:v', step.q, '-frames:v', '1', dest);
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    if (r.status !== 0) {
      last = { step, err: (r.stderr || '').trim().split('\n').pop() };
      continue;
    }
    const bytes = fs.statSync(dest).size;
    const probe = spawnSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', dest],
      { encoding: 'utf8' },
    );
    const codec = (probe.stdout || '').trim();
    last = { step, bytes, codec };
    if (codec === 'mjpeg' && bytes <= COVER_MAX_BYTES) return last;
    if (codec !== 'mjpeg') die(`封面转码产物不是 jpeg（${dest} → ${codec || '未知'}）`);
    log(`封面 ${bytes} 字节超过 ${COVER_MAX_BYTES}，按梯度再压一档`);
  }
  die(`封面转码失败：${src}（${last?.err || `产物 ${last?.bytes} 字节仍超线`}）`);
}

/* ------------------------------------------------------------------ *
 * 4. 防重复：按「文章正文 + 封面」的哈希记账
 * ------------------------------------------------------------------ */

/**
 * @returns {Record<string, { hash: string, mediaId?: string, title: string, syncedAt: string }>}
 */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * @param {object} state 写回 .wechat-sync/index.json
 */
function saveState(state) {
  fs.mkdirSync(STAGING, { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * 真跑需要的外部条件是否齐了。只报缺失，绝不打印任何密钥值。
 *
 * 为什么要有这一步：无人值守的写作任务可以直接调本脚本，但凭据与 IP 白名单由本人在
 * 微信后台与服务器上配。缺的时候脚本应该明确说「缺什么、配好后跑哪条」并以独立退出码收场，
 * 而不是把 SSH 隧道那层的英文报错甩给日志，更不能退化成自动去试 browser 方式。
 *
 * @returns {string[]} 缺失项；空数组代表就绪
 */
function missingPrereqs() {
  const miss = [];
  const extend = path.join(ROOT, '.baoyu-skills', 'baoyu-post-to-wechat', 'EXTEND.md');
  if (!fs.existsSync(extend)) {
    miss.push('缺 .baoyu-skills/baoyu-post-to-wechat/EXTEND.md（照 EXTEND.example.md 复制一份）');
  } else {
    const t = fs.readFileSync(extend, 'utf8');
    const val = (k) => {
      const m = new RegExp(`^${k}:[ \\t]*(.*)$`, 'm').exec(t);
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    };
    if (!val('remote_publish_host')) miss.push('EXTEND.md 的 remote_publish_host 还是空的（填那台主机的公网 IP）');
    if (!val('default_author')) miss.push('EXTEND.md 的 default_author 是空的（这篇要用「廖小新」署名）');
    const idf = val('remote_publish_identity_file');
    if (idf && !fs.existsSync(idf)) miss.push(`EXTEND.md 指定的私钥文件不存在：${idf}`);
  }
  // 两枚键都要有值才算就绪。早先这里在内层循环里 `return`，于是**任一**枚有值就报齐了：
  // 只写了 WECHAT_APP_ID 的 .env 会直接过检，真跑时才在微信侧报凭据错——而这一函数的职责
  // 正是把那种失败提前成一句人话。两个路径合起来收（项目内与 home 各写一枚也算齐）。
  const found = new Set();
  for (const env of [path.join(ROOT, '.baoyu-skills', '.env'), path.join(os.homedir(), '.baoyu-skills', '.env')]) {
    if (!fs.existsSync(env)) continue;
    const t = fs.readFileSync(env, 'utf8');
    for (const k of ['WECHAT_APP_ID', 'WECHAT_APP_SECRET']) {
      const m = new RegExp(`^${k}[ \\t]*=[ \\t]*(\\S*)`, 'm').exec(t);
      if (m && m[1]) found.add(k);
    }
  }
  if (found.size === 2) return miss;
  const lacking = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'].filter((k) => !found.has(k));
  miss.push(`没找到 ${lacking.join(' / ')}（写进 .baoyu-skills/.env 或 ~/.baoyu-skills/.env）`);
  return miss;
}

/* ------------------------------------------------------------------ *
 * 5. 主流程
 * ------------------------------------------------------------------ */

const theme = opt('theme') || 'default';
const author = opt('author');
const dryRun = flag('dry-run');

const rawBody = readBody(postFile);
const dropped = dropLeadingTitle(rawBody);
const images = rewriteImages(dropped.body);
const digestSource = fm.subtitle || fm.description || fm.summary;
const { digest, truncated } = buildDigest(digestSource);
// 报字数要报**真正被截断的那一份**。早先这里写死 [...fm.subtitle]，而上面那行是会回落到
// description／summary 的：没有 subtitle 的那一篇一旦走到截断分支就是 TypeError（不可迭代），
// 崩在一条本来只是想说「截断了」的日志上。
if (truncated) log(`摘要超过 ${DIGEST_MAX} 字，已截断（原文 ${[...(digestSource || '')].length} 字）`);
if (!digest) warn('没有 subtitle，摘要将交给 skill 取正文首段截断——公众号卡片看着会糙一点');

const coverSrc = resolveCoverSource(images.body);
const slugDir = path.join(STAGING, link.seg);
fs.rmSync(slugDir, { recursive: true, force: true });
fs.mkdirSync(slugDir, { recursive: true });

const coverJpg = path.join(slugDir, 'cover.jpg');
const coverInfo = transcodeCover(coverSrc, coverJpg);

// 暂存正文里出现的每个本地图片都必须在磁盘上，否则 skill 会在上传那步逐个抛错。
const missing = [...images.body.matchAll(/!\[[^\]]*\]\((\/[^)\s]+)/g)]
  .map((m) => m[1])
  .filter((p) => p.startsWith(`${ROOT}/`) && !fs.existsSync(p));
if (missing.length) die(`正文有 ${missing.length} 张图在磁盘上找不到：\n  ${missing.join('\n  ')}`);

const stagedMd = path.join(slugDir, 'article.md');
// 注意别用 .filter(Boolean) 收尾：末尾那个空元素是「闭合 --- 之后的换行」，
// 被 filter 吃掉就会写出 `---![图片]` 这种畸形 front matter（skill 侧靠正则容错才没炸）。
const fmLines = [
  '---',
  `title: "${title.replace(/"/g, "'")}"`,
  digest ? `description: "${digest.replace(/"/g, "'")}"` : null,
  author ? `author: "${author}"` : null,
  `cover: "${coverJpg}"`,
  `contentSourceUrl: "${link.url}"`,
  `date: ${date}`,
  '---',
  '',
].filter((l) => l !== null);
fs.writeFileSync(stagedMd, `${fmLines.join('\n')}${images.body}`, 'utf8');

const hash = crypto
  .createHash('sha256')
  .update(rawBody)
  .update(fs.readFileSync(coverSrc))
  .digest('hex')
  .slice(0, 16);

const state = loadState();
const prev = state[link.seg];
if (prev && prev.hash === hash && !flag('force')) {
  log(
    `${link.seg} 已同步过（${prev.syncedAt}${prev.mediaId ? `，media_id ${prev.mediaId}` : ''}），内容未变，跳过。要重来加 --force`,
  );
  process.exit(0);
}
if (prev && prev.hash !== hash) log(`${link.seg} 内容有变（${prev.hash} → ${hash}），这次会新建一条草稿，旧的那条要自己去草稿箱删`);

const cmd = [
  ...bunCmd(),
  apiScript,
  stagedMd,
  '--theme',
  theme,
  '--title',
  title,
  '--cover',
  coverJpg,
  '--source-url',
  link.url,
];
if (digest) cmd.push('--summary', digest);
if (author) cmd.push('--author', author);
if (flag('keep-links')) cmd.push('--no-cite');

log(`文章   ${path.relative(ROOT, postFile)}`);
log(`标题   ${title}`);
log(`摘要   ${[...digest].length ? `${[...digest].length} 字` : '（交给 skill 自动生成）'}`);
log(`作者   ${author || '（交给 EXTEND.md 的 default_author）'}`);
log(`封面   ${path.relative(ROOT, coverSrc)} → cover.jpg ${Math.round(coverInfo.bytes / 1024)}KB jpeg`);
log(`原文   ${link.url}`);
log(`正文   ${images.rewritten} 处图片路径改写，${dropped.dropped ? '首行重复标题已删' : '首行不是同名 H1，未动'}`);
log(`暂存   ${path.relative(ROOT, stagedMd)}`);

if (dryRun) {
  log('--dry-run：到此为止，没有联网、没有建草稿');
  log(`下一步真跑就是这条：${shq(cmd)}`);
  console.log(
    JSON.stringify(
      { ok: true, dryRun: true, seg: link.seg, stagedMd, coverJpg, permalink: link.url, digest, command: shq(cmd) },
      null,
      2,
    ),
  );
  process.exit(0);
}

// 走到这里就是「要真跑」。前置未齐时不碰网络、不试 browser 兜底，
// 只把缺什么和配好后该跑哪条说清楚，用 3 号退出码与真失败（1）区分开。
const missingCfg = missingPrereqs();
if (missingCfg.length) {
  warn('前置未齐，本次不建草稿：');
  for (const m of missingCfg) console.warn(`  · ${m}`);
  log(`配好后重跑这一条就行（暂存件已在 .wechat-sync/${link.seg}/）：${shq(cmd)}`);
  process.exit(3);
}

// 真跑前先让 skill 自己过一遍元信息（它的 --dry-run 不联网、不读凭据），
// 字段没对上就在这里报出来，不必等 SSH 隧道建起来才发现。
const b = bunCmd();
const preArgs = [
  ...b,
  apiScript,
  stagedMd,
  '--theme',
  theme,
  '--title',
  title,
  '--cover',
  coverJpg,
  '--dry-run',
];
const pre = spawnSync(preArgs[0], preArgs.slice(1), { cwd: ROOT, encoding: 'utf8' });
if (pre.status !== 0) {
  warn(`skill 侧预检没通过（多半是 bun 首次拉取失败），跳过预检继续真跑：${(pre.stderr || '').trim().split('\n').pop()}`);
} else {
  log('skill 侧预检通过：' + (pre.stdout || '').trim().replace(/\s+/g, ' ').slice(0, 200));
}

log('执行 skill：wechat-api.ts → cgi-bin/draft/add（只建草稿，不发表）');
const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
let stdout = '';
child.stdout.on('data', (b) => {
  stdout += b.toString();
  process.stdout.write(b);
});
child.on('exit', (code) => {
  if (code !== 0) {
    console.error(
      `[wechat-draft] ✗ 建草稿失败（exit ${code}）。常见原因：` +
        `\n  · errcode 40164：那台 SSH 主机的公网 IP 不在公众号 IP 白名单里` +
        `\n  · errcode 48001：账号没有草稿箱接口权限` +
        `\n  · Access token 相关：.baoyu-skills/.env 里的 WECHAT_APP_ID / WECHAT_APP_SECRET 不对` +
        `\n  · ssh exited early：EXTEND.md 的 remote_publish_host/user/identity_file 没填对`,
    );
    process.exit(code ?? 1);
  }
  let mediaId;
  try {
    mediaId = JSON.parse(stdout.slice(stdout.indexOf('{')))?.media_id;
  } catch {
    warn('没从输出里解析到 media_id（不影响草稿已建），要确认就去草稿箱看');
  }
  state[link.seg] = { hash, title, mediaId, syncedAt: new Date().toISOString().slice(0, 19) };
  saveState(state);
  log(`✓ 草稿已进箱${mediaId ? `（media_id ${mediaId}）` : ''}。发布请在 mp.weixin.qq.com「内容管理 → 草稿箱」里点。`);
});
