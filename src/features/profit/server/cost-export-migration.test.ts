import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718130000_order_cost_phase2_cost_export.sql"),
  "utf8",
).toLowerCase();

describe("cost export migration contract", () => {
  it("keeps the RPC service-role-only and permission bound", () => {
    expect(sql).toContain("'finance:cost_export'");
    expect(sql).toContain("revoke all on function public.repairdesk_read_cost_export_rpc");
    expect(sql).toContain("grant execute on function public.repairdesk_read_cost_export_rpc");
    expect(sql).toContain("to service_role");
    expect(sql).not.toContain("to authenticated");
  });

  it("bounds date, filter, and row counts without exporting customer/device details", () => {
    expect(sql).toContain("p_end_date - p_start_date > 366");
    expect(sql).toContain("p_limit > 10000");
    expect(sql).toContain("limit p_limit + 1");
    expect(sql).toContain("'overflow', v_row_count > p_limit");
    expect(sql).not.toMatch(/customer_name|phone_e164|serial_or_imei|device_unlock|message_body/);
  });
});
