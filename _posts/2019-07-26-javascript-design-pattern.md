---
layout: post
title: JavaScript常用设计模式总结
subtitle: JavaScript常用设计模式总结
date: 2019-07-26
categories: JavaScript 设计模式
cover: https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg
tags: JavaScript 设计模式
---

# JavaScript常用设计模式总结

## 单例模式

> 单例模式的定义是：保证一个类仅有一个实例，并提供一个访问它的全局访问点。

### 实现简单的单例模式

```js
var Singleton = function (name) {
    this.name = name;
    this.instance = null;
}
Singleton.prototype.getName = function () {
    return this.name;
}
Singleton.getInstance = function (name) {
    if (!this.instance) {
        this.instance = new Singleton(name);
    }
    return this.instance;
}

// 或者
var Singleton = function (name) {
    this.name = name;
}
Singleton.prototype.getName = function () {
    return this.name;
}
Singleton.getInstance = (function () {
    var instance = null;
    return function (name) {
        if (!instance) {
            instance = new Singleton (name);
        }
        return instance;
    }
})();

// 测试
var s1 = Singleton.getInstance('liaoxiaoxin');
var s2 = Singleton.getInstance('liaoxiaowu');
console.log(s1 === s2); // true
console.log(s1.getName()); // liaoxiaoxin
console.log(s2.getName()); // liaoxiaoxin
```

### 完整单例模式实例

创建一个登录弹窗

```js
var getSingle = function (fn) {
    var result;
    return function () {
        return result || (result = fn.apply(this, arguments));
    }
}

var createLoginLayer = function () {
    var div = document.createElement('div');
    div.innerHTML = '我是登录浮窗';
    div.style.display = 'none';
    document.body.appendChild(div);
    return div;
};

// 测试
var createSingleLoginLayer = getSingle(createLoginLayer);
```

## 策略模式

> 策略模式的定义是：定义一系列的算法，把它们一个个封装起来，并且使它们可以相互替换。

示例：很多公司的年终奖是根据员工的工资基数和年底绩效情况来发放的。例如，绩效为S 的人年终奖有4 倍工资，绩效为A 的人年终奖有3 倍工资，而绩效为B 的人年终奖是2 倍工资。假设财务部要求我们提供一段代码，来方便他们计算员工的年终奖。

### 初始版本代码

```js
var calculateBonus = function (performanceLevel, salary) {
    if (performanceLevel === 'S') {
        return salary * 4;
    }
    if (performanceLevel === 'A') {
        return salary * 3;
    }
    if (performanceLevel === 'B') {
        return salary * 2;
    }
};
calculateBonus('S', 10000); // 40000
calculateBonus('B', 10000); // 20000
```

最初版本代码的缺点：

1. 代码中包含很多条件语句  
2. 代码耦合性太高，违反了开发-封闭原则  
3. 可复用性和可扩展性太差

### 使用组合函数重构代码

```js
var performanceS = function (salary) {
    return salary * 4;
};
var performanceA = function (salary) {
    return salary * 3;
};
var performanceB = function (salary) {
    return salary * 2;
};

var calculateBonus = function (performanceLevel, salary) {
    if (performanceLevel === 'S') {
        return performanceS(salary);
    }
    if (performanceLevel === 'A') {
        return performanceA(salary);
    }
    if (performanceLevel === 'B') {
        return performanceB(salary);
    }
};
calculateBonus('A', 10000); // 30000
```

使用组合函数重构的代码，较初始版本有一定的改善，但是可复用性和可扩展性依然没有解决

### 使用策略模式重构代码

策略模式指的是定义一系列的算法，把它们一个个封装起来。将不变的部分和变化的部分隔开是每个设计模式的主题，策略模式也不例外，策略模式的目的就是将算法的使用与算法的实现分离开来。

一个基于策略模式的程序至少由两部分组成。第一个部分是一组策略类，策略类封装了具体的算法，并负责具体的计算过程。 第二个部分是环境类Context，Context 接受客户的请求，随后把请求委托给某一个策略类。要做到这点，说明Context 中要维持对某个策略对象的引用。

模拟传统面向对象语言实现方式

```js
// 实现策略类（具体算法）
var PerformanceS = function () { };
PerformanceS.prototype.calculate = function (salary) {
    return salary * 4;
};

var PerformanceA = function () { };
PerformanceA.prototype.calculate = function (salary) {
    return salary * 3;
};

var PerformanceB = function () { };
PerformanceB.prototype.calculate = function (salary) {
    return salary * 2;
};

// 实现环境类（使用算法）
var Bonus = function () {
    this.salary = null; // 原始工资
    this.strategy = null; // 绩效等级对应的策略对象
};
Bonus.prototype.setSalary = function (salary) {
    this.salary = salary; // 设置员工的原始工资
};
Bonus.prototype.setStrategy = function (strategy) {
    this.strategy = strategy; // 设置员工绩效等级对应的策略对象
};
Bonus.prototype.getBonus = function () { // 取得奖金数额
    return this.strategy.calculate(this.salary); // 把计算奖金的操作委托给对应的策略对象
};

// 使用算法
var bonus = new Bonus();
bonus.setSalary(10000);
bonus.setStrategy(new PerformanceS()); // 设置策略对象
console.log(bonus.getBonus()); // 输出：40000
bonus.setStrategy(new PerformanceA()); // 设置策略对象
console.log(bonus.getBonus()); // 输出：30000
```

JavaScript版本的策略模式

实际上在JavaScript语言中，函数也是对象，所以更简单和直接的做法是把strategy直接定义为函数，具体代码如下：

```js
// 策略类
var strategies = {
    "S": function (salary) {
        return salary * 4;
    },
    "A": function (salary) {
        return salary * 3;
    },
    "B": function (salary) {
        return salary * 2;
    }
};

// 环境类
var calculateBonus = function (level, salary) {
    return strategies[level](salary);
};
console.log(calculateBonus('S', 20000)); // 输出：80000
console.log(calculateBonus('A', 10000)); // 输出：30000


// 使用高阶函数版本
var S = function (salary) {
    return salary * 4;
};
var A = function (salary) {
    return salary * 3;
};
var B = function (salary) {
    return salary * 2;
};
var calculateBonus = function (func, salary) {
    return func(salary);
};
calculateBonus(S, 10000); // 输出：40000
```

经过改造，代码的结构变得更加简洁，而且代码的可扩展性更强了

### 使用策略模式重构表达校验

```html
<form action="" id="registerForm" method="post">
    请输入用户名：<input type="text" name="userName"/ >
    请输入密码：<input type="text" name="password"/ >
    请输入手机号码：<input type="text" name="phoneNumber"/ >
    <button>提交</button>
</form>
```

```js
// 策略类
var strategies = {
    isNonEmpty: function (value, errorMsg) { // 不为空
        if (value === '') {
            return errorMsg;
        }
    },
    minLength: function (value, length, errorMsg) { // 限制最小长度
        if (value.length < length) {
            return errorMsg;
        }
    },
    isMobile: function (value, errorMsg) { // 手机号码格式
        if (!/(^1[3|5|8][0-9]{9}$)/.test(value)) {
            return errorMsg;
        }
    }
};

// 环境类
var Validator = function () {
    this.cache = []; // 保存校验规则
};
Validator.prototype.add = function (dom, rule, errorMsg) {
    var arr = rule.split(':'); // 把strategy 和参数分开
    this.cache.push(function () { // 把校验的步骤用空函数包装起来，并且放入cache
        var strategy = arr.shift(); // 用户挑选的strategy
        arr.unshift(dom.value); // 把input 的value 添加进参数列表
        arr.push(errorMsg); // 把errorMsg 添加进参数列表
        return strategies[strategy].apply(dom, arr);
    });
};
Validator.prototype.start = function () {
    for (var i = 0, validatorFunc; validatorFunc = this.cache[i++];) {
        var msg = validatorFunc(); // 开始校验，并取得校验后的返回信息
        if (msg) { // 如果有确切的返回值，说明校验没有通过
            return msg;
        }
    }
};

// 用法
var validataFunc = function () {
    var validator = new Validator(); // 创建一个validator 对象
    /***************添加一些校验规则****************/
    validator.add(registerForm.userName, 'isNonEmpty', '用户名不能为空');
    validator.add(registerForm.password, 'minLength:6', '密码长度不能少于6位');
    validator.add(registerForm.phoneNumber, 'isMobile', '手机号码格式不正确');
    var errorMsg = validator.start(); // 获得校验结果
    return errorMsg; // 返回校验结果
}

var registerForm = document.getElementById('registerForm');
registerForm.onsubmit = function () {
    var errorMsg = validataFunc(); // 如果errorMsg 有确切的返回值，说明未通过校验
    if (errorMsg) {
        alert(errorMsg);
        return false; // 阻止表单提交
    }
};
```

上面实现的代码有一个不足之处：一个文本输入框只能对应一种校验规则，比如，用户名输入框只能校验输入是否为空：

### 给某个文本输入框添加多种校验规则

```js
/***********************策略对象**************************/
var strategies = {
    isNonEmpty: function (value, errorMsg) {
        if (value === '') {
            return errorMsg;
        }
    },
    minLength: function (value, length, errorMsg) {
        if (value.length < length) {
            return errorMsg;
        }
    },
    isMobile: function (value, errorMsg) {
        if (!/(^1[3|5|8][0-9]{9}$)/.test(value)) {
            return errorMsg;
        }
    }
};

/***********************Validator 类**************************/
var Validator = function () {
    this.cache = [];
};
Validator.prototype.add = function (dom, rules) {
    var self = this;
    for (var i = 0, rule; rule = rules[i++];) {
        (function (rule) {
            var strategyArr = rule.strategy.split(':');
            var errorMsg = rule.errorMsg;
            self.cache.push(function () {
                var strategy = strategyArr.shift();
                strategyArr.unshift(dom.value);
                strategyArr.push(errorMsg);
                return strategies[strategy].apply(dom, strategyArr);
            });
        })(rule)
    }
};
Validator.prototype.start = function () {
    for (var i = 0, validatorFunc; validatorFunc = this.cache[i++];) {
        var errorMsg = validatorFunc();
        if (errorMsg) {
            return errorMsg;
        }
    }
};

/***********************客户调用代码**************************/
var registerForm = document.getElementById('registerForm');
var validataFunc = function () {
    var validator = new Validator();
    validator.add(registerForm.userName, [{
        strategy: 'isNonEmpty',
        errorMsg: '用户名不能为空'
    }, {
        strategy: 'minLength:6',
        errorMsg: '用户名长度不能小于6位'
    }]);
    validator.add(registerForm.password, [{
        strategy: 'isNonEmpty',
        errorMsg: '密码不能为空'
    }, {
        strategy: 'minLength:6',
        errorMsg: '密码长度不能小于6位'
    }]);
    validator.add(registerForm.phoneNumber, [{
        strategy: 'isNonEmpty',
        errorMsg: '手机号码不能为空'
    }, {
        strategy: 'isMobile',
        errorMsg: '手机号码格式不正确'
    }]);
    var errorMsg = validator.start();
    return errorMsg;
}

registerForm.onsubmit = function () {
    var errorMsg = validataFunc();
    if (errorMsg) {
        alert(errorMsg);
        return false;
    }
};
```

[使用策略模式重构表单校验demo](https://liaolongdong.com/demo/designDemo/strategyFormDemo.html)

## 代理模式

> 代理模式是为一个对象提供一个代用品或占位符，以便控制对它的访问。

小明追妹纸的故事：在四月一个晴朗的早晨，小明遇见了他的百分百女孩，我们暂且称呼小明的女神为A。两天之后，小明决定给A 送一束花来表白。刚好小明打听到A 和他有一个共同的朋友B，于是内向的小明决定让B 来代替自己完成送花这件事情。

### 不使用代理模式的情况

```js
var Flower = function () { };
var xiaoming = {
    sendFlower: function (target) {
        var flower = new Flower();
        target.receiveFlower(flower);
    }
};
var A = {
    receiveFlower: function (flower) {
        console.log('收到花 ' + flower);
    }
};
xiaoming.sendFlower(A);
```

### 使用代理模式

我们引入代理B，即小明通过B 来给A 送花，假设当A 在心情好的时候收到花，小明表白成功的几率有60%，而当A 在心情差的时候收到花，小明表白的成功率无限趋近于0。小明跟A 刚刚认识两天，还无法辨别A 什么时候心情好。如果不合时宜地把花送给A，花被直接扔掉的可能性很大，这束花可是小明吃了7 天泡面换来的。但是A 的朋友B 却很了解A，所以小明只管把花交给B，B 会监听A 的心情变化，然后选择A 心情好的时候把花转交给A

```js
var Flower = function () { };
var xiaoming = {
    sendFlower: function (target) {
        var flower = new Flower();
        target.receiveFlower(flower);
    }
};
var B = {
    receiveFlower: function (flower) {
        A.listenGoodMood(function () { // 监听A 的好心情
            A.receiveFlower(flower);
        });
    }
};
var A = {
    receiveFlower: function (flower) {
        console.log('收到花 ' + flower);
    },
    listenGoodMood: function (fn) {
        setTimeout(function () { // 假设10 秒之后A 的心情变好
            fn();
        }, 10000);
    }
};
xiaoming.sendFlower(B);
```

### 保护代理和虚拟代理

代理B 可以帮助A过滤掉一些请求，比如送花的人中年龄太大的或者没有宝马的，这种请求就可以直接在代理B处被拒绝掉。这种代理叫作保护代理。A 和B 一个充当白脸，一个充当黑脸。白脸A 继续保持良好的女神形象，不希望直接拒绝任何人，于是找了黑脸B 来控制对A 的访问。

假设现实中的花价格不菲，导致在程序世界里，new Flower 也是一个代价昂贵的操作，那么我们可以把new Flower 的操作交给代理B 去执行，代理B 会选择在A 心情好时再执行new Flower，这是代理模式的另一种形式，叫作虚拟代理。虚拟代理把一些开销很大的对象，延迟到真正需要它的时候才去创建。

```js
// 使用虚拟代理
var Flower = function () { };
var xiaoming = {
    sendFlower: function (target) {
        target.receiveFlower();
    }
};
var B = {
    receiveFlower: function () {
        A.listenGoodMood(function () { // 监听A 的好心情
            var flower = new Flower(); // 延迟创建flower 对象
            A.receiveFlower(flower);
        });
    }
};
var A = {
    receiveFlower: function (flower) {
        console.log('收到花 ' + flower);
    },
    listenGoodMood: function (fn) {
        setTimeout(function () { // 假设10 秒之后A 的心情变好
            fn();
        }, 10000);
    }
};
xiaoming.sendFlower(B);
```

保护代理用于控制不同权限的对象对目标对象的访问，但在JavaScript 并不容易实现保护代理，因为我们无法判断谁访问了某个对象。而虚拟代理是最常用的一种代理模式

### 虚拟代理实现图片预加载

在Web 开发中，图片预加载是一种常用的技术，如果直接给某个img 标签节点设置src 属性，由于图片过大或者网络不佳，图片的位置往往有段时间会是一片空白。常见的做法是先用一张loading 图片占位，然后用异步的方式加载图片，等图片加载好了再把它填充到img 节点里，这种场景就很适合使用虚拟代理。

#### 不使用虚拟代理加载图片

```js
var myImage = (function () {
    var imgNode = document.createElement('img');
    document.body.appendChild(imgNode);
    return {
        setSrc: function (src) {
            imgNode.src = src;
        }
    }
})();

myImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');
```

#### 不使用虚拟代理预加载图片

```js
var myImage = (function () {
    var imgNode = document.createElement('img');
    document.body.appendChild(imgNode);
    var image = new Image();
    image.onload = function () {
        imgNode.src = image.src;
    };
    return {
        setSrc: function (src) {
            imgNode.src = 'E:/demo/liaolongdong.github.io/assets/img/profile.png';
            image.src = src;
        }
    }
})();
myImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');
```

#### 使用虚拟代理预加载图片

```js
var myImage = (function () {
    var imgNode = document.createElement('img');
    document.body.appendChild(imgNode);
    return {
        setSrc: function (src) {
            imgNode.src = src;
        }
    }
})();

// 使用虚拟代理与加载图片
var proxyImage = (function () {
    var image = new Image();
    image.onload = function () {
        myImage.setSrc(this.src);
    }
    return {
        setSrc: function (src) {
            myImage.setSrc('E:/demo/liaolongdong.github.io/assets/img/profile.png');
            image.src = src;
        }
    }
})();
proxyImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');
```

proxyImage 控制了客户对myImage 的访问，并且在此过程中加入一些额外的操作，比如在真正的图片加载好之前，先把img 节点的src 设置为一张本地的loading 图片。

单一职责原则指的是，就一个类（通常也包括对象和函数等）而言，应该仅有一个引起它变化的原因。

实际上，我们需要的只是给img 节点设置src，预加载图片只是一个锦上添花的功能。如果能把这个操作放在另一个对象里面，自然是一个非常好的方法。于是代理的作用在这里就体现出来了，代理负责预加载图片，预加载的操作完成之后，把请求重新交给本体MyImage。

#### 把代理对象和本体对象改为一个函数（函数也是对象），函数必然都能被执行，则可以认为它们也具有一致的“接口”

```js
var myImage = (function () {
    var imgNode = document.createElement('img');
    document.body.appendChild(imgNode);
    return function (src) {
        imgNode.src = src;
    }
})();

var proxyImage = (function () {
    var image = new Image();
    image.onload = function () {
        myImage(this.src);
    }
    return function (src) {
        myImage('E:/demo/liaolongdong.github.io/assets/img/profile.png');
        image.src = src;
    }
})();

proxyImage('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');
```

[使用代理模式实现图片预加载demo](https://liaolongdong.com/demo/designDemo/proxyImageDemo.html)

### 缓存代理

缓存代理可以为一些开销大的运算结果提供暂时的存储，在下次运算时，如果传递进来的参数跟之前一致，则可以直接返回前面存储的运算结果。

#### 不使用缓存代理计算乘积

```js
// 不使用缓存代理计算乘积
var multiply = function () {
    var args = arguments;
    var res = 1;
    for (var i = 0, len = arguments.length; i < len; i++) {
        res = res * arguments[i];
    }
    return res;
};
console.log(multiply(2, 3)); // 6
console.log(multiply(2, 3, 4)); // 24
```

#### 加入缓存代理计算乘积

```js
// 使用缓存代理计算乘积
var multiply = function () {
    var args = arguments;
    var res = 1;
    for (var i = 0, len = arguments.length; i < len; i++) {
        res = res * arguments[i];
    }
    return res;
};

var proxyMultiply = (function () {
    var cache = {}; // 缓存计算过的参数对应的值
    return function () {
        var args = [].join.call(arguments, ',');
        if (args in cache) {
            console.log('cache value');
            return cache[args];
        }
        return cache[args] = multiply.apply(this, arguments);
    }
})();

console.log(proxyMultiply(2, 3, 4)); // 24
console.log(proxyMultiply(2, 3, 4)); // cache value
console.log(proxyMultiply(2, 3, 4, 5)); // 120
```

传入相同计算参数时，只有第一次调用了multiply计算方法，后面调用直接从缓存中取值。通过增加缓存代理的方式，multiply函数可以继续专注于自身的职责——计算乘积，缓存的功能
是由代理对象实现的。

### 用高阶函数动态创建代理

通过传入高阶函数这种更加灵活的方式，可以为各种计算方法创建缓存代理。

```js
/**************** 计算乘积 *****************/
var mult = function () {
    var a = 1;
    for (var i = 0, l = arguments.length; i < l; i++) {
        a = a * arguments[i];
    }
    return a;
};
/**************** 计算加和 *****************/
var plus = function () {
    var a = 0;
    for (var i = 0, l = arguments.length; i < l; i++) {
        a = a + arguments[i];
    }
    return a;
};

/**************** 创建缓存代理的工厂 *****************/
var createProxyFactory = function (fn) {
    var cache = {}; // 缓存计算过的参数对应的值
    return function () {
        var args = [].join.call(arguments, ',');
        if (args in cache) {
            console.log('cache value');
            return cache[args];
        }
        return cache[args] = fn.apply(this, arguments);
    }
};

var multProxy = createProxyFactory(mult);
var plusProxy = createProxyFactory(plus);

console.log(multProxy(1, 2, 3, 4)); // 24
console.log(multProxy(1, 2, 3, 4)); // cache value 24
console.log(plusProxy(1, 2, 3, 4)); // 10
console.log(plusProxy(1, 2, 3, 4)); // cache value 10
```

