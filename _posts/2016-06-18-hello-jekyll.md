---
layout: post
title: 'Hello Jekyll'
seo_description: Jekyll 是什么：把装满纯文本文件的模板目录，经 Markdown 与 Liquid 渲染成静态网站和博客的轻量静态站点生成器，含内容管理与部署入门。
date: 2016-06-18
author: Jekyll
cover: '/assets/img/postCover/hello_jekyll.png'
tags: jekyll
categories: [随笔]
tldr: 'Jekyll 是个自带博客意识的静态站点生成器，模板目录里的纯文本过一道 Markdown 与 Liquid 渲染，吐出能直接发布的整站，GitHub Pages 的底层就是它。'
faq:
  - q: 'Jekyll 到底是什么？和别的静态站点生成器有什么不一样？'
    a: '原文一句话给死了，simple、blog-aware、static site generator。它读一个装满各种格式纯文本文件的模板目录，先过一道转换器（比如 Markdown），再交给 Liquid 渲染，最后输出一整套可以直接发布的静态网站，随便哪个 web server 都能服务它。'
  - q: '不买服务器、不配运维，能把 Jekyll 建的站放出去吗？'
    a: '能，这正是文里点名的用法。Jekyll 是 GitHub Pages 背后的引擎，所以项目页、博客或者整站都能直接从 GitHub 的服务器上托管出来，不花钱。'
  - q: '这份 Jekyll 指南覆盖哪几块内容？'
    a: '五块，把站点跑起来、创建与管理内容、定制站点的工作方式和外观、部署到各种环境，以及参与 Jekyll 本身开发的建议。文末那段提示说，指南里散着一些不大但管用的信息，为的是让用 Jekyll 这件事更省事、更少踩坑。'
---

> Transform your plain text into static websites and blogs.

### Welcome

This site aims to be a comprehensive guide to Jekyll. We’ll cover topics such as getting your site up and running, creating and managing your content, customizing the way your site works and looks, deploying to various environments, and give you some advice on participating in the future development of Jekyll itself.

### So what is Jekyll, exactly?Permalink

Jekyll is a simple, blog-aware, static site generator. It takes a template directory containing raw text files in various formats, runs it through a converter (like [Markdown](https://daringfireball.net/projects/markdown/)) and our [Liquid](https://github.com/Shopify/liquid/wiki) renderer, and spits out a complete, ready-to-publish static website suitable for serving with your favorite web server. Jekyll also happens to be the engine behind GitHub Pages, which means you can use Jekyll to host your project’s page, blog, or website from GitHub’s servers for free.

### Helpful HintsPermalink

Throughout this guide there are a number of small-but-handy pieces of information that can make using Jekyll easier, more interesting, and less hazardous. Here’s what to look out for.

