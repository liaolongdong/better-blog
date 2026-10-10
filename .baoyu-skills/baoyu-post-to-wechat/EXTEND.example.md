# baoyu-post-to-wechat 偏好 —— 本仓库的公众号草稿同步配置模板
#
# 用法：复制成同目录的 EXTEND.md 再填值。EXTEND.md 已被 .gitignore 排除，
# 因为它要写 SSH 主机的公网地址，而这个仓库是公开的。
#
# 解析器：skill 的 scripts/wechat-extend-config.ts。三条实测到的口径要留意：
#   1. 值为空（`key:` 后面什么都没有）或字面量 null 时，这一行直接被跳过，等于没配 —— 报错由使用方给。
#   2. `#` 开头的整行是注释；行内 `值 # 注释` 不会被剥掉，会把注释当成值的一部分，所以注释一律单开行。
#   3. identity_file / known_hosts 的值原样传给 `ssh -i` 与 `-o UserKnownHostsFile=`，
#      **不做 `~` 展开**，必须写绝对路径。

# 同步方式：草稿箱，不是发表。remote-api = 本机渲染与转码，只有对 api.weixin.qq.com
# 的 HTTPS 请求走 SSH 隧道借那台主机的出口 IP（本机这侧的出口 IP 不固定、会轮换，
# 而白名单只认固定地址，所以直连必报 errcode 40164）。
default_publish_method: remote-api

# 正文主题与主色：default 是站点正文最接近的一套；不写 default_color 时用主题自带色。
default_theme: default

# 署名。_posts 的 front matter 按写作协议只有 7 个键，没有 author，所以署名只能落在这里。
default_author: 廖小新

# 评论开关，对应 draft/add 的 need_open_comment / only_fans_can_comment。
need_open_comment: 1
only_fans_can_comment: 0

# ↓ 下面这些填真实值；host 留空时真跑会直接报 "Remote publish host is required"。
# host 填那台主机的公网 IP 比填域名稳（少一次 DNS 解析，也不依赖本机解析结果）。
remote_publish_host:
remote_publish_user: root
remote_publish_port: 22
remote_publish_identity_file: /Users/USERNAME/.ssh/id_ed25519
remote_publish_known_hosts_file: /Users/USERNAME/.ssh/known_hosts
remote_publish_strict_host_key_checking: accept-new
remote_publish_connect_timeout: 10
