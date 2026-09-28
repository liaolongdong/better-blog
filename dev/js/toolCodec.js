/**
 * 编码页入口：只读骨架里那四格 `data-tk-*`，把框架（`window.Tk`）、装配层
 * （`createCodecWorkbench`）与本页接起来。与 `toolIdcard.js` 同形，差异只在装配层多收三样注入。
 *
 * 这个文件和证件页那份一样刻意薄：找容器、读配置、按顺序接线，业务一条都不写。写进
 * `codecWorkbench.js` 的 spec 与 `codecView.js` 的渲染函数里才有判据可咬（§R 与 §Q 的分工）。
 *
 * 五条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `tk` 是**本页自己的
 *    地址**（`tools-codec.html` 的骨架写死它，与证件页那一份同名但不同页）；行为里用的前缀
 *    从 `data-tk-prefix` 读，一路传给 `createPanelWorkspace` 与 `createCodecWorkbench`，
 *    控件 id 才跟着 `CODEC_SPEC` 换得动（R16 的 `zx` 那一档量的就是这件事）。
 * 2. **装配层不读环境，环境只在这一格读一次**。时钟与本地时区偏移由这里注入：
 *    `now: () => Date.now()` 与 `offsetMinutes: -new Date().getTimezoneOffset()`，
 *    全仓库各只此一处（R3 用同一把尺子反过来量装配层：那边五个词一个都不许出现）。
 *    理由与 §K 同源——"相对时间那一行"和"本地那一行"必须可复算，否则同一份产物在
 *    两台机器、两个 CI runner 上给出两个答案，而 §R 的每一判都指望它只有一个。
 *    `crypto.subtle` 也照这一条走：页面里取得到就递进去，取不到就递 `null`（那是
 *    "确实没有"，摘要面板据此把 SHA 四格标成"环境不支持"），不让装配层自己去找。
 * 3. **`runGuarded` 晚绑**。`createCodecWorkbench` 在构造时就把 `env.runGuarded` 收进闭包常量，
 *    而能当它的那只（`createPanelDom().run`）要等装配层交出 renderers 之后才存在——循环。
 *    所以递过去的是一个箭头，它在**调用时**才去 `guard.run` 上取：占位函数永远不可能被真的
 *    调到，因为按钮回调只在 `mount()` 之后才挂得上。
 * 4. **启动失败不装死**。抛出之前尽力把那句话写进 `#tk-notice`（只走 `textContent`），因为
 *    脚本 404 或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样：正文全在、
 *    按钮按不出东西。给一句能抄下来问人的话，比只在控制台红一次强。容器本身找不到时没地方写，
 *    那就只剩控制台，这也是这一条只写"尽力"的原因。
 * 5. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`（四只：
 *    `createPanelWorkspace` / `createPanelDom` / `view` / `ui`），入口在它之后；编码页**多引一本**
 *    `assets/js/toolCodec.min.js`，而 `codecView.js` 已经打进这一本里，绝不再挂进 `Tk`——
 *    两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，
 * 而它不补 `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。产物名必须与页面里
 * `<script src>` 那一段逐字符一致（`toolCodec.min.js`，§6.1 那条大小写教训）。启动方式与
 * `webLab.js` 同档——脚本排在正文之后，解析到这一行时面板节点已经存在，不接 `DOMContentLoaded`。
 */
import { createCodecWorkbench } from './tools/codecWorkbench.js';

/** 容器 id：`tools-codec.html` 里 `id="{{ tk.prefix }}-workspace"` 在 `prefix: tk` 下的落值 */
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
 * `crypto.subtle` 的三档读法：取得到就传对象，明确取不到就传 `null`（不是"没注入"）。
 * 非安全上下文（http 站点、本地 `file://`）里 `crypto` 在而 `subtle` 是 undefined，
 * 这一档必须落成"环境不支持"那四格，而不是让装配层以为没人管它。
 * @param {object} win 真 `window`
 * @returns {object|null} `SubtleCrypto` 或 `null`
 */
function subtleOf(win) {
  const subtle = win.crypto ? win.crypto.subtle : null;
  return subtle && typeof subtle.digest === 'function' ? subtle : null;
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `location` / `history` / `navigator` / `crypto`）
 * @param {object} tk `window.Tk`
 * @returns {object} `createPanelDom().mount()` 的那四个清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-codec.html 末尾那段注释`);
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
    || typeof tk.createPanelDom !== 'function' || !tk.view || !tk.ui) {
    throw new RangeError(
      'window.Tk 没挂上来（或四只缺了谁）：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-codec.html 末尾');
  }

  const workspace = tk.createPanelWorkspace({
    ids,
    prefix,
    hash: win.location.hash,
    label: label === '' ? undefined : label,
  });
  /** 口径 3 的那个占位：谁真调到它，就是有人在 `mount()` 之前按了按钮 */
  const guard = {
    run: () => {
      throw new RangeError('装配层还没接上 createPanelDom().run，按钮回调跑早了');
    },
  };
  const wb = createCodecWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded: (id, fn) => guard.run(id, fn),
    navigator: win.navigator,
    now: () => Date.now(),
    offsetMinutes: -new Date().getTimezoneOffset(),
    subtle: subtleOf(win),
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
