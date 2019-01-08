var gulp = require('gulp'),
    uglify = require('gulp-uglify'), // 压缩js文件
    autoprefixer = require('gulp-autoprefixer'), // 样式兼容前缀自动补全
    staticHash = require('gulp-static-hash'), // 静态文件加hash字符串
    sass = require('gulp-sass'), // 编译sass
    cleanCSS = require('gulp-clean-css'), // 压缩css文件
    babel = require('gulp-babel'), // 转义es6语法的gulp插件
    rename = require('gulp-rename'); // 文件重命名

// 压缩打包JS
gulp.task('buildJS', function() {
    gulp.src(['dev/js/*.js'])
        .pipe(staticHash({asset: 'static'}))
        .pipe(babel({
            presets: ['env']
        }))
        .pipe(uglify())
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('assets/js'))
});

// 编译打包sass
gulp.task('buildCss', function() {
    gulp.src(['dev/sass/app.scss'])
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

gulp.task('default', ['buildJS', 'buildCss', 'watch']);