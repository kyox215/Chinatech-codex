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

function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function harness() {
  const requests = [];
  const redirects = [];
  const publications = [];
  const context = createContext({
    exports: {},
    crypto: { randomUUID },
    fetch: (url, options) => new Promise((resolve, reject) => {
      requests.push({ url, options, resolve, reject });
    }),
    window: { location: { assign: url => redirects.push(url), reload: () => redirects.push("reload") } },
  });
  runInContext(compiled, context, { filename: "lib/backend/client.ts" });
  const client = context.exports;
  client.subscribeBackend(() => publications.push(client.backendSnapshot()));
  return { client, requests, redirects, publications };
}

test("同店老板旧命令响应不能替换随后登录的员工身份或恢复成本", async () => {
  const h = harness();
  h.client.configureBackend(mockSnapshot({ memberId: ownerId, costCents: 12000 }));
  const pending = h.client.backendCommand("synthetic.command", {}, randomUUID());
  const rejected = assert.rejects(pending, /身份已变化/);
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
  h.requests[0].resolve(response(403, { message: "操作已拒绝。" }));

  await setImmediate();
  assert.equal(h.requests[1].url, "/api/backend/state");
  h.requests[1].resolve(response(403, { message: "成员已停用。" }));
  await rejected;

  assert.equal(h.client.backendSnapshot(), null);
  assert.deepEqual(h.redirects, ["/account/pending"]);
});
