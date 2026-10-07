import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const nav = (page: Page) => page.getByRole("navigation", { name: "账户入口" });
async function previewLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "填入演示账号" }).click();
  await page.locator(".auth-submit").click();
  await page.waitForURL("**/app/dashboard");
}

test("preview login, homepage SSR, toolbox and logout share navigation", async ({ page }) => {
  await page.goto("/"); await expect(nav(page).getByRole("link", { name: "登录", exact: true })).toBeVisible();
  await previewLogin(page); await page.goto("/");
  await expect(nav(page).getByRole("link", { name: "进入工作台", exact: true })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "注册", exact: true })).toHaveCount(0);
  await page.goto("/login"); await page.waitForURL("**/app/dashboard");
  await page.goto("/"); await page.goto("/toolbox");
  await nav(page).getByRole("button", { name: "退出本地预览", exact: true }).click();
  await page.waitForURL(/\/$/); await page.goBack();
  await expect(nav(page).getByRole("link", { name: "登录", exact: true })).toBeVisible();
});

test("persistent public layout cannot restore stale authenticated initial state", async ({ page }) => {
  await previewLogin(page); await page.goto("/toolbox");
  await expect(nav(page).getByRole("link", { name: "进入工作台", exact: true })).toBeVisible();
  let delay = false;
  await page.route("**/api/auth/status", async route => {
    if (delay) await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ json: { state: "anonymous", scope: null, formal: false } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(nav(page).getByRole("link", { name: "登录", exact: true })).toBeVisible();
  delay = true; await page.locator('a[href="/toolbox/office"]').first().click();
  await expect(nav(page).getByRole("link", { name: "进入工作台", exact: true })).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "登录", exact: true })).toBeVisible();
});

test("identity event discards delayed old projection; 503 stays distinct from logout", async ({ page }) => {
  await page.goto("/"); let calls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/status", async route => {
    calls++;
    if (calls === 1) { await pending; await route.fulfill({ json: { state: "workspace", scope: "old-a", formal: true } }).catch(() => {}); }
    else await route.fulfill({ json: { state: "account", scope: "new-b", formal: true } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("ct-auth-changed")));
  await expect(nav(page).getByRole("link", { name: "账号状态", exact: true })).toBeVisible();
  release!(); await expect(nav(page).getByRole("link", { name: "进入工作台", exact: true })).toHaveCount(0);
  await page.unroute("**/api/auth/status");
  await page.route("**/api/auth/status", route => route.fulfill({ status: 503, json: { state: "unavailable", scope: null, formal: true } }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(nav(page).getByText("账号状态暂不可用")).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "登录", exact: true })).toHaveCount(0);
});

test("expired hint needs explicit refresh without a background cookie refresh", async ({ page }) => {
  await previewLogin(page); await page.goto("/");
  await page.route("**/api/auth/status", route => route.fulfill({ status: 409, json: { code: "SESSION_REFRESH_REQUIRED" } }));
  const path = page.url();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(nav(page).getByText("账号状态暂不可用")).toBeVisible(); expect(page.url()).toBe(path);
  await page.unroute("**/api/auth/status");
  await nav(page).getByRole("button", { name: "重新检查", exact: true }).click();
  await expect(nav(page).getByRole("link", { name: "进入工作台", exact: true })).toBeVisible();
});
