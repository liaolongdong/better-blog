# 01-screenshot-shadcn-glass

- 类型：真实页面截图（非 AI 生成）
- 页面：`http://localhost:5173/`（本地 Vite dev server）
- 复现源码：同目录 `01-demo-app.tsx`；组件来自 shadcn CLI `base-nova` 的 stock `card`、`button`
- 视图：1400×1100，device scale factor 1，浅色模式
- 抓取日期：2026-10-21
- 截图命令：

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --user-data-dir=/tmp/blog-shot-sg \
  --window-size=1400,1100 --force-device-scale-factor=1 \
  --virtual-time-budget=5000 \
  --screenshot=/tmp/solid-glass-page.png http://localhost:5173/
```

- 页面里只有演示用的标题、Card、Button 和彩色模糊背景，不含 token、cookie、邮箱或内网地址。
- 对应正文事实：Card 与三个 Button 的组件源码没有改动，只额外导入了 `src/solid-glass.css`。
