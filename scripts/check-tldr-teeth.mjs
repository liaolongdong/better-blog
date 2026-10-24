#!/usr/bin/env node
/**
 * check-tldr 的牙齿：证明那道门在真实 front matter 上会红，且不会把未来模板判成缺陷。
 *
 * 不改仓库里的任何跟踪文件：把真实文章复制到临时目录，改坏再跑同一本门禁。
 * 七格：
 *   1. 有 tldr 的真实文章 → exit 0（门禁不是一上来就红）；
 *   2. 同一篇去掉 tldr → exit 1 且输出里点名该文件（真能红、红在正确的位置）；
 *   3. 2100 未来模板 → exit 0（未发布稿不判，避免把模板判成缺陷）；
 *   4. `tldr: # 一长串注释` → exit 1（YAML 取到 null，注释不能冒充结论）；
 *   5. 没有 `date:` 行、文件名带日期、缺 tldr → exit 1（证明日期退回文件名前缀，
 *      否则「省掉 date: 的新稿」正好绕过这道门）；
 *   6. 用 TLDR_TODAY 钉住「今天」，当天稿缺 tldr → exit 1（证明按站点时区算的 today
 *      会把当天发布的稿算进来，UTC 口径下这一格在 00:00–08:00 CST 会漏）；
 *   7. 同一个钉住的 today 下、日期晚一天 → exit 0（豁免仍生效，不是无脑全判）。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(ROOT, 'scripts/check-tldr.mjs');
const SAMPLE = path.join(ROOT, '_posts/2026-10-23-openui-two-lang-cores.md');
const FUTURE = path.join(ROOT, '_posts/2100-10-25-practice-demo.md');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tldr-teeth-'));

let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${detail ? `：${detail}` : ''}`);
}

function run(extraEnv = {}) {
  return spawnSync(process.execPath, [GATE], {
    encoding: 'utf8',
    env: { ...process.env, TLDR_POSTS_DIR: tmp, ...extraEnv },
  });
}

try {
  const sample = fs.readFileSync(SAMPLE, 'utf8');
  if (!/^tldr:/m.test(sample)) {
    console.error(`✗ 牙齿夹具失效：${path.basename(SAMPLE)} 本身没有 tldr，先修夹具`);
    process.exit(2);
  }

  fs.writeFileSync(path.join(tmp, 'good.md'), sample);
  let r = run();
  check('有 tldr → 绿', r.status === 0, `exit=${r.status} ${r.stderr.trim()}`);

  fs.writeFileSync(path.join(tmp, 'bad.md'), sample.replace(/^tldr:.*\r?\n/m, ''));
  fs.rmSync(path.join(tmp, 'good.md'));
  r = run();
  check(
    '去掉 tldr → 红且点名 bad.md',
    r.status === 1 && r.stderr.includes('bad.md'),
    `exit=${r.status} stderr=${r.stderr.trim().slice(0, 200)}`
  );

  fs.rmSync(path.join(tmp, 'bad.md'));
  fs.copyFileSync(FUTURE, path.join(tmp, 'future.md'));
  r = run();
  check('未来模板 → 跳过（绿）', r.status === 0, `exit=${r.status} ${r.stderr.trim()}`);

  // 注释冒充值：YAML 取到 null，门禁不能跟着认为「有结论」。
  fs.rmSync(path.join(tmp, 'future.md'));
  const commented = sample.replace(
    /^tldr:.*\r?\n/m,
    'tldr: # 这一行看着像结论，其实 YAML 取到的是空值，字数还远超二十个字\n'
  );
  fs.writeFileSync(path.join(tmp, 'commented.md'), commented);
  r = run();
  check(
    'tldr 只有一句注释 → 红且点名 commented.md',
    r.status === 1 && r.stderr.includes('commented.md'),
    `exit=${r.status} stderr=${r.stderr.trim().slice(0, 200)}`
  );

  // 没有 date: 行时按文件名前缀定日期，否则「省掉 date: 的新稿」正好绕过这道门。
  fs.rmSync(path.join(tmp, 'commented.md'));
  const nodeps = sample.replace(/^date:.*\r?\n/m, '').replace(/^tldr:.*\r?\n/m, '');
  if (/^date:/m.test(nodeps) || /^tldr:/m.test(nodeps)) {
    console.error('✗ 牙齿夹具失效：没能从样文里剥掉 date/tldr 行，先修夹具');
    process.exit(2);
  }
  fs.writeFileSync(path.join(tmp, '2026-10-23-nodeps.md'), nodeps);
  r = run();
  check(
    '无 date 行、文件名带日期、缺 tldr → 红且点名 2026-10-23-nodeps.md',
    r.status === 1 && r.stderr.includes('2026-10-23-nodeps.md'),
    `exit=${r.status} stderr=${r.stderr.trim().slice(0, 200)}`
  );

  // 把「今天」钉住测边界：当天的稿必须算进来，否则 00:00–08:00 CST 发的稿会静默豁免。
  fs.rmSync(path.join(tmp, '2026-10-23-nodeps.md'));
  const sameday = sample.replace(/^date:.*\r?\n/m, 'date: 2026-10-24 09:00:00 +08:00\n').replace(/^tldr:.*\r?\n/m, '');
  fs.writeFileSync(path.join(tmp, '2026-10-24-sameday.md'), sameday);
  r = run({ TLDR_TODAY: '2026-10-24' });
  check(
    '钉住 today 的当天稿缺 tldr → 红且点名 2026-10-24-sameday.md',
    r.status === 1 && r.stderr.includes('2026-10-24-sameday.md'),
    `exit=${r.status} stderr=${r.stderr.trim().slice(0, 200)}`
  );

  // 同一个钉住的 today 下，晚一天的稿仍要豁免——证明它不是无脑全判。
  fs.rmSync(path.join(tmp, '2026-10-24-sameday.md'));
  const tomorrow = sample.replace(/^date:.*\r?\n/m, 'date: 2026-10-25 09:00:00 +08:00\n').replace(/^tldr:.*\r?\n/m, '');
  fs.writeFileSync(path.join(tmp, '2026-10-25-tomorrow.md'), tomorrow);
  r = run({ TLDR_TODAY: '2026-10-24' });
  check('比钉住的 today 晚一天 → 跳过（绿）', r.status === 0, `exit=${r.status} ${r.stderr.trim().slice(0, 200)}`);

  if (failed > 0) {
    console.error(`✗ check-tldr 牙齿 ${failed} 格没咬住`);
    process.exit(1);
  }
  console.log('✓ check-tldr 牙齿 7/7 咬住');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
