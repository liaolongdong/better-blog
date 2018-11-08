---
layout: post
title: 阿里云服务器上部署node+mongodb
subtitle: 阿里云服务器上部署node+mongodb
date: 2018-11-01
categories: 阿里云服务器 nodeJS Mongodb
# cover: '/assets/img/postCover/js_good_parts.jpg'
tags: 阿里云服务器 nodeJS Mongodb
---

## 阿里云服务器上部署node和mongodb教程以及总结

-------------------------------------
前言：从阿里云购买域名、ECS云服务器到实名认证、域名解析、网站备案再到部署node和mongodb数据到阿里云服务器，查了很多相关的资料，踩过无数的坑，终于完成了。作为一个没怎么接触过后端以及运维知识的前端er来说，真心不容易啊，所以特意写一篇博客记录一下自己踩过的坑，避免自己以后再踩同样的坑，同时，也能让一些想在阿里云服务器上部署自己的博客或者网站的新手少走弯路、少踩坑。

### 第一步，在阿里云购买域名和云服务器ECS

域名购买，地址：https://wanwang.aliyun.com/?spm=5176.8142029.735711.61.3dbd6d3e2Bh6DX
阿里云服务器ECS，地址：https://www.aliyun.com/product/ecs?spm=5176.8142029.735711.7.3dbd6d3e2Bh6DX
新注册的阿里云的用户或者淘宝账号实名认证的学生，首次购买有优惠，笔者购买的ECS配置：
CPU： 1核
内存： 1 GB
操作系统： CentOS 7.4 64位
**注意：购买时会设置云服务登录密码，创建实例会有远程连接密码，两个不是同一个密码**
**注意：不同操作系统的包安装管理命令不一样，比如：CentOS|Redhat linux使用的是yum、Ubuntu使用的是apt-get、Mac OS 是brew**

购买完服务器以后可以进入控制台
![阿里云控制台入口](/assets/img/postCover/alicloud_control_guide.png)

在控制台点击`云服务器ECS`，再点击`云服务器`，可以进入云服务器实例列表界面，如图：
![云服务器ECS概览界面](/assets/img/postCover/ecs_overview.png)
![云服务器ECS实例](/assets/img/postCover/ecs_shili_list.png)

进入实例列表页面，点击`管理`可进入实例列表详情页面
在实例详情页面，可以操作管理实例，经常操作的主要有：**停止、重启云服务器；配置实例安全组**等
![云服务器ECS实例](/assets/img/postCover/ecs_shili_detail.png)

点击`安全组`,可进入安全组列表页面，进入该页面，点击`配置规则`，进行配置安全组
**注意：必须给云服务器ECS实例配置安全组，否则，部署的网站不能正常访问，比如：http协议默认端口号访问网站的必须配置80端口号安全组，https和mongodb也一样**
![实例配置安全组](/assets/img/postCover/ecs_safe_port.png)

点击`远程连接`命令行输入界面（需输入远程连接密码）
输入6位数字远程连接密码，进入linux命令行操作界面
输入用户名：root
密码：云服务器登录密码
登录云服务器
输入linux命令行 `cd /` 进入云服务器根目录，如图：
![连接远程服务器界面](/assets/img/postCover/ecs_ssh_login.png)

- Mac电脑：
可打开终端命令窗口进行操作，如图：
![使用终端linux命令行登录](/assets/img/postCover/ssh_root_login.png)

不喜欢命令行操作的同学可以下载图形化操作软件————FileZilla，来进行文件操作，如图：
![FileZilla站点管理](/assets/img/postCover/filezilla_manage_site.png)
![FileZilla连接云服务器](/assets/img/postCover/filezilla_connect.png)
![FZ登录远程服务器站点](/assets/img/postCover/filezilla_remote_site.png)

- Windows电脑:
图形化操作软件xshell或者winscp软件

**注意：使用ssh root@公网IP地址 登录密码 进入的默认目录是root目录，该目录下是没有东西的，必须使用`cd /`回到根目录，然后输入`cd ls`查看根目录下所有的文件**

### 第二步，在阿里云服务器上安装node和mongodb

根据第一步的操作，我们熟悉
- 阿里云服务器控制台相关的基本操作
- 使用`ssh root@0.0.0.0`(0.0.0.0替换成自己云服务器ecs实例的公网IP地址) 加登录密码 登录到云服务器
- 给实例添加安全组

#### 安装node和mongodb

> node - 编译后二进制文件在`/usr/local/bin/node`下
> mongodb - 安装在`usr/local/mongodb`下

##### 安装node
1、先升级CentOS，在命令窗口输入
```
yum -y update
```

2、升级完成以后，进入到`/usr/local/src`文件夹下，该文件夹通常用来存放软件源代码
```
cd /usr/local/src
```

3、下载node代码压缩包并解压，通过命令行下载node源码压缩包可能比较慢，可以下载到本地电脑以后再通过FileZillas上传到云服务器站点指点目录，再进行解压
source code 下载地址：https://nodejs.org/dist/v10.13.0/node-v10.13.0.tar.gz

使用命令行下载
```
wget https://nodejs.org/dist/v10.13.0/node-v10.13.0.tar.gz
```

4、解压node源码压缩包
```
tar -xzvf node-v10.13.0.tar.gz
```

5、进入解压后的文件夹
```
cd node-v10.13.0
```

6、执行配置脚本进行编译预处理
```
./configure
```
这个步骤可能会出现`WARNING: failed to autodetect C++ compiler version (CXX=g++) `之类的错误，可以参考文章 https://www.cnblogs.com/felixzh/p/5822354.html

7、编译源代码
```
make
```
这个步骤可能会很久，可以先来一杯coffee再说

8、安装
当编译完成后，需要使之在系统范围内可用, 编译后的二进制文件将被放置到系统路径，默认情况下，Node二进制文件应该放在/user/local/bin/node文件夹下
```
make install
```

9、测试node安装是否成功
```
node -v
```
显示版本号说明安装成功啦

10、编写一个app.js入口文件，测试一哈
把nodeapp代码放到`/home`文件夹下
```
cd /home // 进入home目录
touch app.js // 创建app.js文件
vim app.js // 编辑app.js文件
```

```js
// app.js
const http = require('http');
const hostname = '0.0.0.0'; // 改成 阿里云实例公网IP地址
const port = 3000; // 注意：没有指定端口号 默认是80端口 改成 80 监听默认80端口
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World\n');
});
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
```

11、启动nodeapp
```
node app.js
```
如果只是使用node app.js的方式启动nodeapp应用 在本地并没有什么问题 我们不关闭进程窗口就可以了 但是在云服务不太现实
所以我们需要在云服务上全局安装pm2，使用pm2就可以保证我们的nodeapp一直处于启动状态，除非你手动关闭

12、使用node自带的包安装管理器npm，安装express和pm2，这两个模块推荐全局安装
express - node web应用框架（可自行根据需要安装），详细用法：http://www.expressjs.com.cn/
pm2 - 是一个带有负载均衡功能的Node应用的进程管理器.当你要把你的独立代码利用全部的服务器上的所有CPU,并保证进程永远都活着，详细用法：http://www.cnblogs.com/flyingeagle/p/9219376.html
安装了pm2后，我们一起来试试吧
```
pm2 start app.js --name '名称' // 启动命令start 重启restart 停止stop 
```
![pm2启动nodeapp](/assets/img/postCover/pm2_start.png)

##### 安装mongodb
> 软件安装位置：/usr/local/mongodb
> 数据存放位置：/usr/local/mongodb/data/db
> 日志存放位置：/usr/local/mongodb/data/logs

数据和日志文件位置也可以放在`/var/mongodb/data`、`/var/mongodb/logs`, 只要`--dbpath`指定正确即可

**注意：/data/db 是 MongoDB 默认的启动的数据库路径(--dbpath)**
**如果你的数据库目录不是/data/db，可以通过 --dbpath 来指定**


1、进入安装mongodb的目录，下载mongodb源代码压缩包，和前面node一样也可以把压缩包下载到本地，再通过图形化工具FileZilla软件上传到云服务器指点目录
```
cd /usr/local
wget https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-4.0.4.tgz
```

2、解压安装包，并重命名文件夹为mongodb
```
tar zxvf mongodb-linux-x86_64-4.0.4.tgz
mv mongodb-linux-x86_64-4.0.4 mongodb
```

3、创建数据和日志存放目录
```
mkdir /usr/local/mongodb/data/db
mkdir /usr/local/mongodb/data/logs
```

4、创建mongodb.conf配置文件, 放在`usr/local/mongodb`目录下
```
cd /usr/local/mongodb
touch mongodb.conf
vim mongodb.conf
```

mongodb.conf文件配置内容
```
#端口号(默认的端口号是27017，这里修改也是为了安全性)
port=27017

#数据目录（指向刚才创建的数据文件目录）
dbpath=/usr/local/mongodb/data/db

#日志目录（指向刚才创建的日志目录，并指定mongodb.log文件名，系统会自动创建）
logpath=/usr/local/mongodb/data/logs/mongodb.log
 
#设置后台运行
fork=true
 
#日志输出方式（写日志的模式：设置为true为追加。默认是覆盖。如果未指定此设置，启动时MongoDB的将覆盖现有的日志文件。）
logappend=true
 
#开启认证（默认是flase,不需要认证的，这里开启认证是为了安全性）
auth=true

#对外开放端口（默认是127.0.0.1）
bind_ip=0.0.0.0

```

5、启动和终止mongodb

启动mongodb
进入`/usr/local/mongodb/bin`目录
```
cd /usr/local/mongodb/bin
./mongod --config ../mongodb.conf
```
启动成功会看到
```
about to fork child process, waiting until server is ready for connections.
forked process: 18999
child process started successfully, parent exiting
```

进入终端操作数据库
```
cd /usr/local/mongodb/bin
./mongo
```
**注意：这里如果不是mongodb默认端口号27017，则必须指定端口号 `./mongo --port=27018`**
执行完上面步骤后会看到
```
MongoDB shell version: 3.2.9
connecting to: test
```
接下来就可以操作数据库啦

linux下安装mongodb详情可查看：http://www.runoob.com/mongodb/mongodb-linux-install.html



参考文章：

[部署Node.js项目（CentOS）](https://help.aliyun.com/document_detail/50775.html?spm=a2c4g.11186623.6.836.417c5ea5eKHaFp)  
[Nodejs 部署到阿里云全过程](https://blog.csdn.net/moumaobuchiyu/article/details/55004430)  
[手把手教你在阿里云CentOS7上部署基于MongoDB+Node.js的博客](https://blog.csdn.net/weixin_39350487/article/details/82185387)  
[Mongoose基础入门](https://www.cnblogs.com/xiaohuochai/p/7215067.html?utm_source=itdadao&utm_medium=referral)  
[linux下安装mongodb详情可查看](http://www.runoob.com/mongodb/mongodb-linux-install.html)




