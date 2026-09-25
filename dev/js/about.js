(function (window, document) {
    var BASE_URL = window.SITE_BASEURL || '';
    // canvas-nest 画的是深色底上的星链（连线白、点黑），白昼态换成全站暖纸底之后就没有
    // 可依附的背景了，所以从「进页面就加载」改成「进夜间才注入、切回白昼就 stop」。
    var STAR_SRC = BASE_URL + '/assets/js/canvas-nest.min.js';

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
         * 轴上的墨跟着阅读位置流。
         *
         * 只写一个 --tl-p（0~1），CSS 那边用 translate 把它换成高度——transform 走合成器，
         * 不碰 width / height / top，滚动时不参与重排。视口 62% 那条线当作「正在读的地方」，
         * 所以轴永远比视线慢不了半屏。写在 wrap 而不是 page 上：两块内容两根轴各流各的，
         * CSS 继承让这一格只影响自己 wrap 里的那根（.p-about 上仍有默认 1 兜住无 JS）。
         */
        inkFlow: function (wrap) {
            var fill = wrap.querySelector('.tl-axis-fill');
            if (!fill) {
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
                var line = window.innerHeight * .62;
                var p = (line - box.top) / box.height;
                // 年表下面还压着页脚，「还能往下滚」的距离比轴剩下的高度短，那条视线就永远
                // 追不到轴的末梢（390×844 实测滚到底只有 .9551，针尖离最后一行差 85px）。
                // 把剩余滚动量并进分子，得到「滚到页底那天 p 能到的值」当上限去除：针就在
                // 真正滚不动的那一刻收口。上限已经 ≥1 时不除——那说明轴先于页底走完，
                // 除了反而会让墨跑得比视线快。
                var left = document.documentElement.scrollHeight - window.innerHeight - (window.pageYOffset || 0);
                var cap = (line - box.top + (left > 0 ? left : 0)) / box.height;
                if (cap > 1) {
                    cap = 1;
                }
                if (cap > 0) {
                    p /= cap;
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
         * 当前年份，取其中最靠后的一行。之前是 IO 与滚帧两套判据并存（IO 用 -100px 的窄带，
         * 兜底用 <=110），点「2021」跳过去落点在 121，两套各说各话：高亮停在 2020，
         * 长行还会来回闪。
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
                if (!item || current === item) {
                    return;
                }
                if (current) {
                    current.chip.classList.remove('is-on');
                }
                current = item;
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
                // 判据线读 .tl-row 的 scroll-margin-top（= calc(var(--tl-top) + 16px)），
                // 不抄 105 / 97 这些数：窄屏换档（实测 1200×800 是 121、390×844 是 113）、
                // 顶栏收起（--tl-top 换成 41）、余量改动都跟着 CSS 走。
                // +1 的余量是给亚像素落点的：滚动只能停在整数设备像素上，行顶本身带小数。
                // 1200×800 实测逐个点胶囊，顶栏收起那一态落点 56.6 ~ 57.4（线 57）、
                // 露出那一态 121.1 ~ 121.2（线 121），也就是线上下半像素地摆，
                // 谁过线纯看取整运气。候选行相邻顶距实测最小 38px（1440×900 与 390×844
                // 同值——断更的那几年现在也有胶囊、也参与判定，而它只占一条窄行的高度），
                // 1px 的口子不会误抓到下一行。
                var line = parseFloat(getComputedStyle(items[0].row).scrollMarginTop) + 1;
                var pick = null;
                for (var p = 0; p < items.length; p++) {
                    if (items[p].row.getBoundingClientRect().top <= line) {
                        pick = items[p];
                    }
                }
                activate(pick || items[0]);
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
