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

```


## 写给小蓝童鞋的代码

```js
// 写给小蓝童鞋的代码

var str = '{"alias":"aps","prefix":"powerbank","suffix":null,"suggestions":[{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank","refTag":"nb_sb_ss_i_1_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank","refTag":"nb_sb_ss_c_2_9","scopes":[{"type":"ALIAS","value":"electronics","display":"Elektronik & Foto"}],"ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank iphone","refTag":"nb_sb_ss_i_3_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank solar","refTag":"nb_sb_ss_i_4_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank 20000","refTag":"nb_sb_ss_i_5_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank anker","refTag":"nb_sb_ss_i_6_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank 30000mah","refTag":"nb_sb_ss_i_7_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank 10000","refTag":"nb_sb_ss_i_8_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank klein","refTag":"nb_sb_ss_i_9_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank usb c","refTag":"nb_sb_ss_i_10_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false},{"suggType":"KeywordSuggestion","type":"KEYWORD","value":"powerbank 20000mah","refTag":"nb_sb_ss_i_11_9","ghost":false,"help":false,"queryUnderstandingFeatures":[{"source":"QU_TOOL","annotations":[]}],"xcatOnly":false,"fallback":false,"spellCorrected":false,"blackListed":false}],"responseId":"1O2VGIO16EO05","shuffled":false}';

// 提取出value字段中的关键字
function getValues (str) {
    var reg = /(?<="value":")([^"])+/g;
    var result = str && str.match(reg);
    result = result && result.join(', ');
    return result;
}
getValues(str);


// 写给蓝宝宝的代码(通过代码换行)
function lineWrap(str) {
    if (!str) return;
    return String(str).replace(/(,|，)\s*/g, '\n');
}
// 使用示例
var str = 'B08CGQRHFH, B08CGQRHFH, B08CGQRHFH, B08CGQRHFH';
lineWrap(str);
```

## 递归测试

```js
// 递归测试
var arr = [];
var arr1 = [];
function digui (num) {
    if (num) {
        num--;
        arr.push(num);
        console.log(111, num);
        digui(num);
        console.log(222, num);
    }
	arr1.push(num);
}
digui(3);

// 测试是结果：
console.log('arr', arr);
console.log('arr1', arr1);
```

```js
// 冒泡排序
function bubleSort(arr) {
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = 0; j < arr.length - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                [arr[j + 1], arr[j]] = [arr[j], arr[j + 1]];
            }
        }
    }
    return arr
}
var arr = [12, 34, 23, 88, 25, 16];
bubleSort(arr);
```

## 在两个🔢对象中，找出满足特定条件的🔢对象

```js
var arr1 = [
    {name: '廖小新', position:'front-end', age: 18},
    {name: '廖小明', position:'back-end', age: 20},
    {name: '廖小王', position:'front-end', age: 18},
    {name: '廖小黄', position:'front-end', age: 18},
    {name: '廖小芳', position:'front-end', age: 18},
    {name: '廖小物', position:'front-end', age: 18},
]
var arr2 = [
    {name: '廖小新', position:'front-end', age: 18},
    {name: '廖小王', position:'back-end', age: 22},
    {name: '廖小明', position:'back-end', age: 20},
    {name: '廖小芳', position:'front-end', age: 18},
    {name: '廖小物', position:'back-end', age: 23},
    {name: '廖小黄', position:'front-end', age: 18},
]
// 获取相同对象的数组
function getSomeObjArr(arr1, arr2) {
    var map = new Map()
    var res = []
    for (let i = 0; i < arr1.length; i++) {
        map.set(`${arr1[i].name}&${arr1[i].position}`, i)
    }
    for (let i = 0; i < arr2.length; i++) {
        let key = `${arr2[i].name}&${arr2[i].position}`
        if (map.get(key) !== undefined) {
            res.push(arr2[i])
        }
    }
    return res
}
console.log(getSomeObjArr(arr1, arr2))
```

## 判断是否是回文数

```javascript
function isUnitStr (str) {
    let arr = str.split('');
    let head = 0
    let tail = arr.length - 1
    while (head < tail) {
        if (arr[head++] !== arr[tail--]) {
            return false
        }
        return true
    }
}

var str = 'abccba'
isUnitStr(str)
```

## 判断是否有效括号

```javascript
function isValidKuoHao (str) {
    const map = new Map()
    map.set('{', '}')
    map.set('[', ']')
    map.set('(', ')')
    
}
```

## 手动实现柯里化函数

```javascript
function curry (func) {
    return function curried (...args) {
        // 如果func传入的实参大于等于形参，则调用func自身
        if (args.length >= func.length) {
            return func.apply(this, args)
        } else {
            return function (...args1) {
                return curried.apply(this, [...args, ...args1])
            }
        }
    }
}

function sum (a, b, c) {
    return a + b + c
}

// 测试结果：
let currySum = curry(sum)
console.log(currySum(1, 2, 3)) // 6
console.log(currySum(1, 2)(3)) // 6
console.log(currySum(1)(2)(3)) // 6
```

## 测试async/await返回结果

```javascript
function p () {
    return new Promise(function (resolve, reject) {
        const num = Math.floor(Math.random() * 10)
        setTimeout(function () {
            if (num % 2) {
                resolve('resolve success')
            } else {
                reject('reject fail')
            }
        })
    })
}

async function testP () {
    try {
        const res = await p()
        console.log('res', res)
        return res
    } catch (err) {
        console.log('catch err', err)
    }
}

// 测试结果：
testP()
```

## 二分查找算法

```javascript
/**
* @desc 二分查找算法
* @param 查询的数组
* @param 查找的目标值
* @return 返回查找的索引
 */
function binarySearch(arr, target) {
    let left = 0, right = arr.length - 1;
    while(left <= right) {
        let mid = Math.floor((left + right)/2)
        if (target === arr[mid]) return mid
        if (target < arr[mid]) {
            right = mid
        }else {
            left = mid + 1
        }
    }
}

// 测试结果：
binarySearch([1,3,5,5,6,8,10,12], 1)
```

## 判断回文数或者回文字符串

```javascript
/**
 * @desc 判断回文数
 * @param {str: string}
 * @return boolean
 */
function isHuiWenStr(str = ''){
    if (str.length < 1) {
        return true
    }
    let left = 0, right = str.length - 1
    while(left < right) {
        if (str[left++] !== str[right--]) {
            return false
        }
    }
    return true
}

// 测试结果：
isHuiWenStr('1234321')
```

## 深度优先遍历、广度优先遍历、层序遍历

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
