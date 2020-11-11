---
layout: post
title: H5实现打开导航地图app并自动导航到目的地
subtitle: H5实现打开导航地图app并自动导航到目的地
date: 2020-10-20
categories: 技术 前端小技巧 地图导航
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript vue H5打开地图导航app
---

# H5实现打开导航地图app并自动导航到目的地

## 背景

公司项目需求，要实现一个H5页面打高德地图、百度地图、腾讯地图并自动进行导航到目的地的功能，在项目上线以后，抽时间做一下总结记录一下，同事也希望能帮到有这方面需求的同学

## 技术实现

由于我们前端JS无法判断用户手机是否有安装某个地图导航app，所以只列出一些大家经常用到的地图导航app，这里只列出高德地图、百度地图、腾讯地图app,所以增加了一句“如果点击无响应，可能是您还没有安装该APP”提示文案。

### 具体实现源码

这里为了快速开发出demo，使用`script`标签的方式引入vue并使用vue进行开发

直接通过`script`标签的方式引入vue需要注意一下几个点：

- 确保引入正确的vue版本，[具体参考直接用 <script> 引入](https://cn.vuejs.org/v2/guide/installation.html#%E7%9B%B4%E6%8E%A5%E7%94%A8-lt-script-gt-%E5%BC%95%E5%85%A5)
- 在使用vue组件的时候，html代码里面的组件引入名称必须使用 kebab-case 命名方式, [具体参考vue组件名](https://cn.vuejs.org/v2/guide/components-registration.html#%E7%BB%84%E4%BB%B6%E5%90%8D)
  > 当使用 PascalCase (首字母大写命名) 定义一个组件时，你在引用这个自定义元素时两种命名法都可以使用。也就是说 <my-component-name> 和 <MyComponentName> 都是可接受的。注意，尽管如此，直接在 DOM (即非字符串的模板) 中使用时只有 kebab-case 是有效的。
- 组件传参props的属性名称也必须使用 kebab-case 命名方式，[具体参考Prop 的大小写 (camelCase vs kebab-case)](https://cn.vuejs.org/v2/guide/components-props.html#Prop-%E7%9A%84%E5%A4%A7%E5%B0%8F%E5%86%99-camelCase-vs-kebab-case)


## demo效果地址

- [H5实现打开导航地图app并自动导航到目的地](https://liaolongdong.com/demo/openMapDemo/index.html)


