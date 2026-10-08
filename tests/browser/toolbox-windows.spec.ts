import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import release from "../../lib/toolbox/windows-release.json";

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const languages = [
  { locale: "zh-CN", title: "Windows 11 Pro 升级", download: "下载检测启动器", status: "自动升级尚未开放", source: "查看检测脚本源码" },
  { locale: "it", title: "Aggiornamento a Windows 11 Pro", download: "Scarica il programma di verifica", status: "Aggiornamento automatico non disponibile", source: "Visualizza il codice della verifica" },
  { locale: "en", title: "Windows 11 Pro upgrade", download: "Download inspection launcher", status: "Automatic upgrade is not yet available", source: "View inspection script source" },
] as const;

test("Windows entry, real ZIP download and all public files match pinned bytes", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/toolbox");
  await page.getByRole("link", { name: "查看 Windows 升级工具", exact: true }).click();
  await expect(page).toHaveURL(/\/toolbox\/windows$/);
  await expect(page.getByRole("heading", { name: languages[0].title, exact: true })).toBeVisible();
  await expect(page.getByText(languages[0].status, { exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: languages[0].download, exact: true });
  await expect(link).toHaveAttribute("href", release.archive.path);
  const zip = await request.get(release.archive.path);
  expect(zip.ok()).toBe(true);
  expect(sha(await zip.body())).toBe(release.archive.sha256);
  const downloaded = page.waitForEvent("download");
  await link.click();
  expect((await downloaded).suggestedFilename()).toBe("ChinaTech-Windows-Check.zip");
  for (const [filename, metadata] of Object.entries(release.files)) {
    if (filename === "README.txt" || filename === "release.xml" || filename.endsWith(".cmd") || filename.endsWith(".ps1")) {
      const path = filename.endsWith(".cmd") || filename.endsWith(".ps1") ? `${filename}.txt` : filename;
      const response = await request.get(`/toolbox/windows/${path}`);
      expect(response.ok()).toBe(true);
      expect(sha(await response.body())).toBe(metadata.sha256);
    }
  }
  await page.getByRole("link", { name: "工具箱", exact: true }).click();
  await expect(page).toHaveURL(/\/toolbox$/);
  await page.getByRole("link", { name: "查看安装与激活命令", exact: true }).click();
  await expect(page).toHaveURL(/\/toolbox\/office$/);
  await expect(page.getByRole("heading", { name: "Office 安装与激活", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("JavaScript-disabled browsers can read the page and download the complete package", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/toolbox/windows`);
    await expect(page.getByRole("heading", { name: languages[0].title, exact: true })).toBeVisible();
    await expect(page.getByText(languages[0].status, { exact: true })).toBeVisible();
    const download = page.getByRole("link", { name: languages[0].download, exact: true });
    await expect(download).toHaveAttribute("href", release.archive.path);
    expect((await context.request.get(release.archive.path)).ok()).toBe(true);
  } finally { await context.close(); }
});

for (const language of languages) {
  for (const width of [1440, 1024, 390, 375]) {
    test(`Windows ${language.locale} at ${width}px preserves status, download and readable layout`, async ({ page }) => {
      await page.addInitScript(locale => { localStorage.setItem("chinatech.language", locale); }, language.locale);
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await page.goto("/toolbox/windows");
      await expect(page.getByRole("heading", { name: language.title, exact: true })).toBeVisible();
      await expect(page.getByText(language.status, { exact: true })).toBeVisible();
      const download = page.getByRole("link", { name: language.download, exact: true });
      await expect(download).toBeVisible();
      await expect(page.getByRole("link", { name: language.source, exact: true })).toBeVisible();
      await expect(page.getByText(`Start-${language.locale}.cmd`, { exact: false })).toBeVisible();
      const measurements = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        downloads: [...document.querySelectorAll<HTMLAnchorElement>('a[download]')].map(link => ({ width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height })),
      }));
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.width);
      for (const button of measurements.downloads) { expect(button.height).toBeGreaterThanOrEqual(44); expect(button.width).toBeGreaterThanOrEqual(44); }
      await page.reload();
      await expect(page.getByRole("heading", { name: language.title, exact: true })).toBeVisible();
      await page.screenshot({ path: `.local/windows-toolbox/screenshots/${test.info().project.name}-${language.locale}-${width}.png`, fullPage: true });
    });
  }
}
