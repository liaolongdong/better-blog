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

## 求字符串中，出现次数最多的字符

```js
var str = "abcabcabcbbccccc";

function findMaxChar(str) {
  var num = 0;
  var char = "";

  // 使其按照一定的次序排列
  str = str.split("").sort().join("");
  // "aaabbbbbcccccccc"

  // 定义正则表达式
  var re = /(\w)\1+/g;
  str.replace(re, ($0, $1) => {
    if (num < $0.length) {
      num = $0.length;
      char = $1;
    }
  });
  console.log(`字符最多的是${char}，出现了${num}次`); // 字符最多的是c，出现了8次
  return {
    char,
    num,
  };
}
```

## 给定一个只包括 '(' ，')' ，'{' ，'}' ，'[' ，']' 的字符串，判断字符串是否有效。

- 有效字符串需满足：
- 左括号必须用相同类型的右括号闭合。
- 左括号必须以正确的顺序闭合。
- 注意空字符串可被认为是有效字符串。

```js
var isValidStr = function (str) {
  var map = {
    "{": "}",
    "[": "]",
    "(": ")",
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
};

// 测试结果：
isValidStr("{[()]}"); // true
isValidStr("{}()"); // true
isValidStr("{[)]}"); // false
isValidStr("([]}"); // false
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
function deleteRepeatChar(str) {
  var stack = [];
  for (let s of str) {
    var prev = stack.pop();
    if (s !== prev) {
      stack.push(prev);
      stack.push(s);
    }
  }
  return stack.join("");
}

// 测试结果：
var str = "abbaca";
deleteRepeatChar(str); // ca
str = "abccdddaacb";
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
reverseWords("the sky is blue"); // "blue is sky the"
reverseWords("  hello world!  "); // "world! hello"
reverseWords("a good   example"); // "example good a"
```

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
- 不存在（ map.has(k) 为 false ） ，则将 nums[i] 加入到 map 中（key 为 nums[i], value 为 i ，方便查找 map 中是否存在某值，并可以通过 get 方法直接拿到下标）
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
    map.set(arr[i], i);
  }
  return [];
};

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
  const len = nums.length;
  const result = [];
  // 因为是三数之和，小于三个不用考虑了
  if (len < 3) {
    return result;
  }
  nums.sort((a, b) => a - b);
  // len - 2 同样道理，小于三个不用考虑
  for (let i = 0; i < len - 2; i++) {
    // 如果第一个就大于0了，三个加起来肯定大于0
    if (nums[i] > 0) {
      break;
    }
    // 避免掉重复的情况
    if (i && nums[i] === nums[i - 1]) {
      continue;
    }
    let left = i + 1;
    let right = len - 1;
    // 双指针夹逼
    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left++], nums[right--]]);
        // push 加了之后防止还存在重复
        while (nums[left] === nums[left - 1]) {
          left++;
        }
        while (nums[right] === nums[right + 1]) {
          right--;
        }
      } else if (sum > 0) {
        right--;
      } else {
        left++;
      }
    }
  }
  return result;
};
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
function xipai(arr, size) {
  let result = [];
  for (let i = 0; i < size; i++) {
    let index = Math.floor(Math.random() * (arr.length - i));
    result.push(arr[index]);
    [arr[index], arr[arr.length - i - 1]] = [
      arr[arr.length - i - 1],
      arr[index],
    ];
  }
  return result;
}
```
