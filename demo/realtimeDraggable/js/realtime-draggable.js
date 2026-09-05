/*
 * @Author: liaolongdong
 * @Date: 2020-04-26 17:53:26
 * @LastEditTime: 2020-11-07 16:03:37
 * @LastEditors: liaolongdong
 * @Description: 移动端实现类似于vconsole的实时拖拽功能
 */
(function (window, document) {
  const draggable_params = {
    startX: 0,
    startY: 0,
    // 本次拖拽的基准：按下瞬间节点距视口右/下边缘的实际偏移（px）
    baseRight: 0,
    baseBottom: 0,
  };

  /**
   * 取节点当前距离视口右边缘与下边缘的实际偏移。
   *
   * 不能用 parseInt(node.style.right) 代替：元素的初始定位通常写在 CSS 类里，
   * inline style 为空串时 parseInt 得到 NaN 并回退成 0，会把拖拽基准错误地重置到
   * 视口角落，导致「点一下没拖动、下次再拖」时按钮瞬间跳位。
   * 统一以几何位置为准，调用方就不再需要维护一个与样式同步的初始常量。
   *
   * 必须用 window.innerWidth/innerHeight 而不是 document.documentElement 的 offsetWidth/Height：
   * fixed 元素的 right/bottom 是相对视口计算的，而文档高度可能大于视口（页面可滚动时），
   * 两者之差会被当作偏移写进 style，造成一次恒定的跳位。
   * @param {Element} node 被拖拽的节点
   * @returns {{right: number, bottom: number}} 实际的 right / bottom 偏移
   */
  function getEdgeOffset(node) {
    const rect = node.getBoundingClientRect();
    return {
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
    };
  }

  const rtDraggable = {
    init(node) {
      // 每次按下都以当前真实位置为基准，因此上一次拖拽的结果与初始 CSS 定位都能正确继承
      node &&
        node.addEventListener("touchstart", (e) => {
          const offset = getEdgeOffset(node);
          draggable_params.baseRight = offset.right;
          draggable_params.baseBottom = offset.bottom;
          draggable_params.startX = e.touches[0].pageX;
          draggable_params.startY = e.touches[0].pageY;
        });
      node &&
        node.addEventListener("touchmove", (e) => {
          if (e.touches.length > 0) {
            let offsetX = e.touches[0].pageX - draggable_params.startX,
              offsetY = e.touches[0].pageY - draggable_params.startY;
            let x = draggable_params.baseRight - offsetX,
              y = draggable_params.baseBottom - offsetY;
            // check edge
            if (x + node.offsetWidth > document.documentElement.offsetWidth) {
              x = document.documentElement.offsetWidth - node.offsetWidth;
            }
            if (y + node.offsetHeight > document.documentElement.offsetHeight) {
              y = document.documentElement.offsetHeight - node.offsetHeight;
            }
            if (x < 0) {
              x = 0;
            }
            if (y < 0) {
              y = 0;
            }
            // 如果节点不是fixed定位，则设置成fixed定位
            if (node.style.position !== "fixed") {
              node.style.position = "fixed";
            }
            node.style.right = x + "px";
            node.style.bottom = y + "px";
            e.preventDefault();
          }
        });
    },
  };
  window.rtDraggable = rtDraggable;
})(window, document);
