/**
 * 视图层（设计文档 §6.2）：把五格数据模块的**结果对象**渲染成 HTML 字符串。
 *
 * **纯函数、不碰 DOM、零 import**。三条都不是风格偏好：
 * - 不碰 DOM 才跑得进 Node 判据（§8.1），真 DOM 只在 §I 的手写假 DOM 与 Task 10 的 headless Chrome 各测一次；
 * - 零 import 是段 2 计划 0.2 那条实测的直接后果：这一格会被 `toolkitCore.js` 挂成 `window.Tk`
 *   供三页共用，多一条 `import` 就把 `region-data.js`（单文件 100,020 字节）或某张码表拽进
 *   跨页共享层，§7 那条"证件页 JS+CSS gzip ≤ 60KB"立刻顶破，而 `toolkitCore.min.js` 是 JSON 页
 *   也要加载的。所以**结果对象由装配层递进来**，视图一侧不持有任何数据模块。§H 有一条判据
 *   专门扫源文本数 `import` 的条数（必须为 0），往这里加一行 import 就会红。
 * - 转义只在这一处（`esc`）：装配层拿到的是串，走 `innerHTML`，视图少转一次就是页面被截断。
 *   设计文档 §7 那条深样本"含 `</script>` 的字符串值"在这里同样成立——五格都把原样输入放进
 *   `input` / `value`，用户粘贴的内容完全可能是 `</script><script>…`。
 *
 * **三态是 UI 的三态，不是模块的 `state`。** §5.4 要"有效 / 校验位不符 / 结构非法"三者可区分，
 * 而五个模块的 `state` 加起来是六档：`empty` `malformed` `checkdigit` `luhn` `unlisted` `valid`。
 * `checkdigit`（身份证、信用代码，模 11 / 模 31）与 `luhn`（银行卡）同为"校验位不符"——
 * 算法不同、对用户而言的结论是同一句；`unlisted`（行别前缀、号段查不到）既不是有效也不是无效，
 * 它就是 §5.4 那句"查不到不下无效结论"在 UI 上的形状，所以自成一档而不是塞进 `malformed`。
 * 映射只写在 `STATE_META` 一处，**未知的 `state` 一律抛**：新增一档必须同时在这里补一档，
 * 不能让"视图没见过"静默退化成"按有效渲染"。
 *
 * **口径文案归数据模块，视图不改写。** `caveat` / `note` / `id15Note` / 手机号那句 `normalized`
 * 全部原样透传（只转义），视图自己只造结构性句子（表头、"共 N 条"、"未收录"这一类）。
 * H8 拿模块常量逐字比对钉住这条分界。同一句话如果在逐项判定表里已经出现过，就不再重复一遍
 * （身份证未收录区划时 `checks.region.detail` 与 `caveat` 是同一句），这是去重不是改写。
 *
 * 与 `idcard.js` / `uscc.js` / `bankcard.js` / `phone.js` / `random-data.js` 同一套约定：
 * 入参形状不对就 `TypeError`，内部不变量被破坏就 `Error`，文案里的"收到什么"走本文件自己的
 * `shapeOf`（与各模块那份逐字同形但各自私有——跨文件共享它就要开 import 边，见上）。
 */

/** 读侧四种、生成侧八种；列定义与明细定义都按这套键取，多一格少一格都会在 §H 红 */
export const READ_KINDS = ['idcard', 'uscc', 'bank', 'mobile'];
export const BATCH_KINDS = ['idcard', 'uscc', 'bank', 'mobile', 'name', 'address', 'email', 'profile'];

/** 空值的显示形状。`null` 与"这一格没定义"是两件事，后者在 `table()` 里直接抛 */
export const EMPTY_CELL = '—';

/**
 * 六档 `state` → UI 三态 + 两档中性。`tone` 决定类名后缀（`tk-state--ok`）与外层
 * `tk-result--{tone}`，所以样式只需要认这五个词，不需要认六个模块状态。
 */
export const STATE_META = {
  valid: { label: '有效', tone: 'ok' },
  checkdigit: { label: '校验位不符', tone: 'warn' },
  luhn: { label: '校验位不符', tone: 'warn' },
  unlisted: { label: '表内未收录', tone: 'unknown' },
  malformed: { label: '结构非法', tone: 'bad' },
  empty: { label: '等待输入', tone: 'idle' },
};

/** `resolveRegion` 能给出的四种状态与四种级别，视图负责翻成 §5.4 那套措辞 */
const REGION_STATUS_CN = { current: '现行', abolished: '历史', uncoded: '未收录', unknown: '未收录' };
const REGION_LEVEL_CN = { county: '县级', city: '市级', province: '省级', none: '未命中' };

/** 逐项判定表里 `ok` 的三种取值——`null` 是"不判定"，不是"不通过" */
const CHECK_VERDICT = { true: '通过', false: '不通过' };
const CHECK_UNKNOWN = '未收录';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 报错文案里的"收到什么"，与各模块那份同形（各自私有，见文件头） */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 唯一的转义出口。只收字符串与数字——`null` / `undefined` 在这里抛，
 * "这一格可以是空"必须由列定义显式声明，不能靠 `esc` 兜住，否则真缺字段也看不出来。
 * @param {string|number} value
 */
export function esc(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`view 的 esc 只收有限数，收到 ${shapeOf(value)}`);
    return String(value);
  }
  if (typeof value !== 'string') {
    throw new TypeError(`view 的 esc 只收字符串或数字，收到 ${shapeOf(value)}`);
  }
  return value.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** 单元格：`null` / `undefined` / 空串 → `EMPTY_CELL`，其余交给 `esc` */
function cell(value) {
  if (value === null || value === undefined || value === '') return EMPTY_CELL;
  return esc(value);
}

/** 取点号路径（`name.given`）；中间任何一段不存在就是数据形状变了，抛而不是显示 `—` */
function pickPath(row, path, who) {
  let cur = row;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) {
      throw new Error(`内部不变量：${who} 的列「${path}」在数据里取不到（缺「${seg}」这一格）`);
    }
    cur = cur[seg];
  }
  return cur;
}

/**
 * 一张表的唯一构造点：表头与每一行的格数由同一段代码算出，"列数一致"是构造保证的，
 * 不是靠人记得数 `<td>`。`fmt` 用来拼跨字段的可读串，`path` 是纯取字段。
 * @param {string} who 报错与类名里用的名字
 * @param {{label:string,path?:string,fmt?:(row:object)=>(string|number|null),mono?:boolean}[]} columns
 * @param {object[]} rows
 */
function table(who, columns, rows) {
  const head = columns.map((c) => `<th scope="col"${c.mono ? ' class="tk-mono"' : ''}>${esc(c.label)}</th>`);
  const body = rows.map((row, i) => {
    const tds = columns.map((c) => {
      let v;
      if (c.fmt) v = c.fmt(row);
      else v = pickPath(row, c.path, `${who} 第 ${i + 1} 行`);
      if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') {
        throw new TypeError(`内部不变量：${who} 第 ${i + 1} 行的「${c.path || c.label}」算出来是 ${shapeOf(v)}，不是文本`);
      }
      return `<td${c.mono ? ' class="tk-mono"' : ''}>${cell(v)}</td>`;
    });
    return `<tr>${tds.join('')}</tr>`;
  });
  return `<table class="tk-table ${who}"><thead><tr>${head.join('')}</tr></thead>`
    + `<tbody>${body.join('')}</tbody></table>`;
}

/**
 * `state` → `STATE_META` 那一格，取不到就抛。徽章与外层 `tk-result--{tone}` 共用它，
 * 所以"未知状态"在两块地方只会有一处判定，不会一处抛、一处按 `undefined` 渲染。
 * @param {string} state
 */
function stateMetaOf(state) {
  if (typeof state !== 'string' || !Object.prototype.hasOwnProperty.call(STATE_META, state)) {
    throw new TypeError(`view 收到未知的状态「${shapeOf(state)}」，STATE_META 里没有这一档`);
  }
  return STATE_META[state];
}

/**
 * 三态徽章。`state` 不在 `STATE_META` 里就抛——这条判据的全部意义在于：
 * 哪天模块新增一档（比如银行卡将来要出 `expired`），页面必须当场炸给装配层，而不是把
 * 一个没定论的号显示成绿的。
 * @param {string} state
 */
export function stateBadge(state) {
  const { label, tone } = stateMetaOf(state);
  return `<span class="tk-state tk-state--${tone}">${esc(label)}</span>`;
}

/**
 * 逐项判定表（§5.4 的"让用户看得见为什么不行"）。三列固定：判定项 / 结论 / 依据。
 * `checks` 为空数组是合法输入（`state === 'empty'`、或结构在头两行就崩了），给一句明说没有的话，
 * 而不是摆一张空表——空表在屏幕读起来像"全都通过了"。
 * @param {{key:string,label:string,ok:boolean|null,detail:string}[]} checks
 */
export function checksTable(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError(`view 的 checksTable 应为判据数组，收到 ${shapeOf(checks)}`);
  }
  if (checks.length === 0) return '<p class="tk-hint">还没有可判定的内容。</p>';
  return table('tk-checks', [
    { label: '判定项', path: 'label' },
    { label: '结论', fmt: (c) => (c.ok === null ? CHECK_UNKNOWN : CHECK_VERDICT[String(c.ok)]) },
    { label: '依据', path: 'detail' },
  ], checks.map((c, i) => {
    if (c === null || typeof c !== 'object' || typeof c.label !== 'string'
      || typeof c.detail !== 'string'
      || (c.ok !== true && c.ok !== false && c.ok !== null)) {
      throw new TypeError(`内部不变量：第 ${i + 1} 条判据形状不对（需要 label/detail 字符串与 true|false|null 的 ok），收到 ${shapeOf(c)}`);
    }
    return c;
  }));
}

/**
 * 输入回显：把"用户粘贴的"与"模块拿去判的"分开显示。
 * 五格对分隔符的口径不一样（银行卡 / 手机号内部的分隔符会被吃掉后继续判，身份证与信用代码
 * 不会——它把原样串留着判、另给一句 `repairedHint`），装配层不需要记这些差别，视图照字段出货。
 * @param {object} result 任一读侧结果对象
 * @returns {string[]} 零到三条 `<p>`，没有可说时就给空数组
 */
export function echoLines(result) {
  const r = result ?? {};
  const out = [];
  const judged = typeof r.digits === 'string' ? r.digits : r.value;
  if (typeof r.input === 'string' && r.input !== '') {
    if (typeof judged === 'string' && judged !== r.input) {
      out.push(`<p class="tk-echo">原样输入 <span class="tk-mono">${esc(r.input)}</span>，参与判定的是 <span class="tk-mono">${esc(judged)}</span>。</p>`);
    } else if (typeof judged === 'string') {
      out.push(`<p class="tk-echo">判定对象 <span class="tk-mono">${esc(judged)}</span>。</p>`);
    } else {
      out.push(`<p class="tk-echo">原样输入 <span class="tk-mono">${esc(r.input)}</span>。</p>`);
    }
  }
  if (typeof r.repairedHint === 'string' && r.repairedHint !== '') {
    out.push(`<p class="tk-hint">去掉中间的分隔符后是 <span class="tk-mono">${esc(r.repairedHint)}</span>，那一串才是合法长度。</p>`);
  }
  if (r.normalized === true) {
    out.push('<p class="tk-hint">字母按大写解释。</p>');
  } else if (typeof r.normalized === 'string' && r.normalized !== '') {
    out.push(`<p class="tk-hint">${esc(r.normalized)}。</p>`);
  }
  return out;
}

/** 区划那两格的可读写法：全称 + §5.4 要求的命中级别 */
function regionRow(region, who) {
  if (region === null || typeof region !== 'object') return null;
  const level = REGION_LEVEL_CN[region.level];
  const status = REGION_STATUS_CN[region.status];
  if (!level || !status) {
    throw new Error(`内部不变量：${who} 拿到未知的区划命中口径（level=${shapeOf(region.level)} status=${shapeOf(region.status)}）`);
  }
  return `${region.fullName}（${level} · ${status}）`;
}

/**
 * 读侧明细表的列定义。每格都是"从结果对象里取哪两样拼成一句人话"，
 * 取不到就返回 `null`（渲染成 `—`），但**字段本身缺失**会抛——见 `pickPath` 与 `fmt` 的分工。
 * 键与 `READ_KINDS` 一一对应，多一个少一个 H6 就红。
 */
const DETAIL_SPEC = {
  idcard: [
    { label: '区划', fmt: (r) => (r.info.areaCode ? `${r.info.areaCode} · ${regionRow(r.info.region, '身份证')}` : null) },
    { label: '出生日期', fmt: (r) => r.info.birth },
    { label: '年龄', fmt: (r) => (r.info.ageYears === null ? null : `${r.info.ageYears} 岁`) },
    { label: '性别', fmt: (r) => r.info.sex },
    { label: '顺序码', fmt: (r) => r.info.seq },
    { label: '校验位', fmt: (r) => (r.info.checkBit ? `号码末位 ${r.info.checkBit}，算得 ${r.info.expectedCheckBit}` : null) },
    { label: '校验算式', fmt: (r) => (r.info.checkWork ? `Σ ${r.info.checkWork.sum} · mod 11 = ${r.info.checkWork.mod} · 对照表 ${r.info.checkWork.table}` : null) },
    { label: '18 位写法', fmt: (r) => r.id18, mono: true },
    { label: '15 位写法', fmt: (r) => r.id15, mono: true },
    { label: '区划数据截止', fmt: (r) => r.info.datasetVersion },
  ],
  uscc: [
    { label: '区划', fmt: (r) => (r.info.regionCode ? `${r.info.regionCode} · ${regionRow(r.info.region, '统一社会信用代码')}` : null) },
    { label: '登记管理部门码', fmt: (r) => r.info.registry.char, mono: true },
    { label: '机构类别码', fmt: (r) => r.info.category.char, mono: true },
    { label: '主体标识', fmt: (r) => r.info.subject, mono: true },
    { label: '组织机构代码', fmt: (r) => r.info.body8, mono: true },
    { label: '组织机构代码校验位', fmt: (r) => `号码第 9 位 ${r.info.orgChar}，算得 ${r.info.orgChecksum.value}（Σ ${r.info.orgChecksum.sum} · mod 11 = ${r.info.orgChecksum.remainder}）` },
    { label: '校验位', fmt: (r) => `号码末位 ${r.info.checkBit}，算得 ${r.info.expectedCheckBit}` },
    { label: '校验算式', fmt: (r) => `Σ ${r.info.checksum.sum} · mod 31 = ${r.info.checksum.remainder}` },
  ],
  bank: [
    { label: '位数', fmt: (r) => r.info.length },
    { label: '命中前缀', fmt: (r) => (r.info.bin ? `${r.info.bin}（${r.info.binLength} 位）` : null), mono: true },
    { label: '发卡行', fmt: (r) => (r.info.primary ? `${r.info.primary.bankName}（${r.info.primary.bankCode}）` : null) },
    { label: '卡种', fmt: (r) => (r.info.primary ? r.info.primary.cardTypeName : null) },
    { label: '表内登记位数', fmt: (r) => (r.info.primary ? r.info.primary.panLength : null) },
    { label: 'Luhn', fmt: (r) => (r.info.luhnGiven ? `号码末位 ${r.info.luhnGiven}，算得 ${r.info.luhnExpected}` : null) },
    { label: 'Luhn 算式', fmt: (r) => (r.info.luhnWork ? `Σ ${r.info.luhnWork.sum} · mod 10 = ${r.info.luhnWork.mod} → 校验位应为 ${r.info.luhnWork.expected}` : null) },
    { label: '行别来源', fmt: (r) => r.info.source },
  ],
  mobile: [
    { label: '位数', fmt: (r) => r.info.length },
    { label: '号段', fmt: (r) => r.info.segment, mono: true },
    { label: '运营商', fmt: (r) => r.info.carrier },
    { label: '展示格式', fmt: (r) => r.info.formatted, mono: true },
    { label: '号段来源', fmt: (r) => r.info.source },
  ],
};

/** 同前缀多行命中时另起的那张表（`matches.length > 1`） */
const MATCH_COLUMNS = [
  { label: '前缀', path: 'bin', mono: true },
  { label: '发卡行', path: 'bankName' },
  { label: '卡种', path: 'cardTypeName' },
  { label: '登记位数', path: 'panLength' },
  { label: '与本号位数吻合', fmt: (m) => (m.lengthMatches ? '是' : '否') },
];

/**
 * 解码明细表。`info` 为 `null`（结构在头几行就不成立）时不出表——
 * 那时没有任何算术量可信，出表就等于把一堆 `—` 摆成"解出来了但都是空"。
 * @param {string} kind `READ_KINDS` 之一
 * @param {object} result 该格的读侧结果
 */
export function detailTable(kind, result) {
  const columns = DETAIL_SPEC[kind];
  if (!columns) throw new TypeError(`view 的 detailTable 收到未知的 kind「${shapeOf(kind)}」，可读的值只有 ${READ_KINDS.join(' / ')}`);
  const r = result ?? {};
  if (r.info === null || r.info === undefined) return '';
  return table('tk-detail', columns, [r]);
}

/** 结构不成立 / 未收录时的"还能怎么办"那一行：`suggested*` 与 `expectedCheckBit` 走同一出口 */
const SUGGEST_KEY = { idcard: 'suggestedId18', bank: 'suggestedCard' };

export function suggestLine(kind, result) {
  const key = SUGGEST_KEY[kind];
  const v = key && result ? result[key] : '';
  if (!v) return '';
  return `<p class="tk-hint">只改校验位就能自洽：<span class="tk-mono">${esc(v)}</span>（随机合成，别当真实号码用）。</p>`;
}

/** 生成结果表的列定义，键与 `BATCH_KINDS` 一一对应 */
const COLUMNS = {
  idcard: [
    { label: '号码', path: 'id18', mono: true },
    { label: '区划', path: 'region' },
    { label: '出生日期', path: 'birth' },
    { label: '年龄', path: 'age' },
    { label: '性别', path: 'sex' },
  ],
  uscc: [
    { label: '代码', path: 'code', mono: true },
    { label: '区划', path: 'regionName' },
    { label: '主体标识', path: 'subject', mono: true },
    { label: '校验位', path: 'checkBit', mono: true },
  ],
  bank: [
    { label: '卡号', path: 'formatted', mono: true },
    { label: '发卡行', path: 'bankName' },
    { label: '卡种', path: 'cardTypeName' },
    { label: '登记位数', path: 'panLength' },
  ],
  mobile: [
    { label: '号码', path: 'formatted', mono: true },
    { label: '号段', path: 'segment', mono: true },
    { label: '运营商', path: 'carrier' },
  ],
  name: [
    { label: '姓名', path: 'name' },
    { label: '姓', path: 'surname' },
    { label: '名', path: 'given' },
    { label: '名字数', path: 'givenLength' },
  ],
  address: [
    { label: '地址', path: 'text' },
    { label: '区划码', path: 'areaCode', mono: true },
  ],
  email: [
    { label: '邮箱', path: 'email', mono: true },
    { label: '域', path: 'domain', mono: true },
  ],
  profile: [
    { label: '姓名', path: 'name.name' },
    { label: '地址', path: 'address.text' },
    { label: '邮箱', path: 'email.email', mono: true },
  ],
};

/**
 * 一批生成结果的表格。
 * @param {string} kind `BATCH_KINDS` 之一
 * @param {object[]} rows
 */
export function listTable(kind, rows) {
  const columns = COLUMNS[kind];
  if (!columns) {
    throw new TypeError(`view 的 listTable 收到未知的 kind「${shapeOf(kind)}」，可渲染的值只有 ${BATCH_KINDS.join(' / ')}`);
  }
  if (!Array.isArray(rows)) throw new TypeError(`view 的 listTable 应为结果数组，收到 ${shapeOf(rows)}`);
  if (rows.length === 0) return '<p class="tk-hint">这次没有产出任何结果。</p>';
  return table(`tk-list tk-list--${kind}`, columns, rows);
}

/**
 * 口径行：模块给的句子原样落地（转义后），一条一个 `<p>`。
 * 空串与 `null` 跳过，所以装配层可以直接把 `result.caveat` / `NOTE` 常量整包丢进来。
 * @param {(string|null|undefined)[]} texts
 */
export function noteLines(texts) {
  if (!Array.isArray(texts)) throw new TypeError(`view 的 noteLines 应为字符串数组，收到 ${shapeOf(texts)}`);
  return texts
    .filter((t) => typeof t === 'string' && t !== '')
    .map((t) => `<p class="tk-note">${esc(t)}</p>`);
}

/**
 * 一块读侧结果：徽章 + 回显 + 逐项判定表 + 明细表 +（银行卡多行命中时）前缀表 + 建议 + 口径行。
 * 顺序在这里定死，装配层不再挑——五块面板长得一样是要求，不是巧合。
 * 结果区的外层容器与 `aria-live` 由构建期骨架给（Task 8），视图只交内容，不碰属性。
 * @param {string} kind `READ_KINDS` 之一
 * @param {object} result
 * @param {(string|null|undefined)[]} notes 装配层递进来的模块常量（如信用代码那句"第 1、2 位不给名称"）——
 *   视图不 import 它们，但结果区的话术完整性由这一格补齐
 */
export function parseBlock(kind, result, notes = []) {
  if (!Array.isArray(notes)) throw new TypeError(`view 的 parseBlock 的 notes 应为数组，收到 ${shapeOf(notes)}`);
  const r = result ?? {};
  const parts = [`<p class="tk-verdict">${stateBadge(r.state)}</p>`];
  parts.push(...echoLines(r));
  parts.push(checksTable(r.checks === undefined ? [] : r.checks));
  parts.push(detailTable(kind, r));
  if (kind === 'bank' && Array.isArray(r.matches) && r.matches.length > 1) {
    parts.push(table('tk-matches', MATCH_COLUMNS, r.matches));
  }
  parts.push(suggestLine(kind, r));
  const own = [r.id15Note, r.caveat, r.note].filter((t) => typeof t === 'string' && t !== '');
  const texts = [...own, ...notes.filter((t) => typeof t === 'string' && t !== '')];
  // 身份证未收录区划时 `caveat` 与 `checks.region.detail` 是同一句，判定表已经说过就不再重复
  const shown = (r.checks || []).map((c) => c.detail);
  parts.push(...noteLines(texts.filter((t) => !shown.includes(t))));
  return `<div class="tk-result tk-result--${stateMetaOf(r.state).tone}">${parts.filter((x) => x !== '').join('')}</div>`;
}

/**
 * 一块生成结果：条数 + 表格 + 口径行。
 * @param {string} kind `BATCH_KINDS` 之一
 * @param {object[]} rows
 * @param {(string|null|undefined)[]} notes 模块给的口径常量，由装配层传进来（视图不 import 它们）
 */
export function batchBlock(kind, rows, notes = []) {
  if (!Array.isArray(notes)) throw new TypeError(`view 的 batchBlock 的 notes 应为数组，收到 ${shapeOf(notes)}`);
  const n = Array.isArray(rows) ? rows.length : 0;
  const parts = [`<p class="tk-count">共 ${n} 条</p>`, listTable(kind, rows), ...noteLines(notes)];
  return `<div class="tk-batch tk-batch--${kind}">${parts.join('')}</div>`;
}
