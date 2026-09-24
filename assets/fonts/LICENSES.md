# assets/fonts 第三方字体许可

| 文件 | 字体 | 版本 | 许可 | 上游 |
| --- | --- | --- | --- | --- |
| `newsreader-latin-var.woff2` | Newsreader | v26（可变 wght 400–700，仅拉丁子集） | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Newsreader |
| `ibm-plex-mono-latin-400.woff2` | IBM Plex Mono | v20（wght 400，仅拉丁子集） | SIL Open Font License 1.1 | https://fonts.google.com/specimen/IBM+Plex+Mono |
| `ibm-plex-mono-latin-500.woff2` | IBM Plex Mono | v20（wght 500，仅拉丁子集） | SIL Open Font License 1.1 | https://fonts.google.com/specimen/IBM+Plex+Mono |

三份字体均以 SIL OFL 1.1 分发，条款原文见 https://openfontlicense.org 。

## 三份都按原样分发

由 Google Fonts CSS API 下载而来（`unicode-range` 已在
`dev/sass/common/tokens.scss` 里逐字抄回），不是自行裁剪，因此子集边界与上游一致，
字体名也保持原样。取的是 `latin` 子集；Plex Mono 取静态 400／500 两档，Newsreader
取一条 `wght@400..700` 的可变轴，各文件与 Google 当次响应里的 URL 逐字节一致。

没有一份是裁剪过的衍生件，所以这里不涉及 OFL 第 1 条的保留字（RFN）改名义务。

`iconfont.*`（同目录）来自 iconfont.cn，与上述字体无关，其使用限制见 `assets/iconFont/`。
