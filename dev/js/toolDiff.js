/**
 * 文件对比页入口（段 5 Task 5；§Z 后半）：只读骨架里那四格 `data-df-*`，把框架（`window.Tk`）、
 * 装配层（`createDiffWorkbench`）与本页接起来。与 `toolJson.js` 同形，差异有四处——这一页只有
 * 一块工作区（不经过 `createPanelDom`）、这一页**没有存储**（不做"记住上次输入"）、这一页多
 * 两只读文件的手，以及 `runGuarded` 由这一本自己给。
 *
 * 六条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `df` 是**本页自己的地址**
 *    （`tools-diff.html` 的骨架写死它）；行为里用的前缀从 `data-df-prefix` 读，一路传给装配层，
 *    控件 id 与显隐段才跟着换得动（Z28 的 `zx` 那一档量的就是这件事）。
 * 2. **环境只在这一本读，每样恰好一次**（Z15 数的是出现次数）。`setTimeout`、剪贴板、下载那三件、
 *    行高，加上本页独有的 `FileReader` 与 `TextDecoder`，全从这里注入；装配层那十六个词一个都不许
 *    出现（Z14）。理由是同一份产物在两台机器、两个 CI runner 上只能给一个答案，而 §Z 的每一判
 *    都指望它只有一个。
 *    行高（`--df-row-h`）也在这一本读：它是**样式**给的环境量，读一次就注入一次（`env.rowHeight`），
 *    装配层里因此不许出现 `getComputedStyle`——那一只假件一旦要进 §Z 的夹具，"不读环境"这条红线
 *    就从判据退化成了注释。
 * 3. **文件那两件事拆成两只手，而不是一只**。`readFile` 只管把字节搬进内存，`decode` 只管判编码：
 *    装配层要在**读之前**按 `file.size` 拒掉超限那一份（五 MiB 不该先进内存再说"不行"），所以
 *    `{name, size}` 这个形状必须能被它单独看到；把两件事并成一只 `readAsText`，那一档拒绝就
 *    只能发生在读完之后。`decode` 用 `fatal: true`——非 UTF-8 要当场失败，不能让 `TextDecoder`
 *    悄悄把坏字节换成 `U+FFFD` 再交上去（那样"读得成但不是文本"与"读不成"在页面上就成了同一档）。
 *    `instanceof` 那一句留在这一本：那是**宿主类型判断**，装配层里出现一次就违反红线（Z14 词表里
 *    那两枚 `FileReader` 与 `instanceof` 说的是同一件事）。
 * 4. **`runGuarded` 由入口给**。装配层只负责"抛出来"，记不记、记在哪儿是页面这一侧的事：这一页没有
 *    面板错误条（那块区域就是整页），所以坏消息写进 `#df-notice` 那一句，下一次跑成功就撤掉。
 *    只有本层写过的句子本层才撤——那格提示行也用于启动失败，别把别人的话清成空白。
 * 5. **启动失败不装死**。抛出之前尽力把那句话写进 `#df-notice`（只走 `textContent`），因为脚本 404
 *    或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样：正文全在、按钮按不出东西。
 * 6. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`（这一页只吃 `view` 那一格），
 *    入口在它之后；`assets/js/toolDiff.min.js` 里已经打进 `diffView.js` 与两本算法，绝不再挂进 `Tk`——
 *    两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，而它不补
 * `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。产物名必须与页面里 `<script src>`
 * 那一段逐字符一致（`toolDiff.min.js`）。启动方式与 `webLab.js` 同档——脚本排在正文之后，解析
 * 到这一行时骨架节点已经存在，不接 `DOMContentLoaded`。
 */
import { createDiffWorkbench, DIFF_PANEL_IDS } from './tools/diffWorkbench.js';

/** 容器 id：`tools-diff.html` 里 `id="{{ df.prefix }}-workspace"` 在 `prefix: df` 下的落值 */
const CONTAINER_ID = 'df-workspace';
/** 提示行 id：坏消息与启动失败共用这一格 */
const NOTICE_ID = 'df-notice';

/** 骨架上那四格数据的属性名（前缀 `df` 同上，是本页的地址，不是行为里的前缀） */
const ATTR = { ids: 'data-df-ids', prefix: 'data-df-prefix', label: 'data-df-label', notice: 'data-df-notice' };

/**
 * 取提示行节点：容器在就读 `data-df-notice`，容器不在或那一格空着就回落到 `NOTICE_ID`。
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
 * `data-df-ids` → 面板清单。逗号分隔、允许空格、丢掉空项。
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
 * 把本地文件读成字节。**只做搬运**：编码一句不判（那是 `decode` 的事），大小一句不提（那是装配层
 * 在调用之前就办完的事）。`instanceof` 这一格是本页唯一的宿主类型判断——`DataTransfer.files` 与
 * `input.files` 给的都是真 `File`，而有人从别处塞进来一个 `{name, size}` 的假对象时，宁可在这一本
 * 当场说清"这不是一个文件"，也不要让 `FileReader` 在下一行抛一句读不出主语的 `TypeError`。
 * @param {object} win 真 `window`
 * @param {unknown} file 那一个候选
 * @returns {Promise<Uint8Array>}
 */
function fileReaderOf(win) {
  return (file) => new Promise((resolve, reject) => {
    if (!(file instanceof win.File)) {
      reject(new TypeError('这不是本机的一份文件（拖放被浏览器的隐私设置拦住，或那一格给的不是文件）'));
      return;
    }
    const fr = new win.FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(new Error(`读不了「${file.name}」：这一页不上传，坏的是本地那一次的读取`));
    fr.readAsArrayBuffer(file);
  });
}

/**
 * UTF-8 那一道闸。`fatal: true` 是这一格的全部意义：非 UTF-8 当场抛，而不是悄悄换成 `U+FFFD` 交上去
 * ——那样"这份文件读不成"与"这份文件是文本但编码不对"在页面上就成了同一档，而装配层给用户的
 * 那句"存成 UTF-8 再选一次"正是靠这两档的分别才说得出口。
 * @param {object} win 真 `window`
 * @param {Uint8Array} bytes 读回来的字节
 * @returns {{ok: boolean, text: string}}
 */
function decodeOf(win) {
  return (bytes) => {
    try {
      return { ok: true, text: new win.TextDecoder('utf-8', { fatal: true }).decode(bytes) };
    } catch {
      return { ok: false, text: '' };
    }
  };
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `FileReader` / `TextDecoder` / `Blob` / `navigator`）
 * @param {object} tk `window.Tk`（这一页只吃 `view` 那一格）
 * @returns {object} `createDiffWorkbench().mount()` 的那两份清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-diff.html 末尾那段注释`);
  }
  const ids = parseIds(box.getAttribute(ATTR.ids));
  if (ids.length === 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 是空的：这一页的面板清单只有 ${DIFF_PANEL_IDS.join(' / ')}，_data/onlineTools.yml 的 panels 是不是漏了 slug？`);
  }
  const unknown = ids.filter((id) => DIFF_PANEL_IDS.indexOf(id) < 0);
  if (unknown.length > 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 里有装配层不认识的面板：${unknown.join(' / ')}；这一页只有 ${DIFF_PANEL_IDS.join(' / ')}。`);
  }
  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'df';
  const label = String(box.getAttribute(ATTR.label) || '').trim();
  const notice = noticeNode(doc, box);
  if (!tk || !tk.view || typeof tk.view.esc !== 'function') {
    throw new RangeError(
      'window.Tk 没挂上来（或 view.esc 缺了）：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-diff.html 末尾');
  }

  /** 提示行：`null` 撤回到"没话要说"。只走 `textContent`——入口这一层不拼任何标记 */
  const setNotice = (text) => {
    if (!notice) return;
    if (text === null) { notice.hidden = true; notice.textContent = ''; return; }
    notice.hidden = false;
    notice.textContent = text;
  };
  /** 口径 4：只有本层写坏过的那一句才由本层撤，别把启动失败那句话清成空白 */
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

  /**
   * 行号那一格的行高（`--df-row-h`）：**权威在样式里，这一本只读一次**（段 5 计划 Task 5 的口径 2）。
   * `dev/sass/toolDiff.scss` 在容器上写 `--df-row-h`，跳转那一枚换算 `scrollTop` 与样式那边的行块
   * 高度要的是同一个整数；读不到、或读出来不是「≥1 的整数像素」就退回 24——那个 24 就是装配层
   * `ROW_HEIGHT` 的值，两边同源靠的是 `env.rowHeight` 那一道闸门（给了非法值当场 `RangeError`），
   * 不是靠注释约定。
   * @returns {number} 整数像素
   */
  const rowHeightPx = () => {
    let raw = '';
    try { raw = String(win.getComputedStyle(box).getPropertyValue('--df-row-h') || '').trim(); } catch { raw = ''; }
    const m = /^(\d+)px$/.exec(raw);
    const v = m ? Number(m[1]) : NaN;
    return Number.isInteger(v) && v >= 1 ? v : 24;
  };

  const wb = createDiffWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded,
    navigator: win.navigator,
    later: (fn, ms) => setTimeout(fn, ms),
    rowHeight: rowHeightPx(),
    readFile: fileReaderOf(win),
    decode: decodeOf(win),
    // 这三件必须给**工厂**，不能给裸构造器：装配层按 `env.BlobCtor(parts, options)` 的写法调用它
    //（Z14 的红线之一「本层不写 `new Blob`」），而 `Blob` 是 WebIDL 接口，不带 `new` 直接调在浏览器里
    // 必抛 `TypeError: Failed to construct 'Blob'`。§Z 的假 DOM 给的是箭头函数，所以那二十七判一条
    // 都抓不到这件事——真浏览器里点「下载 .diff」就是那一行红字，而页面上没有任何一次下载发生过。
    BlobCtor: (parts, options) => new win.Blob(parts, options),
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
