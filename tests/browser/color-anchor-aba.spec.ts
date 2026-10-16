import { test } from "@playwright/test";
import { colorAnchorABATitle } from "./helpers/color-picker-observation";
import { runColorAnchorABA } from "./helpers/color-anchor-aba";

if (process.env.SITE_UI_COLOR_ANCHOR_ABA === "1") {
  test(colorAnchorABATitle, async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    await runColorAnchorABA(browser, testInfo);
  });
}
