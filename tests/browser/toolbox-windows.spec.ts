import {createHash} from "node:crypto";
import { test, expect } from "@playwright/test";
import release from "../../lib/toolbox/windows-release.json";

const languages = [
  { locale: "zh-CN", title: "Windows 11 Pro 升级", download: "下载检测启动器", status: "自动升级尚未开放", source: "查看检测脚本源码" },
  { locale: "it", title: "Aggiornamento a Windows 11 Pro", download: "Scarica il programma di verifica", status: "Aggiornamento automatico non disponibile", source: "Visualizza il codice della verifica" },
  { locale: "en", title: "Windows 11 Pro upgrade", download: "Download inspection launcher", status: "Automatic upgrade is not yet available", source: "View inspection script source" },
] as const;

test('Retired Windows files are unavailable, including direct and Range requests',async({page,request})=>{
 await page.goto('/toolbox/windows');await expect(page.getByRole('heading',{name:languages[0].title,exact:true})).toBeVisible();await expect(page.getByRole('link',{name:languages[0].download,exact:true})).toHaveAttribute('href',release.archive.path);
 const current=await request.get(release.archive.path);expect(current.status()).toBe(200);expect(createHash('sha256').update(await current.body()).digest('hex')).toBe(release.archive.sha256);
 for(const path of ['/toolbox/windows/ChinaTech-Windows-Check.zip','/toolbox/windows/ChinaTech-Windows.ps1.txt','/toolbox/windows/Start-zh-CN.cmd.txt','/toolbox/windows/release.xml','/toolbox/windows/checksums.json']){const response=await request.get(path,{headers:{Range:'bytes=0-1023'}});expect(response.status()).toBe(410);expect((await response.json()).code).toBe('UPDATE_REQUIRED');}
});

for (const language of languages) {
  for (const width of [1440, 1024, 390, 375]) {
    test(`Windows ${language.locale} at ${width}px preserves status, download and readable layout`, async ({ page }) => {
      await page.addInitScript(locale => { localStorage.setItem("chinatech.language", locale); }, language.locale);
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await page.goto("/toolbox/windows");
      await expect(page.getByRole("heading", { name: language.title, exact: true })).toBeVisible();
      await expect(page.getByText(language.status, { exact: true })).toBeVisible();
      await expect(page.getByRole('link',{name:language.download,exact:true})).toHaveAttribute('href',release.archive.path);
      await expect(page.getByText(release.version,{exact:false})).toBeVisible();
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
