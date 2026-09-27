/**
 * 证件页入口：只读骨架里那四格 `data-tk-*`，把框架（`window.Tk`）与本页装配层接起来。
 *
 * 这个文件刻意薄到只剩三件事——找容器、读配置、按顺序接线——业务一条都不写，写进
 * `workbench.js` 的 spec 与 `view.js` 的渲染函数里才有判据可咬。理由与 §6.0 那条分工同源：
 * 入口是唯一知道"这一页有哪些面板、前缀是什么"的地方，而这些事实已经由
 * `_data/onlineTools.yml` 在构建期写进 HTML 了，这里再抄一遍就多一处口径。
 *
 * 四条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `tk` 是**本页自己的
 *    地址**（这一份入口只服务证件页，JSON 页那份用 `jt`，Task 9 用 yml 的 `prefix` 跟它们对账）；
 *    而行为里用的前缀从 `data-tk-prefix` 读，一路传给 `createPanelWorkspace` 与
 *    `createWorkbench`，控件 id 才跟着 §J 的 spec 换得动。
 * 2. **`runGuarded` 晚绑**。`createWorkbench` 在构造时就把 `env.runGuarded` 收进闭包常量，
 *    而能当它的那只 (`createPanelDom().run`) 要等 workbench 交出 renderers 之后才存在——
 *    循环。所以递过去的是一个箭头，它在**调用时**才去 `guard.run` 上取：占位函数永远不可能
 *    被真的调到，因为按钮回调只在 `mount()` 之后才挂得上。
 * 3. **启动失败不装死**。抛出之前尽力把那句话写进 `#tk-notice`（只走 `textContent`），
 *    因为脚本 404 或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样——正文全在、
 *    按钮按不出东西。给一句能抄下来问人的话，比只在控制台红一次强。容器本身找不到时没地方写，
 *    那就只剩控制台，这也是这一条只写"尽力"的原因。
 * 4. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`，入口在它之后；
 *    顺序反了 `Tk` 就是 undefined，所以那一步单独判、单独报（见 `boot` 里那句 `window.Tk`）。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，
 * 而它不补 `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。启动方式与
 * `webLab.js` 同档——脚本排在正文之后，解析到这一行时面板节点已经存在，不接 `DOMContentLoaded`。
 */
import { createWorkbench } from './tools/workbench.js';

/** 容器 id：`tools-idcard.html` 里 `id="{{ tk.prefix }}-workspace"` 在 `prefix: tk` 下的落值 */
const CONTAINER_ID = 'tk-workspace';
/** 提示行 id：同上，`panel-dom` 的坏 hash 提示与本页的启动失败提示共用这一格 */
const NOTICE_ID = 'tk-notice';

/** 骨架上那四格数据的属性名（前缀 `tk` 同上，是本页的地址，不是行为里的前缀） */
const ATTR = {
  ids: 'data-tk-ids',
  prefix: 'data-tk-prefix',
  label: 'data-tk-label',
  notice: 'data-tk-notice',
};

/**
 * 取提示行节点：容器在就读 `data-tk-notice`，容器不在或那一格空着就回落到 `NOTICE_ID`。
 * 两条路径都要过"它得像个节点"这一关，因为写它的是失败兜底，不能自己再抛一次。
 * @param {object} doc 只提供 `getElementById`
 * @param {object|null} box 容器节点，可能不存在
 * @returns {object|null} 节点或 `null`
 */
function noticeNode(doc, box) {
  const fromAttr = box && typeof box.getAttribute === 'function'
    ? String(box.getAttribute(ATTR.notice) || '').trim() : '';
  const id = fromAttr !== '' ? fromAttr : NOTICE_ID;
  const el = id ? doc.getElementById(id) : null;
  return el && typeof el.setAttribute === 'function' ? el : null;
}

/**
 * `data-tk-ids` → 面板清单。逗号分隔、允许空格、丢掉空项；顺序就是索引条的顺序。
 * @param {string} raw 属性原文
 * @returns {string[]} 至少一项，空数组由调用侧判成错误
 */
function parseIds(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `location` / `history` / `navigator`）
 * @param {object} tk `window.Tk`
 * @returns {object} `createPanelDom().mount()` 的那四个清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-idcard.html 末尾那段注释`);
  }
  const ids = parseIds(box.getAttribute(ATTR.ids));
  if (ids.length === 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 是空的，索引条与面板对不上，_data/onlineTools.yml 的 panels 是不是漏了 slug？`);
  }
  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'tk';
  const label = String(box.getAttribute(ATTR.label) || '').trim();
  const notice = noticeNode(doc, box);
  if (!tk || typeof tk.createPanelWorkspace !== 'function'
    || typeof tk.createPanelDom !== 'function' || !tk.view) {
    throw new RangeError(
      'window.Tk 没挂上来：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-idcard.html 末尾');
  }

  const workspace = tk.createPanelWorkspace({
    ids,
    prefix,
    hash: win.location.hash,
    label: label === '' ? undefined : label,
  });
  /** 口径 2 的那个占位：谁真调到它，就是有人在 `mount()` 之前按了按钮 */
  const guard = {
    run: () => {
      throw new RangeError('装配层还没接上 createPanelDom().run，按钮回调跑早了');
    },
  };
  const wb = createWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded: (id, fn) => guard.run(id, fn),
    navigator: win.navigator,
  });
  const dom = tk.createPanelDom({
    workspace,
    document: doc,
    location: win.location,
    history: win.history,
    window: win,
    renderers: wb.renderers,
    notice,
  });
  guard.run = dom.run;
  return dom.mount();
}

/**
 * 启动一次，并把失败写进页面上那句话。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`
 * @returns {object|undefined} 成功时是 `mount()` 的四个清单，失败时 `undefined`（但仍会抛）
 */
function start(doc, win) {
  try {
    return boot(doc, win, win.Tk);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const el = noticeNode(doc, doc.getElementById(CONTAINER_ID));
    if (el) {
      el.hidden = false;
      el.textContent = `这一页的交互层没能启动：${message}。正文仍然读得到，只是按钮与下拉不会有反应。`;
    }
    throw err;
  }
}

start(document, window);
