import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING === "1";
const evidenceDir = "screenshots/TASK-20260724-005-atomic-store-onboarding";

test.skip(!enabled, "Set REPAIRDESK_E2E_ATOMIC_ONBOARDING=1 for onboarding checks.");

const onboardingStatus = {
  email: "owner@example.test",
  displayName: "Owner",
  isPlatformAdmin: false,
  stores: [],
  requests: [],
  invitations: [],
  availableStores: [],
};

test("mobile create retries the same request after a lost response and then enters the app", async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStatus(page);

  const createRequests: Array<Record<string, unknown>> = [];
  await page.route("**/api/repairdesk/stores/create", async (route) => {
    const body = route.request().postDataJSON() as { input?: Record<string, unknown> };
    createRequests.push(body.input ?? {});
    if (createRequests.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "创建店铺失败，请稍后重试" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          activeStore: {
            id: "00000000-0000-4000-8000-000000000501",
            name: "Mobile Repair",
            slug: "mobile-repair-0001",
            role: "owner",
            status: "active",
          },
          stores: [],
          permissions: {},
        },
      }),
    });
  });

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "账号开通" })).toBeVisible();
  await page.getByRole("tab", { name: "创建店铺" }).click();
  await page.getByLabel("店铺名称").fill("Mobile Repair");
  await page.getByLabel("默认打印地址（可选）").fill("Via Mobile 1");
  await page.getByRole("button", { name: "创建店铺" }).click();
  await expect.poll(() => createRequests.length).toBe(1);

  await page.reload();
  await page.getByRole("tab", { name: "创建店铺" }).click();
  await page.getByLabel("店铺名称").fill("Mobile Repair");
  await page.getByLabel("默认打印地址（可选）").fill("Via Mobile 1");
  await page.getByRole("button", { name: "创建店铺" }).click();
  await expect.poll(() => createRequests.length).toBe(2);
  expect(createRequests[1]?.request_id).toBe(createRequests[0]?.request_id);
  await expect(page).not.toHaveURL(/\/onboarding$/);
  await page.screenshot({
    path: `${evidenceDir}/atomic-store-created-${browserName}-390.png`,
    fullPage: true,
  });
});

test("mobile join flow remains simple and prevents duplicate submission", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStatus(page);
  let joinRequests = 0;
  await page.route("**/api/repairdesk/onboarding/request", async (route) => {
    joinRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: "request-1", status: "pending" } }),
    });
  });

  await page.goto("/onboarding");
  await page.getByLabel("店铺负责人邮箱").fill("shop-owner@example.test");
  const submit = page.getByRole("button", { name: "提交申请" });
  await submit.click();
  await expect(submit).toBeDisabled();
  await submit.click({ force: true });
  await expect.poll(() => joinRequests).toBe(1);
  await page.screenshot({
    path: `${evidenceDir}/join-store-${browserName}-390.png`,
    fullPage: true,
  });
});

async function mockStatus(page: Page) {
  await page.route("**/api/repairdesk/onboarding/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: onboardingStatus }),
    }),
  );
}
