import type { QueryClient } from "@tanstack/react-query";
import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import {
  REPAIRDESK_OFFLINE_DATABASE_NAME,
  REPAIRDESK_OFFLINE_SCHEMA_VERSION,
  repairDeskOfflineStoreIndexes,
  repairDeskOfflineStoreKeyPaths,
  repairDeskOfflineStoreNames,
} from "../../src/features/offline/model/offline-types";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires the isolated RepairDesk synthetic fixture server.",
);

const rootSelector = '[data-new-order-root="true"]';
const cardSelector = '[data-new-order-offline-restore-card="true"]';
const inputSelector = 'input[role="combobox"][aria-label="客户姓名"]';
const typedValue = "Synthetic typed";
type SyntheticPrefill = { customerId?: string; deviceId?: string; imei?: string };

type StabilityProbe = {
  client: QueryClient;
  root: Element;
  card: Element;
  input: HTMLInputElement;
  draftReads: number;
};

declare global {
  interface Window {
    __newOrderStability: StabilityProbe;
    __newOrderStabilityHooked?: boolean;
  }
}

for (const width of [390, 820, 1440]) {
  test(`keeps a found draft, active input and editor stable at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
    const blockedExternal: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL).origin) {
        blockedExternal.push(url.origin);
        return route.abort();
      }
      return route.continue();
    });
    await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL }]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/repairdesk/customer/get", async (route) => {
      const { id } = route.request().postDataJSON() as { id: string };
      expect(["synthetic-customer-1", "synthetic-customer-2"]).toContain(id);
      await route.fulfill({
        json: {
          data: {
            customer: { id, name: `Synthetic ${id}`, phone_e164: "3440000011" },
            devices: [1, 2].map((index) => ({
              id: `synthetic-device-${index}`,
              brand: "Synthetic",
              model: `Model ${index}`,
              serial_or_imei: `SYNTHETIC-${index}`,
            })),
            orders: [],
            tags: [],
            interactions: [],
            followups: [],
            stats: { order_count: 0, device_count: 2 },
          },
        },
      });
    });
    await page.goto("/orders", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-order-list-refreshing]")).toBeVisible();
    await seedSyntheticDraft(page);
    await replaceIntent(page, "synthetic-session-1");
    await expect(page.locator(cardSelector)).toBeVisible();
    if (width < 768) await page.locator('[data-mobile-edit="customer"]').click();
    const input = page.locator(inputSelector);
    await expect(input).toBeVisible();
    await input.fill(typedValue);
    await attachStabilityProbe(page);

    const samples = await page.evaluate(
      async ({ rootSelector, cardSelector, inputSelector, typedValue }) => {
        const samples: {
          at: number;
          found: boolean;
          sameRoot: boolean;
          sameCard: boolean;
          sameInput: boolean;
          value: string;
          checking: boolean;
        }[] = [];
        const probe = window.__newOrderStability;
        const started = performance.now();
        let running = true;
        const sample = () => {
          const currentInput = document.querySelector<HTMLInputElement>(inputSelector);
          samples.push({
            at: Math.round(performance.now() - started),
            found: Boolean(document.querySelector(cardSelector)),
            sameRoot: document.querySelector(rootSelector) === probe.root,
            sameCard: document.querySelector(cardSelector) === probe.card,
            sameInput: currentInput === probe.input,
            value: currentInput?.value ?? "",
            checking: Array.from(document.querySelectorAll("[data-new-order-offline-status]")).some(
              (element) => element.textContent?.includes("正在检查本机草稿"),
            ),
          });
          if (running) requestAnimationFrame(sample);
        };
        sample();
        for (let index = 0; index < 30; index++) {
          const params =
            index % 2
              ? new URLSearchParams({
                  q: `synthetic-${index}`,
                  source: "command",
                  intakeSession: "synthetic-session-1",
                  workspace: "new-order",
                })
              : new URLSearchParams({
                  workspace: "new-order",
                  intakeSession: "synthetic-session-1",
                  source: "mobile",
                  q: `synthetic-${index}`,
                });
          window.history.replaceState(null, "", `/orders?${params}`);
          await new Promise((resolve) => setTimeout(resolve, 167));
        }
        running = false;
        return { samples, extraDraftReads: probe.draftReads, expectedValue: typedValue };
      },
      { rootSelector, cardSelector, inputSelector, typedValue },
    );
    const samplePath = testInfo.outputPath("continuous-draft-state-samples.json");
    await writeFile(samplePath, JSON.stringify(samples));
    await testInfo.attach("continuous-draft-state-samples", {
      path: samplePath,
      contentType: "application/json",
    });
    expect(samples.samples.length).toBeGreaterThan(60);
    expect(
      samples.samples.every(
        (sample) =>
          sample.found &&
          sample.sameRoot &&
          sample.sameCard &&
          sample.sameInput &&
          !sample.checking &&
          sample.value === typedValue,
      ),
    ).toBe(true);
    expect(samples.extraDraftReads).toBe(0);

    // A new semantic intake must not apply a new customer/device over an old
    // quote, deposit or note. Each transition gets exactly one fresh editor.
    const semanticTransitions: SyntheticPrefill[] = [
      {},
      { customerId: "synthetic-customer-1", deviceId: "synthetic-device-1" },
      { customerId: "synthetic-customer-2", deviceId: "synthetic-device-2" },
      {
        customerId: "synthetic-customer-2",
        deviceId: "synthetic-device-2",
        imei: "SYNTHETIC-NEW-IDENTIFIER",
      },
      {},
    ];
    const transitionEvidence = [];
    for (const prefill of semanticTransitions) {
      if (width < 768) {
        await page.getByRole("button", { name: "完成", exact: true }).click();
        await expect(page.locator('[data-mobile-editor="true"]')).toHaveCount(0);
      }
      await page.getByRole("button", { name: "添加自定义项目", exact: true }).click();
      await page.getByRole("textbox", { name: "报价项目 1 金额", exact: true }).fill("77");
      await page.getByRole("textbox", { name: "定金", exact: true }).fill("17");
      if (width < 768) await page.locator('[data-mobile-edit="notes"]').click();
      await page.getByRole("textbox", { name: "备注", exact: true }).fill("Synthetic old note");
      if (width < 768) {
        await page.getByRole("button", { name: "完成", exact: true }).click();
        await expect(page.locator('[data-mobile-editor="true"]')).toHaveCount(0);
      }
      await replaceIntent(page, "synthetic-session-2", "", prefill);
      await expect
        .poll(() =>
          page.evaluate((selector) => {
            const root = document.querySelector(selector);
            return Boolean(root && root !== window.__newOrderStability.root);
          }, rootSelector),
        )
        .toBe(true);
      await expect(page.locator(cardSelector)).toBeVisible();
      await expect(page.getByRole("textbox", { name: "报价项目 1 金额", exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByRole("textbox", { name: "定金", exact: true })).toHaveValue(
        /^(?:0(?:\.0+)?)?$/,
      );
      if (width < 768) {
        await expect(page.locator('[data-mobile-edit="notes"]')).toHaveText("备注 · 选填");
        if (prefill.customerId)
          await expect(page.locator('[data-mobile-edit="customer"]')).toContainText(
            `Synthetic ${prefill.customerId}`,
          );
        if (prefill.deviceId)
          await expect(page.locator('[data-mobile-edit="device"]')).toContainText(
            prefill.deviceId.endsWith("1") ? "Model 1" : "Model 2",
          );
        await page.locator('[data-mobile-edit="customer"]').click();
      } else {
        await expect(page.getByRole("textbox", { name: "备注", exact: true })).toHaveValue("");
      }
      await expect(input).toHaveValue(prefill.customerId ? `Synthetic ${prefill.customerId}` : "");
      const reads = await page.evaluate(() => window.__newOrderStability.draftReads);
      expect(reads).toBe(1);
      transitionEvidence.push({
        prefill,
        freshEditor: true,
        clearedQuoteDepositNote: true,
        draftReads: reads,
      });
      await attachStabilityProbe(page);
      await input.fill("Synthetic replay");
      await replaceIntent(page, "synthetic-session-2", "replayed", prefill);
      await expect(page.locator('[data-order-list-refreshing="false"]')).toBeAttached();
      await expect(input).toHaveValue("Synthetic replay");
      await expectRetainedDom(page);
      expect(await page.evaluate(() => window.__newOrderStability.draftReads)).toBe(0);
    }
    const transitionPath = testInfo.outputPath("semantic-intake-transitions.json");
    await writeFile(transitionPath, JSON.stringify(transitionEvidence));
    await testInfo.attach("semantic-intake-transitions", {
      path: transitionPath,
      contentType: "application/json",
    });

    // Reset the real active list query while delaying its synthetic response.
    // Onboarding, store scope and permission metadata are unchanged.
    // Wait until the changed search query has data, rather than resetting while
    // keepPreviousData is still carrying a placeholder from the previous query.
    await expect(page.locator('[data-order-list-refreshing="false"]')).toBeAttached();
    let releaseList: (() => void) | undefined;
    const responseGate = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
      await responseGate;
      await route.continue();
    });
    await page.evaluate(() => {
      void window.__newOrderStability.client.resetQueries({
        queryKey: ["orders", "queue-summary"],
      });
    });
    await expect(page.locator('[data-ui="order-list-skeleton"]')).toBeAttached();
    await expectRetainedDom(page);
    await input.fill("Synthetic pending");
    await page.screenshot({ path: testInfo.outputPath(`draft-pending-list-${width}.png`) });
    releaseList?.();
    await expect(page.locator('[data-ui="order-list-skeleton"]')).toHaveCount(0);
    await expectRetainedDom(page);
    await expect(input).toHaveValue("Synthetic pending");
    expect(await page.evaluate(() => window.__newOrderStability.draftReads)).toBe(0);
    await expectNoOverflow(page);
    if (width < 768) {
      await page.getByRole("button", { name: "完成", exact: true }).click();
      await expect(page.locator('[data-mobile-editor="true"]')).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`draft-found-stable-${width}.png`) });

    // A found draft always requires a decision, so cancellation is independent
    // of whether a later edited draft is inside its autosave debounce window.
    await page.getByRole("button", { name: "关闭新建维修工单", exact: true }).click();
    const guard = page.locator('[data-navigation-guard-dialog="true"]');
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "取消", exact: true }).click();
    await expect(guard).toHaveCount(0);
    await expect(page.locator(cardSelector)).toBeVisible();
    await page.getByRole("button", { name: "恢复本机草稿", exact: true }).click();
    await expect(page.locator(cardSelector)).toHaveCount(0);
    if (width < 768) await page.locator('[data-mobile-edit="customer"]').click();
    await expect(input).toHaveValue("Synthetic restored");
    await input.fill("Synthetic saved");
    if (width < 768) await page.getByRole("button", { name: "完成", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          (databaseName) =>
            new Promise<string>((resolve, reject) => {
              const request = indexedDB.open(databaseName);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const read = request.result
                  .transaction("repairdesk_order_drafts", "readonly")
                  .objectStore("repairdesk_order_drafts")
                  .get("synthetic-flicker-draft");
                read.onerror = () => reject(read.error);
                read.onsuccess = () => {
                  request.result.close();
                  resolve(read.result?.draftPayload?.customerName ?? "");
                };
              };
            }),
          REPAIRDESK_OFFLINE_DATABASE_NAME,
        ),
      )
      .toBe("Synthetic saved");
    await page.getByRole("button", { name: "关闭新建维修工单", exact: true }).click();
    await expect(page.locator(rootSelector)).toHaveCount(0);
    await expect(page).not.toHaveURL(/workspace=/);
    await replaceIntent(page, "synthetic-session-2");
    await expect(page.locator(cardSelector)).toBeVisible();
    expect(
      await page.evaluate(
        (rootSelector) => document.querySelector(rootSelector) !== window.__newOrderStability.root,
        rootSelector,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "丢弃本机草稿", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "丢弃本机草稿", exact: true })
      .getByRole("button", { name: "确认丢弃", exact: true })
      .click();
    await expect(page.locator(cardSelector)).toHaveCount(0);
    if (width < 768) await page.locator('[data-mobile-edit="customer"]').click();
    await expect(input).toHaveValue("");
    if (width < 768) {
      await page.getByRole("button", { name: "完成", exact: true }).click();
      await expect(page.locator('[data-mobile-editor="true"]')).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`draft-discarded-reopened-${width}.png`) });
    expect(errors).toEqual([]);
    expect(blockedExternal).toEqual([]);
  });
}

async function replaceIntent(
  page: Page,
  sessionId: string,
  query = "",
  prefill: SyntheticPrefill = {},
) {
  await page.evaluate(
    ({ sessionId, query, prefill }) => {
      const params = new URLSearchParams({
        workspace: "new-order",
        intakeSession: sessionId,
        ...prefill,
      });
      if (query) params.set("q", query);
      window.history.replaceState(null, "", `/orders?${params}`);
    },
    { sessionId, query, prefill },
  );
  await expect(page).toHaveURL(new RegExp(`intakeSession=${sessionId}`));
}

async function seedSyntheticDraft(page: Page) {
  const response = await page.request.get("/api/repairdesk/onboarding/status");
  const { data: onboarding } = await response.json();
  expect(onboarding.userId).toBe("repairdesk-e2e-system");
  expect(onboarding.activeStore.id).toBe("00000000-0000-0000-0000-000000000001");
  await page.evaluate(
    async ({ databaseName, schemaVersion, storeNames, keyPaths, indexes, scope }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName, schemaVersion);
        request.onupgradeneeded = () => {
          for (const name of storeNames) {
            const store = request.result.createObjectStore(name, { keyPath: keyPaths[name] });
            for (const index of indexes[name])
              store.createIndex(index.name, index.keyPath as string[]);
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const transaction = request.result.transaction("repairdesk_order_drafts", "readwrite");
          transaction.objectStore("repairdesk_order_drafts").put({
            localDraftId: "synthetic-flicker-draft",
            localOrderId: "synthetic-flicker-order",
            ...scope,
            mode: "create",
            draftPayload: {
              customerName: "Synthetic restored",
              customerPhone: "3440000011",
              deviceBrand: "Synthetic",
              deviceModel: "Synthetic model",
              deviceCustody: "with_shop",
            },
            customerLinkMode: "walk_in_snapshot_only",
            deviceLinkMode: "order_snapshot_only",
            hasSensitiveVaultEntry: false,
            attachmentStagingIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            status: "draft_local",
          });
          transaction.oncomplete = () => {
            request.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    {
      databaseName: REPAIRDESK_OFFLINE_DATABASE_NAME,
      schemaVersion: REPAIRDESK_OFFLINE_SCHEMA_VERSION,
      storeNames: repairDeskOfflineStoreNames,
      keyPaths: repairDeskOfflineStoreKeyPaths,
      indexes: repairDeskOfflineStoreIndexes,
      scope: { storeId: onboarding.activeStore.id, userId: onboarding.userId },
    },
  );
}

async function attachStabilityProbe(page: Page) {
  await page.evaluate(
    ({ rootSelector, cardSelector, inputSelector }) => {
      type Fiber = { return?: Fiber; memoizedProps?: { client?: QueryClient } };
      const root = document.querySelector(rootSelector)!;
      const fiberKey = Object.keys(root).find((key) => key.startsWith("__reactFiber$"))!;
      let fiber: Fiber | undefined = (root as unknown as Record<string, Fiber>)[fiberKey];
      while (fiber && !fiber.memoizedProps?.client?.resetQueries) fiber = fiber.return;
      const client = fiber?.memoizedProps?.client;
      if (!client) throw new Error("Synthetic query client was not found.");
      window.__newOrderStability = {
        client,
        root,
        card: document.querySelector(cardSelector)!,
        input: document.querySelector<HTMLInputElement>(inputSelector)!,
        draftReads: 0,
      };
      if (window.__newOrderStabilityHooked) return;
      const getAll = IDBIndex.prototype.getAll;
      IDBIndex.prototype.getAll = function (...args: Parameters<IDBIndex["getAll"]>) {
        if (this.objectStore.name === "repairdesk_order_drafts" && this.name === "by_scope_status")
          window.__newOrderStability.draftReads += 1;
        return getAll.apply(this, args);
      };
      window.__newOrderStabilityHooked = true;
    },
    { rootSelector, cardSelector, inputSelector },
  );
}

async function expectRetainedDom(page: Page) {
  expect(
    await page.evaluate(
      ({ rootSelector, cardSelector, inputSelector }) => {
        const probe = window.__newOrderStability;
        return (
          document.querySelector(rootSelector) === probe.root &&
          document.querySelector(cardSelector) === probe.card &&
          document.querySelector(inputSelector) === probe.input
        );
      },
      { rootSelector, cardSelector, inputSelector },
    ),
  ).toBe(true);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
