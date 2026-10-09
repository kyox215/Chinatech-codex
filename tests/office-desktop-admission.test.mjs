import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
const identity = { userId: randomUUID(), sessionId: randomUUID() };
const row = { enabled: false, revision: '2', updated_at: new Date('2026-10-01T00:00:00Z') };
function load(file, replacements = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = id => id === 'server-only' ? {} : Object.hasOwn(replacements, id) ? replacements[id] : nativeRequire(id);
  runInContext(source, createContext({ exports, require, Buffer, URL, Date, BigInt, process: { env: { OFFICE_DESKTOP_SIGNING_KEY: '19'.repeat(32) }, cwd: () => process.cwd() }, console, setTimeout }));
  return exports;
}
const token = load('lib/toolbox/office-desktop-token.ts');
function fixture(receipt) {
  const writes = [], calls = [];
  const tx = async (parts, ...values) => {
    const query = parts.join('?'); calls.push(query);
    if (query.includes('select admin_user_id')) return [{ admin_user_id: identity.userId }];
    if (query.includes('select enabled,revision')) return [row];
    if (query.includes('select actor_id,session_id')) return receipt ? [receipt] : [];
    if (/^(update|insert)/.test(query)) writes.push({ query, values });
    return [];
  };
  const api = load('lib/toolbox/office-desktop-admission.ts', { '@/lib/backend/database': { withDatabase: async (_identity, _store, run) => run(tx) }, './office-desktop-token': token });
  return { api, calls, writes };
}

test('admission rejects malformed revisions and request IDs before a database mutation', async () => {
  const { api, calls } = fixture();
  const valid = { enabled: false, expectedRevision: '2', requestId: randomUUID() };
  for (const patch of [{ enabled: 0 }, { expectedRevision: '02' }, { expectedRevision: '-1' }, { expectedRevision: '9223372036854775808' }, { expectedRevision: 2 }, { requestId: 'not-a-uuid' }]) {
    await assert.rejects(api.changeDesktopAdmission(identity, { ...valid, ...patch }), e => e.code === 'INVALID_REQUEST');
  }
  assert.equal(calls.length, 0);
});

test('replaying an earlier toggle cannot restore its old requested state', async () => {
  const requestId = randomUUID();
  const { api, writes } = fixture({ actor_id: identity.userId, session_id: identity.sessionId, requested_enabled: true, expected_revision: '0' });
  const result = await api.changeDesktopAdmission(identity, { requestId, enabled: true, expectedRevision: '0' });
  assert.equal(result.enabled, false);
  assert.equal(result.revision, '2');
  assert.deepEqual(writes, []);
});

test('a receipt cannot be reused with another session, body or expected version', async () => {
  const requestId = randomUUID();
  const receipt = { actor_id: identity.userId, session_id: identity.sessionId, requested_enabled: false, expected_revision: '2' };
  for (const mismatch of [{ actor_id: randomUUID() }, { session_id: randomUUID() }, { requested_enabled: true }, { expected_revision: '1' }]) {
    const { api, writes } = fixture({ ...receipt, ...mismatch });
    await assert.rejects(api.changeDesktopAdmission(identity, { requestId, enabled: false, expectedRevision: '2' }), e => e.code === 'REQUEST_CONFLICT' && e.status === 409);
    assert.deepEqual(writes, []);
  }
});

test('a stale revision rejects even a no-change toggle, with no receipt or state write', async () => {
  const { api, writes } = fixture();
  await assert.rejects(api.changeDesktopAdmission(identity, { requestId: randomUUID(), enabled: false, expectedRevision: '1' }), e => e.code === 'REQUEST_CONFLICT');
  assert.deepEqual(writes, []);
});

test('pausing new sessions denies unlock before license lookup or device registration', async () => {
  const calls = [];
  const api = load('lib/toolbox/office-desktop-server.ts', {
    '@/lib/backend/database': { withOfficeDesktopDatabase: async (_hash, _installation, run) => run(async parts => { calls.push(parts.join('?')); throw Error('License access should not happen'); }) },
    '@/lib/supabase/server': {}, './office-server': {}, './office-desktop-token': token,
    './office-desktop-admission': { lockDesktopAdmission: async () => calls.push('admission-lock'), readDesktopAdmission: async () => ({ enabled: false }) },
  });
  await assert.rejects(api.openDesktopSession({ key: token.mintDesktopLicense(identity.userId, randomUUID()), installationId: randomUUID(), language: 'en' }), e => e.code === 'DESKTOP_PAUSED' && e.status === 403);
  assert.deepEqual(calls, ['admission-lock']);
});

test('an already unlocked session can obtain a task without consulting new-session admission', async () => {
  const licenseId = randomUUID(), installationId = randomUUID(), keyHash = 'a'.repeat(64), expiry = new Date(Date.now() + 240000), jobId = randomUUID();
  const sessionToken = token.signDesktopSession({ v: 1, licenseId, installationId, keyHash, revision: '1', epoch: '4', exp: Date.now() + 600000 });
  const tx = async parts => {
    const query = parts.join('?');
    if (query.includes('pg_advisory_xact_lock')) return [];
    if (query.includes('office_desktop_licenses')) return [{ id: licenseId, key_hash: keyHash, enabled: true, expires_at: new Date(Date.now() + 86400000), actions: ['install'], revision: '1' }];
    if (query.includes('office_command_control')) return [{ enabled: true, epoch: '4' }];
    if (query.includes('office_desktop_devices')) return [{ installation_id: installationId }];
    if (query.includes('office_desktop_jobs')) return [{ license_id: licenseId, installation_id: installationId, action: 'install', epoch: '4', license_revision: '1', expires_at: expiry }];
    throw Error('Unexpected database read');
  };
  const api = load('lib/toolbox/office-desktop-server.ts', {
    '@/lib/backend/database': { withOfficeDesktopDatabase: async (_hash, _installation, run) => run(tx) },
    '@/lib/supabase/server': {}, './office-server': {}, './office-desktop-token': token,
    './office-desktop-admission': { lockDesktopAdmission: async () => { throw Error('Existing session cannot take the admission lock'); }, readDesktopAdmission: async () => { throw Error('Existing session cannot consult admission'); } },
  });
  const request = { headers: new Headers({ authorization: 'Bearer ' + sessionToken, 'x-ct-installation-id': installationId }) };
  const result = await api.desktopPackage(request, { action: 'install', requestId: jobId });
  assert.equal(result.jobId, jobId);
  assert.equal(result.expiresAt, expiry.toISOString());
  assert.equal(result.action, 'install');
});
