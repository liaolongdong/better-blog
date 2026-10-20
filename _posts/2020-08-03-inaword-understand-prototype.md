---
layout: post
title: 一句话理解原型和原型链
subtitle: 一句话理解原型和原型链
seo_description: 一句话理解原型和原型链：每个对象的 proto 指向其构造函数的 prototype，每个函数都有 prototype，函数本身也是对象，所有函数对象的 proto 都指向 Function。
date: 2020-08-03
categories: [JavaScript]
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript 原型和原型链
tldr: '实例对象的 __proto__ 指向构造函数的 prototype，函数自己也是对象所以两个属性都有；原型链一路查到 Object.prototype 的 __proto__ 为 null，还没命中就返回 undefined，用实例覆盖 Child.prototype 后得手动补 constructor。'
faq:
  - q: '为什么 person.prototype 打出来是 undefined？'
    a: '实例对象没有 prototype 属性，这个属性只有函数才有。person 身上能拿到的是私有的 __proto__，它指向构造函数的原型，所以 person.__proto__ === Person.prototype 才是 true。'
  - q: '写了 Child.prototype = person 之后，Child.prototype.constructor === Child 为什么变成 false？'
    a: '因为那行代码把 Child 构造函数的原型整个重写成了 person 这个实例，constructor 就不再指向 Child，等式自然为 false。办法是再手动设置一次 Child.prototype.constructor = Child。'
  - q: 'Function.prototype 和 Object.prototype 是什么关系？'
    a: 'Function.prototype 本身也是 Object 构造函数的一个实例对象，所以 Function.prototype.__proto__ === Object.prototype 为 true。反过来 Function、Object、Child、Person 这些函数对象的 __proto__ 又都指向 Function.prototype，因此 Function.__proto__ === Object.__proto__ 也成立，两者引用的是同一个地址。'
---

## 原型

- 每个对象都有`__proto__`属性
- 每个函数都有`prototype`原型
- 由于函数也是对象，所以函数都有这两个属性

## 原型链

- 每个对象的`__proto__`都指向它构造函数的原型(`prototype`)
- 每个函数对象的`__proto__`都指向`Function.prototype`

## 用一句话概括原型和原型链

**每个对象都有`__proto__`属性，该属性都指向它构造函数的原型(`prototype`)，每个函数都有`prototype`原型，而函数也是对象，所以函数都包含这两个属性，且所有函数对象的`__proto__`都指向`Function.prototype`**

**原型链：从实例对象中查找某一属性和方法的时候，如果实例对象本身就有查找的属性和方法，则使用该实例的，如果该实例对象上没有，则会沿着原型链(实例对象的私有属性`__proto__`)进行查找，直到Object.prototype._prototype = null，如果还没查找到，则返回undefined**

> 每个实例对象（ object ）都有一个私有属性（称之为 __proto__ ）指向它的构造函数的原型对象（prototype ）。该原型对象也有一个自己的原型对象( __proto__ ) ，层层向上直到一个对象的原型对象为 null。根据定义，null 没有原型，并作为这个原型链中的最后一个环节。

参考[继承与原型链-mdn](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)

代码实例说明如下：

```js
function Person() {};

function Child() {};

var person = new Person();

console.log(person.prototype); // undefined
// 解析：实例对象没有原型(prototype)属性
Person.prototype.constructor === Person; // true
// 解析：构造函数原型对象的constructor指向构造函数

// child原型继承person类
Child.prototype = person;
// 需要重新设置Child.prototype.constructor = Child
// Child.prototype.constructor = Child;
Child.prototype.__proto__ === Person.prototype; // true
Child.prototype.constructor === Child; // false
// 解析：此处为false的原因是因为前面那行Child.prototype = person代码重写了Child构造函数的原型，如需满足Child.prototype.constructor === Child为true，则需要重新设置Child.prototype.constructor = Child

var child = new Child();
child.__proto__ === Child.prototype; // true

person.__proto__ === Person.prototype; // true
Person.prototype.__proto__ === Object.prototype; // true

// 原型链
child.__proto__ === Child.prototype; // true
Child.prototype.__proto__ === Person.prototype; // true
Person.prototype.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null;

// 需要特别注意Function和Object之间的关系
Function.prototype.__proto__ === Object.prototype; // true
// 解析：Function.prototype原型对象其实也是Object构造函数的一个实例对象(每个对象的__proto__都指向它构造函数的原型(prototype))
Child.__proto__ === Function.prototype; // true
Person.__proto__ === Function.prototype; // true
Object.__proto__ === Function.prototype; // true
Function.__proto__ === Function.prototype; // true
// 解析：构造函数(函数对象)的__proto__都指向Function.prototype

Function.__proto__ === Object.__proto__; // true
// 解析：由于Object.__proto__ === Function.prototype和Function.__proto__ === Function.prototype都为true，所以Function.__proto__ === Object.__proto_也为true，说明它们引用地址也相同
```
