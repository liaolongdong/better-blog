---
layout: post
title: 前端面试常见编程题汇总
subtitle: 前端面试常见编程题汇总
date: 2100-10-25
categories: 技术
cover: ''
tags: JavaScript 前端面试常见编程题汇总
---

# JS编程题

```js
function User () {
    this.name = '123';
    return {
        name: '456',
        ref: function () {
            console.log(this);
        }
    }
}
var user = new User();
```

```js
var obj = {
    name: 123,
    getName: function () {
        console.log(this.name);
    }
}
var obj1 = {
    name: 456,
    __proto__: obj
}
obj1.getName(); // 456
```

```js
var obj = {
    colors: [],
    getColors: function () {
        console.log(this.colors);
    }
}
var obj1 = {
    // colors: [],
    __proto__: obj
}

obj.colors.push('red');
console.log(obj);
console.log(obj1.colors);
console.log(obj1.getColors());
obj.test = '123';
console.log(obj1.test);

var str = '123';
str.test = 5;
console.log(str.test);

var num = 123;
num.test = 5;
console.log(num.test);
```

```js
for (var i = 0; i < 5; i++) {
    setTimeout(function () {
        console.log(i);
    })
}
console.log(i);

for (var i = 0; i < 5; i++) { // 或者使用let
    (function (i) {
        setTimeout(function () {
            console.log(i);
        })
    })(i);
}
```

```js
// 冒泡排序
function bubbleSort (arr) {
    if (arr && arr.length < 2) return;
    let len = arr.length;
    let temp;
    for (let i = 0; i < len - 1; i++) {
        for (let j = 0; j < len - (i + 1); j++) {
            if (arr[j] > arr[j + 1]) {
                temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
    return arr;
}

// 测试
let arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
bubbleSort(arr);
```

```js
function selectSort (arr) {
    if (arr && arr.length < 2) return;
    const len = arr.length;
    let index, temp;
    for (let i = 0; i < len; i++) {
        index = i;
        for (let j = i + 1; j < len; j++) {
            if (arr[j] < arr[index]) {
                index = j;
            }
        }
        temp = arr[i];
        arr[i] = arr[index];
        arr[index] = temp;
    }
    return arr;
}

// 测试
let arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
selectSort(arr);
```

## 判断一个数字字符串是否为连续的，如，012345，543

```js
function isSerial (str) {
    let isSerialStr = false;
    // 把字符串分解成数组
    let strArr = String(str).split('');
    strArr.every((item, index, arr) => {
        if (arr[index] && arr[index + 1]) {
            if (arr[index + 1] - arr[index] === 1) {
                isSerialStr = true;
            } else {
                isSerialStr = false;
            }
        }
    });
    return isSerialStr;
}

let str = 1234578;
isSerial(str);
```