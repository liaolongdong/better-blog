---
layout: post
title: 前端面试常见编程题汇总
subtitle: 前端面试常见编程题汇总
date: 2019-03-20
categories: 技术
cover: "https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1542004422750&di=bac805c49c6075c0dea87ae5aa94d5b5&imgtype=0&src=http%3A%2F%2Fwh.web.tedu.cn%2Fimg%2F201803%2F1522135004508.jpg"
tags: JavaScript 前端面试常见编程题汇总
---

# JS 编程题

## 阿里面试题(变量赋值)

```js
let a = {
  n: 1,
};
let b = a;
a.x = a = {
  n: 2,
};

console.log(a.x); // undefined
console.log(b); // {n: 1, x: {n: 2}}
```

```js
let a = 12,
  b = 12;
function fn() {
  // console.log(a, b); // Uncaught ReferenceError: Cannot access 'a' before initialization at fn
  console.log(b); // 12
  let a = (b = 13);
  console.log(a, b); // 13 13
}
fn();
console.log(a, b); // 12 13
```

```js
let i = 1;
let fn = (i) => (n) => console.log(n + ++i);
let f = fn(1);
f(2); // 4
fn(3)(4); // 8
f(5); // 8
console.log(i); // 1
```

```js
var n = 0;
function a() {
  var n = 10;
  function b() {
    n++;
    console.log(n);
  }
  b();
  return b;
}
var c = a();
c();
console.log(n);

// 11 12 0
```

参考[js 连续赋值的问题](https://www.jianshu.com/p/010c88d445b5)

## 美团面试题

```js
var obj = {
  2: 3,
  3: 4,
  length: 2,
  push: Array.prototype.push,
};
obj.push(1);
obj.push(2);
console.log(obj);
// {2: 1, 3: 2, length: 4, push: ƒ} 解析：因为对象的length为2,所以push 1 2 会覆盖2 3 的值

// 对比
var obj = {
  length: 2,
  push: Array.prototype.push,
};
obj.push(1);
obj.push(2);
obj.push(3);
console.log(obj);
// {2: 1, 3: 2, 4: 3, length: 5, push: ƒ}
```

## 阿里经典面试题(考察变量提升/静态方法/实例方法/原型方法调用)

```js
function Foo() {
  getName = function () {
    console.log(1);
  };
  return this;
}
Foo.getName = function () {
  console.log(2);
};
Foo.prototype.getName = function () {
  console.log(3);
};
var getName = function () {
  console.log(4);
};
function getName() {
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
function fn() {
  fn();
}
fn(); // Uncaught RangeError: Maximum call stack size exceeded

var num = 0;
function fn() {
  console.log(num++);
  setTimeout(fn, 1000);
}
fn(); // 可以正常执行，为什么？
// 解析：原因是因为setTImeout属于异步宏任务，不在主线程栈内存中
```

## 字节编程题

```js
const list = [1, 2, 3];
const square = (num) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(num * num);
    }, 1000);
  });
};

function test() {
  list.forEach(async (x) => {
    const res = await square(x);
    console.log(res);
  });
}
test();

// 执行结果： 1s之后输出 1 4 9

// 不能修改square方法，实现每隔一秒输出结果
const list = [1, 2, 3];
const square = (num) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(num * num);
    }, 1000);
  });
};

function test() {
  list.forEach((x, index) => {
    setTimeout(async () => {
      const res = await square(x);
      console.log(res);
    }, index * 1000);
  });
}
test();
```

## 笔者自出的立即执行函数赋值编程题

```js
var a = 111;
(function a() {
  console.log(a);
  a = 222;
  console.log(a);
})();
console.log(a);

// 输出结果：
// ƒ a() {
//   console.log(a);
//   a = 222;
//   console.log(a);
// }
// ƒ a() {
//   console.log(a);
//   a = 222;
//   console.log(a);
// }
// 111

var c = 111;
(function c(c) {
  console.log(c);
  c = 123;
  console.log(c);
})(c);
console.log(c);

// 输出结果：
// 111
// 123
// 111
```

## 快手面试编程题

> 实现 add(1)(2)(3)(4)(5).sum()和 add(1)(2, 3)(4)(5).sum()参数不定的累加效果

```js
let add = (...args) => {
  let foo = (...newArgs) => {
    return add(...args, ...newArgs);
  };
  foo.toString = () => {
    return args.reduce((a, b) => a + b);
  };
  foo.sum = () => {
    return foo.toString();
  };
  return foo;
};

// 测试结果：
console.log(add(1)(2)(3)(4)(5).sum()); // 15
console.log(add(1)(2, 3)(4)(5).sum()); // 15

// 优化版代码
let add = (...args) => {
  let foo = (...newArgs) => {
    return add(...args, ...newArgs);
  };
  foo.sum = () => {
    return args.reduce((a, b) => a + b);
  };
  return foo;
};

// 测试结果：
console.log(add(1)(2)(3)(4)(5).sum()); // 15
console.log(add(1)(2, 3)(4)(5).sum()); // 15
```

## 求字符串'(1+2)*3'运算结果(携程面试题)

方法一：使用`eval`方法

```js
// 非严格模式下
let str = '(1+2)*3';
let result = eval(str);
console.log(result);

// 严格模式下报错：Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'strict-dynamic'
```

方法二：使用`new Funciton`方法

```js
// 非严格模式下
let str = '(1+2)*3';
function strCalc(str) {
  return new Function(`return ${str}`)();
}
let result = strCalc(str);
console.log(result);

// 严格模式下报错：Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'strict-dynamic'
```

方法三：利用`script`标签内容为可执行代码

```js
let str = '(1+2)*3';
function strCalc(str) {
  let myScript = document.createElement('script');
  myScript.innerHTML = `window.golal_calc_result=${str}`; // 把执行结果保存到全局对象
  document.body.appendChild(myScript);
  document.body.removeChild(myScript);
}
strCalc(str);
console.log(window.golal_calc_result);
```

## 考察 JS 事件循环微任务和宏任务

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
});
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
var promise = new Promise(function (resolve, reject) {
  setTimeout(function () {
    console.log(1);
    resolve();
  }, 3000);
});
promise
  .then(function () {
    setTimeout(function () {
      console.log(2);
    }, 2000);
  })
  .then(function () {
    setTimeout(function () {
      console.log(3);
    }, 1000);
  })
  .then(function () {
    setTimeout(function () {
      console.log(4);
    }, 0);
  });
// 输出结果：3s后输出1和4，再过1s输出3，再过1s输出2
// 解析：promise.then()方法要等resolve()执行以后，才会执行后面的then方法，后面的这些方法按定时器异步流程处理
```

[了解更多](https://www.cnblogs.com/wangziye/p/9566454.html)

## async/await 和 setTimeout 以及 promise(字节面试题)

```js
async function async1() {
  console.log("async1 start");
  await async2();
  console.log(`async1 end`);
}

async function async2() {
  console.log("async2");
}

console.log("script start");

setTimeout(() => {
  console.log("setTimeout");
}, 0);

async1();

new Promise((resolve, reject) => {
  console.log("promise1");
  resolve();
}).then(() => {
  console.log("promise2");
});

console.log("script end");

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

## promise串行问题（腾讯文档）

```js
let promiseArr = [
  () => {
    return new Promise(res => {
      console.log('run 1', Date.now());
      res('run 1 resolve');
    });
  },
  () => {
    return new Promise(res => {
      console.log('run 2', Date.now());
      res('run 2 resolve');
    });
  },
  () => {
    return new Promise(res => {
      console.log('run 3', Date.now());
      res('run 3 resolve');
    });
  },
]

async function fn () {
  for (let i = 0; i < promiseArr.length; i++) {
    // 串行打印console.log;
    // await promiseArr[i]();
    // 串行打印console.log并执行resolve
    await promiseArr[i]().then((value) => {
      console.log(value);
    });
  }
}
fn();
```

## 事件循环(字节面试题)

```js
function test () {
  console.log(1);
  Promise.resolve().then(test);
}
test();
setTimeout(() => {console.log(2)}, 0)

// 打印结果：
// 一直输出1 不会执行setTimeout里面的回调函数
```

## promise、async/await

```js
async function fn() {
    let data = await (() => 4)();
    console.log(data);
}
console.log(1);
new Promise(resolve => resolve(console.log(2))).then(data => console.log(data));
console.log(3);
fn();

// 打印结果：
// 1
// 2
// 3
// undefined
// 4
// Promise {<fulfilled>: undefined}
```

```js
// 字节面试题
new Promise((reslove, reject) => {
    reject();
}).then(null, () => {
    console.log(1);
}).then(() => {
    console.log(2);
}).then(() => {
    console.log(3);
});

// 打印结果： 1 2 3
```

```js
new Promise((reslove, reject) => {
    reject();
}).then(null, () => {
    console.log(1);
}).then(() => {
    new Promise((reslove, reject) => {
        reject();
    }).then(null, () => {
        console.log('a');
    }).then(() => {
        console.log('b');
    }).then(() => {
        console.log('c');
    })
}).then(() => {
    console.log(3);
})

// 打印结果：
// 1
// a
// 3
// b
// c
```

```js
new Promise((resolve, reject) => {
    resolve();
}).then(null, () => {
    console.log(1);
}).then(() => {
    new Promise((resolve, reject) => {
        console.log(2);
        resolve();
    }).then(null, () => {
        console.log('a');
    }).then(() => {
        console.log('b');
    }).then(() => {
        console.log('c');
    })
}).then(() => {
    console.log(3);
})

// 打印结果：
// 2
// 3
// b
// c
```

```js
new Promise((resolve, reject) => {
    reject();
}).then(null, () => {
    console.log(1);
}).then(() => {
    new Promise((resolve, reject) => {
        console.log(2);
        reject();
    }).then(null, () => {
        console.log('a');
    }).then(() => {
        console.log('b');
    }).then(() => {
        console.log('c');
    })
}).then(() => {
    console.log(3);
})
// 1
// 2
// a
// 3
// b
// c
```

## 腾讯视频编程题

```js
function foo () {
  var a = 0;
  return function () {
    console.log(a++);
  }
}
var f1 = foo(),
f2 = foo();
f1(); // 0
f1(); // 1
f2(); // 0
```

```js
function Page() {
  console.log(this);
  return this.hosts;
}
Page.hosts = ['h1'];
Page.prototype.hosts = ['h2'];
var p1 = new Page();
var p2 = Page();
console.log(p1.hosts); // undefined
console.log(p2.hosts); // Uncaught TypeError: Cannot read property 'hosts' of undefined
```

## 如果让一个不可迭代对象，变成可迭代

```js
var obj = {
  0: 0,
  1: 1,
  length: 2,
};
for (i of obj) {
  console.log(i);
}
// 报错：Uncaught TypeError: obj is not iterable

var obj = {
  0: 0,
  1: 1,
  length: 2,
  [Symbol.iterator]: Array.prototype[Symbol.iterator],
};
for (i of obj) {
  console.log(i);
}

// 原理：可迭代对象都拥有@@iterator属性
```

## 实现深拷贝

常用的简单实现方式：类型判断+递归

```js
function deepClone(obj) {
  var newObj = obj instanceof Array ? [] : {};
  for (var i in obj) {
    newObj[i] = typeof obj[i] === "object" ? deepClone(obj[i]) : obj[i];
  }
  return newObj;
}

// test
var obj = {
  number: 1,
  string: "abc",
  bool: true,
  undefined: undefined,
  null: null,
  symbol: Symbol("s"),
  arr: [1, 2, 3],
  date: new Date(),
  userInfo: {
    name: "Better",
    position: "front-end engineer",
    skill: ["React", "Vue", "Angular", "Nodejs", "mini programs"],
  },
  func: function () {
    console.log("hello better");
  },
};
console.log(deepClone(obj));
```

从打印的结果来看，这种实现方式还存在很多问题：这种方式只能实现特定的 object 的深度复制（比如对象、数组和函数），不能实现 null 以及包装对象 Number，String ，Boolean，以及 Date 对象，RegExp 对象的复制。

一行代码实现方式：结合使用`JSON.stringify()`和`JSON.parse()`

```js
var obj = {
  number: 1,
  string: "abc",
  bool: true,
  undefined: undefined,
  null: null,
  symbol: Symbol("s"),
  arr: [1, 2, 3],
  date: new Date(),
  userInfo: {
    name: "Better",
    position: "front-end engineer",
    skill: ["React", "Vue", "Angular", "Nodejs", "mini programs"],
  },
  func: function () {
    console.log("hello better");
  },
};

var copyObj = JSON.parse(JSON.stringify(obj));

console.log(copyObj);
```

从打印结果可以得出以下结论：

1. `undefined`、`symbol`、`function`类型直接被过滤掉了
2. `date`类型被自动转成了字符串类型

## 实现一个 bind 函数

原理：使用`apply()`或者`call()`方法

初始版本

```js
Function.prototype.customBind = function (context) {
  var self = this; // 保存函数的上下文
  var args = [].slice.call(arguments, 1); // 获取自定义bind函数的参数
  return function () {
    args = args.concat([].slice.call(arguments)); // 获取自定义bind函数返回函数传入的参数
    return self.apply(context, args);
  };
};

var obj = {
  name: "Better",
  position: "front-end engineer",
};
var func = function (age) {
  console.log("name", this.name);
  console.log("position", this.position);
  console.log("age", age);
};
var f = func.customBind(obj, 18);
f();
```

考虑到原型链(最终版)

```js
Function.prototype.customBind = function (context) {
  // 必须在函数上使用，否则抛出错误
  if (typeof this !== "function") {
    throw new Error(
      "Function.prototype.bind - what is trying to be bound is not callable"
    );
  }

  var self = this; // 保存函数的上下文
  var args = Array.prototype.slice.call(arguments, 1); // 获取自定义bind函数的参数

  var fNOP = function () {};

  var fBound = function () {
    var bindArgs = Array.prototype.slice.call(arguments); // 获取自定义bind函数返回函数传入的参数
    return self.apply(
      this instanceof fNOP ? this : context,
      args.concat(bindArgs)
    );
  };

  // 这里使用寄生组合继承
  fNOP.prototype = this.prototype;
  fBound.prototype = new fNOP();
  return fBound;
};

// 测试
var obj = {
  name: "Better",
  position: "front-end engineer",
};
var func = function (age) {
  console.log("name", this.name);
  console.log("position", this.position);
  console.log("age", age);
};
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
function debounce(fn, wait) {
  var timeId = null;
  return function () {
    var context = this; // 保存绑定事件的对象，如document
    var args = arguments; // 获取事件参数，如event
    timeId && clearTimeout(timeId); // 如果规定时间内（wait）再次触发事件，则清除定时器
    timeId = setTimeout(function () {
      fn.apply(context, args); // 使用apply方法把fn函数的this指向事件对象
    }, wait);
  };
}

// 测试
function func() {
  console.log(111);
}
document.addEventListener("mouseover", debounce(func, 1000));
```

如果希望立即执行一次，然后等到停止触发 n 秒后，才可以重新触发执行。

```js
function debounce(fn, wait, immediately) {
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
      }, wait);
      if (canExecute) {
        fn.apply(context, args);
      }
    } else {
      timeId = setTimeout(function () {
        fn.apply(context, args); // 使用apply方法把fn函数的this指向事件对象
      }, wait);
    }
  };
}

// 测试
function func() {
  console.log(111);
}
document.addEventListener("mouseover", debounce(func, 1000, true));
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
function throttle(fn, wait) {
  var prev = 0;
  return function () {
    var context = this;
    var args = arguments;
    var now = new Date().getTime();
    // if (!prev) prev = now;
    if (now - prev > wait) {
      // 如果时间间隔大于wait，执行函数
      fn.apply(context, args);
      prev = now; // 把当前时间赋值给前一个时间
    }
  };
}

// 测试
function func() {
  console.log(111);
}
document.addEventListener("mouseover", throttle(func, 1000));
```

使用定时器：当触发事件的时候，我们设置一个定时器，再触发事件的时候，如果定时器存在，就不执行，直到定时器执行，然后执行函数，清空定时器，这样就可以设置下个定时器。

```js
// 使用定时器
function throttle(fn, wait) {
  var timeId = null;
  return function () {
    var context = this;
    var args = arguments;
    if (!timeId) {
      // 如果没有定时器
      timeId = setTimeout(function () {
        fn.apply(context, args);
        timeId = null;
      }, wait);
    }
  };
}

// 测试
function func() {
  console.log(111);
}
document.addEventListener("mouseover", throttle(func, 1000));
```

总结：

1. 第一种事件会立刻执行，第二种事件会在 n 秒后第一次执行
2. 第一种事件停止触发后没有办法再执行事件，第二种事件停止触发后依然会再执行一次事件

[点击了解更多](https://github.com/mqyqingfeng/Blog/issues/26)

## 使用 setTimeout 实现 setInterval 功能

我们平时开发中尽量避免使用 setInterval 重复定时器，这种重复定时器的规则有两个问题：

1. 某些间隔会被跳过
2. 多个定时器的代码执行时间可能会比预期小

```js
var i = 0;
function count() {
  console.log(i++);
  setTimeout(count, 1000);
}
setTimeout(count, 1000);
```

或者使用 arguments.callee

```js
var i = 0;
setTimeout(function () {
  // do something
  console.log(i++);
  setTimeout(arguments.callee, 1000);
}, 1000);
```

## 如何实现 sleep 效果

方法一：使用 promise

```js
function sleep(time) {
  return new Promise(function (resolve, reject) {
    console.log("start");
    setTimeout(function () {
      resolve();
    }, time);
  });
}

sleep(1000).then(function () {
  console.log("end");
});
// 先输出start，延迟1000ms后输出end
```

方法二：使用 async/await

```js
function sleep(time) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      // do something
      resolve();
    }, time);
  });
}

async function test() {
  console.log("start");
  var result = await sleep(1000);
  console.log("end");
  return result;
}

test(); // 先输出start，延迟1000ms后输出end
```

方法三：使用 generate

```js
function* sleep(time) {
  yield new Promise((resolve, reject) => {
    console.log("start");
    setTimeout(() => {
      // do something
      resolve();
    }, time);
  });
}

sleep(1000)
  .next()
  .value.then(() => {
    console.log("end");
  }); // 先输出start，延迟1000ms后输出end
```

## 如何实现 a == 1 && a == 2 && a == 3 为 true

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
  },
};
console.log(a == 1 && a == 2 && a == 3); // true
```

## 实现 add(1)(2)(3)这类方法以及扩展方法

```js
// 普通写法
var add = function (a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
};

console.log(add(1)(2)(3)); // 6

// 扩展写法
function addExtend(x) {
  var sum = x;
  var temp = function (y) {
    sum = sum + y;
    return temp;
  };
  temp.toString = function () {
    return sum;
  };
  return temp;
}

console.log(addExtend(1)(2)(3)); // ƒ 6
console.log(typeof addExtend(1)(2)(3)); // function
console.log(Number(addExtend(1)(2)(3))); // 6
console.log(Number(addExtend(1)(2)(3)(4)(5))); // 15
```

## 闭包和任务队列例子

```js
for (var i = 0; i < 5; i++) {
  setTimeout(
    (function (i) {
      console.log(i);
    })(i),
    i * 1000
  );
}

// 测试结果： 立即输出0 1 2 3 4
```

```js
for (var i = 0; i < 5; i++) {
  setTimeout(function () {
    console.log(i);
  }, i * 1000);
}

// 测试结果： 立即输出5 然后每隔一秒输出5 总共输出5次
```

```js
for (let i = 0; i < 5; i++) {
  setTimeout(function () {
    console.log(i);
  }, i * 1000);
}

// 测试结果：立即输出0 然后每隔一秒分别输出1 2 3 4
```

## 使用正则表达式匹配 url 参数键值对（兼容 url 中包含多个?和#号）

```js
let reg = /([^?&#]+=[^?&#]+)/g;
let str =
  "https://c2b.brightoilonline.com/bdh5/channel.html?chelun_params=ad0bb3e5fc3b3bfeb9b53cc9686eb1aaaecb8a53e9f4a77c5ed68714123b25913219200cba48d9044c7b48325436960f42c1cde18f349ef63ab53ee791970243a8ba79f9a2dc8aa1#/chelunGasList?pcode=c2b8g717rkj603o15005&fromApp=true";

console.log(str.match(reg));
// 测试结果：["chelun_params=ad0bb3e5fc3b3bfeb9b53cc9686eb1aaaecb…f42c1cde18f349ef63ab53ee791970243a8ba79f9a2dc8aa1", "pcode=c2b8g717rkj603o15005", "fromApp=true"]

str =
  "https://c2b-test2.brightoilonline.com/bdh5/channel.html#/chelungaslist?pcode=c2b0293jm44x97an6339&fromApp=true";
console.log(str.match(reg));
// 测试结果： ["pcode=c2b0293jm44x97an6339", "fromApp=true"]

str =
  "https://c2b-test2.brightoilonline.com/bdh5/channel.html?pcode=c2b0293jm44x97an6339&fromApp=true";
console.log(str.match(reg));
// 测试结果： ["pcode=c2b0293jm44x97an6339", "fromApp=true"]
```

## 解析 URL Params 为对象

```js
let url =
  "http://www.domain.com/?user=anonymous&id=123&id=456&city=%E5%8C%97%E4%BA%AC&enabled";
parseParam(url);
/* 结果
{ user: 'anonymous',
  id: [ 123, 456 ], // 重复出现的 key 要组装成数组，能被转成数字的就转成数字类型
  city: '北京', // 中文需解码
  enabled: true, // 未指定值得 key 约定为 true
}
*/

function parseParam(url) {
  const paramsStr = /.+\?(.+)$/.exec(url)[1]; // 将 ? 后面的字符串取出来
  const paramsArr = paramsStr.split("&"); // 将字符串以 & 分割后存到数组中
  let paramsObj = {};
  // 将 params 存到对象中
  paramsArr.forEach((param) => {
    if (/=/.test(param)) {
      // 处理有 value 的参数
      let [key, val] = param.split("="); // 分割 key 和 value
      val = decodeURIComponent(val); // 解码
      val = /^\d+$/.test(val) ? parseFloat(val) : val; // 判断是否转为数字

      if (paramsObj.hasOwnProperty(key)) {
        // 如果对象有 key，则添加一个值
        paramsObj[key] = [].concat(paramsObj[key], val);
      } else {
        // 如果对象没有这个 key，创建 key 并设置值
        paramsObj[key] = val;
      }
    } else {
      // 处理没有 value 的参数
      paramsObj[param] = true;
    }
  });
  return paramsObj;
}


// 进阶：使用原生URLSearchParams对象
function optParseQuery(url) {
  const u = new URL(url)
  const sp = new URLSearchParams(u.search)
  return sp.entries()
}
console.log(optParseQuery(url))
// {
//     "user": "anonymous",
//     "id": "456",
//     "city": "北京",
//     "enabled": ""
// }
```

## 数组对象去重

```js
/**
* @param {Array} arr 去重的数组对象
* @param {String} key 根据key进行去重
* @return {Array} 去重后的数组对象
*/
// 方法一
function uniqueArrObjByKey (arr, key) {
    const map = Object.create(null)
    const res = []
    arr.forEach(item => {
        if (!map[item[key]]) {
          map[item[key]] = true
          res.push(item)
        }
    })
    return res
}

// 方法二
function uniqueArrObjByKey (arr, key) {
    const map = Object.create(null)
    const res = arr.reduce((cur, next) => {
      map[next[key]] ? '' : map[next[key]] = true && cur.push(next)
      return cur
    }, []) // 设置cur默认类型为数组，并且初始值为空的数组
    return res
}

// 测试
var arr = [{name: '廖小新', age: 18}, {name: '廖小物', age: 18}, {name: '廖小新', age: 20}, {name: '廖小物', age: 18}, {name: '廖小念', age: 18}]
console.log(uniqueArrObjByKey(arr, 'name'))
console.log(uniqueArrObjByKey(arr, 'age'))
```

## 给定两个数组，编写一个函数来计算它们的交集

说明:

- 输出结果中的每个元素一定是唯一的。
- 我们可以不考虑输出结果的顺序。

```javascript
// 方法一：使用filter和set方法
function findIntersection(arr1, arr2) {
  return [...new Set(arr1.filter((item) => arr2.includes(item)))];
}

var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection(arr1, arr2); // [2, 3]

// 方法二：使用map哈希表
function findIntersection(arr1, arr2) {
  var res = new Set();
  var set1 = new Set(arr1);
  var set2 = new Set(arr2);
  for (let item of set2) {
    if (set1.has(item)) {
      res.add(item);
    }
  }
  return [...res];
}
var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection(arr1, arr2); // [2, 3]

function findIntersection(arr1, arr2) {
  var map = {};
  var res = [];
  arr1.forEach((item) => {
    map[item] = true;
  });
  arr2.forEach((item) => {
    if (map[item]) {
      res.push(item);
    }
  });
  res = [...new Set(res)];
  return res;
}
var arr1 = [1, 2, 2, 3];
var arr2 = [2, 3, 3, 4];
findIntersection(arr1, arr2); // [2, 3]

// 扩展求三个数组的交集
function findThreeIntersection(arr1, arr2, arr3) {
  const map1 = new Set(arr1);
  const map2 = new Set(arr2);
  const map3 = new Set(arr3);
  const res = [];
  arr1.forEach((item) => {
    if (map2.has(item) && map3.has(item)) {
      res.push(item);
    }
  });
  return [...new Set(res)];
}
var arr1 = [1, 2, 2, 3, 5];
var arr2 = [2, 3, 3, 4, 3, 5];
var arr3 = [1, 2, 3, 3, 4, 5];
findThreeIntersection(arr1, arr2, arr3); // [2, 3]
```

更多集合操作[参考 Set](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Set)

## es6 尾调用-尾递归

求正整数n的阶乘

```js
function factorial (n) {
    if (n === 1) return 1
    return n * factorial(n - 1)
}
console.time()
factorial(1000)
console.timeEnd()
// default: 1.697998046875 ms
```

```js
// 使用尾递归
function factorial (n, total) {
    if (n === 1) return total
    return factorial(n - 1,  n * total) 
}
console.time()
factorial(1000, 1)
console.timeEnd()
```

[es6 尾调用-尾递归](https://blog.csdn.net/qq_30100043/article/details/53406001)
