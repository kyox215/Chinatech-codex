import { devices, expect, test } from "@playwright/test";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires the isolated RepairDesk synthetic fixture server.",
);

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
  contextOptions: { reducedMotion: "reduce" },
});

test("keeps mobile intake controls stable and supports direct touch gestures", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = String(testInfo.project.use.baseURL);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL }]);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "新建工单", exact: true }).click();
  const dialog = page.locator('[data-new-order-dialog="true"]');
  await expect(dialog).toBeVisible();

  await dialog.locator('[data-mobile-edit="device"]').click();
  const deviceEditor = page.locator('[data-new-order-mobile-panel="device"]');
  const deviceDialog = page.getByRole("dialog").filter({ has: deviceEditor });
  await deviceEditor.locator("#new-order-device-brand").fill("xiaomi");
  await deviceEditor.locator("#new-order-device-model").fill("redmi note 13 pro");
  await expect(deviceEditor.locator("#new-order-device-brand")).toHaveValue("XIAOMI");
  await expect(deviceEditor.locator("#new-order-device-model")).toHaveValue("REDMI NOTE 13 PRO");
  await deviceDialog.getByRole("button", { name: "完成", exact: true }).click();

  await dialog.locator('[data-mobile-edit="accessories"]').click();
  const accessoryEditor = page.locator('[data-new-order-mobile-panel="accessories"]');
  const accessoryDialog = page.getByRole("dialog").filter({ has: accessoryEditor });
  await expect(
    accessoryEditor.locator('[data-accessory-presentation="mobile-checklist"]'),
  ).toBeVisible();
  await accessoryEditor.getByRole("button", { name: "SIM卡", exact: true }).click();
  await accessoryEditor.getByRole("button", { name: "手机壳", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("mobile-accessory-checklist.png") });
  await accessoryDialog.getByRole("button", { name: "完成", exact: true }).click();

  await dialog.locator('[data-mobile-edit="unlock"]').click();
  const unlockEditor = page.locator('[data-new-order-mobile-panel="unlock"]');
  const unlockDialog = page.getByRole("dialog").filter({ has: unlockEditor });
  await unlockEditor.getByRole("button", { name: "图案", exact: true }).click();
  const patternGrid = unlockEditor.locator('[data-device-unlock-pattern-grid="true"]');
  const patternBox = await patternGrid.boundingBox();
  if (!patternBox) throw new Error("Pattern grid is not measurable");
  const point = (column: number, row: number) => ({
    x: patternBox.x + (patternBox.width * [22, 78, 134][column]!) / 156,
    y: patternBox.y + (patternBox.height * [22, 78, 134][row]!) / 156,
  });
  const start = point(0, 0);
  const end = point(2, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect(
    patternGrid.locator('[data-device-unlock-pattern-point][aria-pressed="true"]'),
  ).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("mobile-pattern-swipe.png") });
  await unlockDialog.getByRole("button", { name: "完成", exact: true }).click();

  const faultButton = dialog.locator('[data-fault-category="display"] > button').first();
  await faultButton.click();
  const scrollBody = dialog.locator('[data-new-order-scroll-body="true"]');
  const before = await Promise.all([
    scrollBody.evaluate((element) => element.scrollTop),
    faultButton.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  await dialog.getByRole("button", { name: "定金", exact: true }).click();
  const keypad = dialog.locator('[data-virtual-keyboard-dock="true"]');
  await expect(keypad).toBeVisible();
  await expect(keypad).toHaveAttribute("data-virtual-keyboard-layout", "overlay");
  const after = await Promise.all([
    scrollBody.evaluate((element) => element.scrollTop),
    faultButton.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(after[0]).toBe(before[0]);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(1);
  await keypad.getByRole("button", { name: "3", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("mobile-money-keypad-overlay.png") });
  const batteryButton = dialog.locator('[data-fault-category="battery"] > button').first();
  await expect(batteryButton).toHaveAttribute("aria-pressed", "false");
  await batteryButton.click();
  await expect(keypad).toHaveCount(0);
  await expect(batteryButton).toHaveAttribute("aria-pressed", "false");
  await batteryButton.click();
  await expect(batteryButton).toHaveAttribute("aria-pressed", "true");

  expect(errors).toEqual([]);
});
