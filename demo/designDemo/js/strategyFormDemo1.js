(function (window, document) {
    /***********************策略对象**************************/
    var strategies = {
        isNonEmpty: function (value, errorMsg) {
            if (value === '') {
                return errorMsg;
            }
        },
        minLength: function (value, length, errorMsg) {
            if (value.length < length) {
                return errorMsg;
            }
        },
        isMobile: function (value, errorMsg) {
            if (!/(^1[3|5|8][0-9]{9}$)/.test(value)) {
                return errorMsg;
            }
        }
    };

    /***********************Validator 类**************************/
    var Validator = function () {
        this.cache = [];
    };
    Validator.prototype.add = function (dom, rules) {
        var self = this;
        for (var i = 0, rule; rule = rules[i++];) {
            (function (rule) {
                var strategyArr = rule.strategy.split(':');
                var errorMsg = rule.errorMsg;
                self.cache.push(function () {
                    var strategy = strategyArr.shift();
                    strategyArr.unshift(dom.value);
                    strategyArr.push(errorMsg);
                    return strategies[strategy].apply(dom, strategyArr);
                });
            })(rule)
        }
    };
    Validator.prototype.start = function () {
        for (var i = 0, validatorFunc; validatorFunc = this.cache[i++];) {
            var errorMsg = validatorFunc();
            if (errorMsg) {
                return errorMsg;
            }
        }
    };

    /***********************客户调用代码**************************/
    var registerForm = document.getElementById('registerForm');
    var validataFunc = function () {
        var validator = new Validator();
        validator.add(registerForm.userName, [{
            strategy: 'isNonEmpty',
            errorMsg: '用户名不能为空'
        }, {
            strategy: 'minLength:6',
            errorMsg: '用户名长度不能小于6位'
        }]);
        validator.add(registerForm.password, [{
            strategy: 'isNonEmpty',
            errorMsg: '密码不能为空'
        }, {
            strategy: 'minLength:6',
            errorMsg: '密码长度不能小于6位'
        }]);
        validator.add(registerForm.phoneNumber, [{
            strategy: 'isNonEmpty',
            errorMsg: '手机号码不能为空'
        }, {
            strategy: 'isMobile',
            errorMsg: '手机号码格式不正确'
        }]);
        var errorMsg = validator.start();
        return errorMsg;
    }

    registerForm.onsubmit = function () {
        var errorMsg = validataFunc();
        if (errorMsg) {
            alert(errorMsg);
            return false;
        }
    };
})(window, document);
