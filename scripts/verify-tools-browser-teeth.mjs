#!/usr/bin/env node
/**
 * 在线工具三页浏览器判据的「仍有牙」自证（段 4 Task 8 Step 3；§8.1 开头那句
 * 「每条判据都必须能变红」在这一本的落地）。
 *
 * 做什么：往**一份产物副本**里注入六处已知错误（公共六族各一处），每注入一处立刻重跑
 * `scripts/verify-tools-browser.mjs`，看红的是不是预期的那一条判据；再跑三项**量具自己的**
 * 自检（空刀 / 隔离闸门 / 还原）。跑完每轮立刻按 md5 还原，还原不上就整轮中止（退 3）——
 * 否则下一轮读到的"红"归因不到这一轮的注入。
 *
 * 为什么必须有这一本：本轮从初稿到全绿一共改了 3e（换成四步一把尺、判"变了"从 innerHTML
 * 字节数改成文本）、3c（基准从 focus 之前挪到 focus 之后、再把整块框摆进视口）、3d（门限从
 * >200px 收到 ≥100px）、4a（`/nojs` 那把正则先剥注释）四把尺。四把都是"把红改成绿"的动作，
 * 而**改到绿**与**改到没牙**是同一个动作的两种结果——只有往产物里注入错才能把它们分开。
 * 这一本还兼管 `10a` 那枚钩子：`create=0` 与"钩子没挂上"在两处判定里长得一模一样，
 * 而本轮真的靠它抓到一个假 DOM 一条都抓不到的页面缺陷（入口把裸 `Blob` 构造器当工厂注入，
 * 真浏览器里点「下载结果」必抛）。
 *
 * 副本必须是副本：仓库的 `_site` 是共享资源（`pnpm dev` 的 jekyll serve 与并行会话都在写它），
 * 指到那里去注错等于往别人的现场放火，所以这一本对 `ROOT/_site` 直接拒绝（退出码 2）。
 *
 * 前置：一次 `npx vite build` + 一次 `bundle exec jekyll build -d "$副本"`，副本里要有
 * `tools/{idcard,codec,json}.html`、`assets/css/{toolkit,index}.min.css`、`assets/js/toolkitCore.min.js`。
 *
 * 跑法（六族各一刀 + 三条自检 = 九项，全部要在副本上跑）：
 *   cp -R /tmp/seg4t8/_site /tmp/seg4t8-teeth/_site
 *   TK_SITE_DIR=/tmp/seg4t8-teeth/_site node scripts/verify-tools-browser-teeth.mjs
 *   TEETH_ONLY=T2,S3 node scripts/...  — 只跑其中几项（复跑崩场用；**别拿一次崩场当"没牙"的证据**：
 *   段 3 那一本曾把一次 `Page.navigate` 25s 无应答的崩场报成"未点燃"，单跑一次即 `✓ 红在 [4a]`）。
 *
 * 每轮只跑 `expect` 那一页（`TK_PAGES`），理由是时间而不是口径：三页全跑一轮约四分钟，
 * 九轮要半小时，而每一刀的预期红项本来就落在具体某一页上。子集跑这件事由被跑的那一本
 * 自己在横幅里喊出来（`verify-tools-browser.mjs` 的 `TK_PAGES` 分支），汇总行不假装是全量。
 *
 * 退出码：0 = 九项全部点燃；1 = 有项没点燃；2 = 环境不对（副本缺失 / 目标串找不到 = 空刀）；
 * 3 = 还原失败，后面的轮次全部中止。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.TK_SITE_DIR ? path.resolve(process.env.TK_SITE_DIR) : null;
const HARNESS = path.join(ROOT, 'scripts', 'verify-tools-browser.mjs');

if (!SITE) {
  console.log('✗ 必须用 TK_SITE_DIR 指到一份产物副本（不能是仓库的 _site——那是共享的）');
  process.exit(2);
}
if (SITE === path.join(ROOT, '_site')) {
  console.log('✗ TK_SITE_DIR 指的是仓库的 _site，这一本只允许打在副本上');
  process.exit(2);
}
for (const need of ['tools/idcard.html', 'tools/codec.html', 'tools/json.html']) {
  if (!fs.existsSync(path.join(SITE, need))) {
    console.log(`✗ ${SITE} 里没有 ${need}——先构建那份副本（vite build + jekyll build -d）`);
    process.exit(2);
  }
}

/** 允许被改的文件（副本内的相对路径）；每刀的 `targets` 只能从这里选 */
const REL = [
  'assets/css/toolkit.min.css', 'assets/css/index.min.css', 'assets/js/toolkitCore.min.js',
  'tools/idcard.html', 'tools/codec.html', 'tools/json.html',
];
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const snapshot = () => Object.fromEntries(REL.map((r) => [r, md5(path.join(SITE, r))]));

const BAKE = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-teeth-'));
/**
 * 每一项的 harness 原始输出落在这里，**跑完不删**——"红在哪几条"这件事只有对着读数才复核得动
 * （段 3 那一本的初稿把日志连着备份一起删，结果 M3 那轮的逐条读数拿不到，只剩一行汇总）。
 */
const LOGDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-teeth-logs-'));
REL.forEach((r) => {
  const dir = path.join(BAKE, path.dirname(r));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(SITE, r), path.join(BAKE, r));
});
const PRISTINE = snapshot();
/** 拿一份基线做逐文件比对，返回对不上的那些（S3 用同一只函数验"检测器自己有没有牙"） */
const diffAgainst = (base) => REL.filter((r) => md5(path.join(SITE, r)) !== base[r]);
/** 每轮跑完都调这一只；对不上就退 3——带着脏产物继续跑，之后的红全是假证据 */
const restore = () => {
  try {
    REL.forEach((r) => fs.copyFileSync(path.join(BAKE, r), path.join(SITE, r)));
  } catch (err) {
    console.log(`✗ 还原时读不到备份（${err.message}）——后面的轮次全部中止`);
    process.exit(3);
  }
  const bad = diffAgainst(PRISTINE);
  if (bad.length) {
    console.log(`✗ 还原失败：${bad.join(' ')}——后面的轮次全部中止`);
    process.exit(3);
  }
};

/**
 * 六处注入 = 公共六族各一刀。`expect` 是**这一族允许红的那一条判据编号**（真产物上九族全绿，
 * 见 Task 8 Step 1–2 的收口读数：72 项 0 红）；`targets` 点名允许被改的文件，避免"顺手改了
 * 另一个文件"把红因归错地方；`pages` 是这一轮 `TK_PAGES` 的取值。
 *
 * @type {Array<{id:string,kind:'mut',name:string,expect:string,pages:string,
 *   targets:string[],from:string,to:string,why:string}>}
 */
const MUTS = [
  {
    id: 'T1', kind: 'mut', name: '族1 视口/分栏：把主分栏的换挡 media query 从 900 挪到 901',
    expect: 'idcard/1b', pages: 'idcard', targets: ['assets/css/toolkit.min.css'],
    from: '(max-width:900px)', to: '(max-width:901px)',
    why: '1b 判的是"轨道数与换挡点都落在 SCSS 现读的声明集上"：产物偷偷挪一档就必须红',
  },
  {
    id: 'T2', kind: 'mut', name: '族2 对比度：把白昼正文那枚 --ink-2 提亮两档（3.6:1）',
    expect: 'idcard/2a', pages: 'idcard', targets: ['assets/css/index.min.css'],
    from: '--ink-2: #33373E', to: '--ink-2: #8A8F98',
    why: '.tk-compliance 的 color 就是 var(--ink-2)，2a 判线 4.5——换肤那三档全绿不代表算对了',
  },
  {
    id: 'T3', kind: 'mut', name: '族3 键盘：把方向键映射的落点改名（ArrowRight 不再指向 next）',
    expect: 'idcard/3c', pages: 'idcard', targets: ['assets/js/toolkitCore.min.js'],
    from: 'ArrowRight":return"next"', to: 'ArrowRight":return"nextX"',
    why: '3c 真按 →/←/↓/Home/End 五件事一起跟上；按键接不到那一格就必须红',
  },
  {
    id: 'T4', kind: 'mut', name: '族4 禁 JS：把 noscript 那一句的类名改掉（摊平后找不到它）',
    expect: 'json/4a', pages: 'json', targets: ['tools/json.html'],
    from: 'tk-compliance--noscript', to: 'tk-compliance--noscripts',
    why: '4a 既判那两句口径逐条还在，也判 `.tk-compliance--noscript` 摊平后仍有正文',
  },
  {
    id: 'T5', kind: 'mut', name: '族5 首屏阻塞：把本页专属的 toolkit.min.css 再往 </head> 挂一份',
    expect: 'codec/5a', pages: 'codec', targets: ['tools/codec.html'],
    from: '</head>',
    to: '<link rel="stylesheet" href="/better-blog/assets/css/toolkit.min.css"></head>',
    why: '5a 按 renderBlockingStatus 现量：专属件一旦进阻塞集就该红（改的是读数不是判据，'
      + '挂同一份 CSS 不重跑 JS，不会连累 6a）',
  },
  {
    id: 'T6', kind: 'mut', name: '族6 Console：在 </body> 前塞一发起 Type 错误的内联脚本',
    expect: 'codec/6a', pages: 'codec', targets: ['tools/codec.html'],
    from: '</body>',
    to: '<script>document.getElementById("tk-no-such-node").innerText=1</script></body>',
    why: '6a 判本源异常与 error 级 0 条：这一发是本源的、每次加载都抛，红只许落在归因那一条上',
  },
];

/**
 * 三项**量具自己**的自检。为什么它们与六刀同级：六道门禁里"这一本跑过了"这句话，
 * 依赖的正是这三件事——目标串找不到时不许静默算通过、副本闸门不许形同虚设、
 * 每轮还原必须真的还原。任何一项哑了，上面六刀的红与绿都归因不到注入本身。
 *
 * @type {Array<{id:string,kind:'self',name:string,run:function():{lit:boolean,note:string}}>}
 */
const SELFS = [
  {
    id: 'S1', kind: 'self', name: '空刀自检：目标串在副本里不存在时，注入必须被认出来是"没落地"',
    run: () => {
      // 走的就是六刀那一只 `apply()`，只是 `from` 换成一个产物里绝无可能出现的串。
      const r = apply({ targets: REL, from: 'TK_TEETH_ABSENT_9f3c1a', to: 'X' });
      restore();
      return { lit: r === 0, note: `注入命中 ${r} 处（判线 =0 才算这一格的守卫有牙）` };
    },
  },
  {
    id: 'S2', kind: 'self', name: '隔离闸门自检：TK_SITE_DIR 指到仓库 _site 或不设，都必须退 2',
    run: () => {
      const code = (env) => {
        try {
          execFileSync('node', [HARNESS], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'ignore'], timeout: 120000 });
          return 0;
        } catch (err) { return err.status ?? -1; }
      };
      const shared = code({ ...process.env, TK_SITE_DIR: path.join(ROOT, '_site'), TK_PAGES: 'idcard' });
      const unset = code((() => { const e = { ...process.env }; delete e.TK_SITE_DIR; return e; })());
      return { lit: shared === 2 && unset === 2,
        note: `指到仓库 _site → 退 ${shared}；不设 → 退 ${unset}（两个都必须是 2）` };
    },
  },
  {
    id: 'S3', kind: 'self', name: '还原自检：把副本写坏必须按 md5 复原，且检测器抓得住人为的错位',
    run: () => {
      const f = path.join(SITE, 'tools/codec.html');
      fs.appendFileSync(f, '<!-- teeth: deliberate corruption -->');
      restore();                       // 复原不上会直接退 3，走不到下面
      const back = diffAgainst(PRISTINE).length === 0;
      // 第二半：把基线故意改错一格，同一只检测器必须报出这一件——否则"还原成功"这句话本身没牙。
      const fake = { ...PRISTINE, 'tools/codec.html': 'not-a-real-md5' };
      const caught = diffAgainst(fake);
      return { lit: back && caught.length === 1 && caught[0] === 'tools/codec.html',
        note: `写坏后复原=${back ? '逐件 md5 全等' : '有件对不上'}；人为错位被抓出 ${caught.length} 件`
          + `（${caught.join(' ') || '无'}）` };
    },
  },
];

const ONLY = process.env.TEETH_ONLY ? process.env.TEETH_ONLY.split(',').map((s) => s.trim()) : null;
console.log(`# 副本 ${SITE}\n# 基线 md5 ${JSON.stringify(PRISTINE)}\n# 备份 ${BAKE}`);

/** 把一处 `from → to` 打进 `targets` 里那些文件，返回命中次数（0 = 空刀） */
function apply(m) {
  let touched = 0;
  for (const rel of m.targets) {
    const f = path.join(SITE, rel);
    const txt = fs.readFileSync(f, 'utf8');
    const n = txt.split(m.from).length - 1;
    if (n > 0) { fs.writeFileSync(f, txt.split(m.from).join(m.to)); touched += n; }
  }
  return touched;
}

/** 跑一轮 harness，返回退出码与红项清单 */
function runHarness(pages, tag) {
  const log = path.join(LOGDIR, `teeth-${tag}.log`);
  const fd = fs.openSync(log, 'w');
  let code = 0;
  try {
    execFileSync('node', [HARNESS], {
      cwd: ROOT, env: { ...process.env, TK_SITE_DIR: SITE, TK_PAGES: pages },
      stdio: ['ignore', fd, fd], timeout: 20 * 60 * 1000,
    });
  } catch (err) { code = err.status ?? -1; }
  fs.closeSync(fd);
  const red = [...fs.readFileSync(log, 'utf8').matchAll(/^✗ (\S+)/gm)].map((x) => x[1]);
  return { code, red, log };
}

const rows = [];
for (const m of [...MUTS, ...SELFS]) {
  if (ONLY && !ONLY.includes(m.id)) continue;
  if (m.kind === 'self') {
    const { lit, note } = m.run();
    rows.push({ m, lit, note });
    console.log(`${lit ? '✓' : '✗'} ${m.id} ${m.name} — ${note}`);
    continue;
  }
  const touched = apply(m);
  if (touched === 0) {
    restore();
    console.log(`✗ ${m.id} ${m.name} — 目标串「${m.from}」在副本里找不到，注入没落地（这一刀是空的）`);
    rows.push({ m, lit: false, note: '空刀' });
    continue;
  }
  const { code, red, log } = runHarness(m.pages, m.id);
  restore();
  const lit = red.includes(m.expect);
  rows.push({ m, lit, note: `注入 ${touched} 处、退出码 ${code}、红在 [${red.join('、') || '无'}]` });
  console.log(`${lit ? '✓' : '✗'} ${m.id} ${m.name}\n    ${rows[rows.length - 1].note}，`
    + `期望 ${m.expect} ${lit ? '点燃' : '没点燃'}\n    为什么是这一条：${m.why}\n    读数：${log}`);
}

const failed = rows.filter((r) => !r.lit);
console.log(`\n合计 ${rows.length} 项（六刀 + 三自检），点燃 ${rows.length - failed.length} 项，`
  + `未点燃 ${failed.length} 项`
  + (failed.length ? `：${failed.map((r) => `${r.m.id}(${r.note})`).join('；')}` : ''));
fs.rmSync(BAKE, { recursive: true, force: true });
console.log(`# 每项的红项读数留在 ${LOGDIR}（不删，供后来的人复核）`);
process.exit(failed.length ? 1 : 0);
