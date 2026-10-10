// Explicit local PostgreSQL integration; direct domain calls do not prove HTTP or VM behavior.
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
  const target = new URL(config[field]);
  if (target.hostname !== '127.0.0.1' || target.port !== '55422') throw Error('Dedicated local database required');
}
const authTarget = new URL(config.API_URL);
if (authTarget.hostname !== '127.0.0.1' || authTarget.port !== '55421') throw Error('Dedicated local Auth fixture required');
const fixtureFile = '.local/office-admission/fixture.private.json';
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
if (!fixture.prepared || fixture.cleaned || fixture.origin !== 'http://127.0.0.1:3235' || fixture.users?.length !== 2 || fixture.users.some(user => !/^office-admission-(admin|other)-[a-f0-9-]+@example\.test$/.test(user.email))) throw Error('Active dedicated synthetic fixture required');
const admin = fixture.users.find(user => user.role === 'admin');
if (!admin?.id || !admin.sessionId || !fixture.signingKey) throw Error('Prepared local administrator session required');
const identity = { userId: admin.id, sessionId: admin.sessionId };
const env = { APP_DATABASE_URL: config.APP_DATABASE_URL, SUPABASE_URL: config.API_URL, OFFICE_DESKTOP_SIGNING_KEY: fixture.signingKey };
const connections = new Set();
const nativeRequire = createRequire(import.meta.url), modules = new Map();
const trackedPostgres = (...args) => { const connection = postgres(...args); connections.add(connection); return connection; };
trackedPostgres.default = trackedPostgres;
function load(file) {
  const path = resolve(file);
  if (modules.has(path)) return modules.get(path);
  const exports = {}; modules.set(path, exports);
  const require = name => name === 'server-only' || name === '@/lib/supabase/server' ? {} : name === 'postgres' ? trackedPostgres : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('./') || name.startsWith('../') ? load(resolve(dirname(path), name) + '.ts') : nativeRequire(name);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInContext(source, createContext({ exports, require, Buffer, URL, Date, BigInt, console, setTimeout, process: { env, cwd: () => process.cwd() } }));
  return exports;
}
const desktop = load('lib/toolbox/office-desktop-server.ts'), admission = load('lib/toolbox/office-desktop-admission.ts'), database = load('lib/backend/database.ts');
const sql = trackedPostgres(config.DB_URL, { max: 2, prepare: false }), runtime = trackedPostgres(config.APP_DATABASE_URL, { max: 2, prepare: false });
const checks = [], ownGrants = new Set();
let phase = 'preflight', failed = null, restoreAllowed = false, oldControl = null, runtimeRole = null;
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const rejects = (run, code) => assert.rejects(run, error => error.code === code);
function persist(update) {
  const latest = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  if (!latest.prepared || latest.cleaned || latest.users.find(user => user.role === 'admin')?.id !== admin.id) throw Error('Dedicated fixture ownership changed');
  update(latest);
  writeFileSync(fixtureFile, JSON.stringify(latest), { mode: 0o600 });
}
function opening(appVersion = '0.2.1') {
  const requestId = randomUUID(); ownGrants.add(requestId);
  persist(latest => { latest.publicGrantIds = [...new Set([...(latest.publicGrantIds ?? []), requestId])]; });
  return { mode: 'public', requestId, installationId: randomUUID(), appVersion, language: 'en' };
}
async function officeSnapshot() {
  const [row] = await sql`select enabled,admin_user_id,command_version::text as epoch,revision::text as revision,encode(sha256(convert_to(jsonb_build_object('singleton',singleton,'enabled',enabled,'epoch',command_version::text,'revision',revision::text,'admin',admin_user_id,'updatedAtEpoch',extract(epoch from updated_at),'updatedBy',updated_by)::text,'UTF8')),'hex') as fingerprint from chinatech_v2_private.office_command_control where singleton`;
  assert.ok(row?.admin_user_id === admin.id && row.enabled, 'Dedicated synthetic administrator no longer owns Office control');
  return row;
}
async function simulateRelease(version, resetMinimum = false) {
  await sql.begin(async tx => {
    await admission.lockDesktopAdmission(tx);
    const rows = resetMinimum
      ? await tx`update chinatech_v2_private.office_desktop_control set enabled=true,minimum_version='0.0.0',release_ready=true,verified_version=${version} where singleton and (updated_by=${admin.id} or updated_by is null) returning singleton`
      : await tx`update chinatech_v2_private.office_desktop_control set release_ready=true,verified_version=${version} where singleton and (updated_by=${admin.id} or updated_by is null) returning singleton`;
    assert.equal(rows.length, 1, 'Dedicated admission control ownership changed');
  });
}
const patch = (control, fields) => admission.changeDesktopAdmission(identity, { enabled: control.enabled, expectedRevision: control.revision, requestId: randomUUID(), ...fields });
const request = session => ({ headers: new Headers({ authorization: 'Bearer ' + session.sessionToken, 'x-ct-installation-id': session.installationId }) });
function decode(pkg, token) {
  const aes = createDecipheriv('aes-256-gcm', createHash('sha256').update('chinatech-office-desktop:payload:v1\0' + token).digest(), Buffer.from(pkg.nonce, 'base64'));
  aes.setAuthTag(Buffer.from(pkg.tag, 'base64'));
  aes.setAAD(Buffer.from(JSON.stringify([pkg.v, pkg.action, pkg.version, pkg.digest, pkg.expiresAt, pkg.jobId])));
  return Buffer.concat([aes.update(Buffer.from(pkg.ciphertext, 'base64')), aes.final()]);
}
async function directGrant(body) {
  return database.withOfficePublicDatabase(body.requestId, body.installationId, true, async tx => {
    await admission.lockDesktopAdmission(tx);
    await tx`insert into chinatech_v2_private.office_desktop_public_grants(id,installation_id,app_version,actions,epoch,expires_at,created_at) select ${body.requestId},${body.installationId},${body.appVersion},array['install']::text[],command_version,now()+interval '1 hour',now() from chinatech_v2_private.office_command_control where singleton`;
  });
}

try {
  oldControl = await officeSnapshot();
  assert.equal(oldControl.epoch, fixture.oldControl.command_version);
  assert.equal(oldControl.revision, fixture.oldControl.revision);
  await admission.getDesktopAdmission(identity); // Actual project Auth/session checks, not a fabricated principal.
  const [role] = await runtime`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
  assert.equal(role.name, 'chinatech_runtime'); assert.ok(!role.rolsuper && !role.rolbypassrls); runtimeRole = role.name;
  const tables = await sql`select relrowsecurity,relforcerowsecurity from pg_class where oid in ('chinatech_v2_private.office_desktop_control'::regclass,'chinatech_v2_private.office_desktop_control_receipts'::regclass,'chinatech_v2_private.office_desktop_public_grants'::regclass,'chinatech_v2_private.office_desktop_public_jobs'::regclass)`;
  assert.equal(tables.length, 4); assert.ok(tables.every(row => row.relrowsecurity && row.relforcerowsecurity));
  const [publicGrants] = await sql`select count(*)::int as n from information_schema.role_table_grants where table_schema='chinatech_v2_private' and table_name in ('office_desktop_control','office_desktop_control_receipts','office_desktop_public_grants','office_desktop_public_jobs') and grantee in ('PUBLIC','anon','authenticated')`;
  assert.equal(publicGrants.n, 0);
  for (const column of ['release_ready', 'verified_version']) {
    const [permission] = await runtime`select has_column_privilege(current_user,'chinatech_v2_private.office_desktop_control',${column},'UPDATE') as allowed`;
    assert.equal(permission.allowed, false);
  }
  await rejects(() => runtime`update chinatech_v2_private.office_desktop_control set release_ready=true`, '42501');
  await rejects(() => runtime`update chinatech_v2_private.office_desktop_control set verified_version='0.2.1'`, '42501');
  pass('Restricted runtime, four FORCE RLS tables and release-marker column permissions remain enforced');

  phase = 'old verified release'; restoreAllowed = true;
  await simulateRelease('0.2.0', true);
  let control = await admission.getDesktopAdmission(identity);
  assert.equal(control.currentVersion, '0.2.0');
  assert.deepEqual(JSON.parse(JSON.stringify(control.eligibleMinimumVersions)), ['0.0.0', '0.2.0']);
  await rejects(() => patch(control, { minimumVersion: '0.2.1' }), 'VERSION_NOT_AVAILABLE');
  control = await patch(control, { minimumVersion: '0.2.0' });
  assert.equal(control.minimumVersion, '0.2.0');
  pass('Verified 0.2.0 remains recommended and cannot select an unverified 0.2.1 minimum');

  phase = 'SQL client cap';
  const direct = opening(); await directGrant(direct);
  const [inserted] = await sql`select app_version from chinatech_v2_private.office_desktop_public_grants where id=${direct.requestId}`;
  assert.equal(inserted.app_version, '0.2.1');
  const future = opening('0.2.2'); await rejects(() => directGrant(future), '42501');
  const [absent] = await sql`select count(*)::int as n from chinatech_v2_private.office_desktop_public_grants where id=${future.requestId}`;
  assert.equal(absent.n, 0);
  await rejects(() => desktop.openDesktopSession(opening('0.2.2')), 'CLIENT_UNSUPPORTED');
  const oldBody = opening('0.2.0'), oldSession = { ...await desktop.openDesktopSession(oldBody), installationId: oldBody.installationId };
  const newBody = opening(), newSession = await desktop.openDesktopSession(newBody);
  assert.equal(newSession.grantId, newBody.requestId);
  pass('Actual SQL admits 0.2.1 and rejects 0.2.2; the application cap agrees while both released client generations can open');

  phase = 'existing grant package';
  const job = { action: 'install', requestId: randomUUID() };
  const original = await desktop.desktopPackage(request(oldSession), job);
  const runner = readFileSync('server-assets/office-desktop/runner.ps1.txt');
  assert.ok(decode(original, oldSession.sessionToken).equals(runner), 'Original package runner bytes differ');
  assert.equal(original.v, 1); assert.equal(original.version, oldControl.epoch);
  assert.equal(original.digest, createHash('sha256').update(runner).digest('hex'));
  assert.ok(Date.parse(original.expiresAt) <= Date.parse(oldSession.expiresAt));
  pass('Existing 0.2.0 grant decrypts the pinned AES-GCM v1 runner without executing Office');

  phase = 'verified cutover with old minimum';
  await simulateRelease('0.2.1');
  control = await admission.getDesktopAdmission(identity);
  assert.equal(control.currentVersion, '0.2.1'); assert.equal(control.minimumVersion, '0.2.0');
  assert.deepEqual(JSON.parse(JSON.stringify(control.eligibleMinimumVersions)), ['0.0.0', '0.2.0', '0.2.1']);
  control = await patch(control, { enabled: false });
  assert.equal(control.minimumVersion, '0.2.0'); assert.equal(control.enabled, false);
  await rejects(() => desktop.openDesktopSession(opening()), 'DESKTOP_PAUSED');
  const pausedRetry = await desktop.openDesktopSession(oldBody);
  assert.ok(pausedRetry.sessionToken === oldSession.sessionToken, 'Pause changed the original session token');
  assert.equal(pausedRetry.expiresAt, oldSession.expiresAt);
  control = await patch(control, { enabled: true });
  assert.equal(control.minimumVersion, '0.2.0'); assert.equal(control.enabled, true);
  pass('A new verified release preserves the old minimum and real restricted administrator pause/resume works');

  phase = 'raised minimum and old-session recovery';
  control = await patch(control, { minimumVersion: '0.2.1' });
  assert.equal(control.minimumVersion, '0.2.1');
  await rejects(() => desktop.openDesktopSession(opening('0.2.0')), 'UPDATE_REQUIRED');
  const fresh = opening(), freshSession = await desktop.openDesktopSession(fresh);
  assert.equal(freshSession.grantId, fresh.requestId);
  const recovered = await desktop.openDesktopSession(oldBody);
  assert.ok(recovered.sessionToken === oldSession.sessionToken, 'Minimum change altered the original token');
  assert.equal(recovered.expiresAt, oldSession.expiresAt);
  const replay = await desktop.desktopPackage(request(oldSession), job);
  assert.equal(replay.expiresAt, original.expiresAt); assert.equal(replay.jobId, original.jobId);
  assert.ok(decode(replay, oldSession.sessionToken).equals(runner), 'Replayed package runner bytes differ');
  const laterJob = await desktop.desktopPackage(request(oldSession), { action: 'install', requestId: randomUUID() });
  assert.ok(decode(laterJob, oldSession.sessionToken).equals(runner), 'Existing session lost package authorization');
  assert.ok(Date.parse(laterJob.expiresAt) <= Date.parse(oldSession.expiresAt));
  const [grantExpiry] = await sql`select expires_at from chinatech_v2_private.office_desktop_public_grants where id=${oldBody.requestId}`;
  assert.equal(grantExpiry.expires_at.toISOString(), oldSession.expiresAt);
  pass('Minimum 0.2.1 denies only fresh older opens; original grant/token/session and job expiry survive with decryptable packages');

  phase = 'old Office invariants';
  const after = await officeSnapshot();
  assert.equal(after.epoch, oldControl.epoch); assert.equal(after.revision, oldControl.revision); assert.equal(after.fingerprint, oldControl.fingerprint);
  pass('Old Office epoch, revision and full control-row fingerprint remain exact');
} catch (error) {
  failed = { phase, code: typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'INTEGRATION_FAILED' };
} finally {
  try {
    if (restoreAllowed) {
      await officeSnapshot();
      await simulateRelease('0.2.1', true);
      const restored = await admission.getDesktopAdmission(identity);
      assert.equal(restored.enabled, true); assert.equal(restored.minimumVersion, '0.0.0'); assert.equal(restored.currentVersion, '0.2.1');
      const after = await officeSnapshot();
      assert.equal(after.fingerprint, oldControl.fingerprint);
      persist(latest => { latest.releaseReadySimulated = true; latest.verifiedVersionSimulated = '0.2.1'; });
      pass('Local fixture restored enabled/minimum00 with simulated verified 0.2.1 for subsequent UI validation');
    }
  } catch (error) {
    failed = { phase: 'fixture restoration', code: typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'RESTORATION_FAILED', earlierFailure: failed };
  }
  await Promise.all([...connections].map(connection => connection.end()));
}
writeFileSync('.local/office-admission/021-sql-results.json', JSON.stringify({ passed: failed === null, target: { hostname: new URL(config.DB_URL).hostname, port: new URL(config.DB_URL).port, runtimeRole }, checks, count: checks.length, failed, trackedGrantCount: ownGrants.size, releaseMarkerEvidence: 'simulated in dedicated local PostgreSQL', scope: 'SQL and domain helpers; no runner execution or HTTP/browser/VM verification' }, null, 2));
if (failed) { console.error('Office 0.2.1 SQL regression failed at ' + failed.phase + ': ' + failed.code); process.exitCode = 1; }
else console.log('Office 0.2.1 SQL regression: ' + checks.length + ' checks passed');
