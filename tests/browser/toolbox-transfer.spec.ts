import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { androidAssistantRelease as release } from "../../lib/toolbox/android-assistant-release";
import { smartSwitchExperimentRelease } from "../../lib/toolbox/smart-switch-experiment-release";

const smartSwitchExpected = {
  apkPath: "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk",
  bytes: 41941787,
  sha256: "691561816463392bc9d2e8760406ca540adba518f9c54f95dac1c54452df1ac8",
  signerSha256: "22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab",
} as const;

const copy = {
  "zh-CN": { title: "数据传输", open: "查看数据传输工具", sender: "旧手机 · 发送", receiver: "新手机 · 接收", system: "系统类型", version: "安卓版本", blocked: "先解决系统兼容性。", ready: "可以安装首版助手，迁移能力待手机核验。", partial: "仅授权部分照片", partialNotice: "仅授权部分照片时，只能读取所选内容；不能显示为全部相册完成。", wifi: "热点连接权限" },
  it: { title: "Trasferimento dati", open: "Apri gli strumenti di trasferimento dati", sender: "Vecchio telefono · invio", receiver: "Nuovo telefono · ricezione", system: "Tipo di sistema", version: "Versione Android", blocked: "Risolvi prima la compatibilità del sistema.", ready: "La prima versione può essere installata; le capacità vanno verificate sui telefoni.", partial: "Accesso solo ad alcune foto", partialNotice: "Con accesso parziale si possono leggere solo le foto selezionate; non si può dichiarare l’intera galleria completata.", wifi: "Permessi per la connessione hotspot" },
  en: { title: "Data transfer", open: "View data transfer tools", sender: "Old phone · send", receiver: "New phone · receive", system: "System type", version: "Android version", blocked: "Resolve system compatibility first.", ready: "The initial assistant can be installed; migration capabilities need verification on the phones.", partial: "Only selected photos authorized", partialNotice: "With partial authorization only selected photos can be read; the entire gallery must not be marked complete.", wifi: "Hotspot connection permissions" },
} as const;

const smartSwitchCopy = {
  "zh-CN": {
    recovery: "lab2：非三星接收端二维码等待 15 秒后切换手动直连，设置入口支持通用 Wi-Fi；配对与资料恢复仍待真机核验。",
    title: "Smart Switch 接收入口实验版",
    download: "下载 Smart Switch 实验 APK",
    notice: "用于测试非三星手机的接收入口；安装、配对和资料恢复尚未真机验证。",
    warning: "这是独立签名的实验修改版，不是三星官方更新。不能覆盖官方或系统预装版本；请先在未安装官方版本的备用手机上使用测试资料核对。",
    integrity: "查看 APK 校验信息",
  },
  it: {
    recovery: "lab2: sui destinatari non Samsung, dopo 15 secondi di attesa del QR si passa alla connessione manuale; si possono aprire le impostazioni Wi-Fi generiche. Abbinamento e ripristino richiedono ancora verifiche sui telefoni.",
    title: "Smart Switch: ricezione sperimentale",
    download: "Scarica APK Smart Switch sperimentale",
    notice: "Per provare la ricezione su telefoni non Samsung; installazione, abbinamento e ripristino non sono stati verificati su dispositivi reali.",
    warning: "Questa modifica sperimentale ha una firma indipendente e non è un aggiornamento ufficiale Samsung. Non può sostituire la versione ufficiale o preinstallata; prova prima dati sintetici su un telefono di riserva senza la versione ufficiale.",
    integrity: "Verifica informazioni APK",
  },
  en: {
    recovery: "lab2: on non-Samsung receivers, 15 seconds of QR waiting switches to manual connection, with generic Wi-Fi settings available. Pairing and restoration still need phone verification.",
    title: "Smart Switch receiver-entry experiment",
    download: "Download experimental Smart Switch APK",
    notice: "For testing the receiver entry on non-Samsung phones; installation, pairing and restoration have not been verified on real devices.",
    warning: "This experimental modification is independently signed and is not an official Samsung update. It cannot replace an official or preinstalled version; first check test data on a spare phone without the official version.",
    integrity: "View APK verification details",
  },
} as const;

for (const locale of ["zh-CN", "it", "en"] as const) for (const width of [1440, 1024, 390, 375]) {
  test(`Android assistant planning ${locale} ${width}`, async ({ page }) => {
    const text = copy[locale], smartText = smartSwitchCopy[locale], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(({ locale }) => localStorage.setItem("chinatech.language", locale), { locale });
    await page.goto("/toolbox");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.getByRole("link", { name: text.open }).click();
    await expect(page.getByRole("heading", { name: text.title, level: 1 })).toBeVisible();
    await page.goto("/toolbox/transfer#smart-switch-experiment");
    const smartSwitch = page.getByRole("region", { name: smartText.title, exact: true });
    await expect.poll(async () => smartSwitch.evaluate(element => {
      const title = element.querySelector("h2");
      const header = document.querySelector("header");
      return Boolean(title && header && title.getBoundingClientRect().top >= header.getBoundingClientRect().bottom + 8);
    })).toBe(true);
    await expect(smartSwitch).toHaveAttribute("id", "smart-switch-experiment");
    await expect(smartSwitch).toHaveAttribute("aria-labelledby", "smart-switch-experiment-title");
    await expect(smartSwitch.getByRole("heading", { name: smartText.title, level: 2, exact: true })).toBeVisible();
    await expect(smartSwitch.getByText(smartText.notice, { exact: true })).toBeVisible();
    await expect(smartSwitch.getByText(smartText.recovery, { exact: true })).toBeVisible();
    await expect(smartSwitch.getByText(smartText.warning, { exact: true })).toBeVisible();
    const smartDownload = smartSwitch.getByRole("link", { name: smartText.download, exact: true });
    await expect(smartDownload).toBeVisible();
    await expect(smartDownload).toHaveAttribute("href", smartSwitchExpected.apkPath);
    await expect(smartDownload).toHaveAttribute("download", "");
    const smartInstructions = smartSwitch.locator(`a[href="${smartSwitchExperimentRelease.instructionsPath}"]`);
    await expect(smartInstructions).toBeVisible();
    await expect(smartInstructions).toHaveAttribute("download", "");
    const smartIntegrity = smartSwitch.locator("summary").filter({ hasText: smartText.integrity });
    await expect(smartIntegrity).toHaveText(smartText.integrity);
    for (const control of [smartDownload, smartInstructions, smartIntegrity]) {
      const dimensions = await control.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
      expect(dimensions.width).toBeGreaterThanOrEqual(44);
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
    }
    await smartIntegrity.click();
    await expect(smartSwitch.locator("details")).toHaveAttribute("open", "");
    await expect(smartSwitch.locator("code")).toHaveText([smartSwitchExpected.sha256, smartSwitchExpected.signerSha256]);
    await expect(smartSwitch.locator("code").first()).toBeVisible();
    await expect(smartSwitch.locator("code").last()).toBeVisible();
    expect(await smartSwitch.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth + 1 && bounds.left >= -1 && bounds.right <= window.innerWidth + 1;
    })).toBe(true);
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
      await page.screenshot({ path: `.local/smartswitch-web-release/proof/${test.info().project.name}-${locale}-${width}.png`, fullPage: true });
      await page.screenshot({ path: `.local/smartswitch-web-release/proof/${test.info().project.name}-${locale}-${width}-viewport.png` });
      await smartSwitch.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: `.local/smartswitch-web-release/proof/${test.info().project.name}-${locale}-${width}-smart-switch-card.png` });
    }
  });
}

test("APK download matches verified local release", async ({ page }) => {
  expect(release.available).toBe(true);
  expect(release.apkPath).toBeTruthy();
  await page.goto("/toolbox/transfer");
  const downloadLink = page.locator(`a[href="${release.apkPath}"]`);
  await expect(downloadLink).toBeVisible();
  const event = page.waitForEvent("download");
  await downloadLink.click();
  const download = await event, path = await download.path();
  expect(await download.failure()).toBeNull();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.length).toBe(release.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
});

test("Smart Switch APK download matches the verified experiment", async ({ page }) => {
  expect(smartSwitchExperimentRelease.apkPath).toBe(smartSwitchExpected.apkPath);
  expect(smartSwitchExperimentRelease.bytes).toBe(smartSwitchExpected.bytes);
  expect(smartSwitchExperimentRelease.sha256).toBe(smartSwitchExpected.sha256);
  expect(smartSwitchExperimentRelease.signerSha256).toBe(smartSwitchExpected.signerSha256);
  await page.goto("/toolbox/transfer");
  const downloadLink = page.locator(`#smart-switch-experiment a[href="${smartSwitchExpected.apkPath}"]`);
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).toHaveAttribute("download", "");
  const event = page.waitForEvent("download");
  await downloadLink.click();
  const download = await event, path = await download.path();
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe("SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk");
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.length).toBe(smartSwitchExpected.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(smartSwitchExpected.sha256);
});
