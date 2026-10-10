// Local restricted-role proof for version-bound release metadata. No HTTP claim.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import ts from 'typescript';
const config = JSON.parse(readFileSync('../../backend/connection.private.json', 'utf8'));
for (const field of ['DB_URL', 'APP_DATABASE_URL']) { const url = new URL(config[field]); if (url.hostname !== '127.0.0.1' || url.port !== '55422') throw Error('Dedicated local database required'); }
const fixture = JSON.parse(readFileSync('.local/office-admission/fixture.private.json', 'utf8'));
if (!fixture.prepared || fixture.cleaned) throw Error('Active synthetic fixture required');
const user = fixture.users.find(item => item.role === 'admin'), identity = { userId: user.id, sessionId: user.sessionId };
const env = { APP_DATABASE_URL: config.APP_DATABASE_URL, SUPABASE_URL: config.API_URL, OFFICE_DESKTOP_SIGNING_KEY: fixture.signingKey }, nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(file, overrides = {}) {
  const path = resolve(file); if (!Object.keys(overrides).length && cache.has(path)) return cache.get(path);
  const exports = {}; if (!Object.keys(overrides).length) cache.set(path, exports);
  const require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === 'server-only' || name === '@/lib/supabase/server' ? {} : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('./') || name.startsWith('../') ? load(resolve(dirname(path), name) + '.ts') : nativeRequire(name);
  runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, createContext({ exports, require, Buffer, URL, Date, BigInt, console, setTimeout, process: { env, cwd: () => process.cwd() } }));
  return exports;
}
const futureCatalog = { currentVersion: '0.3.0', previousPublishedVersion: '0.1.1', eligibleMinimumVersions: ['0.0.0'] };
const admission = load('lib/toolbox/office-desktop-admission.ts', { './office-desktop-release-catalog': futureCatalog }), database = load('lib/backend/database.ts');
const status = load('app/api/toolbox/office-desktop/status/route.ts', {
  '@/lib/toolbox/office-desktop-release-catalog': futureCatalog,
  '@/lib/supabase/config': { isSupabaseMode: () => true },
  '@/lib/toolbox/office-desktop-server': { desktopFailure: error => { throw error; } },
  '@/lib/toolbox/office-server': { officeResponse: response => response },
});
const sql = postgres(config.DB_URL, { max: 1, prepare: false }), runtime = postgres(config.APP_DATABASE_URL, { max: 1, prepare: false });
const checks = [], pass = name => { checks.push(name); console.log('PASS ' + name); };
async function change(patch) { const row = await admission.getDesktopAdmission(identity); return admission.changeDesktopAdmission(identity, { enabled: row.enabled, minimumVersion: row.minimumVersion, expectedRevision: row.revision, requestId: randomUUID(), ...patch }); }
try {
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_control set verified_version='0.3.0'`, error => error.code === '42501');
  await assert.rejects(runtime`update chinatech_v2_private.office_desktop_control set release_ready=true`, error => error.code === '42501');
  pass('Actual runtime cannot update either trusted release metadata column');
  const initial = await admission.getDesktopAdmission(identity); assert.equal(initial.currentVersion, '0.2.0'); assert.deepEqual(JSON.parse(JSON.stringify(initial.eligibleMinimumVersions)), ['0.0.0', '0.2.0']);
  await assert.rejects(change({ minimumVersion: '0.3.0' }), error => error.code === 'VERSION_NOT_AVAILABLE');
  const body = await (await status.GET()).json(); assert.equal(body.currentVersion, '0.2.0');
  pass('Actual TS/admin/status with future candidate 0.3 still recommend only bound verified 0.2 and reject minimum 0.3');
  await change({ minimumVersion: '0.2.0', enabled: true });
  const paused = await change({ enabled: false }); assert.equal(paused.minimumVersion, '0.2.0'); assert.equal(paused.enabled, false);
  const resumed = await change({ enabled: true }); assert.equal(resumed.minimumVersion, '0.2.0'); assert.equal(resumed.enabled, true);
  await assert.rejects(database.withDatabase(identity, null, tx => tx`update chinatech_v2_private.office_desktop_control set minimum_version='0.3.0',updated_by=${identity.userId} where singleton`), error => error.code === '42501');
  pass('Actual administrator can pause/resume existing minimum 0.2; RLS independently rejects unverified minimum 0.3');
  await change({ minimumVersion: '0.0.0' });
  await sql`update chinatech_v2_private.office_desktop_control set release_ready=true,verified_version=null where singleton`;
  const unbound = await admission.getDesktopAdmission(identity); assert.equal(unbound.currentVersion, '0.1.1'); assert.deepEqual(JSON.parse(JSON.stringify(unbound.eligibleMinimumVersions)), ['0.0.0']);
  await sql`update chinatech_v2_private.office_desktop_control set release_ready=false,verified_version='0.2.0' where singleton`;
  const unfinished = await admission.getDesktopAdmission(identity); assert.equal(unfinished.currentVersion, '0.1.1'); assert.deepEqual(JSON.parse(JSON.stringify(unfinished.eligibleMinimumVersions)), ['0.0.0']);
  pass('A boolean without version or a version without readiness cannot promote any candidate minimum');
  await sql`update chinatech_v2_private.office_desktop_control set release_ready=true,verified_version='0.2.0' where singleton`;
  const final = await admission.getDesktopAdmission(identity); assert.equal(final.enabled, true); assert.equal(final.minimumVersion, '0.0.0'); assert.equal(final.currentVersion, '0.2.0');
  const [old] = await sql`select command_version::text as epoch,revision::text as revision from chinatech_v2_private.office_command_control where singleton`;
  assert.equal(old.epoch, fixture.oldControl.command_version); assert.equal(old.revision, fixture.oldControl.revision);
  pass('Final local fixture restored to enabled/minimum00/ready+verified0.2; old Office epoch/revision unchanged');
  writeFileSync('.local/office-public/verified-version-sql-results.json', JSON.stringify({ checks, count: checks.length, production: false, http: false, actualRestrictedPostgres: true, simulatedFutureCatalog: '0.3.0', verifiedReleaseOnlySimulatedLocally: '0.2.0', oldEpochUnchanged: true, secretsLogged: false }, null, 2));
} finally {
  await sql`update chinatech_v2_private.office_desktop_control set minimum_version='0.0.0',enabled=true,release_ready=true,verified_version='0.2.0' where singleton and updated_by=${identity.userId}`;
  await sql.end(); await runtime.end();
}
