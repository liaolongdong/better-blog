/**
 * 工具箱面板状态机：ARIA Tabs 属性表、roving tabindex、hash 双向解释、单块错误隔离。
 *
 * 纯状态，不碰 DOM，也不 import 任何兄弟模块：页面装配层（段 2）只做两件事——
 * 把 tablistAttr/tabAttr/panelAttr 返回的属性表原样写进节点，把 hashchange/keydown
 * 原样喂给 applyHash/move。口径与理由见实现计划 §6.0。
 *
 * **入参错一律抛，且分两类**（与 `idcard.js` / `uscc.js` 同档：调用方写错装配代码要当场
 * 炸，不能静默降成一条看起来像用户行为的结论）：形状不对是 `TypeError`，形状对而值不能用
 * 是 `RangeError`，两句都点名是哪一个键、哪一项。为什么值得分：这段代码只在页面启动时
 * 跑一次，`ids: [1,2,3]` 与 `ids: []` 都是装配层写错，但前者要去改 `map` 的取值、
 * 后者要去改配置来源，报错把两件事混成一句「参数错误」等于让人重新试一遍。
 *
 * @param {object} [options] 构造参数
 * @param {string[]} [options.ids] **必填**，非空字符串数组、不许重复；顺序就是 tablist 的顺序
 * @param {string} [options.hash] 进入页面时 URL 里的 hash，认不出来回落到 `ids[0]`
 * @param {string} [options.prefix] id 前缀，默认 `tk`（toolkit）；JSON 工作台用 `jt`
 * @param {string} [options.label] tablist 的 `aria-label`，默认「工具面板」
 * @param {'vertical'|'horizontal'} [options.orientation] tablist 的视觉走向，默认 `vertical`
 *   （§6.3 的索引条是左侧粘性那一款；≤900px 折成横向 chip 条属 CSS，不改 DOM 顺序，
 *   所以这里不跟断点走）。`keyAction` 两个方向都接，这一格只影响读屏播报。
 * @returns {{ids:()=>string[], active:()=>string, unknownHash:()=>boolean,
 *   tablistAttr:()=>object, tabAttr:(id:string)=>object, panelAttr:(id:string)=>object,
 *   select:(id:string)=>boolean, move:(action:string)=>{active:string, changed:boolean},
 *   applyHash:(raw:string)=>boolean, toHash:()=>string, markBroken:(id:string, message?:string)=>void,
 *   brokenOf:(id:string)=>string, brokenIds:()=>string[], clearBroken:(id:string)=>void}}
 */
export function createPanelWorkspace({
  ids, hash = '', prefix = 'tk', label = '工具面板', orientation = 'vertical',
} = {}) {
  if (ids === undefined) throw new TypeError('createPanelWorkspace：options.ids 必填，收到 undefined');
  if (!Array.isArray(ids)) {
    throw new TypeError(`createPanelWorkspace：options.ids 应为非空字符串数组，收到 ${shapeOf(ids)}`);
  }
  if (ids.length === 0) throw new RangeError('createPanelWorkspace：options.ids 是空数组，至少要有一块面板');
  const seen = new Map();
  for (const [i, id] of ids.entries()) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError(`createPanelWorkspace：options.ids[${i}] 应为非空字符串，收到 ${shapeOf(id)}`);
    }
    if (seen.has(id)) {
      throw new RangeError(
        `createPanelWorkspace：options.ids[${i}] 与第 ${seen.get(id)} 项重复（${id}）`);
    }
    seen.set(id, i);
  }
  if (typeof prefix !== 'string' || prefix.trim() === '') {
    throw new TypeError(`createPanelWorkspace：options.prefix 应为非空字符串，收到 ${shapeOf(prefix)}`);
  }
  if (typeof label !== 'string' || label.trim() === '') {
    throw new TypeError(`createPanelWorkspace：options.label 应为非空字符串，收到 ${shapeOf(label)}`);
  }
  if (orientation !== 'vertical' && orientation !== 'horizontal') {
    throw new RangeError(
      `createPanelWorkspace：options.orientation 只能是 'vertical' 或 'horizontal'，收到 ${shapeOf(orientation)}`);
  }
  if (typeof hash !== 'string') {
    throw new TypeError(`createPanelWorkspace：options.hash 应为字符串，收到 ${shapeOf(hash)}`);
  }
  const tabId = (id) => `${prefix}-tab-${id}`;
  const panelId = (id) => `${prefix}-panel-${id}`;
  const tablistId = () => `${prefix}-tablist`;
  const MOVE = {
    next: (i, n) => (i + 1) % n,
    prev: (i, n) => (i - 1 + n) % n,
    first: () => 0,
    last: (_i, n) => n - 1,
  };

  const broken = new Map();
  const initial = parseHash(hash, ids);
  let active = initial.id === null ? ids[0] : initial.id;
  let unknown = initial.unknown;
  let touched = initial.id !== null;

  const settle = (id) => {
    const changed = id !== active;
    active = id;
    touched = true;
    unknown = false;
    return { active, changed };
  };
  return {
    ids: () => ids.slice(),
    active: () => active,
    /** 最近一次 hash 是否不认识：DOM 层据此提示"没有这个面板"，状态机自己绝不清空白 */
    unknownHash: () => unknown,
    /**
     * tablist 容器那一条属性表。§6.3 要求页面里有 `role="tablist"`，而本模块的契约是
     * "装配层只写模块算出来的属性表"——容器这一格若不留在这里，段 2 就得自己手抄一份
     * `role` 与 `aria-label`，同一个节点上两套口径。键集固定四格（`id` / `role` /
     * `aria-label` / `aria-orientation`），`hidden` 这类运行时状态不在这里（容器永远可见）。
     * `aria-orientation` 只有两个合法值，构造时按闭集校验且**不做大小写折叠**：这一格是
     * 原样写进 DOM 的属性值，折叠等于把 `'Vertical'` 悄悄洗成合法值、把装配层的笔误咽下去；
     * 而 `keyAction` 压根不读这一格（左右上下都接），所以放开折叠换不来任何行为差异，
     * 只会让"报错点名 orientation"这条判据失去牙。
     */
    tablistAttr() {
      return {
        id: tablistId(),
        role: 'tablist',
        'aria-label': label,
        'aria-orientation': orientation,
      };
    },
    tabAttr(id) {
      const on = id === active;
      return {
        id: tabId(id),
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        'aria-controls': panelId(id),
        tabindex: on ? '0' : '-1',
      };
    },
    panelAttr(id) {
      const on = id === active;
      return {
        id: panelId(id),
        role: 'tabpanel',
        tabindex: '0',
        'aria-labelledby': tabId(id),
        hidden: !on,
      };
    },
    /**
     * 点 tab。**这个返回值只回答"有没有这块面板"，不回答"换没换"**（计划 §6.0 第四条口径）：
     * 点已经亮着的那块是合法操作，报 `false` 会让页面弹一条莫名其妙的"没有这个面板"。
     * 换没换在 `move()` 的 `changed` 里；`select` 不返回这一格，因为 DOM 层拿它只做一件事
     * （`false` 就什么也不写），多一个"换没换"只会诱使装配层拿它当"要不要写 hash"的依据
     * ——那个判断的正确答案永远是"要"，见下面两条副作用。
     * 副作用两条一并写明（都由 D4 钉着）：`touched` 置真（于是 `toHash()` 从不写变成写
     * `#当前`），`unknown` 清假（用户自己动手之后不再提示那条坏 hash）。
     */
    select(id) {
      if (!seen.has(id)) return false;
      settle(id);
      return true;
    },
    move(action) {
      const step = MOVE[action];
      if (!step) return { active, changed: false };
      const i = ids.indexOf(active);
      return settle(ids[step(i, ids.length)]);
    },
    applyHash(raw) {
      const parsed = parseHash(raw, ids);
      if (parsed.unknown) {
        unknown = true;
        return false;
      }
      if (parsed.id === null) return false;
      settle(parsed.id);
      return true;
    },
    /** 无 hash 进入且用户还没动手时返回 ''：DOM 层据此决定要不要 replaceState */
    toHash() {
      return touched ? `#${active}` : '';
    },
    /**
     * 记一块面板坏了。`id` 不在 `ids` 里是装配层写错，抛 `RangeError` 并点名那一个 id；
     * `message` 允许空串（DOM 层可能只想标"这块塌了"、不带原因），非串一律 `String()` 一次。
     */
    markBroken(id, message = '') {
      if (!seen.has(id)) {
        throw new RangeError(`markBroken：面板 id ${shapeOf(id)} 不在 ids 里，拒绝记录错误`);
      }
      broken.set(id, String(message));
    },
    brokenOf(id) {
      return broken.get(id) || '';
    },
    brokenIds: () => ids.filter((id) => broken.has(id)),
    /** 与 `markBroken` 同档：不认识的面板 id 抛，不静默当"没这块、没事发生" */
    clearBroken(id) {
      if (!seen.has(id)) {
        throw new RangeError(`clearBroken：面板 id ${shapeOf(id)} 不在 ids 里，拒绝清除`);
      }
      broken.delete(id);
    },
  };
}

/**
 * 报错文案里的"收到什么"——与 `idcard.js` / `uscc.js` 里那两份同一口径（`string nope` /
 * `number 3` / `null` / `object`），这里第三份、同样不跨模块 import：面板模块不许因为
 * 另一个工具的口径改动被拖着回归，跨模块同档由 §D 的判据对着 `idcard.js` 的写法核。
 * 与那两个模块同一档的边界：**这里绝不 `String()` 无原型对象或 Symbol**（那会自己先抛），
 * 只给形状；真正的 `String()` 只在 `parseHash` / `markBroken` 那两处。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Date（Invalid Date）' : 'Date';
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 只去前导 #、只做小写折叠，别的字符一律不解释——id 是白名单里的字符串或 null */
export function parseHash(raw, ids) {
  const s = typeof raw === 'string' ? raw.trim().replace(/^#/, '') : '';
  if (s === '') return { id: null, unknown: false };
  const hit = ids.find((id) => id.toLowerCase() === s.toLowerCase());
  return hit === undefined ? { id: null, unknown: true } : { id: hit, unknown: false };
}

/**
 * 键事件 → 动作文本。左右上下都接（索引条在窄屏可能换向），带任何修饰键一律不抢。
 * 返回值直接喂 move；这里不碰状态，方便装配层在 input/textarea 里先问一句要不要放行。
 */
export function keyAction(evt) {
  if (!evt || evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey) return '';
  switch (evt.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return 'next';
    case 'ArrowUp':
    case 'ArrowLeft':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return '';
  }
}
