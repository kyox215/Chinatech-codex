import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import {sourceLoader} from "./helpers/typescript-source.mjs";

// Compile the actual client into an isolated browser-like context for each test.
// Fetch never leaves this context; all members, amounts and responses are synthetic.
const source = readFileSync(new URL("../lib/backend/client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bootstrapCompiled = ts.transpileModule(readFileSync(new URL("../lib/backend/bootstrap.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const readPlan=sourceLoader()("./lib/backend/read-plan");

const storeId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const clerkId = "00000000-0000-4000-8000-000000000003";

function mockSnapshot({ memberId = clerkId, revision = 1, memberRevision = 1, costCents = null } = {}) {
  return {
    storeId,
    revision,
    staff: {
      revision,
      currentId: memberId,
      audit: [],
      members: [{
        id: memberId, name: "Synthetic member", email: "synthetic@example.invalid",
        role: memberId === ownerId ? "owner" : "viewer", revision: memberRevision,
        permissions: memberId === ownerId ? ["financial.read"] : ["retail.view"],
        accountStatus: "active", membershipStatus: "active",
      }],
    },
    settings: { finance: [], suppliers: [] },
    intakes: [], signatures: [], workflows: {}, procurement: [], customers: [],
    retail: [{ id: "synthetic-unit", costCents }],
  };
}

test("轻量未变化响应保留快照引用且不通知业务订阅",async()=>{
  const h=harness();const initial=mockSnapshot();initial.stateToken="a".repeat(64);
  h.client.configureBackend(initial);const count=h.publications.length;
  const pending=h.client.refreshBackend();
  assert.equal(h.requests[0].url,"/api/backend/state?known="+initial.stateToken);
  h.requests[0].resolve(response(200,{unchanged:true,stateToken:initial.stateToken,storeId,memberId:clerkId,revision:initial.revision}));await pending;
  assert.equal(h.client.backendSnapshot(),initial);assert.equal(h.publications.length,count);
});

test("相同业务版本但不同权限令牌必须发布新投影",async()=>{
  const h=harness();const initial=mockSnapshot({memberId:ownerId,costCents:12000});initial.stateToken="a".repeat(64);
  h.client.configureBackend(initial);const pending=h.client.refreshBackend();
  const next=mockSnapshot({memberId:ownerId,memberRevision:2});next.stateToken="b".repeat(64);next.staff.members[0].permissions=[];
  h.requests[0].resolve(response(200,next));await pending;
  assert.equal(h.client.backendSnapshot(),next);assert.equal(h.client.backendSnapshot().retail[0].costCents,null);
});

test("轻量响应不能跨成员或门店抑制刷新",async()=>{
  for(const wrong of [{memberId:ownerId},{storeId:"other-store"},{stateToken:"b".repeat(64)},{revision:99}]){
    const h=harness();const initial=mockSnapshot();initial.stateToken="a".repeat(64);h.client.configureBackend(initial);
    const pending=h.client.refreshBackend();const rejected=assert.rejects(pending,/核对结果无效/);
    h.requests[0].resolve(response(200,{unchanged:true,stateToken:initial.stateToken,storeId,memberId:clerkId,revision:1,...wrong}));await rejected;
    assert.equal(h.client.backendSnapshot(),initial);
  }
});

test("同令牌完整兼容响应也不重建业务状态",async()=>{
  const h=harness();const initial=mockSnapshot();initial.stateToken="a".repeat(64);h.client.configureBackend(initial);const count=h.publications.length;
  const pending=h.client.refreshBackend();h.requests[0].resolve(response(200,structuredClone(initial)));await pending;
  assert.equal(h.publications.length,count);assert.equal(h.client.backendSnapshot(),initial);
});

test("旧服务端仍返回完整快照时可继续刷新",async()=>{
  const h=harness();const initial=mockSnapshot();initial.stateToken="a".repeat(64);h.client.configureBackend(initial);
  const pending=h.client.refreshBackend();const next=mockSnapshot({revision:2});h.requests[0].resolve(response(200,next));await pending;
  assert.equal(h.client.backendSnapshot(),next);
});

test("旧未变化响应不能撤销随后保存的新版本",async()=>{
  const h=harness();const initial=mockSnapshot();initial.stateToken="a".repeat(64);h.client.configureBackend(initial);
  const refresh=h.client.refreshBackend();const command=h.client.backendCommand("synthetic.command",{});await setImmediate();
  const next=mockSnapshot({revision:2});next.stateToken="b".repeat(64);h.requests[1].resolve(response(200,next));await command;
  h.requests[0].resolve(response(200,{unchanged:true,stateToken:initial.stateToken,storeId,memberId:clerkId,revision:1}));await refresh;
  assert.equal(h.client.backendSnapshot(),next);
});

test("恢复读取按身份合并，延迟旧读取不污染新账号",async()=>{
  const h=harness();const reads=[];
  h.storage.pendingOperation=key=>new Promise(resolve=>reads.push({key,resolve}));
  h.client.configureBackend(mockSnapshot());const one=h.client.loadRecovery();const two=h.client.loadRecovery();
  assert.equal(one,two);assert.equal(reads.length,1);
  h.client.configureBackend(mockSnapshot({memberId:ownerId}));const newRead=h.client.loadRecovery();assert.equal(reads.length,2);
  reads[0].resolve({scope:storeId+":"+clerkId,phase:"unknown",createdAt:1,command:{requestId:"old"}});await one;
  assert.equal(h.client.backendRecovery().pending,null);
  const next={scope:storeId+":"+ownerId,phase:"unknown",createdAt:2,command:{requestId:"new"}};reads[1].resolve(next);await newRead;
  assert.equal(h.client.backendRecovery().pending,next);
});

test("写入前延迟恢复读取不能清除随后离线持久化的原意图",async()=>{
  const h=harness();let resolveOld;let count=0;
  h.storage.pendingOperation=key=>++count===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(h.operations.get(key));
  h.client.configureBackend(mockSnapshot());const old=h.client.loadRecovery();h.navigator.onLine=false;
  await assert.rejects(h.client.backendCommand("synthetic.command",{}),/离线/);await setImmediate();
  const pending=h.client.backendRecovery().pending;assert.ok(pending);
  resolveOld(undefined);await old;assert.equal(h.client.backendRecovery().pending.command.requestId,pending.command.requestId);
  assert.equal(h.operations.size,1);
});

function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function harness({requestDeadline}={}) {
  const requests = [];
  const redirects = [];
  const publications = [];
  const operations=new Map();
  const storage={
    memberScope:state=>state.storeId+":"+state.staff.currentId,
    pendingOperation:async key=>operations.get(key),
    reserveOperation:async value=>{if(operations.has(value.scope))throw new Error("还有待核对的提交");operations.set(value.scope,structuredClone(value));},
    markOperationUnknown:async(key,id)=>{const p=operations.get(key);if(p?.command.requestId===id)operations.set(key,{...p,phase:"unknown"});},
    forgetOperation:async(key,id)=>{if(operations.get(key)?.command.requestId===id)operations.delete(key);},
  };
  const navigator={onLine:true};
  const context = createContext({
    require:name=>{if(name==="./read-plan")return readPlan;assert.equal(name,"./recovery-store");return storage;},
    Headers, AbortController,URLSearchParams,setTimeout:requestDeadline?((fn,ms)=>setTimeout(fn,ms===20000?requestDeadline:ms)):setTimeout,clearTimeout,navigator,
    exports: {},
    crypto: { randomUUID },
    fetch: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort",()=>reject(Object.assign(new Error("timeout"),{name:"AbortError"})),{once:true});
      requests.push({ url, options, resolve:async result=>{
        if(url==="/api/backend/command" && result.ok){const data=await result.json();data.operation={requestId:JSON.parse(options.body).requestId,entityId:"synthetic-unit",kind:"synthetic.command",committedAt:"2026-10-02T00:00:00Z",replayed:false};}
        resolve(result);
      }, reject });
    }),
    window: { location: { assign: url => redirects.push(url), reload: () => redirects.push("reload") } },
  });
  runInContext(compiled, context, { filename: "lib/backend/client.ts" });
  const client = context.exports;
  const bootstrapExports = {};
  runInContext(`(function(exports){${bootstrapCompiled}\n})`, context, { filename: "lib/backend/bootstrap.ts" })(bootstrapExports);
  const bootstrap = initial => bootstrapExports.createBackendBootstrap(initial, {
    generation: client.backendReadGeneration, read: client.backendSnapshot, subscribe: client.subscribeBackend,
    configure: client.configureBackend, reconcile: client.reconcileBackendInitial,
    release: client.releaseBackendBootstrap, canAdoptRelease: client.canAdoptBackendBootstrap,
  });
  client.subscribeBackend(() => publications.push(client.backendSnapshot()));
  return { client, bootstrap, requests, redirects, publications, operations, navigator, storage };
}

test("两个请求各自保留服务端initial，render/read不写共享客户端状态", () => {
  const h = harness();
  const first = mockSnapshot({ memberId: ownerId, costCents: 12000 });
  const second = mockSnapshot({ revision: 2 });
  second.storeId = "synthetic-other-store";
  const one = h.bootstrap(first), two = h.bootstrap(second);
  assert.equal(one.server(), first); assert.equal(two.server(), second);
  assert.equal(one.read(), first); assert.equal(two.read(), second);
  assert.equal(one.isActive(), false); assert.equal(two.isActive(), false);
  assert.equal(h.client.backendSnapshot(), null); assert.equal(h.client.backendReadGeneration(), 0);
  assert.equal(h.publications.length, 0);
});

test("新key可接管正常前任cleanup，旧owner晚cleanup不能清新账号", () => {
  const h = harness();
  const first = mockSnapshot({ memberId: ownerId, costCents: 12000 });
  const second = mockSnapshot({ revision: 2 });
  const one = h.bootstrap(first); assert.equal(one.activate(first), true);
  const two = h.bootstrap(second), discarded = h.bootstrap(first);
  const baseline = h.client.backendReadGeneration();
  one.dispose();
  assert.equal(h.client.canAdoptBackendBootstrap(baseline), true);
  assert.equal(two.activate(second), true); assert.equal(two.isActive(), true);
  assert.equal(two.read(), second); assert.equal(one.read(), null);
  const generation = h.client.backendReadGeneration(), publications = h.publications.length;
  one.dispose();
  assert.equal(h.client.backendReadGeneration(), generation);
  assert.equal(h.client.backendSnapshot(), second); assert.equal(h.publications.length, publications);
  assert.equal(one.activate(first), false); assert.equal(discarded.activate(first), false);
  assert.equal(h.client.backendSnapshot(), second);
});

test("StrictMode只允许自己的release重放，身份clear和第三方configure撤销重放授权", () => {
  const h = harness(), initial = mockSnapshot();
  const scope = h.bootstrap(initial); assert.equal(scope.activate(initial), true);
  scope.dispose(); assert.equal(scope.read(), null);
  assert.equal(scope.activate(initial), true); assert.equal(scope.read(), initial);
  scope.dispose(); h.client.clearBackend();
  assert.equal(scope.activate(initial), false); assert.equal(scope.readFor(initial), null);
  assert.equal(h.client.backendSnapshot(), null);
  const owner = mockSnapshot({ memberId: ownerId, revision: 2 });
  const live = h.bootstrap(owner); assert.equal(live.activate(owner), true);
  const candidate = h.bootstrap(initial), baseline = h.client.backendReadGeneration();
  live.dispose(); assert.equal(h.client.canAdoptBackendBootstrap(baseline), true);
  h.client.configureBackend(owner);
  assert.equal(h.client.canAdoptBackendBootstrap(baseline), false);
  assert.equal(candidate.activate(initial), false); assert.equal(h.client.backendSnapshot(), owner);
});

test("clear后旧initial和迟到API都不能复活正式快照", async () => {
  const h = harness(), initial = mockSnapshot({ memberId: ownerId, costCents: 12000 });
  const scope = h.bootstrap(initial); assert.equal(scope.activate(initial), true);
  const candidate = h.bootstrap(initial);
  const pending = h.client.refreshBackend();
  h.client.clearBackend(); const publications = h.publications.length;
  assert.equal(scope.read(), null); assert.equal(scope.readFor(initial), null);
  assert.equal(scope.activate(initial), false); assert.equal(candidate.activate(initial), false);
  h.requests[0].resolve(response(200, mockSnapshot({ memberId: ownerId, revision: 2, costCents: 12500 })));
  await pending;
  assert.equal(h.client.backendSnapshot(), null); assert.equal(scope.readFor(initial), null);
  assert.equal(h.publications.length, publications); assert.deepEqual(h.redirects, []);
});

test("同scope服务端刷新保留正在发送与失败待核对的同一unknown请求", async () => {
  const h = harness(), initial = mockSnapshot(), scope = h.bootstrap(initial);
  assert.equal(scope.activate(initial), true); await h.client.loadRecovery();
  const requestId = randomUUID(), command = h.client.backendCommand("synthetic.command", {}, requestId);
  const failed = assert.rejects(command, /Synthetic temporary failure/);
  await setImmediate();
  const inflight = h.client.backendRecovery();
  assert.equal(inflight.busy, true); assert.equal(inflight.pending.phase, "unknown");
  assert.equal(inflight.pending.command.requestId, requestId);
  const next = mockSnapshot({ revision: 2 }); assert.equal(scope.activate(next), true);
  assert.equal(h.client.backendRecovery(), inflight); assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].options.body).requestId, requestId);
  h.requests[0].resolve(response(503, { message: "Synthetic temporary failure" })); await failed;
  const unknown = h.client.backendRecovery();
  assert.equal(unknown.busy, false); assert.equal(unknown.pending.phase, "unknown");
  assert.equal(unknown.pending.command.requestId, requestId);
  assert.equal(scope.activate(mockSnapshot({ revision: 3 })), true);
  assert.equal(h.client.backendRecovery(), unknown);
  assert.equal([...h.operations.values()][0].command.requestId, requestId);
});

test("新权限投影在passive reconcile前生效，陈旧成员版本不能借较高业务版回显成本", () => {
  const h = harness(), initial = mockSnapshot({ memberId: ownerId, revision: 5, costCents: 12000 });
  const scope = h.bootstrap(initial); assert.equal(scope.activate(initial), true);
  const revoked = mockSnapshot({ memberId: ownerId, revision: 5, memberRevision: 2 });
  revoked.staff.members[0].permissions = [];
  assert.equal(scope.readFor(revoked), revoked);
  assert.equal(scope.readFor(revoked).retail[0].costCents, null);
  assert.equal(h.client.backendSnapshot(), initial, "render must not mutate the global client");
  assert.equal(scope.activate(revoked), true); assert.equal(h.client.backendSnapshot(), revoked);
  const stalePermission = mockSnapshot({ memberId: ownerId, revision: 6, memberRevision: 1, costCents: 12500 });
  assert.equal(scope.readFor(stalePermission), revoked);
  assert.equal(scope.activate(stalePermission), true); assert.equal(h.client.backendSnapshot(), revoked);
});

test("采购旧搜索和反馈在权限/身份变化清除，未激活新scope不借用旧UI", async () => {
  const h = harness(), first = mockSnapshot({ memberId: ownerId });
  let activeScope = h.bootstrap(first), initial = first;
  assert.equal(activeScope.activate(first), true);
  // Exercise the actual procurement UI store and actual command client. The
  // display-hook adapter is separate from the real React hydration harness.
  const procurementSource = readFileSync(new URL("../components/procurement/procurement-provider.tsx", import.meta.url), "utf8") + "\nexport {readUi as readUiTest, dispatchAction as dispatchTest};";
  const code = ts.transpileModule(procurementSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const state = () => ({ formal: true, snapshot: activeScope.readFor(initial), active: activeScope.isActive() });
  const hooks = { useBackendState: state, useBackendStore: (_subscribe, _read, _server, project) => project(state().snapshot) };
  const react = { createContext: () => ({ Provider: "provider" }),useContext:()=>null, useSyncExternalStore: (_subscribe, read) => read() };
  const context = createContext({ exports: {}, Event, crypto: { randomUUID }, window: { dispatchEvent() {} }, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: (_type, props) => props.value };
    if (name === "@/components/backend-snapshot") return hooks;
    if (name === "@/lib/backend/client") return h.client;
    if (name === "@/lib/procurement-fixtures") return { procurementRecords: [] };
    return new Proxy({}, { get: (_target, key) => () => { throw new Error(`Unexpected domain call ${name}.${String(key)}`); } });
  } });
  runInContext(code, context, { filename: "components/procurement/procurement-provider.tsx" });
  const provider = context.exports;
  provider.readUiTest();
  const action = provider.dispatchTest({ type: "create", record: { id: "synthetic-old-record" } });
  await setImmediate(); h.requests[0].resolve(response(200, mockSnapshot({ memberId: ownerId, revision: 2 }))); await action;
  await provider.dispatchTest({ type: "list-view", view: { query: "Synthetic private search", filter: "open", repairId: "synthetic-repair", groupBy: "supplier" } });
  assert.equal(provider.readUiTest().feedback.recordId, "synthetic-old-record");
  assert.equal(provider.readUiTest().listView.query, "Synthetic private search");
  const next = mockSnapshot({ memberId: ownerId, revision: 2, memberRevision: 2 }); next.staff.members[0].permissions = [];
  assert.equal(activeScope.activate(next), true); initial = next;
  assert.equal(provider.readUiTest().feedback, null); assert.equal(provider.readUiTest().listView.query, "");
  await provider.dispatchTest({ type: "list-view", view: { query: "Second private search", filter: "open", repairId: "synthetic-repair", groupBy: "supplier" } });
  const second = mockSnapshot({ revision: 3 }); activeScope = h.bootstrap(second); initial = second;
  const preActivation = provider.ProcurementProvider({ children: null });
  assert.equal(preActivation.listView.query, ""); assert.equal(preActivation.feedback, null);
  h.client.clearBackend();
  assert.equal(provider.readUiTest().listView.query, ""); assert.equal(provider.readUiTest().feedback, null);
  h.client.configureBackend(second);
  assert.equal(provider.readUiTest().listView.query, ""); assert.equal(provider.readUiTest().feedback, null);
  let finishTargetRead;
  const targetSource={read:()=>h.client.backendSnapshot(),refreshAfterCommand:()=>new Promise(resolve=>{finishTargetRead=resolve;})};
  const pendingTarget=provider.dispatchTest({type:"create",record:{id:"synthetic-confirmed-old-scope"}},undefined,targetSource);
  const isolatedResult=assert.rejects(pendingTarget,/账号访问权限已变化/);
  await setImmediate();h.requests[1].resolve(response(200,mockSnapshot({revision:4})));await setImmediate();
  assert.equal(h.operations.size,0); // Command was confirmed and original intent cleared.
  h.client.configureBackend(mockSnapshot({memberId:ownerId,revision:5}));
  assert.equal(provider.readUiTest().feedback,null);
  finishTargetRead(null);await isolatedResult;
  assert.equal(provider.readUiTest().feedback,null);
  assert.equal(h.operations.size,0); // Late UI isolation never recreates an unknown intent.
});

test("同店老板旧命令响应不能替换随后登录的员工身份或恢复成本", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot({ memberId: ownerId, costCents: 12000 }));
  const pending = h.client.backendCommand("synthetic.command", {}, randomUUID());
  const rejected = assert.rejects(pending, /身份已变化/);
  await setImmediate();
  assert.equal(h.requests[0].url, "/api/backend/command");

  const clerk = mockSnapshot({ revision: 2 });
  h.client.configureBackend(clerk);
  const count = h.publications.length;
  h.requests[0].resolve(response(200, mockSnapshot({ memberId: ownerId, revision: 3, costCents: 12500 })));
  await rejected;

  assert.equal(h.client.backendSnapshot(), clerk);
  assert.equal(h.client.backendSnapshot().retail[0].costCents, null);
  assert.equal(h.publications.length, count);
  assert.deepEqual(h.redirects, []);
});

test("退出清空后，延迟的刷新响应不能恢复旧快照", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot());
  const pending = h.client.refreshBackend();
  assert.equal(h.requests[0].url, "/api/backend/state");

  h.client.clearBackend();
  const count = h.publications.length;
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 2 })));
  await pending;

  assert.equal(h.client.backendSnapshot(), null);
  assert.equal(h.publications.length, count);
  assert.deepEqual(h.redirects, []);
});

test("早发后到的低版本刷新不能覆盖已完成命令的新事实", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot({ revision: 5 }));
  const staleRefresh = h.client.refreshBackend();
  const command = h.client.backendCommand("synthetic.command", {}, randomUUID());
  const latest = mockSnapshot({ revision: 6 });
  latest.customers = [{ phone: "synthetic-phone", name: "Saved synthetic customer" }];

  await setImmediate();
  h.requests[1].resolve(response(200, latest));
  await command;
  const count = h.publications.length;
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 5 })));
  await staleRefresh;

  assert.equal(h.client.backendSnapshot(), latest);
  assert.equal(h.client.backendSnapshot().customers.length, 1);
  assert.equal(h.publications.length, count);
});

test("业务操作403会重新核对成员，但有效成员保持登录", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot({ revision: 7 }));
  const pending = h.client.backendCommand("synthetic.forbidden", {}, randomUUID());
  const rejected = assert.rejects(pending, /当前账号不能编辑采购成本/);
  await setImmediate();
  h.requests[0].resolve(response(403, { message: "当前账号不能编辑采购成本。" }));

  await setImmediate();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].url, "/api/backend/state");
  const refreshed = mockSnapshot({ revision: 8 });
  h.requests[1].resolve(response(200, refreshed));
  await rejected;

  assert.equal(h.client.backendSnapshot(), refreshed);
  assert.equal(h.client.backendSnapshot().staff.currentId, clerkId);
  assert.equal(h.client.isBackendClient(), true);
  assert.equal(h.publications.includes(null), false);
  assert.deepEqual(h.redirects, []);
});

test("高业务版本也不能重新发布较旧的成员权限版本", async () => {
  const h = harness();
  const current = mockSnapshot({ revision: 5, memberRevision: 3 });
  h.client.configureBackend(current);
  const pending = h.client.refreshBackend();
  const count = h.publications.length;
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 6, memberRevision: 2, costCents: 12000 })));
  await pending;

  assert.equal(h.client.backendSnapshot(), current);
  assert.equal(h.publications.length, count);
  assert.equal(h.client.backendSnapshot().retail[0].costCents, null);
});

test("业务403后若成员核对也403，才清空并进入待授权页面", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot());
  const pending = h.client.backendCommand("synthetic.forbidden", {}, randomUUID());
  const rejected = assert.rejects(pending, /操作已拒绝/);
  await setImmediate();
  h.requests[0].resolve(response(403, { message: "操作已拒绝。" }));

  await setImmediate();
  assert.equal(h.requests[1].url, "/api/backend/state");
  h.requests[1].resolve(response(403, { message: "成员已停用。" }));
  await rejected;

  assert.equal(h.client.backendSnapshot(), null);
  assert.deepEqual(h.redirects, ["/account/pending"]);
});


test("离线确认先持久化原意图，阻止用新ID重复创建",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());h.navigator.onLine=false;
 await assert.rejects(h.client.backendCommand("intake.save",{amount:123}),/离线/);
 assert.equal(h.requests.length,0);assert.equal(h.operations.size,1);
 const original=[...h.operations.values()][0];
 await assert.rejects(h.client.backendCommand("intake.save",{amount:456}),/待核对/);
 assert.equal([...h.operations.values()][0].command.requestId,original.command.requestId);
 assert.equal(original.command.memberId,clerkId);
});
test("响应丢失后查询未找到不能清除，重试沿用原始ID和内容",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());
 const payload={amount:123};const pending=h.client.backendCommand("synthetic.command",payload);
 const rejected=assert.rejects(pending,/连接中断/);await setImmediate();payload.amount=999;
 const body=h.requests[0].options.body;h.requests[0].reject(new TypeError("network"));await rejected;
 assert.equal(h.operations.size,1);assert.equal(h.requests.length,1);
 const check=h.client.recoverOperation("check");await setImmediate();h.requests[1].resolve(response(200,{status:"not_found"}));await check;assert.equal(h.operations.size,1);
 const retry=h.client.recoverOperation("retry");await setImmediate();h.requests[2].resolve(response(200,{status:"not_found"}));await setImmediate();
 assert.equal(h.requests[3].options.body,body);assert.equal(JSON.parse(body).payload.amount,123);
 h.requests[3].resolve(response(200,mockSnapshot({revision:2})));await retry;assert.equal(h.operations.size,0);
});
test("安全撤销只有服务端确认后才释放待处理记录",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());h.navigator.onLine=false;
 await assert.rejects(h.client.backendCommand("synthetic.command",{}));
 const cancel=h.client.recoverOperation("cancel");await setImmediate();assert.equal(h.operations.size,1);
 assert.equal(h.requests[0].options.method,"POST");h.requests[0].resolve(response(200,{status:"cancelled"}));await cancel;assert.equal(h.operations.size,0);
});
test("明确拒绝只在原设备登记清理成功后发布匹配requestId终态",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());const requestId=randomUUID();
 const operation=h.client.backendCommand("synthetic.command",{},requestId);const rejected=assert.rejects(operation,/Synthetic rejected/);
 await setImmediate();h.requests[0].resolve(response(400,{message:"Synthetic rejected"}));await rejected;
 assert.equal(h.operations.size,0);assert.equal(h.client.backendRecovery().pending,null);
 assert.equal(h.client.backendRecovery().resolution.requestId,requestId);assert.equal(h.client.backendRecovery().resolution.status,"rejected");
});
test("拒绝响应后设备清理失败保留原pending且不发布可解锁终态",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());const requestId=randomUUID();
 h.storage.forgetOperation=async()=>{throw new Error("Synthetic cleanup failure");};
 const operation=h.client.backendCommand("synthetic.command",{},requestId);const rejected=assert.rejects(operation,/提交结果待核对/);
 await setImmediate();h.requests[0].resolve(response(400,{message:"Synthetic rejected"}));await rejected;
 assert.equal(h.operations.size,1);assert.equal(h.client.backendRecovery().pending.command.requestId,requestId);
 assert.equal(h.client.backendRecovery().resolution,undefined);
});
test("明确撤销发布原requestId终态而清理失败继续保留原pending",async()=>{
 for(const cleanupFails of [false,true]){
  const h=harness();h.client.configureBackend(mockSnapshot());h.navigator.onLine=false;const requestId=randomUUID();
  await assert.rejects(h.client.backendCommand("synthetic.command",{},requestId));
  if(cleanupFails)h.storage.forgetOperation=async()=>{throw new Error("Synthetic cleanup failure");};
  const cancel=h.client.recoverOperation("cancel");await setImmediate();h.requests[0].resolve(response(200,{status:"cancelled"}));await cancel;
  assert.equal(h.operations.size,cleanupFails?1:0);
  if(cleanupFails){assert.equal(h.client.backendRecovery().pending.command.requestId,requestId);assert.equal(h.client.backendRecovery().resolution,undefined);}
  else{assert.equal(h.client.backendRecovery().pending,null);assert.equal(h.client.backendRecovery().resolution.requestId,requestId);assert.equal(h.client.backendRecovery().resolution.status,"cancelled");}
 }
});
test("局部恢复控件不能核对重试或撤销另一个requestId的设备登记",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());h.navigator.onLine=false;const requestId=randomUUID();
 await assert.rejects(h.client.backendCommand("synthetic.command",{},requestId));
 for(const action of ["check","retry","cancel"])await h.client.recoverOperation(action,randomUUID());
 assert.equal(h.requests.length,0);assert.equal(h.operations.size,1);assert.equal(h.client.backendRecovery().pending.command.requestId,requestId);
 assert.equal(h.client.backendRecovery().resolution,undefined);
});
test("刷新合并避免网络慢时定时查询无限堆积",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());
 const a=h.client.refreshBackend();const b=h.client.refreshBackend();assert.equal(a,b);assert.equal(h.requests.length,1);
 h.requests[0].resolve(response(200,mockSnapshot({revision:2})));await a;
});
test("同门店不同账号的刷新响应必须清空旧身份并重载",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());const pending=h.client.refreshBackend();
 h.requests[0].resolve(response(200,mockSnapshot({memberId:ownerId,revision:2,costCents:12000})));await pending;
 assert.equal(h.client.backendSnapshot(),null);assert.deepEqual(h.redirects,["reload"]);
});


test("请求超时释放等待但保留原意图，允许核对", async()=>{
 const h=harness({requestDeadline:10});h.client.configureBackend(mockSnapshot());
 await assert.rejects(h.client.backendCommand("synthetic.command",{}),/超时/);
 assert.equal(h.client.backendRecovery().busy,false);assert.equal(h.operations.size,1);
 const check=h.client.recoverOperation("check");await setImmediate();h.requests[1].resolve(response(200,{status:"not_found"}));await check;assert.equal(h.operations.size,1);
});
test("设备存储失败不发送命令，不假称已有恢复保护",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());h.storage.reserveOperation=async()=>{throw new Error("存储空间不足");};
 await assert.rejects(h.client.backendCommand("synthetic.command",{}),/存储空间不足/);assert.equal(h.requests.length,0);assert.equal(h.client.backendRecovery().busy,false);
});
test("格式无法序列化后不会永久锁住提交入口",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot());const invalid={};invalid.self=invalid;
 await assert.rejects(h.client.backendCommand("synthetic.command",invalid));
 const pending=h.client.backendCommand("synthetic.command",{});await setImmediate();assert.equal(h.requests.length,1);h.requests[0].resolve(response(200,mockSnapshot({revision:2})));await pending;
});
test("回执清理等待期间切换身份，旧结果不能污染新恢复状态",async()=>{
 const h=harness();h.client.configureBackend(mockSnapshot({memberId:ownerId}));let release;h.storage.forgetOperation=()=>new Promise(resolve=>release=resolve);
 const pending=h.client.backendCommand("synthetic.command",{});const rejected=assert.rejects(pending,/身份已变化/);await setImmediate();h.requests[0].resolve(response(200,mockSnapshot({memberId:ownerId,revision:2})));await setImmediate();assert.equal(typeof release,"function");h.client.configureBackend(mockSnapshot({memberId:clerkId,revision:3}));release();await rejected;await setImmediate();assert.equal(h.client.backendRecovery().pending,null);assert.equal(h.client.backendRecovery().receipt,undefined);
});

function pageSnapshot(kind = "repairs", options = {}) {
  const state = mockSnapshot(options);
  state.read = { formatVersion: 2, scope: { accountId: "synthetic-account", sessionId: options.sessionId ?? "synthetic-session", storeId, memberId: state.staff.currentId, memberRevision: state.staff.members[0].revision, permissions: state.staff.members[0].permissions, formatVersion: 2 }, plan: { kind }, ready: ["staff", "retail"] };
  return state;
}

test("v2读取绑定实际会话和页面，旧页面高版本迟到不能覆盖新页或阻塞新页请求", async () => {
  const h = harness(), initial = pageSnapshot(); h.client.configureBackend(initial);
  const old = h.client.refreshBackend();
  assert.match(h.requests[0].url, /^\/api\/backend\/v2\/page\?/);
  assert.equal(h.requests[0].options.headers["x-ct-store-id"], storeId);
  assert.match(h.requests[0].options.headers["x-ct-read-scope"], /synthetic-session/);
  const next = pageSnapshot("retail"); h.client.reconcileBackendInitial(next);
  const current = h.client.refreshBackend(); assert.equal(h.requests.length, 2);
  h.requests[0].resolve(response(200, pageSnapshot("repairs", { revision: 999, costCents: 99999 })));
  await old; assert.equal(h.client.backendSnapshot(), next);
  const refreshed = pageSnapshot("retail", { revision: 2 }); h.requests[1].resolve(response(200, refreshed)); await current;
  assert.equal(h.client.backendSnapshot(), refreshed);
});

test("v2同成员新会话使旧会话读取失效，错误页面响应不能填入当前页", async () => {
  const h = harness(); h.client.configureBackend(pageSnapshot()); const old = h.client.refreshBackend();
  const next = pageSnapshot("retail", { sessionId: "new-session" }); h.client.configureBackend(next);
  h.requests[0].resolve(response(200, pageSnapshot("repairs", { revision: 999 }))); await old; assert.equal(h.client.backendSnapshot(), next);
  const current = h.client.refreshBackend(), rejected = assert.rejects(current, /核对结果无效/);
  h.requests[1].resolve(response(200, pageSnapshot("repairs", { sessionId: "new-session", revision: 2 }))); await rejected;
  assert.equal(h.client.backendSnapshot(), next);
});

test("v2旧命令兼容回执保留页面协议，后续刷新不恢复整店state轮询", async () => {
  const h = harness(),initial=pageSnapshot("retail");initial.customerListEnabled=true;initial.procurementListEnabled=true;h.client.configureBackend(initial);
  const pending = h.client.backendCommand("synthetic.command", {}); await setImmediate();
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 2 }))); await pending;
  assert.equal(h.client.backendSnapshot().read.plan.kind, "retail");
  assert.equal(h.client.backendSnapshot().customerListEnabled,true);assert.equal(h.client.backendSnapshot().procurementListEnabled,true);
  const refresh = h.client.refreshBackend(); assert.match(h.requests[1].url, /^\/api\/backend\/v2\/page\?/);
  h.requests[1].resolve(response(200, pageSnapshot("retail", { revision: 2 }))); await refresh;
});

test("v2权限作用域过期立即隔离资料，不能继续使用旧页面内容", async () => {
  const h = harness(); h.client.configureBackend(pageSnapshot()); const pending = h.client.refreshBackend(), rejected = assert.rejects(pending, /权限已变化/);
  h.requests[0].resolve(response(409, { code: "IDENTITY_CHANGED" })); await rejected;
  assert.equal(h.client.backendSnapshot(), null); assert.deepEqual(h.redirects, ["reload"]);
});

test("v2保存中导航不取消原请求或卡住busy，确认回执采用当前页协议", async () => {
  const h = harness(); h.client.configureBackend(pageSnapshot("repairs"));
  const pending = h.client.backendCommand("synthetic.command", {}); await setImmediate();
  const requestId = JSON.parse(h.requests[0].options.body).requestId;
  h.client.reconcileBackendInitial(pageSnapshot("retail"));
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 2 }))); await pending;
  assert.equal(h.client.backendSnapshot().read.plan.kind, "retail");
  assert.equal(h.client.backendRecovery().receipt.requestId, requestId);
  assert.equal(h.client.backendRecovery().pending, null); assert.equal(h.client.backendRecovery().busy, false);
});

test("v2自身成员版本更新不把确认提交错误改成未知结果", async () => {
  const h = harness(); h.client.configureBackend(pageSnapshot("retail"));
  const pending = h.client.backendCommand("staff.save", {}); await setImmediate();
  h.requests[0].resolve(response(200, mockSnapshot({ revision: 2, memberRevision: 2 }))); await pending;
  assert.equal(h.client.backendSnapshot().read.scope.memberRevision, 2);
  assert.equal(h.client.backendRecovery().pending, null); assert.equal(h.client.backendRecovery().busy, false);
  assert.ok(h.client.backendRecovery().receipt);
});

test("v2原请求跨导航核对仍能清理原登记并发布真实回执", async () => {
  const h = harness(); h.client.configureBackend(pageSnapshot("repairs"));h.navigator.onLine=false;
  await assert.rejects(h.client.backendCommand("synthetic.command", {}), /离线/);
  const original=h.client.backendRecovery().pending;
  h.client.reconcileBackendInitial(pageSnapshot("retail"));h.navigator.onLine=true;
  const check=h.client.recoverOperation("check");await setImmediate();
  const snapshot=mockSnapshot({revision:2});snapshot.operation={requestId:original.command.requestId,entityId:"synthetic-unit",kind:"synthetic.command",committedAt:"2026-10-02T00:00:00Z",replayed:true};
  h.requests[0].resolve(response(200,{status:"committed",snapshot}));await check;
  assert.equal(h.client.backendRecovery().pending,null);assert.equal(h.client.backendRecovery().busy,false);
  assert.equal(h.client.backendRecovery().receipt.requestId,original.command.requestId);assert.equal(h.client.backendSnapshot().read.plan.kind,"retail");
});
