---
layout: post
title: echarts折线图、饼状图、圆环图使用总结
subtitle: echarts折线图、饼状图、圆环图使用总结
seo_description: echarts 折线图、饼状图、圆环图使用总结：常用配置参数，以及官方 demo 没写的问题——折线图周围空白、加水印文本块、标签超长重叠，均配注释与在线 demo。
date: 2019-01-01
categories: [JavaScript]
cover: '/assets/img/postCover/echarts_cover.png'
tags: echarts
tldr: '官方 demo 没写的三个坑各有配置项：折线图四周空白靠 grid 的 x、y、x2、y2 收窄，圆环图中心加水印用 graphic 的 text 元素，饼图标签重叠则动 minAngle、引导线长度和 formatter 换行。'
faq:
  - q: 'echarts 折线图周围的空白区域太大，要改哪个配置？'
    a: '改 option 里的 grid，它配的是直角坐标系内的绘图网格，单个 grid 最多能放上下两个 X 轴、左右两个 Y 轴。示例把 x 设 50、y 设 30 表示 canvas 距左上角的距离，x2 设 30、y2 设 40 表示距右下角的距离，也可以改用 top、left、right、bottom；顺带还能用 show 是否显示网格、borderWidth 和 borderColor 调边框、backgroundColor 设网格底色。'
  - q: '想在圆环图正中间加一段文字，或者给图表加水印，用什么配置？'
    a: '用 graphic 这个原生图形元素组件：type 填 text，top 和 left 都设 center，文字写在 style.text 里、需要换行就拼 \n 进去，字号和水平对齐在同一个 style 里给。折线图上给特定月份标节日文字用的也是它。'
  - q: '移动端饼图标签文字太长显示不全、还互相重叠怎么办？'
    a: '可以动的地方有五个：调小标签字号以展示更多文字、缩小饼状图本身、缩短视觉引导线、给 series 设 minAngle（0 到 360，防止某个值过小导致扇区太小影响交互）、用 formatter 做格式器，字符串模板和回调函数返回的字符串都支持用 \n 换行。示例里还打开了 avoidLabelOverlap 这个防标签重叠策略，并把 labelLine 的 length 与 length2 都设成 10。'
---

这篇博客主要记录我们使用常用图表时，经常遇到的一些问题，这些问题是在echarts demo上没有写到的，详细具体的代码，请看这篇博客demo的源码，每个配置都有详细的注释。

[点这里查看demo效果]({{ site.baseurl }}/demo/echartsDemo/index.html)

## 绘制图表

获取echarts有好几种方式：  

- 使用npm或者yarn下载
- 使用cdn引入
- 直接把对应的js代码拷贝到项目中

我们在实际项目开发中可以根据项目需要[在线定制](https://echarts.baidu.com/builder.html)所需要的图标功能，如图：
![echarts在线定制下载](/assets/img/postCover/echarts_download.png)

我这里为了方便直接使用cdn引入，代码如下：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <!-- 引入 ECharts 文件 -->
    <script src="https://cdn.bootcss.com/echarts/4.2.0-rc.2/echarts.min.js"></script>
</head>
<body>
    <!-- 为ECharts准备一个具备大小（宽高）的Dom -->
    <div id="main" style="width: 600px;height:400px;"></div>
    <script type="text/javascript">
        // 基于准备好的dom，初始化echarts实例
        var myChart = echarts.init(document.getElementById('main'));

        // 指定图表的配置项和数据
        var option = {
            title: {
                text: 'ECharts 入门示例'
            },
            tooltip: {},
            legend: {
                data:['销量']
            },
            xAxis: {
                data: ["衬衫","羊毛衫","雪纺衫","裤子","高跟鞋","袜子"]
            },
            yAxis: {},
            series: [{
                name: '销量',
                type: 'bar',
                data: [5, 20, 36, 10, 10, 20]
            }]
        };

        // 使用刚指定的配置项和数据显示图表。
        myChart.setOption(option);
    </script>
</body>
</html>
```

## 图表中常用的配置参数

- title: 配置标题组件，包含主标题和副标题
- legend: 配置图例组件
- grid: 配置直角坐标系内绘图网格
- xAxis: 直角坐标系 grid 中的 x 轴
- yAxis: 直角坐标系 grid 中的 y 轴
- tooltip: 配置提示框组件
- series: 配置系列列表。每个系列通过 type 决定自己的图表类型，比如，line（折线图）、pie（饼状图）等等
- color: 配置调色盘颜色列表。如果系列没有设置颜色，则会依次循环从该列表中取颜色作为系列颜色
- graphic: 配置原生图形元素组件，比如文本块、添加水印等

每个配置具体细节详见[配置项](https://www.echartsjs.com/option.html#title)

## 绘制图表经常遇到的问题

最基本的功能就不详细讲解了，直接看[api文档配置项](https://echarts.baidu.com/option.html#title)或者[图表demo](https://echarts.baidu.com/examples/)就可以了

### echarts折线图周围空白区域处理

我们在绘制折线图的时候经常会遇到折线图周围的空白区域太大了，这是我们需要进行配置，让缩小折线图周围的空白区域，具体代码如下：

```js
var option = {
    grid: { // 直角坐标系内绘图网格，单个 grid 内最多可以放置上下两个 X 轴，左右两个 Y 轴。
        show: true, // 是否显示直角坐标系网格
        borderWidth: 0, // 网格的边框线宽
        borderColor: '#fff', // 网格的边框颜色
        backgroundColor: '#CCF0F7', // 网格背景色
        // 也可以使用top,left,right,bottom
        x: 50, // 图表canvas距左上角x轴的距离
        y: 30, // 图表canvas距左上角y轴的距离
        x2: 30, // 图表canvas距右下角x轴的距离
        y2: 40, // 图表canvas距右下角y轴的距离
    },
}
```

效果如图：
![折线图周围空白区域](/assets/img/postCover/echarts_line.png)

### 给echarts图标添加文本块或者水印

我们绘制图表时，经常会添加一些文本块或者水印，比如上面的折线图给特定月份添加节日，以及下面的圆环图增加文本块，具体配置代码如下：

```js
var option = {
    graphic: { // graphic 是原生图形元素组件
        type: 'text', // 一个图形元素，类型是 text
        top: 'center',
        left: 'center',
        style: {
            text: '区域占比\n\n' + '9.18%',
            textAlign: 'center',
            fontSize: 22,
        }
    },
}
```

效果如图：
![圆环图添加文本块](/assets/img/postCover/echarts_pie.png)

### echarts图表标签文本超长展示不全或者重叠处理

移动端在绘制饼状图表时，经常会遇到图表标签文本太长展示不下或者标签重叠在一起等问题，解决这个问题有以下几种解决方案：

- 调整标签文字的大小，以展示更多文字
- 缩小饼状图的大小
- 缩短标签文本视觉引导线长度
- 饼状图或者圆环图设置扇形区域最小角度`minAngle`，最小的扇区角度（0 ~ 360），同时可以防止某个值过小导致扇区太小影响交互。
- 使用`formatter`标签文本内容格式器，支持字符串模板和回调函数两种形式，字符串模板与回调函数返回的字符串均支持用 `\n` 换行

具体配置代码如下：

```js
var option = {
    series: [
        {
            name: '服务类型占比',
            type: 'pie',
            radius: '50%',
            center: ['50%', '50%'],
            silent: true, // 图形是否不响应和触发鼠标事件，默认为 false，即响应和触发鼠标事件。
            minAngle: 30, // 最小的扇区角度（0 ~ 360），用于防止某个值过小导致扇区太小影响交互。
            avoidLabelOverlap: true, // 是否启用防止标签重叠策略
            label: { // 饼图图形上的文本标签，可用于说明图形的一些数据信息，比如值，名称等
                show: true, // 是否显示文本标签
                // formatter: '{b} {d}%', // 文本标签格式
                formatter: function (params) {
                    // 类目名长度大于5
                    if (params.name.length >= 5) {
                        return params.name + '\n' + params.value + '%';
                    } else {
                        return params.name + params.value + '%';
                    }
                }, // 文本标签格式
                color: '#333', // 文本标签字体颜色
                align: 'left', // 文字水平对齐方式，默认自动
                fontSize: 22,
            },
            labelLine: { // 标签文本引导线样式
                show: true,
                length: 10, // 视觉引导线第一段的长度
                length2: 10, // 视觉引导线第二段的长度
                // lineStyle: {
                //     width: 2
                // }
            },
        }
    ]
}
```

效果如图：
![图表标签文本过长展示不下或重叠处理](/assets/img/postCover/echarts_pie_label_overflow.png)

以上就是项目中使用echarts图表遇到的一些问题总结，更详细的配置可以参考demo源码，如图：
![echarts图表详细配置参数源码](/assets/img/postCover/echarts_pie_label_overflow.png)
