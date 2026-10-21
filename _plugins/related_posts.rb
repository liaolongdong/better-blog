# Build-time related posts (SP5 · 相关阅读 2.0)
#
# 旧实现（_layouts/post.html）按「共享任一 tag 的最近 3 篇」取，等于把
# `开源` / `AI` / `JavaScript` 这种大 tag 的权重和 `Impeccable` 这种小 tag 当成一样。
# 语料里 `开源` 有 36 篇、`AI` 27 篇，结果页自然被最近的大类文章填满。
#
# 这里在构建期算一次 IDF：df 越小，tag 越能区分两篇；再叠同分类 / 同合集的
# 加成，最后用发布日期做同分兜底。输出直接挂在每篇文档的 `related` 上，
# 模板仍然服务端渲染，不引入运行时请求，也不依赖 search.json 的客户端逻辑。
#
# 为什么不用 Liquid：Liquid 没有 log / sqrt，也没有跨文章的 df 聚合；放在插件里
# 还能保证「新文章一进来，相关阅读自动重算」，不需要再维护一份手写数据文件。
module Jekyll
  # Jekyll 4 自带 Jekyll::RelatedPosts（site.related_posts 用的类），同名会撞成
  # "RelatedPosts is not a module"。这里的命名只为本插件服务。
  module BetterRelatedPosts
    MAX = 5
    MIN_FILL = 3
    CATEGORY_BOOST = 1.5
    SERIES_BOOST = 3.0

    # tags 在 front matter 里既可能是空格分隔的字符串，也可能是数组；
    # 统一按 Jekyll 的语料口径拆开，空串与重复项先剔掉。
    def self.tags_of(doc)
      Array(doc.data['tags'])
        .flat_map { |tag| tag.to_s.split(/\s+/) }
        .reject(&:empty?)
        .uniq
    end

    def self.categories_of(doc)
      Array(doc.data['categories']).map(&:to_s).reject(&:empty?)
    end

    def self.build(site)
      posts = site.posts.docs
      return if posts.empty?

      df = Hash.new(0)
      posts.each do |post|
        tags_of(post).each { |tag| df[tag] += 1 }
      end

      idf = {}
      df.each { |tag, n| idf[tag] = Math.log((posts.size + 1.0) / (n + 1.0)) + 1.0 }

      norm = {}
      posts.each do |post|
        tags = tags_of(post)
        norm[post.url] = Math.sqrt(tags.sum { |tag| idf[tag] * idf[tag] })
      end

      series_of = {}
      Array(site.data['series']).each do |series|
        Array(series['order']).each { |url| series_of[url] = series['slug'] || series['title'] }
      end

      posts.each do |post|
        post_tags = tags_of(post)
        post_cat = categories_of(post).first
        post_series = series_of[post.url]

        scored = posts.each_with_object([]) do |cand, rows|
          next if cand.url == post.url

          cand_tags = tags_of(cand)
          shared = post_tags & cand_tags
          score = 0.0

          unless shared.empty? || norm[post.url].zero? || norm[cand.url].zero?
            score += shared.sum { |tag| idf[tag] } / (norm[post.url] * norm[cand.url])
          end
          score += CATEGORY_BOOST if post_cat && categories_of(cand).first == post_cat
          score += SERIES_BOOST if post_series && series_of[cand.url] == post_series

          rows << [cand, score]
        end

        # 同分时先新后旧，最后用 URL 兜底，保证同一份语料每次构建顺序一致。
        scored.sort_by! { |cand, score| [-score, -cand.date.to_i, cand.url] }
        picked = scored.select { |_, score| score.positive? }.first(MAX).map(&:first)

        if picked.size < MIN_FILL
          seen = picked.map(&:url)
          fillers = posts.reject { |cand| cand.url == post.url || seen.include?(cand.url) }
          same_cat = fillers.select { |cand| post_cat && categories_of(cand).first == post_cat }
          fillers = (same_cat + fillers).uniq
          # site.posts.docs 是按日期升序的；兜底要「最新的」，所以这里显式倒排，
          # 不能依赖集合的原始顺序。URL 仍做同分兜底，保证构建可复现。
          fillers.sort_by! { |cand| [-cand.date.to_i, cand.url] }
          picked.concat(fillers.first(MIN_FILL - picked.size))
        end

        post.data['related'] = picked.first(MAX).map do |cand|
          {
            'url' => cand.url,
            'title' => cand.data['title'],
            'date' => cand.date.strftime('%Y-%m-%d'),
            'tag' => tags_of(cand).first
          }
        end
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  Jekyll::BetterRelatedPosts.build(site)
end
