#!/bin/bash
function git.branch {
  	br=`git branch | grep "*"`
}
# 获取当前分支
git.branch
# 拉取当前分支信息
git pull origin ${br/* /}:${br/* /}
# 提交到代码到远程仓库
git add -A
git commit -m 'commit new code'
git push origin ${br/* /}