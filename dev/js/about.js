(function (window, document) {
    var BASE_URL = window.SITE_BASEURL || '';
    // canvas-nest 画的是深色底上的星链（连线白、点黑），白昼态换成全站暖纸底之后就没有
    // 可依附的背景了，所以从「进页面就加载」改成「进夜间才注入、切回白昼就 stop」。
    var STAR_SRC = BASE_URL + '/assets/js/canvas-nest.min.js';

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /**
     * 落点线：点一颗胶囊会把那一行的行顶放到的视口高度，同时也就是「这一行算不算当前年」
     * 的判据线。三个消费者（胶囊跳转的落点由 CSS 的 scroll-margin-top 定、滚动跟随、
     * 墨流）必须从这里取同一个值，否则就会出现「点 2019 落在 A 处，而墨和胶囊按 B 处判定」。
     * +1 的余量是给亚像素落点的：滚动只能停在整数设备像素上，行顶本身带小数。
     */
    function landingLine(row) {
        return parseFloat(window.getComputedStyle(row).scrollMarginTop) + 1;
    }

    var aboutObj = {
        // 页面初始化函数
        init: function () {
            this.typeWriter();
            this.timeline();
            this.alignChipJump();
            this.starField();
        },
        // 打印效果
        typeWriter: function () {
            var el = document.querySelector('#authorIntroduction');
            if (!el) {
                return;
            }
            // 「减少动态效果」下不打字，直接把五行原样露出来：about.scss 为了不让打印前
            // 闪一下，把容器设成了 visibility: hidden，不打印就必须自己摘掉。
            if (reducedMotion()) {
                el.style.visibility = 'visible';
                return;
            }
            // 24ms/字符。库里默认是 100，而这段自我介绍实测 129 个字符（去掉空白 117）、
            // 5 个自然段——光按字符数乘，默认档就要 12.9 秒才打完，五行「我是谁」要等十
            // 几秒才读得完，那不是节奏而是延迟。
            // 24ms 仍然看得见一笔一笔出来：MutationObserver 记的起止点显示首字符就在
            // load 之后 1ms，末字符在 load 之后 4874ms；1440×900、695、390、320 四档视口
            // 的读数一致到个位毫秒。
            var authorIntroduction = new TypeWriter('#authorIntroduction', 24);

            // 这个地方必须使用window绑定load事件，用document绑定不会执行
            window.addEventListener('load', function () {
                // play() 里的 Sheet 构造器会把这个容器的子节点逐个 removeChild 摘走，
                // 打印过程中容器只剩 min-height。占位的数只能现量：这段介绍每折一行多
                // 26px，折几行却看视口（实测 696 以上 150、414~695 130、390 156、
                // 375 182、360 208、320 260），写死在 CSS 里必然两头错，理由见
                // about.scss 里那条 visibility。摘之前量，量到的就是打印结束时的终高。
                el.style.minHeight = el.offsetHeight + 'px';
                authorIntroduction.play();
            });
        },
        /**
         * 年表：入场揭示、轴上的墨、吸顶年份胶囊的滚动跟随。
         *
         * 「工作履历」和「写在这里的每一年」是两块各带一根轴的独立内容（about.html），
         * 所以轴按 wrap 逐条装，行与胶囊则并成一批共一套判据。三件事都不在
         * 「减少动态效果」下运行。旧版这里挂的是 noframework.waypoints（全站唯一消费点，
         * 10,478 B），它当初只负责「滚过 80% 给卡片刷上点亮色」；而桌面那套入场是按
         * animation-delay 在载入那一秒播完的，滚到年表时动画早已结束。现在入场改由 IO
         * 触发，轴由滚动位置驱动。
         */
        timeline: function () {
            var page = document.querySelector('.p-about');
            var wraps = page ? page.querySelectorAll('.tl-wrap') : [];
            if (!wraps.length) {
                return;
            }
            var io = 'IntersectionObserver' in window;
            var animate = io && !reducedMotion();

            // 轴脚留白是版面问题，不是动画问题：「减少动态效果」或者浏览器没有
            // IntersectionObserver 时，末尾几颗胶囊一样得跳得动，所以走在 animate 那两
            // 道门之前。
            this.tailRoom(page);

            // 未揭示态由 .tl-in 限定（about.scss），所以这几门只在真要播动画时才装；
            // 不装就是「全部已揭示」的终态，脚本没跑也一样读得通。
            if (!animate) {
                return;
            }
            var rows = [];
            for (var i = 0; i < wraps.length; i++) {
                var lined = wraps[i].querySelectorAll('.tl-row');
                // 空的那块没有高度，轴也就不必装：inkFlow 要拿 wrap 的高度做除数。
                if (!lined.length) {
                    continue;
                }
                for (var r = 0; r < lined.length; r++) {
                    rows.push(lined[r]);
                }
                this.inkFlow(wraps[i]);
            }
            if (!rows.length) {
                return;
            }
            this.reveal(page, rows);
            this.yearSpy(rows);
        },
        /**
         * 年表轴脚留白（--tl-tail）现量。
         *
         * 这段空白只有一个职责：让最后一行的行顶也能被顶到「点胶囊的落点线」下面。
         * 少了它，末尾几颗胶囊点了页面不动、滚动跟随也追不上——695×900 实测按 CSS 常数
         * 留 360px 时这一行滚到底仍停在 168.2（线在 113），差 55px 就是差 55px。
         *
         * 需要多少 = 视口高 − 落点线 − 最后一行高 − 收口句高 − 收口句以下的一切。
         * 这五个量里只有落点线是「样式给的」，其余四个全跟着内容和视口走，而落点线自己
         * 还分展开 / 收起两态（见下面那条 MutationObserver）。所以两档媒体查询里那两个
         * 写死的数（420 / 540）注定一头短一头长，量出来的表在 .tl-end 那条注释里。
         * 现量之后统一多留 24px：不留这 24px 时最后一行的行顶正好压在线判据上，
         * 滚帧取整会让高亮在相邻两年之间来回跳。
         *
         * 值写在 .tl-wrap--years 自己身上（不是 .p-about）：轴脚只属于年表这一块，
         * 工作履历那块没有胶囊导航，跟着留白就只是凭空多出一截空白。
         */
        tailRoom: function (page) {
            var wrap = page.querySelector('.tl-wrap--years');
            var end = wrap ? wrap.querySelector('.tl-end') : null;
            var rows = wrap ? wrap.querySelectorAll('.tl-row') : [];
            if (!end || !rows.length) {
                return;
            }
            var last = rows[rows.length - 1];
            var SLACK = 24;
            var ticking = false;

            function measure() {
                ticking = false;
                var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
                var row = last.getBoundingClientRect();
                var note = end.getBoundingClientRect();
                // 「收口句以下的一切」= 文档高 − 句子的绝对底边。这一项和当前留白多高无关：
                // 改 --tl-tail 时句子底边和文档高一起动，差值不变。
                var below = document.documentElement.scrollHeight - (note.bottom + sy);
                var line = parseFloat(window.getComputedStyle(last).scrollMarginTop) || 0;
                var need = window.innerHeight - line - row.height - note.height - below + SLACK;
                wrap.style.setProperty('--tl-tail', (need > SLACK ? need : SLACK).toFixed(1) + 'px');
            }

            function queue() {
                if (!ticking) {
                    ticking = true;
                    window.requestAnimationFrame(measure);
                }
            }

            // 落点线有两个值：顶栏展开时是「顶栏 + 导航条 + 16」，收起时只剩「导航条 + 16」，
            // 桌面差整整一条顶栏（121 ↔ 57）。而滚到底那一下顶栏是收起的——向下滚 index.js
            // 就挂 headerUp，点胶囊时 alignChipJump 也按方向先把它预挂上。所以留白必须按
            // 收起后那条算，不然最后一行永远差一条顶栏的高度：700×900 实测按展开态算出
            // 399.6px，滚到底行顶停在 96.9 而线已经抬到 57，2026 照样点不动。
            // 这里不去抄 index.js 那个 695 断点：状态类一翻就重量，窄屏它永远不翻，
            // 桌面用户还没滚到底就已经换过好几回了。
            var header = document.querySelector('.g-header');
            if (header && window.MutationObserver) {
                new MutationObserver(queue).observe(header, { attributes: true, attributeFilter: ['class'] });
            }

            // 页脚也得盯着，因为它是这条算式的减数：那两行不蒜子计数（PV / UV）是异步回填的
            // （_includes/footer.html 里 '-' 换成八位数），320 窄屏下这一换就把页脚撑出
            // 一整行。同一份产物两次现量，「收口句以下的一切」实测 273.4 → 292.5，差的
            // 19.1px 正好是一行——回填晚于现量时留白就少算这么多，末尾那行差一点点顶不到线。
            // 页脚的高度不吃 --tl-tail（它在 .p-about 外面），所以这条观察不会自激。
            // 但必须等 DOM 解析完再挂：about.min.js 是同步脚本，就插在 <footer> 前面
            // （产物里脚本在 31603 字节、页脚在 34003 字节），init() 跑的那一刻 querySelector
            // 拿到的是 null，观察器静默不注册——320 实测把页脚撑高 240px，留白纹丝不动。
            function watchFooter() {
                var foot = document.querySelector('.g-footer');
                if (foot && window.ResizeObserver) {
                    new ResizeObserver(queue).observe(foot);
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', watchFooter);
            } else {
                watchFooter();
            }

            measure();
            // 字体换完、图片把版面挤稳之后各重量一次：这四个量里除了落点线全都会动。
            window.addEventListener('resize', queue);
            window.addEventListener('load', queue);
            if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
                document.fonts.ready.then(queue);
            }
        },
        /** 滚到哪一行，哪一行淡入 + 圆点弹出；同一批里按先后排 60ms 一档的错峰。 */
        reveal: function (page, rows) {
            // 只处理「进页面时已经在折叠线以下」的行：首屏一起淡入只会让人觉得加载慢
            // （口径同 editorial.js 的 initReveal）。一行都不在下面的话就不装 .tl-in，
            // 否则它们会永远停在未揭示态，没有 observer 来摘。
            var below = [];
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].getBoundingClientRect().top > window.innerHeight) {
                    below.push(rows[i]);
                }
            }
            if (!below.length) {
                return;
            }
            page.classList.add('tl-in');
            // 未揭示态是按 .p-about.tl-in 整片生效的，所以首屏那几行必须当场点名：
            // 它们不在观察名单里，不补这一步就会永远停在 opacity 0（390×844 实测 15 行
            // 里 13 行在折叠线以下，剩下 2 行一进来就在视口里；1440×900 是 12 / 3）。
            // 同一次任务里加完两个类，浏览器只算一次样式，1 → 1 不产生过渡，
            // 看上去就是「本来就在那儿」。
            for (var q = 0; q < rows.length; q++) {
                if (below.indexOf(rows[q]) < 0) {
                    rows[q].classList.add('is-in');
                }
            }
            var observer = new IntersectionObserver(function (entries) {
                var batch = [];
                for (var j = 0; j < entries.length; j++) {
                    if (entries[j].isIntersecting) {
                        batch.push(entries[j].target);
                    }
                }
                for (var k = 0; k < batch.length; k++) {
                    batch[k].style.setProperty('--tl-delay', Math.min(k, 5) * 60 + 'ms');
                    batch[k].classList.add('is-in');
                    observer.unobserve(batch[k]);
                }
            }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
            for (var m = 0; m < below.length; m++) {
                observer.observe(below[m]);
            }
        },
        /**
         * 墨流：把 --tl-p 从 0 推到 1，针尖停在「当前那一年」的节点圆心上。
         *
         * 只写一个 --tl-p（0~1），CSS 那边把它换成墨层高度（.tl-axis-fill 的 scaleY）与
         * 针尖位置（.tl-axis:after 的 top），两者读同一个数所以永远同格。写在 wrap 而不是
         * .p-about 上：两块内容两根轴各流各的，自定义属性继承让这一格只管自己 wrap 里那根
         * （.p-about 上的默认值 1 兜住无 JS 与减少动态效果这两态）。
         *
         * 判据不另起一套。早先这里自己拿「视口高 × 62%」当参考线，而导航条亮哪一颗走的是
         * landingLine()——390×844 上两条线差 410px（523 对 113），于是导航条亮着 2019、
         * 针尖却停在 2021 那一格，逐 260px 扫 17 个滚动位，每一位都不一致。
         * 用户报的「竖线条节点和导航 tab 的年份对不上、有偏差」就是这个 2 行的错位。
         * 现在两边同一条线：谁的行顶过了线，墨就走到谁的节点圆心，p 按「圆心在墨层行程里的
         * 位置」直接算出来，所以针尖与亮着的胶囊恒等（本地构建 390×844 与 1280×900 各扫
         * 17 位，不一致 0 个）。
         */
        inkFlow: function (wrap) {
            var fill = wrap.querySelector('.tl-axis-fill');
            var axis = wrap.querySelector('.tl-axis');
            var rows = wrap.querySelectorAll('.tl-row');
            if (!fill || !axis || !rows.length) {
                return;
            }
            // 默认值是 1（无 JS 的终态），真要播动画才先归零，否则会看到一条满格线突然退回去
            wrap.style.setProperty('--tl-p', '0');
            var ticking = false;

            function paint() {
                ticking = false;
                var box = wrap.getBoundingClientRect();
                if (box.bottom < 0 || box.top > window.innerHeight) {
                    return;
                }
                var line = landingLine(rows[0]);
                var target = null;
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].getBoundingClientRect().top <= line) {
                        target = rows[i];
                    }
                }
                // 墨层的行程 = 轴槽高 − 墨层的 bottom（年表那块 bottom 就是 --tl-tail，
                // 工作履历那块是 0）。不能用 offsetHeight：它取整，而 bottom 是算出来的小数。
                var span = axis.getBoundingClientRect().height - (parseFloat(window.getComputedStyle(fill).bottom) || 0);
                var p = 0;
                if (target && span > 0) {
                    var dot = target.querySelector('.tl-dot') || target;
                    var d = dot.getBoundingClientRect();
                    p = (d.top + d.height / 2 - axis.getBoundingClientRect().top) / span;
                }
                if (p < 0) {
                    p = 0;
                } else if (p > 1) {
                    p = 1;
                }
                wrap.style.setProperty('--tl-p', p.toFixed(4));
            }

            function onScroll() {
                if (!ticking) {
                    ticking = true;
                    window.requestAnimationFrame(paint);
                }
            }
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll);
            paint();
        },
        /**
         * 年份胶囊的滚动跟随。
         *
         * 判据只有一条：行顶已经走过「点胶囊会把这一行的行顶放到的那条线」，这一行就算
         * 当前年份，取其中最靠后的一行；一行都没过线就一颗都不点亮。之所以只留这一条——
         * 早先是 IO（-100px 窄带）与滚帧（<=110）两套并存，点「2021」跳过去落点在 121，
         * 两边各说各话：高亮停在 2020，长行还会来回闪。
         * 「无人过线就不亮」修的是另一件事：这里原本兜底点亮 items[0]，等于「2016 还没
         * 读到，导航条上它已经亮了」，而吸顶条上面还压着一整块「工作履历」（390×844 实测
         * y 0 / 415 / 864 三处过线的行都是 none），用户看到的正是「菜单和时间轴对不上年
         * 份」。点胶囊的落点与这里的判据是同一条线。
         */
        yearSpy: function (rows) {
            var track = document.querySelector('.tl-nav-track');
            var chips = {};
            var links = document.querySelectorAll('.tl-chip');
            for (var i = 0; i < links.length; i++) {
                chips[links[i].getAttribute('data-year')] = links[i];
            }
            // 行 → 胶囊。轴上断更的那些行现在也有自己那颗（虚线描边），两边一行一颗。
            // 这里仍按「取不到胶囊的行不参与判定」写：导航条和年表是 about.html 里两段
            // 各自算年份的 Liquid，真对不上时少判一行比整块报错更容易恢复。
            var items = [];
            for (var j = 0; j < rows.length; j++) {
                var chip = chips[rows[j].id.replace('tl-', '')];
                if (chip) {
                    items.push({ row: rows[j], chip: chip });
                }
            }
            if (!items.length) {
                return;
            }
            var current = null;

            function activate(item) {
                if (current === item) {
                    return;
                }
                if (current) {
                    current.chip.classList.remove('is-on');
                }
                current = item;
                if (!item) {
                    return;
                }
                item.chip.classList.add('is-on');
                // 胶囊条自己是横向滚动的容器：把它平移到视野中间，
                // 年份一多，当前那颗就不会跑到屏幕外面去。
                if (track) {
                    var cr = item.chip.getBoundingClientRect();
                    var tr = track.getBoundingClientRect();
                    var left = track.scrollLeft + (cr.left + cr.width / 2) - (tr.left + tr.width / 2);
                    track.scrollTo ? track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' }) : (track.scrollLeft = Math.max(0, left));
                }
            }

            function sync() {
                // 判据线 = landingLine()，也就是 .tl-row 的 scroll-margin-top（= calc(--tl-top
                // + 16px)）加 1：不抄 105 / 97 这些数，窄屏换档（实测 1200×800 是 121、
                // 390×844 是 113）、顶栏收起（--tl-top 换成 41）、余量改动都跟着 CSS 走。
                // 1200×800 实测逐个点胶囊，顶栏收起那一态落点 56.6 ~ 57.4（线 57）、
                // 露出那一态 121.1 ~ 121.2（线 121），也就是线上下半像素地摆，
                // 谁过线纯看取整运气。候选行相邻顶距实测最小 38px（1440×900 与 390×844
                // 同值——断更的那几年现在也有胶囊、也参与判定，而它只占一条窄行的高度），
                // 1px 的口子不会误抓到下一行。墨流（inkFlow）读的是同一条线，两边不会分家。
                var line = landingLine(items[0].row);
                var pick = null;
                for (var p = 0; p < items.length; p++) {
                    if (items[p].row.getBoundingClientRect().top <= line) {
                        pick = items[p];
                    }
                }
                // 没有行过线就保持全灭，别在这里往回兜一个 items[0]（原因见方法头）。
                activate(pick);
            }

            // sync 要把每一行的 top 读一遍（强制同步布局），所以滚动和 resize 都只排队一次，
            // 合到下一帧再做。首屏也要排一次：没有滚动事件可等，而高亮必须一进来就是对的。
            var ticking = false;
            function queue() {
                if (ticking) {
                    return;
                }
                ticking = true;
                window.requestAnimationFrame(function () {
                    ticking = false;
                    sync();
                });
            }
            window.addEventListener('scroll', queue, { passive: true });
            window.addEventListener('resize', queue);
            queue();
        },
        /**
         * 点胶囊：落点要按「跳完之后顶栏所在的那一态」算，而不是点击这一瞬的态。
         *
         * 浏览器只在锚点跳转发起的那一刻解析一次 scroll-margin-top，而顶栏的收 / 放
         * 是 index.js 在滚动过程中才切类的（--tl-top 跟着换档，见 about.scss 的
         * `.g-header.headerUp ~ .p-about`）。两件事不同步，错的量正好是一个顶栏高：
         * 1200×800 实测在收起态点「2020」向上跳，落点行顶 57.2，带子这时已经放回
         * 64~105，年标题（72.2）整个压在带子底下 47.8px——正是这次要修的「菜单和节点
         * 对不上」。所以在默认动作（跳转）之前先把顶栏摆成跳转结束后的那一态：向下
         * 一定会收、向上一定会放，判据就是 index.js 自己那句 scrollTop 比较方向。
         * 互斥地挂 headerUp / headerDown，跟 index.js 的写法保持一致，别留两个类。
         *
         * 这两行挂的类不是本方法独占的：index.js:57 在 scrollTop ≤ 3×顶栏高（它自己
         * 注释里实测 195px）那一档会把两个类一起摘掉，所以这里预置的态只在落点低于
         * 那条线时站得住。判据两处各写一份、没有共享，改动一侧要回看另一侧。
         */
        alignChipJump: function () {
            var header = document.querySelector('.g-header');
            if (!header) {
                return;
            }
            var links = document.querySelectorAll('.tl-chip');
            for (var i = 0; i < links.length; i++) {
                links[i].addEventListener('click', function () {
                    // 窄屏没有自动隐藏：index.js 在 <=695 直接摘掉状态类，这里抢着挂
                    // 反而会让带子跑到 0~41、把 --tl-top 改成 41。
                    if (window.innerWidth <= 695) {
                        return;
                    }
                    var row = document.getElementById(this.getAttribute('href').replace(/^#/, ''));
                    if (!row) {
                        return;
                    }
                    var line = parseFloat(getComputedStyle(row).scrollMarginTop);
                    var goingDown = row.getBoundingClientRect().top + window.pageYOffset - line > window.pageYOffset;
                    header.classList.toggle('headerUp', goingDown);
                    header.classList.toggle('headerDown', !goingDown);
                });
            }
        },
        // 夜间粒子效果：只在夜间档注入脚本，窄屏与「减少动态效果」下完全不加载
        starField: function () {
            // 窄屏屏蔽粒子的口径沿用原 refreshPage 的判断，不另起一套阈值
            if (window.screen.availWidth < 695) {
                return;
            }
            if (reducedMotion()) {
                return;
            }
            var root = document.documentElement;
            // 非空表示有一份星链归本页管着；切回白昼时调它停机摘布，置回 null。
            var live = null;
            var start = function () {
                // 脚本求值之前用户就可能已经切回白昼，armed 记下这个意愿，交给 onload 兜底。
                // 库的首帧走 setTimeout(…, 10)，晚于 onload，所以那时停掉是一帧都没画过的。
                var armed = true;
                var script = document.createElement('script');
                script.onload = function () {
                    if (!armed && window.CanvasNest) {
                        window.CanvasNest.stop();
                    }
                };
                script.onerror = function () {
                    live = null;
                };
                script.src = STAR_SRC;
                document.body.appendChild(script);
                live = function () {
                    armed = false;
                    if (window.CanvasNest) {
                        window.CanvasNest.stop();
                    }
                };
            };
            var sync = function () {
                if (root.classList.contains('night-mode')) {
                    if (!live) {
                        start();
                    }
                } else if (live) {
                    live();
                    live = null;
                }
            };
            sync();
            // night-mode 由 editorial.js 的 applyTheme 同时挂在 <html> 和 <body> 上，
            // 而 <head> 里的引导脚本只能写到 <html>，所以观察 documentElement 两种来源都覆盖得到。
            new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
        }
    };
    // 初始化
    aboutObj.init();
})(window, document);
