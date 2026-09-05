import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const mockEnabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = resolve(
  process.env.REPAIRDESK_I18N_EVIDENCE_DIR ?? "test-results/i18n-public-states",
);

if (process.env.CI && !mockEnabled) {
  throw new Error("Public-state i18n CI requires REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

// Chinese public-state assertions use a fixed locale; dedicated tests cover first-visit detection.
test.use({ locale: "zh-CN" });

test("Kiosk owns only Italian public copy and bounded page headers", async ({ page, request }) => {
  const response = await page.goto("/kiosk", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
  await expect(page).toHaveTitle("Kiosk clienti — RepairDesk");
  await expect(page.getByRole("heading", { name: "Kiosk clienti" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collega iPad" })).toBeDisabled();
  expect(await page.locator("main").innerText()).not.toMatch(/[\p{Script=Han}]/u);
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["permissions-policy"]).toContain("camera=()");

  const validation = await request.post(`${baseURL}/api/kiosk/pair`, {
    data: { code: "123" },
  });
  expect(validation.status()).toBe(400);
  expect(await validation.json()).toEqual({ error: "Inserisci il codice di abbinamento" });
});

test("404 content follows the employee locale cookie", async ({ page, context }) => {
  const expectations = [
    ["zh-CN", "页面未找到"],
    ["it-IT", "Pagina non trovata"],
    ["en", "Page not found"],
  ] as const;

  for (const [locale, heading] of expectations) {
    await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
    await page.goto(`/missing-i18n-state-${locale}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("public auth errors persist as focused alerts without raw provider details", async ({
  page,
}) => {
  await page.goto("/login?auth_error=callback", { waitUntil: "domcontentloaded" });
  const loginAlert = page.locator("#auth-form-error");
  await expect(loginAlert).toContainText("登录链接已失效");
  await expect(loginAlert).toBeFocused();

  await page.goto("/forgot-password?auth_error=session", { waitUntil: "domcontentloaded" });
  const forgotAlert = page.locator("#forgot-password-error");
  await expect(forgotAlert).toContainText("请先从邮箱中的重置链接");
  await expect(forgotAlert).toBeFocused();

  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await page.getByLabel("新密码", { exact: true }).fill("12345678");
  await page.getByLabel("确认新密码").fill("87654321");
  await page.getByRole("button", { name: "更新密码" }).click();
  const resetAlert = page.locator("#reset-password-error");
  await expect(resetAlert).toContainText("两次输入的新密码不一致");
  await expect(resetAlert).toBeFocused();
});

test("registration completion exposes error and retry before success", async ({ page }) => {
  let failStatus = true;
  await page.route("**/api/repairdesk/onboarding/status", async (route) => {
    if (failStatus) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "RAW_PROVIDER_DETAIL" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/register/complete", { waitUntil: "domcontentloaded" });
  const alert = page.locator('main [role="alert"]');
  await expect(alert).toContainText("暂时无法读取账号状态");
  await expect(alert).not.toContainText("RAW_PROVIDER_DETAIL");
  await expect(alert).toBeFocused();
  await expect(page.getByRole("heading", { name: "注册已完成" })).toHaveCount(0);

  failStatus = false;
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("heading", { name: "注册已完成" })).toBeVisible();
});

test("public Kiosk, auth failure and 404 remain usable at all contracted widths", async ({
  page,
  context,
}, testInfo) => {
  const widths = [390, 430, 768, 1024, 1280, 1440] as const;

  await page.route("**/api/repairdesk/onboarding/status", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "RAW_PROVIDER_DETAIL" }),
    });
  });

  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });

    await page.goto("/kiosk", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Kiosk clienti" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (width === 390 || width === 768 || width === 1440) {
      await hideNextDevIndicator(page);
      await page.screenshot({
        path: resolve(evidenceDir, `${testInfo.project.name}-kiosk-${width}.png`),
        fullPage: true,
      });
    }

    await page.goto("/register/complete", { waitUntil: "domcontentloaded" });
    const authAlert = page.locator('main [role="alert"]');
    await expect(authAlert).toContainText("暂时无法读取账号状态");
    await expect(authAlert).not.toContainText("RAW_PROVIDER_DETAIL");
    await expectNoHorizontalOverflow(page);
    if (width === 390 || width === 768 || width === 1440) {
      await hideNextDevIndicator(page);
      await page.screenshot({
        path: resolve(evidenceDir, `${testInfo.project.name}-auth-error-${width}.png`),
        fullPage: true,
      });
    }

    await context.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
    await page.goto(`/missing-public-state-${width}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await hideNextDevIndicator(page);
    await page.screenshot({
      path: resolve(evidenceDir, `${testInfo.project.name}-public-states-${width}.png`),
      fullPage: true,
    });

    await context.clearCookies();
  }
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function hideNextDevIndicator(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-dialog],#__next-build-watcher{display:none!important}",
  });
}
