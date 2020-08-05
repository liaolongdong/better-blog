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

## 阿里经典面试题(考察变量提升/静态方法/实例方法/原型方法调用)

```js
function Foo () {
    getName = function () {
        console.log(1);
    }
    return this;
}
Foo.getName = function () {
    console.log(2);
}
Foo.prototype.getName = function () {
    console.log(3);
}
var getName = function () {
    console.log(4);
}
function getName () {
    console.log(5);
}

Foo.getName(); // 2 解析：调用函数的静态方法
getName(); // 4 解析：函数表达式会覆盖函数声明式方法
Foo().getName(); // 1 解析：调用函数自身的方法
getName(); // 1 解析: 受前一行代码执行影响相当于调用this.getName(), 其中this指向window，因为Foo方法里面定义getName的时候没有声明, 所以变成了全局变量
new Foo.getName(); // 2 解析：相当于执行new (Foo.getName)()
new Foo().getName(); // 3 解析：调用函数的实例方法, 相当于执行(new Foo()).getName()
new new Foo().getName(); // 3 解析：相当于执行new (new Foo()).getName)()
// 操作运算符的优先级: () > new > .
```

## 字节面试题(递归/微任务/宏任务)

```js
function fn () {
    fn();
}
fn(); // Uncaught RangeError: Maximum call stack size exceeded

var num = 0;
function fn () {
    console.log(num++)
    setTimeout(fn, 1000);
}
fn(); // 可以正常执行，为什么？
// 解析：原因是因为setTImeout属于异步宏任务，不在主线程栈内存中
```

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

## async/await和setTimeout以及promise

```js
async function async1() {
    console.log('async1 start');
    await async2();
    console.log(`async1 end`);
}

async function async2() {
    console.log('async2');
}

console.log('script start');

setTimeout(() => {
    console.log('setTimeout');
}, 0)

async1();

new Promise((resolve, reject) => {
    console.log('promise1');
    resolve();
}).then(() => {
    console.log('promise2');
})

console.log('script end');

// 输出结果：
// script start
// async1 start
// async2
// promise1
// script end
// async1 end
// promise2
// setTimeout
```

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

## 如何实现a == 1 && a == 2 && a == 3为true

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

## 闭包和任务队列例子

```js
for (var i = 0; i < 5; i++) {
    setTimeout((function (i) {
        console.log(i);
    })(i), i * 1000)
}

// 测试结果： 立即输出0 1 2 3 4
```

```js
for (var i = 0; i < 5; i++) {
    setTimeout(function () {
        console.log(i);
    }, i * 1000)
}

// 测试结果： 立即输出5 然后每隔一秒输出5 总共输出5次
```

```js
for (let i = 0; i < 5; i++) {
    setTimeout(function () {
        console.log(i);
    }, i * 1000)
}

// 测试结果：立即输出0 然后每隔一秒分别输出1 2 3 4
```

## 使用正则表达式匹配url参数键值对（兼容url中包含多个?和#号）

```js
let reg = /([^?&#]+=[^?&#]+)/g;
let str = 'https://c2b.brightoilonline.com/bdh5/channel.html?chelun_params=ad0bb3e5fc3b3bfeb9b53cc9686eb1aaaecb8a53e9f4a77c5ed68714123b25913219200cba48d9044c7b48325436960f42c1cde18f349ef63ab53ee791970243a8ba79f9a2dc8aa1#/chelunGasList?pcode=c2b8g717rkj603o15005&fromApp=true';

console.log(str.match(reg));
// 测试结果：["chelun_params=ad0bb3e5fc3b3bfeb9b53cc9686eb1aaaecb…f42c1cde18f349ef63ab53ee791970243a8ba79f9a2dc8aa1", "pcode=c2b8g717rkj603o15005", "fromApp=true"]

str = 'https://c2b-test2.brightoilonline.com/bdh5/channel.html#/chelungaslist?pcode=c2b0293jm44x97an6339&fromApp=true';
console.log(str.match(reg));
// 测试结果： ["pcode=c2b0293jm44x97an6339", "fromApp=true"]

str = 'https://c2b-test2.brightoilonline.com/bdh5/channel.html?pcode=c2b0293jm44x97an6339&fromApp=true';
console.log(str.match(reg));
// 测试结果： ["pcode=c2b0293jm44x97an6339", "fromApp=true"]
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
var re = /(\w)\1+/g; // \1为反向引用，匹配的是第一个捕获组(\w)所匹配的文本内容
str.replace(re, ($0, $1) => {
    console.log('$0', $0);
    console.log('$1', $1);
    if (num < $0.length) {
        num = $0.length;
        char = $1;
    }
});
console.log(`字符最多的是${char}，出现了${num}次`); // 字符最多的是c，出现了8次
```

## 解析 URL Params 为对象
```js
let url = 'http://www.domain.com/?user=anonymous&id=123&id=456&city=%E5%8C%97%E4%BA%AC&enabled';
parseParam(url)
/* 结果
{ user: 'anonymous',
  id: [ 123, 456 ], // 重复出现的 key 要组装成数组，能被转成数字的就转成数字类型
  city: '北京', // 中文需解码
  enabled: true, // 未指定值得 key 约定为 true
}
*/

function parseParam(url) {
  const paramsStr = /.+\?(.+)$/.exec(url)[1]; // 将 ? 后面的字符串取出来
  const paramsArr = paramsStr.split('&'); // 将字符串以 & 分割后存到数组中
  let paramsObj = {};
  // 将 params 存到对象中
  paramsArr.forEach(param => {
    if (/=/.test(param)) { // 处理有 value 的参数
      let [key, val] = param.split('='); // 分割 key 和 value
      val = decodeURIComponent(val); // 解码
      val = /^\d+$/.test(val) ? parseFloat(val) : val; // 判断是否转为数字

      if (paramsObj.hasOwnProperty(key)) { // 如果对象有 key，则添加一个值
        paramsObj[key] = [].concat(paramsObj[key], val);
      } else { // 如果对象没有这个 key，创建 key 并设置值
        paramsObj[key] = val;
      }
    } else { // 处理没有 value 的参数
      paramsObj[param] = true;
    }
  })
  return paramsObj;
}
```

## 求字符串中，出现次数最多的字符

```js
var str = "abcabcabcbbccccc";

function findMaxChar (str) {
    var num = 0;
    var char = '';

    // 使其按照一定的次序排列
    str = str.split('').sort().join('');
    // "aaabbbbbcccccccc"

    // 定义正则表达式
    var re = /(\w)\1+/g;
    str.replace(re, ($0, $1) => {
        if (num < $0.length) {
            num = $0.length;
            char = $1;
        }
    });
    console.log(`字符最多的是${char}，出现了${num}次`);
    return {
        char,
        num
    }
}
```

##  给定一个只包括 '(' ，')' ，'{' ，'}' ，'[' ，']' 的字符串，判断字符串是否有效。

* 有效字符串需满足：
* 左括号必须用相同类型的右括号闭合。
* 左括号必须以正确的顺序闭合。
* 注意空字符串可被认为是有效字符串。

```js
var isValidStr = function (str) {
    var map = {
        '{': '}',
        '[': ']',
        '(': ')'
    };
    var stack = [];
    for (let i = 0; i < str.length; i++) {
        if (map[str[i]]) {
            stack.push(str[i]);
        } else if (str[i] !== map[stack.pop()]) {
            return false;
        }
    }
    // 当遍历完成时，所有已匹配的字符都已匹配出栈，如果此时栈为空，则字符串有效，如果栈不为空，说明字符串中还有未匹配的字符，字符串无效
    return stack.length === 0;
}

// 测试结果：
isValidStr('{[()]}'); // true
isValidStr('{}()'); // true
isValidStr('{[)]}'); // false
isValidStr('([]}'); // false
```

## 删除字符串中的所有相邻重复项

- 给出由小写字母组成的字符串 S ，重复项删除操作 会选择两个相邻且相同的字母，并删除它们。
- 在 S 上反复执行重复项删除操作，直到无法继续删除。
- 在完成所有重复项删除操作后返回最终的字符串。答案保证唯一。
        
### 示例

> 输入："abbaca"
> 输出："ca"
> 解释：
> 例如，在 "abbaca" 中，我们可以删除 "bb" 由于两字母相邻且相同，这是此时唯一可以执行删除操作的重复项。之后我们得到字符串 "aaca"，其中又只有 "aa" 可以执行重复项删除操作，所以最后的字符串为 "ca"。


解法：利用栈
解题思路： 遍历字符串，依次入栈，入栈时判断与栈头元素是否一致，如果一致，即这两个元素相同相邻，则需要将栈头元素出栈，并且当前元素也无需入栈

解题步骤： 遍历字符串，取出栈头字符，判断当前字符与栈头字符是否一致

不一致，栈头字符进栈，当前字符进栈
一致，即栈头字符与当前字符相同相邻，都不需要进栈，直接进入下次遍历即可
遍历完成后，返回栈中字符串

```js
function deleteRepeatChar (str) {
    var stack = [];
    for (let s of str) {
        var prev = stack.pop();
        if (s !== prev) {
            stack.push(prev);
            stack.push(s);
        }
    }
    return stack.join('');
}

// 测试结果：
var str = 'abbaca';
deleteRepeatChar(str); // ca
str = 'abccdddaacb';
deleteRepeatChar(str); // abdcb
```

## 给定一个字符串，逐个翻转字符串中的每个单词。

示例

```
输入: "the sky is blue"
输出: "blue is sky the"

输入: "  hello world!  "
输出: "world! hello"
解释: 输入字符串可以在前面或者后面包含多余的空格，但是反转后的字符不能包括。

输入: "a good   example"
输出: "example good a"
解释: 如果两个单词间有多余的空格，将反转后单词间的空格减少到只含一个。
```

说明：

- 无空格字符构成一个单词。
- 输入字符串可以在前面或者后面包含多余的空格，但是反转后的字符不能包括。
- 如果两个单词间有多余的空格，将反转后单词间的空格减少到只含一个。


解题思路：使用双端队列解题

- 首先去除字符串左右空格
- 逐个读取字符串中的每个单词，依次放入双端队列的队头
- 再将队列转换成字符串输出（已空格为分隔符）

```javascript
var reverseWords = function (str) {
    if (!str) return;
    let left = 0;
    let right = str.length - 1;
    let queue = [];
    let word = '';
    // 去除字符串两端的空格
    while (str.charAt(left) === ' ') left++;
    while (str.charAt(right) === ' ') right--;
    // 逐个读取字符串中的每个单词，依次放入双端队列的队头
    while (left <= right) {
        let char = str.charAt(left);
        if (char === ' ' && word) {
            queue.unshift(word);
            word = '';
        } else if (char !== ' ') {
            word += char;
        }
        left++;
    }
    queue.unshift(word);
    return queue.join(' ');
}

// 测试结果：
reverseWords("the sky is blue"); // "blue is sky the"
reverseWords("  hello world!  "); // "world! hello"
reverseWords("a good   example"); // "example good a"
```

## 给定两个数组，编写一个函数来计算它们的交集

说明:

- 输出结果中的每个元素一定是唯一的。
- 我们可以不考虑输出结果的顺序。

```javascript
// 方法一：使用filter和set方法
function findIntersection (arr1, arr2) {
    return [...new Set(arr1.filter(item => arr2.includes(item)))]
}

var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection (arr1, arr2); // [2, 3]

// 方法二：使用map哈希表
function findIntersection (arr1, arr2) {
    var res = new Set();
    var set1 = new Set(arr1);
    var set2 = new Set(arr2);
    for (let item of set2) {
        if (set1.has(item)) {
            res.add(item);
        }
    }
    return [...res]
}
var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection (arr1, arr2); // [2, 3]

function findIntersection (arr1, arr2) {
    var map = {};
    var res = [];
    arr1.forEach(item => {
        map[item] = true;
    });
    arr2.forEach(item => {
        if (map[item]) {
            res.push(item)
        }
    });
    res = [...new Set(res)];
    return res;
}
var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection (arr1, arr2); // [2, 3]

// 扩展求三个数组的交集
function findThreeIntersection (arr1, arr2, arr3) {
    const map1 = new Set(arr1);
    const map2 = new Set(arr2);
    const map3 = new Set(arr3);
    const res = [];
    arr1.forEach(item => {
        if (map2.has(item) && map3.has(item)) {
            res.push(item);
        }
    });
    return [...new Set(res)];
}
var arr1 = [1, 2, 2, 3, 5];
var arr2 = [2, 3, 3, 4, 3, 5];
var arr3 = [1, 2, 3, 3, 4, 5];
findThreeIntersection (arr1, arr2, arr3); // [2, 3]
```

更多集合操作[参考Set](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Set)

## 给定一个整数数组 nums 和一个目标值 target ，请你在该数组中找出和为目标值的那 两个 整数，并返回他们的数组下标。

你可以假设每种输入只会对应一个答案。但是，你不能重复利用这个数组中同样的元素。

示例:

```
给定 nums = [2, 7, 11, 15], target = 9

因为 nums[0] + nums[1] = 2 + 7 = 9
所以返回 [0, 1]
```

解题思路：

- 初始化一个 map = new Map()
- 从第一个元素开始遍历 nums
- 获取目标值与 nums[i] 的差值，即 k = target - nums[i] ，判断差值在 map 中是否存在
- 不存在（ map.has(k) 为 false ） ，则将 nums[i] 加入到 map 中（key为nums[i], value为 i ，方便查找map中是否存在某值，并可以通过 get 方法直接拿到下标）
- 存在（ map.has(k) ），返回 [map.get(k), i] ，求解结束
- 遍历结束，则 nums 中没有符合条件的两个数，返回 []
- 时间复杂度：O(n)

```javascript
var twoSum = function (arr, target) {
    const map = new Map();
    for (let i = 0; i < arr.length; i++) {
        let k = target - arr[i];
        if (map.has(k)) {
            return [map.get(k), i];
        }
        map.set(arr[i], i)
    }
    return [];
}

// 测试结果： 
var arr = [2, 7, 11, 15];
var target = 9;
twoSum(arr, target); // [0, 1]
```

更多内容参考[字节&leetcode1：两数之和](https://github.com/sisterAn/JavaScript-Algorithms/issues/4)

## 给你一个包含 n 个整数的数组 nums，判断 nums 中是否存在三个元素 a ，b ，c ，使得 a + b + c = 0 ？请你找出所有满足条件且不重复的三元组。

注意： 答案中不可以包含重复的三元组。

示例：

```
给定数组 nums = [-1, 0, 1, 2, -1, -4]，
满足要求的三元组集合为：
[
  [-1, 0, 1],
  [-1, -1, 2]
]
```

```javascript
//这道题经典的是细节，需要考虑蛮多细节的
//解法：
//1.暴力破解，三层枚举，O（n^3）效率太低不考虑
//2.a+b+c = 0，转换思路，a+b = -c，这不就是两数之和嘛？
//3.利用双指针夹逼，但是怎么避免重复呢？
//3.1 排序即可，利用排序好的数组，固定一个指针i，夹逼选举left和right
//3.2 这道题难度在于要考虑的细节太多，多想想即可。
//3.3 扩展一下，如果是4数之和，五数之和，N数之和呢？怎么解决？
const threeSum = (nums) => {
  const len = nums.length
  const result = []
  // 因为是三数之和，小于三个不用考虑了
  if(len < 3){
    return result
  }
  nums.sort((a, b) => a - b)
  // len - 2 同样道理，小于三个不用考虑
  for(let i = 0; i < len - 2; i++){
    // 如果第一个就大于0了，三个加起来肯定大于0
    if(nums[i] > 0){
      break
    }
    // 避免掉重复的情况
    if(i && nums[i] === nums[i - 1]){
       continue
    }
    let left = i + 1
    let right = len - 1
    // 双指针夹逼
    while(left < right){
      const sum = nums[i] + nums[left] + nums[right]
      if(sum === 0){
         result.push([nums[i], nums[left++], nums[right--]])
         // push 加了之后防止还存在重复
         while(nums[left] === nums[left - 1]){
           left++
         }
         while(nums[right] === nums[right + 1]){
           right--
         } 
      }else if(sum > 0){
          right--
      }else{
          left++
      }
    }
  }
  return result
}
```

更多解答参考[腾讯&leetcode15：三数之和](https://github.com/sisterAn/JavaScript-Algorithms/issues/31)

## 洗牌算法

```js
/** 
* 洗牌算法：
* 1. 生成一个0到arr.length的随机数
* 2. 交换该随机数位置元素和数组的最后一个元素，并把改随机位置的元素放入结果数组中
* 3. 生成一个0～arr.length-1的随机数
* 4. 交换该随机数位置元素和数组的倒数第二个元素，并把该随位置的元素放入结果数组中
* 以此类推，直至取完所需的n个元素
*/
function xipai (arr, size) {
    let result = [];
    for (let i = 0; i < size; i++) {
        let index = Math.floor(Math.random() * (arr.length - i));
        result.push(arr[index]);
        [arr[index], arr[arr.length - i - 1]] = [arr[arr.length - i - 1], arr[index]];
    }
    return result;
}
```

