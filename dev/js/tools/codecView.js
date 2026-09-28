/**
 * 编码工具箱页五块面板的**纯字符串视图层**：模型进、HTML 出。
 *
 * 这一本处在装配层与结果区之间，只做一件事——把 `time.js` / `codec.js` / `digest.js` /
 * `regex.js` 四本纯模块的结果对象变成 `tk-result` 那一族 DOM 片段。它不碰 DOM、不读时钟、
 * 不读环境，所有输入都由 `codecWorkbench.js` 递进来。
 *
 * 四条红线，§Q 的判据逐条对着咬：
 *
 * 1. **零 import，且不进 `window.Tk`**（§Q2）。它只由 `codecWorkbench.js` 一本 import：
 *    只有一个入口 reach 它，Rollup 就不会把它提成共享 chunk，产物里也就没有那句会把整页
 *    打成 SyntaxError 的 `import{`（实测记录在 `dev/js/toolkitCore.js` 开头）。反过来它自己
 *    一旦 import 别的东西，"只有一个入口"这条前提就没了。而把它挂进 `Tk` 的后果是**证件页
 *    替编码页的五块面板付 gzip**——§7 那一行余量只剩 4,173B（2026-09-28 证件页表格收口后按
 *    `cat f | gzip -9 | wc -c` 复量，三件 2,135 / 7,037 / 64,479），挂不得。
 * 2. **转义只有一处出口**（§Q3）。`esc` / `EMPTY_CELL` / `checksTable` / `noteLines` 四样
 *    全部来自注入的那只 `view`（`window.Tk.view`）。这一本里不许长出第二只 `esc`、第二张
 *    实体映射表、第二个破折号字面量：两份实现的下场必然是"改了一份、页面上跑的是另一份"。
 *    表格那一半**允许**自带（`view.js` 里的 `table` 是私有函数，共享它就得开 import 边），
 *    但每一格都逐格经注入的 `esc`，所以 §Q15 那条"五块面板都不许漏转义"仍然只需要盯一处。
 * 3. **未知 verdict 与跨面板错配都抛**（§Q5）。与 `view.js` 的 `stateMetaOf` 同一条口径：
 *    哪天纯模块新增一档，页面必须当场炸给装配层，而不是把一个没定论的结果渲成绿的。
 *    这一本还多一张「面板 → 允许的 verdict」白名单：时间戳面板报"已编码"就是映射写错。
 * 4. **五块面板外层骨架同形**（§Q6）。`<div class="tk-result tk-result--{tone}">` 包一层、
 *    徽章那一行恰好一个，与 `view.parseBlock` 那一条一致；`toolkit.scss` 只写了
 *    `tk-state--ok/warn/bad/unknown/idle` 五档徽章，档位词表就是从那里来的，多一档就是
 *    一个没有样式的类名。
 *
 * 与 `view.js` 的分工：那一本管证件页的四读八生成，这一本管编码页的五块面板，互不 import，
 * 共用的是同一只注入进来的 `view`。措辞也归视图：装配层只交事实（数字、串、布尔、null），
 * "补齐的 padding"、"环境不支持"这类话术只在这一本里写，用户读到的句子才不会一页一个说法。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §Q 十六判（`toolkit-tests.mjs` 末尾）。
 */

/**
 * 样式层认得的五档颜色后缀，逐字对着 `dev/sass/toolkit.scss` 的 `.tk-state--*` 五条规则。
 * 这一格写成数组而不是集合，是因为 §Q1 要钉顺序——多一档、少一档、重排都要红。
 */
export const CODEC_TONES = ['ok', 'warn', 'bad', 'unknown', 'idle'];

/**
 * verdict → 徽章文案与档位。十三个词是五块面板全部可能落到的结论，`tone` 只有五个值。
 * 键序即契约：§Q1 用 `Object.keys` 逐字对表，白名单也按这张表取词。
 */
export const CODEC_META = {
  converted: { label: '已换算', tone: 'ok' },
  encoded: { label: '已编码', tone: 'ok' },
  decoded: { label: '已解码', tone: 'ok' },
  computed: { label: '已算出', tone: 'ok' },
  matched: { label: '有命中', tone: 'ok' },
  ambiguous: { label: '长度两可', tone: 'unknown' },
  nomatch: { label: '零命中', tone: 'unknown' },
  lossy: { label: '有还原损耗', tone: 'warn' },
  partial: { label: '部分可用', tone: 'warn' },
  capped: { label: '已到上限', tone: 'warn' },
  invalid: { label: '不成立', tone: 'bad' },
  rejected: { label: '已拒收', tone: 'bad' },
  empty: { label: '等待输入', tone: 'idle' },
};

/**
 * 每块面板允许出现的 verdict。错配（时间戳面板报"已编码"）在渲染之前就抛——装配层的映射
 * 表写错时，后果本来是一句被用户当事实读的文案。
 */
export const PANEL_VERDICTS = {
  timestamp: ['converted', 'ambiguous', 'invalid', 'empty'],
  base64: ['encoded', 'decoded', 'lossy', 'invalid', 'rejected', 'empty'],
  url: ['encoded', 'decoded', 'invalid', 'rejected', 'empty'],
  digest: ['computed', 'partial', 'invalid', 'rejected', 'empty'],
  regex: ['matched', 'nomatch', 'capped', 'invalid', 'rejected', 'empty'],
};

/** `codec.js` 那两档编码口径的差异字符数，§Q9 与 §L 的 L11 是同一件事的两个面 */
const URL_DIFF_SENTENCE = '个字符在这一档不编码、在那一档编码';

/**
 * 回显封顶的字符数（按码点算）。时间戳那一块的输入本来就 ≤ 64 字符（`time.js` 的
 * `MAX_INPUT_LEN`），永远走不到截断那一支；真正需要它的是 Base64 / URL 那两块 1 MiB 的输入框。
 */
const ECHO_MAX_CHARS = 200;

/** `viaOf` 的三档说法：谁算的必须说清，否则"MD5 出了、SHA 没出"读起来像都失败 */
const VIA_CN = { self: '本站自实现', subtle: '浏览器 crypto', unavailable: '环境不支持' };

/** 正则风险级别：`riskScan` 只给 high / medium，`none` 那一档压根不进这张表 */
const LEVEL_CN = { high: '高危', medium: '中等' };

/** `dateDiff().breakdown` 那六个 `unit` 的中文名，键集与 `time.js` 给的那一张表逐字对齐 */
const DIFF_UNIT_CN = { ms: '毫秒', s: '秒', min: '分钟', h: '小时', d: '天', wk: '周' };

/** 解码列的三种取值：`null` 是"这一格没判"，与 false 的"解不出"是两件事 */
const DECODE_CN = { true: '可以', false: '解不出' };

/**
 * 时间戳两读的中文名。`time.js` 的 `parseTimestamp().readings[].kind` 给的是 `second` / `milli`
 * 两个 token（§K 的 K2 钉死顺序），中文说法归视图：装配层只交事实，用户读到的句子在一本里写。
 */
const READING_CN = { second: '按秒', milli: '按毫秒' };

/** 报错文案里的"收到什么"，与 `view.js` / 四本纯模块那份同形（各自私有，见上面第 2 条） */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 注入依赖的名字与判法：`EMPTY_CELL` 是常量，其余三样是函数 */
const REQUIRED = {
  esc: 'function',
  checksTable: 'function',
  noteLines: 'function',
  EMPTY_CELL: 'string',
};

/**
 * 造一只编码页视图。闸门排在构造期：缺依赖的后果本来是"渲染到某一格才炸"，
 * 那时已经落在某一块具体面板里，报错里既没有缺的名字也没有装配层的形状。
 * @param {object} view `window.Tk.view`，必须齐 `esc` / `EMPTY_CELL` / `checksTable` / `noteLines`
 * @returns {object} 五块面板的渲染函数与两只公用件（`badge` / `fieldsTable`）
 */
export function createCodecView(view) {
  const v = view ?? {};
  const missing = Object.keys(REQUIRED).filter((k) => typeof v[k] !== REQUIRED[k]);
  if (missing.length > 0) {
    throw new TypeError(`createCodecView：注入的 view 缺 ${missing.join(' / ')}（应是 window.Tk 里那份 view，跨页共用层不许 import）`);
  }
  const { esc, EMPTY_CELL, checksTable, noteLines } = v;

  /** 取一档 verdict 的元信息；不在总表里就抛（与 `view.js` 的 stateMetaOf 同一条口径） */
  const metaOf = (verdict, where) => {
    if (typeof verdict !== 'string' || !Object.prototype.hasOwnProperty.call(CODEC_META, verdict)) {
      throw new TypeError(`${where} 收到未知的结论「${shapeOf(verdict)}」，CODEC_META 里没有这一档`);
    }
    return CODEC_META[verdict];
  };

  /** 白名单那一层：总表里有、这块面板不该有，就是装配层的映射写错了 */
  const verdictOf = (panel, verdict) => {
    const list = PANEL_VERDICTS[panel];
    if (!Array.isArray(list)) {
      throw new RangeError(`编码页视图只服务这五块面板：${Object.keys(PANEL_VERDICTS).join(' / ')}`);
    }
    const m = metaOf(verdict, `${panel} 面板`);
    if (!list.includes(verdict)) {
      throw new TypeError(`内部不变量：${panel} 面板得不出「${verdict}」这一档结论（映射表写错了；白名单是 ${list.join(' / ')}）`);
    }
    return m;
  };

  /** 一句人话的提示行；`tk-hint` 与证件页共用同一个类名 */
  const hint = (text) => `<p class="tk-hint">${esc(text)}</p>`;

  /**
   * 用户那一行原样回显；空串不占一行。
   * **封顶**在视图这一层：证件页的输入是 18 / 18 / 19 位的数字串，编码页的输入按 §5.2 那三道
   * 闸门允许到 1 MiB——不封顶就是让结果区把用户刚粘进去的东西再打一遍，节点数直接翻倍。
   * 按码点切而不是按 `char.length` 切：一个 emoji 的两个码元切一半，页面上就是一个替换字符。
   */
  const echo = (text) => {
    if (typeof text !== 'string' || text === '') return '';
    const cps = Array.from(text);
    const shown = cps.length <= ECHO_MAX_CHARS ? text
      : `${cps.slice(0, ECHO_MAX_CHARS).join('')}…（已截断，输入共 ${cps.length} 字符）`;
    return `<p class="tk-echo">输入 <span class="tk-mono">${esc(shown)}</span></p>`;
  };

  /**
   * 一格取值：`null` / `undefined` / 空串 → `EMPTY_CELL`，其余交给注入的 `esc`。
   * 非文本的取值（对象、数组）在这里抛，不等 `esc` 抛——点名第几行才有用。
   */
  const cellOf = (value, where) => {
    if (value === null || value === undefined || value === '') return EMPTY_CELL;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`内部不变量：${where} 算出来是 ${shapeOf(value)}，不是文本`);
    }
    return esc(value);
  };

  /**
   * 通用表格构造点（与 `view.js` 那个私有的 `table` 同形状，但每一格都走注入的 `esc`）。
   * 表头与每行的格数由同一段代码算出，"列数一致"是构造保证的，不是靠人记得数 `<td>`。
   * @param {string} who 类名后缀与报错主语
   * @param {{label:string,mono?:(boolean|((row:object)=>boolean)),get:(row:object)=>(string|number|null)}[]} columns
   * @param {object[]} rows
   * @returns {string} 空行集返回空串——空表在屏幕上读起来像"全都通过了"
   */
  const grid = (who, columns, rows) => {
    if (rows === undefined || rows === null) return '';
    if (!Array.isArray(rows)) throw new TypeError(`内部不变量：${who} 的行集应为数组，收到 ${shapeOf(rows)}`);
    if (rows.length === 0) return '';
    // `mono` 允许是谓词：同一列里"哪些格走等宽"是随行走变化的（明细表的值列就是），
    // 写成 `c.mono ?` 会把函数当真值，于是整列连表头一起等宽。
    const monoAt = (c, row) => (typeof c.mono === 'function' ? c.mono(row) === true : c.mono === true);
    const head = columns
      .map((c) => `<th scope="col"${c.mono === true ? ' class="tk-mono"' : ''}>${esc(c.label)}</th>`)
      .join('');
    const body = rows
      .map((row, i) => `<tr>${columns
        .map((c) => `<td${monoAt(c, row) ? ' class="tk-mono"' : ''}>${cellOf(c.get(row), `${who} 第 ${i + 1} 行「${c.label}」`)}</td>`)
        .join('')}</tr>`)
      .join('');
    return `<table class="tk-table ${who}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  /**
   * 一栏"项目 / 值"两列的明细表，五块面板共用的那一张。
   * @param {{label:string,value:(string|number|null),mono?:boolean}[]} rows
   */
  const fieldsTable = (rows) => {
    if (!Array.isArray(rows)) throw new TypeError(`fieldsTable 的行集应为数组，收到 ${shapeOf(rows)}`);
    rows.forEach((row, i) => {
      if (row === null || typeof row !== 'object' || typeof row.label !== 'string' || !('value' in row)) {
        throw new TypeError(`内部不变量：fieldsTable 第 ${i + 1} 行缺 label 或缺 value（需要 {label, value, mono?}，收到 ${shapeOf(row)}）`);
      }
    });
    return grid('tk-detail', [
      { label: '项目', get: (r) => r.label },
      { label: '值', mono: (r) => r.mono === true, get: (r) => r.value },
    ], rows);
  };

  /**
   * 一行"结果"文本，形状与证件页那一族逐字对齐（`workbench.js` 的 `renderRead`）：
   * `.tk-lines` 是 grid 容器，`.tk-line` 是带下边框的一节，`.tk-line__head` 有块级 margin
   * 所以必须是 `<p>`。`tk-line__raw` **不再叠 `tk-mono`**——`toolkit.scss:581` 那一格已经写了
   * `$tk-meta` 等宽栈与 `word-break: break-all`，再加一个类是同一条规则写两处。
   * 复制按钮不在这一格里：它由页面骨架常驻给（证件页就是这个形状），视图只产文本。
   */
  const outLines = (label, text) => {
    if (typeof text !== 'string' || text === '') return '';
    return '<div class="tk-lines"><section class="tk-line">'
      + `<p class="tk-line__head">${esc(label)}</p>`
      + `<p class="tk-line__raw">${esc(text)}</p></section></div>`;
  };

  /** 字节数那一行。`0` 不占一行：闸门拦下与还没输入都可能是 0，说一句"0 字节"只会添乱 */
  const bytesLine = (n, prefixText) => (typeof n === 'number' && n > 0
    ? `<p class="tk-count">${prefixText ? `${esc(prefixText)} ` : ''}${esc(n)} 字节</p>` : '');

  /** 口径行：装配层把模块的 CAVEAT 常量整包递进来，重复过的那句丢掉 */
  const notesOf = (notes, already) => {
    const list = notes ?? [];
    if (!Array.isArray(list)) throw new TypeError(`编码页视图的 notes 应为数组，收到 ${shapeOf(list)}`);
    return noteLines(list.filter((t) => typeof t === 'string' && t !== '' && !already.includes(t)));
  };

  /** 这一段是不是"真的把东西给用户了"：表格 / 等宽结果行 / 计数行，三样之一 */
  const showsResult = (html) => html.includes('<table')
    || html.includes('tk-line__raw') || html.includes('tk-count');

  /**
   * 一块面板的完整外层：徽章行 +（reason 提示）+（回显）+（判定表）+ 面板自己的内容 + 口径行。
   * "没有可显示的内容"那句只在**既没有结果、也没有 reason**时补，避免和 reason 重复。
   * 什么算"有结果"由 `showsResult` 说清楚：表格、等宽结果行、字节数行三样之一。提示行不算——
   * 一句 `tk-hint` 正是"没有结果"的说法本身，把它算成结果就等于永远不说那句明说的话。
   * @param {string} panel 面板名（白名单那一层在这里生效）
   * @param {object} m 视图模型
   * @param {(string|null|undefined)[]} notes 模块给的口径常量
   * @param {(model:object)=>string[]} bodyOf 各面板自己的内容
   */
  const wrap = (panel, m, notes, bodyOf) => {
    const model = m ?? {};
    const { label, tone } = verdictOf(panel, model.verdict);
    const parts = [`<p class="tk-verdict"><span class="tk-state tk-state--${tone}">${esc(label)}</span></p>`];
    const reason = typeof model.reason === 'string' && model.reason !== '' ? hint(model.reason) : '';
    if (reason) parts.push(reason);
    parts.push(echo(model.input));
    const shownDetails = [];
    if (Array.isArray(model.checks)) {
      parts.push(checksTable(model.checks));
      for (const c of model.checks) if (c && typeof c.detail === 'string') shownDetails.push(c.detail);
    }
    const body = bodyOf(model);
    const hasBody = body.some((x) => x !== '' && showsResult(x));
    parts.push(...body.filter((x) => x !== ''));
    if (!hasBody && !reason) parts.push(hint('这一栏还没有可显示的结果。'));
    parts.push(...notesOf(notes, [...shownDetails, model.reason]));
    return `<div class="tk-result tk-result--${tone}">${parts.filter((x) => x !== '').join('')}</div>`;
  };

  /** 徽章本身：给装配层与判据用，块函数自己走 `wrap` */
  const badge = (verdict) => {
    const { label, tone } = metaOf(verdict, 'badge');
    return `<span class="tk-state tk-state--${tone}">${esc(label)}</span>`;
  };

  // ── 五块面板 ──────────────────────────────────────────────────────────────

  /**
   * 两个日期之差。`diff` 就是 `time.js` 的 `dateDiff()` 返回值原样进（字段同名，视图不 import 它），
   * 三种口径**同时给**，不许替用户挑一种：`totalDays`（整 24 小时）与 `calendarDays`（跨 UTC 日历日）
   * 在 23:00 → 次日 01:00 这种样本上就是 0 与 1，只报一个数等于把另一种口径藏起来（§K 的 K9）。
   * `ymd` 是 |差| 的分解、永远非负（K8），所以 `sign < 0` 时必须补一句方向，否则"1 年 0 个月 1 天"
   * 会被读成正向的那一种。
   */
  const diffOf = (diff) => {
    if (diff === null || diff === undefined) return [];
    const d = diff;
    if (typeof d !== 'object' || Array.isArray(d)
      || typeof d.totalDays !== 'number' || typeof d.calendarDays !== 'number'
      || d.ymd === null || typeof d.ymd !== 'object' || !Array.isArray(d.breakdown)) {
      throw new TypeError(`内部不变量：timestamp 面板的 diff 应是 dateDiff 的返回形状（totalDays / calendarDays / ymd / breakdown），收到 ${shapeOf(d)}`);
    }
    const rows = [
      { label: '日历分解', value: `${d.ymd.years} 年 ${d.ymd.months} 个月 ${d.ymd.days} 天`, mono: true },
      { label: '整 24 小时', value: `${d.totalDays} 天`, mono: true },
      { label: '跨 UTC 日历日', value: `${d.calendarDays} 天`, mono: true },
    ];
    const units = grid('tk-detail', [
      { label: '单位', get: (r) => unitOf(r.unit) },
      { label: '个数', mono: true, get: (r) => r.value },
    ], d.breakdown);
    const says = [];
    if (d.sign < 0) says.push(hint('结束那一端在开始那一端之前，上面那些数说的是绝对值。'));
    if (d.totalDays !== d.calendarDays) {
      says.push(...noteLines(['整 24 小时与跨 UTC 日历日是两种口径：23:00 到次日 01:00 是 0 天与 1 天。']));
    }
    return [fieldsTable(rows), units, ...says];
  };

  const unitOf = (unit) => {
    if (typeof unit !== 'string' || !Object.prototype.hasOwnProperty.call(DIFF_UNIT_CN, unit)) {
      throw new TypeError(`timestamp 面板收到未知的差值单位「${shapeOf(unit)}」`);
    }
    return DIFF_UNIT_CN[unit];
  };

  /** 两读的解释那一列：token 认不出来就抛，页面上少一列读数比抛错更难查 */
  const readingOf = (kind) => {
    if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(READING_CN, kind)) {
      throw new TypeError(`内部不变量：readings[].kind 只认 second / milli，收到「${shapeOf(kind)}」（中文说法在视图这一层的 READING_CN 里，装配层不许自己写）`);
    }
    return READING_CN[kind];
  };

  /** 时间戳：读数（ambiguous 两行）+ 明细 + 相对时间那一行 +（可选）两个日期之差 */
  const timestampBlock = (m, notes = []) => wrap('timestamp', m, notes, (model) => {
    const readings = grid('tk-matches', [
      { label: '解释', get: (r) => readingOf(r.kind) },
      { label: 'epoch', mono: true, get: (r) => r.epochMs },
      { label: 'UTC', mono: true, get: (r) => r.isoUtc },
    ], model.readings);
    const fields = Array.isArray(model.fields) ? model.fields.slice() : [];
    if (typeof model.relative === 'string' && model.relative !== '') {
      fields.push({ label: '相对时间', value: model.relative });
    }
    return [readings, fieldsTable(fields), ...diffOf(model.diff)];
  });

  /**
   * Base64：结果那一栏（等宽、可整段选中）+ 字节数 + 损耗明细。
   * 方向（编码 / 解码 / data URI）刻意**不进结果区**：它由工作台那组分段控件常驻显示，
   * 在结果里再说一遍只是把用户已经看见的东西再打一遍字，而 §7 的余量按字节算。
   */
  const base64Block = (m, notes = []) => wrap('base64', m, notes, (model) => [
    outLines('结果', model.out),
    bytesLine(model.bytes),
    fieldsTable(model.fields ?? []),
  ]);

  /** URL：两档并列 + 那 11 个差异字符 + 两档各解一次 + query 参数拆解 */
  const urlBlock = (m, notes = []) => wrap('url', m, notes, (model) => {
    const pair = grid('tk-detail', [
      { label: '档位', get: (r) => r.name },
      { label: '结果', mono: true, get: (r) => r.out },
    ], model.pair);
    const differs = Array.isArray(model.differs) && model.differs.length > 0
      ? hint(`${model.differs.length} ${URL_DIFF_SENTENCE}：${model.differs.join(' ')}`) : '';
    const tries = grid('tk-detail', [
      { label: '试的字段', get: (r) => r.field },
      { label: '结果', mono: true, get: (r) => (r.ok ? r.out : EMPTY_CELL) },
      { label: '结论', get: (r) => (r.ok === null ? EMPTY_CELL : DECODE_CN[String(r.ok)]) },
      { label: '说明', get: (r) => r.reason },
    ], model.decodeTries);
    const query = grid('tk-detail', [
      { label: '原始片段', mono: true, get: (r) => r.raw },
      { label: '键', mono: true, get: (r) => r.key },
      { label: '值', mono: true, get: (r) => r.value },
      { label: '键解码', get: (r) => (r.keyOk === null || r.keyOk === undefined ? EMPTY_CELL : DECODE_CN[String(r.keyOk)]) },
      { label: '值解码', get: (r) => (r.valueOk === null || r.valueOk === undefined ? EMPTY_CELL : DECODE_CN[String(r.valueOk)]) },
      { label: '说明', get: (r) => r.reason },
    ], model.queryRows);
    return [pair, differs, tries, query, bytesLine(model.bytes)];
  });

  /** 摘要：五格恒定行序 + 来源那一列（谁算的）+ 字节数 */
  const digestBlock = (m, notes = []) => wrap('digest', m, notes, (model) => {
    const rows = grid('tk-matches', [
      { label: '算法', get: (r) => r.algo },
      { label: '摘要', mono: true, get: (r) => r.hex },
      { label: '字节', get: (r) => r.bytes },
      { label: '来源', get: (r) => viaOf(r.via) },
      { label: '说明', get: (r) => r.reason },
    ], model.rows);
    const kindText = model.kind === 'bytes' ? '字节' : model.kind === 'text' ? '文本' : '';
    return [rows, bytesLine(model.bytes, kindText)];
  });

  const viaOf = (via) => {
    if (typeof via !== 'string' || !Object.prototype.hasOwnProperty.call(VIA_CN, via)) {
      throw new TypeError(`digest 面板收到未知的来源「${shapeOf(via)}」`);
    }
    return VIA_CN[via];
  };

  /**
   * 正则：风险表 + 命中表 + 捕获组表 + 替换预览 + 两面旗与那个上限数。
   * `hitLimit`（次数到点）与 `timedOut`（档间时间到点）是两件不同的事，互相顶掉就等于把闸门的
   * 形状藏起来；`capped` 不是第三面旗，它是**本次生效的上限次数**那个数字（§N 的 N8 钉的这一对），
   * 只在前者成立时把它一起报出来——"到了上限"后面不跟一个数，用户分不清是本站硬闸门还是这一档的预算。
   * 模型里的 `pattern` 与 `level` 刻意不渲：前者是输入框本来就常驻显示的东西，
   * 后者是 `findings` 的派生值（`regex.js` 里 level 由 findings 有没有 high 算出来），
   * 表里那一列"级别"说的就是它，在表头再复述一句只是抄自己。
   */
  const capOf = (model) => {
    if (!Number.isInteger(model.capped) || model.capped < 1) {
      throw new TypeError(`内部不变量：capped 应是本次生效的上限次数（正整数），收到 ${shapeOf(model.capped)}——"到没到"是 hitLimit 那面旗的事，这一格拿它当布尔读会永远说"已到上限"`);
    }
    return model.capped;
  };

  const regexBlock = (m, notes = []) => wrap('regex', m, notes, (model) => {
    const cap = capOf(model);
    const findings = grid('tk-matches', [
      { label: '规则', get: (r) => r.rule },
      { label: '位置', get: (r) => r.at },
      { label: '级别', get: (r) => levelOf(r.level) },
      { label: '提示', get: (r) => r.hint },
    ], model.findings);
    const flagsRow = typeof model.flags === 'string' && model.flags !== ''
      ? hint(`生效的 flags：${model.flags}`) : '';
    const countRow = typeof model.count === 'number' && model.count > 0
      ? `<p class="tk-count">共 ${esc(model.count)} 处</p>` : '';
    const matches = grid('tk-matches', [
      { label: '序号', get: (r) => r.i },
      { label: '起始', get: (r) => r.index },
      { label: '长度', get: (r) => r.length },
      { label: '命中文本', mono: true, get: (r) => r.text },
    ], model.matches);
    const groups = grid('tk-matches', [
      { label: '第几处', get: (r) => r.match },
      { label: '组', get: (r) => r.label },
      // 没开 `d` 时 native 根本没有组位置，null 走 EMPTY_CELL 而不是 0：显示 0 就是报一个假位置
      { label: '位置', get: (r) => r.index },
      { label: '长度', get: (r) => r.length },
      { label: '内容', mono: true, get: (r) => r.text },
    ], model.groups);
    const flagsOn = typeof model.flags === 'string' && model.flags.includes('d');
    const flagHints = [
      model.hitLimit ? hint(`命中次数已到本次上限 ${cap} 次，剩下的没有再算`) : '',
      model.timedOut ? hint('档间时间预算已用完，只算了前面那些') : '',
      model.matches && model.matches.length > 0 && !flagsOn ? hint('没开 d 就没有捕获组位置，位置那一列留空') : '',
      typeof model.elapsedMs === 'number' ? hint(`档间累计耗时 ${model.elapsedMs}ms`) : '',
    ];
    return [findings, flagsRow, countRow, matches, groups,
      outLines('替换预览', model.replaced), ...flagHints];
  });

  const levelOf = (level) => {
    if (typeof level !== 'string' || !Object.prototype.hasOwnProperty.call(LEVEL_CN, level)) {
      throw new TypeError(`regex 面板收到未知的风险级别「${shapeOf(level)}」`);
    }
    return LEVEL_CN[level];
  };

  const BLOCKS = { timestamp: timestampBlock, base64: base64Block, url: urlBlock, digest: digestBlock, regex: regexBlock };

  /** 唯一分派点：Task 6b 的装配层按面板名调这一只，块函数本身也各自导出，判据能逐块点名 */
  const block = (panel, m, notes = []) => {
    const fn = BLOCKS[panel];
    if (!fn) {
      throw new RangeError(`编码页视图只服务这五块面板：${Object.keys(PANEL_VERDICTS).join(' / ')}，收到 ${shapeOf(panel)}`);
    }
    return fn(m, notes);
  };

  return { badge, fieldsTable, timestampBlock, base64Block, urlBlock, digestBlock, regexBlock, block };
}
