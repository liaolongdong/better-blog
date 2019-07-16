(function ($) {

    var container;

    // 可选颜色
    var colors = ['#96C2F1', '#BBE1F1', '#E3E197', '#F8B3D0', '#FFCC00'];

    // 初始许愿墙
    var wishCards = [
        {
            id: '1',
            text: '与君初相识，犹如故人归'
        },
        {
            id: '2',
            text: '情不知所起，一往而深'
        },
        {
            id: '3',
            text: '若不是情深似海，思念又怎么会泛滥成灾'
        },
        {
            id: '4',
            text: '嘴巴是撒谎的小坏蛋，身体是诚实的好少年'
        },
        {
            id: '5',
            text: '生活不止眼前的苟且，还有你读不懂的诗和到不了的远方'
        },
        {
            id: '6',
            text: '既然选择了远方，便只顾风雨兼程！'
        },
    ];

    // 读取本地存储的数据
    var localData = localStorage.getItem('wishCards');
    if (localData) {
        wishCards = JSON.parse(localData);
    }

    //创建许愿页
    var createItem = function (card) {
        var color = colors[parseInt(Math.random() * 5, 10)]
        $('<div class="item"><p>' + card.text + '</p><a id="' + card.id + '" href="#">删除</a></div>').css({ 'background': color }).appendTo(container).drag();
    };

    // 定义拖拽函数
    $.fn.drag = function () {

        var $this = $(this);
        var parent = $this.parent();

        var pw = parent.width();
        var ph = parent.height();
        var thisWidth = $this.width() + parseInt($this.css('padding-left'), 10) + parseInt($this.css('padding-right'), 10);
        var thisHeight = $this.height() + parseInt($this.css('padding-top'), 10) + parseInt($this.css('padding-bottom'), 10);
        var x, y, positionX, positionY;
        var isDown = false;
        var randY = parseInt(Math.random() * (ph - thisHeight), 10);
        var randX = parseInt(Math.random() * (pw - thisWidth), 10);
        parent.css({
            "position": "relative",
            "overflow": "hidden"
        });

        $this.css({
            "cursor": "move",
            "position": "absolute"
        }).css({
            top: randY,
            left: randX
        }).mousedown(function (e) {
            parent.children().css({
                "zIndex": "0"
            });
            $this.css({
                "zIndex": "1"
            });
            isDown = true;
            x = e.pageX;
            y = e.pageY;
            positionX = $this.position().left;
            positionY = $this.position().top;
            return false;
        });


        $(document).mouseup(function (e) {
            isDown = false;
        }).mousemove(function (e) {
            var xPage = e.pageX;
            var moveX = positionX + xPage - x;
            var yPage = e.pageY;
            var moveY = positionY + yPage - y;
            if (isDown == true) {
                $this.css({
                    "left": moveX,
                    "top": moveY
                });
            } else {
                return;
            }
            if (moveX < 0) {
                $this.css({
                    "left": "0"
                });
            }
            if (moveX > (pw - thisWidth)) {
                $this.css({
                    "left": pw - thisWidth
                });
            }
            if (moveY < 0) {
                $this.css({
                    "top": "0"
                });
            }
            if (moveY > (ph - thisHeight)) {
                $this.css({
                    "top": ph - thisHeight
                });
            }
        });
    };

    // 初始化
    var init = function () {

        container = $('#container');

        // 绑定关闭事件
        container.on('click', 'a', function () {
            // 删除对应的卡片
            wishCards = wishCards.filter((item) => {
                return item.id !== this.id;
            });
            // 存储到本地localStorage
            localStorage.setItem('wishCards', JSON.stringify(wishCards));
            $(this).parent().remove();
        }).height(($(window).height() - 200) < 0 ? 520 : ($(window).height() - 200))
            .width(($(window).width() - 200) < 0 ? '100%' : $(window).width());

        // 渲染许愿墙卡片
        $.each(wishCards, function (i, v) {
            createItem(v);
        });

        // // 绑定输入框
        // $('#input').keydown(function (e) {
        //     var $this = $(this);
        //     if (e.keyCode == '13') {
        //         var value = $this.val();
        //         if (value) {
        //             var cardObj = {
        //                 // 生成随机id
        //                 id: Math.random().toString(32).substring(2),
        //                 text: value
        //             };
        //             createItem(cardObj);
        //             // 添加到卡片列表
        //             wishCards.push(cardObj);
        //             // 存储到本地localStorage
        //             localStorage.setItem('wishCards', JSON.stringify(wishCards));
        //             $this.val('');
        //         }
        //     }
        // });

        // 点击提交按钮
        $('#submit').click(function (e) {
            var value = $('#input').val();
            // 匹配换行符
            value = value.replace(/\n|\r/g, '<br/>');
            console.log('value', value);
            if (value) {
                var cardObj = {
                    // 生成随机id
                    id: Math.random().toString(32).substring(2),
                    text: value
                };
                createItem(cardObj);
                // 添加到卡片列表
                wishCards.push(cardObj);
                // 存储到本地localStorage
                localStorage.setItem('wishCards', JSON.stringify(wishCards));
                $('#input').val('');
            }
        });

    };

    $(function () {
        init();
    });

})(jQuery);