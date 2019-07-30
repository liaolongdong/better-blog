(function (window, document) {
    // // 不使用虚拟代理加载图片
    // var myImage = (function () {
    //     var imgNode = document.createElement('img');
    //     document.body.appendChild(imgNode);
    //     return {
    //         setSrc: function (src) {
    //             imgNode.src = src;
    //         }
    //     }
    // })();
    // // myImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');

    // // 使用虚拟代理与加载图片
    // var proxyImage = (function () {
    //     var image = new Image();
    //     image.onload = function () {
    //         myImage.setSrc(this.src);
    //     }
    //     return {
    //         setSrc: function (src) {
    //             myImage.setSrc('E:/demo/liaolongdong.github.io/assets/img/profile.png');
    //             image.src = src;
    //         }
    //     }
    // })();
    // proxyImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');

    // 把代理对象和本体对象改为一个函数（函数也是对象），函数必然都能被执行，则可以认为它们也具有一致的“接口”
    var myImage = (function () {
        var imgNode = document.createElement('img');
        document.body.appendChild(imgNode);
        return function (src) {
            imgNode.src = src;
        }
    })();
    
    var proxyImage = (function () {
        var image = new Image();
        image.onload = function () {
            myImage(this.src);
        }
        return function (src) {
            myImage('E:/demo/liaolongdong.github.io/assets/img/profile.png');
            image.src = src;
        }
    })();
    
    proxyImage('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');


    // // 不使用虚拟代理预加载图片
    // var myImage = (function () {
    //     var imgNode = document.createElement('img');
    //     document.body.appendChild(imgNode);
    //     var image = new Image();
    //     image.onload = function () {
    //         imgNode.src = image.src;
    //     };
    //     return {
    //         setSrc: function (src) {
    //             imgNode.src = 'E:/demo/liaolongdong.github.io/assets/img/profile.png';
    //             image.src = src;
    //         }
    //     }
    // })();
    // myImage.setSrc('https://pic1.zhimg.com/v2-0391689010c83495ba3923cd04c71206_1200x500.jpg');
})(window, document);