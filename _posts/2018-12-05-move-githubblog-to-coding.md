---
layout: post
title: git管理项目关联多个远程仓库（github、coding）
subtitle: 把github pages博客迁移到coding pages
seo_short_title: git 关联多个远程仓库（github、coding）
seo_description: 让一个 git 仓库同时关联 github 与 coding 多个远程：github 屏蔽百度蜘蛛导致博客搜不到，迁到国内的 coding pages 后，一次改代码分别提交两个仓库。
date: 2018-12-05
categories: [前端工程化]
# cover: 外链封面 2026-09-22 实测已失效（timgsa.baidu.com 域名已停服，请求直接连不上），故注释掉。
# 留着会让首页卡片与文章页头图渲染成破图；要恢复请换成本地 /assets/img/<slug>/banner.webp 再取消注释。
# cover: https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1545187742&di=7d8e45e81d6781b8ce775417c40786c9&imgtype=jpg&er=1&src=http%3A%2F%2Fwww.emmielewis.com%2Fwp-content%2Fuploads%2F2015%2F07%2Fgithub-logo.png
tags: git github coding.net blog 博客
tldr: '一个仓库挂两个远程靠 git remote add 起别名，clone 下 coding 仓库再把 github 加成第二个远程；两边历史不相干，pull 时得加允许合并无关历史的选项，之后改一次代码分两次推。'
faq:
  - q: '博客放在 GitHub Pages 上，百度搜不到文章，对策是什么？'
    a: '原因是 github 屏蔽了百度蜘蛛，挂在它上面的东西百度搜索不到。对策是把 github.io 上的代码迁到 coding 仓库管理：coding 服务器部署在国内，国内访问比外网的 github 可能快一点，而且 coding 还能免费设置私有仓库。'
  - q: '同一个本地目录怎么同时关联 github 和 coding 两个远程，怎么确认关联成功了？'
    a: "先把 coding 仓库 clone 到本地并 cd 进项目，这时 origin 指向的就是 coding；再用 git remote add github 加上 github 仓库的地址，把 github 加成第二个远程。关联成功后可以用 git remote -v 或者直接翻 .git/config 看这个项目挂了哪几个远程。"
  - q: '执行 git pull github master 出现 fatal: refusing to merge unrelated histories 怎么办？'
    a: '这个提示是说两边仓库的提交历史没有关联，git 拒绝合并。解法是 pull 的时候加上 --allow-unrelated-histories 选项，允许合并没有关联的历史；拉下来之后再用 git push origin master 把代码推送到 coding。github 项目反向关联 coding 的操作类似，区别是 coding 仓库里的代码是私密的，拉取要输入账号和密码；日常提交是两个远程各推一次。'
---

## 背景

由于github屏蔽了百度蜘蛛，所以github上的东西，百度搜索不到，想让自己部署在github的个人博客网站中的文章能让百度搜索引擎搜索到，所以想把github.io上的代码迁移到coding仓库管理，coding服务器部署在国内，所以国内访问相对在外网的github速度可能会快一点，而且coding还可以免费设置私有仓库等优点。让git关联多个远程仓库就可以只改一次代码分别提交到不同的远程仓库了，这样会方便很多。

## git关联多个远程仓库

1、首先，我们在coding中新建一个项目，如图：
![新建coding项目](/assets/img/postCover/coding_init.png)

2、把coding仓库项目关联到github项目
使用`git remote add [refs] [addr`命令关联远程仓库，`refs`指向远程仓库，默认是origin，`addr`指向项目仓库地址，比如：

```git
git clone git clone https://git.coding.net/liaolongdong/blog.git // 克隆coding仓库项目到本地
cd blog // 进入项目
git remote add github https://github.com/liaolongdong/liaolongdong.github.io.git // 把github仓库的项目关联到coding仓库项目
```

3、关联成功以后可以使用`git remote -v`或者`vim .git/config`查看该项目关联的git远程仓库，如图：
![查看git远程关联仓库](/assets/img/postCover/git_remote.png)
![查看git配置信息](/assets/img/postCover/git_config.png)

4、把github仓库项目关联到coding以后，我们拉取github远程仓库的代码到coding仓库，使用`git pull github master`命令，注意这里使用的是`github`而不是默认的`origin`，`origin`拉取的是coding远程仓库的代码，而`github`拉取的是github远程仓库的代码，在执行该git命令操作以后会出现`fatal: refusing to merge unrelated histories`错误提示，拒绝合并没有关联的历史记录，解决这个问题只需在pull的时候加上`--allow-unrelated-histories`选项，允许合并没有关联的历史记录，可以使用`git pull --options`命令查看，`git pull`的配置选项如图：
![查看git pull命令配置选项](/assets/img/postCover/git_pull_options.png)

5、拉取成功以后再使用`git push origin master`命令就可以将github远程仓库拉取的代码推送到coding远程仓库啦！如图：
![把conggithub拉取的代码推送到coding远程仓库](/assets/img/postCover/git_pull_github_to_coding.png)
![coding远程仓库效果](/assets/img/postCover/git_link_finished.png)

6、github仓库项目关联coding仓库操作也和上面操作类似，分别在对应的远程仓库项目本地操作以上命令即可，coding仓库项目中的代码是私密的所以要输入账号和密码才能拉取。如图：
![github项目关联coding项目](/assets/img/postCover/github_link_coding.png)

7、git提交修改到多个远程仓库，以coding仓库项目为例

```git
git push origin master // 提交到coding远程仓库
git push github master // 提交到github远程仓库
```
