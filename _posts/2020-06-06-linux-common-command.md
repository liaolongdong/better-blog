---
layout: post
title: linux常用命令
subtitle: linux常用命令
date: 2021-03-23
categories: 技术 linux 
# cover: /assets/img/postCover/gulp_cover.png
tags: linux linux命令 
---

# linux常用命令

快捷操作：

- 搜寻目录的时候，按tab键自动补全
- 使用上下箭头，切换最近执行的命令

## 文件目录相关

```bash
# 进入服务器根目录
cd /

# 在当前目录进入src子目录
cd src

# 返回上级目录
cd ..

# 在任意目录下直接进入根目录下的 src 目录
cd /src

# 查看当前目录路径
pwd

# 查看当前目录下的文件
ls

# 查看当前目录下的所有文件，包含隐藏文件
ls -a

# 查看目录文件所属权限（可读、可写权限等）和目录组属权限（root、dplyop、log等） (secure CRT、xshell等工具)
ll

# 新建文件
touch test.md

# 查看文件内容
vim test.md

# 修改文件内容
# 使用 vim 进入 按 i 字母键 即可编辑内容
# 编辑完保存并退出 按 esc 键 然后 在按 shift + : 然后输入 wq
# 直接退出按 shift + : 然后输入 q
# 放弃修改直接退出 输入 q! 

# 删除文件
rm test.md

# 创建demo文件夹
mkdir demo

# 目录授权 - root 用户下运行，可以设置执行文件夹权限改为对所有用户可读，可写，可执行
chmod 777 demo -R

# 删除文件夹及其目录下所有子目录和文件（示例：删除demo文件夹下所有内容）
cd demo # 进入demo文件夹
rm -rf * # 删除demo文件夹下的所有文件  特别注意：这个操作别在根目录下执行，* 号前面必须要有空格
# rm -rf demo # 直接删除demo文件夹 -r 表示递归删除文件夹 -f 表示不询问

# 从服务器下载文件到本地电脑下载文件夹 (secure CRT、xshell等工具)
sz test.md

# 从本地电脑上传文件到服务器当前目录 (secure CRT、xshell等工具)
rz # 然后按 enter 回车键
```

[更多linux常见命令详见](https://blog.csdn.net/qq_23329167/article/details/83856430/)
