/**
 * 文件对比页输出区的视图层（段 5 Task 4；设计文档 §5.5 的「结果区」与 §1.3 那份契约）。
 *
 * 这一本和 `jsonView.js` 干同一件事，只是形状不同：把已经算好的行对象、片段与读数**拼成 HTML 串**。
 * 它不算任何东西，也不碰任何节点——拼出来的串由装配层那唯一的 `innerHTML` 出口写进页面。
 * 于是"什么样的文本会变成标记"这一件事在全仓库只有一个答案，而那个答案是注入进来的 `esc`。
 *
 * 三条口径：
 *
 * 1. **零 import**（Z1）。第 0.4 节那条构建红线在这一本同样成立：一旦这里 import 了什么，
 *    `toolDiff.js` 与 `toolkitCore.js` 就同时 reach 那个模块，Rollup 切出共享 chunk，
 *    `iifeWrapPlugin` 包完的产物里留下 `import{`——整页 SyntaxError 而构建 exit=0。
 *    代价是三件东西必须由 `env` 递进来：转义函数、类名前缀、行尾回车的符号（`{ esc, prefix, crGlyph }`），
 *    缺任何一件在构造期点名（Z2），不许退化成"默认前缀"那种静默兜底。
 * 2. **类名与属性名只从 `prefix` 派生**（Z3）。全文件剥注释的源码里那个页面专属的前缀串出现 **0 次**，
 *    连整格字面量也不许有（§W10 同一条口径）。这不为了好看：Task 5 的换前缀自证
 *    （`df` ↔ `zx` 一整页跟着换）只有在派生是真的时候才有牙，手打过一处就是给那道门禁装假牙。
 * 3. **用户文本只出现在 `esc` 之后，且永远不进属性位**（Z8、Z9）。属性值只有四类整数：
 *    行块下标、这一侧的行号、折叠省略的行数、变更格的深度。对齐引擎交出的 `textA/textB`、
 *    Pointer、预览串一律落在正文位置——那里 `esc` 说得上话，属性位上它说不上（引号转义后仍是文本）。
 *
 * 三件"不是 CSS 能兜的事"归这一层（Z4、Z5、Z6）：并排两栏各读同一份行流、缺席那一侧长成占位行而不是
 * 少一行；一个改动行在两栏各出现一次而高亮只有各自那一半；行尾回车画得出符号。
 * 行内容那一格用 `pre` 而不是 `span`：代码行的缩进是内容不是排版，CSS 万一漏了 `white-space` 也不会
 * 把四格缩进并成一格，同时让"行内再套 span"这一件事在判据里切得干净（§Z 的 `zTxt`）。
 *
 * JSON 档那一表（`renderJsonTable`）另扛两格：一侧缺席与"值真的是 `null`"分得开（判的是 `absent` 这一档，
 * 不是预览串空不空——`{"a":null}` 的预览正是 `"null"`，反过来推会读错），而六句代价说明与表同屏，
 * 用户读到的"这一页在哪一档上打了折"和那张变更清单一块儿长出来。
 */

/** 对齐引擎能交出的四档行（视图层自己加的那档 `fill` 不在这里，见 `rowBlock`） */
export const DF_CORE_KINDS = ['equal', 'change', 'del', 'ins'];
/** 两栏：只有 A 与 B，第三栏在这一页没有对应的事实 */
export const DF_SIDES = ['a', 'b'];

/** 行内片段的三档（对齐引擎的词汇表，样式那边也只认这三种颜色） */
const INLINE_TONES = ['equal', 'del', 'ins'];
/** 每一栏认得的行内片段档：A 栏读等价的与自己被删的那半，B 栏反之（Z5） */
const INLINE_BY_SIDE = { a: ['equal', 'del'], b: ['equal', 'ins'] };
/** 折叠条两档：块与块之间与文件末尾，样式与点击行为按这两档分 */
const FOLD_WHERE = { head: 'head', tail: 'tail' };
/** 结论两档模式，与它们各自的词表（`blocked` / `invalid` 进不来，见 `renderVerdict`） */
const MODES = ['text', 'json'];
const VERDICTS = { text: ['same', 'diff'], json: ['same', 'same-key-order', 'diff'] };
/** 变更表四档 kind 与三档归属的显示名：白名单外的词一律抛，不静默渲成一格空白 */
const KIND_LABELS = { add: '新增', remove: '删除', change: '值变', type: '类型变' };
const OWNER_LABELS = { 'only-a': '仅 A', 'only-b': '仅 B', both: '两侧' };
/** 一侧根本没有这一格时写的话（与"值真的是 null"是两件事） */
const ABSENT_TEXT = '（这一侧没有）';

/** 这一件收到的东西不像样子就说清是哪一格不像：视图层的静默空格是最难查的"页面没坏但少了东西" */
const shape = (value) => (value === null ? 'null' : Array.isArray(value) ? '数组' : typeof value);

/**
 * 造出对比页的那七件生成器。
 * @param {{esc: Function, prefix: string, crGlyph: string}} env `window.Tk.view` 里的那份 `esc`，
 *   加上装配层从 `diff-core.js` 递来的类名前缀与行尾回车符号
 * @returns {{renderSide: Function, renderInline: Function, renderFoldBar: Function, renderStats: Function,
 *   renderJsonTable: Function, renderNotice: Function, renderVerdict: Function}}
 * @throws {TypeError} 注入缺件，或某一件的入参不在白名单里
 */
export function createDiffView(env) {
  if (!env || typeof env !== 'object') {
    throw new TypeError(`createDiffView：第一格应是 { esc, prefix, crGlyph }，这里是 ${shape(env)}`);
  }
  if (typeof env.esc !== 'function') {
    throw new TypeError(`createDiffView：env.esc 应是 view.js 里那只转义函数，这里是 ${shape(env.esc)}（缺它的下场是用户文本被当标记插进结果区）`);
  }
  if (typeof env.prefix !== 'string' || !/^[a-z][a-z0-9]*$/.test(env.prefix)) {
    throw new TypeError(`createDiffView：env.prefix 应是一枚只含小写字母与数字的短串（类名与属性名都从它派生），这里是 ${shape(env.prefix)}（带空格或连字符的整套类名到页面上是碎的）`);
  }
  if (typeof env.crGlyph !== 'string' || env.crGlyph === '') {
    throw new TypeError('createDiffView：env.crGlyph 应是一个非空字符串（行尾回车那一格画它，缺它"行尾有回车"与"这一格没渲染"就混成同一档）');
  }
  const esc = env.esc;
  const p = env.prefix;
  const crGlyph = env.crGlyph;

  /** `df-row`：词根 */
  const c = (root) => `${p}-${root}`;
  /** `df-row--change`：档位 */
  const mod = (root, m) => `${p}-${root}--${m}`;
  /** `df-row__txt`：从属格 */
  const el = (root, part) => `${p}-${root}__${part}`;
  /** `data-df-ln`：属性名（名字里也带前缀，换前缀时整套跟着换） */
  const at = (name) => `data-${p}-${name}`;

  /**
   * 行内片段序列 → 某一栏的串。等价段**不套 span**：一行满屏 span 是噪声，也是第二套口径。
   * 一条片段序列里 `del` 与 `ins` 是**交替躺着**的（`inlineFromTokens` 给的就是这一串），
   * 所以这一件按栏**挑段**而不是按栏各收一份：A 栏读等价与自己被删的那半，B 栏读等价与自己新增的那半。
   * 另一侧的档跳过不是错误，是这一栏本来就没有那半；词汇表外的档要抛（Z5）——那意味着对齐引擎
   * 多了一种着色档，而样式那边没人认识它，静默忽略就成了"高亮少了一块却看不出来"。
   * @param {Array<{t: string, text: string}>} inline `inlineDiff` / `Row.inline` 交出的那一段
   * @param {'a'|'b'} side 栏
   * @returns {string}
   */
  const renderInline = (inline, side) => {
    if (!Array.isArray(inline)) {
      throw new TypeError(`renderInline：第一格应是行内细化交出的片段数组，这里是 ${shape(inline)}（缺了它那一行只按整行着色，视图层不许自己猜一段回来）`);
    }
    if (!DF_SIDES.includes(side)) {
      throw new TypeError(`renderInline：栏只认 ${DF_SIDES.join(' / ')}，这里是 ${String(side)}`);
    }
    let out = '';
    for (let k = 0; k < inline.length; k += 1) {
      const seg = inline[k];
      if (!seg || typeof seg !== 'object' || typeof seg.text !== 'string') {
        throw new TypeError(`renderInline：第 ${k} 段应是 { t, text }，这里是 ${shape(seg)}（缺 text 的片段到页面上是一串 undefined）`);
      }
      if (!INLINE_TONES.includes(seg.t)) {
        throw new TypeError(`renderInline：第 ${k} 段的档只认 ${INLINE_TONES.join(' / ')}，这里是 ${String(seg.t)}（样式那边没有第三种颜色，静默忽略就是"高亮少了一块却看不出来"）`);
      }
      if (!INLINE_BY_SIDE[side].includes(seg.t)) continue;
      out += seg.t === 'equal' ? esc(seg.text) : `<span class="${mod('inline', seg.t)}">${esc(seg.text)}</span>`;
    }
    return out;
  };

  /**
   * 一行 → 某一栏的行块。缺席那一侧长成 `fill` 而不是少一行（Z4）：两栏各读同一份行流，
   * 行数不等时滚动一错位就错到底，而对齐这件事 CSS 兜不了。
   * `fill` 那一格不给自己编行号，也不写正文——它是"这一侧没有这一行"，不是第 0 行也不是空行。
   */
  const rowBlock = (row, side, i) => {
    if (!row || typeof row !== 'object') {
      throw new TypeError(`renderSide：第 ${i} 行应是 diff-core 的那个行对象，这里是 ${shape(row)}`);
    }
    if (!DF_CORE_KINDS.includes(row.kind)) {
      throw new TypeError(`renderSide：第 ${i} 行的 kind 只认 ${DF_CORE_KINDS.join(' / ')}，这里是 ${String(row.kind)}（多一档意味着对齐引擎多了一种行，而视图层不认识它）`);
    }
    const ln = side === 'a' ? row.a : row.b;
    const kind = ln === null ? 'fill' : row.kind;
    const crlf = side === 'a' ? row.crlfA : row.crlfB;
    const inline = row.kind === 'change' && Array.isArray(row.inline) && row.inline.length > 0
      ? renderInline(row.inline, side) : '';
    const body = kind === 'fill' ? '' : (inline === '' ? esc(side === 'a' ? row.textA : row.textB) : inline);
    const cr = kind !== 'fill' && crlf === true ? `<span class="${el('row', 'cr')}">${esc(crGlyph)}</span>` : '';
    return `<div class="${c('row')} ${mod('row', kind)}" ${at('i')}="${i}"`
      + (kind === 'fill' ? '' : ` ${at('ln')}="${ln}"`) + '>'
      + `<span class="${el('row', 'no')}">${kind === 'fill' ? '' : ln + 1}</span>`
      + `<pre class="${el('row', 'txt')}">${body}</pre>${cr}</div>`;
  };

  /**
   * 一栏的整列行块。
   * @param {object[]} rows `hunksOf` 摊出来的行对象数组（两栏递的是同一份）
   * @param {'a'|'b'} side 栏
   * @returns {string}
   */
  const renderSide = (rows, side) => {
    if (!Array.isArray(rows)) throw new TypeError(`renderSide：第一格应是行对象数组，这里是 ${shape(rows)}`);
    if (!DF_SIDES.includes(side)) {
      throw new TypeError(`renderSide：栏只认 ${DF_SIDES.join(' / ')}，这里是 ${String(side)}（第三栏在这一页没有对应的事实）`);
    }
    let out = '';
    for (let i = 0; i < rows.length; i += 1) out += rowBlock(rows[i], side, i);
    return out;
  };

  /**
   * 折叠条。`skipped` 直接抄 `hunksOf` 的那一格，属性与正文两处用同一个数（Z7）——
   * 分两处算就是"折叠条说谎"的成因。0 那一档整条不长：第一块前面本来就没有东西。
   * @param {{skipped: number, tail?: boolean}} o 省略的行数与头尾档
   * @returns {string} `<button>` 或空串
   */
  const renderFoldBar = (o) => {
    if (!o || typeof o !== 'object') throw new TypeError(`renderFoldBar：只收 { skipped, tail } 这一个对象，这里是 ${shape(o)}`);
    if (!Number.isInteger(o.skipped) || o.skipped < 0) {
      throw new RangeError(`renderFoldBar：省略行数得是 ≥0 的整数（它抄的是 hunksOf 的 skipped），这里是 ${String(o.skipped)}（小数会把滚动条总长算歪）`);
    }
    if (o.skipped === 0) return '';
    const tail = o.tail === undefined ? false : o.tail;
    if (typeof tail !== 'boolean') throw new TypeError(`renderFoldBar：tail 是布尔，这里是 ${shape(tail)}（"没给"不许读成"是尾条"）`);
    return `<button class="${c('fold')} ${mod('fold', tail ? FOLD_WHERE.tail : FOLD_WHERE.head)}" type="button" ${at('skip')}="${o.skipped}">`
      + `省略 ${o.skipped} 行 · 展开</button>`;
  };

  /**
   * 那一行读数。**只**读那七个名字，其余一律不看（Z12）：模块以后往 stats 里加一格，
   * 这一行的形状不许跟着变。缺的那一格给 0，不给空格也不给 `—`——"这一份里一处新增也没有"是事实。
   * @param {object} stats `diff-core.js` 的 stats 那一份
   * @returns {string} `<p>` 块
   */
  const renderStats = (stats) => {
    if (!stats || typeof stats !== 'object') throw new TypeError(`renderStats：只收 diff-core 的 stats 那一份，这里是 ${shape(stats)}`);
    const n = (key) => (Number.isFinite(stats[key]) ? stats[key] : 0);
    return `<p class="${c('stats')}">增 ${n('added')} · 删 ${n('removed')} · 改 ${n('changed')} · `
      + `同 ${n('unchanged')} · ${n('blocks')} 处 · 未行内 ${n('inlineSkipped')} · 归一化抹平 ${n('ignored')}</p>`;
  };

  /**
   * 结论那一格。两档模式各有自己的词表与账本：text 档读 `diff-core.stats` 那七个名字，
   * json 档读 `diff-json.stats` 那六个——名字不许混用，因为两张账表数的是不同的事。
   * `blocked` 与 `invalid` 到不了这里，抛是故意的：把它们写成结论就是把"没比成"说成"一样"，
   * 那一条路径归 `renderNotice`。
   * @param {{mode: string, verdict: string, stats: object, degraded?: boolean, normalized?: boolean}} o 四格
   * @returns {string} `<p>` 块
   */
  const renderVerdict = (o) => {
    if (!o || typeof o !== 'object') {
      throw new TypeError(`renderVerdict：只收 { mode, verdict, stats, degraded } 这一个对象，这里是 ${shape(o)}`);
    }
    if (!MODES.includes(o.mode)) throw new TypeError(`renderVerdict：模式只认 ${MODES.join(' / ')}，这里是 ${String(o.mode)}（第三种模式在这一页没有对应的算法）`);
    const words = VERDICTS[o.mode];
    if (!words.includes(o.verdict)) {
      throw new TypeError(`renderVerdict：${o.mode} 档的结论只认 ${words.join(' / ')}，这里是 ${String(o.verdict)}（blocked / invalid 走 renderNotice——写成结论就是把"没比成"说成"一样"）`);
    }
    if (o.degraded !== undefined && typeof o.degraded !== 'boolean') {
      throw new TypeError(`renderVerdict：degraded 是布尔，这里是 ${shape(o.degraded)}`);
    }
    const s = o.stats && typeof o.stats === 'object' ? o.stats : {};
    const n = (key) => (Number.isFinite(s[key]) ? s[key] : 0);
    let text;
    if (o.mode === 'text') {
      text = o.verdict === 'same'
        ? (n('ignored') > 0 ? `归一化之后两份文本相同（${n('ignored')} 行的空白或大小写差别没有计入）` : '两份文本逐字符相同')
        : `两份文本有差异：增 ${n('added')} 行 · 删 ${n('removed')} 行 · 改 ${n('changed')} 行 · ${n('blocks')} 处`;
    } else {
      const total = n('add') + n('remove') + n('change') + n('type');
      text = o.verdict === 'diff'
        ? `按 JSON 值有 ${total} 处不同（增 ${n('add')} · 删 ${n('remove')} · 改 ${n('change')} · 类型变 ${n('type')}）`
        : o.verdict === 'same-key-order' ? '按 JSON 值判为相同，但键的书写次序不同' : '按 JSON 值判为相同，键的书写次序也一致';
    }
    const warn = o.degraded === true ? `<span class="${el('verdict', 'warn')}">有一段对不齐，按整块删加整块增给出</span>` : '';
    return `<p class="${c('verdict')} ${mod('verdict', o.verdict)}">${esc(text)}${warn}</p>`;
  };

  /**
   * 坏输入与闸门那一档的一句话（Z11）。只有一句：两句话该由装配层挑一句递进来，
   * 视图层静默拼成一段就是吞掉了别的文案。
   * @param {string} text 那一句（通常是 `gate().reason` 或 `diffJson().error.reason`）
   * @returns {string} `<p>` 块
   */
  const renderNotice = (text) => {
    if (typeof text !== 'string' || text === '') {
      throw new TypeError(`renderNotice：只收一句话，这里是 ${shape(text)}（那一格空着，用户读到的是"这页坏了"而不是"哪儿不对"）`);
    }
    return `<p class="${c('notice')}">${esc(text)}</p>`;
  };

  /** 一侧那一格：缺席读 `absent` 这一档，不读预览串空不空（`{"a":null}` 的预览正是 `null`） */
  const sideCell = (type, preview, pointer) => {
    if (type === 'absent') return `<span class="${el('json', 'none')}">${esc(ABSENT_TEXT)}</span>`;
    if (typeof preview !== 'string') {
      throw new TypeError(`renderJsonTable：${String(pointer)} 这一格不是缺席档（type=${String(type)}）却没有预览串，这里是 ${shape(preview)}（表里出现空格子比抛出来难查十倍）`);
    }
    return esc(preview);
  };

  /**
   * JSON 档的变更清单：六列（位置 / 变更 / 归属 / A 侧 / B 侧 / 深度）+ 表尾那六句代价说明。
   * 表头与 `DIFF_JSON_NOTES` 同屏是刻意的（Y18 的第二半）：这一页给的结果在哪一档上打了折，
   * 用户应当在读"哪几格变了"的同一次滚动里读到，而不是翻到页脚。
   * @param {{changes: object[], stats: object, notes: string[], truncated: boolean}} o 四格
   * @returns {string}
   */
  const renderJsonTable = (o) => {
    if (!o || typeof o !== 'object') {
      throw new TypeError(`renderJsonTable：只收 { changes, stats, notes, truncated } 这一个对象，这里是 ${shape(o)}`);
    }
    if (!Array.isArray(o.changes)) throw new TypeError(`renderJsonTable：changes 应是 diffJson 交出的那份清单，这里是 ${shape(o.changes)}`);
    if (!Array.isArray(o.notes)) throw new TypeError('renderJsonTable：notes 应是 DIFF_JSON_NOTES 那六句的数组（装配层递错了要在这一层点名，静默少一句就是没人读的代价说明）');
    if (o.truncated !== undefined && typeof o.truncated !== 'boolean') {
      throw new TypeError(`renderJsonTable：truncated 是布尔，这里是 ${shape(o.truncated)}`);
    }
    const s = o.stats && typeof o.stats === 'object' ? o.stats : {};
    const meta = `<p class="${el('json', 'meta')}">比对 ${Number.isFinite(s.compared) ? s.compared : 0} 格 · 最深 ${Number.isFinite(s.depth) ? s.depth : 0} 层</p>`;
    const head = '<thead><tr>'
      + `<th class="${el('json', 'ptr')}">位置</th>`
      + `<th class="${el('json', 'kind')}">变更</th>`
      + `<th class="${el('json', 'owner')}">归属</th>`
      + `<th class="${el('json', 'a')}">A 侧</th>`
      + `<th class="${el('json', 'b')}">B 侧</th>`
      + `<th class="${el('json', 'depth')}">深度</th>`
      + '</tr></thead>';
    let body = '';
    for (let k = 0; k < o.changes.length; k += 1) {
      const row = o.changes[k];
      if (!row || typeof row !== 'object') throw new TypeError(`renderJsonTable：第 ${k} 行应是 diffJson 交出的那个变更对象，这里是 ${shape(row)}`);
      if (typeof row.pointer !== 'string') throw new TypeError(`renderJsonTable：第 ${k} 行的 Pointer 应是字符串，这里是 ${shape(row.pointer)}`);
      if (!KIND_LABELS[row.kind]) {
        throw new TypeError(`renderJsonTable：变更档只认 ${Object.keys(KIND_LABELS).join(' / ')}，这里是 ${String(row.kind)}（词汇表外的一档渲出来是一格空白的"变更"列）`);
      }
      if (!OWNER_LABELS[row.owner]) {
        throw new TypeError(`renderJsonTable：归属只认 ${Object.keys(OWNER_LABELS).join(' / ')}，这里是 ${String(row.owner)}`);
      }
      if (!Number.isInteger(row.depth) || row.depth < 0) {
        throw new RangeError(`renderJsonTable：第 ${k} 行的深度得是 ≥0 的整数，这里是 ${String(row.depth)}`);
      }
      body += `<tr class="${el('json', 'row')} ${mod('json__row', row.kind)}" ${at('depth')}="${row.depth}">`
        + `<td class="${el('json', 'ptr')}">${esc(row.pointer === '' ? '（根）' : row.pointer)}</td>`
        + `<td class="${el('json', 'kind')}">${KIND_LABELS[row.kind]}</td>`
        + `<td class="${el('json', 'owner')}">${OWNER_LABELS[row.owner]}</td>`
        + `<td class="${el('json', 'a')}">${sideCell(row.aType, row.aPreview, row.pointer)}</td>`
        + `<td class="${el('json', 'b')}">${sideCell(row.bType, row.bPreview, row.pointer)}</td>`
        + `<td class="${el('json', 'depth')}">${row.depth}</td></tr>`;
    }
    let list = '';
    for (const raw of o.notes) {
      if (typeof raw !== 'string' || raw.trim() === '') throw new TypeError(`renderJsonTable：notes 里每一句应是非空字符串，这里是 ${shape(raw)}`);
      list += `<li>${esc(raw)}</li>`;
    }
    const cut = o.truncated === true
      ? `<p class="${el('json', 'cut')}">列表到这里截断了，上面那四个计数仍是全量——没列出来的差额照样存在。</p>` : '';
    return `${meta}<table class="${c('json')}">${head}<tbody>${body}</tbody></table>`
      + (list === '' ? '' : `<ul class="${c('notes')}">${list}</ul>`) + cut;
  };

  return { renderSide, renderInline, renderFoldBar, renderStats, renderJsonTable, renderNotice, renderVerdict };
}
