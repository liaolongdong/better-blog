import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, copyFileSync, mkdirSync } from 'fs';

/**
 * 入口名前缀的匹配正则，用于在输出阶段剥掉前缀。
 *
 * 四个来源目录（dev/js、dev/libJs、dev/sass、dev/libCss）存在同名文件，
 * 例如 index.js 与 index.scss；Rollup 入口对象的同名键会互相覆盖，
 * 故给每个入口加上 `js:` / `lib:` / `sass:` / `css:` 前缀区分，
 * 输出文件名再把前缀剥掉，得到干净的 assets/js|css/<name>.min.js|.min.css。
 * @type {RegExp}
 */
const PREFIX_RE = /^(js|lib|sass|css)[_:]/;

/**
 * 列出目录下的文件名（升序）。
 *
 * 排序是必需的：readdirSync 的返回顺序由文件系统决定、不作任何保证，
 * 而入口的插入顺序会影响 Rollup 的模块顺序，进而影响产物的可复现性。
 * 与 vite.demo.config.js 的 readDirSafe 不同，这里不做 try/catch——
 * 这四个目录是构建的硬前提，缺失时应当直接失败，而不是静默产出残缺产物。
 * @param {string} dir 目录绝对路径
 * @returns {string[]} 已排序的文件名数组
 */
function readDirSorted(dir) {
  return readdirSync(dir).sort();
}

/**
 * IIFE 包装插件：恢复被 Vite ES module 转换剥离的 IIFE 作用域。
 *
 * 源文件原先各自包在 IIFE 里以避免全局变量冲突，转成 ES module 后外层作用域消失；
 * 而这些产物最终以普通 <script>（非 module）直接引入页面，缺乏模块作用域隔离，
 * 因此在打包末尾把 IIFE 重新包回去，防止多文件间的变量名互相污染。
 * @returns {import('vite').Plugin} Vite 插件
 */
function iifeWrapPlugin() {
  return {
    name: 'iife-wrap',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
          chunk.code = `(function(){${chunk.code}})();`;
        }
      }
    }
  };
}

/**
 * 复制一类「已预压缩」的第三方库文件到发布目录。
 *
 * 这些文件本身已是最终产物，无需再经 terser/postcss 加工。以 dev/libCss/share.min.css
 * 为例：若把它也当作入口，px-to-viewport 会改写其中的 px 值，而 writeBundle 晚于
 * Vite 写盘，加工结果最终仍会被这里的原样复制覆盖，纯属无用功。
 * 因此约定：预压缩文件一律不进入口（见 getDevLibJsEntries / getDevLibCssEntries
 * 的过滤条件），只做复制。
 * @param {string} srcDir 源目录绝对路径（dev/libJs 或 dev/libCss）
 * @param {string} destDir 目标目录绝对路径（assets/js 或 assets/css）
 * @param {string} suffix 需复制的文件后缀（'.min.js' 或 '.min.css'）
 * @returns {void}
 */
function copyMinifiedLibs(srcDir, destDir, suffix) {
  mkdirSync(destDir, { recursive: true });
  readDirSorted(srcDir)
    .filter(file => file.endsWith(suffix))
    .forEach(file => {
      copyFileSync(resolve(srcDir, file), resolve(destDir, file));
    });
}

/**
 * 复制预压缩的库文件到发布目录。
 * @returns {import('vite').Plugin} Vite 插件
 */
function copyPreMinifiedPlugin() {
  return {
    name: 'copy-pre-minified',
    writeBundle() {
      const root = resolve(__dirname);
      copyMinifiedLibs(resolve(root, 'dev/libJs'), resolve(root, 'assets/js'), '.min.js');
      copyMinifiedLibs(resolve(root, 'dev/libCss'), resolve(root, 'assets/css'), '.min.css');
    }
  };
}

/**
 * 获取 dev/js 目录下的业务 JS 入口（排除 .min.js 产物）。
 * @returns {Record<string, string>} Rollup 入口映射（入口名 -> 源文件绝对路径）
 */
function getDevJsEntries() {
  const jsDir = resolve(__dirname, 'dev/js');
  return readDirSorted(jsDir)
    .filter(file => file.endsWith('.js') && !file.endsWith('.min.js'))
    .reduce((entries, file) => {
      const name = file.replace(/\.js$/, '');
      entries[`js:${name}`] = resolve(jsDir, file);
      return entries;
    }, {});
}

/**
 * 获取 dev/libJs 目录下的第三方库 JS 入口（排除已预压缩的 .min.js，那些只做复制）。
 * @returns {Record<string, string>} Rollup 入口映射（入口名 -> 源文件绝对路径）
 */
function getDevLibJsEntries() {
  const libJsDir = resolve(__dirname, 'dev/libJs');
  return readDirSorted(libJsDir)
    .filter(file => file.endsWith('.js') && !file.endsWith('.min.js'))
    .reduce((entries, file) => {
      const name = file.replace(/\.js$/, '');
      entries[`lib:${name}`] = resolve(libJsDir, file);
      return entries;
    }, {});
}

/**
 * 获取 dev/sass 目录下的 SCSS 入口。
 * 只扫根目录一层：子目录（如 dev/sass/common）是被 @import 的片段，不单独产出。
 * @returns {Record<string, string>} Rollup 入口映射（入口名 -> 源文件绝对路径）
 */
function getDevSassEntries() {
  const sassDir = resolve(__dirname, 'dev/sass');
  return readDirSorted(sassDir)
    .filter(file => file.endsWith('.scss'))
    .reduce((entries, file) => {
      const name = file.replace(/\.scss$/, '');
      entries[`sass:${name}`] = resolve(sassDir, file);
      return entries;
    }, {});
}

/**
 * 获取 dev/libCss 目录下的第三方样式入口。
 * 排除已预压缩的 .min.css，理由见 copyMinifiedLibs；与 getDevLibJsEntries 保持对称。
 * @returns {Record<string, string>} Rollup 入口映射（入口名 -> 源文件绝对路径）
 */
function getDevLibCssEntries() {
  const libCssDir = resolve(__dirname, 'dev/libCss');
  return readDirSorted(libCssDir)
    .filter(file => (file.endsWith('.css') || file.endsWith('.scss')) && !file.endsWith('.min.css'))
    .reduce((entries, file) => {
      const name = file.replace(/\.(css|scss)$/, '');
      entries[`css:${name}`] = resolve(libCssDir, file);
      return entries;
    }, {});
}

export default defineConfig({
  plugins: [iifeWrapPlugin(), copyPreMinifiedPlugin()],
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
    // 输出基准目录设为仓库根下的 assets/（而非仓库根本身）。
    // 原因：`vite build --watch`（pnpm dev）下 Rollup 会校验「输入不得是输出目录的子路径」，
    // 若 outDir 为仓库根，则 dev/ 下的入口全部落在其内，watch 模式直接抛 RollupError。
    // 下方各 output 文件名已相应去掉 `assets/` 前缀，最终产物落点与改前完全一致。
    outDir: resolve(__dirname, 'assets'),
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
          entryFileNames: (chunk) => {
            const name = chunk.name.replace(PREFIX_RE, '');
            return `js/${name}.min.js`;
          },
          chunkFileNames: 'js/[name].min.js',
          assetFileNames: (assetInfo) => {
            // CSS 文件输出到 assets/css 目录（outDir 已是 assets/，故此处只写 css/）
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              const name = assetInfo.name.replace(PREFIX_RE, '').replace('.css', '.min.css');
              return `css/${name}`;
            }
            // 其他资源文件
            return '[ext]/[name].[hash][extname]';
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
