---
layout: post
title: 2023年都结束了，你还不知道新增了哪些JS特性？
subtitle: 2023年都结束了，你还不知道新增了哪些JS特性？
date: 2023-12-29
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript ES2023 JS新特性
---

# 2023年都结束了，你还不知道新增了哪些JS特性？

ECMAScript 的版本通常每年发布一次，每个版本都会引入新的语法、功能和改进，以满足不断变化的开发需求。比如我们非常熟悉的ECMAScript 2015，也就是我们常说的ES6，ECMAScript 2023，该语言的第 14 版，进行了一些重大更改，将使我们前端er的编程体验更加轻松、简洁、高效。
 
## `Object.groupBy` 和 `Map.groupBy()`

> `Object.groupBy()` 静态方法根据提供的回调函数返回的字符串值对给定可迭代对象中的元素进行分组。返回的对象具有每个组的单独属性，其中包含组中的元素的数组。当分组名称可以用字符串表示时，应使用此方法。如果你需要使用某个任意值作为键来对元素进行分组，请改用 `Map.groupBy()` 方法。
> `Map.groupBy()` 静态方法使用提供的回调函数返回的值对给定可迭代对象中的元素进行分组。最终返回的 Map 使用测试函数返回的唯一值作为键，可用于获取每个组中的元素组成的数组。该方法主要用于对与对象相关的元素进行分组，特别是当该对象可能随时间而变化时。如果对象不变，你可以使用字符串表示它，并使用 `Object.groupBy()` 分组元素。  -- mdn

### 使用 `Object.groupBy()`

`Object.groupBy()` 为可迭代对象中的每个元素调用一次提供的 `callbackFn` 函数。回调函数应返回一个字符串或 `symbol`（不属于这两种类型的值会被强制转换为字符串），用于指示元素所属的分组。`callbackFn` 的返回值会被用作 `Map.groupBy()` 返回的对象的键。每个键都有一个相关联的数组，其中包含回调函数返回相同值的所有元素。

返回的对象中的元素和原始可迭代对象中的元素相同（不是深拷贝）。更改元素的内部结构将反映在原始可迭代对象和返回的对象中。

首先，我们定义一个包含代表各种食品库存的对象的数组。每种食品都有一个 `type` 和一个 `quantity` 属性。

```javascript
const inventory = [
  { name: "芦笋", type: "蔬菜", quantity: 5 },
  { name: "香蕉", type: "水果", quantity: 0 },
  { name: "山羊", type: "肉", quantity: 23 },
  { name: "樱桃", type: "水果", quantity: 5 },
  { name: "鱼", type: "肉", quantity: 22 },
];
```

下面的代码根据元素的 `type` 属性的值对元素进行分组。

```javascript
const result = Object.groupBy(inventory, ({ type }) => type);

/* 结果是：
{
  蔬菜: [
    { name: "芦笋", type: "蔬菜", quantity: 5 },
  ],
  水果: [
    { name: "香蕉", type: "水果", quantity: 0 },
    { name: "樱桃", type: "水果", quantity: 5 }
  ],
  肉: [
    { name: "山羊", type: "肉", quantity: 23 },
    { name: "鱼", type: "肉", quantity: 22 }
  ]
}
*/
```

箭头函数每次被调用时都只返回每个数组元素的 `type` 属性。请注意，函数参数 `{ type }` 是一个函数参数的对象解构语法的基本示例。这会解构传递为参数的对象的 `type` 属性，并将其赋值给函数体中名为 `type` 的变量。这是一种非常简洁的访问函数中相关元素的值的方式。

我们还可以创建根据元素的一个或多个属性中的值推断的分组。下面是一个非常类似的示例，根据 `quantity` 字段的值将项目分为 `ok` 或 `restock` 组。

```javascript
function myCallback({ quantity }) {
  return quantity > 5 ? "ok" : "restock";
}

const result2 = Object.groupBy(inventory, myCallback);

/* 结果是：
{
  restock: [
    { name: "芦笋", type: "蔬菜", quantity: 5 },
    { name: "香蕉", type: "水果", quantity: 0 },
    { name: "樱桃", type: "水果", quantity: 5 }
  ],
  ok: [
    { name: "山羊", type: "肉", quantity: 23 },
    { name: "鱼", type: "肉", quantity: 22 }
  ]
}
*/
```

### 使用 `Map.groupBy()`

`Map.groupBy()` 方法与 `Object.groupBy()` 相似，但它返回的是一个 `Map` 对象，而不是一个普通的对象。

`Map.groupBy()` 为可迭代对象中的每个元素调用一次提供的 `callbackFn` 函数。该回调函数应返回一个值，用以表示相关元素的分组。`callbackFn` 返回的值会被用作 `Map.groupBy()` 返回的 Map 的键。每个键都有一个相关联的数组，其中包含回调函数返回相同值的所有元素。

返回的 `Map` 中的元素和原始可迭代对象中的元素相同（不是深拷贝）。更改元素的内部结构将反映在原始可迭代对象和返回的 `Map` 中。

当你需要分组与特定对象相关的信息时，此方法非常有用。因为即使对象被修改，它仍将作为返回的 `Map` 的键继续工作。如果你改为为对象创建字符串表示形式，并在 `Object.groupBy()` 中将其用作分组键，则必须在对象改变时维护原始对象和其表示之间的映射。

```javascript
const inventory = [
  { name: "芦笋", type: "蔬菜", quantity: 9 },
  { name: "香蕉", type: "水果", quantity: 5 },
  { name: "山羊", type: "肉", quantity: 23 },
  { name: "樱桃", type: "水果", quantity: 12 },
  { name: "鱼", type: "肉", quantity: 22 },
];


const restock = { restock: true };
const sufficient = { restock: false };
const result = Map.groupBy(inventory, ({ quantity }) =>
  quantity < 10 ? restock : sufficient,
);
console.log(result.get(restock));
// [{ name: "芦笋", type: "蔬菜", quantity: 9 },{ name: "香蕉", type: "水果", quantity: 5 }]
```

`Map` 的键在修改后仍可以使用。但是，你不能重新创建键并仍然使用它。因此，任何需要使用映射的内容都保留对其键的引用是非常重要的。

```javascript
// 键被修改后仍可以使用
restock["fast"] = true;
console.log(result.get(restock));
// [{ name: "芦笋", type: "蔬菜", quantity: 9 },{ name: "香蕉", type: "水果", quantity: 5 }]

// 不能使用新的键，即使它具有相同的结构！
const restock2 = { restock: true };
console.log(result.get(restock2)); // undefined
```

## 数组新增的