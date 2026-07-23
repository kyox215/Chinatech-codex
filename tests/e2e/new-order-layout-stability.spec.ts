import { mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260718-001-new-order-layout-stability";
const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set a RepairDesk E2E bypass flag for new-order layout verification.");
test.describe.configure({ mode: "serial" });

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`keeps the quote workspace stable at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(screenshotDir, { recursive: true });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize(viewport);

    await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator('[data-new-order-form="true"]')).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);

    const workspace = page.locator('[data-new-order-workspace-grid="true"]');
    const customer = page.locator('[data-new-order-section="customer"]');
    const device = page.locator('[data-new-order-section="device-info"]');
    const quote = page.locator('[data-new-order-section="quotation"]');
    const unlock = page.locator('[data-new-order-section="device-unlock"]');
    const settings = page.locator('[data-new-order-section="settings"]');
    for (const locator of [workspace, customer, device, quote, unlock, settings]) {
      await expect(locator).toBeVisible();
    }
    await expect(page.locator('[data-new-order-section="fault-diagnosis"]')).toHaveCount(0);
    await expect(unlock.locator('[data-device-unlock-editor="true"]')).toBeVisible();
    await expect(quote.locator('[data-new-order-field="deposit"]')).toHaveCount(1);
    await expect(quote.getByText("报价暂停")).toHaveCount(0);

    await expectNoHorizontalOverflow(page, workspace);
    await expectDomAndVisualOrder(
      page,
      { customer, device, quote, unlock, settings },
      viewport.width,
    );

    await resetWorkspaceScroll(page);
    await page.screenshot({
      path: `${screenshotDir}/new-order-layout-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });

    expect(pageErrors, `page errors at ${viewport.width}px`).toEqual([]);
  });
}

async function resetWorkspaceScroll(page: Page) {
  await page.locator('[data-new-order-form="true"]').evaluate((form) => {
    let current: Element | null = form;
    while (current) {
      current.scrollTop = 0;
      current.scrollLeft = 0;
      current = current.parentElement;
    }
    window.scrollTo({ top: 0, left: 0 });
  });
}

async function expectDomAndVisualOrder(
  page: Page,
  sections: {
    customer: Locator;
    device: Locator;
    quote: Locator;
    unlock: Locator;
    settings: Locator;
  },
  width: number,
) {
  const domOrder = await page.locator('[data-new-order-form="true"]').evaluate((form) => {
    const names = ["quotation", "device-unlock"];
    return names.map((name) => {
      const target = form.querySelector<HTMLElement>(`[data-new-order-section="${name}"]`);
      if (!target) throw new Error(`Missing ${name}`);
      return [...form.querySelectorAll<HTMLElement>("[data-new-order-section]")].indexOf(target);
    });
  });
  expect(domOrder[0]).toBeLessThan(domOrder[1]);

  const customerRect = await rect(sections.customer);
  const deviceRect = await rect(sections.device);
  const quoteRect = await rect(sections.quote);
  const unlockRect = await rect(sections.unlock);
  const settingsRect = await rect(sections.settings);

  if (width >= 1024) {
    expect(quoteRect.x).toBeGreaterThan(customerRect.x);
    expect(unlockRect.x).toBeGreaterThan(quoteRect.x);
    expect(Math.abs(customerRect.y - quoteRect.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(customerRect.y - unlockRect.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(unlockRect.x - settingsRect.x)).toBeLessThanOrEqual(1);
    expect(settingsRect.y).toBeGreaterThanOrEqual(unlockRect.y + unlockRect.height);
    return;
  }

  if (width >= 768) {
    expect(quoteRect.x).toBeGreaterThan(customerRect.x);
    expect(Math.abs(customerRect.y - quoteRect.y)).toBeLessThanOrEqual(16);
    expect(Math.abs(customerRect.x - unlockRect.x)).toBeLessThanOrEqual(1);
    expect(unlockRect.y).toBeGreaterThanOrEqual(deviceRect.y + deviceRect.height);
    return;
  }

  expect(quoteRect.y).toBeGreaterThanOrEqual(deviceRect.y + deviceRect.height);
  expect(unlockRect.y).toBeGreaterThanOrEqual(quoteRect.y + quoteRect.height);
}

async function expectNoHorizontalOverflow(page: Page, workspace: Locator) {
  const dimensions = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

  const local = await workspace.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(local.scrollWidth).toBeLessThanOrEqual(local.clientWidth + 1);
}

async function rect(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const workspace = element.closest<HTMLElement>('[data-new-order-workspace-grid="true"]');
    const workspaceBox = workspace?.getBoundingClientRect();
    return {
      x: box.x - (workspaceBox?.x ?? 0),
      y: box.y - (workspaceBox?.y ?? 0),
      width: box.width,
      height: box.height,
    };
  });
}
