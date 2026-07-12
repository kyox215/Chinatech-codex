import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const sections = [
  { key: "account", label: /账号/, heading: "我的账号" },
  { key: "members", label: /员工/, heading: "员工管理" },
  { key: "store", label: /店铺/, heading: "店铺管理" },
  { key: "suppliers", label: /供应商/, heading: "供应商" },
  { key: "kiosk", label: /客户 iPad|iPad/, heading: "客户 iPad" },
  { key: "rules", label: /默认规则|规则/, heading: "默认规则" },
  { key: "workflow", label: /状态流|状态/, heading: "工单状态流" },
  { key: "notifications", label: /通知与打印|通知/, heading: "通知资料完整度" },
  { key: "order-data", label: /工单数据|数据/, heading: "工单数据文件" },
] as const;

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for settings checks.");

test.describe("settings overview responsive shell", () => {
  for (const viewport of viewports) {
    test(`renders the overview contract at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await gotoReady(page, "/settings");

      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("heading", { name: "设置总览" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("[data-settings-overview]")).toBeVisible();
      await expect(page.locator("[data-settings-content]")).toBeVisible();
      await expectNoPageOverflow(page, `/settings ${viewport.width}px`);

      const rail = page.locator("[data-settings-rail]");
      if (viewport.width >= 1024) {
        await expect(rail).toBeVisible();
        const expectedWidth = viewport.width >= 1440 ? 240 : viewport.width >= 1280 ? 224 : 208;
        const railBox = await rail.boundingBox();
        expect(railBox).not.toBeNull();
        expect(Math.abs((railBox?.width ?? 0) - expectedWidth)).toBeLessThanOrEqual(2);
        expect(
          await rail
            .locator(":scope > div")
            .evaluate((element) => window.getComputedStyle(element).position),
        ).toBe("sticky");
      } else {
        await expect(rail).toBeHidden();
      }

      const firstGroupCards = page
        .locator('[aria-labelledby="settings-overview-personal-access"] > div')
        .locator(":scope > a, :scope > div");
      const firstBox = await firstGroupCards.nth(0).boundingBox();
      const secondBox = await firstGroupCards.nth(1).boundingBox();
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      if (viewport.width < 768) {
        expect(Math.abs((firstBox?.x ?? 0) - (secondBox?.x ?? 0))).toBeLessThanOrEqual(1);
        expect(secondBox?.y ?? 0).toBeGreaterThan(firstBox?.y ?? 0);
      } else {
        expect(secondBox?.x ?? 0).toBeGreaterThan(firstBox?.x ?? 0);
      }

      const contentBox = await page.locator("[data-settings-content]").boundingBox();
      expect(contentBox).not.toBeNull();
      expect(contentBox?.width ?? 0).toBeLessThanOrEqual(982);
    });
  }
});

test.describe("settings navigation and deep links", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps nine deep links, unknown fallback, and browser history", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoReady(page, "/settings?section=unknown");
    await expect(page.getByRole("heading", { name: "设置总览" })).toBeVisible();

    for (const section of sections) {
      await gotoReady(page, `/settings?section=${section.key}`);
      await expect(page).toHaveURL(new RegExp(`[?&]section=${section.key}(?:&|$)`));
      await expect(
        page.locator("main").last().getByRole("heading", { name: section.heading }).first(),
        `${section.key} settings marker`,
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page
          .getByRole("navigation", { name: "设置导航" })
          .getByRole("link", { name: section.label })
          .first(),
      ).toHaveAttribute("aria-current", "page");
      await expectNoPageOverflow(page, `/settings?section=${section.key}`);
    }

    await gotoReady(page, "/settings");
    await clickOverviewEntry(page, /账号/);
    await expect(page).toHaveURL(/section=account/);
    await page
      .getByRole("navigation", { name: "设置导航" })
      .getByRole("link", { name: /店铺/ })
      .click();
    await expect(page).toHaveURL(/section=store/);
    await page.goBack();
    await expect(page).toHaveURL(/section=account/);
    await expect(page.getByRole("heading", { name: "我的账号" })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByRole("heading", { name: "店铺管理" })).toBeVisible();
  });
});

test.describe("settings mobile touch targets", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("overview entries and subpage return remain reachable by center tap", async ({ page }) => {
    await gotoReady(page, "/settings");
    const overview = page.locator("[data-settings-overview]");

    for (const section of sections) {
      const link = overview.getByRole("link", { name: section.label }).first();
      await expect(link).toBeVisible();
      await expectLinkCenterHitsSelf(link);
    }

    const storeLink = overview.getByRole("link", { name: /店铺/ }).first();
    await tapLocatorCenter(page, storeLink);
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByRole("heading", { name: "店铺管理" })).toBeVisible();
    const returnLink = page.getByRole("link", { name: "返回设置总览" }).first();
    await expectLinkCenterHitsSelf(returnLink);
    await tapLocatorCenter(page, returnLink);
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "设置总览" })).toBeVisible();
  });
});

test.describe("settings blocked query gate", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("blocked member deep links issue no member-domain requests", async ({ page }) => {
    const memberRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/repairdesk\/stores\/(members|access-requests)$/.test(request.url())) {
        memberRequests.push(request.url());
      }
    });
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: {
          activeStore?: { role?: string };
          permissions?: Record<string, boolean>;
        };
      };
      if (payload.data.activeStore) payload.data.activeStore.role = "technician";
      payload.data.permissions = {
        ...(payload.data.permissions ?? {}),
        canListMembers: false,
        canInviteMembers: false,
        canManageMembers: false,
        canRevokeMembers: false,
        canGrantManager: false,
        canReviewAccessRequests: true,
      };
      await route.fulfill({ response, json: payload });
    });

    await gotoReady(page, "/settings?section=members");
    await expect(page.locator('[data-ui="settings-members-no-permission"]')).toBeVisible();
    await page.waitForTimeout(250);
    expect(memberRequests).toEqual([]);
  });
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function clickOverviewEntry(page: Page, name: RegExp) {
  await page.locator("[data-settings-overview]").getByRole("link", { name }).first().click();
}

async function tapLocatorCenter(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, "tap target should have a bounding box").not.toBeNull();
  await page.touchscreen.tap(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
}

async function expectLinkCenterHitsSelf(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return {
      hitsSelf: target?.closest("a") === element,
      height: rect.height,
      targetTag: target?.tagName ?? null,
    };
  });

  expect(result.hitsSelf, `link center should hit itself: ${JSON.stringify(result)}`).toBe(true);
  expect(result.height).toBeGreaterThanOrEqual(44);
}

async function expectFirstVisible(locator: Locator, label: string) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible()) {
      await expect(candidate, label).toBeVisible();
      return;
    }
  }
  throw new Error(`${label} was not visible`);
}

async function expectNoPageOverflow(page: Page, route: string) {
  const overflow = await page.evaluate(() => ({
    pageWidth: window.innerWidth,
    documentWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.scrollingElement?.scrollWidth ?? 0,
    ),
  }));

  expect(
    overflow.documentWidth,
    `${route} overflowed: documentWidth=${overflow.documentWidth}, pageWidth=${overflow.pageWidth}`,
  ).toBeLessThanOrEqual(overflow.pageWidth);
}
