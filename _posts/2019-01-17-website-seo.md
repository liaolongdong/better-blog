---
layout: post
title: 网站seo优化
subtitle: 网站seo优化
date: 2019-01-17
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

添加站点的目的是让搜索引擎主动收录站点

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

链接提交

> 1、链接提交工具是网站主动向百度搜索推送数据的工具，本工具可缩短爬虫发现网站链接时间，网站时效性内容建议使用链接提交工具，实时向搜索推送数据。本工具可加快爬虫抓取速度，无法解决网站内容是否收录问题  
> 2、百度搜索资源平台为站长提供链接提交通道，您可以提交想被百度收录的链接，百度搜索引擎会按照标准处理，但不保证一定能够收录您提交的链接。

自动推送

> 1、自动推送是百度搜索资源平台为提高站点新增网页发现速度推出的工具，安装自动推送JS代码的网页，在页面被访问时，页面URL将立即被推送给百度。  
> 2、JS链接推送代码以网页为最小对象，服务于全平台多终端，PC站和移动站均可使用。  
> 3、安装代码的页面在任意平台（浏览器、微信、微博）被加载时，页面链接会被第一时间推送给百度，从而提高站点新内容的发现速度。  

```html
<script>
    (function(){
        var bp = document.createElement('script');
        var curProtocol = window.location.protocol.split(':')[0];
        if (curProtocol === 'https') {
            bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
        }
        else {
            bp.src = 'http://push.zhanzhang.baidu.com/push.js';
        }
        var s = document.getElementsByTagName("script")[0];
        s.parentNode.insertBefore(bp, s);
    })();
</script>
```

具体步骤如图所示：

![链接提交](/assets/img/postCover/seo_link_submit.png)
![自动提交-自动推送](/assets/img/postCover/seo_link_auto.png)

### 3、使用sitemap（站点地图）

> 站点地图对于SEO非常重要，在网站中加入sitemap有利于搜索引擎蜘蛛的抓取和收录。

1. 生成sitemap文件，可通过[网站地图爬虫在线工具](http://help.bj.cn/)生成
2. 在网站的根目录添加sitemap.xml文件
3. 在百度站长工具提交文件地址

具体步骤如图：

![sitemap在线生成工具](/assets/img/postCover/seo_sitemap_tool.png)
![sitemap文件格式](/assets/img/postCover/seo_sitemap_xml.png)
![sitemap文件提交](/assets/img/postCover/seo_sitemap_submit.png)
![sitemap文件提交成功](/assets/img/postCover/seo_sitemap_finish.png)

检测sitemap文件是否生效，如图所示：
![检测sitemap文件是否生效](/assets/img/postCover/seo_sitemap_status.png)

## 检测某搜索引擎是否收录站点

检测`http://liaolongdong.com/`域名是否被搜索引擎收录，在引擎中输入`site:liaolongdong.com`，检测网站是否收录成功

搜索引擎收录成功，如图所示：

![百度收录](/assets/img/postCover/seo_baidu_site.png)
![谷歌收录](/assets/img/postCover/seo_google_site.png)
![必应收录](/assets/img/postCover/seo_bing_site.png)

搜索引擎没有收录成功，如图所示：

![搜狗收录](/assets/img/postCover/seo_sougou_site.png)

### google搜索引擎资源收录效果

如下图所示：

![google效果](/assets/img/postCover/seo_google_effect.png)
![google站点地图](/assets/img/postCover/seo_google_sitemap.png)

**注意：国内的域名站点必须通过网站备案**

## 各大网站搜索资源平台站长地址

- [百度](https://ziyuan.baidu.com/)
- [google](https://search.google.com/search-console) （注：google国内要翻墙才能正常访问）
- [360](http://zhanzhang.so.com/)
- [搜狗](http://zhanzhang.sogou.com/index.php/site/index)

**总结：让自己网站搜索排名靠前最快的方式当然是花钱参与竞价排名，除了上面介绍的几种方式之外，让自己的网站增加搜索量、点击量、网站频繁更新也能让网站搜索排名靠前，所以没事的时候就多点点自己的网站，O(∩_∩)O哈哈~**