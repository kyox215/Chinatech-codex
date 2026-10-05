import { test, expect, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";
import { applyRetailCommand, currentRetailSale, parseStoredRetailUnits, retailPaidCents, retailSaleState, retailWarrantyTermsVersion, type RetailCommand, type RetailUnit } from "../../lib/retail";
import { customerId, customerSaleHref } from "../../lib/customers";
import { intakeRecordTime } from "../../lib/repair-intake-record";
import { defaultStoreSettings } from "../../lib/store-settings";

const unitKey = "chinatech.m1.retail.v1";
const phone = "+393200008801";
const buyer = "DEMO 闭环买家";
const email = "demo-flow@example.test";
const address = "DEMO 虚构销售地址 7";
const buyerNote = "DEMO 仅此交易的随件约定";
const fixture = (): RetailUnit => ({ ...structuredClone(retailUnits[0]), id: "demo-sales-flow-unit", code: "DEMO-FLOW-UNIT", model: "DEMO 闭环手机", serial: "DEMO-FLOW-SN", costCents: 13579, refurbCents: 1713 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { const state = window as typeof window & { demoPrintCalls?: number }; state.demoPrintCalls = (state.demoPrintCalls ?? 0) + 1; };
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "填入演示账号", exact: true }).click();
  await page.getByRole("button", { name: "登录工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

async function seedUnit(page: Page, unit: RetailUnit) {
  parseStoredRetailUnits(JSON.stringify({ version: 1, units: [unit] }), []);
  await page.evaluate(({ key, unit }) => localStorage.setItem(key, JSON.stringify({ version: 1, units: [unit] })), { key: unitKey, unit });
}

async function savedUnit(page: Page): Promise<RetailUnit> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).units[0], unitKey);
}

async function openGroup(page: Page, groupId: string) {
  const toggle = page.locator(`[data-retail-group="${groupId}"] > button[aria-controls]`);
  const group = page.locator(`[data-retail-group="${groupId}"]`);
  await expect(group).toBeVisible();
  if (await toggle.isVisible()) {
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await expect(group.locator(":scope > div[id]")).toBeVisible();
}

async function payment(page: Page, saleId: string, amount: string) {
  const card = page.locator(`[id="sale-${saleId}"]`);
  await card.getByRole("button", { name: "登记收款", exact: true }).click();
  const form = card.getByRole("region", { name: "登记收款", exact: true });
  await form.getByLabel("本次实际收款", { exact: true }).fill(amount);
  await form.getByRole("radio", { name: "现金", exact: true }).locator("..").click();
  await form.getByLabel("收款备注与核对依据", { exact: true }).fill(`DEMO 实际收款 ${amount}`);
  await form.getByRole("button", { name: "继续核对", exact: true }).click();
  await card.getByRole("button", { name: "确认保存业务记录", exact: true }).click();
  await expect(card.getByRole("button", { name: "关闭业务操作", exact: true })).toHaveCount(0);
}

test("售卖记录买家→分次收款→交付→三语打印→客户原销售可刷新追溯", async ({ page }, info) => {
  test.setTimeout(120000);
  const unit = fixture();
  await seedUnit(page, unit);
  await page.goto(`/app/retail/units/${unit.id}`);
  await openGroup(page, "actions");
  await page.getByRole("button", { name: "登记售出", exact: true }).click();
  const form = page.getByRole("region", { name: "登记售出", exact: true });
  await form.getByRole("combobox", { name: "客户手机号 *", exact: true }).fill(phone);
  await form.getByLabel("客户称呼（选填）", { exact: true }).fill(buyer);
  await form.getByLabel("买家邮箱", { exact: true }).fill(email);
  await form.getByLabel("买家地址", { exact: true }).fill(address);
  await form.getByLabel("买家备注", { exact: true }).fill(buyerNote);
  await form.getByLabel("本台成交价", { exact: true }).fill("260");
  await form.getByRole("checkbox", { name: /确认本次尚未收款/ }).check();
  await form.getByRole("button", { name: "继续核对售出", exact: true }).click();
  expect((await savedUnit(page)).sales).toHaveLength(0);
  await page.getByRole("checkbox", { name: /已与客户核对商品、成交价及保修条款/ }).check();
  await page.getByRole("button", { name: "确认登记售出", exact: true }).click();
  await expect(page.getByRole("button", { name: "关闭售出登记", exact: true })).toHaveCount(0);
  let saved = await savedUnit(page);
  const sale = currentRetailSale(saved)!;
  const card = page.locator(`[id="sale-${sale.id}"]`);
  await expect(card).toBeVisible();
  expect(saved.sales).toHaveLength(1);
  expect(sale.customerPhone).toBe(phone);
  expect(sale.customerEmail).toBe(email);
  expect(sale.customerAddress).toBe(address);
  expect(sale.customerNote).toBe(buyerNote);
  expect(retailPaidCents(sale)).toBe(0);
  expect(sale.delivered).toBe(false);
  await expect(card).toContainText("下一步：登记实际收款");
  await expect(card.getByRole("button", { name: "打印销售与保修单", exact: true })).toHaveCount(1);

  await card.getByRole("button", { name: "确认交付", exact: true }).click();
  await card.getByRole("button", { name: "继续核对", exact: true }).click();
  await expect(card.getByRole("alert")).toContainText("尚未结清");
  expect(currentRetailSale(await savedUnit(page))!.delivered).toBe(false);
  await card.getByRole("button", { name: "关闭业务操作", exact: true }).click();
  await payment(page, sale.id, "100");
  expect(retailPaidCents(currentRetailSale(await savedUnit(page))!)).toBe(10000);
  await page.reload();
  await openGroup(page, "sales");
  await expect(card).toContainText("€100.00");
  await payment(page, sale.id, "160");
  saved = await savedUnit(page);
  expect(currentRetailSale(saved)!.payments).toHaveLength(2);
  expect(retailSaleState(currentRetailSale(saved)!)).toBe("awaiting_delivery");
  await expect(card).toContainText("下一步：确认实际交付");
  await card.getByRole("button", { name: "确认交付", exact: true }).click();
  await card.getByRole("button", { name: "继续核对", exact: true }).click();
  await card.getByRole("button", { name: "确认保存业务记录", exact: true }).click();
  await expect(card).toContainText("销售已结清并交付");
  saved = await savedUnit(page);
  expect(retailSaleState(currentRetailSale(saved)!)).toBe("complete");
  expect(currentRetailSale(saved)!.deliveryDate).toBeTruthy();

  const savedBytes = JSON.stringify(saved);
  const print = card.getByRole("button", { name: "打印销售与保修单", exact: true });
  await print.click();
  const receipt = page.locator(".intake-receipt-dialog");
  for (const language of ["it", "en", "zh"]) {
    await receipt.locator(".intake-receipt-options select").nth(1).selectOption(language);
    const sheet = receipt.locator(".intake-receipt-sheet");
    await expect(sheet).toHaveAttribute("lang", language);
    await expect(sheet).toContainText(buyer);
    await expect(sheet).toContainText(email);
    await expect(sheet).toContainText(address);
    await expect(sheet).toContainText(buyerNote);
    await expect(sheet).toContainText(unit.serial);
    await expect(sheet).toContainText(/260[.,]00/);
    await expect(sheet).not.toContainText(/135[.,]79|17[.,]13/);
  }
  await receipt.locator(".intake-receipt-options select").first().selectOption("double");
  await expect(receipt.locator(".intake-receipt-sheet")).toHaveCount(2);
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("main.retail-detail")).not.toBeVisible();
  await expect(receipt.locator(".intake-receipt-toolbar").first()).not.toBeVisible();
  await expect(receipt.locator(".intake-receipt-sheet").first()).toBeVisible();
  await page.screenshot({ path: `.local/ui-proof/retail-sales-flow/${info.project.name}-print-double.png`, fullPage: true, animations: "disabled" });
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize(originalViewport);
  await receipt.getByRole("button", { name: "打印", exact: true }).click();
  expect(await page.evaluate(() => (window as typeof window & { demoPrintCalls?: number }).demoPrintCalls)).toBe(1);
  expect(JSON.stringify(await savedUnit(page))).toBe(savedBytes);
  await receipt.getByRole("button", { name: "关闭打印预览", exact: true }).click();
  await expect(print).toBeFocused();

  await card.getByRole("link", { name: `${buyer} · ${phone}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/customers/${customerId(phone)}\\?records=sales`));
  const records = page.getByRole("region", { name: "客户历史记录", exact: true });
  await expect(records).toContainText(email);
  await expect(records).toContainText(address);
  await expect(records).toContainText(buyerNote);
  await page.getByRole("button", { name: "编辑客户资料", exact: true }).click();
  await page.getByLabel("客户称呼（选填）", { exact: true }).fill("DEMO 更新后客户称呼");
  await page.getByLabel("电子邮件（选填）", { exact: true }).fill("current-demo@example.test");
  await page.getByLabel("客户备注（选填）", { exact: true }).fill("DEMO 长期联系备注");
  await page.getByRole("button", { name: "保存客户资料", exact: true }).click();
  await expect(page.getByRole("heading", { name: "DEMO 更新后客户称呼", exact: true })).toBeVisible();
  await expect(records).toContainText(`原销售买家：${buyer}`);
  await expect(records).toContainText(email);
  expect(JSON.stringify(await savedUnit(page))).toBe(savedBytes);
  const source = records.getByRole("link").filter({ hasText: unit.model });
  await expect(source).toHaveAttribute("href", customerSaleHref({ unitId: unit.id, id: sale.id }));
  await source.click();
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
  await page.reload();
  await expect(card).toContainText(buyer);
  await expect(card).toContainText("销售完成");
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await openGroup(page, "sales");
    await expect(print).toBeVisible();
    const box = await print.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `.local/ui-proof/retail-sales-flow/${info.project.name}-${width}.png`, fullPage: true, animations: "disabled" });
  }
});

test("同机退回再售后，客户入口展开原销售并打印原买家快照", async ({ page }) => {
  const day = intakeRecordTime().slice(0, 10);
  let unit = fixture();
  let index = 0;
  const apply = (command: RetailCommand) => { unit = applyRetailCommand(unit, command, { id: `DEMO-FLOW-${++index}`, time: intakeRecordTime(), title: "DEMO 合成闭环", detail: "DEMO 合成操作事实" }, unit.version); };
  const warranty = { months: unit.warrantyMonths, termsVersion: retailWarrantyTermsVersion, shopName: defaultStoreSettings.shopName, address: defaultStoreSettings.address, phone: defaultStoreSettings.phone };
  apply({ type: "sell", saleId: "DEMO-OLD-SALE", customerPhone: phone, customerName: buyer, customerEmail: email, customerAddress: address, priceCents: 24000, paymentUnreceived: true, warranty });
  apply({ type: "payment", saleId: "DEMO-OLD-SALE", entryId: "DEMO-OLD-PAYMENT", amountCents: 24000, date: day, method: "cash", note: "DEMO 原收款" });
  apply({ type: "deliver", saleId: "DEMO-OLD-SALE", deliveryDate: day });
  apply({ type: "return", saleId: "DEMO-OLD-SALE", date: day, reason: "DEMO 已收到原实物", received: true });
  apply({ type: "refund", saleId: "DEMO-OLD-SALE", entryId: "DEMO-OLD-REFUND", amountCents: 24000, date: day, method: "cash", note: "DEMO 原退款" });
  apply({ type: "reinspect" });
  apply({ type: "inspect", checks: { functional: true, ownership: true, data: true } });
  apply({ type: "approve" });
  apply({ type: "sell", saleId: "DEMO-NEW-SALE", customerPhone: "+393200008802", customerName: "DEMO 后一位买家", priceCents: 26000, paymentUnreceived: true, warranty });
  await seedUnit(page, unit);
  await page.goto(`/app/customers/${customerId(phone)}?records=sales`);
  const original = page.getByRole("region", { name: "客户历史记录", exact: true }).getByRole("link");
  await expect(original).toHaveAttribute("href", customerSaleHref({ unitId: unit.id, id: "DEMO-OLD-SALE" }));
  await original.click();
  const card = page.locator('[id="sale-DEMO-OLD-SALE"]');
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
  await expect(card).toContainText(buyer);
  await card.getByRole("button", { name: "打印销售与保修单", exact: true }).click();
  const receipt = page.locator(".intake-receipt-dialog");
  await expect(receipt.locator(".intake-receipt-sheet")).toContainText(buyer);
  await expect(receipt.locator(".intake-receipt-sheet")).toContainText(email);
  await expect(receipt.locator(".intake-receipt-sheet")).toContainText(/240[.,]00/);
  await expect(receipt.locator(".intake-receipt-sheet")).not.toContainText("DEMO 后一位买家");
});

test("已有客户带入当前联系方式，换号码清理候选值并保留手填资料，取消不登记销售", async ({ page }) => {
  const available = fixture();
  const candidatePhone = "+393200008804";
  const past = { ...fixture(), id: "DEMO-PAST-UNIT", code: "DEMO-PAST-CODE", serial: "DEMO-PAST-SN", imei1: "", imei2: "" };
  const history = applyRetailCommand(past, { type: "sell", saleId: "DEMO-PAST-SALE", customerPhone: candidatePhone, customerName: "DEMO 原称呼", customerEmail: "past@example.test", customerAddress: "DEMO 原销售联系地址", priceCents: 26000, paymentUnreceived: true, warranty: { months: past.warrantyMonths, termsVersion: retailWarrantyTermsVersion, shopName: defaultStoreSettings.shopName, address: defaultStoreSettings.address, phone: defaultStoreSettings.phone } }, { id: "DEMO-SEED-SALE", time: intakeRecordTime(), title: "DEMO合成销售", detail: "DEMO合成资料" }, past.version);
  parseStoredRetailUnits(JSON.stringify({ version: 1, units: [available, history] }), []);
  await page.evaluate(({ available, history, phone, time }) => {
    localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units: [available, history] }));
    localStorage.setItem("chinatech.m1.customer-profiles.v1", JSON.stringify({ version: 1, profiles: [{ phone, name: "DEMO 当前称呼", email: "current@example.test", note: "DEMO 不带入交易的长期备注", version: 1, updatedAt: time }] }));
  }, { available, history, phone: candidatePhone, time: intakeRecordTime() });
  const original = await page.evaluate(key => localStorage.getItem(key), unitKey);
  await page.goto(`/app/retail/units/${available.id}`);
  await openGroup(page, "actions");
  await page.getByRole("button", { name: "登记售出", exact: true }).click();
  const form = page.getByRole("region", { name: "登记售出", exact: true });
  const phoneInput = form.getByRole("combobox", { name: "客户手机号 *", exact: true });
  await phoneInput.fill("8804");
  await form.getByRole("option").filter({ hasText: candidatePhone }).click();
  await expect(form.getByLabel("客户称呼（选填）", { exact: true })).toHaveValue("DEMO 当前称呼");
  await expect(form.getByLabel("买家邮箱", { exact: true })).toHaveValue("current@example.test");
  await expect(form.getByLabel("买家地址", { exact: true })).toHaveValue("DEMO 原销售联系地址");
  await expect(form.getByLabel("买家备注", { exact: true })).toHaveValue("");
  await form.getByLabel("买家邮箱", { exact: true }).fill("manually-entered@example.test");
  await phoneInput.fill("+393200008805");
  await expect(form.getByLabel("客户称呼（选填）", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("买家邮箱", { exact: true })).toHaveValue("manually-entered@example.test");
  await expect(form.getByLabel("买家地址", { exact: true })).toHaveValue("");
  await form.getByRole("button", { name: "取消", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), unitKey)).toBe(original);
});
