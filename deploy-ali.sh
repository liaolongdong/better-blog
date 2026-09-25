#!/usr/bin/env bash
# 部署机上的更新：fetch -> 把工作区对齐到 origin/<分支> -> 装依赖并构建。
# 非交互脚本（可能由 cron 或 ssh 一行拉起），所以全程不提问：
# 任何「会吃掉服务器上未提交/未推送的东西」的情形都直接停下，除非显式 FORCE_RESET=1。
set -u

die() { echo "✗ $*" >&2; exit 1; }

# 老写法 `git branch | grep "*"` 在 detached HEAD 时截出来的是 `(HEAD detached at 1a2b3c4)`
# 这样一串根本不存在的分支名，后面的 fetch / reset / 构建全打在错的地方。
branch=$(git symbolic-ref --quiet --short HEAD) \
  || die "当前不在任何分支上（detached HEAD）：先在部署机上 git checkout 到目标分支再重跑。"

git fetch origin "$branch" || die "git fetch origin $branch 没过去（网络或权限）：未做任何改动。"

# reset --hard 会覆盖「相对 HEAD 有改动的已跟踪文件」，并把本地未推送的提交从分支上摘掉。
# 未跟踪文件它不动，所以不进这条判据。
loss=''
dirty=$(git diff --name-status HEAD)
if [ -n "$dirty" ]; then
  loss="工作区相对 HEAD 有未提交改动"
else
  # 远程跟踪引用没落盘（fetch 只写了 FETCH_HEAD）时这里数不出东西：记 0 继续，
  # 由下面那条 reset 自己失败并停下，总比拼出一句「领先  个提交」的假理由好。
  ahead=$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null) || ahead=0
  [ "$ahead" = 0 ] || loss="本地领先 origin/$branch $ahead 个提交，reset 之后只能从 reflog 找回"
fi
if [ -n "$loss" ] && [ "${FORCE_RESET:-}" != '1' ]; then
  echo "✗ 已中止：继续走下去会丢掉——$loss" >&2
  if [ -n "$dirty" ]; then
    echo "  受影响文件：" >&2
    echo "$dirty" | sed 's/^/    /' >&2
    echo "  调试残留就 git restore <path>；确认不需要了就 FORCE_RESET=1 bash deploy-ali.sh" >&2
  else
    echo "  要先留住它们：git branch server-snapshot；确认不需要了就 FORCE_RESET=1 bash deploy-ali.sh" >&2
  fi
  exit 1
fi

git reset --hard "origin/$branch" || die "git reset --hard origin/$branch 失败：工作区未对齐，停止构建。"
echo "→ $branch 已对齐 origin/$(git rev-parse --short 'origin/'"$branch")${loss:+（$loss 已被丢弃）}"

# 仓库已改为 pnpm（yarn.lock 已删除），且 assets/**、demo/** 下的 .min.js/.min.css
# 不再入库（见 .gitignore），必须在部署机上现场构建；
# build:site = Vite 构建静态产物 + Jekyll 生成 _site（pnpm build 已不含 jekyll 步骤）
pnpm install --frozen-lockfile || die "pnpm install --frozen-lockfile 失败：锁文件与 package.json 可能不一致。"
pnpm build:site || die "pnpm build:site 失败：代码已更新，但产物没构建出来，站点仍是上一版。"
echo "✓ 已更新并构建完成"
