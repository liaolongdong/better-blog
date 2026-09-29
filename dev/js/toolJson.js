/**
 * JSON 工作台页入口（段 4 Task 6；§W）：只读骨架里那四格 `data-jt-*`，把框架（`window.Tk`）、
 * 装配层（`createJsonWorkbench`）与本页接起来。与 `toolCodec.js` 同形，差异有两处——这一页只有
 * 一块工作区，所以**不经过 `createPanelDom`**（那一道是"多块面板互斥显示"的绑定层，这里没得互斥），
 * 以及 `runGuarded` 由这一本自己给。
 *
 * 五条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `jt` 是**本页自己的地址**
 *    （`tools-json.html` 的骨架写死它）；行为里用的前缀从 `data-jt-prefix` 读，一路传给装配层，
 *    控件 id 与 `localStorage` 的键才跟着换得动（W18 的 `zx` 那一档量的就是这件事）。
 * 2. **环境只在这一本读，每样恰好一次**（W11 数的是出现次数）。时钟、`localStorage`、`setTimeout`、
 *    剪贴板、下载那三件全从这里注入，装配层那七个词一个都不许出现（W10）。理由是同一份产物在两台
 *    机器、两个 CI runner 上只能给一个答案，而 §W 的每一判都指望它只有一个。
 *    `localStorage` 在隐私模式下**访问本身就抛**，所以取它包了一层 `try`——那一格取不到就是"这台
 *    浏览器不给存"，装配层据此把"记住上次输入"置灰（W15），而不是让整页停在启动那一下。
 * 3. **`runGuarded` 由入口给**。装配层只负责"抛出来"，记不记、记在哪儿是页面这一侧的事：这一页没有
 *    面板错误条（那块区域就是整页），所以坏消息写进 `#jt-notice` 那一句，下一次跑成功就撤掉。
 *    只有本层写过的句子本层才撤——那格提示行也用于启动失败，别把别人的话清成空白。
 * 4. **启动失败不装死**。抛出之前尽力把那句话写进 `#jt-notice`（只走 `textContent`），因为脚本 404
 *    或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样：正文全在、按钮按不出东西。
 *    容器本身找不到时没地方写，那就只剩控制台，这也是这一条只写"尽力"的原因。
 * 5. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`（这一页只吃 `view` 与
 *    `ui` 两格），入口在它之后；`assets/js/toolJson.min.js` 里已经打进 `jsonView.js`，绝不再挂进
 *    `Tk`——两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，而它不补
 * `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。产物名必须与页面里 `<script src>`
 * 那一段逐字符一致（`toolJson.min.js`）。启动方式与 `webLab.js` 同档——脚本排在正文之后，解析
 * 到这一行时骨架节点已经存在，不接 `DOMContentLoaded`。
 */
import { createJsonWorkbench, JSON_PANEL_IDS } from './tools/jsonWorkbench.js';

/** 容器 id：`tools-json.html` 里 `id="{{ jt.prefix }}-workspace"` 在 `prefix: jt` 下的落值 */
const CONTAINER_ID = 'jt-workspace';
/** 提示行 id：坏消息与启动失败共用这一格 */
const NOTICE_ID = 'jt-notice';

/** 骨架上那四格数据的属性名（前缀 `jt` 同上，是本页的地址，不是行为里的前缀） */
const ATTR = { ids: 'data-jt-ids', prefix: 'data-jt-prefix', label: 'data-jt-label', notice: 'data-jt-notice' };

/**
 * 取提示行节点：容器在就读 `data-jt-notice`，容器不在或那一格空着就回落到 `NOTICE_ID`。
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
 * `data-jt-ids` → 面板清单。逗号分隔、允许空格、丢掉空项。
 * @param {string} raw 属性原文
 * @returns {string[]} 至少一项，空数组由调用侧判成错误
 */
function parseIds(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * 抛出来的东西形状千奇百怪（`throw 'x'`、`throw {message: 42}`），页面上只能有一行可读的句子：
 * 优先取 `message`，取不到就 `String()` 一次；空 `message` 退回名字。
 * @param {unknown} err 捕获到的东西
 * @returns {string}
 */
function messageOf(err) {
  const m = err && typeof err.message === 'string' ? err.message : '';
  if (m !== '') return m;
  const name = err && typeof err.name === 'string' ? err.name : '';
  if (name !== '') return name;
  return String(err);
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `localStorage` / `navigator` / `Blob`）
 * @param {object} tk `window.Tk`（这一页只吃 `view` 与 `ui`）
 * @returns {object} `createJsonWorkbench().mount()` 的那两份清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-json.html 末尾那段注释`);
  }
  const ids = parseIds(box.getAttribute(ATTR.ids));
  if (ids.length === 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 是空的：这一页的面板清单只有 ${JSON_PANEL_IDS.join(' / ')}，_data/onlineTools.yml 的 panels 是不是漏了 slug？`);
  }
  const unknown = ids.filter((id) => JSON_PANEL_IDS.indexOf(id) < 0);
  if (unknown.length > 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 里有装配层不认识的面板：${unknown.join(' / ')}；这一页只有 ${JSON_PANEL_IDS.join(' / ')}。`);
  }
  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'jt';
  const label = String(box.getAttribute(ATTR.label) || '').trim();
  const notice = noticeNode(doc, box);
  if (!tk || !tk.view || typeof tk.view.esc !== 'function'
    || !tk.ui || typeof tk.ui.copyInto !== 'function') {
    throw new RangeError(
      'window.Tk 没挂上来（或 view.esc 与 ui.copyInto 缺了谁）：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-json.html 末尾');
  }

  /** 提示行：`null` 撤回到"没话要说"。只走 `textContent`——入口这一层不拼任何标记 */
  const setNotice = (text) => {
    if (!notice) return;
    if (text === null) { notice.hidden = true; notice.textContent = ''; return; }
    notice.hidden = false;
    notice.textContent = text;
  };
  /** 口径 3：只有本层写坏过的那一句才由本层撤，别把启动失败那句话清成空白 */
  let broken = false;
  const blockName = label === '' ? CONTAINER_ID : label;
  const runGuarded = (id, fn) => {
    try {
      fn(doc.getElementById(id));
      if (broken) { broken = false; setNotice(null); }
      return true;
    } catch (err) {
      broken = true;
      setNotice(`${blockName}里的一次操作没能跑完：${messageOf(err)}。其余部分照常可用。`);
      return false;
    }
  };
  // 隐私模式下访问 `localStorage` 本身就会抛：那一格取不到就是"这台浏览器不给存"（W15 置灰那一条）
  let store = null;
  try { store = win.localStorage; } catch { store = null; }

  const wb = createJsonWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded,
    storage: store,
    navigator: win.navigator,
    now: () => Date.now(),
    later: (fn, ms) => setTimeout(fn, ms),
    BlobCtor: win.Blob,
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
  });
  return wb.mount();
}

/**
 * 启动一次，并把失败写进页面上那句话。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`
 * @returns {object|undefined} 成功时是 `mount()` 的两份清单，失败时 `undefined`（但仍会抛）
 */
function start(doc, win) {
  try {
    return boot(doc, win, win.Tk);
  } catch (err) {
    const el = noticeNode(doc, doc.getElementById(CONTAINER_ID));
    if (el) {
      el.hidden = false;
      el.textContent = `这一页的交互层没能启动：${messageOf(err)}。正文仍然读得到，只是按钮与下拉不会有反应。`;
    }
    throw err;
  }
}

start(document, window);
