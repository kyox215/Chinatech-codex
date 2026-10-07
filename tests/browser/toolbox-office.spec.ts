import { test, expect, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import digests from "../fixtures/office-command-digests.json";

const actions = { install: "仅安装", activate: "仅激活", uninstall: "仅卸载", reinstall: "完整重装" } as const;
async function activate(locator: Locator) { if (test.info().project.use.hasTouch) await locator.tap(); else await locator.click(); }
function sha(text: string | Buffer) { return createHash("sha256").update(text).digest("hex"); }

test("Office commands preserve all terminal bytes, sources and downloads", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { officeCopied: string }).officeCopied = text; } } });
  });
  await page.goto("/toolbox");
  await activate(page.getByRole("link", { name: "查看安装与激活命令", exact: true }));
  await expect(page).toHaveURL(/\/toolbox\/office$/);
  await expect(page.getByRole("heading", { name: "Office 安装与激活", exact: true })).toBeVisible();
  for (const [action, label] of Object.entries(actions)) {
    await activate(page.getByRole("button", { name: new RegExp(`^${label}`) }));
    for (const terminal of ["powershell", "cmd"] as const) {
      await activate(page.getByRole("button", { name: terminal === "cmd" ? "CMD" : "PowerShell", exact: true }));
      await expect(page.locator(".segmented-control__active")).toHaveText(terminal === "cmd" ? "CMD" : "PowerShell");
      const command = await page.locator("pre code").textContent();
      expect(command).not.toBeNull();
      expect(sha(command!)).toBe(digests[action as keyof typeof digests][terminal]);
      const download = page.getByRole("link", { name: "下载命令文本", exact: true });
      await expect(download).toHaveAttribute("href", `/toolbox/office/${action}-${terminal}.txt`);
      const response = await request.get(`/toolbox/office/${action}-${terminal}.txt`);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("text/plain");
      expect((await response.text()).trimEnd()).toBe(command);
      const payload = command!.match(/FromBase64String\('([^']+)'\)/)?.[1];
      expect(payload).toBeDefined();
      const sourceResponse = await request.get(`/toolbox/office/${action}-source.ps1.txt`);
      expect(sourceResponse.ok()).toBe(true);
      const source = (await sourceResponse.text()).replace(/^\uFEFF/, "");
      expect(gunzipSync(Buffer.from(payload!, "base64")).toString("utf8").replace(/^\uFEFF/, "")).toBe(source);
      if (action === "reinstall") expect(sha(await sourceResponse.body())).toBe("f476281a3e0c06ac3d80ae4987151a443f1627083ef0fea6fe68c05cb03276e4");
      else {
        expect(source).toContain("Join-Path $env:TEMP ('chinatech-office-' + [guid]::NewGuid()");
        expect(source).not.toContain("~/all.ps1");
        expect(source).toContain("54eee267d8bf4d52bd2db19b55a503917efaa9d4951e949f2ae22c088b621723");
      }
      await activate(page.getByRole("button", { name: "复制完整命令", exact: true }));
      await expect(page.getByRole("status")).toHaveText("命令已复制，请在所选管理员终端中粘贴。");
      expect(await page.evaluate(() => (window as unknown as { officeCopied: string }).officeCopied)).toBe(command);
    }
  }
  await activate(page.locator("header").getByRole("link", { name: "返回工具箱", exact: true }));
  await expect(page).toHaveURL(/\/toolbox$/);
  expect(errors).toEqual([]);
});

test("Clipboard rejection and missing API show failure and preserve retry", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { reject: true, writes: [] as string[] };
    (window as unknown as { officeClipboard: typeof state }).officeClipboard = state;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { if (state.reject) throw new DOMException("Denied", "NotAllowedError"); state.writes.push(text); } } });
  });
  await page.goto("/toolbox/office");
  await activate(page.getByRole("button", { name: "CMD", exact: true }));
  await expect(page.getByRole("button", { name: "CMD", exact: true })).toHaveAttribute("aria-pressed", "true");
  await activate(page.getByRole("button", { name: "PowerShell", exact: true }));
  await expect(page.getByRole("button", { name: "PowerShell", exact: true })).toHaveAttribute("aria-pressed", "true");
  const copy = page.getByRole("button", { name: "复制完整命令", exact: true });
  await copy.focus();
  await expect(copy).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("main").getByRole("alert")).toContainText("复制失败");
  await expect(page.getByRole("button", { name: "已复制完整命令", exact: true })).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { officeClipboard: { reject: boolean } }).officeClipboard.reject = false; });
  await activate(copy);
  await expect(page.getByRole("status")).toContainText("命令已复制");
  expect(sha(await page.evaluate(() => (window as unknown as { officeClipboard: { writes: string[] } }).officeClipboard.writes[0]))).toBe(digests.install.powershell);
  await activate(page.getByRole("button", { name: "CMD", exact: true }));
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }); });
  await activate(page.getByRole("button", { name: "复制完整命令", exact: true }));
  await expect(page.locator("main").getByRole("alert")).toContainText("复制失败");
  await expect(page.getByRole("link", { name: "下载命令文本", exact: true })).toHaveAttribute("href", "/toolbox/office/install-cmd.txt");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("Late clipboard result cannot claim success for a newly selected operation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>(resolve => { (window as unknown as { officeResolveCopy: () => void }).officeResolveCopy = resolve; }) } });
  });
  await page.goto("/toolbox/office");
  await activate(page.getByRole("button", { name: "复制完整命令", exact: true }));
  await expect(page.getByRole("button", { name: "正在复制…", exact: true })).toBeDisabled();
  await activate(page.getByRole("button", { name: /^仅卸载/ }));
  await activate(page.getByRole("button", { name: "CMD", exact: true }));
  await page.evaluate(() => (window as unknown as { officeResolveCopy: () => void }).officeResolveCopy());
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "复制完整命令", exact: true })).toBeEnabled();
  expect(sha((await page.locator("pre code").textContent())!)).toBe(digests.uninstall.cmd);
});
