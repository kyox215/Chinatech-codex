import { test, expect, type Locator, type Page } from "@playwright/test";
import { tutorials } from "../../lib/tutorials";

function episode(page: Page, index: number) {
  const tutorial = tutorials[index];
  return page.getByRole("button", { name: `第 ${tutorial.number} 集 ${tutorial.title}`, exact: true });
}

async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

async function expectPlaying(video: Locator) {
  await expect.poll(() => video.evaluate(element => {
    const media = element as HTMLVideoElement;
    return media.readyState >= 2 && !media.paused && media.currentTime > 0;
  }), { timeout: 15_000 }).toBe(true);
  const before = await video.evaluate(element => (element as HTMLVideoElement).currentTime);
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(before);
}

async function expectTargetFits(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
}

test.beforeEach(async ({ page }) => {
  // Public tutorials need neither a preview session nor any real customer data.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("home stays media-idle while selecting all tutorials and exposes matching steps and destinations", async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on("request", request => { if (/\/tutorials\/.*\.mp4(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
  await page.goto("/", { waitUntil: "networkidle" });
  const video = page.locator("#tutorials video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("controls", "");
  expect(await video.getAttribute("autoplay")).toBeNull();

  for (const [index, tutorial] of tutorials.entries()) {
    await activate(episode(page, index));
    await expect(episode(page, index)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('#tutorials button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator("#current-tutorial-title")).toHaveText(tutorial.title);
    await expect(video).toHaveAttribute("poster", tutorial.poster);
    await expect(video.locator("track")).toHaveAttribute("src", tutorial.captions);
    expect(await video.getAttribute("src")).toBeNull();
    expect(await video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    for (const step of tutorial.steps) await expect(page.getByRole("heading", { name: step.title, exact: true })).toBeVisible();
    await expect(page.locator("#tutorials").getByRole("link", { name: tutorial.actionLabel, exact: true })).toHaveAttribute("href", tutorial.href);
  }

  await episode(page, 0).focus();
  await page.keyboard.press("Space");
  await expect(episode(page, 0)).toBeFocused();
  await expect(episode(page, 0)).toHaveAttribute("aria-pressed", "true");
  expect(await episode(page, 0).evaluate(element => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  })).toBe(true);
  expect(mediaRequests).toEqual([]);

  await activate(page.locator("#tutorials").getByRole("link", { name: tutorials[0].actionLabel, exact: true }));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("电子邮件", { exact: true })).toBeVisible();
});

test("real playback and captions work, steps seek, and switching episodes releases the old media", async ({ page }) => {
  await page.goto("/#tutorials");
  const video = page.locator("#tutorials video");
  await activate(page.getByRole("button", { name: `播放教程：${tutorials[0].title}`, exact: true }));
  await expect(video).toHaveAttribute("src", tutorials[0].src);
  await expectPlaying(video);
  await video.evaluate(element => { (element as HTMLVideoElement).textTracks[0].mode = "showing"; });
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).textTracks[0].cues?.length ?? 0)).toBeGreaterThan(0);
  await expect(video.locator("track")).toHaveAttribute("srclang", "zh-CN");

  const step = tutorials[0].steps.find(item => item.at > 0)!;
  await activate(page.getByRole("button", { name: new RegExp(`观看：${step.title}$`) }));
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(step.at);
  await expect(video).toBeFocused();

  const oldVideo = await video.elementHandle();
  expect(oldVideo).not.toBeNull();
  await activate(episode(page, 1));
  expect(await oldVideo!.evaluate(element => {
    const media = element as HTMLVideoElement;
    return media.paused && !media.isConnected && !media.hasAttribute("src");
  })).toBe(true);
  expect(await video.getAttribute("src")).toBeNull();
  await expect(page.locator("#current-tutorial-title")).toHaveText(tutorials[1].title);
  await expect(video).toHaveAttribute("poster", tutorials[1].poster);
  await activate(page.getByRole("button", { name: `播放教程：${tutorials[1].title}`, exact: true }));
  await expectPlaying(video);
  expect(await video.evaluate(element => (element as HTMLVideoElement).currentSrc)).toContain(tutorials[1].src);
  await oldVideo!.dispose();
});

test("loading and media failure leave text steps available, with a working retry", async ({ page }) => {
  let failRequest = () => {};
  const responseReady = new Promise<void>(resolve => { failRequest = resolve; });
  const pattern = `**${tutorials[0].src}`;
  await page.route(pattern, async route => {
    await responseReady;
    await route.fulfill({ status: 503, contentType: "text/plain", headers: { "cache-control": "no-store" }, body: "Tutorial media unavailable in this test" });
  });
  await page.goto("/#tutorials");
  await activate(page.getByRole("button", { name: `播放教程：${tutorials[0].title}`, exact: true }));
  await expect(page.getByRole("status").filter({ hasText: "视频加载中" })).toBeVisible();
  failRequest();
  await expect(page.locator("#tutorials").getByRole("alert")).toContainText("视频暂时无法播放");
  await expect(page.getByRole("heading", { name: tutorials[0].steps[0].title, exact: true })).toBeVisible();
  await expectTargetFits(page.getByRole("button", { name: "重试播放", exact: true }));
  await page.unroute(pattern);
  await activate(page.getByRole("button", { name: "重试播放", exact: true }));
  await expect(page.locator("#tutorials").getByRole("alert")).not.toBeVisible();
  await expectPlaying(page.locator("#tutorials video"));
});

test("tutorial entries and layout remain usable at desktop and phone widths", async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/");
    const heroEntry = page.getByRole("link", { name: "观看使用教程", exact: true });
    await expectTargetFits(heroEntry);
    await expect(page.getByRole("navigation", { name: "账户入口" }).getByRole("link", { name: "登录", exact: true })).toBeInViewport();
    if (width >= 768) {
      const navEntry = page.getByRole("navigation", { name: "主页导航" }).getByRole("link", { name: "视频教程", exact: true });
      await expectTargetFits(navEntry);
      await expect(navEntry).toHaveAttribute("href", "#tutorials");
    }
    await activate(heroEntry);
    await expect(page).toHaveURL(/#tutorials$/);
    await expect(page.getByRole("heading", { name: "视频教程", exact: true })).toBeInViewport();
    for (let index = 0; index < tutorials.length; index++) await expectTargetFits(episode(page, index));
    for (const button of await page.locator("#tutorials").getByRole("button", { name: /^从 .* 观看：/ }).all()) await expectTargetFits(button);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth)).toBe(true);
    const player = await page.locator("#tutorials video").boundingBox();
    const playlist = await page.getByRole("complementary", { name: "教程选集" }).boundingBox();
    expect(player).not.toBeNull();
    expect(playlist).not.toBeNull();
    if (width >= 768) expect(playlist!.x).toBeGreaterThanOrEqual(player!.x + player!.width);
    else expect(playlist!.y).toBeGreaterThan(player!.y + player!.height);
    await test.info().attach(`tutorials-${width}`, { body: await page.locator("#tutorials").screenshot(), contentType: "image/png" });
    await expect(page.locator("footer").getByRole("link", { name: "使用帮助", exact: true })).toHaveAttribute("href", "#tutorials");
    await expect(page.locator("#workflow").getByRole("heading", { name: "流程清楚，工作自然顺手。", exact: true })).toBeVisible();
  }
});
