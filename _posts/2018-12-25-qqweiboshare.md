---
layout: post
title: 使用原生JS实现QQ好友、QQ空间、新浪微博、腾讯微博分享功能
subtitle: 使用原生JS实现QQ好友、QQ空间、新浪微博、腾讯微博分享功能
seo_short_title: 原生 JS 实现 QQ 与微博分享功能
seo_description: 不引任何 SDK，用原生 JS 拼出 QQ 好友、QQ 空间、新浪微博与腾讯微博的分享链接，各站的参数命名差异与回调返回码逐条列出。
date: 2018-12-25
categories: [H5与微信]
cover: '/assets/img/postCover/share_cover.png'
tags: H5分享
tldr: '四个分享口子全是拼链接开新窗口，不引 SDK；图片参数新浪和腾讯微博收 pic，QQ 好友和 QQ 空间收 pics，QQ 空间的标题填在 summary 里，缩略图不能用本地图，七牛 CDN 的图不显示。'
faq:
  - q: '同一份分享参数发给四个站点，图片的参数名是一样的吗？'
    a: '不一样，这是最容易写错的一处。新浪微博 v.t.sina.com.cn/share/share.php 和腾讯微博 v.t.qq.com/share/share.php 收的是 pic，QQ 好友的 connect.qq.com/widget/shareqq/index.html 和 QQ 空间那个 cgi 收的是 pics。拼进链接之前每个值都要先 encodeURIComponent 一遍，标题缺省取页面自身的 title，链接缺省取当前页地址。'
  - q: '分享到 QQ 空间的函数为什么比其余三个多收一个参数？'
    a: "因为只有它带分享描述：sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey 这条链接里 summary 装的其实是标题，desc 装的才是描述，后面再跟 url 和 pics。其余三个站点的函数只收标题、链接、图片三项，描述传不进去。"
  - q: '分享出去的缩略图为什么不显示？'
    a: '两条：一是不能用本地的图片，必须给能访问到的图片链接地址；二是还有一个说不清原因的坑，七牛 CDN 上的图片同样不显示，为此被坑了很久。代码注释里还写明图片是可选参数，多张之间用竖线隔开。'
---

[点这里查看demo效果]({{ site.baseurl }}/demo/shareDemo/myshare.html)

在分享功能中我们通常用的最多的几个配置参数：分享的标题、分享的内容链接地址、分享描述信息以及分享的缩略图地址，具体实现代码如下：

```js
function (window, document) {
    var shareMethodObj = {
        //分享到腾讯微博
        sharetotencentweibo: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var shareqqstring = 
                'http://v.t.qq.com/share/share.php?title=' + title 
                + '&url=' + url 
                + '&pic=' + picurl;
            // 在新窗口中打开
            window.open(shareqqstring, '_blank');
        },
        //分享到新浪微博
        sharetosina: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var sharesinastring =
                'http://v.t.sina.com.cn/share/share.php?title=' + title 
                + '&url=' + url 
                + '&content=utf-8&sourceUrl=' + url 
                + '&pic=' + picurl;
            // 在新窗口中打开
            window.open(sharesinastring, '_blank');
        },
        // 分享到QQ好友
        sharetoqq: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var shareqqzonestring = 
                'http://connect.qq.com/widget/shareqq/index.html?title=' + title 
                + '&url=' + url 
                + '&pics=' + picurl;
            // 在新窗口中打开
            window.open(shareqqzonestring, '_blank');
        },
        //分享到QQ空间
        sharetoqqzone: function (title, url, picurl, content) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            // 分享描述
            content = encodeURIComponent(content || '');
            var shareqqzonestring = 
                'http://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?summary=' + title 
                + '&desc=' + content
                + '&url=' + url 
                + '&pics=' + picurl;
            // 在新窗口中打开
            window.open(shareqqzonestring, '_blank');
        }
    }
    window.shareMethodObj = shareMethodObj;
})(window, document);
```

用法具体代码如下：

```js
// 分享配置参数
var shareConfig = {
    shareTitle: '分享设置的标题',
    shareImage: '分享设置的缩略图链接地址',
    shareContent: '分享描述信息',
    shareUrl: '分享页面的链接地址'
}

// 分享到新浪微博
shareMethodObj.sharetosina(shareConfig.shareTitle, shareConfig.shareUrl, shareConfig.shareImage);

// 分享到QQ好友
shareMethodObj.sharetoqq(shareConfig.shareTitle, shareConfig.shareUrl, shareConfig.shareImage);

// 分享到QQ空间
shareMethodObj.sharetoqqzone(shareConfig.shareTitle, shareConfig.shareUrl, shareConfig.shareImage, shareConfig.shareContent);
```

**注意：分享的缩略图不显示问题：不能使用本地的图片，必须使用图片链接地址，还遇到一个特别坑的点是，不能使用七牛cdn的图片，不知道是什么鬼，被坑了好久，我屮艸芔茻**
