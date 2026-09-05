#!/bin/bash
function git.branch {
  	br=`git branch | grep "*"`
}
# 获取当前分支
git.branch
# git fetch 指令是下载远程仓库最新内容，不做合并
git fetch --all
# git reset 指令把HEAD指向master最新版本
# git reset --hard origin/master
git reset --hard origin/${br/* /}
# 拉取当前分支信息
git pull origin ${br/* /}:${br/* /}
# 打包部署
# 仓库已改为 pnpm（yarn.lock 已删除），且 assets/**、demo/** 下的 .min.js/.min.css
# 不再入库（见 .gitignore），必须在部署机上现场构建；
# build:site = Vite 构建静态产物 + Jekyll 生成 _site（pnpm build 已不含 jekyll 步骤）
pnpm install --frozen-lockfile && pnpm build:site
