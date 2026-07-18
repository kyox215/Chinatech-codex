import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, CostExportInput, CostExportRow } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  readCostExportRows: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("./cost-export.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cost-export.repository")>()),
  readCostExportRows: mocks.readCostExportRows,
}));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { buildCostExportCsv, COST_EXPORT_HEADERS, exportCostReport } from "./cost-export.service";

const storeId = "00000000-0000-4000-8000-000000000001";
const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Manager",
  storeId,
  storeRole: "manager",
  permissionGrants: ["finance:profit_read", "finance:cost_export"],
};
const input: CostExportInput = {
  expected_store_id: storeId,
  start_date: "2026-07-01",
  end_date: "2026-07-18",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "1");
  vi.stubEnv("REPAIRDESK_COST_EXPORT_ENABLED", "1");
  mocks.writeAuditLog.mockResolvedValue({ ok: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("cost export CSV", () => {
  it("uses stable PII-minimized columns and protects spreadsheet formulas after whitespace", () => {
    const text = buildCostExportCsv([
      row({
        order_public_no: " =CMD()",
        line_name: '+维修\r\n"屏幕"\t',
        supplier_name: "@UTOPYA",
      }),
    ]).toString("utf8");

    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain('"\' =CMD()"');
    expect(text).toContain('"\'+维修\r\n""屏幕""\t"');
    expect(text).toContain('"\'@UTOPYA"');
    expect(text).toContain("维修项目");
    expect(COST_EXPORT_HEADERS).toEqual([
      "工单编号",
      "建单日期",
      "工单状态",
      "维修行ID",
      "维修类别键",
      "维修项目",
      "报价_EUR",
      "成本_EUR",
      "成本来源",
      "证据状态",
      "原币金额",
      "原币币种",
      "兑欧元汇率",
      "汇率时间",
      "汇率来源",
      "采购供应商",
      "报价毛利_EUR",
    ]);
    expect(text).not.toMatch(/客户|电话|邮箱|IMEI|解锁|消息/);
  });

  it("audits only filter counts, row count, hash and result after a successful build", async () => {
    mocks.readCostExportRows.mockResolvedValue({
      timezone: "Europe/Rome",
      overflow: false,
      rows: [row()],
    });
    const result = await exportCostReport(
      { ...input, statuses: ["ready"], sources: ["manual"] },
      actor,
    );

    expect(result.rowCount).toBe(1);
    expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export",
        entityType: "repair_cost_export",
        metadata: {
          start_date: "2026-07-01",
          end_date: "2026-07-18",
          status_filter_count: 1,
          source_filter_count: 1,
          row_count: 1,
          content_sha256: result.contentSha256,
          result: "generated",
        },
      }),
    );
    const audit = mocks.writeAuditLog.mock.calls[0]?.[0];
    expect(JSON.stringify(audit)).not.toContain("R-1041");
    expect(JSON.stringify(audit)).not.toContain("UTOPYA");
  });

  it("rejects overflow without creating a partial file and audits the bounded rejection", async () => {
    mocks.readCostExportRows.mockResolvedValue({
      timezone: "Europe/Rome",
      overflow: true,
      rows: [],
    });
    await expect(exportCostReport({ ...input, limit: 25 }, actor)).rejects.toMatchObject({
      code: "row_limit_exceeded",
      status: 422,
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ row_count: 25, result: "rejected_row_limit" }),
      }),
    );
  });

  it("rejects a changed store before reading financial rows", async () => {
    await expect(
      exportCostReport(
        { ...input, expected_store_id: "00000000-0000-4000-8000-000000000999" },
        actor,
      ),
    ).rejects.toThrow("店铺上下文已经变化");
    expect(mocks.readCostExportRows).not.toHaveBeenCalled();
  });
});

function row(overrides: Partial<CostExportRow> = {}): CostExportRow {
  return {
    order_public_no: "R-1041",
    order_created_date: "2026-07-18",
    order_status: "ready",
    line_id: "00000000-0000-4000-8000-000000000201",
    catalog_key: "display:main",
    line_name: "屏幕维修",
    quote_amount_eur: 140,
    cost_amount_eur: 30,
    cost_source: "purchase_lot",
    evidence_status: "confirmed",
    original_amount: 30,
    original_currency_code: "EUR",
    fx_rate_to_eur: 1,
    fx_rate_at: "2026-07-18T08:00:00.000Z",
    fx_rate_source: "store_base",
    supplier_name: "UTOPYA",
    margin_amount_eur: 110,
    ...overrides,
  };
}
