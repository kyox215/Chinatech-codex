import { test, expect } from "@playwright/test";
import { translate } from "../../lib/i18n/translate";

for (const locale of ["zh-CN", "it", "en"] as const) test(`navigation keeps old content, a single spinner and real progress until commit (${locale})`, async ({ page }) => {
  if (locale === "it") await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("语言 / Lingua / Language").selectOption(locale, { force: true });
  const originalHeading = page.locator("h1");
  const originalText = await originalHeading.textContent();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/toolbox?*", async route => {
    if (route.request().headers()["rsc"] !== "1") return route.continue();
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  const link = page.locator("header").getByRole("link", { name: translate("工具箱", locale), exact: true });
  const before = await link.boundingBox();
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(link.getByRole("status")).toHaveText(translate("正在打开页面…", locale));
  await expect(originalHeading).toHaveText(originalText!);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  const progress = page.locator("[data-content-progress]");
  expect((await progress.boundingBox())!.height).toBe(2);
  await expect(link.locator(".navigation-feedback svg.spin")).toHaveCount(1);
  expect(await link.locator(".navigation-feedback").evaluate(element => getComputedStyle(element).borderTopWidth)).toBe("0px");
  expect(await link.evaluate(element => getComputedStyle(element, "::before").content)).toBe("none");
  expect(await link.boundingBox()).toEqual(before);
  if (locale === "it") expect(await progress.locator("span").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  if (locale === "zh-CN") for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    expect((await progress.boundingBox())!.height).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/ui-proof/controls/navigation-pending-${test.info().project.name}-${width}.png` });
  }
  release();
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect(page.getByRole("heading", { name: translate("工具箱", locale), exact: true })).toBeVisible();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

for (const holdMs of [200, 2000, 5000]) test(`real RSC wait of ${holdMs}ms retains content and clears after commit`, async ({ page }) => {
  await page.goto("/");
  const original = await page.locator("h1").textContent();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/toolbox?*", async route => {
    if (route.request().headers()["rsc"] !== "1") return route.continue();
    const response = await route.fetch(); await gate; await route.fulfill({ response });
  });
  const link = page.locator("header").getByRole("link", { name: "工具箱", exact: true });
  await link.click();
  const waiting = async () => {
    await expect(page.locator("h1")).toHaveText(original!);
    await expect(page).toHaveURL(/\/$/);
    await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
    await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
    expect((await page.locator("[data-content-progress]").boundingBox())!.height).toBe(2);
    await expect(page.locator(".module-skeleton")).toHaveCount(0);
  };
  await waiting();
  // A controlled network hold, using real time and the actual Next RSC response.
  await new Promise(resolve => setTimeout(resolve, holdMs));
  await waiting(); release();
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect(page.getByRole("heading", { name: "工具箱", exact: true })).toBeVisible();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

test("an old navigation finishing cannot clear a newer pending route", async ({ page }) => {
  await page.goto("/");
  let releaseFirst!: () => void; let releaseSecond!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const second = new Promise<void>(resolve => { releaseSecond = resolve; });
  let firstFetched!: () => void;
  const ready = new Promise<void>(resolve => { firstFetched = resolve; });
  await page.route("**/toolbox?*", async route => { const response = await route.fetch(); firstFetched(); await first; await route.fulfill({ response }).catch(() => {}); });
  await page.route("**/login?*", async route => { const response = await route.fetch(); await second; await route.fulfill({ response }); });
  try {
  await page.locator("header").getByRole("link", { name: "工具箱", exact: true }).click();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
  await ready;
  const latest = page.locator("header").getByRole("link", { name: "登录", exact: true });
  await latest.click();
  await expect(latest.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
  releaseFirst();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  await expect(page).toHaveURL(/\/$/);
  releaseSecond();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  } finally {
    releaseFirst(); releaseSecond();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("repeated clicks on the same pending link retain one current navigation", async ({ page }) => {
  await page.goto("/");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fetched!: () => void;
  const ready = new Promise<void>(resolve => { fetched = resolve; });
  await page.route("**/toolbox?*", async route => { const response = await route.fetch(); fetched(); await gate; await route.fulfill({ response }).catch(() => {}); });
  try {
  const link = page.locator("header").getByRole("link", { name: "工具箱", exact: true });
  await link.click();
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await ready;
  await link.click();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  release();
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("mobile drawer keeps its pending link and closes only after commit; Escape and outside remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/dashboard");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/app/repairs?*", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  const menu = page.getByRole("button", { name: "打开菜单", exact: true });
  await menu.click();
  const sidebar = page.locator("#app-sidebar");
  const link = sidebar.getByRole("link", { name: "维修工单", exact: true });
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(sidebar).toHaveClass(/app-sidebar--open/);
  await expect(page.locator(".app-content .module-title__line h2")).toHaveText("工作台");
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await page.locator(".sidebar-scrim").click({ position: { x: 350, y: 400 } });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  release();
  await expect(page).toHaveURL(/\/app\/repairs$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

test("mobile Back and Forward close route-owned menus without reviving them after a late RSC", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/dashboard");
  await page.locator(".app-sidebar__collapse").click();
  await expect(page.locator(".app-shell")).toHaveClass(/app-shell--collapsed/);
  await page.locator("#app-sidebar").getByRole("link", { name: "维修工单", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/repairs$/);
  await page.setViewportSize({ width: 375, height: 812 });
  let release!: () => void; let fetched!: () => void; let delivered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { fetched = resolve; });
  const late = new Promise<void>(resolve => { delivered = resolve; });
  await page.route("**/app/catalog?*", async route => {
    if (route.request().headers()["rsc"] !== "1") return route.continue();
    const response = await route.fetch(); fetched(); await gate;
    await route.fulfill({ response }).catch(() => {}); delivered();
  });
  const menu = page.getByRole("button", { name: "打开菜单", exact: true });
  const sidebar = page.locator("#app-sidebar");
  const account = page.locator(".sidebar-account");
  await menu.click(); await account.locator("summary").click();
  const link = account.getByRole("link", { name: "设备目录", exact: true });
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(sidebar).toHaveClass(/app-sidebar--open/);
  await expect(account).toHaveAttribute("open", "");
  await ready;
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const closed = async () => {
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toHaveClass(/app-sidebar--open/);
    await expect(account).not.toHaveAttribute("open", "");
    await expect(page.locator(".sidebar-scrim")).toHaveCount(0);
    await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  };
  await closed();
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible();
  release(); await late;
  await expect(page).toHaveURL(/\/app\/dashboard$/); await closed();
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/repairs$/); await closed();
  await expect(page.getByRole("heading", { name: "维修工单", exact: true })).toBeVisible();
  await menu.click(); await account.locator("summary").click();
  await expect(account).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(account).not.toHaveAttribute("open", "");
  await expect(account.locator("summary")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false"); await expect(menu).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".app-shell")).toHaveClass(/app-shell--collapsed/);
});

test("account disclosure keeps the clicked link while pending and closes after a committed route", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/dashboard");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/app/catalog?*", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  const details = page.locator(".sidebar-account");
  await details.locator("summary").click();
  const link = details.getByRole("link", { name: "设备目录", exact: true });
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(details).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(details.locator("summary")).toBeFocused();
  await details.locator("summary").click();
  release();
  await expect(page).toHaveURL(/\/app\/catalog$/);
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

test("public account menu preserves pending feedback through Escape and outside dismissal", async ({ page }) => {
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.route("**/api/auth/status", route => route.fulfill({ json: { state: "workspace", scope: "synthetic-navigation", formal: true, account: { name: "Synthetic owner", email: "owner@example.test" }, store: { name: "Synthetic shop", role: "owner" } } }));
  await page.goto("/toolbox/office");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/app/dashboard?*", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  const details = page.locator("header details");
  await expect(details.locator("summary")).toHaveAccessibleName("账号菜单 Synthetic owner");
  await details.locator("summary").click();
  const link = details.getByRole("link", { name: "工作台", exact: true });
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(details).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(details.locator("summary")).toBeFocused();
  await details.locator("summary").click();
  await page.locator("header").first().click({ position: { x: 4, y: 4 } });
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  release();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

test("same-URL refresh follows real pending and retains the current content", async ({ page }) => {
  await page.goto("/");
  const original = await page.locator("h1").textContent();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/*", async route => {
    if (route.request().headers()["rsc"] !== "1" || new URL(route.request().url()).pathname !== "/") return route.continue();
    const response = await route.fetch(); await gate; await route.fulfill({ response });
  });
  try {
    const link = page.locator('header a[href="/"]');
    await link.press("Enter");
    await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
    await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(original!);
    expect((await page.locator("[data-content-progress]").boundingBox())!.height).toBe(2);
    release();
    await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "false");
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  } finally { release(); await page.unrouteAll({ behavior: "wait" }); }
});

test("hash navigation completes before a new-tab click and does not leave parent progress", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "观看使用教程", exact: true }).click();
  await expect(page).toHaveURL(/\/#tutorials$/);
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  const popupPromise = context.waitForEvent("page");
  await page.locator("header").getByRole("link", { name: "工具箱", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/toolbox$/);
  await expect(page).toHaveURL(/\/#tutorials$/);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
  await popup.close();
});

test("keyboard skip navigation focuses the real content after commit, including a cached return", async ({ page }) => {
  for (const path of ["/", "/toolbox", "/toolbox/office", "/toolbox/windows", "/toolbox/transfer"]) {
    await page.goto(path);
    for (let visit = 0; visit < 2; visit++) {
      const skip = page.getByRole("link", { name: "跳到主要内容", exact: true });
      await expect(skip).toHaveCSS("position", "fixed");
      if (visit === 0) expect((await skip.boundingBox())!.y).toBeLessThan(0);
      await skip.focus(); await skip.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();
      await expect(page).toHaveURL(/#main-content$/);
      await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
      if (visit === 0) { await page.goBack(); await expect(page).toHaveURL(new RegExp(path === "/" ? "/$" : `${path}$`)); }
    }
  }
});

test("hash navigation supersedes a held same-URL refresh and survives its late response", async ({ page }) => {
  await page.goto("/");
  const original = await page.locator("h1").textContent();
  let release!: () => void; let oldStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { oldStarted = resolve; });
  let holdOld = true;
  const late: Promise<void>[] = [];
  await page.route("**/*", async route => {
    if (route.request().headers()["rsc"] !== "1" || new URL(route.request().url()).pathname !== "/") return route.continue();
    const shouldHold = holdOld;
    const response = await route.fetch();
    if (!shouldHold) return route.fulfill({ response });
    oldStarted();
    const completion = gate.then(() => route.fulfill({ response }).catch(() => {}));
    late.push(completion); await completion;
  });
  try {
    await page.locator('header a[href="/"]').press("Enter");
    await started;
    await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
    holdOld = false;
    await page.getByRole("link", { name: "观看使用教程", exact: true }).click();
    await expect(page).toHaveURL(/\/#tutorials$/);
    await expect(page.locator("h1")).toHaveText(original!);
    await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
    release(); await Promise.all(late);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/#tutorials$/);
    await expect(page.locator("h1")).toHaveText(original!);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
  } finally { release(); await page.unrouteAll({ behavior: "wait" }); }
});

test("busy bridge excludes hidden and background controls and waits for every visible operation", async ({ page }) => {
  await page.goto("/");
  // Presentation fixtures exercise existing aria-busy semantics; no business write.
  await page.evaluate(() => {
    const fixture = document.createElement("div"); fixture.id = "feedback-fixture";
    fixture.innerHTML = '<button aria-busy="true" data-old hidden>old</button><div data-operation-feedback="background"><button aria-busy="true">background</button></div><form aria-busy="true" style="display:none"><button>hidden route</button></form>';
    document.body.append(fixture);
  });
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
  await page.evaluate(() => { const node = document.querySelector("[data-old]")!; node.removeAttribute("hidden"); });
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  await page.evaluate(() => { const button = document.createElement("button"); button.id = "feedback-new"; button.setAttribute("aria-busy", "true"); document.querySelector("#feedback-fixture")!.append(button); });
  await page.locator("[data-old]").evaluate(element => element.remove());
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  await page.locator("#feedback-new").evaluate(element => element.setAttribute("aria-busy", "false"));
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
  await page.locator("#feedback-fixture").evaluate(element => element.remove());
});

test("a failed RSC request clears feedback after Next recovers with a document navigation", async ({ page }) => {
  await page.goto("/");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/toolbox?*", async route => {
    if (route.request().headers()["rsc"] !== "1") return route.continue();
    await gate;
    await route.abort("failed");
  });
  await page.locator("header").getByRole("link", { name: "工具箱", exact: true }).click();
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
  release();
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect(page.getByRole("heading", { name: "工具箱", exact: true })).toBeVisible();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});

test("native downloads show only requested feedback and remain dismissible", async ({ page }) => {
  await page.goto("/toolbox/windows");
  const link = page.getByRole("link", { name: "下载检测启动器", exact: true });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.route(href!, route => route.fulfill({ body: "Synthetic browser download only", contentType: "application/octet-stream", headers: { "content-disposition": 'attachment; filename="synthetic.txt"' } }));
  await Promise.all([page.waitForEvent("download"), link.click()]);
  const notice = page.locator(".download-notice");
  await expect(notice.getByRole("status")).toHaveText("已发起下载，请查看浏览器的下载列表。");
  await expect(notice).not.toContainText("已完成");
  await notice.getByRole("button", { name: "关闭下载提示", exact: true }).click();
  await expect(notice).toHaveCount(0);
});
