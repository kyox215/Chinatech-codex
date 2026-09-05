import {
  RepairDeskApiError,
  RepairDeskRequestTimeoutError,
  RepairDeskTransportError,
} from "@/lib/repairdesk/api";
import { describe, expect, it } from "vitest";

import { fallbackOrderWorkflow } from "@/features/orders/model/order-workflow";
import { formatCurrency } from "@/shared/i18n/format";
import { translateMessage } from "@/shared/i18n/messages";

import {
  getOrderDetailSafeErrorMessage,
  isTransientFaultEditorReadFailure,
  localizeOrderAttachmentKind,
  localizeOrderDetailBadge,
  localizeOrderDetailApproval,
  localizeOrderDetailEvent,
  localizeOrderDetailStatus,
  localizeOrderMessageChannel,
  localizeOrderMessageStatus,
} from "./order-detail-i18n";

const locales = ["zh-CN", "it-IT", "en"] as const;

describe("order detail stable i18n adapters", () => {
  it.each([
    ["zh-CN", "无需审批"],
    ["it-IT", "Non richiesta"],
    ["en", "Not required"],
  ] as const)("localizes the stable not_required approval status in %s", (locale, expected) => {
    const t = (
      key: Parameters<typeof translateMessage>[1],
      values?: Record<string, string | number>,
    ) => translateMessage(locale, key, values);
    expect(localizeOrderDetailApproval("not_required", t)).toBe(expected);
    expect(localizeOrderDetailApproval("custom_approval_动态", t)).toBe("custom_approval_动态");
  });

  it.each(locales)(
    "localizes system status by code and preserves custom status in %s",
    (locale) => {
      const t = (
        key: Parameters<typeof translateMessage>[1],
        values?: Record<string, string | number>,
      ) => translateMessage(locale, key, values);
      expect(
        localizeOrderDetailStatus(
          { code: "repairing", label: "任意旧系统措辞", is_system: true },
          fallbackOrderWorkflow,
          t,
        ),
      ).toBe(t("orders.workflowRepair"));
      expect(
        localizeOrderDetailStatus(
          { code: "repairing", label: "维修中", is_system: false },
          fallbackOrderWorkflow,
          t,
        ),
      ).toBe("维修中");
    },
  );

  it.each(locales)(
    "localizes known badges by key and preserves unknown collisions in %s",
    (locale) => {
      const t = (
        key: Parameters<typeof translateMessage>[1],
        values?: Record<string, string | number>,
      ) => translateMessage(locale, key, values);
      expect(localizeOrderDetailBadge({ key: "parts-arrived", label: "任意旧措辞" }, t)).toBe(
        t("orders2b2.badge.partsArrived"),
      );
      expect(localizeOrderDetailBadge({ key: "custom-arrived", label: "配件已到货" }, t)).toBe(
        "配件已到货",
      );
      const supplier = "供应商动态哨兵 / Fornitore";
      expect(
        localizeOrderDetailBadge(
          { key: "logistics-mail", label: "不可解析标签", supplierName: supplier },
          t,
        ),
      ).toBe(t("orders2b2.badge.mailSupplier", { supplier }));
      expect(
        localizeOrderDetailBadge(
          { key: "external-repair", label: "不可解析标签", supplierName: supplier },
          t,
        ),
      ).toBe(t("orders2b2.badge.externalSupplier", { supplier }));
    },
  );

  it.each(locales)(
    "uses event type and canonical payload fields without changing dynamic data in %s",
    (locale) => {
      const t = (
        key: Parameters<typeof translateMessage>[1],
        values?: Record<string, string | number>,
      ) => translateMessage(locale, key, values);
      const dynamicReason = "动态中文历史原因";
      expect(
        localizeOrderDetailEvent(
          {
            event_type: "approval_result",
            payload: {
              result: "approved",
              from: "waiting_approval",
              to: "repairing",
              reason: dynamicReason,
            },
          },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toContain(dynamicReason);
      expect(
        localizeOrderDetailEvent(
          {
            event_type: "note",
            payload: { action: "attachment_uploaded", file_name: "动态中文照片.jpg" },
          },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toContain("动态中文照片.jpg");
      expect(
        localizeOrderDetailEvent(
          { event_type: "note", payload: { action: "custom_action_动态" } },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toBe("custom_action_动态");

      const statusReason = "STATUS_REASON_动态保真";
      expect(
        localizeOrderDetailEvent(
          {
            event_type: "status_changed",
            payload: { from: "new", to: "repairing", reason: statusReason },
          },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toContain(statusReason);

      expect(
        localizeOrderDetailEvent(
          { event_type: "quoted", payload: { quotation_amount: 1234.56 } },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toBe(t("orders2b2.event.quotedAmount", { amount: formatCurrency(1234.56, locale) }));

      const approvalSent = localizeOrderDetailEvent(
        { event_type: "approval_sent", payload: { status_changed: false } },
        fallbackOrderWorkflow,
        t,
        locale,
      );
      const approvalTransition = localizeOrderDetailEvent(
        {
          event_type: "approval_sent",
          payload: { status_changed: true, from: "quoted", to: "waiting_approval" },
        },
        fallbackOrderWorkflow,
        t,
        locale,
      );
      expect(approvalSent).toBe(t("orders2b2.event.approvalSent"));
      expect(approvalTransition).not.toBe(approvalSent);

      expect(
        localizeOrderDetailEvent(
          { event_type: "payment", payload: { amount: 987.65, method: "现金" } },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toBe(
        t("orders2b2.event.payment", {
          amount: formatCurrency(987.65, locale),
          method: t("orders2b2.payment.cash"),
        }),
      );
      expect(
        localizeOrderDetailEvent(
          { event_type: "payment", payload: { amount: 2, method: "METHOD_动态" } },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toContain("METHOD_动态");

      const fields = ["FIELD_ONE_动态", "FIELD_TWO_动态"];
      expect(
        localizeOrderDetailEvent(
          { event_type: "note", payload: { action: "order_updated", changed_fields: fields } },
          fallbackOrderWorkflow,
          t,
          locale,
        ),
      ).toBe(
        t("orders2b2.event.orderFieldsUpdated", {
          fields: fields.join(t("orders2b2.event.fieldSeparator")),
        }),
      );

      const warrantyReason = "  WARRANTY_REASON_动态  ";
      const warranty = localizeOrderDetailEvent(
        {
          event_type: "note",
          payload: {
            action: "warranty_changed",
            from_text: "FROM_动态",
            to_text: "TO_动态",
            reason: warrantyReason,
          },
        },
        fallbackOrderWorkflow,
        t,
        locale,
      );
      expect(warranty).toContain("FROM_动态");
      expect(warranty).toContain("TO_动态");
      expect(warranty).toContain(warrantyReason);
      expect(warranty).toBe(
        `${t("orders2b2.event.warrantyChanged", {
          from: "FROM_动态",
          to: "TO_动态",
        })}${t("orders2b2.event.reason", { reason: warrantyReason })}`,
      );
    },
  );

  it.each(locales)(
    "maps safe errors only from operation and stable code or status in %s",
    (locale) => {
      const t = (
        key: Parameters<typeof translateMessage>[1],
        values?: Record<string, string | number>,
      ) => translateMessage(locale, key, values);
      const sentinel = "SERVER_SECRET_STORAGE_BUCKET_POLICY";
      const conflict = getOrderDetailSafeErrorMessage(
        { status: 409, code: "ORDER_WRITE_CONFLICT", message: sentinel },
        "save",
        t,
      );
      const unknown = getOrderDetailSafeErrorMessage(new Error(sentinel), "attachment", t);
      expect(conflict).toBe(
        t("orders2b2.error.conflict", { operation: t("orders2b2.operation.save") }),
      );
      expect(unknown).toBe(
        t("orders2b2.error.generic", { operation: t("orders2b2.operation.attachment") }),
      );
      expect(`${conflict}${unknown}`).not.toContain(sentinel);
    },
  );

  it.each(locales)(
    "localizes known attachment and message enums and preserves unknowns in %s",
    (locale) => {
      const t = (
        key: Parameters<typeof translateMessage>[1],
        values?: Record<string, string | number>,
      ) => translateMessage(locale, key, values);
      expect(localizeOrderAttachmentKind("device_front", t)).toBe(t("orders2b2.photo.front"));
      expect(localizeOrderAttachmentKind("custom-photo", t)).toBe("custom-photo");
      expect(localizeOrderMessageChannel("sms", t)).toBe(t("orders2b2.channel.sms"));
      expect(localizeOrderMessageChannel("custom-channel", t)).toBe("custom-channel");
      expect(localizeOrderMessageStatus("read", t)).toBe(t("orders2b2.message.read"));
      expect(localizeOrderMessageStatus("custom-status", t)).toBe("custom-status");
    },
  );
});

describe("fault editor transient read allowlist", () => {
  it.each([408, 429, 500, 503, 599])("accepts typed transient status %s", (status) => {
    expect(isTransientFaultEditorReadFailure(new RepairDeskApiError("private", status))).toBe(true);
  });
  it("accepts the existing request timeout and rejects unknown failures", () => {
    expect(isTransientFaultEditorReadFailure(new RepairDeskRequestTimeoutError())).toBe(true);
    expect(isTransientFaultEditorReadFailure(new Error("network"))).toBe(false);
    expect(isTransientFaultEditorReadFailure(new TypeError("network"))).toBe(false);
    expect(
      isTransientFaultEditorReadFailure(new RepairDeskTransportError(new TypeError("network"))),
    ).toBe(true);
    expect(isTransientFaultEditorReadFailure({ status: 503 })).toBe(false);
  });
  it.each(["AUTH_REQUIRED", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "ORDER_NOT_FOUND"])(
    "denies %s before transient status",
    (code) => {
      expect(isTransientFaultEditorReadFailure(new RepairDeskApiError("private", 503, code))).toBe(
        false,
      );
    },
  );
  it.each([400, 401, 403, 404, 409, 600])("denies status %s", (status) => {
    expect(isTransientFaultEditorReadFailure(new RepairDeskApiError("private", status))).toBe(
      false,
    );
  });
});
