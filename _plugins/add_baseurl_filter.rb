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
  end
end

Liquid::Template.register_filter(Jekyll::AddBaseurlFilter)
