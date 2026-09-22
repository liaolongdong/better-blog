module.exports = {
  plugins: {
    'autoprefixer': {
      overrideBrowserslist: ['iOS >= 7', 'Android >= 4.1'],
      cascade: true,
      remove: true
    },
    'postcss-px-to-viewport': {
      viewportWidth: 750,
      viewportHeight: 1334,
      unitPrecision: 5,
      viewportUnit: 'vw',
      selectorBlackList: [
        /^\.markdown-body/, 
        /^\.pc/, 
        /\.g-container/, 
        /\.g-sidebar-wrapper/, 
        /\.article-list/, 
        /\.g-sidebar/,
        /\.g-header/,
        /\.home-content/,
        /\.post-/,
        /\.read-next/,
        /\.tags-/,
        /\.demo-/,
        /\.g-footer/,
        /\.author-/,
        /^\.search-/,
        /^\.pagination/,
        /^\.bottom-fixed-btn/,  // 悬浮按钮
        /^\.social-share/,      // 分享按钮
        /^\.lab-content/,       // weblab页面
        /^\.p-about/,           // about页面
        /^#SOHUCS/,             // 畅言评论区
        /^\.headerUp/,          // 头部隐藏动画
        // editorial 改造层：这一层的栅格宽度、正文 measure、目录栏宽都是按桌面
        // 视口设计的固定值，一旦被换成 vw 会整体等比缩放（1440 屏上 760px 正文
        // 变成 ~1400px），所以整层选择器一律排除在像素转视口之外。
        ':root',                // 设计令牌（含阴影里的 px）
        'night-mode',
        '.g-masthead',
        '.masthead',
        '-masthead',          // home-/tools-/archive-/post-masthead 这类连字修饰符
        '.kicker',
        '.issue-',
        '.feed-',
        '.tool',
        '.cmdk',
        '.toc',
        '.code-',
        '.reading-',
        '.related-',
        '.nav-',
        '.card-',
        '.skip-link',
        '.logo-',
        '.menu-toggle',
        '.post-rail',
        '.post-shell',
        '.post-grid',
        '.post-main',
        '.has-toc',
        '.archive-',
        '.cat-',
        '.cta',
        '.series-',           // 合集清单（.post-series* 已被上面的 /\.post-/ 覆盖）
        '.heading-anchor',
        '.resume',            // 续读浮条（.resume-* 同理，靠子串命中）
        '.lightbox',          // 图片灯箱，尺寸本来就按 vw/vh 写
        '.toc-',              // 目录抽屉的按钮/遮罩/关闭键（.toc 那条只覆盖得到 .toc 本身）
        '.notfound',          // 404 页（无 .masthead 之外的父选择器可借力）
        '.reader-',           // 阅读偏好面板与触发按钮
        '[data-rs-',          // tokens.scss 里靠属性选择器改 --measure/--rs 的那几条
        '.lp-',               // 文内链接 hover 预览卡
        '.quote-',            // 金句分享卡片（工具条、对话框、画布与按钮）
        '.shelf',             // 书架：顶栏入口、书签、抽屉与账本（dialog.shelf 同串命中）
        '.wrap-up',           // 篇末收束层
        '#cmdk',              // id 选择器不含 ".cmdk" 这个子串，单独列
        ':focus-visible'      // 裸伪类选择器同上，2px 描边不能被放大成 vw
      ],
      minPixelValue: 1,
      mediaQuery: true
    }
  }
};
