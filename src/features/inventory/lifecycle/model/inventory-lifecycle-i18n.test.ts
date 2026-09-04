import { describe, expect, it } from "vitest";

import { resolveInventoryOperationReceipt } from "@/features/inventory/model/inventory-operation-receipt";
import {
  resolveInventoryLedgerTimeline,
  resolveInventoryMilestoneTimeline,
} from "@/features/inventory/lifecycle/model/inventory-lifecycle-timeline";
import { getInventoryLifecycleProjectionMeta } from "@/features/inventory/lifecycle/model/projection";
import type {
  InventoryLifecycleCommand,
  InventoryLifecycleProjection,
} from "@/lib/repairdesk/types";
import { translateMessage } from "@/shared/i18n/messages";

import {
  formatInventoryLifecycleDate,
  formatInventoryLifecycleMoney,
  localizeInventoryAfterSalesStatus,
  localizeInventoryCancelDisposition,
  localizeInventoryCoverage,
  localizeInventoryLifecycleCommand,
  localizeInventoryLifecycleConfidence,
  localizeInventoryLifecycleMode,
  localizeInventoryLifecycleStatus,
  localizeInventoryNoActionGuidance,
  localizeInventoryOperationReceipt,
  localizeInventoryPaymentKind,
  localizeInventoryPaymentMethod,
  localizeInventoryProjectionMeta,
  localizeInventoryTimeline,
  localizeInventoryWarrantyBasis,
} from "./inventory-lifecycle-i18n";

const locales = ["zh-CN", "it-IT", "en"] as const;
const t =
  (locale: (typeof locales)[number]) =>
  (key: Parameters<typeof translateMessage>[1], values?: Parameters<typeof translateMessage>[2]) =>
    translateMessage(locale, key, values);

const commands = [
  "acquisition.save",
  "inspection.save",
  "reservation.create",
  "payment.append",
  "sale.complete",
  "pickup.confirm",
  "reservation.cancel",
  "warranty.adjust",
  "after_sales.create",
  "after_sales.update",
  "after_sales.close",
] as const satisfies readonly InventoryLifecycleCommand[];

const receiptSegments: Record<InventoryLifecycleCommand, string> = {
  "acquisition.save": "acquisitionSave",
  "inspection.save": "inspectionSave",
  "reservation.create": "reservationCreate",
  "payment.append": "paymentAppend",
  "sale.complete": "saleComplete",
  "pickup.confirm": "pickupConfirm",
  "reservation.cancel": "reservationCancel",
  "warranty.adjust": "warrantyAdjust",
  "after_sales.create": "afterSalesCreate",
  "after_sales.update": "afterSalesUpdate",
  "after_sales.close": "afterSalesClose",
};

describe("inventory lifecycle i18n", () => {
  it.each([
    ["zh-CN", "追加付款", "待取货", "现金", "保修范围内", "待检测"],
    ["it-IT", "Aggiungi pagamento", "In attesa di ritiro", "Contanti", "Coperto", "Da ispezionare"],
    ["en", "Append payment", "Awaiting pickup", "Cash", "Covered", "Awaiting inspection"],
  ] as const)(
    "localizes stable lifecycle codes in %s",
    (locale, command, status, method, coverage, openStatus) => {
      expect(localizeInventoryLifecycleCommand("payment.append", "RAW", t(locale))).toBe(command);
      expect(localizeInventoryLifecycleStatus("sold_pending_pickup", "RAW", t(locale))).toBe(
        status,
      );
      expect(localizeInventoryLifecycleMode("exact", "RAW", t(locale))).not.toBe("RAW");
      expect(localizeInventoryLifecycleConfidence("high", "RAW", t(locale))).not.toBe("RAW");
      expect(localizeInventoryAfterSalesStatus("open", "RAW", t(locale))).toBe(openStatus);
      expect(localizeInventoryPaymentKind("deposit", "RAW", t(locale))).not.toBe("RAW");
      expect(localizeInventoryPaymentMethod("cash", "RAW", t(locale))).toBe(method);
      expect(localizeInventoryCancelDisposition("refund_pending", "RAW", t(locale))).not.toBe(
        "RAW",
      );
      expect(localizeInventoryCoverage("covered", "RAW", t(locale))).toBe(coverage);
      expect(localizeInventoryWarrantyBasis("legal", "RAW", t(locale))).not.toBe("RAW");
    },
  );

  it.each(locales)(
    "preserves unknown lifecycle and custom values byte-for-byte in %s",
    (locale) => {
      const raw = "  CUSTOM-动态-Δ  ";
      expect(localizeInventoryLifecycleCommand("future.command", raw, t(locale))).toBe(raw);
      expect(localizeInventoryLifecycleStatus("future_status", raw, t(locale))).toBe(raw);
      expect(localizeInventoryAfterSalesStatus("future_status", raw, t(locale))).toBe(raw);
      expect(localizeInventoryPaymentKind("custom_kind", raw, t(locale))).toBe(raw);
      expect(localizeInventoryPaymentMethod("custom_method", raw, t(locale))).toBe(raw);
      expect(localizeInventoryLifecycleMode("future_mode", raw, t(locale))).toBe(raw);
      expect(localizeInventoryLifecycleConfidence("future_confidence", raw, t(locale))).toBe(raw);
      expect(localizeInventoryCancelDisposition("custom_disposition", raw, t(locale))).toBe(raw);
      expect(localizeInventoryCoverage("custom_coverage", raw, t(locale))).toBe(raw);
      expect(localizeInventoryWarrantyBasis("custom_basis", raw, t(locale))).toBe(raw);
    },
  );

  it.each(locales)("covers every stable lifecycle mapping in %s", (locale) => {
    const translator = t(locale);
    const expectKnown = (values: readonly string[], localize: (code: string) => string) => {
      for (const value of values) expect(localize(value)).not.toBe("RAW");
    };
    expectKnown(commands, (code) => localizeInventoryLifecycleCommand(code, "RAW", translator));
    expectKnown(
      [
        "processing",
        "in_stock",
        "reserved",
        "sold_pending_pickup",
        "delivered",
        "after_sales",
        "removed",
      ],
      (code) => localizeInventoryLifecycleStatus(code, "RAW", translator),
    );
    expectKnown(["exact", "compatible", "unavailable"], (code) =>
      localizeInventoryLifecycleMode(code, "RAW", translator),
    );
    expectKnown(["high", "medium", "low"], (code) =>
      localizeInventoryLifecycleConfidence(code, "RAW", translator),
    );
    expectKnown(["open", "in_progress", "waiting_customer", "returned", "closed"], (code) =>
      localizeInventoryAfterSalesStatus(code, "RAW", translator),
    );
    expectKnown(["deposit", "balance", "payment", "refund", "reversal"], (code) =>
      localizeInventoryPaymentKind(code, "RAW", translator),
    );
    expectKnown(["cash", "card", "bancomat", "transfer", "other"], (code) =>
      localizeInventoryPaymentMethod(code, "RAW", translator),
    );
    expectKnown(["refund_pending", "retain", "pending"], (code) =>
      localizeInventoryCancelDisposition(code, "RAW", translator),
    );
    expectKnown(["pending", "covered", "not_covered"], (code) =>
      localizeInventoryCoverage(code, "RAW", translator),
    );
    expectKnown(["legal", "commercial"], (code) =>
      localizeInventoryWarrantyBasis(code, "RAW", translator),
    );
  });

  it.each(locales)(
    "localizes projection metadata by stable facts without mutating canonical facts in %s",
    (locale) => {
      const projection: InventoryLifecycleProjection = {
        mode: "compatible",
        status: "processing",
        confidence: "low",
        needs_review: true,
        allowed_actions: ["inspection.save"],
      };
      const raw = getInventoryLifecycleProjectionMeta(projection, "returned");
      const localized = localizeInventoryProjectionMeta(projection, raw, "returned", t(locale));
      expect(localized.label).toBe(
        translateMessage(locale, "inventory2b4.projection.returnedReview.label"),
      );
      expect(localized.tone).toBe(raw.tone);
      expect(localized.icon).toBe(raw.icon);
      expect(projection.allowed_actions).toEqual(["inspection.save"]);
    },
  );

  it.each(locales)(
    "localizes no-action guidance from its discriminator and preserves its command in %s",
    (locale) => {
      const guidance = {
        state: "target-unavailable" as const,
        targetCommand: "pickup.confirm" as const,
      };
      const localized = localizeInventoryNoActionGuidance(guidance, t(locale));
      expect(localized).toContain(
        localizeInventoryLifecycleCommand("pickup.confirm", "", t(locale)),
      );
      expect(guidance.targetCommand).toBe("pickup.confirm");
    },
  );

  it.each(locales.flatMap((locale) => commands.map((command) => [locale, command] as const)))(
    "uses exhaustive safe receipt semantics for %s / %s",
    (locale, command) => {
      const segment = receiptSegments[command];
      const keys = {
        title: `inventory2b4.receipt.${segment}.title` as Parameters<typeof translateMessage>[1],
        description: `inventory2b4.receipt.${segment}.description` as Parameters<
          typeof translateMessage
        >[1],
        ledger: `inventory2b4.receipt.${segment}.ledger` as Parameters<typeof translateMessage>[1],
        next: `inventory2b4.receipt.${segment}.next` as Parameters<typeof translateMessage>[1],
      };
      const confirmed = resolveInventoryOperationReceipt(command, { ok: true, code: "confirmed" })!;
      const replay = resolveInventoryOperationReceipt(command, {
        ok: true,
        code: "idempotent_replay",
        payment_id: "pay-SECRET-SENTINEL",
        balance: 999,
        version: 7,
        status: "RAW-STATUS-SENTINEL",
      })!;

      expect(localizeInventoryOperationReceipt(confirmed, t(locale))).toEqual({
        command,
        kind: "confirmed",
        replayed: false,
        title: translateMessage(locale, keys.title),
        description: translateMessage(locale, keys.description),
        ledgerSemantics: translateMessage(locale, keys.ledger),
        nextStep: translateMessage(locale, keys.next),
      });

      const localizedReplay = localizeInventoryOperationReceipt(replay, t(locale));
      expect(localizedReplay).toEqual({
        command,
        kind: "idempotent-replay",
        replayed: true,
        title: translateMessage(locale, "inventory2b4.receipt.replayedTitle", {
          action: localizeInventoryLifecycleCommand(command, command, t(locale)),
        }),
        description: translateMessage(locale, "inventory2b4.receipt.replayedDescription", {
          details: translateMessage(locale, keys.description),
        }),
        ledgerSemantics: translateMessage(locale, keys.ledger),
        nextStep: translateMessage(locale, keys.next),
      });
      expect(JSON.stringify(localizedReplay)).not.toMatch(
        /pay-SECRET-SENTINEL|RAW-STATUS-SENTINEL|999/,
      );
      expect(localizedReplay.title).not.toBe(
        localizeInventoryOperationReceipt(confirmed, t(locale)).title,
      );
      expect(localizedReplay.description).not.toBe(
        localizeInventoryOperationReceipt(confirmed, t(locale)).description,
      );
    },
  );

  it.each(
    locales.flatMap((locale) =>
      (["confirmed", "idempotent_replay"] as const).map(
        (resultCode) => [locale, resultCode] as const,
      ),
    ),
  )("safely presents a forward-compatible receipt in %s / %s", (locale, resultCode) => {
    const command = "future.command-SECRET" as InventoryLifecycleCommand;
    const receipt = resolveInventoryOperationReceipt(command, {
      ok: true,
      code: resultCode,
      payment_id: "payment-SECRET-SENTINEL",
      balance: 987654,
      status: "status-SECRET-SENTINEL",
    });
    expect(receipt).not.toBeNull();

    const localized = localizeInventoryOperationReceipt(receipt!, t(locale));
    const replayed = resultCode === "idempotent_replay";
    expect(localized).toMatchObject({
      command,
      kind: replayed ? "idempotent-replay" : "confirmed",
      replayed,
    });
    const presentation = [
      localized.title,
      localized.description,
      localized.ledgerSemantics,
      localized.nextStep,
    ].join(" ");
    expect(presentation).not.toMatch(
      /future\.command-SECRET|payment-SECRET-SENTINEL|status-SECRET-SENTINEL|987654/,
    );
    expect(localized.title).toBe(
      translateMessage(
        locale,
        replayed ? "inventory2b4.receipt.replayedTitle" : "inventory2b4.receipt.confirmedTitle",
        { action: translateMessage(locale, "nav.inventory.short") },
      ),
    );
    expect(localized.ledgerSemantics).toBe(translateMessage(locale, "inventory2b4.receipt.ledger"));
    expect(localized.nextStep).toBe(translateMessage(locale, "inventory2b4.receipt.next"));
    if (replayed) {
      expect(localized.description).toContain(
        translateMessage(locale, "inventory2b4.receipt.description", {
          action: translateMessage(locale, "nav.inventory.short"),
        }),
      );
      expect(localized.description).not.toBe(
        translateMessage(locale, "inventory2b4.receipt.description", {
          action: translateMessage(locale, "nav.inventory.short"),
        }),
      );
    }
  });

  it.each([
    ["zh-CN", ["追加", "派生"], "保修起点", ["保修版本", "追加"], "退款或留款", "未新增写入"],
    [
      "it-IT",
      ["aggiunto", "deriva"],
      "inizio della garanzia",
      ["versione della garanzia", "aggiunta"],
      "rimborso o trattenuta",
      "non è stata creata una nuova scrittura",
    ],
    [
      "en",
      ["appended", "derived"],
      "warranty start",
      ["warranty version", "appended"],
      "refund or retention",
      "no new write was created",
    ],
  ] as const)(
    "retains high-risk receipt meaning in %s",
    (locale, paymentWords, pickupWords, warrantyWords, cancellationWords, replayWords) => {
      const message = (segment: string, field: "description" | "ledger" | "next") =>
        translateMessage(
          locale,
          `inventory2b4.receipt.${segment}.${field}` as Parameters<typeof translateMessage>[1],
        );
      for (const word of paymentWords) {
        expect(message("paymentAppend", "ledger")).toContain(word);
      }
      expect(message("pickupConfirm", "ledger")).toContain(pickupWords);
      for (const word of warrantyWords) {
        expect(message("warrantyAdjust", "ledger")).toContain(word);
      }
      expect(message("reservationCancel", "description")).toContain(cancellationWords);
      expect(
        translateMessage(locale, "inventory2b4.receipt.replayedDescription", {
          details: "DETAIL",
        }),
      ).toContain(replayWords);
      expect(message("afterSalesCreate", "next")).not.toBe(message("afterSalesUpdate", "next"));
    },
  );

  it.each(locales)(
    "localizes known timeline facts but preserves unknown history payload in %s",
    (locale) => {
      const timeline = resolveInventoryLedgerTimeline([
        {
          event_type: "status_changed",
          from_status: "open",
          to_status: "waiting_customer",
          occurred_at: "2026-03-29T00:30:00.000Z",
        },
        {
          event_type: "custom_动态_event",
          from_status: "custom_前  ",
          to_status: " custom_后",
          occurred_at: "2026-03-29T01:30:00.000Z",
        },
      ]);
      const localized = localizeInventoryTimeline(timeline, t(locale));
      const known = localized.items.find((entry) => entry.eventType === "status_changed")!;
      const custom = localized.items.find((entry) => entry.eventType === "custom_动态_event")!;
      expect(known.label).toBe(
        translateMessage(locale, "inventory2b4.timeline.event.statusChanged"),
      );
      const originalCustom = timeline.items.find(
        (entry) => entry.eventType === "custom_动态_event",
      )!;
      expect(known.fromStatusLabel).toBe(
        translateMessage(locale, "inventory2b4.timeline.status.awaitingInspection"),
      );
      expect(known.toStatusLabel).toBe(
        translateMessage(locale, "inventory2b4.afterSales.waitingCustomer"),
      );
      expect(custom).toMatchObject({
        eventType: "custom_动态_event",
        fromStatus: "custom_前  ",
        toStatus: " custom_后",
        label: translateMessage(locale, "inventory2b4.timeline.event.generic"),
        fromStatusLabel: "custom_前  ",
        toStatusLabel: " custom_后",
      });
      expect({
        id: custom.id,
        at: custom.at,
        source: custom.source,
        eventType: custom.eventType,
        fromStatus: custom.fromStatus,
        toStatus: custom.toStatus,
      }).toEqual({
        id: originalCustom.id,
        at: originalCustom.at,
        source: originalCustom.source,
        eventType: originalCustom.eventType,
        fromStatus: originalCustom.fromStatus,
        toStatus: originalCustom.toStatus,
      });

      const milestone = resolveInventoryMilestoneTimeline([
        { id: "inspection", label: "源文案变化", at: "2026-01-15T12:00:00.000Z" },
        { id: "inspection:custom", label: "  自定义里程碑  ", at: "2026-01-16T12:00:00.000Z" },
      ]);
      const localizedMilestone = localizeInventoryTimeline(milestone, t(locale));
      expect(
        localizedMilestone.items.find((entry) => entry.label === "  自定义里程碑  "),
      ).toBeTruthy();
    },
  );

  it("formats Europe/Rome DST and locale EUR without changing source values", () => {
    const beforeDst = "2026-03-29T00:30:00.000Z";
    const afterDst = "2026-03-29T01:30:00.000Z";
    expect(formatInventoryLifecycleDate(beforeDst, "en", t("en"))).toContain("1:30 AM");
    expect(formatInventoryLifecycleDate(afterDst, "en", t("en"))).toContain("3:30 AM");
    expect(formatInventoryLifecycleDate("bad-date", "it-IT", t("it-IT"))).toBe(
      "Data non disponibile",
    );
    expect(formatInventoryLifecycleMoney(1234.5, "it-IT", t("it-IT"))).toContain("€");
    expect(formatInventoryLifecycleMoney(undefined, "en", t("en"))).toBe("Amount unavailable");
    expect(beforeDst).toBe("2026-03-29T00:30:00.000Z");
  });

  it("formats both sides of the 2026-10-25 Europe/Rome clock rollback safely", () => {
    const summerOccurrence = "2026-10-25T00:30:00.000Z";
    const winterOccurrence = "2026-10-25T01:30:00.000Z";
    const first = formatInventoryLifecycleDate(summerOccurrence, "en", t("en"));
    const second = formatInventoryLifecycleDate(winterOccurrence, "en", t("en"));
    expect(first).toContain("2:30 AM");
    expect(second).toContain("2:30 AM");
    expect(summerOccurrence).toBe("2026-10-25T00:30:00.000Z");
    expect(winterOccurrence).toBe("2026-10-25T01:30:00.000Z");
  });
});
