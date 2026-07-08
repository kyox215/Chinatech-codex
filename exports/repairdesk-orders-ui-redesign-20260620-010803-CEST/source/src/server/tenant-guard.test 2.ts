import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STORE_ID,
  failStorageOperation,
  isMissingRepairOrderColumnError,
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

  it("treats Supabase schema-cache missing repair_orders columns as legacy schema fallback", () => {
    expect(
      isMissingRepairOrderColumnError({
        message:
          "Could not find the 'approval_flow_status' column of 'repair_orders' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingRepairOrderColumnError({
        message: "column repair_orders.approval_flow_status does not exist",
      }),
    ).toBe(true);
  });

  it("turns Supabase Storage setup failures into actionable attachment errors", () => {
    expect(() =>
      failStorageOperation(
        { message: "Bucket not found" },
        "上传工单附件失败",
        "repairdesk-order-attachments",
      ),
    ).toThrow("附件存储未初始化");

    expect(() =>
      failStorageOperation(
        { message: "signature verification failed" },
        "上传库存附件失败",
        "repairdesk-inventory-attachments",
      ),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");

    expect(() =>
      failStorageOperation(
        { message: "new row violates row-level security policy" },
        "上传库存附件失败",
        "repairdesk-inventory-attachments",
      ),
    ).toThrow("权限拒绝");
  });

  it("keeps attachment storage repair migration aligned with private server-routed uploads", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("repairdesk-order-attachments");
    expect(sql).toContain("repairdesk-inventory-attachments");
    expect(sql).toContain("public.order_attachments");
    expect(sql).toContain("public.inventory_attachments");
    expect(sql).toContain("revoke all on table public.order_attachments from anon, authenticated");
    expect(sql).toContain(
      "revoke all on table public.inventory_attachments from anon, authenticated",
    );
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

  it("keeps platform admin data separate from store-scoped tenant data", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260611080254_platform_onboarding_approvals.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("create table if not exists public.platform_admins");
    expect(sql).toContain("create table if not exists public.onboarding_requests");
    expect(sql).toContain("create table if not exists public.platform_audit_logs");
    expect(sql).not.toContain("alter table public.repair_orders");
  });
});
