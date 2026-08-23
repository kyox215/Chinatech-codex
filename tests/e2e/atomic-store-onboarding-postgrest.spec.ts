import { expect, test } from "@playwright/test";

import {
  assertAtomicStoreOnboardingPostgrestEnvironment,
  isProductionHost,
  isRecord,
  LOOPBACK_ORIGIN,
} from "./support/atomic-store-onboarding-postgrest-env";

const requested = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_POSTGREST === "1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const realEnvironment = requested ? assertAtomicStoreOnboardingPostgrestEnvironment() : undefined;

test.skip(
  !requested,
  "Set the explicit Node24 loopback/non-production gates for the real PostgREST check.",
);
test.describe.configure({ mode: "serial" });

if (realEnvironment) {
  test.use({
    storageState: realEnvironment.storageState,
    trace: "off",
    screenshot: "off",
    video: "off",
  });
}

test("staging onboarding reaches the real atomic store-create RPC", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding");
  expect(new URL(page.url()).origin).toBe(LOOPBACK_ORIGIN);

  const cookies = await page.context().cookies();
  expect(cookies.length).toBeGreaterThan(0);
  for (const cookie of cookies) {
    const cookieDomain = cookie.domain.replace(/^\./, "").toLowerCase();
    expect(isProductionHost(cookieDomain)).toBe(false);
    expect(cookieDomain).toBe("127.0.0.1");
  }

  await expect(page.getByRole("heading", { name: "账号开通" })).toBeVisible();
  await page.getByRole("tab", { name: "创建店铺" }).click();

  const storeName = `RepairDesk staging ${Date.now().toString(36)}`;
  await page.getByLabel("店铺名称").fill(storeName);
  await page.getByLabel("默认打印地址（可选）").fill("Synthetic staging address");

  const createResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === LOOPBACK_ORIGIN &&
      url.pathname === "/api/repairdesk/stores/create" &&
      response.request().method() === "POST"
    );
  });
  await page.getByRole("button", { name: "创建店铺" }).click();
  const createResponse = await createResponsePromise;
  const payload = await createResponse.json().catch(() => null);
  expect(createResponse.status()).toBeGreaterThanOrEqual(200);
  expect(createResponse.status()).toBeLessThan(300);

  const activeStore =
    isRecord(payload) && isRecord(payload.data)
      ? isRecord(payload.data.activeStore)
        ? payload.data.activeStore
        : undefined
      : undefined;
  expect(activeStore).toBeDefined();
  expect(activeStore?.id).toEqual(expect.stringMatching(uuidPattern));
  expect(activeStore?.name).toBe(storeName);
  expect(activeStore?.name).not.toBe("");
});
