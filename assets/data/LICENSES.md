# assets/data 数据来源与许可

这里只记人需要看懂的部分：欠谁什么、我们拿的是哪一层东西、哪些第三方实现查过但没用。
机器可读的来源清单（URL / 字节 / SHA-256 / 条数 / 数据截止日）按数据集分在三份
`SOURCES.json` 里——`scripts/fixtures/region-source/`（区划：现行三层 + GB2260 历史码）
· `scripts/fixtures/bankbin/`（银行卡 BIN 与行别名）· `scripts/fixtures/carrier/`（三位号段）。
本文件不重复哈希，避免两份记录各说一套。
`count` 的口径跟着输入形状走，两处不一样：JSON 数组按**长度**计（区划 31 / 342 / 2,978，
历史码 3,465），CSV 按**去掉表头之后的非空行**计（上游留的空行不算一条）。
每份清单各自的 `countNote` 说清它数出来的到底是什么东西。

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

## 二、行别与号段两张表（`/tools/idcard.html` 的银行卡与手机号面板）

| 用途 | 来源 | 许可 | 取到的东西 |
| --- | --- | --- | --- |
| 银行卡 BIN → 发卡行 / 卡种类 / 卡号长度（`bank-bin-data.js`） | [hexindai/bcbc](https://github.com/hexindai/bcbc) 的 `data/bin.csv` + `data/name.csv`，pin 在 commit `de631827ffe8db2792d140f3476b02498fc1244f`（2025-02-05） | MIT | 1,709 条 BIN、260 个行别码；BIN 长 3–10 位，卡号长度只有 15–19 五种 |
| 三位号段 → 运营商（`carrier-data.js`） | [LSG-PolarBear/impulse](https://github.com/LSG-PolarBear/impulse) 的 `impulse.py` 里 `OPERATORS` 字典，pin 在 commit `dcacca9bf28132ca6938eb2c162e9b222ae02a53`（2026-08-28） | Apache-2.0 | 5 家运营商 / 56 个三位号段 |

两张都是**第三方整理的结果**，不是银联也不是工信部的发布物，所以面板上各带一行"仅供参考、
不承诺全量"。号段这张只有**一个来源**：编号计划原文取不到（wikipedia 在本机恒超时、baike
只返回反爬壳），可交叉核对的归属地仓库 `ls0f/phone`、`dannyhu926/phone_location`、`funNLP`
**全部无 license**（等于保留所有权利），所以一张都不抄。这个缺口同时决定了
`scripts/toolkit-tests.mjs` 的 §F 只断自洽性、不断外部正确性——细节在
`scripts/fixtures/carrier/SOURCES.json` 的 `knownGap`。

## 三、数据本体不是这两个仓库的创作

三级区划的代码与名称来自国家统计局公布的**统计用区划和城乡划分代码**，属政府公开信息；
modood 做的是采集与格式整理，其许可覆盖的是那份 JSON 的编排表达。同理，GB/T 2260 是推荐性
国家标准，本站只使用其中的**代码与名称这一组事实**，不转录标准正文、不复述标准里的层级划分
说明文字。这一层区别要写清楚，否则读起来像是某个 GitHub 仓库创作了区划代码。

## 四、IDValidator 的 MIT 许可通知（逐字保留）

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

## 五、查过但没有用的第三方实现

- npm `uscc@1.2.0`：校验逻辑可用，但 `registry.npmjs.org/uscc/1.2.0` 的 `license` 字段实测为
  **GPL-3.0**。本站代码以 MIT 分发（见根目录 `LICENSE`），引入 GPL-3.0 前端代码会把随包分发的
  资产整体拽进 copyleft 义务。因此只借它"用真实公开码当测试向量"的思路，不引依赖、不抄源码。
- npm `id-validator`（mc-zone 同一作品）：其随包的 GB2260 表就是本文第一节的旧副本来源。
  算法部分本站自己实现，为的是与设计文档 §5.4 的三态判定契约同构，不接依赖。

## 六、新增来源时的义务

后续每加一份"别人整理出来、我们只是使用"的东西（数据表、字体、图标、第三方依赖），
必须为它**新起一节**（照 §一 / §二 的形状：一张表，一行一个来源，写清"取到的东西"是
条数与截止日而不是"最新版"），后面的小节编号顺延，并同步它的机器可读清单——由脚本
生成的那份要写 `SOURCES.json`，`count` 的口径按输入形状选（JSON 数组算长度、CSV 算去
表头后的非空行），选了哪种就写进 `countNote`。判断标准只有一条：**内容是不是别人的整理成果**。
自己按公开口径算出来的算法不占本文篇幅——校验位、加权和这类算法的口径写进
`_docs/superpowers/specs/` 对应小节，本文件只管归属。
