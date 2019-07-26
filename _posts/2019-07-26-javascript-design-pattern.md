---
layout: post
title: JavaScript常用设计模式总结
subtitle: JavaScript常用设计模式总结
date: 2019-07-26
categories: JavaScript 设计模式
cover: https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg
tags: JavaScript 设计模式
---

# JavaScript常用设计模式总结

## 单例模式

单例模式的核心是确保只有一个实例，并提供全局访问。

### 实现简单的单例模式

```js
var Singleton = function (name) {
    this.name = name;
    this.instance = null;
}
Singleton.prototype.getName = function () {
    return this.name;
}
Singleton.getInstance = function (name) {
    if (!this.instance) {
        this.instance = new Singleton(name);
    }
    return this.instance;
}

// 或者
var Singleton = function (name) {
    this.name = name;
}
Singleton.prototype.getName = function () {
    return this.name;
}
Singleton.getInstance = (function () {
    var instance = null;
    return function (name) {
        if (!instance) {
            instance = new Singleton (name);
        }
        return instance;
    }
})();

// 测试
var s1 = Singleton.getInstance('liaoxiaoxin');
var s2 = Singleton.getInstance('liaoxiaowu');
console.log(s1 === s2); // true
console.log(s1.getName()); // liaoxiaoxin
console.log(s2.getName()); // liaoxiaoxin
```

### 完整单例模式实例

创建一个登录弹窗

```js
var getSingle = function (fn) {
    var result;
    return function () {
        return result || (result = fn.apply(this, arguments));
    }
}

var createLoginLayer = function () {
    var div = document.createElement('div');
    div.innerHTML = '我是登录浮窗';
    div.style.display = 'none';
    document.body.appendChild(div);
    return div;
};

// 测试
var createSingleLoginLayer = getSingle(createLoginLayer);
```

