import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { buildOfficeCommand, signOfficeToken } from "../../../lib/toolbox/office-token";
import type { OfficeAction, OfficeTerminal } from "../../../lib/toolbox/office-commands";
const digest = createHash("sha256").update("Tutorial fixture only").digest("hex");
function token(action: OfficeAction) { return signOfficeToken({ v: 1, action, epoch: "1", digest }, Buffer.alloc(32, 17)); }
export function fixtureOfficeCommand(action: OfficeAction, terminal: OfficeTerminal, language: string) { return buildOfficeCommand("https://www.chinatech.in", token(action), digest, terminal, language); }
export async function mockOfficeGateway(page: Page) {
  await page.route("**/api/toolbox/office", async route => {
    const { action, terminal, language } = route.request().postDataJSON();
    await route.fulfill({ json: { action, terminal, version: "1", command: fixtureOfficeCommand(action, terminal, language), sourceUrl: "/api/toolbox/office/script?token=" + token(action) } });
  });
}
