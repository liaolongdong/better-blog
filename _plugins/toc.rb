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
        level = match[1].downcase
        attrs = match[2].to_s
        id = attrs[ID_ATTR, 1]
        # 与 editorial.js:256-257 逐字对齐：id = 'section-' + (i + 1)，i 数的是所有 h2/h3。
        replacement =
          if id.to_s.empty?
            id = "section-#{index + 1}"
            "<#{match[1]} id=\"#{id}\"#{attrs}>#{match[3]}</#{match[1]}>"
          else
            match[0]
          end
        # 补 id 与收条目共用同一个 index：分两趟数就会让 href 与正文 id 错开一格。
        entries << { 'level' => level, 'id' => id, 'text' => plain_text(match[3]) }
        replacement
      end
      # 不足两节要写 nil 而不是 []：空数组在 Liquid 里是 truthy，{%- if page.toc -%} 会进块并渲染空框。
      doc.data['toc'] = entries.size >= MIN_HEADINGS ? entries : nil
    end
  end
end
