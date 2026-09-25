# 博客在线工具页 · 第一段（地基）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`（下称"设计文档"）交付第 1 段——区划码表生成器 + 两层码表 + 身份证 / 统一社会信用代码算法模块 + 面板框架的纯状态机 + Node 测试骨架，每条判据可复现、可变红。

**Architecture:** 数据与逻辑分层：`scripts/fixtures/region-source/` 是四份**仓库内快照**（三份 modood 现行表 + 从站内旧 `GB2260.js` 抽出的 2015 口径表），`scripts/build-region-data.mjs` 把快照编译成 `dev/js/tools/region-data.js`（纯数据、确定性字节），手写的 `dev/js/tools/region.js` 负责解析与四级回落链，`idcard.js` / `uscc.js` 只依赖 `region.js` 的返回结构。测试跑在 Node 22 内置 test runner 上：不依赖 DOM、不依赖网络、不新增依赖。

**Tech Stack:** Node 22（`node --test` / `node:assert/strict` / `node:zlib` / `node:crypto`）、ES modules、Jekyll + Vite（本段**不触碰**其配置）。

---

## 0. 本段的边界

**只新增文件，不修改任何既有文件**（除本计划与设计文档本身）。理由见设计文档 §9：另一会话正在 `main` 上改 `_config.yml`、`README.md`、`USAGE.md`。因此本段：

- 不动 `package.json` → 不加 `test:tools` 脚本，运行命令写在本计划里，脚本登记留到第 4 段随 `js-yaml` 一起做。
- 不动 `postcss.config.js`、`_includes/header.html`、`tools.html`、`sitemap.xml`、`llms.txt`、`index-all.html`、`USAGE.md`、`README.md`、`CHANGELOG.md`、`_config.yml`、`pnpm-lock.yaml`、`demo/**`。
- 不建任何 `dev/js/*.js` **入口文件**。新模块全在 `dev/js/tools/` 子目录里：`vite.config.js` 的 `getDevJsEntries()`（第 92–101 行）与 `getDevSassEntries()`（第 123–132 行）都对单层 `readdirSync` 结果按 `.endsWith('.js')` / `.scss` 过滤，目录名过不了这个筛子。Task 8 用"构建产物清单逐字节不变"实测这句话，而不是相信它。
- **不建 `tools-idcard.html`**。设计文档 §12 第 1 段把它列进来了，本计划改到这里：页面接线要动 `headAssets.html` / `header.html`（共享文件，且与 §4.3 的导航判据耦合），放第 2 段一次做完，避免同一页面被两个会话各改一半。
- 面板框架只交付**纯状态机**。段 1 没有页面也没有 DOM，而这套框架真正会错的地方（roving tabindex、`aria-selected` 翻转、hash 解析、方向键回绕）恰好全在纯逻辑里，在 Node 测比在浏览器测便宜两个数量级。DOM 绑定留给段 2 的 `dev/js/toolIdcard.js`。

**写这份计划过程中已同步落地的设计文档修订**（列出来是为了让执行者知道文档与代码口径的差异已消除）：

| 位置 | 改了什么 | 为什么 |
|---|---|---|
| §2.2 | 删掉"源表缺 `653224` 和田地区和安县" | 实测 `653224` 是**洛浦县**，新旧两表都没有"和安县"。凭记忆写死的抽查项是错的 |
| §2.2 | 新增"现行层截止 2022-10-31"一条 | `dist/areas.json` 最后提交 `dc3a1d7acd`(2023-09-13) 的信息写明数据截止 2022-10-31，我们的"现行层"本身滞后四年，必须显示 |
| §5.1 | USCC 生成项"登记管理部门（11 类）"→ 按字符集出选项、名称标"参考" | 第 1、2 位取值表没取到权威来源，不能凭记忆写死 |
| §5.1 | 同一行再降一档：**生成侧按合法字符出下拉、解析侧只显示字符与值，两侧都不出名称** | 设计文档写"标『参考』继续显示"，实现时确认那张表一条都没核实到——标参考仍然是把没来源的东西递给用户 |
| §2.2 | USCC 末位算式补上外层 `mod 31`，并写明"余数为 0 → 取字符 `0`"是本轮核实过的外部口径 | 漏掉外层 mod 会在约 1/31 的真码上算出值 31、越界成 `undefined`；这条口径答错就是每 31 个真码误判 1 个 |
| §2.2 | 新增两条未核实点的处理口径：内层第 17 位值为 10 时 `X`/`A` 的三档处理、第 1、2 位不输出名称 | 拿不到权威文本时，"不假装知道"要写成契约，否则下一个实现的人会顺手补一张记忆里的表 |
| §5.4 | 区划回落由"三级"改写为**六档**（含 6 位「市级码 + 00」直接命中这一档）；历史层措辞从「已撤销建制」改为「未见于现行区划表」 | 实读两表交集 1,934 条里有 63 条同码改名，"已撤销"对这批是错的；`110100` 这类市本级码大量存在，走回落档会把命中的事说成查不到 |
| §11 | 风险行同步成"不输出名称 + 内层值 10 三档处理" | 让风险表与真实交付一致，不留"文档说标参考、代码里根本没有名称"这种两套口径 |
| §6.2 | 文件清单加 `dev/js/tools/region.js` | 生成物只放数据；解析与回落链是手写判断，混进生成文件等于把代码塞进模板字符串 |
| §7 | 区划表预算 30KB → 34KB，并补实测数字 | 30KB 是估的；实测四表合计 ≈93KB 原始 / 31.9KB gzip |
| §11 | USCC 风险行补"样本必须先算校验位再入库" | 试取的 4 条候选真实码 3 条校验位不通，只有国标示例站得住 |

---

## 1. 文件结构（本段）

```
新增  scripts/fixtures/region-source/provinces.json       快照 31 条 / 1,081B
新增  scripts/fixtures/region-source/cities.json          快照 342 条 / 19,528B
新增  scripts/fixtures/region-source/areas.json           快照 2,978 条 / 228,316B
新增  scripts/fixtures/region-source/gb2260-2015.json     快照 3,465 条 / 146,802B
新增  scripts/fixtures/region-source/SOURCES.json         来源清单：URL / 字节 / SHA-256 / 条数 / 数据截止日
新增  scripts/fixtures/id-validator-checkbit-1000.json    对拍夹具（段 5 删掉旧库后它是唯一长期守卫）
新增  scripts/build-region-data.mjs                       快照 → region-data.js；确定性、可 --check、可 --fetch
新增  dev/js/tools/region-data.js                         生成物：两张表 + 元信息（纯数据）
新增  dev/js/tools/region.js                              手写：解析 + 四级回落 + 现行码集合
新增  dev/js/tools/random.js                              确定性随机源（身份证与统一代码共用）
新增  dev/js/tools/idcard.js                              校验 / 解码 / 生成
新增  dev/js/tools/uscc.js                                校验 / 双校验位判定 / 解析 / 生成，含 31 字符集与两套权重
新增  dev/js/tools/panel.js                               面板框架纯状态机（ARIA / roving tabindex / hash / 方向键）
新增  scripts/toolkit-tests.mjs                           全部判据；后续每段往这里加用例
新增  assets/data/LICENSES.md                             两份数据来源的许可与归属
```

依赖方向单向，`region-data.js` 不 import 任何东西：

```
region-data.js（生成） ← region.js ← idcard.js
                                    ← uscc.js
                       random.js ← idcard.js / uscc.js
panel.js（独立，零依赖）
```

`random.js` 单独立一个文件、而不是让 `uscc.js` 去 import `idcard.js`：这两个模块是同级关系，谁都不该依赖对方，而 8 行的 mulberry32 复制两份，将来改种子语义必然漏一处。段 4 夹具生成器 `scripts/build-id-fixture.mjs` 里那份 `mulberry32` 是**故意独立**的——夹具重跑要字节级不变，它不能跟着产品代码的随机源一起变。

测试运行命令（本段每次跑测试都用它，下称**测试命令**）：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs
```

`--disable-warning` 那条不是洁癖：仓库 `package.json` 无 `"type"` 字段，`dev/js/tools/*.js` 里的 ESM 语法靠 Node 22 的模块语法探测识别，探测本身会打 `MODULE_TYPELESS_PACKAGE_JSON` 警告。给 `package.json` 加 `"type":"module"` 会波及 `postcss.config.js` 等 CommonJS 文件、而且那是另一个会话正在改的文件——所以只在测试入口关掉这一条，不动构建口径。已实测：加这个 flag 后 `--test` 的子进程输出干净、失败时退出码仍为 1。

---

## Task 1: 冻结四份输入快照与来源清单

快照必须进仓库，否则生成器在 CI（无外网）和段 5（旧 `GB2260.js` 已删）之后就跑不出来。放在 `scripts/` 下：`_config.yml: exclude` 第 211 行已有 `- scripts`，不会泄漏进 `_site`（Task 8 Step 3 实测）。

**Files:**
- Create: `scripts/fixtures/region-source/{provinces,cities,areas,gb2260-2015}.json`
- Create: `scripts/fixtures/region-source/SOURCES.json`

- [ ] **Step 1: 记录开工基线（Task 8 的零重叠自证要用）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/seg1 && git status --porcelain > /tmp/seg1/git-before.txt
git rev-parse HEAD > /tmp/seg1/head-before.txt
pnpm build >/tmp/seg1/build-before.log 2>&1; echo "build exit=$?"
( cd assets && find . -name '*.min.*' -print0 | sort -z | xargs -0 shasum -a 256 ) > /tmp/seg1/assets-sha-before.txt
bundle exec jekyll build --destination /tmp/seg1/site-before >/tmp/seg1/jekyll-before.log 2>&1; echo "jekyll exit=$?"
( cd /tmp/seg1/site-before && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 ) > /tmp/seg1/site-sha-before.txt
wc -l < /tmp/seg1/assets-sha-before.txt; wc -l < /tmp/seg1/site-sha-before.txt
```

Expected: 两个 `exit=0`；`assets-sha-before.txt` 是 **29 行**（2026-09-25 实测 `assets/{js,css}` 下共 29 个 `*.min.*`）；`site-sha-before.txt` 是产物文件全集的行数。**这三份 /tmp 文件是 Task 8 的比较基准，中途别清机器。**

两条口径写在这里，因为它们决定了 Task 8 能不能成立：

1. 记的是**内容哈希**而不是文件名清单。`assets/js/*.min.js` 与 `assets/css/*.min.css` 都被 `.gitignore:9-10` 排除、产物文件名不带 contenthash，所以"名字没变"完全不能证明"内容没变"——只有哈希能。
2. 这两条 `shasum` 命令**不要接 `| head`**：`head` 关闭管道会让 `xargs` 收到 SIGPIPE 并以非 0 退出，看着像命令坏了。要预览就先把结果写文件再读。

若 `pnpm build` 开工就是红的，那是别人留下的状态，先停下来报告，不要在这个之上做本段。

- [ ] **Step 2: 抓三份现行表快照**

```bash
mkdir -p scripts/fixtures/region-source
for f in provinces cities areas; do
  curl -sS --http1.1 --retry 5 --retry-delay 3 --max-time 180 \
    -o "scripts/fixtures/region-source/$f.json" \
    "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/$f.json" \
    && echo "$f -> $(wc -c < scripts/fixtures/region-source/$f.json)B"
done
```

Expected（2026-09-25 实测）：

```
provinces ->     1081B
cities ->      19528B
areas ->      228316B
```

> 本机到 `raw.githubusercontent.com` 偶发 `curl: (56) LibreSSL SSL_read ... Operation timed out`（本计划起草过程中 `cities.json` 连续两次超时、`areas.json` 一次成功）。超时重试即可，**不要换成国内镜像源**——字节不同就是另一份数据。三次重试仍拿不到，就停下来报告，不要用旧 `/tmp` 里的文件凑。

> URL 里用 40 位 commit `6fb5380de7e6c961869dcd1629df4adc088fa9bb`（tag `2.7.0`）而不是 `master`：`master` 是可前进的分支，一旦上游再发一版数据，清单里的 URL 就永久不再返回所记录的字节，而 CI 无外网、没人能重下这份快照。该 commit 下三份 `dist/*.json` 与 `master` 同时刻逐字节相同（Task 1 落地后复核：`provinces a7e6a230…`、`cities 3f569aaa…`、`areas fbe1575e…`，sha256 前 12 位本地与 pin 全等），所以换成 pin 不改变任何 Expected 数字，只是把"可复现"从借来的变成自己的。

- [ ] **Step 3: 核对字节数与条数**

```bash
node -e '
const fs = require("fs");
const expect = { provinces: [1081, 31], cities: [19528, 342], areas: [228316, 2978] };
for (const [n, [expB, expC]] of Object.entries(expect)) {
  const p = `scripts/fixtures/region-source/${n}.json`;
  const b = fs.readFileSync(p);
  const j = JSON.parse(b);
  const ok = b.length === expB && j.length === expC;
  console.log(ok ? "OK  " : "BAD ", n, "bytes", b.length, "count", j.length);
  if (!ok) process.exitCode = 1;
}
'; echo "exit=$?"
```

Expected: 三行 `OK`、`exit=0`。任何 `BAD` → 停下来：说明抓到的不是同一版本快照，`SOURCES.json` 哈希要按实际值重算，且设计文档 §2.2 的条数与 Task 2 的 `A1` 期望值都得跟着改。

- [ ] **Step 4: 从站内旧库抽 2015 口径表（按码升序、确定性序列化）**

```bash
node -e '
const fs = require("fs"), crypto = require("crypto");
global.GB2260 = require("./demo/idCardDemo/lib/GB2260.js");
const keys = Object.keys(GB2260).sort();
const out = "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(GB2260[k])).join(",") + "}";
fs.writeFileSync("scripts/fixtures/region-source/gb2260-2015.json", out);
console.log("keys", keys.length, "bytes", Buffer.byteLength(out));
console.log("sha256", crypto.createHash("sha256").update(out).digest("hex"));
console.log("源文件 sha256", crypto.createHash("sha256").update(fs.readFileSync("demo/idCardDemo/lib/GB2260.js")).digest("hex"));
'
```

Expected:

```
keys 3465 bytes 146802
sha256 9f5142103eb1f1ff0d4a55b8c6cb8c5c2367b4017ab339bd2756839e27bdbdbe
源文件 sha256 7ddc4d7a98009e84689b9f8ebc43652d90551983c640b2825c70971d2286aa54
```

第三个哈希不符 → 站内 `GB2260.js` 被改过（它要到段 5 才删）。先 `git log -- demo/idCardDemo/lib/GB2260.js` 查清楚再继续。

- [ ] **Step 5: 写 `SOURCES.json`**

用脚本生成，别手抄哈希：

```bash
node -e '
const fs = require("fs"), crypto = require("crypto");
const dir = "scripts/fixtures/region-source";
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(`${dir}/${f}`)).digest("hex");
const json = (f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const bytes = (f) => fs.statSync(`${dir}/${f}`).size;
const count = (f) => { const j = json(f); return Array.isArray(j) ? j.length : Object.keys(j).length; };
const SRC = "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/";
const manifest = {
  schema: 1,
  fetchedAt: "2026-09-25",
  dataset: {
    provider: "modood/Administrative-divisions-of-China",
    ref: "6fb5380de7e6c961869dcd1629df4adc088fa9bb",
    refTag: "2.7.0",
    refNote: "钉死在不可变的 commit 上；该 commit 是 tag 2.7.0 指向的对象（npm publish china-division@2.7.0，2023-09-13）。抓取当时走的是 `/master/`，实测三份字节与该 pin 完全一致，故清单与生成器的 URL 一律改用 pin，避免分支前进后快照不可复现。",
    license: "WTFPL",
    licenseEvidence: "以 LICENSE 原文为准（该 commit 下 479 字节，内容 sha256 ee820ff0db4ce628569e0975ac27dc926052a9f85d102b101edb104311ef4d90，blob c6c7def73428adec5eae68aa233c207b3f4957dc），正文首段为「DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE / Version 2, December 2004」，故版本是 v2。GitHub API /repos/modood/Administrative-divisions-of-China/license 返回 license.spdx_id=WTFPL、key=wtfpl，仅作索引佐证——注意该接口给的是 WTFPL 而非 WTFPL-2.0（SPDX 无后者），v2 这个结论的证据在原文而不在接口。",
    dataAsOf: "2022-10-31",
    releaseNote: "数据截止 2022-10-31、发布 2022-12-29；dist/areas.json 最后提交 dc3a1d7acd85ca1b0979543e9259604142c52e8e (2023-09-13T01:31:33Z)",
  },
  files: ["provinces", "cities", "areas"].map((n) => ({
    file: `${n}.json`, url: SRC + n + ".json", kind: n,
    bytes: bytes(`${n}.json`), sha256: sha(`${n}.json`), count: count(`${n}.json`),
  })),
  historical: {
    file: "gb2260-2015.json",
    extractedFrom: "demo/idCardDemo/lib/GB2260.js",
    extractedFromSha256: crypto.createHash("sha256").update(fs.readFileSync("demo/idCardDemo/lib/GB2260.js")).digest("hex"),
    upstream: "mc-zone/IDValidator v1.2.0（站内副本文件头标称，见 demo/idCardDemo/lib/IDValidator.js:2）",
    license: "MIT",
    licenseTextAt: "站内只有声明没有文本：demo/idCardDemo/lib/IDValidator.js:6 为 `Released under the MIT license`，而 GB2260.js 自身零许可头（grep license/copyright 命中 0）。MIT 要求的版权行与许可全文只存在于上游 mc-zone/IDValidator 的 `MIT-LICENSE`（1100 字节，blob 13ded76fafbe13595632ef8128f78fd95de27005，内容 sha256 26efe3b31a157796b88f9fe2633f88ab010fcd31efbedccd8436ac173e01a482，首行 `Copyright (c) 2014 mc-zone`；GitHub API 对它返回 spdx_id=NOASSERTION，只是自动识别失败）。所以本条不算许可文本证据，全文由 Task 7 逐字抄进 assets/data/LICENSES.md。",
    bytes: bytes("gb2260-2015.json"), sha256: sha("gb2260-2015.json"), count: count("gb2260-2015.json"),
    normalization: "按码升序重序列化，与源 JS 文件的键序无关，因此哈希稳定",
    note: "GB/T 2260 的 2015 年前后口径；只用于解码已撤销建制的历史码，生成侧一律不用",
  },
};
fs.writeFileSync(dir + "/SOURCES.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("wrote SOURCES.json");
'
cat scripts/fixtures/region-source/SOURCES.json
```

Expected: 文件里四个 `sha256` 与 Step 2–4 打印的一致，`count` 分别 31 / 342 / 2978 / 3465。

- [ ] **Step 6: 提交**

```bash
git add scripts/fixtures/region-source/provinces.json scripts/fixtures/region-source/cities.json \
        scripts/fixtures/region-source/areas.json scripts/fixtures/region-source/gb2260-2015.json \
        scripts/fixtures/region-source/SOURCES.json
git diff --cached --name-only    # 必须正好是上面 5 个，多一个就 git reset
git commit -m "feat(tools): 冻结区划码表两份数据源快照与归属清单"
```

禁止 `git add -A` / `git add .`（另一会话有未提交改动，而 `deploy-github.sh` 会那么干）。

---

## Task 2: 测试骨架 + 现行层判据（先让它红）

先写判据再写生成器，这一段的产物就是一次真实的红。

**Files:**
- Create: `scripts/toolkit-tests.mjs`

- [ ] **Step 1: 写测试骨架与 §A 用例**

```js
#!/usr/bin/env node
/**
 * 在线工具页的算法与数据判据（Node 22 内置 test runner；无新增依赖、不联网、不需要 DOM）。
 *
 * 运行：
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs
 * 判断成败看退出码，不要用 `| tail` 之后的 $?（管道会吞退出码）。
 *
 * 用例分布（后续每段往这个文件里加，不另起测试入口）：
 *   §A 区划码表 —— 生成物结构与四级回落（设计文档 §2.2 / §5.4）
 *   §B 身份证   —— 校验位、三态、解码、生成、与站内旧库对拍（§2.2 / §5.1）
 *   §C 统一代码 —— 31 字符集、两套权重、双校验位自洽（§2.2 / §5.1）
 *   §D 面板框架 —— ARIA、roving tabindex、hash、方向键（§6.3）
 *   §E 后续段追加：银行卡 / 手机号 / 摘要 / JSON / 互转 / TS 生成
 *
 * 关于 §C 的真实样本：设计文档 §11 要求"≥5 条可公开核实的真实码"，实际只拿到
 * GB 32100-2015 的标准示例 1 条——凭记忆写的 4 条候选码有 3 条校验位不通，故不收录。
 * 该缺口由 C8 显式记录为"未充分验证"，不许悄悄当成已过。
 *
 * 两个环境口径，都是踩过的坑：
 *   看到 `bad option: --disable-warning` 或 `exit=9` 是环境错——本机 /usr/local/bin/node 是 v16 残留，
 *   别把它当判据红；先 `node -v` 确认 v22。跑 node 命令时不要把 /usr/local/bin 排在 PATH 前面。
 *   必须显式传本文件路径：裸 `node --test` 匹配不到 toolkit-tests.mjs 这个文件名，实测静默报 0 条且退出码 0。
 *
 * 本文件刻意保持"平铺 test()"、不用 describe/suite：Task 8 的变异判据按行首 `^not ok <用例名>` 锚定，
 * 而 suite 形状下失败用例的 not ok 行是缩进的（实测 `    not ok 2 - A2`），行首锚定只会看到 §A/§B 这种
 * 组名，点名不到具体该红的判据。代价是明写的：某段模块缺失时整文件不可跑（顶层 await import 决定），
 * 红阶段的隔离性由"报错文案点名是哪个模块"来保证。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** 固定"今天"，让年龄与日期上限类判据可复现。必须是字符串：idcard 的 toDay() 对 Date
 *  走本地分量，`new Date(Date.UTC(2026,8,25))` 在 TZ=America/Los_Angeles 下是 09-24，
 *  而 §B 里另一批用例直接传 '2026-09-25'——两种基准会随跑测试的时区翻脸。 */
const TODAY = '2026-09-25';

// ── §A 区划码表 ────────────────────────────────────────────────────────────

const { REGION_META, resolveRegion, provinceCodes, currentCityCodes,
  currentCountyCodes, historicalCodes } = await import('../dev/js/tools/region.js');

test('A1 元信息里的条数与数据截止日（快照实读值）', () => {
  assert.deepEqual(REGION_META.counts, {
    provinces: 31, cities: 342, counties: 2978, historical: 1229, legacyTotal: 3465,
  });
  assert.equal(REGION_META.datasetVersion, '2022-10-31', '现行层必须带数据截止日');
  // 旧表命中现行的条数 + 历史层条数 == 旧表总条数：两层设计的自检等式
  assert.equal(REGION_META.counts.legacyTotal - REGION_META.counts.historical, 2236);
});

test('A2 三级表条数与元信息吻合，码唯一，历史层可分级', () => {
  assert.equal(provinceCodes().length, REGION_META.counts.provinces);
  assert.equal(currentCityCodes().length, REGION_META.counts.cities);
  assert.equal(currentCountyCodes().length, REGION_META.counts.counties);
  assert.equal(historicalCodes().length, REGION_META.counts.historical);
  assert.equal(new Set(currentCountyCodes()).size, currentCountyCodes().length, '县级码重复');
  assert.equal(new Set(historicalCodes()).size, historicalCodes().length, '历史码重复');
  // 三层形态都要进对照集：只放县级 + 市级+'00' 的话，快照一旦带出历史省级码就静默漏判
  const cur = new Set([...currentCountyCodes(),
    ...currentCityCodes().map((c) => `${c}00`), ...provinceCodes().map((p) => `${p}0000`)]);
  for (const code of historicalCodes()) assert.equal(cur.has(code), false, `${code} 同时出现在两层`);
  assert.deepEqual(REGION_META.historicalLevels, { county: 1159, city: 70 });
});

test('A3 产物体积在预算内（gzip ≤ 34KB，设计文档 §7）', () => {
  const gz = gzipSync(Buffer.from(read('dev/js/tools/region-data.js'))).length;
  assert.ok(gz <= 34 * 1024, `区划表 gzip ${(gz / 1024).toFixed(1)}KB 超预算`);
});

test('A4 生成物是确定性字节：重跑 --check 必须说一致', () => {
  // 用 process.execPath 而不是字面量 'node'：本机 /usr/local/bin/node 是 v16 残留，
  // 谁把 PATH 顺序改一下，生成器就会被 Node 16 执行，报出的 bad option 会被误读成生成器的 bug。
  const out = execFileSync(process.execPath, ['scripts/build-region-data.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  // 必须是「与快照一致」而不是「一致」：后者是前者的子串，"不一致"也能匹配上，等于没闸
  assert.match(out, /与快照一致/);
  assert.doesNotMatch(out, /不一致/);
});

test('A5 四级回落链每一档的结论（样本全部 2026-09-25 实读自快照）', () => {
  const a = resolveRegion('110101');
  assert.deepEqual({ status: a.status, level: a.level, fullName: a.fullName },
    { status: 'current', level: 'county', fullName: '北京市东城区' });

  // 440524（南澳县）两张表都不见 → 落市级，且不下"无效"、绝不产出"未知地区"。
  // 选它正因为它是 §2.2 那条反面教材的同一码：旧库对同一个码吐「广东省汕头市未知地区」。
  const b = resolveRegion('440524');
  assert.equal(b.status, 'uncoded');
  assert.equal(b.level, 'city');
  assert.equal(b.fullName, '广东省汕头市');
  // note 缺字段时 assert.match 报的是"argument must be of type string"，不指认是谁；补 ?? 与 message
  assert.match(b.note ?? '', /未收录/, 'uncoded 结论必须带「未收录」说明');

  // 历史县级（2010 撤销的崇文区）与历史市级（2019 并入济南的莱芜市）及其下辖县
  const c = resolveRegion('110103');
  assert.equal(c.status, 'abolished');
  assert.equal(c.fullName, '北京市崇文区');
  assert.equal(resolveRegion('371200').fullName, '山东省莱芜市');
  assert.equal(resolveRegion('371202').fullName, '山东省莱芜市莱城区');
  assert.equal(resolveRegion('110221').fullName, '北京市昌平县');

  // 6 位「市级码 + 00」是统一社会信用代码区划段的常见形态（示例 350100 即福州市），
  // 必须按现行市级解出来，不能落进「未收录」——这条是 §C 的 USCC 面板的地基。
  assert.deepEqual({ s: resolveRegion('110100').status, l: resolveRegion('110100').level, n: resolveRegion('110100').fullName },
    { s: 'current', l: 'city', n: '北京市' });
  assert.equal(resolveRegion('350100').fullName, '福建省福州市');
  assert.equal(resolveRegion('110000').level, 'province', '省级码 + 0000 按现行省级解');

  // 一级都落不到
  const d = resolveRegion('990101');
  assert.equal(d.status, 'unknown');
  assert.equal(d.level, 'none');

  // 直辖市与省直辖县级的占位市名不得拼进全名；地区/州这一级不是占位名，要照常拼进去
  assert.equal(resolveRegion('310101').fullName, '上海市黄浦区');
  assert.equal(resolveRegion('500103').fullName, '重庆市渝中区');
  assert.equal(resolveRegion('429004').fullName, '湖北省仙桃市');
  assert.equal(resolveRegion('469001').fullName, '海南省五指山市');
  assert.equal(resolveRegion('653201').fullName, '新疆维吾尔自治区和田地区和田市');
  assert.equal(resolveRegion('522702').fullName, '贵州省黔南布依族苗族自治州福泉市');

  // 结构非法的输入不得抛异常，只能落到 none
  for (const bad of ['', '11010', '1101010', 'abcdef', null, undefined, 110101]) {
    assert.equal(resolveRegion(bad).level, 'none', `${String(bad)} 应落到 none`);
  }
  // 样本判据只覆盖抽到的那 4 个码，653201 之类回归成「未知」不会红；把这条升格成全表扫描
  for (const code of [...currentCountyCodes(), ...historicalCodes()]) {
    assert.doesNotMatch(resolveRegion(code).fullName, /未知/, `${code} 解出了「未知」`);
  }
  assert.equal(/未知/.test(JSON.stringify([a, b, c, d])), false, '任何结论里都不许出现「未知」');
});

test('A6 生成侧只暴露现行码，历史码不进级联', () => {
  const beijing = currentCountyCodes('11');
  assert.ok(beijing.includes('110101'));
  assert.equal(beijing.includes('110103'), false, '崇文区不得出现在现行候选里');
  assert.equal(beijing.includes('110221'), false, '昌平县不得出现在现行候选里');
  assert.equal(currentCountyCodes('3712').length, 0, '莱芜不得出现在现行候选里');
  const shiXiaQu = currentCountyCodes('1101');
  assert.equal(shiXiaQu.length, 16, '北京市市辖区现行 16 个县级单位');
  assert.ok(shiXiaQu.every((c) => c.startsWith('1101')));
  // 快照独立对账，逐市比条数。原来那两行北京断言是退化的：11 省下只有 1101 一个市，
  // 两行数的是同一批记录，而且"按 cityCode 数"与生成器"按码前缀分"是同一个判定的两种写法——
  // 只能抓漏记录，抓不到归错市。全表逐市比才钉得住"某个市少 3 条、另一个市多 3 条"这种内部搬运。
  const snapshot = JSON.parse(read('scripts/fixtures/region-source/areas.json'));
  const perCity = new Map();
  for (const x of snapshot) perCity.set(x.cityCode, (perCity.get(x.cityCode) ?? 0) + 1);
  for (const city of currentCityCodes()) {
    assert.equal(currentCountyCodes(city).length, perCity.get(city) ?? 0, `${city} 的县级数与快照对不上`);
  }
  assert.equal(currentCityCodes('35').includes('3501'), true, '福州市应在现行市级里');
  assert.equal(currentCityCodes('37').includes('3712'), false, '莱芜市不得出现在现行市级候选里');
});
```

> `A6` 里 `shiXiaQu.length === 16` 是唯一一个写死的条数，它被末尾那段"逐市对账"覆盖（`1101` 也在 `currentCityCodes()` 里），对账用的是 `Map` 预聚合成 O(n)，不是每市 filter 一遍。这是"抽查项必须逐条从源数据读出后再写进判据"那条教训的落地方式：抽查给锚点，全表给覆盖。

- [ ] **Step 2: 跑一次，确认它红**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `Cannot find module ... dev/js/tools/region.js`，`exit=1`。**这一步必须是红的**；如果绿了，说明测试在够不到真产物的地方自我循环，停下来查。

> **本机跑 node 命令不要把 `/usr/local/bin` 放进 PATH 前面**：那里躺着一个 v16.16.0 残留，而本仓库要的是 nvm 的 v22.19.0（默认 PATH 已优先它）。被 v16 跑起来的症状是 `node: bad option: --disable-warning` / `--test`、`exit=9`——那不是判据红，是环境错。若某条命令报 `command not found`，只补 `/usr/bin:/bin:/usr/sbin:/sbin` 这三段，别补 `/usr/local/bin`。

- [ ] **Step 3: 提交红灯**

```bash
git add scripts/toolkit-tests.mjs
git commit -m "test(tools): 区划码表判据先行（当前为红，待生成器落地）"
```

---

## Task 3: 区划数据生成器与两张表（让它绿）

**Files:**
- Create: `scripts/build-region-data.mjs`
- Create: `dev/js/tools/region-data.js`（由脚本产出，勿手改）
- Create: `dev/js/tools/region.js`

- [ ] **Step 1: 写 `scripts/build-region-data.mjs`**

```js
#!/usr/bin/env node
/**
 * 把 scripts/fixtures/region-source/ 里的四份快照编译成 dev/js/tools/region-data.js。
 *
 * 三条硬要求（设计文档 §6.5）：
 *   1. 不联网。默认只读仓库内快照，因此 CI 与段 5（旧 GB2260.js 已删）之后照样能跑。
 *   2. 确定性。键按码升序、不写入运行时刻；generatedAt 取快照的 fetchedAt，
 *      所以"同一输入 → 同一字节"成立，--check 才有意义。
 *   3. 快照哈希与 SOURCES.json 不符就拒绝生成。数据被悄悄换过比数据旧更危险。
 *
 * 用法：
 *   node scripts/build-region-data.mjs            # 生成 / 覆盖
 *   node scripts/build-region-data.mjs --check    # 只比对，不一致退出码 1（测试用例 A4 用这条）
 *   node scripts/build-region-data.mjs --fetch    # 先刷新三份 modood 快照（需联网），再生成
 *
 * 编码格式（与 dev/js/tools/region.js 的解析器一一对应，改一边必须改另一边）：
 *   RAW_PROVINCES    `码2,名`                     组间 | 分隔
 *   RAW_CITIES       `码4,码2,名`                  组间 | 分隔
 *   RAW_COUNTIES     `码4,NN名 NN名 …`              NN 是 6 位码的后 2 位；组内空格、组间 |
 *   RAW_HISTORICAL   `码6,旧表全名`                 组间 | 分隔；层级由码自身的 00 结尾形态决定
 *   名称里不得出现 , | 空白 与全角标点，assertNoDelimiters() 负责在生成时就挡住。
 *
 * 数据来源与许可：assets/data/LICENSES.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXDIR = resolve(ROOT, 'scripts/fixtures/region-source');
const OUT = resolve(ROOT, 'dev/js/tools/region-data.js');
const ARGV = process.argv.slice(2);
const AS_CHECK = ARGV.includes('--check');
const AS_FETCH = ARGV.includes('--fetch');

const REMOTE = [
  ['provinces', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/provinces.json'],
  ['cities', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/cities.json'],
  ['areas', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/areas.json'],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readRaw = (file) => readFileSync(resolve(FIXDIR, file));
const readJson = (file) => JSON.parse(readRaw(file.endsWith('.json') ? file : `${file}.json`).toString('utf8'));

/** 快照与 SOURCES.json 不符就拒绝出货 */
function verifyManifest(manifest) {
  const list = manifest.files.map((f) => [f.file, f.sha256])
    .concat([[manifest.historical.file, manifest.historical.sha256]]);
  for (const [file, want] of list) {
    const got = sha256(readRaw(file));
    if (got !== want) {
      throw new Error(`快照哈希不符：${file}\n  期望 ${want}\n  实际 ${got}\n`
        + '若确需换数据：node scripts/build-region-data.mjs --fetch，并同步 SOURCES.json 与设计文档 §2.2 的条数');
    }
  }
}

/** 名称里出现分隔符会让整张表错位解析，必须在生成时挡住 */
function assertNoDelimiters(pairs) {
  const bad = pairs.filter(([, name]) => /[|,\s，、；：]/.test(String(name)));
  if (bad.length) {
    throw new Error(`名称含分隔符，编码格式会崩：${bad.slice(0, 5).map(([c, n]) => `${c}:${n}`).join('  ')}`);
  }
}

function assertShape(rows, len, label, parentField) {
  for (const row of rows) {
    const code = String(row.code);
    if (!new RegExp(`^\\d{${len}}$`).test(code)) throw new Error(`${label} 码形不对：${code}`);
    if (parentField && !code.startsWith(String(row[parentField]))) {
      throw new Error(`${label} ${code} 不以父级码 ${row[parentField]} 开头，分组编码会解错`);
    }
  }
  const codes = rows.map((r) => r.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${label} 存在重复码`);
}

function build(manifest) {
  const provinces = readJson('provinces');
  const cities = readJson('cities');
  const areas = readJson('areas');
  const legacy = readJson('gb2260-2015.json');

  assertNoDelimiters(
    [...provinces, ...cities, ...areas].map((x) => [x.code, x.name])
      .concat(Object.entries(legacy)),
  );
  assertShape(provinces, 2, '省级');
  assertShape(cities, 4, '市级', 'provinceCode');
  assertShape(areas, 6, '县级', 'cityCode');

  const curCounty = new Set(areas.map((a) => a.code));
  const curCity = new Set(cities.map((c) => c.code));
  const curProv = new Set(provinces.map((p) => p.code));

  // 历史层 = 旧表里"按其层级查现行表查不到"的码。旧表用 6 位表达三级：
  // XX0000 省级、XXXX00 市级、其余县级，所以判据必须分层级做，不能一律查县级集合。
  const historical = [];
  for (const [code, name] of Object.entries(legacy).sort(([x], [y]) => (x < y ? -1 : 1))) {
    const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
    const hit = level === 'province' ? curProv.has(code.slice(0, 2))
      : level === 'city' ? curCity.has(code.slice(0, 4))
        : curCounty.has(code);
    if (!hit) historical.push([code, name, level]);
  }
  const hitLegacy = Object.keys(legacy).length - historical.length;

  const sortCode = (arr) => arr.slice().sort((x, y) => (x.code < y.code ? -1 : 1));
  const rawProvinces = sortCode(provinces).map((p) => `${p.code},${p.name}`).join('|');
  const rawCities = sortCode(cities).map((c) => `${c.code},${c.provinceCode},${c.name}`).join('|');

  const byCity = new Map();
  for (const a of sortCode(areas)) {
    if (!byCity.has(a.cityCode)) byCity.set(a.cityCode, []);
    byCity.get(a.cityCode).push(`${a.code.slice(4)}${a.name}`);
  }
  const rawCounties = [...byCity.keys()].sort().map((k) => `${k},${byCity.get(k).join(' ')}`).join('|');
  const rawHistorical = historical.map(([c, n]) => `${c},${n}`).join('|');

  const meta = {
    schema: 1,
    generator: 'scripts/build-region-data.mjs',
    datasetVersion: manifest.dataset.dataAsOf,
    datasetReleaseNote: manifest.dataset.releaseNote,
    snapshotFetchedAt: manifest.fetchedAt,
    licenses: { current: manifest.dataset.license, historical: manifest.historical.license },
    counts: {
      provinces: provinces.length,
      cities: cities.length,
      counties: areas.length,
      historical: historical.length,
      legacyTotal: Object.keys(legacy).length,
    },
    historicalLevels: historical.reduce((acc, [, , lv]) => { acc[lv] = (acc[lv] || 0) + 1; return acc; }, {}),
    legacyHitCurrent: hitLegacy,
    sha256: Object.fromEntries(
      manifest.files.map((f) => [f.file, f.sha256]).concat([[manifest.historical.file, manifest.historical.sha256]]),
    ),
  };

  const q = (s) => {
    if (/[\\'`\r\n]/.test(s)) throw new Error('数据里出现会破坏 JS 字符串的字符');
    return `'${s}'`;
  };

  return `/**
 * 行政区划码表 —— 自动生成，请勿手改。
 *
 * 生成器  ：scripts/build-region-data.mjs（重跑：node scripts/build-region-data.mjs）
 * 输入快照：scripts/fixtures/region-source/（哈希见 REGION_META.sha256）
 * 归属许可：assets/data/LICENSES.md
 * 读侧解析：dev/js/tools/region.js —— 编码格式改动必须两边同步，见生成器文件头
 *
 * 现行层口径：${manifest.dataset.releaseNote}
 * 历史层：旧表里现行层查不到的码，用来解开真实存在的老号码带的撤销区划。
 */

export const REGION_META = ${JSON.stringify(meta, null, 2)};

/** 省级：\`码2,名\`，\`|\` 分隔 */
export const RAW_PROVINCES = ${q(rawProvinces)};

/** 市级：\`码4,省码2,名\`，\`|\` 分隔 */
export const RAW_CITIES = ${q(rawCities)};

/** 县级（按市分组）：\`市码4,后2位+名 …\`，组内空格分隔、组间 \`|\` 分隔 */
export const RAW_COUNTIES = ${q(rawCounties)};

/** 历史层：\`码6,旧表全名\`，\`|\` 分隔 */
export const RAW_HISTORICAL = ${q(rawHistorical)};
`;
}

const manifest = readJson('SOURCES.json');

if (AS_FETCH) {
  for (const [name, url] of REMOTE) {
    const file = resolve(FIXDIR, `${name}.json`);
    const before = readFileSync(file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`抓取失败 ${name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    process.stdout.write(`${name}: ${before.length}B → ${buf.length}B ${sha256(buf).slice(0, 12)}\n`);
    if (!buf.equals(before)) {
      writeFileSync(file, buf);
      process.stdout.write('  已更新，记得同步 SOURCES.json 与设计文档 §2.2 的条数\n');
    }
  }
}

verifyManifest(manifest);
const output = build(manifest);
const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;

if (AS_CHECK) {
  if (current === output) {
    process.stdout.write(`region-data.js 与快照一致（${(output.length / 1024).toFixed(1)}KB）\n`);
  } else {
    process.stderr.write('region-data.js 与快照不一致（产物落后于 scripts/fixtures/region-source/）\n'
      + `  产物 ${current === null ? '不存在' : `${current.length}B`} / 期望 ${output.length}B\n`);
    process.exitCode = 1;
  }
} else if (current === output) {
  process.stdout.write('region-data.js 已是最新，未改写\n');
} else {
  writeFileSync(OUT, output);
  const { gzipSync } = await import('node:zlib');
  const gz = gzipSync(Buffer.from(output)).length;
  process.stdout.write(`已生成 dev/js/tools/region-data.js：${(output.length / 1024).toFixed(1)}KB 原始 / ${(gz / 1024).toFixed(1)}KB gzip\n`);
}
```

> 顶部 `import { resolve, dirname }` 与函数内用到的 `new RegExp` 循环变量 `label` 无冲突；`assertShape` 里在模板字符串位置用了转义，直接照抄即可。

- [ ] **Step 2: 跑生成器**

```bash
node scripts/build-region-data.mjs
```

Expected: `已生成 dev/js/tools/region-data.js：≈95KB 原始 / ≈32KB gzip`。gzip 若 > 34KB，先停下来核对 `counts`（多半是多算了一层分组），不要直接抬预算。

- [ ] **Step 3: 核对元信息里的分级数字**

```bash
node -e '
import("./dev/js/tools/region-data.js").then((m) => {
  console.log(JSON.stringify(m.REGION_META.counts));
  console.log(JSON.stringify(m.REGION_META.historicalLevels), "命中现行:", m.REGION_META.legacyHitCurrent);
});
'
```

Expected（2026-09-25 在同一快照上独立实算得到的值）：

```
{"provinces":31,"cities":342,"counties":2978,"historical":1229,"legacyTotal":3465}
{"county":1159,"city":70} 命中现行: 2236
```

省级 0 条历史是预期的：31 个省码全部命中现行表。

- [ ] **Step 4: 写 `dev/js/tools/region.js`**

```js
/**
 * 区划码表的读侧：解析生成物、拼三级全名、跑四级回落链。
 *
 * 为什么单独一层：region-data.js 是生成物、只放数据；回落规则（哪一级算命中、
 * 什么时候不下"无效"结论）是设计判断，混进生成文件等于把它写在模板字符串里，
 * 下次重新生成就会冲掉。口径出处：设计文档 §2.2 末尾 / §5.4。
 *
 * 关键一条：查不到县级码 ≠ 号码无效。真实存在的老号码带的是撤销建制的码，
 * 新设区划又可能晚于数据截止日（REGION_META.datasetVersion）。所以这里只返回
 * status，由调用方决定措辞；并且永远不会产出「未知地区」这类文案
 * （站内旧库 id-validator 的实测反面教材，§2.2 末尾）。
 */
import {
  REGION_META, RAW_PROVINCES, RAW_CITIES, RAW_COUNTIES, RAW_HISTORICAL,
} from './region-data.js';

export { REGION_META };

/** 市级名里不属于真实地名的占位段：拼全名时跳过，否则得到「北京市市辖区东城区」 */
const PLACEHOLDER_CITY = new Set(['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划']);

/** 未收录时的统一措辞。判定不下的项一律用这句，别在别处另写一版 */
export const NOT_COLLECTED_NOTE = '区划码未收录（可能是已撤销建制、经济功能区，或晚于区划数据截止日的调整）';

/**
 * 历史层的口径说明。刻意不写成"已撤销建制"：这一层的定义是"见于 2015 年口径表、
 * 未见于现行表"，两表之差里有真撤销的（110103 崇文区），也有**同码改名**的——
 * 实读 1,934 条交集里有 63 条码在两表之间名字不同而码未变（150203 昆都伦区→昆都仑区、
 * 210112 东陵区→浑南区、210782 北宁市→北镇市 等），断言"已撤销建制"对这 63 条是错的。
 * 设计文档 §5.4 原本要求标"已撤销建制（现行码：xxx，若有）"，这里按实测改成诚实措辞，
 * 并同步回填进设计文档。
 */
export function historicalNote(level) {
  const who = level === 'city' ? '所属地市' : '该区划';
  return `${who}未见于现行区划表（截止 ${REGION_META.datasetVersion}），通常是撤销建制、改码或改名`;
}

const PROVINCES = new Map(); // 码2 -> 名
const CITIES = new Map(); // 码4 -> { code, provinceCode, name }
const COUNTIES = new Map(); // 码6 -> { code, cityCode, name }
const HISTORICAL = new Map(); // 码6 -> { code, name, level }
const COUNTY_CODES_BY_CITY = new Map(); // 码4 -> [码6…]
const COUNTY_CODES_BY_PROV = new Map(); // 码2 -> [码6…]
const ALL_COUNTY_CODES = [];

for (const row of RAW_PROVINCES.split('|')) {
  const [code, name] = row.split(',');
  PROVINCES.set(code, name);
}

const CITY_CODES_BY_PROV = new Map();
for (const row of RAW_CITIES.split('|')) {
  const [code, provinceCode, name] = row.split(',');
  CITIES.set(code, { code, provinceCode, name });
  if (!CITY_CODES_BY_PROV.has(provinceCode)) CITY_CODES_BY_PROV.set(provinceCode, []);
  CITY_CODES_BY_PROV.get(provinceCode).push(code);
}

for (const group of RAW_COUNTIES.split('|')) {
  const at = group.indexOf(',');
  const cityCode = group.slice(0, at);
  const list = [];
  for (const token of group.slice(at + 1).split(' ')) {
    const code = cityCode + token.slice(0, 2);
    COUNTIES.set(code, { code, cityCode, name: token.slice(2) });
    list.push(code);
  }
  COUNTY_CODES_BY_CITY.set(cityCode, list);
  ALL_COUNTY_CODES.push(...list);
}
ALL_COUNTY_CODES.sort();

for (const [p, list] of COUNTY_CODES_BY_CITY) {
  COUNTY_CODES_BY_PROV.set(p.slice(0, 2), (COUNTY_CODES_BY_PROV.get(p.slice(0, 2)) || []).concat(list));
}
for (const list of COUNTY_CODES_BY_PROV.values()) list.sort();

for (const row of RAW_HISTORICAL.split('|')) {
  const at = row.indexOf(',');
  const code = row.slice(0, at);
  const name = row.slice(at + 1);
  const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
  HISTORICAL.set(code, { code, name, level });
}

/** 省 + （非占位的）市 + 县 拼全名 */
function joinNames(provinceCode, cityCode, countyName) {
  const province = PROVINCES.get(provinceCode) || '';
  const city = CITIES.get(cityCode);
  const middle = city && !PLACEHOLDER_CITY.has(city.name) ? city.name : '';
  return `${province}${middle}${countyName || ''}`;
}

/**
 * 解一个 6 位行政区划码。返回结构在 §5.4 里定义，供身份证与统一代码两个面板共用。
 *
 * @param {string|number|null} code 6 位行政区划码
 * @returns {{
 *   code:string, status:'current'|'abolished'|'uncoded'|'unknown',
 *   level:'county'|'city'|'province'|'none',
 *   provinceCode:string, cityCode:string, countyCode:string,
 *   province:string, city:string, county:string, fullName:string, note:string
 * }}
 */
export function resolveRegion(code) {
  const c6 = String(code ?? '').trim();
  const provinceCode = c6.slice(0, 2);
  const base = {
    code: c6, status: 'unknown', level: 'none',
    provinceCode, cityCode: c6.slice(0, 4), countyCode: c6,
    province: PROVINCES.get(provinceCode) || '', city: '', county: '',
    fullName: '', note: '',
  };
  if (!/^\d{6}$/.test(c6)) return { ...base, note: '行政区划码应为 6 位数字' };

  // 优先级：现行县级 → 现行市/省级（6 位形如「市级码+00」）→ 历史层 → 市级回落 → 省级回落 → 落空
  const county = COUNTIES.get(c6);
  if (county) {
    const city = CITIES.get(county.cityCode);
    return {
      ...base, status: 'current', level: 'county', cityCode: county.cityCode,
      city: city ? city.name : '', county: county.name,
      fullName: joinNames(provinceCode, county.cityCode, county.name),
    };
  }
  // 统一信用代码的区划段常写成「市级码 + 00」（示例 350100 即福州市辖区）。
  // 这一档必须排进历史层之前：这类码在旧表里也存在，但那是同一建制的现行码，不是撤销项。
  if (c6.endsWith('00')) {
    const city = CITIES.get(c6.slice(0, 4));
    if (city) {
      return {
        ...base, status: 'current', level: 'city', city: city.name,
        fullName: joinNames(provinceCode, c6.slice(0, 4), ''),
      };
    }
    if (c6.endsWith('0000') && PROVINCES.has(provinceCode)) {
      return { ...base, status: 'current', level: 'province', fullName: base.province };
    }
  }
  const hist = HISTORICAL.get(c6);
  if (hist) {
    return {
      ...base, status: 'abolished', level: hist.level,
      county: hist.level === 'county' ? hist.name : '',
      fullName: hist.name,
      note: historicalNote(hist.level),
    };
  }
  const city = CITIES.get(base.cityCode);
  if (city) {
    return {
      ...base, status: 'uncoded', level: 'city', city: city.name,
      fullName: joinNames(provinceCode, base.cityCode, ''), note: NOT_COLLECTED_NOTE,
    };
  }
  const histCity = HISTORICAL.get(`${base.cityCode}00`);
  if (histCity) {
    return {
      ...base, status: 'abolished', level: 'city', fullName: histCity.name,
      note: historicalNote('city'),
    };
  }
  if (base.province) {
    return { ...base, status: 'uncoded', level: 'province', fullName: base.province, note: NOT_COLLECTED_NOTE };
  }
  return { ...base, status: 'unknown', level: 'none', note: '省级代码不存在' };
}

/**
 * 现行县级码集合，可按省码 / 市码 / 任意前缀收窄。
 * 这是生成侧唯一的地址来源：历史码永不进候选（§5.4）。
 */
export function currentCountyCodes(prefix = '') {
  const p = String(prefix ?? '');
  if (p === '') return ALL_COUNTY_CODES.slice();
  if (p.length === 2) return (COUNTY_CODES_BY_PROV.get(p) || []).slice();
  if (p.length === 4) return (COUNTY_CODES_BY_CITY.get(p) || []).slice();
  return ALL_COUNTY_CODES.filter((c) => c.startsWith(p));
}

/** 现行市级码集合，可按省码收窄（统一代码的区划段只到地市，用这条） */
export function currentCityCodes(provinceCode = '') {
  if (provinceCode === '') return [...CITIES.keys()].sort();
  return (CITY_CODES_BY_PROV.get(String(provinceCode).slice(0, 2)) || []).slice().sort();
}

export function provinceCodes() {
  return [...PROVINCES.keys()].sort();
}

export function historicalCodes() {
  return [...HISTORICAL.keys()].sort();
}

/** 该码能否作为生成地址（只有现行县级 / 现行市级可以） */
export function isGeneratable(code, level = 'county') {
  return level === 'county' ? COUNTIES.has(String(code)) : CITIES.has(String(code));
}

/** 省码 -> 省名；面板做三级级联时直接用 */
export function provinceName(code) {
  return PROVINCES.get(String(code).slice(0, 2)) || '';
}

export function cityName(code) {
  const c = CITIES.get(String(code).slice(0, 4));
  return c ? c.name : '';
}
```

- [ ] **Step 5: 跑测试**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `# pass 6`、`# fail 0`、`exit=0`。

- [ ] **Step 6: 再跑一次生成器，确认幂等**

```bash
node scripts/build-region-data.mjs && node scripts/build-region-data.mjs --check; echo "exit=$?"
```

Expected: 第一次 `region-data.js 已是最新，未改写`，第二次 `… 一致`、`exit=0`。

- [ ] **Step 7: 提交**

```bash
git add scripts/build-region-data.mjs dev/js/tools/region-data.js dev/js/tools/region.js scripts/toolkit-tests.mjs
git commit -m "feat(tools): 区划码表两层落地，生成器可离线重跑并自检快照哈希"
```

---

## Task 4: 身份证模块（含与站内旧库的对拍夹具）

**Files:**
- Create: `scripts/build-id-fixture.mjs`
- Create: `scripts/fixtures/id-validator-checkbit-1000.json`（由上一条生成，**提交进仓库**）
- Create: `dev/js/tools/random.js`
- Create: `dev/js/tools/idcard.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §B 九条）

### 4.0 先钉死一件事：对拍的四条实测地基

夹具不是"随便抽 1000 条号码让两个实现比一比"。开工前已用 `demo/idCardDemo/lib/IDValidator.js`（文件头写 v1.2.0；源码里 `checkOrder` 直接 `return true`、`checkBirth` 只判 `month > 12 || month === 0 || day > 31 || day === 0`，年份下限那段整个注释掉并留了 TODO）实测过 13 组边界。结论直接决定夹具怎么分组：

| 探针输入 | 旧库 `isValid` | 旧库 `getInfo` | 我们的口径 | 分组 |
|---|---|---|---|---|
| `110101199003073503` | true | `北京市东城区` / `1990-03-07` / 女 | 同 | agree18 |
| `11010118991231001X` | true | …/ 1899-12-31 | 早于 1900-01-01 → 结构非法 | birth_before_1900 |
| `110101190001010014` | true | …/ 1900-01-01 | 有效（下界本身） | agree18 |
| `110101290001010012` | true | …/ 2900-01-01 | 晚于今天 → 结构非法 | birth_after_today |
| `110101199902290018` | true | …/ 1999-02-29 | 非闰年 2 月 29 → 结构非法 | feb29_nonleap |
| `110114199003070013` | true | `北京市市辖区未知地区` | 昌平区（现行表有、旧表无） | name_current_only |
| `150203…`（昆都伦区→昆都仑区） | true | 旧名 | 现行名 | renamed |
| `990101199003070015` | false | false | 结构非法 | 不取样（省码不存在） |
| `110101199003073504`（末位错） | false | false | 校验位不符 | 单独用例，不进批量 |
| 17 位 / 19 位 / 14 位 | false | false | 结构非法 | B3 |
| 内部含空格 | false | false | 结构非法（只 trim 首尾） | B3 |
| 末位小写 `x` | true | 北京市东城区 | trim + 大写后接受 | agree18 |
| `11010190030700A`（15 位末位字母） | **true** | 北京市东城区 | 结构非法 | B3（写进判据，不进夹具） |

最后一条是旧库的真实缺陷：`checkArg` 只校长度并大写化、`checkOrder` 恒真、15 位又没有校验位算术，字母混进去没人拦。

`renamed` 这一组是实读出来的：现行表 ∩ 旧表 = 1,934 条，其中 **63 条码相同而名字不同**（`130502` 桥东区→襄都区、`210112` 东陵区→浑南区、`210782` 北宁市→北镇市、`150203` 昆都伦区→昆都仑区 等）。这意味着两件事：① 同结论组的样本**只能从"同码同名"的那 1,871 条里取**，否则"两边地址名必须相等"这条判据会因数据版本差异而误红；② `region.js` 里历史层的措辞不能写成"已撤销建制"——这 63 条没撤销，只是改名。Task 3 的 `historicalNote()` 就是为此存在。

**所以"对拍"绝不能写成"两个实现结论必须完全一致"**：那样要么把上面几类分歧判成 bug，要么逼我们把判据写松。夹具的做法是**把分歧登记成组，每组各自断言方向**——同结论组守住"不许无故变红"，异结论组守住"分歧只朝我们更严 / 我们更新这两个方向，且只由指定的那一项否决引起"。

### 4.1 Step 1：写夹具生成器

`scripts/build-id-fixture.mjs` 只在开工时跑一次（段 5 按 §10 删掉 `demo/idCardDemo/`，届时旧库不在了，夹具自身成为长期守卫）。它读仓库内的两份快照 + 旧库，产出自带旧库结论的 JSON；带 `--check` 幂等模式；任何一组的不变量不成立就直接抛——**宁可生成失败，不产出"看起来对"的夹具**。

```js
#!/usr/bin/env node
/**
 * 生成 scripts/fixtures/id-validator-checkbit-1000.json —— 身份证算法与站内旧库
 * （id-validator，MIT，作者 mc-zone）的对拍夹具。
 *
 * 为什么把旧库结论固化成文件，而不是在测试里 require 旧库：段 5 要按设计文档 §10
 * 删掉 demo/idCardDemo/，判据不能依赖一个注定消失的目录。夹具存着旧库当时的
 * isValid / getInfo 原样结果，删库之后这条对拍照样成立。
 *
 * 用法：
 *   node scripts/build-id-fixture.mjs            # 生成 / 覆盖
 *   node scripts/build-id-fixture.mjs --check    # 只比对字节，不一致退 1
 *
 * 确定性：mulberry32(20260925) + 候选码先排序后取索引 + 字段按固定顺序写入 + 不写运行时刻。
 * 同一份快照必须产出同一字节流，否则 --check 与 A4 那类幂等判据没有意义。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const require = createRequire(import.meta.url);
const OUT = 'scripts/fixtures/id-validator-checkbit-1000.json';
/** 写死而不是取墙钟：每条样本自带 today，判据永不误红于"出生日期晚于今天" */
const TODAY = '2026-09-25';

/** 分组配额，合计 1000；改配额要同步改 §B 的 B7 */
const GROUPS = {
  agree18: 670, agree15: 100, name_current_only: 100, renamed: 50,
  birth_before_1900: 30, birth_after_today: 30, feb29_nonleap: 20,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260925);

const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const areas = readJson('scripts/fixtures/region-source/areas.json');
const cities = readJson('scripts/fixtures/region-source/cities.json');
const legacy = readJson('scripts/fixtures/region-source/gb2260-2015.json');

const currentCounty = new Set(areas.map((a) => a.code));
const countyName = new Map(areas.map((a) => [a.code, a.name]));
const currentCity = new Set(cities.map((c) => c.code));
const legacyCounty = new Set(Object.keys(legacy).filter((k) => !k.endsWith('00')));

const both = [...currentCounty].filter((c) => legacyCounty.has(c)).sort();
/** 同码同名（实读 1,871 条）：只有这里的样本允许断言"两边地址名相等" */
const BOTH = both.filter((c) => String(legacy[c]).endsWith(countyName.get(c))).sort();
/** 同码改名（实读 63 条）：我们给现行名、旧库给 2015 年前后的旧名 */
const RENAMED = both.filter((c) => !String(legacy[c]).endsWith(countyName.get(c))).sort();
/** 现行有、旧表无且市级可回落（实读 1,044 条里市级在表的那批）：旧库必然吐「未知地区」 */
const ONLY_CURRENT = [...currentCounty]
  .filter((c) => !legacyCounty.has(c) && currentCity.has(c.slice(0, 4)))
  .sort();

if (BOTH.length < GROUPS.agree18) throw new Error(`同码同名池只有 ${BOTH.length} 条，取不够 agree18 配额`);
if (RENAMED.length < GROUPS.renamed) throw new Error(`同码改名池只有 ${RENAMED.length} 条，不足 ${GROUPS.renamed}`);
if (ONLY_CURRENT.length < GROUPS.name_current_only) throw new Error(`仅现行有的池只有 ${ONLY_CURRENT.length} 条`);

const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** ISO 7064 MOD 11-2。与 dev/js/tools/idcard.js 各写一遍是故意的：
 *  共用就等于用被测实现验证被测实现，幂等判据也会跟着失去牙齿。 */
const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const M = '10X98765432';
const checkOf = (body17) => {
  let s = 0;
  for (let i = 0; i < 17; i += 1) s += Number(body17[i]) * W[i];
  return M[s % 11];
};
/** 顺序码 1..999：000 在真实发行里不出现，别把它当"一致"样本喂给旧库 */
const seq3 = () => String(1 + Math.floor(rng() * 999)).padStart(3, '0');
const make18 = (area, birth8, seq) => {
  const body = `${area}${birth8}${seq}`;
  return body + checkOf(body);
};
/** 1901-01-01 .. 2005-12-31 之间的合法日期：离 TODAY 足够远，年龄类判据不会随时间翻脸 */
function legalBirth() {
  const y = 1901 + Math.floor(rng() * 105);
  const m = 1 + Math.floor(rng() * 12);
  const last = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${y}${pad(m)}${pad(1 + Math.floor(rng() * last))}`;
}

// 绝对路径：createRequire 的相对基准是本脚本所在的 scripts/，写 './demo/…' 会解析到 scripts/demo/…
global.GB2260 = require(resolve(ROOT, 'demo/idCardDemo/lib/GB2260.js'));
const IDValidator = require(resolve(ROOT, 'demo/idCardDemo/lib/IDValidator.js'));
const oracle = new IDValidator(global.GB2260);

/** 跑一遍旧库、原样记下它的结论；invariant 由各组自带组名地抛错 */
function record(id, invariant) {
  const valid = oracle.isValid(id);
  const info = valid ? oracle.getInfo(id) : false;
  invariant(valid, info);
  return {
    id,
    today: TODAY,
    oracleValid: valid,
    oracleAddr: info === false ? '' : info.addr,
    oracleBirth: info === false ? '' : info.birth,
    oracleSex: info === false ? '' : info.sex,
  };
}

const cases = {
  agree18: [], agree15: [], name_current_only: [], renamed: [],
  birth_before_1900: [], birth_after_today: [], feb29_nonleap: [],
};

for (let i = 0; i < GROUPS.agree18; i += 1) {
  cases.agree18.push(record(make18(pick(BOTH), legalBirth(), seq3()), (valid, info) => {
    if (valid !== true) throw new Error('agree18: 旧库判无效');
    if (/未知/.test(info.addr)) throw new Error(`agree18: 同码同名池里旧库吐了「未知」→ ${info.addr}`);
  }));
}
for (let i = 0; i < GROUPS.agree15; i += 1) {
  const area = pick(BOTH);
  cases.agree15.push(record(`${area}${legalBirth().slice(2)}${seq3()}`, (valid, info) => {
    if (valid !== true || /未知/.test(info.addr)) throw new Error('agree15: 旧库不同结论');
  }));
}
for (let i = 0; i < GROUPS.name_current_only; i += 1) {
  const area = pick(ONLY_CURRENT);
  const rec = record(make18(area, legalBirth(), seq3()), (valid, info) => {
    if (valid !== true) throw new Error('name_current_only: 旧库判无效，这组不成立');
    if (!/未知地区/.test(info.addr)) throw new Error(`name_current_only: 旧库这次没吐「未知地区」→ ${info.addr}`);
  });
  rec.areaCode = area;
  rec.currentName = countyName.get(area);
  cases.name_current_only.push(rec);
}
for (let i = 0; i < GROUPS.renamed; i += 1) {
  const area = pick(RENAMED);
  const rec = record(make18(area, legalBirth(), seq3()), (valid) => {
    if (valid !== true) throw new Error('renamed: 旧库判无效');
  });
  rec.areaCode = area;
  rec.currentName = countyName.get(area);
  rec.legacyName = String(legacy[area]);
  cases.renamed.push(rec);
}
for (let i = 0; i < GROUPS.birth_before_1900; i += 1) {
  const y = 1880 + Math.floor(rng() * 20);
  cases.birth_before_1900.push(record(make18(pick(BOTH), `${y}${pad(1 + Math.floor(rng() * 12))}${pad(1 + Math.floor(rng() * 28))}`, seq3()), (valid) => {
    if (valid !== true) throw new Error('birth_before_1900: 旧库判无效，这组的分歧方向不成立');
  }));
}
for (let i = 0; i < GROUPS.birth_after_today; i += 1) {
  const y = 2090 + Math.floor(rng() * 10);
  cases.birth_after_today.push(record(make18(pick(BOTH), `${y}0${1 + Math.floor(rng() * 8)}${pad(1 + Math.floor(rng() * 28))}`, seq3()), (valid) => {
    if (valid !== true) throw new Error('birth_after_today: 旧库判无效，这组的分歧方向不成立');
  }));
}
for (let i = 0; i < GROUPS.feb29_nonleap; i += 1) {
  let y = 1901 + Math.floor(rng() * 105);
  if (isLeap(y)) y -= 1;
  if (isLeap(y)) y -= 2;
  cases.feb29_nonleap.push(record(make18(pick(BOTH), `${y}0229`, seq3()), (valid) => {
    if (valid !== true) throw new Error('feb29_nonleap: 旧库判无效，这组的分歧方向不成立');
  }));
}

const total = Object.values(cases).reduce((n, list) => n + list.length, 0);
if (total !== 1000) throw new Error(`夹具总数 ${total} != 1000`);

const doc = {
  schema: 1,
  generator: 'scripts/build-id-fixture.mjs',
  purpose: '身份证算法与站内旧库 id-validator 的对拍夹具；段 5 删掉 demo/idCardDemo/ 后它是唯一长期守卫',
  oracle: {
    name: 'id-validator（demo/idCardDemo/lib/IDValidator.js，文件头标 v1.2.0）',
    license: 'MIT (mc-zone)',
    knownWeaknesses: [
      'checkOrder 恒真：15 位号码末位可以是字母',
      'checkBirth 只判 month>12||month===0||day>31||day===0：非闰年 2 月 29 放过；年份上下限整段注释掉并留 TODO',
      'getAddrInfo 回落到市/省级后吐「…未知地区」，给不出可用的县级信息',
      '地址名取自 2015 年前后的 GB2260：同码改名的 63 条会给旧名',
    ],
  },
  datasetVersion: '2022-10-31',
  seed: 20260925,
  today: TODAY,
  pools: { sameName: BOTH.length, renamed: RENAMED.length, onlyCurrent: ONLY_CURRENT.length },
  groupCounts: { ...GROUPS },
  total,
  divergencePolicy: 'agree* 必须同结论；name_current_only 与 renamed 是我们更新；birth_* / feb29_nonleap 是我们更严且只由出生日期单独否决',
  cases,
};

const out = `${JSON.stringify(doc, null, 2)}\n`;
const target = resolve(ROOT, OUT);
if (process.argv.includes('--check')) {
  const cur = readFileSync(target, 'utf8');
  process.stdout.write(cur === out ? `${OUT} 与生成器一致\n` : `${OUT} 落后于生成器\n`);
  process.exit(cur === out ? 0 : 1);
}
writeFileSync(target, out);
process.stdout.write(`${OUT}: ${total} 条 · ${Object.entries(GROUPS).map(([k, v]) => `${k}=${v}`).join(' ')}
`);
```

- [ ] **Step 2: 跑生成器，核对分组计数与取样池**

```bash
node scripts/build-id-fixture.mjs; echo "exit=$?"
```

Expected: `scripts/fixtures/id-validator-checkbit-1000.json: 1000 条 · agree18=670 agree15=100 name_current_only=100 renamed=50 birth_before_1900=30 birth_after_today=30 feb29_nonleap=20`、`exit=0`。

```bash
node scripts/build-id-fixture.mjs --check; echo "exit=$?"
node scripts/build-id-fixture.mjs && node scripts/build-id-fixture.mjs --check; echo "exit=$?"
```

Expected: 两次都 `… 与生成器一致` / `exit=0`（字节级幂等）。

任一组抛错时**不要放宽断言**：抛错说明取样落进了没预料的分支，先把那条号码和它的地址码打出来，查它属于哪一层再改取样池。`pools` 字段会告诉你三个池的实际大小（开工前实读 1,871 / 63 / ≤1,044）。

- [ ] **Step 3: 写 §B 判据（追加到 `scripts/toolkit-tests.mjs` 末尾）**

```js
// ── §B 身份证 ──────────────────────────────────────────────────────────────

const { parseIdCard, parseIdCardList, generateIdCards, computeCheckDigit,
  WEIGHTS, CHECK_MAP, BIRTH_FLOOR, GENERATE_MAX, USE_NOTE, isLeapYear, daysInMonth,
} = await import('../dev/js/tools/idcard.js');
const { seededRandom } = await import('../dev/js/tools/random.js');

const FX = JSON.parse(read('scripts/fixtures/id-validator-checkbit-1000.json'));
/** 用已钉死的校验位算法造合法输入：判据里不再手算末位 */
const mk = (body17) => body17 + computeCheckDigit(body17);
const p = (c) => parseIdCard(c.id, { today: c.today });
const failedKeys = (r) => r.checks.filter((k) => k.ok === false).map((k) => k.key);
const rowOf = (r, key) => r.checks.find((k) => k.key === key);

test('B1 校验位：§2.2 实跑样本 + 权重表等价性 + 非法输入返回 null 不抛', () => {
  // 这 9 条的期望值全部来自 2026-09-25 对 demo/idCardDemo/lib/IDValidator.js 的实跑，
  // 不是自家算完自说自话。440524…0014 就是 §2.2 那条"示例号末位是 4 不是 8"。
  const known = {
    '11010119900307350': '3', '44052418800101001': '4', '11010118991231001': 'X',
    '11010119000101001': '4', '11010119900307001': '3', '11011419900307001': '3',
    '11010120000229001': '8', '11010119990229001': '8', '99010119900307001': '5',
  };
  for (const [body, want] of Object.entries(known)) {
    assert.equal(computeCheckDigit(body), want, `${body} 校验位应为 ${want}`);
  }
  assert.equal(WEIGHTS.length, 17);
  for (let i = 0; i < 17; i += 1) {
    assert.equal(WEIGHTS[i], 2 ** (17 - i) % 11, `第 ${i + 1} 位权重与 2^(18-i) mod 11 不符`);
  }
  assert.equal(CHECK_MAP, '10X98765432');
  assert.equal(computeCheckDigit('1101011990030735'), null, '16 位 body 要返回 null 而不是抛');
  assert.equal(computeCheckDigit('11010119900307350X'), null, 'body 含非数字要返回 null');
  assert.equal(computeCheckDigit(null), null);
});

test('B2 三态判定与逐项表：三种结论分得开，且看得见是谁否决的', () => {
  const ok = parseIdCard('110101199003073503', { today: TODAY });
  assert.equal(ok.state, 'valid');
  assert.deepEqual(failedKeys(ok), []);
  assert.deepEqual(ok.checks.map((k) => k.key),
    ['charset', 'length', 'region', 'birth', 'order', 'checkBit']);
  assert.equal(ok.info.region.fullName, '北京市东城区');
  assert.equal(ok.info.sex, '女');                                  // 顺序码 350 → 偶 → 女（旧库同结论）
  assert.equal(CHECK_MAP[ok.info.checkWork.sum % 11], ok.info.expectedCheckBit);

  const bad = parseIdCard('110101199003073504', { today: TODAY });   // 末位应为 3
  assert.equal(bad.state, 'checkdigit');
  assert.deepEqual(failedKeys(bad), ['checkBit']);
  assert.equal(bad.expectedCheckBit, '3');
  assert.equal(bad.value, '110101199003073504', '必须原样保留用户填的错末位');
  assert.equal(bad.suggestedId18, '110101199003073503');

  const malformed = parseIdCard('110101199902290018', { today: TODAY });
  assert.equal(malformed.state, 'malformed');
  assert.deepEqual(failedKeys(malformed), ['birth']);
  assert.equal(rowOf(malformed, 'checkBit').ok, true);               // 校验位本身是通的
  assert.equal(parseIdCard('', { today: TODAY }).state, 'empty');
  assert.equal(parseIdCard('   ', { today: TODAY }).state, 'empty');
});

test('B3 字符集与长度：13 组实测边界，含旧库放过而我们不放的', () => {
  const cases = [
    ['11010119900307350x', 'valid'],         // 小写 x：trim + 大写后接受
    [' 110101199003073503 ', 'valid'],       // 只 trim 首尾
    ['110101 199003073503', 'malformed'],    // 内部空格不吞，并给出原因
    ['1101011990030735031', 'malformed'],    // 19 位
    ['11010119900307350', 'malformed'],      // 17 位
    ['11010A199003073503', 'malformed'],
    ['1101011990030735X3', 'malformed'],     // X 只允许出现在 18 位串末位
    ['000000000000000000', 'malformed'],     // 省码不存在
    ['11010190030700A', 'malformed'],        // 旧库判有效（checkOrder 恒真），我们不放过
    ['110101900307001', 'valid'],            // 15 位
    ['11010190030700', 'malformed'],         // 14 位
    [null, 'empty'],
    [12345678901234567, 'malformed'],        // 数字入参：转字符串后按长度判（旧库对 >15 位的数字直接拒）
  ];
  for (const [input, want] of cases) {
    assert.equal(parseIdCard(input, { today: TODAY }).state, want, `${String(input)} 应判 ${want}`);
  }
  const spaced = parseIdCard('110101 199003073503', { today: TODAY });
  assert.match(rowOf(spaced, 'charset').detail, /空格/);
  assert.equal(spaced.repairedHint, '110101199003073503');
});

test('B4 15 位与 18 位互为等价写法，且只在无歧义时给', () => {
  const from15 = parseIdCard('110101900307001', { today: TODAY });
  assert.equal(from15.state, 'valid');
  assert.equal(from15.id18, '110101199003070013');   // body 用「区划 + 19 + yyMMdd + 顺序码」拼，不是错位取 8 位
  assert.equal(from15.id15, '110101900307001');

  const from18 = parseIdCard('110101199003070013', { today: TODAY });
  assert.equal(from18.id15, '110101900307001');
  assert.match(from18.id15Note, /由 18 位去世纪位得来/);

  const y2003 = parseIdCard(mk('11010120030701001'), { today: TODAY });
  assert.equal(y2003.state, 'valid');
  assert.equal(y2003.id15, '', '20xx 出生不得给 15 位等价写法（§2.2：造出来是给人埋坑）');
  assert.equal(y2003.id15Note, '');

  // 校验位不符时也要保留用户末位，同时给出建议形态：判据要显示的就是那个错的位
  const wrong = parseIdCard('110101199003070014', { today: TODAY });
  assert.equal(wrong.state, 'checkdigit');
  assert.equal(wrong.id18, '110101199003070014');
  assert.equal(wrong.suggestedId18, '110101199003070013');
});

test('B5 出生日期：闰年、非闰年、上下界、周岁', () => {
  const leap = parseIdCard('110101200002290018', { today: '2026-09-25' });
  assert.equal(leap.state, 'valid');
  assert.equal(leap.info.birth, '2000-02-29');
  assert.equal(leap.info.ageYears, 26);
  assert.equal(parseIdCard('110101190001010014', { today: '2026-09-25' }).state, 'valid', `${BIRTH_FLOOR} 本身在界内`);
  const tooEarly = parseIdCard('11010118991231001X', { today: '2026-09-25' });
  assert.equal(tooEarly.state, 'malformed');
  assert.match(rowOf(tooEarly, 'birth').detail, /1900-01-01/);
  assert.equal(tooEarly.info.birth, '1899-12-31', '越出我们自设下界，仍要把解出来的日期给用户看');
  const notADate = parseIdCard('110101199902290018', { today: '2026-09-25' });
  assert.equal(notADate.info.birth, null, '连真实日期都不成立时不给日期');
  assert.equal(notADate.info.birthRaw, '19990229');
  const future = parseIdCard(mk('11010120270101001'), { today: '2026-09-25' });
  assert.equal(future.state, 'malformed');
  assert.match(rowOf(future, 'birth').detail, /晚于今天/);

  // 生日未到 → 周岁减一；整日比较，不受本机时区影响
  const b = parseIdCard(mk('11010120001231001'), { today: '2026-09-25' });
  assert.equal(b.state, 'valid');
  assert.equal(b.info.ageYears, 25);
  assert.equal(parseIdCard('110101200002290018', { today: '2026-09-25' }).info.ageYears, 26);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(daysInMonth(2100, 2), 28);
});

test('B6 区划查不到不下"无效"结论，且任何输出里不出现「未知」', () => {
  const uncollected = parseIdCard(mk('11019919900307001'), { today: TODAY });
  assert.equal(uncollected.state, 'valid', '县级码查不到不能判无效（§5.4）');
  assert.equal(rowOf(uncollected, 'region').ok, null, '未收录是"不下结论"，不是 false');
  assert.equal(uncollected.hasCaveat, true);
  assert.match(uncollected.caveat, /未收录/);

  const historical = parseIdCard(mk('11010319900307001'), { today: TODAY });   // 崇文区，2010 撤销
  assert.equal(historical.state, 'valid');
  assert.equal(historical.info.region.status, 'abolished');
  assert.match(historical.caveat, /未见于现行区划表/, '历史层措辞要诚实，不能断言"已撤销建制"');
  assert.equal(historical.info.region.fullName, '北京市崇文区');

  // 反面对手：站内旧库对 440524 吐的是「广东省汕头市未知地区」（§2.2 末尾）
  const fallback = parseIdCard(mk('44052419900307001'), { today: TODAY });
  assert.equal(fallback.state, 'valid');
  assert.doesNotMatch(JSON.stringify(fallback.info), /未知/, '我们的输出里不允许出现「未知地区」');
  assert.ok(fallback.info.region.fullName.length > 0);

  // 顺序码 000：记一条但不下无效结论
  const seqZero = parseIdCard(mk('11010119900307000'), { today: TODAY });
  assert.equal(seqZero.state, 'valid');
  assert.equal(rowOf(seqZero, 'order').ok, null);
  assert.match(rowOf(seqZero, 'order').detail, /未分配/);

  for (const code of ['110101', '110103', '110199', '440524', '371202', '500101', '990101', 'abcdef', '', null]) {
    assert.doesNotMatch(resolveRegion(code).fullName, /未知/, `${code} 解出了「未知」`);
  }
});

test('B7 与站内旧库对拍：同结论组守住，分歧组方向守住', () => {
  assert.equal(FX.total, 1000);
  assert.equal(Object.values(FX.groupCounts).reduce((a, b) => a + b, 0), FX.total);
  for (const [g, n] of Object.entries(FX.groupCounts)) {
    assert.equal(FX.cases[g].length, n, `${g} 组实际条数与声明的 ${n} 不符`);
  }
  for (const g of ['agree18', 'agree15']) {
    const uniq = new Set(FX.cases[g].map((c) => c.id));
    assert.ok(uniq.size >= 250, `${g} 去重后只有 ${uniq.size} 条，取样池太薄，判据没有覆盖力`);
  }

  for (const c of FX.cases.agree18) {
    assert.equal(c.oracleValid, true);
    const r = p(c);
    assert.equal(r.state, 'valid', `agree18 ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.fullName, c.oracleAddr, `${c.id} 地址名与旧库不一致`);
    assert.equal(r.info.birth, c.oracleBirth);
    assert.equal(r.info.sex, c.oracleSex);
  }
  for (const c of FX.cases.agree15) {
    const r = p(c);
    assert.equal(r.state, 'valid', `agree15 ${c.id} 判成 ${r.state}`);
    assert.equal(r.info.region.fullName, c.oracleAddr);
    assert.equal(r.id18.slice(0, 17), `${c.id.slice(0, 6)}19${c.id.slice(6, 12)}${c.id.slice(-3)}`);
  }

  // 我们更新（一）：旧库在"仅现行表有"的码上回落到市级并吐「未知地区」
  for (const c of FX.cases.name_current_only) {
    assert.match(c.oracleAddr, /未知地区/, '夹具里旧库结论应带「未知地区」，否则这组不成立');
    const r = p(c);
    assert.equal(r.state, 'valid');
    assert.equal(r.info.region.status, 'current');
    assert.equal(r.info.region.county, c.currentName, `${c.id} 没解出现行县级名`);
    assert.doesNotMatch(r.info.region.fullName, /未知/);
  }
  // 我们更新（二）：同码改名，旧库给 2015 年前后的旧名
  for (const c of FX.cases.renamed) {
    assert.equal(c.oracleValid, true);
    assert.doesNotMatch(c.legacyName, new RegExp(`^${c.currentName}$`));
    const r = p(c);
    assert.equal(r.state, 'valid');
    assert.equal(r.info.region.county, c.currentName, `${c.id} 应当给现行名`);
    assert.equal(r.info.region.fullName.endsWith(c.currentName), true);
    assert.notEqual(r.info.region.fullName, c.oracleAddr, `${c.areaCode} 新旧同名，不该进这组`);
  }

  // 我们更严：只允许由出生日期单独否决，别把校验位算术也污染了
  for (const g of ['birth_before_1900', 'birth_after_today', 'feb29_nonleap']) {
    for (const c of FX.cases[g]) {
      assert.equal(c.oracleValid, true, `${g}: 旧库判了无效，这组的分歧方向不成立`);
      const r = p(c);
      assert.equal(r.state, 'malformed', `${g} ${c.id} 判成 ${r.state}`);
      assert.deepEqual(failedKeys(r), ['birth'], `${g} 应只由出生日期否决`);
      assert.equal(rowOf(r, 'checkBit').ok, true, `${g} 的校验位算术被污染了`);
    }
  }
});

test('B8 生成：确定性、边界、只用现行码、每条自检为有效', () => {
  const a = generateIdCards({ count: 5, today: TODAY, rng: seededRandom(20260925), provinceCode: '11' });
  const b = generateIdCards({ count: 5, today: TODAY, rng: seededRandom(20260925), provinceCode: '11' });
  assert.deepEqual(a.map((x) => x.id18), b.map((x) => x.id18), '同种子必须同输出');
  assert.equal(a.length, 5);
  for (const g of a) {
    assert.match(g.areaCode, /^11/);
    assert.equal(resolveRegion(g.areaCode).status, 'current', `${g.areaCode} 不是现行县级码（历史码禁止用于生成）`);
    assert.equal(parseIdCard(g.id18, { today: TODAY }).state, 'valid', `${g.id18} 自检不过`);
    assert.ok(g.id18.endsWith(g.checkBit));
    assert.ok(/[1-9]\d{2}/.test(g.seq), `顺序码 ${g.seq} 不该是 000`);
  }
  assert.equal(generateIdCards({ count: 1, today: TODAY, rng: seededRandom(1), sex: 'male' })[0].sex, '男');
  assert.equal(generateIdCards({ count: 20, today: TODAY, rng: seededRandom(7), sex: 'female' })
    .every((x) => x.sex === '女'), true, '指定性别却出了男，奇偶调整有洞');
  assert.equal(generateIdCards({ count: 3, today: TODAY, rng: seededRandom(8), birthDate: '2005-04-01' })
    .every((x) => x.birth === '2005-04-01'), true);
  // 边界一律抛，不静默截断（§7 输入硬上限口径）
  for (const bad of [0, -1, 51, 1.5, '5', null]) {
    assert.throws(() => generateIdCards({ count: bad, today: TODAY }), RangeError, `count=${String(bad)} 应抛`);
  }
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, birthDate: '2099-01-01' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, birthDate: '1899-01-01' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, areaCode: '990101' }), RangeError);
  assert.throws(() => generateIdCards({ count: 1, today: TODAY, minAge: 60, maxAge: 18 }), RangeError);
  assert.equal(GENERATE_MAX, 50, '上限 50：不提供"批量导出 1 万条"（§11 风险表）');
  assert.match(USE_NOTE, /不得用于任何真实身份用途/);
  assert.match(USE_NOTE, /仅供开发与测试用途/);
});

test('B9 批量粘贴：逐行独立、行号与粘贴对齐、空行也占一条', () => {
  const rows = parseIdCardList(
    '110101199003073503\n\n440524188001010014\n110101199003073504',
    { today: TODAY },
  );
  assert.equal(rows.length, 4, '空行也要占一条，用户看的是同一个行号');
  assert.deepEqual(rows.map((r) => r.no), [1, 2, 3, 4]);
  assert.equal(rows[0].result.state, 'valid');
  assert.equal(rows[1].result.state, 'empty');
  // 第 3 行是 §2.2 那条 1880 年出生的样本：单条与批量必须同结论（出生日期早于下界）
  assert.equal(rows[2].result.state, 'malformed');
  assert.deepEqual(failedKeys(rows[2].result), ['birth']);
  assert.equal(rows[3].result.state, 'checkdigit');
  assert.equal(parseIdCardList(null, { today: TODAY }).length, 0);
  assert.equal(parseIdCardList('110101199003073503\r\n110101199003073504', { today: TODAY }).length, 2);
});
```

- [ ] **Step 4: 跑测试，确认它红**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `exit` 非 0，报 `Cannot find module '…/dev/js/tools/idcard.js'`（整个测试文件加载失败，§A 那 6 条一起不跑）。这是预期的红：模块不存在，不是判据写松了。若 §A 仍绿而 §B 一条没跑，说明 import 写得比 §A 早、把文件切断了——挪到 §A 之后。

- [ ] **Step 5: 提交红灯**

```bash
git add scripts/build-id-fixture.mjs scripts/fixtures/id-validator-checkbit-1000.json scripts/toolkit-tests.mjs
git commit -m "test(tools): 身份证判据与旧库对拍夹具先行，模块待实现"
```

- [ ] **Step 6: 写 `dev/js/tools/random.js` 与 `dev/js/tools/idcard.js`**

先写随机源。它独立成文件的原因见 §1 依赖图：身份证与统一代码是同级模块，谁 import 谁都不对，复制两份则将来必漏。

```js
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
```

再写身份证模块：

```js
/**
 * 居民身份证号码（GB 11643-1999）：校验位、解码、三态判定、测试号生成。
 *
 * 只依赖 region.js 的返回结构、不碰 DOM：页面装配层（段 2 的 dev/js/toolIdcard.js）
 * 与 Node 判据共用同一份判定，杜绝"页面上说有效、测试里说无效"这种分裂。
 * 口径出处：设计文档 §2.2 / §5.1 / §5.4 / §5.5。
 */
import { REGION_META, resolveRegion, currentCountyCodes } from './region.js';
import { seededRandom } from './random.js';

/** 前 17 位加权因子，等价于 2^(18-i) mod 11（站内旧库就是这么算的） */
export const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
/** 下标 = Σ mod 11。旧库写作 12 − (Σ mod 11)，两种写法在 20 万条随机 body 上 0 分歧（§2.2） */
export const CHECK_MAP = '10X98765432';
/** 本站自设的出生日期下界：旧库整段注释掉了年份判断（见夹具 oracle.knownWeaknesses） */
export const BIRTH_FLOOR = '1900-01-01';
/** §11 风险表：不提供"批量导出 1 万条" */
export const GENERATE_MAX = 50;
/** §5.5 合规文案。页面与判据共用这一份，别在页面里另抄一版 */
export const USE_NOTE = '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad2 = (n) => String(n).padStart(2, '0');

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month < 1 || month > 12) return 0;
  return month === 2 && isLeapYear(year) ? 29 : DAYS[month - 1];
}

/** { y, m, d, iso, utc }：年份一律四位，utc 只做整日比较 */
function makeDay(y, m, d) {
  return { y, m, d, iso: `${y}-${pad2(m)}-${pad2(d)}`, utc: Date.UTC(y, m - 1, d) };
}

/** 接受 'YYYY-MM-DD' / Date / 缺省=今天。Date 走本地分量，与 makeDay 的 utc 同基准 */
function toDay(input) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return makeDay(y, m, d);
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return makeDay(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  const n = new Date();
  return makeDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function ageInYears(birth, today) {
  let age = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1;
  return age < 0 ? null : age;
}

function weightSum(body17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(body17[i]) * WEIGHTS[i];
  return sum;
}

/** 17 位本体 -> 校验位字符；本体不合规时返回 null（不抛，调用方判 ok 三态） */
export function computeCheckDigit(body17) {
  const s = body17 === null || body17 === undefined ? '' : String(body17);
  if (!/^\d{17}$/.test(s)) return null;
  return CHECK_MAP[weightSum(s) % 11];
}

/** 真实日历校验（含闰年）。年份：18 位取四位，15 位按 19yy 解释（§2.2） */
function decodeBirth(birthRaw, lengthType) {
  if (!/^\d+$/.test(birthRaw)) return { ok: false, reason: '出生日期含非数字字符' };
  const y = lengthType === 18 ? Number(birthRaw.slice(0, 4)) : 1900 + Number(birthRaw.slice(0, 2));
  const m = lengthType === 18 ? Number(birthRaw.slice(4, 6)) : Number(birthRaw.slice(2, 4));
  const d = lengthType === 18 ? Number(birthRaw.slice(6, 8)) : Number(birthRaw.slice(4, 6));
  if (m < 1 || m > 12) return { ok: false, reason: `月份 ${m} 不存在` };
  const last = daysInMonth(y, m);
  if (d < 1 || d > last) return { ok: false, reason: `${y} 年 ${m} 月没有 ${d} 日（该月最多 ${last} 天）` };
  return { ok: true, day: makeDay(y, m, d) };
}

/**
 * 校验 / 解码一个号码。三态：`valid` / `checkdigit` / `malformed`，另有 `empty` 表示没输入。
 *
 * 逐项表按固定顺序给出六行：字符集 → 长度 → 行政区划 → 出生日期 → 顺序码 → 校验位。
 * 每行 `ok` 是三态：true / false / null（null = 这一项不下结论，例如区划未收录、
 * 15 位无校验位）。**只有 false 才拖垮整体结论**——这是 §5.4"查不到不等于无效"的落地方式。
 *
 * @param {string|number} raw 用户输入
 * @param {{today?: string|Date}} [opts] 注入"今天"，让年龄与上限判据可复现
 */
export function parseIdCard(raw, opts = {}) {
  const today = toDay(opts.today);
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim().toUpperCase();
  const compact = value.replace(/\s+/g, '');

  const out = {
    input: text, value, state: 'empty', lengthType: null, checks: [], info: null,
    id18: '', id15: '', id15Note: '', expectedCheckBit: '', suggestedId18: '',
    caveat: '', hasCaveat: false, repairedHint: '',
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  // 1) 字符集：只允许数字，X 仅可作为 18 位串的末位；内部空白不吞（旧库对 15 位末位字母放行，我们不）
  const hasInnerSpace = /\s/.test(value);
  const shapeOk = /^\d{18}$/.test(compact) || /^\d{15}$/.test(compact) || /^\d{17}X$/.test(compact);
  const charsetOk = !hasInnerSpace && shapeOk;
  push('charset', '字符集', charsetOk, charsetOk
    ? `仅数字${compact.endsWith('X') ? '，末位 X' : ''}`
    : (hasInnerSpace ? '号码中间含空格' : '只允许数字，X 只能出现在 18 位号码的末位'));
  if (hasInnerSpace && (compact.length === 15 || compact.length === 18)) out.repairedHint = compact;

  // 2) 长度
  out.lengthType = compact.length === 18 ? 18 : compact.length === 15 ? 15 : null;
  push('length', '长度', out.lengthType !== null,
    `${compact.length} 位${out.lengthType ? '' : '（应为 15 或 18 位）'}`);
  if (!charsetOk || out.lengthType === null) {
    out.state = 'malformed';
    return out;
  }

  const areaCode = compact.slice(0, 6);
  const birthRaw = compact.slice(6, out.lengthType === 18 ? 14 : 12);
  const seq = compact.slice(-3);
  const seqNum = Number(seq);

  // 3) 行政区划：未收录只给 null + note，绝不下"无效"（§5.4）
  const region = resolveRegion(areaCode);
  const regionOk = region.status === 'current' || region.status === 'abolished'
    ? true : region.status === 'uncoded' ? null : false;
  push('region', '行政区划', regionOk, regionOk === null ? region.note
    : (regionOk ? `${region.fullName}${region.status === 'abolished' ? '（历史码）' : ''}` : region.note || `${areaCode} 无法解析`));

  // 4) 出生日期：真实日历 + 上下界
  const b = decodeBirth(birthRaw, out.lengthType);
  let birthOk = true;
  let birthWhy = '';
  if (!b.ok) { birthOk = false; birthWhy = b.reason; } else if (b.day.iso < BIRTH_FLOOR) {
    birthOk = false; birthWhy = `早于 ${BIRTH_FLOOR}（本站自设下界）`;
  } else if (b.day.utc > today.utc) {
    birthOk = false; birthWhy = `晚于今天（${today.iso}）`;
  }
  push('birth', '出生日期', birthOk, birthOk ? b.day.iso : birthWhy);

  // 5) 顺序码：000 记一条但不否决
  const orderOk = seqNum === 0 ? null : true;
  push('order', '顺序码', orderOk, orderOk === null
    ? `${seq} 未分配（第 7–9 段实际取 001–999）`
    : `${seq} · 性别${seqNum % 2 === 1 ? '男' : '女'}`);

  // 6) 校验位：15 位无校验位；18 位把算式一并给出（§5.1 要求"看得见为什么不行"）
  //    18 位用用户填的本体，15 位按「区划 + 19 + yyMMdd + 顺序码」拼本体——不能错位取 8 位生日段
  const body17 = out.lengthType === 18 ? compact.slice(0, 17) : `${areaCode}19${birthRaw}${seq}`;
  const expected = computeCheckDigit(body17);
  const given = out.lengthType === 18 ? compact.slice(17) : '';
  let checkOk = null;
  if (out.lengthType === 15) {
    push('checkBit', '校验位', null, '15 位为第一代号码，无校验位');
  } else {
    checkOk = expected === given;
    const mod = weightSum(body17) % 11;
    push('checkBit', '校验位', checkOk, checkOk
      ? `Σ加权 mod 11 = ${mod} → ${expected}，与末位一致`
      : `算得 ${expected}，号码末位是 ${given}`);
  }

  const structuralFailed = checks.some((k) => k.key !== 'checkBit' && k.ok === false);
  out.state = structuralFailed ? 'malformed' : (checkOk === false ? 'checkdigit' : 'valid');

  const sum = out.lengthType === 18 ? weightSum(body17) : 0;
  out.info = {
    lengthType: out.lengthType, areaCode, region,
    birth: b.ok ? b.day.iso : null, birthRaw,
    ageYears: b.ok && birthOk ? ageInYears(b.day, today) : null,
    sex: seqNum % 2 === 1 ? '男' : '女', seq, body17,
    checkBit: given, expectedCheckBit: expected,
    checkWork: out.lengthType === 18 ? { sum, mod: sum % 11, table: CHECK_MAP } : null,
    datasetVersion: REGION_META.datasetVersion,
  };
  out.expectedCheckBit = expected || '';

  // 规范形态：18 位输入原样保留（错末位正是判据要显示的东西），另外给建议形态
  if (out.lengthType === 18) {
    out.id18 = compact;
    if (checkOk === false && expected) out.suggestedId18 = body17 + expected;
    if (b.ok && b.day.y >= 1900 && b.day.y <= 1999) {
      out.id15 = `${areaCode}${String(b.day.y).slice(2)}${pad2(b.day.m)}${pad2(b.day.d)}${seq}`;
      out.id15Note = '由 18 位去世纪位得来的等价写法（15 位无法表达 20xx 出生，仅作等价展示，不代表曾以 15 位签发）';
    }
  } else {
    out.id18 = expected ? body17 + expected : body17;
    out.id15 = compact;
    out.id15Note = '15 位为第一代号码本体，无校验位';
  }

  const caveats = [];
  if (region.status === 'abolished' || region.status === 'uncoded') caveats.push(region.note);
  if (seqNum === 0) caveats.push('顺序码 000 未分配');
  out.caveat = caveats.filter(Boolean).join('；');
  out.hasCaveat = out.caveat !== '';
  return out;
}

/**
 * 多行批量：每行一条结论，空行也占一条（用户看到的是粘贴时的行号）。
 * @returns {Array<{no:number, raw:string, result:object}>}
 */
export function parseIdCardList(text, opts = {}) {
  return String(text === null || text === undefined ? '' : text)
    .split(/\r?\n/)
    .map((raw, i) => ({ no: i + 1, raw, result: parseIdCard(raw, opts) }));
}

/** 顺序码 1..999，永不 000；需要指定性别时就近调奇偶，边界处向内收 */
function pickSeq(rng, want) {
  const n = 1 + Math.floor(rng() * 999);
  const parity = want === 'female' ? 0 : want === 'male' ? 1 : null;
  const adj = parity === null ? n : (n % 2 === parity ? n : (n < 999 ? n + 1 : n - 1));
  return String(adj).padStart(3, '0');
}

function randomBirthDay(rng, minAge, maxAge, today) {
  const age = minAge + Math.floor(rng() * (maxAge - minAge + 1));
  const year = today.y - age;
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * daysInMonth(year, month));
  const cand = makeDay(year, month, day);
  if (cand.utc > today.utc) {                       // 生日未到 → 整体退一年，绝不出未来日期
    const y2 = year - 1;
    return makeDay(y2, month, Math.min(day, daysInMonth(y2, month)));
  }
  return cand.iso < BIRTH_FLOOR ? toDay(BIRTH_FLOOR) : cand;
}

/**
 * 生成校验位成立的测试号。**地址只能出自现行区划表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseIdCard 自检，判不得 valid 就抛——生成器与校验器互为对手。
 *
 * @param {{areaCode?:string, cityCode?:string, provinceCode?:string, birthDate?:string,
 *   minAge?:number, maxAge?:number, sex?:'male'|'female'|null, count?:number,
 *   today?:string|Date, rng?:() => number}} [options]
 */
export function generateIdCards(options = {}) {
  const today = toDay(options.today);
  const rng = typeof options.rng === 'function' ? options.rng : seededRandom(Date.now());
  const count = options.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${String(count)}`);
  }
  const sex = options.sex ?? null;
  if (sex !== null && sex !== 'male' && sex !== 'female') {
    throw new RangeError('性别只接受 male / female / null');
  }
  const minAge = options.minAge ?? 18;
  const maxAge = options.maxAge ?? 60;
  let fixedBirth = null;
  if (options.birthDate !== undefined && options.birthDate !== null) {
    fixedBirth = toDay(options.birthDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(options.birthDate))) throw new RangeError('出生日期应为 YYYY-MM-DD');
    if (fixedBirth.iso < BIRTH_FLOOR) throw new RangeError(`出生日期不得早于 ${BIRTH_FLOOR}`);
    if (fixedBirth.utc > today.utc) throw new RangeError(`出生日期不得晚于今天（${today.iso}）`);
  } else if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 0 || maxAge < minAge || maxAge > 120) {
    throw new RangeError('年龄区间应为 0..120 之间的整数且 min ≤ max');
  }

  const prefix = String(options.areaCode ?? options.cityCode ?? options.provinceCode ?? '');
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`没有可生成的行政区划（前缀「${prefix || '空'}」，区划数据截止 ${REGION_META.datasetVersion}）`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const areaCode = pool[Math.floor(rng() * pool.length)];
    const birth = fixedBirth ?? randomBirthDay(rng, minAge, maxAge, today);
    const seq = pickSeq(rng, sex);
    const body17 = `${areaCode}${birth.y}${pad2(birth.m)}${pad2(birth.d)}${seq}`;
    const checkBit = computeCheckDigit(body17);
    const id18 = body17 + checkBit;
    const self = parseIdCard(id18, { today });
    if (self.state !== 'valid') {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：生成的 ${id18} 自检为 ${self.state}（${why}）`);
    }
    list.push({
      id18, id15: self.id15, areaCode, region: self.info.region.fullName,
      birth: birth.iso, age: self.info.ageYears, sex: self.info.sex, seq, checkBit,
      caveat: self.caveat,
    });
  }
  return list;
}
```

两处措辞是刻意的，评审时别看成了啰嗦：`早于 1900-01-01（本站自设下界）` 里的"本站自设"必须出现——旧库对 1899 年是放行的，不写清会让用户以为国标有此约束；`顺序码 000 未分配` 只 null 不 false，因为 §5.4 的三态里"这一项不下结论"才是对的（现实中不存在，但末位算术照样成立）。

- [ ] **Step 7: 跑测试，确认绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `# pass 15`、`# fail 0`、`exit=0`（§A 的 6 条 + §B 的 9 条）。

- [ ] **Step 8: 幂等复跑夹具生成器**

```bash
node scripts/build-id-fixture.mjs --check; echo "exit=$?"
```

Expected: `… 与生成器一致`、`exit=0`。

- [ ] **Step 9: 提交**

```bash
git add dev/js/tools/random.js dev/js/tools/idcard.js scripts/toolkit-tests.mjs
git commit -m "feat(tools): 身份证三态判定、解码与测试号生成，与旧库 1000 条对拍"
```

---

## Task 5: 统一社会信用代码模块（§C 判据）

**Files:**
- Create: `dev/js/tools/uscc.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §C 八条）

### 5.0 三条本轮已算实 / 已核实的口径

写代码之前先把三件事钉住，免得"自家算完自说自话"。这三条不是估的：

| 口径 | 值 | 怎么核的 |
|---|---|---|
| 31 字符集与"下标即值" | `0123456789ABCDEFGHJKLMNPQRTUWXY`：`'0'`→0 … `'9'`→9，`'A'`→10 … `'Y'`→30；剔除 I O S Z V | 逐字数过一遍（31 个），并用国标示例码回算自洽 |
| 前 17 位加权因子 | `1,3,9,27,19,26,16,17,20,29,25,13,8,24,10,30,28`，等于 `3^(i-1) mod 31` | 自己按幂算式生成；与外部资料《如何正确校验统一社会信用代码》列的"第 1 位:1；第 2 位:3；… 第 17 位:28"逐项相同 |
| `Σ mod 31 == 0` 时末位取什么 | 取 `'0'`，即算式写成 `(31 − Σ mod 31) mod 31` | 外部资料原文："余数0：校验码为0"。这一档约占 1/31 ≈ 3.2%，答错就是 3% 的真码被误判"校验位不符"，所以必须钉死 |

末位算法用国标示例 `91350100M000100Y43` 实算复核：前 17 位加权和 `Σ=1640`，`1640 mod 31 = 28`，`31 − 28 = 3` → 字符 `'3'`，与样本末位一致；把末位也计入后 `Σ + M₁₈ ≡ 0 (mod 31)` 成立——这条不变式就是 C3 的判据。

内层第 9–17 位（组织机构代码本体 8 位 + GB 11714 校验位）权重 `3,7,9,10,5,8,4,2`，等于 `2^(8-i) mod 11`（i 从 1 起，C2 拿这条互验）；校验值 `v = (11 − Σ mod 11) mod 11`。同一示例的内层：本体 `M000100Y` 加权和 `Σ=128`，`128 mod 11 = 7`，`11 − 7 = 4` → 第 17 位 `'4'`，与样本一致。这条顺带证明**内层也按 31 字符集取值**（`M`→21、`Y`→30 参与加权），不是只认数字。

### 5.1 一个没闭环的点，以及本模块的处理办法

`v === 10` 时第 17 位该写哪个字符，本轮没取到权威口径：GB 11714 自己的字符集是 `0-9` + `X`（值 10 记作 `X`），而 USCC 的 31 字符集把值 10 记作 `'A'`。两种写法在真实码里都碰得到，本站核实到"两者都存在"这一步，没核实到"哪一种才是国标口径"。

处理办法是**不在判据里赌**，三条一起上（C7 逐条钉）：

1. 解析侧：`v ≤ 9` 时期望字符就是那个数字，遇到**别的数字**判"不符"；遇到**字母**一律判"无法判定"（`null`）——非企业主体的第 9–17 位本就不是组织机构代码体系，判它"无效"是越界。
2. `v === 10` 时 `'X'` 与 `'A'` 都放行，并在逐项表里写明这是两种口径都认。
3. 生成侧：掷完 8 位本体先算 `v`，落在 10 就把末位挪一格（对固定的前 7 位，使 `v === 10` 的末位在 `0..9` 里只有一个，挪一次必然避开），**永不产出这个分支**——生成的测试码不依赖任何未证实的口径。

同理，第 1、2 位（登记管理部门、机构类别）的取值含义表也没取到可核实来源。设计文档 §5.1 原本写的是"按字符集出选项、名称标参考"，本模块再降一档：**只校验字符合法性、只给字符与值，不输出任何名称**，并把这个降级连同理由回填进设计文档。C8 用 `Object.keys(info.registry)` 把这条钉住，防止后来人凭记忆补一张表进去。

- [ ] **Step 1: 写 §C 判据（追加到 `scripts/toolkit-tests.mjs` 末尾）**

```js
// ── §C 统一社会信用代码 ─────────────────────────────────────────────────────

const { parseUscc, parseUsccList, generateUsccCodes, computeCheckChar,
  computeOrgCheckValue, charValue, USCC_CHARSET, USCC_WEIGHTS, ORG_WEIGHTS,
  FORBIDDEN_CHARS, GENERATE_MAX: USCC_GENERATE_MAX, USE_NOTE: USCC_USE_NOTE,
  REFERENCE_NOTE } = await import('../dev/js/tools/uscc.js');

/**
 * 可公开核实的真实码清单。设计文档 §11 原本要求"≥5 条"，本轮只坐实 1 条
 * （GB 32100-2015 正文示例）；凭记忆写的 4 条候选有 3 条末位不通，故不收录。
 * 这条判据的唯一用途：以后往里加样本时必须连带核实来源与日期，
 * 而不是让"≥5 条真实码"这句话悄悄变成既成事实。
 */
const REAL_SAMPLES = [
  { code: '91350100M000100Y43', source: 'GB 32100-2015 正文示例', verifiedOn: '2026-09-25' },
];

/** 下面 13 条码全部是 2026-09-25 用独立脚本实算出来的（口径见 §5.0），不是手推 */
const NATIONAL = '91350100M000100Y43';    // 内层本体含字母的国标示例
const R_ZERO = '913501000000001660';      // Σ mod 31 == 0 → 末位 '0'，且内层自洽（整码可判 valid）
const R_X = '91350100000000004X';         // 校验值 29 → 'X'
const R_Y = '91350100000000014Y';         // 校验值 30 → 'Y'
const ORG_TEN_X = '9135010000000006XH';   // 内层值 10，第 17 位写作 'X'
const ORG_TEN_A = '9135010000000006AN';   // 内层值 10，第 17 位写作 'A'（末位随之改变）
const ORG_OK = '91350100000000019E';      // 内层值 9，第 17 位 '9'
const ORG_LETTER = '9135010000000001YF';  // 内层值 9，第 17 位 'Y' → 不下结论
const ORG_BAD = '913501000000000152';     // 内层值 9，第 17 位 '5' → 不符
const REGION_UNCODED = '91440524000000019E';
const REGION_PROVINCE = '91110000000000019B';
const REGION_HIST = '91110103000000019U';
const REGION_NONE = '91990101000000019M';
const failedC = (r) => r.checks.filter((k) => k.ok === false).map((k) => k.key);
const uncertainC = (r) => r.checks.filter((k) => k.ok === null).map((k) => k.key);
const rowC = (r, key) => r.checks.find((k) => k.key === key);

test('C1 31 字符集：长度、剔除的五个字母、值即下标、非法输入返回 null 不抛', () => {
  assert.equal(USCC_CHARSET.length, 31);
  assert.equal(new Set(USCC_CHARSET).size, 31, '字符集里有重复字符');
  assert.deepEqual(FORBIDDEN_CHARS, ['I', 'O', 'S', 'Z', 'V']);
  for (const ch of FORBIDDEN_CHARS) {
    assert.equal(USCC_CHARSET.includes(ch), false, `${ch} 不得出现在字符集里`);
  }
  assert.equal(charValue('0'), 0);
  assert.equal(charValue('9'), 9);
  assert.equal(charValue('A'), 10);
  assert.equal(charValue('Y'), 30);
  assert.equal(charValue('I'), null, '被剔除的字母必须是 null');
  assert.equal(charValue('i'), null, '小写不属于代码字符集，不做隐式大写');
  assert.equal(charValue(''), null);
  assert.equal(charValue('01'), null);
  assert.equal(charValue(null), null);
  assert.equal(charValue(9), null, '数字入参也走 null：调用方负责先转字符串');
});

test('C2 两套权重：与幂算式互验，不靠手抄', () => {
  assert.deepEqual(USCC_WEIGHTS, [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]);
  assert.equal(USCC_WEIGHTS.length, 17);
  for (let i = 0; i < 17; i += 1) {
    assert.equal(USCC_WEIGHTS[i], 3 ** i % 31, `第 ${i + 1} 位权重应为 3^${i} mod 31`);
  }
  assert.deepEqual(ORG_WEIGHTS, [3, 7, 9, 10, 5, 8, 4, 2]);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(ORG_WEIGHTS[i], 2 ** (8 - i) % 11, `内层第 ${i + 1} 位权重应为 2^(8-${i}) mod 11`);
  }
});

test('C3 国标示例：双校验位自洽，且不变式 Σ(1..18) ≡ 0 (mod 31)', () => {
  const r = parseUscc(NATIONAL);
  assert.equal(r.state, 'valid');
  assert.deepEqual(failedC(r), []);
  assert.deepEqual(uncertainC(r), []);
  assert.equal(r.caveat, '');
  assert.deepEqual(r.checks.map((k) => k.key),
    ['charset', 'length', 'region', 'orgCheck', 'checkBit']);
  assert.equal(r.info.region.fullName, '福建省福州市', '350100 按现行市级解（A5 已钉这一档）');
  assert.equal(r.info.body8, 'M000100Y');
  assert.deepEqual(r.info.orgChecksum, { sum: 128, remainder: 7, value: 4 });
  assert.deepEqual(r.info.checksum, { sum: 1640, remainder: 28, value: 3 });
  assert.equal(r.info.expectedCheckBit, '3');
  assert.equal(r.info.checkBit, '3');
  // 不变式：把末位一起加权必须整除 31。这条独立于上面所有中间量
  const total = r.code.split('')
    .reduce((t, ch, i) => t + charValue(ch) * (i < 17 ? USCC_WEIGHTS[i] : 1), 0);
  assert.equal(total % 31, 0);
});

test('C4 末位计算：余数为 0 取 0、值 29/30 取字母、结构非法返回 null 不抛', () => {
  assert.equal(computeCheckChar(R_ZERO.slice(0, 17)), '0', 'Σ mod 31 == 0 → 末位是字符 0');
  assert.equal(computeCheckChar(R_X.slice(0, 17)), 'X');
  assert.equal(computeCheckChar(R_Y.slice(0, 17)), 'Y');
  assert.equal(computeCheckChar(NATIONAL.slice(0, 17)), '3');
  // 第 17 位按 31 字符集取值参与外层加权：同一条内层本体，写 X 与写 A 会得到不同末位
  assert.equal(computeCheckChar(ORG_TEN_X.slice(0, 17)), 'H');
  assert.equal(computeCheckChar(ORG_TEN_A.slice(0, 17)), 'N');
  assert.equal(computeCheckChar(R_ZERO.slice(0, 16)), null, '16 位要 null 而不是抛');
  assert.equal(computeCheckChar('9135010I000000024'), null, '含被剔除字母要 null');
  assert.equal(computeCheckChar(null), null);
  assert.equal(computeCheckChar(''), null);
  assert.deepEqual(computeOrgCheckValue('00000006'), { sum: 12, remainder: 1, value: 10 });
  assert.deepEqual(computeOrgCheckValue('M000100Y'), { sum: 128, remainder: 7, value: 4 });
  assert.equal(computeOrgCheckValue('0000006'), null, '7 位本体要 null');
  assert.equal(computeOrgCheckValue('0000000i'), null);
});

test('C5 三态、大小写归一、批量：只有 false 拖垮结论，null 只进 caveat', () => {
  assert.deepEqual({ s: parseUscc('').state, c: parseUscc('').checks.length }, { s: 'empty', c: 0 });
  assert.deepEqual({ s: parseUscc(null).state, c: parseUscc(null).checks.length }, { s: 'empty', c: 0 });

  const lower = parseUscc('91350100m000100y43');
  assert.equal(lower.state, 'valid');
  assert.equal(lower.code, NATIONAL, '按字符集转大写后判定');
  assert.equal(lower.normalized, true);
  assert.match(lower.caveat, /转大写/);
  assert.equal(parseUscc(` ${NATIONAL} `).normalized, false, '只有首尾空白不算归一');

  const short = parseUscc(NATIONAL.slice(0, 17));
  assert.equal(short.state, 'malformed');
  assert.deepEqual(failedC(short), ['length']);
  const badChar = parseUscc('9135010O000000019E');
  assert.equal(badChar.state, 'malformed');
  assert.deepEqual(failedC(badChar), ['charset'], 'O 是被剔除字母，判字符集不符而不是给个"未知"');
  assert.match(rowC(badChar, 'charset').detail, /含非法字符 O/);

  const spaced = parseUscc('9135 0100M000100Y 43');
  assert.equal(spaced.state, 'malformed');
  assert.deepEqual(failedC(spaced), ['charset']);
  assert.equal(spaced.repairedHint, NATIONAL, '去掉内部空格后就是合法码，提示要有');

  const wrong = parseUscc('91350100M000100Y44');
  assert.equal(wrong.state, 'checkdigit');
  assert.deepEqual(failedC(wrong), ['checkBit']);
  assert.equal(rowC(wrong, 'checkBit').detail, '期望 3，实际 4');

  const list = parseUsccList(`${NATIONAL}\n\n${R_ZERO}\r\nabc`);
  assert.deepEqual(list.map((x) => x.no), [1, 2, 3, 4], '空行必须占一行号，不能悄悄压缩');
  assert.deepEqual(list.map((x) => x.result.state), ['valid', 'empty', 'valid', 'malformed']);
  assert.deepEqual(list.map((x) => x.raw), [NATIONAL, '', R_ZERO, 'abc']);
});

test('C6 区划段复用 §A：未收录与历史码都不下"无效"，绝不产出「未知」', () => {
  const uncoded = parseUscc(REGION_UNCODED);
  assert.equal(uncoded.state, 'valid', '区划未收录不否决整码');
  assert.deepEqual(uncertainC(uncoded), ['region']);
  assert.equal(uncoded.info.region.fullName, '广东省汕头市');
  assert.match(uncoded.caveat, /未收录/);

  const province = parseUscc(REGION_PROVINCE);
  assert.equal(province.state, 'valid');
  assert.equal(province.info.region.level, 'province');
  assert.equal(province.info.region.fullName, '北京市');
  assert.deepEqual(uncertainC(province), [], '省级码 + 0000 是现行码，不该留"不下结论"');
  assert.equal(province.caveat, '');

  const hist = parseUscc(REGION_HIST);
  assert.equal(hist.state, 'valid');
  assert.equal(hist.info.region.status, 'abolished');
  assert.match(rowC(hist, 'region').detail, /历史码/);
  assert.match(hist.caveat, /未见于现行区划表/,
    '措辞要诚实，不能断言"已撤销建制"——§A 实测有 63 条同码改名');

  const none = parseUscc(REGION_NONE);
  assert.equal(none.state, 'malformed');
  assert.deepEqual(failedC(none), ['region']);
  assert.equal(/未知/.test(JSON.stringify([uncoded, province, hist, none].map((r) => r.checks))), false,
    '任何结论里都不许出现「未知地区」这类文案（站内旧库的反面教材）');
});

test('C7 内层第 17 位：数字不符才判错、字母不下结论、值 10 两种写法都放行', () => {
  assert.equal(rowC(parseUscc(ORG_OK), 'orgCheck').ok, true);
  const letter = parseUscc(ORG_LETTER);
  assert.equal(rowC(letter, 'orgCheck').ok, null);
  assert.equal(letter.state, 'valid', '字母落在"不下结论"档，不拖垮整体');
  assert.match(letter.caveat, /第 17 位/);
  const bad = parseUscc(ORG_BAD);
  assert.equal(rowC(bad, 'orgCheck').ok, false);
  assert.equal(bad.state, 'checkdigit');
  assert.deepEqual(failedC(bad), ['orgCheck'], '内层不符的判定不能被末位抢走');
  for (const code of [ORG_TEN_X, ORG_TEN_A]) {
    const r = parseUscc(code);
    assert.equal(rowC(r, 'orgCheck').ok, true, `${code} 的内层值 10 应当放行`);
    assert.equal(r.state, 'valid');
    assert.equal(r.info.orgChecksum.value, 10);
    assert.match(rowC(r, 'orgCheck').detail, /X 或 A/, '措辞要说明这是两种口径都认');
  }
});

test('C8 生成侧自洽 + 未验证缺口显式登记', () => {
  const a = generateUsccCodes({ count: 5, rng: seededRandom(20260925) });
  const b = generateUsccCodes({ count: 5, rng: seededRandom(20260925) });
  assert.deepEqual(a.map((x) => x.code), b.map((x) => x.code), '同种子必须同输出');
  for (const g of a) {
    assert.equal(g.code.length, 18);
    const self = parseUscc(g.code);
    assert.equal(self.state, 'valid');
    assert.deepEqual(self.checks.map((k) => k.ok), [true, true, true, true, true],
      '每条生成后逐项都必须是 true——生成器是校验器的对手');
    assert.equal(self.caveat, '');
    assert.equal(resolveRegion(g.regionCode).status, 'current', '区划段只能出自现行表（§5.4）');
    assert.equal(/^[0-9]$/.test(g.code[16]), true, '第 17 位不得落在未核实的"值 10 写法"分支');
    assert.equal(g.code[17], computeCheckChar(g.code.slice(0, 17)));
  }
  // 342 个现行市级码 + '00' 全都能当区划段（§A 已钉这一档按现行市级解）
  for (const c of currentCityCodes()) {
    assert.equal(resolveRegion(`${c}00`).status, 'current', `${c}00 应可用于生成`);
  }
  assert.ok(generateUsccCodes({ count: 3, provinceCode: '35', rng: seededRandom(7) })
    .every((g) => g.regionCode.startsWith('35')));
  assert.ok(generateUsccCodes({ count: 2, regionCode: '110100', rng: seededRandom(9) })
    .every((g) => g.regionCode === '110100'));
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: '110103' }), /历史码只许解、不许生成/);
  assert.throws(() => generateUsccCodes({ count: 1, regionCode: 'abc' }), /不是现行码/);
  assert.throws(() => generateUsccCodes({ count: USCC_GENERATE_MAX + 1 }), /1\.\./);
  assert.throws(() => generateUsccCodes({ count: 1, registry: 'Z' }), /31 字符集/);

  // 合规与口径文案由模块出，页面直接取用，别在页面里另抄一版
  assert.equal(USCC_GENERATE_MAX, 50);
  assert.match(USCC_USE_NOTE, /不得用于任何真实主体/);
  assert.match(REFERENCE_NOTE, /第 1、2 位/);
  const one = parseUscc(NATIONAL);
  assert.deepEqual(Object.keys(one.info.registry).sort(), ['char', 'value'],
    '第 1、2 位只给字符与值、不给名称：含义表没取到可核实来源（§5.1）');
  assert.equal(one.info.registry.char, '9');
  assert.equal(one.info.registry.value, 9);
  assert.equal(REAL_SAMPLES.length, 1, '本轮只坐实 1 条真实码，加样本时同步改设计文档 §11');
  for (const s of REAL_SAMPLES) {
    assert.equal(s.verifiedOn, '2026-09-25');
    assert.equal(parseUscc(s.code).state, 'valid');
  }
});
```

三处判据的取舍，评审时别当成啰嗦：

- `C4` 里"同一内层本体、第 17 位写 `X` 与写 `A` 会得到不同末位"（`H` vs `N`）不是多余用例——它是"第 17 位在外部加权和里按 31 字符集取值（`X`→29、`A`→10）"这条口径的唯一证据。一旦有人把内层字符按 GB 11714 的 `0-9X` 单独映射，这条先红。
- `C5` 里 `short` 与批量那行的 `abc` 都只断 `failedC = ['length']`，不断 `charset`：`A` `B` `C` 本身就在 31 字符集内，否决它们的只有长度。读者容易以为字母串必然字符集不符，所以这两条单独写出来。
- `C8` 结尾那三条（`USCC_GENERATE_MAX`、`USCC_USE_NOTE`、`registry` 的键集）是把"文案与口径由模块出"钉成契约：段 2 写页面时不许在页面里再写一份"仅供参考"，也不许凭记忆补一张第 1、2 位名称表。

- [ ] **Step 2: 跑测试，确认它红**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `exit` 非 0，报 `Cannot find module '…/dev/js/tools/uscc.js'`——`await import()` 在文件加载期就抛，§A 的 6 条与 §B 的 9 条一起不跑。这是预期的红：模块不存在，不是判据写松了。

- [ ] **Step 3: 提交红灯**

```bash
git add scripts/toolkit-tests.mjs
git commit -m "test(tools): 统一社会信用代码判据先行，模块待实现"
```

- [ ] **Step 4: 写 `dev/js/tools/uscc.js`**

```js
/**
 * 统一社会信用代码（GB 32100-2015）：31 字符集、双校验位、三态判定、测试码生成。
 *
 * 结构：1 位登记管理部门 + 1 位机构类别 + 6 位行政区划 + 9 位主体标识
 * （8 位本体 + 1 位组织机构代码校验位）+ 1 位本代码校验位。前 17 位按字符集下标取值、
 * 以 3^(i-1) mod 31 加权，末位 = 字符集[(31 − Σ mod 31) mod 31]。
 *
 * 第 1、2 位的取值含义表没取到可核实来源，所以这里只校验字符合法性、只给字符与值、
 * 不输出任何名称（见 REFERENCE_NOTE）。内层校验值 10 的两种写法未核实口径，
 * 解析侧两种都放行、生成侧直接回避——三档处理见设计文档 §5.1 与本段计划 §5.1。
 */
import { resolveRegion, currentCityCodes } from './region.js';
import { seededRandom } from './random.js';

/** 字符集，下标即该字符参与加权时的值；剔除了 I O S Z V，共 31 个 */
export const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
/** 被剔除的五个字母。单独导出是为了让判据能反向核对字符集长度 */
export const FORBIDDEN_CHARS = ['I', 'O', 'S', 'Z', 'V'];
/** 前 17 位加权因子 = 3^(i-1) mod 31 */
export const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
/** 内层组织机构代码校验位权重（GB 11714）= 2^(8-i) mod 11 */
export const ORG_WEIGHTS = [3, 7, 9, 10, 5, 8, 4, 2];
/** §11 风险表：不提供"批量导出上千条" */
export const GENERATE_MAX = 50;
/** §5.5 合规文案。页面直接取用这一份，别在页面里另抄一版 */
export const USE_NOTE = '随机合成的统一社会信用代码，只在算术上自洽；与真实登记主体重合的概率可忽略，不得用于任何真实主体的查询、申报或对账。';
/** 第 1、2 位为何不显示名称：这是页面必须挂出来的口径说明，不是脚注 */
export const REFERENCE_NOTE = '第 1、2 位（登记管理部门、机构类别）的取值含义表未取到可核实来源，本页只校验这两个字符在 31 字符集内，不给出名称。';

/** 单字符 → 加权值（即下标）。不在字符集内（含小写、空、多字符、非字符串）返回 null */
export function charValue(ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return null;
  const i = USCC_CHARSET.indexOf(ch);
  return i === -1 ? null : i;
}

const allInSet = (s) => [...s].every((c) => charValue(c) !== null);

/** 内层校验值。调用方已保证 body8 为 8 位合法字符 */
function orgChecksum8(body8) {
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += USCC_CHARSET.indexOf(body8[i]) * ORG_WEIGHTS[i];
  const remainder = sum % 11;
  return { sum, remainder, value: (11 - remainder) % 11 };
}

/**
 * 由第 9–16 位算内层组织机构代码校验值。
 * @param {string} body8 8 位主体标识本体
 * @returns {{sum:number, remainder:number, value:number}|null} 结构非法返回 null 不抛
 */
export function computeOrgCheckValue(body8) {
  const s = typeof body8 === 'string' ? body8 : '';
  return s.length === 8 && allInSet(s) ? orgChecksum8(s) : null;
}

/** 末位。调用方已保证 body17 为 17 位合法字符 */
function checksum17(body17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += USCC_CHARSET.indexOf(body17[i]) * USCC_WEIGHTS[i];
  const remainder = sum % 31;
  // 余数为 0 时国标口径取字符 '0'。写成 31 − r 会得到 31 而越出字符集；这一档约占 1/31
  const value = (31 - remainder) % 31;
  return { sum, remainder, value, char: USCC_CHARSET[value] };
}

/**
 * 由前 17 位算第 18 位字符。
 * @param {string} body17
 * @returns {string|null} 结构非法返回 null 不抛
 */
export function computeCheckChar(body17) {
  const s = typeof body17 === 'string' ? body17 : '';
  return s.length === 17 && allInSet(s) ? checksum17(s).char : null;
}

/**
 * 解一个 18 位统一社会信用代码。
 *
 * 逐项表按固定顺序五行：字符集 → 长度 → 行政区划 → 主体标识校验位 → 本代码校验位。
 * 每行 `ok` 是三态：true / false / null（null = 这一项不下结论，例如区划未收录、
 * 第 17 位是字母）。**只有 false 才拖垮整体结论**，与身份证模块同口径（设计文档 §5.4）。
 *
 * @param {string|number|null} raw 用户输入
 * @returns {{input:string, value:string, code:string, normalized:boolean,
 *   state:'empty'|'malformed'|'checkdigit'|'valid', checks:Array, info:object|null,
 *   caveat:string, hasCaveat:boolean, repairedHint:string}}
 */
export function parseUscc(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const trimmed = text.trim();
  const value = trimmed.toUpperCase();
  const compact = value.replace(/\s+/g, '');
  const out = {
    input: text, value, code: '', normalized: value !== trimmed,
    state: 'empty', checks: [], info: null,
    caveat: '', hasCaveat: false, repairedHint: '',
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  // 1) 字符集：31 字符集之外的一切（被剔除的 I O S Z V、小写、别的字母符号）都不符
  const hasInnerSpace = /\s/.test(value);
  const badChars = [...new Set([...compact].filter((c) => charValue(c) === null))];
  const charsetOk = !hasInnerSpace && badChars.length === 0;
  push('charset', '字符集', charsetOk, charsetOk
    ? '全部在 31 字符集内（不含 I O S Z V）'
    : (hasInnerSpace ? '代码中间含空格' : `含非法字符 ${badChars.join(' ')}`));
  if (hasInnerSpace && compact.length === 18) out.repairedHint = compact;

  // 2) 长度
  const lengthOk = compact.length === 18;
  push('length', '长度', lengthOk, `${compact.length} 位${lengthOk ? '' : '（应为 18 位）'}`);
  if (!charsetOk || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  out.code = compact;
  const regionCode = compact.slice(2, 8);
  const body8 = compact.slice(8, 16);
  const orgChar = compact[16];
  const checkChar = compact[17];

  // 3) 区划段：整段复用 §A 的四级回落。未收录只给 null，绝不下"无效"（§5.4）
  const region = resolveRegion(regionCode);
  const regionOk = region.status === 'current' || region.status === 'abolished'
    ? true : region.status === 'uncoded' ? null : false;
  push('region', '行政区划', regionOk, regionOk === null ? region.note
    : (regionOk ? `${region.fullName}${region.status === 'abolished' ? '（历史码）' : ''}`
      : (region.note || `${regionCode} 无法解析`)));

  // 4) 内层校验位：值 10 的两种写法都放行，字母不下结论（口径见文件头）
  const org = orgChecksum8(body8);
  let orgOk;
  if (org.value === 10 && (orgChar === 'X' || orgChar === 'A')) orgOk = true;
  else if (orgChar >= '0' && orgChar <= '9') orgOk = Number(orgChar) === org.value;
  else orgOk = null;
  push('orgCheck', '主体标识校验位', orgOk,
    `期望 ${org.value === 10 ? '10（写作 X 或 A）' : org.value}，实际 ${orgChar}`);

  // 5) 本代码校验位
  const outer = checksum17(compact.slice(0, 17));
  const checkOk = outer.char === checkChar;
  push('checkBit', '校验位', checkOk, checkOk
    ? `末位 ${checkChar}` : `期望 ${outer.char}，实际 ${checkChar}`);

  out.state = regionOk === false ? 'malformed'
    : (!checkOk || orgOk === false) ? 'checkdigit' : 'valid';

  const caveats = [];
  // 历史码与未收录码都要留话：前者 ok=true 但措辞不能省（§A 实测 63 条同码改名），
  // 后者 ok=null。与 idcard.js 的 caveats 同一套判据
  if (region.status === 'abolished' || region.status === 'uncoded') caveats.push(region.note);
  if (orgOk === null) caveats.push(`第 17 位为字母 ${orgChar}，未按组织机构代码校验位判定`);
  if (out.normalized) caveats.push('输入含小写字母，已按 31 字符集转大写后判定');
  out.caveat = caveats.filter(Boolean).join('；');
  out.hasCaveat = out.caveat !== '';

  out.info = {
    regionCode, region,
    registry: { char: compact[0], value: charValue(compact[0]) },
    category: { char: compact[1], value: charValue(compact[1]) },
    subject: compact.slice(8, 17), body8, orgChar, orgChecksum: org,
    checksum: { sum: outer.sum, remainder: outer.remainder, value: outer.value },
    checkBit: checkChar, expectedCheckBit: outer.char,
  };
  return out;
}

/** 按行解析：空行占一个行号、不静默压缩，与 parseIdCardList 同形 */
export function parseUsccList(text) {
  return String(text === null || text === undefined ? '' : text)
    .split(/\r?\n/)
    .map((raw, i) => ({ no: i + 1, raw, result: parseUscc(raw) }));
}

/** 31 字符集内的单个字符，否则抛：第 1、2 位只校验合法性，不解释含义 */
function singleChar(raw, what) {
  const s = String(raw === null || raw === undefined ? '' : raw).trim().toUpperCase();
  if (s.length !== 1 || charValue(s) === null) {
    throw new RangeError(`${what}应为 31 字符集内的单个字符，收到 ${String(raw)}`);
  }
  return s;
}

/** 区划段候选：只能是现行码。指定 regionCode 时按 §5.4 拒绝历史码与未收录码 */
function regionPool(options) {
  if (options.regionCode !== undefined && options.regionCode !== null) {
    const code = String(options.regionCode).trim().toUpperCase();
    const r = resolveRegion(code);
    if (r.status !== 'current') {
      const why = r.status === 'abolished' ? '历史码只许解、不许生成'
        : r.status === 'uncoded' ? '未收录码不能用于生成' : '省 / 市 / 县三级都落不到';
      throw new RangeError(`区划段 ${code} 不是现行码（${r.note || why}）；${why}`);
    }
    return [code];
  }
  const cities = currentCityCodes(options.provinceCode ?? '');
  if (cities.length === 0) {
    throw new RangeError(`省码 ${String(options.provinceCode)} 下没有现行市级区划`);
  }
  return cities.map((c) => `${c}00`);
}

/**
 * 8 位主体标识本体（数字）。掷完先算内层校验值，落在 10 就把末位挪一格：
 * 值 10 该写 'X' 还是 'A' 未核实（文件头），生成侧不碰这个分支就好。
 * 前 7 位固定时使值为 10 的末位在 0..9 里至多一个，所以挪一次必然避开。
 */
function rollBody8(rng) {
  const digits = [];
  for (let i = 0; i < 8; i += 1) digits.push(Math.floor(rng() * 10));
  if (orgChecksum8(digits.join('')).value === 10) {
    digits[7] = digits[7] === 0 ? 1 : digits[7] - 1;
  }
  return digits.join('');
}

/**
 * 生成校验位成立的测试码。**区划段只能出自现行表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseUscc 自检，逐项只要不是 true 就抛——生成器与校验器互为对手。
 *
 * @param {{provinceCode?:string, regionCode?:string, registry?:string, category?:string,
 *   count?:number, rng?:() => number}} [options] registry / category 是第 1、2 位字符，
 *   只校验是否在 31 字符集内，默认 '9' 与 '1'（最常见的那一档，本站不解释其含义）
 * @returns {Array<{code:string, regionCode:string, regionName:string, registryChar:string,
 *   categoryChar:string, subject:string, orgCheckBit:string, checkBit:string, caveat:string}>}
 */
export function generateUsccCodes(options = {}) {
  const rng = typeof options.rng === 'function' ? options.rng : seededRandom(Date.now());
  const count = options.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${String(count)}`);
  }
  const registry = singleChar(options.registry ?? '9', '登记管理部门代码（第 1 位）');
  const category = singleChar(options.category ?? '1', '机构类别代码（第 2 位）');
  const pool = regionPool(options);
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const regionCode = pool[Math.floor(rng() * pool.length)];
    const body8 = rollBody8(rng);
    const org = orgChecksum8(body8);
    const body17 = `${registry}${category}${regionCode}${body8}${org.value}`;
    const code = body17 + checksum17(body17).char;
    const self = parseUscc(code);
    const bad = self.checks.filter((k) => k.ok !== true);
    if (self.state !== 'valid' || bad.length > 0) {
      throw new Error(`内部不变量被破坏：生成的 ${code} 自检未通过（`
        + `state=${self.state}${bad.map((k) => `,${k.key}=${String(k.ok)}`).join('')}）`);
    }
    list.push({
      code, regionCode, regionName: self.info.region.fullName,
      registryChar: registry, categoryChar: category,
      subject: body17.slice(8, 17), orgCheckBit: String(org.value),
      checkBit: code[17], caveat: self.caveat,
    });
  }
  return list;
}
```

四处措辞是刻意的：`REFERENCE_NOTE` 用"未取到可核实来源"而不是"仅供参考"，因为后者读起来像谦虚、前者读起来是待办；`singleChar` 的报错里带上"第 1 位""第 2 位"，是让面板的提示能直接引用而不必自己再拼一遍位号；自检失败抛的是 `Error` 而不是 `RangeError`，因为这条不是用户输入错，是自家代码错，混在一个类型里会让页面把内部缺陷提示成"请检查输入"。

`orgChar` 是字母时判 `null` 是**故意的宽松**：非企业主体（军队、事业单位、社会组织）的第 9–17 位本就不是组织机构代码体系，那种码的第 17 位长成什么样本站没核实过，判它"不符"是越界。真正能确定判错的只有一种——第 17 位是数字、却与算出的值不等，所以 `false` 只留给这一档（口径出处见本段计划 §5.1 第 1 条）。

- [ ] **Step 5: 跑测试，确认绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `# pass 23`、`# fail 0`、`exit=0`（§A 6 条 + §B 9 条 + §C 8 条）。

若 C8 的"逐项目标全 true"或"342 个市级码 + 00"变红，不要放宽断言：前者说明 `rollBody8` 或 `regionPool` 落进了没预料的分支，把抛出的那条码打出来看它哪一项不是 true；后者说明 §A 的 6 位「市级码 + 00」那一档被改序或删掉了，那是 §C 的地基，回 Task 3 修。

- [ ] **Step 6: 提交**

```bash
git add dev/js/tools/uscc.js scripts/toolkit-tests.mjs
git commit -m "feat(tools): 统一社会信用代码双校验位判定与测试码生成"
```

---

## Task 6: 面板框架纯状态机（§D 判据）

**Files:**
- Create: `dev/js/tools/panel.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §D 五条）

### 6.0 本段只做状态机，DOM 绑定整段留给段 2

设计文档 §6.3 的四条要求里真正会写错的是**属性表算得对不对**与**hash / 按键怎么解释**，而这两件事都不需要 DOM：`aria-selected` 与 `tabindex` 必须严格互锁、`hidden` 必须只在选中时为假、方向键要在首尾回绕、未知 hash 不能把面板切成空白。这些在 Node 里断言比在浏览器里断言便宜两个数量级，也只有这样才能在段 1 就变红（段 1 没有任何页面可开）。DOM 绑定（`querySelectorAll`、`addEventListener`、`history.replaceState`、`scroll-margin-top`）留到段 2 的 `dev/js/toolIdcard.js` 里做，它只做一件事：把这里算出的属性表原样写进节点、把事件原样喂进来。

四条口径先定下来，判据与实现都按它走：

- **自动激活**：方向键移动焦点即切换面板。设计文档 §6.3 写的是"上下切换"，索引条只有 5 项，不做手动激活那套 `aria-activedescendant`。左右键同时接，因为索引条在窄屏可能换向（§8.3 五档实测那一档的事，这里先不留债）。
- **未知 hash 不切空白**：`#nope` 一律保持当前面板，把 `unknown` 记在 `unknownHash()` 上等 DOM 层提示。状态机绝不把 `active` 置空——"所有面板都 hidden"是这个模块能造出的最难发现的页面故障，宁可地址栏与页面短暂不一致。
- **无 hash 不写 hash**：首次进入且 URL 里没有 `#` 时选中第一块，但 `toHash()` 返回 `''`，DOM 层据此不调 `replaceState`。写 hash 是用户动作（点 tab / 按键 / 收到 hashchange）之后的事。
- **`select(已选中的 id)` 返回 `true`**：这个返回值只回答"有没有这块面板"，不回答"换没换"，换没换在 `move()` 的 `changed` 里。点已经亮着的那块 tab 是合法操作，报成"没有这个面板"会让页面弹出一条莫名其妙的提示。

前缀是构造参数而不是写死的 `tk-`：JSON 工作台用 `.jt-` 类名（§6.4 两条黑名单前缀），若 id 仍是 `tk-tab-*`，样式与ARIA就在同一个节点上各说一套。

- [ ] **Step 1: 写 §D 判据（追加到 `scripts/toolkit-tests.mjs` 末尾）**

```js
// ── §D 面板框架纯状态机 ─────────────────────────────────────────────────────

const { createPanelWorkspace, parseHash, keyAction } = await import('../dev/js/tools/panel.js');

/** 设计文档 §5.1 / §5.2 的两页锚点，本段页面还不存在，先按文档里的名字测 */
const TOOLKIT = ['idcard', 'uscc', 'bankcard', 'mobile', 'random'];
const CODEC = ['timestamp', 'base64', 'url', 'digest', 'regex'];

test('D1 属性表：ARIA 骨架齐，id 命名可预期', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT });
  assert.deepEqual(ws.ids(), TOOLKIT, '顺序就是文档顺序，DOM 层要照它渲染');
  assert.equal(ws.active(), 'idcard', '无 hash 时选中第一个');
  const first = ws.tabAttr('idcard');
  assert.deepEqual({
    id: first.id, role: first.role, sel: first['aria-selected'],
    controls: first['aria-controls'], tab: first.tabindex,
  }, {
    id: 'tk-tab-idcard', role: 'tab', sel: 'true',
    controls: 'tk-panel-idcard', tab: '0',
  });
  assert.equal(Object.keys(first).sort().join(','),
    'aria-controls,aria-selected,id,role,tabindex');
  const panel = ws.panelAttr('idcard');
  assert.deepEqual({
    id: panel.id, role: panel.role, labelled: panel['aria-labelledby'],
    tab: panel.tabindex, hidden: panel.hidden,
  }, {
    id: 'tk-panel-idcard', role: 'tabpanel', labelled: 'tk-tab-idcard',
    tab: '0', hidden: false,
  });
  // 页面里两块隐藏内容不是 tabpanel 该管的：本模块不产 role="region" 那套退化形态
  assert.equal(Object.keys(panel).sort().join(','),
    'aria-labelledby,hidden,id,role,tabindex');
  assert.equal(ws.panelAttr('uscc').hidden, true, '未选中的面板必须 hidden');
  // JSON 工作台换前缀时，tab 与 panel 两侧的配对必须一起换，否则 aria-labelledby 指空
  const jt = createPanelWorkspace({ ids: ['format', 'convert'], prefix: 'jt' });
  assert.deepEqual({
    controls: jt.tabAttr('format')['aria-controls'],
    labelled: jt.panelAttr('format')['aria-labelledby'],
  }, { controls: 'jt-panel-format', labelled: 'jt-tab-format' });
});

test('D2 roving tabindex：整条 tablist 上只有一个是 0', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT, hash: '#mobile' });
  const tabs = TOOLKIT.map((id) => ws.tabAttr(id));
  assert.deepEqual(tabs.filter((t) => t.tabindex === '0').map((t) => t.id), ['tk-tab-mobile'],
    'tabindex=0 的数量不是 1，键盘用户就会掉进 tab 黑洞');
  assert.equal(tabs.every((t) => t.tabindex === '0' || t.tabindex === '-1'), true,
    'tabindex 只能是字符串 0 / -1，写成布尔或数字会让属性丢失');
  assert.deepEqual(tabs.filter((t) => t['aria-selected'] === 'true').map((t) => t.id), ['tk-tab-mobile']);
  ws.move('next');
  assert.equal(ws.tabAttr('random').tabindex, '0', '切换后 roving 要跟着走');
  assert.equal(ws.tabAttr('mobile').tabindex, '-1');
  assert.equal(ws.tabAttr('random')['aria-selected'], 'true');
  assert.equal(ws.tabAttr('mobile')['aria-selected'], 'false', 'aria-selected 与 tabindex 必须互锁');
  assert.equal(ws.panelAttr('mobile').hidden, true, '自动激活：焦点走的同时面板就换');
  assert.equal(ws.panelAttr('random').hidden, false);
});

test('D3 方向键与 Home/End：首尾回绕，非索引键不动状态', () => {
  const ws = createPanelWorkspace({ ids: CODEC });
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual(ws.move('next'), { active: 'base64', changed: true });
  assert.deepEqual(ws.move('prev'), { active: 'timestamp', changed: true });
  assert.deepEqual(ws.move('prev'), { active: 'regex', changed: true }, '首位再 prev 回绕到末位');
  assert.deepEqual(ws.move('last'), { active: 'regex', changed: false }, '已在末位，last 是空操作');
  ws.move('first');
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual(ws.move('nonsense'), { active: 'timestamp', changed: false },
    '不认识的动作文本必须是空操作而不是跳空白');
  assert.equal(ws.active(), 'timestamp');
  assert.deepEqual({ a: keyAction({ key: 'ArrowDown' }), b: keyAction({ key: 'ArrowUp' }),
    c: keyAction({ key: 'Home' }), d: keyAction({ key: 'End' }),
    e: keyAction({ key: 'ArrowRight' }), f: keyAction({ key: 'ArrowLeft' }) },
  { a: 'next', b: 'prev', c: 'first', d: 'last', e: 'next', f: 'prev' });
  assert.equal(keyAction({ key: 'ArrowDown', ctrlKey: true }), '', '带修饰键的上下键是系统快捷键，不抢');
  assert.equal(keyAction({ key: 'ArrowUp', shiftKey: true }), '');
  assert.equal(keyAction({ key: 'a' }), '');
  assert.equal(keyAction({}), '');
  assert.equal(keyAction(null), '');
});

test('D4 hash 双向：解析容错、未知不下沉、无 hash 不写 hash', () => {
  assert.deepEqual(parseHash('#uscc', TOOLKIT), { id: 'uscc', unknown: false });
  assert.deepEqual(parseHash('uscc', TOOLKIT), { id: 'uscc', unknown: false }, '漏了 # 也要认');
  assert.deepEqual(parseHash('#USCC', TOOLKIT), { id: 'uscc', unknown: false }, '大小写不敏感');
  assert.deepEqual(parseHash('  #uscc  ', TOOLKIT), { id: 'uscc', unknown: false });
  assert.deepEqual(parseHash('', TOOLKIT), { id: null, unknown: false }, '无 hash 不是异常');
  assert.deepEqual(parseHash('#', TOOLKIT), { id: null, unknown: false });
  assert.deepEqual(parseHash(null, TOOLKIT), { id: null, unknown: false });
  assert.deepEqual(parseHash('#nope', TOOLKIT), { id: null, unknown: true });
  assert.deepEqual(parseHash('#idcard/../x', TOOLKIT), { id: null, unknown: true },
    '奇奇怪怪的 hash 只能当不认识，不能进 id');
  const ws = createPanelWorkspace({ ids: TOOLKIT, hash: '#bankcard' });
  assert.equal(ws.active(), 'bankcard');
  assert.equal(ws.unknownHash(), false);
  assert.equal(ws.toHash(), '#bankcard', '写回页面的 hash 由模块给，DOM 层不自己拼');
  assert.equal(ws.select('nope'), false);
  assert.equal(ws.active(), 'bankcard', '未知 id 不得把面板切成空白');
  assert.equal(ws.applyHash('#random'), true);
  assert.equal(ws.active(), 'random');
  assert.equal(ws.applyHash('#nope'), false, 'applyHash 把 unknown 变成返回值，DOM 层据此提示');
  assert.equal(ws.unknownHash(), true);
  assert.equal(ws.active(), 'random');
  assert.equal(ws.applyHash(''), false, 'hash 被清空时不动当前面板');
  assert.equal(ws.active(), 'random');
  // 首次进入且 URL 里没有 #：选中第一块，但不产生 hash、不改历史
  const bare = createPanelWorkspace({ ids: TOOLKIT });
  assert.equal(bare.active(), 'idcard');
  assert.equal(bare.toHash(), '', '没有用户动作就不该往地址栏写东西');
  bare.select('uscc');
  assert.equal(bare.toHash(), '#uscc', '点过之后才开始写 hash');
  assert.equal(createPanelWorkspace({ ids: TOOLKIT, hash: '#nope' }).unknownHash(), true,
    '开局就是坏 hash 也要留得下线索');
  assert.equal(createPanelWorkspace({ ids: TOOLKIT, hash: '#nope' }).active(), 'idcard',
    '坏 hash 回落到第一块，不是空白');
});

test('D5 单块塌了不整页塌：错误只记在那一块上', () => {
  const ws = createPanelWorkspace({ ids: TOOLKIT });
  assert.equal(ws.brokenOf('idcard'), '');
  ws.markBroken('uscc', '区划数据未就绪');
  assert.equal(ws.brokenOf('uscc'), '区划数据未就绪');
  assert.equal(ws.brokenOf('idcard'), '', '别的面板不得被连坐');
  assert.equal(ws.tabAttr('uscc')['aria-selected'], 'false', '坏掉的面板照样能选中，用户才看得见错误条');
  assert.equal(ws.panelAttr('uscc').hidden, true, '未选中时照样 hidden：错误条在面板里，不该飘在页面上');
  ws.select('uscc');
  assert.equal(ws.active(), 'uscc');
  assert.equal(ws.panelAttr('uscc').hidden, false);
  ws.markBroken('uscc', '换了个原因');
  assert.equal(ws.brokenOf('uscc'), '换了个原因', '重复标记是覆盖而不是叠加，否则错误条会越长越长');
  assert.deepEqual(ws.brokenIds(), ['uscc']);
  ws.clearBroken('uscc');
  assert.equal(ws.brokenOf('uscc'), '');
  assert.deepEqual(ws.brokenIds(), []);
  ws.markBroken('random', 'x');
  ws.markBroken('idcard', 'y');
  assert.deepEqual(ws.brokenIds(), ['idcard', 'random'], '按面板顺序报，DOM 层据此渲染汇总条');
  assert.throws(() => ws.markBroken('nope', 'x'), /未知面板/);
  assert.throws(() => createPanelWorkspace({ ids: [] }), /至少一个面板/);
  assert.throws(() => createPanelWorkspace({ ids: ['a', 'a'] }), /重复/);
});
```

四条判据各自钉住一件段 2 里事后极难查的事：`D1` 的键集断言（`Object.keys().sort().join(',')`）防的是"顺手多加一个 `aria-expanded`"——`tabpanel` 上多出来的状态属性会被读屏器当成可展开区域念出来；`D2` 数的是 `tabindex==='0'` 的**个数**而不是值，这是 roving tabindex 唯一真正的不变式；`D3` 用 `deepEqual` 把 `move()` 的返回形状钉成 `{active, changed}`，段 2 写页面时才能一行拿到"要不要重绘 + 要不要写 hash"；`D4` 的 `bare.toHash() === ''` 是防"进页面就被 `replaceState` 改了地址栏"这条，它会让后退键失效，而且只在第一个面板上出现。

`D5` 是这套框架的容错边界：一块面板的初始化异常（比如段 3 才发现区划表读不到）只落在它自己那格上，坏掉的面板照样能被选中、照样 `hidden`，错误条在面板内渲染。`brokenIds()` 按面板顺序而非时间顺序返回，页脚的"n 项不可用"汇总才不会随加载竞态抖动。

- [ ] **Step 2: 跑测试，确认它红**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `exit` 非 0，报 `Cannot find module '…/dev/js/tools/panel.js'`（同样是 `await import()` 在加载期抛，§A/§B/§C 一起不跑）。

- [ ] **Step 3: 提交红灯**

```bash
git add scripts/toolkit-tests.mjs
git commit -m "test(tools): 面板状态机判据先行，模块待实现"
```

- [ ] **Step 4: 写 `dev/js/tools/panel.js`**

```js
/**
 * 工具箱面板状态机：ARIA Tabs 属性表、roving tabindex、hash 双向解释、单块错误隔离。
 *
 * 纯状态，不碰 DOM，也不 import 任何兄弟模块：页面装配层（段 2）只做两件事——
 * 把 tabAttr/panelAttr 返回的属性表原样写进节点，把 hashchange/keydown 原样喂给
 * applyHash/move。口径与理由见实现计划 §6.0。
 */

/** 前缀默认 tk（toolkit 页）；JSON 工作台用 jt，避免类名是 .jt- 而 id 是 tk-tab-*。 */
export function createPanelWorkspace({ ids, hash = '', prefix = 'tk' } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('createPanelWorkspace：面板 id 列表为空，至少一个面板');
  }
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || id === '') {
      throw new Error('createPanelWorkspace：面板 id 必须是非空字符串');
    }
    if (seen.has(id)) throw new Error(`createPanelWorkspace：面板 id 重复：${id}`);
    seen.add(id);
  }
  const tabId = (id) => `${prefix}-tab-${id}`;
  const panelId = (id) => `${prefix}-panel-${id}`;
  const MOVE = {
    next: (i, n) => (i + 1) % n,
    prev: (i, n) => (i - 1 + n) % n,
    first: () => 0,
    last: (_i, n) => n - 1,
  };

  const broken = new Map();
  const initial = parseHash(hash, ids);
  let active = initial.id === null ? ids[0] : initial.id;
  let unknown = initial.unknown;
  let touched = initial.id !== null;

  const settle = (id) => {
    const changed = id !== active;
    active = id;
    touched = true;
    unknown = false;
    return { active, changed };
  };

  return {
    ids: () => ids.slice(),
    active: () => active,
    /** 最近一次 hash 是否不认识：DOM 层据此提示"没有这个面板"，状态机自己绝不清空白 */
    unknownHash: () => unknown,
    tabAttr(id) {
      const on = id === active;
      return {
        id: tabId(id),
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        'aria-controls': panelId(id),
        tabindex: on ? '0' : '-1',
      };
    },
    panelAttr(id) {
      const on = id === active;
      return {
        id: panelId(id),
        role: 'tabpanel',
        tabindex: '0',
        'aria-labelledby': tabId(id),
        hidden: !on,
      };
    },
    /** 点 tab：返回 false 只代表"没有这块面板"，点击已选中的 tab 是 true 且 changed=false */
    select(id) {
      if (!seen.has(id)) return false;
      settle(id);
      return true;
    },
    move(action) {
      const step = MOVE[action];
      if (!step) return { active, changed: false };
      const i = ids.indexOf(active);
      return settle(ids[step(i, ids.length)]);
    },
    applyHash(raw) {
      const parsed = parseHash(raw, ids);
      if (parsed.unknown) {
        unknown = true;
        return false;
      }
      if (parsed.id === null) return false;
      settle(parsed.id);
      return true;
    },
    /** 无 hash 进入且用户还没动手时返回 ''：DOM 层据此决定要不要 replaceState */
    toHash() {
      return touched ? `#${active}` : '';
    },
    markBroken(id, message = '') {
      if (!seen.has(id)) throw new Error(`未知面板 id：${id}`);
      broken.set(id, String(message));
    },
    brokenOf(id) {
      return broken.get(id) || '';
    },
    brokenIds: () => ids.filter((id) => broken.has(id)),
    clearBroken(id) {
      broken.delete(id);
    },
  };
}

/** 只去前导 #、只做小写折叠，别的字符一律不解释——id 是白名单里的字符串或 null */
export function parseHash(raw, ids) {
  const s = typeof raw === 'string' ? raw.trim().replace(/^#/, '') : '';
  if (s === '') return { id: null, unknown: false };
  const hit = ids.find((id) => id.toLowerCase() === s.toLowerCase());
  return hit === undefined ? { id: null, unknown: true } : { id: hit, unknown: false };
}

/**
 * 键事件 → 动作文本。左右上下都接（索引条在窄屏可能换向），带任何修饰键一律不抢。
 * 返回值直接喂 move；这里不碰状态，方便装配层在 input/textarea 里先问一句要不要放行。
 */
export function keyAction(evt) {
  if (!evt || evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey) return '';
  switch (evt.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return 'next';
    case 'ArrowUp':
    case 'ArrowLeft':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return '';
  }
}
```

三处实现细节是有意的，改动前先读 §6.0：

1. `parseHash` 定义在 `createPanelWorkspace` 之后却能被构造器调用，靠的是函数声明提升。**别改成 `const parseHash = () => {}`**——那样构造一跑就 `Cannot access 'parseHash' before initialization`，而这条只在页面加载时炸，Node 判据里 `D1` 会直接红成一片，看不出原因。
2. `touched` 只在 `settle()` 里置真，所以 `move('nonsense')`、`applyHash('#nope')`、`select('nope')` 三条失败路径都不写 hash：一次失败的跳转不该留下历史痕迹。构造时带合法 hash 也算 touched（`toHash()` 要能原样写回 `#bankcard`）。
3. `ids: () => ids.slice()` 与 `brokenIds()` 的排序都返回新数组。段 2 的装配层会把 `ids()` 直接喂给渲染循环，交出内部引用的话，页面里一次 `sort()` 就能把状态机的回绕顺序改乱，而这种串扰在测试里复现不出来。

- [ ] **Step 5: 跑测试，确认绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `# pass 28`、`# fail 0`、`exit=0`（§A 6 条 + §B 9 条 + §C 8 条 + §D 5 条）。

`D2`/`D3` 里数 `tabindex==='0'` 个数那条如果变红，先确认是不是把 `'0'` 写成了 `0`：`setDataset`/`setAttribute` 对数字无所谓，但 `Object.keys` 断言与 DOM 属性表比对时 `'0' !== 0`，这类错在浏览器里表现成"tab 键完全没反应"，比红更难查。

- [ ] **Step 6: 提交**

```bash
git add dev/js/tools/panel.js scripts/toolkit-tests.mjs
git commit -m "feat(tools): 面板框架纯状态机（ARIA Tabs / roving tabindex / hash）"
```

---

## Task 7: 归属与许可记录（`assets/data/LICENSES.md`）

**Files:**
- Create: `assets/data/LICENSES.md`（本任务同时新建 `assets/data/` 目录）

### 7.0 为什么单独开一个文件，以及本轮复核推翻了什么

`SOURCES.json`（Task 1）已经有 URL、字节、SHA-256、条数、数据截止日了，再写一份就是给自己造漂移源。分工是：**机器读的那份记"哪一版数据"，人读的这份记"我们欠谁什么"**——哈希两边都不重复。

设计文档 §6.5 说这份文件按 `assets/fonts/LICENSES.md` 的既有做法写，本轮实测发现两件事必须在计划里落字，否则执行时会照抄一个错的口径：

1. **`_config.yml:254` 已有 `- "assets/**/*.md"`**，`assets/fonts/LICENSES.md` 因此**并不进 `_site`**，也不会公开在 `/better-blog/assets/fonts/LICENSES.md`。归属记录留在仓库、不留在线上，是本站既定口径；新文件落在同一个 glob 下，**不需要改任何配置**，Step 2 只做实测确认。
2. **站内 IDValidator 副本的许可通知是不完整的**：`demo/idCardDemo/lib/IDValidator.js` 文件头只有 `Released under the MIT license` 一行，**没有版权行**；同目录的 `GB2260.js` 连文件头都没有。上游 `mc-zone/IDValidator` 的许可文件是 `MIT-LICENSE`（GitHub API 实测 `license.spdx_id = "NOASSERTION"`——它用的是 2014 年老式写法，GitHub 认不出来，但正文首行就是 `Copyright (c) 2014 mc-zone`）。MIT 的义务就是把版权行与许可原文保留在分发物里，所以**完整通知必须逐字抄进本文件**——段 5 删掉 `demo/idCardDemo/` 之后，仓库里只有这一处能满足它。相应地，Task 1 `SOURCES.json` 里 `licenseTextAt` 指的那一行只算"上游自称 MIT"，不是许可文本本身。

WTFPL 一侧本轮二次复核过：`api.github.com/repos/modood/Administrative-divisions-of-China/license` 返回 `path=LICENSE`、`spdx_id=WTFPL`，正文就是 "DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE Version 2" 那三段。它没有任何附加条件，署名纯靠善意——但数据本体（区划码与名称）是国家统计局公布的政府公开信息，modood 整理的是格式，这一层区别也要写清楚，否则读的人以为区划代码是某个 GitHub 仓库的创作。

- [ ] **Step 1: 复核三份来源的许可文本（联网，可重跑）**

```bash
mkdir -p assets/data
for repo in modood/Administrative-divisions-of-China mc-zone/IDValidator; do
  for i in 1 2 3; do
    curl -sS --http1.1 --max-time 20 -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$repo/license" -o "/tmp/lic-$(basename $repo).json" && break
    sleep 2
  done
done
node -e '
for (const [name, p] of [["modood","/tmp/lic-Administrative-divisions-of-China.json"],["IDValidator","/tmp/lic-IDValidator.json"]]) {
  const j = JSON.parse(require("fs").readFileSync(p, "utf8"));
  const text = Buffer.from(j.content || "", "base64").toString();
  console.log("[" + name + "] path=" + j.path + " spdx=" + (j.license && j.license.spdx_id));
  console.log(text.split("\n").filter(Boolean).slice(0, 3).join(" / "));
}'
```

Expected（`api.github.com` 与 `raw.githubusercontent.com` 一样会偶发 `SSL_ERROR_SYSCALL`，脚本里已带三次重试）：

```
[modood] path=LICENSE spdx=WTFPL
        DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE /                     Version 2, December 2004 /  Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>
[IDValidator] path=MIT-LICENSE spdx=NOASSERTION
Copyright (c) 2014 mc-zone / http://weibo.com/mcishere / The MIT License (MIT)
```

`spdx` 与 `path` 任一不符 → 停下来。`NOASSERTION` 是**预期值**，不是失败：它只是 GitHub 的自动识别结果，不代表许可不明。npm `uscc` 那条用 `curl -sS --http1.1 https://registry.npmjs.org/uscc/1.2.0` 复核，`license` 字段实测为 `GPL-3.0`（本轮已实测，写进 Step 2 的第四节）。

- [ ] **Step 2: 写 `assets/data/LICENSES.md`**

````markdown
# assets/data 数据来源与许可

这里只记人需要看懂的部分：欠谁什么、我们拿的是哪一层东西、哪些第三方实现查过但没用。
机器可读的来源清单（URL / 字节 / SHA-256 / 条数 / 数据截止日）在
`scripts/fixtures/region-source/SOURCES.json`，本文件不重复哈希，避免两份记录各说一套。

## 一、两张区划表

| 用途 | 来源 | 许可 | 取到的东西 |
| --- | --- | --- | --- |
| 现行省／市／县三级区划（`region-data.js` 主层） | [modood/Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China) 的 `dist/{provinces,cities,areas}.json`，pin 在 tag `2.7.0` → commit `6fb5380de7e6c961869dcd1629df4adc088fa9bb`（不用可前进的 `master`） | WTFPL v2 | 31 / 342 / 2,978 条快照；数据截止 2022-10-31 |
| 历史码（已撤销建制，只用于解码） | [mc-zone/IDValidator](https://github.com/mc-zone/IDValidator) 随包的 `GB2260.js`（站内旧副本 `demo/idCardDemo/lib/GB2260.js`） | MIT | 3,465 条，2015 年前后口径 |

WTFPL 的复核方式记在这里，因为它推翻了"记得是 MIT"这类口口相传：GitHub API
`/repos/modood/Administrative-divisions-of-China/license` 返回 `path=LICENSE`、
`license.spdx_id=WTFPL`，正文为 WTFPL v2 原文（479 字节，`Version 2, December 2004`）。
**注意接口的 `spdx_id` 只有 `WTFPL`、没有 `WTFPL-2.0`**，版本号是从原文首段读出来的——
`SOURCES.json` 里 `license` 因此写 `WTFPL`，`licenseEvidence` 则记原文哈希而非「HTTP 200」，
因为一次成功的请求不是证据。WTFPL 无任何附加条件，署名纯按惯例。

## 二、数据本体不是这两个仓库的创作

三级区划的代码与名称来自国家统计局公布的**统计用区划和城乡划分代码**，属政府公开信息；
modood 做的是采集与格式整理，其许可覆盖的是那份 JSON 的编排表达。同理，GB/T 2260 是推荐性
国家标准，本站只使用其中的**代码与名称这一组事实**，不转录标准正文、不复述标准里的层级划分
说明文字。这一层区别要写清楚，否则读起来像是某个 GitHub 仓库创作了区划代码。

## 三、IDValidator 的 MIT 许可通知（逐字保留）

站内 `demo/idCardDemo/lib/IDValidator.js` 的文件头只有 `Released under the MIT license` 一行，
没有版权行，而同目录的 `GB2260.js` 连文件头都没有——所以许可通知从上游
`MIT-LICENSE` 逐字抄录于此（GitHub API 对该文件返回 `spdx_id=NOASSERTION`，只是自动识别失败，
正文即 MIT）：

```
Copyright (c) 2014 mc-zone
http://weibo.com/mcishere

The MIT License (MIT)
```

本站与该表有关的部分只是其中 `GB2260` 历史码表的数据，未运行、未搬运 `IDValidator` 的校验代码
（身份证校验位是自行按 GB 11643-1999 口径实现的，对拍关系见 `scripts/fixtures/id-validator-checkbit-1000.json`
的生成器注释）。旧 demo 目录移除后，本文件是仓库内保留该通知的唯一位置。

## 四、查过但没有用的第三方实现

- npm `uscc@1.2.0`：校验逻辑可用，但 `registry.npmjs.org/uscc/1.2.0` 的 `license` 字段实测为
  **GPL-3.0**。本站代码以 MIT 分发（见根目录 `LICENSE`），引入 GPL-3.0 前端代码会把随包分发的
  资产整体拽进 copyleft 义务。因此只借它"用真实公开码当测试向量"的思路，不引依赖、不抄源码。
- npm `id-validator`（mc-zone 同一作品）：其随包的 GB2260 表就是本文第一节的旧副本来源。
  算法部分本站自己实现，为的是与设计文档 §5.4 的三态判定契约同构，不接依赖。

## 五、新增来源时的义务

后续每加一份"别人整理出来、我们只是使用"的东西（数据表、字体、图标、第三方依赖），
必须在本文第一节加行，并同步其机器可读清单（若该数据由脚本生成，则同步
`SOURCES.json` 的对应条目）。判断标准只有一条：**内容是不是别人的整理成果**。
自己按公开口径算出来的算法不占本文篇幅——校验位、加权和这类算法的口径写进
`_docs/superpowers/specs/` 对应小节，本文件只管归属。
````

三处措辞是刻意的：第一节把"取到的东西"写成条数与截止日而不是"最新版"，因为快照不随上游更新；第三节把站内副本缺版权行这件事写出来而不是悄悄补，否则下一个人还会以为 `lib/` 里那份文件头就是许可全文；第四节留的是"为什么没用"，它比"用了什么"更容易被将来的人误删——没有这一节，一次"顺手加个 uscc 依赖重构一下"就能把 GPL-3.0 引进来。

- [ ] **Step 3: 实测它不进 `_site`**

```bash
rm -rf /tmp/site-task7
bundle exec jekyll build --quiet --destination /tmp/site-task7 > /tmp/site-task7.log 2>&1; echo "build exit=$?"
find /tmp/site-task7 -name '*.md' | sort
ls /tmp/site-task7/assets/data 2>&1
```

Expected: `build exit=0`；`find` **无任何输出**（全站 `.md` 都排在 `assets/**/*.md` 与根级 `CHANGELOG.md`／`LICENSE` 等条目之外，这同时是 `assets/fonts/LICENSES.md` 走同一条规则的实证）；`ls` 报 `No such file or directory`。

`find` 若输出任何一行，先看是不是本文件被写上了 YAML front matter——带 front matter 的 `.md` 会被 Jekyll 当页面渲染成 `.html` 并公开，`_config.yml:248-254` 那条注释记录的就是这个坑的历史（修之前线上有 44 个英文配图笔记）。**不要靠给这一个文件另加 `exclude` 条目来收口**，`assets/**/*.md` 已经覆盖，另加一条只会让人以为该目录下的 `.md` 默认会上线。

- [ ] **Step 4: 核对指针方向一致**

```bash
grep -rn "assets/data/LICENSES.md" dev/js/tools scripts/build-region-data.mjs 2>/dev/null | sort
test -f assets/data/LICENSES.md && echo "文件在位"
```

Expected: 恰好两条命中，加上"文件在位"。

```
dev/js/tools/region-data.js:…  * 归属许可：assets/data/LICENSES.md
scripts/build-region-data.mjs:… * 数据来源与许可：assets/data/LICENSES.md
```

前者是生成器的模板写进产物的头注释，后者是生成器自己的文件头（Task 3 Step 1／Step 4 里各有一处，位置分别在注释块末行）。指针单向：数据侧指向这里，这里不重复数据侧的哈希。命中数少于两条 → Task 3 的头注释被改掉了；那是段 5 删掉旧库之后唯一的归属线索，必须补回而不是把这条判据删短。`region-data.js` 经 Vite 压缩后这段注释不会进线上产物，归属因此是仓库侧的，与 Step 3 的"不进 `_site`"口径一致。

- [ ] **Step 5: 提交**

```bash
git add assets/data/LICENSES.md
git commit -m "docs(tools): 区划数据与 IDValidator 的许可归属记录，实测不进站点产物"
```

---

## Task 8: 自证——判据有牙、产物零重叠（第一段收口）

**Files:** 无新增。这一节只做两件事：证明前面 28 条绿不是自说自话，证明本段没有碰到线上产物。

### 8.0 为什么收口任务不给功能

段 1 交付的是"将来别人会依赖的东西"：算法表、区划口径、面板契约。这类东西最坏的失败模式不是红，是**绿着错**——判据与被测实现共用同一张表、同一种误解，测试永远亮绿灯。所以 Step 1 用四条变异反向证明判据有牙，一次改错一处，看它是否按预期变红、且红的正是该管的那条。

四条变异各自覆盖一种"复制粘贴就会错"的位置：字符表抄反、模运算少一步、属性值少一对引号、诚实措辞的分支被"简化"掉。**任何一条变异后仍全绿，就是在这一节里补判据，不许把断言删短。**

Step 2–4 是同方向的另一半：本段所有新文件都落在 `dev/js/tools/`（Vite 子目录不成入口）、`scripts/`（Jekyll 已排除）、`assets/data/`（`assets/**/*.md` 已排除）三个"应当完全不被产物看见"的位置。这个断言必须用产物证，不能用"我看过配置了"证。

- [ ] **Step 1: 四条变异，逐条确认它红、还原、复绿**

```bash
# M1 少一步模：末位在"余数为 0"那一档越界（约 1/31 的真实码会被判错）
cp dev/js/tools/uscc.js /tmp/seg1/uscc.orig
sed -i '' 's|const value = (31 - remainder) % 31;|const value = 31 - remainder;|' dev/js/tools/uscc.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>/dev/null | grep -E '^(not ok|# (pass|fail))'
mv /tmp/seg1/uscc.orig dev/js/tools/uscc.js
```

Expected（M1）：`not ok` 里必有 **C4**（"末位计算：余数为 0 取 0"）；C8 可能出现——生成 20 条时抽到余数 0 的概率约 48%，它红是运气不是判据，别把 C8 当 M1 的验收。**不以 B8 那类"生成后自检"为守卫**：生成器与校验器共用同一张表时，表错了自检照样全过，能守住表的只有跨实现的对拍（M2 就是来看这一点的）。

```bash
# M2 校验位表整个抄反
cp dev/js/tools/idcard.js /tmp/seg1/idcard.orig
sed -i '' "s|CHECK_MAP = '10X98765432'|CHECK_MAP = '23456789X01'|" dev/js/tools/idcard.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>/dev/null | grep -E '^(not ok|# (pass|fail))'
mv /tmp/seg1/idcard.orig dev/js/tools/idcard.js
```

Expected（M2）：**B1 与 B7 同时红**，`# fail` 至少 2。B7 是那份 1,000 条对拍夹具在起作用——它守的正是"我们自己把表抄反了"这种错，而页面与测试共用同一份实现时，任何单侧的绿都证明不了这一点。

```bash
# M3 属性值少一对引号：写成数字，浏览器里表现为 tab 键失灵
cp dev/js/tools/panel.js /tmp/seg1/panel.orig
sed -i '' "s|tabindex: on ? '0' : '-1',|tabindex: on ? 0 : -1,|" dev/js/tools/panel.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>/dev/null | grep -E '^(not ok|# (pass|fail))'
mv /tmp/seg1/panel.orig dev/js/tools/panel.js
```

Expected（M3）：**D1 与 D2 同时红**（`panelAttr` 里那条 `tabindex: '0',` 不在这个 sed 的匹配范围内，所以红的只有 tab 侧，这正是 D1 数 `tabindex==='0' ‖ '-1'` 的意义）。

```bash
# M4 把"历史码也要留话"当成冗余简化掉：两个模块各一处，一起改
cp dev/js/tools/idcard.js /tmp/seg1/idcard.orig && cp dev/js/tools/uscc.js /tmp/seg1/uscc.orig
sed -i '' "s,'abolished' || region.status === 'uncoded','uncoded'," dev/js/tools/idcard.js dev/js/tools/uscc.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>/dev/null | grep -E '^(not ok|# (pass|fail))'
mv /tmp/seg1/idcard.orig dev/js/tools/idcard.js && mv /tmp/seg1/uscc.orig dev/js/tools/uscc.js
```

Expected（M4）：**B6 与 C6 同时红**，红的都是那句措辞断言（`未见于现行区划表`）。这条是本轮写计划时真踩到过的：先只给 `uncoded` 留话、觉得 `abolished` 反正 `ok=true` 不必解释，判据当场把它抓住——63 条同码改名的事实决定了历史层不能断言"已撤销建制"。

四条都还原后，复跑测试命令：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected：`# pass 28`、`# fail 0`、`exit=0`。变异自证用 `cp` 备份 + `mv` 还原而不是 `git checkout --`：这段文件全部已提交，但本仓库常有第二个会话同时在 `main` 上改东西，`checkout` 会把它未提交的改动一起吃掉。还原后必须复跑而不是假定干净——`sed -i ''` 匹配不到内容时是静默成功的，M2/M3 若没变红，先确认 `grep` 的那一行还在（`grep -c "23456789X01" dev/js/tools/idcard.js` 之类），别改判据。

- [ ] **Step 2: 零重叠之一——Vite 产物逐字节一致**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
pnpm build >/tmp/seg1/build-after.log 2>&1; echo "build exit=$?"
( cd assets && find . -name '*.min.*' -print0 | sort -z | xargs -0 shasum -a 256 ) > /tmp/seg1/assets-sha-after.txt
diff /tmp/seg1/assets-sha-before.txt /tmp/seg1/assets-sha-after.txt && echo "产物逐字节一致"
```

Expected：`build exit=0`、`产物逐字节一致`、29 行哈希一字不差。这条证的是 Task 1 Step 1 里那句"子目录不成入口"：`dev/js/tools/*.js` 五个模块没有被任何既有入口 import，所以 Vite 既不会为它们生成新产物，也不会改动别人的。

若 `diff` 非空：先按哈希行里的文件名去 `git log --oneline $(cat /tmp/seg1/head-before.txt)..HEAD -- dev/` 查是不是别人在这期间改了源码；查不到就是本段越界（比如不小心动了 `dev/js/index.js` 或 `vite.config.js`），立刻回退那一处。**不要**用"重新生成基线"消差：基线是开工时的快照，重造一份就等于没有基准。

- [ ] **Step 3: 零重叠之二——Jekyll 产物里不出现本段任何文件**

```bash
rm -rf /tmp/seg1/site-after
bundle exec jekyll build --destination /tmp/seg1/site-after >/tmp/seg1/jekyll-after.log 2>&1; echo "jekyll exit=$?"
( cd /tmp/seg1/site-after && find . -type f | sort ) > /tmp/seg1/site-paths-after.txt
( cd /tmp/seg1/site-before && find . -type f | sort ) > /tmp/seg1/site-paths-before.txt
comm -13 /tmp/seg1/site-paths-before.txt /tmp/seg1/site-paths-after.txt > /tmp/seg1/site-added.txt
wc -l < /tmp/seg1/site-added.txt
grep -E 'scripts|dev|fixtures|assets/data|toolkit|region|idcard|uscc|panel|LICENSES' /tmp/seg1/site-added.txt; echo "关键字命中 exit=$?（1 才是对的）"
```

Expected：`jekyll exit=0`；`site-added.txt` 可能非空（第二个会话在这期间发了新文章就会多文件），但**关键字必须零命中**（`grep` 的 exit 为 1）。这里刻意不要求"文件全集完全相同"：那个断言会被别人的正常提交无端判红，而本段的真正主张只是"我没往站点里多塞任何东西"，按路径关键字归因正好只测这一条。

`/tmp/seg1/site-before` 若已被清掉（中途重装系统、`rm /tmp` 等），别用现网的 `_site` 顶替：在 `head-before.txt` 那个 commit 上开 worktree 重跑一次 Task 1 Step 1，或者干脆承认基准丢失、把这一条的结论写成"未实测"并留给用户判断。

- [ ] **Step 4: 零重叠之三——提交边界，别人的 commit 里不许有本段的文件**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
HEAD_BEFORE=$(cat /tmp/seg1/head-before.txt)
git log --oneline "$HEAD_BEFORE"..HEAD
for c in $(git log --format='%h' "$HEAD_BEFORE"..HEAD); do
  git show --name-only --format= "$c" \
    | grep -E '^(dev/js/tools/|scripts/(fixtures/|build-region-data|build-id-fixture|toolkit-tests)|assets/data/)' \
    | sed "s|^|commit $c 含本段文件：|"
done
git status --porcelain
```

Expected：`git log` 里本段那几条的 subject 全部带 `(tools)` 作用域；中间的 `for` 循环**不打印任何"含本段文件"行**；最后的 `git status --porcelain` 为空（或只剩别人正在改的文件）。

这一条防的是真实存在的事故形状：本仓库的 `deploy-github.sh` 里有 `git add .`，第二个会话提交时可以把本段暂存到一半的文件一起吞进它那个"fix(blog)" 提交——文件内容上了车，但归属、message、回滚点全都错了位。真出现"含本段文件"行时，别改历史：`git show <c>:<path> | shasum -a 256` 与磁盘上的比对一下，内容一致就在计划末尾的修订记录里落一行"该文件随 commit `<c>` 入库"，不一致则停下来报告。

- [ ] **Step 5: 收口**

本任务正常情况下不产生提交（Step 1 全部还原，Step 2–4 只读产物）。若 `git status` 里有遗留，说明某步没还原干净，逐条查清再动手：`_site`、`assets/*.min.*`、`/tmp` 之外的任何改动都不该由这个任务留下。

---

## 第一段的完成定义

五条全中才算完：

1. `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` → `# pass 28`、`# fail 0`、`exit=0`。
2. Task 8 Step 1 四条变异各自让预期那几条判据变红，且还原后复绿。
3. `pnpm build` 后 `assets/**/*.min.*` 的 29 条哈希与开工基线逐字节一致。
4. `bundle exec jekyll build` 产物里按路径关键字归因为零命中。
5. `git log` 上本段的提交边界干净：没有本段文件出现在别人的 commit 里。

**这一段做完，站点上看不到任何变化**——没有新页面、没有新产物、没有配置改动。它交付的是四样别人要依赖的东西：两张区划码表、两套校验算法、一份对拍夹具、一个面板状态机，加上"许可已复核"这件事本身。页面、样式、导航与 JSON 工作台全在段 2–4，`demo/idCardDemo/` 的删除与版本号在段 5。

---

## 2. 后续段落：范围与验收（**本轮不落手**）

用户对本轮的边界写得很明确：「本轮只执行到第一段……后续段落只列计划不落手」。所以下面四条**不是可执行任务清单**，是四段各自的范围与"什么才算完"。每段开工前必须各自另出一份同规格的计划（同样逐判据、同样带自证），不要拿这一节当计划直接做。

设计文档 §12 原本把 `tools-idcard.html` 的两块面板列在第 1 段，本计划把它挪进段 2，理由见 §0 倒数第二条：页面接线要动 `headAssets.html` 与 `header.html`，那是与 §4.3 导航判据耦合的共享文件，同一页面被两个会话各改一半的代价远高于段 1 少一个可见产物。

### 段 2：证件页收口

- **范围**：`tools-idcard.html`（或按设计文档 §6.2 的命名）+ `dev/js/toolIdcard.js` 装配层（把 `panel.js` 的属性表写进 DOM、接 `hashchange`/`keydown`、`history.replaceState`）+ `#idcard`/`#uscc` 两块面板 + `#bankcard`/`#mobile`/`#random` 三块（含 Luhn 与运营商前缀表、随机姓名/地址/邮箱）+ `dev/sass/tools-idcard.scss` 与主题接色 + `postcss.config.js` 的 `selectorBlackList` 加 `.tk-`/`.jt-` + 三处入口（header 下拉、`tools.html` 小节、`index-all.html`）+ 收录面（`sitemap.xml`、`llms.txt`、`USAGE.md` 计数）。
- **依赖本段的哪一样**：`panel.js` 的 `tabAttr/panelAttr/toHash/keyAction` 是装配层唯一的属性来源；`idcard.js`/`uscc.js` 的 `USE_NOTE`、`REFERENCE_NOTE`、`caveat` 是页面文案唯一来源——页面里再写一份"仅供参考"就是违约。
- **验收**：设计文档 §8.2 第 1、3、5、6 条全绿（`.is-current` 抽查现有页面逐字节一致那条不能跳）；`node --test` 加上 §8.1 里银行卡/手机号那两组判据；`datasetVersion: '2022-10-31'` 在页面上可见（§2.2 第 ① 条）。
- **已知会踩的坑**：`px-to-viewport` 的 `mediaQuery: true` 意味着只抽查一条规则不够，必须按 §8.2 第 5 条在**产物 CSS** 里查 `vw` 残留；导航高亮判据动的是全站共享的 `header.html`，改完要抽查而不是只测新页。

### 段 3：编码工具箱页

- **范围**：第二页五块面板（时间戳 / Base64 / URL / MD5+SHA / 正则）与 `dev/js/tools/{timestamp,base64,url,digest,regex}.js` + 该页样式与断点。
- **依赖**：直接复用 `panel.js`（前缀仍是 `tk-`）；页面装配层与段 2 同构，若两份装配代码长到 100 行以上，抽 `dev/js/tools/panel-dom.js` 而不是复制。
- **验收**：§8.1 摘要组（MD5 对 RFC 1321 全量官方向量、SHA 系列与 Node `crypto` 逐条对拍）+ 正则组（灾难性回溯必须有上限并明确拒绝）；§8.2 三页断言里属于本页的那几条。
- **坑**：`digest` 的 UTF-8 与 `base64` 的中文（`atob` 直接抛），必须在模块层处理而不是页面里 try/catch 兜。

### 段 4：JSON 工作台页

- **范围**：`json-core`（格式化/压缩/错误定位）→ `json-tree` → `json-ts` → `json-convert`（JSON↔YAML/XML/CSV），每块跟自己的判据；**唯一新增依赖 `js-yaml`** 与 `pnpm-lock.yaml`；`package.json` 登记 `test:tools` 脚本（本计划 §1 里那条"不动 `package.json`"到此解除）；`toolJson.scss` 与工作台布局（行号栏、等宽字号）。
- **依赖**：`.jt-` 前缀在段 2 已进黑名单，本段只验证；`panel.js` 若本页也用同样的索引条，前缀传 `jt` 即可（`D1` 已把这条钉进判据）。
- **验收**：§8.1 JSON 组（20 个坏样本逐个断言**行列号**而不是"抛错"、键序稳定、pointer `~0`/`~1` 转义）+ 互转三对往返深比较 + 5MB / 200 层嵌套的真实传输字节实测（§8.3 第 7 条）。
- **坑**：新增依赖必然动 `pnpm-lock.yaml`，那是另一个会话高频改动的文件——先 `git log -1 -- pnpm-lock.yaml` 看有没有并行改动，装完只 stage 这一份锁文件，别 `git add .`。

### 段 5：收尾

- **范围**：删 `demo/idCardDemo/` 与 `demo.json` 里那条（§10 覆盖性已论证为严格超集，用户已授权）+ §10 两个连带项（`vite.demo.config.js` 文件头那句"实测仅 catDemo、idCardDemo 幸存"必须改写；接受 404 不做跳转页）+ §8.3 浏览器实测全量 + 版本三处同步 2.2.0（`_config.yml`、`package.json`、`CHANGELOG.md`）+ 完整评审。
- **依赖**：夹具 `scripts/fixtures/id-validator-checkbit-1000.json` 与 `scripts/build-id-fixture.mjs` 里那份自包含的 mulberry32 是**删完旧库之后唯一的长期守卫**——旧库不在了，对拍对象变成 1,000 条冻结样本而不是现算，这件事必须在 §8.1 与夹具生成器注释里都写着。
- **验收**：§8.2 全量（含"排除条目生效"与"全站无 404 内链"）+ §8.3 七条 + 五条完成定义里段 1 那三条仍然成立（产物零重叠这条在删完 demo 后必然要重新基线，届时以段 5 的开工快照为准）。
- **坑**：删除是不可逆动作且 `deploy-github.sh` 的 `git add .` 会把删除一起吞进别人的提交——删除与提交在同一步做完，并且删之前先跑一次"它真的没被引用"的全库 grep 复证。

---

## 3. 修订记录

- **2026-09-25 初稿（本文件）**，覆盖第一段。写计划过程中对设计文档做的 6 处修订已同步落到 `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`，条目与理由见 §0 的表。
- **Task 1 Step 1 的基线从"文件名清单"改成"SHA-256 清单"**：`assets/js/*.min.js` 与 `assets/css/*.min.css` 都被 `.gitignore:9-10` 排除、文件名不带 contenthash，只比名字证明不了内容没变。实测 2026-09-25 共 29 个 `*.min.*`。
- **§B/§C 测试里的导入路径**：起草时写成 `./dev/js/tools/…`，而测试文件在 `scripts/` 下，正确写法是 `../dev/js/tools/…`。这条是原型跑测暴露的，不是读出来的。
- **随机源抽成 `dev/js/tools/random.js`**：原稿让 `uscc.js` 去 `import` `idcard.js` 里的 mulberry32——同级模块互相依赖，将来谁改种子语义都会暗伤对方。夹具生成器里那份副本**故意独立**（重跑要字节级不变），已写进 §1。
- **§C 的 C5 批量样本换成全自洽码**：草稿里那条 `R_ZERO` 的第 17 位与内层校验位不自洽，批量判 `valid` 必红；换成 `913501000000001660`（余数 0 那一档、且内层自洽）。换的时候顺手把常量计数注释从 12 改 13、C4 里写死的 16 位字面量改成 `R_ZERO.slice(0,16)`。
- **`uscc.js` 的 `caveat` 条件从只认 `uncoded` 改成 `abolished || uncoded`**：历史码 `ok=true`，漏一句措辞不会红在结构上、只红在文案上，所以判据必须直接断言那句话（C6）。这也是 Task 8 变异 M4 的来源。
- **Task 8 的四条 sed 已用计划正文抽出的代码块实跑核验**：每条匹配唯一（`grep -c` 变异前后 1↔1），M4 还原后两文件其余 5 处 `abolished` 用法仍在，说明 sed 的匹配范围没有溢出到 `regionOk` 判断与 `detail` 措辞。
- **面板模块的构造参数 `prefix` 与 `toHash()` 返回 `''` 的两种形状，是原型阶段收敛出来的**：草稿里 `move()` 混用过 `.active` 与 `.active()`、`D4` 少一个 `});`，`node --test` 一次就抓到了。§D 判据 5 条在 `/tmp` 里跑过 `# pass 5 / # fail 0` 才抄进本文件。
- **Task 1 落地后按质量复核改了 `SOURCES.json` 的四条口径**（数据一字未动，四份快照的 `bytes`/`sha256`/`count` 全部复算不变）：① `ref` 与三份 `url` 从可前进的 `master` 换成 pin `6fb5380de7e6…`（tag `2.7.0`，实测三份字节与该 pin 全等），Task 3 的 `REMOTE` 同步换，`--fetch` 因此不可能拉到与记录不符的字节；② `license` 从 `"WTFPL-2.0"` 改成接口真给的 `WTFPL`；③ `licenseVerifiedVia: "…(HTTP 200)"` 换成 `licenseEvidence`，把结论挂到原文哈希上——一次成功的 HTTP 请求不是证据；④ `historical.licenseTextAt` 说清站内只有声明、MIT 的版权行与全文只在上游 `MIT-LICENSE`，Task 7 必须逐字抄。另注：`SOURCES.json` 仍由脚本生成，改的是计划里那段脚本。
- **§A 判据按质量复核加固五处，其中一条审查建议被有据否决**（`scripts/toolkit-tests.mjs` 与计划正文同步，回抽 diff 仍逐字节相同）：① `TODAY` 从 `new Date(Date.UTC(2026,8,25))` 改成字符串 `'2026-09-25'`——`idcard.js` 的 `toDay()` 对 Date 走本地分量，实测 `TZ=America/Los_Angeles` 下那个 Date 就是 09-24，而 §B 另有十几处直接传字符串，两种基准会随时区翻脸；② A4 的 `assert.match(out, /一致/)` 是假闸门（"不一致"含子串"一致"，实测 stub 打 `与快照不一致` 仍 `# pass`），改成 `/与快照一致/` 加一条 `doesNotMatch(/不一致/)`；③ A5 末行只扫 4 个抽样对象，升格为对全部现行县级 + 全部历史码扫 `fullName`；④ A6 那两行"从快照独立数一遍"里，`provinceCode==='11'` 那行被 `cityCode==='1101'` + 写死的 16 完全蕴含（北京只有一个市辖区），且两行用的都是生成器同一个判据，换成 `Map` 预聚合的逐市对账（实测 342 个 cityCode 两表全等、无孤儿、无空市，O(n)）；⑤ A2 的跨层互斥集补上 `省+'0000'` 形态、`b.note` 改 `b.note ?? ''` 并补 message。**否决 `describe` + `before()` 分段隔离**：实测 suite 形状下失败用例的 `not ok` 行是缩进的（`    not ok 2 - A2`），而 Task 8 Step 1 的四条变异判据全部按行首 `^not ok <用例名>` 锚定，改了就会只看到组名、点名不到该红的判据；`# pass` 计数倒是不变（实测两种形状都是 `# pass 3`），所以这条纯粹是判据形状冲突，代价与理由已写进测试文件头注释。
- **开工基线里有一个已归因的外部漂移，Task 8 Step 2 会撞上它**：`/tmp/seg1/assets-sha-before.txt` 录于 12:11，第二个会话 12:14 改了 `dev/js/editorial.js`、12:16 重建，`assets/js/editorial.min.js` 现为 `b18d9155…` 而基线里是 `a2e11cbd…`。本段一行代码都没落地（Task 1 只新增 4 份 JSON + 1 份清单，不碰 `dev/`、不碰 Vite 入口），所以**按 Step 2 既有的归因流程处理，不重录基线**：`git log --oneline $(cat /tmp/seg1/head-before.txt)..HEAD -- dev/` 查不到本段对该文件的改动，再 `git status --porcelain dev/js/editorial.js` 见到它是 `M`（别人未提交的改动）即可判定与本段无关，把这一条 diff 单独写进结论。`head-before.txt` 与 `git-before.txt` 保持不动。
