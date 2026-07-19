import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for AI assistant checks.");

test.describe("staff AI assistant bounded workflow", () => {
  test("desktop entry runs the real fake-provider BFF and returns canonical order links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/orders");

    const trigger = page.locator('[data-ai-assistant-trigger="desktop"]');
    await expect(trigger).toBeVisible();
    await expect(page.locator('[data-ai-assistant-sheet="true"]')).toHaveCount(0);
    await trigger.click();

    const sheet = page.locator('[data-ai-assistant-sheet="true"]');
    const input = page.getByLabel("输入工单查询问题");
    await expect(sheet).toBeVisible();
    await expect(input).toBeFocused();
    await page.getByRole("button", { name: "查找未付款工单" }).click();
    await expect(sheet.getByText(/RepairDesk 找到 \d+ 条符合条件的工单/)).toBeVisible();

    const firstOrderLink = sheet.locator('a[href^="/orders/"]').first();
    await expect(firstOrderLink).toBeVisible();
    await expect(firstOrderLink).toHaveAttribute("href", /^\/orders\/[a-zA-Z0-9_-]+$/);
    await expectNoHorizontalOverflow(page);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}px uses one page-level entry and a full-width result sheet`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoReady(page, "/orders");

      const trigger = page.locator('[data-ai-assistant-trigger="mobile-orders"]');
      await expect(trigger).toHaveCount(1);
      await trigger.click();

      const sheet = page.locator('[data-ai-assistant-sheet="true"]');
      await expect(sheet).toBeVisible();
      const box = await sheet.boundingBox();
      expect(box?.width).toBeCloseTo(viewport.width, 2);

      await page.getByLabel("输入工单查询问题").fill("查找未付款工单");
      await page.getByRole("button", { name: "发送" }).click();
      await expect(sheet.locator('a[href^="/orders/"]').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("mobile voice input fills the composer without sending a query", async ({ page }) => {
    await installSpeechRecognitionMock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/orders");
    await page.locator('[data-ai-assistant-trigger="mobile-orders"]').click();

    const sheet = page.locator('[data-ai-assistant-sheet="true"]');
    const input = page.getByLabel("输入工单查询问题");
    const microphone = sheet.getByRole("button", { name: "开始语音输入" });
    await expect(microphone).toBeEnabled();
    await microphone.click();
    await expect(sheet.getByText("正在听…说完后点击麦克风停止。", { exact: true })).toBeVisible();

    await page.evaluate(() => {
      const emitSpeechResult = (
        window as typeof window & { __emitAiSpeechResult?: (text: string) => void }
      ).__emitAiSpeechResult;
      if (!emitSpeechResult) throw new Error("Speech recognition test bridge is unavailable");
      emitSpeechResult("查找未付款工单");
    });

    await expect(input).toHaveValue("查找未付款工单");
    await expect(sheet.locator('a[href^="/orders/"]')).toHaveCount(0);
    await sheet.getByRole("button", { name: "停止语音输入" }).click();
    await expect(sheet.getByText("语音已填入，可编辑后再发送。", { exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "发送", exact: true })).toBeEnabled();
    await expect(sheet.locator('a[href^="/orders/"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await sheet.screenshot({
      path: "screenshots/TASK-20260719-001-ai-assistant-voice-input/ai-assistant-voice-mobile-390.png",
    });
  });

  test("cancel preserves input and offline mode never sends a queued request", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      const testWindow = window as typeof window & { __aiTurnRequestCount?: number };
      const originalFetch = window.fetch.bind(window);
      testWindow.__aiTurnRequestCount = 0;
      window.fetch = (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (
          new URL(url, window.location.origin).pathname.endsWith("/api/repairdesk/ai/order/turn")
        ) {
          testWindow.__aiTurnRequestCount = (testWindow.__aiTurnRequestCount ?? 0) + 1;
          return new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            const abort = () => reject(new DOMException("Aborted", "AbortError"));
            if (signal?.aborted) abort();
            else signal?.addEventListener("abort", abort, { once: true });
          });
        }
        return originalFetch(input, init);
      };
    });
    await gotoReady(page, "/orders");
    await page.locator('[data-ai-assistant-trigger="desktop"]').click();

    const input = page.getByLabel("输入工单查询问题");
    await input.fill("保留这段查询内容");
    const sheet = page.locator('[data-ai-assistant-sheet="true"]');
    await sheet.getByRole("button", { name: "发送", exact: true }).click();
    await expect(sheet.getByText("正在理解问题并查询 RepairDesk…")).toBeVisible();
    await sheet.getByRole("button", { name: "取消", exact: true }).click();
    await expect(
      page.getByText("已取消本次查询。输入内容仍保留，可修改后重新发送。"),
    ).toBeVisible();
    await expect(input).toHaveValue("保留这段查询内容");

    const countAfterCancel = await aiTurnRequestCount(page);
    await page.context().setOffline(true);
    await expect(page.getByText("当前离线", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
    await input.fill("离线查询不能发送");
    await input.press("Enter");
    await page.waitForTimeout(150);
    expect(await aiTurnRequestCount(page)).toBe(countAfterCancel);
  });

  test("permission-denied capability projection does not render any AI entry", async ({ page }) => {
    await page.route("**/api/repairdesk/ai/capabilities", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            canUseOrderAssistant: false,
            canUseVisionIntake: false,
            canApplyInventoryDraft: false,
            reason: "permission_denied",
          },
        }),
      });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/orders");

    await expect(page.locator('[data-ai-assistant-trigger="desktop"]')).toHaveCount(0);
    await expect(page.locator('[data-ai-assistant-trigger="mobile-orders"]')).toHaveCount(0);
    await expect(page.locator('[data-ai-assistant-sheet="true"]')).toHaveCount(0);
  });

  test("mobile quick sheet keeps the current module action first and AI second", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/customers");
    await page.getByRole("button", { name: "打开快捷操作" }).click();

    const dialog = page.getByRole("dialog", { name: "快捷操作" });
    const primary = dialog.locator('[data-mobile-workspace-action="primary"]');
    const ai = dialog.locator('[data-ai-assistant-trigger="mobile-dock"]');
    await expect(primary).toContainText("当前 ·");
    await expect(ai).toContainText("AI 小助手");
    await expect(
      dialog.locator(
        '[data-mobile-workspace-action="primary"], [data-ai-assistant-trigger="mobile-dock"]',
      ),
    ).toHaveCount(2);
    expect(
      await dialog
        .locator(
          '[data-mobile-workspace-action="primary"], [data-ai-assistant-trigger="mobile-dock"]',
        )
        .evaluateAll((nodes) =>
          nodes.map((node) =>
            node.hasAttribute("data-mobile-workspace-action") ? "primary" : "ai",
          ),
        ),
    ).toEqual(["primary", "ai"]);
  });
});

async function gotoReady(page: Page, path: string) {
  const storeContext = page.waitForResponse(
    (response) => response.url().includes("/api/repairdesk/stores/context") && response.ok(),
  );
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await storeContext;
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}

async function aiTurnRequestCount(page: Page) {
  return page.evaluate(
    () => (window as typeof window & { __aiTurnRequestCount?: number }).__aiTurnRequestCount ?? 0,
  );
}

async function installSpeechRecognitionMock(page: Page) {
  await page.addInitScript(() => {
    type MockRecognitionResultEvent = Event & {
      resultIndex: number;
      results: Array<Array<{ transcript: string }> & { isFinal: boolean }>;
    };

    class MockSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: ((event: Event) => void) | null = null;
      onresult: ((event: MockRecognitionResultEvent) => void) | null = null;
      onerror: ((event: Event & { error: string }) => void) | null = null;
      onend: ((event: Event) => void) | null = null;

      constructor() {
        testWindow.__activeAiSpeechRecognition = this;
      }

      start() {
        this.onstart?.(new Event("start"));
      }

      stop() {
        this.onend?.(new Event("end"));
      }

      abort() {
        this.onend?.(new Event("end"));
      }
    }

    type SpeechTestWindow = Window & {
      SpeechRecognition?: typeof MockSpeechRecognition;
      webkitSpeechRecognition?: typeof MockSpeechRecognition;
      __activeAiSpeechRecognition?: MockSpeechRecognition;
      __emitAiSpeechResult?: (text: string) => void;
    };

    const testWindow = window as SpeechTestWindow;
    Object.defineProperty(testWindow, "SpeechRecognition", {
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(testWindow, "webkitSpeechRecognition", {
      configurable: true,
      value: MockSpeechRecognition,
    });
    testWindow.__emitAiSpeechResult = (text) => {
      const recognition = testWindow.__activeAiSpeechRecognition;
      if (!recognition?.onresult) throw new Error("No active speech recognition session");
      const result = Object.assign([{ transcript: text }], { isFinal: true });
      recognition.onresult(
        Object.assign(new Event("result"), { resultIndex: 0, results: [result] }),
      );
    };
  });
}
