#!/usr/bin/env bash
# 部署到 GitHub Pages：同步远端 -> 暂存 -> 把要提交的东西摊给你看 -> 确认后才 commit + push。
# 改动前这是一条 `git pull && git add . && git commit && git push` 的盲发流水线，
# 而这个仓库的工作区里经常同时开着第二个会话（在写草稿、在生成插图），
# `add .` 会把它们的半成品一起卷进你这次的提交，推到公开仓库。
set -u

die() { echo "✗ $*" >&2; exit 1; }

# 分支名：老写法是 `git branch | grep "*"` 再用 ${br/* /} 截尾巴，
# detached HEAD 时那行是 `* (HEAD detached at 1a2b3c4)`，截出来是个不存在的分支名，
# pull / push 都打在错的地方。symbolic-ref 在 detached 时直接非 0 退出。
branch=$(git symbolic-ref --quiet --short HEAD) \
  || die "当前不在任何分支上（detached HEAD），先 git checkout 到目标分支再部署"

# --ff-only：分叉时停下来，而不是自动造一个 merge 提交混在这次部署里。
git pull --ff-only origin "$branch" "$branch" \
  || die "git pull --ff-only 没过去：本地与 origin/$branch 已经分叉。先自己 rebase 或 merge 干净，再重跑部署。"

# 暂存区本来就有东西 —— 那是别的会话/上一次没提交完的，不是这次要发的。
# 只提示，不清空：清空等于替别人扔掉工作。
# started_clean 决定中止时能不能把暂存区原样退回去：一开始就非空的话，
# 里面可能有只暂存了一部分的文件，git reset 会把那部分摊平回全量，替不了这个决定。
started_clean=1
if ! git diff --cached --quiet; then
  started_clean=0
  echo "⚠ 暂存区在本次部署前就非空，下面这份会跟着一起提交；不是你要发的请先 git restore --staged <path>："
  git diff --cached --name-status
  echo
fi

git add -A

# 中止时把刚才 add -A 塞进去的东西吐出来，别留一个「替别人暂存好了」的索引。
# 一开始就非空则不动，并告诉用户为什么没替他动。
spit_back() {
  if [ "$started_clean" = 1 ]; then
    git reset -q
    echo '  改动已退回工作区，暂存区与本次运行前一致。'
  else
    echo '  本次运行前暂存区就非空，未替你重置（可能有只暂存了一半的文件）：请自己 git restore --staged <path>。'
  fi
}

if git diff --cached --quiet; then
  echo "没有需要提交的改动。要把已有提交推上去：git push origin $branch"
  exit 0
fi

echo "本次将提交："
git diff --cached --name-status

# 密钥只按内容判，不按文件名判：这仓库里 dev/sass/common/tokens.scss、
# _posts/*account-password-helper* 都是正常文件，按名字拦会一片误报。
# 反过来，_posts 里出现一段示范用的 PEM 是完全可能的，所以留 ALLOW_SECRETS=1
# 这个显式放行口，而不是让人遇到误报时只能绕过整个脚本。
if [ "${ALLOW_SECRETS:-}" = '1' ]; then
  echo "⚠ ALLOW_SECRETS=1：跳过密钥内容检查（文件名提醒仍然生效）" >&2
else
  leak=$(git diff --cached -U0 | grep -oE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{8,}|_auth[[:space:]]*=[[:space:]]*[0-9a-f]{20,}' | sort -u || true)
  if [ -n "$leak" ]; then
    echo "✗ 暂存内容里出现疑似密钥，已中止（未提交、未推送）：" >&2
    echo "$leak" | sed 's/^/    /' >&2
    spit_back >&2
    echo "  确认只是文章里的示例：ALLOW_SECRETS=1 bash deploy-github.sh" >&2
    exit 1
  fi
fi
dotenv=$(git diff --cached --name-only | grep -E '(^|/)\.env([.]|$)' || true)
if [ -n "$dotenv" ]; then
  echo "⚠ 这些文件名看着像本机配置，确认里面没有密钥再继续：" >&2
  echo "$dotenv" | sed 's/^/    /' >&2
fi

printf '\ncommit 注释信息（直接回车用默认）：'
comment=''
IFS= read -r comment || true
[ -n "$comment" ] || comment='commit new code'

printf '提交并推送到 origin/%s ？[y/N] ' "$branch"
ans=''
IFS= read -r ans || true
case "$ans" in
  y|Y|yes|YES) ;;
  *)
    echo '已取消：未提交、未推送。'
    spit_back
    exit 1 ;;
esac

git commit -m "$comment" || die "git commit 失败"
git push origin "$branch" || die "git push 失败：远端可能又前进了，重跑一次本脚本即可。"
echo "✓ 已推送到 origin/$branch，GitHub Actions 接着构建发布。"
