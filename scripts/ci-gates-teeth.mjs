#!/usr/bin/env node
/**
 * ci-gates.mjs 的牙齿台账：往临时目录里造夹具工作流，确认每一条拒跑真的会拒、
 * 红在正确的消息上，并且**绿路径也真的绿**（只测拒跑等于没测）。
 *
 * 为什么这一本必须存在：ci-gates 是「管门禁的门禁」。它坏掉的样子不是报错，而是
 * 少跑几道门然后输出 `✓ N 道门禁全绿`——评审 2026-11-01 点出的正是这一族：
 * 双引号、复合命令、形状像 gate 却读不出来的行，bash 全合法，而漏读没有任何症状。
 * 没有这份台账，「解析不到就红」这句话只是我写的一句形容词。
 *
 * 用法：node scripts/ci-gates-teeth.mjs [--keep]
 * 退出码：0 = 全部如期；1 = 有案例不成立（假牙）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(REPO, 'scripts/ci-gates.mjs');
const KEEP = process.argv.includes('--keep');

if (!fs.existsSync(RUNNER)) { console.error(`✗ 找不到 ${RUNNER}`); process.exit(1); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gates-teeth-'));
const cleanup = () => { if (!KEEP) fs.rmSync(TMP, { recursive: true, force: true }); };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

/** 造一棵最小树：ROOT 由运行器自己的位置推出，所以把它放进 tmp/scripts 就够了 */
function fixture(workflowBody, extraScripts = {}) {
  const root = fs.mkdtempSync(path.join(TMP, 'case-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  fs.copyFileSync(RUNNER, path.join(root, 'scripts', 'ci-gates.mjs'));
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'jekyll.yml'), workflowBody);
  for (const [name, src] of Object.entries(extraScripts)) {
    fs.writeFileSync(path.join(root, 'scripts', name), src);
  }
  return root;
}

const head = 'name: x\non: push\njobs:\n  b:\n    runs-on: ubuntu-24.04\n    steps:\n      - name: Site gates\n        run: |\n';
const okScript = 'process.exit(0);\nconsole.log("ok gate");\n';
const badScript = 'console.error("boom");process.exit(3);\n';
const killScript = 'process.kill(process.pid, "SIGTERM");\n';
const slowScript = 'setTimeout(() => console.log("本来该被超时掐掉"), 60000);\n';
/** 跑完把 _posts/a.md 改脏且不还原——这正是牙齿应当自己擦干净而没擦干净的形状 */
const dirtyScript = 'import fs from "node:fs";\nfs.appendFileSync("_posts/a.md", "\\nMutated");\n';

/** 在 fixture 之上再铺一层 git 树：脏源自证只在真的 git 仓库里才判得动 */
function gitFixture(workflowBody, scripts) {
  const root = fixture(workflowBody, scripts);
  fs.mkdirSync(path.join(root, '_posts'), { recursive: true });
  fs.writeFileSync(path.join(root, '_posts', 'a.md'), 'original\n');
  const git = (...a) => spawnSync('git', ['-c', 'user.email=t@e', '-c', 'user.name=t', ...a], { cwd: root, encoding: 'utf8' });
  if (git('init', '-q').status !== 0) return root;
  git('add', '-A');
  git('commit', '-q', '-m', 'seed');
  return root;
}

/** 一条 gate 行的夹具（缩进 10 空格 = jekyll.yml 里 run 块内的真实形状） */
const one = (line) => `${head}${line}\n`;

const cases = [
  {
    name: '清单为空（run 块里一道门都没有）',
    want: 1,
    expect: '0 道不算绿',
    root: fixture(head + '          echo hi\n'),
  },
  {
    name: '门禁脚本不存在',
    want: 1,
    expect: '仓库里没有这个文件',
    root: fixture(one("          gate 'fake' scripts/gone.mjs")),
  },
  {
    name: '清单指向运行器自己（递归）',
    want: 1,
    expect: '指向本运行器自己',
    root: fixture(one("          gate 'self' scripts/ci-gates.mjs")),
  },
  {
    name: '双引号写的门也必须被读到（漏读=少跑一道还报绿）',
    want: 1,
    expect: '仓库里没有这个文件',
    label: 'dq',
    root: fixture(one('          gate "dq" scripts/gone-dq.mjs')),
  },
  {
    name: '一条里塞两个门（复合命令）',
    want: 1,
    expect: '2 个 gate 词元',
    root: fixture(one("          gate 'a' scripts/ok.mjs && gate 'b' scripts/ok.mjs"), { 'ok.mjs': okScript }),
  },
  {
    name: '一道门后面挂管道（词元只有一个，但命令被改写）',
    want: 1,
    expect: '复合命令',
    root: fixture(one("          gate 'a' scripts/ok.mjs | tee log"), { 'ok.mjs': okScript }),
  },
  {
    name: 'for 循环里的门：行首不是 gate，宽松驱动必须逮住而不是跳过',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one("          gate 'a' scripts/ok.mjs\n          for f in b; do gate \"$f\" scripts/ok.mjs; done"), { 'ok.mjs': okScript }),
  },
  {
    name: 'if 包裹的门：条件不成立时那道门根本不跑，不能算跑过',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one('          if [ -f x ]; then gate \'b\' scripts/ok.mjs; fi'), { 'ok.mjs': okScript }),
  },
  {
    name: 'time 前缀的门：bash 合法，但运行器的行锚定看不见它',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one("          time gate 'b' scripts/ok.mjs"), { 'ok.mjs': okScript }),
  },
  {
    name: '形状像 gate 却读不出参数',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one("          gate 'noargs'")),
  },
  {
    name: 'ANSI-C 引用写的门（$\'x\'）：bash 合法，宽松驱动必须逮住它而不是跳过',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one('          gate $\'ansi\' scripts/ok.mjs'), { 'ok.mjs': okScript }),
  },
  {
    name: '同一棵树里既有能读的门又有读不出的门：不许只跑能读的那道就报绿',
    want: 1,
    expect: '读不出名字与参数',
    root: fixture(one("          gate 'ok' scripts/ok.mjs\n          gate $'ansi' scripts/ok.mjs"), { 'ok.mjs': okScript }),
  },
  {
    name: '--only 匹配不到任何门',
    want: 1,
    expect: '一条都没匹配上',
    args: ['--only=不存在的东西'],
    root: fixture(one("          gate 'ok' scripts/ok.mjs"), { 'ok.mjs': okScript }),
  },
  {
    name: '绿路径：一道真存在的门跑通',
    want: 0,
    expect: '1 道门禁全绿',
    root: fixture(one("          gate 'ok' scripts/ok.mjs"), { 'ok.mjs': okScript }),
  },
  {
    name: '红路径：门自己退出码 3',
    want: 1,
    expect: '退出码 3',
    root: fixture(one("          gate 'bad' scripts/bad.mjs"), { 'bad.mjs': badScript }),
  },
  {
    name: '被信号杀死算「没跑完」，退 2 而不是退 1',
    want: 2,
    expect: '这是没跑完',
    root: fixture(one("          gate 'kill' scripts/kill.mjs"), { 'kill.mjs': killScript }),
  },
  {
    name: '一道门挂死必须被超时掐掉，且算「没跑完」（否则它吃掉 workflow 的 20 分钟，后面的门根本没跑）',
    want: 2,
    expect: '超时',
    env: { CI_GATES_TIMEOUT: '1500' },
    root: fixture(one("          gate 'slow' scripts/slow.mjs"), { 'slow.mjs': slowScript }),
  },
  {
    name: '门跑完把跟踪源改脏了没还原：必须红，因为后面的门读的是被改过的源',
    want: 1,
    expect: '没还原',
    root: gitFixture(one("          gate 'dirty' scripts/dirty.mjs"), { 'dirty.mjs': dirtyScript }),
  },
  {
    name: 'expectGreen：门改脏了又自己还原，就不该报脏（否则这条自证会把正常牙齿一起判死）',
    want: 0,
    expect: '1 道门禁全绿',
    root: gitFixture(one("          gate 'clean' scripts/clean.mjs"), {
      'clean.mjs': 'import fs from "node:fs";\nconst f = "_posts/a.md";\nconst before = fs.readFileSync(f);\nfs.appendFileSync(f, "\\nMutated");\nfs.writeFileSync(f, before);\n',
    }),
  },
];

let pass = 0;
const problems = [];
for (const c of cases) {
  const r = spawnSync(process.execPath, [path.join(c.root, 'scripts', 'ci-gates.mjs'), ...(c.args || [])], {
    cwd: c.root,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, ...(c.env || {}) },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const label = c.label ? `${c.name}（消息里应带上 ${c.label} 或那个脚本名，否则不知道红在哪一条）` : c.name;
  if (r.status !== c.want) {
    problems.push(`✗ ${label}：期望退出码 ${c.want}，实得 ${r.status}（信号 ${r.signal || '无'}）\n${out.split('\n').filter(Boolean).slice(-2).join('\n')}`);
    continue;
  }
  if (!out.includes(c.expect)) {
    problems.push(`✗ ${label}：退出码对，但输出里没有一句含 ${JSON.stringify(c.expect)}：\n${out.split('\n').filter(Boolean).slice(-3).join('\n')}`);
    continue;
  }
  /** 拒跑类案例必须说清是哪一条 gate：只报「校验未过」等于让人去猜 */
  if (c.label && !out.includes(c.label) && !out.includes('gone-dq')) {
    problems.push(`✗ ${label}：红了，但消息里既没有门名也没有脚本名，定位不到是哪一条`);
    continue;
  }
  pass += 1;
  console.log(`✓ ${c.name}`);
}

console.log(`\n牙齿台账：${pass}/${cases.length} 条如期`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('✓ ci-gates 的每条拒跑都真的拒，绿路径也真的绿');
