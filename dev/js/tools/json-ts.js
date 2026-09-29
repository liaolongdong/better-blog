/**
 * JSON 样本 → TypeScript 类型（段 4 Task 3；设计文档 §5.3 的「JSON → TypeScript interface」）。
 *
 * 这一本只管一件事：**样本给了什么就读出什么，一个字都不多猜**。三条口径先钉在这儿：
 *   · 同一个槽上的多个对象**并成一份形状**——键按首次出现的顺序排，缺席过的那些键打 `?`；
 *   · 具名 `interface` 只给**数组元素**里的对象（`users: RootUsers[]`），其余对象一律内联。
 *     键名给出的是**元素**的名字（不是数组的名字），所以数组套数组、根数组这两档没有键名可用，
 *     才追加 `Item`；
 *   · 并集成员按档排：标量 → 数组 → 具名 interface → 内联对象 → `null`，同档内按渲染串升序。
 *     排序不看样本顺序，是因为 `text` 要给人复制走——同一份数据换个键序粘进来不该得到另一个文件。
 *
 * 三处**故意不做**的事，都不是遗漏：
 *   · 不给带引号的键合成 `[key: string]: T` 索引签名。键名是数据（`{"zh": …, "en": …}`）的时候，
 *     合成一条索引签名就把"样本里出现过这两个键"说成了"任意键都行"，那是超出样本的断言；
 *     这件事由 `notes` 里那句话说清，而不是由类型替你猜。
 *   · 不按结构相等合并 interface。两个槽形状一样但名字不同，就出两份声明——"结构相等"和"同一个槽"
 *     根本不是一回事，合并要引入一个判据兜不住的推断，宁可让输出重复。
 *   · 不猜单数。`users: RootUsers[]` 的元素接口就叫 `RootUsers`，不改写成 `RootUser`；
 *     英文单复数变化不规则，规则化的那一步必然出错。
 *
 * 深度与环：形状收集走**显式栈**（`buildShape`），到 `MAX_DEPTH` 那一格就停并把该格交回 `unknown`。
 * 深度闸门只有 `json-core.js` 那一个口径，这一本不再设第二道；调用方拿到的一定是 `parseJson`
 * 肯放行的输入（≤1000 层），而手工传进来的环也只会走到同一格停。
 * `T10` 量的就是这两条：1000 层必须一层不落全渲染出来，环不许把输出撑爆。
 *
 * 渲染递归的深度等于形状的层数（同样 ≤1001），比解析器的输入规模小三个数量级，所以这一趟留成递归；
 * 缩进按层给，但最多给到 `INDENT_LEVEL_CAP` 层——一千层缩进没有可读性可言，而它会把输出撑到百万字节。
 * 停在三十层是**排版**决定，不是类型推断：括号还在、行还在，只是不再往右挪。
 *
 * 纯度：不读环境、不写状态、不改入参；转义外包给 `json-core.js` 的 `escapeText`（本站只有一套
 * 「串怎么变成字面量」），除此之外这文件只 import 那一本的三个名字。
 */
import { INDENT_MODES, MAX_DEPTH, escapeText } from './json-core.js';

/** 输出块顶部那一句：面板把它逐字写在第一行注释上，§W 不再自己编一句 */
export const TS_HEADER_NOTE = '以下类型是按你给的这一份样本推断的，不是 schema：样本里没有的键、没出现过的元素类型，它都不保证。';

/** 名字长度上限。截断只管**派生出来的那一段**，冲突追加的 2、3 在截断之后，所以最长 48+2 */
const MAX_NAME_LEN = 48;
/** 缩进最多给到这一层，见文件头「排版决定」那一句 */
const INDENT_LEVEL_CAP = 32;
const IDENT_OK = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const INDENTS = { two: '  ', four: '    ', tab: '\t' };

const NOTE_UNION = '出现过 `|` 的地方都是样本给的并集：换一份样本就可能多一个成员，用它之前先确认取值范围。';
const NOTE_OPTIONAL = '标了 `?:` 的键在样本里不是每条都有：它是“可能有”，不是“一定没有”。';
const NOTE_QUOTED = '带引号的键本站不合成 `[key: string]` 索引签名：键名本身是数据的时候，取值请自己收窄。';

/**
 * 键名 → 可当 interface 名那一段用的标识符。**只改名，不改义**：`renamed` 与 `reason` 是同一件事
 * 的两半，面板要说「这个名字是我改出来的」就得同时拿到这两格。
 *
 * 口径：非字母数字一律当分隔符切段、每段首字母大写、拼起来；结果以数字开头就补一个 `_`；
 * 切完什么都不剩（空串、纯符号、纯非 ASCII）就交回 `Unnamed`；超过 48 字符截断。
 * 两档同时成立时报「超长截断」——截断是不可逆的那一步，先说它。
 *
 * @param {string} raw 键名或调用方给的 root
 * @returns {{name: string, renamed: boolean, reason: ''|'空串'|'超长截断'|'首字母改大写'|'非法字符改写'}}
 *   `name` 永远是合法标识符；`reason` 为空当且仅当 `renamed === false`（也就是 `name === raw`）
 */
export function toInterfaceName(raw) {
  if (typeof raw !== 'string') {
    throw new TypeError(`toInterfaceName 只收字符串，收到的是 ${raw === null ? 'null' : typeof raw}`);
  }
  if (raw === '') return { name: 'Unnamed', renamed: true, reason: '空串' };
  const words = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (name === '') return { name: 'Unnamed', renamed: true, reason: '非法字符改写' };
  if (name.charAt(0) >= '0' && name.charAt(0) <= '9') name = `_${name}`;
  if (name.length > MAX_NAME_LEN) return { name: name.slice(0, MAX_NAME_LEN), renamed: true, reason: '超长截断' };
  if (name === raw) return { name, renamed: false, reason: '' };
  const caseOnly = name.length === raw.length && name.toLowerCase() === raw.toLowerCase();
  return { name, renamed: true, reason: caseOnly ? '首字母改大写' : '非法字符改写' };
}

/** 缩进三档只有一把尺，认不认由 `INDENT_MODES` 说了算（消息点名常量名，好让人顺着找到定义处） */
const indentOf = (mode) => {
  if (!INDENT_MODES.includes(mode)) {
    throw new RangeError(`generateTs 的 indent 只认 INDENT_MODES 里的那几档：${INDENT_MODES.join(' | ')}`);
  }
  return INDENTS[mode];
};

/** 样本给的七种格。`unknown` 不是"猜不出来"，是"这东西根本不在 JSON 里"（函数、symbol、undefined、bigint） */
const kindOf = (v) => {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'boolean' || t === 'number' || t === 'string') return t;
  if (Array.isArray(v)) return 'array';
  if (t === 'object') return 'object';
  return 'unknown';
};

const mkNode = () => ({
  kinds: new Set(),
  keys: new Map(),
  order: [],
  objects: 0,
  item: null,
  name: '',
  iface: '',
});

/**
 * 值 → 形状图：一个槽一个节点，同槽的多个对象并键、多个数组元素并元素。
 *
 * 显式栈，孩子**倒序入栈**，于是出栈顺序就是文档顺序——键序与 interface 的出场序都从这一趟来，
 * 正序入栈会得到一份"后面的样本先说话"的键序，那是遍历方式的产物，不是数据的形状。
 *
 * @param {unknown} value
 * @returns {object} 根槽节点
 */
const buildShape = (value) => {
  const root = mkNode();
  const stack = [{ v: value, n: root, d: 0 }];
  while (stack.length) {
    const { v, n, d } = stack.pop();
    if (d > MAX_DEPTH) {
      n.kinds.add('unknown');
      continue;
    }
    const kind = kindOf(v);
    n.kinds.add(kind);
    if (kind === 'object') {
      n.objects += 1;
      const keys = Object.keys(v);
      const kids = [];
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        let slot = n.keys.get(key);
        if (slot === undefined) {
          slot = { child: mkNode(), hits: 0 };
          n.keys.set(key, slot);
          n.order.push(key);
        }
        slot.hits += 1;
        kids.push(v[key]);
      }
      for (let i = kids.length - 1; i >= 0; i -= 1) stack.push({ v: kids[i], n: n.keys.get(keys[i]).child, d: d + 1 });
    } else if (kind === 'array') {
      // 空数组不建元素槽：没有元素就没有"元素的样子"，让渲染那一趟直接交回 unknown
      if (v.length > 0 && n.item === null) n.item = mkNode();
      for (let i = v.length - 1; i >= 0; i -= 1) stack.push({ v: v[i], n: n.item, d: d + 1 });
    }
  }
  return root;
};

/** 派生名一律截到 48，链条（数组套数组）不许把命名基准撑成无限长 */
const cut = (base) => (base.length > MAX_NAME_LEN ? base.slice(0, MAX_NAME_LEN) : base);

/**
 * 形状图 → 名字。先序走一遍，只有**会出 interface 的槽**（数组元素槽里带 object 的那些）参与占名，
 * 所以 `{ xs: [[{ z: 1 }]] }` 里 `RootXs` 从来没被声明过，它只是下一层 `RootXsItem` 的命名基准。
 *
 * @param {object} root 根槽
 * @param {string} rootName 已经过 `toInterfaceName` 的根名
 * @returns {Array<{name: string, n: object}>} 声明块的出场顺序，`names` 就是它的名格
 */
const assignNames = (root, rootName) => {
  const used = new Set([rootName]);
  const claim = (base) => {
    const stem = cut(base);
    let name = stem;
    for (let k = 2; used.has(name); k += 1) name = `${stem}${k}`;
    used.add(name);
    return name;
  };
  const decls = [];
  root.name = rootName;
  if (root.kinds.has('object')) {
    root.iface = rootName;
    decls.push({ name: rootName, n: root });
  }
  const stack = [{ n: root, name: rootName, origin: 'root' }];
  while (stack.length) {
    const { n, name, origin } = stack.pop();
    n.name = name;
    // 追加过 2、3 的那一格，孩子跟着**声明出去的名字**走：读 text 的人看到的父亲是 RootAB2，
    // 那么它里面的数组元素就该叫 RootAB2M，跟着命名基准走会断掉这条可见的父子链
    let basis = name;
    if (origin === 'item' && n.kinds.has('object')) {
      n.iface = claim(name);
      basis = n.iface;
      decls.push({ name: n.iface, n });
    }
    const kids = [];
    for (const key of n.order) {
      kids.push({ n: n.keys.get(key).child, name: cut(`${basis}${toInterfaceName(key).name}`), origin: 'prop' });
    }
    if (n.item !== null) {
      // 键名给出的那格名字用在**元素**上；只有数组套数组与根数组没有键名，才追加 Item
      kids.push({ n: n.item, name: origin === 'prop' ? basis : cut(`${basis}Item`), origin: 'item' });
    }
    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i]);
  }
  return decls;
};

/**
 * 值形状 → 类型文本。三趟各管一段：`buildShape` 只管"样本给了什么"，`assignNames` 只管"叫什么"，
 * 这一趟只管"怎么排版"——分开放，是因为逐字相等的判据全在排版这一层，命名口径变了不该碰它。
 *
 * @param {object} root 根槽（已由 `assignNames` 写好 `name` 与 `iface`）
 * @param {string} rootName
 * @param {string} unit 缩进单位
 * @returns {{text: string, names: string[], notes: string[]}}
 */
const render = (root, rootName, unit) => {
  const flags = { union: false, optional: false, quoted: false };
  const pad = (level) => unit.repeat(Math.min(level, INDENT_LEVEL_CAP));

  /** 键名要不要加引号：属性位置连 `class`、`if` 都能直写，剩下不行的只有非法标识符那一种 */
  const keyText = (key) => {
    if (IDENT_OK.test(key)) return key;
    flags.quoted = true;
    return `"${escapeText(key)}"`;
  };

  const memberLines = (n, level) => {
    const lines = [];
    for (const key of n.order) {
      const slot = n.keys.get(key);
      const optional = n.objects > slot.hits;
      if (optional) flags.optional = true;
      lines.push(`${pad(level)}${keyText(key)}${optional ? '?' : ''}: ${typeExpr(slot.child, level)};`);
    }
    return lines;
  };

  /** 内联对象：开括号跟着成员那一格，闭合退回成员上一层 */
  const inlineObject = (n, level) => {
    const lines = memberLines(n, level + 1);
    if (lines.length === 0) return '{}';
    return `{\n${lines.join('\n')}\n${pad(level)}}`;
  };

  /**
   * 一格的类型表达式。`atomic` 只回答一个问题：**后面要挂 `[]` 的时候要不要先括起来**——
   * 顶层是并集才要括，标量、具名、内联对象、数组（`X[]` 自己就是原子）都不要。
   * 用串里有没有 `|` 来判会多套一层括号：`(number | string)[][]` 才是 `(number|string)[]` 的数组，
   * 而 `((number | string)[])[]` 是同一个东西的啰嗦写法，读它的人是复制走的那位。
   *
   * @param {object} n
   * @param {number} level
   * @returns {{text: string, atomic: boolean}}
   */
  const exprOf = (n, level) => {
    const atoms = [];
    for (const scalar of ['boolean', 'number', 'string', 'unknown']) {
      if (n.kinds.has(scalar)) atoms.push({ rank: 0, text: scalar });
    }
    if (n.kinds.has('array')) {
      const inner = n.item === null ? { text: 'unknown', atomic: true } : exprOf(n.item, level);
      atoms.push({ rank: 1, text: inner.atomic ? `${inner.text}[]` : `(${inner.text})[]` });
    }
    if (n.kinds.has('object')) {
      atoms.push(n.iface === '' ? { rank: 3, text: inlineObject(n, level) } : { rank: 2, text: n.iface });
    }
    if (n.kinds.has('null')) atoms.push({ rank: 4, text: 'null' });
    // 一格样本都没落到过（数组是空的）就交回 unknown：返回空串会拼成 `a: [];` 那样
    // **合法但说谎**的东西，而它看起来像是从样本推断出来的
    if (atoms.length === 0) return { text: 'unknown', atomic: true };
    if (atoms.length === 1) return { text: atoms[0].text, atomic: true };
    atoms.sort((a, b) => a.rank - b.rank || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
    flags.union = true;
    return { text: atoms.map((a) => a.text).join(' | '), atomic: false };
  };

  const typeExpr = (n, level) => exprOf(n, level).text;

  const interfaceBlock = (name, n) => {
    const lines = memberLines(n, 1);
    return lines.length === 0 ? `interface ${name} {}` : `interface ${name} {\n${lines.join('\n')}\n}`;
  };

  const decls = assignNames(root, rootName);
  const blocks = [];
  if (root.iface === '') blocks.push(`type ${rootName} = ${typeExpr(root, 0)};`);
  for (const decl of decls) blocks.push(interfaceBlock(decl.name, decl.n));

  const notes = [];
  if (flags.union) notes.push(NOTE_UNION);
  if (flags.optional) notes.push(NOTE_OPTIONAL);
  if (flags.quoted) notes.push(NOTE_QUOTED);
  return {
    text: [`// ${TS_HEADER_NOTE}`, ...blocks].join('\n\n'),
    names: decls.map((d) => d.name),
    notes,
  };
};

/**
 * 样本值 → 一份可复制的 TypeScript 文本。
 *
 * 只读不改：入参一个属性都不动（`T10` 拿一份深拷贝对拍这一条）。坏入参只有两档会抛——
 * `undefined`（它不是 JSON 值，静默推断成 `unknown` 只会让人以为是样本给的）与认不出的模式/根名。
 *
 * @param {unknown} value 通常是 `parseJson` 交回来的 `value`，也可以是手工造的对象
 * @param {{root?: string, indent?: 'two'|'four'|'tab'}} [options] `root` 默认 `Root`，`indent` 默认 `two`
 * @returns {{text: string, names: string[], notes: string[]}}
 *   `text` 是注释头 + 声明块（块间空一行、结尾不留换行）；`names` 是 interface 的出场顺序
 *   （根那一格若是 `type` 别名就不在里面）；`notes` 是并集 / 可选键 / 索引签名三句**该说的时候**才说的话
 */
export function generateTs(value, options = {}) {
  if (value === undefined) throw new TypeError('generateTs 不收 undefined：它不是 JSON 值，交回 unknown 只会让人以为是样本给的');
  const { root = 'Root', indent = 'two' } = options === null || typeof options === 'object' ? options : {};
  if (typeof root !== 'string') throw new TypeError(`generateTs 的 root 只收字符串，收到的是 ${root === null ? 'null' : typeof root}`);
  return render(buildShape(value), toInterfaceName(root).name, indentOf(indent));
}
