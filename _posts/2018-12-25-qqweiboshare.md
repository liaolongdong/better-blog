---
layout: post
title: 使用原生JS实现QQ好友、QQ空间、新浪微博、腾讯微博分享功能
subtitle: JS实现QQ好友、QQ空间、新浪微博、腾讯微博分享功能
date: 2018-12-25
categories: QQ好友、QQ空间、新浪微博、腾讯微博分享功能
cover: '/assets/img/postCover/share_cover.png'
tags: 分享
---

# JS实现QQ好友、QQ空间、新浪微博、腾讯微博分享功能

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

**这个分享有一个问题，QQ空间、新浪微博分享的缩略图显示不出来，分享到QQ好友却正常，尝试过使用和域名相同的协议http或者https图片链接还是显示不出来，但是在我Mac电脑浏览器上访问一下缩略图的链接，再刷新一下分享页面，缩略图又能正常显示了，不知道是什么原因，有知道原因的大佬可以评论指教一下，感激不尽**
