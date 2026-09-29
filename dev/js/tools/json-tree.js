/**
 * JSON 值 → 树视图的行集 + 只渲染可视行的控制器（段 4 Task 5；设计文档 §5.3 的「树视图」那一档）。
 *
 * 这一本分成两半，中间那条线画得很硬：**前半（`flatten` / `expandOf` / `searchRows`）只在 plain array 上算，
 * 后半（`createTreeController`）只碰注入进来的 DOM**。这么切的理由不是好看，是 §V 契约那四条外部证据：
 * 前三条（三块常驻节点、垫块高度、任意滚动位置下 DOM 行数不越过 `windowSize`）必须能在一个假 DOM 上断言，
 * 而"匹配到的行在不在当前行集里"这一条要的是纯函数级的答案——它若只能靠查询 DOM 才知道，
 * 「只渲染可视」就成了判据自己看不见的那件事。
 *
 * 行对象十二格（V2 逐行钉这个键集，加一格是一次契约变更）：
 *   id · pointer · parent · depth · keyLabel · kind · childCount · expanded ·
 *   hiddenCount · truncatedFrom · display · matched
 * 三处口径是**选出来的形状**，各有一条判据钉着，实现期不许"顺手改"：
 *   · `id === pointer`，只有截断行例外（它的 id 是 `<父 Pointer>~more`、`pointer` 留空串）。V5、V7。
 *     用行当下标当 id 的话，数据一刷新折叠态就落到别的行上，而那种漂正好是"只渲染可视"抓不到的（V7 量的就是这次漂）。
 *   · `hiddenCount` 数的是**这一行下面直接少了几行**，不是整棵子树。V4、V13。
 *     这一格同时是搜索那一格 `truncated` 的唯一加数：折叠与截断都往这里加，截断行自己报 0——
 *     两处都报一遍的话 `truncated` 会加两遍（V5 的注释写的就是这件事）。
 *   · `matched` 只有一个写入点：`searchRows`。`flatten` 一律给 false，`expandOf` 一格都不改（V10、V12）。
 *
 * 深度与环：`flatten` 走**显式栈**，五千层容器不吃调用栈（V1 量这一格）。环在撞回祖先那一格当场抛
 * `TypeError` 并把 Pointer 写进消息，而不是渲染出一棵自我复制的树。同一个对象出现在兄弟两格**不算环**，
 * 照原样渲染两次——那是共享引用，不是循环，把它判成环就是替数据编一个 JSON 里不存在的约束。
 * 非 JSON 能表达的值（`undefined`、函数、symbol、`NaN`、`Infinity`、bigint）一律拒并点名 Pointer，
 * 与 §U 同一条口径：宁可不给结果，也不给一个把"没有值"渲染成 `null` 的树。
 *
 * 长串的截断（V9）：先按**码元**截到 200，再交 `json-core.js` 的 `escapeText` 转义。
 * 顺序反了就会留下半根反斜杠；末格正好落在代理对的高半边时整个不收，
 * 所以 `display` 里出现的引号、`\uXXXX` 与字面量永远是完整的一对。
 *
 * 控制器那一半只认 id：锚点是「视口首行那一格的 id」，`setData` 之后按 id 找回去，找不着也照样记着
 * （等那一行回来），焦点在重建后按 id 交还、且带 `preventScroll`（V16）。窗口只由 `windowSize` 决定，
 * **不读 `clientHeight`**——判据因此与视口高度无关，装配层要多密的窗口自己按 `rowHeight` 折算。
 * 只有"谁滚的"这件事没法从外面读：浏览器会为控制器自己写的那一次 `scrollTop` 补发一个 `scroll`，
 * 那一次照"视口首行"的口径改写锚点就会把刚找回来的那一格换掉，所以写出去的值单独记一份、只认它一次（V18）。
 *
 * 纯度：环境一律从构造函数注入，这一本不读全局的 `window` / `document`、不写任何存储；
 * 内容那一格有两条路（V19）：不给 `renderRow` 时只走 `textContent` 与 `setAttribute`，给了就一个字也不写、
 * 行内 markup 整个交出去——装配层走的是后者，而那只钩子是段 4 Task 6 预登记的第二格形参（计划 §V 契约段 :5248-5249）。
 * 两条路的红线是同一条：树里出现的字符串永远不是标记。
 * 依赖只有 `json-core.js` 的两把尺：串的转义口径、Pointer 的拼接口径（V1 数这个 import）。
 */
import { escapeText, pointerChild } from './json-core.js';

/** 单节点一次列出的键数上限，超出就长出一行「还有 N 个键未列出」（V5、V6） */
export const ROW_KEYS_LIMIT = 2000;
/** 一次进 DOM 的行数上限：上垫块 + 这一段 + 下垫块，滚动条总长仍按全部行算（V15 契约③） */
export const RENDER_WINDOW = 80;
/** 首屏只展开到这一层：`depth < DEFAULT_EXPAND_DEPTH` 的容器行是开的（V3） */
export const DEFAULT_EXPAND_DEPTH = 2;
/** 行的六类，顺序与页面图例一致；`kind` 只取这六个值（V2 逐行验） */
export const ROW_KINDS = ['object', 'array', 'string', 'number', 'boolean', 'null'];

/** `display` 里字符串内容保留的码元数，越一格才截（V9） */
const DISPLAY_UNITS = 200;
/** 缩进默认档：行元素自己的 `padding-left`，装配层要换密度就传 `indentStep` */
const DEFAULT_INDENT_STEP = 12;
/** 搜索的三档口径，写死在这里，`scope` 不认就当入参错抛出去（V11） */
const SCOPES = ['key', 'value', 'both'];
/** 截断行 id 的那一段后缀：`<父 Pointer>~more`（根的父 Pointer 是空串，所以根的截断行就叫 `~more`） */
const MORE_SUFFIX = '~more';
const CONTAINER_KINDS = new Set(['object', 'array']);
const KIND_SET = new Set(ROW_KINDS);

/** 一行的十二格，`setData` 的入参闸门与 V2 的键集断言共用这一张表 */
const ROW_STRINGS = ['id', 'pointer', 'keyLabel'];
const ROW_NUMBERS = ['depth', 'childCount', 'hiddenCount', 'truncatedFrom'];
const ROW_BOOLEANS = ['expanded', 'matched'];

/**
 * 截断行是 `id === pointer` 那条口径的唯一例外：它点不出 Pointer，也不许被复制成一条合法 Pointer。
 * 判据用「有 id 却没 pointer」这一格，而不是去比后缀——真键名叫 `~more` 的那一行是 `/x~more`，
 * 它的 pointer 非空，永远撞不进来。
 * @param {{id: string, pointer: string}} row
 * @returns {boolean}
 */
const isMore = (row) => row.pointer === '' && row.id !== '';

/** 根那一格在消息里要说"根"，不说 `Pointer `（空串读不出主语） */
const where = (pointer) => (pointer === '' ? '根节点' : `Pointer ${pointer} 那一格`);

/**
 * JSON 六类里的哪一类；不是 JSON 能表达的值给空串，由调用方点名拒。
 * @param {unknown} value
 * @returns {string}
 */
function kindOf(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return Number.isFinite(value) ? 'number' : '';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return Array.isArray(value) ? 'array' : 'object';
  return '';
}

/**
 * 只枚举**自有**键，而且只给对象那一支：数组的子项就是下标，它的"键表"是 `length` 这一个数，
 * 不是一串现造的字符串（`for…in` 会把原型上的 `toString` 之类也枚举进来，V8 有一条判据专门拒那个）。
 * 早先这里写的是 `Array.from({ length: n }, (_, i) => String(i))`：一行都不差，但为了列出
 * `maxKeys` 那一档（默认 2000）先把整个下标表物化出来——100 万元素的数组（5 MiB 的 JSON 里
 * 常见的一格）实测 191ms / 净增 56MB 堆，只为交回 2002 行。改成在列出的那一圈里现取 `String(i)`，
 * 行集形状一格不变（V2 那张表里的 `/a/0`、`/a/1` 就是这一条）。
 * @param {object} node kind 已经判成 object 的那一格
 * @returns {string[]}
 */
const objectKeysOf = (node) => Object.keys(node);

/**
 * 按码元截一段串。末格正好是代理对的高半边时整个不收，所以截出来的尾巴永远是完整码点（V9）。
 * @param {string} text
 * @param {number} limit
 * @returns {{text: string, cut: boolean}}
 */
function cutUnits(text, limit) {
  if (text.length <= limit) return { text, cut: false };
  let end = limit;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { text: text.slice(0, end), cut: true };
}

/**
 * 一行的 `display`：标量给字面量，容器给概览串，**展开着的容器给空串**（子行就在下面，再写一遍 `{}` 是噪音）。
 * @param {unknown} node
 * @param {string} kind
 * @param {boolean} open
 * @param {number} childCount
 * @returns {string}
 */
function displayOf(node, kind, open, childCount) {
  if (kind === 'string') {
    const { text, cut } = cutUnits(node, DISPLAY_UNITS);
    return `"${escapeText(text)}${cut ? '…' : ''}"`;
  }
  if (kind === 'number' || kind === 'boolean' || kind === 'null') return String(node);
  if (open) return '';
  if (childCount === 0) return kind === 'array' ? '[]' : '{}';
  return kind === 'array' ? `[${childCount} 项]` : `{${childCount} 键}`;
}

/**
 * `expanded` 只收 Set 或干脆不给（`undefined` / `null` 都走默认档）。
 * 默认档与"谁都不展开"是两件事，所以空 Set 必须原样收下（V3）。
 * @param {unknown} raw
 * @returns {Set<string>|null}
 */
function readExpanded(raw) {
  if (raw === undefined || raw === null) return null;
  if (!(raw instanceof Set)) throw new TypeError(`flatten 的 expanded 只收 Set（或不给走默认档），这里是 ${describe(raw)}`);
  return raw;
}

/**
 * `maxKeys` 只收非负整数或 `null` / `undefined`；`0` 是合法档（只剩根 + 截断行，V5）。
 * @param {unknown} raw
 * @returns {number}
 */
function readMaxKeys(raw) {
  if (raw === undefined || raw === null) return ROW_KEYS_LIMIT;
  if (typeof raw !== 'number') throw new TypeError(`flatten 的 maxKeys 要是数字，这里是 ${typeof raw}`);
  if (!Number.isInteger(raw) || raw < 0) throw new RangeError(`flatten 的 maxKeys 得是 0 或正整数，这里是 ${String(raw)}`);
  return raw;
}

const describe = (value) => (Array.isArray(value) ? `长度 ${value.length} 的数组` : `${typeof value}`);

/**
 * 选项袋只认对象字面量与 null 原型那一份。
 * `typeof x === 'object'` 这一关放得过数组、Set、Map、类实例，而它们身上的 `expanded` / `scope`
 * 全是 `undefined`——于是"写错的调用"被读成"没写选项"，静默走默认档：展开集落回前两层、
 * scope 落回 both。默认档与用户要的那一档差的是整棵树的展开态，所以这一格要抛而不是猜（V17）。
 * @param {unknown} raw
 * @returns {boolean}
 */
function isPlainBag(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const proto = Object.getPrototypeOf(raw);
  return proto === Object.prototype || proto === null;
}

/** 行集闸门的第 1 层：是不是 flatten 交回的那种数组 */
function assertRows(list, who) {
  if (!Array.isArray(list)) throw new TypeError(`${who} 只收 flatten 交回的行集（数组），这里是 ${describe(list)}`);
}

/** 行集闸门的第 2 层：那一格是不是行对象（十二格按类型逐个验，验完才准进渲染） */
function assertRow(row, i) {
  const bad = (why) => { throw new TypeError(`行集第 ${i + 1} 格不是 flatten 交回的行对象：${why}`); };
  if (row === null || typeof row !== 'object' || Array.isArray(row)) bad('那一格不是行对象');
  for (const key of ROW_STRINGS) if (typeof row[key] !== 'string') bad(`${key} 要是字符串，这里是 ${describe(row[key])}`);
  for (const key of ROW_NUMBERS) if (typeof row[key] !== 'number') bad(`${key} 要是数字，这里是 ${describe(row[key])}`);
  for (const key of ROW_BOOLEANS) if (typeof row[key] !== 'boolean') bad(`${key} 要是布尔，这里是 ${describe(row[key])}`);
  if (row.parent !== null && typeof row.parent !== 'string') bad(`parent 是父行的 Pointer 或 null，这里是 ${describe(row.parent)}`);
  if (!KIND_SET.has(row.kind)) bad(`kind 得在 ROW_KINDS 里，这里是 ${describe(row.kind)}`);
}

/**
 * 前序深度优先拍平：父在子前，兄弟按数据里的键序（V2 那张十行表钉的就是这个顺序）。
 * 一趟走完，所以 `hiddenCount` 只能报"直接少了几格"——要数整棵子树就得再来一趟（V4 的理由）。
 *
 * @param {unknown} value `parseJson` 交出来的那个值，或任何 JSON 能表达的结构
 * @param {{expanded?: Set<string>|null, maxKeys?: number|null}} [options]
 * @returns {Array<object>} 行集，每行十二格
 * @throws {TypeError} 值里有非 JSON 能表达的格、有环，或 `expanded` / 参数形状不对
 * @throws {RangeError} `maxKeys` 是数但不是非负整数
 */
export function flatten(value, options = {}) {
  if (!isPlainBag(options)) {
    throw new TypeError(`flatten 的第二格只收 { expanded, maxKeys } 这一个形状，这里是 ${describe(options)}`);
  }
  const expanded = readExpanded(options.expanded);
  const maxKeys = readMaxKeys(options.maxKeys);
  const rows = [];
  const path = new Set();
  const stack = [{ t: 'row', value, keyLabel: '', pointer: '', parent: null, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame.t === 'out') { path.delete(frame.value); continue; }
    if (frame.t === 'more') {
      rows.push({
        id: `${frame.parent}${MORE_SUFFIX}`, pointer: '', parent: frame.parent, depth: frame.depth + 1,
        keyLabel: '', kind: frame.kind, display: `还有 ${frame.hidden} 个${frame.kind === 'array' ? '元素' : '键'}未列出`,
        childCount: 0, expanded: false, hiddenCount: 0, truncatedFrom: frame.from, matched: false,
      });
      continue;
    }

    const { value: node, keyLabel, pointer, parent, depth } = frame;
    const kind = kindOf(node);
    if (kind === '') {
      throw new TypeError(`${where(pointer)}不是 JSON 能表达的值（${describe(node)}）：树视图不猜它该读成什么。`);
    }
    const container = CONTAINER_KINDS.has(kind);
    if (container && path.has(node)) {
      throw new TypeError(`${where(pointer)}绕回了它的父链（自引用）：JSON 里没有环，这份数据在 parseJson 之前就已经不是 JSON 了。`);
    }

    // 数组那一支只读 `length`，键串到列出的那一圈里现取；对象那一支才要真的枚举键。
    const asArray = kind === 'array';
    const kids = container && !asArray ? objectKeysOf(node) : null;
    const childCount = asArray ? node.length : (container ? kids.length : 0);
    const open = container && (expanded === null ? depth < DEFAULT_EXPAND_DEPTH : expanded.has(pointer));
    const listed = open ? Math.min(childCount, maxKeys) : 0;
    const hidden = childCount - listed;

    rows.push({
      id: pointer, pointer, parent, depth, keyLabel, kind,
      display: displayOf(node, kind, open, childCount),
      childCount, expanded: open, hiddenCount: hidden,
      truncatedFrom: open && hidden > 0 ? listed : -1, matched: false,
    });
    if (!open) continue;

    // 出栈顺序要的是「子行 → 截断行 → 离开父节点」，所以压栈倒过来：离框架最底、截断行居中、子行按序翻面压上。
    stack.push({ t: 'out', value: node });
    if (hidden > 0) stack.push({ t: 'more', parent: pointer, depth, kind, hidden, from: listed });
    for (let i = listed - 1; i >= 0; i--) {
      const key = asArray ? String(i) : kids[i];
      stack.push({
        t: 'row', value: node[key], keyLabel: key,
        pointer: pointerChild(pointer, key), parent: pointer, depth: depth + 1,
      });
    }
    path.add(node);
  }
  return rows;
}

/**
 * 交回一份**新的**展开集：把当前行集里开着的容器抄进来，再翻动 `id` 那一格。
 * 「折叠一支会把支内的展开态一起带走」是这个算法的必然结果（行集里没有的那一格，下一轮也用不上），
 * V10 把它钉成判据而不是留给注释——因为它是用户能看见的行为（收起来再打开，里面的层级塌回收默认档）。
 *
 * @param {Array<object>} rows `flatten` 交回的行集
 * @param {string} id 要翻动的那一行的 id（就是 Pointer，截断行也行但等于没动）
 * @param {boolean} on `true` 展开、`false` 收起
 * @returns {Set<string>} 新 Set；入参行集一格都不改
 */
export function expandOf(rows, id, on) {
  assertRows(rows, 'expandOf');
  if (typeof id !== 'string') throw new TypeError(`expandOf 的 id 要是 Pointer 字符串，这里是 ${describe(id)}`);
  if (typeof on !== 'boolean') throw new TypeError(`expandOf 的第三格要的是布尔：true 展开、false 收起，这里是 ${describe(on)}`);
  const next = new Set();
  for (let i = 0; i < rows.length; i++) {
    assertRow(rows[i], i);
    if (rows[i].expanded) next.add(rows[i].id);
  }
  if (on) next.add(id); else next.delete(id);
  return next;
}

/**
 * 在当前行集里搜，并把命中的那一格写在行对象自己身上（`matched` 唯一的写入点）。
 * 两档口径钉死：值是**子串**匹配（搜 `12` 命中 `123`，V11），容器行不参与值搜索
 * （否则搜一个 `2` 就命中一堆 `[2 项]` 概览串，V12）。
 *
 * @param {Array<object>} rows `flatten` 交回的行集
 * @param {string} query 搜索词；空串是"没搜"，不是"匹配一切"
 * @param {{scope?: 'key'|'value'|'both'}} [options]
 * @returns {{matchedIds: string[], total: number, truncated: number}} `truncated` 是这次没扫到的直接子项数
 */
export function searchRows(rows, query, options = {}) {
  assertRows(rows, 'searchRows');
  if (typeof query !== 'string') throw new TypeError(`searchRows 的搜索词要是字符串，这里是 ${describe(query)}`);
  if (!isPlainBag(options)) {
    throw new TypeError(`searchRows 的第三格只收 { scope } 这一个形状，这里是 ${describe(options)}`);
  }
  const scope = options.scope === undefined ? 'both' : options.scope;
  if (!SCOPES.includes(scope)) throw new RangeError(`searchRows 的 scope 只认 ${SCOPES.join(' | ')}，这里是 ${describe(scope)}`);

  for (let i = 0; i < rows.length; i++) {
    assertRow(rows[i], i);
    rows[i].matched = false;                   // 每一趟都先洗色：上一轮的命中不许留在树上
  }
  if (query === '') return { matchedIds: [], total: 0, truncated: 0 };

  const needle = query.toLowerCase();
  const matchedIds = [];
  let truncated = 0;
  for (const row of rows) {
    truncated += row.hiddenCount;
    if (isMore(row)) continue;                 // 截断行那句文案是排版，不是数据（V12）
    const hitKey = scope !== 'value' && row.keyLabel.toLowerCase().includes(needle);
    const hitValue = scope !== 'key' && !CONTAINER_KINDS.has(row.kind)
      && row.display.toLowerCase().includes(needle);
    if (hitKey || hitValue) {
      row.matched = true;
      matchedIds.push(row.id);
    }
  }
  return { matchedIds, total: matchedIds.length, truncated };
}

/**
 * 只渲染可视行的树控制器。**环境全部从这一格注入**：`document`、`container`、`rowHeight`、
 * `windowSize`、`indentStep`、`renderRow`、`onViewChange`（§V 契约①②③④ 分别由 V14、V14、V15、V16 断言，
 * 回声那一条由 V18 断言，行内内容交给外部那一条由 V19 断言）。
 *
 * 常驻节点永远只有三块：上垫块、行容器、下垫块。窗口里的行数不越过 `windowSize`，
 * 而两条垫块的高度按"窗口外还有几行"算，所以滚动条总长永远等于 `行数 × rowHeight`——
 * 这是"只渲染可视"唯一能从外面看见的证据（契约②），也是 V14 那条 `contentHeight()` 不变量量的东西。
 *
 * 锚点是「视口首行那一格的 id」：`setData` 之后按 id 找回去（前面插了一行也不会漂），
 * 找不着也照样记着，等那一行回来；焦点在节点重建后按 id 交还，且带 `preventScroll`。
 * "谁滚的"这一格只能自己判：`setData` / `scrollToPointer` 写 `scrollTop` 之后浏览器必然补发一次
 * `scroll`，那一次不是用户滚的，照旧口径会把刚找回来的锚点换成"夹过之后的视口首行"，
 * 于是"折叠→展开不漂"只在假 DOM 里成立——所以写出去的那个值记一份，回声到了就只认它一次（V18）。
 * 闸门一律抛在挂节点之前，所以入参写错不会留下一棵半成品（V16 最后一条）。
 *
 * @param {{document: object, container: object, rowHeight: number,
 *          windowSize?: number, indentStep?: number, renderRow?: (el: object, row: object) => void,
 *          onViewChange?: (p: {first: number, last: number, count: number, total: number, scrollTop: number}) => void}} env
 * @returns {{setData: Function, setExpanded: Function, refresh: Function, destroy: Function,
 *            scrollToPointer: Function, state: Function, visibleRange: Function}}
 */
export function createTreeController(env = {}) {
  const doc = env.document;
  const container = env.container;
  const rowHeight = env.rowHeight;
  if (doc === undefined || doc === null) throw new TypeError('createTreeController 缺 document：这一本不读全局，环境一律注入');
  if (typeof doc !== 'object' || typeof doc.createElement !== 'function') throw new TypeError('注入的 document 得有 createElement：行节点是自己建的，不是从串里解析出来的');
  if (container === undefined || container === null) throw new TypeError('createTreeController 缺 container：三块常驻节点要有地方挂');
  if (typeof container !== 'object' || typeof container.appendChild !== 'function'
    || typeof container.removeChild !== 'function' || typeof container.getAttribute !== 'function') {
    throw new TypeError('注入的 container 得是能挂节点的容器：appendChild / removeChild / getAttribute 三样齐');
  }
  if (typeof rowHeight !== 'number' || !Number.isInteger(rowHeight) || rowHeight < 1) {
    throw new TypeError(`rowHeight 得是 ≥1 的整数像素，这里是 ${describe(rowHeight)}`);
  }
  const size = env.windowSize === undefined ? RENDER_WINDOW : env.windowSize;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) {
    throw new RangeError(`windowSize 得是 ≥1 的整数行数，这里是 ${describe(size)}`);
  }
  const step = env.indentStep === undefined ? DEFAULT_INDENT_STEP : env.indentStep;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) {
    throw new TypeError(`indentStep 得是 ≥0 的整数像素，这里是 ${describe(step)}`);
  }
  const onViewChange = env.onViewChange;
  if (onViewChange !== undefined && typeof onViewChange !== 'function') throw new TypeError('onViewChange 要的是函数，或者干脆不给');
  /**
   * 行内内容的生成器（Task 6 预登记的那第二格，计划 §V 契约段 :5248-5249）。
   * 给了就**只**叫它：控制器写 attribute / 缩进 / role，一个字的内容都不写；
   * 不给就走 `rowText` 那条默认路（纯文本，永远不含标记）。
   */
  const renderRow = env.renderRow;
  if (renderRow !== undefined && typeof renderRow !== 'function') {
    throw new TypeError(`renderRow 要的是 (el, row) => void 或干脆不给，这里是 ${describe(renderRow)}（非函数静默回退 textContent 的下场是"树在，但行内样式没接上"）`);
  }

  const above = Math.floor(size / 4);          // 视口上面留的缓冲：够翻页手感，又不动"总数 ≤ size"那条上界
  const node = (className) => {
    const el = doc.createElement('div');
    el.setAttribute('class', className);
    return el;
  };
  const padTop = node('jt-tree__pad');
  const rowsBox = node('jt-tree__rows');
  rowsBox.setAttribute('role', 'tree');
  const padBottom = node('jt-tree__pad');
  container.appendChild(padTop);
  container.appendChild(rowsBox);
  container.appendChild(padBottom);

  /** @type {Array<object>} */
  let rows = [];
  /** @type {Map<string, number>} id → 行号；`scrollToPointer` 与锚点找回都读它，所以每轮 setData 重建一次 */
  let indexById = new Map();
  let anchorId = '';
  /**
   * 我们自己写出去的那一次 `scrollTop`。真浏览器会为它补发一个 `scroll`，而监听器分不出"谁滚的"——
   * 于是 `setData` 刚按 id 找回来的锚点，会被这一次回声换成"新的视口首行"。行集比锚点短时
   * （折叠一支、或换一份小文档）`scrollTop` 是被夹过来的，那一格尤其明显：V16 承诺的
   * "留着等它回来"会在这里静默失效，而假 DOM 永远不会自己补发那一次（V18 手动补）。
   */
  let echoTop = null;
  const writeTop = (value) => { echoTop = value; container.scrollTop = value; };
  let expandedSet = new Set();
  let range = { first: -1, last: -1, count: 0 };
  let lastRangeKey = '';
  let destroyed = false;

  const live = (who) => { if (destroyed) throw new TypeError(`这棵${who}已经拆了，方法不许再叫`); };
  const clampTop = (raw, total) => {
    const max = total === 0 ? 0 : (total - 1) * rowHeight;
    return Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, max));
  };
  const focusId = () => {
    const el = doc.activeElement;
    if (el === undefined || el === null || typeof el.getAttribute !== 'function') return null;
    return el.getAttribute('data-jt-id');
  };
  const detach = (parent, child) => {
    const at = Array.prototype.indexOf.call(parent.childNodes, child);
    if (at >= 0) parent.removeChild(child);
  };

  /**
   * 一行的文字。"`keyLabel === ''` 就是根"是错的：`{ "": 1 }` 是合法 JSON，那一格的键就是空串，
   * 于是一行什么都看不见（V14 有一条钉它）。真正"没有键"的只有两种：第 0 行那棵树本身，
   * 和截断行——后者的文案全在 `display` 里。空串键给成对的空引号，让它在屏幕上占得住一格。
   */
  const rowText = (row) => {
    if (row.depth === 0 || isMore(row)) return row.display;
    const label = row.keyLabel === '' ? '""' : row.keyLabel;
    return row.display === '' ? label : `${label}: ${row.display}`;
  };

  /** 一行一个 div：语义挂 attribute，颜色挂 class，缩进挂 padding——**内容默认只进 textContent**，给了 `renderRow` 就一个字也不进 */
  function rowNode(row) {
    const more = isMore(row);
    const containerRow = !more && CONTAINER_KINDS.has(row.kind);
    const cls = [`jt-tree__row`, `jt-tree__row--${more ? 'more' : row.kind}`];
    if (containerRow) cls.push(row.expanded ? 'is-open' : 'is-closed');
    if (row.matched) cls.push('is-matched');
    const el = node(cls.join(' '));
    el.setAttribute('role', 'treeitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-jt-id', row.id);
    el.setAttribute('data-jt-pointer', row.pointer);
    el.setAttribute('aria-level', String(row.depth + 1));
    if (containerRow) el.setAttribute('aria-expanded', row.expanded ? 'true' : 'false');
    el.style.paddingLeft = `${row.depth * step}px`;
    // 两条路各走到底：给了钩子就一个字都不写（V19 量的就是这一格——两处写内容等于一处赢，
    // 而"谁赢"取决于渲染顺序），没给才走纯文本。钩子的异常照原样上抛，装配层有 `runGuarded` 接。
    if (renderRow) renderRow(el, row);
    else el.textContent = rowText(row);
    return el;
  }

  function render() {
    const total = rows.length;
    const top = clampTop(container.scrollTop, total);
    const start = total === 0 ? 0 : Math.floor(top / rowHeight);
    const count = Math.min(size, total);
    const first = total === 0 ? -1 : Math.min(Math.max(0, start - above), total - count);
    const last = total === 0 ? -1 : first + count - 1;
    padTop.style.height = `${first < 0 ? 0 : first * rowHeight}px`;
    padBottom.style.height = `${last < 0 ? 0 : (total - last - 1) * rowHeight}px`;

    const keepFocus = focusId();
    while (rowsBox.childNodes.length > 0) rowsBox.removeChild(rowsBox.childNodes[0]);
    const built = [];
    for (let i = 0; i < count; i++) {
      const el = rowNode(rows[first + i]);
      rowsBox.appendChild(el);
      built.push(el);
    }
    range = { first, last, count };
    if (keepFocus !== null) {
      const back = built.findIndex((el) => el.getAttribute('data-jt-id') === keepFocus);
      // 窗口上面那 `above` 行在视口外，裸 focus() 会先为它滚一次——那一次滚动又是一次回声。
      if (back >= 0) built[back].focus({ preventScroll: true });
    }
    if (onViewChange !== undefined) {
      const key = `${first}|${last}|${total}`;
      if (key !== lastRangeKey) {
        lastRangeKey = key;
        onViewChange({ first, last, count, total, scrollTop: top });
      }
    }
  }

  const onScroll = () => {
    if (destroyed) return;                     // 拆完之后事件里不许复活任何节点（V16）
    if (echoTop !== null) {
      const mine = container.scrollTop === echoTop;
      echoTop = null;
      // 我们自己写出去的那一次：窗口已经按这个 top 画过了，锚点也不是"用户滚到的那一格"。
      // 浏览器把值夹走（真 DOM 的上界是 scrollHeight − clientHeight）就不算回声了，按用户滚动处理。
      if (mine) return;
    }
    const total = rows.length;
    const top = clampTop(container.scrollTop, total);
    if (total > 0) {
      const at = Math.floor(top / rowHeight);
      if (at < total) anchorId = rows[at].id;
    }
    render();
  };
  container.addEventListener('scroll', onScroll);

  /** 行集 → id 索引 + 当前展开态（`setExpanded` 的对照表就从这里来） */
  function adopt(next) {
    rows = next.slice();
    indexById = new Map();
    expandedSet = new Set();
    for (let i = 0; i < rows.length; i++) {
      indexById.set(rows[i].id, i);
      if (!isMore(rows[i]) && CONTAINER_KINDS.has(rows[i].kind) && rows[i].expanded) expandedSet.add(rows[i].id);
    }
  }

  return {
    /**
     * 换一份行集：锚点按 id 找回它自己的那一行（前面插了一行就跟着补一行），
     * 找不着就留着等它回来，只把 `scrollTop` 夹回新行集的范围内。
     * @param {Array<object>} next `flatten` 交回的行集
     */
    setData(next) {
      live('树');
      assertRows(next, 'setData');
      for (let i = 0; i < next.length; i++) assertRow(next[i], i);
      adopt(next);
      const at = indexById.get(anchorId);
      writeTop(clampTop(at === undefined ? container.scrollTop : at * rowHeight, rows.length));
      render();
    },

    /**
     * 登记这一轮的展开集。**行集与展开集必须同轮**：只要有一格容器的 `expanded` 与这份 Set 对不上就抛，
     * 因为那种不一致只有一个来源——装配层把上一轮的 Set 喂进了这一轮的行集，而那正是用户看见的"点了没反应"。
     * @param {Set<string>} set
     */
    setExpanded(set) {
      live('树');
      if (!(set instanceof Set)) throw new TypeError(`setExpanded 只收 Set（flatten 用的那一轮），这里是 ${describe(set)}`);
      for (const row of rows) {
        if (isMore(row) || !CONTAINER_KINDS.has(row.kind)) continue;
        if (set.has(row.id) !== row.expanded) {
          throw new TypeError(`展开集与行集不是同一轮：行集里 ${where(row.id)}是${row.expanded ? '展开' : '折叠'}的，`
            + `喂进来的展开集却${set.has(row.id) ? '有' : '没有'}它。先 flatten，再 setData，然后把同一份 Set 交给 setExpanded。`);
        }
      }
      expandedSet = new Set(set);
      render();
    },

    /** 按当前行集与当前 `scrollTop` 重画窗口（搜索改了 `matched` 之后叫这一格） */
    refresh() {
      live('树');
      render();
    },

    /**
     * 滚到那一行的行首。
     * @param {string} pointer 要定位的 Pointer
     * @returns {boolean} 行集里没有这一格就回报 false，并且不动滚动
     */
    scrollToPointer(pointer) {
      if (typeof pointer !== 'string') throw new TypeError(`scrollToPointer 只收 Pointer 字符串，这里是 ${describe(pointer)}`);
      live('树');
      const at = indexById.get(pointer);
      if (at === undefined) return false;
      anchorId = pointer;
      writeTop(clampTop(at * rowHeight, rows.length));
      render();
      return true;
    },

    /** 读数：装配层的"一次渲染 N 行 / 共 M 行"那一行从这里取 */
    state() {
      return {
        total: rows.length, windowSize: size, rowHeight, indentStep: step,
        anchorId, expanded: new Set(expandedSet),
      };
    },

    /** 当前窗口的行号区间（含两端）；空行集用 -1 表示"没有"，`count` 给 0 */
    visibleRange() {
      return { first: range.first, last: range.last, count: range.count };
    },

    /** 摘掉三块常驻节点与 scroll 监听；重复叫不出错，叫完再派事件也不许长节点 */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // 真浏览器每一枚节点都有这一格；假 DOM 的骨架夹具只给 `addEventListener`/`removeChild`
      // （§W 的 `wPage` 就是那份），摘不到监听也要把三块常驻节点拆干净——留着比漏摘一根线更伤，
      // 因为"两种视图同时挂在 DOM 上"是用户能看见的缺陷，而孤儿监听在拆完的容器上不会复活。
      if (typeof container.removeEventListener === 'function') container.removeEventListener('scroll', onScroll);
      while (rowsBox.childNodes.length > 0) rowsBox.removeChild(rowsBox.childNodes[0]);
      for (const piece of [padTop, rowsBox, padBottom]) detach(container, piece);
      rows = [];
      indexById = new Map();
      expandedSet = new Set();
      range = { first: -1, last: -1, count: 0 };
    },
  };
}
