$(document).ready(function(){
    var BASE_URL = window.SITE_BASEURL || '';
    var pageRelPath = window.location.pathname.replace(BASE_URL, '') || '/';
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
    *  editorial.scss：原先这里用 header.css() / logo.css() 写内联样式，
    *  既无法跟随夜间模式，也让顶栏在页面加载瞬间是透明的（新刊头是浅底，
    *  透明态下的白字导航会直接看不见）。
    */
    if ($(window).width() > 695) {
        var header = $('.g-header');
        var headerHeight = header.outerHeight();
        var scFlag = $(document).scrollTop();

        $(document).scroll(function() {
            var scrollTop = $(this).scrollTop();

            if (scrollTop > headerHeight) {
                header.addClass('is-scrolled');
                // headerUp 必须两向切换：只加不减会让顶栏在往回滚到 1~3 屏高之间时仍然隐身。
                header.toggleClass('headerUp', scrollTop > 3 * headerHeight);
            } else {
                header.removeClass('is-scrolled headerUp');
            }

            header.toggleClass('headerDown', scFlag <= scrollTop);
            scFlag = scrollTop;
        });
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

    /**
     * demo page get demo data
     * 条目结构跟随 editorial.scss 的 .demo-list：一行一条、发丝线分隔，
     * 与分类/标签归档页的 .cat-row 同一套列表语言（示例没有日期，所以只有标题一列）。
     */
    if (/demo\.html$/.test(pageRelPath)) {
        $.getJSON(BASE_URL + '/demo.json').done(function(data) {
            var html = '';
            var demoLists = data.demoLists;
            for (var i = 0; i < demoLists.length; i++) {
                html += '<li class="demo-row"><a class="demo-link" target="_blank" rel="noopener" href="'
                + BASE_URL + '/' + demoLists[i].demoUrl + '" title="'
                + demoLists[i].title + '">'
                + demoLists[i].title + '</a></li>';
            }
            $('.demo-list').html(html);
        });
    }
});