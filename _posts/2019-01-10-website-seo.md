---
layout: post
title: 网站seo优化
subtitle: 网站seo优化
date: 2019-01-10
categories: 技术 seo
cover: /assets/img/postCover/seo_cover.png
tags: 网站seo seo优化 搜索引擎网站收录
---

# 网站seo优化、搜索引擎网站收录

## 网站页面标签seo

- 网站标题、网站关键字、网站描述
- 网站页面标签语义化，如标题`h1~h6`标签、段落`p`标签、头部`header`标签、底部`footer`标签等等
- 网页页面层级结构清晰

具体代码如下：

```html
<head>
    <meta name="robots" content="index,follow" />
    <meta name="keywords" content="网站关键字" />
    <meta name="description" content="网站描述" />
    <meta name="author" content="better" />
    <meta name="copyright" content="版权" />
    <meta name="baidu-site-verification" content="百度搜索网站收录生成码" />
    <meta name="google-site-verification" content="谷歌搜索网站收录生成码" />
    <meta name="360-site-verification" content="360搜索网站收录生成码" />
</head>
```

## 主动让各种搜索引擎网站收录

- 去各大搜索引擎资源平台（站长平台）”添加网站“，”验证站点“，让搜索引擎主动收录
- 搜索资源平台 ”链接提交“，自动推送
- 使用sitemap（站点地图）

具体代码如下：

```html
<head>
    <meta name="robots" content="index,follow" />
    <meta name="keywords" content="网站关键字" />
    <meta name="description" content="网站描述" />
    <meta name="author" content="better" />
    <meta name="copyright" content="版权" />
    <meta name="baidu-site-verification" content="百度搜索网站收录生成码" />
    <meta name="google-site-verification" content="谷歌搜索网站收录生成码" />
    <meta name="360-site-verification" content="360搜索网站收录生成码" />
</head>
```

### 1、添加站点

![站点管理-添加网站](/assets/img/postCover/seo_add_site.png)

这里我以百度搜索资源平台为例，其它搜索引擎站长平台也大同小异，具体步骤如下：

- 第一步：输入网站，区分http和https
- 第二步：站点属性，最多设置3个属性
- 第三步：验证站点，验证站点有三种方式：文件验证、HTML标签验证、CNAME验证，选择其中一种即可，我这里选择的是”HTML标签验证“方式

![输入网站](/assets/img/postCover/seo_add_site_step1.png)
![站点属性](/assets/img/postCover/seo_add_site_step2.png)
![验证站点](/assets/img/postCover/seo_add_site_step3.png)

**注意：验证站点，添加完meta标签以后，必须发布到线上环境，才能验证通过**

### 2、链接提交，自动推送

具体步骤如图所示：

![链接提交](/assets/img/postCover/seo_link_submit.png)
![自动提交-自动推送](/assets/img/postCover/seo_link_auto.png)

### 3、使用sitemap（站点地图）

1. 生成sitemap文件，可通过[网站地图爬虫在线工具](http://help.bj.cn/)生成
2. 在网站的根目录添加sitemap.xml文件
3. 在百度站长工具提交文件地址

具体步骤如图：

![sitemap在线生成工具](/assets/img/postCover/seo_sitemap_tool.png)
![sitemap文件格式](/assets/img/postCover/seo_sitemap_xml.png)
![sitemap文件提交](/assets/img/postCover/seo_sitemap_submit.png)
![sitemap文件提交成功](/assets/img/postCover/seo_sitemap_finish.png)

## 检测某搜索引擎是否收录站点

检测`http://liaolongdong.com/`域名是否被搜索引擎收录，在引擎中输入`site:liaolongdong.com`，检测网站是否收录成功

搜索引擎收录成功，如图所示：

![百度收录](/assets/img/postCover/seo_baidu_site.png)
![必应收录](/assets/img/postCover/seo_bing_site.png)

搜索引擎没有收录成功，如图所示：

![搜狗收录](/assets/img/postCover/seo_sougou_site.png)

**注意：国内的域名站点必须通过网站备案**

## 各大网站搜索资源平台地址

- [百度](https://ziyuan.baidu.com/)
- [搜狗](http://zhanzhang.sogou.com/index.php/site/index)
- [360](http://zhanzhang.so.com/)
- [google](http://zhanzhang.so.com/)