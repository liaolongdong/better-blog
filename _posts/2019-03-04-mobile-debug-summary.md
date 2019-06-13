---
layout: post
title: 移动端调试技巧总结
subtitle: 移动端调试技巧总结
date: 2019-03-04
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: 移动端调试技巧
---

# 移动端调试技巧总结

## 前言

工欲善其事，必先利其器。熟练掌握前端调试技巧能极大的提高我们开发的工作效率。

### 移动端和PC端开发的区别

#### PC端

做过移动端和PC端的前端开发都知道，PC端调试代码比较简单，使用Chrome谷歌浏览器自带的开发者工具就能调试程序代码，能看到样式、请求、性能（加载时间）、资源、本地存储等等。

#### 移动端

1. PC浏览器展示的效果可能和手机展示的效果不一致
2. ios和android手机兼容问题
3. 有些功能必须在手机上才能测试，比微信分享和微信支付等等

这些都是无法直接使用PC浏览器就能调试的，因此，开发移动端，必须要熟练掌握移动端的调试技巧，来提升我们的工作效率。

## 移动端调试技巧

### H5移动端通用调试技巧

#### 使用vconsole

[vConsole](https://github.com/Tencent/vConsole/blob/HEAD/README_CN.md) 使用腾讯开源的vconsole调试

```html
<script src="path/to/vconsole.min.js"></script>
<script>
  // 初始化
  var vConsole = new VConsole();
  console.log('Hello world');
</script>
```

[点击查看更多使用教程](https://github.com/Tencent/vConsole/blob/3ea372a308781689b3e09e73e2c57a80eba96801/doc/tutorial_CN.md)

#### 使用抓包工具，抓取手机访问页面请求

- [fiddler抓包工具总结](https://www.cnblogs.com/yyhh/p/5140852.html)
- [whistle是基于Node实现的跨平台抓包调试代理工具](https://github.com/avwo/whistle/blob/master/README-zh_CN.md)

### ios(苹果手机)调试技巧

ios使用Safari浏览器进行调试

1. 使用数据线把苹果手机和苹果电脑连接起来
2. 在苹果手机上使用Safari浏览器打开需要调试的网页
3. 打开苹果电脑中的Safari浏览器
4. 点击Safari浏览器 -> 开发 -> Mac name -> 调试页面地址
5. 调试和电脑端基本没有差异，电脑端修改样式等，手机立马变化

如图：
![h5_ios_debug](/assets/img/postCover/h5_ios_debug.png)
![h5_ios_mobile](/assets/img/postCover/h5_ios_mobile.png)

### android(安卓手机)调试技巧

安卓手机使用Chrome浏览器进行调试

1. 使用数据线把安卓手机和电脑连接起来
2. 打开手机的usb调试功能
3. 在电脑上打开Chrome浏览器
4. 电脑chrome地址栏输入`chrome://inspect`进入后点击`inspect`即进入调试模式（注意：第一次调试必须翻墙）
5. 在安卓手机chrome浏览器上打开需要调试的网页
6. 调试和电脑端基本没有差异，电脑端修改样式等，手机立马变化

### 微信相关调试技巧

使用微信开发者工具

微信公众号开发

[微信web开发者工具](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1455784140)

小程序开发

[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

使用微信开发者工具能调试微信相关功能，比如使用微信js-sdk时，测试`wx.config`配置是否正确等

如图：
![h5_wx_public](/assets/img/postCover/h5_wx_public.png)
![h5_mini_program](/assets/img/postCover/h5_mini_program.png)

### 安卓手机微信清理缓存

使用安卓手机微信浏览器打开`debugx5.qq.com`选择要清除的缓存内容

## 在手机上访问自己电脑启动本地服务的H5页面调试技巧（测试手机浏览器兼容问题必须掌握的高效调试技巧）

### 操作步骤

第一步：手机和电脑连接相同的wifi环境

第二步：把访问页面的本地localhost地址换成本地电脑IP地址（注意这个IP地址必须是电脑无线网络连接的IP地址），查看是否能正常访问

第三步：如果不能正常访问，把 webpack devServer 里面有个配置host 改成0.0.0.0

第四步：在手机上使用电脑无线网络连接的IP地址和端口，访问页面  

如图：  
![mobile_debug_phone_demo](/assets/img/postCover/mobile_debug_phone_demo.jpg)
![mobile_debug_pc_ip](/assets/img/postCover/mobile_debug_pc_ip.jpg)
![mobile_debug_address](/assets/img/postCover/mobile_debug_address.jpg)

### 常见问题

在手机上打不开自己本地启动服务的页面

1. 查看wifi是否连接正确，手机和电脑访问的wifi环境必须相同
2. 为什么使用本地IP地址打不开自己电脑的网页 用localhost却可以 -> 解决方案：webpack devServer 里面有个配置host 改成0.0.0.0
3. 查看访问的IP地址是否为电脑无线网络连接的IP地址
