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
        /^\.p-about/            // about页面
      ],
      minPixelValue: 1,
      mediaQuery: true
    }
  }
};
