import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STORE_ID,
  requireStoreIdFromActor,
  storeIdFromActor,
} from "@/server/repairdesk-shared";

const realRepositoryFiles = [
  "src/features/orders/server/order.repository.ts",
  "src/features/customers/server/customer.repository.ts",
  "src/features/inventory/server/inventory.repository.ts",
  "src/features/messages/server/message-settings.service.ts",
];

describe("tenant guardrails", () => {
  it("keeps the legacy fallback explicit and the production helper strict", () => {
    expect(storeIdFromActor()).toBe(DEFAULT_STORE_ID);
    expect(requireStoreIdFromActor({ storeId: "store_1" })).toBe("store_1");
    expect(() => requireStoreIdFromActor(undefined, "测试操作")).toThrow("测试操作缺少店铺上下文");
  });

  it("does not use the default-store fallback in real Supabase repositories", () => {
    for (const file of realRepositoryFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).toContain("requireStoreIdFromActor");
      expect(source, file).not.toMatch(/\bstoreIdFromActor\s*\(/);
    }
  });

  it("keeps membership-based RLS policies in the tenant hardening migration", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260611005916_harden_store_tenant_constraints.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("create policy stores_member_select");
    expect(sql).toContain("create policy store_memberships_self_select");
    expect(sql).toContain("select auth.uid()");
    expect(sql).toContain("add_store_member_select_policy('repair_orders'");
    expect(sql).toContain("add_store_member_select_policy('audit_logs'");
  });
});
