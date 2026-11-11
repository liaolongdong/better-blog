/**
 * 检索摘要的列宽尺子与预算档 —— **全站唯一的一份**。
 *
 * 为什么要单独成一本：这把尺子原先只住在 `scripts/check-tools-surface.mjs` 里，
 * 而它的口径是 USAGE.md「检索层自查」第 9 条拍下来的，不属于那本门禁。第二本门禁
 * （`check-seo.mjs` 组 11 的 ⑧）要量同一批字符串时若自己再写一份，就会出现两件事：
 *   ① 上界不一致（158 与 160 只差 2 列，却足以让同一句描述在一边绿、另一边红）；
 *   ② 宽度算法不一致——`codePointAt(0) > 0x2e80` 把假名与谚文算成两列，
 *      而按 CJK 区间枚举的写法会漏掉它们（实测「カタカナテスト」14 列 vs 7 列）。
 * 两处各自正确、合起来是错的，这正是本仓库反复踩过的「同一份事实写第二遍」。
 *
 * 谁在用：`check-tools-surface.mjs`（工具页 front matter 的 seo_description）、
 * `check-seo.mjs` 组 11 ⑧（产物 meta description，页与翻页视图 + 文章台账棘轮）。
 * 改这两个数之前先想清楚：SERP 那一行截的是**宽度**，不是字符数。
 */

/** CJK 与全角（码位 > 0x2E80）算 2 列，其余算 1 列。 */
export const cols = (s) => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) > 0x2e80 ? 2 : 1), 0);

/**
 * 一句话检索摘要的预算。地板不是「最短能显示多少」，而是「短到这份上就不值得单独写」：
 * 低于它不如用站点级那句（`_includes/seoMeta.html` 里 `.size < 25` 那道闸是同一个判断的
 * 字符版，25 字符 ≈ 50 列）。天花板留 158 而不是 160，是给引擎的取整误差留两列余量。
 */
export const DESC_MIN_COLS = 50;
export const DESC_MAX_COLS = 158;
