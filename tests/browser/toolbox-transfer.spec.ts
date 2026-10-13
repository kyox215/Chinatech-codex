import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { androidAssistantRelease as release } from "../../lib/toolbox/android-assistant-release";
import { smartSwitchExperimentRelease } from "../../lib/toolbox/smart-switch-experiment-release";

const smartSwitchExpected = {
  apkPath: "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-original-ui-coexist-lab4.apk",
  updateApkPath: "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-original-ui-lab4.apk",
  bytes: 42761166,
  sha256: "6115198b29ec3b67be59459ffca86a47f9804ef49b8e2baabbf2a5dbcc635a20",
  updateSha256: "9f68089caf3c694beeefcf200348727892307a4d167db48e6eab7e2bf5c72ce0",
  signerSha256: "22e7f48efb1f168f67886a617b83af67885a233b6a1c6f16428f138f5b367dab",
} as const;
const proofDirectory = process.env.TOOLBOX_PROOF_DIR ?? ".local/smartswitch-web-release/proof";

const copy = {
  "zh-CN": { title: "数据传输", open: "查看数据传输工具", sender: "旧手机 · 发送", receiver: "新手机 · 接收", system: "系统类型", version: "安卓版本", blocked: "先解决系统兼容性。", ready: "可以安装首版助手，迁移能力待手机核验。", partial: "仅授权部分照片", partialNotice: "仅授权部分照片时，只能读取所选内容；不能显示为全部相册完成。", wifi: "热点连接权限" },
  it: { title: "Trasferimento dati", open: "Apri gli strumenti di trasferimento dati", sender: "Vecchio telefono · invio", receiver: "Nuovo telefono · ricezione", system: "Tipo di sistema", version: "Versione Android", blocked: "Risolvi prima la compatibilità del sistema.", ready: "La prima versione può essere installata; le capacità vanno verificate sui telefoni.", partial: "Accesso solo ad alcune foto", partialNotice: "Con accesso parziale si possono leggere solo le foto selezionate; non si può dichiarare l’intera galleria completata.", wifi: "Permessi per la connessione hotspot" },
  en: { title: "Data transfer", open: "View data transfer tools", sender: "Old phone · send", receiver: "New phone · receive", system: "System type", version: "Android version", blocked: "Resolve system compatibility first.", ready: "The initial assistant can be installed; migration capabilities need verification on the phones.", partial: "Only selected photos authorized", partialNotice: "With partial authorization only selected photos can be read; the entire gallery must not be marked complete.", wifi: "Hotspot connection permissions" },
} as const;

const smartSwitchCopy = {
  "zh-CN": {
    recovery: "Android 16 模拟器已验证原界面勾选、两端局域网传输、通知返回、取消和最终回执恢复。HONOR 等品牌真机、热点自动加入和光学扫码仍待验收。",
    title: "Smart Switch 原版界面实验版",
    download: "下载 lab4 原版界面并存版（推荐）",
    update: "更新本站 lab1／lab2／lab3 原包名版",
    notice: "lab4 保留三星原首页、连接、资料选择、进度和完成页面，接入通用局域网传输。两机都需 lab4；并存版与更新包互通，不与三星原版、旧 lab 或 ChinaTech 0.3 混用。",
    warning: "独立签名实验包，保留原界面，不是三星官方更新。并存版可覆盖本站 lab3 并存版；更新包仅用于本站 lab1／lab2／lab3 原包名版本，不能覆盖三星官方签名包。",
    legacy: "0.3 支持自动热点、手动热点和同一 Wi-Fi，内置实时扫码。Android 16 模拟器已验证本地传输与恢复；品牌真机仍待核验。",
    integrity: "查看 APK 校验信息",
    scope: "传输范围与限制",
    pending: "lab4 安装包仍在核验，下载尚未开放。",
  },
  "it": {
    recovery: "Su emulatori Android 16 sono verificati selezione nell’interfaccia originale, trasferimento LAN, ritorno dalla notifica, annullamento e recupero della ricevuta finale. Telefoni reali come HONOR, collegamento automatico all’hotspot e scansione ottica restano da verificare.",
    title: "Smart Switch: interfaccia originale sperimentale",
    download: "Scarica lab4 affiancabile con interfaccia originale (consigliata)",
    update: "Aggiorna lab1/lab2/lab3 del sito con pacchetto originale",
    notice: "lab4 conserva le schermate originali Samsung di avvio, connessione, selezione, avanzamento e completamento, con trasferimento LAN universale. Entrambi i telefoni richiedono lab4; le due edizioni sono interoperabili, ma non con Smart Switch Samsung originale, vecchie lab o ChinaTech 0.3.",
    warning: "APK sperimentale con firma indipendente e interfaccia originale, non un aggiornamento ufficiale Samsung. L’edizione affiancabile aggiorna lab3 affiancabile di questo sito; l’altra è solo per lab1/lab2/lab3 con nome pacchetto originale e non sostituisce APK firmati Samsung.",
    legacy: "0.3 supporta hotspot automatico/manuale e stessa Wi-Fi, con scansione QR live. Trasferimento locale e recupero verificati su emulatori Android 16; telefoni reali ancora da verificare.",
    integrity: "Verifica informazioni APK",
    scope: "Dati trasferibili e limiti",
    pending: "L’APK lab4 è ancora in verifica; il download non è disponibile.",
  },
  "en": {
    recovery: "Android 16 emulators verified original-screen selection, two-phone LAN transfer, notification return, cancellation and final-receipt recovery. Physical HONOR and other brands, automatic hotspot joining and optical scanning remain unverified.",
    title: "Smart Switch original-interface experiment",
    download: "Download lab4 original-interface side-by-side edition (recommended)",
    update: "Update this site’s original-package lab1/lab2/lab3",
    notice: "lab4 keeps Samsung’s original start, connection, selection, progress and completion screens with universal LAN transfer. Both phones need lab4; its two editions can pair, but cannot pair with original Samsung Smart Switch, older labs or ChinaTech 0.3.",
    warning: "An independently signed experimental APK retaining the original interface, not an official Samsung update. The side-by-side edition updates this site’s side-by-side lab3; the update edition is only for this site’s lab1/lab2/lab3 with the original package name and cannot replace Samsung-signed APKs.",
    legacy: "0.3 supports automatic/manual hotspots and same Wi-Fi, with live QR scanning. Android 16 emulators verified local transfer and recovery; physical brands remain unverified.",
    integrity: "View APK verification details",
    scope: "Transfer scope and limits",
    pending: "The lab4 APK is still being verified; download is not available yet.",
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
    await expect(smartSwitch.locator("ol li")).toHaveCount(4);
    await expect(page.getByText(smartText.legacy, { exact: true })).toBeVisible();
    await expect(smartSwitch).toContainText("3.7.73.4-original-ui-lab4");
    await expect(smartSwitch).toContainText(locale === "zh-CN" ? "Android 8 及以上" : locale === "it" ? "Android 8 o successivo" : "Android 8 or later");
    const smartDownload = smartSwitch.getByRole("link", { name: smartText.download, exact: true });
    const smartUpdate = smartSwitch.getByRole("link", { name: smartText.update, exact: true });
    const smartInstructions = smartSwitch.locator(`a[href="${smartSwitchExperimentRelease.instructionsPath}"]`);
    await expect(smartInstructions).toBeVisible();
    await expect(smartInstructions).toHaveAttribute("download", "");
    await expect(smartInstructions).toHaveAttribute("href", "/toolbox/smart-switch-experiment/README-lab4.md");
    const scope = smartSwitch.locator("summary").filter({ hasText: smartText.scope });
    await expect(scope).toHaveText(smartText.scope);
    await scope.click();
    const limits = smartSwitch.locator("details").filter({ has: page.locator("summary").filter({ hasText: smartText.scope }) });
    await expect(limits).toHaveAttribute("open", "");
    await expect(limits.locator("li")).toHaveCount(4);
    await expect(limits).toContainText("HarmonyOS NEXT");
    await expect(limits).toContainText("10000");
    await expect(limits).toContainText("5");
    expect(await limits.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await scope.click();
    const smartIntegrity = smartSwitch.locator("summary").filter({ hasText: smartText.integrity });
    const controls = [smartInstructions, scope];
    if (smartSwitchExperimentRelease.available) {
      await expect(smartDownload).toBeVisible();
      await expect(smartDownload).toHaveAttribute("href", smartSwitchExpected.apkPath);
      await expect(smartDownload).toHaveAttribute("download", "");
      await expect(smartIntegrity).toHaveText(smartText.integrity);
      await expect(smartUpdate).toBeVisible();
      await expect(smartUpdate).toHaveAttribute("href", smartSwitchExpected.updateApkPath);
      await expect(smartUpdate).toHaveAttribute("download", "");
      controls.push(smartDownload, smartUpdate, smartIntegrity);
      await smartIntegrity.click();
      await expect(smartSwitch.locator("details").filter({ has: page.locator("summary").filter({ hasText: smartText.integrity }) })).toHaveAttribute("open", "");
      await expect(smartSwitch.locator("code")).toHaveText([smartSwitchExpected.sha256, smartSwitchExpected.updateSha256, smartSwitchExpected.signerSha256]);
      await expect(smartSwitch.locator("code").first()).toBeVisible();
      await expect(smartSwitch.locator("code").last()).toBeVisible();
    } else {
      await expect(smartSwitch.getByRole("status")).toHaveText(smartText.pending);
      await expect(smartDownload).toHaveCount(0);
      await expect(smartUpdate).toHaveCount(0);
      await expect(smartIntegrity).toHaveCount(0);
      await expect(smartSwitch.locator("code")).toHaveCount(0);
    }
    for (const control of controls) {
      const dimensions = await control.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
      expect(dimensions.width).toBeGreaterThanOrEqual(44);
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
    }
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
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}.png`, fullPage: true, scale: "css" });
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}-viewport.png`, scale: "css" });
      await smartSwitch.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: `${proofDirectory}/${test.info().project.name}-${locale}-${width}-smart-switch-card.png`, scale: "css" });
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

test("Both Smart Switch APK downloads match the verified experiments", async ({ page, request }) => {
  expect(smartSwitchExperimentRelease.available).toBe(true);
  expect(smartSwitchExperimentRelease.versionCode).toBe(377304135);
  expect(smartSwitchExperimentRelease.apkPath).toBe(smartSwitchExpected.apkPath);
  expect(smartSwitchExperimentRelease.updateApkPath).toBe(smartSwitchExpected.updateApkPath);
  expect(smartSwitchExperimentRelease.bytes).toBe(smartSwitchExpected.bytes);
  expect(smartSwitchExperimentRelease.updateBytes).toBe(smartSwitchExpected.bytes);
  expect(smartSwitchExperimentRelease.sha256).toBe(smartSwitchExpected.sha256);
  expect(smartSwitchExperimentRelease.updateSha256).toBe(smartSwitchExpected.updateSha256);
  expect(smartSwitchExperimentRelease.signerSha256).toBe(smartSwitchExpected.signerSha256);
  expect(smartSwitchExperimentRelease.packageName).toBe("com.sec.android.easyMover.chinatech");
  expect(smartSwitchExperimentRelease.updatePackageName).toBe("com.sec.android.easyMover");
  await page.goto("/toolbox/transfer");
  for (const [apkPath, sha256] of [[smartSwitchExpected.apkPath, smartSwitchExpected.sha256], [smartSwitchExpected.updateApkPath, smartSwitchExpected.updateSha256]] as const) {
    const downloadLink = page.locator(`#smart-switch-experiment a[href="${apkPath}"]`);
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute("download", "");
    const event = page.waitForEvent("download");
    await downloadLink.click();
    const download = await event, path = await download.path();
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(apkPath.split("/").at(-1));
    expect(path).toBeTruthy();
    const bytes = readFileSync(path!);
    expect(bytes.length).toBe(smartSwitchExpected.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
    const range = await request.get(apkPath, { headers: { Range: "bytes=0-1023" } });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toBe(`bytes 0-1023/${smartSwitchExpected.bytes}`);
    expect(await range.body()).toEqual(bytes.subarray(0, 1024));
    await range.dispose();
  }
  for (const path of ["/toolbox/smart-switch-experiment/README-lab4.md", "/toolbox/smart-switch-experiment/SHA256SUMS-lab4.txt"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.body()).toEqual(readFileSync(`public${path}`));
    expect(await response.text()).toContain(smartSwitchExpected.sha256);
    expect(await response.text()).toContain(smartSwitchExpected.updateSha256);
    await response.dispose();
  }
});

test("Previous APKs and lab2 documents retain their original bytes", async ({ request }) => {
  const retained = [
    ["/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-entry-lab1.apk", "7daa79ef27c1a8b63a14638cb03ae33bafe680e946bad4a224635a1d10697de1"],
    ["/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-receiver-recovery-lab2.apk", "691561816463392bc9d2e8760406ca540adba518f9c54f95dac1c54452df1ac8"],
    ["/toolbox/android-assistant/ChinaTech-Phone-Assistant-0.2.0-alpha.apk", "2b20bb31207cbcb82e2b84dbf614b655b12ad3cf9a0b6bc88d24288eaee689a4"],
    ["/toolbox/smart-switch-experiment/README.md", "f91e653e20edccee4a532985e9168c1391d2a87aa1cf10214858314b2868440c"],
    ["/toolbox/smart-switch-experiment/SHA256SUMS.txt", "d4779089a53f4d7d2e1f9d2241cfe38f8aa9a5cd338f3860d1546af97ce4b899"],
  ] as const;
  for (const [path, sha256] of retained) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(sha256);
    await response.dispose();
  }
});
