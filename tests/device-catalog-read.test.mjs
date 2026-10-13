import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const accountId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const entry = (patch = {}) => ({ id: 'test-model', category: 'phone', brand: 'Samsung', family: 'Galaxy A', name: 'Galaxy A13', releasedAt: null, year: null, generation: '', network: '4G', platform: 'SM-A137', modelCodes: ['000123'], aliases: ['A13 LTE'], markets: ['IT'], status: 'review', enabled: true, sourceUrls: [], checkedAt: null, notes: 'Synthetic only', ...patch });

function harness({ preview = false } = {}) {
  const state = { transactions: 0, memberships: 0, queries: [], live: true, allowed: true, manager: true, memberRevision: 1, total: 2,
    entries: [entry(), entry({ id: 'test-other', category: 'laptop', name: 'Book', family: 'Book' }), entry({ id: 'test-disabled', enabled: false })] };
  class BackendError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  class AuthRequestError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const tx = (parts, ...values) => {
    const text = parts.reduce((result, part, i) => result + part + (i < values.length ? values[i]?.text ?? JSON.stringify(values[i]) : ''), '');
    return { text, then: (resolve, reject) => Promise.resolve().then(() => {
      state.queries.push(text);
      if (text.includes('select store_id')) return state.allowed ? [{ store_id: storeId }] : [];
      if (text.includes('set_config')) return [];
      if (text.includes('device_catalog_control')) return [{ revision: '9', admin_user_id: state.manager ? accountId : null }];
      if (text.includes('count(*)::int as total') && !text.includes('group by')) return [{ total: state.total }];
      if (text.includes('group by brand,family')) return [{ brand: 'Samsung', value: 'Galaxy A', total: state.total }];
      if (text.includes('group by brand')) return [{ value: 'Samsung', total: state.total }];
      if (text.includes('group by family')) return [{ value: 'Galaxy A', total: state.total }];
      if (text.includes('select id,category,brand,family')) return Array.from({ length: state.total }, (_, i) => domain.catalogPickerModel(entry({ id: 'test-' + i })));
      if (text.includes('select data,version')) return [{ data: entry(), version: 1 }];
      if (text.includes('device_catalog_history')) return [];
      throw new Error('Unexpected synthetic SQL: ' + text);
    }).then(resolve, reject) };
  };
  tx.array = values => ({ text: JSON.stringify(values) });
  const modules = new Map();
  function load(path) {
    path = resolve(path); if (modules.has(path)) return modules.get(path);
    const exports = {};
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInContext(source, createContext({ exports, Buffer, URL, Headers, AbortSignal, console, performance, process: { env: {} }, require: name => {
      if (name === 'server-only') return {};
      if (name === '@/lib/backend/database') return { BackendError, withDatabase: async (_identity, _storeId, run) => { state.transactions++; if (!state.live) throw new BackendError('Revoked synthetic session', 401); return run(tx); } };
      if (name === '@/lib/backend/context') return { memberInTransaction: async (transaction, requestedStore, requestedAccount) => {
        assert.equal(transaction, tx); assert.equal(requestedStore, storeId); assert.equal(requestedAccount, accountId);
        state.memberships++; if (!state.allowed) throw new BackendError('Revoked synthetic membership', 403);
        return { id: memberId, revision: state.memberRevision };
      } };
      if (name === '@/lib/supabase/config') return { isSupabaseMode: () => !preview };
      if (name === '@/lib/supabase/server') return { AuthRequestError, createSupabaseRouteClient: () => ({ auth: {
        getUser: async () => ({ data: { user: { id: accountId, email_confirmed_at: '2026-01-01' } }, error: null }),
        getClaims: async () => ({ data: { claims: { sub: accountId, session_id: sessionId } }, error: null }),
      } }), requireSameOrigin: () => {}, preventAuthCaching: response => response };
      if (name === '@/lib/server/auth-flows' || name === './auth-flows') return { copyAuthCookies: (_source, response) => response };
      if (name === '@/lib/preview-auth') return { isPreviewLoginAvailable: () => true, PREVIEW_SESSION_COOKIE: 'preview-session', PREVIEW_SESSION_VALUE: 'synthetic' };
      if (name === '@/lib/device-catalog-seed') return { catalogSeedRows: state.entries.map(row => ({ ...row, version: 1 })), catalogSeedSources: [], catalogSeedCoverage: [] };
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('./') || name.startsWith('../')) return load(resolve(dirname(path), name + '.ts'));
      return require(name);
    } }), { filename: path });
    modules.set(path, exports); return exports;
  }
  const domain = load('lib/device-catalog.ts');
  const scope = () => ({ accountId, sessionId, storeId, memberId, memberRevision: state.memberRevision });
  const get = (path, headers = {}) => load('app/api/catalog/route.ts').GET(new NextRequest('https://synthetic.example.test/api/catalog' + path, { headers: { cookie: preview ? 'preview-session=synthetic' : 'ct_store=' + storeId, ...headers } }));
  return { state, load, domain, scope, get };
}

test('verified identity-only helper does no DB read; account session still validates live session', async () => {
  const h = harness(); const auth = h.load('lib/server/account-auth.ts');
  const request = new NextRequest('https://synthetic.example.test/account');
  assert.equal((await auth.requireAccountIdentity(request, NextResponse.json({}))).identity.userId, accountId);
  assert.equal(h.state.transactions, 0);
  await auth.requireAccountSession(request, NextResponse.json({})); assert.equal(h.state.transactions, 1);
  h.state.live = false;
  await assert.rejects(auth.requireAccountSession(request, NextResponse.json({})), error => error.status === 401);
});

test('catalog GET state, groups, models, history and coverage use one complete authorized transaction', async () => {
  for (const kind of ['state', 'groups', 'models', 'history', 'coverage']) {
    const h = harness(); const response = await h.get('?kind=' + kind);
    assert.equal(response.status, 200, await response.text());
    assert.equal(h.state.transactions, 1, kind); assert.equal(h.state.memberships, 1, kind);
    assert.equal(h.state.queries.filter(text => text.includes('device_catalog_control')).length, 1, kind);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.match(response.headers.get('server-timing'), /^auth;dur=\d+\.\d, catalog;dur=\d+\.\d, total;dur=\d+\.\d$/);
    assert.ok(!response.headers.get('server-timing').includes(accountId));
    assert.ok(h.state.queries.findIndex(text => text.includes("set_config('app.store_id'")) < h.state.queries.findIndex(text => text.includes('device_catalog_control')));
  }
});

test('picker index projection preserves unknown fields and complete branches through 3000 models', async () => {
  for (const total of [0, 3000, 3001]) {
    const h = harness(); h.state.total = total; h.state.manager = false;
    const response = await h.get('?kind=picker-index&category=phone'); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.complete, total <= 3000); assert.equal(body.models.length, total <= 3000 ? total : 0);
    assert.equal(body.brands[0].total, total); assert.equal(body.families[0].total, total);
    assert.deepEqual(body.scope, h.scope()); assert.equal(h.state.transactions, 1); assert.equal(h.state.memberships, 1);
    if (total && total <= 3000) { assert.equal(body.models[0].year, null); assert.equal(body.models[0].releasedAt, null); assert.deepEqual(body.models[0].modelCodes, ['000123']); assert.deepEqual(Object.keys(body.models[0]).sort(), ['id', 'category', 'brand', 'family', 'name', 'releasedAt', 'year', 'network', 'platform', 'modelCodes', 'aliases', 'status'].sort()); }
    if (total > 3000) assert.ok(!h.state.queries.some(text => text.includes('select id,category,brand,family')));
  }
});

test('known revision is unchanged only after live authorization and exact scope; no scope returns a full index', async () => {
  const h = harness(); const headers = { 'x-ct-catalog-scope': h.domain.catalogPickerScopeKey(h.scope()) };
  const response = await h.get('?kind=picker-index&category=phone&knownRevision=9', headers);
  const body = await response.json(); assert.equal(body.unchanged, true); assert.equal(body.models, undefined);
  assert.equal(h.state.transactions, 1); assert.equal(h.state.memberships, 1);
  assert.ok(!h.state.queries.some(text => text.includes('device_catalog_entries')));
  assert.equal((await (await h.get('?kind=picker-index&category=phone&knownRevision=9')).json()).unchanged, false);
  h.state.allowed = false; assert.equal((await h.get('?kind=picker-index&category=phone&knownRevision=9', headers)).status, 403);
  h.state.allowed = true; h.state.live = false; assert.equal((await h.get('?kind=picker-index&category=phone&knownRevision=9', headers)).status, 401);
});

test('scope, account and session changes fail closed; ordinary members cannot access disabled/admin reads', async () => {
  const h = harness(); const headers = { 'x-ct-catalog-scope': h.domain.catalogPickerScopeKey(h.scope()) };
  h.state.memberRevision++;
  assert.equal((await h.get('?kind=picker-index&category=phone&knownRevision=9', headers)).status, 409);
  for (const header of ['x-ct-account-id', 'x-ct-session-id']) {
    const before = h.state.transactions; assert.equal((await h.get('?kind=picker-index&category=phone', { [header]: 'changed' })).status, 409); assert.equal(h.state.transactions, before);
  }
  h.state.manager = false;
  for (const path of ['?disabled=true', '?kind=history', '?kind=coverage']) assert.equal((await h.get(path)).status, 403);
});

test('picker index requires a concrete category and cannot request search pages or disabled entries', async () => {
  const h = harness();
  for (const tail of ['', '&category=', '&category=手机', '&category=phone&disabled=true', '&category=phone&q=test', '&category=phone&page=2']) assert.equal((await h.get('?kind=picker-index' + tail)).status, 400);
  assert.equal(h.state.transactions, 0);
  assert.equal((await h.get('?kind=picker-index&category=computer')).status, 200);
});

test('groups with no category include every category, while concrete form categories stay bounded', async () => {
  const h = harness(); await h.get('?kind=groups');
  assert.match(h.state.queries.find(text => text.includes('group by brand')), /true or category=any/);
  h.state.queries.length = 0; await h.get('?kind=groups&category=phone');
  assert.match(h.state.queries.find(text => text.includes('group by brand')), /false or category=any\(\["phone"\]\)/);
});

test('preview index and all-category groups honor enabled data, canonical brands and known scope', async () => {
  const h = harness({ preview: true }); const response = await h.get('?kind=picker-index&category=phone&brand=三星');
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.brand, 'Samsung'); assert.equal(body.models.length, 1); assert.equal(body.complete, true); assert.equal(body.models[0].id, 'test-model');
  const headers = { 'x-ct-catalog-scope': h.domain.catalogPickerScopeKey(body.scope) };
  assert.equal((await (await h.get('?kind=picker-index&category=phone&knownRevision=seed', headers)).json()).unchanged, true);
  assert.equal((await h.get('?kind=picker-index&category=phone', { 'x-ct-catalog-scope': 'changed' })).status, 409);
  const groups = await (await h.get('?kind=groups')).json(); assert.equal(groups.brands[0].total, 2);
  assert.equal(h.state.transactions, 0);
});

test('explicit empty family is distinct from an unfiltered brand in pagination and preview indexes', async () => {
  const h = harness({ preview: true });
  const rows = Array.from({ length: 130 }, (_, i) => ({ ...entry({ id: 'test-' + i, name: 'Model ' + i, family: i < 110 ? '' : 'Galaxy A' }), version: 1 }));
  const branch = h.domain.catalogQueryPage(rows, { category: 'phone', brand: 'Samsung', family: '' }, '9');
  const emptyFamily = h.domain.catalogQueryPage(rows, { category: 'phone', brand: 'Samsung', family: '', familyExact: true, page: 3 }, '9');
  assert.equal(branch.total, 130); assert.equal(emptyFamily.total, 110); assert.equal(emptyFamily.rows.length, 10); assert.ok(emptyFamily.rows.every(row => row.family === ''));
  h.state.entries.push(entry({ id: 'test-ungrouped', family: '' }));
  const index = await (await h.get('?kind=picker-index&category=phone&brand=Samsung&family=&familyExact=1')).json();
  assert.equal(index.complete, true); assert.deepEqual(index.models.map(row => row.id), ['test-ungrouped']);
  assert.ok(index.families.some(row => row.value === '' && row.total === 1));
  const page = await (await h.get('?category=phone&brand=Samsung&family=&familyExact=1')).json();
  assert.equal(page.total, 1); assert.equal(page.rows[0].id, 'test-ungrouped');
  const unfiltered = await (await h.get('?kind=picker-index&category=phone&brand=Samsung')).json();
  assert.equal(unfiltered.models.length, 2);
});
