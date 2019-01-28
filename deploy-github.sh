#!/bin/bash
function git.branch {
  	br=`git branch | grep "*"`
}
# 获取当前分支
git.branch
# 拉取当前分支信息
git pull origin ${br/* /}:${br/* /}
# 提交到代码到远程仓库
git add .
# git commit -m 'commit new code'
echo "请输入commit的注释信息:"
comment="commit new code"
read comment
git commit -m "$comment"
git push origin ${br/* /}