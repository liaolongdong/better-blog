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
yarn build