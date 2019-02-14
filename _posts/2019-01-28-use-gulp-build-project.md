---
layout: post
title: 使用gulp搭建多页面项目
subtitle: 使用gulp搭建多页面项目
date: 2019-01-28
categories: 技术 项目搭建 gulp
cover: /assets/img/postCover/gulp_cover.png
tags: gulp 项目搭建
---

# 使用gulp搭建多页面项目

[github-demo](https://github.com/liaolongdong/use-gulp-build-project)

> gulp 用自动化构建工具增强你的工作流程

目前我们前端构建的项目大多数都是使用webpack进行打包构建的，但是有也一些项目比较适合使用gulp进行构建打包项目，比如，独立于项目之外的各种活动页面。

## gulp常用API

gulp最常用的几个api:

- `gulp.src(globs[, options])`，输出（Emits）符合所提供的匹配模式（glob）或者匹配模式的数组（array of globs）的文件。
- `gulp.dest(path[, options])`，能被 pipe 进来，并且将会写文件。并且重新输出（emits）所有数据，因此你可以将它 pipe 到多个文件夹。如果某文件夹不存在，将会自动创建它。
- `gulp.task(name[, deps], fn)`，定义一个task任务。
- `gulp.watch(glob [, opts], tasks) 或 gulp.watch(glob [, opts, cb])`，监视文件，并且可以在文件发生改动时候做一些事情。

[查看更详细的api文档](https://www.gulpjs.com.cn/docs/api/)

## gulp的具体用法

使用gulp构建的项目，在项目根目录下都会有一个gulpfile.js文件，来编写gulp任务(task)，直接执行`gulp`命令，会默认执行`default`任务，完整代码如下：

```js
// gulpfile.js

var gulp = require('gulp'); // 自动化构建项目的工具
var fs = require('fs'); // node内置的文件系统模块
var path = require('path'); // node内置的路径拼接处理模块
var runSequence = require('run-sequence'); // 按照指定顺序执行task任务的插件
var opn = require('opn'); // 自动打开浏览器
var uglify = require('gulp-uglify'); // 压缩混淆js的gulp插件
var eslint = require('gulp-eslint'); // 使用eslint进行代码校验
var cleanCss = require('gulp-clean-css'); // 压缩css的gulp插件
var autoprefixer = require('gulp-autoprefixer'); // css样式自动添加浏览器内核前缀，如-webkit,-moz,-o
var htmlmin = require('gulp-htmlmin'); // 压缩html文件的gulp插件
var imagemin = require('gulp-imagemin'); // 压缩PNG, JPEG, GIF and SVG格式的图片的gulp插件
var babel = require('gulp-babel'); // 转义es6语法的gulp插件
var sass = require('gulp-sass'); // 编译sass的gulp插件
var concat = require('gulp-concat'); // 合并文件的gulp插件
var gulpIf = require('gulp-if'); // 条件判断
var connect = require('gulp-connect'); // 创建web服务器的gulp插件
var rename = require('gulp-rename'); // 重命名插件
var plumber = require('gulp-plumber'); // Prevent pipe breaking caused by errors from gulp plugins(捕获错误))
var preprocess = require('gulp-preprocess'); // 在html和JS中自定义环境变量的gulp插件

var isProd = process.env.ENV === 'prod'; // 判断当前环境是否为生产环境
console.log('当前环境是', process.env.ENV);
var buildPath = 'src'; // 要打包的文件目录
var destPath = 'dist'; // 打包输出目录

/**
 * @param { dir：string，文件夹名称}
 * @return {dir文件夹下的文件夹名称数组}  
 */
function getFolders (dir) {
    return fs.readdirSync(dir)
        .filter(function (file) {
            return fs.statSync(path.join(dir, file)).isDirectory();
        })
}
console.log('getFolders', getFolders('src'));
console.log(path.join(buildPath, 'demoOne', 'index.html'));

// 打包js
gulp.task('minifyJs', function () {
    getFolders(buildPath).map(function (folder) {
        gulp.src(path.join(buildPath, folder, 'js/*.js'))
            .pipe(plumber())
            .pipe(babel({
                // presets: ['env']
                presets: ['es2015']
            }))
            .pipe(eslint({useEslintrc: false}))
            .pipe(eslint.failOnError())
            .pipe(gulp.dest(path.join(destPath, folder, 'js')))
            .pipe(gulpIf(isProd, concat('main.js')))
            .pipe(gulpIf(isProd, uglify()))
            .pipe(gulp.dest(path.join(destPath, folder, 'js')))
            .pipe(connect.reload());
    });
});


// 打包css
gulp.task('minifyCss', function () {
    getFolders(buildPath).map(function (folder) {
        gulp.src(path.join(buildPath, folder, 'css/*.*')) // 输出要打包的css文件
            .pipe(autoprefixer())
            .pipe(sass())
            .pipe(gulp.dest(path.join(destPath, folder, 'css')))
            .pipe(concat('main.css'))
            .pipe(gulpIf(isProd, cleanCss())) // 兼容ie9及以上
            .pipe(gulp.dest(path.join(destPath, folder, 'css'))) // 把打包压缩好的css打包到dist/demoOne目录下的js文件夹中
            .pipe(connect.reload());
        });
});

// 压缩图片
gulp.task('minifyImgs', function () {
    getFolders(buildPath).map(function (folder) {
        gulp.src(path.join(buildPath, folder, 'imgs/*.*'))
            .pipe(gulpIf(isProd, imagemin()))
            .pipe(gulp.dest(path.join(destPath, folder, 'imgs')))
            .pipe(connect.reload());
        });
});

// 压缩html
gulp.task('minifyHtml', function () {
    getFolders(buildPath).map(function (folder) {
        gulp.src(path.join(buildPath, folder, '*.html'))
            // .pipe(plumber())
            .pipe(gulpIf(isProd, htmlmin({collapseWhitespace: true})))
            .pipe(gulp.dest(path.join(destPath, folder)))
            .pipe(connect.reload());
        });
});

// 创建本地web服务
gulp.task('devServer', function () {
    connect.server({
        name: 'Dev Server',
        host: '127.0.0.1',
        root: ['dist'],
        port: 8000,
        livereload: true
    });
});

// 监听文件修改
gulp.task('watch', function () {
    gulp.watch('src/**/js/*.js', ['minifyJs']);
    gulp.watch(['src/**/css/*.css', 'src/**/css/*.scss'], ['minifyCss']);
    gulp.watch('src/**/imgs/*.*', ['minifyImgs']);
    gulp.watch('src/**/*.html', ['minifyHtml']);
});


// 使用gulp命令，默认执行'default'任务
gulp.task('default', ['minifyJs', 'minifyCss', 'minifyImgs', 'minifyHtml', 'devServer', 'watch'], function () {
    console.log('build successful!');
    // 在mac上设置打开的浏览器类型为chrome会报：UnhandledPromiseRejectionWarning: Error: Exited with code 1 错误
    // opn('http://127.0.0.1:8000/demoOne', {app: 'chrome'});
    opn('http://127.0.0.1:8000/demoOne');
});
```

> 如果不知道某个gulp插件的用法，可以在[npm公共仓库搜索该gulp插件名称查看具体用法](https://www.npmjs.com/)

## gulp使用技巧及常见问题

### 使用技巧

[gulp使用技巧](https://www.gulpjs.com.cn/docs/recipes/)

### 运行gulp项目报错：Task function must be specified

原因：出现这个错误的原因是，gulp全局插件(CLI version)和项目中(Local version)的版本号不一致

```git
Betters-iMac:use-gulp-build-project better$ gulp -v
[10:08:41] CLI version 3.9.1
[10:08:41] Local version 4.0.0
```

解决方案：重装gulp，统一版本号

```git
npm install gulp@3.9.1 --save-dev
```