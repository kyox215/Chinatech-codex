import { test, expect, type Page } from "@playwright/test";
import { repairOrders, type RepairStatus } from "../../lib/repair-fixtures";

async function filters(page: Page) {
  const toggle = page.getByRole("button", { name: /^筛选/ });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
});

test("SeaTable group order, void filter and stable two-field sorting", async ({ page }) => {
  const statuses: RepairStatus[] = ["awaiting_reply", "outsourced", "repairing", "ready", "completed", "cancelled"];
  const workflows = Object.fromEntries(repairOrders.map((order, index) => [order.id, { revision: 0, status: statuses[index], custody: "store", notice: null, events: [], updatedAt: "2026-10-02 08:00:00" }]));
  await page.addInitScript(data => localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: data })), workflows);
  await page.goto("/app/repairs");
  const names = page.locator(".repair-group-toggle > span");
  const groupNames = ["寄修", "IN CORSO", "下单", "到货", "修好", "FATTO", "作废"];
  await expect(names).toHaveText(groupNames);
  await expect(page.locator("#repair-group-purchase small")).toHaveText("0");
  await page.locator("#repair-group-purchase").click();
  await expect(page.locator("#repair-group-rows-purchase")).toHaveText("暂无符合条件的工单");
  await filters(page);
  await expect(page.getByLabel("工单分组")).toHaveValue("workflow");
  await page.getByLabel("维修阶段筛选").selectOption("including_cancelled");
  await expect(names).toHaveText(groupNames);
  await page.getByLabel("工单分组").selectOption("none");
  const expected = [...repairOrders].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(order=>order.id);
  expect(await page.locator(".repair-module-row").evaluateAll(rows=>rows.map(row=>row.getAttribute("aria-label")!.split(" ")[0]))).toEqual(expected);
  await page.getByLabel("维修阶段筛选").selectOption("all");
  expect(await page.locator(".repair-module-row").evaluateAll(rows=>rows.map(row=>row.getAttribute("aria-label")!.split(" ")[0]))).toEqual(expected.filter(id=>id!==repairOrders[5].id));
});

test("stage save moves to the new group, restores focus, persists and appears in detail", async ({ page }) => {
  await page.goto("/app/repairs");
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible(); for (const id of await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(rows => rows.map(row => row.id))) await page.locator(`#${id}`).click();
  const stage = page.getByRole("button",{name:"CT-2026-0929 更改维修阶段",exact:true});
  await stage.click();
  const dialog = page.getByRole("dialog",{name:"更改维修阶段"});
  await dialog.getByRole("button",{name:"待取机",exact:true}).click();
  await dialog.getByRole("button",{name:"保存阶段",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#repair-group-ready")).toHaveAttribute("aria-expanded","true");
  await expect(stage).toBeFocused();
  await page.reload();
  await expect(page.locator("#repair-group-ready")).toBeVisible();
  if (await page.locator("#repair-group-ready").getAttribute("aria-expanded") === "false") await page.locator("#repair-group-ready").click();
  await expect(stage).toHaveText("待取机");
  await page.getByRole("link",{name:"打开 CT-2026-0929 iPhone 15 Pro 详情",exact:true}).click();
  await expect(stage).toHaveText("待取机");
});

test("ready contact is separate from stage and survives save/reload", async ({ page }) => {
  await page.goto("/app/repairs/CT-2026-0929");
  await page.getByRole("button",{name:"CT-2026-0929 更改维修阶段",exact:true}).click();
  const stage=page.getByRole("dialog",{name:"更改维修阶段"});
  await expect(stage.getByRole("button",{name:"修好已通知",exact:true})).toHaveCount(0);
  await stage.getByRole("button",{name:"取消",exact:true}).click();
  await page.goto("/app/repairs/CT-2026-0921");
  await page.getByRole("button",{name:"CT-2026-0921 联系与跟进",exact:true}).click();
  const contact=page.getByRole("dialog",{name:"工单联系与跟进"});
  await contact.getByRole("button",{name:"已实际成功通知取机",exact:true}).click();
  await page.goto("/app/repairs");
  await expect(page.locator("#repair-group-ready_notified")).toHaveCount(0);
  if (await page.locator("#repair-group-ready").getAttribute("aria-expanded") === "false") await page.locator("#repair-group-ready").click();
  await expect(page.locator("#repair-group-rows-ready")).toContainText("已通知取机");
  for(const width of [1440,1024,390,375]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("heading",{name:"维修工单",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`.local/ui-proof/seatable-groups/${test.info().project.name}-${width}.png`});
  }
});
