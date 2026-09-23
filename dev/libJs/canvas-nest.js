! function () {
    function o(w, v, i) {
        return w.getAttribute(v) || i
    }

    function j(i) {
        return document.getElementsByTagName(i)
    }

    function l() {
        var i = j("script"),
            w = i.length,
            v = i[w - 1];
        return {
            l: w,
            z: o(v, "zIndex", 999),
            o: o(v, "opacity", 0.9),
            c: o(v, "color", "255,255,255"),
            n: o(v, "count", 199)
        }
    }

    function k() {
        r = u.width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth, n = u.height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
    }

    function b() {
        if (!cnLife.running) return;
        e.clearRect(0, 0, r, n);
        var w = [f].concat(t);
        var x, v, A, B, z, y;
        t.forEach(function (i) {
            i.x += i.xa, i.y += i.ya, i.xa *= i.x > r || i.x < 0 ? -1 : 1, i.ya *= i.y > n || i.y < 0 ? -1 : 1, e.fillRect(i.x - 0.5, i.y - 0.5, 1, 1);
            for (v = 0; v < w.length; v++) {
                x = w[v];
                if (i !== x && null !== x.x && null !== x.y) {
                    B = i.x - x.x, z = i.y - x.y, y = B * B + z * z;
                    y < x.max && (x === f && y >= x.max / 2 && (i.x -= 0.03 * B, i.y -= 0.03 * z), A = (x.max - y) / x.max, e.beginPath(), e.lineWidth = A / 2, e.strokeStyle = "rgba(" + s.c + "," + (A + 0.2) + ")", e.moveTo(i.x, i.y), e.lineTo(x.x, x.y), e.stroke())
                }
            }
            w.splice(w.indexOf(i), 1)
        }), m(b)
    }
    var u = document.createElement("canvas"),
        s = l(),
        c = "c_n" + s.l,
        e = u.getContext("2d"),
        r, n, m = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (i) {
            window.setTimeout(i, 1000 / 45)
        },
        a = Math.random,
        // 本文件相对上游原版唯一的改动：补一套生命周期（running 标志 + window.CanvasNest.stop），
        // 并在赋值 window.on* 前存下旧值以便还原。上游是「一次加载管到页面关闭」的写法，
        // 而站内 about 页需要「进夜间才注入、切回白昼就停」，没有这个接口就只能去改全局 rAF。
        // 名字不能图省事用单字母：下面那个 for 循环里有 `var h` 和 `var g`，var 是函数作用域，
        // 同名声明会在循环里被随机数覆盖掉（实测踩过一次，stop() 全程空转且一帧都不画）。
        cnLife = {
            running: true
        },
        cnPrev = {
            resize: window.onresize,
            mousemove: window.onmousemove,
            mouseout: window.onmouseout
        },
        f = {
            x: null,
            y: null,
            max: 20000
        };
    // 同一页面只允许一张星链：重复注入时先停掉上一份，避免留下没人持有的活循环
    if (window.CanvasNest) {
        window.CanvasNest.stop()
    }
    u.id = c;
    u.style.cssText = "position:fixed;top:0;pointer-events:none;left:0;z-index:" + s.z + ";opacity:" + s.o;
    j("body")[0].appendChild(u);
    k(), window.onresize = k;
    window.onmousemove = function (i) {
        i = i || window.event, f.x = i.clientX, f.y = i.clientY
    }, window.onmouseout = function () {
        f.x = null, f.y = null
    };
    window.CanvasNest = {
        stop: function () {
            if (!cnLife.running) return;
            cnLife.running = false;
            u.parentNode === document.body && document.body.removeChild(u);
            window.onresize = cnPrev.resize, window.onmousemove = cnPrev.mousemove, window.onmouseout = cnPrev.mouseout
        }
    };
    for (var t = [], p = 0; s.n > p; p++) {
        var h = a() * r,
            g = a() * n,
            q = 2 * a() - 1,
            d = 2 * a() - 1;
        t.push({
            x: h,
            y: g,
            xa: q,
            ya: d,
            max: 9000
        })
    }
    setTimeout(function () {
        b()
    }, 10)
}();