/**
 * 编码工具箱页的装配层：把 `tools-codec.html` 里那些静态控件接到四本纯模块上，
 * 结果交给 `codecView.js`（纯字符串）渲染，复制那一栏的纯文本交给 `ui`（`window.Tk.ui`）兜底。
 *
 * 这一层存在的理由与 `workbench.js` 同源，也只有这一条：**控件与面板的对应关系只允许有一处**。
 * 五块面板、六栏、21 格控件、六条按钮与六个结果区，如果"哪个 id 属于哪一栏"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，改一处漏一处，而漏掉那一处只在页面上表现为"点了没反应"。所以这里用
 * `CODEC_SPEC` 声明每块面板的控件、开关与视图 kind，所有 id 由 `fieldId()` / `buttonId()` /
 * `copyId()` / `outId()` / `whenId()` 派生；HTML 里的 `data-tk-when` 是写给人和样式看的标记，
 * 运行时不读它，它与 spec 是否一致由 Task 9 在构建产物上对账。
 *
 * 五条口径，§R 的判据逐条对着咬：
 *
 * 1. **本文件不读运行环境**。时钟、时区偏移、`crypto.subtle` 三样一律从 `env` 递进来：
 *    相对时间那一行与档间耗时那一行必须是注入时钟的函数，否则同一份产物在两台机器上给出两个
 *    答案（§R 的 R3 用五个词反过来量装配层与入口）。`env.now` 与 `env.offsetMinutes` 都**允许缺席**，
 *    缺席就是缺席：那一行整行不出现，而不是拿 `Date.now()` 或宿主时区补一个看起来像事实的数字。
 * 2. **挂载期不计算**。`renderers[panel]` 只接线并画"等待输入"，计算只在用户动手之后发生。
 *    这一条不是洁癖：`#digest` 那一栏要 `await`，挂载期抢跑的话 reject 落在 `mount()` 返回值之外，
 *    `createPanelDom` 的错误条记不到它，页面上就留下一格永远空白的面板。
 * 3. **两类失败分两条路**。用户填的格子不能用 → `FieldError` → 结果区一句提示，面板不算坏；
 *    模块或骨架自己抛的 → 原样上抛，交给 `createPanelDom.run()` 标坏那一块。
 * 4. **页面级预闸门排在模块之前**。三块面板的输入上限（Base64 / URL / 正则的 1 MiB、正则的
 *    500 字符、摘要文本的 1 MiB、摘要文件的 5 MiB）在这里拦，为的是"越界的输入根本不进模块"：
 *    既省一次全量扫描，也让结论落进"已拒收"而不是"不成立"——整栏没处理与这一串东西不对，
 *    是两句不同的话。模块自己的同一道闸门仍在（§L / §M / §N 判过），这里不替换它，只排在它前面。
 * 5. **框架层不 import**。`panel` / `panel-dom` / `view` / `ui` 四只都从 `env.Tk` 拿；本文件
 *    import 的五本（四本纯模块 + `codecView.js`）是闭合清单。`codecView.js` 在全仓库只许被本文件
 *    reach——多一个入口 reach 它，Rollup 就把它提成共享 chunk，产物里那句 `import{` 会把整页打成
 *    SyntaxError，而构建仍然是 exit=0（实测记录在 `dev/js/toolkitCore.js` 开头）。
 *
 * 与 `workbench.js` 的分工：那一本服务证件页（六本业务模块、表格为主的读侧），这一本服务编码页
 * （四本纯模块、结果区为主的一次性换算）。两本不互相 import：`workbench.js` 把六本模块全带进来，
 * 接过去就等于让编码页替证件页付 gzip（§7 那一行余量按字节算）。异步只出现在 `#digest` 一条路上，
 * 另外四块面板都是同步纯算式。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §R 十六判。
 */
import {
  TIME_CAVEAT, parseTimestamp, fromEpoch, relativeTime, dateDiff, parseCivilDate,
} from './time.js';
import {
  BASE64_CAVEAT, URL_CAVEAT, MAX_INPUT_BYTES, encodeBase64, decodeBase64, byteLen,
  encodeDataUri, decodeDataUri, urlPair, splitQuery, encodeUrl, encodeUrlComponent,
} from './codec.js';
import {
  REGEX_CAVEAT, MAX_MATCHES, MAX_PATTERN_CHARS, normalizeFlags, findMatches, previewReplace,
} from './regex.js';
import {
  DIGEST_CAVEAT, MAX_TEXT_BYTES, MAX_BYTES, digestAll,
} from './digest.js';
import { createCodecView } from './codecView.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/**
 * 一栏的两个名字。`main` 每块面板都有，`diff` 只有 `#timestamp` 有——"两个日期之差"是这一页里
 * 唯一一处"同一块面板要算两件事"的形状，其余四块各一栏。
 */
const SIDES = ['main', 'diff'];

/** 结果区里"这一栏的输入不能用"那一行的类名（与证件页共用同一个钩子） */
const HINT_CLASS = 'tk-hint';

/**
 * `encodeURI` 与 `encodeURIComponent` 处理不同的那 18 个保留字符，逐字对着 RFC 3986 的
 * `gen-delims / sub-delims`。为什么在这一层重列一遍而不是 import：`codec.js` 的 `RESERVED`
 * 是模块内部的检查表（§L 的 L11 拿它判"哪些字符在两档里不一样"），而面板上那一行"多少个字符
 * 在这一档不编码"要的是**同一件事的另一侧证据**——两处各列一份、由 §R 的 R10 判出 11 个，
 * 比共享一份常量更能挡住"有人改了表却没人发现面板那句数字变了"。
 */
const URL_RESERVED = ":/?#[]@!$&'()*+,;=";

/** 每块面板自己的那句口径：模块的常量原样交进来，`codecView` 负责"重复过的那句丢掉" */
const NOTES = {
  timestamp: [TIME_CAVEAT],
  base64: [BASE64_CAVEAT],
  url: [URL_CAVEAT],
  digest: [DIGEST_CAVEAT],
  regex: [REGEX_CAVEAT],
};

/** 偏移分钟的上下限，与 `time.js` 的 `offsetGate` 同一档（±14 小时） */
const OFFSET_LIMIT = 840;

/**
 * 「这一栏还没有输入」的那一份外壳，按 `kind` 取。
 *
 * 两处共用它是刻意的：**挂载期画的就是这张表**（口径 2——那时一次计算都不做，格子里
 * 已经粘好了东西也一样），而格子被清空之后的那一次点击回到同一张表（`#regex` 只把 `capped`
 * 换成上限格里的那个数，字段集一字不动）。分成两份的话，"刷新页面看到的形状"和
 * "清空输入看到的形状"就会悄悄长得不一样，而那正是没有判据咬得住的一类差异
 * （§R 的 R5 / R11 / R14 三条量的都是"挂载期那一格"）。
 *
 * 冻起来是因为这张表被六栏共享：某一栏的模型函数就地补一个字段，另外五栏会跟着变。
 */
const IDLE = Object.freeze({
  timestamp: Object.freeze({ verdict: 'empty', input: '', readings: [], fields: [], diff: null }),
  base64: Object.freeze({ verdict: 'empty', input: '', out: '', bytes: 0, fields: [] }),
  url: Object.freeze({
    verdict: 'empty', input: '', pair: [], differs: [], decodeTries: [], queryRows: [], bytes: 0,
  }),
  digest: Object.freeze({ verdict: 'empty', input: '', rows: [], bytes: 0, kind: '' }),
  regex: Object.freeze({
    verdict: 'empty', input: '', capped: MAX_MATCHES, findings: [], flags: '', count: 0,
    matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
  }),
});

/**
 * 控件的值 → `<prefix>-in-<panel>-<control>`。与 `tools-codec.html` 里逐字符对应。
 * @param {string} prefix 前缀（编码页 `tk`，换前缀整套跟着换）
 * @param {string} panel 面板 slug
 * @param {string} control 控件 slug
 * @returns {string} 元素 id
 */
export function fieldId(prefix, panel, control) {
  return `${prefix}-in-${panel}-${control}`;
}

/**
 * 主按钮 id：`<prefix>-btn-<panel>-<side>`。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function buttonId(prefix, panel, side) {
  return `${prefix}-btn-${panel}-${side}`;
}

/**
 * 复制按钮 id：`<prefix>-copy-<panel>-<side>`。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function copyId(prefix, panel, side) {
  return `${prefix}-copy-${panel}-${side}`;
}

/**
 * 结果区 id：`<prefix>-out-<panel>-<side>`，外层容器与 `aria-live` 由构建期骨架给。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function outId(prefix, panel, side) {
  return `${prefix}-out-${panel}-${side}`;
}

/**
 * 受开关控制的字段组 id：`<prefix>-when-<panel>-<key>`。单位是 HTML 里那一段 `<p data-tk-when>`
 * 而不是控件本身——把一格 `<select>` 整个藏掉会留下一条没人答的标签。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} key 开关目标 key
 * @returns {string} 元素 id
 */
export function whenId(prefix, panel, key) {
  return `${prefix}-when-${panel}-${key}`;
}

// ── CODEC_SPEC：五块面板的唯一形状 ───────────────────────────────────────────

/**
 * 面板 → 栏位 → 控件、开关与视图 kind。
 *
 * 每一项都必须在：`type` 是取值方式（`text` 单行去空白 / `number` 同 `text` 但 Enter 提交 /
 * `area` 粘贴框整段 / `select` 下拉 / `file` 文件），`kind` 是 `codecView.js` 的那块面板名
 * （白名单在它那边，写错一个词渲染时就抛），`options` 是 `<select>` 的真选项 token（骨架的
 * `<option>` 文案归 HTML，运行时不读）。`switch` 说"哪一格的值决定哪几段显隐"。
 *
 * 摘要那两格控件的 id 与字段组的 key **同名**（`payload` / `upload`）：开关目标必须是一格
 * 真实存在的控件，否则页面上多一条没人接的 `data-tk-when`。
 *
 * @type {Record<string, {sides: Record<string, object>}>}
 */
export const CODEC_SPEC = {
  timestamp: {
    sides: {
      main: {
        kind: 'timestamp',
        controls: [
          { id: 'value', type: 'text' },
          { id: 'offset', type: 'number' },
        ],
      },
      diff: {
        kind: 'timestamp',
        controls: [
          { id: 'from', type: 'text' },
          { id: 'to', type: 'text' },
        ],
      },
    },
  },
  base64: {
    sides: {
      main: {
        kind: 'base64',
        controls: [
          { id: 'mode', type: 'select', options: ['encode', 'decode', 'dataUri', 'dataUriDecode'] },
          { id: 'text', type: 'area' },
          { id: 'strict', type: 'select', options: ['loose', 'strict'] },
          { id: 'mime', type: 'text' },
        ],
        switch: {
          control: 'mode',
          targets: [
            { key: 'strict', when: ['decode'] },
            { key: 'mime', when: ['dataUri'] },
          ],
        },
      },
    },
  },
  url: {
    sides: {
      main: {
        kind: 'url',
        controls: [{ id: 'text', type: 'area' }],
      },
    },
  },
  digest: {
    sides: {
      main: {
        kind: 'digest',
        controls: [
          { id: 'mode', type: 'select', options: ['text', 'file'] },
          { id: 'payload', type: 'area' },
          { id: 'upload', type: 'file' },
        ],
        switch: {
          control: 'mode',
          targets: [
            { key: 'payload', when: ['text'] },
            { key: 'upload', when: ['file'] },
          ],
        },
      },
    },
  },
  regex: {
    sides: {
      main: {
        kind: 'regex',
        controls: [
          { id: 'pattern', type: 'text' },
          { id: 'flags', type: 'text' },
          { id: 'text', type: 'area' },
          { id: 'repl', type: 'text' },
          { id: 'limit', type: 'number' },
        ],
      },
    },
  },
};

/** 面板顺序就是 `data-tk-ids` 与索引条的顺序；导出给 §R 与入口用，别再各写一份清单 */
export const CODEC_PANEL_IDS = Object.keys(CODEC_SPEC);

// ── FieldError：用户填的格子不能用 ──────────────────────────────────────────

/**
 * "这一格不能用"这一类失败。它不是面板坏了：消息进结果区的提示行，面板不进 broken 名单。
 * 与证件页那一份同形状但**不 export**（§R 的 R1 钉死本文件的导出面是九个名字），也不 import
 * 那一本——`workbench.js` 会把六本业务模块一起拖进来。
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

// ── createCodecWorkbench ────────────────────────────────────────────────────

/**
 * 造一个编码页的装配器。
 *
 * @param {object} env 依赖注入。四本纯模块与 `codecView` 是直接 `import` 的（只有一个入口 reach
 *   它们，不会成共享 chunk），框架层与宿主环境全部从 `env` 进来。
 * @param {object} env.document 只需 `getElementById` / `createElement`；控件一律按派生 id 找
 * @param {object} env.Tk `window.Tk`，必须齐 `view`（转义与判定表那一半）与 `ui.copyInto`
 * @param {(panel: string, fn: () => void) => boolean} env.runGuarded 通常是
 *   `createPanelDom().run`；挂载期不走它（那时 `mounted` 还是 false）
 * @param {object} [env.navigator] 只为 `clipboard`，没有就走 `execCommand` 兜底
 * @param {(fn: () => void, ms: number) => number} [env.later] `setTimeout` 的别名
 * @param {() => number} [env.now] 注入时钟；缺席就没有"相对时间"与"档间耗时"那两行
 * @param {number} [env.offsetMinutes] 本地相对 UTC 的偏移分钟数；缺席按 0（也就是按 UTC 出本地行）
 * @param {object|null} [env.subtle] `crypto.subtle`；`null` 是"这一档确实取不到"，
 *   不传是让 `digest.js` 自己去 `globalThis.crypto` 找（浏览器里就是那一条路）
 * @param {string} [env.prefix] 前缀，默认 `tk`
 * @returns {{renderers: Record<string, (el: object) => void>,
 *   run: (panel: string, side: string) => boolean,
 *   copyTextOf: (panel: string, side: string) => string}}
 */
export function createCodecWorkbench(env = {}) {
  const e = env ?? {};
  if (!e.document || typeof e.document.getElementById !== 'function'
    || typeof e.document.createElement !== 'function') {
    throw new TypeError('createCodecWorkbench：env.document 要有 getElementById 与 createElement');
  }
  if (!e.Tk || !e.Tk.view) {
    throw new TypeError('createCodecWorkbench：env.Tk.view 应是 window.Tk 里那份 view（跨页共用层走 toolkitCore，不许 import）');
  }
  if (!e.Tk.ui || typeof e.Tk.ui.copyInto !== 'function') {
    throw new TypeError('createCodecWorkbench：env.Tk.ui.copyInto 应是 window.Tk 里那份 ui（缺它的下场是点复制按钮没反应）');
  }
  if (typeof e.runGuarded !== 'function') {
    throw new TypeError('createCodecWorkbench：env.runGuarded 应是 createPanelDom().run，按钮回调不许自己 try/catch 出第二套错误口径');
  }
  // `now` 与 `offsetMinutes` 都允许缺席，但不许是"给了却不能用"的形状：非函数的时钟会让
  // "相对时间"那一行静默消失，字符串偏移要等 `fromEpoch` 那口才响——那时已经是一块面板塌了。
  if (e.now !== undefined && e.now !== null && typeof e.now !== 'function') {
    throw new TypeError(`createCodecWorkbench：env.now 应为函数或缺席，收到 ${typeof e.now}`);
  }
  const hasOffset = e.offsetMinutes !== undefined && e.offsetMinutes !== null;
  if (hasOffset && (!Number.isInteger(e.offsetMinutes) || Math.abs(e.offsetMinutes) > OFFSET_LIMIT)) {
    throw new TypeError(`createCodecWorkbench：env.offsetMinutes 应为 ±${OFFSET_LIMIT} 以内的整数分钟数或缺席，收到 ${String(e.offsetMinutes)}`);
  }

  /** 视图在这一层构造一次：`view` 缺哪一格，构造期就点名哪一格（口径 5 的另一半） */
  const cv = createCodecView(e.Tk.view);
  const doc = e.document;
  const view = e.Tk.view;
  const ui = e.Tk.ui;
  const runGuarded = e.runGuarded;
  const prefix = typeof e.prefix === 'string' && e.prefix !== '' ? e.prefix : 'tk';
  const clock = typeof e.now === 'function' ? e.now : null;
  const offsetMinutes = hasOffset ? e.offsetMinutes : 0;
  const subtle = e.subtle === undefined ? undefined : e.subtle;
  const later = typeof e.later === 'function' ? e.later : (fn, ms) => setTimeout(fn, ms);
  const clipboard = e.navigator && e.navigator.clipboard ? e.navigator.clipboard : null;

  /** `panel:side → 这一栏当前能复制的纯文本`；渲染时写，复制按钮读它，不从 HTML 反解 */
  const copies = new Map();
  /** `copyId → 骨架那句原文案`：改口之后要能改回**页面里那一句**，而不是这里写死的一句 */
  const copyLabels = new Map();
  const at = (panel, side) => `${panel}:${side}`;
  const node = (id) => doc.getElementById(id);

  // ── 取值 ────────────────────────────────────────────────────────────────

  /** 单行格与下拉：去首尾空白，空值一律 `null`（口径 1：调用方按 `null` 决定"不写这个键"） */
  const valueOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的控件，spec 与骨架对不上`);
    const v = String(typeof el.value === 'string' ? el.value : '').trim();
    return v === '' ? null : v;
  };

  /**
   * 粘贴框：整段文本原样，只把行尾的 `\r` 归一成 `\n`。
   * **不 trim**：编码侧的输入是内容本身，前后各一个空格都要如实编进去；
   * "空不空"由调用侧按 `.trim() === ''` 判，那是两件事。
   */
  const areaOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的粘贴框，spec 与骨架对不上`);
    return String(typeof el.value === 'string' ? el.value : '').replace(/\r\n?/g, '\n');
  };

  /** 文件格：`FileList` 在假 DOM 上就是个数组，取第一个 */
  const fileOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的文件格，spec 与骨架对不上`);
    const list = el.files;
    return list && list.length > 0 ? list[0] : null;
  };

  /** 整数格：越界与不合法都是"这一格不能用"（口径 3），点名是哪一格、范围是多少、现在是什么 */
  const intOf = (panel, control, min, max, label) => {
    const raw = valueOf(panel, control);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new FieldError(`${label}应为 ${min}–${max} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 越界那一句的公共形状：报实际字节数、报上限、明说"不截断"（与三本模块同一口径） */
  const overLimit = (n, limit, unit) => `输入 ${n} 字节，超过 ${limit} 字节（${unit}）上限，整体拒绝、不截断`;

  // ── 渲染 ────────────────────────────────────────────────────────────────

  /** 唯一的 `innerHTML` 出口：缺结果区就点名 id，让绑定层把这一块标坏（口径 3 的后半） */
  const paint = (panel, side, html) => {
    const id = outId(prefix, panel, side);
    const out = node(id);
    if (!out) throw new RangeError(`页面里没有 id="${id}" 的结果区，spec 与骨架对不上`);
    out.innerHTML = html;
  };

  /** 提示行（这一格不能用）——不算内容，所以复制按钮跟着禁用 */
  const hint = (panel, side, message) => {
    paint(panel, side, `<p class="${HINT_CLASS}">${view.esc(message)}</p>`);
    copies.set(at(panel, side), '');
    syncCopy(panel, side);
  };

  /** 复制按钮的可用性只由"这一栏有没有可复制的文本"决定，不靠样式类猜 */
  const syncCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    if (!btn) return;
    btn.disabled = (copies.get(at(panel, side)) || '') === '';
  };

  /** 一块面板的完整渲染：视图出 HTML，装配层记下纯文本 */
  const paintSide = (panel, side, model, copy) => {
    paint(panel, side, cv.block(panel, model, NOTES[panel]));
    copies.set(at(panel, side), copy);
    syncCopy(panel, side);
  };

  // ── #timestamp：主栏 ────────────────────────────────────────────────────

  /**
   * 本地偏移取哪一档：用户那一格填了就以它为准，否则用入口注入的宿主偏移，都没有就是 0。
   * 越界与不合法是 `FieldError`——`time.js` 的 `offsetGate` 会抛，但那是一条模块异常，
   * 会被绑成"这块面板坏了"；这一格本来就是给用户填的，得走提示行那条路。
   */
  const offsetOf = () => {
    const raw = valueOf('timestamp', 'offset');
    if (raw === null) return offsetMinutes;
    const n = Number(raw);
    if (!Number.isInteger(n) || Math.abs(n) > OFFSET_LIMIT) {
      throw new FieldError(`时区偏移应为 ±${OFFSET_LIMIT} 以内的整数分钟数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /**
   * 一串输入 → epoch 毫秒。先按时间戳，不成立再按民用日期（K3 的那两条口径同在一页上），
   * 两档都不成立就把两条理由并成一句——只报一条等于把用户支走。
   * @param {string} raw 输入原样（已 trim）
   * @param {number} off 本地偏移分钟数
   * @returns {{epochMs:number|null, reason:string|null, via:string}} `via` 是"按哪一档成的"
   */
  const epochOf = (raw, off) => {
    const ts = parseTimestamp(raw);
    if (ts.verdict === 'second' || ts.verdict === 'milli') {
      return { epochMs: ts.epochMs, reason: null, via: 'timestamp', ts };
    }
    if (ts.verdict === 'ambiguous') {
      return { epochMs: null, reason: ts.reason, via: 'timestamp', ts };
    }
    const civil = parseCivilDate(raw, off);
    if (civil.ok) {
      return { epochMs: civil.epochMs, reason: `按民用日期解释（串里没写时区，就按本地偏移 ${off} 分钟算）`, via: 'civil', ts };
    }
    return { epochMs: null, reason: `按时间戳：${ts.reason}；按民用日期：${civil.reason}`, via: 'none', ts };
  };

  /** 明细表那五行 + 相对时间那一行（视图补那一行，装配层只交事实） */
  const tsFields = (epochMs, off) => {
    const f = fromEpoch(epochMs, off);
    return {
      fields: [
        { label: 'UTC', value: f.isoUtc, mono: true },
        { label: '本地', value: f.isoLocal, mono: true },
        { label: '可读', value: f.localDisplay },
        { label: 'Unix 秒', value: f.unixSeconds },
        { label: 'Unix 毫秒', value: f.unixMillis },
      ],
      lines: [
        `UTC：${f.isoUtc}`,
        `本地：${f.isoLocal}`,
        `可读：${f.localDisplay}`,
        `Unix 秒：${f.unixSeconds}`,
        `Unix 毫秒：${f.unixMillis}`,
      ],
    };
  };

  const tsModel = () => {
    const raw = valueOf('timestamp', 'value');
    if (raw === null) return { model: IDLE.timestamp, copy: '' };
    const off = offsetOf();
    const parsed = epochOf(raw, off);
    if (parsed.ts.verdict === 'ambiguous') {
      // 长度两可：两种解释并列（视图那三列就是为这一档写的），谁都不许被标成"已换算"
      return {
        model: {
          verdict: 'ambiguous', reason: parsed.ts.reason, input: raw,
          readings: parsed.ts.readings, fields: [], diff: null,
        },
        copy: parsed.ts.readings.map((r) => `${r.kind === 'second' ? '按秒' : '按毫秒'}：${r.isoUtc}`).join('\n'),
      };
    }
    if (parsed.epochMs === null) {
      return { model: { verdict: 'invalid', reason: parsed.reason, input: raw, readings: [], fields: [], diff: null }, copy: '' };
    }
    const { fields, lines } = tsFields(parsed.epochMs, off);
    const relative = clock ? relativeTime(parsed.epochMs, clock()).text : null;
    const copy = lines.slice();
    if (relative !== null) {
      copy.push(`相对时间：${relative}`);
    }
    return {
      model: {
        verdict: 'converted', reason: parsed.via === 'civil' ? parsed.reason : null, input: raw,
        readings: [], fields, relative, diff: null,
      },
      copy: copy.join('\n'),
    };
  };

  // ── #timestamp：差值栏 ──────────────────────────────────────────────────

  const tsDiffModel = () => {
    const a = valueOf('timestamp', 'from');
    const b = valueOf('timestamp', 'to');
    if (a === null || b === null) {
      return { model: IDLE.timestamp, copy: '' };
    }
    const off = offsetOf();
    const ea = epochOf(a, off);
    const eb = epochOf(b, off);
    if (ea.epochMs === null || eb.epochMs === null) {
      // 只点名坏掉的那一端：另一端是好的，一起挨打等于把用户已经填对的东西说成错的
      const bad = [];
      if (ea.epochMs === null) bad.push(`起点「${a}」：${ea.reason}`);
      if (eb.epochMs === null) bad.push(`终点「${b}」：${eb.reason}`);
      return { model: { verdict: 'invalid', reason: bad.join('；'), input: `${a} → ${b}`, readings: [], fields: [], diff: null }, copy: '' };
    }
    const diff = dateDiff(ea.epochMs, eb.epochMs);
    const d = diff;
    const lines = [
      `日历分解：${d.ymd.years} 年 ${d.ymd.months} 个月 ${d.ymd.days} 天`,
      `整 24 小时：${d.totalDays} 天`,
      `跨 UTC 日历日：${d.calendarDays} 天`,
    ];
    return {
      model: {
        verdict: 'converted', input: `${a} → ${b}`, readings: [], fields: [],
        diff: { ...d, sign: d.sign },
      },
      copy: lines.join('\n'),
    };
  };

  // ── #base64 ─────────────────────────────────────────────────────────────

  /**
   * 解码那一档"替用户动过手"的两笔账：视图的 `fields` 只摆格，话说成"补齐的 padding"
   * 与"剥掉的空白"归视图。装配层交数字，并且在数字为 0 时**不写那一行**——
   * 一栏"补齐的 padding：0"读起来像出过事又没事。
   */
  const b64LossRows = (r) => {
    const rows = [];
    if (r.paddingImplied > 0) rows.push({ label: '补齐的 padding', value: r.paddingImplied, mono: true });
    if (r.whitespaceDropped > 0) rows.push({ label: '剥掉的空白', value: r.whitespaceDropped, mono: true });
    return rows;
  };

  const base64Model = () => {
    const mode = valueOf('base64', 'mode');
    const text = areaOf('base64', 'text');
    if (mode === null || text.trim() === '') {
      return { model: IDLE.base64, copy: '' };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: { verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'), input: text, out: '', bytes, fields: [] },
        copy: '',
      };
    }
    if (mode === 'encode') {
      const r = encodeBase64(text);
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: r.bytes, fields: [] }, copy: '' };
      return { model: { verdict: 'encoded', input: text, out: r.out, bytes: r.bytes, fields: [] }, copy: r.out };
    }
    if (mode === 'decode') {
      const strict = valueOf('base64', 'strict') === 'strict';
      const r = decodeBase64(text, { strict });
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: 0, fields: [] }, copy: '' };
      const lossy = b64LossRows(r);
      return {
        model: {
          verdict: lossy.length > 0 ? 'lossy' : 'decoded', input: text,
          out: r.out, bytes: byteLen(r.out), fields: lossy,
        },
        copy: r.out,
      };
    }
    if (mode === 'dataUri') {
      const mime = valueOf('base64', 'mime');
      const r = encodeDataUri(text, mime);
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: r.bytes, fields: [] }, copy: '' };
      return {
        model: {
          verdict: 'encoded', input: text, out: r.out, bytes: r.bytes,
          fields: mime === null ? [{ label: 'mime', value: 'text/plain（默认）' }] : [],
        },
        copy: r.out,
      };
    }
    const r = decodeDataUri(text);
    if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: 0, fields: [] }, copy: '' };
    const fields = [
      { label: 'mime', value: r.mime },
      { label: 'charset', value: r.charset },
    ];
    if (r.mimeDefaulted) fields.push({ label: 'mime 来源', value: '缺省补 text/plain' });
    if (r.charsetDefaulted) fields.push({ label: 'charset 来源', value: '缺省补 utf-8' });
    if (r.percentHits > 0) fields.push({ label: '百分号解码', value: r.percentHits, mono: true });
    const loss = b64LossRows(r);
    return {
      model: {
        verdict: loss.length > 0 ? 'lossy' : 'decoded', input: text,
        out: r.data, bytes: byteLen(r.data), fields: [...fields, ...loss],
      },
      copy: r.data,
    };
  };

  // ── #url ────────────────────────────────────────────────────────────────

  /**
   * 两档编码**都实测一遍**才知道差在哪几个字符：这里数的是"一档原样、另一档编掉"的那些，
   * 而不是抄一个常数——抄来的常数会跟着引擎或表的改动变成一句假话。
   */
  const urlDiffers = () => {
    const out = [];
    for (const ch of URL_RESERVED) {
      const keep = encodeUrl(ch).out === ch;
      const comp = encodeUrlComponent(ch).out === ch;
      if (keep !== comp) out.push(ch);
    }
    return out;
  };

  const urlModel = () => {
    const text = areaOf('url', 'text');
    if (text.trim() === '') {
      return { model: IDLE.url, copy: '' };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'), input: text,
          pair: [], differs: [], decodeTries: [], queryRows: [], bytes,
        },
        copy: '',
      };
    }
    const pair = urlPair(text);
    const base = {
      input: text, bytes: pair.bytes, differs: urlDiffers(),
      pair: [
        { name: 'encodeURI', out: pair.encodeURI },
        { name: 'encodeURIComponent', out: pair.encodeURIComponent },
      ],
      decodeTries: pair.decodeTries,
      queryRows: splitQuery(text),
    };
    if (!pair.ok) {
      return { model: { ...base, verdict: 'invalid', reason: pair.reason }, copy: '' };
    }
    // 「带不带百分号」是这一栏唯一的方向判据：粘进来的多半就是要解的东西，
    // 两档都解不开才是"这串百分号不成立"，而不是"它没被编过"。
    const hasPercent = text.includes('%');
    const decoded = pair.decodeTries.some((t) => t.ok);
    const verdict = hasPercent ? (decoded ? 'decoded' : 'invalid') : 'encoded';
    const reason = hasPercent && !decoded ? pair.decodeTries[0].reason : null;
    return {
      model: { ...base, verdict, reason },
      copy: `encodeURI：${pair.encodeURI}\nencodeURIComponent：${pair.encodeURIComponent}`,
    };
  };

  // ── #digest（唯一要等的一栏）─────────────────────────────────────────────

  /** 五格恒定：全成 → 已算出；有成的但也有败的 → 部分可用；一个都没成 → 看是不是闸门拦的 */
  const digestVerdict = (rows, gatedReason) => {
    const okCount = rows.filter((r) => r.ok).length;
    if (okCount === rows.length) return 'computed';
    if (okCount > 0) return 'partial';
    return gatedReason === null ? 'invalid' : 'rejected';
  };

  const digestCopy = (rows) => rows.filter((r) => r.ok).map((r) => `${r.algo}=${r.hex}`).join('\n');

  const digestIdle = () => ({ model: IDLE.digest, copy: '' });

  /**
   * 摘要这一栏的入口。**同步部分只做闸门**，算的事交给 promise；
   * 两条异步回写（成与败）都重新走一遍 `runGuarded`，否则 reject 落在闸门之外——
   * 控制台红一次，页面上那块面板永远留着上一次的数字。
   */
  const digestModel = () => {
    const mode = valueOf('digest', 'mode');
    const payload = areaOf('digest', 'payload');
    if (mode === null) return { ...digestIdle(), done: true };
    if (mode === 'file') {
      const file = fileOf('digest', 'upload');
      if (!file) return { ...digestIdle(), done: true };
      const declared = Number(file.size);
      if (Number.isFinite(declared) && declared > MAX_BYTES) {
        return {
          model: {
            verdict: 'rejected',
            reason: `这个文件声明 ${declared} 字节，超过 ${MAX_BYTES} 字节（5 MiB）上限，整体拒绝、不读进内存`,
            input: '', rows: [], bytes: declared, kind: '',
          },
          copy: '', done: true,
        };
      }
      return { done: false, task: readThenDigest(file) };
    }
    if (payload.trim() === '') return { ...digestIdle(), done: true };
    const bytes = byteLen(payload);
    if (bytes > MAX_TEXT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_TEXT_BYTES, '1 MiB'),
          input: '', rows: [], bytes, kind: 'text',
        },
        copy: '', done: true,
      };
    }
    return { done: false, task: computeDigest(payload, bytes, 'text', '') };
  };

  /** 读盘 → 算 → 出模型。`arrayBuffer()` 的 reject 原样带出去，交给闸门那一侧标坏这一块 */
  const readThenDigest = async (file) => {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);
    return computeDigest(view, view.byteLength, '', `读的是本地文件 ${String(file.name)}（${view.byteLength} 字节），全部在浏览器里算，不上传、不留存。`);
  };

  /**
   * 五档并列那一张表。`kind` 走视图的两档说法：文本通道是"文本 N 字节"，
   * 文件通道给空串——"字节 N 字节"不是一句人话，而文件那一档已经有 `reason` 点名是哪个文件。
   * @param {string|Uint8Array} input 文本或字节
   * @param {number} bytes 入参字节数（闸门与计数行共用这一把尺子）
   * @param {string} kind 视图那一行的通道名
   * @param {string} privacy 文件档那句来源说明
   */
  const computeDigest = async (input, bytes, kind, privacy) => {
    const out = await digestAll(input, subtle === undefined ? {} : { subtle });
    const gatedReason = out.reason;
    return {
      model: {
        verdict: digestVerdict(out.rows, gatedReason),
        reason: gatedReason !== null ? gatedReason : (privacy === '' ? null : privacy),
        input: typeof input === 'string' ? input : '',
        rows: out.rows,
        bytes,
        kind,
      },
      copy: digestCopy(out.rows),
    };
  };

  // ── #regex ──────────────────────────────────────────────────────────────

  /**
   * 命中表与捕获组表。组的行序是"位置组在前、命名组在后"，两批并存：
   * `named` 只是 `groups` 的一个别名（native 的 `d` 档把位置与命名都给你），
   * 合成一张表会让"第 2 组"和"tail"读起来是同一件事。
   */
  const regexRows = (found) => {
    const matches = found.matches.map((m, i) => ({
      i: i + 1, index: m.index, length: m.length, text: m.text,
    }));
    const groups = [];
    found.matches.forEach((m, mi) => {
      for (let g = 0; g < m.groups.length; g += 1) {
        const cell = m.groups[g];
        groups.push({
          match: mi + 1, label: String(g + 1),
          index: cell.participated ? cell.index : null,
          length: cell.participated ? cell.length : null,
          text: cell.participated ? cell.text : null,
        });
      }
      for (const [name, cell] of Object.entries(m.named ?? {})) {
        groups.push({
          match: mi + 1, label: name,
          index: cell && cell.participated ? cell.index : null,
          length: cell && cell.participated ? cell.length : null,
          text: cell && cell.participated ? cell.text : null,
        });
      }
    });
    return { matches, groups };
  };

  const regexModel = () => {
    const pattern = valueOf('regex', 'pattern');
    const text = areaOf('regex', 'text');
    const limit = intOf('regex', 'limit', 1, MAX_MATCHES, '命中次数上限');
    // `capped` 在视图那一侧是"本次生效的上限次数"，正整数、每栏都要有；空栏也不例外
    const cap = limit === null ? MAX_MATCHES : limit;
    if (pattern === null || text.trim() === '') {
      // 形状仍取自 `IDLE.regex`，只把 `capped` 换成这一格实际生效的那个数：挂载期上限格是空的，
      // 取的也就是 `MAX_MATCHES` 这个同一个值，两处不会长出两种形状。
      return { model: { ...IDLE.regex, capped: cap }, copy: '' };
    }
    if (pattern.length > MAX_PATTERN_CHARS) {
      return {
        model: {
          verdict: 'rejected', reason: `模式 ${pattern.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断`,
          input: text, capped: cap, findings: [], flags: '', count: 0,
          matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
        },
        copy: '',
      };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'),
          input: text, capped: cap, findings: [], flags: '', count: 0,
          matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
        },
        copy: '',
      };
    }
    const rawFlags = valueOf('regex', 'flags') ?? '';
    const opts = {};
    if (clock !== null) opts.now = clock;
    if (limit !== null) opts.maxMatches = limit;
    const found = findMatches(pattern, rawFlags, text, opts);
    const nf = normalizeFlags(rawFlags);
    const checks = [];
    if (nf.ok && nf.deduplicated) {
      checks.push({ key: 'flags', label: 'flags 归一', ok: true, detail: nf.reason });
    }
    const { matches, groups } = regexRows(found);
    // 到没到上限是那一面旗的事；"进没进引擎"看 level——null 是编译/形状之前就没跑成，
    // high 与 medium 是本站的静态闸门明说拒收，两者不是一句"这串东西不对"
    const verdict = !found.executed
      ? (found.level === 'high' || found.level === 'medium' ? 'rejected' : 'invalid')
      : (!found.matched ? 'nomatch' : (found.hitLimit ? 'capped' : 'matched'));
    const repl = valueOf('regex', 'repl');
    let replaced = '';
    if (found.executed && repl !== null) {
      const p = previewReplace(pattern, rawFlags, text, repl, opts);
      if (p.executed) replaced = p.out;
    }
    return {
      model: {
        verdict,
        reason: found.reason,
        input: text,
        capped: found.capped,
        findings: found.findings,
        flags: found.flags,
        count: found.count,
        matches,
        groups,
        hitLimit: found.hitLimit,
        timedOut: found.timedOut,
        elapsedMs: found.elapsedMs,
        replaced,
        ...(checks.length > 0 ? { checks } : {}),
      },
      copy: matches.map((m) => m.text).join('\n'),
    };
  };

  /** 面板 → 一栏的计算分派；`digest` 走异步那条路，其余四块同步 */
  const COMPUTE = {
    timestamp: (side) => (side === 'diff' ? tsDiffModel() : tsModel()),
    base64: () => base64Model(),
    url: () => urlModel(),
    digest: () => digestModel(),
    regex: () => regexModel(),
  };

  /**
   * 算一栏并画上。抛出去的东西由调用侧决定是提示还是标坏（口径 3）；
   * 摘要那一栏返回的是"已经启动了异步任务"，同步那一段照样把闸门结论画上。
   */
  const renderNow = (panel, side) => {
    const r = COMPUTE[panel](side);
    if (panel === 'digest' && r.done === false) {
      const task = Promise.resolve(r.task).then(
        (res) => runGuarded(panel, () => paintSide(panel, side, res.model, res.copy)),
        // 读盘失败一类的异步异常**原样**再抛一次：只标坏这一块，别换成一句装配层自己的话
        (err) => runGuarded(panel, () => { throw err; }),
      );
      return task;
    }
    paintSide(panel, side, r.model, r.copy);
    return true;
  };

  // ── 开关与事件 ──────────────────────────────────────────────────────────

  /**
   * 应用一次显隐。走 `hidden` 布尔属性、不写 `style`：可见性的唯一来源是那一个属性
   * （`panel-dom.js` 口径 5 同一条），两处都能改显隐就等于两处能互相覆盖。
   * 缺节点就跳过——少一段字段组是骨架少一段，不是这块面板坏了（R13 ③ 判的就是这一条）。
   */
  const applySwitch = (panel) => {
    for (const side of SIDES) {
      const cfg = CODEC_SPEC[panel].sides[side];
      const sw = cfg && cfg.switch;
      if (!sw) continue;
      const value = valueOf(panel, sw.control) ?? '';
      for (const target of sw.targets) {
        const el = node(whenId(prefix, panel, target.key));
        if (!el) continue;
        el.hidden = !target.when.includes(value);
      }
    }
  };

  /** 粘贴框里 Ctrl / ⌘ + Enter 才计算：裸 Enter 必须是换行，吞掉用户敲的那次换行是缺陷 */
  const onAreaKey = (panel, side) => (evt) => {
    if (!evt || evt.key !== 'Enter' || !(evt.ctrlKey || evt.metaKey)) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, side);
  };

  /** 单行格与数字格里的裸 Enter 就是提交；带任何修饰键都不算（那可能是浏览器的快捷键） */
  const onFieldKey = (panel, side) => (evt) => {
    if (!evt || evt.key !== 'Enter') return;
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, side);
  };

  /** 复制一栏：三级兜底与那两句改口文案都在 `Tk.ui.copyInto` 里，这一层只找节点、给文本、还原文案 */
  const doCopy = (panel, side) => {
    const id = copyId(prefix, panel, side);
    const btn = node(id);
    const text = copies.get(at(panel, side)) || '';
    if (!btn || text === '') return;
    ui.copyInto({
      btn, text, original: copyLabels.get(id) ?? btn.textContent, clipboard, doc, later,
    });
  };

  /**
   * 走一遍 `runGuarded`（真页面上就是 `createPanelDom.run`）：`FieldError` 在这一层就地转成
   * 提示行，其余异常原样抛出去，由那一层标坏这一块。
   */
  const runGuardedRun = (panel, side) => runGuarded(panel, () => {
    try {
      renderNow(panel, side);
    } catch (err) {
      if (!err || err.isField !== true) throw err;
      hint(panel, side, err.message);
    }
  });

  // ── 每块面板的渲染函数 ──────────────────────────────────────────────────

  const renderers = {};
  for (const panel of CODEC_PANEL_IDS) {
    renderers[panel] = () => {
      for (const side of SIDES) {
        const cfg = CODEC_SPEC[panel].sides[side];
        if (!cfg) continue;
        for (const c of cfg.controls) {
          const el = node(fieldId(prefix, panel, c.id));
          if (!el) continue;
          if (c.type === 'area') el.addEventListener('keydown', onAreaKey(panel, side));
          else if (c.type === 'text' || c.type === 'number') el.addEventListener('keydown', onFieldKey(panel, side));
          // `select` 与 `file` 不接 Enter：下拉那格的 Enter 没有"提交"语义，文件格是原生选择框
          if (cfg.switch && c.id === cfg.switch.control) {
            el.addEventListener('change', () => applySwitch(panel));
          }
        }
        const btn = node(buttonId(prefix, panel, side));
        if (btn) btn.addEventListener('click', () => runGuardedRun(panel, side));
        const id = copyId(prefix, panel, side);
        const cb = node(id);
        if (cb) {
          // 键用派生 id 而不是 `cb.id`：假 DOM 上 `.id` 是个普通属性，一旦哪份夹具没设上，
          // `set(undefined, …)` 会静默存进另一格，改口之后就取不回原文案。
          copyLabels.set(id, cb.textContent);
          cb.addEventListener('click', () => doCopy(panel, side));
        }
      }
      // 接线之后先应用一次显隐、再画"等待输入"：挂载期一次计算都不做（口径 2），
      // 所以这里读的是 `IDLE` 那张表，不是 `COMPUTE`——格子里已经粘了东西也一样不碰。
      applySwitch(panel);
      for (const side of SIDES) {
        const cfg = CODEC_SPEC[panel].sides[side];
        if (!cfg) continue;
        paintSide(panel, side, IDLE[cfg.kind], '');
      }
    };
  }

  return {
    renderers,
    /**
     * 挂载完成后由测试或别处触发一栏：走的是与按钮完全同一条路（含 `runGuarded`）。
     * 栏位名不在 spec 里就直接报 `false`，不凭空画一栏、也不惊动闸门。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {boolean} 这一块现在好不好
     */
    run: (panel, side) => {
      if (!CODEC_SPEC[panel] || !CODEC_SPEC[panel].sides[side]) return false;
      return runGuardedRun(panel, side) === true;
    },
    /**
     * 这一栏当前能复制的文本（复制按钮读的就是它）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {string} 纯文本，没有则空串
     */
    copyTextOf: (panel, side) => copies.get(at(panel, side)) || '',
  };
}

/**
 * 这个前缀下应该存在的全部 id，Task 9 拿它对账构建产物里的 HTML：
 * spec 说应有而页面没有 → 装配层第一次点就抛；页面有而 spec 没说 → 那是个没人接的格子。
 * 两个方向都红，才算这份 spec 是骨架的真值而不是它的影子。
 * @param {string} prefix 前缀
 * @param {string[]} [panels] 面板清单，默认 `CODEC_PANEL_IDS`
 * @returns {{in: string[], btn: string[], copy: string[], out: string[], when: string[]}}
 */
export function controlIds(prefix, panels = CODEC_PANEL_IDS) {
  const got = { in: [], btn: [], copy: [], out: [], when: [] };
  for (const panel of panels) {
    const sides = CODEC_SPEC[panel].sides;
    for (const side of SIDES) {
      const cfg = sides[side];
      if (!cfg) continue;
      got.btn.push(buttonId(prefix, panel, side));
      got.copy.push(copyId(prefix, panel, side));
      got.out.push(outId(prefix, panel, side));
      for (const c of cfg.controls) got.in.push(fieldId(prefix, panel, c.id));
      if (cfg.switch) for (const t of cfg.switch.targets) got.when.push(whenId(prefix, panel, t.key));
    }
  }
  return got;
}
