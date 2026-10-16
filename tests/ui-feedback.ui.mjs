import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, webkit } from "playwright";

async function stableNavigationBox(link) {
  return link.evaluate(element => new Promise((resolve, reject) => {
    const started = performance.now();
    let frame, previous, previousAnimations = [], stable = 0, closed = false;
    const finish = (error, box) => {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(frame); clearTimeout(timer);
      if (error) reject(error); else resolve(box);
    };
    const timer = setTimeout(() => finish(new Error("Navigation motion did not settle within 2 seconds")), 2000);
    const sample = () => {
      if (closed) return;
      try {
        if (!element.isConnected) throw new Error("Navigation control detached during motion measurement");
        if (performance.now() - started >= 2000) throw new Error("Navigation motion did not settle within 2 seconds");
        const animations = element.getAnimations({ subtree: false }).filter(animation => animation.effect?.target === element && (animation instanceof CSSAnimation || animation instanceof CSSTransition));
        if (animations.some(animation => !Number.isFinite(animation.effect.getComputedTiming().endTime))) throw new Error("Navigation control has non-finite motion");
        const changed = animations.length !== previousAnimations.length || animations.some(animation => !previousAnimations.includes(animation));
        const moving = animations.some(animation => animation.pending || !["finished", "idle"].includes(animation.playState));
        const rect = element.getBoundingClientRect();
        const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        const same = previous && Object.keys(box).every(key => box[key] === previous[key]);
        stable = !moving && !changed ? same ? stable + 1 : 1 : 0;
        previous = box; previousAnimations = animations;
        if (stable >= 2) { finish(null, box); return; }
        frame = requestAnimationFrame(sample);
      } catch (error) { finish(error); }
    };
    frame = requestAnimationFrame(sample);
  }));
}

mkdirSync(".local/ui-feedback/previews", { recursive: true });
const runId = crypto.randomUUID();
const child = spawn(process.execPath, ["scripts/preview-ui-design.mjs"], { env: { ...process.env, UI_FEEDBACK_TEST: "1", UI_FEEDBACK_RUN: runId }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", data => { log += data; }); child.stderr.on("data", data => { log += data; });
const results = [];
process.on("exit", () => { child.kill("SIGTERM"); writeFileSync(".local/ui-feedback/component-server.log", log); });
try {
  let origin;
  for (let i = 0; i < 180; i++) {
    if (child.exitCode !== null) throw new Error(log.slice(-5000));
    if (existsSync(".local/ui-feedback-test-preview/server.json")) {
      const config = JSON.parse(readFileSync(".local/ui-feedback-test-preview/server.json", "utf8"));
      try { if (config.runId === runId && (await fetch(`${config.url}feedback-test`)).ok) { origin = config.url; break; } } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(origin, log.slice(-5000));
  for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage({ viewport: { width: engine === "webkit" ? 375 : 1440, height: 900 }, hasTouch: engine === "webkit" });
      const errors = [], requests = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.method() + " " + request.url()); });
      await page.goto(`${origin}feedback-test`);
      const toast = page.locator("[data-toast]");
      await page.locator("#notify").click();
      await toast.waitFor(); assert.equal(await toast.count(), 1); assert.equal(await page.locator("#local-owner [data-toast]").count(), 1);
      const appeared = Date.now(); await toast.waitFor({ state: "detached", timeout: 2400 }); const elapsed = Date.now() - appeared;
      assert.ok(elapsed >= 1400 && elapsed < 2200, `real toast duration ${elapsed}ms`);
      await page.locator("#remount").click(); await page.locator("#remount").click(); await page.waitForTimeout(120); assert.equal(await toast.count(), 0);
      await page.locator("#notify").click(); await toast.waitFor(); await toast.getByRole("button").click(); assert.equal(await toast.count(), 0);
      await page.locator("#hidden-notify").click(); await toast.waitFor(); assert.equal(await page.locator("#local-owner [data-toast]").count(), 0); await toast.waitFor({ state: "detached", timeout: 2400 });
      await page.locator("#hide").click(); await page.waitForTimeout(120); assert.equal(await toast.count(), 0);
      await page.locator("#notify").click(); await toast.waitFor(); await page.waitForTimeout(1050); await page.locator("#notify").click(); await page.waitForTimeout(950); assert.equal(await toast.count(), 1); await toast.waitFor({ state: "detached", timeout: 1400 });
      await page.locator("#notify").click(); await toast.waitFor(); await page.waitForTimeout(400); await page.locator("#global-only").click(); await page.getByRole("status").filter({hasText:"DEMO newer global saved"}).waitFor(); assert.equal(await toast.count(), 1); await toast.waitFor({ state: "detached", timeout: 2400 });
      await page.locator("#toggle-global").click(); await page.locator("#notify").click(); await toast.waitFor(); const firstAppearance = Date.now(); await page.waitForTimeout(800); await page.locator("#hide").click(); assert.equal(await toast.count(), 0); await page.waitForTimeout(250); await page.locator("#hide").click(); await toast.waitFor(); await toast.waitFor({ state: "detached", timeout: 1000 }); assert.ok(Date.now() - firstAppearance < 2100, "same event keeps its first deadline without a global owner"); await page.locator("#toggle-global").click();
      const before = await Promise.all(["#icon-button", "#text-button"].map(selector => page.locator(selector).boundingBox()));
      await page.locator("#busy").click(); await page.locator('[data-content-progress][data-active="true"]').waitFor();
      const after = await Promise.all(["#icon-button", "#text-button"].map(selector => page.locator(selector).boundingBox())); assert.deepEqual(after, before);
      assert.equal(await page.locator("#icon-button").evaluate(e => getComputedStyle(e, "::before").content), "none");
      assert.equal(await page.locator("#icon-button svg path").evaluateAll(nodes => nodes.every(e => getComputedStyle(e).visibility === "hidden")), true);
      await page.locator("#busy").click(); await page.locator('[data-content-progress][data-active="false"]').waitFor();
      await page.locator("#oauth").click(); assert.equal(await page.locator("#mail svg path").evaluateAll(nodes => nodes.every(e => getComputedStyle(e).visibility === "visible")), true); assert.equal(await page.locator("#mail").evaluate(e => getComputedStyle(e, "::before").content), "none"); await page.locator("#oauth").click();
      for (const id of ["nav-text", "nav-icon", "nav-grid"]) {
        if (!(await page.url()).endsWith("feedback-test")) await page.goto(`${origin}feedback-test`);
        let release; const gate = new Promise(resolve => { release = resolve; });
        await page.route("**/destination?*", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
        const link = page.locator(`#${id}`); await link.hover(); const box = await stableNavigationBox(link);
        try {
          await link.click(); await link.locator('.navigation-feedback[data-pending="true"]').waitFor(); assert.deepEqual(await stableNavigationBox(link), box);
          assert.equal(await page.locator("#retained-content").isVisible(), true); assert.equal(await link.evaluate(e => getComputedStyle(e).outlineStyle), "none");
          const geometry = await link.locator(".navigation-feedback").evaluate(e => { const a = e.getBoundingClientRect(), b = e.parentElement.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom; }); assert.equal(geometry, true);
        } finally { release(); await page.unrouteAll({ behavior: "wait" }); }
        await page.waitForURL("**/destination"); await page.unrouteAll({ behavior: "wait" });
      }
      for (const locale of ["zh-CN", "it", "en"]) for (const width of [375, 390, 1024, 1440]) {
        await page.goto(origin); await page.getByLabel("语言 / Lingua / Language").selectOption(locale, { force: true }); await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (locale === "zh-CN" && [375, 1440].includes(width)) await page.screenshot({ path: `.local/ui-feedback/previews/catalog-${engine}-${width}.png`, fullPage: true });
      }
      assert.deepEqual(requests, []); assert.deepEqual(errors, []); results.push({ engine, toastElapsedMs: elapsed, checks: ["one visible local/global toast", "1.8s real timer", "dismiss", "no replay", "hidden owner fallback", "old timer isolation", "new global replaces older local", "same-ID first deadline without global owner", "stable busy slots", "OAuth one active control", "text/icon/grid navigation", "3 locales x4 widths", "0 API requests", "0 page errors"] });
    } finally { await browser.close(); }
  }
  writeFileSync(".local/ui-feedback/component-results.json", JSON.stringify({ results, source: "Actual shared React components and CSS; isolated DEMO harness, no business writes" }, null, 2));
  console.log("UI feedback component checks passed in Chromium and WebKit.");
} finally { child.kill("SIGTERM"); }
