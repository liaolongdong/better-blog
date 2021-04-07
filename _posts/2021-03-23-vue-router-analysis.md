---
layout: post
title: vue-router源码解析
subtitle: vue-router源码解析
date: 2021-03-23
categories: 技术 vue vue-router
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript vue vue-router
---

# vue-router源码解析

## 前端路由简介及实现原理

### 1. hash 模式

随着 `ajax` 的流行，异步数据请求交互运行在不刷新浏览器的情况下进行。而异步交互体验的更高级版本就是 SPA —— 单页应用。单页应用不仅仅是在页面交互是无刷新的，连页面跳转都是无刷新的，为了实现单页应用，所以就有了前端路由。

前端路由实现起来比较简单，就是匹配不同的 `url` 路径，进行解析，然后动态的渲染出区域 html 内容。但是这样存在一个问题，就是 `url` 每次变化的时候，都会造成页面的刷新。那解决问题的思路便是在改变 `url` 的情况下，保证页面的不刷新。在 `html5` 出现之前，大家是通过 `hash` 来实现路由，`url hash` 就是类似于：

```
http://www.xxx.com/#/login
```

像这种带`#`号，后面`hash`值的变化，并不会导致浏览器向服务器发出请求，浏览器不发出请求，也就不会刷新页面。另外每次 `hash` 值的变化，还会触发 `hashchange` 这个事件，通过这个事件我们就可以知道 `hash` 值发生了哪些变化。然后我们便可以通过监听 `hashchange` 来实现更新页面部分内容的操作。

### 2. history 模式

在 `HTML5` 标准发布之后，多了两个 API，`pushState` 和 `replaceState`，通过这两个 API 可以改变 url 地址且不会发送请求。同时还有 `popstate` 事件。通过这些就能用另一种方式来实现前端路由了，但原理都是跟 hash 实现相同的。用了 HTML5 的实现，单页路由的 url 就不会多出一个#，变得更加美观。但因为没有 # 号，所以当用户刷新页面之类的操作时，浏览器还是会给服务器发送请求, 如果在服务端找不到匹配的路由，就会出现404。为了避免出现这种情况，你要在服务端增加一个覆盖所有情况的候选资源：如果 URL 匹配不到任何静态资源，则应该返回同一个 `index.html` 页面，这个页面就是你 app 依赖的页面。

## vue-router功能和用法

学习使用一门技术，最快的方式就是先看官方技术文档，然后跟着写demo或者运用到实际项目中，一般技术文档里面功能点都是比较全，而且比较实用的，学习和阅读源码也不例外，如果阅读源码之前，足够熟悉对应的api，那对学习源码也能起到事半功倍的效果。  

我们可以结合某个api有什么功能，它是用来解决什么问题的以及该功能是如何实现的，为什么这样实现，如果是我，我会如何实现，带着这样的思考，来学习源码可能会更好。

想来看一下vue-router使用的基本实现，具体代码如下：

```js
import VueRouter from 'vue-router'
Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  routes: [...]
})

new Vue({
  router
  ...
})
```

[详见vue-router官方文档](https://router.vuejs.org/zh/)

## vue-router源码目录

首先我们来看一下vue-router源码目录结构，具体如下：

```markdown
|-- src  ----------------------------------- 包含主要源码
    |   |-- create-matcher.js  ------------------------- 路由映射表
    |   |-- create-route-map.js  ------------------------------- 创建路由映射状态树
    |   |-- index.js  ----------------------------  主入口文件
    |   |-- install.js  ---------------------------- 路由装载文件
    |   |-- components  --------------------------- 路由组件
    |   |   |-- link.js  ---------------- router-link组件
    |   |   |-- view.js  ---------------- router-view组件
    |   |-- history  -------------------------- 路由模式
    |   |   |-- abstract.js  ------------------------ abstract路由模式
    |   |   |-- base.js ---------------------------- history类
    |   |   |-- hash.js  ------------------------ hash路由模式
    |   |   |-- html5.js  ------------------------ HTML5History模式
    |   |-- util  ---------------------------- 工具类功能封装
    |       |-- async.js ---------------------------- 异步任务调度
    |       |-- dom.js  ---------------------------- 判断是否为浏览器环境
    |       |-- errors.js  ---------------------------- 错误处理
    |       |-- location.js  ---------------------------- 解析location
    |       |-- misc.js ---------------------------- 对象浅拷贝方法extend
    |       |-- params.js ---------------------------- 缓存params
    |       |-- path.js  ---------------------------- 解析path
    |       |-- push-state.js  ---------------------------- 判断是否支持pushState
    |       |-- query.js  ---------------------------- 解析和序列化查询参数
    |       |-- resolve-components.js  ---------------------------- 异步组件
    |       |-- route.js  ---------------------------- 创建route对象
    |       |-- scroll.js  ---------------------------- 滚动处理
    |       |-- state-key.js ---------------------------- 获取和设置state key
    |       |-- warn.js  ---------------------------- 断言错误和警告

```

## install装载函数

Vue 通过 use 方法，加载VueRouter中的 install 方法。install 完成 Vue 实例对 VueRouter 的挂载过程。下面我们来分析一下具体的执行过程：

`VueRouter`类中挂载了一个install方法，在我们引入`VueRouter`并且实例化它的时候，`VueRouter`内部帮助我们将router实例装载入vue的实例中，这样我们才可以在组件中可以直接使用`router-link`、`router-view`等组件。以及直接访问`this.$router`、`this.$route`等全局变量，这里主要归功于`install.js`帮助实现这一个过程,主要分以下几个步骤：

1. 在构造Vue实例的时候，我们会传入router对象，此时的router会被挂载到 Vue 的根组件`this.$options`选项中。在 option 上面存在 router 则代表是根组件。如果存在`this.$options`，则对`_routerRoot` 和 `_router`进行赋值操作，之后执行 `_router.init()` 方法
2. 为了让 `_router` 的变化能及时响应页面的更新，所以又接着又调用了 `Vue.util.defineReactive`方法来进行get和set的响应式数据定义
3. 然后通过`registerInstance(this, this)`这个方法来实现对`router-view`的挂载操作
4. 同时设置全局访问变量`$router`和`$route`
5. 完成`router-link`和 `router-view` 两个组件的注册

```js
// install.js
import View from './components/view'
import Link from './components/link'

export let _Vue

export function install(Vue) {
    if (install.installed && _Vue === Vue) return
    install.installed = true

    _Vue = Vue

    const isDef = v => v !== undefined
    // 实现对router-view的挂载操作
    const registerInstance = (vm, callVal) => {
        let i = vm.$options._parentVnode
        if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
            i(vm, callVal)
        }
    }

    // 混入 beforeCreate 钩子
    Vue.mixin({
        beforeCreate() {
            // 在option上面存在router则代表是根组件 
            if (isDef(this.$options.router)) {
                this._routerRoot = this
                this._router = this.$options.router
                // 执行_router实例的 init 方法
                this._router.init(this)
                // 利用vue工具库对当前路由进行数据劫持
                Vue.util.defineReactive(this, '_route', this._router.history.current)
            } else {
                // 非根组件则直接从父组件中获取
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
            }
            // 实现对router-view的挂载操作
            registerInstance(this, this)
        },
        destroyed() {
            registerInstance(this)
        }
    })
    // 设置代理，当访问 this.$router 的时候，代理到 this._routerRoot._router
    Object.defineProperty(Vue.prototype, '$router', {
        get() {
            return this._routerRoot._router
        }
    })
    // 设置代理，当访问 this.$route 的时候，代理到 this._routerRoot._route
    Object.defineProperty(Vue.prototype, '$route', {
        get() {
            return this._routerRoot._route
        }
    })
    // 全局注册 router-view 和 router-link 组件
    Vue.component('RouterView', View)
    Vue.component('RouterLink', Link)
    // Vue钩子合并策略
    const strats = Vue.config.optionMergeStrategies
    // use the same hook merging strategy for route hooks
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
```

## 从入口开始分析

我们从上面的目录结构可以看出，入口文件index.js提供了一个VueRouter类, 这个就是我们在 vue 项目中引入 vue-router 的时候所用到的new Router() 其中具体内部代码如下(为了方便阅读,省略部分代码)

```js
// index.js
export default class VueRouter {
    constructor(options: RouterOptions = {}) {
        this.app = null
        this.apps = []
        this.options = options
        this.beforeHooks = []
        this.resolveHooks = []
        this.afterHooks = []
        // 根据传入的routes参数生成路由状态表
        this.matcher = createMatcher(options.routes || [], this)
        // 默认使用hash路由模式
        let mode = options.mode || 'hash'
        this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
        if (this.fallback) {
            mode = 'hash'
        }
        // 非浏览器环境（比如node环境）使用abstract路由模式
        if (!inBrowser) {
            mode = 'abstract'
        }
        this.mode = mode

        switch (mode) {
            case 'history':
                this.history = new HTML5History(this, options.base)
                break
            case 'hash':
                this.history = new HashHistory(this, options.base, this.fallback)
                break
            case 'abstract':
                this.history = new AbstractHistory(this, options.base)
                break
            default:
                if (process.env.NODE_ENV !== 'production') {
                    assert(false, `invalid mode: ${mode}`)
                }
        }
    }
    // 初始化
    init() {}
}

// ...省略部分方法

function registerHook(list: Array < any > , fn: Function): Function {
    list.push(fn)
    return () => {
        const i = list.indexOf(fn)
        if (i > -1) list.splice(i, 1)
    }
}

function createHref(base: string, fullPath: string, mode) {
    var path = mode === 'hash' ? '#' + fullPath : fullPath
    return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install
VueRouter.version = '__VERSION__'

// ...

if (inBrowser && window.Vue) {
    window.Vue.use(VueRouter)
}
```

先来看一下`constructor`实例化的时候将会做的处理：通过`new VueRouter({...})`我们创建了一个 `VueRouter` 的实例。`VueRouter`中通过参数`mode`来指定路由模式，前面已经简单的了解了一下前端路由的2种模式。通过上面的代码，我们可以看出来 `VueRouter`对不同模式的实现大致是这样的：

- 首先根据mode来确定所选的模式，如果当前环境不支持history模式，会强制切换到hash模式；

- 如果当前环境不是浏览器环境，会切换到abstract模式下。然后再根据不同模式来生成不同的history操作对象。

入口文件代码主要做了以下几件事：

1. 初始化路由模式

2. 根据传入的routes参数生成路由状态表

3. 获取当前路由对象

4. 初始化路由函数

5. 注册Hooks等事件

6. 添加install装载函数

## 分析HashHistory和HTML5History类

### HashHistory的部分代码

部分代码如下：

```js
// 继承 History 基类
export class HashHistory extends History {
  constructor (router: VueRouter, base: ?string, fallback: boolean) {
    // 调用基类构造器
    super(router, base)

    // 如果说是从 history 模式降级来的
    // 需要做降级检查
    if (fallback && this.checkFallback()) {
      // 如果降级 且 做了降级处理 则什么也不需要做
      return
    }
    // 保证 hash 是以 / 开头
    ensureSlash()
  }
// ...
}

function checkFallback (base) {
    // 得到除去 base 的真正的 location 值
    const location = getLocation(this.base)
    if (!/^\/#/.test(location)) {
      // 如果说此时的地址不是以 /# 开头的
      // 需要做一次降级处理 降级为 hash 模式下应有的 /# 开头
      window.location.replace(
        cleanPath(this.base + '/#' + location)
      )
      return true
    }
}

// 保证 hash 以 / 开头
function ensureSlash (): boolean {
  // 得到 hash 值
  const path = getHash()
  // 如果说是以 / 开头的 直接返回即可
  if (path.charAt(0) === '/') {
    return true
  }
  // 不是的话 需要手工保证一次 替换 hash 值
  replaceHash('/' + path)
  return false
}

export function getHash (): string {
  // 因为兼容性问题 这里没有直接使用 window.location.hash
  // 因为 Firefox decode hash 值
  const href = window.location.href
  const index = href.indexOf('#')
  // 如果此时没有 # 则返回 ''
  // 否则 取得 # 后的所有内容
  return index === -1 ? '' : href.slice(index + 1)
}
```

以上代码主要做了两件事情：针对于不支持 `history api` 的降级处理，以及保证默认进入的时候对应的 `hash` 值是以 `/` 开头的，如果不是则替换。

### HTML5History

部分代码如下：

```js
export class HTML5History extends History {
  _startLocation: string

  constructor (router: Router, base: ?string) {
    super(router, base)

    this._startLocation = getLocation(this.base)
  }

  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      this.listeners.push(setupScroll())
    }

    const handleRoutingEvent = () => {
      // 当前路由对象
      const current = this.current
      console.log('current', current)

      // 避免在有的浏览器中第一次加载路由就会触发 `popstate` 事件
      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === this._startLocation) {
        return
      }
      // 执行跳转动作
      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    }
    // 监听 popstate 事件
    window.addEventListener('popstate', handleRoutingEvent)
    this.listeners.push(() => {
      window.removeEventListener('popstate', handleRoutingEvent)
    })
  }

  ensureURL (push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}
```

可以看到在这种模式下，初始化作的工作相比 hash 模式少了很多，只是调用基类构造函数以及初始化监听事件，不需要再做额外的工作

## 学习源码总结

通过学习源码，我们可以收获：

1. 学习到牛人优秀的编码风格、编码技巧以及编程思想
2. get到更多实用的新奇的api
3. 获取到很多干货，包括一些常见的面试题等等
4. 对所使用的技术能做到，知其然，知其所以然
