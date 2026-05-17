import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { readdirSync, statSync } from 'fs';

// 获取 demo 目录下所有子目录
function getDemoFolders() {
  const demoDir = resolve(__dirname, 'demo');
  return readdirSync(demoDir)
    .filter(folder => statSync(join(demoDir, folder)).isDirectory());
}

// 为每个 demo 子目录创建入口配置
function getDemoEntries() {
  const folders = getDemoFolders();
  const entries = {};

  folders.forEach(folder => {
    const folderPath = join(resolve(__dirname, 'demo'), folder);
    
    // 处理 JS 文件（排除 .min.js）
    const jsDir = join(folderPath, 'js');
    try {
      const jsFiles = readdirSync(jsDir).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
      jsFiles.forEach(file => {
        const name = `demo/${folder}/js/${file.replace('.js', '')}`;
        entries[name] = join(jsDir, file);
      });
    } catch (e) {
      // js 目录不存在，跳过
    }

    // 处理 CSS/SCSS 文件（排除 .min.css）
    const cssDir = join(folderPath, 'css');
    try {
      const cssFiles = readdirSync(cssDir).filter(f => 
        (f.endsWith('.css') || f.endsWith('.scss')) && !f.endsWith('.min.css')
      );
      cssFiles.forEach(file => {
        const name = `demo/${folder}/css/${file.replace(/\.(css|scss)$/, '')}`;
        entries[name] = join(cssDir, file);
      });
    } catch (e) {
      // css 目录不存在，跳过
    }
  });

  return entries;
}

export default defineConfig({
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
    // Demo 不压缩代码，方便查看源码
    minify: false,
    rollupOptions: {
      input: getDemoEntries(),
      output: [
        {
          entryFileNames: '[name].min.js',
          chunkFileNames: '[name].min.js',
          assetFileNames: (assetInfo) => {
            // CSS 文件输出到对应目录
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return '[name].min.css';
            }
            return '[name].[hash][extname]';
          }
        }
      ]
    },
    manifest: false,
    cssCodeSplit: true
  }
});
