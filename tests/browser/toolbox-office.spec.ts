import { test, expect, type Locator, type Page } from "@playwright/test";
import { officeDesktopRelease } from "../../lib/toolbox/office-desktop-release";
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

const locales = ["zh-CN", "it", "en"] as const;
async function activate(target: Locator) { if (test.info().project.use.hasTouch) await target.tap(); else await target.click(); }
async function language(page: Page, locale: Locale) {
  await page.getByLabel("语言 / Lingua / Language", { exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function touchTarget(target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test("product introduction uses three languages at four widths without commands, configuration or legacy requests", async ({ page }) => {
  test.setTimeout(120_000);
  const legacyRequests: string[] = [], errors: string[] = [];
  page.on("request", request => { if (/\/api\/toolbox\/office(?:[/?]|$)|\/tutorials\/office\//.test(request.url())) legacyRequests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/toolbox/office");
  await expect(page.locator("main h1")).toHaveText(translate("ChinaTech Office 助手", "zh-CN"));
  for (const locale of locales) {
    await language(page, locale);
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await fits(page);
      const main = page.locator("main");
      await expect(main.locator("ul > li")).toHaveCount(8);
      await expect(main.locator("ol > li")).toHaveCount(3);
      await expect(main.getByRole("checkbox")).toHaveCount(0);
      await expect(main.locator("button[aria-pressed], pre, [id^=command-], #office-tutorials")).toHaveCount(0);
      await expect(main).not.toContainText(/CMD|PowerShell|EncodedCommand|完整重装|Full reinstall|Reinstallazione completa/);
      await expect(main.getByRole("link", { name: translate("下载桌面程序", locale), exact: true })).toHaveAttribute("href", "#office-desktop");
      await touchTarget(main.getByRole("link", { name: translate("下载桌面程序", locale), exact: true }));
      if (locale !== "zh-CN") expect((await main.innerText()).replaceAll("中文", "")).not.toMatch(/[\u3400-\u9fff]/u);
      const headings = await main.locator("ul h3").allTextContents();
      expect(headings).toEqual(["Word", "Excel", "PowerPoint", "Outlook", "OneNote", "Access", "OneDrive", "Skype for Business"]);
      await page.evaluate(() => scrollTo(0, 0));
      if (test.info().project.name === "chromium-desktop") await page.screenshot({ path: `.local/ui-proof/office-product-intro/screenshots/${locale}-${width}.png`, fullPage: true });
    }
  }
  expect(legacyRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("download anchor clears the public header and retains approved 1.3 architecture assets and SHA256", async ({ page }) => {
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await language(page, locale);
    await activate(page.getByRole("link", { name: translate("下载桌面程序", locale), exact: true }));
    await expect(page).toHaveURL(/#office-desktop$/);
    await expect(page.locator("#office-desktop-title")).toBeInViewport();
    const header = await page.locator("header").boundingBox(), heading = await page.locator("#office-desktop-title").boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 8);
    const section = page.locator("#office-desktop");
    await expect(section).toContainText(officeDesktopRelease.version);
    await expect(section.locator('a[href$=".exe"]')).toHaveCount(2);
    for (const file of officeDesktopRelease.files) {
      const link = section.getByRole("link", { name: translate("下载 {architecture} 程序", locale, { architecture: file.architecture }), exact: true });
      await expect(link).toHaveAttribute("href", file.href);
      await touchTarget(link);
      await expect(section.locator("code").filter({ hasText: file.sha256 })).toBeHidden();
    }
    const details = section.locator("details");
    await expect(details).not.toHaveAttribute("open", "");
    await activate(details.locator("summary"));
    for (const file of officeDesktopRelease.files) await expect(details.locator("code").filter({ hasText: file.sha256 })).toBeVisible();
    await expect(details.getByRole("link", { name: translate("下载 SHA256 校验清单", locale), exact: true })).toHaveAttribute("href", officeDesktopRelease.checksums);
    await expect(details.getByRole("link", { name: translate("使用说明", locale), exact: true })).toHaveAttribute("href", officeDesktopRelease.instructions);
    await expect(details.getByRole("link", { name: translate("查看此版本源码", locale), exact: true })).toHaveAttribute("href", "https://github.com/kyox215/Chinatech-codex/tree/office-assistant-v1.3.0/desktop/office-assistant");
    await activate(details.locator("summary"));
  }
});

test("FAQ disclosures preserve license, documents, OneDrive and real Windows acceptance boundaries", async ({ page }) => {
  await page.goto("/toolbox/office");
  const faq = page.locator('section[aria-labelledby="office-faq-title"]');
  for (const locale of locales) {
    await language(page, locale);
    await expect(faq.locator("details")).toHaveCount(5);
    for (const details of await faq.locator("details").all()) {
      await expect(details).not.toHaveAttribute("open", "");
      await touchTarget(details.locator("summary"));
      if (test.info().project.use.hasTouch) await details.locator("summary").tap();
      else { await details.locator("summary").focus(); await page.keyboard.press("Enter"); }
      await expect(details).toHaveAttribute("open", "");
      await expect(details.locator("p").first()).toBeVisible();
      await fits(page);
      await activate(details.locator("summary"));
      await expect(details).not.toHaveAttribute("open", "");
    }
    const documents = faq.locator("details").nth(2);
    await activate(documents.locator("summary"));
    await expect(documents).toContainText(translate("兼容的已有应用、Office 版本和语言会保留。卸载可选择检测到的项目，或移除全部 Office（包括 Visio 和 Project）；全部卸载默认保留 OneDrive。个人文档保留。", locale));
    await expect(documents).toContainText(translate("旧版 MSI 产品须整项卸载；配置未知时不修改单个应用。OneDrive 仅支持当前账户卸载，所有账户安装请用 Windows 设置处理。", locale));
    await activate(documents.locator("summary"));
    const license = faq.locator("details").nth(3);
    await activate(license.locator("summary"));
    await expect(license).toContainText(translate("激活不能替代有效的 Office 许可证，请确认持有相应授权。", locale));
    await expect(license).toContainText("kms.cx");
    await activate(license.locator("summary"));
    const acceptance = faq.locator("details").nth(4);
    await activate(acceptance.locator("summary"));
    await expect(acceptance).toContainText(translate("本版实际界面、UAC、安装、激活、卸载及文档与 OneDrive 保留仍待 Windows 验收。", locale));
    await activate(acceptance.locator("summary"));
  }
});

test("legacy command hashes remain inert and public navigation still works after refresh", async ({ page }) => {
  const officeRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/toolbox/office")) officeRequests.push(request.url()); });
  await page.goto("/toolbox/office#command-reinstall");
  await language(page, "en");
  await page.reload();
  await expect(page.locator("main h1")).toHaveText(translate("ChinaTech Office 助手", "en"));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("main [id^=command-], main pre")).toHaveCount(0);
  await activate(page.locator("header").getByRole("link", { name: translate("工具箱", "en"), exact: true }));
  await expect(page).toHaveURL(/\/toolbox$/);
  const officeLink = page.locator('a[href="/toolbox/office"]').last();
  await activate(officeLink);
  await expect(page).toHaveURL(/\/toolbox\/office$/);
  await expect(page.locator("main h1")).toHaveText(translate("ChinaTech Office 助手", "en"));
  expect(officeRequests).toEqual([]);
});
