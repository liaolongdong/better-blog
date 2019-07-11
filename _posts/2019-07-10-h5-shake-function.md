---
layout: post
title: H5页面实现摇一摇功能
subtitle: H5页面实现摇一摇功能
date: 2019-07-10
categories: 技术
cover: http://img3.imgtn.bdimg.com/it/u=1571861328,916520973&fm=26&gp=0.jpg
tags: JavaScript H5实现摇一摇
---

# H5页面实现摇一摇功能

最近公司做了一个微信摇一摇领红包的活动，趁着刚上线有点空余时间，做一下摇一摇活动总结，记录一下做摇一摇活动过程中遇到的问题，旨在为了方便自己下次做类似活动的时候查阅以及让没做过摇一摇活动的小伙伴们少踩坑吧

[点这里查看摇一摇demo效果](http://liaolongdong.com/demo/shakeDemo/index.html)

## 摇一摇要实现的功能细节

### 1. 如何实现监听手机设备摇一摇功能

使用H5原生API [devicemotion](https://developer.mozilla.org/zh-CN/docs/Web/API/Detecting_device_orientation#%E5%A4%84%E7%90%86%E7%A7%BB%E5%8A%A8%EF%BC%88motion%EF%BC%89%E4%BA%8B%E4%BB%B6)事件监听设备摇晃频率

具体代码如下：

```js
//运动事件监听
if (window.DeviceMotionEvent) {
    window.addEventListener(
        "devicemotion",
        deviceMotionHandler,
        false
    );
} else {
    alert("该浏览器不支持摇一摇功能");
}
```

> 注意：该事件在ios12以上非https协议下会失效，安卓手机不会，所以在ios手机上测试必须要在https协议的域名环境测试

![ios_device_motion](/assets/img/postCover/ios_device_motion.png)

### 2. 如何判断手机设备是不是在摇一摇

具体代码如下：

```js
// 获取加速度信息
// 通过监听上一步获取到的x, y, z 值在一定时间范围内的变化率，进行设备是否有进行晃动的判断。
// 而为了防止正常移动的误判，需要给该变化率设置一个合适的临界值。
let SHAKETHRESHOLD = 4000;
let lastUpdate = 0;
let x,
    y,
    z,
    lastX = 0,
    lastY = 0,
    lastZ = 0;

function deviceMotionHandler(eventData) {
    let acceleration = eventData.accelerationIncludingGravity;
    let curTime = new Date().getTime();
    if (curTime - lastUpdate > 50) {
        let diffTime = curTime - lastUpdate;
        lastUpdate = curTime;
        x = acceleration.x;
        y = acceleration.y;
        z = acceleration.z;
        let speed = (Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime) * 10000;
        if (speed > SHAKETHRESHOLD) {
                setTimeout(() => {
                    alert("恭喜你获得妹纸一枚!"); // Do something
                }, 1000);
            }
        }
        lastX = x;
        lastY = y;
        lastZ = z;
    }
}
```

### 3. 如何实现手机振动功能

[navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) 该方法可以调用手机设备的振动功能

> 注意：1、ios手机上浏览器不支持该方法 2、该方法需要用户触发某种操作才能调用， 不能一加载完页面就调用振动功能

```js
// 调用手机振动功能
useVibrateAction() {
    navigator.vibrate =
        navigator.vibrate ||
        navigator.webkitVibrate ||
        navigator.mozVibrate ||
        navigator.msVibrate;
    if (navigator.vibrate) {
        console.log("手机振动");
        navigator.vibrate(1000); // 振动时间毫秒数
    } else {
        console.log("该浏览器不支持振动功能");
    }
}
```

