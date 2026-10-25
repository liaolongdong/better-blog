# 01-screenshot-catalog-counts.webp — 真实终端取证（非生成图）
来源：本机 `.worktrees/ja1024/shot1.txt`（2026-10-25T14:20:15Z 实跑），命令与输出逐字未改：
`curl -s https://api.freellmapi.co/v1/latest | jq -c '{tier, version, generatedAt, counts}'`
与一行 python 把四类端点相加（442 + 30 + 10 + 1 = 483）。
渲染：等宽 HTML（`.worktrees/ja1024/shot-01.html`）+ headless Chrome `--window-size=1180,420`
+ `--user-data-dir=/tmp/flm-01-<ts>`，再 ffmpeg 转 webp（quality 82）。
画面里没有 token / 密钥 / cookie / 邮箱：只有包名、字段名与数字。证据行 N-03、R-01、R-04。
