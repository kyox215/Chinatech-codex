import { expect, test, type Page } from "@playwright/test";

import { translateMessage } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (!enabled) {
  throw new Error("Release 2B-1 i18n checks require REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const cases = (["zh-CN", "it-IT", "en"] as const).flatMap((locale) =>
  [390, 430, 768, 1024, 1280, 1440].map((width) => ({ locale, width })),
);

const heavyCustomer = {
  customer: {
    id: "customer-dynamic-heavy",
    name: "动态中文客户",
    phone_e164: "+393330009999",
    phone_raw: "3330009999",
    contact_phones: [],
    consent_marketing: false,
    consent_sms: false,
  },
  exactMatch: true,
  phoneMatchKind: "exact_primary",
  nameMatchKind: "exact",
  historyDevices: [],
};

test.describe.configure({ retries: 0 });

for (const { locale, width } of cases) {
  test(`${locale} ${width}px localizes new-order and task employee surfaces`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const forbiddenRequests: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      if (!isAllowedReadRequest(request.method(), request.url())) {
        forbiddenRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await setLocale(page, locale);
    await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(
      translateMessage(locale, "orders2b1.new.title"),
    );
    await expect(page.locator("body")).not.toContainText("SERVER_SECRET_ERROR");
    await expect(
      page.getByRole("button", {
        name: translateMessage(locale, "orders2b1.new.create"),
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (shouldCaptureEvidence(locale, width)) {
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${width}-orders-new.png`) });
    }
    await page.goto("/orders?workspace=new-order&source=i18n-release-2b1", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    const newOrderDialog = page.locator('[data-new-order-dialog="true"]');
    await expect(newOrderDialog).toBeVisible();
    await expect(
      page.getByRole("dialog", {
        name: translateMessage(locale, "orders2b1.new.title"),
      }),
    ).toHaveAccessibleDescription(translateMessage(locale, "orders2b1.new.dialogDescription"));
    await expect(newOrderDialog.locator('[data-new-order-root="true"]')).toBeVisible();
    await expect(newOrderDialog).toContainText(translateMessage(locale, "orders2b1.new.title"));
    const dialogClose = newOrderDialog.getByRole("button", {
      name: translateMessage(locale, "orders2b1.new.closeAria"),
    });
    if (width === 390 || width === 430 || width >= 1024) {
      await expect(dialogClose).toBeVisible();
    } else {
      await expect(dialogClose).toHaveCount(0);
      await expect(
        newOrderDialog.getByRole("button", {
          name: translateMessage(locale, "orders2b1.new.back"),
        }),
      ).toBeVisible();
    }
    const category = newOrderDialog
      .getByRole("button", { name: repairCategoryName(locale), exact: true })
      .first();
    await expect(category).toBeVisible();
    if (locale !== "zh-CN") {
      await expect(category).not.toContainText(/[\u4e00-\u9fff]/);
    }
    await expectNoHorizontalOverflow(page);
    await page.goto("/orders/ord_1/task", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator('[data-order-task-header="true"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(
      translateMessage(locale, "orders2b1.task.workspaceMode"),
    );
    await expect(page.locator("body")).not.toContainText("SERVER_SECRET_ERROR");
    await expectNoHorizontalOverflow(page);
    if (shouldCaptureEvidence(locale, width)) {
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${width}-order-task.png`) });
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(forbiddenRequests).toEqual([]);
  });
}

test.describe("fixed heavy localized order journeys", () => {
  test("zh-CN 390px proves validation focus, offline lookup, and safe Create failure", async ({
    page,
  }) => {
    await installSyntheticHttpStatusBridge(page);
    const evidence = installStrictRequestEvidence(page, ["/api/repairdesk/orders/create"]);
    const createBodies: Array<Record<string, unknown>> = [];
    await page.route(apiUrl("customers/intake-search"), (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(apiUrl("orders/create"), async (route) => {
      createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: { "x-repairdesk-test-status": "500" },
        json: { error: "SERVER_SECRET_HEAVY_CREATE" },
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await setLocale(page, "zh-CN");
    await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const form = page.locator('[data-new-order-form="true"]');
    const phone = form.getByRole("combobox", {
      name: translateMessage("zh-CN", "orders2b1.new.lookup.phoneAria"),
    });
    await form
      .getByRole("button", { name: translateMessage("zh-CN", "orders2b1.new.create") })
      .click({ force: true });
    await expect(page.locator("#new-order-validation-summary")).toContainText(
      translateMessage("zh-CN", "orders2b1.new.validation.customerPhone"),
    );
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(phone).toHaveAttribute("aria-describedby", /new-order-validation-summary/);
    await expect
      .poll(() => phone.evaluate((element) => document.activeElement === element))
      .toBe(true);

    await setBrowserOnlineState(page, false);
    await enterPhone(page, "zh-CN", "33300");
    await expect(
      form.getByText(translateMessage("zh-CN", "orders2b1.new.results.offline")),
    ).toBeVisible();
    await setBrowserOnlineState(page, true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await completeMinimumNewOrder(page, "zh-CN", "3457000201", "华为", "Mate 自定义");
    await form
      .getByRole("button", { name: translateMessage("zh-CN", "orders2b1.new.create") })
      .click();
    await expect(
      page.getByText(translateMessage("zh-CN", "orders2b1.new.error.generic")),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("SERVER_SECRET_HEAVY_CREATE");
    expect(createBodies).toHaveLength(1);
    expect(createBodies[0]).toMatchObject({
      order_type: "quick_repair",
      status: "new",
      customer_phone: "3457000201",
      customer_identity_resolution: { mode: "auto" },
      device_brand: "华为",
      device_model: "Mate 自定义",
      device_custody_status: "with_shop",
    });
    expect(typeof createBodies[0]?.operation_id).toBe("string");
    assertStrictRequestEvidence(evidence);
  });

  test("it-IT 768px preserves Create identity and operation id through conflict resolution", async ({
    page,
  }) => {
    await installSyntheticHttpStatusBridge(page);
    const evidence = installStrictRequestEvidence(page, ["/api/repairdesk/orders/create"]);
    const createBodies: Array<Record<string, unknown>> = [];
    const conflictToken = "00000000-0000-4000-8000-000000000921";
    await page.route(apiUrl("customers/intake-search"), (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(apiUrl("orders/create"), async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      if (createBodies.length === 1) {
        await route.fulfill({
          status: 200,
          headers: { "x-repairdesk-test-status": "409" },
          json: {
            error: "SERVER_SECRET_IDENTITY_CONFLICT",
            code: "CUSTOMER_IDENTITY_CONFLICT",
            details: {
              conflictToken,
              candidates: [
                { customerId: heavyCustomer.customer.id, displayName: heavyCustomer.customer.name },
              ],
            },
          },
        });
        return;
      }
      await route.fulfill({ json: { data: { id: "ord_1" } } });
    });

    await page.setViewportSize({ width: 768, height: 900 });
    await setLocale(page, "it-IT");
    await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    await completeMinimumNewOrder(page, "it-IT", "3457000202", "华为", "Mate 自定义");
    await page
      .getByRole("button", { name: translateMessage("it-IT", "orders2b1.new.create") })
      .click();
    await expect(
      page.getByRole("heading", { name: translateMessage("it-IT", "orders2b1.new.identityTitle") }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("SERVER_SECRET_IDENTITY_CONFLICT");
    await page
      .getByRole("button", {
        name: translateMessage("it-IT", "orders2b1.new.useExistingNamed", {
          name: heavyCustomer.customer.name,
        }),
      })
      .click();
    await expect(page).toHaveURL(/\/orders\/ord_1$/);

    expect(createBodies).toHaveLength(2);
    expect(createBodies[1]?.operation_id).toBe(createBodies[0]?.operation_id);
    expect(createBodies[0]).toMatchObject({
      customer_phone: "3457000202",
      device_brand: "华为",
      device_model: "Mate 自定义",
      customer_identity_resolution: { mode: "auto" },
    });
    expect(createBodies[1]).toEqual({
      ...createBodies[0],
      customer_identity_resolution: {
        mode: "use_existing",
        customer_id: heavyCustomer.customer.id,
        conflict_token: conflictToken,
      },
    });

    await page.route(apiUrl("order/get"), async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: {
          order: { finance_redacted?: boolean };
          capabilities?: Record<string, boolean>;
        };
      };
      payload.data.order.finance_redacted = true;
      payload.data.capabilities = Object.fromEntries(
        Object.keys(payload.data.capabilities ?? {}).map((key) => [key, false]),
      );
      await route.fulfill({ response, json: payload });
    });
    await page.goto("/orders/ord_1/task", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-order-task-header="true"]')).toBeVisible();
    await expect(
      page.getByText(translateMessage("it-IT", "orders2b1.task.financeRestricted")),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-order-task-transition-panel="true"]')
        .getByRole("button", { name: translateMessage("it-IT", "orders2b1.task.noNext") }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: translateMessage("it-IT", "orders2b1.task.diagnoseQuote") }),
    ).toHaveCount(0);
    assertStrictRequestEvidence(evidence);
  });

  test("en 1440px keeps a pending canonical Create stable through real language switches", async ({
    page,
  }) => {
    await installSyntheticHttpStatusBridge(page);
    const evidence = installStrictRequestEvidence(page, [
      "/api/repairdesk/orders/create",
      "/api/repairdesk/order/transition",
    ]);
    const createBodies: Array<Record<string, unknown>> = [];
    let releaseCreate!: () => void;
    const createReleased = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    let markCreateStarted!: () => void;
    const createStarted = new Promise<void>((resolve) => {
      markCreateStarted = resolve;
    });
    await page.route(apiUrl("customers/intake-search"), (route) =>
      route.fulfill({ json: { data: [heavyCustomer] } }),
    );
    await page.route(apiUrl("orders/create"), async (route) => {
      createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      markCreateStarted();
      await createReleased;
      await route.fulfill({ json: { data: { id: "ord_1" } } });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await setLocale(page, "en");
    await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    const form = page.locator('[data-new-order-form="true"]');
    await enterPhone(page, "en", heavyCustomer.customer.phone_raw);
    await form
      .getByRole("combobox", {
        name: translateMessage("en", "orders2b1.new.lookup.nameAria"),
      })
      .fill(heavyCustomer.customer.name);
    const customerOption = form.getByRole("option", {
      name: new RegExp(heavyCustomer.customer.name),
    });
    await expect(customerOption).toBeVisible();
    await customerOption.click();
    await expect(form).toContainText(heavyCustomer.customer.name);
    await completeMinimumDevice(form, "华为", "Mate 自定义");

    await form
      .getByRole("button", { name: translateMessage("en", "orders2b1.new.create") })
      .click();
    await createStarted;
    const pendingButton = form.getByRole("button", {
      name: translateMessage("en", "orders2b1.new.processing"),
    });
    await expect(pendingButton).toBeDisabled();
    await page.evaluate(() => {
      (window as Window & { __release2b1Marker?: string }).__release2b1Marker =
        "same-document-heavy";
      window.scrollTo(0, 20);
    });
    const startingUrl = page.url();
    const startingScroll = await page.evaluate(() => window.scrollY);

    await switchLanguage(page, "Italiano");
    await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
    await expect(page).toHaveURL(startingUrl);
    await expectPreservedHeavyDraft(page, "it-IT", startingScroll);
    await expect(
      form.getByRole("button", { name: translateMessage("it-IT", "orders2b1.new.processing") }),
    ).toBeDisabled();

    await switchLanguage(page, "English");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveURL(startingUrl);
    await expectPreservedHeavyDraft(page, "en", startingScroll);
    await expect(pendingButton).toBeDisabled();

    expect(createBodies).toHaveLength(1);
    expect(createBodies[0]).toMatchObject({
      customer_id: heavyCustomer.customer.id,
      customer_name: heavyCustomer.customer.name,
      customer_phone: heavyCustomer.customer.phone_e164,
      customer_identity_resolution: { mode: "auto" },
      device_brand: "华为",
      device_model: "Mate 自定义",
      device_custody_status: "with_shop",
    });
    expect(typeof createBodies[0]?.operation_id).toBe("string");
    releaseCreate();
    await expect(page).toHaveURL(/\/orders\/ord_1$/);

    const transitionBodies: Array<Record<string, unknown>> = [];
    let releaseTransition!: () => void;
    const transitionReleased = new Promise<void>((resolve) => {
      releaseTransition = resolve;
    });
    let markTransitionStarted!: () => void;
    const transitionStarted = new Promise<void>((resolve) => {
      markTransitionStarted = resolve;
    });
    await page.route(apiUrl("order/transition"), async (route) => {
      transitionBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (transitionBodies.length === 1) {
        markTransitionStarted();
        await transitionReleased;
        await route.fulfill({
          status: 200,
          headers: { "x-repairdesk-test-status": "500" },
          json: { error: "SERVER_SECRET_TRANSITION" },
        });
        return;
      }
      await route.fulfill({ json: { data: { ok: true } } });
    });
    await page.goto("/orders/ord_1/task", { waitUntil: "domcontentloaded" });
    const transitionPanel = page.locator('[data-order-task-transition-panel="true"]');
    const advance = transitionPanel.getByRole("button", { name: /^Advance to/ }).first();
    await expect(advance).toBeEnabled();
    await advance.click();
    const transitionDialog = page.locator('[data-order-task-transition-dialog="true"]');
    await expect(transitionDialog).toBeVisible();
    const confirmTransition = transitionDialog.getByRole("button", {
      name: translateMessage("en", "orders2b1.task.confirmTransition"),
    });
    await confirmTransition.click();
    await transitionStarted;
    await expect(
      transitionDialog.getByRole("button", {
        name: translateMessage("en", "orders2b1.task.transitioning"),
      }),
    ).toBeDisabled();
    releaseTransition();
    await expect(
      page.getByText(translateMessage("en", "orders2b1.task.actionFailed")),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("SERVER_SECRET_TRANSITION");
    await expect(confirmTransition).toBeEnabled();
    await confirmTransition.click();
    await expect(
      page.getByText(translateMessage("en", "orders2b1.task.transitionSuccess")),
    ).toBeVisible();
    await expect(transitionDialog).toBeHidden();
    expect(transitionBodies).toHaveLength(2);
    expect(transitionBodies[1]).toMatchObject({
      id: "ord_1",
      to: transitionBodies[0]?.to,
      reason: transitionBodies[0]?.reason,
      expected_updated_at: transitionBodies[0]?.expected_updated_at,
    });
    expect(typeof transitionBodies[0]?.idempotency_key).toBe("string");
    expect(typeof transitionBodies[1]?.idempotency_key).toBe("string");
    assertStrictRequestEvidence(evidence);
  });
});

function shouldCaptureEvidence(locale: AppLocale, width: number) {
  return locale === "it-IT" || width === 390 || width === 768 || width === 1440;
}

function repairCategoryName(locale: AppLocale) {
  if (locale === "zh-CN") return "屏幕";
  return "Display";
}

async function setLocale(page: Page, locale: AppLocale) {
  await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
}

function isAllowedReadRequest(method: string, requestUrl: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (method !== "POST") return false;
  const url = new URL(requestUrl, baseURL);
  if (url.pathname.startsWith("/__nextjs_")) return true;
  return [
    "/api/repairdesk/customers/intake-search",
    "/api/repairdesk/customers/list-page",
    "/api/repairdesk/inventory/summary",
    "/api/repairdesk/orders/list-page",
    "/api/repairdesk/orders/queue-summary",
    "/api/repairdesk/order/get",
  ].includes(url.pathname);
}

function apiUrl(path: string) {
  return new URL(`/api/repairdesk/${path}`, baseURL).toString();
}

function installStrictRequestEvidence(page: Page, allowedMutationPaths: string[]) {
  const evidence = {
    pageErrors: [] as string[],
    consoleErrors: [] as string[],
    forbiddenRequests: [] as string[],
  };
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url(), baseURL).pathname;
    if (
      !isAllowedReadRequest(request.method(), request.url()) &&
      !(request.method() === "POST" && allowedMutationPaths.includes(pathname))
    ) {
      evidence.forbiddenRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  return evidence;
}

function assertStrictRequestEvidence(evidence: ReturnType<typeof installStrictRequestEvidence>) {
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.forbiddenRequests).toEqual([]);
}

async function installSyntheticHttpStatusBridge(page: Page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const status = Number(response.headers.get("x-repairdesk-test-status"));
      if (!Number.isInteger(status) || status < 400) return response;
      return new Response(await response.blob(), {
        status,
        statusText: "Synthetic intercepted API failure",
        headers: response.headers,
      });
    };
  });
}

async function enterPhone(page: Page, locale: AppLocale, digits: string) {
  const field = page.getByRole("combobox", {
    name: translateMessage(locale, "orders2b1.new.lookup.phoneAria"),
  });
  if ((await field.evaluate((element) => element.tagName)) === "INPUT") {
    await field.fill(digits);
    return;
  }
  await field.click();
  for (const digit of digits) await page.keyboard.press(digit);
  await page.keyboard.press("Enter");
}

async function completeMinimumNewOrder(
  page: Page,
  locale: AppLocale,
  phone: string,
  brand: string,
  model: string,
) {
  await enterPhone(page, locale, phone);
  await completeMinimumDevice(page.locator('[data-new-order-form="true"]'), brand, model);
}

async function completeMinimumDevice(
  form: ReturnType<Page["locator"]>,
  brand: string,
  model: string,
) {
  await form.locator('[data-new-order-field="device-custody"] button').first().click();
  await form.locator("#new-order-device-brand").fill(brand);
  await form.locator("#new-order-device-model").fill(model);
}

async function setBrowserOnlineState(page: Page, online: boolean) {
  await page.evaluate((nextOnline) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => nextOnline });
    window.dispatchEvent(new Event(nextOnline ? "online" : "offline"));
  }, online);
}

async function switchLanguage(page: Page, languageName: string) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]:visible').first();
  await trigger.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  const option = page.getByRole("menuitemradio", { name: languageName });
  await expect(option).toBeVisible();
  await option.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect
    .poll(() => trigger.evaluate((element) => document.activeElement === element))
    .toBe(true);
}

async function expectPreservedHeavyDraft(page: Page, locale: AppLocale, expectedScroll: number) {
  const form = page.locator('[data-new-order-form="true"]');
  await expect(
    form.getByRole("combobox", {
      name: translateMessage(locale, "orders2b1.new.lookup.phoneAria"),
    }),
  ).toHaveValue(heavyCustomer.customer.phone_e164);
  await expect(
    form.getByRole("combobox", {
      name: translateMessage(locale, "orders2b1.new.lookup.nameAria"),
    }),
  ).toHaveValue(heavyCustomer.customer.name);
  await expect(form.locator("#new-order-device-brand")).toHaveValue("华为");
  await expect(form.locator("#new-order-device-model")).toHaveValue("Mate 自定义");
  await expect(form).toContainText(heavyCustomer.customer.name);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        marker: (window as Window & { __release2b1Marker?: string }).__release2b1Marker,
        scrollY: window.scrollY,
      })),
    )
    .toEqual({ marker: "same-document-heavy", scrollY: expectedScroll });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}
