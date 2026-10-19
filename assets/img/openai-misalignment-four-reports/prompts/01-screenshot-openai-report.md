# 01-screenshot-openai-report.webp 来源

- 页面：OpenAI Alignment Research Blog，《Retrieving server secrets and bypassing authorization on a government statistics website》
- URL：https://alignment.openai.com/misalignment-reports/retrieving-server-secrets-and-bypassing-authorization-on-a-government-statistics-website/
- 抓取时间：2026-10-19 22:18（UTC+8）
- 视口：1400×1200，device scale factor 1，Chrome headless
- 内容：报告页顶部的事件元数据（Incident date Jun 17, 2026 / Discovered Aug 13, 2026 / Report updated Oct 15, 2026）、Summary，以及 What happened 开头
- 说明：公开网页的真实截图，不是 AI 生成；页面中的地区名、金额等已由 OpenAI 泛化或隐去；截图不含 token、邮箱、内网地址
- 命令：
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars \
    --user-data-dir="/tmp/blog-shot-$(date +%s)" --window-size=1400,1200 --force-device-scale-factor=1 \
    --virtual-time-budget=6000 --screenshot="/tmp/openai-report.png" \
    "https://alignment.openai.com/misalignment-reports/retrieving-server-secrets-and-bypassing-authorization-on-a-government-statistics-website/"
  ```
