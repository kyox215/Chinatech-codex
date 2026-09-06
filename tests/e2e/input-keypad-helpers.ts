import { expect, type Locator, type Page } from "@playwright/test";

export async function fillPhoneInput(page: Page, field: Locator, value: string) {
  if (await field.evaluate((node) => node.tagName === "INPUT")) {
    await field.fill(value);
    return;
  }
  await field.click();
  const keypad = page.locator("[data-phone-keypad]").filter({ visible: true });
  await expect(keypad).toBeVisible();
  await keypad.locator('[data-phone-keypad-key="clear"]').click();
  const digits = value.replace(/\s/g, "");
  const italian = digits.startsWith("+39");
  if (italian) await keypad.locator('[data-phone-keypad-key="+39"]').click();
  for (const digit of italian ? digits.slice(3) : digits)
    await keypad.locator(`[data-phone-keypad-key="${digit}"]`).click();
  await keypad.locator("[data-phone-keypad-done]").click();
}

export async function fillNumericInput(field: Locator, value: string) {
  if (await field.evaluate((node) => node.tagName === "INPUT")) {
    await field.fill(value);
    return;
  }
  await field.click();
  const keypad = field.page().locator("[data-numeric-keypad]").filter({ visible: true });
  await expect(keypad).toBeVisible();
  await keypad.locator('[data-numeric-key="clear"]').click();
  for (const key of value.replace(",", "."))
    await keypad.locator(`[data-numeric-key="${key}"]`).click();
  await keypad.locator("[data-numeric-keypad-done]").click();
  await expect(field).toContainText(value.replace(",", "."));
}
