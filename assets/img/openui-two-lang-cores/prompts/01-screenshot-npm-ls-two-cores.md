# 01-screenshot-npm-ls-two-cores.webp — 真实终端取证（非生成图）

来源：本机 `.worktrees/ja1021/run/run.log`，2026-10-23T14:11:16Z–14:11:51Z 实跑。
命令逐字：
  npm i --no-audit --no-fund --loglevel=error @openuidev/react-lang@1.0.1 \
    @openuidev/vue-lang@0.4.2 @openuidev/svelte-lang@0.4.2 @openuidev/angular-lang@0.4.2
  npm ls @openuidev/lang-core --all
渲染方式：协议 §8.2.0 路径 (a)——把命令与真实输出原样写进等宽 HTML（`.worktrees/ja1021/shot-01.html`），
再用 headless Chrome 出图：`--headless --disable-gpu --hide-scrollbars --window-size=1180,500
--user-data-dir=/tmp/shot-01-<ts> --screenshot=...`，然后 ffmpeg 转 webp（quality 82）。
未改动任何一个字符；`added 58 packages in 11s` 与 `deduped` 都按原样保留。
画面里没有 token / 密钥 / cookie / 私人邮箱：只有包名、版本号与本机工程路径。
证据行：R-01、R-02、R-08。
