---
layout: post
title: 浏览器缓存机制
subtitle: 浏览器缓存机制
seo_description: 浏览器缓存机制：HTTP 头的 Cache-Control（或 Expires）决定强缓存、Last-Modified 与 ETag 决定协商缓存，例如 max-age=600 就是 600 秒内复用本地缓存。
date: 2020-04-08
categories: [JavaScript]
# cover: https://code.visualstudio.com/assets/home/home-screenshot-win-lg.png
tags: JavaScript 浏览器缓存机制
tldr: '整套机制只看两组头字段，Cache-Control 或 Expires 决定要不要发请求，max-age=600 就是 600 秒内直接用本地文件；过期之后才轮到 Last-Modified 和 ETag 说话，两个同时用时满足其一就算没更新。'
faq:
  - q: 'Cache-Control 和 Expires 同时返回时以哪个为准？'
    a: 'Expires 是 HTTP 1.0 标准里的字段，Cache-Control 是 HTTP 1.1 新加的，两者功能相同、都是控制缓存的有效时间，同时出现时 Cache-Control 优先级较高。'
  - q: '强缓存过期之后，304 是靠哪两个字段谈出来的？'
    a: '看 Last-Modified 和 ETag。缓存过期后浏览器用 If-Modified-Since 把文件上次的时间带给服务器比时间戳，或用 If-None-Match 把 ETag 那个特征字串带过去做匹配：没修改就回 304 让浏览器继续用本地缓存，有修改就回 200 并同时返回最新的文件。'
  - q: 'Last-Modified 和 ETag 只用一个行不行？两个都用算什么？'
    a: '可以只用一个，也可以两个同时使用，同时使用时只要满足其中一个条件就认为文件没有更新。常见搭配是 Cache-Control 与 Last-Modified 一起、Expires 与 ETag 一起，一个控制缓存有效时间，一个在缓存失效后向服务器查询是否有更新。'
---

## 原理

根据HTTP协议头里的Cache-Control（或Expires）和Last-Modified（或Etag）等字段来控制文件缓存的机制

下面详细介绍Cache-Control、Expires、Last-Modified&Etag四个字段

Cache-Control：用于控制文件在本地缓存有效时长

如服务器回包：Cache-Control:max-age=600，则表示文件在本地应该缓存，且有效时长是600秒（从发出请求算起）。在接下来600秒内，如果有请求这个资源，浏览器不会发出 HTTP 请求，而是直接使用本地缓存的文件。

Expires：与Cache-Control功能相同，即控制缓存的有效时间

Expires是HTTP1.0标准中的字段，Cache-Control 是HTTP1.1标准中新加的字段

当这两个字段同时出现时，Cache-Control优先级较高

Last-Modified：标识文件在服务器上的最新更新时间

下次请求时，如果文件缓存过期，浏览器通过 If-Modified-Since 字段带上这个时间，发送给服务器，由服务器比较时间戳来判断文件是否有修改。如果没有修改，服务器返回304告诉浏览器继续使用缓存；如果有修改，则返回200，同时返回最新的文件。

Etag：功能同Last-Modified，即标识文件在服务器上的最新更新时间。

不同的是，Etag的取值是一个对文件进行标识的特征字串。

在向服务器查询文件是否有更新时，浏览器通过If-None-Match字段把特征字串发送给服务器，由服务器和文件最新特征字串进行匹配，来判断文件是否有更新：没有更新回包304，有更新回包200

Etag和Last-Modified可根据需求使用一个或两个同时使用。两个同时使用时，只要满足基中一个条件，就认为文件没有更新。

## 常见用法是：

Cache-Control与Last-Modified一起使用；

Expires与Etag一起使用；

即一个用于控制缓存有效时间，一个用于在缓存失效后，向服务查询是否有更新

特别注意：浏览器缓存机制 是 浏览器内核的机制，一般都是标准的实现

即Cache-Control、Last-Modified、Expires、Etag都是标准实现，你不需要操心


参考链接：[手把手教你构建 Android WebView 的缓存机制 & 资源预加载方案](https://www.jianshu.com/p/dadee1940d11)
