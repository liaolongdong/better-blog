#!/usr/bin/env node
/**
 * `scripts/delivery-lock.sh` 的行为测试：无人值守写作流水线的那把跨进程交付锁。
 *
 * 为什么这一本要进 CI：锁管的是「两个 run 不能同时写同一批最终产物」。它坏掉没有症状——
 * 两个 run 都自认为持锁，文章、图片、公众号草稿交错写入，事后只看见一份说不清是谁的稿子。
 * 这类失效（互斥、失败关闭、所有权）用眼睛读 bash 是读不出来的，只能真的并发跑一遍。
 * 2026-11-02 之前它只有 `_drafts/` 里的一份本地副本 + 一个没人调用的测试文件，等于没有测试。
 *
 * 覆盖的六种形状：
 *   1. 别人不能释放不属于自己的锁（含大小写不同的同名校验）；
 *   2. 空 / `../escape` / `.` / `a/b` / 带空格 / 大写——这些 owner 一律不动锁；
 *   3. 锁被占时 `acquire` 超时退 2，且不换主人；
 *   4. 光「锁很老了」不构成抢锁的理由；
 *   5. 半途而废的锁目录（有目录无 owner 文件）失败关闭：既不 acquire 也不 release；
 *   6. 两个进程同时 acquire 恰好一个赢；等待方只在持锁方释放后才拿到锁。
 *
 * 用法：node --test scripts/delivery-lock-tests.mjs
 * 退出码：0 = 六个用例全过；1 = 有断言不成立（`node:test` 的口径）。
 * 失败形状：夹具在 `os.tmpdir()` 里造一棵假仓库根，锁落在 `<tmp>/_drafts/.delivery.lock`——
 * 不碰真仓库的 `_drafts/`，所以正在跑的流水线不会被测试抢锁或清锁。
 */
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_SCRIPT = path.join(repoRoot, 'scripts', 'delivery-lock.sh');
const runBash = promisify(execFile);

if (!fs.existsSync(LOCK_SCRIPT)) {
  console.error(`✗ 读不到 ${path.relative(repoRoot, LOCK_SCRIPT)}：锁脚本搬走了而这份测试还认老路径`);
  process.exit(1);
}

/** 一棵临时仓库根：脚本按 `$0` 的上一级算 ROOT，所以把它放进 `<tmp>/scripts/` 就够了 */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '_drafts'), { recursive: true });
  const script = path.join(dir, 'scripts', 'delivery-lock.sh');
  fs.copyFileSync(LOCK_SCRIPT, script);
  const run = (...args) => spawnSync('bash', [script, ...args], { encoding: 'utf8', timeout: 2000 });
  return { dir, script, run, lock: path.join(dir, '_drafts', '.delivery.lock') };
}

test('another run cannot release the owner lock', (t) => {
  const { run } = fixture(t);
  assert.equal(run('acquire', 'job-a-1', '0').status, 0);
  assert.equal(run('release', 'job-b-1').status, 1);
  assert.equal(run('release', 'JOB-A-1').status, 1);
  assert.match(run('status').stdout, /^LOCKED/m);
  assert.equal(run('release', 'job-a-1').status, 0);
  assert.match(run('status').stdout, /^UNLOCKED/m);
});

test('missing and unsafe owner IDs cannot mutate the lock', (t) => {
  const { run, lock } = fixture(t);
  for (const owner of ['', '../escape', '.', 'a/b', 'a b', 'RunA']) {
    assert.equal(run('acquire', owner, '0').status, 1, owner);
    assert.equal(fs.existsSync(lock), false);
  }
  assert.equal(run('acquire', 'job-a-1', 'invalid').status, 1);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(run('acquire', 'job-a-1', '0').status, 0);
  assert.equal(run('release').status, 1);
  assert.match(run('status').stdout, /^LOCKED/m);
});

test('a busy lock times out without changing its owner', (t) => {
  const { run } = fixture(t);
  assert.equal(run('acquire', 'job-a-1', '0').status, 0);
  assert.equal(run('acquire', 'job-b-1', '0').status, 2);
  assert.match(run('status').stdout, /job-a-1/);
  assert.equal(run('release', 'job-a-1').status, 0);
  assert.equal(run('acquire', 'job-b-1', '0').status, 0);
  assert.equal(run('release', 'job-a-1').status, 1);
  assert.match(run('status').stdout, /job-b-1/);
});

test('age alone never authorizes stealing a lock', (t) => {
  const { run, lock } = fixture(t);
  assert.equal(run('acquire', 'job-a-1', '0').status, 0);
  const old = new Date(Date.now() - 3600_000);
  for (const file of fs.readdirSync(lock)) fs.utimesSync(path.join(lock, file), old, old);
  assert.equal(run('acquire', 'job-b-1', '0').status, 2);
  assert.equal(run('release', 'job-a-1').status, 0);
});

test('incomplete acquisition fails closed', (t) => {
  const { run, lock } = fixture(t);
  fs.mkdirSync(lock);
  assert.equal(run('acquire', 'job-b-1', '0').status, 2);
  assert.equal(run('release', 'job-b-1').status, 1);
  assert.equal(fs.existsSync(lock), true);
});

test('two simultaneous acquisitions have exactly one winner', async (t) => {
  const { run, script } = fixture(t);
  const owners = ['job-a-1', 'job-b-1'];
  const results = await Promise.all(owners.map(async (owner) => {
    try {
      await runBash('bash', [script, 'acquire', owner, '0'], { timeout: 2000 });
      return 0;
    } catch (error) {
      return error.code;
    }
  }));
  assert.deepEqual([...results].sort(), [0, 2]);
  assert.equal(run('release', owners[results.indexOf(0)]).status, 0);
});

test('a waiting run acquires only after the owner releases', async (t) => {
  const { run, script } = fixture(t);
  assert.equal(run('acquire', 'job-a-1', '0').status, 0);
  const waiting = runBash('bash', [script, 'acquire', 'job-b-1', '3'], { timeout: 5000 });
  assert.equal(run('release', 'job-a-1').status, 0);
  await waiting;
  assert.match(run('status').stdout, /job-b-1/);
  assert.equal(run('release', 'job-b-1').status, 0);
});
