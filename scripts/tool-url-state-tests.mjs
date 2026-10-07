#!/usr/bin/env node
/**
 * `dev/js/tools/url-state.js` 的 Node 单测（SP2 第一刀的门禁①）。
 *
 * 为什么不并进 `scripts/toolkit-tests.mjs`：那本按 `// ── §([B-Z]\d*) ` 切段
 * （见 `verify-plan-blocks.mjs:276`），而每一段都必须在 `_docs/superpowers/plans/` 那五份计划里
 * 有一枚逐字节全等的镜像块。新起一段就得往段 5 那份 diff 页的计划里贴一整块不属于它的代码；
 * 另起一本、不挂镜像，是「新增」与「既有镜像账」分开的最便宜形状。
 *
 * 这一本只测纯逻辑：`location` 与 `history` 全是假件，真浏览器里那一条路归
 * `scripts/verify-tool-url.mjs`（U1–U7）。
 *
 * 用法：`node scripts/tool-url-state-tests.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, nextSearch, sync } from '../dev/js/tools/url-state.js';

const KEYS = [
  { name: 'jt-view', kind: 'select', options: ['text', 'tree'], dflt: 'text' },
  { name: 'jt-indent', kind: 'select', options: ['two', 'four', 'tab'], dflt: 'two' },
  { name: 'df-ws', kind: 'check', dflt: false },
];

/** 假的一页地址：`sync` 只能看见这四格，看见别的就算越界 */
const page = (search, hash = '') => {
  const calls = [];
  return {
    loc: { search, hash, pathname: '/better-blog/tools/json.html' },
    hist: {
      state: null,
      calls,
      replaceState(state, title, url) { calls.push({ state, title, url }); },
      pushState() { throw new Error('不许 pushState：改档位不是新历史，后退不该先退回上一个档位'); },
    },
  };
};

// ── 读侧：白名单是唯一的那道门 ──────────────────────────────────────────────

test('U0-1 读：白名单内的值才回来', () => {
  const r = parse('?utm_source=x&jt-view=tree&jt-indent=tab', KEYS);
  assert.deepEqual(r.found, { 'jt-view': 'tree', 'jt-indent': 'tab' });
  assert.deepEqual(r.ignored, []);
});

test('U0-2 读：白名单外的值点名进 ignored，且不回来任何值', () => {
  const r = parse('?jt-view=dark', KEYS);
  assert.deepEqual(r.found, {});
  assert.deepEqual(r.ignored, ['jt-view']);
});

test('U0-3 读：空串与缺席同档（都算「这一格没人说话」）', () => {
  assert.deepEqual(parse('?jt-view=', KEYS).found, {});
  assert.deepEqual(parse('', KEYS).found, {});
  assert.deepEqual(parse('?jt-view=', KEYS).ignored, [], '空串不是「非法值」，不该点名');
});

test('U0-4 读：check 只认 1，0 与 yes 都进 ignored', () => {
  assert.equal(parse('?df-ws=1', KEYS).found['df-ws'], true);
  assert.deepEqual(parse('?df-ws=0', KEYS).ignored, ['df-ws'], '0 与「键缺席」同形，写侧从不产 0');
  assert.deepEqual(parse('?df-ws=yes', KEYS).ignored, ['df-ws']);
});

test('U0-5 读：畸形 search 不抛，能认的那一格照样认', () => {
  assert.deepEqual(parse('=?&=&jt-view=tree', KEYS).found, { 'jt-view': 'tree' });
});

// ── 写侧：只动自己那几个键 ──────────────────────────────────────────────────

test('U0-6 写：我的键一个都没变时不写，一次 replaceState 都不许发生', () => {
  const p = page('?utm_source=x');
  assert.equal(nextSearch('?utm_source=x', KEYS, { 'jt-view': 'text', 'jt-indent': 'two', 'df-ws': false }), null);
  assert.equal(sync(p.loc, p.hist, KEYS, { 'jt-view': 'text', 'jt-indent': 'two', 'df-ws': false }), false);
  assert.equal(p.hist.calls.length, 0);
});

test('U0-7 写：落回默认就删键，别人的键留着', () => {
  const got = nextSearch('?utm_source=x&jt-view=tree', KEYS, { 'jt-view': 'text', 'jt-indent': 'two', 'df-ws': false });
  assert.equal(got, 'utm_source=x', 'tree 是 jt-view 的非默认值，text 是默认值 → 键必须消失');
});

test('U0-8 写：从现有 search 起建，别人的键原样有序，新键排末尾', () => {
  assert.equal(
    nextSearch('z=9&utm_source=x', KEYS, { 'jt-view': 'tree', 'jt-indent': 'two', 'df-ws': false }),
    'z=9&utm_source=x&jt-view=tree');
});

test('U0-9 写：只用 replaceState，地址栏里那枚 push 的手是废的', () => {
  const p = page('');
  assert.equal(sync(p.loc, p.hist, KEYS, { 'jt-view': 'tree', 'jt-indent': 'four', 'df-ws': true }), true);
  assert.equal(p.hist.calls.length, 1);
  assert.equal(p.hist.calls[0].url, '/better-blog/tools/json.html?jt-view=tree&jt-indent=four&df-ws=1');
});

test('U0-10 写：history.state 原样带走（同一引用）', () => {
  const p = page('');
  p.hist.state = { scroll: 12 };
  assert.equal(sync(p.loc, p.hist, KEYS, { 'jt-view': 'tree', 'jt-indent': 'two', 'df-ws': false }), true);
  assert.equal(p.hist.calls[0].state, p.hist.state);
});

test('U0-11 写：hash 与档位共存，不洗掉 #section-2', () => {
  const p = page('', '#section-2');
  assert.equal(sync(p.loc, p.hist, KEYS, { 'jt-view': 'tree', 'jt-indent': 'two', 'df-ws': false }), true);
  assert.equal(p.hist.calls[0].url, '/better-blog/tools/json.html?jt-view=tree#section-2');
});

test('U0-12 写：replaceState 抛（Safari 30 秒 100 次那一档）就是 false，绝不上抛', () => {
  const p = page('');
  p.hist.replaceState = () => { throw new Error('SecurityError: attempt to use replaceState too often'); };
  assert.equal(sync(p.loc, p.hist, KEYS, { 'jt-view': 'tree', 'jt-indent': 'two', 'df-ws': false }), false);
});
