import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// 获取 dev/js 目录下的所有 JS 文件作为入口
function getDevJsEntries() {
  const jsDir = resolve(__dirname, 'dev/js');
  return readdirSync(jsDir)
    .filter(file => file.endsWith('.js'))
    .reduce((entries, file) => {
      const name = file.replace('.js', '');
      entries[name] = resolve(jsDir, file);
      return entries;
    }, {});
}

// 获取 dev/libJs 目录下的所有 JS 文件作为入口（排除已压缩的）
function getDevLibJsEntries() {
  const libJsDir = resolve(__dirname, 'dev/libJs');
  return readdirSync(libJsDir)
    .filter(file => file.endsWith('.js'))
    .reduce((entries, file) => {
      const name = file.replace('.js', '');
      entries[name] = resolve(libJsDir, file);
      return entries;
    }, {});
}

// 获取 dev/sass 目录下的所有 SCSS 文件作为入口
function getDevSassEntries() {
  const sassDir = resolve(__dirname, 'dev/sass');
  const entries = {};
  
  // 处理根目录下的 scss 文件
  readdirSync(sassDir)
    .filter(file => file.endsWith('.scss'))
    .forEach(file => {
      const name = file.replace('.scss', '');
      entries[name] = resolve(sassDir, file);
    });
  
  return entries;
}

// 获取 dev/libCss 目录下的所有 CSS 文件作为入口
function getDevLibCssEntries() {
  const libCssDir = resolve(__dirname, 'dev/libCss');
  return readdirSync(libCssDir)
    .filter(file => file.endsWith('.css') || file.endsWith('.scss'))
    .reduce((entries, file) => {
      const name = file.replace(/\.(css|scss)$/, '');
      entries[name] = resolve(libCssDir, file);
      return entries;
    }, {});
}

export default defineConfig({
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    host: true
  },
  // CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        // 静音 @import 警告
        silenceDeprecations: ['import'],
        api: 'modern'
      }
    }
  },
  build: {
    outDir: resolve(__dirname),
    emptyOutDir: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        ...getDevJsEntries(),
        ...getDevLibJsEntries(),
        ...getDevSassEntries(),
        ...getDevLibCssEntries()
      },
      output: [
        {
          entryFileNames: 'assets/js/[name].min.js',
          chunkFileNames: 'assets/js/[name].min.js',
          assetFileNames: (assetInfo) => {
            // CSS 文件输出到 assets/css 目录
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/css/[name].min.css';
            }
            // 其他资源文件
            return 'assets/[ext]/[name].[hash][extname]';
          },
          // 将全局变量暴露到 window 对象
          globals: {}
        }
      ]
    },
    // 不生成 manifest 文件
    manifest: false,
    // 禁用 CSS 代码分割，每个 SCSS 入口生成独立 CSS 文件
    cssCodeSplit: true
  }
});
