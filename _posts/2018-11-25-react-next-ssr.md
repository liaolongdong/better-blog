---
layout: post
title: 使用react+next实现服务端渲染
subtitle: 使用react+next实现服务端渲染
date: 2018-11-25
categories: react next ssr 服务端渲染
cover: '/assets/img/postCover/next_cover.png'
tags: react next ssr 服务端渲染
---

# 使用next.js实现服务端渲染

## 什么是服务端渲染

服务端渲染，是指页面的渲染和生成由服务器来完成，并将渲染好的页面返回客户端。而客户端渲染是页面的生成和数据的渲染过程是在客户端（浏览器或APP）完成。  

前后端分离前的服务端渲染技术有：PHP，ASP，JSP等方式，分离后的前端SPA（单页面应用）渲染拥有独立的路由和页面渲染（React，Vue和Angular等），而SPA的最大问题是对SEO不友好，当项目对SEO有需求时，SPA就不是一个好的选择。

与传统 SPA（Single-Page Application - 单页应用程序）相比，服务器端渲染(SSR)的优势主要在于：  

1、更好的 SEO，由于搜索引擎爬虫抓取工具可以直接查看完全渲染的页面。  

2、更快的内容到达时间(time-to-content)，特别是对于缓慢的网络情况或运行缓慢的设备。能很好的解决SPA（单页面应用）项目过大，首屏加载过慢等问题。  

服务器端渲染(SSR)的缺点：  

1、开发学习成本较高。  

2、增加服务器的负担。  

关于服务端渲染介绍更详细的资料，[详见](https://ssr.vuejs.org/zh/#%E4%BB%80%E4%B9%88%E6%98%AF%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%AB%AF%E6%B8%B2%E6%9F%93-ssr-%EF%BC%9F)  

react服务端渲染官方推荐使用next.js框架

## next.js特性

Next.js 是一个轻量级的 React 服务端渲染应用框架。  

next.js的特性：  

- 以文件系统为基础的客户端路由(File-System Routing)  
- 代码自动分隔使页面加载更快(Automatic Code Splitting)  
- 默认服务端渲染模式(Server Side Rendering)  
- 开发环境支持模块热替换(Hot Module Replacement)  
- 支持JSX和ES6语法  
- 支持typescript  
- 可以运行在Express和其他Node.js的HTTP 服务器上  
- 可以定制化专属的babel和webpack配置  

## 如何搭建一个next.js项目

熟悉react和node框架express技术栈的同学，学起next.js来可能会快很多。  

搭建一个next.js项目

### 创建next.js项目

```git
// 在本地文件夹中创建项目根目录
mkdir learnnextjs-demo

// 进入next项目根目录
cd learnnextjs-demo/

// 初始化项目， 添加package.json文件，`-y`表示全部询问都执行yes
npm init -y

// 安装依赖包
yarn add react react-dom next

// 创建pages文件夹，next.js项目必须包含pages文件夹，启动报错（Couldn't find a `pages` directory. Please create one under the project root）
mkdir pages
```

完成上面的操作以后，可以直接执行`yarn next`启动next项目，可以在package.json文件中scripts字段中加入：

```json
{
    "scripts": {
        "dev": "next"
    }
}
```

然后执行`yarn dev`命令，启动项目，启动完成以后再浏览器中输入`http://localhost:3000`，会出现一个404页面，这是因为我们pages文件夹下没有添加index.js（项目首页）  

### 创建页面

Next.js是从服务器生成页面，再返回给前端展示。Next.js默认从 pages 目录下取页面进行渲染返回给前端展示，并默认取 pages/index.js 作为系统的首页进行展示。  
**注意：Next.js是从服务器生成页面，再返回给前端展示。Next.js默认从 pages 目录下取页面进行渲染返回给前端展示，并默认取 pages/index.js 作为项目的首页进行展示。**  

在pages目录下，创建index.js（项目首页）

```js
// index.js

const Index = () => (
  <div>
    <p>Hello Next.js!</p>
  </div>
)

export default Index
```

Next.js默认支持webpack的热部署功能，添加完index.js后，可以看到 http://localhost:3000/ 页面内容自动更新了。  

### 创建多页面

使用Next.js的目的就是构建非SPA的多页面应用，next.js项目pages文件夹下的页面都可以通过页面名称进行访问，比如about、post页面  

在pages目录下创建about和post页面

```js
// about.js

export default () => (
    <div>
        <p>This is the about page</p>
    </div>
)

// post.js

export default () => (
  <div>
    <p>This is the post page</p>
  </div>
)
```

在浏览器地址栏输入`http://localhost:3000/about`或者`http://localhost:3000/post`就能看到对应的about和post页面了。  

在next.js项目中的要实现客户端路由跳转需要通过next.js的`Link API`来控制。

### next.js路由

