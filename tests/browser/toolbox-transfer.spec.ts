import {translate} from "../../lib/i18n/translate";
import { test, expect } from "@playwright/test";
import { androidAssistantRelease as release } from "../../lib/toolbox/android-assistant-release";
import { smartSwitchExperimentRelease } from "../../lib/toolbox/smart-switch-experiment-release";

const proofDirectory = process.env.TOOLBOX_PROOF_DIR ?? ".local/toolbox-latest/proof";

const copy = {
  "zh-CN": { title: "数据传输", open: "查看数据传输工具", sender: "旧手机 · 发送", receiver: "新手机 · 接收", system: "系统类型", version: "安卓版本", blocked: "先解决系统兼容性。", ready: "设备条件符合；下载仍需通过版本校验。", partial: "仅授权部分照片", partialNotice: "仅授权部分照片时，只能读取所选内容；不能显示为全部相册完成。", wifi: "热点连接权限" },
  it: { title: "Trasferimento dati", open: "Apri gli strumenti di trasferimento dati", sender: "Vecchio telefono · invio", receiver: "Nuovo telefono · ricezione", system: "Tipo di sistema", version: "Versione Android", blocked: "Risolvi prima la compatibilità del sistema.", ready: "Requisiti del dispositivo compatibili; il download richiede ancora la verifica della versione.", partial: "Accesso solo ad alcune foto", partialNotice: "Con accesso parziale si possono leggere solo le foto selezionate; non si può dichiarare l’intera galleria completata.", wifi: "Permessi per la connessione hotspot" },
  en: { title: "Data transfer", open: "View data transfer tools", sender: "Old phone · send", receiver: "New phone · receive", system: "System type", version: "Android version", blocked: "Resolve system compatibility first.", ready: "Device requirements match; downloads still require release verification.", partial: "Only selected photos authorized", partialNotice: "With partial authorization only selected photos can be read; the entire gallery must not be marked complete.", wifi: "Hotspot connection permissions" },
} as const;

for (const locale of ["zh-CN", "it", "en"] as const) for (const width of [1440, 1024, 390, 375]) {
  test(`Android assistant planning ${locale} ${width}`, async ({ page }) => {
    const text = copy[locale], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(({ locale }) => localStorage.setItem("chinatech.language", locale), { locale });
    await page.goto("/toolbox");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.getByRole("link", { name: text.open }).click();
    await expect(page.getByRole("heading", { name: text.title, level: 1 })).toBeVisible();
    for(const id of ['smart-switch-experiment','mimover-original']){
      const card=page.locator('#'+id);await expect(card).toBeVisible();
      await expect(card.getByRole('status')).toHaveText(translate('版本校验接入中，下载暂未开放。',locale));
      await expect(card.locator('a[download]')).toHaveCount(0);
    }
    const own=page.locator('#chinatech-assistant');
    if(release.available){await expect(own.getByRole('link',{name:translate('下载手机助手',locale),exact:true})).toHaveAttribute('href',release.apkPath);await expect(own.getByText(translate('版本 {version} · Android 8 及以上',locale,{version:release.version}),{exact:true})).toBeVisible();}
    else{await expect(own.getByRole('status')).toHaveText(translate('版本校验接入中，下载暂未开放。',locale));await expect(own.locator('a[download]')).toHaveCount(0);}
    const sender = page.getByRole("group", { name: text.sender }), receiver = page.getByRole("group", { name: text.receiver });
    await receiver.getByLabel(text.system).selectOption("harmony-next");
    await expect(page.getByText(text.blocked, { exact: true })).toBeVisible();
    await expect(receiver.getByLabel(text.version)).toBeDisabled();
    await receiver.getByLabel(text.system).selectOption("android");
    await expect(page.getByText(text.ready, { exact: true })).toBeVisible();
    await sender.getByLabel(text.partial).check();
    await expect(page.getByText(text.partialNotice, { exact: true })).toBeVisible();
    await sender.getByLabel(text.version).selectOption("31");
    await receiver.getByLabel(text.version).selectOption("31");
    await page.getByText(text.wifi, { exact: true }).click();
    await expect(page.locator("code").filter({ hasText: /ACCESS_COARSE_LOCATION/ })).toHaveCount(2);
    await expect(page.locator("code").filter({ hasText: /ACCESS_COARSE_LOCATION/ }).first()).toBeVisible();
    await sender.getByLabel(text.version).selectOption("26");
    await receiver.getByLabel(text.version).selectOption("33");
    const networkPlan = page.locator("details").filter({ has: page.getByText(text.wifi, { exact: true }) });
    await expect(networkPlan.locator("li").filter({ hasText: "ACTION_WIFI_SETTINGS" })).toContainText(locale === "zh-CN" ? "旧手机" : locale === "it" ? "Vecchio telefono" : "Old phone");
    await expect(networkPlan.locator("li").filter({ hasText: "NEARBY_WIFI_DEVICES" })).toContainText(locale === "zh-CN" ? "新手机" : locale === "it" ? "Nuovo telefono" : "New phone");
    await sender.getByLabel(text.version).selectOption("37");
    await receiver.getByLabel(text.version).selectOption("37");
    await expect(page.locator("code").filter({ hasText: /^ACCESS_LOCAL_NETWORK$/ })).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const dimensions = await sender.getByLabel(text.version).evaluate(element => ({ height: element.getBoundingClientRect().height, size: parseFloat(getComputedStyle(element).fontSize) }));
    expect(dimensions.height).toBeGreaterThanOrEqual(44);
    if (width < 768) expect(dimensions.size).toBeGreaterThanOrEqual(16);
    expect(errors).toEqual([]);
    if (width === 375 || width === 1440) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}.png`, fullPage: true, scale: "css" });
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}-viewport.png`, scale: "css" });
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}-smart-switch-card.png`, scale: "css" });
    }
  });
}

test('Obsolete APKs and auxiliary files require updating even for Range requests',async({request})=>{
 for(const path of ['/toolbox/android-assistant/ChinaTech-Phone-Assistant-0.3.0-alpha.apk','/toolbox/android-assistant/README-0.3.md',smartSwitchExperimentRelease.apkPath,smartSwitchExperimentRelease.updateApkPath,'/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-entry-lab1.apk','/toolbox/android-assistant/ChinaTech-Phone-Assistant-0.2.0-alpha.apk']){
  const response=await request.get(path,{headers:{Range:'bytes=0-1023'}});expect(response.status()).toBe(410);expect((await response.json()).code).toBe('UPDATE_REQUIRED');
 }
});
