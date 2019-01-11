(function (window, document) {
    var aboutObj = {
        // 页面初始化函数
        init: function () {
            this.typeWriter();
            this.scrollPointChange();
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
        }
    }
    // 初始化
    aboutObj.init();
})(window, document);