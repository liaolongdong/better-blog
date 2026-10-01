#!/usr/bin/env node
/**
 * 生成 `_data/modified.yml`：每篇文章**真实发生过内容修订**的时间。
 *
 * 为什么需要这个脚本（缺陷的来历）
 * ------------------------------------------------------------------
 * `_includes/seoMeta.html:153-168` 早就把口径写对了：取 `last_modified_at` 与
 * `updated` 末项的较新者，且「与发布同日视为未修订」→ 置 nil → `article:modified_time`
 * 与 JSON-LD 的 `dateModified` 一并不输出。那条注释里记着原因：早先直接
 * `page.last_modified_at | default: page.date`，而全仓 0 篇声明过这个字段，
 * 结果是 dateModified 恒等于 datePublished——那不是「没有更新信息」，
 * 是「伪造了一条更新信息」。
 *
 * 修好口径之后剩下的问题只是**没有数据源**：80 篇里 0 篇声明 `last_modified_at`。
 * 靠人往 front matter 里补是补不动的（它当初就是这么归零的），所以从 git 历史推导，
 * 产物入库。
 *
 * 为什么产物入库、而不是在 `_plugins` 里构建期调 git
 * ------------------------------------------------------------------
 * `.github/workflows/jekyll.yml:22` 用 `actions/checkout@v4` 且**未写 fetch-depth**，
 * 默认浅克隆 depth=1 —— 构建期根本拿不到历史。入库还有两个好处：可被门禁直接读，
 * 且每次重生成都体现在 diff 里，作者能一眼看出这一轮动了哪些篇。
 *
 * 指纹口径（诚实性的核心）
 * ------------------------------------------------------------------
 * 剥掉 front matter，正文做规范化后取 sha256：
 *   统一换行为 \n · 去行尾空白 · 折叠 3+ 连续空行为一个 · 去首尾空行
 *   · 剥掉图片地址的扩展名（只认 `![…](…)` 与 `<img src=…>` 两个位置）
 * 规范化后哈希相同 = 只改了空白、换行或图片编码 = **不算修订**。
 *
 * 图片那条同样有实测依据：`2548ae9`（2026-08-27）把三篇文章的 `banner.png` 改成
 * `banner.webp`，正文指纹每篇 +3 字符，读者看到的却是同一幅画面。它是 B2 的前置——
 * B2 要转码 23 张大 PNG，不剥扩展名，那一次提交会给 23 篇同时盖上新日期。
 * 剥的位置卡得死：换一张图（stem 变）、删图、加图、改 alt、正文里出现 `app.png`
 * 这个词、代码块里写 `a.png`、普通链接指向一个 .png，全都仍然算修订。
 *
 * 这条挡得住缩进、行尾空格、CRLF、空行增删这一类churn，但**挡不住 prettier 往
 * ```js 围栏里补分号**——那不是空白改动。本仓没有 prettier 配置、没有 husky、
 * 没有 lint-staged（已核），所以那个风险来自外部工具手动跑 `--write`，不是提交钩子。
 * 按 subject 过滤也不可靠：改过 _posts 的 336 个提交里有 `feat` / `docs` /
 * GitHub 网页编辑器的 `Update xxx.md` / 「修改」「合并」这类自由中文，
 * 而唯一那条 `style(post): 移除CSS样式中的!important声明` 其实是**真内容改动**。
 *
 * 所以真正的守卫是下面那两条，加上产物入库后每次都能在 diff 里被人看见。
 *
 * 批改不算修订
 * ------------------------------------------------------------------
 * 一个提交若碰了 ≥10 篇 `_posts`，判它是批改而不是修订，跳过它继续往回找。
 *
 * 这条不是假想防御，是实测出来的：`d1ecf84`（2026-09-22）一次改了 67 篇，做的是
 * 「把正文里与版面重复的 `# H1` 降成 `## H2`」——正文指纹因此每篇变动 1 到几十个字符，
 * 完全合法的**内容**变动，却不是作者对这篇文章的修订。不挡它，结果就是 67 篇文章
 * 同时申报 dateModified=2026-09-22，在引擎眼里与「全站集体假装翻新」无法区分，
 * 而 seoMeta.html 那段注释说得很清楚：那比不声明更伤新鲜度信号。
 *
 * 熔断器
 * ------------------------------------------------------------------
 * 与既有 yml 比对，若这一轮变动条数超过语料的 30%，拒绝写盘（除非 `--force`）。
 * 语义是「一次改动波及三成文章」——真实的修订潮不会长这样，全站格式化才会。
 * 首次生成没有基线可比，熔断器不触发（这也是为什么按 diff 算而不是按绝对条数算：
 * 十年语料里"曾经被改过"的比例本来就高，用绝对比例会误伤首次生成）。
 * 它挡的是**未来**某次 prettier 全站 `--write`，「批改不算修订」挡的是**历史**里已有的那几次。
 *
 * 用法
 * ------------------------------------------------------------------
 *   node scripts/build-modified-data.mjs            # 重算并写盘
 *   node scripts/build-modified-data.mjs --dry-run  # 只打印，不写盘
 *   node scripts/build-modified-data.mjs --verify   # 重算并与已入库的比对，漂移则 exit 1
 *   node scripts/build-modified-data.mjs --force    # 越过熔断器
 *
 * 失败一律响亮：浅克隆 / 非 git 目录 / git 不可用都 exit 非 0 并说明原因。
 * **绝不静默产出空表** —— 静默归零正是本缺陷现在的形态，不能用同一种方式修它。
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_data', 'modified.yml');
const POSTS_DIR = path.join(ROOT, '_posts');

/** 一轮变动超过语料这个比例就熔断。见文件头「熔断器」。 */
const CHURN_CEILING = 0.3;

/**
 * 一个提交碰了这么多篇 `_posts`，就判它是**批改**而不是修订，跳过它继续往回找。
 * 见文件头「批改不算修订」。
 *
 * 阈值取 10 是量出来的，不是拍的：本仓改过 _posts 的 336 个提交里，
 * `488641d feat: 编写函数式编程和AOP编程博客` 一次带 4 篇（2 篇新建 + 2 篇改），
 * 那是真实的写作提交；而 `d1ecf84` 带 67 篇、`dd0822b` 带 64 篇，
 * 内容分别是「把正文里与版面重复的 `# H1` 降成 `## H2`」与「补 seo_description /
 * 改写 18 处失效内链」——都是模板与元数据卫生，一次波及全语料。
 * 10 卡在两者之间，两侧都留了余量。
 */
const BATCH_POST_THRESHOLD = 10;

const argv = process.argv.slice(2);
const HAS = (f) => argv.includes(f);
const DRY = HAS('--dry-run');
const VERIFY = HAS('--verify');
const FORCE = HAS('--force');

const abs = (p) => path.join(ROOT, p);
const readText = (p) => fs.readFileSync(p, 'utf8');

/** 响亮地失败。见文件头「失败一律响亮」。 */
function die(msg, hint) {
    process.stderr.write(`\n[build-modified-data] ${msg}\n`);
    if (hint) process.stderr.write(`  → ${hint}\n`);
    process.stderr.write('  拒绝产出空表：静默归零正是这个缺陷现在的形态。\n\n');
    process.exit(1);
}

function git(args, opts = {}) {
    return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        ...opts,
    });
}

/* ------------------------------------------------------------------ *
 * 0. 前置检查：必须是全历史仓库
 * ------------------------------------------------------------------ */

function assertHistory() {
    try {
        git(['rev-parse', '--git-dir'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
        die('当前目录不是 git 仓库，拿不到修订历史。');
    }
    const shallow = git(['rev-parse', '--is-shallow-repository']).trim();
    if (shallow === 'true') {
        die(
            '这是浅克隆，历史不完整，推导出来的修订时间会偏新。',
            '先 `git fetch --unshallow`；CI 里不要跑这个脚本（产物是入库的，见文件头）。',
        );
    }
}

/* ------------------------------------------------------------------ *
 * 1. front matter 与 URL 推导
 *
 * 与 scripts/og-images.mjs 的 parseFm / postUrl 同口径。两处各写一份是刻意的：
 * 那个脚本管分享卡片、这个管修订时间，共享一个模块会让一边改动波及另一边，
 * 而这段逻辑本身只有十行。口径漂移由 --verify 与门禁⑤「表里的 url 必须真实存在」兜住。
 * ------------------------------------------------------------------ */

/**
 * 读一篇稿子的 front matter。只认「一行一个 key: value」的标量。
 * @param {string} file _posts/xxx.md 的绝对路径
 * @returns {Record<string, string>}
 */
function parseFm(file) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(readText(file));
    const out = {};
    if (!m) return out;
    for (const line of m[1].split(/\r?\n/)) {
        if (/^\s*(#|$)/.test(line)) continue;
        const kv = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
        if (!kv) continue;
        out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

/**
 * 拼 Jekyll 真正会发出的 URL。
 *
 * :year/:month/:day 取自 front matter 的 `date` 而非文件名——仓库里有存量文章
 * 两者不一致（`_posts/2020-06-06-linux-common-command.md` 实际落在 `/2021/03/23/`），
 * 拿文件名日期拼出来的键会全部对不上 Liquid 侧的 `post.url`。
 */
function postUrl(file, fm) {
    const seg = fm.slug || path.basename(file, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const [y, mo, da] = String(fm.date).slice(0, 10).split('-');
    return `/${y}/${mo}/${da}/${seg}.html`;
}

/* ------------------------------------------------------------------ *
 * 2. 正文指纹
 * ------------------------------------------------------------------ */

/**
 * 剥 front matter 并规范化正文。见文件头「指纹口径」。
 *
 * front matter 一律剥掉：补一个 seo_description 不是读者关心的内容修订，
 * 把它算进去会让每一轮 SEO 字段回填都伪装成全站翻新。
 *
 * 图片地址的扩展名也剥掉（只认 `![…](…)` 与 `<img src=…>` 两个位置）：
 * 同一张图从 .png 转成 .webp，读者看到的是同一幅画面。这条不是洁癖而是 B2 的前置——
 * B2 会把 23 张大 PNG 转码成 webp，不剥扩展名，那一次提交会给 23 篇同时盖上同一个
 * 新日期，正是「批改不算修订」要挡的那种集体假翻新。
 * 剥的位置卡得很死：正文里提到 `app.png` 这个词、代码块里写 `a.png`、普通链接指向
 * 一个 .png 文件，都原样保留；换成另一张图（stem 变了）、删图、加图、改 alt 也都还算修订。
 *
 * @param {string} md 整篇文件内容
 * @returns {string} 规范化后的正文
 */
const IMG_MD = /(!\[[^\]]*\]\(\s*<?[^)\s>]+?)\.(?:png|jpe?g|gif|webp|avif|svg)(?=[>\s)])/gi;
const IMG_TAG = /(<img\b[^>]*?\bsrc\s*=\s*["'][^"']+?)\.(?:png|jpe?g|gif|webp|avif|svg)(?=["'])/gi;

function normalizeBody(md) {
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(md);
    const body = m ? md.slice(m[0].length) : md;
    return body
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(IMG_MD, '$1')
        .replace(IMG_TAG, '$1')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');
}

const fingerprint = (md) =>
    crypto.createHash('sha256').update(normalizeBody(md), 'utf8').digest('hex');

/** 取某个提交上这个文件的内容。文件在该提交不存在时返回 null。 */
function contentAt(sha, relPath) {
    try {
        return git(['show', `${sha}:${relPath}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
        return null;
    }
}

/**
 * 这个提交碰了多少篇 `_posts`。按 sha 缓存：一次批改会同时出现在几十篇的历史里，
 * 不缓存就要为同一笔提交重复问 git 几十次。
 * @type {Map<string, number>}
 */
const batchCache = new Map();
function postsTouchedBy(sha) {
    if (batchCache.has(sha)) return batchCache.get(sha);
    const n = git(['show', '--name-only', '--format=', sha])
        .split('\n')
        .filter((l) => l.startsWith('_posts/') && l.endsWith('.md')).length;
    batchCache.set(sha, n);
    return n;
}

/* ------------------------------------------------------------------ *
 * 3. 逐篇推导
 * ------------------------------------------------------------------ */

/**
 * 找「最近一次真的改了内容」的那个提交。
 *
 * 从最新往回走，比对相邻两个提交上的正文指纹。第一处**且非批改**的不同就是答案：
 * 指纹不同说明正文真的变了，`postsTouchedBy < BATCH_POST_THRESHOLD` 说明这是
 * 针对这篇文章的修订而不是一次波及全语料的机械pass（见文件头「批改不算修订」）。
 * 批改被跳过之后继续往回找——它不该让一篇 2017 年的文章申报昨天的修订时间，
 * 但它也不该把更早的真实修订一起遮掉。
 *
 * 全部相同、或只剩批改（这篇自创建以来没被单独修订过）→ 返回 null，
 * 让 dateModified 缺席，而不是拿发布日期冒充。
 *
 * @param {string} relPath 相对仓库根的路径，如 `_posts/xxx.md`
 * @returns {{at:string, commit:string, charsDelta:number, batchSkipped:number}|null}
 */
function lastRealChange(relPath) {
    // --follow：仓库里有 `chore(blog): 更改文件名称` 这类改名提交，不跟随就会断链。
    // %x09 = TAB，subject 放最后一段（它自己可能含 TAB 之外的任意字符）。
    const raw = git(['log', '--follow', '--format=%H%x09%cI%x09%s', '--', relPath]);
    const commits = raw
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
            const [sha, at, ...rest] = l.split('\t');
            return { sha, at, subject: rest.join('\t') };
        }); // git log 是「新 → 旧」

    if (commits.length < 2) return null; // 只有一次提交 = 创建，之后没改过

    let batchSkipped = 0;
    for (let i = 0; i < commits.length - 1; i++) {
        const cur = commits[i];
        const prev = commits[i + 1];
        const curContent = contentAt(cur.sha, relPath);
        // 这一提交上文件不在该路径（改名前的旧路径），--follow 已经把历史接上了，
        // 换下一对继续比即可，不在这里下结论。
        if (curContent === null) continue;
        const prevContent = contentAt(prev.sha, relPath);
        if (prevContent === null) continue;
        if (fingerprint(curContent) === fingerprint(prevContent)) continue; // 只有空白/换行变动

        const touched = postsTouchedBy(cur.sha);
        if (touched >= BATCH_POST_THRESHOLD) {
            batchSkipped++;
            continue;
        }
        return {
            at: cur.at,
            commit: cur.sha.slice(0, 7),
            charsDelta: normalizeBody(curContent).length - normalizeBody(prevContent).length,
            batchSkipped,
        };
    }
    return batchSkipped ? { at: null, commit: null, charsDelta: 0, batchSkipped } : null;
}

function collect() {
    const now = new Date();
    const entries = new Map();
    const skipped = [];
    const files = fs.readdirSync(POSTS_DIR).filter((x) => x.endsWith('.md')).sort();
    let batchOnly = 0;

    for (const f of files) {
        const relPath = path.posix.join('_posts', f);
        const file = abs(relPath);
        const fm = parseFm(file);

        if (!fm.date || !fm.title) {
            skipped.push({ file: f, why: !fm.date ? '无 date' : '无 title' });
            continue;
        }
        const day = String(fm.date).slice(0, 10);
        if (new Date(`${day}T00:00:00`) > now) {
            // Jekyll 默认 future: false，这种稿子压根不会被构建，给它算修订时间没有消费点。
            skipped.push({ file: f, why: `date ${day} 在未来，Jekyll 不会构建它` });
            continue;
        }

        const url = postUrl(file, fm);
        const change = lastRealChange(relPath);
        if (!change) {
            skipped.push({ file: f, why: '正文指纹自创建以来未变（只有空白/换行变动或从未改过）' });
            continue;
        }
        if (change.at === null) {
            // 正文确实变过，但每一笔都是波及全语料的批改，没有一笔是针对这篇的修订。
            batchOnly++;
            skipped.push({
                file: f,
                why: `只有批改、没有单独修订（跳过 ${change.batchSkipped} 笔 ≥${BATCH_POST_THRESHOLD} 篇的提交）`,
            });
            continue;
        }
        // 修订时间早于或等于发布日 → 交给 seoMeta.html:164-168 那道既有守卫去置 nil，
        // 这里不提前过滤：那道守卫的口径是「同日视为未修订」，两边保持一致才好推理。
        entries.set(url, {
            at: change.at,
            commit: change.commit,
            chars_delta: change.charsDelta,
            published: day,
        });
    }
    return { entries, skipped, total: files.length, batchOnly };
}

/* ------------------------------------------------------------------ *
 * 4. 读写 yml
 * ------------------------------------------------------------------ */

/** 读已入库的表。不存在时返回空表（首次生成）。 */
function readExisting() {
    if (!fs.existsSync(OUT)) return new Map();
    const out = new Map();
    let url = null;
    for (const line of readText(OUT).split('\n')) {
        if (/^#/.test(line) || !line.trim()) continue;
        const top = /^"(.+)":\s*$/.exec(line);
        if (top) {
            url = top[1];
            out.set(url, {});
            continue;
        }
        const kv = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
        if (kv && url) out.get(url)[kv[1]] = kv[2].replace(/^"|"$/g, '');
    }
    return out;
}

/** 序列化。键排序，产物可复现、diff 稳定。 */
function serialize(entries) {
    const lines = [
        '# 每篇文章「真实发生过内容修订」的时间。由 scripts/build-modified-data.mjs 生成，',
        '# **不要手改**：改了下次重算就被覆盖，而且 --verify 会当场判红。',
        '#',
        '# 消费点（口径只有一份，在 _includes/pageModified.html 里；下面三处都读它算出的 page_modified）：',
        '#   _includes/seoMeta.html   → <meta property="article:modified_time">',
        '#   _includes/jsonLd.html    → BlogPosting.dateModified（直接读 seoMeta 跨出来的 page_modified）',
        '#   sitemap.xml              → 文章 <lastmod>（推不出真值时退回 post.date，那时两者相等是真的）',
        '#',
        '# 字段：',
        '#   at           修订提交的 committer 时间（ISO 8601 带时区）',
        '#   commit       修订提交的短 sha，便于 `git show` 复核',
        '#   chars_delta  规范化后正文的字符增减，用来一眼分辨「改了个错别字」与「整段重写」',
        '#   published    该篇的发布日（front matter date 的日期部分）',
        '#',
        '# 缺条目 = 这篇没有可申报的修订，`dateModified` 与 `article:modified_time` 一并不输出。',
        '# 缺席比伪造好：引擎能看出 dateModified == datePublished，长期等于反复申报零翻新。',
        '# 口径与推导方式见脚本文件头，以及 _docs/superpowers/specs/2026-10-02-seo-aeo-structure-design.md §4。',
        '',
    ];
    for (const url of [...entries.keys()].sort()) {
        const e = entries.get(url);
        lines.push(`"${url}":`);
        lines.push(`  at: "${e.at}"`);
        lines.push(`  commit: ${e.commit}`);
        lines.push(`  chars_delta: ${e.chars_delta >= 0 ? '+' : ''}${e.chars_delta}`);
        lines.push(`  published: "${e.published}"`);
    }
    return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ *
 * 5. 主流程
 * ------------------------------------------------------------------ */

function main() {
    assertHistory();

    const { entries, skipped, total } = collect();
    const existing = readExisting();

    // 熔断器：这一轮变动了多少条（新增 + at/commit 变了）。见文件头。
    let churn = 0;
    for (const [url, e] of entries) {
        const old = existing.get(url);
        if (!old || old.at !== e.at || old.commit !== e.commit) churn++;
    }
    for (const url of existing.keys()) if (!entries.has(url)) churn++;
    const churnRatio = total ? churn / total : 0;

    process.stdout.write(
        `[build-modified-data] 语料 ${total} 篇 → 有可申报修订 ${entries.size} 篇，` +
            `跳过 ${skipped.length} 篇；本轮变动 ${churn} 条（${(churnRatio * 100).toFixed(1)}%）\n`,
    );

    if (existing.size && churnRatio > CHURN_CEILING && !FORCE) {
        process.stderr.write(
            `\n[build-modified-data] 熔断：一轮变动 ${(churnRatio * 100).toFixed(1)}% 的语料，` +
                `超过 ${(CHURN_CEILING * 100).toFixed(0)}% 上限。\n` +
                '  这看起来像一次全站格式化（prettier 重排 ```js 围栏会补分号，那不是空白改动，\n' +
                '  指纹挡不住），不是一次内容修订潮。已向搜索引擎集体报假新鲜度的代价比漏报大。\n' +
                '  确认过确实是真的修订潮，再加 --force。\n\n',
        );
        process.exit(2);
    }

    const text = serialize(entries);

    if (VERIFY) {
        const disk = fs.existsSync(OUT) ? readText(OUT) : '';
        if (disk !== text) {
            process.stderr.write(
                '\n[build-modified-data] --verify 失败：_data/modified.yml 与 git 历史推导的结果不一致（表已腐烂）。\n' +
                    '  → 跑 `node scripts/build-modified-data.mjs` 重新生成并提交。\n\n',
            );
            process.exit(1);
        }
        process.stdout.write('[build-modified-data] --verify 通过：入库表与 git 历史一致。\n');
        return;
    }

    if (DRY) {
        process.stdout.write('\n--- dry-run，未写盘 ---\n' + text);
        return;
    }

    fs.writeFileSync(OUT, text);
    process.stdout.write(`[build-modified-data] 已写 ${path.relative(ROOT, OUT)}（${Buffer.byteLength(text)} B）\n`);

    const suspicious = skipped.filter((s) => s.why.startsWith('正文指纹'));
    if (suspicious.length) {
        process.stdout.write(`  其中 ${suspicious.length} 篇是「只有空白/换行变动」被排除的，抽样：\n`);
        for (const s of suspicious.slice(0, 5)) process.stdout.write(`    · ${s.file}\n`);
    }
}

main();
