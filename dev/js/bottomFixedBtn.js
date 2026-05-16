$(document).ready(function () {
    var BASE_URL = window.SITE_BASEURL || '';
    var pageRelPath = window.location.pathname.replace(BASE_URL, '') || '/';
    // 判断是否为移动端
    if (utils.isMobile()) {
        // $('.back-to-top').hide();
        $('.bottom-fixed-btn').hide();
        return;
    }

    // 监听窗口滚动事情
    $(window).scroll(function () {
        var scrollValue = $(window).scrollTop();
        var scrollPercentRounded = Math.round((scrollValue / utils.getContentVisibilityHeight()) *
            100);
        var scrollPercentMaxed = (scrollPercentRounded > 100) ? 100 : scrollPercentRounded;
        $('.scrollpercent').html(scrollPercentMaxed);
        scrollValue > 100 ? $('.back-to-top').fadeIn() : $('.back-to-top').fadeOut();
    });

    // 点击返回顶部
    $('.back-to-top').click(function () {
        $('html, body').animate({
            scrollTop: 0
        }, 300);
    });

    // about页面白昼切换 默认day night夜间模式
    function aboutMode (mode) {
        // 判断是否为about页面
        if (pageRelPath !== '/about.html') {
            return;
        }
        if (mode === 'night') {
            // 切换about页面到夜间模式
            $('body').css('background', '#282c33');
            $('.daytime-container').hide();
            $('.night-container').show();
        } else {
            // 切换about页面白天模式
            $('.night-container').hide();
            $('body').css('background-image', 'url(' + BASE_URL + '/assets/img/about_bg.png)');
            $('body').css('background-repeat', 'no-repeat');
            $('body').css('background-size', 'cover');
            $('body').css('background-attachment', 'fixed');
            $('.daytime-container').show();
        }
    }

    // 初始化白昼模式
    function initDaytimeMode () {
        // 记录当前模式 'day'白天 'night'夜间模式
        var mode = localStorage.getItem('daytimeMode') || 'day';
        if (mode === 'night') {
            // 切换图标
            $('.icon-yejianmoshi').hide();
            $('.icon-baitianmoshimingliangmoshi').show();
            // 切换到夜间模式
            if ($('#nm-switch').val() === 'true') {
                $('body').addClass('night-mode');
                aboutMode('night');
            }
        }

    }
    initDaytimeMode();
    
    // 点击白昼切换模式
    $('.switch-daytime-mode').on('click', function () {
        // 记录当前模式 'day'白天 'night'夜间模式
        var mode = localStorage.getItem('daytimeMode') || 'day';
        if (mode === 'day') {
            localStorage.setItem('daytimeMode', 'night');
            // 切换图标
            $('.icon-yejianmoshi').hide();
            $('.icon-baitianmoshimingliangmoshi').show();
            // 切换到夜间模式
            if ($('#nm-switch').val() === 'true') {
                $('body').addClass('night-mode');
                aboutMode('night');
            }
        } else if (mode === 'night') {
            localStorage.setItem('daytimeMode', 'day');
            // 切换图标
            $('.icon-baitianmoshimingliangmoshi').hide();
            $('.icon-yejianmoshi').show();
            // 切换到白天模式
            if ($('#nm-switch').val() === 'true') {
                $('body').removeClass('night-mode');
                aboutMode('day');
            }
        }
    });
})