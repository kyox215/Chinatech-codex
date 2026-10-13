import { test, expect, type Locator, type Page } from "@playwright/test";
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

const locales = ["zh-CN", "it", "en"] as const;
const section = (page: Page) => page.locator("#office-product-video");
const video = (page: Page) => section(page).locator("video");
async function activate(target: Locator) { if (test.info().project.use.hasTouch) await target.tap(); else await target.click(); }
async function language(page: Page, locale: Locale) {
  await page.getByLabel("语言 / Lingua / Language", { exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function play(media: Locator) {
  await media.scrollIntoViewIfNeeded();
  const box = await media.boundingBox();
  expect(box).not.toBeNull();
  // Native Chromium and touch WebKit control bars have different geometry.
  const position = test.info().project.use.hasTouch ? { x: 34, y: box!.height - 30 } : { x: 20, y: box!.height - 48 };
  if (test.info().project.use.hasTouch) await media.tap({ position });
  else await media.click({ position });
  await expectPlaying(media);
}

async function expectPlaying(media: Locator) {
  await expect.poll(() => media.evaluate(element => {
    const current = element as HTMLVideoElement;
    return current.readyState >= 2 && !current.paused && current.currentTime > 0;
  }), { timeout: 20_000 }).toBe(true);
  const before = await media.evaluate(element => (element as HTMLVideoElement).currentTime);
  await expect.poll(() => media.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(before);
}

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const state = await video(page).evaluateAll(elements => elements.map(element => {
    const current = element as HTMLVideoElement;
    const rect = current.getBoundingClientRect();
    const quality = current.getVideoPlaybackQuality?.();
    const ranges = (range: TimeRanges) => Array.from({ length: range.length }, (_, index) => [range.start(index), range.end(index)]);
    return {
      src: current.getAttribute("src"), currentSrc: current.currentSrc, readyState: current.readyState, networkState: current.networkState,
      currentTime: current.currentTime, duration: Number.isFinite(current.duration) ? current.duration : null, paused: current.paused,
      ended: current.ended, seeking: current.seeking, error: current.error?.code ?? null, buffered: ranges(current.buffered), played: ranges(current.played), seekable: ranges(current.seekable),
      playbackRate: current.playbackRate, muted: current.muted, volume: current.volume, frames: quality?.totalVideoFrames ?? null, droppedFrames: quality?.droppedVideoFrames ?? null,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight }, visibility: document.visibilityState,
    };
  }));
  const events = await page.evaluate(() => (window as unknown as { officeMediaEvents?: unknown[] }).officeMediaEvents ?? []);
  await info.attach("office-product-media-state", { body: Buffer.from(JSON.stringify({ state, events })), contentType: "application/json" });
});

test("portrait product media is idle on initial load and language changes do not download or auto-play it", async ({ page }) => {
  const requests: string[] = [], legacy: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/media/office-product-intro-zh.mp4")) requests.push(request.url());
    if (request.url().includes("/tutorials/office/")) legacy.push(request.url());
  });
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route("**/_next/static/**", async route => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  await page.route("**/media/office-product-intro-zh.mp4", route => route.fulfill({ status: 503, contentType: "text/plain", body: "Synthetic pre-hydration media unavailable" }));
  await page.goto("/toolbox/office", { waitUntil: "commit" });
  try {
    await expect(video(page)).toBeVisible();
    expect(await video(page).getAttribute("src")).toBeNull();
    expect(await video(page).evaluate(element => (element as HTMLVideoElement).currentSrc)).toBe("");
    expect(requests).toEqual([]);
  } finally { releaseScripts(); }
  await page.waitForLoadState("networkidle");
  await expect(video(page)).toHaveCount(1);
  await expect(section(page).getByText(translate("产品介绍视频制作中", "zh-CN"), { exact: true })).toHaveCount(0);
  expect(await video(page).getAttribute("src")).toBeNull();
  await expect(video(page)).toHaveAttribute("poster", "/media/office-product-intro-zh-poster.jpg");
  expect(await video(page).getAttribute("controls")).toBeNull();
  await expect(video(page)).toHaveAttribute("playsinline", "");
  await expect(video(page)).toHaveAttribute("preload", "none");
  expect(await video(page).getAttribute("autoplay")).toBeNull();
  await expect(video(page).locator("track")).toHaveCount(0);
  for (const locale of locales) {
    await language(page, locale);
    await expect(video(page)).toHaveAttribute("aria-label", translate("ChinaTech Office 助手产品介绍视频（中文）", locale));
    await expect(section(page)).toContainText(translate("中文解说与字幕，展示组件选择与应用管理。", locale));
    await expect(section(page)).toContainText(translate("界面演示；不代表实际安装或激活已完成验收。", locale));
    const start = section(page).getByRole("button", { name: translate("播放产品介绍视频", locale), exact: true });
    await expect(start).toBeEnabled();
    const box = await start.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await video(page).getAttribute("src")).toBeNull();
    expect(await video(page).evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
  }
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(legacy).toEqual([]);
});

test("portrait card fits desktop and phone widths without cropping or expanding the video above 320 pixels", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/toolbox/office");
  for (const locale of locales) {
    await language(page, locale);
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      const box = await video(page).boundingBox();
      expect(box!.width).toBeLessThanOrEqual(320);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.width / box!.height).toBeCloseTo(9 / 16, 2);
      expect(await video(page).evaluate(element => getComputedStyle(element).objectFit)).toBe("contain");
      await activate(section(page).getByRole("link", { name: translate("选择下载版本", locale), exact: true }));
      await expect(page.locator("#office-desktop-title")).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
});

test("real product video plays, seeks and pauses while keeping the same Chinese media across languages", async ({ page }) => {
  test.setTimeout(90_000);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route("**/_next/static/**", async route => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/toolbox/office", { waitUntil: "commit" });
    await expect(video(page)).toBeVisible();
    expect(await video(page).getAttribute("src")).toBeNull();
  } finally { releaseScripts(); }
  await page.waitForLoadState("load");
  await activate(section(page).getByRole("button", { name: translate("播放产品介绍视频", "zh-CN"), exact: true }));
  await expectPlaying(video(page));
  await expect(video(page)).toHaveAttribute("controls", "");
  await expect(section(page).getByRole("button", { name: translate("播放产品介绍视频", "zh-CN"), exact: true })).toHaveCount(0);
  const state = await video(page).evaluate(element => {
    const current = element as HTMLVideoElement;
    return { width: current.videoWidth, height: current.videoHeight, duration: current.duration };
  });
  expect(state.width).toBe(1080);
  expect(state.height).toBe(1920);
  expect(state.duration).toBeGreaterThan(35);
  expect(state.duration).toBeLessThan(50);
  const originalVideo = await video(page).elementHandle();
  expect(originalVideo).not.toBeNull();
  for (const locale of locales) {
    await language(page, locale);
    expect(await video(page).evaluate((element, original) => element === original, originalVideo!)).toBe(true);
    await expect(video(page)).toHaveAttribute("src", "/media/office-product-intro-zh.mp4");
    await video(page).evaluate(element => { const current = element as HTMLVideoElement; current.pause(); current.currentTime = 20; });
    await expect.poll(() => video(page).evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(19.8);
    expect(await video(page).evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    await play(video(page));
  }
  await video(page).evaluate(element => (element as HTMLVideoElement).pause());
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  await originalVideo!.dispose();
});

test("media failure reports the current language and retries the same video without any Office action", async ({ page }) => {
  test.setTimeout(90_000);
  let fail = true, requests = 0, holdResponse = false;
  let releaseResponse!: () => void;
  const responseReady = new Promise<void>(resolve => { releaseResponse = resolve; });
  await page.addInitScript(() => {
    const beforePlay: { currentSrc: string; readyState: number; currentTime: number; error: number | null; paused: boolean; buffered: number[][] }[] = [];
    const fixture: { mode: "real" | "blocked" | "deferred"; calls: number; beforePlay: typeof beforePlay; rejectOld?: (reason: unknown) => void } = { mode: "real", calls: 0, beforePlay };
    (window as unknown as { officeMediaFixture: typeof fixture }).officeMediaFixture = fixture;
    const events: unknown[] = [];
    (window as unknown as { officeMediaEvents: typeof events }).officeMediaEvents = events;
    for (const type of ["loadstart", "abort", "emptied", "loadedmetadata", "canplay", "playing", "pause", "stalled", "waiting", "suspend", "timeupdate", "error", "ended"]) document.addEventListener(type, event => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      const media = event.target;
      events.push({ type, at: performance.now(), currentTime: media.currentTime, readyState: media.readyState, networkState: media.networkState, paused: media.paused, error: media.error?.code ?? null, buffered: Array.from({ length: media.buffered.length }, (_, index) => [media.buffered.start(index), media.buffered.end(index)]) });
      if (events.length > 200) events.shift();
    }, true);
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      fixture.calls += 1;
      beforePlay.push({ currentSrc: this.currentSrc, readyState: this.readyState, currentTime: this.currentTime, error: this.error?.code ?? null, paused: this.paused, buffered: Array.from({ length: this.buffered.length }, (_, index) => [this.buffered.start(index), this.buffered.end(index)]) });
      if (fixture.mode === "blocked") return Promise.reject(new DOMException("Synthetic playback blocked", "NotAllowedError"));
      if (fixture.mode === "deferred") {
        void originalPlay.call(this).catch(() => {});
        return new Promise<void>((_, reject) => { fixture.rejectOld = reject; });
      }
      return originalPlay.call(this);
    };
  });
  const officeActions: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/toolbox/office")) officeActions.push(request.url()); });
  await page.route("**/media/office-product-intro-zh.mp4", async route => {
    requests += 1;
    if (holdResponse) await responseReady;
    if (fail) await route.fulfill({ status: 503, contentType: "text/plain", body: "Synthetic media unavailable", headers: { "cache-control": "no-store" } });
    else await route.continue();
  });
  await page.goto("/toolbox/office");
  expect(requests).toBe(0);
  await activate(section(page).getByRole("button", { name: translate("播放产品介绍视频", "zh-CN"), exact: true }));
  await expect(section(page).getByRole("alert")).toContainText(translate("视频暂时无法播放，请稍后重试。", "zh-CN"));
  expect(requests).toBeGreaterThan(0);
  for (const locale of locales) {
    await language(page, locale);
    await expect(section(page).getByRole("alert")).toContainText(translate("视频暂时无法播放，请稍后重试。", locale));
    await expect(section(page).getByRole("button", { name: translate("重新加载视频", locale), exact: true })).toBeEnabled();
  }
  fail = false;
  await activate(section(page).getByRole("button", { name: translate("重新加载视频", "en"), exact: true }));
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  await expectPlaying(video(page));
  expect(requests).toBeGreaterThan(1);

  // Playback rejection must report feedback even when no native error fires.
  await page.reload();
  await page.evaluate(() => { (window as unknown as { officeMediaFixture: { mode: string } }).officeMediaFixture.mode = "blocked"; });
  await activate(section(page).getByRole("button", { name: translate("播放产品介绍视频", "en"), exact: true }));
  await expect(section(page).getByRole("alert")).toContainText(translate("浏览器阻止了视频播放，请点击重试。", "en"));
  for (const locale of locales) {
    await language(page, locale);
    await expect(section(page).getByRole("alert")).toContainText(translate("浏览器阻止了视频播放，请点击重试。", locale));
  }

  // Keep one real request pending so repeated clicks cannot start another play.
  await page.evaluate(() => { (window as unknown as { officeMediaFixture: { mode: string } }).officeMediaFixture.mode = "deferred"; });
  fail = true; holdResponse = true;
  const beforeRequests = requests;
  await activate(section(page).getByRole("button", { name: translate("重新加载视频", "en"), exact: true }));
  const pendingStart = section(page).getByRole("button", { name: translate("播放产品介绍视频", "en"), exact: true });
  await expect(pendingStart).toBeDisabled();
  await expect(section(page).getByRole("status")).toHaveText(translate("正在加载视频…", "en"));
  await expect.poll(() => requests).toBeGreaterThan(beforeRequests);
  await pendingStart.evaluate(element => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); element.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(await page.evaluate(() => (window as unknown as { officeMediaFixture: { calls: number } }).officeMediaFixture.calls)).toBe(2);
  releaseResponse();
  await expect(section(page).getByRole("alert")).toContainText(translate("视频暂时无法播放，请稍后重试。", "en"));

  // A late old play rejection/error cannot replace a successful retry.
  fail = false; holdResponse = false;
  await page.evaluate(() => { (window as unknown as { officeMediaFixture: { mode: string } }).officeMediaFixture.mode = "real"; });
  const previousVideo = await video(page).elementHandle();
  expect(previousVideo).not.toBeNull();
  await activate(section(page).getByRole("button", { name: translate("重新加载视频", "en"), exact: true }));
  expect(await video(page).evaluate((element, previous) => element === previous, previousVideo!)).toBe(false);
  expect(await previousVideo!.evaluate(element => ({ connected: element.isConnected, hasSource: element.hasAttribute("src"), paused: (element as HTMLVideoElement).paused }))).toEqual({ connected: false, hasSource: false, paused: true });
  const beforeFinalPlay = await page.evaluate(() => (window as unknown as { officeMediaFixture: { beforePlay: unknown[] } }).officeMediaFixture.beforePlay.at(-1));
  expect(beforeFinalPlay).toEqual({ currentSrc: "", readyState: 0, currentTime: 0, error: null, paused: true, buffered: [] });
  await expectPlaying(video(page));
  await page.evaluate(() => { (window as unknown as { officeMediaFixture: { rejectOld: (reason: unknown) => void } }).officeMediaFixture.rejectOld(new DOMException("Synthetic old attempt rejected", "NotSupportedError")); });
  await previousVideo!.dispatchEvent("error");
  await previousVideo!.dispatchEvent("playing");
  await video(page).dispatchEvent("error");
  await expectPlaying(video(page));
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  await previousVideo!.dispose();
  const latestVideo = await video(page).elementHandle();
  expect(latestVideo).not.toBeNull();
  await activate(page.locator("header").getByRole("link", { name: translate("工具箱", "en"), exact: true }));
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect.poll(() => latestVideo!.evaluate(element => ({ connected: element.isConnected, hasSource: element.hasAttribute("src"), paused: (element as HTMLVideoElement).paused, loading: (element as HTMLVideoElement).networkState === 2 }))).toEqual({ connected: false, hasSource: false, paused: true, loading: false });
  await latestVideo!.dispose();
  expect(officeActions).toEqual([]);
});
