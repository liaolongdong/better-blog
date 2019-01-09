var gulp = require('gulp'),
    fs = require('fs'), // 文件系统
    path = require('path'), // 路径处理
    uglify = require('gulp-uglify'), // 压缩js文件
    autoprefixer = require('gulp-autoprefixer'), // 样式兼容前缀自动补全
    staticHash = require('gulp-static-hash'), // 静态文件加hash字符串
    sass = require('gulp-sass'), // 编译sass
    cleanCSS = require('gulp-clean-css'), // 压缩css文件
    postcss = require('gulp-postcss'),
    pxtoviewport = require('postcss-px-to-viewport'), // px转vw
    babel = require('gulp-babel'), // 转义es6语法的gulp插件
    rename = require('gulp-rename'); // 文件重命名

// 压缩打包JS
gulp.task('buildJS', function() {
    gulp.src('dev/js/index.js')
        .pipe(staticHash({asset: 'static'}))
        // .pipe(babel({
        //     presets: ['env']
        // }))
        .pipe(uglify())
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('assets/js'))
});

// 编译打包sass
gulp.task('buildCss', function() {
    gulp.src('dev/sass/app.scss')
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

// demo文件夹js使用babel
gulp.task('DemoJS', function () {
    getFolders('demo').map(function (folder) {
        gulp.src(path.join('demo', folder, 'js/*.*'))
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
        gulp.src(path.join('demo', folder, 'css/*.*'))
            .pipe(sass())
            .pipe(autoprefixer({
                browsers: ['iOS >= 7', 'Android >= 4.1'],
                cascade: true,
                remove:true
            }))
            .pipe(postcss(processors))
            .pipe(gulp.dest(path.join('demo', folder, 'css')));
    });
});

// 监听文件变化
gulp.task('watch', function(){
    gulp.watch('dev/sass/*.scss', ['buildCss']);
    gulp.watch('dev/js/*.js', ['buildJS']);
    // 监听html文件变化
    gulp.watch('*.html');
    // 监听demo文件夹下的文件变化
    gulp.watch('demo/**/**/*.*');
    gulp.watch('demo/**/*.*');
});

gulp.task('default', ['buildJS', 'buildCss', 'DemoJS', 'DemoSass', 'watch']);