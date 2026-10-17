# Jekyll 插件：自动为 Markdown 中的图片路径添加 baseurl
# 将此文件放在 _plugins 目录下

module Jekyll
  module AddBaseurlFilter
    # 为内容中的所有图片路径添加 baseurl
    def add_baseurl_to_images(content)
      baseurl = @context.registers[:site].config['baseurl'] || ''

      # 代码块先扣出来再改写。kramdown 把围栏里的 `![alt](path)` 原样排成正文字符，
      # 下面两条 gsub 一样会命中它 —— 于是「示例代码里的路径」被悄悄加上 baseurl，
      # 读者照抄下来反而是错的。扣出的片段一个字节不改，改写完成后原位回填。
      held, blocks = hold_code(content)
      unhold_code(rewrite_image_paths(held, baseurl), blocks)
    end

    # 去掉正文开头与文章标题重复的 H1
    #
    # 文章 banner 已经渲染过一次 page.title，而多数稿件的 Markdown 正文第一行
    # 又手写了一遍同名一级标题，导致同一标题在页面上出现两次。
    # 仅当正文*首个*块级元素就是 H1 且文本与标题完全相同（忽略标签与大小写）时才删除，
    # 否则原样返回，避免误删作者有意写下的副标题式 H1。
    # @param content [String] 渲染后的 HTML 正文
    # @param title [String] 文章标题
    # @return [String] 处理后的正文
    def strip_leading_title(content, title)
      return content if content.nil? || title.nil?

      body = content.lstrip
      match = body.match(/\A<h1\b[^>]*>(.*?)<\/h1>/im)
      return content unless match

      inner = match[1].gsub(/<[^>]+>/, '').gsub('&amp;', '&').strip
      return content unless inner.casecmp(title.to_s.strip).zero?

      body[match[0].length..-1].to_s.lstrip
    end

    # 统计正文的「字数」，用于文章页的阅读时长
    #
    # 中文语境下的字数不含空白，因此先剥掉标签与 HTML 实体，再移除所有空白；
    # kramdown 会为每行输出缩进，若只按字符数粗算会明显虚高。
    # @param content [String] 渲染后的 HTML 正文
    # @return [Integer] 非空白字符数
    def char_count(content)
      return 0 if content.nil?

      content.gsub(/<[^>]*>/, '')
             .gsub(/&(?:[a-zA-Z]+|#\d+);/, '')
             .gsub(/\s+/, '')
             .length
    end

    private

    # 按出现顺序扣出 <pre> / <code> 区间，返回 [占位文本, 片段数组]
    def hold_code(content)
      blocks = []
      held = content.gsub(%r{<(?:pre|code)\b[^>]*>.*?</(?:pre|code)>}mi) do |block|
        blocks << block
        "@@jekyll-baseurl-held-#{blocks.length - 1}@@"
      end
      [held, blocks]
    end

    def unhold_code(content, blocks)
      content.gsub(/@@jekyll-baseurl-held-(\d+)@@/) { blocks[Regexp.last_match(1).to_i] }
    end

    # 两条改写：Markdown 图片语法 + HTML img 标签的 src
    def rewrite_image_paths(content, baseurl)
      content = content.gsub(/!\[([^\]]*)\]\(([^)]+)\)/) do
        alt = $1
        path = resolve_path($2, baseurl)
        "![#{alt}](#{path})"
      end

      # `src\s*=\s*` 而不是 `src=`：`<img src = "x">` 是合法 HTML，写死等号会整条不命中，
      # 那张图因此带着没前缀的路径上线，在 /better-blog 下 404。
      content = content.gsub(/<img\s+([^>]*?)src\s*=\s*["']([^"']*?)["']([^>]*?)>/i) do
        before_src = $1
        src = resolve_path($2, baseurl)
        after_src = $3
        "<img #{before_src}src=\"#{src}\"#{after_src}>"
      end

      content
    end

    # 单条图片路径的归一：外链原样返回；./ ../ 折成绝对路径；缺前缀的补 baseurl
    def resolve_path(raw, baseurl)
      # 跳过外部 URL（http://、https://、//、data: 等）
      return raw if raw.start_with?('http://', 'https://', '//', 'data:')

      # 移除开头的 ./ 和 ../ 前缀，统一转换为绝对路径
      # 例如: ./../assets/img/xxx.png -> /assets/img/xxx.png
      # 例如: ../assets/img/xxx.png -> /assets/img/xxx.png
      # 例如: ./assets/img/xxx.png -> /assets/img/xxx.png
      path = raw
      while path.start_with?('./') || path.start_with?('../')
        if path.start_with?('./')
          path = path[2..-1]  # 移除 ./
        elsif path.start_with?('../')
          path = path[3..-1]  # 移除 ../
        end
      end

      # 确保路径以 / 开头
      path = '/' + path unless path.start_with?('/')

      # 为相对路径添加 baseurl，但如果已经包含 baseurl 则跳过
      already_prefixed?(path, baseurl) ? path : "#{baseurl}#{path}"
    end

    # 「已经带过 baseurl」要认到 `/` 这一格边界：baseurl 是 /better-blog 时，
    # /better-blog-assets/a.png 是另一条路径，不是带过前缀的同一条 —— 只比 start_with?
    # 会把它当成带过而漏掉前缀，图照样 404。
    def already_prefixed?(path, baseurl)
      baseurl.empty? || path == baseurl || path.start_with?("#{baseurl}/")
    end
  end
end

Liquid::Template.register_filter(Jekyll::AddBaseurlFilter)
