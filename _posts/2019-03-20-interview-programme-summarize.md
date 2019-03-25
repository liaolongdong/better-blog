---
layout: post
title: 前端面试常见编程题汇总
subtitle: 前端面试常见编程题汇总
date: 2019-03-20
categories: 技术
cover: 'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1542004422750&di=bac805c49c6075c0dea87ae5aa94d5b5&imgtype=0&src=http%3A%2F%2Fwh.web.tedu.cn%2Fimg%2F201803%2F1522135004508.jpg'
tags: JavaScript 前端面试常见编程题汇总
---

# JS编程题

## 考察JS事件循环微任务和宏任务

```js
console.log(1);
setTimeout(function () {
    console.log(2);
}, 0);
var promise = new Promise(function (resolve, reject) {
    console.log(3);
    setTimeout(function () {
        console.log(4);
        resolve();
    }, 1000);
})
promise.then(function () {
    console.log(5);
    setTimeout(function () {
        console.log(6);
    }, 0);
});
console.log(7);
// 输出结果顺序：1 3 7 2 4 5 6
// 解析：JS代码执行优先级：主线程 -> 微任务 -> 宏任务
```

```javascript
var promise = new Promise(function(resolve, reject) {
    setTimeout(function() {
        console.log(1);
        resolve();
    }, 3000);
});
promise.then(function() {
    setTimeout(function() {
        console.log(2);
    }, 2000);
}).then(function() {
    setTimeout(function() {
        console.log(3);
    }, 1000);
}).then(function() {
    setTimeout(function() {
        console.log(4);
    }, 0);
});
// 输出结果：3s后输出1和4，再过1s输出3，再过1s输出2
// 解析：promise.then()方法要等resolve()执行以后，才会执行后面的then方法，后面的这些方法按定时器异步流程处理
```

[了解更多](https://www.cnblogs.com/wangziye/p/9566454.html)

## 实现深拷贝

常用的简单实现方式：类型判断+递归

```js
function deepClone(obj) {
    var newObj = obj instanceof Array ? [] : {};
    for (var i in obj) {
        newObj[i] = typeof obj[i] === 'object' ? deepClone(obj[i]) : obj[i]
    }
    return newObj;
}

// test
var obj = {
    number: 1,
    string: 'abc',
    bool: true,
    undefined: undefined,
    null: null,
    symbol: Symbol('s'),
    arr: [1, 2, 3],
    date: new Date(),
    userInfo: {
        name: 'Better',
        position: 'front-end engineer',
        skill: ['React', 'Vue', 'Angular', 'Nodejs', 'mini programs']
    },
    func: function () {
        console.log('hello better');
    }
}
console.log(deepClone(obj));
```

从打印的结果来看，这种实现方式还存在很多问题：这种方式只能实现特定的object的深度复制（比如对象、数组和函数），不能实现null以及包装对象Number，String ，Boolean，以及Date对象，RegExp对象的复制。

一行代码实现方式：结合使用`JSON.stringify()`和`JSON.parse()`

```js
var obj = {
    number: 1,
    string: 'abc',
    bool: true,
    undefined: undefined,
    null: null,
    symbol: Symbol('s'),
    arr: [1, 2, 3],
    date: new Date(),
    userInfo: {
        name: 'Better',
        position: 'front-end engineer',
        skill: ['React', 'Vue', 'Angular', 'Nodejs', 'mini programs']
    },
    func: function () {
        console.log('hello better');
    }
}

var copyObj = JSON.parse(JSON.stringify(obj));

console.log(copyObj);
```

从打印结果可以得出以下结论：

1. `undefined`、`symbol`、`function`类型直接被过滤掉了
2. `date`类型被自动转成了字符串类型

## 实现一个bind函数

原理：使用`apply()`或者`call()`方法

初始版本

```js
Function.prototype.customBind = function (context) {
    var self = this; // 保存函数的上下文
    var args = [].slice.call(arguments, 1); // 获取自定义bind函数的参数
    return function () {
        args = args.concat([].slice.call(arguments)); // 获取自定义bind函数返回函数传入的参数
        return self.apply(context, args);
    }
}

var obj = {
    name: 'Better',
    position: 'front-end engineer'
}
var func = function (age) {
    console.log('name', this.name);
    console.log('position', this.position);
    console.log('age', age);
}
var f = func.customBind(obj, 18);
f();
```

考虑到原型链(最终版)

```js
Function.prototype.customBind = function (context) {
    // 必须在函数上使用，否则抛出错误
    if (typeof this !== "function") {
        throw new Error("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var self = this; // 保存函数的上下文
    var args = Array.prototype.slice.call(arguments, 1); // 获取自定义bind函数的参数

    var fNOP = function () {};

    var fBound = function () {
        var bindArgs = Array.prototype.slice.call(arguments); // 获取自定义bind函数返回函数传入的参数
        return self.apply(this instanceof fNOP ? this : context, args.concat(bindArgs));
    }

    // 这里使用寄生组合继承
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
    return fBound;
}

// 测试
var obj = {
    name: 'Better',
    position: 'front-end engineer'
}
var func = function (age) {
    console.log('name', this.name);
    console.log('position', this.position);
    console.log('age', age);
}
var f = func.customBind(obj, 18);
f();
```

[点击了解更多](https://github.com/mqyqingfeng/Blog/issues/12)

## 性能优化之防抖和节流

对于频繁触发的事件，比如，`scroll`、`keyup`、`mouseover`、`resize`等事件，如果不做一些特殊处理的话，可能会影响性能，甚至造成页面卡顿。

防抖和节流就能很好的解决这类问题。

### 防抖

定义：在规定时间内，多次触发事件后，事件处理函数只执行一次，并且是在触发操作结束后执行。

原理：对处理函数进行延时操作，若设定的延时到来之前，再次触发事件，则清除上一次的延时操作定时器，重新定时。

```js
function debounce (fn, wait) {
    var timeId = null;
    return function () {
        var context = this; // 保存绑定事件的对象，如document
        var args = arguments; // 获取事件参数，如event
        timeId && clearTimeout(timeId); // 如果规定时间内（wait）再次触发事件，则清除定时器
        timeId = setTimeout(function () {
            fn.apply(context, args); // 使用apply方法把fn函数的this指向事件对象
        }, wait)
    }
}

// 测试
function func () {
    console.log(111);
}
document.addEventListener('mouseover', debounce(func, 1000));
```

如果希望立即执行一次，然后等到停止触发 n 秒后，才可以重新触发执行。

```js
function debounce (fn, wait, immediately) {
    var timeId = null;
    return function () {
        var context = this;
        var args = arguments;
        timeId && clearTimeout(timeId);
        if (immediately) {
            // 如果已经执行过，则不再执行
            var canExecute = !timeId;
            timeId = setTimeout(function () {
                timeId = null;
            }, wait)
            if (canExecute) {
                fn.apply(context, args);
            }
        } else {
            timeId = setTimeout(function () {
                fn.apply(context, args); // 使用apply方法把fn函数的this指向事件对象
            }, wait)
        }
    }
}

// 测试
function func () {
    console.log(111);
}
document.addEventListener('mouseover', debounce(func, 1000, true));
// document.addEventListener('mouseover', debounce(func, 1000));
```

[点击了解更多](https://github.com/mqyqingfeng/Blog/issues/22)

### 节流

定义：触发函数事件后，规定时间间隔内无法连续调用，只有上一次函数执行后，过了规定的时间间隔，才能进行下一次的函数调用。

原理：如果你持续触发事件，每隔一段时间，只执行一次事件。

关于节流的实现，有两种主流的实现方式，一种是使用时间戳，一种是设置定时器。

使用时间戳，当触发事件的时候，我们取出当前的时间戳，然后减去之前的时间戳(最一开始值设为 0 )，如果大于设置的时间周期，就执行函数，然后更新时间戳为当前的时间戳，如果小于，就不执行。

```js
// 使用时间戳
function throttle (fn, wait) {
    var prev = 0;
    return function () {
        var context = this;
        var args = arguments;
        var now = new Date().getTime();
        // if (!prev) prev = now;
        if (now - prev > wait) { // 如果时间间隔大于wait，执行函数
            fn.apply(context, args);
            prev = now; // 把当前时间赋值给前一个时间
        }
    }
}

// 测试
function func () {
    console.log(111);
}
document.addEventListener('mouseover', throttle(func, 1000));
```

使用定时器：当触发事件的时候，我们设置一个定时器，再触发事件的时候，如果定时器存在，就不执行，直到定时器执行，然后执行函数，清空定时器，这样就可以设置下个定时器。

```js
// 使用定时器
function throttle (fn, wait) {
    var timeId = null;
    return function () {
        var context = this;
        var args = arguments;
        if (!timeId) { // 如果没有定时器
            timeId = setTimeout(function () {
                fn.apply(context, args);
                timeId = null;
            }, wait)
        }
    }
}

// 测试
function func () {
    console.log(111);
}
document.addEventListener('mouseover', throttle(func, 1000));
```

总结：

1. 第一种事件会立刻执行，第二种事件会在 n 秒后第一次执行
2. 第一种事件停止触发后没有办法再执行事件，第二种事件停止触发后依然会再执行一次事件

[点击了解更多](https://github.com/mqyqingfeng/Blog/issues/26)

## 使用setTimeout实现setInterval功能

我们平时开发中尽量避免使用setInterval重复定时器，这种重复定时器的规则有两个问题：

1. 某些间隔会被跳过
2. 多个定时器的代码执行时间可能会比预期小

```js
var i = 0;
function count () {
    console.log(i++);
    setTimeout(count, 1000);
}
setTimeout(count, 1000);
```

或者使用arguments.callee

```js
var i = 0;
setTimeout(function () {
    // do something
    console.log(i++);
    setTimeout(arguments.callee, 1000);
}, 1000);
```

## 如何实现sleep效果

方法一：使用promise

```js
function sleep (time) {
    return new Promise(function (resolve, reject) {
        console.log('start');
        setTimeout(function () {
            resolve();
        }, time);
    });
}

sleep(1000).then(function () {
    console.log('end');
});
// 先输出start，延迟1000ms后输出end
```

方法二：使用async/await

```js
function sleep (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            // do something
            resolve();
        }, time);
    });
}

async function test () {
    console.log('start');
    var result = await sleep(1000);
    console.log('end');
    return result;
}

test(); // 先输出start，延迟1000ms后输出end
```

方法三：使用generate

```js
function *sleep (time) {
    yield new Promise((resolve, reject) => {
        console.log('start');
        setTimeout(() => {
            // do something
            resolve();
        }, time);
    });
}

sleep(1000).next().value.then(() => {console.log('end');}); // 先输出start，延迟1000ms后输出end
```

## 如何实现a == 1 && a == 2 && a == 3

方法一：结合使用数组的`toString()`和`shift()`方法

```js
var a = [1, 2, 3];
// a.join = a.shift;
// a.valueOf = a.shift;
a.toString = a.shift;

console.log(a == 1 && a == 2 && a == 3); // true
```

原理：当复杂类型数据与基本类型数据作比较时会发生隐性转换，会调用`toString()`或者`valueOf()`方法

方法二：原理和方法一一样都是修改`toString()`方法

```js
var a = {
    value: 1,
    toString: function () {
        return a.value++;
    }
}
console.log(a == 1 && a == 2 && a == 3); // true
```

## 实现add(1)(2)(3)这类方法以及扩展方法

```js
// 普通写法
var add = function (a) {
    return function (b) {
        return function (c) {
            return a + b + c;
        }
    }
}

console.log(add(1)(2)(3)); // 6

// 扩展写法
function addExtend (x) {
    var sum = x;
    var temp = function (y) {
        sum = sum + y;
        return temp;
    }
    temp.toString = function () {
        return sum;
    }
    return temp;
}

console.log(addExtend(1)(2)(3)); // ƒ 6
console.log(typeof addExtend(1)(2)(3)); // function
console.log(Number(addExtend(1)(2)(3))); // 6
console.log(Number(addExtend(1)(2)(3)(4)(5))); // 15
```

## 获取两个数组的交集（共有元素）

```js
function intersection (arr1, arr2) {
    let tempArr = []; // 存储交集数组
    let tempArr2 = [].concat(arr2); // 拷贝arr2数组，防止后续使用splice修改原来的arr2中的值
    arr1.forEach(item => {
        let i = arr2.indexOf(item);
        if (i > -1) {
            tempArr.push(item); // 把arr1和arr2都存在的元素加进去
            tempArr2.splice(i, 1); // 从tempArr中移除该元素
        }
    });
    return tempArr;
}

// 测试
let arr1 = [1, 2, 6, 3, 5];
let arr2 = [6, 2, 6, 8, 3];
intersection(arr1, arr2); // [2, 6, 3]
```
