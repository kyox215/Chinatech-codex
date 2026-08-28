import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const layoutOnly = process.env.REPAIRDESK_E2E_ORDER_LAYOUT_ONLY === "1";
const taskScreenshotDir = "screenshots/TASK-20260720-004-order-detail-alignment-polish";

const desktopQueueViewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1536, height: 900 },
  { width: 1600, height: 1000 },
] as const;
const employeeFirstViewports = [
  { width: 768, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for order desktop UI audit.");

test.describe("order desktop UI audit", () => {
  for (const viewport of desktopQueueViewports) {
    test(`orders use desktop queue rows and compact work surfaces at ${viewport.width}px`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        window.localStorage.setItem("repairdesk-print-count", "0");
        window.print = () => {
          const current = Number(window.localStorage.getItem("repairdesk-print-count") ?? "0");
          window.localStorage.setItem("repairdesk-print-count", String(current + 1));
        };
      });

      await page.setViewportSize(viewport);
      await gotoReady(page, "/orders");
      await ensureOutputIdentityReady(page);
      await gotoReady(page, "/orders");

      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expectFirstVisible(page.getByText("维修工单"), "/orders work queue heading");
      const desktopList = page.locator('[data-order-desktop-list="true"]');
      await expectFirstVisible(desktopList, "/orders desktop queue");
      await expect(desktopList).toHaveCount(1);
      await expect(page.locator('[data-order-mobile-list="true"]')).toHaveCount(0);
      await expect(page.locator("main").last().locator("table")).toHaveCount(0);
      await expectDesktopQueueGrid(desktopList, "/orders desktop queue", viewport.width);
      await expectNoLocalHorizontalScroll(desktopList, "/orders desktop queue");
      await expectNoPageOverflow(page, "/orders desktop queue", viewport.width);
      await openAndExpectNewOrderWorkspace(page, viewport.width);

      await expectFirstVisible(
        desktopList.getByText("阶段 / 下一步"),
        "/orders queue action column",
      );
      await expectFirstVisible(
        desktopList.getByText("工单 / 客户"),
        "/orders queue order customer column",
      );
      await expectFirstVisible(desktopList.getByText("设备 / 故障"), "/orders queue device column");
      await expectFirstVisible(
        desktopList.getByText("金额 / 风险"),
        "/orders queue finance risk column",
      );

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
        detailDialogWidthBounds(viewport.width),
      );
      await expectFirstVisible(
        detail.locator('[data-order-desktop-status-card="true"]'),
        "工单桌面状态卡",
      );
      await expectFirstVisible(detail.locator('[data-order-stage-rail="true"]'), "工单阶段轨道");
      const compactProgress = detail.locator('[data-order-progress-compact="true"]');
      await expectFirstVisible(compactProgress, "工单紧凑进度带");
      expect(
        await compactProgress.evaluate((element) =>
          Math.round(element.getBoundingClientRect().height),
        ),
        "工单紧凑进度带高度",
      ).toBeLessThanOrEqual(36);
      expect(
        await compactProgress.evaluate((element) =>
          Math.round(element.getBoundingClientRect().width),
        ),
        "工单紧凑进度带宽度",
      ).toBeLessThanOrEqual(710);
      if ((await detail.locator('[data-order-readiness="true"]').count()) > 0) {
        await expectFirstVisible(detail.locator('[data-order-readiness="true"]'), "工单就绪检查");
      }
      await expectFirstVisible(
        detail.locator('[data-order-detail-view-switcher="true"]'),
        "工单详情视图切换",
      );
      await expect(detail.getByRole("tab", { name: "概览" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expectFirstVisible(
        detail.locator('[data-order-panel="key-info"]'),
        "工单详情补充信息卡",
      );
      await expectFirstVisible(detail.getByText("客户信息"), "工单客户信息卡");
      await expectFirstVisible(detail.getByText("设备与故障"), "工单设备与故障卡");
      await expectFirstVisible(detail.getByText("报价处理"), "工单报价处理卡");
      const headerFinance = detail.locator('[data-order-header-finance="true"]');
      await expectFirstVisible(headerFinance, "工单顶部金额分区");
      const detailMoneyStrip = headerFinance.locator('[data-order-workspace-money-strip="true"]');
      await expectFirstVisible(detailMoneyStrip, "工单详情统一金额条");
      await expectFirstVisible(detailMoneyStrip.getByText("总额").first(), "详情金额总额");
      await expectFirstVisible(detailMoneyStrip.getByText("定金").first(), "详情金额定金");
      await expectFirstVisible(detailMoneyStrip.getByText("尾款").first(), "详情金额尾款");
      await expect(detail.locator('[data-order-panel="photos"]')).toHaveCount(0);
      await expect(detail.getByRole("tab", { name: "内部成本" })).toHaveCount(0);
      await expect(detail.locator('[data-order-internal-costs="true"]')).toHaveCount(0);
      await expectFirstVisible(
        detail.locator('[data-order-detail-main-grid="true"]'),
        "工单桌面主网格",
      );
      await expect(detail.locator('[data-order-detail-main-grid="true"]')).toHaveAttribute(
        "data-order-detail-layout",
        "new-order-aligned",
      );
      await expect(detail.locator('[data-order-detail-secondary-grid="true"]')).toHaveCount(0);
      const overviewColumns = await detail
        .locator('[data-order-detail-main-grid="true"]')
        .evaluate(
          (element) =>
            window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
        );
      expect(overviewColumns, `工单概览两栏 at ${viewport.width}px`).toBe(2);
      const overviewDensity = await detail
        .locator('[data-order-desktop-single-workspace="true"]')
        .evaluate((workspace) => {
          const scroller = workspace.parentElement;
          if (!scroller) return Number.POSITIVE_INFINITY;
          return scroller.scrollHeight - scroller.clientHeight;
        });
      expect(overviewDensity, `工单默认概览纵向滚动差 at ${viewport.width}px`).toBeLessThanOrEqual(
        1,
      );
      await expectFirstVisible(
        detail.locator('[data-order-action-dock="true"]'),
        "工单详情桌面动作工作区",
      );
      await expectFirstVisible(
        detail.locator('[data-order-action-settlement="true"]'),
        "工单底部结算状态",
      );
      await expect(detail.locator('[data-order-action-money-strip="true"]')).toHaveCount(0);
      await expect(detail.locator('[data-mobile-order-page="true"]')).toHaveCount(0);
      await expectRectInsideViewport(detail.locator('[data-order-hero="true"]'), "工单顶部状态卡");
      await expectRectInsideViewport(
        detail.locator('[data-order-action-dock="true"]'),
        "工单底部动作栏",
      );
      await expectDesktopPanelsReadable(detail, viewport.width);
      if (process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1" && viewport.width === 1440) {
        await page.screenshot({
          path: `${taskScreenshotDir}/desktop-overview-1440.png`,
          fullPage: false,
        });
      }

      if (layoutOnly) {
        await clickFirstVisible(detail.getByRole("tab", { name: /记录与信息/ }), "记录与信息分组");
        await expectDesktopRecordsWorkspace(detail, viewport.width, "/orders dialog records");
        await expectNoPageOverflow(page, "/orders records tab", viewport.width);
        if (process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1" && viewport.width === 1440) {
          await page.screenshot({
            path: `${taskScreenshotDir}/desktop-records-1440.png`,
            fullPage: false,
          });
        }
        await clickFirstVisible(detail.getByRole("tab", { name: /设备照片/ }), "设备照片分组");
        await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "工单设备照片卡");
        await expectNoPageOverflow(page, "/orders photos tab", viewport.width);
        if (process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1" && viewport.width === 1440) {
          await page.screenshot({
            path: `${taskScreenshotDir}/desktop-photos-1440.png`,
            fullPage: false,
          });
        }
        return;
      }

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
      await expect(actionDock.locator('[data-primary-action="true"]')).toHaveCount(1);
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
        const transitionPanel = page.locator('[data-order-desktop-transition-panel="true"]');
        const approvalDialog = page.locator('[data-order-desktop-approval-dialog="true"]');
        if (
          await transitionPanel
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await expectFirstVisible(transitionPanel, "桌面内嵌流转面板");
          await expect(page.getByRole("dialog", { name: "状态流转" })).toHaveCount(0);
          await expectNoPageOverflow(page, "/orders transition inline panel", viewport.width);
          await clickFirstVisible(
            transitionPanel.getByRole("button", { name: "收起状态流转" }),
            "收起状态流转",
          );
          await expect(transitionPanel).toHaveCount(0);
        } else {
          await expect(page.getByRole("dialog", { name: "客户审批处理" })).toBeVisible();
          await expectFirstVisible(approvalDialog, "桌面审批处理弹窗");
          await expectOpenDialogsFit(page, "/orders approval dialog", viewport.width);
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog", { name: "客户审批处理" })).toHaveCount(0);
        }
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

      await expect(detail.getByText("发送入口在底部 WhatsApp 操作")).toHaveCount(0);
      await expectVisibleButtonCount(
        detail.getByRole("button", { name: "发送通知" }),
        0,
        "记录页重复发送通知",
      );
      await clickFirstVisible(detail.getByRole("tab", { name: /记录与信息/ }), "记录与信息分组");
      await expectDesktopRecordsWorkspace(detail, viewport.width, "/orders dialog records");
      await expectNoPageOverflow(page, "/orders records tab", viewport.width);
      if (process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1" && viewport.width === 1440) {
        await page.screenshot({
          path: `${taskScreenshotDir}/desktop-records-1440.png`,
          fullPage: false,
        });
      }

      await clickFirstVisible(hero.getByRole("button", { name: "编辑" }), "记录页进入编辑");
      await expect(detail.getByRole("tab", { name: "概览" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(detail.locator('[data-order-panel="key-info"]')).toHaveCount(0);
      await clickFirstVisible(hero.getByRole("button", { name: "取消" }), "记录页取消编辑");

      await clickFirstVisible(detail.getByRole("tab", { name: /设备照片/ }), "设备照片分组");
      await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "工单设备照片卡");
      await expectNoPageOverflow(page, "/orders photos tab", viewport.width);

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
      await gotoReady(page, `${detailPath}/task`);
      await expectDesktopTaskPage(page, viewport.width);

      await gotoReady(page, "/orders");
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

test.describe("employee-first order detail layout", () => {
  for (const viewport of employeeFirstViewports) {
    test(`keeps quote-first two-column work surface at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await gotoReady(
        page,
        "/orders?workspace=order-detail&orderId=ord_21&source=order-detail-layout-audit",
      );

      const detail = page.getByRole("dialog", { name: "工单详情" });
      await expect(detail).toBeVisible();
      await expectFirstVisible(detail.getByText("R2026021"), "稳定员工优先工单 R2026021");
      const mainGrid = detail.locator('[data-order-detail-main-grid="true"]');
      await expectFirstVisible(mainGrid, "员工优先订单详情主网格");

      const layout = await mainGrid.evaluate((grid) => {
        const style = window.getComputedStyle(grid);
        const columns = style.gridTemplateColumns.split(" ").filter(Boolean);
        const columnsByKey = [
          ...grid.querySelectorAll<HTMLElement>("[data-order-detail-column]"),
        ].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            key: element.dataset.orderDetailColumn,
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            rowEnd: window.getComputedStyle(element).gridRowEnd,
          };
        });
        return { columns: columns.length, columnsByKey };
      });
      expect(layout.columns, `员工优先主网格列数 at ${viewport.width}px`).toBe(2);
      expect(layout.columnsByKey.map((column) => column.key)).toEqual([
        "quote",
        "customer-device",
        "detail",
      ]);
      const quote = layout.columnsByKey.find((column) => column.key === "quote");
      const core = layout.columnsByKey.find((column) => column.key === "customer-device");
      const side = layout.columnsByKey.find((column) => column.key === "detail");
      expect(quote).toBeTruthy();
      expect(core).toBeTruthy();
      expect(side).toBeTruthy();
      if (quote && core && side) {
        expect(Math.abs(quote.left - core.left)).toBeLessThanOrEqual(1);
        expect(quote.top).toBeLessThan(core.top);
        expect(Math.abs(quote.top - side.top)).toBeLessThanOrEqual(1);
        expect(side.left).toBeGreaterThan(quote.left);
        expect(side.width).toBeGreaterThanOrEqual(260);
        expect(side.rowEnd).toMatch(/span\s+2/);
      }

      const finance = detail.locator('[data-order-panel="finance"]');
      await expectFirstVisible(finance.getByText("报价处理"), "员工优先报价处理");
      await expectFirstVisible(finance.getByText("客户", { exact: true }), "客户审批前缀");
      await expectFirstVisible(finance.getByText(/结算\s·/), "结算状态前缀");
      const quoteRect = await finance.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const scroller = element.closest(
          '[data-order-desktop-single-workspace="true"]',
        )?.parentElement;
        const scrollerRect = scroller?.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          scrollerTop: Math.round(scrollerRect?.top ?? 0),
          scrollerBottom: Math.round(scrollerRect?.bottom ?? window.innerHeight),
        };
      });
      expect(quoteRect.top).toBeGreaterThanOrEqual(quoteRect.scrollerTop - 1);
      expect(quoteRect.top).toBeLessThan(quoteRect.scrollerBottom);

      const actionDock = detail.locator('[data-order-action-dock="true"]');
      await expect(actionDock.locator('[data-primary-action="true"]')).toHaveCount(1);
      await expect(actionDock.getByRole("button", { name: "审批处理" })).toHaveCount(1);
      const diagnosisShortcut = detail.getByRole("button", { name: "检测报价" });
      await expect(diagnosisShortcut).toHaveClass(/border/);
      await expect(diagnosisShortcut).not.toHaveAttribute("data-primary-action", "true");

      if (viewport.width === 768) {
        const custodyActions = detail
          .locator('[data-order-device-custody="true"]:visible')
          .getByRole("button", {
            name: /确认收机|确认交还客人|补录为留店|补录为未留店|确认已退还|历史修正/,
          });
        const kioskSignatureActions = detail
          .locator('[data-order-panel="customer"]:visible')
          .getByRole("button", { name: /发送到 iPad|重新发送|发送中|无 iPad/ });
        await expect(custodyActions).toHaveCount(1);
        await expect(kioskSignatureActions).toHaveCount(1);
        const touchTargets = [
          detail.locator('[data-order-hero="true"]').getByRole("button", { name: "打印" }),
          detail.locator('[data-order-hero="true"]').getByRole("button", { name: "更多工单操作" }),
          detail.locator('[data-order-hero="true"]').getByRole("button", { name: "编辑" }),
          detail.locator('[data-order-hero="true"]').getByRole("button", { name: "关闭工单详情" }),
          detail.locator('[data-order-detail-view-switcher="true"] [role="tab"]'),
          diagnosisShortcut,
          custodyActions,
          kioskSignatureActions,
          actionDock.getByRole("button"),
        ];
        for (const target of touchTargets) {
          const count = await target.count();
          for (let index = 0; index < count; index += 1) {
            const button = target.nth(index);
            if (!(await button.isVisible().catch(() => false))) continue;
            await expect
              .poll(
                () =>
                  button.evaluate((element) => Math.round(element.getBoundingClientRect().height)),
                { message: "768px 触控目标高度", timeout: 5_000 },
              )
              .toBeGreaterThanOrEqual(44);
          }
        }
      }

      await expectRectInsideViewport(
        detail.locator('[data-order-hero="true"]'),
        "员工优先顶部工作卡",
      );
      await expectRectInsideViewport(actionDock, "员工优先底部动作栏");
      await expectNoLocalHorizontalScroll(mainGrid, `员工优先主网格 at ${viewport.width}px`);
      await expectNoPageOverflow(page, "/orders employee-first detail", viewport.width);
      if (process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1") {
        await page.screenshot({
          path: `${taskScreenshotDir}/employee-first-${viewport.width}.png`,
          fullPage: false,
        });
      }
    });
  }
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function printCount(page: Page) {
  return page.evaluate(() => Number(window.localStorage.getItem("repairdesk-print-count") ?? "0"));
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
    const alreadyReady =
      settings.store_name === "RepairDesk E2E" &&
      settings.store_address === "Via Test 1, Floridia" &&
      settings.store_phone === "+39000000000" &&
      settings.message_signature === "RepairDesk E2E · Assistenza" &&
      settings.print_footer === "Grazie per aver scelto RepairDesk E2E.";
    if (alreadyReady) return;

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

async function clickFirstVisible(
  locator: Locator,
  label: string,
  options: { optional?: boolean } = {},
) {
  if (!options.optional) {
    await expect
      .poll(() => firstVisibleEnabledIndex(locator), {
        message: `Clickable control for ${label}`,
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(0);
  }

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

async function firstVisibleEnabledIndex(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => true);
    if (visible && enabled) return index;
  }
  return -1;
}

async function expectFirstVisible(locator: Locator, label: string) {
  await expect
    .poll(
      async () => {
        const count = await locator.count();
        for (let index = 0; index < count; index += 1) {
          if (
            await locator
              .nth(index)
              .isVisible()
              .catch(() => false)
          )
            return true;
        }
        return false;
      },
      { message: `Visible element for ${label}`, timeout: 10_000 },
    )
    .toBe(true);
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
  expect(columns, `${label} desktop column count`).toBeGreaterThanOrEqual(7);
}

function detailDialogWidthBounds(width: number) {
  const expectedWidth = Math.min(1400, width - 32);
  return { minWidth: expectedWidth - 1, maxWidth: expectedWidth + 1 };
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
    const panelLocator = detail.locator(`[data-order-panel="${panel}"]`);
    if ((await countVisible(panelLocator)) === 0) continue;
    await expectRectInsideViewport(panelLocator, label, {
      checkVertical: false,
      minWidth,
    });
  }

  if ((await getOrderDetailSurface(detail)) === "dialog") {
    const overviewLayout = await detail
      .locator('[data-order-detail-main-grid="true"]')
      .evaluate((grid) => {
        const columns = window
          .getComputedStyle(grid)
          .gridTemplateColumns.split(" ")
          .filter(Boolean);
        const columnRects = [
          ...grid.querySelectorAll<HTMLElement>("[data-order-detail-column]"),
        ].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            key: element.dataset.orderDetailColumn,
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            rowEnd: window.getComputedStyle(element).gridRowEnd,
          };
        });
        return { columns: columns.length, columnRects };
      });
    expect(overviewLayout.columns, `工单概览两栏 at ${width}px`).toBe(2);
    expect(
      overviewLayout.columnRects.map((column) => column.key),
      `工单概览 DOM 顺序 at ${width}px`,
    ).toEqual(["quote", "customer-device", "detail"]);
    const quote = overviewLayout.columnRects.find((column) => column.key === "quote");
    const core = overviewLayout.columnRects.find((column) => column.key === "customer-device");
    const side = overviewLayout.columnRects.find((column) => column.key === "detail");
    expect(quote).toBeTruthy();
    expect(core).toBeTruthy();
    expect(side).toBeTruthy();
    if (quote && core && side) {
      expect(
        Math.abs(quote.left - core.left),
        `报价/客户设备左列对齐 at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(quote.top, `报价位于客户设备之前 at ${width}px`).toBeLessThan(core.top);
      expect(
        Math.abs(quote.top - side.top),
        `报价/关键信息顶部对齐 at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(side.left, `关键信息位于右列 at ${width}px`).toBeGreaterThan(quote.left);
      expect(side.width, `关键信息列保持可读宽度 at ${width}px`).toBeGreaterThanOrEqual(260);
      expect(side.rowEnd, `关键信息列跨越左列两行 at ${width}px`).toMatch(/span\s+2/);
    }
    const tabsWidth = await detail
      .locator('[data-order-detail-view-switcher="true"]')
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));
    expect(tabsWidth, `工单详情分组切换避免整行铺满 at ${width}px`).toBeLessThanOrEqual(620);

    const custody = detail.locator('[data-order-device-custody="true"]');
    if ((await countVisible(custody)) > 0) {
      const custodyWidth = await custody.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
      );
      expect(custodyWidth, `设备保管卡避免整行铺满 at ${width}px`).toBeLessThanOrEqual(782);
    }

    const dockWidth = await detail
      .locator('[data-order-action-dock="true"] > div')
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));
    expect(dockWidth, `底部操作区避免整行铺满 at ${width}px`).toBeLessThanOrEqual(570);
  }

  if (width >= 1280 && (await countVisible(detail.locator('[data-order-panel="photos"]'))) > 0) {
    const deviceWidth = await detail
      .locator('[data-order-panel="device"]')
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));
    const photosWidth = await detail
      .locator('[data-order-panel="photos"]')
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));
    expect(Math.abs(photosWidth - deviceWidth), "设备照片卡应与设备信息列对齐").toBeLessThanOrEqual(
      1,
    );
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
  const isDialog =
    (await detail
      .locator('[data-order-detail-root="true"][data-order-detail-surface="dialog"]')
      .count()) > 0;
  const expectedColumns = isDialog ? 2 : width >= 1280 ? 3 : 2;
  expect(columns, `${route} main edit grid columns at ${width}px`).toBe(expectedColumns);
  expect(
    await mainGrid.locator('[data-order-panel="photos"]').count(),
    `${route} photos are not squeezed into the main edit grid`,
  ).toBe(0);
  if (isDialog) {
    await expect(detail.locator('[data-order-panel="photos"]')).toHaveCount(0);
  } else {
    await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "编辑态设备照片卡");
  }
  await expectDesktopPanelsReadable(detail, width);
  await expectNoLocalHorizontalScroll(mainGrid, `${route} main edit grid`);
  await expectNoPageOverflow(page, route, width);

  await clickFirstVisible(hero.getByRole("button", { name: "取消" }), "取消编辑");
  await expectVisibleButtonCount(hero.getByRole("button", { name: "编辑" }), 1, "退出编辑");
}

async function openAndExpectNewOrderWorkspace(page: Page, width: number) {
  await clickFirstVisible(page.locator('[data-order-list-new-button="true"]'), "新建工单");
  const dialog = page.getByRole("dialog", { name: "新建维修工单" });
  await expect(dialog).toBeVisible();
  await expectFirstVisible(
    page.locator('[data-new-order-desktop-header="true"]'),
    "新建工单桌面顶部",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-workspace-grid="true"]'),
    "新建工单桌面网格",
  );
  const missingItems = page.locator('[data-new-order-missing-items="true"]');
  await expectFirstVisible(missingItems, "新建工单缺失项提示");
  await expect(missingItems.getByRole("button", { name: "补充：设备保管" })).toBeVisible();
  await expectFirstVisible(page.locator('[data-new-order-section="customer"]'), "新建工单客户区");
  await expectFirstVisible(
    page.locator('[data-new-order-section="customer"]').getByText("客户信息"),
    "新建工单客户信息标题",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="device-info"]'),
    "新建工单设备区",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="device-info"]').getByText("设备信息"),
    "新建工单设备信息标题",
  );
  await expect(page.locator('[data-new-order-section="fault-diagnosis"]')).toHaveCount(0);
  await expectFirstVisible(
    page.locator('[data-new-order-section="quotation"]'),
    "新建工单报价处理区",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="quotation"]').getByText("报价处理"),
    "新建工单报价处理标题",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-section="device-unlock"]'),
    "新建工单手机密码区",
  );
  await expect(
    page.locator('[data-new-order-section="quotation"] [data-new-order-field="deposit"]'),
  ).toHaveCount(1);
  const newOrderMoneyStrip = page.locator(
    '[data-new-order-header-finance="true"] [data-order-workspace-money-strip="true"]',
  );
  await expectFirstVisible(newOrderMoneyStrip, "新建工单顶部金额条");
  await expectFirstVisible(newOrderMoneyStrip.getByText("总额").first(), "新建金额总额");
  await expectFirstVisible(newOrderMoneyStrip.getByText("定金").first(), "新建金额定金");
  await expectFirstVisible(newOrderMoneyStrip.getByText("尾款").first(), "新建金额尾款");
  await expect(
    page.locator('[data-new-order-desktop-header="true"]').getByText("预计总额"),
  ).toHaveCount(0);
  await expectFirstVisible(
    page.locator(
      '[data-new-order-section="quotation"] [data-order-workspace-quote-row="true"], [data-new-order-section="quotation"] [data-order-workspace-empty-block="true"]',
    ),
    "新建工单报价项目或空态",
  );
  await expectFirstVisible(
    page.locator('[data-new-order-submit-card="true"]'),
    "新建工单提交工作条",
  );
  await expect(
    page.locator('[data-new-order-submit-card="true"] [data-order-workspace-money-strip="true"]'),
  ).toHaveCount(0);
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
      const sectionWidths = ["customer", "fault-diagnosis", "quotation"].map((section) => {
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
  await expectFirstVisible(
    detail.locator('[data-order-detail-secondary-grid="true"]'),
    "直达详情第二排摘要网格",
  );
  await expectFirstVisible(detail.locator('[data-order-action-dock="true"]'), "直达详情动作工作区");
  await expectFirstVisible(
    detail.locator('[data-order-panel="finance"] [data-order-workspace-money-strip="true"]'),
    "直达详情金额摘要条",
  );
  await expectFirstVisible(
    detail.locator('[data-order-action-settlement="true"]'),
    "直达详情底部结算状态",
  );
  await expect(detail.locator('[data-order-action-money-strip="true"]')).toHaveCount(0);
  await expectDirectDetailDockAligned(detail, width);
  await expect(detail.locator('[data-mobile-order-page="true"]')).toBeHidden();
  await expectFirstVisible(
    detail.locator('[data-order-panel="key-info"]'),
    "直达详情关键记录同页信息",
  );
  await expectFirstVisible(detail.locator('[data-order-panel="photos"]'), "直达详情设备照片卡");
  await expectDesktopPanelsReadable(detail, width);
  await expectNoPageOverflow(page, "/orders direct detail", width);

  await expectVisibleButtonCount(
    detail.locator('[data-order-action-dock="true"]').getByRole("button", { name: "报价" }),
    0,
    "直达详情报价",
  );
  await expectInlineEditWorkspace(page, detail, width, "/orders direct detail edit");

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
  const isDialog = (await getOrderDetailSurface(detail)) === "dialog";
  const controls = records.locator('[data-order-records-controls="true"]');
  const groupedRecords = records.locator('[data-order-records-group="true"]');
  if ((await countVisible(groupedRecords)) > 0) {
    await expectFirstVisible(records.locator('[data-order-panel="key-info"]'), `${label} key info`);
    const keyInfoColumns = await records
      .locator('[data-order-key-info-grid="true"]')
      .evaluate(
        (element) =>
          window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      );
    expect(keyInfoColumns, `${label} key info columns`).toBe(2);
    await expect(records.locator('[data-order-records-messages="true"]')).toBeHidden();
    await expect(records.locator('[data-order-records-timeline="true"]')).toBeHidden();

    await clickFirstVisible(records.getByRole("tab", { name: /历史通知/ }), "历史通知分组");
    await expectFirstVisible(
      records.locator('[data-order-records-messages="true"]'),
      `${label} message log`,
    );
    await clickFirstVisible(records.getByRole("tab", { name: /时间线/ }), "时间线分组");
    await expectFirstVisible(
      records.locator('[data-order-records-timeline="true"]'),
      `${label} timeline log`,
    );
  } else {
    await expectFirstVisible(
      records.locator('[data-order-records-messages="true"]'),
      `${label} message log`,
    );
    await expectFirstVisible(
      records.locator('[data-order-records-timeline="true"]'),
      `${label} timeline log`,
    );
  }

  const rowCount = await records.locator('[data-order-record-row="true"]').count();
  expect(rowCount, `${label} timeline rows`).toBeGreaterThanOrEqual(1);

  if (isDialog) {
    const scrollDelta = await records.evaluate((element) => {
      const workspace = element.closest<HTMLElement>(
        '[data-order-desktop-single-workspace="true"]',
      );
      const scroller = workspace?.parentElement;
      if (!scroller) return Number.POSITIVE_INFINITY;
      return Math.round(scroller.scrollHeight - scroller.clientHeight);
    });
    expect(scrollDelta, `${label} negligible records scroll delta`).toBeLessThanOrEqual(12);
  }

  if (isDialog && (await countVisible(controls)) > 0) {
    const alignment = await records.evaluate((element) => {
      const controlRow = element.querySelector<HTMLElement>('[data-order-records-controls="true"]');
      const group = element.querySelector<HTMLElement>('[data-order-records-group="true"]');
      const timeline = element.querySelector<HTMLElement>('[data-order-records-timeline="true"]');
      const cards = Array.from(
        element.querySelectorAll<HTMLElement>("[data-order-record-control-card]"),
      ).filter((card) => window.getComputedStyle(card).display !== "none");
      const controlRect = controlRow?.getBoundingClientRect();
      const groupRect = group?.getBoundingClientRect();
      const timelineRect = timeline?.getBoundingClientRect();
      return {
        controls: controlRect
          ? {
              left: Math.round(controlRect.left),
              right: Math.round(controlRect.right),
              width: Math.round(controlRect.width),
            }
          : null,
        group: groupRect
          ? {
              left: Math.round(groupRect.left),
              right: Math.round(groupRect.right),
              width: Math.round(groupRect.width),
            }
          : null,
        timeline: timelineRect
          ? {
              left: Math.round(timelineRect.left),
              right: Math.round(timelineRect.right),
              width: Math.round(timelineRect.width),
            }
          : null,
        cards: cards.map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
          };
        }),
      };
    });
    expect(alignment.controls, `${label} responsibility controls`).not.toBeNull();
    expect(alignment.group, `${label} grouped records`).not.toBeNull();
    expect(alignment.timeline, `${label} timeline panel`).not.toBeNull();
    if (alignment.controls && alignment.group && alignment.timeline) {
      expect(
        Math.abs(alignment.controls.left - alignment.group.left),
        `${label} left column line`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment.controls.right - alignment.group.right),
        `${label} right column line`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment.timeline.left - alignment.group.left),
        `${label} timeline left line`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment.timeline.right - alignment.group.right),
        `${label} timeline right line`,
      ).toBeLessThanOrEqual(1);
    }
    if (alignment.cards.length === 2) {
      expect(
        Math.abs(alignment.cards[0]!.width - alignment.cards[1]!.width),
        `${label} control card widths`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment.cards[0]!.top - alignment.cards[1]!.top),
        `${label} control card tops`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment.cards[0]!.bottom - alignment.cards[1]!.bottom),
        `${label} control card bottoms`,
      ).toBeLessThanOrEqual(1);
    }
  }

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
  if (isDialog) {
    expect(layout.columns, `${label} dialog record columns at ${width}px`).toBe(1);
  } else {
    expect(layout.columns, `${label} desktop record columns at ${width}px`).toBeGreaterThanOrEqual(
      2,
    );
  }
  expect(layout.left, `${label} left overflow`).toBeGreaterThanOrEqual(-1);
  expect(layout.right, `${label} right overflow`).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.width, `${label} readable width`).toBeGreaterThanOrEqual(
    Math.min(700, width - 160),
  );
}

async function getOrderDetailSurface(detail: Locator) {
  return detail.evaluate((element) => {
    const root = element.matches('[data-order-detail-root="true"]')
      ? element
      : element.querySelector('[data-order-detail-root="true"]');
    return root?.getAttribute("data-order-detail-surface") ?? null;
  });
}

async function expectRectInsideViewport(
  locator: Locator,
  label: string,
  options: { checkVertical?: boolean; minWidth?: number; maxWidth?: number } = {},
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
    if (options.maxWidth) {
      expect(rect.width, `${label} bounded width: ${JSON.stringify(rect)}`).toBeLessThanOrEqual(
        options.maxWidth,
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
