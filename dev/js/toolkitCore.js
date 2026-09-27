/**
 * 工具箱三页共用的框架层：把「面板互锁状态机 + 它的 DOM 绑定层 + 结果视图」挂成 `window.Tk`。
 *
 * 为什么要有这么一层，而不是让页面入口各自 `import`：2026-09-26 在镜像里实测过，`dev/js/` 下
 * 两个入口同时 `import` 同一个模块时，Rollup 会把它提成共享 chunk，而 `vite.config.js` 的
 * `iife-wrap` 又把 ESM 的 `import` 声明包进函数体——产物里留下 `import{c as o}from"./panel.min.js"`
 * 这种句子，经典 `<script>` 里当场 SyntaxError，**整页白屏而构建 exit=0**。三页都用到
 * `panel.js` / `panel-dom.js` / `view.js`，所以这一层从段 2 就立起来，不留到段 3 返工。
 * 站内同族先例：`dev/libJs/tools.js` 出 `window.tools.formatDate`（`_layouts/default.html` 全站引），
 * `editorial.min.js` 是主题的唯一真值源 `window.EditorialTheme`。
 *
 * 三条约束：
 * 1. **只挂这三个名字**，不加版本号、不加解析函数、不加"顺手暴露"的东西。页面入口拿不到的能力
 *    就是不存在，将来要扩面是显式改动。
 * 2. **本文件不 `export`**：产物是被 `(function(){…})();` 包起来的经典脚本，顶层 `export`
 *    在函数体里是语法错误（同上一条那个坑的另一种写法）。
 * 3. **只挂跨页共用的**：`idcard.js` / `uscc.js` 那六本业务模块只有证件页要，走
 *    `tools/workbench.js` 直接 `import` 内联进 `toolIdcard.min.js`，不下到这一层。
 *    判据在 Task 9：构建后 `assets/js/*.min.js` 里 `import{` 的命中数必须为 0。
 */
import { createPanelWorkspace } from './tools/panel.js';
import { createPanelDom } from './tools/panel-dom.js';
import * as view from './tools/view.js';

window.Tk = { createPanelWorkspace, createPanelDom, view };
