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

代理模式包括许多小分类，在JavaScript 开发中最常用的是虚拟代理和缓存代理。

## 迭代器模式

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
```

## 发布订阅模式

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

## 命令模式

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

## 组合模式

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

## 模板方法模式

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

