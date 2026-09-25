import { runEvidencePath } from "./helpers/evidence";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { translateMessage } from "@/shared/i18n/messages";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Isolated synthetic preview only.");
const evidence = resolve(
  runEvidencePath(
    "artifacts/TASK-20260912-002-ui-consistency-framework/fullscreen-run3/final-previews",
  ),
);
for (const viewport of [
  { width: 390, height: 844, locale: "zh-CN" },
  { width: 820, height: 1180, locale: "it-IT" },
  { width: 1180, height: 700, locale: "en" },
  { width: 1440, height: 900, locale: "zh-CN" },
] as const) {
  test(`customer, memo and settings workspace ${viewport.width} ${viewport.locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await mkdir(evidence, { recursive: true });
    expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(baseURL!).origin
        ? route.continue()
        : route.abort(),
    );
    await context.addCookies([
      { name: "repairdesk_locale", value: viewport.locale, url: baseURL! },
    ]);
    await page.setViewportSize(viewport);
    const t = (key: Parameters<typeof translateMessage>[1]) =>
      translateMessage(viewport.locale, key);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let writes = 0;
    await page.route(
      "**/api/repairdesk/{customer/update,memos/create,memos/update,settings/store/update}",
      (route) => {
        writes++;
        return route.fulfill({ status: 503, json: { error: "SYNTHETIC write blocked" } });
      },
    );

    await page.goto("/customers/cus_1");
    await page.getByRole("button", { name: t("customers.detail.edit"), exact: true }).click();
    const customer = page.getByRole("dialog").filter({ visible: true });
    await workspaceGeometry(page, customer, viewport.width);
    const name = customer.locator("#customer-edit-name");
    const initialName = await name.inputValue();
    await name.fill("SYNTHETIC workbench preview");
    await screenshot(page, `${viewport.width}-customer-editor`);
    await customer.getByRole("button", { name: t("customers.form.cancel"), exact: true }).click();
    await expect(customer).toHaveAttribute("data-confirm-discard", "true");
    if (viewport.width >= 768)
      await expect
        .poll(async () => (await customer.boundingBox())!.height)
        .toBeLessThan(viewport.height / 2);
    if (viewport.width >= 1024)
      await expect
        .poll(async () => (await customer.boundingBox())!.width)
        .toBeLessThan(viewport.width - 24);
    await customer.getByRole("button", { name: t("orders.faultEditor.keep"), exact: true }).click();
    await expect(name).toHaveValue("SYNTHETIC workbench preview");
    await name.fill(initialName);
    await customer.getByRole("button", { name: t("customers.form.cancel"), exact: true }).click();
    await expect(customer).toHaveCount(0);

    await page.goto("/memos?new=1");
    const memo = page.getByRole("dialog").filter({ visible: true });
    await workspaceGeometry(page, memo, viewport.width);
    await memo.locator("#memo-title").fill("SYNTHETIC handover note");
    await expect(memo.locator("#memo-title")).toHaveValue("SYNTHETIC handover note");
    await memo.locator('button[type="submit"]').scrollIntoViewIfNeeded();
    await expect(memo.locator('button[type="submit"]')).toBeInViewport({ ratio: 1 });
    await screenshot(page, `${viewport.width}-memo-editor`);
    await memo.locator("#memo-title").fill("");
    await page.keyboard.press("Escape");
    await expect(memo).toHaveCount(0);

    await page.goto("/settings?section=notifications");
    const settings = page.locator("[data-settings-notifications-section]");
    await expect(settings).toBeVisible();
    const signature = settings.locator("#message-signature");
    const initialSignature = await signature.inputValue();
    await signature.fill("SYNTHETIC preview · draft only");
    for (const action of await page.locator("[data-settings-save-bar] button").all())
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (viewport.width >= 768) {
      const preview = settings.locator("[data-settings-inline-preview]");
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("SYNTHETIC preview · draft only");
      const inputsBox = (await signature.boundingBox())!;
      const previewBox = (await preview.boundingBox())!;
      expect(previewBox.x).toBeGreaterThan(inputsBox.x + inputsBox.width);
    }
    await screenshot(page, `${viewport.width}-notification-preview`);
    await signature.fill(initialSignature);
    expect(writes).toBe(0);
    expect(errors).toEqual([]);
  });
}

async function workspaceGeometry(page: Page, surface: Locator, width: number) {
  await expect(surface).toHaveCount(1);
  await expect(surface).toBeVisible();
  if (width >= 768) {
    await expect(surface).toHaveClass(/task-workspace/);
    await expect
      .poll(async () => Math.round((await surface.boundingBox())!.width))
      .toBe(width - 24);
    expect(Math.round((await surface.boundingBox())!.y)).toBe(12);
    for (const action of await surface.locator("[data-editor-footer] button").all())
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: resolve(evidence, `${name}.png`),
    fullPage: false,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
}
