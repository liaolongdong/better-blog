---
layout: post
title: 浏览器缓存机制
subtitle: 浏览器缓存机制
date: 2020-04-08
categories: 原理
# cover: https://code.visualstudio.com/assets/home/home-screenshot-win-lg.png
tags: JavaScript 浏览器缓存机制
---

# 浏览器缓存机制

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
