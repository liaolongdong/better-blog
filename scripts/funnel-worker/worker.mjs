/**
 * 转化漏斗的接收端：一个只写不读的 Cloudflare Worker。
 *
 * 它接 `GET /e?e=<事件>&k=<按钮种类>&p=<投放位>&s=<产品>&u=<站内路径>&v=<口径版本>`，往 Workers Analytics
 * Engine 落一行数据点，回一枚 1×1 GIF。为什么不用现成的统计服务：Cloudflare Web Analytics
 * 不支持自报事件端点（官方 FAQ："all requests should originate from our beacon JavaScript"），
 * 而本站的硬约束是第三方服务必须开源或永久免费 —— Workers Free + Analytics Engine 是账号里
 * 已经在跑 Waline 的那条免费通道，不引新供应商、不设 Cookie。
 *
 * 隐私口径（与 _config.yml 的 funnel 注释、dev/js/funnel.js 件头三处一致，check-seo.mjs
 * 的「漏斗」那一组会逐条判这份源码是不是还说到做到）：
 *   · 不读 Cookie、不读 User-Agent、不读 cf-connecting-ip、不读 request.cf.*，
 *     所以库里没有能把一行计数连回某个人的东西；
 *   · 不写死任何访客标识： indexes 里放的是事件名，不是 ID；
 *   · 只记站内路径（前端已经剥掉查询串与锚点），搜索词不会被顺带送进来；
 *   · 收不到 Referer：前端两条发送路都显式写 `referrerPolicy: 'no-referrer'`。默认的
 *     strict-origin-when-cross-origin 会把本站 origin 带出去，这一条靠策略撑着而不是靠措辞撑着；
 *   · 数据点只在 Cloudflare 自己的 Analytics Engine 里，查询走 SQL API（本人账号）。
 *
 * 这条链不是防伪造的：任何人都能拿这个地址发一个 GET。所以读出来的数当**趋势**用
 * （哪个投放位的曝光→点击率更高、改版前后有没有变化），不当**账目**用。
 * 真要挡刷量就加 Turnstile 或限频绑定，那是另一个决定。
 *
 * 本地不能验：Analytics Engine binding 在 `wrangler dev` 下不可用（官方文档明确写了
 * "You cannot use an Analytics Engine binding locally"），所以本地只跑得通返回 GIF 那半边，
 * 落库那半边要么 `--remote` 要么上线后看。README 里有两次部署的核对步骤。
 */

/** 1×1 透明 GIF：比 Response.json 更适合埋点——它能在 <img> 里用，且不留 CORS 尾巴 */
const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));

/** 维度上限：超了就截断而不是拒收——丢一行计数比丢一行脏数据好，但都别吵 */
const CAPS = { e: 24, k: 12, p: 16, s: 40, u: 200, v: 8 };

const clean = (raw, cap) => {
  const s = String(raw == null ? '' : raw).slice(0, cap);
  // 只收可打印 ASCII：面板上的维度值要能直接 GROUP BY，混进中文或控制字符会让一行数据看起来像两行
  return /^[\x20-\x7e]*$/.test(s) ? s : '';
};

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/e') {
      // 探针与手工核对走这一支：不写库，只说明接线是否活着
      if (url.pathname === '/ping') {
        return new Response('funnel worker ok\n', {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      return new Response('not found', { status: 404 });
    }

    const q = url.searchParams;
    const e = clean(q.get('e'), CAPS.e);
    // 204 是 null-body 状态：给它带 body（哪怕是那枚 GIF）会在构造 Response 时直接抛 TypeError，
    // 于是「一个缺 e 参数的探针」变成 1101 脚本异常，而不是安静地不收。真浏览器实测过这一形。
    if (!e) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

    const point = {
      // indexes：Analytics Engine 用它做抽样分组，事件名基数小且固定，是这一列该放的东西
      indexes: [e],
      // blobs：查询时按 blob1..blobN 取的文本维度，顺序即语义，改动要连 README 的 SQL 示例一起改
      // blob1=事件 blob2=按钮种类 blob3=投放位 blob4=产品 slug blob5=站内路径 blob6=口径版本
      blobs: [e, clean(q.get('k'), CAPS.k) || '-', clean(q.get('p'), CAPS.p) || '-', clean(q.get('s'), CAPS.s) || '-', clean(q.get('u'), CAPS.u) || '-', clean(q.get('v'), CAPS.v) || '1'],
      doubles: [1],
    };

    // 官方口径：不要 await writeDataPoint，运行时会在后台落库，别把它变成响应路径上的一段延迟
    if (env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === 'function') {
      env.ANALYTICS.writeDataPoint(point);
    } else {
      // 绑定漏配时不能静默成功：那正是「站点接线齐了、数据一行没有」的失效形状
      return new Response('analytics engine binding missing', { status: 500, headers: { 'cache-control': 'no-store' } });
    }

    return new Response(GIF, {
      status: 200,
      headers: {
        'content-type': 'image/gif',
        'cache-control': 'no-store, no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    });
  },
};
