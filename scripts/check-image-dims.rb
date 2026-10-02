#!/usr/bin/env ruby
# encoding: utf-8
# _plugins/image_dims.rb 的单元门禁：换源 / 三档 mode / 六种文件头尺寸解码。
#
# 为什么不跑一遍 jekyll build：一次构建 90 秒上下，而这一层要喂的形状（外链、协议相对、
# data:、带 query、目录名里含 .png、已有尺寸、自闭合、单引号）在真实语料里凑不齐；
# 用桩目录直接调滤镜是毫秒级，形状想造多少造多少。
# 产物级的那半在 scripts/check-seo.mjs 的「换源」组（逐页比对 src / fetchpriority /
# width-height 成对），两边判据不互相替代：那一半看不见「尺寸数值算错」（补上去的
# width/height 只要成对就不红），这一半看不见「模板没调用滤镜」。
#
# 为什么纯 ruby 不要 bundle exec：这一本只 load 滤镜自己，而它不 require 任何 gem
# （文件头解释了为什么读文件头必须是纯 Ruby），Liquid 那一行注册用同名字段替掉就行。
#
# 用法：ruby scripts/check-image-dims.rb [仓库根] [被核验的 rb 路径]
# 退出：0 全绿 / 1 有红 / 2 夹具或环境不对（这时任何断言读数都不可信）
#
# 失败行统一以 `dims:` 开头，牙齿台账按这个前缀认「门禁真的跑了」。
#
# @param repo [String] 仓库根：读 _config.yml 的 baseurl 与 scripts/image-variants.json 的真实台账
# @param plugin [String] 被核验的 image_dims.rb（牙齿传变异后的副本）

require 'json'
require 'tmpdir'
require 'fileutils'
require 'yaml'

repo = ARGV[0] || Dir.pwd
plugin = ARGV[1] || File.join(repo, '_plugins/image_dims.rb')

# 声明的断言条数（S 组 25 + D 组 11）。加一条断言就改这一格——下面那道计数守卫靠它才有牙：
# 某一整块因为夹具缺失而被跳过时，红的必须是这一条，而不是「全绿」。
DECLARED = 36

# 夹具或环境不对时退 2，而不是退 1：退 1 在牙齿台账里算「门禁如期变红」，
# 可这时候一条断言都没跑，红得毫无意义。两类必须能分开。
def harness(msg)
  warn "dims: HARNESS ERROR #{msg}"
  exit 2
end

# ---- 现读事实：baseurl 与台账都不写死 ----
config = begin
  YAML.load_file(File.join(repo, '_config.yml'))
rescue StandardError => e
  harness "读不到 #{File.join(repo, '_config.yml')}：#{e.message}"
end
BASEURL = config['baseurl'].to_s
harness 'baseurl 为空，S 组断言全部失去意义' if BASEURL.empty?

LEDGER = begin
  m = JSON.parse(File.read(File.join(repo, 'scripts', 'image-variants.json')))
  m['variants'] || {}
rescue StandardError => e
  harness "读不到 scripts/image-variants.json：#{e.message}"
end

# 桩目录：滤镜的 source 指到这里，凡「磁盘上得有那个文件」的形状都在这里铺出来。
FX = Dir.mktmpdir('image-dims-fx')
at_exit { FileUtils.remove_entry(FX) rescue nil }

def fx(rel)
  abs = File.join(FX, rel)
  FileUtils.mkdir_p(File.dirname(abs))
  abs
end

def write_fx(rel, bytes)
  abs = fx(rel)
  File.binwrite(abs, bytes)
  abs
end

# PNG：签名(8) + IHDR 块头(8) 之后第 16..19 是宽、20..23 是高（大端）
def mk_png(w, h)
  "\x89PNG\r\n\x1A\n".b + "\x00\x00\x00\x0D".b + 'IHDR'.b +
    [w].pack('N') + [h].pack('N') + "\x08\x06\x00\x00\x00".b
end

# WebP 三种子格式各自的头（读法见滤镜里的 webp 方法）
def mk_webp_vp8x(w, h)
  'RIFF'.b + [0].pack('V') + 'WEBP'.b + 'VP8X'.b + [10].pack('V') +
    "\x00".b * 4 + [(w - 1) & 0xFF, ((w - 1) >> 8) & 0xFF, ((w - 1) >> 16) & 0xFF].pack('C3') +
    [(h - 1) & 0xFF, ((h - 1) >> 8) & 0xFF, ((h - 1) >> 16) & 0xFF].pack('C3')
end

def mk_webp_vp8l(w, h)
  bits = (w - 1) | ((h - 1) << 14)
  'RIFF'.b + [0].pack('V') + 'WEBP'.b + 'VP8L'.b + [4].pack('V') + "\x2F".b + [bits].pack('V')
end

def mk_webp_vp8(w, h)
  # 真实文件里那两枚 16 位字的高 2 位是缩放位（恒非 0），所以这里必须把它们也写上一枚，
  # 否则「掩掉 0x3FFF」那一支判据在桩字节上和没写一样，牙齿下刀也不会红。
  'RIFF'.b + [0].pack('V') + 'WEBP'.b + "VP8 ".b + [4].pack('V') +
    "\x00".b * 6 + [w | 0x8000].pack('v') + [h | 0x4000].pack('v')
end

def mk_gif(w, h)
  'GIF89a'.b + [w].pack('v') + [h].pack('v') + "\x00".b * 3
end

# BMP：'BM' + 16 字节填充，之后宽（uint32 LE）与高（int32 LE，负值=自上而下）
def mk_bmp(w, h)
  'BM'.b + "\x00".b * 16 + [w].pack('V') + [h].pack('l<')
end

# JPEG：SOI 后扫段找 SOF0；段内先 2 字节高、再 2 字节宽（大端）
def mk_jpeg(w, h, pad: false)
  body = +''
  body << "\xFF\xE0".b + [16].pack('n') + "\x00".b * 14          # APP0/JFIF：必须被跳过
  body << "\xFF\xDB".b + [4].pack('n') + "\x00".b * 2            # DQT：必须被跳过
  body << "\xFF\xC4".b + [4].pack('n') + "\x00".b * 2            # DHT：0xC4 在排除名单里
  body << "\xFF".b if pad                                       # 连续的填充字节要能跨过
  body << "\xFF\xC0".b + [17].pack('n') + "\x08".b + [h].pack('n') + [w].pack('n')
  body << "\xFF\xDA".b + [4].pack('n') + "\x00".b * 2            # SOS：再往后就不读了
  "\xFF\xD8".b + body
end

# 桩图片：a.png 有 webp 兄弟（同尺寸，换源不改版式的前提），b.png 没有，c.jpg 故意也配一个兄弟
FX_PNG = 'assets/img/fx/a.png'
FX_WEBP = 'assets/img/fx/a.webp'
write_fx(FX_PNG, mk_png(800, 600))
write_fx(FX_WEBP, mk_webp_vp8x(800, 600))
write_fx('assets/img/fx/b.png', mk_png(640, 480))
write_fx('assets/img/fx/c.jpg', mk_jpeg(320, 200))
write_fx('assets/img/fx/c.webp', mk_webp_vp8l(320, 200))
# 目录名里带 .png：只有「结尾锚定」的写法才换得对
write_fx('assets/img/fx/nested.png/d.png', mk_png(1024, 768))
write_fx('assets/img/fx/nested.png/d.webp', mk_webp_vp8(1024, 768))
# 协议相对外链的真身：守卫在滤镜里，磁盘上也得有这一对，否则删掉守卫也测不出来
write_fx('cdn.example.com/a.png', mk_png(400, 300))
write_fx('cdn.example.com/a.webp', mk_webp_vp8x(400, 300))

module Liquid
  class Template
    def self.register_filter(*)
      nil
    end
  end
end
load plugin

FakeSite = Struct.new(:config, :source)
FakeCtx = Struct.new(:registers)

class Tester
  include Jekyll::ImageDimsFilter

  # @param site [FakeSite] 只需要 config['baseurl'] 与 source 两格
  def initialize(site)
    @context = FakeCtx.new(site: site)
  end
end

t_repo = Tester.new(FakeSite.new({ 'baseurl' => BASEURL }, repo))
t_fx = Tester.new(FakeSite.new({ 'baseurl' => BASEURL }, FX))

$ran = 0
$fails = []

# @param id [String] 断言编号（牙齿按它认「红的是哪一条」）
# @param msg [String] 不成立时要印出的说明
def check(id, msg)
  $ran += 1
  $fails << "#{id} #{msg}" unless yield
end

src_fx = "#{BASEURL}/#{FX_PNG}"
src_nosib = "#{BASEURL}/assets/img/fx/b.png"
src_nested = "#{BASEURL}/assets/img/fx/nested.png/d.png"

# ---- S 组：换源与三档 mode ----
out = t_fx.add_image_dims(%Q{<p><img src="#{src_fx}" alt="x"></p>})
check('S1', "有兄弟时必须换成「带 baseurl 的」webp：#{out}") do
  out.include?(%Q{src="#{BASEURL}/#{FX_WEBP}"})
end
check('S1b', "包裹元素一个字不动：#{out}") { out.include?('<p>') && out.include?('</p>') }

out = t_fx.add_image_dims(%Q{<img src="#{src_nosib}" alt="x">})
check('S2', "没有 webp 兄弟的 png 必须原样：#{out}") { out.include?(%Q{src="#{src_nosib}"}) }

out = t_fx.add_image_dims(%Q{<img src="#{BASEURL}/assets/img/fx/c.jpg" alt="x">})
check('S2b', ".jpg 即便配了 .webp 兄弟也不许换（换源只认 .png）：#{out}") do
  out.include?(%Q{src="#{BASEURL}/assets/img/fx/c.jpg"})
end

%W[
  https://cdn.example.com/a.png
  //cdn.example.com/a.png
  data:image/png;base64,AAAA
  {{\ page.cover\ }}
  {%\ link\ x.png\ %}
  #{BASEURL}/assets/img/fx/不存在.png
].each_with_index do |s, i|
  out = t_fx.add_image_dims(%Q{<img src="#{s}" alt="x">})
  check("S3#{i + 1}", "放过非常规 src（#{s}）：#{out}") { out.include?(%Q{src="#{s}"}) }
end

pairs = LEDGER.reject { |_k, v| v['skip'] }
harness '台账里没有一条转出 webp 的条目，S4 无货可对' if pairs.empty?
mismatch = pairs.reject do |k, v|
  a = Jekyll::ImageDims.read(File.join(repo, k))
  b = Jekyll::ImageDims.read(File.join(repo, v['webp']))
  a && b && a == b
end
check('S4', "台账里 #{pairs.size} 对 png/webp 的文件头尺寸必须逐对全等（换源不改版式的前提），不等的：#{mismatch.keys.join(', ')}") do
  mismatch.empty?
end
first = pairs.keys.first
out = t_repo.add_image_dims(%Q{<img src="#{BASEURL}/#{first}" alt="x">})
w, h = Jekyll::ImageDims.read(File.join(repo, first))
check('S4b', "换源之后补进标签的尺寸仍等于 png 自己的尺寸（#{w}x#{h}）：#{out}") do
  out.include?(%Q{width="#{w}" height="#{h}"})
end

three = %Q{<img src="#{src_nosib}" alt="a"><img src="#{src_nosib}" alt="b"><img src="#{src_nosib}" alt="c">}
out = t_fx.add_image_dims(three, 'lcp')
check('S5', "lcp 一趟调用里只许一张领提权（实得 #{out.scan('fetchpriority="high"').size} 枚）：#{out}") do
  out.scan('fetchpriority="high"').size == 1
end
check('S5b', "提权必须落在第一张：#{out}") { out.index('fetchpriority') < out.index('alt="b"') }

out = t_fx.add_image_dims(%Q{<img src="#{src_nosib}" alt="a" loading="lazy"><img src="#{src_nosib}" alt="b">}, 'lcp')
check('S6', "第一张已经写了 lazy 就不给提权（提权与懒加载同桌是矛盾指令）：#{out}") do
  !out.include?('fetchpriority')
end

out = t_fx.add_image_dims(%Q{<img src="#{src_nosib}" alt="a" fetchpriority="low">}, 'lcp')
check('S6b', "已有 fetchpriority 时不叠加（实得 #{out.scan(/fetchpriority/).size} 枚）：#{out}") do
  out.scan(/fetchpriority/).size == 1
end

out = t_fx.add_image_dims(%Q{<img src="#{src_fx}" alt="">}, 'swap')
check('S7', "swap 档也必须换源：#{out}") { out.include?(%Q{src="#{BASEURL}/#{FX_WEBP}"}) }
check('S7b', "swap 档不许长出尺寸/懒加载/提权（postCover 量到高度会翻分支）：#{out}") do
  !out.match?(/\b(width|height|loading|decoding|fetchpriority)\s*=/)
end

out = t_fx.add_image_dims(%Q{<img src="#{src_fx}" alt="x">})
check('S8', "缺省 mode 一律不提权：#{out}") { !out.include?('fetchpriority') }

out = t_fx.add_image_dims(%Q{<img src="#{src_fx}" alt="x" width="10" height="20">})
check('S9', "作者已经写了尺寸时只换源、不再补第二对：#{out}") do
  out.include?('.webp"') && out.scan(/\bwidth=/).size == 1 && out.include?('width="10"')
end

out = t_fx.add_image_dims(%Q{<img src="#{src_fx}?v=2" alt="x">})
check('S10', "带 query 的 src 必须保住 query、只换扩展名：#{out}") do
  out.include?(%Q{src="#{BASEURL}/#{FX_WEBP}?v=2"})
end

out = t_fx.add_image_dims(%Q{<img src="#{src_nested}" alt="x">})
check('S11', "目录名里的 .png 不算数，换的必须是结尾那一处：#{out}") do
  out.include?(%Q{src="#{BASEURL}/assets/img/fx/nested.png/d.webp"})
end

out = t_fx.add_image_dims(%Q{<img src="#{src_fx}" alt="x" />})
check('S12', "自闭合写法补完属性仍是自闭合：#{out}") { out.end_with?(' />') }

out = t_fx.add_image_dims(%Q{<img src='#{src_fx}' alt="x">})
check('S13', "引号种类跟着原样走：#{out}") { out.include?(%Q{src='#{BASEURL}/#{FX_WEBP}'}) }

check('S14', 'nil 与空串原样返回') { t_fx.add_image_dims(nil).nil? && t_fx.add_image_dims('').eql?('') }

# ---- D 组：六种文件头的尺寸解码（语料里没有 gif/bmp，桩字节是唯一能覆盖它们的地方）----
dims = lambda { |name, bytes| Jekyll::ImageDims.send(:dims_for, name, bytes) }
check('D1', 'PNG IHDR 大端宽高') { dims.call('x.png', mk_png(1200, 900)) == [1200, 900] }
check('D2', 'GIF 逻辑屏幕描述符小端宽高') { dims.call('x.gif', mk_gif(64, 32)) == [64, 32] }
check('D3', 'BMP 负高表示行序，取绝对值才是渲染尺寸') { dims.call('x.bmp', mk_bmp(500, -400)) == [500, 400] }
check('D4', 'JPEG SOF0 先高后宽，且 APP0/DQT/DHT 段都要跳过') { dims.call('x.jpg', mk_jpeg(1600, 900)) == [1600, 900] }
check('D4b', 'JPEG 里连续的 FF 填充字节不能把段扫描带偏') do
  dims.call('x.jpg', mk_jpeg(200, 300, pad: true)) == [200, 300]
end
check('D5', 'WebP VP8X 画布是 24 位小端且各减一') { dims.call('x.webp', mk_webp_vp8x(1920, 1080)) == [1920, 1080] }
check('D6', 'WebP VP8L 无损把宽高各 14 位挤在同一枚 32 位里') { dims.call('x.webp', mk_webp_vp8l(1023, 767)) == [1023, 767] }
check('D7', 'WebP VP8 有损的关键帧宽高要各取低 14 位') { dims.call('x.webp', mk_webp_vp8(800, 600)) == [800, 600] }
check('D8', 'SVG 优先用 width/height 属性') do
  dims.call('x.svg', %(<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"></svg>)) == [240, 120]
end
check('D9', 'SVG 没有尺寸属性时退到 viewBox 的后两个数（不是前两个 x/y）') do
  dims.call('x.svg', %(<svg viewBox="0 0 88 31"></svg>)) == [88, 31]
end
check('D10', '认不出的格式返回 nil，而不是猜一个') { dims.call('x.bin', 'ZZZZZZZZZZZZZZZZZZZZZZZZ'.b).nil? }

# ---- 计数守卫 ----
$fails << "COUNT 断言计数对不上：跑了 #{$ran} 条，声明 #{DECLARED} 条（加了断言没改 DECLARED，或某一整块被跳过）" if $ran != DECLARED

if $fails.empty?
  puts "--- image-dims: ok（#{$ran}/#{DECLARED} 条断言，台账 #{LEDGER.size} 对，桩目录 #{FX}）---"
  exit 0
end
puts "--- image-dims: #{$fails.size} RED（跑了 #{$ran}/#{DECLARED}）---"
$fails.each { |f| puts "dims: RED #{f}" }
exit 1
