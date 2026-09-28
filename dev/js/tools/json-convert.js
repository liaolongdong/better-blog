/**
 * YAML / XML / CSV 三对互转（设计文档 §5.3 的转换族，段 4 Task 4 落地实现）。
 *
 * **这一版是桩**：它存在的唯一理由是把 §U 的 U4 那条判据立住——"全仓库 import 内置
 * YAML 产物的文件恰好只有这一本"。判据要在任何 YAML 代码存在之前就生效，否则将来
 * 有人"顺手把内置件拿给别的模块用"时没有东西拦得住。函数体、表数据、口径文案
 * 都在 Task 4 那一格写，写完由 `node scripts/verify-plan-blocks.mjs --fix` 同步进计划镜像。
 *
 * ── 为什么 YAML 那一族用的是一本**内置件**而不是 npm 依赖（段 4 计划 §0.4 的三条理由）──
 *
 * 1. `package.json` 与 `pnpm-lock.yaml` 是全站构建的公共件，本段落地期间它正被另一路
 *    会话占着（未提交的两条 `wechat:draft*` scripts）。加依赖要同批改这两个文件，
 *    而 CI 是 `--frozen-lockfile` —— 两处不同批就红在别人的批次上。
 * 2. 本仓库对**浏览器代码**的既有做法就是内置：`dev/libJs/` 里躺着 jquery、prism、
 *    social-share、canvas-nest、vue、vconsole、fastclick，`package.json` 的
 *    `dependencies` 一格根本没有（只有 7 项 devDependencies，全是构建工具）。
 *    `THIRD-PARTY-NOTICES.md` 第一节就是为这一族内置件设的账。
 * 3. 内置的价钱量得出来（2026-09-29 在 HEAD 导出树里真跑 `npx vite build` 的探针，
 *    exit=0，口径 `cat f | gzip -9 | wc -c`）：探针入口 `probeJson.min.js` 原文 56,955B /
 *    **gzip 16,912B**，同批对照 `toolCodec.min.js` 是 21,830B、`toolkitCore.min.js` 7,037B、
 *    `toolkit.min.css` 2,135B；24 本产物（基线 23 本 + 探针那一本，Task 1 复跑核对过清单）里
 *    `import{` 命中 0，且 `assets/js/` 没有多出
 *    一本 js-yaml —— `.mjs` 既不成 Vite 入口（`vite.config.js:110` 只收 `.js`），
 *    也不被 `copyMinifiedLibs` 复制（`:67` 只复制 `.min.js`）。
 *
 * ── 这一本是什么、能动到什么程度 ──
 *
 * `dev/libJs/js-yaml.esm.min.mjs` = npm tarball `js-yaml-5.4.2` 里那个
 * `package/dist/browser/js-yaml.esm.min.mjs` 成员，**逐字节**（78,721B /
 * sha256 `154ea2da…`，U1 钉它；整包 `js-yaml-5.4.2.tgz` 是
 * sha256 `0003d2f5…`，两个数一起才能从上游复算）。spec §7 指定的就是这个入口。
 * 不改名、不重排、不剥尾部那条 `//# sourceMappingURL=`（"逐字节等于上游"比"少一行
 * 指向站内不存在的 map"值钱，`jquery.min.js` 同样挂着一条，线上多年无人受害）。
 *
 * **升级口径**：换版本 = 换文件 + 改 §U 那一族记下的 `sha256` / 字节数 / banner 串
 * + 复跑 §U 与 §W 与门禁②③，并同步 `THIRD-PARTY-NOTICES.md` 那一行。
 * 不许 `sed` 内置件本身——那会让第一节那句"逐字节比对已确证"变成谎话。
 *
 * @module dev/js/tools/json-convert.js
 */
import * as YAML from '../../libJs/js-yaml.esm.min.mjs';

/**
 * 面板与判据共读的那一句身份说明（Task 4 的 §U 判据按它逐字对账）。
 * @type {string}
 */
export const YAML_LIB = 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs';

/**
 * 桩：Task 4 之前谁也别调它。留着它只为了一件事实——`YAML` 这一本必须被真实 import，
 * 否则 U4 那条"唯一 import 点"的判据在扫源码时会数到 0 本而红（红得有道理，但
 * 红在桩上就没人去修 U4 了）。`jsonToYaml` 在 Task 4 会改成
 * `(value) → { ok, text }` 的形状，与 `parseJson` 那族"不抛错、返回 {ok,error}"的
 * 口径对齐（设计文档 §5.4 的"给依据不给黑箱"）。
 * @returns {never}
 * @throws {Error} 总是抛——这一族还没落地
 */
export function jsonToYaml() {
  void YAML;
  throw new Error('not yet：段 4 Task 4 落地 json-convert 的 YAML/XML/CSV 三对互转');
}
