import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { readdirSync, statSync, copyFileSync } from 'fs';

const DEMO_DIR = resolve(__dirname, 'demo');

/**
 * demo/<name>/css/ 下「已预处理完成的静态样式」清单。
 *
 * 这类文件的 px→vw 转换与浏览器前缀都已就位（base.css 与其 base.min.css 字节一致），
 * 不该再进 Rollup 打包管线，改由 copyStaticDemoCssPlugin 原样复制为同名 .min.css。
 *
 * 必须绕开打包的原因：多个 demo 的 base.css 内容完全相同，Vite 会按内容对 CSS 资源去重，
 * 只产出字母序第一份（实测仅 catDemo、idCardDemo 幸存），其余 demo 的 base.min.css 直接消失；
 * 而 _includes/demoHead.html 对每个 layout: demoTemplate 的页面都硬链接 ./css/base.min.css，
 * 会导致 8 个 demo 的基础样式在 GitHub Pages 上 404。
 * @type {string[]}
 */
const STATIC_DEMO_CSS = ['base.css'];

/**
 * 安全读取目录：目录不存在时返回空数组，并强制排序。
 *
 * 排序是必需的——readdirSync 的返回顺序由文件系统决定、不作任何保证，
 * 而入口对象的同名键会互相覆盖，顺序不同就会产出不同的构建结果。
 * @param {string} dir 目录绝对路径
 * @returns {string[]} 已排序的文件名数组
 */
function readDirSafe(dir) {
  try {
    return readdirSync(dir).sort();
  } catch (e) {
    return [];
  }
}

/**
 * 获取 demo 目录下所有子目录。
 * @returns {string[]} demo 子目录名（已排序）
 */
function getDemoFolders() {
  return readDirSafe(DEMO_DIR)
    .filter(folder => statSync(join(DEMO_DIR, folder)).isDirectory());
}

/**
 * 为每个 demo 子目录创建入口配置。
 *
 * 产物名规则：demo/<name>/js|css/<源文件名去后缀>.min.js|.min.css
 * @returns {Record<string, string>} Rollup 入口映射（入口名 -> 源文件绝对路径）
 */
function getDemoEntries() {
  const entries = {};

  getDemoFolders().forEach(folder => {
    const folderPath = join(DEMO_DIR, folder);

    // 处理 JS 文件（排除 .min.js 产物）
    const jsDir = join(folderPath, 'js');
    readDirSafe(jsDir)
      .filter(f => f.endsWith('.js') && !f.endsWith('.min.js'))
      .forEach(file => {
        entries[`demo/${folder}/js/${file.replace('.js', '')}`] = join(jsDir, file);
      });

    // 处理 CSS/SCSS 文件（排除 .min.css 产物与 STATIC_DEMO_CSS 静态样式）
    const cssDir = join(folderPath, 'css');
    const cssFiles = readDirSafe(cssDir).filter(f =>
      (f.endsWith('.css') || f.endsWith('.scss')) &&
      !f.endsWith('.min.css') &&
      !STATIC_DEMO_CSS.includes(f)
    );

    // 同一 basename 同时存在 .css 与 .scss 时只保留 .scss：
    // .scss 是源、.css 是它的扁平化产物，两者都作入口会争用同一个 [name].min.css 输出名。
    // 保留 .scss 与既有产物一致（实测 openMapDemo 的 index.min.css 来自 index.scss）。
    const scssBases = new Set(
      cssFiles.filter(f => f.endsWith('.scss')).map(f => f.replace(/\.scss$/, ''))
    );

    cssFiles
      .filter(f => f.endsWith('.scss') || !scssBases.has(f.replace(/\.css$/, '')))
      .forEach(file => {
        const name = `demo/${folder}/css/${file.replace(/\.(css|scss)$/, '')}`;
        entries[name] = join(cssDir, file);
      });
  });

  return entries;
}

/**
 * 把 demo/<name>/css/ 下的静态样式原样复制为同名 .min.css。
 *
 * 与主配置 vite.config.js 的 copyPreMinifiedPlugin 是同一套思路：
 * 已预处理完成的产物不进打包管线，只做复制，因此天然不受内容去重影响。
 * @returns {import('vite').Plugin} Vite 插件
 */
function copyStaticDemoCssPlugin() {
  return {
    name: 'copy-static-demo-css',
    writeBundle() {
      getDemoFolders().forEach(folder => {
        const cssDir = join(DEMO_DIR, folder, 'css');
        readDirSafe(cssDir)
          .filter(f => STATIC_DEMO_CSS.includes(f))
          .forEach(f => {
            copyFileSync(join(cssDir, f), join(cssDir, f.replace(/\.css$/, '.min.css')));
          });
      });
    }
  };
}

export default defineConfig({
  plugins: [copyStaticDemoCssPlugin()],
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
