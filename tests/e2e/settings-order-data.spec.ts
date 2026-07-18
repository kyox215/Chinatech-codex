import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for order-data checks.");

test.describe("settings order-data responsive workflow", () => {
  for (const viewport of viewports) {
    test(`renders reachable controls without page overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoReady(page, "/settings?section=order-data");
      const section = page.locator("[data-settings-order-data-section]");

      await expect(section.getByRole("heading", { name: "工单数据文件" })).toBeVisible();
      await expect(section.getByRole("heading", { name: "导入工单" })).toBeVisible();
      await expectNoPageOverflow(page, `order-data ${viewport.width}px`);

      if (viewport.width <= 430) {
        for (const name of ["空白模板", "导出工单", "客户统计", "生成预览"]) {
          const box = await section.getByRole("button", { name }).boundingBox();
          expect(box?.height ?? 0, `${name} touch height`).toBeGreaterThanOrEqual(44);
        }
        expect(
          (await section.getByLabel("XLSX 文件（最大 4 MB）").boundingBox())?.height ?? 0,
        ).toBeGreaterThanOrEqual(44);
        expect(
          (await section.getByRole("combobox", { name: "导入模式" }).boundingBox())?.height ?? 0,
        ).toBeGreaterThanOrEqual(44);
        await section.getByRole("combobox", { name: "导入模式" }).click();
        for (const option of ["只更新已有工单", "新增并更新"]) {
          await expect
            .poll(
              async () =>
                (await page.getByRole("option", { name: option }).boundingBox())?.height ?? 0,
              { message: `${option} option touch height after the open transition` },
            )
            .toBeGreaterThanOrEqual(44);
        }
        await page.keyboard.press("Escape");
      }

      if (viewport.width === 390 || viewport.width === 1440) {
        await hideNextDevIndicators(page);
        await page.screenshot({
          path: `screenshots/responsive-density/settings/wp07-order-data-${viewport.width}x${viewport.height}.png`,
          fullPage: true,
        });
      }
    });
  }

  test("loads recent sanitized batch history only after the owner asks for it", async ({
    page,
  }) => {
    let historyRequests = 0;
    await page.route("**/api/repairdesk/orders/data/batches", async (route) => {
      historyRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            storeId: "00000000-0000-0000-0000-000000000001",
            hasMore: true,
            items: [
              {
                id: "batch-1",
                storeId: "00000000-0000-0000-0000-000000000001",
                kind: "import",
                mode: "update_only",
                status: "previewed",
                actorDisplayName: "Primary Owner",
                createdAt: "2026-07-13T08:00:00.000Z",
                expiresAt: "2026-07-14T08:00:00.000Z",
                summary: { total: 12, ready: 10, invalid: 2 },
              },
            ],
          },
        }),
      });
    });
    await page.setViewportSize({ width: 430, height: 932 });
    await gotoReady(page, "/settings?section=order-data");

    expect(historyRequests).toBe(0);
    await page.getByRole("button", { name: "查看最近批次" }).click();
    await expect(page.getByText("Primary Owner")).toBeVisible();
    await expect(page.getByText("总计 12 · 可应用 10 · 错误 2")).toBeVisible();
    await expect(page.getByText(/这里只显示最近 20 个批次/)).toBeVisible();
    await expect(page.getByText("Mario Rossi")).toHaveCount(0);
    expect(historyRequests).toBe(1);
    await expectNoPageOverflow(page, "order-data history 430px");
  });

  test("shows a store-bound 101-row preview and protects navigation on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeOrderDataPreview(page, previewPayload(101));
    await gotoReady(page, "/settings?section=order-data");

    await selectWorkbook(page, "orders-mobile.xlsx");
    await page.getByRole("button", { name: "生成预览" }).click();
    const preview = page.getByRole("region", { name: "导入预览" });
    await expect(preview.getByText("Demo Repair Store", { exact: true })).toBeVisible();
    await expect(preview.getByText("预览明细：当前显示 10 / 101")).toBeVisible();
    await expect(preview.getByText(/页面最多展开前 100 行/)).toBeVisible();
    await expect(preview.getByText("工单 R0000001")).toBeVisible();
    await expectNoPageOverflow(page, "order-data preview 390px");

    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp07-order-data-preview-390x844.png",
      fullPage: true,
    });

    await page.getByRole("link", { name: "返回设置总览" }).first().click();
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toContainText("工单数据文件或导入预览");
    await expect(guard.getByRole("button", { name: "保存并继续" })).toBeDisabled();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("uses a final confirmation and preserves the full partial-result recovery path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeOrderDataPreview(page, previewPayload(1));
    let applyRequests = 0;
    await page.route("**/api/repairdesk/orders/data/import/apply", async (route) => {
      applyRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            batchId: "00000000-0000-0000-0000-000000000020",
            status: "partial",
            applied: 45,
            conflicts: 5,
            failed: 50,
            skipped: 0,
            rows: Array.from({ length: 55 }, (_value, index) => ({
              rowNumber: index + 2,
              status: index < 5 ? "conflict" : "failed",
              errors: [
                {
                  code: index < 5 ? "version_conflict" : "apply_failed",
                  message: index < 5 ? "版本冲突" : "应用失败",
                },
              ],
            })),
          },
        }),
      });
    });
    await gotoReady(page, "/settings?section=order-data");

    await selectWorkbook(page, "orders-partial.xlsx");
    await page.getByRole("button", { name: "生成预览" }).click();
    await page.getByRole("checkbox", { name: /确认这份预览属于/ }).click();
    await page.getByRole("button", { name: "检查并应用" }).click();

    const confirm = page.getByRole("alertdialog", { name: "确认应用工单数据？" });
    await expect(confirm).toContainText("Demo Repair Store");
    await expect(confirm).toContainText("新增行不会自动删除");
    for (const name of ["返回预览", "确认并应用"]) {
      const box = await confirm.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp07-order-data-confirm-1280x800.png",
    });
    await confirm.getByRole("button", { name: "确认并应用" }).click();

    await expect(page.getByText("未应用行：当前显示 50 / 55")).toBeVisible();
    await expect(page.getByRole("button", { name: "下载完整错误报告" })).toBeVisible();
    await expect(page.getByText(/同一批次已锁定，不能重复提交/)).toBeVisible();
    expect(applyRequests).toBe(1);
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
    await expectNoPageOverflow(page, "order-data partial 1280px");
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp07-order-data-partial-1280x800.png",
      fullPage: true,
    });
  });

  test("blocks non-primary-owner capabilities before any order-data request", async ({ page }) => {
    const dataRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/repairdesk\/(orders|customers)\/data\//.test(request.url())) {
        dataRequests.push(request.url());
      }
    });
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: {
          orderDataAccess?: {
            code: string;
            can_export: boolean;
            can_apply: boolean;
          };
          permissions?: Record<string, boolean>;
        };
      };
      payload.data.orderDataAccess = {
        code: "owner_role_required",
        can_export: false,
        can_apply: false,
      };
      payload.data.permissions = {
        ...(payload.data.permissions ?? {}),
        canManageOrderData: false,
        canApplyOrderData: false,
      };
      await route.fulfill({ response, json: payload });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/settings?section=order-data");
    await expect(page.locator('[data-ui="settings-order-data-no-permission"]')).toContainText(
      "其他角色仍可按现有权限处理日常工单",
    );
    const accessState = page.locator('[data-ui="settings-order-data-no-permission"]');
    expect(
      (await accessState.getByRole("link", { name: "返回设置总览" }).boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(250);
    expect(dataRequests).toEqual([]);
  });
});

async function routeOrderDataPreview(page: Page, data: ReturnType<typeof previewPayload>) {
  await page.route("**/api/repairdesk/orders/data/import/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

function previewPayload(rowCount: number) {
  return {
    batchId: "00000000-0000-0000-0000-000000000020",
    storeId: "00000000-0000-0000-0000-000000000001",
    templateVersion: "repairdesk-order-data-v1",
    mode: "update_only",
    expiresAt: "2099-07-14T12:00:00.000Z",
    summary: {
      total: rowCount,
      ready: rowCount,
      create: 0,
      update: rowCount,
      invalid: 0,
      skipped: 0,
    },
    rows: Array.from({ length: rowCount }, (_value, index) => ({
      rowNumber: index + 2,
      action: "update",
      status: "ready",
      orderId: `00000000-0000-0000-1000-${String(index + 1).padStart(12, "0")}`,
      publicNo: `R${String(index + 1).padStart(7, "0")}`,
      changedFields: ["故障描述"],
      warnings: [],
      errors: [],
    })),
  };
}

async function selectWorkbook(page: Page, name: string) {
  await page.locator("#order-data-file").setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("synthetic xlsx fixture"),
  });
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function hideNextDevIndicators(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function expectNoPageOverflow(page: Page, route: string) {
  const overflow = await page.evaluate(() => ({
    pageWidth: window.innerWidth,
    documentWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.scrollingElement?.scrollWidth ?? 0,
    ),
  }));
  expect(
    overflow.documentWidth,
    `${route} overflowed: documentWidth=${overflow.documentWidth}, pageWidth=${overflow.pageWidth}`,
  ).toBeLessThanOrEqual(overflow.pageWidth);
}
