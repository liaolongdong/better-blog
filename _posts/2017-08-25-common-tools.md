---
layout: post
title: '前端开发中经常使用到的公用方法'
subtitle: '前端开发中经常使用到的公用方法'
date: 2017-08-25
categories: 技术
cover: '/assets/img/postCover/code_tools.png'
tags: JavaScript JavaScript公用方法
---

# 前端开发中经常使用到的公用方法（使用的是ES6的语法）

## 毫秒数转换成日期（格式：yyyy-mm-dd、yyyy-mm-dd hh:mm、yyyy-mm-dd hh:mm:ss）

```javascript
/** 
 * @desc 毫秒数转换成日期（格式：yyyy-mm-dd、yyyy-mm-dd hh:mm、yyyy-mm-dd hh:mm:ss）
 * @param timeStamp 时间戳毫秒数
 * @param type 默认格式为：yyyy-mm-dd 1 对应日期格式yyyy-mm-dd hh:mm  2 对应日期格式yyyy-mm-dd hh:mm:ss
 * @return 格式化日期字符串
 */
export const formatDate = (timeStamp, type) => {
  let formatDateStr = '';
  let date = new Date(timeStamp);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();
  month = month < 10 ? '0' + month : month;
  day = day < 10 ? '0' + day : day;
  hour = hour < 10 ? '0' + hour : hour;
  second = second < 10 ? '0' + second : second;
  if (type === 1) {
    formatDateStr = `${year}-${month}-${day} ${hour}:${minute}`;
  } else if (type === 2) {
    formatDateStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } else {
    formatDateStr = `${year}-${month}-${day}`;
  }
  return formatDateStr;
}
// 测试结果
console.log(formatDate(1506664038876)); // 2017-09-29
console.log(formatDate(1506664038876, 1)); // 2017-09-29 13:47
console.log(formatDate(1506664038876, 2)); // 2017-09-29 13:47:18
```

## 过去了多长时间（几秒前、几分钟前、几小时前）

```javascript
/** 
 * @desc 过去了多长时间（几秒前、几分钟前、几小时前）
 * @param timeStamp 过去时间毫秒数
 * @return 距离当前时间多久的字符串
 */
export const durationTime = (timeStamp) => {
  let durationTimeStr = '';
  let duration = (+Date.now() - timeStamp) / 1000;
  if (duration < 60) {
    durationTimeStr = `${Math.round(duration)}秒前`;
  } else if (duration >= 60 && duration < 60 * 60) {
    durationTimeStr = `${Math.round(duration / 60)}分钟前`;
  } else if (duration >= 60 * 60 && duration < 60 * 60 * 24) {
    durationTimeStr = `${Math.round(duration / 60 / 60)}小时前`;
  } else {
    // 使用上面的日期格式化formatDate方法
    durationTimeStr = formatDate(timeStamp, 2);
  }
  return durationTimeStr;
}
// 测试结果
console.log(durationTime(1506664038876)); // 10分钟前
```

## 倒计时（距离现在还有00天00小时00分钟00秒）

```javascript
/** 
 * @desc 倒计时（距离现在还有00天00小时00分钟00秒）
 * @param remainTime 剩余时间毫秒数
 * @param mountId 挂载dom节点
 * @return 距离现在还剩多长时间的字符串
 */
let futureDateTime = Date.parse('2018-10-25');
export const countDownNow = (remainTime, mountId) => {
  let intDay, intHour, intMin, intSecond, timeStr;
  let saveRemainTime = remainTime;
  remainTime = remainTime - Date.now(); // 剩余时间减去当前时间
  if(remainTime > 0) {
    intDay = Math.floor(remainTime / (24 * 60 * 60 * 1000)); // 剩余天数
    remainTime = remainTime - (intDay * 24 * 60 * 60 * 1000); // 减去剩余天数的毫秒数
    intHour = Math.floor(remainTime / (60 * 60 * 1000)); // 剩余小时数
    remainTime = remainTime - (intHour * 60 * 60 * 1000); // 减去剩余小时数的毫秒数
    intMin = Math.floor(remainTime / (60 * 1000)); // 剩余分钟数
    remainTime = remainTime - (intMin * 60 * 1000); // 减去剩余分钟数的毫秒数
    intSecond = Math.floor(remainTime / 1000); // 剩余秒数
    intDay < 10 && (intDay = '0' + intDay);
    intHour < 10 && (intHour = '0' + intHour);
    intMin < 10 && (intMin = '0' + intMin);
    intSecond < 10 && (intSecond = '0' + intSecond);
    timeStr = intDay + '天' + intHour + '时' + intMin + '分' + intSecond + '秒';
    // document.getElementById(mountId).innerText = timeStr;
    // 配合测试
    console.log('剩余时间', timeStr);
    setTimeout(function () {
      countDownNow(saveRemainTime, mountId);
    }, 1000);
  } else {
    console.log('666', timeStr);
    // document.getElementById(mountId).innerText = '该时间点已过';
  }
}

// 测试结果
countDownNow(futureDateTime, 'mountId');
// 剩余时间 284天15时34分26秒
// 剩余时间 284天15时34分22秒 .....
```

## 手机格式校验

```javascript
/** 
 * @desc 手机格式校验
 * @param phoneNum 手机号码
 * @return boolean 是否是合格的手机号
 */
export const checkPhoneNum = (phoneNum) => {
  let phoneReg = /^(0|86|17951)?(13[0-9]|15[012356789]|166|17[0-9]|18[0-9]|14[0-9])[0-9]{8}$/;
  return phoneReg.test(phoneNum);
}
// 测试结果
console.log(checkPhoneNum(13556891025)); // true
```

## 手机格式化（135 **** 1025、135-****-1025）

```javascript
/** 
 * @desc 手机格式校验
 * @param phoneNum 需要格式化的手机号
 * @param connector 格式化的连接字符
 * @return 格式化的手机号
 */ 
export const formatPhoneNum = (phoneNum, connector) => {
    let arr = phoneNum.split('');
    connector = connector || ' ';
    arr.splice(3, 0, connector);
    arr.splice(8, 0, connector);
    return arr.join('');
}
// 测试结果
console.log(formatPhoneNum('135****1025')); // '135 **** 1025'
console.log(formatPhoneNum('135****1025', '-')); // '135-****-1025'
```

## input输入框手机号码实时格式化

```javascript
/** 
 * @desc input输入框手机号码实时格式化 该方法应在实时监听input输入框变化的回调函数中使用 通过这两个值的长度大小进行比较，来区分变化是删除还是增加
 * @param prevPhoneNum为input框变化前的值
 * @param phoneNum为input当前的
 */ 
export const RTFormatPhoneNum = (prevPhoneNum, phoneNum) => {
    // 判断是否为删除
    if (prevPhoneNum < phoneNum) {
      // 输入第4位数字和时前面加空格
      if (phoneNum.length === 4) {
        phoneNum = phoneNum.split('');
        phoneNum.splice(3, 0, ' ');
        phoneNum = phoneNum.join('');
      }
      // 输入第8位数字和时前面加空格
      if (phoneNum.length === 9) {
        phoneNum = phoneNum.split('');
        phoneNum.splice(8, 0, ' ');
        phoneNum = phoneNum.join('');
      }
    } else {
      // 删除第4位数时同时删除前面的空格
      if (phoneNum.length === 4) {
        phoneNum = phoneNum.substr(0, 3);
      }
      // 删除第8位数时同时删除前面的空格
      if (phoneNum.length === 9) {
        phoneNum = phoneNum.substr(0, 8);
      }
    }
}
```

## 使用正则表达式格式化手机号

```js
/** 
 * @desc 使用正则表达式格式化手机号
 * @param phone require 需要格式化的手机号
 * @param connector option 格式化的连接字符
 * @return 返回格式化后的手机号码
 */
export const formatPhone = (phone, connector) => {
  let reg = /\B(?=(\d{4})+(?!\d))/g;
  return String(phone).replace(reg, connector || ' ');
}
// 测试结果
console.log(formatPhone(13556891025)); // 135 5689 1025
console.log(formatPhone(13556891025, '-')); // 135-5689-1025
```

## 使用正则表达式格式化银行卡号或订单号

```js
/** 
 * @desc 使用正则表达式格式化银行卡号或订单号
 * @param bankNo require 需要格式化银行卡号或订单号
 * @param connector option 格式化的连接字符
 * @return 返回格式化后的银行卡号或订单号
 */
export const formatBankNo = (bankNo, connector) => {
  let reg = /\B(?<=(?<!\d)(\d{4})+)/g;
  return String(bankNo).replace(reg, connector || ' ');
}
// 测试结果
console.log(formatBankNo('8888888888888888')); // 8888 8888 8888 8888
console.log(formatBankNo('6666666666666666666')); // 6666 6666 6666 6666 666
```

## 获取url参数(使用正则表达式)

```javascript
/** 
 * @desc 获取url参数(使用正则表达式) 如https://www.baidu.com/?id=123456&name=xiaoxin
 * @param name 要获取参数值的名称
 * @return 返回参数对应的值
 */
export const getUrlQueryString = (name) => {
  let reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
  // let r = window.location.search.substr(1).match(reg);
  // 仅测试用
  let r = 'id=123456&name=xiaoxin'.match(reg);
  if (r !== null) {
    return decodeURI(r[2]);
  } else {
    return null;
  }
}
// 测试结果
console.log(getUrlQueryString('id')); // '123456'
console.log(getUrlQueryString('name')); // 'xiaoxin'
```

## 获取url地址参数（将url参数转成对象返回）

```js
/** 
 * @desc 将url参数转成对象返回
 * @param name type: string (no-require) 参数的key，如：id
 * @param url type: string (require) url字符串， 如：https://www.baidu.com/?id=123456&name=Better&age=18
 * @return 参数对象或者某个参数的值
 */
export function urlParamToObj(name, url) {
	let obj = {};
	let a = document.createElement('a');
	// 防止url编码，使用decodeURIComponent把编码解析出来
	a.href = decodeURIComponent(url || window.location.href); // 设置默认url为当前页面地址
	let search = a.search;
	a = null;
	if (search.indexOf('?') === 0) {
		let str = search.substr(1);
		let arr = str.split('&');
		arr.forEach(item => {
			let paramArr = item.split('=');
			obj[paramArr[0]] = paramArr[1];
		});
	}
	return name ? obj[name] : obj;
}

// 测试结果：
console.log(urlParamToObj('', 'https://www.baidu.com/?id=123456&name=Better&age=18')); // {id: "123456", name: "Better", age: "18"}
console.log(urlParamToObj('name', 'https://www.baidu.com/?id=123456&name=Better&age=18')); // 'Better'
```

## 在url后面增加参数

```js
/** 
 * @desc 在url上增加参数
 * @param url type: string (require) url字符串， 如：https://www.baidu.com/?id=123456&name=Better&age=18
 * @param param type: object (require)，如：{key: value}
 * @return 返回拼接好的url字符串
 */
 export function addParamToUrl (url, param) {
    let a = document.createElement('a');
    a.href = url;
    let arr = [];
    let search = a.search;
    if (param) {
        Object.keys(param).forEach((item) => {
            if (param[item] !== '' && param[item] !== null && param[item] !== undefined) {
                arr.push(encodeURIComponent(item) + '=' + encodeURIComponent(param[item]));
            }
        });
    }
    if (arr.length !== 0) {
        search += search === '' ? '?' + arr.join('&') : '&' + arr.join('&');
    }
    let resultUrl = a.origin + a.pathname + search + a.hash;
    a = null;
    return resultUrl;
 }

 // 测试结果：
 addParamToUrl('https://www.baidu.com/?id=123456&name=Better&age=18', {from: 'wx'}); // "https://www.baidu.com/?id=123456&name=Better&age=18&from=wx"
```

### 移动端判断微信浏览器、ios、Android

>注意：微信浏览器判断要放在第一位，因为ios和android手机微信浏览器代理信息中都包含ios或者android
>也可以通过`device === ''`来判断是否为PC端浏览器

```javascript
export const whatDevice = () => {
  let device = '';
  let ua = window.navigator.userAgent.toLowerCase();
  if (/MicroMessenger/i.test(ua)) {
      device = 'wx';
  } else if (/(iPhone|iPad|iPod|iOS)/i.test(ua)) {
      device = 'ios';
  } else if (/(Android)/i.test(ua)) {
      device = 'android';
  }
  return device;
}
// 测试结果: 用的是PC端谷歌浏览器测试
console.log(whatDevice()); // ''
// 使用微信开发者工具测试
console.log(whatDevice()); // 'wx'
```

## cookie的获取、添加、删除

```javascript
/** 
 * @desc 添加cookie
 * @param name cookie名称
 * @param value cookie值
 * @param expiresHours cookie设置有效时间 单位小时
 */
export const addCookie = (name, value, expiresHours) => {
  let cookieStr = '';
  // 如果value为对象，进行序列化操作
  if (Object.prototype.toString.call(value) === '[object Object]') {
    value = JSON.stringify(value);
  }
  cookieStr = name + '=' + value;
  if (expiresHours) {
    let date = new Date();
    date.setTime(date.getTime() + expiresHours * 3600 * 1000);
    cookieStr = cookieStr + ';expires=' + date.toGMTString();
  }
  document.cookie = cookieStr + ';path=/';
}

/** 
 * @desc 获取cookie
 * @param name cookie名称
 * @return name对应的cookie值
 */
export const getCookie = (name) => {
  let arr = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)(;|$)'));
  if (arr != null) {
    if ((/^\{.*\}$/g).test(arr[2])) { // 如果cookie的值是对象，进行反序列化
      return JSON.parse(arr[2]);
    }
    return arr[2];
  }
  return null;
};

/** 
 * @desc 删除所有cookie
 */
export const clearAllCookie = () => {
  let keys = document.cookie.match(/[^ =;]+(?=\=)/g);
  console.log('keys', keys);
  if (keys) {
    for(let i = keys.length; i--;)
      document.cookie = keys[i] + '=0;domain=' + window.location.hostname +';expires=' + new Date(0).toUTCString() + ';path=/';
      console.log('cookie', document.cookie);
  }
  console.log('清除所有cookie成功');
}

// 测试结果
let userInfo = {
  naem: 'xiaoxin',
  age: 18
};
addCookie('userInfo', userInfo);
console.log(getCookie('userInfo')); // {naem: "xiaoxin", age: 18}
let userName = 'liaoxiaoxin';
addCookie('userName', userName);
console.log(getCookie('userName')); // 'liaoxiaoxin'
```

## 生成由数字和字母组合的随机字符串

```javascript
export const getNonceStr = (num) => {
  let res = '';
  let chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  for (let i = 0; i < num; i++) {
    let index = Math.ceil(Math.random() * 35);
    res += chars[index];
  }
  return res;
};

// 测试结果
console.log(getNonceStr(28)); // 'KYN4UDPK1KXOSZ9W4UARD6RT79LE'
```

## 按自然顺序排序参数对象字符串，如连接方式userName=liaoxiaoxin&age=18

```javascript
export const getParamsStr = (paramsObj) => {
  let paramsStr = '';
  const keys = Object.keys(paramsObj).sort();
  keys.map((key) => {
    paramsStr += `&${key}=${paramsObj[key]}`;
  });
  paramsStr = paramsStr.substr(1);
  return paramsStr;
};

// 测试结果
let params = {
  userName: 'xiaoxin',
  age: 18,
  position: 'front-end engineer'
}
console.log(getParamsStr(params)); // age=18&position=front-end engineer&userName=xiaoxin
```

## 禁止输入框输入表情

```javascript
// 用苹果手机亲测好像只能防止输入部分表情
export const maskEmoji = (text) => {
  let regRule = /\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g;
  if (regRule.test(text)) {
    text = text.replace(/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g, '');
    alert('不能输入表情');
  }
  return text;
};
```

## 快速排序传统实现方式

```javascript
function quickSort (arr) {
    //如果数组只有一个数，就直接返回
    if (arr.length <= 1) {
      return arr;
    }
    //找到中间数的索引值，如果是浮点数，则向下取整
    let index = Math.floor(arr.length / 2);
    //找到中间数的值
    let numValue = arr.splice(index, 1);
    const left = [];
    const right = [];
    for (let i = 0; i < arr.length; i++) {
      //基准点的左边的数传到左边数组
      if (arr[i] < numValue) {
        left.push(arr[i]);
      } else {
        //基准点的右边的数传到右边数组
        right.push(arr[i]);
      }
    }
    //递归不断重复比较
    return quickSort(left).concat([numValue], quickSort(right));
}

// 测试结果
console.log(quickSort([2, 1, 3, 5, 4])); // [1, 2, 3, 4, 5]
```

## 快速排序算法ES6简洁实现

```javascript
export const quickSort = (arr) => {
  //如果数组只有一个数，就直接返回
  if (arr.length <= 1) {
    return arr;
  }
  const [prev, ...rest] = arr;
  return [
    ...quickSort(rest.filter(value => value < prev)),
    prev,
    ...quickSort(rest.filter(value => value >= prev))
  ];
}

// 测试结果
let arr = [6, 2, 9, 4, 7, 1, 8, 3, 5, 6, 9, 3];
console.log(quickSort(arr)); // [1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9]
```

## 数组对象排序

```js
/**
 *  @desc   对象数组排序，例如按时间倒序
 *  @param  排序字段名prop，排序方式type: 正序：positive， 倒序reverse 默认倒序
 *  @return 数组排序比较函数
 */
export const objArrayCompareByProp = (prop, type = 'reverse') => {
    return (obj1, obj2) => {
        let val1 = obj1[prop];
        let val2 = obj2[prop];
        if (!isNaN(Number(val1)) && !isNaN(Number(val2))) {
            val1 = Number(val1);
            val2 = Number(val2);
        }
        if (type === 'positive') {
            return val1 - val2;
        } else {
            return val2 - val1;
        }
    };
};
// 测试结果：
let objArr = [{name: 'wangxiaowu', age: 20}, {name: 'liaoxiaoxin', age: 18}, {name: 'Better', age: 19}];
console.log(JSON.stringify(objArr.sort(objArrayCompareByProp('age')))); // [{"name":"wangxiaowu","age":20},{"name":"Better","age":19},{"name":"liaoxiaoxin","age":18}]
console.log(JSON.stringify(objArr.sort(objArrayCompareByProp('name')))); // [{"name":"wangxiaowu","age":20},{"name":"liaoxiaoxin","age":18},{"name":"Better","age":19}]
console.log(JSON.stringify(objArr.sort(objArrayCompareByProp('age', 'positive')))); // [{"name":"liaoxiaoxin","age":18},{"name":"Better","age":19},{"name":"wangxiaowu","age":20}]
```

## 短信验证码倒计时(使用setTimeout模拟setInterval)

```js
/**
 *  @desc   短信验证码倒计时(使用setTimeout模拟setInterval)
 *  @param  smsTimeout 设置的倒计时时间
 *  @param  vCodeStatus 获取验证码按钮是否可点击
 *  @param  getVCodeText 获取验证码文本
 */
timeCount () {
	this.smsTimeout--; // 时间递减
	this.vCodeStatus = false; // 短信验证码按钮是否可点击
	this.getVCodeText = `${this.smsTimeout}s后重新获取`; // 短信验证码按钮文本
	setTimeout(() => {
		if (this.smsTimeout === 0) { // 倒计时结束时退出递归
			this.vCodeStatus = true;
			this.getVCodeText = '获取验证码';
			this.smsTimeout = environment.smsTimeout; // 重置倒计时时间
		} else {
			this.timeCount(); // 递归执行自身
		}
	}, 1000)
}
```

## 持续更新中。。。

## 公用方法JS文件链接

- [平时开发中常用的公用方法](https://github.com/liaolongdong/react-comment-demo/blob/master/src/commonTool.js '平时开发中常用的公用方法')
