---
layout: post
title: 常见的算法题
subtitle: 常见的算法题
date: 2023-02-25
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: 常见的算法
---

# 常见的算法

## 选择排序

选择排序（Selection sort）是一种简单直观的排序算法。它的工作原理是每一次从待排序的数据元素中选出最小（或最大）的一个元素，存放在序列的起始位置，然后，再从剩余未排序元素中继续寻找最小（大）元素，然后放到已排序序列的末尾。以此类推，直到全部待排序的数据元素排完。 选择排序是不稳定的排序方法。

```js
function selectSort (arr) {
    // 如果数组长度小于2，则返回原数组
    if (arr && arr.length < 2) {
        return arr;
    }

    let index, temp;
    const len = arr.length;
    for (let i = 0; i < len - 1; i++) { // 这里使用len-1是因为最后一次最后一个值肯定是最大的了，所以没必要再执行一次循环操作
        index = i;
        for (let j = i + 1; j < len; j++) {
            if (arr[j] < arr[index]) { // 找出最小值
                index = j; // 保存最小值的索引
            }
        }
        // 交换两个值
        temp = arr[i];
        arr[i] = arr[index];
        arr[index] = temp;
    }
    return arr;
}

var arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
selectSort(arr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

## 冒泡排序

冒泡排序（Bubble Sort）一种稳定排序算法,冒泡排序算法的原理如下：

1. 比较相邻的元素。如果第一个比第二个大，就交换他们两个。
2. 对每一对相邻元素做同样的工作，从开始第一对到结尾的最后一对。在这一点，最后的元素应该会是最大的数。
3. 针对所有的元素重复以上的步骤，除了最后一个。
4. 持续每次对越来越少的元素重复上面的步骤，直到没有任何一对数字需要比较。

```js
function BubbleSort (arr) {
    // 如果数组长度小于2，则返回原数组
    if (arr && arr.length < 2) {
        return arr;
    }

    let temp;
    const len = arr.length;

    for (let i = 0; i < len - 1; i++) { // 外层循环只需比较length-1次
        for (let j = 0; j < len - 1 - i; j++) { // 内层循环，只需遍历比较未排序的
            if (arr[j] > arr[j + 1]) { // 两两比较
                // 交换值，大的值放后面
                // [arr[j + 1], arr[j]] = [arr[j], arr[j + 1]]; // 可以用es6数组语法交换值
                temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
    return arr;
}

var arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
BubbleSort(arr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

## 快速排序

快速排序（Quicksort）是对冒泡排序的一种改进。  
原理：通过一趟排序将要排序的数据分割成独立的两部分，其中一部分的所有数据都比另外一部分的所有数据都要小，然后再按此方法对这两部分数据分别进行快速排序，整个排序过程可以递归进行，以此达到整个数据变成有序序列。

```js
function quickSort(arr) {
    // 如果数组长度小于2，则返回原数组
    if (arr && arr.length < 2) {
        return arr;
    }

    let leftArr = []; // 存储小于分界值的数组
    let rightArr = []; // 存储大于等于分界值的数组
    const prev = arr.splice(0, 1)[0]; // 取出数组的第一个值作为分界值(这个分界值可以是数组中的任意一个值)
    const len = arr.length; // 数组长度必须在取出分界值之后获取
    for (let i = 0; i < len; i++) {
        arr[i] < prev ? leftArr.push(arr[i]) : rightArr.push(arr[i]);
    }
    return quickSort(leftArr).concat(prev, quickSort(rightArr));
}

var arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
quickSort(arr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

使用ES6简洁实现

```js
function quickSort (arr) {
    // 如果数组长度小于2，则返回原数组
    if (arr && arr.length < 2) {
        return arr;
    }

    const [prev, ...rest] = arr;
    return [
        ...quickSort(rest.filter(value => value < prev)), // 筛选出比prev的值小的值放在prev的左边，然后再进行递归操作
        prev,
        ...quickSort(rest.filter(value => value >= prev)), // 筛选出比prev的值大的放在prev的右边，然后再进行递归操作
    ]
}

var arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
quickSort(arr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

## 插入排序

```js
function insertSort (arr) {
    let res = [];
    res.push(arr[0]);
    for (let i = 1; i < arr.length; i++) {
        let cur = arr[i];
        for (let j = res.length; j >= 0; j++) {
            if (cur > res[j]) {
                res.splice(j + 1, 0, cur);
                break;
            }
            if (j === 0) {
                res.unshift(res[j]);
            }
        }
    }
    return res;
}
var arr = [3, 1, 5, 9, 4, 8, 7, 10, 2, 6];
insertSort(arr); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

## 二叉树的深度优先遍历、广度优先遍历、层序遍历

```javascript
const root = {
    value: 1,
    left: {
        value: 2,
        left: {
            value: 4
        },
        right: {
            value: 5
        },
    },
    right: {
        value: 3,
        left: {
            value: 6
        },
        right: {
            value: 7
        },
    },
}

// 深度优先遍历
function dfs(root) {
    const helper = (root) => {
        if (!root) return null
        console.log(root.value)
        return helper(root.left) || helper(root.right)
    }
    return helper(root)
}

// 测试结果：
dfs(root)

console.log('\n')

// 广度优先遍历
function bfs(root) {
    const queue = [root]
    while (queue.length) {
        const node = queue.shift()
        console.log(node.value)
        if (node.left) queue.push(node.left) 
        if (node.right) queue.push(node.right) 
    }
}

// 测试结果：
bfs(root)

console.log('\n')

// 层序遍历，每层生成数组
function cfs(root) {
    const ans = []
    const queue = [root]
    while (queue.length) {
        const cur = queue.length
        const level = []
        for (let i = 0; i < cur; i++) {
            const node = queue.shift()
            level.push(node.value)
            if (node.left) queue.push(node.left)
            if (node.right) queue.push(node.right)
        }
        ans.push(level)
    }
    return ans
}

// 测试结果：
cfs(root)
```

## 多叉树的层序遍历

```javascript
// 多叉树的结构
var tree = {
    val: 1,
    children: [{
        val: 2,
        children: [{
            val: 5,
            children: [{
                val: 12,
            }, ],
        }, {
            val: 6,
            children: [{
                val: 13,
            }, {
                val: 14,
            }, {
                val: 15,
            }, {
                val: 16,
            }, ],
        }, {
            val: 7,
        }, ],
    }, {
        val: 3,
        children: [{
            val: 8,
            children: [{
                val: 17,
            }, ],
        }, ],
    }, {
        val: 4,
    }, ],
};

// 实现代码
var levelOrder = function(root) {
    if (!root) {
        return [];
    }

    const ans = [];
    const queue = [root];

    while (queue.length) {
        const cnt = queue.length;
        const level = [];
        for (let i = 0; i < cnt; ++i) {
            const cur = queue.shift();
            level.push(cur.val);
            if (cur.children) {
                for (const child of cur.children) {
                    queue.push(child);
                }
            }
        }
        ans.push(level);
    }

    return ans;
};

// 测试结果：
console.log(levelOrder(tree))
```

## 反转字符串

```js
var reverseWords = function (str) {
        if (!str) return;
        let left = 0;
        let right = str.length - 1;
        let queue = [];
        let word = "";
        // 去除字符串两端的空格
        while (str.charAt(left) === " ") left++;
        while (str.charAt(right) === " ") right--;
        // 逐个读取字符串中的每个单词，依次放入双端队列的队头
        while (left <= right) {
          let char = str.charAt(left);
          if (char === " " && word) {
            queue.unshift(word);
            word = "";
          } else if (char !== " ") {
            word += char;
          }
          left++;
        }
        queue.unshift(word);
        return queue.join(" ");
      };

      // 测试结果：
      reverseWords("  hello world!  "); // "world! hello"
      reverseWords("a good   example"); // "example good a"
```