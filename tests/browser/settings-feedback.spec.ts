import { test, expect, type Page } from "@playwright/test";
import { defaultStoreSettings } from "../../lib/store-settings";
const settingsKey = "chinatech.m1.store-settings.v1";
const staffKey = "chinatech.m1.staff.v1";
async function openSettings(page: Page, tab: string) {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.addInitScript(({ key, settings }) => { if (!localStorage.getItem("settings-feedback-seeded")) { localStorage.setItem("settings-feedback-seeded", "1"); localStorage.setItem(key, JSON.stringify({ version: 1, settings })); } }, { key: settingsKey, settings: defaultStoreSettings });
  await page.goto("/app/settings");
  if (tab !== "门店设置") await page.getByRole("navigation", { name: "门店管理分类" }).getByRole("button", { name: tab, exact: true }).click();
}
async function failWrites(page: Page, key: string) {
  await page.evaluate(key => { const original = Storage.prototype.setItem; (window as typeof window & { restoreSettingsStorage?: () => void }).restoreSettingsStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("DEMO synthetic storage failure", "QuotaExceededError"); return original.call(this, name, value); }; }, key);
}
async function restoreWrites(page: Page) { await page.evaluate(() => (window as typeof window & { restoreSettingsStorage?: () => void }).restoreSettingsStorage?.()); }

test("settings failure retains input and success clears feedback with the saved revision", async ({ page }) => {
  await openSettings(page, "门店设置"); const field = page.getByRole("textbox", { name: "门店名称", exact: true });
  await field.fill("DEMO 设置恢复"); await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.locator(".settings-content").getByRole("alert")).toContainText("本地保存失败"); await expect(field).toHaveValue("DEMO 设置恢复");
  await expect(page.getByRole("navigation", { name: "门店管理分类" }).getByRole("button", { name: "打印", exact: true })).toBeEnabled();
  await restoreWrites(page); await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.locator(".settings-saved")).toHaveText("已保存"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保留输入并核对最新版本", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("button", { name: "保留输入并核对最新版本", exact: true })).toHaveCount(0);
  await page.reload(); await expect(field).toHaveValue("DEMO 设置恢复");
});

test("supplier failure preserves status and success closes the editor", async ({ page }) => {
  await openSettings(page, "供应商"); await page.getByRole("button", { name: "新增", exact: true }).click();
  const name = page.getByRole("textbox", { name: "供应商名称", exact: true }); await name.fill("DEMO 供应商恢复");
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存供应商", exact: true }).click();
  await expect(name).toHaveValue("DEMO 供应商恢复"); await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toBeVisible();
  await restoreWrites(page); await page.getByRole("button", { name: "保存供应商", exact: true }).click();
  await expect(name).toHaveCount(0); await expect(page.locator(".settings-supplier-list")).toContainText("DEMO 供应商恢复"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
});

test("financial registration and void failure retain drafts and settle once after retry", async ({ page }) => {
  await openSettings(page, "经营收支"); await page.getByRole("button", { name: "登记", exact: true }).click();
  await page.getByRole("textbox", { name: "收支金额", exact: true }).fill("25.50"); const purpose = page.getByRole("textbox", { name: "收支用途", exact: true }); await purpose.fill("DEMO 收支恢复");
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存登记", exact: true }).click();
  await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toHaveText("本地保存失败，现有资料未改变。"); await expect(purpose).toHaveValue("DEMO 收支恢复"); await expect(page.getByRole("button", { name: "保存登记", exact: true })).toBeEnabled(); await restoreWrites(page); await page.getByRole("button", { name: "保存登记", exact: true }).click();
  await expect(purpose).toHaveCount(0); await expect(page.locator(".settings-finance-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "作废收支 DEMO 收支恢复", exact: true }).click(); const reason = page.getByRole("textbox", { name: "收支作废原因", exact: true }); await reason.fill("DEMO 更正误记");
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "确认作废", exact: true }).click(); await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toHaveText("本地保存失败，现有资料未改变。"); await expect(reason).toHaveValue("DEMO 更正误记"); await expect(page.getByRole("button", { name: "确认作废", exact: true })).toBeEnabled();
  await restoreWrites(page); await page.getByRole("button", { name: "确认作废", exact: true }).click(); await expect(reason).toHaveCount(0); await expect(page.locator(".settings-finance-list article")).toHaveCount(1); await expect(page.locator(".settings-finance-list")).toContainText("已作废"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
});

test("employee storage rejection preserves reviewed permissions and success closes the editor", async ({ page }) => {
  await openSettings(page, "员工设置"); await page.getByRole("button", { name: "新增员工", exact: true }).click();
  await page.getByRole("textbox", { name: "员工称呼", exact: true }).fill("DEMO 员工恢复"); await page.getByRole("textbox", { name: "员工账号标识", exact: true }).fill("settings-feedback@demo.chinatech.local");
  await page.getByRole("button", { name: "继续核对权限", exact: true }).click(); await failWrites(page, staffKey); await page.getByRole("button", { name: "确认保存员工", exact: true }).click();
  await expect(page.getByRole("heading", { name: "核对员工与权限", exact: true })).toBeVisible(); await expect(page.locator(".settings-content").getByRole("alert")).toContainText("员工预览保存失败");
  await restoreWrites(page); await page.getByRole("button", { name: "确认保存员工", exact: true }).click(); await expect(page.getByRole("heading", { name: "核对员工与权限", exact: true })).toHaveCount(0); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0); await expect(page.getByText("DEMO 员工恢复", { exact: true }).first()).toBeVisible();
});
