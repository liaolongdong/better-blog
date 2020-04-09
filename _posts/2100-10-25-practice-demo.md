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

function getValues (str) {
    var reg = /(?<="value":")([^"])+/g;
    var result = str && str.match(reg);
    result = result && result.join(', ');
    return result;
}
getValues(str);
```

## 递归测试

```js
// 递归测试
function digui (num) {
    if (num) {
        num--;
        digui(num);
    }
    console.log('num', num);
}
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