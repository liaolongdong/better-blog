const app = new Vue({
  el: "#app",
  data: {
    isMove: false, // 是否在移动
    isLeft: false, // 吸附左边
    mineBtnPos: {
      x: 0, // right
      y: 400, // bottom
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    },
  },
  created() {
    this.mineBtnPos = Object.assign(this.mineBtnPos, this.btnInitStyle);
  },
  mounted() {
    this._bindEvent();
  },
  methods: {
    clickMineBtn() {
      location.href = "https://liaolongdong.com/";
    },
    /**
     * bind DOM events
     * @private
     */
    _bindEvent() {
      let that = this;
      let dWidth =
        document.documentElement.clientWidth || document.body.clientWidth;

      let $mineBtn = document.querySelector(".c-draggable-likewxfloat");
      let mWidth = $mineBtn.getBoundingClientRect().width;
      $mineBtn.addEventListener("touchstart", function (e) {
        that.mineBtnPos.startX = e.touches[0].pageX;
        that.mineBtnPos.startY = e.touches[0].pageY;
      });
      $mineBtn.addEventListener("touchend", function (e) {
        that.mineBtnPos.x = that.mineBtnPos.endX;
        that.mineBtnPos.y = that.mineBtnPos.endY;

        // 增加左右吸附效果
        // that.mineBtnPos.x的值是从右边开始计算的
        that.isMove = false;
        if (that.mineBtnPos.x < dWidth / 2) {
          that.mineBtnPos.x = 0;
          that.isLeft = false;
        } else {
          that.isLeft = true;
          that.mineBtnPos.x = dWidth - mWidth * 2;
        }
        $mineBtn.style.right = that.mineBtnPos.x + "px";

        that.mineBtnPos.startX = 0;
        that.mineBtnPos.startY = 0;
      });
      $mineBtn.addEventListener("touchmove", function (e) {
        that.isMove = true;

        if (e.touches.length > 0) {
          let offsetX = e.touches[0].pageX - that.mineBtnPos.startX,
            offsetY = e.touches[0].pageY - that.mineBtnPos.startY;
          let x = that.mineBtnPos.x - offsetX,
            y = that.mineBtnPos.y - offsetY;

          // check edge
          if (x + $mineBtn.offsetWidth > document.documentElement.offsetWidth) {
            x = document.documentElement.offsetWidth - $mineBtn.offsetWidth;
          }
          if (
            y + $mineBtn.offsetHeight >
            document.documentElement.offsetHeight
          ) {
            y = document.documentElement.offsetHeight - $mineBtn.offsetHeight;
          }
          if (x < 0) {
            x = 0;
          }
          if (y < 0) {
            y = 0;
          }
          $mineBtn.style.right = x + "px";
          $mineBtn.style.bottom = y + "px";
          that.mineBtnPos.endX = x;
          that.mineBtnPos.endY = y;
          e.preventDefault();
        }
      });
    },
  },
});
