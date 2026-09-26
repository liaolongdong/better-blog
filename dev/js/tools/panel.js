/**
 * 工具箱面板状态机：ARIA Tabs 属性表、roving tabindex、hash 双向解释、单块错误隔离。
 *
 * 纯状态，不碰 DOM，也不 import 任何兄弟模块：页面装配层（段 2）只做两件事——
 * 把 tabAttr/panelAttr 返回的属性表原样写进节点，把 hashchange/keydown 原样喂给
 * applyHash/move。口径与理由见实现计划 §6.0。
 */

/** 前缀默认 tk（toolkit 页）；JSON 工作台用 jt，避免类名是 .jt- 而 id 是 tk-tab-*。 */
export function createPanelWorkspace({ ids, hash = '', prefix = 'tk' } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('createPanelWorkspace：面板 id 列表为空，至少一个面板');
  }
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || id === '') {
      throw new Error('createPanelWorkspace：面板 id 必须是非空字符串');
    }
    if (seen.has(id)) throw new Error(`createPanelWorkspace：面板 id 重复：${id}`);
    seen.add(id);
  }
  const tabId = (id) => `${prefix}-tab-${id}`;
  const panelId = (id) => `${prefix}-panel-${id}`;
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
    /** 点 tab：返回 false 只代表"没有这块面板"，点击已选中的 tab 是 true 且 changed=false */
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
    markBroken(id, message = '') {
      if (!seen.has(id)) throw new Error(`未知面板 id：${id}`);
      broken.set(id, String(message));
    },
    brokenOf(id) {
      return broken.get(id) || '';
    },
    brokenIds: () => ids.filter((id) => broken.has(id)),
    clearBroken(id) {
      broken.delete(id);
    },
  };
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
