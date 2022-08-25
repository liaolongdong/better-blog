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
- `<repo>` = 关联仓库名称(`origin`, `upstream`) `origin`代表远程私仓，`up`或者`upstream`代表远程公仓
- `<branch-name>` = 分支名(`dev`)
- `<commit-sha>` = 提交记录ID(`d6d826afd99c64a91473180e75351bab0a547c1f`)

### git查看相关命令用法或帮助

```bash
git help
```

### git新建代码仓库

```bash
# 在当前目录新建一个Git代码库
git init

# 新建一个目录，将其初始化为Git代码库
git init <project-name>

# 下载一个项目和它的整个代码历史
git clone <url>

# 只拉取最近一次提交记录，用于快速clone代码仓库
git clone --depth 1 <url>
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

# git可以将用户名，密码和仓库链接保存在硬盘中，而不用在每次push的时候都输入密码
git config credential.helper store
```

### git查看相关命令

```bash
# 查看工作区变更的文件
git status

# 查看提交日志
git log

# 查看提交记录(更简洁)，该命令可以查看最近90天的git操作记录，关键时刻可以救命（比如，使用了 git reset --hard <commit-sha> 后找不到commit-sha后面的提交记录和代码了）
git reflog

# 查看工作区余暂存区修改文件具体差异
git diff

# 查看本地项目关联远程仓库地址
git remote -v

# 查看某个分支本地、origin、up远程仓库当前的commit-sha，可用于对比三者代码是不是最新的
git show-ref <branch-name> # 使用之前先执行 `git fetch --all` 拉取最新资源到本地
```

### git代码提交操作

```bash
# 提交工作区所有修改到暂存区
git add .

# 提交暂存区修改到仓库区
git commit -m <message>

# 拉取远程仓库最新代码，并与本地分支合并，该命令相当于执行 git fetch && git merge
git pull <repo> <branch-name>

# 上传本地指定分支到远程仓库
git push <repo> <branch-name>
```

### git分支相关命令

```bash
# 查看所有分支
git branch -a

# 查看当前分支名称
git rev-parse --abbrev-ref HEAD # 低版本git获取当前分支名称
git branch --show-current # 高版本git获取当前分支名称

# 创建分支
git branch <branch-name>

# 切换分支
git checkout <branch-name>

# 切换并关联到upstream上游仓库
git checkout --track <repo>/<branch-name> # git checkout --track up/Release_IEP-WEBSITE-3.40.0_92224

# 修改本地分支的关联仓库
git branch --set-upstream-to <repo>/<branch-name>

# 创建 + 切换分支
git checkout -b <branch-name>

# 两个分支来回切换，快捷方式
git checkout -

# 删除本地分支(已merge过分支)
git branch  -d <branch-name>

# 删除本地分支(为merge的分支)
git branch  -D <branch-name> # 相当于 --delete --force

# 删除远程仓库分支
git push -d <repo> <branch-name> # 或者 git push <repo> :<branch-name>


# 合并某本地分支到当前分支
git merge <branch-name>

# 合并某远程分支到当前分支 示例：git merge origin/dev
git merge <repo>/<branch-name>

# 直接使用pull合并某远程分支到当前分支
git pull <repo> <branch-name> # 等同于 git fetch <repo> && git merge <repo>/<branch-name>
```

### git撤销和回退

```bash
# 撤销本地所有修改（新创建的文件不会被撤销）
git checkout .

# 撤销本地新创建的文件（已存在文件的内容修改不会被撤销）
git clean -f

# 从暂存区回退到工作区
git reset HEAD filename # 指定文件

# 回退暂存区所有文件到工作区
git reset HEAD .

# 回退到某次提交
git reset <commit-sha> # 默认是 --mixed 回退的代码保留在工作区
git reset --mixed <commit-sha> # 回退的代码保留在工作区
git reset --soft <commit-sha> # 回退的代码保留在暂存区
git reset --hard <commit-sha> # 回退的代码不保留，该命令要谨慎操作

# 重置暂存区与工作区，与上一次commit保持一致
git reset --hard

# 回退到某次提交版本
git reset --hard <commit-sha>

# 查看分支当前版本commit SHA
git rev-parse HEAD

# 提交回退的版本 (注：强制提交后，当前版本后面的提交版本将会删掉！)
# git push -f
git push origin HEAD --force

# 新建一个commit，用来撤销指定commit
# git revert和git reset的区别：
# 前者只会创建一次新的提交（不会重置和更改原有的提交记录）而且只是撤销某一次提交
# 后者则会回退某一次提交记录之后的所有提交（会重置和更改历史提交记录，如果回退的提交已经pull到远程，回退以后push到远程必须使用强制推送 --force）
git revert <commit-sha>

# 拷贝应用某些已经存在的提交
git cherry-pick <commit-sha>

# 分支合并有冲突，选择中止分支合并操作
git merge --abort

# 中止变基操作
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

# 获取所有远程分支并清除远程仓库已删除的分支
git fetch --prune

# 查看对应分支的commit-sha
git show-ref <branch-name>

# 查看所有分支
git branch -a
```

### fork模式切换新分支

```bash
# 获取远程私仓库（origin）和远程公仓库（up/upstream）代码、分支、tag等信息，该命令只是拉取，并未进行合并操作，所以不会又冲突（git pull命令等于git fetch && git merge）
git fetch --all

# 获取远程公仓的分支后就可以切换分支了
git checkout <branch-name>

# 推送本地代码到远程私仓之前，先拉取更新远程公仓的代码，看是否有冲突
git pull up/upstream <branch-name>

# 推送本地代码到远程私仓
git push origin <branch-name>

# 最后在gitlab发起merge request代码合并请求
```

### 修改提交信息

```bash
# 修改最新commit提交信息
git commit --amend

# 修改某次历史commit提交信息
git rebase -i father-commit-sha # 要修改历史提交信息的前一次commit-sha

# 修改第一个commit的提交信息
git rebase -i --root
```

### 解决 Git 默认不区分文件名大小写的问题

```bash
git config core.ignorecase false
```

### git清理不必要的文件和优化本地仓库内存

```bash
git gc
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