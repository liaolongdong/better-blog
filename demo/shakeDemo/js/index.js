(function (window, document) {
    var shakeObj = {
        // 摇一摇加锁 防止重复触发
        shakeFlag: true,
        // 初始化
        init: function () {
            this.handleShake();
        },
        // 摇一摇
        handleShake: function () {
            // 运动事件监听
            if (window.DeviceMotionEvent) {
                window.addEventListener("devicemotion", deviceMotionHandler, false);
            } else {
                alert("该浏览器不支持摇一摇功能");
            }

            // 获取加速度信息
            // 通过监听上一步获取到的x, y, z 值在一定时间范围内的变化率，进行设备是否有进行晃动的判断。
            // 而为了防止正常移动的误判，需要给该变化率设置一个合适的临界值。
            let SHAKETHRESHOLD = 4000;
            let lastUpdate = 0;
            let x,
                y,
                z,
                lastX = 0,
                lastY = 0,
                lastZ = 0;

            // 摇一摇音乐
            let shakeAudio = document.getElementById('shakemusic');
            let openAudio = document.getElementById('openmusic');

            const self = this;

            function deviceMotionHandler(eventData) {
                let acceleration = eventData.accelerationIncludingGravity;
                let curTime = new Date().getTime();
                if (curTime - lastUpdate > 50) {
                    let diffTime = curTime - lastUpdate;
                    lastUpdate = curTime;
                    x = acceleration.x;
                    y = acceleration.y;
                    z = acceleration.z;
                    let speed = (Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime) * 10000;
                    if (speed > SHAKETHRESHOLD) {
                        if (self.shakeFlag) {
                            self.shakeFlag = false;

                            // 手机振动功能，只有安卓手机支持
                            self.useVibrateAction();

                            shakeAudio.play();

                            // 摇一摇动画效果
                            let shakeHandImg = document.getElementById(
                                "shakeHandImg"
                            );
                            shakeHandImg.classList.add("tada");
                            shakeHandImg.classList.add("animated");
                            shakeHandImg.addEventListener(
                                "animationend",
                                () => {
                                    shakeHandImg.classList.remove("tada");
                                    shakeHandImg.classList.remove("animated");
                                }
                            );
                            setTimeout(() => {
                                shakeAudio.pause();
                                openAudio.play();
                                alert("恭喜你，摇到漂亮妹纸一枚!"); // Do something
                                
                                self.shakeFlag = true;
                                // 调用摇一摇接口
                                // self.shakeSendCoupon();
                            }, 1000);
                        }
                    }
                    lastX = x;
                    lastY = y;
                    lastZ = z;
                }
            }
        },
        // 调用手机振动功能
        useVibrateAction() {
            navigator.vibrate =
                navigator.vibrate ||
                navigator.webkitVibrate ||
                navigator.mozVibrate ||
                navigator.msVibrate;
            if (navigator.vibrate) {
                console.log("手机振动");
                navigator.vibrate(1000); // 振动时间毫秒数
            } else {
                console.log("该浏览器不支持振动功能");
            }
        },
    }
    shakeObj.init();
})(window, document)