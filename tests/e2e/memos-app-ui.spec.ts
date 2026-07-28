import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for memo UI checks.");

test("memo search, filters, quick entry and progressive loading match the app layout", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const baseUrl = String(testInfo.project.use.baseURL);

  for (let index = 1; index <= 23; index += 1) {
    const response = await request.post("/api/repairdesk/memos/create", {
      headers: { origin: baseUrl },
      data: {
        input: {
          operationId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          kind: index % 4 === 0 ? "note" : "todo",
          title: `界面测试备忘 ${String(index).padStart(2, "0")}`,
          content: "仅用于本地界面验收",
        },
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/memos");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("searchbox", { name: "搜索备忘录" }).last()).toBeVisible();
  const memoRows = page.getByRole("button", { name: /^打开备忘：界面测试备忘/ });
  await expect(memoRows).toHaveCount(20);

  await page.getByRole("button", { name: "加载更多" }).click();
  await expect(memoRows).toHaveCount(23);
  await expect(page.getByRole("button", { name: "加载更多" })).toHaveCount(0);
  await expect(page.getByText("上一页", { exact: true })).toHaveCount(0);
  await expect(page.getByText("下一页", { exact: true })).toHaveCount(0);

  await page.locator('button[aria-label="筛选"]:visible').click();
  await expect(page.getByRole("dialog", { name: "筛选备忘录" })).toBeVisible();
  await page.getByRole("button", { name: "待处理" }).click();
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator('button[aria-label="筛选，已选 1 项"]:visible')).toBeVisible();
  await expect(page.locator('[aria-label="当前筛选条件"]:visible')).toContainText("待处理");

  await page.getByRole("button", { name: "新建备忘" }).click();
  const composer = page.getByRole("dialog", { name: "新建备忘" });
  await expect(composer).toBeVisible();
  await expect(composer.getByRole("button", { name: "待办", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(composer.getByPlaceholder("写下要做的事或记录…")).toBeFocused();
  await expect(composer.getByRole("button", { name: "添加详情" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("memo-app-ui-desktop.png") });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/memos");
  await page.waitForTimeout(250);
  await page.locator('button[aria-label^="筛选"]:visible').click();
  const filterSheet = page.getByRole("dialog", { name: "筛选备忘录" });
  await expect(filterSheet).toBeVisible();
  await expect(filterSheet).toHaveClass(/rounded-t-\[20px\]/);
  await page.waitForTimeout(250);
  const box = await filterSheet.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThanOrEqual(2);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  await page.screenshot({
    path: testInfo.outputPath("memo-app-ui-mobile-filter.png"),
  });
});
