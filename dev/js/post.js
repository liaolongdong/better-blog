(function () {
    /**
     * @description 判断https://disqus.com/是否可访问(能不能翻墙)
     * @param url 能否访问的url地址
     */
    function testUrlCanOpen(url) {
        $.ajax({
            type: 'get',
            url: url,
            cache: false,
            dataType: 'jsonp', // 跨域采用jsonp方式 
            processData: false,
            timeout: 3000, // 超时时间，毫秒
            complete: function (data) {
                if (data.status == 200) {
                    // 如果能访问disqus网站(能翻墙)，则显示disqus评论系统
                    console.log('this url can open');
                    $('#SOHUCS').hide();
                    $('#disqus_thread').show();
                } else {
                    // 如果不能访问外网，这使用畅言评论系统
                    console.log('this url can not open');
                    $('#disqus_thread').hide();
                    $('#SOHUCS').show();
                }
            }
        });
    }
    testUrlCanOpen('https://disqus.com/');
})();