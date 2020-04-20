---
layout: post
title: '总结前端工作当中遇到的那些坑'
subtitle: '总结前端工作当中遇到的那些坑'
date: 2018-03-26
categories: 技术
cover: 'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1542003988331&di=8f1eeb3781533c2844e60331b1a55e60&imgtype=0&src=http%3A%2F%2Fpic2.zhimg.com%2Fv2-e2b6fb372ba7f9c8375aa73e5cbe49a8_b.jpg'
tags: JavaScript 前端工作总结 移动端的那些坑
---

# 总结前端工作当中遇到的那些坑

## 微信相关类

### 微信公众号使用js-sdk开发常见问题及解决方案

- [微信公众号使用js-sdk开发常见问题及解决方案](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115)

### 微信公众号使用js-sdk接口调用频次限制说明

- [微信公众号使用js-sdk接口调用频次限制说明](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1433744592)

### 获取openid

- [获取openid](https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=4_4)

### 微信内H5调起支付

- [微信内H5调起支付](https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=7_7&index=6)

## 事件相关类

### 移动端点击穿透问题

- [移动端大坑之点击穿透](https://blog.csdn.net/kao5585682/article/details/69529430 "移动端大坑之点击穿透")
- [点击穿透原理及解决](https://blog.csdn.net/qq_17746623/article/details/55805425 "点击穿透原理及解决")

### 图片加载出现403错误

原因：在http中请求https图片可能会出现403错误  

解决方案：在`html`的`head`标签中加入`<meta name="referrer" content="no-referrer" />`

### 阻止浏览器当前页面回退操作

```javascript
window.history.pushState('forward', null, window.location.href); // 首先在当前页面创建一个新的history实体
window.addEventListener('popstate', () => { // 监听状态变化
    window.history.forward(1); // 跳转到下一个history
});
```

### onload事件只能绑定在window上，绑定到document上不生效

在开发时遇到一个问题：使用document绑定onload事件没有生效，具体代码如下：

```js
// onload事件绑定在document上没有生效
document.addEventListener('load', function () {
    console.log(111);
});

// onload事件绑定在window上才生效
window.addEventListener('load', function () {
    console.log(222);
});
```

### 解决键盘弹出后挡住表单的问题

```js
// 解决键盘弹出后挡表单的问题
window.addEventListener('resize', function () {
    if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
    ) {
        window.setTimeout(function () {
            if ('scrollIntoView' in document.activeElement) {
                document.activeElement.scrollIntoView();
            } else {
                document.activeElement.scrollIntoViewIfNeeded();
            }
        }, 0);
    }
});
```

### React中使用defaultValue、defaultChecked遇到的问题

> The defaultValue and defaultChecked props are only used during initial render. If you need to update the value in a subsequent render, you will need to use a controlled component.
所以如果有值是会变的 只能用value/checked。 不能用defaultValue/defaultChecked

### 前端页面弹窗禁止遮罩底部页面滚动(移动端兼容ios问题)

```js
// 判断设备类型
function whatDevice () {
    let device = '';
    let ua = window.navigator.userAgent.toLowerCase();
    if (/MicroMessenger/i.test(ua)) {
        device = 'wx';
    } else if (/(iPhone|iPad|iPod|iOS)/i.test(ua)) {
        device = 'ios';
    } else if (/(Android)/i.test(ua)) {
        device = 'android';
    }
    return device;
}

// 禁止遮罩底部页面滚动, fixed 固定， scroll 滚动
function fixScroll (type) {
    var device = whatDevice();
    if (device === 'android') {
        if (type === 'fixed') {
            // 会引起页面重绘
            var scrollTop = document.documentElement.scrollTop + document.body.scrollTop;
            window.localStorage.setItem('scroll', JSON.stringify({
                originHtmlScrollY: document.getElementsByTagName('html')[0].style.overflowY,
                originHtmlPosition: document.getElementsByTagName('html')[0].style.position,
                scrollTop: document.documentElement.scrollTop + document.body.scrollTop
            }));
            document.getElementsByTagName('html')[0].style.overflowY = 'hidden';
            document.getElementsByTagName('html')[0].style.position = 'fixed';
            document.getElementsByTagName('html')[0].style.top = '-' + scrollTop + 'px';
        } else if (type === 'scroll') {
            var originHtmlScroll = JSON.parse(window.localStorage.getItem('scroll')) || {
                originHtmlScrollY: '',
                originHtmlPosition: '',
                scrollTop: 0
            };
            window.localStorage.removeItem('scroll');
            document.getElementsByTagName('html')[0].style.overflowY = originHtmlScroll.originHtmlScrollY;
            document.getElementsByTagName('html')[0].style.position = originHtmlScroll.originHtmlPosition;
            window.scrollTo(0, originHtmlScroll.scrollTop);
        }
    } else {
        // 兼容ios弹窗遮罩层底部页面禁止滑动处理(还是有问题啊，滑动弹窗遮罩层底部页面还是会滚动)
        if (type === 'fixed') {
            // 获取遮罩层页面node节点
            var maskNode = document.getElementsByClassName('mask');
            maskNode && maskNode[0] && maskNode[0].addEventListener('touchstart', function (e) {
                e.stopPropagation();
                e.preventDefault();
            });
        }
    }
}
```

- [前端页面弹框遮罩禁止页面滚动](https://blog.csdn.net/yuhk231/article/details/74171734?utm_source=blogxgwz0)

### 禁止页面复制、选中文本以及用户右击鼠标时触发并打开上下文菜单

使用样式`user-select`属性

```css
body {
  -webkit-touch-callout: none; /*系统默认菜单被禁用*/
  -webkit-user-select: none; /*webkit浏览器*/
  -khtml-user-select: none; /*早起浏览器*/
  -moz-user-select: none; /*火狐浏览器*/
  -ms-user-select: none; /*IE浏览器*/
  user-select: none; /*用户是否能够选中文本*/
}
```

此段css样式加入后能解决ios下手机浏览器,微信浏览器长按出现选择系统菜单问题,但是对于Android下微信浏览器还会出现不兼容问题,因此还需要在页面中加入以下JS代码

```js
// 阻止用户右击鼠标时触发并打开上下文菜单
document.oncontextmenu = function(e) {
    e.preventDefault();
};
```
`oncontextmenu`事件在元素中用户右击鼠标时触发并打开上下文菜单，此处用于阻止菜单的出现。

### 上传图片格式转换(react)

```html
<input className='photo-upload-tip'
        type='file'
        ref={(input) => { this.fileInput = input; }}
        onChange={this.handleUploaderImgChangeTest} />
```

```javascript
// base64格式转成blob格式
function dataURItoBlob (dataURI) {
    let byteString = window.atob(dataURI.split(',')[1]);
    let mimeString = dataURI.split(',')[0].split(':')[1].split('')[0];
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    console.log('blob', new Blob([ab], {type: mimeString}));
    return new Blob([ab], {type: mimeString});
}

// 把base64格式转成formData格式
function base64toFormData (imageBase64) {
    let blob = dataURItoBlob(imageBase64);
    // let canvas = document.createElement('canvas');
    // let dataURL = canvas.toDataURL('image/png', 0.5);
    let fd = new FormData();
    fd.append('file', blob);
    return fd;
}

handleUploaderImgChangeTest = () => {
    let formData = new FormData();
    formData.append('file', this.fileInput.files[0]);
    fetch('http://dev-wxuser-api.wanshifu.com/common/upload/uploadimage', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
        },
        credentials: 'include',
        body: formData,
    }).then((res) => {
        console.log('success', res.status);
    }).catch((e) => {
        console.log('error', e);
    });
 }
```

## 兼容相关类

### 移动端动态节点绑定事件ios点击失效

原因是:

- 在ios系统中,例如document,div,body这些本身并没有可以被点击的属性的元素不能作为托管点击事件的父元素。所以,用这样的方法进行事件托管，ios会获取不到你的document的点击事件，自然无法获取到你想要绑定的元素身上。
- 解决办法就是把document换成你想要绑定元素的父元素上可以是最大的那个div，然后在最大元素的样式中加入cursor:pointer; 这个属性可以让父元素变成拥有可被点击属性的盒子，这样就可以解决动态数据无法绑定事件的问题。

参考博客：

- [利用js实现 禁用浏览器后退](https://blog.csdn.net/zc474235918/article/details/53138553)
- [用（SPA）前端javascript如何阻止按下返回键页面回退](https://blog.csdn.net/cjd6568358/article/details/70077935)
- [防止页面后退（使浏览器后退按钮失效）](https://www.cnblogs.com/webzwf/p/5714385.html)
- [移动端动态节点绑定事件ios点击失效](https://blog.csdn.net/lunhui1994_/article/details/73801411)

### 在移动端中使用css3部分动画时可能会出现加载页面宽度抖动问题以及ios9滚动条区域空白处理

解决方案：在html顶级div中加入样式`overflow-x: hidden;`

### 移动端手机浏览器滑动页面不流畅

[-webkit-overflow-scrolling](https://developer.mozilla.org/zh-CN/docs/Web/CSS/-webkit-overflow-scrolling)属性控制元素在移动设备上是否使用滚动回弹效果.

解决方案：在页面`body`标签，增加样式`-webkit-overflow-scrolling: touch;`

```css
body {
    -webkit-overflow-scrolling: touch;
    overflow-scrolling: touch;
}
```

### ios点击事件出现灰色背景闪烁解决方案

[-webkit-tap-highlight-color](https://developer.mozilla.org/zh-CN/docs/Web/CSS/-webkit-tap-highlight-color)是一个没有标准化的属性，能够设置点击链接的时候出现的高亮颜色。显示给用户的高光是他们成功点击的标识，以及暗示了他们点击的元素。

解决方案：在页面`body`标签，增加样式`-webkit-tap-highlight-color: transparent;`

```css
body {
    /* 防止iOS的Safari浏览器点击出现灰色背景闪烁 */
    -webkit-tap-highlight-color: transparent;
}
```

### 优化移动端点击300ms延时

[touch-action](https://developer.mozilla.org/zh-CN/docs/Web/CSS/touch-action)也经常用于完全解决由支持双击缩放手势引起的点击事件的延迟。

```css
html {
  touch-action: manipulation;
}
```

### 部分安卓手机点击img图片会全屏放大显示问题（变成全屏查看图片模式了）

[pointer-events](https://developer.mozilla.org/zh-CN/docs/Web/CSS/pointer-events)值none表示鼠标事件"穿透"该元素并且指定该元素"下面"的任何东西。

解决方案：在`img`标签上设置`pointer-events: none;`样式来屏蔽图片上所有的事件，如果在图片上有绑定事件，则在图片上增加一层div，把事件绑定到该div上

### 部分安卓手机自带浏览器，行高line-height设置px值不生效

问题：部分安卓手机自带浏览器，行高line-height设置px不生效

解决方案：把px值设置为数值，如`line-height: 1.5`

### ios内嵌h5页面点击form表单input获取焦点以后页面会放大问题

解决方案：

1、在html页面head标签加入

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=0">
```

2、把input字体设置16px以上

### 微信H5页面ios遮罩弹出框input调用键盘收起键盘后底部出现空白、定位样式错位、关闭键盘input输入框获取不到焦点等问题解决方案

如图：

![ios遮罩弹出框input调用键盘样式问题](/assets/img/postCover/ios_input_mask.jpg)

解决方案：在input输入框失去焦点的时候触发一下底部页面的滚动事件

```js
inputBlur() {
    let ua = window.navigator.userAgent.toLowerCase();
    if (/(iPhone|iPad|iPod|iOS)/i.test(ua)) {
        window.scrollTo(0, 0);
    }
}
```

最佳解决方案：`focus`和`blur`不支持事件冒泡，利用`focusin`和`focusout`支持事件冒泡

```js
// 判断设备类型
function getDevice () {
    let device = '';
    if (/(iPhone|iPad|iPod|iOS)/i.test(ua)) {
        device = 'ios';
    } else if (/(Android)/i.test(ua)) {
        device = 'android';
    }
    return device;
}

let isReset = true; // 弹出键盘是否归位
if (getDevice() === 'ios') {
    document.body.addEventListener('focusin', () => {
        // 软键盘弹出的事件处理
        isReset = false;
    });
    document.body.addEventListener('focusout', () => {
        // 软键盘收起的事件处理
        isReset = true;
        setTimeout(() => {
            // 当焦点在弹出层的输入框之间切换时先不归位
            if (isReset) {
                window.scroll(0, 0); // 失焦后强制让页面归位
            }
        }, 300);
    });
} else if (getDevice() === 'android') {
    window.onresize = function () {
        // 键盘弹起与隐藏都会引起窗口的高度发生变化
        let resizeHeight = document.documentElement.clientHeight || document.body.clientHeight;
        if (resizeHeight < h) {
            // 当软键盘弹起，在此处操作
            isReset = false;
        } else {
            // 当软键盘收起，在此处操作
            isReset = true;
            setTimeout(() => {
                if (isReset) {
                    window.scroll(0, 0); // 失焦后强制让页面归位
                }
            }, 300);
        }
    }
}
```

### H5页面input占位符placeholder在ios手机上没有垂直居中问题

如图：

![ios遮罩弹出框input调用键盘样式问题](/assets/img/postCover/ios_input_mask.jpg)

解决方案：在input标签上设置`line-height: 1px`

```css
input {
    line-height: 1px;
}
```

### 禁止ios10及以上h5页面缩放

移动端禁止页面缩放我们通常使用`<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=0">`就可以解决，但是在ios10以上有兼容问题，具体解决方案如下：

```js
// 禁止ios10及以上页面缩放
window.onload = function() {
    // 阻止双击放大
    var lastTouchEnd = 0;
    document.addEventListener('touchstart', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    });
    document.addEventListener('touchend', function(event) {
        var now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // 阻止双指放大
    document.addEventListener('gesturestart', function(event) {
        event.preventDefault();
    });

    // 阻止IOS手势事件
    document.addEventListener('gesturestart', function (e) {}, false);
    document.addEventListener('gesturechange', function (e) {}, false);
    document.addEventListener('gestureend', function (e) {}, false);
}
```

### H5页面微信浏览器ios手机实现音频自动播放功能

问题：H5页面ios系统音频不能自动播放，但是安卓手机可以

解决方案：在微信浏览器中使用微信环境相关api实现ios手机自动播放音频功能

> 注意：因为是通过调用微信浏览器相关api，所以只能在微信中有效

```html
<!-- 如果是使用js-sdk中的api，则需要引入改JS -->
<script src='https://res.wx.qq.com/open/js/jweixin-1.4.0.js'></script>

<!-- audio音频 -->
<audio id="shakemusic" src="/static/music/red1.mp3" style="display: none;"></audio>
```

```js
// 不需要引入js-sdk
/** 
 * @desc 微信ios实现音频自动播放
 * @param audioId audio音频id
 */
wxIosAutoPlay(audioId) {
    let ua = window.navigator.userAgent;
    let isWx = /MicroMessenger/i.test(ua);
    let isIos = /(iPhone|iPad|iPod|iOS)/i.test(ua);
    if (isWx && isIos) {
        document.addEventListener("WeixinJSBridgeReady", () => {
            document.getElementById(audioId).play();
        }, false);
    }
}
wxIosAutoPlay('shakemusic');

// 需要引入js-sdk
wx.config({
    // 配置信息, 即使不正确也能使用 wx.ready
    debug: false,
    appId: '',
    timestamp: 1,
    nonceStr: '',
    signature: '',
    jsApiList: []
});
wx.ready(function() {
    document.getElementById('shakemusic').play();
});
```

### ios9使用flex布局图片设置内边距导致图片变形

> 如果你不希望某个容器在任何时候都不被压缩，那设置flex-shrink:0；

解决方案：使用flex布局属性`flex-shrink`属性，把该值设置为0，如图：

![ios9使用flex布局图片设置内边距导致图片变形](/assets/img/postCover/work_flex_shrink.png)

[深入理解css3中的flex-grow、flex-shrink、flex-basis](https://www.cnblogs.com/ghfjj/p/6529733.html)

### new Date('yyyy-mm-dd hh:mm:ss').getTime()在苹果手机、Safari浏览器不兼容问题

> 问题：在安卓手机chrome浏览器可以使用`2018-10-10 10:10:10`这样的日期格式计算毫秒数，而在苹果手机Safari浏览器中不能这样使用日期字符串格式，只能使用`2018/10/10 10:10:10`这种格式，但是可以使用`2018-10-10`这种不带时间格式的字符串  

> 解决方法：`new Date(data.replace(/-/g,'/')).getTime()`

```js
// 在chrome浏览器运行

// 这两种格式毫秒数不一样
let pastTime = new Date('2013-12-16').getTime(); // 1387152000000
let pastTime = new Date('2013/12/16').getTime(); // 1387123200000

let pastTime = new Date('2013-12-16 00:00:00').getTime(); // 1387123200000
let pastTime = new Date('2013/12/16 00:00:00').getTime(); // 1387123200000

// 在safari浏览器运行

let pastTime = new Date('2013-12-16').getTime(); // 1387152000000
let pastTime = new Date('2013/12/16').getTime(); // 1387123200000

let pastTime = new Date('2013-12-16 00:00:00').getTime(); // NaN
let pastTime = new Date('2013/12/16 00:00:00').getTime(); //1387123200000

```

> 总结：  
> - `2013/12/16`默认是从0点0分0秒开始计算毫秒数，`2013-12-16`默认是从8点0分0秒开始计算毫秒数  
> - `2013-12-16 00:00:00`在Safari或者ios手机浏览器显示为`NaN`

### canvas.toBlob()低版本兼容ployfill

```js
// canvas.toBlob ployfill
if (!HTMLCanvasElement.prototype.toBlob) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function (callback, type, quality) {
            var dataURL = this.toDataURL(type, quality).split(',')[1];
            setTimeout(function () {
                var binStr = atob(dataURL);

                var len = binStr.length;

                var arr = new Uint8Array(len);

                for (var i = 0; i < len; i++) {
                    arr[i] = binStr.charCodeAt(i);
                }

                callback(new Blob([arr], {type: type || 'image/png'}));
            });
        }
    });
}
```

### 解决升级nodejs导致gulp以及node-sass不兼容的问题

报错如下：

```
gulp[9040]: c:\ws\src\node_contextify.cc:626: Assertion `args[1]->IsString()' failed.
 1: 000000013F61F04A v8::internal::GCIdleTimeHandler::GCIdleTimeHandler+5114
 2: 000000013F5FA0C6 node::MakeCallback+4518
 3: 000000013F5FA17F node::MakeCallback+4703
 4: 000000013F5CF630 node::DecodeWrite+13024
 5: 000000013FDFC122 v8::internal::OptimizingCompileDispatcher::Unblock+59890
 6: 000000013FDFD289 v8::internal::OptimizingCompileDispatcher::Unblock+64345
 7: 000000013FDFC5CC v8::internal::OptimizingCompileDispatcher::Unblock+61084
 8: 000000013FDFC4EB v8::internal::OptimizingCompileDispatcher::Unblock+60859
 9: 000001ECD0EDC5C1
```
解决方案：

- 执行命令npm i graceful-fs安装graceful-fs​​​​​​​即可解决上面的问题

- 执行命令npm i natives​​​​​​​安装natives​​​​​​​也可解决上面的问题（网上大多说用此方法解决，但是不推荐使用此方法，原因如下图，来自npm官网）

详情可查看[解决升级nodejs导致gulp以及node-sass不兼容的问题](https://blog.csdn.net/A1922212258/article/details/89293160)

### 运行gulp项目报错：AssertionError: Task function must be specified

原因：那是因为你安装了gulp4.0.0，gulpfile.js用的是gulp3.9.1的语法。

解决方案：

AssertionError: Task function must be specified错误解决方案

- npm i gulp@3.9.1重新安装gulp到3.91版
- 按gulp4.0.0重写gulpfile.js任务列表

[gulp运行报错：Task function must be specified必须指定任务函数](https://www.xinran001.com/frontend/47.html)

## 样式动画相关类

### 相同动画属性逐帧动画会覆盖transition过渡动画设置的属性

```css
    /* 相同动画属性逐帧动画会覆盖transition过渡动画设置的属性 */

    /* 过度动画transition属性设置transform过渡效果 */
    .avatar {
        transition: all 500ms;
        transform: rotateZ(0) !important;
    }

    .avatar:hover {
        transform: rotateZ(360deg) !important;
    }

    /* 逐帧动画设置transform属性动画效果 */
    @keyframes rightToLeftRotate {
        0% {
            opacity: 0;
            transform: translateX(200%) rotateZ(720deg);
        }

        100% {
            transform: none;
        }
    }

    .rtlr-delay500 {
        animation:  rightToLeftRotate 1000ms ease-in both;
    }
```

**总结：当这两个class作用于同一dom节点时，transition过度动画设置的transform属性不会生效**

## 参考博客

- [常见的移动端H5页面开发遇到的坑和解决办法](https://www.cnblogs.com/LiuJL/p/7744473.html)
 