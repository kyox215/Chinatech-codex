import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isMimoverReleaseReady, mimoverRelease as release } from "../../lib/toolbox/mimover-release";

const copy = {
  "zh-CN": {
    title: "Mi Mover 跨品牌传输实验版",
    download: "下载 Mi Mover lab2 并存版（推荐）",
    instructions: "使用说明",
    pending: "Mi Mover 安装包正在构建与核验，下载尚未开放。",
    scope: "传输范围与限制",
    integrity: "查看 APK 校验信息",
    limits: "应用私有数据、账号登录、聊天、短信和通话记录不支持自动还原。",
    brands: "支持自动热点、系统手动热点或同一 Wi-Fi。OPPO、Motorola、Samsung 等品牌真机兼容性仍待核验。",
  },
  it: {
    title: "Mi Mover: trasferimento sperimentale tra marche",
    download: "Scarica Mi Mover lab2 affiancabile (consigliata)",
    instructions: "Istruzioni d’uso",
    pending: "L’APK Mi Mover è in compilazione e verifica; il download non è ancora disponibile.",
    scope: "Dati trasferibili e limiti",
    integrity: "Verifica informazioni APK",
    limits: "Il ripristino automatico non supporta dati privati delle app, accessi agli account, chat, SMS o registro chiamate.",
    brands: "Supporta hotspot automatico, hotspot manuale di sistema o la stessa Wi-Fi. La compatibilità con telefoni reali OPPO, Motorola, Samsung e altre marche resta da verificare.",
  },
  en: {
    title: "Mi Mover cross-brand transfer experiment",
    download: "Download Mi Mover lab2 side-by-side (recommended)",
    instructions: "Usage instructions",
    pending: "The Mi Mover APK is being built and verified; download is not available yet.",
    scope: "Transfer scope and limits",
    integrity: "View APK verification details",
    limits: "Automatic restoration does not support private app data, account logins, chats, SMS or call logs.",
    brands: "Supports an automatic hotspot, a manual system hotspot or the same Wi-Fi. Compatibility with physical OPPO, Motorola, Samsung and other phones remains unverified.",
  },
} as const;

for (const locale of ["zh-CN", "it", "en"] as const) for (const width of [1440, 1024, 390, 375]) {
  test(`Mi Mover card and download gate ${locale} ${width}`, async ({ page }) => {
    const text = copy[locale];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(value => localStorage.setItem("chinatech.language", value), locale);
    await page.goto("/toolbox/transfer#mimover-universal");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const card = page.getByRole("region", { name: text.title, exact: true });
    await expect(card).toHaveAttribute("id", "mimover-universal");
    await expect(card).toHaveAttribute("aria-labelledby", "mimover-universal-title");
    await expect(card.getByRole("heading", { name: text.title, level: 2 })).toBeVisible();
    await expect(card).toContainText("4.5.7.5-ct-lab2");
    await expect(card.getByText(text.brands, { exact: true })).toBeVisible();
    await expect.poll(() => card.evaluate(element => {
      const heading = element.querySelector("h2");
      const header = document.querySelector("header");
      return Boolean(heading && header && heading.getBoundingClientRect().top >= header.getBoundingClientRect().bottom + 8);
    })).toBe(true);

    if (isMimoverReleaseReady(release)) {
      const download = card.getByRole("link", { name: text.download, exact: true });
      await expect(download).toHaveAttribute("href", "/toolbox/mimover-universal/MiMover-4.5.7.5-universal-coexist-lab2.apk");
      await expect(download).toHaveAttribute("download", "");
      await expect(card.getByRole("link", { name: text.instructions, exact: true })).toHaveAttribute("href", "/toolbox/mimover-universal/README.md");
      await card.getByText(text.integrity, { exact: true }).click();
      await expect(card.locator("code")).toHaveText([release.sha256, release.signerSha256]);
      await expect(card.locator(`a[href="${release.checksumsPath}"]`)).toHaveAttribute("download", "");
      await expect(card.getByRole("status")).toHaveCount(0);
    } else {
      await expect(card.getByRole("button", { name: text.download, exact: true })).toBeDisabled();
      await expect(card.getByRole("button", { name: text.instructions, exact: true })).toBeDisabled();
      await expect(card.getByRole("status")).toHaveText(text.pending);
      await expect(card.locator('a[href^="/toolbox/mimover-universal/"]')).toHaveCount(0);
      await expect(card.locator("code")).toHaveCount(0);
    }

    const scope = card.getByText(text.scope, { exact: true });
    await scope.click();
    await expect(card.getByText(text.limits, { exact: true })).toBeVisible();
    await expect(card.locator("ul li")).toHaveCount(4);
    if (locale !== "zh-CN") expect(await card.innerText()).not.toMatch(/[\u4e00-\u9fff]/);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const control of [scope, card.getByRole(isMimoverReleaseReady(release) ? "link" : "button", { name: text.download, exact: true })]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
    if (process.env.MIMOVER_PROOF_DIR) {
      await card.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: `${process.env.MIMOVER_PROOF_DIR}/${test.info().project.name}-${locale}-${width}-mimover.png`, scale: "css" });
    }
  });
}

test("Mi Mover frozen download bytes and published metadata agree", async ({ page, request }) => {
  await page.goto("/toolbox/transfer#mimover-universal");
  const card = page.locator("#mimover-universal");
  if (!isMimoverReleaseReady(release)) {
    await expect(card.locator('a[href$=".apk"]')).toHaveCount(0);
    await expect(card.getByRole("button", { name: copy["zh-CN"].download, exact: true })).toBeDisabled();
    return;
  }
  const downloading = page.waitForEvent("download");
  await card.locator(`a[href="${release.apkPath}"]`).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const file = await download.path();
  expect(file).not.toBeNull();
  const bytes = readFileSync(file!);
  expect(bytes.length).toBe(release.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
  const range = await request.get(release.apkPath, { headers: { Range: "bytes=0-1023" } });
  expect(range.status()).toBe(206);
  expect(range.headers()["content-range"]).toBe(`bytes 0-1023/${release.bytes}`);
  expect(Buffer.compare(await range.body(), bytes.subarray(0, 1024))).toBe(0);
  const instructions = await request.get(release.instructionsPath);
  expect(instructions.status()).toBe(200);
  expect(await instructions.text()).toContain(release.version);
  const checksums = await request.get(release.checksumsPath);
  expect(checksums.status()).toBe(200);
  const manifest = await checksums.text();
  expect(manifest).toContain(release.sha256);
  expect(manifest).toContain(release.apkPath.split("/").at(-1));
});

test("Mi Mover download gate works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL ?? "http://127.0.0.1:3121"}/toolbox/transfer#mimover-universal`);
  const card = page.locator("#mimover-universal");
  await expect(card.getByRole("heading", { name: copy["zh-CN"].title, exact: true })).toBeVisible();
  if (isMimoverReleaseReady(release)) {
    await expect(card.locator(`a[href="${release.apkPath}"]`)).toHaveAttribute("download", "");
  } else {
    await expect(card.getByRole("button", { name: copy["zh-CN"].download, exact: true })).toBeDisabled();
    await expect(card.getByRole("status")).toHaveText(copy["zh-CN"].pending);
  }
  // Native keyboard activation works when no-JS disables animation-frame callbacks.
  // Keep all download and disclosure assertions; do not force a DOM click.
  if (isMimoverReleaseReady(release)) {
    const link = card.locator(`a[href="${release.apkPath}"]`);
    await link.focus();
    await expect(link).toBeFocused();
    const downloading = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = readFileSync(path!);
    expect(bytes.length).toBe(release.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
  }
  const scope = card.getByText(copy["zh-CN"].scope, { exact: true });
  await scope.focus();
  await expect(scope).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card.getByText(copy["zh-CN"].limits, { exact: true })).toBeVisible();
  await context.close();
});
