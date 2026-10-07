# 内容治理（SP4）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每一篇产出的文章页拿到自己那句 `seo_description`、把 tags/categories 的词表钉成一份可枚举的白名单、在正文里放上真的能点到的站内工具链接，并把目录从「只有 JS 才有」变成「原始 HTML 里就有」。

**Architecture:** 四刀共用一条脊柱：**判据先进 `scripts/check-seo.mjs`（刻意先红），内容改动随后把它按绿**，牙齿进 `scripts/check-seo-teeth.mjs`（M1–M18，全部打在 `/tmp` 的源与产物副本上）。A8 的静态目录是新增的一小段构建期逻辑——`_plugins/toc.rb` 在 `:documents, :post_convert` 这个钩子上把条目写进 `doc.data['toc']`，版式在正文之前渲染一份 `.toc-static`，CSS 在 `body.has-toc` 出现时把它收起；`dev/js/editorial.js` 一个字节都不改。

**Tech Stack:** Jekyll 4.3.4（`_plugins/*.rb` 在 CI 的真构建里会跑）+ Vite 6（`npx vite build` 出 CSS/JS）+ kramdown `input: GFM`（`auto_ids` 默认开、CJK 保留）、原生 Node ESM 门禁脚本 + 一段内嵌 ruby（front matter 一律走 YAML 读，不自己写子集解析器）、`node --test` 之外没有测试框架。

**规格：** `_docs/superpowers/specs/2026-10-03-content-governance-design.md`（提交 `f629e9a`）。Task 1 会先把 spec 里五处口径改成实测值——那五处是本计划与其他任务唯一的差异来源，改完之后本计划与 spec 逐条对齐。

---

## 全局约束（每个任务都受这些限制）

- 工作目录永远是 `.worktrees/sp4-content-governance`（分支 `sp4-content-governance`，基线 `2b9464c`）。所有路径都写相对这一棵的形式。
- **只按 pathspec 暂存**，绝不 `git add .` / `git add -A`：主工作树里此刻有并发会话的约 20 个暂存文件，而本分支的 `vendor` 是指回真仓库的符号链接，**永远不进暂存区**。每次 `git add` 之后必须跑一次 `git diff --cached --name-only` 并核对条目。
- **不 push、不部署**。不 `--no-verify`，不 amend，不 `reset --hard`。
- **不碰**：`_config.yml`、`package.json`、`dev/sass/toolkit.scss`、`sw.js`、`offline.html`、`scripts/check-sw*.mjs`、`scripts/verify-motion-batch4.mjs`、`scripts/verify-nav-touch.mjs`、`dev/js/editorial.js`。前四组是并发会话的领地，后两组是「A8 必须原样绿」的对象（`verify-motion-batch4.mjs` 对 `.toc-list` / `.toc-progress` / `is-live` / `--toc-p` / `--toc-h` / `--toc-y` 的 6 组断言判的是 JS 那一套）。
- 共享产物也别抢：`_data/og_images.yml` 在并发会话的暂存集里。**Task 6 会证明这一刀压根不需要重跑它**（那 4 篇都带 `cover`，不进这张表），所以它一次都不该出现在 `git add` 里。
- 格式化只有 prettier，且必须带这两个开关：`npx --no-install prettier --single-quote --print-width 320 --write <文件>`。裸 `npx prettier` 会去联网（本机不通）。**`_docs/**` 下的 spec 与 plan 永不过 prettier**——它会重写帖子里的 ```js 围栏和表格空格。
- 重建的标准动作（后续任务里的「重建」都指这三行；`--baseurl ""` 是给浏览器快照用的，门禁与 A/B 一律用默认 baseurl）：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
npx vite build && bundle exec jekyll build
```

- 门禁与牙齿一律跑在**干净导出树**上（`跑门的树必须等于提交的树`）：

```bash
mkdir /tmp/gate/head     # 故意不带 -p：已存在就停下报错。整目录换名（mv 到 head.old-<时分>）再重跑，
                         #   绝不 rm -rf —— /tmp/gate 是这台机器上几路会话共用的落点，删掉的可能是别人正在量的一份
git archive HEAD | tar -x -C /tmp/gate/head
ln -s /Users/liaolongdong/code/liaolongdong.github.io/vendor /tmp/gate/head/vendor
cd /tmp/gate/head && npx vite build && bundle exec jekyll build
node scripts/check-seo.mjs                     # 组判据
node scripts/check-seo-teeth.mjs --root=/tmp/gate/head --site=/tmp/gate/head/_site   # 牙齿这本不带 --stale-ok：它自己会带着这个开关去起门禁（`check-seo-teeth.mjs:2004`），多写一个无效参数只会让这一行看起来与上一行不同口径
```

- 提交信息一律走文件：`git commit -F /tmp/gate/sp4-tN.txt`，**绝不用 heredoc**（一条 Bash 里嵌套 heredoc 会造出信息为 `MSG cat …` 的真提交）。成败只认 `git log --format='%h %s' -1`。
- 重活（浏览器门禁 `verify-motion-batch4.mjs` / `verify-nav-touch.mjs`）受负载门管辖：**1 分钟负载 > 16 就按「拒测」记，既不算绿也不算红**。杀进程只杀自己起过并记下 pid 的那些，绝不 `pkill -f` 宽匹配（这台机器上有并行会话的 Chrome）。
- 字节口径：`cat <文件> | gzip -9 | wc -c`（不是 `gzip -9 -c`，那个带 FNAME 头每件多 16–19 B；也不是 `zlib.gzipSync`，同一批字节能差 293 B）。
- **文档里的每个数都要照着能复算**：本计划写死的每个数都附了命令与口径；执行时如果与命令输出不符，以输出为准并回写本文件，不要「就近改数」。
- 退出码：`check-seo.mjs` **1 = 有红、2 = 门禁自己崩了**；`check-seo-teeth.mjs` 同理（2 不算「如期变红」）。管道会吞退出码，`cmd | tail` 的 0 是 `tail` 的。

---

## Task 1：先重建、先自证，再把 spec 里五处口径改对

`_site` 在主工作树里是过期的（spec §1 事实 20 有实证），所以任何产物读数之前必须先证明产物是新的。同时：spec 在起草时有五处数是错的或口径不够，本任务把它们改成实测值——后面九个任务的判据与台账全部以改后的口径为准。

**Files:**
- Modify: `_docs/superpowers/specs/2026-10-03-content-governance-design.md`（§1 事实 15、§4.3、§5.1 组 `描述`、§5.2 表尾、§5.3、§6.1、§6.2、§8）

- [x] **Step 1：重建本分支产物**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
npx vite build && bundle exec jekyll build
```

预期：最后一行形如 `Done in ...` 与 `Auto-regeneration: disabled … Liquid Exception` 之外无异常，且 `_site/index.html` 的 mtime 是刚刚（`ls -l _site/index.html`）。

- [x] **Step 2：§6.0 自证——产物读的是逐页 keywords，不是全站串**

**必须用门禁那把容忍空白的正则**（`/<meta name="keywords"\s+content="…"/`）。写成 `content=` 紧挨着的那一形在这一篇上会读出「（无 keywords）」，那是一条假缺陷：

```bash
grep -o '<meta name="keywords"[^>]*content="[^"]*"' _site/2026/07/12/alibaba-page-agent.html | head -1
```

预期：`content` 里含 `page-agent`、`GUI`、`阿里巴巴` 这一篇自己的 tags 串，**不含** `廖小新,Better` 那一串全站关键字。做不到就把 Task 1 停下——后面所有产物数都会跟着说谎。

- [x] **Step 3：量 §6.1 的三个数（现状口径，逐字进台账）**

```bash
ruby /tmp/sp4-fm.rb _posts /tmp/sp4-fm.json   # 把 81 篇 front matter 解析成一份 JSON（脚本体见下；它自己把读入钉成 `mode: "rb:UTF-8"`，所以这里不需要 `-EUTF-8`——本机实测：同一份中文文本，带与不带都是 rc 0）
node /tmp/sp4-61.cjs
```

`/tmp/sp4-fm.rb` 与 `/tmp/sp4-61.cjs` 的完整源码附在本步末尾（`node` 脚本必须叫 `.cjs`：`/tmp` 下 `.mjs`/无扩展名会被当成 ESM，`require` 直接 `ReferenceError`）。

预期输出（执行 Task 1 时现场重测，逐字；起草时这一行少一个格、`eqSubtitle` 也记错了口径，见本节末尾）：

```
{"pages":80,"hand":41,"eqSubtitle":35,"eqSubtitleUnescaped":38,"escaped":3,"siteDesc":1,"missing":0,"uniqDesc":80,"floorShort":["2026-09-25-claude-agents-md-remote-gate.md"]}
```

`floorShort` 那一格点名的就是 `2026-09-25-claude-agents-md-remote-gate.md`（它的 `subtitle: issue` 只有 5 个字符，落到 `seoMeta.html:73` 那道 `.size < 25` 的地板上，于是取的是 `site.description`）。

- [x] **Step 4：把 spec 的四处错口径改成实测值**

逐处改（每处都是「spec 写的」→「实测的」，改由见括号里的命令）：

1. **§6.1 / §1 事实 1 / §4.1 规则 2 之后那句「那 39 篇的 `subtitle` 全部 ≥25 字符」——错。** 实测：今天没有 `seo_description` 的正好 39 篇，其中 **38 篇的 meta description 取本篇 `subtitle`**（逐字相等 `35` 篇，另有 3 篇是 `&quot;` 反解之后才相等），**1 篇取 `site.description`**（`2026-09-25-claude-agents-md-remote-gate.md`，`subtitle` 5 字符 < 25 地板）。所以 §6.1 那两格改成「与 subtitle 相同的篇数 **38 → 0**」「与 `site.description` 相同的篇数 **1 → 0**」（口径 = HTML 反解之后，`eqSubtitleUnescaped` 那一格）。量具：Step 3 的脚本。
2. **§6.1 末格「去重条数从 N 升到 ≥80」里的 N 现场量 = 80。** 今天 80 篇的 meta description **已经互不相同**，所以这一格是 `80 → 80`，**它今天就是绿的**；它的价值全在防未来，不在修现状。必须这样写进台账，不接受「≥80」这种把现状说成有病的说法。**顺带把一句说过头的话收回来**：这一格（`描述` ⑤）**没有牙**——要点着它必须造一次「两篇共用同一句话」的重复，M1–M18 里没有那样一把（M3 把摘要改成本篇 `subtitle`，不产生重复；M9 是把一篇推出语料，也不产生重复）。这一格进 Task 10 Step 8.6 的无牙矩阵与 §9.8 移交，台账里不许挂着「有守卫」的名义过去。
3. **§1 事实 15「`match_tags` 钉死了 9 条逐字标签串」——错，实测 33 枚**（`node /tmp/sp4-match.cjs` 与按块解析 yml 的 JS 探针各打一次，两头都是 33；**四个工具页里三个有串**——codec 11 / json 13 / diff 9，idcard 是 `match_tags: []`；9 条那一串只是 diff 那一页的块）。更关键的后果：A9 要动的 `Vite` **恰好在这 33 枚里**（`json` 页同一串里 `vite` 与 `Vite` 两枚都在），`2023/05/08/vue3-vite-study.html` 今天的命中集就是 `{Vite, webpack}`。所以「一枚都不在里面、命中集必然不变」这句话不成立，改成：**命中哪一页的状态不变（还是 `json` 那张卡），但该篇命中的逐字串从 `Vite` 变成 `vite`**——28 篇命中行里**只有这一行**会变。因此 §5.1 组 `词表` 第 ⑧ 条实现成「钉一份 **A9 落地后**的快照（28 行 `rel <- 逐字命中串`）」，于是 Task 5 首跑时 ⑧ 恰好红这一条、Task 6 治完转绿，快照本身成为「改名会不会带跑卡」的常设守卫。量具：`node /tmp/sp4-snap.cjs`（同一份口径：`relatedTools.html:36` 的逐字 `contains`；它还打「A9 会改变命中集的行数 = 1」）。
4. **§4.2 动作 3 与 §5.3 的「重跑 `node scripts/og-images.mjs`」这一步——不需要。** 实测：动作 3 改 categories 的 4 篇**全部带 front matter `cover`**（`grep -m1 '^cover:' _posts/2026-09-2{7,9}* _posts/2026-09-30-univer* _posts/2026-10-01-gitdiagram*`），而带 cover 的这 4 篇**压根不在 `_data/og_images.yml` 里**（`grep -c 'bend\|scriptc\|univer\|gitdiagram' _data/og_images.yml` = 0；该表 68 条）。卡面文字只画在 34 篇无 cover 的文章上。所以这一刀**不重跑生成器、不碰那份并发会话正持有的文件**；自证改成前后各跑一次 `node scripts/og-images.mjs --check`，退码与摘要行必须一模一样。

- [x] **Step 5：把 spec 的两处判据补齐（本计划相对 spec 的净增项，逐条给理由）**

1. **§5.1 组 `描述` 加第 ⑥ 条**：产物侧的接线——每一篇有 `seo_description` 的产出文章页，`_site` 里那条 `<meta name="description">` 解码后必须**等于**源侧的值。理由：现有 10 组里没有任何一组管文章页 meta description 的来源（`JSON-LD` 组那条 `681` 行判的是工具页 WebApplication），A4 回填完之后，改坏 `seoMeta.html` 的取值链不会让任何一道门红——那正是 SP1 修过的同类缺陷的形状。
2. **§5.2 牙齿表加 M16**：打在**产物**某篇的 meta description 上（源侧一字不动），该红的就是 `描述` ⑥。①–⑤ 的牙都打源侧，唯有这一把能证明「接线那一格真的在产物侧工作」。
3. 顺带把 §5.1 组 `词表` 第 ⑧ 条的「用 `git show HEAD:<篇>` 取改前值」那句改掉：牙齿台账把源抄进 `/tmp` 副本（`.git` 在 `SKIP` 集里），门禁在副本上**读不到 git**。⑧ 的实现一律走「脚本内钉快照 + 与当前源读数对账」，见本任务 Step 4 第 3 条与 Task 5。

改完把这五处（Step 4 四处 + Step 5 两处合并成一处口径）在 spec §8 决策记录里各加一行，编号接在现有 ①②③ 之后落成 **④⑤⑥⑦⑧**，并把那一行的小标题「**纠自己三次**」同步改成「**纠自己八次**」——标题不改，读 spec 的人会以为只有三处。别只改表格不留痕。Task 10 在这之后还要加 ⑨⑩⑪，标题跟着走。

- [x] **Step 6：自检——spec 里没有留下被推翻的旧数**

```bash
grep -n '39 → 0\|0 → 0\|9 条逐字\|9 条钉死\|重跑 `node scripts/og-images.mjs`' \
  _docs/superpowers/specs/2026-10-03-content-governance-design.md \
  | grep -v '起草时\|改成\|错\|取消'
grep -c '纠自己八次' _docs/superpowers/specs/2026-10-03-content-governance-design.md
```

第一条**期望空输出**（残留 0 行）。**起草时这里写的是「`No matches found`」，那条判据自己不可能成立**：
§8 决策记录与 §6.1 的改口句子必须原样引用被推翻的旧数（`0 → 0`、「9 条钉死」、「重跑 `og-images.mjs`」），
否则读 spec 的人不知道哪一版被废了。所以判据是两段的：**第一层 grep 出的每一行都必须带着改口的标志词**
（`起草时` / `改成` / `错` / `取消` 至少一个），第二层把它们滤掉之后必须什么都不剩。
Task 1 执行时的真实读数：第一层 5 行（G1、§5.3、§6.1、§8 ④、§8 ⑥），滤掉之后 0 行。
第二条期望 `1`（那一行小标题已从「纠自己三次」跟着走到八次；Task 10 还要加 ⑨⑩⑪，标题那时再改）。

- [x] **Step 7：提交**

```bash
git add -- _docs/superpowers/specs/2026-10-03-content-governance-design.md
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t1.txt
git log --format='%h %s' -1
```

`git diff --cached --name-only` 预期只有那一个文件。提交信息主题：`docs(spec): §6.1/事实15/og 三处口径改成实测值，并补 描述⑥ 与 M16`。

- [x] **Step 8：附——Step 3 那两个量具的完整源码**

`/tmp/sp4-fm.rb`（把 `_posts` 的 front matter 解析成 JSON；与门禁内嵌那段同一口径）：

```ruby
require "yaml"
require "json"
out = {}
Dir.glob(File.join(ARGV[0], "*.md")).sort.each do |f|
  t = File.read(f, mode: "rb:UTF-8")
  m = /\A---\r?\n(.*?)\r?\n---/m.match(t)
  next unless m
  begin
    out[File.basename(f)] = YAML.load(m[1]) || {}
  rescue StandardError
  end
end
File.write(ARGV[1], out.to_json)
```

`/tmp/sp4-61.cjs`（产物侧读数；三格分开计，把「逐字相等」「反解后相等」「靠转义才相等」钉成三个互不相同的数）：

```js
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance';
const fm = JSON.parse(fs.readFileSync('/tmp/sp4-fm.json', 'utf8'));
// _config.yml 的 description 是带引号的 plain scalar，必须走 YAML，正则取会连引号一起进来
const siteDesc = JSON.parse(require('child_process').execFileSync('ruby', ['-e', 'require "yaml";require "json";puts({:d=>YAML.load_file(ARGV[0])["description"]}.to_json)', path.join(ROOT, '_config.yml')], { encoding: 'utf8' })).d;
const relOf = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/.exec(f);
  if (!m) return null;
  const d = String(fm[f].date || '').trim().slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : `${m[1]}-${m[2]}-${m[3]}`;
  return `${day.replace(/-/g, '/')}/${m[4]}.html`;
};
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
let pages = 0, hand = 0, raw = 0, unescapedEq = 0, escaped = 0, site = 0, missing = 0, floorShort = [];
const descs = [];
for (const [file, data] of Object.entries(fm)) {
  const rel = relOf(file);
  if (!rel) continue;
  const p = path.join(ROOT, '_site', rel);
  if (!fs.existsSync(p)) continue;
  pages++;
  const html = fs.readFileSync(p, 'utf8');
  const m = /<meta name="description"\s+content="([^"]*)"/.exec(html);
  if (!m) { missing++; continue; }
  const metaRaw = m[1];
  const desc = unesc(metaRaw);
  descs.push(desc);
  if (data.seo_description) hand++;
  const sub = String(data.subtitle || '');
  if (metaRaw === sub) raw++;
  if (desc === sub) unescapedEq++;
  if (metaRaw !== sub && desc === sub) escaped++;
  if (sub && [...sub].length < 25 && !data.seo_description) floorShort.push(file);
  if (desc === String(siteDesc)) site++;
}
console.log(JSON.stringify({ pages, hand, eqSubtitle: raw, eqSubtitleUnescaped: unescapedEq, escaped, siteDesc: site, missing, uniqDesc: new Set(descs).size, floorShort }));
```

**三格的口径**：`eqSubtitle` 只比 `content` 的原始字节（改前 `35`），`eqSubtitleUnescaped` 比 HTML 反解之后（`38`），
`escaped` 是「反解才相等」的那三篇（`2026-06-05-ai-sdd`、`2026-07-12-facebook-astryx`、`2026-07-12-impeccable-ai-design`，
subtitle 里带 `"`，meta 里是 `&quot;`）——恒等式 `eqSubtitleUnescaped = eqSubtitle + escaped` 成立，`38 = 35 + 3`。
**起草时这一版把 `escaped` 写成了「既不等于 subtitle 也不等于 site.description」的余数**，那个口径在这里量出来是 `41`（正好等于 `hand`），
与台账 §9.2 那格的 `3` 对不上，所以改成上面三格分开计；台账引用的是 `eqSubtitle` 与 `escaped`，不受影响。

`/tmp/sp4-match.cjs`（Step 4 第 3 条那个「33 枚 / 28 行 / 恰好 1 行变」的量具，`node /tmp/sp4-match.cjs`，前置是 Step 3 的 `/tmp/sp4-fm.json`）：

```js
const fs = require('fs');
const cp = require('child_process');
const ROOT = '/Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance';
const tools = JSON.parse(cp.execFileSync('ruby', ['-ryaml', '-rjson', '-e', 'puts YAML.load_file(ARGV[0]).to_json', ROOT + '/_data/onlineTools.yml'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const ready = tools.filter((t) => t.status === 'ready');
const perTool = ready.map((t) => ({ slug: t.slug, n: (t.match_tags || []).length }));
const union = new Set();
ready.forEach((t) => (t.match_tags || []).forEach((k) => union.add(k)));
const fm = JSON.parse(fs.readFileSync('/tmp/sp4-fm.json', 'utf8'));
const tagsOf = (d) => {
  const raw = d.tags;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw === undefined || raw === null) return [];
  return String(raw).split(/\s+/).filter(Boolean);
};
const hit = (tg, map) => {
  const rows = [];
  for (const t of ready) {
    const mt = t.match_tags || [];
    for (const tag of tg.map(map)) if (mt.includes(tag)) { rows.push({ slug: t.slug, tag }); break; }
  }
  return rows;
};
const id = (x) => x;
const rename = (x) => ({ Chrome: 'chrome', React: 'react', Vite: 'vite', WebMCP: 'webmcp' }[x] || x);
let withHit = 0; const before = {}; const after = {};
for (const [file, d] of Object.entries(fm)) {
  if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)) continue;
  const tg = tagsOf(d);
  const b = hit(tg, id), a = hit(tg, rename);
  if (b.length) withHit++;
  before[file] = b.map((r) => `${r.slug}:${r.tag}`).sort().join(',');
  after[file] = a.map((r) => `${r.slug}:${r.tag}`).sort().join(',');
}
const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
console.log(JSON.stringify({ readyTools: perTool, unionTokens: union.size, hasViteUpper: union.has('Vite'), hasViteLower: union.has('vite'), postsWithHit: withHit, changedCount: changed.length, changedRows: changed.map((k) => ({ file: k, before: before[k], after: after[k] })) }));
const t1 = tagsOf(fm['2023-05-08-vue3-vite-study.md']);
console.log('VUE3VITE', JSON.stringify({ tags: t1, before: hit(t1, id), after: hit(t1, rename), jsonMatch: (ready.find((t) => t.slug === 'json').match_tags || []).filter((k) => t1.includes(k)) }));
```

逐字读数（2026-10-06 现场）：

```
{"readyTools":[{"slug":"idcard","n":0},{"slug":"codec","n":11},{"slug":"json","n":13},{"slug":"diff","n":9}],"unionTokens":33,"hasViteUpper":true,"hasViteLower":true,"postsWithHit":28,"changedCount":1,"changedRows":[{"file":"2023-05-08-vue3-vite-study.md","before":"json:Vite","after":"json:vite"}]}
VUE3VITE {"tags":["Vue3","Vue2","Vite","webpack","前端框架"],"before":[{"slug":"json","tag":"Vite"}],"after":[{"slug":"json","tag":"vite"}],"jsonMatch":["webpack","Vite"]}
```

**两把自证**：① `hit` 里那一行必须是 `tg.map(map)` 而不是 `map(tg)`——写成后者，`rename` 收到的是整个数组，
`{…}[数组]` 是 `undefined`，`|| x` 原样返回数组，改名**静默不生效**，`changedCount` 假 0
（这一版探针的第一次运行就是这么错的，是 `VUE3VITE` 那行 before/after 一模一样才暴露的）；
② 一个 tool 命中与否要按 `relatedTools.html:33-39` 的形状数（`:36` 是那句逐字 `contains`、`:38` 是 `break`）：
外层遍历 ready 工具、内层遍历本篇 tags、**第一个命中的 tag 就 `break`**——所以「命中串」是「本篇顺序里第一个落进 `match_tags` 的那枚」，
不是全部命中集合（同一篇里 `webpack` 也在 `json` 的串中，但它排在 `Vite` 后面，不进这一行）。

---

## Task 2：`描述` 组六道判据（这一步结束时门是红的，红 39 条）

先立判据，后改内容。这一步之后 `check-seo.mjs` 必须**恰好**红 39 条，全是 `缺 seo_description`——红多了就是判据写错，红少了就是有一格哑火。

**Files:**
- Modify: `scripts/check-seo.mjs`（在 `// ── 跑 ──` 那一行之前插入新组；`GROUPS` 数组尾部加 `'描述'`；头部注释 13 / 26 行与 164 / 174 行的「九组／十组」改成随 `GROUPS.length` 的说法）

- [x] **Step 1：把三条「读数口径」写在插入位置上方**

```js
// ── 组 11：描述（SP4 A4）─────────────────────────────────────────────────────
//
// 这一组判的是「这一篇有没有自己那句话」。取值链在 `_includes/seoMeta.html:55-76`：
// `page.seo_description` → `page.description` → `page.subtitle` → `site.description`，
// 再加一道 `.size < 25` 的地板。今天 80 篇里 41 篇是手写的、38 篇的 meta 就是副标题原文、
// 1 篇（`subtitle` 只有 5 个字符的那篇）落到了全站那句话上——三个数在 §6.1 台账里逐笔对账。
//
// 为什么源侧五格加产物侧一格：源侧管「这篇有没有自己的话」，产物侧管「那句话真的进了 meta」。
// 缺后者，改坏取值链不会有任何一道门红（现有 10 组里 `JSON-LD` 那条 `decode(...) !== v.description`
// 判的是工具页 WebApplication，不覆盖文章页）。
```

- [x] **Step 2：写正文读取器（④ 的尺）**

```js
/** 一篇稿子的正文（front matter 之后）。摘要里出现的每一段数字都要在这段里逐字找得到。 */
function srcBodyOf(file) {
  return readSrc(`_posts/${file}`).replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
}
```

- [x] **Step 3：写六条判据**

```js
{
  const FUTURE = '2100-10-25-practice-demo.md';
  const MIN = 60;
  const MAX = 140;
  const SITE_DESC = String(config.description ?? '').trim();
  const mdFiles = fs.readdirSync(path.join(ROOT, '_posts')).filter((f) => f.endsWith('.md')).sort();
  const inCorpus = new Set(posts.map((p) => p.file));
  const notProduced = mdFiles.filter((f) => !inCorpus.has(f));
  // ① 的后半：文件数 = 语料数 + 1，且多出来的那一篇有名有姓。谁再拿未来日期把稿子推出语料，红的是这一条。
  if (notProduced.length !== 1 || notProduced[0] !== FUTURE) {
    bad('描述', '_posts', `「_posts 文件数 ${mdFiles.length} = 产出语料 ${inCorpus.size} + 豁免」不成立：多出来的是 ${JSON.stringify(notProduced)}，而豁免只认 ${FUTURE}（不产出的稿子没有 meta 可回填，但也不能靠改日期绕开这一组）`);
  }
  const seenDesc = new Map();
  for (const p of posts) {
    const d = String(p.fm.seo_description ?? '').trim();
    const sub = String(p.fm.subtitle ?? '').trim();
    if (!d) {
      bad('描述', p.file, '缺 seo_description——这一篇的 meta description 现在由 subtitle／site.description 兜底，卡片说的不是这一篇的事');
      continue;
    }
    const len = [...d].length;
    if (len < MIN || len > MAX) bad('描述', p.file, `摘要长度 ${len} 个 code point，越出 [${MIN}, ${MAX}]（地板是 seoMeta 那道 .size < 25 的 2.4 倍）`);
    if (d === sub) bad('描述', p.file, '摘要与本篇 subtitle 逐字相同——回填等于没做，meta 与卡片还在读同一句副标题');
    if (d === SITE_DESC) bad('描述', p.file, '摘要与 site.description 相同——那是关于全站的一句话，不是关于这一篇的');
    const body = srcBodyOf(p.file);
    for (const num of d.match(/\d+/g) || []) {
      if (!body.includes(num)) bad('描述', p.file, `摘要里的数字「${num}」在本篇正文里逐字找不到——摘要不许带正文没有的数字`);
    }
    if (seenDesc.has(d)) bad('描述', p.file, `摘要与 ${seenDesc.get(d)} 逐字相同——两篇共用一句话，搜索引擎分不出这两页`);
    else seenDesc.set(d, p.file);
    const meta = /<meta name="description"\s+content="([^"]*)"/.exec(readSite(p.rel));
    if (!meta) bad('描述', p.rel, '产物里这一页没有 meta description——取值链在这一页上断了');
    else if (decode(meta[1]) !== d) bad('描述', p.rel, `产物 meta 与源侧 seo_description 不同值（meta=「${decode(meta[1]).slice(0, 48)}」），接线被动过`);
  }
}
```

`config`（ruby 解析过的 `_config.yml`）、`posts`（`{file, rel, fm, tags, cats, day}`，只含产出页面）、`readSite` / `hasSite` / `readSrc` / `decode` / `bad` 都是这本脚本里已有的东西；`decode` 在 `298` 行，它把实体反解回字符，所以 `&quot;` 不会伪装成「不同值」。

- [x] **Step 4：`GROUPS` 与头部口径跟着走**

```js
const GROUPS = ['keywords', 'modified', 'JSON-LD', '分页门', 'ItemList', 'manifest', '接线', 'head', '相关工具', '换源', '描述'];
```

头部那四处「九组／十组」的字面量一起改掉：`12` 行与 `26` 行改成「一本脚本、`${GROUPS.length}` 组判据」的说法（注释里不能插值，就写成「组数由 `GROUPS` 决定，`--list` 打印当前口径」），`164` 行与 `174` 行那句「十组判据」改成「后面各组判据」。**这一处不是修辞**：`--list` 是 `GROUPS` 的消费者（`1151-1155` 行），头部写着固定组数就是过期注释，而 `categories.html:14` 那句「43 个分类」已经证明过期注释会被下游当事实抄。

- [x] **Step 5：格式化并跑门**

```bash
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo.mjs
node scripts/check-seo.mjs 2>&1 | tail -5
```

预期：红 39 条，全是 `[描述] <篇名>：缺 seo_description——…`，最后一行 `✗ SEO 门禁：39 条不通过`，退码 1。逐条数一遍：

```bash
node scripts/check-seo.mjs 2>&1 | grep -c '^\[描述\]\|缺 seo_description'
```

预期 `39`。**如果不是 39，停下**：多出来的红要逐条归因（最常见的是 ⑥ 的 `decode` 口径没对上，或者 `posts` 里混进了不产出的那一篇）。

- [x] **Step 6：提交（此时门禁是红的，这是刻意状态）**

```bash
git add -- scripts/check-seo.mjs
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t2.txt
```

提交信息主题：`feat(seo): 描述组六道判据落地（39 篇缺摘要，此刻刻意红）`。

---

## Task 3：A4——39 篇 `seo_description` 回填，门转绿

摘要在下面逐字给出（本计划起草时已用 Task 2 同一把尺全量校过：长度 60–82 个 code point、无一与本篇 `subtitle` 相同、80 条取值互不相同、出现的每一段数字都在该篇正文里逐字找得到）。**任何一条被门禁判红，说明源文自起草后变了**——按判据改那一篇，不要回来改这里的字符串。

**位置约定**：37 篇插在已有的 `seo_short_title:` 之后一行，2 篇（`2022-08-08-webpack-move-vite.md`、`2023-05-08-vue3-vite-study.md`）插在 `subtitle:` 之后一行（这两篇没有 `seo_short_title`）。值一律是**不带引号的 plain YAML**。位置不是判据（写错位置构建不失败，只是卡片那一格读空），但这一刀里 39 处都按约定放。

**Files:**
- Modify: `_posts/` 下 39 个 `.md`（每个只加一行）——清单见下

- [x] **Step 1：第一批 10 篇（2017–2024）**

逐字插入下列行（左列是文件名，右列是那一整行内容）：

| `_posts/` 文件 | 插入的整行 |
| --- | --- |
| `2017-09-09-wxpay.md` | `seo_description: 微信内 JSAPI 支付与外部浏览器 H5 支付是两套下单场景：签名参数、回调域名与调起时机各有什么不同，踩过的坑按这两条线分别给结论。` |
| `2018-06-06-wxshare-summarize.md` | `seo_description: 分享到好友、朋友圈、QQ 好友与 QQ 空间四个出口各要什么参数，签名失效、缩略图不显示与域名校验这三类常见问题按原因归一次类。` |
| `2018-12-25-qqweiboshare.md` | `seo_description: 不引任何 SDK，用原生 JS 拼出 QQ 好友、QQ 空间、新浪微博与腾讯微博的分享链接，各站的参数命名差异与回调返回码逐条列出。` |
| `2022-08-08-webpack-move-vite.md` | `seo_description: 把行E通门户与管理台的前端构建从 webpack 换到 Vite 的实操记录：冷启动为什么要等几分钟、Vite 靠依赖与源码二分绕开它，以及团队怎么分工落地。` |
| `2023-05-08-vue3-vite-study.md` | `seo_description: Vue3 与 Vue2 在性能、Diff 策略、TS 支持、包体积和 API 风格上的逐项对照，另有一节专门讲 Vite 与 webpack 的构建模型差在哪。` |
| `2024-01-05-chrome-plugin-recommend.md` | `seo_description: 一组日常真的在用的 Chrome 插件清单，按外语阅读、开发者调试与内容处理三类整理，每枚写清算能做什么、免费版把门卡在哪里。` |
| `2024-03-20-new-project-use-vue2-problem.md` | `seo_description: vue2 停止维护之后，新项目或改版重构继续沿用它要付的代价：生态断供、构建链老化、组合式能力缺失，以及招聘与长期维护那一侧。` |
| `2024-10-09-fe-env-switch.md` | `seo_description: 一套前端产物无缝切多套后端的做法：把接口前缀从编译期常量改成运行期读取，配合 dev-server 代理与 nginx 改写，不必为每个环境各打一次包。` |
| `2026-05-25-account-password-helper.md` | `seo_description: 本地存储的账号密码管理插件：多账号一键切换省掉复制粘贴，凭据不出本机，填充逻辑怎么写、不同站点怎么适配，与浏览器自带钥匙串各管哪一段。` |
| `2026-06-28-account-password-helper-new.md` | `seo_description: 一键自动登录插件的开发记录：填充时机怎么挑、各家页面的表单选择器怎么兼容，以及任何凭据都不上传这条边界落在存储与授权的哪一层。` |

- [x] **Step 2：第二批 10 篇（AI / 开源实测前半）**

| `_posts/` 文件 | 插入的整行 |
| --- | --- |
| `2026-05-30-AI-model-rating.md` | `seo_description: 按这一期口径重排的 AI 大模型排行榜：国产模型在哪些项上追平、哪些项仍被拉开，榜单之外补了一段真正选型时会遇到的取舍。` |
| `2026-05-31-AI-model-rating.md` | `seo_description: 全球主流大模型的实测排名：同一批评测项跑出来的顺序与各家宣传不一致的那几处，逐条给出跑法与结果，并说明这期口径改了哪一项。` |
| `2026-06-05-ai-sdd.md` | `seo_description: 用 Spec 约束 AI 编程的工作流：提示词写到再细也会飘，规范文件该放在哪一层、Agent 在什么时机读它，以及一份能落地的 Spec 长什么样。` |
| `2026-06-06-ai-sdd-github.md` | `seo_description: SDD 四个流派各自的规范文件与加载时机对照：README 里那些主张哪几条能在仓库里找到实现、哪几条只是口号，按流派逐条给证据。` |
| `2026-06-15-webmcp-vs-puppeteer.md` | `seo_description: Chrome 新出的 WebMCP 与 Puppeteer 的分工差别：一个走页面内声明的工具、一个走外部协议驱动，自动化要洗牌这句话在哪些场景成立、哪些还不成立。` |
| `2026-07-12-alibaba-page-agent.md` | `seo_description: 阿里开源的 Page Agent 怎么绕开截图与 OCR：把 DOM 脱水成文本再交给大模型，一行代码挂载的接口长什么样，以及这条路目前做不了的交互。` |
| `2026-07-12-facebook-astryx.md` | `seo_description: Meta 开源的 Astryx：组件与主题如何做到 StyleX 驱动，同时为人类开发者与 AI 编程助手各准备一份可机读的约定，隐藏的那部分设计在哪一层。` |
| `2026-07-12-impeccable-ai-design.md` | `seo_description: Impeccable 用一份规则集把 AI 生成页面的通病挡掉：为什么模型写出的前端一眼认得出来，这些规则压的是配色、间距还是组件层次。` |
| `2026-09-10-agent-visual-toolchain.md` | `seo_description: 四个 AI 出图项目在同一台机器上的实跑结果：品牌表缺项、init 顺手 clone 整仓这两处卡住的地方逐条点名，最后跑通的那一条走的是浏览器调试协议。` |
| `2026-09-10-nextjs-avif-trap.md` | `seo_description: 把三个版本的 image-optimizer.js 拉到本地逐行对照：决定 AVIF 到底有没有在跑的那行字不在版本号里，而在开关默认值与升级时序的缝隙上。` |

- [x] **Step 3：第三批 10 篇（开源实测后半）**

| `_posts/` 文件 | 插入的整行 |
| --- | --- |
| `2026-09-10-silent-defaults.md` | `seo_description: 三桩没有任何报错的默认值改动：模型名换了、latest 指向 alpha、注册入口关了。各自怎么被发现、影响面多大，跑完之后我把优先级重排了一遍。` |
| `2026-09-12-trending-skill-sweep.md` | `seo_description: 逐个统计一批仓库里的 SKILL.md：哪些真的会被自动加载、哪些写了却永远不进上下文，判据按清单口径给，不采信 README 自己的说法。` |
| `2026-09-21-one-worktree-per-agent.md` | `seo_description: 三家并行工作区方案在同一台机器上的横评：装不装得上、拒绝得多快，以及磁盘占用要按什么口径量才不被目录树的表观大小骗过去。` |
| `2026-09-21-pnpm-task-settings.md` | `seo_description: 把 pnpm 的并发组这个新特性在多个版本上挨个跑一遍：给自己仓库的任务加了分组之后，为什么同一份 checkout 里连版本命令都跑不动，边界落在哪一档。` |
| `2026-09-21-security-audit-two-validators.md` | `seo_description: 一份很火的安全审计 skill：完整流程在自己机器上跑不动，于是只把它自带的两个校验器拎出来单独测，两道各自绿灯的门中间为什么没人守。` |
| `2026-09-22-claude-advisor-readme-row.md` | `seo_description: 一次仓库级回滚的三刀之后还剩什么：独立仓库下架、条目摘掉、目录删净，README 表格里那一行却还站着；顺手数了同一仓库里挂着没合的请求。` |
| `2026-09-23-browser-skill-context-bytes.md` | `seo_description: 四条让 agent 操作浏览器的入口在同一台机器上各占多少上下文：常驻字节、按需字节，以及背后那份参数表要等到什么时候才真的进上下文。` |
| `2026-09-24-google-ax-workspace-materialization.md` | `seo_description: 谷歌那份 agent 沙箱库：文档说预装三样东西，翻完提交记录只有一样走到了 CLI 表头，剩下两样分别是没人读和只建了个空目录。` |
| `2026-09-25-claude-agents-md-remote-gate.md` | `seo_description: AGENTS.md 这扇门不是本地开关：它由远端配置决定装不装得上，于是同一个文件在不同机器上的行为差异，要往配置分发那一层去找原因。` |
| `2026-09-26-github-actions-2500-cap.md` | `seo_description: Actions 失败数接口返回的那个整数是封顶值而不是答案：没有截断标记时怎么用日期窗口拆开再相加，以及这样量出来的为什么只能叫下界。` |

- [x] **Step 4：第四批 9 篇（2026-09-26 之后）**

| `_posts/` 文件 | 插入的整行 |
| --- | --- |
| `2026-09-26-json-render-silent-strip.md` | `seo_description: 界面一跑校验就消失：spec 过一遍验证之后，元素上的事件绑定与顶层状态被静默删掉，返回却仍然是成功，这一层该由谁来守。` |
| `2026-09-27-bend-laws-proof-gaps.md` | `seo_description: 把声明与证明分文件放会漏掉什么：逐条比对 law 声明与对应的证明体，改坏一行之后证明门的退出码变红，缺口恰好在那一格被暴露出来。` |
| `2026-09-27-openai-dns-agent-pause.md` | `seo_description: 训练沙箱里那台解析器没被管住：agent 借一次外部查询问到了别家的聊天机器人，于是工具使用训练整条暂停，复盘落在网络边界而不是模型行为。` |
| `2026-09-29-scriptc-native-x64-gap.md` | `seo_description: 把 TypeScript 直接编成原生二进制这条路能走多远：产物里确实没有 Node 运行时，但 Intel Mac 那一档的运行时包在 npm 上没发全。` |
| `2026-09-29-webmcp-modelcontext-mount.md` | `seo_description: WebMCP 的挂载点收敛成单独一处：测试用的那个名字被官方摘掉之后，在几种 Chrome 配置里各能不能拿到它，逐档给结论与复现开关。` |
| `2026-09-30-livenerf-panel-lock-mismatch.md` | `seo_description: 一条声称日更的评测基线到底有没有在跑：设计参数能从仓库重算出来，声称的曲线却一条都没露出来，本地跑它的锁校验那一格是红的。` |
| `2026-09-30-univer-node-two-gaps.md` | `seo_description: 把电子表格引擎放进没有浏览器的进程里算公式：聚合函数确实回了数值，但默认表范围和 Node 侧渲染这两处缺口得先知道再上生产。` |
| `2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md` | `seo_description: 不带 key 的一次 POST 换回一张 mermaid 架构图，代价是它给出的连线里有几条在源码里查不到，看图可以，别抄它画的线。` |
| `2026-10-02-nextjs-rebind-ssrf-advisory-lag.md` | `seo_description: 同一发打回环的请求，旧版取回了内网那张图、新版只给一个错误状态：这个洞堵上的同一次发版里，安全公告却还有一批没进公告库。` |

- [x] **Step 5：自证「只加了一行、正文一字未动」**

```bash
git diff --numstat -- _posts | awk '$1!=1 || $2!=0 {print "异常：", $0}'; echo "扫描完"
git diff --stat -- _posts | tail -2
```

预期：第一行**没有任何「异常：」输出**（每个文件恰好 +1 / −0），第二行是 `39 files changed, 39 insertions(+)`。若某篇显示 +2/−1，说明那一篇原本没有 `seo_short_title` 而你把行插到了别处，或者动了正文——按 Step 1–4 的表重插。

- [x] **Step 6：重建并跑门**

```bash
npx vite build && bundle exec jekyll build
node scripts/check-seo.mjs | tail -3
```

预期：`✓ SEO 门禁 11 组全绿（… / 换源 / 描述）；JSON-LD <N> 块全部可解析`，退码 0。

- [x] **Step 7：§6.1 的后读数（产物侧，逐格进台账）**

```bash
ruby /tmp/sp4-fm.rb _posts /tmp/sp4-fm.json && node /tmp/sp4-61.cjs
```

预期：`hand: 80`、`eqSubtitle: 0`、`eqSubtitleUnescaped: 0`、`escaped: 0`、`siteDesc: 0`、`missing: 0`、`uniqDesc: 80`、`floorShort: []`。**这些格一个都不许是「大约」**：`hand` 少了说明有一篇的键名或值被 YAML 吃掉（最常见是值里带了 `: `），`uniqDesc` 少于 80 会被 ⑤ 直接判红。

- [x] **Step 8：提交（两笔：内容一笔，方便回退单篇）**

```bash
git add -- _posts/2017-09-09-wxpay.md _posts/2018-06-06-wxshare-summarize.md _posts/2018-12-25-qqweiboshare.md _posts/2022-08-08-webpack-move-vite.md _posts/2023-05-08-vue3-vite-study.md _posts/2024-01-05-chrome-plugin-recommend.md _posts/2024-03-20-new-project-use-vue2-problem.md _posts/2024-10-09-fe-env-switch.md _posts/2026-05-25-account-password-helper.md _posts/2026-06-28-account-password-helper-new.md
git add -- _posts/2026-05-30-AI-model-rating.md _posts/2026-05-31-AI-model-rating.md _posts/2026-06-05-ai-sdd.md _posts/2026-06-06-ai-sdd-github.md _posts/2026-06-15-webmcp-vs-puppeteer.md _posts/2026-07-12-alibaba-page-agent.md _posts/2026-07-12-facebook-astryx.md _posts/2026-07-12-impeccable-ai-design.md _posts/2026-09-10-agent-visual-toolchain.md _posts/2026-09-10-nextjs-avif-trap.md
git add -- _posts/2026-09-10-silent-defaults.md _posts/2026-09-12-trending-skill-sweep.md _posts/2026-09-21-one-worktree-per-agent.md _posts/2026-09-21-pnpm-task-settings.md _posts/2026-09-21-security-audit-two-validators.md _posts/2026-09-22-claude-advisor-readme-row.md _posts/2026-09-23-browser-skill-context-bytes.md _posts/2026-09-24-google-ax-workspace-materialization.md _posts/2026-09-25-claude-agents-md-remote-gate.md _posts/2026-09-26-github-actions-2500-cap.md
git add -- _posts/2026-09-26-json-render-silent-strip.md _posts/2026-09-27-bend-laws-proof-gaps.md _posts/2026-09-27-openai-dns-agent-pause.md _posts/2026-09-29-scriptc-native-x64-gap.md _posts/2026-09-29-webmcp-modelcontext-mount.md _posts/2026-09-30-livenerf-panel-lock-mismatch.md _posts/2026-09-30-univer-node-two-gaps.md _posts/2026-09-30-univer-node-two-gaps.md _posts/2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md _posts/2026-10-02-nextjs-rebind-ssrf-advisory-lag.md
git diff --cached --name-only | wc -l
```

预期 `39`（上面把 `2026-09-30-univer-node-two-gaps.md` 写了两遍是有意的——重复 pathspec 不会重复入暂存，而 `wc -l` 仍该是 39；如果它出来是 40 或 38，说明表里的文件名与实际不一致，按 `git status --porcelain -- _posts` 找出来）。

```bash
git commit -F /tmp/gate/sp4-t3.txt
node scripts/check-seo.mjs | tail -1
```

提交信息主题：`feat(blog): 39 篇补 seo_description——每页那句是自己的，不再退回副标题`。

---

## Task 4：给 `描述` 组装牙（M1–M4 + M16）

**Files:**
- Modify: `scripts/check-seo-teeth.mjs`（`cases` 数组收尾的 `];` 之前追加 5 条案例；`const cases = [` 在 `:697`，收尾 `];` 紧贴 `function editManifest`（Task 1 之后行号会漂，**按锚点定位**））

- [x] **Step 1：追加靶子函数**

插在 `const cases = [` 这一行的**正上方**：

```js
/**
 * 描述组（M1–M4、M16）的靶子：摘要存在、长度留有余量、产物页在，且整篇源文件里
 * 找不到 M4 要塞的那串数字——否则那一刀落下去门禁有理由不红，而被记成「假牙」。
 */
const DIGITS_M4 = '41793';
const descTarget = () =>
  first(
    POSTS.filter((q) => {
      const d = String(q.fm.seo_description || '').trim();
      const sub = String(q.fm.subtitle || '').trim();
      return d.length >= 60 && d.length <= 130 && sub && has(q.rel) && !y(`_posts/${q.file}`).includes(DIGITS_M4);
    }),
    '描述组的靶子（有摘要、有副标题、产物在、正文不含那串牙齿数字）',
  );
```

`first`（`:499`）/ `POSTS`（`:383`）/ `has`（产物存在）/ `y`（读源副本）都是这本脚本里现成的。
靶子不写死文件名：M2 要把整行摘要换掉、M4 要在尾巴追加，写死一篇就可能撞上「这一篇恰好没有摘要」；
筛不到时 `first()` 抛，主循环记成「变异脚本自己崩了」而不是「假牙」——这两种结局在台账里是不同的话。

- [x] **Step 2：追加 5 条案例**

```js
  {
    name: 'M1 摘掉某篇的 seo_description 行',
    group: '描述',
    expect: '缺 seo_description',
    mut: () => S.srcCutLine(`_posts/${descTarget().file}`, /^seo_description:[ \t].*$/m, '摘要行'),
  },
  {
    name: 'M2 把某篇摘要长度改成 45 个 code point',
    group: '描述',
    expect: '越出 [60, 140]',
    mut: () => S.srcSubLine(`_posts/${descTarget().file}`, /^seo_description:[ \t].*$/m, `seo_description: ${'牙齿'.repeat(22)}串`, '摘要行'),
  },
  {
    name: 'M3 把某篇摘要写成它的 subtitle',
    group: '描述',
    expect: '与本篇 subtitle 逐字相同',
    mut: () => {
      const q = descTarget();
      S.srcSubLine(`_posts/${q.file}`, /^seo_description:[ \t].*$/m, `seo_description: ${String(q.fm.subtitle).trim()}`, '摘要行');
    },
  },
  {
    name: 'M4 在某篇摘要里塞一个正文没有的数字',
    group: '描述',
    expect: '在本篇正文里逐字找不到',
    mut: () => {
      const rel = `_posts/${descTarget().file}`;
      const line = lineOf(y(rel), /^seo_description:[ \t].*$/m, '摘要行');
      S.srcSubLine(rel, /^seo_description:[ \t].*$/m, `${line} ${DIGITS_M4}`, '摘要行');
    },
  },
  {
    name: 'M16 产物 meta 与源侧摘要不是同一个值',
    group: '描述',
    expect: '接线被动过',
    mut: () => S.sitePatch(descTarget().rel, /<meta name="description"\s+content="[^"]*"/, (m) => m.replace(/"$/, ' 牙齿"'), 'meta description'),
  },
```

四件事在执行时必须自己核一遍，别信这段代码「看起来对」：

1. **M2 的长度**：判据数的是**值**的 code point，`seo_description: ` 前缀不算。
   先跑 `node -e 'console.log([..."牙齿".repeat(22)+"串"].length)'`，**必须是 45** 才落盘；
   若不是 45，改 repeat 的次数直到它是，台账里那一句写「45 个 code point」才立得住。
2. **M4 用 `41793` 而不是 spec 举例的 `21`**：`21` 太容易作为 `2021`／`16.3.21` 的子串存在于正文，
   那一刀会落空。靶子函数已把「整篇源不含 `41793`」当筛选条件，所以不含即红。
3. **M16 只动 `_site` 那一侧**：这条判据量的就是「产物 meta == 源侧 `seo_description`」，
   动源侧会同时把 ①②③④ 带红，归因不清（红在同组不影响判定，但台账要能说出这一刀打了谁）。
4. **`expect` 是被门禁逐字打出来的片段**：改了 `check-seo.mjs` 里的措辞就要同步改这里，
   否则「红了但没有一句含 …」这种失败看起来像判据坏了，其实是台账过期。

- [x] **Step 3：逐条单跑，确认五把刀各红在自己那一格**

```bash
for n in M1 M2 M3 M4 M16; do node scripts/check-seo-teeth.mjs --only="$n" > /tmp/gate/t4-$n.out 2>&1; printf '%s exit=%s\n' "$n" "$?"; done
grep -h '牙齿台账\|✗' /tmp/gate/t4-M*.out
```

预期五条各打一行 `牙齿台账：1/1 组变异如期变红` 且 `exit=0`。退出码 1 的四句话分别是
「假牙（注入后仍绿）」「红了但没红在本组」「红了但没有一句含 expect」「变异脚本自己崩了」——
每一条都要按原话归因，**不许**改 `expect` 迁就，也不许改判据措辞来「对上」。

- [x] **Step 4：全量牙齿回归**

```bash
node scripts/check-seo.mjs > /dev/null 2>&1; echo "gate exit=$?"
node scripts/check-seo-teeth.mjs > /tmp/gate/t4-all.out 2>&1; echo "teeth exit=$?"
tail -3 /tmp/gate/t4-all.out
```

预期 `gate exit=0`（Task 3 之后门禁必须全绿，否则牙齿脚本的基线检查直接拒跑并退 1）、
`teeth exit=0`、汇总行 `牙齿台账：N/N 组变异如期变红`，分账行里出现 `描述 5`。
N 是追加前的条数 + 5，用 `grep -c "^    name: '" scripts/check-seo-teeth.mjs` 前后各数一次自证。

- [x] **Step 5：格式化 + 提交**

```bash
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo-teeth.mjs
node scripts/check-seo-teeth.mjs > /tmp/gate/t4-fmt.out 2>&1; tail -1 /tmp/gate/t4-fmt.out
git add -- scripts/check-seo-teeth.mjs
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t4.txt
```

提交信息主题：`test(seo): 描述组五把牙（M1–M4、M16）——摘掉、写短、抄副标题、凭空数字、接线被动`。
`git diff --cached --name-only` 必须**只有这一本脚本**（并发会话在 main 工作树里有一批暂存文件，
本分支的树里也绝不能被 `git add .` 带进别的东西）。

---

## Task 5：`词表` 组八条判据（先红 25，由 Task 6 治）

**Files:**
- Modify: `scripts/check-seo.mjs`（在 `描述` 块之后追加 `词表` 块；`GROUPS` 数组尾部登记 `'词表'`）
- 只读参照：`_site/tags.html`、`_site/categories.html`（计数器与 chip 形状）、`_data/onlineTools.yml`（**本任务不修改**）

- [x] **Step 1：钉两份白名单常量（逐字如下，不要手敲）**

插在 `描述` 组代码块的正上方。这两行是「一行一枚都不换行」的字符串形态，
**prettier 拆不开它**（字符串字面量内部的空格不是折点），所以落盘形状与计划里的形状一致、
下次 diff 只动被改的那一枚：

```js
const TAGS_OK = new Set('AI AI大模型2026年综合实力排行榜单 AI大模型排行榜单 AI大模型测评 AI编程 AOP Agent Astryx Bend CSS Claude Coding Cypress DNS Development ES2023 GUI GitDiagram H5分享 H5实现摇一摇 H5打开地图导航app Impeccable JS新特性 JavaScript JavaScript公用方法 JavaScript语言精粹 MCP Mermaid Meta Mongodb Next.js Node OpenAI Playwright Puppeteer SDD SSRF Spec-Driven StyleX TypeScript UI Univer Vercel Vibe Vue2 Vue3 blog chrome chrome浏览器插件 coding.net dev-server echarts git github git常用命令 gulp headless jekyll linux linux命令 livenerf next nginx nodeJS node包管理工具 npm page-agent pnpm proxy react reset revert scriptc seo优化 ssr vite vscode常用插件 vue vue-router webmcp webpack yarn 一键填充 云服务器ECS 仓库 代理 代码回撤 代码回退 公式引擎 函数式编程 前端 前端学习资料 前端小技巧 前端工作总结 前端构建 前端框架 前端环境切换工具 前端组件库 前端设计 前端面试常见编程题汇总 博客 原型和原型链 原生编译 域名解析 学习笔记 安全 实现可拖拽悬浮按钮 工具 工程化 常见的排序算法 常见的算法 开源 微信H5支付 微信JSAPI支付 微信公众号 微信公众号支付 微信分享 微信支付 技巧 插件 搜索引擎网站收录 更新版本内容 服务端渲染 架构图 查找算法 沙箱 浏览器插件 浏览器缓存机制 版本投产 生活 私有仓库 移动端的那些坑 移动端调试技巧 算法 类型系统 组件库 网站seo 自动登录 规范驱动开发 设计模式 设计系统 评测 谷歌浏览器插件 账号密码管理助手 超好用的chrome浏览器插件 配置https 阿里云服务器部署 阿里巴巴 面向切面编码 项目搭建 黑科技'.split(' '));
const CATS_OK = new Set('AI CSS Chrome插件 H5与微信 JavaScript React TypeScript Vue 前端工程化 工具与效率 开源实测 服务器与部署 算法与面试 随笔'.split(' '));
```

为什么敢用 `split(' ')`：本站的 front matter 表达不了一枚含空格的标签（写成方括号会造出全站第一枚，
spec §8 已经权衡过并否掉），所以「按 `/\s+/` 拆字符串」与「Set 的成员判断」两头口径一致。
这两行的来源是 Task 1 生成的 `/tmp/sp4-whitelist.json`（`tags` 151 枚、`categories` 14 枚，
归一口径 = 大小写撞键并入小写侧 + `coding`→`coding.net` + 去掉同帖重复），
重建它的命令写在 Task 1 Step 3 末尾，`/tmp` 被清过就跑那一条。

紧跟着一条自证（它防的是「有人往词表里塞了一枚含空格的标签」，那会让空格拆分的口径整体失效）：

```js
if (TAGS_OK.size !== 151 || CATS_OK.size !== 14) {
  bad('词表', 'scripts/check-seo.mjs', `白名单常量自身规模 ${TAGS_OK.size} / ${CATS_OK.size}，与钉死的 151 / 14 不符——词表被改动时这条先红，别轮到八条判据去猜是谁动的手`);
}
```

- [x] **Step 2：钉 ⑧ 的命中集台账（28 行）与 `match_tags` 的读取**

台账取的是 **A9 之后**的形状，所以 Task 5 首次跑门禁时 ⑧ 恰好红 1 条（`vue3-vite-study` 那行），
Task 6 治完它自己转绿。28 行逐字来自探针输出，**一行都不许手敲**：

```js
// ⑧ 文末工具卡的命中集台账。口径与 _includes/relatedTools.html:36 的逐字 contains 一致：
// 「这篇的 tags 里出现过 match_tags 里的那枚串」——大小写敏感，所以改名会带跑卡。
// 这份快照不跟随现状：改名把卡带跑了，红的是这一条（spec §5.1 词表 ⑧）。
const TOOL_HIT_OK = [
  ['2016/08/28/JS-good-parts.html', 'JavaScript语言精粹'],
  ['2017/06/06/git-common-command.html', 'git,git常用命令'],
  ['2017/08/25/common-tools.html', 'JavaScript公用方法'],
  ['2018/12/05/move-githubblog-to-coding.html', 'git,github'],
  ['2019/01/17/website-seo.html', 'seo优化,搜索引擎网站收录,网站seo'],
  ['2019/01/24/build-private-package.html', 'npm,私有仓库'],
  ['2019/01/24/publish-public-npm.html', 'npm'],
  ['2019/01/28/use-gulp-build-project.html', 'gulp,项目搭建'],
  ['2019/02/25/you-dont-kown-js-tips.html', '前端小技巧'],
  ['2019/02/26/you-dont-kown-css-tips.html', '前端小技巧'],
  ['2020/04/08/browser-cache.html', '浏览器缓存机制'],
  ['2020/08/03/inaword-understand-prototype.html', '原型和原型链'],
  ['2022/08/08/webpack-move-vite.html', 'vite,webpack,前端构建,工程化'],
  ['2023/04/30/functional-programming.html', '函数式编程'],
  ['2023/05/08/vue3-vite-study.html', 'vite,webpack'],
  ['2023/06/11/auto-update-release.html', '更新版本内容,版本投产'],
  ['2023/06/14/npm-yarn-pnpm.html', 'node包管理工具,npm,pnpm,yarn'],
  ['2023/12/24/git-revert-reset.html', 'git,reset,revert,代码回撤,代码回退'],
  ['2023/12/29/2023-js-new-features.html', 'ES2023,JS新特性'],
  ['2026/09/10/nextjs-avif-trap.html', 'npm,前端小技巧'],
  ['2026/09/10/silent-defaults.html', 'npm,前端小技巧'],
  ['2026/09/21/pnpm-task-settings.html', 'npm,pnpm,前端小技巧'],
  ['2026/09/25/claude-agents-md-remote-gate.html', 'pnpm'],
  ['2026/09/26/github-actions-2500-cap.html', 'github'],
  ['2026/09/26/json-render-silent-strip.html', 'npm'],
  ['2026/09/29/scriptc-native-x64-gap.html', 'TypeScript'],
  ['2026/09/30/univer-node-two-gaps.html', 'TypeScript'],
  ['2026/10/01/gitdiagram-keyless-mcp-4-bad-edges.html', 'TypeScript'],
];
```

重建快照（`/tmp/sp4-snap.cjs` 全文见 Task 1 Step 3 末尾同款附录；它读 `_site` 只为确认「这页产出过」，
tags 一律从 front matter 现读）：

```bash
node /tmp/sp4-snap.cjs > /tmp/sp4-snap.out; sed -n "$(grep -n '命中行数' /tmp/sp4-snap.out | cut -d: -f1),\$p" /tmp/sp4-snap.out
```

`match_tags` 不另立常量表，从源侧那份 yml 现读（读 yml 而不是抄清单，因为**消费者就是那份 yml**）：

```js
const TOOL_MATCH_TAGS = new Set();
for (const block of readSrc('_data/onlineTools.yml').split(/(?=^- slug: )/m)) {
  const m = /^ {2}match_tags:[ \t]*\n((?: {4}- [^\n]*\n?)*)/m.exec(block);
  if (!m) continue;
  for (const line of m[1].split('\n')) {
    const one = /^ {4}- (.+)$/.exec(line);
    if (one) TOOL_MATCH_TAGS.add(one[1].trim().replace(/^['"]|['"]$/g, ''));
  }
}
if (TOOL_MATCH_TAGS.size !== 33) {
  bad('词表', '_data/onlineTools.yml', `match_tags 读出 ${TOOL_MATCH_TAGS.size} 枚，与钉死的 33 不符——这份 yml 的形状动了，⑧ 的口径随之失效（33 枚跨 codec / json / diff 三页，idcard 那页是空数组）`);
}
```

这两段代码在本计划写的时候就跑过一遍：解析器给出 **33** 枚，与 ruby 解析同一份 yml 得到的并集一致；
28 行的 rel 全部形如 `YYYY/MM/DD/slug.html`（**显示层会把三段年月日折叠成 `YYYY-MM-DD`**，
所以粘贴后必须 `grep -c '/'` 自证，别拿肉眼看到的形状当真）。

- [x] **Step 3：八条判据**

```js
{
  // ① 大小写撞键为零：无条件判据，不设豁免名单（那对靠改名解决，spec §4.2 动作 2）
  const fold = new Map();
  for (const p of posts) {
    for (const t of p.tags) {
      const k = t.trim().toLowerCase();
      if (!fold.has(k)) fold.set(k, new Set());
      fold.get(k).add(t);
    }
  }
  for (const [k, variants] of [...fold].sort()) {
    if (variants.size > 1) bad('词表', 'tags', `${k} 有 ${variants.size} 枚只在大小写上不同的标签：${[...variants].sort().join(' / ')}——归档页会长出两个锚点，读者以为它们是两件事`);
  }

  // ② tags ⊆ 白名单、categories ⊆ 白名单（逐枚，所以一篇两个错就是两条）
  for (const p of posts) {
    for (const t of p.tags) if (!TAGS_OK.has(t)) bad('词表', p.file, `标签「${t}」不在白名单里——词表漂移，新增一枚要显式改脚本`);
    for (const c of p.cats) if (!CATS_OK.has(c)) bad('词表', p.file, `分类「${c}」不在白名单里——分类漂移，新增一枚要显式改脚本`);
  }

  // ③ 多分类必须写 [A, B]：front matter 里的 categories 行是裸标量且值中含空白 = 红
  for (const p of posts) {
    const raw = readSrc(`_posts/${p.file}`).replace(/^﻿/, '');
    const blk = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!blk) continue; // 形状不对由 语料 组负责，这一组不重复判
    const line = /^categories:[ \t]*(.*)$/m.exec(blk[1]);
    if (!line) continue;
    const val = line[1].trim();
    if (val && !val.startsWith('[') && /\S\s+\S/.test(val)) {
      bad('词表', p.file, `categories 写了空格分隔的多值「${val}」——多分类必须写成 [A, B]，方括号之外 YAML 与 Jekyll 的拆法不同，归档页读数会撒谎`);
    }
  }

  // ④ 行尾干净：_posts 下任何 .md 含 \r 即红（整站口径，不止产出语料）
  for (const f of fs.readdirSync(path.join(ROOT, '_posts')).filter((x) => x.endsWith('.md')).sort()) {
    if (fs.readFileSync(path.join(ROOT, '_posts', f)).includes(0x0d)) {
      bad('词表', `_posts/${f}`, '文件里有 \\r 行尾——按字节读的行尾粘连会在不按 /\\s+/ 拆的读取器里造出幽灵标签，门禁这一把尺认得它，grep 与浏览器不认');
    }
  }

  // ⑤ 三侧读数相等：语料并集 == 白名单 == 产物计数器；另加「文件集 == 语料 + 那 2 枚」
  const corpusTags = new Set();
  const corpusCats = new Set();
  for (const p of posts) {
    for (const t of p.tags) corpusTags.add(t);
    for (const c of p.cats) corpusCats.add(c);
  }
  const counterOf = (rel, re) => {
    const m = re.exec(readSite(rel));
    return m ? Number(m[1]) : null;
  };
  const prodTags = counterOf('tags.html', /<li><strong>(\d+)<\/strong><span>个标签/);
  const prodCats = counterOf('categories.html', /<li><strong>(\d+)<\/strong><span>个分类/);
  if (corpusTags.size !== TAGS_OK.size || prodTags !== TAGS_OK.size) {
    bad('词表', 'tags.html', `tags 三侧读数不等：语料 ${corpusTags.size} / 白名单 ${TAGS_OK.size} / 产物 ${prodTags}——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`);
  }
  if (corpusCats.size !== CATS_OK.size || prodCats !== CATS_OK.size) {
    bad('词表', 'categories.html', `categories 三侧读数不等：语料 ${corpusCats.size} / 白名单 ${CATS_OK.size} / 产物 ${prodCats}——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`);
  }
  const fileTags = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, '_posts')).filter((x) => x.endsWith('.md'))) {
    const blk = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readSrc(`_posts/${f}`).replace(/^﻿/, ''));
    if (!blk) continue;
    const tm = /^tags:[ \t]*(.*)$/m.exec(blk[1]);
    if (!tm) continue;
    for (const tok of tm[1].replace(/^\[|\]$/g, '').split(/[,\s]+/).filter(Boolean)) fileTags.add(tok);
  }
  const extra = [...fileTags].filter((t) => !corpusTags.has(t)).sort();
  if (fileTags.size !== corpusTags.size + 2 || extra.join(',') !== '前端面试,手写题') {
    bad('词表', '_posts', `文件集 tags 读数 ${fileTags.size} ≠ 语料 ${corpusTags.size} + 那 2 枚；语料外多出的是 ${extra.join(',')}（那 2 枚逐字写成 前端面试 / 手写题，属于不产出的教学样本 ${FUTURE_TEACH}）`);
  }

  // ⑥ 同帖重复为零 + 每枚标签的桶大小 == 持有它的文件数
  for (const p of posts) {
    if (new Set(p.tags).size !== p.tags.length) {
      const dup = [...new Set(p.tags.filter((t, i) => p.tags.indexOf(t) !== i))];
      bad('词表', p.file, `标签在同一篇里出现两遍：${dup.join(' / ')}——site.tags 的那一桶会多占一格，归档页的「N 篇」就开始撒谎`);
    }
  }
  const bucket = new Map();
  const holders = new Map();
  for (const p of posts) {
    for (const t of p.tags) bucket.set(t, (bucket.get(t) || 0) + 1);
    for (const t of new Set(p.tags)) holders.set(t, (holders.get(t) || 0) + 1);
  }
  for (const [t, n] of [...bucket].sort()) {
    if (n !== holders.get(t)) bad('词表', 'tags', `标签「${t}」的桶是 ${n} 篇，实际持有它的文件只有 ${holders.get(t)} 篇——同一篇重复挂了这枚标签`);
  }

  // ⑦ 归档页不悬空：每一枚 chip 的 href="#X" 在同页有 cat-section id="X"
  for (const [rel, why] of [['tags.html', '标签'], ['categories.html', '分类']]) {
    const html = readSite(rel);
    const ids = new Set([...html.matchAll(/<section class="cat-section" id="([^"]*)"/g)].map((m) => decode(m[1])));
    for (const m of html.matchAll(/<a class="cat-chip" href="#([^"]*)"/g)) {
      const target = decode(m[1]);
      if (!ids.has(target)) bad('词表', rel, `${why}「${target}」的锚点跳空：chip 写了 href="#${target}"，同页却没有 id="${target}" 的那一节`);
    }
  }

  // ⑧ 命中集不变：台账逐行对得上，且不长出台账之外的命中行
  const hitOf = (p) => [...new Set(p.tags)].filter((t) => TOOL_MATCH_TAGS.has(t)).sort().join(',');
  const ledger = new Map(TOOL_HIT_OK);
  for (const [rel, want] of TOOL_HIT_OK) {
    const p = posts.find((q) => q.rel === rel);
    if (!p) continue; // 这一篇不在语料里，由 描述 ① / 语料 组负责，这里不重复判
    const got = hitOf(p);
    if (got !== want) bad('词表', rel, `文末工具卡的命中集与台账不一致：台账「${want}」，现在「${got}」——改名把这页的卡带跑了，match_tags 是逐字 contains，大小写敏感`);
  }
  for (const p of posts) {
    const got = hitOf(p);
    if (got && !ledger.has(p.rel)) bad('词表', p.rel, `这页现在命中了工具卡（${got}），台账里却没有这一行——match_tags 或这页的 tags 有一边被动过`);
  }
}
```

两处代码里出现过的名字**必须在同一块内已定义**：`FUTURE_TEACH` 就是 `描述` 块里那个
`2100-10-25-practice-demo.md` 常量的名字，而那块把它叫 `FUTURE`、且是块级 `const`（`{}` 内），
**跨块取不到**。所以这一条按下面这样处理，别指望复用：把 ⑤ 那句消息里的 `${FUTURE_TEACH}` 换成
逐字字符串 `2100-10-25-practice-demo.md`，同时把 `描述` 块里那行的等式说明保持不变。
（这个坑是本计划自己踩出来的：两个块各自 `{}` 作用域，名字不共享，写跨块引用会得到
`ReferenceError` → 门禁退 2，而牙齿脚本把退 2 记成「门禁自己崩了」，看起来像判据的问题。）

- [x] **Step 4：登记组名**

```bash
grep -n "const GROUPS = \[" scripts/check-seo.mjs
```

在该数组尾部追加 `'词表'`（顺序 `…, '换源', '描述', '词表'`）。`--list` 打的就是这份数组，
漏登记会让新组的红不进汇总行。

- [x] **Step 5：跑门禁，按逐条口径核对首红 25**

```bash
node scripts/check-seo.mjs > /tmp/gate/sp4-t5.out 2>&1; echo "exit=$?"
grep -c '\[词表\]' /tmp/gate/sp4-t5.out
for k in '只在大小写上不同' '不在白名单里' '空格分隔的多值' '行尾' '三侧读数不等' '出现两遍' '实际持有它的文件' '锚点跳空' '命中集与台账不一致'; do printf '%s\t%s\n' "$k" "$(grep -c -- "$k" /tmp/gate/sp4-t5.out)"; done
```

预期 `exit=1`、`[词表]` 共 **25** 条，分解（每一格都由 Task 1 的实测推出来，可复算）：

| 判据 | 条数 | 明细 |
| --- | --- | --- |
| ① | 5 | `react{react/React}`、`coding{coding/Coding}`、`vite{vite/Vite}`、`chrome{chrome/Chrome}`、`webmcp{webmcp/WebMCP}` |
| ② | 10 | tags 5 枚（`coding`、`Vite`、`React`、`WebMCP`、`Chrome`）+ categories 5 枚（`开源`、`编程语言`、`开源工具`×3） |
| ③ | 4 | `2026-09-27-bend-laws-proof-gaps`、`2026-09-29-scriptc-native-x64-gap`、`2026-09-30-univer-node-two-gaps`、`2026-10-01-gitdiagram-keyless-mcp-4-bad-edges` |
| ④ | 1 | `_posts/2019-02-25-you-dont-kown-js-tips.md`（426 行全 CRLF，`grep -c $'\r'` 实测 426） |
| ⑤ | 2 | tags 三侧 155/151/155、categories 三侧 17/14/17；文件集那一条今天**绿**（157 = 155 + `前端面试,手写题`） |
| ⑥ | 2 | `2026-07-12-alibaba-page-agent.md` 同帖重复 + `Agent` 桶 13 vs 持有 12 |
| ⑦ | 0 | 今天不红，它防的是 A9 之后的悬空 |
| ⑧ | 1 | `2023/05/08/vue3-vite-study.html` 台账 `vite,webpack` vs 现状 `Vite,webpack` |

对不上就是实现走样了：按 `grep -c` 的每一格找差异，**不许**改这张表去迁就代码，
也不许改判据措辞让 `grep` 的关键字命中得更顺手（关键字是判据消息的子串，改措辞要两头一起改）。

- [x] **Step 6：确认 `描述` 组仍 0 红**

```bash
node scripts/check-seo.mjs > /tmp/gate/sp4-t5b.out 2>&1; grep -c '\[描述\]' /tmp/gate/sp4-t5b.out
```

预期 `0`。管道会吞退出码，所以 `exit=` 只认直接重定向那一次。

- [x] **Step 7：格式化 + 提交**

```bash
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo.mjs
node scripts/check-seo.mjs > /tmp/gate/sp4-t5c.out 2>&1; echo "exit=$?"; grep -c '\[词表\]' /tmp/gate/sp4-t5c.out
git add -- scripts/check-seo.mjs
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t5.txt
```

预期格式化之后仍是 `exit=1` / 25 条（prettier 只动折行，不该动语义；它**会**把那两行
`new Set('…'.split(' '))` 保持原样，因为字符串字面量内部没有折点）。
提交信息主题：`test(seo): 词表组八条判据——白名单 151/14、三侧读数、同帖重复、锚点悬空、工具卡命中集`。
这一笔**故意留红 25**，由 Task 6 治。

---

## Task 6：A9 词表归一四动作（25 红转绿）

**Files:**
- Modify（tags 侧 5 篇）：`_posts/2026-09-29-webmcp-modelcontext-mount.md`、`_posts/2026-07-12-facebook-astryx.md`、`_posts/2023-05-08-vue3-vite-study.md`、`_posts/2018-12-05-move-githubblog-to-coding.md`、`_posts/2026-07-12-alibaba-page-agent.md`
- Modify（categories 侧 4 篇）：`_posts/2026-09-29-scriptc-native-x64-gap.md`、`_posts/2026-09-30-univer-node-two-gaps.md`、`_posts/2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md`、`_posts/2026-09-27-bend-laws-proof-gaps.md`
- Modify（行尾）：`_posts/2019-02-25-you-dont-kown-js-tips.md`
- Modify（注释改口）：`categories.html:15`

- [x] **Step 1：动作 1+2 —— 四枚合并 + 一枚改名（逐字 before → after）**

下面九行是本仓库现证的原文与目标，**逐字**替换（每篇只动 `tags:` 那一行，行号一并给出是为了定位）。

> **执行时回写（2026-10-06，提交 `e3a8cea`）**：这三张表里的行号已经旧了——Task 3 给 39 篇各插了一行
> `seo_description`，于是 `tags:` 从 9 挪到 10、`categories:` 从 7 挪到 8（`2018-12-05` 那篇是 12，没变）。
> 落点按**逐字原文**找，每条先数过「在本篇里恰好出现 1 次」才替换，次数对不上就整篇跳过；
> 行号只当定位线索用，别拿它当锚。

| 文件 | 行 | 逐字原文 | 逐字改后 |
| --- | --- | --- | --- |
| `2026-09-29-webmcp-modelcontext-mount.md` | 9 | `tags: WebMCP Chrome Agent` | `tags: webmcp chrome Agent` |
| `2026-07-12-facebook-astryx.md` | 9 | `tags: AI React 设计系统 开源 Meta Astryx StyleX 前端组件库` | `tags: AI react 设计系统 开源 Meta Astryx StyleX 前端组件库` |
| `2023-05-08-vue3-vite-study.md` | 7 | `tags: Vue3 Vue2 Vite webpack 前端框架` | `tags: Vue3 Vue2 vite webpack 前端框架` |
| `2018-12-05-move-githubblog-to-coding.md` | 12 | `tags: git github coding blog 博客` | `tags: git github coding.net blog 博客` |

`Coding` 那枚**不动**：它挂在别的篇上，与 `coding.net`（平台）不是同一件事，
合并会把「coding.net 平台」和「Vibe 编码方式」塞进同一枚标签（spec §8 那一次掉头）。
所以 ① 的五对里 `coding{coding/Coding}` 是靠**改名**消掉的，不是靠豁免名单。

- [x] **Step 2：动作 4 —— 同帖重复一枚**

| 文件 | 行 | 逐字原文 | 逐字改后 |
| --- | --- | --- | --- |
| `2026-07-12-alibaba-page-agent.md` | 9 | `tags: AI Agent 前端 开源 阿里巴巴 page-agent GUI Agent` | `tags: AI Agent 前端 开源 阿里巴巴 page-agent GUI` |

删的是**行尾那枚** ` Agent`（前面那枚留着）。改后 `site.tags["Agent"]` 从 13 降到 12，
且 12 == 持有它的文件数——这一格是动作 4 唯一的读数变化。

- [x] **Step 3：动作 3 —— categories 一簇四篇（空格分隔改方括号，词汇并进 `开源实测`）**

| 文件 | 行 | 逐字原文 | 逐字改后 |
| --- | --- | --- | --- |
| `2026-09-29-scriptc-native-x64-gap.md` | 7 | `categories: 开源工具 TypeScript` | `categories: [开源实测, TypeScript]` |
| `2026-09-30-univer-node-two-gaps.md` | 7 | `categories: 开源工具 TypeScript` | `categories: [开源实测, TypeScript]` |
| `2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md` | 7 | `categories: 开源工具 TypeScript` | `categories: [开源实测, TypeScript]` |
| `2026-09-27-bend-laws-proof-gaps.md` | 7 | `categories: 开源 编程语言` | `categories: [开源实测]` |

`开源` / `开源工具` / `编程语言` 三枚分类从此消失，`开源实测` 的桶 17 → 21。
**方括号形态只用在多分类上**：单分类仍是裸标量（全站其余篇都这样），③ 的判据也只查
「裸标量里含空白」，不会因为这篇用了方括号就要求别篇跟进。

- [x] **Step 4：CRLF 卫生 —— 整篇换行归 LF**

```bash
grep -c $'\r' _posts/2019-02-25-you-dont-kown-js-tips.md      # 改前：426
sed -i '' 's/\r$//' _posts/2019-02-25-you-dont-kown-js-tips.md
grep -c $'\r' _posts/2019-02-25-you-dont-kown-js-tips.md; echo "grep exit=$?"   # 改后：0（grep 没命中退 1）
grep -lU $'\r' _posts/*.md | wc -l                              # 必须是 0
git diff --numstat -- _posts/2019-02-25-you-dont-kown-js-tips.md
```

预期 `426` → `0`（**这是全篇 426 行的换行改写**，不是只动 `tags:` 那一行——`grep -lU` 的口径是整文件），
`git diff --numstat` 打 `426  426  _posts/...`。再自证一次「只动了行尾、没动内容」：

```bash
git show HEAD:_posts/2019-02-25-you-dont-kown-js-tips.md | tr -d '\r' > /tmp/gate/old-lf.md
diff /tmp/gate/old-lf.md _posts/2019-02-25-you-dont-kown-js-tips.md && echo 'IDENTICAL 去掉 CR 之后逐字节相同'
```

预期打印 `IDENTICAL 去掉 CR 之后逐字节相同`。**这一条是整个动作里唯一的「内容没变」证明**，
缺了它，426 行的 diff 就只能靠肉眼。

- [x] **Step 5：`categories.html:15` 那句过期注释改口**

原文（`categories.html:15`， Liquid 注释里）：

```
site.categories 按插入顺序迭代（Jekyll 只对 tags 做字母序），43 个分类会乱成一团。
```

改成逐字这一行：

```
site.categories 迭代出来的是「front matter 里第一次出现」的顺序，既不是字母序也不是篇数序
（tags.html 直接吃它，第一枚是 jekyll），14 个分类这样排会乱成一团。
```

`43` 是上一届的读数，A9 之后是 14；这句注释是给下一个改这页的人看的，留着 43 会让他去找一个不存在的排序器。

> **执行时回写（2026-10-06，提交 `e3a8cea`）**：上面那一行原本写的是
> 「14 个分类靠 `tags_sorter` 那套排序不成立」——**这一版作废**，两处都对不上仓库：
> ① `grep -rn tags_sorter`（排除 `_site`/`.git`/`vendor`/`.jekyll-cache`）除本计划文件自身外零命中，
> 仓里没有这个排序器，写进注释等于把下一个读者支去找一个假东西；
> ② 「Jekyll 只对 tags 做字母序」与产物不符——`_site/tags.html` 的 `<section class="cat-section" id=…>`
> 序列与「按文件名升序扫 `_posts/*.md` 得到的 tags 首次出现序」前 31 枚逐字相同（两排的排头都是 `jekyll`），
> 第 32 枚的分歧正是这次改名造的 `coding.net`（磁盘）vs `coding`（改前产物）；
> 再把产物那 155 枚按码点排一遍，排头是 `AI` 而不是 `jekyll`，且逐位不相等——字母序这半句同样不成立。
> 所以替换文本改成只写量得到的事实，行数从一行变两行（这一刀 `categories.html` 打的是 `2 1`）。

- [x] **Step 6：重建 + 门禁转绿 + §6.2 的读数**

内容文件**不过 prettier**（`prettier` 会重写帖子里的 ```js 围栏、给代码补分号，
`article-check` 的字符数会被动，见 `[prettier 会重写帖子里的 ```js 围栏]`）。

```bash
npx vite build && bundle exec jekyll build
node scripts/check-seo.mjs > /tmp/gate/sp4-t6.out 2>&1; echo "exit=$?"
grep -c '\[词表\]' /tmp/gate/sp4-t6.out
node scripts/check-seo.mjs | tail -1
```

预期 `exit=0`、`[词表]` **0** 条、末行全绿。再打 §6.2 的七个数。**一律从 `_site` 产物读**（那才是面向读者的读数，`bundle exec ruby` 起站读一遍
既慢又会被 `site.posts` 的未来日期规则绊）：

```bash
node -e '
const fs = require("fs");
const html = (r) => fs.readFileSync("_site/" + r, "utf8");
const rows = (rel) => [...html(rel).matchAll(/<section class="cat-section" id="([^"]*)"[^>]*>[\s\S]*?<span class="cat-count">(\d+) 篇/g)].map((m) => [decodeURIComponent(m[1]), Number(m[2])]);
const t = rows("tags.html"), c = rows("categories.html");
const cnt = (rel, re) => Number(re.exec(html(rel))[1]);
console.log("tags 计数器:", cnt("tags.html", /<li><strong>(\d+)<\/strong><span>个标签/), "| 归档节数:", t.length, "| 只挂 1 篇:", t.filter((x) => x[1] === 1).length);
console.log("categories 计数器:", cnt("categories.html", /<li><strong>(\d+)<\/strong><span>个分类/), "| 归档节数:", c.length, "| 只挂 1 篇:", c.filter((x) => x[1] === 1).length, "| 开源实测:", (c.find((x) => x[0] === "开源实测") || [])[1]);
console.log("Agent:", (t.find((x) => x[0] === "Agent") || [])[1], "| 篇文章:", cnt("categories.html", /<li><strong>(\d+)<\/strong><span>篇文章/));
console.log("归档节数与计数器是否相等:", t.length === cnt("tags.html", /<li><strong>(\d+)<\/strong><span>个标签/), c.length === cnt("categories.html", /<li><strong>(\d+)<\/strong><span>个分类/));
'
```

预期（Task 1 用 `/tmp/sp4-a9sim.cjs` 模拟出来、spec §6.2 钉死的那几个数，实测必须一模一样）：
`tags 151` / 只挂 1 篇 `116` / `categories 14` / 只挂 1 篇的分类 `2` / `开源实测` 桶 `21` /
`Agent 12` / `篇文章 80`，最后那行两个布尔都必须 `true`（归档页每枚标签都成节，没有悬空也没有缺席）。
正则**文件集**读数 `153`，且 `153 = 151 + 前端面试 + 手写题`——这条等式已经由 ⑤ 的最后一条判据
逐字钉在门禁里，它绿即等式成立，不必另开一把尺。

**同一条命令在 A9 之前跑一次就是「改前」那一列**（本计划写的时候它在当前产物上打的正是
`155 / 122`、`17 / 4`、`开源实测 17`、`Agent 13`、`篇文章 80`，与 spec §6.2 的左边一一对得上）。
台账里前后两列必须来自**同一把尺**，不要一格用 Jekyll 现读、一格用产物读数。

- [x] **Step 7：自证「没有连带影响」——三处**

```bash
node scripts/og-images.mjs --check; echo "og exit=$?"
git diff --stat -- _data/og_images.yml
node scripts/verify-plan-blocks.mjs; echo "plan exit=$?"
node scripts/verify-tools-browser.mjs > /tmp/gate/sp4-t6-tools.out 2>&1; echo "tools exit=$?"
```

三处的预期与含义：
1. `og exit=0` 且 `git diff --stat -- _data/og_images.yml` **空输出**——A9 动的 4 篇分类里，
   `开源实测` 与 `开源工具` 在卡面台账上同图（Task 1 实测：那 4 篇都有封面、都不在 34 篇无封面清单里），
   所以**不重生成 `og_images.yml`**。这也顺手避开了并发会话正持有这份文件的问题。
   spec §5.3 里「`_data/og_images.yml` 由 `og-images.mjs` 重新生成（只该动那 4 篇的卡面分类）」
   这一句被这一条实测否掉，Task 1 Step 4 的 spec 勘误表里已登记。
2. `plan exit=0`——本批不改 `_data/onlineTools.yml`，镜像集不动。
   一旦确实需要改 yml，`--fix` 必须在同一刀内跑，并让 `verify-plan-blocks-teeth.mjs` 照旧全绿。
3. `tools exit=0`——文末工具卡的命中集没被改名带跑（⑧ 已钉住，这一本只是复跑一次浏览器侧）。
   负载门（1 分钟 > 16）撞上就按拒测记，不算绿也不算红，改到夜里重跑。

> **执行时回写（2026-10-06，提交 `e3a8cea`）**：1 与 2 都是实测绿
> （`og exit=0` + `git diff -- _data/og_images.yml` 空输出，表 68 条 / 34 张卡；
> `plan exit=0`，65 个镜像块逐字节全等、未落地 0 节）。
> **3 是拒测**：起跑前 `sysctl -n vm.loadavg` 的 1 分钟档 22.4 > 16，这一本按上面那句约定记成拒测，
> 不算绿也不算红。命中集此刻有两层静态证据顶着（门禁 ⑧ 的 28 行逐行对上、`vue3-vite-study` 那行随改名转绿），
> 浏览器侧复跑挪进 Task 10 的收口清单，低负载时补跑一次。

- [x] **Step 8：提交**

```bash
git add -- _posts/2026-09-29-webmcp-modelcontext-mount.md _posts/2026-07-12-facebook-astryx.md _posts/2023-05-08-vue3-vite-study.md _posts/2018-12-05-move-githubblog-to-coding.md _posts/2026-07-12-alibaba-page-agent.md
git add -- _posts/2026-09-29-scriptc-native-x64-gap.md _posts/2026-09-30-univer-node-two-gaps.md _posts/2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md _posts/2026-09-27-bend-laws-proof-gaps.md _posts/2019-02-25-you-dont-kown-js-tips.md categories.html
git diff --cached --name-only | sort
```

预期恰好 **11 个路径**，`_data/og_images.yml` **不在**里面（它在并发会话的暂存集里，本分支不该出现它）。

```bash
git commit -F /tmp/gate/sp4-t6.txt
```

提交信息主题：`fix(blog): 词表归一——四枚大小写并掉、coding 改名、同帖重复摘掉、开源簇并进开源实测、一篇 CRLF 归 LF`。

---

## Task 7：给 `词表` 组装牙（M5–M10 + M15）

**Files:**
- Modify: `scripts/check-seo-teeth.mjs`（`cases` 里再追加 7 条，紧跟 Task 4 那五条之后）

七把刀全部打在**源侧 front matter**上（`词表` 组八条判据里有七条读的是源，只有 ⑦ 读产物，
而 ⑦ 的形状在 A9 之后不可能自然长出悬空——它没有牙，台账里照 §5.2 的口径写明「计数/形状判据，不设牙齿」）。

- [x] **Step 1：追加 7 条案例**

```js
  {
    name: 'M5 给一篇已有 chrome 的帖子再加一枚 Chrome',
    group: '词表',
    expect: '只在大小写上不同',
    mut: () => S.srcSubLine('_posts/2024-01-05-chrome-plugin-recommend.md', /^tags: chrome 浏览器插件 谷歌浏览器插件 超好用的chrome浏览器插件$/m, 'tags: chrome Chrome 浏览器插件 谷歌浏览器插件 超好用的chrome浏览器插件', 'tags 行'),
  },
  {
    name: 'M6 在一篇的 categories 里加一个白名单外的词',
    group: '词表',
    expect: '不在白名单里',
    mut: () => {
      const rel = `_posts/${T.catted.file}`;
      const line = lineOf(y(rel), /^categories:[ \t].*$/m, 'categories 行');
      S.srcSubLine(rel, /^categories:[ \t].*$/m, `${line} 牙齿分类`, 'categories 行');
    },
  },
  {
    name: 'M7 把 categories: [A, B] 改成空格分隔',
    group: '词表',
    expect: '空格分隔的多值',
    mut: () => {
      const rel = `_posts/${first(POSTS.filter((q) => /^categories:[ \t]*\[/.test(lineOf(y(`_posts/${q.file}`), /^categories:[ \t].*$/m, 'categories 行'))), '带方括号 categories 的靶子').file}`;
      const line = lineOf(y(rel), /^categories:[ \t]*\[.*\]$/m, 'categories 行');
      S.srcSubLine(rel, /^categories:[ \t]*\[.*\]$/m, line.replace(/^(\s*categories:[ \t]*)\[/, '$1').replace(/\]/, '').replace(/,\s*/g, ' '), 'categories 行');
    },
  },
  {
    name: 'M8 给一篇副本的 tags 行补一个 \\r',
    group: '词表',
    expect: '行尾',
    mut: () => {
      const rel = `_posts/${T.tagged.file}`;
      const line = lineOf(y(rel), /^tags:[ \t].*$/m, 'tags 行');
      S.srcSubLine(rel, /^tags:[ \t].*$/m, `${line}\r`, 'tags 行');
    },
  },
  {
    name: 'M10 把一篇 tags 里已有的一枚原样重写第二遍',
    group: '词表',
    expect: '出现两遍',
    mut: () => {
      const rel = `_posts/${T.tagged.file}`;
      const line = lineOf(y(rel), /^tags:[ \t].*$/m, 'tags 行');
      const one = line.replace(/^tags:[ \t]*/, '').split(/\s+/)[0];
      S.srcSubLine(rel, /^tags:[ \t].*$/m, `${line} ${one}`, 'tags 行');
    },
  },
  {
    name: 'M9 把一篇的 date 从 2026 改成 2100（推出语料）',
    group: '描述',
    expect: '多出来的是',
    mut: () => S.srcSubLine('_posts/2026-10-02-nextjs-rebind-ssrf-advisory-lag.md', /^date:[ \t]2026-10-02$/m, 'date: 2100-01-01', 'date 行'),
  },
  {
    name: 'M15 在一篇持有 git 标签的帖子里把 git 改成 Git',
    group: '词表',
    expect: '命中集与台账不一致',
    mut: () => S.srcSubLine('_posts/2023-12-24-git-revert-reset.md', /^tags: git reset revert 代码回退 代码回撤$/m, 'tags: Git reset revert 代码回退 代码回撤', 'tags 行'),
  },
```

四条口径必须照做，否则这一族的牙是假的：

- **M5 的变异造在保留形那一侧**：A9 之后大写那侧已经不存在了，所以「再加一枚 `Chrome`」必须
  打在**已有 `chrome`** 的篇上（`2024-01-05-chrome-plugin-recommend.md`，`tags:` 行首枚就是 `chrome`）。
  打在别篇上会变成 ② 的红而不是 ① 的红，`expect` 就落空。
- **M7 的靶子是「跑出来的」而不是写死的**：A9 之后带方括号的 categories 有 4 篇新增 + 若干存量，
  执行顺序一变就撞空；`first(...)` 筛不到会抛，被记成「变异脚本自己崩了」，比假牙好查。
  那一串 `replace` 就是把 `[A, B]` 剥成 `A B`（**去掉逗号**，因为 Jekyll 按 `/\s+/` 拆，
  留着逗号会拆出 `A,` 这枚白名单外的词，于是红在 ② 而不是 ③）。
- **M8 用 `line + '\r'`**：判据 ④ 读的是文件字节里有没有 `0x0d`，所以行尾补 `\r` 即红；
  这一条与 `语料`／`keywords` 那些组无关（YAML 会吃掉行尾空白，别指望它们一起红）。
- **M9 的组登记成 `描述`**：这条刀打的是 `date`，它让这一篇从产出语料里掉出去，
  于是 `描述` ① 那句「`_posts` 文件数 == 产出语料 + 1，多出来的是 …」先红；
  `词表` ⑤ 的「文件集 == 语料 + 那 2 枚」同时红是 **cascade**（spec §5.2 的 M9 那行写的就是这个），
  牙齿台账按 `group` 只认第一处，cascade 记在交付实录里而不是再加一条案例。

> **执行时回写（2026-10-06，提交 `d919092`）——上面代码块里的 M6、M7 两把按原文落不下去，改法是实测出来的：**
>
> 1. **M6 原写法是一把假牙。** `T.catted` 实测解析到 `_posts/2016-06-18-hello-jekyll.md`，它的
>    categories 行是 `categories: [随笔]`——方括号**单值**。按原文往行尾追加得到
>    `categories: [随笔] 牙齿分类`，用 `# encoding: utf-8` 的 Ruby 单测（`/tmp/gate/t7-yaml.rb`）
>    量到 `Psych::SyntaxError`：整篇掉出语料，② 根本看不见这枚新词，`expect` 永远落不到。
>    落码改成按形状分两路——方括号值往 `]` 前插 `, 牙齿分类`，裸标量才往行尾追加。
> 2. **M7 的筛子必须要求括号内至少一枚逗号。** 原文只筛 `/^categories:[ \t]*\[/`，同样选中那枚
>    `[随笔]`；单值剥掉方括号后既没有逗号也没有第二枚词，③ 那句「空格分隔的多值」不红。
>    筛子改成 `/^categories:[ \t]*\[[^\]]*,/`，实测靶子随之变成 `2023-05-08-vue3-vite-study.md`
>    （`categories: [Vue, 前端工程化]`）。
>
> 那四句口径之外再补一句**顺序**口径：prettier 必须跑在全量台账**之前**（Step 3 原文把它排在台账之后）。
> 台账逐条 spawn 真的 `scripts/check-seo.mjs`，而格式化改的正是这个文件；跑完之后只剩提交，不再碰它。

- [x] **Step 2：逐条单跑**

```bash
for n in M5 M6 M7 M8 M9 M10 M15; do node scripts/check-seo-teeth.mjs --only="$n" > /tmp/gate/t7-$n.out 2>&1; printf '%s exit=%s\n' "$n" "$?"; done
grep -h '✗\|牙齿台账：' /tmp/gate/t7-M*.out
```

预期七条各 `1/1`、`exit=0`。任何一条 `exit=1` 都要按那四句话归因，**不许**为了过而改 `expect`。

- [x] **Step 3：全量牙齿回归 + 提交**

```bash
node scripts/check-seo.mjs > /dev/null 2>&1; echo "gate exit=$?"
node scripts/check-seo-teeth.mjs > /tmp/gate/t7-all.out 2>&1; echo "teeth exit=$?"; tail -3 /tmp/gate/t7-all.out
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo-teeth.mjs
node scripts/check-seo-teeth.mjs > /tmp/gate/t7-fmt.out 2>&1; tail -1 /tmp/gate/t7-fmt.out
git add -- scripts/check-seo-teeth.mjs
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t7.txt
```

预期 `gate exit=0`、`teeth exit=0`、分账行含 `描述 5 / 词表 7`，格式化后复跑仍全绿。
提交信息主题：`test(seo): 词表组七把牙（M5–M10、M15）——撞键、白名单、方括号、CRLF、同帖重复、推出语料、改名带跑卡`。

> **执行时回写（2026-10-06，提交 `d919092`）**：这一句预期里的 `描述 5 / 词表 7` 与输出不符，读数是
> **`描述 6 / 词表 6`**。原因是它把 M9 记进了词表，而 M9 的 `group` 按上面第四条口径登记成 `描述`，
> 台账分账只认红线所在的组（词表 ⑤ 那条对 M9 是 cascade）。142 → 149 组、`teeth exit=0`、
> `gate exit=0`（12 组）与这段命令其余预期一致；执行时把 prettier 提到了台账前面，理由见 Step 1 末尾那句回写。

---

## Task 8：`内链` 组四条判据（先红 1）+ 六条真的正文工具内链

**Files:**
- Modify: `scripts/check-seo.mjs`（`词表` 块之后追加 `内链` 块；`GROUPS` 尾部登记 `'内链'`）
- Modify（内容六本）: `_posts/2026-09-26-json-render-silent-strip.md`、`_posts/2026-09-22-claude-advisor-readme-row.md`、`_posts/2026-09-21-pnpm-task-settings.md`、`_posts/2026-09-10-nextjs-avif-trap.md`、`_posts/2017-08-25-common-tools.md`、`_posts/2017-06-06-git-common-command.md`
- Modify: `scripts/check-seo-teeth.mjs`（M12）
- 只读参照：`_data/onlineTools.yml`（四页的 `tagline` / `features` 是链接文字的口径上限，**本任务不修改**）

- [x] **Step 1：写四条判据（插在 `词表` 块之后、`const GROUPS = [` 之前）**

```js
// ── 组 13：内链（SP4 刀3）─────────────────────────────────────────────────────
//
// 判的是「正文里那几枚指向站内工具页的手工链」。四条全部落在产物侧：源侧写的是
// `{{ '/tools/json.html' | prepend: site.baseurl }}`，只有产物里那一枚 href 才知道
// baseurl 有没有拼上、那一页还在不在。项目站的 baseurl 是 /better-blog，
// 漏拼的相对写法在本地 `_site` 里看起来是好的、上线就是 404，所以这一格按整串相等判。
//
// 为什么只数 `#post-body` 以内：文末「相关工具」卡（`_includes/relatedTools.html`）每一篇
// 自动带 2–4 枚 /tools/ 链接，把它算进来这一组永远是绿的——spec §5.1 那句
// 「把自动卡当手工链交差」防的正是这个。`postBodyRegion`（83 行）取的是元素**内**区间，
// 卡片排在 `</article>` 之后，天然被排除（实测：加链之前全语料正文里的 /tools/ 链 = 0 枚）。
{
  const INLINK_RE = /<a\b[^>]*href="([^"]*?\/tools\/([a-z0-9-]+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  const EMPTY_TEXT = new Set(['点这里', '点此', '工具', '详情', '查看详情', '了解更多', '链接', 'here', 'link', 'click here']);
  let inBodyLinks = 0;
  for (const p of posts) {
    const html = readSite(p.rel);
    const reg = postBodyRegion(html);
    if (!reg) continue; // 「稿子在、产物里没有」在 语料 组已经红过，这里不重复报，也不假绿
    const found = [...html.slice(reg.start, reg.end).matchAll(INLINK_RE)];
    if (!found.length) continue;
    inBodyLinks += found.length;
    if (found.length > 2) bad('内链', p.rel, `正文里有 ${found.length} 枚工具内链，超过每篇 2 枚的地板——文末自动卡本来就有，正文再堆只是噪声（spec §4.3）`);
    for (const m of found) {
      const href = m[1];
      const slug = m[2];
      const text = decode(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      const want = `${BASEURL}/tools/${slug}.html`;
      if (EMPTY_TEXT.has(text)) bad('内链', p.rel, `指向 ${href} 的内链文字是「${text}」——链接文字必须说清点开了能做什么（spec §4.3 第一条）`);
      if (href !== want) bad('内链', p.rel, `正文内链的 href 是「${href}」，不等于 baseurl 拼出来的「${want}」——相对写法或漏 baseurl 在项目站上是 404`);
      else if (!hasSite(`tools/${slug}.html`)) bad('内链', p.rel, `正文内链指向 ${href}，产物里没有 tools/${slug}.html——这一条是 404`);
    }
  }
  if (inBodyLinks < 5) bad('内链', '_posts', `正文里的工具内链一共 ${inBodyLinks} 枚，少于地板 5 枚（spec §4.3 要 5–8 条，每条都要能指出它接的是正文里的哪一句话）`);
}
```

`BASEURL`（184 行，值 `/better-blog`，无尾斜杠）、`posts`、`readSite` / `hasSite` / `decode` / `postBodyRegion` / `bad` 都是这本脚本里已有的东西。

两处口径写明，别当笔误：
- `INLINK_RE` 要求 href **正好**落在 `/tools/<slug>.html`，带片段的 `tools/json.html#digest` 一枚都不算（本站现在没有这种写法；日后有人加，得先加判据再加链，不能静默漂过）。
- `tools.html`（工具索引页）不在 `/tools/` 之下，所以不算这一组的内链——它是导航，不是「点开能做某件事的那页」。

- [x] **Step 2：登记组名并跑门，确认恰好红 1**

```js
const GROUPS = ['keywords', 'modified', 'JSON-LD', '分页门', 'ItemList', 'manifest', '接线', 'head', '相关工具', '换源', '描述', '词表', '内链'];
```

```bash
node scripts/check-seo.mjs 2>&1 | grep '^\[内链\]'
```

预期**只有一行**：`[内链] _posts：正文里的工具内链一共 0 枚，少于地板 5 枚…`。
红 2 条以上就是判据写错（最常见：`postBodyRegion` 的区间没切对，把文末自动卡算了进来，
那 `inBodyLinks` 会是 160 左右而不是 0）。

> **执行时回写（2026-10-07，提交 `7ac2723`）**：Step 2 与 Step 4 那两条命令里的 `grep '^\[内链\]'`
> 永远匹配不到——红线在产物输出里长成 `✗ [内链] …`，行首是 `✗ ` 而不是 `[`。落码时用 `'\[内链\]'`
> 并把门输出先重定向进文件再数（管道会吞退出码）；实测先红 1 条、读数 `0`，与这段预期一致。

- [x] **Step 3：落六条链（逐篇「锚点 / 工具 / 链接文字」，锚点串已实测在 `_posts/*.md` 里唯一）**

六条的写法只有一个形状（spec §4.3 的 (c)），Liquid 拼 baseurl，链接文字说清点开能做什么：

```markdown
[链接文字]({{ '/tools/<slug>.html' | prepend: site.baseurl }})
```

链接文字逐条对过 `_data/onlineTools.yml` 的 `tagline` / `features`，不越过那页真做的事
（json 页有「校验给精确行列号，那一段同时在输入区选中」；codec 页摘要面板「MD5 与 SHA-1/256/384/512，文本或本地文件」、
时间戳面板「秒与毫秒 ⇄ 日期」；diff 页「逐行差异 / 行内高亮 / 并排与行内两视图」）：

| 篇（`_posts/`） | 锚点（实测唯一的串） | 工具页 | 链接文字 |
| --- | --- | --- | --- |
| `2026-09-26-json-render-silent-strip.md` | `## 校验那一刀切在了哪层`（插到这行**之前**） | `json` | `JSON 格式与转换工具` |
| `2026-09-22-claude-advisor-readme-row.md` | `说白了，这个文件从头到尾没被任何一台机器 parse 过一次。` 那段之后 | `json` | `JSON 格式与转换工具` |
| `2026-09-21-pnpm-task-settings.md` | `普通桌面机上敲一个 \`--version\` 就红。` 那段之后 | `diff` | `文件与文本对比工具` |
| `2026-09-10-nextjs-avif-trap.md` | `只有 16.3.3 是另一个值。` 那句之后 | `codec` | `编码与摘要工具` |
| `2017-08-25-common-tools.md` | `## 过去了多长时间`（插到这行**之前**） | `codec` | `时间戳转换` |
| `2017-06-06-git-common-command.md` | `### git代码提交操作`（插到这行**之前**） | `diff` | `文件与文本对比工具` |

六段逐字（每段独占一行，前后各留一个空行；用 Edit 落，别用批量 replace）：

1. `2026-09-26-json-render-silent-strip.md`：

```markdown
上面那份 spec 是不是合法 JSON、`on` 掉在 `props` 里还是掉在元素层，不用为它起一次编辑器：粘进 [JSON 格式与转换工具]({{ '/tools/json.html' | prepend: site.baseurl }})，格式化之后开树视图逐层展开，坏输入也给到行与列。
```

2. `2026-09-22-claude-advisor-readme-row.md`：

```markdown
换个人复核这件事不必装 python：把那份 `.mcp.json` 粘进 [JSON 格式与转换工具]({{ '/tools/json.html' | prepend: site.baseurl }})，缺逗号的落点同样是行加列，并且那一处在输入框里被选中；补一个逗号再粘一次，看下一个报错往哪儿挪。
```

3. `2026-09-21-pnpm-task-settings.md`：

```markdown
改前改后那两份 yaml 只差这一格，逐行看比把 686 行读完快：A 栏放原样、B 栏放改过的，[文件与文本对比工具]({{ '/tools/diff.html' | prepend: site.baseurl }}) 会把动过那一行标出行内差异，1,312 字节换成 18 这件事一眼就看完。
```

4. `2026-09-10-nextjs-avif-trap.md`：

```markdown
这一步不必非得敲 CLI：[编码与摘要工具]({{ '/tools/codec.html' | prepend: site.baseurl }}) 的摘要面板直接选本地文件，SHA-256 与 MD5、SHA-1/384/512 在同一格里，两份文件各算一次就把「字节级一模一样」这句话结掉了。
```

5. `2017-08-25-common-tools.md`：

```markdown
同一串毫秒数，手边没有 JS 环境时不用等编译器：[时间戳转换]({{ '/tools/codec.html' | prepend: site.baseurl }}) 把 10 位按秒、13 位按毫秒两种解释一起给，UTC 与本地两种写法也一起给，上面那三个 `console.log` 的结果可以在那里对出来。
```

6. `2017-06-06-git-common-command.md`：

```markdown
`git diff` 比的是工作区与暂存区；两份不在同一个仓库里的文本它比不了，贴进 [文件与文本对比工具]({{ '/tools/diff.html' | prepend: site.baseurl }}) 逐行走一遍，并排和行内两种视图都给。
```

**`idcard` 那页一枚都不放，这是结论不是漏项**：spec §4.3 候选名单里那篇 `2024-01-05-chrome-plugin-recommend.md`
的「脱敏演示」对不上那页真做的事——`/tools/idcard.html` 的手机号面板是 11 位格式判定 + 三位号段，
银行卡面板是 Luhn 校验 + 行别前缀，**没有**脱敏/遮罩那一格；语料里离得最近的两段
（`2017-08-25-common-tools.md` 的 `formatPhone` / `formatBankNo`）做的是「每四位插一个分隔符」，
不是校验。按 §4.3 那句「写不出接点的就不配放」，宁缺。这一格连同理由进 §6.4 台账。

- [x] **Step 4：重建 + 门绿，并把六条链的产物形状逐条自证**

```bash
npx vite build && bundle exec jekyll build
node scripts/check-seo.mjs 2>&1 | grep -c '^\[内链\]'; echo "exit=${PIPESTATUS[0]}"
```

预期 `0`（`内链` 组无红）。再逐条核产物里的 href 与**落点**（落点=那枚链出现在它所接的那段之后）：

```bash
cat > /tmp/gate/sp4-inlink-proof.cjs <<'EOF'
const fs = require('fs');
const pairs = [
  ['2026/09/26/json-render-silent-strip.html', 'tools/json.html', '校验那一刀切在了哪层'],
  ['2026/09/22/claude-advisor-readme-row.html', 'tools/json.html', '从头到尾没被任何一台机器'],
  ['2026/09/21/pnpm-task-settings.html', 'tools/diff.html', '普通桌面机上敲一个'],
  ['2026/09/10/nextjs-avif-trap.html', 'tools/codec.html', '只有 16.3.3 是另一个值'],
  ['2017/08/25/common-tools.html', 'tools/codec.html', '过去了多长时间'],
  ['2017/06/06/git-common-command.html', 'tools/diff.html', 'git代码提交操作'],
];
for (const [rel, slug, marker] of pairs) {
  const h = fs.readFileSync(`_site/${rel}`, 'utf8');
  const href = `href="/better-blog/${slug}"`;
  const at = h.indexOf(href);
  const mk = h.indexOf(marker);
  const inBody = at > 0 && (() => { let d = 0, open = null, st = -1; for (const m of h.matchAll(/<(\/)?article\b[^>]*>/gi)) { if (m[1]) { if (open !== null && d === open) return at > st && at < m.index; d -= 1; if (d < 0) d = 0; } else { d += 1; if (open === null && /\bid="post-body"/.test(m[0])) { open = d; st = m.index + m[0].length; } } } return false; })();
  const text = at > 0 ? /<a\b[^>]*href="\/better-blog\/tools\/[a-z0-9-]+\.html"[^>]*>([^<]*)<\/a>/.exec(h.slice(at, at + 400))?.[1] ?? '' : '';
  console.log(`${inBody && at > 0 && mk > 0 && Math.abs(at - mk) < 1600 ? 'OK  ' : 'FAIL'} ${rel} slug=${slug} 正文内=${inBody} 锚点距离=${at > 0 && mk > 0 ? at - mk : 'n/a'} 文字=${text}`);
}
EOF
node /tmp/gate/sp4-inlink-proof.cjs
```

预期六行全 `OK`，且 `文字` 那列与 Step 3 表里的链接文字逐字相等（六行都得打出来看，
少一行就是那一枚链压根没渲染进产物——Liquid 没展开时它会以 `{{ '/tools/...` 原样站着）。
`锚点距离` 那一格量的是「链与它所接的那句话相距多少字节」，>1600 视为放在了别处。

> **执行时回写（2026-10-07，提交 `7ac2723`）：这份 proof 脚本按原文落下去是六行全 `FAIL`，两处是夹具错、不是链放错。**
>
> 1. `const at = h.indexOf(href)` 量的是**整页**第一枚 `href="/better-blog/tools/<slug>.html"`——
>    导航栏里本来就挂着工具页链接，于是 `at` 恒在 `<head>`/导航区，锚点距离实测
>    −20521 / −23023 / −28343 / −16463 / −22943 / −17485，六行全负、`正文内=false`、`文字=` 空。
>    改成：先按 `check-seo.mjs:84 postBodyRegion` 同一口径取 `#post-body` 内区间，只在 body 切片里
>    `matchAll` 取那枚链，顺带打出「正文枚数 / 全页枚数」两个数（实测每篇 1 枚 / 全页 2–3 枚）。
> 2. 「落点=那枚链出现在它所接的那段**之后**」与 Step 3 表自相矛盾：表里有三行明写「插到这行**之前**」
>    （标题锚点），按「之后」判必然负。改成每行显式给期望方向（`before` / `after`），
>    只校 `|距离| < 1600` 与方向符号。改后六行全 `OK`，`文字` 那列与表逐字相等。

- [x] **Step 5：给 `内链` 组装牙（M12）**

`内链` ①（计数 ≥5）按 spec §5.2 末尾那段**不设牙**：计数判据的牙等价于「删一条少一条」，
被 ② 的牙（M12）覆盖。台账里照这一句写，不假装它有牙。
**同一组里 ③（每篇 ≤ 2 枚）和 ④（链接文字非空词）也没有牙**——这两格防的是未来往正文堆链、
图省事写「点这里」，而本批六条链是一次写定的，判据此刻没有对应的现实形状可打。
三格连价钱一起进 Task 10 Step 8.6 的无牙矩阵，不要在这一刀里只交代 ①。

在 `check-seo-teeth.mjs` 的 `const cases = [` 数组尾部追加一条，并在数组之前加两个共用工具：

```js
/** 把变异只打进正文区间。取 `#post-body` 开到它后面第一个 `</article>`——这一段真区间
 *  一定包含在内（正文里若嵌了 `<article>`，真区间更长），所以命中它的变异必定命中正文。 */
function subInBody(html, from, to, where) {
  const at = html.search(/<article\b[^>]*\bid="post-body"[^>]*>/i);
  const close = html.indexOf('</article>', at);
  if (at < 0 || close <= at) throw new Error(`${where}：切不到正文区间`);
  const span = html.slice(at, close);
  const n = span.split(from).length - 1;
  if (n !== 1) throw new Error(`${where}：正文里 ${from} 出现 ${n} 次，不是恰好一处`);
  return html.slice(0, at) + span.replace(from, to) + html.slice(close);
}
const bodyToolLink = (rel) => {
  const html = fs.readFileSync(siteAbs(rel), 'utf8');
  const at = html.search(/<article\b[^>]*\bid="post-body"[^>]*>/i);
  const close = html.indexOf('</article>', at);
  return at >= 0 && close > at ? /href="(\/better-blog\/tools\/[a-z0-9-]+\.html)"/.exec(html.slice(at, close)) : null;
};
```

```js
  {
    name: 'M12 正文里的工具内链指向产物中不存在的一页',
    group: '内链',
    expect: '产物里没有 tools/nope.html',
    mut: () => {
      const q = first(POSTS.filter((r) => has(r.rel) && bodyToolLink(r.rel)), '正文里有工具内链的产物');
      const href = bodyToolLink(q.rel)[1];
      siteEdit(q.rel, (s) => subInBody(s, href, `${BASE.slice(0, BASE.length)}/tools/nope.html`.replace(/^\/better-blog/, href.replace(/tools\/[a-z0-9-]+\.html$/, '')), `M12 ${q.rel}`), 'M12 落点');
    },
  },
```

上面那行 `to` 太绕，**执行时写成这个**（把 `/tools/<slug>.html` 那一段换成 `/tools/nope.html`，baseurl 原样留着）：

```js
      siteEdit(q.rel, (s) => subInBody(s, href, href.replace(/\/tools\/[a-z0-9-]+\.html$/, '/tools/nope.html'), `M12 ${q.rel}`));
```

三条「否则牙是假的」：
1. `bodyToolLink` 必须在**正文区间内**取 href——文末自动卡也全是 `/tools/*.html`，
   打在那上面 内链 组一颗都不红，就是假牙。`first(...)` 找不到就抛，抛了会被记成红灯，不会静默。
2. 目标按运行时挑选（`POSTS.filter(...)`），不钉死篇名：Task 8 之后正文有链的是六篇，
   日后加第七篇不该让这把牙失效。
3. `expect` 与判据那句逐字对上（`产物里没有 tools/nope.html——这一条是 404` 的前半）。

```bash
node scripts/check-seo-teeth.mjs --only=M12
```

预期：`M12` 那行绿，摘要里 `内链 1`。

- [x] **Step 6：全绿、格式化、提交**

```bash
node scripts/check-seo.mjs > /tmp/gate/sp4-t8-gate.out 2>&1; echo "gate exit=$?"
node scripts/check-seo-teeth.mjs > /tmp/gate/sp4-t8-teeth.out 2>&1; echo "teeth exit=$?"; tail -3 /tmp/gate/sp4-t8-teeth.out
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo.mjs scripts/check-seo-teeth.mjs
npx --no-install prettier --write _posts/2026-09-26-json-render-silent-strip.md _posts/2026-09-22-claude-advisor-readme-row.md _posts/2026-09-21-pnpm-task-settings.md _posts/2026-09-10-nextjs-avif-trap.md _posts/2017-08-25-common-tools.md _posts/2017-06-06-git-common-command.md
node scripts/check-seo.mjs 2>&1 | tail -2
```

预期 `gate exit=0`、`teeth exit=0`（分账行含 `描述 5 / 词表 7 / 内链 1`）。
**prettier 排在门之后**：它会重排帖子里的 ```js 围栏（补分号会改 `article-check` 的字数口径），
所以「写完→格式化→再跑门」的顺序不能倒；本分支没有 `article-check.mjs`（在 main），
但格式化后仍要重跑一次门确认没红。

> **执行时回写（2026-10-07，提交 `7ac2723`）两处：**
>
> 1. 分账读数实测是 **`描述 6 / 词表 6 / 内链 1`**，不是这里的 `描述 5 / 词表 7 / 内链 1`——
>    与 Task 7 Step 3 那条回写同一个原因（M9 登记在 `描述`）。其余预期（`gate exit=0`、
>    `teeth exit=0`、台账 149 → 150 全绿）逐条对上。
> 2. **Step 6 里那行 `prettier --write` 六篇正文没有执行。** 先用 `--stdin-filepath` 在 HEAD 版本上量过：
>    `2026-09-26` 那篇已有 **13 行**、`2017-06-06` 那篇已有 **2 行**与本次改动无关的格式化差异，
>    真跑 `--write` 会把整篇重排混进这一刀的内容提交里（「删改只动违规本身」）。
>    两个脚本照常过 prettier，重排前后 `node --check`、门与台账都重跑过。

```bash
git add -- scripts/check-seo.mjs scripts/check-seo-teeth.mjs _posts/2026-09-26-json-render-silent-strip.md _posts/2026-09-22-claude-advisor-readme-row.md _posts/2026-09-21-pnpm-task-settings.md _posts/2026-09-10-nextjs-avif-trap.md _posts/2017-08-25-common-tools.md _posts/2017-06-06-git-common-command.md
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t8.txt
```

`git diff --cached --name-only` 必须正好这 8 行。**不许** `git add .`（main 工作树里另一场会话有约 20 个暂存文件，`vendor` 软链也在这棵的未跟踪里）。
提交信息主题：`feat(blog): 正文里补六条真能点到的工具内链，内链组四条判据落地（含每篇≤2枚与 baseurl 核）`。

---

## Task 9：`目录` 组五条判据（先红 81）+ A8 构建期静态目录

**这一刀是四刀里唯一加构建期逻辑的一刀。** 产物形状：79 篇文章页在正文之前多一份 `<nav class="toc-static">`，
条目是构建期从**渲染后的 HTML** 里读的 `h2`/`h3`（不是从 markdown 猜）；JS 起来后它被 CSS 收起，`dev/js/editorial.js` 一个字节不改。

**Files:**
- Create: `_plugins/toc.rb`
- Modify: `_layouts/post.html`（两处：`:213` 之后插入静态块、`:276-281` 那段注释整段改写）
- Modify: `dev/sass/common/editorial.scss`（`:1501` 之后新增 `.toc-static` 一族）
- Modify: `scripts/check-seo.mjs`（组 14 `目录` + `GROUPS` 加一项）
- Modify: `scripts/check-seo-teeth.mjs`（M11 / M13 / M14 / M17）

- [x] **Step 1：探针站实测挂点（先证明钩子看得见渲染后的 HTML，再写真代码）**

spec §4.4 把挂点留给「计划第一步的探针」。建一个一次性小站（真构建约 1 s，比在主干上试快两个数量级）：

```bash
mkdir -p /tmp/gate/probe/{_layouts,_plugins,_posts}
cd /tmp/gate/probe
printf 'title: 探针\npermalink: /:year/:month/:day/:title.html\nfuture: false\n' > _config.yml
cat > _posts/2026-01-01-a.md <<'MD'
---
layout: post
title: 探针
---

## 第一<code>节</code>

正文一

### 二级 · 重复

正文二

## 第一<code>节</code>

正文三

<h3>📎 手写没有 id 的</h3>
MD
cat > _layouts/post.html <<'LIQ'
<!doctype html><html><head><meta charset="utf-8"><title>{{ page.title }}</title></head><body>
<div id="marker">{{ page.toc | size }}</div>
{%- if page.toc -%}
<nav class="toc-static"><ol>{%- for item in page.toc -%}<li class="toc-{{ item.level }}"><a href="#{{ item.id }}">{{ item.text | escape }}</a></li>{%- endfor -%}</ol></nav>
{%- endif -%}
<article id="post-body">{{ content }}</article>
</body></html>
LIQ
cat > _plugins/toc_probe.rb <<'RB'
module Jekyll
  module TocProbe
    Jekyll::Hooks.register :documents, :post_convert do |doc|
      Jekyll.logger.warn 'PROBE', "path=#{doc.relative_path.inspect} html=#{doc.content.to_s[0, 40].inspect}"
    end
  end
end
RB
bundle exec jekyll build --destination _out 2>&1 | grep -E 'PROBE|error' | head -4
```

看两件事：

1. `path="_posts/2026-01-01-a.md"`——**没有前导斜杠**。写成 `start_with?('/_posts/')` 会一篇都不命中，
   而它的形状是「整个功能静默不干活」（构建成功、产物没有块、门禁不报插件坏）。
2. `html="<h2 id="第一节">…"`——`:post_convert` 拿到的已经是 kramdown 转换后的 HTML，`id` 也在里面。
   `:documents, :post_render` 拿不到（那时 `doc.output` 还没拼版式），`:site, :post_render` 要自己回写整页，
   两者都不如 `:post_convert`：它能改 `doc.content`（补 `id`），也能把条目写进 `doc.data['toc']` 让版式读 `page.toc`。

再把插件换成下面 Step 3 的正式实现（模块名随意、钩子与算法照抄），重建后读产物，**必须逐字看到这四件事**：

```bash
bundle exec jekyll build --destination _out >/dev/null 2>&1
od -c _out/2026/01/01/a.html | grep -c 'section-4' # ≥1：手写没 id 的那枚被补上了
grep -o '<li[^>]*><a href="#[^"]*"' _out/2026/01/01/a.html
```

- 重复标题各得自己的 id（`第一节` 与 `第一节-1`，kramdown 的 `-1` 后缀），条目两条都在；
- `<code>` 嵌在标题里时文本被压成 `第一节`（标签剥掉），href 与正文 id 相等；
- `<h3>📎 手写没有 id 的</h3>` 在产物里变成 `<h3 id="section-4">`，且**只有这一枚**是补出来的；
- 条目不足 2 个时 `page.toc` 是 `nil` 而不是 `[]`——空数组在 Liquid 里是 truthy，写成 `[]` 会出一个空框。

`--limit_posts` 不是 `jekyll build` 的命令行开关（是 site 选项），别指望用它缩小探针范围。

- [x] **Step 2：`目录` 组五条判据进 `check-seo.mjs`（这一步结束时门红 81 条）**

插在 `// ── 跑 ──` 那一行（`:1143`，Task 8 之后行号已漂，按锚点找）的**正上方**：

```js
// ── 组 14：目录（A8 构建期静态目录，spec §4.4 / §5.1 组 目录）─────────────────────

const TOC_NAV = /<nav class="toc-static" aria-label="文章目录（静态）">([\s\S]*?)<\/nav>/;
const TOC_HEAD = /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const TOC_ATTR_ID = /\bid=["']([^"']*)["']/i;
const TOC_LI = /<li class="toc-static-item toc-(h[23])"><a class="toc-static-link" href="#([^"]*)">/g;
const TOC_MIN = 2; // 与 editorial.js:250-251 同一口径
const TOC_PAGES_OK = 79; // §1 事实 19：80 篇产出语料里只有 2018/12/25/qqweiboshare.html 的 h2+h3 < 2
const TOC_JS_MARKERS = [
  ['dev/js/editorial.js 里的 "toc-link"', "'toc-link'"],
  ['dev/js/editorial.js 里的 "toc-list"', "'toc-list'"],
  ['dev/js/editorial.js 里的 ".toc-fab"', "'.toc-fab'"],
];

let tocBlockPages = 0;
for (const { rel, text } of postPages) {
  const region = postBodyRegion(text);
  if (!region) continue; // 「这一页没有 #post-body」由语料组报，这里不重复占一格
  const body = text.slice(region.start, region.end);
  const heads = [];
  let k = -1;
  for (const m of body.matchAll(TOC_HEAD)) {
    k += 1;
    const idm = TOC_ATTR_ID.exec(m[2]);
    heads.push({ level: m[1].toLowerCase(), id: idm ? idm[1] : `section-${k + 1}` });
  }
  const navAt = text.search(TOC_NAV);
  if (heads.length < TOC_MIN) {
    if (navAt >= 0) bad('目录', rel, `② 正文只有 ${heads.length} 个 h2/h3（< ${TOC_MIN}），产物里却有静态目录块——阈值与 JS 分叉了，读者会看到一个空框`);
    continue;
  }
  tocBlockPages += 1;
  if (navAt < 0) {
    bad('目录', rel, `① 正文有 ${heads.length} 个 h2/h3，产物里却没有 <nav class="toc-static"> 块`);
    continue;
  }
  const items = [...TOC_NAV.exec(text)[1].matchAll(TOC_LI)].map((m) => ({ level: m[1], id: m[2] }));
  if (items.length !== heads.length) bad('目录', rel, `③ 静态条目 ${items.length} 条 vs 正文标题 ${heads.length} 个`);
  for (let i = 0; i < Math.max(items.length, heads.length); i++) {
    const a = items[i];
    const b = heads[i];
    if (!a || !b || a.id !== b.id || a.level !== b.level) {
      bad('目录', rel, `① 序列不一致：第 ${i + 1} 条静态条目是 ${a ? `${a.level}#${a.id}` : '（缺）'}，正文第 ${i + 1} 个标题是 ${b ? `${b.level}#${b.id}` : '（缺）'}`);
      break;
    }
  }
  const hasJsAt = text.indexOf('has-js');
  if (hasJsAt < 0 || hasJsAt > navAt) bad('目录', rel, '⑤ 的门控半边：.toc-static 之前没有那段给 <html> 挂 has-js 的内联脚本——静态块会先画一帧再收起，读者看到一次塌陷');
}
if (tocBlockPages !== TOC_PAGES_OK) bad('目录', '_site', `③ 带静态目录块的产物是 ${tocBlockPages} 篇，应为 ${TOC_PAGES_OK} 篇（80 篇产出语料里只有 2018/12/25/qqweiboshare.html 的 h2+h3 < 2）`);

for (const [what, needle] of TOC_JS_MARKERS) {
  if (!readSrc('dev/js/editorial.js').includes(needle)) bad('目录', 'dev/js/editorial.js', `④ 找不到 ${what}——A8 不许把 JS 那一族删掉`);
}
if (postPages.length) {
  for (const needle of ['id="toc-list"', 'class="toc-list"', 'class="toc-fab"']) {
    if (!postPages[0].text.includes(needle)) bad('目录', postPages[0].rel, `④ 文章页产物里没有 ${needle}：JS 目录的三个落点少了一个`);
  }
}

{
  const css = readSite('assets/css/index.min.css');
  let hit = null;
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (!sels.some((s) => /(^|\s)body\.has-toc \.toc-static$/.test(s))) continue;
    if (!/display:\s*none/.test(m[2])) {
      bad('目录', 'assets/css/index.min.css', `⑤ body.has-toc .toc-static 那条规则里没有 display:none（实际声明块 ${m[2].slice(0, 60)}）`);
      hit = null;
      break;
    }
    const depth = (css.slice(0, m.index).match(/\{/g) || []).length - (css.slice(0, m.index).match(/\}/g) || []).length;
    if (depth !== 0) bad('目录', 'assets/css/index.min.css', `⑤ 隐藏规则落在了 @media 里（深度 ${depth}）——只在某个断点生效，别的断点仍是两份同显`);
    if (!sels.some((s) => /(^|\s)html\.has-js \.toc-static$/.test(s))) bad('目录', 'assets/css/index.min.css', '⑤ 隐藏规则的选择器集里没有 html.has-js .toc-static——JS 起来那一帧之前没人收起静态块');
    hit = sels;
    break;
  }
  if (!hit) bad('目录', 'assets/css/index.min.css', '⑤ 找不到 body.has-toc .toc-static 这条规则——静态块与 JS 抽屉会同时显示');
}
```

`GROUPS` 那一行（`:1145`）末尾追加 `'目录'`，共 14 项：

```js
const GROUPS = ['keywords', 'modified', 'JSON-LD', '分页门', 'ItemList', 'manifest', '接线', 'head', '相关工具', '换源', '描述', '词表', '内链', '目录'];
```

```bash
node scripts/check-seo.mjs > /tmp/gate/t9-red.txt 2>&1; echo "gate exit=$?"
grep -c '^✗ 目录' /tmp/gate/t9-red.txt; grep '^✗ 目录' /tmp/gate/t9-red.txt | grep -vc '① '; tail -1 /tmp/gate/t9-red.txt
```

**预期 `gate exit=1`，`目录` 恰好 81 条**：79 条 ①「没有 `<nav class="toc-static">` 块」+ 1 条 ③「0 篇 ≠ 79 篇」+ 1 条 ⑤「找不到规则」；
后两条命令分别给出 `81` 与 `2`。**这里的 79 是从产物现数的**——Step 1 之前如果 `_site` 是旧物，这个数就不是 79，
所以本步骤必须在 Task 1 的重建之后跑。④ 与 ② 此刻应当零红（JS 那一族还在、还没有页面多长出块）。

> **执行时回写（2026-10-07，提交 `d3869d3`）两处，都在上面这段代码与它的预期之间：**
>
> 1. **`:1614` 那行 `tocBlockPages += 1` 的位置让它自己管的 ③ 变成一把假牙。** 它排在
>    `if (navAt < 0)`（`:1615`）之前，数的是「这篇**该有**块」而不是「产物里**有**块」：A8 一行没落地时
>    79 篇全走 ① 那支、计数器照加不误，③ 读成 `79 == 79` 恒绿。实测红灯因此是 **80 条**
>    （`/tmp/gate/t9-red.txt` 末行 `✗ SEO 门禁：80 条不通过`），而不是这里预期的 81。
>    把这一行挪到守卫之后（现 `check-seo.mjs:1469-1471`，带注释说明为什么不能挪回去），
>    红灯正好 **81 = 79×① + ③ + ⑤**、非 ① 恰为 **2**，与这里的预期逐字对上。
> 2. **`grep -c '^✗ 目录'` 与它后面那条同形命令永远给 0**——红线形状是 `✗ [组] 条目：消息`，组名带方括号。
>    要写 `grep -c '^✗ \[目录\]'`（Task 8 那条回写是同一个坑，这次连计划里的验证命令一起改口）。
> 3. **上面那段代码里的 `TOC_PAGES_OK = 79` 与 ③ 的「应为 79 篇」在集成那一轮被删掉，期望值改成现算**
>    （提交 `ddcf682`，SP3→SP2→SP4 合到 main 之上后、用来做集成验证的那棵树）。触发它的是一篇与目录组无关的新帖：
>    `_posts/2026-10-06-vite-wasm-query-fs-bypass.md` 的产物里有 5 个 h2/h3（`node` 从 `id="post-body"` 数到 `</article>`），
>    达标篇数因此 79 → 80；A8 的块由 `_plugins/toc.rb` + 布局按标题数自动产出，新帖不需要任何额外动作，
>    所以带块篇数也是 80——**此时钉死的常数会让 ③ 对一份完全正确的产物报红**。
>    读数出自一份探针副本（`/tmp` 会被清，所以这里写构造不写文件路径）：把 `check-seo.mjs` 拷到别处、
>    在 ③ 那行之前插一句打印两个计数器的语句，用 `--root=<工作树> --site=<工作树>/_site` 跑它，
>    两个数都是 80；仓库里那份脚本没动过。落地形状：删常数、加 `tocNeededPages`（在 `< TOC_MIN` 分支之后、`navAt < 0` 守卫之前 `+= 1`），
>    ③ 改判 `tocBlockPages !== tocNeededPages`，红话把差值交回 ① 逐页点名。
>    这次改口没拆牙：`目录` 组 4 把牙的 `expect` 串里一处 `79` 都没有（各为 `序列不一致` / `却没有 <nav class="toc-static"> 块` /
>    `找不到 body.has-toc .toc-static` / `没有那段给 <html> 挂 has-js 的内联脚本`），同一棵树上复跑 `check-seo-teeth.mjs` 仍是 **159/159 组变异如期变红**。

- [x] **Step 3：新建 `_plugins/toc.rb`**

整本文件（探针里那份的实现，模块名换正式名）：

```ruby
# Jekyll 插件：构建期静态目录（SP4·A8）
#
# 为什么需要它：目录今天只有客户端一份（dev/js/editorial.js §1），不开脚本的访客与
# 爬虫拿不到「这篇有哪几节」。这一刀把同一份条目在构建期算一次、写进 doc.data['toc']，
# 版式在正文之前渲染一个 <nav class="toc-static">，JS 起来后由 CSS 收起它。
#
# 为什么挂在 :documents, :post_convert：锚点必须逐字等于产物里 heading 的 id，而 kramdown 的
# auto_ids 是在转换阶段定的（中文标题不转写，实测产物是 <h2 id="线性查找">），重复文本才加 -1，
# 手写的 <h3>…</h3> 干脆没有 id——这些都只有「转换之后」才看得见。Task 9 Step 1 的探针实测：
# :post_render 时版式还没拼，:post_convert 时 doc.content 正是渲染后的正文，改得动也读得到。
#
# 为什么不改 dev/js/editorial.js：JS 那份带 --i 错峰动效与滚动高亮，靠它自己 appendChild 的
# 一批 li（§2 非目标）。两份 DOM 同时存在是这一刀的价格，量在 §6.3。
module Jekyll
  module TocStatic
    # 与 editorial.js:250-251 同一口径：不足两节不出目录，否则短文只多一个空框。
    MIN_HEADINGS = 2
    HEADING = %r{<(h[23])\b([^>]*)>(.*?)</\1>}mi
    ID_ATTR = /\bid=["']([^"']*)["']/i
    ENTITIES = { '&amp;' => '&', '&lt;' => '<', '&gt;' => '>', '&quot;' => '"', '&#39;' => "'", '&apos;' => "'", '&nbsp;' => ' ' }.freeze

    # 标题里的 <code>、<img> 这类内联标签不进目录：JS 那边用的是 textContent。
    def self.plain_text(html)
      t = html.to_s.gsub(/<[^>]*>/, '')
      ENTITIES.each { |from, to| t = t.gsub(from, to) }
      t = t.gsub(/&#(\d+);/) { [Regexp.last_match(1).to_i].pack('U') }
      t.split(/\s+/).join(' ').strip
    end

    Jekyll::Hooks.register :documents, :post_convert do |doc|
      # 相对路径没有前导斜杠（探针实测 "_posts/x.md"）；写成 "/_posts/" 会一篇都不命中，
      # 而坏法是静默的：构建成功、产物没块、门禁只报缺块。
      next unless doc.relative_path.to_s.start_with?('_posts/')

      index = -1
      entries = []
      doc.content = doc.content.to_s.gsub(HEADING) do
        match = Regexp.last_match
        index += 1
        attrs = match[2].to_s
        id = attrs[ID_ATTR, 1]
        # 与 editorial.js:256-257 逐字对齐：id = 'section-' + (i + 1)，i 数的是所有 h2/h3。
        if id.to_s.empty?
          id = "section-#{index + 1}"
          "<#{match[1]} id=\"#{id}\"#{attrs}>#{match[3]}</#{match[1]}>"
        else
          match[0]
        end
      end
      # 不足两节要写 nil 而不是 []：空数组在 Liquid 里是 truthy，{%- if page.toc -%} 会进块并渲染空框。
      doc.data['toc'] = entries.size >= MIN_HEADINGS ? entries : nil
    end
  end
end
```

**上面这段少一处就白写**：`gsub` 的 block 里必须同时做「补 id」和「收条目」，两件事共用同一个 `index`，
否则补出来的 `section-N` 与目录里的 href 会错位一格。

- [x] **Step 4：`_layouts/post.html` 接线（两处）**

**(a) 静态块。** 锚点这一行（`:213`）：

```html
    <div class="post-main" id="main">
```

在它**正下方**插入这四行 Liquid（`{%- if -%}` / `{%- capture -%}` / `{%- endif -%}` 的空白裁剪必须原样保留——
它们保证产物里 `<script>`、`<nav>`、`<article>` 之间不掺换行与缩进，§6.3 的字节恒等式才落得准）：

```liquid
    {%- if page.toc -%}
    {%- capture toc_static_items -%}{%- for item in page.toc -%}<li class="toc-static-item toc-{{ item.level }}"><a class="toc-static-link" href="#{{ item.id }}">{{ item.text | escape }}</a></li>{%- endfor -%}{%- endcapture -%}<script>document.documentElement.className += ' has-js';</script><nav class="toc-static" aria-label="文章目录（静态）"><p class="toc-static-title">本文目录</p><ol class="toc-static-list">{{ toc_static_items }}</ol></nav>
    {%- endif -%}
```

那段 `<script>` 不是装饰，也不是「能删的冗余」：`body.has-toc` 是 `editorial.min.js`（`post.html:583`，正文之后的
阻塞脚本）跑完才挂上的，在 470 KB 的页面上 fast3g 实测那一刻是 **8.1 s**；只靠 `has-toc` 收起，静态块要先被画出来
再塌陷。夹具实测（Step 7）：同一个 nav，只挂 `has-toc` 时 CLS = 0.07426（82 px 的块塌掉），加了这段前置内联脚本时
CLS = 0.00000（JS 开着就从来没占过位）。删掉它 = 把 §6.3 的 CLS 那一格从 0 换成一个正数。

**(b) 改写那段注释。** 整段替换（`:276-281`，从 `{%- comment -%}` 到对应的 `{%- endcomment -%}`）：

原文四行承诺的是「无 JS 环境也拿不到半截抽屉」，A8 之后这句不再成立（spec §4.4 最后一条：留着是缺陷）。

```liquid
    {%- comment -%}
    下面这一族是 dev/js/editorial.js §1 的目录：条目由 JS 从 #post-body 的 h2/h3 现建，
    建不出（不足 2 节）就不给 body 加 .has-toc，这一栏保持隐藏，不会出现空白框。
    窄屏（<1240px）右侧栏位放不下，这一栏改由左下角「目录」按钮唤起的底部抽屉呈现：
    同一份 DOM、同一套高亮逻辑，不复制列表。
    「无 JS 也读得到目录」由 :214 那块静态目录（_plugins/toc.rb + .toc-static）负责——
    它是构建期从渲染后的正文里出的条目，JS 一起来就被 CSS 收起，两份不同时可见（判据在组 目录）。
    {%- endcomment -%}
```

- [x] **Step 5：`dev/sass/common/editorial.scss` 新增 `.toc-static` 一族**

插在 `.toc-item.is-active>.toc-link { … }` 那块（`:1497-1501`）的正下方、`.code-wrap` 那段注释之前，**顶层**（不能进任何 `@media`，⑤ 有深度判据）：

```scss
// A8 构建期静态目录（_plugins/toc.rb → post.html :214）。无 JS 时它是读者唯一的目录；
// JS 起来（或内联脚本先一步认出「有 JS」）就整块收起，绝不同时看到两份。
// 色与字号逐字跟着 JS 那一族的 .toc-title / .toc-link：--ink-3 落在 --paper 上实测 4.85:1，
// 13px 稳过 AA，不给这一刀添新的对比度账。
.toc-static {
    padding: 12px 16px;
    margin: 0 0 24px;
    font-size: 13px;
    border: 1px solid var(--rule);
    border-radius: 6px;
}

.toc-static-title {
    margin-bottom: 8px;
    font-family: $font-meta;
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--ink-3);
}

.toc-static-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.toc-static-item {
    line-height: 20px;
}

.toc-static-link {
    color: var(--ink-3);

    &:hover {
        color: var(--ink);
    }
}

.toc-h3 > .toc-static-link {
    padding-left: 12px;
    font-size: 12px;
}

// 两条收起条件：has-js 在静态块之前由内联脚本挂上（首帧就不占位，不塌），has-toc 是兜底。
// 写进同一条规则 = 产物 CSS 里一个选择器集，组 目录 ⑤ 判的是「两条都在这一条里」。
body.has-toc .toc-static,
html.has-js .toc-static {
    display: none;
}
```

自证 `px` 不会被换成 `vw`（`postcss.config.js:49` 有 `.toc`、`:72` 有 `.toc-`、`:62` 有 `.has-toc`，按子串命中）：

```bash
node -e 'const c=require("./postcss.config.js");const b=c.plugins["postcss-px-to-viewport"]?.selectorBlackList||[];for(const s of [".toc-static",".toc-h3","html.has-js .toc-static"])console.log(s, b.some((k)=>typeof k==="string"?s.includes(k):k.test(s)))'
```

三行都必须是 `true`，否则这一族的间距会跟着视口缩放（`.toc-h3` 靠 `.toc-` 命中）。

- [x] **Step 6：重建 + 五处产物自证 + 门转绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
npx vite build && bundle exec jekyll build
node scripts/check-seo.mjs > /tmp/gate/t9-green.txt 2>&1; echo "gate exit=$?"; tail -1 /tmp/gate/t9-green.txt
```

产物读数（**路径里的年月日是三段目录**，显示层会把它折成 `2018-12-25/…`，认形状要用 `od -c`）：

```bash
S=_site
node -e '
const fs=require("fs"),p=require("path");
const out=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=p.join(d,e.name);if(e.isDirectory())walk(q);else if(e.name.endsWith(".html"))out.push(q);}})(process.argv[1]);
const posts=out.filter(q=>/^_site\/\d{4}\/\d{2}\/\d{2}\//.test(q));
let withBlock=0,entries=0,noBlock=[];
for(const q of posts){const s=fs.readFileSync(q,"utf8");const has=/<nav class="toc-static" aria-label="文章目录（静态）">/.test(s);
 if(has){withBlock++;entries+=(s.match(/<li class="toc-static-item toc-h[23]">/g)||[]).length;}else noBlock.push(q);}
console.log("articlePages="+posts.length,"withBlock="+withBlock,"entries="+entries,"withoutBlock="+JSON.stringify(noBlock));
' "$S"
grep -c 'id="section-' "$S"/2026/05/31/AI-model-rating.html
grep -o 'body\.has-toc \.toc-static,html\.has-js \.toc-static{[^}]*}' "$S"/assets/css/index.min.css
grep -c 'class="toc-static"' "$S"/2018/12/25/qqweiboshare.html || true
```

预期（每个数都要对上，对不上就按 §「这一刀排错表」查，不要改判据迁就产物）：

| 读数 | 期望 | 口径 |
| --- | --- | --- |
| `articlePages` | 80 | 产出语料（`2100-10-25-practice-demo.md` 不产出） |
| `withBlock` | **79** | §1 事实 19 |
| `entries` | **881** | 全站 h2+h3 总数，无一篇 <2 节，所以块条目 == 标题数 |
| `withoutBlock` | `["_site/2018/12/25/qqweiboshare.html"]` | 那一篇 0 个 h2/h3 |
| `id="section-`（`2026/05/31/AI-model-rating.html`） | 1 | 全站唯一没 id 的标题是它的 `<h3>📎 参考文献</h3>` |
| CSS 那条 | `body.has-toc .toc-static,html.has-js .toc-static{display:none}` | 一个选择器集、两条收起条件 |
| `gate exit` | **0** | 末行 `✓ SEO 门禁 14 组全绿（… / 描述 / 词表 / 内链 / 目录）` |

顺带自证「静态条目点的到的地方真的在正文里」——这一条 G4 的真正内容，不是「有块」：

```bash
node -e '
const fs=require("fs");
const f="_site/2026/06/05/ai-sdd.html";            // 中位那篇
const s=fs.readFileSync(f,"utf8");
const hrefs=[...s.matchAll(/<nav class="toc-static"[\s\S]*?<\/nav>/g)[0][0].matchAll(/href="#([^"]*)"/g)].map(m=>m[1]);
const ids=[...s.matchAll(/<h[23]\b[^>]*\bid="([^"]*)"/g)].map(m=>m[1]);
console.log("entries="+hrefs.length,"每条都在正文 id 集合里="+hrefs.every(h=>ids.includes(h)),"顺序相等="+JSON.stringify(hrefs)===JSON.stringify(ids));
'
```

> **执行时回写（2026-10-07，提交 `d3869d3`）：这一段按原文跑会直接崩，且它只查了一篇。**
>
> `s.matchAll(/<nav class="toc-static"[\s\S]*?<\/nav>/g)[0][0]` 里 `matchAll` 返回的是**迭代器**，
> `[0]` 是 `undefined`，`undefined[0]` 抛 `TypeError` —— 要写 `[...s.matchAll(…)][0][0]`。
> 执行时改成 `/tmp/gate/t9-hrefs3.js`：先断言「该页 nav 块恰好一枚」，再把比较范围从「一篇的中位子集」
> 换成**全 80 篇逐字同序比对**，读数是 `文章页=80 有块=79 逐字顺序相等=79 只子集=0 不符=0`
> （比原计划那句「每条都在正文 id 集合里」强一档：href 序列与 h2/h3 的 id 序列连顺序一起钉住）。
> Task 10 Step 的 G4 那两条命令（`:2692-2693`）用的是 `indexOf` 切片，没有这个坑。

- [x] **Step 7：A/B 脚手架 + 冒烟（2 轮/侧，正式五个数在 Task 10）**

脚手架全文落 `/tmp/gate/sp4-ab.mjs`（不进仓库——它要读的是两棵树的 `_site`，§6.4 的台账集不含它）。
**这段代码是先在夹具上跑通过的**，三条反证见下面 Step 7c；照抄时别把 `${MODE === 'action' ? …}` 那三元改成「更整洁」的写法，
它是 CLS 与首次动作分开的唯一机制。

```js
// SP4 §6.3 A/B 脚手架：fast3g 节流 + 1280×900 自证 + CLS / has-toc 时刻 / 首次动作
// node /tmp/gate/sp4-ab.mjs --site=<某棵树的 _site> --label=head|new --mode=cls|action --rounds=N \
//      --pages=2019/07/26/javascript-design-pattern.html,2026/06/05/ai-sdd.html --out=<jsonl>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = (name, dflt) => {
  const m = new RegExp(`--${name}=(\\S+)`).exec(process.argv.slice(2).join(' '));
  return m ? m[1] : dflt;
};
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = path.resolve(arg('site', '_site'));
const LABEL = arg('label', 'x');
const MODE = arg('mode', 'cls');
const ROUNDS = Number(arg('rounds', '1'));
const SETTLE = Number(arg('settle', '1500'));
const PAGES = arg('pages', '').split(',').filter(Boolean);
const OUT = arg('out', `/tmp/gate/ab-${LABEL}-${MODE}.jsonl`);
const THROTTLE = arg('throttle', 'fast3g');
if (!PAGES.length || !fs.existsSync(SITE)) {
  console.error('必须给 --site 与 --pages');
  process.exit(2);
}
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

// ── 静态服务器：/better-blog/<rel> → SITE/<rel>，一律 no-store ──────────────────
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/better-blog\/?/, '') || 'index.html';
  const file = path.join(SITE, rel);
  if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404).end('nope');
    return;
  }
  const buf = fs.readFileSync(file);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}/better-blog`;

// 自证：服务器吐出的字节 == 磁盘上的字节（否则量到的是旧产物，整轮作废）
for (const p of PAGES) {
  const disk = fs.readFileSync(path.join(SITE, p));
  const served = Buffer.from(await (await fetch(`${BASE}/${p}`)).arrayBuffer());
  if (md5(served) !== md5(disk)) {
    console.error(`✗ served != disk：${p}（端口被别的东西占了，或在量旧产物）`);
    process.exit(2);
  }
}
console.log(`selfproof: served==disk for ${PAGES.length} page(s), site=${SITE}, port=${PORT}`);

// ── Chrome：--remote-debugging-port=0，端点只认这个 pid 的 stderr ────────────────
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'sp4ab-'));
const chrome = spawn(
  CHROME,
  ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-timer-throttling', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let stderrBuf = '';
const endpoint = await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error(`20 s 内没打出 DevTools 端点：${stderrBuf.slice(0, 300)}`)), 20000);
  chrome.stderr.on('data', (c) => {
    stderrBuf += c.toString();
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(stderrBuf);
    if (m) {
      clearTimeout(to);
      resolve(m[1]);
    }
  });
  chrome.on('exit', (code) => reject(new Error(`chrome exit ${code}: ${stderrBuf.slice(0, 300)}`)));
});
console.log(`chrome pid=${chrome.pid} endpoint=${endpoint.slice(0, 40)}…`);

// ── 极简 CDP 客户端（flatten session 路由）────────────────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.message} ${JSON.stringify(msg.error.data || '')}`));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) h(msg);
      }
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('ws connect failed'));
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(fn) {
    this.handlers.push(fn);
  }
}
const cdp = await CDP.connect(endpoint);

// ── 页内探针（注入到每个新文档；不用正则字面量，避免模板字面量吃掉反斜杠）────────
const INIT = `
window.__p = { cls: 0, shifts: [], longTasks: [], lastLongTaskEnd: null, hasTocAt: null, navHAt0: null, navHAtToc: null, firstActionAt: null, firstActionSel: null, innerWidth: null, timings: null, err: null };
try {
  new PerformanceObserver(function (list) {
    for (var e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__p.cls += e.value;
      window.__p.shifts.push({ v: Math.round(e.value * 1e5) / 1e5, t: Math.round(e.startTime * 10) / 10, n: (e.sources || []).length });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver(function (list) {
    for (var e of list.getEntries()) {
      window.__p.longTasks.push({ t: Math.round(e.startTime * 10) / 10, d: Math.round(e.duration * 10) / 10 });
      window.__p.lastLongTaskEnd = Math.round(Math.max(window.__p.lastLongTaskEnd || 0, e.startTime + e.duration) * 10) / 10;
    }
  }).observe({ type: 'longtask', buffered: true });

  var hasToc = function (cls) { return (' ' + (cls || '') + ' ').indexOf(' has-toc ') >= 0; };
  var navH = function () { var n = document.querySelector('.toc-static'); return n ? Math.round(n.getBoundingClientRect().height * 10) / 10 : null; };

  (function attachMo() {
    if (!document.documentElement) { setTimeout(attachMo, 1); return; }
    new MutationObserver(function (muts) {
      for (var m of muts) {
        if (m.target && m.target.tagName === 'BODY' && hasToc(m.target.className) && window.__p.hasTocAt === null) {
          window.__p.hasTocAt = Math.round(performance.now() * 10) / 10;
          window.__p.navHAtToc = navH();
        }
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  })();
  (function sampleNav() {
    var h = navH();
    if (h === null) { setTimeout(sampleNav, 5); return; }
    if (window.__p.navHAt0 === null) window.__p.navHAt0 = h;
  })();

  ${MODE === 'action' ? `var tryClick = function () {
    if (window.__p.firstActionAt !== null) return;
    var a = document.querySelector('.toc-static-link') || document.querySelector('.toc-link');
    if (a) {
      var before = window.scrollY;
      a.click();
      if (window.scrollY !== before || window.location.hash) {
        window.__p.firstActionAt = Math.round(performance.now() * 10) / 10;
        window.__p.firstActionSel = String(a.className);
        return;
      }
    }
    setTimeout(tryClick, 50);
  };
  setTimeout(tryClick, 0);` : ''}

  window.addEventListener('load', function () {
    setTimeout(function () {
      var nav = performance.getEntriesByType('navigation')[0] || {};
      window.__p.innerWidth = window.innerWidth;
      window.__p.timings = {
        responseStart: Math.round((nav.responseStart || 0) * 10) / 10,
        dcl: Math.round((nav.domContentLoadedEventEnd || 0) * 10) / 10,
        load: Math.round((nav.loadEventEnd || 0) * 10) / 10,
        interactive: typeof performance.interactive === 'number' ? Math.round(performance.interactive * 10) / 10 : null,
        lastLongTaskEnd: window.__p.lastLongTaskEnd,
      };
    }, ${SETTLE});
  });
} catch (e) {
  window.__p.err = String((e && e.message) || e);
}
`;

const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Network.enable', {}, sessionId);
if (THROTTLE === 'fast3g') {
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, sessionId);
}
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT }, sessionId);

const waitLoad = () =>
  new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('load timeout 90 s')), 90000);
    cdp.on((msg) => {
      if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') {
        clearTimeout(to);
        resolve();
      }
    });
  });

const rows = [];
for (let r = 1; r <= ROUNDS; r++) {
  for (const p of PAGES) {
    const done = waitLoad();
    await cdp.send('Page.navigate', { url: `${BASE}/${p}` }, sessionId);
    await done;
    await new Promise((res) => setTimeout(res, SETTLE + 500));
    const ev = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__p)', returnByValue: true }, sessionId);
    if (!ev.result || typeof ev.result.value !== 'string') throw new Error(`探针没落地：${p}（window.__p 读不到，注入脚本可能语法坏了）`);
    const probe = JSON.parse(ev.result.value);
    if (probe.err) throw new Error(`探针自己抛了：${p} → ${probe.err}`);
    if (probe.innerWidth !== 1280) throw new Error(`视口自证失败：${p} innerWidth=${probe.innerWidth}`);
    rows.push({ label: LABEL, mode: MODE, page: p, round: r, bytes: fs.statSync(path.join(SITE, p)).size, ...probe });
    console.log(`${LABEL}/${MODE} ${p} r${r}: bytes=${rows.at(-1).bytes} cls=${(probe.cls || 0).toFixed(5)} shifts=${probe.shifts.length} hasTocAt=${probe.hasTocAt} navH0=${probe.navHAt0} navH@toc=${probe.navHAtToc} firstAction=${probe.firstActionAt}(${probe.firstActionSel}) t=${JSON.stringify(probe.timings)}`);
  }
}
fs.writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`wrote ${OUT} (${rows.length} rows)`);
chrome.kill('SIGTERM');
server.close();
process.exit(0);
```

**(7b) 四个数的口径**（写死在这里，Task 10 照抄不再另定）：

| 数 | 取值 |
| --- | --- |
| load | `timings.load` = `PerformanceNavigationTiming.loadEventEnd`（ms，从 navigationStart） |
| DOMContentLoaded | `timings.dcl` = `domContentLoadedEventEnd` |
| 可交互 | `timings.lastLongTaskEnd` = 最后一个 longtask 结束的时刻。本机这版 Chrome 的 `performance.interactive` 恒为 `undefined`（实测打出来是 `null`），所以取「脚本尾巴跑完」这一档；`interactive` 字段一并留着，将来可用就直接换 |
| 首次动作 | `mode=action` 的 `firstActionAt` = 从 navigationStart 到「脚本每 50 ms 试探的第一枚目录条目点击真的让视口动了（`scrollY` 变或 `location.hash` 变）」；同时记 `firstActionSel` 说明点的是 `.toc-static-link` 还是 `.toc-link` |
| CLS | `mode=cls` 的 `cls`（`layout-shift` 之和，`hadRecentInput` 的按规范剔除）。**CLS 只能取 cls 模式那一轮**：action 模式自己的 click 会把随后那次塌陷标成 `hadRecentInput` 而丢掉（夹具实测：同一个 fake-new，cls 模式 0.07426 / action 模式 0.00301） |

**(7c) 先跑夹具反证，再量真页面。** 三个夹具落 `/tmp/gate/absite/`（`fake-head` = 今天的行为，`fake-new` = 只靠 `has-toc` 收起，`fake-new2` = 本计划的做法：内联 `has-js` 在前）。

```bash
mkdir -p /tmp/gate/absite
# fake-head.html / fake-new.html / fake-new2.html：正文两段各 2400px 高，400 ms 后挂 body.has-toc（fake-new* 还建一枚 .toc-link）
# fake-new.html 的 <style> 只写 body.has-toc .toc-static{display:none}；fake-new2.html 的选择器集加 html.has-js，且 <body> 第一个元素就是那句 has-js 内联脚本
node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/absite --label=fixture --mode=cls --rounds=1 --throttle=off --settle=900 --pages=fake-head.html,fake-new.html,fake-new2.html --out=/tmp/gate/ab-fix-cls.jsonl
node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/absite --label=fixture --mode=action --rounds=1 --throttle=off --settle=900 --pages=fake-head.html,fake-new2.html --out=/tmp/gate/ab-fix-act.jsonl
```

六条期望值，**有一条不成立就说明脚手架在说谎，不许往下量真页面**：

1. `fake-head` cls 模式：`cls=0.00000`、`shifts=0`、`navHAt0=null`（今天没有静态块，也不该有位移）。
2. `fake-new` cls 模式：`cls>0`（实测 0.07426）、`navHAt0=82` 而 `navHAtToc=0` ——「先画出来再收起」的现场证据。
3. `fake-new2` cls 模式：`cls=0.00000`、`navHAt0=0`（JS 开着时静态块首帧就不占位）。
4. `fake-head` action 模式：`firstActionSel='toc-link'` 且 `firstActionAt > 400`（JS 之前无处可点，实测 441.7 ms）。
5. `fake-new2` action 模式：`firstActionSel='toc-static-link'` 且 `firstActionAt < 400`（实测 317.1 ms）。
6. 每一行 `innerWidth=1280`（不符时脚本自己抛，走不到写文件）。

**(7d) 冒烟 A/B（两棵树交替 2 轮，负载门先过）**：

```bash
sysctl -n vm.loadavg   # 1 分钟负载 > 16 就今天不量，按「拒测」记，既不算绿也不算红
mkdir /tmp/gate/head     # 故意不带 -p：已存在就停下报错。整目录换名（mv 到 head.old-<时分>）再重跑，
                         #   绝不 rm -rf —— /tmp/gate 是这台机器上几路会话共用的落点，删掉的可能是别人正在量的一份
git archive HEAD | tar -x -C /tmp/gate/head
ln -s /Users/liaolongdong/code/liaolongdong.github.io/vendor /tmp/gate/head/vendor
(cd /tmp/gate/head && npx vite build && bundle exec jekyll build)   # 基线 = 本刀之前
npx vite build && bundle exec jekyll build                          # 本刀之后（当前工作树）
PG=2019/07/26/javascript-design-pattern.html,2026/06/05/ai-sdd.html
node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/head/_site  --label=head --mode=cls    --rounds=2 --pages="$PG" --out=/tmp/gate/t9-head-cls.jsonl
node /tmp/gate/sp4-ab.mjs --site=_site                  --label=new   --mode=cls    --rounds=2 --pages="$PG" --out=/tmp/gate/t9-new-cls.jsonl
node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/head/_site  --label=head --mode=action --rounds=2 --pages="$PG" --out=/tmp/gate/t9-head-act.jsonl
node /tmp/gate/sp4-ab.mjs --site=_site                  --label=new   --mode=action --rounds=2 --pages="$PG" --out=/tmp/gate/t9-new-act.jsonl
```

冒烟只看两件事（正式五个数在 Task 10）：

- **CLS(new) − CLS(head) ≤ 0.02**（两篇各算，取每篇 2 轮的中位数）。超了就按下面排错表查，不要直接写进台账。
- **`firstActionSel`：new 侧必须是 `toc-static-link`**，head 侧必须是 `toc-link`；new 侧的 `firstActionAt` 若晚于 head 侧，
  说明内联脚本没在前、静态块被 `has-js` 收起得太早，或 `page.toc` 压根没进版式——同样进排错表。

> **执行时回写（2026-10-07，提交 `d3869d3`）三处，都在 Step 7：**
>
> 1. **7c 那三个夹具的源码不在计划里**（只有 2152-2153 两行描述），按描述重建到 `/tmp/gate/absite/`：
>    `.toc-static` 一族的规则逐条从产物 `index.min.css` 里抽（不是手抄），正文三段各 2400px，
>    400ms 后挂 `body.has-toc` 并 `position:fixed` 补一枚 `.toc-link`（fixed 是为了让 fake-head 那条
>    「cls=0」不被注入自身弄脏）。因此六条期望值里带「实测」的**三个数**（`navHAt0=82`、`441.7`、`317.1`）
>    不可能逐字复现——**六条方向全部成立**，这就是脚手架不撒谎的证据：
>    `fake-head` cls=0.00000 / shifts=0 / navH0=null；`fake-new` cls=0.06872>0 / navH0=122.6 / navH@toc=0；
>    `fake-new2` cls=0.00000 / navH0=0；action 侧 `fake-head` 是 `toc-link`@462.9（>400）、
>    `fake-new2` 是 `toc-static-link`@65（<400）；`innerWidth` 每行 1280。
> 2. **静态服务器那段（`:1941`）给所有响应打 `text/html`，Chrome 因此拒收样式表**（"Refused to apply style sheet"），
>    两侧都在**无 CSS 状态**下量：`navH0` 读出 1710 / 272（那是 85 条与 13 条目录项的裸布局高度），
>    而 CLS 恒 0.00000——看着像「零位移」的理想结果，其实是实验被量具做空了。按扩展名给 MIME
>    （css→`text/css`、js→`text/javascript`、字体与图片各归各）之后才有真数：
>    new 侧 `navH0=0`，两侧 CLS 才第一次可比。**Task 10 跑正式五个数之前必须先确认这一条已修**，
>    并把这条写进 §9.6 的量具踩坑。
> 3. **`PG=2019-07-26-javascript-design-pattern.html,…`（`:2177`）是显示层折叠后的形状**，盘上真形是
>    `2019/07/26/javascript-design-pattern.html`；照手打的样子传给脚本会得到 `ENOENT`（本刀实测两次）。
>    执行时改成 `find`/`readdir` 现数现拼、落到 `/tmp/gate/t9-pg.txt`，命令里 `PG=$(cat /tmp/gate/t9-pg.txt)`。
>    同一段里的导出树还缺一样：`git archive` 不带 `node_modules`，在那棵目录里跑 `npx vite build`
>    会去网上抓 `vite@8.3.3`（本仓锁 6.4.3）、`failed to load config`、**exit=1**，而紧跟其后的
>    `bundle exec jekyll build` 照样 exit=0，产出一棵**没有 CSS/JS 的 `_site`**。
>    软链主仓的 `node_modules` 并改用 `npx --no-install vite build` 才是基线该有的样子。

**这一刀排错表**（每一步都是「先看什么」，按顺序）：

| 症状 | 第一处要看 |
| --- | --- |
| `withBlock` 是 0（79 篇都没块） | `_plugins/toc.rb` 里那个前导斜杠；再确认 `bundle exec jekyll build` 有没有加载到 `_plugins`（构建日志里搜 `TocStatic`） |
| 门禁 ①「序列不一致」一片红 | 插件的 `index` 是不是在补 id 之外还数了别的标签；或版式里 `href="#{{ item.id }}"` 被加了前缀/转义 |
| `qqweiboshare` 那篇也出了块 | `doc.data['toc'] = … ? entries : nil` 那行被改成了 `[]`（空数组在 Liquid 里 truthy） |
| CLS(new) 明显 > 0 | 静态块之前那段 `has-js` 内联脚本不见了或排在 `<nav>` 之后；隐藏规则被写进了 `@media`；`navHAt0` 读出来不是 0 |
| `firstActionAt` 两篇都是 `null` | 静态块里的 href 指不到正文 id（点了不跳），或探针的正则在页面里抓不到 `.toc-static-link`（`class` 拼写与 `TOC_LI` 必须逐字一致） |

- [x] **Step 8：给 `目录` 组装牙（M11 / M13 / M14 / M17）**

四把牙点的是 `目录` ①③⑤，**这一组里 ②（阈值之下必须无块）和 ④（JS 那一族三个落点仍在）没有牙**：
② 的靶子是全站唯一那篇 `qqweiboshare`，给它塞块等于造一个现实中不会出现的形状；④ 读的是
`dev/js/editorial.js`——本批禁改清单上的文件，变异只能打在副本上，而 A8 根本不碰它。
两格的理由和价钱在 Task 10 Step 8.6 的无牙矩阵里，台账要照写。

靶子函数插在 `const cases = [` 正上方：

```js
/**
 * 目录组（M11/M13/M14/M17）的靶子：一篇「产物里有静态块」的页面。
 * 不写死文件名——写死一篇就可能撞上那篇没有块的（2018/12/25/qqweiboshare.html），
 * 那一刀落在不存在的块上会被记成「假牙」，其实是靶子选错了。
 */
const tocTarget = () =>
  first(
    POSTS.filter((q) => has(q.rel) && fs.readFileSync(siteAbs(q.rel), 'utf8').includes('class="toc-static"')),
    '目录组的靶子（产物里带静态目录块的文章页）',
  );
```

四条案例（`expect` 逐字取自 Step 2 打出来的那句）：

```js
  {
    name: 'M11 删掉某篇静态目录的第一条 <li>',
    group: '目录',
    expect: '序列不一致',
    mut: () => S.siteCutRe(tocTarget().rel, /<li class="toc-static-item toc-h[23]"><a class="toc-static-link" href="#[^"]*">[^<]*<\/a><\/li>/),
  },
  {
    name: 'M13 摘掉整块静态目录（留一个空 div）',
    group: '目录',
    expect: '却没有 <nav class="toc-static"> 块',
    mut: () => S.sitePatch(tocTarget().rel, /<nav class="toc-static"[\s\S]*?<\/nav>/, () => '<div class="toc-static"></div>', '静态目录块'),
  },
  {
    name: 'M14 删掉 CSS 里收起 .toc-static 的那条规则',
    group: '目录',
    expect: '找不到 body.has-toc .toc-static',
    mut: () => S.siteCutRe('assets/css/index.min.css', /[^{}]*\.toc-static[^{}]*\{[^{}]*display:\s*none[^{}]*\}/),
  },
  {
    name: 'M17 摘掉静态块之前那段 has-js 内联脚本',
    group: '目录',
    expect: '没有那段给 <html> 挂 has-js 的内联脚本',
    mut: () => S.siteCutRe(tocTarget().rel, /<script>document\.documentElement\.className \+= ' has-js';<\/script>/),
  },
```

三处必须自己核，否则牙是假的：

1. **M11 落的是第一条 `<li>`**，删掉后静态条目少一枚 → 判据同时报 ③（少一条）和 ①（第一枚起就错位），
   `expect` 取 ① 那句。如果这一刀落下去只红 ③ 不红 ①，说明 `TOC_LI` 与产物形状不一致（多半是 `class` 顺序），先修判据。
2. **M14 的 `[^{}]*` 不会跨过上一规则的 `{`**，所以匹配从选择器文本起、到 `}` 止，正好一整条规则；
   它把 `body.has-toc .toc-static` 与 `html.has-js .toc-static` 一起摘掉（两个选择器在同一规则里），
   门禁 ⑤ 的两种说法（找不到规则 / 选择器集里缺 `html.has-js`）都会红。
3. **M17 之后静态块仍然被 `body.has-toc` 收起**，所以 ⑤ 的 CSS 那半边不红——红的是逐页那条「`has-js` 在 `<nav>` 之前」。
   如果 M17 整组不红，八成是把 `hasJsAt` 的判据写成 `text.includes('has-js')`（那样 CSS 里的串也算数）。

```bash
for n in M11 M13 M14 M17; do node scripts/check-seo-teeth.mjs --only="$n" > /tmp/gate/t9-$n.out 2>&1; printf '%s exit=%s\n' "$n" "$?"; done
grep -h '牙齿台账\|✗' /tmp/gate/t9-M1*.out
node scripts/check-seo.mjs > /dev/null 2>&1; echo "gate exit=$?"
node scripts/check-seo-teeth.mjs > /tmp/gate/t9-teeth-all.out 2>&1; echo "teeth exit=$?"; tail -3 /tmp/gate/t9-teeth-all.out
```

预期四条各一行 `牙齿台账：1/1 组变异如期变红` 且 `exit=0`；全量 `gate exit=0`、`teeth exit=0`，
分账行里出现 `目录 4`，`grep -c "^    name: '" scripts/check-seo-teeth.mjs` 前后各数一次自证条数。

- [x] **Step 9：格式化 + 提交**

```bash
npx --no-install prettier --single-quote --print-width 320 --write scripts/check-seo.mjs scripts/check-seo-teeth.mjs
npx --no-install prettier --single-quote --write _layouts/post.html dev/sass/common/editorial.scss
node scripts/check-seo.mjs > /tmp/gate/t9-fmt.txt 2>&1; tail -1 /tmp/gate/t9-fmt.txt
node scripts/check-seo-teeth.mjs > /tmp/gate/t9-fmt2.txt 2>&1; tail -1 /tmp/gate/t9-fmt2.txt
```

**prettier 跑在 `_layouts/post.html` 之后必须重看一眼那四行 Liquid**：它会把过长的行折行、
也会把 `<script>…</script><nav…>` 之间拆出换行——一旦拆，产物里就多掺空白，§6.3 的字节恒等式对不上。
折了就把这两处显式改回一行（`.editorconfig`/prettier 的 `printWidth` 对本仓不设限，改文件不改配置）。

```bash
git add -- _plugins/toc.rb _layouts/post.html dev/sass/common/editorial.scss scripts/check-seo.mjs scripts/check-seo-teeth.mjs
git diff --cached --name-only
git commit -F /tmp/gate/sp4-t9.txt
```

`git diff --cached --name-only` 必须正好这 5 行。提交信息主题：
`feat(blog): A8 构建期静态目录——79 篇产物正文之前有目录，JS 起来首帧即收起（目录组五条判据 + 四把牙）`。

> **执行时回写（2026-10-07，提交 `d3869d3`）：Step 9 那第二条 prettier 命令落不下去，两文件都按原样提交。**
>
> - `_layouts/post.html` 是 Liquid，prettier 的 HTML 解析器在 `{% if series_of_post %}`（`:328`）处
>   **报错并不写文件**（`[error]` 打了 20 多行、退出码却是 0）——这一刀那四行 Liquid 是手写的，
>   形状已由产物自证（`<script>…has-js…</script>` 与 `<nav class="toc-static">` 同一行、中间零空白，
>   见 C 块那条 href 全量比对的 79/79）。
> - `dev/sass/common/editorial.scss` 全篇是 4 空格缩进、`.18s` 这种省零写法，prettier 一跑就是
>   **整份重排（305KB 差异，含上一批刀子的行）**。已按格式化前的逐字节副本还原，
>   `git diff --numstat` 只留 `51 / 0`。本仓没有 scss 的 prettier 约定（`package.json` 无 stylelint 脚本），
>   新增那 51 行按文件既有约定写（4 空格、属性顺序照 neighbors），不进 prettier。
> - 两个脚本照常过 prettier：`unchanged` / `unchanged`，前后 `node --check` 与门、台账各重跑一遍。

---

## Task 10：三个数、台账、spec §9 交付实录、全量回归收口

前九个任务把四刀落完、四组装好牙。本任务做四件事：**补一格起草时没立的判据**（front matter 被 YAML 静默截断）、**把 §6 的三张读数表逐笔落进 spec**、**按 §6.3 跑正式五个数**、**在干净导出树上重跑全量门禁并出交付实录**。

**Files:**
- Modify: `_posts/2026-09-25-claude-agents-md-remote-gate.md`（Step 2 那一行 `subtitle:` 加引号）
- Modify: `scripts/check-seo.mjs`（`描述` 组补第 ⑦ 条 + 组头注释改口）
- Modify: `scripts/check-seo-teeth.mjs`（M18）
- Modify: `_docs/superpowers/specs/2026-10-03-content-governance-design.md`（§5.1 `描述` 补第 ⑦ 条、§5.1 `目录` ⑤ 补门控半边、§5.2 补 M17/M18 两行并把「M1–M14/M1–M15」两处改口、§6.1 那两格的读数复核、§8 加 ⑨⑩⑪、新增 §9 交付实录）

- [x] **Step 1：扫一遍「front matter 写了、Jekyll 没读到」——起草时实测命中 1 处，有名有姓**

这一类的形状是：值写成不带引号的 plain scalar，里面有一个空格紧跟 `#`，YAML 从那里起当行尾注释吃掉。落到本仓库的可见后果是 `_includes/seoMeta.html:55-76` 那条取值链读到一个短得多的值，`seoMeta.html:80` 那道 `.size < 25` 的地板再把整页摘要换成全站那句话。

把量具落成 `/tmp/gate/sp4-fmtrunc.rb`（只认五个字符串键，避开 `date` 被 YAML 读成 `Date` 的那批假红）：

```ruby
require 'yaml'
KEYS = %w[title subtitle seo_description seo_short_title description]
hits = []
Dir.glob('_posts/*.md').sort.each do |f|
  t = File.read(f, encoding: 'UTF-8')
  y = t[/\A---\r?\n(.*?)\r?\n---\r?\n/m, 1]
  next unless y
  h = YAML.load(y.gsub("\r\n", "\n")) rescue next
  y.each_line do |raw|
    line = raw.chomp
    m = line.match(/\A([A-Za-z_][A-Za-z0-9_-]*):[ \t]+(.*)$/)
    next unless m
    key, written = m[1], m[2]
    next unless KEYS.include?(key)
    next if written.start_with?("'", '"', '[', '|', '>', '&', '*')
    got = h[key]
    next if got.nil? || !got.is_a?(String)
    hits << "#{f} | #{key} | 写了=#{written.inspect} | 读到=#{got.inspect}" if got != written
  end
end
puts "silent_truncations=#{hits.size}"
hits.each { |x| puts x }
```

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
ruby -EUTF-8 /tmp/gate/sp4-fmtrunc.rb
```

预期（逐字，本任务起草时现场跑出来的就是这一条）：

```
silent_truncations=1
_posts/2026-09-25-claude-agents-md-remote-gate.md | subtitle | 写了="issue #95690 说读 AGENTS.md 要先过一道远端 flag，官方在 HN 上回了句已修；我把 npm、GitHub release、文档三个时钟对齐一遍，v2.1.281 那 176 条发布说明里 AGENTS.md 命中 0 次。第二件：google/ax 第二天多了 1,314 颗星，读取点从 4 行变 8 行，装配那一侧还是 0" | 读到="issue"
```

**为什么这一格归本批管**：A9 动作 1（CRLF）立的理由就是「留着一个会让判据说谎的文件，比留着它本身贵」；这一处同族，而且它比 CRLF 更狠——它已经落在读者脸上了。产物侧的两条证据（现在就能看见，不必等重建）：

```bash
grep -o '<p class="post-masthead-lede">[^<]*' _site/2026/09/25/claude-agents-md-remote-gate.html
grep -o '<meta name="description"[^>]*content="[^"]\{0,30\}' _site/2026/09/25/claude-agents-md-remote-gate.html
```

预期第一行 `<p class="post-masthead-lede">issue</p>`（正文导语只剩一个英文单词），第二行的 `content` 是 `Better（中文署名廖小新）的前端与 AI 博客：…`——也就是 `site.description`。§6.1 台账里那格「与 `site.description` 相同的篇数 1 → 0」的「1」就是这一篇，Task 1 Step 4 已把 spec 的 `0 → 0` 改成 `1 → 0`；本步把这「1」的根因消掉，而不是让它永远挂在台账里当现状。

- [x] **Step 2：改掉那一处（1 行），重建，产物自证**

`_posts/2026-09-25-claude-agents-md-remote-gate.md` 第 4 行，整行替换（值本身一字不改，只是包进双引号——已核过这一串里没有 `"`、没有 `'`、没有 `\`、没有半角 `: `，所以双引号是无损包裹；`：` 是全角，不是 YAML 的映射指示符）：

```
改前：subtitle: issue #95690 说读 AGENTS.md 要先过一道远端 flag，官方在 HN 上回了句已修；我把 npm、GitHub release、文档三个时钟对齐一遍，v2.1.281 那 176 条发布说明里 AGENTS.md 命中 0 次。第二件：google/ax 第二天多了 1,314 颗星，读取点从 4 行变 8 行，装配那一侧还是 0
改后：subtitle: "issue #95690 说读 AGENTS.md 要先过一道远端 flag，官方在 HN 上回了句已修；我把 npm、GitHub release、文档三个时钟对齐一遍，v2.1.281 那 176 条发布说明里 AGENTS.md 命中 0 次。第二件：google/ax 第二天多了 1,314 颗星，读取点从 4 行变 8 行，装配那一侧还是 0"
```

**只动引号，不动内容**：177 个 code point 的导语是作者写给这一篇的导语，本批没有改写别人正文的授权；把值截短或删掉那句 `#95690` 都不行。

```bash
bundle exec jekyll build
ruby -EUTF-8 /tmp/gate/sp4-fmtrunc.rb
grep -o '<p class="post-masthead-lede">[^<]\{0,40\}' _site/2026/09/25/claude-agents-md-remote-gate.html
grep -o '<meta name="description"[^>]*content="[^"]\{0,40\}' _site/2026/09/25/claude-agents-md-remote-gate.html
```

预期依次是：`silent_truncations=0`（一处不剩，这一格从此靠 Step 3 的判据守着）；导语行以 `issue #95690 说读 AGENTS.md` 开头（不再是光秃秃一个 `issue`）；meta 是 Task 3 给这一篇写的那句 `AGENTS.md 这扇门不是本地开关：…`（不再是 `Better（中文署名廖小新）…`）。

**这一处改动会动到三个已有数**，Step 5 的台账按改后重测：① 这一篇的 meta 来源从「`site.description`」变成「本篇 `seo_description`」（Task 3 之后本来就是这样，本步没改 meta）；② `_layouts/post.html:467` 分享 widget 的 `description` 从 `"issue"` 变成整句；③ 产物 HTML 在这一篇上长了约 172 字节（导语从 5 字符到 177 字符），**不影响 §6.3 的 Δ 恒等式**——那一式只算 `.toc-static` 那块，两棵树都要在**本步之后**重建再量，否则 Δ 里混进这一处。

- [x] **Step 3：`描述` 组补第 ⑦ 条（源侧到 YAML 的忠实度）**

插在 Task 2 那段 `for (const p of posts) { ... }` 循环的**右花括号之后、本组块的收尾 `}` 之前**。判据打在产出语料（`posts` 已滤掉不产出的那一篇）上，键只认五个字符串键：

```js
  // ⑦ front matter 写了 A、Jekyll 读到 B 的静默截断（YAML 把「 #」当行尾注释吃掉）
  {
    const KEYS7 = ['title', 'subtitle', 'seo_description', 'seo_short_title', 'description'];
    for (const p of posts) {
      const src = readSrc(`_posts/${p.file}`);
      const fmText = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmText) continue;
      for (const line of fmText[1].split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):[ \t]+(.*)$/);
        if (!m) continue;
        const [, k, written] = m;
        if (!KEYS7.includes(k)) continue;
        if (/^["'|>[&*]/.test(written)) continue; // 显式引号/块标量/锚点不是这一格管的形式
        const w = written.replace(/[ \t]+$/, '');
        const got = p.fm[k];
        if (got == null || typeof got !== 'string') {
          bad('描述', p.file, `${k} 写了「${w.slice(0, 40)}」但 Jekyll 没读到这个键——plain scalar 里的「 #」会被当行尾注释`);
          continue;
        }
        if (got !== w) bad('描述', p.file, `${k} 被静默截断：写了「${w.slice(0, 40)}」，Jekyll 读到「${got.slice(0, 40)}」——plain scalar 里的「 #…」会被当行尾注释，加引号即可`);
      }
    }
  }
```

组头那段注释（Task 2 Step 1 写的「源侧五格加产物侧一格」）改成「源侧六格加产物侧一格：第六格管『写了 A 读到 B』这一类静默截断，取值链读到的从来不是你以为的那句话」。`GROUPS` 不用动（还是 `描述` 一组）。

```bash
node scripts/check-seo.mjs > /tmp/gate/t10-gate.out 2>&1; echo "exit=$?"; tail -2 /tmp/gate/t10-gate.out
```

预期 `exit=0`、末行 `✓ SEO 门禁 14 组全绿（keywords / … / 换源 / 描述 / 词表 / 内链 / 目录）；JSON-LD <N> 块全部可解析`（那一句的门禁原文形状是 `` `✓ SEO 门禁 ${GROUPS.length} 组全绿（…）；JSON-LD ${blockTotal} 块全部可解析` ``，`check-seo.mjs:1162` 现证，**中间没有冒号**——别按记忆里的写法核它）。Step 2 已把唯一一处修掉，所以这一格落下去就是绿的；它的价值在 Step 4 的牙与防未来。**若这里红一条**，说明 Step 2 那处还有别的键中招——按红的那条再补一行引号，别放宽判据。

- [x] **Step 4：给第 ⑦ 条装牙（M18）**

`cases` 数组收尾 `];` 之前追加（沿用 Task 4 的 `descTarget()`，它已保证靶子有摘要、产物在）：

```js
  {
    name: 'M18 把某篇 subtitle 写成不带引号的 plain scalar，尾巴带一个「 #9」',
    group: '描述',
    expect: '被静默截断',
    mut: () => S.srcSubLine(`_posts/${descTarget().file}`, /^subtitle:[ \t]+[^\r\n]*$/m, 'subtitle: 前端工程 #9 牙齿', '副标题行'),
  },
```

三件事必须实测，别信这段代码「看起来对」：

1. **变异真的把值截断了**：在副本上跑一次 Step 1 的量具（把 `Dir.glob` 换成那个副本目录），必须打出 `写了="前端工程 #9 牙齿" | 读到="前端工程"`。不截断即 ⑦ 无理由红，那就是一把假牙。
2. **不许连带把 ③ 带红**：`descTarget()` 挑中的那篇的 `seo_description` 必须既不等于 `前端工程` 也不等于 `前端工程 #9 牙齿`——跑之前 `node -e` 打印一次这两串比对，撞上了就换靶子（在 `descTarget()` 的筛选里追加「subtitle 不以『前端工程』开头」），**不要**改 `expect` 迁就。
3. **`subtitle:` 那一行在源里必须唯一**：`srcSubLine` 是 subOnce 语义，命中 0 处或 >1 处直接抛；抛了会被主循环记成「变异脚本自己崩了」，和假牙是两个不同的话。

```bash
node scripts/check-seo-teeth.mjs --only=M18 > /tmp/gate/t10-m18.out 2>&1; echo "exit=$?"; tail -2 /tmp/gate/t10-m18.out
node scripts/check-seo-teeth.mjs > /tmp/gate/t10-teeth.out 2>&1; echo "teeth exit=$?"; tail -1 /tmp/gate/t10-teeth.out
grep -c "^    name: '" scripts/check-seo-teeth.mjs
```

预期：`--only=M18` 那条 `exit=0` 且打 `牙齿台账：1/1 组变异如期变红`；全量 `teeth exit=0`，汇总行是 `牙齿台账：N/N 组变异如期变红`，N = 追加前的条数 + 1（`grep -c` 在 Step 4 前后各数一次，本任务起草时这一本脚本里是 **137** 条，Task 4/7/8/9 各加 5/7/1/4 条之后加上这一条，逐笔以 `grep -c` 现场读到的为准）。台账里 `描述` 那一族的分账行应写 **6**。

---

- [x] **Step 5：§6.1 摘要覆盖率台账（用 Task 1 那把尺，改前列已现场钉死）**

**不许另起第三把尺**——§6.1 的每一格都由 Task 1 Step 8 附的 `/tmp/sp4-fm.rb` + `/tmp/sp4-61.cjs` 打出来，改前改后跑的是同一段代码。重建之后跑：

```bash
ruby /tmp/sp4-fm.rb _posts /tmp/sp4-fm.json
node /tmp/sp4-61.cjs
```

`/tmp/gate/sp4-band.cjs` 只补 `sp4-61.cjs` 没打的长度带，口径与 `描述` ② 一致（按 code point，不是字节）。
先原样存成该文件（`cat > /tmp/gate/sp4-band.cjs <<'CJS'`，定界符**必须带引号**，否则模板串里的 `${…}` 会被 shell 展开），再跑：

```js
const fs = require('fs');
const path = require('path');
const R = '_site';
const f = [];
for (const y of fs.readdirSync(R)) {
  if (!/^\d{4}$/.test(y)) continue;
  for (const m of fs.readdirSync(path.join(R, y))) {
    const q = path.join(R, y, m);
    if (!fs.statSync(q).isDirectory()) continue;
    for (const d of fs.readdirSync(q)) {
      const q3 = path.join(q, d);
      if (!fs.statSync(q3).isDirectory()) continue;
      for (const x of fs.readdirSync(q3)) if (x.endsWith('.html')) f.push(path.join(q3, x));
    }
  }
}
const vals = f.map((a) => {
  const t = fs.readFileSync(a, 'utf8');
  const head = t.slice(0, t.indexOf('</head>'));
  const m = /<meta name="description"\s+content="([^"]*)"/.exec(head);
  if (!m) throw new Error(`没有 meta description：${a}`);
  return [...m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')];
});
const L = vals.map((s) => s.length).sort((a, b) => a - b);
console.log(JSON.stringify({ pages: f.length, inBand60to140: L.filter((n) => n >= 60 && n <= 140).length, min: L[0], median: L[Math.floor(L.length / 2)], max: L[L.length - 1], uniq: new Set(vals.map((s) => s.join(''))).size }));
```

```bash
node /tmp/gate/sp4-band.cjs      # 在工作树根目录跑（脚本里的 R = '_site' 是相对路径）
```

（**必须走到 `</head>` 之前再取**：`_layouts/post.html:467` 那行分享注释里原样写着一段 `<meta name="description" content="页面描述" />`，整页正则抓会抓到它——起草时我先整页抓，80 篇每篇都数出 2 条 meta，是假读数。）

| §6.1 的读数 | 打它的键 | 改前（2026-10-03 起草时现场量到） | 改后（本步现场填） | 判读 |
| --- | --- | --- | --- | --- |
| 产出文章页 | `pages` | `80` | 必须仍 `80` | 少一篇 = A4 把某篇挤出了语料（牙 M9 守的就是这格） |
| 手写摘要的篇数 | `hand` | `41` | 必须 `80` | 39 篇回填的总账，与 描述 ① 互为影子 |
| meta 与本篇 `subtitle` 逐字相同 | `eqSubtitle` | `35` | 必须 `0` | 非 0 即「回填等于没做」，与 描述 ③ 同一条 |
| 反解 HTML 之后与 `subtitle` 相同 | `eqSubtitleUnescaped` | `38` | 必须 `0` | §6.1 那格「与 subtitle 相同的篇数」用的就是这一格（含转义那 3 篇）；恒等式 `38 = 35 + 3` |
| 其中引号被转义、逐字不等 | `escaped` | `3`（`2026-06-05-ai-sdd`、`2026-07-12-facebook-astryx`、`2026-07-12-impeccable-ai-design`） | 必须 `0` | 这三篇的 meta 反解之后恰好等于 subtitle；回填成 `seo_description` 之后它就不该再等于 subtitle，所以改后为 `0` 是正证，不是「这一格失去意义」。**起草时这一格被写成了「既不等于 subtitle 也不等于 site.description」的余数**（那个口径量出来是 `41`，恒等于 `hand`），Task 1 Step 8 已把它拆成上面三格 |
| meta 等于 `site.description` | `siteDesc` | `1`（`2026-09-25-claude-agents-md-remote-gate`，根因见 Step 1） | 必须 `0` | Step 2 修根因、Task 3 修摘要，两条都落才可能为 0 |
| 缺 meta 的篇 | `missing` | `0` | `0` | 非 0 说明取值链在某页断了，与 描述 ⑥ 同一条 |
| meta 去重条数 | `uniqDesc` / `uniq` | `80` | `80` | **今天就是 80，这一格不移动**（spec 原文的「N → ≥80」把现状说成有病，Task 1 Step 4 第 2 条已改口）。价值全在防未来，而**这一格没有牙**（造一次重复才点得着它，见 Step 8.6 的无牙矩阵）——这句要连着写进 §6.1，别只留一个「防未来」 |
| 长度 ∈[60,140] code point | `inBand60to140` | `53`（`min 25 / median 76 / max 124`） | 必须 `80` | 80 条摘要都进带内且都成了 meta，才算 A4 真的接上了线 |
| 落地板的篇（`subtitle` <25 且无摘要） | `floorShort` | `["_posts/2026-09-25-claude-agents-md-remote-gate.md"]` | 必须 `[]` | 与 `siteDesc=0` 是同件事的两面 |

- [x] **Step 6：§6.2 词表台账（面向读者的读数只有 `tags.html` / `categories.html` 打的那几个）**

命令与改前实测（起草时七条逐条跑过，全部对得上 spec §4.2 的「改前」列）：

```bash
grep -o '<span class="issue-no">[^<]*' _site/tags.html _site/categories.html
grep -c '<section class="cat-section"' _site/tags.html
grep -o '<em>1</em>' _site/tags.html | wc -l
grep -c '<section class="cat-section"' _site/categories.html
grep -o '<em>1</em>' _site/categories.html | wc -l
grep -A3 '<section class="cat-section" id="Agent"' _site/tags.html | grep -o '<span class="cat-count">[0-9]*' | head -1
grep -A3 '<section class="cat-section" id="开源实测"' _site/categories.html | grep -o '<span class="cat-count">[0-9]*' | head -1
```

| 读数 | 改前（现场量到） | 改后（spec §4.2 的预测） | 差从哪来（逐笔） |
| --- | --- | --- | --- |
| `site.tags.size`（`155 tags` 与 `<strong>155</strong><span>个标签`两处同数） | `155` | `151` | 动作 2 四组合并各掉 1 枚（`Chrome`/`React`/`Vite`/`WebMCP`）；组 5 是改名，`−1 +1` 净零 |
| 只挂 1 篇的标签 | `122` | `116` | 净 `−6`：消失 7 枚单篇（`Chrome`、`React`、`react`、`Vite`、`vite`、`WebMCP`、`coding`），新增 1 枚（`coding.net`） |
| 大小写撞键组 | `5` | `0` | `词表` ① 无条件判这一格，不设豁免名单 |
| `site.categories.size` | `17` | `14` | 消失的三枚逐字：`开源`、`开源工具`、`编程语言` |
| 只挂 1 篇的分类 | `4` | `2` | 改前那四枚逐字：`React`、`开源`、`编程语言`、`CSS`；消失 `开源` 与 `编程语言`，`React` 与 `CSS` 留下 |
| `开源实测` 的桶 | `17` | `21` | 动作 3 那四篇并进去的增量 |
| `Agent` 的桶 | `13` | `12` | 动作 4 的唯一读数变化（Jekyll 读数 == 持有它的文件数，`词表` ⑥） |
| 正则**文件集** tags 读数 | `157` | `153` | 与语料集恒差 2 枚（`前端面试`、`手写题`，只出现在不产出的教学样本里）。**等式两边都写进台账**，不接受只报一个数 |
| 控制字符那一格 | `[]` | `[]` | **不是 `1 → 0`**。`黑科技\r` 是起草时 shell 管道造出来的假信号（spec §0 第 3 条），Jekyll 从来没读到过它。动作 1 的自证是 `grep -lU $'\r' _posts/*.md` 从 1 个文件到 0 个，加 `od -c` 那一行行尾字节的变化，**不改任何词表读数** |

改后那一列**不是实测**，是 spec §4.2 用探针算出来的预测。执行本步时必须：

1. 把七条命令的**实测值**另起一列逐字填进表（两棵树重跑之后，`_site` 必须是 Step 9 那次干净重建的产物，不能是 watch 模式的半成品）。
2. 某一格实测 ≠ 预测时，**红的是台账不是门禁**：实测值进 §9 交付实录，并在 spec §8 加一行「第 N 格预测错在漏算了某枚键」。**不许**改 `词表` 的白名单去迁就预测，也不许改 spec 的预测列来掩盖实测。

---

- [x] **Step 7：§6.3 A/B 三个数（正式那一遍，5 轮/侧取中位数）**

**负载门先行**：`sysctl -n vm.loadavg` 的第一个数（1 分钟）**> 16 就今天不跑**——既不算绿也不算红，改到负载低的时段再跑，台账里那一格写「拒测（1 分钟负载 X.YY）」。这一条不是洁癖：起草时唯一一轮真页冒烟落在负载 19.9 上，`responseStart` 读到 1460.7 ms（静态服务本地端口正常应 <100 ms），那一轮**只能证明量具接得上，不能用作交付数**。

两棵树：`head` = `2b9464c`（本分支的 `merge-base`，`git merge-base HEAD main` 现场对一次，必须是这个串）；`new` = 本任务 Step 2/3 落完、Step 9 那次干净重建之后的工作树。

```bash
U=$(git merge-base HEAD main); echo "U=$U"; test "$U" = 2b9464c6758d2e769f8ca0cbba06b87030dd175c || echo "基线不是 2b9464c，先核对再往下"
mkdir -p /tmp/gate/head && git archive "$U" | tar -x -C /tmp/gate/head
cd /tmp/gate/head && npx vite build && bundle exec jekyll build && cd -
```

（`/tmp/gate/head` 若已存在旧副本，先整目录换名备份再导，别覆盖——按记忆教训：**跑门的那棵树必须等于提交的那棵树**，混了副本后面所有 Δ 都要重做。）

四个数一台、CLS 一台，两侧交替，各 5 轮：

```bash
PG=2019/07/26/javascript-design-pattern.html,2026/06/05/ai-sdd.html
for r in 1 2 3 4 5; do
  node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/head/_site --label=head --mode=cls    --rounds=1 --pages="$PG" --out=/tmp/gate/t10-head-cls.jsonl
  node /tmp/gate/sp4-ab.mjs --site=_site                  --label=new   --mode=cls    --rounds=1 --pages="$PG" --out=/tmp/gate/t10-new-cls.jsonl
  node /tmp/gate/sp4-ab.mjs --site=/tmp/gate/head/_site --label=head --mode=action --rounds=1 --pages="$PG" --out=/tmp/gate/t10-head-act.jsonl
  node /tmp/gate/sp4-ab.mjs --site=_site                  --label=new   --mode=action --rounds=1 --pages="$PG" --out=/tmp/gate/t10-new-act.jsonl
done
node -e 'const fs=require("fs");const med=(a)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];const g=(f)=>fs.readFileSync(f,"utf8").trim().split("\n").map(JSON.parse);for(const[k,f]of Object.entries({headCls:"/tmp/gate/t10-head-cls.jsonl",newCls:"/tmp/gate/t10-new-cls.jsonl",headAct:"/tmp/gate/t10-head-act.jsonl",newAct:"/tmp/gate/t10-new-act.jsonl"})){if(!fs.existsSync(f)){console.log(k+" 缺文件");continue;}for(const p of [...new Set(g(f).map(r=>r.page))]){const rs=g(f).filter(r=>r.page===p);console.log(k+" "+p+" n="+rs.length+" load="+med(rs.map(r=>r.timings&&r.timings.load))+" dcl="+med(rs.map(r=>r.timings&&r.timings.dcl))+" inter="+med(rs.map(r=>r.lastLongTaskEnd))+" cls="+med(rs.map(r=>r.cls))+" hasToc="+med(rs.map(r=>r.hasTocAt))+" act="+med(rs.map(r=>r.firstActionAt))+" sel="+JSON.stringify(rs.map(r=>r.firstActionSel).sort()[Math.floor(rs.length/2)]))}}'
```

> **执行时回写（2026-10-07，随 §9 那笔文档提交）四处，都在 Step 7：**
> 1. **上面那个 `for r in 1 2 3 4 5` 的循环按原文跑，盘上只有第 5 轮。** 四次调用共用
>    `--out=/tmp/gate/t10-<side>-<mode>.jsonl`，而 `sp4-ab.mjs:233` 是 `fs.writeFileSync`（**覆盖写不是追加**），
>    于是「5 轮中位数」在盘上退化成「1 轮」，而汇总脚本照算、照绿、`n=` 那一格会打出 1——
>    这一条差点蒙过去的唯一原因是它把 `n=` 打了出来。改成每轮一份
>    `t10-<side>-<mode>-r<round>.jsonl`（20 个文件、10 行/侧/模式）之后才算真的跑了 5 轮；
>    残缺那份留着当证据（`*.overwrite-defect.jsonl` + 那一遍的驱动日志）。
> 2. **落点从 `/tmp/gate` 换到 `$TMPDIR/sp4t10/gate`。** 这一轮 `/tmp/gate` 整目录不在了
>    （这台机器上 `/tmp` 会被清，Task 9 的夹具与脚手架一起没）。夹具按 Step 7c 那段文档**照着重建**，
>    重建后先跑六条期望值、全中，再量真页面——顺序不许倒。
> 3. **判读规则 1 的第二小句（`new` 侧 `shifts` 里不许出现「`hasTocAt` 之后仍有非零位移」）在两棵树上同时红。**
>    `2019/07/26/javascript-design-pattern.html` 那一枚 0.04317 的位移在 `head`/`new`、`cls`/`action`
>    四种组合里都是 5/5 轮出现、时刻都在 `hasTocAt` 之后（约 6.4–7.1 s），来源是本批没碰过的
>    `dev/js/editorial.js` 揭示动效（`navHAtToc = 0`：静态块在收起那一刻不产生位移）。
>    第一小句（`new − head` ≤ 0.02）按 **Δ = 0.000000000** 成立。**这一格按 Δ 记，把那处既有位移写成偏离并移交**
>    （spec §9.4 第 6 条、§9.8 第 2 条），不假装规则 1 整条绿了——Task 9 Step 5 那条 `html.has-js .toc-static`
>    首帧隐藏买到的正是「`navHAt0 = 0`、且 `hasTocAt` 那一刻不产生新位移」，它管不到别的动效。
> 4. **`firstActionSel = toc-static-link` 量的是 DOM 里存在可跳锚点，不是真鼠标命中**（JS 开着时静态块是
>    `display:none`，探针每 50 ms 试探的是 `<a>` 存在 + `scrollY`/`location.hash` 真的动了）。
>    规则 2 照原文判（成立），但台账里那一格要带这句限定，否则读者以为「首屏已经能用鼠标点目录」。

**Step 7b 的两处实测注脚**（恒等式本身成立，`diff = 0`；补这两条是因为 Δ 表按原文照抄会误导）：

- **gzip 那一列的口径是 `cat f | gzip -9 | wc -c`。** 用 `gzip -9 -c f | wc -c` 会多算 gzip 头部的 FNAME 字段
  （`len(basename)+1` 字节，本机实测 12 = 11 + 1），起草时那两格 62,273 / 26,703 是按前者量的。
- **`head` 基线是 `2b9464c`（整批之前），不是「本刀之前」**，所以单篇 Δ 里除 A8 的目录块还含 A4/刀3 的改动：
  `javascript-design-pattern` 恰好只有目录块（Δ 10,253 = nav 10,188 + 脚本 65，残差 **0**），
  `ai-sdd` 的 Δ 2,185 = 1,757 + **428**，那 428 B 逐行对过是 A4 描述回填改到的 4 行
  （`meta description` / `og:description` / `twitter:description` / JSON-LD `description`）。
  **量具没有骗人，是基线选得宽**——这一句要跟着数一起写，否则「恒等式残差 428」看起来像 bug。


数怎么取（口径逐字，写进 §9 时不许含糊）：

| 数 | 取法 | 为什么是这个口径 |
| --- | --- | --- |
| `load` / `dcl` | `timings.load` / `timings.dcl`（`performance.getEntriesByType('navigation')` 的 `loadEventEnd` / `domContentLoadedEventEnd`，相对导航起点） | 与 SP1/SP2/SP3 三届同一把尺 |
| **可交互** | `lastLongTaskEnd`（longtask 观察器里最后一条长任务的结束时刻） | 本机这版 Chrome 的 `performance.interactive` 打不出来（`undefined`），`nav.interactive` 同样不可用——**不许**因此把「可交互」写成估算值，改用能观测的长任务右端点，并在 §9 里点名这个替换 |
| 首次动作 | `mode=action` 的 `firstActionAt`（从 DCL 起每 50 ms 试点一枚目录条目，命中即停）+ `firstActionSel` | `has-toc` 之前静态目录本来就点不动，量「第几毫秒能点到目录里的第一条」比量 FCP 贴近这一刀要买的东西 |
| CLS | `mode=cls` 的 `cls`（`layout-shift` 累加，`hadRecentInput` 的那几条不计） | **`mode=action` 那台的 CLS 一律弃用**：探针里的 `click()` 会压掉紧随其后的收起位移，起草时同一份 fixture 用两种模式量出 0.07426（不点）对 0.00000（点过），差三个数量级 |
| `hasToc` | `mode=cls` 的 `hasTocAt`（MutationObserver 抓到 `body.has-toc` 的时刻） | 静态目录被 JS 收起的那一瞬间，也是「两份列表同时可见」如果发生会发生的时刻 |

判读规则（三条都是可判真伪的，不是「看看差不多」）：

1. **CLS**：`new` 侧中位数与 `head` 侧之差 **≤ 0.02**，且 `new` 侧 `shifts` 里不许出现「`hasTocAt` 之后仍有非零位移」的那一条（Task 9 Step 5 那条 `html.has-js .toc-static` 首帧隐藏就是为了这条不红；红了就回去查 `.toc-static` 有没有被 postcss 打成 vw）。
2. **首次动作**：`new` 侧必须**早于** `head` 侧（静态块在 DCL 就存在于 DOM），且 `new` 侧的 `firstActionSel` 中位数必须是 `toc-static-link`——若还是 `toc-link`，说明静态块没被点着（要么没渲染出来，要么被 CSS 挡住），这一刀的收益就是零。
3. **`load` / `dcl` / `inter`**：允许变慢，但必须与 Step 7b 的字节增量成比例；单独把某一条写成「无影响」而不给数的，台账不算过。

**Step 7b：Δ 字节恒等式（起草时已用恒等式量具算定，实测必须落在 ±3% 之内）**

静态块的字节形状逐字是：每页固定串 = `<nav class="toc-static" aria-label="文章目录（静态）">` + `<p class="toc-static-title">本文目录</p>` + `<ol class="toc-static-list">` + `</ol>` + `</nav>` = **145 字节**；每条 `<li class="toc-static-item toc-hN"><a class="toc-static-link" href="#X">T</a></li>` = **80 字节 + utf8(X) + utf8(T)**；再加每页那段 `<script>document.documentElement.className += ' has-js';</script>` = **65 字节**（`printf %s '<script>…</script>' | wc -c` 现量）。
**这一处起草时写的是 63，自查时按实测改口成 65**，下面三张 Δ 表跟着改（每页 +2 B，全站 +158 B）——留这一句是因为改口的痕迹比改口本身有用。

先把恒等式量具原样存成 `/tmp/gate/sp4-identity.cjs`（`cat > /tmp/gate/sp4-identity.cjs <<'CJS'`，定界符**必须带引号**，
否则模板串里的 `${p}` 会被 shell 展开成空串）：

```js
// 静态块「测出来的字节」必须等于上面式子「算出来的字节」
const fs = require('fs');
const path = require('path');
const R = '_site';
const NAV_OPEN = '<nav class="toc-static"';
const SCRIPT = "<script>document.documentElement.className += ' has-js';</script>";
const LI = /<li class="toc-static-item toc-h[23]"><a class="toc-static-link" href="#([^"]*)">([\s\S]*?)<\/a><\/li>/g;
const B = (s) => Buffer.byteLength(s, 'utf8');
const f = [];
for (const y of fs.readdirSync(R)) {
  if (!/^\d{4}$/.test(y)) continue;
  for (const m of fs.readdirSync(path.join(R, y))) {
    const q = path.join(R, y, m);
    if (!fs.statSync(q).isDirectory()) continue;
    for (const d of fs.readdirSync(q)) {
      const q3 = path.join(q, d);
      if (!fs.statSync(q3).isDirectory()) continue;
      for (const x of fs.readdirSync(q3)) if (x.endsWith('.html')) f.push(path.join(q3, x));
    }
  }
}
let pages = 0, items = 0, navBytes = 0, scriptBytes = 0, formulaBytes = 0;
const picked = [];
for (const p of f) {
  const raw = fs.readFileSync(p, 'utf8');
  const i = raw.indexOf(NAV_OPEN);
  if (i < 0) continue;
  const j = raw.indexOf('</nav>', i);
  if (j < 0) throw new Error('nav 没闭合: ' + p);
  const nav = raw.slice(i, j + 6);
  pages++;
  navBytes += B(nav);
  if (raw.includes(SCRIPT)) scriptBytes += B(SCRIPT);
  let local = 0, n = 0;
  for (const m of nav.matchAll(LI)) {
    n++;
    local += 80 + B(m[1]) + B(m[2]);
  }
  items += n;
  formulaBytes += 145 + local;
  if (/javascript-design-pattern\.html$|ai-sdd\.html$/.test(p)) picked.push({ page: p, items: n, navBytes: B(nav), withScript: raw.includes(SCRIPT) });
}
console.log(JSON.stringify({ pages, items, navBytes, scriptBytes, measured: navBytes + scriptBytes, formula: formulaBytes + 65 * pages, diff: navBytes + scriptBytes - (formulaBytes + 65 * pages), picked }));
```

```bash
node /tmp/gate/sp4-identity.cjs   # 在工作树根目录跑（R = '_site' 是相对路径）；数 79 篇 × 881 条，按上面的式子逐条累加，并挑最大/中位两篇的 Δ
cat _site/2019/07/26/javascript-design-pattern.html | gzip -9 | wc -c
cat _site/2026/06/05/ai-sdd.html | gzip -9 | wc -c
wc -c < _site/2019/07/26/javascript-design-pattern.html
wc -c < _site/2026/06/05/ai-sdd.html
```

恒等式那一段先看 `sp4-identity.cjs` 自己打的 JSON：`pages` 必须是 **79**、`items` 必须是 **881**（与 Step 6 的读数同源）、
`diff / formula` 必须在 **±3%** 之内、`picked` 必须恰两篇且 `items` 分别是 **76** 与 **9**。
超出的第一处要看的是 145 那串里没算的东西——Liquid 在 `<nav>` 与 `<ol>` 之间留下的换行与缩进（`\n  ` 一类的空白每页几十字节，
是这一式子最容易漏的一项）；漏了就把实际空白补进式子并**在这里改口**，不要靠调大容差蒙过去。
`navBytes` / `formulaBytes` 两个数逐字进 §9.3 的证据列。

起草时现场量到的（写死在这里，执行时拿来对表；口径：`wc -c` 数原始字节、`cat f | gzip -9 | wc -c` 数 gzip——**别用 zlib API**，两条差 700 多字节，量的是 gzip 头的 FNAME 之外还有分块差异）：

| 格 | 改前（`2b9464c` 的产物） | Δ 预测 | 改后实测 |
| --- | --- | --- | --- |
| 全站 80 篇静态块字节 | — | **143,022 B** = 137,887（79 页 × 145 + 881 条 × (80 + id + text)）+ 79 × 65 | 填 `du -b`/逐页差值之和 |
| 最大的一篇 `2019/07/26/javascript-design-pattern.html` | `472,790 B`（gzip `62,273 B`） | **+10,253 B**（76 条 × (80+id+text) + 145 + 65） | 填两数 |
| 中位的一篇 `2026/06/05/ai-sdd.html` | `83,055 B`（gzip `26,703 B`） | **+1,757 B**（9 条 + 145 + 65） | 填两数 |
| 有静态块的篇数 / 条目总数 | `79` / `881`（Task 9 Step 6 同一读数） | 不变 | 必须仍 `79` / `881` |

**gzip 那一栏是这一刀真正的代价**，也是 §6.3 要的「三个数」里唯一能被读者感知的字节数：原始 +2.2%（最大篇）换 gzip 约 +0.3%～0.5%（目录文本高度可压缩）。实测 gzip 增量若超过预测原始增量的 30%，停下来查——最常见的原因是静态条目把 `id` 里的中文重复写了两遍（`href` 与正文 `id` 各一份，这本来就在式子里），或是 postcss 把某些 `.toc-static-*` 打成了 vw 串导致 CSS 侧也变（`.toc-` 在黑名单里，若这条断了说明黑名单被动过）。

**Step 7c：禁 JS 那一侧真的读得到目录（G4 的本体，不是「有块」）**

先把下面这段原样存成 `/tmp/gate/sp4-nojs.cjs`（`cat > /tmp/gate/sp4-nojs.cjs <<'CJS'`，定界符**必须带引号**——
模板串里的 `${p}` 不带引号会被 shell 展开成空串），再**在工作树根目录**跑（脚本里的 `_site` 是相对路径）：

```js
// 把 79 篇带静态块的产物摘掉全部 <script>…</script>，再逐篇断言：
// ① class="toc-static" 恰好出现 1 次；② nav 里每一枚 href="#X" 都能在**同一份**剥脚本后的 HTML 里找到 id="X"
const fs = require('fs');
const path = require('path');
const R = '_site';
const f = [];
for (const y of fs.readdirSync(R)) {
  if (!/^\d{4}$/.test(y)) continue;
  for (const m of fs.readdirSync(path.join(R, y))) {
    const q = path.join(R, y, m);
    if (!fs.statSync(q).isDirectory()) continue;
    for (const d of fs.readdirSync(q)) {
      const q3 = path.join(q, d);
      if (!fs.statSync(q3).isDirectory()) continue;
      for (const x of fs.readdirSync(q3)) if (x.endsWith('.html')) f.push(path.join(q3, x));
    }
  }
}
let checked = 0, bad = [];
for (const p of f) {
  const raw = fs.readFileSync(p, 'utf8');
  const nav = /<nav class="toc-static"[\s\S]*?<\/nav>/.exec(raw);
  if (!nav) continue;
  checked++;
  const stripped = raw.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  if ((stripped.match(/class="toc-static"/g) || []).length !== 1) bad.push(`${p}: toc-static 出现 ${(stripped.match(/class="toc-static"/g) || []).length} 次`);
  const ids = new Set([...stripped.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]));
  const hrefs = [...stripped.slice(stripped.indexOf('<nav class="toc-static"'), stripped.indexOf('</nav>', stripped.indexOf('<nav class="toc-static"'))) .matchAll(/href="#([^"]+)"/g)].map((x) => x[1]);
  if (!hrefs.length) bad.push(`${p}: 剥脚本后 nav 里没有条目`);
  for (const h of hrefs) if (!ids.has(h)) bad.push(`${p}: href="#${h}" 在同页找不到落点`);
}
console.log(JSON.stringify({ articlePages: f.length, withBlock: checked, failures: bad.length, bad: bad.slice(0, 8) }));
```

```bash
node /tmp/gate/sp4-nojs.cjs
```

预期：`{"articlePages":80,"withBlock":79,"failures":0,"bad":[]}`。`withBlock` 必须是 79 而不是 80（`2018/12/25/qqweiboshare.html` 那一篇按 §5.1 `目录` ② 必须无块）；`failures` 非 0 就是 G4 红，回去查 Task 9 的插件而不是放宽这里。

**顺带一条肉眼自证**（写进 §9 的证据列，一句话就够）：`_layouts/post.html:276-281` 那段注释已经改口——

```bash
grep -n '无 JS' _layouts/post.html | head -3
```

预期那一句「无 JS 环境也拿不到半截列表」的字面串**不再出现**（spec §4.4 最后一条：留着就是下一届会照着做相反判断的缺陷）。

- [x] **Step 8：§6.4 台账——18 道全量回归跑在导出树里，逐道记「命令 / 退码 / 它自己打出来的那一句」**

spec §6.4 要求的是**列出来才算数**：不数「道」的总数，逐道抄门禁自己的输出，非绿的每一处都要有归因。
本步是这一批最后一次跑全量（Task 1–9 的红→绿账在这里合并），跑完之后 Step 9 才写 §9，Step 10 才提交。

**8.1 造那棵树（跑门的树必须等于提交的那棵树）**

前提：Task 1–9 的提交都在这条分支上，工作树只剩这份未跟踪的计划与 `vendor` 软链
（`git status --porcelain` 只有这两行；多一行就先处理，别带着改动跑台账）。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
git status --porcelain            # 期望只有 ?? 那两行
U=$(git rev-parse HEAD); printf 'U=%s\n' "$U"
mkdir -p /tmp/gate/t10            # 目录已存在就换一个名字（t10b、t10c…），不要 rm -rf：
                                  #   /tmp/gate 是这台机器上几路会话共用的落点，删掉的可能是别人正在量的一份
                                  #   （全局约束与 Task 9 (7d) 那两处导树的 `mkdir /tmp/gate/head` 不带 -p，
                                  #    就是为了让「已存在」当场报错停下、换名再导，而不是盖别人的读数）
git archive "$U" | tar -x -C /tmp/gate/t10
ln -s /Users/liaolongdong/code/liaolongdong.github.io/vendor        /tmp/gate/t10/vendor
ln -s /Users/liaolongdong/code/liaolongdong.github.io/node_modules  /tmp/gate/t10/node_modules
cd /tmp/gate/t10 && npx vite build && bundle exec jekyll build
```

`npx vite build && bundle exec jekyll build` 这个顺序与 Task 1 Step 1 一字不差（两处必须同一口径，
否则台账量的产物和 Task 1 自证的产物不是同一份）。**不带 `--baseurl ""`**：与线上一致用默认
`/better-blog`，而牙齿台账里若干锚点带的就是这一串（带空 baseurl 会让那些刀静默不命中 → 假牙）。

> **执行时回写（2026-10-07，随 §9 那笔文档提交）三处，都在 8.1：**
> 1. **落点同 Step 7 第 2 条一起换到 `$TMPDIR/sp4t10/gate/t10`**，`mkdir` 不带 `-p`（与 Task 9 (7d) 那两处导树
>    同一个规矩：让「已存在」当场停下，换名再导，绝不 `rm -rf` 共享落点）。上面那段写的是 `mkdir -p`，
>    与本计划自己的另一处口径不一致，执行时按不带 `-p` 走。
> 2. **`npx vite build` 要写成 `npx --no-install vite build`**——不带 `--no-install` 时 npx 可能去联网取
>    另一版本，台账量的就不是这棵树自己的构建工具（Task 9 (7d) 的回写里已经钉过一次）。
> 3. **导出树要 `git init` 一次，否则 8.3 里 `计划镜像牙` 那道跑不动。**
>    `verify-plan-blocks-teeth.mjs:268` 的 `dirtyFingerprint()` 要拍 `git status --porcelain`
>    （实验前后各一张、必须一模一样），而 `git archive` 出来的树**没有 `.git`** → rc=1，
>    且因为 stdout 是空的、按 `> file 2>/dev/null` 收 stdout 的台账只抄到一行空白，看不出它为什么没跑。
>    修法是只在这棵临时树里 `git init -q` + `git add -A` + 一次性提交（`user.name`/`user.email` 用 `-c` 现给），
>    跑完 `git status --porcelain` 仍是 0 行——牙齿自己证明它没留脏。**不改主仓、不改工作树。**
> 4. **符号 `$U` 在本任务里指两个不同的 revision，别再复用这一个名字。** 8.1 这里
>    `U=$(git rev-parse HEAD)` 是「台账跑的那棵树」（本轮 = `ae55ad9`），而 Step 7 与 10.7 里的
>    `$U` 是 `git merge-base HEAD main`（本轮 = `2b9464c`，A/B 的 `head` 基线、未推计数 `git log --oneline <U>..HEAD` 的起点）。
>    8.5 那句「拿 `$U` 那棵基线导出树」用的是后者。执行时写成 `UH=$(git rev-parse HEAD)`（导树的）
>    与 `UM=$(git merge-base HEAD main)`（基线的），两个都落进台账（§9.2 记 `UH`，§9.1/§9.3 记 `UM`）。

**8.2 认树：三本产物的 md5 + 页数对账**

```bash
S=/tmp/gate/t10
A=$(find "$S/_site" -name alibaba-page-agent.html)   # 四段路径必须现解：显示层会把
                                                     #   _site/2026/07/12/x.html 折成 _site/2026-07-12/x.html，
                                                     #   照折叠形状去 md5 会得到 No such file
md5 -q "$S/_site/index.html" "$A" "$S/_site/tags.html" | tee /tmp/gate/t10-md5-before.txt
find "$S/_site" -name '*.html' | wc -l
```

跑完整张台账之后再 `md5 -q` 同样三本一次，与 `t10-md5-before.txt` **逐字相同**——这一条自证的是
「这一遍没有任何 watcher 重建过我读的这棵树」（本仓的教训：并行 watcher 重建 `_site` 会让收尾自证假红）。
`find | wc -l` 那个数必须等于 `check-seo.mjs` **第一行**报的页数（那句是 `SEO 门禁：产物 _site/（137 页 / 80 篇文章页 / 103 页带安装面）…`，不是末行；起草时实测 137）：门禁报的页数与磁盘上
真正存在的页数对得上，才说明它读的是这棵树而不是别处。**三本 md5 抄进 §9.2 的台账表头**，
它同时是「哪一棵树」的指纹——工作树里那份 `_site` 与导出树里这份在 A9 落地之前**可能逐字相同**，
那种时候 md5 分不开两棵树，能分开的是 `--site=$S/_site` 这一格命令本身和页数的差；
这句实话要写进台账，不假装 md5 是万能指纹。

**8.3 表 A：spec §6.4 点名那「14 本」（15 个文件、14 行）**

`spec §6.4 写「这 14 本」，按行数是 14、按文件是 15`——`verify-codec-browser.mjs（+ 它的 teeth）`
在 spec 里被并进了一行。台账按文件出，两本各占一行；这一处口径差异作为 §8 的第四次自我纠正写进 spec（Step 9）。

所有命令都在 `$S` 里跑（`cd /tmp/gate/t10` 之后），末行形状那列抄的是**起草时在本工作树实测**的原文，
执行时以本轮实际值为准（除 `seo` 与 `seo 牙` 两行的 `14 组` / `155` 是净增之后的推导值，
推导口径就写在表下面）。
**形状列指的是 stdout 的最后一行**：`check-tools-surface.mjs` 之流会往 stderr 吐一行 Node 的
`ExperimentalWarning`（外加 `(Use \`node --trace-warnings ...\`…)`），`2>&1` 合并之后 `tail -1` 抄到的是那句警告而不是 ✓ 那行。
统一按 `> /tmp/gate/t10-<道>.out 2>/dev/null` 收 stdout 再取末行，退码仍认命令自己的 `$?`（管道会吞退出码）。

| 道 | 命令 | 末行逐字形状 | rc |
| --- | --- | --- | --- |
| toolkit | `node scripts/toolkit-tests.mjs` | `# pass 439`、`# fail 0`（本批不碰 toolkit，数不变） | 0 |
| seo | `node scripts/check-seo.mjs --root=$S --site=$S/_site` | `✓ SEO 门禁 14 组全绿（keywords / … / 换源 / 描述 / 词表 / 内链 / 目录）；JSON-LD <N> 块全部可解析`；抬头 `SEO 门禁：产物 _site/（<P> 页 / <Q> 篇文章页 / <R> 页带安装面），ready 工具 4 条，修订台账 45 条，换源台账 20 条` | 0 |
| seo 牙 | `node scripts/check-seo-teeth.mjs --root=$S --site=$S/_site` | 先后三行（`check-seo-teeth.mjs:2078-2086` 就是这三条 `console.log`，顺序别记反）：`分账：… / 描述 6 / 词表 7 / 内链 1 / 目录 4`、`牙齿台账：155/155 组变异如期变红（用时 …s）`、`✓ 全部变异已还原，复跑基线仍绿` | 0 |
| 工具收录面 | `node scripts/check-tools-surface.mjs` | `✓ 收录面 4 条 ready 条目 × 5 组判据全绿（页面源/收录/导航/图标/DOM）` | 0 |
| 收录面牙 | `node scripts/check-tools-surface-teeth.mjs` | `牙齿台账：74/74 组变异如期变红` | 0 |
| 滤镜单元 | `ruby scripts/check-image-dims.rb "$PWD"` | `--- image-dims: ok（36/36 条断言，台账 20 对，桩目录 …）` | 0 |
| 滤镜单元牙 | `node scripts/check-image-dims-teeth.mjs` | `牙齿台账：27/27 刀变异如期变红` | 0 |
| 换源台账牙 | `node scripts/check-image-variants-teeth.mjs` | `牙齿台账：15/15 刀变异如期变红` | 0 |
| 计划镜像 | `node scripts/verify-plan-blocks.mjs` | `✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）` | 0 |
| 计划镜像牙 | `node scripts/verify-plan-blocks-teeth.mjs` | `41/41 通过` | 0 |
| 工具页浏览器 | `node scripts/verify-tools-browser.mjs` | `# 合计 <N> 项，红 0 项`、`# 分组：…` | 0（环境起不来按 2 记并归因，见 8.5） |
| 工具页浏览器牙 | `node scripts/verify-tools-browser-teeth.mjs` | `合计 <N> 项（六刀 + 三自检），点燃 <N> 项` | 0 |
| 编解码浏览器 | `node scripts/verify-codec-browser.mjs` | `合计 <N> 项，红 0 项` | 0（环境起不来按 2 记并归因，见 8.5） |
| 编解码浏览器牙 | `node scripts/verify-codec-browser-teeth.mjs` | `合计 <N> 个注入，点燃 <N> 个` | 0 |
| 身份证浏览器 | `node scripts/verify-idcard-browser.mjs` | `<N>/<N> 通过` | 0 |

> **执行时回写（2026-10-07，随 §9 那笔文档提交）三处，都在 8.3：**
> 1. **表 A 里那三道浏览器门禁的命令缺 `TK_SITE_DIR`，按原文跑一律退 2。**
>    `verify-tools-browser.mjs`、它的 teeth、`verify-codec-browser-teeth.mjs` 这三部都要环境变量，
>    且 `verify-tools-browser.mjs:1045` 那条 `0a` 判据要求它指向**「那个根的 `_site`」之外**的副本——
>    **导出树里的 `$S/_site` 也算**（它拒的是 `path.join(ROOT, '_site')`，与是不是主仓无关）。
>    实跑给三份**互不相同**的副本：`cp -R "$S/_site" <目录>/_site`，**不能用 `cp -al`**——
>    牙齿是原地改写文件，硬链共享 inode 会连被测树一起改掉。
>    `verify-codec-browser.mjs`（本格）不需要：它默认读 `ROOT/_site` 且只读。
> 2. **`seo 牙` 那一行的形状列写错了组：实跑是 `描述 7 / 词表 6`，不是 `描述 6 / 词表 7`。**
>    差的还是 M9：它一把跨 `描述` ① + `词表` ⑤，而一条案例只有一个 `group`、`分账` 按登记的那组计数，
>    `check-seo-teeth.mjs` 里 M9 的 `group:` 是 `描述`（Task 10 Step 8.6 那句「不写后一处，17 格算不出来」
>    讲的同一件事，形状列却没跟着改）。总数 155 与 `grep -c "^    name: '"` 的 155 相等这一条照旧成立。
> 3. **「末行逐字形状」这一列对三部浏览器门禁不适用**：它们的 stdout 最后一行是噪声
>    （`verify-codec-browser.mjs` 末尾是 `# Chrome pid=…；站外噪声…97 条`，
>    `verify-tools-browser.mjs` 末尾是 `# 分组：…` 那一长行，teeth 末尾是「红项读数留在哪个目录」）。
>    台账要的是它们各自那句**汇总行**（`合计 115 项，红 0 项` / `合计 9 项（六刀 + 三自检），点燃 9 项` /
>    `合计 37 项，红 0 项` / `合计 5 个注入，点燃 5 个`），所以取法是 `> file 2>/dev/null` 之后 **grep 汇总行**，
>    不是 `tail -1`；退码仍认命令自己的 `$?`。
>    另一句实话：`verify-codec-browser-teeth.mjs` 自己的注入编号也是 `M1…M5`，
>    与 `check-seo-teeth.mjs` 的 M1–M18 **不是同一套**，台账里别写成同一个 M。

**推导口径三条**：

1. **`14 组`** = 今天的 `10 组`（`node scripts/check-seo.mjs --list` 数得，起草时现证）+ 本批净增的
   `描述` / `词表` / `内链` / `目录`。组名顺序照 `GROUPS` 数组的追加顺序，写台账时逐字抄那一行而不是照记忆排。
2. **`155`** = 今天的 `137` + 本批 18 把（M1–M18）。分账里四个新组必须四组都在，缺一组就是那一族的牙
   没装上；计数与源里对账：`grep -c "^    name: '" scripts/check-seo-teeth.mjs` **必须等于 155**。
   两个数各自单独成立还不够，要它们相等。
3. **`<P>/<Q>/<R>`**（页数 / 文章页数 / 带安装面页数）起草时实测 `137 / 80 / 103`。本批不新增页面，
   这三个数**应该一字不动**；动了就是哪一刀造了页或删了页，先归因再记数。同理 `<N> 块` JSON-LD
   起草时是 **209**（SP1 台账里那个 205 是那时之后三次提交带上来的，不是同一版本），本批不该动它。

**8.4 表 B：另三道形状不同的（spec §6.4「另加三道」）**

| 道 | 命令 | 末行逐字形状 | rc |
| --- | --- | --- | --- |
| OG 台账自证 | `node scripts/og-images.mjs --check` | `自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。` | 0 |
| 揭示动效 | `node scripts/verify-motion-batch4.mjs` | `# 通过 <N> 项，红 0 项` | 0 **或 2**（负载挡下按拒测记） |
| 触屏下拉 | `node scripts/verify-nav-touch.mjs` | `✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名` | 0 **或 2**（负载挡下按拒测记，见 8.5） |

**`--check` 那两个字是必须的，不是风格。** 起草这一版时我把手误写成不带 flag 的
`node scripts/og-images.mjs --help`（`--help` 不是它的开关，于是走进**生成模式**）：它当场改写了
`_data/og_images.yml`（`git status` 立刻出 `M`），而那是并发会话正持有、spec §7.3 点名不许碰的文件。
回退用 `git checkout HEAD -- _data/og_images.yml`（内容一字未变的那次 restore），台账里只跑 `--check`。
顺带记两条实测事实：同一本脚本 **`--check` 打「表 68 条」、生成模式打「80 条」**，两个数不是同一口径
（校验看的是该有的卡片，生成看的是全部文章）；这一格差异**不在本批范围**，写进 §9.8 移交。

两道 Chrome 门禁之前先跑负载门，超了就按**拒测**记（既不算绿也不算红），别硬跑：

```bash
L=$(sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1}'); printf 'load1=%s\n' "$L"
node -e 'process.exit(Number(process.argv[1]) > 16 ? 2 : 0)' "$L" || echo '本轮：拒测（>16）'
```

起草这一版的当下实测 `load1` 在 **17.9–20.9** 之间（并行会话在跑浏览器工装），所以 Step 8 这一遍
**不可能**在起草时完成——这正是本计划把台账留在执行阶段抄的原因。等两道 Chrome 门禁之前先闲下来，
或者按 SP1 §8.7 那条办法把红的那一遍的**现场归因**（负载值 + 它自己打的采样不足那一句）记全，
再补一遍绿的。缺归因的「重跑了一次就绿了」不算数。

**8.5 非绿的每一处怎么归因**

- 退码 **2** 在 `check-seo.mjs` 那一本里是「门禁自己崩了」（`uncaughtException` 兜底），不是判定；
  在两道 Chrome 门禁里是「环境没起来 / 采样密度不足」，也不是判定。两种 2 都不许写成「红一条」。
- 表 A 里 `工具页浏览器` 那三道如果红：先分清是 **A8 的静态目录动了 DOM 形状**（本批的责任，回去修插件
  或补判据）还是**它们自己的环境抖动**（SP1 已记过一次同类，`nav-touch` 桌面档探针在负载下假红）。
  认法：拿 `$U` 那棵基线导出树（Step 7 造的 `git archive "$U"`，`$U` = 与 `main` 的 merge-base）跑**同一本脚本**，同一项也红就是抖动。
  **两棵基线树别混**：Task 9 (7d) 那棵 `head` 是「本刀之前」（带 Tasks 1–8 的提交），Step 7 这棵是「本批之前」（纯 pre-SP4）；
  归因浏览器门禁的抖动要用后者，量 A8 那一刀的价格要用前者。
- `计划镜像` 那两道如果红：说明有人把 SP4 的计划登记进了 `PLANS`（本批**没有**，见 8.6 第三条）。

**8.6 台账末尾必须写的四句实话（第四句是一张矩阵）**

1. **`内链` ① 没有牙**（spec §5.2 末段点名要写进 §6.4 的那一格）：条数 ≥ 5 是**计数**判据，
   计数判据的牙等价于「删一条就少一条」，已被 `内链` ② 的牙（M12 把 href 改成 `/tools/nope.html`）覆盖。
   这一格照口径写，不假装它有牙。
2. **`idcard` 那一篇零正文内链是结论不是漏项**：spec §4.3 候选名单里 `2024-01-05-chrome-plugin-recommend.md`
   的「脱敏演示」对不上 `/tools/idcard.html` 真做的事（Task 8 Step 里已给全文理由）。
   台账里正文内链的**分布**要照篇点名（六条落在哪六篇），不接受只报一个总数。
3. **`verify-tool-url.mjs` 不在本批**：它随 `sp2-tool-url-state`（尖 `bab6051`）未合，
   `git ls-files scripts | grep -c tool-url` 在本分支为 0。若 SP2 先合进 `main`，本批合并后重跑时它自动进集，
   届时表 A 多一行、`收录面牙` 那一行的数会跟着涨（那是 SP2 的 `urlState` 组带来的，不是 SP4 动的）。
4. **24 个新格子逐个点名谁有牙**（这是「不假装」的本体；只写「每组都有牙」不算数）。
   新四组共 7 + 8 + 4 + 5 = **24 格**。18 把牙落在 **17 格**上（一格多把、一把多格都算覆盖：
   `描述` ① 有 M1 与 M9、`目录` ① 有 M11 与 M13、`目录` ⑤ 有 M14 与 M17；
   而 M9 一把跨 `描述` ① + `词表` ⑤、M13 一把跨 `目录` ① + ③——不写后一处，17 格算不出来，
   只按「一把一格」数是 16），剩下 **7 格无牙**，逐格给理由（下表五行 = 1+1+1+2+2 格，`内链` 与 `目录` 各一行写两格）：

   | 无牙的格 | 为什么这批不给它牙 | 将来要补的价钱 |
   | --- | --- | --- |
   | `描述` ⑤ 全站取值互不相同 | 要让它红得**造一次重复**（把 B 篇摘要写成 A 篇摘要），而 spec §5.2 那一届就没给这一格派牙；本批的读数格（§6.1 `uniqDesc 80 → 80`）因此是「今天就是绿的、也没有牙」——这一句必须照写，不许挂着「有守卫」的名义过去 | 7 行：取两篇，`S.srcSubLine(B, /^seo_description:.*$/m, 'seo_description: ' + A的值)` |
   | `词表` ⑦ 归档页不悬空 | 形状判据：A9 之后这一格不可能**自然**长出悬空（所有 chip 的 href 与落点都是构建期现拼）。要让它红必须手动从产物里挖掉一枚 `id`，而那正好是 `内链` ② 那把牙（M12）已经在打的形状的近亲 | 6 行：`S.siteCutRe(tags.rel, /<a id="Chrome"[^>]*>/)` |
   | `内链` ① 条数 ≥ 5 | 计数判据，见本步第 1 句 | 不给，理由已写 |
   | `内链` ③ 每篇 ≤ 2 枚 / ④ 链接文字非空词 | 上限与措辞两格，防的都是**未来**往正文堆链、图省事写「点这里」；这批六条链是一次写定的（Task 8 Step 3 那张表逐条拟的文字），两格的判据此刻没有对应的现实形状 | 各 5–6 行：往 `#post-body` 塞第三枚链 / 把某条链文字换成 `点这里` |
   | `目录` ② 阈值之下必须无块 / ④ JS 那一族三个落点仍在 | ② 的靶子是全站唯一那篇 `qqweiboshare`（给它塞块 = 造一个现实中不会出现的形状）；④ 读的是 `dev/js/editorial.js`，那是本批禁改清单上的文件，动它的变异要打在副本上、而 A8 根本不碰它 | 各 5 行，见左 |

   这几行连价钱一起进 §9.8 的移交清单。**这不是漏项，是选择**：137 把既有牙的分布本来就疏密不均
   （`分页门` 2 把、`JSON-LD` 30 把），本批按同一标准把「哪一格没牙」写成明账，而不是把 24 格都补成一样密。

**8.7 跑完把三样东西留档**

```bash
md5 -q "$S/_site/index.html" "$A" "$S/_site/tags.html" > /tmp/gate/t10-md5-after.txt
diff /tmp/gate/t10-md5-before.txt /tmp/gate/t10-md5-after.txt && echo '树未动 ✓'
git rev-parse HEAD > /tmp/gate/t10-head.txt
```

`$U`（8.1 打出来的那个 40 位）、两份 md5、`git status --porcelain` 的空输出，一起进 §9.2。
少任何一样，这张台账就退回到「我跑过我说过」的形状。

- [x] **Step 9：把这一批的账写回 spec（§5.1/§5.2 五处改口 + §8 ⑨⑩⑪ + 新增 §9 交付实录）**

**9.1 §5.1 组 `描述` 那一格补第 ⑦ 条**

**先认清一件事：⑥ 不是本步的活。** ⑥（产物 meta == 源侧值那一格）由 **Task 1 Step 5 第 1 项**写进这一格，
本步只写 ⑦。落笔前先 `grep -c '⑥' <<<"$(grep -n '^| `描述`' "$D")"` 看那一格里有没有 ⑥：
有 → 直接在行尾追加 ⑦；没有 → 那是 Task 1 的欠账，先按 Task 1 的措辞补 ⑥、再补 ⑦，
并在 §9.4 的偏离里记一行「⑥ 晚落了一整个任务」。两种走法都要留字，别让读者以为这一格本来就长这样。

在 `:302` 那一行的判据列末尾（也就是 ⑥ 之后）追加：

```
；⑦ **无静默截断**：五个字符串键（`title` / `subtitle` / `seo_description` / `seo_short_title` / `description`）
在 front matter 里写下的值，与 Jekyll 解析后读到的值逐字相等——` #` 出现在不带引号的 plain scalar 里
会被当行尾注释，写进去的半句话静默消失（牙 M18）
```

同一行末列（失效面）追加两句：`摘要与产物脱节（改了源、meta 不动）/ 标题里带「#」的篇被吃掉半句`。

**9.2 §5.1 组 `目录` 第 ⑤ 条补「门控半边」**

`:305` 那行 ⑤ 的末尾（`逐字可见（防「两份列表同时显示」）` 之后）追加：
`；⑤ 的另一半是逐页的：`<nav class="toc-static">` 之前必须已有那段给 `<html>` 挂 `has-js` 的内联脚本，
否则静态块会先画一帧再收起，读者看到一次塌陷（牙 M17）`。
末列失效面追加 `收起之前先画一帧（CLS 冒出来）`。

**9.3 §5.2 三处改口 + 补两行**

1. 开头那句 `本批 M1–M14 全部进第一本（\`check-seo-teeth.mjs\`），M15 也是——它打的是源侧 tags 行，判据在 \`词表\` 组。`
   改成 `本批 M1–M18 全部进第一本（\`check-seo-teeth.mjs\`）：M15 打源侧 tags 行（判据在 \`词表\` 组），
   M16 打产物 meta（\`描述\` ⑥），M17 打 has-js 内联脚本（\`目录\` ⑤），M18 打源侧 subtitle（\`描述\` ⑦）。`
   锚定用 `grep -n '全部进第一本' "$D"`（行号会随 Task 1 的改动漂，字符串不会）。
   如果 Task 1 落 M16 的时候已经把这句改过口了，**按现文往下改**（只把 ⑥⑦⑧ 那三小句补进去），
   不要为了套上本步的模板回去恢复一个更早的写法。
2. 表尾（M15 那行之后）加两行，格式与既有行一致（**新单元格的显示宽度要与该列原最大值对齐**，
   prettier 会重排整表空格；写完跑一次 `--write` 再 `git diff` 看有没有波及别行）：

   ```
   | M17 | 摘掉静态块之前那段给 `<html>` 挂 `has-js` 的内联脚本 | `目录` ⑤（门控半边） |
   | M18 | 把某篇 `subtitle` 写成不带引号的 plain scalar、尾巴带一个 ` #9` | `描述` ⑦ |
   ```

3. M2 那一行的「45 字符」改成「45 个 code point（数的是**值**的 code point，`seo_description:` 前缀与字节都不算）」，
   与 Task 4 Step 2 的 `expect` 口径同一句话。M4 那一行的举例数字 `21` 后面补一句
   `（执行时取 `41793`：`21` 太容易作为 `2021` / `16.3.21` 的子串存在于正文，那一刀会落空）`。

**9.4 §5.x 与 §8 里所有「M1–M1x」的字面串改成全集**

```bash
grep -n "M1–M1[0-9]" _docs/superpowers/specs/2026-10-03-content-governance-design.md
```

**按行数不按起草时记的那两行**——Task 1 已经把牙齿形状那条注、§5.3 门禁侧、§8 的落码句各改过一次口
（它们当时写的是 `M1–M14` / `M1–M15`，Task 1 统一落到 `M1–M16`）。本步把 grep 出来的每一处
描述「本批全集」的字面串都改成 `M1–M18`，改完再跑这条 grep，**必须只剩 `M1–M18` 一种形状**（不许残留 14/15/16）。

**9.5 §8 决策记录加三行，并把标题改成实数**

Task 1 Step 5 已把 ④–⑧ 落进去、标题改成「纠自己八次」。本步在其后接 ⑨⑩⑪，标题改「**纠自己十一次**」：

- **⑨** `§6.4` 那句「判据脚本是这 **14 本**」按行数是 14、按文件是 **15**：
  `verify-codec-browser.mjs（+ 它的 teeth）` 被并进了同一行。台账按文件出，15 行。
- **⑩** `§6.1` 那两格（`39 → 0`、`0 → 0`）在 Task 1 已改成 `38 → 0`、`1 → 0`；**根因今天才查清**：
  起草时两把 Ruby 尺都用 `/\A---\n(.*?)\n---\n/` 读 front matter，**CRLF 那一篇被静默跳过**
  （`_posts/2019-02-25-you-dont-kown-js-tips.md`），于是「手写的篇数」少数一位；改成 `---\r?\n` + 去 `\r` 之后
  `hand=41`，与 §1 事实里那个 41 对上了。**教训是形状：一把尺读不到某个文件时，它报的数会安静地小一位，
  而「安静地小一位」看起来像口径差异，不像 bug。**
- **⑪** 起草时没人怀疑过 `subtitle` 能被 YAML 吃掉半句：`_posts/2026-09-25-claude-agents-md-remote-gate.md`
  那篇写的是 `subtitle: issue #95690 …`（无引号），Jekyll 读到的是 `issue`（5 字符 < 25 地板），
  产物 meta 退回全站 `site.description`、分享卡的描述跟着一起错。
  spec §1 事实里那句「唯一 <25 的是那篇不产出的教学样本」因此**只对了一半**——它漏了这一篇。
  补判据（⑦）+ 补牙（M18）+ 一处一行修复（加双引号），见 §9.5。

**9.6 新增 `## 9. 交付实录（SP4，2026-10-03）`**

形状照 SP1 那份 §8（`_docs/superpowers/specs/2026-10-02-seo-aeo-structure-design.md:699-890`），八小节：

| 小节 | 写什么 | 数从哪来 |
| --- | --- | --- |
| 9.1 提交段 | 本批每一刀的 commit（短 sha + 主题一行），按提交顺序 | `git log --oneline <U>..HEAD` |
| 9.2 门禁台账 | Step 8 表 A + 表 B 的**本轮实际值**，加 `$U`、两份三本 md5、页数对账那一格 | Step 8 |
| 9.3 A/B 三个数 | Step 7 的 5 轮中位数：CLS / 首次动作 / load（含 Δ 恒等式那一组字节数） | Step 7 |
| 9.4 与原设计的偏离 | 五处：`描述` 多出 ⑥⑦ 两格、牙齿 15 → 18 把、`词表` ⑧ 用钉快照而不是 `git show HEAD`、动作 3 不重跑 og 生成器、B3 按第 6 项决策 deferred | Task 1/5/10 |
| 9.5 揪出并修掉的缺陷 | 至少四处：YAML 静默截断（本篇）、CRLF 篇被尺漏掉（⑩）、`match_tags` 9 → 33 枚且 `Vite` 在其内、`_layouts/post.html` 那段「无 JS」过期注释 | Task 1/5/10 |
| 9.6 量具踩的坑 | 七条，逐条一句：四段路径被显示层折叠 / 一页两条 `meta description`（`:467` 注释里那个例子）/ `.size < 25` 那道地板 / Ruby 里 `date` 解析成 `Date` 不是 `String` / `/tmp` 下 Node 脚本要 `.cjs` / 数 CRLF 只能 `grep -lU $'\r'` / **`og-images.mjs` 不带 `--check` 会改写 `_data/og_images.yml`** | Step 8.4 与本计划各步 |
| 9.7 两道 Chrome 门禁实情 | 负载值、有没有拒测、红的话现场归因是什么 | Step 8 表 B |
| 9.8 未做与移交 | `article-check.mjs` 那四格的迁移（spec §7.2）、`check-seo.mjs` 读取器换成 `scripts/lib/post-meta.mjs`（它进 `main` 之后）、`tags.html` alias 锚点（§7.1）、`index-all.html` 的「无脚本」claim、`og-images.mjs` 生成/校验两个「表条数」口径差、`_config.yml:27` `site.keyword` 死配置、SP2/SP3 两条未合分支的合并次序 | 本计划各步末段 |

写这一节时的三条纪律：**没实测的数不许写成实测**（拿不准就写「未量，移交」并说明为什么）；
每个数带口径（哪个树、哪个 baseurl、几轮中位）；§9.5 那几处缺陷**按发现顺序写而不是按严重度排**，
读的人要能顺着时间线复核。

- [x] **Step 10：收口自证 + 提交（这两份文档不跑 prettier）**

**10.1 一条先说清的「不做」**

`scripts/*.mjs` 那两本在本批前面的任务里已经按仓规排过（`npx --no-install prettier --single-quote --print-width 320 --write`）。
**但 `_docs/superpowers/**` 一律不排**，两条现证：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
npx --no-install prettier --check _docs/superpowers/plans/*.md _docs/superpowers/specs/*.md 2>&1 | grep -c "^\[warn\] _docs"
ls _docs/superpowers/plans/*.md _docs/superpowers/specs/*.md | wc -l
```

起草这一版实测：`9` 与 `9`——**全部既有计划与 spec 都是 prettier-dirty 的**，这就是本仓 docs 的约定形状。
第二条更要紧：prettier 会格式化 markdown 里的代码围栏（正因如此 `.mjs` 才要用那条 `--print-width 320` 去排），
而 `verify-plan-blocks.mjs` 的判据是**镜像块与磁盘逐字节全等**——对那五份已登记的计划跑一次 `--write`，
计划镜像那道门必红一片。所以这一步只**手写**对齐：新增的表格行照 §5.2 现有行那样单空格 `| a | b |`，
不去补列宽、不动别人的行。

**10.2 旧口径清零（三条 grep；前两条一条直空、一条滤完空）**

```bash
D=_docs/superpowers/specs/2026-10-03-content-governance-design.md
grep -n 'M1–M14\|M1–M15\|M1–M16\|纠自己三次\|纠自己八次' "$D"   # 期望无输出（9.4 与 9.5 已把它们推到全集）
grep -n '39 → 0\|那 39 篇的 `subtitle` 全部 ≥25\|9 条逐字\|9 条钉死\|重跑 `node scripts/og-images.mjs`' "$D" \
  | grep -v '起草时\|改成\|错\|取消'                          # 期望空
grep -cE '^\| M[0-9]+ \|' "$D"        # 期望 18：M1…M18 一行不少一行不多
```

第二条**不是「一处不出现」，而是「出现的每一行都必须带着改口标志词」**——Task 1 Step 6 实测过这条：
§6.1 与 §8 得原样引用被推翻的旧数才能说明哪一版废了，硬要求「零命中」的那条判据自己站不住。
这一条在 Task 1 Step 6 已经跑过一遍（当时第一层 5 行、滤完 0 行），这里复跑是看 Task 5–9 有没有把旧数抄回来。

第三条**不是**「无输出」那一类，它是一个必须等于 18 的数。不等于 18 就是表少写/多写了一行，
按 `grep -nE '^\| M' "$D"` 逐行点名找出来，别改正则去凑。

> **执行实录（Task 10，2026-10-07）——第一条的「期望无输出」站不住，两条改成同一套判据。**
> 实跑：第一条命中 **1 行**（`696`，§9.4 偏离表第 2 行的「起草时写的」列，里面写的正是
> `M1–M14（定稿时）→ M1–M15 → M1–M16`）；第二条命中 **5 行**，按这里给的四个标志词滤完剩
> **1 行**（`418`，§6.1 那句「那 39 篇的 `subtitle` 全部 ≥25 字符」，紧跟的字面是「这句不成立」）。
> 两处都**不是**把旧数当现状陈述——恰恰是那两节必须原样抄下被推翻的旧口径，否则读者看不出哪一版废了。
> 所以判据改成这一条（对两条 grep 用**同一个**标志词集，且**以命令输出为准**回写到这里，
> 没有就近改数）：`grep … "$D" | grep -vc '定稿时\|不成立\|起草时\|改成\|错\|取消'` 两条都必须为 **0**。
> 实跑结果：第一条 1 → 滤后 **0**；第二条 5 → 滤后 **0**。相比起草时那份，标志词集多了
> `定稿时`（偏离表的列名措辞）与 `不成立`（§6.1 的推翻措辞）两个——**这不是把滤网放宽来放过命中**，
> 起草时那四个词本来就没打算盖住表格列名和「这句不成立」这两种真实写法，是网眼漏的，补上才对得上意图。
> 第三条实跑 `18`，与期望相符，未动。

**10.3 与文档有关的门禁复跑一遍**

```bash
cd "$S"                                   # Step 8 那棵导出树，$S=/tmp/gate/t10
node scripts/verify-plan-blocks.mjs        # 期望末行 `✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`
node scripts/verify-plan-blocks-teeth.mjs  # 期望 `41/41 通过`
```

这两道是全集里唯二会**读 `_docs/`** 的门禁。它们在 `$S`（= `$U` 的内容，没有本批文档改动）里跑出来是绿的，
加上 10.4 的 pathspec 自证（本批这一步只改两份文档），就共同说明文档改动动不到任何判据。

**10.4 只暂存这两份，且暂存完再看一眼**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io/.worktrees/sp4-content-governance
git add -- _docs/superpowers/plans/2026-10-03-content-governance.md _docs/superpowers/specs/2026-10-03-content-governance-design.md
git diff --cached --name-only          # 必须正好这两行
```

**绝不 `git add .` / `-A`**：主工作树里并发会话有约 20 个暂存文件，而 `vendor` 软链永远不进暂存区。
`git diff --cached --name-only` 多出第三行（尤其 `_data/og_images.yml`、`_config.yml`、`package.json`、
`dev/sass/toolkit.scss`、`scripts/lib/post-meta.mjs` 这几枚）就 `git restore --staged <那枚>` 再来一次。

**10.5 提交（走文件，不走 heredoc）**

```bash
git commit -F /tmp/gate/sp4-t10.txt
git show --stat HEAD | head -12
git status --porcelain                 # 期望只剩 ?? vendor
git log --oneline -12
```

提交信息主题：`docs(sp4): 交付实录与三处口径改口——静默截断那处补了判据⑦与牙 M18`。
正文四段：本批净增两条判据（`描述` ⑥⑦）与三把牙（M16/M17/M18）、台账 18 道跑在导出树（`$U` 与三本 md5 写进 §9.2）、
A/B 三个数（§9.3 那三个中位数，含 Δ 恒等式）、**未 push**。
成败只认 `git log`——`git commit` 的 stdout 会被钩子的 status 污染，不作为依据。

**10.6 「跑门的树 == 提交的树」这一格怎么钉**

Step 8 的台账跑在 `$U`（本批 Task 9 之后、本步之前的那个 HEAD）上，而提交之后 HEAD 多了两份文档。
补法不是重跑 18 道，而是把「差别只有文档」这件事证出来：

```bash
git diff --name-only "$U" HEAD                 # 期望只有那两份 _docs/ 下的文件（Task 1–9 的提交已在 $U 里）
git diff --name-only "$U" HEAD | grep -vc '^_docs/superpowers/'   # 期望 0
```

若第二条不是 0：$U 取错了或者中间混进了别的提交，回去重取 `$U`（`git rev-parse` 那 40 位要抄进 §9.2），
别用「差不多是这一版」往下写。跑门的样本与提交的样本只在 `_docs/`（Jekyll 不发布、`_` 前缀目录被排除；
唯一读它的是 `verify-plan-blocks`，已在 10.3 单独复跑）这一层不同——这句话要连着这两条命令一起进 §9.2 的表头。

**10.7 不 push（spec §7.5 钉死：本批全部提交只落在这条分支）**

```bash
git log --oneline "$U"..HEAD | wc -l   # $U 就是 10.6 那个 merge-base（本批起草时实测 `2b9464c`）；这个数抄进 §9.1，并写明「未推」
git branch -r --contains HEAD          # 必须一行都不输出——这才是「未推」的硬证据
git branch --show-current              # 必须是 sp4-content-governance
```

**别写 `origin/main..HEAD`**：本仓库远端只有 `master`（`git ls-remote --heads origin` 三条里没有 `main`，
`origin/HEAD` 指向 `origin/master`），那条命令在这里不是返回 0，而是 `fatal: ambiguous argument 'origin/main..HEAD':
unknown revision`——把它当成「未推 0 条」读会正好反了。相对远端的核验一律用 `git branch -r --contains HEAD`：
空输出 = 这条分支的尖没有任何远端分支包含，与本地 `main`/`master` 谁新谁旧无关。

推送要单独拿授权，本任务不做，也**不许**把它当成「顺手收尾」。§9.8 的移交清单里第一条就是
「等一个明确的 push 指令」，SP2（尖 `bab6051`）与 SP3（尖 `8122f9c`）两条未合分支的合并次序也写在那里。

**10.8 清场**

只删自己这一批造的东西：`/tmp/gate/t10*`（含 `t10-md5-*.txt`、`t10-head.txt`）、`/tmp/gate/probe`、
`/tmp/gate/sp4-*.cjs`、`/tmp/gate/sp4-*.rb`、`/tmp/gate/t4-*.out`…`/tmp/gate/t9-*.out`。
**不碰** `/tmp/gate/head`（Task 9 (7d) 那棵可能还要用于归因）、不碰任何 `sp4-ab*` 的 jsonl（§9.3 的原始读数）。
进程只杀日志里能认出是自己 spawn 的那几个 pid（`# Chrome pid=…` 那一行抄下来过），
**绝不宽匹配 `pkill`**——这台机器上有并行会话的 Chrome 工装。

---


