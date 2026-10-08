import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { androidAssistantRelease as release } from "../../lib/toolbox/android-assistant-release";
import { smartSwitchExperimentRelease } from "../../lib/toolbox/smart-switch-experiment-release";

const smartSwitchExpected = {
  apkPath: "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-universal-coexist-lab3.apk",
  updateApkPath: "/toolbox/smart-switch-experiment/SmartSwitch-3.7.73.4-universal-lab3.apk",
  bytes: 42699726,
  sha256: "38e2a5136cf38c5479a3f1f3cda33ab5ccd87c138eb754017da649530256ea31",
  updateSha256: "9714e2571daeafaec5433bf993f4273c73076dfb8dbacfe4eb4e851ec8b3e62b",
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
    recovery: "Android 16 模拟器的两端局域网传输与断线恢复已通过。模拟器自动热点被系统拒绝；HONOR 等真机热点、相机扫码和跨品牌资料恢复尚未验收。",
    title: "Smart Switch 通用通道实验版",
    download: "下载 lab3 并存版（推荐）",
    update: "更新已安装的 lab1／lab2",
    notice: "lab3 将通用本地传输通道嵌入 Smart Switch APK，打开后选择发送或接收。两机须用 lab3，并存版与更新包可以互通；不能与三星原版、lab1／lab2 或 ChinaTech 独立助手混用。",
    warning: "独立签名实验包，不是三星官方更新。推荐并存版可与官方或预装 Smart Switch 同时安装，无需卸载原版；更新包仅用于本站 lab1／lab2，不能覆盖三星官方签名包。",
    legacy: "ChinaTech 0.2 保留下载作参考；已发现原生 TLS 连接缺陷，修复尚未随旧包发布。建议使用上方 lab3，不将此旧包视为已可完成迁移。",
    integrity: "查看 APK 校验信息",
    scope: "传输范围与限制",
    pending: "lab3 安装包仍在核验，下载尚未开放。",
  },
  "it": {
    recovery: "Su due emulatori Android 16 sono riusciti trasferimento LAN e recupero dopo disconnessione. Il sistema ha rifiutato l’hotspot automatico dell’emulatore; hotspot e scansione con fotocamera su telefoni reali come HONOR, e ripristino tra marche, restano da verificare.",
    title: "Smart Switch: canale universale sperimentale",
    download: "Scarica lab3 affiancabile (consigliata)",
    update: "Aggiorna lab1/lab2 già installata",
    notice: "lab3 integra un canale locale universale nell’APK Smart Switch: all’apertura scegli Invio o Ricezione. Entrambi devono usare lab3; la versione affiancabile e quella di aggiornamento sono interoperabili. Non si abbina a Smart Switch Samsung originale, lab1/lab2 o all’assistente ChinaTech separato.",
    warning: "APK sperimentale con firma indipendente, non un aggiornamento ufficiale Samsung. La versione affiancabile consigliata si installa insieme a Smart Switch ufficiale o preinstallato, senza disinstallarlo. L’aggiornamento è solo per lab1/lab2 di questo sito e non sostituisce APK con firma Samsung.",
    legacy: "ChinaTech 0.2 resta scaricabile come riferimento. È stato trovato un difetto nella connessione TLS nativa; il vecchio APK non contiene la correzione. Usa preferibilmente lab3 sopra; questo vecchio APK non prova una migrazione funzionante.",
    integrity: "Verifica informazioni APK",
    scope: "Dati trasferibili e limiti",
    pending: "L’APK lab3 è ancora in verifica; il download non è disponibile.",
  },
  "en": {
    recovery: "Two Android 16 emulators passed LAN transfer and disconnection recovery. The system denied the emulator’s automatic hotspot; physical HONOR and other phones’ hotspots, camera scanning and cross-brand restoration remain unverified.",
    title: "Smart Switch universal-channel experiment",
    download: "Download lab3 side-by-side (recommended)",
    update: "Update installed lab1/lab2",
    notice: "lab3 embeds a universal local transfer channel in the Smart Switch APK: choose Send or Receive when opening it. Both phones need lab3; the side-by-side and update editions can pair. It cannot pair with original Samsung Smart Switch, lab1/lab2 or the separate ChinaTech assistant.",
    warning: "An independently signed experimental APK, not an official Samsung update. The recommended side-by-side edition installs alongside official or preinstalled Smart Switch without uninstalling it. The update edition is only for this site’s lab1/lab2 and cannot replace Samsung-signed APKs.",
    legacy: "ChinaTech 0.2 remains downloadable for reference. A native TLS connection defect was found; the old APK does not include the fix. Prefer lab3 above; this old APK must not be treated as a working migration release.",
    integrity: "View APK verification details",
    scope: "Transfer scope and limits",
    pending: "The lab3 APK is still being verified; download is not available yet.",
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
    await expect(smartSwitch).toContainText("3.7.73.4-universal-lab3");
    await expect(smartSwitch).toContainText(locale === "zh-CN" ? "Android 8 及以上" : locale === "it" ? "Android 8 o successivo" : "Android 8 or later");
    const smartDownload = smartSwitch.getByRole("link", { name: smartText.download, exact: true });
    const smartUpdate = smartSwitch.getByRole("link", { name: smartText.update, exact: true });
    const smartInstructions = smartSwitch.locator(`a[href="${smartSwitchExperimentRelease.instructionsPath}"]`);
    await expect(smartInstructions).toBeVisible();
    await expect(smartInstructions).toHaveAttribute("download", "");
    await expect(smartInstructions).toHaveAttribute("href", "/toolbox/smart-switch-experiment/README-lab3.md");
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
  expect(smartSwitchExperimentRelease.versionCode).toBe(377304132);
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
  for (const path of ["/toolbox/smart-switch-experiment/README-lab3.md", "/toolbox/smart-switch-experiment/SHA256SUMS-lab3.txt"]) {
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
