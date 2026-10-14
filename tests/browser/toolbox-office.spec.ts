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
async function fits(page: Page) { await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1)).toBe(true); }
async function touchTarget(target: Locator) { const box = await target.boundingBox(); expect(box).not.toBeNull(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); }

test("anonymous product page keeps one app preview and downloads in three languages at four widths", async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => { if (/\/api\/toolbox\/office(?:[/?]|$)|\/tutorials\/office\//.test(request.url())) requests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await language(page, locale);
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await fits(page);
      const main = page.locator("main");
      await expect(main.locator("h1")).toHaveText(translate("Office 助手", locale));
      await expect(main).toContainText(translate("无需网站登录。在新电脑或客户电脑上独立运行。", locale));
      await expect(main.locator("ul > li")).toHaveCount(8);
      await expect(main.locator("ol > li")).toHaveCount(3);
      expect(await main.locator("ul h3").allTextContents()).toEqual(["Word", "Excel", "PowerPoint", "Outlook", "OneNote", "Access", "OneDrive", "Skype for Business"]);
      await expect(main.getByRole("checkbox")).toHaveCount(0);
      await expect(main.locator("pre, [id^=command-], #office-tutorials")).toHaveCount(0);
      const primary = main.getByRole("link", { name: translate("下载 x64 版", locale), exact: true });
      await expect(primary).toHaveAttribute("href", officeDesktopRelease.files[0].href); await touchTarget(primary);
      const arm = main.getByRole("link", { name: translate("下载 ARM64 版", locale), exact: true });
      if (width >= 768) { await expect(arm).toBeVisible(); await touchTarget(arm); }
      else { await expect(arm).toBeHidden(); await touchTarget(main.getByRole("button", { name: translate("其他版本 · ARM64", locale), exact: true })); }
      await expect(page.locator("header").getByRole("link", { name: translate("登录", locale), exact: true })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: translate("注册", locale), exact: true })).toBeVisible();
      if (locale !== "zh-CN") expect((await main.innerText()).replaceAll("中文", "")).not.toMatch(/[\u3400-\u9fff]/u);
      await page.evaluate(() => scrollTo(0, 0));
      if (test.info().project.name === "chromium-desktop") await page.screenshot({ path: `.local/ui-proof/office-public-access/screenshots/${locale}-${width}.png`, fullPage: true });
    }
  }
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test("phone architecture sheet selects exact public files, copies the selected link and restores focus", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as Window & { copiedDownload?: string }).copiedDownload = value; } } }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/toolbox/office");
  for (const locale of locales) {
    await language(page, locale);
    const trigger = page.getByRole("button", { name: translate("其他版本 · ARM64", locale), exact: true });
    await activate(trigger);
    const dialog = page.getByRole("dialog", { name: translate("选择下载版本", locale), exact: true });
    await expect(dialog).toBeVisible();
    for (const file of officeDesktopRelease.files) {
      const label = file.architecture === "x64" ? "x64 · Intel / AMD 电脑" : "ARM64 · ARM Windows 电脑";
      const option = dialog.locator("label").filter({ hasText: translate(label, locale) }); await touchTarget(option); await activate(option);
      await expect(dialog.getByRole("radio", { name: translate(label, locale), exact: true })).toBeChecked();
      await expect(dialog.getByRole("link", { name: translate("下载 {architecture} 程序", locale, { architecture: file.architecture }), exact: true })).toHaveAttribute("href", file.href);
      await activate(dialog.getByRole("button", { name: translate("复制下载链接", locale), exact: true }));
      await expect(dialog.getByRole("status")).toHaveText(translate("下载链接已复制，可在 Windows 电脑上打开。", locale));
      expect(await page.evaluate(() => (window as Window & { copiedDownload?: string }).copiedDownload)).toBe(file.href);
      await fits(page);
    }
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  }
});

test("clipboard denial retains a selectable exact link instead of reporting success", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto("/toolbox/office");
  await activate(page.getByRole("button", { name: "其他版本 · ARM64", exact: true }));
  const dialog = page.getByRole("dialog", { name: "选择下载版本", exact: true });
  await activate(dialog.getByRole("button", { name: "复制下载链接", exact: true }));
  await expect(dialog.getByRole("alert")).toHaveText("无法复制，请选中下方链接手动复制。");
  await expect(dialog.getByRole("textbox", { name: "下载链接", exact: true })).toHaveValue(officeDesktopRelease.files[1].href);
  await expect(dialog.getByRole("textbox", { name: "下载链接", exact: true })).toHaveAttribute("readonly", "");
  await activate(dialog.getByRole("button", { name: "关闭下载选项", exact: true })); await expect(dialog).toBeHidden();
});

test("compact FAQ and technical information retain licenses, document scope, acceptance and hashes", async ({ page }) => {
  await page.goto("/toolbox/office");
  const section = page.locator('section[aria-labelledby="office-faq-title"]'), faq = section.locator(":scope > div > details");
  for (const locale of locales) {
    await language(page, locale); await expect(faq).toHaveCount(3);
    for (const details of await faq.all()) { await touchTarget(details.locator("summary")); await activate(details.locator("summary")); await expect(details.locator("p").first()).toBeVisible(); await fits(page); await activate(details.locator("summary")); }
    await activate(faq.nth(0).locator("summary")); await expect(faq.nth(0)).toContainText(translate("旧版 MSI 产品须整项卸载；配置未知时不修改单个应用。OneDrive 仅支持当前账户卸载，所有账户安装请用 Windows 设置处理。", locale)); await activate(faq.nth(0).locator("summary"));
    await activate(faq.nth(2).locator("summary")); await expect(faq.nth(2)).toContainText(translate("激活不能替代有效的 Office 许可证，请确认持有相应授权。", locale)); await expect(faq.nth(2)).toContainText("kms.cx"); await activate(faq.nth(2).locator("summary"));
    const technical = section.locator(":scope > details"); await activate(technical.locator("summary"));
    await expect(technical).toContainText(translate("本版实际界面、UAC、安装、激活、卸载及文档与 OneDrive 保留仍待 Windows 验收。", locale));
    for (const file of officeDesktopRelease.files) await expect(technical.locator("code").filter({ hasText: file.sha256 })).toBeVisible();
    await expect(technical.getByRole("link", { name: translate("下载 SHA256 校验清单", locale), exact: true })).toHaveAttribute("href", officeDesktopRelease.checksums);
    await activate(technical.locator("summary"));
  }
});

test("delayed copy results cannot overwrite another architecture or a reopened short-screen sheet", async ({ page }) => {
  await page.addInitScript(() => {
    const jobs: Array<{ resolve: () => void; reject: () => void }> = [];
    (window as Window & { copyJobs?: typeof jobs }).copyJobs = jobs;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => jobs.push({ resolve, reject: () => reject(new Error("denied")) })) } });
  });
  await page.setViewportSize({ width: 375, height: 512 }); await page.goto("/toolbox/office");
  const trigger = page.getByRole("button", { name: "其他版本 · ARM64", exact: true });
  await activate(trigger);
  const dialog = page.getByRole("dialog", { name: "选择下载版本", exact: true });
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  const copy = dialog.getByRole("button", { name: "复制下载链接", exact: true });
  await activate(copy);
  await activate(dialog.locator("label").filter({ hasText: "x64 · Intel / AMD 电脑" }));
  await page.evaluate(() => (window as Window & { copyJobs?: Array<{ resolve: () => void }> }).copyJobs![0].resolve());
  await expect(dialog.getByRole("status", { includeHidden: true })).toHaveText("");
  await activate(copy);
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
  await page.evaluate(() => (window as Window & { copyJobs?: Array<{ reject: () => void }> }).copyJobs![1].reject());
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  await activate(trigger); await expect(dialog.getByRole("status", { includeHidden: true })).toHaveText("");
  await fits(page); await dialog.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const position = await page.evaluate(() => scrollY);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  if (!test.info().project.use.hasTouch) { await page.mouse.move(4, 4); await page.mouse.wheel(0, 400); }
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(position);
  await expect(dialog.getByRole("button", { name: "关闭下载选项", exact: true })).toBeInViewport();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
});

test("video is lazy, starts on user action and releases playback when closed", async ({ page }) => {
  const media: string[] = []; page.on("request", request => { if (request.url().endsWith("/media/office-public-access-zh.mp4")) media.push(request.url()); });
  await page.goto("/toolbox/office"); expect(media).toEqual([]);
  await activate(page.locator("#office-product-video > button"));
  const dialog = page.getByRole("dialog", { name: "ChinaTech Office 助手产品介绍视频（中文）", exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.locator("video").evaluate(element => { const player = element as HTMLVideoElement; return !player.paused && player.readyState >= 2 && player.currentTime > .1; }), { timeout: 15000 }).toBe(true);
  await page.locator("video").evaluate(element => { const player = element as HTMLVideoElement; player.currentTime = player.duration - .3; });
  await expect.poll(() => page.locator("video").evaluate(element => { const player = element as HTMLVideoElement; return player.ended && !player.error; }), { timeout: 10000 }).toBe(true);
  await activate(dialog.getByRole("button", { name: "关闭视频", exact: true })); await expect(dialog).toBeHidden();
  await expect(page.locator("video")).not.toHaveAttribute("src");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  await activate(page.locator("#office-product-video > button"));
  await expect.poll(() => page.locator("video").evaluate(element => { const player = element as HTMLVideoElement; return !player.paused && player.currentTime > .1 && player.currentTime < 5; }), { timeout: 15000 }).toBe(true);
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
});

test("failed media offers a gesture-driven retry and a fresh playable resource", async ({ page }) => {
  let failed = true;
  await page.route("**/media/office-public-access-zh.mp4", route => failed ? route.fulfill({ status: 503, body: "temporarily unavailable" }) : route.continue());
  await page.goto("/toolbox/office"); await activate(page.locator("#office-product-video > button"));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("视频暂时无法播放，请稍后重试。");
  failed = false; await activate(page.getByRole("button", { name: "重新加载视频", exact: true }));
  await expect.poll(() => page.locator("video").evaluate(element => { const player = element as HTMLVideoElement; return !player.paused && player.readyState >= 2 && !player.error; }), { timeout: 15000 }).toBe(true);
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toBeHidden();
});

test("anonymous toolbox navigation, refresh and compact signed-in header preserve entry and account menu", async ({ page }) => {
  await page.goto("/toolbox"); await activate(page.locator('a[href="/toolbox/office"]').last());
  await expect(page).toHaveURL(/\/toolbox\/office$/); await page.reload();
  await expect(page.getByRole("link", { name: "下载 x64 版", exact: true })).toBeVisible();
  await page.route("**/api/auth/status", route => route.fulfill({ json: { state: "workspace", scope: "office-header-preview", formal: false } }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("header")).toHaveAttribute("data-signed-in", "true");
  for (const width of [390, 375]) {
    await page.setViewportSize({ width, height: 844 }); await fits(page);
    const header = await page.locator("header").boundingBox(); expect(header!.height).toBeLessThanOrEqual(84);
    const summary = page.locator("header details > summary"); await touchTarget(summary); await activate(summary);
    await expect(page.locator("header").getByRole("link", { name: "工作台", exact: true })).toHaveAttribute("href", "/app/dashboard");
    await expect(page.locator("header").getByRole("button", { name: "退出本地预览", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(summary).toBeFocused();
  }
});

test("reduced motion keeps the primary content visible without entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/toolbox/office");
  await expect(page.locator("main h1")).toBeVisible();
  expect(await page.locator("main > section > div").first().evaluate(element => getComputedStyle(element).animationName)).toBe("none");
});
