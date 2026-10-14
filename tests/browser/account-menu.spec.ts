import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

// Display fixtures only. Real Auth/RLS/profile boundaries are verified by the
// isolated auth-status integration test; these responses grant no store access.
const fixture = { state: "workspace", scope: "synthetic-a", formal: true, account: { name: "Synthetic owner", email: "owner@example.test" }, store: { name: "Synthetic shop", role: "owner" } };
const menu = (page: Page) => page.locator("header details");
async function openFixture(page: Page) {
  await page.route("**/api/auth/status", route => route.fulfill({ json: fixture }));
  await page.goto("/");
  await expect(menu(page).locator("summary")).toHaveText(/Synthetic owner/);
}

test("named account disclosure shows own facts and settings/device links", async ({ page }) => {
  await openFixture(page);
  await expect(page.getByRole("button", { name: "退出登录", exact: true })).toHaveCount(0);
  await menu(page).locator("summary").click();
  const panel = page.getByRole("region", { name: "账号详情" });
  await expect(panel).toBeVisible(); await expect(panel.getByText(fixture.account.email, { exact: true })).toBeVisible();
  await expect(panel.getByText(fixture.store.name, { exact: true })).toBeVisible(); await expect(panel.getByText("老板", { exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: "账号设置", exact: true })).toHaveAttribute("href", "/account/settings");
  await expect(panel.getByRole("link", { name: "登录设备", exact: true })).toHaveAttribute("href", "/account/settings#login-devices");
  await expect(panel.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(panel).not.toBeVisible(); await expect(menu(page).locator("summary")).toBeFocused();
  await page.keyboard.press("Enter"); await expect(panel).toBeVisible();
  await page.getByText("电脑与手机皆可用", { exact: true }).click(); await expect(panel).not.toBeVisible();
  for (const path of ["/toolbox", "/toolbox/office", "/toolbox/windows", "/toolbox/transfer"]) {
    await page.goto(path);
    const compact = path === "/toolbox/office", summary = menu(page).locator("summary");
    await expect(summary).toHaveText(/Synthetic owner/);
    await expect(summary).toHaveAccessibleName("账号菜单 Synthetic owner");
    await expect(menu(page)).toHaveAttribute("data-compact", String(compact));
    const header = page.locator("header"), toolbox = header.getByRole("link", { name: "工具箱", exact: true });
    await expect(toolbox).toHaveText("工具箱"); await expect(toolbox).toHaveAttribute("href", "/toolbox");
    await expect(toolbox).toHaveAccessibleName("工具箱");
    if (compact && (page.viewportSize()?.width ?? 1440) < 768) await expect(toolbox.locator("span")).toBeHidden();
    else await expect(toolbox.locator("span")).toBeVisible();
    for (const target of [summary, toolbox]) {
      const box = await target.boundingBox(); expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const externalWorkspace = header.locator('nav > a[href="/app/dashboard"]');
    if (compact) {
      await expect(externalWorkspace).toHaveCount(0);
      await expect(menu(page).getByRole("link", { name: "工作台", exact: true, includeHidden: true })).toHaveAttribute("href", "/app/dashboard");
      await expect(menu(page).getByRole("link", { name: "工作台", exact: true, includeHidden: true })).toBeHidden();
    } else await expect(externalWorkspace).toBeVisible();
    await expect(page.getByRole("button", { name: "退出登录", exact: true })).toHaveCount(0);
    await summary.click();
    const routePanel = page.getByRole("region", { name: "账号详情" });
    await expect(routePanel).toBeVisible();
    await expect(routePanel.getByText(fixture.account.email, { exact: true })).toBeVisible();
    await expect(routePanel.getByText(fixture.store.name, { exact: true })).toBeVisible();
    await expect(routePanel.getByRole("link", { name: "账号设置", exact: true })).toHaveAttribute("href", "/account/settings");
    await expect(routePanel.getByRole("link", { name: "登录设备", exact: true })).toHaveAttribute("href", "/account/settings#login-devices");
    await expect(routePanel.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
    const workspace = compact ? routePanel.getByRole("link", { name: "工作台", exact: true }) : externalWorkspace;
    await expect(workspace).toHaveAttribute("href", "/app/dashboard"); await expect(workspace).toBeVisible();
    const workspaceBox = await workspace.boundingBox(); expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.width).toBeGreaterThanOrEqual(44); expect(workspaceBox!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape"); await expect(routePanel).not.toBeVisible(); await expect(summary).toBeFocused();
  }
  await page.locator("header").getByRole("link", { name: "工具箱", exact: true }).click(); await page.waitForURL("**/toolbox");
  await expect(page.locator("header").getByRole("link", { name: "工具箱", exact: true })).toHaveAttribute("aria-current", "page");
  await page.locator('header a[href="/"]').click(); await page.waitForURL(/\/$/);
});

test("full long account and email remain readable at four widths in three languages", async ({ page }) => {
  const longName = "Synthetic account with a very long name <img src=x onerror=alert(1)>";
  await page.route("**/api/auth/status", route => route.fulfill({ json: { ...fixture, account: { name: longName, email: "very.long.synthetic.account.with.no.shortcut@example.test" }, store: { name: "Synthetic shop with a long unbroken original reference ABCDEFGHIJKLMNOPQRSTUVWXYZ", role: "manager" } } }));
  await page.goto("/"); await expect(menu(page).locator("summary")).toHaveText(new RegExp("Synthetic account"));
  for (const locale of ["zh-CN", "it", "en"] as Locale[]) {
    await page.getByLabel("语言 / Lingua / Language").selectOption(locale, { force: true });
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      const toolbox = page.locator("header").getByRole("link", { name: translate("工具箱", locale), exact: true });
      const label = toolbox.locator("span"); await expect(label).toHaveText(translate("工具箱", locale));
      expect(await label.evaluate(element => getComputedStyle(element).clipPath)).toBe("none");
      const linkBox = await toolbox.boundingBox(), labelBox = await label.boundingBox();
      expect(linkBox!.height).toBeGreaterThanOrEqual(44); expect(labelBox!.width).toBeGreaterThan(20); expect(labelBox!.height).toBeGreaterThan(10);
      expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(width); expect(labelBox!.x).toBeGreaterThanOrEqual(linkBox!.x);
      const navBox = await page.getByRole("navigation", { name: translate("账户入口", locale) }).boundingBox();
      expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(linkBox!.x);
      await expect(page.getByRole("button", { name: translate("退出登录", locale), exact: true })).toHaveCount(0);
      await menu(page).locator("summary").click();
      const panel = page.getByRole("region", { name: translate("账号详情", locale) });
      await expect(panel.getByText(longName, { exact: true })).toBeVisible(); await expect(panel.locator("img")).toHaveCount(0);
      const box = await panel.boundingBox(); expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(panel.getByRole("link", { name: translate("账号设置", locale), exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("identity replacement closes details and discards a delayed previous account", async ({ page }) => {
  await openFixture(page); await menu(page).locator("summary").click();
  let calls = 0; let newer = false; let release: (() => void) | undefined; let releaseNew: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const newRead = new Promise<void>(resolve => { releaseNew = resolve; });
  await page.unroute("**/api/auth/status");
  await page.route("**/api/auth/status", async route => {
    calls++;
    if (!newer) { await delayed; await route.fulfill({ json: fixture }).catch(() => {}); }
    else { await newRead; await route.fulfill({ json: { ...fixture, scope: "synthetic-b", account: { name: "Synthetic replacement", email: "replacement@example.test" } } }); }
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect.poll(() => calls).toBeGreaterThanOrEqual(1);
  newer = true;
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); window.dispatchEvent(new Event("ct-auth-changed")); });
  await expect(menu(page)).toHaveCount(0); await expect(page.getByText("owner@example.test", { exact: true })).toHaveCount(0);
  release!();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  releaseNew!();
  await expect(menu(page).locator("summary")).toHaveText(/Synthetic replacement/); await expect(menu(page)).not.toHaveAttribute("open", "");
  release!(); await menu(page).locator("summary").click();
  await expect(page.getByText("owner@example.test", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "账号详情" }).getByText("replacement@example.test", { exact: true })).toBeVisible();
});

test("account-only state hides store facts; service failure clears private detail", async ({ page }) => {
  let unavailable = false; let publicState = "account";
  await page.route("**/api/auth/status", route => route.fulfill({ status: unavailable ? 503 : 200, json: unavailable ? { state: "unavailable", scope: null, formal: true, account: null, store: null } : { ...fixture, state: publicState, account: publicState === "unverified" ? null : fixture.account, store: null } }));
  await page.goto("/"); await expect(menu(page).locator("summary")).toHaveText(/Synthetic owner/); await menu(page).locator("summary").click();
  const panel = page.getByRole("region", { name: "账号详情" });
  await expect(panel.getByText("等待门店授权", { exact: true })).toBeVisible(); await expect(panel.getByText("Synthetic shop", { exact: true })).toHaveCount(0);
  publicState = "unverified"; await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator('header nav > a[href="/verify-email"]')).toBeVisible();
  for (const locale of ["zh-CN", "it", "en"] as Locale[]) {
    await page.getByLabel("语言 / Lingua / Language").selectOption(locale, { force: true });
    for (const width of [390, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const summaryBox = await menu(page).locator("summary").boundingBox();
      const actionBox = await page.locator('header nav > a[href="/verify-email"]').boundingBox();
      const toolBox = await page.locator("header").getByRole("link", { name: translate("工具箱", locale), exact: true }).boundingBox();
      expect(summaryBox!.width).toBeGreaterThanOrEqual(60); expect(summaryBox!.x + summaryBox!.width).toBeLessThanOrEqual(actionBox!.x);
      expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(toolBox!.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  unavailable = true; await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(menu(page)).toHaveCount(0); await expect(page.getByText("owner@example.test", { exact: true })).toHaveCount(0);
});
