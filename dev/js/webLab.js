/**
 * WebLab 前端在线编辑器。
 *
 * ace 不再由 weblab.html 直挂：那里两条阻塞式 <script src> 会在解析期执行完 375KB 的
 * ace.js，紧接着三次 ace.edit() 又同步拉走 mode 与 snippet —— 十个文件 561KB（gzip 后
 * 约 157KB，按产物逐个 wc -c / gzip 累加），全压在首屏之前。现在改成「摸到编辑区才装」：
 * 只在 #aceEditor 上按下第一次，或第一次点「提交运行」，才去注入。
 *
 * 空盒子在改动前后是同一块 300px 的深色（高度由 weblab.scss 钉死），所以晚装不会位移；
 * 那一次按下也不会白点：装完顺手把对应的格子 focus 上，光标直接就在里面。
 */
(function () {
    'use strict';

    var ACE_BASE = (window.SITE_BASEURL || '') + '/ace/';
    // 顺序有意义：ext-language_tools.js 要往 ace.js 建好的模块表里注册，所以串行加载。
    var FILES = ['ace.js', 'ext-language_tools.js'];
    // 容器 id → editors 的键，只为把「点的是哪一格」转成「装好后 focus 谁」。
    var BY_ID = { editor1: 'html', editor2: 'css', editor3: 'js' };

    var root = document.getElementById('aceEditor');
    var submit = document.getElementById('submit');
    if (!root || !submit) return;

    var editors = null;
    var booting = null;
    var wantFocus = null;

    /**
     * 注入一个 ace 脚本。
     * @param {string} src 相对 ace 目录的文件名
     * @returns {Promise<void>} 该脚本执行完毕后 resolve
     */
    function inject(src) {
        return new Promise(function (resolve, reject) {
            var el = document.createElement('script');
            el.src = ACE_BASE + src;
            el.onload = function () { resolve(); };
            el.onerror = function () { reject(new Error(src)); };
            document.head.appendChild(el);
        });
    }

    /**
     * @param {string} id 容器元素 id
     * @param {string} mode ace 模式路径
     * @param {boolean=} wrap 是否软换行，只有 html 那格开着
     * @returns {Object} ace 编辑器实例
     */
    function edit(id, mode, wrap) {
        return window.ace.edit(id, {
            theme: 'ace/theme/monokai',
            mode: mode,
            wrap: !!wrap,
            autoScrollEditorIntoView: true,
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true
        });
    }

    /**
     * 启动三个编辑器，并把触发这一次加载的那格交还给光标。
     */
    function createEditors() {
        // 显式给 basePath：注入的脚本没有标签位置可猜，写死省掉一次路径嗅探。
        window.ace.config.set('basePath', ACE_BASE.slice(0, -1));
        editors = {
            html: edit('editor1', 'ace/mode/html', true),
            css: edit('editor2', 'ace/mode/css'),
            js: edit('editor3', 'ace/mode/javascript')
        };
        if (wantFocus && editors[wantFocus]) editors[wantFocus].focus();
    }

    /**
     * 幂等地把 ace 拉起来，重复调用复用同一条 promise 链。
     * @returns {Promise<void>}
     */
    function boot() {
        if (!booting) {
            booting = inject(FILES[0]).then(function () {
                return inject(FILES[1]);
            }).then(createEditors).catch(function () {
                // 只把这条链交还出去，让下一次点击有机会重试；不额外弹提示，
                // 加载失败时页面的表现与改动前一致：编辑区停在空盒子上。
                booting = null;
            });
        }
        return booting;
    }

    root.addEventListener('pointerdown', function (e) {
        var area = e.target && e.target.closest ? e.target.closest('.edit-area') : null;
        wantFocus = area && BY_ID[area.id] ? BY_ID[area.id] : null;
        boot();
    }, { once: true, passive: true });

    submit.addEventListener('click', function () {
        // 早于 ace 就位的那一次点击不算白点：装好后照跑。
        boot().then(run);
    });

    /**
     * 把三段代码拼进预览 iframe 的 srcdoc。
     */
    function run() {
        if (!editors) return;
        var htmlValue = editors.html.getValue();
        var cssValue = editors.css.getValue();
        var jsValue = editors.js.getValue();
        var htmlStr = '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<meta charset="utf-8" />' +
            '<title>代码测试</title>' +
            '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>' +
            '<meta name="format-detection" content="telephone=no" />' +
            '<meta name="apple-mobile-web-app-status-bar-style" content="black" />' +
            '<meta name="apple-mobile-web-app-capable" content="yes" />' +
            '<meta http-equiv="X-UA-Compatible" content="chrome=1,IE=edge"/>' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=0"/>' +
            '<style type="text/css">' +
            cssValue +
            '</style>' +
            '<script type="text/javascript" src="//cdn.bootcss.com/vConsole/3.2.0/vconsole.min.js">' +
            '</' +
            'script>' +
            '<script type="text/javascript">' +
            'new window.VConsole();' +
            '</' +
            'script>' +
            '</head>' +
            '<body>' +
            htmlValue +
            '<script type="text/javascript">' +
            jsValue +
            '</' +
            'script>' +
            '</body>' +
            '</html>';
        document.getElementById('preview').srcdoc = htmlStr;
    }
})();
