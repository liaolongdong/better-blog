/**
 * 工具页的档位 ↔ 地址栏：**读只认白名单，写只动自己的键**。
 *
 * 为什么单独一本文件：JSON 页那三枚（视图 / 缩进 / 排序）与对比页那五枚（模式 / 布局 / 上下文 /
 * 忽略空白 / 区分大小写）的读写规则完全同形——枚举进白名单、非法值静默忽略、非默认才写键、
 * 落回默认就删键。两页各写一段，就是两处会各自漂移的白名单表。
 *
 * 零 import，经 `toolkitCore.js` 挂成 `window.Tk.url` 的第五个面：两个页面入口各自 `import`
 * 同一模块会被 Rollup 提成共享 chunk，`iife-wrap` 把 `import{…}from"./…"` 包进函数体后整页
 * SyntaxError，而构建照样 exit 0（那条红线实测记录在 `dev/js/toolkitCore.js:5-9`）。
 * 只有具名导出、没有 `default`：`import * as url` 挂进 `Tk` 会把 `default` 一起挂上去，而
 * `view.js` / `ui.js` 两本同形先例都只有具名导出（J12 按 `Object.keys` 数 `Tk` 的挂面）。
 *
 * 三条口径（`_docs/superpowers/specs/2026-10-02-tool-url-state-design.md` §2–§3）：
 *
 * 1. **地址栏是结果的镜像，不是来源**。读到白名单外的值不采纳、不洗地址栏，只把它点名进
 *    `ignored`（那是一只给门禁看的读数）；写只在档位真的变了的那几个点发生，且只用
 *    `replaceState`——改档位不是新历史，后退不该先退回上一个档位。
 * 2. **别人的键一个字节都不许动**。`nextSearch` 从**现有** `search` 起建 `URLSearchParams`，
 *    于是 `?utm_source=…` 这类落地页参数原样保留、原样有序，我新增的那一枚排在末尾。
 * 3. **不产 `0`**。`check` 只有 `'1'` 一档（这两页的勾选框默认都是未勾选），所以"取消勾选"在
 *    地址栏里的形状就是**键缺席**，与"这一格没人说话"同形；这也是读侧把 `0` 判进 `ignored`
 *    而不是判成 `false` 的理由——写侧从不产它，认它等于给手写的假地址开门。
 *
 * 复算：`node scripts/tool-url-state-tests.mjs` 十二判（U0-1 ~ U0-12，纯逻辑与假地址）；
 * 真浏览器里那一条路归 `scripts/verify-tool-url.mjs`（U1–U7）。
 */

/** 去掉调用方顺手带进来的那枚 `?`：`location.search` 自带，测试夹具与手抄的地址常常不带 */
const body = (search) => String(search === undefined || search === null ? '' : search).replace(/^\?/, '');

/** 读一档：`select` 只认 `options` 里的原值，`check` 只认 `'1'`；认不下就回 `undefined` */
const decode = (key, raw) => {
  if (key.kind === 'check') return raw === '1' ? true : undefined;
  return key.options.includes(raw) ? raw : undefined;
};

/** 写一档：默认值写成「键缺席」，回 `null` 表示这一格不该出现在地址栏里 */
const encode = (key, value) => {
  if (value === undefined || value === null) return null;
  const atDefault = key.kind === 'check' ? Boolean(value) === Boolean(key.dflt) : value === key.dflt;
  if (atDefault) return null;
  return key.kind === 'check' ? '1' : String(value);
};

/**
 * 读地址栏：只把白名单里、且值合法的那几档回给调用方。
 * @param {string} search `location.search`（带不带 `?` 都行）
 * @param {Array<{name: string, kind: 'select'|'check', options?: string[], dflt: string|boolean}>} keys
 * @returns {{found: Object<string, string|boolean>, ignored: string[]}} `found` 里没有的键，页面保持原样
 */
export function parse(search, keys) {
  const params = new URLSearchParams(body(search));
  const found = {};
  const ignored = [];
  for (const key of keys) {
    if (!params.has(key.name)) continue;
    const raw = params.get(key.name);
    if (raw === '') continue;
    const value = decode(key, raw);
    if (value === undefined) ignored.push(key.name);
    else found[key.name] = value;
  }
  return { found, ignored };
}

/**
 * 算下一个 `search`：从现有那一份起建，于是别人的键连顺序一起留着。
 * @param {string} search 现在的 `location.search`
 * @param {Array} keys 同 `parse`
 * @param {Object<string, string|boolean>} values 当前档位，按 URL 键名索引
 * @returns {string|null} 我的键一个都没变时回 `null`——**这不是"空串"，是"别写"**
 */
export function nextSearch(search, keys, values) {
  const params = new URLSearchParams(body(search));
  let changed = false;
  for (const key of keys) {
    const want = encode(key, values ? values[key.name] : undefined);
    const now = params.has(key.name) ? params.get(key.name) : null;
    if (want === null) {
      if (now !== null) {
        params.delete(key.name);
        changed = true;
      }
      continue;
    }
    if (now !== want) {
      params.set(key.name, want);
      changed = true;
    }
  }
  return changed ? params.toString() : null;
}

/**
 * 把档位同步进地址栏。
 * @param {{search: string, pathname: string, hash: string}} location 真 `location` 的那三格就够
 * @param {History} history 只调它的 `replaceState`
 * @param {Array} keys 同 `parse`
 * @param {Object<string, string|boolean>} values 当前档位
 * @returns {boolean} 写没写。**`false` 是正常返回**：没变化、或者浏览器拒了这次写（Safari 那种
 *   短时间内 `replaceState` 过密的 `SecurityError`），都不该冒到页面上去
 */
export function sync(location, history, keys, values) {
  const next = nextSearch(location.search, keys, values);
  if (next === null) return false;
  const url = `${location.pathname}${next ? `?${next}` : ''}${location.hash || ''}`;
  try {
    history.replaceState(history.state ?? null, '', url);
    return true;
  } catch {
    return false;
  }
}
