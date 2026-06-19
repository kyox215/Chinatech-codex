import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const desktopViewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const businessRoutes = [
  { path: "/orders", marker: /R2026|工单|订单/i },
  { path: "/orders/new", marker: /客户信息|故障诊断|报价与服务/i },
  { path: "/customers", marker: /客户|Customer/i },
  { path: "/buyback", marker: /回收|I001|报价/i },
  { path: "/inventory", marker: /库存|I001|商品/i },
  { path: "/messages", marker: /消息模板|报价审批|WhatsApp/i },
  { path: "/settings", marker: /设置|成员权限|店铺/i },
  { path: "/platform", marker: /平台审批|待审核|申请/i },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for strict business desktop checks.");

test.describe("business desktop overflow guard", () => {
  for (const viewport of desktopViewports) {
    test(`business routes render without page overflow at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      for (const route of businessRoutes) {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
        await expect(page.getByRole("heading", { name: "RepairDesk 登录" })).toHaveCount(0);
        await expect(page.locator('[data-sidebar="sidebar"]').first()).toBeVisible();
        await expectFirstVisible(
          page.locator("main").last().getByText(route.marker),
          `${route.path} page marker`,
        );
        if (route.path === "/orders") {
          if (viewport.width >= 1024) {
            await expectFirstVisible(
              page.locator("main").last().getByText("工单工作队列"),
              "/orders desktop work queue",
            );
          } else {
            await expectFirstVisible(
              page.locator('[data-order-mobile-list="true"]'),
              "/orders compact desktop card list",
            );
          }
        }
        if (route.path === "/buyback") {
          await expectFirstVisible(
            page.locator("main").last().locator("table").first(),
            "/buyback desktop table",
          );
        }
        if (route.path === "/customers") {
          await expectFirstVisible(
            page.locator("main").last().locator("table").first(),
            "/customers desktop table",
          );
        }
        if (route.path === "/inventory") {
          await expectFirstVisible(
            page.locator("main").last().locator("table").first(),
            "/inventory desktop table",
          );
        }
        await expectNoPageOverflow(page, route.path, viewport.width);
      }
    });
  }
});

test.describe("business desktop dialog overflow guard", () => {
  for (const viewport of desktopViewports) {
    test(`business dialogs stay inside viewport at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);

      await page.goto("/orders");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

      await clickFirstVisible(page.getByRole("button", { name: /新建工单/ }), "新建工单");
      await expect(page.getByRole("dialog", { name: "新建维修订单" })).toBeVisible();
      await expectOpenDialogsFit(page, "/orders new order", viewport.width);
      await expectNoPageOverflow(page, "/orders new order", viewport.width);
      await closeDialogs(page);

      if (viewport.width >= 1280) {
        await clickFirstVisible(
          page.getByRole("button", { name: /查看工单详情 R\d+/ }),
          "工单详情",
        );
        const orderDetail = page.getByRole("dialog", { name: "工单详情" });
        await expect(orderDetail).toBeVisible();
        await orderDetail.locator('[data-order-hero="true"]').waitFor({
          state: "visible",
          timeout: 5000,
        });
        await expectFirstVisible(
          orderDetail.locator('[data-order-hero="true"]'),
          "/orders detail hero",
        );
        if ((await orderDetail.locator('[data-order-readiness="true"]').count()) > 0) {
          await expectFirstVisible(
            orderDetail.locator('[data-order-readiness="true"]'),
            "/orders detail readiness",
          );
        }
        await expectFirstVisible(
          orderDetail.locator('[data-order-detail-main-grid="true"]'),
          "/orders detail desktop grid",
        );
        const orderDetailBox = await expectOpenDialogsFit(page, "/orders detail", viewport.width);
        const openedOrderNotify = await clickFirstVisible(
          orderDetail.getByRole("button", { name: "WhatsApp" }),
          "WhatsApp",
          { optional: true },
        );
        if (openedOrderNotify) {
          await expect(page.getByRole("dialog", { name: "预览 WhatsApp 通知" })).toBeVisible();
          await expectOpenDialogsFit(page, "/orders notify dialog", viewport.width);
          await expectNoPageOverflow(page, "/orders notify dialog", viewport.width);
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog", { name: "预览 WhatsApp 通知" })).toHaveCount(0);
        }
        await clickFirstVisible(page.getByRole("button", { name: /记录/ }), "工单记录标签");
        const orderRecordsBox = await expectOpenDialogsFit(
          page,
          "/orders detail records tab",
          viewport.width,
        );
        expect(Math.abs(orderRecordsBox.width - orderDetailBox.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(orderRecordsBox.height - orderDetailBox.height)).toBeLessThanOrEqual(1);
        await expectNoPageOverflow(page, "/orders detail", viewport.width);
        await closeDialogs(page);
      }

      await page.goto("/buyback");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

      await clickFirstVisible(page.getByRole("button", { name: /回收报价/ }), "回收报价");
      await expect(page.getByRole("dialog", { name: "回收报价" })).toBeVisible();
      await expectFirstVisible(page.getByText("选择 iPhone"), "/buyback quote first step");
      await expectOpenDialogsFit(page, "/buyback quote workspace", viewport.width);
      await expectNoPageOverflow(page, "/buyback quote workspace", viewport.width);
      await closeDialogs(page);

      await clickFirstVisible(page.getByRole("button", { name: /查看回收记录 I\d+/ }), "回收记录");
      await expect(page.getByRole("dialog", { name: "回收记录" })).toBeVisible();
      await expectFirstVisible(
        page.getByRole("dialog", { name: "回收记录" }).getByText("处理进度"),
        "/buyback record progress section",
      );
      await expectFirstVisible(
        page.getByRole("dialog", { name: "回收记录" }).getByRole("button", {
          name: /复估|打开库存详情/,
        }),
        "/buyback record primary action",
      );
      await expectOpenDialogsFit(page, "/buyback record", viewport.width);
      await expectNoPageOverflow(page, "/buyback record", viewport.width);
      await closeDialogs(page);

      await page.goto("/customers");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

      await clickFirstVisible(page.getByRole("button", { name: /新建客户/ }), "新建客户");
      await expect(page.getByRole("dialog", { name: "新建客户" })).toBeVisible();
      await expectOpenDialogsFit(page, "/customers new customer", viewport.width);
      await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
      await expectNoPageOverflow(page, "/customers new customer", viewport.width);
      await closeDialogs(page);

      const openedPreview = await clickFirstVisible(
        page.getByRole("button", { name: /详情/ }),
        "客户详情",
        { optional: true },
      );
      if (openedPreview) {
        const previewDialog = page.getByRole("dialog", { name: "客户详情预览" });
        await expect(previewDialog).toBeVisible();
        const firstBox = await expectOpenDialogsFit(
          page,
          "/customers detail preview",
          viewport.width,
        );
        await clickFirstVisible(
          previewDialog.getByRole("button", { name: /工单/ }),
          "客户工单标签",
        );
        const nextBox = await expectOpenDialogsFit(
          page,
          "/customers detail preview orders tab",
          viewport.width,
        );
        expect(Math.abs(nextBox.width - firstBox.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(nextBox.height - firstBox.height)).toBeLessThanOrEqual(1);
        await expectNoPageOverflow(page, "/customers detail preview", viewport.width);

        await expect(previewDialog.getByRole("button", { name: /编辑客户/ }).first()).toBeVisible();
        await clickFirstVisible(
          previewDialog.getByRole("button", { name: /编辑客户/ }),
          "编辑客户",
        );
        await expect(page.getByRole("dialog", { name: "编辑客户" })).toBeVisible();
        await expectOpenDialogsFit(page, "/customers nested edit dialog", viewport.width);
        await expectNoPageOverflow(page, "/customers nested edit dialog", viewport.width);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "编辑客户" })).toHaveCount(0);

        await clickFirstVisible(
          previewDialog.getByRole("button", { name: /设备/ }),
          "客户设备标签",
        );
        await clickFirstVisible(
          previewDialog.getByRole("button", { name: /添加设备/ }),
          "添加设备",
        );
        await expect(page.getByRole("dialog", { name: "添加设备" })).toBeVisible();
        await expectOpenDialogsFit(page, "/customers nested device dialog", viewport.width);
        await expectNoPageOverflow(page, "/customers nested device dialog", viewport.width);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "添加设备" })).toHaveCount(0);
        await closeDialogs(page);
      }

      await page.goto("/inventory");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

      await clickFirstVisible(page.getByRole("button", { name: /新增入库/ }), "新增入库");
      await expect(page.getByRole("dialog", { name: "新增入库" })).toBeVisible();
      await expect(page.getByRole("button", { name: "创建" })).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory intake", viewport.width);
      await expectNoPageOverflow(page, "/inventory intake", viewport.width);
      await closeDialogs(page);

      await clickFirstVisible(
        page.getByRole("button", { name: /导入电子产品|导入库存/ }),
        "导入库存",
      );
      await expect(page.getByRole("dialog", { name: "导入 SeaTable 电子产品" })).toBeVisible();
      await expect(page.getByRole("button", { name: "应用导入" })).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory import", viewport.width);
      await expectNoPageOverflow(page, "/inventory import", viewport.width);
      await closeDialogs(page);

      const firstInventoryRow = page
        .locator("main")
        .last()
        .locator("tbody tr[role='button']")
        .filter({ hasText: /I\d+/ })
        .first();
      await expectFirstVisible(firstInventoryRow, "/inventory first desktop row");
      await clickFirstVisible(firstInventoryRow, "库存详情");
      const inventoryDetailDialog = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("button", { name: "更多库存操作" }) })
        .first();
      await expect(inventoryDetailDialog).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory detail", viewport.width);
      await expectNoPageOverflow(page, "/inventory detail", viewport.width);

      await openInventoryDetailAction(page, inventoryDetailDialog, "推进状态");
      await expect(page.getByRole("dialog", { name: "推进状态" })).toBeVisible();
      await expect(page.getByRole("button", { name: "确认推进" })).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory transition", viewport.width);
      await expectNoPageOverflow(page, "/inventory transition", viewport.width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "推进状态" })).toHaveCount(0);

      await openInventoryDetailAction(page, inventoryDetailDialog, "登记检测");
      await expect(page.getByRole("dialog", { name: "登记检测" })).toBeVisible();
      await expect(page.getByRole("button", { name: "保存检测" })).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory check", viewport.width);
      await expectNoPageOverflow(page, "/inventory check", viewport.width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "登记检测" })).toHaveCount(0);

      await openInventoryDetailAction(page, inventoryDetailDialog, "售出");
      await expect(page.getByRole("dialog", { name: "登记售出" })).toBeVisible();
      await expect(page.getByRole("button", { name: "确认售出" })).toBeVisible();
      await expectOpenDialogsFit(page, "/inventory sell", viewport.width);
      await expectNoPageOverflow(page, "/inventory sell", viewport.width);
      await closeDialogs(page);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      if (viewport.width === 1024) {
        await expectElementMinWidth(page.locator("#invite-email"), "/settings invite email", 240);
      }
      await page.locator("#order-warranty").click();
      await expectFirstVisible(page.getByRole("listbox"), "/settings warranty select");
      await expectVisibleOverlaysFit(page, "/settings warranty select", viewport.width);
      await expectNoPageOverflow(page, "/settings warranty select", viewport.width);
      await page.keyboard.press("Escape");

      await page.goto("/messages");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await page
        .getByLabel("模板正文")
        .fill("{{customer_name}}{{order_no}}{{store_email}}".repeat(40));
      await expectFirstVisible(page.getByText("实时预览"), "/messages live preview");
      await expectElementMinWidth(
        page.locator("#template-body"),
        "/messages template body",
        viewport.width >= 1280 ? 420 : 320,
      );
      await expectNoPageOverflow(page, "/messages edited template", viewport.width);

      await page.goto("/platform");
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      const openedPlatformDecision = await clickFirstVisible(
        page.getByRole("button", { name: /处理|查看并处理/ }),
        "处理平台申请",
        { optional: true },
      );
      if (openedPlatformDecision) {
        await expect(page.getByRole("dialog", { name: "处理平台申请" })).toBeVisible();
        await expectOpenDialogsFit(page, "/platform decision dialog", viewport.width);
        await expectNoPageOverflow(page, "/platform decision dialog", viewport.width);
        await closeDialogs(page);
      }
    });
  }
});

async function expectNoPageOverflow(page: Page, route: string, width: number) {
  const overflow = await page.evaluate(() => {
    function hasLocalHorizontalScroller(element: HTMLElement) {
      let current: HTMLElement | null = element;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          current.scrollWidth > current.clientWidth + 1
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }

    const pageWidth = window.innerWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.scrollingElement?.scrollWidth ?? 0,
    );

    const offenders = [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0
        ) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.right <= pageWidth + 1 && rect.left >= -1) return false;

        return !hasLocalHorizontalScroller(element);
      })
      .slice(0, 5)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className).slice(0, 120),
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      });

    return {
      pageWidth,
      documentWidth,
      offenders,
    };
  });

  expect(
    overflow.documentWidth,
    `${route} at ${width}px document overflow: ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.pageWidth + 1);
  expect(
    overflow.offenders,
    `${route} at ${width}px element overflow: ${JSON.stringify(overflow.offenders)}`,
  ).toHaveLength(0);
}

async function clickFirstVisible(
  locator: Locator,
  label: string,
  options: { optional?: boolean } = {},
) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => true);
    if (visible && enabled) {
      await candidate.click();
      return true;
    }
  }

  if (options.optional) return false;
  throw new Error(`No visible control found for ${label}`);
}

async function openInventoryDetailAction(page: Page, dialog: Locator, label: string) {
  const openedDirectly = await clickFirstVisible(
    dialog.getByRole("button", { name: label }),
    label,
    {
      optional: true,
    },
  );
  if (openedDirectly) return;

  await clickFirstVisible(dialog.getByRole("button", { name: "更多库存操作" }), "更多库存操作");
  await clickFirstVisible(page.getByRole("menuitem", { name: label }), label);
}

async function closeDialogs(page: Page) {
  for (let index = 0; index < 4; index += 1) {
    const dialogCount = await page.getByRole("dialog").count();
    if (dialogCount === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

async function expectFirstVisible(locator: Locator, label: string) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return;
  }
  throw new Error(`No visible element found for ${label}`);
}

async function expectElementMinWidth(locator: Locator, label: string, minWidth: number) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const box = await candidate.boundingBox();
    expect(box, `${label} has no layout box`).not.toBeNull();
    expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(minWidth);
    return;
  }
  throw new Error(`No visible element found for ${label}`);
}

async function expectOpenDialogsFit(page: Page, route: string, width: number) {
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      .filter((dialog) => {
        const style = window.getComputedStyle(dialog);
        const rect = dialog.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text: (dialog.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
        };
      });
    return { viewport, dialogs };
  });

  expect(result.dialogs, `${route} at ${width}px has no visible dialog`).not.toHaveLength(0);
  for (const dialog of result.dialogs) {
    expect(
      dialog.left,
      `${route} dialog left overflow: ${JSON.stringify(dialog)}`,
    ).toBeGreaterThanOrEqual(-1);
    expect(
      dialog.top,
      `${route} dialog top overflow: ${JSON.stringify(dialog)}`,
    ).toBeGreaterThanOrEqual(-1);
    expect(
      dialog.right,
      `${route} dialog right overflow: ${JSON.stringify(dialog)}`,
    ).toBeLessThanOrEqual(result.viewport.width + 1);
    expect(
      dialog.bottom,
      `${route} dialog bottom overflow: ${JSON.stringify(dialog)}`,
    ).toBeLessThanOrEqual(result.viewport.height + 1);
  }

  await expectVisibleOverlaysFit(page, route, width);
  return result.dialogs[result.dialogs.length - 1];
}

async function expectVisibleOverlaysFit(page: Page, route: string, width: number) {
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const overlaySelectors = [
      '[role="dialog"]',
      '[role="listbox"]',
      "[data-radix-popper-content-wrapper]",
    ];
    const overlays = overlaySelectors
      .flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({
          selector,
          element,
        })),
      )
      .filter(({ element }) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map(({ selector, element }) => {
        const rect = element.getBoundingClientRect();
        return {
          selector,
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
        };
      });
    return { viewport, overlays };
  });

  expect(result.overlays, `${route} at ${width}px has no visible overlay`).not.toHaveLength(0);
  for (const overlay of result.overlays) {
    expect(
      overlay.left,
      `${route} overlay left overflow: ${JSON.stringify(overlay)}`,
    ).toBeGreaterThanOrEqual(-1);
    expect(
      overlay.top,
      `${route} overlay top overflow: ${JSON.stringify(overlay)}`,
    ).toBeGreaterThanOrEqual(-1);
    expect(
      overlay.right,
      `${route} overlay right overflow: ${JSON.stringify(overlay)}`,
    ).toBeLessThanOrEqual(result.viewport.width + 1);
    expect(
      overlay.bottom,
      `${route} overlay bottom overflow: ${JSON.stringify(overlay)}`,
    ).toBeLessThanOrEqual(result.viewport.height + 1);
  }
}
