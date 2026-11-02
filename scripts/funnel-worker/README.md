# 漏斗接收端 Worker（`better-blog-funnel`）

站内商店 CTA 的「页面打开 → 按钮进入视野 → 点击」三段计数落在这里。
站点侧的接线在 `_includes/funnelScript.html` 与 `dev/js/funnel.js`，判据在 `scripts/check-seo.mjs` 的「漏斗」与「验证 meta」两组。

## 为什么是 Worker 而不是现成的统计服务

- Cloudflare Web Analytics 不支持自报事件端点——官方 FAQ 写明 "all requests should originate from our beacon JavaScript"，所以「在已有的 beacon 上加自定义事件」这条路不存在。
- 本站的硬约束是第三方服务必须开源或永久免费。Workers Free 计划 100,000 请求/天（每次上报 = 1 个请求），Analytics Engine 的写入不额外计费；账号里本来就在跑 Waline（`waline-on-worker.924902324.workers.dev`），不引新供应商。
- 精确的读写配额与保留期以 <https://developers.cloudflare.com/analytics/analytics-engine/pricing/> 为准，部署时看一眼——这份 README 只写查证到的那一条：加维度与加基数不额外收费。

## 部署（本人执行，属对外动作）

```bash
cd scripts/funnel-worker
npx wrangler login          # 用平时那个 Cloudflare 账号
npx wrangler deploy
```

部署完会给出一个 `https://better-blog-funnel.<你的子域>.workers.dev` 的地址。

```bash
curl -s https://better-blog-funnel.<子域>.workers.dev/ping     # 期望：funnel worker ok
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  'https://better-blog-funnel.<子域>.workers.dev/e?e=click&k=store&p=hub&s=account-password-helper&u=/better-blog/tools.html&v=1'
# 期望：200 image/gif —— 这一发会在面板里落下第一行数据，用它验口径
```

然后把地址填进 `_config.yml`：

```yaml
funnel:
  enable: true
  endpoint: 'https://better-blog-funnel.<子域>.workers.dev/e'   # 末尾不要带查询串
```

`endpoint` 空着的时候站点侧照样加载埋点件，但件本体读到空地址就整件退出：不发请求、不装观察器、控制台零字。
要连那一次请求都不要，把 `enable` 改成 `false`（模板就不发标签了）。

## 本地为什么验不了落库，以及不登录能验到哪一层

Analytics Engine 的 binding 在 `wrangler dev` 下不可用（官方文档："You cannot use an Analytics Engine binding locally"）。
本地只能验「返回 GIF 那半边」，落库那半边要么 `npx wrangler dev --remote`，要么按上面两发 curl 在上线后验。
worker.mjs 在绑定缺失时**故意返回 500 而不是静默成功**——「接线齐了但一行数据没有」正是这一族要防的失效形状。

不登录也能验的一层是 `wrangler deploy --dry-run`（2026-10-30 实跑，当时 `wrangler whoami` 是未登录）：

```
Total Upload: 2.39 KiB / gzip: 1.27 KiB
Your Worker has access to the following bindings:
env.ANALYTICS (better_blog_funnel)      Analytics Engine Dataset
```

这一发同时证明三件事：`wrangler.jsonc` 的 schema 成立、`worker.mjs` 能被打成模块、
以及 `env.ANALYTICS` 与配置里 `binding: "ANALYTICS"` 两端真的对得上。
最后这条 `check-seo.mjs` 的「漏斗」组也判，但那是 grep 级别的判据——让部署工具自己认一遍才算真验过。
改完 binding 名或维度顺序后重跑这一发，比等上线发现「响应 200 而面板永远零行」便宜得多。

2026-11-02 为「空事件那一支改成 204 无动作体」这一改重跑过：`wrangler 4.156.1`，读数与上面逐字相同
（2.39 KiB / gzip 1.27 KiB，`env.ANALYTICS → better_blog_funnel`）。dry-run 只证打包与绑定，
不跑运行时——所以 204 那一支仍然只有本地桩（`funnel-stub-server.mjs` 同形：空 `e` → 204 无体）
与 `check-seo` 那把「给 null-body 状态带动作体」的刀守着，线上那一发要等本人部署后才第一次真跑。

## 查数据

Cloudflare Dashboard → Workers & Pages → Analytics Engine 没有图形面板，查询走 SQL API：

```bash
curl "https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql" \
  -H "Authorization: Bearer <api_token>" \
  --data "SELECT timestamp, blob1 AS event, blob2 AS placement, blob3 AS slug, blob4 AS path
          FROM better_blog_funnel
          WHERE blob1 = 'click' AND timestamp > NOW() - INTERVAL '7' DAY
          ORDER BY timestamp DESC LIMIT 50"
```

三段漏斗的常用一条（曝光→点击率，按投放位比）：

```sql
SELECT blob2 AS kind, blob3 AS placement, blob4 AS slug,
       countIf(blob1 = 'view')       AS page_opens,
       countIf(blob1 = 'impression') AS cta_seen,
       countIf(blob1 = 'click')      AS clicks
FROM better_blog_funnel
WHERE timestamp > NOW() - INTERVAL '14' DAY
GROUP BY kind, placement, slug
ORDER BY clicks DESC
```

维度顺序写死在 `worker.mjs` 的 `blobs` 里：`blob1`=事件（view / impression / click）、`blob2`=按钮种类（store / demo / repo / guide / review）、`blob3`=投放位（hub / guide / article）、`blob4`=产品 slug、`blob5`=站内路径、`blob6`=口径版本。改顺序要连这里的 SQL 一起改。**槽位顺序现在也在闸门里**：`check-seo.mjs` 的「漏斗」那一组既判参数名两端一致（前端拼 `&k=` 而 Worker 不读 `k`，那一维就静默丢在 URL 里），也判 `blobs=[…]` 的字面顺序是不是 `e,k,p,s,u,v`——交换两格不会报错，只会让面板上「站内路径」那一列显示口径版本。

## 本地怎么复验「点下去真的有一个请求出去」

静态门禁判的是接线，判不到这一发请求；而生产 endpoint 不该被测试点击打脏。
所以有一台本地桩：`scripts/funnel-stub-server.mjs` 同时伺服 `_site` 与收集端，
用法写在它的文件头。最短一条路：

```bash
node scripts/funnel-stub-server.mjs --port=8793 &
perl -0pi -e 's/data-funnel-endpoint=""/data-funnel-endpoint="http:\/\/127.0.0.1:8793\/e"/' _site/tools.html
# 浏览器打开 http://127.0.0.1:8793/better-blog/tools.html，滚到 CTA、点一枚，然后：
curl -s http://127.0.0.1:8793/__hits
# 顺手验一下接收端对脏数据的形状（期望 204 且无动作体；带 body 的 204 会在 Worker 里抛 TypeError）：
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' 'http://127.0.0.1:8793/e'
```

期望三段齐、且同一投放位上 `store` / `demo` / `repo` / `guide` / `review` 五类按钮的 `k` **互不相同**（`check-seo.mjs` 按 `hub` 五种、`guide` 四种、`article` 三种钉这张组合表）：

```
view       | store | page | account-password-helper | /better-blog/tools.html
impression | store | hub  | account-password-helper | ...
click      | store | hub  | account-password-helper | ...
```

这四行是 2026-10-28 第一次跑出来的实际读数。当时它们并成了一行相同的 `k`——因为埋点件把
`data-funnel` 的三段只发出了两段，而 23 项 CI 门禁全绿。这条判读口径因此同时写进了
`check-seo.mjs` 的「参数契约」那一判和 `funnel-stub-server.mjs` 的文件头。

`view` 那一行要单独说：一页只发一发 `view`，它取的是**页面上第一枚 CTA 的 kind**（本页第一枚
通常是商店按钮，所以看着像 `k=store`），而 `p` 恒为 `page`。所以**按 `k` 分组时不要把 `view` 算进
各按钮的曝光基数**——那一发代表的是「这一页被打开过」，不是「store 这一格被看到过」。
按 `p=page` 读它，或直接在 SQL 里 `WHERE blob1 <> 'view'` 再按 `blob2` 分组。

## 这份数据能回答什么、不能回答什么

能回答：哪个投放位带来的点击多、改了卡片的位次或文案之后点击有没有变、商店按钮在文章页有多少人被滚进过视野。

不能回答：**装了几个**。这条链的终点是「点击」，商店那一头的安装数只有 Chrome Web Store 开发者面板有，而它不读 URL 上的 `utm_*`（那三枚参数是留着给以后换接收端时不丢信息的）。也没有访客 ID，所以点过的人后来装没装、装完留没留，都不在这份数据里——这是「不追踪个人」这个决定的直接代价，写在代码里而不是藏在心里。

它也不是防伪造的：地址公开，任何人都能发一个 GET。当趋势读，别当账目读。
