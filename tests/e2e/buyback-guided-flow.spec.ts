import { expect, test, type Page, type Route } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const cleanScreenshotStyle = "nextjs-portal,[data-sonner-toast]{display:none!important}";

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

test("loading, true-empty, and filtered-empty states are distinguishable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseList: (() => void) | undefined;
  const listReleased = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  await page.route("**/api/repairdesk/inventory/list", async (route) => {
    await listReleased;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
  const navigation = page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".animate-pulse")).toHaveCount(6);
  releaseList?.();
  await navigation;
  await expect(page.getByRole("heading", { name: "还没有透明报价" })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.reload({ waitUntil: "domcontentloaded" });
  const search = page.getByPlaceholder("搜索回收单或设备");
  await search.fill("绝对不存在的设备");
  await expect(page.getByRole("heading", { name: "没有符合条件的记录" })).toBeVisible();
});

for (const viewport of [
  { width: 360, height: 780, name: "mobile-small" },
  { width: 390, height: 844, name: "mobile" },
  { width: 430, height: 932, name: "mobile-wide" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1024, height: 768, name: "desktop-compact" },
  { width: 1440, height: 900, name: "desktop" },
]) {
  test(`owner creates and records a transparent offer at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await useStoreRole(page, "owner");
    await page.setViewportSize(viewport);

    const forbiddenCalls: string[] = [];
    page.on("request", (request) => {
      if (
        /attachment|finalize|payment|signature|transaction|inventory\/(?:intake\/create|update|transition|products|v2)|buyback\/update/.test(
          request.url(),
        )
      ) {
        forbiddenCalls.push(request.url());
      }
    });

    await page.goto("/buyback", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "回收管理" })).toBeVisible();
    await expect(page.getByText("当前只记录报价与客户口头答复")).toBeVisible();
    await expect(page.getByRole("region", { name: "回收报价概览" })).toBeVisible();
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
    await expectNoDialogOverflow(dialog);
    await dialog.getByPlaceholder("例如 iPhone 15 Pro").fill(`iPhone 15 ${viewport.width}`);
    await dialog.getByPlaceholder("例如 原色钛金属").fill("原色钛金属");
    await dialog.getByPlaceholder("摄像头扫码或手动输入").fill("356789012345678");
    await dialog.getByPlaceholder("例如 87").fill("87");
    await dialog.getByRole("textbox", { name: "参考最高 €" }).fill("420,50");
    await dialog.getByRole("button", { name: "采用建议" }).click();
    if (viewport.width <= 430) {
      await expectMinimumTouchTarget(dialog.getByRole("button", { name: "采用建议" }));
      await expectMinimumTouchTarget(dialog.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await expectAllPrimaryTouchTargets(dialog);
      await expectAllEditableInputsAtLeast16(dialog);
    }
    await expect(dialog.getByText("系统建议（参考最高 − 扣减）")).toBeVisible();
    await expectSensitiveControlsAbsent(dialog);
    await expectNoPageOverflow(page);

    const workspaceScreenshot = screenshotPath(testInfo.project.name, viewport.name, "workspace");
    if (workspaceScreenshot) {
      await settleDialog(page, dialog);
      await page.screenshot({
        path: workspaceScreenshot,
        fullPage: false,
        style: cleanScreenshotStyle,
      });
    }
    await expectFooterDoesNotCoverContent(dialog, "workspace");

    await dialog.getByRole("button", { name: "保存透明报价" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(
      page.getByText(`Apple iPhone 15 ${viewport.width}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("356789012345678")).toHaveCount(0);
    await expect(page.getByText(/••••5678/).first()).toBeVisible();

    const listScreenshot = screenshotPath(testInfo.project.name, viewport.name, "list");
    if (listScreenshot) {
      await page.screenshot({
        path: listScreenshot,
        fullPage: false,
        style: cleanScreenshotStyle,
      });
    }

    await page.getByText(`Apple iPhone 15 ${viewport.width}`, { exact: true }).click();
    const detail = page.getByRole("dialog");
    await expect(
      detail.getByRole("heading", { name: `Apple iPhone 15 ${viewport.width}` }),
    ).toBeVisible();
    await expect(detail.getByText("价格怎么得出")).toBeVisible();
    await expect(detail.getByText("现场记录客户答复")).toBeVisible();
    await expect(detail.getByText("非签名确认")).toBeVisible();
    await expect(detail.getByText("系统建议", { exact: true })).toBeVisible();
    await expect(detail.getByText("人工差额", { exact: true })).toBeVisible();
    await expect(detail.getByText("风险 / 有效期", { exact: true })).toBeVisible();
    await expect(detail.getByText("仅记录客户口头答复，不付款、不成交、不入库。")).toBeVisible();
    await expect(detail.getByText(/最近报价：V1/)).toBeVisible();
    await expect(detail.locator('[role="progressbar"]')).toHaveCount(0);
    await expect(detail.getByRole("button", { name: /最近报价记录/ })).toBeVisible();
    await expectNoDialogOverflow(detail);
    await expectNoPageOverflow(page);
    await expectFooterDoesNotCoverContent(detail, "detail");
    if (viewport.width <= 430) {
      await expectAllPrimaryTouchTargets(detail);
      await expectAllEditableInputsAtLeast16(detail);
    }

    const detailScreenshot = screenshotPath(testInfo.project.name, viewport.name, "detail");
    if (detailScreenshot) {
      await settleDialog(page, detail);
      await page.screenshot({
        path: detailScreenshot,
        fullPage: false,
        style: cleanScreenshotStyle,
      });
    }

    const response =
      viewport.width === 430
        ? { label: "接受报价", saved: "已接受" }
        : viewport.width === 1440
          ? { label: "拒绝", saved: "已拒绝" }
          : { label: "暂缓", saved: "暂缓" };
    await detail.getByText(response.label, { exact: true }).click();
    if (response.label === "拒绝") {
      await detail.getByRole("combobox").click();
      await page.getByRole("option", { name: "价格未达预期" }).click();
    }
    await detail.getByRole("button", { name: /保存/ }).click();
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
  await expect(page.getByText("改价需负责人权限")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "关闭" }).last().click();

  await page.unrouteAll({ behavior: "wait" });
  await useStoreRole(page, "technician");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectNoPageOverflow(page);
  await expect(page.getByRole("button", { name: "新建透明报价" })).toBeDisabled();
  await expect(page.getByText(/当前角色为只读/)).toBeVisible();
  await page.getByText("Apple iPhone 13", { exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /保存答复/ })).toBeDisabled();
  await expect(page.getByText("当前角色只读：不能记录答复")).toBeVisible();
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

test("a 409 response keeps the selected outcome and note until the latest quote is refreshed", async ({
  page,
}) => {
  await useStoreRole(page, "owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/buyback/quote/respond", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "回收记录已被其他人更新，请刷新后重试" }),
    });
  });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "新建透明报价" }).filter({ visible: true }).click();
  const workspace = page.getByRole("dialog");
  await workspace.getByPlaceholder("例如 iPhone 15 Pro").fill("iPhone 15 冲突草稿验证");
  await workspace.getByRole("button", { name: "保存透明报价" }).click();
  await expect(workspace).toBeHidden();
  await page.getByText("Apple iPhone 15 冲突草稿验证", { exact: true }).click();
  const detail = page.getByRole("dialog");
  await detail.getByText("暂缓", { exact: true }).click();
  await detail.getByRole("button", { name: "添加现场备注（可选）" }).click();
  const note = detail.getByPlaceholder("可选备注（不要填写证件号或完整电话）");
  await note.fill("客户需要回家确认，明天下午再联系。");
  await detail.getByRole("button", { name: "保存暂缓" }).click();
  await expect(detail.getByRole("alert")).toContainText("当前选择和备注已保留");
  await expect(detail.getByRole("alert")).toContainText("请刷新后重试");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "刷新最新报价" }).click();
  await expect(note).toHaveValue("客户需要回家确认，明天下午再联系。");
  await expect(detail.getByRole("radio", { name: "暂缓" })).toBeChecked();
});

for (const width of [360, 390, 430, 768, 1024, 1440]) {
  test(`long content remains readable without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await useStoreRole(page, "owner");
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.route("**/api/repairdesk/inventory/list", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
      const item = payload.data?.find((candidate) => candidate.source_type === "buyback");
      if (item) {
        const legacy = (item.legacy_payload ?? {}) as Record<string, unknown>;
        const quote = (legacy.buyback_quote ?? {}) as Record<string, unknown>;
        item.model = "iPhone 15 Pro Max 超长演示型号（门店特别备注版）";
        item.item_label = "Apple iPhone 15 Pro Max 超长演示型号（门店特别备注版）";
        legacy.buyback_quote = {
          ...quote,
          deductions: Array.from({ length: 10 }, (_, index) => ({
            code: `long-${index}`,
            label: `第 ${index + 1} 项很长的检测扣减说明，用于验证手机端自动换行`,
            amount: index + 1,
          })),
          manual_adjustment_reason:
            "现场检测后发现多项外观与功能问题，已向客户逐项解释并记录人工调整原因。",
        };
      }
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });
    await page.goto("/buyback", { waitUntil: "domcontentloaded" });
    await expectNoPageOverflow(page);
    await page
      .getByText(/Apple iPhone 15 Pro Max 超长演示型号/)
      .first()
      .click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: /查看全部 10 项扣减/ }).click();
    await detail.getByRole("button", { name: "添加现场备注（可选）" }).click();
    await detail
      .getByPlaceholder("可选备注（不要填写证件号或完整电话）")
      .fill("这是一段用于验证紧凑页面布局的现场备注。".repeat(10).slice(0, 240));
    await expectNoDialogOverflow(detail);
    await expectNoPageOverflow(page);
    await expectFooterDoesNotCoverContent(detail, "detail");
  });
}

test("creating a buyback quote does not change the product inventory collection", async ({
  page,
}) => {
  await useStoreRole(page, "owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  const before = await readProductInventorySnapshot(page);
  await page.getByRole("button", { name: "新建透明报价" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("例如 iPhone 15 Pro").fill("iPhone 14 隔离验证");
  await dialog.getByRole("button", { name: "保存透明报价" }).click();
  await expect(dialog).toBeHidden();
  const after = await readProductInventorySnapshot(page);
  expect(after).toEqual(before);
});

test("history permission failures stay local and do not reveal response data", async ({ page }) => {
  await useStoreRole(page, "technician");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/buyback/quote/history", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "无权查看报价历史" }),
    });
  });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await page.getByText("Apple iPhone 13", { exact: true }).first().click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("历史暂时无法加载，展开后可重试。")).toBeVisible();
  await detail.getByRole("button", { name: /最近报价记录/ }).click();
  await expect(detail.getByText("报价历史加载失败。")).toBeVisible();
  await expect(detail.getByText(/演示员工/)).toHaveCount(0);
  await expect(detail.getByRole("button", { name: /保存答复/ })).toBeDisabled();
});

function screenshotPath(project: string, viewport: string, state: string) {
  const root = process.env.REPAIRDESK_E2E_BUYBACK_SCREENSHOT_DIR;
  return root ? `${root}/buyback-transparent-${project}-${viewport}-${state}.png` : undefined;
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

async function expectNoDialogOverflow(dialog: ReturnType<Page["getByRole"]>) {
  const dimensions = await dialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectInputFontAtLeast16(locator: ReturnType<Page["getByRole"]>) {
  const fontSize = await locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(16);
}

async function expectAllEditableInputsAtLeast16(dialog: ReturnType<Page["getByRole"]>) {
  const editable = dialog.locator("input:visible, textarea:visible");
  for (let index = 0; index < (await editable.count()); index += 1) {
    await expectInputFontAtLeast16(editable.nth(index));
  }
}

async function expectMinimumTouchTarget(locator: ReturnType<Page["getByRole"]>) {
  const box = await locator.boundingBox();
  expect(box, "touch target must be visible").not.toBeNull();
  // Dense workflow controls use the 32px semantic tier; risky actions remain larger.
  expect(box!.width).toBeGreaterThanOrEqual(31.9);
  expect(box!.height).toBeGreaterThanOrEqual(31.9);
}

async function expectAllPrimaryTouchTargets(dialog: ReturnType<Page["getByRole"]>) {
  const controls = dialog.locator(
    'button:visible:not([role="radio"]), [role="combobox"]:visible, input:visible, textarea:visible',
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    await expectMinimumTouchTarget(controls.nth(index));
  }
  const choices = dialog.locator('[role="radio"]:visible');
  for (let index = 0; index < (await choices.count()); index += 1) {
    const label = choices.nth(index).locator("xpath=ancestor::label[1]");
    await expectMinimumTouchTarget(label);
  }
}

async function expectFooterDoesNotCoverContent(
  dialog: ReturnType<Page["getByRole"]>,
  kind: "detail" | "workspace",
) {
  const scrollArea = dialog.locator(".overflow-y-auto").first();
  await scrollArea.evaluate((element) => {
    if (element instanceof HTMLElement) element.scrollTop = element.scrollHeight;
  });
  const geometry = await dialog.evaluate((element, footerKind) => {
    const footer = element.querySelector(`[data-buyback-fixed-footer="${footerKind}"]`);
    const scroller = element.querySelector(".overflow-y-auto");
    const lastContent = scroller?.lastElementChild;
    return {
      footerTop: footer?.getBoundingClientRect().top ?? 0,
      contentBottom: lastContent?.getBoundingClientRect().bottom ?? 0,
    };
  }, kind);
  expect(geometry.contentBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
}

async function readProductInventorySnapshot(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/repairdesk/inventory/products/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error(`product inventory snapshot failed: ${response.status}`);
    const payload = (await response.json()) as { data?: unknown };
    return JSON.stringify(payload.data ?? null);
  });
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
