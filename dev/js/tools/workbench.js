/**
 * 证件页的装配层：把 `tools-idcard.html` 里那些静态表单接到六本业务模块上，结果交给
 * `view`（`window.Tk.view`）渲染。
 *
 * 这一层存在的理由是段 1 计划 §6.0 那句分工的自然延伸：**表单与控件的对应关系只允许有一处**。
 * 页面里有 9 个栏位、35 个控件、18 个按钮与结果区，如果"哪个 id 属于哪一栏"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，那就是两处口径——改一处漏一处，而漏掉那一处只在页面上"点了没反应"。
 * 所以这里用 `WORKBENCH_SPEC` 把五块面板的控件、级联、下拉数据源、开关目标全部声明出来，
 * 所有 id 由 `fieldId()` / `buttonId()` / `copyId()` / `outId()` 派生；HTML 里的
 * `data-tk-cascade` / `data-tk-options` / `data-tk-switch` / `data-tk-when` 是**写给人和
 * 样式看的标记**，运行时不读它们，它们与 spec 是否一致由 Task 9 在构建产物上对账。
 *
 * 五条口径，§J 的判据逐条对着咬：
 *
 * 1. **空选项整键缺席**。这是实测出来的，不是猜的：六本模块对"用户没选"的写法各不相同——
 *    `generateIdCards` 收到 `sex: ''` 抛 `RangeError`、收到 `areaCode: ''` 抛 `TypeError`；
 *    `generateEmails` 收到 `domain: ''` 抛 `TypeError`；`generateNames` 收到 `givenLength: ''`
 *    抛 `TypeError`；`generateBankCards` 收到 `length: ''` 抛 `TypeError`（2026-09-26 逐键实测，
 *    命令在段 2 计划 Task 7 §0）。所以装配层**不许把空串当"不限"传下去**，一律不写那个键，
 *    让模块按自己的默认值走。`generateUsccCodes` 的 `registry` / `category` 更特殊：不传是
 *    `'9'` / `'1'` 这两个**固定字符**而不是随机，页面上那格文案照这个事实写。
 * 2 **两栏对称但 kind 不同名**。面板名 `bankcard` / `mobile` 与 `view` 的 `kind`
 *   （`bank` / `mobile`）不是一回事，映射写在 spec 里而不是靠字符串猜。
 * 3. **两类失败分两条路**。用户填的东西不能用 → `FieldError` → 结果区里一句提示，
 *    面板不算坏；模块自己抛的（收窄到零候选、内部不变量） → 原样往上抛，交给
 *    `createPanelDom.run()` 标坏那一块。把第一条也标坏，等于把"你少填了个日期"说成
 *    "这块面板坏了"，而错误条那句"其余面板不受影响"在这种情况下是废话。
 * 4. **行号由装配层给**。`parseIdCardList` / `parseUsccList` 保留空行并把它算进 `no`，
 *    `parseBankCardList` 跳过空行、`line` 是原样行号，`parseMobile` 干脆没有 List 版
 *    （段 2 计划 Task 3 记的缺口）。四本各说各话，页面不能跟着各长四个样：装配层自己按
 *    "丢掉全空行、保留原始行号、上限 `MAX_READ_LINES` 行"切一遍，四块面板共用同一段渲染。
 *    四个 List 函数仍在 §B/§C/§E 的判据里，这一层不用它们不等于它们没被测过。
 * 5. **动态文本只走 `view`**。`view` 里每个函数都过 `esc()`；这一层自己产出的文本（行号、
 *    回显、提示句）同样只经 `view.esc`，不拼裸 HTML。`innerHTML` 只出现在 `paint()` 一处。
 *
 * 与 `panel.js` / `panel-dom.js` / `view.js` 的分工：那三个是跨页共用的，走 `window.Tk` 进来
 * （见 `dev/js/toolkitCore.js` 开头那段实测），**本文件不许 `import` 它们**——一旦 import，
 * 证件页与后面的编码工具箱页就有两个入口 reach 同一模块，产物立刻变成带 `import{` 的废文件。
 * 这条红线由 §J14 用源码文本守住。
 *
 * 本文件也不是入口：`dev/js/toolIdcard.js` 才在 `dev/js/` 第一层，它 `import` 本文件，
 * 于是业务模块全部内联进 `toolIdcard.min.js`（只有一个入口 reach 它们，不会成 chunk）。
 */
import { parseIdCard, generateIdCards, USE_NOTE as ID_CARD_NOTE, GENERATE_MAX } from './idcard.js';
import { parseUscc, generateUsccCodes, USE_NOTE as USCC_NOTE, REFERENCE_NOTE, USCC_CHARSET } from './uscc.js';
import {
  parseBankCard, generateBankCards, BANK_CAVEAT, CARD_TYPES, TOP_BANKS, BANK_OPTIONS,
  PAN_MIN, PAN_MAX,
} from './bankcard.js';
import { parseMobile, generateMobiles, MOBILE_CAVEAT, CARRIER_NOTE, CARRIERS, SEGMENTS } from './phone.js';
import {
  generateNames, generateAddresses, generateEmails, generateProfiles,
  RANDOM_CAVEAT, NAME_NOTE, ADDRESS_NOTE, EMAIL_NOTE, EMAIL_DOMAINS,
} from './random-data.js';
import {
  provinceCodes, provinceName, currentCityCodes, cityName, currentCountyCodes, resolveRegion,
} from './region.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/**
 * 一次判定最多读多少行。生成侧的上限是各模块的 `GENERATE_MAX`（50），读侧给同一档，
 * 理由是"一张 50 行的表已经是这块屏幕的极限"，而不是"再多就慢"——四本解析函数都是纯算式，
 * 60 行也照样算得完，但结果区会长成没人能读的一堵墙。超出的行数不进表格，只在提示里报数。
 */
export const MAX_READ_LINES = 50;

/** 复制按钮改口"已复制"之后多久恢复原文案（毫秒）；只这一处用到时长，不抽 token */
const COPY_RESET_MS = 1600;
/** 复制失败后的提示停留时长，比成功的那句长一点：那句要被人读到才会去手动选中文本 */
const COPY_FAIL_MS = 2600;

/** 结果区里"这一栏还没有内容 / 这一栏的输入不能用"那一行的类名（`toolkit.scss` 的钩子） */
const HINT_CLASS = 'tk-hint';

/**
 * 控件的值 → 面板的 `<control>` 段 id：`<prefix>-in-<panel>-<control>`。
 * 与 `tools-idcard.html` 里逐字符对应，§J10 断言换前缀时整套跟着换、不残留旧前缀。
 * @param {string} prefix 前缀（证件页 `tk`，JSON 页 `jt`）
 * @param {string} panel 面板 slug
 * @param {string} control 控件 slug
 * @returns {string} 元素 id
 */
export function fieldId(prefix, panel, control) {
  return `${prefix}-in-${panel}-${control}`;
}

/**
 * 主按钮 id：`<prefix>-btn-<panel>-<side>`，`side` 是 `gen` / `read`。
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
 * 受开关控制的字段组 id：`<prefix>-when-<panel>-<key>`。
 * 注意单位不是控件而是 HTML 里那一段 `<p data-tk-when>`——区划三级包在同一个 `<p>` 里，
 * 隐藏那一段才叫"这一类用不上"，逐个隐藏三个 `<select>` 会留下一个空标签。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} key 开关目标 key
 * @returns {string} 元素 id
 */
export function whenId(prefix, panel, key) {
  return `${prefix}-when-${panel}-${key}`;
}

// ── WORKBENCH_SPEC：五块面板的唯一形状 ───────────────────────────────────────

/**
 * 面板 → 两栏的控件、级联、开关与 kind 映射。
 *
 * `controls[]` 的每一项：
 *   - `id` 控件 slug，逐字符对应 HTML 里的 `<control>`；
 *   - `type` `'text'`（默认，取 `value` 去空白）/ `'number'` / `'area'`（粘贴框，整段文本）；
 *   - `options` / `cascade` / `charsets` / `switch` 是给 Task 9 对账用的标记，
 *     运行时由下面那几个 `fill*` 函数按 spec 里同名的键执行，**不去读 DOM 上的 `data-tk-*`**。
 *
 * `sides.gen` / `sides.read` 里：`kind` 是 `view` 的那套 kind；`read` 为 `null` 表示这一栏
 * 不存在（`#random` 没有可校验的输入）。`switch` 描述"哪个控件的值决定哪些字段组显隐"。
 *
 * @type {Record<string, object>}
 */
export const WORKBENCH_SPEC = {
  idcard: {
    sides: {
      gen: {
        kind: 'idcard',
        controls: [
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'county', cascade: 'county' },
          { id: 'sex' },
          { id: 'ageband', switch: 'ageband' },
          { id: 'birth', type: 'date' },
          { id: 'count', type: 'number' },
        ],
        switch: { control: 'ageband', targets: [{ key: 'birth', when: ['custom'] }] },
      },
      read: { kind: 'idcard', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  uscc: {
    sides: {
      gen: {
        kind: 'uscc',
        controls: [
          { id: 'registry', charsets: 'uscc' },
          { id: 'category', charsets: 'uscc' },
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'uscc', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  bankcard: {
    sides: {
      gen: {
        kind: 'bank',
        controls: [
          { id: 'bank', options: 'banks' },
          { id: 'type', options: 'cardtypes' },
          { id: 'length', type: 'number' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'bank', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  mobile: {
    sides: {
      gen: {
        kind: 'mobile',
        controls: [
          { id: 'carrier', options: 'carriers' },
          { id: 'segment', options: 'segments' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'mobile', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  random: {
    sides: {
      gen: {
        kind: 'name',
        kindFrom: 'kind',
        kindMap: { name: 'name', address: 'address', email: 'email', profile: 'profile' },
        controls: [
          { id: 'kind', switch: 'kind' },
          { id: 'count', type: 'number' },
          { id: 'givelen' },
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'county', cascade: 'county' },
          { id: 'domain', options: 'domains' },
        ],
        switch: {
          control: 'kind',
          targets: [
            { key: 'givelen', when: ['name', 'profile'] },
            { key: 'addr', when: ['address', 'profile'] },
            { key: 'domain', when: ['email', 'profile'] },
          ],
        },
      },
      read: null,
    },
  },
};

/** 面板顺序就是 `data-tk-ids` 与索引条的顺序；导出给 §J 与入口用，别再各写一份清单 */
export const PANEL_IDS = Object.keys(WORKBENCH_SPEC);

/**
 * 一栏里每行"复制出来长什么样"。生成侧交主字段，一行一条；`profile` 三条用制表符连着，
 * 粘进表格软件正好是三列。读侧只交判定为有效的 `value`（见 `READ_COPY`）。
 */
const GEN_COPY = {
  idcard: (r) => r.id18,
  uscc: (r) => r.code,
  bank: (r) => r.number,
  mobile: (r) => r.number,
  name: (r) => r.name,
  address: (r) => r.text,
  email: (r) => r.email,
  profile: (r) => `${r.name.name}\t${r.address.text}\t${r.email.email}`,
};

/**
 * 口径行：模块常量原样交给 `view.batchBlock` / `view.parseBlock` 落地（§H 的 H8 判"一字不动"）。
 *
 * 读侧刻意只给 `uscc` 补一句：另外三本的 `caveat` / `note` 本来就挂在结果对象上，
 * `parseBlock` 会自己收走（`bank` 的 `caveat` 恒为 `BANK_CAVEAT`、`mobile` 的两条恒在），
 * 装配层再塞一遍就是同一句话在同一栏里出现两次。
 */
const GEN_NOTES = {
  idcard: [ID_CARD_NOTE],
  uscc: [USCC_NOTE],
  bank: [BANK_CAVEAT],
  mobile: [MOBILE_CAVEAT, CARRIER_NOTE],
  name: [RANDOM_CAVEAT, NAME_NOTE],
  address: [RANDOM_CAVEAT, ADDRESS_NOTE],
  email: [RANDOM_CAVEAT, EMAIL_NOTE],
  profile: [RANDOM_CAVEAT, NAME_NOTE, ADDRESS_NOTE, EMAIL_NOTE],
};
const READ_NOTES = { idcard: [], uscc: [REFERENCE_NOTE], bank: [], mobile: [] };

/**
 * 整栏通用的那几句口径：`bankcard.js:159` 的 `caveat: BANK_CAVEAT` 恒有值，`phone.js:125`
 * 同档带 `note: CARRIER_NOTE`（两本的 `base()` 都把常量写进每一次解析结果），
 * `view.parseBlock` 又会照字段收走——于是粘 50 行就是 50 段同一句话。
 * 这里按**常量全等**把它们从逐行结果里摘掉、在栏尾说一次：全等而不是"看着像"，
 * 因为身份证与信用代码的 `caveat` 是随号码变的（撤销区划、第 17 位是字母、小写转大写），
 * 那两句必须留在各自那一行里，摘错了就是把结论从号码旁边搬走。
 */
const BATCH_NOTES = {
  bank: [{ field: 'caveat', text: BANK_CAVEAT }],
  mobile: [{ field: 'caveat', text: MOBILE_CAVEAT }, { field: 'note', text: CARRIER_NOTE }],
};

/** 读侧每本用哪个解析函数——四本里只有 `phone.js` 没有 List 版，所以这里全用单个版（口径 4） */
const READ_PARSE = {
  idcard: parseIdCard,
  uscc: parseUscc,
  bank: parseBankCard,
  mobile: parseMobile,
};

// ── FieldError：用户填的东西不能用 ──────────────────────────────────────────

/**
 * "这一栏的输入不能用"这一类失败。它不是面板坏了：消息进结果区的提示行，面板不进 broken 名单，
 * `createPanelDom` 的错误条也就不会出现（口径 3）。
 * @extends Error
 */
export class FieldError extends Error {
  /**
   * @param {string} message 直接给用户看的一句话，点名是哪个格子
   */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
    /** 判别用的标记，不靠 `name` 字符串比对（压缩器不会动这里，但标记比名字结实） */
    this.isField = true;
  }
}

// ── createWorkbench ─────────────────────────────────────────────────────────

/**
 * 造一个证件页的装配器。
 *
 * @param {object} env 依赖注入。全给出去是为了 §J 能在 Node 里跑真接线：
 *   六本业务模块与 `region` 是直接 `import` 的（只有一个入口 reach 它们，不会成共享 chunk），
 *   框架层与宿主环境从 `env` 进来。
 * @param {object} env.document 只需 `getElementById` / `createElement`（与 `panel-dom` 同一档，
 *   这一层也不碰 `querySelector`：控件一律按派生 id 找，找不到就是骨架构造错了）
 * @param {object} env.Tk `window.Tk`，必须齐 `view`
 * @param {(panel: string, fn: () => void) => boolean} env.runGuarded 通常是
 *   `createPanelDom().run`；挂载期不走它（那时 `mounted` 还是 false），只挂在按钮上
 * @param {object} [env.navigator] 只为 `clipboard`，没有就走 `execCommand` 兜底
 * @param {(fn: () => void, ms: number) => number} [env.later] `setTimeout` 的别名，测试里换成同步执行
 * @param {string} [env.prefix] 前缀，默认 `tk`
 * @param {() => number} [env.rng] 传给各生成器的随机源；不传就用模块自己的 `Date.now()` 种子
 * @param {string} [env.today] `YYYY-MM-DD`，透传给 `generateIdCards`；不传按本地今天
 * @returns {{renderers: Record<string, (el: object) => void>,
 *   run: (panel: string, side: string) => boolean,
 *   copyTextOf: (panel: string, side: string) => string}}
 */
export function createWorkbench(env = {}) {
  const e = env ?? {};
  if (!e.document || typeof e.document.getElementById !== 'function'
    || typeof e.document.createElement !== 'function') {
    throw new TypeError('createWorkbench：env.document 要有 getElementById 与 createElement');
  }
  if (!e.Tk || !e.Tk.view || typeof e.Tk.view.batchBlock !== 'function') {
    throw new TypeError('createWorkbench：env.Tk.view 应是 window.Tk 里那份 view（跨页共用层走 toolkitCore，不许 import）');
  }
  if (typeof e.runGuarded !== 'function') {
    throw new TypeError('createWorkbench：env.runGuarded 应是 createPanelDom().run，按钮回调不许自己 try/catch 出第二套错误口径');
  }
  const doc = e.document;
  const view = e.Tk.view;
  const runGuarded = e.runGuarded;
  const prefix = typeof e.prefix === 'string' && e.prefix !== '' ? e.prefix : 'tk';
  const rng = e.rng === undefined ? undefined : e.rng;
  const today = e.today;
  const later = typeof e.later === 'function' ? e.later : (fn, ms) => setTimeout(fn, ms);
  const clipboard = e.navigator && e.navigator.clipboard ? e.navigator.clipboard : null;

  /** `panel:side → 这一栏当前能复制的纯文本`；渲染时写，复制按钮读它，不从 HTML 反解 */
  const copies = new Map();
  const key = (panel, side) => `${panel}:${side}`;
  const node = (id) => doc.getElementById(id);

  /** 取控件值：去首尾空白，空值一律 `null`（口径 1：调用方按 `null` 决定"不写这个键"） */
  const valueOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) throw new RangeError(`页面里没有 id="${fieldId(prefix, panel, control)}" 的控件，spec 与骨架对不上`);
    const raw = typeof el.value === 'string' ? el.value : '';
    const v = raw.trim();
    return v === '' ? null : v;
  };

  /** 粘贴框：整段文本，只去行尾 `\r`（Windows 粘进来的），不 trim——空行由调用侧统一处理 */
  const areaOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) throw new RangeError(`页面里没有 id="${fieldId(prefix, panel, control)}" 的粘贴框`);
    return String(typeof el.value === 'string' ? el.value : '').replace(/\r\n?/g, '\n');
  };

  /** 数量格：1..GENERATE_MAX 的整数；空与非整数都算"这一栏的输入不能用"（口径 3） */
  const countOf = (panel) => {
    const raw = valueOf(panel, 'count');
    if (raw === null) {
      throw new FieldError('数量这一格是空的，填 1–' + GENERATE_MAX + ' 之间的整数。');
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > GENERATE_MAX) {
      throw new FieldError(`数量应为 1–${GENERATE_MAX} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 整数格（位数）：范围由调用方给，越界说清是哪一格 */
  const intOf = (panel, control, min, max, label) => {
    const raw = valueOf(panel, control);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new FieldError(`${label}应为 ${min}–${max} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 必填格（选了这个才必须有那个）：空就是 FieldError */
  const required = (raw, message) => {
    if (raw === null || raw === '') throw new FieldError(message);
    return raw;
  };

  /** 区划三级 → 模块的那三个键，优先级与 `idcard.js` 的 `prefixOf` 一致：县 > 市 > 省 */
  const regionKeys = (panel) => {
    const o = {};
    const county = valueOf(panel, 'county');
    const city = valueOf(panel, 'city');
    const prov = valueOf(panel, 'province');
    if (county) o.areaCode = county;
    else if (city) o.cityCode = city;
    else if (prov) o.provinceCode = prov;
    return o;
  };

  // ── 下拉填充 ────────────────────────────────────────────────────────────

  /** 造一个 `<option>`：`value` 走属性、文字走 `textContent`，没有第三条路 */
  const makeOption = (it) => {
    const opt = doc.createElement('option');
    opt.setAttribute('value', String(it.value));
    opt.textContent = String(it.label);
    return opt;
  };

  /**
   * 换掉一个 `<select>` 的选项，**保留 HTML 里那一条占位 `<option>`**。
   * 占位句（"不限省份""不填（取默认字符 9）"）是页面文案，spec 里不重抄一份；
   * 所以这里把第一个子节点摘出来存着、清空、再放回去。`removeChild` 的返回值真 DOM 与
   * §J 的假 DOM 都得给，这是它对绑定层提出的唯一额外要求。
   * @param {object} el select 节点
   * @param {object[]} items `[{ value, label }]`
   * @param {boolean} [disabled] 上一级没选时整格禁用
   */
  const fill = (el, items, disabled = false) => {
    if (!el) return;
    const held = el.firstChild && String(el.firstChild.tagName || '') === 'OPTION'
      ? el.removeChild(el.firstChild) : null;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (held) el.appendChild(held);
    for (const it of items) el.appendChild(makeOption(it));
    el.value = '';
    el.disabled = disabled;
  };

  /**
   * 分组填充（行别与号段那两格）：`groups` 是 `[{ label, items }]`，`label` 空串表示这一组
   * 不包 `<optgroup>`（混着放会让占位项后面先出现一坨没标题的裸 `<option>`，读屏会念成
   * "选项 空"）。清空只做一次，所以先算完整清单再动节点。
   * @param {object} el select 节点
   * @param {{label: string, items: {value: string, label: string}[]}[]} groups 分组清单
   */
  const fillGrouped = (el, groups) => {
    if (!el) return;
    const held = el.firstChild && String(el.firstChild.tagName || '') === 'OPTION'
      ? el.removeChild(el.firstChild) : null;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (held) el.appendChild(held);
    for (const g of groups) {
      if (g.label === '') {
        for (const it of g.items) el.appendChild(makeOption(it));
        continue;
      }
      const box = doc.createElement('optgroup');
      box.setAttribute('label', g.label);
      for (const it of g.items) box.appendChild(makeOption(it));
      el.appendChild(box);
    }
    el.value = '';
    el.disabled = false;
  };

  /** 区划三级的取数：省 31 条；市按省取；县按市取，但直辖市那 4 个只有一个"市辖区"，允许省下直接选县 */
  const cityOptions = (prov) => currentCityCodes(prov).map((c) => ({ value: c, label: cityName(c) }));
  const countyOptions = (city4) => currentCountyCodes(city4)
    .map((c) => ({ value: c, label: resolveRegion(c).county || resolveRegion(c).fullName }));

  /**
   * 按 spec 重建一格的选项，并把级联的下游一起接上。
   * @param {string} panel 面板
   * @param {string} control 控件
   */
  const refill = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) return;
    const level = cascadeLevelOf(panel, control);
    if (level === 'province') {
      fill(el, provinceCodes().map((c) => ({ value: c, label: provinceName(c) })));
      return;
    }
    if (level === 'city') {
      const prov = valueOf(panel, 'province');
      fill(el, prov ? cityOptions(prov) : [], !prov);
      return;
    }
    if (level === 'county') {
      const city = valueOf(panel, 'city');
      const prov = valueOf(panel, 'province');
      // 只选到省时：仅当该省下恰好一个市（4 个直辖市的"市辖区"）才放开县格，否则它无从选起
      const single = prov && cityOptions(prov).length === 1 ? cityOptions(prov)[0].value : null;
      const base = city || single;
      fill(el, base ? countyOptions(base) : [], !base);
      return;
    }
    const source = optionsSourceOf(panel, control);
    if (source === 'banks') {
      const top = new Set(TOP_BANKS.map((b) => b.code));
      fillGrouped(el, [
        { label: '', items: TOP_BANKS.map((b) => ({ value: b.code, label: `${b.name}（${b.binCount} 条 BIN）` })) },
        {
          label: '其余行别（按行别码）',
          items: BANK_OPTIONS.filter((b) => !top.has(b.code)).map((b) => ({ value: b.code, label: b.name })),
        },
      ]);
      return;
    }
    if (source === 'cardtypes') {
      fill(el, Object.entries(CARD_TYPES).map(([code, name]) => ({ value: code, label: name })));
      return;
    }
    if (source === 'carriers') {
      fill(el, CARRIERS.map((c) => ({ value: c.carrier, label: `${c.carrier}（${c.count} 个号段）` })));
      return;
    }
    if (source === 'segments') {
      // 号段按运营商分组，但 `phone.js` 没有导出"运营商 → 号段"这张派生表（它只出
      // `CARRIERS`（含 count）与平铺的 `SEGMENTS`）。这里不为了一个下拉框去加一条导出：
      // 直接拿读侧的 `parseMobile` 把 56 个段各问一次归属，分组的口径就等于判定行的口径。
      // §F8 已经把"逐段都能判 valid、且运营商与表一致"钉住了，所以这一格不是没据的取巧。
      fillGrouped(el, CARRIERS.map((c) => ({
        label: c.carrier,
        items: SEGMENTS.filter((s) => carrierOfSegment(s) === c.carrier).map((s) => ({ value: s, label: s })),
      })));
      return;
    }
    if (source === 'domains') {
      fill(el, EMAIL_DOMAINS.map((d) => ({ value: d, label: d })));
      return;
    }
    if (charsetOf(panel, control) === 'uscc') {
      const dflt = control === 'registry' ? '9' : '1';
      fill(el, [...USCC_CHARSET].map((ch) => ({
        value: ch,
        label: ch === dflt ? `${ch}（默认）` : ch,
      })));
    }
  };

  // spec 侧的三张查询表：一格是级联第几级 / 静态下拉数据源 / 字符集，全从 spec 读

  const markerOf = (panel, side, control, field) => {
    const cfg = WORKBENCH_SPEC[panel].sides[side];
    const c = cfg && cfg.controls.find((x) => x.id === control);
    return c ? c[field] : undefined;
  };
  const cascadeLevelOf = (panel, control) => markerOf(panel, 'gen', control, 'cascade')
    || markerOf(panel, 'read', control, 'cascade');
  const optionsSourceOf = (panel, control) => markerOf(panel, 'gen', control, 'options')
    || markerOf(panel, 'read', control, 'options');
  const charsetOf = (panel, control) => markerOf(panel, 'gen', control, 'charsets')
    || markerOf(panel, 'read', control, 'charsets');

  // ── 开关：哪个控件决定哪几段显隐 ─────────────────────────────────────────

  /**
   * 应用一次显隐。隐藏走 `hidden` 布尔属性，不写 `style`：段 1 在 `panel-dom` 立的口径
   * （可见性的唯一来源是那一个属性）在这里同样成立，两处都能改显隐就等于两处能互相覆盖。
   * @param {string} panel 面板
   */
  const applySwitch = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.gen;
    if (!cfg.switch) return;
    const value = valueOf(panel, cfg.switch.control) ?? firstValueOf(panel, cfg.switch.control);
    for (const target of cfg.switch.targets) {
      const el = node(whenId(prefix, panel, target.key));
      if (!el) continue;
      el.hidden = !target.when.includes(value ?? '');
    }
  };

  /** 有些 `<select>` 的默认项本来就带值（`#random-kind` 的第一条是 `name`），空值时要用它 */
  const firstValueOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    const first = el && el.firstChild;
    return first && typeof first.getAttribute === 'function' ? first.getAttribute('value') : null;
  };

  // ── 生成侧：spec → 模块入参 ──────────────────────────────────────────────

  /**
   * 一格的值 → 该面板生成函数的 options。**空值一律不写键**（口径 1）。
   * @param {string} panel 面板
   * @param {string} kind 这一栏用的 `view` kind
   * @returns {object} 直接喂给模块的入参
   */
  const buildOptions = (panel, kind) => {
    const o = { count: countOf(panel) };
    if (rng !== undefined) o.rng = rng;
    if (today !== undefined) o.today = today;
    if (panel === 'idcard') {
      Object.assign(o, regionKeys(panel));
      const sex = valueOf(panel, 'sex');
      if (sex) o.sex = sex;
      const band = valueOf(panel, 'ageband');
      if (band === 'custom') {
        o.birthDate = required(valueOf(panel, 'birth'),
          '选了「指定出生日期」，就得把出生日期那一格填上。');
      } else if (band) {
        const [min, max] = band.split('-');
        o.minAge = Number(min);
        o.maxAge = Number(max);
      }
      return o;
    }
    if (panel === 'uscc') {
      // `provinceCode` 实为"任意 ≤4 位前缀"（uscc.js 的 regionPool 注释），所以市码可以直接用
      const city = valueOf(panel, 'city');
      const prov = valueOf(panel, 'province');
      if (city) o.provinceCode = city;
      else if (prov) o.provinceCode = prov;
      const registry = valueOf(panel, 'registry');
      if (registry) o.registry = registry;
      const category = valueOf(panel, 'category');
      if (category) o.category = category;
      return o;
    }
    if (panel === 'bankcard') {
      const bank = valueOf(panel, 'bank');
      if (bank) o.bankCode = bank;
      const type = valueOf(panel, 'type');
      if (type) o.cardType = type;
      const len = intOf(panel, 'length', PAN_MIN, PAN_MAX, '位数');
      if (len !== null) o.length = len;
      return o;
    }
    if (panel === 'mobile') {
      const carrier = valueOf(panel, 'carrier');
      if (carrier) o.carrier = carrier;
      const segment = valueOf(panel, 'segment');
      if (segment) o.segment = segment;
      return o;
    }
    // #random：四级 kind 共用同一批格子，用不上的格子由开关藏掉，但值还留在 DOM 里，
    // 所以这里必须按 kind 取该取的键——把 address 的区划带进 email 那一档，
    // 模块不会报（它只看 domain），页面上却会出现"选了南京、邮箱域随机"的莫名结果。
    Object.assign(o, { name: nameOptions, address: addressOptions, email: emailOptions, profile: profileOptions }[kind](panel));
    return o;
  };
  const nameOptions = (panel) => {
    const o = {};
    const gl = valueOf(panel, 'givelen');
    if (gl) o.givenLength = Number(gl);
    return o;
  };
  const addressOptions = (panel) => regionKeys(panel);
  const emailOptions = (panel) => {
    const o = {};
    const domain = valueOf(panel, 'domain');
    if (domain) o.domain = domain;
    return o;
  };
  const profileOptions = (panel) => ({ ...nameOptions(panel), ...addressOptions(panel), ...emailOptions(panel) });

  /** kind → 生成函数 */
  const GENERATORS = {
    idcard: generateIdCards,
    uscc: generateUsccCodes,
    bank: generateBankCards,
    mobile: generateMobiles,
    name: generateNames,
    address: generateAddresses,
    email: generateEmails,
    profile: generateProfiles,
  };

  /** 这一栏这一次用哪个 kind：`#random` 由 `kind` 格决定，其余面板 spec 里写死 */
  const kindOf = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.gen;
    if (!cfg.kindFrom) return cfg.kind;
    const raw = valueOf(panel, cfg.kindFrom) ?? firstValueOf(panel, cfg.kindFrom);
    const kind = cfg.kindMap[raw];
    if (!kind) {
      throw new RangeError(`#random 的 kind 格取到「${String(raw)}」，spec 里只认 ${Object.keys(cfg.kindMap).join(' / ')}`);
    }
    return kind;
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────

  /** 唯一的 `innerHTML` 出口：提示行也过 `esc`，因为消息里会带上用户填的那一格原样 */
  const paint = (panel, side, html) => {
    const out = node(outId(prefix, panel, side));
    if (!out) throw new RangeError(`页面里没有 id="${outId(prefix, panel, side)}" 的结果区`);
    out.innerHTML = html;
    return out;
  };

  /** 提示行（空栏、输入不能用、超出上限）——不算内容，所以复制按钮跟着禁用 */
  const hint = (panel, side, message) => {
    paint(panel, side, `<p class="${HINT_CLASS}">${view.esc(message)}</p>`);
    copies.set(key(panel, side), '');
    syncCopy(panel, side);
  };

  /** 复制按钮的可用性只由"这一栏有没有可复制的文本"决定，不靠样式类猜 */
  const syncCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    if (!btn) return;
    btn.disabled = (copies.get(key(panel, side)) || '') === '';
  };

  /**
   * 生成一栏：表格 + 条数 + 口径行，全部由 `view.batchBlock` 出。
   * @param {string} panel 面板
   * @returns {boolean} 有没有真的画上（缺结果区时 `paint` 已抛，这里只反映成功）
   */
  const renderGen = (panel) => {
    const kind = kindOf(panel);
    const rows = GENERATORS[kind](buildOptions(panel, kind));
    paint(panel, 'gen', view.batchBlock(kind, rows, GEN_NOTES[kind]));
    copies.set(key(panel, 'gen'), rows.map(GEN_COPY[kind]).join('\n'));
    syncCopy(panel, 'gen');
    return true;
  };

  /**
   * 判定一栏：逐行一个结果块。行号用**原始行号**（口径 4），超出 `MAX_READ_LINES` 的行不进
   * 表格、只在提示里报数，免得一块 500 行的表把结果区撑成读不完的墙。
   * @param {string} panel 面板
   * @returns {boolean} 同上
   */
  const renderRead = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.read;
    const kind = cfg.kind;
    const lines = areaOf(panel, cfg.controls[0].id).split('\n');
    const kept = [];
    lines.forEach((raw, i) => {
      if (raw.trim() !== '') kept.push({ no: i + 1, raw });
    });
    if (kept.length === 0) {
      hint(panel, 'read', '粘贴框里还没有号码：一条一行粘进来就行。');
      return true;
    }
    const shown = kept.slice(0, MAX_READ_LINES);
    const parts = [];
    const valid = [];
    /** 摘出来的整栏通用句，栏尾一次说完 */
    const hoisted = [];
    const specs = BATCH_NOTES[kind];
    for (const row of shown) {
      let result = READ_PARSE[kind](row.raw);
      if (specs) {
        const hits = specs.filter((s) => result[s.field] === s.text);
        if (hits.length > 0) {
          const clean = { ...result };
          for (const s of hits) {
            if (!hoisted.includes(s.text)) hoisted.push(s.text);
            clean[s.field] = '';
          }
          result = clean;
        }
      }
      if (result.state === 'valid' && typeof result.value === 'string' && result.value !== '') {
        valid.push(result.value);
      }
      parts.push('<section class="tk-line">'
        + `<p class="tk-line__head">第 ${view.esc(String(row.no))} 行 · `
        + `<span class="tk-line__raw">${view.esc(row.raw)}</span></p>`
        + view.parseBlock(kind, result, []) + '</section>');
    }
    if (kept.length > shown.length) {
      parts.push(`<p class="${HINT_CLASS}">`
        + `这次粘进来 ${view.esc(String(kept.length))} 行，只判定前 ${MAX_READ_LINES} 行——`
        + `剩下的请分几次判。</p>`);
    }
    // 整栏通用的口径排在逐行结果之后：粘进来的人第一眼要看到的是自己那几行的结论
    paint(panel, 'read', `<div class="tk-lines">${parts.join('')}</div>`
      + view.noteLines([...hoisted, ...READ_NOTES[kind]]).join(''));
    copies.set(key(panel, 'read'), valid.join('\n'));
    syncCopy(panel, 'read');
    return true;
  };

  /** 一栏的渲染分派；`renderNow` 抛出去的东西由调用侧决定是提示还是标坏（口径 3） */
  const renderNow = (panel, side) => {
    if (side === 'gen') return renderGen(panel);
    if (WORKBENCH_SPEC[panel].sides.read === null) {
      throw new RangeError(`${panel} 这一栏没有判定侧，spec 里是 null`);
    }
    return renderRead(panel);
  };

  // ── 复制 ────────────────────────────────────────────────────────────────

  /** 按钮文案的临时改口：失败与成功走同一处，恢复时长不同（成功那句不需要读） */
  const flash = (btn, text, ms, original) => {
    btn.textContent = text;
    later(() => { btn.textContent = original; }, ms);
  };

  /**
   * 复制一栏。三级兜底：`navigator.clipboard` → 临时 `<textarea>` + `execCommand` →
   * 一句"请手动选中"。任何一级都不许抛到页面外面：剪贴板被权限策略拒绝是浏览器的正常行为，
   * 用户按了没反应才是缺陷。
   * @param {string} panel 面板
   * @param {string} side 栏位
   */
  const doCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    const text = copies.get(key(panel, side)) || '';
    if (!btn || text === '') return;
    const original = COPY_LABEL.get(copyId(prefix, panel, side)) || btn.textContent;
    const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中', ok ? COPY_RESET_MS : COPY_FAIL_MS, original);
    if (clipboard && typeof clipboard.writeText === 'function') {
      let p = null;
      // 同步抛错与异步拒绝是同一条路：`writeText` 在权限策略拒绝时可能直接抛（不返回
      // Promise），那正是上面那句话点名的场景，不能让它从按钮回调里跑出去。
      try {
        p = Promise.resolve(clipboard.writeText(text));
      } catch {
        p = null;
      }
      if (p !== null) {
        p.then(() => done(true), () => done(legacyCopy(doc, text)));
        return;
      }
    }
    done(legacyCopy(doc, text));
  };

  // ── 事件接线 ─────────────────────────────────────────────────────────────

  /** 记下每条复制按钮的原文案，改口之后要能改回去（HTML 里那句是唯一的原文来源） */
  const COPY_LABEL = new Map();

  /** 每块面板的渲染函数：填下拉、接开关与级联、接按钮，然后先画一次生成侧 */
  const renderers = {};
  for (const panel of PANEL_IDS) {
    renderers[panel] = () => {
      const cfg = WORKBENCH_SPEC[panel].sides.gen;
      for (const c of cfg.controls) {
        const el = node(fieldId(prefix, panel, c.id));
        if (!el) continue;
        // Enter 只接在数字与日期格上：级联下拉里 Enter 没有"提交"语义，硬接会把用户的键盘
        // 焦点变成生成器触发器；多行粘贴框里的 Enter 必须是换行，它走 `onAreaKey` 那条组合键。
        if (c.type === 'number' || c.type === 'date') {
          el.addEventListener('keydown', onFieldKey(panel));
        }
        if (c.cascade || c.options || c.charsets) {
          refill(panel, c.id);
          el.addEventListener('change', () => {
            refreshCascade(panel, c.id);
            applySwitch(panel);
          });
        } else if (c.switch) {
          el.addEventListener('change', () => applySwitch(panel));
        }
      }
      applySwitch(panel);
      const genBtn = node(buttonId(prefix, panel, 'gen'));
      if (genBtn) genBtn.addEventListener('click', () => runGuardedRun(panel, 'gen'));
      const readCfg = WORKBENCH_SPEC[panel].sides.read;
      if (readCfg) {
        readCfg.controls.forEach((c) => {
          const el = node(fieldId(prefix, panel, c.id));
          if (el) el.addEventListener('keydown', onAreaKey(panel));
        });
        const readBtn = node(buttonId(prefix, panel, 'read'));
        if (readBtn) readBtn.addEventListener('click', () => runGuardedRun(panel, 'read'));
      }
      ['gen', 'read'].forEach((side) => {
        const id = copyId(prefix, panel, side);
        const btn = node(id);
        if (!btn) return;
        // 键用派生 id 而不是 `btn.id`：真 DOM 上两者相等，假 DOM 里 `.id` 是个普通属性，
        // 一旦哪份夹具没把它设上，`set(undefined, …)` 会静默存进另一格，`flash` 就取不回原文案。
        COPY_LABEL.set(id, btn.textContent);
        btn.addEventListener('click', () => doCopy(panel, side));
      });
      renderGen(panel);
      if (readCfg) hint(panel, 'read', '把号码粘进来，一条一行；判定全在浏览器里算，不发请求。');
    };
  }

  /** 级联：动了哪一格，就把它的下游重建一次（上游为空时下游退成禁用 + 只剩占位项） */
  const refreshCascade = (panel, control) => {
    const level = cascadeLevelOf(panel, control);
    if (level === 'province') {
      refill(panel, 'city');
      refill(panel, 'county');
    } else if (level === 'city') {
      refill(panel, 'county');
    }
  };

  /** 粘贴框里 Ctrl / ⌘ + Enter 判定；裸 Enter 仍然是换行（口径：多行框吞掉换行是缺陷） */
  const onAreaKey = (panel) => (evt) => {
    if (!evt || evt.key !== 'Enter' || !(evt.ctrlKey || evt.metaKey)) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, 'read');
  };

  /** 数字与日期格里的 Enter → 生成这一栏 */
  const onFieldKey = (panel) => (evt) => {
    if (!evt || evt.key !== 'Enter' || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, 'gen');
  };

  /**
   * 走一遍 `runGuarded`（真页面上就是 `createPanelDom.run`）：`FieldError` 在这一层就地转成
   * 提示行，其余异常原样抛出去，由那一层标坏这一块。
   * @param {string} panel 面板
   * @param {string} side 栏位
   */
  const runGuardedRun = (panel, side) => runGuarded(panel, () => {
    try {
      renderNow(panel, side);
    } catch (err) {
      if (!err || err.isField !== true) throw err;
      hint(panel, side, err.message);
    }
  });

  return {
    renderers,
    /**
     * 挂载完成后由测试或别处触发一栏：走的是与按钮完全同一条路（含 `runGuarded`）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {boolean} 这一块现在好不好——`runGuarded` 的返回值原样交出去，不替它乐观
     */
    run: (panel, side) => runGuardedRun(panel, side),
    /**
     * 这一栏当前能复制的文本（复制按钮读的就是它）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {string} 纯文本，没有则空串
     */
    copyTextOf: (panel, side) => copies.get(key(panel, side)) || '',
  };
}

/**
 * 三位号段归谁：把段补成 11 位交给读侧的 `parseMobile` 问一遍。
 * 不在 `phone.js` 里另开一张"运营商 → 号段"导出，是为了让下拉分组与判定行用同一张嘴说话
 * （§F8 已经把"逐段 valid 且运营商与表一致"钉住了，这里等于复用那条已被判过的路径）。
 * @param {string} segment 三位号段
 * @returns {string} 运营商名，判不到时是空串
 */
function carrierOfSegment(segment) {
  const padded = `${segment}00000000`.slice(0, 11);
  return parseMobile(padded).carrier;
}

/**
 * `navigator.clipboard` 不可用时的兜底：临时 textarea + `execCommand('copy')`。
 * 只在 http 或用户未授予剪贴板权限时走到这里，用完立刻摘掉节点——留在 DOM 里就是
 * 一个能被 Tab 走到的隐形输入框。
 * @param {object} doc 提供 `createElement` / `body.appendChild` / `body.removeChild`
 * @param {string} text 要复制的文本
 * @returns {boolean} 有没有真的复制上
 */
function legacyCopy(doc, text) {
  let ta = null;
  try {
    const box = doc.createElement('textarea');
    box.setAttribute('readonly', 'readonly');
    box.value = text;
    doc.body.appendChild(box);
    // 只有真挂上去的那一个才需要摘：`appendChild` 自己抛时 `ta` 仍是 null，
    // 那句 `removeChild` 就会抛出函数外，把"这一级失败"变成"这一级抛错"。
    ta = box;
    box.select();
    return typeof doc.execCommand === 'function' ? Boolean(doc.execCommand('copy')) : false;
  } catch {
    return false;
  } finally {
    // 摘节点写在 `finally`：`select()` 与 `execCommand` 抛错时也要摘——留在页面上
    // 就是一个能被 Tab 走到的隐形输入框，而这一级的口径是"不许抛到页面外面"。
    if (ta) doc.body.removeChild(ta);
  }
}

/**
 * 这个前缀下应该存在的全部控件 id，Task 9 拿它对账构建产物里的 HTML：
 * spec 说应有而页面没有 → 装配层第一次点就抛；页面有而 spec 没说 → 那是个没人接的格子。
 * 两个方向都红，才算这份 spec 是骨架的真值而不是它的影子。
 * @param {string} prefix 前缀
 * @param {string[]} [panels] 面板清单，默认 `PANEL_IDS`
 * @returns {{in: string[], btn: string[], copy: string[], out: string[], when: string[]}}
 */
export function controlIds(prefix, panels = PANEL_IDS) {
  const got = { in: [], btn: [], copy: [], out: [], when: [] };
  for (const panel of panels) {
    const sides = WORKBENCH_SPEC[panel].sides;
    for (const side of ['gen', 'read']) {
      const cfg = sides[side];
      if (!cfg) continue;
      got.btn.push(buttonId(prefix, panel, side));
      got.copy.push(copyId(prefix, panel, side));
      got.out.push(outId(prefix, panel, side));
      for (const c of cfg.controls) got.in.push(fieldId(prefix, panel, c.id));
    }
    const sw = sides.gen.switch;
    if (sw) for (const t of sw.targets) got.when.push(whenId(prefix, panel, t.key));
  }
  return got;
}
