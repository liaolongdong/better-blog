// 360（好搜）站长推送。原第三方片段用 document.write 注入，那份写法在本仓不能用：
// 本文件经 _includes/seoScript.html 以 defer 引入，而 defer 脚本在文档解析**完成之后**
// 才执行——此时调 document.write 会触发隐式 document.open()，把整个文档清空（整站白屏）。
// 所以换成与同目录 baiduPush.js 完全一致的 createElement + insertBefore 写法。
// id="sozz" 保留：那是 360 那段脚本自己约定的挂载标识。
(function(){
    // 本地开发不加载：360 那段第三方片段会异步 document.write，在 localhost 控制台留下一条
    // 必然的告警；本地访问也不该产生推送。生产域名照旧注入。
    var host = document.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return;
    var src = (document.location.protocol == "http:") ? "http://js.passport.qihucdn.com/11.0.1.js?268d507166f60ddd94f7798251aa2452":"https://jspassport.ssl.qhimg.com/11.0.1.js?268d507166f60ddd94f7798251aa2452";
    var so = document.createElement('script');
    so.src = src;
    so.id = 'sozz';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(so, s);
})();
