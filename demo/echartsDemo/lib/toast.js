(function (win, doc) {
    var Toast = {
        // 引入toast样式
        importCss: function () {
            var hasStyle = doc.querySelector('.toast-css');
            if (hasStyle) {
                return;
            }
            var style = doc.createElement('style');
            style.type = 'text/css';
            style.className = 'toast-css';
            style.innerHTML = '.c-toast {' +
            '    position: fixed;' +
            '    top: 0;' +
            '    left: 0;' +
            '    display: -webkit-box;' +
            '    display: -webkit-flex;' +
            '    display: flex;' +
            '    -webkit-box-pack: center;' +
            '    -webkit-justify-content: center;' +
            '    justify-content: center;' +
            '    -webkit-box-align: center;' +
            '    -webkit-align-items: center;' +
            '    align-items: center;' +
            '    width: 100%;' +
            '    height: 100%;' +
            '    z-index: 200;' +
            '    background: 0 0' +
            '}' +

            '.c-toast .toast-content {' +
            '    padding: 2.667vw 4vw;' +
            '    max-width: 50%;' +
            '    text-align: center;' +
            '    font-size: 4vw;' +
            '    color: #fff;' +
            '    background-color: rgba(58, 58, 58, .9);' +
            '    border-radius: .667vw' +
            '}' +

            '.c-toast .toast-loading {' +
            '    display: -webkit-box;' +
            '    display: -webkit-flex;' +
            '    display: flex;' +
            '    -webkit-box-orient: vertical;' +
            '    -webkit-box-direction: normal;' +
            '    -webkit-flex-direction: column;' +
            '    flex-direction: column;' +
            '    -webkit-box-pack: center;' +
            '    -webkit-justify-content: center;' +
            '    justify-content: center;' +
            '    -webkit-box-align: center;' +
            '    -webkit-align-items: center;' +
            '    align-items: center;' +
            '    border-radius: .66667vw;' +
            '    padding: 2vw;' +
            '    min-width: 8vw;' +
            '    font-size: 3.467vw;' +
            '    color: #fff;' +
            '    background-color: rgba(58, 58, 58, .9);' +
            '    line-height: 1.5' +
            '}' +

            '@-webkit-keyframes loading {' +
            '    from {' +
            '        -webkit-transform: rotateZ(0);' +
            '        transform: rotateZ(0)' +
            '    }' +

            '    to {' +
            '        -webkit-transform: rotateZ(360deg);' +
            '        transform: rotateZ(360deg)' +
            '    }' +
            '}' +

            '@keyframes loading {' +
            '    from {' +
            '        -webkit-transform: rotateZ(0);' +
            '        transform: rotateZ(0)' +
            '    }' +

            '    to {' +
            '        -webkit-transform: rotateZ(360deg);' +
            '        transform: rotateZ(360deg)' +
            '    }' +
            '}' +

            '.c-toast .loading-img {' +
            '    -webkit-animation-name: loading;' +
            '    animation-name: loading;' +
            '    -webkit-animation-fill-mode: both;' +
            '    animation-fill-mode: both;' +
            '    -webkit-animation-duration: 1.5s;' +
            '    animation-duration: 1.5s;' +
            '    -webkit-animation-timing-function: linear;' +
            '    animation-timing-function: linear;' +
            '    -webkit-animation-iteration-count: infinite;' +
            '    animation-iteration-count: infinite' +
            '}' +

            '.c-toast .toast-loading img {' +
            '    margin-bottom: .66667vw;' +
            '    width: 6.6vw;' +
            '    height: 6.6vw' +
            '}' +

            '.c-toast-text-info {' +
            '    margin-top: .8vw' +
            '}' +

            '.c-toast-icon {' +
            '    fill: currentColor;' +
            '    background-size: cover;' +
            '    width: 2.93333vw;' +
            '    height: 2.93333vw' +
            '}' +

            '.c-toast-icon-xxs {' +
            '    width: 2vw;' +
            '    height: 2vw' +
            '}' +

            '.c-toast-icon-xs {' +
            '    width: 2.4vw;' +
            '    height: 2.4vw' +
            '}' +

            '.c-toast-icon-sm {' +
            '    width: 2.8vw;' +
            '    height: 2.8vw' +
            '}' +

            '.c-toast-icon-md {' +
            '    width: 2.93333vw;' +
            '    height: 2.93333vw' +
            '}' +

            '.c-toast-icon-lg {' +
            '    width: 4.8vw;' +
            '    height: 4.8vw' +
            '}' +

            '.c-toast-icon-loading {' +
            '    -webkit-animation: cirle-anim 1s linear infinite;' +
            '    animation: cirle-anim 1s linear infinite' +
            '}' +

            '@-webkit-keyframes cirle-anim {' +
            '    100% {' +
            '        -webkit-transform: rotate(360deg);' +
            '        transform: rotate(360deg)' +
            '    }' +
            '}' +

            '@keyframes cirle-anim {' +
            '    100% {' +
            '        -webkit-transform: rotate(360deg);' +
            '        transform: rotate(360deg)' +
            '    }' +
            '}';
            doc.getElementsByTagName('HEAD').item(0).appendChild(style);
        },
        info: function (content, duration) {
            var options = {
                content: content || '提示内容',
                duration: duration || 1.5
            };
            this.importCss();
            var toastNode = document.createElement('div');
            toastNode.className = 'c-toast';
            var toastContent = document.createElement('div');
            toastContent.className = 'toast-content';
            toastContent.innerHTML = options.content;
            toastNode.appendChild(toastContent);
            document.body.appendChild(toastNode);
            // 经过设置几秒自动关闭
            setTimeout(function () {
                toastNode && toastNode.remove();
            }, options.duration * 1000);
        },
        loading: function (content) {
            if (!document.querySelector('.c-toast')) {
                content = content || '加载中...';
                this.importCss();
                var toastNode = document.createElement('div');
                toastNode.className = 'c-toast';
                var toastLoading = document.createElement('div');
                toastLoading.className = 'toast-loading';
                var span = document.createElement('span');
                span.className = 'c-toast-text-info';
                var loadImg = document.createElement('img');
                // loadImg.className = 'loading-img';
                loadImg.src = '../celebration5th/images/spinner.gif';
                // var loadImg = '<svg class="c-toast-icon c-toast-icon-loading c-toast-icon-lg">' +
                //                 '<svg viewBox="0 -2 59.75 60.25">' +
                //                     '<path fill="#ccc" d="M29.69-.527C14.044-.527 1.36 12.158 1.36 27.806S14.043 56.14 29.69 56.14c15.65 0 28.334-12.686 28.334-28.334S45.34-.527 29.69-.527zm.185 53.75c-14.037 0-25.417-11.38-25.417-25.417S15.838 2.39 29.875 2.39s25.417 11.38 25.417 25.417-11.38 25.416-25.417 25.416z" />' +
                //                     '<path fill="none" stroke="#108ee9" stroke-width="3" stroke-linecap="round" stroke-miterlimit="10" d="M56.587 29.766c.37-7.438-1.658-14.7-6.393-19.552" />' +
                //                 '</svg>' +
                //             '</svg>';
                span.innerHTML = content;
                toastLoading.appendChild(loadImg);
                // toastLoading.innerHTML = loadImg;
                toastLoading.appendChild(span);
                toastNode.appendChild(toastLoading);
                document.body.appendChild(toastNode);
            }
        },
        closeLoading: function () {
            var toastNode = document.querySelector('.c-toast');
            toastNode && toastNode.remove();
        }
    };
    win.Toast = Toast;
})(window, document);
