---
layout: post
title: git常用命令操作手册
subtitle: git常用命令操作手册
date: 2017-06-06
categories: 技术 git
cover: /assets/img/postCover/git_cover.png
tags: git git常用命令
---

# git常用命令操作手册

查看更多git操作命令，可以查看[阮一峰的git命令教程](http://www.ruanyifeng.com/blog/2015/12/git-cheat-sheet.html)

## git常用操作

### git新建代码仓库

```bash
# 在当前目录新建一个Git代码库
git init

# 新建一个目录，将其初始化为Git代码库
git init [project-name]

# 下载一个项目和它的整个代码历史
git clone [url]
```

### git配置

```bash
# 显示当前的Git配置
git config --list

# 编辑Git配置文件
git config -e [--global]

# 设置提交代码时的用户信息
git config [--global] user.name <name>
git config [--global] user.email <email>
```

### git查看相关命令

```bash
# 查看工作区变更的文件
git status

# 查看提交日志
git log

# 查看工作区余暂存区修改文件具体差异
git diff

# 查看所有分支
git branch -a

# 查看本地项目关联远程仓库地址
git remote -v
```

### git代码提交操作

```bash
# 提交工作区所有修改到暂存区
git add .

# 提交暂存区修改到仓库区
git commit -m <message>

# 拉取远程仓库最新代码，并与本地分支合并
git pull <remote> <branch>

# 上传本地指定分支到远程仓库
git push <remote> <branch>
```

### git分支相关命令

```bash
# 查看所有分支
git branch -a

# 创建分支
git branch <name>

# 切换分支
git checkout <name>

# 创建 + 切换分支
git checkout -b <name>

# 合并某分支到当前分支
git merge <name>

# 删除分支
git branch -d <name>
```

### git撤销和回退

```bash
# 撤销本地所有修改
git checkout .

# 重置暂存区与工作区，与上一次commit保持一致
git reset --hard

# 新建一个commit，用来撤销指定commit
# 后者的所有变化都将被前者抵消，并且应用到当前分支
git revert <commit>

# 分支合并有冲突，选择回退分支合并操作
git merge --abort
```

### git切换远程仓库地址

```bash
# 查看本地项目关联远程仓库地址
git remote -v

# 删除origin关联的远程仓库地址
git remote remove origin

# 添加远程仓库新地址
git remote add origin <url>
```

### git获取不到gitLab创建的新分支

```bash
# 将远程主机的最新内容拉到本地
git fetch
# 查看所有分支
git branch -a
```