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

[git命令官方文档](https://git-scm.com/docs)
[阮一峰的git命令教程](http://www.ruanyifeng.com/blog/2015/12/git-cheat-sheet.html)

## git常用操作

变量说明：

- `<url>` = 项目地址(`https://github.com/liaolongdong/liaolongdong.github.io.git`)
- `<repo>` = 关联仓库名称(`origin`, `upstream`)
- `<branch>` = 分支名(`dev`)

### git新建代码仓库

```bash
# 在当前目录新建一个Git代码库
git init

# 新建一个目录，将其初始化为Git代码库
git init [project-name]

# 下载一个项目和它的整个代码历史
git clone <url>
```

### git配置

```bash
# 显示当前的Git配置
git config --list

# 编辑Git配置文件
git config -e [--global]

# 设置提交代码时的用户信息
git config --global user.name <name>
git config --global user.email <email>
```

### git查看相关命令

```bash
# 查看工作区变更的文件
git status

# 查看提交日志
git log

# 查看提交记录(更简洁)
git reflog

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
git pull <repo> <branch>

# 上传本地指定分支到远程仓库
git push <repo> <branch>
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

# 合并某本地分支到当前分支
git merge <name>

# 合并某远程分支到当前分支 示例：git merge origin/dev
git merge origin/<name>

# 删除分支
git branch -d <name>
```

### git撤销和回退

```bash
# 撤销本地所有修改
git checkout .


# 重置暂存区与工作区，与上一次commit保持一致
git reset --hard

# 回退到某次提交版本
git reset --hard <commit>

# 查看分支当前版本commit SHA
git rev-parse HEAD

# 提交回退的版本 (注：强制提交后，当前版本后面的提交版本将会删掉！)
# git push -f
git push origin HEAD --force


# 新建一个commit，用来撤销指定commit
# 后者的所有变化都将被前者抵消，并且应用到当前分支
git revert <commit>

# 分支合并有冲突，选择回退分支合并操作
git merge --abort

# 撤销变基操作
git rebase --abort
```

### git储藏常用命令

```bash
# 储藏修改，将新的储藏推送到栈上，运行 git stash 或 git stash save
git stash
git stash save "save message"
```

```bash
# 从git栈中获取到最近一次stash进去的内容，恢复工作区的内容。获取之后，会删除栈中对应的stash
git stash pop
```

```bash
# 要查看储藏的东西，可以使用 git stash list
git stash list
```

```bash
# 将你刚刚储藏的工作重新应用：git stash apply。 如果想要应用其中一个更旧的储藏，可以通过名字指定它，像这样：git stash apply stash@{2}。 如果不指定一个储藏，Git 认为指定的是最近的储藏
git stash apply
```

```bash
# 根据版本号，恢复储藏信息
git stash apply stash@{1}
```

```bash
# 要移除它，你可以运行 git stash drop，加上你希望移除的储藏的名字
git stash drop stash@{0}
```

```bash
# 清空git储藏栈
git stash clear
```

### git切换远程仓库地址

```bash
# 查看本地项目关联远程仓库地址
git remote -v

# 删除origin关联的远程仓库地址
git remote remove origin

# 重命名关联仓库名称
git remote rename <repo> <new-repo>

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

### 解决 Git 默认不区分文件名大小写的问题

```bash
git config core.ignorecase false
```

### git查看配置信息

```bash
git config --list
```

### git查看相关命令用法或帮助

```bash
git help
```

### 修改提交信息

```bash
# 修改提交信息msg
git commit --amend
```

### git导出某个时间段的代码提交记录到桌面

```bash
# 在项目根目录，执行以下命令

git log --all --after="<date> 00:00" --before="<date> 23:59" --author="<author>"

# 输出最近一年的格式化的git提交记录
git log --pretty=format:"%ad - %an: %s" --after="2018-01-31" --until="2019-01-31" --author="liaolongdong"

# 导出txt文档
git log --pretty=format:"%ad - %an: %s" --after="2018-01-31" --until="2019-01-31" --author="liaolongdong" >> ~/Desktop/commit.txt

# 导出excel
git log --date=iso --pretty=format:'"%h" "%an" "%ad" "%s"' --after="2018-01-31" --until="2021-03-31" --author="liaolongdong" >> ~/Desktop/commit.csv
```

[查看更多](https://stackoverflow.com/questions/37311494/how-to-get-git-to-show-commits-in-a-specified-date-range-for-author-date)