$(document).ready(function () {
    // 设备宽度小于1500px和关于我的页面不显示猫
    let path = window.location.pathname;
    let width = window.innerWidth;
    console.log('可视宽度：', width);
    if (path.indexOf('/about.html') !== -1 || width < 1500) {
        $('.mao_box').hide();
    }
})