// 一行代码实现一个简单的模板字符串替换
String.prototype.render = function (context) {
    return this.replace(/{{(.*?)}}/g, (match, key) => context[key.trim()]);
};

(function (window, document) {
    const Validator = new IDValidator( GB2260 );

    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', function () {
        console.log(document.getElementById('idCard'));
        const idCard = document.getElementById('idCard').value;
        const resultNode = document.getElementById('result');
        if (Validator.isValid(idCard)) {
            const idCardInfo = Validator.getInfo(idCard);
            console.log(idCardInfo);
            let resultHtml = '<p>户口所在地：{{addr}}</p>'
                + '<p>出生年月日：{{birth}}</p>'
                + '<p>性别：{{sex}}</p>';
            resultHtml = resultHtml.render(idCardInfo);
            resultNode.innerHTML = resultHtml;
        } else {
            resultNode.innerHTML = '输入的身份证号码不正确！！！';
        }
        resultNode.style.display = 'block';
    });
})(window, document);