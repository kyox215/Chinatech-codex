import { describe, expect, it } from "vitest";
import { translateMessage } from "@/shared/i18n/messages";
import {
  localizeOrderException,
  localizeOrderFlowStage,
  localizeDeviceCustody,
  localizeDeviceUnlockMethod,
  localizeOrderFinancialLabel,
  localizeBulkTransitionFeedback,
  localizeOrderTaskGuidance,
  localizeOrderQueueGroup,
  localizeOrderResultGroup,
  localizeWorkflowStatusLabel,
  localizeOrderType,
} from "@/features/orders/model/order-i18n";
import { simpleOrderFlowStages } from "@/features/orders/model/order-simple-flow";
import { getOrderTaskGuidance } from "@/features/orders/model/order-task-flow";
import { orderQueueGroups } from "@/features/orders/model/order-queue-classification";

const t = (locale: "zh-CN" | "it-IT" | "en") => {
  return (
    key: Parameters<typeof translateMessage>[1],
    values?: Parameters<typeof translateMessage>[2],
  ) => translateMessage(locale, key, values);
};

describe("order display adapters", () => {
  it.each(orderQueueGroups)("localizes queue group %s", (group) => {
    const zh = localizeOrderQueueGroup(group, t("zh-CN"));
    const en = localizeOrderQueueGroup(group, t("en"));
    const it = localizeOrderQueueGroup(group, t("it-IT"));
    expect(zh.label).toBeTruthy();
    expect(
      `${en.label}${en.shortLabel}${en.hint}${it.label}${it.shortLabel}${it.hint}`,
    ).not.toMatch(/[一-龥]/);
  });

  it("localizes terminal groups and preserves custom workflow labels", () => {
    expect(localizeOrderResultGroup("completed", t("en")).label).toBe("Completed");
    expect(localizeOrderResultGroup("cancelled", t("it-IT")).label).toBe("Annullato");
    const workflow = {
      statuses: [{ code: "new", label: "Stato negozio", is_system: false }],
    } as never;
    expect(localizeWorkflowStatusLabel(workflow, "new", t("en"))).toBe("Stato negozio");
    expect(localizeOrderType("quick_repair", t("it-IT"))).toBe("Riparazione rapida");
    expect(localizeOrderType("custom-type", t("en"))).toBe("custom-type");
  });
  const guidanceInput = (overrides: Record<string, unknown> = {}) =>
    ({
      status: "new",
      workflow_status: "intake",
      exception_status: undefined,
      approval_overdue: false,
      pickup_overdue: false,
      device_custody_status: null,
      ...overrides,
    }) as unknown as Parameters<typeof getOrderTaskGuidance>[0];

  it.each([
    ["cancelled", { status: "cancelled", exception_status: "cancelled" }],
    ["approval overdue", { approval_overdue: true }],
    ["customer custody", { device_custody_status: "with_customer" }],
    ["pickup overdue", { pickup_overdue: true }],
    ["mail-in", { status: "mail_in_progress" }],
    ["repaired", { status: "repaired" }],
  ])("localizes real task guidance: %s", (_name, overrides) => {
    const raw = getOrderTaskGuidance(guidanceInput(overrides));
    const localize = (locale: "zh-CN" | "it-IT" | "en") =>
      localizeOrderTaskGuidance(raw, t(locale));
    const zh = localize("zh-CN");
    expect(zh.label).toBe(raw.label);
    expect(zh.task).toBe(raw.task);
    expect(zh.nextAction).toBe(raw.nextAction);
    for (const locale of ["it-IT", "en"] as const) {
      const translated = localize(locale);
      expect(translated.label).toBeTruthy();
      expect(translated.task).toBeTruthy();
      expect(translated.nextAction).toBeTruthy();
      expect(`${translated.label}${translated.task}${translated.nextAction}`).not.toMatch(
        /[一-龥]/,
      );
    }
  });

  it("preserves unknown custom guidance fields", () => {
    const raw = getOrderTaskGuidance(guidanceInput({ status: "custom-code" }));
    const custom = {
      ...raw,
      label: "店铺自定义状态",
      task: "店铺自定义任务",
      nextAction: "店铺自定义动作",
    };
    expect(localizeOrderTaskGuidance(custom, t("en"))).toMatchObject({
      label: custom.label,
      task: custom.task,
      nextAction: custom.nextAction,
    });
  });

  it.each([
    "金额受限",
    "已退款",
    "已取消",
    "金额待核对",
    "待报价",
    "待审批",
    "报价已拒绝",
    "待确认报价",
    "免收费",
    "报价已拒绝 · 款项待核对",
    "已结清",
    "已付押金",
    "待收款",
  ])("localizes financial label %s", (label) => {
    const zh = localizeOrderFinancialLabel({ settlement: "not_due", label }, t("zh-CN"));
    const en = localizeOrderFinancialLabel({ settlement: "not_due", label }, t("en"));
    const it = localizeOrderFinancialLabel({ settlement: "not_due", label }, t("it-IT"));
    expect(zh).toBe(label);
    expect(en).toBeTruthy();
    expect(it).toBeTruthy();
    expect(`${en}${it}`).not.toMatch(/[一-龥]/);
  });

  it("keeps not_due financial labels distinct", () => {
    const labels = ["待报价", "待审批", "报价已拒绝", "待确认报价"];
    const values = labels.map((label) =>
      localizeOrderFinancialLabel({ settlement: "not_due", label }, t("en")),
    );
    expect(new Set(values).size).toBe(4);
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes complete and partial bulk feedback in %s",
    (locale) => {
      const complete = localizeBulkTransitionFeedback(
        { count: 3, failures: 0, to: "repairing" },
        undefined,
        t(locale),
      );
      const partial = localizeBulkTransitionFeedback(
        { count: 3, failures: 1, to: "repairing" },
        undefined,
        t(locale),
      );
      expect(complete).toContain("3");
      expect(partial).toContain("1");
      if (locale === "zh-CN") {
        expect(complete).toBe("已将 3 条流转为「维修中」。");
        expect(partial).toBe("已将 3 条流转为「维修中」，另有 1 条失败。");
      } else {
        expect(`${complete}${partial}`).not.toMatch(/[一-龥]/);
      }
    },
  );

  it.each(simpleOrderFlowStages)("localizes stage %s", (stage) => {
    const en = localizeOrderFlowStage(stage, t("en"));
    expect(`${en.label}${en.task}${en.nextAction}`).not.toMatch(/[一-龥]/);
    expect(localizeOrderFlowStage(stage, t("zh-CN")).task).toBe(stage.task);
  });

  it.each(simpleOrderFlowStages)("localizes task guidance %s", (stage) => {
    const guidance = localizeOrderTaskGuidance(
      {
        stage,
        label: stage.label,
        task: stage.task,
        nextAction: stage.nextAction,
        workflowStatus: stage.key,
        tone: "info",
      },
      t("en"),
    );
    expect(`${guidance.label}${guidance.task}${guidance.nextAction}`).not.toMatch(/[一-龥]/);
    const zh = localizeOrderTaskGuidance(
      {
        stage,
        label: stage.label,
        task: stage.task,
        nextAction: stage.nextAction,
        workflowStatus: stage.key,
        tone: "info",
      },
      t("zh-CN"),
    );
    expect(zh.label).toBe(stage.label);
    expect(zh.task).toBe(stage.task);
    expect(zh.nextAction).toBe(stage.nextAction);
  });

  it("localizes exception, custody, and unlock codes", () => {
    expect(localizeOrderException("paused", t("en")).label).toBe("Paused");
    expect(localizeDeviceCustody("with_customer", undefined, t("it-IT"))).toBe("Presso il cliente");
    expect(localizeDeviceUnlockMethod("pattern", t("en"))).toBe("Pattern");
    expect(localizeOrderException("custom", t("en")).label).toBe("custom");
  });
});
