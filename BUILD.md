# 构建系统说明

本项目已从 Gulp 3.9.1 升级到 Vite 6，采用现代化的构建工具链。

## 技术栈

- **Vite 6** - 现代快速构建工具
- **Rollup** - 模块打包器（Vite 内置）
- **Terser** - JavaScript 压缩
- **Sass** - SCSS 编译
- **PostCSS** - CSS 后处理
  - autoprefixer - 自动添加浏览器前缀
  - postcss-px-to-viewport - px 转 vw

## 构建命令

### 开发环境

```bash
# 监听模式构建（开发时使用）
yarn dev

# 启动 Jekyll 开发服务器
yarn server
```

### 生产环境

```bash
# 完整构建（dev + demo + jekyll）
yarn build

# 仅构建 dev 目录
yarn build:dev

# 仅构建 demo 目录
yarn build:demo

# 部署到 GitHub Pages
yarn deploy

# 部署到阿里云
yarn deploy:ali
```

## 目录结构

### dev 目录构建

- `dev/js/*.js` → `assets/js/*.min.js`
- `dev/sass/*.scss` → `assets/css/*.min.css`
- `dev/libJs/*.js` → `assets/js/lib-*.min.js`
- `dev/libCss/*.css` → `assets/css/lib-*.min.css`

### demo 目录构建

- `demo/[folder]/js/*.js` → `demo/[folder]/js/*.min.js`
- `demo/[folder]/css/*.scss` → `demo/[folder]/css/*.min.css`

## 构建特性

### 自动处理

1. **ES6+ 转译** - 自动转译现代 JavaScript 语法
2. **浏览器兼容** - 支持 iOS >= 7, Android >= 4.1
3. **CSS 前缀** - 自动添加浏览器前缀
4. **响应式转换** - px 自动转换为 vw（750px 设计稿）
5. **代码压缩** - 生产环境自动压缩 JS/CSS
6. **文件命名** - 自动添加 `.min` 后缀

### Demo 特殊处理

Demo 目录的代码**不进行压缩**，方便用户查看源码学习。

## 配置文件

- `vite.config.js` - 主配置文件（dev 目录）
- `vite.demo.config.js` - Demo 配置文件
- `postcss.config.js` - PostCSS 配置

## 迁移说明

### 已移除的 Gulp 插件

- gulp → Vite
- gulp-babel → Vite 内置转译
- gulp-sass → sass
- gulp-uglify → terser
- gulp-clean-css → Vite 内置压缩
- gulp-autoprefixer → autoprefixer
- gulp-postcss → postcss
- gulp-rename → Vite output 配置
- gulp-static-hash → Vite 内置 hash
- gulp-plumber → Vite 内置错误处理
- gulp-if → Rollup 条件配置

### 新功能

- 更快的构建速度（Vite 基于 ESM）
- 更好的开发体验（HMR 热更新）
- 更小的包体积（优化的 Tree-shaking）
- 更现代的构建流程

## 注意事项

1. 首次构建可能需要几秒，后续构建会更快
2. 监听模式下，文件改动会实时重新构建
3. 所有生成的 `.min.js` 和 `.min.css` 文件都在原来的位置，无需修改 HTML 引用
4. Legacy 插件会生成兼容旧浏览器的 polyfills

## 故障排除

### 构建失败

```bash
# 清理缓存
rm -rf node_modules/.vite
rm -rf dist

# 重新安装依赖
yarn install

# 重新构建
yarn build:dev
```

### 样式问题

检查 `postcss.config.js` 配置是否正确，特别是 viewport 转换配置。

### JS 兼容性问题

检查 `vite.config.js` 中的 legacy targets 配置。
