---
layout: post
title: '微信H5分享到微信好友、朋友圈、QQ好友、QQ空间总结以及常见问题汇总'
subtitle: '微信H5分享到微信好友、朋友圈、QQ好友、QQ空间总结以及常见问题汇总'
date: 2018-06-06
categories: 技术
cover: '/assets/img/postCover/wxshare_cover.png'
tags: JavaScript 微信H5分享 微信公众号
---

# 微信H5分享到微信好友、朋友圈、QQ好友、QQ空间总结以及常见问题汇总

微信分享官方推荐使用[微信JS-SDk](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115)，还有一种方法是使用微信浏览器特有的内置对象`WeixinJSBridge`，这种方式的分享不知道还能不能用，微信内H5支付使用这种方式也是可以的，分享功能没测试过。

微信JS-SDK是微信公众平台 面向网页开发者提供的基于微信内的网页开发工具包。

通过使用微信JS-SDK，网页开发者可借助微信高效地使用拍照、选图、语音、位置等手机系统的能力，同时可以直接使用微信分享、扫一扫、卡券、支付等微信特有的能力，为微信用户提供更优质的网页体验。

## JSSDK使用步骤

### 步骤一：绑定域名

先登录微信公众平台进入“公众号设置”的“功能设置”里填写“JS接口安全域名”。

备注：登录后可在“开发者中心”查看对应的“接口权限”。

如图：

配置“JS接口安全域名”
![JS接口安全域名配置](/assets/img/postCover/wxshare_JS_domain.png)

接口权限，有些接口公众号必须微信认证才能使用，比如分享接口、支付接口等，微信认证公众号主体必须是企业，个人不能认证
![接口权限](/assets/img/postCover/wxshare_api_permission.png)

### 步骤二：引入JS文件

在需要调用JS接口的页面引入如下JS文件，我这里引入的是1.2.0版本的，每个版本可能有区别，有些接口可能被废弃掉了，具体以[微信JS-SDK说明文档](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115)为准

### 步骤三：通过config接口注入权限验证配置

所有需要使用JS-SDK的页面必须先注入配置信息，否则将无法调用（同一个url仅需调用一次，对于变化url的SPA的web app可在每次url变化时进行调用,目前Android微信客户端不支持pushState的H5新特性，所以使用pushState来实现web app的页面会导致签名失败，此问题会在Android6.2中修复）。

```js
wx.config({
    debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    appId: '', // 必填，公众号的唯一标识
    timestamp: '', // 必填，生成签名的时间戳
    nonceStr: '', // 必填，生成签名的随机串
    signature: '',// 必填，签名
    jsApiList: [] // 必填，需要使用的JS接口列表
});
```

### 步骤四：通过ready接口处理成功验证

```js
wx.ready(function(){
    // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
});
```

页面初始化时就调用微信分享相关接口，具体代码如下：

```js
// data为后台接口请求返回的微信分享配置信息
wx.config({
    debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。移动端会通过弹窗来提示相关信息。如果分享信息配置不正确的话，可以开了看对应报错信息
    appId: data.appid,
    timestamp: data.timestamp,
    nonceStr: data.noncestr,
    signature: data.signature,
    jsApiList: [ // 需要使用的JS接口列表,分享默认这几个，如果有其他的功能比如图片上传之类的，需要添加对应api进来
        'checkJsApi', // 判断当前客户端版本是否支持指定JS接口
        'onMenuShareTimeline', // 分享到朋友圈
        'onMenuShareAppMessage', // 分享给好友
        'onMenuShareQQ', // 分享给手机QQ好友
        'onMenuShareWeibo' // 分享到微博
    ]
});
const shareConfig = {
    share: {
        title: '', // 分享标题
        desc: '', // 分享描述
        link: '', // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
        imgUrl: '', // 分享图标
        type: '', // 分享类型,music、video或link，不填默认为link
        dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
        success: function () { // 用户确认分享后执行的回调函数
            console.warn(arguments);
        },
        cancel: function () { // 用户取消分享后执行的回调函数
            console.warn(arguments);
        }
    }
};
wx.ready(function () {
    // 分享到朋友圈
    wx.onMenuShareTimeline(shareConfig.share);
    // 分享给好友
    wx.onMenuShareAppMessage(shareConfig.share);
    // 分享给手机QQ
    wx.onMenuShareQQ(shareConfig.share);
    // 分享到微博
    wx.onMenuShareWeibo(shareConfig.share);
});
```

## 微信JS-SDK常见错误及解决方法

微信JS-SDk常见的错误有：

- `invalid url domain`当前页面所在域名与使用的appid没有绑定
- `invalid signature`签名错误
- `the permission value is offline verifying`, 具体解决方案详见[微信JS-SDK常见错误及解决方法](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115)

![常见错误及解决方法](/assets/img/postCover/wxshare_normal_error.png)

> 绑定父级域名，是否其子域名也是可用的（是的，合法的子域名在绑定父域名之后是完全支持的）  
> 注意：在测试环境测试时必须关注公众号绑定的接口测试号，微信没有关注测试号不能正常分享