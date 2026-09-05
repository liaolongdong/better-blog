# 快速使用指南

> 命令一律使用 pnpm（`package.json` 的 `packageManager` 已锁定版本）。
> 环境要求见 [README.md](./README.md)。

## 🚀 快速开始

### 开发环境

```bash
# 推荐：一条命令同时跑 Vite 监听构建 + Jekyll 本地服务
pnpm dev
# Jekyll 服务默认地址 http://localhost:4000

# 只监听构建静态资源（自己另起 Jekyll，或只关心产物时）
pnpm dev:assets

# 只启动 Jekyll 服务（产物已是最新时）
pnpm dev:server
```

> ⚠️ 本项目**没有 Vite dev server**，`vite.config.js` 中也没有 `server` 配置块。
> Vite 以 `build --watch` 方式工作，只负责把源码编译成 `.min.js` / `.min.css`；
> 页面由 Jekyll 提供。想换端口请用 `pnpm dev:server -- --port 4001`。

### 生产构建

```bash
# 构建全部静态资源（主站 + demo），CI 用的就是这条
pnpm build

# 分开构建
pnpm build:assets   # 只构建主站资源 -> assets/js|css/*.min.js|css
pnpm build:demo     # 只构建 demo 资源 -> demo/*/js|css/*.min.js|css

# 构建静态资源 + 生成 _site（部署到自有服务器时用）
pnpm build:site
```

### 部署

```bash
pnpm deploy       # 提交并推送到 GitHub，由 Actions 自动构建发布到 Pages
pnpm deploy:ali   # 阿里云服务器：拉代码 -> pnpm install -> pnpm build:site
```

GitHub Pages 的构建发布由 `.github/workflows/jekyll.yml` 独立完成：
Node 22 + pnpm 装依赖并 `pnpm build`，再用 Ruby 3.1 跑 `bundle exec jekyll build`。

## 📁 开发工作流程

### 1. 修改主站样式

```bash
# 编辑 dev/sass/ 下的 .scss 文件（dev/sass/common/ 是被 @import 的片段，不单独产出）
pnpm dev:assets   # 监听模式，保存即重新构建
```

### 2. 修改主站 JavaScript

```bash
# 业务代码在 dev/js/，第三方库在 dev/libJs/
pnpm dev:assets
```

- `dev/js/*.js` 与 `dev/libJs/*.js`（非 `.min.js`）会被打包，产物外层自动包一层 IIFE，
  避免多文件间的全局变量冲突。
- `dev/libJs/*.min.js` 与 `dev/libCss/*.min.css` 是**已预压缩的第三方库**，不进打包管线，
  构建时原样复制到 `assets/js|css/`。新增此类文件直接放进去即可，无需改配置。

### 3. 修改 Demo 项目

```bash
# 编辑 demo/[项目名]/js|css/ 下的文件
pnpm build:demo
```

- 入口按目录自动扫描，新增 demo 目录无需改配置。
- 同一个 demo 的 `css/` 下若同时存在 `index.css` 与 `index.scss`，**只有 `.scss` 会作为入口**
  （两者会争用同一个 `[name].min.css` 输出名）。`.css` 仍可被 HTML 直接引用。
- `demo/*/css/base.css` 属于「已预处理完成的静态样式」，构建时原样复制成 `base.min.css`，
  不走打包管线——因为多份 `base.css` 内容完全相同，Vite 会按内容对 CSS 资源去重，
  走管线会导致大部分 demo 拿不到自己的 `base.min.css`。

### 4. 修改 Liquid 模板

`_includes/`、`_layouts/` 下的改动由 Jekyll 处理，`pnpm dev` 会自动重新渲染，
无需跑 Vite。

## 🔍 故障排除

### 构建失败

```bash
rm -rf node_modules/.vite   # 清理 Vite 缓存
pnpm install                # 重装依赖
pnpm build
```

若报 `SyntaxError: The requested module 'node:fs/promises' does not provide an export named 'constants'`，
说明当前 Node 版本过低（Vite 6 要求 `^18 || ^20 || >=22`），请切到 Node 22。

### 页面样式或脚本 404

1. 确认已执行过 `pnpm build`——产物不入库，克隆后必须先构建。
2. 检查引用的文件名**大小写**是否与产物一致：本地 macOS 大小写不敏感不会报错，
   但 GitHub Pages 跑在 Linux 上，`webLab.min.css` 与 `weblab.min.css` 是两个文件。
   不变式：产物名 == 源文件名 + `.min`。
3. demo 页面报 `./css/base.min.css` 404 时，检查该 demo 是否被误加进了
   `vite.demo.config.js` 的入口扫描（应命中 `STATIC_DEMO_CSS` 的复制分支）。

### 样式不更新

```bash
pnpm build:assets   # 强制重新构建
```

浏览器侧注意 `assets/**` 产物文件名不带 hash，可能是缓存，强刷一次。

## 📊 构建输出

| 来源 | 产物 |
| --- | --- |
| `dev/js/*.js`、`dev/libJs/*.js` | `assets/js/*.min.js` |
| `dev/sass/*.scss`、`dev/libCss/*.css` | `assets/css/*.min.css` |
| `dev/libJs/*.min.js`、`dev/libCss/*.min.css` | 原样复制到 `assets/js|css/` |
| `demo/*/js/*.js` | `demo/*/js/*.min.js` |
| `demo/*/css/*.css|*.scss` | `demo/*/css/*.min.css` |
| `demo/*/css/base.css` | 原样复制为 `demo/*/css/base.min.css` |

两份 Vite 配置的 `outDir` 都是仓库根目录且 `emptyOutDir: false`，因此构建**不会**清空
任何既有文件；产物路径由 `entryFileNames` / `assetFileNames` 显式指定。

## 💡 常用命令速查

```bash
pnpm dev           # 监听构建 + Jekyll 服务
pnpm dev:assets    # 只监听构建静态资源
pnpm dev:server    # 只启动 Jekyll 服务
pnpm build         # 构建全部静态资源
pnpm build:assets  # 只构建主站
pnpm build:demo    # 只构建 demo
pnpm build:site    # 构建静态资源 + 生成 _site
pnpm deploy        # 推送到 GitHub（Actions 自动发布 Pages）
pnpm deploy:ali    # 阿里云服务器部署
```

## ⚠️ 已知未决：浏览器兼容基线自相矛盾

`postcss.config.js` 中 `autoprefixer.overrideBrowserslist` 声明的是 `['iOS >= 7', 'Android >= 4.1']`，
但站点实际依赖的能力早已越过这条线：

| 依赖 | 实际最低要求 |
| --- | --- |
| jQuery 3.3.1（`_includes/head.html`） | iOS ≥ 9 / Android ≥ 4.4 |
| `fetch` + `NodeList.forEach`（阅读量统计） | iOS ≥ 10 |
| flex `gap`（`.post-meta` 等） | iOS ≥ 14.1 |

结论：`overrideBrowserslist` 里低于 iOS 9 的那部分前缀永远不会被真正用到，只会增大产物体积；
而 `gap` 这类高要求特性又不在 autoprefixer 的补偿范围内。**这条基线目前没有真实约束力，
但它决定 autoprefixer 该保留哪些前缀，属于需要单独决策的事项（收敛到现代基线会删掉一批前缀，
回退到标称基线则要把 `gap` 改回 margin），因此暂不改动，仅在此登记。**
动它之前先确认目标设备分布，再一次性同步 `postcss.config.js`、`_includes/head.html` 的 jQuery 版本与阅读量脚本的降级策略。

## 🎯 开发建议

1. **开发时**：保持 `pnpm dev` 在后台运行，改源码与改模板都能即时看到效果。
2. **提交前**：产物不入库，只需提交源码；但要确认 `pnpm build` 能跑通，否则 CI 会失败。
3. **改构建配置后**：本地跑一次完整 `pnpm build`，核对 `assets/` 与 `demo/` 下的产物
   数量与文件名，重点检查大小写与是否有入口因同名互相覆盖而丢失。
