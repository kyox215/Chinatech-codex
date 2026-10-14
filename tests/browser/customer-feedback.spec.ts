import { test, expect } from "@playwright/test";
import { defaultStaffData } from "../../lib/staff";

test("customer rendering is bounded while search and counts cover every record", async ({ page }) => {
  const profiles = Array.from({ length: 125 }, (_, i) => ({ phone: `+3932000${String(i).padStart(4, "0")}`, name: `Synthetic customer ${i}`, email: "", note: "", version: 1, updatedAt: "2026-10-14 10:00:00" }));
  await page.addInitScript(data => localStorage.setItem("chinatech.m1.customer-profiles.v1", JSON.stringify({ version: 1, profiles: data })), profiles);
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/customers");
  const rows = page.getByRole("region", { name: "客户列表", exact: true }).locator('a[href^="/app/customers/"]');
  await expect(rows).toHaveCount(50);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(rows).toHaveCount(50);
  await expect(page.getByRole("navigation", { name: "列表分页" })).toContainText("第 2 /");
  await page.getByRole("textbox", { name: "搜索客户", exact: true }).fill("Synthetic customer 124");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Synthetic customer 124");
  await expect(page.getByRole("navigation", { name: "列表分页" })).toHaveCount(0);
  await page.getByRole("button", { name: "清空搜索客户", exact: true }).click();
  await expect(rows).toHaveCount(50);
  await expect(page.getByRole("navigation", { name: "列表分页" })).toContainText("第 1 /");
  for (const width of [1440, 1024, 390, 375]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});

test("customer permissions remove an open draft and keep read access", async ({ page }) => {
  const staff = structuredClone(defaultStaffData); staff.currentId = "DEMO-MANAGER";
  await page.addInitScript(data => localStorage.setItem("chinatech.m1.staff.v1", JSON.stringify({ version: 1, data })), staff);
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/customers");
  await page.getByRole("button", { name: "新建客户", exact: true }).click();
  await expect(page.getByRole("heading", { name: "新建客户", exact: true })).toBeVisible();
  await page.evaluate(data => { const member = data.members.find(row => row.id === data.currentId)!; member.permissions = member.permissions.filter(p => p !== "customers.edit"); member.revision++; data.revision++; localStorage.setItem("chinatech.m1.staff.v1", JSON.stringify({ version: 1, data })); window.dispatchEvent(new Event("chinatech-staff-change")); }, staff);
  await expect(page.getByRole("button", { name: "新建客户", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "新建客户", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "客户目录", exact: true })).toBeVisible();
});

test("failed customer data is not reported as no customers or no devices", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("chinatech.m1.customer-profiles.v1", "invalid-json"); localStorage.setItem("chinatech.m1.local-intakes.v1", "invalid-json"); });
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/app/customers");
  await expect(page.getByRole("alert").filter({ hasText: "资料暂时无法读取" })).toBeVisible();
  await expect(page.getByText("暂无客户", { exact: true })).toHaveCount(0);
  await page.goto("/app/customer-devices");
  await expect(page.getByRole("alert").filter({ hasText: "资料暂时无法读取" })).toBeVisible();
  await expect(page.getByText("没有匹配的设备", { exact: true })).toHaveCount(0);
});
