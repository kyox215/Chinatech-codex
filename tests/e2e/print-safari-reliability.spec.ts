import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260720-002-print-safari-reliability-fixes";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for print/Safari checks.");

test("print media isolates the customer document and the task page reuses it", async ({
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

  await gotoReady(page, "/orders");
  await ensureOutputIdentityReady(page);
  await gotoReady(page, "/orders");

  const rowCheckboxes = page.locator('[data-order-row="true"] [role="checkbox"]');
  await rowCheckboxes.nth(0).click();
  await rowCheckboxes.nth(1).click();
  await expect(page.getByText(/已选\s+2\s+条/)).toBeVisible();
  await page.getByRole("button", { name: "打印", exact: true }).last().click();
  await expect(page.locator("body > .repair-print-sheet .repair-print-page")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  if (browserName === "chromium") {
    const batchPdf = await page.pdf({
      path: `${evidenceDir}/repair-order-batch-two.pdf`,
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
  await expect(printSheet).toHaveCount(1);
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
      taskQrCount: document.querySelectorAll(".repair-print-task-qr").length,
    };
  });
  expect(printState).toEqual({
    shell: "none",
    fallback: "none",
    sheet: "block",
    pageOverflow: "visible",
    taskQrCount: 0,
  });

  await page.screenshot({
    path: `${evidenceDir}/print-media-${browserName}-1440.png`,
    fullPage: true,
  });

  if (browserName === "chromium") {
    const pdf = await page.pdf({
      path: `${evidenceDir}/repair-order-standard.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(readPdfPageCount(pdf)).toBe(1);

    await page.evaluate(() => {
      const left = document.querySelector<HTMLElement>(".repair-print-left");
      if (!left) throw new Error("Printable order column is missing");
      const section = document.createElement("section");
      section.className = "repair-print-section";
      section.dataset.printLongContent = "true";
      section.innerHTML = Array.from(
        { length: 90 },
        (_, index) => `<p>Long printable diagnostic line ${index + 1}</p>`,
      ).join("");
      const sentinel = document.createElement("strong");
      sentinel.dataset.printLongContentSentinel = "true";
      sentinel.textContent = "END OF LONG PRINTABLE CONTENT";
      section.appendChild(sentinel);
      left.appendChild(section);
    });
    await expect(page.locator('[data-print-long-content-sentinel="true"]')).toHaveText(
      "END OF LONG PRINTABLE CONTENT",
    );
    const longPdf = await page.pdf({
      path: `${evidenceDir}/repair-order-long-content.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(readPdfPageCount(longPdf)).toBeGreaterThan(1);
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
  await expect(page.locator("body > .repair-print-sheet")).toHaveCount(1);
  const printButton = page.getByRole("button", { name: "打印客户工单" });
  await expect(printButton).toBeEnabled();
  await printButton.click();
  await expect.poll(() => printCallCount(page)).toBe(1);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#repairdesk-styled-shell")).toHaveCSS("display", "none");
  await expect(page.locator(".repair-print-sheet")).toHaveCSS("display", "block");
  expect(await taskRoot.evaluate((element) => element.getClientRects().length)).toBe(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`dirty back navigation releases Safari click interception at ${viewport.width}px`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await gotoReady(page, "/");

    await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();
    await expect(page).toHaveURL(/\/orders\/new\?.*intakeSession=/);
    const firstSession = new URL(page.url()).searchParams.get("intakeSession");
    await page.getByPlaceholder("例如 iPhone 13").fill("Safari retry test");

    await page.evaluate(() => window.history.back());
    const guard = page.getByRole("alertdialog");
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/$/);

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
    await expect(page).toHaveURL(/\/orders\/new\?.*intakeSession=/);
    expect(new URL(page.url()).searchParams.get("intakeSession")).not.toBe(firstSession);
    await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();
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
