/*
 * @Author: liaolongdong
 * @Date: 2020-04-26 17:53:26
 * @LastEditTime: 2020-04-26 18:09:05
 * @LastEditors: liaolongdong
 * @Description: 移动端实现类似于vconsole的实时拖拽功能
 */
(function (window, document) {
    /**
     * 取 fixed 定位所依据的视口尺寸。
     *
     * 必须是 documentElement.clientWidth/clientHeight，不能是 window.innerWidth/innerHeight。
     * 依据是实测：注入 ::-webkit-scrollbar{width:15px} 造出一条经典滚动条后（macOS 默认是
     * overlay 滚动条、两值恒等，不注入造不出来），innerWidth 为 1440、clientWidth 为 1425，
     * 而 position:fixed;right:0 的探针恰好落在 rect.right=1425。也就是 fixed 可用的那一段
     * 不含经典滚动条，按 innerWidth 算会凭空多出一截，把节点推到视口外。
     * 偏差只在经典滚动条环境暴露：Windows / Linux 桌面，以及带常驻滚动条的触屏设备。
     *
     * 这条只针对「按 fixed 的 left/top/right/bottom 落位」的换算。判可视宽度、对齐媒体查询
     * 的地方仍该用 innerWidth（媒体查询比的就是它），别顺手统一。
     *
     * 同样要避开 scrollWidth/scrollHeight：那是文档尺寸，页面可滚动时比视口高出一截，
     * 把两者之差当成偏移写进 style，会造成一次恒定的跳位。
     * @returns {{w: number, h: number}} 视口的宽与高（px）
     */
    function viewport() {
        var de = document.documentElement;
        return { w: de.clientWidth, h: de.clientHeight };
    }

    /**
     * 取节点当前距离视口右边缘与下边缘的实际偏移。
     *
     * 不能用 parseInt(node.style.right) 代替：元素的初始定位通常写在 CSS 类里，
     * inline style 为空串时 parseInt 得到 NaN 并回退成 0，会把拖拽基准错误地重置到
     * 视口角落，导致「点一下没拖动、下次再拖」时按钮瞬间跳位。
     * 统一以几何位置为准，也不要求调用方去维护一个与样式同步的初始常量。
     * @param {Element} node 被拖拽的节点
     * @returns {{right: number, bottom: number}} 实际的 right / bottom 偏移
     */
    function getEdgeOffset(node) {
        var rect = node.getBoundingClientRect();
        var vp = viewport();
        return {
            right: vp.w - rect.right,
            bottom: vp.h - rect.bottom
        };
    }

    const rtDraggable = {
        /**
         * @param {Element} node 被拖拽的节点，为空时什么都不做
         */
        init (node) {
            if (!node) { return; }
            // 本次拖拽的基准：按下瞬间节点距视口右/下边缘的实际偏移（px）
            // 状态挂在每次 init 上而不是模块作用域：一个页面会 init 两个节点
            // （.mao_box 与 .bottom-fixed-btn），共用一份会把前一个节点的起点覆盖掉
            const draggable_params = {
                startX: 0,
                startY: 0,
                baseRight: 0,
                baseBottom: 0
            }
            // 每次按下都以当前真实位置为基准，因此上一次拖拽的结果与初始 CSS 定位都能正确继承
            node.addEventListener('touchstart', (e) => {
                var offset = getEdgeOffset(node);
                draggable_params.baseRight = offset.right;
                draggable_params.baseBottom = offset.bottom;
                draggable_params.startX = e.touches[0].pageX;
                draggable_params.startY = e.touches[0].pageY;
            });
            node.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    let offsetX = e.touches[0].pageX - draggable_params.startX,
                        offsetY = e.touches[0].pageY - draggable_params.startY;
                    let x = draggable_params.baseRight - offsetX,
                        y = draggable_params.baseBottom - offsetY;
                    // check edge —— 与 getEdgeOffset 共用 viewport()，基准只有一处可改。
                    // 基准取错时左边界跟着错：旧版用 innerWidth，实测把节点往左拖到底会钳成
                    // rect.left=-15，也就是被推出视口 15px。
                    var vp = viewport();
                    if (x + node.offsetWidth > vp.w) {
                        x = vp.w - node.offsetWidth;
                    }
                    if (y + node.offsetHeight > vp.h) {
                        y = vp.h - node.offsetHeight;
                    }
                    if (x < 0) { x = 0; }
                    if (y < 0) { y = 0; }
                    // 如果节点不是fixed定位，则设置成fixed定位
                    if (node.style.position !== 'fixed') {
                        node.style.position = 'fixed';
                    }
                    node.style.right = x + 'px';
                    node.style.bottom = y + 'px';
                    e.preventDefault();
                }
            });
        },
    }
    window.rtDraggable = rtDraggable;
})(window, document);