#!/usr/bin/env node
/**
 * 「搜索深链 / 输入法 / 多词检索」七组浏览器判据（J1–J7）的「仍有牙」自证。
 *
 * 做什么：往**一份产物副本**的 `assets/js/editorial.min.js` 里注入十三处已知错误，
 * 每注入一处立刻重跑 `scripts/verify-search-deeplink.mjs --site=<副本>`，
 * 看红的是不是这一族允许的那一条判据；再跑三项**量具自己的**自检（空刀 / 隔离闸门 / 还原）。
 * 跑完每轮立刻按 md5 还原，还原不上就整轮中止（退 3）——否则下一轮读到的「红」
 * 归因不到这一轮的注入。
 *
 * 为什么必须有这一本：J1–J4 判的全是「地址栏与面板状态」这类看不见的副作用，J5–J7 判的是
* 「集合等于独立口径、<mark> 根数等于文本里出现次数」这类数得出来的等式。
 * 「绿」有三种来路：实现对、判据空转、判据写反。只有把实现改坏才能把它们分开。
 * 本轮已经栽过一次同类坑：J2 的初稿用 `performance.getEntriesByType('navigation')`
 * 判「只准 replace」，而那个条目数每个文档恒为 1、pushState 根本不往里加——
 * 那一格会永远绿，且永远抓不住「后退要先退回上一个词才退得出面板」。
 * M5 就是那一格的反证：换成 pushState 之后必须红在「只准 replace」。
 *
 * 副本必须是副本：仓库的 `_site` 是共享资源（`pnpm dev` 的 jekyll serve 与并行会话都在写它），
 * 指到那里去注错等于往别人的现场放火，所以这一本对 `ROOT/_site` 直接拒绝（退出码 2）。
 *
 * 十三刀里没有 `syncUrl` 里那句 `if (entryUrl === null) return;` 的刀：它今天**没有可观测路径**
 * （唯一可能在关着时被调用的地方是 close()，而它先 `syncUrl('')` 再置 null）。
 * 给它配一刀就是造假牙——注入进去判据照样绿，然后这一本还会报告「这格有牙」。
 * 那句守护留着是因为它防的是将来新增的调用点（代价一行）；它的存在与否不由这一本担保，
 * 这一本只担保它担保得了的那十三刀。
 *
 * 前置：一次 `npx vite build` + 一次 `bundle exec jekyll build`，然后把 `_site` 整棵拷一份：
 *   cp -R <worktree>/_site /tmp/sp3-teeth/_site
 *   SDL_SITE_DIR=/tmp/sp3-teeth/_site node scripts/verify-search-deeplink-teeth.mjs
 *   TEETH_ONLY=M1,S1 node scripts/verify-search-deeplink-teeth.mjs   — 只跑其中几项（复跑崩场用）
 *
 * 退出码：0 = 各项全部点燃；1 = 有项没点燃；2 = 环境不对（副本缺失 / 锚点找不到 = 空刀 / 基线不绿）；
 * 3 = 还原失败，后面的轮次全部中止。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..');
const SITE = process.env.SDL_SITE_DIR ? path.resolve(process.env.SDL_SITE_DIR) : null;
const HARNESS = path.join(ROOT, 'scripts', 'verify-search-deeplink.mjs');

if (!SITE) {
  console.log('✗ 必须用 SDL_SITE_DIR 指到一份产物副本（不能是仓库的 _site——那是共享的）');
  process.exit(2);
}
if (SITE === path.join(ROOT, '_site')) {
  console.log('✗ SDL_SITE_DIR 指的是仓库的 _site，这一本只允许打在副本上');
  process.exit(2);
}
const REL = ['assets/js/editorial.min.js'];
for (const r of REL) {
  if (!fs.existsSync(path.join(SITE, r))) {
    console.log(`✗ ${SITE} 里没有 ${r}——先构建那份副本（vite build + jekyll build，再整棵拷过去）`);
    process.exit(2);
  }
}

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const snapshot = () => Object.fromEntries(REL.map((r) => [r, md5(path.join(SITE, r))]));

/**
 * 副本必须与被测树**同一份**，否则这一轮量的是「改坏一半的产物」。
 * 这一本 bake 的是副本现有的内容，不会自己重拷——上一轮如果被中途杀掉，
 * 副本里就躺着一条没还原的刀（实测：杀在 M10 之后，副本比 `_site` 少 29 字节，
 * md5 从 `dc9e7fca407f` 变成 `273c92133215`），而基线自证那一行仍可能照绿。
 */
{
  const SRC = path.join(ROOT, '_site');
  const drift = REL.filter((r) => fs.existsSync(path.join(SRC, r)) && md5(path.join(SRC, r)) !== md5(path.join(SITE, r)));
  if (drift.length) {
    console.log(`✗ 副本里的 ${drift.join('、')} 与 ${SRC} 对不上——多半是上一轮被打断、留下没还原的刀。重拷再跑：rm -rf ${SITE} && cp -R ${SRC} ${path.dirname(SITE)}`);
    process.exit(2);
  }
}

const BAKE = fs.mkdtempSync(path.join(os.tmpdir(), 'sdl-teeth-'));
/**
 * 每一项的 harness 原始输出落在这里，**跑完不删**：「红在哪几条」只有对着读数才复核得动，
 * 而「除了预期那格还红了什么」正是归因的证据（只留汇总行等于让下一轮的人来猜）。
 */
const LOGDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sdl-teeth-logs-'));
REL.forEach((r) => {
  const dir = path.join(BAKE, path.dirname(r));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(SITE, r), path.join(BAKE, r));
});
const PRISTINE = snapshot();
const diffAgainst = (base) => REL.filter((r) => md5(path.join(SITE, r)) !== base[r]);
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
 * 落一刀：把 `from` 换成 `to`。命中数不等于 1 就抛 `status=2`，不静默放行。
 *
 * 为什么判「恰好 1」而不是「≥1」：这些锚点是先从压缩产物里 `grep -o` 数出来的（每串都正好 1 处），
 * 一旦哪天 terser 把同名结构复用到别处，`>=1` 会改到不该改的那一份，红因就归错地方了。
 * 而 0 命中是「刀没落地」——量具以为改了、其实没改，下一轮的绿是假的。
 *
 * 抛而不是 `process.exit`：S1 这一格要的就是「把空刀当证据收下来」，exit 拦不住。
 * @param {{from:string,to:string}} m
 */
function apply(m) {
  let hits = 0;
  for (const r of REL) {
    const f = path.join(SITE, r);
    const s = fs.readFileSync(f, 'utf8');
    const n = s.split(m.from).length - 1;
    if (!n) continue;
    hits += n;
    fs.writeFileSync(f, s.split(m.from).join(m.to));
  }
  if (hits !== 1) {
    restore();
    const err = new Error(`空刀：${JSON.stringify(m.from).slice(0, 70)} 在副本里命中 ${hits} 处（判线 =1）——锚点对不上今天的产物`);
    err.status = 2;
    throw err;
  }
}

/**
 * 十三刀 = J1–J5 与 J7 的每一格至少一刀，覆盖「深链读入口 / 空串不开面板 / 预填 / 地址栏同步 /
 * 只动 q / 只准 replace / 关闭抹 q / 组合中不拦按键 / 组合中不重绘 / 组合结束不补渲染 /
 * 词词都要计分 / 同一词逐处包 / 并列词逐个包」十三处可观测行为。
 *
 * `expect` 是**这一族允许红的那一条判据**，取自 harness 的红点汇总行（`[J2] 只准 replace`），
 * 必须是那一句的逐字片段——判据文案一改这里就找不到，比静默放过更安全。
 *
 * `cascade` 是这一刀**必然连带**红掉的那些格，逐条写明理由。为什么允许连带而不是要求只红一条：
 * J3 的前半格（「关闭那一刻地址栏里真的有 q」）就是为了不给前一站的破法发免费绿牌而加的，
 * 所以 M3/M4 改坏同步时 J3 一定跟着红——那不是隔离不干净，那是它在正确地拒绝恒真。
 * 没写进 cascade 的红仍然算「红错地方」，这一条不放宽。
 *
 * @type {Array<{id:string,name:string,expect:string,cascade?:string[],from:string,to:string,why:string}>}
 */
const MUTS = [
  {
    id: 'M1', name: '深链那一步整个摘掉（进站不再 open）',
    expect: '[J1] 深链开面板', cascade: ['[J4] 这一格的前置'],
    from: 'E&&x(null,E)', to: '',
    why: 'J1 判的就是「带 ?q= 进站，面板该是开着的」；没人读 URL 时它必须红在这一格。'
      + 'J4 用深链进站铺「屏幕上已有一批结果、第一行已选中」这个前置（那是产品自己铺的，不是量具点按钮点出来的），'
      + '面板不开它就连「Enter 无处可跳」都判不了，只能红在前置——这一条是刻意的连带，不是隔离不干净',
  },
  {
    id: 'M2', name: 'preset 不塞进输入框（打开是空的）',
    expect: '[J1] 预填输入框', cascade: ['[J4] 这一格的前置'],
    from: 'n.value=a||""', to: 'n.value=""',
    why: 'J1 第二格把输入框实值与查询词逐字比；「先开后塞」那种写法也红在这一格——那正是要拦的两次渲染。'
      + '连带 J4 前置：输入框空着就没有那批进站结果，J4 的两半都读不到东西（M1/M2 之后 J5/J6/J7 改走 setQuery 打字进站，'
      + '正是为了让深链那一族的破法只红在 J1+J4，不再波及打分与高亮那三组（J5/J6/J7）——一刀红十格就没法归因了）',
  },
  {
    id: 'M13', name: 'preset 的 truthiness 门摘掉（空串也开面板）',
    expect: '[J1] 空串不开面板',
    from: 'E&&x(null,E)', to: 'x(null,E)',
    why: '与 M1 同一处、相反方向的破法：M1 是「谁都不开」，这一刀是「有地址就开」，'
      + '而 `?q=`（空值参数）在 E2 上线之后是爬虫真会请求到的形状——SearchAction 的 urlTemplate 就是它。'
      + 'J1 的正面那一格照样绿（带词时两条路径同构），只有反面这一格红',
  },
  {
    id: 'M3', name: 'input 监听里不再同步地址栏',
    expect: '[J2] q 跟随输入', cascade: ['[J3] 关闭前该有 q'],
    from: 'function(){p||(I(n.value),C(n.value.trim()))}', to: 'function(){p||I(n.value)}',
    why: 'J2 轮询的是「打字之后地址栏出现 q」；监听器漏挂 syncUrl 是这一步最自然的破法。'
      + 'J3 连带红是它的反恒真守护在起作用（没有 q 就拒绝说「抹干净了」）',
  },
  {
    id: 'M4', name: '入口地址只记 pathname（丢掉 search 与 hash）',
    expect: '[J2] 别的参数不许丢', cascade: ['[J3] 还原要回到入口那一份'],
    from: 'v=location.pathname+location.search+location.hash', to: 'v=location.pathname',
    why: 'J2 带 utm_source/x/#frag 进来就是为这一格：同步吃掉入口的其他部分，复制出去的链接就坏了。'
      + 'J3 那一格是同一个断言的反面（还原还原到丢了参数的地址），必须跟着红',
  },
  {
    id: 'M5', name: 'replaceState 换成 pushState（每次打字产生一条历史）',
    expect: '[J2] 只准 replace',
    from: 'window.history.replaceState(null,"",t.pathname+t.search+t.hash)', to: 'window.history.pushState(null,"",t.pathname+t.search+t.hash)',
    why: '这一刀是给「量 history.length」那格补的反证：换掉之前那一格用导航条目数判，恒绿、抓不住这一刀',
  },
  {
    id: 'M6', name: 'close 里不再抹 q',
    expect: '[J3] 关闭后不该留 q',
    from: ',C(""),v=null', to: ',v=null',
    why: 'J3 先咬住「关闭那一刻真的有 q」再看抹没抹——两半合起来才不是恒真（E1 落地前它就红在「关闭前该有 q」）',
  },
  // ── D3a 输入法组合保护（三刀对 J4 的三格）───────────────────────────────
  // 锚点全部落在**结构**上而不是标识符上，因为 terser 每改一次源就换一轮局部名：
  // D3b 落地之后 `open` 是 x、`close` 是 L、`render` 是 I、`syncUrl` 是 C、
  // 组合态 `composing` 是 p、入口快照 `entryUrl` 是 v——上一版按 `M(...)`/`q(...)` 写的六条
  // 锚点当场命中 0 处，被 apply 的空刀规则拦成 exit 2（这正是那条规则存在的理由）。
  // 每次改完 `dev/js/editorial.js` 重新 build 之后，这一本必须先重数锚点再跑。
  // `p||n.isComposing||229===n.keyCode||(` 是按键块被整组拦下的那一句，
  // `function(){p||(I(n.value),C(n.value.trim()))}` 是 input 那一条的守护，
  // `function(){p=!1,I(n.value),C(n.value.trim())}` 是 compositionend 的补渲染。
  // 每一串都数过在这份产物（md5 见首行）里恰好出现 1 次；!=1 由 apply 退 2。
  {
    id: 'M7', name: '组合中的按键守护整个摘掉（`if (composing…) return` 变成恒假）',
    expect: '[J4] 组合中按 Enter',
    from: 'p||n.isComposing||229===n.keyCode||(', to: '!1||(',
    why: '这一格防的是「按 Enter 确认候选词却被送去打开第一条」。写这一刀之前先确认它有牙：'
      + 'J4 把 Enter 放在 compositionstart 之后、第一个 input 之前，屏幕上那批还是进站的结果',
  },
  {
    id: 'M8', name: 'input 监听里的组合守护摘掉（拼音串也照重绘）',
    expect: '[J4] 组合中不重绘',
    from: 'function(){p||(I(n.value),C(n.value.trim()))}', to: 'function(){I(n.value),C(n.value.trim())}',
    why: '候选词没落定就重排，观感是「打字像在闪」；顺带验地址栏不跟着拼音串跑',
  },
  {
    id: 'M9', name: 'compositionend 不补渲染（只把标志位放下来）',
    expect: '[J4] 组合结束要补渲染',
    from: 'function(){p=!1,I(n.value),C(n.value.trim())}', to: 'function(){p=!1}',
    why: '整场组合里 input 是被拦着的，收尾不补一遍就停在「屏幕上还是上一个词的结果」——'
      + '这一格必须与 M8 分开：M8 红在组合中，这一刀红在收尾',
  },
  // ── D3b 多词 AND 与逐词高亮（三刀对 J5/J7）──────────────────────────────
  // 这三处锚点同样先 `grep -o -F` 数过：各 1 次。
  // `if(!l)return{score:0,hits:[]}` 是 score() 里那扇 AND 门（词分数为 0 就整条出局），
  // `,i=a.index+a[0].length)` 是 mark() 每次命中后推进的那个游标，
  // `.map(S).join("|")` 是把词表拼成一条 alternation 正则的那一句。
  {
    id: 'M10', name: 'AND 门摘掉（任一词拿不到分也不再出局整条，退化成「命中一个就算」）',
    expect: '[J5] diff 工具',
    cascade: ['[J5] 浏览器 插件', '[J5] 插件 浏览器', '[J5] 性能 缓存', '[J5] zzz不存在词 搜索', '[J5] 输入法 中文'],
    from: 'if(!l)return{score:0,hits:[]}', to: '',
    why: '这一刀红得宽是应该的：AND 是这个特性的全部差别，摘掉之后每条多用例都退化成并集。'
      + '把「diff 工具」当主判据是因为它是唯一「独立口径 0 条」那条——只有 AND 能给 0 行，'
      + '并集会给出 20 行，所以它是这一族的门闩；其余几条红在同一个原因上，逐条列进 cascade',
  },
  {
    id: 'M11', name: 'mark 只包第一处命中（exec 循环走一遍就散）',
    expect: '[J7] 同一词逐处高亮', cascade: ['[J7] 两个词都要有高亮'],
    from: ',i=a.index+a[0].length)', to: ',i=a.index+a[0].length,r.lastIndex=1/0)',
    why: 'J1 只断「这批行里有 <mark>」，这一刀之后第一处照样在——只有数根数才分得开。'
      + '夹具是标题里把「浏览器」写了两遍的那条；后半格连带红是因为摘要里有 6 个「插件」，'
      + '单次循环同样只包第一个',
  },
  {
    id: 'M12', name: 'alternation 只切第一个词（第二个词进不了正则）',
    expect: '[J7] 两个词都要有高亮',
    from: '.map(S).join("|")', to: '.slice(0,1).map(S).join("|")',
    why: 'J5 抓不到这一刀：它比的是结果集合，而打分与高亮是两条独立的路——'
      + '第二个词照样把整条筛进结果里，却一处都不亮。高亮这一族必须有自己的一格才不空转',
  },
];

/**
 * 三项**量具自己**的自检。为什么与十三刀同级：十三刀里「这一本跑过了」这句话依赖的正是
 * 这三件事——锚点找不到时不许静默算通过、副本闸门不许形同虚设、每轮还原必须真的还原。
 * 任何一项哑了，十三刀的红与绿都归因不到注入本身。
 *
 * @type {Array<{id:string,name:string,run:function():{lit:boolean,note:string}}>}
 */
const SELFS = [
  {
    id: 'S1', name: '空刀自检：锚点不存在时 apply 必须抛 status=2，不许当成「已注入」',
    run: () => {
      let status = 0;
      try {
        apply({ from: 'SDL_TEETH_ABSENT_9f3c1a', to: 'X' });
      } catch (err) {
        status = err.status ?? -1;
      }
      restore();
      return { lit: status === 2, note: `apply 对不存在的锚点抛 status=${status}（判线 =2；0 就是「静默没落地」）` };
    },
  },
  {
    id: 'S2', name: '隔离闸门自检：SDL_SITE_DIR 指到仓库 _site 或不设，这一本都必须退 2',
    run: () => {
      // 闸门开在**这一本**自己身上（harness 收的是 --site=，它没有共享产物守卫），
      // 所以这一格必须拿这一本自己的文件去跑，拿 harness 跑会得到两个恒 0 的假绿。
      const code = (env) => {
        try {
          execFileSync('node', [SELF], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'], timeout: 60000, maxBuffer: 16 << 20 });
          return 0;
        } catch (err) {
          return err.status ?? -1;
        }
      };
      const shared = code({ ...process.env, SDL_SITE_DIR: path.join(ROOT, '_site') });
      const unset = code((() => {
        const e = { ...process.env };
        delete e.SDL_SITE_DIR;
        return e;
      })());
      return { lit: shared === 2 && unset === 2, note: `指到仓库 _site → 退 ${shared}；不设 → 退 ${unset}（两个都必须是 2）` };
    },
  },
  {
    id: 'S3', name: '还原自检：把副本写坏必须按 md5 复原，且检测器抓得住人为的错位',
    run: () => {
      const f = path.join(SITE, REL[0]);
      fs.appendFileSync(f, '/* teeth: deliberate corruption */');
      restore();
      const back = diffAgainst(PRISTINE).length === 0;
      const fake = { ...PRISTINE, [REL[0]]: 'not-a-real-md5' };
      const caught = diffAgainst(fake);
      return {
        lit: back && caught.length === 1 && caught[0] === REL[0],
        note: `写坏后复原=${back ? 'md5 全等' : '有件对不上'}；人为错位被抓出 ${caught.length} 件（${caught.join(' ') || '无'}）`,
      };
    },
  },
];

const ONLY = process.env.TEETH_ONLY ? process.env.TEETH_ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;

/** 跑一轮 harness；返回退出码、原始输出与日志路径（崩场也落盘）。 */
function runHarness(tag) {
  let status = 0;
  let out = '';
  try {
    out = execFileSync('node', [HARNESS, `--site=${SITE}`], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, maxBuffer: 64 << 20,
    });
  } catch (err) {
    status = err.status ?? -1;
    out = `${err.stdout || ''}${err.stderr || ''}`;
  }
  const file = path.join(LOGDIR, `${tag}.log`);
  fs.writeFileSync(file, `# exit=${status}\n${out}`);
  return { status, out, file };
}

const redLines = (out) => out.split('\n').filter((l) => /^\s+\[J\d\]/.test(l)).map((l) => l.trim());

const fails = [];
let lit = 0;
const planned = ONLY ? MUTS.concat(SELFS).filter((x) => ONLY.includes(x.id)).length : MUTS.length + SELFS.length;
console.log(`牙齿自证：副本 ${SITE}｜产物 md5 ${PRISTINE[REL[0]].slice(0, 12)}｜日志 ${LOGDIR}${ONLY ? `｜只跑 ${ONLY.join(',')}` : ''}`);

// 基线：不动任何文件时，J1–J7 必须**全绿**。这不是走过场——基线本身红的话，
// 十三刀报的「红在预期那一格」只是把已有的红复述一遍，归因不到注入。
{
  const r = runHarness('baseline');
  if (r.status !== 0) {
    console.log(`✗ 基线不绿（退 ${r.status}）：先修 harness 或产物，十三刀此时无从归因\n` + redLines(r.out).map((l) => '    ' + l).join('\n') + `｜${r.file}`);
    process.exit(2);
  }
  console.log('✓ 基线：副本上 J1–J7 全绿（下面的红才可能是注入带来的）');
}

for (const m of MUTS) {
  if (ONLY && !ONLY.includes(m.id)) continue;
  try {
    apply(m);
  } catch (err) {
    console.log(`✗ ${m.id} ${m.name}\n    ${err.message}`);
    process.exit(2);
  }
  const r = runHarness(m.id);
  restore();
  const reds = redLines(r.out);
  const allowed = [m.expect].concat(m.cascade || []);
  const unexpected = reds.filter((x) => !allowed.some((a) => x.startsWith(a)));
  if (r.status === 2) {
    fails.push(`${m.id} 环境/空刀：harness 退 2（那不是「红」，不许当点燃算）`);
    console.log(`✗ ${m.id} ${m.name}\n    harness 退 2 = 环境不对，这一轮没有证据｜${r.file}`);
  } else if (r.status === 0) {
    fails.push(`${m.id} 未点燃：改坏了却全绿——${m.expect} 那一格抓不住这个破法`);
    console.log(`✗ ${m.id} ${m.name}\n    没红（退 0）。这格是假牙：判据与这处行为无关，或者压根恒真`);
  } else if (!reds.some((x) => x.startsWith(m.expect))) {
    fails.push(`${m.id} 红错地方：退 ${r.status}，红的是 ${reds.join(' / ') || '（没抓到红点行）'}，期望 ${m.expect}`);
    console.log(`✗ ${m.id} ${m.name}\n    退 ${r.status} 但预期那格没红（期望 ${m.expect}，实红 ${reds.length} 条）｜${r.file}`);
  } else if (unexpected.length) {
    fails.push(`${m.id} 红多格：意外红 ${unexpected.join(' / ')}（允许集 ${allowed.join(' / ')}）`);
    console.log(`✗ ${m.id} ${m.name}\n    预期格红了，但连带红了没登记的 ${unexpected.length} 条｜${r.file}`);
  } else {
    lit += 1;
    console.log(`✓ ${m.id} ${m.name}\n    红在 ${m.expect}${m.cascade ? ` + 登记过的连带 ${m.cascade.join(' / ')}` : ''}（退 ${r.status}）｜${r.file}`);
  }
}

for (const s of SELFS) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  const r = s.run();
  if (r.lit) {
    lit += 1;
    console.log(`✓ ${s.id} ${s.name}\n    ${r.note}`);
  } else {
    fails.push(`${s.id} 哑了：${r.note}`);
    console.log(`✗ ${s.id} ${s.name}\n    ${r.note}`);
  }
}

console.log(`\n${fails.length ? '✗' : '✓'} 深链牙齿：${lit}/${planned} 点燃｜日志 ${LOGDIR}`);
for (const f of fails) console.log('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
