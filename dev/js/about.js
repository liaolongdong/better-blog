(function (window, document) {
    var aboutObj = {
        // 页面初始化函数
        init: function () {
            this.typeWriter();
        },
        // 打印效果
        typeWriter: function () {
            var authorIntroduction = new TypeWriter('#authorIntroduction');

            // 这个地方必须使用window绑定load事件，用document绑定不会执行
            window.addEventListener('load', function () {
                authorIntroduction.play();
            });
        }
    }
    // 初始化
    aboutObj.init();
})(window, document);