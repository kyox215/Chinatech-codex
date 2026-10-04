import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { connect, type Socket } from "node:net";
import path from "node:path";

const oldWorker = readFileSync(path.join(process.cwd(), "tests/browser/fixtures/legacy-repairdesk-sw.js"), "utf8");
const oldOffline = readFileSync(path.join(process.cwd(), "tests/browser/fixtures/legacy-repairdesk-offline.html"), "utf8");
const seedPage = `<!doctype html><html><body><h1>Archived legacy shell fixture</h1><script>
navigator.serviceWorker.register('/sw.js').catch(() => {});
</script></body></html>`;

// Only archived public shell files and synthetic storage are used. This fixture
// shares an origin across the old/new phases so real browser SW updates apply.
async function fixture(upstream: string, navigationDelay = 0) {
  let phase: "legacy" | "fallback" | "new" = "legacy";
  let failedUpdates = false;
  let heldProbe = false;
  const requests: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    requests.push(url.pathname);
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/independent-sw.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`);
      return;
    }
    if (url.pathname === "/seed") {
      response.setHeader("Content-Type", "text/html");
      response.end(seedPage);
      return;
    }
    if (phase !== "new") {
      if (url.pathname === "/sw.js") {
        response.setHeader("Content-Type", "application/javascript");
        response.end(oldWorker);
      } else if (url.pathname === "/offline-fallback-v1.html") {
        response.setHeader("Content-Type", "text/html");
        response.end(oldOffline);
      } else if (url.pathname === "/recovery-probe.txt") {
        response.statusCode = 404;
        response.end("missing old recovery probe");
      } else if (phase === "fallback" && url.pathname === "/orders") {
        // The archived worker's unmodified 3 second deadline must win.
        const timeout = setTimeout(() => { if (!response.destroyed) response.end(seedPage); }, 5_000);
        response.on("close", () => clearTimeout(timeout));
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end(seedPage);
      }
      return;
    }
    if (failedUpdates && url.pathname === "/sw.js") {
      response.statusCode = 503;
      response.end("synthetic update outage");
      return;
    }
    if (heldProbe && url.pathname === "/recovery-probe.txt") {
      response.statusCode = 404;
      response.end("synthetic held probe");
      return;
    }
    if (url.pathname === "/orders" && navigationDelay) {
      await new Promise((resolve) => setTimeout(resolve, navigationDelay));
      if (response.destroyed) return;
    }
    try {
      const result = await fetch(new URL(`${url.pathname}${url.search}`, upstream), { redirect: "manual" });
      response.statusCode = result.status;
      result.headers.forEach((value, key) => {
        if (["content-length", "content-encoding", "transfer-encoding", "connection"].includes(key)) return;
        if (key === "location") {
          const destination = new URL(value, upstream);
          value = `${destination.pathname}${destination.search}${destination.hash}`;
        }
        response.setHeader(key, value);
      });
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      if (!response.destroyed) { response.statusCode = 502; response.end("fixture upstream unavailable"); }
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  // Keep Next's development hydration/HMR handshake available through the
  // fixture origin. In production there are no WebSocket requests here.
  server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/_next/")) { socket.destroy(); return; }
    const destination = new URL(upstream);
    const connection = connect(Number(destination.port), destination.hostname, () => {
      const headers = Object.entries(request.headers).map(([name, value]) => `${name}: ${name === "host" ? destination.host : value}`);
      connection.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`);
      if (head.length) connection.write(head);
    });
    connection.on("error", () => socket.destroy());
    socket.on("error", () => connection.destroy());
    socket.pipe(connection).pipe(socket);
    socket.on("close", () => connection.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    requests,
    setPhase: (next: typeof phase) => { phase = next; },
    failUpdates: (fail: boolean) => { failedUpdates = fail; },
    holdProbe: (hold: boolean) => { heldProbe = hold; },
    close: () => stopServer(server, sockets),
  };
}

async function stopServer(server: Server, sockets: Set<Socket>) {
  for (const socket of sockets) socket.destroy();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function seedStorage(page: Page) {
  await page.evaluate(async () => {
    localStorage.setItem("repairdesk-login-remember", "synthetic-remember");
    localStorage.setItem("chinatech-synthetic-draft", "unsaved-synthetic-input");
    sessionStorage.setItem("synthetic-current-view", "preserved");
    document.cookie = "synthetic-auth-session=preserved; SameSite=Lax; path=/";
    for (const key of ["chinatech-current-v1", "repairdesk-attachments", "independent-shell-v1"]) {
      await (await caches.open(key)).put("/synthetic-cache-entry", new Response("preserved"));
    }
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("repairdesk_offline", 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore("repairdesk_order_drafts");
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const transaction = db.transaction("repairdesk_order_drafts", "readwrite");
        transaction.objectStore("repairdesk_order_drafts").put("synthetic-draft-preserved", "synthetic-only");
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
}

async function preservedStorage(page: Page) {
  return page.evaluate(async () => ({
    local: localStorage.getItem("repairdesk-login-remember"),
    draft: localStorage.getItem("chinatech-synthetic-draft"),
    session: sessionStorage.getItem("synthetic-current-view"),
    cookie: document.cookie.includes("synthetic-auth-session=preserved"),
    caches: (await caches.keys()).sort(),
    idb: await new Promise<string | undefined>((resolve, reject) => {
      const opening = indexedDB.open("repairdesk_offline", 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const reading = db.transaction("repairdesk_order_drafts").objectStore("repairdesk_order_drafts").get("synthetic-only");
        reading.onsuccess = () => { db.close(); resolve(reading.result); };
        reading.onerror = () => reject(reading.error);
      };
    }),
  }));
}

async function installOld(page: Page, origin: string) {
  await page.goto(`${origin}/seed`);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toBe(`${origin}/sw.js`);
  await seedStorage(page);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain("repairdesk-shell-v5");
}

async function expectRetired(page: Page) {
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).filter((r) => new URL(r.scope).pathname === "/").length), { timeout: 15_000 }).toBe(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith("repairdesk-shell-"))), { timeout: 15_000 }).toEqual([]);
  const stored = await preservedStorage(page);
  expect(stored).toEqual({
    local: "synthetic-remember", draft: "unsaved-synthetic-input", session: "preserved", cookie: true,
    caches: ["chinatech-current-v1", "independent-shell-v1", "repairdesk-attachments"],
    idb: "synthetic-draft-preserved",
  });
}

for (const navigationDelay of [0, 4_500]) {
  test(`pure archived fallback recovers after cutover, navigation delay ${navigationDelay}ms`, async ({ page, baseURL }) => {
    test.setTimeout(45_000);
    const f = await fixture(baseURL!, navigationDelay);
    try {
      await installOld(page, f.origin);
      f.setPhase("fallback");
      const begin = Date.now();
      await page.goto(`${f.origin}/orders`);
      expect(Date.now() - begin).toBeGreaterThanOrEqual(2_800);
      await expect(page.locator("#repairdesk-style-status")).toContainText("RepairDesk");
      await expect.poll(() => f.requests.filter((item) => item === "/recovery-probe.txt").length).toBeGreaterThanOrEqual(2);
      expect(await page.evaluate(() => sessionStorage.getItem("repairdesk:style-recovery:reload-state-v2"))).toBeNull();
      // No new-site script is injected in this old cached document.
      f.setPhase("new");
      await expect(page).toHaveURL(`${f.origin}/login`, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "欢迎回来", exact: true })).toBeVisible();
      await expectRetired(page);
      await expect(page.locator("#repairdesk-style-fallback")).toHaveCount(0);
    } finally { await f.close(); }
  });
}

test("an in-flight old navigation still has its fallback while retirement activates", async ({ page, baseURL }) => {
  test.setTimeout(45_000);
  const f = await fixture(baseURL!, 4_500);
  const updater = await page.context().newPage();
  try {
    await installOld(page, f.origin);
    f.setPhase("fallback");
    await page.goto(`${f.origin}/orders`);
    await expect(page.locator("#repairdesk-style-status")).toBeVisible();
    await updater.goto(`${f.origin}/seed`);
    f.holdProbe(true);
    f.setPhase("new");
    // Model the browser's background update arriving while an older fetch
    // handler already owns a slow navigation. The cached document remains
    // byte-for-byte the archived page; no new cleanup is injected into it.
    const navigationCount = f.requests.filter((item) => item === "/orders").length;
    const navigation = page.goto(`${f.origin}/orders`);
    await expect.poll(() => f.requests.filter((item) => item === "/orders").length).toBeGreaterThan(navigationCount);
    await updater.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
    await navigation;
    f.holdProbe(false);
    await test.info().attach("concurrent-navigation-state", { contentType: "application/json", body: JSON.stringify(await page.evaluate(async () => ({ body: document.body.innerText.slice(0, 100), worker: navigator.serviceWorker.controller?.state, registrations: (await navigator.serviceWorker.getRegistrations()).length, caches: await caches.keys() }))) });
    await expect(page).toHaveURL(`${f.origin}/login`, { timeout: 20_000 });
    await expectRetired(page);
  } finally { await updater.close(); await f.close(); }
});

test("new page waits through update outage, retries online and preserves live input plus unrelated worker", async ({ page, baseURL }) => {
  test.setTimeout(45_000);
  const f = await fixture(baseURL!);
  try {
    await installOld(page, f.origin);
    await page.evaluate(async () => { await navigator.serviceWorker.register("/independent-sw.js", { scope: "/independent/" }); });
    f.setPhase("new");
    f.failUpdates(true);
    await page.goto(`${f.origin}/login`);
    await page.getByRole("button", { name: "显示密码", exact: true }).click();
    await expect(page.getByRole("button", { name: "隐藏密码", exact: true })).toBeVisible();
    const email = page.getByRole("textbox", { name: "电子邮件", exact: true });
    await email.fill("synthetic-input@example.invalid");
    await expect.poll(() => f.requests.filter((item) => item === "/sw.js").length).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(2);
    expect(await page.evaluate(() => caches.keys())).toContain("repairdesk-shell-v5");
    let navigations = 0;
    page.on("framenavigated", () => { navigations += 1; });
    f.failUpdates(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expectRetired(page);
    await expect(email).toHaveValue("synthetic-input@example.invalid");
    expect(navigations).toBe(0);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname))).toEqual(["/independent/"]);
  } finally { await f.close(); }
});

test("new device creates no worker and legacy entrypoints lead to the new login", async ({ page, baseURL, request }) => {
  const requests: string[] = [];
  page.on("request", (item) => requests.push(new URL(item.url()).pathname));
  await page.goto(`${baseURL}/login`);
  await expect(page.getByRole("heading", { name: "欢迎回来", exact: true })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  await page.screenshot({ path: `.local/ui-proof/legacy-cleanup/${test.info().project.name}-login.png` });
  await page.goto(`${baseURL}/register`);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(requests).not.toContain("/sw.js");
  for (const entry of ["/orders", "/offline", "/offline-fallback-v1.html"]) {
    const result = await request.get(`${baseURL}${entry}`, { maxRedirects: 0 });
    expect(result.status()).toBe(307);
    expect(new URL(result.headers().location).pathname).toBe("/login");
  }
  for (const entry of ["/manifest.webmanifest", "/inventory", "/customers"]) {
    expect((await request.get(`${baseURL}${entry}`, { maxRedirects: 0 })).status()).toBe(404);
  }
  const probe = await request.get(`${baseURL}/recovery-probe.txt`);
  expect(await probe.text()).toBe("repairdesk-recovery-v1");
  expect(probe.headers()["cache-control"]).toContain("no-store");
  const sw = await request.get(`${baseURL}/sw.js`);
  expect(sw.headers()["content-type"]).toContain("application/javascript");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(sw.headers()["clear-site-data"]).toBeUndefined();
});
