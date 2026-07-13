import { expect, test, type Page, type Route } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for guided buyback checks.");

test("a first-time user can finish the six-step buyback flow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(buybackScreenshotViewport());
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  const openFlow = page.getByRole("button", { name: /^(新建回收报价|回收报价)$/ });
  await expect(openFlow).toBeVisible({ timeout: 30_000 });
  await openFlow.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText("引导式回收", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "选择 iPhone", exact: true })).toBeVisible();
  await expectStep(dialog, 1);

  await dialog.getByText("iPhone 17", { exact: true }).click();
  await dialog.getByText("128GB", { exact: true }).click();
  await dialog.getByText("85-87%", { exact: true }).click();
  await dialog.getByRole("button", { name: "下一步：查看回收价格" }).click();

  await expectStep(dialog, 2);
  await expect(dialog.getByText("简易估价", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "客户接受，开始检查手机" }).click();

  await expectStep(dialog, 3);
  await dialog.getByPlaceholder("扫描或输入 IMEI / SN").fill("356789012345678");
  await dialog.getByRole("button", { name: "客户可现场解锁设备" }).click();
  await dialog.getByRole("button", { name: "Find My / FRP / 账号锁已关闭" }).click();
  for (let group = 0; group < 4; group += 1) {
    await dialog.getByRole("button", { name: "本组全部正常" }).click();
    if (group < 3) {
      const nextGroup = dialog.getByRole("button", { name: "下一组" });
      await expect(nextGroup).toBeEnabled();
      await nextGroup.click();
    }
  }
  await dialog.getByRole("button", { name: "检测完成，登记卖家" }).click();

  await expectStep(dialog, 4);
  await dialog.getByPlaceholder("Mario Rossi").fill("Mario Demo");
  await dialog.getByPlaceholder("+39 333...").fill("+39 333 000 1234");
  await dialog.getByPlaceholder("Document ID").fill("DEMO1234");
  await dialog.getByRole("button", { name: "卖家确认设备归本人所有，并有权出售" }).click();
  await dialog.getByRole("button", { name: "卖家确认无法提供发票或购买凭证" }).click();
  await dialog.getByRole("button", { name: "卖家确认未提供原装盒" }).click();
  await dialog.getByRole("button", { name: "下一步：拍摄证件" }).click();

  await expectStep(dialog, 5);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  for (const inputId of ["buyback-device_photo", "buyback-id_front", "buyback-id_back"]) {
    await dialog.locator(`#${inputId}`).setInputFiles({
      name: `${inputId}.png`,
      mimeType: "image/png",
      buffer: png,
    });
  }
  await dialog
    .getByRole("button", {
      name: "Il cliente autorizza la cancellazione dei dati dal dispositivo",
    })
    .click();
  await dialog
    .getByRole("button", { name: "Il cliente ha letto e accetta l'informativa privacy" })
    .click();
  await dialog
    .getByRole("button", {
      name: "Il cliente conferma la vendita alle condizioni sopra indicate",
    })
    .click();

  const canvas = dialog.locator('canvas[aria-label="客户回收成交签名区域"]');
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeInViewport();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Signature canvas is not visible");
  await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.32, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.36, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.62, { steps: 5 });
  await page.mouse.up();
  await expect(dialog.getByRole("button", { name: "Cancella", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "确认签名" })).toBeEnabled();
  const evidenceScreenshotPath = process.env.REPAIRDESK_E2E_BUYBACK_EVIDENCE_SCREENSHOT;
  if (evidenceScreenshotPath) {
    await dialog
      .getByText("Informativa e condizioni da firmare", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidenceScreenshotPath, fullPage: false });
    await canvas.scrollIntoViewIfNeeded();
  }
  await dialog.getByRole("button", { name: "确认签名" }).click();

  await expectStep(dialog, 6);
  await expect(dialog.getByRole("heading", { name: "最后确认", exact: true })).toBeVisible();
  const finish = dialog.getByRole("button", { name: /完成回收并转入库存/ });
  await expect(finish).toBeEnabled();
  await finish.click();

  await expect(page.getByRole("heading", { name: "回收成交完成", exact: true })).toBeVisible();
  await expect(page.getByText("付款、协议与库存记录已一次写入", { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  const screenshotPath = process.env.REPAIRDESK_E2E_BUYBACK_SCREENSHOT;
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: false });
});

test("an owner can reopen a deferred quote, bind the seller and finalize it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "新建回收报价" }).click();

  let dialog = page.getByRole("dialog");
  await dialog.getByText("iPhone 17", { exact: true }).click();
  await dialog.getByText("128GB", { exact: true }).click();
  await dialog.getByText("85-87%", { exact: true }).click();
  await dialog.getByRole("button", { name: "下一步：查看回收价格" }).click();
  await dialog.getByRole("button", { name: "保存考虑中" }).click();
  await expect(dialog).toBeHidden();

  const deferredCard = page
    .getByRole("button", { name: /查看回收记录/ })
    .filter({ hasText: "iPhone 17" })
    .first();
  await expect(deferredCard).toBeVisible({ timeout: 30_000 });
  await deferredCard.click();
  const recordSheet = page.getByRole("dialog");
  await expect(recordSheet.getByText("回收记录", { exact: true })).toBeVisible();
  await recordSheet.getByRole("button", { name: /复估/ }).click();

  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("引导式回收", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "下一步：查看回收价格" }).click();
  await dialog.getByRole("button", { name: "客户接受，开始检查手机" }).click();
  await dialog.getByPlaceholder("扫描或输入 IMEI / SN").fill("356789012345680");
  await dialog.getByRole("button", { name: "客户可现场解锁设备" }).click();
  await dialog.getByRole("button", { name: "Find My / FRP / 账号锁已关闭" }).click();
  for (let group = 0; group < 4; group += 1) {
    await dialog.getByRole("button", { name: "本组全部正常" }).click();
    if (group < 3) await dialog.getByRole("button", { name: "下一组" }).click();
  }
  await dialog.getByRole("button", { name: "检测完成，登记卖家" }).click();
  await dialog.getByPlaceholder("Mario Rossi").fill("Deferred Owner Demo");
  await dialog.getByPlaceholder("+39 333...").fill("+39 333 000 5680");
  await dialog.getByPlaceholder("Document ID").fill("DEFER5680");
  await dialog.getByRole("button", { name: "卖家确认设备归本人所有，并有权出售" }).click();
  await dialog.getByRole("button", { name: "卖家确认无法提供发票或购买凭证" }).click();
  await dialog.getByRole("button", { name: "卖家确认未提供原装盒" }).click();
  await dialog.getByRole("button", { name: "下一步：拍摄证件" }).click();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  for (const inputId of ["buyback-device_photo", "buyback-id_front", "buyback-id_back"]) {
    await dialog.locator(`#${inputId}`).setInputFiles({
      name: `${inputId}.png`,
      mimeType: "image/png",
      buffer: png,
    });
  }
  await dialog
    .getByRole("button", {
      name: "Il cliente autorizza la cancellazione dei dati dal dispositivo",
    })
    .click();
  await dialog
    .getByRole("button", { name: "Il cliente ha letto e accetta l'informativa privacy" })
    .click();
  await dialog
    .getByRole("button", {
      name: "Il cliente conferma la vendita alle condizioni sopra indicate",
    })
    .click();
  const canvas = dialog.locator('canvas[aria-label="客户回收成交签名区域"]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Signature canvas is not visible");
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "确认签名" }).click();
  await dialog.getByRole("button", { name: /完成回收并转入库存/ }).click();

  await expect(page.getByRole("heading", { name: "回收成交完成", exact: true })).toBeVisible();
  await expect(page.getByText("付款、协议与库存记录已一次写入", { exact: true })).toBeVisible();
});

test("sales can submit a reviewed quote without seeing or uploading identity evidence", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await useStoreRole(page, "sales");
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "新建回收报价" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByText("iPhone 17", { exact: true }).click();
  await dialog.getByText("128GB", { exact: true }).click();
  await dialog.getByText("85-87%", { exact: true }).click();
  await dialog.getByRole("button", { name: "下一步：查看回收价格" }).click();
  await dialog.getByRole("button", { name: "客户接受，开始检查手机" }).click();

  await dialog.getByPlaceholder("扫描或输入 IMEI / SN").fill("356789012345679");
  await dialog.getByRole("button", { name: "客户可现场解锁设备" }).click();
  await dialog.getByRole("button", { name: "Find My / FRP / 账号锁已关闭" }).click();
  for (let group = 0; group < 4; group += 1) {
    await dialog.getByRole("button", { name: "本组全部正常" }).click();
    if (group < 3) await dialog.getByRole("button", { name: "下一组" }).click();
  }
  await dialog.getByRole("button", { name: "检测完成，登记卖家" }).click();

  await expectStep(dialog, 4);
  await expect(dialog.getByPlaceholder("Document ID")).toHaveCount(0);
  await expect(
    dialog.getByText("证件、签名与付款由店主或店长接手采集。", { exact: false }),
  ).toBeVisible();
  await dialog.getByPlaceholder("Mario Rossi").fill("Sales Review Demo");
  await dialog.getByPlaceholder("+39 333...").fill("+39 333 000 5678");
  await dialog.getByRole("button", { name: "卖家确认设备归本人所有，并有权出售" }).click();
  await dialog.getByRole("button", { name: "卖家确认无法提供发票或购买凭证" }).click();
  await dialog.getByRole("button", { name: "卖家确认未提供原装盒" }).click();

  const submit = dialog.getByRole("button", { name: "提交负责人继续回收" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("heading", { name: "资料已提交负责人", exact: true })).toBeVisible();
  await expect(page.getByText("负责人登记证件、签名并确认成交", { exact: true })).toBeVisible();
  expect(evidenceUploads).toBe(0);
  expect(finalizeCalls).toBe(0);
});

async function expectStep(dialog: ReturnType<Page["getByRole"]>, step: number) {
  await expect(dialog.locator(`[aria-label="步骤 ${step} / 6"]`)).toBeVisible();
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
    const activeStoreId = activeStore?.id;
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        data: {
          ...body.data,
          activeStore: activeStore ? { ...activeStore, role } : activeStore,
          stores: body.data?.stores?.map((store) =>
            store.id === activeStoreId ? { ...store, role } : store,
          ),
        },
      }),
    });
  };

  await page.route("**/api/repairdesk/onboarding/status", fulfillWithRole);
  await page.route("**/api/repairdesk/stores/context", fulfillWithRole);
}

function buybackScreenshotViewport() {
  const width = Number(process.env.REPAIRDESK_E2E_BUYBACK_VIEWPORT_WIDTH ?? 390);
  const height = Number(process.env.REPAIRDESK_E2E_BUYBACK_VIEWPORT_HEIGHT ?? 844);
  return {
    width: Number.isFinite(width) && width >= 320 ? Math.round(width) : 390,
    height: Number.isFinite(height) && height >= 600 ? Math.round(height) : 844,
  };
}
