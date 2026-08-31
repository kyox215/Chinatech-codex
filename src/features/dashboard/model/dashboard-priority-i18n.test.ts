import { describe, expect, it } from "vitest";

import { localizeDashboardPriorityItem } from "@/features/dashboard/model/dashboard-priority-i18n";
import { translateMessage } from "@/shared/i18n/messages";
import type { DashboardPriorityItem } from "@/lib/repairdesk/types";

const item = (overrides: Partial<DashboardPriorityItem> = {}): DashboardPriorityItem => ({
  rank: 1,
  orderId: "o-1",
  publicNo: "R-1",
  customerName: "客户",
  deviceLabel: "设备",
  tier: "waiting",
  reasonCode: "approval_overdue",
  reasonLabel: "报价超期",
  reasonDescription: "报价确认已超出约定等待时间，需要优先联系客户。",
  currentStep: "等待客户确认报价",
  nextStep: "联系客户确认报价，必要时重新发送消息。",
  assigneeLabel: "技师",
  assigneeState: "assigned",
  isMine: false,
  isOverdue: true,
  isActionable: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
  action: { kind: "open_task", label: "联系客户", href: "/orders/o-1/task" },
  detailHref: "/orders/o-1",
  ...overrides,
});

describe("localizeDashboardPriorityItem", () => {
  it.each([
    ["unassigned", "未分配", "Unassigned", "Non assegnato"],
    ["unavailable", "负责人暂不可用", "Assignee unavailable", "Responsabile non disponibile"],
  ] as const)("localizes assignee placeholder %s", (state, zhLabel, enLabel, itLabel) => {
    const source = item({ assigneeState: state, assigneeLabel: zhLabel });
    expect(
      localizeDashboardPriorityItem(source, (key, values) => translateMessage("zh-CN", key, values))
        .assigneeLabel,
    ).toBe(zhLabel);
    expect(
      localizeDashboardPriorityItem(source, (key, values) => translateMessage("en", key, values))
        .assigneeLabel,
    ).toBe(enLabel);
    expect(
      localizeDashboardPriorityItem(source, (key, values) => translateMessage("it-IT", key, values))
        .assigneeLabel,
    ).toBe(itLabel);
  });

  it("preserves assigned technician labels", () => {
    const source = item({ assigneeState: "assigned", assigneeLabel: "Tecnico personalizzato" });
    expect(
      localizeDashboardPriorityItem(source, (key, values) => translateMessage("en", key, values))
        .assigneeLabel,
    ).toBe("Tecnico personalizzato");
  });

  it.each([
    ["取消归档", "工单已取消；历史余额仅供记录，不计入待收。", "查看取消原因"],
    ["报价超期", "优先联系客户确认报价，必要时重新发送报价消息。", "联系客户"],
    [
      "客户持有设备",
      "设备尚未交给门店；需要实机检测或维修前，请先在工单详情确认收机。",
      "确认收机",
    ],
    ["取件超期", "优先通知客户取机，核对尾款和随附物品。", "催取机"],
    [
      "寄修中",
      "设备已转给外部维修方处理，请跟进供应商、寄出原因、预计返回时间和维修结果。",
      "登记寄修结果",
    ],
    ["已修复", "维修已完成，下一步通知客户取机并核对尾款。", "通知取机"],
  ])("localizes special guidance %s", (label, task, action) => {
    const translated = localizeDashboardPriorityItem(
      item({
        reasonDescription: task,
        currentStep: label,
        nextStep: task,
        action: { kind: "open_task", label: action, href: "/orders/o-1/task" },
      }),
      (key, values) => translateMessage("it-IT", key, values),
    );
    expect(translated.reasonDescription).toBeTruthy();
    expect(translated.currentStep).toBeTruthy();
    expect(translated.nextStep).toBeTruthy();
    expect(translated.action.label).toBeTruthy();
    expect(
      `${translated.reasonDescription}${translated.currentStep}${translated.nextStep}${translated.action.label}`,
    ).not.toMatch(/[一-龥]/);
  });

  it.each([
    ["接单", "核对客户、设备保管、故障、解锁方式和随附物品，必要时打印工单二维码。", "开始检测"],
    ["检测报价", "完成检测、补充诊断结论，保存报价并记录客户确认。", "确认报价"],
    ["维修处理", "处理配件、外修和实际维修进度，完成后准备通知客户。", "完成维修"],
    ["通知取机", "通知客户取机，核对尾款、随附物品和交付状态。", "通知取机"],
    ["收款完成", "订单已结清并归档，可查看历史记录或发起返修。", "查看记录"],
  ])("localizes simple flow %s", (label, task, nextAction) => {
    const localized = localizeDashboardPriorityItem(
      item({
        reasonDescription: task,
        currentStep: label,
        nextStep: task,
        action: { kind: "open_task", label: nextAction, href: "/orders/o-1/task" },
      }),
      (key, values) => translateMessage("en", key, values),
    );
    expect(localized.currentStep).toBeTruthy();
    expect(localized.nextStep).toBeTruthy();
    expect(localized.action.label).toBeTruthy();
    expect(localized.currentStep).not.toMatch(/[一-龥]/);
    expect(localized.nextStep).not.toMatch(/[一-龥]/);
    expect(localized.action.label).not.toMatch(/[一-龥]/);
    const zh = localizeDashboardPriorityItem(
      item({
        reasonDescription: task,
        currentStep: label,
        nextStep: task,
        action: { kind: "open_task", label: nextAction, href: "/orders/o-1/task" },
      }),
      (key, values) => translateMessage("zh-CN", key, values),
    );
    expect(zh.currentStep).toBe(label);
    expect(zh.nextStep).toBe(task);
    expect(zh.action.label).toBe(nextAction);
  });

  it("maps fixed guidance fields without collapsing them", () => {
    const localized = localizeDashboardPriorityItem(item(), (key, values) =>
      translateMessage("en", key, values),
    );
    expect(localized.reasonLabel).toBe("Quote overdue");
    expect(localized.reasonDescription).toContain("overdue");
    expect(localized.currentStep).toBe("Waiting for quote confirmation");
    expect(localized.nextStep).toContain("Contact the customer");
    expect(localized.action.label).toBe("Contact customer");
    expect(
      new Set([
        localized.reasonDescription,
        localized.currentStep,
        localized.nextStep,
        localized.action.label,
      ]).size,
    ).toBe(4);
  });

  it("preserves unknown custom labels and guidance", () => {
    const custom = item({
      reasonCode: "workflow_action_ready",
      reasonLabel: "店铺自定义",
      reasonDescription: "自定义说明",
      currentStep: "自定义当前",
      nextStep: "自定义下一步",
      action: { kind: "open_task", label: "自定义动作", href: "/orders/o-1/task" },
    });
    expect(
      localizeDashboardPriorityItem(custom, (key, values) =>
        translateMessage("it-IT", key, values),
      ),
    ).toMatchObject({
      reasonLabel: "店铺自定义",
      reasonDescription: "自定义说明",
      currentStep: "自定义当前",
      nextStep: "自定义下一步",
      action: { label: "自定义动作" },
    });
  });
});
