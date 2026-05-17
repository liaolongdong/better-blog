var gulp = require('gulp'),
    fs = require('fs'), // 文件系统
    path = require('path'), // 路径处理
    plumber = require('gulp-plumber'), // 捕获错误
    uglify = require('gulp-uglify'), // 压缩js文件
    gulpIf = require('gulp-if'), // 条件判断
    autoprefixer = require('gulp-autoprefixer'), // 样式兼容前缀自动补全
    staticHash = require('gulp-static-hash'), // 静态文件加hash字符串
    sass = require('gulp-sass')(require('sass')), // 编译sass
    cleanCSS = require('gulp-clean-css'), // 压缩css文件
    postcss = require('gulp-postcss'),
    pxtoviewport = require('postcss-px-to-viewport'), // px转vw
    babel = require('gulp-babel'), // 转义es6语法的gulp插件
    rename = require('gulp-rename'); // 文件重命名

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
console.log('demoDir', getFolders('demo'));

// 是否为.min.js后缀文件
function notMinJS (file) {
    return !file.path.endsWith('.min.js');
};
// 是否为.min.css后缀文件
function notMinCss (file) {
    return !file.path.endsWith('.min.css');
};

// dev文件夹下gulp打包
// 压缩打包JS
gulp.task('buildJS', function() {
    return gulp.src(['dev/js/*.js'])
        .pipe(staticHash({asset: 'static'}))
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(uglify())
        .pipe(plumber())
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('assets/js'))
});

// 编译打包sass
gulp.task('buildCss', function() {
    return gulp.src(['dev/sass/*.scss'])
        .pipe(staticHash({asset: 'static'}))
        .pipe(sass())
        .pipe(autoprefixer({
            browsers: ['iOS >= 7', 'Android >= 4.1'],
            cascade: true,
            remove:true
        }))
        .pipe(cleanCSS())
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('assets/css'))
});

// 压缩打包libJs
gulp.task('buildLibJS', function() {
    gulp.src(['dev/libJs/*.js'])
        .pipe(staticHash({asset: 'static'}))
        .pipe(gulpIf(notMinJS, babel({
            presets: ['@babel/env']
        })))
        .pipe(gulpIf(notMinJS, uglify()))
        .pipe(gulpIf(notMinJS, plumber()))
        .pipe(gulpIf(notMinJS, rename({suffix: '.min'})))
        .pipe(gulp.dest('assets/js'))
});

// 压缩打包libCss
gulp.task('buildLibCss', function() {
    var processors = [
        pxtoviewport({
            viewportWidth: 750,
            viewportHeight: 1334,
            unitPrecision: 5,
            viewportUnit: 'vw',
            selectorBlackList: [/^\.markdown-body/, /^\.pc/, /\.g-container/, /\.g-sidebar-wrapper/, /\.article-list/, /\.g-sidebar/],
            minPixelValue: 1,
            mediaQuery: false
        })
    ]
    return gulp.src(['dev/libCss/*.*'])
        .pipe(staticHash({asset: 'static'}))
        .pipe(gulpIf(notMinCss, sass()))
        .pipe(gulpIf(notMinCss, autoprefixer({
            browsers: ['iOS >= 7', 'Android >= 4.1'],
            cascade: true,
            remove:true
        })))
        .pipe(gulpIf(notMinCss, postcss(processors)))
        .pipe(gulpIf(notMinCss, cleanCSS()))
        .pipe(gulpIf(notMinCss, rename({suffix: '.min'})))
        .pipe(gulp.dest('assets/css'))
});

// demo文件夹下gulp打包
// demo文件夹js使用babel
gulp.task('DemoJS', function () {
    getFolders('demo').map(function (folder) {
        // 排除min.js文件
        gulp.src([path.join('demo', folder, 'js/*.*'), '!' + path.join('demo', folder, 'js/*.min.js')])
            .pipe(staticHash({asset: 'static'}))
            .pipe(babel({
                presets: ['@babel/env']
            }))
            // .pipe(uglify()) // demo能让用户更好的看源码，所以不压缩
            .pipe(plumber())
            .pipe(rename({suffix: '.min'}))
            .pipe(gulp.dest(path.join('demo', folder, 'js')));
    });
});

// demo文件夹编译sass
gulp.task('DemoSass', function () {
    var processors = [
        pxtoviewport({
            viewportWidth: 750,
            viewportHeight: 1334,
            unitPrecision: 5,
            viewportUnit: 'vw',
            // 禁止以pc开头结尾类名的px转换成vw
            selectorBlackList: [/^\.pc/],
            minPixelValue: 1,
            mediaQuery: false
        })
    ]
    getFolders('demo').map(function (folder) {
        // 排除min.js文件
        gulp.src([path.join('demo', folder, 'css/*.*'), '!' + path.join('demo', folder, 'css/*.min.css')])
            .pipe(sass())
            .pipe(autoprefixer({
                browsers: ['iOS >= 7', 'Android >= 4.1'],
                cascade: true,
                remove:true
            }))
            .pipe(postcss(processors))
            .pipe(cleanCSS())
            .pipe(rename({suffix: '.min'}))
            .pipe(gulp.dest(path.join('demo', folder, 'css')));
    });
});

// 监听文件变化
gulp.task('watch', function(){
    gulp.watch(['dev/sass/common/*.scss', 'dev/sass/*.scss'], gulp.series('buildCss'));
    gulp.watch('dev/js/*.js', gulp.series('buildJS'));
    gulp.watch('dev/libJs/*.js', gulp.series('buildLibJS'));
    gulp.watch('dev/libCss/*.*', gulp.series('buildLibCss'));
    // 监听html文件变化
    gulp.watch('*.html');
    // 监听demo文件夹下的文件变化
    // gulp.watch('demo/**/**/*.*', gulp.series('DemoJS', 'DemoSass'));
    gulp.watch('demo/**/js/*.js', gulp.series('DemoJS'));
    gulp.watch('demo/**/css/*.*', gulp.series('DemoSass'));
    gulp.watch('demo/**/*.*');
});

// 打包
gulp.task('build', gulp.parallel('buildJS', 'buildCss', 'buildLibJS', 'buildLibCss', 'DemoJS', 'DemoSass'));

gulp.task('default', gulp.series('build', 'watch'));