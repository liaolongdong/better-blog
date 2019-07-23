$(document).ready(function () {
    // 设备宽度大于1500px和不是关于我的页面显示猫
    let path = window.location.pathname;
    let width = window.innerWidth;
    console.log('可视宽度：', width);
    if (path.indexOf('/about.html') !== -1 && width >= 1500) {
        $('.mao_box').fadeIn();
    }
})