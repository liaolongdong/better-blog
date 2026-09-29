/**
 * JSON 工作台输出区的视图层（段 4 Task 6；设计文档 §5.3 的「结果区」与「树视图那一行」）。
 *
 * 这一本只做一件事：把已经算好的读数与行对象**拼成 HTML 串**。它不算任何东西，也不碰任何节点——
 * 拼出来的串由装配层那一唯一的 `innerHTML` 出口写进页面，树行的那一串则由 §V 控制器的 `renderRow`
 * 钩子写进行元素。这么分之后，"什么样的文本会变成标记"这一件事在全仓库只有一个答案，
 * 而那个答案就是这里的 `esc`。
 *
 * 三条口径：
 *
 * 1. **零 import**（W2）。它与 `view.js` / `codecView.js` 同一条红线：一旦这本 import 了什么，
 *    `toolJson.js` 与 `toolkitCore.js` 就同时 reach 那个模块，Rollup 切出共享 chunk，
 *    `iifeWrapPlugin` 包完的产物里留下 `import{…}`——整页 SyntaxError 而构建 exit=0。
 *    转义与空格占位从 `window.Tk.view` 注入（`{ esc, EMPTY_CELL }`），构造期闸门点名缺了哪一件。
 * 2. **写死的词表只有三张**（W1、W4、W5）。`JT_TONES` 四档语义色、`OUT_KINDS` 五类结果、
 *    `JSON_VIEW_LABELS` 两档视图名。白名单外的词一律抛，而不是静默渲成一栏没有头的东西——
 *    「按钮表里把 kind 写错了」这种事故要停在开发期，不该变成页面上一个说不出哪儿不对的空块。
 * 3. **只读它该读的格子**（W8）。`statsLine` 只吃那七个名字，模块以后往 stats 里加读数
 *    不会让这一行静默变样；`errBlock` 只吃 error 那七格加一份三行上下文，
 *    上下文由装配层从 `lineRange` 取——这本不 import 那把尺，所以位置信息只能递进来。
 *
 * 树行那一件（`treeRow`）与 §V 的控制器分工写在 W7：缩进、`role`、`aria-level`、`data-jt-id`
 * 全在控制器（那些是结构事实），这一件只管行内的三角、键名、值与 Pointer 复制按钮。
 * 两边合起来仍然守同一条红线：**用户的数据永远只出现在 `esc` 之后**。
 */

/** 语义色四档：装配层每次算完挑一格，样式只认这四个词（W5） */
export const JT_TONES = ['ok', 'warn', 'bad', 'idle'];
/** 视图两档的显示名：树 / 文本是同一份数据的两种读法，不是两个面板 */
export const JSON_VIEW_LABELS = { text: '文本', tree: '树' };
/** 结果区顶部那一格的类别白名单：按钮表里的 `kind` 只能取这五个词（W4） */
export const OUT_KINDS = ['json', 'ts', 'yaml', 'xml', 'csv'];

const CONTAINER_KINDS = { object: true, array: true };

/**
 * 那一栏"只有一句话"的三档：还没算过（`empty`）、这一格不能用（`hint`）、结果太长拒进 DOM（`refuse`）。
 * 三档共用一个形状，差别只在 class 与语义色，所以词表写在视图层：装配层那一本不许手打 `jt-` 串
 * （W10 数的是源码里 `'jt-` 的出现次数），它只挑这三档里的哪一个。
 */
const OUT_LINE_KINDS = { empty: 'jt-empty', hint: 'jt-hint', refuse: 'jt-refuse' };

/** 这一件收到的东西不像样子就说清是哪一格不像：视图层的静默空格是最难查的"页面没坏但少了东西" */
const shape = (value) => (value === null ? 'null' : Array.isArray(value) ? '数组' : typeof value);

/**
 * 造出这一页的那九件生成器。
 * @param {{esc: Function, EMPTY_CELL: string}} view `window.Tk.view` 里的那一份（只用到两格）
 * @returns {{esc: Function, tone: Function, resultHead: Function, statsLine: Function, errBlock: Function,
 *   noteLines: Function, emptyHint: Function, treeRow: Function, treePad: Function}}
 * @throws {TypeError} 注入缺件，或某一件的入参不在白名单里
 */
export function createJsonView(view) {
  if (!view || typeof view !== 'object') {
    throw new TypeError(`createJsonView：第一格应是 window.Tk.view 那份 { esc, EMPTY_CELL }，这里是 ${shape(view)}`);
  }
  if (typeof view.esc !== 'function') {
    throw new TypeError(`createJsonView：view.esc 应是 view.js 里那只转义函数，这里是 ${shape(view.esc)}（缺它的下场是用户文本被当标记插进结果区）`);
  }
  if (typeof view.EMPTY_CELL !== 'string' || view.EMPTY_CELL === '') {
    throw new TypeError('createJsonView：view.EMPTY_CELL 应是一个占得住一格的字符串，缺它"没有值"与"值为空"就混成了同一格');
  }
  const esc = view.esc;

  /** 四档语义色 → class 后缀；第五个词抛（W5） */
  const tone = (name) => {
    if (!JT_TONES.includes(name)) {
      throw new TypeError(`tone：档位只认 ${JT_TONES.join(' / ')}，这里是 ${String(name)}（多一档意味着样式那边没人认识这个颜色）`);
    }
    return `jt-tone--${name}`;
  };

  /**
   * 结果区顶部那一行：类别 + 标题 + 那一句补充。
   * `note` 缺席时那一格整个不长，不是长一条空白——读起来像"这里本来有字，后来没了"。
   * @param {{kind: string, tone: string, title: string, note?: string}} o 三格必填
   * @returns {string}
   */
  const resultHead = (o) => {
    if (!o || typeof o !== 'object') throw new TypeError(`resultHead：只收 { kind, tone, title, note } 这一个对象，这里是 ${shape(o)}`);
    if (!OUT_KINDS.includes(o.kind)) {
      throw new TypeError(`resultHead：kind 只认 ${OUT_KINDS.join(' / ')}，这里是 ${String(o.kind)}（白名单外的词不许静默渲成一栏没头的结果）`);
    }
    const toneCls = tone(o.tone);
    if (typeof o.title !== 'string' || o.title === '') {
      throw new TypeError(`resultHead：title 应是非空字符串，这里是 ${shape(o.title)}（没有标题的那一栏读不出这是哪一次结果）`);
    }
    const note = typeof o.note === 'string' && o.note !== ''
      ? `<span class="jt-out__note">${esc(o.note)}</span>` : '';
    return `<div class="jt-out__head" data-jt-kind="${o.kind}">`
      + `<span class="jt-out__kind ${toneCls}">${o.kind}</span>`
      + `<strong class="jt-out__title">${esc(o.title)}</strong>${note}</div>`;
  };

  /**
   * 那一行读数。**只**读这七个名字，其余一律不看（W8）：模块以后往 stats 里加一格，
   * 这一行的形状不许跟着变。缺的那一格给 0，不给 `—`——"这一份里没有一个键"是事实，不是没测出来。
   *
   * 出去的是带类名的那一格，不是裸文本（评审 P3-11 顺带的一格）：装配层那一头的 `bodyBlock` 已经在页面
   * 上写了 `<pre class="jt-out__body">`，读数这一行要是只给一串字，它就得**自己再手打一个类名**才能排版——
   * 而类名的词汇表只有这一本知道。数字都是 `Number.isFinite` 的读数，串里没有标记，所以不过 `esc`。
   * @param {object} stats `json-core.js` 的 stats 那一份
   * @returns {string} `<p>` 块
   */
  const statsLine = (stats) => {
    if (!stats || typeof stats !== 'object') throw new TypeError(`statsLine：只收 stats 那个对象，这里是 ${shape(stats)}`);
    const n = (key) => (Number.isFinite(stats[key]) ? stats[key] : 0);
    return `<p class="jt-out__stats">字节 ${n('bytes')} · 行 ${n('lines')} · 节点 ${n('nodes')} · 深度 ${n('depth')} · `
      + `键 ${n('keys')} · 数组项 ${n('arrayItems')} · 最长串 ${n('longestStringChars')}</p>`;
  };

  /**
   * 坏输入的行列 + 三行等宽读条 + 那一句怎么办。
   * 行列单独说一句，插入符再落在等宽块里：让用户在等宽字里数第几列是替机器做活。
   * `prev` / `next` 是空串时那一行整个不拼（首行没有上一行，末行没有下一行）。
   *
   * `ctx.caret` 是可选的**第三把尺**（评审 P2-6 带出来的）：那一栏只给得出病灶左右各 120 码元的窗口，
   * 窗口里的列号与原文里的列号就不是一回事了。没有这一格时调用方只能改 `err.column` 去对插入符，
   * 代价是那句"第 N 行第 M 列"跟着一起换成窗口里的相对列——而能抄去 `jq` 的只有原文里的那一列。
   * 现在两把尺各归各：`err.column` 说给用户听，`ctx.caret` 只管插入符落在哪一格。
   * @param {{message: string, line: number, column: number, kind?: string}} err `parseJson` 的 error
   * @param {{prev: string, at: string, next: string, select: boolean, caret?: number}} ctx 三行上下文
   * @returns {string}
   */
  const errBlock = (err, ctx) => {
    if (!err || typeof err !== 'object') {
      throw new TypeError(`errBlock：第一格应是 parseJson 交出来的那个 error，这里是 ${shape(err)}`);
    }
    if (!ctx || typeof ctx !== 'object') {
      throw new TypeError('errBlock：第二格应是 { prev, at, next, select }，没有上下文就拼不出读条（宁可抛，也别渲一行 undefined）');
    }
    const where = `第 ${err.line} 行第 ${err.column} 列`
      + (typeof err.kind === 'string' && err.kind !== '' ? ` · ${err.kind}` : '');
    const at = Number.isInteger(ctx.caret) && ctx.caret >= 0
      ? ctx.caret
      : (Number.isInteger(err.column) && err.column > 1 ? err.column - 1 : 0);
    const caret = ' '.repeat(at);
    const lines = [ctx.prev, ctx.at, `${caret}^`, ctx.next].filter((s) => s !== undefined && s !== '');
    const act = ctx.select === true ? '<p class="jt-err__act">↔ 已在输入区选中那一处。</p>' : '';
    return `<div class="jt-err"><p class="jt-err__where">${esc(where)}</p>`
      + `<pre class="jt-err__ctx">${esc(lines.join('\n'))}</pre>`
      + `<p class="jt-err__msg">${esc(err.message)}</p>${act}</div>`;
  };

  /**
   * 代价说明那一族：同句只留一条，顺序按给进来的走，逐条转义。
   * 不是数组就当"没有话要说"（返回空串），因为这几句是附加说明，不是结果本身。
   * @param {string[]|null|undefined} list 备注串清单
   * @returns {string} `<ul>` 或空串
   */
  const noteLines = (list) => {
    if (!Array.isArray(list)) return '';
    const seen = new Set();
    let out = '';
    for (const raw of list) {
      const text = String(raw);
      if (text.trim() === '' || seen.has(text)) continue;
      seen.add(text);
      out += `<li>${esc(text)}</li>`;
    }
    return out === '' ? '' : `<ul class="jt-notes">${out}</ul>`;
  };

  /**
   * 那一栏只有一句话时的形状（三档见 `OUT_LINE_KINDS`）。第四档抛：超限那一行静默渲成空态，
   * 用户读到的是"这页什么都没发生"，而实情是"这一格被闸门挡了"。
   * @param {'empty'|'hint'|'refuse'} kind 档位
   * @param {string} text 那一句
   * @returns {string}
   */
  const stateLine = (kind, text) => {
    const cls = OUT_LINE_KINDS[kind];
    if (!cls) {
      throw new TypeError(`stateLine：档位只认 ${Object.keys(OUT_LINE_KINDS).join(' / ')}，这里是 ${String(kind)}（样式那边没有这一档的颜色，渲出来是一行没有样式的字）`);
    }
    if (typeof text !== 'string') throw new TypeError(`stateLine：只收一句话，这里是 ${shape(text)}`);
    return `<p class="${cls}">${esc(text)}</p>`;
  };

  /**
   * 那一栏只有一句话的形状——三档共用这一只（`empty` / `hint` / `refuse`，见 `OUT_LINE_KINDS`）。
   * 默认档是 `empty`（"还没算过"与"算完是空"），装配层要提示"这一格不能用"就递 `'hint'`、
   * 要报"被闸门挡在门外"就递 `'refuse'`：类名只有这一本知道，装配层只挑档位，不手打 `jt-` 串（W10）。
   * @param {string} text 那一句
   * @param {'empty'|'hint'|'refuse'} [kind] 档位，默认 `empty`
   * @returns {string}
   */
  const emptyHint = (text, kind = 'empty') => stateLine(kind, text);

  /**
   * 一行的行内 markup。分工写在文件头：结构归 §V 的控制器，内容归这一件。
   * 三处刻意的"不长"：截断行与根行没有 Pointer 复制按钮（前者点不出地址，后者的地址就是整份数据），
   * 展开中的容器不给概览串（那一格改报"几项 / 几键"），空键渲染成一对引号而不是看不见。
   * @param {object} row §V 的十二格行对象
   * @returns {string}
   */
  const treeRow = (row) => {
    if (!row || typeof row !== 'object') throw new TypeError(`treeRow：只收 §V 的那一行十二格，这里是 ${shape(row)}`);
    const more = row.pointer === '' && row.id !== '';
    const container = CONTAINER_KINDS[row.kind] === true && !more;
    const tri = container
      ? `<span class="jt-tree__tri" data-jt-tri="${row.expanded ? 'open' : 'closed'}" aria-hidden="true">${row.expanded ? '▾' : '▸'}</span>`
      : '<span class="jt-tree__tri" data-jt-tri="leaf" aria-hidden="true"></span>';
    const keyText = more ? row.display : (row.depth === 0 ? '根' : (row.keyLabel === '' ? '""' : row.keyLabel));
    const keyCls = row.matched === true ? 'jt-tree__key is-matched' : 'jt-tree__key';
    let val = '';
    if (!more) {
      const body = container && row.expanded
        ? `${row.childCount} ${row.kind === 'array' ? '项' : '键'}`
        : esc(row.display);
      val = `<span class="jt-tree__val">${body}</span>`;
    }
    const copy = row.pointer === '' ? ''
      : `<button class="jt-tree__copy" type="button" data-jt-copy="${esc(row.pointer)}" aria-label="复制这一格的 Pointer">Pointer</button>`;
    return `${tri}<span class="${keyCls}">${esc(keyText)}</span>${val}${copy}`;
  };

  /**
   * 上/下垫块的高度串。行数与行高都是整数档，出现小数就把滚动条总长算歪（§V 契约②）。
   * @param {number} count 垫的行数
   * @param {number} rowHeight 一行多高（像素）
   * @returns {string} 直接进 `style.height`
   */
  const treePad = (count, rowHeight) => {
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`treePad：行数得是非负整数，这里是 ${String(count)}`);
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) throw new RangeError(`treePad：行高得是正数，这里是 ${String(rowHeight)}`);
    return `${count * rowHeight}px`;
  };

  return { esc, tone, resultHead, statsLine, errBlock, noteLines, emptyHint, treeRow, treePad };
}
