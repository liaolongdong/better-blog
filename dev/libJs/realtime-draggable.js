/*
 * @Author: liaolongdong
 * @Date: 2020-04-26 17:53:26
 * @LastEditTime: 2020-04-26 18:09:05
 * @LastEditors: liaolongdong
 * @Description: 移动端实现类似于vconsole的实时拖拽功能
 */
(function (window, document) {
    const draggable_params = {
        x: 20, // right
        y: 100, // bottom
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    }

    const rtDraggable = {
        init (node) {      
            console.log(666, node);

            node && node.addEventListener('touchstart', (e) => {
                draggable_params.startX = e.touches[0].pageX;
                draggable_params.startY = e.touches[0].pageY;
            });
            node && node.addEventListener('touchend', (e) => {
                draggable_params.x = draggable_params.endX;
                draggable_params.y = draggable_params.endY;
                draggable_params.startX = 0;
                draggable_params.startY = 0;
            });
            node && node.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    let offsetX = e.touches[0].pageX - draggable_params.startX,
                        offsetY = e.touches[0].pageY - draggable_params.startY;
                    let x = draggable_params.x - offsetX,
                        y = draggable_params.y - offsetY;
                    // check edge
                    if (x + node.offsetWidth > document.documentElement.offsetWidth) {
                        x = document.documentElement.offsetWidth - node.offsetWidth;
                    }
                    if (y + node.offsetHeight > document.documentElement.offsetHeight) {
                        y = document.documentElement.offsetHeight - node.offsetHeight;
                    }
                    // if (x < 0) { x = 0; }
                    // if (y < 0) { y = 0; }
                    if (x < 0) { x = 0; }
                    if (y < 0) { y = node.offsetHeight; }
                    // 如果节点不是fixed定位，则设置成fixed定位
                    if (node.style.position !== 'fixed') {
                        node.style.position = 'fixed';
                    }
                    node.style.right = x + 'px';
                    node.style.bottom = y + 'px';
                    draggable_params.endX = x;
                    draggable_params.endY = y;
                    e.preventDefault();
                }
            });
        },
    }
    window.rtDraggable = rtDraggable;
})(window, document);