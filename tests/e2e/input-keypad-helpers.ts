import { devices, expect, type CDPSession, type Locator, type Page } from "@playwright/test";

type KeyboardDevice = {
  session: CDPSession;
  desktopUserAgent: string;
  desktopPlatform: string;
};

const keyboardDevices = new WeakMap<Page, KeyboardDevice>();

/** Match these Chromium fixture viewports to actual touch or desktop device capabilities. */
export async function setKeyboardDeviceViewport(
  page: Page,
  viewport: { width: number; height: number },
) {
  let device = keyboardDevices.get(page);
  if (!device) {
    const desktop = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    }));
    device = {
      session: await page.context().newCDPSession(page),
      desktopUserAgent: desktop.userAgent,
      desktopPlatform: desktop.platform,
    };
    keyboardDevices.set(page, device);
  }

  const touchDevice = viewport.width < 1024;
  await device.session.send("Emulation.setUserAgentOverride", {
    userAgent: touchDevice ? devices["Pixel 7"].userAgent : device.desktopUserAgent,
    platform: touchDevice ? "Linux armv8l" : device.desktopPlatform,
  });
  await device.session.send("Emulation.setTouchEmulationEnabled", {
    enabled: touchDevice,
    ...(touchDevice ? { maxTouchPoints: 5 } : {}),
  });
  await page.setViewportSize(viewport);
  // Existing-page transitions represent a device change, preserving the same form draft.
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
}

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
