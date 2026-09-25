/**
 * 可注入的确定性随机源（mulberry32）。判据复现、面板"再抽一次"的同种子重放、
 * 身份证与统一代码两个生成侧都吃这一份。
 *
 * @param {number} seed 整数种子；0 按 1 处理（mulberry32 在种子 0 下退化）
 * @returns {() => number} 每次调用返回 [0, 1)
 */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
