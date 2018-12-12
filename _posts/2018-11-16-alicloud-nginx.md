---
layout: post
title: 阿里云服务器部署nginx
subtitle: 阿里云服务器部署nginx
date: 2018-11-16
categories: 阿里云服务器部署 云服务器ECS 域名解析 nginx
cover: 'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1544596712507&di=137b7928b3d4ca1c310c84c0a3174272&imgtype=0&src=http%3A%2F%2Fs3.51cto.com%2Foss%2F201801%2F12%2Fc04e0d7bf8ef89a2d4e7a2fa554ff137.jpg-wh_651x-s_2430839636.jpg'
tags: 阿里云服务器部署 云服务器ECS 域名解析 nginx
---

# 阿里云服务器（centos）部署nginx

## 云服务安装nginx

1、首先，升级所有的包，更新CentOS的内核到最新版本，centos使用yum包管理命令  

```linux
yum -y update // -y（当安装过程提示选择全部为"yes"）
```

**注意：`yum -y update`和`yum -y upgrade`的区别**  
>`yum -y update`(所有都升级和改变)：升级所有包,系统版本和内核，改变软件设置和系统设置  
>`yum -y upgrade`(不变内核和设置,升级包和系统版本)：升级所有包和系统版本，不改变内核,软件和系统设置

2、安装nginx  

```linux
yum -y install nginx
```

3、测试nginx安装是否成功  

>nginx启动目录：`/usr/sbin`
>nginx网站默认目录：`/usr/share/nginx/html`  
>nginx配置文件默认路径：`/etc/nginx/nginx.conf`  

使用`whereis nginx`查看nginx相关目录，进入到`/usr/sbin/`目录下，执行`nginx`启动nginx，如图：
![启动nginx](/assets/img/postCover/nginx_directory.png)

在浏览器地址栏输入云服务器公网IP地址，可以看到如下页面：
![检测nginx是否安装成功](/assets/img/postCover/nginx_install_success.png)

linux相关命令操作介绍：

- 查看端口占用情况：`netstat -apn | grep [端口号]`
- 查看占用端口的进程: `ps -ef | grep [占用端口进程id]`
- 杀掉进程：`kill -9 [进程id]`

4、修改nginx配置文件信息

```linux
cd /etc/nginx
vim nginx.conf // 查看nginx.conf配置文件信息
```

如图：
![nginx配置信息](/assets/img/postCover/nginx_config.png)

可以通过修改nginx配置文件就改配置信息，比如把默认端口号80改成其它端口号等等  

**注意：1、设置端口号必须要在阿里云服务器添加对应的安全组，否则不能正常访问；2、必须重启nginx，重启命令`nginx -s reload`；**

参考文章：  
[nginx服务部署 说明](https://www.aliyun.com/jiaocheng/118630.html?spm=5176.100033.2.31.689d54del9j0g1)  
[Nginx 配置详解](http://www.runoob.com/w3cnote/nginx-setup-intro.html)  
[Nginx 服务器安装及配置文件详解](http://www.runoob.com/w3cnote/nginx-install-and-config.html)  
