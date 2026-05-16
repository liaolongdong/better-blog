$(document).ready(function () {
    // 设备宽度大于1500px和不是关于我的页面显示猫
    var BASE_URL = window.SITE_BASEURL || '';
    var pageRelPath = window.location.pathname.replace(BASE_URL, '') || '/';
    let width = window.innerWidth;
    console.log('可视宽度：', width);
    if (pageRelPath.indexOf('/about.html') === -1 && width >= 1500) {
        $('.mao_box').fadeIn(2000);
    }
})