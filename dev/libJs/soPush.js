// 360（好搜）站长推送。原第三方片段用 document.write 注入，那份写法在本仓不能用：
// 本文件经 _includes/seoScript.html 以 defer 引入，而 defer 脚本在文档解析**完成之后**
// 才执行——此时调 document.write 会触发隐式 document.open()，把整个文档清空（整站白屏）。
// 所以换成与同目录 baiduPush.js 完全一致的 createElement + insertBefore 写法。
// id="sozz" 保留：那是 360 那段脚本自己约定的挂载标识。
(function(){
    var src = (document.location.protocol == "http:") ? "http://js.passport.qihucdn.com/11.0.1.js?268d507166f60ddd94f7798251aa2452":"https://jspassport.ssl.qhimg.com/11.0.1.js?268d507166f60ddd94f7798251aa2452";
    var so = document.createElement('script');
    so.src = src;
    so.id = 'sozz';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(so, s);
})();
