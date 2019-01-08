(function (win, doc) {
    var utils = {
        // 选择器
        $: function (selector) {
            return doc.querySelector(selector);
        },
        // 通过id获取dom节点
        getNodeById: function (id) {
            return doc.getElementById(id);
        },
        // 设置id节点的值
        setValueById: function (id, value) {
            this.getNodeById(id) && (this.getNodeById(id).innerHTML = value);
        },
        // 增加class
        addClass: function (ele, cName) {
            var arr = ele.className.split(' ').concat(cName.split(' '));
            for (var i = 0; i < arr.length; i++) {
                for (var k = arr.length - 1; k > i; k--) {
                    (arr[k] === '') && arr.splice(k, 1);
                    (arr[i] === arr[k]) && arr.splice(k, 1);
                }
            }
            ele.className = arr.join(' ');
        },
        // 移除class
        removeClass: function (ele, cName) {
            var arr1 = ele.className.split(' ');
            var arr2 = cName.split(' ');
            for (var i = 0; i < arr2.length; i++) {
                for (var j = arr1.length - 1; j >= 0; j--) {
                    (arr2[i] === arr1[j]) && arr1.splice(j, 1);
                }
            }
            ele.className = arr1.join(' ');
        },
        // 修复弹框蒙层下方元素滚动
        fixScroll: function (type) {
            var device = utils.whatDevice();
            if (device === 'android') {
                if (type === 'fixed') {
                    // 会引起页面重绘
                    var scrollTop = doc.documentElement.scrollTop + doc.body.scrollTop;
                    win.localStorage.setItem('scroll', JSON.stringify({
                        originHtmlScrollY: doc.getElementsByTagName('html')[0].style.overflowY,
                        originHtmlPosition: doc.getElementsByTagName('html')[0].style.position,
                        scrollTop: doc.documentElement.scrollTop + doc.body.scrollTop
                    }));
                    doc.getElementsByTagName('html')[0].style.overflowY = 'hidden';
                    doc.getElementsByTagName('html')[0].style.position = 'fixed';
                    doc.getElementsByTagName('html')[0].style.top = '-' + scrollTop + 'px';
                } else if (type === 'scroll') {
                    var originHtmlScroll = JSON.parse(win.localStorage.getItem('scroll')) || {
                        originHtmlScrollY: '',
                        originHtmlPosition: '',
                        scrollTop: 0
                    };
                    win.localStorage.removeItem('scroll');
                    doc.getElementsByTagName('html')[0].style.overflowY = originHtmlScroll.originHtmlScrollY;
                    doc.getElementsByTagName('html')[0].style.position = originHtmlScroll.originHtmlPosition;
                    win.scrollTo(0, originHtmlScroll.scrollTop);
                }
            } else {
                // 兼容ios弹窗遮罩层底部页面禁止滑动处理(还是有问题啊，滑动弹窗遮罩层底部页面还是会会滚动)
                if (type === 'fixed') {
                    // 获取遮罩层页面node节点
                    var maskNode = document.getElementsByClassName('mask');
                    maskNode && maskNode[0] && maskNode[0].addEventListener('touchstart', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                    });
                }
            }
        },
        /* 封装ajax函数
            * @param {string}opts.method http连接的方式，包括POST和GET两种方式
            * @param {string}opt.url 发送请求的url
            * @param {boolean}opts.async 是否为异步请求，true为异步的，false为同步的
            * @param {object}opts.data 发送的参数，格式为对象类型
            * @param {function}opts.success ajax发送并接收成功调用的回调函数
            * @param {function}opts.error ajax发送并接收成功调用的回调函数
            */
        ajax: function (opts) {
	    	// 资源
	    	var path = this.initHost();
	        opts = opts || {};
	        // 请求方法
	        opts.method = (opts.method && opts.method.toLocaleUpperCase()) || 'POST';
	        // 请求路径
            opts.url = /^http(s)?:\/\//.test(opts.url) ? opts.url : (path.wxuserApi + opts.url);
	        // 异步还是同步
	        opts.async = opts.async || true;
	        // 请求数据
            opts.data = opts.data || {};
            // 是否为上传图片
            if (opts.uploadImg) {
                // 头部
	            opts.headers = Object.assign({}, {'Accept': 'application/json', 'Content-Type': 'multipart/form-data'}, opts.headers || {});
            } else {
                // 头部
	            opts.headers = Object.assign({}, {'Accept': '*/*', 'Content-Type': 'application/x-www-form-urlencoded'}, opts.headers || {});
            }
	        // 成功后回调
	        opts.success = opts.success || function () {};
	        // 错误后回调
	        opts.error = opts.error || function () {};
	        var spin = opts.spin; // 是否显示loading，默认不显示
            var errorToast = opts.errorToast === undefined ? true : opts.errorToast; // 是否显示错误警告，默认弹出
            var successToast = opts.successToast; // 是否显示成功警告
	        var xhr = null;
            // 兼容IE可不做处理
            if (XMLHttpRequest) {
                xhr = new XMLHttpRequest();
            } else {
                xhr = new ActiveXObject('Microsoft.XMLHTTP');
	        }
	        var params = [];
	        for (var key in opts.data) {
	        	if (opts.data[key]) {
	        		params.push(key + '=' + opts.data[key]);
	        	}
	        }
	        var postData = params.join('&');
	        if (spin && Toast) {
	        	if (win.responseCount === undefined) win.responseCount = 0;
	        	if (!win.responseCount++) Toast.loading();
	        }
	        // 附带身份凭证
	        xhr.withCredentials = true;
	        // 设置xhr请求的超时时间
  			xhr.timeout = 20000;
	        if (opts.method === 'POST') {
	            xhr.open(opts.method, opts.url, opts.async);
	            for (var key in opts.headers) {
                    xhr.setRequestHeader(key, opts.headers[key]);
                }
	            xhr.send(postData);
	        } else if (opts.method === 'GET') {
	            xhr.open(opts.method, opts.url + '?getTime=' + new Date().getTime() + (postData ? ('&' + postData) : ''), opts.async);
	            for (var key in opts.headers) {
                    xhr.setRequestHeader(key, opts.headers[key]);
                }
	            xhr.send(null);
	        }
	        xhr.onreadystatechange = function () {
	            if (xhr.readyState === 4) {
	            	if (spin && Toast) {
			        	if (!win.responseCount || !--win.responseCount) Toast.closeLoading();
			        }
                    var response;
	            	if (xhr.status >= 200 && xhr.status < 400) {
	            		try {
                            response = JSON.parse(xhr.responseText);
	            		} catch (e) {
	            			response = {
	            				status: '1234567',
                                msg: '服务器请求失败！'
	            			};
	            		}
	            	} else {
	            		response = {
            				status: '123456',
                            msg: xhr.statusText || '服务器请求失败！'
            			};
	            	}
	            	var env = '/* @echo NODE_ENV */' || 'prod';
	            	if (env === 'prod') {
	            		console.log('请求地址：', opts.url, '\n请求参数：', opts.data, '\n请求结果：', response);
                    }
	            	if (response.status === 1 || response.retCode === 200) {
	            		successToast && response.msg && Toast && Toast.info(response.msg);
            			opts.success(response);
            		} else {
            			// errorToast && response.msg && Toast && Toast.info(response.msg);
            			opts.error(response);
            		}
	            }
	        };
	    },
        // 获取url参数
        paramToObj: function (url, name) {
            var obj = {};
            var a = document.createElement('a');
            a.href = url;
            var search = a.search;
            a = null;
            if (search.indexOf('?') === 0) {
                var str = search.substr(1);
                var arr = str.split('&');
                arr.forEach(function (item, i) {
                    var paramArr = item.split('=');
                    // 防止编码，把编码也解析出来
                    obj[decodeURIComponent(paramArr[0])] = decodeURIComponent(paramArr[1]);
                });
            }
            return name ? obj[name] : obj;
        },
        // 往url里添加参数
        addUrlParam: function (url, param) {
            var a = document.createElement('a');
            a.href = url;
            var arr = [];
            var search = a.search;
            if (param) {
                Object.keys(param).forEach(function (item) {
                    if (param[item] !== '' && param[item] !== null && param[item] !== undefined) {
                        arr.push(encodeURIComponent(item) + '=' + encodeURIComponent(param[item]));
                    }
                });
            }
            if (arr.length !== 0) {
                search += search === '' ? '?' + arr.join('&') : '&' + arr.join('&');
            }
            var retUrl = a.origin + a.pathname + search + a.hash;
            a = null;
            return retUrl;
        },
        nav: {
            to: function (url, param) {
                param = param || {};
                param = Object.assign({}, utils.paramToObj(win.location.href) || {}, param);
                var retUrl = utils.addUrlParam(url, param);
                win.location.href = retUrl;
            },
            replace: function (url, param) {
                param = param || {};
                param = Object.assign({}, utils.paramToObj(win.location.href) || {}, param);
                var retUrl = utils.addUrlParam(url, param);
                win.location.replace(retUrl);
            }
        },
        // 判断当前设备类型
        whatDevice: function () {
            var device = '';
            var ua = win.navigator.userAgent.toLowerCase();
            if (/MicroMessenger/i.test(ua)) {
                device = 'wx';
            } else if (this.paramToObj(win.location.href, 'signature')) {
                if (this.paramToObj(win.location.href, 'v') === '5') {
                    device = 'iosApp';
                } else {
                    device = 'androidApp';
                }
            } else if (/(iPhone|iPad|iPod|iOS)/i.test(ua)) {
                device = 'ios';
            } else if (/(Android)/i.test(ua)) {
                device = 'android';
            }
            return device;
        },
        /* 分享
            * @param {string}shareInfo.shareImage 分享图片
            * @param {string}shareInfo.shareContent
            * @param {string}shareInfo.shareTitle 分享标题
            * @param {string}shareInfo.shareUrl 分享URL
            */
        share: function (state) {
            var device = this.whatDevice();
            if (device === 'iosApp') {
                // 在ios app里面（暂未使用）
                var shareUrl = '#/[UMShare]' + state.shareTitle + '][' + state.shareUrl + '][' + state.shareImage;
                win.location.href = shareUrl;
            } else if (device === 'androidApp') {
                // 在android app里面（暂未使用）
                win.wst.goSharePage(state.shareTitle, state.shareImage, state.shareUrl, state.shareContent);
            } else if (device === 'wx') {
                // 微信分享
                utils.ajax({
                    url: utils.initHost().wxShare + 'weixinproxy/ShareWeiXinConfig',
                    method: 'GET',
                    data: {
                        shareurl: win.location.href.split('#')[0]
                    },
                    success: function (data) {
                        console.log('分享配置信息', data);
                        if (data.status === 1) {
                            wx.config({
                                debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。移动端会通过弹窗来提示相关信息。如果分享信息配置不正确的话，可以开了看对应报错信息
                                appId: data.data.appid,
                                timestamp: data.data.timestamp,
                                nonceStr: data.data.noncestr,
                                signature: data.data.signature,
                                jsApiList: [ // 需要使用的JS接口列表,分享默认这几个，如果有其他的功能比如图片上传之类的，需要添加对应api进来
                                    'checkJsApi',
                                    'onMenuShareTimeline',
                                    'onMenuShareAppMessage',
                                    'onMenuShareQQ',
                                    'onMenuShareWeibo'
                                ]
                            });
                            var shareConfig = {
                                'share': {
                                    // 分享图，默认当相对路径处理，所以使用绝对路径的的话，“http://”协议前缀必须在。
                                    'imgUrl': state.shareImage || 'https://qncdn.wanshifu.com/fourth_anniversary_share_icon.png',
                                    // 摘要,如果分享到朋友圈的话，不显示摘要。
                                    'desc': state.shareContent || '错过，再等一年',
                                    // 分享卡片标题
                                    'title': state.shareTitle || '8.3师傅节|丰厚奖励，荣誉为你',
                                    // 分享出去后的链接，这里可以将链接设置为另一个页面。
                                    // 'link': state.shareUrl || win.location.origin + win.location.pathname,
                                    'link': state.shareUrl || win.location.origin + '/shifujie83/indexMaster.html',
                                    'success': function () {
                                        // 分享成功后的回调函数
                                        console.warn(arguments);
                                    },
                                    'cancel': function () {
                                        // 用户取消分享后执行的回调函数
                                        console.warn(arguments);
                                    },
                                }
                            };
                            wx.ready(function () {
                                // 分享给好友
                                wx.onMenuShareAppMessage(shareConfig.share);
                                // 分享到朋友圈
                                wx.onMenuShareTimeline(shareConfig.share);
                                // 分享给手机QQ
                                wx.onMenuShareQQ(shareConfig.share);
                            });
                        }
                    }
                });
            }
        },
        shareImage: function (imgUrl) {
            var device = this.whatDevice();
            if (device === 'iosApp') {
                // 在ios app里面
                win.postMessage(JSON.stringify({type: 'h5Event', state: {shareImgUrl: imgUrl}}));
            } else if (device === 'androidApp') {
                // 在android app里面
                win.wst.goSharePic(imgUrl);
            }
        },
        // 埋点
        onEvent: function (pageId) {
            var device = this.whatDevice();
            var signature = this.paramToObj(win.location.href, 'signature') || (this.getMasterInfo() && this.getMasterInfo().signature);
            var type = (device === 'iosApp' || device === 'androidApp') ? undefined : 'outer';
            this.ajax({
                spin: false,
                errorToast: false,
                successToast: false,
                method: 'POST',
                url: 'masterfestival/Appmasterfestival/Tracepoint',
                data: {
                    type: type,
                    signature: signature,
                    page_id: pageId
                },
                success: function () {
                    console.log('success');
                },
                error: function () {
                    console.log('error');
                }
            });
        },
        // 用户端埋点
        onUserEvent: function (pageType) {
            this.ajax({
                spin: false,
                errorToast: false,
                successToast: false,
                method: 'POST',
                url: 'masterfestival/MobileMasterfestival/BurialPoint',
                data: {
                    pageType: pageType
                },
                success: function () {
                    console.log('success');
                },
                error: function () {
                    console.log('error');
                }
            });
        },
        animate: function (obj, json, interval, speedFactor, func) {
            clearInterval(obj.timer);
            function getStyle (obj, arr) {
                if (obj.currentStyle) { // ie
                    return obj.currentStyle[arr];
                } else { // 非ie
                    return document.defaultView.getComputedStyle(obj, null)[arr];
                }
            }
            obj.timer = setInterval(function () {
                var flag = true;
                for (var arr in json) {
                    var cur = 0;
                    if (arr === 'opacity') { cur = Math.round(parseFloat(getStyle(obj, arr)) * 100); } else { cur = parseInt(getStyle(obj, arr)); }
                    var speed = (json[arr] - cur) * speedFactor;
                    speed = speed > 0 ? Math.ceil(speed) : Math.floor(speed);
                    if (cur !== json[arr]) { flag = false; }
                    if (arr === 'opacity') {
                        obj.style.filter = 'alpha(opacity : \'+(cur + speed)+\' )';
                        obj.style.opacity = (cur + speed) / 100;
                    } else { obj.style[arr] = cur + speed + 'px'; }
                }
                if (flag) {
                    clearInterval(obj.timer);
                    if (func) { func(); }
                }
            }, interval);
        }
    };
    win.utils = utils;
})(window, document);
