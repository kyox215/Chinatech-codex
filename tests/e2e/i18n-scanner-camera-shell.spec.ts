import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = resolve(
  process.env.REPAIRDESK_I18N_EVIDENCE_DIR ?? "test-results/i18n-scanner-camera-shell",
);
const captureVisualEvidence = process.env.REPAIRDESK_CAPTURE_I18N_EVIDENCE === "1";
const cases = [
  ["zh-CN", 390, 844],
  ["zh-CN", 430, 932],
  ["zh-CN", 768, 1024],
  ["zh-CN", 1024, 768],
  ["zh-CN", 1280, 800],
  ["zh-CN", 1440, 900],
  ["it-IT", 390, 844],
  ["it-IT", 430, 932],
  ["it-IT", 768, 1024],
  ["it-IT", 1024, 768],
  ["it-IT", 1280, 800],
  ["it-IT", 1440, 900],
  ["en", 390, 844],
  ["en", 430, 932],
  ["en", 768, 1024],
  ["en", 1024, 768],
  ["en", 1280, 800],
  ["en", 1440, 900],
] as const;
const labels = {
  "zh-CN": { recognize: "识别内容", scanner: "扫码读取", camera: "拍照采集" },
  "it-IT": { recognize: "Riconosci contenuto", scanner: "Scansiona", camera: "Scatta foto" },
  en: { recognize: "Recognize content", scanner: "Scan", camera: "Take photos" },
} as const;
const cameraTitles = {
  "zh-CN": "拍照采集",
  "it-IT": "Scatta foto",
  en: "Take photo",
} as const;
const orderPhotoTriggerLabels = {
  "zh-CN": "拍照",
  "it-IT": "Scatta foto",
  en: "Take photo",
} as const;
const commandScanLabels = {
  "zh-CN": "扫码查询",
  "it-IT": "Cerca con scansione",
  en: "Scan search",
} as const;
type FocusCall = { ariaLabel: string; text: string; preventScroll: boolean };

for (const [locale, width, height] of cases) {
  test(`scanner/camera shell ${locale} ${width}x${height}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () =>
            Promise.reject(new DOMException("camera unavailable", "NotAllowedError")),
        },
      });
      const focusCalls: Array<{ ariaLabel: string; text: string; preventScroll: boolean }> = [];
      const nativeFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function focus(options) {
        focusCalls.push({
          ariaLabel: this.getAttribute("aria-label") ?? "",
          text: this.textContent?.trim() ?? "",
          preventScroll: options?.preventScroll === true,
        });
        return nativeFocus.call(this, options);
      };
      Object.defineProperty(window, "__repairdeskFocusCalls", {
        configurable: true,
        value: focusCalls,
      });
    });
    await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
    const writes: string[] = [];
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (!isAllowedReadRequest(request.method(), request.url())) {
        writes.push(`${request.method()} ${request.url()}`);
        await route.abort();
        throw new Error(`Unexpected mutation request: ${request.method()} ${request.url()}`);
      }
      await route.continue();
    });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const consoleMessages: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
      if (message.type() === "error") {
        const location = message.location();
        consoleErrors.push(
          `${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`,
        );
      }
    });
    await page.goto("/customers", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#repairdesk-styled-shell")).toBeVisible();
    await expect(page.locator('[data-ui="customer-list-skeleton"]')).toHaveCount(0, {
      timeout: 30_000,
    });
    const customerList = page.locator(
      '[data-ui="repair-os-list-scaffold"]:not([data-ui-viewport="pending"])',
    );
    await expect(customerList).toBeAttached({
      timeout: 30_000,
    });
    await expect(
      customerList.locator(
        width >= 1024
          ? '[data-ui="customer-list-desktop-header"]'
          : '[data-ui="repair-os-list-header-card"]',
      ),
    ).toBeAttached();
    expect(consoleErrors, "baseline after page ready").toEqual([]);
    const scanTrigger = page
      .getByRole("button", { name: /扫码查询|Cerca.*scansione|scan[- ]search/i })
      .filter({ visible: true })
      .first();
    const quickActionTrigger = page
      .getByRole("button", { name: /打开快捷操作|Apri le azioni rapide|Open quick actions/i })
      .first();
    const useVisibleCommandPalette = locale === "en" && width === 1440;
    const useKeyboardCommandPalette = locale === "en" && width === 1280;
    if (width < 768) {
      await quickActionTrigger.click();
      const quickActionDialog = page.getByRole("dialog", {
        name: /快捷操作|Azioni rapide|Quick actions/i,
      });
      await expect(quickActionDialog).toBeVisible();
      expect(consoleErrors, "after Quick Actions opens").toEqual([]);
      await quickActionDialog
        .getByRole("button", { name: new RegExp(labels[locale].scanner) })
        .click();
    } else if (useVisibleCommandPalette || useKeyboardCommandPalette) {
      await openScannerFromCommandPalette(page, locale, useKeyboardCommandPalette);
    } else {
      await scanTrigger.click();
    }
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    if (width >= 768 && (useVisibleCommandPalette || useKeyboardCommandPalette)) {
      const commandScrollBeforeClose = await page.evaluate(() => window.scrollY);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(commandScrollBeforeClose);
      await expect(scanTrigger).toBeFocused();
      const commandFocus = await page.evaluate(() => {
        const calls = (window as Window & { __repairdeskFocusCalls?: FocusCall[] })
          .__repairdeskFocusCalls;
        return calls?.at(-1);
      });
      expect(commandFocus?.ariaLabel).toMatch(
        /Global scan search|Scansione globale|Ricerca globale tramite scansione|全局扫码|客户扫码查询|Cerca Clienti con scansione|Scan-search Customers/,
      );
      expect(commandFocus?.preventScroll).toBe(true);
      await openScannerFromCommandPalette(page, locale, useKeyboardCommandPalette);
    }
    if (width >= 768) {
      const scrollBeforeOutsideDismiss = await page.evaluate(() => window.scrollY);
      await page.mouse.click(4, 4);
      await expect(dialog).toBeHidden();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeOutsideDismiss);
      await expect(scanTrigger).not.toBeFocused();
      await scanTrigger.click();
      await expect(dialog).toBeVisible();
    }
    const scrollWhileDialogOpen = await page.evaluate(() => window.scrollY);
    const manual = dialog.getByRole("textbox", { name: /手动|Inserisci|Enter scanned/i });
    await manual.fill("490154203237518");
    await dialog.getByRole("button", { name: labels[locale].recognize }).click();
    await expect(dialog).toContainText("490154203237518");
    const protectedToken = "A".repeat(43);
    await dialog.getByRole("button", { name: /继续扫描|Scansiona ancora|Scan again/i }).click();
    await manual.fill(`https://www.chinatech.in/r#${protectedToken}`);
    await dialog.getByRole("button", { name: labels[locale].recognize }).click();
    await expect(dialog).toContainText(/凭据已保护|Credenziale protetta|Protected credential/);
    expect(consoleErrors, "after Scanner result").toEqual([]);
    await expect(dialog).not.toContainText(protectedToken);
    await expect(page.locator("body")).not.toContainText(protectedToken);
    const accessibleContent = await page.locator("body").evaluate((body) => {
      const elements = [body, ...Array.from(body.querySelectorAll("*"))];
      return elements
        .flatMap((element) => [
          element.textContent ?? "",
          ...Array.from(element.attributes).map((attr) => attr.value),
        ])
        .join(" ");
    });
    expect(accessibleContent).not.toContain(protectedToken);
    await expect(dialog.getByRole("button", { name: /复制|Copia|Copy/ })).toHaveCount(0);
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return "";
      }
    });
    expect(clipboardText).not.toContain(protectedToken);
    await expect(
      dialog.getByRole("button", { name: /搜索|Cerca|Search|打开|Apri|Open/ }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", {
        name: /查看此订单|Visualizza questo ordine|View this order/,
      }),
    ).toHaveCount(1);
    if (shouldRunGlobalCredentialAttack(locale, width)) {
      const scannerUrl = page.url();
      await dialog.getByRole("button", { name: /继续扫描|Scansiona ancora|Scan again/i }).click();
      await manual.fill(`https://[invalid/r#${protectedToken}.trailing`);
      await dialog.getByRole("button", { name: labels[locale].recognize }).click();
      await expect(dialog).toContainText(/凭据已保护|Credenziale protetta|Protected credential/);
      await expect(dialog).toContainText(
        /无效客户工单二维码|QR cliente non valido|Invalid customer repair QR code/,
      );
      const protectedDomContent = await page.locator("body").evaluate((body) => {
        const elements = [body, ...Array.from(body.querySelectorAll("*"))];
        return elements
          .flatMap((element) => [
            element.textContent ?? "",
            ...Array.from(element.attributes).map((attribute) => attribute.value),
            element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
              ? element.value
              : "",
          ])
          .join(" ");
      });
      expect(protectedDomContent).not.toContain(protectedToken);
      expect(await page.locator("body").ariaSnapshot()).not.toContain(protectedToken);
      await expect(dialog.getByRole("button", { name: /复制|Copia|Copy/ })).toHaveCount(0);
      await expect(
        dialog.getByRole("button", {
          name: /搜索|Cerca|Search|打开|Apri|Open|查看此订单|Visualizza questo ordine|View this order/,
        }),
      ).toHaveCount(0);
      const protectedClipboardText = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return "";
        }
      });
      expect(protectedClipboardText).not.toContain(protectedToken);
      expect(page.url()).toBe(scannerUrl);
      expect(writes).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(consoleMessages.some((message) => message.includes(protectedToken))).toBe(false);
    }
    const lastScannerAction = dialog.locator("button.min-h-11").last();
    await expect(lastScannerAction).toBeVisible();
    expect(
      await lastScannerAction.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    if (shouldCaptureEvidence(locale, width) && width >= 768) {
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await waitForSheetSettled(dialog);
      await page.screenshot({
        path: resolve(evidenceDir, `scanner-${locale}-${width}x${height}.png`),
      });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollWhileDialogOpen);
    if (width < 768) {
      await expect(quickActionTrigger).toBeFocused();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollWhileDialogOpen);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await page.getByRole("button", { name: /快捷|azioni rapide|quick actions/i }).click();
      await page.getByRole("button", { name: new RegExp(labels[locale].camera) }).click();
      const camera = page.getByRole("dialog");
      await expect(camera).toBeVisible();
      await expect(camera).toContainText(/摄像头权限|Permesso fotocamera|Camera permission/);
      expect(consoleErrors, "after Camera error").toEqual([]);
      await expect(page.locator("body")).not.toContainText("camera unavailable");
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      const lastCameraAction = camera.locator("button.min-h-11").last();
      await expect(lastCameraAction).toBeVisible();
      await lastCameraAction.click({ trial: true });
      expect(
        await lastCameraAction.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      const cameraScrollBeforeOutsideDismiss = await page.evaluate(() => window.scrollY);
      await page.mouse.click(4, 4);
      await expect(camera).toBeHidden();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(cameraScrollBeforeOutsideDismiss);
      await expect(quickActionTrigger).not.toBeFocused();
      await quickActionTrigger.click();
      await page
        .getByRole("dialog", { name: /快捷|azioni rapide|quick actions/i })
        .getByRole("button", { name: new RegExp(labels[locale].camera) })
        .click();
      await expect(camera).toBeVisible();
      await expect(camera).toContainText(/摄像头权限|Permesso fotocamera|Camera permission/);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await waitForSheetSettled(camera);
      await expect(lastCameraAction).toBeVisible();
      await lastCameraAction.click({ trial: true });
      if (shouldCaptureEvidence(locale, width)) {
        await page.screenshot({
          path: resolve(evidenceDir, `camera-mobile-${locale}-${width}x${height}.png`),
        });
      }
      await page.keyboard.press("Escape");
      await expect(camera).toBeHidden();
      await expect(quickActionTrigger).toBeFocused();
      const cameraFocus = await page.evaluate(() => {
        const calls = (window as Window & { __repairdeskFocusCalls?: FocusCall[] })
          .__repairdeskFocusCalls;
        return calls?.at(-1);
      });
      expect(cameraFocus?.preventScroll).toBe(true);
    } else {
      await expect(scanTrigger).toBeFocused();
      const scanFocus = await page.evaluate(() => {
        const calls = (window as Window & { __repairdeskFocusCalls?: FocusCall[] })
          .__repairdeskFocusCalls;
        return calls?.at(-1);
      });
      expect(scanFocus?.ariaLabel).toMatch(
        /Global scan search|Scansione globale|Ricerca globale tramite scansione|全局扫码|客户扫码查询|Cerca Clienti con scansione|Scan-search Customers/,
      );
      expect(scanFocus?.preventScroll).toBe(true);
    }
    if (width >= 768) {
      await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
      const orderDetail = page.locator('[data-order-detail-root="true"]').first();
      await expect(orderDetail).toBeVisible({ timeout: 30_000 });
      const orderPhotoTrigger = orderDetail
        .getByRole("button", { name: orderPhotoTriggerLabels[locale], exact: true })
        .filter({ visible: true })
        .first();
      await orderPhotoTrigger.click();
      const orderCamera = page.getByRole("dialog").filter({ visible: true }).last();
      await expect(orderCamera).toBeVisible();
      await expect(orderCamera).toContainText(cameraTitles[locale]);
      const orderDescriptions = {
        "zh-CN": "当前工单附件",
        "it-IT": "allegati dell’ordine",
        en: "order attachments",
      } as const;
      await expect(orderCamera).toContainText(orderDescriptions[locale]);
      await expect(page.locator("body")).not.toContainText("camera unavailable");
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      const lastOrderCameraAction = orderCamera.locator("button.min-h-11").last();
      await expect(lastOrderCameraAction).toBeVisible();
      await lastOrderCameraAction.click({ trial: true });
      await expectNoHorizontalOverflow(page);
      const orderCameraScrollBeforeOutsideDismiss = await page.evaluate(() => window.scrollY);
      await page.mouse.click(4, 4);
      await expect(orderCamera).toBeHidden();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(orderCameraScrollBeforeOutsideDismiss);
      await expect(orderPhotoTrigger).not.toBeFocused();
      await orderPhotoTrigger.click();
      await expect(orderCamera).toBeVisible();
      await expect(orderCamera).toContainText(cameraTitles[locale]);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await waitForSheetSettled(orderCamera);
      await expect(lastOrderCameraAction).toBeVisible();
      await lastOrderCameraAction.click({ trial: true });
      if (shouldCaptureEvidence(locale, width)) {
        await page.screenshot({
          path: resolve(evidenceDir, `camera-order-${locale}-${width}x${height}.png`),
        });
      }
      await page.keyboard.press("Escape");
      await expect(orderCamera).toBeHidden();
      await expect(orderPhotoTrigger).toBeFocused();
      const orderCameraFocus = await page.evaluate(() => {
        const calls = (window as Window & { __repairdeskFocusCalls?: FocusCall[] })
          .__repairdeskFocusCalls;
        return calls?.at(-1);
      });
      expect(orderCameraFocus?.preventScroll).toBe(true);
    }
    await expectNoHorizontalOverflow(page);
    if (locale === "it-IT" && width === 390) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
    expect(writes).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleMessages.filter((message) => message.startsWith("error:"))).toEqual([]);
    expect(consoleMessages.some((message) => message.includes(protectedToken))).toBe(false);
    expect(consoleMessages.some((message) => message.includes("camera unavailable"))).toBe(false);
  });
}

test("camera local image creates a localized attachment draft without upload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("camera unavailable", "NotAllowedError")),
      },
    });
  });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  const writes: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!isAllowedReadRequest(request.method(), request.url())) {
      writes.push(`${request.method()} ${request.url()}`);
      await route.abort();
      throw new Error(`Unexpected mutation request: ${request.method()} ${request.url()}`);
    }
    await route.continue();
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  const quickActionTrigger = page
    .getByRole("button", { name: /Apri le azioni rapide/i })
    .filter({ visible: true })
    .first();
  await quickActionTrigger.click();
  await page
    .getByRole("dialog", { name: /Azioni rapide/i })
    .getByRole("button", { name: /Scatta foto/i })
    .click();
  const camera = page.getByRole("dialog");
  await expect(camera).toBeVisible();
  await camera.locator('input[type="file"]').setInputFiles({
    name: "local-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("deterministic local image"),
  });
  await expect(camera).toBeHidden();
  await quickActionTrigger.click();
  const attachmentPanel = page.getByRole("dialog", { name: /Azioni rapide/i });
  await expect(attachmentPanel).toContainText("local-photo.png");
  await expect(page.locator("body")).not.toContainText("camera unavailable");
  expect(writes).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const [locale, width, height, trigger, title] of [
  ["zh-CN", 390, 844, "扫描订单二维码", "扫描订单二维码"],
  ["it-IT", 768, 1024, "Scansiona il codice QR dell’ordine", "Scansiona il QR dell’ordine"],
  ["en", 1440, 900, "Scan order QR code", "Scan order QR code"],
] as const) {
  test(`order QR wrapper boundary ${locale} ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () =>
            Promise.reject(new DOMException("camera unavailable", "NotAllowedError")),
        },
      });
    });
    await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
    const writes: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const consoleMessages: string[] = [];
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (!isAllowedReadRequest(request.method(), request.url())) {
        writes.push(`${request.method()} ${request.url()}`);
        await route.abort();
        throw new Error(`Unexpected mutation request: ${request.method()} ${request.url()}`);
      }
      await route.continue();
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto("/orders", { waitUntil: "domcontentloaded" });
    const orderListUrl = page.url();
    const qrTrigger = page.getByRole("button", { name: trigger }).first();
    await expect(qrTrigger).toBeVisible();
    await qrTrigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(title);
    const manual = dialog.getByRole("textbox");
    const protectedToken = "A".repeat(43);
    await manual.fill(`https://[invalid/r#${protectedToken}.trailing`);
    await dialog.getByRole("button", { name: labels[locale].recognize }).click();
    await expect(dialog).toContainText(/凭据已保护|Credenziale protetta|Protected credential/);
    await expect(dialog).toContainText(
      /无效客户工单二维码|QR cliente non valido|Invalid customer repair QR code/,
    );
    const domAndAttributeContent = await page.locator("body").evaluate((body) => {
      const elements = [body, ...Array.from(body.querySelectorAll("*"))];
      return elements
        .flatMap((element) => [
          element.textContent ?? "",
          ...Array.from(element.attributes).map((attr) => attr.value),
          element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
            ? element.value
            : "",
        ])
        .join(" ");
    });
    expect(domAndAttributeContent).not.toContain(protectedToken);
    expect(await page.locator("body").ariaSnapshot()).not.toContain(protectedToken);
    await expect(dialog.getByRole("button", { name: /复制|Copia|Copy/ })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /打开订单|Apri l’ordine|Open order/ }),
    ).toHaveCount(0);
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return "";
      }
    });
    expect(clipboardText).not.toContain(protectedToken);
    expect(page.url()).toBe(orderListUrl);
    expect(writes).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleMessages.some((message) => message.includes(protectedToken))).toBe(false);

    await dialog.getByRole("button", { name: /继续扫描|Scansiona ancora|Scan again/i }).click();
    await manual.fill("490154203237518");
    await dialog.getByRole("button", { name: labels[locale].recognize }).click();
    await expect(dialog).toContainText(
      /不是有效订单二维码|只接受有效的订单二维码|Sono accettati solo QR ordine validi|Only valid order QR codes/,
    );
    expect(await page.url()).toContain("/orders");
    expect(writes).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleMessages.some((message) => message.includes(protectedToken))).toBe(false);
  });
}

function isAllowedReadRequest(method: string, requestUrl: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (method !== "POST") return false;
  const url = new URL(requestUrl, baseURL);
  if (url.pathname.startsWith("/__nextjs_")) return true;
  return [
    "/api/repairdesk/customers/list-page",
    "/api/repairdesk/inventory/summary",
    "/api/repairdesk/orders/list-page",
    "/api/repairdesk/orders/queue-summary",
    "/api/repairdesk/order/get",
  ].includes(url.pathname);
}

function shouldRunGlobalCredentialAttack(locale: (typeof cases)[number][0], width: number) {
  return (
    (locale === "zh-CN" && width === 390) ||
    (locale === "it-IT" && width === 768) ||
    (locale === "en" && width === 1440)
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('[role="dialog"]')
        .evaluateAll((dialogs) =>
          dialogs.every((dialog) => dialog.scrollWidth <= dialog.clientWidth),
        ),
    )
    .toBe(true);
}

function shouldCaptureEvidence(locale: (typeof cases)[number][0], width: number) {
  return (
    captureVisualEvidence &&
    (locale === "it-IT" || width === 390 || width === 768 || width === 1440)
  );
}

async function waitForSheetSettled(sheet: Locator) {
  await sheet.evaluate(async (element) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const animations = element.getAnimations({ subtree: true });
      if (animations.length === 0) return;
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
  await expect
    .poll(
      () =>
        sheet.evaluate(
          (element) =>
            new Promise((resolve) => {
              const first = element.getBoundingClientRect();
              requestAnimationFrame(() => {
                const second = element.getBoundingClientRect();
                resolve(
                  first.width > 0 &&
                    first.height > 0 &&
                    Math.abs(first.top - second.top) < 0.5 &&
                    Math.abs(first.left - second.left) < 0.5 &&
                    Math.abs(first.width - second.width) < 0.5 &&
                    Math.abs(first.height - second.height) < 0.5,
                );
              });
            }),
        ),
      { message: "Camera Sheet geometry should be stable before evidence capture" },
    )
    .toBe(true);
}

async function openScannerFromCommandPalette(
  page: Page,
  locale: keyof typeof commandScanLabels,
  useKeyboardShortcut: boolean,
) {
  if (useKeyboardShortcut) {
    await page.keyboard.press("Control+k");
  } else {
    const commandTrigger = page
      .locator('[data-workspace-search-trigger="true"]')
      .filter({ visible: true })
      .first();
    await expect(commandTrigger).toBeVisible();
    await commandTrigger.click();
  }
  const commandPalette = page
    .locator('[role="dialog"]')
    .filter({ has: page.locator("[cmdk-input]") })
    .first();
  await expect(commandPalette).toBeVisible();
  await commandPalette.getByRole("option", { name: commandScanLabels[locale] }).click();
  await expect(commandPalette).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
}
