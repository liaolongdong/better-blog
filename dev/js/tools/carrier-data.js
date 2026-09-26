/**
 * 生成物，别手改：`node scripts/build-prefix-data.mjs` 重跑即覆盖。
 * 来源 LSG-PolarBear/impulse @ dcacca9bf28132ca6938eb2c162e9b222ae02a53（快照 2026-09-26，
 * 许可 Apache-2.0）。机器可读清单见 `scripts/fixtures/carrier/SOURCES.json`。
 *
 * **它是单一来源**：工信部编号计划原文与第二份可交叉核对的公开整理稿都没能取到，
 * 缺口与后果记在 `SOURCES.json` 的 `knownGap` 与 `phone.js` 的 `CARRIER_NOTE` 里；
 * 判据 §F 因此只断自洽（不重叠、形状、生成侧与校验侧同结论），不断外部正确性。
 */
export const CARRIER_META = {"provider":"LSG-PolarBear/impulse","ref":"dcacca9bf28132ca6938eb2c162e9b222ae02a53","fetchedAt":"2026-09-26","license":"Apache-2.0"};
/** 运营商 → 三位号段清单（空格分隔），按运营商名排序 */
export const CARRIER_SEGMENTS = [
  ['中国广电', '192'],
  ['中国电信', '133 141 149 153 173 174 177 180 181 189 190 191 193 199'],
  ['中国移动', '134 135 136 137 138 139 147 148 150 151 152 157 158 159 172 178 182 183 184 187 188 195 197 198'],
  ['中国联通', '130 131 132 145 146 155 156 166 171 175 176 185 186 196'],
  ['虚拟运营商', '162 165 167'],
];
