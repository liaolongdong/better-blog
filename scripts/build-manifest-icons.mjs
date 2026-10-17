#!/usr/bin/env node
/**
 * 把 favicon.svg 光栅化成 PWA 安装面要的三枚 PNG（180 / 192 / 512），并维护 _data/manifestIcons.yml。
 *
 * 为什么要有这个脚本：manifest 与 iOS 主屏图标只认位图，而站点的标识是矢量
 * （favicon.svg，墨底圆角方块 + 衬线 B）。本机 sips 不认 SVG、无 imagemagick / rsvg，
 * 唯一能真排版的路是 headless Chrome —— scripts/og-images.mjs 已经证明过这条，
 * 这里复用它找 Chrome 的手法，但截图走最朴素的 `--screenshot`：
 * 只需要「起浏览器、等文件落盘、收尸」三件事，不值得再牵一套 CDP。
 *
 * 为什么产物入库、构建期不出图：GitHub Pages 的构建镜像里没有 Chrome，
 * 与 og-images.mjs 同一条理由。图标一年动不了一次，入库 + --check 防漂移是划算的那头。
 *
 * 两个实测过的坑，别改回去：
 *   · `--headless=new` 与 `--headless` 在写完 --screenshot 之后都**不会自己退出**
 *     （本机实测两种模式都要外部 kill，日志里停在 CVDisplayLink 那一串）。
 *     所以这里的设计是「轮询等产物落盘且字节稳定 → 杀整组进程」，watchdog 是方案不是意外。
 *   · SVG 不能走 data: URI 内联进 <img>：# 与引号的转义稍有不慎就是一枚破图占位符，
 *     而 PNG 的尺寸、字节、sha256 全都「正常」——只有打开看才知道是白的。
 *     直接把 SVG 标记内联进页面才稳。
 *
 * 用法：
 *   node scripts/build-manifest-icons.mjs            重画三枚并刷新 _data/manifestIcons.yml
 *   node scripts/build-manifest-icons.mjs --check    只校验并以非零码报告问题，不写任何文件、不启浏览器
 *
 * --check 抓三类漂移：favicon.svg 改了没重画（source_sha256 对不上）、
 * 入库的 PNG 被改坏或截断（bytes / sha256 对不上）、尺寸不是声明的那三档（读 IHDR）。
 * 三类都不会在构建期报错，只会让安装面静默变丑，所以必须有一道不启浏览器也能跑的门。
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_REL = 'favicon.svg';
const OUT_DIR = 'assets/img/icons';
const MANIFEST_REL = '_data/manifestIcons.yml';

/** 180 只服务 iOS 主屏（apple-touch-icon），不进 manifest 的 icons 数组。 */
const SIZES = [
    { px: 180, use: 'apple-touch' },
    { px: 192, use: 'manifest' },
    { px: 512, use: 'manifest' },
];

const SHOT_TIMEOUT_MS = 40_000;
const POLL_MS = 150;

const HAS_CHECK = process.argv.includes('--check');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function die(msg) {
    console.error(`✗ build-manifest-icons: ${msg}`);
    process.exit(1);
}

/* ------------------------------------------------------------------ *
 * headless Chrome
 * ------------------------------------------------------------------ */

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

function findChrome() {
    for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
    die('找不到 Chrome，请设置 CHROME_PATH 指向可执行文件');
}

/**
 * 把 SVG 标记直接内联进一页只有它的文档。
 * 用 CSS 覆写 svg 的 width/height（源文件写死 64×64，viewBox 会跟着缩放）。
 * 背景留透明：墨底圆角方块之外的四角必须透，装到 Android 自适应图标里才不糊一块白。
 */
function wrapHtml(svg, px) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${px}px;height:${px}px;overflow:hidden;background:transparent}
svg{display:block;width:${px}px;height:${px}px}
</style></head><body>${svg}</body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 起 Chrome 截一张图；等文件落盘且字节稳定后杀整组进程。超时即失败，绝不静默。 */
async function shoot(chrome, htmlPath, outPath, px) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-icons-'));
    const proc = spawn(
        chrome,
        [
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            '--force-device-scale-factor=1',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-background-networking',
            '--default-background-color=00000000',
            `--user-data-dir=${profile}`,
            `--window-size=${px},${px}`,
            `--screenshot=${outPath}`,
            `file://${htmlPath}`,
        ],
        { stdio: 'ignore', detached: true }
    );
    const killAll = () => {
        try {
            process.kill(-proc.pid, 'SIGKILL');
        } catch {
            try {
                proc.kill('SIGKILL');
            } catch {
                /* 已经退了 */
            }
        }
    };
    const deadline = Date.now() + SHOT_TIMEOUT_MS;
    let last = -1;
    try {
        while (Date.now() < deadline) {
            if (fs.existsSync(outPath)) {
                const size = fs.statSync(outPath).size;
                if (size > 0 && size === last) return; // 连续两轮同字节 = 写完了
                last = size;
            } else if (proc.exitCode !== null) {
                // 它自己退了却没留下文件（不认的后缀、参数写错、沙箱拒读……）：再等满 40 秒只是把
                // 一次快失败伪装成一次挂死。stdio 是 'ignore'，它那句原因我们收不到，所以这里
                // 只报"退出码 + 文件不在"这两件事实，不替它编原因。
                throw new Error(`${px}px 那发的 Chrome 已退出（码 ${proc.exitCode}）而 ${outPath} 不在：这一发是它自己拒的，不是慢`);
            }
            await sleep(POLL_MS);
        }
        // 抛，而不是 `die()`：`process.exit()` 在那一句就走人，下面那发 `finally` 根本轮不到——
        // 而 Chrome 是 `detached` 起的**进程组**，没被 SIGKILL 的它会在超时后一直挂着，
        // 连带那棵 `--user-data-dir` 临时目录一起留在 /tmp 里。抛出交给 `main().catch` 去打印退场。
        throw new Error(`${px}px 截图 ${SHOT_TIMEOUT_MS / 1000}s 内没落盘（${outPath}）`);
    } finally {
        killAll();
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

function pngDims(buf) {
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) die('产物不是 PNG（签名不对）');
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] };
}

/* ------------------------------------------------------------------ *
 * _data/manifestIcons.yml
 * ------------------------------------------------------------------ */

function serializeYml(source, sourceHash, icons) {
    const lines = [
        '# 安装面图标（manifest + iOS 主屏）的取值表。',
        '# 由 scripts/build-manifest-icons.mjs 生成，请勿手改：改了 favicon.svg 之后',
        '# 跑 `node scripts/build-manifest-icons.mjs` 重画并刷新这张表，--check 会揪出没刷新的提交。',
        '# manifest.json 与 head.html 的 apple-touch-icon 都从这里取地址，不在第二处写死路径。',
        `source: ${source}`,
        `source_sha256: ${sourceHash}`,
        'icons:',
    ];
    for (const ic of icons) {
        lines.push(`  - path: ${ic.path}`);
        lines.push(`    sizes: ${ic.sizes}`);
        lines.push(`    use: ${ic.use}`);
        lines.push(`    bytes: ${ic.bytes}`);
        lines.push(`    sha256: ${ic.sha256}`);
    }
    return lines.join('\n') + '\n';
}

function parseYml(txt) {
    const out = { icons: [] };
    let cur = null;
    for (const raw of txt.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.startsWith('#')) continue;
        // 列表项的首个键写成「- key: val」，先把那个破折号剥掉再按普通键值读
        const m = /^(\s*)(?:-\s+)?([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
        if (!m) continue;
        const [, indent, key, val] = m;
        const isItemHead = /^(\s*)-\s+/.test(line);
        if (indent === '' && !isItemHead) {
            if (key === 'icons') continue;
            out[key] = val;
        } else if (isItemHead) {
            cur = { [key]: key === 'bytes' ? Number(val) : val };
            out.icons.push(cur);
        } else if (cur) {
            cur[key] = key === 'bytes' ? Number(val) : val;
        }
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * --check：不启浏览器、不写文件
 * ------------------------------------------------------------------ */

function check() {
    const bad = [];
    const ymlPath = path.join(ROOT, MANIFEST_REL);
    if (!fs.existsSync(ymlPath)) die('--check: 没有 _data/manifestIcons.yml，先跑一次生成');
    const rec = parseYml(fs.readFileSync(ymlPath, 'utf8'));

    const srcPath = path.join(ROOT, SRC_REL);
    if (!fs.existsSync(srcPath)) bad.push(`源文件 ${SRC_REL} 不在`);
    else {
        const h = sha256(fs.readFileSync(srcPath));
        if (h !== rec.source_sha256) {
            bad.push(`favicon.svg 的 sha256 是 ${h.slice(0, 12)}…，表里记的是 ${String(rec.source_sha256).slice(0, 12)}…` +
                ' —— 标识改了没重画图标，安装面还是旧的那枚');
        }
    }

    const want = new Set(SIZES.map((s) => `${s.px}x${s.px}`));
    const got = new Set(rec.icons.map((i) => i.sizes));
    for (const w of want) if (!got.has(w)) bad.push(`表里缺 ${w} 这一档`);
    for (const g of got) if (!want.has(g)) bad.push(`表里多出 ${g} 这一档，与脚本声明的三档不符`);

    for (const ic of rec.icons) {
        const p = path.join(ROOT, ic.path.replace(/^\//, ''));
        if (!fs.existsSync(p)) {
            bad.push(`${ic.path} 不在磁盘上`);
            continue;
        }
        const buf = fs.readFileSync(p);
        if (buf.length !== ic.bytes) bad.push(`${ic.path} 字节数 ${buf.length} ≠ 表里的 ${ic.bytes}`);
        const h = sha256(buf);
        if (h !== ic.sha256) bad.push(`${ic.path} 的 sha256 与表里不符 —— 入库的位图被改过或截断`);
        const [sw, sh] = String(ic.sizes).split('x').map(Number);
        const d = pngDims(buf);
        if (d.w !== sw || d.h !== sh) bad.push(`${ic.path} 的 IHDR 是 ${d.w}x${d.h}，声明却是 ${ic.sizes}`);
        if (d.colorType !== 6) bad.push(`${ic.path} 的 colortype 是 ${d.colorType}，不是 6（RGBA）——四角不透会糊一块白`);
    }

    if (bad.length) {
        for (const b of bad) console.error(`  ✗ ${b}`);
        console.error(`✗ 安装面图标自检：${bad.length} 条红`);
        process.exit(1);
    }
    console.log(`✓ 安装面图标自检通过：${rec.icons.length} 枚，源 ${SRC_REL}@${String(rec.source_sha256).slice(0, 12)}…`);
}

/* ------------------------------------------------------------------ *
 * 生成
 * ------------------------------------------------------------------ */

async function main() {
    if (HAS_CHECK) return check();

    const svg = fs.readFileSync(path.join(ROOT, SRC_REL), 'utf8');
    const sourceHash = sha256(Buffer.from(svg, 'utf8'));
    const chrome = findChrome();
    const outDir = path.join(ROOT, OUT_DIR);
    fs.mkdirSync(outDir, { recursive: true });

    const icons = [];
    for (const { px, use } of SIZES) {
        const html = path.join(os.tmpdir(), `manifest-icon-${px}.html`);
        const out = path.join(outDir, `icon-${px}.png`);
        // 先落到一枚暂存名，**校验通过才写回正式名**：旧写法是先 `rmSync(out)` 再截图，于是
        // 超时 / IHDR 不符 / Chrome 起不来这三条路都会把仓库里那枚好图标删掉却留不下新的——
        // `--check` 那道门读的是 `_data/manifestIcons.yml` 里的 sha256，表没被改写，所以它红的是
        // "图标不在磁盘上"，而真正丢掉的东西是上一次构建的产物。暂存名必须以 `.png` 收尾：
        // Chrome 的 `--screenshot` 按后缀挑编码器，给它 `.png.staged` 它当场拒（"Unsupported
        // screenshot image file type"），这一坑是 2026-10-17 实测撞出来的。它也从不存在（下面先 rm
        // 一次），所以"截图没落盘"照样抛 ENOENT，绝不会把旧图当新图签收。
        const staged = path.join(outDir, `icon-${px}.staged.png`);
        fs.writeFileSync(html, wrapHtml(svg, px), 'utf8');
        fs.rmSync(staged, { force: true });
        let buf;
        try {
            await shoot(chrome, html, staged, px);
            buf = fs.readFileSync(staged);
        } finally {
            fs.rmSync(html, { force: true });
            fs.rmSync(staged, { force: true });
        }
        const d = pngDims(buf);
        if (d.w !== px || d.h !== px) die(`${px}px 那枚的 IHDR 是 ${d.w}x${d.h}`);
        fs.writeFileSync(out, buf);
        icons.push({
            path: `/${OUT_DIR}/icon-${px}.png`,
            sizes: `${px}x${px}`,
            use,
            bytes: buf.length,
            sha256: sha256(buf),
        });
        console.log(`  ${px}x${px}  ${String(buf.length).padStart(6)} B  ${OUT_DIR}/icon-${px}.png`);
    }

    fs.writeFileSync(path.join(ROOT, MANIFEST_REL), serializeYml(SRC_REL, sourceHash, icons), 'utf8');
    console.log(`✓ 已刷新 ${MANIFEST_REL}（源 ${SRC_REL}@${sourceHash.slice(0, 12)}…）`);
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
