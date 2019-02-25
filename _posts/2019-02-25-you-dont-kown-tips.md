---
layout: post
title: 前端那些你不知道的小技巧
subtitle: 前端那些你不知道的小技巧
date: 2019-02-25
categories: 技术 前端小技巧
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript 前端小技巧 黑科技
---

# 前端那些你不知道的小技巧

## JS类

### 用一行代码实现五星评价功能

```js
// 评价5星
var rate = 5;

var result = '★★★★★☆☆☆☆☆'.slice(5 - rate, 10 - rate);

console.log(result); // ★★★★★
```

### 统计字符串中相同字符出现的次数

```js
var str = 'aaabbbccc66aabbc6';

var strInfo = str.split('').reduce((p, c) => (p[c]++ || (p[c] = 1), p), {});

console.log(arrInfo); // {6: 3, a: 5, b: 5, c: 4}
```

### 数组去重

方法一：使用Set

```js
var arr = [1, 2, 3, 2, 6, '2', 3, 1];

var resultArr = [...new Set(arr)]; // Array.from(new Set(arr));

console.log(resultArr); // [1, 2, 3, 6]
```

方法二：结合使用数组filter方法和indexOf()方法

```js
var arr = [1, 2, 3, 2, 6, '2', 3, 1];

function uniqueArr (arr) {
    return arr.filter(function (ele, index, array) {
        // 利用数组indexOf()方法，返回找到的第一个值的索引
        // 如果数组元素的索引值与indexOf方法查找返回的值不相等，则说明该值重复了，直接过滤掉
        return array.indexOf(ele) === index;
    })
}

console.log(uniqueArr(arr)); // [1, 2, 3, 6, "2"]
```

### 将类数组对象转成数组

方法一：利用每个函数都包含`call()`和`apply()`方法，配合使用数组的`slice()`方法

```js
var likeArrObj = {
    0: 1,
    1: 2,
    2: 3,
    length: 3
}

var arr1 = Array.prototype.slice.call(likeArrObj);
var arr2 = Array.prototype.slice.apply(likeArrObj);

console.log(arr1); // [1, 2, 3]
console.log(arr2); // [1, 2, 3]
```

方法二：使用ES6的`Array.from()`或者扩展运算符`...`

```js
var likeArrObj = {
    0: 1,
    1: 2,
    2: 3,
    length: 3
}

var arr = Array.from(likeArrObj);
// var arr1 = [...likeArrObj]; // likeArrObj is not iterable

console.log(arr); // [1, 2, 3]
```

> 注意：ES6 中的扩展运算符...也能将某些数据结构转换成数组，但是这种数据结构必须是可迭代的对象

### 用一行代码将多维数组转成一维数组

```js
var arr = [ [1, 2, 2], [3, 4, 5, 5], [6, 7, 8, 9, [11, 12, [12, 13, [14] ] ] ], 10];

var resultArr = arr.toString().split(',').map(Number);

console.log(resultArr); // [1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9, 11, 12, 12, 13, 14, 10]
```

### 将数组扁平化并去除其中重复数据，最终得到一个升序且不重复的数组

```js
var arr = [ [1, 2, 2], [3, 4, 5, 5], [6, 7, 8, 9, [11, 12, [12, 13, [14] ] ] ], 10];

var resultArr = Array.from(new Set(arr.toString().split(',').map(Number))).sort((a, b) => (a - b));

console.log(resultArr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
```

### 数字金额千分位格式化

方法一：使用`Number.prototype.toLocaleString()`

```js
var num = 123455678;
var num1 = 123455678.12345;

var formatNum = num.toLocaleString('en-US');
var formatNum1 = num1.toLocaleString('en-US');

console.log(formatNum); // 123,455,678
console.log(formatNum1); // 123,455,678.123
```

方法二：使用正则表达式

```js
var num = 123455678;
var num1 = 123455678.12345;

var formatNum = String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
var formatNum1 = String(num1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

console.log(formatNum); // 123,455,678
console.log(formatNum1); // 123,455,678.12,345
```

### 用一行代码实现一个简易的模板字符串功能

```js
String.prototype.render = function (context) {
    return this.replace(/\{\{(.*?)\}\}/g, (match, key) => context[key.trim()]);
};

// 用户信息对象
var userInfo = {
    name: 'Better',
    position: 'front-end engineer'
}
'我叫{{name}}，是位{{position}}'.render(userInfo); // 我叫Better，是位front-end engineer
```

### 小数取整

```js
var num = 123.123

// 常用方法
console.log(parseInt(num)); // 123
// “双按位非”操作符
console.log(~~ num); // 123
// 按位或
console.log(num | 0); // 123
// 按位异或
console.log(num ^ 0); // 123
// 左移操作符
console.log(num << 0); // 123
```

### 交换两个值

方法一：利用一个数异或本身等于0和异或运算符合交换率

```js
var a = 3;
var b = 4
a ^= b; // a = a ^ b
b ^= a;
a ^= b;

console.log(a, b);
```

方法二：使用ES6解构赋值

```js
let a = 1;
let b = 2;

[b, a] = [a, b];

console.log(a, b); // 2 1

// 使用babel转换代码
// var a = 1;
// var b = 2;
// var _ref = [a, b];
// b = _ref[0];
// a = _ref[1];
// console.log(a, b);
```

> 注意：ES6解构赋值低版本浏览器运行会报错，需[使用babel进行转换](https://babeljs.io/repl)

### 用一行代码实现深拷贝

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

### 一行代码生成数字字母组成的随机字符串

```js
Math.random().toString(16).substring(2); // 586a3ef1e79ec
Math.random().toString(32).substring(2); // 1iqn39075lo
```

### 如何实现a == 1 && a == 2 && a == 3

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

#### 持续更新中，欢迎大家留言，收集更多的实用小技巧，共同学习，共同进步