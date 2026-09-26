import os
import sys
import time
import random
import subprocess
from datetime import datetime

try:
    from tqdm import tqdm
except ImportError:
    print("[*] 正在安装 tqdm ...")
    os.system("pip3 install tqdm -q")
    from tqdm import tqdm

# ---------- 全国城市及地区编码 ----------
CITY_CODES = {
    "北京市": {"北京市": "0100"},
    "天津市": {"天津市": "0220"},
    "上海市": {"上海市": "0210"},
    "重庆市": {"重庆市": "0230"},
    "河北省": {
        "石家庄市": "0311", "唐山市": "0315", "秦皇岛市": "0335", "邯郸市": "0310",
        "邢台市": "0319", "保定市": "0312", "张家口市": "0313", "承德市": "0314",
        "沧州市": "0317", "廊坊市": "0316", "衡水市": "0318", "辛集市": "0311",
        "定州市": "0312", "任丘市": "0317", "三河市": "0316"
    },
    "山西省": {
        "太原市": "0351", "大同市": "0352", "阳泉市": "0353", "长治市": "0355",
        "晋城市": "0356", "朔州市": "0349", "晋中市": "0354", "运城市": "0359",
        "忻州市": "0350", "临汾市": "0357", "吕梁市": "0358"
    },
    "辽宁省": {
        "沈阳市": "0240", "大连市": "0411", "鞍山市": "0412", "抚顺市": "0413",
        "本溪市": "0414", "丹东市": "0415", "锦州市": "0416", "营口市": "0417",
        "阜新市": "0418", "辽阳市": "0419", "盘锦市": "0427", "铁岭市": "0410",
        "朝阳市": "0421", "葫芦岛市": "0429"
    },
    "吉林省": {
        "长春市": "0431", "吉林市": "0432", "四平市": "0434", "辽源市": "0437",
        "通化市": "0435", "白山市": "0439", "松原市": "0438", "白城市": "0436",
        "延边朝鲜族自治州": "0433"
    },
    "黑龙江省": {
        "哈尔滨市": "0451", "齐齐哈尔市": "0452", "鸡西市": "0467", "鹤岗市": "0468",
        "双鸭山市": "0469", "大庆市": "0459", "伊春市": "0458", "佳木斯市": "0454",
        "七台河市": "0464", "牡丹江市": "0453", "黑河市": "0456", "绥化市": "0455",
        "大兴安岭地区": "0457"
    },
    "江苏省": {
        "南京市": "0250", "无锡市": "0510", "徐州市": "0516", "常州市": "0519",
        "苏州市": "0512", "南通市": "0513", "连云港市": "0518", "淮安市": "0517",
        "盐城市": "0515", "扬州市": "0514", "镇江市": "0511", "泰州市": "0523",
        "宿迁市": "0527"
    },
    "浙江省": {
        "杭州市": "0571", "宁波市": "0574", "温州市": "0577", "嘉兴市": "0573",
        "湖州市": "0572", "绍兴市": "0575", "金华市": "0579", "衢州市": "0570",
        "舟山市": "0580", "台州市": "0576", "丽水市": "0578"
    },
    "安徽省": {
        "合肥市": "0551", "芜湖市": "0553", "蚌埠市": "0552", "淮南市": "0554",
        "马鞍山市": "0555", "淮北市": "0561", "铜陵市": "0562", "安庆市": "0556",
        "黄山市": "0559", "滁州市": "0550", "阜阳市": "0558", "宿州市": "0557",
        "六安市": "0564", "亳州市": "0558", "池州市": "0566", "宣城市": "0563"
    },
    "福建省": {
        "福州市": "0591", "厦门市": "0592", "莆田市": "0594", "三明市": "0598",
        "泉州市": "0595", "漳州市": "0596", "南平市": "0599", "龙岩市": "0597",
        "宁德市": "0593"
    },
    "江西省": {
        "南昌市": "0791", "景德镇市": "0798", "萍乡市": "0799", "九江市": "0792",
        "新余市": "0790", "鹰潭市": "0701", "赣州市": "0797", "吉安市": "0796",
        "宜春市": "0795", "抚州市": "0794", "上饶市": "0793"
    },
    "山东省": {
        "济南市": "0531", "青岛市": "0532", "淄博市": "0533", "枣庄市": "0632",
        "东营市": "0546", "烟台市": "0535", "潍坊市": "0536", "济宁市": "0537",
        "泰安市": "0538", "威海市": "0631", "日照市": "0633", "临沂市": "0539",
        "德州市": "0534", "聊城市": "0635", "滨州市": "0543", "菏泽市": "0530"
    },
    "河南省": {
        "郑州市": "0371", "开封市": "0378", "洛阳市": "0379", "平顶山市": "0375",
        "安阳市": "0372", "鹤壁市": "0392", "新乡市": "0373", "焦作市": "0391",
        "濮阳市": "0393", "许昌市": "0374", "漯河市": "0395", "三门峡市": "0398",
        "南阳市": "0377", "商丘市": "0370", "信阳市": "0376", "周口市": "0394",
        "驻马店市": "0396", "济源市": "0391"
    },
    "湖北省": {
        "武汉市": "0270", "黄石市": "0714", "十堰市": "0719", "宜昌市": "0717",
        "襄阳市": "0710", "鄂州市": "0711", "荆门市": "0724", "孝感市": "0712",
        "荆州市": "0716", "黄冈市": "0713", "咸宁市": "0715", "随州市": "0722",
        "恩施土家族苗族自治州": "0718", "仙桃市": "0728", "潜江市": "0728", "天门市": "0728"
    },
    "湖南省": {
        "长沙市": "0731", "株洲市": "0733", "湘潭市": "0732", "衡阳市": "0734",
        "邵阳市": "0739", "岳阳市": "0730", "常德市": "0736", "张家界市": "0744",
        "益阳市": "0737", "郴州市": "0735", "永州市": "0746", "怀化市": "0745",
        "娄底市": "0738", "湘西土家族苗族自治州": "0743"
    },
    "广东省": {
        "广州市": "0200", "韶关市": "0751", "深圳市": "0755", "珠海市": "0756",
        "汕头市": "0754", "佛山市": "0757", "江门市": "0750", "湛江市": "0759",
        "茂名市": "0668", "肇庆市": "0758", "惠州市": "0752", "梅州市": "0753",
        "汕尾市": "0660", "河源市": "0762", "阳江市": "0662", "清远市": "0763",
        "东莞市": "0769", "中山市": "0760", "潮州市": "0768", "揭阳市": "0663",
        "云浮市": "0766"
    },
    "海南省": {
        "海口市": "0898", "三亚市": "0898", "三沙市": "0898", "儋州市": "0800",
        "文昌市": "0801", "琼海市": "0802", "万宁市": "0803", "东方市": "0804",
        "五指山市": "0805", "澄迈县": "0806", "定安县": "0807", "屯昌县": "0808",
        "临高县": "0809", "白沙黎族自治县": "0810", "昌江黎族自治县": "0811",
        "乐东黎族自治县": "0812", "陵水黎族自治县": "0813", "保亭黎族苗族自治县": "0814",
        "琼中黎族苗族自治县": "0815"
    },
    "四川省": {
        "成都市": "0280", "自贡市": "0813", "攀枝花市": "0812", "泸州市": "0830",
        "德阳市": "0838", "绵阳市": "0816", "广元市": "0839", "遂宁市": "0825",
        "内江市": "0832", "乐山市": "0833", "南充市": "0817", "眉山市": "0834",
        "宜宾市": "0831", "广安市": "0826", "达州市": "0818", "雅安市": "0835",
        "巴中市": "0827", "资阳市": "0832", "阿坝藏族羌族自治州": "0837",
        "甘孜藏族自治州": "0836", "凉山彝族自治州": "0834"
    },
    "贵州省": {
        "贵阳市": "0851", "六盘水市": "0858", "遵义市": "0852", "安顺市": "0853",
        "毕节市": "0857", "铜仁市": "0856", "黔西南布依族苗族自治州": "0859",
        "黔东南苗族侗族自治州": "0855", "黔南布依族苗族自治州": "0854"
    },
    "云南省": {
        "昆明市": "0871", "曲靖市": "0874", "玉溪市": "0877", "保山市": "0875",
        "昭通市": "0870", "丽江市": "0888", "普洱市": "0879", "临沧市": "0883",
        "楚雄彝族自治州": "0878", "红河哈尼族彝族自治州": "0873",
        "文山壮族苗族自治州": "0876", "西双版纳傣族自治州": "0691",
        "大理白族自治州": "0872", "德宏傣族景颇族自治州": "0692",
        "怒江傈僳族自治州": "0886", "迪庆藏族自治州": "0887"
    },
    "陕西省": {
        "西安市": "0290", "铜川市": "0919", "宝鸡市": "0917", "咸阳市": "0910",
        "渭南市": "0913", "延安市": "0911", "汉中市": "0916", "榆林市": "0912",
        "安康市": "0915", "商洛市": "0914"
    },
    "甘肃省": {
        "兰州市": "0931", "嘉峪关市": "0937", "金昌市": "0935", "白银市": "0943",
        "天水市": "0938", "武威市": "0935", "张掖市": "0936", "平凉市": "0933",
        "酒泉市": "0937", "庆阳市": "0934", "定西市": "0932", "陇南市": "0939",
        "临夏回族自治州": "0930", "甘南藏族自治州": "0941"
    },
    "青海省": {
        "西宁市": "0971", "海东市": "0972", "海北藏族自治州": "0970",
        "黄南藏族自治州": "0973", "海南藏族自治州": "0974",
        "果洛藏族自治州": "0975", "玉树藏族自治州": "0976",
        "海西蒙古族藏族自治州": "0977"
    },
    "台湾省": {
        "台北市": "02", "高雄市": "07", "台中市": "04", "台南市": "06",
        "基隆市": "02", "新竹市": "03", "嘉义市": "05", "新北市": "02",
        "桃园市": "03", "新竹县": "03", "苗栗县": "03", "彰化县": "04",
        "南投县": "04", "云林县": "05", "嘉义县": "05", "屏东县": "08",
        "宜兰县": "03", "花莲县": "03", "台东县": "08", "澎湖县": "06",
        "金门县": "08", "连江县": "08"
    },
    "内蒙古自治区": {
        "呼和浩特市": "0471", "包头市": "0472", "乌海市": "0473", "赤峰市": "0476",
        "通辽市": "0475", "鄂尔多斯市": "0477", "呼伦贝尔市": "0470",
        "巴彦淖尔市": "0478", "乌兰察布市": "0474", "兴安盟": "0482",
        "锡林郭勒盟": "0479", "阿拉善盟": "0483"
    },
    "广西壮族自治区": {
        "南宁市": "0771", "柳州市": "0772", "桂林市": "0773", "梧州市": "0774",
        "北海市": "0779", "防城港市": "0770", "钦州市": "0777", "贵港市": "0775",
        "玉林市": "0775", "百色市": "0776", "贺州市": "0774", "河池市": "0778",
        "来宾市": "0772", "崇左市": "0771"
    },
    "西藏自治区": {
        "拉萨市": "0891", "日喀则市": "0892", "昌都市": "0895", "林芝市": "0894",
        "山南市": "0893", "那曲市": "0896", "阿里地区": "0897"
    },
    "宁夏回族自治区": {
        "银川市": "0951", "石嘴山市": "0952", "吴忠市": "0953", "固原市": "0954",
        "中卫市": "0955"
    },
    "新疆维吾尔自治区": {
        "乌鲁木齐市": "0991", "克拉玛依市": "0990", "吐鲁番市": "0995",
        "哈密市": "0902", "昌吉回族自治州": "0994", "博尔塔拉蒙古自治州": "0909",
        "巴音郭楞蒙古自治州": "0996", "阿克苏地区": "0997", "克孜勒苏柯尔克孜自治州": "0908",
        "喀什地区": "0998", "和田地区": "0903", "伊犁哈萨克自治州": "0999",
        "塔城地区": "0901", "阿勒泰地区": "0906", "石河子市": "0993",
        "阿拉尔市": "0997", "图木舒克市": "0998", "五家渠市": "0994",
        "北屯市": "0906", "铁门关市": "0996", "双河市": "0909",
        "可克达拉市": "0999", "昆玉市": "0903", "胡杨河市": "0992",
        "新星市": "0902"
    },
    "香港特别行政区": {"香港特别行政区": "8520"},
    "澳门特别行政区": {"澳门特别行政区": "8530"}
}

# ---------- 运营商号段 ----------
OPERATORS = {
    "中国移动": ["134", "135", "136", "137", "138", "139", "147", "148", "150", "151", "152", "157", "158", "159", "172", "178", "182", "183", "184", "187", "188", "195", "197", "198"],
    "中国联通": ["130", "131", "132", "145", "146", "155", "156", "166", "171", "175", "176", "185", "186", "196"],
    "中国电信": ["133", "141", "149", "153", "173", "174", "177", "180", "181", "189", "190", "191", "193", "199"],
    "中国广电": ["192"],
    "虚拟运营商": ["162", "165", "167"]
}
ALL_OPERATOR_SEGMENTS = sorted(set([s for segs in OPERATORS.values() for s in segs if len(s)==3]))


def print_banner():
    try:
        result = subprocess.run("figlet -f big 'Phone Dict'", shell=True, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout:
            print("\033[91m" + result.stdout + "\033[0m")
        else:
            raise Exception
    except:
        banner = r"""
  ██████  ██░ ██  ▒█████   ███▄    █  ▓█████  ██▀███  ██▓ ▄████▄  ▄▄▄█████▓
▒██    ▒ ▓██░ ██▒▒██▒  ██▒ ██ ▀█   █  ▓█   ▀ ▓██ ▒ ██▒▓██▒██▀ ▀█  ▓  ██▒ ▓▒
░ ▓██▄   ▒██▀▀██░▒██░  ██▒▓██  ▀█ ██▒▒███   ▓██ ░▄█ ▒▒██▒▓█    ▄ ▒ ▓██░ ▒░
  ▒   ██▒░▓█ ░██ ▒██   ██░▓██▒  ▐▌██▒▒▓█  ▄ ▒██▀▀█▄  ░██░▒▓▓▄ ▄██▒░ ▓██▓ ░ 
▒██████▒▒░▓█▒░██▓░ ████▓▒░▒██░   ▓██░░▒████▒░██▓ ▒██▒░██░▒ ▓███▀ ░  ▒██▒ ░ 
▒ ▒▓▒ ▒ ░ ▒ ░░▒░▒░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ░░ ▒░ ░░ ▒▓ ░▒▓░░▓  ░ ░▒ ▒  ░  ▒ ░░   
░ ░▒  ░ ░ ▒ ░▒░ ░  ░ ▒ ▒░ ░ ░░   ░ ▒░ ░ ░  ░  ░▒ ░ ▒░ ▒ ░  ░  ▒     ░    
░  ░  ░   ░  ░░ ░░ ░ ░ ▒     ░   ░ ░    ░     ░░   ░  ▒ ░░        ░ ░      
      ░   ░  ░  ░    ░ ░           ░    ░  ░   ░      ░  ░ ░                
                                                             ░              
        """
        print("\033[92m" + banner + "\033[0m")
    print("\033[93m[!] 本工具仅限实验室授权环境使用！\033[0m\n")

# ---------- 交互选择函数 ----------
def get_choice(prompt, options, allow_custom=False, multi=False, cols=10):
    print(prompt)
    max_len = max(len(item) for item in options)
    num_len = len(str(len(options))) + 2
    col_width = max(max_len + num_len + 2, 20)

    for i, item in enumerate(options, 1):
        print(f"{i}. {item:<{col_width - len(str(i)) - 2}}", end="")
        if i % cols == 0:
            print()
    if len(options) % cols != 0:
        print()

    if multi:
        print("提示：多个选项请用逗号分隔编号，如 1,3,5")
        while True:
            raw = input("请输入编号: ").strip()
            if allow_custom and raw == str(len(options)+1):
                custom = input("请输入自定义内容（多个用逗号分隔）: ").strip()
                if custom:
                    return [c.strip() for c in custom.split(',') if c.strip()]
                else:
                    print("[-] 自定义内容不能为空。")
                    continue
            parts = [p.strip() for p in raw.split(',') if p.strip()]
            selected = []
            valid = True
            for p in parts:
                try:
                    idx = int(p) - 1
                    if 0 <= idx < len(options):
                        selected.append(options[idx])
                    else:
                        print(f"[-] 编号 {p} 无效。")
                        valid = False
                        break
                except ValueError:
                    print(f"[-] 编号 {p} 不是数字。")
                    valid = False
                    break
            if valid and selected:
                return selected
    else:
        while True:
            choice = input("请输入编号: ").strip()
            if allow_custom and choice == str(len(options)+1):
                custom = input("请输入自定义内容: ").strip()
                if custom:
                    return custom
                else:
                    print("[-] 自定义内容不能为空。")
                    continue
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(options):
                    return options[idx]
                else:
                    print("[-] 编号无效。")
            except ValueError:
                print("[-] 请输入数字。")

# ---------- 生成函数 ----------
def generate_full(prefix_list, filename):
    
    total = len(prefix_list) * 10000
    print(f"[*] 全量模式：将生成全部 {total} 个手机号。")
    written = 0
    start_time = time.time()
    with open(filename, 'w', encoding='utf-8') as f:
        pbar = tqdm(total=total, desc="生成进度", unit="条")
        for prefix in prefix_list:
            for i in range(10000):
                f.write(f"{prefix}{i:04d}\n")
                written += 1
                pbar.update(1)
                if written % 1000 == 0:
                    f.flush()
        pbar.close()
    return written, time.time() - start_time

def generate_random(prefix_list, need, filename):
    
    random.shuffle(prefix_list)  
    num_prefixes = len(prefix_list)
    base = need // num_prefixes
    extra = need % num_prefixes
    written = 0
    start_time = time.time()
    with open(filename, 'w', encoding='utf-8') as f:
        pbar = tqdm(total=need, desc="生成进度", unit="条")
        for idx, prefix in enumerate(prefix_list):
            count = base + (1 if idx < extra else 0)
            if count == 0:
                continue
            suffixes = list(range(10000))
            random.shuffle(suffixes)
            for i in suffixes[:count]:
                f.write(f"{prefix}{i:04d}\n")
                written += 1
                pbar.update(1)
                if written % 1000 == 0:
                    f.flush()
            if written >= need:
                break
        pbar.close()
    return written, time.time() - start_time

# ---------- 主程序 ----------
def main():
    print_banner()

    
    provinces = list(CITY_CODES.keys())
    province = get_choice("请选择省份:", provinces)
    print(f"[+] 已选: {province}")

    
    cities = list(CITY_CODES[province].keys())
    cities.sort()
    special_options = ["【该省全部城市】", "【全国所有城市】"]
    city_choices = cities + special_options
    selected_city = get_choice(f"请选择 {province} 的城市（或选择全部）:", city_choices)
    print(f"[+] 已选: {selected_city}")

    
    if selected_city == "【该省全部城市】":
        area_codes = []
        for c, code in CITY_CODES[province].items():
            if isinstance(code, str):
                area_codes.append(code.rjust(4, '0'))
            else:
                area_codes.extend([x.rjust(4, '0') for x in code])
        area_codes = list(set(area_codes))
        print(f"[*] 将使用 {province} 全部 {len(area_codes)} 个地区编码。")
    elif selected_city == "【全国所有城市】":
        area_codes = []
        for p, cities_dict in CITY_CODES.items():
            for c, code in cities_dict.items():
                if isinstance(code, str):
                    area_codes.append(code.rjust(4, '0'))
                else:
                    area_codes.extend([x.rjust(4, '0') for x in code])
        area_codes = list(set(area_codes))
        print(f"[*] 将使用全国全部 {len(area_codes)} 个地区编码。")
    else:
        code_raw = CITY_CODES[province][selected_city]
        if isinstance(code_raw, str):
            area_codes = [code_raw.rjust(4, '0')]
        else:
            area_codes = [x.rjust(4, '0') for x in code_raw]
        area_codes = list(set(area_codes))
        print(f"[*] 该城市地区编码: {', '.join(area_codes)}")

    
    operator_names = list(OPERATORS.keys())
    selected_ops = get_choice("请选择运营商号段（可多选）:", operator_names, multi=True)
    selected_segments = []
    for op in selected_ops:
        if op in OPERATORS:
            selected_segments.extend(OPERATORS[op])
    
    selected_segments = [seg for seg in selected_segments if len(seg) == 3]
    if not selected_segments:
        print("[-] 未选择有效3位号段，程序退出。")
        sys.exit(1)
    selected_segments = sorted(set(selected_segments))
    print(f"[+] 已选号段: {len(selected_segments)} 个，例如 {selected_segments[:5]}{'...' if len(selected_segments)>5 else ''}")

    
    prefix_list = []
    for seg in selected_segments:
        for ac in area_codes:
            prefix = seg + ac
            if len(prefix) == 7:
                prefix_list.append(prefix)
    prefix_list = sorted(set(prefix_list))
    if not prefix_list:
        print("[-] 未生成有效前7位组合，请检查号段和地区编码。")
        sys.exit(1)

    total_possible = len(prefix_list) * 10000
    print(f"[*] 总共有 {len(prefix_list)} 个不同前缀，理论最大生成数: {total_possible} 个。")

    
    print("\n请选择生成模式:")
    print("  1. 最大模式（生成全部 {} 个号码，顺序生成）".format(total_possible))
    print("  2. 自定义数量模式（随机抽取指定数量，均匀分布）")
    mode = input("请输入编号 (1 或 2): ").strip()
    while mode not in ['1', '2']:
        mode = input("输入无效，请重新输入 1 或 2: ").strip()

    if mode == '1':
        
        need = total_possible
        filename = f"phone_dict_full_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        print(f"[*] 全量生成，文件将保存为: {filename}")
        written, elapsed = generate_full(prefix_list, filename)
        print(f"\n[✅ 完成] 共生成 {written} 个手机号，耗时 {elapsed:.2f} 秒。")
        print(f"[*] 文件已保存至: {os.path.abspath(filename)}")
    else:
        
        while True:
            try:
                need = int(input("请输入要生成的手机号数量（正整数）: ").strip())
                if need <= 0:
                    print("[-] 数量必须为正整数。")
                    continue
                break
            except ValueError:
                print("[-] 请输入有效数字。")
        if need > total_possible:
            print(f"[*] 您输入的数量 ({need}) 超过理论最大值 ({total_possible})，将自动切换为最大模式，生成全部 {total_possible} 个号码。")
            filename = f"phone_dict_full_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            written, elapsed = generate_full(prefix_list, filename)
            print(f"\n[✅ 完成] 共生成 {written} 个手机号，耗时 {elapsed:.2f} 秒。")
            print(f"[*] 文件已保存至: {os.path.abspath(filename)}")
            return
        
        filename = f"phone_dict_random_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        print(f"[*] 随机模式，将生成 {need} 个号码（均匀分布，顺序随机）。")
        written, elapsed = generate_random(prefix_list, need, filename)
        print(f"\n[✅ 完成] 共生成 {written} 个手机号，耗时 {elapsed:.2f} 秒。")
        print(f"[*] 文件已保存至: {os.path.abspath(filename)}")

if __name__ == "__main__":
    main()