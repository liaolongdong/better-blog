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

<!-- [next.js项目效果展示](http://cn.liaolongdong.com:3000/)  
[next.js完整项目github地址](https://github.com/liaolongdong/react-next-project)   -->
[next.js Demo github地址](https://github.com/liaolongdong/learnnextjs-demo)  

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
**注意：next.js只支持react16**

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
        "dev": "next",
        "build": "next build",
        "start": "next start"
    }
}
```

然后执行`yarn dev`命令，启动项目，启动完成以后再浏览器中输入`http://localhost:3000`，会出现一个404页面，这是因为我们pages文件夹下没有添加index.js（项目首页）  
如果你想使用其他端口，可运行 `npm run dev -- -p <设置端口号>`。

### 创建页面

Next.js是从服务器生成页面，再返回给前端展示。Next.js默认从 pages 目录下取页面进行渲染返回给前端展示，并默认取 pages/index.js 作为项目的首页进行展示。  

在pages目录下，创建index.js（项目首页）

```js
// index.js

export default () => <div>Welcome to next.js!</div>
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
```

```js
// post.js
export default () => (
  <div>
    <p>This is the post page</p>
  </div>
)
```

在浏览器地址栏输入`http://localhost:3000/about`或者`http://localhost:3000/post`就能看到对应的about和post页面了。  

在next.js项目中，只有页面级组件才会放到pages文件夹下，其它的子组件可以放在其它文件夹下，比如components目录下。

### next.js路由

在next.js项目中的要实现客户端路由跳转需要通过next.js的`Link API`来控制。  

我们在项目根目录下创建components文件夹，并在该目录下创建`Header`和`Layout`组件公共组件，`Header`组件用于页面导航头部，`Layout`组件用于页面布局，具体代码如下如下：

```js
// Header.js
import Link from 'next/link'

const linkStyle = {
    marginRight: 15
}

const Header = () => (
    <div>
        <Link href="/">
            <a style={linkStyle}>Home</a>
        </Link>
        <Link href="/about">
            <a style={linkStyle}>About</a>
        </Link>
    </div>
)

export default Header
```

```js
// Layout.js
import Header from './Header'

const layoutStyle = {
    margin: 20,
    padding: 20,
    border: '1px solid #DDD'
}

const Layout = (props) => (
  <div style={layoutStyle}>
        <Header />
        {props.children}
  </div>
)

export default Layout
```

接下来再修改pages目下的about.js、post.js和index.js文件，把刚刚编写的`Layout`公共组件用于页面布局，修改以后的具体代码如下：

```js
// about.js
import Layout from '../components/Layout'

export default () => (
    <Layout>
       <p>This is the about page</p>
    </Layout>
)
```

```js
// post.js
import Layout from '../components/Layout'

export default (props) => (
    <Layout>
       <h1>{props.url.query.title}</h1>
       <p>This is the blog post content.</p>
    </Layout>
)
```

```js
// index.js
import Layout from '../components/Layout'
import Link from 'next/link'

const PostLink = (props) => (
  <li>
    <Link as={`/p/${props.id}`} href={`/post?title=${props.title}`}>
      <a>{props.title}</a>
    </Link>
  </li>
)

export default () => (
  <Layout>
    <h1>My Blog</h1>
    <ul>
      <PostLink id="hello-nextjs" title="Hello Next.js"/>
      <PostLink id="learn-nextjs" title="Learn Next.js is awesome"/>
      <PostLink id="deploy-nextjs" title="Deploy apps with Zeit"/>
    </ul>
  </Layout>
)
```

**注意：可以使用`<Link prefetch>`使链接和预加载在后台同时进行，来达到页面的最佳性能。**

我们可以看到在`post.js`中，我们通过`props.url.query.title`可以获取到`PostLink`组件中`href`属性传递过来的`title`参数，而且在该组件中使用了`Link`组件的`as`属性，该属性的作用是进行**路由覆盖**，在不使用该属性时，在点击链接后浏览器地址栏显示的是`http://localhost:3000/post?title=Hello%20Next.js`，而使用了`as`属性，浏览器地址栏显示的是`http://localhost:3000/p/hello-nextjs`，从这里我们可以看出使用**路由覆盖**最大的好处就是可以自定义我们浏览器路由地址显示效果，可以让路由地址显示更简洁、更美观。但是，使用**路由覆盖也有一个缺点**就是刷新该页面以后会出现404页面，`This page could not be found.`。  

出现这个问题的原因是因为当在 `Link` 组件上使用 `as` 属性时，浏览器上显示的是 `as` 属性的值，走的是客户端路由，而服务器真正映射的是 `href` 属性的值，走的是服务端路由。所以刷新页面以后会出现404，要解决这个问题，那就需要我们在服务端路由做一下路由解析处理。

接下来我们再来编写服务端需要的代码，让服务端也支持路由覆盖，我们需要单独对路由进行处理，在服务端我使用的是node的web应用程序开发框架express

安装express依赖包

```git
yarn add express
```

安装express后，在项目的根目录创建server.js文件

```js
// server.js
const express = require('express')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare()
    .then(() => {
        const server = express()

        // 服务端对post页面路由覆盖特殊处理
        server.get('/p/:id', (req, res) => {
            // 实际跳转页面
            const actualPage = '/post'
            // 路由参数
            const queryParams = {
                title: req.params.id
            }
            app.render(req, res, actualPage, queryParams)
        })

        // 所有请求都交由next处理
        server.get('*', (req, res) => {
            return handle(req, res)
        })

        // 监听端口号
        server.listen(3000, (err) => {
            if (err) throw err
            console.log('> Ready on http://localhost:3000')
        })
    })
    .catch((ex) => {
        console.error(ex.stack)
        process.exit(1)
    })
```

编写玩`server.js`后，我们不在使用next默认的启动方式，而是使用我们自己编写的server.js作为启动入口，修改`package.json`文件：

```json
{
    "scripts": {
        "dev": "node server.js"
    },
}
```

修改`server.js`文件以后再使用`yarn dev`重启项目。

在`server.js`文件中我们对post页面做了路由解析，以此来实现服务端和浏览器端请求路由访问到同一个页面，在express处理post页面路由中使用了`actualPage`参数，把该参数设置成`post`，同时，附带上请求该页面时附带的参数。这时，我们在刷新页面时，就不会出现404了。

### 请求接口获取数据

在介绍完next.js路由以后，接下来实现如何在next.js中请求页面初始化数据。

我们需要引入一个支持在客户端和服务器端发送 fetch 请求的插件 isomorphic-unfetch，当然你也可以使用 axios 等其他工具。

```git
yarn add isomorphic-unfetch
```

在next.js中，我们使用页面级组件中的getInitialProps属性来获取数据，修改pages文件夹下的index.js和post.js文件，具体代码如下：

```js
// index.js

import Layout from '../components/Layout.js'
import Link from 'next/link'
import fetch from 'isomorphic-unfetch'

const Index = (props) => (
    <Layout>
        <h1>Batman TV Shows</h1>
        <ul>
            {props.shows.map(({show}) => (
                <li key={show.id}>
                    <Link as={`/p/${show.id}`} href={`/post?id=${show.id}`}>
                        <a>{show.name}</a>
                    </Link>
                </li>
            ))}
        </ul>
        <style jsx>{`
            h1, a {
                font-family: "Arial";
            }

            ul {
                padding: 0;
            }

            li {
                list-style: none;
                margin: 5px 0;
            }

            a {
                text-decoration: none;
                color: blue;
            }

            a:hover {
                opacity: 0.6;
            }
        `}</style>
    </Layout>
)

Index.getInitialProps = async function() {
    const res = await fetch('https://api.tvmaze.com/search/shows?q=batman')
    const data = await res.json()

    console.log(`Show data fetched. Count: ${data.length}`)

    return {
        shows: data
    }
}

export default Index
```

```js
// post.js

import Layout from '../components/Layout'
import fetch from 'isomorphic-unfetch'

const Post = (props) => (
	<Layout>
		<h1>{props.show.name}</h1>
		<p>{props.show.summary.replace(/<[/]?p>/g, '')}</p>
		<img src={props.show.image.medium}/>
	</Layout>
)

Post.getInitialProps = async function(context) {
	console.log(`context: ${context}`);
	const {id} = context.query
	const res = await fetch(`https://api.tvmaze.com/shows/${id}`)
	const show = await res.json()

	console.log(`Fetch show: ${show.name}`)

	return {show}
}

export default Post
```

再修改`server.js`文件中的post路由参数配置

```js
// 服务端路由覆盖特殊处理
server.get('/p/:id', (req, res) => {
    console.log('params', req.params);
    // 实际跳转页面
    const actualPage = '/post'
    // 路由参数
    const queryParams = { id: req.params.id }
    app.render(req, res, actualPage, queryParams)
})
```

重启项目，并根据以上修改后的代码我们可以得出以下结论：

- 当页面渲染时加载数据，我们使用了一个异步方法getInitialProps。它能异步获取 JS 普通对象，并绑定在props上
- 当服务渲染时，getInitialProps将会把数据序列化，就像JSON.stringify。所以确保getInitialProps返回的是一个普通 JS 对象，而不是Date, Map 或 Set类型。
- 当页面初次加载时，getInitialProps只会在服务端执行一次。getInitialProps只有在路由切换的时候（如Link组件跳转或路由自定义跳转）时，客户端的才会被执行。
- 当页面初始化加载时，getInitialProps只会加载在服务端。只有当路由跳转（Link组件跳转或 API 方法跳转）时，客户端才会执行getInitialProps。

**注意：getInitialProps不能使用在子组件中。只能使用在pages页面中。**

### 支持嵌入样式

通过绑定styled-jsx来生成独立作用域的css

```js
export default () =>
  <div>
    Hello world
    <p>scoped!</p>
    <style jsx>{`
      p {
        color: blue;
      }
      div {
        background: red;
      }
      @media (max-width: 600px) {
        div {
          background: blue;
        }
      }
    `}</style>
    <style global jsx>{`
      body {
        background: black;
      }
    `}</style>
  </div>
```

**注意：styled-jsx 的样式不会应用到子组件，如果想要该样式适用于子组件，可以在 styled-jsx 标签添加属性 global**

### 静态文件服务（如图像、样式等）

在根目录下新建文件夹叫static。代码可以通过/static/来引入相关的静态资源。  

```js
export default () => <img src="/static/my-image.png" alt="my image" />
```

**注意：不要自定义静态文件夹的名字，只能叫static ，因为只有这个名字 Next.js 才会把它当作静态资源。**

### 生成Head，做SEO优化

我们使用next.js做服务端渲染，有一大部分原因就是为了做SEO的，所以生成Head对我们来说是很有必要的。

我们在components文件夹下创建`Head`组件，具体代码如下：

```js
// Head组件

import Head from 'next/head'

export default () =>
    <div>
        <Head>
            <title>万师傅-行业领先家居服务平台|家具灯具,卫浴,窗帘等配送安装维修网</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />
            <meta http-equiv="X-UA-Compatible" content="IE=Edge,chrome=1" />
            <meta name="mobile-agent" content="format=html5;" />
            <meta name="format-detection" content="telephone=no" />
            <meta name="theme-color" content="black" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black" />
            <meta name="apple-mobile-web-app-title" content="万师傅-行业领先家居服务平台|家具灯具,卫浴,窗帘等配送安装维修网" />
            <meta name="robots" content="index,follow" />
            <meta name="keywords" content="家具拆装,家具安装配送,家具维修,卫浴安装,灯具安装维修,智能锁安装,晾衣架安装维修,窗帘安装" />
            <meta name="description" content="万师傅提供专业【智能锁】【卫浴灯具】【家具】【晾衣架】【墙纸地毯】拆装,搬运等担保交易;师傅覆盖全国;含多种家居售后服务方案,满足不同用户与企业的需求" />
            <meta name="author" content="wanshifu-better" />
            <meta name="copyright" content="深圳市小亿网络有限公司" />
            <meta name="google-site-verification" content="5dda074586814ec11ca818e715f3f8d0" />
            <meta name="360-site-verification" content="uSG4Wt-p0CWw3m75z9xAKV-LH_QEyVTe-W1el-wrjv8" />
            <link href="http://www.wanshifu.com/assets/images/favicon.ico" rel="shortcut icon" />
        </Head>
    </div>
```

在编写完`Head`组件以后，我们还需要把`Head`组件引入到我们`Header`头部组件中，具体代码如下：

```js
// Header.js

import Link from 'next/link'
import Head from '../components/Head';

const linkStyle = {
  marginRight: 15
}

const Header = () => (
    <div>
        <Head />
        <Link href="/">
          <a style={linkStyle}>Home</a>
        </Link>
        <Link href="/about">
          <a style={linkStyle}>About</a>
        </Link>
    </div>
)

export default Header
```

然后我们可以在浏览器控制台elements元素栏`head标签`中看到我们添加的各种`meta`标签了，如图：
![head标签seo](/assets/img/postCover/next_head_seo.png)

没有自定义生成`Head`,`head标签`默认只包含字符编码格式meta标签`<meta charset="utf-8" class="next-head">`，如图：
![默认head标签](/assets/img/postCover/next_head_default.png)


### 自定义<App>、<Document>、<Error>

我们可以通过，在pages文件夹下新建_app.js文件，来重写App模块，以此来控制页面初始化，具体代码如下：

```js
// _app.js

import App, {Container} from 'next/app'
import React from 'react'
import Head from '../components/Head';

export default class MyApp extends App {
    static async getInitialProps ({ Component, router, ctx }) {
        let pageProps = {}

        if (Component.getInitialProps) {
            pageProps = await Component.getInitialProps(ctx)
        }

        return {pageProps}
    }

    render () {
        const {Component, pageProps} = this.props
        return <Container>
            <Head />
            <Component {...pageProps} />
        </Container>
    }
}
```

我们把`Head`组件从`Layout`组件中移到重写的`_app.js`中，来初始化页面组件。

除了重写<App>，我们还可以重写<Document>和<Error>，具体，详见[next.js官方文档](https://nextjs.org/docs/#custom-document)或者[next.js中文文档](http://nextjs.frontendx.cn/docs/#%E8%87%AA%E5%AE%9A%E4%B9%89%3Cdocument%3E)

### 自定义配置

在next.js项目中，next为我们默认配置了不少东西，如果我们想自定义next.js的高级配置，可以在根目录下新建next.config.js文件（与pages/ 和 package.json一起）  

举个栗子，比如，我们想在项目中使用sass，具体代码如下：

```js
// next.config.js

const withSass = require('@zeit/next-sass')
module.exports = withSass({
    cssModules: false, // 是否使用css module
    // generateEtags: false, // 禁止 etag 生成
})
```

**注意：next.config.js是一个 Node.js 模块，不是一个 JSON 文件，可以用于 Next 启动服务已经构建阶段，但是不作用于浏览器端。**

### 项目部署

next.js项目部署，需要一个node服务器，我们可以选择node服务应用框架expres或者koa，本文中使用的是express。

在server.js文件中，我们通过`const dev = process.env.NODE_ENV !== 'production'`来区分开发环境还是生产环境，修改package.json文件中的scripts配置信息，如下：

```json
{
    "scripts": {
        "build": "next build",
        "dev": "NODE_ENV=dev node server.js",
        "start": "NODE_ENV=production node server.js"
    },
}
```

首先，项目打包

```git
yarn build
```

启动开发环境

```git
yarn dev
```

部署上线

```git
yarn start
```

总结：next.js部署生产环境，必须使用build命令打包构建，然后再使用start命令部署。  

参考：  
[next.js官方文档](https://nextjs.org/docs/)  
[next.js中文文档](http://nextjs.frontendx.cn/docs/#%E5%AE%89%E8%A3%85)  
[用Next.js快速上手React服务器渲染](https://segmentfault.com/p/1210000010368182/read#top)