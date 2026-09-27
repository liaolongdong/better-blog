/**
 * `createPanelWorkspace` 的 DOM 绑定层：把状态机算好的四张属性表原样写进节点，把点击 / 按键 /
 * hashchange 三类事件原样喂回去，另外负责"一块塌了不塌整页"。
 *
 * 这一层存在的唯一理由就是段 1 计划 §6.0 写下的那句分工：**页面里只允许有一处 ARIA 口径**。
 * `panel.js` 已经把 `role` / `aria-selected` / `aria-controls` / `tabindex` / `hidden` 算成属性表，
 * 装配层若再手抄一遍，"改一处属性"就变成"改两处、漏一处"，而漏掉的那一处只在读屏里看得见。
 * 所以这里对属性表只做两件事：按表里的 `id` 找节点、逐键写值——**不判断、不改名、不补默认值、
 * 不因为"页面里好像已经有了"就跳过**。要改 ARIA 形状，改 `panel.js` 与 §D，别在这里加 `if`。
 *
 * 五条口径先立住，§I 的判据逐条对着它们咬：
 *
 * 1. **一次只显示一块**：`panelAttr(id).hidden` 是可见性的唯一来源，这层不加"滚动到了就展开"
 *    那类旁路，也不管 CSS 怎么写。整页在任意一次 `sync()` 之后恰好一块可见。
 * 2. **焦点只跟键盘走**：`move()` 真的换了面板才 `focus()`。点 tab 不抢（焦点本来就在被点的
 *    那块上），`hashchange` 不抢（用户可能正在读页面上别的位置，被焦点跳走是可访问性事故），
 *    带修饰键的点击与中键**整个不接**（`<a href="#id">` 的开新标签语义就是深链的价值）。
 * 3. **地址栏只在用户动手之后写**：`toHash()` 返回空串时一个 `replaceState` 都不发；
 *    `unknownHash()` 为真时也不写——状态机宁可让地址栏与页面短暂不一致（段 1 §6.0 第三条），
 *    这层跟着它一起不写，只在页面里给一条提示，坏 hash 原样留在地址栏上供人复制排查。
 * 4. **单块错误隔离**：每块面板的渲染函数走同一道 `run()`，抛错只标坏那一块（`markBroken`）
 *    并把错误条插到那块面板的顶部，其余四块照常可点可用。错误条与提示行一律写 `textContent`：
 *    `message` 里可能带着用户粘贴的 `</script>` 或 `<img onerror=…>`，这里**没有第二次转义的
 *    机会**，走 `innerHTML` 就等于把"渲染失败提示"变成第二个 XSS 出口。
 * 5. **缺节点分两种**：整页没有 tablist 容器＝没有索引，那不是"一块塌"，`mount()` 当场抛
 *    `RangeError`（形状对而页面上找不到，与 `markBroken` 同档）；只缺某一块的 tab 或 panel＝
 *    那一块标坏、不跑它的渲染函数，但**属性表照写**（缺 tab 的那块面板仍参与可见性互锁，
 *    缺 panel 的那块 tab 仍能被点与被键盘走到，只是切过去看不到东西）。索引与键盘照旧能用。
 *    这种骨架缺陷的真判据在构建期：Task 9 的收录面断言 `ids` 与页面里的 panel 节点一一对应。
 *
 * 前缀不在这里出现第二次：所有 `id` 都从 `tabAttr(id).id` / `panelAttr(id).id` /
 * `tablistAttr().id` 取，所以 `.jt-` 那套工作台（§6.4 两条黑名单前缀）换的只是构造参数。
 *
 * @param {object} options 构造参数，缺哪一个都会当场抛（装配层写错不该降成一条看起来像用户
 *   行为的结论，与 `panel.js` / `idcard.js` / `uscc.js` 同档：形状不对是 `TypeError`，
 *   形状对而值不能用是 `RangeError`，两句都点名是哪一个键）
 * @param {object} options.workspace `createPanelWorkspace()` 的返回值，必须齐那十四个方法
 * @param {object} options.document 提供 `getElementById` / `createElement`，浏览器里就是 `document`
 * @param {object} options.location 提供字符串 `hash`
 * @param {object} options.history 提供 `replaceState`
 * @param {object} options.window 只在它上面听 `hashchange`
 * @param {object} [options.renderers] `id → (panelElement) => void`，构建期骨架之外要补的内容；
 *   键必须落在 `workspace.ids()` 里，多余的键是装配层写错了面板名，抛 `RangeError`
 * @param {object} [options.notice] 坏 hash 提示行的节点，不传就只记状态、页面上不多说话
 * @returns {{mount: () => {mounted: string[], missing: string[], rendered: string[], broken: string[]},
 *   sync: () => void, run: (id: string, fn: (el: object) => void) => boolean}}
 */
import { keyAction } from './panel.js';

/** 错误条的类名是 `toolkit.scss`（Task 8）的钩子；这里只给形状，颜色与字号一律不在 JS 里 */
const ERROR_CLASS = 'tk-panel__error';
const BANNER_BEFORE = '这一块面板没能渲染出来：';
const BANNER_AFTER = '。其余面板不受影响。';

/** `workspace` 必须齐的方法。少一个就不是"这一版还没做"，而是装配层接错了线，直接抛。 */
const WORKSPACE_API = [
  'ids', 'active', 'unknownHash', 'tablistAttr', 'tabAttr', 'panelAttr',
  'select', 'move', 'applyHash', 'toHash', 'markBroken', 'brokenOf', 'brokenIds', 'clearBroken',
];

export function createPanelDom({
  workspace, document, location, history, window: win, renderers = {}, notice = null,
} = {}) {
  if (!workspace || typeof workspace !== 'object') {
    throw new TypeError(`createPanelDom：options.workspace 应为 createPanelWorkspace() 的返回值，收到 ${shapeOf(workspace)}`);
  }
  for (const name of WORKSPACE_API) {
    if (typeof workspace[name] !== 'function') {
      throw new TypeError(`createPanelDom：options.workspace 缺方法 ${name}()，绑定层不接受自己算 ARIA`);
    }
  }
  if (!document || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') {
    throw new TypeError('createPanelDom：options.document 要有 getElementById 与 createElement，绑定层不用 querySelector');
  }
  if (!location || typeof location.hash !== 'string') {
    throw new TypeError(`createPanelDom：options.location.hash 应为字符串，收到 ${shapeOf(location && location.hash)}`);
  }
  if (!history || typeof history.replaceState !== 'function') {
    throw new TypeError('createPanelDom：options.history 要有 replaceState，写地址栏只用它（不 push，不留返回栈）');
  }
  if (!win || typeof win.addEventListener !== 'function') {
    throw new TypeError('createPanelDom：options.window 要能 addEventListener(\'hashchange\')');
  }
  if (typeof renderers !== 'object' || renderers === null || Array.isArray(renderers)) {
    throw new TypeError(`createPanelDom：options.renderers 应为 { 面板 id: 渲染函数 }，收到 ${shapeOf(renderers)}`);
  }
  const ids = workspace.ids();
  for (const [key, fn] of Object.entries(renderers)) {
    if (!ids.includes(key)) {
      throw new RangeError(`createPanelDom：renderers.${key} 不在 ids 里（${ids.join(', ')}），这块面板的渲染函数没人调用`);
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`createPanelDom：renderers.${key} 应为函数，收到 ${shapeOf(fn)}`);
    }
  }
  if (notice !== null && (typeof notice !== 'object' || typeof notice.setAttribute !== 'function')) {
    throw new TypeError(`createPanelDom：options.notice 应为节点或 null，收到 ${shapeOf(notice)}`);
  }

  const tabNode = new Map();
  const panelNode = new Map();
  const bannerNode = new Map();
  /** 骨架不完整（缺 tab 或缺 panel）的那几块：不跑渲染函数，也不许被 `run()` 洗成"好了" */
  const incomplete = new Set();
  let mounted = false;

  /**
   * 逐键原样写。只有 `hidden` 走属性而不是 `setAttribute`——它是 `panelAttr` 里唯一的布尔值，
   * 真 DOM 上 `el.hidden = true` 与 `setAttribute('hidden','true')` 并不等价（后者恒为真），
   * 所以这一格必须按值型分派，而不是按键名硬编码。节点为 `null` 时直接返回：缺哪一块由
   * `mount()` 记进状态，不该在这里变成一句 `Cannot read properties of null`。
   */
  const writeAttrs = (el, attrs) => {
    if (!el) return;
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === 'boolean') el.hidden = value;
      else el.setAttribute(key, String(value));
    }
  };

  const bannerText = (message) => `${BANNER_BEFORE}${message}${BANNER_AFTER}`;

  /** 错误条只在"坏 ↔ 好"翻转时增删，文案每次都覆写（`run()` 二次失败可能换了原因） */
  const paintBanner = (id) => {
    const message = workspace.brokenOf(id);
    const panel = panelNode.get(id);
    const existing = bannerNode.get(id);
    if (message === '') {
      if (existing) {
        if (panel) panel.removeChild(existing);
        bannerNode.delete(id);
      }
      return;
    }
    if (!panel) return;
    if (existing) {
      existing.textContent = bannerText(message);
      return;
    }
    const node = document.createElement('p');
    node.setAttribute('class', ERROR_CLASS);
    node.setAttribute('role', 'alert');
    node.textContent = bannerText(message);
    panel.insertBefore(node, panel.firstChild);
    bannerNode.set(id, node);
  };

  /** 坏 hash 的提示：地址栏里是什么就说什么，不解释、不百分号解码（那是浏览器显示的那一串） */
  const paintNotice = () => {
    if (!notice) return;
    if (!workspace.unknownHash()) {
      notice.hidden = true;
      return;
    }
    notice.hidden = false;
    notice.textContent = `地址栏里的 ${location.hash} 不是本页的某一块面板，已保持当前面板。`;
  };

  /** 口径 3：两种"不写"各自独立成立，写的时候保留既有 state，别让页面丢掉 scrollRestoration 之类 */
  const paintHash = () => {
    if (workspace.unknownHash()) return;
    const target = workspace.toHash();
    if (target === '' || location.hash === target) return;
    history.replaceState(history.state ?? null, '', target);
  };

  const sync = () => {
    for (const id of ids) {
      writeAttrs(tabNode.get(id), workspace.tabAttr(id));
      writeAttrs(panelNode.get(id), workspace.panelAttr(id));
      paintBanner(id);
    }
    paintNotice();
    paintHash();
  };

  const onClick = (id) => (evt) => {
    if (evt && (evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey)) return;
    if (evt && typeof evt.button === 'number' && evt.button !== 0) return;
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (!workspace.select(id)) return;
    sync();
  };

  /**
   * 自动激活（段 1 §6.0 第一条）：移动焦点即换面板，`keyAction` 已经把所有带修饰键的组合
   * 挡在门外。`preventDefault()` 无条件先做——方向键与 `Home`/`End` 在浏览器里的默认动作就是
   * 滚动，索引条拿到焦点时按上下会滚整页，那是这个组件最容易漏的一条键盘缺陷。
   * `changed` 为假时**整段不做第二件事**：只有一块面板的工作区里按方向键、或者在第一块上按
   * `Home`，状态机已经把 `touched` 置真了，跟着 sync 就会把 `#第一块` 写进地址栏——用户什么
   * 都没换来，却凭空多了一条历史记录。焦点同理：没换面板就不抢焦点。
   * `focus()` 排在 `sync()` 之后：tabindex 要先落到新那块上，否则读屏报出的还是旧的那一项。
   */
  const onKey = (id) => (evt) => {
    const action = keyAction(evt);
    if (action === '') return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    const moved = workspace.move(action);
    if (!moved.changed) return;
    sync();
    const next = tabNode.get(moved.active);
    if (next && typeof next.focus === 'function') next.focus();
  };

  /** 跑一块面板的渲染函数，不改状态；`run()` 与 `mount()` 共用这一处 try/catch */
  const apply = (id, fn) => {
    const panel = panelNode.get(id); // 两处调用点都被 `incomplete` 那道闸门挡过，这一格必在
    try {
      fn(panel);
      workspace.clearBroken(id);
      return true;
    } catch (err) {
      workspace.markBroken(id, messageOf(err));
      return false;
    }
  };

  return {
    /**
     * 挂载一次。返回四个 id 清单：`mounted` 是两块节点齐、已升级成 tab 的那几块；
     * `missing` 是骨架缺节点的；`rendered` 是渲染函数跑成功的；`broken` 就是
     * `workspace.brokenIds()`，把"缺节点"与"渲染抛错"合在一起说。
     * 重复调用抛 `RangeError`：`run()` 会把每块面板的内容再追加一遍，那种"看着像双份内容"的
     * 缺陷比当场炸难查得多。
     */
    mount() {
      if (mounted) throw new RangeError('createPanelDom：mount() 已经跑过，重复挂载会把每块面板的渲染函数再跑一遍');
      const listAttrs = workspace.tablistAttr();
      const list = document.getElementById(listAttrs.id);
      if (!list) {
        throw new RangeError(`createPanelDom：页面里没有 id="${listAttrs.id}" 的节点，没有索引条就不算一块工作区`);
      }
      writeAttrs(list, listAttrs);
      const missing = [];
      for (const id of ids) {
        const tabId = workspace.tabAttr(id).id;
        const panelId = workspace.panelAttr(id).id;
        const tab = document.getElementById(tabId);
        const panel = document.getElementById(panelId);
        if (!tab || !panel) {
          const absent = [];
          if (!tab) absent.push(`id="${tabId}" 的 tab 节点`);
          if (!panel) absent.push(`id="${panelId}" 的 panel 节点`);
          missing.push(id);
          incomplete.add(id);
          workspace.markBroken(id, `页面骨架里缺 ${absent.join(' 与 ')}，这块面板不完整`);
        }
        // 两半各记各的：缺 tab 的那一块，面板仍然参与"一次只显示一块"的互锁（口径 5），
        // 不记进去就会留下一块永远没人覆写 `hidden` 的面板——那是这层能造出的第二种双显故障。
        if (tab) {
          tabNode.set(id, tab);
          tab.addEventListener('click', onClick(id));
          tab.addEventListener('keydown', onKey(id));
        }
        if (panel) panelNode.set(id, panel);
      }
      win.addEventListener('hashchange', () => {
        workspace.applyHash(location.hash);
        sync();
      });
      workspace.applyHash(location.hash);
      const rendered = [];
      for (const id of ids) {
        const fn = renderers[id];
        if (typeof fn !== 'function') continue;
        // 骨架不完整的面板不跑渲染函数：没有 tab 就切不到它，凭空渲染一份内容只是把缺陷藏起来。
        if (incomplete.has(id)) continue;
        if (apply(id, fn)) rendered.push(id);
      }
      sync();
      mounted = true;
      return {
        mounted: ids.filter((id) => !incomplete.has(id)),
        missing,
        rendered,
        broken: workspace.brokenIds(),
      };
    },
    sync,
    /**
     * 装配层在表单回调里复用同一道闸门：成功就把那块面板的错误条撤掉，抛错就只塌这一块。
     * 返回值是"这一块现在好不好"，不是"函数有没有抛"。两种情况不跑函数、直接报 `false`：
     * 面板节点缺失（跑也没地方放内容），以及 `mount()` 记下的骨架不完整那块（那是构建期缺陷，
     * 不可能靠再跑一次渲染函数修好，跑成功了反而会把"缺节点"这条真话从错误条上洗掉）。
     */
    run(id, fn) {
      if (!mounted) throw new RangeError('createPanelDom.run：先 mount() 再 run()，节点还没找过');
      if (!ids.includes(id)) {
        throw new RangeError(`createPanelDom.run：面板 id ${shapeOf(id)} 不在 ids 里`);
      }
      if (typeof fn !== 'function') {
        throw new TypeError(`createPanelDom.run(${id})：fn 应为函数，收到 ${shapeOf(fn)}`);
      }
      if (incomplete.has(id)) return false;
      const ok = apply(id, fn);
      sync();
      return ok && workspace.brokenOf(id) === '';
    },
  };
}

/**
 * 抛出来的东西形状千奇百怪（`throw 'x'`、`throw {message: 42}`），但页面上只能有一行可读的
 * 句子：优先取 `message`，取不到就 `String()` 一次；空 `message` 退回名字，因为
 * `new Error()` 的 `message` 是空串，什么都不显示比显示一句没头没尾的话更糟。
 */
function messageOf(err) {
  if (err && typeof err.message === 'string' && err.message !== '') return err.message;
  return String(err);
}

/**
 * 报错文案里的"收到什么"——与 `idcard.js` / `uscc.js` / `panel.js` 那三份同一口径的第四份，
 * 同样不跨模块 import：这一层不许因为另一个工具的报错文案改动被拖着回归。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}
