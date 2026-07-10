import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const sections = [
  { key: "account", buttonName: /账号/, heading: "我的账号" },
  { key: "store", buttonName: /店铺/, heading: "店铺管理" },
  { key: "suppliers", buttonName: /供应商/, heading: "供应商" },
  { key: "members", buttonName: /员工/, heading: "员工管理" },
  { key: "kiosk", buttonName: /客户 iPad|iPad/, heading: "客户 iPad" },
  { key: "notifications", buttonName: /通知与打印|通知/, heading: "通知资料完整度" },
  { key: "rules", buttonName: /默认规则|规则/, heading: "默认规则" },
  { key: "workflow", buttonName: /状态流|状态/, heading: "工单状态流" },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for settings interaction checks.");

test.describe("settings section interactions", () => {
  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("section groups update the selected settings panel", async ({ page }) => {
      await verifySettingsSections(page, "click");
    });
  });

  test.describe("mobile touch", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("section groups respond to taps without header hit-target overlap", async ({ page }) => {
      await verifySettingsSections(page, "touch");
    });
  });
});

async function verifySettingsSections(page: Page, mode: "click" | "touch") {
  await gotoReady(page, "/settings");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const main = page.locator("main").last();
  const nav = page.getByRole("navigation", { name: "设置分组" });
  await expect(nav).toBeVisible();

  for (const section of sections) {
    const button = sectionButton(nav, section.buttonName);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expectButtonCenterHitsSelf(button);

    if (mode === "touch") {
      await tapLocatorCenter(page, button);
    } else {
      await button.click();
    }

    await expect(page).toHaveURL(new RegExp(`[?&]section=${section.key}(?:&|$)`));
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expectFirstVisible(
      main.getByRole("heading", { name: section.heading }).first(),
      `${section.key} settings marker`,
    );
    await expectVisibleControlsReachable(
      page,
      main,
      `/settings?section=${section.key} visible controls`,
    );
    if (section.key === "workflow" && mode === "touch") {
      const firstStatusCard = main.locator("details").first();
      await expect(firstStatusCard.locator("summary")).toBeVisible();
      await tapLocatorCenter(page, firstStatusCard.locator("summary"));
      await expect(firstStatusCard).toHaveAttribute("open", "");
      await expectVisibleControlsReachable(page, main, "/settings?section=workflow expanded card");
    }
    await expectNoPageOverflow(page, `/settings?section=${section.key}`);
  }
}

function sectionButton(nav: Locator, name: RegExp) {
  return nav.getByRole("button", { name }).first();
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
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

async function expectButtonCenterHitsSelf(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const target = document.elementFromPoint(x, y);
    const button = target?.closest("button");
    return {
      hitsSelf: button === element,
      targetTag: target?.tagName ?? null,
      targetText: target?.textContent?.trim().slice(0, 80) ?? null,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
    };
  });

  expect(result.hitsSelf, `button center should hit itself, got ${JSON.stringify(result)}`).toBe(
    true,
  );
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

async function expectVisibleControlsReachable(page: Page, root: Locator, label: string) {
  const failures = await root.evaluate((element) => {
    const selector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      "[role='combobox']:not([aria-disabled='true'])",
    ].join(",");

    return [...element.querySelectorAll<HTMLElement>(selector)]
      .map((control) => {
        const rect = control.getBoundingClientRect();
        const style = window.getComputedStyle(control);
        let current = control.parentElement;
        while (current && current !== element) {
          if (
            current instanceof HTMLDetailsElement &&
            !current.open &&
            !current.querySelector("summary")?.contains(control)
          ) {
            return null;
          }
          current = current.parentElement;
        }

        if (
          rect.width < 8 ||
          rect.height < 8 ||
          rect.bottom <= 0 ||
          rect.top >= window.innerHeight ||
          rect.right <= 0 ||
          rect.left >= window.innerWidth ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.pointerEvents === "none"
        ) {
          return null;
        }

        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
          return null;
        }

        const target = document.elementFromPoint(x, y);
        const interactiveTarget = target?.closest<HTMLElement>(selector);
        const hitsControl = interactiveTarget === control || control.contains(target);

        if (hitsControl) return null;

        return {
          controlText:
            control.getAttribute("aria-label") ||
            control.getAttribute("placeholder") ||
            control.textContent?.trim().slice(0, 100) ||
            control.tagName,
          controlTag: control.tagName,
          targetText: target?.textContent?.trim().slice(0, 100) ?? null,
          targetTag: target?.tagName ?? null,
          rect: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      })
      .filter(Boolean);
  });

  expect(failures, `${label} has unreachable controls`).toEqual([]);
}

async function expectNoPageOverflow(page: Page, route: string) {
  const overflow = await page.evaluate(() => {
    const pageWidth = window.innerWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.scrollingElement?.scrollWidth ?? 0,
    );
    return { pageWidth, documentWidth };
  });

  expect(
    overflow.documentWidth,
    `${route} overflowed: documentWidth=${overflow.documentWidth}, pageWidth=${overflow.pageWidth}`,
  ).toBeLessThanOrEqual(overflow.pageWidth);
}
