(function (window, document) {
    /**	
     * @desc 模拟打印构造函数
     * @param sSelector: 打印节点选择器, nRate: 打印文字速度
     * @return null
    */
    function TypeWriter(sSelector, nRate) {
        /**
         * @desc 清除定时器和初始化参数
         */
        function clean() {
            clearInterval(nIntervId); // 清除定时器
            bTyping = false; // 是否正在打印
            bStart = true; // 是否开始
            oCurrent = null;
            aSheets.length = nIdx = 0;
        }

        function scroll(oSheet, nPos, bEraseAndStop) {
            if (!oSheet.hasOwnProperty('parts') || aMap.length < nPos) {
                return true;
            }

            var oRel, bExit = false;

            if (aMap.length === nPos) {
                aMap.push(0);
            }

            while (aMap[nPos] < oSheet.parts.length) {
                oRel = oSheet.parts[aMap[nPos]];

                scroll(oRel, nPos + 1, bEraseAndStop) ? aMap[nPos]++ : bExit = true;

                if (bEraseAndStop && (oRel.ref.nodeType - 1 | 1) === 3 && oRel.ref.nodeValue) {
                    bExit = true;
                    oCurrent = oRel.ref;
                    sPart = oCurrent.nodeValue;
                    oCurrent.nodeValue = '';
                }

                oSheet.ref.appendChild(oRel.ref);
                if (bExit) {
                    return false;
                }
            }

            aMap.length--;
            return true;
        }

        function typewrite() {
            if (sPart.length === 0 && scroll(aSheets[nIdx], 0, true) && nIdx++ === aSheets.length - 1) {
                clean();
                return;
            }

            oCurrent.nodeValue += sPart.charAt(0);
            sPart = sPart.slice(1);
        }
        /**
         * @desc 获取要模拟打印节点内容
         * @param oNode: 对应的dom节点
         */
        function Sheet(oNode) {
            this.ref = oNode;
            if (!oNode.hasChildNodes()) {
                return;
            }
            this.parts = Array.prototype.slice.call(oNode.childNodes);

            for (var nChild = 0; nChild < this.parts.length; nChild++) {
                oNode.removeChild(this.parts[nChild]);
                this.parts[nChild] = new Sheet(this.parts[nChild]);
            }
        }

        var
            nIntervId, oCurrent = null,
            bTyping = false,
            bStart = true,
            nIdx = 0,
            sPart = "",
            aSheets = [],
            aMap = [];

        this.rate = nRate || 100;

        this.play = function () {
            if (bTyping) {
                return;
            }
            if (bStart) {
                var aItems = document.querySelectorAll(sSelector);

                if (aItems.length === 0) {
                    return;
                }
                for (var nItem = 0; nItem < aItems.length; nItem++) {
                    aSheets.push(new Sheet(aItems[nItem]));
                    /* Uncomment the following line if you have previously hidden your elements via CSS: */
                    aItems[nItem].style.visibility = "visible";
                }

                bStart = false;
            }

            nIntervId = setInterval(typewrite, this.rate);
            bTyping = true;
        };

        this.pause = function () {
            clearInterval(nIntervId);
            bTyping = false;
        };

        this.terminate = function () {
            oCurrent.nodeValue += sPart;
            sPart = "";
            for (nIdx; nIdx < aSheets.length; scroll(aSheets[nIdx++], 0, false));
            clean();
        };
    }

    // /* usage: */
    // var oTWExample1 = new TypeWriter( /* elements: */ '#article, h1, #info, #copyleft', /* frame rate (optional): */ 15);

    // /* default frame rate is 100: */
    // var oTWExample2 = new TypeWriter('#controls');

    // /* you can also change the frame rate value modifying the "rate" property; for example: */
    // // oTWExample2.rate = 150;

    // onload = function () {
    //     oTWExample1.play();
    //     oTWExample2.play();
    // };

    window.TypeWriter = TypeWriter;
})(window, document);