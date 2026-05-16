# Jekyll 插件：自动为 Markdown 中的图片路径添加 baseurl
# 将此文件放在 _plugins 目录下

module Jekyll
  module AddBaseurlFilter
    # 为内容中的所有图片路径添加 baseurl
    def add_baseurl_to_images(content)
      baseurl = @context.registers[:site].config['baseurl'] || ''
      
      # 匹配 Markdown 图片语法: ![alt](path)
      # 只为以 / 开头的绝对路径添加 baseurl
      content.gsub(/!\[([^\]]*)\]\((\/[^)]+)\)/) do
        alt = $1
        path = $2
        "![#{alt}](#{baseurl}#{path})"
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::AddBaseurlFilter)
