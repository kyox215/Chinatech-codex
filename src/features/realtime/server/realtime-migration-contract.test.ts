import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260723012456_realtime_order_revision_and_auth_helper.sql",
);

describe("realtime order migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("keeps private topic authorization behind a security-definer helper", () => {
    expect(sql).toContain("private.can_receive_repairdesk_realtime_topic");
    expect(sql).toContain("security definer");
    expect(sql).toContain(
      "grant execute on function private.can_receive_repairdesk_realtime_topic",
    );
    expect(sql).toContain("revoke all on table realtime.messages from public, anon");
    expect(sql).toContain("grant select on table realtime.messages to authenticated");
  });

  it("emits metadata-only custom broadcasts and never full row changes", () => {
    expect(sql).toContain("perform realtime.send(");
    expect(sql).not.toContain("broadcast_changes");
    expect(sql).toContain("'queryGroups', jsonb_build_array('orders.all', 'customers.all')");
  });

  it.each([
    "repair_orders",
    "order_events",
    "message_logs",
    "order_attachments",
    "order_payment_ledger",
    "order_initial_deposit_corrections",
    "order_terminal_operations",
    "repair_order_line_costs",
    "repair_order_line_cost_revisions",
    "order_part_allocations",
    "repair_order_customer_status_links",
  ])("bumps the order revision for %s", (table) => {
    expect(sql).toContain(`on public.${table}`);
  });
});
