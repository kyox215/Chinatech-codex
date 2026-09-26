import { runEvidencePath } from "./helpers/evidence";
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  syntheticSalesDetail,
  syntheticSalesReceipt,
  syntheticSalesStore,
  syntheticSalesSummary,
} from "../../src/features/inventory/sales/ui/sales-ui.fixture";
import {
  syntheticSalesWorkflow,
  syntheticSalesDailyReport,
} from "../../src/features/inventory/sales/ui/sales-workflow-ui.fixture";
import type { InventorySalesWorkflowCommandBody } from "../../src/features/inventory/sales/model/workflow-contracts";
import { salesWorkflowCopy } from "../../src/features/inventory/sales/ui/sales-workflow-copy";
import { salesCopy } from "../../src/features/inventory/sales/ui/sales-copy";
import { translateMessage } from "../../src/shared/i18n/messages";
import type {
  InventorySalesCommandBody,
  InventorySalesDetail,
} from "../../src/features/inventory/sales/model/contracts";
import type { AppLocale } from "../../src/shared/i18n/locales";

if (process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1")
  throw new Error("Synthetic fixture server required; never run against production");
const evidence = resolve(runEvidencePath("sales-daily-workflow"));
test.describe.configure({ retries: 0 });

async function fixture(page: Page, locale: AppLocale, existingSale = false) {
  const summary = syntheticSalesSummary();
  let detail: InventorySalesDetail | null = existingSale ? syntheticSalesDetail() : null;
  const writes: InventorySalesCommandBody[] = [];
  const workflowWrites: InventorySalesWorkflowCommandBody[] = [];
  const workflow = syntheticSalesWorkflow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: locale, url: process.env.PLAYWRIGHT_BASE_URL! },
    ]);
  const activeStore = {
    id: syntheticSalesStore,
    name: "Synthetic Sales Lab",
    slug: "synthetic-sales",
    role: "owner",
    status: "active",
    membershipId: "80000000-0000-4000-8000-000000000001",
  };
  const storeContext = {
    activeStore,
    stores: [activeStore],
    activeStoreExplicit: true,
    permissions: {
      canReadSuppliers: false,
      canAssignSuppliers: false,
      canManageSuppliers: false,
      canReadInventory: true,
      canCreateInventory: true,
      canUpdateInventory: true,
      canSellInventory: true,
      inventoryProductsUiEnabled: true,
      inventoryProductQuickCreateEnabled: true,
      inventoryLifecycleUiEnabled: false,
      canInspectInventory: true,
      inventoryProductInspectionEnabled: true,
      canAllocateInventoryCosts: false,
    },
  };
  const customer = {
    id: "60000000-0000-4000-8000-000000000001",
    name: "Synthetic Customer",
    phone_e164: "+390000000001",
    phone_raw: "390000000001",
    contact_phones: [],
    consent_marketing: false,
    consent_sms: false,
  };
  const product = syntheticSalesReceipt().document!.product;
  await page.route("**/api/repairdesk/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/repairdesk/", "");
    const json = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "shell/bootstrap")
      return json({
        onboarding: {
          userId: "90000000-0000-4000-8000-000000000001",
          displayName: "Synthetic Operator",
          isPlatformAdmin: false,
          activeStore,
          stores: [activeStore],
          requests: [],
          availableStores: [],
        },
        storeContext,
        aiCapabilities: {
          canUseOrderAssistant: false,
          canUseOrderInlineActions: false,
          canUseVisionIntake: false,
          canApplyInventoryDraft: false,
          reason: "feature_off",
        },
        generatedAt: summary.item_updated_at,
      });
    if (path === "stores/context") return json(storeContext);
    if (path === "inventory/sales/workflow/read") return json(workflow);
    if (path === "inventory/sales/workflow/report") return json(syntheticSalesDailyReport());
    if (path === "inventory/sales/workflow/command") {
      const body = route.request().postDataJSON() as InventorySalesWorkflowCommandBody;
      workflowWrites.push(body);
      if (body.expected_workflow_version !== workflow.workflow.version)
        return route.fulfill({ status: 409, json: { error: "Stale", code: "stale_version" } });
      const now = new Date().toISOString();
      if (body.command === "fiscal.record")
        workflow.workflow.fiscal = {
          revision: (workflow.workflow.fiscal?.revision ?? 0) + 1,
          ...body.payload,
          recorded_at: now,
          verified_at: null,
          verified_by_name: null,
        };
      if (body.command === "fiscal.verify") {
        workflow.workflow.fiscal!.verified_at = now;
        workflow.workflow.fiscal!.verified_by_name = "Synthetic Operator";
      }
      if (body.command === "followup.set")
        workflow.workflow.followup = {
          ...body.payload,
          note: body.payload.note ?? null,
          assignee_name: body.payload.assignee_membership_id ? "Synthetic Operator" : null,
        };
      if (body.command === "issue.open")
        workflow.workflow.issues.push({
          id: "a0000000-0000-4000-8000-000000000001",
          ...body.payload,
          status: "open",
          opened_at: now,
          resolved_at: null,
          resolution: null,
        });
      if (body.command === "issue.resolve") {
        const issue = workflow.workflow.issues.find((issue) => issue.id === body.payload.issue_id)!;
        issue.status = "resolved";
        issue.resolved_at = now;
        issue.resolution = body.payload.resolution;
      }
      workflow.workflow.version += 1;
      return json({
        ok: true,
        code: "completed",
        sale_order_id: workflow.workflow.sale_order_id,
        workflow_version: workflow.workflow.version,
        event_id: "b0000000-0000-4000-8000-000000000001",
      });
    }
    if (path === "inventory/sales/list") {
      const filter = route.request().postDataJSON();
      const current = detail ?? summary;
      const queue = detail?.order?.status ?? "available";
      const rows =
        filter.queue === "all" || filter.queue === queue
          ? [
              {
                ...current,
                product: { ...product, identifier: "•••• 3809" },
                customer: detail?.customer ?? null,
              },
            ]
          : [];
      return json({
        rows,
        counts: {
          all: 1,
          available: Number(queue === "available"),
          awaiting_payment: Number(queue === "awaiting_payment"),
          paid_pending_pickup: Number(queue === "paid_pending_pickup"),
          delivered: Number(queue === "delivered"),
        },
        total: rows.length,
        offset: 0,
        limit: 30,
        facets: { brands: ["Synthetic"], locations: [] },
        capabilities: current.capabilities,
      });
    }
    if (path === "inventory/products/get")
      return json({
        id: summary.inventory_item_id,
        sku: product.sku,
        category: "phone",
        brand: "Synthetic",
        model: "Phone",
        status: detail?.order?.status === "delivered" ? "sold" : detail ? "reserved" : "in_stock",
        list_price: 100,
        currency_code: "EUR",
        specification: "256 GB · Silver",
        masked_identifier: "•••• 3809",
        identifiers: [{ kind: "imei1", masked_value: "•••• 3809", primary: true }],
        created_at: summary.item_updated_at,
        updated_at: summary.item_updated_at,
        storage_capacity: "256 GB",
        ram_capacity: "8 GB",
        color: "Silver",
        condition: "A",
        specifications: {},
        notes: "Synthetic data only",
        version: 1,
      });
    if (path === "inventory/sales/summary") return json(detail ?? summary);
    if (path === "inventory/sales/detail") return json(detail);
    if (path === "customers/intake-search")
      return json([{ customer, exactMatch: false, nameMatchKind: "prefix", historyDevices: [] }]);
    if (path === "inventory/sales/receipt") {
      const input = route.request().postDataJSON();
      const receipt = syntheticSalesReceipt();
      receipt.kind = input.kind;
      receipt.document!.kind = input.kind;
      receipt.document!.order = { ...detail!.order! };
      receipt.document!.payments = detail!.payments;
      receipt.document!.warranty = detail!.warranty;
      if (input.kind === "payment") {
        const payment = detail!.payments.find((p) => p.id === input.payment_id)!;
        receipt.document!.payment_id = payment.id;
        receipt.document!.payments = detail!.payments.filter((p) => p.sequence <= payment.sequence);
        Object.assign(receipt.document!.order, {
          paid_cents: payment.paid_after_cents,
          balance_cents: payment.balance_after_cents,
          delivered_at: null,
          status: payment.balance_after_cents ? "awaiting_payment" : "paid_pending_pickup",
        });
        receipt.document!.warranty = null;
      } else delete receipt.document!.payment_id;
      return json(receipt);
    }
    if (path === "inventory/sales/command") {
      const body = route.request().postDataJSON() as InventorySalesCommandBody;
      writes.push(body);
      if (body.command === "sale.create") {
        detail = syntheticSalesDetail();
        detail.order = {
          ...detail.order!,
          agreed_at: body.payload.agreed_at,
          paid_cents: body.payload.payment.amount_cents,
          balance_cents: body.payload.price_cents - body.payload.payment.amount_cents,
          price_cents: body.payload.price_cents,
        };
        detail.payments = [
          {
            ...detail.payments[0],
            ...body.payload.payment,
            paid_after_cents: detail.order.paid_cents,
            balance_after_cents: detail.order.balance_cents,
          },
        ];
      } else if (body.command === "payment.append") {
        detail!.order!.paid_cents += body.payload.payment.amount_cents;
        detail!.order!.balance_cents -= body.payload.payment.amount_cents;
        detail!.payments.push({
          ...detail!.payments[0],
          ...body.payload.payment,
          id: "70000000-0000-4000-8000-000000000002",
          sequence: 2,
          receipt_number: "P-SYNTHETIC-002",
          paid_after_cents: detail!.order!.paid_cents,
          balance_after_cents: detail!.order!.balance_cents,
        });
      }
      const delivered = body.command === "pickup.confirm" || body.payload.deliver;
      detail!.order!.version += 1;
      detail!.unit_version = detail!.unit_version! + 1;
      detail!.order!.status = delivered
        ? "delivered"
        : detail!.order!.balance_cents
          ? "awaiting_payment"
          : "paid_pending_pickup";
      detail!.allowed_actions = delivered
        ? []
        : detail!.order!.balance_cents
          ? ["payment.append"]
          : ["pickup.confirm"];
      if (delivered) {
        detail!.order!.delivered_at = body.payload.delivered_at!;
        const date = new Date(body.payload.delivered_at!);
        const starts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Rome",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
        detail!.warranty = {
          starts_at: body.payload.delivered_at!,
          starts_on: starts,
          ends_on: `${Number(starts.slice(0, 4)) + 2}${starts.slice(4)}`,
          months: 24,
        };
        detail!.capabilities.print_kinds = ["sale", "payment", "warranty"];
      }
      return json({
        ok: true,
        code: "completed",
        sale_order_id: detail!.order!.id,
        inventory_item_id: summary.inventory_item_id,
        stock_unit_id: summary.stock_unit_id,
        item_updated_at: summary.item_updated_at,
        unit_version: detail!.unit_version,
        order_version: detail!.order!.version,
        paid_cents: detail!.order!.paid_cents,
        balance_cents: detail!.order!.balance_cents,
        status: detail!.order!.status,
      });
    }
    if (path.startsWith("inventory/lifecycle"))
      throw new Error("Legacy lifecycle must remain dormant");
    return route.continue();
  });
  return { summary, writes, workflowWrites, errors };
}

for (const [index, width] of [390, 430, 768, 1024, 1280, 1440].entries()) {
  const locale: AppLocale = ["zh-CN", "it-IT", "en"][index % 3] as AppLocale;
  test(`sales page and transaction controls ${width}px ${locale}`, async ({ page }) => {
    await mkdir(evidence, { recursive: true });
    const { summary, writes, errors } = await fixture(page, locale);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/inventory");
    await expect(page.getByText("Synthetic Phone").filter({ visible: true }).first()).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: resolve(evidence, `sales-list-${width}.png`), fullPage: true });
    await page.goto(`/inventory/${summary.inventory_item_id}`);
    const sales = page.locator('[data-ui="inventory-sales-workspace"]');
    await sales.getByRole("button", { name: salesCopy(locale, "sell") }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: salesCopy(locale, "review"), exact: true }),
    ).toBeDisabled();
    await expectNoOverflow(page);
    await expect(dialog).toBeVisible();
    const note = dialog.getByLabel(salesCopy(locale, "note"), { exact: true });
    await note.fill("SYNTHETIC unsaved sale note");
    await expect(note).toHaveValue("SYNTHETIC unsaved sale note");
    await page.screenshot({
      path: resolve(evidence, `sales-transaction-${width}.png`),
      fullPage: false,
      animations: "disabled",
      style: "nextjs-portal { visibility: hidden !important; }",
    });
    await dialog
      .locator("[data-editor-footer]")
      .getByRole("button", { name: salesCopy(locale, "cancel"), exact: true })
      .click();
    await dialog.getByRole("button", { name: salesCopy(locale, "discard"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await sales.getByRole("button", { name: salesCopy(locale, "inspect"), exact: true }).click();
    const inspection = page.getByRole("dialog");
    const grade = inspection.getByLabel(salesCopy(locale, "cosmetic_grade"), { exact: true });
    await grade.selectOption("fair");
    await expect(grade).toHaveValue("fair");
    await expectNoOverflow(page);
    await page.screenshot({
      path: resolve(evidence, `sales-inspection-${width}.png`),
      fullPage: false,
      animations: "disabled",
      style: "nextjs-portal { visibility: hidden !important; }",
    });
    await inspection
      .locator("[data-editor-footer]")
      .getByRole("button", { name: salesCopy(locale, "cancel"), exact: true })
      .click();
    await expect(inspection).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("actual UI wrappers: deposit, balance held, pickup and historical receipt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { summary, writes, errors } = await fixture(page, "en");
  await page.goto(`/inventory/${summary.inventory_item_id}`);
  const sales = page.locator('[data-ui="inventory-sales-workspace"]');
  await sales.getByRole("button", { name: "Sell / take deposit" }).click();
  await page
    .getByRole("combobox", { name: translateMessage("en", "orders2b1.new.lookup.nameAria") })
    .fill("Synthetic");
  await page.getByRole("option").filter({ hasText: "Synthetic Customer" }).first().click();
  await page.getByLabel("This payment (€)", { exact: true }).fill("30.00");
  await page.getByRole("button", { name: "Review transaction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "View sale", exact: true }).click();
  await expect(sales.getByRole("button", { name: "Add payment" })).toBeVisible();
  expect(writes[0]).toMatchObject({
    command: "sale.create",
    payload: { deliver: false, payment: { amount_cents: 3000 } },
  });
  await sales.getByRole("button", { name: "Add payment" }).click();
  await page.getByRole("button", { name: "Review transaction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "View sale", exact: true }).click();
  await expect(sales.getByRole("button", { name: "Confirm delivery" })).toBeVisible();
  await expect(sales.getByText(/Warranty has not started/)).toBeVisible();
  await sales.getByRole("button", { name: "Confirm delivery" }).click();
  await page.getByLabel(/Confirm actual handover/).check();
  await page.getByRole("button", { name: "Review transaction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "View sale", exact: true }).click();
  await expect(sales.getByRole("button", { name: "Warranty certificate" })).toBeVisible();
  await sales.getByRole("button", { name: "Payment receipt", exact: true }).first().click();
  const receipt = page.locator('[data-ui="sales-document-preview"]');
  await expect(receipt.getByText("HISTORICAL Synthetic Lab")).toBeVisible();
  await expect(receipt.getByText("70,00 €", { exact: true })).toBeVisible();
  await expect(receipt.locator('[lang="it"]')).toHaveCount(1);
  await page.screenshot({
    path: resolve(evidence, "sales-historical-payment.png"),
    fullPage: true,
  });
  expect(writes.map((body) => body.command)).toEqual([
    "sale.create",
    "payment.append",
    "pickup.confirm",
  ]);
  expect(errors).toEqual([]);
});
async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

for (const [width, height, locale] of [
  [390, 844, "zh-CN"],
  [768, 1024, "it-IT"],
  [1440, 900, "en"],
] as const) {
  test(`daily sales follow-up complete workflow ${width}px ${locale}`, async ({ page }) => {
    await mkdir(evidence, { recursive: true });
    await page.setViewportSize({ width, height });
    const { summary, workflowWrites, writes, errors } = await fixture(page, locale, true);
    const t = (key: Parameters<typeof salesWorkflowCopy>[1]) => salesWorkflowCopy(locale, key);
    const c = (key: Parameters<typeof salesCopy>[1]) => salesCopy(locale, key);
    await page.goto(`/inventory/${summary.inventory_item_id}`);
    const panel = page.locator('[data-ui="sales-followup"]');
    await panel.getByRole("button", { name: t("record"), exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(t("reference"), { exact: true }).fill("SYNTHETIC-001");
    await dialog.getByRole("button", { name: c("save"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByText(/SYNTHETIC-001/)).toBeVisible();
    await panel.getByRole("button", { name: t("verify"), exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: c("save"), exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: t("verify"), exact: true })).toHaveCount(0);
    await panel.getByRole("button", { name: t("correct"), exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(t("reference"), { exact: true }).fill("SYNTHETIC-002");
    await dialog.getByLabel(t("reason"), { exact: true }).fill("SYNTHETIC reference correction");
    await dialog.getByRole("button", { name: c("save"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByRole("button", { name: t("verify"), exact: true })).toBeVisible();
    await panel.getByRole("button", { name: t("followup"), exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t("assignee"), { exact: true })
      .selectOption({ label: "Synthetic Operator" });
    await dialog.getByLabel(t("due"), { exact: true }).fill("2026-09-27T10:00");
    await dialog.getByLabel(t("note"), { exact: true }).fill("SYNTHETIC arrange collection");
    await dialog.getByRole("button", { name: c("save"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByText("SYNTHETIC arrange collection", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: t("openIssue"), exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(t("issueKind"), { exact: true }).selectOption("payment_mismatch");
    await dialog.getByLabel(t("summary"), { exact: true }).fill("SYNTHETIC manual cash check");
    await dialog.getByRole("button", { name: c("save"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await panel.getByRole("button", { name: t("resolve"), exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t("resolution"), { exact: true })
      .fill("SYNTHETIC checked against register R-001");
    await dialog.getByRole("button", { name: c("save"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByText(/SYNTHETIC checked against register R-001/)).toBeVisible();
    await expectNoOverflow(page);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(evidence, `followup-${width}.png`),
      animations: "disabled",
    });
    await page.reload();
    await expect(panel.getByText(/SYNTHETIC-002/)).toBeVisible();
    await page.goto("/inventory");
    await page.getByRole("button", { name: t("report"), exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator('[data-ui="sales-daily-report"]')).toBeVisible();
    await expect(dialog.getByText(new RegExp(t("receipts")))).toBeVisible();
    await expectNoOverflow(page);
    if (width === 768) {
      await page.setViewportSize({ width: 1024, height: 768 });
      await expectNoOverflow(page);
    }
    await page.screenshot({
      path: resolve(evidence, `daily-report-${width}.png`),
      animations: "disabled",
    });
    await dialog.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/inventory/${summary.inventory_item_id}$`));
    expect(workflowWrites.map(({ command }) => command)).toEqual([
      "fiscal.record",
      "fiscal.verify",
      "fiscal.record",
      "followup.set",
      "issue.open",
      "issue.resolve",
    ]);
    expect(
      workflowWrites.map(({ expected_workflow_version }) => expected_workflow_version),
    ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
