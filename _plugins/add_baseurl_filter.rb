# Jekyll 插件：自动为 Markdown 中的图片路径添加 baseurl
# 将此文件放在 _plugins 目录下

module Jekyll
  module AddBaseurlFilter
    # 为内容中的所有图片路径添加 baseurl
    def add_baseurl_to_images(content)
      baseurl = @context.registers[:site].config['baseurl'] || ''
      
      # 先处理 Markdown 图片语法: ![alt](path)
      content = content.gsub(/!\[([^\]]*)\]\((\.?\/[^)]+)\)/) do
        alt = $1
        path = $2
        # 如果路径以 ./ 开头，移除 ./ 保留 /
        path = path.sub(/^\.\//, '/') if path.start_with?('./')
        # 为以 / 开头的相对路径添加 baseurl
        "![#{alt}](#{baseurl}#{path})"
      end
      
      # 再处理 HTML img 标签中的 src 属性
      content = content.gsub(/<img\s+([^>]*?)src=["']([^"']*?)["']([^>]*?)>/i) do
        before_src = $1
        src = $2
        after_src = $3
        
        # 只为以 / 开头的相对路径添加 baseurl（排除绝对路径和协议相对路径）
        if src.start_with?('/') && !src.start_with?('//')
          "<img #{before_src}src=\"#{baseurl}#{src}\"#{after_src}>"
        else
          "<img #{before_src}src=\"#{src}\"#{after_src}>"
        end
      end
      
      content
    end
  end
end

Liquid::Template.register_filter(Jekyll::AddBaseurlFilter)
