/**
 * 大图 PNG → webp 转码（设计文档 §B2 的转码那一半）。
 *
 * 为什么只转 >512KB 的那一批：§1 的分布显示 23 张 >512KB 的 png 占了图片字节的大头，
 * 只转它们就拿到绝大部分收益，blast radius 比全量 125 张小一个数量级。
 * 阈值写成常量而不是参数：这是一条**测量出来的线**，不是旋钮；真要动它，
 * 先重跑 §1 的分布再改这里。
 *
 * 为什么编码器是 ffmpeg 的 libwebp 而不是 cwebp：本机的 cwebp 1.5.0 编译时没带
 * libpng（`cwebp x.png` 直接报 "PNG support not compiled"），而 ffmpeg 的 libwebp
 * 就是同一个编码器库。CI 不跑本脚本（.github/workflows/jekyll.yml 只有 vite + jekyll），
 * webp 是**入库产物**，所以编码器只影响「谁再生成」，不影响线上字节。
 *
 * 为什么产物是同名兄弟文件（x.png → x.webp）而不是子目录：构建期那个换 src 的滤镜
 * （_plugins/image_dims.rb）只做一个「把 .png 换成同目录 .webp，如果它存在」的判断，
 * 兄弟文件让这个判断不需要任何台账；23 张里实测 0 张已有 .webp 兄弟，不会撞车。
 *
 * 增量口径：scripts/image-variants.json 以 png 的 sha256 为键。sha 没变且 webp 还在
 * 就跳过——转码是 CPU 重的活（7MB 那张要几十秒），不该每次构建重跑。
 * 这份台账入库，`--check` 模式纯读盘对账（不需要 ffmpeg），是门禁那一半的判据来源。
 *
 * 三个排除项，都是结论不是遗漏：
 *   · assets/img/og/ —— 分享卡，og:image 的格式兼容性比字节重要，png 是稳的那一档；
 *   · 没有任何源文件引用的 png（实测 ai-sdd/banner-{2,4,5}.png 三张共 ~4.9MB）——
 *     转了也没有消费点，只会在仓库里多三枚死 webp；
 *   · 转完不比 png 小的（截图类几乎不可能，但守卫必须有：滤镜是「有 webp 就换」，
 *     一枚更大的 webp 会被静默换成负收益）。这一档在台账里记 skip: no-gain，不产文件。
 *
 * 用法：node scripts/build-image-variants.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MANIFEST = path.join(ROOT, 'scripts', 'image-variants.json');
const SIZE_FLOOR = 512 * 1024;
const EXCLUDE_DIR = 'assets/img/og/';
// 编码参数只在这一格写一遍，ENCODER 由它现算：原先两处各写一份，改参数的人只要忘了改
// 字符串那一格，--check 就会对着旧参数自证（台账里那一栏仍是旧串，判据全绿），而
// --check 正是这一层唯一那道门。现在改任何一个数字，台账那一栏必然对不上并红出来。
const WEBP_ARGS = ['libwebp', '-quality', '82', '-compression_level', '6', '-preset', 'drawing'];
const ENCODER = `ffmpeg ${WEBP_ARGS.join(' ')}`;

/** 源文件扫描面：引用只可能出现在这四类里（正文、数据、布局、include）。 */
const REF_GLOBS = [
  ['_posts', (f) => f.endsWith('.md')],
  ['_data', (f) => f.endsWith('.yml')],
  ['_layouts', (f) => f.endsWith('.html')],
  ['_includes', (f) => f.endsWith('.html')],
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir, keep, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, keep, out);
    else if (keep(e.name)) out.push(rel);
  }
  return out;
}

/** @returns {Set<string>} 被至少一个源文件引用的 png 相对路径（/assets/... 或裸文件名两种写法都认） */
function referencedPngs(candidates) {
  const sources = REF_GLOBS.flatMap(([dir, keep]) => walk(dir, keep)).map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const joined = sources.join('\n');
  return new Set(
    candidates.filter((rel) => {
      const bare = path.posix.basename(rel);
      return joined.includes(`/${rel}`) || joined.includes(bare);
    }),
  );
}

function candidates() {
  return walk('assets', (f) => f.endsWith('.png'))
    .filter((rel) => !rel.startsWith(EXCLUDE_DIR))
    .filter((rel) => fs.statSync(path.join(ROOT, rel)).size > SIZE_FLOOR)
    .sort();
}

function encode(pngRel, webpAbs) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(ROOT, pngRel), '-c:v', ...WEBP_ARGS, webpAbs], { stdio: 'pipe' });
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return { encoder: ENCODER, variants: {} };
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (m.encoder !== ENCODER) {
    // 编码器参数变了 = 全部产物作废重转，留着旧台账只会让 --check 对着旧参数自证
    return { encoder: ENCODER, variants: {} };
  }
  return m;
}

function build() {
  const cand = candidates();
  const referenced = referencedPngs(cand);
  const dead = cand.filter((rel) => !referenced.has(rel));
  const manifest = loadManifest();
  let converted = 0,
    skipped = 0,
    nogain = 0;

  for (const rel of cand) {
    if (!referenced.has(rel)) continue;
    const pngAbs = path.join(ROOT, rel);
    const webpRel = rel.replace(/\.png$/, '.webp');
    const webpAbs = path.join(ROOT, webpRel);
    const sum = sha256(pngAbs);
    const prev = manifest.variants[rel];
    if (prev && prev.sha256 === sum && prev.skip !== 'no-gain' && fs.existsSync(webpAbs)) {
      skipped += 1;
      continue;
    }
    encode(rel, webpAbs);
    const pngBytes = fs.statSync(pngAbs).size;
    const webpBytes = fs.statSync(webpAbs).size;
    if (webpBytes >= pngBytes) {
      fs.rmSync(webpAbs);
      manifest.variants[rel] = { sha256: sum, skip: 'no-gain', pngBytes };
      nogain += 1;
      continue;
    }
    manifest.variants[rel] = { sha256: sum, webp: webpRel, pngBytes, webpBytes };
    converted += 1;
    console.log(`  ${rel}  ${(pngBytes / 1024).toFixed(0)}KB → ${(webpBytes / 1024).toFixed(0)}KB`);
  }

  for (const key of Object.keys(manifest.variants)) {
    if (!cand.includes(key)) delete manifest.variants[key]; // 阈值/引用面变了，旧条目不留尸
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`转 ${converted}，未变跳过 ${skipped}，无收益 ${nogain}，死资产不转 ${dead.length}` + (dead.length ? `：${dead.join(', ')}` : ''));
}

function check() {
  const fails = [];
  const bad = (m) => fails.push(m);
  const manifest = loadManifest();
  const cand = candidates();
  const referenced = referencedPngs(cand);

  // 编码器那一栏的比对必须在 loadManifest 之外做：参数一变它就把台账当作废返回
  // { variants: {} }，于是这里读到的 encoder 永远等于脚本常量，判据成了死码。
  // 不单独报的话，参数改动会表现成 20 条「有 webp 兄弟却不在台账里」，指错方向。
  const raw = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { encoder: ENCODER };
  if (raw.encoder !== ENCODER) {
    bad(`台账编码器「${raw.encoder}」与脚本「${ENCODER}」不符（参数变了即全部作废，重跑不带 --check 的那条命令）`);
  }

  // 空集必须红出来，不能让「下面每一判都没有循环对象」冒充全绿：
  // 阈值写成 0 以上的大数、排除目录写成 ''（`!rel.startsWith('')` 恒真）、REF_GLOBS 少一项，
  // 三种写法都会让对账整块静默空转，而台账里明明还躺着条目。
  if (Object.keys(manifest.variants).length && !cand.length) {
    bad(`候选清单是空的（assets 下大于 ${SIZE_FLOOR / 1024}KB、且不在 ${EXCLUDE_DIR || '(空排除目录)'} 的 png 一枚都没扫到），而台账里有 ${Object.keys(manifest.variants).length} 条——阈值或排除目录被写坏了，这一层的对账此刻一条都没跑`);
  } else if (cand.length && !referenced.size) {
    bad(`${cand.length} 枚候选里没有一枚被引用（扫描面 ${REF_GLOBS.map(([d]) => d).join('/')}），台账却要靠引用关系才成立——这一层的对账此刻一条都没跑`);
  }

  for (const rel of cand) {
    if (!referenced.has(rel)) continue;
    const entry = manifest.variants[rel];
    const webpAbs = path.join(ROOT, rel.replace(/\.png$/, '.webp'));
    if (!entry) {
      if (fs.existsSync(webpAbs)) bad(`${rel} 有 webp 兄弟却不在台账里（滤镜会静默换过去）`);
      else bad(`${rel} 是候选却不在台账里（没转也没记 no-gain）`);
      continue;
    }
    if (entry.sha256 !== sha256(path.join(ROOT, rel))) bad(`${rel} 的 sha256 与台账不符（png 改过没重转）`);
    if (entry.skip === 'no-gain') {
      if (fs.existsSync(webpAbs)) bad(`${rel} 记着 no-gain 却有 webp 文件`);
      continue;
    }
    if (!fs.existsSync(webpAbs)) bad(`${rel} 台账记着 webp 但文件不在`);
    else if (fs.statSync(webpAbs).size !== entry.webpBytes) bad(`${rel} 的 webp 字节与台账不符`);
    else if (entry.webpBytes >= entry.pngBytes) bad(`${rel} 的 webp 不比 png 小`);
  }
  for (const key of Object.keys(manifest.variants)) {
    if (!fs.existsSync(path.join(ROOT, key))) bad(`台账里的 ${key} 在磁盘上不存在`);
  }

  const total = Object.values(manifest.variants)
    .filter((v) => v.webpBytes)
    .reduce((s, v) => s + (v.pngBytes - v.webpBytes), 0);
  console.log(fails.length ? `--- image-variants: ${fails.length} RED ---\n` + fails.map((f) => '  RED ' + f).join('\n') : `--- image-variants: ok（${Object.keys(manifest.variants).length} 条，省下 ${(total / 1048576).toFixed(1)}MB）---`);
  process.exit(fails.length ? 1 : 0);
}

if (process.argv.includes('--check')) check();
else build();
