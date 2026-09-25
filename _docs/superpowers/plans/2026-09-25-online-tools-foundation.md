# 博客在线工具页 · 第一段（地基）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`（下称"设计文档"）交付第 1 段——区划码表生成器 + 两层码表 + 身份证 / 统一社会信用代码算法模块 + 面板框架的纯状态机 + Node 测试骨架，每条判据可复现、可变红。

**Architecture:** 数据与逻辑分层：`scripts/fixtures/region-source/` 是四份**仓库内快照**（三份 modood 现行表 + 从站内旧 `GB2260.js` 抽出的 2015 口径表），`scripts/build-region-data.mjs` 把快照编译成 `dev/js/tools/region-data.js`（纯数据、确定性字节），手写的 `dev/js/tools/region.js` 负责解析与六档回落链（§5.4 的六档），`idcard.js` / `uscc.js` 只依赖 `region.js` 的返回结构。测试跑在 Node 22 内置 test runner 上：不依赖 DOM、不依赖网络、不新增依赖。

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
| §7 | 区划表预算 30KB → 34KB → **36KB**，并补实测数字 | 30KB 是估的；实测 100,020B 原始 / 34,807B gzip，34KB 那条只剩 9 字节余量，挡不住 gzip 参数抖动 |
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
新增  dev/js/tools/region.js                              手写：解析 + 六档回落 + 现行码集合
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
 * "不联网"的准确口径：全部用例只碰 127.0.0.1，且 A10/A11 在跑之前先把生成器副本里的
 * 上游 URL 换掉（A10 指向一个没人听信的端口，A11 指向本文件自己起的临时服务器）。
 * 换没换成由 rewriteUpstreamUrls 数命中条数钉住的——replace 匹配不到时静默返回原串，
 * 实测那样做 A10 会"因为 DNS 挂了"而假绿。
 * 仓库里的 scripts/fixtures/region-source/ 与产物一份都不写：A7–A11 全在 tmpdir 副本上跑，
 * 每条用例结尾都比对"仓库快照与产物的字节没被动过"——A7/A8/A9 那三条由两个 helper
 * （runGeneratorOn / importRegionWithPatchedSource）逐条兜，A10/A11 另外自己点名断言。
 *
 * 运行：
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs
 * 判断成败看退出码，不要用 `| tail` 之后的 $?（管道会吞退出码）。
 *
 * 用例分布（后续每段往这个文件里加，不另起测试入口）：
 *   §A 区划码表 —— 生成物结构与六档回落（§2.2 / §5.4）；A7–A11 另测生成侧的输入闸门
 *                （`assertShape` 那四道在内）与读侧载入自检有没有牙，A12 测六个读入口的入参口径是否还是同一套
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
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { execFileSync, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const execFileAsync = promisify(execFile);

/** 固定"今天"，让年龄与日期上限类判据可复现。必须是字符串：idcard 的 toDay() 对 Date
 *  走本地分量，`new Date(Date.UTC(2026,8,25))` 在 TZ=America/Los_Angeles 下是 09-24，
 *  而 §B 里另一批用例直接传 '2026-09-25'——两种基准会随跑测试的时区翻脸。 */
const TODAY = '2026-09-25';

// ── §A 区划码表 ────────────────────────────────────────────────────────────

const { REGION_META, resolveRegion, provinceCodes, currentCityCodes,
  currentCountyCodes, historicalCodes, isGeneratable, provinceName, cityName }
  = await import('../dev/js/tools/region.js');

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

test('A3 产物体积在预算内（gzip ≤ 36KB，设计文档 §7）', () => {
  const gz = gzipSync(Buffer.from(read('dev/js/tools/region-data.js'))).length;
  // 实测同一份字节（2026-09-25，100,020B 原文 / 34,807B gzip）：level 6→9 差 194B（34,613B），
  // 这就是 36KB 预算吸收的全部压缩器抖动。它吸收不了 strategy：Z_FILTERED 在默认 level 下是
  // 37,082B，比 36,864B 的预算高 218B，真出现那种 zlib 参数就应当红着（level 9 + Z_FILTERED 是
  // 36,843B，勉强过）。
  // 抬预算不等于放宽口径。"退回朴素 JSON.stringify 会不会红"这句必须连着构造一起给，
  // 因为反解回行对象的写法有好几种，字节随构造浮动：只让 counties 多带一个 provinceCode，
  // 原文就从 262,233B 涨到 321,793B，而 L6 只从 47,559B 涨到 49,510B——涨的是重复键名，
  // gzip 压掉了大半。上一版抄在这里的 260,533B / 47,443B / 44,425B 正是栽在这上面：把那三个
  // 数的候选写法摊成网格复算（四表各自的列集与键序 × 历史层五种取法 × 四种包裹方式，320 格），
  // 最接近的原文只有 262,183B，那一版压根没有对应构造，已删。
  // 下面两版是照着构造跑得出来的（输入 = scripts/fixtures/region-source/ 的四份快照，
  // 历史层走生成器 build() 里 curCounty/curCity/curProv 三个 Set 那道按层级查现行的判据，
  // 得 1,229 条 = 1,159 县 + 70 市）：
  //   单对象 {provinces,cities,counties,historical}，行形状 provinces{code,name} /
  //     cities{code,provinceCode,name} / counties{code,cityCode,name} / historical{code,name}
  //     —— 262,233B 原文 / 47,559B(L6) / 44,578B(L9)
  //   同形状但快照原样 stringify（counties 连 provinceCode 一起带上、键序按快照、
  //     历史层是 3,465 条全量）—— 451,217B / 66,821B / 62,819B
  // 但"朴素编码必超预算"是半句假话：第一版只去掉历史层剩三表是 189,401B / 34,475B /
  // 32,309B，朴素编码照样过得了预算。超的量具体出在那 1,229 条历史码上（同构造下朴素口径
  // 多 13,084B gzip）。所以这条判据咬的是"编码退回朴素 **且** 数据仍然带着历史层"这一整件
  // 事，不是单独一种口径变化——想让它红，砍历史层或换编码方式都只挪动一半。
  assert.ok(gz <= 36 * 1024, `区划表 gzip ${(gz / 1024).toFixed(1)}KB 超预算`);
});

test('A4 生成物是确定性字节：重跑 --check 必须说一致', () => {
  // 用 process.execPath 而不是字面量 'node'：本机 /usr/local/bin/node 是 v16 残留，
  // 谁把 PATH 顺序改一下，生成器就会被 Node 16 执行，报出的 bad option 会被误读成生成器的 bug。
  const out = execFileSync(process.execPath, ['scripts/build-region-data.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  // 必须是「与快照一致」而不是「一致」：后者是前者的子串，"不一致"也能匹配上，等于没闸
  assert.match(out, /与快照一致/);
  assert.doesNotMatch(out, /不一致/);
});

test('A5 六档回落链每一档的结论（样本全部 2026-09-25 实读自快照）', () => {
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
  // fullName 那一句测不到历史层的 level：region.js 里历史码的 level 是按码尾算的
  // （0000→province / 00→city / 其余→county），而它同时决定 note 用「所属地市」还是
  // 「该区划」、county 字段挂不挂名。把整条 ternary 硬编码成 'county' 之后
  // 12 条判据一条都不红（实测），所以这里三样各钉一条。
  const laiWu = resolveRegion('371200');
  assert.equal(laiWu.level, 'city', '莱芜市是历史市级，不是历史县级');
  assert.equal(laiWu.status, 'abolished');
  assert.match(laiWu.note ?? '', /^所属地市/, '历史市级必须说「所属地市」，不能说「该区划」');
  assert.equal(laiWu.county, '', '市级历史码不得把市名挂进 county');
  assert.match(resolveRegion('110103').note ?? '', /^该区划/, '县级历史码反过来，不得说「所属地市」');
  // §5.4 那句「不得断言已撤销建制」此前只是文档里的话，代码改一个字都不许红。三样各钉一条：
  // 括号里必须是**现行表的截止日**（历史层 2015 口径不在这句文案里）、不许出现"已撤销"、
  // 尾句必须是"可能是"而不是"通常是"（四种成因没做逐条统计，"通常是"是编不出来的话）。
  const histNote = resolveRegion('110103').note ?? '';
  assert.match(histNote, /未见于现行区划表（截止 2022-10-31）/, histNote);
  assert.doesNotMatch(histNote, /已撤销/, '历史层命中不得断言「已撤销」（§5.4）');
  assert.match(histNote, /可能是/, '成因只能给可能性：' + histNote);
  // 历史层里省级形（XX0000）实测 0 条，上面那条 ternary 的 province 分支在当前产物下不可达。
  // 留着它的理由：--fetch 换进来的旧表完全可能带省本级条目（历史层的码形闸门只要求 6 位数字）。
  // 所以这条断言测的不是那个分支，是把"它现在不可达"钉成一件会变红的事。
  assert.equal(historicalCodes().filter((x) => x.endsWith('0000')).length, 0,
    '历史层出现了省级形的码：那条 province 分支从没测过的代码变成必须测的代码，补判据再放行');

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

  // 第五档"自己哪一档都不在、只有父级市在历史层"（region.js 的 histCity 分支）。
  // 整档此前零判据：把它删掉之后 12 条判据一条都不红（2026-09-25 实测），而 371299 从
  // abolished/city「山东省莱芜市」退成 uncoded/province「山东省」——用户看到的是省名，
  // 建制结论整档丢了。3712 是 2019 年并入济南的莱芜市市码，现行市级表没有它，
  // 而 371299 这个「市码+99」连旧表里也没有，所以全链条只有这一档接得住。
  const underHistCity = resolveRegion('371299');
  assert.deepEqual(
    { s: underHistCity.status, l: underHistCity.level, n: underHistCity.fullName },
    { s: 'abolished', l: 'city', n: '山东省莱芜市' },
    '市级父码在历史层这一档必须独立成立，不得退到省级回落');
  assert.match(underHistCity.note ?? '', /^所属地市/, '这一档走市级的半句文案');
  assert.equal(underHistCity.county, '', '这一档没有县级名可挂');

  // 同一段地名不得在fullName里出现两次。快照实读两类共 19 条：
  //   市名==县名 4 条（441900 东莞市、442000 中山市、460400 儋州市、620201 嘉峪关市）；
  //   县名本身以市名开头 15 条（130272「唐山市汉沽管理区」挂在 1302 唐山市 下等，
  //   全是 2022 口径里的功能区）。朴素拼接给出「广东省东莞市东莞市」「河北省唐山市唐山市
  //   汉沽管理区」。整改前把剥离那一行摘掉，12 条判据一条都不红——那 19 条既不在 A5 的
  //   抽样里，A5 的全表扫描又只查「未知」。现在摘它红的是 A5 一处（`# pass 11 / # fail 1`）。
  assert.equal(resolveRegion('441900').fullName, '广东省东莞市');
  assert.equal(resolveRegion('620201').fullName, '甘肃省嘉峪关市');
  assert.equal(resolveRegion('130272').fullName, '河北省唐山市汉沽管理区');
  assert.equal(resolveRegion('410773').fullName, '河南省新乡市平原城乡一体化示范区');
  // 前缀剥离只剥得掉重复的那一段：同一个市下不以市名开头的县，名字一个字都不许少
  assert.equal(resolveRegion('130204').fullName, '河北省唐山市古冶区');
  assert.equal(resolveRegion('130207').fullName, '河北省唐山市丰南区');
  for (const code of [...currentCountyCodes(), ...historicalCodes()]) {
    const { fullName } = resolveRegion(code);
    assert.doesNotMatch(fullName, /(.{2,})\1/u, `${code} 的全名有相邻重复：${fullName}`);
  }

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

// ── §A 生成器与解析器的闸门（A7 输入形状 / A8 哈希清单 / A9 载入自检 / A10 参数白名单
//     / A11 --fetch 成功路径 / A12 读侧入参口径）──
//
// A1–A6 检查的是"产物对不对"，这一组检查的是"闸门还在不在"。这些闸门此前大多只有人肉
// 遵守过，实测每一道都能安静放过一种坏数据（各用例注释里写明了是哪一种）。

/** 仓库里的快照目录、生成器与产物路径。闸门用例一律在 tmpdir 的副本上跑：
 *  scripts/fixtures/region-source/ 是哈希钉死、git 跟踪的可复现输入，动一下就没了。 */
const FIXDIR = resolve(HERE, 'fixtures/region-source');
const GENERATOR = resolve(HERE, 'build-region-data.mjs');
const ARTIFACT = resolve(ROOT, 'dev/js/tools/region-data.js');
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * 仓库侧的写入指纹：四份快照（连 SOURCES.json 一起）与生成物。
 * 判据全在 tmpdir 副本上跑，但"跑在副本里"这件事本身没人验过——A10/A11 各自在结尾断言，
 * 而 A7/A8/A9 用同一套 helper 却没人断言。这里把它下沉进 helper，让文件头那句
 * "每条用例结尾都断言仓库字节没被动过"从陈述变成机器读得过的事实。
 * @returns {{artifact:string, fixtures:Object<string,string>}}
 */
function repoFingerprint() {
  return {
    artifact: readFileSync(ARTIFACT, 'utf8'),
    fixtures: Object.fromEntries(
      readdirSync(FIXDIR).sort().map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))]),
    ),
  };
}

/** 与 repoFingerprint 的起点比对，红就说明某条判据往仓库里写了东西 */
function assertRepoUntouched(before, who) {
  const now = repoFingerprint();
  assert.deepEqual(now.fixtures, before.fixtures, `${who} 动过仓库里的快照`);
  assert.equal(now.artifact, before.artifact, `${who} 动过仓库里的产物`);
}

/** 把 SOURCES.json 里四条快照声明的 sha256/bytes 按磁盘现状重算。
 *  A7 必须先过这一道：不重封清单，生成器红在「快照哈希不符」，与被测的形状闸门无关，等于没测。
 *  A8 反过来要的是"不重封"，所以这条由 runGeneratorOn 的 seal 开关控制，不在改写函数里顺手做。 */
function reSealAll(fixDir) {
  const manifestPath = resolve(fixDir, 'SOURCES.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const entry of manifest.files.concat([manifest.historical])) {
    const buf = readFileSync(resolve(fixDir, entry.file));
    entry.sha256 = sha256Of(buf);
    entry.bytes = buf.length;
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** 改一份 JSON 快照（areas / cities / gb2260 通用） */
function patchJson(fixDir, file, mutate) {
  const p = resolve(fixDir, file);
  const data = JSON.parse(readFileSync(p, 'utf8'));
  mutate(data);
  writeFileSync(p, JSON.stringify(data));
}

/** 找出一段 JSON 里的某条记录（县级/市级行用 code 字段，历史层用键本身） */
function findRow(data, code) {
  const hit = Array.isArray(data) ? data.find((x) => x.code === code) : data[code];
  assert(hit !== undefined, `快照里没有 ${code} 这一条，注入无从下手`);
  return hit;
}

/**
 * 生成器源码里那三个上游 URL 的形状，A10/A11 的重定向共用这一个模式。
 * 带 g 标志：既要数命中，也要一次换干净。
 */
const UPSTREAM_URL = /https:\/\/raw\.githubusercontent\.com[^'\s]+/g;

/**
 * 造一个 mutateGenerator：把副本里的上游 URL 全换成 repl 给的目标。
 * 必须数命中条数。`String.replace` 匹配不到时静默返回原串，重定向就成了"没发生也没人知道"，
 * 而 A10/A11 声称验的是"重定向之后的抓取行为"。实测把生成器里的域名换成
 * raw.github.example.com（重定向归零）之后只有 A11 红，A10 整条照旧全绿：它"抓不到所以不许
 * 改文件"那一格变成靠 DNS 解析失败蒙对的，与重定向有没有生效再无关系。
 * @param {(url:string)=>string} repl 逐个 URL 的替换目标
 * @returns {(src:string)=>string} 交给 makeTmpRepo 的生成器改写函数
 */
function rewriteUpstreamUrls(repl) {
  return (src) => {
    const hits = src.match(UPSTREAM_URL) ?? [];
    assert.equal(hits.length, 3, `副本源码里的上游 URL 命中 ${hits.length} 处，这两条判据假设的是 3 处`);
    return src.replace(UPSTREAM_URL, repl);
  };
}

/**
 * 把四份快照 + 生成器复制进一个临时仓库根。生成器用 import.meta.url 推 ROOT，
 * 所以产物只会落在 tmp 里，仓库的 region-data.js 一个字节都不碰。
 * @param {{withArtifact?:boolean, mutateGenerator?:(s:string)=>string}} [opts]
 *   withArtifact 预先把当前产物拷一份过去（--check 那条要知道"本来是一致的"）；
 *   mutateGenerator 改写副本源码，A10 用它把 --fetch 的三个 URL 换成不可能听的网络地址，
 *   这样这条判据在联网与断网两台机器上跑出的结果完全一样。
 */
function makeTmpRepo({ withArtifact = false, mutateGenerator = (s) => s } = {}) {
  // 先算改写结果再建目录：rewriteUpstreamUrls 会抛，那时候还没留下任何待清的 tmpdir
  const genSrc = mutateGenerator(readFileSync(GENERATOR, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'region-gate-'));
  const fixDir = resolve(tmp, 'scripts/fixtures/region-source');
  mkdirSync(fixDir, { recursive: true });
  for (const f of readdirSync(FIXDIR)) copyFileSync(resolve(FIXDIR, f), resolve(fixDir, f));
  const gen = resolve(tmp, 'scripts/build-region-data.mjs');
  writeFileSync(gen, genSrc);
  const artifact = resolve(tmp, 'dev/js/tools/region-data.js');
  // 输出目录一律先建好：生成器的写分支只管 writeFileSync，不建目录的话"没目录"会被误读成闸门红
  mkdirSync(dirname(artifact), { recursive: true });
  if (withArtifact) copyFileSync(ARTIFACT, artifact);
  return { tmp, fixDir, gen, artifact, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/**
 * 在临时副本上跑一次生成器（默认就是"生成 / 覆盖"那一支），报告退出码、输出与有没有落盘。
 * @param {(fixDir:string)=>void} [corrupt] 对副本动手的函数，默认什么都不做
 * @param {{seal?:boolean, withArtifact?:boolean}} [opts] seal=false 时故意留着旧清单，
 *   用来测哈希闸门本身（A8）
 */
function runGeneratorOn(corrupt = () => {}, { seal = true, withArtifact = false } = {}) {
  const before = repoFingerprint();
  const repo = makeTmpRepo({ withArtifact });
  let result;
  try {
    corrupt(repo.fixDir);
    if (seal) reSealAll(repo.fixDir);
    let code = 0;
    let text = '';
    try {
      text = execFileSync(process.execPath, [repo.gen], { cwd: repo.tmp, encoding: 'utf8' });
    } catch (e) {
      code = typeof e.status === 'number' ? e.status : -1;
      text = `${e.stderr ?? ''}${e.stdout ?? ''}`;
    }
    result = {
      code,
      // 未捕获异常的输出前面是"文件:行号 + 源码行 + 栈"，只留 Error: 之后的正文，
      // 免得断言被 build-region-data.mjs 自身的行号漂移牵动
      out: text.replace(/^.*\bError: /gm, ''),
      wroteArtifact: existsSync(repo.artifact),
      artifactSameBytes: existsSync(repo.artifact)
        && readFileSync(repo.artifact, 'utf8') === readFileSync(ARTIFACT, 'utf8'),
    };
  } finally {
    repo.cleanup();
  }
  assertRepoUntouched(before, 'runGeneratorOn');
  return result;
}

/** 在 tmpdir 里造一份"改过的产物"再 import region.js，看读侧那道载入自检拦不拦。
 *  region.js 只 `import './region-data.js'`，所以把两个文件放进同一个临时目录：
 *  region-data.js 是被改过的那份，region.js 是仓库原件。A9 因此既不改判据也不碰仓库产物。
 *  @param {(src:string)=>string} patchSrc 对产物整份源码的改动
 *  @returns {Promise<{loaded:boolean, err:string}>} loaded 为 true 说明自检漏了 */
async function importRegionWithPatchedSource(patchSrc) {
  const before = repoFingerprint();
  const tmp = mkdtempSync(join(tmpdir(), 'region-read-'));
  const dir = resolve(tmp, 'tools');
  let result;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'region-data.js'), patchSrc(readFileSync(ARTIFACT, 'utf8')));
    copyFileSync(resolve(ROOT, 'dev/js/tools/region.js'), resolve(dir, 'region.js'));
    try {
      await import(resolve(dir, 'region.js'));
      result = { loaded: true, err: '' };
    } catch (e) {
      result = { loaded: false, err: String(e && e.message ? e.message : e) };
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  assertRepoUntouched(before, 'importRegionWithPatchedSource');
  return result;
}

/** 只改产物里某张表（`export const NAME = '…'`）的原文，其余字节不动。
 *  生成器的 q() 禁止数据里出现单引号，所以这一段整体就是 /'[^']*'/。 */
const patchTable = (exportName, mutate) => (src) => {
  const re = new RegExp(`(export const ${exportName} = )(')([^']*)\\2;`);
  const m = re.exec(src);
  assert(m, `产物里找不到 ${exportName} 这一段`);
  return `${src.slice(0, m.index)}${m[1]}'${mutate(m[3])}';${src.slice(m.index + m[0].length)}`;
};

test('A7 生成器的输入闸门：十种坏形状各自独立被拒，且点名到码与闸门', () => {
  // 十条各打一道不同的规则，不让它们互相顶包（同一道规则的两个分支算两道，见市/县那两条
  // 引用完整性）：名称闸门（缺字段 / 空串 / null）、码类型闸门、历史层码形闸门（5 位键，
  // 分隔符检查看不见它）、父子码前缀闸门（名字全对，只有分组依据坏了）、父码引用完整性闸门
  // （父码形状对、前缀也对，但表里没有那个父亲）、分隔符闸门（形状全对，只有名称里带了
  // 编码格式用的标点——去掉 assertNoDelimiters 那一次调用，只有第 7 条会红）。
  // 每条注入后都重封 SOURCES.json，所以红的一定是形状闸门而不是哈希闸门。
  const cases = [
    // [注入, 改哪份快照, 怎么改, 报错必须点名的码, 报错必须出现的那道闸门/表名]
    ['县级行删掉 name 字段', 'areas.json', (d) => { delete findRow(d, '110102').name; }, '110102', '县级'],
    ['县级行的 name 是空字符串', 'areas.json', (d) => { findRow(d, '110105').name = ''; }, '110105', '县级'],
    ['历史层某条的值是 null', 'gb2260-2015.json', (d) => { d['110224'] = null; }, '110224', '历史层'],
    ['历史层出现 5 位键', 'gb2260-2015.json', (d) => { d['11022'] = d['110224']; delete d['110224']; }, '11022', '历史层'],
    ['市级行的父码对不上', 'cities.json', (d) => { findRow(d, '1101').provinceCode = '99'; }, '1101', '父级码应逐字等于'],
    // 这一条打的不是"父码不相等"，而是"父码短了一位还算不算相等"：'1' 是 '1101' 的合法前缀，
    // 原本那道 startsWith 会放行，只有逐字等式拦得住。实测注入它之后旧闸门 exit 0、
    // 12 条判据全绿，产物里 currentCityCodes('11') 是空数组（1101 挂到了 '1' 名下）。
    ['市级行的父码只剩一位：前缀成立、位数不成立', 'cities.json',
      (d) => { findRow(d, '1101').provinceCode = '1'; }, '1101', '父级码应逐字等于'],
    ['县级名里带全角逗号：形状全对，只有分隔符违规', 'areas.json',
      (d) => { findRow(d, '110108').name = '海淀区，北京'; }, '110108', '名称含分隔符'],
    // 码必须是字符串。`String(row.code)` 会把数值 1101 洗成合法的 '1101' 过掉码形正则，
    // 可 §build 那三个"查现行"的集合存的是原始值（Set 里有数字 1101、没有字符串 '1101'），
    // 于是旧表里的 110100 按市级查不到，凭空多出一条历史码。实测注入之后生成器 exit 0，
    // 红的是 A1「historical: 1230 期望 1229」与 A2「110100 同时出现在两层」两道条数/层级判据
    // （A7 也红，但红在它自己的 findRow 助手找不到 1101 那行，与闸门无关），
    // 没有一道的报错说得出"1101 这一行的 code 类型不对"。（读侧看不出任何异常：110100 照样解成北京市。）
    ['市级行的 code 是数值：String() 洗白、按层级查现行时漏配', 'cities.json',
      (d) => { findRow(d, '1101').code = 1101; }, '1101', '码不是字符串'],
    ['县级行的父码表里根本没有：形状对、引用悬空', 'areas.json',
      (d) => { d.push({ code: '119901', name: '孤儿区', cityCode: '1199', provinceCode: '11' }); },
      '119901', '不在市级表'],
    // 引用完整性那道有两个分支（市查省、县查市），各钉一条才谈得上"独立被拒"：只留县那一条，
    // 删掉市那个 for 循环没有任何判据会红。这一条的父码 '99' 与 code 前 2 位逐字相等，
    // 前缀等式那道拦不住它，只有"表里到底有没有这个父亲"拦得住。
    ['市级行的父码形对、等式也对，可省级表里没有 99', 'cities.json',
      (d) => { d.push({ code: '9901', name: '新设市', provinceCode: '99' }); }, '9901', '不在省级表'],
  ];
  for (const [what, file, mutate, code, gate] of cases) {
    const r = runGeneratorOn((fix) => patchJson(fix, file, mutate));
    assert.notEqual(r.code, 0, `${what}：生成器竟然退出 0，坏数据会一路编进产物`);
    assert.equal(r.wroteArtifact, false, `${what}：已经判定拒绝，却还是落了盘`);
    assert.doesNotMatch(r.out, /快照哈希不符/, `${what}：红的是哈希闸门而不是形状闸门，等于没测到`);
    assert.match(r.out, new RegExp(`\\b${code}\\b`), `${what}：报错没点名 ${code}`);
    assert.match(r.out, new RegExp(gate), `${what}：报错没指认是哪张表/哪道闸门（${gate}）`);
  }
  // 正向对照：同一套闸门必须放过干净快照，且产物字节与仓库里那份逐字节相同。
  // 少了这一句，上面十条可以是因为"怎么跑都红"而变绿。
  const clean = runGeneratorOn();
  assert.equal(clean.code, 0, `干净快照被拒：${clean.out}`);
  assert.equal(clean.artifactSameBytes, true, '干净快照生成的产物与仓库产物不是同一份字节');
});

test('A8 清单哈希的两条消费路径都盖住历史层快照，人读注解字段与真实字节一致', () => {
  const manifest = JSON.parse(read('scripts/fixtures/region-source/SOURCES.json'));
  const declared = new Map(manifest.files.map((f) => [f.file, f.sha256])
    .concat([[manifest.historical.file, manifest.historical.sha256]]));
  // 路径一：写进产物的 REGION_META.sha256。清单里历史层那一条是被 .concat([[码, 哈希]])
  // 追加进数组的，"简化"成 .concat([码, 哈希]) 之后 Object.fromEntries 会把两个字符串按字符
  // 拆开，得到 {"g":"b"} 这种键：产物少一条真哈希、多一条假键，而这条断言立刻红。
  assert.equal(Object.keys(REGION_META.sha256).length, declared.size, 'REGION_META.sha256 条数不对');
  assert.ok(Object.hasOwn(REGION_META.sha256, manifest.historical.file), 'REGION_META.sha256 漏了历史层快照');
  assert.deepEqual(new Map(Object.entries(REGION_META.sha256)), declared, 'REGION_META.sha256 与 SOURCES.json 不同步');
  // 路径二：verifyManifest。只改 gb2260 的字节、故意不重封清单 → 必须点名 gb2260-2015.json。
  // 追加的是一个换行，JSON 照样解析得动，所以这里过的确实只有哈希闸门一道；
  // 把 manifest.historical 那两条 concat 去掉，这一句就红在"退出 0"。
  const r = runGeneratorOn((fix) => {
    const p = resolve(fix, 'gb2260-2015.json');
    writeFileSync(p, Buffer.concat([readFileSync(p), Buffer.from('\n')]));
  }, { seal: false });
  assert.notEqual(r.code, 0, '历史层快照换了字节，verifyManifest 竟然放过');
  assert.match(r.out, /快照哈希不符：gb2260-2015\.json/, '哈希闸门没指到历史层那一份');
  assert.equal(r.wroteArtifact, false, '哈希不符还继续生成产物');
  // 路径三（人读的那一半）：清单里除哈希还有 schema / bytes / count，生成器一个都不看——
  // 它只认 sha256，那是唯一的机器闸门。这三样一旦腐烂就没有任何自动机制会发现，而 §B 的
  // --fetch 流程恰恰要求人照着 bytes 与 count 核对新抓下来的数据，等于把对不上号的注解
  // 当成核对基准。所以这里按真实字节复算：注解字段不进门，但必须与门里的东西一致。
  // 只核 bytes 不核 sha 的反面不成立：bytes 相同而内容不同是可能的，那道由 sha256 管。
  // 不核 historical.extractedFromSha256——那是站内旧副本 demo/idCardDemo/lib/GB2260.js 的哈希，
  // 段 5 删掉 demo 之后这条断言必然挂，而清单里的这个字段是归属证据、不是输入依赖。
  assert.equal(manifest.schema, 1, '清单的 schema 版本变了，读它的判据要一起改');
  for (const e of manifest.files.concat([manifest.historical])) {
    const buf = readFileSync(resolve(ROOT, 'scripts/fixtures/region-source', e.file));
    const table = JSON.parse(buf.toString('utf8'));
    assert.equal(e.bytes, buf.length, `${e.file} 的 bytes 注解与真实字节不符`);
    assert.equal(e.count, Array.isArray(table) ? table.length : Object.keys(table).length,
      `${e.file} 的 count 注解与表里实际条数不符`);
  }
});

test('A9 读侧对产物自检：schema、条数、分隔符漂移，坏一处必须抛', async () => {
  // 正向对照先跑：一个字节都不改必须能加载。否则后面几条"抛了"可以是因为什么都加载不了。
  const clean = await importRegionWithPatchedSource(patchTable('RAW_CITIES', (s) => s));
  assert.equal(clean.loaded, true, `正常产物反而加载不了：${clean.err}`);

  // 截断：在组边界切，字符串完整闭合、语法零告警。此前模块照样加载成功，
  // 浏览器里就是 2,389 个县对着一份声明 2,978 条的元信息，全静默。
  const cut = await importRegionWithPatchedSource(
    patchTable('RAW_COUNTIES', (s) => s.slice(0, s.lastIndexOf('|', Math.floor(s.length * 0.8)))),
  );
  assert.equal(cut.loaded, false, '截掉 20% 的县级表没人报错');
  assert.match(cut.err, /解析出 \d+ 条 counties，元信息声明 2978 条/, cut.err);

  // 分隔符漂移：逗号换成全角冒号，四张表各注入一次。这条测的是"条数一个都不变也拦得住"——
  // 上面截断那条能拦是因为条数变了，而漂移之后的行数照旧（实测摘掉字段闸门再注入，
  // provinces/cities/counties/historical 仍然报出 31/342/2978/1229，四项全对得上元信息），
  // 坏行仍是一条语法完整、看起来正常的记录。省级/市级/历史层三张只有字段闸门看得见，
  // 县级另有 `at < 0` 那道兜着。
  for (const tbl of ['RAW_PROVINCES', 'RAW_CITIES', 'RAW_COUNTIES', 'RAW_HISTORICAL']) {
    const r = await importRegionWithPatchedSource(
      patchTable(tbl, (s) => `${s.slice(0, s.indexOf(','))}：${s.slice(s.indexOf(',') + 1)}`),
    );
    assert.equal(r.loaded, false, `${tbl} 的分隔符被换掉后模块安静加载`);
    assert.match(r.err, new RegExp(tbl), `${tbl}：报错没点名到这张表`);
  }

  // 县级组内的坏项：把某个县的 2 位序号前缀抹掉。上面两道都看不见它——字段闸门只看组头
  // （组头完好），条数自检也看不见（它照样产出一条，只是码变成 1101东城、名字变成空串，
  // COUNTIES.size 仍是 2,978）。这是县级表独有的编码形态（一名多字符、组内空格分隔），
  // 所以只有 token 闸门拦得住，摘掉它 A9 必须红。
  const badToken = await importRegionWithPatchedSource(
    patchTable('RAW_COUNTIES', (s) => s.replace('01东城区', '东城区')),
  );
  assert.equal(badToken.loaded, false, '县级组里少了序号前缀的 token 安静加载，编出了一个假县');
  assert.match(badToken.err, /RAW_COUNTIES/, badToken.err);

  // schema：REGION_META.schema 此前写了没人读，产物换版与解析器不同步时不会有任何反应
  const wrongSchema = await importRegionWithPatchedSource((s) => s.replace('  "schema": 1,', '  "schema": 2,'));
  assert.equal(wrongSchema.loaded, false, 'schema 改成 2 没人报错');
  assert.match(wrongSchema.err, /schema/, wrongSchema.err);
});

test('A10 参数白名单：拼错的开关不得落到生成分支，--check 不许顺手覆盖', () => {
  const repoBytes = readFileSync(ARTIFACT, 'utf8');
  // URL 换成 127.0.0.1:1（没有任何服务会在那儿监听，且不需要外网），
  // 这样 --fetch 那条断言在联网与断网的机器上跑出同一个结果，不会变成随机红的判据。
  const repo = makeTmpRepo({
    withArtifact: true,
    mutateGenerator: rewriteUpstreamUrls(() => 'http://127.0.0.1:1/x.json'),
  });
  const spawn = (...args) => spawnSync(process.execPath, [repo.gen, ...args], { cwd: repo.tmp, encoding: 'utf8' });
  try {
    for (const flag of ['--chek', '--CHECK', '--help', '-h', '--fetchh', '--dry-run']) {
      const r = spawn(flag);
      assert.notEqual(r.status, 0, `${flag} 被当成没写参数，直接跑进生成分支`);
      assert.match(r.stderr, /未知参数/, `${flag} 的报错没说是参数问题：${r.stderr}`);
      assert.match(r.stderr, /用法：node scripts\/build-region-data\.mjs/, `${flag} 的报错没带用法行`);
      assert.equal(r.stdout, '', `${flag} 报错的同时还把产物生成了一遍`);
    }
    // --check 承诺只比对：一致的副本必须绿且不写文件；把副本改成"落后一行"之后必须红，
    // 而且不许"顺手"把它写回一致 —— 那正是 CI 里 --check 失去意义的方式。
    const ok = spawn('--check');
    assert.equal(ok.status, 0, `一致的副本上 --check 却红了：${ok.stderr}`);
    assert.match(ok.stdout, /与快照一致/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '--check 动过一致状态下的产物');
    const staleBytes = `${repoBytes}\n`;
    writeFileSync(repo.artifact, staleBytes);
    const chk = spawn('--check');
    assert.notEqual(chk.status, 0, '--check 在不匹配时退出 0，等于没有闸门');
    assert.match(chk.stderr, /与快照不一致/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), staleBytes, '--check 把比对做成了覆盖');

    // 两个开关互斥：--check 承诺不写文件，--fetch 承诺写快照，同时给必须拒
    const both = spawn('--check', '--fetch');
    assert.notEqual(both.status, 0, '--check --fetch 同时给居然照常跑');
    assert.match(both.stderr, /互斥/);
    assert.match(both.stderr, /用法：node scripts\/build-region-data\.mjs/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), staleBytes, '互斥报错的路上还是改了产物');
    // --fetch 抓不到任何一份时：必须非零退出，且明说没改任何文件；四份快照哈希逐条不变
    const f = spawn('--fetch');
    assert.notEqual(f.status, 0, '--fetch 抓取全失败却退出 0');
    assert.match(f.stderr, /未修改任何文件/, `--fetch 失败时没说没改文件：${f.stderr}`);
    const manifest = JSON.parse(readFileSync(resolve(repo.fixDir, 'SOURCES.json'), 'utf8'));
    for (const entry of manifest.files.concat([manifest.historical])) {
      const buf = readFileSync(resolve(repo.fixDir, entry.file));
      assert.equal(sha256Of(buf), entry.sha256, `--fetch 之后 ${entry.file} 被改过`);
    }
    // 正向对照：不带参数仍然要能生成，且字节与仓库产物一致（白名单不能把默认支路一起关掉）
    const plain = spawn();
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /已生成/);
    assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '默认支路生成的字节变了');
  } finally {
    repo.cleanup();
  }
  assert.equal(readFileSync(ARTIFACT, 'utf8'), repoBytes, '整条 A10 动过仓库里的产物');
});

/**
 * A11：--fetch 的成功路径。A10 只能把 URL 指向一个没人听信的端口，于是它验的是"全失败时
 * 不改文件"——抓取真的成功之后那半段（改写过快照就不生成、退出 1 并给两步说明；形状不过
 * 一个字节都不落）在此之前从没被执行过。这里用一个只监听 127.0.0.1 随机端口的临时 http
 * 服务当真上游，把三个场景都跑起来。不碰外网、不碰仓库里的 fixtures。
 *
 * 两个必须写在一起的约束，缺一条这条判据就变成挂死：
 *   1. 子进程要用**异步** execFile 起。一开始用的 spawnSync，父进程停在系统调用里，
 *      事件循环转不动，那台服务器就永远发不出响应，子进程卡在 fetch() 上——实测
 *      `--test-timeout=6000` 下 A11 恒为 "test timed out after 6000ms"。
 *   2. 显式 timeout 不能省。判据挂死比判据红更糟：红会指名道姓，挂死只让整份 §A 不出结果。
 */
test('A11 --fetch 抓回来的三种上游：一致才生成、变了只写快照、坏形状一个字节都不落',
  { timeout: 20000 }, async () => {
  const files = ['provinces.json', 'cities.json', 'areas.json'];
  const pristine = Object.fromEntries(files.map((f) => [f, readFileSync(resolve(FIXDIR, f))]));
  const server = createServer((req, res) => {
    const key = req.url.replace(/^\//, '');
    if (!Object.hasOwn(server.__body, key)) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(server.__body[key]);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const repoBytes = readFileSync(ARTIFACT, 'utf8');

  /** 把副本里的三个 URL 换成本地假上游，路径末段保持一致（命中条数由 helper 断言） */
  const localUrls = rewriteUpstreamUrls((u) => `http://127.0.0.1:${port}/${u.split('/').pop()}`);

  /** 跑一次 --fetch。必须异步：父进程要当事件循环里的服务器，spawnSync 会把这条判据挂死 */
  const runFetch = async (repo) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [repo.gen, '--fetch'],
        { cwd: repo.tmp, encoding: 'utf8' });
      return { code: 0, out: `${stdout}${stderr}` };
    } catch (e) {
      return { code: typeof e.code === 'number' ? e.code : -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  try {
    /**
     * 一个场景一份临时副本：body 是"上游此时该回什么"，run 拿到副本与 fetch 结果做断言。
     * @param {Record<string, Buffer>} body 上游响应表
     */
    const scenario = async (body, act) => {
      server.__body = body;
      const repo = makeTmpRepo({ mutateGenerator: localUrls });
      try {
        // 先 await 再起断言：act 是同步的，把未落定的 promise 直接传进去也能跑，
        // 但那样这条判据的正确性就依赖"act 恰好不返回 promise"这一件无关的事
        await act(repo, await runFetch(repo));
      } finally {
        repo.cleanup();
      }
    };
    const hashesOf = (fixDir) => Object.fromEntries(
      files.map((f) => [f, sha256Of(readFileSync(resolve(fixDir, f)))]),
    );

    // S1 上游与本地逐字节一致：不改写快照，直接生成产物，退出 0
    await scenario(pristine, (repo, { code, out }) => {
      assert.equal(code, 0, `上游与本地完全一致时 --fetch 却非零退出：${out}`);
      assert.equal((out.match(/（一致）/g) || []).length, 3, `三份都该报"一致"：${out}`);
      assert.deepEqual(hashesOf(repo.fixDir), Object.fromEntries(files.map((f) => [f, sha256Of(pristine[f])])),
        '一致的场景里快照被改写过');
      assert.ok(existsSync(repo.artifact), '一致时应该接着生成产物');
      assert.equal(readFileSync(repo.artifact, 'utf8'), repoBytes, '一致时生成的产物字节与仓库那份不同');
    });

    // S2 上游多了一条合法新县：只改写那一份快照，不生成产物，退出 1 并给出两步说明
    const grown = JSON.parse(pristine['areas.json'].toString('utf8'));
    grown.push({ code: '110199', name: '判据演练区', cityCode: '1101', provinceCode: '11' });
    await scenario({ ...pristine, 'areas.json': Buffer.from(JSON.stringify(grown)) }, (repo, { code, out }) => {
      const after = hashesOf(repo.fixDir);
      const changed = files.filter((f) => after[f] !== sha256Of(pristine[f]));
      assert.deepEqual(changed, ['areas.json'], `只该改写 areas.json，实际动了 ${changed.join(',')}`);
      assert.equal(existsSync(repo.artifact), false, `快照刚换过、清单还是旧的，居然还是生成了产物：${out}`);
      assert.equal(code, 1, `改写过快照却退出 ${code}：CI 里这一步必须挡住`);
      assert.match(out, /SOURCES\.json/, '没说要同步 SOURCES.json');
      assert.match(out, /重跑 node scripts\/build-region-data\.mjs/, '没说要重跑生成');
      assert.equal(readFileSync(resolve(repo.fixDir, 'SOURCES.json'), 'utf8'),
        readFileSync(resolve(FIXDIR, 'SOURCES.json'), 'utf8'), '--fetch 悄悄把清单也改了（哈希闸门会被自己喂平）');
    });

    // S3 上游回来的内容有坏形状：三份快照一个字节都不动、不生成产物，且明写磁盘没改
    const broken = JSON.parse(pristine['areas.json'].toString('utf8'));
    delete broken.find((x) => x.code === '110102').name;
    await scenario({ ...pristine, 'areas.json': Buffer.from(JSON.stringify(broken)) }, (repo, { code, out }) => {
      assert.notEqual(code, 0, '上游回来的形状是坏的，--fetch 却退出 0');
      assert.deepEqual(hashesOf(repo.fixDir), Object.fromEntries(files.map((f) => [f, sha256Of(pristine[f])])),
        '形状没过的响应已经落盘了');
      assert.equal(existsSync(repo.artifact), false, '坏形状还生成了产物');
      assert.match(out, /磁盘上的快照一个字节都没改/, `没声明磁盘未改：${out}`);
      assert.match(out, /110102/, `报错没点名坏行：${out}`);
      assert.match(out, /县级/, `报错没指认是哪张表：${out}`);
    });
  } finally {
    server.close();
  }
  // 仓库里的 fixtures 是哈希钉死的输入，这条演练一份都不许动
  for (const f of files) {
    assert.equal(sha256Of(readFileSync(resolve(FIXDIR, f))), sha256Of(pristine[f]), `A11 动过仓库快照 ${f}`);
  }
  assert.equal(readFileSync(ARTIFACT, 'utf8'), repoBytes, 'A11 动过仓库里的产物');
});

test('A12 读侧六个入口的入参口径一致，结构非法不得带出派生字段', () => {
  // resolveRegion / isGeneratable / provinceName / cityName 共用 normalizeCode，
  // currentCountyCodes / currentCityCodes 共用 normalizePrefix，两条归一只差一件事：
  // 前缀入口里 '' 的含义是"不收窄、给全表"，所以非字符串只能归一成 null→空集，
  // 归一成 '' 等于把一次类型错误放大成 2,978 条候选地址。除这一处之外，
  // "这算不算一个合法入参"在六个入口只能是同一个答案。此前各处各写各的 String()，实测：
  //   isGeneratable(110101) 为 true 而 resolveRegion(110101) 落 none；
  //   isGeneratable(' 110101 ') 为 false 而 resolveRegion(' 110101 ') 解出北京市东城区；
  //   currentCountyCodes(null) 返回 2,978 条（`null ?? ''` 落进"全表"那一支）；
  //   currentCountyCodes(1101) 返回 16 条而 isGeneratable(1101, 'city') 为 false；
  //   currentCountyCodes(Object.create(null)) 直接抛 TypeError。
  // 本层"任何入参都不抛"是自己定的契约（§5.4 只规定"区划查不到时其余项照常判定"，
  // 那是不能抛的理由，不是"永不抛"这句话的出处）。
  const KEYS = ['code', 'status', 'level', 'provinceCode', 'cityCode', 'countyCode',
    'province', 'city', 'county', 'fullName', 'note'];
  const DERIVED = ['province', 'city', 'county', 'fullName', 'provinceCode', 'cityCode', 'countyCode'];
  const REJECTED = [110101, null, undefined, ['110101'], Object.create(null), {}, '11010', ' 1101 01 ', 'abcdef'];
  // 标签不能用 String(bad)：Object.create(null) 正是在这一步抛
  // "Cannot convert object to primitive value"，判据自己先违反它要守的规矩
  const labelOf = (v) => `${typeof v}:${JSON.stringify(v)}`;
  for (const bad of REJECTED) {
    const label = labelOf(bad);
    const r = resolveRegion(bad);
    assert.deepEqual(Object.keys(r), KEYS, `${label} 的返回形状不是那 11 个键`);
    assert.equal(r.level, 'none', `${label} 应落到 none`);
    assert.equal(r.status, 'unknown', `${label} 应落 unknown，不得给任何建制结论`);
    // 被拒绝的输入旁边挂一个地名，正是这层设计要防的"看着像成功了"
    for (const k of DERIVED) assert.equal(r[k], '', `${label} 被拒了却带出 ${k}=${JSON.stringify(r[k])}`);
    assert.notEqual(r.note, '', `${label} 被拒了但没给出原因文案`);
    assert.equal(r.code, typeof bad === 'string' ? bad.trim() : '', `${label} 的 code 不该回显原文`);
    for (const lvl of ['county', 'city', 'province']) {
      assert.equal(isGeneratable(bad, lvl), false, `${label} 在 isGeneratable(…, '${lvl}') 那里被放行了`);
    }
    // provinceName / cityName 只做"前缀查表"，不做合法性判定：面板会拿 6 位县码问省名，
    // 所以字符串入参即使位数不对也能解出名字（'11010' → 北京市，见下面的显式断言）。
    // 这里要钉住的是它们对非字符串同样不猜——四处共用 normalizeCode，接受口径不能分叉。
    if (typeof bad !== 'string') {
      assert.equal(provinceName(bad), '', `${label} 不该解出省名`);
      assert.equal(cityName(bad), '', `${label} 不该解出市名`);
    }
  }

  // 前缀型入口（收窄候选集，供随机生成用）：非字符串一律空集，一个都不许给全表。
  // undefined 例外，它命中的是默认参数——语义是"没传"而不是"传了个坏值"。
  const FULL_COUNTY = currentCountyCodes().length;
  const FULL_CITY = currentCityCodes().length;
  assert.equal(FULL_COUNTY, 2978, '县级全表条数变了，下面这道"空集 vs 全表"的判据就失去意义');
  assert.equal(FULL_CITY, 342, '市级全表条数变了，同上');
  for (const bad of REJECTED.filter((b) => typeof b !== 'string')) {
    const label = labelOf(bad);
    if (bad === undefined) {
      assert.equal(currentCountyCodes(undefined).length, FULL_COUNTY, `${label} 该走默认参数拿全表`);
      assert.equal(currentCityCodes(undefined).length, FULL_CITY, `${label} 该走默认参数拿全表`);
      continue;
    }
    assert.deepEqual(currentCountyCodes(bad), [], `${label} 必须空集，给全表等于一次类型错误出货 2,978 条地址`);
    assert.deepEqual(currentCityCodes(bad), [], `${label} 必须空集，不给收窄不许回落成全表`);
  }

  // 首尾空白是"同一入参"：六个入口必须一起接受
  for (const padded of [' 110101 ', '\t110101\n']) {
    assert.equal(resolveRegion(padded).level, 'county', JSON.stringify(padded));
    assert.equal(isGeneratable(padded, 'county'), true, JSON.stringify(padded));
    assert.equal(provinceName(padded), '北京市', JSON.stringify(padded));
    assert.equal(cityName(padded), '市辖区', JSON.stringify(padded));
    assert.equal(currentCountyCodes(padded).length, 1, JSON.stringify(padded));
  }
  // 前缀入口同样 trim：不 trim 的话 ' 1101 ' 会被当成 6 位前缀去 startsWith，静默空集
  for (const [padded, bare] of [[' 1101 ', '1101'], ['\t11\t', '11']]) {
    assert.equal(currentCountyCodes(padded).length, currentCountyCodes(bare).length,
      `${JSON.stringify(padded)} 与不带空白的必须同一个答案`);
    assert.equal(currentCityCodes(padded).length, currentCityCodes(bare).length,
      `${JSON.stringify(padded)}：市级入口同理，两个入口不能一个 trim 一个不 trim`);
    assert.ok(currentCountyCodes(bare).length > 0, `前缀 ${bare} 一个结果都没有，这条对照本身坏了`);
  }
  // 前缀只收窄、绝不放宽，两个入口必须是同一个意思。市级入口旧写法把任意长前缀一律
  // `slice(0, 2)` 回去查省索引，实测 currentCityCodes('4419') 给 21 条（整个广东省）
  // 而 currentCountyCodes('4419') 给 1 条——'4419' 在县级入口是"东莞市的县"，
  // 在市级入口却变成"广东省的市"。随机地址面板同时用这两个入口，口径分叉就是错数据。
  // 条数是 2026-09-25 快照实读值，'44' 一档同时钉住"省级前缀仍走省索引"：
  // 收窄不等于把 2 位前缀也当成 4 位码的前缀去筛。
  for (const [p, expect] of [['44', 21], ['441', 8], ['4419', 1], ['44190', 0], ['441900', 0]]) {
    const got = currentCityCodes(p);
    assert.equal(got.length, expect, `前缀 ${p} 的收窄结果不对：${got.join(' ')}`);
    assert.ok(got.every((c) => c.startsWith(p)), `前缀 ${p} 收窄出了不匹配前缀的市码：${got}`);
  }
  assert.deepEqual(currentCityCodes('4419'), ['4419'], '4 位前缀只能收窄到那一个市码');
  // 前缀查表的口径写死在这里，免得哪天被当成"入口漏了校验"顺手收紧掉：
  // 传长码取省名/市名是面板的正常用法，位数不等于建制结论
  assert.equal(provinceName('110101'), '北京市');
  assert.equal(cityName('110101'), '市辖区');
  assert.equal(provinceName('99'), '', '不存在的省码得空串，不许造名字');
  assert.equal(cityName('9901'), '', '不存在的市码得空串，不许造名字');

  // 未知层级不得静默落进市级：旧写法是 `level === 'county' ? 县级表 : 市级表`，
  // 于是 isGeneratable('1101', 'province') 拿 4 位市码查市级表，给出一个看着成立的 true
  for (const lvl of ['town', '', 'state', 'county ', 1, null, {}]) {
    assert.equal(isGeneratable('110101', lvl), false, `未知层级 ${String(lvl)} 必须一律 false`);
    assert.equal(isGeneratable('1101', lvl), false, `未知层级 ${String(lvl)} 不该放行 4 位码`);
  }

  // 全表扫一遍，不接受"只覆盖抽到的那几个码"：每一层的现行码在该层必须是可生成档，
  // 且 resolveRegion 说"解到县级"的码 isGeneratable 必须一起说 true（两个入口的口径
  // 只在这一处有正当分叉：441900 / 442000 / 460400 三个不设区地级市，它们的 4 位市码
  // 在市级表里，"市码+00"在县级表里也有，所以 level 是 county —— 见 isGeneratable 的注释）
  for (const c of currentCountyCodes()) assert.equal(isGeneratable(c, 'county'), true, c);
  for (const c of currentCityCodes()) assert.equal(isGeneratable(c, 'city'), true, `${c} 市级现行码应可生成`);
  for (const p of provinceCodes()) assert.equal(isGeneratable(p, 'province'), true, `${p} 省级现行码应可生成`);
  for (const h of historicalCodes()) {
    assert.equal(isGeneratable(h, 'county'), false, `${h} 历史码永远不进级联`);
    // 市级表存的是 4 位键，6 位历史码即使前 4 位撞上一个现行市，也不能按市级放行
    assert.equal(isGeneratable(h, 'city'), false, `${h} 位数不对，不该在市级档命中`);
  }
  // 与 resolveRegion 的横向一致性：凡 level 为 county 的现行码，两个入口都说可生成
  for (const c of currentCountyCodes()) {
    if (resolveRegion(c).level === 'county') assert.equal(isGeneratable(c, 'county'), true, c);
  }
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
 *   2. 确定性。键按码升序、不写入运行时刻；snapshotFetchedAt 取快照的 fetchedAt，
 *      所以"同一输入 → 同一字节"成立，--check 才有意义。
 *   3. 快照哈希与 SOURCES.json 不符就拒绝生成。数据被悄悄换过比数据旧更危险。
 *
 * 用法（只接受下面两个开关，拼错的参数一律报错退出，见 parseArgs）：
 *   node scripts/build-region-data.mjs            # 生成 / 覆盖
 *   node scripts/build-region-data.mjs --check    # 只比对，不一致退出码 1（测试用例 A4 用这条）
 *   node scripts/build-region-data.mjs --fetch    # 联网刷新三份 modood 快照：抓 → 校验 → 只写快照。
 *                                                 # 与本地逐字节一致时接着生成产物；一旦改写过就不生成、
 *                                                 # 退出码 1（此刻 SOURCES.json 哈希已落后，见上面第 3 条）
 *
 * 三条输入闸门口径（第 1 条由判据 A7 自证，第 2 条由 A10 自证，第 3 条由 A8 自证）：
 *   1. 四份快照逐条过形状与引用两道校验，历史层与现行三层同一套规则：码与名称都必须是"非空
 *      字符串"，父级码必须与该行码的前缀**逐字相等**且**真的在那张表里**。少了名称那道闸，
 *      缺字段的行会被 String() 成 `undefined` 编进产物，读侧解出「北京市undefined」；少了码的
 *      类型闸，数值 1101 同样被 String() 洗成合法码，而 §build 里"按层级查现行"的三个集合存的
 *      是原始值，旧表的 110100 因此凭空多成一条历史码；少了父码存在性那道，孤儿县编进产物之后
 *      只有条数判据会红，且 A9 那句指向"产物被截断"，指错了方向。三样各有独立注入：摘名称闸
 *      红 A7 + A11（`# pass 10 / # fail 2`），摘码类型闸只红 A7 的第 8 条，摘父码存在性闸只红
 *      A7 的第 9、10 条——最后那道的两个分支各钉一条，因为只钉县级那条时删掉市级分支没人红。
 *   2. --fetch 先把三份抓进内存并全部过第 1 条那道闸，才一次性落盘；任何一步失败都不改任何文件。
 *   3. 换数据是两步动作，不是一步：--fetch 写快照 → 人工把新的 sha256/bytes/count 同步进
 *      SOURCES.json → 再跑一次生成器。产物与清单必须同时换版，所以清单哈希不符时拒绝生成。
 *      生成器只认 sha256，bytes / count / schema 三样在门里是惰性的；§B 要求人照着它们核对，
 *      所以 A8 按真实字节复算一遍，注解腐烂即红。
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
const USAGE = '用法：node scripts/build-region-data.mjs [--check | --fetch]';

/**
 * 参数白名单。此前用 `ARGV.includes(...)` 判定，任何未识别的参数（`--chek`、`--CHECK`、`--help`、
 * `--dry-run`）都会静默落到"生成并可能覆盖"那一支且退出 0 —— CI 里一个手打的 `--chek`
 * 就把确定性闸门换成了"重新生成然后宣布全绿"。
 * @param {string[]} argv 去掉 node 与脚本名之后的参数
 * @returns {{check:boolean, fetch:boolean}}
 */
function parseArgs(argv) {
  for (const a of argv) {
    if (a !== '--check' && a !== '--fetch') throw new Error(`未知参数：${a}\n${USAGE}`);
  }
  if (argv.includes('--check') && argv.includes('--fetch')) {
    throw new Error(`--check 与 --fetch 互斥：前者承诺不动任何文件，后者要覆盖快照\n${USAGE}`);
  }
  return { check: argv.includes('--check'), fetch: argv.includes('--fetch') };
}

// 参数闸门在读写任何文件之前生效；用法错只打一行、不打堆栈——手打错一个字母的人
// 要看的是用法行，不是 `parseArgs` 那一段抛栈。
let flags;
try {
  flags = parseArgs(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
const { check: AS_CHECK, fetch: AS_FETCH } = flags;

const REMOTE = [
  ['provinces', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/provinces.json'],
  ['cities', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/cities.json'],
  ['areas', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/areas.json'],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readRaw = (file) => readFileSync(resolve(FIXDIR, file));
const readJson = (file) => JSON.parse(readRaw(file.endsWith('.json') ? file : `${file}.json`).toString('utf8'));

/**
 * 清单里「文件名 → 声明哈希」的四条。verifyManifest 与写进产物的 REGION_META.sha256 必须
 * 出自同一份推导：这两处此前各写了一遍 `.concat([[历史层那一条]])`，任何一边被"简化"成
 * `.concat([a, b])` 都会让历史层快照脱离哈希闸门，而产物里的 sha256 表也会少一项。
 * @param {object} manifest SOURCES.json 解析结果
 * @returns {Array<[string, string]>}
 */
const manifestPairs = (manifest) => manifest.files.map((f) => [f.file, f.sha256])
  .concat([[manifest.historical.file, manifest.historical.sha256]]);

/** 快照与 SOURCES.json 不符就拒绝出货 */
function verifyManifest(manifest) {
  for (const [file, want] of manifestPairs(manifest)) {
    const got = sha256(readRaw(file));
    if (got !== want) {
      throw new Error(`快照哈希不符：${file}\n  期望 ${want}\n  实际 ${got}\n`
        + '若确需换数据：node scripts/build-region-data.mjs --fetch，并同步 SOURCES.json 与设计文档 §2.2 的条数');
    }
  }
}

/**
 * 名称必须是"真正的非空字符串"。全生成器只有这一道名称类型闸门，挂在 assertShape 上：
 * 少了它，`String(undefined)` 会得到 `'undefined'`，一路编进产物变成 `02undefined`，
 * 读侧解出「北京市undefined」这种看着像地名的事实上不是的东西，
 * 而 §A 原有六条判据一条都不会红（实测：删掉 areas.json 里 110102 的 name 并重算清单哈希）。
 * @param {string} code 该行的区划码，只用于把报错指到具体行
 * @param {unknown} name 待校验的名称
 * @param {string} scope 层级名（省级 / 市级 / 县级 / 历史层），出现在报错里
 */
function assertNameString(code, name, scope) {
  if (typeof name === 'string' && name !== '') return;
  const got = name === '' ? '空字符串'
    : name === undefined ? '字段缺失'
      : name === null ? 'null'
        : `类型 ${typeof name}`;
  throw new Error(`${scope} ${code} 的名称不是非空字符串（${got}），拒绝生成`);
}

/**
 * 名称里出现分隔符会让整张表错位解析，必须在生成时挡住。
 * 这里**不再**重复做一遍类型检查：唯一调用方在 assertShape 之后，四张表的 name 已逐行过了
 * assertNameString，所以那一道内层闸门永远不会单独被触发——实测删掉它，12 条判据一条都不红。
 * 一道红不起来的闸门等于没有闸门，还可能反过来误导（让人以为这里另有独立的类型规则）。
 * 类型闸门只有一个家，就是 assertShape；assertNoDelimiters 那道调用本身有牙，
 * 删掉它 A7 的第 7 条（名字里带全角逗号、形状全对）会红。
 */
function assertNoDelimiters(pairs) {
  const bad = pairs.filter(([, name]) => /[|,\s，、；：]/.test(name));
  if (bad.length) {
    throw new Error(`名称含分隔符，编码格式会崩：${bad.slice(0, 5).map(([c, n]) => `${c}:${n}`).join('  ')}`);
  }
}

/**
 * 逐行形状校验。五道：行是对象、码是非空数字字符串、name 是非空字符串、父码逐字前缀，外加码唯一。
 * name 这一道是后补的——此前只查 code，名称的类型问题一路漏到产物里。code 那一道同理由：
 * `String(row.code)` 会先把数值 1101 洗成合法码串，见下面的注释。
 * 父码那一道原本只查 startsWith，位数不足的父码漏过去了，见函数体注释。
 * @param {Array<{code:string, name:unknown}>} rows 待校验行
 * @param {number} len 码的位数
 * @param {string} label 层级名，出现在报错里
 * @param {string} [parentField] 父级码字段名；给了就必须与 code 的前 len-2 位逐字相等
 */
function assertShape(rows, len, label, parentField) {
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error(`${label} 存在非对象行：${JSON.stringify(row)}`);
    // 码的类型闸门必须在 String() 之前，理由与 name 那道一模一样，但后果不一样：
    // 数值 1101 过了 `String()` 之后码形正则、父子码等式、重复码检查全部放行，而 build()
    // 里"按其层级查现行"的三个 Set 存的是原始值（`new Set(cities.map(c => c.code))` 里是
    // 数字 1101，不是字符串 '1101'），旧表里的 110100 因此在市级查不到、凭空多出一条历史码。
    // 实测注入之后生成器 exit 0，产物把 110100 照样解成「北京市」（读侧毫无异常），
    // 判据红的是 A1（historical 1230 期望 1229）与 A2（110100 同时出现在两层）两道条数/层级
    // 检查（`# pass 9 / # fail 3`）；多出来那条红是 A7 自己的 findRow 助手找不到 1101 那行
    // （码成了数值就按字符串匹配不上），不是闸门在说话。三道没有一道的报错说得出
    // "1101 这一行的 code 类型不对"。
    if (typeof row.code !== 'string') {
      throw new Error(`${label} 的码不是字符串：${JSON.stringify(row.code)}`);
    }
    const code = row.code;
    if (!new RegExp(`^\\d{${len}}$`).test(code)) throw new Error(`${label} 码形不对：${code}`);
    assertNameString(code, row.name, label);
    // 父码必须与 code 的前 len-2 位**逐字相等**。这里原本写的是 startsWith，而它挡不住
    // 位数不足的父码：provinceCode 为 '1' 时 '1101'.startsWith('1') 成立，闸门放行，
    // 可读侧是按前 2 位分组的——同一行在生成侧的父亲是 '1'、在读侧是 '11'。
    // 实测注入 provinceCode:'1' 之后生成器 exit 0、12 条判据全绿，产物里
    // currentCityCodes('11') 变成空数组（1101 被挂到了 '1' 名下）。
    // 等式不需要额外的"父码是 len-2 位数字"正则：code 自己已过数字码形，
    // 任何与 code.slice(0, len-2) 相等的值自动就是 len-2 位数字。
    // 父码的类型同样不用单独查：与已过类型闸门的 code 逐字相等的值必然是字符串。
    if (parentField && code.slice(0, len - 2) !== row[parentField]) {
      throw new Error(
        `${label} ${code} 的父级码应逐字等于 ${code.slice(0, len - 2)}，实际是 ${JSON.stringify(row[parentField])}`,
      );
    }
  }
  const codes = rows.map((r) => r.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${label} 存在重复码`);
}

/**
 * 引用完整性：父码"形状对"不等于"父码存在"。这是 assertShape 管不到的一层——它只把
 * parentField 与 code 的前缀比对，两边都是这一行自己的字段，整张表里有没有那个父亲它不知道。
 * 实测注入一条 `{code:'119901', cityCode:'1199'}`（1199 不是任何现行市）之后生成器 exit 0，
 * 产物里 119901 自成一组编进 counties 段，读侧对 119901 给出 uncoded/province「北京市」；
 * 红下来的三道判据报的都是条数，其中 A9 那句是「产物被截断，或编码格式与解析器已经不同步」，
 * 指错了方向。而 §B 的 --fetch 流程本来就要求人在新数据进来时上调 REGION_META.counts，
 * 拿条数当唯一防线等于把这道闸门写在会被顺手改掉的注释里。
 * @param {Array<{code:string}>} provinces 已过形状闸门的省级行
 * @param {Array<{code:string, provinceCode:string}>} cities 已过形状闸门的市级行
 * @param {Array<{code:string, cityCode:string}>} areas 已过形状闸门的县级行
 */
function assertParentsExist(provinces, cities, areas) {
  const provCodes = new Set(provinces.map((p) => p.code));
  const cityCodes = new Set(cities.map((c) => c.code));
  // 先市后县：县码的父码是市码，市码的父码是省码，报错时不必让人自己去查是哪一层悬空
  for (const c of cities) {
    if (!provCodes.has(c.provinceCode)) {
      throw new Error(`市级 ${c.code} 的父级码 ${c.provinceCode} 不在省级表里，拒绝生成`);
    }
  }
  for (const a of areas) {
    if (!cityCodes.has(a.cityCode)) {
      throw new Error(`县级 ${a.code} 的父级码 ${a.cityCode} 不在市级表里，拒绝生成`);
    }
  }
}

/**
 * 四份快照的输入闸门，现行三层与历史层同一套规则。
 * --fetch 拿到的候选内容也过这同一个函数，"能过校验"与"能进产物"因而不是两套判定。
 * @param {{provinces:unknown, cities:unknown, areas:unknown, legacy:unknown}} data 四份数据：
 *   三份 modood 表必须是数组，历史表必须是对象。缺这一道，限流页返回的 `{message:"..."}`
 *   会让 assertShape 的 `for (const row of rows)` 抛一句和输入毫无关系的迭代器 TypeError。
 */
function assertInputShape({ provinces, cities, areas, legacy }) {
  for (const [label, table] of [['省级', provinces], ['市级', cities], ['县级', areas]]) {
    if (!Array.isArray(table)) throw new Error(`${label} 快照不是数组，拒绝生成`);
  }
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
    throw new Error('历史层快照不是对象，拒绝生成');
  }
  // 历史层此前是 Object.entries() 裸消费的：`legacy['110224'] = null` 条数不变，
  // 任何按条数的判据都看不见它，产物里却编进 `110224,null`，读侧解出 fullName「null」；
  // 5 位键同样能过，然后由 region.js 按 00/0000 后缀猜层级。所以形状规则与现行三层同一条。
  const legacyRows = Object.entries(legacy).map(([code, name]) => ({ code, name }));
  // 顺序是"先形状、再引用、后分隔符"：assertShape 带层级名（县级 110102 …），报错能指到是
  // 哪张表的哪一行；引用完整性那道要等三张表都过了形状才查得到"父亲在不在"；
  // assertNoDelimiters 只拿到 (码, 名) 对，说不了层级，所以排最后。
  // 三道各有独立的注入：去掉 assertNoDelimiters 那次调用，A7 只有第 7 条（名字里带全角逗号、
  // 形状全对）会红；去掉 assertShape 里的父码逐字等式，红的是第 5、6 条；去掉
  // assertParentsExist，红的是第 9、10 条；去掉 code 的类型闸门，红的是第 8 条。
  assertShape(provinces, 2, '省级');
  assertShape(cities, 4, '市级', 'provinceCode');
  assertShape(areas, 6, '县级', 'cityCode');
  assertShape(legacyRows, 6, '历史层');
  assertParentsExist(provinces, cities, areas);
  assertNoDelimiters(
    [...provinces, ...cities, ...areas].map((x) => [x.code, x.name])
      .concat(legacyRows.map((x) => [x.code, x.name])),
  );
}

function build(manifest) {
  const provinces = readJson('provinces');
  const cities = readJson('cities');
  const areas = readJson('areas');
  const legacy = readJson('gb2260-2015.json');

  assertInputShape({ provinces, cities, areas, legacy });

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
    sha256: Object.fromEntries(manifestPairs(manifest)),
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

/**
 * --fetch 的抓取段：三份全部进内存 → JSON.parse → 过与离线生成同一套输入闸门，
 * 只有全通过才一次性落盘。
 *
 * 旧实现是循环里边抓边 writeFileSync、verifyManifest 在循环之后才跑，于是「200 + HTML 的
 * 限流页」会直接覆盖 git 跟踪的可复现输入，中途一次网络错误还会留下半新一半旧的一组输入。
 * @returns {Promise<number>} 实际改写的快照份数（0 表示上游与快照逐字节一致）
 */
async function fetchSnapshots() {
  const legacy = readJson(manifest.historical.file);
  const staged = new Map();
  for (const [name, url] of REMOTE) {
    let buf;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      throw new Error(`抓取失败 ${name}：${e.message}\n  ${url}\n未修改任何文件。`);
    }
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      // 限流页 / HTML 会以 200 回来，这一道就是把它挡在磁盘之外
      throw new Error(`${name} 的响应不是合法 JSON（多半是限流页）：${e.message}\n`
        + `  响应前 120 字节：${JSON.stringify(buf.subarray(0, 120).toString('utf8'))}\n未修改任何文件。`);
    }
    staged.set(name, { buf, data });
  }
  try {
    assertInputShape({
      provinces: staged.get('provinces').data,
      cities: staged.get('cities').data,
      areas: staged.get('areas').data,
      legacy,
    });
  } catch (e) {
    // 闸门与离线生成共用，所以这里只补一句"落盘还没发生"，不复述规则
    throw new Error(`${e.message}\n  校验的是抓回来的新内容，磁盘上的快照一个字节都没改。`);
  }
  for (const [name] of REMOTE) {
    const { buf } = staged.get(name);
    const before = readRaw(`${name}.json`);
    process.stdout.write(`${name}: ${before.length}B → ${buf.length}B ${sha256(buf).slice(0, 12)}`
      + `${buf.equals(before) ? '（一致）' : '（有变化）'}\n`);
  }
  let changed = 0;
  for (const [name, { buf }] of staged) {
    if (!buf.equals(readRaw(`${name}.json`))) {
      writeFileSync(resolve(FIXDIR, `${name}.json`), buf);
      changed += 1;
    }
  }
  return changed;
}

// --fetch 只要改写过快照，SOURCES.json 的哈希就落后了；此时生成产物等于拿旧清单给新数据背书。
// 所以停在两步流程的第一步：先由人同步 SOURCES.json 与设计文档 §2.2 的条数，再重跑生成。
const changedSnapshots = AS_FETCH ? await fetchSnapshots() : 0;

if (AS_FETCH && changedSnapshots > 0) {
  process.stdout.write(`\n已改写 ${changedSnapshots} 份快照，region-data.js 未生成。\n`
    + '下一步（这一步不能省，产物与清单必须同时换版）：\n'
    + '  1. 把新的 sha256 / bytes / count 同步进 scripts/fixtures/region-source/SOURCES.json\n'
    + '  2. 重跑 node scripts/build-region-data.mjs\n');
  process.exitCode = 1;
} else {
  verifyManifest(manifest);
  const output = build(manifest);
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;

  if (AS_CHECK) {
    if (current === output) {
      process.stdout.write(`region-data.js 与快照一致（${(Buffer.byteLength(output) / 1024).toFixed(1)}KB）\n`);
    } else {
      process.stderr.write('region-data.js 与快照不一致（产物落后于 scripts/fixtures/region-source/）\n'
        + `  产物 ${current === null ? '不存在' : `${Buffer.byteLength(current)}B`} / 期望 ${Buffer.byteLength(output)}B\n`);
      process.exitCode = 1;
    }
  } else if (current === output) {
    process.stdout.write('region-data.js 已是最新，未改写\n');
  } else {
    writeFileSync(OUT, output);
    const { gzipSync } = await import('node:zlib');
    const gz = gzipSync(Buffer.from(output)).length;
    process.stdout.write(`已生成 dev/js/tools/region-data.js：${(Buffer.byteLength(output) / 1024).toFixed(1)}KB 原始 / ${(gz / 1024).toFixed(1)}KB gzip\n`);
  }
}
```

> 顶部 `import { resolve, dirname }` 与函数内用到的 `new RegExp` 循环变量 `label` 无冲突；`assertShape` 里在模板字符串位置用了转义，直接照抄即可。

- [ ] **Step 2: 跑生成器**

```bash
node scripts/build-region-data.mjs
```

Expected: `已生成 dev/js/tools/region-data.js：97.7KB 原始 / 34.0KB gzip`（2026-09-25 实测落盘 100,020 字节 / gzip 34,807B；这两行按字节算，早先写的是 JS 字符串长度，同一份产物会少报一半）。gzip 若超过 36KB：先核对 `counts` 五个数（多半是多算了一层分组），counts 全对而只是产物长胖的，停下来按 §7 重新量一次再决定预算——**不要**顺手把断言改宽或删除。

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
 * 区划码表的读侧：解析生成物、拼三级全名、跑六档回落链（§5.4 的六档，不是四级）。
 * 六档数的是六种结论，不是六个 `if`——历史层那一档有两个入口（码自己、或它的前 4 位父市）。
 *
 * 为什么单独一层：region-data.js 是生成物、只放数据；回落规则（哪一级算命中、
 * 什么时候不下"无效"结论）是设计判断，混进生成文件等于把它写在模板字符串里，
 * 下次重新生成就会冲掉。口径出处：设计文档 §2.2 末尾 / §5.4。
 *
 * 关键一条：查不到县级码 ≠ 号码无效。真实存在的老号码带的是撤销建制的码，
 * 新设区划又可能晚于数据截止日（REGION_META.datasetVersion）。所以这里只返回
 * status，由调用方决定措辞；并且永远不会产出「未知地区」这类文案
 * （站内旧库 id-validator 的实测反面教材，§2.2 末尾）。
 *
 * 还有一条：载入时自检。解析出来的四张索引必须与产物里 REGION_META.counts 逐项相等、
 * schema 必须是 1，否则直接抛——生成器与解析器"改一边必须改另一边"这条约定，
 * 在这之前只有人肉遵守过，机器一次都没验过（产物被截断 20% 都能安静加载）。
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
 * 未见于现行表"那 1,229 条（县级 1,159 + 市级 70，见 REGION_META.historicalLevels），
 * 而集合差里混着好几种东西。下面四种样本 2026-09-25 逐条实读自产物，status 均为 abolished：
 *   真撤销          110103 北京市崇文区（2010 年并入西城区）
 *   随父级一起改名  320801 江苏省淮阴市市辖区（现行 3208 就是淮安市，改的是名不是码）
 *   旧表的市/县口径 110200 北京市县、500300 重庆市(市)（现行表里没有这一档建制行）
 *   旧表的统计口径  460037 海南省西沙群岛
 *
 * 三个数字的分母各不相同，别混用：
 *   1,934  旧表的 6 位键**逐字**出现在现行县级表里的条数；其中 63 条码未变而县名已改
 *          （130502 桥东区→襄都区、150203 昆都伦区→昆都仑区、210112 东陵区→浑南区、
 *          210782 北宁市→北镇市 等）。这 63 条按县级命中，status 是 current，
 *          不在历史层里——本注释早期版本拿它们当历史层样本，是错的。
 *   2,236  REGION_META.legacyHitCurrent，口径是"按其自身层级（XX0000 省 / XXXX00 市 /
 *          其余县）能在现行表命中"，等于 3,465 减上面的 1,229。
 *   1,229  历史层本身。
 * 设计文档 §5.4 原本要求标"已撤销建制（现行码：xxx，若有）"，这里按实测改成诚实措辞，
 * 并同步回填进设计文档。括号里给的是**现行表的截止日**（决定"查不到"这件事的是它），
 * 历史层自己的口径是 GB/T 2015，记在 SOURCES.json 与产物头注释里，不塞进这句文案。
 * 尾句刻意写"可能是"而不是"通常是"：历史层那 1,229 条的四种成因（真撤销 / 随父级改名 /
 * 旧表口径没有这一档 / 统计口径）没有一份逐条统计过，"通常是撤销建制"是编不出来的话。
 */
export function historicalNote(level) {
  const who = level === 'city' ? '所属地市' : '该区划';
  return `${who}未见于现行区划表（截止 ${REGION_META.datasetVersion}），可能是撤销建制、改码或改名`;
}

const PROVINCES = new Map(); // 码2 -> 名
const CITIES = new Map(); // 码4 -> { code, provinceCode, name }
const COUNTIES = new Map(); // 码6 -> { code, cityCode, name }
const HISTORICAL = new Map(); // 码6 -> { code, name, level }
const COUNTY_CODES_BY_CITY = new Map(); // 码4 -> [码6…]
const COUNTY_CODES_BY_PROV = new Map(); // 码2 -> [码6…]
const ALL_COUNTY_CODES = [];

/**
 * 一行按 `,` 切开的字段闸门。生成器写出的四张表字段数是定死的，"这一行切不出 n 段"
 * 本身就是产物坏掉的证据，而且它是**唯一**看得见这件事的地方：2026-09-25 实测把每张表
 * 第一行的逗号换成全角冒号、再摘掉这道闸门，省级 / 市级 / 历史层三份都安静加载成功，
 * 四张索引的条数一个都没动（31 / 342 / 2978 / 1229）——丢分隔符只是让键变成一串垃圾、
 * 名字变成 undefined，条数照旧，所以后面那道与 REGION_META.counts 对表的自检拦不到它。
 * 县级另有下面那道 `at < 0` 兜着（组头切不出市码）。四种漂移如今都在这一处抛，
 * 报错点名到表名与行号。判据 A9 逐张表各注入一次。
 * @param {string} row 原始行
 * @param {number} n 期望字段数
 * @param {string} label 表名，出现在报错里
 * @param {number} i 行号（0 起），出现在报错里
 * @returns {string[]} 长度为 n 的字段数组
 */
function fields(row, n, label, i) {
  const parts = row.split(',');
  if (parts.length !== n || parts.some((p) => p === '')) {
    throw new Error(`region-data.js 的 ${label} 第 ${i} 行解析不出 ${n} 个字段：`
      + JSON.stringify(row.slice(0, 24)));
  }
  return parts;
}

for (const [i, row] of RAW_PROVINCES.split('|').entries()) {
  const [code, name] = fields(row, 2, 'RAW_PROVINCES', i);
  PROVINCES.set(code, name);
}

const CITY_CODES_BY_PROV = new Map();
for (const [i, row] of RAW_CITIES.split('|').entries()) {
  const [code, provinceCode, name] = fields(row, 3, 'RAW_CITIES', i);
  CITIES.set(code, { code, provinceCode, name });
  if (!CITY_CODES_BY_PROV.has(provinceCode)) CITY_CODES_BY_PROV.set(provinceCode, []);
  CITY_CODES_BY_PROV.get(provinceCode).push(code);
}

for (const [i, group] of RAW_COUNTIES.split('|').entries()) {
  const at = group.indexOf(',');
  if (at < 0) {
    throw new Error(`region-data.js 的 RAW_COUNTIES 第 ${i} 组切不出市码：${JSON.stringify(group.slice(0, 24))}`);
  }
  const cityCode = group.slice(0, at);
  const list = [];
  for (const token of group.slice(at + 1).split(' ')) {
    // token 形如 `01东城区`：后 2 位必须是数字，名字不能空——名字空掉时条数照样不变
    if (!/^\d{2}/.test(token) || token.length < 3) {
      throw new Error(`region-data.js 的 RAW_COUNTIES 第 ${i} 组（市码 ${cityCode}）里有坏项：${JSON.stringify(token)}`);
    }
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

for (const [i, row] of RAW_HISTORICAL.split('|').entries()) {
  const [code, name] = fields(row, 2, 'RAW_HISTORICAL', i);
  const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
  HISTORICAL.set(code, { code, name, level });
}

/**
 * 载完就自检：schema 版本必须是 1，四张索引的条数必须与生成器写进产物的 REGION_META.counts
 * 逐项相等。这一层此前是"生成器写了、读侧谁都不看"——实测把 RAW_COUNTIES 截掉 20%（字符串
 * 完整闭合）模块照样加载成功，浏览器里变成 2,389 个县对着一份声明 2,978 个的元信息，全静默。
 * 与上面那道 fields() 是分工不是重复：这里管"少了行"（截断最典型），
 * fields() 管"行数没变但行内坏了"——那种漂移在这里的条数是看不出来的（实测 31/342/2978/1229
 * 一个都不动），两道缺一条就有一类产物损坏安静出货。
 */
const PARSED_COUNTS = {
  provinces: PROVINCES.size,
  cities: CITIES.size,
  counties: COUNTIES.size,
  historical: HISTORICAL.size,
};
if (REGION_META.schema !== 1) {
  throw new Error(`region-data.js 的 schema 是 ${REGION_META.schema}，本解析器只认 1`);
}
for (const [key, got] of Object.entries(PARSED_COUNTS)) {
  const declared = (REGION_META.counts || {})[key];
  if (got !== declared) {
    throw new Error(`region-data.js 解析出 ${got} 条 ${key}，元信息声明 ${declared} 条：`
      + '产物被截断，或编码格式与解析器已经不同步');
  }
}

/** 省 + （非占位的）市 + 县 拼全名 */
function joinNames(provinceCode, cityCode, countyName) {
  const province = PROVINCES.get(provinceCode) || '';
  const city = CITIES.get(cityCode);
  const middle = city && !PLACEHOLDER_CITY.has(city.name) ? city.name : '';
  let tail = countyName || '';
  // 现行县级表里有 19 条的名字与所属市名重叠：4 条完全同名（441900 东莞市 挂在 4419 东莞市
  // 名下），15 条县名以市名打头（130272「唐山市汉沽管理区」，全是 2022 口径里的功能区）。
  // 不剥这段前缀，全名就是「广东省东莞市东莞市」「河北省唐山市唐山市汉沽管理区」。
  if (middle && tail.startsWith(middle)) tail = tail.slice(middle.length);
  return `${province}${middle}${tail}`;
}

/**
 * 入参归一。resolveRegion 与 isGeneratable 共用它，两个入口对同一入参因而不可能给出
 * 互相矛盾的结论（此前 isGeneratable(' 110101 ') 是 false，而 resolveRegion(' 110101 ')
 * 解出东城区；isGeneratable(110101) 是 true，而 resolveRegion(110101) 落到 none）。
 * 只接受字符串并 trim；非字符串归一成 ''，由调用方按结构非法处理。
 * 类型判断必须在任何 String() 之前：`String(Object.create(null))` 抛
 * "Cannot convert object to primitive value"，而本层对外的承诺是永不抛（见 resolveRegion）。
 * @param {unknown} code 任意入参
 * @returns {string} 归一后的码串，非字符串入参得到 ''
 */
function normalizeCode(code) {
  return typeof code === 'string' ? code.trim() : '';
}

/**
 * 前缀型入参的归一，与 normalizeCode 同一条类型规则，但非法时给 null 而不是 ''。
 *
 * 差别是必须的：currentCountyCodes / currentCityCodes 里 '' 的含义是"不收窄、返回全表"，
 * 所以把 null / 数值 / 对象归一成 '' 等于把一次类型错误放大成 2,978 条候选地址。
 * 实测改之前：`currentCountyCodes(null)` 返回 2,978 条（`null ?? ''` 落到"全表"那一支），
 * `currentCountyCodes(Object.create(null))` 直接抛，`currentCountyCodes(1101)` 返回 16 条
 * 而 isGeneratable(1101, 'city') 为 false——同一份数字，两个入口一个认一个不认。
 * @param {unknown} prefix 任意入参
 * @returns {string|null} 字符串 trim 后的前缀；非字符串为 null，调用方返回空集
 */
function normalizePrefix(prefix) {
  return typeof prefix === 'string' ? prefix.trim() : null;
}

/**
 * 结构非法时的返回值：11 个键一个不少，但除 code 与 note 全为空。
 * 这个形状是本层自己定的契约（不是 §5.4 写的——§5.4 只规定"区划查不到时其余项照常判定"，
 * 那正是这里不能抛、也不能少键的理由）。此前这道分支照抄入参切片，于是
 * resolveRegion(110101) 在给出 level:'none' 的同时挂着 province「北京市」与
 * countyCode「110101」——被拒绝的数字旁边显示一个地名，正是这层设计要防的"看着像成功了"。
 * @param {string} c6 归一后的码串（非字符串入参传 ''）
 * @returns {ReturnType<typeof resolveRegion>}
 */
function rejectRegion(c6) {
  return {
    code: c6, status: 'unknown', level: 'none',
    provinceCode: '', cityCode: '', countyCode: '',
    province: '', city: '', county: '', fullName: '',
    note: '行政区划码应为 6 位数字字符串',
  };
}

/**
 * 解一个 6 位行政区划码。供身份证与统一代码两个面板共用。
 * §5.4 定的是回落链的六档顺序与 `level` 的四档取值（county / city / province / none），
 * 以及"区划查不到时其余项照常判定"；下面这套 11 个键的形状是本层自己定的。
 * 永不抛异常：任何形状的入参都拿到同一套键。
 *
 * @param {unknown} code 6 位行政区划码。只接受字符串（首尾空白会被 trim），
 *   数值、对象等即使位数合法也按结构非法落 level:'none'，且不带任何派生字段
 * @returns {{
 *   code:string, status:'current'|'abolished'|'uncoded'|'unknown',
 *   level:'county'|'city'|'province'|'none',
 *   provinceCode:string, cityCode:string, countyCode:string,
 *   province:string, city:string, county:string, fullName:string, note:string
 * }}
 */
export function resolveRegion(code) {
  // 第一道闸门是类型，而且是函数第一条语句：任何属性访问与转换都在它后面
  if (typeof code !== 'string') return rejectRegion('');
  const c6 = normalizeCode(code);
  // 码串按字符串处理，数值入参即使位数合法也拒绝：Number 表达不了前导零，
  // 静默 String(110101) 解出地名会把调用方的类型错误藏成一次"成功解析"。
  if (!/^\d{6}$/.test(c6)) return rejectRegion(c6);

  const provinceCode = c6.slice(0, 2);
  const base = {
    code: c6, status: 'unknown', level: 'none',
    provinceCode, cityCode: c6.slice(0, 4), countyCode: c6,
    province: PROVINCES.get(provinceCode) || '', city: '', county: '',
    fullName: '', note: '',
  };

  // 优先级：现行县级 → 现行市/省级（6 位形如「市级码+00」）→ 历史层 → 市级回落（含父码的
  // 历史层命中）→ 省级回落 → 落空。§5.4 的"六档"数是六种结论，不是六个 if：父码那一档
  // 给出的结论与历史层同型（abolished/city），只是被查的码换成前 4 位。
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
  // 自己两表都不在、只有父级市在历史层：371299（莱芜市 3712 已并入济南，现行市级表没有它）。
  // 少这一档它退成 uncoded/province「山东省」，建制结论整档丢失，所以 A5 单独钉着。
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
 * 入参只接受字符串（trim 后比较），非字符串得到空集而不是全表——见 normalizePrefix。
 */
export function currentCountyCodes(prefix = '') {
  const p = normalizePrefix(prefix);
  if (p === null) return [];
  if (p === '') return ALL_COUNTY_CODES.slice();
  if (p.length === 2) return (COUNTY_CODES_BY_PROV.get(p) || []).slice();
  if (p.length === 4) return (COUNTY_CODES_BY_CITY.get(p) || []).slice();
  return ALL_COUNTY_CODES.filter((c) => c.startsWith(p));
}

/**
 * 现行市级码集合，按前缀收窄（统一代码的区划段只到地市，用这条）。
 * 前缀只收窄、绝不放宽：'4419' 问的是东莞市那一个市码，不是广东省那 21 个。
 * 早先这里把任意长前缀一律 `slice(0, 2)` 回去查省索引，于是 currentCityCodes('4419')
 * 给 21 条而 currentCountyCodes('4419') 给 1 条——同一个"前缀"在两个入口是两种意思。
 * 位数超过 4 的前缀在该层必然无匹配，返回空集而不是整省。
 */
export function currentCityCodes(provinceCode = '') {
  const p = normalizePrefix(provinceCode);
  if (p === null) return [];
  if (p === '') return [...CITIES.keys()].sort();
  if (p.length <= 2) return (CITY_CODES_BY_PROV.get(p) || []).slice().sort();
  return [...CITIES.keys()].filter((c) => c.startsWith(p)).sort();
}

export function provinceCodes() {
  return [...PROVINCES.keys()].sort();
}

export function historicalCodes() {
  return [...HISTORICAL.keys()].sort();
}

/**
 * 层级名 -> 该层的现行索引 + 该层存键的位数（县级 6、市级 4、省级 2）。
 * 一个层级只在这里出现一次：早先是 TIER_LEN / TIER_INDEX 两张平行表，
 * 加一档层级时只改一边就会得到「len 有、index 没有」的 TypeError，
 * 而这是给浏览器直接调的导出函数。
 */
const TIERS = {
  county: { len: 6, index: COUNTIES },
  city: { len: 4, index: CITIES },
  province: { len: 2, index: PROVINCES },
};

/**
 * 该码能否作为生成地址（只有现行表的三级可以，历史码永不算）。
 *
 * 与 resolveRegion 共用 normalizeCode，所以两条入参规则完全一致：只接受字符串、同样 trim。
 * 此前这里 `String(code)` 直通，于是 isGeneratable(110101) 为 true 而 resolveRegion(110101)
 * 落 none、isGeneratable(' 110101 ') 为 false 而 resolveRegion 解出东城区，两条入口互相打脸。
 *
 * 但问的问题不同，别当成同一件事：本函数问「这个码是不是 level 这一级的现行码」，
 * 查的是该层自己的成员；resolveRegion 的 level 说的是「这 6 位整体解析到哪一级」。
 * 两者只在三个不设区的地级市上分叉（4419 东莞 / 4420 中山 / 4604 儋州，2026-09-25 实读全表
 * 仅此三条）：那三个 4 位市码在市级表里存在，而各自的「市码+00」在县级表里也有一条，
 * 所以 resolveRegion('441900').level 是 county。
 * @param {unknown} code 候选码，字符串，位数须与该层存键位数一致
 * @param {'county'|'city'|'province'} [level] 期望层级，默认县级。
 *   未知层级一律 false——此前 'province' 会静默落进市级分支，给出一个看着成立的错误答案
 * @returns {boolean}
 */
export function isGeneratable(code, level = 'county') {
  const tier = TIERS[level];
  if (!tier) return false;
  const c = normalizeCode(code);
  return c.length === tier.len && tier.index.has(c);
}

/** 省码 -> 省名；面板做三级级联时直接用。非字符串入参得到 ''，不做 String() 猜测 */
export function provinceName(code) {
  return PROVINCES.get(normalizeCode(code).slice(0, 2)) || '';
}

/** 市码 -> 市名（现行表存 4 位市码，传 6 位县级码取其前 4 位） */
export function cityName(code) {
  const c = CITIES.get(normalizeCode(code).slice(0, 4));
  return c ? c.name : '';
}
```

- [ ] **Step 5: 跑测试**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `# pass 12`、`# fail 0`、`exit=0`。（A1–A6 是产物本身对不对，A7–A12 是那几道闸门还有没有牙——生成侧的输入形状、清单哈希、参数白名单、`--fetch` 写入顺序，读侧的产物自检与六个入口的入参口径；本段落地时先有 A1–A6，A7–A12 由 Task 3 的质量复核补进来，见 §3 修订记录。）

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
| `150203199003070017`（旧表昆都伦区，现行昆都仑区） | true | 内蒙古自治区包头市昆都伦区 | 现行名 | renamed |
| `990101199003070015` | false | false | 结构非法 | 不取样（省码不存在） |
| `110101199003073504`（末位错） | false | false | 校验位不符 | 单独用例，不进批量 |
| 17 位 / 19 位 / 14 位 | false | false | 结构非法 | B3 |
| 内部含空格 | false | false | 结构非法（只 trim 首尾） | B3 |
| `11010119900307002x`（末位小写 `x`） | true | 北京市东城区 | trim + 大写后接受 | agree18 |
| `11010190030700A`（15 位末位字母） | **true** | 北京市东城区 | 结构非法 | B3（写进判据，不进夹具） |

最后一条是旧库的真实缺陷：`checkArg` 只校长度并大写化、`checkOrder` 恒真、15 位又没有校验位算术，字母混进去没人拦。

`renamed` 这一组是实读出来的：旧表的 6 位键逐字出现在现行县级表里的有 1,934 条（含 441900 东莞、442000 中山那两条「市码 + 00」），生成器按"排除 xx00 键"的口径取到的是 **1,932** 条，其中 **63 条码相同而县名不同**（`130502` 桥东区→襄都区、`210112` 东陵区→浑南区、`210782` 北宁市→北镇市、`150203` 昆都伦区→昆都仑区 等）。这意味着两件事：① 同结论组的样本**只能从"两边全名逐字相等"的那 1,776 条里取**，否则"两边地址名必须相等"这条判据会因数据版本差异而误红；② `region.js` 里历史层的措辞不能写成"已撤销建制"——这 63 条没撤销，只是改名。Task 3 的 `historicalNote()` 就是为此存在。

①那一句在实现轮被实测推翻过一次（2026-09-25 实现轮回填）：只按"县名相同"筛会得到 1,869 条，其中 **93 条两边全名必然不等**——县名没变，旧表里的市名或省名是旧口径（1406「晋城市」实为朔州市、3208 淮阴市→淮安市、4206 襄樊市→襄阳市、6203「嘉峪关市」实为金昌市、65xxxx 多写一个"族"字）。所以同名池的判据换成"省名 + 市名(非占位段) + 县名三段各自与快照一致"，筛出 1,776 条；`renamed` 组随之是 156 条，两组的断言方向都不必放宽。这份口径只用三份快照，不读 `region.js`——否则就成了让被测侧自己挑样本。

这 156 条的**成因是三类不是两类**（第四轮回填，见 §4.11 的 I-7）：62 条县名自己改过、93 条县名没变而旧表那一段市名/省名是 2015 年前的旧口径、1 条（`620201` 嘉峪关市）旧表在市级码下挂的是「甘肃省嘉峪关市**市辖区**」占位条，谁也没改名。上一轮把它记成"63 条改县名 + 93 条改市名/省名"，那 1 条被塞进了"改县名"那一档；上面 2051 段那句"63 条码相同而县名不同"仍然成立——它是按"旧串不以现行县名结尾"数的，`620201` 的旧串确实不以「嘉峪关市」结尾，但那一段是市级占位名而不是县名。


**所以"对拍"绝不能写成"两个实现结论必须完全一致"**：那样要么把上面几类分歧判成 bug，要么逼我们把判据写松。夹具的做法是**把分歧登记成组，每组各自断言方向**——同结论组守住"不许无故变红"，异结论组守住"分歧只朝我们更严 / 我们更新这两个方向，且只由指定的那一项否决引起"。

### 4.1 Step 1：写夹具生成器

`scripts/build-id-fixture.mjs` 只在开工时跑一次（段 5 按 §10 删掉 `demo/idCardDemo/`，届时旧库不在了，夹具自身成为长期守卫）。它读仓库内的三份现行快照（省 / 市 / 县）+ 一份旧表快照 + 旧库，产出自带旧库结论的 JSON；带 `--check` 幂等模式；任何一组的不变量不成立就直接抛——**宁可生成失败，不产出"看起来对"的夹具**。

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
const USAGE = '用法：node scripts/build-id-fixture.mjs [--check]';
/** 写死而不是取墙钟：每条样本自带 today，判据永不误红于"出生日期晚于今天" */
const TODAY = '2026-09-25';

/**
 * 参数白名单（I-8）。此前全文只有一句 `process.argv.includes('--check')`，于是
 * `node scripts/build-id-fixture.mjs --nope`（或 `--chek` / `--CHECK` / `--help`）
 * 一律被当成"没写参数"，直接落进最后那行 `writeFileSync`——**手打错一个字母就把
 * 只读比对换成了覆盖提交进仓库的产物**，而且退 0。`build-region-data.mjs` 早就为
 * 同一件事加了白名单（由 A10 钉着），本生成器此前一次都没有被任何判据跑过（现由 B14 钉）。
 * @param {string[]} argv 去掉 node 与脚本名之后的参数
 * @returns {{check:boolean}}
 */
function parseArgs(argv) {
  for (const a of argv) if (a !== '--check') throw new Error(`未知参数：${a}\n${USAGE}`);
  return { check: argv.includes('--check') };
}

// 闸门在读写任何文件之前生效；用法错只打一行到 stderr、不打堆栈，且**一个字节都不写**。
let AS_CHECK;
try {
  AS_CHECK = parseArgs(process.argv.slice(2)).check;
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}


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
const provinces = readJson('scripts/fixtures/region-source/provinces.json');
const legacy = readJson('scripts/fixtures/region-source/gb2260-2015.json');

const currentCounty = new Set(areas.map((a) => a.code));
const countyName = new Map(areas.map((a) => [a.code, a.name]));
const currentCity = new Set(cities.map((c) => c.code));
const provinceOf = new Map(provinces.map((p) => [p.code, p.name]));
const cityOf = new Map(cities.map((c) => [c.code, c.name]));
const legacyCounty = new Set(Object.keys(legacy).filter((k) => !k.endsWith('00')));

/** 与 dev/js/tools/region.js 的 PLACEHOLDER_CITY 同口径，独立写一份是故意的：
 *  取样池不许读被测侧，否则 B7 那条"两边地址名必须相等"就成了让读侧自己挑样本、当场自证。 */
const PLACEHOLDER_CITY = new Set(['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划']);

const both = [...currentCounty].filter((c) => legacyCounty.has(c)).sort();
/**
 * 只看三份快照，把"旧表地址串 == 现行省名 + 现行市名(非占位段，且剥掉与县名重叠的前缀)"
 * 当作同名判据。
 *
 * 为什么不能只看县名（计划原先的 `legacy[c].endsWith(countyName[c])`）：2026-09-25 实读，
 * 那样筛出的 1,869 条里有 93 条两边全名必然不等——县名没变，变的是旧表里的市名或省名，
 * 那 93 条是旧表停留在 2015 年之前的口径：1406「晋城市」应为朔州市、3208 淮阴市→淮安市、
 * 4206 襄樊市→襄阳市、6203「嘉峪关市」应为金昌市、65xxxx「新疆维吾尔族自治区」多写一个"族"字。
 * 混进 agree18 只会因数据版本差异误红，而这组的断言方向是"两边一模一样"。
 *
 * `tail.startsWith(middle)` 那一刀（I-7）必须与读侧 `region.js` 的 `joinNames` 同规则：
 * 两边算的不是同一个字符串，"同名池"筛出来的样本就会在 B7 那句
 * `r.info.region.fullName === c.oracleAddr` 上按重叠前缀那一批（实读 19 条：15 条县名以市名
 * 打头的功能区 + 4 条省市县同名，如 441900 东莞市）逐条误红。本轮实测：加与不加，
 * `sameName` 都是 1,776 条、成员一模一样（那 19 条**没有一条同时在 2015 旧表里**，
 * 全是 2022 口径新增），所以这一刀不改变任何一条样本的归属——它堵的是"两份实现算的
 * 不是同一个字符串"这件事本身，而不是一批当下恰好为空的误红。别因为它今天测不出差别就删掉。
 *
 * 本判据筛出 1,776 条；与读侧 `resolveRegion().fullName` 的分叉数在两个方向上都是 0
 * （B7 逐条核过 agree18 的相等、renamed 的不等，双向都钉着）。
 */
const sameNameAsLegacy = (code) => {
  const prov = provinceOf.get(code.slice(0, 2)) || '';
  const city = cityOf.get(code.slice(0, 4)) || '';
  const middle = city === '' || PLACEHOLDER_CITY.has(city) ? '' : city;
  let tail = countyName.get(code) || '';
  if (middle && tail.startsWith(middle)) tail = tail.slice(middle.length);
  return String(legacy[code]) === `${prov}${middle}${tail}`;
};
/** 同码同名（实读 1,776 条）：只有这里的样本允许断言"两边地址名相等" */
const BOTH = both.filter(sameNameAsLegacy).sort();
/** 同码而异名（实读 156 条）：我们给现行名、旧库给 2015 年前后的旧名 */
const RENAMED = both.filter((c) => !sameNameAsLegacy(c)).sort();
/**
 * 156 条按**成因**拆三类（I-7：上一版只记了"两种成因"，实际数字是三种，且把 620201 记错档）：
 *   1. 旧串不以现行县名结尾 → 县名段自己改过（130502 桥东区→襄都区、650107 南山矿区→达坂城区…）
 *      共 63 条；
 *   2. 其中 1 条（620201）旧表在市级码下挂的是「…市辖区」占位条（甘肃省嘉峪关市市辖区），
 *      而现行 620201 的名字就叫「嘉峪关市」——差异来自旧表那条占位尾巴，不是谁改了名；
 *   3. 剩下的 62 条是真正的县名改名，另 93 条县名没变、变的是旧表里的市名 / 省名口径。
 * 拆分规则必须写成可复算的一句话，`pools` 里的三个数之和要等于 RENAMED.length，B7 钉着。
 */
const legacyEndsTail = (c) => String(legacy[c]).endsWith(countyName.get(c));
/** 旧表末段是市级占位名（市辖区 / 省直辖县级行政区划 / …）的那一类：不是"县改名" */
const PLACEHOLDER_TAIL = /(市辖区|省直辖县级行政区划|自治区直辖县级行政区划)$/;
const RENAMED_BY_PLACEHOLDER = RENAMED.filter((c) => !legacyEndsTail(c) && PLACEHOLDER_TAIL.test(String(legacy[c])));
/** 真·县名改过：旧串连现行县名都不以它结尾，且不属上面那类占位尾巴 */
const RENAMED_BY_COUNTY = RENAMED.filter((c) => !legacyEndsTail(c) && !PLACEHOLDER_TAIL.test(String(legacy[c])));
/** 仅现行有、且旧表市级可回落（实读 1,046 条市级在表的那批）：旧库必然吐「未知地区」 */
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
  // 非闰年的 2/29：摇一年，闰年就退一年。**一句就够**，别再往下加第二句——
  // 原先后面跟着一句 `if (isLeap(y)) y -= 2`，那一句永不可达：能被 `-= 1` 摸到的 y 必是
  // 闰年、必是偶数，减一之后是奇数，而闰年要求被 4 整除 ⇒ 奇数年满天下都是非闰。
  // 留着它的唯一效果是让人以为这里还需要第二道兜底（M-13：不可达分支不加判据就等于没有，
  // 而给它加判据又是造一条永绿的断言）。所以这一支删掉，闰律的正面覆盖挪到 B13——
  // 那里 1901..2100 每一年都拿 2/29 试一次，判据一侧独立写一遍闰规则。
  let y = 1901 + Math.floor(rng() * 105);
  if (isLeap(y)) y -= 1;
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
      '地址名取自 2015 年前后的 GB2260：同码异名的 156 条会给旧名（其中 62 条县名自己改过、1 条（620201）旧表挂的是「…市辖区」占位条）',
      '同一份旧表里还有 93 条县名没变、市名或省名却是 2015 年前的旧口径（3208 淮阴市、4206 襄樊市、65xxxx「新疆维吾尔族自治区」等），它们与 renamed 同组',
    ],
  },
  datasetVersion: '2022-10-31',
  seed: 20260925,
  today: TODAY,
  pools: {
    sameName: BOTH.length, renamed: RENAMED.length, onlyCurrent: ONLY_CURRENT.length,
    /** renamed 的成因三分：县名自己改过 / 只有旧表那一段名是旧口径 / 旧表挂的是市级占位条 */
    renamedByCounty: RENAMED_BY_COUNTY.length,
    renamedByLegacyPrefix: RENAMED.length - RENAMED_BY_COUNTY.length - RENAMED_BY_PLACEHOLDER.length,
    renamedByPlaceholder: RENAMED_BY_PLACEHOLDER.length,
  },
  groupCounts: { ...GROUPS },
  total,
  divergencePolicy: 'agree* 必须同结论；name_current_only 与 renamed 是我们更新；birth_* / feb29_nonleap 是我们更严且只由出生日期单独否决',
  cases,
};

const out = `${JSON.stringify(doc, null, 2)}\n`;
const target = resolve(ROOT, OUT);
if (AS_CHECK) {
  // 绿：一行 stdout，退 0。红：一行 **stderr**（内容与"一致"那条分得开，B14 双向都钉），
  // 退 1，且**绝不写文件**——CI 里 `--check` 的全部意义就是"发现落后但不掩盖它"。
  const cur = readFileSync(target, 'utf8');
  if (cur === out) {
    process.stdout.write(`${OUT} 与生成器一致\n`);
    process.exit(0);
  }
  process.stderr.write(`${OUT} 与生成器不一致：请跑 node scripts/build-id-fixture.mjs 重新生成\n`);
  process.exit(1);
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

任一组抛错时**不要放宽断言**：抛错说明取样落进了没预料的分支，先把那条号码和它的地址码打出来，查它属于哪一层再改取样池。`pools` 字段会告诉你这几个池的实际大小（第四轮回填后的口径：`sameName=1,776` / `renamed=156`（三分成因：`renamedByCounty=62`、`renamedByLegacyPrefix=93`、`renamedByPlaceholder=1`）/ `onlyCurrent=1,046`；计划初稿预估的 1,871 / 63 / ≤1,044 三个数没有一个跑得出来，前两个换成上面的口径、第三个是 1,046）。跑完还要看一眼 `pools` 与七组的去重率：本轮 1,000 条 id 全部互不相同（uniq/n = 1.000），而**取样多样性真正的那一维是区划码**——七组各自的去重区划码数是 557 / 97 / 94 / 41 / 30 / 30 / 20，B7 按"不少于组内条数的一半"钉住它（上一轮按整串号码去重钉，实测把生成器改成"永远取池子第 0 个码"也照样全绿，见 §4.11 的 C-2）。

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
  // 这 9 条里前 8 条的期望值来自 2026-09-25 对 demo/idCardDemo/lib/IDValidator.js 的实跑，
  // 不是自家算完自说自话。440524…0014 就是 §2.2 那条"示例号末位是 4 不是 8"。
  // '11010119900307001' 那一档实跑是 1（旧库对 …011 放行、对 …013 拒绝），计划早期写的 3
  // 是抄自上面那条 350 结尾的样本，B4 的三处期望值同步跟。
  // 第 9 条 `99010119900307001 → '5'` **不是**旧库给的：省码 99 不在 GB2260 里，旧库的
  // `isValid` 在区划那一关就返回 false，11 个候选末位它一个都不接受（实跑
  // `['0'..'9','X'].map(c => oracle.isValid('99010119900307001' + c))` 全 false）。
  // '5' 是按标准算式（ISO 7064 MOD 11-2，与上面那条权重表和查表串）算出来的，
  // 这一条的出处是"照标准算"，与旧库无关——上一版注释把它一起记成"来自旧库实跑"，是假的。
  const known = {
    '11010119900307350': '3', '44052418800101001': '4', '11010118991231001': 'X',
    '11010119000101001': '4', '11010119900307001': '1', '11011419900307001': '3',
    '11010120000229001': '8', '11010119990229001': '8', '99010119900307001': '5',
  };
  for (const [body, want] of Object.entries(known)) {
    assert.equal(computeCheckDigit(body), want, `${body} 校验位应为 ${want}`);
  }
  // I-9 的"牙"：上面那段"实跑"此前只写在注释里，而注释里的实测数字复算不出来就是假的
  // （上一版正是把第 9 条一起记成"来自旧库"）。这里把可复算的那半句钉成断言：
  // 旧库对前 8 个 body **恰好只放行我们记下的那一个末位**，对 990101… 则 11 个候选全不放行
  // ——省码 99 不在 GB2260 里，它那一格的 '5' 只能来自标准算式，与旧库无关。
  // 旧库随段 5 删除后这一整块退场（长期守卫是 B7 吃的夹具），已记进计划的段 5 待办。
  const legacyDir = resolve(ROOT, 'demo/idCardDemo/lib');
  const idLib = resolve(legacyDir, 'IDValidator.js');
  if (existsSync(idLib)) {
    const req = createRequire(import.meta.url);
    const legacyGb2260 = req(resolve(legacyDir, 'GB2260.js'));
    const Oracle = req(idLib);
    const oracle = new Oracle(legacyGb2260);
    const CAND = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'];
    for (const [body, want] of Object.entries(known)) {
      const acc = CAND.filter((c) => oracle.isValid(body + c) === true);
      if (body.startsWith('99')) {
        assert.deepEqual(acc, [], `${body}：旧库居然放行了 ${acc.join('/')}，那"第 9 条不来自旧库"这句就是假的`);
      } else {
        assert.deepEqual(acc, [want],
          `${body}：旧库放行的末位是 ${acc.join('/') || '(none)'}，不是记下的 ${want}，"前 8 条来自旧库实跑"就是假的`);
      }
    }
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
    // 小写 x 的样本必须是末位真的该是 X 的号：'…350x' 那一版本体算出来是 3，
    // 拿它当"小写也接受"的用例只会测到 checkdigit 分支（实跑旧库对 …002x 也是 true）
    ['11010119900307002x', 'valid'],
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
  assert.equal(from15.id18, '110101199003070011');   // body 用「区划 + 19 + yyMMdd + 顺序码」拼，不是错位取 8 位
  assert.equal(from15.id15, '110101900307001');

  const from18 = parseIdCard('110101199003070011', { today: TODAY });
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
  assert.equal(wrong.suggestedId18, '110101199003070011');
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

/**
 * 七组配额与三个取样池的大小。**期望值写死在判据这一侧**，不读夹具自报的 `groupCounts`——
 * 这是 C-3 的整改：原先那三行（`total === 1000`、"自报配额合计 == total"、"自报配额 == 自数组长度"）
 * 两个数出自同一个文件，等于让夹具自己确认自己。本轮在 /tmp 镜像里两种病灶都复算过，都一条不红：
 *   ① `feb29_nonleap: 0` + 名额挪给 `birth_before_1900` ② `agree18: 1 / agree15: 769`
 * ——第 ② 种之下 670 条 agree18 样本塌成 1 条（老判据下的 uniq/n 实测是 `agree18=1/1`），
 * 而三条自证断言照旧全绿（复核者在上一版那 21 条上量到的是 `# pass 21 / # fail 0`；本轮把
 * 老三条装回现在这套判据里跑，是 `# pass 26 / # fail 0`——多出来的 5 条与本组无关，不改变结论）。
 * 换成下面这两个写死的常量之后，同样的两种病灶各自跑一遍都是 `# tests 26 / # pass 25 / # fail 1`，
 * 红的都是本条（B7），报的是"配额与计划规定值不符"。
 * 这两个常量是外部事实：配额是计划 §4.1 规定值，池子大小是四份哈希钉死的快照的函数
 * （与 A1/A2 钉 `REGION_META.counts` 同一形状）。换快照 = 池子变 = 这里红，是设计意图。
 */
const EXPECT_QUOTA = {
  agree18: 670, agree15: 100, name_current_only: 100, renamed: 50,
  birth_before_1900: 30, birth_after_today: 30, feb29_nonleap: 20,
};
const EXPECT_POOLS = {
  sameName: 1776, renamed: 156, onlyCurrent: 1046,
  renamedByCounty: 62, renamedByLegacyPrefix: 93, renamedByPlaceholder: 1,
};

test('B7 与站内旧库对拍：同结论组守住，分歧组方向守住', () => {
  const quotaTotal = Object.values(EXPECT_QUOTA).reduce((a, b) => a + b, 0);
  assert.equal(quotaTotal, 1000, '判据这一侧写死的七组配额合计不再是 1000，先想清楚再改');
  assert.deepEqual(FX.groupCounts, EXPECT_QUOTA, '生成器的分组配额与计划规定值不符');
  assert.deepEqual(FX.pools, EXPECT_POOLS, '取样池大小与快照实读值不符（换了快照要同步这里）');
  assert.equal(FX.total, quotaTotal);
  assert.deepEqual(Object.keys(FX.cases).sort(), Object.keys(EXPECT_QUOTA).sort(), '夹具的组名集合变了');
  for (const [g, n] of Object.entries(EXPECT_QUOTA)) {
    assert.equal(FX.cases[g].length, n, `${g} 组实际条数与计划规定的 ${n} 不符`);
    // 覆盖力要按**取样池那一维**去重：每组内部的多样性只来自区划码（生日与顺序码每条独立摇，
    // 整串号码去重数因此几乎恒等于 1.000，塌不掉）。上一版注释写的"取样池塌掉时 uniq 会跟着塌"
    // 是假话，本轮在镜像里量过：把生成器的 `pick(arr)` 换成 `arr[0]`（1,000 条共用一个区划码）
    // 重跑生成器，老的那三条自证断言一条都不红（台账 C-2b：`# pass 26 / # fail 0`），
    // 只把下面这一行摘掉、病灶留着，同样全绿（台账 C-2c）——两件事合起来说明老判据没牙、
    // 而这一行是唯一咬得住的那一口。实读七组的去重区划码：557/670、97/100、94/100、41/50、
    // 30/30、30/30、20/20，一半这个门槛留有一倍以上的余量。
    const areas = new Set(FX.cases[g].map((c) => c.id.slice(0, 6)));
    assert.ok(areas.size >= Math.ceil(n / 2),
      `${g} 只取了 ${areas.size}/${n} 个不同区划码，取样池塌了，判据没有覆盖力`);
    // 整串号码那一维换一条判法：不许有重复（同一条号码交两次考卷 = 那一格没测新东西）。
    // 实读七组都是 n/n，所以这里钉的是"相等"而不是"不少于一半"。
    assert.equal(new Set(FX.cases[g].map((c) => c.id)).size, n, `${g} 组内有重复号码`);
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
  // 我们更新（二）：同码异名，旧库给 2015 年前后的旧名。156 条按成因分三类（实读，见 `FX.pools`）：
  // 62 条县名自己改过、93 条县名没变而旧表那一段市名/省名是旧口径、1 条（620201 嘉峪关市）
  // 旧表在市级码下挂的是「市辖区」占位条——三类都是"我们给现行名、旧库给旧串"，方向同一个，
  // 但第三类不是改名，别把它记进"县名改过"那一档（上一版就是这么记错的）。
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
    // 顺序码的不变量是「三位数字且不为 000」（§5.4：实际取 001–999），不是"首位非零"。
    // 上一轮写的 `/[1-9]\d{2}/` 把 055、007 这类合法顺序码一并判死——本轮 C-1 改了随机流
    // 消耗顺序后它当场误伤一条 `055`，正好证明它从一开始就是错的，只是没被抽到而已。
    assert.ok(/^\d{3}$/.test(g.seq) && g.seq !== '000', `顺序码 ${g.seq} 应落在 001..999`);
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

/**
 * B10–B12 是 2026-09-25 第四轮质量复核（3 Critical + 7 Important + 4 Minor）的整改判据。
 * 每条先写出来跑一遍看它今天红不红（红的才是"今天还坏着"的证据），再改实现，再跑变异。
 */

/** 跑一次 generateIdCards，只把抛出的错误拿回来；不抛则返回 null。 */
const genError = (options) => {
  try {
    generateIdCards({ count: 1, rng: seededRandom(4242), ...options });
    return null;
  } catch (e) {
    return e;
  }
};

test('B10 入参闸门：坏类型与坏日历日期在入参阶段点名，随机源任何整数都是一条独立流', () => {
  // I-6：`birthDate: '1999-02-30'` 此前只查格式不查日历，一路摇到自检那一关，
  // 抛出来的是 `RangeError: 内部不变量：生成的 451022199902309415 自检为 malformed`——
  // 调用方的一次类型错误被记成"实现有 bug"。现在报错必须点名 options.birthDate。
  const gate = [
    [{ birthDate: '1999-02-30' }, /options\.birthDate/, '格式对、日历不存在的出生日期'],
    [{ birthDate: '1999-13-01' }, /options\.birthDate/, '月份 13 的出生日期'],
    [{ birthDate: '1999-2-3' }, /options\.birthDate/, '没补零的出生日期'],
    [{ birthDate: '昨天' }, /options\.birthDate/, '不是日期的出生日期'],
    [{ birthDate: 20050401 }, /options\.birthDate/, '数值型出生日期（M-11 同族：不许 String() 洗白）'],
    [{ today: '昨天' }, /options\.today/, 'M-12：不是 YYYY-MM-DD 的 today 此前静默取墙钟'],
    [{ today: '1999-02-30' }, /options\.today/, '日历不存在的 today'],
    [{ rng: () => 2 }, /options\.rng/, '返回区间外值的 rng 此前一路摇出 undefined192225011999null'],
    [{ rng: 'not-a-function' }, /options\.rng/, '非函数的 rng'],
    [{ areaCode: 110101 }, /options\.areaCode/, 'M-11：数值区划码被 String() 洗成合法前缀'],
    [{ provinceCode: 11 }, /options\.provinceCode/, 'M-11：数值省码同上，且 region.js 刚堵掉过这一族'],
    [{ cityCode: null }, /options\.cityCode/, 'M-11：null 此前等于"不收窄"，静默出货全表地址'],
    [{ minAge: 18.5 }, /options\.minAge/, '非整数周岁下界'],
    [{ maxAge: '60' }, /options\.maxAge/, '字符串周岁上界'],
  ];
  for (const [options, want, why] of gate) {
    const err = genError(options);
    // 报错文案要"点名入参"，但消息本身要等到确实没抛时才去跑第二遍——
    // 写成 `assert(err, \`…${JSON.stringify(generateIdCards(options))}\`)` 会在**通过**的那一轮
    // 就把模板字符串算出来，于是坏入参自己先抛穿判据（本轮实测踩过一次）。
    if (!err) {
      const shipped = JSON.stringify(generateIdCards({ count: 1, rng: seededRandom(4242), ...options }));
      assert.fail(`${why}：居然安静出货 ${shipped}`);
    }
    assert.match(err.message, want, `${why}：报错没点名是哪个入参 → ${err.message}`);
    assert.doesNotMatch(err.message, /内部不变量/, `${why}：入参错误被记成实现有 bug → ${err.message}`);
  }
  // 两个入口的入参口径必须一致（M-14）：today 收 Date 而 birthDate 拒 Date 是分裂。
  const dated = generateIdCards({ count: 2, today: new Date(2026, 8, 25), birthDate: new Date(2000, 2, 7) });
  assert.ok(dated.every((g) => g.birth === '2000-03-07'), 'Date 型 birthDate 与 today 必须同口径被接受');
  assert.equal(parseIdCard('110101199003073503', { today: new Date(2026, 8, 25) }).info.ageYears, 36);
  // M-14：`parseIdCard(x, null)` 此前抛 "Cannot read properties of null"，而 opts 是可选参数。
  assert.equal(parseIdCard('110101199003073503', null).state, 'valid', 'opts 传 null 等于没传，不该抛');
  assert.throws(() => parseIdCard('110101199003073503', { today: '昨天' }), /options\.today/, 'M-12');
  assert.throws(() => parseIdCardList('110101199003073503', { today: '昨天' }), /options\.today/,
    '批量入口与单条入口必须同一个报错口径');
  // 正向对照：闸门不许把合法入参一起关掉
  const fine = generateIdCards({
    count: 3, today: TODAY, rng: seededRandom(7), areaCode: '110101', birthDate: '2000-03-07', sex: 'female',
  });
  assert.equal(fine.length, 3);
  assert.ok(fine.every((g) => g.areaCode === '110101' && g.birth === '2000-03-07' && g.sex === '女'));

  // I-10：文件头原先写「mulberry32 在种子 0 下退化」，实测是假话——`a` 先自增再被使用，
  // 种子 0 是一条正常流。真正做过的事是 `(seed >>> 0) || 1` 把 0 改写成 1，代价是
  // 「0 与 1 是同一条流」（实测两边前三个输出逐字相同：0.627074, 0.002736, 0.527447）。
  // 现在不再改写种子，任何整数各占一条流。
  const stream = (seed) => { const f = seededRandom(seed); return [0, 1, 2, 3, 4, 5, 6, 7].map(() => f()); };
  const s0 = stream(0);
  const s1 = stream(1);
  assert.deepEqual(stream(0), s0, '同种子必须同流（可注入随机源的存在理由）');
  assert.notDeepEqual(s0, s1, '种子 0 不得再被改写成 1：两条流必须分得开');
  assert.equal(new Set(s0).size, 8, '种子 0 的流退化（输出出现重复值）');
  for (const v of s0) assert.ok(v >= 0 && v < 1, `输出越界：${v}`);
  assert.ok(s0.some((v) => v > 0.5), '种子 0 的流全挤在低区，不像一条健康的流');
});

test('B11 生成的生日真的落在请求的周岁区间里：生日没过不许少算一岁', () => {
  // C-1：原先写 `year = today.y - age`，没算"今年的生日过没过"，minAge:18 会生成 17 周岁的人。
  // 复算口径（第八轮本轮跑过）：把 randomBirthDay 换回整改前那七行，跑
  // `generateIdCards({ count: 50, today: '2026-09-25', rng: seededRandom(s) })`，s = 1..60
  // → 3,000 条里 **19 条** 17 周岁。同一个病灶换个种子集会给出 18 / 20 / 24 / 30，所以这里
  // 只把"构造 + 结果"一起写，不单独留一个复算不出来的计数（上一版那句"20 条"就是这么留下的，
  // 复核者按 s = 20260925..84 跑给的是 18）。`23082820081021721X` 是手搓的样例不是生成结果
  // （2008-10-21 生、today 2026-09-25 → 17 周岁，parseIdCard 判 valid），它只用来示意形状。
  // 周岁在判据这一侧独立复算一遍，不读 info.ageYears（读它就等于让被测侧自己作证）。
  const todayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
  const fullYears = (birthIso, todayIso) => {
    const b = todayOf(birthIso); const t = todayOf(todayIso);
    return t.y - b.y - (t.m < b.m || (t.m === b.m && t.d < b.d) ? 1 : 0);
  };
  const windows = [[18, 60], [0, 0], [0, 120], [18, 18], [30, 30], [65, 120], [1, 2]];
  const todays = ['2026-09-25', '2024-02-29', '2026-01-01', '2026-12-31', '2023-02-28'];
  for (const today of todays) {
    for (const [minAge, maxAge] of windows) {
      for (let s = 0; s < 4; s += 1) {
        for (const g of generateIdCards({ count: 25, today, rng: seededRandom(9100 + s), minAge, maxAge })) {
          const age = fullYears(g.birth, today);
          assert.ok(age >= minAge && age <= maxAge,
            `today=${today} 请求 [${minAge},${maxAge}] 周岁，实给 ${age}（生日 ${g.birth}）`);
          assert.equal(g.age, age, `today=${today} ${g.id18} 自报 age=${g.age} 与复算 ${age} 不符`);
          assert.ok(g.birth <= today, `today=${today} 生成了未来日期 ${g.birth}`);
          assert.equal(parseIdCard(g.id18, { today }).state, 'valid', `${g.id18} 自检不过`);
        }
      }
    }
  }
  // 退一年落到 2/29 的那一格：today 是 2/29、目标生成年非闰时，不许写出 2/30 之类的假日期
  for (const g of generateIdCards({ count: 50, today: '2024-02-29', rng: seededRandom(31), minAge: 0, maxAge: 60 })) {
    const [by, bm, bd] = g.birth.split('-').map(Number);
    const back = new Date(Date.UTC(by, bm - 1, bd));
    assert.equal(back.getUTCFullYear(), by, `${g.birth} 不是一个真实存在的日历日期`);
    assert.equal(back.getUTCMonth() + 1, bm, `${g.birth} 不是一个真实存在的日历日期`);
    assert.equal(back.getUTCDate(), bd, `${g.birth} 不是一个真实存在的日历日期`);
    assert.ok(fullYears(g.birth, '2024-02-29') <= 60, `${g.birth} 的周岁越出请求的 [0,60]`);
  }
  // 窗口为空：本站下界 1900-01-01 之上取不到 [18,60] 的周岁时，必须点名"周岁区间"而不是摇出坏号
  const err = genError({ today: '1900-06-01', minAge: 18, maxAge: 60 });
  if (!err) assert.fail('周岁窗口与下界无交集时居然安静出货了');
  assert.match(err.message, /周岁区间/, `空窗口必须点名"周岁区间"：${err.message}`);
});

test('B12 区划 unknown 判结构非法；结构非法不出货解释性结论', () => {
  // I-4：`regionOk` 的 false 那一支此前零判据——把 unknown 归成 null 之后 21 条判据一条都不红，
  // 而 990101199003070015 会被判成 valid。B3 里的 000000000000000000 是被"月份 00"双重故障
  // 顺手拦下的，不替这一支作证（摘掉 false 那一支它照旧 malformed）。
  const unknown = parseIdCard('990101199003070015', { today: TODAY });
  assert.equal(unknown.state, 'malformed', '省码根本不在表里 = 结构非法，不是"不下结论"');
  assert.equal(rowOf(unknown, 'region').ok, false, 'unknown 必须落 false');
  assert.deepEqual(failedKeys(unknown), ['region']);
  // 与"未收录"那一档分得开：440524 / 110199 是 null（§5.4 查不到不等于无效），两档不能合并
  assert.equal(rowOf(parseIdCard(mk('11019919900307001'), { today: TODAY }), 'region').ok, null);
  assert.equal(rowOf(parseIdCard(mk('44052419900307001'), { today: TODAY }), 'region').ok, null);
  assert.equal(rowOf(parseIdCard(mk('11010319900307001'), { today: TODAY }), 'region').ok, true);
  // 三档各钉一条，让"两档不能合并"这件事本身可红：unknown→false、uncoded→null、current→true
  assert.equal(resolveRegion('990101').status, 'unknown');
  assert.equal(resolveRegion('110199').status, 'uncoded');
  assert.equal(resolveRegion('440524').status, 'uncoded');
  assert.equal(resolveRegion('110101').status, 'current');

  // I-5：结构非法的号码照旧出货派生字段（Task 3 刚在区划侧修过同族缺陷）。实测清单：
  // 990101199003070015 与 000000199003070015 都是 malformed，却给 seq=001 | sex=男 |
  // ageYears=36 | birth=1990-03-07 | body17=…；110101290001010012（2900 年出生）malformed 却给 sex=男；
  // 110101199902290018（非闰年 2/29）malformed 却给 seq=001 | sex=男。
  const RAW = ['areaCode', 'birthRaw', 'seq', 'body17'];
  const FORM = ['id18', 'id15', 'id15Note', 'suggestedId18'];
  // 走到解码之后才被判死的：info 在，但解释性结论（sex）与四个形态字段必须空
  for (const id of ['990101199003070015', '000000199003070015', '110101290001010012',
    '110101199902290018', '11010118991231001X']) {
    const r = parseIdCard(id, { today: TODAY });
    assert.equal(r.state, 'malformed', `${id} 这一版应当还是 malformed，判据才测得到出货口径`);
    if (!r.info) assert.fail(`${id} 结构非法到连 info 都不给——sex/形态字段那一条就无从判起，见 B12 后半段的分档`);
    assert.equal(r.info.sex, '', `${id} 结构非法却给出 sex=${JSON.stringify(r.info.sex)}`);
    for (const k of FORM) {
      assert.equal(r[k], '', `${id} 结构非法却给出 ${k}=${JSON.stringify(r[k])}`);
    }
    // 原始回显一律留着：逐项表要说得出"坏在哪一段"，B5 还指着 birthRaw 与越界日期
    for (const k of RAW) assert.ok(typeof r.info[k] === 'string', `${id} 的原始字段 ${k} 不能消失`);
    assert.equal(r.info.areaCode, id.slice(0, 6), `${id} 的区划段回显不对`);
    assert.ok(r.checks.some((c) => c.ok === false), `${id} 总得有一行 false 说清坏在哪`);
  }
  // 连长度 / 字符集这关都过不去的：整个 info 不给（此时没有任何"解出来"的东西可描述，
  // 面板对这一类的活是把原始输入与那一行 false 摆出来），形态字段同样为空
  for (const id of ['110101 199003073503', '11010119900307350']) {
    const r = parseIdCard(id, { today: TODAY });
    assert.equal(r.state, 'malformed', `${id} 这一版应当还是 malformed`);
    assert.equal(r.info, null, `${id} 长度/字符集未过，不该凭空拼出一个解码对象`);
    for (const k of FORM) assert.equal(r[k], '', `${id} 长度/字符集未过却给出 ${k}=${JSON.stringify(r[k])}`);
    assert.equal(r.value.length > 0, true, `${id} 的原始回显（value）不能消失`);
  }
  // 越下界但仍是一个真日历日期 → 日期照给（B5 已钉那一条），解释性结论照样收回去
  const early = parseIdCard('11010118991231001X', { today: TODAY });
  assert.equal(early.info.birth, '1899-12-31', '越出本站下界仍要把解出来的日期给用户看（§5.4 口径不变）');
  assert.equal(early.info.ageYears, null, '越下界不给周岁');
  assert.equal(early.info.sex, '');
  // checkdigit 态是另一回事：号码其余部分确实可解，面板的活就是给出"算得 X / 你填 Y"和可抄的建议形态
  const cd = parseIdCard('110101199003073504', { today: TODAY });
  assert.equal(cd.state, 'checkdigit');
  assert.equal(cd.info.sex, '女');
  assert.equal(cd.id15, '110101900307350');
  assert.equal(cd.suggestedId18, '110101199003073503');
  assert.equal(cd.expectedCheckBit, '3');
  const cd15 = parseIdCard('11010190030700A', { today: TODAY });
  assert.equal(cd15.state, 'malformed');
  assert.equal(cd15.id15, '', '15 位末位混进字母的那一条旧库放行、我们判非法，非法就不出货');
});

test('B13 2 月 29 逐年前后各扫一遍：闰年成立、非闰只由出生日期否决', () => {
  // M-13：夹具的 agree 组里 2/29 样本实测 0 条（1,000 条中只有 feb29_nonleap 那 20 条是 2/29），
  // 而生成器里那句 `if (isLeap(y)) y -= 2` 不可达（y 已被前一行减成奇数，闰年必为偶数），
  // 所以"闰年 2/29 判有效"此前只有 B5 一条硬编码在守。这里按年扫，闰律在判据一侧独立写一遍。
  const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  for (let y = 1901; y <= 2100; y += 1) {
    const r = parseIdCard(mk(`110101${y}0229001`), { today: '2100-12-31' });
    assert.equal(daysInMonth(y, 2), leap(y) ? 29 : 28, `${y} 年的 2 月天数不对`);
    if (leap(y)) {
      assert.equal(r.state, 'valid', `${y} 是闰年，2/29 必须成立`);
      assert.deepEqual(failedKeys(r), []);
    } else {
      assert.equal(r.state, 'malformed', `${y} 不是闰年，2/29 必须判结构非法`);
      assert.deepEqual(failedKeys(r), ['birth'], `${y} 的否决项必须是出生日期单独那一条`);
      assert.equal(rowOf(r, 'checkBit').ok, true, `${y}：校验位算术不许被连累`);
      assert.equal(r.info.birth, null);
    }
  }
  // 2/28 在两种年份都成立：别把"闰年判断"写成"2 月只许 28 天"之外的样子
  for (const y of [1900, 2000, 2100, 2024]) {
    assert.equal(parseIdCard(mk(`110101${y}0228001`), { today: '2100-12-31' }).state, 'valid', `${y}-02-28`);
  }
});

/** 身份证夹具生成器与它的输入。判据全在临时副本上跑：夹具是提交进仓库的产物，动一下就没了。 */
const ID_GEN = resolve(HERE, 'build-id-fixture.mjs');
const ID_FIXTURE = resolve(ROOT, 'scripts/fixtures/id-validator-checkbit-1000.json');

/** 把生成器、四份区划快照、旧库两份 lib 与当前夹具搬进一个临时仓库根。 */
function makeIdTmpRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'id-fixture-'));
  const fixtureDir = resolve(tmp, 'scripts/fixtures');
  const regionDir = resolve(fixtureDir, 'region-source');
  const libDir = resolve(tmp, 'demo/idCardDemo/lib');
  mkdirSync(regionDir, { recursive: true });
  mkdirSync(libDir, { recursive: true });
  for (const f of readdirSync(FIXDIR)) copyFileSync(resolve(FIXDIR, f), resolve(regionDir, f));
  for (const f of ['GB2260.js', 'IDValidator.js']) {
    copyFileSync(resolve(ROOT, 'demo/idCardDemo/lib', f), resolve(libDir, f));
  }
  copyFileSync(ID_FIXTURE, resolve(fixtureDir, 'id-validator-checkbit-1000.json'));
  copyFileSync(ID_GEN, resolve(tmp, 'scripts/build-id-fixture.mjs'));
  return {
    tmp,
    gen: resolve(tmp, 'scripts/build-id-fixture.mjs'),
    fixture: resolve(fixtureDir, 'id-validator-checkbit-1000.json'),
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

test('B14 夹具生成器的参数闸门：拼错的开关不得落到覆盖夹具那一支，--check 不许顺手写', () => {
  // I-8：`node scripts/build-id-fixture.mjs --nope` 此前退 0 并**覆盖夹具**——
  // `build-region-data.mjs` 早就为同一件事加了白名单（由 A10 钉着），本生成器此前
  // 一次都没被任何判据跑过。判据形状照 A10 写：报错必须非零退出 + 点名参数 + 一个字节都不写。
  const repoBytes = readFileSync(ID_FIXTURE, 'utf8');
  const regionBefore = Object.fromEntries(readdirSync(FIXDIR).sort()
    .map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))]));
  const repo = makeIdTmpRepo();
  const spawn = (...args) => spawnSync(process.execPath, [repo.gen, ...args], { cwd: repo.tmp, encoding: 'utf8' });
  try {
    for (const flag of ['--nope', '--chek', '--CHECK', '--help', '-h', '--check=1']) {
      const r = spawn(flag);
      assert.notEqual(r.status, 0, `${flag} 被当成没写参数，直接跑进覆盖夹具那一支`);
      assert.match(r.stderr, /未知参数/, `${flag} 的报错没说是参数问题：${r.stderr}`);
      assert.match(r.stderr, /用法：node scripts\/build-id-fixture\.mjs/, `${flag} 的报错没带用法行`);
      assert.equal(r.stdout, '', `${flag} 报错的同时还把夹具生成了一遍`);
      assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, `${flag} 动过副本里的夹具`);
    }
    // --check 承诺只比对：一致必须绿且不写文件；改成"落后一个换行"之后必须红，
    // 而且不许"顺手"把它写回一致——那正是 CI 里 --check 失去意义的方式。
    const ok = spawn('--check');
    assert.equal(ok.status, 0, `一致的副本上 --check 却红了：${ok.stderr}`);
    assert.match(ok.stdout, /与生成器一致/);
    assert.doesNotMatch(ok.stdout, /不一致/, '"不一致"是"与生成器一致"的子串反例，必须分开说');
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '--check 动过一致状态下的夹具');
    const staleBytes = `${repoBytes}\n`;
    writeFileSync(repo.fixture, staleBytes);
    const chk = spawn('--check');
    assert.notEqual(chk.status, 0, '--check 在不匹配时退出 0，等于没有闸门');
    assert.match(chk.stderr, /与生成器不一致/);
    assert.equal(readFileSync(repo.fixture, 'utf8'), staleBytes, '--check 把比对做成了覆盖');
    // 字节幂等：连跑两次生成器必须同一份字节，且与仓库里那份逐字节相同
    const once = spawn();
    assert.equal(once.status, 0, once.stderr);
    assert.match(once.stdout, /1000 条/);
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '重跑生成器得到的字节与仓库里那份不同');
    assert.equal(spawn().status, 0);
    assert.equal(readFileSync(repo.fixture, 'utf8'), repoBytes, '连跑两次不幂等，--check 就没有意义');
  } finally {
    repo.cleanup();
  }
  assert.equal(readFileSync(ID_FIXTURE, 'utf8'), repoBytes, '整条 B14 动过仓库里的夹具');
  assert.deepEqual(Object.fromEntries(readdirSync(FIXDIR).sort()
    .map((f) => [f, sha256Of(readFileSync(resolve(FIXDIR, f)))])), regionBefore, 'B14 动过仓库里的区划快照');
});
```

- [ ] **Step 4: 跑测试，确认它红**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected: `exit=1`，报 `Cannot find module '…/dev/js/tools/idcard.js'`。这是预期的红：模块不存在，不是判据写松了。

红灯的实际形状在实现轮回填过一次（2026-09-25）：计划初稿写的是"整个测试文件加载失败、§A 那 12 条一起不跑"，实测**不是这样**——§A 的用例是同步注册的，顶层 `await import()` 的拒绝发生在它们跑完之后，所以看到的是 `# pass 12 / # fail 1`，那一条失败是文件级 subtest（`not ok 1 - scripts/toolkit-tests.mjs`，`location` 指到 `:1:1`），错误文案点名缺哪个模块。§B 的九条一条都没注册，所以「§A 全绿 + §B 零条 + 一条文件级红」就是这一步该有的样子，**不要**为此把 §B 的 import 往前挪（挪到 §A 之前只会把 12 条一起变成不跑，Task 8 的变异锚定也就看不到 §A 了）。顺带：文件级 subtest 的 `not ok` 写在行首，正是 Task 8 按 `^not ok` 锚定要的形状。

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
 * 种子只做 `>>> 0` 的无符号化，**不再把 0 改写成 1**。旧注释写的是"mulberry32 在种子 0
 * 下退化"，那是句假话：`a` 是先自增再被使用的，种子 0 走的第一个状态就是 0x6d2b79f5，
 * 实测前八个输出 0.266429, 0.000330, 0.223272, 0.146202, 0.467328, 0.545049, 0.615251,
 * 0.648985——八个值互不相同，也不挤在低区，是一条正常的流。
 * `|| 1` 真正做过的只有一件事：让种子 0 与种子 1 变成**同一条流**（两边前八个输出实测
 * 逐字相同，从 0.627074 开始）。判据里"同种子必同输出"的那一半因此成立，
 * "换种子就该换输出"的那一半则被它悄悄废掉了——面板上按两次"再抽一次"若撞进 0/1，
 * 用户看到的是同一个号。所以 `seededRandom(0)` 现在给的是它自己的那条流。
 *
 * @param {number} seed 整数种子；负数与超过 2^32 的按 `>>> 0` 取无符号 32 位形式
 * @returns {() => number} 每次调用返回 [0, 1)
 */
export function seededRandom(seed) {
  let a = seed >>> 0;
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
const MS_DAY = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');
/** 下界的整日基准，给生成侧按天取窗口用（与 BIRTH_FLOOR 同源，不另写一个 1900） */
const BIRTH_FLOOR_UTC = (() => {
  const [y, m, d] = BIRTH_FLOOR.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
})();

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

/** 报错文案里的"收到什么"。绝不 String() 一个 Symbol / 无原型对象（那会自己先抛）。 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (v instanceof Date) return 'Date';
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

function wallClock() {
  const n = new Date();
  return makeDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/**
 * 归一"某一天"。**只有两种形状被接受**：`YYYY-MM-DD` 字符串（且必须是真实存在的日历日期）
 * 与 `Date`（取本地分量，与 makeDay 的 utc 同基准）。别的形状一律抛 `TypeError` 并点名是哪条入参。
 *
 * 为什么从"静默回落墙钟"改成抛（`what` 就是为这句报错存在的）：
 *   1. `today: '昨天'` 此前静默按今天的墙钟判，而"注入 today"是 §B 全部年龄判据可复现的前提——
 *      实测 `parseIdCard('110101199003073503', { today: '昨天' })` 与不传 today 的输出逐字相同。
 *   2. `birthDate: '1999-02-30'` 此前只查格式不查日历，一路摇到自检那一关，抛出来的是
 *      `RangeError: 内部不变量：生成的 420581199902302791 自检为 malformed`——调用方的输入
 *      错误被记成实现有 bug。现在入参阶段就报，且不说"内部不变量"。
 * @param {string|Date} input 入参
 * @param {string} what 报错里点名的入参，如 `generateIdCards 的 options.birthDate`
 */
function toDay(input, what) {
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!m) throw new TypeError(`${what} 应为 YYYY-MM-DD 字符串或 Date，收到 ${JSON.stringify(input)}`);
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (d < 1 || d > daysInMonth(y, mo)) {
      throw new TypeError(`${what} 是 ${y} 年 ${mo} 月不存在的日期（该月最多 ${daysInMonth(y, mo)} 天）：${input}`);
    }
    return makeDay(y, mo, d);
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return makeDay(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  throw new TypeError(`${what} 应为 YYYY-MM-DD 字符串或 Date，收到 ${shapeOf(input)}`);
}

/**
 * 可选的"今天"。`undefined` 与 `null` 都算"没传"→ 墙钟——段 2 的面板在用户没指定日期时
 * 发的就是 null，这一条与 `options.count === undefined` 那道"只把没传当默认值"同族；
 * 而**传了值**（哪怕是 `'昨天'`）就必须解得开，解不开要报，不许静默按今天的墙钟判。
 * @param {string|Date|null|undefined} input 入参
 * @param {string} what 报错里点名的入参
 */
function todayOf(input, what) {
  return input === undefined || input === null ? wallClock() : toDay(input, what);
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
 * **结构非法时不出货解释性结论**（与 region.js 的 `rejectRegion` 同一条契约）：
 * `sex` 与四个"规范形态/建议形态"字段一律给空串，因为被否决的号码旁边挂一个「性别：男」
 * 或一个"建议号码"，正是这层设计要防的"看着像成功了"——`000000199003070015` 的建议形态
 * `000000199003070014` 本身还是区划非法的号。留下的两样是：原始回显（`areaCode` /
 * `birthRaw` / `seq` / `body17` 与 `value`）和逐项表，面板要说得出"坏在哪一段"只能靠它们。
 * 分两级，与"解到哪一步才崩"对齐：长度 / 字符集那一关就出局的（`110101 199003073503`、
 * 17 位串）连 `info` 都不给（null）——那时根本没有可描述的六段结构；走到解码之后再被
 * 区划 / 生日否决的，`info` 与逐项表照给，只把 `sex` 与四个形态字段收空。
 * `checkdigit` 态**不**收紧，两态的分工见下面 out.state 那一段的注释。
 *
 * @param {string|number} raw 用户输入
 * @param {{today?: string|Date}} [opts] 注入"今天"，让年龄与上限判据可复现；
 *   `opts` 与 `opts.today` 传 null 都等于没传，`today` 传别的形状则抛 `TypeError`
 * @throws {TypeError} `opts.today` 既不是 `YYYY-MM-DD` 字符串也不是 `Date`
 */
export function parseIdCard(raw, opts = {}) {
  const today = todayOf((opts ?? {}).today, 'parseIdCard 的 options.today');
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
  // 顺序码是**本体**的最后 3 位，不是整串的最后 3 位：18 位串上 `slice(-3)` 会把校验位
  // 一起当成顺序码（'…3503' 解成 503），性别奇偶与 000 判定同时错位——B2/B4/B6/B7/B8 五条
  // 判据一起抓到它，旧库那边 `code.body.slice(-3)` 吃的本来就是去掉末位的本体。
  const orderStart = out.lengthType === 18 ? 14 : 12;
  const seq = compact.slice(orderStart, orderStart + 3);
  const seqNum = Number(seq);

  // 3) 行政区划：三种结论必须各归一档——现行 / 历史码 = true，未收录（父级能解）= null，
  //    省码根本不在表里 = **false**。上一版的 false 那一支零判据：把 unknown 一路归成 null
  //    之后 21 条判据一条都不红，而 990101199003070015 被判成 valid（B12 现在钉住这三档）。
  //    未收录只给 null + note，绝不下"无效"（§5.4）。
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
  /**
   * `ship` = 这一条号码允许被当成"解码结果"出货。**两态不同**是故意的：
   *   - `malformed`：长度 / 字符集 / 区划 / 生日 / 顺序码里有一项不成立，整个号不是"一个
   *     只是末位抄错的号码"，此时性别、15 位等价写法、建议形态都是凭坏数据推出来的结论。
   *   - `checkdigit`：五道结构闸门全过，只有末位与算式不符（§5.4 把这一态单列出来，
   *     面板要给的正是「算得 X / 你填 Y」和一个可以直接抄走的建议形态）。
   * 收回去的只有 `sex` 与那四个形态字段；`info.birth` 不在其内——1899-12-31 这类
   * "日期本身成立、只是越出本站下界"的解出来的日期要留给用户看（B5 钉着）。
   */
  const ship = !structuralFailed;

  const sum = out.lengthType === 18 ? weightSum(body17) : 0;
  out.info = {
    lengthType: out.lengthType, areaCode, region,
    birth: b.ok ? b.day.iso : null, birthRaw,
    ageYears: b.ok && birthOk ? ageInYears(b.day, today) : null,
    sex: ship ? (seqNum % 2 === 1 ? '男' : '女') : '', seq, body17,
    checkBit: given, expectedCheckBit: expected,
    checkWork: out.lengthType === 18 ? { sum, mod: sum % 11, table: CHECK_MAP } : null,
    datasetVersion: REGION_META.datasetVersion,
  };
  out.expectedCheckBit = expected || '';

  // 规范形态：18 位输入原样保留（错末位正是判据要显示的东西），另外给建议形态
  if (out.lengthType === 18) {
    if (ship) {
      out.id18 = compact;
      if (checkOk === false && expected) out.suggestedId18 = body17 + expected;
      if (b.ok && b.day.y >= 1900 && b.day.y <= 1999) {
        out.id15 = `${areaCode}${String(b.day.y).slice(2)}${pad2(b.day.m)}${pad2(b.day.d)}${seq}`;
        out.id15Note = '由 18 位去世纪位得来的等价写法（15 位无法表达 20xx 出生，仅作等价展示，不代表曾以 15 位签发）';
      }
    }
  } else if (ship) {
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
 * 例外是"根本没粘贴"：null / undefined / 空串给 0 行，而不是凭空造一行 empty 结论——
 * 面板按 rows.length 报"共 N 条"，一行都不该有的时候报 1 条就是错的。
 * @returns {Array<{no:number, raw:string, result:object}>}
 */
export function parseIdCardList(text, opts = {}) {
  const s = String(text === null || text === undefined ? '' : text);
  if (s === '') return [];
  return s
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

/**
 * 摇一个生日，使**周岁**恰好落在 [minAge, maxAge] 内；取不到任何日期时返回 null。
 *
 * 周岁对生日日期单调不增，所以"合法生日"是一整段连续的日期：
 *   上界 = 刚满 minAge 周岁那一天 = 今天往前推 minAge 年；
 *   下界 = 刚满 maxAge+1 周岁那一天的次日 = 今天往前推 maxAge+1 年再加一天。
 * 两端都按目标年份的 2 月实际天数收一下（today 落在 2/29、而目标年非闰时，2/29 这一格
 * 不存在，取 2/28——周岁照样成立，因为 2/28 不比今天晚）。再拿 BIRTH_FLOOR 夹一次下界：
 * 只往"更年轻"的方向收窄，不会把周岁推到 minAge 之下。
 *
 * 为什么不再写 `year = today.y - age`：那句没算"今年的生日过没过"，minAge:18 会生成
 * 17 周岁的人（B11 钉它；复算口径写在 B11 里——种子 s = 1..60 各 50 条，3,000 条里 19 条
 * 17 岁）。而它旁边那句"生日未到 → 整体退一年"的分支只在 age===0
 * 时才可达（生成年份至少比今年早一整年），今天没有任何判据看着它——按日期区间取号之后
 * 两个分支都不需要，周岁达标由构造保证。
 *
 * @returns {{y:number,m:number,d:number,iso:string,utc:number}|null}
 */
function randomBirthDay(rng, minAge, maxAge, today) {
  const at = (y, clampMonth = today.m) => Date.UTC(y, clampMonth - 1,
    Math.min(today.d, daysInMonth(y, clampMonth)));
  const hi = at(today.y - minAge);
  const lo = Math.max(at(today.y - maxAge - 1) + MS_DAY, BIRTH_FLOOR_UTC);
  if (lo > hi) return null;
  const span = Math.floor((hi - lo) / MS_DAY) + 1;
  const d = new Date(lo + Math.floor(rng() * span) * MS_DAY);
  return makeDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * 校验并包一层可注入随机源。`null` / `undefined` = 没传 → 时间种子；别的形状一律抛。
 *
 * 为什么连"取值"也要查（I-6 同族）：`rng: () => 2` 此前不抛，`pool[Math.floor(2 * len)]`
 * 直接取到 `undefined`，一路摇成 `undefined192225011999null` 那样的字符串，最后由自检
 * 那一关抛一句"内部不变量"——又一次把调用方的错误记成实现的 bug。现在第一次取值就报，
 * 且点名 options.rng。
 * @param {(() => number)|null|undefined} input 入参
 * @returns {() => number} 每次取值都保证落在 [0, 1) 的包装函数
 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateIdCards 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateIdCards 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/**
 * 取地址收窄前缀：`areaCode` > `cityCode` > `provinceCode`，只看传了的那一个。
 *
 * M-11：旧写法 `String(options.areaCode ?? options.cityCode ?? options.provinceCode)`
 * 有两处洗白——数值 `110101` 被 String() 成全码、`cityCode: null` 被当成"没传"而静默
 * 放开整张现行表（2,978 条地址）。region.js 的 `normalizePrefix` 刚为同一族收过口：
 * 非字符串 → null → 空集。生成侧比它更进一步：干脆抛，因为这唯一的调用方就是段 2 的面板。
 * 空串与全空白串同样抛（"收窄到空"与"没收窄"是两种完全不同的用户意图，不许混）。
 * @param {{areaCode?:unknown, cityCode?:unknown, provinceCode?:unknown}} o 入参对象
 * @returns {string} 去空白后的前缀
 */
function prefixOf(o) {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`generateIdCards 的 options.${key} 应为非空字符串（区划前缀），收到 ${shapeOf(v)}`);
    }
    return v.trim();
  }
  return '';
}

/**
 * 生成校验位成立的测试号。**地址只能出自现行区划表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseIdCard 自检，判不得 valid 就抛——生成器与校验器互为对手。
 *
 * 入参口径与 `parseIdCard` 一致（B10 钉住这一条）：`today` 与 `birthDate` 接受
 * `YYYY-MM-DD` 字符串或 `Date`，`null` / `undefined` 都算"没传"；`areaCode` / `cityCode` /
 * `provinceCode` 只接受**非空字符串**，`null` 与数值在这里一律抛——把它们当成"没传"等于
 * 把一次类型错误放大成"从 2,978 条地址里出货"，那道 `String(options.areaCode ?? …)`
 * 正是 region.js 的 `normalizePrefix` 刚堵掉的洗白路径。
 *
 * @param {{areaCode?:string, cityCode?:string, provinceCode?:string, birthDate?:string|Date,
 *   minAge?:number, maxAge?:number, sex?:'male'|'female'|null, count?:number,
 *   today?:string|Date, rng?:() => number}} [options]
 * @throws {RangeError} 数量 / 性别 / 年龄区间 / 区划前缀无候选 / 日期越界等业务规则不成立
 * @throws {TypeError} 任一入参的形状或类型不对（不是"传了个坏值"，是"根本不该这么传"）
 */
export function generateIdCards(options = {}) {
  const o = options ?? {};
  const today = todayOf(o.today, 'generateIdCards 的 options.today');
  const rng = checkedRng(o.rng);
  // 只把「没传」当默认值：`?? 1` 会把 count: null 也吞成 1，等于一次类型错误静默出货一条号码
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const sex = o.sex ?? null;
  if (sex !== null && sex !== 'male' && sex !== 'female') {
    throw new RangeError(`性别只接受 male / female / null，收到 ${shapeOf(o.sex)}`);
  }
  const minAge = o.minAge ?? 18;
  const maxAge = o.maxAge ?? 60;
  if (o.minAge !== undefined && o.minAge !== null && !Number.isInteger(o.minAge)) {
    throw new TypeError(`generateIdCards 的 options.minAge 应为整数周岁，收到 ${shapeOf(o.minAge)}`);
  }
  if (o.maxAge !== undefined && o.maxAge !== null && !Number.isInteger(o.maxAge)) {
    throw new TypeError(`generateIdCards 的 options.maxAge 应为整数周岁，收到 ${shapeOf(o.maxAge)}`);
  }
  let fixedBirth = null;
  if (o.birthDate !== undefined && o.birthDate !== null) {
    fixedBirth = toDay(o.birthDate, 'generateIdCards 的 options.birthDate');
    if (fixedBirth.iso < BIRTH_FLOOR) {
      throw new RangeError(`generateIdCards 的 options.birthDate（${fixedBirth.iso}）不得早于 ${BIRTH_FLOOR}`);
    }
    if (fixedBirth.utc > today.utc) {
      throw new RangeError(`generateIdCards 的 options.birthDate（${fixedBirth.iso}）不得晚于今天（${today.iso}）`);
    }
  } else if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 0 || maxAge < minAge || maxAge > 120) {
    throw new RangeError(
      `generateIdCards 的 options.minAge / options.maxAge 应为 0..120 之间的整数且 min ≤ max，`
      + `收到 [${shapeOf(o.minAge)}, ${shapeOf(o.maxAge)}]`);
  }

  const prefix = prefixOf(options);
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`没有可生成的行政区划（前缀「${prefix || '空'}」，区划数据截止 ${REGION_META.datasetVersion}）`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const areaCode = pool[Math.floor(rng() * pool.length)];
    const birth = fixedBirth ?? randomBirthDay(rng, minAge, maxAge, today);
    if (!birth) {
      throw new RangeError(`周岁区间 [${minAge}, ${maxAge}] 在 ${today.iso} 这天与本站下界 ${BIRTH_FLOOR} 之间取不到任何生日`);
    }
    const seq = pickSeq(rng, sex);
    const body17 = `${areaCode}${birth.y}${pad2(birth.m)}${pad2(birth.d)}${seq}`;
    const checkBit = computeCheckDigit(body17);
    const id18 = body17 + checkBit;
    const self = parseIdCard(id18, { today: today.iso });
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

Expected: `# pass 26`、`# fail 0`、`exit=0`（§A 的 12 条 + §B 的 14 条；§B 由 9 条长到 14 条、夹具重新生成一次，两笔账都在 §4.11。本 Step 首次落地时的数字是 `# pass 21`，那是 §4.10 那一轮的样子，别照着它改判据）。

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

### 4.10 实现轮回填：这一轮哪里偏离了计划，以及凭什么

先说没偏离的那件：**旧库在 Node 里直接可跑**。`demo/idCardDemo/lib/IDValidator.js` 是 UMD 包装，Node 走的是 `module.exports = factory(isWindow, global)` 那一支（`window` 未定义 → `isWindow` 为 false），`GB2260.js` 同理，所以 4.1 那三行 `createRequire` + `global.GB2260 = require(…)` 照抄就能用，`oracle.isValid / getInfo` 全部原样返回。**旧库一行都没改**，`demo/idCardDemo/` 与 `scripts/fixtures/region-source/` 到本轮结束仍是原字节。

其余八处是实测推翻计划或计划代码本身带缺陷，逐条列在这里（代码块与 `pools` 字段都已按磁盘回灌）：

| # | 位置 | 计划原文 | 实测与处置 |
|---|---|---|---|
| 1 | 4.0 同名池 | 按"县名相同"筛，1,871 条 | 那样筛出的 1,869 条里有 93 条两边全名必然不等（旧表市名/省名是旧口径），agree18 会误红。改成三段名各自与快照一致的口径，1,776 条；`renamed` 组随之 156 条并拆两个成因字段记录。判据一条没放宽 |
| 2 | B1 已知校验位表 | `'11010119900307001': '3'` | 该本体算出来是 **1**：旧库对 `…011` 返回 true、对 `…013` 返回 false。'3' 是抄了上一行 `…350` 那一档的期望值 |
| 3 | B3 小写 x 用例 | `'11010119900307350x'` 应判 valid | 那串的本体末位该是 3，填 x 只能落进 `checkdigit`，测不到"小写也接受"。换成 `11010119900307002x`（本体算得 X，旧库对它也返回 true） |
| 4 | B4 三处期望值 | `id18 = '110101199003070013'` 等 | 跟着 #2 改成 `…011`（含 `suggestedId18` 与反例输入） |
| 5 | B7 取样覆盖判据 | 两组 `uniq.size >= 250` | agree15 只抽 100 条，250 个不同号码数学上取不到，实跑必红。改成按组比对 `uniq >= n/2`，并且七组全查（原写法只查两组）；本轮实测七组 uniq/n 都是 1.000，池子塌掉时这条照样红 |
| 6 | idcard.js 顺序码 | `const seq = compact.slice(-3)` | **计划代码的真缺陷**：18 位串上它把校验位一起吃进顺序码（`…3503` 解成 503），性别、`000 未分配`、15 位等价写法三处口径同时错位。Step 7 首跑 B2/B4/B6/B7/B8 五条一起红（`'男' !== '女'` / `true !== null`），改成按 `lengthType` 取本体第 15–17 位后 21 条全绿 |
| 7 | `parseIdCardList` | 空输入走 `split` 得到 1 行 | B9 要求 `parseIdCardList(null)` 长度为 0：`''.split(/\r?\n/)` 给 `['']` 一条。改成 null / undefined / 空串直接 `[]`，"粘贴了空行"仍占一条 |
| 8 | `generateIdCards` 的 count | `options.count ?? 1` | B8 要求 `count: null` 抛 RangeError，`??` 把 null 当成"没传"静默出 1 条号码。改成只把 `undefined` 当没传 |

上一版留在这里的那句"没改、但下一轮要盯着"（B8 的 `/[1-9]\d{2}/` 只在 seed 20260925 那 5 条上碰巧不假红），第八轮真的盯出问题了：C-1 改了随机流消耗顺序之后它**当场误伤一条合法顺序码 `055`**（复算：`node --input-type=module -e "import {generateIdCards} from './dev/js/tools/idcard.js'; import {seededRandom} from './dev/js/tools/random.js'; console.log(generateIdCards({count:5,today:'2026-09-25',rng:seededRandom(20260925),provinceCode:'11'}).map(x=>x.id18).join('\n'))"` → 第 4 条 `110115199008220558`，旧口径 4/5 命中；把 B8 那一行换回 `/[1-9]\d{2}/` 实测 `# pass 25 / # fail 1`、只红 B8）。那句不变量本来是"三位数字且不为 000"（`pickSeq` 取 1..999 已在实现里保证），"首位非零"从来不是它——只是此前没被抽到而已。已改成 `/^\d{3}$/ && seq !== '000'`（§4.11 的 C-1 行记着这条连带）。

Step 7 的最终形状（回填，第八轮整改后复算）：`# tests 26 / # pass 26 / # fail 0`、`exit=0`（§A 12 条 + §B 14 条）；夹具 **248,934 字节、`sha256 16971baaa8726ed1…`**，`--check` 退 0。整改前那一版是 248,803B / `c1657987e987f50a…`，两版逐字段比过：**1,000 条样本一个字节都没变**，差异全在 `pools`（`renamedByCounty` 63→62、新增 `renamedByPlaceholder: 1`，见 §4.11 的 I-7）。`dev/js/tools/region-data.js` 仍是 `a7e26d543e55e9c0…`，`build-region-data.mjs --check` 退 0；行数 `wc -l scripts/toolkit-tests.mjs dev/js/tools/idcard.js dev/js/tools/random.js scripts/build-id-fixture.mjs` = 1,477 / 467 / 25 / 305。

### 4.11 第八轮质量复核整改轮回填：3 Critical + 7 Important + 4 Minor

第七轮是规格复核，八条偏离全记在 §4.10；第八轮是代码质量复核，开出 14 条。整改由一个子智能体落地（新增 B10–B14 五条判据，§B 从 9 条长成 14 条，夹具重新生成一次），**下面每一条的红名单与字节数是我自己在 `git archive HEAD` 之后覆盖工作区五文件的 /tmp 镜像上复跑过的**，不是转述它的报告——它上一轮跑到 150 回合上限就断了，断在"重灌计划正文"之前。基线（镜像未变异）：`# tests 26 / # pass 26 / # fail 0`。

| # | 级别 | 病灶（整改前的真行为） | 整改与判据 | 本轮实测 |
|---|---|---|---|---|
| C-1 | Critical | `randomBirthDay` 写 `year = today.y - age`，没算"今年的生日过没过"：`minAge: 18` 能生成 17 周岁的人。复算口径见判据：种子 `s = 1..60` 各 50 条 = 3,000 条 → **19 条** 17 周岁 | 改成按周岁反推**日期区间**取号：上界 = 刚满 `minAge` 那天，下界 = 刚满 `maxAge+1` 那天的次日，两端按目标年 2 月实际天数收口（`today` 是 2/29 而目标年非闰时取 2/28），再用 `BIRTH_FLOOR_UTC` 夹一次下界。判据 B11 | 同一构造在整改后跑：**0** 条越界；旧实现旁边那句"生日未到 → 整体退一年"的分支只在 `age === 0` 时可达（生成年份至少比今年早一整年），此前没有任何判据看着它——按区间取号之后两个分支都不存在了 |
| C-2 | Critical | B7 的取样覆盖力按**整串号码**去重（`uniq.size >= 250` 那两行），而每组内部的多样性只来自区划码（生日与顺序码每条独立摇，整串去重数几乎恒等于 n/n）：把生成器改成 `pick = (arr) => arr[0]`（1,000 条共用一个区划码）判据一条都不红 | 覆盖力改按区划码那一维去重、七组全查、门槛"≥ 组内条数一半"；整串号码那一维换成另一条判法——**组内不许有重复号码**（实读七组都 n/n，所以钉"相等"） | 见台账 M-b / M-c2c 两行 |
| C-3 | Critical | B7 那三条自证断言读的是夹具**自报**的 `groupCounts`（`total === 1000`、"自报配额合计 == total"、"自报配额 == 自数组长度"）——两个数出自同一个文件，等于让夹具自己确认自己 | 期望值写死在判据这一侧：`EXPECT_QUOTA`（§4.1 规定值）与 `EXPECT_POOLS`（四份哈希钉死的快照的函数），与 A1/A2 钉 `REGION_META.counts` 同一形状。换快照 = 池子变 = 这里红，是设计意图 | 见台账 M-c3i / M-c3ii / M-c3iii 三行 |
| I-4 | Important | `regionOk` 的 `false` 那一支零判据：把 `unknown` 一路归成 `null` 之后当时 21 条判据一条不红，而 `990101199003070015` 被判成 `valid` | B12 钉三档各归一处（现行/历史 = true、父级可解的未收录 = null、省码根本不在表里 = false），且结构非法不出货解释性结论 | 台账 M-i4 |
| I-5 | Important | 结构非法的号码照旧出货派生字段（`sex`、四个"规范形态/建议形态"），Task 3 刚在区划侧修过同族缺陷 | `idcard.js` 头注释把契约写成两级：`sex` 与四个形态字段一律空串；长度/字符集那一关出局的连 `info` 都不给（`null`）。判据逐字段核 | 我给的字段清单（复核者报的那两个名字没复现，改按实测量出来的名单钉） |
| I-6 | Important | `rng: () => 2` 不抛：`pool[Math.floor(2 * len)]` 取到 `undefined`，一路摇成 `undefined192225011999null` 那样的串，最后由自检那一关抛"内部不变量"——把调用方的错误记成实现的 bug | `checkedRng` 第一次取值就抛，且点名 `options.rng`（B10 的一档） | 台账 M-i6 |
| I-7 | Important | 计划把 156 条同码异名记成"两种成因"，且把 `620201` 记错档；实际三类。另：同名池的筛法与读侧 `joinNames` 不是同一个字符串 | 成因拆三档入 `pools`（`renamedByCounty` 62 / `renamedByLegacyPrefix` 93 / `renamedByPlaceholder` 1，三者之和由 B7 钉 == `RENAMED.length`）；`sameNameAsLegacy` 补上与读侧同一条前缀剥离 | 复算：`both` 1,932 → `sameName` 1,776、`renamed` 156 = 62+93+1，双向分叉 0（agree18 全等、renamed 全不等）。**加与不加那一刀 `sameName` 都是 1,776 条、成员一字不差**（那 19 条重叠前缀没有一条同时在 2015 旧表里），它堵的是"两份实现算的不是同一个字符串"这件事本身 |
| I-8 | Important | `node scripts/build-id-fixture.mjs --nope` 退 **0** 并且直接落进 `writeFileSync` ——手打错一个字母就把只读比对换成覆盖仓库产物。`build-region-data.mjs` 早有白名单（A10 钉着），而这个生成器此前一次都没被任何判据跑过 | 参数白名单 + `USAGE`，错则退 1、一个字节都不写；判据 B14（顺带把"生成器幂等"与"不碰区划快照"一起钉） | `--nope` → `未知参数：--nope` + 用法行、exit 1 |
| I-9 | Important | 注释写"9 条期望值全部来自旧库实跑"，其中第 9 条不是：省码 `99` 不在 GB2260，旧库对 11 个候选末位**全**不放行，`'5'` 出自标准算式 | 注释改口，并把可复算的那半句钉成断言：前 8 个 body 旧库恰好只放行记下的那一个末位，`990101…` 那格 11 个全不放行 | 实跑旧库逐条核过；旧库随段 5 删除后这一整块退场（`existsSync` 守着），长期守卫是 B7 吃的夹具——已记进段 5 待办 |
| I-10 | Important | `random.js` 头注释写"mulberry32 在种子 0 下退化"——假话：`a` 先自增再被使用，种子 0 走的第一个状态就是 `0x6d2b79f5`，前八个输出互不相同。`(seed >>> 0) || 1` 真正做过的是让种子 0 与种子 1 成为**同一条流**，于是"换种子该换输出"那一半被悄悄废掉 | 去掉 `|| 1`；判据两条：种子 0 的八连输出无重复、且与种子 1 的流分得开 | 复算前八个输出 0.266429 / 0.000330 / 0.223272 / 0.146202 / 0.467328 / 0.545049 / 0.615251 / 0.648985 |
| M-11 | Minor | `String(options.areaCode ?? options.cityCode ?? options.provinceCode)` 两处洗白：数值 `110101` 被 `String()` 成全码；`cityCode: null` 被当成"没传"而静默放开整张 2,978 条县级表。`region.js` 的 `normalizePrefix` 刚为同一族收过口 | `prefixOf` 只接受非空字符串（空串与全空白也抛——"收窄到空"与"没收窄"是两种意图），别的形状一律 `TypeError` | B10 三档注入各点名所属字段 |
| M-12 | Minor | `today: '昨天'` 静默取墙钟 | 与 `parseIdCard` 同一口径抛，点名 `options.today` | B10 |
| M-13 | Minor | 生成器里 `if (isLeap(y)) y -= 2` 永不可达：能被上一行 `-= 1` 摸到的 `y` 必是奇数，而闰年必为偶数 | 删。不可达分支不配判据，注释改成实话（"留着它的唯一效果是让人以为这里还需要第二道兜底"） | — |
| M-14 | Minor | `parseIdCard(x, null)` 抛 `Cannot read properties of null`（`opts` 是可选参数）；`today` 收 `Date` 而 `birthDate` 拒 `Date`，两个入口口径分裂 | 两处统一（`opts ?? {}`；`toDay` 两入口共用） | B10 的两条对照断言 |

**变异台账（第八轮新增八行，全部在 /tmp 镜像实跑；跑法见 Task 8 的 `node -e` 那一套，锚点命中数不等于 1 就抛错，不允许静默不匹配）**

| 摘掉 / 注入的那一处 | 变红的判据 | 红在哪一句 |
|---|---|---|
| `randomBirthDay` 函数体整块回退成整改前的七行（C-1 的靶） | 只 B11（`# pass 25 / # fail 1`） | 「生成的生日真的落在请求的周岁区间里：生日没过不许少算一岁」；同一靶子按 `s = 1..60` 各 50 条数越界，给 19 条（种子集不同会给 18/20/24/30，所以口径连着构造一起写死在判据注释里） |
| 生成器 `pick = (arr) => arr[0]` + 重跑生成器出货（C-2 的病灶） | 只 B7 | `agree18 只取了 1/670 个不同区划码，取样池塌了，判据没有覆盖力` |
| **反向对照**：同一病灶留着，只摘掉覆盖力那一行 | 无（`# pass 26 / # fail 0`） | 两件事合起来说明：老判据没牙，而这一行是唯一咬得住的那一口 |
| 配额 `feb29_nonleap: 20 → 0`、名额挪给 `birth_before_1900`（合计仍 1,000，生成器照常出货） | 只 B7 | 「生成器的分组配额与计划规定值不符」 |
| 配额 `agree18: 670 → 1`、`agree15: 100 → 769`（670 条 agree18 样本塌成 1 条） | 只 B7 | 同上——整改前那三条自证断言在这一针之下全绿 |
| 配额 `agree18: 670 → 665`（合计 995） | 生成器自己 | `夹具总数 995 != 1000`，退 1 且不写盘；判据侧 B14 的 `--check` 随之红。**这道防线有两层**：改配额的人在生成期被拦，产物被换的人在判据期被拦 |
| `regionOk` 的 `false` 一支退回 `null`（I-4 的靶） | 只 B12 | 「区划 unknown 判结构非法；结构非法不出货解释性结论」 |
| `checkedRng` 的取值闸门整块删（I-6 的靶） | 只 B10 | 「入参闸门：坏类型与坏日历日期在入参阶段点名，随机源任何整数都是错」 |

两条与本轮无关但被本轮撞见的账，一并结在这里：① §4.10 末尾那句"没改、但下一轮要盯着"（B8 的顺序码口径）已经改完了，理由与复算口径写在 §4.10 原位；② 设计文档 §2.2 与 §8.1 有两处对不上仓库的口径——把站内旧库叫成 `id-validator@1.3.0`（仓库内那份的版本只由 `IDValidator.js` 文件头说话，是 **v1.2.0**），以及"对拍 10 万条随机号"（跑完即失、段 5 之后连参照物都没有）。两处都改成了"照现在跑得出来的构造"：3,465 条给了一条 `Object.keys(…).length` 的复算式，对拍给的是固化 1,000 条 + 七组配额 + 判据侧写死常量那一套，标准（两个独立实现同结论）一个字没降。

**整改批次自己的注释里也有两句"实测"复算不出来，是这一轮复核它时抓到的**（同一把尺子量自己）：C-1 那句"3,000 条里 20 条"没写种子起点，按 `s = 20260925..84` 跑是 18 条、按 `s = 1..60` 跑是 19 条，而它举的 `23082820081021721X` 在两个种子集里都不出现——那是条手搓的示意号（它本身成立：`parseIdCard` 判 `valid`、周岁 17）。现在 `idcard.js` 与 B11 两处注释都改成"构造 + 结果"连着写，并把那条号明标为手搓。**还有一类本轮没法复跑、只能转述的**：I-4 与 C-2/C-3 那些"整改之前几条判据一条都不红"的句子，它们的靶子在整改时已经被换掉（同一份判据回不到当时的形状），记的是整改当时在镜像上的观察。这类句子一律在句子里带了"整改前"三字，读的人按它去复跑会红得对不上——那是时态锚丢了，不是判据没牙。

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

Expected: `exit` 非 0，报 `Cannot find module '…/dev/js/tools/uscc.js'`——`await import()` 在文件加载期就抛，§A 的 12 条与 §B 的 9 条一起不跑。这是预期的红：模块不存在，不是判据写松了。

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

  // 3) 区划段：整段复用 §A 的六档回落。未收录只给 null，绝不下"无效"（§5.4）
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

Expected: `# pass 29`、`# fail 0`、`exit=0`（§A 12 条 + §B 9 条 + §C 8 条）。

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

Expected: `# pass 34`、`# fail 0`、`exit=0`（§A 12 条 + §B 9 条 + §C 8 条 + §D 5 条）。

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

段 1 交付的是"将来别人会依赖的东西"：算法表、区划口径、面板契约。这类东西最坏的失败模式不是红，是**绿着错**——判据与被测实现共用同一张表、同一种误解，测试永远亮绿灯。所以 Step 1 用五条变异反向证明判据有牙，一次改错一处，看它是否按预期变红、且红的正是该管的那条。

五条变异各自覆盖一种"复制粘贴就会错"的位置：字符表抄反、模运算少一步、属性值少一对引号、诚实措辞的分支被"简化"掉、类型闸门被"多余"名义删掉。**任何一条变异后仍全绿，就是在这一节里补判据，不许把断言删短。**

Step 2–4 是同方向的另一半：本段所有新文件都落在 `dev/js/tools/`（Vite 子目录不成入口）、`scripts/`（Jekyll 已排除）、`assets/data/`（`assets/**/*.md` 已排除）三个"应当完全不被产物看见"的位置。这个断言必须用产物证，不能用"我看过配置了"证。

- [ ] **Step 1: 五条变异，逐条确认它红、还原、复绿**

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

```bash
# M5 把"只接受字符串"的两处闸门一起摘掉：resolveRegion 开头的类型早退 + normalizeCode 里的类型判断。
# 两处必须一起摘：只删 normalizeCode 那道，resolveRegion 的早退还在，数值 110101 仍落到 none，
# A5 就还是绿的（实测只有 A12 红）——只剩一半的变异会让 M5 看起来通过而实际没复刻缺陷。
cp dev/js/tools/region.js /tmp/seg1/region.orig
node -e "const f='dev/js/tools/region.js',s=require('fs');let t=s.readFileSync(f,'utf8'),e=[[\"  if (typeof code !== 'string') return rejectRegion('');\n\",''],[\"  return typeof code === 'string' ? code.trim() : '';\",\"  return String(code ?? '').trim();\"]];for(const [a] of e){const n=t.split(a).length-1;if(n!==1)throw new Error('M5 匹配数不是 1：'+n+' / '+a.slice(0,32));}for(const [a,b] of e)t=t.replace(a,b);s.writeFileSync(f,t);"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>/dev/null | grep -E '^(not ok|# (pass|fail))'
mv /tmp/seg1/region.orig dev/js/tools/region.js
```

Expected（M5）：`not ok 5 - A5 六档回落链每一档的结论…` 与 `not ok 12 - A12 读侧六个入口的入参口径一致…` 同时红，`# pass 10`、`# fail 2`（实测 2026-09-25 逐字如此；还原后 `region.js` 的 sha256 回到 `267a8f50…`，与变异前 `diff` 逐字节为空）。这条是 Task 3 落地时补的，形状后来变过一次：计划原稿的 `resolveRegion` 用 `String(code ?? '')`、A5 要求裸数值 `110101` 落 `level:'none'`，两者直接冲突，于是先加了一道 `typeof code !== 'string' ||` 前置门；质量复核又把这道门挪进 `normalizeCode` 让四个入口共用（否则 `isGeneratable(110101)` 为 true 而 `resolveRegion(110101)` 落 none，两条入口互相打脸），M5 的靶子随之一分为二。用 `node -e` 而不是 `sed` 下手，是因为这些文本里有 `||`、引号与 `\n`，`sed` 的转义一旦写错就是**静默不匹配**（`sed -i ''` 匹配不到时退出码仍是 0），而这里先数了匹配次数、不等于 1 就抛错。

五条都还原后，复跑测试命令：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

Expected：`# pass 34`、`# fail 0`、`exit=0`。变异自证用 `cp` 备份 + `mv` 还原而不是 `git checkout --`：这段文件全部已提交，但本仓库常有第二个会话同时在 `main` 上改东西，`checkout` 会把它未提交的改动一起吃掉。还原后必须复跑而不是假定干净——`sed -i ''` 匹配不到内容时是静默成功的，M2/M3 若没变红，先确认 `grep` 的那一行还在（`grep -c "23456789X01" dev/js/tools/idcard.js` 之类），别改判据。

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

1. `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` → `# pass 34`、`# fail 0`、`exit=0`。
2. Task 8 Step 1 五条变异各自让预期那几条判据变红，且还原后复绿。
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
- **Task 8 的 M1–M4 四条 sed 已用计划正文抽出的代码块实跑核验**：每条匹配唯一（`grep -c` 变异前后 1↔1），M4 还原后两文件其余 5 处 `abolished` 用法仍在，说明 sed 的匹配范围没有溢出到 `regionOk` 判断与 `detail` 措辞。**M5 不在那四条之列**（它是 Task 3 落地时才补的），本轮另跑过一次：删掉 `typeof code !== 'string' || ` 之后只有 A5 红、`# pass 5` / `# fail 1`，`mv` 还原后 `region.js` 的 sha256 与变异前逐字符相同。**（这一条记的是它当时的实测：靶子后来随 FIX 批次一分为二，M5 的现行 recipe、红名单与理由以 Task 8 Step 1 的 M5 那段为准。）**
- **面板模块的构造参数 `prefix` 与 `toHash()` 返回 `''` 的两种形状，是原型阶段收敛出来的**：草稿里 `move()` 混用过 `.active` 与 `.active()`、`D4` 少一个 `});`，`node --test` 一次就抓到了。§D 判据 5 条在 `/tmp` 里跑过 `# pass 5 / # fail 0` 才抄进本文件。
- **Task 1 落地后按质量复核改了 `SOURCES.json` 的四条口径**（数据一字未动，四份快照的 `bytes`/`sha256`/`count` 全部复算不变）：① `ref` 与三份 `url` 从可前进的 `master` 换成 pin `6fb5380de7e6…`（tag `2.7.0`，实测三份字节与该 pin 全等），Task 3 的 `REMOTE` 同步换，`--fetch` 因此不可能拉到与记录不符的字节；② `license` 从 `"WTFPL-2.0"` 改成接口真给的 `WTFPL`；③ `licenseVerifiedVia: "…(HTTP 200)"` 换成 `licenseEvidence`，把结论挂到原文哈希上——一次成功的 HTTP 请求不是证据；④ `historical.licenseTextAt` 说清站内只有声明、MIT 的版权行与全文只在上游 `MIT-LICENSE`，Task 7 必须逐字抄。另注：`SOURCES.json` 仍由脚本生成，改的是计划里那段脚本。
- **§A 判据按质量复核加固五处，其中一条审查建议被有据否决**（`scripts/toolkit-tests.mjs` 与计划正文同步，回抽 diff 仍逐字节相同）：① `TODAY` 从 `new Date(Date.UTC(2026,8,25))` 改成字符串 `'2026-09-25'`——`idcard.js` 的 `toDay()` 对 Date 走本地分量，实测 `TZ=America/Los_Angeles` 下那个 Date 就是 09-24，而 §B 另有十几处直接传字符串，两种基准会随时区翻脸；② A4 的 `assert.match(out, /一致/)` 是假闸门（"不一致"含子串"一致"，实测 stub 打 `与快照不一致` 仍 `# pass`），改成 `/与快照一致/` 加一条 `doesNotMatch(/不一致/)`；③ A5 末行只扫 4 个抽样对象，升格为对全部现行县级 + 全部历史码扫 `fullName`；④ A6 那两行"从快照独立数一遍"里，`provinceCode==='11'` 那行被 `cityCode==='1101'` + 写死的 16 完全蕴含（北京只有一个市辖区），且两行用的都是生成器同一个判据，换成 `Map` 预聚合的逐市对账（实测 342 个 cityCode 两表全等、无孤儿、无空市，O(n)）；⑤ A2 的跨层互斥集补上 `省+'0000'` 形态、`b.note` 改 `b.note ?? ''` 并补 message。**否决 `describe` + `before()` 分段隔离**：实测 suite 形状下失败用例的 `not ok` 行是缩进的（`    not ok 2 - A2`），而 Task 8 Step 1 的四条变异判据全部按行首 `^not ok <用例名>` 锚定，改了就会只看到组名、点名不到该红的判据；`# pass` 计数倒是不变（实测两种形状都是 `# pass 3`），所以这条纯粹是判据形状冲突，代价与理由已写进测试文件头注释。
- **开工基线里有一个已归因的外部漂移，Task 8 Step 2 会撞上它**：`/tmp/seg1/assets-sha-before.txt` 录于 12:11，第二个会话 12:14 改了 `dev/js/editorial.js`、12:16 重建，`assets/js/editorial.min.js` 现为 `b18d9155…` 而基线里是 `a2e11cbd…`。本段一行代码都没落地（Task 1 只新增 4 份 JSON + 1 份清单，不碰 `dev/`、不碰 Vite 入口），所以**按 Step 2 既有的归因流程处理，不重录基线**：`git log --oneline $(cat /tmp/seg1/head-before.txt)..HEAD -- dev/` 查不到本段对该文件的改动，再 `git status --porcelain dev/js/editorial.js` 见到它是 `M`（别人未提交的改动）即可判定与本段无关，把这一条 diff 单独写进结论。`head-before.txt` 与 `git-before.txt` 保持不动。
- **Task 3 落地时计划自相矛盾一处，按判据为准收口**：plan 的 `resolveRegion` 写 `String(code ?? '')`、`@param {string|number|null}`，而已提交的 A5 要求裸数值 `110101` 落到 `level:'none'`——照抄实现则 A5 恒红（首跑实测 `not ok 5 … 'county' !== 'none'`）。改成 `typeof code !== 'string' ||` 前置门 + note 补"字符串"三字，理由不是位数而是类型：`Number` 表达不了前导零，静默 `String()` 会把调用方的类型错误藏成一次"成功解析"。影响面实测为零（计划内三个调用方传的都是字符串；全计划无一处断言那句 note 文案），并为此在 Task 8 补了 M5。计划正文的两处（`@param` 行与那道 `if`）已回填，三块代码与磁盘文件的 diff 仍逐字节为空。
- **A3 的预算从 34KB 抬到 36KB，是量出来的不是让出来的**：钉死输入下产物实测 100,020B 原文 / 34,807B gzip，34KB 这条只剩 **9 字节**余量；而同一份字节换 `level 6→9` 差 194B、换 `strategy` 到 `Z_FILTERED` 在同级下分别高 2,275B（level 6）与 2,230B（level 9，本机 Node v22.19.0 实跑；这一批当时记的"level 9 下高 2,036B"是拿 level 6 基线相减的错位口径，第四轮已改）。9 字节挡不住压缩器抖动，那条判据会从"防体积回退"变成"防今天用哪个 Node"。抬预算只吸收抖动、不给数据增长放行：同样这些信息量退回朴素 `JSON.stringify`，两版可复算构造是 262,233B / 47,559B(L6) / 44,578B(L9) 与快照原样（历史层 3,465 条全量）451,217B / 66,821B / 62,819B，都在 36,864B 之上（这一批当时还记着第三版 260,533B / 47,443B / 44,425B，第四轮证明它取不到构造，已删）；但**只去掉历史层剩三表是 189,401B / 34,475B / 32,309B，朴素编码照样过预算**——这条判据咬的是"编码退回朴素且数据仍带历史层"这一整件事，不是单独一种口径变化。设计文档 §7 里两个估计（92.6KB/31.9KB、32.5KB）偏低约 2KB，已按实测口径改写，差额未逐项归因。
- **规格复核又抓出 5 处口径没跟着走，都是文档级但每一处都会误导下一个人**：① §0 表里"§7 预算 30KB→34KB / 实测 31.9KB"这一行的两个旧值同步为 36KB / 34,807B；② Task 3 Step 2 的 Expected 从 `≈95KB 原始 / ≈32KB gzip` 改成实测 `97.7KB / 34.0KB`，并把"不要直接抬预算"那句改写成分叉判据（先核 counts，全对才回到 §7 重量）；③ Task 8 Step 1 标题"四条变异"→五条；④ 生成器与 §6.5 都写 `generatedAt`，产物里的真名是 `snapshotFetchedAt`，两处一起改；⑤ **生成器的自报体积用的是 `output.length`（UTF-16 码元数），50,104 个字符报成"48.9KB"，而落盘是 100,020 字节——一个贴着 36KB 预算的判据，配一条少报一半的日志，比没有日志更危险**。改成 `Buffer.byteLength()`，删产物重生成后 sha256 仍是 `a7e26d54…`（只有日志变，产物一字未动），§A 仍 `# pass 6`。
- **质量复核的 FIX 批次落地，`§A` 从 6 条长成 12 条**（三个文件回灌后与计划正文逐字节一致；判据/生成器/解析器三块的行号区间会随每次注释增删整体位移，所以这里不记数字，要核就按内容锚点重算一遍）。修的是复核点名的八处，其中五处在生成侧、三处在读侧：`assertShape` 不查 `name`（缺字段的行被 `String(undefined)` 洗成合法字符串，产物里编出 `02undefined`、读侧解出「北京市undefined」，而 §A 原有六条一条都不红）；历史层是 `Object.entries()` 裸消费（`legacy['110224']=null` 条数不变，产物编出 `110224,null`）；旧表 5 位键能过；`ARGV.includes` 让 `--chek` / `--CHECK` / `-h` 静默走"生成并覆盖"支路且退出 0；`--fetch` 先 `writeFileSync` 后 `verifyManifest`（限流页返回的 200+HTML 会直接覆盖 git 跟踪的可复现输入）；读侧 `resolveRegion` 与 `isGeneratable` 各写各的 `String()`（`isGeneratable(110101)` 为 true 而 `resolveRegion(110101)` 落 none，`isGeneratable(' 110101 ')` 为 false 而 `resolveRegion` 解出东城区）；被拒入参照抄切片回显（`resolveRegion(110101)` 在 `level:'none'` 旁边挂着 `province:'北京市'`——被拒绝的数字旁边显示一个地名，正是这层要防的"看着像成功了"）；`Object.create(null)` 让 `String(code)` 抛 TypeError，违反本层"永不抛、任何入参都拿到同一套 11 个键"的自定契约（§5.4 只规定"区划查不到时其余项照常判定"，这条契约不是它写的）。
- **新增的六条判据每一条都摘过牙**（23 次变异在 tmpdir 副本上逐条实跑**全量** §A，仓库文件全程只读；下表"变红的判据"是实测红名单，不是推断。前 15 行出自第一轮 FIX，后 8 行出自第二轮复核，加粗的"加固前"记的是同一变异在判据补齐之前的实测结果——那正是这一轮补它的原因）：

  | 摘掉的那道闸门 | 变红的判据 | 红在哪一句 |
  |---|---|---|
  | `assertShape` 的 name 类型闸门 | A7 + A11 | 县级行删掉 name 字段：生成器竟然退出 0，坏数据会一路编进产物（**第五轮改过这一格**：内层那道兜底闸门删了，红从"报错没指认表名"变成"退出 0"，见下面的连带红说明） |
  | 历史层 `assertShape` | A7 | 历史层某条的值是 null：报错没指认是哪张表（历史层） |
  | 父子码前缀校验 | A7 | 市级行的父码对不上：生成器竟然退出 0 |
  | `assertNoDelimiters` 调用 | A7 | 县级名里带全角逗号：生成器竟然退出 0 |
  | `.concat([[历史层]])` 的双层数组 | A4 + A7 + A8 + A10 + A11 | 哈希闸门没指到历史层那一份 |
  | 读侧 `fields()` 字段闸门 | A9 | RAW_PROVINCES 的分隔符被换掉后模块安静加载 |
  | 读侧条数对 `REGION_META.counts` | A9 | 截掉 20% 的县级表没人报错 |
  | 读侧 schema 判定 | A9 | schema 改成 2 没人报错 |
  | 县级 token 序号前缀闸门 | A9 | 县级组里少了序号前缀的 token 安静加载，编出了一个假县 |
  | `parseArgs` 未知参数拒绝 | A10 | `--chek` 被当成没写参数，直接跑进生成分支 |
  | `--check` 与 `--fetch` 互斥 | A10 | 报错没匹配 `/互斥/` |
  | `--fetch` 的输入闸门 | A11 | 形状没过的响应已经落盘了 |
  | `normalizeCode` 的类型判断 | A12 | `number:110101` 在 `isGeneratable(…, 'county')` 那里被放行了 |
  | `rejectRegion` 的空派生字段 | A12 | `string:"11010"` 被拒了却带出 `province="北京市"` |
  | `isGeneratable` 的层级表（退回旧三元表达式） | A12 | 同上，且 `province` 档静默落进市级 |
  | `assertShape` 的父码校验从"逐字相等"退回 `startsWith` | A7 | `市级行的父码只剩一位：前缀成立、位数不成立：生成器竟然退出 0，坏数据会一路编进产物`——**加固前这条正是那 12 条全绿的漏网输入**，产物里 `currentCityCodes('11')` 成了空数组 |
  | `currentCountyCodes` 的 `normalizePrefix` 门 | A12 | `number:110101 必须空集，给全表等于一次类型错误出货 2,978 条地址` |
  | `currentCityCodes` 的 `normalizePrefix` 门 | A12 | `number:110101 必须空集，不给收窄不许回落成全表` |
  | 两道 `normalizePrefix` 一起摘 | A12 | 仍只红 A12、仍只出县级那一句（`deepEqual` 在第一个坏值就抛，两条断言不会同时出现在输出里）——所以"两句都红"这种验收写法是假的，摘法三种实测全是 `# pass 11 / # fail 1` |
  | 历史层 `level` 的三元表达式硬编码成 `'county'` | A5 | 莱芜市是历史市级，不是历史县级——**加固前同一变异 12 条全绿**，`371200` 那档从没被任何判据看过 |
  | 生成器里的上游域名换掉、判据不跟着改 | A10 + A11 | 副本源码里的上游 URL 命中 0 处，这两条判据假设的是 3 处——**加固前 A10 假绿**：它那句 `replace` 匹配不到就原样返回，整条用例其实一次网络都没发，红不红取决于本机 DNS |
  | 闸门 helper 往仓库产物写一个字节 | A9 + A10 + A11（`# pass 9 / # fail 3`） | `importRegionWithPatchedSource 动过仓库里的产物`——产物是这三条共用的输入，谁被写坏谁就红 |
  | 闸门 helper 往 `scripts/fixtures/region-source/` 写一个字节 | A7 + A8 + A10 + A11（`# pass 8 / # fail 4`） | `runGeneratorOn 动过仓库里的快照`，快照是 git 跟踪的可复现输入，四个用到它的用例一起红 |
  | 读侧"父级市在历史层"那一档整块删掉 | 只 A5（`# pass 11 / # fail 1`） | `371299` 的 status/level/fullName 三项一起不符：abolished/city「山东省莱芜市」退成 uncoded/province「山东省」。**加固前同一变异 12 条全绿** |
  | `joinNames` 的市名前缀剥离 | 只 A5 | 「广东省东莞市东莞市」≠「广东省东莞市」。**加固前 12 条全绿**：快照里 19 条现行县名自带市名前缀，一条都不红 |
  | `currentCityCodes` 退回 `slice(0, 2)` 放宽 | 只 A12 | 前缀 `'4419'` 的收窄条数不符（给 21 条 = 整个广东省） |
  | 生成器的 code 类型闸门 | 只 A7 | 注入"市级行 code 是数值 1101"之后生成器退出 0——**加固前同一注入红 A1 + A2 + A7（`# pass 9 / # fail 3`，A12 实测是绿的）**，而 A7 那道红来自它的 `findRow` 助手匹配不到数值码行，不是闸门在说话 |
  | `assertParentsExist` 整道 | 只 A7 | 注入"孤儿县 119901（父码 1199 表里没有）"之后生成器退出 0 |
  | `assertParentsExist` 只删市级那个循环 | 只 A7 | 注入"新设市 9901（父码 99 不在省级表）"之后生成器退出 0——**这一行就是"两个分支各钉一条注入"的理由**：只留县级那条，删掉市级分支没有任何判据会红 |
  | 清单的 `bytes` / `count` / `schema` 各改一处（共四次注入） | 各只 A8 | 例：`areas.json 的 count 注解与表里实际条数不符`。生成器只看 sha256，这三样在门里是惰性的，腐烂了没人发现 |

  上表最后七行是第五轮（质量复核）补的，变异都在 `git archive HEAD` 之后覆盖工作区三文件的 /tmp 镜像上跑，基线 `# pass 12 / # fail 0`。**反向对照一例**：把删掉的 `assertNoDelimiters` 内层名称闸门原样补回去，12 条判据一条都不红——一道永远触发不了的闸门本身就是要防的东西，删它的依据是这一句，不是"看着冗余"。

  两处连带红不是判据互相依赖，是同一道闸门本来就被两条路径看着：摘 `assertShape` 的 name 闸门后 A11 也红，因为 `--fetch` 的 S3 场景断言的是**报错要指认到"县级"这张表**，而 name 闸门是报错里唯一的层级名来源。（第五轮之前这里写的是"闸门一摘，兜住它的只剩 `assertNoDelimiters` 内部那道类型门，那句的 scope 是'快照'而不是层级名"——那道内层门已经在第五轮删了，它当时确实会把报错接住、只是接成了没有层级名的一句；现在接不住，`undefined` 一路编进产物，两条判据一起红在"生成器竟然退出 0"。）`manifestPairs` 那一处一摘就连红五条（A4/A7/A8/A10/A11），因为 `verifyManifest` 与写进产物的 `REGION_META.sha256` 共用这一个推导，摘掉之后四条真哈希变成 `{'g':undefined,'b':undefined,…}` 的按字符拆解，`got !== undefined` 恒成立，**生成器从此对任何输入都拒绝出货**——这正是 A8 那条"两条消费路径必须出自同一份推导"想要的样子：拆共享点会立刻大面积红，而不是安静地少校一份。

  两处"只摘一半不算数"记在这里省得下一个人重踩：A9 的县级 token 闸门是复核批次的漏网之鱼——它拦的是 `01东城区` 少掉 `01` 之后凑出的假码 `1101东城`，条数照旧 2,978，字段闸门与条数自检都看不见，补注入用例之前它一条判据都不挂；M5 摘 `normalizeCode` 那道类型门时 `resolveRegion` 自己的早退还在，A5 仍绿，只有 A12 红，所以 Task 8 的 M5 现在是两处一起摘（实测 `# pass 10 / # fail 2`，A5 与 A12 同时红）。
- **A11 用 `spawnSync` 起子进程会挂死整份 §A**：这条判据要把生成器的 `--fetch` 成功路径真跑一遍，父进程必须同时当那台上游服务器，而 `spawnSync` 停在系统调用期间事件循环是不转的——子进程卡在 `fetch()`、父进程卡在 `waitpid`，实测 `--test-timeout=6000` 下恒为 `test timed out after 6000ms`，整份 §A 一个数字都出不来。改成 promisify 的 `execFile` 并在用例上显式写 `{ timeout: 20000 }`：**判据挂死比判据红更糟**，红会指名道姓，挂死只让整组静默没有结论。
- **读侧新增的自检不是给生成器那道闸门重复上一遍**：`region.js` 载入时把四张索引的条数与产物里 `REGION_META.counts` 逐项对表，schema 不是 1 就抛。它与生成侧 `assertShape` 的分工是"生成侧管进来的数据形状对不对，读侧管这份产物是不是被换过或截断过"——实测把 `RAW_COUNTIES` 截掉 20%（字符串完整闭合、语法零告警）模块照样加载成功，浏览器里就是 2,389 个县对着一份声明 2,978 条的元信息全静默（这条截法在 2026-09-25 复算过一次，抛出的原话是 `解析出 2389 条 counties，元信息声明 2978 条`）。两道缺一条就有一类损坏安静出货。
- **`provinceName` / `cityName` 保持"前缀查表"，没有顺手加位数校验**：A12 起初断言"被拒入参在四个入口都得不到名字"，实测 `'11010'` 在 `provinceName` 里解出北京市（取前 2 位）——这不是漏洞：面板拿着 6 位县码问省名是正常用法，位数不等于建制结论。改成把这条口径显式写进判据（`provinceName('110101')==='北京市'` 与 `provinceName('99')===''` 各断一条），只把非字符串入参统一成 `''`。**否决质量复核"最小修法"里删掉 `isGeneratable` / `provinceName` / `cityName` 的建议**：理由是设计文档 §6.3 的 `#idcard` 面板要求「区划（省→市→县三级级联，只出现行码）」，这三个导出就是级联的地基，零调用点只因为面板还没落（Task 6），删了是打断下一段而不是缩小改动面。
- **一处我自己写错的事实纠正**：`historicalNote` 的注释原先拿 63 条"码未变而名已改"（130502 桥东区→襄都区、210112 东陵区→浑南区等）当历史层样本，断言它们是"同码改名的历史建制"。实读产物：这 63 条按县级命中现行表，`status` 是 `current`、根本不在历史层里；历史层那 1,229 条的四种成因换成 110103 崇文区（真撤销）/ 320801 淮阴市市辖区（随父级改名）/ 110200 北京市县、500300 重庆市(市)（旧表口径没有这一档）/ 460037 海南省西沙群岛（统计口径），五个样本逐个实读 `status` 均为 `abolished`。三个分母各是什么也钉进注释：1,934（旧表 6 位键逐字命中现行县级表，含那 63 条改名）/ 2,236（`legacyHitCurrent`，按其自身层级命中）/ 1,229（历史层本身），`3465 − 1229 = 2236` 那条自检等式只对第三个分母成立。
- **第二轮复核又抓出六处，其中三处的问题是"判据自己没牙"而不是实现写错**（`region.js` 现为 `267a8f50…`、`build-region-data.mjs` 为 `534d5e88…`；产物字节一字未动，仍是 `a7e26d54…`；§A 收口时 `# pass 12 / # fail 0`）：
  ① **生成侧那道父码闸门挡不住位数不足的父码**：`assertShape` 原本查 `code.startsWith(parent)`，`1101` 配 `provinceCode:'1'` 成立就放行，而读侧是按前 2 位分组的——同一行在生成侧的父亲是 `'1'`、在读侧是 `'11'`。实测注入这一条之后生成器 exit 0、12 条判据全绿，产物里 `currentCityCodes('11')` 成了空数组。改成与 `code.slice(0, len - 2)` **逐字相等**，A7 补第 7 个用例，把校验退回 `startsWith` 之后只红 A7 那一句。等式上面不需要再叠一位数正则：`code` 自己已过数字码形，任何与 `code.slice(0, len-2)` 相等的值自动就是那么多位数字——第一版顺手加了，因为 A7 的新用例会红在"位数"而不是"不相等"上，判据咬错了条件，已删。
  ② **读侧两个取码集合的入口没有类型门**：那两条入口当时各写一句 `String(x ?? '').trim()`，而 `''` 在这两个入口的语义是"不收窄、给全表"——`currentCountyCodes(null)` 因此出货整张 2,978 条县级表，`currentCountyCodes(Object.create(null))` 直接抛 TypeError（本层对外的承诺是不抛），`currentCountyCodes(1101)` 给 16 条而 `isGeneratable(1101, 'city')` 是 false，同一份数字一个入口认、一个入口不认。新增 `normalizePrefix`（与 `normalizeCode` 同一条类型规则，非法给 `null` 而不是 `''`，正是为了不把一次类型错误放大成全表），A12 从四个入口扩到六个。摘法实测三种（只摘县 / 只摘市 / 两处一起），三种都只红 A12、都是 `# pass 11 / # fail 1`，一句都不牵连别的判据。
  ③ **两条"看着像断言"的判据其实没有牙**：解析器给历史层定 `level` 的那条三元表达式（`code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county'`）整条硬编码成 `'county'` 之后 12 条全绿——`371200`（莱芜市）那一档从没被任何判据看过；补三条断言（市级 `level`、`note` 起手必须是「所属地市」、`county` 必须为空）再加一条"历史层不许出现省级形码"，同一变异现在只红 A5 那一句。A10 的上游 URL 原本是用 `replace` 换进副本源码的，域名一漂它就静默原样返回，那条用例其实一次网络都没发、红不红取决于本机 DNS——抽出 `rewriteUpstreamUrls` 并断言命中 3 处，域名漂移时 A10 与 A11 同时红（`# pass 10 / # fail 2`）。
  ④ **"仓库快照没被动过"从人肉检查降进 helper 出口**：A7/A8/A9 那三条此前靠用例各写一句，而真可能伸手的是 `runGeneratorOn` 与 `importRegionWithPatchedSource` 两个 helper。加 `repoFingerprint()`（产物字符串 + 快照目录逐文件 sha256）与 `assertRepoUntouched`，挂在两个 helper 的 `finally` 之后：往产物写一字节 → A9/A10/A11 一起红（`# pass 9 / # fail 3`，三条共用同一份产物），往快照写一字节 → A7/A8/A10/A11 一起红（`# pass 8 / # fail 4`，四个用例都从快照起 tmp 副本）。顺手把 `makeTmpRepo` 里读源码那一步挪到 `mkdtempSync` 之前，抛错时不再遗留空 tmpdir。
  ⑤ **三处抄进文档的数字当时并没有真算过，现在改成立即可复算的形式**：A3 注释里的"朴素 JSON 276.5KB / 47.1KB / 44.2KB"、设计文档 §7 的"62.7KB gzip"与"生成器与解析器各只有 10 行"，三句都取不到可复现的构造口径。现在把构造写死（四张表 31/342/2,978/1,229 行，列名 `provinces{code,name}` / `cities{code,provinceCode,name}` / `counties{code,cityCode,name}` / `historical{code,name}`，即把生成物反解回行对象再朴素 stringify），当时记为 260,533B 原文 / 47,443B（level 6）/ 44,425B（level 9）——**这三个数第四轮复核复算不出来，已被删掉，写死的构造实际给的是 262,233B / 47,559B / 44,578B**；`strategy` 那两个数补上各自的 level（同级下 Z_FILTERED 高 2,275B(level 6) / 2,230B(level 9)；当时那句"level 9 下高 2,036B"是拿 level 6 基线相减出来的错位口径，第四轮已改）；"各只有 10 行"换成实测 374 行 / 369 行（读侧那 369 行是当时的值，第三轮补断言后为 372 行），并说清编码本身占不到两成；截断自检那句的"2,394 个县"复算为 **2,389**，连抛出原话一起记下来。同批把 `Object.create(null)` 那条的归因从"违反 §5.4 的永不抛"改成本层自定契约——§5.4 只规定"区划查不到时其余项照常判定"，"永不抛"不是它写的。
  ⑥ **一处命名与规格对不上**：回落链是 §5.4 的六档，我和判据一起把它叫成"四级回落"（混淆来自 `level` 只有四档取值，而链子有六步）。A5 用例名、`region.js` 头注释、§0 架构图、§C 那句注释全部改为"六档"，Task 8 的 M5 Expected 红名单随之换成实测的 `A5 六档回落链…` 与 `A12 读侧六个入口…`。
- **第三轮规格复核两处，一处是我自己把"可复算"写成了口号**：
  ① 上一批刚把朴素 `JSON.stringify` 的体积改成"写死构造就能复算"，复核员按同一口径复算得到 **262,233B / 47,559B / 44,578B**（我这一版记的是 260,533B / 47,443B / 44,425B）——当时我的结论是"把列名与行数写死仍然不够，反解成行对象有好几种合法写法，数就是会浮动"，于是把三版一起摆进 A3 注释与 §7。**这个结论第四轮被推翻**：复核员说那一版按构造复算不出来，我随后自己摊成 320 种写法重跑，最接近的差 1,650B（见下方第四轮 ①）——那一版不是"另一种合法写法"，是压根没有构造支撑的抄错数；而我"写死"的那句构造（单对象套四表、行形状 `{code,name}` / `{code,provinceCode,name}` / `{code,cityCode,name}` / `{code,name}`、历史层走生成器那道按层级查现行的判据）本身是可复算的，给出的正是 262,233B / 47,559B / 44,578B。第四轮据此删掉不可复算的那版，A3 注释与 §7 只留两版能照着跑出来的构造（另一版是快照原样 stringify 的 451,217B / 66,821B / 62,819B），并把反例留在原地封口：**同构造只去掉历史层剩三表是 189,401B / 34,475B / 32,309B，朴素编码照样过得了 36,864B 的预算**；超的量出在那 1,229 条历史码上（同构造下朴素口径多 13,084B gzip，不是当时写的 12,968B）。所以"退回朴素编码必红"这句是半句假话，判据真正咬的是"编码退回朴素 **且** 数据仍带那 1,229 条历史码"这一整件事，写清楚了比留着那句口号有用。
  ② `historicalNote` 与 §5.4 从来没对上过，而 `region.js` 的头注释自称"已同步回填进设计文档"——那句是假的：§5.4 一直写着统一措辞「未见于现行区划表（历史口径 2015）」，代码给的是「（截止 2022-10-31）」。**这一处修的是文档不是代码**：决定"查不到"这件事的是现行表的截止日，2015 是历史层自己的口径，记在 `SOURCES.json` 与产物头注释里，不该塞进给用户看的一句话。但复核顺带抓住一句真的越界——尾句「**通常是**撤销建制、改码或改名」是一句没统计过的概率断言（历史层 1,229 条的四种成因：真撤销 / 随父级改名 / 旧表口径没有这一档 / 统计口径，一条都没逐条数过），改成「**可能是**」。§5.4 那条 bullet 的理由也实测推翻：它拿 63 条同码改名当"不能断言已撤销"的依据，而这 63 条 `status` 是 `current`、根本不在历史层里，真正的依据是四种成因 + 本站没有码→码的取代关系可给；"市/省级都补所属地市"里省级那一档实测不可达（历史层 0 条 `xxxx0000`，A5 已断言），实现只做市级。
  ③ §5.4 那句「不得断言已撤销建制」此前只是文档里的话，代码改一个字都不会红。A5 补三条把它钉住：括号必须是现行表截止日、整句不得出现"已撤销"、尾句必须是"可能是"。三条各自跑过变异，三种都只红 A5、都是 `# pass 11 / # fail 1`——把尾句换成「已撤销建制」、把括号换回「历史口径 2015」、把「可能是」写成「通常是」。加粗的那句文案是三段共用的（身份证、统一代码、地址面板都从这里取话），所以这一轮的改动会一路传到段 2 的 B6/C6 断言上，别在那边重新发明措辞。
- **第四轮规格复核三处，都是"数字抄错了却写成实测"**：
  ① **260,533B / 47,443B / 44,425B 那一版取不到任何构造，删**。我自己把"朴素 stringify"的写法摊成网格复算：四张表各自的列集与键序 × 历史层五种取法（1,229 行带/不带 `level`、快照全量 3,465 条、过完码形闸门的 3,465 条、原样 map）× 四种包裹方式（单对象 / 四数组 / 短键名对象 / 四段分别 stringify 再拼），共 **320 种**——最接近的原文是 262,183B，差 1,650B，**没有一种落在 260,533±400 之内**。而我当成"写死的构造"那句话本身是可复算的，跑出来正是 262,233B / 47,559B / 44,578B（单对象那一种包裹）。也就是说第三轮那条"数就是会浮动"的解释是错的：浮动是假的，那一版压根没跑过。A3 注释与 §7 现在只留两版跑得出来的：262,233 / 47,559 / 44,578 与快照原样（`counties` 连 `provinceCode`、历史层 3,465 条全量）451,217 / 66,821 / 62,819；差量随之从 12,968B 改成 13,084B（47,559 − 34,475，同构造去掉历史层是 189,401 / 34,475 / 32,309）。顺带量清浮动到底出在哪：同一句构造只让 `counties` 多带一个 `provinceCode`，raw 从 262,233B 涨到 321,793B 而 L6 只从 47,559B 涨到 49,510B——涨的是重复键名的字节，gzip 把它们压掉了大半，所以"朴素口径"这种说法不谈构造就没有意义。
  ② **「Z_FILTERED 在 level 9 下高 2,036B」是错位口径**：那是 36,843B（L9+FILTERED）减 34,807B（**L6** 基线）。统一成同级相减之后是 level 6 高 2,275B（37,082 − 34,807）、level 9 高 2,230B（36,843 − 34,613）。A3 注释与 §7 那两处口径已改。
  ③ **§7 的"读侧 369 行"是被上一轮自己改红的**：369 是 `3723917` 的值，`6573e23` 补完 A5 三条断言之后是 372 行（逐 commit 核过：`eed1b52`=347、`3723917`=369、`6573e23`=372）。同类漂移这次一并防住：计划里三块代码的行号区间全部由脚本按**内容锚点**重算（`/tmp/resync4.cjs` 那一类），本轮三块与磁盘逐字节一致。区间的具体数字不写在这里——第四轮光是收口这一处就让 A3 注释长了几行、三个区间各位移一次，抄进文档的下一句就会过期；要复核就跑那段脚本看它打出的区间。
  这一轮之后立一条规矩：**文档里凡是"gzip = 某字节数"的句子，旁边必须写出跑得出来的构造**（哪个对象、哪些键、历史层走哪道判据、跟哪条基线相减），否则不许写成"实测"。①里那版就是靠"构造写得很像话、数字却不是它算的"蒙过前两轮复核的。
- **第五轮是代码质量复核（不是规格复核），五条 Important 全落在"判据没看着的地方"，另加四条 Minor**（`region.js` 389 行、`build-region-data.mjs` 428 行，复算见 §7 那句 `wc -l`；产物字节一字未动，仍是 `a7e26d54…`；收口 `# pass 12 / # fail 0`）：
  ① 读侧"父级市在历史层"那一档（`resolveRegion` 的 `histCity` 分支）**整档零判据**——删掉它 12 条全绿，而 `371299` 从 abolished/city「山东省莱芜市」退成 uncoded/province「山东省」。A5 补三条（三项结论 + note 那半句 + `county` 必须空）之后同一变异只红 A5。
  ② `joinNames` 不处理市名与县名重叠，全名里同一段地名出现两次。这一条我原本只当它是 4 个码的小事（441900 东莞 / 442000 中山 / 460400 儋州 / 620201 嘉峪关，市名==县名），按快照实数是 **19 条**：另外 15 条是县名自带市名前缀（130272「唐山市汉沽管理区」挂在 1302 唐山市 下，全是 2022 口径里的功能区）。所以修法不是给那 4 个码开列清单，而是剥掉重复的前缀那一段；判据同时升格成全表扫描（现行 2,978 + 历史 1,229 条全名一律不得有相邻重复的 ≥2 字面，历史层实测 0 命中）。
  ③ 生成器的 `assertShape` 有 name 的类型闸门却没有 code 的：`String(row.code)` 先把数值 `1101` 洗成合法码串，而 `build()` 里那三个"按层级查现行"的 Set 存的是**原始值**，于是旧表的 `110100` 在市级查不到、凭空多出一条历史码。实测注入之后生成器 exit 0，红的是 A1「historical: 1230 期望 1229」与 A2「110100 同时出现在两层」两道（`# pass 9 / # fail 3`）；第三道红是 A7 自己的 `findRow` 助手在数值码上找不到 `1101` 那一行，与闸门无关——没有一道的报错说得出坏的是哪一行的类型；读侧毫无异常（`110100` 照样解成「北京市」）。补 code 类型闸门，A7 第 8 条注入它。（这一句初稿写的是"A1/A2/A12 三道条数不符"，第六轮复跑证伪：注入之下 A12 是**绿**的，红的是 A7，而 A7 那句红根本不是判据在说话。同类错误在 §生成器注释与 A7 用例注释里各有一份，三处一起改。）
  ④ 父码只有"逐字等式"却没有"存在性"：`119901` 的 `cityCode` 是 `'1199'`，前 4 位等式成立而市码 `1199` 根本不存在。实测注入之后生成器 exit 0，红的三道里 A9 那句是「产物被截断，或编码格式与解析器已经不同步」，**指错了方向**；而 §B 的 `--fetch` 流程本来就要求人在新数据进来时上调 `REGION_META.counts`，拿条数当唯一防线等于把闸门写在会被顺手改掉的注释里。补 `assertParentsExist`（市查省、县查市），两个分支各钉一条注入——只钉县级那一条时，删掉市级那个循环没有判据会红。
  ⑤ `currentCityCodes` 把任意长前缀一律 `slice(0, 2)` 回去查省索引，`'4419'` 给 21 条（整个广东省）而 `currentCountyCodes('4419')` 给 1 条：同一个"前缀"在两个入口是两种意思，随机地址面板同时用这两个入口就是错数据。A12 原本还把这种放宽**当成期望值**钉着（`currentCityCodes(padded) === currentCityCodes('11')`），改口径时那一句必须一起改，不然判据站在旧行为那边。现在契约是"前缀只收窄、绝不放宽"，`['44'→21, '441'→8, '4419'→1, '44190'→0, '441900'→0]` 五档条数写死，并逐项复算"结果都匹配前缀"。
  四条 Minor：`isGeneratable` 里 `!tier.len` 永远触发不了（三档 `len` 都是硬编码的非零数），删；`assertNoDelimiters` 内层那道名称闸门在唯一调用方之后永远不会单独触发（实测补回去 12 条全绿），删并把两处注释改成实话——**连带变异台账里"`assertShape` 的 name 类型闸门"那一行与"两处连带红"那段的归因一起改**，它们当时依赖的正是这道内层门；A7 的正向对照注释写着"上面六条"而用例已有十条，改；`SOURCES.json` 的 `schema` / `bytes` / `count` 三样没有任何代码看（生成器只认 `sha256`），既然 §B 要求人照着它们核对新抓取的数据，就在 A8 里按真实字节复算，四次注入各只红 A8。`historical.extractedFromSha256` **故意不核**：那是 `demo/idCardDemo/lib/GB2260.js` 的哈希，段 5 删掉 demo 之后这条断言必挂，而它是归属证据、不是输入依赖。
- **第六轮是第五轮整改的复审**（复核者逐项复算，结论是五条 Important 的**代码与判据全部成立**：19 条重叠独立复算吻合、五档前缀表 21/8/1/0/0 实跑全对、九组变异的红名单与台账一致、计划三块与磁盘逐字节相同；剩下的三条全在"注释说了一件没发生过的事"）：
  ① **Important：③那一句"A1/A2/A12"是我自己新写的、任何状态下都复算不出来的实测句**（生成器注释、A7 用例注释、本计划第五轮 ③ 各有一份）。复算口径：`git archive HEAD` 建镜像 → `cities.json` 里 `code` 改成数值 `1101` → 重封清单 → 生成 → 跑判据 = `# pass 9 / # fail 3`，红 A1（`historical: 1230` vs `1229`）、A2（`110100 同时出现在两层`）、A7（原文 `error: '快照里没有 1101 这一条，注入无从下手'`——**这条红是测试助手自己的失败，不是闸门在说话**），A12 全程绿。三处一起改成"红的是 A1 + A2，第三道红是 A7 的 findRow 助手"。这一条的教训不是"数字要核"（第五轮已经立过），而是**红名单也要核**：A12 是当时手边最像"条数判据"的一条，就被顺手写进去了。
  ② **Minor：注释里引用别的文件的位置，用行号等于埋一颗定时炸弹**——`toolkit-tests.mjs` 的 A3 注释里有一句写着"生成器那道按层级查现行的判据 `build-region-data.mjs:204-217`"，而第五轮在同一个文件里插了 `assertParentsExist`，那段区间现在装的是引用完整性那道闸门，判据本体已经移到 `build()` 里的 `curCounty`/`curCity`/`curProv`。改成按名字锚（函数名 + 变量名），复算的人照名字 grep 就行，不必担心位移。同类还有生成器自己注释里那句 `build-region-data.mjs:53`（`parseArgs` 插了参数白名单之后也漂了），一起换成 `parseArgs`。三份代码文件里的行号引用现在为 0。`SOURCES.json` 里指向 `demo/idCardDemo/lib/*.js:2` / `:6` 的两处**不动**：那是站内旧副本的原文摘录、归属证据，段 5 删 demo 时要连着 `historical.extractedFromSha256` 一起处理，不在本轮范围（清单本身不被自己核 sha256，所以改它不会立刻炸出判据——正因为这样更不能顺手改）。
  ③ **Minor：描述旧行为的句子丢了时态锚，读的人会以为它在说今天**。A5 那段"把 `joinNames` 的中段改成不做前缀剥离，12 条判据一条都不红"在整改前为真，整改之后恰好相反——复跑：摘掉剥离那一行 → `# pass 11 / # fail 1`，只红 A5。补"整改前"三字，并把今天的红名单一并写上。
  三条都只动注释与文档，产物字节一字未动（`a7e26d54…`），收口 `# pass 12 / # fail 0`、`--check` 退出 0；行数变成 431 / 389 / 851（`wc -l scripts/build-region-data.mjs dev/js/tools/region.js scripts/toolkit-tests.mjs`）。复核者另记一条**未处理观察**：`currentCityCodes('4')` 返回空集而 `currentCountyCodes('4')` 返回数百条，1 位前缀在两个入口的收窄强度不一致——它不违反"只收窄不放宽"的承诺，本轮也没有为它立主张，所以不改，留到 Task 8 一并钉口径。
- **第七轮是 Task 4 的规格复核（八条偏离记在 §4.10），第八轮是它的代码质量复核（3 Critical + 7 Important + 4 Minor，逐条与变异台账记在 §4.11）**。§B 从 9 条长成 14 条（新增 B10–B14），夹具重新生成一次：1,000 条样本一字未动，变的只有 `pools`（`renamedByCounty` 63→62、新增 `renamedByPlaceholder: 1`），字节数 248,803 → 248,934、sha `c1657987…` → `16971baa…`。区划产物一字未动（`a7e26d54…`），`build-region-data.mjs --check` 与 `build-id-fixture.mjs --check` 都退 0，收口 `# tests 26 / # pass 26 / # fail 0`。
- **第八轮整改的落地过程本身出了两次事故，都记在这里省得下一个人以为"复核通过 = 有人核过"**：① 整改子智能体跑到 150 回合上限断在半路，留下全套未提交的改动 + 计划里三处指向 §4.11 的引用而 §4.11 还没写；② 它写在注释里的两句"实测"复算不出来（C-1 的"3,000 条里 20 条"没给种子起点、举的那条号其实不是生成结果），本轮按同一把尺子改成了"构造 + 结果"连着写。这两条都不是新发现的实现缺陷，而是**整改批次自己的证据缺陷**——台账 §4.11 末尾把"本轮复跑的"与"只能转述的"分成两类写清楚，就是这个用意。
