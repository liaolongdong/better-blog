# 快速使用指南

## 🚀 快速开始

### 开发环境

```bash
# 方式 1: Vite 开发服务器（推荐，最快）
yarn dev
# 浏览器会自动打开 http://localhost:3000

# 方式 2: 监听构建模式（需要生成文件时）
yarn dev:watch

# 方式 3: Jekyll 服务器（完整功能）
yarn server
```

### 生产构建

```bash
# 完整构建（推荐用于部署）
yarn build

# 或分别构建
yarn build:dev    # 只构建主站资源
yarn build:demo   # 只构建 demo 资源
```

### 部署

```bash
# 部署到 GitHub Pages
yarn deploy

# 部署到阿里云
yarn deploy:ali
```

## 📁 开发工作流程

### 1. 修改主站样式
```bash
# 编辑 dev/sass/ 下的 .scss 文件
# 运行构建
yarn build:dev

# 或在另一个终端运行监听模式
yarn dev:watch
```

### 2. 修改主站 JavaScript
```bash
# 编辑 dev/js/ 下的 .js 文件
# 运行构建
yarn build:dev
```

### 3. 修改 Demo 项目
```bash
# 编辑 demo/[项目名]/ 下的文件
# 运行构建
yarn build:demo
```

## ⚡ 性能提示

1. **日常开发**: 使用 `yarn dev` 最快
2. **需要生成文件**: 使用 `yarn dev:watch`
3. **部署前**: 使用 `yarn build` 完整构建

## 🔍 故障排除

### 构建失败
```bash
# 清理缓存
rm -rf node_modules/.vite

# 重新安装依赖
yarn install

# 重新构建
yarn build:dev
```

### 端口被占用
```bash
# 修改 vite.config.js 中的 port 配置
server: {
  port: 3001,  // 改为其他端口
  ...
}
```

### 样式不更新
```bash
# 强制重新构建
yarn build:dev

# 或清除浏览器缓存
```

## 📊 构建输出

### 主站资源
- JS: `assets/js/*.min.js`
- CSS: `assets/css/*.min.css`

### Demo 资源
- JS: `demo/[项目]/js/*.min.js`
- CSS: `demo/[项目]/css/*.min.css`

## 💡 常用命令速查

```bash
yarn dev           # 开发服务器
yarn dev:watch     # 监听构建
yarn build:dev     # 构建主站
yarn build:demo    # 构建 demo
yarn build         # 完整构建
yarn server        # Jekyll 服务器
yarn deploy        # 部署
```

## 🎯 开发建议

1. **开发时**: 保持 `yarn dev:watch` 在后台运行
2. **提交前**: 运行 `yarn build` 确保所有文件都是最新的
3. **部署前**: 检查构建输出，确保没有错误

---

更多详细信息请查看 [BUILD.md](./BUILD.md) 和 [OPTIMIZATION_COMPLETE.md](./OPTIMIZATION_COMPLETE.md)
