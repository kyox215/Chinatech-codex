import { Buffer } from "node:buffer";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  inventoryLocalImeiValue,
  makeInventoryLocalLabelFile,
} from "./support/inventory-local-label-file";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = process.env.AI_ASSISTANT_EVIDENCE_DIR;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for AI inventory checks.");

test.describe("AI inventory intake remains an editable unsaved draft", () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}px recognizes a synthetic label without overflow or inventory writes`, async ({
      page,
    }) => {
      await installSyntheticLocalDetectors(page);
      await installInventoryCreateCounter(page);
      await installVisionRequestCounter(page);
      await page.setViewportSize(viewport);
      await gotoReady(page, "/inventory");
      await expectVisionCapability(page);
      let dialog = await openInventoryIntakeWithAi(page);
      await dialog.getByRole("button", { name: "拍照识别" }).click();
      dialog = page.getByRole("dialog", { name: "AI 拍照识别入库资料" });
      await expect(dialog.getByRole("button", { name: "拍摄标签" })).toBeFocused();

      await dialog.getByLabel("从相册选择设备标签照片").setInputFiles({
        name: "synthetic-redmi-a7-pro-box.png",
        mimeType: "image/png",
        buffer: await createSyntheticPng(page),
      });

      await expect(dialog.getByLabel("型号识别值")).toHaveValue("A7 Pro", { timeout: 20_000 });
      await expect(dialog.getByText("仅为包装标签声称值")).toBeVisible();
      await expect(dialog.getByText(/本次未上传至云端视觉服务/)).toBeVisible();
      expect(await visionRequestCount(page)).toBe(0);
      await expectDialogFits(dialog, viewport.width, viewport.height);
      await expectNoHorizontalOverflow(page);
      await saveEvidence(page, `phase3a-ai-inventory-local-${viewport.width}-review.png`);

      if (viewport.width === 1280) {
        await dialog.getByRole("button", { name: "品牌：接受建议" }).click();
        await dialog.getByRole("button", { name: "型号：接受建议" }).click();
        await dialog.getByRole("button", { name: "颜色：接受建议" }).click();
        await dialog.getByRole("button", { name: "存储容量：接受建议" }).click();
        await dialog.getByRole("button", { name: "IMEI 1：接受建议" }).click();
        await dialog.getByRole("radio", { name: "作为当前表单的主 IMEI / 序列号" }).click();
        await dialog.getByRole("button", { name: /应用 \d+ 个确认字段/ }).click();

        dialog = page.getByRole("dialog", { name: "新增库存商品" });
        await expect(dialog.getByLabel(/品牌/)).toHaveValue("Redmi");
        await expect(dialog.getByLabel(/型号/)).toHaveValue("A7 Pro");
        await expect(dialog.getByLabel("容量")).toHaveValue("64 GB");
        await expect(dialog.getByLabel("IMEI/序列号")).toHaveValue("990000000000002");
        await expect(dialog.getByLabel("入库成本")).toHaveValue("");
        await expect(dialog.getByLabel("标价")).toHaveValue("");
        expect(await inventoryCreateRequestCount(page)).toBe(0);
        await saveEvidence(page, "phase3a-ai-inventory-1280-applied-unsaved.png", [
          dialog.getByLabel("IMEI/序列号"),
        ]);
      }
    });
  }

  test("cancel aborts the vision request and offline mode never queues a photo", async ({
    page,
  }) => {
    await installIncompleteLocalDetectors(page);
    await page.addInitScript(() => {
      const testWindow = window as typeof window & { __visionRequestCount?: number };
      const originalFetch = window.fetch.bind(window);
      testWindow.__visionRequestCount = 0;
      window.fetch = (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (new URL(url, window.location.origin).pathname.endsWith("/ai/vision/extract")) {
          testWindow.__visionRequestCount = (testWindow.__visionRequestCount ?? 0) + 1;
          return new Promise<Response>((_resolve, reject) => {
            const abort = () => reject(new DOMException("Aborted", "AbortError"));
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener("abort", abort, { once: true });
          });
        }
        return originalFetch(input, init);
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/inventory");
    await expectVisionCapability(page);
    const intakeDialog = await openInventoryIntakeWithAi(page);
    await intakeDialog.getByRole("button", { name: "拍照识别" }).click();
    const dialog = page.getByRole("dialog", { name: "AI 拍照识别入库资料" });
    await dialog.getByLabel("从相册选择设备标签照片").setInputFiles({
      name: "synthetic-redmi-a7-pro-box.png",
      mimeType: "image/png",
      buffer: await createSyntheticPng(page),
    });
    await expect(dialog.getByText("第 3/3 步：正在请求云端识别包装规格…")).toBeVisible();
    await dialog.getByRole("button", { name: "取消识别" }).click();
    await expect(dialog.getByText(/已取消识别，照片不会排队上传/)).toBeVisible();
    const countAfterCancel = await visionRequestCount(page);

    await page.context().setOffline(true);
    await expect(dialog.getByText(/当前离线，不会排队上传敏感照片/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "拍摄标签" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "选择照片" })).toBeDisabled();
    await page.waitForTimeout(150);
    expect(await visionRequestCount(page)).toBe(countAfterCancel);
  });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`${viewport.width}px falls back to mocked cloud vision and still requires an unsaved human draft`, async ({
      page,
    }) => {
      await installIncompleteLocalDetectors(page);
      await installInventoryCreateCounter(page);
      await installMockCloudVision(page);
      await page.setViewportSize(viewport);
      await gotoReady(page, "/inventory");
      await expectVisionCapability(page);
      const intakeDialog = await openInventoryIntakeWithAi(page);
      await intakeDialog.getByRole("button", { name: "拍照识别" }).click();
      let dialog = page.getByRole("dialog", { name: "AI 拍照识别入库资料" });

      await dialog.getByLabel("从相册选择设备标签照片").setInputFiles({
        name: "synthetic-cloud-fallback-label.png",
        mimeType: "image/png",
        buffer: await createSyntheticPng(page),
      });

      await expect(dialog.getByLabel("型号识别值")).toHaveValue("A7 Pro", {
        timeout: 20_000,
      });
      await expect(dialog.getByText("云端规格候选，必须人工核对。")).toBeVisible();
      await expect(dialog.getByText(/未识别到可用 IMEI、序列号或 EAN/)).toBeVisible();
      expect(await visionRequestCount(page)).toBe(1);

      const request = await lastVisionRequestPayload(page);
      expect(request).toMatchObject({
        mime_type: "image/jpeg",
        locale: "zh-CN",
      });
      expect(request.client_request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(request.image_data_url).toMatch(/^data:image\/jpeg;base64,/);
      expect(request).not.toHaveProperty("store_id");
      await expectDialogFits(dialog, viewport.width, viewport.height);
      await expectNoHorizontalOverflow(page);
      await saveEvidence(page, `ai-inventory-cloud-${viewport.width}-review.png`);

      await dialog.getByRole("button", { name: "品牌：接受建议" }).click();
      await dialog.getByRole("button", { name: "型号：接受建议" }).click();
      await dialog.getByRole("button", { name: "颜色：接受建议" }).click();
      await dialog.getByRole("button", { name: "存储容量：接受建议" }).click();
      await dialog.getByRole("button", { name: /应用 \d+ 个确认字段/ }).click();

      dialog = page.getByRole("dialog", { name: "新增库存商品" });
      await expect(dialog.getByLabel(/品牌/)).toHaveValue("Redmi");
      await expect(dialog.getByLabel(/型号/)).toHaveValue("A7 Pro");
      await expect(dialog.getByLabel("容量")).toHaveValue("256 GB");
      await expect(dialog.getByLabel("IMEI/序列号")).toHaveValue("");
      await expect(dialog.getByLabel("入库成本")).toHaveValue("");
      await expect(dialog.getByLabel("标价")).toHaveValue("");
      expect(await inventoryCreateRequestCount(page)).toBe(0);
      await saveEvidence(page, `ai-inventory-cloud-${viewport.width}-applied-unsaved.png`);
    });
  }
});

test.describe("inventory V2 inline Vision flow remains bounded and optional", () => {
  test("iPhone-compatible workers read one real synthetic label with same-origin assets only", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      Object.defineProperty(window, "BarcodeDetector", { configurable: true, value: undefined });
      Object.defineProperty(window, "TextDetector", { configurable: true, value: undefined });
    });
    await installInventoryCreateCounter(page);
    await installVisionRequestCounter(page);
    const assetRequests: string[] = [];
    const forbiddenExternalOcrRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/vendor/tesseract/v7.0.0/")) assetRequests.push(url);
      if (/jsdelivr|projectnaptha|tessdata/i.test(new URL(url).hostname)) {
        forbiddenExternalOcrRequests.push(url);
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoV2VisionStep(page);

    await page.getByLabel("选择图片").setInputFiles(await makeInventoryLocalLabelFile());

    await expect(page.getByText(/完整标签未上传/)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(new RegExp(`•${inventoryLocalImeiValue.slice(-4)}$`)),
    ).toBeVisible();
    expect(await visionRequestCount(page)).toBe(0);
    expect(await inventoryCreateRequestCount(page)).toBe(0);
    expect(assetRequests.some((url) => url.endsWith("/worker.min.js"))).toBe(true);
    expect(assetRequests.some((url) => url.endsWith("/eng.traineddata.gz"))).toBe(true);
    expect(forbiddenExternalOcrRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await saveEvidence(page, "vision-v2-390-real-worker-local-only.png");
  });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`${viewport.width}px gets specifications and a masked IMEI from one local-only photo`, async ({
      page,
    }) => {
      await installSyntheticLocalDetectors(page);
      await installInventoryCreateCounter(page);
      await installVisionRequestCounter(page);
      await page.setViewportSize(viewport);
      await gotoV2VisionStep(page);

      await page.getByLabel("选择图片").setInputFiles({
        name: "synthetic-v2-local-label.png",
        mimeType: "image/png",
        buffer: await createSyntheticPng(page),
      });

      await expect(page.getByText(/完整标签未上传/)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/•0002$/)).toBeVisible();
      expect(await visionRequestCount(page)).toBe(0);
      expect(await inventoryCreateRequestCount(page)).toBe(0);
      await expectNoHorizontalOverflow(page);
      await saveEvidence(page, `vision-v2-${viewport.width}-local-spec-imei-review.png`);

      await page.getByRole("button", { name: "确认并应用所选候选" }).click();
      await visibleNextButton(page).click();
      await expect(page.getByRole("heading", { name: "填写型号与唯一标识" })).toBeVisible();
      await expect(page.getByPlaceholder("iPhone 15 Pro")).toHaveValue("A7 Pro");
      await expect(page.getByPlaceholder("扫描或输入").first()).toHaveValue("990000000000002");
      expect(await inventoryCreateRequestCount(page)).toBe(0);
    });
  }

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`${viewport.width}px completes one mocked cloud fallback without creating inventory`, async ({
      page,
    }) => {
      await installIncompleteLocalDetectors(page);
      await installInventoryCreateCounter(page);
      await installMockCloudVision(page, 500);
      await page.setViewportSize(viewport);
      await gotoV2VisionStep(page);

      await page.getByLabel("选择图片").setInputFiles({
        name: "synthetic-v2-cloud-label.png",
        mimeType: "image/png",
        buffer: await createSyntheticPng(page),
      });

      await expect(page.getByText(/请调整并预览只含规格的裁剪/)).toBeVisible();
      await expect(visibleNextButton(page)).toBeEnabled();
      expect(await visionRequestCount(page)).toBe(0);
      await page.getByRole("button", { name: "生成发送预览" }).click();
      await expect(page.getByAltText("将发送给 AI 的规格裁剪预览")).toBeVisible();
      expect(await visionRequestCount(page)).toBe(0);
      await page.getByLabel(/我已检查/).check();
      await page.getByRole("button", { name: "确认并识别规格" }).click();
      await expect(page.getByText(/正在发送已确认的规格裁剪/)).toBeVisible();
      await expect(page.getByText(/规格裁剪与本地标识候选已合并/)).toBeVisible({
        timeout: 20_000,
      });
      expect(await visionRequestCount(page)).toBe(1);
      expect(await inventoryCreateRequestCount(page)).toBe(0);

      const request = await lastVisionRequestPayload(page);
      expect(request).toMatchObject({ mime_type: "image/jpeg", locale: "zh-CN" });
      expect(request.client_request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(request.image_data_url).toMatch(/^data:image\/jpeg;base64,/);
      expect(request.width).toBeLessThan(64);
      expect(request.height).toBeLessThan(32);
      expect(request).not.toHaveProperty("store_id");
      expect(request).not.toHaveProperty("identifiers");
      await expectNoHorizontalOverflow(page);
      await saveEvidence(page, `vision-v2-${viewport.width}-cloud-ready.png`);

      await page.getByRole("button", { name: "确认并应用所选候选" }).click();
      await expect(page.getByText(/已把人工确认的候选带入草稿，尚未入库/)).toBeVisible();
      await visibleNextButton(page).click();
      await expect(page.getByRole("heading", { name: "填写型号与唯一标识" })).toBeVisible();
      await expect(page.getByPlaceholder("Apple")).toHaveValue("Redmi");
      await expect(page.getByPlaceholder("iPhone 15 Pro")).toHaveValue("A7 Pro");
      await expect(page.getByPlaceholder("256 GB")).toHaveValue("256 GB");
      expect(await inventoryCreateRequestCount(page)).toBe(0);
      await expectNoHorizontalOverflow(page);
      await saveEvidence(page, `vision-v2-${viewport.width}-applied-unsaved.png`);
    });
  }

  test("390px can leave a pending Vision request for the manual next step", async ({ page }) => {
    await installIncompleteLocalDetectors(page);
    await installInventoryCreateCounter(page);
    await installHangingCloudVision(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoV2VisionStep(page);

    await page.getByLabel("选择图片").setInputFiles({
      name: "synthetic-v2-manual-fallback.png",
      mimeType: "image/png",
      buffer: await createSyntheticPng(page),
    });
    await expect(page.getByText(/请调整并预览只含规格的裁剪/)).toBeVisible();
    await page.getByRole("button", { name: "生成发送预览" }).click();
    await page.getByLabel(/我已检查/).check();
    await page.getByRole("button", { name: "确认并识别规格" }).click();
    await expect(page.getByText(/正在发送已确认的规格裁剪/)).toBeVisible();
    expect(await visionRequestCount(page)).toBe(1);
    await visibleNextButton(page).click();

    await expect(page.getByRole("heading", { name: "填写型号与唯一标识" })).toBeVisible();
    await expect(page.getByPlaceholder("Apple")).toBeVisible();
    await page.waitForTimeout(150);
    expect(await visionRequestCount(page)).toBe(1);
    expect(await inventoryCreateRequestCount(page)).toBe(0);
    await expectNoHorizontalOverflow(page);
    await saveEvidence(page, "vision-v2-390-manual-next.png");
  });
});

async function installSyntheticLocalDetectors(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: class SyntheticBarcodeDetector {
        async detect() {
          return [{ rawValue: "9900000000004" }, { rawValue: "990000000000002" }];
        }
      },
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class SyntheticTextDetector {
        async detect() {
          return [{ rawValue: "REDMI A7 Pro Black" }, { rawValue: "4GB RAM 64GB ROM" }];
        }
      },
    });
  });
}

async function installIncompleteLocalDetectors(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: class IncompleteBarcodeDetector {
        async detect() {
          return [];
        }
      },
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class IncompleteTextDetector {
        async detect() {
          return [{ rawValue: "REDMI" }];
        }
      },
    });
  });
}

async function createSyntheticPng(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#f3f4f6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111827";
    context.fillRect(4, 4, 56, 24);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}

async function installInventoryCreateCounter(page: Page) {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __inventoryCreateRequestCount?: number };
    const originalFetch = window.fetch.bind(window);
    testWindow.__inventoryCreateRequestCount = 0;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const pathname = new URL(url, window.location.origin).pathname;
      if (
        pathname.endsWith("/inventory/intake/create") ||
        pathname.endsWith("/inventory/v2/intake/create")
      ) {
        testWindow.__inventoryCreateRequestCount =
          (testWindow.__inventoryCreateRequestCount ?? 0) + 1;
      }
      return originalFetch(input, init);
    };
  });
}

async function installVisionRequestCounter(page: Page) {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __visionRequestCount?: number };
    const originalFetch = window.fetch.bind(window);
    testWindow.__visionRequestCount = 0;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (new URL(url, window.location.origin).pathname.endsWith("/ai/vision/extract")) {
        testWindow.__visionRequestCount = (testWindow.__visionRequestCount ?? 0) + 1;
      }
      return originalFetch(input, init);
    };
  });
}

async function installMockCloudVision(page: Page, delayMs = 0) {
  await page.addInitScript(
    (options: { delayMs: number }) => {
      type VisionRequestPayload = {
        client_request_id?: string;
        image_data_url?: string;
        mime_type?: string;
        locale?: string;
        width?: number;
        height?: number;
      };
      const testWindow = window as typeof window & {
        __visionRequestCount?: number;
        __lastVisionRequestPayload?: VisionRequestPayload;
      };
      const originalFetch = window.fetch.bind(window);
      testWindow.__visionRequestCount = 0;
      window.fetch = async (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!new URL(url, window.location.origin).pathname.endsWith("/ai/vision/extract")) {
          return originalFetch(input, init);
        }

        testWindow.__visionRequestCount = (testWindow.__visionRequestCount ?? 0) + 1;
        if (typeof init?.body === "string") {
          testWindow.__lastVisionRequestPayload = JSON.parse(init.body) as VisionRequestPayload;
        }
        if (options.delayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, options.delayMs));
        }
        const field = (value: string) => ({
          value,
          confidence: "review",
          evidence: "mocked package label",
          source: "vision",
        });
        return new Response(
          JSON.stringify({
            data: {
              contract_version: "ai-assistant-v1",
              recognition: {
                schema_version: "ai-assistant-v1",
                fields: {
                  brand: field("Redmi"),
                  model: field("A7 Pro"),
                  color: field("Blue"),
                  ram_capacity: field("8 GB"),
                  storage_capacity: field("256 GB"),
                },
                identifiers: [],
                conflicts: [],
                warnings: ["云端规格候选，必须人工核对。"],
                label_claim_only: true,
              },
              provider: "openai",
              model_version: "gpt-4o-mini-2024-07-18",
              generated_at: "2026-07-19T02:00:00.000Z",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };
    },
    { delayMs },
  );
}

async function installHangingCloudVision(page: Page) {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __visionRequestCount?: number };
    const originalFetch = window.fetch.bind(window);
    testWindow.__visionRequestCount = 0;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!new URL(url, window.location.origin).pathname.endsWith("/ai/vision/extract")) {
        return originalFetch(input, init);
      }
      testWindow.__visionRequestCount = (testWindow.__visionRequestCount ?? 0) + 1;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort, { once: true });
      });
    };
  });
}

async function gotoV2VisionStep(page: Page) {
  await page.goto("/inventory/new", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(visibleNextButton(page)).toBeEnabled({ timeout: 20_000 });
  await visibleNextButton(page).click();
  await expect(page.getByRole("heading", { name: "AI 标签识别（可选）" })).toBeVisible({
    timeout: 20_000,
  });
}

function visibleNextButton(page: Page) {
  return page.getByRole("button", { name: "下一步" }).filter({ visible: true }).first();
}

async function gotoReady(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  const addButton = page
    .getByRole("button", { name: /新增商品/ })
    .filter({ visible: true })
    .first();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await expect(addButton).toBeEnabled({ timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    }
  }
}

async function clickFirstVisible(locator: Locator) {
  for (let index = 0; index < (await locator.count()); index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
  throw new Error("No visible inventory action found");
}

async function expectVisionCapability(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const response = await fetch("/api/repairdesk/ai/capabilities", {
            cache: "no-store",
          });
          const body = (await response.json()) as {
            data?: { canUseVisionIntake?: boolean; canApplyInventoryDraft?: boolean };
          };
          return Boolean(body.data?.canUseVisionIntake && body.data?.canApplyInventoryDraft);
        }),
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function openInventoryIntakeWithAi(page: Page) {
  const dialog = page.getByRole("dialog", { name: "新增库存商品" });
  await page.waitForTimeout(300);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!(await dialog.isVisible())) {
      await clickFirstVisible(page.getByRole("button", { name: /新增商品/ }));
    }
    try {
      await expect(dialog).toBeVisible({ timeout: 3_000 });
      const aiButton = dialog.getByRole("button", { name: "拍照识别" });
      await expect(aiButton).toBeVisible({ timeout: 3_000 });
      await page.waitForTimeout(250);
      if ((await dialog.isVisible()) && (await aiButton.isVisible())) return dialog;
    } catch {
      await page.waitForTimeout(100);
    }
  }
  throw new Error("Inventory intake closed while store authority was stabilizing");
}

async function expectDialogFits(dialog: Locator, viewportWidth: number, viewportHeight: number) {
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 1);
  const horizontalOverflow = await dialog.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}

async function inventoryCreateRequestCount(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __inventoryCreateRequestCount?: number })
        .__inventoryCreateRequestCount ?? 0,
  );
}

async function visionRequestCount(page: Page) {
  return page.evaluate(
    () => (window as typeof window & { __visionRequestCount?: number }).__visionRequestCount ?? 0,
  );
}

async function lastVisionRequestPayload(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __lastVisionRequestPayload?: {
            client_request_id?: string;
            image_data_url?: string;
            mime_type?: string;
            locale?: string;
            width?: number;
            height?: number;
          };
        }
      ).__lastVisionRequestPayload ?? {},
  );
}

async function saveEvidence(page: Page, fileName: string, mask: Locator[] = []) {
  if (!evidenceDir) return;
  await page.screenshot({
    path: path.join(evidenceDir, fileName),
    fullPage: false,
    mask,
    maskColor: "#111827",
  });
}
