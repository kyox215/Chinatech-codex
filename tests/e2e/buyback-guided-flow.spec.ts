import { expect, test, type Page, type Route } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for guided buyback checks.");

for (const role of ["owner", "manager", "sales"] as const) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`${role} sees the same four-step quote-only flow at ${viewport.width}px`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await useStoreRole(page, role);
      await page.setViewportSize(viewport);

      let evidenceUploads = 0;
      let finalizeCalls = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/repairdesk/inventory/attachment/upload")) {
          evidenceUploads += 1;
        }
        if (request.url().includes("/api/repairdesk/inventory/buyback/finalize")) {
          finalizeCalls += 1;
        }
      });

      await page.goto("/buyback", { waitUntil: "domcontentloaded" });
      const openFlow = page.getByRole("button", { name: /^(新建回收报价|回收报价)$/ });
      await expect(openFlow).toBeVisible({ timeout: 30_000 });
      await openFlow.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 30_000 });
      await expect(dialog.getByText("回收报价", { exact: true })).toBeVisible();
      await expect(dialog.getByText("资料关闭", { exact: true })).toBeVisible();
      await expect(dialog.getByText("当前只能保存报价与检测", { exact: true })).toBeVisible();
      await expectStep(dialog, 1);
      await expectSensitiveControlsAbsent(dialog);

      await dialog.getByText("iPhone 17", { exact: true }).click();
      await dialog.getByText("128GB", { exact: true }).click();
      await dialog.getByText("85-87%", { exact: true }).click();
      await dialog.getByRole("button", { name: "下一步：查看回收价格" }).click();

      await expectStep(dialog, 2);
      await expect(
        dialog.getByText("这是给客户看的初步口头估价。客户同意后，可继续做功能检测并保存记录。", {
          exact: true,
        }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "客户接受，开始检查手机" }).click();

      await expectStep(dialog, 3);
      await dialog
        .getByPlaceholder("扫描或输入 IMEI / SN")
        .fill(`35678901234${role.length}${viewport.width}`.slice(0, 15));
      await dialog.getByRole("button", { name: "客户可现场解锁设备" }).click();
      await dialog.getByRole("button", { name: "Find My / FRP / 账号锁已关闭" }).click();
      for (let group = 0; group < 4; group += 1) {
        await dialog.getByRole("button", { name: "本组全部正常" }).click();
        if (group < 3) await dialog.getByRole("button", { name: "下一组" }).click();
      }
      await dialog.getByRole("button", { name: "检测完成，进入保存" }).click();

      await expectStep(dialog, 4);
      await expect(dialog.getByText("资料登记暂时关闭", { exact: true })).toBeVisible();
      await expect(
        dialog.getByText("证件号码、证件图片、客户签名或付款记录", { exact: true }),
      ).toBeVisible();
      await expectSensitiveControlsAbsent(dialog);

      const screenshotPath =
        role === "owner"
          ? viewport.width === 390
            ? process.env.REPAIRDESK_E2E_BUYBACK_MOBILE_SCREENSHOT
            : process.env.REPAIRDESK_E2E_BUYBACK_DESKTOP_SCREENSHOT
          : undefined;
      if (screenshotPath) {
        await prepareVisualEvidence(page);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }

      const save = dialog.getByRole("button", { name: "保存报价与检测记录" });
      await expect(save).toBeEnabled();
      await save.click();

      await expect(
        page.getByRole("heading", { name: "报价与检测记录已保存", exact: true }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("本次记录尚未完成回收成交；本次保存未新增证件、签名或付款资料。", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "返回回收列表" })).toBeVisible();
      await expect(page.getByRole("button", { name: "打印回收凭据" })).toHaveCount(0);
      expect(evidenceUploads).toBe(0);
      expect(finalizeCalls).toBe(0);
      await expectNoPageOverflow(page);
    });
  }
}

async function expectSensitiveControlsAbsent(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.getByText("客户姓名", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("WhatsApp / 电话", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("付款方式", { exact: true })).toHaveCount(0);
  await expect(dialog.getByPlaceholder("Document ID")).toHaveCount(0);
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await expect(dialog.locator('canvas[aria-label="客户回收成交签名区域"]')).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /拍摄证件|确认签名|完成回收并转入库存/ }),
  ).toHaveCount(0);
  await expect(dialog.getByText(/负责人继续采集证件与签名|资料已提交负责人/)).toHaveCount(0);
}

async function expectStep(dialog: ReturnType<Page["getByRole"]>, step: number) {
  await expect(dialog.locator(`[aria-label="步骤 ${step} / 4"]`)).toBeVisible();
}

async function prepareVisualEvidence(page: Page) {
  await page.waitForTimeout(250);
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) {
      (portal as HTMLElement).style.display = "none";
    }
  });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function useStoreRole(page: Page, role: "owner" | "manager" | "sales") {
  const fulfillWithRole = async (route: Route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      data?: {
        activeStore?: { id?: string; role?: string };
        stores?: Array<{ id?: string; role?: string }>;
      };
    };
    const activeStore = body.data?.activeStore;
    if (!body.data || !activeStore) {
      await route.fulfill({ response });
      return;
    }
    const activeStoreId = activeStore.id;
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        data: {
          ...body.data,
          activeStore: { ...activeStore, role },
          stores: body.data.stores?.map((store) =>
            store.id === activeStoreId ? { ...store, role } : store,
          ),
        },
      }),
    });
  };

  await page.route("**/api/repairdesk/onboarding/status", fulfillWithRole);
  await page.route("**/api/repairdesk/stores/context", fulfillWithRole);
}
