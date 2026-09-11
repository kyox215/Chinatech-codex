import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";
import { setKeyboardDeviceViewport } from "./input-keypad-helpers";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
test.skip(!enabled, "Requires the local synthetic business fixture.");
const baseURL = () => String(test.info().project.use.baseURL);
const screenshotDir = process.env.COMPACT_EDIT_EVIDENCE_DIR;
const locales = ["zh-CN", "it-IT", "en"] as const;

async function screenshot(page: Page, name: string) {
  const path = screenshotDir
    ? `${screenshotDir}/${name}.png`
    : test.info().outputPath(`${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  // Hide only Next development instrumentation, never business controls.
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
  // Capture settled CSS/Framer states, rather than the first visible animation frame.
  await page.waitForTimeout(300);
  await page.screenshot({ path, fullPage: false });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
async function readableQuoteGrid(grid: Locator) {
  await expect(grid.locator("[data-fault-category]")).toHaveCount(12);
  const metrics = await grid.locator("[data-fault-category]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const [main, expand] = Array.from(node.querySelectorAll("button"));
      const mainBox = main.getBoundingClientRect();
      const expandBox = expand.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        height: box.height,
        split: mainBox.width / expandBox.width,
        singleLine: getComputedStyle(main.querySelector("span")!).whiteSpace === "nowrap",
        fullAccessibleLabel: Boolean(main.getAttribute("aria-label")),
      };
    }),
  );
  expect(new Set(metrics.map((m) => m.x)).size).toBe(4);
  expect(new Set(metrics.map((m) => m.y)).size).toBe(3);
  for (const metric of metrics) {
    expect(metric.height).toBeCloseTo(36, 1);
    expect(metric.split).toBeCloseTo(2, 1);
    expect(metric.singleLine).toBe(true);
    expect(metric.fullAccessibleLabel).toBe(true);
  }
  expect(await grid.evaluate((node) => getComputedStyle(node).rowGap)).toBe("4px");
}

async function readableQuoteRows(root: Locator) {
  const amountMetrics = await root
    .locator(
      "[data-money-keypad-trigger] > span:last-child, [data-order-workspace-money-strip] > div > span",
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = new Set(
          Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)),
        );
        const css = getComputedStyle(node);
        return {
          text: node.textContent,
          label: node.parentElement?.getAttribute("aria-label"),
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          height: node.clientHeight,
          scrollHeight: node.scrollHeight,
          font: css.font,
          fontSize: css.fontSize,
          textWidth: range.getBoundingClientRect().width,
          lineHeight: css.lineHeight,
          overflow: css.overflow,
          clipped:
            lines.size > 1 ||
            node.scrollWidth > node.clientWidth + 1 ||
            node.scrollHeight > node.clientHeight + 1,
        };
      }),
    );
  await test.info().attach("quote-amount-metrics", {
    body: JSON.stringify(amountMetrics, null, 2),
    contentType: "application/json",
  });
  expect(amountMetrics.filter((node) => node.clipped)).toEqual([]);
  for (const row of await root.locator("[data-order-workspace-quote-row]").all()) {
    const geometry = await row.evaluate((node) => {
      const [identity, price, action] = Array.from(node.children);
      const name = identity.querySelector("textarea, input") ?? identity.firstElementChild!;
      const note = identity.children[1];
      const nameBox = name.getBoundingClientRect();
      const priceBox = price.getBoundingClientRect();
      const actionBox = action?.getBoundingClientRect();
      return {
        wrappedName: name.scrollHeight <= name.clientHeight + 1,
        priceSeparate: nameBox.right <= priceBox.left + 1,
        actionSeparate: !actionBox || priceBox.right <= actionBox.left + 1,
        noteBelow: !note || note.getBoundingClientRect().top >= nameBox.bottom - 1,
        priceAligned: Math.abs(nameBox.top - priceBox.top) <= 1,
      };
    });
    expect(geometry).toEqual({
      wrappedName: true,
      priceSeparate: true,
      actionSeparate: true,
      noteBelow: true,
      priceAligned: true,
    });
  }
  const tiles = await root
    .locator("[data-order-workspace-money-strip] > div")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        height: node.getBoundingClientRect().height,
        readable: node.scrollWidth <= node.clientWidth + 1,
      })),
    );
  expect(tiles).toHaveLength(3);
  expect(
    Math.max(...tiles.map((tile) => tile.height)) - Math.min(...tiles.map((tile) => tile.height)),
  ).toBeLessThanOrEqual(1);
  expect(tiles.every((tile) => tile.readable)).toBe(true);
}

async function discloseQuoteContent(page: Page, root: Locator, name: string) {
  const controls = [
    root.locator("[data-order-quote-text-control]").first(),
    root.locator("[data-order-quote-disclosure]").first(),
    root.locator("[data-order-quote-disclosure]").last(),
  ];
  for (const [index, control] of controls.entries()) {
    if (!(await control.count())) continue;
    const trigger = control.locator("button");
    const height = (await control.boundingBox())!.height;
    expect(height).toBeLessThanOrEqual(36.1);
    await trigger.press("Enter");
    const popup = page.locator('[data-order-quote-popup="true"]');
    await expect(popup).toBeVisible();
    await expect(popup).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    expect((await control.boundingBox())!.height).toBeCloseTo(height, 1);
    const editable = (await popup.getByRole("textbox").count()) > 0;
    if (editable) {
      const input = popup.getByRole("textbox");
      const original = await input.inputValue();
      const triggerText = await trigger.textContent();
      await input.fill("Cancelled popup draft");
      await popup.locator("[data-editor-footer] > button").first().click();
      await expect(popup).toHaveCount(0);
      expect(await trigger.textContent()).toBe(triggerText);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(popup.getByRole("textbox")).toHaveValue(original);
      await expect(popup).toBeFocused();
    }
    if (!editable)
      await expect(popup.locator("[data-editor-body]")).toContainText(
        (await trigger.textContent())!.trim(),
      );
    await noOverflow(page);
    await screenshot(page, `${name}-popup-${index}`);
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(root).toBeVisible();
    await expect(trigger).toBeFocused();
    expect((await control.boundingBox())!.height).toBeCloseTo(height, 1);
  }
}

async function editQuoteName(
  page: Page,
  trigger: Locator,
  value: string,
  locale: (typeof locales)[number],
) {
  const before = await trigger.textContent();
  const triggerElement = await trigger.elementHandle();
  await trigger.click();
  const popup = page.locator('[data-order-quote-popup="true"]');
  await expect(popup).toBeFocused();
  const input = popup.getByRole("textbox");
  await expect(input).not.toBeFocused();
  await input.fill(value);
  expect(await triggerElement!.textContent()).toBe(before);
  await popup.getByRole("button", { name: tr(locale, "orders2b2.hero.save"), exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText(value);
}

const quoteCopy = {
  "zh-CN": {
    name: "屏幕维修与连接器深度清洁及功能检测",
    note: "原装高亮度总成 · 保留原有显示校准及多点触控功能测试",
  },
  "it-IT": {
    name: "Sostituzione schermo e pulizia approfondita dei connettori",
    note: "Ricambio originale ad alta luminosità · calibrazione e verifica completa del funzionamento multitouch",
  },
  en: {
    name: "Display replacement and thorough connector cleaning",
    note: "Original high-brightness assembly · calibration and complete multi-touch functionality verification",
  },
} as const;
async function bottomEditor(page: Page, editor: Locator, width: number, height: number) {
  await expect(editor).toBeVisible();
  const centeredOrderEditor =
    width >= 680 &&
    (await editor.evaluate((node) => node.classList.contains("order-detail-interaction-overlay")));
  await expect
    .poll(async () => {
      const rect = await editor.boundingBox();
      return Boolean(
        rect &&
        rect.x >= -1 &&
        rect.y >= -1 &&
        rect.x + rect.width <= width + 1 &&
        rect.y + rect.height <= height + 1 &&
        (centeredOrderEditor
          ? Math.abs(rect.y + rect.height / 2 - height / 2) <= 2 &&
            Math.abs(rect.x + rect.width / 2 - width / 2) <= 2
          : Math.abs(rect.y + rect.height - height) <= 2),
      );
    })
    .toBe(true);
  await noOverflow(page);
}

async function orderQuoteTrigger(page: Page, locale: (typeof locales)[number]) {
  const workbench = page.getByRole("button", {
    name: `${tr(locale, "orders2b2.hero.edit")} · ${tr(locale, "orders2b2.overview.quoteItems")}`,
    exact: true,
  });
  if (await workbench.isVisible()) return workbench;
  const trigger = page.locator("#mobile-order-quote").getByRole("button", {
    name: tr(locale, "orders2b2.overview.quoteItems"),
    exact: true,
  });
  await revealShortScreenControl(page, trigger);
  return trigger;
}

async function revealShortScreenControl(page: Page, trigger: Locator) {
  // Short screens need the actual usable strip, not native viewport centering.
  // Keep the same hit-test contract already exercised by the A15 short cases.
  if ((page.viewportSize()?.height ?? 0) < 400) {
    await expect
      .poll(() =>
        trigger.evaluate((element) => {
          const header = document.querySelector('[data-mobile-order-header="true"]');
          const dock = document.querySelector('[data-mobile-order-action-dock="true"]');
          if (!header || !dock) return false;
          const top = Math.max(0, header.getBoundingClientRect().bottom);
          const bottom = Math.min(innerHeight, dock.getBoundingClientRect().top);
          const rect = element.getBoundingClientRect();
          window.scrollBy({
            top: rect.y + rect.height / 2 - (top + bottom) / 2,
            behavior: "instant",
          });
          const next = element.getBoundingClientRect();
          const x = next.x + next.width / 2,
            y = next.y + next.height / 2;
          return y > top && y < bottom && element.contains(document.elementFromPoint(x, y));
        }),
      )
      .toBe(true);
  }
}

for (const locale of locales) {
  test(`A15 quote popup short screen ${locale}`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL() }]);
    await setKeyboardDeviceViewport(page, { width: 320, height: 350 });
    const longNote = quoteCopy[locale].note.repeat(12);
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.data.order.fault_prices[0].note = longNote;
      payload.data.order.fault_prices[0].catalog_key = "display:main";
      await route.fulfill({ response, json: payload });
    });
    const loaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/repairdesk/order/get" && response.ok(),
    );
    await page.goto("/orders/ord_1");
    await loaded;
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    const quoteEntry = await orderQuoteTrigger(page, locale);
    await expect
      .poll(() =>
        quoteEntry.evaluate((element) => {
          const header = document.querySelector('[data-mobile-order-header="true"]');
          const dock = document.querySelector('[data-mobile-order-action-dock="true"]');
          if (!header || !dock) return null;
          const rect = element.getBoundingClientRect();
          const top = Math.max(0, header.getBoundingClientRect().bottom);
          const bottom = Math.min(innerHeight, dock.getBoundingClientRect().top);
          if (bottom <= top) return null;
          // A short screen's usable center differs from the viewport center.
          window.scrollBy({
            top: rect.y + rect.height / 2 - (top + bottom) / 2,
            behavior: "instant",
          });
          const next = element.getBoundingClientRect();
          const x = next.x + next.width / 2;
          const y = next.y + next.height / 2;
          const visibleTop = Math.max(0, header.getBoundingClientRect().bottom);
          const visibleBottom = Math.min(innerHeight, dock.getBoundingClientRect().top);
          const hit = document.elementFromPoint(x, y);
          return {
            visibleTop,
            visibleBottom,
            centerY: y,
            centerInside: y > visibleTop && y < visibleBottom,
            targetHit: Boolean(hit && element.contains(hit)),
          };
        }),
      )
      .toMatchObject({ centerInside: true, targetHit: true });
    await quoteEntry.click();
    const outer = page.locator("#mobile-order-finance-editor");
    const row = outer.locator("[data-order-workspace-quote-row]").first();
    const note = row.locator("[data-order-quote-disclosure]").last().getByRole("button");
    const rowHeight = (await row.boundingBox())!.height;
    await note.click();
    const popup = page.locator('[data-order-quote-popup="true"]');
    await expect(popup).toBeFocused();
    await expect(popup.getByRole("textbox")).toHaveCount(0);
    const body = popup.locator("[data-editor-body]");
    await expect(body).toContainText(longNote);
    expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    expect(
      await body.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight),
    ).toBeLessThanOrEqual(1);
    await expect(popup.locator("[data-editor-footer] > button")).toBeInViewport();
    await noOverflow(page);
    await screenshot(page, `popup-readonly-short-${locale}`);
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(outer).toBeVisible();
    await expect(note).toBeFocused();
    expect((await row.boundingBox())!.height).toBeCloseTo(rowHeight, 1);
    await outer
      .getByRole("button", { name: tr(locale, "orders2b2.finance.add"), exact: true })
      .click();
    const trigger = outer.locator("[data-order-quote-text-control]").last().getByRole("button");
    const customRow = outer.locator("[data-order-workspace-quote-row]").last();
    await customRow.locator("[data-money-keypad-trigger]").click();
    await page.locator('[data-money-keypad-key="0"]').click();
    await page.locator("[data-money-keypad-done]").click();
    const customHeight = (await customRow.boundingBox())!.height;
    await trigger.click();
    await expect(popup).toBeFocused();
    const input = popup.getByRole("textbox");
    await expect(input).not.toBeFocused();
    await expect(input).toHaveCSS("font-size", "16px");
    await input.fill("Cancelled popup draft");
    await popup.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
    await expect(popup).toHaveCount(0);
    await expect(trigger).not.toContainText("Cancelled popup draft");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(input).toHaveValue("");
    await input.fill(quoteCopy[locale].name);
    const save = popup.getByRole("button", {
      name: tr(locale, "orders2b2.hero.save"),
      exact: true,
    });
    await expect(save).toBeInViewport();
    await expect(popup.locator("[data-editor-footer] > button").first()).toBeInViewport();
    await screenshot(page, `popup-editable-short-${locale}`);
    await save.click();
    await expect(popup).toHaveCount(0);
    await expect(trigger).toContainText(quoteCopy[locale].name);
    await expect(trigger).toBeFocused();
    await expect(outer).toBeVisible();
    expect((await customRow.boundingBox())!.height).toBeCloseTo(customHeight, 1);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

for (const locale of locales)
  for (const width of [320, 390, 430, 768, 1024, 1280, 1440]) {
    test(`compact A ${locale} ${width}px`, async ({ page }) => {
      test.setTimeout(60000);
      const height = width < 768 ? 844 : 1000;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL() }]);
      await setKeyboardDeviceViewport(page, { width, height });
      const longQuote = quoteCopy[locale];
      const quoteAmount = width === 320 ? "123456.78" : "1234.56";
      await page.route("**/api/repairdesk/order/get", async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.data.order.fault_prices = [
          {
            ...payload.data.order.fault_prices[0],
            catalog_key: "display:main",
            name: longQuote.name,
            note: longQuote.note,
            price: Number(quoteAmount),
          },
        ];
        payload.data.order.quotation_amount = Number(quoteAmount);
        payload.data.order.balance_amount = Number(quoteAmount) - payload.data.order.deposit_amount;
        await route.fulfill({ response, json: payload });
      });
      // This first navigation may compile the route in CI. Wait for its actual
      // order response, then retain the normal 5s renderer visibility assertion.
      const orderLoaded = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/repairdesk/order/get" && response.ok(),
      );
      await page.goto("/orders/ord_1");
      const loadedOrder = await (await orderLoaded).json();
      expect(loadedOrder.data.order.id).toBe("ord_1");
      await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
      await noOverflow(page);
      const wideWorkbench = await page
        .locator('[data-order-detail-root="true"]')
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return (
            node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= 680
          );
        });
      const quoteEdit = page.getByRole("button", {
        name: `${tr(locale, "orders2b2.hero.edit")} · ${tr(locale, "orders2b2.overview.quoteItems")}`,
        exact: true,
      });
      if (width < 1024) {
        const tabs = page.locator('[data-order-detail-tabs="true"] [role="tab"]');
        await expect(tabs).toHaveCount(3);
        const widths = await tabs.evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
        if (!wideWorkbench) {
          expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
        } else {
          const geometry = await tabs.evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return {
                x: box.x,
                right: box.right,
                y: box.y,
                width: box.width,
                height: box.height,
                readable: node.scrollWidth <= node.clientWidth + 1,
              };
            }),
          );
          for (const [index, tab] of geometry.entries()) {
            expect(tab.width).toBeGreaterThanOrEqual(44);
            expect(tab.height).toBeGreaterThanOrEqual(44);
            expect(tab.readable).toBe(true);
            expect(Math.abs(tab.y - geometry[0].y)).toBeLessThanOrEqual(1);
            if (index) expect(tab.x).toBeGreaterThanOrEqual(geometry[index - 1].right);
          }
          await expect(tabs.locator("span")).toHaveCount(1);
          await expect(page.locator('[data-order-detail-tab="overview"] > span')).toHaveCSS(
            "height",
            "2px",
          );
        }
        await page.locator('[data-order-detail-tab="photos"]').click();
        await expect(page.locator('[data-order-detail-tab="photos"]')).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.locator('[data-order-detail-photo-slots="true"]')).toBeVisible();
        await screenshot(page, `order-photos-${locale}-${width}`);
        await page.locator('[data-order-detail-tab="overview"]').click();
        const quote = page.locator("#mobile-order-quote");
        const quoteTrigger = await orderQuoteTrigger(page, locale);
        await quoteTrigger.click();
        const editor = page.locator("#mobile-order-finance-editor");
        await bottomEditor(page, editor, width, height);
        expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
          false,
        );
        const grid = editor.locator('[data-fault-diagnosis-picker="true"]');
        await readableQuoteGrid(grid);
        await readableQuoteRows(editor);
        await screenshot(page, `order-quote-${locale}-${width}`);
        await discloseQuoteContent(page, editor, `order-quote-expanded-${locale}-${width}`);
        const input = editor.locator("[data-order-quote-text-control]").first().getByRole("button");
        await editQuoteName(page, input, "Synthetic retained draft", locale);
        await page.keyboard.press("Escape");
        await editor.getByRole("button", { name: tr(locale, "orders.faultEditor.keep") }).click();
        await expect(input).toContainText("Synthetic retained draft");
        await expect(input).toBeFocused();
        await page.keyboard.press("Escape");
        await editor
          .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard") })
          .click();
        await expect(editor).toHaveCount(0);
        await expect(quote).not.toContainText("Synthetic retained draft");
      } else {
        await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
        await expect(page.getByText(longQuote.name, { exact: true }).first()).toBeVisible();
        await page.getByText(longQuote.name, { exact: true }).first().scrollIntoViewIfNeeded();
        await screenshot(page, `order-desktop-${locale}-${width}`);
        await quoteEdit.click();
        const editor = page.locator('[data-order-desktop-finance-editor="true"]');
        await expect(editor).toBeVisible();
        const name = editor.getByRole("button", {
          name: tr(locale, "orders2b2.overview.itemName", { index: 1 }),
          exact: true,
        });
        const note = editor.getByRole("button", {
          name: tr(locale, "orders2b2.overview.itemNote", { index: 1 }),
          exact: true,
        });
        await expect(name).toContainText(longQuote.name);
        await expect(note).toContainText(longQuote.note);
        await note.scrollIntoViewIfNeeded();
        for (const field of [name, note]) {
          expect(await field.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(
            true,
          );
        }
        await screenshot(page, `quote-multilingual-detail-edit-${locale}-${width}`);
        await discloseQuoteContent(page, editor, `quote-detail-edit-expanded-${locale}-${width}`);
        await note.click();
        const specification = page.locator('[data-order-quote-popup="true"]');
        await expect(specification).toBeFocused();
        await expect(specification.getByRole("textbox")).toHaveValue(longQuote.note);
        await expect(specification.getByRole("textbox")).not.toBeFocused();
        await noOverflow(page);
        await page.keyboard.press("Escape");
        await expect(specification).toHaveCount(0);
        await expect(note).toBeFocused();
        await editQuoteName(page, name, "Synthetic retained catalog-name draft", locale);
        await editQuoteName(page, note, "Synthetic retained specification draft", locale);
        await expect(name).toContainText("Synthetic retained catalog-name draft");
        await expect(note).toContainText("Synthetic retained specification draft");
        await page.keyboard.press("Escape");
        await editor
          .getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true })
          .click();
        await expect(name).toContainText("Synthetic retained catalog-name draft");
        await expect(note).toContainText("Synthetic retained specification draft");
        await page.keyboard.press("Escape");
        await editor
          .getByRole("button", {
            name: tr(locale, "orders.faultEditor.confirmDiscard"),
            exact: true,
          })
          .click();
        await expect(editor).toHaveCount(0);
        await expect(quoteEdit).toBeFocused();
        await expect(page.getByText(longQuote.name, { exact: true }).first()).toBeVisible();
        await quoteEdit.click();
        await expect(name).toContainText(longQuote.name);
        await expect(note).toContainText(longQuote.note);
        await page.keyboard.press("Escape");
        await expect(editor).toHaveCount(0);
      }
      await page.goto("/orders/new");
      // As in the existing new-order stories, let streaming and store bootstrap settle.
      // Assert one renderer after readiness instead of matching hidden initialization DOM.
      await page.waitForLoadState("networkidle");
      const forms = page.locator('[data-new-order-form="true"]');
      await expect(forms).toHaveCount(1);
      const form = forms.filter({ visible: true });
      await expect(form).toHaveCount(1);
      await expect(form).toBeVisible();
      const grid = form.locator('[data-fault-diagnosis-picker="true"]');
      await readableQuoteGrid(grid);
      if (width < 768) {
        const title = page
          .getByText(tr(locale, "orders2b1.new.shortTitle"), { exact: true })
          .filter({ visible: true });
        expect((await title.boundingBox())!.width).toBeGreaterThan(60);
        expect(await title.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      const main = grid.locator("[data-fault-category]").first().getByRole("button").first();
      await main.click();
      await expect(main).toHaveAttribute("aria-pressed", "true");
      const amountRow = form.locator("[data-order-workspace-quote-row]").first();
      if (width < 1024) {
        await amountRow.locator("[data-money-keypad-trigger]").click();
        await page.locator('[data-money-keypad-key="clear"]').click();
        for (const key of quoteAmount)
          await page.locator(`[data-money-keypad-key="${key}"]`).click();
        await page.locator("[data-money-keypad-done]").click();
        await expect(amountRow.locator("[data-money-keypad-trigger]")).toContainText(quoteAmount);
      } else {
        await amountRow.getByRole("textbox").fill(quoteAmount);
        await amountRow.getByRole("textbox").blur();
        await expect(amountRow.getByRole("textbox")).toHaveValue(quoteAmount);
      }
      await form
        .getByRole("button", { name: tr(locale, "orders2b1.new.addCustomItem"), exact: true })
        .click();
      await editQuoteName(
        page,
        form.getByRole("button", { name: tr(locale, "orders2b1.new.customItem"), exact: true }),
        longQuote.name,
        locale,
      );
      const deposit = form.locator("[data-order-workspace-money-strip]");
      if (width < 1024) {
        await deposit.locator("[data-money-keypad-trigger]").click();
        await page.locator('[data-money-keypad-key="clear"]').click();
        for (const key of "1234.56") await page.locator(`[data-money-keypad-key="${key}"]`).click();
        await page.locator("[data-money-keypad-done]").click();
        await expect(deposit.locator("[data-money-keypad-trigger]")).toContainText("1234.56");
      } else {
        await deposit.getByRole("textbox").fill("1234.56");
        await deposit.getByRole("textbox").blur();
      }
      await readableQuoteRows(form);
      await screenshot(page, `quote-multilingual-new-${locale}-${width}`);
      await discloseQuoteContent(page, form, `quote-new-expanded-${locale}-${width}`);
      const trigger = grid.locator("[data-fault-category-expand]").first();
      await trigger.click();
      const options = page.getByRole("dialog").filter({ visible: true }).last();
      await expect(options).toBeVisible();
      await expect(options).toHaveCSS("opacity", "1");
      if (width < 1024) await bottomEditor(page, options, width, height);
      await options
        .getByRole("button", { name: tr(locale, "orders2b1.new.fault.inspect"), exact: true })
        .click();
      await options.getByRole("group").getByRole("button").last().focus();
      await options.getByRole("group").getByRole("button").last().scrollIntoViewIfNeeded();
      await expect(options.getByRole("group").getByRole("button").last()).toBeFocused();
      await expect(options.getByRole("group").getByRole("button").last()).toBeInViewport();
      const clippedOptions = await options
        .getByRole("group")
        .getByRole("button")
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (node) =>
                node.scrollWidth > node.clientWidth + 1 ||
                node.scrollHeight > node.clientHeight + 1,
            ).length,
        );
      expect(clippedOptions).toBe(0);
      await screenshot(page, `new-order-options-${locale}-${width}`);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await noOverflow(page);
      expect(errors).toEqual([]);
    });
  }

test("customer long form retains draft and keeps footer reachable at compressed height", async ({
  page,
}) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await setKeyboardDeviceViewport(page, { width: 320, height: 350 });
  await page.goto("/customers/cus_1");
  await expect(page.getByRole("button", { name: "编辑客户资料" }).first()).toBeVisible();
  await page.getByRole("button", { name: "编辑客户资料" }).last().click();
  const editor = page.getByRole("dialog").filter({ visible: true }).last();
  await bottomEditor(page, editor, 320, 350);
  const field = editor.locator("input").first();
  await field.fill("Synthetic retained customer");
  const save = editor.getByRole("button", { name: "保存", exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await screenshot(page, "customer-editor-320x350");
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "继续编辑" }).click();
  await expect(field).toHaveValue("Synthetic retained customer");
  await noOverflow(page);
});

test("pointer opening restores the actual content trigger for order and customer", async ({
  page,
}) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await setKeyboardDeviceViewport(page, { width: 390, height: 844 });
  await page.goto("/orders/ord_1");
  const opener = await orderQuoteTrigger(page, "zh-CN");
  await opener.click();
  const editor = page.locator("#mobile-order-finance-editor");
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.goto("/customers/cus_1");
  const customer = page.getByRole("button", { name: "编辑客户资料" }).last();
  await customer.click();
  const customerEditor = page.getByRole("dialog").filter({ visible: true }).last();
  await expect(customerEditor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(customerEditor).toHaveCount(0);
  await expect(customer).toBeFocused();
});

for (const width of [320, 390, 768]) {
  test(`A13 scoped editors and supplier ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const height = width === 320 ? 568 : width === 390 ? 844 : 1000;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await setKeyboardDeviceViewport(page, { width, height });
    await page.route("**/api/repairdesk/options", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.suppliers = [
        {
          id: "a13-supplier-one",
          name: "Synthetic Parts",
          short_name: "Synthetic Parts",
          color: "var(--primary)",
        },
        {
          id: "a13-supplier-two",
          name: "Synthetic Components",
          short_name: "SC",
          color: "var(--primary)",
        },
      ];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/orders/ord_1");
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toBe("");
    await (await orderQuoteTrigger(page, "zh-CN")).click();
    const editor = page.locator("#mobile-order-finance-editor");
    await bottomEditor(page, editor, width, height);
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    await editor.getByRole("button", { name: tr("zh-CN", "orders2b2.finance.add") }).click();
    const emptyRow = editor.locator("[data-order-workspace-quote-row]").last();
    await expect(emptyRow.locator("[data-money-keypad-trigger]")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await editQuoteName(
      page,
      emptyRow.getByRole("button", { name: tr("zh-CN", "orders2b2.finance.item"), exact: true }),
      "Synthetic incomplete quote",
      "zh-CN",
    );
    await expect(emptyRow.locator("[data-money-keypad-trigger]")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await emptyRow
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.deleteItem") })
      .click();
    const battery = editor.locator('[data-fault-category="battery"]').getByRole("button").first();
    await battery.click();
    const newPrice = editor
      .locator("[data-order-workspace-quote-row]")
      .last()
      .locator("[data-money-keypad-trigger]");
    await expect(newPrice).toHaveAttribute("aria-invalid", "true");
    await expect(editor.getByRole("alert")).toContainText(
      tr("zh-CN", "orders2b2.finance.completeItem"),
    );
    await newPrice.click();
    await editor.locator('[data-money-keypad-key="0"]').click();
    await editor.locator("[data-money-keypad-done]").click();
    await expect(newPrice).not.toHaveAttribute("aria-invalid", "true");
    await expect(newPrice).toContainText("0");
    await battery.click();
    const price = editor.locator("[data-money-keypad-trigger]").first();
    await price.click();
    const keypad = editor.locator("[data-virtual-keyboard-host] [data-money-keypad]");
    await expect(keypad).toBeVisible();
    await keypad.locator('[data-money-keypad-key="clear"]').click();
    await keypad.locator('[data-money-keypad-key="1"]').click();
    await keypad.locator('[data-money-keypad-key="."]').click();
    await keypad.locator('[data-money-keypad-key="5"]').click();
    await expect(keypad).toContainText("1.5");
    await expect(keypad.locator("[data-money-keypad-done]")).toBeInViewport();
    await noOverflow(page);
    await screenshot(page, `a13-quote-keypad-${width}`);
    await page.keyboard.press("Escape");
    await expect(keypad).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(price).toBeFocused();
    await expect(price).toContainText("1.5");
    await price.click();
    await editor.locator("[data-money-keypad-done]").click();
    await expect(editor).toBeVisible();
    await expect(price).toBeFocused();
    const name = editor
      .getByRole("button", { name: tr("zh-CN", "orders2b2.finance.item"), exact: true })
      .first();
    await price.click();
    await name.click();
    await expect(page.locator('[data-order-quote-popup="true"]')).toBeFocused();
    await expect(keypad).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-order-quote-popup="true"]')).toHaveCount(0);
    await expect(name).toBeFocused();
    await page.keyboard.press("Escape");
    await editor.getByRole("button", { name: tr("zh-CN", "orders.faultEditor.keep") }).click();
    await expect(price).toContainText("1.5");
    await page.keyboard.press("Escape");
    await editor
      .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.confirmDiscard") })
      .click();
    await expect(editor).toHaveCount(0);

    await page.locator("[data-order-supplier-trigger]").filter({ visible: true }).last().click();
    const supplier = page.getByRole("dialog").filter({ visible: true }).last();
    const manage = supplier.getByRole("link", { name: "编辑供应商列表（新页面）" });
    await expect(manage).toHaveAttribute("href", "/settings?section=suppliers");
    await expect(manage).toHaveAttribute("target", "_blank");
    await expect(manage).toHaveAttribute("rel", "noopener noreferrer");
    await screenshot(page, `a13-supplier-picker-${width}`);
    await page.keyboard.press("Escape");
    await page.goto("/customers/cus_1");
    await expect(page.getByRole("button", { name: "编辑客户资料" })).toHaveCount(1);
    await page.getByRole("button", { name: "编辑客户资料" }).click();
    const customer = page.getByRole("dialog").filter({ visible: true }).last();
    await bottomEditor(page, customer, width, height);
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    await customer.locator("#customer-edit-phone").click();
    const phoneKeypad = customer.locator("[data-phone-keypad]");
    await expect(phoneKeypad).toBeVisible();
    await expect(phoneKeypad.locator("[data-phone-keypad-done]")).toBeInViewport();
    await screenshot(page, `a13-customer-keypad-${width}`);
    await phoneKeypad.locator("[data-phone-keypad-done]").click();
    const save = customer.getByRole("button", { name: "保存", exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("A13 customer tablet and desktop each expose one editing surface", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  for (const width of [768, 1024]) {
    await setKeyboardDeviceViewport(page, { width, height: 1000 });
    await page.goto("/customers/cus_1");
    const trigger = page.getByRole("button", { name: "编辑客户资料" });
    await expect(trigger).toHaveCount(1);
    await expect(page.locator('[data-ui="customer-detail-mobile-header"]')).toBeVisible({
      visible: width < 1024,
    });
    await expect(page.locator('[data-ui="customer-detail-desktop-hero"]')).toBeVisible({
      visible: width >= 1024,
    });
    await expect(page.locator('[data-app-bar="true"]')).toBeVisible({
      visible: width >= 1024,
    });
    await trigger.click();
    const editor = page.getByRole("dialog").filter({ visible: true });
    await expect(editor).toHaveCount(1);
    await expect(editor).toBeVisible();
    await noOverflow(page);
    await page.keyboard.press("Escape");
  }
});

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [430, 844],
  [768, 1000],
  [320, 350],
]) {
  test(`A14 aligned quote identity and notes ${width}x${height}`, async ({ page }) => {
    test.setTimeout(60000);
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await setKeyboardDeviceViewport(page, { width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/orders/ord_1");
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    await (await orderQuoteTrigger(page, "zh-CN")).click();
    const quote = page.locator("#mobile-order-finance-editor");
    await bottomEditor(page, quote, width, height);
    expect((await quote.locator("[data-editor-header]").boundingBox())!.height).toBe(52);
    const categoryGrid = quote.locator('[data-fault-diagnosis-picker="true"]');
    await readableQuoteGrid(categoryGrid);
    const rows = quote.locator('[data-order-workspace-quote-row="true"]');
    for (const row of await rows.all()) {
      const rects = await row.evaluate((node) =>
        Array.from(node.children)
          .slice(0, 3)
          .map((child) => {
            const control =
              child.querySelector(
                "textarea, input, [data-money-keypad-trigger], [data-money-keypad-native-input], button",
              ) ?? child;
            const rect = control.getBoundingClientRect();
            return { y: rect.y, height: rect.height };
          }),
      );
      expect(
        Math.max(...rects.map((r) => r.y)) - Math.min(...rects.map((r) => r.y)),
      ).toBeLessThanOrEqual(1);
      rects.forEach((r) => expect(r.height).toBeGreaterThanOrEqual(36));
    }
    const tiles = await quote
      .locator("[data-order-workspace-money-strip] > div")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.max(...tiles) - Math.min(...tiles)).toBeLessThanOrEqual(1);
    tiles.forEach((height) => expect(height).toBeGreaterThanOrEqual(60));
    await screenshot(page, width === 390 ? "a14-quote-390" : `dense-quote-${width}x${height}`);
    await page.keyboard.press("Escape");
    await expect(quote).toHaveCount(0);

    await page
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.deviceIssue"), exact: true })
      .click();
    const device = page.locator('[data-order-identity-editor="device"]');
    await bottomEditor(page, device, width, height);
    const close = device
      .getByRole("button", { name: "取消", exact: true })
      .filter({ has: page.locator("svg.lucide-x") });
    await device
      .locator("[data-editor-body]")
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    const closeRect = (await close.boundingBox())!;
    expect(closeRect.width).toBeGreaterThanOrEqual(44);
    expect(closeRect.height).toBeGreaterThanOrEqual(44);
    expect(
      await close.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    const footerButtons = device.locator("[data-editor-footer] > button");
    const footerRects = await footerButtons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(Math.abs(footerRects[0]!.y - footerRects[1]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(footerRects[0]!.width - footerRects[1]!.width)).toBeLessThanOrEqual(1);
    footerRects.forEach((r) => expect(r.height).toBeGreaterThanOrEqual(44));
    await device.locator("[data-editor-body]").evaluate((node) => (node.scrollTop = 0));
    if (width === 390) {
      await expect(
        device.getByRole("heading", { name: tr("zh-CN", "orders2b1.new.deviceInfo"), exact: true }),
      ).toBeVisible();
      await screenshot(page, "a14-device-390");
      const camera = device.getByRole("button").filter({ has: page.locator("svg.lucide-camera") });
      await camera.click();
      const capture = page.getByRole("dialog").filter({
        has: page.getByRole("heading", {
          name: tr("zh-CN", "inventory2b4.scanner.title"),
          exact: true,
        }),
      });
      await expect(capture).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(capture).toHaveCount(0);
      await expect(camera).toBeFocused();
      await expect(device).toBeVisible();
    }
    if (width !== 390) await screenshot(page, `dense-device-${width}x${height}`);
    await close.click();
    await expect(device).toHaveCount(0);

    const notesTrigger = page.getByRole("button", {
      name: tr("zh-CN", "orders.faultEditor.title"),
      exact: true,
    });
    await revealShortScreenControl(page, notesTrigger);
    await notesTrigger.click();
    const notes = page
      .getByRole("dialog")
      .filter({ has: page.locator('[data-order-fault-editor="true"]') });
    await expect(notes.getByRole("textbox")).toHaveCount(1);
    await expect(notes.getByRole("textbox")).toHaveAccessibleName(
      tr("zh-CN", "orders.notes.label"),
    );
    await expect(notes.getByText(tr("zh-CN", "orders.faultEditor.references"))).toHaveCount(0);
    expect(
      await notes.getByRole("textbox").evaluate((node) => node.getBoundingClientRect().height),
    ).toBeCloseTo(104, 1);
    await screenshot(page, width === 390 ? "a14-notes-390" : `dense-notes-${width}x${height}`);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.customerInfo"), exact: true })
      .click();
    const customer = page.locator('[data-order-identity-editor="customer"]');
    await bottomEditor(page, customer, width, height);
    await expect(customer.locator("[data-customer-identity-review]")).toBeVisible();
    await expect(
      customer.getByText(tr("zh-CN", "orders.faultEditor.dirty"), { exact: true }),
    ).toHaveCount(0);
    await expect(customer.locator("[data-customer-identity-results]")).toBeVisible();
    await expect(customer.getByRole("option")).toHaveCount(0);
    if (width === 390) {
      const phone = customer.locator("[data-phone-keypad-trigger]");
      await phone.click();
      await page.locator('[data-phone-keypad-key="clear"]').click();
      for (const digit of "13800000000")
        await page.locator(`[data-phone-keypad-key="${digit}"]`).click();
      await page.locator("[data-phone-keypad-done]").click();
      await expect(customer.getByRole("listitem")).toHaveCount(1);
      await expect(customer.getByRole("listitem").first()).toContainText("13800000000");
      await screenshot(page, "a14-customer-390");
    }
    if (width !== 390) await screenshot(page, `dense-customer-${width}x${height}`);
    for (const control of await customer.locator("input,textarea").all()) {
      expect(
        await control.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 430, 768, 1024, 1440]) {
  test(`A14 new quote shared density ${width}px`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await setKeyboardDeviceViewport(page, { width, height: 1000 });
    await page.goto("/orders/new");
    await page.waitForLoadState("networkidle");
    const form = page.locator('[data-new-order-form="true"]').filter({ visible: true });
    if (width < 768) await page.locator('[data-mobile-edit="device"]').click();
    for (const id of ["new-order-device-brand", "new-order-device-model"]) {
      const field = page.locator(`#${id}`);
      expect(
        await field.evaluate((node) => {
          const style = getComputedStyle(node);
          return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }),
      ).toBeGreaterThanOrEqual(80);
    }
    if (width === 390) {
      await page.locator("#new-order-device-brand").scrollIntoViewIfNeeded();
      await screenshot(page, "dense-new-device-readable-390");
    }
    if (width < 768)
      await page
        .getByRole("dialog")
        .getByRole("button", { name: tr("zh-CN", "common.close"), exact: true })
        .click();
    await form.locator("[data-fault-category]").first().getByRole("button").first().click();
    const rows = form.locator("[data-order-workspace-quote-row]");
    await expect(rows.first()).toBeVisible();
    await noOverflow(page);
    await screenshot(page, `a14-new-quote-${width}`);
  });
}

test("A14 Italian short-height keypad keeps close save and done reachable", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL() }]);
  await setKeyboardDeviceViewport(page, { width: 320, height: 350 });
  await page.goto("/orders/ord_1");
  const quoteTrigger = await orderQuoteTrigger(page, "it-IT");
  await expect(quoteTrigger).toBeVisible();
  // Native scroll-into-view ignores the fixed header and action dock. Position the
  // actual click point in the visible content strip before exercising the keypad.
  await quoteTrigger.evaluate((node) => {
    const top =
      document.querySelector("[data-mobile-order-header]")?.getBoundingClientRect().bottom ?? 0;
    const bottom =
      document.querySelector("[data-mobile-order-action-dock]")?.getBoundingClientRect().top ??
      innerHeight;
    const rect = node.getBoundingClientRect();
    window.scrollBy(0, rect.y + rect.height / 2 - (top + bottom) / 2);
  });
  await expect
    .poll(() =>
      quoteTrigger.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    )
    .toBe(true);
  await quoteTrigger.click();
  const editor = page.locator("#mobile-order-finance-editor");
  const price = editor.locator("[data-money-keypad-trigger]").first();
  await price.click();
  const keypad = editor.locator("[data-money-keypad]");
  await keypad.locator('[data-money-keypad-key="clear"]').click();
  await keypad.locator('[data-money-keypad-key="1"]').click();
  const close = editor.getByRole("button").filter({ has: page.locator("svg.lucide-x") });
  const save = editor
    .locator("[data-editor-footer]")
    .getByRole("button", { name: tr("it-IT", "orders2b2.hero.save"), exact: true });
  const done = keypad.locator("[data-money-keypad-done]");
  await done.scrollIntoViewIfNeeded();
  for (const control of [close, save, done]) {
    await expect(control).toBeInViewport();
    expect(
      await control.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    ).toBe(true);
  }
  await screenshot(page, "a14-keypad-it-320x350");
  await page.keyboard.press("Escape");
  await expect(keypad).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(price).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    editor.getByRole("button", { name: tr("it-IT", "orders.faultEditor.keep") }),
  ).toBeVisible();
  await editor.getByRole("button", { name: tr("it-IT", "orders.faultEditor.keep") }).click();
  await expect(price).toContainText("1");
  await noOverflow(page);
});

test("A14 dense notes keep the draft through pending and failed save", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await setKeyboardDeviceViewport(page, { width: 390, height: 844 });
  await page.goto("/orders/ord_1");
  await page
    .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.title"), exact: true })
    .click();
  const notes = page
    .getByRole("dialog")
    .filter({ has: page.locator('[data-order-fault-editor="true"]') });
  const draft = "合成测试备注：保留配件并检查屏幕。".repeat(12);
  await notes.getByRole("textbox").fill(draft);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/repairdesk/order/patch", async (route) => {
    await pending;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic save unavailable" }),
    });
  });
  await notes
    .getByRole("button", { name: tr("zh-CN", "orders2b2.hero.save"), exact: true })
    .click();
  await expect(notes.getByRole("textbox")).toBeDisabled();
  await screenshot(page, "dense-notes-pending-390");
  release();
  await expect(notes.getByRole("alert")).toBeVisible();
  await expect(notes.getByRole("textbox")).toHaveValue(draft);
  await expect(notes.getByRole("textbox")).toBeEnabled();
  await screenshot(page, "dense-notes-error-390");
  await page.keyboard.press("Escape");
  await notes
    .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.keep"), exact: true })
    .click();
  await expect(notes.getByRole("textbox")).toHaveValue(draft);
  await noOverflow(page);
});

test("A14 dense inline fields expose the enclosing keyboard focus ring", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await setKeyboardDeviceViewport(page, { width: 390, height: 844 });
  await page.goto("/orders/ord_1");
  await page
    .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.deviceIssue"), exact: true })
    .click();
  const device = page.locator('[data-order-identity-editor="device"]');
  const brand = device.getByRole("textbox", {
    name: tr("zh-CN", "customers.form.brand"),
    exact: true,
  });
  await brand.focus();
  expect(
    await brand.evaluate((node) => {
      const field = node.parentElement!.parentElement!;
      const style = getComputedStyle(field);
      return (
        field.matches(":focus-within") &&
        style.boxShadow !== "none" &&
        style.boxShadow.includes("2px")
      );
    }),
  ).toBe(true);
  await screenshot(page, "dense-device-keyboard-focus-390");
});
