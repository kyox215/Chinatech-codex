import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
if (process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1")
  throw new Error("Synthetic fixture mode required");
const evidence =
  process.env.REPAIRDESK_EVIDENCE_DIR ??
  "/private/tmp/repairdesk-orders-workspace-validation-20260905/screenshots";
for (const width of [390, 1440]) {
  test(`fault editor ${width}: pending close, clear payload, server conflict and reload`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page
      .context()
      .addCookies([
        { name: "repairdesk_locale", value: "en", url: process.env.PLAYWRIGHT_BASE_URL! },
      ]);
    let version = "2026-09-05T10:00:00.000Z";
    let issue = "Synthetic fault";
    let diagnosis = "Synthetic diagnosis";
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      Object.assign(json.data.order, {
        issue_description: issue,
        diagnosis_result: diagnosis,
        updated_at: version,
      });
      Object.assign(json.data.capabilities, { canEditIntake: true, canEditRepair: true });
      await route.fulfill({ response, json });
    });
    const bodies: Array<{
      input: { expected_updated_at: string; changes: Record<string, string> };
    }> = [];
    let release!: () => void;
    let mode: "pending" | "conflict" | "success" = "pending";
    await page.route("**/api/repairdesk/order/patch", async (route) => {
      bodies.push(route.request().postDataJSON());
      if (mode === "pending")
        await new Promise<void>((done) => {
          release = done;
        });
      if (mode === "conflict") {
        await route.fulfill({
          status: width < 1024 ? 400 : 409,
          json: { error: "工单已被更新，请刷新后再试" },
        });
        return;
      }
      Object.assign(
        { issue_description: issue, diagnosis_result: diagnosis },
        bodies.at(-1)!.input.changes,
      );
      issue = bodies.at(-1)!.input.changes.issue_description ?? issue;
      diagnosis = bodies.at(-1)!.input.changes.diagnosis_result ?? diagnosis;
      version = "2026-09-05T11:00:00.000Z";
      await route.fulfill({ json: { data: { id: "ord_1", updated_at: version } } });
    });
    await page.goto("/orders/ord_1");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const root = page.locator('[data-order-detail-root="true"]');
    const trigger =
      width < 1024
        ? root
            .locator('[data-order-detail-issue-summary="true"]')
            .locator("..")
            .getByRole("button", { name: "Edit", exact: true })
        : root.getByRole("button", { name: "Edit fault and diagnosis", exact: true });
    await trigger.click();
    const editor = page.getByRole("dialog", { name: "Edit fault and diagnosis" });
    await editor.getByRole("textbox").nth(1).fill("");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]!.input).toEqual({
      expected_updated_at: "2026-09-05T10:00:00.000Z",
      changes: { diagnosis_result: "" },
    });
    await page.keyboard.press("Escape");
    await editor.locator("button:has(svg.lucide-x)").click();
    await page.mouse.click(2, 2);
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("textbox").first()).toBeDisabled();
    expect(bodies).toHaveLength(1);
    await page.screenshot({
      path: resolve(evidence, `pending-${width}.png`),
      animations: "disabled",
    });
    mode = "success";
    release();
    await expect(editor).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0, {
      timeout: 10_000,
    });
    await trigger.click();
    await editor.getByRole("textbox").first().fill("Employee draft retained");
    mode = "conflict";
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Load latest version" })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(editor.getByRole("textbox").first()).toHaveValue("Employee draft retained");
    await page.screenshot({
      path: resolve(evidence, `conflict-${width}.png`),
      animations: "disabled",
    });
    issue = "Reloaded remote fault";
    version = "2026-09-05T12:00:00.000Z";
    await editor.getByRole("button", { name: "Load latest version" }).click();
    await editor.getByRole("button", { name: "Discard draft and reload" }).click();
    await expect(editor.getByRole("textbox").first()).toHaveValue(issue);
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    expect(bodies).toHaveLength(2);
  });
}

for (const width of [390, 1440]) {
  test(`list range ${width}: filters own range and preserve archive access`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page
      .context()
      .addCookies([
        { name: "repairdesk_locale", value: "zh-CN", url: process.env.PLAYWRIGHT_BASE_URL! },
      ]);
    await page.goto("/orders");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page.getByRole("group", { name: "订单显示范围" })).toHaveCount(0);
    await expect(
      page.locator(
        width < 1024
          ? '[data-order-mobile-header-context="true"]'
          : '[data-order-current-range="true"]',
      ),
    ).toContainText("待处理");
    const rows = page.locator(
      width < 1024
        ? '[data-order-mobile-list="true"] [data-order-mobile-card="true"]'
        : '[data-order-desktop-list="true"] [data-order-row="true"]',
    );
    await expect(rows.first()).toBeVisible();
    await page.screenshot({ path: resolve(evidence, `list-${width}.png`), animations: "disabled" });
    await page.getByRole("button", { name: width < 1024 ? /筛选订单/ : "筛选维修工单" }).click();
    const ranges = page.getByRole("group", { name: "订单显示范围" });
    await expect(ranges.getByRole("button")).toHaveCount(3);
    await page.screenshot({
      path: resolve(evidence, `list-filters-${width}.png`),
      animations: "disabled",
    });
    await ranges.getByRole("button", { name: "已归档", exact: true }).click();
    await expect(ranges.getByRole("button", { name: "已归档", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(
      page.locator(
        width < 1024
          ? '[data-order-mobile-header-context="true"]'
          : '[data-order-current-range="true"]',
      ),
    ).toContainText("已归档");
    await expect(page.getByRole("group", { name: "待处理状态" })).toHaveCount(0);
    await page.screenshot({
      path: resolve(evidence, `list-archive-${width}.png`),
      animations: "disabled",
    });
  });
}
