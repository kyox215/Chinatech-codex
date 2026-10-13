import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mimoverOriginalRelease as release } from "../../lib/toolbox/mimover-original-release";

const copy={
  "zh-CN":{title:"Mi Mover 原版新机入口解限",download:"下载 Mi Mover 原版入口解限版",scope:"修改范围与验证",limit:"本版仅验证新机入口与原版来源选择页。原版热点及恢复仍依赖系统接口，跨品牌完整迁移尚未验证。"},
  it:{title:"Mi Mover: accesso Nuovo originale sbloccato",download:"Scarica Mi Mover con accesso originale sbloccato",scope:"Ambito della modifica e verifiche",limit:"Sono verificati solo l’accesso Nuovo e la selezione originale del vecchio dispositivo. Hotspot e ripristino originali dipendono ancora da interfacce di sistema; la migrazione completa tra marche non è verificata."},
  en:{title:"Mi Mover original New-phone entry unlock",download:"Download Mi Mover original-entry unlock",scope:"Change scope and verification",limit:"Only the New-phone entry and original source-device selection are verified. Original hotspot and restoration still depend on system interfaces; full cross-brand migration is unverified."},
} as const;

for(const locale of ["zh-CN","it","en"] as const)for(const width of [1440,1024,390,375])test(`Original Mi Mover scope and layout ${locale} ${width}`,async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.setViewportSize({width,height:1000});await page.addInitScript(value=>localStorage.setItem("chinatech.language",value),locale);
  await page.goto("/toolbox/transfer#mimover-original");await expect(page.locator("html")).toHaveAttribute("lang",locale);
  const card=page.getByRole("region",{name:copy[locale].title,exact:true});await expect(card).toHaveAttribute("id","mimover-original");await expect(card.getByText(copy[locale].limit,{exact:true})).toBeVisible();
  await expect(card.getByRole("link",{name:copy[locale].download,exact:true})).toHaveAttribute("href",release.apkPath);
  await expect(page.locator("#mimover-universal")).toHaveCount(0);await expect(page.locator("#smart-switch-experiment")).toBeVisible();
  await expect.poll(()=>card.evaluate(e=>{const title=e.querySelector("h2"),header=document.querySelector("header");return Boolean(title&&header&&title.getBoundingClientRect().top>=header.getBoundingClientRect().bottom+8);})).toBe(true);
  await card.getByText(copy[locale].scope,{exact:true}).click();await expect(card.locator("details").first()).toHaveAttribute("open","");
  expect(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const box=await card.getByRole("link",{name:copy[locale].download,exact:true}).boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
  if(locale!=="zh-CN")expect(await card.innerText()).not.toMatch(/[\u4e00-\u9fff]/);
  expect(errors).toEqual([]);
  if(process.env.MIMOVER_ORIGINAL_PROOF_DIR)await page.screenshot({path:`${process.env.MIMOVER_ORIGINAL_PROOF_DIR}/${test.info().project.name}-${locale}-${width}.png`,scale:"css"});
});

test("Actual original-only download, byte proof and Range",async({page,request})=>{
  await page.goto("/toolbox/transfer#mimover-original");const receiving=page.waitForEvent("download");await page.locator(`#mimover-original a[href="${release.apkPath}"]`).click();const dl=await receiving;expect(await dl.failure()).toBeNull();const file=await dl.path();expect(file).not.toBeNull();const bytes=readFileSync(file!);expect(bytes.length).toBe(release.bytes);expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
  const range=await request.get(release.apkPath,{headers:{Range:"bytes=0-1023"}});expect(range.status()).toBe(206);expect(range.headers()["content-range"]).toBe(`bytes 0-1023/${release.bytes}`);expect(Buffer.compare(await range.body(),bytes.subarray(0,1024))).toBe(0);
  const proof=await request.get(release.proofPath);expect(proof.status()).toBe(200);const data=await proof.json();expect(data.addedDex).toBe(false);expect(data.addedFiles).toEqual([]);expect(data.changedEntries.sort()).toEqual(["AndroidManifest.xml","classes2.dex"]);expect(data.apkSha256).toBe(release.sha256);
  const instructions=await request.get(release.instructionsPath);expect(instructions.status()).toBe(200);expect(await instructions.text()).toContain(release.sha256);
});

test("Rejected lab2 URL and card remain absent",async({page,request})=>{
  await page.goto("/toolbox/transfer");await expect(page.locator("#mimover-universal")).toHaveCount(0);
  for(const name of ["MiMover-4.5.7.5-universal-coexist-lab2.apk","README.md","SHA256SUMS.txt"])expect((await request.get(`/toolbox/mimover-universal/${name}`)).status()).toBe(404);
});

test("Original APK download remains usable without JavaScript",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});const page=await context.newPage();await page.goto(`${test.info().project.use.baseURL}/toolbox/transfer#mimover-original`);
  const link=page.locator(`#mimover-original a[href="${release.apkPath}"]`);await link.focus();await expect(link).toBeFocused();const receiving=page.waitForEvent("download");await page.keyboard.press("Enter");const dl=await receiving;expect(await dl.failure()).toBeNull();const file=await dl.path();expect(file).not.toBeNull();const bytes=readFileSync(file!);expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);await context.close();
});
