class utils {
    /**
     * 获取内容高度
     */
    static getContentVisibilityHeight() {
        var docHeight = $('.visible').height(),
            winHeight = $(window).height(),
            contentVisibilityHeight = (docHeight > winHeight) ? (docHeight - winHeight) : ($(document).height() - winHeight);
        return contentVisibilityHeight;
    }

    /**
     * 是否为小屏设备
     */
    static isMobile() {
        return window.screen.width < 768;
    }
}

// 暴露到全局
window.utils = utils;