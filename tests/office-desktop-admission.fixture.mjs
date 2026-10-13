import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const keys = JSON.parse(readFileSync('../../backend/connection.private.json', 'utf8'));
for (const [field, port] of [['API_URL', '55421'], ['DB_URL', '55422']]) {
  const url = new URL(keys[field]);
  if (url.hostname !== '127.0.0.1' || url.port !== port) throw Error('Dedicated local project fixture required');
}
const sql = postgres(keys.DB_URL, { max: 1, prepare: false });
const auth = createClient(keys.API_URL, keys.SECRET_KEY || keys.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const file = '.local/office-admission/fixture.private.json';
mkdirSync('.local/office-admission', { recursive: true });
if (process.argv.includes('--cleanup')) {
  const fixture = JSON.parse(readFileSync(file, 'utf8'));
  if (fixture.origin !== 'http://127.0.0.1:3235' || fixture.users.length !== 2 || fixture.users.some(user => !/^office-admission-(admin|other)-[a-f0-9-]+@example\.test$/.test(user.email) || !/^[a-f0-9-]{36}$/.test(user.id))) throw Error('Own dedicated synthetic fixtures required');
  const admin = fixture.users.find(user => user.role === 'admin');
  if (!admin) throw Error('Own fixture administrator required');
  const ids = fixture.users.map(user => user.id);
  try {
    const existingUsers = new Set();
    for (const user of fixture.users) {
      const [existing] = await sql`select email from auth.users where id=${user.id}`;
      if (existing && existing.email !== user.email) throw Error('Synthetic identity no longer matches; preserve');
      if (existing) existingUsers.add(user.id);
    }
    await sql.begin(async tx => {
      const [current] = await tx`select admin_user_id,enabled,command_version::text as command_version,revision::text as revision,updated_at,updated_by from chinatech_v2_private.office_command_control where singleton for update`;
      const previous = fixture.oldControl;
      if (current.admin_user_id === admin.id) {
        await tx`update chinatech_v2_private.office_command_control set admin_user_id=${previous.admin_user_id},enabled=${previous.enabled},command_version=${previous.command_version},revision=${previous.revision},updated_at=${previous.updated_at},updated_by=${previous.updated_by} where singleton`;
      } else if (JSON.stringify(current) !== JSON.stringify(previous)) {
        throw Error('Local control changed; do not overwrite');
      }
      // Only records carrying our exact synthetic IDs are removed.
      await tx`delete from chinatech_v2_private.office_desktop_control_receipts where actor_id=${admin.id}`;
      await tx`delete from chinatech_v2_private.office_desktop_receipts where actor_id=${admin.id}`;
      await tx`delete from chinatech_v2_private.office_desktop_jobs where license_id in (select id from chinatech_v2_private.office_desktop_licenses where created_by=${admin.id})`;
      await tx`delete from chinatech_v2_private.office_desktop_devices where license_id in (select id from chinatech_v2_private.office_desktop_licenses where created_by=${admin.id})`;
      await tx`delete from chinatech_v2_private.office_desktop_licenses where created_by=${admin.id}`;
      if (fixture.publicGrantIds?.length) {
        await tx`delete from chinatech_v2_private.office_desktop_public_jobs where grant_id in ${tx(fixture.publicGrantIds)}`;
        await tx`delete from chinatech_v2_private.office_desktop_public_grants where id in ${tx(fixture.publicGrantIds)}`;
      }
      await tx`update chinatech_v2_private.office_desktop_control set enabled=true,revision=0,updated_at=null,updated_by=null,minimum_version='0.0.0',release_ready=false,verified_version=null where singleton and (updated_by=${admin.id} or updated_by is null)`;
      // accounts.id intentionally has a NO ACTION FK to Auth. Remove only our
      // exact synthetic project rows before asking Auth to delete those users.
      await tx`delete from chinatech_v2.accounts where id in ${tx(ids)}`;
    });
    for (const user of fixture.users) {
      if (!existingUsers.has(user.id)) continue;
      const result = await auth.auth.admin.deleteUser(user.id);
      if (result.error) throw Error('Synthetic local account cleanup failed; status=' + result.error.status + ', code=' + (result.error.code || 'unknown'));
    }
    const [remaining] = await sql`select (select count(*)::int from auth.users where id in ${sql(ids)}) as auth_users,(select count(*)::int from chinatech_v2.accounts where id in ${sql(ids)}) as project_accounts`;
    if (remaining.auth_users !== 0 || remaining.project_accounts !== 0) throw Error('Synthetic fixture cleanup incomplete');
    fixture.cleaned = true;
    for (const user of fixture.users) { delete user.cookies; delete user.password; }
    delete fixture.signingKey;
    delete fixture.key;
    writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
    writeFileSync('.local/office-admission/cleanup-results.json', JSON.stringify({ ownFixtureUsersDeleted: 2, remainingAuthUsers: 0, remainingProjectAccounts: 0, oldOfficeControlRestoredExactly: true, privateFieldsRemoved: true, productionWrites: 0 }, null, 2));
    console.log('Dedicated local fixtures removed; previous Office control restored.');
  } finally { await sql.end(); }
} else {
  const [oldControl] = await sql`select admin_user_id,enabled,command_version::text as command_version,revision::text as revision,updated_at,updated_by from chinatech_v2_private.office_command_control where singleton`;
  if (!oldControl || oldControl.admin_user_id || oldControl.enabled) throw Error('Local Office control is in use; preserve other tests');
  const fixture = { origin: 'http://127.0.0.1:3235', users: [], oldControl, signingKey: randomBytes(32).toString('hex') };
  if (existsSync(file)) {
    if (!JSON.parse(readFileSync(file, 'utf8')).cleaned) throw Error('Existing fixture is still active; preserve');
    renameSync(file, '.local/office-admission/fixture.cleaned.' + randomUUID() + '.json');
  }
  const persist = () => writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  writeFileSync(file, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' });
  try {
    for (const role of ['admin', 'other']) {
      const email = 'office-admission-' + role + '-' + randomUUID() + '@example.test', password = randomBytes(24).toString('base64url');
      const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw Error('Synthetic local Auth creation failed');
      const record = { role, id: data.user.id, email, password, cookies: [] };
      fixture.users.push(record); persist();
      const client = createClient(keys.API_URL, keys.PUBLISHABLE_KEY || keys.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw Error('Synthetic local Auth sign-in failed');
      const session = login.data.session, claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
      record.sessionId = claims.session_id;
      await sql.begin(async tx => {
        await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: record.id, session_id: record.sessionId, role: 'authenticated' })},true)`;
        await tx`select chinatech_v2_private.enroll_login_session(false,'Office admission fixture','Test')`;
      });
      const cookies = new Map();
      const ssr = createServerClient(keys.API_URL, keys.PUBLISHABLE_KEY || keys.ANON_KEY, {
        cookieOptions: { name: 'ct_rebuild_auth', path: '/', httpOnly: true, sameSite: 'lax' },
        cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(cookie => cookies.set(cookie.name, cookie.value)) },
      });
      const established = await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (established.error) throw Error('Synthetic local SSR session failed');
      record.cookies = [...cookies].map(([name, value]) => ({ name, value, url: fixture.origin, httpOnly: true, sameSite: 'Lax' }));
      persist();
    }
    const admin = fixture.users.find(user => user.role === 'admin');
    const rows = await sql`update chinatech_v2_private.office_command_control set admin_user_id=${admin.id},enabled=true where singleton and admin_user_id is null and not enabled and command_version=${oldControl.command_version} and revision=${oldControl.revision} returning singleton`;
    if (rows.length !== 1) throw Error('Local fixture lost control ownership race');
    fixture.prepared = true; persist();
    console.log('Prepared two verified local Auth/SSR fixtures, dedicated origin and unchanged old epoch/revision.');
  } finally { await sql.end(); }
}
