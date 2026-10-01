/**
 * 文件对比页的装配层（段 5 Task 5；§Z 后半）。把 `tools-diff.html` 里那一整块静态骨架接到两本纯模块
 * （§X 的行级引擎、§Y 的 JSON 感知比对）与本页视图层（`diffView.js`）上，算完的结果一律交给视图层的
 * 生成器拼串，再由**唯一的一处** `innerHTML` 出口写进结果区。
 *
 * 这一层存在的理由与 `jsonWorkbench.js` 同源，也只有一条：**控件与动作的对应关系只允许有一处**。
 * 三栏控件、十四枚按钮、两行状态读数、两枚栏内复制、显隐段，如果"哪个 id 属于哪一格"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，改一处漏一处，而漏掉那一处只在页面上表现为"点了没反应"。所以这里用
 * `DIFF_SPEC` / `DIFF_ACTIONS` 声明控件、开关与动作，所有 id 由那七枚 helper 派生；HTML 里的
 * `data-df-when` 是写给人和样式看的标记，运行时不读它，它与 spec 是否一致由门禁⑤在构建产物上对账。
 *
 * 六条红线，§Z 后半的判据逐条对着咬：
 *
 * 1. **视图层零 import**：`diffView.js` 那条红线写在它自己文件头；本层只在构造期 `createDiffView` 一次，
 *    并把那七件生成器原样暴露在 `view` 这一格上（Z17 数的就是它——多一件是第二条渲染路径，少一件是有
 *    一格没人画）。
 * 2. **环境只在入口**（Z14、Z15）：`window` / `globalThis` / `Date.now(` / `localStorage` / `navigator.`
 *    / `new Blob` / `URL.` / `getComputedStyle` / `querySelector` / `setTimeout(` / `FileReader` /
 *    `instanceof` 在本文件源码里一个都不许出现。时钟与存储这一页**根本不要**（不做"记住上次输入"，
 *    于是那句"输入不出本机"连一条退路都不必写）；`FileReader`、`TextDecoder`、`Blob` 三件、`setTimeout`
 *    与行高全从 `env` 递进来。
 *    两只读手是本页独有的：`readFile(file) → Promise<Uint8Array>` 与 `decode(bytes) → {ok, text}`。
 *    为什么"是不是文件""是不是 UTF-8"归入口而不是本层：`instanceof` 与 `TextDecoder` 都是宿主能力，
 *    本层碰一次，§Z 的假 DOM 夹具就要多造一件假件，而那条"零环境词"的判据当场从判据退化成注释。
 *    本层只认 `{name, size}` 这个形状，并在**读之前**用 `size` 拒掉超限那份——五 MiB 的文件不该
 *    先整份进内存再说"不行"（Z27 数的就是 `readFile` 那一次有没有发生）。
 * 3. **id 只由 spec 派生**（Z16）：那七枚 helper 是唯一的地址来源，`controlIds(prefix)` 与 `DIFF_SPEC`
 *    与 `DIFF_ACTIONS` 三个方向对账；本文件不许手打以 `df-` 起头的地址串（数的是**整格字面量**，
 *    单引号、双引号、模板串三种引号都算，注释里的不算）。
 * 4. **挂载期一次计算都不做**（Z18）：`mount()` 只接线、画空态、按 `gate` 刷新一次闸门读数；比对只在
 *    按动作时发生，所以二十次 `input` 之后注入的 `runGuarded` 计数必须是 0（`input` 那一发只排一次
 *    防抖读数，不进边界），结果区里一行 `df-row` 都不许有。防抖靠**令牌**而不是 `clearTimeout`：
 *    时钟由入口注入，本层不该再多要一只取消延时的手。
 * 5. **两类失败分两条路**（Z26）：用户那一格不能用（两边都空 / 一侧空 / 坏 JSON / 超闸门 / 没选文件）
 *    → `FieldError` → 一句话进控制栏的状态行，别的什么都不塌；模块或骨架自己抛的（spec 与骨架漂移出的
 *    档位、缺席的节点）→ 原样上抛，交给注入的 `runGuarded` 记"这一块坏了"。两条路都**不许把上一格的
 *    结果擦掉**——先算后画，抛一定发生在画之前。
 * 6. **档位只有一个口径**（Z20、Z21）：折叠的四个档住在 `context` 那一枚下拉里，`expand` / `fold` /
 *    `diffOnly` 三枚按钮是它的**快捷键**（写回同一枚 `select`，不复算第二份状态）；跳转的三枚读的是
 *    同一份 hunk 清单；并排与行内两档视图读的是同一份行流，切布局本身不重算。
 *
 * 与 `jsonWorkbench.js` 的分工：那一本服务 JSON 页（单个工作区、粘贴框为主、外加只渲染可视行的树），
 * 这一本服务对比页（两栏输入、一条控制栏、行级与 JSON 两种口径）。两本互不 import；`diffView.js`
 * 在全仓库只许被本文件 reach（`jsonView.js` 与 `codecView.js` 同理各自只被自己的装配层 reach）——
 * 两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，`iifeWrapPlugin` 包完就是整页
 * SyntaxError 而构建 exit=0（§0.4 那条构建红线，Z13 正反两头核它）。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §Z 二十八判。
 */
import {
  gate as coreGate, diffLines, hunksOf, unifiedText, DIFF_NOTES, CR_GLYPH,
  MAX_INPUT_BYTES, MAX_INPUT_LINES,
} from './diff-core.js';
import { diffJson, DIFF_JSON_NOTES } from './diff-json.js';
import { createDiffView } from './diffView.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/** 这一页只有一个工作区，没有面板清单：`spec.ids` 与 `DIFF_SPEC` 的键必须逐字相同（门禁⑤ :545） */
export const DIFF_PANEL_IDS = ['workbench'];

/**
 * 栏位名。与编码页的 `main` / `diff`、JSON 页的 `main` 不同，这一页是**两栏输入 + 一条控制栏**：
 * `a` 与 `b` 各带粘贴框、文件选择、文件名、状态读数与栏内复制；`bar` 带全部下拉与勾选、结果区
 * 和那一行进度读数。第三栏（"对齐视图"）在这一页没有对应的事实，Z17 钉它不许出现。
 */
export const SIDES = ['a', 'b', 'bar'];

/**
 * 行高的**退路值**：权威在 `dev/sass/toolDiff.scss` 的 `--df-row-h` 那一格，由入口读一次再注入
 * （`env.rowHeight`，红线 2）。跳转那一枚把"第几块"换算成 `scrollTop` 只认这一个整数——样式那本改
 * 行高时不必改这里（入口读得到新值）；这里改而不改样式，只在"样式读不到"那一条路上生效。
 */
const ROW_HEIGHT = 24;

/** 闸门读数（行 / 字节）随 `input` 刷新的防抖时长；真页面上由入口注入的那只延时承载 */
const DEBOUNCE_MS = 200;

/** 三枚档位下拉的默认值：骨架那格给空串时落在这里；非空而不在白名单里一律上抛（Z21 的 `'9'`） */
const DEFAULTS = { mode: 'text', layout: 'side', context: '3' };

/**
 * 折叠档位的唯一解释表（红线 6）。`diff` 是"只看差异行"= 上下文 0 行；`all` 是"全部展开"= 上下文
 * `Infinity`——`hunksOf` 在 `Infinity` 那一档把相邻差异块合成一块，折叠条因此自然归零，这正是"展开"
 * 要的形状，本层不必再判一次"要不要收拢"。
 */
const CONTEXT_VALUE = { diff: 0, 3: 3, 5: 5, all: Infinity };

/** `bar` 那一枚 `mode` 下拉的取值档：`switch.targets` 的 `when` 只能是它的子集（Z17） */
const MODE_OPTIONS = ['text', 'json'];

/** 布局两档：并排两栏读同一份行流；行内摊成一栏，`change` 那一行拆成两行各取一半高亮 */
const LAYOUT_OPTIONS = ['side', 'inline'];

/** 侧栏的显示名：状态行与报错文案里用它，`'a'` / `'b'` 这种内部名字不上屏 */
const SIDE_NAME = { a: 'A 侧', b: 'B 侧', bar: '这一页' };

/** 一 MiB 的字节数：超限文案里"上限"那一格要说的是这个数，不是 `MAX_INPUT_BYTES` 那串裸整数 */
const MIB = 1048576;

/** 用户那一格不能用的那类失败：走状态行那一句话，不进 `runGuarded` 的账（红线 5 的第一条路） */
class FieldError extends Error {
  /**
   * @param {string} message 直接上屏的那一句话
   */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
  }
}

/** 控件 id：`{p}-in-{面板}-{控件}`。栏位编在**控件 id** 里（`a-text` / `b-file`），因为门禁⑤ 的这条
 * 公式没有栏位那一维（§0.6 记的偏差） */
export const fieldId = (p, panel, id) => `${p}-in-${panel}-${id}`;
/** 动作按钮 id：`{p}-btn-{面板}-{key}` */
export const buttonId = (p, panel, key) => `${p}-btn-${panel}-${key}`;
/** 结果区 id：`{p}-out-{面板}-{栏}` */
export const outId = (p, panel, side) => `${p}-out-${panel}-${side}`;
/** 状态读数 id：`{p}-status-{面板}-{栏}` */
export const statusId = (p, panel, side) => `${p}-status-${panel}-${side}`;
/** 栏内复制按钮 id：`{p}-copy-{面板}-{栏}` */
export const copyId = (p, panel, side) => `${p}-copy-${panel}-${side}`;
/** 显隐段 id：`{p}-when-{面板}-{key}` */
export const whenId = (p, panel, key) => `${p}-when-${panel}-${key}`;
/**
 * 节点族 → id。这一页只有 `out` / `status` / `copy` 三族，第四族 `tree` 在这里没有对应的事实
 * （JSON 页那一族由 `jsonWorkbench.js` 自己解释）；`DIFF_SPEC` 里多写一族就是骨架私自长一格。
 * @param {string} p 前缀
 * @param {string} panel 面板
 * @param {string} fam 族名
 * @param {string} side 栏位
 * @returns {string}
 */
export const nodeId = (p, panel, fam, side) => {
  if (fam === 'out') return outId(p, panel, side);
  if (fam === 'status') return statusId(p, panel, side);
  if (fam === 'copy') return copyId(p, panel, side);
  throw new RangeError(`DIFF_SPEC 的 ${side} 栏声明了节点族「${String(fam)}」：这一页只有 out / status / copy 三族`);
};

/**
 * 控件与显隐开关的唯一声明处（门禁⑤ DOM 组比的就是这张表的 `controls` 与 `switch.targets`）。
 * `nodes` 由每一栏**自己声明**：并排视图只有一个结果区（住在 `bar`），两条输入栏各有一行读数和一枚
 * 栏内复制——写死四族会让这一页去要六个它根本没有的 id（收录面那颗牙因此按这一格拆）。
 * `gutter: false` 是给门禁⑤ 的退出闸：那一格只对 `type: 'area'` 存在"行号槽"这一说，而对比页的
 * 两个粘贴框按设计不带行号——行号在结果区的行块里，输入区的行号对"两份文本"没有意义。
 */
export const DIFF_SPEC = {
  workbench: {
    sides: {
      a: {
        kind: 'workbench',
        nodes: ['status', 'copy'],
        controls: [
          { id: 'a-text', type: 'area', gutter: false },
          { id: 'a-file', type: 'file' },
          { id: 'a-name', type: 'text' },
        ],
      },
      b: {
        kind: 'workbench',
        nodes: ['status', 'copy'],
        controls: [
          { id: 'b-text', type: 'area', gutter: false },
          { id: 'b-file', type: 'file' },
          { id: 'b-name', type: 'text' },
        ],
      },
      bar: {
        kind: 'workbench',
        nodes: ['out', 'status'],
        controls: [
          { id: 'mode', type: 'select', options: MODE_OPTIONS },
          { id: 'layout', type: 'select', options: LAYOUT_OPTIONS },
          { id: 'context', type: 'select', options: Object.keys(CONTEXT_VALUE) },
          { id: 'ws', type: 'checkbox' },
          { id: 'case', type: 'checkbox' },
        ],
        switch: {
          by: 'mode',
          targets: [
            { key: 'text', when: ['text'] },
            { key: 'json', when: ['json'] },
          ],
        },
      },
    },
  },
};

/**
 * 工具栏那五段的动作清单：`key` 派生按钮 id，`group` 是这一枚归哪一族（Z17 按族名单核对），
 * `to` 只有折叠那三枚有——它们是 `context` 下拉的**快捷键**，写回那一枚 `select` 而不另存一份状态。
 * `label` 与骨架里 `<button>` 的文案逐字相同（门禁⑤ 比的就是这两处同字）。
 */
export const DIFF_ACTIONS = [
  { key: 'compare', group: 'run', label: '重新对比' },
  { key: 'swap', group: 'run', label: '交换两侧' },
  { key: 'clear', group: 'run', label: '清空输入' },
  { key: 'reset', group: 'run', label: '恢复默认档' },
  { key: 'expand', group: 'fold', label: '全部展开', to: 'all' },
  { key: 'fold', group: 'fold', label: '上下文三行', to: '3' },
  { key: 'diffOnly', group: 'fold', label: '只看差异', to: 'diff' },
  { key: 'firstDiff', group: 'goto', label: '第一处差异' },
  { key: 'prevDiff', group: 'goto', label: '上一处' },
  { key: 'nextDiff', group: 'goto', label: '下一处' },
  { key: 'fileA', group: 'file', label: '选 A 侧文件' },
  { key: 'fileB', group: 'file', label: '选 B 侧文件' },
  { key: 'copyDiff', group: 'copy', label: '复制差异' },
  { key: 'download', group: 'copy', label: '下载 .diff' },
];

/** 这一页只有一个面板，那七枚 helper 的中间那一格全是它 */
const PANEL = DIFF_PANEL_IDS[0];

/**
 * 整页地址清单：门禁⑤ 与 §Z 的三个方向对账都读这一份。
 * @param {string} p 前缀
 * @returns {{fields: string[], nodes: string[], when: string[], buttons: string[]}}
 */
export const controlIds = (p) => {
  const fields = [];
  const nodes = [];
  const when = [];
  const buttons = [];
  for (const slug of DIFF_PANEL_IDS) {
    for (const side of Object.keys(DIFF_SPEC[slug].sides)) {
      const cfg = DIFF_SPEC[slug].sides[side];
      for (const c of cfg.controls || []) fields.push(fieldId(p, slug, c.id));
      for (const fam of cfg.nodes || []) nodes.push(nodeId(p, slug, fam, side));
      for (const tg of (cfg.switch || {}).targets || []) when.push(whenId(p, slug, tg.key));
    }
    for (const a of DIFF_ACTIONS) buttons.push(buttonId(p, slug, a.key));
  }
  return { fields, nodes, when, buttons };
};

// ── 装配 ─────────────────────────────────────────────────────────────────────

/**
 * 接一页。
 * @param {object} env 由 `toolDiff.js` 递进来的环境
 * @param {object} env.document 真 `document`
 * @param {object} env.Tk `window.Tk`（这一页只吃 `view.esc` 那一格）
 * @param {string} env.prefix 前缀
 * @param {Function} [env.runGuarded] `(id, fn) => boolean`：坏消息的边界，本层只管抛
 * @param {Function} env.later `(fn, ms) => number`：防抖那一只延时
 * @param {object} [env.navigator] 只借 `clipboard` 那一格
 * @param {number} [env.rowHeight] 行高（样式给的环境量），非 `≥1` 的整数当场 `RangeError`
 * @param {Function} [env.BlobCtor] 下载三件之一，按工厂调用（本层不写 `new Blob`）
 * @param {Function} [env.createObjectURL] 下载三件之二
 * @param {Function} [env.revokeObjectURL] 下载之三，一律落在 `finally`
 * @param {Function} [env.readFile] `(file) => Promise<Uint8Array>`：缺席就是"这台浏览器不给读文件"
 * @param {Function} [env.decode] `(bytes) => {ok: boolean, text: string}`：UTF-8 的判断在入口
 * @returns {{mount: Function, state: Function, view: object}} `view` 是视图层那七件，原样暴露
 */
export function createDiffWorkbench(env) {
  const tk = env.Tk || {};
  /** 视图层只借转义那一只；`prefix` 与 `crGlyph` 由本层给（前者是页面地址、后者是 §X 的字形约定） */
  const view = createDiffView({ esc: tk.view && tk.view.esc, prefix: env.prefix, crGlyph: CR_GLYPH });
  const esc = tk.view && tk.view.esc;
  if (env.rowHeight !== undefined && (!Number.isInteger(env.rowHeight) || env.rowHeight < 1)) {
    throw new RangeError(`env.rowHeight 得是 ≥1 的整数像素（权威在样式那一格），这里是 ${String(env.rowHeight)}`);
  }
  /** 有读文件这两只手才谈得上"选本地文件"；缺了就把两枚按钮与两个 `input` 一起置灰（Z27 最后一档） */
  const canReadFiles = typeof env.readFile === 'function' && typeof env.decode === 'function';
  const canDownload = typeof env.BlobCtor === 'function'
    && typeof env.createObjectURL === 'function' && typeof env.revokeObjectURL === 'function';
  const nav = env.navigator;
  const clip = nav ? nav.clipboard : undefined;
  const rowHeight = env.rowHeight === undefined ? ROW_HEIGHT : env.rowHeight;

  /**
   * 这一页的全部状态。`out` 是"最近一次可比复制的文本"，复制与下载读的就是这一格（Z19 判两边同字）；
   * `computes` 与 `gateReads` 是给 §Z 看的两个计数器，也是红线 4 唯一的量具——没有它们，
   * "挂载期不计算"这件事在页面上根本读不出来。
   */
  const s = {
    computes: 0, gateReads: 0, out: '', produced: null, result: null,
    hunks: [], rows: [], at: 0,
    textA: '', textB: '', nameA: '', nameB: '',
    mode: DEFAULTS.mode, layout: DEFAULTS.layout, context: DEFAULTS.context,
  };
  const nodes = new Map();
  let gateToken = 0;

  /** 取节点：`mount` 建好索引之后一律读索引，缺席那一格要指名道姓地抛（Z26 的第二类失败） */
  const node = (id) => {
    if (!nodes.has(id)) {
      throw new RangeError(`骨架里没有 id="${id}" 这一格：DIFF_SPEC 与 tools-diff.html 漂了，装配层要读它而页面没有`);
    }
    return nodes.get(id);
  };
  const field = (id) => node(fieldId(env.prefix, PANEL, id));
  const btn = (key) => node(buttonId(env.prefix, PANEL, key));
  const resultBox = () => node(outId(env.prefix, PANEL, 'bar'));
  /** 状态行只走 `textContent`：那一格是句子，不是标记 */
  const say = (side, text) => { node(statusId(env.prefix, PANEL, side)).textContent = text; };
  /** 结果区唯一的写入口——红线里"整页只有一处 innerHTML"的那一处 */
  const paint = (html) => { resultBox().innerHTML = html; };

  /** 读一枚下拉：空串落默认档，非空而白名单外一律上抛（骨架或用户改出个 spec 不认的档位就是漂移） */
  const selectOf = (id, options, fallback) => {
    const raw = String(field(id).value || '');
    if (raw === '') return fallback;
    if (!options.includes(raw)) {
      throw new RangeError(`${id} 的档位是「${raw}」，而 DIFF_SPEC 只认 ${options.join(' / ')}：骨架的 <option> 与 spec 漂了`);
    }
    return raw;
  };
  const flag = (id) => field(id).checked === true;

  /** 把控件的当前状态读进 `s`：一次计算的第一步，也是"只读一次"的那一步 */
  const readControls = () => {
    s.textA = String(field('a-text').value || '');
    s.textB = String(field('b-text').value || '');
    s.nameA = String(field('a-name').value || '');
    s.nameB = String(field('b-name').value || '');
    s.mode = selectOf('mode', MODE_OPTIONS, DEFAULTS.mode);
    s.layout = selectOf('layout', LAYOUT_OPTIONS, DEFAULTS.layout);
    s.context = selectOf('context', Object.keys(CONTEXT_VALUE), DEFAULTS.context);
    return { ws: flag('ws'), case: flag('case') };
  };

  /** 千分位只给"行数"这种大数用；`toLocaleString` 的 locale 写死，两台机器要给出同一个字符串 */
  const n = (v) => Number(v).toLocaleString('en-US');
  /** 字节读数：不到 1 MiB 说 KB（保留一位），到了就说 MB——五 MiB 的闸门用"5242880 字节"没人读得懂 */
  const kb = (bytes) => (bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`);

  /**
   * 闸门读数：两栏各一行「N 行 · 大小」，超限那一档点名多了多少。
   * 这一件事在挂载时跑一次、之后随 `input` 的防抖跑，**不算一次比对**（`computes` 不涨，Z18 判的就是
   * 它）：`gate` 只数行与字节，两份 5 MiB 的文本贴进去也绝不该在这里跑一遍 Myers。
   */
  const refreshGate = () => {
    const a = String(field('a-text').value || '');
    const b = String(field('b-text').value || '');
    const g = coreGate(a, b);
    s.gateReads += 1;
    for (const side of ['a', 'b']) {
      const part = side === 'a' ? g.a : g.b;
      const head = `${n(part.count)} 行 · ${kb(part.bytes)}`;
      const blocked = !g.ok && (g.which === side || g.which === 'both');
      if (!blocked) { say(side, head); continue; }
      const overKey = g.reason === 'bytes' ? `bytes${side.toUpperCase()}` : `lines${side.toUpperCase()}`;
      const over = g.over[overKey];
      const limit = g.reason === 'bytes' ? `${MAX_INPUT_BYTES / MIB} MiB` : `${n(MAX_INPUT_LINES)} 行`;
      say(side, `${head}｜这一侧超了闸门约 ${n(over)} ${g.reason === 'bytes' ? '字节' : '行'}（上限 ${limit}）`);
    }
  };
  /** 防抖那枚令牌：只有最后排上的那一发真的读数（本层没有第二只取消延时的手） */
  const scheduleGate = () => {
    const token = ++gateToken;
    env.later(() => { if (token === gateToken) refreshGate(); }, DEBOUNCE_MS);
  };

  /** JSON 档的可复制文本：一行一处变更，与表里那六列同序（复制与下载读的就是这一串） */
  const jsonToText = (j) => j.changes
    .map((c) => `${c.kind}\t${c.pointer === '' ? '/' : c.pointer}\t${c.owner}\t${c.aPreview ?? ''}\t${c.bPreview ?? ''}`)
    .join('\n');

  /** 换一次算一次：`compute` 只算不画，抛出去的一切都在画之前（红线 5） */
  const compute = (opts) => {
    if (s.mode === 'json') {
      const j = diffJson(s.textA, s.textB);
      if (j.verdict === 'invalid') {
        const e = j.error || {};
        throw new FieldError(`比不了：${SIDE_NAME[e.which] || '其中一侧'}第 ${e.line ?? '?'} 行第 ${e.column ?? '?'} 列${e.reason ? `——${e.reason}` : ''}。要按文本逐行比，切回「文本」档。`);
      }
      s.result = null;
      s.hunks = [];
      s.rows = [];
      s.at = 0;
      s.out = j.changes.length === 0 ? '' : jsonToText(j);
      s.produced = j;
      s.computes += 1;
      return j;
    }
    if (s.textA === '' && s.textB === '') {
      throw new FieldError('两边都还空着：贴进两份文本，或各选一个本地文件，再按「重新对比」。');
    }
    if (s.textA === '' || s.textB === '') {
      throw new FieldError(`${SIDE_NAME[s.textA === '' ? 'a' : 'b']}还是空的，另一半没有可以跟它比的东西。`);
    }
    const result = diffLines(s.textA, s.textB, opts);
    if (result.verdict === 'blocked') {
      const which = result.blocked.which === 'both' ? '两边' : SIDE_NAME[result.blocked.which];
      const over = result.blocked.over || {};
      const delta = Math.max(over.bytesA ?? 0, over.bytesB ?? 0, over.linesA ?? 0, over.linesB ?? 0);
      const limit = result.blocked.reason === 'bytes' ? `${MAX_INPUT_BYTES / MIB} MiB` : `${n(MAX_INPUT_LINES)} 行`;
      throw new FieldError(`超出闸门：${which}多了约 ${n(delta)} ${result.blocked.reason === 'bytes' ? '字节' : '行'}（上限 ${limit}）。这一页不做"截断悄悄算"，把大的一份拆开再比。`);
    }
    s.result = result;
    s.produced = result;
    s.hunks = hunksOf(result, CONTEXT_VALUE[s.context]);
    s.rows = s.hunks.reduce((acc, h) => acc.concat(h.rows), []);
    s.at = 0;
    s.out = unifiedText(result, { a: s.nameA, b: s.nameB, context: CONTEXT_VALUE[s.context] });
    s.computes += 1;
    return result;
  };

  /**
   * 一份行流在这一档里占几个**视觉行**：并排两栏各一份，`rows.length` 就是一块的高度；行内把
   * `change` 摊成两行。跳转那一枚算 `scrollTop` 用的是这个数，不是 `rows.length`——两档共用同一份
   * 行流但不同高，这是切布局之后唯一会变的量。
   * @param {object[]} rows 一块 hunk 的行
   * @returns {number}
   */
  const linesOf = (rows) => (s.layout === 'inline'
    ? rows.reduce((acc, r) => acc + (r.kind === 'change' ? 2 : 1), 0)
    : rows.length);

  /**
   * 一块差异的正文。并排档两栏各读同一份行流（`renderSide(rows, 'a')` / `(rows, 'b')`，缺席那一侧
   * 由视图层长成 `--fill`，不是少一行）；行内档把那份行流摊成一栏，`change` 那一行**拆成两行**、
   * 各取一半高亮。两档共用同一份 `hunksOf` 产出，所以切布局不重算（Z20 判的就是这件事）。
   *
   * 行内那一档逐行调 `renderSide([row], side)`：视图层没有"整栏一次给两栏"的第二件，而本层也不许
   * 自己拼行块（红线 1）。代价是 `data-df-i` 在行内档是每发各从 0 数——那一格是给视图层自己看
   * 的形状标记，页面上定位读的是 `data-df-ln`（真行号）与折叠条前的兄弟计数。
   * @param {object[]} rows 一块 hunk 的行
   * @returns {string}
   */
  const block = (rows) => {
    const p = env.prefix;
    if (s.layout === 'inline') {
      let body = '';
      for (const r of rows) {
        if (r.kind === 'change') body += view.renderSide([r], 'a') + view.renderSide([r], 'b');
        else body += view.renderSide([r], r.kind === 'ins' ? 'b' : 'a');
      }
      return `<div class="${p}-lines">${body}</div>`;
    }
    const col = (side) => `<div class="${p}-col ${p}-col--${side}">${view.renderSide(rows, side)}</div>`;
    return `<div class="${p}-cols">${col('a')}${col('b')}</div>`;
  };

  /** 代价说明那一列：只说真的发生了的那几句，最后一句是本页的口径承诺 */
  const notesOf = (produced) => {
    const list = [];
    if (produced.degraded) list.push(DIFF_NOTES.degraded);
    if (produced.stats.inlineSkipped > 0) list.push(DIFF_NOTES.inlineSkipped);
    if (produced.stats.ignored > 0) list.push(DIFF_NOTES.ignored);
    if (produced.a.finalNewline !== true || produced.b.finalNewline !== true) list.push(DIFF_NOTES.finalNewline);
    list.push(DIFF_NOTES.gitApply);
    list.push(DIFF_NOTES.noUpload);
    return list;
  };

  /** 结果区正文：结论 → 读数 → 逐块（前折叠条 + 块）→ 尾折叠条 → 代价说明 */
  const bodyOf = (produced) => {
    const p = env.prefix;
    if (s.mode === 'json') {
      return view.renderVerdict({ mode: 'json', verdict: produced.verdict, stats: produced.stats })
        + view.renderJsonTable({
          changes: produced.changes, stats: produced.stats, notes: Object.values(DIFF_JSON_NOTES),
          truncated: produced.truncated,
        });
    }
    let html = view.renderVerdict({
      mode: 'text', verdict: produced.verdict, stats: produced.stats, degraded: produced.degraded,
    }) + view.renderStats(produced.stats);
    s.hunks.forEach((h, k) => {
      html += view.renderFoldBar({ skipped: h.skipped });
      html += block(h.rows);
      if (k === s.hunks.length - 1) html += view.renderFoldBar({ skipped: h.tailSkipped, tail: true });
    });
    const notes = notesOf(produced);
    return html + `<ul class="${p}-notes">${notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  };

  /**
   * 档位、置灰与显隐的收尾——一切"状态变了而内容不必重算"的那一路共用这一发。
   * 折叠与跳转那六枚在 JSON 档没有意义（那一档按格比对，没有"第几块"与"上下文"这一说），整排置灰
   * 而不是"按了报错"；复制与下载在没有结果时同样置灰，比"按下去说一句空的"更省事。
   */
  const syncGate = () => {
    const p = env.prefix;
    const targets = DIFF_SPEC[PANEL].sides.bar.switch.targets;
    for (const tg of targets) {
      node(whenId(p, PANEL, tg.key)).hidden = !tg.when.includes(s.mode);
    }
    for (const a of DIFF_ACTIONS) {
      if (a.group === 'fold' || a.group === 'goto') btn(a.key).disabled = s.mode === 'json';
    }
    const hasOut = s.out !== '';
    for (const a of DIFF_ACTIONS) {
      if (a.group === 'copy') btn(a.key).disabled = !hasOut;
    }
  };

  /** 算 + 画 + 收尾；抛出去的东西由调用侧（`act`）决定走哪条路 */
  const run = () => {
    const opts = readControls();
    const produced = compute(opts);
    paint(bodyOf(produced));
    resultBox().scrollTop = 0;
    syncGate();
    return produced;
  };

  /** 跳到第 `index` 块（0 起）：两端钳住，状态行报「第 i / n 处差异」 */
  const goTo = (index) => {
    if (s.mode === 'json') throw new FieldError('JSON 档按格比对，没有"第几处差异"这一说：切回「文本」档再跳。');
    if (s.hunks.length === 0) throw new FieldError('两份内容没有差异块，跳转这一档用不上。');
    const at = Math.min(Math.max(index, 0), s.hunks.length - 1);
    let units = 0;
    for (let k = 0; k < at; k += 1) units += linesOf(s.hunks[k].rows) + (s.hunks[k].skipped > 0 ? 1 : 0);
    units += s.hunks[at].skipped > 0 ? 1 : 0;
    resultBox().scrollTop = units * rowHeight;
    s.at = at + 1;
    say('bar', `第 ${s.at} / ${s.hunks.length} 处差异`);
  };

  /**
   * 写剪贴板。这一页只有 `navigator.clipboard` 这一只手，缺了或浏览器拒了都明说，不退到
   * `execCommand`（那一档在隐私模式下同样不保，而多一条路就多一处"两台机器给两个答案"）。
   * @param {string} text 要写的正文
   * @param {string} where 那一句里说"复制的是什么"
   * @returns {Promise<void>}
   */
  const copy = (text, where) => {
    if (text === '') throw new FieldError(`还没有${where}：先按「重新对比」，或把要复制的那一栏填上内容。`);
    if (!clip || typeof clip.writeText !== 'function') {
      throw new FieldError('这台浏览器不给网页写剪贴板：选中结果区那一段，用系统自己的复制。');
    }
    return Promise.resolve(clip.writeText(text)).then(
      () => say('bar', `已复制${where}`),
      () => say('bar', `复制${where}没被浏览器允许：选中结果区那一段，用系统自己的复制。`),
    );
  };

  /** 下载那一份可复制文本：三件全从入口来，对象 URL 一律在 `finally` 里收回（被拦的下载不泄） */
  const download = () => {
    if (!canDownload) throw new FieldError('这台浏览器缺少下载所需的能力（Blob 或对象 URL）：改用「复制差异」。');
    if (s.out === '') throw new FieldError('还没有可比对的结果：先按「重新对比」。');
    const url = env.createObjectURL(env.BlobCtor([s.out], { type: 'text/plain;charset=utf-8' }));
    try {
      const a = env.document.createElement('a');
      a.href = url;
      a.download = s.mode === 'json' ? 'changes.json-diff.txt' : 'changes.diff';
      a.click();
    } finally {
      env.revokeObjectURL(url);
    }
    say('bar', '已导出那一份差异');
  };

  /**
   * 选本地文件那一路：**先按 `size` 拒，再读**（红线 2 里那一句"五 MiB 不该先整份进内存"）。
   * 编码判断也不在本层：`decode` 交回 `{ok, text}`，本层只在文本里认 NUL 与替换字符那一档——
   * `fatal` 已经拒掉了读不成的那些，这两枚补的是"读得成但根本不是文本"的那一类（把图片拖进来）。
   * @param {'a'|'b'} side 栏
   * @param {object} file `{name, size}` 形状的那个东西
   * @returns {Promise<void>}
   */
  const loadFile = async (side, file) => {
    if (!canReadFiles) throw new FieldError('这台浏览器不能在本机读文件：把文本贴进粘贴框也能比。');
    if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
      throw new FieldError(`${SIDE_NAME[side]}没有读到文件：再从本机选一个，或把文本贴进粘贴框。`);
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new FieldError(`${file.name} 超出闸门：比 ${MAX_INPUT_BYTES / MIB} MiB 多了 ${kb(file.size - MAX_INPUT_BYTES)}。这一页不做截断悄悄算，换个小的或拆开再比。`);
    }
    const bytes = await env.readFile(file);
    const d = env.decode(bytes);
    if (!d || d.ok !== true) throw new FieldError(`${file.name} 看起来不是 UTF-8 文本：存成 UTF-8 再选一次。`);
    if (/[\u0000\uFFFD]/.test(d.text)) {
      throw new FieldError(`${file.name} 看起来不是 UTF-8 文本（读到了 NUL 或替换字符）：先确认它的编码。`);
    }
    field(`${side}-text`).value = d.text;
    field(`${side}-name`).value = file.name;
    refreshGate();
    say(side, `已读入 ${file.name}`);
  };
  /** 文件那一路的两条入口：`change` 与 `drop` 汇到同一发，两条路必须同一条（Z27 判的就是它） */
  const takeFile = (side, source) => {
    loadFile(side, source && source.length > 0 ? source[0] : null).catch((err) => {
      if (err && err.name === 'FieldError') say(side, err.message);
      else throw err;
    });
  };

  /**
   * 十四枚按钮的共同落点。里面**不套第二层 try**：坏消息要么变成状态行那一句话（`FieldError`），
   * 要么原样上抛给注入的 `runGuarded`——本层自己吞掉一次抛出，那份计数就成了假账（Z26 数的正是
   * `guarded` 与 `threw` 的差）。
   * @param {string} key 动作 key
   */
  const dispatch = (key) => {
    if (key === 'compare') { run(); say('bar', '比完了'); return; }
    if (key === 'swap') {
      const a = field('a-text'); const b = field('b-text');
      const na = field('a-name'); const nb = field('b-name');
      const t = a.value; a.value = b.value; b.value = t;
      const nm = na.value; na.value = nb.value; nb.value = nm;
      refreshGate();
      run();
      say('bar', '两侧换了个位置');
      return;
    }
    if (key === 'clear') {
      for (const side of ['a', 'b']) {
        field(`${side}-text`).value = '';
        field(`${side}-name`).value = '';
        const pick = field(`${side}-file`);
        pick.files = [];
        pick.value = '';
      }
      s.out = ''; s.produced = null; s.result = null; s.hunks = []; s.rows = []; s.at = 0;
      paint(view.renderNotice('把要比较的两份内容分别贴进来，或各选一个本地文件。'));
      refreshGate();
      syncGate();
      say('bar', '输入已清空');
      return;
    }
    if (key === 'reset') {
      field('mode').value = DEFAULTS.mode;
      field('layout').value = DEFAULTS.layout;
      field('context').value = DEFAULTS.context;
      field('ws').checked = false;
      field('case').checked = false;
      readControls();
      syncGate();
      say('bar', '档位回到默认（输入没动）');
      return;
    }
    const fold = DIFF_ACTIONS.find((x) => x.key === key);
    if (fold && fold.to !== undefined) {
      field('context').value = fold.to;
      retune('context');
      return;
    }
    if (key === 'firstDiff') { goTo(0); return; }
    if (key === 'prevDiff') { goTo(s.at - 2); return; }
    if (key === 'nextDiff') { goTo(s.at); return; }
    if (key === 'copyDiff') { copy(s.out, '那一份差异'); return; }
    if (key === 'download') { download(); return; }
    if (key === 'fileA') { takeFile('a', field('a-file').files); return; }
    if (key === 'fileB') { takeFile('b', field('b-file').files); return; }
    throw new RangeError(`「${key}」在 DIFF_ACTIONS 的清单上，本层却没有对应的行为：按钮长出来了而没人接`);
  };
  /** 一次按钮动作：先过 `FieldError` 那一层，其余交给注入的边界 */
  const act = (key) => {
    const id = buttonId(env.prefix, PANEL, key);
    const inner = () => {
      try {
        dispatch(key);
      } catch (err) {
        if (err && err.name === 'FieldError') say('bar', err.message);
        else throw err;
      }
    };
    if (typeof env.runGuarded === 'function') env.runGuarded(id, inner);
    else inner();
  };

  /**
   * 档位变了而内容不必重算：`mode` / `layout` / `context` 三枚下拉与折叠那三枚快捷键共用这一发。
   * `mode` 换的是**口径**（文本 / JSON），必须重算——两张账表数的是不同的事；`layout` 与 `context`
   * 只换视图，读的还是那份 `result`（Z20 与 Z21 各自钉住这一条）。
   * @param {string} id 变了的那一枚
   */
  const retune = (id) => {
    const opts = readControls();
    if (id === 'mode') {
      const produced = compute(opts);
      paint(bodyOf(produced));
      resultBox().scrollTop = 0;
    } else if (id === 'context' && s.result) {
      s.hunks = hunksOf(s.result, CONTEXT_VALUE[s.context]);
      s.rows = s.hunks.reduce((acc, h) => acc.concat(h.rows), []);
      s.at = 0;
      paint(bodyOf(s.result));
    } else if (s.produced) {
      paint(bodyOf(s.produced));
    }
    syncGate();
  };

  return {
    view,
    /** 只读的最近状态：§Z 的判据用它数"算了几次 / 读了几次闸门"，页面不读它 */
    state: () => ({ ...s }),
    /**
     * 接线。先建节点索引（缺席的那几格进 `missing` 报告，但**不拦启动**——缺哪一格是到按那一枚
     * 按钮时才真的坏，让整页停在启动那一下等于把"还能用一半"也一起废掉），再画空态、刷一次读数。
     * @returns {{missing: string[], panels: string[]}} 缺的地址与这一页的面板清单
     */
    mount: () => {
      const list = controlIds(env.prefix);
      const all = [...list.fields, ...list.nodes, ...list.when, ...list.buttons];
      for (const id of all) {
        const el = env.document.getElementById(id);
        if (el) nodes.set(id, el);
      }
      const missing = all.filter((id) => !nodes.has(id));
      /** 没有那两只读手：两枚 `file` 输入框与那两枚按钮一起置灰，而不是"按了才发现不能用" */
      for (const side of SIDES) {
        for (const c of DIFF_SPEC[PANEL].sides[side].controls) {
          if (c.type === 'file' && nodes.has(fieldId(env.prefix, PANEL, c.id))) field(c.id).disabled = !canReadFiles;
        }
      }
      for (const a of DIFF_ACTIONS) {
        const el = nodes.get(buttonId(env.prefix, PANEL, a.key));
        if (!el) continue;
        if (a.group === 'file') el.disabled = !canReadFiles;
        el.addEventListener('click', () => act(a.key));
      }
      for (const side of ['a', 'b']) {
        const areaId = fieldId(env.prefix, PANEL, `${side}-text`);
        if (nodes.has(areaId)) {
          const area = nodes.get(areaId);
          area.addEventListener('input', scheduleGate);
          area.addEventListener('drop', (evt) => {
            if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
            takeFile(side, evt && evt.dataTransfer ? evt.dataTransfer.files : null);
          });
        }
        const pick = fieldId(env.prefix, PANEL, `${side}-file`);
        if (nodes.has(pick)) nodes.get(pick).addEventListener('change', () => takeFile(side, nodes.get(pick).files));
        const cp = copyId(env.prefix, PANEL, side);
        if (nodes.has(cp)) {
          nodes.get(cp).addEventListener('click', () => {
            const inner = () => copy(String(field(`${side}-text`).value || ''), `${SIDE_NAME[side]}的正文`);
            const wrapped = () => { try { inner(); } catch (err) { if (err && err.name === 'FieldError') say(side, err.message); else throw err; } };
            if (typeof env.runGuarded === 'function') env.runGuarded(cp, wrapped);
            else wrapped();
          });
        }
      }
      for (const id of ['mode', 'layout', 'context']) {
        const fid = fieldId(env.prefix, PANEL, id);
        if (nodes.has(fid)) {
          nodes.get(fid).addEventListener('change', () => {
            const inner = () => retune(id);
            const wrapped = () => { try { inner(); } catch (err) { if (err && err.name === 'FieldError') say('bar', err.message); else throw err; } };
            if (typeof env.runGuarded === 'function') env.runGuarded(fid, wrapped);
            else wrapped();
          });
        }
      }
      for (const id of ['ws', 'case']) {
        const fid = fieldId(env.prefix, PANEL, id);
        if (nodes.has(fid)) {
          nodes.get(fid).addEventListener('change', () => {
            const inner = () => { run(); say('bar', '归一化档变了，重比了一遍'); };
            if (typeof env.runGuarded === 'function') env.runGuarded(fid, inner);
            else inner();
          });
        }
      }
      paint(view.renderNotice('把要比较的两份内容分别贴进来，或各选一个本地文件；文件在这台机器上读取，不上传。'));
      say('bar', '还没有比较');
      refreshGate();
      syncGate();
      return { missing, panels: DIFF_PANEL_IDS.slice() };
    },
  };
}
