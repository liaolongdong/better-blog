(function (window, document) {
    var BASE_URL = window.SITE_BASEURL || '';
    // canvas-nest 画的是深色底上的星链（连线白、点黑），白昼态换成全站暖纸底之后就没有
    // 可依附的背景了，所以从「进页面就加载」改成「进夜间才注入、切回白昼就 stop」。
    var STAR_SRC = BASE_URL + '/assets/js/canvas-nest.min.js';
    var aboutObj = {
        // 页面初始化函数
        init: function () {
            this.typeWriter();
            this.scrollPointChange();
            this.starField();
        },
        // 打印效果
        typeWriter: function () {
            var authorIntroduction = new TypeWriter('#authorIntroduction');

            // 这个地方必须使用window绑定load事件，用document绑定不会执行
            window.addEventListener('load', function () {
                authorIntroduction.play();
            });
        },
        // 滑动样式变换效果
        scrollPointChange: function () {
            function customWayPoint(className, addClassName, customOffset) {
                var itemNodes = document.querySelectorAll('.' + className);
                for (var i = 0; i < itemNodes.length; i++) {
                    new Waypoint({
                        element: itemNodes[i],
                        // 这里使用一个闭包（自执行函数），来逐一取i的值，而不是一直都是最后一个值
                        handler: (function (i) {
                            return function (direction) {
                                if (direction === 'down') {
                                    itemNodes[i].classList.add(addClassName);
                                } else {
                                    itemNodes[i].classList.remove(addClassName);
                                }
                            }
                        })(i),
                        offset: customOffset
                    });
                }
            }
            customWayPoint('timeline__item', 'timeline__item-bg', '80%');
        },
        // 夜间粒子效果：只在夜间档注入脚本，窄屏与「减少动态效果」下完全不加载
        starField: function () {
            // 窄屏屏蔽粒子的口径沿用原 refreshPage 的判断，不另起一套阈值
            if (window.screen.availWidth < 695) {
                return;
            }
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    }
    // 初始化
    aboutObj.init();
})(window, document);
