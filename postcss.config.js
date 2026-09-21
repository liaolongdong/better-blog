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
        /\.g-banner/,
        /\.home-banner/,
        /\.home-content/,
        /\.post-/,
        /\.read-next/,
        /\.tags-/,
        /\.demo-/,
        /\.np-banner/,
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
        '.notfound',          // 404 页（无 .masthead 之外的父选择器可借力）
        '#cmdk',              // id 选择器不含 ".cmdk" 这个子串，单独列
        ':focus-visible'      // 裸伪类选择器同上，2px 描边不能被放大成 vw
      ],
      minPixelValue: 1,
      mediaQuery: true
    }
  }
};
