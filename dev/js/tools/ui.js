/**
 * 工具箱的界面小工具第一档：**把一栏结果复制到剪贴板**这件事的三级兜底。
 *
 * 为什么单独一本文件：证件页、编码工具箱页、JSON 页都要"把这栏的纯文本复制走"，而这句话在
 * 浏览器里不是一句 API 就能写完的事——`navigator.clipboard` 在非安全上下文（http 页面）缺席、
 * 被权限策略拒绝时异步 reject、个别环境下直接同步抛（连 Promise 都不返回），三条路都走完才算
 * 试过。段 2 它长在 `workbench.js` 里（那时只有证件页要），段 3 Task 5 抽出来给三页共用。
 *
 * 三条口径，§O 的判据逐条对着咬：
 *
 * 1. **只搬不改行为**。`legacyCopy`、两条时长、四句文案（`已复制` / `复制失败，请手动选中`）
 *    逐字符照搬段 2 落地的那一份，兜底顺序与早退条件也一样；页面接线仍由 §J 那十六判兜着，
 *    J7 的九个小节就是这次搬迁的回归网。
 * 2. **零 import、零宿主全局**（§O2）。`doc` / `clipboard` / `later` 一律由调用方注入，
 *    所以这一本能在 §I 那份假 DOM 下逐条测。它同时是 `toolkitCore.js` 把 `ui` 挂进
 *    `window.Tk` 的前提：一旦它 import 了别的东西，两个页面入口就各 reach 一份，产物立刻
 *    变成带 `import{` 的废文件（实测记录在 `dev/js/toolkitCore.js` 开头）。
 * 3. **任何一级都不许抛到页面外面**。剪贴板被拒绝是浏览器的正常行为，"用户按了没反应"才是
 *    缺陷；每一级的失败都收敛成一句文案与一条恢复用的定时回调（O8、O9 分别咬两处抛点）。
 *
 * 与 `view.js` 的分工：`view` 出**结果 HTML**（纯字符串），这一本碰的是**按钮文案与临时节点**，
 * 两者互不 import。`COPY_LABEL`（面板 → 复制按钮的原文案）留在 `workbench.js`——那是页面骨架
 * 里的事，不是"复制"这件事的一部分；改口之后要还原成哪一句，由调用方说了算（O4）。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §O 十三判，加上 §J 的 J7 原样全绿。
 */

/** 复制按钮改口"已复制"之后多久恢复原文案（毫秒）；只有 `copyInto` 读这两条时长，不抽 token */
export const COPY_RESET_MS = 1600;

/** 复制失败后的提示停留时长，比成功的那句长一点：那句要被人读到才会去手动选中文本 */
export const COPY_FAIL_MS = 2600;

/**
 * 按钮文案的临时改口：失败与成功走同一处，恢复时长不同（成功那句不需要读）。
 * @param {object} btn 要改口的按钮，只需 `textContent` 可写
 * @param {string} text 改口成哪一句
 * @param {number} ms 停留多久，原样透传给 `later`，这一层不替页面决定时长
 * @param {string} original 恢复成哪一句：由调用方记下（见 `workbench.js` 的 `COPY_LABEL`），
 *   不取当前 `textContent`——连点两次时当前那句正是"已复制"，取它就等于永远停在改口状态
 * @param {(fn: () => void, ms: number) => number} [later] `setTimeout` 的别名，测试里换成
 *   同步执行；不给就落回宿主那一只（全文件唯一一处读宿主计时器，§O2 数着它）
 * @returns {void}
 */
export function flash(btn, text, ms, original, later) {
  btn.textContent = text;
  const at = typeof later === 'function' ? later : (fn, delay) => setTimeout(fn, delay);
  at(() => { btn.textContent = original; }, ms);
}

/**
 * `navigator.clipboard` 不可用时的兜底：临时 textarea + `execCommand('copy')`。
 * 只在 http 或用户未授予剪贴板权限时走到这里，用完立刻摘掉节点——留在 DOM 里就是
 * 一个能被 Tab 走到的隐形输入框。
 * @param {object} doc 提供 `createElement` / `body.appendChild` / `body.removeChild`
 * @param {string} text 要复制的文本
 * @returns {boolean} 有没有真的复制上
 */
export function legacyCopy(doc, text) {
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
 * 复制一段文本，三级兜底：`navigator.clipboard` → 临时 `<textarea>` + `execCommand` →
 * 一句"请手动选中"。任何一级都不许抛到页面外面：剪贴板被权限策略拒绝是浏览器的正常行为，
 * 用户按了没反应才是缺陷。
 *
 * 早退那一道（`btn` 缺席或 `text` 为空）与调用方 `workbench.js` 的同一条判断**故意重复**：
 * codec 页要直接调这一句，那时没有人替它判空。摘掉它的后果是"按一条还没内容的复制按钮
 * → 剪贴板是空的、按钮却报了'已复制'"。
 *
 * @param {object} args 一次复制的全部输入，全部由调用方注入
 * @param {object} [args.btn] 按钮；缺席就早退（没地方改口）
 * @param {string} [args.text] 要复制的纯文本；空串或没给都早退
 * @param {string} [args.original] 按钮的原文案，改口之后还原成它
 * @param {{writeText?: (t: string) => Promise<void>}} [args.clipboard] `navigator.clipboard`，
 *   没有这只手、或有手却没有 `writeText` 那根手指，都直接走兜底
 * @param {object} args.doc 传给 `legacyCopy` 的 `document`
 * @param {Function} [args.later] 透给 `flash` 的定时器别名
 * @returns {void}
 */
export function copyInto({ btn, text, original, clipboard, doc, later } = {}) {
  if (!btn || !text) return;
  const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中',
    ok ? COPY_RESET_MS : COPY_FAIL_MS, original, later);
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
}
