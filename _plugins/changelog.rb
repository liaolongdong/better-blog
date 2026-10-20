Jekyll::Hooks.register :site, :post_read do |site|
  # CHANGELOG.md 是版本记录的唯一事实源：它没有 YAML 头，Jekyll 不渲染它，产物里读不到这个地址。
  # 这一钩子把它解析成 site.data.changelog，让 changelog.html 只做投影。
  # 手抄一份 YAML 等于养第二份事实源——每次发版要同步两处，漏一次页面就开始说谎。
  src = File.join(site.source, 'CHANGELOG.md')
  site.data['changelog'] = BBChangelog.parse(src)
end

# CHANGELOG.md 的构建期解析器。判据只有一条：不合形状的标题必须留下痕迹给门禁判红，
# 不许静默少渲染一个版本。
module BBChangelog
  # 页面住在 /better-blog/changelog.html，而 CHANGELOG.md 里的 ./USAGE.md 是「仓库视角」的
  # 相对地址——浏览器会解成 /better-blog/USAGE.md，线上 404。改写进 GitHub 的 blob 视图，
  # 与 post.html 那条「查看这次修订」的 commit 链接同一个落点。
  BLOB_BASE = 'https://github.com/liaolongdong/better-blog/blob/master/'.freeze
  HEAD = /\A(\d+\.\d+\.\d+)\s*[—-]\s*(\d{4}-\d{2}-\d{2})\z/.freeze

  class << self
    def parse(path)
      return { 'entries' => [], 'warnings' => ['仓库根没有 CHANGELOG.md'], 'headings' => 0 } unless File.exist?(path)

      text = File.read(path, encoding: 'UTF-8')
      warnings = []
      entries = []
      entry = nil
      section = nil

      text.each_line do |raw|
        line = raw.chomp

        if (m = line.match(/\A##\s+(.+?)\s*\z/))
          head = m[1]
          if (vm = head.match(HEAD))
            entry = { 'version' => vm[1], 'date' => vm[2], 'title' => head,
                      'lede' => [], 'sections' => [] }
            entries << entry
            section = nil
          else
            warnings << "H2 标题不合「X.Y.Z — YYYY-MM-DD」形状，未渲染：#{head}"
            entry = nil
          end
          next
        end

        next if entry.nil?

        if (m = line.match(/\A###\s+(.+?)\s*\z/))
          section = { 'title' => m[1], 'items' => [] }
          entry['sections'] << section
          next
        end

        if (m = line.match(/\A[-*]\s+(.*)\z/))
          # 版本块里可以有不带 ### 的裸列表：给它一节空标题，页面按「无小节名」渲染。
          section ||= begin
            s = { 'title' => nil, 'items' => [] }
            entry['sections'] << s
            s
          end
          section['items'] << m[1]
          next
        end

        if line =~ /\A\s{2,}\S/ && section && section['items'].any?
          section['items'][-1] += ' ' + line.strip
          next
        end

        if line !~ /\A\s*\z/ && line !~ /\A[#\-*]/ && entry['sections'].empty?
          entry['lede'] << line.strip
        end
      end

      entries.each { |e| render_entry(e) }
      { 'entries' => entries, 'warnings' => warnings,
        'headings' => text.scan(/^##\s+.+$/).length }
    end

    def render_entry(e)
      e['lede'] = md(e['lede'].join(' '))
      e['sections'] = e['sections'].map do |s|
        # 必须写 `=>`：`'items':` 那种冒号写法产出的是符号键 `:items`，
        # Liquid 按字符串键读哈希，页面会拿到 nil（实测整页渲染出 0 行而无任何报错）。
        { 'title' => s['title'], 'items' => s['items'].map { |i| md(i) } }
      end
    end

    # 用 kramdown 默认的 Markdown 输入，不点 GFM：GFM 要 kramdown-parser-gfm 那颗 gem，
    # 而 CHANGELOG 只用到粗体、行内码与链接，默认输入全覆盖。
    def md(str)
      return '' if str.nil? || str.strip.empty?

      html = Kramdown::Document.new(str.strip).to_html
      # 块级原始 HTML 穿得过这台 kramdown：实测 `:remove_html_blocks` 取 true 与 "strip"
      # 都拦不住一个独立成块的 `<script>`，只有行内的尖括号会被转义成文本。
      # 而这一页的内容是发版时从 commit message 里粘出来的散文，本来就不该带 HTML 壳——
      # 把危险标签本身摘掉，被包着的东西降级成惰性文本，页面仍然是纯展示。
      # 行内那一半边不用管，kramdown 已经转义过了。
      html = html.gsub(%r{</?\s*(script|style|iframe|object|embed|form|frame|frameset|link|meta|base)\b[^>]*>}i, '')
      # 必须把匹配结果存进局部变量：下面 single_block? 里的 scan 会重置 Regexp.last_match，
      # 直接写 $1 或 last_match(1) 拿到的是 scan 的最后一格（实测是 nil，构建当场抛异常）。
      one = html.match(%r{\A<p>(.*)</p>\s*\z}m)
      html = one[1] if one && single_block?(html)
      html.gsub(%r{href="\./([^"]+?\.md)"}) { %(href="#{BLOB_BASE}#{Regexp.last_match(1)}") }
    end

    # 只把「整段就是一个 <p>」的那一种收成行内 HTML；含列表或多段的块保留外层结构。
    def single_block?(html)
      html.scan(/<p>/).length == 1 && !html.include?('<ul') && !html.include?('<pre')
    end
  end
end
