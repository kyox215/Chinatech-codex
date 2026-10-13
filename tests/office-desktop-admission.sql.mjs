// Explicit local integration runner, separate from the ordinary CI unit suite.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { randomUUID, createHash, createDecipheriv } from 'node:crypto';
import postgres from 'postgres';
import ts from 'typescript';

const config = JSON.parse(readFileSync('../../backend/connection.private.json', 'utf8'));
for (const field of ['DB_URL', 'APP_DATABASE_URL']) {
  const url = new URL(config[field]);
  if (url.hostname !== '127.0.0.1' || url.port !== '55422') throw Error('Dedicated local database required');
}
const fixtureFile = '.local/office-admission/fixture.private.json';
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
if (fixture.origin !== 'http://127.0.0.1:3235' || !fixture.prepared || fixture.cleaned) throw Error('Dedicated active fixture required');
const admin = fixture.users.find(user => user.role === 'admin'), other = fixture.users.find(user => user.role === 'other');
const identity = user => ({ userId: user.id, sessionId: user.sessionId });
const env = { APP_DATABASE_URL: config.APP_DATABASE_URL, SUPABASE_URL: config.API_URL, OFFICE_DESKTOP_SIGNING_KEY: fixture.signingKey };
const nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(file, overrides = {}) {
  const path = resolve(file);
  if (!Object.keys(overrides).length && modules.has(path)) return modules.get(path);
  const exports = {};
  if (!Object.keys(overrides).length) modules.set(path, exports);
  const require = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'server-only') return {};
    if (name === '@/lib/supabase/server') return {};
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    if (name.startsWith('./') || name.startsWith('../')) return load(resolve(dirname(path), name) + '.ts');
    return nativeRequire(name);
  };
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInContext(source, createContext({ exports, require, Buffer, URL, Date, BigInt, console, setTimeout, process: { env, cwd: () => process.cwd() } }));
  return exports;
}
const database = load('lib/backend/database.ts'), admission = load('lib/toolbox/office-desktop-admission.ts'), desktop = load('lib/toolbox/office-desktop-server.ts');
const sql = postgres(config.DB_URL, { max: 2, prepare: false }), runtime = postgres(config.APP_DATABASE_URL, { max: 3, prepare: false });
const checks = [], pass = name => { checks.push(name); console.log('PASS ' + name); };
const claims = user => JSON.stringify({ role: 'authenticated', sub: user.id, session_id: user.sessionId });
const sleep = ms => new Promise(done => setTimeout(done, ms));
const deferred = () => { let done; const promise = new Promise(resolve => { done = resolve; }); return { promise, done }; };
try {
  const tables = await sql`select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in ('chinatech_v2_private.office_desktop_control'::regclass,'chinatech_v2_private.office_desktop_control_receipts'::regclass)`;
  assert.equal(tables.length, 2); assert.ok(tables.every(table => table.relrowsecurity && table.relforcerowsecurity));
  const grants = await sql`select count(*)::int as n from information_schema.role_table_grants where table_schema='chinatech_v2_private' and table_name in ('office_desktop_control','office_desktop_control_receipts') and grantee in ('PUBLIC','anon','authenticated')`;
  assert.equal(grants[0].n, 0);
  const [role] = await sql`select rolbypassrls,rolsuper from pg_roles where rolname='chinatech_runtime'`; assert.equal(role.rolbypassrls, false); assert.equal(role.rolsuper, false);
  for (const roleName of ['anon', 'authenticated']) await assert.rejects(sql.begin(async tx => { await tx.unsafe('set local role ' + roleName); await tx`select enabled from chinatech_v2_private.office_desktop_control`; }), error => error.code === '42501');
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_control set singleton=false`, error => error.code === '42501');
  await assert.rejects(runtime`delete from chinatech_v2_private.office_desktop_control_receipts`, error => error.code === '42501');
  pass('Both private tables FORCE RLS; public/Auth grants absent, runtime cannot change identity columns or delete receipts');

  const hidden = await runtime.begin(async tx => {
    await tx`select set_config('request.jwt.claims','{"role":"anon"}',true)`;
    const rows = await tx`update chinatech_v2_private.office_desktop_control set enabled=false,updated_by=null where singleton returning singleton`;
    const [receiptCount] = await tx`select count(*)::int as n from chinatech_v2_private.office_desktop_control_receipts`;
    return { rows, receiptCount };
  });
  assert.equal(hidden.rows.length, 0); assert.equal(hidden.receiptCount.n, 0);
  await assert.rejects(admission.getDesktopAdmission(identity(other)), error => error.code === 'NO_ACCESS');
  await assert.rejects(admission.changeDesktopAdmission(identity(other), { enabled: false, expectedRevision: '0', requestId: randomUUID() }), error => error.code === 'NO_ACCESS');
  await runtime.begin(async tx => {
    await tx`select set_config('request.jwt.claims',${claims(other)},true)`;
    assert.equal((await tx`update chinatech_v2_private.office_desktop_control set enabled=false,updated_by=${other.id} where singleton returning singleton`).length, 0);
  });
  await assert.rejects(runtime.begin(async tx => { await tx`select set_config('request.jwt.claims',${claims(other)},true)`; await tx`insert into chinatech_v2_private.office_desktop_control_receipts(request_id,actor_id,session_id,requested_enabled,expected_revision) values(${randomUUID()},${other.id},${other.sessionId},false,0)`; }), error => error.code === '42501');
  pass('Anonymous capability and real unrelated Auth identity cannot toggle or create receipts');

  await runtime.begin(async tx => {
    await tx`select set_config('request.jwt.claims',${claims(admin)},true)`;
    await tx`update chinatech_v2_private.login_sessions set revoked_at=now() where session_id=${admin.sessionId}`;
    const [live] = await tx`select chinatech_v2_private.live_user() as live`;
    assert.equal(live.live, false);
    assert.equal((await tx`update chinatech_v2_private.office_desktop_control set enabled=false,updated_by=${admin.id} where singleton returning singleton`).length, 0);
    throw Object.assign(Error('Rollback only this synthetic revocation'), { rollbackProof: true });
  }).catch(error => { if (!error.rollbackProof) throw error; });
  assert.equal((await admission.getDesktopAdmission(identity(admin))).enabled, true);
  pass('A revoked real project session cannot update admission; rollback preserves fixture login');

  const draft = { requestId: randomUUID(), label: 'Admission local proof', expiresAt: new Date(Date.now() + 86400000).toISOString(), maxDevices: 1, actions: ['install', 'activate', 'uninstall', 'reinstall'] };
  const created = await desktop.createDesktopLicense(identity(admin), draft), key = created.key, installationId = randomUUID();
  fixture.key = key; fixture.licenseId = created.license.id; fixture.installationId = installationId;
  writeFileSync(fixtureFile, JSON.stringify(fixture), { mode: 0o600 });
  const opening = { key, installationId, language: 'en' }, session = await desktop.openDesktopSession(opening);
  const disable = { enabled: false, expectedRevision: '0', requestId: randomUUID() };
  const disabled = await admission.changeDesktopAdmission(identity(admin), disable);
  assert.equal(disabled.enabled, false); assert.equal(disabled.revision, '1');
  assert.equal((await database.readOfficeDesktopAdmission()).acceptingNewSessions, false);
  await assert.rejects(desktop.openDesktopSession(opening), error => error.code === 'DESKTOP_PAUSED' && error.status === 403);
  await assert.rejects(desktop.openDesktopSession({ ...opening, installationId: randomUUID() }), error => error.code === 'DESKTOP_PAUSED');
  const request = token => ({ headers: new Headers({ authorization: 'Bearer ' + token, 'x-ct-installation-id': installationId }) });
  const pkg = await desktop.desktopPackage(request(session.sessionToken), { action: 'install', requestId: randomUUID() });
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update('chinatech-office-desktop:payload:v1\0' + session.sessionToken).digest(), Buffer.from(pkg.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(pkg.tag, 'base64')); decipher.setAAD(Buffer.from(JSON.stringify([pkg.v, pkg.action, pkg.version, pkg.digest, pkg.expiresAt, pkg.jobId])));
  assert.deepEqual(Buffer.concat([decipher.update(Buffer.from(pkg.ciphertext, 'base64')), decipher.final()]), readFileSync('server-assets/office-desktop/runner.ps1.txt'));
  pass('Actual production TS unlock is denied after pause while previous session decrypts a valid task package');

  const enabled = await admission.changeDesktopAdmission(identity(admin), { enabled: true, expectedRevision: '1', requestId: randomUUID() });
  assert.equal(enabled.revision, '2'); assert.equal((await admission.changeDesktopAdmission(identity(admin), disable)).enabled, true);
  await assert.rejects(admission.changeDesktopAdmission(identity(admin), { ...disable, enabled: true }), error => error.code === 'REQUEST_CONFLICT');
  await assert.rejects(admission.changeDesktopAdmission(identity(admin), { ...disable, requestId: randomUUID() }), error => error.code === 'REQUEST_CONFLICT');
  const refreshed = await desktop.openDesktopSession(opening);
  assert.ok(Date.parse(refreshed.expiresAt) <= Date.now() + 3600000);
  await desktop.desktopPackage(request(session.sessionToken), { action: 'install', requestId: randomUUID() });
  pass('Re-enable permits fresh unlock; receipt replay cannot undo newer state; old session remains valid');

  const results = await Promise.allSettled([1, 2].map(() => admission.changeDesktopAdmission(identity(admin), { enabled: false, expectedRevision: '2', requestId: randomUUID() })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'REQUEST_CONFLICT').length, 1);
  let current = await admission.getDesktopAdmission(identity(admin));
  current = await admission.changeDesktopAdmission(identity(admin), { enabled: true, expectedRevision: current.revision, requestId: randomUUID() });
  pass('Concurrent real serializable administrator writes apply one change and return one version conflict');

  const held = deferred(), release = deferred(); let openingSettled = false;
  const closing = runtime.begin(async tx => {
    await tx`select set_config('request.jwt.claims',${claims(admin)},true)`;
    await admission.lockDesktopAdmission(tx);
    await tx`update chinatech_v2_private.office_desktop_control set enabled=false,revision=revision+1,updated_by=${admin.id},updated_at=now() where singleton`;
    held.done(); await release.promise;
  });
  await held.promise;
  const blockedOpening = desktop.openDesktopSession(opening).then(result => { openingSettled = true; return result; }, error => { openingSettled = true; return error; });
  await sleep(70); assert.equal(openingSettled, false);
  release.done(); await closing;
  const paused = await blockedOpening; assert.equal(paused.code, 'DESKTOP_PAUSED');
  current = await admission.getDesktopAdmission(identity(admin));
  current = await admission.changeDesktopAdmission(identity(admin), { enabled: true, expectedRevision: current.revision, requestId: randomUUID() });
  pass('Close transaction holds the exact advisory lock; blocked new unlock sees committed pause before issuing any token');

  const signed = deferred(), commit = deferred(); let closingSettled = false;
  const heldDesktop = load('lib/toolbox/office-desktop-server.ts', { '@/lib/backend/database': { ...database, withOfficeDesktopDatabase: (hash, installation, run) => database.withOfficeDesktopDatabase(hash, installation, async tx => { const result = await run(tx); signed.done(); await commit.promise; return result; }) } });
  const earlier = heldDesktop.openDesktopSession(opening); await signed.promise;
  const laterClose = admission.changeDesktopAdmission(identity(admin), { enabled: false, expectedRevision: current.revision, requestId: randomUUID() }).finally(() => { closingSettled = true; });
  await sleep(70); assert.equal(closingSettled, false);
  commit.done(); const earlierSession = await earlier; await laterClose;
  await desktop.desktopPackage(request(earlierSession.sessionToken), { action: 'install', requestId: randomUUID() });
  current = await admission.getDesktopAdmission(identity(admin));
  await admission.changeDesktopAdmission(identity(admin), { enabled: true, expectedRevision: current.revision, requestId: randomUUID() });
  pass('Unlock transaction retains admission lock through commit; later pause waits and issued session remains usable');

  const disabledLicense = await desktop.changeDesktopLicense(identity(admin), { licenseId: fixture.licenseId, enabled: false, expectedRevision: '1', requestId: randomUUID() });
  await assert.rejects(desktop.desktopPackage(request(session.sessionToken), { action: 'install', requestId: randomUUID() }), error => error.code === 'KEY_INVALID');
  await desktop.changeDesktopLicense(identity(admin), { licenseId: fixture.licenseId, enabled: true, expectedRevision: disabledLicense.license.revision, requestId: randomUUID() });
  await assert.rejects(desktop.desktopPackage(request(session.sessionToken), { action: 'install', requestId: randomUUID() }), error => error.code === 'SESSION_REVOKED');
  await desktop.openDesktopSession(opening);
  pass('License disable/re-enable retains original revocation behavior independently from the admission switch');

  const [old] = await sql`select command_version::text as epoch,revision::text as revision from chinatech_v2_private.office_command_control where singleton`;
  assert.equal(old.epoch, fixture.oldControl.command_version); assert.equal(old.revision, fixture.oldControl.revision);
  const [devices] = await sql`select count(*)::int as n from chinatech_v2_private.office_desktop_devices where license_id=${fixture.licenseId}`;
  assert.equal(devices.n, 1);
  assert.equal((await database.readOfficeDesktopAdmission()).acceptingNewSessions, true);
  pass('Old Office epoch/revision remain exact; rejected unlocks do not consume new device slots; fixture ends enabled');
  writeFileSync('.local/office-admission/sql-results.json', JSON.stringify({ checks, count: checks.length, production: false, environment: 'Dedicated local Supabase, actual TypeScript handlers and restricted PostgreSQL role', officeExecuted: false, secretsLogged: false }, null, 2));
} finally { await sql.end(); await runtime.end(); }
