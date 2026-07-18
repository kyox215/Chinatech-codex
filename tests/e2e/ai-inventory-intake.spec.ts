import { Buffer } from "node:buffer";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

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
    await expect(dialog.getByText("正在进行本地识别，必要时请求视觉服务…")).toBeVisible();
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
      if (new URL(url, window.location.origin).pathname.endsWith("/inventory/intake/create")) {
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

async function gotoReady(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page
      .getByRole("button", { name: /新增商品/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 20_000 });
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

async function saveEvidence(page: Page, fileName: string, mask: Locator[] = []) {
  if (!evidenceDir) return;
  await page.screenshot({
    path: path.join(evidenceDir, fileName),
    fullPage: false,
    mask,
    maskColor: "#111827",
  });
}
