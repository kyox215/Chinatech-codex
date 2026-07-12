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

test.describe("settings draft safety", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("guards rail navigation and submits only the active section once", async ({ page }) => {
    test.setTimeout(60_000);
    const updateBodies: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/repairdesk/settings/store/update")) {
        updateBodies.push(request.postDataJSON());
      }
    });

    await gotoReady(page, "/settings?section=store");
    const nameInput = page.getByLabel("店铺名");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Etna Repair Lab E2E");
    const saveBar = page.locator("[data-settings-save-bar]");
    await expect(saveBar).toHaveAttribute("data-save-status", "dirty");

    const rulesLink = page
      .getByRole("navigation", { name: "设置导航" })
      .getByRole("link", { name: /默认规则|规则/ });
    await rulesLink.click();
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(nameInput).toHaveValue("Etna Repair Lab E2E");
    expect(updateBodies).toEqual([]);

    await rulesLink.click();
    await guard.getByRole("button", { name: "保存并继续" }).click();
    await expect(page).toHaveURL(/section=rules/);
    expect(updateBodies).toHaveLength(1);
    expect(updateBodies[0]).toMatchObject({
      section: "store",
      input: { store_name: "Etna Repair Lab E2E" },
    });
    expect(updateBodies[0]).not.toHaveProperty("input.print_footer");
    expect(updateBodies[0]).not.toHaveProperty("input.default_order_warranty_months");
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("guards command palette navigation and releases modal pointer locks", async ({ page }) => {
    await gotoReady(page, "/settings?section=store");
    await page.getByLabel("店铺名").fill("Command Palette Draft");
    await expect(page.locator("[data-settings-save-bar]")).toHaveAttribute(
      "data-save-status",
      "dirty",
    );

    await page.getByRole("button", { name: /搜索工单、客户、库存/ }).click();
    const paletteInput = page.getByPlaceholder("输入命令、搜索工单或客户…");
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("工单列表");
    await page.getByRole("option", { name: /工单列表/ }).click();

    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(paletteInput).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("guards AppSidebar links before any route transition", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoReady(page, "/settings?section=store");
    await page.getByLabel("店铺名").fill("Sidebar Draft");
    const ordersLink = page.getByRole("link", { name: "订单管理", exact: true }).first();

    await ordersLink.click();
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByLabel("店铺名")).toHaveValue("Sidebar Draft");

    await ordersLink.click();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/orders$/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("guards store switching and keeps the current form mounted after a failed switch", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    let switchRequests = 0;
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: {
          activeStore?: Record<string, unknown>;
          stores?: Array<Record<string, unknown>>;
        };
      };
      const activeStore = payload.data.activeStore;
      if (activeStore) {
        payload.data.stores = [
          ...(payload.data.stores ?? []),
          {
            ...activeStore,
            id: "store-e2e-b",
            membershipId: "membership-store-e2e-b",
            name: "Etna Phone Lab",
            slug: "etna-phone-lab",
          },
        ];
      }
      await route.fulfill({ response, json: payload });
    });
    await page.route("**/api/repairdesk/stores/switch", async (route) => {
      switchRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        json: { error: { message: "mock switch failure" } },
      });
    });

    await gotoReady(page, "/settings?section=store");
    const nameInput = page.getByLabel("店铺名");
    const originalName = await nameInput.inputValue();
    await nameInput.fill("Switch Draft");
    const storeSelect = page.getByLabel("当前店铺");
    await storeSelect.click();
    await page.getByRole("option", { name: "Etna Phone Lab" }).click();
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    expect(switchRequests).toBe(0);
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(nameInput).toHaveValue("Switch Draft");

    await storeSelect.click();
    await page.getByRole("option", { name: "Etna Phone Lab" }).click();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect.poll(() => switchRequests).toBe(1);
    await expect(nameInput).toHaveValue(originalName);
  });

  test("restores back and forward history until the dirty decision is resolved", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoReady(page, "/settings");
    await clickOverviewEntry(page, /店铺/);
    await expect(page).toHaveURL(/section=store/);
    await page
      .getByRole("navigation", { name: "设置导航" })
      .getByRole("link", { name: /默认规则|规则/ })
      .click();
    await expect(page).toHaveURL(/section=rules/);

    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/section=store/);
    await page.getByLabel("店铺名").fill("Forward Guard Draft");

    await page.evaluate(() => window.history.forward());
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await expect(page).toHaveURL(/section=store/);
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);

    await page.evaluate(() => window.history.forward());
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/section=rules/);
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });
});

test.describe("settings mobile global guard surfaces", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("guards MobileWorkspaceDock route actions", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoReady(page, "/settings?section=store");
    await page.getByLabel("店铺名").fill("Mobile Dock Draft");
    await page.getByRole("button", { name: "打开快捷操作" }).click();
    await page.getByRole("button", { name: /当前 · 邀请成员/ }).click();

    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByLabel("店铺名")).toHaveValue("Mobile Dock Draft");

    await page.getByRole("button", { name: "打开快捷操作" }).click();
    await page.getByRole("button", { name: /当前 · 邀请成员/ }).click();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/section=members/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("guards ScanSearch route actions until the draft decision", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoReady(page, "/settings?section=store");
    await page.getByLabel("店铺名").fill("Scanner Draft");
    await page.getByRole("button", { name: "打开快捷操作" }).click();
    await page.getByRole("button", { name: "扫码读取" }).click();
    const scanner = page.getByRole("dialog", { name: "全局扫码查询" });
    await scanner
      .getByPlaceholder("无法扫码时，可手动输入或粘贴")
      .fill("https://example.com/orders/order_123");
    await scanner.getByRole("button", { name: "识别内容" }).click();
    await scanner.getByRole("button", { name: "打开工单" }).click();

    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(scanner).toBeVisible();

    await scanner.getByRole("button", { name: "打开工单" }).click();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/orders\/order_123$/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
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
