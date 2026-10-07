#!/usr/bin/env node
/**
 * 「工具页档位 ↔ 地址栏」七组浏览器判据（U1–U7）的「仍有牙」自证。
 *
 * 做什么：往**一份产物副本**的三本 min 产物里注入十处已知破法，每注入一处立刻重跑
 * `scripts/verify-tool-url.mjs`（TU_SITE_DIR 指到那份副本），看红的是不是这一族允许的那几条判据；
 * 再跑三项**量具自己的**自检（空刀 / 隔离闸门 / 还原）。每轮跑完立刻按 md5 还原，还原不上就整轮中止
 * （退 3）——否则下一轮读到的「红」归因不到这一轮的注入。
 *
 * 为什么必须有这一本：U1–U7 判的全是「地址栏变成了什么」这类看不见的副作用（键在不在、顺序动没动、
 * 历史加没加、hash 洗没洗）。「绿」有三种来路：实现对、判据空转、判据写反。只有把实现改坏才能把
 * 它们分开。这一族已经栽过一次同类坑：`sync` 的初稿把「只准 replace」交给
 * `performance.getEntriesByType('navigation')` 判，而那个条目数每个文档恒为 1、pushState 根本不往里加
 * ——那一格会永远绿。T4 就是那一格的反证：换成 pushState 之后必须红在「只用 replace」。
 *
 * 十刀的锚点全部取自**压缩产物**而不是源码，所以有一条维护契约：改过 `dev/js/` 里这三本的任何一本
 * 并重新构建之后，terser 会换一轮局部名（本文件写下的 `F` / `We` / `Je` / `M` / `Ae` 这些是今天的读数），
 * 必须先重数锚点再跑。锚点命中数不等于 1 会被 `apply` 拦成退 2，不会静默放行——这正是这条契约的执法者。
 *
 * 副本必须是副本：仓库的 `_site` 是共享构建输出（`pnpm dev` 的 jekyll serve 与并行会话都在写它），
 * 指到那里去注错等于往别人的现场放火，所以这一本对 `ROOT/_site` 直接拒绝（退 2）。
 *
 * 前置：一次 `npx vite build` + 一次 `bundle exec jekyll build`，然后把 `_site` 整棵拷一份：
 *   mkdir -p /tmp/sp2-teeth && rm -rf /tmp/sp2-teeth/_site && cp -R _site /tmp/sp2-teeth/_site
 *   TU_SITE_DIR=/tmp/sp2-teeth/_site node scripts/verify-tool-url-teeth.mjs
 *   TEETH_ONLY=T4,S1 node scripts/verify-tool-url-teeth.mjs   — 只跑其中几项（复跑崩场用）
 *
 * 退出码：0 = 十三项全部点燃；1 = 有项没点燃；2 = 环境不对（副本缺失 / 锚点找不到 = 空刀 / 基线不绿）；
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
const SITE = process.env.TU_SITE_DIR ? path.resolve(process.env.TU_SITE_DIR) : null;
const HARNESS = path.join(ROOT, 'scripts', 'verify-tool-url.mjs');

if (!SITE) {
  console.log('✗ 必须用 TU_SITE_DIR 指到一份产物副本（不能是仓库的 _site——那是共享的）');
  process.exit(2);
}
if (SITE === path.join(ROOT, '_site')) {
  console.log('✗ TU_SITE_DIR 指的是仓库的 _site，这一本只允许打在副本上');
  process.exit(2);
}
const REL = ['assets/js/toolkitCore.min.js', 'assets/js/toolJson.min.js', 'assets/js/toolDiff.min.js'];
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
 * 这一本 bake 的是副本现有的内容，不会自己重拷——上一轮如果被中途杀掉，副本里就躺着一条没还原的刀，
 * 而基线自证那一行仍可能照绿（刀落在没被读到的那本上）。
 */
{
  const SRC = path.join(ROOT, '_site');
  const drift = REL.filter((r) => fs.existsSync(path.join(SRC, r)) && md5(path.join(SRC, r)) !== md5(path.join(SITE, r)));
  if (drift.length) {
    console.log(`✗ 副本里的 ${drift.join('、')} 与 ${SRC} 对不上——多半是上一轮被打断、留下没还原的刀。重拷再跑：rm -rf ${SITE} && cp -R ${SRC} ${path.dirname(SITE)}`);
    process.exit(2);
  }
}

const BAKE = fs.mkdtempSync(path.join(os.tmpdir(), 'tu-teeth-'));
/**
 * 每一项的 harness 原始输出落在这里，**跑完不删**：「红在哪几条」只有对着读数才复核得动，
 * 而「除了预期那格还红了什么」正是归因的证据（只留汇总行等于让下一轮的人来猜）。
 */
const LOGDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tu-teeth-logs-'));
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
 * 为什么判「恰好 1」而不是「≥1」：三本产物里 `assets/js/toolkitCore.min.js` 是两页共用的，
 * 一条落在共用层的锚点如果在两页各自也有一份同形代码，`>=1` 会一次改到三处，红因就归不到这一刀。
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
 * 十刀 = 计划 §Task 5 那张表的九格，外加一格是这一轮真缺陷的反证。
 *
 * `expect` 是**这一族允许红的那一条判据**，取自 harness 末尾的红点清单（`[U1] json 的「jt-view」落进控件：…`），
 * 必须是那一句的逐字片段——判据文案一改这里就找不到，比静默放过更安全。
 *
 * `cascade` 是这一刀**必然连带**红掉的那些格，逐条写明理由。为什么允许连带而不是要求只红一条：
 * U3 的「确实写过」与 U1 的基线格就是为「不给破法发免费绿牌」而存在的，所以改坏写侧时它们会跟着动——
 * 那不是隔离不干净，那是它们在正确地拒绝恒真。没写进 cascade 的红仍然算「红错地方」，这一条不放宽。
 *
 * @type {Array<{id:string,name:string,expect:string,cascade?:string[],from:string,to:string,why:string}>}
 */
const MUTS = [
  {
    id: 'T1', name: 'JSON 页进站那一次读整个摘掉（parse 的结果换成空 found）',
    expect: '[U1] json 的「jt-view」落进控件',
    cascade: ['[U1] json 的「jt-indent」落进控件', '[U1] json 的「jt-sort」落进控件'],
    from: 'F.parse(L.search,We)', to: '{found:{},ignored:[]}',
    why: 'U1 前三格判的就是「带 ?jt-view=tree 进站，下拉该指着 tree」；没人读地址栏时深链开出来还是默认档。'
      + '三枚键各红一条是应该的：进站读是逐键写的，摘掉整段就是三键同时失去落地——'
      + '而「空地址栏基线」那格照旧绿（它判的是裸 URL 下控件停在骨架那一档，与这条读路无关），'
      + 'diff 页的三格也照旧绿（刀落在 json 那一本上，两页的装配层是分开的两本）',
  },
  {
    id: 'T2', name: '白名单门摘掉（select 任何值都收）',
    expect: '[U2] json 的「jt-view=treeish」不采纳',
    cascade: ['[U2] diff 的「df-mode=treeish」不采纳'],
    from: 'e.options.includes(t)?t:void 0', to: 't',
    why: 'U2 用「像档位又不是档位」的 treeish 就是为这一格：门写宽之后控件被写进一个骨架里没有的值，'
      + '浏览器把 select 落到 -1（实读空串），既不是请求的那一档也不是默认档。'
      + '两页各红一条是因为 parse 在共用层；`df-ws=0` 那格照旧绿——刀只落在 select 那一支，'
      + 'check 那一支「只认 1」的口径没被碰（这一条恰好也是 spec §2 第三口径的独立反证）',
  },
  {
    id: 'T3', name: '进站读顺手回写地址栏（非法值被抹掉）',
    expect: '[U2] json 的那枚非法值没抹',
    from: 'n&&(n.value=e.found[t.name])}}', to: 'n&&(n.value=e.found[t.name])}Je()}',
    why: '这一刀是「不采纳」与「替用户改链接」的分界线：控件正确停在默认档（U2 前半格照绿），'
      + '但那枚 `jt-view=treeish` 从地址栏消失了——陌生人手改过的链接被这一页洗成了自己的形状。'
      + 'U1 的「不被抹」两格抓不到这一刀，是因为它们带的是合法值：合法值写回等于没写（`nextSearch` 发现'
      + '一个都没变就返回 null，一次 replaceState 都不发生），只有非法值才会被抹掉——所以这一格必须独立存在',
  },
  {
    id: 'T4', name: 'replaceState 换成 pushState（改档位产生一条历史）',
    expect: '[U3] json 只用 replace',
    cascade: ['[U3] diff 只用 replace'],
    from: 't.replaceState(t.state??null,"",a)', to: 't.pushState(t.state??null,"",a)',
    why: '这一刀是给「量 history.length」那格补的反证（SP3 同类坑在这一族的翻版）：'
      + '换掉之后 20 次档位改动加出 20 条历史，后退键得先退完档位才退得出这一页。'
      + '两页各红一条是因为 sync 在共用层；「确实写过」那两格照绿——它判的是「别把一次都没写读成没加历史」，'
      + '这一刀写得比谁都勤',
  },
  {
    id: 'T5', name: '从空 search 起建新串（别人的键丢）',
    expect: '[U4] json 的别人的键',
    cascade: ['[U4] diff 的别人的键', '[U5] 「恢复默认档」把键删干净', '[U7] 重置删键'],
    from: 'const r=new URLSearchParams(x(e));let o=!1;', to: 'const r=new URLSearchParams("");let o=!1;',
    why: 'U4 带 `z=9&keep=1&utm_source=x` 进站再动一枚档位，判的就是「别人的键连值带序留着、我的排末尾」；'
      + '从空串起建就是把这一段记忆摘了，分享链接上的渠道参数会被这一页吃掉。'
      + '两条连带是同一件事的反面：删键也变成不可能的动作——所有档位落回默认时「从空串起建」算出来的新串'
      + '与「无改动」同形（返回 null），于是 U5/U7 那两格「重置之后地址栏该是空的」永远读不到删除，'
      + '链接上「这一页的默认态」和「停在用户拨过的那一档」长成一个样子',
  },
  {
    id: 'T6', name: 'retune 的同步整个摘掉（finally 里那一发不再写）',
    expect: '[U5] 点「全部展开」',
    cascade: ['[U3] diff·抛了也要镜像', '[U4] diff 的新键排末尾'],
    // 锚点里的 `Te` = `syncGate()`、`M` = `syncUrl()`（terser 今天的局部名，非稳定标识）。
    // 重新构建后必须逐枚重数——命中数 ≠ 1 由 `apply` 拦成退 2，不会静默放行。
    from: 'Te()}finally{M()}}', to: 'Te()}finally{}}',
    why: 'U5 那格专判程序化写回：「全部展开」把 `context` 直接写成 all、不经过用户的那次 change 事件，'
      + '只挂 change 监听的口径漏的就是这一条路。连带两条都是同一处出口的账：U3 的「抛了也要镜像」'
      + '走的是 mode 那一发（也在 retune 里），U4 的 diff 那一发拨的是 df-layout（同样走 retune）——'
      + '而 `ws` / `case` 那一族的同步另有出口，所以 U3 的「确实写过」照绿、json 页那几格照绿',
  },
  {
    id: 'T7', name: 'reset 那一段的同步摘掉（重置之后地址栏留在重置前那一档）',
    expect: '[U5] 「恢复默认档」把键删干净',
    cascade: ['[U7] 重置删键'],
    from: ',Te(),M(),void T("bar","档位回到默认', to: ',Te(),void T("bar","档位回到默认',
    why: 'U5 与 U7 各有一格判「重置即删键」，两格读的是同一个出口，必然一起红。'
      + '这一刀与 T6 分开是有必要的：T6 摘的是三个下拉共用的那一个出口，这一刀摘的是「落回默认要删键」'
      + '这一半——只有它红的时候，说明 change 那条路是通的、程序化那两条路里只有重置断了',
  },
  {
    id: 'T8', name: '名单里塞进 `query`（用户敲进来的检索词进地址栏）',
    expect: '[U6] json 的输入不进地址栏',
    from: 'We=To[q].sides[K].controls.filter(e=>"select"===e.type&&"query"!==e.id).map(e=>({name:`${h}-${e.id}`,control:e.id,kind:"select",options:e.options,dflt:e.options[0]}))',
    to: 'We=To[q].sides[K].controls.filter(e=>"select"===e.type||"query"===e.id).map(e=>({name:`${h}-${e.id}`,control:e.id,kind:"select",options:e.options||[""],dflt:e.options?e.options[0]:""}))',
    why: 'U6 是这一族最贵的一格：检索词一旦进地址栏，复制出去的链接就带着用户粘进来的内容。'
      + '刀写成 `options||[""]` 而不是直接把 `query` 塞进去，是为了让这一刀**只红它该红的那一格**——'
      + '裸 `query` 进名单会带着 `c.options` 是 undefined 一起进（共用层读它就抛），整页装配当场死掉，'
      + '那时报的「红」是十格的连带而不是这一条行为，归因不到名单。空串那枚 dflt 让没内容时一个字节都不写，'
      + '所以 U1/U2/U3/U4 全照旧绿、只有铺进 token 之后的 U6 红',
  },
  {
    id: 'T9', name: '写地址栏时不带 location.hash',
    expect: '[U7] 写地址栏不许洗 hash',
    from: '${e.hash||""}`;try{', to: '`;try{',
    why: 'U7 带 `#main` 进站、点重置，判的是「删键」与「留着锚点」这两件事同时成立；'
      + '拼 URL 时不带走 hash，档位一改就把用户原来盯着的那一节弄丢（页面会跳回顶部）。'
      + '「重置删键」那格照绿——这一刀只动 hash 那一段，键删得干干净净',
  },
  {
    id: 'T10', name: 'retune 的同步从 finally 挪回 try 末尾（算砸了就跳）',
    expect: '[U3] diff·抛了也要镜像',
    from: 'Te()}finally{M()}}', to: 'Te(),M()}finally{}}',
    why: '这一刀是 Task 3 落地时改掉的那处真缺陷的反证：`readControls()` 在 try 之前就把新档写进了状态、'
      + '控件也已经是新的一档，而 `compute()` 会在「两边都还空着」与「JSON 档读到非法 JSON」先抛'
      + '——同步排在最后一行就跟着一起跳过去，屏幕指着「JSON」而链接写着「text」，刷新即回弹。'
      + '与 T6 的区别是这一刀的同步在**不抛**的路上照样工作：U5 那格（点展开、拨档位）照绿、'
      + 'U4 照绿，只有「抛了也要镜像」这一格红。如果只有 T6，这一族的这条契约其实没牙',
  },
];

/**
 * 三项**量具自己**的自检。为什么与十刀同级：十刀里「这一本跑过了」这句话依赖的正是这三件事——
 * 锚点找不到时不许静默算通过、副本闸门不许形同虚设、每轮还原必须真的还原。
 * 任何一项哑了，十刀的红与绿都归因不到注入本身。
 *
 * @type {Array<{id:string,name:string,run:function():{lit:boolean,note:string}}>}
 */
const SELFS = [
  {
    id: 'S1', name: '空刀自检：锚点不存在时 apply 必须抛 status=2，不许当成「已注入」',
    run: () => {
      let status = 0;
      try {
        apply({ from: 'TU_TEETH_ABSENT_4c8f2b', to: 'X' });
      } catch (err) {
        status = err.status ?? -1;
      }
      restore();
      return { lit: status === 2, note: `apply 对不存在的锚点抛 status=${status}（判线 =2；0 就是「静默没落地」）` };
    },
  },
  {
    id: 'S2', name: '隔离闸门自检：TU_SITE_DIR 指到仓库 _site 或不设，这一本与 harness 都必须退 2',
    run: () => {
      // 两道闸门各自执法：这一本不许往共享产物里注错，harness 不许把共享输出当成被测树
      //（读到并行会话刚重建的那一份，十刀会一起报「绿」——那是最省事的假通过）。
      const code = (file, env) => {
        let out = '';
        try {
          out = execFileSync('node', [file], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 32 << 20 });
          return { status: 0, out };
        } catch (err) {
          return { status: err.status ?? -1, out: `${err.stdout || ''}${err.stderr || ''}` };
        }
      };
      const shared = { ...process.env, TU_SITE_DIR: path.join(ROOT, '_site') };
      const unset = (() => { const e = { ...process.env }; delete e.TU_SITE_DIR; return e; })();
      const mine = [code(SELF, shared), code(SELF, unset)];
      const gate = [code(HARNESS, shared), code(HARNESS, unset)];
      const GUARD = 'TU_SITE_DIR';
      const named = (r) => (r.status === 2 && r.out.includes(GUARD));
      return {
        lit: mine.every(named) && gate.every(named),
        note: `这一本：指到仓库 _site 退 ${mine[0].status}、不设退 ${mine[1].status}；harness：指到仓库 _site 退 ${gate[0].status}、不设退 ${gate[1].status}（四个都必须是 2，且都点名 TU_SITE_DIR）`,
      };
    },
  },
  {
    id: 'S3', name: '还原自检：把副本写坏必须按 md5 复原，且检测器抓得住人为的错位',
    run: () => {
      const f = path.join(SITE, REL[1]);
      fs.appendFileSync(f, '/* teeth: deliberate corruption */');
      restore();
      const back = diffAgainst(PRISTINE).length === 0;
      const fake = { ...PRISTINE, [REL[1]]: 'not-a-real-md5' };
      const caught = diffAgainst(fake);
      return {
        lit: back && caught.length === 1 && caught[0] === REL[1],
        note: `写坏后复原=${back ? '三本 md5 全等' : '有件对不上'}；人为错位被抓出 ${caught.length} 件（${caught.join(' ') || '无'}）`,
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
    out = execFileSync('node', [HARNESS], {
      cwd: ROOT, env: { ...process.env, TU_SITE_DIR: SITE },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 420000, maxBuffer: 64 << 20,
    });
  } catch (err) {
    status = err.status ?? -1;
    out = `${err.stdout || ''}${err.stderr || ''}`;
  }
  const file = path.join(LOGDIR, `${tag}.log`);
  fs.writeFileSync(file, `# exit=${status}\n${out}`);
  return { status, out, file };
}

/** 只取末尾那份红点清单（`  [U1] …：…`），它是 harness 自己的汇总，比过程行更稳。 */
const redLines = (out) => out.split('\n').filter((l) => /^ {2}\[U\d/.test(l)).map((l) => l.trim());

const fails = [];
let lit = 0;
const planned = ONLY ? MUTS.concat(SELFS).filter((x) => ONLY.includes(x.id)).length : MUTS.length + SELFS.length;
console.log(`牙齿自证：副本 ${SITE}｜三本 md5 ${REL.map((r) => `${r.split('/').pop()}=${PRISTINE[r].slice(0, 8)}`).join(' ')}｜日志 ${LOGDIR}${ONLY ? `｜只跑 ${ONLY.join(',')}` : ''}`);

// 基线：不动任何文件时，U1–U7 必须**全绿**。这不是走过场——基线本身红的话，
// 十刀报的「红在预期那一格」只是把已有的红复述一遍，归因不到注入。
{
  const r = runHarness('baseline');
  if (r.status !== 0) {
    console.log(`✗ 基线不绿（退 ${r.status}）：先修 harness 或产物，十刀此时无从归因\n` + redLines(r.out).map((l) => '    ' + l).join('\n') + `｜${r.file}`);
    process.exit(2);
  }
  console.log('✓ 基线：副本上 U1–U7 全绿（下面的红才可能是注入带来的）');
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

console.log(`\n${fails.length ? '✗' : '✓'} 地址栏牙齿：${lit}/${planned} 点燃｜日志 ${LOGDIR}`);
for (const f of fails) console.log('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
