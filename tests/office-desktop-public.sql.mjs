// Actual local PostgreSQL/capability integration; never a production target.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { randomUUID, createHash, createDecipheriv } from 'node:crypto';
import postgres from 'postgres';
import ts from 'typescript';
const config = JSON.parse(readFileSync('../../backend/connection.private.json', 'utf8'));
for (const field of ['DB_URL', 'APP_DATABASE_URL']) { const url = new URL(config[field]); if (url.hostname !== '127.0.0.1' || url.port !== '55422') throw Error('Dedicated local database required'); }
const file = '.local/office-admission/fixture.private.json', fixture = JSON.parse(readFileSync(file, 'utf8'));
if (!fixture.prepared || fixture.cleaned || fixture.origin !== 'http://127.0.0.1:3235') throw Error('Active local fixture required');
const admin = fixture.users.find(user => user.role === 'admin'), identity = { userId: admin.id, sessionId: admin.sessionId };
const env = { APP_DATABASE_URL: config.APP_DATABASE_URL, SUPABASE_URL: config.API_URL, OFFICE_DESKTOP_SIGNING_KEY: fixture.signingKey };
const nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(file, overrides = {}) {
  const path = resolve(file); if (!Object.keys(overrides).length && modules.has(path)) return modules.get(path);
  const exports = {}; if (!Object.keys(overrides).length) modules.set(path, exports);
  const require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === 'server-only' || name === '@/lib/supabase/server' ? {} : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('./') || name.startsWith('../') ? load(resolve(dirname(path), name) + '.ts') : nativeRequire(name);
  runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, createContext({ exports, require, Buffer, URL, Date, BigInt, console, setTimeout, process: { env, cwd: () => process.cwd() } }));
  return exports;
}
const desktop = load('lib/toolbox/office-desktop-server.ts'), admission = load('lib/toolbox/office-desktop-admission.ts'), database = load('lib/backend/database.ts');
const sql = postgres(config.DB_URL, { max: 2, prepare: false }), runtime = postgres(config.APP_DATABASE_URL, { max: 2, prepare: false });
const checks = [], pass = name => { checks.push(name); console.log('PASS ' + name); };
const persist = () => writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
function opening(installationId = randomUUID(), appVersion = '0.2.0') {
  const requestId = randomUUID(); fixture.publicGrantIds ??= []; fixture.publicGrantIds.push(requestId); persist();
  return { mode: 'public', requestId, installationId, appVersion, language: 'en' };
}
const fail = async (run, code) => assert.rejects(run, error => error.code === code);
const request = session => ({ headers: new Headers({ authorization: 'Bearer ' + session.sessionToken, 'x-ct-installation-id': session.installationId }) });
function decode(pkg, token) {
  const aes = createDecipheriv('aes-256-gcm', createHash('sha256').update('chinatech-office-desktop:payload:v1\0' + token).digest(), Buffer.from(pkg.nonce, 'base64'));
  aes.setAuthTag(Buffer.from(pkg.tag, 'base64')); aes.setAAD(Buffer.from(JSON.stringify([pkg.v, pkg.action, pkg.version, pkg.digest, pkg.expiresAt, pkg.jobId])));
  return Buffer.concat([aes.update(Buffer.from(pkg.ciphertext, 'base64')), aes.final()]);
}
const sleeping = ms => new Promise(done => setTimeout(done, ms));
const deferred = () => { let done; const promise = new Promise(resolve => { done = resolve; }); return { promise, done }; };
try {
  const tables = await sql`select relrowsecurity,relforcerowsecurity from pg_class where oid in ('chinatech_v2_private.office_desktop_public_grants'::regclass,'chinatech_v2_private.office_desktop_public_jobs'::regclass)`;
  assert.equal(tables.length, 2); assert.ok(tables.every(row => row.relrowsecurity && row.relforcerowsecurity));
  const [grants] = await sql`select count(*)::int as n from information_schema.role_table_grants where table_schema='chinatech_v2_private' and table_name in ('office_desktop_public_grants','office_desktop_public_jobs') and grantee in ('PUBLIC','anon','authenticated')`; assert.equal(grants.n, 0);
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_control set release_ready=true`, error => error.code === '42501');
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_control set verified_version='0.3.0'`, error => error.code === '42501');
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_public_grants set actions=array['install']`, error => error.code === '42501');
  const [unscoped] = await runtime`select count(*)::int as n from chinatech_v2_private.office_desktop_public_grants`; assert.equal(unscoped.n, 0);
  pass('Public grants/jobs FORCE RLS, no public/Auth grants, no runtime release marker or capability mutation');

  let control = await admission.getDesktopAdmission(identity);
  assert.equal(control.currentVersion, load('lib/toolbox/office-desktop-release-catalog.ts').previousPublishedVersion); assert.deepEqual(JSON.parse(JSON.stringify(control.eligibleMinimumVersions)), ['0.0.0']);
  await fail(() => admission.changeDesktopAdmission(identity, { enabled: true, minimumVersion: '0.2.0', expectedRevision: control.revision, requestId: randomUUID() }), 'VERSION_NOT_AVAILABLE');
  const live = opening(), active = { ...await desktop.openDesktopSession(live), installationId: live.installationId };
  assert.equal(active.grantId, live.requestId); assert.ok(Date.parse(active.expiresAt) <= Date.now() + 3600000);
  pass('Unverified candidate cannot become minimum/current recommendation, but supported public 0.2.0 can open automatically');

  const retry = await desktop.openDesktopSession(live); assert.equal(retry.expiresAt, active.expiresAt); assert.equal(retry.sessionToken, active.sessionToken);
  await fail(() => desktop.openDesktopSession({ ...live, appVersion: '0.1.1' }), 'REQUEST_CONFLICT');
  await assert.rejects(desktop.openDesktopSession({ ...live, installationId: randomUUID() }), error => error.code === '23505' || error.code === 'REQUEST_CONFLICT');
  await fail(() => desktop.openDesktopSession(opening(randomUUID(), '0.3.0')), 'CLIENT_UNSUPPORTED');
  pass('Startup retry preserves original grant/token/expiry; changed version/installation conflict; future clients rejected');

  const rateInstallation = randomUUID(), rateBodies = Array.from({ length: 12 }, () => opening(rateInstallation));
  const races = await Promise.allSettled(rateBodies.map(body => desktop.openDesktopSession(body)));
  assert.equal(races.filter(result => result.status === 'fulfilled').length, 10);
  assert.equal(races.filter(result => result.status === 'rejected' && result.reason.code === 'RATE_LIMITED').length, 2);
  const successful = rateBodies[races.findIndex(result => result.status === 'fulfilled')]; await desktop.openDesktopSession(successful);
  const [rateCount] = await sql`select count(*)::int as n from chinatech_v2_private.office_desktop_public_grants where installation_id=${rateInstallation}`; assert.equal(rateCount.n, 10);
  pass('Concurrent database issuance admits exactly ten fresh grants per installation/minute; retry remains allowed without another row');

  const oldPublicBody = opening(randomUUID(), '0.1.1'), oldPublic = { ...await desktop.openDesktopSession(oldPublicBody), installationId: oldPublicBody.installationId };
  const license = await desktop.createDesktopLicense(identity, { requestId: randomUUID(), label: 'Legacy compatibility proof', expiresAt: new Date(Date.now() + 86400000).toISOString(), maxDevices: 1, actions: ['install'] });
  fixture.key = license.key; fixture.licenseId = license.license.id; fixture.installationId = randomUUID(); persist();
  const legacyBody = { key: fixture.key, installationId: fixture.installationId, language: 'en' }, legacy = { ...await desktop.openDesktopSession(legacyBody), installationId: fixture.installationId };
  await sql`update chinatech_v2_private.office_desktop_control set release_ready=true,verified_version='0.2.0' where singleton`;
  control = await admission.getDesktopAdmission(identity); assert.equal(control.currentVersion, '0.2.0'); assert.ok(control.eligibleMinimumVersions.includes('0.2.0'));
  const minimumRequest = { enabled: true, minimumVersion: '0.2.0', expectedRevision: control.revision, requestId: randomUUID() };
  control = await admission.changeDesktopAdmission(identity, minimumRequest);
  await fail(() => desktop.openDesktopSession(opening(randomUUID(), '0.1.1')), 'UPDATE_REQUIRED'); await fail(() => desktop.openDesktopSession(legacyBody), 'UPDATE_REQUIRED');
  assert.equal((await desktop.openDesktopSession(oldPublicBody)).sessionToken, oldPublic.sessionToken);
  const oldPublicPackage = await desktop.desktopPackage(request(oldPublic), { action: 'install', requestId: randomUUID() });
  const oldLegacyPackage = await desktop.desktopPackage(request(legacy), { action: 'install', requestId: randomUUID() });
  assert.deepEqual(decode(oldPublicPackage, oldPublic.sessionToken), readFileSync('server-assets/office-desktop/runner.ps1.txt'));
  assert.deepEqual(decode(oldLegacyPackage, legacy.sessionToken), readFileSync('server-assets/office-desktop/runner.ps1.txt'));
  pass('Verified minimum change rejects fresh older/legacy opens while both existing public and v1 sessions decrypt the unchanged runner');

  control = await admission.changeDesktopAdmission(identity, { enabled: false, expectedRevision: control.revision, requestId: randomUUID() });
  await fail(() => desktop.openDesktopSession(opening()), 'DESKTOP_PAUSED');
  assert.equal((await desktop.openDesktopSession(oldPublicBody)).expiresAt, oldPublic.expiresAt);
  await desktop.desktopPackage(request(active), { action: 'install', requestId: randomUUID() });
  await desktop.desktopPackage(request(legacy), { action: 'install', requestId: randomUUID() });
  assert.equal((await database.readOfficeDesktopAdmission()).acceptingNewSessions, false);
  pass('Pause blocks fresh requests only; original grant retry and existing public/v1 tasks survive without extending session');

  const job = { action: 'install', requestId: randomUUID() }, first = await desktop.desktopPackage(request(active), job), again = await desktop.desktopPackage(request(active), job);
  assert.equal(first.expiresAt, again.expiresAt); assert.notEqual(first.nonce, again.nonce); assert.equal(first.v, 1);
  await fail(() => desktop.desktopPackage(request(active), { ...job, action: 'uninstall' }), 'REQUEST_CONFLICT');
  await fail(() => desktop.desktopPackage(request(active), { action: 'arbitrary', requestId: randomUUID() }), 'INVALID_REQUEST');
  await fail(() => desktop.desktopPackage({ headers: new Headers({ authorization: 'Bearer ' + active.sessionToken, 'x-ct-installation-id': randomUUID() }) }, job), 'SESSION_INVALID');
  await fail(() => desktop.desktopPackage({ headers: new Headers({ authorization: 'Bearer ' + active.sessionToken + 'x', 'x-ct-installation-id': active.installationId }) }, job), 'SESSION_INVALID');
  pass('Task idempotency, original AES-GCM v1 metadata, fixed actions, installation binding and token tamper rejection remain enforced');

  const savedPolicy = control;
  await fail(() => admission.changeDesktopAdmission(identity, { ...minimumRequest, minimumVersion: '0.0.0' }), 'REQUEST_CONFLICT');
  control = await admission.changeDesktopAdmission(identity, { enabled: true, minimumVersion: '0.0.0', expectedRevision: control.revision, requestId: randomUUID() });
  assert.equal((await admission.changeDesktopAdmission(identity, minimumRequest)).minimumVersion, '0.0.0');
  assert.equal((await admission.getDesktopAdmission(identity)).revision, control.revision);
  assert.notEqual(savedPolicy.revision, control.revision);
  pass('Minimum version participates in receipt identity; replay returns current policy without reinstating an older minimum');

  const held = deferred(), release = deferred(); let openingSettled = false;
  const close = runtime.begin(async tx => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ role: 'authenticated', sub: admin.id, session_id: admin.sessionId })},true)`;
    await admission.lockDesktopAdmission(tx); await tx`update chinatech_v2_private.office_desktop_control set enabled=false,revision=revision+1,updated_by=${admin.id} where singleton`;
    held.done(); await release.promise;
  });
  await held.promise;
  const blockedBody = opening(), blocked = desktop.openDesktopSession(blockedBody).then(value => { openingSettled = true; return value; }, error => { openingSettled = true; return error; });
  await sleeping(70); assert.equal(openingSettled, false); release.done(); await close;
  assert.equal((await blocked).code, 'DESKTOP_PAUSED');
  control = await admission.getDesktopAdmission(identity); control = await admission.changeDesktopAdmission(identity, { enabled: true, expectedRevision: control.revision, requestId: randomUUID() });
  pass('Close transaction serializes with fresh anonymous grants; blocked startup observes committed pause');

  const [oldControl] = await sql`select command_version::text as epoch,revision::text as revision from chinatech_v2_private.office_command_control where singleton`;
  assert.equal(oldControl.epoch, fixture.oldControl.command_version); assert.equal(oldControl.revision, fixture.oldControl.revision);
  assert.equal(control.minimumVersion, '0.0.0'); assert.equal(control.enabled, true);
  fixture.releaseReadySimulated = true; fixture.verifiedVersionSimulated = '0.2.0'; persist();
  pass('Final fixture is enabled/minimum00 with local-only release proof marker; old Office epoch/revision remain exact');
  writeFileSync('.local/office-admission/public-sql-results.json', JSON.stringify({ checks, count: checks.length, production: false, actualRestrictedPostgres: true, releaseReadyOnlySimulatedLocally: true, oldEpochUnchanged: true, officeExecuted: false, secretsLogged: false }, null, 2));
} finally { await sql.end(); await runtime.end(); }
