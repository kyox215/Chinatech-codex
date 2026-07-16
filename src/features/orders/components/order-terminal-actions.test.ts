import { describe, expect, it } from "vitest";

import type { OrderDetail } from "@/lib/repairdesk/types";

import {
  buildTerminalCorrectionChanges,
  buildTerminalCorrectionDraft,
} from "./order-terminal-actions";

function terminalOrder(overrides: Partial<OrderDetail["order"]> = {}) {
  return {
    id: "order_1",
    public_no: "R2026001",
    status: "completed",
    issue_description: "屏幕损坏",
    diagnosis_result: "更换屏幕",
    internal_tag: "",
    accessory_notes: "手机壳",
    warranty_months: 6,
    warranty_text: "6个月",
    warranty_change_reason: undefined,
    updated_at: "2026-07-16T20:00:00.000Z",
    ...overrides,
  } as OrderDetail["order"];
}

describe("terminal correction payload", () => {
  it("does not create a warranty change from the operation reason alone", () => {
    const order = terminalOrder();
    const draft = buildTerminalCorrectionDraft(order);

    expect(buildTerminalCorrectionChanges(order, draft, "修正诊断记录")).toEqual({});
  });

  it("keeps a diagnosis-only correction free of warranty keys", () => {
    const order = terminalOrder();
    const draft = { ...buildTerminalCorrectionDraft(order), diagnosis_result: "更换原装屏幕" };

    expect(buildTerminalCorrectionChanges(order, draft, "补充准确诊断")).toEqual({
      diagnosis_result: "更换原装屏幕",
    });
  });

  it("infers legacy warranty text without creating an accidental warranty change", () => {
    const order = terminalOrder({ warranty_months: undefined, warranty_text: "90天质保" });
    const draft = {
      ...buildTerminalCorrectionDraft(order),
      diagnosis_result: "更换原装屏幕",
    };

    expect(draft).toMatchObject({ warranty_months: "3", warranty_text: "3个月" });
    expect(buildTerminalCorrectionChanges(order, draft, "补充准确诊断")).toEqual({
      diagnosis_result: "更换原装屏幕",
    });
  });

  it("sends a canonical warranty bundle and derives its reason when warranty changes", () => {
    const order = terminalOrder();
    const draft = {
      ...buildTerminalCorrectionDraft(order),
      warranty_months: "12",
      warranty_text: "12个月",
    };

    expect(buildTerminalCorrectionChanges(order, draft, "客户购买延保")).toMatchObject({
      warranty_months: 12,
      warranty_text: "12个月",
      warranty_change_reason: "客户购买延保",
    });
  });
});
