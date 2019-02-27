---
layout: post
title: 前端那些你不知道的小技巧(CSS篇)
subtitle: 前端那些你不知道的小技巧(CSS篇)
date: 2019-02-26
categories: 技术 前端小技巧
# cover: /assets/img/postCover/gulp_cover.png
tags: CSS 前端小技巧 黑科技
---

# 前端那些你不知道的小技巧（CSS篇）

## 复位CSS

CSS复位可以在不同的浏览器上保持一致的样式风格。  
您可以使用CSS reset 库normalize.css等，也可以使用一个更简化的复位方法，代码如下：

```scss
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
```

## 继承`box-sizing`

让`box-sizing`继承`html`。

```scss
html {
    box-sizing: border-box;
}

*,
*::before,
*::after {
    box-sizing: inherit;
}
```

## 优化显示文本

有时，字体并不能在所有设备上都达到最佳的显示，所以可以让设备浏览器来帮助你：

```scss
html {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}
```

> 注：请负责任地使用`optimizeLegibility`。此外，IE/Edge没有`text-rendering`支持。

## 给`body`添加行高

你不需要给每个标签都设置`line-height`，只要添加到`body`即可：

```scss
body {
    line-height: 1;
}
```

这样文本元素就可以很容易地从`body`继承。


## 使用`not()`取消菜单列表第一位或者最后一位的边框

我们通常使用的写法：

```scss
// 给列表增加右边框
.nav li {
    border-right: 1px solid #666;
}

// 去除最后一个元素的右边框
.nav li:last-child {
    border-right: none;
}
```

直接使用`not()`:

```scss
.nav li:not(:last-child) {
  border-right: 1px solid #666;
}
```

或者使用兄弟选择符`~`:

```scss
// 排除第一个元素的左边框
.nav li:first-child ~ li {
    border-left: 1px solid #666;
}
```

这两种写法更简洁、更具语义化，也更好理解。

## 妙用`::before`和`::after`伪元素

1. [`::before`](https://developer.mozilla.org/zh-CN/docs/Web/CSS/::before)用来创建一个伪元素，其将成为匹配选中的元素的第一个子元素
2. `::after`用来创建一个伪元素，作为已选中元素的最后一个子元素
3. 常通过 `content` 属性来为一个元素添加修饰性的内容
4. 此元素默认为行内元素
5. 由`::before`和`::after`生成的伪元素，只能用于包含在元素格式框内，如`<div></div>`、`<p></p>`等双闭合标签
6. 不能用于替换元素上， 比如`<img />`或`<br />`等单闭合标签（自闭合标签）

### `hover`提示

```html
<span data-info="JavaScript is the programming language of HTML and the Web.">Javascript</span>
```

```scss
span::after {
    content: attr(data-info);
    display: inline;
    position: absolute;
    top: 22px;
    left: 0;
    width: 230px;
    font-size: 13px;
}
```

把`::after`伪元素的`content`属性设置为`attr(data-info)`，具体代码和效果[查看demo](https://codepen.io/guuslieben/pen/gabQWM)

### 使用属性选择器用于空链接

当`<a>`元素没有文本值，但 href 属性有链接的时候显示链接：

```scss
a[href^='http']:empty::before {
    content: attr(href);
}
```

### 清除浮动

```scss
.clearfix {
    zoom: 1; // 兼容IE
}

.clearfix::after {
    display: block;
    content: '';
    height: 0;
    line-height: 0;
    visibility: hidden;
    clear: both;
}
```

### 逗号分隔的列表

```scss
// 给每个`li`标签后面增加`,`，排除掉最后一个列表
ul > li:not(:last-child)::after {
    content: ',';
}
```

## 给input占位符placeholder设置样式

[伪元素::placeholder](https://developer.mozilla.org/zh-CN/docs/Web/CSS/::placeholder)可以选择一个表单元素的占位文本，它允许开发者和设计师自定义占位文本的样式。

```html
<input placeholder="我是红色的！">
```

```scss
input::placeholder {
    color: red;
    font-size: 12px;
    font-style: italic;
}
```

## 妙用border绘制三角形

```html
<div class="b-tool-tip"></div>
```

```scss
.b-tool-tip {
    width: 0;
    height: 0;
    border-width: 10px;
    border-style: solid;
    border-color: transparent transparent transparent #464646;
}
```

[查看demo效果](https://codepen.io/Better1025/pen/NJPovQ)

## 使用负的`nth-child`选择项目

在CSS中使用负的`nth-child`选择项目1到项目n。

```scss
li {
    display: none;
}

/* select items 1 through 3 and display them */
li:nth-child(-n+3) {
    display: block;
}
```

## 对未知高度的纯CSS滑块使用`max-height`做过渡动画

```scss
.slider ul {
    max-height: 0;
    overflow: hidden;
}

.slider:hover ul {
    max-height: 300px;
    transition: 500ms ease;
}
```

## 表格单元格等宽

表格工作起来很麻烦，所以务必尽量使用`table-layout: fixed`来保持单元格的等宽：

```scss
.table {
    display: table;
    table-layout: fixed;
}
```

## 对图标使用SVG

```scss
.logo {
    background: url("logo.svg");
}
```

SVG对所有的分辨率类型都具有良好的扩展性，并支持所有浏览器都回归到IE9。这样可以避开.png、.jpg或.gif文件了。

## 使用`text-transform`属性，转换大小写

> [text-transform](https://developer.mozilla.org/zh-CN/docs/Web/CSS/text-transform) CSS属性指定如何将元素的文本大写。它可以用于使文本显示为全大写或全小写，也可单独对每一个单词进行操作。

```html
<p>I am a front-end engineer</p>
```

```scss
p {
    // 每个单词的首字母转换为大写
    // text-transform: capitalize;

    // 所有字符被转换为大写
    text-transform: uppercase;

    // 所有字符被转换为小写
    // text-transform: lowercase;
}
```

[查看demo效果](https://codepen.io/Better1025/pen/ywymYx)

### 更多CSS使用技巧，可以[查看You-Dont-Need-JavaScript中的demo](https://github.com/you-dont-need/You-Dont-Need-JavaScript)

### 持续更新中，欢迎大家留言，收集更多的实用小技巧，共同学习，共同进步

相关链接：  

- [用css如何实现圣杯布局(两侧定宽，中间自适应布局)](http://liaolongdong.com/demo/cssTipsDemo/leftCenterRight.html)
- [七种CSS方式让一个容器水平垂直居中](http://liaolongdong.com/demo/cssTipsDemo/containerCenter.html)
- [网页元素CSS水平居中、垂直居中、水平垂直居中汇总](http://liaolongdong.com/demo/cssTipsDemo/summaryCenter.html)
