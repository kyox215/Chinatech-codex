import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const sections = [
  { key: "account", label: /账号/, heading: "我的账号" },
  { key: "members", label: /员工/, heading: "员工与权限" },
  { key: "store", label: /店铺/, heading: "店铺工作区" },
  { key: "suppliers", label: /供应商/, heading: "供应商" },
  { key: "kiosk", label: /客户 iPad|iPad/, heading: "客户 iPad" },
  { key: "rules", label: /默认规则|规则/, heading: "默认规则" },
  { key: "workflow", label: /状态流|状态/, heading: "工单状态流" },
  { key: "notifications", label: /通知与打印|通知/, heading: "输出配置" },
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

      if (viewport.width === 390 || viewport.width === 1440) {
        await hideNextDevIndicators(page);
        await page.screenshot({
          path: `screenshots/responsive-density/settings/wp08-overview-${viewport.width}x${viewport.height}.png`,
          fullPage: true,
        });
      }
    });
  }
});

test.describe("settings navigation and deep links", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("falls back to the overview for an unknown section", async ({ page }) => {
    await gotoReady(page, "/settings?section=unknown");
    await expect(page.getByRole("heading", { name: "设置总览" })).toBeVisible();
  });

  for (const section of sections) {
    test(`keeps the ${section.key} deep link reachable`, async ({ page }) => {
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
    });
  }

  test("preserves overview, rail, back, and forward history", async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "店铺工作区" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "店铺工作区" })).toBeVisible();
    const mobileSaveBox = await page
      .getByRole("button", { name: "保存设置" })
      .first()
      .boundingBox();
    expect(mobileSaveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(mobileSaveBox?.width ?? 0).toBeGreaterThanOrEqual(44);
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

test.describe("settings account and store workspace details", () => {
  test("keeps both recovery actions tappable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let contextUnavailable = true;
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      if (contextUnavailable) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "synthetic" } }),
        });
        return;
      }
      await route.continue();
    });

    await gotoReady(page, "/settings");
    const contextRetry = page
      .locator('[data-ui="settings-context-error"]')
      .getByRole("button", { name: "重新加载" });
    await expect(contextRetry).toBeVisible();
    expect((await contextRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    contextUnavailable = false;
    await page.unroute("**/api/repairdesk/stores/context");
    await page.route("**/api/repairdesk/settings/store", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "synthetic" } }),
      });
    });
    await gotoReady(page, "/settings?section=store");
    const sectionError = page.locator('[data-ui="settings-section-load-error"]');
    await expect(sectionError).toBeVisible();
    const sectionRetry = sectionError.getByRole("button", { name: "重新加载" });
    expect((await sectionRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp08-store-recovery-390x844.png",
      fullPage: true,
    });
  });

  test("renders the account identity and security workflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/settings?section=account");

    await expect(page.getByRole("heading", { name: "我的账号" })).toBeVisible();
    await expect(page.getByText("账号性质", { exact: true })).toBeVisible();
    await expect(page.getByText("当前店铺角色", { exact: true })).toBeVisible();
    await expect(page.getByText("登录邮箱", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "打开个人中心" })).toHaveAttribute(
      "href",
      "/account",
    );
    await expectNoPageOverflow(page, "account settings 390px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03b-account-390x844.png",
      fullPage: true,
    });
  });

  test("separates workspace, profile, output readiness, and confirmed creation on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/settings?section=store");

    for (const heading of ["店铺工作区", "店铺资料", "客户输出就绪度", "创建独立店铺"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expectNoPageOverflow(page, "store settings 1280px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03b-store-1280x800.png",
      fullPage: true,
    });
    await page.getByLabel("新店铺名称").fill("Second Repair Lab");
    await page.getByRole("button", { name: "创建并切换" }).click();
    const confirm = page.getByRole("alertdialog", { name: "确认创建独立店铺？" });
    await expect(confirm).toContainText("Second Repair Lab");
    await expect(confirm).toContainText("当前店铺的数据与权限不会复制");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03b-store-create-confirm-1280x800.png",
    });
    await confirm.getByRole("button", { name: "取消" }).click();
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("shows semantic read-only profile values without hiding independent creation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/repairdesk/stores/context", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: {
          activeStore?: { role?: string };
          permissions?: Record<string, boolean>;
        };
      };
      if (payload.data.activeStore) payload.data.activeStore.role = "viewer";
      payload.data.permissions = {
        ...(payload.data.permissions ?? {}),
        canReadStoreSettings: true,
        canUpdateStoreSettings: false,
      };
      await route.fulfill({ response, json: payload });
    });

    await gotoReady(page, "/settings?section=store");
    await expect(
      page.getByText("当前账号不能修改当前店铺资料，但仍可按账号资格创建新的独立店铺。"),
    ).toBeVisible();
    await expect(page.getByText("当前账号可查看店铺资料；修改请联系店主或经理。")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "店铺名", exact: true })).toHaveCount(0);
    await expect(page.locator("dt").filter({ hasText: /^店铺名$/ })).toBeVisible();
    await expect(page.getByLabel("新店铺名称")).toBeEnabled();
    await page.getByLabel("新店铺名称").fill("Viewer Store");
    await page.getByRole("button", { name: "创建并切换" }).click();
    const confirm = page.getByRole("alertdialog", { name: "确认创建独立店铺？" });
    for (const buttonName of ["取消", "确认创建并切换"]) {
      await expect
        .poll(async () => {
          const box = await confirm.getByRole("button", { name: buttonName }).boundingBox();
          return box?.height ?? 0;
        })
        .toBeGreaterThanOrEqual(44);
    }
    await confirm.getByRole("button", { name: "取消" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPageOverflow(page, "readonly store settings 390px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03b-store-readonly-390x844.png",
      fullPage: true,
    });
  });

  test("keeps actual output blocked while a mobile draft only projects recovery", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(/\/api\/repairdesk\/settings\/store(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: Record<string, unknown>;
      };
      payload.data = {
        ...payload.data,
        store_name: "ChinaTech",
        store_address: "",
        store_phone: "+39 0931 000000",
        message_signature: "ChinaTech · Assistenza",
        print_footer: "Grazie per aver scelto ChinaTech.",
      };
      await route.fulfill({ response, json: payload });
    });

    await gotoReady(page, "/settings?section=store");
    await expect(page.getByText("当前已暂停")).toBeVisible();
    await page
      .getByRole("textbox", { name: "门店默认地址（用于打印）", exact: true })
      .fill("Via Roma 12, Floridia");
    await expect(page.getByText(/当前客户输出仍然阻断；保存这份草稿后预计解除阻断/)).toBeVisible();
    await expect(page.getByText("当前已暂停")).toBeVisible();
    await expectNoPageOverflow(page, "store draft projection 390px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03b-store-draft-390x844.png",
      fullPage: true,
    });
  });

  test("keeps the store subpage readable at the tablet breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoReady(page, "/settings?section=store");

    await expect(page.getByRole("link", { name: "返回设置总览" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "店铺资料" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "客户输出就绪度" })).toBeVisible();
    await expectNoPageOverflow(page, "store settings 768px");
  });
});

test.describe("settings notifications and default rules", () => {
  test("keeps saved output distinct from a mobile notification draft", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeCompleteStoreSettings(page);
    await gotoReady(page, "/settings?section=notifications");

    const section = page.locator("[data-settings-notifications-section]");
    await expect(section.getByRole("heading", { name: "输出配置" })).toBeVisible();
    await expect(section.getByText("当前已就绪")).toBeVisible();
    const signature = section.getByLabel("客户消息签名");
    await signature.fill("Repair Lab · Pending signature");
    await expect(section.getByText("未保存草稿预估")).toBeVisible();
    await expect(section.getByText("未保存草稿 · 客户消息")).toBeVisible();

    for (const target of [signature, section.getByRole("link", { name: /打开消息模板/ })]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoPageOverflow(page, "notification settings dirty 390px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-notifications-dirty-390x844.png",
      fullPage: true,
    });
  });

  test("renders notification previews without desktop overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeCompleteStoreSettings(page);
    await gotoReady(page, "/settings?section=notifications");

    const section = page.locator("[data-settings-notifications-section]");
    await expect(section.getByText("客户消息预览")).toBeVisible();
    await expect(section.getByText("打印资料预览")).toBeVisible();
    await expect(section.getByRole("link", { name: /打开消息模板/ })).toHaveAttribute(
      "href",
      "/messages",
    );
    await expectNoPageOverflow(page, "notification settings 1280px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-notifications-1280x800.png",
      fullPage: true,
    });
  });

  test("uses semantic read-only notification values and locks the template link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await routeCompleteStoreSettings(page);
    await routeReadonlySettingsContext(page);
    await gotoReady(page, "/settings?section=notifications");

    const section = page.locator("[data-settings-notifications-section]");
    await expect(section.locator("dl")).toBeVisible();
    await expect(section.getByRole("textbox")).toHaveCount(0);
    await expect(section.getByRole("link", { name: /打开消息模板/ })).toHaveCount(0);
    await expect(section.getByText("当前账号无模板读取权限")).toBeVisible();
    await expectNoPageOverflow(page, "readonly notification settings 430px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-notifications-readonly-430x932.png",
      fullPage: true,
    });
  });

  test("preserves zero as no warranty in the mobile rule draft", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeCompleteStoreSettings(page);
    await gotoReady(page, "/settings?section=rules");

    const section = page.locator("[data-settings-rules-section]");
    const inventoryWarranty = section.getByLabel("新库存商品默认保修月数");
    await inventoryWarranty.fill("0");
    await expect(section.getByText(/0 表示新库存默认无保修/)).toBeVisible();
    await expect(page.locator("[data-settings-save-bar]")).toHaveAttribute(
      "data-save-status",
      "dirty",
    );
    const restoreBox = await section.getByRole("button", { name: "恢复系统默认" }).boundingBox();
    expect(restoreBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await inventoryWarranty.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoPageOverflow(page, "rules settings dirty 390px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-rules-dirty-390x844.png",
      fullPage: true,
    });
  });

  test("previews restore defaults and saves only after explicit confirmation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeCompleteStoreSettings(page, {
      default_order_warranty_text: "两年",
      default_order_warranty_months: 24,
      default_inventory_warranty_months: 36,
    });
    const updates: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/repairdesk/settings/store/update")) {
        updates.push(request.postDataJSON());
      }
    });
    await gotoReady(page, "/settings?section=rules");

    const restoreButton = page.getByRole("button", { name: "恢复系统默认" });
    await restoreButton.click();
    const dialog = page.getByRole("alertdialog", { name: "把系统默认值应用到草稿？" });
    await expect(dialog).toContainText("两年");
    await expect(dialog).toContainText("36 个月");
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(restoreButton).toBeFocused();
    await restoreButton.click();
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () => {
        const box = await dialog.getByRole("button", { name: "应用默认值到草稿" }).boundingBox();
        return box?.height ?? 0;
      })
      .toBeGreaterThanOrEqual(44);
    expect(updates).toEqual([]);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-rules-restore-1280x800.png",
    });
    await dialog.getByRole("button", { name: "应用默认值到草稿" }).click();
    await expect(restoreButton).toBeFocused();
    expect(updates).toEqual([]);
    await expect(page.locator("[data-settings-save-bar]")).toHaveAttribute(
      "data-save-status",
      "dirty",
    );
    await page
      .locator("[data-settings-save-bar]")
      .getByRole("button", { name: "保存设置" })
      .click();
    await expect.poll(() => updates.length).toBe(1);
    expect(updates[0]).toMatchObject({
      section: "rules",
      input: {
        default_order_warranty_months: 6,
        default_inventory_warranty_months: 12,
      },
    });
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
    await page.unrouteAll({ behavior: "wait" });
  });

  test("keeps both child pages responsive at 768 and 1024 with maximum-length output", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await routeCompleteStoreSettings(page, {
      message_signature: "S".repeat(300),
      print_footer: "F".repeat(500),
    });

    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoReady(page, "/settings?section=notifications");
      await expect(page.locator("[data-settings-notifications-section]")).toBeVisible();
      await expectNoPageOverflow(page, `notification settings ${viewport.width}px`);

      await gotoReady(page, "/settings?section=rules");
      await expect(page.locator("[data-settings-rules-section]")).toBeVisible();
      await expectNoPageOverflow(page, `rules settings ${viewport.width}px`);
    }
  });

  test("renders desktop rule values as read-only semantics", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routeCompleteStoreSettings(page);
    await routeReadonlySettingsContext(page);
    await gotoReady(page, "/settings?section=rules");

    const section = page.locator("[data-settings-rules-section]");
    await expect(section.locator("dl")).toBeVisible();
    await expect(section.getByRole("combobox")).toHaveCount(0);
    await expect(section.getByRole("spinbutton")).toHaveCount(0);
    await expect(section.getByRole("button", { name: "恢复系统默认" })).toHaveCount(0);
    await expectNoPageOverflow(page, "readonly rules settings 1440px");
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp03c-rules-readonly-1440x900.png",
      fullPage: true,
    });
  });
});

test.describe("settings customer iPad workspace", () => {
  for (const viewport of viewports) {
    test(`keeps the Kiosk workspace responsive at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoReady(page, "/settings?section=kiosk");

      const section = page.locator("#settings-kiosk");
      await expect(section.getByRole("heading", { name: "客户 iPad" })).toBeVisible();
      await expect(section.getByText("设备配对")).toBeVisible();
      await expect(section.getByText("设备列表")).toBeVisible();
      await expect(section.getByText("待员工审核")).toBeVisible();
      await expectNoPageOverflow(page, `kiosk settings ${viewport.width}px`);

      if (viewport.width <= 430) {
        for (const control of [
          section.getByLabel("新 iPad 名称"),
          section.getByRole("button", { name: /生成配对码/ }),
        ]) {
          expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }

  test("reviews a synthetic submission, preserves the returned draft, and removes revoked token access", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/settings?section=kiosk");
    const deviceLabel = "WP05 Test iPad";
    await page.getByLabel("新 iPad 名称").fill(deviceLabel);
    await page.getByRole("button", { name: /生成配对码/ }).click();
    const code = (await page.locator("[data-kiosk-pairing-code]").textContent())?.trim();
    expect(code).toBeTruthy();
    const deviceCard = page.locator(`[data-kiosk-device-id]:has-text("${deviceLabel}")`).first();
    await expect(deviceCard).toBeVisible();
    const deviceId = await deviceCard.getAttribute("data-kiosk-device-id");
    expect(deviceId).toBeTruthy();
    if (!deviceId) throw new Error("paired kiosk card is missing its device id");
    const paired = await page.request.post("/api/kiosk/pair", { data: { code } });
    const pairPayload = (await paired.json()) as { data?: { token?: string }; error?: string };
    expect(
      paired.ok(),
      `pair kiosk device failed (${paired.status()}): ${JSON.stringify(pairPayload)}`,
    ).toBe(true);
    const kioskToken = pairPayload.data?.token;
    expect(kioskToken).toBeTruthy();
    if (!kioskToken) throw new Error("paired kiosk response is missing its token");

    await page.setViewportSize({ width: 390, height: 844 });

    const created = await page.request.post("/api/repairdesk/kiosk/sessions/create", {
      data: {
        input: {
          device_id: deviceId,
          session_type: "intake_contact",
          expires_in_minutes: 30,
        },
      },
    });
    expect(
      created.ok(),
      `create kiosk session failed (${created.status()}): ${await created.text()}`,
    ).toBe(true);
    const submitted = await page.request.post("/api/kiosk/session/submit", {
      headers: { "x-kiosk-token": kioskToken },
      data: {
        customer_name: "Cliente Test Kiosk",
        customer_phone: "+39 333 111 2222",
        note: "Dati sintetici per verifica UI",
        confirmation_checked: true,
      },
    });
    expect(
      submitted.ok(),
      `submit kiosk session failed (${submitted.status()}): ${await submitted.text()}`,
    ).toBe(true);

    await gotoReady(page, "/settings?section=kiosk");
    const reviewCard = page.locator('[data-kiosk-review-id]:has-text("Cliente Test Kiosk")');
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard.getByText("+39 333 111 2222")).toBeVisible();
    await reviewCard.getByLabel("给客户的退回原因").fill("请重新确认联系电话");
    await reviewCard.getByRole("button", { name: "退回重填" }).click();
    const returnConfirm = page.getByRole("alertdialog", { name: "确认退回给客户重填？" });
    await expect(returnConfirm).toContainText("请重新确认联系电话");
    for (const buttonName of ["取消", "确认提交"]) {
      expect(
        (await returnConfirm.getByRole("button", { name: buttonName }).boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(44);
    }
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp05-kiosk-review-return-390x844.png",
      fullPage: true,
    });
    await returnConfirm.getByRole("button", { name: "确认提交" }).click();
    await expect(reviewCard).toBeHidden();

    await page.evaluate(
      (token) => window.localStorage.setItem("repairdesk:kiosk-token", token),
      kioskToken,
    );
    await gotoReady(page, "/kiosk");
    await expect(page.getByText("请重新确认联系电话")).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue("Cliente Test Kiosk");
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp05-kiosk-public-returned-390x844.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/settings?section=kiosk");
    await expect(deviceCard).toBeVisible();
    await deviceCard.getByRole("button", { name: "撤销设备" }).click();
    const revokeConfirm = page.getByRole("alertdialog", { name: "撤销这台客户 iPad？" });
    await expect(revokeConfirm).toContainText("设备 token 会立即失效");
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp05-kiosk-device-revoke-1280x800.png",
    });
    await revokeConfirm.getByRole("button", { name: "确认撤销" }).click();
    await expect(revokeConfirm).toBeHidden();
    await expect(deviceCard.getByText("已撤销")).toBeVisible();

    const revoked = await page.request.get("/api/kiosk/session", {
      headers: { "x-kiosk-token": kioskToken },
    });
    expect(revoked.status()).toBe(401);
    await expectNoPageOverflow(page, "kiosk revoked device 1280px");

    await page.evaluate((token) => {
      window.localStorage.setItem("repairdesk:kiosk-token", token);
    }, kioskToken);
    await gotoReady(page, "/kiosk");
    await expect(
      page.getByText("Questo iPad non è più autorizzato. Richiedi un nuovo codice allo staff."),
    ).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem("repairdesk:kiosk-token")),
    ).toBeNull();
    await expect(page.getByText(deviceLabel)).toHaveCount(0);
  });
});

test.describe("settings members and suppliers workspace", () => {
  test("stages a sensitive member grant and submits only the permission endpoint on mobile", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const permissionRequests: unknown[] = [];
    const roleRequests: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/repairdesk/stores/members/update-permissions")) {
        permissionRequests.push(request.postDataJSON());
      }
      if (request.url().endsWith("/api/repairdesk/stores/members/update-role")) {
        roleRequests.push(request.postDataJSON());
      }
    });

    await gotoReady(page, "/settings?section=members");
    await expect(page.getByRole("heading", { name: "员工与权限" })).toBeVisible();
    const technicianCard = page.locator(
      '[data-member-id="10000000-0000-4000-8000-000000000003"]:visible',
    );
    await technicianCard.getByRole("button", { name: "管理" }).click();
    const sheet = page.getByRole("dialog", { name: "演示技术员" });
    await expect(sheet).toBeVisible();
    expect((await sheet.getByRole("button", { name: "Close" }).boundingBox())?.height ?? 0).toBe(
      44,
    );
    expect(
      (await sheet.locator('label[for="member-permission-supplier:manage"]').boundingBox())
        ?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await sheet.getByLabel("管理供应商").click();
    expect(permissionRequests).toEqual([]);
    expect(roleRequests).toEqual([]);

    await sheet.getByRole("button", { name: "保存员工变更" }).click();
    const confirm = page.getByRole("alertdialog", { name: "确认授予敏感员工权限？" });
    await expect(confirm).toContainText("供应商管理");
    expect(permissionRequests).toEqual([]);
    await confirm.getByRole("button", { name: "取消" }).click();
    await expect(sheet.getByRole("button", { name: "保存员工变更" })).toBeFocused();
    await sheet.getByRole("button", { name: "保存员工变更" }).click();
    await expect(confirm).toBeVisible();
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp04-member-grant-confirm-390x844.png",
      fullPage: true,
    });
    await confirm.getByRole("button", { name: "确认并保存" }).click();

    await expect.poll(() => permissionRequests.length).toBe(1);
    expect(roleRequests).toEqual([]);
    expect(permissionRequests[0]).toMatchObject({
      id: "10000000-0000-4000-8000-000000000003",
      permissions: ["supplier:read", "supplier:assign", "supplier:manage"],
    });
    await expect(sheet).toBeHidden();
    await expectNoPageOverflow(page, "member editor 390px");
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("saves a role change alone and disables grants until the member is reloaded", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const permissionRequests: unknown[] = [];
    const roleRequests: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/repairdesk/stores/members/update-permissions")) {
        permissionRequests.push(request.postDataJSON());
      }
      if (request.url().endsWith("/api/repairdesk/stores/members/update-role")) {
        roleRequests.push(request.postDataJSON());
      }
    });

    await gotoReady(page, "/settings?section=members");
    const technicianRow = page.locator(
      '[data-member-id="10000000-0000-4000-8000-000000000003"]:visible',
    );
    await technicianRow.getByRole("button", { name: "管理" }).click();
    const sheet = page.getByRole("dialog", { name: "演示技术员" });
    await expect(sheet).toBeVisible();
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp08-member-drawer-1280x800.png",
    });
    await sheet.getByRole("combobox").click();
    await page.getByRole("option", { name: "前台" }).click();
    await expect(sheet.getByLabel("管理供应商")).toBeDisabled();
    await expect(sheet.getByText(/请先保存角色并重新读取成员/)).toBeVisible();
    await sheet.getByRole("button", { name: "保存员工变更" }).click();

    await expect.poll(() => roleRequests.length).toBe(1);
    expect(permissionRequests).toEqual([]);
    expect(roleRequests[0]).toMatchObject({
      id: "10000000-0000-4000-8000-000000000003",
      role: "sales",
    });
  });

  test("reviews a mock access request through the real confirmation flow", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const rejectRequests: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/repairdesk/stores/access-requests/reject")) {
        rejectRequests.push(request.postDataJSON());
      }
    });

    await gotoReady(page, "/settings?section=members");
    await expect(page.getByText("演示申请人")).toBeVisible();
    const trigger = page.getByRole("button", { name: "拒绝" });
    await trigger.click();
    const confirm = page.getByRole("alertdialog", { name: "拒绝加入申请？" });
    await confirm.getByRole("button", { name: "取消" }).click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await confirm.getByRole("button", { name: "确认拒绝" }).click();

    await expect.poll(() => rejectRequests.length).toBe(1);
    expect(rejectRequests[0]).toMatchObject({
      id: "20000000-0000-4000-8000-000000000001",
    });
    await expect(page.getByText("演示申请人")).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("validates, creates, and confirms irreversible supplier archive on desktop", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/settings?section=suppliers");

    await page.getByRole("button", { name: "添加供应商" }).click();
    const sheet = page.getByRole("dialog", { name: "添加供应商" });
    await sheet.getByLabel("名称").fill("WP04 Test Supplier");
    await sheet.getByLabel("网站").fill("javascript:alert(1)");
    await sheet.getByRole("button", { name: "保存供应商" }).click();
    await expect(sheet.getByText("供应商网站只允许 http 或 https")).toBeVisible();
    await expect(sheet.getByLabel("网站")).toBeFocused();

    await sheet.getByLabel("网站").fill("https://supplier.example.test");
    await sheet.getByRole("button", { name: "保存供应商" }).click();
    const supplierCard = page.locator("[data-supplier-id]:visible", {
      hasText: "WP04 Test Supplier",
    });
    await expect(supplierCard).toBeVisible();
    await expectNoPageOverflow(page, "supplier settings 1280px");
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp04-supplier-created-1280x800.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageOverflow(page, "supplier card 390px");
    await hideNextDevIndicators(page);
    await page.screenshot({
      path: "screenshots/responsive-density/settings/wp04-supplier-card-390x844.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    await supplierCard.getByRole("button", { name: "归档" }).click();
    const confirm = page.getByRole("alertdialog", {
      name: "归档 WP04 Test Supplier？",
    });
    await expect(confirm).toContainText("当前没有恢复归档 API");
    await confirm.getByRole("button", { name: "确认归档" }).click();
    await expect(supplierCard).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("keeps member and supplier child pages responsive across six target widths", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await gotoReady(page, "/settings?section=members");
      await expect(page.getByRole("heading", { name: "员工与权限" })).toBeVisible();
      const memberTable = page.locator("#settings-members table");
      if (viewport.width >= 1280) await expect(memberTable).toBeVisible();
      else await expect(memberTable).toBeHidden();
      await expectNoPageOverflow(page, `members settings ${viewport.width}px`);

      await gotoReady(page, "/settings?section=suppliers");
      await expect(page.getByRole("heading", { name: "供应商", exact: true })).toBeVisible();
      await expectNoPageOverflow(page, `supplier settings ${viewport.width}px`);
    }
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
    const nameInput = page.getByLabel("店铺名", { exact: true });
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
    await page.getByLabel("店铺名", { exact: true }).fill("Command Palette Draft");
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
    await page.getByLabel("店铺名", { exact: true }).fill("Sidebar Draft");
    const ordersLink = page.getByRole("link", { name: "维修工单", exact: true }).first();

    await ordersLink.click();
    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByLabel("店铺名", { exact: true })).toHaveValue("Sidebar Draft");

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
    const nameInput = page.getByLabel("店铺名", { exact: true });
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
    await page.getByLabel("店铺名", { exact: true }).fill("Forward Guard Draft");

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

test.describe("settings mobile overlay and guard safety", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("guards the mobile return link without a floating quick-action overlay", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoReady(page, "/settings?section=store");
    await expect(page.locator('[data-mobile-workspace-trigger="true"]')).toHaveCount(0);
    await page.getByLabel("店铺名", { exact: true }).fill("Mobile Return Draft");
    const returnLink = page.getByRole("link", { name: "返回设置总览" }).first();
    await returnLink.click();

    const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/section=store/);
    await expect(page.getByLabel("店铺名", { exact: true })).toHaveValue("Mobile Return Draft");

    await returnLink.click();
    await guard.getByRole("button", { name: "放弃修改" }).click();
    await expect(page).toHaveURL(/\/settings$/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents))
      .not.toBe("none");
  });

  test("keeps the focused address field as the top hit target", async ({ page }) => {
    await gotoReady(page, "/settings?section=store");
    const address = page.getByRole("textbox", {
      name: "门店默认地址（用于打印）",
      exact: true,
    });
    await address.scrollIntoViewIfNeeded();
    await address.focus();
    const box = await address.boundingBox();
    expect(box).not.toBeNull();
    const hitAddress = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.id === "store-address",
      { x: (box?.x ?? 0) + (box?.width ?? 0) - 16, y: (box?.y ?? 0) + (box?.height ?? 0) - 16 },
    );

    expect(hitAddress).toBe(true);
    await expect(page.locator('[data-mobile-workspace-trigger="true"]')).toHaveCount(0);
  });
});

test.describe("WP06 settings workflow draft contract", () => {
  for (const viewport of viewports) {
    test(`keeps workflow editing local at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      const workflowWrites: string[] = [];
      page.on("request", (request) => {
        if (/order-workflow\/(status|transitions)\//.test(request.url())) {
          workflowWrites.push(request.url());
        }
      });

      await gotoReady(page, "/settings?section=workflow");
      const section = page.locator('[data-ui="settings-workflow-section"]');
      await expect(section.getByRole("heading", { name: "工单状态流" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(section.locator('[aria-label="状态列表"]')).toBeVisible();
      const transitionPanel = section.locator('[data-ui="settings-workflow-transitions"]:visible');
      await expect(transitionPanel).toBeVisible();
      await expectNoPageOverflow(page, `workflow settings ${viewport.width}px`);

      const statusBox = await section.locator('[aria-label="状态列表"]').boundingBox();
      const transitionBox = await transitionPanel.boundingBox();
      const gateBox = await section.locator('[data-ui="workflow-apply-gate"]').boundingBox();
      expect(statusBox).not.toBeNull();
      expect(transitionBox).not.toBeNull();
      expect(gateBox).not.toBeNull();
      expect(gateBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(statusBox?.y ?? 0);
      if (viewport.width >= 1280) {
        expect(transitionBox?.x ?? 0).toBeGreaterThan(statusBox?.x ?? 0);
        expect(Math.abs((transitionBox?.y ?? 0) - (statusBox?.y ?? 0))).toBeLessThanOrEqual(2);
      } else {
        expect(await transitionPanel.evaluate((element) => element.tagName)).toBe("DETAILS");
      }

      const editButton = section
        .locator('[data-workflow-status-code="new"]')
        .getByRole("button", { name: "编辑状态 新建", exact: true });
      if (viewport.width <= 430) {
        expect((await editButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      if (viewport.width === 390) {
        await editButton.click();
        let editor = page.getByRole("dialog", { name: /编辑「/ });
        await expect(editor).toBeVisible();
        expect(
          (await editor.getByLabel("状态名称").boundingBox())?.height ?? 0,
        ).toBeGreaterThanOrEqual(44);
        await page.keyboard.press("Escape");
        await expect(editor).toBeHidden();
        await expect(editButton).toBeFocused();
        await expectOverlayReleased(page, section, editButton);

        await editButton.click();
        editor = page.getByRole("dialog", { name: /编辑「/ });
        await expect(editor).toBeVisible();
        await editor.getByLabel("状态名称").fill("WP06 本地状态");
        expect(workflowWrites).toEqual([]);
        await page.waitForTimeout(250);
        await hideNextDevIndicators(page);
        await page.screenshot({
          path: "screenshots/responsive-density/settings/wp06-workflow-editor-390x844.png",
        });
        await editor.getByRole("button", { name: "完成编辑" }).click();
        await expect(section.getByText("WP06 本地状态").first()).toBeVisible();
        expect(workflowWrites).toEqual([]);

        const reviewTrigger = section.getByRole("button", { name: /检查变更/ });
        await reviewTrigger.click();
        const review = page.getByRole("dialog", { name: "检查状态流变更" });
        await expect(review).toContainText("修改状态名称");
        await expect(review.getByRole("heading", { name: "检查状态流变更" })).toBeFocused();
        await expect(review.getByRole("button", { name: /应用状态流/ })).toBeDisabled();
        expect(workflowWrites).toEqual([]);
        await page.waitForTimeout(200);
        await hideNextDevIndicators(page);
        await page.screenshot({
          path: "screenshots/responsive-density/settings/wp06-workflow-review-390x844.png",
        });
        await review.getByRole("button", { name: "返回继续编辑" }).click();
        await expect(review).toBeHidden();
        await expect(reviewTrigger).toBeFocused();
        await expectOverlayReleased(page, section, reviewTrigger);
        await expectNoPageOverflow(page, "dirty workflow settings 390px");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: "screenshots/responsive-density/settings/wp06-workflow-390x844.png",
        });

        await page.getByRole("link", { name: "返回设置总览" }).first().click();
        const guard = page.getByRole("alertdialog", { name: "当前设置尚未保存" });
        await expect(guard).toContainText("状态流需等待带版本校验的事务接口获批后才能应用");
        await expect(guard.getByRole("button", { name: "保存并继续" })).toBeDisabled();
        await guard.getByRole("button", { name: "放弃修改" }).click();
        await expect(page).toHaveURL(/\/settings$/);
      }

      if (viewport.width === 1024) {
        await editButton.click();
        const editor = page.getByRole("dialog", { name: /编辑「/ });
        await expect(editor).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(editor).toBeHidden();
        await expect(editButton).toBeFocused();
        await expectOverlayReleased(page, section, editButton);
      }

      if (viewport.width === 1440) {
        await hideNextDevIndicators(page);
        await page.screenshot({
          path: "screenshots/responsive-density/settings/wp06-workflow-1440x900.png",
        });
      }

      expect(workflowWrites).toEqual([]);
    });
  }
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  await hideNextDevIndicators(page);
}

async function hideNextDevIndicators(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => {
    for (const portal of document.querySelectorAll<HTMLElement>("nextjs-portal")) {
      portal.style.setProperty("display", "none", "important");
    }
  });
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

async function expectOverlayReleased(page: Page, content: Locator, target: Locator) {
  await expect.poll(() => page.evaluate(() => document.body.style.pointerEvents)).not.toBe("none");
  await expect
    .poll(() => content.evaluate((element) => !element.closest('[aria-hidden="true"], [inert]')))
    .toBe(true);
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit === element || element.contains(hit);
      }),
    )
    .toBe(true);
}

async function routeCompleteStoreSettings(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route(/\/api\/repairdesk\/settings\/store(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as { data: Record<string, unknown> };
    payload.data = {
      ...payload.data,
      store_name: "Repair Lab",
      store_address: "Via Roma 12, Siracusa",
      store_phone: "+39 0931 000000",
      store_whatsapp: "",
      store_email: "repair@example.test",
      default_order_warranty_text: "6个月",
      default_order_warranty_months: 6,
      default_inventory_warranty_months: 12,
      message_signature: "Repair Lab · Assistenza",
      print_footer: "Grazie per aver scelto Repair Lab.",
      ...overrides,
    };
    await route.fulfill({ response, json: payload });
  });
}

async function routeReadonlySettingsContext(page: Page) {
  await page.route("**/api/repairdesk/stores/context", async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      data: {
        activeStore?: { role?: string };
        permissions?: Record<string, boolean>;
      };
    };
    if (payload.data.activeStore) payload.data.activeStore.role = "viewer";
    payload.data.permissions = {
      ...(payload.data.permissions ?? {}),
      canReadStoreSettings: true,
      canUpdateStoreSettings: false,
      canReadMessageTemplates: false,
      canUpdateMessageTemplates: false,
    };
    await route.fulfill({ response, json: payload });
  });
}
