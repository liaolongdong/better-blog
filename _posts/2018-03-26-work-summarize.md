---
layout: post
title: '总结工作当中遇到的各种坑'
subtitle: '总结工作当中遇到的各种坑'
date: 2018-03-26
categories: 技术
cover: 'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1542003988331&di=8f1eeb3781533c2844e60331b1a55e60&imgtype=0&src=http%3A%2F%2Fpic2.zhimg.com%2Fv2-e2b6fb372ba7f9c8375aa73e5cbe49a8_b.jpg'
tags: JavaScript 工作总结
---

# 总结工作当中遇到的各种坑

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
        // 兼容ios弹窗遮罩层底部页面禁止滑动处理(还是有问题啊，滑动弹窗遮罩层底部页面还是会会滚动)
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

### ios9使用flex布局图片设置内边距导致图片变形

> 如果你不希望某个容器在任何时候都不被压缩，那设置flex-shrink:0；

解决方案：使用flex布局属性`flex-shrink`属性，把该值设置为0，如图：

![ios9使用flex布局图片设置内边距导致图片变形](/assets/img/postCover/work_flex_shrink.png)

[深入理解css3中的flex-grow、flex-shrink、flex-basis](https://www.cnblogs.com/ghfjj/p/6529733.html)

### new Date('yyyy-mm-dd hh:mm:ss').getTime()在苹果手机、Safari浏览器不兼容问题

> 问题：在安卓手机chrome浏览器可以使用`2018-10-10 10:10:10`这样的日期格式计算毫秒数，而在苹果手机Safari浏览器中不能这样使用日期字符串格式，只能使用`2018/10/10 10:10:10`这种格式，但是可以使用`2018-10-10`这种不带时间格式的字符串
> 解决方法：nnew Date(data.replace(/-/g,'/')).getTime()

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

>总结：`2013/12/16`默认是从0点0分0秒开始计算毫秒数

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
