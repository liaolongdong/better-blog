---
layout: post
title: git之reset和revert详解
subtitle: git之reset和revert详解
date: 2023-06-14
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: git reset revert 代码回退 代码回撤
---

# `git reset`和`git revert`详解

## 背景

程序员在编码开发提交代码的时候，经常会出现需要回退、回撤代码的情况，比如某个功能延期了，需要回退某个功能提交的代码，遇到这种情况的时候发现有不少工作很多年的程序员都不太清楚怎么处理，这也是令我有点意外的，为了更好的帮助哪些不了解怎么进行代码回退或者代码撤销的新老程序员，特意写了这篇文章，希望对大家有所帮助。遇到这种情况，我们今天的主角`git reset`和`git revert`就可以派上用场了。

## `git reset` 详解

`git reset`命令的作用是将指定提交之后的内容从当前分支中移除，并将HEAD指针移动到指定提交，同时将当前分支指针移动到指定提交，并将之后的提交从历史中移除。

### 使用示例

```bash
# 回退到指定版本
git reset <commit-hash>

# 等同于 `git reset <commit-hash>`, `<commit-hash>`之后的提交内容都会保留到工作区
git reset --mixed <commit-hash>

# `<commit-hash>`之后的提交内容会保留到暂存区，但是工作区不会改变
git reset --soft <commit-hash>

# `<commit-hash>`之后的提交内容都不会被保留，直接被移除掉了
git reset --hard <commit-hash>

# 回退到上一个版本
git reset HEAD^

# 回退到上两个版本
git reset HEAD~2
```

### 常用选项

```bash
git reset -h

usage: git reset [--mixed | --soft | --hard | --merge | --keep] [-q] [<commit>]
   or: git reset [-q] [<tree-ish>] [--] <paths>...
   or: git reset --patch [<tree-ish>] [--] [<paths>...]

    -q, --quiet           be quiet, only report errors
    --mixed               reset HEAD and index
    --soft                reset only HEAD
    --hard                reset HEAD, index and working tree
    --merge               reset HEAD, index and working tree
    --keep                reset HEAD but keep local changes
    --recurse-submodules[=<reset>]
                          control recursive updating of submodules
    -p, --patch           select hunks interactively
    -N, --intent-to-add   record only the fact that removed paths will be added later
```

`git reset <commit-hash>` 使用的最多的三个命令是`--mixed`、`--soft`和`--hard`

`--mixed`（默认值）表示重置HEAD和index，也就是说`<commit-hash>`之后的提交内容都会保留到工作区

`--soft`表示只重置HEAD指针，也就是说`<commit-hash>`之后的提交内容会保留到暂存区，但是工作区不会改变

`--hard`表示重置HEAD、index和working tree，也就是说`<commit-hash>`之后的提交内容都不会被保留，直接被移除掉了

所以，如果想保留`<commit-hash>`之后的提交内容，最好使用`mixed`或者`--soft`，慎用`--hard`

### 注意事项

- `git reset`命令适合在单人分支，比如自己专属的`feature`分支上使用，**多人共享的分支，需慎用，防止不小心把别人提交的代码也回退了**
- 使用`git reset`命令会修改历史提交记录，所以不能直接使用`git push`推送提交到远程分支，需要使用`git push -f`命令，强制推送
- **如果不慎使用了`git reset --hard <commit-hash>` 命令，导致`<commit-hash>`之后的提交内容都被移除了，可以使用`git reflog`命令查看最近90天的操作记录，找到需要回滚的提交记录`<reset-hash>`，然后再使用`git reset <reset-hash>`命令进行回退，注意`git reflog`操作记录默认只会保留90天**

## `git revert` 详解

`git revert`创建一个新的提交，用来撤销指定提交引入的更改，这样可以保留提交历史的完整性。

### 使用示例

```bash
# 撤销指定提交
git revert <commit-hash>

# 撤销多个非连续的提交 -n 代表不自动提交
git revert -n <commit-hash-1> <commit-hash-2>
git commit -m "Revert multiple commits"

# 撤销多个连续的提交
git revert -n <commit-hash-a>..<commit-hash-b>
git commit -m "Revert multiple commits"

# 使用`--abort`取消回撤
git revert --abort
```

使用`-n`选项，可以在一个提交中撤销多个提交，最后通过一次提交来保存这些撤销。

### 常用选项

```bash
git revert -h

usage: git revert [<options>] <commit-ish>...
   or: git revert <subcommand>

    --quit                end revert or cherry-pick sequence
    --continue            resume revert or cherry-pick sequence
    --abort               cancel revert or cherry-pick sequence
    --skip                skip current commit and continue
    --cleanup <mode>      how to strip spaces and #comments from message
    -n, --no-commit       don't automatically commit
    -e, --edit            edit the commit message
    -s, --signoff         add Signed-off-by:
    -m, --mainline <parent-number>
                          select mainline parent
    --rerere-autoupdate   update the index with reused conflict resolution if possible
    --strategy <strategy>
                          merge strategy
    -X, --strategy-option <option>
                          option for merge strategy
    -S, --gpg-sign[=<key-id>]
                          GPG sign commit
```

### 注意事项

- 新的提交历史： `git revert`创建新的提交，而不会改变现有的提交历史，这对于已经共享的分支是一种安全的操作。
- 冲突处理： 在执行`git revert`时可能会遇到冲突，需要解决冲突后再次提交。

## 区别比较

- 影响范围： `git reset`会修改提交历史，影响之后的提交；而`git revert`则通过创建新的提交来撤销指定提交，保留了提交历史的完整性。
- 共享分支： `git reset`应慎用于共享分支，因为它会修改提交历史；而`git revert`更适合在已经共享的分支上安全使用。
