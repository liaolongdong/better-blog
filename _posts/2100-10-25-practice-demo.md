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
// function isSerial (str) {
//     let isSerialStr = false;
//     // 把字符串分解成数组
//     let strArr = String(str).split('');
//     strArr.every((item, index, arr) => {
//         if (arr[index] !== undefined && arr[index + 1] !== undefined) {
//             if (arr[index + 1] - arr[index] === 1) {
//                 isSerialStr = true;
//             } else {
//                 isSerialStr = false;
//             }
//         }
//     });
//     return isSerialStr;
// }

function isSerial (str) {
    if (str && str.length < 2) {
        return false;
    }
    let isSerialStr = false;
    // 把字符串分解成数组
    let strArr = String(str).split('');
    // 判断是正序连续还是倒序连续
    if (strArr[1] - strArr[0] === 1) {
        strArr.every((item, index, arr) => {
            if (arr[index] !== undefined && arr[index + 1] !== undefined) {
                if (arr[index + 1] - arr[index] === 1) {
                    isSerialStr = true;
                } else {
                    isSerialStr = false;
                }
            }
        });
    }

    if (strArr[1] - strArr[0] === -1) {
        strArr.every((item, index, arr) => {
            if (arr[index] !== undefined && arr[index + 1] !== undefined) {
                if (arr[index + 1] - arr[index] === -1) {
                    isSerialStr = true;
                } else {
                    isSerialStr = false;
                }
            }
        });
    }
    

    return isSerialStr;
}

// 测试
var str = '01234578';
isSerial(str);
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
function digui (num) {
    if (num) {
        num--;
        console.group(num);
        console.time();
        digui(num);
    }
	arr.push(num);
    console.groupEnd();
    console.timeEnd();
}
digui(3);

// 测试是结果：
console.log(arr); // [0, 0, 1, 2]
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