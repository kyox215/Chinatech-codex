import { describe, expect, it } from "vitest";

import { aiOrderSearchArgumentsSchema } from "@/features/ai-assistant/model/contracts";
import { compileEvidenceBackedProviderConstraints } from "./order-query-evidence";

describe("evidence-backed order query compilation", () => {
  it("accepts a model-only unpaid synonym when the quote is exact and semantically valid", () => {
    const result = compile(
      "找出尾款还没结清的维修单",
      searchArgs({
        paid: "unpaid",
        evidence: [{ field: "paid", quote: "尾款还没结清" }],
      }),
    );

    expect(result).toEqual({
      constraints: { paid: "unpaid" },
      acceptedFields: ["paid"],
      rejectedFields: [],
    });
  });

  it.each([
    ["zh-CN", "修好以后已经通知客户", "repaired_notified"],
    ["en", "repaired and notified", "repaired_notified"],
    ["it-IT", "riparato e avvisato", "repaired_notified"],
  ] as const)("accepts %s queue evidence", (_locale, quote, queueGroup) => {
    const result = compile(
      `查询 ${quote} 的工单`,
      searchArgs({
        queue_group: queueGroup,
        evidence: [{ field: "queue_group", quote }],
      }),
    );

    expect(result.constraints.queue_group).toBe(queueGroup);
    expect(result.rejectedFields).toEqual([]);
  });

  it.each([
    ["显示总成", "display"],
    ["logic board", "mainboard"],
    ["vetro posteriore", "back-cover"],
  ] as const)("accepts controlled service ontology evidence %s", (quote, serviceGroup) => {
    const result = compile(
      `查找换过 ${quote} 的设备`,
      searchArgs({
        service_group: serviceGroup,
        evidence: [{ field: "service_group", quote }],
      }),
    );

    expect(result.constraints.service_group).toBe(serviceGroup);
  });

  it.each([
    ["等着采购零件", "needed"],
    ["parts arrived", "arrived"],
    ["ricambio non disponibile", "out_of_stock"],
  ] as const)("accepts controlled parts evidence %s", (quote, partsStatus) => {
    const result = compile(
      `查询 ${quote} 的订单`,
      searchArgs({
        parts_status: partsStatus,
        evidence: [{ field: "parts_status", quote }],
      }),
    );

    expect(result.constraints.parts_status).toBe(partsStatus);
  });

  it("accepts a device only when the evidence compiles to the same canonical model", () => {
    const accepted = compile(
      "检查苹果15系列",
      searchArgs({
        device_search: "Apple iPhone 15",
        evidence: [{ field: "device_search", quote: "苹果15系列" }],
      }),
    );
    const rejected = compile(
      "检查苹果15系列",
      searchArgs({
        device_search: "Samsung A12",
        evidence: [{ field: "device_search", quote: "苹果15系列" }],
      }),
    );

    expect(accepted.constraints.device_search).toBe("iPhone 15");
    expect(rejected).toMatchObject({ constraints: {}, rejectedFields: ["device_search"] });
  });

  it("accepts an exact symbolic date and rejects a substituted period", () => {
    const accepted = compile(
      "上个星期的苹果15",
      searchArgs({
        date_filter: { expression: "previous_calendar_week", field: "created_at" },
        evidence: [{ field: "date_filter", quote: "上个星期" }],
      }),
    );
    const rejected = compile(
      "上个星期的苹果15",
      searchArgs({
        date_filter: { expression: "previous_calendar_month", field: "created_at" },
        evidence: [{ field: "date_filter", quote: "上个星期" }],
      }),
    );

    expect(accepted.constraints.date_filter).toEqual({
      expression: "previous_calendar_week",
      field: "created_at",
    });
    expect(rejected.rejectedFields).toEqual(["date_filter"]);
  });

  it.each([
    ["missing evidence", []],
    ["invented quote", [{ field: "paid" as const, quote: "未付款" }]],
    ["wrong field evidence", [{ field: "parts_status" as const, quote: "尾款没结清" }]],
  ])("rejects %s", (_name, evidence) => {
    const result = compile("尾款没结清的订单", searchArgs({ paid: "unpaid", evidence }));

    expect(result).toMatchObject({ constraints: {}, rejectedFields: ["paid"] });
  });

  it("does not accept sensitive or abstract general search evidence", () => {
    for (const quote of ["mario@example.com", "+39 333 1234567", "订单"]) {
      const result = compile(
        `查找 ${quote}`,
        searchArgs({ search: quote, evidence: [{ field: "search", quote }] }),
      );
      expect(result.rejectedFields).toEqual(["search"]);
    }
  });

  it("keeps every free-form search term on local or manual paths", () => {
    const result = compile(
      "查找 purple-case",
      searchArgs({
        search: "purple-case",
        evidence: [{ field: "search", quote: "purple-case" }],
      }),
    );

    expect(result).toMatchObject({ constraints: {}, rejectedFields: ["search"] });
  });
});

function compile(message: string, args: ReturnType<typeof searchArgs>) {
  return compileEvidenceBackedProviderConstraints(message, args);
}

function searchArgs(
  overrides: Partial<Parameters<typeof aiOrderSearchArgumentsSchema.parse>[0]> = {},
) {
  return aiOrderSearchArgumentsSchema.parse({
    search: null,
    device_search: null,
    view: "active",
    paid: "all",
    overdue: null,
    queue_group: null,
    financial_review: null,
    date_filter: null,
    service_group: null,
    completed_only: false,
    parts_status: null,
    page_size: 8,
    ...overrides,
  });
}
