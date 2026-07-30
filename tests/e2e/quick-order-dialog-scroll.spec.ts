import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260729-009-quick-order-mobile-density";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for quick-order dialog checks.");

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 440, height: 956 },
  { width: 1024, height: 500 },
]) {
  test(`quick-order dialog remains vertically reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

    await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();

    const dialog = page.locator('[data-new-order-dialog="true"]');
    const form = dialog.locator('[data-new-order-form="true"]');
    const settings = dialog.locator('[data-new-order-section="settings"]');
    const submit = dialog.getByRole("button", { name: "创建工单" });
    await expect(form).toBeVisible({ timeout: 20_000 });
    await expect(submit).toBeVisible({ timeout: 20_000 });

    if (viewport.width < 768) {
      const close = dialog.getByRole("button", { name: "关闭新建维修工单" });
      const closeBox = await close.boundingBox();
      expect(closeBox?.width).toBeGreaterThanOrEqual(44);
      expect(closeBox?.height).toBeGreaterThanOrEqual(44);

      const phoneInput = dialog.getByRole("combobox", { name: "客户电话号码" });
      expect(await phoneInput.evaluate((element) => getComputedStyle(element).fontSize)).toBe(
        "16px",
      );

      const picker = dialog.locator('[data-fault-diagnosis-picker="true"]');
      await expect(picker).toHaveAttribute("data-compact-columns", "3");
      for (const [label, compactLabel] of [
        ["屏幕", "屏幕"],
        ["摄像头", "摄像"],
        ["面容/指纹", "面容"],
        ["扬声器", "扬声"],
        ["麦克风", "麦克"],
      ]) {
        const button = picker.getByRole("button", { name: label, exact: true });
        await expect(button).toHaveText(compactLabel);
        const text = button.locator("span span");
        expect(
          await text.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          `${label} should remain readable without ellipsis`,
        ).toBe(true);
      }

      await expect
        .poll(() =>
          form.evaluate((element) =>
            Number.parseFloat(
              getComputedStyle(element).getPropertyValue("--new-order-submit-offset"),
            ),
          ),
        )
        .toBeGreaterThan(44);

      const settingPairs = [
        ["operator", "accessories"],
        ["type", "status"],
      ] as const;
      for (const [leftName, rightName] of settingPairs) {
        const left = settings.locator(`[data-new-order-setting="${leftName}"]`);
        const right = settings.locator(`[data-new-order-setting="${rightName}"]`);
        const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
        expect(leftBox).not.toBeNull();
        expect(rightBox).not.toBeNull();
        expect(Math.abs(leftBox!.width - rightBox!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(leftBox!.y - rightBox!.y)).toBeLessThanOrEqual(1);
      }

      const operatorControl = settings.locator('[data-new-order-setting-control="true"]');
      const accessoryControl = settings
        .locator('[data-new-order-setting="accessories"]')
        .getByRole("button")
        .first();
      const [operatorControlBox, accessoryControlBox] = await Promise.all([
        operatorControl.boundingBox(),
        accessoryControl.boundingBox(),
      ]);
      expect(operatorControlBox?.height).toBe(44);
      expect(accessoryControlBox?.height).toBe(44);
    }

    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeInViewport();
    await expect(submit).toBeInViewport();
    await page.screenshot({
      path: `${evidenceDir}/quick-order-dialog-scroll-${testInfo.project.name}-${viewport.width}x${viewport.height}.png`,
      fullPage: false,
    });

    const before = await form.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await form.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() =>
        form.evaluate((element) =>
          Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
        ),
      )
      .toBeLessThanOrEqual(1);

    if (viewport.width < 768) {
      const contentEndBox = await dialog
        .locator('[data-new-order-content-end="true"]')
        .boundingBox();
      const submitCardBox = await dialog
        .locator('[data-new-order-submit-card="true"]')
        .boundingBox();
      const submitBarBox = await dialog.locator('[data-new-order-submit-bar="true"]').boundingBox();
      const submitSpacerBox = await dialog
        .locator('[data-new-order-submit-spacer="true"]')
        .boundingBox();
      const offset = await form.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).getPropertyValue("--new-order-submit-offset")),
      );
      expect(contentEndBox).not.toBeNull();
      expect(submitCardBox).not.toBeNull();
      expect(submitBarBox).not.toBeNull();
      expect(submitSpacerBox).not.toBeNull();
      expect(Math.abs(offset - submitBarBox!.height)).toBeLessThanOrEqual(1);
      expect(submitSpacerBox!.height).toBeGreaterThanOrEqual(offset + 11);
      expect(contentEndBox!.y + contentEndBox!.height).toBeLessThanOrEqual(submitCardBox!.y - 8);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
