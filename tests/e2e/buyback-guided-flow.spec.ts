import { expect, test, type Page, type Route } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for transparent buyback checks.");

test("a failed buyback request is never presented as an empty list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/repairdesk/inventory/list", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "controlled buyback failure" }),
    });
  });

  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "回收记录加载失败" })).toBeVisible();
  await expect(page.getByText("检查网络后重试。")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844, name: "mobile" },
  { width: 430, height: 932, name: "mobile-wide" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1024, height: 768, name: "desktop-compact" },
  { width: 1440, height: 900, name: "desktop" },
]) {
  test(`owner creates and records a transparent offer at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await useStoreRole(page, "owner");
    await page.setViewportSize(viewport);

    const forbiddenCalls: string[] = [];
    page.on("request", (request) => {
      if (/attachment|finalize|transaction|inventory\/transition/.test(request.url())) {
        forbiddenCalls.push(request.url());
      }
    });

    await page.goto("/buyback", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "回收管理" })).toBeVisible();
    await expect(page.getByText("当前只记录报价与客户口头答复")).toBeVisible();
    await expectNoPageOverflow(page);
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
    await expect(page.getByText(/步骤 \d/)).toHaveCount(0);

    if (viewport.width <= 430) {
      await expectMinimumTouchTarget(page.getByRole("button", { name: "回收扫码查询" }));
      await expectMinimumTouchTarget(page.getByRole("combobox", { name: "筛选回收记录" }));
    }
    await page.getByRole("button", { name: "新建透明报价" }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "新建透明报价" })).toBeVisible();
    await expect(dialog.getByText("一页完成设备录入、价格说明和保存")).toBeVisible();
    await dialog.getByPlaceholder("例如 iPhone 15 Pro").fill(`iPhone 15 ${viewport.width}`);
    await dialog.getByPlaceholder("例如 原色钛金属").fill("原色钛金属");
    await dialog.getByPlaceholder("摄像头扫码或手动输入").fill("356789012345678");
    await dialog.getByPlaceholder("例如 87").fill("87");
    await dialog.getByRole("textbox", { name: "参考最高 €" }).fill("420,50");
    await dialog.getByRole("button", { name: "采用建议" }).click();
    if (viewport.width <= 430) {
      await expectMinimumTouchTarget(dialog.getByRole("button", { name: "采用建议" }));
      await expectMinimumTouchTarget(dialog.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
    }
    await expect(dialog.getByText("系统建议（参考最高 − 扣减）")).toBeVisible();
    await expectSensitiveControlsAbsent(dialog);
    await expectNoPageOverflow(page);

    const workspaceScreenshot = screenshotPath(viewport.name, "workspace");
    if (workspaceScreenshot) {
      await settleDialog(page, dialog);
      await page.screenshot({ path: workspaceScreenshot, fullPage: false });
    }

    await dialog.getByRole("button", { name: "保存透明报价" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(
      page.getByText(`Apple iPhone 15 ${viewport.width}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("356789012345678")).toHaveCount(0);
    await expect(page.getByText(/••••5678/).first()).toBeVisible();

    const listScreenshot = screenshotPath(viewport.name, "list");
    if (listScreenshot) await page.screenshot({ path: listScreenshot, fullPage: false });

    await page.getByText(`Apple iPhone 15 ${viewport.width}`, { exact: true }).click();
    const detail = page.getByRole("dialog");
    await expect(
      detail.getByRole("heading", { name: `Apple iPhone 15 ${viewport.width}` }),
    ).toBeVisible();
    await expect(detail.getByText("价格怎么得出")).toBeVisible();
    await expect(detail.getByText("现场记录客户答复")).toBeVisible();
    await expect(detail.getByText("非签名确认")).toBeVisible();
    await expect(detail.locator('[role="progressbar"]')).toHaveCount(0);
    await expectNoPageOverflow(page);

    const detailScreenshot = screenshotPath(viewport.name, "detail");
    if (detailScreenshot) {
      await settleDialog(page, detail);
      await page.screenshot({ path: detailScreenshot, fullPage: false });
    }

    const response =
      viewport.width === 430
        ? { label: "接受", saved: "已接受" }
        : viewport.width === 1440
          ? { label: "拒绝", saved: "已拒绝" }
          : { label: "暂缓", saved: "暂缓" };
    await detail.getByText(response.label, { exact: true }).click();
    if (response.label === "拒绝") {
      await detail.getByRole("combobox").click();
      await page.getByRole("option", { name: "价格未达预期" }).click();
    }
    await detail.getByRole("button", { name: "保存答复" }).click();
    await expect(detail).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText(response.saved, { exact: true }).first()).toBeVisible();
    expect(forbiddenCalls).toEqual([]);
    await expectNoPageOverflow(page);
  });
}

test("sales cannot revise while technician cannot create or respond", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await useStoreRole(page, "sales");
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectNoPageOverflow(page);
  await page.getByText("Apple iPhone 13", { exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "改价" })).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "关闭" }).last().click();

  await page.unrouteAll({ behavior: "wait" });
  await useStoreRole(page, "technician");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectNoPageOverflow(page);
  await expect(page.getByRole("button", { name: "新建透明报价" })).toBeDisabled();
  await page.getByText("Apple iPhone 13", { exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "保存答复" })).toBeDisabled();
});

test("offline mode stays read-only until the network returns", async ({ context, page }) => {
  await useStoreRole(page, "owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "新建透明报价" }).filter({ visible: true }).click();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/当前处于离线状态/)).toHaveCount(1);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "保存透明报价" }),
  ).toBeDisabled();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/当前处于离线状态/)).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "保存透明报价" }),
  ).toBeEnabled();
});

function screenshotPath(viewport: string, state: string) {
  const root = process.env.REPAIRDESK_E2E_BUYBACK_SCREENSHOT_DIR;
  return root ? `${root}/buyback-transparent-${viewport}-${state}.png` : undefined;
}

async function expectSensitiveControlsAbsent(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.getByText("目标利润", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("维修成本", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("预计毛利", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("付款方式", { exact: true })).toHaveCount(0);
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /拍摄证件|确认签名|完成回收/ })).toHaveCount(0);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function expectMinimumTouchTarget(locator: ReturnType<Page["getByRole"]>) {
  const box = await locator.boundingBox();
  expect(box, "touch target must be visible").not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function settleDialog(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  const scrollArea = dialog.locator(".overflow-y-auto").first();
  if (await scrollArea.count()) {
    await scrollArea.evaluate((element) => {
      if (element instanceof HTMLElement) element.scrollTop = 0;
    });
  }
  await page.waitForTimeout(350);
}

async function useStoreRole(page: Page, role: "owner" | "manager" | "sales" | "technician") {
  const fulfillWithRole = async (route: Route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      data?: {
        activeStore?: { id?: string; role?: string };
        stores?: Array<{ id?: string; role?: string }>;
      };
    };
    if (!body.data) {
      await route.fulfill({ response });
      return;
    }
    const patchContext = <
      T extends {
        activeStore?: { id?: string; role?: string };
        stores?: Array<{ id?: string; role?: string }>;
      },
    >(
      context: T,
    ) => {
      const activeStore = context.activeStore;
      if (!activeStore) return context;
      return {
        ...context,
        activeStore: { ...activeStore, role },
        stores: context.stores?.map((store) =>
          store.id === activeStore.id ? { ...store, role } : store,
        ),
      };
    };
    const data = body.data as typeof body.data & {
      storeContext?: {
        activeStore?: { id?: string; role?: string };
        stores?: Array<{ id?: string; role?: string }>;
      };
    };
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        data: {
          ...patchContext(data),
          storeContext: data.storeContext ? patchContext(data.storeContext) : undefined,
        },
      }),
    });
  };

  await page.route("**/api/repairdesk/onboarding/status", fulfillWithRole);
  await page.route("**/api/repairdesk/stores/context", fulfillWithRole);
  await page.route("**/api/repairdesk/shell/bootstrap", fulfillWithRole);
}
