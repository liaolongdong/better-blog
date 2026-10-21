Jekyll::Hooks.register :site, :post_read do |site|
  # CHANGELOG.md 是版本记录的唯一事实源：它没有 YAML 头，Jekyll 不渲染它，产物里读不到这个地址。
  # 这一钩子把它解析成 site.data.changelog，让 changelog.html 只做投影。
  # 手抄一份 YAML 等于养第二份事实源——每次发版要同步两处，漏一次页面就开始说谎。
  src = File.join(site.source, 'CHANGELOG.md')
  site.data['changelog'] = BBChangelog.parse(src)
end

# CHANGELOG.md 的构建期解析器。判据只有一条：不合形状的标题必须留下痕迹给门禁判红，
# 不许静默少渲染一个版本、也不许静默少渲染一行正文。
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
      headings = 0
      # nil = 不在代码围栏里；否则是「围栏内已收到的行」。围栏内容不是结构，但也不许消失：
      # 闭合时整块交给 md()，页面渲染成一个 <pre>。
      fence = nil

      text.each_line do |raw|
        line = raw.chomp

        if line =~ /\A\s*(?:`{3,}|~{3,})/
          if fence
            # 闭合行只当分隔符，不进代码内容；版本块还没出现时无处可挂（文件头的引言本来就不上页面）。
            section = append_item(entry, section, fenced_markdown(fence)) if entry
            fence = nil
          else
            fence = []
          end
          next
        end
        if fence
          fence << line
          next
        end

        # 没有这道屏蔽时，围栏里写一句 `## 9.9.9 — 2030-01-01` 会生出幽灵版本，
        # 并把其后的真条目并进它（实测），而只数 ^## 的判据照样绿。
        if (m = line.match(/\A##\s+(.+?)\s*\z/))
          headings += 1
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

        # 写成 `####+` 而不是 `#{4,}`：正则字面量里的 `#{` 是字符串插值，
        # 那个写法直接让插件语法错误、整站构建挂掉（实测）。
        if (m = line.match(/\A(####+)\s+(.+?)\s*\z/))
          # 四级以上标题不认识，但一个字都不许丢：留一条警告，文字按普通条目上页面。
          # 小节归属不变——它是 H3 之下的子标题，后面的列表仍该挂在原小节里。
          warnings << "版本块里出现 #{m[1].length} 级标题，按普通条目渲染：#{m[2]}"
          section = append_prose(entry, section, m[2])
          next
        end

        if (m = line.match(/\A###\s+(.+?)\s*\z/))
          section = { 'title' => m[1], 'items' => [] }
          entry['sections'] << section
          next
        end

        # 列表项认全：`-`、`*`、`+`、`1.`、`1)`。旧版只认前两种，于是 `+ 这条`
        # 和 `1. 这条` 在有小节时整行静默消失（实测）。
        if (m = line.match(/\A\s*(?:[-*+]|\d+[.)])\s+(.*)\z/))
          section = append_item(entry, section, m[1])
          next
        end

        # 两格缩进是上一条列表项的续行；没有可续的对象时按普通正文走下面的兜底。
        if line =~ /\A\s{2,}\S/ && section && section['items'].any?
          section['items'][-1] += ' ' + line.strip
          next
        end

        next if line =~ /\A\s*\z/

        # 到这儿的是「版本块里一段不认识的正文」。旧版只在小节为空时收进 lede，
        # 有小节之后就无人认领、整行丢弃（实测）。这一页丢一行字没有任何症状，
        # 所以兜底宁可多收：有地方挂就挂上，实在没有进 lede。
        section = append_prose(entry, section, line.strip)
      end

      if fence
        warnings << "代码围栏未闭合，末尾 #{fence.length} 行按正文收下"
        append_item(entry, section, fenced_markdown(fence)) if entry
      end
      entries.each { |e| render_entry(e) }
      { 'entries' => entries, 'warnings' => warnings,
        'headings' => headings }
    end

    # 列表项必须有归宿：没有当前小节就挂到上一个无主小节，一个都没有则新建无主小节
    # （2.0.1 整条版本就是「lede + 裸列表、一个 ### 也没有」，实测 9 条）。
    # 返回调用方该当作「当前小节」的对象。
    def append_item(entry, section, text)
      target = section
      unless target
        target = entry['sections'][-1]
        unless target && target['title'].nil?
          target = { 'title' => nil, 'items' => [] }
          entry['sections'] << target
        end
      end
      target['items'] << text
      target
    end

    # 非列表的正文行：有地方挂就挂上，小节还没出现时进 lede（这是页面开头那句的来路）。
    def append_prose(entry, section, text)
      return append_item(entry, section, text) if section

      entry['lede'] << text
      nil
    end

    # 围栏内容原样交回 kramdown。必须用 `~~~` 而不是 ```：这一版 kramdown 的默认输入
    # 把 ``` 块解析成段内 <code>（实测 `<p><code>` 且没有 <pre>），只有 ~~~ 才得到 <pre>。
    def fenced_markdown(lines)
      body = lines.dup
      body.pop while body.last =~ /\A\s*\z/
      "~~~\n#{body.join("\n")}\n~~~"
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

      html = sanitize(Kramdown::Document.new(str.strip).to_html)
      # 必须把匹配结果存进局部变量：下面 single_block? 里的 scan 会重置 Regexp.last_match，
      # 直接写 $1 或 last_match(1) 拿到的是 scan 的最后一格（实测是 nil，构建当场抛异常）。
      one = html.match(%r{\A<p>(.*)</p>\s*\z}m)
      html = one[1] if one && single_block?(html)
      html.gsub(%r{href="\./([^"]+?\.md)"}) { %(href="#{BLOB_BASE}#{Regexp.last_match(1)}") }
    end

    # 条目里**不许有原始 HTML**。为什么不能只删「危险标签名」：那种摘壳会把壳里的东西放出来——
    # 实测 `<script><img src=x onerror=alert(1)></script>` 摘掉 script 之后剩下一个活的
    # `<img onerror>`；而 `<div onclick="alert(2)">` 根本不在危险名单里，整块原样透传。
    # 所以这里是白名单式的：先连内容一起删掉绝不该出现在散文里的元素，再把不在名单内的标签
    # 一律摘掉（内容留成文本），最后给幸存的 `<a>` 只留一个协议安全的 href。
    DANGEROUS_WITH_CONTENT = %r{<(script|style|iframe|object|embed|form|textarea|noscript|template)\b[^>]*>[\s\S]*?(?:</\1\s*>|\z)}i
    ORPHAN_DANGEROUS = %r{</?\s*(script|style|iframe|object|embed|form|textarea|noscript|template|frame|frameset|link|meta|base|svg|math)\b[^>]*>}i
    KEEP_TAG = %r{\A/?\s*(p|br|hr|strong|b|em|i|code|pre|kbd|sup|sub|del|ins|ul|ol|li|blockquote|a)\z}i
    # href 用协议黑名单而不是白名单：这一页合法地会出现 `./USAGE.md` 这类仓库视角的相对地址
    # （下面还要把它改写成 blob 链接），白名单会顺手把它杀成一枚没有出路的 `<a>`——实测如此。
    DANGEROUS_HREF = %r{\A\s*(?:javascript|data|vbscript|file\s*:|about)\s*:}i

    def sanitize(html)
      out = html.gsub(DANGEROUS_WITH_CONTENT, '').gsub(ORPHAN_DANGEROUS, '')
      # 幸存的标签一律**只留标签名**（属性是事件处理器的藏身处），只有 <a> 例外：
      # 它带一个过完协议的 href，且 href 里的引号先转义掉，免得自己把属性值闭合出去。
      out.gsub(%r{<(/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>}i) do
        slash, name, attrs = Regexp.last_match(1), Regexp.last_match(2), Regexp.last_match(3)
        next '' unless KEEP_TAG.match?("#{slash}#{name}")
        if name.casecmp('a').zero? && slash.empty?
          m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.match(attrs)
          href = m && (m[1] || m[2])
          href && !DANGEROUS_HREF.match?(href) ? %(<a href="#{href.gsub('"', '&quot;')}">) : '<a>'
        else
          "<#{slash}#{name}>"
        end
      end
    end

    # 只把「整段就是一个 <p>」的那一种收成行内 HTML；含列表、代码块或多段的保留外层结构。
    def single_block?(html)
      html.scan(/<p>/).length == 1 && !html.include?('<ul') && !html.include?('<pre')
    end
  end
end
