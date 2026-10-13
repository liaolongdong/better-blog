# 证据清单（fixture：只为验证 article-check.mjs 的反查门，非真实研究）

N-01 | star 数 18742 | GET https://api.github.com/repos/mmorett/pdf2txt | 2026-09-27T14:20:00Z | resp.stargazers_count
N-02 | 单次输出 8192 字符 | `npx pdf2txt scan.pdf --tokens 4000 \| wc -m` | 2026-09-27T14:31:00Z | stdout
N-03 | 耗时 0.9 秒 | `time npx pdf2txt scan.pdf` ×3 | 2026-09-27T14:33:00Z | 0.8/0.9/1.1
N-04 | 同类 prompt 2614 字符 / 本仓库 412 字符 | 读两家 SKILL.md 与 prompt 模板 | 2026-09-27T14:40:00Z | wc -c
N-05 | 版本号 v1.0 未发：releases 最新仍是 0.4.x | GET https://api.github.com/repos/mmorett/pdf2txt/releases | 2026-09-27T14:41:00Z | tag_name

I-01 | issue #318 --pages 参数未定稿，created 2026-07-21 | GET https://github.com/mmorett/pdf2txt/issues/318 | 2026-09-27T14:45:00Z | title + state:open

U-01 | https://github.com/mmorett/pdf2txt | HTTP 200 | 2026-09-27T14:19:00Z | 仓库首页，README 第 2 节 Quick start
U-02 | https://github.com/mmorett/pdf2txt/issues/318 | HTTP 200 | 2026-09-27T14:45:00Z | --pages 语义讨论，两个月无维护者回复

R-01 | 300 页合并件 OOM，退出码 137 | `npx pdf2txt big.pdf` | 2026-09-27T14:52:00Z | zsh: killed / exit=137
R-02 | 双栏合同左右串行 | 同一份 scan.pdf 人工比对 | 2026-09-27T14:55:00Z | 第 4 页右栏接在左栏之后

## 标题候选（fixture：格式示范，非真实打分）

候选 01 〈反差数字式〉 一份 24 页的扫描件，它吐给我 8192 个字符｜缺口 2 后果 2 易懂 2 前半 2
候选 02 〈缺口式〉 24 页压成 8192 个字符：省下的 token 换来版式全丢｜缺口 2 后果 2 易懂 1 前半 1
候选 03 〈第一人称受挫式〉 我拿最脏的那份扫描件试它，双栏合同串行了｜缺口 1 后果 2 易懂 2 前半 2
候选 04 〈警告式〉 别拿它读双栏合同：左右两栏会接成一句｜缺口 2 后果 1 易懂 2 前半 2
候选 05 〈收益-机制-限定式〉 它按页换算 token，我只验到 300 页那一次 OOM｜缺口 1 后果 1 易懂 1 前半 1
选用 = 01（总分 8）
