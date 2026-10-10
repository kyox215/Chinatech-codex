import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const localRequire = name => name.startsWith('./') ? load('lib/toolbox/' + name.slice(2) + '.ts') : require(name);
  runInContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, createContext({ exports, require: localRequire, Buffer, Date, process: { env: {} } }));
  return exports;
}
const api = load('lib/toolbox/office-desktop-public-token.ts'), legacy = load('lib/toolbox/office-desktop-token.ts'), key = Buffer.alloc(32, 47), now = Date.now();
const grant = { v: 2, mode: 'public', grantId: randomUUID(), installationId: randomUUID(), appVersion: '0.2.0', epoch: '90', exp: now + 3600000 };
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
test('desktop versions use numeric segments and reject ambiguous or malformed strings', () => {
  assert.equal(api.compareDesktopVersions('0.10.0', '0.2.0'), 1); assert.equal(api.compareDesktopVersions('1.0.0', '0.65535.65535'), 1); assert.equal(api.compareDesktopVersions('0.2.0', '0.2.0'), 0);
  for (const value of ['0.02.0', '0.2', '0.2.0-beta', ' 0.2.0', '0.2.0 ', '0.2.65536', '0.2.0.0', null, 2]) rejects(() => api.desktopVersion(value), 'INVALID_REQUEST');
});
test('anonymous capability validates an exact schema without legacy license or key claims', () => {
  const token = api.signPublicDesktopSession(grant, key);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readPublicDesktopSession(token, key, now))), grant);
  assert.equal(api.isPublicDesktopToken(token), true);
  for (const patch of [{ licenseId: randomUUID() }, { keyHash: 'a'.repeat(64) }, { mode: 'admin' }, { appVersion: '0.02.0' }, { grantId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, { exp: String(grant.exp) }]) rejects(() => api.readPublicDesktopSession(api.signPublicDesktopSession({ ...grant, ...patch }, key), key, now), 'SESSION_INVALID');
});
test('v1 and v2 HMAC domains cannot be exchanged or promoted', () => {
  const publicToken = api.signPublicDesktopSession(grant, key);
  rejects(() => legacy.readDesktopSession(publicToken, key, now), 'SESSION_INVALID');
  rejects(() => api.readPublicDesktopSession(legacy.signDesktopSession(grant, key), key, now), 'SESSION_INVALID');
  const [encoded, signature] = publicToken.split('.');
  const altered = Buffer.from(JSON.stringify({ ...grant, epoch: '91' })).toString('base64url');
  rejects(() => api.readPublicDesktopSession(altered + '.' + signature, key, now), 'SESSION_INVALID');
  rejects(() => api.readPublicDesktopSession(encoded + '.' + signature + '.extra', key, now), 'SESSION_INVALID');
  rejects(() => api.readPublicDesktopSession(publicToken, Buffer.alloc(32, 48), now), 'SESSION_INVALID');
});
test('public capability lifetime is bounded to its original hour and expiry is not renewable', () => {
  const token = api.signPublicDesktopSession(grant, key);
  rejects(() => api.readPublicDesktopSession(token, key, grant.exp), 'SESSION_EXPIRED');
  rejects(() => api.readPublicDesktopSession(api.signPublicDesktopSession({ ...grant, exp: now + 3600001 }, key), key, now), 'SESSION_EXPIRED');
  assert.equal(api.signPublicDesktopSession(grant, key), token);
});
