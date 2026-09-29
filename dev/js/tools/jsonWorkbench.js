/**
 * JSON 工作台页的装配层（段 4 Task 6；§W）。把 `tools-json.html` 里那一整块静态骨架接到四本纯模块
 * （§S–§V）与本页的视图层（`jsonView.js`）上，算完的结果一律交给视图层的生成器拼串，再由**唯一的
 * 一处** `innerHTML` 出口写进结果区。
 *
 * 这一层存在的理由与 `codecWorkbench.js` 同源，也只有一条：**控件与动作的对应关系只允许有一处**。
 * 六枚控件、十四枚按钮、行号槽、状态读数、树容器、显隐段，如果"哪个 id 属于哪一格"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，改一处漏一处，而漏掉那一处只在页面上表现为"点了没反应"。所以这里用
 * `JSON_SPEC` / `JSON_ACTIONS` 声明控件、开关与动作，所有 id 由那八枚 helper 派生；HTML 里的
 * `data-jt-when` 是写给人和样式看的标记，运行时不读它，它与 spec 是否一致由门禁⑤在构建产物上对账。
 *
 * 六条红线，§W 的判据逐条对着咬（W10–W18 是这六条的形状，W19–W27 补的是"只有真按一遍才看得见"的那一族）：
 *
 * 1. **视图层零 import**：`jsonView.js` 那条红线写在它自己文件头；本层只在构造期 `createJsonView` 一次。
 * 2. **环境只在入口**（W10）：`Date.now(` / `localStorage` / `navigator.` / `new Blob` / `URL.` / `window`
 *    / `globalThis` / `getComputedStyle` / `querySelector` / `setTimeout(` 在本文件源码里**一个都不许出现**。
 *    时钟、`localStorage`、剪贴板、下载那三件、`setTimeout` 全从 `env` 递进来；行高也不量——它是本层的
 *    常量 `ROW_HEIGHT`，与骨架那本 `toolJson.scss` 同源（读一次样式就要在挂载期碰 `getComputedStyle`，
 *    而 §V 的窗口密度只认这个数）。这一条与 `toolCodec.js` 口径 2 是同一条理由：同一份产物在两台机器上
 *    只能给一个答案。
 * 3. **id 只由 spec 派生**（W13、W19）：那八枚 helper 是唯一的地址来源，`controlIds(prefix)` 与 `JSON_SPEC`
 *    与 `JSON_ACTIONS` 三个方向对账；本文件不许手打以 `jt-` 起头的地址串（W10 数的是**整格字面量**，
 *    单引号、双引号、模板串三种引号都算，注释里的不算——旧口径只认 `'jt-`，而拼错的那一枚恰恰是模板串）。
 * 4. **挂载期一次计算都不做**（W14、W16）：`mount()` 只接线、画空态、按 `gate` 刷新一次闸门读数；
 *    解析只在按动作时发生，所以二十次 `input` 之后注入的 `runGuarded` 计数必须是 0。
 * 5. **两类失败分两条路**（W14）：用户那一格不能用（空输入）→ `FieldError` → 结果区一句提示，别的什么都不塌；
 *    模块或骨架自己抛的（如 spec 与骨架漂移出的档位）→ 原样上抛，交给注入的 `runGuarded` 记"这一块坏了"，
 *    并且**不许把上一格的结果擦掉**（所以 `computeAndPaint` 先算后画，抛在画之前）。
 * 6. **记住上次输入默认关**（W15）：`{prefix}.memory.on` 那一格在开关翻转时总写（不写等于这功能没有），
 *    `{prefix}.memory.input` 只在开关为 on 且正文 ≤ `MEMORY_LIMIT` 时写；超了就在读数里说"没存"。
 *
 * 与 `codecWorkbench.js` 的分工：那一本服务编码页（五块面板、六栏、结果区为主的一次性换算），这一本服务
 * JSON 页（单个工作区、粘贴框为主、外加只渲染可视行的树）。两本互不 import，也不共用视图层
 * （`jsonView.js` 在全仓库只许被本文件 reach，`codecView.js` 同理只被 `codecWorkbench.js` reach——两个入口
 * reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，`iifeWrapPlugin` 包完就是整页 SyntaxError 而构建 exit=0）。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §W 二十七判。
 */
import {
  gate as coreGate, parseJson as coreParse, formatJson as coreFormat, minifyJson, stringifyJson,
  lineRange, escapeText, unescapeText, CORE_NOTES,
} from './json-core.js';
import { flatten, expandOf, searchRows, createTreeController } from './json-tree.js';
import { generateTs, TS_HEADER_NOTE } from './json-ts.js';
import {
  jsonToYaml, yamlToJson, jsonToXml, xmlToJson, jsonToCsv, csvToJson,
  YAML_NOTES, XML_CONVENTION, CSV_NOTES,
} from './json-convert.js';
import { createJsonView } from './jsonView.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/** 这一页只有一个工作区，没有面板清单：`spec.ids` 与 `JSON_SPEC` 的键必须逐字相同（门禁⑤ :463） */
export const JSON_PANEL_IDS = ['workbench'];

/** 栏位名：编码页是 main/diff，这一页只有 main 一栏，工具栏的动作另表（`JSON_ACTIONS`） */
const SIDES = ['main'];

/**
 * 行高常量：与 `_sass/toolJson.scss` 里 `--jt-row-h` 那一格同源。**不在装配层读样式**（W10 红线 2），
 * 因为读一次就要在挂载期碰 `getComputedStyle`，而 §V 的窗口密度只认这个整数。
 */
const ROW_HEIGHT = 24;

/** 记住上次输入的正文上限（256 KiB）：超了就不往 `localStorage` 塞整份数据，只在读数里说"没存" */
const MEMORY_LIMIT = 262144;

/** 闸门读数（字节 / 行）随 `input` 刷新的防抖时长；真页面上由入口注入的 `setTimeout` 承载 */
const DEBOUNCE_MS = 200;

/**
 * 深度说明的起谈档位：`stats.depth` 到这一档才在面板上提"深度闸门是 1000 层"（评审 P3-12）。
 * 这个数就是 §7 那条深样本的量程（`CORE_NOTES.deepSample` 里写死的也是同一个数），
 * 一份 12 层的订单不必被通知"这站有深度上限"——说明只在它真的相关时才占那一格。
 */
const DEEP_SAMPLE_DEPTH = 200;

/**
 * 控件与显隐开关的唯一声明处（门禁⑤ DOM 组比的就是这张表的 `controls` 与 `switch.targets`）。
 * `switch.by` 与编码页那个 `switch.control` 同职，只是这一页的开关源就是 `view` 那一格下拉。
 */
export const JSON_SPEC = {
  workbench: {
    sides: {
      main: {
        kind: 'workbench',
        controls: [
          { id: 'doc', type: 'area' },
          { id: 'view', type: 'select', options: ['text', 'tree'] },
          { id: 'query', type: 'text' },
          { id: 'indent', type: 'select', options: ['two', 'four', 'tab'] },
          { id: 'sort', type: 'select', options: ['off', 'shallow', 'deep'] },
          { id: 'memorize', type: 'checkbox' },
        ],
        switch: { by: 'view', targets: [{ key: 'tree', when: ['tree'] }] },
      },
    },
  },
};

/**
 * 工具栏那三段的动作清单：`key` 派生按钮 id，`kind` 是输出区顶部那一格读数的类别（`OUT_KINDS` 里的词），
 * `needs` 说明这一枚要不要输入区有东西（空输入时 `validate` 与 `format` 走的是同一句空态，不报错）。
 */
export const JSON_ACTIONS = [
  { key: 'validate', kind: 'json', group: 'action', label: '校验' },
  { key: 'format', kind: 'json', group: 'action', label: '格式化' },
  { key: 'minify', kind: 'json', group: 'action', label: '压缩' },
  { key: 'escape', kind: 'json', group: 'action', label: '转义' },
  { key: 'unescape', kind: 'json', group: 'action', label: '反转义' },
  { key: 'copy', kind: 'json', group: 'action', label: '复制' },
  { key: 'download', kind: 'json', group: 'action', label: '下载结果' },
  { key: 'ts', kind: 'ts', group: 'convert', label: 'TypeScript' },
  { key: 'yamlOut', kind: 'yaml', group: 'convert', label: '转 YAML' },
  { key: 'yamlIn', kind: 'json', group: 'convert', label: 'YAML 转回' },
  { key: 'xmlOut', kind: 'xml', group: 'convert', label: '转 XML' },
  { key: 'xmlIn', kind: 'json', group: 'convert', label: 'XML 转回' },
  { key: 'csvOut', kind: 'csv', group: 'convert', label: '转 CSV' },
  { key: 'csvIn', kind: 'json', group: 'convert', label: 'CSV 转回' },
];

/** `key → 那一枚动作`，按钮按 id 找回它的类别与标题时读这张表（不重复抄一份清单） */
const ACTION_BY_KEY = new Map(JSON_ACTIONS.map((a) => [a.key, a]));

/** 控件 id：`{p}-in-{panel}-{control}`，与门禁⑤ :479 那一串同源 */
export const fieldId = (prefix, panel, control) => `${prefix}-in-${panel}-${control}`;
/** 按钮 id：`{p}-btn-{panel}-{side}`，这一页的 `side` 是动作 key */
export const buttonId = (prefix, panel, side) => `${prefix}-btn-${panel}-${side}`;
/** 复制按钮 id：`{p}-copy-{panel}-{side}` */
export const copyId = (prefix, panel, side) => `${prefix}-copy-${panel}-${side}`;
/** 结果区 id：`{p}-out-{panel}-{side}` */
export const outId = (prefix, panel, side) => `${prefix}-out-${panel}-${side}`;
/** 显隐段 id：`{p}-when-{panel}-{key}` */
export const whenId = (prefix, panel, key) => `${prefix}-when-${panel}-${key}`;
/** 行号槽 id：`{p}-gutter-{panel}-{control}`——它跟着**输入**那一格，不是结果栏 */
export const gutterId = (prefix, panel, control) => `${prefix}-gutter-${panel}-${control}`;
/** 状态读数 id：`{p}-status-{panel}-{side}`（字节 / 行 / 节点 / 深度 / 键数那一行） */
export const statusId = (prefix, panel, side) => `${prefix}-status-${panel}-${side}`;
/** 树容器 id：`{p}-tree-{panel}-{side}`，`createTreeController` 的 `container` 就是它 */
export const treeId = (prefix, panel, side) => `${prefix}-tree-${panel}-${side}`;

/**
 * 这一页应该存在的全部 id：W13 的三个方向对账（spec ↔ helper ↔ 骨架）吃的就是这份清单。
 * @param {string} prefix 前缀
 * @param {string[]} [panels] 面板清单，默认 `JSON_PANEL_IDS`
 * @returns {object} 八组 id 数组
 */
export function controlIds(prefix, panels = JSON_PANEL_IDS) {
  const got = { in: [], btn: [], copy: [], out: [], when: [], gutter: [], status: [], tree: [] };
  for (const panel of panels) {
    const cfg = JSON_SPEC[panel].sides.main;
    for (const c of cfg.controls) {
      got.in.push(fieldId(prefix, panel, c.id));
      if (c.type === 'area') got.gutter.push(gutterId(prefix, panel, c.id));
    }
    for (const a of JSON_ACTIONS) got.btn.push(buttonId(prefix, panel, a.key));
    for (const tg of cfg.switch?.targets ?? []) got.when.push(whenId(prefix, panel, tg.key));
    for (const side of SIDES) {
      got.out.push(outId(prefix, panel, side));
      got.status.push(statusId(prefix, panel, side));
      got.tree.push(treeId(prefix, panel, side));
      got.copy.push(copyId(prefix, panel, side));
    }
  }
  return got;
}

// ── FieldError：用户那一格不能用（红线 5 的第一条路）─────────────────────────

/**
 * "这一格不能用"这一类失败。它不是这块坏了：消息进结果区的提示行（`emptyHint(msg, 'hint')`），
 * 别的什么都不塌，也不记进 `runGuarded` 的"这一块坏了"。与证件页 / 编码页那两份同形状但**不 export**
 * （W1 钉死 `jsonView` 的四格导出面，本文件也有各自对账），也不 import 那一本——那会把别的页的模块拖进来。
 * @extends Error
 */
class FieldError extends Error {
  /** @param {string} message 直接给用户看的一句话，点名是哪一个格子 */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
    /** 判别标记，不靠 `name` 字符串比对 */
    this.isField = true;
  }
}

// ── createJsonWorkbench ─────────────────────────────────────────────────────

/**
 * 造一个 JSON 工作台的装配器。
 *
 * @param {object} env 依赖注入。四本纯模块与 `jsonView` 是直接 `import` 的（只有一个入口 reach 它们），
 *   框架层（`view` / `ui`）与宿主环境全部从 `env` 进来。
 * @param {object} env.document 要有 `getElementById` 与 `createElement`（树行是自己 `createElement` 出来的）
 * @param {{view: object, ui: {copyInto: Function}}} env.Tk `window.Tk` 里的那两格：`view` 出转义与占位串，
 *   `ui.copyInto` 兜底复制。缺 `view.esc` 或缺 `ui.copyInto` 都在构造期点名（W12）
 * @param {(id: string, fn: (el: object) => void) => boolean} env.runGuarded 把一次动作包进去；
 *   非函数就抛（按钮回调不许自己 `try/catch` 出第二套错误口径）
 * @param {string} [env.prefix] 前缀，默认 `jt`；给了但不是非空字符串就抛（W12）
 * @param {Storage|null} [env.storage] `localStorage`；`null` 或没有这三个方法就是"这台浏览器不给存"
 * @param {() => number} [env.now] 注入时钟；缺席就是缺席（记住输入的 `at` 落 0，不拿宿主时间补一个假数字）
 * @param {(fn: () => void, ms: number) => number} [env.later] `setTimeout` 的别名；缺席就不防抖（`input` 那一路 no-op）
 * @param {number} [env.rowHeight] 行高；给了但不是 ≥1 整数就 `RangeError`，缺席落 `ROW_HEIGHT`
 * @param {Function} [env.BlobCtor] `Blob` 的构造别名；与下两格缺一就不让下载按钮可用
 * @param {(b: object) => string} [env.createObjectURL] `URL.createObjectURL` 的别名
 * @param {(u: string) => void} [env.revokeObjectURL] `URL.revokeObjectURL` 的别名
 * @param {object} [env.navigator] 只为 `clipboard`；没有就走 `execCommand` 兜底
 * @returns {{renderers: Record<string, Function>, actions: Record<string, Function>,
 *   state: () => object, mount: () => {missing: string[], rendered: string[]}}}
 */
export function createJsonWorkbench(env = {}) {
  const e = env ?? {};
  if (!e.document || typeof e.document.getElementById !== 'function') {
    throw new TypeError('createJsonWorkbench：env.document 要有 getElementById，缺它第一次点击就炸');
  }
  if (typeof e.document.createElement !== 'function') {
    throw new TypeError('createJsonWorkbench：env.document 要有 createElement，§V 的树行是自己造出来的，不是从串里解析的');
  }
  if (!e.Tk || !e.Tk.view || typeof e.Tk.view.esc !== 'function') {
    throw new TypeError('createJsonWorkbench：env.Tk.view 应是 window.Tk 里那份 view（转义与占位串都从它出，缺 esc 的结果是用户文本被当标记插进结果区）');
  }
  if (!e.Tk.ui || typeof e.Tk.ui.copyInto !== 'function') {
    throw new TypeError('createJsonWorkbench：env.Tk.ui.copyInto 应是 window.Tk 里那份 ui（缺它的下场是点复制没反应）');
  }
  if (typeof e.runGuarded !== 'function') {
    throw new TypeError('createJsonWorkbench：env.runGuarded 应是包一次动作的那只手，按钮回调不许自己 try/catch 出第二套错误口径');
  }
  if (e.storage !== undefined && e.storage !== null
    && (typeof e.storage.getItem !== 'function' || typeof e.storage.setItem !== 'function'
      || typeof e.storage.removeItem !== 'function')) {
    throw new TypeError('createJsonWorkbench：给了 storage 但三个方法不齐，记住上次输入会静默不生效');
  }
  if (e.now !== undefined && e.now !== null && typeof e.now !== 'function') {
    throw new TypeError(`createJsonWorkbench：env.now 应为函数或缺席，收到 ${typeof e.now}`);
  }
  if (e.later !== undefined && e.later !== null && typeof e.later !== 'function') {
    throw new TypeError(`createJsonWorkbench：env.later 应为 setTimeout 的别名或缺席，收到 ${typeof e.later}（非函数会让"粘贴不自动解析"那一条防抖静默消失）`);
  }
  if (e.rowHeight !== undefined && e.rowHeight !== null
    && (!Number.isInteger(e.rowHeight) || e.rowHeight < 1)) {
    throw new RangeError(`createJsonWorkbench：env.rowHeight 应是 ≥1 的整数像素或缺席（落 ROW_HEIGHT），收到 ${String(e.rowHeight)}`);
  }
  if (e.prefix !== undefined && e.prefix !== null
    && (typeof e.prefix !== 'string' || e.prefix === '')) {
    throw new TypeError(`createJsonWorkbench：env.prefix 应是非空字符串或缺席（落 jt），收到 ${String(e.prefix)}`);
  }

  const doc = e.document;
  const view = e.Tk.view;
  const ui = e.Tk.ui;
  const runGuarded = e.runGuarded;
  const cv = createJsonView(view);
  const prefix = (e.prefix === undefined || e.prefix === null) ? 'jt' : e.prefix;
  const store = (e.storage && typeof e.storage.getItem === 'function') ? e.storage : null;
  const clock = typeof e.now === 'function' ? e.now : null;
  const later = typeof e.later === 'function' ? e.later : null;
  const rowHeight = (e.rowHeight === undefined || e.rowHeight === null) ? ROW_HEIGHT : e.rowHeight;
  // 红线 2：这一层不写 `navigator.`——取一份局部名再摸它的 clipboard。
  const nav = e.navigator === undefined ? null : e.navigator;
  const clipboard = nav && nav.clipboard ? nav.clipboard : null;
  const canBlob = typeof e.BlobCtor === 'function'
    && typeof e.createObjectURL === 'function' && typeof e.revokeObjectURL === 'function';
  const onKey = `${prefix}.memory.on`;
  const inKey = `${prefix}.memory.input`;
  /**
   * 这台浏览器到底能不能复制：`navigator.clipboard` 与 `document.execCommand` 至少有一条路在。
   * 评审 P3-14 量的就是这一格——挂载期按"缺环境就置灰"，可一旦算出结果，`syncCopy` 只看
   * "有没有文本"就把按钮点亮，按下去只会把文案改成"复制失败，请手动选中"。
   * 可用性因此是**两格**：有文本 **且** 有一条真能用的退路。
   */
  const copyable = clipboard !== null || typeof doc.execCommand === 'function';

  const PANEL = 'workbench';
  const SIDE = 'main';
  const OUT = outId(prefix, PANEL, SIDE);
  const STATUS = statusId(prefix, PANEL, SIDE);
  const GUTTER = gutterId(prefix, PANEL, 'doc');
  const TREE = treeId(prefix, PANEL, SIDE);
  const MAIN_COPY = copyId(prefix, PANEL, SIDE);
  const node = (id) => doc.getElementById(id);

  /** 当前算出来的那一份结果：`{tone, kind, out}`——`out` 是能复制 / 能下载的纯文本，不是 HTML */
  let current = { tone: 'idle', kind: 'json', out: '' };
  /** 树控制器只在按动作且视图为 tree 时存在；`input` 与挂载期一次都不许碰它（W16 红线 4） */
  let treeCtl = null;
  /**
   * 这一轮树的四份材料：`{value, text, rows, opened}`。点击展开要在它们之上重算，而"同一份文本再算一次"
   * 要留着用户已经点开的那几支，换了一份文本就回收默认档（§V 的 V10：折叠一支会把支内的展开态一起带走）。
   * 树不存在时是 `null`，不是空行集——`{rows: []}` 会让"再点一下"以为有树可翻。
   */
  let treeModel = null;
  /** `main` 那一份能拿到的值（validate / 转回 那一族才有），树视图按它拍平 */
  let lastValue;
  let lastValueReady = false;
  /**
   * `lastValue` 是从**哪一份文本**算出来的。评审 P1-5 的两条都源于这里没有对账：
   * ① 新解析的对象每次都是新引用，所以"同一份值再算一次"不能拿 `value` 比引用；
   * ② 下拉切到树时如果拿的是上一次的值，而输入早就换了，屏幕上就是一棵没人认领的树。
   */
  let lastTreeText = null;
  /**
   * 两路防抖各自的令牌序号。评审 P2-8：只 `setTimeout` 不撤销，1 MB 输入连打 20 次 `input`
   * 就是 20 次全量字节数 + 20 次行号槽重写（实测 251.8 ms 连续主线程计算）。
   * 令牌只让**最后排进去的那一个**真的算——`later` 排的次数照旧是 20（W16 量的就是这一格），
   * 少的是计算次数，不是定时器次数。
   */
  let gateSeq = 0;
  let searchSeq = 0;
  /** 复制按钮的原文案（`copyId → 骨架那句`）：改口之后要能改回页面里那一句，而不是这里写死的一句 */
  const copyLabels = new Map();
  let wired = false;

  // ── 取值 ────────────────────────────────────────────────────────────────

  /** 单行格与下拉：去首尾空白，空值一律 `null`（调用方按 `null` 决定默认档） */
  const valueOf = (control) => {
    const el = node(fieldId(prefix, PANEL, control));
    // 缺控件不抛：`mount()` 的 `report.missing` 已经把这一格报名字报出去了（W13「缺一格要报出来」），
    // 剩下的路一律走这一格的默认档。评审 P3-15 量的正是旧口径的三档不一致：缺 `view` 让挂载当场抛、
    // 缺 `indent`/`sort` 让每一次动作都被记成"这一块坏了"、缺 `query` 又完全没事——同一类缺陷三种下场。
    // 粘贴框不在这一档里：它是这一页的唯一输入，`areaOf` 照旧抛。
    if (!el) return null;
    const v = String(typeof el.value === 'string' ? el.value : '').trim();
    return v === '' ? null : v;
  };

  /**
   * 粘贴框：整段文本原样，只把行尾 `\r` 归一成 `\n`（与行号槽那一把尺同源）。
   * **不 trim**：JSON 前后各一个空格是内容的一部分；"空不空"由调用侧按 `.trim() === ''` 判，那是两件事。
   */
  const areaOf = () => {
    const el = node(fieldId(prefix, PANEL, 'doc'));
    if (!el) throw new RangeError('页面里没有粘贴框，spec 与骨架对不上');
    return String(typeof el.value === 'string' ? el.value : '').replace(/\r\n?/g, '\n');
  };

  /** 视图那一格的当前值（'tree' 才会建树；其余一律文本） */
  const viewValue = () => (valueOf('view') ?? '');

  // ── 渲染（唯一的 innerHTML 出口，W10）────────────────────────────────────

  /**
   * 全层唯一一处写 HTML：结果区与 §V 的行内 markup 都从这一格走。`jsonView` 只产串、不碰节点
   * （W10 数它 `innerHTML` 出现 0 次），所以"什么样的文本会变成标记"在全仓库只有一个答案——`view.esc`。
   * @param {object|null} el 目标节点
   * @param {string} html 已经拼好的串
   */
  const paint = (el, html) => {
    if (el) el.innerHTML = html;
  };

  /** 结果正文那一块（视图层没导出它——那一格是排版，不是"什么算需要转义"这件事的一部分） */
  const bodyBlock = (text) => `<pre class="jt-out__body">${view.esc(text)}</pre>`;

  /** 那一栏正文的宽度上限：单行 5 MiB 的压缩 JSON 整行进 DOM 会产出 10 MiB 的串（评审 P2-6） */
  const CTX_WINDOW = 120;

  /**
   * 两枚复制的落点：工具栏那一枚（`-btn-{p}-copy`）与结果栏那一枚（`-copy-{p}-main`）。
   * 可用性由**两格**决定（评审 P3-14）：这一栏有没有可复制的文本、这台浏览器还有没有一条能用的退路。
   */
  const copyTargets = () => [MAIN_COPY, buttonId(prefix, PANEL, 'copy')];

  const syncCopy = () => {
    for (const id of copyTargets()) {
      const btn = node(id);
      if (btn) btn.disabled = current.out === '' || !copyable;
    }
  };

  /**
   * 成功那一档：头部（+那一句补充）→ 代价说明那一族 → 读数 → 正文。
   * 顺序在全页只有这一处（评审 P3-11：`validate` 那一格曾把读数拼在正文**之后**，别的所有动作拼在之前，
   * 用户在两栏之间看到的就是"同一件事换了个位置"）。
   * @param {string} kind `OUT_KINDS` 里的一格
   * @param {string} toneName `JT_TONES` 里的一格
   * @param {string} title 那一栏的标题
   * @param {string} text 纯文本结果（进 `current.out`，能复制能下载的就是这一格）
   * @param {{note?: string, notes?: string[], stats?: object}} [extra] 三格都可缺席
   */
  const paintResult = (kind, toneName, title, text, extra) => {
    const x = extra || {};
    const head = cv.resultHead({ kind, tone: toneName, title, note: x.note });
    const inner = head + cv.noteLines(x.notes) + (x.stats ? cv.statsLine(x.stats) : '') + bodyBlock(text);
    paint(node(OUT), inner);
    current = { tone: toneName, kind, out: text };
    syncCopy();
  };

  /** 只有一句话的三档（空态 / 提示 / 拒收）：类名由视图层拼，本层只挑档位 */
  const paintLine = (kind, toneName, text) => {
    paint(node(OUT), cv.emptyHint(text, kind));
    current = { tone: toneName, kind: current.kind, out: '' };
    syncCopy();
    dropTree();          // 树视图不许留上一份的化石（见下面那一格）
  };

  /**
   * 坏输入那一档：行列 + 三行读条 + 定位。**先算 ctx 再画**，抛在画之前（红线 5：不许擦掉上一格结果）。
   * 只在能定位时动选区一次（W14 那一条"定位一次就好"）。
   * @param {number} [lines] 这一栏的行数（`coreGate` 已经量过，别再扫一遍），越界的那一行就不长
   */
  const paintErr = (kind, err, text, title, lines) => {
    const at = Number.isInteger(err.line) && Number.isInteger(err.column);
    if (!at) { paintLine('hint', 'bad', (err && err.message) || '这一份读不回来。'); return; }
    const ctx = errorContext(text, err, lines);
    // 两把尺各归各（评审 P2-6 的第二半）：`第 N 行第 M 列` 说的是**原文**里的那一列，那一个数字才抄得去
    // `jq`；插入符落在**窗口**里，交给 `ctx.caret`。旧口径把窗口列塞进 `err.column`，于是行短的时候
    // 两者刚好相等、没人发现问题，行一长（压缩 JSON 整行几兆）那句行列就指到了行的中段以外。
    paint(node(OUT), cv.resultHead({ kind, tone: 'bad', title }) + cv.errBlock(err, ctx));
    current = { tone: 'bad', kind, out: '' };
    syncCopy();
    dropTree();
    if (ctx.select) {
      const box = node(fieldId(prefix, PANEL, 'doc'));
      if (box && typeof box.setSelectionRange === 'function') {
        // 选区落在**原文**的绝对偏移上：那是 `<textarea>` 自己的坐标系，与显示窗口无关。
        box.setSelectionRange(err.index, err.index + (err.length || 0), 'preserve');
      }
    }
  };

  /**
   * 三行读条的取材：整行进 DOM 会把 5 MiB 上限之内的一条压缩 JSON 摊成 10 MiB 的串（评审 P2-6），
   * 所以按病灶那一格左右各取 `CTX_WINDOW` 码元，两头切了就用 `…` 说明"这里不是行首/行尾"。
   * **三行吃同一个窗口**：那是等宽对齐的一块，只裁病灶行、上一行与下一行留全文，读条就自己换了列。
   * 制符一律展成**一格空格**：`<pre>` 的 `tab-size` 默认是 8，而插入符数的是空格——不展就是每次指错
   * （评审 P2-7，tab 缩进这一档在页面上没有开关能改）。展开是 1 码元换 1 格，所以列号不用重算。
   * @param {string} text 这一栏真正的内容（JSON 原文，或 YAML / XML / CSV 原文）
   * @param {{line: number, column: number, index?: number, length?: number}} err 模块交出的病灶位置
   * @param {number} [lineCount] 行数。`lineRange` 对越界的行号是**夹到末行**的（§S 的口径），
   *   而读条要的恰恰是"末行没有下一行"——不报数就会把整行再抄一遍，那正是这一只要防的那件事。
   *   量不到时按 1 行处理：宁可少给一行上下文，也不许把一行几兆摊成两份。
   * @returns {{prev: string, at: string, next: string, caret: number, select: boolean}}
   */
  const errorContext = (text, err, lineCount) => {
    const flat = (s) => s.replace(/\t/g, ' ');
    const total = Number.isInteger(lineCount) && lineCount >= 1 ? lineCount : 1;
    const lineOf = (n) => {
      if (!Number.isInteger(n) || n < 1 || n > total) return null;
      const { start, end } = lineRange(text, n);
      return flat(text.slice(start, end));
    };
    const col = Number.isInteger(err.column) ? err.column - 1 : 0;
    const raw = lineOf(err.line) ?? '';
    const width = CTX_WINDOW * 2;
    let from = 0;
    if (raw.length > width) from = Math.max(0, Math.min(col - CTX_WINDOW, raw.length - width));
    const cut = (s) => {
      if (s === null) return '';
      const left = from > 0 && s.length > from;
      const right = s.length > from + width;
      return (left ? '…' : '') + s.slice(from, from + width) + (right ? '…' : '');
    };
    return {
      prev: cut(lineOf(err.line - 1)),
      at: cut(raw),
      next: cut(lineOf(err.line + 1)),
      caret: col - from + (from > 0 ? 1 : 0),
      select: Number.isInteger(err.index),
    };
  };

  /** 超限那一档（红线 4 的另一头）：`gate` 挡在门外，不进 DOM、不解析，话里给得出上限那个数 */
  const paintRefuse = (g) => {
    paintLine('refuse', 'warn', g.message);   // 读数、复制可用性、拆树都在 `paintLine` 那一格，这里不再各写一遍
  };


  // ── 闸门读数与行号槽（input 那一路只更新这一格，绝不解析）────────────────

  /** 只写 textContent / style，不 `createElement`（W16：挂载与 input 一个新节点都不许长） */
  const updateGate = (note) => {
    let g;
    try { g = coreGate(areaOf()); } catch { return null; }
    const st = node(STATUS);
    if (st) st.textContent = `字节 ${g.bytes} · 行 ${g.lines}` + (note ? ` · ${note}` : '');
    const gu = node(GUTTER);
    if (gu) {
      gu.textContent = Array.from({ length: g.lines }, (_, i) => String(i + 1)).join('\n');
      gu.style.height = `${g.lines * rowHeight}px`;
    }
    return g;
  };

  /**
   * 排一次闸门读数。令牌只让**最后一个**真的算（评审 P2-8），但 `later` 叫的次数照旧是每次 input
   * 一次——W16 数的是这一格，它要的是"粘贴不自动解析"，不是"少排几个定时器"。
   */
  const scheduleGate = () => {
    if (!later) { updateGate(); return; }
    const token = ++gateSeq;
    later(() => { if (token === gateSeq) updateGate(); }, DEBOUNCE_MS);
  };

  /** 排一次搜索涂色，口径同 `scheduleGate` */
  const scheduleSearch = () => {
    if (!later) { applySearch(); return; }
    const token = ++searchSeq;
    later(() => { if (token === searchSeq) applySearch(); }, DEBOUNCE_MS);
  };


  // ── 树视图（§V 控制器 + `jsonView.treeRow` 的行内生成钩子）───────────────

  /** 建或换一棵树：视图为 tree 时按当前值拍平；行内 markup 从 renderRow 走进那唯一的 `paint` */
  const buildTree = (value, text) => {
    const box = node(TREE);
    if (!box) return;
    if (!treeCtl) {
      treeCtl = createTreeController({
        document: doc, container: box, rowHeight,
        renderRow: (el, row) => paint(el, cv.treeRow(row)),
      });
    }
    // 同一份**文本**再算一次要留着用户点开的那几支；换了一份文本就回收默认档（`expanded: null` → depth<2）。
    // 比引用不算数：`parseJson` 每次都交回一个新对象，于是"什么都没改再按一次校验"会把整片展开态洗掉
    // （评审 P1-5 的第一条）。
    const same = treeModel !== null && treeModel.text === text;
    setRows(value, text, flatten(value, { expanded: same ? treeModel.opened : null }));
  };

  /**
   * 换一批行：`setData` 与 `setExpanded` 必须是**同一轮**的两份（§V 那条契约说的就是"上一轮的
   * Set 喂进这一轮的行集"——用户看见的是"点了没反应"），所以展开集在这里从行集现推，不留副本。
   * @param {unknown} value 这一轮被拍平的那份值
   * @param {string} text 这份值是从哪一段文本算出来的
   * @param {Array<object>} rows `flatten` 交回的行集
   */
  const setRows = (value, text, rows) => {
    const opened = new Set();
    for (const r of rows) if (r.expanded) opened.add(r.id);
    treeCtl.setData(rows);
    treeCtl.setExpanded(opened);
    treeModel = { value, text, rows, opened };
    applySearch();
  };

  /** 展开 / 折叠一行：`expandOf` 交回新 Set，再按它重拍一次 */
  const toggleRow = (id, on) => {
    if (treeCtl === null || treeModel === null) return;
    setRows(treeModel.value, treeModel.text,
      flatten(treeModel.value, { expanded: expandOf(treeModel.rows, id, on) }));
  };

  /**
   * 搜索词涂色并读一次命中数。空串是"没搜"（§V 口径），只洗色、不报数——那一格本来就说"几处命中"。
   * 行集只有 `windowSize` 那一圈渲染，但 `searchRows` 扫的是**全量行集**，所以未渲染的命中也算得进读数；
   * **折叠起来的分支不在行集里**，那一格由 `truncated` 报出"还有几项没算"（评审 P3-12：
   * 不说这一格，用户读到的是"搜不到"，实情是"这一支没展开"——假阴性的账要出在页面上，不能出在猜里）。
   */
  const applySearch = () => {
    if (treeCtl === null || treeModel === null) return;
    const q = valueOf('query') ?? '';
    const found = searchRows(treeModel.rows, q);
    treeCtl.refresh();
    if (q === '') { updateGate(); return; }
    updateGate(`匹配 ${found.total} 处`
      + (found.truncated > 0 ? ` · 折叠里还有 ${found.truncated} 项没算` : ''));
  };

  /**
   * 树容器上的事件代理。行是控制器随时重建的，把监听挂在一枚行上等于挂在一堆会消失的节点上。
   * 三档：Pointer 按钮 → 复制那一格的地址；容器行 → 翻展开态；其余（标量行、垫片）什么都不做。
   * 展开态读的是行元素自己的 `aria-expanded`（§V 的控制器只给容器行写这一格），不是行内那个三角——
   * 那一个 span 是 `treeRow` 写的，装配层从 DOM 里再找它就得用 `querySelector`（W10 红线上有这个词）。
   * `closest` 只有真 DOM 有：假 DOM 的 `innerHTML` 是个普通属性，行内根本不长子节点，所以这一格
   * 在 §W 的夹具里永远原样返回（夹具也从不向树容器派发 click），它量的是真浏览器那一条路。
   */
  const onTreeClick = (evt) => {
    const target = evt && evt.target;
    if (treeCtl === null || treeModel === null || !target || typeof target.closest !== 'function') return;
    const btn = target.closest('[data-jt-copy]');
    if (btn) {
      const pointer = String(btn.getAttribute('data-jt-copy') ?? '');
      if (pointer !== '') {
        ui.copyInto({
          btn, text: pointer, original: btn.textContent, clipboard, doc, later: later ?? undefined,
        });
      }
      return;
    }
    const row = target.closest('[data-jt-id]');
    if (!row) return;
    const open = row.getAttribute('aria-expanded');
    if (open !== 'true' && open !== 'false') return;
    toggleRow(String(row.getAttribute('data-jt-id') ?? ''), open !== 'true');
  };

  /** 切回文本要把树的三块常驻节点撤干净：留着就是两种视图同时挂在 DOM 上（W18 最后一条） */
  const destroyTree = () => {
    if (!treeCtl) return;
    try { treeCtl.destroy(); } catch { /* 拆干净比报错要紧 */ }
    treeCtl = null;
    treeModel = null;
    // `lastTreeText` **不在这里清**：它记的是"`lastValue` 从哪一份文本来"，那是那一次解析的账，
    // 不是这棵树的账。跟着树一起抹掉，下拉来回切两次就会得到一句"换了输入"——而输入根本没动。
  };

  /**
   * 算不出来就要把树拆掉（评审 P1-4）。旧口径只在**切视图**时拆，坏输入的三条 `return` 都排在
   * `buildTree` 之前，于是用户看到的是：输入已经改成 `{"broken":,,,}`，树里还挂着上一份的键，
   * 状态读数却照着新输入报"字节 22 · 行 1"——那一棵树就成了当前输入的假证据。
   * 文本栏那条"坏了不许擦掉手里那份"的红线管的是**结果文本**（红线 5），而这一格里留着旧树
   * 不是留结果，是留一个会说谎的读数旁证。
   */
  const dropTree = () => { if (treeCtl !== null) destroyTree(); };


  // ── 记住上次输入（红线 6）───────────────────────────────────────────────

  /**
   * 读存储的那一只手。**每一次**读写都包着：`getItem` 在"这台浏览器禁了存储"时是会抛的
   * （Safari 隐私模式访问 `localStorage` 直接 `SecurityError`），而入口那边只兜住了**取对象**那一步
   * （评审 P0-2：`store = win.localStorage` 拿到的是 Proxy，真正抛在第一次 `getItem`）。
   * 抛在挂载期的下场是整页起不来——输入框是空的、结果区一片空白，而那句"启动失败"之外用户什么都没丢。
   * 所以这里退成"当没有存过"，页面照常起，只是这一功能不生效。
   * @param {string} key 要读的那一格
   * @returns {string|null} 读不到或读崩了都是 `null`
   */
  const readStore = (key) => {
    if (!store) return null;
    try { return store.getItem(key); } catch { return null; }
  };

  /**
   * 写存储的那一只手，口径同上：崩了就是"这次没存住"，不许把一次按动作拖成"这一块坏了"。
   * @param {string} key 那一格
   * @param {string} value 内容
   * @returns {boolean} 有没有真的写进去
   */
  const writeStore = (key, value) => {
    if (!store) return false;
    try { store.setItem(key, value); return true; } catch { return false; }
  };

  /** 翻开关：on/off 总写 `{prefix}.memory.on`，关回去把正文那一格删干净 */
  const persistToggle = () => {
    if (!store) return;
    const on = !!node(fieldId(prefix, PANEL, 'memorize'))?.checked;
    if (on) writeStore(onKey, '1');
    else { writeStore(onKey, '0'); try { store.removeItem(inKey); } catch { /* 删不掉就是这一格还在，读数会说明 */ } }
  };

  /** 一次动作算成功后，若开关为 on 就把正文存一份；超过 `MEMORY_LIMIT` 只说"没存"，不塞整份数据 */
  const persistInput = (g, text) => {
    if (!store) return;
    const box = node(fieldId(prefix, PANEL, 'memorize'));
    if (!box || !box.checked) return;
    if (g && g.bytes > MEMORY_LIMIT) { updateGate('没存'); return; }
    if (!writeStore(inKey, JSON.stringify({ text, at: clock ? clock() : 0 }))) updateGate('没存');
  };

  /** 挂载时把上次那份填回输入框——填回但不算（红线 4），差别只落在读数那句"已恢复上次输入" */
  const restore = () => {
    if (!store) return false;
    const box = node(fieldId(prefix, PANEL, 'memorize'));
    if (box) box.checked = String(readStore(onKey) ?? '') === '1';
    if (!box || !box.checked) return false;
    const raw = readStore(inKey);
    if (raw === null || raw === undefined) return false;
    try {
      const saved = JSON.parse(raw);
      if (saved && typeof saved.text === 'string' && saved.text !== '') {
        const area = node(fieldId(prefix, PANEL, 'doc'));
        if (area) area.value = saved.text;
        return true;
      }
    } catch { /* 存的那一格读不出形状就当没有：宁可少恢复一次 */ }
    return false;
  };


  // ── 显隐（W18：view→tree 露出搜索那一组，其余藏掉）──────────────────────

  const applySwitch = () => {
    const value = viewValue();
    for (const target of JSON_SPEC[PANEL].sides[SIDE].switch.targets) {
      const el = node(whenId(prefix, PANEL, target.key));
      if (el) el.hidden = !target.when.includes(value);
    }
    if (value !== 'tree') destroyTree();
  };

  // ── 复制与下载（都只在按那枚按钮时发生，挂载期一次都不碰）───────────────

  const doCopy = (id) => {
    const btn = node(id);
    if (!btn || current.out === '') return;
    ui.copyInto({
      btn, text: current.out, original: copyLabels.get(id) ?? btn.textContent,
      clipboard, doc, later: later ?? undefined,
    });
  };

  /** 结果正文的类别 → 下载文件名与 MIME：按「生成 TypeScript」下载得到 `data.json` 是另一回事（评审 P2-10） */
  const FILE_BY_KIND = {
    json: { ext: 'json', mime: 'application/json' },
    ts: { ext: 'ts', mime: 'text/plain' },
    yaml: { ext: 'yaml', mime: 'text/yaml' },
    xml: { ext: 'xml', mime: 'application/xml' },
    csv: { ext: 'csv', mime: 'text/csv' },
  };

  /**
   * 下载走注入那三件（W10 红线 2：本层不写 `new Blob` / `URL.`）。
   * `revokeObjectURL` 落在 `finally`：旧口径把它排在 `a.click()` 之后，而 `click()` / `appendChild`
   * 任一抛（被拦下载、脱离文档的 body、扩展干预）就整条跳过它——实测泄漏一个 blob URL 并在 body 里
   * 留一枚游离的 `<a>`。文件名与 MIME 跟着**当前那一栏的类别**，不写死 `data.json`。
   */
  const doDownload = () => {
    if (!canBlob || current.out === '') return;
    const file = FILE_BY_KIND[current.kind] || FILE_BY_KIND.json;
    let url = null;
    let anchor = null;
    try {
      const blob = e.BlobCtor([current.out], { type: file.mime });
      url = e.createObjectURL(blob);
      anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = `data.${file.ext}`;
      doc.body.appendChild(anchor);
      if (typeof anchor.click === 'function') anchor.click();
    } finally {
      if (anchor) { try { doc.body.removeChild(anchor); } catch { /* 已经在外面了，不用再摘 */ } }
      if (url !== null) { try { e.revokeObjectURL(url); } catch { /* 撤销失败没有第二次机会可给 */ } }
    }
  };


  // ── 一次动作：先算后画（红线 5）─────────────────────────────────────────

  /**
   * 这一枚动作该说明哪些代价。四族说明常量（`CORE_NOTES` / `TS_HEADER_NOTE` / `YAML_NOTES` /
   * `XML_CONVENTION` / `CSV_NOTES`）在 §U/§S 那一头钉的是"非空、且只此一份"，而把它们**放上页面**
   * 的是这一格（评审 P3-12：装配层一次都没叫 `cv.noteLines`，那一族说明在页面上是 0 处命中）。
   * 口径是"这一族确实摊了代价才说"，不是每栏都堆一段：深度不到 `DEEP_SAMPLE_DEPTH` 层不提闸门，
   * 没重复键不提覆盖。
   * @param {string} key 动作 key
   * @param {{stats?: object, duplicateKeys?: string[]}|null} p 这一次解析的读数（转回那一族没有）
   * @returns {string[]} 可能为空，空就是不渲那一族
   */
  const notesFor = (key, p) => {
    if (key === 'ts') return [TS_HEADER_NOTE];
    if (key === 'yamlOut' || key === 'yamlIn') return Object.values(YAML_NOTES);
    if (key === 'xmlOut' || key === 'xmlIn') return [XML_CONVENTION];
    if (key === 'csvOut' || key === 'csvIn') return Object.values(CSV_NOTES);
    const list = [];
    const dups = (p && p.duplicateKeys) || [];
    if (dups.length) {
      // 那句说明承诺的是"出现过的每一处按 Pointer 列出来"，只写「1 处重复键」没有兑现它（W26 抓到的一格）：
      // 用户真正要的是**哪一个键**被覆盖了。列到 8 处为止，再多只报数——那一族说明不该长成第二个正文。
      const at = dups.slice(0, 8).map((d) => `${d.pointer} ×${d.times}`).join('、');
      const more = dups.length > 8 ? `，另有 ${dups.length - 8} 处没列` : '';
      list.push(`${CORE_NOTES.dupKey} 本次：${at}${more}。`);
    }
    if (p && p.stats && Number.isFinite(p.stats.depth) && p.stats.depth >= DEEP_SAMPLE_DEPTH) {
      list.push(CORE_NOTES.deepSample);
    }
    return list;
  };

  /**
   * 记下"这一份值是从哪一段文本来"。三格必须**一起**写（评审 P1-5）：只记值不记文本，
   * 下拉切到树时就没法知道这棵树该不该跟着当前的输入走。
   * @param {unknown} value 那一次解析交回的值
   * @param {string} text 它来自的那一段原文（YAML / XML / CSV 转回时是那些原文，不是 JSON 文本）
   */
  const remember = (value, text) => {
    lastValue = value; lastValueReady = true; lastTreeText = text;
  };

  /**
   * 这一枚动作没碰树，而树上挂的是**另一段文本**的结果 —— 拆掉（评审 P1-4 的最后一格）。
   * 转义那一族排在解析之前，永远走不到 `buildTree`，旧口径于是留下"输入是 `hi`、树里还是 `{"a":1}`"
   * 这种会说谎的旁证。同一份文本刚算过的树可以留着：它展示的确实是眼前这一份的结构。
   * @param {string} text 当前输入
   */
  const dropStaleTree = (text) => {
    if (treeModel !== null && treeModel.text !== text) dropTree();
  };

  /**
   * 按一枚动作算一遍并画。顺序是**闸门 → 换算 → 才画**：`gate` 不过就 `paintRefuse`（不解析、
   * 不进 DOM、不擦上一格），空输入抛 `FieldError`（不碰选区），档位写错让 `coreFormat` 那本自己抛上去。
   * @param {string} key 动作 key（`JSON_ACTIONS` 里的一格）
   */
  const computeAndPaint = (key) => {
    if (key === 'copy') { doCopy(buttonId(prefix, PANEL, 'copy')); return; }
    if (key === 'download') { doDownload(); return; }

    const text = areaOf();
    if (text.trim() === '') {
      // 空输入也算"当前这份算不出来"，树不许留着上一份（红线 5 管的是文本栏那一句提示）
      dropTree();
      throw new FieldError('粘贴框是空的，先粘一段 JSON 再按这一格。');
    }
    const g = coreGate(text);
    if (!g.ok) { paintRefuse(g); return; }        // 拒收这一档本来就不该往 storage 塞东西（红线 6）

    const action = ACTION_BY_KEY.get(key);
    const title = action ? action.label : key;
    const indent = valueOf('indent') ?? 'two';
    const sort = valueOf('sort') ?? 'off';
    const isTree = viewValue() === 'tree';

    // 转义那一族排在**解析之前**（评审 P1-3）：要转义的东西按定义就不是合法 JSON，
    // 旧口径把 `coreParse` 放在 if 链前面，于是这两枚按钮只对"本来就能解析"的输入有用——
    // 而那正是最不需要转义的那一份。粘 `hello "world"` 按转义，得到的是"这里该放一个值，来的是「h」"。
    if (key === 'escape') { paintResult('json', 'ok', title, `"${escapeText(text)}"`); dropStaleTree(text); return; }
    if (key === 'unescape') {
      // 剥掉最外那一层引号，与上面那一枚对称：`转义 → 反转义` 要能回到原样（评审 P1-3 的第二半）。
      const bare = text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;
      const u = unescapeText(bare);
      if (!u.ok) { paintErr('json', u.error, text, title, g.lines); return; }
      paintResult('json', 'ok', title, u.text);
      dropStaleTree(text);
      return;
    }

    if (key === 'yamlIn' || key === 'xmlIn' || key === 'csvIn') {
      const back = key === 'yamlIn' ? yamlToJson(text) : key === 'xmlIn' ? xmlToJson(text) : csvToJson(text);
      // 读条的上下文给的是**这一栏真正的内容**（YAML / XML / CSV 原文），不是 JSON 文本
      if (!back.ok) { paintErr('json', back.error, text, title, g.lines); return; }
      remember(back.value, text);
      const s = stringifyJson(back.value, { indent, sort });
      paintResult('json', 'ok', title, s.text, { notes: notesFor(key, null) });
      if (isTree) buildTree(back.value, text);
      persistInput(g, text);
      return;
    }

    const p = coreParse(text);
    if (!p.ok) { paintErr('json', p.error, text, title, g.lines); return; }
    remember(p.value, text);
    const notes = notesFor(key, p);

    if (key === 'validate') {
      const s = stringifyJson(p.value, { indent, sort });
      const dup = p.duplicateKeys && p.duplicateKeys.length ? `${p.duplicateKeys.length} 处重复键` : undefined;
      paintResult('json', 'ok', title, s.text, { note: dup, notes, stats: p.stats });
      if (isTree) buildTree(p.value, text);
      persistInput(g, text);
      return;
    }

    if (key === 'format') { const r = coreFormat(text, { indent, sort }); paintResult('json', 'ok', title, r.text, { notes }); }
    else if (key === 'minify') { const r = minifyJson(text); paintResult('json', 'ok', title, r.text, { notes }); }
    else if (key === 'ts') { paintResult('ts', 'ok', title, generateTs(p.value, { indent }).text, { notes }); }
    else if (key === 'yamlOut') { paintOut(jsonToYaml(p.value), 'yaml', title, text, notes, g.lines); }
    else if (key === 'xmlOut') { paintOut(jsonToXml(p.value, { indent }), 'xml', title, text, notes, g.lines); }
    else if (key === 'csvOut') { paintOut(jsonToCsv(p.value), 'csv', title, text, notes, g.lines); }
    else { throw new RangeError(`没有这一枚动作：${key}`); }

    if (isTree) buildTree(p.value, text);
    persistInput(g, text);
  };

  /** 值 → 文本那一族（yaml/xml/csv 转出）共用的收尾：模块给 `{ok,text|error}`，坏的话走读条那一档 */
  const paintOut = (r, kind, title, text, notes, lines) => {
    if (!r.ok) { paintErr(kind, r.error, text, title, lines); return; }
    paintResult(kind, 'ok', title, r.text, { notes });
  };

  const runAction = (key) => () => runGuarded(buttonId(prefix, PANEL, key), () => {
    try {
      computeAndPaint(key);
    } catch (err) {
      if (err && err.isField === true) { paintLine('hint', 'idle', err.message); return; }
      // 内部不变量坏了：原样上抛交给注入的 `runGuarded`，但**不许在这里改任何已画的东西**
      //（红线 5 的那半边——评审 F 组量的就是"抛之前先擦了上一格"这条路，`computeAndPaint`
      //  一律先算后画，坏在算的时候就没有一次 `paint` 发生过）。
      throw err;
    }
  });


  // ── 接线与挂载 ──────────────────────────────────────────────────────────

  const wireAll = () => {
    // 六枚控件
    for (const cfg of JSON_SPEC[PANEL].sides[SIDE].controls) {
      const el = node(fieldId(prefix, PANEL, cfg.id));
      if (!el) continue;
      if (cfg.id === 'doc') {
        // 输入只更新闸门读数：一次 input 排一个防抖令牌，绝不在这条路上解析（W16 红线 4）
        el.addEventListener('input', scheduleGate);
        // 行号槽纵跟横不跟：它是固定在左边的定宽列，跟着横滚会滑出视野（W17）
        el.addEventListener('scroll', () => {
          const gu = node(GUTTER);
          if (gu) gu.style.transform = `translateY(-${Math.max(0, Number(el.scrollTop) || 0)}px)`;
        });
      } else if (cfg.id === 'view') {
        el.addEventListener('change', () => {
          applySwitch();
          if (viewValue() !== 'tree') return;
          // 切到树只重画**上一次算出来的那一份**，而且必须确认那一次吃的就是当前这段文本
          // （红线 4：这一格事件里不许解析）。评审 P1-4 量的正是旧口径那句 `lastValueReady`——
          // 输入早换了、值还是上一份的，屏幕上就是一棵没人认领的树。
          if (lastValueReady && lastTreeText === areaOf()) buildTree(lastValue, lastTreeText);
          else updateGate('换了输入，再按一次动作树才跟着变');
        });
      } else if (cfg.id === 'query') {
        // 搜索只涂色与报数，不重拍行集（`searchRows` 只改 `matched` 那一格），所以它不解析、不动结果区
        el.addEventListener('input', scheduleSearch);
      } else if (cfg.id === 'memorize') {
        el.addEventListener('change', persistToggle);
      }
    }
    // 十四枚动作按钮（`copy` 与 `download` 也在这一串里，走的就是 `computeAndPaint` 那两个早退）
    for (const a of JSON_ACTIONS) {
      const btn = node(buttonId(prefix, PANEL, a.key));
      if (btn) btn.addEventListener('click', runAction(a.key));
    }
    // 两枚复制各自的原文案都要先记下（评审 P2-9）。工具栏那一枚的线在上面那一串里已经挂过，
    // 这里只补结果栏那一枚；`copyLabels` 若只记一处，另一枚的 `original` 就退成**点击当时**的
    // `btn.textContent`——上一轮的"已复制"还没改回去时，那句临时文案就此转正。
    const cb = node(MAIN_COPY);
    if (cb) { copyLabels.set(MAIN_COPY, cb.textContent); cb.addEventListener('click', () => doCopy(MAIN_COPY)); }
    const tb = node(buttonId(prefix, PANEL, 'copy'));
    if (tb && tb !== cb) copyLabels.set(buttonId(prefix, PANEL, 'copy'), tb.textContent);
    // 树的点击代理挂在**容器**上，且挂在树存在之前：行是控制器随时重建的，
    // 把监听挂在一枚行上等于挂在一堆会消失的节点上（展开一次，选中就漂了）。
    const treeBox = node(TREE);
    if (treeBox) treeBox.addEventListener('click', onTreeClick);

    // 缺环境就置灰（W15：按下去没反应的一枚开关比没有更糟）
    const dl = node(buttonId(prefix, PANEL, 'download'));
    if (dl && !canBlob) dl.disabled = true;
    const mem = node(fieldId(prefix, PANEL, 'memorize'));
    if (mem && !store) mem.disabled = true;
    syncCopy();

    // 挂载期的三笔：显隐 → 恢复（填回但不算）→ 空态 + 一次闸门读数
    applySwitch();
    const didRestore = restore();
    paintLine('empty', 'idle', '还没有算过。粘贴进来，再按上面任意一个动作。');
    updateGate(didRestore ? '已恢复上次输入' : undefined);
  };

  const renderers = {};
  for (const panel of JSON_PANEL_IDS) renderers[panel] = mount;

  /**
   * 接一遍线并画空态；**重入只补对账、不挂第二根监听**（W13：一次按键跑两遍计算是缺陷）。
   *
   * `wired` 排在 `wireAll()` **之后**（评审 P0-2）：那一路里任何一格抛（旧口径的 `restore()` 撞上
   * 隐私模式的 `getItem` 就是这一档），先置了 `wired` 就等于宣布"这页接好了"，而它其实停在半路上——
   * 空态没画、闸门没读，重入也不会再来一遍。装配层现在把存储那几只都包住了，`wireAll` 不该抛；
   * 真抛了就是页面的事，让它带着"还没接"的状态抛出去。
   * @returns {{missing: string[], rendered: string[]}} spec 应存在的 id 分两类：骨架给了的 / 缺的
   */
  function mount() {
    const ids = controlIds(prefix);
    const report = { missing: [], rendered: [] };
    for (const list of Object.values(ids)) {
      for (const id of list) {
        if (node(id)) report.rendered.push(id); else report.missing.push(id);
      }
    }
    if (!wired) { wireAll(); wired = true; }
    return report;
  }

  const actions = {};
  for (const a of JSON_ACTIONS) actions[a.key] = runAction(a.key);

  return {
    renderers,
    actions,
    state: () => ({ tone: current.tone, kind: current.kind, out: current.out }),
    mount,
  };
}

export { SIDES };
