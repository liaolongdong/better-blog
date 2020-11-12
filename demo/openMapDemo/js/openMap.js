/*
 * @Author: liaolongdong
 * @Date: 2020-11-10 15:05:47
 * @LastEditTime: 2020-11-12 09:23:11
 * @LastEditors: liaolongdong
 * @Description: 打开导航地图组件
 */

Vue.component("OpenMap", {
  template: `
        <div v-if="visible" class="container">
            <div @click="close" class="mask"></div>
            <div class="content">
                <div class="header">
                    <p class="lv1">使用地图打开导航</p>
                    <p class="lv2">如果点击无响应，可能是您还没有安装该APP</p>
                </div>
                <div class="list">
                    <a @click="gaode" href="javascript:void(0)">高德地图</a>
                </div>
                <div class="list">
                    <a @click="baidu" href="javascript:void(0)">百度地图</a>
                </div>
                <div class="list">
                    <a @click="tengxun" href="javascript:void(0)">腾讯地图</a>
                </div>
                <div @click="close" class="footer">取消</div>
            </div>
        </div>
    `,
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 目标地址数据
    openMapData: {
      type: Object,
      default: () => {
        return {};
      },
    },
    // 当前地址数据
    localPosition: {
      type: Object,
      default: () => {
        return {};
      },
    },
  },
  data() {
    return {
      isIos: false,
    };
  },
  created() {
    this.isIos = /(iPhone|iPad|iPod|iOS)/i.test(window.navigator.userAgent);
  },
  methods: {
    // 打开百度地图
    // http://lbsyun.baidu.com/index.php?title=uri/api/android
    baidu() {
      const str = this.isIos ? "baidumap" : "bdapp";
      // const url = `${str}://map/direction?region=我的位置&origin=${this.localPosition.lat},${this.localPosition.lon}&destination=${this.openMapData.lat},${this.openMapData.lon}&coord_type=bd09ll&mode=driving&src=andr.baidu.openAPIdemo`;
      const url = `${str}://map/direction?origin=name:我的位置|latlng:${this.localPosition.lat},${this.localPosition.lon}&destination=name:${this.openMapData.addr}|latlng:${this.openMapData.lat},${this.openMapData.lon}&coord_type=bd09ll&mode=driving&src=andr.baidu.openAPIdemo`;
      window.location.href = url;
    },
    // 打开高德地图
    // https://lbs.amap.com/api/amap-mobile/guide/android/route
    gaode() {
      let localResult = gcoord.transform(
        [this.localPosition.lon, this.localPosition.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      let opendResult = gcoord.transform(
        [this.openMapData.lon, this.openMapData.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      const str = this.isIos ? "iosamap" : "androidamap";
      const url = `${str}://route/plan/?sid=&slat=${localResult[1]}&slon=${localResult[0]}&sname=我的位置&did=&dlat=${opendResult[1]}&dlon=${opendResult[0]}&dname=${this.openMapData.addr}&dev=1&t=0`;
      window.location.href = url;
    },
    // 打开腾讯地图
    tengxun() {
      let localResult = gcoord.transform(
        [this.localPosition.lon, this.localPosition.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      let opendResult = gcoord.transform(
        [this.openMapData.lon, this.openMapData.lat], // 经纬度坐标
        gcoord.BD09, // 当前坐标系
        gcoord.GCJ02 // 目标坐标系
      );
      const url = `qqmap://map/routeplan?type=drive&from=我的位置&fromcoord=${localResult[1]},${localResult[0]}&to=${this.openMapData.addr}&tocoord=${opendResult[1]},${opendResult[0]}&referer=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77`;
      window.location.href = url;
    },
    close() {
      this.$emit("update:visible", false);
    },
  },
});
