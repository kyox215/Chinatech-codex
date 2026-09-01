import { chromium } from "playwright";

const baseURL = "https://www.chinatech.in";
const screenshotDir =
  ".ai-company/memory/tasks/TASK-20260901-001-project-site-language-health-audit/screenshots";

function sanitizedPath(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

async function waitForStyledShell(page) {
  await page.waitForFunction(() => {
    const shell = document.querySelector("#repairdesk-styled-shell");
    return shell instanceof HTMLElement && getComputedStyle(shell).display !== "none";
  });
}

async function pageState(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dataLocale: document.documentElement.dataset.locale,
    title: document.title,
    url: location.href,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    bodyHanCharacters: (document.body.innerText.match(/\p{Script=Han}/gu) ?? []).length,
    bodyTextSample: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 600),
  }));
}

async function localeCookie(context) {
  return (await context.cookies()).find((cookie) => cookie.name === "repairdesk_locale")?.value;
}

async function selectLocale(page, visibleName, expectedLocale) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]');
  const triggerBefore = await trigger.getAttribute("aria-label");
  await trigger.click();
  const option = page.getByRole("menuitemradio", { name: visibleName });
  await option.click();
  await page.waitForFunction((locale) => document.documentElement.lang === locale, expectedLocale);
  return { triggerBefore, triggerAfter: await trigger.getAttribute("aria-label") };
}

const browser = await chromium.launch({ headless: true });
const findings = { consoleErrors: [], pageErrors: [], failedRequests: [], checks: {} };

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktop.newPage();
  desktopPage.on("console", (message) => {
    if (message.type() === "error") findings.consoleErrors.push(message.text());
  });
  desktopPage.on("pageerror", (error) => findings.pageErrors.push(error.message));
  desktopPage.on("requestfailed", (request) =>
    findings.failedRequests.push({
      url: sanitizedPath(request.url()),
      failure: request.failure()?.errorText ?? "unknown",
    }),
  );

  await desktopPage.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await waitForStyledShell(desktopPage);
  findings.checks.loginDefaultDesktop = {
    ...(await pageState(desktopPage)),
    localeCookie: await localeCookie(desktop),
  };
  findings.checks.loginItalianSwitch = {
    ...(await selectLocale(desktopPage, "Italiano", "it-IT")),
    ...(await pageState(desktopPage)),
    localeCookie: await localeCookie(desktop),
  };
  await desktopPage.screenshot({
    path: `${screenshotDir}/production-login-it-desktop-1440.png`,
    fullPage: true,
  });
  await desktopPage.reload({ waitUntil: "domcontentloaded" });
  await waitForStyledShell(desktopPage);
  findings.checks.loginItalianReload = {
    ...(await pageState(desktopPage)),
    localeCookie: await localeCookie(desktop),
  };
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await waitForStyledShell(mobilePage);
  findings.checks.loginEnglishSwitchMobile = {
    ...(await selectLocale(mobilePage, "English", "en")),
    ...(await pageState(mobilePage)),
    localeCookie: await localeCookie(mobile),
  };
  await mobilePage.screenshot({
    path: `${screenshotDir}/production-login-en-mobile-390.png`,
    fullPage: true,
  });
  await mobile.close();

  const invalidCookie = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await invalidCookie.addCookies([{ name: "repairdesk_locale", value: "en-US", url: baseURL }]);
  const invalidCookiePage = await invalidCookie.newPage();
  await invalidCookiePage.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await waitForStyledShell(invalidCookiePage);
  findings.checks.invalidLocaleFallback = {
    ...(await pageState(invalidCookiePage)),
    localeCookie: await localeCookie(invalidCookie),
  };
  await invalidCookie.close();

  const customer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await customer.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  const customerPage = await customer.newPage();
  await customerPage.goto(`${baseURL}/r`, { waitUntil: "domcontentloaded" });
  await waitForStyledShell(customerPage);
  findings.checks.customerStatusBoundary = {
    ...(await pageState(customerPage)),
    languageSwitcherCount: await customerPage
      .locator('[data-language-switcher-trigger="true"]')
      .count(),
    localeCookieAfterRequest: await localeCookie(customer),
  };
  await customerPage.screenshot({
    path: `${screenshotDir}/production-customer-status-it-mobile-390.png`,
    fullPage: true,
  });
  await customer.close();

  const kiosk = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await kiosk.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  const kioskPage = await kiosk.newPage();
  await kioskPage.goto(`${baseURL}/kiosk`, { waitUntil: "domcontentloaded" });
  await waitForStyledShell(kioskPage);
  findings.checks.kioskBoundary = {
    ...(await pageState(kioskPage)),
    languageSwitcherCount: await kioskPage
      .locator('[data-language-switcher-trigger="true"]')
      .count(),
    localeCookieAfterRequest: await localeCookie(kiosk),
  };
  await kioskPage.screenshot({
    path: `${screenshotDir}/production-kiosk-it-tablet-768.png`,
    fullPage: true,
  });
  await kiosk.close();

  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
} finally {
  await browser.close();
}
