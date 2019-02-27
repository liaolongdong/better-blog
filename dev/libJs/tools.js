(function (window, document) {
    var tools = {
        /**
         * 日期格式化
         */
        formatDate: function (timeStamp, type) {
            console.log(666);
            let formatDateStr = '';
            let date = new Date(timeStamp);
            let year = date.getFullYear();
            let month = date.getMonth() + 1;
            let day = date.getDate();
            let hour = date.getHours();
            let minute = date.getMinutes();
            let second = date.getSeconds();
            month = month < 10 ? '0' + month : month;
            day = day < 10 ? '0' + day : day;
            hour = hour < 10 ? '0' + hour : hour;
            second = second < 10 ? '0' + second : second;
            if (type === 1) {
                formatDateStr = `${year}-${month}-${day} ${hour}:${minute}`;
            } else if (type === 2) {
                formatDateStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            } else {
                formatDateStr = `${year}-${month}-${day}`;
            }
            return formatDateStr;
        }
    }
    window.tools = tools;
})(window, document);