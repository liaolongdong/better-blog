$(document).ready(function () {
    // 「小屏不出这组浮层」的判据在 bottomFixedBtn.scss 的 @media 里，不在这里：
    // 原先读的是 window.screen.width（屏幕宽度，不是视口宽度），窄窗口的桌面
    // 会被误判成手机、横屏的手机又漏判，还会在首屏留下一次 hide() 的闪烁。
    // 这组浮层是全站唯一的昼夜切换与返回顶部入口，换判据不等于改口径（小屏依旧不出）。
    var $pct = $('.scrollpercent');
    var $top = $('.back-to-top');
    var lastPercent = null;

    // 监听窗口滚动事情
    function syncScrollPercent () {
        var scrollValue = $(window).scrollTop();
        // 分母为 0（页面滚不动 / 刚进页面布局未稳）时按 0 算，
        // 否则 Infinity 会被下面的上限夹成 100，一进来就显示「已读完」
        var scrollable = utils.getContentVisibilityHeight();
        var scrollPercentMaxed = scrollable > 0
            ? Math.min(100, Math.round((scrollValue / scrollable) * 100))
            : 0;
        // 读数与无障碍名称一起改：scroll 一帧能来好几次，数字没变就不写 DOM。
        if (scrollPercentMaxed !== lastPercent) {
            lastPercent = scrollPercentMaxed;
            $pct.html(scrollPercentMaxed);
            // 百分比那截是 aria-hidden 的纯视觉读数，读屏拿不到，所以同步进无障碍名称；
            // 固定语义在前，数字在后。
            $top.attr('aria-label', '返回顶部，已阅读 ' + scrollPercentMaxed + '%');
        }
        // 显隐由 .is-shown 类驱动（见 bottomFixedBtn.scss）。不再用 fadeIn/fadeOut：
        // 它按标签名回填 display，<button> 会被放回 inline-block，
        // 淡入收尾那一刻这颗按钮就从竖排掉进横排。
        $top.toggleClass('is-shown', scrollValue > 100);
    }

    // resize 也要重算：分母里有 window.innerHeight，窗口变矮后可滚距离变小，
    // 不重算就会一直停在旧比例上（只有滚一下才更新）。
    $(window).on('scroll resize', syncScrollPercent);
    syncScrollPercent();

    // 点击返回顶部
    $('.back-to-top').click(function () {
        // reduce 档直接跳顶：base.scss 那条 !important 只压得住 CSS 动画，管不了
        // jQuery 的逐帧滚动，所以这处得自己判 —— 与 about.js / cat.js 的写法一致。
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            $('html, body').scrollTop(0);
            return;
        }
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