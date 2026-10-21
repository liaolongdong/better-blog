(function(){
    var bp = document.createElement('script');
    var curProtocol = window.location.protocol.split(':')[0];
    if (curProtocol === 'https') {
        bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
    }
    else {
        // 站点在 GitHub Pages 上是 https-only，写死 http:// 就是混合内容，浏览器直接拦掉
        // ——也就是说这条主动推送在线上从来没发出去过。改成协议相对（与 footer.html 里
        // busuanzi 同一个写法）：https 页面自动走 https。本机出不了网，没能亲验该 CDN 的
        // https 端点，但这个写法不会比「被拦死」更差；若 https 侧确实取不到，再改显式 https。
        bp.src = '//push.zhanzhang.baidu.com/push.js';
    }
    var s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(bp, s);
})();