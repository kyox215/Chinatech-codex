import { expect, test } from "@playwright/test";
import { getMemoPresentationCopy, translateMemoPresentation } from "../../src/shared/i18n/messages";
import { waitForApplicationReady } from "./helpers/app-ready";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Local mock memo acceptance only");

for (const scenario of [
  { width: 390, height: 844, locale: "zh-CN" as const },
  { width: 768, height: 1024, locale: "it-IT" as const },
  { width: 1440, height: 900, locale: "en" as const },
]) {
  test(`memo modern layout and saved checklist ${scenario.width} ${scenario.locale}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const copy = getMemoPresentationCopy(scenario.locale);
    const tr = (
      key: Parameters<typeof translateMemoPresentation>[1],
      values: Record<string, string | number>,
    ) => translateMemoPresentation(scenario.locale, key, values);
    const title = `手机壳 · ${scenario.width}-${Date.now().toString(36).slice(-5)}`;
    const models = ["iPhone 17 Pro 透明壳 ×3", "Huawei P20 Pro 透明壳", "OPPO A40M 黑色壳 ×2"];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().addCookies([
      {
        name: "repairdesk_locale",
        value: scenario.locale,
        url: String(testInfo.project.use.baseURL),
      },
    ]);
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto("/memos");
    await waitForApplicationReady(page);
    await page.getByRole("button", { name: copy.newMemo, exact: true }).first().click();
    const composer = page.getByRole("dialog");
    await composer.locator("#memo-title").fill(title);
    // Supply a real clipboard event without depending on operating-system clipboard permissions.
    {
      await composer.getByPlaceholder(copy.checklistPlaceholder).evaluate((element, lines) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", lines);
        element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true }));
      }, models.join("\n"));
    }
    await expect(composer.getByRole("checkbox")).toHaveCount(3);
    const completed = composer.getByRole("checkbox", {
      name: tr("checklistToggleAria", { item: models[2] }),
    });
    await completed.focus();
    await page.keyboard.press("Space");
    await expect(composer.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await composer
      .getByRole("button", { name: tr("completedChecklistItems", { count: 1 }) })
      .click();
    for (const checkbox of await composer.getByRole("checkbox").all()) {
      const box = await checkbox.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const longModel =
      "Samsung Galaxy Note 20 Ultra 5G — custodia trasparente con protezione della fotocamera — ".repeat(
        2,
      );
    const pendingInputs = composer.getByRole("textbox", { name: copy.checklistItemLabel });
    await pendingInputs.first().fill(longModel);
    await expect
      .poll(() => composer.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
    await pendingInputs.first().fill(models[0]);
    await composer.getByPlaceholder(copy.checklistPlaceholder).focus();
    if (scenario.width === 768) {
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(composer.locator("#memo-title")).toHaveValue(title);
      await expect(composer.getByRole("checkbox")).toHaveCount(3);
      await page.screenshot({ path: testInfo.outputPath("editor-ipad-landscape.png") });
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
    }
    await page.screenshot({
      path: testInfo.outputPath(`editor-${scenario.width}-${scenario.locale}.png`),
    });
    await composer.getByRole("button", { name: copy.addTodo, exact: true }).click();
    await expect(composer).toBeHidden();

    const search = page.locator(`input[placeholder="${copy.searchPlaceholder}"]:visible`);
    await search.fill(title);
    const openMemo = page.getByRole("button", { name: tr("openMemoAria", { title }) });
    await expect(openMemo).toBeVisible();
    await page
      .getByRole("button", { name: tr("checklistProgressAria", { completed: 1, total: 3 }) })
      .click();
    const article = page.locator("article[data-memo-id]").filter({ has: openMemo });
    await article
      .getByRole("button", { name: tr("completedChecklistItems", { count: 1 }) })
      .click();
    await expect(article.getByRole("checkbox")).toHaveCount(3);
    await expect(article.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await expect(page.locator("[data-sonner-toast]:visible")).toHaveCount(0, { timeout: 10_000 });
    await page.screenshot({
      path: testInfo.outputPath(`list-${scenario.width}-${scenario.locale}.png`),
    });
    await article
      .getByRole("checkbox", { name: tr("checklistToggleAria", { item: models[0] }) })
      .click();
    await expect(article.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    await page.reload();
    await waitForApplicationReady(page);
    await search.fill(title);
    await page
      .getByRole("button", { name: tr("checklistProgressAria", { completed: 2, total: 3 }) })
      .click();
    await expect(article.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    await article
      .getByRole("button", { name: tr("completedChecklistItems", { count: 2 }) })
      .click();
    await expect(
      article.getByRole("checkbox", { name: tr("checklistToggleAria", { item: models[0] }) }),
    ).toBeChecked();
    await article
      .getByRole("checkbox", { name: tr("checklistToggleAria", { item: models[0] }) })
      .click();
    await expect(article.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        article
          .getByRole("progressbar")
          .locator("div")
          .evaluate((element) => getComputedStyle(element).transitionProperty),
      )
      .toBe("none");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
