/**
 * _posts 元信息的共享读法：front matter 解析 + Jekyll permalink 拼装。
 *
 * 为什么单独立一个文件：微信公众号同步（scripts/wechat-draft.mjs）必须知道一篇文章
 * 在已上线站点上的真实地址，才能把它写进草稿的「阅读原文」。这个地址不是文件名拼出来的，
 * 规则见 postPermalink 的注释。
 *
 * 说明：scripts/og-images.mjs 里有一份同形的 parseFm（12 行）。那份是分享卡闸门
 * （pnpm og:check）的一部分，本次不去改它——动一个正在被别人改的目录里的门禁脚本，
 * 收益只是省 12 行复制，代价是可能撞坏部署前检查。新代码一律用这里。
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * 读一篇稿子的 front matter，只认「一行一个 key: value」的标量。
 *
 * 与 skill 侧（baoyu-post-to-wechat/scripts/wechat-api.ts 的 parseFrontmatter）同形：
 * 按行找第一个冒号切 key/value，剥掉外层引号；不认识的行直接跳过，
 * 不让一个 YAML 锚点或块状列表带走整表。
 *
 * @param {string} file _posts/xxx.md 的绝对路径
 * @returns {Record<string, string>}
 */
export function parseFm(file) {
  const content = fs.readFileSync(file, 'utf8');
  const m = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue; // 注释行与被注释掉的 `# cover:` 都不当真
    const kv = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
    if (!kv) continue;
    out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * 把正文从 front matter 里剥出来。
 * @param {string} file _posts/xxx.md 的绝对路径
 * @returns {string} 去掉 --- 块的正文
 */
export function readBody(file) {
  const content = fs.readFileSync(file, 'utf8');
  const m = /^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content);
  return m ? content.slice(m[0].length) : content;
}

/**
 * 从 _config.yml 取拼站点绝对地址要用的两段：url 与 baseurl。
 *
 * 只取这两个标量，值可能带引号也可能带行内注释（仓库里 url 就是 `'https://…' # your host`）。
 *
 * @param {string} configFile _config.yml 的绝对路径
 * @returns {{ origin: string, baseurl: string }} origin 不含尾斜杠；baseurl 形如 `/better-blog` 或空串
 */
export function readSiteBase(configFile) {
  const text = fs.readFileSync(configFile, 'utf8');
  const pick = (key) => {
    const m = new RegExp(`^${key}:[ \\t]*(.*?)\\s*(?:#.*)?$`, 'm').exec(text);
    return m ? m[1].replace(/^["']|["']$/g, '').replace(/\/+$/, '') : '';
  };
  return { origin: pick('url'), baseurl: pick('baseurl') };
}

/**
 * 一篇文章在已上线站点上的真实地址。
 *
 * Jekyll 默认 permalink 是 date 样式：`/:year/:month/:day/:title.html`，而 :title 是
 * 文件名去掉 `YYYY-MM-DD-` 前缀（front matter 给了 slug 就用它），:year/:month/:day
 * **取自 date 字段而不是文件名**。仓库里有 4 篇文件名日期与 date 不一致的存量文章
 * （逐条登记在 _data/series.yml 文件头），按文件名日期拼出来的地址会直接 404。
 *
 * @param {object} args
 * @param {string} args.file _posts/xxx.md 的绝对路径，用于取文件名
 * @param {Record<string, string>} args.fm parseFm 的结果
 * @param {{ origin: string, baseurl: string }} args.site readSiteBase 的结果
 * @returns {{ path: string, url: string, seg: string, date: string }}
 *   path 站内路径（含 baseurl），url 完整地址；fm.date 缺失时三者为空串并由调用方判错
 */
export function postPermalink({ file, fm, site }) {
  const date = String(fm.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { path: '', url: '', seg: '', date: '' };
  const [y, mo, da] = date.split('-');
  const seg = fm.slug || path.basename(file, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const sitePath = `${site.baseurl}/${y}/${mo}/${da}/${seg}.html`;
  return { path: sitePath, url: `${site.origin}${sitePath}`, seg, date };
}
