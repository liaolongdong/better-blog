# Jekyll 插件：把仓库根的 demo.json 暴露给 Liquid（site.data.demoLists）
#
# 为什么需要它：_data 之外的 JSON 不会被 Jekyll 自动读进来，而 demo 列表的数据源
# 一直是仓库根的 demo.json——它同时是对外发布的机器可读清单（_site/demo.json），
# 挪进 _data 就会丢掉这个公开地址。所以在这里挂一次，两边共用同一份文件。
#
# 为什么放在 :pre_render：站点渲染前把数据塞进 site.data，页面与文章都能读到，
# 不需要任何第三方 gem（GitHub Pages 构建同样加载 _plugins 下的文件）。
require 'json'

module Jekyll
  module DemoData
    Jekyll::Hooks.register :site, :pre_render do |site|
      file = File.join(site.source, 'demo.json')
      next unless File.file?(file)

      lists = JSON.parse(File.read(file, encoding: 'UTF-8'))['demoLists']
      site.data['demoLists'] = lists if lists.is_a?(Array)
    rescue StandardError => e
      Jekyll.logger.warn 'DemoData:', "demo.json 解析失败，demo.html 将退化为空列表（#{e.message}）"
    end
  end
end
