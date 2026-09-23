$(document).ready(function () {
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

    // 昼夜图标成对显隐：夜间露出太阳、白天露出月亮。
    // 白天态与 bottomFixedBtn.scss 里 .icon-baitianmoshimingliangmoshi{display:none} 的默认值一致。
    function syncNmIcon (mode) {
        if (mode === 'night') {
            $('.icon-yejianmoshi').hide();
            $('.icon-baitianmoshimingliangmoshi').show();
        } else {
            $('.icon-baitianmoshimingliangmoshi').hide();
            $('.icon-yejianmoshi').show();
        }
    }

    // 主题真值只有 window.EditorialTheme 一份（未表过态=跟随系统偏好，点过一次=固定其所选）。
    // 本文件只负责把这份真值反映到按钮图标上，不再自己读写 daytimeMode，也不碰页面样式，
    // 避免两处语义打架；夜间态的视觉差异全部由 body.night-mode 下的令牌覆盖承担。
    // 依赖顺序：footer.html 早于 editorial.min.js，但下面的逻辑都在 .ready 回调里，
    // 而 EditorialTheme 是在 editorial.min.js 求值期同步挂到 window 上的，取值时一定已就绪。
    var nmEnabled = function () {
        return $('#nm-switch').val() === 'true';
    };

    // 初始化白昼模式
    function initDaytimeMode () {
        if (!nmEnabled()) {
            return;
        }
        syncNmIcon(window.EditorialTheme.get());
    }
    initDaytimeMode();

    // 点击白昼切换模式
    $('.switch-daytime-mode').on('click', function () {
        if (!nmEnabled()) {
            return;
        }
        var mode = window.EditorialTheme.get() === 'day' ? 'night' : 'day';
        window.EditorialTheme.set(mode);
        syncNmIcon(mode);
    });
})