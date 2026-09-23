class utils {
    /**
     * 获取页面还能滚动的距离（百分比的分母）。
     *
     * 旧写法拿 $('.visible').height() 当文档高，但文章页的 .visible 是 .post-content，
     * 不含刊头 / 头图 / 篇末与页脚 —— 实测这篇 6448 字的文章因此少算 2748px，
     * 滚到 80% 就提前显示 100%，且与顶部 .reading-progress 的读数互相矛盾。
     * 这里与 editorial.js 的 readRatio() 用同一口径，两个指示器不会再打架。
     * @returns {number} 可滚动像素；页面本身不滚动时为 0
     */
    static getContentVisibilityHeight() {
        var scrollable = document.documentElement.scrollHeight - window.innerHeight;
        return scrollable > 0 ? scrollable : 0;
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