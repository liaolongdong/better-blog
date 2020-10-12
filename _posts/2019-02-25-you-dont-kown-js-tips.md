---
layout: post
title: 前端那些你不知道的小技巧(JS篇)
subtitle: 前端那些你不知道的小技巧(JS篇)
date: 2019-02-25
categories: 技术 前端小技巧
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript 前端小技巧 黑科技
---

# 前端那些你不知道的小技巧(JS篇)

## 用一行代码实现五星评价功能

```js
// 评价5星
var rate = 5;

var result = '★★★★★☆☆☆☆☆'.slice(5 - rate, 10 - rate);

console.log(result); // ★★★★★
```

## 统计字符串中相同字符出现的次数

```js
var str = 'aaabbbccc66aabbc6';

var strInfo = str.split('').reduce((p, c) => (p[c]++ || (p[c] = 1), p), {});

console.log(arrInfo); // {6: 3, a: 5, b: 5, c: 4}
```

## 查找字符串中出现最多的字符和个数

```js
var str = "abcabcabcbbccccc";
var num = 0;
var char = '';

// 使其按照一定的次序排列
str = str.split('').sort().join('');
// "aaabbbbbcccccccc"

// 定义正则表达式
var re = /(\w)\1+/g;
str.replace(re, ($0, $1) => {
    console.log('$0', $0);
    console.log('$1', $1);
    if (num < $0.length) {
        num = $0.length;
        char = $1;
    }
});
console.log(`字符最多的是${char}，出现了${num}次`);
```

## 一行代码准确判断出数据类型

几种常用的类型判断方法：

1. typeof，使用这种方法只能判断`undefined`、`number`、`string`、`boolean`、`symbol`、`function`类型
2. instanceof，该方法也只局限于判断引用类型
3. constructor，同instanceof
4. Object.prototype.toString.call(obj)，这个方法应该是类型判断神器

```js
var number = 1;            // [object Number]
var string = '123';        // [object String]
var boolean = true;        // [object Boolean]
var und = undefined;       // [object Undefined]
var nul = null;            // [object Null]
var symbol = Symbol('a');  // [object Symbol]
var obj = {a: 1}           // [object Object]
var array = [1, 2, 3];     // [object Array]
var date = new Date();     // [object Date]
var error = new Error();   // [object Error]
var reg = /a/g;            // [object RegExp]
var func = function a(){}; // [object Function]

function checkType() {
    for (var i = 0; i < arguments.length; i++) {
        console.log(Object.prototype.toString.call(arguments[i]))
    }
}
// 测试
checkType(number, string, boolean, und, nul, symbol, obj, array, date, error, reg, func);
```

[点击了解更多](https://github.com/mqyqingfeng/Blog/issues/28)

## 数组去重

方法一：使用Set

```js
var arr = [1, 2, 3, 2, 6, '2', 3, 1];

var resultArr = [...new Set(arr)]; // Array.from(new Set(arr));

console.log(resultArr); // [1, 2, 3, 6, "2"]
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

## 将类数组对象转成数组

方法一：利用每个函数都包含`call()`和`apply()`方法，配合使用数组的`slice()`方法

```js
var likeArrObj = {
    0: 1,
    1: 2,
    2: 3,
    length: 3
}

var arr1 = Array.prototype.slice.call(likeArrObj); // 或者使用[].slice.call(likeArrObj);
var arr2 = Array.prototype.slice.apply(likeArrObj); // 或者使用[].slice.apply(likeArrObj);

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

## 用一行代码将多维数组转成一维数组

```js
var arr = [ [1, 2, 2], [3, 4, 5, 5], [6, 7, 8, 9, [11, 12, [12, 13, [14] ] ] ], 10];

var resultArr = arr.toString().split(',').map(Number);

console.log(resultArr); // [1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9, 11, 12, 12, 13, 14, 10]
```

## 将数组扁平化并去除其中重复数据，最终得到一个升序且不重复的数组

```js
var arr = [ [1, 2, 2], [3, 4, 5, 5], [6, 7, 8, 9, [11, 12, [12, 13, [14] ] ] ], 10];

var resultArr = Array.from(new Set(arr.toString().split(',').map(Number))).sort((a, b) => (a - b));

console.log(resultArr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
```

## 数组混淆

```js
// 随机更改数组元素顺序，混淆数组
(arr) => arr.slice().sort(() => Math.random() - 0.5);
```

## 数字金额千分位格式化

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

## 使用正则表达式格式化手机号码

```js
var phone = 13556891025;

var formatPhone = String(phone).replace(/\B(?=(\d{4})+(?!\d))/g, ' ');

console.log(formatPhone); // 135 5689 1025
```

## 使用正则表达式格式化订单号和银行卡号

```js
var bankNo = '8888888888888888';
var orderNo = '6666666666666666666';
var orderNo1 = '6666666666666666666';

var formatBankNo = bankNo.replace(/\B(?<=(?<!\d)(\d{4})+)/g, ' ');
// var formatOrderNo = orderNo.replace(/\B(?<=(?<!\d)(\d{4})+)/g, ' ');
var formatOrderNo = orderNo.replace(/....(?!$)/g, '$& ');
var formatOrderNo1 = orderNo1.replace(/(\d{4}(?=\d))/g, '$1 ');

console.log(formatBankNo); // 8888 8888 8888 8888
console.log(formatOrderNo); // 6666 6666 6666 6666 666
console.log(formatOrderNo1); // 6666 6666 6666 6666 666

// 结合使用先行断言和后发断言
var res = "6230 6666 6666 8851".replace(/(?<=\s+)(\d{4})(?=\s+)/g, '****');
console.log(res); // 6230 **** **** 8851
```

## 用一行代码实现一个简易的模板字符串功能

```js
String.prototype.render = function (context) {
    return this.replace(/\{\{(.*?)\}\}/g, (match, key) => context[key.trim()]);
};

// 用户信息对象
var userInfo = {
    name: 'Better',
    position: 'front-end engineer'
}

// 字符串中双大括号加`\`是为了防止模板语法冲突，在实际代码中要去掉`\`
'我叫\{\{name\}\}，是位\{\{position\}\}'.render(userInfo); // 我叫Better，是位front-end engineer
```

## 小数取整

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

## 交换两个值

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

## 用一行代码实现深拷贝

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

## 一行代码生成数字字母组成的随机字符串

```js
Math.random().toString(16).substring(2); // 586a3ef1e79ec
Math.random().toString(32).substring(2); // 1iqn39075lo
```

## 一行代码实现获取一个网页使用了多少种标签

```js
[...new Set([...document.querySelectorAll('*')].map(node => node.tagName))].length;
```

代码分解：

1. 使用`document.querySelectorAll('*')`获取网页中所有标签节点
2. 使用`[...arrayLike]`扩展运算符把类数组转成数组
3. 使用`node.tagName`获取标签名称，比如`DIV`、`SPAN`等
4. 使用`set`去重
5. 使用`[...arrayLike]`扩展运算符把类数组转成数组
6. 获取数组长度

## 一行代码获取过去/未来七天的日期

```js
// 过去七天
[...Array(7)].map((v, k) => new Date(Date.now() - 60 * 60 * 24 * 1000 * k).toLocaleDateString());

// 未来七天
[...Array(7)].map((v, k) => new Date(Date.now() + 60 * 60 * 24 * 1000 * k).toLocaleDateString());
```

## 一行代码获取url参数

```js
// 获取URL的查询参数
q={};location.search.replace(/([^?&=]+)=([^&]+)/g,(_,k,v)=>q[k]=v);q;
```

## 返回一个键盘（惊呆了）

```js
// 用字符串返回一个键盘图形
(_=>[..."`1234567890-=~~QWERTYUIOP[]\\~ASDFGHJKL;'~~ZXCVBNM,./~"].map(x=>(o+=`/${b='_'.repeat(w=x<y?2:' 667699'[x=["BS","TAB","CAPS","ENTER"][p++]||'SHIFT',p])}\\|`,m+=y+(x+'    ').slice(0,w)+y+y,n+=y+b+y+y,l+=' __'+b)[73]&&(k.push(l,m,n,o),l='',m=n=o=y),m=n=o=y='|',p=l=k=[])&&k.join`
`)()
```

### 持续更新中，欢迎大家留言，收集更多的实用小技巧，共同学习，共同进步