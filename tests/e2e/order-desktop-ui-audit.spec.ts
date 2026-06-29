import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const desktopQueueViewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for order desktop UI audit.");

test.describe("order desktop UI audit", () => {
  for (const viewport of desktopQueueViewports) {
    test(`orders use desktop queue rows and compact work surfaces at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("repairdesk-print-count", "0");
        window.print = () => {
          const current = Number(window.localStorage.getItem("repairdesk-print-count") ?? "0");
          window.localStorage.setItem("repairdesk-print-count", String(current + 1));
        };
      });

      await page.setViewportSize(viewport);
      await page.goto("/orders");
      await page.waitForLoadState("networkidle");

      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expectFirstVisible(page.getByText("工单工作队列"), "/orders work queue heading");
      const desktopList = page.locator('[data-order-desktop-list="true"]');
      await expectFirstVisible(desktopList, "/orders desktop queue");
      await expect(page.locator('[data-order-mobile-list="true"]')).toBeHidden();
      await expect(page.locator("main").last().locator("table")).toHaveCount(0);
      await expectDesktopQueueGrid(desktopList, "/orders desktop queue", viewport.width);
      await expectNoLocalHorizontalScroll(desktopList, "/orders desktop queue");
      await expectNoPageOverflow(page, "/orders desktop queue", viewport.width);
      await openAndExpectNewOrderWorkspace(page, viewport.width);

      await expectFirstVisible(desktopList.getByText("工单"), "/orders queue order column");
      await expectFirstVisible(desktopList.getByText("客户"), "/orders queue customer column");
      await expectFirstVisible(desktopList.getByText("设备 / 故障"), "/orders queue device column");
      await expectFirstVisible(
        desktopList.getByText("状态与下一步"),
        "/orders queue status column",
      );
      await expectFirstVisible(desktopList.getByText("金额"), "/orders queue finance column");

      const rows = desktopList.locator('[data-order-row="true"]');
      expect(await countVisible(rows), "/orders visible desktop rows").toBeGreaterThanOrEqual(4);
      const firstRow = rows.first();
      await expectFirstVisible(firstRow, "/orders first desktop row");

      await clickFirstVisible(firstRow.getByRole("checkbox").first(), "行选择");
      await expect(page.getByRole("dialog", { name: "工单详情" })).toHaveCount(0);
      await expectFirstVisible(page.getByText(/已选\s+1\s+条/), "批量操作条");
      await clickFirstVisible(firstRow.getByRole("button", { name: "更多工单操作" }), "行更多操作");
      await expect(page.getByRole("dialog", { name: "工单详情" })).toHaveCount(0);
      await page.keyboard.press("Escape");

      await clickFirstVisible(firstRow, "工单详情");

      const detail = page.getByRole("dialog", { name: "工单详情" });
      await expect(detail).toBeVisible();
      await page.waitForTimeout(250);
      await expect(page).toHaveURL(/\/orders(?:\?|$)/);
      await expectFirstVisible(detail.locator('[data-order-hero="true"]'), "工单详情顶部工作卡");
      await expectRectInsideViewport(
        page.locator('[data-order-detail-dialog-shell="true"]'),
        "工单详情桌面弹窗外壳",
        { minWidth: Math.min(920, viewport.width - 96) },
      );
      await expectFirstVisible(
        detail.locator('[data-order-desktop-status-card="true"]'),
        "工单桌面状态卡",
      );
      await expectFirstVisible(detail.locator('[data-order-stage-rail="true"]'), "工单阶段轨道");
      if ((await detail.locator('[data-order-readiness="true"]').count()) > 0) {
        await expectFirstVisible(detail.locator('[data-order-readiness="true"]'), "工单就绪检查");
      }
      await expect(detail.locator('[data-order-panel="key-info"]')).toHaveCount(0);
      await expectFirstVisible(detail.getByText("客户信息"), "工单客户信息卡");
      await expectFirstVisible(detail.getByText("设备与故障"), "工单设备与故障卡");
      await expectFirstVisible(detail.getByText("报价处理"), "工单报价处理卡");
      await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "工单设备照片卡");
      await expectFirstVisible(
        detail.locator('[data-order-detail-main-grid="true"]'),
        "工单桌面主网格",
      );
      await expectFirstVisible(
        detail.locator('[data-order-action-dock="true"]'),
        "工单详情桌面动作工作区",
      );
      await expect(detail.locator('[data-mobile-order-page="true"]')).toHaveCount(0);
      await expectRectInsideViewport(detail.locator('[data-order-hero="true"]'), "工单顶部状态卡");
      await expectRectInsideViewport(
        detail.locator('[data-order-action-dock="true"]'),
        "工单底部动作栏",
      );
      await expectDesktopPanelsReadable(detail, viewport.width);

      const hero = detail.locator('[data-order-hero="true"]');
      await expectVisibleButtonCount(hero.getByRole("button", { name: "打印" }), 1, "详情打印");
      await expectVisibleButtonCount(
        hero.getByRole("button", { name: "WhatsApp" }),
        0,
        "顶部 WhatsApp",
      );
      await expectVisibleButtonCount(hero.getByRole("button", { name: "流转" }), 0, "顶部流转");
      await expectVisibleButtonCount(
        hero.getByRole("button", { name: "审批处理" }),
        0,
        "顶部审批处理",
      );
      await expectVisibleButtonCount(hero.getByRole("button", { name: "收款" }), 0, "顶部收款");
      await expectVisibleButtonCount(hero.getByRole("button", { name: "报价" }), 0, "顶部报价");
      const actionDock = detail.locator('[data-order-action-dock="true"]');
      await expectVisibleButtonCount(
        actionDock.getByRole("button", { name: "WhatsApp" }),
        1,
        "详情 WhatsApp",
      );
      const progressAction = actionDock.getByRole("button", { name: /^(流转|审批处理)$/ });
      await expectVisibleButtonCount(progressAction, 1, "详情推进动作");
      await expectVisibleButtonCount(
        actionDock.getByRole("button", { name: "收款" }),
        1,
        "详情收款",
      );
      await expectVisibleButtonCount(
        actionDock.getByRole("button", { name: "报价" }),
        0,
        "详情报价",
      );
      await expectVisibleButtonCount(
        detail.getByRole("button", { name: "通知客户" }),
        0,
        "详情重复通知客户",
      );
      await expectVisibleButtonCount(
        detail.getByRole("button", { name: "发送通知" }),
        0,
        "详情重复发送通知",
      );
      await expectOpenDialogsFit(page, "/orders detail", viewport.width);
      await expectNoPageOverflow(page, "/orders detail", viewport.width);

      await clickFirstVisible(detail.getByRole("button", { name: "WhatsApp" }), "WhatsApp");
      await expect(page.getByRole("dialog", { name: "预览 WhatsApp 通知" })).toBeVisible();
      await expectOpenDialogsFit(page, "/orders notify dialog", viewport.width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "预览 WhatsApp 通知" })).toHaveCount(0);

      const flowOpened = await clickFirstVisible(progressAction, "流转或审批处理", {
        optional: true,
      });
      if (flowOpened) {
        await expect(page.getByRole("dialog", { name: /^(状态流转|客户审批处理)$/ })).toBeVisible();
        await expectFirstVisible(
          page.locator(
            '[data-order-desktop-transition-dialog="true"], [data-order-desktop-approval-dialog="true"]',
          ),
          "桌面流转或审批弹窗",
        );
        await expectOpenDialogsFit(page, "/orders transition sheet", viewport.width);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: /^(状态流转|客户审批处理)$/ })).toHaveCount(
          0,
        );
      }

      await expectInlineEditWorkspace(page, detail, viewport.width, "/orders detail edit");

      const payOpened = await clickFirstVisible(
        detail.getByRole("button", { name: "收款" }),
        "收款",
        {
          optional: true,
        },
      );
      if (payOpened) {
        await expect(page.getByRole("dialog", { name: "登记收款" })).toBeVisible();
        await expectFirstVisible(
          page.locator('[data-order-desktop-payment-dialog="true"]'),
          "桌面收款弹窗",
        );
        await expectFirstVisible(
          page.locator('[data-order-payment-summary="true"]'),
          "桌面收款摘要",
        );
        await expectOpenDialogsFit(page, "/orders payment dialog", viewport.width);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "登记收款" })).toHaveCount(0);
      }

      const detailPrintsBefore = await printCount(page);
      await clickFirstVisible(detail.getByRole("button", { name: "打印" }), "详情打印");
      await expect.poll(() => printCount(page)).toBe(detailPrintsBefore + 1);

      await clickFirstVisible(page.getByRole("button", { name: /记录/ }), "工单记录标签");
      await expect(detail.getByText("发送入口在底部 WhatsApp 操作")).toHaveCount(0);
      await expectVisibleButtonCount(
        detail.getByRole("button", { name: "发送通知" }),
        0,
        "记录页重复发送通知",
      );
      await expectDesktopRecordsWorkspace(detail, viewport.width, "/orders dialog records");
      await expectNoPageOverflow(page, "/orders records tab", viewport.width);

      await page.keyboard.press("Escape");
      await expect(detail).toHaveCount(0);

      const firstRowAfterClose = page.getByRole("button", { name: /查看工单详情 R\d+/ }).first();
      await clickFirstVisible(
        firstRowAfterClose.getByRole("button", { name: "更多工单操作" }),
        "行更多操作",
      );
      await clickFirstVisible(page.getByRole("menuitem", { name: "在新页打开" }), "在新页打开");
      await expect(page).toHaveURL(/\/orders\/[^/?]+(?:\?|$)/);
      await expectDirectDesktopDetailPage(page, viewport.width);

      const detailPath = new URL(page.url()).pathname;
      await page.goto(`${detailPath}/task`);
      await page.waitForLoadState("networkidle");
      await expectDesktopTaskPage(page, viewport.width);

      await page.goto("/orders");
      await page.waitForLoadState("networkidle");
      await expectFirstVisible(desktopList, "/orders desktop queue after direct detail");
      const rowPrintsBefore = await printCount(page);
      const firstRowForPrint = page.getByRole("button", { name: /查看工单详情 R\d+/ }).first();
      await clickFirstVisible(
        firstRowForPrint.getByRole("button", { name: "更多工单操作" }),
        "行更多操作",
      );
      await clickFirstVisible(page.getByRole("menuitem", { name: "打印" }), "行打印");
      await expect.poll(() => printCount(page)).toBe(rowPrintsBefore + 1);
    });
  }
});

async function printCount(page: Page) {
  return page.evaluate(() => Number(window.localStorage.getItem("repairdesk-print-count") ?? "0"));
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

async function expectFirstVisible(locator: Locator, label: string) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return;
  }
  throw new Error(`No visible element found for ${label}`);
}

async function countVisible(locator: Locator) {
  let visibleCount = 0;
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      visibleCount += 1;
  }
  return visibleCount;
}

async function expectDesktopQueueGrid(locator: Locator, label: string, width: number) {
  const columns = await locator
    .locator('[data-order-row="true"]')
    .first()
    .evaluate(
      (row) => window.getComputedStyle(row).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
  expect(columns, `${label} desktop column count`).toBeGreaterThanOrEqual(width >= 1280 ? 8 : 7);
}

async function expectNoLocalHorizontalScroll(locator: Locator, label: string) {
  const result = await locator.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(
    result.scrollWidth,
    `${label} local horizontal scroll: ${JSON.stringify(result)}`,
  ).toBeLessThanOrEqual(result.clientWidth + 1);
}

async function expectVisibleButtonCount(locator: Locator, expected: number, label: string) {
  let visibleCount = 0;
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      visibleCount += 1;
  }
  expect(visibleCount, `${label} visible button count`).toBe(expected);
}

async function expectDesktopPanelsReadable(detail: Locator, width: number) {
  const minPanelWidth = width <= 1024 ? 190 : 220;
  for (const [panel, label, minWidth] of [
    ["customer", "客户信息卡", minPanelWidth],
    ["device", "设备与故障卡", minPanelWidth],
    ["finance", "报价处理卡", minPanelWidth],
    ["photos", "设备照片卡", width <= 1024 ? 170 : 180],
  ] as const) {
    await expectRectInsideViewport(detail.locator(`[data-order-panel="${panel}"]`), label, {
      checkVertical: false,
      minWidth,
    });
  }
}

async function expectInlineEditWorkspace(
  page: Page,
  detail: Locator,
  width: number,
  route: string,
) {
  const hero = detail.locator('[data-order-hero="true"]');
  const actionDock = detail.locator('[data-order-action-dock="true"]');

  await clickFirstVisible(hero.getByRole("button", { name: "编辑" }), "详情编辑");
  await expectVisibleButtonCount(hero.getByRole("button", { name: "保存" }), 1, "编辑保存");
  await expectVisibleButtonCount(hero.getByRole("button", { name: "取消" }), 1, "编辑取消");

  await expectFirstVisible(detail.getByLabel("客户"), "编辑客户名称");
  await expectFirstVisible(detail.getByPlaceholder("搜索或输入主电话"), "编辑主电话");
  await expectFirstVisible(detail.getByLabel("备用联系电话"), "编辑备用联系电话");
  await expectFirstVisible(detail.getByRole("button", { name: "添加备用号码" }), "添加备用号码");
  await expectFirstVisible(detail.getByLabel("品牌"), "编辑品牌");
  await expectFirstVisible(detail.getByLabel("型号"), "编辑型号");
  await expectFirstVisible(detail.getByLabel("设备备注"), "编辑设备备注");
  await expectFirstVisible(detail.getByLabel("故障描述"), "编辑故障描述");
  await expectFirstVisible(detail.getByLabel("报价项目 1 名称"), "编辑报价项目名称");
  await expectFirstVisible(detail.getByLabel("报价项目 1 金额"), "编辑报价项目金额");
  await expectFirstVisible(detail.getByLabel("定金"), "编辑定金");

  await expectVisibleButtonCount(actionDock.getByRole("button", { name: "报价" }), 0, "编辑报价");
  await expect(actionDock.getByRole("button", { name: "WhatsApp" })).toBeDisabled();
  await expect(actionDock.getByRole("button", { name: /^(流转|审批处理)$/ })).toBeDisabled();
  await expect(actionDock.getByRole("button", { name: "收款" })).toBeDisabled();

  const mainGrid = detail.locator('[data-order-detail-main-grid="true"]');
  const columns = await mainGrid.evaluate(
    (element) =>
      window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  const expectedColumns = route.includes("direct detail") && width <= 1024 ? 2 : 3;
  expect(columns, `${route} main edit grid columns at ${width}px`).toBeGreaterThanOrEqual(
    expectedColumns,
  );
  expect(
    await mainGrid.locator('[data-order-panel="photos"]').count(),
    `${route} photos are not squeezed into the main edit grid`,
  ).toBe(0);
  await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "编辑态设备照片卡");
  await expectDesktopPanelsReadable(detail, width);
  await expectNoLocalHorizontalScroll(mainGrid, `${route} main edit grid`);
  await expectNoPageOverflow(page, route, width);

  await clickFirstVisible(hero.getByRole("button", { name: "取消" }), "取消编辑");
  await expectVisibleButtonCount(hero.getByRole("button", { name: "编辑" }), 1, "退出编辑");
}

async function openAndExpectNewOrderWorkspace(page: Page, width: number) {
  await clickFirstVisible(page.getByRole("button", { name: /新建工单/ }), "新建工单");
  const dialog = page.getByRole("dialog", { name: "新建维修订单" });
  await expect(dialog).toBeVisible();
  await expectFirstVisible(
    page.locator('[data-new-order-desktop-header="true"]'),
    "新建工单桌面顶部",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-workspace-grid="true"]'),
    "新建工单桌面网格",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="customer-device"]'),
    "新建工单客户设备区",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="fault-diagnosis"]'),
    "新建工单故障诊断区",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="quotation"]'),
    "新建工单报价服务区",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-submit-card="true"]'),
    "新建工单提交工作条",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-dialog-close="true"]'),
    "新建工单关闭按钮",
  );
  await expectNewOrderWorkspaceLayout(page, width);
  await expectOpenDialogsFit(page, "/orders new order workspace", width);
  await expectNoPageOverflow(page, "/orders new order workspace", width);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

async function expectNewOrderWorkspaceLayout(page: Page, width: number) {
  const result = await page
    .locator('[data-new-order-workspace-grid="true"]')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const compactRect = (target: Element | null) => {
        if (!target) return null;
        const targetRect = target.getBoundingClientRect();
        return {
          left: Math.round(targetRect.left),
          top: Math.round(targetRect.top),
          right: Math.round(targetRect.right),
          bottom: Math.round(targetRect.bottom),
          width: Math.round(targetRect.width),
          height: Math.round(targetRect.height),
        };
      };
      const visibleRect = (selector: string) => {
        const targets = [...document.querySelectorAll<HTMLElement>(selector)];
        const visibleTarget = targets.find((target) => {
          const style = window.getComputedStyle(target);
          const targetRect = target.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            targetRect.width > 0 &&
            targetRect.height > 0
          );
        });
        return compactRect(visibleTarget ?? null);
      };
      const columns = window
        .getComputedStyle(element)
        .gridTemplateColumns.split(" ")
        .filter(Boolean);
      const sectionWidths = ["customer-device", "fault-diagnosis", "quotation"].map((section) => {
        const target = element.querySelector<HTMLElement>(`[data-new-order-section="${section}"]`);
        const targetRect = target?.getBoundingClientRect();
        return targetRect ? Math.round(targetRect.width) : 0;
      });

      return {
        width: Math.round(rect.width),
        columns: columns.length,
        sectionWidths,
        grid: compactRect(element),
        header: visibleRect('[data-new-order-desktop-header="true"]'),
        close: visibleRect('[data-new-order-dialog-close="true"]'),
        submit: visibleRect('[data-new-order-submit-card="true"]'),
        submitWidth: Math.round(
          document
            .querySelector<HTMLElement>('[data-new-order-submit-card="true"]')
            ?.getBoundingClientRect().width ?? 0,
        ),
      };
    });

  expect(result.width, `new order grid readable at ${width}px`).toBeGreaterThanOrEqual(
    Math.min(760, width - 180),
  );
  expect(result.columns, `new order desktop columns at ${width}px`).toBeGreaterThanOrEqual(2);
  for (const sectionWidth of result.sectionWidths) {
    expect(sectionWidth, `new order section readable width at ${width}px`).toBeGreaterThanOrEqual(
      width >= 1280 ? 220 : 280,
    );
  }
  expect(result.submitWidth, `new order submit rail width at ${width}px`).toBeGreaterThanOrEqual(
    Math.min(700, width - 220),
  );
  expect(result.grid, `new order grid visible at ${width}px`).toBeTruthy();
  expect(result.header, `new order header visible at ${width}px`).toBeTruthy();
  expect(result.close, `new order close button visible at ${width}px`).toBeTruthy();
  expect(result.submit, `new order submit rail visible at ${width}px`).toBeTruthy();
  if (result.grid && result.header && result.close && result.submit) {
    expect(
      Math.abs(result.header.left - result.grid.left),
      `new order header/grid left alignment at ${width}px`,
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(result.submit.left - result.grid.left),
      `new order submit/grid left alignment at ${width}px`,
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(result.header.right - result.grid.right),
      `new order header/grid right alignment at ${width}px`,
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(result.submit.right - result.grid.right),
      `new order submit/grid right alignment at ${width}px`,
    ).toBeLessThanOrEqual(4);
    expect(
      result.close.right,
      `new order close button stays inside header at ${width}px`,
    ).toBeLessThanOrEqual(result.header.right - 6);
    expect(
      result.close.top,
      `new order close button stays below header top at ${width}px`,
    ).toBeGreaterThanOrEqual(result.header.top + 6);
  }
}

async function expectDirectDesktopDetailPage(page: Page, width: number) {
  const detail = page.locator('[data-order-detail-root="true"][data-order-detail-surface="page"]');
  await detail.waitFor({ state: "visible", timeout: 5000 });
  await expectFirstVisible(detail, "直达工单详情页");
  await expectFirstVisible(detail.locator('[data-order-hero="true"]'), "直达详情顶部工作卡");
  await expectFirstVisible(
    detail.locator('[data-order-detail-context-strip="true"]'),
    "直达详情上下文条",
  );
  await expectFirstVisible(detail.locator('[data-order-latest-event="true"]'), "直达详情最新记录");
  await expectFirstVisible(
    detail.locator('[data-order-detail-main-grid="true"]'),
    "直达详情主网格",
  );
  await expectFirstVisible(detail.locator('[data-order-action-dock="true"]'), "直达详情动作工作区");
  await expectFirstVisible(
    detail.locator('[data-order-action-money-strip="true"]'),
    "直达详情金额摘要条",
  );
  await expectDirectDetailDockAligned(detail, width);
  await expect(detail.locator('[data-mobile-order-page="true"]')).toBeHidden();
  await expect(detail.locator('[data-order-panel="key-info"]')).toHaveCount(0);
  await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "直达详情设备照片卡");
  await expectDesktopPanelsReadable(detail, width);
  await expectNoPageOverflow(page, "/orders direct detail", width);

  await expectVisibleButtonCount(
    detail.locator('[data-order-action-dock="true"]').getByRole("button", { name: "报价" }),
    0,
    "直达详情报价",
  );
  await expectInlineEditWorkspace(page, detail, width, "/orders direct detail edit");

  await clickFirstVisible(detail.getByRole("button", { name: "记录" }), "直达详情记录标签");
  await expectDesktopRecordsWorkspace(detail, width, "/orders direct records");
  await expectNoPageOverflow(page, "/orders direct records", width);
}

async function expectDirectDetailDockAligned(detail: Locator, width: number) {
  const layout = await detail.locator('[data-order-action-dock="true"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.left, `direct detail action dock avoids sidebar at ${width}px`).toBeGreaterThan(40);
  expect(layout.right, `direct detail action dock right edge at ${width}px`).toBeLessThanOrEqual(
    layout.viewportWidth + 1,
  );
  expect(layout.width, `direct detail action dock content width at ${width}px`).toBeLessThan(
    layout.viewportWidth,
  );
}

async function expectDesktopTaskPage(page: Page, width: number) {
  const task = page.locator('[data-order-task-root="true"]');
  await expectFirstVisible(task, "桌面工单任务页");
  await expectFirstVisible(task.locator('[data-order-task-hero="true"]'), "桌面任务状态卡");
  await expectFirstVisible(task.locator('[data-order-task-workspace="true"]'), "桌面任务工作区");
  await expectFirstVisible(task.locator('[data-order-task-info="true"]'), "桌面任务信息卡");
  await expectFirstVisible(task.locator('[data-order-task-finance="true"]'), "桌面任务财务卡");
  await expectFirstVisible(task.locator('[data-order-task-actions="true"]'), "桌面任务动作卡");
  await expectFirstVisible(
    task.locator('[data-order-task-transition-panel="true"]'),
    "桌面任务流转面板",
  );
  await expect(task.getByText("扫码任务模式")).toBeHidden();

  const layout = await task.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const workspace = element.querySelector<HTMLElement>('[data-order-task-workspace="true"]');
    const info = element.querySelector<HTMLElement>('[data-order-task-info="true"]');
    const infoGrids = Array.from(info?.querySelectorAll<HTMLElement>("div") ?? []).filter(
      (node) => {
        const style = window.getComputedStyle(node);
        return style.display === "grid" && style.gridTemplateColumns !== "none";
      },
    );
    const infoGrid = infoGrids.find((node) => {
      const text = node.textContent ?? "";
      return text.includes("客户") && text.includes("主电话");
    });
    const workspaceStyle = workspace ? window.getComputedStyle(workspace) : null;
    const infoGridStyle = infoGrid ? window.getComputedStyle(infoGrid) : null;
    const workspaceRect = workspace?.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      workspaceWidth: Math.round(workspaceRect?.width ?? 0),
      columns: workspaceStyle?.gridTemplateColumns.split(" ").filter(Boolean).length ?? 0,
      infoColumns: infoGridStyle?.gridTemplateColumns.split(" ").filter(Boolean).length ?? 0,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.width, `task page width at ${width}px`).toBeGreaterThanOrEqual(
    Math.min(760, width - 180),
  );
  expect(layout.workspaceWidth, `task workspace width at ${width}px`).toBeGreaterThanOrEqual(
    Math.min(720, width - 220),
  );
  expect(layout.columns, `task workspace columns at ${width}px`).toBeGreaterThanOrEqual(2);
  expect(layout.infoColumns, `task info field columns at ${width}px`).toBe(width >= 1280 ? 3 : 2);

  const transitionOpened = await clickFirstVisible(
    task.getByRole("button", { name: /推进至/ }),
    "任务页推进确认",
    { optional: true },
  );
  if (transitionOpened) {
    const transitionDialog = page.getByRole("dialog", { name: "任务状态推进" });
    await expect(transitionDialog).toBeVisible();
    await expectFirstVisible(
      page.locator('[data-order-task-transition-dialog="true"]'),
      "任务页状态推进弹窗",
    );
    await expectFirstVisible(
      transitionDialog.getByRole("button", { name: "确认推进" }),
      "确认推进",
    );
    await expectOpenDialogsFit(page, "/orders task transition dialog", width);
    await page.keyboard.press("Escape");
    await expect(transitionDialog).toHaveCount(0);
  }

  await expectNoPageOverflow(page, "/orders task desktop", width);
}

async function expectDesktopRecordsWorkspace(detail: Locator, width: number, label: string) {
  const records = detail.locator('[data-order-records-workspace="true"]');
  await records.waitFor({ state: "visible", timeout: 5000 });
  await expectFirstVisible(records, `${label} records workspace`);
  await expectFirstVisible(
    records.locator('[data-order-records-messages="true"]'),
    `${label} message log`,
  );
  await expectFirstVisible(
    records.locator('[data-order-records-timeline="true"]'),
    `${label} timeline log`,
  );

  const rowCount = await records.locator('[data-order-record-row="true"]').count();
  expect(rowCount, `${label} timeline rows`).toBeGreaterThanOrEqual(1);

  const layout = await records.evaluate((element) => {
    const columns = window
      .getComputedStyle(element)
      .gridTemplateColumns.split(" ")
      .filter(Boolean).length;
    const rect = element.getBoundingClientRect();
    return {
      columns,
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      viewportWidth: window.innerWidth,
    };
  });
  expect(layout.columns, `${label} desktop record columns at ${width}px`).toBeGreaterThanOrEqual(2);
  expect(layout.left, `${label} left overflow`).toBeGreaterThanOrEqual(-1);
  expect(layout.right, `${label} right overflow`).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.width, `${label} readable width`).toBeGreaterThanOrEqual(
    Math.min(700, width - 160),
  );
}

async function expectRectInsideViewport(
  locator: Locator,
  label: string,
  options: { checkVertical?: boolean; minWidth?: number } = {},
) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const rect = await candidate.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });

    expect(rect.left, `${label} left overflow: ${JSON.stringify(rect)}`).toBeGreaterThanOrEqual(-1);
    expect(rect.right, `${label} right overflow: ${JSON.stringify(rect)}`).toBeLessThanOrEqual(
      rect.viewportWidth + 1,
    );
    if (options.checkVertical !== false) {
      expect(rect.top, `${label} top overflow: ${JSON.stringify(rect)}`).toBeGreaterThanOrEqual(-1);
      expect(rect.bottom, `${label} bottom overflow: ${JSON.stringify(rect)}`).toBeLessThanOrEqual(
        rect.viewportHeight + 1,
      );
    }
    if (options.minWidth) {
      expect(rect.width, `${label} readable width: ${JSON.stringify(rect)}`).toBeGreaterThanOrEqual(
        options.minWidth,
      );
    }
    return;
  }
  throw new Error(`No visible element found for ${label}`);
}

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

async function expectOpenDialogsFit(page: Page, route: string, width: number) {
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
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
        };
      });
    return { viewport, dialogs };
  });

  expect(result.dialogs, `${route} at ${width}px has no visible dialog`).not.toHaveLength(0);
  for (const dialog of result.dialogs) {
    expect(dialog.left, `${route} dialog left overflow`).toBeGreaterThanOrEqual(-1);
    expect(dialog.top, `${route} dialog top overflow`).toBeGreaterThanOrEqual(-1);
    expect(dialog.right, `${route} dialog right overflow`).toBeLessThanOrEqual(
      result.viewport.width + 1,
    );
    expect(dialog.bottom, `${route} dialog bottom overflow`).toBeLessThanOrEqual(
      result.viewport.height + 1,
    );
  }

  await expectVisibleOverlaysFit(page, route, width);
}

async function expectVisibleOverlaysFit(page: Page, route: string, width: number) {
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const overlays = [
      '[role="dialog"]',
      '[role="listbox"]',
      "[data-radix-popper-content-wrapper]",
    ].flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({
        selector,
        element,
      })),
    );

    return overlays
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
          viewport,
        };
      });
  });

  for (const overlay of result) {
    expect(overlay.left, `${route} ${overlay.selector} left overflow`).toBeGreaterThanOrEqual(-1);
    expect(overlay.top, `${route} ${overlay.selector} top overflow`).toBeGreaterThanOrEqual(-1);
    expect(overlay.right, `${route} ${overlay.selector} right overflow`).toBeLessThanOrEqual(
      overlay.viewport.width + 1,
    );
    expect(overlay.bottom, `${route} ${overlay.selector} bottom overflow`).toBeLessThanOrEqual(
      overlay.viewport.height + 1,
    );
  }
}
