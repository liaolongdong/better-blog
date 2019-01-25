---
layout: post
title: 如何开发一个npm包并发布到npm中央仓库
subtitle: 如何开发一个npm包并发布到npm中央仓库
date: 2019-01-24
categories: 技术 部署 仓库 npm
cover: https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1548388440630&di=113721b90da880056b64bac0f84154a8&imgtype=0&src=http%3A%2F%2Fwww.bccn.net%2Fmedia%2Fnews%2F2017%2F01%2F16%2F1484556320_99662422.jpg
tags: npm 仓库
---

# 如何开发一个npm包并发布到npm中央仓库

需求背景：平时在项目工作中可能会用到很多通用性的代码，比如，框架类、工具类以及公用的业务逻辑代码等等，通过打包发布到npm中央仓库或者私有仓库，来进行维护和托管代码，方便公用代码的使用，如果涉及到不方便公开的代码组件可以发布到私有仓库。

## npm包命名规则及文件夹结构

1. 用模块的名称命名根目录，npm包名不能重复

2. 每个npm包根目录下都包含一个index.js文件和package.json文件

3. src目录，用于放置未压缩的源码

4. dist目录，用于放置压缩后的代码

5. 使用package.json文件的规格来描述本模块

## 发布npm到npm中央仓库(公共仓库)

### 1、注册npm账号

我们在发布npm包之前，要去[npm官网](https://www.npmjs.com/)注册一个账号，注册完账号以后，点击邮件链接完成验证

### 2、编写模块

首相，创建publishNpm文件夹，在该文件夹下添加helloworld.js文件和index.js文件，代码如下：

```linux
// 创建模块目录
mkdir publishNpm

// 进入目录
cd publishNpm

// 创建helloworld.js文件和index.js文件
touch helloworld.js index.js
```

```js
// helloworld.js文件

function helloworld (name) {
    console.log('hello world,', name);
}
exports.helloworld = helloworld;
```

```js
// index.js文件

var helloworld = require('./helloworld');
console.log('helloworld', helloworld);
helloworld.helloworld('better');
```

接下来，在publishNpm目录下，执行`npm init`命令，初始化package.json文件

```git
npm init
```

```json
// package.json 文件

{
    "name": "lld-npm-demo",
    "version": "1.0.1",
    "description": "publish npm demo",
    "main": "index.js",
    "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
    },
    "author": "better",
    "license": "ISC"
}
```

**注意：1、npm包名称`name`的值不能和已经存在的npm包名相同；2、每次版本更新都必须修改版本号`version`的值**

### 3、发布npm到npm公共仓库

#### 添加账户

```git
npm adduser
```

输入用户名、密码和邮箱

查看当前登录的用户

```git
npm who am i
```

#### 发布npm包

```git
npm publish
```

发布成功以后，就可以在npm个人中心看到刚刚发布的npm包了

#### 更新npm包

和发布npm一样都是使用`npm publish`命令，更新发布之前必须修改版本号

#### 使用npm

和我们平时使用npm一样

```git
npm install lld-npm-demo
```

#### 发布npm常见错误

1、npm仓库设置了淘宝镜像

```git
npm ERR! code E403
npm ERR! 403 Forbidden - PUT https://registry.npm.taobao.org/lld-npm-demo - no_perms

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/better/.npm/_logs/2019-01-24T02_08_54_914Z-debug.log
```

解决方案：

```git
// 检查仓库是否被设成了淘宝镜像库(https://registry.npm.taobao.org/)
npm config get registry

// 如果设置了淘宝镜像，执行以下命令
npm config set registry=http://registry.npmjs.org

// 解决问题后重新发布
npm publish

// 发布成功以后，在设会淘宝镜像
npm config set registry=https://registry.npm.taobao.org/
```

2、账号未登录

```git
npm ERR! code E401
npm ERR! 401 Unauthorized - PUT http://registry.npmjs.org/lld-npm-demo - You must be logged in to publish packages.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/better/.npm/_logs/2019-01-24T02_13_00_370Z-debug.log
```

解决方案：

```git
// 登录用户 npm login
npm adduser

// 登录用户以后重新发布
npm publish
```

3、重新发布未修改版本号

```git
npm ERR! code E403
npm ERR! 403 Forbidden - PUT http://registry.npmjs.org/lld-npm-demo - You cannot publish over the previously published versions: 1.0.0.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/better/.npm/_logs/2019-01-24T02_55_19_409Z-debug.log
```

解决方案：在package.json文件修改版本号