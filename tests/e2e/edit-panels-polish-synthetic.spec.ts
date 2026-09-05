import { expect, test, type Page, type Locator } from "@playwright/test";
import { resolve } from "node:path";
import { translateMessage } from "../../src/shared/i18n/messages";

if (process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1")
  throw new Error("Synthetic fixture mode required");
const evidence =
  process.env.REPAIRDESK_EVIDENCE_DIR ??
  "/private/tmp/repairdesk-edit-panels-polish-validation-20260905/screenshots";
async function stable(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await expect
    .poll(() => dialog.evaluate((element) => Math.round(element.getBoundingClientRect().width)))
    .toBeGreaterThan(200);
  const overflow = await dialog.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    width: window.innerWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  expect(overflow.left).toBeGreaterThanOrEqual(-1);
  expect(overflow.right).toBeLessThanOrEqual(overflow.width + 1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}
async function prepare(page: Page, width: number, locale = "zh-CN", height = 900) {
  await page.setViewportSize({ width, height });
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: locale, url: process.env.PLAYWRIGHT_BASE_URL! },
    ]);
}
async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "nextjs-portal { display:none !important }" });
  await page.screenshot({ path: resolve(evidence, `${name}.png`) });
}
for (const locale of ["zh-CN", "it-IT", "en"] as const)
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    test(`fault layout ${locale} ${width}`, async ({ page }) => {
      const t = (key: Parameters<typeof translateMessage>[1]) => translateMessage(locale, key);
      await prepare(page, width, locale, width === 768 ? 700 : 900);
      await page.route("**/api/repairdesk/order/get", async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        Object.assign(json.data.order, {
          issue_description:
            locale === "it-IT"
              ? "Il dispositivo si riavvia durante le chiamate e la connessione alla rete, soprattutto quando la batteria è quasi scarica. Verificare tutte le condizioni segnalate dal cliente."
              : "Synthetic fault",
          diagnosis_result: "Synthetic diagnosis",
          fault_prices:
            locale === "it-IT"
              ? [
                  {
                    name: "Verifica completa del connettore di ricarica e dei componenti della scheda logica con controllo approfondito",
                    price: 99,
                  },
                  { name: "Ultimo intervento di riferimento", price: 12 },
                ]
              : [],
        });
        Object.assign(json.data.capabilities, { canEditIntake: true, canEditRepair: true });
        await route.fulfill({ response, json });
      });
      await page.goto("/orders/ord_1");
      const root = page.locator('[data-order-detail-root="true"]');
      const trigger =
        width < 1024
          ? root
              .locator('[data-order-detail-issue-summary="true"]')
              .locator("..")
              .getByRole("button", { name: t("orders2b2.hero.edit"), exact: true })
          : root.getByRole("button", { name: t("orders.faultEditor.title"), exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: t("orders.faultEditor.title") });
      await stable(page, dialog);
      await expect(dialog.locator("[data-editor-state]")).toHaveText(
        t("orders.faultEditor.unchanged"),
      );
      if (width < 1024) {
        expect(
          await dialog.evaluate(
            () => !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? ""),
          ),
        ).toBe(true);
        for (const button of await dialog.locator("footer button").all())
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      } else {
        await expect(dialog.getByRole("textbox").first()).toBeFocused();
        expect((await dialog.locator("footer button").last().boundingBox())!.width).toBeLessThan(
          190,
        );
      }
      await shot(page, `fault-${locale}-${width}`);
      await dialog.getByRole("textbox").first().fill("Synthetic fault changed");
      await page.keyboard.press("Escape");
      await expect(
        dialog.getByRole("button", { name: t("orders.faultEditor.keep") }),
      ).toBeFocused();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      if (width === 390 || width === 1440) await shot(page, `confirm-${locale}-${width}`);
      await page.mouse.click(2, 2);
      await expect(dialog.locator('[data-editor-confirmation="confirmDiscard"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog.getByRole("textbox").first()).toHaveValue("Synthetic fault changed");
      await page.keyboard.press("Escape");
      await dialog.getByRole("button", { name: t("orders.faultEditor.confirmDiscard") }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => document.body.style.pointerEvents))
        .not.toBe("none");
    });
  }

for (const width of [390, 1440]) {
  test(`related editors ${width}: customer, device, tags, follow-up, memo, supplier, workflow, member, rename`, async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await prepare(page, width, "zh-CN", width === 390 ? 700 : 900);
    await page.route("**/api/repairdesk/shell/bootstrap", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      // This visual fixture enables only the existing rename entry; it never submits it.
      json.data.storeContext.lifecycleAccess.rename = { allowed: true, code: "available" };
      await route.fulfill({ response, json });
    });
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data.lifecycleAccess.rename = { allowed: true, code: "available" };
      await route.fulfill({ response, json });
    });
    const sensitiveWrites: string[] = [];
    await page.route("**/api/repairdesk/stores/lifecycle/rename", async (route) => {
      sensitiveWrites.push(route.request().url());
      await route.abort();
    });
    await page.goto("/customers/cus_1");
    async function capture(name: string, dialog: Locator) {
      await stable(page, dialog);
      await shot(page, `${name}-${width}`);
      const lastAction = dialog.locator("button:not(:has(svg.lucide-x))").last();
      await lastAction.scrollIntoViewIfNeeded();
      await expect(lastAction).toBeVisible();
      const actionBox = await lastAction.boundingBox();
      expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      await shot(page, `${name}-actions-${width}`);
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => document.body.style.pointerEvents))
        .not.toBe("none");
    }
    const editTrigger = page.getByRole("button", { name: "编辑客户资料", exact: true });
    await editTrigger.click();
    const customer = page.getByRole("dialog", { name: "编辑客户", exact: true });
    await customer.getByLabel("姓名", { exact: false }).fill("Synthetic customer draft");
    await capture("customer", customer);
    // Reopening resets at open, while the closed animation retains its previous content.
    await editTrigger.click();
    await expect(customer.getByLabel("姓名", { exact: false })).not.toHaveValue(
      "Synthetic customer draft",
    );
    await page.mouse.click(2, 2);
    await expect(customer).toHaveCount(0);
    await page.getByRole("tab", { name: /设备/ }).click();
    const addDevice = page.getByRole("button", { name: "添加设备", exact: true });
    await addDevice.click();
    const device = page.getByRole("dialog", { name: "添加设备", exact: true });
    await device.getByLabel("品牌", { exact: false }).fill("Synthetic brand");
    await capture("customer-device", device);
    await expect(addDevice).toBeFocused();
    await addDevice.click();
    await page.mouse.click(2, 2);
    await expect(device).toHaveCount(0);
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    const existingDevice = page.getByRole("dialog", { name: "编辑设备", exact: true });
    await stable(page, existingDevice);
    await existingDevice.getByLabel("品牌", { exact: false }).fill("Synthetic exit draft");
    await shot(page, `customer-device-edit-${width}`);
    const exitSnapshot = await existingDevice.evaluate(async (element) => {
      (element.querySelector("svg.lucide-x")!.closest("button") as HTMLButtonElement).click();
      await new Promise(requestAnimationFrame);
      return {
        state: element.getAttribute("data-state"),
        title: element.querySelector("h2")?.textContent,
        value: (element.querySelector("#customer-device-brand") as HTMLInputElement)?.value,
        connected: element.isConnected,
      };
    });
    expect(exitSnapshot).toEqual({
      state: "closed",
      title: "编辑设备",
      value: "Synthetic exit draft",
      connected: true,
    });
    await expect(existingDevice).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
    await page.getByRole("tab", { name: /资料/ }).click();
    await page.getByRole("button", { name: "管理标签", exact: true }).click();
    await capture("customer-tags", page.getByRole("dialog"));
    await page.getByRole("button", { name: "待办", exact: true }).last().click();
    await capture("customer-followup", page.getByRole("dialog"));
    await page.goto("/memos");
    await page.getByRole("button", { name: "新建备忘", exact: true }).click();
    await capture("memo", page.getByRole("dialog", { name: "新建备忘" }));
    await page.goto("/settings?section=suppliers");
    await page.getByRole("button", { name: "添加供应商", exact: true }).click();
    await capture("supplier", page.getByRole("dialog", { name: "添加供应商" }));
    await page.goto("/settings?section=workflow");
    await page.getByRole("button", { name: "编辑状态 新建", exact: true }).click();
    await capture("workflow", page.getByRole("dialog"));
    await page.goto("/settings?section=members");
    await page
      .locator('[data-member-id="10000000-0000-4000-8000-000000000003"]:visible')
      .getByRole("button", { name: "管理", exact: true })
      .click();
    await capture("member", page.getByRole("dialog", { name: "演示技术员" }));
    await page.goto("/settings?section=store");
    await page.getByRole("button", { name: /管理店铺与安全/ }).click();
    await page.getByRole("button", { name: "修改名称", exact: true }).click();
    await capture("store-rename", page.getByRole("dialog", { name: "修改店铺名称" }));
    expect(sensitiveWrites).toEqual([]);
  });
}

test("fault references, invalid, retry, readonly and reduced motion in a short touch viewport", async ({
  page,
}) => {
  await prepare(page, 390, "en", 620);
  await page.emulateMedia({ reducedMotion: "reduce" });
  let failReload = false;
  let rights = "all";
  let fail = "offline";
  await page.route("**/api/repairdesk/order/get", async (route) => {
    if (failReload) {
      await route.abort("failed");
      return;
    }
    const response = await route.fetch();
    const json = await response.json();
    Object.assign(json.data.order, {
      issue_description: "Synthetic fault",
      diagnosis_result: "Synthetic diagnosis",
      fault_prices: Array.from({ length: 18 }, (_, i) => ({
        name: `Repair reference ${String(i + 1).padStart(2, "0")} with long synthetic label`,
        price: 99,
      })),
    });
    Object.assign(json.data.capabilities, { canEditIntake: rights === "all", canEditRepair: true });
    await route.fulfill({ response, json });
  });
  const payloads: unknown[] = [];
  await page.route("**/api/repairdesk/order/patch", async (route) => {
    payloads.push(route.request().postDataJSON());
    if (fail === "offline") await route.abort("failed");
    else await route.fulfill({ status: 409, json: { error: "工单已被更新，请刷新后再试" } });
  });
  async function open() {
    await page.goto("/orders/ord_1");
    await page
      .locator("[data-order-detail-issue-summary]")
      .locator("..")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
  }
  await open();
  const dialog = page.getByRole("dialog", { name: "Edit fault and diagnosis" });
  await stable(page, dialog);
  expect(await dialog.evaluate((e) => e.getAnimations().length)).toBe(0);
  await dialog.getByRole("textbox").first().fill("   ");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("textbox").first()).toBeFocused();
  await expect(dialog.getByRole("textbox").first()).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("textbox").first().fill("Synthetic fault");
  await dialog.locator("summary").click();
  const last = dialog.getByRole("button", {
    name: "Add Repair reference 18 with long synthetic label to issue description",
  });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(dialog.getByRole("status")).toContainText("Added 1");
  await expect(last).toBeDisabled();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.locator("[data-editor-state]")).toContainText("Could not save");
  await shot(page, "failure-short-390");
  expect(payloads).toHaveLength(1);
  fail = "conflict";
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Load latest version" })).toBeVisible();
  failReload = true;
  await dialog.getByRole("button", { name: "Load latest version" }).click();
  await dialog.getByRole("button", { name: "Discard draft and reload" }).click();
  await expect(dialog.getByRole("textbox").first()).toHaveValue(/Repair reference 18/);
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await shot(page, "reload-failed-draft-retained-390");
  failReload = false;
  await dialog.getByRole("button", { name: "Load latest version" }).click();
  await dialog.getByRole("button", { name: "Discard draft and reload" }).click();
  await expect(dialog.getByRole("textbox").first()).toHaveValue("Synthetic fault");
  await dialog.getByRole("textbox").first().fill("Draft after successful reload");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  failReload = false;
  rights = "repair";
  await open();
  await expect(dialog.getByRole("textbox").first()).toHaveAttribute("readonly");
  await shot(page, "readonly-short-390");
  await page.keyboard.press("Escape");
});

for (const width of [1024, 1440])
  test(`list embedded fault editor ${width}: one modal and host close guards`, async ({ page }) => {
    await prepare(page, width, "en");
    let release!: () => void;
    const bodies: unknown[] = [];
    await page.route("**/api/repairdesk/order/patch", async (route) => {
      bodies.push(route.request().postDataJSON());
      await new Promise<void>((done) => (release = done));
      await route.fulfill({ json: { data: { id: "ord_1", updated_at: "2026-09-05T14:00:00Z" } } });
    });
    await page.goto("/orders");
    const row = page.getByRole("button", { name: /View order details R\d+/ }).first();
    await row.click();
    const workspace = page.locator("[data-order-detail-dialog-shell]");
    await expect(workspace).toBeVisible();
    const edit = workspace.getByRole("button", { name: "Edit fault and diagnosis", exact: true });
    await edit.click();
    const editor = workspace.locator("[data-order-fault-editor]");
    await expect(editor).toBeVisible();
    await stable(page, workspace);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(editor.getByRole("textbox").first()).toBeFocused();
    await editor.getByRole("textbox").first().fill("Synthetic embedded draft");
    await page.keyboard.press("Escape");
    await expect(editor.getByRole("button", { name: "Continue editing" })).toBeFocused();
    await page.mouse.click(1, 1);
    await expect(editor.locator('[data-editor-confirmation="confirmDiscard"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor.getByRole("textbox").first()).toHaveValue("Synthetic embedded draft");
    await shot(page, `embedded-${width}`);
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    await page.keyboard.press("Escape");
    await page.mouse.click(1, 1);
    await expect(
      editor.getByRole("button", { name: "Cancel", exact: true }).first(),
    ).toBeDisabled();
    await expect(editor).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(bodies).toHaveLength(1);
    release();
    await expect(editor).toHaveCount(0);
    await expect(edit).toBeFocused();
    await edit.click();
    await editor.getByRole("textbox").first().fill("Discard this draft");
    await page.keyboard.press("Escape");
    await editor.getByRole("button", { name: "Discard changes" }).click();
    await expect(editor).toHaveCount(0);
    await expect(edit).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(workspace).toHaveCount(0);
    await expect(row).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

for (const width of [390, 430, 768])
  test(`mobile unlock presentation ${width} preserves sensitive controls`, async ({ page }) => {
    await prepare(page, width, "zh-CN");
    const mutations: string[] = [];
    await page.route("**/api/repairdesk/order/patch", async (route) => {
      mutations.push(route.request().url());
      await route.abort();
    });
    await page.goto("/orders/ord_1");
    await page
      .getByRole("button", {
        name: translateMessage("zh-CN", "orders2b2.unlock.entry"),
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: translateMessage("zh-CN", "orders2b2.unlock.edit"),
    });
    await stable(page, dialog);
    await shot(page, `device-unlock-${width}`);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(mutations).toEqual([]);
  });
