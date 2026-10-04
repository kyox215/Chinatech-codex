import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

function load(relative, require = () => ({})) {
  const source = readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = createContext({ exports: {}, require, URL, Response });
  runInContext(compiled, context);
  return context.exports;
}
const cleanup = load('lib/legacy-service-worker.ts');
const { legacyServiceWorkerRetirement } = load('lib/legacy-service-worker-retirement.ts');
const origin = 'https://chinatech.in';
const worker = (script = `${origin}/sw.js`) => ({ scriptURL: script });
const registration = (overrides = {}) => ({ scope: `${origin}/`, active: worker(), waiting: null, installing: null, ...overrides });

test('只识别同源根scope的精确旧worker，混合或其他注册保持', () => {
  assert.equal(cleanup.isLegacyRepairDeskRegistration(registration(), origin), true);
  for (const value of [
    registration({ scope: `${origin}/app/` }),
    registration({ active: worker('https://www.chinatech.in/sw.js') }),
    registration({ active: worker(`${origin}/new-sw.js`) }),
    registration({ active: worker(`${origin}/sw.js?unrelated=1`) }),
    registration({ active: null }),
    registration({ waiting: worker(`${origin}/future-worker.js`) }),
  ]) assert.equal(cleanup.isLegacyRepairDeskRegistration(value, origin), false);
});

test('更新失败不注销或删除缓存，新设备不新注册，其他worker不更新', async () => {
  let updates = 0;
  let unregisters = 0;
  let registers = 0;
  const old = registration({ update: async () => { updates += 1; throw new Error('offline'); }, unregister: () => { unregisters += 1; } });
  const other = registration({ scope: `${origin}/independent/`, update: () => { throw new Error('must not update'); } });
  await cleanup.requestLegacyServiceWorkerRetirement({ getRegistrations: async () => [old, other], register: () => { registers += 1; } }, origin);
  assert.equal(updates, 1);
  assert.equal(unregisters, 0);
  await cleanup.requestLegacyServiceWorkerRetirement({ getRegistrations: async () => [], register: () => { registers += 1; } }, origin);
  assert.equal(registers, 0);
});

function retirementHarness(deleteFails = false) {
  const handlers = new Map();
  const events = [];
  const replies = [];
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting: async () => events.push('skipWaiting'),
    clients: { claim: async () => events.push('claim'), matchAll: async () => [{ postMessage: (message) => replies.push(message) }] },
    registration: { unregister: async () => events.push('unregister') },
  };
  runInContext(legacyServiceWorkerRetirement, createContext({ self, caches: {
    keys: async () => ['repairdesk-shell-v2', 'repairdesk-shell-v5', 'repairdesk-attachments', 'chinatech-current-v1', 'unrelated'],
    delete: async (key) => { events.push(key); if (deleteFails) throw new Error('storage unavailable'); },
  } }));
  return { handlers, events, replies, lifecycle: async (type) => { let completion; handlers.get(type)({ waitUntil: (promise) => { completion = promise; } }); await completion; } };
}

test('退役仅删shell缓存，激活后接管并注销，无fetch处理或页面导航', async () => {
  const h = retirementHarness();
  assert.equal(h.handlers.has('fetch'), false);
  await h.lifecycle('install');
  await h.lifecycle('activate');
  assert.deepEqual(h.events, ['skipWaiting', 'claim', 'repairdesk-shell-v2', 'repairdesk-shell-v5', 'unregister']);
  assert.equal(h.replies[0].type, 'chinatech-legacy-worker-retired-v1');
  const answers = [];
  h.handlers.get('message')({ data: { type: 'chinatech-legacy-worker-status-v1' }, ports: [{ postMessage: (message) => answers.push(message) }] });
  assert.equal(answers[0].type, 'chinatech-legacy-worker-retired-v1');
});

test('激活清壳失败不注销或假报完成', async () => {
  const h = retirementHarness(true);
  await assert.rejects(h.lifecycle('activate'), /storage unavailable/);
  assert.equal(h.events.includes('claim'), true);
  assert.equal(h.events.includes('unregister'), false);
  assert.equal(h.replies.length, 0);
});

test('sw与旧探针精确协议、no-store且不清storage或cookie', async () => {
  const sw = load('app/sw.js/route.ts', () => ({ legacyServiceWorkerRetirement })).GET();
  assert.equal(sw.status, 200);
  assert.match(sw.headers.get('content-type'), /^application\/javascript/);
  assert.equal(sw.headers.get('service-worker-allowed'), '/');
  assert.match(sw.headers.get('cache-control'), /no-store/);
  assert.equal(sw.headers.get('clear-site-data'), null);
  assert.equal(await sw.text(), legacyServiceWorkerRetirement);
  const probe = load('app/recovery-probe.txt/route.ts').GET();
  assert.equal(await probe.text(), 'repairdesk-recovery-v1');
  assert.match(probe.headers.get('cache-control'), /no-store/);
  assert.equal(probe.headers.get('set-cookie'), null);
});
