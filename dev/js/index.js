$(document).ready(function(){
    var nav = $('.g-nav');

    /**
     * Responsive Navigation
     */
    $('#menu-toggle').on('click', function(e) {
        var duration = 200;
        // slideToggle 之后立刻读 :visible 并不可靠（jQuery 在动画收尾才改 display），
        // 所以在切换前先取反当前可见态作为目标状态。
        var willOpen = !nav.is(':visible');
        nav.slideToggle(duration);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
        $(document).one('click', function() {
            nav.slideUp(duration);
            $('#menu-toggle').attr('aria-expanded', 'false');
        });
        e.stopPropagation();
    });

    nav.on('click', function(e) {
        e.stopPropagation();
    });

    /*
    *  Header Bar
    *
    *  只负责切换状态类（is-scrolled / headerUp / headerDown），外观全部交给
    *  common.scss：原先这里用 header.css() / logo.css() 写内联样式，
    *  既无法跟随夜间模式，也让顶栏在页面加载瞬间是透明的（新刊头是浅底，
    *  透明态下的白字导航会直接看不见）。
    */
    var header = $('.g-header');
    if (header.length) {
        var headerHeight = header.outerHeight();
        var scFlag = $(document).scrollTop();

        function measureHeader() {
            headerHeight = header.outerHeight();
        }

        $(document).scroll(function() {
            // 断点判断放在每次滚动里，而不是加载时求值一次：后者让平板转屏、
            // 桌面拖窗口跨过 695px 之后与页面永久失配（窄屏进来的页面从此没有
            // 自动隐藏，宽屏进来的则在窄屏下继续藏）。窗口宽度读取不触发布局。
            if (window.innerWidth <= 695) {
                header.removeClass('is-scrolled headerUp headerDown');
                return;
            }

            var scrollTop = $(document).scrollTop();
            var goingDown = scrollTop > scFlag;
            scFlag = scrollTop;

            header.toggleClass('is-scrolled', scrollTop > headerHeight);

            if (scrollTop <= 3 * headerHeight) {
                header.removeClass('headerUp headerDown');
                return;
            }

            // 两态必须在这里互斥，不能指望 CSS 里谁写在后面：上一版向下滚时
            // headerUp 与 headerDown 同时挂上，排在后面的 headerDown 把位移抵消，
            // 顶栏从来没藏过；向上滚只剩 headerUp，反而在该露出的时候隐身。
            // 阈值是三倍顶栏高（实测 195px），不是「三屏」。
            header.toggleClass('headerUp', goingDown);
            header.toggleClass('headerDown', !goingDown);
        });

        // 高度会变的两件事：转屏（.g-header 在 ≤695 下是 56px）与 webfont 落地
        // （.logo-word 换一次度量）。阈值和 translateY(-100%) 都按它算，取旧值会错位。
        $(window).on('resize', measureHeader);
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
            document.fonts.ready.then(measureHeader);
        }
    }

    /*
    * Post Cover Resize
    */
    function postCover(img, container) {
        var imgWidth = img.width();
        var containerWidth = container.width();
        var imgHeight = img.height();
        var containerHeight = container.height();

        if (imgHeight < containerHeight) {
            img.css({
                'width': 'auto',
                'height': '100%'
            });
            imgWidth = img.width(),
            containerWidth = container.width();
            var marginLeft = (imgWidth - containerWidth) / 2;
            img.css('margin-left', '-' + marginLeft + 'px');
        } else {
            var marginTop = (containerHeight - imgHeight) / 2;
            img.css('margin-top', marginTop + 'px');
        }

        img.fadeIn();
    }

    /**
     * The Post Navigator
     */
    $('.read-next-item section').each(function() {
        var n = $(this).height();
        var rn = $('.read-next-item').height();
        $(this).css('margin-top', (rn - n) / 2 + 'px');
        $(this).fadeIn();
    });

    $('.read-next-item img').each(function(){
        postCover($(this), $('.read-next-item'));
    });

    /**
     * Pagination
     */
    function pagination() {
        var total = parseInt($('#total_pages').val(), 10);
        var current = parseInt($('#current_pages').val(), 10);
        var baseUrl = $('#base_url').val();
        var limit = 3;

        var link_html = '';

        for (var i = current - limit; i < current; i++) {
            if (i > 0 && i !== 1) {
                link_html += '<a href="' + baseUrl + '/page' + i + '/" class="page-link page-num">' + i + '</a>';
            } else if (i === 1) {
                link_html += '<a href="' + baseUrl + '/" class="page-link page-num">' + i + '</a>';
            }
        }

        link_html += '<span class="page-link page-num active">' + current + '</span>';

        for (var j = current + 1; j <= current + limit; j++) {
            if (j <= total) {
                link_html += '<a href="' + baseUrl + '/page' + j + '/" class="page-link page-num">' + j + '</a>';
            }
        }

        $('#page-link-container').html(link_html);
    }
    pagination();

    // demo.html 的列表不再在这里回填：条目已由 demo.html 在构建期用
    // site.data.demoLists（_plugins/demo_data.rb 读仓库根的 demo.json）服务端渲染，
    // 禁用 JS 的访客与爬虫都能直接读到 19 条链接。
});