import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { translate } from "../../lib/i18n/translate";
import { test, expect } from "@playwright/test";
import { clonephoneRelease as release } from "../../lib/toolbox/clonephone-release";
import { mobiletransRelease } from "../../lib/toolbox/mobiletrans-release";

const proofDirectory = process.env.TOOLBOX_PROOF_DIR ?? ".local/toolbox-latest/proof";
const locales = ["zh-CN", "it", "en"] as const;

for (const locale of locales) for (const width of [1440, 1024, 390, 375]) {
  test(`Clone Phone download page ${locale} ${width}`, async ({ page }) => {
    const t = (value: string) => translate(value, locale), errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(({ locale }) => localStorage.setItem("chinatech.language", locale), { locale });
    await page.goto("/toolbox");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.getByRole("link", { name: t("查看数据传输工具") }).click();
    await expect(page.getByRole("heading", { name: t("数据传输"), level: 1 })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.locator('a[download]')).toHaveCount(0);
    await page.getByRole("link", { name: t("查看手机搬家"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("手机搬家"), level: 1 })).toBeVisible();
    const apk = page.getByRole("link", { name: t("下载手机搬家 APK"), exact: true });
    await expect(apk).toHaveAttribute("href", release.apkPath);
    await expect(apk).toHaveAttribute("download", release.filename);
    await expect(page.locator('a[href$=".apk"]')).toHaveCount(1);
    await expect(page.locator("#chinatech-assistant, #smart-switch-experiment, #mimover-original, fieldset")).toHaveCount(0);
    await expect(page.getByText(release.version, { exact: true })).toBeVisible();
    const hero = page.locator('img[src*="clonephone-transfer-hero"]');
    await expect(hero).toBeVisible();
    await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const summary = page.locator("summary");
    await expect(summary).toHaveText(t("查看 APK 校验信息"));
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details")).toHaveAttribute("open", "");
    await expect(page.getByText(release.sha256, { exact: true })).toBeVisible();
    await expect(page.getByText(release.signerSha256, { exact: true })).toBeVisible();
    const checksums = page.getByRole("link", { name: t("下载 SHA256 校验清单") });
    const downloadEvent = page.waitForEvent("download");
    await checksums.click();
    const download = await downloadEvent, path = await download.path();
    expect(path).not.toBeNull();
    expect(await readFile(path!, "utf8")).toBe(`${release.sha256}  ${release.filename}\n`);
    await expect(page.locator("[data-toast]")).toHaveText(t("已发起下载，请查看浏览器的下载列表。"));
    await expect(page.locator("[data-toast]")).toHaveCount(0, { timeout: 4000 });
    const target = await apk.evaluate(element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width }));
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await summary.click();
    if (width === 375 || width === 1440) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}.png`, fullPage: true, scale: "css" });
    }
    await page.getByRole("link", { name: t("返回数据传输"), exact: true }).click();
    await expect(page).toHaveURL(/\/toolbox\/transfer$/);
    const mobiletransLink = page.getByRole("link", { name: t("查看 MobileTrans"), exact: true });
    await mobiletransLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/toolbox\/transfer\/mobiletrans$/);
    await page.reload();
    await expect(page).toHaveTitle("MobileTrans｜ChinaTech");
    await expect(page.getByRole("heading", { name: "MobileTrans", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: t("安装文件与校验"), level: 2 })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    for (const file of mobiletransRelease.files) {
      const link = page.getByRole("link", { name: t(file.downloadLabel), exact: true });
      await expect(link).toHaveAttribute("href", file.href);
      await expect(link).toHaveAttribute("download", file.filename);
      const bounds = await link.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: file.platform, exact: true }) });
      await card.locator("summary").click();
      await expect(card.getByText(file.sha256, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    if (width === 375 || width === 1440) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-mobiletrans-${locale}-${width}.png`, fullPage: true, scale: "css" });
    }
    await page.getByRole("link", { name: t("返回数据传输"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("数据传输"), level: 1 })).toBeVisible();
    if (width === 375 || width === 1440) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-apps-${locale}-${width}.png`, fullPage: true, scale: "css" });
    }
    await page.getByRole("link", { name: t("返回工具箱"), exact: true }).click();
    await expect(page).toHaveURL(/\/toolbox$/);
    expect(errors).toEqual([]);
  });
}

test("APK native download preserves supplied bytes and native failure keeps the page usable", async ({ page }) => {
  await page.goto("/toolbox/transfer/clonephone");
  const apk = page.locator(`a[download="${release.filename}"]`);
  const started = page.waitForEvent("download");
  await apk.click();
  const download = await started, path = await download.path();
  expect(download.suggestedFilename()).toBe(release.filename);
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.length).toBe(release.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
  // Native downloads bypass Playwright's page-level offline routing. A local fixture
  // drops its attachment socket before Content-Length bytes arrive instead.
  const broken = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": `attachment; filename="${release.filename}"`, "Content-Length": release.bytes });
    response.write(bytes.subarray(0, 65536));
    setTimeout(() => response.destroy(), 100);
  });
  await new Promise<void>(resolve => broken.listen(0, "127.0.0.1", resolve));
  try {
    const href = `http://127.0.0.1:${(broken.address() as AddressInfo).port}/interrupted.apk`;
    await apk.evaluate((element, value) => element.setAttribute("href", value), href);
    const failed = page.waitForEvent("download");
    await apk.click();
    expect(await (await failed).failure()).not.toBeNull();
  } finally {
    broken.closeAllConnections();
    await new Promise<void>(resolve => broken.close(() => resolve()));
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(apk).toBeEnabled();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("Retired phone downloads return 410 including Range; public status offers no stale APK", async ({ request }) => {
  for (const path of ["/toolbox/phone-current/ChinaTech-Phone-Assistant.apk", "/toolbox/phone-current/README.md", "/toolbox/phone-current/checksums.json", "/toolbox/android-assistant/ChinaTech-Phone-Assistant-0.3.0-alpha.apk", "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-entry-lab1.apk"]) {
    const response = await request.get(path, { headers: { Range: "bytes=0-1023" } });
    expect(response.status()).toBe(410);
    expect((await response.json()).code).toBe("UPDATE_REQUIRED");
  }
  const statusResponse = await request.get("/api/toolbox/client/v1/phone-assistant/status"), status = await statusResponse.json();
  if (process.env.TOOLBOX_LIVE_CLIENT_API === "1") {
    expect(statusResponse.status()).toBe(200);
    expect(status).toMatchObject({ enabled: false, ready: false, acceptingNewJobs: false, retired: true, activeReleaseId: null });
  } else {
    // Local/CI runs have no trusted Vercel source or rate-database credentials.
    expect(statusResponse.status()).toBe(503);
    expect(status).toEqual({ code: "SERVICE_UNAVAILABLE" });
  }
  expect(JSON.stringify(status)).not.toContain("phone-current");
  const update = await request.get("/api/toolbox/client/v1/phone-assistant/update");
  expect(update.status()).toBe(process.env.TOOLBOX_LIVE_CLIENT_API === "1" ? 410 : 503);
  expect((await update.json()).code).toBe(process.env.TOOLBOX_LIVE_CLIENT_API === "1" ? "TOOL_RETIRED" : "SERVICE_UNAVAILABLE");
});
