---
layout: post
title: H5实现类似微信可拖拽左右吸边浮动按钮
subtitle: H5实现类似微信可拖拽左右吸边浮动按钮
date: 2020-10-20
categories: 技术 前端小技巧 实现可拖拽悬浮按钮
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript vue 实现可拖拽悬浮按钮
---

# H5实现类似微信可拖拽左右吸边浮动按钮

## 背景

之前项目需求产品经理要求实现一个`可以实时拖拽的按钮`，刚好我们移动端H5用的调试工具vconsole也有类似功能，于是研究了一下vconsole里面具体实现的源码，参考其中代码自己也实现了一个, [点击查看demo效果](https://liaolongdong.com/demo/realtimeDraggable/index.html)

然后在做另外一个需求的时候产品经理无意中看到我手机微信的那个可以拖拽并且可以自动左右吸附的浮窗按钮，说这个效果不错，就按照微信的这个效果来，于是在原来的那个基础上有实现了一个`类似微信可拖拽左右吸边浮动按钮`，[点击查看demo效果](https://liaolongdong.com/demo/likeWxFloatDragBtnDemo/index.html)

## 技术实现

其实实现这个功能所使用到的技术点并不难，主要是要处理边界情况和各种细节

实现实时拖拽功能技术点：

- 移动端： 监听`touchstart`、`touchmove`、`touchend`事件
- PC端： 监听`mousedown`、`mousemove`、`mouseup`事件
- 以及一些dom操作的api，获取节点的位置等

## 实现源码

废话不多说，直接上源码，这里只放js代码，要看html/css/js，直接可以在demo页面，按`F12`查看完整内容

```js
const app = new Vue({
  el: "#app",
  data: {
    isMove: false, // 是否在移动
    isLeft: false, // 吸附左边
    mineBtnPos: {
      x: 0, // right
      y: 0, // bottom 该值必须是初始定位样式值的倍数(比如使用750px设计稿的需要设置初始值为设计稿的一半)，否则首次拖拽可能会错位
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    },
  },
  created() {
    this.mineBtnPos = Object.assign(this.mineBtnPos, this.btnInitStyle);
  },
  mounted() {
    this._bindEvent();
  },
  methods: {
    clickMineBtn() {
      location.href = "https://liaolongdong.com/";
    },
    /**
     * bind DOM events
     * @private
     */
    _bindEvent() {
      let that = this;
      let dWidth =
        document.documentElement.clientWidth || document.body.clientWidth;

      let $mineBtn = document.querySelector(".c-draggable-likewxfloat");
      let mWidth = $mineBtn.getBoundingClientRect().width;
      let bottomPx =
        parseFloat(window.getComputedStyle($mineBtn, null).bottom) || 0;
      that.mineBtnPos.y = bottomPx;
      $mineBtn.addEventListener("touchstart", function (e) {
        that.mineBtnPos.startX = e.touches[0].pageX;
        that.mineBtnPos.startY = e.touches[0].pageY;
      });
      $mineBtn.addEventListener("touchend", function (e) {
        that.mineBtnPos.x = that.mineBtnPos.endX;
        that.mineBtnPos.y = that.mineBtnPos.endY;

        // 增加左右吸附效果
        // that.mineBtnPos.x的值是从右边开始计算的
        that.isMove = false;
        if (that.mineBtnPos.x < dWidth / 2) {
          that.mineBtnPos.x = 0;
          that.isLeft = false;
        } else {
          that.isLeft = true;
          that.mineBtnPos.x = dWidth - mWidth;
        }
        $mineBtn.style.right = that.mineBtnPos.x + "px";

        that.mineBtnPos.startX = 0;
        that.mineBtnPos.startY = 0;
      });
      $mineBtn.addEventListener("touchmove", function (e) {
        that.isMove = true;

        if (e.touches.length > 0) {
          let offsetX = e.touches[0].pageX - that.mineBtnPos.startX,
            offsetY = e.touches[0].pageY - that.mineBtnPos.startY;
          let x = that.mineBtnPos.x - offsetX,
            y = that.mineBtnPos.y - offsetY;

          // check edge
          if (x + $mineBtn.offsetWidth > document.documentElement.offsetWidth) {
            x = document.documentElement.offsetWidth - $mineBtn.offsetWidth;
          }
          if (
            y + $mineBtn.offsetHeight >
            document.documentElement.offsetHeight
          ) {
            y = document.documentElement.offsetHeight - $mineBtn.offsetHeight;
          }
          if (x < 0) {
            x = 0;
          }
          if (y < 0) {
            y = 0;
          }
          $mineBtn.style.right = x + "px";
          $mineBtn.style.bottom = y + "px";
          that.mineBtnPos.endX = x;
          that.mineBtnPos.endY = y;
          e.preventDefault();
        }
      });
    },
  },
});
```

## demo效果地址

- [H5实现类似微信可拖拽左右吸边浮动按钮](https://liaolongdong.com/demo/likeWxFloatDragBtnDemo/index.html)
- [H5实现类似于vconsole的实时拖拽功能](https://liaolongdong.com/demo/realtimeDraggable/index.html)


