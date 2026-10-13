import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
class BackendError extends Error { constructor(message, status) { super(message); this.status = status; } }
function harness(overrides = {}) {
  const state = { user: { id: 'account-a', email: 'owner@example.test', email_confirmed_at: '2026-10-07' }, claims: { sub: 'account-a', session_id: 'session-a' }, account: {display_name:'Canonical owner'}, rows: [{ store_id: 'store-a', name:'Own store', role:'owner' }], allowed: true, calls: [], ...overrides };
  const client = { auth: { getUser: async () => ({ data: { user: state.user }, error: state.userError }), getClaims: async () => ({ data: { claims: state.claims }, error: state.claimError }) } };
  const exports = {};
  const context = createContext({ exports, process: { env: { APP_DATABASE_URL: 'synthetic-key' } }, require: name => {
    if (name === '@/lib/backend/database') return { BackendError, withDatabase: async (identity, store, run) => { state.calls.push(['live', identity, store]); if (state.databaseError) throw state.databaseError; return run(async parts => { const sql = parts.join('?'); state.calls.push(['sql', sql]); return sql.includes('member_access') ? [{ allowed: state.allowed }] : sql.includes('from chinatech_v2.accounts') ? [state.account] : state.rows; }); } };
    if (name === '@/lib/staff') return { staffRoles: {owner:'老板',manager:'店长',sales:'销售',technician:'技术员',viewer:'只读'} };
    if (name === '@/lib/supabase/config') return { isSupabaseMode: () => true };
    if (name === '@/lib/supabase/server') return { createSupabaseServerClient: async () => client };
    if (name === '@/lib/preview-auth') return {};
    if (name === 'next/headers') return { cookies: async () => ({ getAll: () => state.cookies ?? [], get: () => undefined }) };
    return require(name);
  } });
  runInContext(ts.transpileModule(readFileSync('lib/server/auth-status.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { state, resolve: store => exports.resolveAuthStatus(client, store), get: exports.getAuthStatus };
}
test('public projection authenticates account and live project session before membership', async () => {
  const h = harness(); const result = await h.resolve(); assert.equal(result.state,'workspace'); assert.match(result.scope,/^[a-f0-9]{64}$/); assert.deepEqual(Object.keys(result).sort(),['account','formal','scope','state','store']);
  assert.equal(h.state.calls[0][0],'live'); assert.equal(h.state.calls[0][2],null);
  assert.ok(h.state.calls.filter(([kind])=>kind==='sql').every(([,query])=>query.startsWith('select ')));
  assert.ok(!JSON.stringify(result).includes('account-a')); assert.ok(!JSON.stringify(result).includes('session-a'));
});
test('cookie absence stays anonymous without contacting identity/database', async () => { const h=harness();assert.equal((await h.get()).state,'anonymous');assert.equal(h.state.calls.length,0); });
test('unverified identity never receives account or store access',async()=>{const h=harness({user:{id:'a'}});assert.equal((await h.resolve()).state,'unverified');assert.equal(h.state.calls.length,0);});
test('no membership or revoked membership remains account-only',async()=>{for(const overrides of [{rows:[]},{allowed:false}])assert.equal((await harness(overrides).resolve()).state,'account');});
test('stale selected store cannot silently select another store',async()=>{const h=harness();assert.equal((await h.resolve('other')).state,'account');assert.equal(h.state.calls.length,3);});
test('revoked, idle-expired or disabled project identity is anonymous',async()=>{const h=harness({databaseError:new BackendError('invalid',401)});assert.equal((await h.resolve()).state,'anonymous');});
test('auth and database outages are unavailable, never anonymous or pending',async()=>{for(const overrides of [{userError:{status:503}},{userError:{name:'AuthRetryableFetchError',status:0}},{claimError:{status:503}},{databaseError:new Error('network')}])assert.equal((await harness(overrides).resolve()).state,'unavailable');});
test('invalid credentials cannot reach membership query',async()=>{for(const overrides of [{user:null},{userError:{name:'AuthSessionMissingError'}},{userError:{status:400,code:'refresh_token_not_found'}},{claims:{sub:'other',session_id:'a'}},{claims:{sub:'account-a'}}]){const h=harness(overrides);assert.equal((await h.resolve()).state,'anonymous');assert.equal(h.state.calls.length,0);}});
test('display scope changes on account or session replacement',async()=>{const a=await harness().resolve(),b=await harness({claims:{sub:'account-a',session_id:'session-b'}}).resolve(),c=await harness({user:{id:'account-b',email_confirmed_at:'yes'},claims:{sub:'account-b',session_id:'session-a'}}).resolve();assert.notEqual(a.scope,b.scope);assert.notEqual(a.scope,c.scope);});

test('own canonical display name and verified primary email ignore provider metadata',async()=>{const h=harness({user:{id:'account-a',email:'primary@example.test',email_confirmed_at:'yes',new_email:'pending@example.test',user_metadata:{display_name:'Injected provider',role:'owner'}},rows:[{store_id:'store-a',name:'Own store',role:'technician'}]});const r=await h.resolve();assert.equal(r.account.name,'Canonical owner');assert.equal(r.account.email,'primary@example.test');assert.equal(r.store.name,'Own store');assert.equal(r.store.role,'technician');assert.ok(!JSON.stringify(r).includes('pending@example.test'));});
test('blank canonical name falls back to the actual login email',async()=>{const r=await harness({account:{display_name:'  '}}).resolve();assert.equal(r.account.name,'owner@example.test');});
test('revoked store projection cannot reveal a store name or role',async()=>{for(const overrides of[{allowed:false},{rows:[]}]){const r=await harness(overrides).resolve();assert.equal(r.state,'account');assert.equal(r.store,null);assert.equal(r.account.name,'Canonical owner');}});
test('anonymous, unavailable and unverified states expose no personal profile',async()=>{for(const overrides of[{user:null},{user:{id:'a'}},{databaseError:new BackendError('revoked',401)},{databaseError:new Error('offline')}]){const r=await harness(overrides).resolve();assert.equal(r.account,null);assert.equal(r.store,null);}});
