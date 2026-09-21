# Jekyll 插件：自动为 Markdown 中的图片路径添加 baseurl
# 将此文件放在 _plugins 目录下

module Jekyll
  module AddBaseurlFilter
    # 为内容中的所有图片路径添加 baseurl
    def add_baseurl_to_images(content)
      baseurl = @context.registers[:site].config['baseurl'] || ''
      
      # 先处理 Markdown 图片语法: ![alt](path)
      content = content.gsub(/!\[([^\]]*)\]\(([^)]+)\)/) do
        alt = $1
        path = $2
        
        # 跳过外部 URL（http://、https://、//、data: 等）
        if path.start_with?('http://', 'https://', '//', 'data:')
          "![#{alt}](#{path})"
        else
          # 移除开头的 ./ 和 ../ 前缀，统一转换为绝对路径
          # 例如: ./../assets/img/xxx.png -> /assets/img/xxx.png
          # 例如: ../assets/img/xxx.png -> /assets/img/xxx.png
          # 例如: ./assets/img/xxx.png -> /assets/img/xxx.png
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
          if path.start_with?(baseurl)
            "![#{alt}](#{path})"
          else
            "![#{alt}](#{baseurl}#{path})"
          end
        end
      end
      
      # 再处理 HTML img 标签中的 src 属性
      content = content.gsub(/<img\s+([^>]*?)src=["']([^"']*?)["']([^>]*?)>/i) do
        before_src = $1
        src = $2
        after_src = $3
        
        # 跳过外部 URL（http://、https://、//、data: 等）
        if src.start_with?('http://', 'https://', '//', 'data:')
          "<img #{before_src}src=\"#{src}\"#{after_src}>"
        else
          # 处理相对路径：移除开头的 ./ 和 ../ 前缀
          original_src = src
          while src.start_with?('./') || src.start_with?('../')
            if src.start_with?('./')
              src = src[2..-1]  # 移除 ./
            elsif src.start_with?('../')
              src = src[3..-1]  # 移除 ../
            end
          end
          
          # 确保路径以 / 开头
          src = '/' + src unless src.start_with?('/')
          
          # 只为以 / 开头的相对路径添加 baseurl（排除绝对路径、协议相对路径和已包含 baseurl 的路径）
          if src.start_with?('/') && !src.start_with?('//') && !src.start_with?(baseurl)
            "<img #{before_src}src=\"#{baseurl}#{src}\"#{after_src}>"
          else
            "<img #{before_src}src=\"#{src}\"#{after_src}>"
          end
        end
      end
      
      content
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
  end
end

Liquid::Template.register_filter(Jekyll::AddBaseurlFilter)
