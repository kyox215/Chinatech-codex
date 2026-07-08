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

  it("does not allow implicit default-store reads in shared order/message helpers", () => {
    const sharedSource = readFileSync(
      resolve(process.cwd(), "src/server/repairdesk-shared.ts"),
      "utf8",
    );
    const messageRepositorySource = readFileSync(
      resolve(process.cwd(), "src/features/messages/server/message-settings.repository.ts"),
      "utf8",
    );

    expect(sharedSource).toContain("fetchOrderRows(storeId: string)");
    expect(sharedSource).not.toContain("fetchOrderRows(storeId = DEFAULT_STORE_ID)");
    expect(messageRepositorySource).toContain("getStoreSettings(storeId: string)");
    expect(messageRepositorySource).toContain("listMessageTemplates(storeId: string)");
    expect(messageRepositorySource).toContain("requireRepositoryStoreId");
    expect(messageRepositorySource).not.toContain("isMissingStoreIdError");
    expect(messageRepositorySource).not.toContain('.eq("id", "default")');
  });

  it("derives order transitions from actor store context instead of raw storeId options", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/orders/server/order.repository.ts"),
      "utf8",
    );

    expect(source).toContain("opts: { reason?: string; operator?: string | AuditActor }");
    expect(source).not.toContain("storeId?: string");
    expect(source).not.toContain("opts.storeId");
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

  it("fails closed for customer child tables instead of using unscoped schema fallbacks", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/customers/server/customer.repository.ts"),
      "utf8",
    );

    expect(source).toContain("fetchCustomerInteractionsForCustomer");
    expect(source).toContain('from("customer_interactions")');
    expect(source).toContain('.eq("store_id", storeId)');
    expect(source).not.toContain("missingStoreColumn");
    expect(source).not.toContain("legacyResult");
    expect(source).not.toContain("legacyPayload");
  });

  it("keeps customer followup reads store scoped without legacy fallback", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/customers/server/customer.repository.ts"),
      "utf8",
    );

    expect(source).toContain("fetchFollowupsForCustomerIds(storeId");
    expect(source).toContain("fetchFollowupsForCustomer(supabase, storeId, id)");
    expect(source).toContain('.eq("store_id", storeId)');
    expect(source).toContain('.in("customer_id", customerIds)');
    expect(source).toContain('.eq("customer_id", customerId)');
  });

  it("keeps customer child writes object-authorized to the active store", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/customers/server/customer.repository.ts"),
      "utf8",
    );

    expect(source).toContain("assertCustomerBelongsToStore(supabase, storeId, customerId)");
    expect(source).toContain("assertOrderBelongsToCustomerInStore");
    expect(source).toContain('.from("repair_orders")');
    expect(source).toContain('.eq("store_id", storeId)');
    expect(source).toContain('.eq("customer_id", customerId)');
    expect(source).toContain('.select("id")');
    expect(source).toContain(".maybeSingle()");
    expect(source).toContain('throw new Error("客户不存在")');
    expect(source).toContain('throw new Error("设备不存在")');
    expect(source).toContain('throw new Error("客户待办不存在")');
  });

  it("keeps the customer_interactions store_id repair migration available", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("alter table public.customer_interactions");
    expect(sql).toContain("add column if not exists store_id uuid");
    expect(sql).toContain("set store_id = c.store_id");
    expect(sql).toContain("customer_interactions_store_customer_created_idx");
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

  it("keeps owner-email routing hardened at the database boundary", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260704203000_onboarding_owner_email_routing_hardening.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("staff_profiles_email_lowercase_check");
    expect(sql).toContain("store_memberships_email_lowercase_check");
    expect(sql).toContain("onboarding_requests_email_lowercase_check");
    expect(sql).toContain("onboarding_requests_join_store_private_target_check");
    expect(sql).toContain("request_type <> 'join_store'");
    expect(sql).toContain("or target_owner_email is not null");
    expect(sql).toContain("store_memberships_owner_email_lookup_idx");
    expect(sql).toContain("where role in ('owner', 'manager') and status = 'active'");
  });

  it("keeps onboarding approved role auditable and non-owner", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260704212000_onboarding_approved_role_and_cancel.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("add column if not exists approved_role public.staff_role");
    expect(sql).toContain("request_type = 'join_store'");
    expect(sql).toContain("status = 'approved'");
    expect(sql).toContain("onboarding_requests_approved_role_not_owner_check");
    expect(sql).toContain("approved_role <> 'owner'::public.staff_role");
    expect(sql).toContain("pg_notify('pgrst', 'reload schema')");
  });

  it("keeps direct store invitations limited to non-owner roles", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260704220843_store_invitations_non_owner_role.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("store_invitations_role_not_owner_check");
    expect(sql).toContain("role <> 'owner'::public.staff_role");
    expect(sql).toContain("pg_notify('pgrst', 'reload schema')");
  });

  it("keeps invite links hashed, bounded, and service-routed", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260704221944_store_invite_links.sql"),
      "utf8",
    );

    expect(sql).toContain("create table if not exists public.store_invite_links");
    expect(sql).toContain("create table if not exists public.store_invite_link_attempts");
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).toContain("store_invite_links_token_hash_format_check");
    expect(sql).toContain("store_invite_link_attempts_code_hash_format_check");
    expect(sql).toContain("store_invite_links_role_not_owner_check");
    expect(sql).toContain("used_count = link.used_count + 1");
    expect(sql).toContain("claim_store_invite_link");
    expect(sql).toContain("revoke all on table public.store_invite_links from anon, authenticated");
    expect(sql).toContain(
      "revoke all on table public.store_invite_link_attempts from anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.claim_store_invite_link(text) to service_role",
    );
    expect(sql).toContain("pg_notify('pgrst', 'reload schema')");
  });
});
