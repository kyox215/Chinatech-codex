import { test, expect, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";

async function openGroup(page: Page, id: string) {
  const toggle = page.locator(`[data-retail-group="${id}"] > button`);
  const group = page.locator(`[data-retail-group="${id}"]`);
  await expect(group).toBeVisible();
  if (await toggle.isVisible()) {
    if (await toggle.getAttribute("aria-expanded") === "false") {
      // Smooth document scrolling can still move a mobile WebKit click target.
      // Settle its position before the single native click; keep every assertion.
      await toggle.evaluate(async element => {
        element.scrollIntoView({ block: "center", behavior: "instant" });
        let previous = element.getBoundingClientRect(); let stable = 0;
        for (let frame = 0; frame < 60; frame++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const current = element.getBoundingClientRect();
          stable = Math.abs(current.top - previous.top) < 0.1 && Math.abs(current.left - previous.left) < 0.1 ? stable + 1 : 0;
          if (stable >= 2) return;
          previous = current;
        }
        throw new Error("Click target did not settle before the native click");
      });
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await expect(group.locator(":scope > div[id]")).toBeVisible();
}

// All writes and screenshots use the browser preview and fictional units.
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "填入演示账号", exact: true }).click();
  await page.getByRole("button", { name: "登录工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

test("图形档案四宽度完整展示，未知成本保留待确认，字段更正可刷新恢复", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const unit = retailUnits[1];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/retail/units/${unit.id}`);
  const summary = page.getByRole("region", { name: "单机摘要", exact: true });
  const finance = page.getByRole("region", { name: "销售与成本", exact: true });
  await expect(summary).toContainText("已保存 1/3");
  await expect(finance).toContainText("€120.00");
  await expect(finance.getByRole("button", { name: "编辑整备成本", exact: true })).toContainText("待确认");
  await expect(finance.locator('div').filter({ has: page.getByText("预计毛利", { exact: true }) }).last()).toContainText("待确认");
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ["编辑售价", "编辑电池健康", "同型号新建"]) {
      const target = page.getByRole(name === "同型号新建" ? "link" : "button", { name, exact: true });
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await openGroup(page, "finance");
    for (const button of [summary.getByRole("button", { name: "编辑售价", exact: true }), finance.getByRole("button", { name: "编辑入库成本", exact: true })]) {
      const lines = await button.locator(":scope > span > span").evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length; });
      expect(lines).toBe(1);
    }
    const financeToggle = finance.locator(":scope > button");
    if (await financeToggle.isVisible()) await financeToggle.click();
    await page.screenshot({ path: `.local/ui-proof/retail-visual-detail/${info.project.name}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await openGroup(page, "identity");
  const source = page.getByRole("button", { name: "编辑来源", exact: true });
  await source.focus();
  await source.press("Enter");
  await page.getByRole("textbox", { name: "来源", exact: true }).fill("本地可视化验收 · 演示");
  await page.getByRole("button", { name: "继续确认", exact: true }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await expect(source).toContainText("本地可视化验收 · 演示");
  await expect(source).toBeFocused();
  await page.reload();
  await openGroup(page, "identity");
  await expect(source).toContainText("本地可视化验收 · 演示");
  await expect(summary).toContainText("已保存 1/3");
  await page.getByRole("button", { name: "编辑SN", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "SN", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(errors).toEqual([]);
});

test("检测草稿不冒充已保存进度，部分检测不自动可售，完整检测可以合并保存", async ({ page }) => {
  await page.goto(`/app/retail/units/${retailUnits[1].id}`);
  const summary = page.getByRole("region", { name: "单机摘要", exact: true });
  await expect(summary).toContainText("已保存 1/3");
  await openGroup(page, "actions");
  await page.getByRole("checkbox", { name: "功能检测已完成", exact: true }).check();
  await expect(summary).toContainText("已保存 1/3");
  await page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true }).fill("本地演示检测验收");
  await page.getByRole("button", { name: "记录检测", exact: true }).click();
  await expect(summary).toContainText("已保存 2/3");
  await expect(page.locator(".module-heading")).toContainText("待检测");
  await page.reload();
  await openGroup(page, "actions");
  await expect(summary).toContainText("已保存 2/3");
  await page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true }).fill("本地演示检查可售门控");
  await page.getByRole("button", { name: "保存检测并设为可售", exact: true }).click();
  await expect(page.locator(".retail-actions").getByRole("alert")).toContainText("三项");
  await expect(page.locator(".module-heading")).toContainText("待检测");
});

test("实物照片切换放大可用，照片与已售锁定状态保留", async ({ page }) => {
  const photos = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 120;
    const context = canvas.getContext("2d")!;
    return ["#dfddff", "#e8f8f4", "#fff6df", "#edf3ff", "#fff0f1", "#fafbfc"].map(color => { context.fillStyle = color; context.fillRect(0, 0, 80, 120); return canvas.toDataURL("image/png"); });
  });
  await page.addInitScript(({ units, photos }) => localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units: units.map(unit => unit.id === "demo-unit-2" ? { ...unit, photos } : unit) })), { units: retailUnits, photos });
  await page.goto("/app/retail/units/demo-unit-2");
  const gallery = page.getByRole("region", { name: "本台实物照片", exact: true });
  await expect(gallery).toBeVisible();
  const photoToggle = gallery.getByRole("button", { name: "照片 6", exact: true });
  if (await photoToggle.isVisible()) await photoToggle.click();
  await gallery.getByRole("button", { name: "查看实物照片 2", exact: true }).click();
  await expect(gallery.getByRole("button", { name: "查看实物照片 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (await photoToggle.isVisible() && await photoToggle.getAttribute("aria-expanded") === "false") await photoToggle.click();
    for (const button of await gallery.getByRole("button", { name: /^查看实物照片/ }).all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  const mainPhoto = gallery.getByRole("img", { name: "iPhone 13实物照片", exact: true });
  await expect(mainPhoto).toHaveAttribute("src", photos[1]);
  const before = await mainPhoto.boundingBox();
  await gallery.getByRole("button", { name: "放大实物照片", exact: true }).click();
  expect((await mainPhoto.boundingBox())!.height).toBeGreaterThan(before!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await gallery.getByRole("button", { name: "收起大图", exact: true }).click();
  await page.goto("/app/retail/units/demo-unit-8");
  await expect(page.getByRole("button", { name: "编辑售价", exact: true })).toBeDisabled();
  await openGroup(page, "identity");
  await expect(page.getByRole("button", { name: "编辑SN", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "登记售出", exact: true })).toHaveCount(0);
  await openGroup(page, "sales");
  await expect(page.getByRole("heading", { name: "销售结算与售后", exact: true })).toBeVisible();
});


test("手机折叠默认紧凑、键盘可达，切换分组保留未提交检测", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/app/retail/units/${retailUnits[1].id}`);
  const groups = page.locator("[data-retail-group]");
  await expect(page.locator('[data-retail-group][data-open="true"]')).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true })).not.toBeVisible();
  const initialHeight = await page.locator("main.retail-detail").evaluate(element => element.scrollHeight);
  expect(initialHeight).toBeLessThan(1100);
  await page.getByRole("button", { name: "继续检测", exact: true }).click();
  const checks = page.getByRole("checkbox", { name: "功能检测已完成", exact: true });
  const note = page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true });
  await checks.check(); await note.fill("DEMO未提交检测草稿");
  const identity = page.locator('[data-retail-group="identity"] > button');
  await identity.focus(); await identity.press("Enter");
  await expect(identity).toHaveAttribute("aria-expanded", "true");
  await expect(note).not.toBeVisible();
  await openGroup(page, "actions");
  await expect(checks).toBeChecked(); await expect(note).toHaveValue("DEMO未提交检测草稿");
  await expect(page.getByRole("region", { name: "单机摘要", exact: true })).toContainText("已保存 1/3");
  await openGroup(page, "history");
  await expect(page.locator('[data-retail-group="history"] .detail-timeline li').first()).toBeVisible();
  await expect(page.locator('[data-retail-group="history"] details > summary')).not.toBeVisible();
  for (const group of await groups.all()) {
    const box = await group.locator(":scope > button").boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
