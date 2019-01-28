#!/bin/bash
function git.branch {
  	br=`git branch | grep "*"`
}
# 获取当前分支
git.branch
# 拉取当前分支信息
git pull origin ${br/* /}:${br/* /}
# 打包部署
yarn build