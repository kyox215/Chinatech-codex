import { test, expect } from "@playwright/test";
import { languageStorageKey } from "../../lib/i18n/locale";

test("language selection waits for hydration and preserves the first chosen preference", async ({ page }) => {
  let release: () => void = () => {};
  const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(({ key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, "en"); }, { key: languageStorageKey });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => { await scripts; await route.continue(); });
  const select = page.getByLabel("语言 / Lingua / Language", { exact: true });
  try {
    await page.goto("/register", { waitUntil: "commit" });
    await expect(select).toBeVisible();
    await expect(select).toBeDisabled();
  } finally { release(); }
  await page.waitForLoadState("load");
  await expect(select).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await select.selectOption("it");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(select).toHaveValue("it");
  await page.reload();
  await expect(select).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
});
