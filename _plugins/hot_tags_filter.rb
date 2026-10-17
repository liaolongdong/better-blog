# Jekyll 插件：把 site.tags 按热度重排
#
# 为什么需要它：site.tags 是一个 Ruby Hash，而模板里 `{% for tag in site.tags limit: 6 %}`
# 取的是 Hash 的**插入顺序**。Jekyll 构建这个 Hash 的地方是
# vendor/bundle/.../jekyll-4.3.4/lib/jekyll/site.rb:255 `post_attr_hash`：它按 `posts.docs`
# 的顺序插入 key，而那份数组在 reader.rb:26 `sort_files!` 里按 document.rb:342 `<=>`
# 排成 **date 升序**。同函数第 263 行 `hash.each_value { |posts| posts.sort!.reverse! }`
# 只反转了每个标签内部的文章数组，标签 key 的顺序从没动过。
#
# 后果：首页话题栏取「站内最早的文章上第一次出现的 6 枚标签」。2026 年的首页因此显示
# jekyll / JavaScript语言精粹 / 学习笔记 / git常用命令——全是 2016、2017 年那几篇留下的。
# 对照：site.posts 的顺序是对的，因为它在 drops/site_drop.rb:28 单独补了一次
# `sort { |a, b| b <=> a }`，tags 没有这一步。
#
# 排序口径：文章数降序 → 该标签下最新文章日期降序 → 标签名升序。
# 第三级是必需的而非装饰：前两级并列时 Ruby 的 sort_by 不保证稳定，换台机器或换次
# Jekyll 小版本就可能给出一套不同的首页话题栏，而门禁不比这个，没人会发现问题。
module Jekyll
  module HotTagsFilter
    # site.tags 进来，key 按热度重排后的 Hash 出去。
    #
    # 这里没有「插件没加载就退回旧顺序」的兜底，别以为有：_plugins 没加载时缺的是
    # hot_tags 这个方法本身，而 Jekyll 默认 error_mode=warn、strict_filters=false
    # （configuration.rb:62-64），于是那两处 assign 静默拿到 nil，只留一行 Warning——
    # 首页话题栏、右栏标签云、整个归档页一起变空白，门禁一个都不会红。
    # 今天这条路不通，因为 CI 跑的是 `bundle exec jekyll build`（不带 --safe，仓库里
    # 也没有任何路径带 --safe）。要是在哪里引入了 --safe 或官方 Pages 构建器，
    # 先给 tags.html 补一条「至少渲染出一个 cat-section」的断言再谈别的。
    def hot_tags(tags)
      tags.sort_by { |name, docs| [-docs.size, -newest_date(docs).to_i, name.to_s] }.to_h
    end

    private

    # docs 已由 post_attr_hash 排成最新在前，取首个即可；仍走一遍 max，
    # 是为了不把「上游那行 reverse! 还在」当成前提。
    def newest_date(docs)
      docs.map { |d| d.data['date'] }.compact.max || Time.at(0)
    end
  end
end

Liquid::Template.register_filter(Jekyll::HotTagsFilter)
