---
layout: post
title: H5实现打开导航地图app并自动导航到目的地
subtitle: H5实现打开导航地图app并自动导航到目的地
date: 2020-10-25
categories: 技术 前端小技巧 地图导航
# cover: /assets/img/postCover/gulp_cover.png
tags: JavaScript vue H5打开地图导航app
---

# H5实现打开导航地图app并自动导航到目的地

## 背景

公司项目需求，要实现一个H5页面打高德地图、百度地图、腾讯地图并自动进行导航到目的地的功能，在项目上线以后，抽时间做一下总结记录一下，同事也希望能帮到有这方面需求的同学

## 技术实现

由于我们前端JS无法判断用户手机是否有安装某个地图导航app，所以只列出一些大家经常用到的地图导航app，这里只列出高德地图、百度地图、腾讯地图app,所以增加了一句“如果点击无响应，可能是您还没有安装该APP”提示文案。

### 具体实现源码

这里为了快速开发出demo，使用`script`标签的方式引入vue并使用vue进行开发

直接通过`script`标签的方式引入vue需要注意一下几个点：

- 确保引入正确的vue版本，[具体参考直接用 `<script>` 引入](https://cn.vuejs.org/v2/guide/installation.html#%E7%9B%B4%E6%8E%A5%E7%94%A8-lt-script-gt-%E5%BC%95%E5%85%A5)
- 在使用vue组件的时候，html代码里面的组件引入名称必须使用 kebab-case 命名方式, [具体参考vue组件名](https://cn.vuejs.org/v2/guide/components-registration.html#%E7%BB%84%E4%BB%B6%E5%90%8D)
  > 当使用 PascalCase (首字母大写命名) 定义一个组件时，你在引用这个自定义元素时两种命名法都可以使用。也就是说 <my-component-name> 和 <MyComponentName> 都是可接受的。注意，尽管如此，直接在 DOM (即非字符串的模板) 中使用时只有 kebab-case 是有效的。
- 组件传参props的属性名称也必须使用 kebab-case 命名方式，[具体参考Prop 的大小写 (camelCase vs kebab-case)](https://cn.vuejs.org/v2/guide/components-props.html#Prop-%E7%9A%84%E5%A4%A7%E5%B0%8F%E5%86%99-camelCase-vs-kebab-case)

具体实现代码：

html代码部分

```html
<!-- index.html -->
<h1 class="title">H5实现打开导航地图app并自动导航到目的地</h1>
<h2 class="sub-title">点击“导航”按钮</h2>
<div id="app">
    <button class="goto-map" @click="gotoMap">导航</button>
    <!-- https://cn.vuejs.org/v2/guide/components-registration.html -->
    <!-- 组件名只能使用 直接在 DOM (即非字符串的模板) 中使用时只有 kebab-case 是有效的。 -->
    <!-- https://cn.vuejs.org/v2/guide/components-props.html -->
    <!-- Prop 的大小写 (camelCase vs kebab-case) 在 HTML 中是 kebab-case 的 -->
    <open-map
        :visible.sync="openMapVisible"
        :open-map-data="openMapData"
        :local-position="position"
    />
</div>
<script src="./js/vue.min.js"></script>
<script src="./js/gcoord.js"></script>
<script src="./js/openMap.js"></script>
<script src="./js/index.js"></script>
```

OpenMap组件部分

```js
// openMap.js
Vue.component("OpenMap", {
  template: `
        <div v-if="visible" class="container">
            <div @click="close" class="mask"></div>
            <div class="content">
                <div class="header">
                    <p class="lv1">使用地图打开导航</p>
                    <p class="lv2">如果点击无响应，可能是您还没有安装该APP</p>
                </div>
                <div class="list">
                    <a @click="gaode" href="javascript:void(0)">高德地图</a>
                </div>
                <div class="list">
                    <a @click="baidu" href="javascript:void(0)">百度地图</a>
                </div>
                <div class="list">
                    <a @click="tengxun" href="javascript:void(0)">腾讯地图</a>
                </div>
                <div @click="close" class="footer">取消</div>
            </div>
        </div>
    `,
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 目标地址数据
    openMapData: {
      type: Object,
      default: () => {
        return {};
      },
    },
    // 当前地址数据
    localPosition: {
      type: Object,
      default: () => {
        return {};
      },
    },
  },
  data() {
    return {
      isIos: false,
    };
  },
  created() {
    this.isIos = /(iPhone|iPad|iPod|iOS)/i.test(window.navigator.userAgent);
  },
  methods: {
    // 打开百度地图
    // http://lbsyun.baidu.com/index.php?title=uri/api/android
    baidu() {
      const str = this.isIos ? "baidumap" : "bdapp";
      // const url = `${str}://map/direction?region=我的位置&origin=${this.localPosition.lat},${this.localPosition.lon}&destination=${this.openMapData.lat},${this.openMapData.lon}&coord_type=bd09ll&mode=driving&src=andr.baidu.openAPIdemo`;
      const url = `${str}://map/direction?origin=name:我的位置|latlng:${this.localPosition.lat},${this.localPosition.lon}&destination=name:${this.openMapData.addr}|latlng:${this.openMapData.lat},${this.openMapData.lon}&coord_type=bd09ll&mode=driving&src=andr.baidu.openAPIdemo`;
      window.location.href = url;
    },
    // 打开高德地图
    // https://lbs.amap.com/api/amap-mobile/guide/android/route
    gaode() {
      let localResult = gcoord.transform(
        [this.localPosition.lon, this.localPosition.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      let opendResult = gcoord.transform(
        [this.openMapData.lon, this.openMapData.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      const str = this.isIos ? "iosamap" : "androidamap";
      const url = `${str}://route/plan/?sid=&slat=${localResult[1]}&slon=${localResult[0]}&sname=我的位置&did=&dlat=${opendResult[1]}&dlon=${opendResult[0]}&dname=${this.openMapData.addr}&dev=1&t=0`;
      window.location.href = url;
    },
    // 打开腾讯地图
    tengxun() {
      let localResult = gcoord.transform(
        [this.localPosition.lon, this.localPosition.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      let opendResult = gcoord.transform(
        [this.openMapData.lon, this.openMapData.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      const url = `qqmap://map/routeplan?type=drive&from=我的位置&fromcoord=${localResult[1]},${localResult[0]}&to=${this.openMapData.addr}&tocoord=${opendResult[1]},${opendResult[0]}&referer=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77`;
      window.location.href = url;
    },
    close() {
      this.$emit("update:visible", false);
    },
  },
});
```

**还需要在html页面底部引入对饮的JS文件，vue和gcoord，完成代码可以demo页面，按F12控制台，查看完成源码和页面所需要引入的JS和Css文件**

## demo效果地址

- [H5实现打开导航地图app并自动导航到目的地](https://liaolongdong.com/demo/openMapDemo/index.html)


