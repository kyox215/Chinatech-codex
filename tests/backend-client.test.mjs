import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

// Compile the actual client into an isolated browser-like context for each test.
// Fetch never leaves this context; all members, amounts and responses are synthetic.
const source = readFileSync(new URL("../lib/backend/client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

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
    require:name=>{assert.equal(name,"./recovery-store");return storage;},
    AbortController,URLSearchParams,setTimeout:requestDeadline?((fn,ms)=>setTimeout(fn,ms===20000?requestDeadline:ms)):setTimeout,clearTimeout,navigator,
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
  client.subscribeBackend(() => publications.push(client.backendSnapshot()));
  return { client, requests, redirects, publications, operations, navigator, storage };
}

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
