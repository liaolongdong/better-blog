#!/usr/bin/env node
/**
 * `pnpm dev` 的地基检查：Jekyll 的端口被人占着，就别白跑一趟整站生成。
 *
 * 为什么要有这个脚本：`bundle exec jekyll serve` 撞上 EADDRINUSE 时，不带 `--trace`
 * 只吐一个红色方块让人「append --trace 看详情」，真凶（Address already in use）被吞掉，
 * 而这之前 Jekyll 已经生成完整个 `_site`（本机实测 19 秒）。占坑的通常就是上一次没退干净
 * 的 `jekyll serve`——本仓有一条常驻 serve 的老规矩，所以这一步不是假想敌。
 *
 * 端口从 `_config.yml` 的 `port` 取，取不到按 Jekyll 默认的 4000：与 vite.demo.config.mjs
 * 读 baseurl 同一套单一事实来源，不在这里写死一个会和配置漂移的数。
 */
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 从 `_config.yml` 顶层的 `port:` 取开发端口；没有这一项时是 Jekyll 的默认值 4000。
 * @returns {number} 要探测的端口
 */
function devPort() {
  const matched = readFileSync(resolve(ROOT, '_config.yml'), 'utf8').match(/^port:\s*(\d+)\s*$/m);
  return matched ? Number(matched[1]) : 4000;
}

/**
 * 谁在听这个端口。`lsof` 在 Windows 上没有，探不到就不报——宁可少一行线索，
 * 也不能让「查occupant」这件事本身把检查搞成第二种失败。
 * @param {number} port
 * @returns {string|null} 一行占用者信息，取不到返回 null
 */
function listenerOf(port) {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out ? out.split('\n').join(', ') : null;
  } catch {
    return null;
  }
}

const port = devPort();
const probe = createServer();

probe.once('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(`[dev] 探测 ${port} 端口失败：${err.message}`);
    process.exit(1);
  }
  const holder = listenerOf(port);
  console.error(`[dev] ${port} 端口已被占用，Jekyll 起不来（Errno::EADDRINUSE），已中止。`);
  if (holder) console.error(`[dev] 占用进程 PID：${holder}——多半是上一次没退干净的 jekyll serve。`);
  console.error(`[dev] 让开它：kill ${holder ?? '<那个 PID>'}  ；或换端口：bundle exec jekyll serve --port ${port + 1}`);
  process.exit(1);
});

// Jekyll 绑的是 127.0.0.1，探测也绑同一个地址，别用默认的 ::（双栈下会把 IPv4 占用漏掉）。
probe.listen(port, '127.0.0.1', () => probe.close(() => process.exit(0)));
