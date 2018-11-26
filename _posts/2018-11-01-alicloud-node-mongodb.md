---
layout: post
title: 阿里云服务器上部署node+mongodb
subtitle: 阿里云服务器上部署node+mongodb
date: 2018-11-01
categories: 阿里云服务器部署 云服务器ECS 域名解析 nodeJS Mongodb
cover: 'https://img.alicdn.com/tfs/TB14GrElwHqK1RjSZJnXXbNLpXa-3840-1280.jpg'
tags: 阿里云服务器部署 云服务器ECS 域名解析 nodeJS Mongodb
---

# 阿里云服务器上部署node和mongodb教程以及总结

-------------------------------------
前言：从阿里云购买域名、ECS云服务器到实名认证、域名解析、网站备案再到部署node和mongodb数据到阿里云服务器，查了很多相关的资料，踩过无数的坑，终于完成了。作为一个没怎么接触过后端以及运维知识的前端er来说，真心不容易啊，所以特意写一篇博客记录一下自己踩过的坑，避免自己以后再踩同样的坑，同时，也能让一些想在阿里云服务器上部署自己的博客或者网站的新手少走弯路、少踩坑。

## 第一步，在阿里云购买域名和云服务器ECS

域名购买，[点链接](https://wanwang.aliyun.com/?spm=5176.8142029.735711.61.3dbd6d3e2Bh6DX)  
购买阿里云服务器ECS，[点链接](https://www.aliyun.com/product/ecs?spm=5176.8142029.735711.7.3dbd6d3e2Bh6DX)  
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

可打开终端命令窗口进行操作

```linux
ssh root@公网IP地址
// 输入云服务器登录密码
```

如图：
![使用终端linux命令行登录](/assets/img/postCover/ssh_root_login.png)

不喜欢命令行操作的同学可以下载图形化操作软件————FileZilla，来进行文件操作，如图：
![FileZilla站点管理](/assets/img/postCover/filezilla_manage_site.png)
![FileZilla连接云服务器](/assets/img/postCover/filezilla_connect.png)
![FZ登录远程服务器站点](/assets/img/postCover/filezilla_remote_site.png)

- Windows电脑:

图形化操作软件xshell或者winscp软件  
![winscp1](/assets/img/postCover/winscp1.png)
![winscp2](/assets/img/postCover/winscp2.png)
![winscp3](/assets/img/postCover/winscp3.png)

命令行操作界面软件putty  
![putty_login](/assets/img/postCover/putty_login.png)

**注意：使用ssh root@公网IP地址 登录密码 进入的默认目录是root目录，该目录下是没有东西的，必须使用`cd /`回到根目录，然后输入`cd ls`查看根目录下所有的文件**  

## 第二步，在阿里云服务器上安装node和mongodb

根据第一步的操作，我们熟悉了  

- 阿里云服务器控制台相关的基本操作  
- 使用`ssh root@0.0.0.0`(0.0.0.0替换成自己云服务器ecs实例的公网IP地址) 加登录密码 登录到云服务器  
- 给实例添加安全组  

### 安装node和mongodb

> node - 编译后二进制文件在`/usr/local/bin/node`下  
> mongodb - 安装在`usr/local/mongodb`下

#### 安装node

1、先升级CentOS，在命令窗口输入

```linux
yum -y update
```

2、升级完成以后，进入到`/usr/local/src`文件夹下，该文件夹通常用来存放软件源代码

```linux
cd /usr/local/src
```

3、下载node代码压缩包并解压，通过命令行下载node源码压缩包可能比较慢，可以下载到本地电脑以后再通过FileZillas上传到云服务器站点指点目录，再进行解压
source code [下载地址](https://nodejs.org/dist/v10.13.0/node-v10.13.0.tar.gz)  

使用命令行下载

```linux
wget https://nodejs.org/dist/v10.13.0/node-v10.13.0.tar.gz
```

4、解压node源码压缩包

```linux
tar -xzvf node-v10.13.0.tar.gz
```

5、进入解压后的文件夹

```linux
cd node-v10.13.0
```

6、执行配置脚本进行编译预处理

```linux
./configure
```

这个步骤可能会出现`WARNING: failed to autodetect C++ compiler version (CXX=g++) `之类的错误，可以[参考文章](https://www.cnblogs.com/felixzh/p/5822354.html)  

7、编译源代码

```linux
make
```

这个步骤可能会很久，可以先来一杯coffee再说  

8、安装

当编译完成后，需要使之在系统范围内可用, 编译后的二进制文件将被放置到系统路径，默认情况下，Node二进制文件应该放在/user/local/bin/node文件夹下

```linux
make install
```

9、测试node安装是否成功

```linux
node -v
```

显示版本号说明安装成功啦

10、编写一个app.js入口文件，测试一哈  

把nodeapp代码放到`/home`文件夹下

```linux
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

```linux
node app.js
```

如果只是使用node app.js的方式启动nodeapp应用 在本地并没有什么问题 我们不关闭进程窗口就可以了 但是在云服务不太现实
所以我们需要在云服务上全局安装pm2，使用pm2就可以保证我们的nodeapp一直处于启动状态，除非你手动关闭

12、使用node自带的包安装管理器npm，安装express和pm2，这两个模块推荐全局安装  
express - node web应用框架（可自行根据需要安装），[详细用法](http://www.expressjs.com.cn/)  
pm2 - 是一个带有负载均衡功能的Node应用的进程管理器.当你要把你的独立代码利用全部的服务器上的所有CPU,并保证进程永远都活着，[详细用法](http://www.cnblogs.com/flyingeagle/p/9219376.html)  
安装了pm2后，我们一起来试试吧  

```linux
pm2 start app.js --name '名称' // 启动命令start 重启restart 停止stop 
```

![pm2启动nodeapp](/assets/img/postCover/pm2_start.png)  
**注意：1、端口号必须添加安全组  2、node启动的文件入口（如app.js）修改需要重启项目才会生效**

13、在云服务器安装git  

> 在云服务器上安装git以后，我们就可以直接使用git命令操作来克隆或拉取git仓库中的项目了，每次项目更新直接使用git pull拉取就好了，简单方便又快捷  

使用CentOS系统安装包命令yum

```linux
yum install git
```

检测git安装是否成功

```linux
git --version
```

显示`git version x.x.x.x`表示安装成功

在安装完git以后，我们就可以和平常在本地一样用git命令来操作git仓库中的项目啦

```linux
cd /home // 进入home目录
git clone https://github.com/liaolongdong/react-next-project.git // 把react-next-project项目克隆到home目录下
```

14、域名解析

域名解析是把域名指向网站空间IP，让人们通过注册的域名可以方便地访问到网站的一种服务。简单来说，就是把域名指向服务器IP地址。

点击控制台`域名`菜单，进入`域名服务` -> `域名列表`，如图：
![阿里云服务器域名解析入口](/assets/img/postCover/dns_one.png)
然后点击`域名`或`解析`按钮，进入域名解析设置页面，点击`新手引导`，就可以把域名指向指定的云服务器的IP地址了，如图：
![阿里云服务器域名解析设置](/assets/img/postCover/dns_two.png)
![阿里云服务器域名解析设置](/assets/img/postCover/dns_two.png)

最后，通过域名访问就可以访问到你指定的服务器了，如图：


#### 在安装完node和git后，接下来安装mongodb

> 软件安装位置：/usr/local/mongodb  
> 数据存放位置：/usr/local/mongodb/data/db  
> 日志存放位置：/usr/local/mongodb/data/logs  

数据和日志文件位置也可以放在`/var/mongodb/data`、`/var/mongodb/logs`, 只要`--dbpath`指定正确即可  

**注意：/data/db 是 MongoDB 默认的启动的数据库路径(--dbpath)**  
**如果你的数据库目录不是/data/db，可以通过 --dbpath 来指定**  


1、进入安装mongodb的目录，下载mongodb源代码压缩包，和前面node一样也可以把压缩包下载到本地，再通过图形化工具FileZilla软件上传到云服务器指点目录  

```linux
cd /usr/local
wget https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-4.0.4.tgz
```

2、解压安装包，并重命名文件夹为mongodb

```linux
tar zxvf mongodb-linux-x86_64-4.0.4.tgz
mv mongodb-linux-x86_64-4.0.4 mongodb
```

3、创建数据和日志存放目录

```linux
mkdir /usr/local/mongodb/data/db
mkdir /usr/local/mongodb/data/logs
```

4、创建mongodb.conf配置文件, 放在`usr/local/mongodb`目录下

```linux
cd /usr/local/mongodb
touch mongodb.conf
vim mongodb.conf
```

mongodb.conf文件配置内容  

```linux
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

[linux下安装mongodb详情可查看](http://www.runoob.com/mongodb/mongodb-linux-install.html)  

5、启动和终止mongodb

启动mongodb  
进入`/usr/local/mongodb/bin`目录  

```linux
cd /usr/local/mongodb/bin
./mongod --config ../mongodb.conf
```

启动成功会看到

```linux
about to fork child process, waiting until server is ready for connections.
forked process: 18999
child process started successfully, parent exiting
```

我们可以通过使用`ps aux |grep mongodb`命令查看mongodb进程是否开启

```linux
root      2216  0.4  7.1 389076 72692 ?        Rl   10月24  98:36 ./mongod --config ../mongodb.conf
root     19711  0.0  0.0 112720   980 pts/0    R+   14:47   0:00 grep --color=auto mongodb
```

第一个就是刚刚启动的进程，进程ID是2216，如果你想要终止进程，可以使用`kill -9 2216`来结束进程  

如果我们在本地的windows环境安装了mongodb，通常我们测试是否开启mongodb的办法是直接在浏览器输入`http://127.0.0.1:27017`去查看，如果是检测云服务器是否开启mongodb，我们可以在浏览器地址栏输入`http:{云服务器公网IP地址}:{mongodb设置的端口号}`，比如：`http://47.107.60.51:27017/`进行查看，如果启动成功会看到如下信息：

```linux
It looks like you are trying to access MongoDB over HTTP on the native driver port.
```

在linux系统上还可以使用命令去查看是否开启：

```linux
netstat -anpt|grep 27017    27017是mongodb的端口号
```

可以看到第一条数据

```linux
tcp        0      0 0.0.0.0:27017           0.0.0.0:*               LISTEN      2216/./mongod 
```

**笔者在浏览器输入地址栏查看云服务器是否开启mongodb时，遇到拒绝访问的问题，原因是因为没有在云服务器ECS设置该端口号（27017）的安全组，就是第一步特意强调的给实例配置对应端口号安全组规则**

进入终端操作数据库

```linux
cd /usr/local/mongodb/bin
./mongo
```

**注意：这里如果不是mongodb默认端口号27017，则必须指定端口号，比如：`./mongo --port=27018`**
执行完上面步骤后会看到

```linux
MongoDB shell version: 3.2.9
connecting to: test
>
```

MongoDB Shell是MongoDB自带的交互式Javascript shell,用来对MongoDB进行操作和管理的交互式环境。  
当你进入mongoDB后台后，它默认会链接到 test 文档（数据库） 
接下来就可以操作数据库啦  

```linux
> show dbs
```

在mongodb数据库操作终端输入`show dbs`时，出现如下错误：

```linux
MongoDB shell version: 3.2.9
connecting to: test
> show dbs // 显示数据库
admin   0.000GB
config  0.000GB
local   0.000GB
> 
```

mongodb默认是没有开启安全认证的，对于部署在云上就显得及其不安全，下面我们为mongodb的admin数据库创建用户。  
mongodb数据库有以下特点：  
1，没有默认管理员账号，所以要先添加管理员账号，在开启权限认证。  
2，切换到admin数据库，添加的账号才是管理员账号。  
3，用户只能在用户所在数据库登录，包括管理员账号。  
4，管理员可以管理所有数据库，但是不能直接管理其他数据库，要先在admin数据库认证后才可以。  

知道以上几点以后，我们把数据库切换到`admin`

```linux
> db // 查看当前处在数据库
test
> use admin // 切换到admin数据库
switched to db admin
> db.createUser({user:"appAdmin",pwd:"password",roles:[{role:"userAdminAnyDatabase",db:"admin"}]}) // 创建用户
Successfully added user: {
	"user" : "appAdmin",
	"roles" : [
		{
			"role" : "userAdminAnyDatabase",
			"db" : "admin"
		}
	]
}
> db.auth('appAdmin', 'password') // 使用db.auth()验证User是否有权限访问当前数据库
1 // 表示有权限
> db.createCollection('user') // 创建文档（表）
{ "ok" : 1 }
> show collections // 显示当前数据库下的文档（表）
user
> db.user.insert({name: 'better', age: 18}) // 往user文档中添加一条数据
WriteResult({ "nInserted" : 1 })
```

**注意：如果出现类似的错误`"errmsg" : "not authorized on admin to execute `，则说明没有权限**  
解决方案：给用户授予相应的操作权限

```linux
> db.grantRolesToUser('appAdmin', [{role: 'dbOwner', db:'admin'}])
```

mongodb数据库角色权限，[可以参考这篇文章](https://www.cnblogs.com/zxtceq/p/7690977.html)  

可以使用mongodb图形化软件（Robo 3T），[下载链接](https://robomongo.org/download)  
![mongodb图形化连接1](/assets/img/postCover/mongodb_connect_one.png)
![mongodb图形化连接2](/assets/img/postCover/mongodb_connect_two.png)
![mongodb图形化连接3](/assets/img/postCover/mongodb_connect_three.png)

mongodb数据库`连接\增\删\改\查`操作就不再做详细介绍了，内容太多了，[更多内容详见mongodb](https://www.cnblogs.com/xiaohuochai/p/7215067.html?utm_source=itdadao&utm_medium=referral)  

参考文章：

[部署Node.js项目（CentOS）](https://help.aliyun.com/document_detail/50775.html?spm=a2c4g.11186623.6.836.417c5ea5eKHaFp)  
[Nodejs 部署到阿里云全过程](https://blog.csdn.net/moumaobuchiyu/article/details/55004430)  
[手把手教你在阿里云CentOS7上部署基于MongoDB+Node.js的博客](https://blog.csdn.net/weixin_39350487/article/details/82185387)  
[如何将网站部署到阿里云服务器](https://www.jianshu.com/p/a4e4a8c9b86c)  
[linux下安装mongodb详情可查看](http://www.runoob.com/mongodb/mongodb-linux-install.html)  
[在Linux服务器中配置mongodb环境](https://www.aliyun.com/jiaocheng/127114.html)  
[阿里云centos下部署mongodb](https://www.aliyun.com/jiaocheng/125928.html)  
[Mongoose基础入门](https://www.cnblogs.com/xiaohuochai/p/7215067.html?utm_source=itdadao&utm_medium=referral)  
[nginx服务部署 说明](https://www.aliyun.com/jiaocheng/118630.html?spm=5176.100033.2.31.689d54del9j0g1)
