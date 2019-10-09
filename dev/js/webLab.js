(function() {
    var editor1 = ace.edit("editor1", {
        theme: "ace/theme/monokai",
        mode: "ace/mode/html",
        wrap: true,
        autoScrollEditorIntoView: true,
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true
    });
    var editor2 = ace.edit("editor2", {
        theme: "ace/theme/monokai",
        mode: "ace/mode/css",
        autoScrollEditorIntoView: true,
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true
    });
    var editor3 = ace.edit("editor3", {
        theme: "ace/theme/monokai",
        mode: "ace/mode/javascript",
        autoScrollEditorIntoView: true,
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true
    });
    var submit = document.querySelector('#submit');
    submit.addEventListener('click', function() {
        var htmlValue = editor1.getValue();
        var cssValue = editor2.getValue();
        var jsValue = editor3.getValue();
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
    })
})();
