import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryLifecycleValidationSummary } from "@/features/inventory/lifecycle/components/inventory-lifecycle-field-feedback";
import { formatInventoryLifecycleDate } from "@/features/inventory/lifecycle/model/inventory-lifecycle-i18n";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

import { InventoryAvailabilityStateCard } from "./inventory-availability-state-card";
import { InventoryConflictPanel } from "./inventory-conflict-panel";
import { InventoryNoActionGuidanceCard } from "./inventory-no-action-guidance-card";
import { InventoryOperationErrorPanel } from "./inventory-operation-error-panel";
import { InventoryOperationReceiptPanel } from "./inventory-operation-receipt-panel";
import { InventoryReadFreshnessPanel } from "./inventory-read-freshness-panel";
import { InventorySyncStatusPanel } from "./inventory-sync-status-panel";

afterEach(cleanup);

const locales = ["zh-CN", "it-IT", "en"] as const;

describe("inventory detail read-state panels i18n", () => {
  it.each(locales)(
    "renders validation, pending, safe error, conflict, receipt and sync chrome in %s",
    (locale) => {
      const t = (key: Parameters<typeof translateMessage>[1]) => translateMessage(locale, key);
      render(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleValidationSummary
            issues={[{ fieldId: "battery", label: "Battery Health", message: "SAFE-VALIDATION" }]}
          />
          <InventoryConflictPanel
            conflict={{
              status: 409,
              code: "stale_version",
              kind: "version",
              title: "RAW-CONFLICT-TITLE",
              description: "RAW-CONFLICT-DESCRIPTION",
              copySource: "structured-error",
            }}
            preserveDraft
            pending
            onRecover={vi.fn()}
          />
          <InventoryOperationErrorPanel
            error={{
              kind: "outcome-unknown",
              subtype: "connectivity",
              status: 408,
              code: "RAW-ERROR-CODE",
            }}
            verificationStatus="verifying"
            onVerify={vi.fn()}
          />
          <InventoryOperationReceiptPanel
            receipt={{
              command: "inspection.save",
              kind: "confirmed",
              replayed: false,
              title: "RAW-RECEIPT-TITLE",
              description: "RAW-RECEIPT-DESCRIPTION",
              ledgerSemantics: "RAW-LEDGER",
              nextStep: "RAW-NEXT",
            }}
          />
          <InventorySyncStatusPanel status="committed-refresh-failed" pending />
        </LocaleProvider>,
      );

      expect(screen.getByText(t("inventory2b4.validation.summary"))).toBeVisible();
      expect(
        screen.getByRole("heading", { name: t("inventory2b4.conflict.version.title") }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", {
          name: t("inventory2b4.operationError.verifyingTitle"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", { name: t("inventory2b4.receipt.inspectionSave.title") }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", { name: t("inventory2b4.sync.failed.title") }),
      ).toBeVisible();
      expect(screen.getByText(t("inventory2b4.conflict.pending"))).toBeVisible();
      expect(screen.getByText(t("inventory2b4.operationError.verifyingStatus"))).toBeVisible();
      expect(screen.getByText(t("inventory2b4.operationReceipt.confirmed"))).toBeVisible();
      expect(document.body).not.toHaveTextContent(
        /RAW-CONFLICT|RAW-ERROR|RAW-RECEIPT|RAW-LEDGER|RAW-NEXT/,
      );
    },
  );

  it.each(locales)(
    "renders no-action, availability and freshness states with a locale-aware Rome date in %s",
    (locale) => {
      const t = (key: Parameters<typeof translateMessage>[1]) => translateMessage(locale, key);
      const lastSuccessAt = new Date("2026-10-25T01:30:00.000Z").getTime();
      render(
        <LocaleProvider initialLocale={locale}>
          <InventoryNoActionGuidanceCard
            guidance={{ state: "target-unavailable", targetCommand: "inspection.save" }}
          />
          <InventoryAvailabilityStateCard
            availability={{ state: "service-unavailable", retryable: true }}
            onRetry={vi.fn()}
          />
          <InventoryReadFreshnessPanel
            freshness={{ state: "stale", hidden: false, lastSuccessAt }}
            onVerify={vi.fn()}
          />
        </LocaleProvider>,
      );

      expect(
        screen.getByRole("heading", {
          name: t("inventory2b4.noAction.title.targetUnavailable"),
        }),
      ).toBeVisible();
      expect(document.body).toHaveTextContent(
        translateMessage(locale, "inventory2b4.noAction.targetUnavailable", {
          action: translateMessage(locale, "inventory2b4.command.inspectionSave"),
        }),
      );
      expect(
        screen.getByRole("heading", {
          name: t("inventory2b4.availabilityCard.unavailable.title"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", { name: t("inventory2b4.freshnessCard.stale.title") }),
      ).toBeVisible();
      expect(document.body).toHaveTextContent(
        translateMessage(locale, "inventory2b4.freshnessCard.readTime", {
          date: formatInventoryLifecycleDate(lastSuccessAt, locale, (key, values) =>
            translateMessage(locale, key, values),
          ),
        }),
      );
    },
  );
});
