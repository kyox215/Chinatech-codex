import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260724-005-a5-order-print";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for print/Safari checks.");

// Superseded by fixed-PDF coverage below; this preserves the former CSS-print contract for history.
test.skip("legacy print media isolates the customer document and the task page reuses it", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const testWindow = window as Window & { __repairDeskPrintCalls?: number };
    testWindow.__repairDeskPrintCalls = 0;
    window.print = () => {
      testWindow.__repairDeskPrintCalls = (testWindow.__repairDeskPrintCalls ?? 0) + 1;
    };
  });
  let issueFails = false;
  await page.route("**/api/repairdesk/customer-status-links/issue", async (route) => {
    if (issueFails) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "固定二维码暂时无法准备" } }),
      });
      return;
    }
    const body = route.request().postDataJSON() as { order_ids?: string[] };
    const orderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store" },
      body: JSON.stringify({
        links: orderIds.map((orderId, index) => ({
          order_id: orderId,
          url: `https://www.chinatech.in/r#${String(index + 1).padStart(43, "A")}`,
          expires_at: "2027-12-31T23:59:59.000Z",
        })),
      }),
    });
  });

  await gotoReady(page, "/orders");
  await ensureOutputIdentityReady(page);
  await gotoReady(page, "/orders");

  const rowCheckboxes = page.locator('[data-order-row="true"] [role="checkbox"]');
  const preselected = page.locator(
    '[data-order-row="true"] [role="checkbox"][data-state="checked"]',
  );
  while ((await preselected.count()) > 0) await preselected.first().click();
  await rowCheckboxes.nth(0).click();
  await expect(page.getByText(/已选\s+2\s+条/)).toBeVisible();
  await page.getByRole("button", { name: "打印", exact: true }).last().click();
  await page.getByRole("button", { name: "A5 横向打印" }).click();
  await expect(page.locator("body > .repair-print-sheet .repair-print-page")).toHaveCount(2);
  await expect(
    page.locator('body > .repair-print-sheet [data-customer-status-qr="true"]'),
  ).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  if (browserName === "chromium") {
    const batchPdf = await page.pdf({
      path: `${evidenceDir}/repair-order-batch-two-smart-qr.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(readPdfPageCount(batchPdf)).toBe(2);
  }
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("body > .repair-print-sheet")).toHaveCount(0);

  const row = page.locator('[data-order-row="true"]').first();
  await expect(row).toBeVisible();
  await row.click();
  const detail = page.getByRole("dialog", { name: "工单详情" });
  await expect(detail).toBeVisible();
  const printSheet = page.locator("body > .repair-print-sheet");
  await expect(printSheet).toHaveCount(0);
  await detail.getByRole("button", { name: "打印", exact: true }).click();
  await page.getByRole("button", { name: "A5 横向打印" }).click();
  await expect(printSheet).toHaveCount(1);
  await expect(printSheet.locator('[data-customer-status-qr="true"]')).toHaveCount(1);
  await expect(printSheet).not.toContainText("SCAN TASK");
  await expect(printSheet).not.toContainText("Link scheda");

  await page.emulateMedia({ media: "print" });
  const printState = await page.evaluate(() => {
    const display = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element ? window.getComputedStyle(element).display : "missing";
    };
    const pageElement = document.querySelector<HTMLElement>(".repair-print-page");
    return {
      shell: display("#repairdesk-styled-shell"),
      fallback: display("#repairdesk-style-fallback"),
      sheet: display(".repair-print-sheet"),
      pageOverflow: pageElement ? window.getComputedStyle(pageElement).overflow : "missing",
      customerStatusQrCount: document.querySelectorAll(".repair-print-status-qr").length,
    };
  });
  expect(printState).toEqual({
    shell: "none",
    fallback: "none",
    sheet: "block",
    pageOverflow: "hidden",
    customerStatusQrCount: 1,
  });

  await page.screenshot({
    path: `${evidenceDir}/print-media-${browserName}-1440.png`,
    fullPage: true,
  });

  if (browserName === "chromium") {
    const pdf = await page.pdf({
      path: `${evidenceDir}/repair-order-standard-smart-qr.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(readPdfPageCount(pdf)).toBe(1);

    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(printSheet).toHaveCount(0);
    const beforeA4PrintCount = await printCallCount(page);
    await detail.getByRole("button", { name: "打印", exact: true }).click();
    await page.getByRole("button", { name: "A4 对半裁切" }).click();
    await expect(printSheet.locator('[data-customer-status-qr="true"]')).toHaveCount(1);
    await expect.poll(() => printCallCount(page)).toBe(beforeA4PrintCount + 1);
    await page.emulateMedia({ media: "print" });

    const a4HalfPdf = await page.pdf({
      path: `${evidenceDir}/repair-order-a4-half-cut.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(readPdfPageCount(a4HalfPdf)).toBe(1);
  }

  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  const more = row.getByRole("button", { name: "更多工单操作" });
  await more.click();
  const directHref = await page.getByRole("menuitem", { name: "在新页打开" }).getAttribute("href");
  expect(directHref).toMatch(/^\/orders\/[^/]+$/);
  await gotoReady(page, `${directHref}/task`);
  const taskRoot = page.locator('[data-order-task-root="true"]');
  await expect(taskRoot).toBeVisible();
  await expect(page.locator("body > .repair-print-sheet")).toHaveCount(0);
  const printButton = page.getByRole("button", { name: "打印客户工单" });
  await expect(printButton).toBeEnabled();
  const beforeTaskPrintCount = await printCallCount(page);
  await printButton.click();
  await page.getByRole("button", { name: "A5 横向打印" }).click();
  await expect(
    page.locator('body > .repair-print-sheet [data-customer-status-qr="true"]'),
  ).toHaveCount(1);
  await expect.poll(() => printCallCount(page)).toBe(beforeTaskPrintCount + 1);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#repairdesk-styled-shell")).toHaveCSS("display", "none");
  await expect(page.locator(".repair-print-sheet")).toHaveCSS("display", "block");
  expect(await taskRoot.evaluate((element) => element.getClientRects().length)).toBe(0);

  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  const beforeFailedPreparation = await printCallCount(page);
  issueFails = true;
  await printButton.click();
  await page.getByRole("button", { name: "A5 横向打印" }).click();
  await expect(page.getByText("固定二维码暂时无法准备")).toBeVisible();
  await expect(page.locator("body > .repair-print-sheet")).toHaveCount(0);
  expect(await printCallCount(page)).toBe(beforeFailedPreparation);
});

test("fixed PDF prints all four modes from the current page without a visible popup", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      if (object instanceof Blob && object.type === "application/pdf") {
        (window as Window & { __repairDeskPdfBlob?: Blob }).__repairDeskPdfBlob = object;
      }
      return originalCreateObjectURL(object);
    };
    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function <T extends Node>(node: T): T {
      const result = originalAppendChild.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.dataset.repairdeskPdfPrint === "true") {
        const printWindow = node.contentWindow;
        if (printWindow) {
          Object.defineProperty(printWindow, "focus", {
            configurable: true,
            value: () => undefined,
          });
          Object.defineProperty(printWindow, "print", {
            configurable: true,
            value: () => printWindow.dispatchEvent(new Event("afterprint")),
          });
          queueMicrotask(() => node.dispatchEvent(new Event("load")));
        }
      }
      return result;
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/repairdesk/customer-status-links/issue", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const body = route.request().postDataJSON() as { order_ids?: string[] };
    const orderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        links: orderIds.map((orderId, index) => ({
          order_id: orderId,
          url: `https://www.chinatech.in/r#${String(index + 1).padStart(43, "P")}`,
          expires_at: "2027-12-31T23:59:59.000Z",
        })),
      }),
    });
  });

  await gotoReady(page, "/orders");
  await ensureOutputIdentityReady(page);
  await gotoReady(page, "/orders");

  const row = page.locator('[data-order-row="true"]').first();
  await row.click();
  const detail = page.getByRole("dialog", { name: "工单详情" });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "打印", exact: true }).click();

  const modes = [
    { button: "A5 横向", width: 595.2756, height: 419.5276 },
    { button: "A4 横向铺满", width: 841.8898, height: 595.2756 },
    { button: "A4 上半裁切", width: 595.2756, height: 841.8898 },
    { button: "A4 双联", width: 595.2756, height: 841.8898 },
  ] as const;
  let popupCount = 0;
  page.on("popup", () => {
    popupCount += 1;
  });

  for (const [index, mode] of modes.entries()) {
    if (index > 0) {
      await expect(page.getByText("打印预览已打开")).toBeHidden({ timeout: 5_000 });
      await detail.getByRole("button", { name: "打印", exact: true }).click();
    }
    await page.getByRole("button", { name: mode.button }).click();
    if (index === 0) {
      await expect(page.getByText("正在准备订单二维码…")).toBeVisible();
      await page.screenshot({
        path: "screenshots/TASK-20260724-007-in-page-pdf-print/current-page-progress.png",
        fullPage: true,
      });
    }
    await expect(page.getByText("打印预览已打开")).toBeVisible({ timeout: 30_000 });
    expect(popupCount).toBe(0);
    const bytes = await page.evaluate(async () => {
      const blob = (window as Window & { __repairDeskPdfBlob?: Blob }).__repairDeskPdfBlob;
      if (!blob) throw new Error("Fixed PDF blob missing");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const document = await PDFDocument.load(Uint8Array.from(bytes));
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getWidth()).toBeCloseTo(mode.width, 3);
    expect(document.getPage(0).getHeight()).toBeCloseTo(mode.height, 3);
    if (index === 0) {
      const optimizedEvidenceDir = "screenshots/TASK-20260724-007-in-page-pdf-print";
      await mkdir(optimizedEvidenceDir, { recursive: true });
      await writeFile(`${optimizedEvidenceDir}/optimized-a5.pdf`, Uint8Array.from(bytes));
    }
  }
});

for (const mobileWidth of [390, 430] as const) {
  test(`mobile order detail uses the optimized current-page fixed PDF flow at ${mobileWidth}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: "Mozilla/5.0 (Linux; Android 15; Mobile)",
      });
      Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === "(pointer: coarse)"
          ? ({ matches: true, media: query } as MediaQueryList)
          : originalMatchMedia(query);
      const originalCreateObjectURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object) => {
        if (object instanceof Blob && object.type === "application/pdf") {
          (window as Window & { __repairDeskPdfBlob?: Blob }).__repairDeskPdfBlob = object;
        }
        return originalCreateObjectURL(object);
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: ({ files }: ShareData) => Boolean(files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          const testWindow = window as Window & { __repairDeskShareCalls?: number };
          testWindow.__repairDeskShareCalls = (testWindow.__repairDeskShareCalls ?? 0) + 1;
        },
      });
      window.addEventListener("repairdesk:fixed-pdf-ready", ((event: CustomEvent) => {
        const testWindow = window as Window & { __repairDeskPdfMetrics?: unknown[] };
        testWindow.__repairDeskPdfMetrics = [
          ...(testWindow.__repairDeskPdfMetrics ?? []),
          event.detail,
        ];
      }) as EventListener);
    });
    await page.setViewportSize({ width: mobileWidth, height: 844 });
    let qrIssueCount = 0;
    await page.route("**/api/repairdesk/customer-status-links/issue", async (route) => {
      qrIssueCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      const body = route.request().postDataJSON() as { order_ids?: string[] };
      const orderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          links: orderIds.map((orderId) => ({
            order_id: orderId,
            url: `https://www.chinatech.in/r#${"M".repeat(43)}`,
            expires_at: "2027-12-31T23:59:59.000Z",
          })),
        }),
      });
    });

    await gotoReady(page, "/orders");
    await ensureOutputIdentityReady(page);
    await gotoReady(page, "/orders");
    await page.locator('[data-order-mobile-list="true"] a[href^="/orders/"]').first().click();
    await expect(page).toHaveURL(/\/orders\/[^/?]+/);

    let popupCount = 0;
    page.on("popup", () => {
      popupCount += 1;
    });
    await page.getByRole("button", { name: "打印工单" }).click();
    await expect(page.getByRole("button", { name: "A5 横向" })).toBeVisible();
    await page.screenshot({
      path: `screenshots/TASK-20260724-007-in-page-pdf-print/mobile-print-options-${mobileWidth}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "A5 横向" }).click();
    await expect(page.getByText("正在准备订单二维码…")).toBeVisible();
    const readyDialog = page.locator('[data-fixed-pdf-ready-dialog="true"]');
    await expect(readyDialog).toBeVisible({ timeout: 30_000 });
    await expect(readyDialog.getByText("PDF 已准备好")).toBeVisible();
    await page.screenshot({
      path: `screenshots/TASK-20260724-008-mobile-print-performance/mobile-pdf-ready-${mobileWidth}.png`,
      fullPage: true,
    });

    expect(qrIssueCount).toBe(1);
    expect(popupCount).toBe(0);
    await expect(page.locator('[data-repairdesk-pdf-print="true"]')).toHaveCount(0);
    await readyDialog.getByRole("button", { name: "打印或分享 PDF" }).click();
    await expect(readyDialog).toBeHidden();
    expect(
      await page.evaluate(
        () => (window as Window & { __repairDeskShareCalls?: number }).__repairDeskShareCalls,
      ),
    ).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const bytes = await page.evaluate(async () => {
      const blob = (window as Window & { __repairDeskPdfBlob?: Blob }).__repairDeskPdfBlob;
      if (!blob) throw new Error("Fixed PDF blob missing");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const pdfDocument = await PDFDocument.load(Uint8Array.from(bytes));
    expect(pdfDocument.getPageCount()).toBe(1);
    expect(pdfDocument.getPage(0).getWidth()).toBeCloseTo(595.2756, 3);
    expect(pdfDocument.getPage(0).getHeight()).toBeCloseTo(419.5276, 3);

    await page.getByRole("button", { name: "打印工单" }).click();
    await page.getByRole("button", { name: "A5 横向" }).click();
    await expect(readyDialog).toBeVisible({ timeout: 10_000 });
    const metrics = await page.evaluate(
      () =>
        (
          window as Window & {
            __repairDeskPdfMetrics?: Array<{ cacheHit: boolean; endToEndReadyMs: number }>;
          }
        ).__repairDeskPdfMetrics ?? [],
    );
    expect(metrics).toHaveLength(2);
    expect(metrics[1]?.cacheHit).toBe(true);
    expect(metrics[1]?.endToEndReadyMs).toBeLessThan(2_000);
  });
}

test("public customer status keeps the fragment token out of URLs and app shell", async ({
  page,
  browserName,
}) => {
  const validToken = "S".repeat(43);
  const invalidToken = "X".repeat(43);
  const slowToken = "D".repeat(43);
  const fastToken = "F".repeat(43);
  const rateLimitedToken = "R".repeat(43);
  const requestUrls: string[] = [];
  const requestBodies: string[] = [];
  let staffResolveAuthenticated = false;
  await page.route("**/api/repairdesk/customer-status-links/staff-resolve", async (route) => {
    if (!staffResolveAuthenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "未登录或登录已过期" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ task_path: "/orders" }),
    });
  });
  await page.route("**/api/public/order-status", async (route) => {
    requestUrls.push(route.request().url());
    requestBodies.push(route.request().postData() ?? "");
    const body = route.request().postDataJSON() as { token?: string };
    if (body.token === rateLimitedToken) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store", "Retry-After": "45" },
        body: JSON.stringify({
          error: { code: "RATE_LIMITED", message: "Richieste troppo frequenti." },
        }),
      });
      return;
    }
    if (![validToken, slowToken, fastToken].includes(body.token ?? "")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
        body: JSON.stringify({
          error: {
            code: "LINK_UNAVAILABLE",
            message: "Questo link non è disponibile. Contatta il negozio per assistenza.",
          },
        }),
      });
      return;
    }
    if (body.token === slowToken) await new Promise((resolve) => setTimeout(resolve, 450));
    const isFast = body.token === fastToken;
    const isSlow = body.token === slowToken;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      body: JSON.stringify({
        status: {
          store: { name: "ZYG HOME Riparazioni", phone: "+39 0931 000000" },
          order: {
            public_no: isFast ? "R-FAST" : isSlow ? "R-SLOW" : "R2027001",
            device: "Apple iPhone",
            stage: "repair",
            stage_label: "Riparazione in corso",
            progress_percent: 72,
            last_updated_at: "2026-07-20T12:00:00.000Z",
            next_action: "Attendi il completamento della riparazione.",
          },
        },
      }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const publicPageResponse = await page.goto(`/r#${validToken}`, {
    waitUntil: "domcontentloaded",
  });
  const customerPageCacheControl = publicPageResponse?.headers()["cache-control"] ?? "";
  if (process.env.REPAIRDESK_E2E_PRODUCTION_BUILD === "1") {
    expect(customerPageCacheControl).toContain("no-store");
  } else {
    expect(customerPageCacheControl).toMatch(/no-store|no-cache/);
  }
  expect(publicPageResponse?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(publicPageResponse?.headers()["x-frame-options"]).toBe("DENY");
  await expect(page.getByText("Riparazione in corso")).toBeVisible();
  await expect(page.getByText("R2027001")).toBeVisible();
  await expect(page.getByText("ZYG HOME Riparazioni")).toHaveCount(2);
  await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "搜索工单、客户、库存…" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
  expect(requestUrls.every((url) => !url.includes(validToken))).toBe(true);
  expect(requestBodies.some((body) => body.includes(validToken))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `${evidenceDir}/public-status-success-${browserName}-390.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `${evidenceDir}/public-status-success-${browserName}-1440.png`,
    fullPage: true,
  });

  staffResolveAuthenticated = true;
  await page.goto(`/r#${validToken}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/orders$/);

  staffResolveAuthenticated = false;
  await page.goto(`/r#${validToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("R2027001")).toBeVisible();
  await page.evaluate((slow) => {
    window.location.hash = slow;
  }, slowToken);
  await expect(page.getByText("Caricamento dello stato…")).toBeVisible();
  await page.evaluate((fast) => {
    window.location.hash = fast;
  }, fastToken);
  await expect(page.getByText("R-FAST")).toBeVisible();
  await page.waitForTimeout(550);
  await expect(page.getByText("R-SLOW")).toHaveCount(0);

  await page.goto(`/r#${rateLimitedToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Connessione non disponibile")).toBeVisible();
  await expect(page.getByText("Riprova tra circa 45 secondi.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidenceDir}/public-status-rate-limited-${browserName}-390.png`,
    fullPage: true,
  });

  await page.goto(`/r#${invalidToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Link non disponibile")).toBeVisible();
  expect(requestUrls.every((url) => !url.includes(invalidToken))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidenceDir}/public-status-unavailable-${browserName}-390.png`,
    fullPage: true,
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`dashboard intake dialog releases Safari click interception at ${viewport.width}px`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await gotoReady(page, "/");

    await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();
    const firstDialog = page.locator('[data-new-order-dialog="true"]');
    await expect(firstDialog).toBeVisible();
    await firstDialog.getByPlaceholder("例如 iPhone 13").fill("Safari retry test");
    await firstDialog.getByRole("button", { name: "关闭新建维修工单" }).click();
    await expect(firstDialog).toHaveCount(0);

    const immediateState = await page.evaluate(() => {
      const intake = Array.from(
        document.querySelectorAll<HTMLElement>('[data-dashboard-quick-start="new-order"]'),
      ).find((element) => element.getClientRects().length > 0);
      if (!intake) throw new Error("Visible quick intake link is missing");
      const rect = intake.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const hit = document.elementFromPoint(center.x, center.y);
      return {
        center,
        guardCount: document.querySelectorAll('[data-navigation-guard-dialog="true"]').length,
        bodyPointerEvents: document.body.style.pointerEvents,
        hitTarget: Boolean(hit?.closest('[data-dashboard-quick-start="new-order"]')),
      };
    });
    expect(immediateState.guardCount).toBe(0);
    expect(immediateState.bodyPointerEvents).not.toBe("none");
    expect(immediateState.hitTarget).toBe(true);

    await page.mouse.click(immediateState.center.x, immediateState.center.y);
    const secondDialog = page.locator('[data-new-order-dialog="true"]');
    await expect(secondDialog).toBeVisible();
    await expect(secondDialog.getByPlaceholder("例如 iPhone 13")).toHaveValue("");
    await expect(secondDialog.locator('[data-new-order-root="true"]')).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/second-intake-${browserName}-${viewport.width}.png`,
      fullPage: false,
    });
  });
}

test("order-list intake dialog reopens with a fresh empty session", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, "/orders");

  const openButton = page.locator('[data-order-list-new-button="true"]');
  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "新建维修工单" });
  await expect(dialog).toBeVisible();
  const model = dialog.getByPlaceholder("例如 iPhone 13");
  await model.fill("Session should reset");
  await dialog.getByRole("button", { name: "关闭新建维修工单" }).click();
  await expect(dialog).toHaveCount(0);

  await openButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("例如 iPhone 13")).toHaveValue("");
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
}

async function printCallCount(page: Page) {
  return page.evaluate(
    () => (window as Window & { __repairDeskPrintCalls?: number }).__repairDeskPrintCalls ?? 0,
  );
}

function readPdfPageCount(pdf: Buffer) {
  const source = pdf.toString("latin1");
  const counts = [...source.matchAll(/\/Type\s*\/Pages[\s\S]{0,160}?\/Count\s+(\d+)/g)].map(
    (match) => Number(match[1]),
  );
  return counts.length ? Math.max(...counts) : 0;
}

async function ensureOutputIdentityReady(page: Page) {
  await page.evaluate(async () => {
    const readData = async (response: Response) => {
      const payload = (await response.json()) as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || `Mock settings request failed (${response.status})`);
      }
      return payload.data;
    };

    let settings = await readData(await fetch("/api/repairdesk/settings/store"));
    const ready =
      settings.store_address === "Via Test 1, Floridia" &&
      settings.store_phone === "+39000000000" &&
      settings.message_signature === "RepairDesk E2E · Assistenza" &&
      settings.print_footer === "Grazie per aver scelto RepairDesk E2E.";
    if (ready) return;

    settings = await readData(
      await fetch("/api/repairdesk/settings/store/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "store",
          expectedStoreId: settings.store_id,
          expectedUpdatedAt: settings.updated_at,
          input: {
            store_name: "RepairDesk E2E",
            store_address: "Via Test 1, Floridia",
            store_phone: "+39000000000",
            store_whatsapp: "+39000000000",
            store_email: "e2e@repairdesk.local",
          },
        }),
      }),
    );
    await readData(
      await fetch("/api/repairdesk/settings/store/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "notifications",
          expectedStoreId: settings.store_id,
          expectedUpdatedAt: settings.updated_at,
          input: {
            message_signature: "RepairDesk E2E · Assistenza",
            print_footer: "Grazie per aver scelto RepairDesk E2E.",
          },
        }),
      }),
    );
  });
}
