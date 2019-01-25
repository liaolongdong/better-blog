---
layout: post
title: 使用verdaccio搭建npm私有仓库
subtitle: 使用verdaccio搭建npm私有仓库
date: 2019-01-24
categories: 技术 部署 仓库 私有仓库 npm
cover: /assets/img/postCover/npm_private_cover.png
tags: npm 私有仓库 组件库
---

# 使用verdaccio搭建npm私有仓库

需求背景：平时在项目工作中可能会用到很多通用性的代码，比如，框架类、工具类以及公用的业务逻辑代码等等，通过打包发布到npm中央仓库或者私有仓库，来进行维护和托管代码，方便公用代码的使用，如果涉及到不方便公开的代码组件可以发布到私有仓库。

私有npm组件库的优势：

- 私有npm包只对公司内部局域网开放
- 速度比直接在npm下载包更快，也比使用淘宝镜像快，毕竟是在公司内部局域网
- 对于发布和下载npm包可以配置权限管理

在研究搭建npm私有组件仓库时，查阅了很多相关方面的资料，有使用maven包管理的私服工具nexus搭建私有仓库的，也有使用阿里的cnpm搭建私有npm仓库的，还有使用sinopia和verdaccio搭建私有仓库的，下面介绍一下它们的主要区别：

- [使用maven包管理的私服工具nexus搭建私有仓库](https://blog.csdn.net/chaos_hf/article/details/78668539)，这种方式更偏向与后台使用，服务端的同学应该比较熟悉
- [阿里的cnpm搭建npm私有仓库](https://www.jianshu.com/p/80b88104ec1f)，这个是阿里自己内部也在使用的，应该也挺好用，不过需要安装MySQL数据库，而且配置比较麻烦
- [使用sinopia搭建npm私有仓库](https://www.jianshu.com/p/e4db4a0af96a)，这个使用比较简单，而且不用配置数据库，但是这个github项目好像三四年都没有人维护了

经过查阅相关资料后对比，最后选择使用verdaccio来搭建npm私有仓库，这个github项目貌似是sinopia的分支，用法和sinopia差不多。

## 服务器搭建

1、安装node

> Verdaccio is a lightweight private npm proxy registry built in Node.js

verdaccio是基于node.js的，所以在我们的服务器上需要安装node，如何在阿里云服务器安装node，详见我之前写的博客[阿里云服务器上部署node+mongodb](http://liaolongdong.com/2018/11/01/alicloud-node-mongodb.html)

2、安装verdaccio

```git
npm install -g verdaccio --unsafe-perm
```

加上`--unsafe-perm`选项是为了防止`gyp ERR! permission denied`权限问题报错，如下：

```git
gyp ERR! configure error
gyp ERR! stack Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/verdaccio/node_modules/dtrace-provider/build'
gyp ERR! System Linux 3.10.0-862.14.4.el7.x86_64
gyp ERR! command "/usr/local/bin/node" "/usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js" "rebuild"
gyp ERR! cwd /usr/local/lib/node_modules/verdaccio/node_modules/dtrace-provider
gyp ERR! node -v v8.12.0
gyp ERR! node-gyp -v v3.8.0
gyp ERR! not ok
```

如果出现需要更新npm，则执行`npm install -g npm`操作

执行结果：

```linux
/usr/local/bin/verdaccio
```

3、启动verdaccio

```git
verdaccio
```

执行结果如下：

```git
Verdaccio doesn't need superuser privileges. Don't run it under root.
 warn --- config file  - /root/.config/verdaccio/config.yaml
 warn --- Plugin successfully loaded: htpasswd
 warn --- Plugin successfully loaded: audit
 warn --- http address - http://localhost:4873/ - verdaccio/3.10.2
```

从控制台的输出，我们可以看到，verdaccio的配置文件路径在`/root/.config/verdaccio/config.yaml`和默认访问地址`http://localhost:4873/`，在配置文件末尾增加`listen: 0.0.0.0:4873`保存

```linux
// 进入verdaccio目录
cd /root/.config/verdaccio/

// 查看该目录下的文件，该目录下默认有两个文件：config.yaml和storage，添加用户之后会自动创建htpasswd
ls
> config.yaml  storage

// 查看配置文件
vim config.yaml
```

在配置文件config.yaml末尾加入代码：

```yaml
# you can specify listen address (or simply a port)
listen: 0.0.0.0:4873
```

> 在阿里云服务器添加安全组，开放 `4873` 端口号，如果没有添加该端口安全组则不能在浏览器正常访问`http://47.107.60.51:4873`

[查看verdaccio配置文件详细文档](https://verdaccio.org/docs/en/configuration)

[verdaccio默认配置](https://verdaccio.org/docs/en/configuration)，如下：

```yaml
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@*/*':
    access: $all
    publish: $authenticated
    proxy: npmjs
  '**':
    proxy: npmjs
logs:
  - {type: stdout, format: pretty, level: http}
```

其中`url`可以配置成淘宝镜像地址：

```yaml
url: https://registry.npm.taobao.org/  //默认为npm的官网，由于国情，修改 url 让verdaccio使用 淘宝的npm镜像地址，这样下载速度更快
```

4、使用pm2启动verdaccio，保证该进程一直处于打开状态

安装pm2

```git
npm install -g pm2 --unsafe-perm
```

使用pm2启动verdaccio，以保证进程一直处于打开状态

```linux
pm2 start verdaccio
```

执行命令以后结果如图所示：

![使用pm2启动verdaccio](/assets/img/postCover/npm_private_pm2.png)

5、访问搭建好的私有仓库

在浏览器中打开`http://47.107.60.51:4873`，如果能正常访问则说明搭建成功了。如图：

![浏览器打开私有仓库页面](/assets/img/postCover/npm_private_web.png)

## 客户端（本地）发布npm到私有仓库

使用verdaccio在服务器搭建好私有仓库以后，接下来就是如何在本地上传npm包到私有仓库服务器了

发布npm包之前必须先注册账号，具体可参考博客[如何开发一个npm包并发布到npm中央仓库](http://liaolongdong.com/2019/01/24/publish-public-npm.html)

### 1、登录

```git
npm adduser --registry  http://47.107.60.51:4873
```

输入npm账号用户名、密码和邮箱，如下：

```git
Username: better1025
Password: 
Email: (this IS public) 924902324@qq.com
Logged in as better1025 on http://47.107.60.51:4873/.
```

输出`Logged in as better1025 on http://47.107.60.51:4873/.`，表示npm账号`better1025`成功登录到`http://47.107.60.51:4873/`私有仓库了。

### 2、发布npm包到私有仓库

```git
npm publish --registry http://47.107.60.51:4873
```

发布成功以后如下：

```git
npm notice 
npm notice 📦  lld-npm-demo@1.0.2
npm notice === Tarball Contents === 
npm notice 230B package.json 
npm notice 101B helloworld.js
npm notice 115B index.js     
npm notice === Tarball Details === 
npm notice name:          lld-npm-demo                            
npm notice version:       1.0.2                                   
npm notice package size:  412 B                                   
npm notice unpacked size: 446 B                                   
npm notice shasum:        990fac51aaa0cac64f25da052306112b588ce792
npm notice integrity:     sha512-Bl9FtXdg819Ds[...]jkTmzfbKjA9og==
npm notice total files:   3                                       
npm notice 
+ lld-npm-demo@1.0.2
```

如何发布npm包以及遇到错误，参考博客[如何开发一个npm包并发布到npm中央仓库](http://liaolongdong.com/2019/01/24/publish-public-npm.html)就行，这里就不再累述了。

### 3、npm成功发布到私有仓库

在浏览器中刷新`http://47.107.60.51:4873`页面，如图：

![发布npm包到私有仓库成功](/assets/img/postCover/npm_private_success.png)

### 4、如何使用私有仓库npm包

由于国内访问国外网限制，为了提升我们下载npm包的速度，我们在平时项目开发中一般都会设置[淘宝镜像](http://npm.taobao.org/)。

```git
// 设置淘宝镜像
npm install -g cnpm --registry=https://registry.npm.taobao.org
```

查看npm配置信息

```git
npm config ls
```

下载我们发布到私有仓库的npm包时，需要修改仓库地址，具体操作如下：

```git
npm set registry http://47.107.60.51:4873
```

在执行这条命令以后，再使用`npm install lld-npm-demo`命令就会优先去我们自己的私有仓库下载npm包，如何没有找到，则会从npm中央仓库下载

执行命令和结果，如下：

```git
Betters-iMac:privateRegistry better$ npm set registry http://47.107.60.51:4873
Betters-iMac:privateRegistry better$ npm install lld-npm-demo
npm notice created a lockfile as package-lock.json. You should commit this file.
npm WARN privateregistry@1.0.0 No description
npm WARN privateregistry@1.0.0 No repository field.

+ lld-npm-demo@1.0.2
added 1 package from 1 contributor and audited 1 package in 3.083s
found 0 vulnerabilities
```

最后推荐一个npm仓库切换工具：切换npm仓库地址，推荐使用nrm

> nrm是 npm registry 管理工具, 能够查看和切换当前使用的registry。不安装也可以，安装会更高效。

```git
npm install -g nrm
```

参考文章：  

[verdaccio官方文档](https://verdaccio.org/docs/en/installation)  
[npm 私服工具verdaccio 搭建(二)](https://blog.csdn.net/YYZZHC999/article/details/80114218)  
[使用verdaccio搭建npm仓库](https://www.jianshu.com/p/7ba60b85e048)  
[NPM私有仓库Sinopia搭建及使用](https://www.jianshu.com/p/e4db4a0af96a)  
[使用cnpm搭建私有NPM仓库 发布npm包](https://www.cnblogs.com/huangenai/p/6918667.html)  
[npm 私有模块的3种方法](https://www.jianshu.com/p/a9540d9f8d9c)  
[使用 cnpmjs.org 搭建私有npm仓库](https://www.jianshu.com/p/80b88104ec1f)