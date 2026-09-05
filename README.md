# Better的个人网站

## 一个记录成长的地方

基于 [Jekyll](https://jekyllrb.com/) + [Vite](https://vite.dev/) 构建，托管于 GitHub Pages。

### 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 22 | 见 `.node-version`，CI 按该文件安装 |
| pnpm | 11 | 见 `package.json` 的 `packageManager` 字段 |
| Ruby + Bundler | 3.1（CI） | Jekyll 4.3 运行所需，见 `Gemfile` |

### 安装依赖

```bash
pnpm install      # 前端构建依赖
bundle install    # Jekyll 及其插件
```

### 本地启动

一条命令同时跑「Vite 监听构建」与「Jekyll 本地服务」，服务默认在 <http://localhost:4000>：

```bash
pnpm dev
```

也可以拆成两个终端分别执行：

```bash
pnpm dev:assets   # 只监听构建 assets/ 与 demo/ 下的静态资源
pnpm dev:server   # 只启动 Jekyll 服务
```

> 本项目没有 Vite dev server，页面由 Jekyll 提供；Vite 只负责把 `dev/` 与 `demo/`
> 下的源码编译成 `.min.js` / `.min.css` 产物。

### 打包

```bash
pnpm build          # 构建全部静态资源（主站 + demo）
pnpm build:assets   # 只构建主站资源
pnpm build:demo     # 只构建 demo 资源
pnpm build:site     # 构建静态资源并生成 _site（部署到自有服务器时用）
```

### 部署

推送到 GitHub，由 `.github/workflows/jekyll.yml` 自动构建并发布到 Pages：

```bash
pnpm deploy
```

阿里云服务器（在部署机上执行，会现场拉代码、装依赖、构建）：

```bash
pnpm deploy:ali
```

### 产物约定

`assets/**` 与 `demo/**` 下的 `.min.js` / `.min.css` **不入库**（见 `.gitignore`），
一律由 CI 或部署机现场构建。例外是 `dev/libJs`、`dev/libCss` 下的第三方预压缩库，
以及 `demo/*/js/vue.min.js`、`demo/echartsDemo/lib/*.min.js` 这类白名单文件——它们
是源文件，由构建原样复制到发布目录，不再二次加工。

更多开发细节见 [USAGE.md](./USAGE.md)。
