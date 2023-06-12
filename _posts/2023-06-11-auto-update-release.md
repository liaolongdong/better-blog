---
layout: post
title: 前端项目版本投产实现浏览器自动刷新更新版本内容
subtitle: 前端项目版本投产实现浏览器自动刷新更新版本内容
date: 2023-06-11
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: 版本投产 更新版本内容
---

# 前端项目版本投产实现浏览器自动刷新更新版本内容

## 需求背景

前端项目版本投产如果没有拿到最新投产的资源包，可能会存在以下问题：

1. 缺少新功能或修复：如果最新的资源包含新功能或修复了现有的问题，但你没有获取到它们，那么这些改进将无法在生产环境中生效。用户将无法体验到这些新功能或修复的好处。

2. 性能问题：新版本的资源可能包含了性能优化的改进，如减少文件大小、缓存机制优化等。如果你没有获取到这些改进，你的应用程序可能会面临性能问题，加载速度可能较慢，响应时间可能较长。

3. 兼容性问题：新版本的资源可能包含了对新的浏览器特性的支持或对旧版本浏览器的兼容性改进。如果你没有获取到这些资源，你的应用程序可能在某些浏览器中出现兼容性问题，无法正常运行或显示。

4. 安全问题：新版本的资源可能包含了安全性修复，修复了已知的漏洞或安全风险。如果你没有获取到这些修复，你的应用程序可能存在潜在的安全风险，容易受到攻击。

5. 程序报错：如果最新投产的版本包含了一些配合后端接口数据改造，比如数据结构或者字段发生调整，如果没有获取到最新的改动可能会导致程序报错，会严重影响到用户体验。

为了避免以上问题，确保在前端版本投产后，能及时获取到最新的资源，我们需要使用一种比较好的方案来实现该需求，那么，目前有哪些比较常见的解决方案呢？

## 前期调研

其实，要检测前端项目版本内容的更新并实现自动刷新浏览器以更新版本内容的实现方案有不少，下面是目前常见的一些实现方案：

1. 轮询检测版本更新：

* 在前端代码中添加一个定时器，定期向服务器发送请求，检查是否有新的版本可用。
* 服务器端可以提供一个接口用于检查版本更新，比较当前客户端的版本号与服务器端最新版本号之间的差异。
* 如果有新版本可用，前端代码可以自动下载更新并刷新页面。

优缺点：实现起来简单粗暴，但是，轮询检测版本更新可能会对服务器端和客户端造成一定的负担，而且轮询时间间隔不好控制，多久轮询一次合适？

2. 使用服务端推送技术（Server-Sent Events，SSE）：

* Server-Sent Events 是一种基于HTTP的单向通信机制，允许服务器实时向客户端发送事件消息。
* 在前端代码中，通过创建 EventSource 对象来与服务器建立 SSE 连接，并监听服务器发送的消息。
* 当服务器检测到新版本时，可以向客户端发送一个 SSE 事件消息，客户端收到消息后触发自动刷新操作。

优缺点：SSE 的优点是它是一个简单而轻量级的协议，不需要额外的库或框架，适用于一些简单的实时通信场景。

3. 使用WebSocket实时通信：

* 建立WebSocket连接，使服务器能够实时向客户端发送消息。
* 当有新的版本可用时，服务器可以主动向客户端发送通知。
* 客户端收到通知后，可以自动下载更新并刷新页面。

优缺点：通过WebSocket实时通信，服务器可以直接向客户端推送消息，无需进行轮询。当服务器检测到新版本时，它可以立即发送消息给客户端，客户端收到消息后触发自动刷新操作，实现版本内容的自动更新。

这三种实现方案都需要后端配合，那有没有不需要后端配合，纯前端就能实现的方案呢？那是必须的

## 纯前端实现版本投产自动刷新浏览器更新版本内容

使用nodejs脚本生成版本信息json文件 + 监听页面显示和隐藏会触发的`visibilitychange`事件，纯前端实现版本投产自动刷新浏览器更新版本内容

大致实现原理：

1. 使用nodejs编写脚本，获取git版本相关信息（必须包含git commitId，用于版本对比），并保存为json文件，存放在构建打包的目录下（比如，public目录）。
2. 使用页面显示和隐藏会触发的`visibilitychange`事件，监听页面的显示和隐藏操作，如果页面显示，则请求打包放在dist根目录下的版本信息json文件，对比当前打包版本的`commitId`与历史版本信息json文件中`commitId`是否一致，如果不一致，则触发浏览器刷新。
3. vite打包项目使用`.env`文件 + `mport.meta.env`保存当前打包变量（webpack打包项目可以使用`definePlugin`插件 + `process.env` 保存变量）

## 使用nodejs编写获取git版本信息的脚本

前置知识：

* `vite` 项目打包，以及了解项目架构和目录结构
* `nodejs` 命令执行、文件读写操作相关api
* `dotenv` 安装 dotenv npm依赖，用于修改 `.env` 文件

废话不多说，直接上代码：

```js
// useNodeGetGitInfo.js 

/** 定义模块和变量**/
// const exec = require('child_process').exec //异步子进程
const execSync = require('child_process').execSync // 同步子进程
const fs = require('fs') // 文件读取模块
const path = require('path') // 文件路径处理模块
const gitInfoPath = 'gitInfo.json' // gitInfo路径
const publicPath = 'public' // 不能放到dist目录（该目录打包文件会被清空），要放到public目录，
const autoPush = false // 写入版本信息之后是否自动提交git上
const isVite = true // 是否是vite构建打包
const commitId = execSync('git show -s --format=%H').toString().trim() // 当前提交的版本号

// 不借用chalk库，原生Node打印颜色
// console.log('\x1b[32m%s\x1b[0m', '这是绿色文本') // 绿色
// console.log('\x1b[33m%s\x1b[0m', '这是黄色文本') // 黄色
// console.log('\x1b[31m%s\x1b[0m', '这是红色文本') // 红色

/** 程序开始**/
let gitInfoObj = {} // 保存git版本信息

Date.prototype.format ||
  (Date.prototype.format = function (fmt) {
    const opt = {
      'Y+': this.getFullYear().toString(), // 年
      'm+': (this.getMonth() + 1).toString(), // 月
      'd+': this.getDate().toString(), // 日
      'H+': this.getHours().toString(), // 时
      'M+': this.getMinutes().toString(), // 分
      'S+': this.getSeconds().toString(), // 秒
      // 有其他格式化字符需求可以继续添加，必须转化成字符串
    }
    for (let k in opt) {
      if (new RegExp('(' + k + ')', 'i').test(fmt)) {
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length == 1
            ? opt[k]
            : opt[k].padStart(RegExp.$1.length, '0'),
        )
      }
    }
    return fmt
  })

// 如果gitInfoPath存在，将先读取里边的版本信息
if (fs.existsSync(gitInfoPath)) {
  gitInfoObj = JSON.parse(fs.readFileSync(gitInfoPath).toString())
}

// 判断当前版本是否已经存在，存在则不再次生成
if (gitInfoObj.commitId === commitId) {
  console.warn('\x1B[33m%s\x1b[0m', 'warning: 当前的git版本数据已经存在了!\n')
} else {
  const currentGitBranch = execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim() // 当前git分支
  const name = execSync('git show -s --format=%cn').toString().trim() // 姓名
  const email = execSync('git show -s --format=%ce').toString().trim() // 邮箱
  const date = new Date(execSync('git show -s --format=%cd').toString()) // 日期
  const message = execSync('git show -s --format=%s').toString().trim() // 说明

  gitInfoObj = {
    currentGitBranch,
    name,
    email,
    date: date.format('yyyy-mm-dd hh:mm:ss'),
    commitId,
    message,
  }
  const saveInfoStr = JSON.stringify(gitInfoObj, null, 2)
  fs.writeFileSync(gitInfoPath, saveInfoStr)
  // 写入版本信息之后，自动将版本信息提交到当前分支的git上
  if (autoPush) {
    execSync(`git add .`)
    execSync(`git commit ${gitInfoPath} -m 自动提交版本信息`)
    execSync(
      `git pull origin ${execSync('git rev-parse --abbrev-ref HEAD')
        .toString()
        .trim()}`,
    )
    execSync(
      `git push origin ${execSync('git rev-parse --abbrev-ref HEAD')
        .toString()
        .trim()}`,
    )
  }

  // 程序执行结束
  console.log(
    '\x1b[32m%s\x1b[0m',
    `execute success: file address is ${process.cwd()}/${gitInfoPath}\n`,
  )
}

// 将gitInfo文件移植到public文件中，以便构建工具能够正常打包到项目根目录
if (fs.existsSync(publicPath)) {
  fs.writeFileSync(
    `${process.cwd()}/${publicPath}/${gitInfoPath}`,
    fs.readFileSync(gitInfoPath),
  )
}

// 如果是vite构建打包，把git信息追加写入.env文件中
if (isVite) {
  const dotenv = require('dotenv')

  const envPath = `${process.cwd()}/dotenv/.env`
  // 读取 .env 文件内容
  const envContent = fs.readFileSync(envPath, {
    encoding: 'utf-8',
  })

  // 解析内容为键值对对象
  const envVariables = dotenv.parse(envContent)
  const gitInfoStr = JSON.stringify(gitInfoObj)
  // 修改特定的环境变量
  envVariables.VITE_GIT_INFO = gitInfoStr

  // 将修改后的键值对转换为字符串
  const updatedEnvContent = Object.entries(envVariables)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  // 将修改后的内容写入 .env 文件
  console.log(updatedEnvContent)
  fs.writeFileSync(envPath, updatedEnvContent, { encoding: 'utf-8' })

  console.log('\x1b[32m%s\x1b[0m', '.env 文件已更新')
}
```

## 配置获取git版本信息脚本命令

```json
// package.json

"scripts": {
  "build": "npm run get-git-info && vite build",
  "preview": "vite preview",
  "get-git-info": "node scripts/git/useNodeGetGitInfo.js",
},
```

注意：`scripts/git/useNodeGetGitInfo.js`这个是我项目存放脚本的路径，可根据自己项目适当调整

## 项目入口JS文件，监听`visibilitychange`事件

前置知识：

* `vite + vue3` 生命周期
* `visibilitychange` 事件用法
* `import.meta.env` 获取 `vite` 打包相关变量

```js
// app.js

const updateVersion = () => {
  // 检测新版本自动刷新浏览器更新版本内容
  if (import.meta.env.MODE !== 'development') {
    // 获取当前版本git信息
    const gitInfo = import.meta.env.VITE_GIT_INFO
    const gitInfoObj = gitInfo && JSON.parse(gitInfo)

    // 通过监听visibilitychange事件，取获取git版本信息
    document.addEventListener('visibilitychange', () => {
      // 只有在页面显示的时候才触发版本检测
      if (document.visibilityState === 'hidden') return
      // 使用时间戳防止请求到缓存的数据
      fetch(`/gitInfo.json?v=${Date.now()}`)
        .then((res) => {
          return res.json()
        })
        .then((data) => {
          if (data.commitId !== gitInfoObj.commitId) {
            location.reload()
          }
        })
    })
  }
}

onMounted(() => {
  updateVersion()
})
```

完成以上步骤，可以在自己项目中使用 `npm run build && npm run preview`进行测试并查看预览效果。

## node脚本生成的文件

生成的git版本信息json文件

```json
// gitInfo.json

{
  "currentGitBranch": "master",
  "name": "Better",
  "email": "924902324@qq.com",
  "date": "2023-06-12 21:34:07",
  "commitId": "51007620dcea797659336606631f331082fad0c2",
  "message": "feat: 打包版本变化自动刷新浏览器测试"
}
```

生成 .env 文件

```bash
# .env 文件

VITE_GIT_INFO={"currentGitBranch":"master","name":"Better","email":"924902324@qq.com","date":"2023-06-12 21:34:07","commitId":"51007620dcea797659336606631f331082fad0c2","message":"feat: 打包版本变化测试"}
```

## 总结

通过使用nodejs脚本生成git版本信息json文件 + 监听页面显示和隐藏会触发的`visibilitychange`事件，纯前端实现版本投产自动刷新浏览器更新版本内容，相比定时轮询等实现方式更加优雅，也不需要后端配合，当然也不会增加后端服务器的压力，唯一的缺点可能就是，频繁切换标签打开页面可能会多次请求git版本信息json文件，不过由于该文件很小只有500字节左右，还是可以接受的。

有人可能会问，直接通过在nginx服务器上设置html文件禁止使用缓存（no-store）就好了，因为只要index.html禁止使用缓存，html加载对应的js和css都是通过vite或者webpack构建工具打包的，文件变动会自动更新文件哈希串，为啥还要用这种方式呢？这种方式确实可以在一定程度上解决这个问题，但是有个前提是需要用户手动刷新浏览器或者重新打开页面，才能加载到最新的资源，如果用户打开页面以后一直停留在该页面，也不主动刷新，那么用户可能还是拿到的旧资源，而不是投产后的新资源，而通过监听页面显示和隐藏会触发的`visibilitychange`事件就可以解决这个问题，即使用户不手动刷新浏览器，只要用户切屏或者切换标签（包括锁屏、睡眠）等都会触发接口请求对比版本，从而拿到最新的资源包。

如果大家有更好的实现方案，欢迎评论区留言，一起学习，一起进步！
