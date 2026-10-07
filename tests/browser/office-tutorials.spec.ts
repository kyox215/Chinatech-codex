import { fixtureOfficeCommand, mockOfficeGateway } from "./helpers/office-gateway";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { getOfficeTutorials } from "../../lib/office-tutorials";
import { officeCommands } from "../../lib/toolbox/office-commands";
import { translate } from "../../lib/i18n/translate";
import type { TutorialLocale } from "../../lib/tutorials";

const locales = ["zh-CN", "it", "en"] as const;
const section = (page: Page) => page.locator("#office-tutorials");
const video = (page: Page) => section(page).locator("video");

async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

async function changeLanguage(page: Page, locale: TutorialLocale) {
  await page.getByLabel("语言 / Lingua / Language", { exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

async function expectPlaying(locator: Locator) {
  await expect.poll(() => locator.evaluate(element => {
    const media = element as HTMLVideoElement;
    return media.readyState >= 2 && !media.paused && media.currentTime > 0;
  }), { timeout: 20_000 }).toBe(true);
  const before = await locator.evaluate(element => (element as HTMLVideoElement).currentTime);
  await expect.poll(() => locator.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(before);
}

async function expectTargetFits(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectBelowHeader(page: Page, locator: Locator) {
  const header = await page.locator("header").boundingBox();
  const target = await locator.boundingBox();
  expect(header).not.toBeNull();
  expect(target).not.toBeNull();
  expect(target!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 8);
}

test.beforeEach(async ({ page }) => {
  // Public media and synthetic gateway only; no account or Office execution.
  await mockOfficeGateway(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const media = await video(page).evaluateAll(elements => elements.map(element => {
    const current = element as HTMLVideoElement;
    return { src: current.getAttribute("src"), currentSrc: current.currentSrc, readyState: current.readyState, networkState: current.networkState, paused: current.paused, error: current.error?.code ?? null };
  }));
  await info.attach("office-media-state", { body: Buffer.from(JSON.stringify(media, null, 2)), contentType: "application/json" });
});

test("all twelve Office selections stay media-idle and expose the matching translated chapters", async ({ page }) => {
  test.setTimeout(90_000);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => { if (/\/tutorials\/office\/.*\.mp4(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/toolbox/office", { waitUntil: "networkidle" });
  await expect(video(page)).toHaveAttribute("preload", "none");
  await expect(video(page)).toHaveAttribute("playsinline", "");
  await expect(video(page)).toHaveAttribute("controls", "");
  expect(await video(page).getAttribute("autoplay")).toBeNull();
  for (const locale of locales) {
    await changeLanguage(page, locale);
    const catalog = getOfficeTutorials(locale);
    expect(catalog.map(item => item.id)).toEqual(["install", "activate", "uninstall", "reinstall"]);
    for (const [index, item] of catalog.entries()) {
      const episode = section(page).locator("button[aria-pressed]").nth(index);
      await activate(episode);
      await expect(episode).toHaveAttribute("aria-pressed", "true");
      await expect(section(page).locator('button[aria-pressed="true"]')).toHaveCount(1);
      await expect(section(page).locator("#current-tutorial-title")).toHaveText(item.title);
      await expect(video(page)).toHaveAttribute("poster", item.poster);
      await expect(video(page).locator("track")).toHaveAttribute("src", item.captions);
      await expect(video(page).locator("track")).toHaveAttribute("srclang", locale);
      expect(await video(page).getAttribute("src")).toBeNull();
      expect(await video(page).evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
      for (const step of item.steps) await expect(section(page).getByRole("heading", { name: step.title, exact: true })).toBeVisible();
      await expect(section(page).getByRole("link", { name: item.actionLabel, exact: true })).toHaveAttribute("href", `#command-${item.id}`);
    }
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("three languages at four widths retain usable Office navigation and a widescreen tutorial layout", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await changeLanguage(page, locale);
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const entry = page.getByRole("link", { name: translate("观看 Office 视频教程", locale), exact: true });
      await expectTargetFits(entry);
      await expect(entry).toBeInViewport();
      await activate(entry);
      await expect(page).toHaveURL(/#office-tutorials$/);
      await expect(page.locator("#office-tutorials-title")).toHaveText(translate("Office 视频教程", locale));
      await expect(page.locator("#office-tutorials-title")).toBeInViewport();
      await expectBelowHeader(page, page.locator("#office-tutorials-title"));
      for (const episode of await section(page).locator("button[aria-pressed]").all()) await expectTargetFits(episode);
      for (const step of getOfficeTutorials(locale)[0].steps) {
        const time = `${Math.floor(step.at / 60)}:${String(Math.floor(step.at % 60)).padStart(2, "0")}`;
        await expectTargetFits(section(page).getByRole("button", { name: translate("从 {time} 观看：{title}", locale, { time, title: step.title }), exact: true }));
      }
      const player = await video(page).boundingBox();
      const playlist = await section(page).getByRole("complementary").boundingBox();
      expect(player).not.toBeNull();
      expect(playlist).not.toBeNull();
      expect(player!.width / player!.height).toBeCloseTo(16 / 9, 2);
      if (width >= 768) expect(playlist!.x).toBeGreaterThanOrEqual(player!.x + player!.width - 1);
      else expect(playlist!.y).toBeGreaterThan(player!.y + player!.height);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth)).toBe(true);
      // A tall locator screenshot scrolls to its own top and can move beneath the
      // sticky header; capture the verified viewport without changing its scroll.
      await test.info().attach(`office-${locale}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("all twelve real Office videos play with captions and chapter seeking, releasing old episodes and languages", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/toolbox/office#office-tutorials");
  let previous: Awaited<ReturnType<Locator["elementHandle"]>> | null = null;
  for (const locale of locales) {
    await changeLanguage(page, locale);
    if (previous) {
      await expect.poll(() => previous!.evaluate(element => {
        const media = element as HTMLVideoElement;
        return media.paused && !media.hasAttribute("src") && !media.isConnected;
      })).toBe(true);
      await previous.dispose();
      previous = null;
      await expect(section(page).locator("#current-tutorial-title")).toHaveText(getOfficeTutorials(locale)[3].title);
    }
    expect(await video(page).getAttribute("src")).toBeNull();
    for (const [index, item] of getOfficeTutorials(locale).entries()) {
      await activate(section(page).locator("button[aria-pressed]").nth(index));
      if (previous) {
        await expect.poll(() => previous!.evaluate(element => {
          const media = element as HTMLVideoElement;
          return media.paused && !media.hasAttribute("src") && !media.isConnected;
        })).toBe(true);
        await previous.dispose();
      }
      await activate(section(page).getByRole("button", { name: translate("播放教程：{title}", locale, { title: item.title }), exact: true }));
      await expect(video(page)).toHaveAttribute("src", item.src);
      await expectPlaying(video(page));
      await video(page).evaluate(element => { (element as HTMLVideoElement).textTracks[0].mode = "showing"; });
      await expect.poll(() => video(page).evaluate(element => (element as HTMLVideoElement).textTracks[0].cues?.length ?? 0)).toBeGreaterThanOrEqual(item.steps.length);
      await expect(video(page).locator("track")).toHaveAttribute("srclang", locale);
      const step = item.steps.find(candidate => candidate.at > 0)!;
      expect(step).toBeDefined();
      const time = `${Math.floor(step.at / 60)}:${String(Math.floor(step.at % 60)).padStart(2, "0")}`;
      await activate(section(page).getByRole("button", { name: translate("从 {time} 观看：{title}", locale, { time, title: step.title }), exact: true }));
      await expect.poll(() => video(page).evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(step.at);
      await expect(video(page)).toBeFocused();
      previous = await video(page).elementHandle();
      expect(previous).not.toBeNull();
    }
  }
  await changeLanguage(page, "zh-CN");
  await expect.poll(() => previous!.evaluate(element => (element as HTMLVideoElement).paused && !element.hasAttribute("src") && !element.isConnected)).toBe(true);
  await previous!.dispose();
  await expect(section(page).locator("#current-tutorial-title")).toHaveText(getOfficeTutorials("zh-CN")[3].title);
  expect(await video(page).getAttribute("src")).toBeNull();
  await activate(section(page).getByRole("button", { name: translate("播放教程：{title}", "zh-CN", { title: getOfficeTutorials("zh-CN")[3].title }), exact: true }));
  await expectPlaying(video(page));
  const leaving = await video(page).elementHandle();
  await activate(page.locator("header").getByRole("link", { name: "返回工具箱", exact: true }));
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect.poll(() => leaving!.evaluate(element => (element as HTMLVideoElement).paused && !element.hasAttribute("src") && !element.isConnected)).toBe(true);
  await leaving!.dispose();
});

test("tutorial action links and direct hashes select the matching command without executing or copying it", async ({ page }) => {
  test.setTimeout(90_000);
  const backendRequests: string[] = [];
  page.on("request", request => { if (/\/api\/(?:backend|preview-session|auth)(?:\/|$)/.test(request.url()) && new URL(request.url()).pathname !== "/api/auth/status") backendRequests.push(request.url()); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Tutorial action must not copy commands"); } } });
  });
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await changeLanguage(page, locale);
    for (const [index, item] of getOfficeTutorials(locale).entries()) {
      await activate(section(page).locator("button[aria-pressed]").nth(index));
      const link = section(page).getByRole("link", { name: item.actionLabel, exact: true });
      if (index === 0) { await link.focus(); await page.keyboard.press("Enter"); }
      else await activate(link);
      await expect(page).toHaveURL(new RegExp(`#command-${item.id}$`));
      const command = officeCommands.find(candidate => candidate.id === item.id)!;
      const panel = page.locator(`#command-${item.id}`);
      await expect(panel.getByRole("heading", { level: 2 })).toHaveText(translate(command.title, locale));
      await expect(panel).toBeFocused();
      await expect(panel.getByRole("heading", { level: 2 })).toBeInViewport();
      await expectBelowHeader(page, panel.getByRole("heading", { level: 2 }));
      await expect(page.getByRole("complementary", { name: translate("选择 Office 操作", locale) }).getByRole("button").nth(index)).toHaveAttribute("aria-pressed", "true");
      await expect(panel.locator("pre code")).toHaveText(fixtureOfficeCommand(command.id, "powershell", locale));
      await expect(panel.getByRole("status")).toHaveCount(0);
    }
  }
  await page.goBack();
  await expect(page).toHaveURL(/#command-uninstall$/);
  await expect(page.locator("#command-uninstall #operation-title")).toHaveText(translate("仅卸载", "en"));
  await page.goto("/toolbox/office#command-activate");
  await expect(page.locator("#command-activate #operation-title")).toHaveText(translate("仅激活", "en"));
  await expect(page.locator("#command-activate #operation-title")).toBeInViewport();
  await expectBelowHeader(page, page.locator("#command-activate #operation-title"));
  await activate(page.getByRole("complementary", { name: translate("选择 Office 操作", "en") }).getByRole("button").nth(2));
  await expect(page).toHaveURL(/#command-uninstall$/);
  await page.reload();
  await expect(page.locator("#command-uninstall #operation-title")).toHaveText(translate("仅卸载", "en"));
  await expect(page.locator("#command-uninstall pre code")).toHaveText(fixtureOfficeCommand("uninstall", "powershell", "en"));
  expect(backendRequests).toEqual([]);
});

test("Office media loading and 503 failures preserve translated chapters and recover with retry", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await changeLanguage(page, locale);
    const item = getOfficeTutorials(locale)[0];
    await activate(section(page).locator("button[aria-pressed]").first());
    let releaseFailure = () => {};
    const failureReady = new Promise<void>(resolve => { releaseFailure = resolve; });
    const pattern = `**${item.src}`;
    await page.route(pattern, async route => {
      await failureReady;
      await route.fulfill({ status: 503, contentType: "text/plain", headers: { "cache-control": "no-store" }, body: "Office tutorial media unavailable in this test" });
    });
    await activate(section(page).getByRole("button", { name: translate("播放教程：{title}", locale, { title: item.title }), exact: true }));
    await expect(section(page).getByRole("status").filter({ hasText: translate("视频加载中…", locale) })).toBeVisible();
    releaseFailure();
    await expect(section(page).getByRole("alert")).toContainText(translate("视频暂时无法播放", locale));
    await expect(section(page).getByRole("heading", { name: item.steps[0].title, exact: true })).toBeVisible();
    const retry = section(page).getByRole("button", { name: translate("重试播放", locale), exact: true });
    await expectTargetFits(retry);
    await page.unroute(pattern);
    await activate(retry);
    await expect(section(page).getByRole("alert")).toHaveCount(0);
    await expectPlaying(video(page));
  }
});
