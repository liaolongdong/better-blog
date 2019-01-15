(function (window, document) {
    var shareMethodObj = {
        //分享到腾讯微博
        sharetotencentweibo: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var shareqqstring = 
                'http://v.t.qq.com/share/share.php?title=' + title 
                + '&url=' + url 
                + '&pic=' + picurl;
            window.open(shareqqstring, '_blank');
        },
        //分享到新浪微博
        sharetosina: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var sharesinastring =
                'http://v.t.sina.com.cn/share/share.php?title=' + title 
                + '&url=' + url 
                + '&content=utf-8&sourceUrl=' + url 
                + '&pic=' + picurl;
            window.open(sharesinastring, '_blank');
        },
        // 分享到QQ好友
        sharetoqq: function (title, url, picurl) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            var shareqqzonestring = 
                'http://connect.qq.com/widget/shareqq/index.html?title=' + title 
                + '&url=' + url 
                + '&pics=' + picurl;
            window.open(shareqqzonestring, '_blank');
        },
        //分享到QQ空间
        sharetoqqzone: function (title, url, picurl, content) {
            // 分享的标题
            title = encodeURIComponent(title || document.title);
            // 分享内容链接
            url = encodeURIComponent(url || window.location.href);
            // 分享图片的路径，多张图片以＂|＂隔开，可选参数
            picurl = encodeURIComponent(picurl || '');
            // 分享描述
            content = encodeURIComponent(content || '');
            var shareqqzonestring = 
                'http://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?summary=' + title 
                + '&desc=' + content
                + '&url=' + url 
                + '&pics=' + picurl;
            window.open(shareqqzonestring, '_blank');
        }
    }
    window.shareMethodObj = shareMethodObj;
})(window, document);