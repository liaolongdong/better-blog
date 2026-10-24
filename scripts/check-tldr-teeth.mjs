#!/usr/bin/env node
/**
 * check-tldr 的牙齿：证明那道门在真实 front matter 上会红，且不会把未来模板判成缺陷。
 *
 * 不改仓库里的任何跟踪文件：把真实文章复制到临时目录，去掉 tldr 再跑同一本门禁。
 * 三格：
 *   1. 有 tldr 的真实文章 → exit 0（门禁不是一上来就红）；
 *   2. 同一篇去掉 tldr → exit 1 且输出里点名该文件（真能红、红在正确的位置）；
 *   3. 2100 未来模板 → exit 0（未发布稿不判，避免把模板判成缺陷）。
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

function run() {
  return spawnSync(process.execPath, [GATE], {
    encoding: 'utf8',
    env: { ...process.env, TLDR_POSTS_DIR: tmp },
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

  if (failed > 0) {
    console.error(`✗ check-tldr 牙齿 ${failed} 格没咬住`);
    process.exit(1);
  }
  console.log('✓ check-tldr 牙齿 3/3 咬住');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
