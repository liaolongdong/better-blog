# Jekyll 插件：给正文里的 <img> 补上固有尺寸与懒加载
#
# 为什么需要它：产物里 1355 个 <img> 没有一个带 width/height（实测 0/1355），
# 浏览器在拿到图片字节之前只能按 0 高度占位，图一到就整页往下顶——这是 CLS
# 最直接的一笔来源；同时 1104 个 <img> 没有 loading，正文里几十张长截图会
# 在首屏一起排队下载。
#
# 为什么做成构建期读文件头、而不是让人手写：66 篇稿子里的图是逐步补进来的，
# 要求作者为每张图手抄两个数字必然漏，而且改一次图就要改一次稿。构建期直接从
# 图片字节里读，永远不会和真实尺寸不一致。
#
# 为什么放在插件里而不是 Ruby filter 之外的预处理脚本：_plugins 下的文件由
# Jekyll 自己加载，CI（GitHub Pages 构建）不需要额外装 Pillow/ImageMagick 之类
# 的本地依赖，读文件头是纯 Ruby。
module Jekyll
  # 从图片文件头读出固有宽高（不依赖任何第三方 gem）
  module ImageDims
    # 一次最多读这么多字节：PNG/GIF/WebP 的头在前 32 字节内，
    # JPEG 的 SOF 段理论上可以很靠后（前面塞满 EXIF/缩略图），留够余量。
    HEAD_BYTES = 256 * 1024

    class << self
      # @param abs_path [String] 图片的绝对路径
      # @return [Array(Integer, Integer), nil] [宽, 高]，认不出格式时返回 nil
      def read(abs_path)
        data = File.binread(abs_path, HEAD_BYTES)
        dims_for(abs_path, data)
      rescue StandardError
        nil
      end

      private

      # @param abs_path [String] 用于按扩展名兜底判断 SVG（它没有固定字节签名）
      # @param data [String] 以 ASCII-8BIT 读到的文件头
      def dims_for(abs_path, data)
        return png(data)   if data[0, 8] == PNG_SIG
        return gif(data)   if %w[GIF87a GIF89a].include?(data[0, 6])
        return jpeg(data)  if data[0, 2] == "\xFF\xD8".b
        return webp(data)  if data[0, 4] == 'RIFF' && data[8, 4] == 'WEBP'
        return bmp(data)   if data[0, 2] == 'BM'
        return svg(data)   if abs_path.end_with?('.svg') || data[0, 5] == '<?xml'
        nil
      end

      PNG_SIG = "\x89PNG\r\n\x1A\n".b.freeze

      # PNG：IHDR 数据段里第 16..19 字节是宽、20..23 是高（大端）
      def png(data)
        w = data[16, 4]&.unpack1('N')
        h = data[20, 4]&.unpack1('N')
        w && h && w > 0 && h > 0 ? [w, h] : nil
      end

      # GIF：逻辑屏幕描述符里第 6..7 字节是宽、8..9 是高（小端）
      def gif(data)
        w = data[6, 2]&.unpack1('v')
        h = data[8, 2]&.unpack1('v')
        w && h && w > 0 && h > 0 ? [w, h] : nil
      end

      # BMP：DIB 头里第 18..21 字节是宽、22..25 是高（小端有符号，
      # 负高表示自上而下的行序，取绝对值才是渲染尺寸）。
      # 站内确实有一个 .png 后缀、BM 文件头的文件（official_account_qrcode.png），
      # 浏览器按文件头嗅探成 BMP 正常显示，所以这里按 BM 头判、不看扩展名。
      def bmp(data)
        w = data[18, 4]&.unpack1('V')
        h = data[22, 4]&.unpack1('l')
        return nil unless w && h

        h = h.abs
        w > 0 && h > 0 ? [w, h] : nil
      end

      # JPEG：扫描段找 SOF0~SOF15（跳过 DHT/C4、JPG/C8、DAC/CC），
      # 段里第 3..4 字节是高、5..6 字节是宽（大端）——注意先高后宽。
      def jpeg(data)
        i = 2
        limit = data.bytesize - 9
        while i < limit
          next i += 1 unless data.getbyte(i) == 0xFF

          marker = data.getbyte(i + 1)
          next i += 1 if marker == 0xFF        # 连续的填充字节
          break if marker == 0xDA              # SOS：压缩数据开始，后面再没有头信息
          break if marker == 0xD9              # EOI

          if (0xC0..0xCF).cover?(marker) && !(0xC4 == marker || 0xC8 == marker || 0xCC == marker)
            h = data[i + 5, 2]&.unpack1('n')
            w = data[i + 7, 2]&.unpack1('n')
            return w && h && w > 0 && h > 0 ? [w, h] : nil
          end

          len = data[i + 2, 2]&.unpack1('n')
          break unless len

          i += 2 + len
        end
        nil
      end

      # WebP 三种子格式：RIFF(12) + FourCC(4) + 块 FourCC(4) + 块长度(4)，
      # 所以块数据从第 20 字节开始。
      def webp(data)
        case data[12, 4]
        when 'VP8X' # 扩展格式：第 24..26 字节是画布宽-1，27..29 是高-1（24 位小端）
          w = le24(data, 24)
          h = le24(data, 27)
          w && h ? [w + 1, h + 1] : nil
        when 'VP8L' # 无损：第 20 字节是 0x2F 签名，21..24 里各塞了 14 位的宽-1 / 高-1
          bits = data[21, 4]&.unpack1('V')
          return nil unless bits

          [((bits & 0x3FFF)) + 1, ((bits >> 14) & 0x3FFF) + 1]
        when 'VP8 ' # 有损：关键帧头里第 26..27 / 28..29 字节各取低 14 位
          w = data[26, 2]&.unpack1('v')
          h = data[28, 2]&.unpack1('v')
          w && h ? [w & 0x3FFF, h & 0x3FFF] : nil
        end
      end

      def le24(data, at)
        bytes = data[at, 3]
        return nil unless bytes && bytes.bytesize == 3

        bytes.getbyte(0) | (bytes.getbyte(1) << 8) | (bytes.getbyte(2) << 16)
      end

      # SVG：优先用 width/height 属性，退到 viewBox 的后两个数。
      # 带百分号或 em 之类单位的、或者只有 viewBox 没有数值的，一律不猜。
      def svg(data)
        text = data.force_encoding('UTF-8')
        text = text.valid_encoding? ? text : text.dup.force_encoding('BINARY')
        root = text[/<svg\b[^>]*>/im]
        return nil unless root

        w = root[/\bwidth\s*=\s*["']?\s*(\d+(?:\.\d+)?)\s*(px)?["']?/i, 1]
        h = root[/\bheight\s*=\s*["']?\s*(\d+(?:\.\d+)?)\s*(px)?["']?/i, 1]
        return [w.to_f.round, h.to_f.round] if w && h && w.to_f > 0 && h.to_f > 0

        box = root[/\bviewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/i]
        return nil unless box

        vw = box[3].to_f
        vh = box[4].to_f
        vw > 0 && vh > 0 ? [vw.round, vh.round] : nil
      rescue StandardError
        nil
      end
    end
  end

  # Liquid 滤镜
  module ImageDimsFilter
    SRC_RE = /\bsrc\s*=\s*(["'])(.*?)\1/i.freeze

    # 给内容里的 <img> 补 width/height、给非首图补 loading=lazy，并做两件事：
    #
    # 1. 构建期格式换源——同目录存在 .webp 兄弟就把 src 从 .png 换过去
    #    （scripts/build-image-variants.mjs 的产物）。为什么不做 <picture>：
    #    dev/js/editorial.js 那条揭示选择器是 `#post-body p:has(> img[loading="lazy"])`，
    #    `>` 是直接子级，把 img 包进 <picture> 之后这条再也匹配不到，已上线的揭示动效
    #    会**静默**消失，而 editorial.js 不在本批可动范围；webp 的基线（Safari 14+，
    #    2020-09）让 <source type="image/webp"> 那层回退在这里值约等于 0。
    #    换源不改变 DOM 形状，所以 motion 批 IV 与 article-check 的判据全部继续有效。
    # 2. mode 传 'lcp' 时，给这一次调用里的第一张 eager 图补 fetchpriority="high"。
    #    调用方自己知道哪一次是 LCP 候选（文章页有封面时是头图那次，没封面时是正文那次），
    #    滤镜没有这个上下文，所以由 _layouts/post.html 显式传进来。
    # 3. mode 传 'swap' 时只做换源，别的什么都不动。给「上一篇/下一篇」的封面缩略图用的：
    #    dev/js/index.js 的 postCover() 拿 img.height() 和容器高 260 比大小来决定
    #    走 width:auto 还是 margin-top 那条分支，而 CSS 里那两颗 img 起手是 display:none，
    #    量到的是 0。补上 width/height 属性会让它突然量到 592，分支就此翻边——
    #    那是视觉改动，不在本批范围，所以这里只肯换 src 那一截。
    #
    # 只处理「解析得到站内文件」的图：外链（http/https/协议相对）、data: URI、
    # 以及模板里拼出来的动态 src 一律原样放过——构建期读不到它们的尺寸。
    #
    # 首图不加 lazy：没有封面的文章里，正文第一张图就是 LCP 候选，
    # 给它加懒加载等于亲手把 LCP 往后推。
    #
    # @param content [String] 渲染后的 HTML（须已 over add_baseurl_to_images，
    #   这样 src 才带 baseurl、能还原成磁盘路径）
    # @param mode [String, nil] 'lcp' 给首张 eager 图补提权；'swap' 只换源
    # @return [String]
    def add_image_dims(content, mode = nil)
      return content if content.nil? || content.empty?

      site = @context.registers[:site]
      baseurl = site.config['baseurl'].to_s
      source = site.source
      lcp = mode.to_s == 'lcp'
      swap_only = mode.to_s == 'swap'
      seen = 0

      content.gsub(%r{<img\b[^>]*?/?>}i) do |tag|
        attrs = +''
        has_w = tag.match?(/\bwidth\s*=/i)
        has_h = tag.match?(/\bheight\s*=/i)
        m = tag.match(SRC_RE)
        src = m && m[2]

        webp = m && webp_sibling(m[2], baseurl, source)
        if webp
          tag = tag[0, m.begin(0)] + "src=#{m[1]}#{webp}#{m[1]}" + tag[m.end(0)..]
        end
        next tag if swap_only

        dims = nil
        if src && !src.strip.empty? && !src.match?(%r{\A(?:https?:)?//|data:|\{\{|\{%|\$\{}) && !(has_w && has_h)
          path = local_path(src, baseurl)
          if path
            abs = File.join(source, path)
            dims = File.file?(abs) ? ImageDims.read(abs) : nil
          end
        end

        unless has_w && has_h
          if dims
            attrs << format(' width="%<w>d" height="%<h>d"', w: dims[0], h: dims[1])
          elsif has_w ^ has_h
            # 只写了一半尺寸：不猜，留着，免得补一个错值把比例彻底带歪
          end
        end

        eager = !tag.match?(/\bloading\s*=/i)
        attrs << ' fetchpriority="high"' if lcp && seen.zero? && eager && !tag.match?(/\bfetchpriority\s*=/i)

        seen += 1
        attrs << ' loading="lazy" decoding="async"' if dims && seen > 1 && eager

        next tag if attrs.empty?

        # 把属性插进标签：先剥掉自闭合的 />，补完再加回去
        closed = tag.match?(%r{/\>\s*\z})
        body = tag.sub(%r{\s*/?\>\s*\z}, '')
        "#{body}#{attrs}#{closed ? ' />' : '>'}"
      end
    end

    private

    # 同目录 .webp 兄弟存在时，返回「把 src 里的 .png 换成 .webp」后的新 src，否则 nil。
    #
    # 返回的是 src 本身而不是磁盘相对路径，因为 src 带着 baseurl 前缀，而这一串要原样
    # 写回 HTML。写成站内相对路径会在项目站点（baseurl=/better-blog）上变成 404：
    # 实测过，27 个换源后的 src 全部少了那一段前缀。
    #
    # @param src [String] img 的原始 src
    # @param baseurl [String]
    # @param source [String] 仓库根
    # @return [String, nil]
    def webp_sibling(src, baseurl, source)
      return nil if src.nil? || src.strip.empty?
      return nil if src.match?(%r{\A(?:https?:)?//|data:|\{\{|\{%|\$\{})

      path = local_path(src, baseurl)
      return nil unless path&.end_with?('.png')

      webp = File.join(source, path.sub(/\.png\z/, '.webp'))
      return nil unless File.file?(webp)

      src.sub(/\.png(?=([?#]|\z))/i, '.webp')
    end

    # 把 src 还原成相对仓库根目录的路径；不是站内根相对路径就返回 nil
    # @param src [String]
    # @param baseurl [String]
    # @return [String, nil]
    def local_path(src, baseurl)
      path = src.split('?').first.to_s.split('#').first.to_s
      return nil unless path.start_with?('/')

      path = path[baseurl.length..-1].to_s if !baseurl.empty? && path.start_with?(baseurl)
      path.start_with?('/') ? path : nil
    end
  end
end

Liquid::Template.register_filter(Jekyll::ImageDimsFilter)
