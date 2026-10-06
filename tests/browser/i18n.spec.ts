import { test, expect, type Page, type Locator } from "@playwright/test";
import { getTutorials } from "../../lib/tutorials";
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

const languageLabel = "语言 / Lingua / Language";
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
async function changeLanguage(page: Page, locale: Locale) {
  const selector = page.getByLabel(languageLabel, { exact: true });
  if (!await selector.isVisible()) {
    const menu = page.locator(".page-menu-button");
    if (await page.evaluate(() => innerWidth < 768)) {
      await expect(menu).toBeVisible();
      if (await menu.getAttribute("aria-expanded") !== "true") await activate(menu);
    }
    const account = page.locator(".sidebar-account");
    if (await account.getAttribute("open") === null) await activate(account.locator("summary"));
  }
  await selector.selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  const close = page.locator(".app-sidebar__close");
  if (await close.isVisible()) await activate(close);
  else {
    const account = page.locator(".sidebar-account[open] summary");
    if (await account.isVisible()) await activate(account);
  }
}
async function expectFits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth)).toBe(true);
}
async function playing(video: Locator) {
  await expect.poll(() => video.evaluate(element => {
    const media = element as HTMLVideoElement;
    return media.readyState >= 2 && !media.paused && media.currentTime > 0;
  }), { timeout: 20_000 }).toBe(true);
}

test("three homepage languages remain usable at four widths and remember the preference", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  for (const locale of ["zh-CN", "it", "en"] as const) {
    await changeLanguage(page, locale);
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await expect(page.locator("#tutorials-title")).toHaveText(translate("视频教程", locale));
      const login = page.getByRole("navigation", { name: translate("账户入口", locale) }).getByRole("link", { name: translate("登录", locale), exact: true });
      await expect(login).toBeInViewport();
      const selector = page.getByLabel(languageLabel, { exact: true });
      const box = await selector.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await expectFits(page);
      if (width === 375) await test.info().attach(`home-${locale}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel(languageLabel, { exact: true })).toHaveValue("en");
  await expect(page).toHaveTitle(/Repair/);
  expect(errors).toEqual([]);
});

test("auth language changes preserve first inputs, password visibility and validation", async ({ page }) => {
  await page.goto("/login");
  await changeLanguage(page, "it");
  await expect(page.getByRole("heading", { name: "Bentornato", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("example@invalid.test");
  await page.getByLabel("Password", { exact: true }).fill("Preview2026!");
  await activate(page.getByRole("button", { name: "Mostra password", exact: true }));
  await changeLanguage(page, "en");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("example@invalid.test");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("Preview2026!");
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await activate(page.getByRole("link", { name: "Create account", exact: true }));
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Name", { exact: true }).fill("教程客户原名");
  await page.getByLabel("Email", { exact: true }).fill("example@invalid.test");
  await page.getByLabel("Set password", { exact: true }).fill("Preview2026!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Different2026!");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByText("The passwords do not match. Enter the same new password twice.")).toBeVisible();
  await changeLanguage(page, "it");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("教程客户原名");
  await expect(page.getByText("Le password non coincidono. Inserisci la stessa password due volte.")).toBeVisible();
  await expectFits(page);
});

test("all 15 tutorials play with the chosen captions, and language switching releases old media", async ({ page }) => {
  test.setTimeout(150_000);
  const requests: string[] = [];
  page.on("request", request => { if (/\/tutorials\/.*\.mp4(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto("/");
  const video = page.locator("#tutorials video");
  await changeLanguage(page, "it");
  await changeLanguage(page, "en");
  expect(await video.getAttribute("src")).toBeNull();
  expect(requests).toEqual([]);
  let oldVideo: Awaited<ReturnType<Locator["elementHandle"]>> | null = null;
  for (const locale of ["zh-CN", "it", "en"] as const) {
    await changeLanguage(page, locale);
    if (oldVideo) {
      await expect.poll(() => oldVideo!.evaluate(element => (element as HTMLVideoElement).paused && !element.hasAttribute("src") && !element.isConnected)).toBe(true);
      await oldVideo.dispose();
    }
    const items = getTutorials(locale);
    // The previous loop ends on retail; changing the language keeps that selection but waits for a new play action.
    await expect(page.locator("#current-tutorial-title")).toHaveText(locale === "zh-CN" ? items[0].title : items[4].title);
    expect(await video.getAttribute("src")).toBeNull();
    for (const item of items) {
      await activate(page.locator("#tutorials button[aria-pressed]").nth(Number(item.number) - 1));
      await expect(video).toHaveAttribute("poster", item.poster);
      await expect(video.locator("track")).toHaveAttribute("srclang", locale);
      await activate(page.getByRole("button", { name: translate("播放教程：{title}", locale, { title: item.title }), exact: true }));
      await expect(video).toHaveAttribute("src", item.src);
      await playing(video);
      await video.evaluate(element => { (element as HTMLVideoElement).textTracks[0].mode = "hidden"; });
      await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).textTracks[0].cues?.length ?? 0)).toBeGreaterThanOrEqual(6);
    }
    oldVideo = await video.elementHandle();
  }
  await changeLanguage(page, "zh-CN");
  await expect.poll(() => oldVideo!.evaluate(element => (element as HTMLVideoElement).paused && !element.hasAttribute("src"))).toBe(true);
  await oldVideo!.dispose();
});

test("changing the backend language keeps drafts and saves canonical facts with original customer text", async ({ page }) => {
  test.setTimeout(90_000);
  // Only the fictional local preview is used. No real account or production write occurs.
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.goto("/app/repairs/new");
  await changeLanguage(page, "en");
  await page.getByRole("combobox", { name: /^Phone/ }).fill("+393200009876");
  await page.getByLabel(translate("客户称呼（选填）", "en"), { exact: true }).fill("教程客户原名");
  await activate(page.getByRole("button", { name: "Next", exact: true }));
  await expect(page.getByRole("heading", { name: translate("送修设备", "en"), exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: /^Brand/ }).fill("Apple");
  await page.getByRole("combobox", { name: /^Model/ }).fill("iPhone 16");
  await page.getByRole("textbox", { name: "SN / IMEI", exact: true }).fill("DEMO-LANGUAGE-001");
  await changeLanguage(page, "it");
  await expect(page.getByRole("combobox", { name: /^Marca/ })).toHaveValue("Apple");
  await expect(page.getByRole("combobox", { name: /^Modello/ })).toHaveValue("iPhone 16");
  await expect(page.getByRole("textbox", { name: "SN / IMEI", exact: true })).toHaveValue("DEMO-LANGUAGE-001");
  await activate(page.getByRole("button", { name: translate("下一步", "it"), exact: true }));
  await activate(page.getByRole("button", { name: translate("屏幕", "it"), exact: true }));
  await activate(page.getByRole("button", { name: translate("展开{v0}细分故障", "it", { v0: translate("屏幕", "it") }), exact: true }));
  const screenOptions = page.getByRole("dialog");
  await activate(screenOptions.getByRole("radio", { name: translate("原装", "it"), exact: true }).locator(".."));
  await activate(screenOptions.getByRole("button", { name: translate("完成", "it"), exact: true }));
  await page.getByLabel(translate("故障补充 / 自定义故障", "it"), { exact: true }).fill("客户补充原文 · 请保留");
  await changeLanguage(page, "en");
  await expect(page.getByLabel("Fault notes / custom fault", { exact: true })).toHaveValue("客户补充原文 · 请保留");
  await activate(page.getByRole("button", { name: "Next", exact: true }));
  await expect(page.locator(".intake-review__issue")).toContainText("Screen");
  await expect(page.locator(".intake-review__issue")).toContainText("客户补充原文 · 请保留");
  const serviceTags = page.locator(".intake-review__tags:not(.intake-review__tags--neutral)");
  await expect(serviceTags).toContainText("Screen · Original");
  await changeLanguage(page, "it");
  await expect(serviceTags).toContainText("Display · Originale");
  await changeLanguage(page, "en");
  // The customer's reading language remains independently selected even while the operator uses English.
  await activate(page.getByRole("button", { name: translate("客户签字", "en"), exact: true }));
  await page.getByLabel("Signing language", { exact: true }).selectOption("zh");
  await expect(page.locator('label[lang="zh"]').filter({ hasText: "已核对接机资料" })).toContainText("已核对接机资料并阅读所显示条款。");
  await activate(page.getByRole("button", { name: translate("取消签署", "en"), exact: true }));
  await page.getByRole("checkbox", { name: /I reviewed intake details with the customer/ }).check();
  await activate(page.getByRole("button", { name: "Save and preview", exact: true }));
  await expect(page.getByRole("heading", { name: translate("接机信息已保存", "en"), exact: true })).toBeVisible();
  await activate(page.getByRole("link", { name: translate("查看工单", "en"), exact: true }));
  await expect(page).toHaveURL(/\/app\/repairs\/LOCAL-/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("main")).toContainText("教程客户原名");
  await expect(page.locator("main")).toContainText("客户补充原文 · 请保留");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.local-intakes.v1")!).records.at(-1));
  expect(saved.customerName).toBe("教程客户原名");
  expect(saved.category).toBe("手机");
  expect(saved.priority).toBe("普通");
  expect(saved.faults).toContain("屏幕");
  expect(saved.services.screen.quality).toBe("original");
  expect(saved.serial).toBe("DEMO-LANGUAGE-001");
  await expectFits(page);
});

test("editing a translated device record preserves unknown-versus-zero and original history facts", async ({ page }) => {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.goto("/app/retail/units/demo-unit-2");
  await changeLanguage(page, "en");
  const group = page.locator('[data-retail-group="finance"]');
  await expect(group).toBeVisible();
  const toggle = group.locator(":scope > button");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await activate(toggle);
  const edit = group.getByRole("button", { name: "Edit Refurbishment cost", exact: true });
  await expect(edit).toContainText("To be confirmed");
  await activate(edit);
  await page.getByRole("textbox", { name: "Refurbishment cost", exact: true }).fill("0");
  await changeLanguage(page, "it");
  await expect(page.getByRole("textbox", { name: translate("整备成本", "it"), exact: true })).toHaveValue("0");
  await activate(page.getByRole("button", { name: translate("继续确认", "it"), exact: true }));
  await activate(page.getByRole("button", { name: translate("确认保存", "it"), exact: true }));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units.find((unit: { id: string }) => unit.id === "demo-unit-2"));
  expect(saved.refurbCents).toBe(0);
  expect(saved.events.at(-1).detail).toBe("整备成本：待确认 → €0.00；逐项资料更正");
  expect(saved.events.at(-1).title).toBe("更正整备成本");
});
