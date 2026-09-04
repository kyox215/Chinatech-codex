import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = resolve(
  process.env.REPAIRDESK_I18N_EVIDENCE_DIR ?? "test-results/i18n-foundation",
);
const captureVisualEvidence = process.env.REPAIRDESK_CAPTURE_I18N_EVIDENCE === "1";
const workspaceEvidenceEnabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test("server render honors an exact locale cookie and rejects an invalid value", async ({
  page,
  context,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
  await expect(page.getByRole("heading", { name: "Accesso a RepairDesk" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  await hideNextDevIndicator(page);
  if (captureVisualEvidence) {
    await page.screenshot({
      path: resolve(evidenceDir, "italian-login-desktop-1440.png"),
      fullPage: true,
    });
  }
  expect(consoleErrors).toEqual([]);

  await context.addCookies([{ name: "repairdesk_locale", value: "en-US", url: baseURL }]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "RepairDesk 登录" })).toBeVisible();
});

test("fixed Italian customer routes do not replace the employee locale cookie", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);

  for (const path of ["/r", "/kiosk"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html"), path).toHaveAttribute("lang", "it-IT");
    if (path === "/r") await expect(page).toHaveTitle("Stato riparazione — RepairDesk");
    expect(
      (await context.cookies()).find((cookie) => cookie.name === "repairdesk_locale")?.value,
      path,
    ).toBe("en");
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Sign in to RepairDesk" })).toBeVisible();
  await expect(page).toHaveTitle("Sign in — RepairDesk");
});

test("language switching keeps form state, URL, document identity and persistence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByLabel("姓名").fill("Mario Rossi");
  await page.evaluate(() => {
    Object.assign(window, { __repairDeskLocaleIdentity: "same-document" });
  });
  const initialURL = page.url();

  const trigger = page.locator('[data-language-switcher-trigger="true"]');
  await expect(trigger).toHaveAttribute("aria-label", "选择界面语言");
  await expect(trigger).toHaveCSS("height", "44px");
  await trigger.click();

  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(3);
  await expect(page.getByRole("menuitemradio", { name: "中文" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Sign in to RepairDesk" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Register" })).toHaveAttribute("data-state", "active");
  await expect(page.getByLabel("Name")).toHaveValue("Mario Rossi");
  expect(page.url()).toBe(initialURL);
  expect(await page.evaluate(() => Reflect.get(window, "__repairDeskLocaleIdentity"))).toBe(
    "same-document",
  );
  expect(
    (await page.context().cookies()).find((cookie) => cookie.name === "repairdesk_locale")?.value,
  ).toBe("en");

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  await hideNextDevIndicator(page);
  if (captureVisualEvidence) {
    await page.screenshot({
      path: resolve(evidenceDir, "english-register-mobile-390.png"),
      fullPage: true,
    });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Sign in to RepairDesk" })).toBeVisible();
});

test("keyboard switching restores focus and preserves scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const trigger = page.locator('[data-language-switcher-trigger="true"]');
  await expect(trigger).toHaveAttribute("aria-label", "选择界面语言");
  await waitForReactEventHandlers(trigger);
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "中文" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.dataset.localeScrollFixture = "true";
    spacer.style.height = "1800px";
    document.body.append(spacer);
    window.scrollTo(0, 500);
  });
  const initialScrollY = await page.evaluate(() => window.scrollY);

  await trigger.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Italiano" })).toBeFocused();
  await page.keyboard.press("Space");

  await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);

  await trigger.press("Enter");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitemradio", { name: "English" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);

  await page.evaluate(() => {
    const outsideTarget = document.createElement("input");
    outsideTarget.type = "text";
    outsideTarget.setAttribute("aria-label", "Outside focus target");
    outsideTarget.dataset.localeOutsideFocusTarget = "true";
    Object.assign(outsideTarget.style, {
      position: "fixed",
      inset: "16px auto auto 16px",
      zIndex: "100",
    });
    document.body.append(outsideTarget);
  });
  const outsideTarget = page.locator('[data-locale-outside-focus-target="true"]');
  await trigger.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "English" })).toBeVisible();
  await outsideTarget.click();
  await expect(outsideTarget).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
});

test("Italian and English layouts stay within a desktop viewport", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const locale of ["it-IT", "en"] as const) {
    await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dimensions.scrollWidth, locale).toBeLessThanOrEqual(dimensions.innerWidth);
  }
});

test("auth confirmation copy switches in place without navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/confirm", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "邀请链接无效" })).toBeVisible();
  await expect(page).toHaveTitle("确认安全邀请 — RepairDesk");

  await page.evaluate(() => {
    Object.assign(window, { __repairDeskConfirmIdentity: "same-document" });
  });
  const initialURL = page.url();
  await page.getByRole("button", { name: "选择界面语言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Invalid invitation link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  await expect(page).toHaveTitle("Confirm secure invitation — RepairDesk");
  expect(page.url()).toBe(initialURL);
  expect(await page.evaluate(() => Reflect.get(window, "__repairDeskConfirmIdentity"))).toBe(
    "same-document",
  );
});

test.describe("localized employee workspace evidence", () => {
  test.skip(!workspaceEvidenceEnabled, "Enable the controlled RepairDesk mock workspace.");

  test("Italian desktop Orders shell", async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await context.addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
    await page.goto("/orders", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
    await waitForAppBarStoreLink(page);
    await expect(page.getByRole("heading", { name: "Ordini di riparazione" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Clienti/ })).toBeVisible();
    await hideNextDevIndicator(page);
    if (captureVisualEvidence) {
      await page.screenshot({
        path: resolve(evidenceDir, "italian-orders-shell-desktop-1440.png"),
      });
    }
  });

  test("English mobile Orders navigation drawer", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
    await page.goto("/orders", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await waitForAppBarStoreLink(page);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /Repair orders/ })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /Customers/ })).toBeVisible();
    await page.waitForTimeout(350);
    expect((await drawer.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(250);
    await hideNextDevIndicator(page);
    if (captureVisualEvidence) {
      await page.screenshot({
        path: resolve(evidenceDir, "english-orders-sidebar-mobile-390.png"),
      });
    }
  });

  test("offline copy switches in place with the employee shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/offline", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "当前离线" })).toBeVisible();

    await page.getByRole("button", { name: "选择界面语言" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  });
});

async function hideNextDevIndicator(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("nextjs-portal").forEach((portal) => {
      portal.style.display = "none";
    });
  });
}

async function waitForAppBarStoreLink(page: Page) {
  await expect(
    page
      .locator('[data-app-bar="true"]')
      .getByRole("link", { name: "Demo Repair Store", includeHidden: true }),
  ).toHaveAttribute("href", "/settings", { timeout: 20_000 });
}

async function waitForReactEventHandlers(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { message: "language switcher should be hydrated before keyboard interaction" },
    )
    .toBe(true);
}
