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

设计模式的主题总是把不变的事物和变化的事物分离开来

## 1、单例模式

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

## 2、策略模式

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

## 3、代理模式

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

代理模式包括许多小分类，在JavaScript 开发中最常用的是虚拟代理和缓存代理。

## 4、迭代器模式

> 迭代器模式是指提供一种方法顺序访问一个聚合对象中的各个元素，而又不需要暴露该对象的内部表示。迭代器模式可以把迭代的过程从业务逻辑中分离出来，在使用迭代器模式之后，即使不关心对象的内部构造，也可以按顺序访问其中的每个元素。

迭代器模式无非就是循环访问聚合对象中的各个元素。

```js
// jQuery中的$.each函数
$.each([1, 2, 3], function (i, n) {
    console.log('当前下标为：', i);
    console.log('当前值为：', n);
});

// 自己实现一个each函数
var each = function (arr, callback) {
    for (var i = 0, len = arr.length; i < len; i++) {
        callback(i, arr[i], arr);
        // callback.call(this, i, arr[i]);
    }
}
each([1, 2, 3, 5], function (i, n) {
    console.log('当前下标为：', i);
    console.log('当前值为：', n);
});
```

### 内部迭代器

编写的each 函数属于内部迭代器，each 函数的内部已经定义好了迭代规则，它完全接手整个迭代过程，外部只需要一次初始调用。

现在有个需求，要判断2 个数组里元素的值是否完全相等

```js
var each = function (arr, callback) {
    for (var i = 0, len = arr.length; i < len; i++) {
        callback(i, arr[i], arr);
        // callback.call(this, i, arr[i]);
    }
}

var compareArr = function (arr1, arr2) {
    if (arr1.length !== arr2.length) {
        throw new Error('arr1和arr2不相等');
    }
    each(arr1, function (i, n) {
        if (n !== arr2[i]) {
            throw new Error('arr1和arr2不相等');
        }
    });
    // arr1和arr2相等
    return true;
}

// 测试
var arr1 = [1, 2, 3, 4];
var arr2 = [1, 2, 3, 4];
compareArr(arr1, arr2); // true
```

### 外部迭代器

外部迭代器必须显式地请求迭代下一个元素。

外部迭代器增加了一些调用的复杂度，但相对也增强了迭代器的灵活性，我们可以手工控制
迭代的过程或者顺序。

```js
// 编写外部迭代器
var Iterator = function (obj) {
    var current = 0;

    // 执行下一步
    var next = function () {
        current++;
    }

    // 判断是否执行完
    var isDone = function () {
        return current >= obj.length;
    }

    // 获取当前迭代的值
    var getCurItem = function () {
        return obj[current];
    }

    return {
        next: next,
        isDone: isDone,
        getCurItem: getCurItem
    }
}

// 修改compareArr函数
var compareArr = function (iterator1, iterator2) {
    while (!iterator1.isDone() && !iterator2.isDone()) {
        if (iterator1.getCurItem() !== iterator2.getCurItem()) {
            throw Error('iterator1和iterator2不相等');
        }
        iterator1.next();
        iterator2.next();
    }
    console.log('iterator1和iterator2相等');
}

var iterator1 = Iterator([1, 2,, 3, 4]);
var iterator2 = Iterator([1, 2,, 3, 4]);

compareArr(iterator1, iterator2);
```

外部迭代器虽然调用方式相对复杂，但它的适用面更广，也能满足更多变的需求。内部迭代器和外部迭代器在实际生产中没有优劣之分，究竟使用哪个要根据需求场景而定。

### 中止迭代器

迭代器可以像普通for 循环中的break 一样，提供一种跳出循环的方法。

```js
var each = function (arr, callback) {
    for (var i = 0, l = arr.length; i < l; i++) {
        if (callback(i, arr[i]) === false) { // callback 的执行结果返回false，提前终止迭代
            break;
        }
    }
};
each([1, 2, 3, 4, 5], function (i, n) {
    if (n > 3) { // n 大于3 的时候终止循环
        return false;
    }
    console.log(n); // 分别输出：1, 2, 3
});
```

这里提一个问题，我们如何中止数组forEach方法呢？

```js
var arr = [1, 2, 3, 4, 5];
arr.forEach(function (v, i) {
    console.log(v); // 输出：1 2 3 4 5
    if (v > 3) {
        // return false;
        throw Error('中止遍历');
    }
    // console.log(v); // 输出：1 2 3
});

try {
    var arr = [1, 2, 3, 4, 5];
    arr.forEach(function (v, i) {
        console.log(v); // 输出：1 2 3 4 5
        if (v > 3) {
            // return false;
            throw Error('中止遍历');
        }
        console.log(v); // 输出：1 2 3
    });
} catch (e) {
    console.log(e);
}
console.log(1111);
```

## 5、发布订阅模式

> 发布—订阅模式又叫观察者模式，它定义对象间的一种一对多的依赖关系，当一个对象的状态发生改变时，所有依赖于它的对象都将得到通知。在JavaScript 开发中，我们一般用事件模型来替代传统的发布—订阅模式。

### 自定义事件

售楼示例：

现在看看如何一步步实现发布—订阅模式。  

1. 首先要指定好谁充当发布者（比如售楼处）；  
2. 然后给发布者添加一个缓存列表，用于存放回调函数以便通知订阅者（售楼处的花名册）；
3. 最后发布消息的时候，发布者会遍历这个缓存列表，依次触发里面存放的订阅者回调函数（遍历花名册，挨个发短信）。

另外，我们还可以往回调函数里填入一些参数，订阅者可以接收这些参数。这是很有必要的，比如售楼处可以在发给订阅者的短信里加上房子的单价、面积、容积率等信息，订阅者接收到这些信息之后可以进行各自的处理。

实现一个最简单的发布—订阅模式

```js
// 定义售楼处
var salesOffices = {};

// 缓存列表，存放订阅者的回调函数
salesOffices.clientList = [];

// 增加订阅者
salesOffices.listen = function (fn) {
    // 把订阅者消息添加进缓存列表
    this.clientList.push(fn);
}

// 发布消息
salesOffices.trigger = function () {
    for (var i = 0, fn; fn = this.clientList[i++];) {
        // arguments是发布消息时带上的参数
        fn.apply(this, arguments); 
    }
}

// 测试
salesOffices.listen(function (price, squareMeter) {
    console.log('价格：', price);
    console.log('面积：', squareMeter);
});
// salesOffices.listen(function (price, squareMeter) {
//     console.log('价格：', price);
//     console.log('面积：', squareMeter);
// });
// 小明订阅的消息
salesOffices.trigger(3000000, 120);
// 小红订阅的消息
salesOffices.trigger(2000000, 100);
```

至此，我们已经实现了一个最简单的发布—订阅模式，但这里还存在一些问题。我们看到订阅者接收到了发布者发布的每个消息，虽然小明只想买120平方米的房子，但是发布者把100平方米的信息也推送给了小明，这对小明来说是不必要的困扰。所以我们有必要增加一个标识key，让订阅者只订阅自己感兴趣的消息。

```js
// 定义售楼处
var salesOffices = {};

// 缓存列表，存放订阅者的回调函数
salesOffices.clientList = {};

// 增加订阅者
salesOffices.listen = function (key, fn) {
    // 如果还没有订阅过此类消息，给该类消息创建一个缓存列表
    if (!this.clientList[key]) {
        this.clientList[key] = [];
    }
    // 把订阅者消息添加进缓存列表
    this.clientList[key].push(fn);
}

// 发布消息
salesOffices.trigger = function () {
    // 取出消息类型
    var key = [].shift.call(arguments);
    // 取出该消息对应的回调函数集合
    var fns = this.clientList[key];
    // 如果没有订阅该消息，则返回
    if (!fns || fns.length === 0) {
        return;
    }
    for (var i = 0, fn; fn = fns[i++];) {
        // arguments是发布消息时带上的参数
        fn.apply(this, arguments); 
    }
}

// 测试
// 小明订阅120平方米房子的消息
salesOffices.listen('squareMeter120', function (price) {
    console.log('价格：', price);
});
// 小红订阅100平方米房子的消息
salesOffices.listen('squareMeter100', function (price) {
    console.log('价格：', price);
});
// 发布120平方米房子的价格
salesOffices.trigger('squareMeter120', 3000000);
// 发布100平方米房子的价格
salesOffices.trigger('squareMeter100', 2000000);
```

### 发布－订阅模式的通用实现

让所有对象都拥有发布—订阅功能

```js
// 编写发布订阅功能
var event = {
    // 定义缓存列表
    clientList: {},
    // 添加订阅者
    listen: function (key, fn) {
        if (!this.clientList[key]) {
            this.clientList[key] = [];
        }
        this.clientList[key].push(fn);
    },
    // 添加发布者
    trigger: function () {
        var key = [].shift.call(arguments);
        var fns = this.clientList[key];
        if (!fns || fns.length === 0) {
            return;
        }
        for (var i = 0, fn; fn = fns[i++];) {
            fn.apply(this, arguments);
        }
    }
}

// 给所有对象添加发布订阅功能方法
var installEvent = function (obj) {
    for (var i in event) {
        obj[i] = event[i];
    }
}

// 测试
var myObj = {};
installEvent(myObj);
myObj.listen('blue', function (price) {
    console.log('蓝色鞋子的价格：', price);
});
myObj.listen('white', function (price) {
    console.log('白色鞋子的价格：', price);
});
myObj.trigger('blue', 800);
myObj.trigger('white', 1000);
```

### 取消订阅的事件

有时候，我们也许需要取消订阅事件的功能。比如小明突然不想买房子了，为了避免继续接收到售楼处推送过来的短信，小明需要取消之前订阅的事件。

```js
// 编写发布订阅功能
var event = {
    // 定义缓存列表
    clientList: {},
    // 添加订阅者
    listen: function (key, fn) {
        if (!this.clientList[key]) {
            this.clientList[key] = [];
        }
        this.clientList[key].push(fn);
    },
    // 添加发布者
    trigger: function () {
        var key = [].shift.call(arguments);
        var fns = this.clientList[key];
        if (!fns || fns.length === 0) {
            return;
        }
        for (var i = 0, fn; fn = fns[i++];) {
            fn.apply(this, arguments);
        }
    },
    // 取消订阅
    remove: function (key, fn) {
        var fns = this.clientList[key];
        // 如果key 对应的消息没有被人订阅，则直接返回
        if (!fns) {
            return;
        }
        // 如果没有传入具体的回调函数，表示需要取消key 对应消息的所有订阅
        if (!fn) {
            // 清空对应key的存储的回调函数列表
            fns && (fns.length = 0);
        } else {
            // 反向遍历订阅的回调函数列表
            for (var i = fns.length - 1; i >= 0; i--) {
                if (fns[i] === fn) {
                    // 删除订阅者的回调函数
                    fns.splice(i, 1);
                }
            }
        }
    }
}

var salesOffices = {};
var installEvent = function (obj) {
    for (var i in event) {
        obj[i] = event[i];
    }
}
installEvent(salesOffices);
salesOffices.listen('squareMeter88', fn1 = function (price) { // 小明订阅消息
    console.log('价格: ' + price);
});
salesOffices.listen('squareMeter88', fn2 = function (price) { // 小红订阅消息
    console.log('价格: ' + price);
});
salesOffices.remove('squareMeter88', fn1); // 删除小明的订阅
salesOffices.trigger('squareMeter88', 2000000); // 输出：2000000
```

### 全局的发布－订阅对象

发布—订阅模式可以用一个全局的Event 对象来实现，订阅者不需要了解消息来自哪个发布者，发布者也不知道消息会推送给哪些订阅者，Event 作为一个类似“中介者”的角色，把订阅者和发布者联系起来。

```js
var Event = (function () {
    var clientList = {};
    var listen, tirgger, remove;
    // 添加订阅者
    listen = function (key, fn) {
        if (!clientList[key]) {
            clientList[key] = [];
        }
        clientList[key].push(fn);
    };
    // 添加发布者
    trigger = function () {
        var key = [].shift.call(arguments);
        var fns = clientList[key];

        if (!fns || fns.length === 0) {
            return;
        }
        for (var i = 0, fn; fn = fns[i++];) {
            fn.apply(this, arguments);
        }
    };
    // 取消订阅
    remove = function (key, fn) {
        var fns = clientList[key];
        if (!fns || fns.length === 0) {
            return
        }
        if (!fn) {
            fns.length = 0;
        } else {
            for (var i = fns.length; i >= 0; i--) {
                if (fn === fns[i]) {
                    fns.splice(i, 1);
                }
            }
        }
    };
    return {
        listen,
        trigger,
        remove
    }
})();

Event.listen('squareMeter100', fn1 = function (price) {
    console.log('squareMeter100：', price);
});
Event.listen('squareMeter100', fn2 = function (price) {
    console.log('squareMeter100：', price);
});
Event.listen('squareMeter120', function (price) {
    console.log('squareMeter120：', price);
});
// Event.remove('squareMeter100', fn1);
Event.trigger('squareMeter100', 2000000);
Event.trigger('squareMeter120', 3000000);
```

## 6、命令模式

设计模式的主题总是把不变的事物和变化的事物分离开来，命令模式也不例外。按下按钮之后会发生一些事情是不变的，而具体会发生什么事情是可变的。通过command 对象的帮助，将来我们可以轻易地改变这种关联，因此也可以在将来再次改变按钮的行为。

### 模拟面向对象简单的命令模式示例，如何把请求发送者和请求接收者解耦开的。

```js
var setCommand = function (button, command) {
    button.onclick = function () {
        command.execute();
    }
}

var MenuBar = {
    refresh: function () {
        console.log('刷新菜单目录');
    }
}

var SubMenu = {
    add: function () {
        console.log('增加子菜单');
    },
    del: function () {
        console.log('删除子菜单');
    }
}

var RefreshMenuBarCommand = function (receiver) {
    this.receiver = receiver;
}
RefreshMenuBarCommand.prototype.execute = function () {
    this.receiver.refresh();
}
var AddSubMenuCommand = function (receiver) {
    this.receiver = receiver;
}
AddSubMenuCommand.prototype.execute = function () {
    this.receiver.add();
}
var DelSubMenuCommand = function (receiver) {
    this.receiver = receiver;
}
DelSubMenuCommand.prototype.execute = function () {
    this.receiver.del();
}

var refreshMenuBarCommand = new RefreshMenuBarCommand(MenuBar);
var addSubMenuCommand = new AddSubMenuCommand(SubMenu);
var delSubMenuCommand = new DelSubMenuCommand(SubMenu);
setCommand(button1, refreshMenuBarCommand);
setCommand(button2, addSubMenuCommand);
setCommand(button3, delSubMenuCommand);
```

[使用命令模式demo](https://liaolongdong.com/demo/designDemo/commandDemo.html)

### 使用闭包实现命令模式

```js
var setCommand = function (btn, fn) {
    btn.onclick = function () {
        fn();
    }
}

var MenuBar = {
    refresh: function () {
        console.log('刷新菜单界面！！！');
    }
}

var RefreshMenuBarCommand = function (receiver) {
    return function () {
        receiver.refresh();
    }
}

var refreshMenuBarCommand = RefreshMenuBarCommand(MenuBar);

setCommand(button1, refreshMenuBarCommand);
```

### 使用execute方法

如果想更明确地表达当前正在使用命令模式，或者除了执行命令之外，将来有可能还要提供撤销命令等操作。那我们最好还是把执行函数改为调用execute 方法

```js
var setCommand = function (btn, command) {
    btn.onclick = function () {
        command.execute();
    }
}

var RefreshMenuBarCommand = function (receiver) {
    return {
        execute: function () {
            receiver.refresh();
        }
    }
}

var MenuBar = {
    refresh: function () {
        console.log('刷新菜单界面！！！！！！');
    }
}

var refreshMenuBarCommand = RefreshMenuBarCommand(MenuBar);

setCommand(button1, refreshMenuBarCommand);
```

### 使用命令模式实现撤销和重做功能

```js
// 使用命令模式实现撤销和重做功能
var Ryu = {
    attack: function () {
        console.log('攻击');
    },
    defense: function () {
        console.log('防御');
    },
    jump: function () {
        console.log('跳跃');
    },
    crouch: function () {
        console.log('蹲下');
    }
};
// 创建命令
var makeCommand = function (receiver, state) {
    return function () {
        receiver[state]();
    }
}
var commands = {
    "119": "jump", // W
    "115": "crouch", // S
    "97": "defense", // A
    "100": "attack" // D
};
var commandStack = []; // 保存命令的堆栈
document.onkeypress = function (event) {
    var keyCode = event.keyCode;
    if (keyCode !== 119 && keyCode !== 115 && keyCode !== 97 && keyCode !== 100) {
        return;
    }
    var command = makeCommand(Ryu, commands[keyCode]);
    if (command) {
        command(); // 执行命令
        commandStack.push(command); // 将刚刚执行过的命令保存进堆栈
    }
};
document.getElementById('replay').onclick = function () { // 点击播放录像
    var command;
    while (command = commandStack.shift()) { // 从堆栈里依次取出命令并执行
        command();
    }
};
```

### 宏命令

宏命令是一组命令的集合，通过执行宏命令的方式，可以一次执行一批命令。想象一下，家里有一个万能遥控器，每天回家的时候，只要按一个特别的按钮，它就会帮我们关上房间门，顺便打开电脑并登录QQ。

```js
// 宏命令
var closeDoorCommand = {
    execute: function () {
        console.log('关门');
    }
};
var openPcCommand = {
    execute: function () {
        console.log('开电脑');
    }
};
var openQQCommand = {
    execute: function () {
        console.log('登录QQ');
    }
};
// 定义宏命令
var MacroCommand = function () {
    return {
        commandsList: [],
        add: function (command) {
            this.commandsList.push(command);
        },
        execute: function () {
            for (var i = 0, command; command = this.commandsList[i++];) {
                command.execute();
            }
        }
    }
}
var macroCommand = MacroCommand();
// 添加命令
macroCommand.add(closeDoorCommand);
macroCommand.add(openPcCommand);
macroCommand.add(openQQCommand);
macroCommand.execute();
```

当然我们还可以为宏命令添加撤销功能，跟macroCommand.execute 类似，当调用macroCommand.undo 方法时，宏命令里包含的所有子命令对象要依次执行各自的undo 操作。

JavaScript 可以用高阶函数非常方便地实现命令模式。命令模式在JavaScript 语言中是一种隐形的模式。

[使用命令模式demo](https://liaolongdong.com/demo/designDemo/commandDemo.html)

## 7、组合模式

组合模式将对象组合成树形结构，以表示“部分整体”的层次结构。 除了用来表示树形结构之外，组合模式的另一个好处是通过对象的多态性表现，使得用户对单个对象和组合对象的使用具有一致性。

```js
// 结合使用组合模式实现更强大的宏命令
var MacroCommand = function () {
    return {
        commandsList: [],
        add: function (command) {
            this.commandsList.push(command);
        },
        execute: function () {
            for (var i = 0, command; command = this.commandsList[i++];) {
                command.execute();
            }
        }
    }
};
// 叶对象，叶对象不能添加子节点
var openAcCommand = {
    execute: function () {
        console.log('打开空调');
    },
    add: function () {
        throw Error('叶对象不能添加子节点');
    }
};
/********** 家里的电视和音响是连接在一起的，所以可以用一个宏命令来组合打开电视和打开音响的命令 *********/
var openTvCommand = {
    execute: function () {
        console.log('打开电视');
    }
};
var openSoundCommand = {
    execute: function () {
        console.log('打开音响');
    }
};
// 组合对象
var macroCommand1 = MacroCommand();
// openAcCommand.add(macroCommand1);
macroCommand1.add(openTvCommand);
macroCommand1.add(openSoundCommand);
/********* 关门、打开电脑和打登录QQ 的命令 ****************/
var closeDoorCommand = {
    execute: function () {
        console.log('关门');
    }
};
var openPcCommand = {
    execute: function () {
        console.log('开电脑');
    }
};
var openQQCommand = {
    execute: function () {
        console.log('登录QQ');
    }
};
var macroCommand2 = MacroCommand();
macroCommand2.add(closeDoorCommand);
macroCommand2.add(openPcCommand);
macroCommand2.add(openQQCommand);
/********* 现在把所有的命令组合成一个“超级命令” **********/
var macroCommand = MacroCommand();
macroCommand.add(openAcCommand);
macroCommand.add(macroCommand1);
macroCommand.add(macroCommand2);
/********* 最后给遥控器绑定“超级命令” **********/
var setCommand = (function (command) {
    document.getElementById('button').onclick = function () {
        command.execute();
    }
})(macroCommand);
```

### 组合模式的例子——扫描文件

```js
/******************************* Folder ******************************/
// 定义文件夹对象
var Folder = function (name) {
    this.name = name;
    this.files = [];
}
// 添加文件
Folder.prototype.add = function (file) {
    this.files.push(file);
}
// 扫描文件
Folder.prototype.scan = function () {
    console.log('开始扫描文件夹：', this.name);
    for (var i = 0, file, files = this.files; file = files[i++];) {
        file.scan();
    }
}

/******************************* File ******************************/
// 定义文件
var File = function (name) {
    this.name = name;
}
// 文件不能添加文件
File.prototype.add = function () {
    throw Error('文件不能添加文件');
}
File.prototype.scan = function () {
    console.log('开始扫描文件：', this.name);
}

// 创建一些文件夹和文件对象， 并且让它们组合成一棵树
// 创建文件夹
var folder = new Folder('前端学习资料');
var folder1 = new Folder('JavaScript');
var folder2 = new Folder('jQuery');
// 创建文件
var file1 = new File('JavaScript设计模式与开发实践');
var file2 = new File('精通jQuery');
var file3 = new File('JavasCript高级程序设计');
// 把文件添加进文件夹
folder1.add(file1);
folder2.add(file2);
folder.add(folder1);
folder.add(folder2);
folder.add(file3);
// 把移动硬盘里的文件和文件夹都复制到这棵树中
var folder3 = new Folder('Nodejs');
var file4 = new File('深入浅出Node.js');
folder3.add(file4);
var file5 = new File('JavaScript 语言精髓与编程实践');
folder.add(folder3);
folder.add(file5);
// 扫描整个文件夹
folder.scan();
```

组合模式需要注意的地方：

1. 组合模式的树型结构容易让人误以为组合对象和叶对象是父子关系，这是不正确的。  
2. 组合对象把请求委托给它所包含的所有叶对象，它们能够合作的关键是拥有相同的接口。  
3. 组合模式除了要求组合对象和叶对象拥有相同的接口之外，还有一个必要条件，就是对一组叶对象的操作必须具有一致性。

### 增加删除文件夹或者文件

```js
// 增加删除文件夹和文件
// 文件夹类
var Folder = function (name) {
    this.name = name;
    this.parent = null; // 增加this.parent 属性
    this.files = [];
};
Folder.prototype.add = function (file) {
    file.parent = this; // 设置父对象
    this.files.push(file);
};
Folder.prototype.scan = function () {
    console.log('开始扫描文件夹: ' + this.name);
    for (var i = 0, file, files = this.files; file = files[i++];) {
        file.scan();
    }
};
Folder.prototype.remove = function () {
    if (!this.parent) { // 根节点或者树外的游离节点
        return;
    }
    for (var files = this.parent.files, l = files.length - 1; l >= 0; l--) {
        var file = files[l];
        if (file === this) {
            files.splice(l, 1);
        }
    }
};
// 文件类
var File = function (name) {
    this.name = name;
    this.parent = null;
};
File.prototype.add = function () {
    throw new Error('不能添加在文件下面');
};
File.prototype.scan = function () {
    console.log('开始扫描文件: ' + this.name);
};
File.prototype.remove = function () {
    if (!this.parent) { // 根节点或者树外的游离节点
        return;
    }
    for (var files = this.parent.files, l = files.length - 1; l >= 0; l--) {
        var file = files[l];
        if (file === this) {
            files.splice(l, 1);
        }
    }
};
// 测试
var folder = new Folder('学习资料');
var folder1 = new Folder('JavaScript');
var file1 = new Folder('深入浅出Node.js');
folder1.add(new File('JavaScript 设计模式与开发实践'));
folder.add(folder1);
folder.add(file1);
folder1.remove(); //移除文件夹
folder.scan();
```

### 何时使用组合模式

组合模式如果运用得当，可以大大简化客户的代码。一般来说，组合模式适用于以下这两种
情况:

1. 表示对象的部分——整体层次结构。组合模式可以方便地构造一棵树来表示对象的部分——整体结构。特别是我们在开发期间不确定这棵树到底存在多少层次的时候。  
2. 客户希望统一对待树中的所有对象。组合模式使客户可以忽略组合对象和叶对象的区别。

## 8、模板方法模式

模板方法模式是一种只需使用继承就可以实现的非常简单的模式。

模板方法模式由两部分结构组成，第一部分是抽象父类，第二部分是具体的实现子类。通常在抽象父类中封装了子类的算法框架，包括实现一些公共方法以及封装子类中所有方法的执行顺序。子类通过继承这个抽象类，也继承了整个算法结构，并且可以选择重写父类的方法。

### 第一个例子——Coffee or Tea

#### 先泡一杯咖啡

泡咖啡的步骤通常如下：  
(1) 把水煮沸  
(2) 用沸水冲泡咖啡  
(3) 把咖啡倒进杯子  
(4) 加糖和牛奶  

```js
var Coffee = function () { };
Coffee.prototype.boilWater = function () {
    console.log('把水煮沸');
};
Coffee.prototype.brewCoffeeGriends = function () {
    console.log('用沸水冲泡咖啡');
};
Coffee.prototype.pourInCup = function () {
    console.log('把咖啡倒进杯子');
};
Coffee.prototype.addSugarAndMilk = function () {
    console.log('加糖和牛奶');
};
Coffee.prototype.init = function () {
    this.boilWater();
    this.brewCoffeeGriends();
    this.pourInCup();
    this.addSugarAndMilk();
};
var coffee = new Coffee();
coffee.init();
```

#### 泡一杯茶

泡茶的步骤跟泡咖啡的步骤相差并不大：  
(1) 把水煮沸  
(2) 用沸水浸泡茶叶  
(3) 把茶水倒进杯子  
(4) 加柠檬  

```js
var Tea = function () { };
Tea.prototype.boilWater = function () {
    console.log('把水煮沸');
};
Tea.prototype.steepTeaBag = function () {
    console.log('用沸水浸泡茶叶');
};
Tea.prototype.pourInCup = function () {
    console.log('把茶水倒进杯子');
};
Tea.prototype.addLemon = function () {
    console.log('加柠檬');
};
Tea.prototype.init = function () {
    this.boilWater();
    this.steepTeaBag();
    this.pourInCup();
    this.addLemon();
};
var tea = new Tea();
tea.init();
```

#### 分离出共同点

我们找到泡咖啡和泡茶主要有以下不同点：  
- 原料不同。一个是咖啡，一个是茶，但我们可以把它们都抽象为“饮料”。  
- 泡的方式不同。咖啡是冲泡，而茶叶是浸泡，我们可以把它们都抽象为“泡”。  
- 加入的调料不同。一个是糖和牛奶，一个是柠檬，但我们可以把它们都抽象为“调料”。  

经过抽象之后，不管是泡咖啡还是泡茶，我们都能整理为下面四步：  
(1) 把水煮沸
(2) 用沸水冲泡饮料
(3) 把饮料倒进杯子
(4) 加调料

```js
var Beverage = function () { };
Beverage.prototype.boilWater = function () {
    console.log('把水煮沸');
};
Beverage.prototype.brew = function () {
    throw new Error('子类必须重写brew 方法');  // 如果子类没有重写该方法，则抛出错误
};
Beverage.prototype.pourInCup = function () { }; // 空方法，应该由子类重写
Beverage.prototype.addCondiments = function () { }; // 空方法，应该由子类重写
Beverage.prototype.init = function () {
    this.boilWater();
    this.brew();
    this.pourInCup();
    this.addCondiments();
};
```

#### 创建Coffee 子类和Tea 子类

```js
var Coffee = function () { };
Coffee.prototype = new Beverage();
Coffee.prototype.brew = function () {
    console.log('用沸水冲泡咖啡');
};
Coffee.prototype.pourInCup = function () {
    console.log('把咖啡倒进杯子');
};
Coffee.prototype.addCondiments = function () {
    console.log('加糖和牛奶');
};
var Coffee = new Coffee();
Coffee.init();

var Tea = function () { };
Tea.prototype = new Beverage();
Tea.prototype.brew = function () {
    console.log('用沸水浸泡茶叶');
};
Tea.prototype.pourInCup = function () {
    console.log('把茶倒进杯子');
};
Tea.prototype.addCondiments = function () {
    console.log('加柠檬');
};
var tea = new Tea();
tea.init();
```

那么在上面的例子中，到底谁才是所谓的模板方法呢？答案是Beverage.prototype.init。
Beverage.prototype.init 被称为模板方法的原因是，该方法中封装了子类的算法框架，它作为一个算法的模板，指导子类以何种顺序去执行哪些方法。在Beverage.prototype.init 方法中，算法内的每一个步骤都清楚地展示在我们眼前。

### 模板方法模式的使用场景

从大的方面来讲，模板方法模式常被架构师用于搭建项目的框架，架构师定好了框架的骨架，
程序员继承框架的结构之后，负责往里面填空

### 钩子方法

钩子方法（hook）可以用来解决这个问题，放置钩子是隔离变化的一种常见手段。

```js
var Beverage = function () { };
Beverage.prototype.boilWater = function () {
    console.log('把水煮沸');
};
Beverage.prototype.brew = function () {
    throw new Error('子类必须重写brew 方法');
};
Beverage.prototype.pourInCup = function () {
    throw new Error('子类必须重写pourInCup 方法');
};
Beverage.prototype.addCondiments = function () {
    throw new Error('子类必须重写addCondiments 方法');
};
Beverage.prototype.customerWantsCondiments = function () {
    return true; // 默认需要调料
};
Beverage.prototype.init = function () {
    this.boilWater();
    this.brew();
    this.pourInCup();
    if (this.customerWantsCondiments()) { // 如果挂钩返回true，则需要调料
        this.addCondiments();
    }
};
var CoffeeWithHook = function () { };
CoffeeWithHook.prototype = new Beverage();
CoffeeWithHook.prototype.brew = function () {
    console.log('用沸水冲泡咖啡');
};
CoffeeWithHook.prototype.pourInCup = function () {
    console.log('把咖啡倒进杯子');
};
CoffeeWithHook.prototype.addCondiments = function () {
    console.log('加糖和牛奶');
};
CoffeeWithHook.prototype.customerWantsCondiments = function () {
    return window.confirm( '请问需要调料吗？' );
};
var coffeeWithHook = new CoffeeWithHook();
coffeeWithHook.init();
```

### 使用JavaScript高阶函数实模板方法模式

```js
var Beverage = function (param) {
    var boilWater = function () {
        console.log('把水煮沸');
    };
    var brew = param.brew || function () {
        throw new Error('必须传递brew 方法');
    };
    var pourInCup = param.pourInCup || function () {
        throw new Error('必须传递pourInCup 方法');
    };
    var addCondiments = param.addCondiments || function () {
        throw new Error('必须传递addCondiments 方法');
    };
    var F = function () { };
    F.prototype.init = function () {
        boilWater();
        brew();
        pourInCup();
        addCondiments();
    };
    return F;
};
var Coffee = Beverage({
    brew: function () {
        console.log('用沸水冲泡咖啡');
    },
    pourInCup: function () {
        console.log('把咖啡倒进杯子');
    },
    addCondiments: function () {
        console.log('加糖和牛奶');
    }
});
var Tea = Beverage({
    brew: function () {
        console.log('用沸水浸泡茶叶');
    },
    pourInCup: function () {
        console.log('把茶倒进杯子');
    },
    addCondiments: function () {
        console.log('加柠檬');
    }
});
var coffee = new Coffee();
coffee.init();
var tea = new Tea();
tea.init();
```

在JavaScript 中，我们很多时候都不需要依样画瓢地去实现一个模版方法模式，高阶函数是更好的选择。

## 9、享元模式

享元（flyweight）模式是一种用于性能优化的模式，“fly”在这里是苍蝇的意思，意为蝇量级。享元模式的核心是运用共享技术来有效支持大量细粒度的对象。
如果系统中因为创建了大量类似的对象而导致内存占用过高，享元模式就非常有用了。在JavaScript 中，浏览器特别是移动端的浏览器分配的内存并不算多，如何节省内存就成了一件非常有意义的事情。

### 内衣的例子

假设有个内衣工厂，目前的产品有50 种男式内衣和50 种女士内衣，为了推销产品，工厂决定生产一些塑料模特来穿上他们的内衣拍成广告照片。 正常情况下需要50 个男模特和50 个女模特，然后让他们每人分别穿上一件内衣来拍照。不使用享元模式的情况下，在程序里也许会这样写：

```js
var Model = function (sex, underwear) {
    this.sex = sex;
    this.underwear = underwear;
};
Model.prototype.takePhoto = function () {
    console.log('sex= ' + this.sex + ' underwear=' + this.underwear);
};
for (var i = 1; i <= 50; i++) {
    var maleModel = new Model('male', 'underwear' + i);
    maleModel.takePhoto();
};
for (var j = 1; j <= 50; j++) {
    var femaleModel = new Model('female', 'underwear' + j);
    femaleModel.takePhoto();
};
```

现在一共有50 种男内衣和50 种女内衣，所以一共会产生100 个对象。如果将来生产了10000 种内衣，那这个程序可能会因为存在如此多的对象已经提前崩溃。

下面我们来考虑一下如何优化这个场景。虽然有100 种内衣，但很显然并不需要50 个男模特和50 个女模特。其实男模特和女模特各自有一个就足够了，他们可以分别穿上不同的内衣来拍照。

```js
var Model = function (sex) {
    this.sex = sex;
};
Model.prototype.takePhoto = function () {
    console.log('sex= ' + this.sex + ' underwear=' + this.underwear);
};
// 分别创建一个男模特对象和一个女模特对象
var maleModel = new Model('male'),
    femaleModel = new Model('female');
// 给男装拍照
for (var i = 1; i <= 50; i++) {
    maleModel.underwear = 'underwear' + i;
    maleModel.takePhoto();
};
// 给女装拍照
for (var j = 1; j <= 50; j++) {
    femaleModel.underwear = 'underwear' + j;
    femaleModel.takePhoto();
};
```

可以看到，改进之后的代码，只需要两个对象便完成了同样的功能。

享元模式要求将对象的属性划分为内部状态与外部状态（状态在这里通常指属性）。享元模式的目标是尽量减少共享对象的数量，关于如何划分内部状态和外部状态，下面的几条经验提供了一些指引。
- 内部状态存储于对象内部。  
- 内部状态可以被一些对象共享。  
- 内部状态独立于具体的场景，通常不会改变。  
- 外部状态取决于具体的场景，并根据场景而变化，外部状态不能被共享。  
这样一来，我们便可以把所有内部状态相同的对象都指定为同一个共享的对象。而外部状态可以从对象身上剥离出来，并储存在外部。

使用享元模式的关键是如何区别内部状态和外部状态。可以被对象共享的属性通常被划分为内部状态，如同不管什么样式的衣服，都可以按照性别不同，穿在同一个男模特或者女模特身上，模特的性别就可以作为内部状态储存在共享对象的内部。而外部状态取决于具体的场景，并根据场景而变化，就像例子中每件衣服都是不同的，它们不能被一些对象共享，因此只能被划分为外部状态。

### 享元模式使用场景

享元模式带来的好处很大程度上取决于如何使用以及何时使用，一般来说，以下情况发生时便可以使用享元模式。
- 一个程序中使用了大量的相似对象。  
- 由于使用了大量对象，造成很大的内存开销。  
- 对象的大多数状态都可以变为外部状态。  
- 剥离出对象的外部状态之后，可以用相对较少的共享对象取代大量对象。  


## 10、职责链模式

> 职责链模式的定义是：使多个对象都有机会处理请求，从而避免请求的发送者和接收者之间的耦合关系，将这些对象连成一条链，并沿着这条链传递该请求，直到有一个对象处理它为止。

假设我们负责一个售卖手机的电商网站，经过分别交纳500 元定金和200 元定金的两轮预定后（订单已在此时生成），现在已经到了正式购买的阶段。
公司针对支付过定金的用户有一定的优惠政策。在正式购买后，已经支付过500 元定金的用户会收到100 元的商城优惠券，200 元定金的用户可以收到50 元的优惠券，而之前没有支付定金的用户只能进入普通购买模式，也就是没有优惠券，且在库存有限的情况下不一定保证能买到。

- orderType：表示订单类型（定金用户或者普通购买用户），code 的值为1 的时候是500 元定金用户，为2 的时候是200 元定金用户，为3 的时候是普通购买用户。  
- pay：表示用户是否已经支付定金，值为true 或者false, 虽然用户已经下过500 元定金的订单，但如果他一直没有支付定金，现在只能降级进入普通购买模式。  
- stock：表示当前用于普通购买的手机库存数量，已经支付过500 元或者200 元定金的用户不受此限制。

初始版本

```js
var order = function (orderType, pay, stock) {
    if (orderType === 1) { // 500 元定金购买模式
        if (pay === true) { // 已支付定金
            console.log('500 元定金预购, 得到100 优惠券');
        } else { // 未支付定金，降级到普通购买模式
            if (stock > 0) { // 用于普通购买的手机还有库存
                console.log('普通购买, 无优惠券');
            } else {
                console.log('手机库存不足');
            }
        }
    }
    else if (orderType === 2) { // 200 元定金购买模式
        if (pay === true) {
            console.log('200 元定金预购, 得到50 优惠券');
        } else {
            if (stock > 0) {
                console.log('普通购买, 无优惠券');
            } else {
                console.log('手机库存不足');
            }
        }
    }
    else if (orderType === 3) {
        if (stock > 0) {
            console.log('普通购买, 无优惠券');
        } else {
            console.log('手机库存不足');
        }
    }
};
order(1, true, 500); // 输出： 500 元定金预购, 得到100 优惠券
order(2, true, 500); // 输出： 200 元定金预购, 得到50 优惠券
```

order 函数不仅巨大到难以阅读，而且需要经常进行修改。虽然目前项目能正常运行，但接下来的维护工作无疑是个梦魇。恐怕只有最“新手”的程序员才会写出这样的代码。

### 使用职责链模式重构代码

```js
// 500 元订单
var order500 = function (orderType, pay, stock) {
    if (orderType === 1 && pay === true) {
        console.log('500 元定金预购, 得到100 优惠券');
    } else {
        order200(orderType, pay, stock); // 将请求传递给200 元订单
    }
};
// 200 元订单
var order200 = function (orderType, pay, stock) {
    if (orderType === 2 && pay === true) {
        console.log('200 元定金预购, 得到50 优惠券');
    } else {
        orderNormal(orderType, pay, stock); // 将请求传递给普通订单
    }
};
// 普通购买订单
var orderNormal = function (orderType, pay, stock) {
    if (stock > 0) {
        console.log('普通购买, 无优惠券');
    } else {
        console.log('手机库存不足');
    }
};
// 测试结果：
order500(1, true, 500); // 输出：500 元定金预购, 得到100 优惠券
order500(1, false, 500); // 输出：普通购买, 无优惠券
order500(2, true, 500); // 输出：200 元定金预购, 得到500 优惠券
order500(3, false, 500); // 输出：普通购买, 无优惠券
order500(3, false, 0); // 输出：手机库存不足
```

可以看到，执行结果和前面那个巨大的order 函数完全一样，但是代码的结构已经清晰了很多，我们把一个大函数拆分了3 个小函数，去掉了许多嵌套的条件分支语句。

### 灵活可拆分的职责链节点

我们采用一种更灵活的方式，来改进上面的职责链模式，目标是让链中的各个节点可以灵活拆分和重组。  
首先需要改写一下分别表示3 种购买模式的节点函数，我们约定，如果某个节点不能处理请求，则返回一个特定的字符串 'nextSuccessor'来表示该请求需要继续往后面传递。

```js
var order500 = function (orderType, pay, stock) {
    if (orderType === 1 && pay === true) {
        console.log('500 元定金预购，得到100 优惠券');
    } else {
        return 'nextSuccessor'; // 我不知道下一个节点是谁，反正把请求往后面传递
    }
};
var order200 = function (orderType, pay, stock) {
    if (orderType === 2 && pay === true) {
        console.log('200 元定金预购，得到50 优惠券');
    } else {
        return 'nextSuccessor'; // 我不知道下一个节点是谁，反正把请求往后面传递
    }
};
var orderNormal = function (orderType, pay, stock) {
    if (stock > 0) {
        console.log('普通购买，无优惠券');
    } else {
        console.log('手机库存不足');
    }
};
```

接下来需要把函数包装进职责链节点，我们定义一个构造函数Chain，在new Chain 的时候传递的参数即为需要被包装的函数， 同时它还拥有一个实例属性this.successor，表示在链中的下一个节点。

```js
// Chain.prototype.setNextSuccessor 指定在链中的下一个节点
// Chain.prototype.passRequest 传递请求给某个节点
var Chain = function (fn) {
    this.fn = fn;
    this.successor = null;
};
Chain.prototype.setNextSuccessor = function (successor) {
    return this.successor = successor;
};
Chain.prototype.passRequest = function () {
    var ret = this.fn.apply(this, arguments);
    if (ret === 'nextSuccessor') {
        return this.successor && this.successor.passRequest.apply(this.successor, arguments);
    }
    return ret;
};
// 把3 个订单函数分别包装成职责链的节点
var chainOrder500 = new Chain(order500);
var chainOrder200 = new Chain(order200);
var chainOrderNormal = new Chain(orderNormal);
// 然后指定节点在职责链中的顺序
chainOrder500.setNextSuccessor(chainOrder200);
chainOrder200.setNextSuccessor(chainOrderNormal);
// 最后把请求传递给第一个节点
chainOrder500.passRequest(1, true, 500); // 输出：500 元定金预购，得到100 优惠券
chainOrder500.passRequest(2, true, 500); // 输出：200 元定金预购，得到50 优惠券
chainOrder500.passRequest(3, true, 500); // 输出：普通购买，无优惠券
chainOrder500.passRequest(1, false, 0); // 输出：手机库存不足
```

### 异步的职责链

```js
Chain.prototype.next = function () {
    return this.successor && this.successor.passRequest.apply(this.successor, arguments);
};
var fn1 = new Chain(function () {
    console.log(1);
    return 'nextSuccessor';
});
var fn2 = new Chain(function () {
    console.log(2);
    var self = this;
    setTimeout(function () {
        self.next();
    }, 1000);
});
var fn3 = new Chain(function () {
    console.log(3);
});
fn1.setNextSuccessor(fn2).setNextSuccessor(fn3);
fn1.passRequest();
```

### 用AOP 实现职责链模式

利用JavaScript 的函数式特性，有一种更加方便的方法来创建职责链。

```js
// 面向切片编程
Function.prototype.after = function (fn) {
    var self = this;
    return function () {
        var ret = self.apply(this, arguments);
        if (ret === 'nextSuccessor') {
            return fn.apply(this, arguments);
        }
        return ret;
    }
}

var order = order500.after(order200).after(orderNormal);

order(1, true, 500); // 输出：500 元定金预购，得到100 优惠券
order(2, true, 500); // 输出：200 元定金预购，得到50 优惠券
order(1, false, 500); // 输出：普通购买，无优惠券
```

用AOP 来实现职责链既简单又巧妙，但这种把函数叠在一起的方式，同时也叠加了函数的作用域，如果链条太长的话，也会对性能有较大的影响。

### 职责链模式的优缺点

职责链模式的最大优点就是解耦了请求发送者和N 个接收者之间的复杂关系，由于不知道链中的哪个节点可以处理你发出的请求，所以你只需把请求传递给第一个节点即可。

## 11、中介者模式

中介者模式的作用就是解除对象与对象之间的紧耦合关系。增加一个中介者对象后，所有的相关对象都通过中介者对象来通信，而不是互相引用，所以当一个对象发生改变时，只需要通知中介者对象即可。中介者使各对象之间耦合松散，而且可以独立地改变它们之间的交互。中介者模式使网状的多对多关系变成了相对简单的一对多关系。

### 中介者模式的例子——泡泡堂游戏

在游戏之初只支持两个玩家同时进行对战。先定义一个玩家构造函数，它有3 个简单的原型方法：Play.prototype.win、Play.prototype.lose以及表示玩家死亡的Play.prototype.die。因为玩家的数目是2，所以当其中一个玩家死亡的时候游戏便结束, 同时通知它的对手胜利。

```js
// 定义玩家
function Player(name) {
    this.name = name
    this.enemy = null; // 敌人
};
Player.prototype.win = function () {
    console.log(this.name + ' won ');
};
Player.prototype.lose = function () {
    console.log(this.name + ' lost');
};
Player.prototype.die = function () {
    this.lose();
    this.enemy.win();
};
// 创建2个玩家对象
var player1 = new Player('小新');
var player2 = new Player('小蓝');
// 给玩家相互设置敌人
player1.enemy = player2;
player2.enemy = player1;
// 第一局 小蓝赢
player1.die();
// 第二局 小新赢
player2.die();
```

####  增加至8个玩家，并分成红蓝两队进行游戏

```js
// 定义一个数组players 来保存所有的玩家
var players = [];
// 定义构造函数player
function Player(name, teamColor) {
    this.partners = []; // 队友列表
    this.enemies = []; // 敌人列表
    this.state = 'live'; // 玩家状态
    this.name = name; // 角色名字
    this.teamColor = teamColor; // 队伍颜色
};
Player.prototype.win = function () { // 玩家团队胜利
    console.log('winner: ' + this.name);
};
Player.prototype.lose = function () { // 玩家团队失败
    console.log('loser: ' + this.name);
};
Player.prototype.die = function () { // 玩家死亡
    var all_dead = true;
    this.state = 'dead'; // 设置玩家状态为死亡
    for (var i = 0, partner; partner = this.partners[i++];) { // 遍历队友列表
        if (partner.state !== 'dead') { // 如果还有一个队友没有死亡，则游戏还未失败
            all_dead = false;
            break;
        }
    }
    if (all_dead === true) { // 如果队友全部死亡
        this.lose(); // 通知自己游戏失败
        for (var i = 0, partner; partner = this.partners[i++];) { // 通知所有队友玩家游戏失败
            partner.lose();
        }
        for (var i = 0, enemy; enemy = this.enemies[i++];) { // 通知所有敌人游戏胜利
            enemy.win();
        }
    }
};
// 定义一个工厂来创建玩家：
var playerFactory = function (name, teamColor) {
    var newPlayer = new Player(name, teamColor); // 创建新玩家
    for (var i = 0, player; player = players[i++];) { // 通知所有的玩家，有新角色加入
        if (player.teamColor === newPlayer.teamColor) { // 如果是同一队的玩家
            player.partners.push(newPlayer); // 相互添加到队友列表
            newPlayer.partners.push(player);
        } else {
            player.enemies.push(newPlayer); // 相互添加到敌人列表
            newPlayer.enemies.push(player);
        }
    }
    players.push(newPlayer);
    return newPlayer;
};
// 红队
var player1 = playerFactory('皮蛋', 'red'),
    player2 = playerFactory('小乖', 'red'),
    player3 = playerFactory('宝宝', 'red'),
    player4 = playerFactory('小强', 'red');
// 蓝队
var player5 = playerFactory('黑妞', 'blue'),
    player6 = playerFactory('葱头', 'blue'),
    player7 = playerFactory('胖墩', 'blue'),
    player8 = playerFactory('海盗', 'blue');
// 让红队玩家全部死亡
player1.die();
player2.die();
player4.die();
player3.die();
```

### 用中介者模式改造泡泡堂游戏

首先仍然是定义Player 构造函数和player 对象的原型方法，在player 对象的这些原型方法
中，不再负责具体的执行逻辑，而是把操作转交给中介者对象

```js
function Player(name, teamColor) {
    this.name = name; // 角色名字
    this.teamColor = teamColor; // 队伍颜色
    this.state = 'alive'; // 玩家生存状态
};
Player.prototype.win = function () {
    console.log(this.name + ' won ');
};
Player.prototype.lose = function () {
    console.log(this.name + ' lost');
};
/*******************玩家死亡*****************/
Player.prototype.die = function () {
    this.state = 'dead';
    playerDirector.reciveMessage('playerDead', this); // 给中介者发送消息，玩家死亡
};
/*******************移除玩家*****************/
Player.prototype.remove = function () {
    playerDirector.reciveMessage('removePlayer', this); // 给中介者发送消息，移除一个玩家
};
/*******************玩家换队*****************/
Player.prototype.changeTeam = function (color) {
    playerDirector.reciveMessage('changeTeam', this, color); // 给中介者发送消息，玩家换队
};
// 创建玩家对象的工厂函数
var playerFactory = function (name, teamColor) {
    var newPlayer = new Player(name, teamColor); // 创造一个新的玩家对象
    playerDirector.reciveMessage('addPlayer', newPlayer); // 给中介者发送消息，新增玩家
    return newPlayer;
};
// 实现中介者playerDirector对象
var playerDirector = (function () {
    var players = {}, // 保存所有玩家
        operations = {}; // 中介者可以执行的操作
    /****************新增一个玩家***************************/
    operations.addPlayer = function (player) {
        var teamColor = player.teamColor; // 玩家的队伍颜色
        players[teamColor] = players[teamColor] || []; // 如果该颜色的玩家还没有成立队伍，则新成立一个队伍
        players[teamColor].push(player); // 添加玩家进队伍
    };
    /****************移除一个玩家***************************/
    operations.removePlayer = function (player) {
        var teamColor = player.teamColor, // 玩家的队伍颜色
            teamPlayers = players[teamColor] || []; // 该队伍所有成员
        for (var i = teamPlayers.length - 1; i >= 0; i--) { // 遍历删除
            if (teamPlayers[i] === player) {
                teamPlayers.splice(i, 1);
            }
        }
    };
    /****************玩家换队***************************/
    operations.changeTeam = function (player, newTeamColor) { // 玩家换队
        operations.removePlayer(player); // 从原队伍中删除
        player.teamColor = newTeamColor; // 改变队伍颜色
        operations.addPlayer(player); // 增加到新队伍中
    };
    operations.playerDead = function (player) { // 玩家死亡
        var teamColor = player.teamColor,
            teamPlayers = players[teamColor]; // 玩家所在队伍
        var all_dead = true;
        for (var i = 0, player; player = teamPlayers[i++];) {
            if (player.state !== 'dead') {
                all_dead = false;
                break;
            }
        }
        if (all_dead === true) { // 全部死亡
            for (var i = 0, player; player = teamPlayers[i++];) {
                player.lose(); // 本队所有玩家lose
            }
            for (var color in players) {
                if (color !== teamColor) {
                    var teamPlayers = players[color]; // 其他队伍的玩家
                    for (var i = 0, player; player = teamPlayers[i++];) {
                        player.win(); // 其他队伍所有玩家win
                    }
                }
            }
        }
    };
    var reciveMessage = function () {
        var message = Array.prototype.shift.call(arguments); // arguments 的第一个参数为消息名称
        operations[message].apply(this, arguments);
    };
    return {
        reciveMessage: reciveMessage
    }
})();
// 红队：
var player1 = playerFactory('皮蛋', 'red'),
    player2 = playerFactory('小乖', 'red'),
    player3 = playerFactory('宝宝', 'red'),
    player4 = playerFactory('小强', 'red');
// 蓝队：
var player5 = playerFactory('黑妞', 'blue'),
    player6 = playerFactory('葱头', 'blue'),
    player7 = playerFactory('胖墩', 'blue'),
    player8 = playerFactory('海盗', 'blue');
player1.die();
player2.die();
player3.die();
player4.die();
// // 假设皮蛋和小乖掉线
// player1.remove();
// player2.remove();
// player3.die();
// player4.die();
// // 假设皮蛋从红队叛变到蓝队
// player1.changeTeam('blue');
// player2.die();
// player3.die();
// player4.die();
```

实现这个中介者playerDirector 对象，一般有以下两种方式：  
- 利用发布—订阅模式。将playerDirector 实现为订阅者，各player 作为发布者，一旦player的状态发生改变，便推送消息给playerDirector，playerDirector 处理消息后将反馈发送给其他player。
- 在playerDirector 中开放一些接收消息的接口，各player 可以直接调用该接口来给playerDirector 发送消息，player 只需传递一个参数给playerDirector，这个参数的目的是使playerDirector 可以识别发送者。同样，playerDirector 接收到消息之后会将处理结果反馈给其他player。  
这两种方式的实现没什么本质上的区别。在这里我们使用第二种方式，playerDirector 开放一个对外暴露的接口reciveMessage，负责接收player 对象发送的消息，而player 对象发送消息的时候，总是把自身this 作为参数发送给playerDirector，以便playerDirector 识别消息来自于哪个玩家对象。

可以看到，除了中介者本身，没有一个玩家知道其他任何玩家的存在，玩家与玩家之间的耦合关系已经完全解除，某个玩家的任何操作都不需要通知其他玩家，而只需要给中介者发送一个消息，中介者处理完消息之后会把处理结果反馈给其他的玩家对象。我们还可以继续给中介者扩展更多功能，以适应游戏需求的不断变化。

### 中介者模式的优缺点

优点：中介者模式使各个对象之间得以解耦，以中介者和对象之间的一对多关系取代了对象之间的网状多对多关系。各个对象只需关注自身功能的实现，对象之间的交互关系交给了中介者对象来实现和维护。  
缺点： 最大的缺点是系统中会新增一个中介者对象，因为对象之间交互的复杂性，转移成了中介者对象的复杂性，使得中介者对象经常是巨大的。中介者对象自身往往就是一个难以维护的对象。

中介者模式可以非常方便地对模块或者对象进行解耦，但对象之间并非一定需要解耦。在实际项目中，模块或对象之间有一些依赖关系是很正常的。毕竟我们写程序是为了快速完成项目交付生产，而不是堆砌模式和过度设计。关键就在于如何去衡量对象之间的耦合程度。一般来说，如果对象之间的复杂耦合确实导致调用和维护出现了困难，而且这些耦合度随项目的变化呈指数增长曲线，那我们就可以考虑用中介者模式来重构代码。