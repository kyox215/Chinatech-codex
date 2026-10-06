// Capture the real UI with disposable fictional records. No production writes.
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const origin = process.env.TUTORIAL_CAPTURE_ORIGIN ?? "http://127.0.0.1:3121";
if (!["http://127.0.0.1:3121", "http://127.0.0.1:3123"].includes(origin)) {
  throw new Error("Tutorial capture is restricted to this project's local preview ports.");
}
const locale = process.env.TUTORIAL_CAPTURE_LOCALE ?? "zh-CN";
if (!["zh-CN", "it", "en"].includes(locale)) throw new Error("Unsupported tutorial locale.");
const dir = path.resolve("scripts/tutorials/.work");
await fs.mkdir(`${dir}/captures`, { recursive: true });
const browser = await chromium.launch();
const only = process.argv[2];
const selectedFrames = process.env.TUTORIAL_CAPTURE_FRAMES ? new Set(process.env.TUTORIAL_CAPTURE_FRAMES.split(",")) : null;
const metadata = JSON.parse(await fs.readFile(`${dir}/captures.json`, "utf8").catch(() => "{}"));
const capturedRegions = new Map();
const id = "LOCAL-C000000000000001";
const sample = {
  id, revision: 1, createdAt: "2026-10-04 09:00:00", updatedAt: "2026-10-04 09:00:00", previewAt: "2026-10-04 09:00:00",
  customerName: "教程演示客户", phone: "+393200000001", email: "", category: "手机", brand: "Apple", model: "iPhone 16",
  color: "黑色", serial: "", faults: ["屏幕：碎裂"], issueNote: "", issue: "屏幕：碎裂", accessories: [],
  services: { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } },
  priority: "普通", photoCount: 0, custody: "customer"
};

async function context(seed = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  // Business interactions keep stable Chinese selectors. The same live elements
  // are remeasured after switching to the requested capture language.
  await context.addInitScript(() => localStorage.setItem("chinatech.language", "zh-CN"));
  // Public auth screens may be read, but all mutating requests must stay in the local preview.
  await context.route("**/*", route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin !== origin && !["data:", "blob:"].includes(url.protocol)) return route.abort();
    return route.continue();
  });
  const response = await context.request.post(`${origin}/api/preview-session`, { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  if (response.status() !== 200) throw new Error("Only the local fictional preview is permitted.");
  if (seed) await context.addInitScript(sample => {
    if (location.hostname !== "127.0.0.1" || localStorage.getItem("tutorial-capture-seeded")) return;
    localStorage.setItem("tutorial-capture-seeded", "1");
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: [sample], signatures: [] }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: [], repairUpdates: {} }));
  }, sample);
  return context;
}
async function language(page, value) {
  await page.evaluate(value => {
    localStorage.setItem("chinatech.language", value);
    window.dispatchEvent(new StorageEvent("storage", { key: "chinatech.language", newValue: value }));
  }, value);
  await expect(page.locator("html")).toHaveAttribute("lang", value);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function capture(page, name, targetLocator, regionLocator) {
  if (selectedFrames && !selectedFrames.has(name)) return;
  const target = targetLocator ? await targetLocator.elementHandle() : null;
  const region = regionLocator ? await regionLocator.elementHandle() : null;
  if (region) capturedRegions.set(`${locale}.${name}`, region);
  await language(page, locale);
  if (region) await region.scrollIntoViewIfNeeded();
  else if (target) await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize();
  if (target) {
    const before = await target.boundingBox();
    if (before && before.y < 0) await page.evaluate(y => window.scrollBy(0, y - 100), before.y);
  }
  let clip;
  if (region) {
    const box = await region.boundingBox();
    if (box && box.height < viewport.height - 20) clip = {
      x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12),
      width: Math.min(viewport.width - Math.max(0, box.x - 12), box.width + 24),
      height: Math.min(viewport.height - Math.max(0, box.y - 12), box.height + 24)
    };
  }
  const box = target ? await target.boundingBox() : null;
  const file = `${dir}/captures/${locale}-${name}.png`;
  await page.screenshot({ path: file, animations: "disabled", ...(clip ? { clip } : {}) });
  if (box && (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1)) throw new Error(`Target outside capture: ${name}`);
  const targetLabel = target ? await target.evaluate(element => {
    const referenced = (element.getAttribute("aria-labelledby") || "").split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
    const labels = Array.from(element.labels || []).map(label => label.querySelector("span")?.textContent || label.textContent || "").join(" ").trim();
    return (element.getAttribute("aria-label") || referenced || labels || element.textContent?.trim() || element.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim();
  }) : "";
  const interactive = target ? await target.evaluate(element => !!element.closest("button,a,input,textarea,select,label,summary,[role=radio]")) : false;
  metadata[`${locale}.${name}`] = { file: path.relative(process.cwd(), file), locale, documentLanguage: await page.locator("html").getAttribute("lang"), capturedAt: new Date().toISOString(), width: clip?.width ?? viewport.width, height: clip?.height ?? viewport.height,
    highlight: box ? { x: box.x - (clip?.x ?? 0), y: box.y - (clip?.y ?? 0), width: box.width, height: box.height } : null,
    targetLabel: targetLabel.slice(0, 120), interactive, clip, source: page.url().replace(/\?.*/, ""), fictional: true };
  await fs.writeFile(`${dir}/captures.json`, JSON.stringify(metadata, null, 2));
  console.log(`Captured ${name}`);
  await language(page, "zh-CN");
}
async function captureAfter(page, name) {
  if (selectedFrames && !selectedFrames.has(name)) return;
  const shot = metadata[`${locale}.${name}`];
  const file = `${dir}/captures/${locale}-${name}-after.png`;
  const confirmationHeading = null;
  await language(page, locale);
  if (locale !== "zh-CN" && confirmationHeading && /[\u3400-\u9fff]/u.test(await confirmationHeading.textContent())) throw new Error("The inspection confirmation heading is not localized yet.");
  const region = capturedRegions.get(`${locale}.${name}`), viewport = page.viewportSize();
  let clip;
  if (region) {
    const box = await region.boundingBox();
    if (box && box.height < viewport.height - 20) clip = {
      x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12),
      width: Math.min(viewport.width - Math.max(0, box.x - 12), box.width + 24),
      height: Math.min(viewport.height - Math.max(0, box.y - 12), box.height + 24)
    };
  }
  await page.screenshot({ path: file, animations: "disabled", ...(clip ? { clip } : {}) });
  shot.after = path.relative(process.cwd(), file);
  shot.afterLanguage = await page.locator("html").getAttribute("lang");
  shot.afterSize = { width: clip?.width ?? viewport.width, height: clip?.height ?? viewport.height };
  await fs.writeFile(`${dir}/captures.json`, JSON.stringify(metadata, null, 2));
  await language(page, "zh-CN");
}
async function expand(page) {
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible();
  const ids = await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(items => items.map(item => item.id));
  for (const id of ids) await page.locator(`#${id}`).click();
}
async function parts(page) {
  await expand(page);
  await page.getByRole("button", { name: `${id} 供应商与配件操作`, exact: true }).click();
  return page.getByRole("dialog", { name: "供应商与配件", exact: true });
}
async function selectSupplier(dialog) {
  const supplier = dialog.getByRole("combobox", { name: "供应商（选填）" });
  await supplier.fill("MobileParts SRL");
  await dialog.getByRole("option", { name: "MobileParts SRL", exact: true }).click();
  await dialog.getByLabel("屏幕报价", { exact: true }).fill("89");
}
async function run(name, fn, seeded = false) {
  if (only && !only.split(",").includes(name) && !(only === "public" && name === "start")) return;
  const ctx = await context(seeded); const page = await ctx.newPage(); page.setDefaultTimeout(18000);
  try { await fn(page); }
  catch (error) {
    await page.screenshot({ path: `${dir}/${name}-failure.png`, fullPage: true });
    console.error((await page.locator("body").innerText()).slice(-9000));
    throw error;
  } finally { await ctx.close(); }
}

try {
  await run("start", async page => {
    await page.goto(origin); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await capture(page, "start-home", page.locator("header nav").first());
    await page.goto(`${origin}/register`);
    await expect(page.locator(".auth-form h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await capture(page, "start-register", page.locator("#display-name"), page.locator(".auth-form"));
    await page.goto(`${origin}/login`);
    await expect(page.locator(".auth-form h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await capture(page, "start-login", page.locator(".auth-form button[type=submit]"), page.locator(".auth-form"));
    if (only === "public") return;
    await page.goto(`${origin}/app/dashboard`); await expect(page.locator(".app-sidebar")).toBeVisible();
    await capture(page, "start-dashboard", page.getByRole("link", { name: "维修工单", exact: true }));
    await page.getByRole("link", { name: "维修工单", exact: true }).click();
    await expect(page.getByRole("heading", { name: "维修工单", exact: true })).toBeVisible();
    await captureAfter(page, "start-dashboard");
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: /打开.*菜单|打开导航|打开侧栏/ });
    await capture(page, "start-mobile", menu);
    await menu.click();
    await captureAfter(page, "start-mobile");
  });
  await run("intake", async page => {
    await page.goto(`${origin}/app/repairs`); await expand(page);
    await capture(page, "intake-list", page.getByRole("link", { name: "新建工单", exact: true }));
    await page.getByRole("link", { name: "新建工单", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "联系电话" })).toBeVisible();
    await captureAfter(page, "intake-list");
    await capture(page, "intake-customer", page.getByRole("combobox", { name: "联系电话" }), page.locator(".intake-form"));
    await page.getByRole("combobox", { name: "联系电话" }).fill("+393200000002");
    await page.getByLabel("客户称呼（选填）", { exact: true }).fill("教程演示客户");
    await captureAfter(page, "intake-customer");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByRole("combobox", { name: /^品牌/ }).fill("Apple");
    await page.getByRole("combobox", { name: /^型号/ }).fill("iPhone 16");
    await page.getByRole("heading", { name: "送修设备", exact: true }).click();
    await capture(page, "intake-device", page.getByRole("textbox", { name: "SN / IMEI", exact: true }), page.locator(".intake-form"));
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByRole("button", { name: "屏幕", exact: true }).click();
    await capture(page, "intake-faults", page.getByLabel("屏幕报价", { exact: true }));
    await page.getByLabel("屏幕报价", { exact: true }).fill("89");
    await captureAfter(page, "intake-faults");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await capture(page, "intake-review", page.getByRole("button", { name: "客户签字", exact: true }));
    await page.getByRole("checkbox", { name: /已与客户核对/ }).check();
    await page.getByRole("button", { name: "保存并预览", exact: true }).click();
    await expect(page.getByRole("heading", { name: "接机信息已保存" })).toBeVisible();
    await capture(page, "intake-saved", page.getByRole("link", { name: "查看工单", exact: true }), page.locator(".intake-success__card"));
  });
  await run("follow-up", async page => {
    await page.goto(`${origin}/app/repairs`); await expand(page);
    await page.getByRole("textbox", { name: "搜索维修工单", exact: true }).fill("教程演示客户");
    await capture(page, "follow-list", page.getByRole("textbox", { name: "搜索维修工单", exact: true }));
    await page.getByRole("button", { name: `${id} 更改维修阶段`, exact: true }).click();
    const stage = page.getByRole("dialog", { name: "更改维修阶段", exact: true });
    await capture(page, "follow-stage", stage.getByRole("button", { name: "维修中", exact: true }), stage);
    await stage.getByRole("button", { name: "维修中", exact: true }).click();
    await captureAfter(page, "follow-stage");
    await capture(page, "follow-stage-selected", stage.getByRole("button", { name: /保存/, exact: false }), stage);
    await stage.getByRole("button", { name: /保存/, exact: false }).click();
    await page.getByRole("button", { name: `${id} 联系与跟进`, exact: true }).click();
    const contact = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
    await capture(page, "follow-contact", contact.getByLabel("联系跟进说明", { exact: true }), contact);
    await contact.getByLabel("联系跟进说明", { exact: true }).fill("演示：已说明报价，等待客户回复。");
    await captureAfter(page, "follow-contact");
    await capture(page, "follow-contact-filled", contact.getByRole("button", { name: "报价待客户回复", exact: true }), contact);
    await contact.getByRole("button", { name: "报价待客户回复", exact: true }).click();
    await page.getByRole("link", { name: `打开 ${id} iPhone 16 详情`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "工单详情", exact: true })).toBeVisible();
    await capture(page, "follow-detail", page.getByRole("button", { name: `${id} 联系与跟进`, exact: true }));
  }, true);
  await run("procurement", async page => {
    await page.goto(`${origin}/app/repairs`);
    let dialog = await parts(page);
    await capture(page, "proc-parts", dialog.getByRole("combobox", { name: "供应商（选填）" }), dialog);
    await selectSupplier(dialog);
    await captureAfter(page, "proc-parts");
    await capture(page, "proc-filled", dialog.getByRole("button", { name: "保存", exact: true }), dialog);
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByRole("button", { name: "采购车", exact: true }).click();
    dialog = page.getByRole("dialog").filter({ has: page.getByLabel("批量操作供应商") });
    await dialog.getByLabel("批量操作供应商").selectOption("demo-mobile");
    await dialog.getByRole("button", { name: "选择本供应商全部", exact: true }).click();
    await capture(page, "proc-cart", dialog.getByRole("button", { name: "核对所选清单", exact: true }), dialog);
    await dialog.getByRole("button", { name: "核对所选清单", exact: true }).click();
    await capture(page, "proc-ordered-review", dialog.getByRole("button", { name: "确认保存实际事实", exact: true }), dialog);
    await dialog.getByRole("button", { name: "确认保存实际事实", exact: true }).click();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await page.getByRole("button", { name: "批量到货", exact: true }).click();
    dialog = page.getByRole("dialog").filter({ has: page.getByLabel("批量操作供应商") });
    await dialog.getByLabel("批量操作供应商").selectOption("demo-mobile");
    await dialog.getByRole("button", { name: "选择本供应商全部", exact: true }).click();
    await dialog.getByRole("spinbutton").fill("1");
    await capture(page, "proc-arrival", dialog.getByRole("spinbutton"), dialog);
    await dialog.getByRole("button", { name: "核对所选清单", exact: true }).click();
    await dialog.getByRole("button", { name: "确认保存实际事实", exact: true }).click();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await page.goto(`${origin}/app/procurement`);
    await expect(page.getByRole("heading", { name: "采购与到货", exact: true })).toBeVisible();
    await capture(page, "proc-result", page.locator(".procurement-row").filter({ hasText: id }).first());
  }, true);
  await run("retail", async page => {
    await page.goto(`${origin}/app/retail/new`);
    await expect(page.getByRole("radio", { name: "翻新机", exact: true })).toBeVisible();
    await capture(page, "retail-classify", page.getByRole("radio", { name: "翻新机", exact: true }).locator(".."));
    await page.getByRole("radio", { name: "翻新机", exact: true }).locator("..").click();
    await captureAfter(page, "retail-classify");
    await capture(page, "retail-identity", page.getByRole("combobox", { name: /^型号 \/ 商品名称/ }));
    await page.getByRole("combobox", { name: /^品牌/ }).fill("Apple");
    await page.getByRole("combobox", { name: /^型号 \/ 商品名称/ }).fill("iPhone 16");
    await page.getByRole("heading", { name: "商品身份", exact: true }).click();
    await captureAfter(page, "retail-identity");
    await page.getByText("详细规格（选填）", { exact: true }).click();
    await capture(page, "retail-specs", page.getByText("详细规格（选填）", { exact: true }));
    await page.getByText("问题与随件（选填）", { exact: true }).click();
    await capture(page, "retail-details", page.getByLabel("已知问题与外观说明", { exact: true }));
    await page.getByLabel("已知问题与外观说明", { exact: true }).fill("演示：边框轻微使用痕迹，三项检测已实际完成。");
    await captureAfter(page, "retail-details");
    await page.getByRole("combobox", { name: "保存方式", exact: true }).selectOption("available");
    await page.getByLabel("标价", { exact: true }).fill("399");
    for (const name of ["功能检测已完成", "门店自有及账号锁已核验", "数据处理核验已完成"]) await page.getByRole("checkbox", { name, exact: true }).check();
    await capture(page, "retail-review", page.locator("footer").getByRole("button", { name: "建档并设为可售", exact: true }));
    await page.locator("footer").getByRole("button", { name: "建档并设为可售", exact: true }).click();
    await page.waitForURL("**/app/retail/units/**");
    await expect(page.getByRole("heading", { name: /iPhone 16/ })).toBeVisible();
    await captureAfter(page, "retail-review");
    await page.getByRole("button", { name: "登记售出", exact: true }).click();
    const form = page.getByRole("region", { name: "登记成交", exact: true });
    await form.getByRole("combobox", { name: "客户手机号 *", exact: true }).fill("+393200000019");
    await form.getByRole("combobox", { name: "本次收款情况", exact: true }).selectOption("full");
    await form.getByRole("combobox", { name: "收款方式", exact: true }).selectOption("cash");
    await form.getByRole("combobox", { name: "实际交付情况", exact: true }).selectOption("delivered");
    await form.getByRole("checkbox", { name: "已核对商品、成交、实际收款、交付及保修条款", exact: true }).check();
    await capture(page, "retail-saved", form.getByRole("button", { name: "确认登记成交", exact: true }));
    await form.getByRole("button", { name: "确认登记成交", exact: true }).click();
    await expect(page.getByRole("button", { name: "打印销售与保修单", exact: true })).toBeVisible();
    await captureAfter(page, "retail-saved");
  });
} finally { await browser.close(); }
