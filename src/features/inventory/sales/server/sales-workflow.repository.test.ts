import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditActor } from "@/lib/repairdesk/types";
import {
  assertInventorySalesWorkflowAccess,
  readInventorySalesWorkflow,
  readInventorySalesWorkflowReport,
  runInventorySalesWorkflowCommand,
} from "./sales-workflow.repository";
import type { InventorySalesWorkflowCommandBody } from "../model/workflow-contracts";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
const id = "20000000-0000-4000-8000-000000000001",
  store = "10000000-0000-4000-8000-000000000001";
const actor: AuditActor = { id, storeId: store, role: "owner", displayName: "Synthetic" };
const input: InventorySalesWorkflowCommandBody = {
  sale_order_id: id,
  expected_workflow_version: 0,
  idempotency_key: id,
  command: "issue.open",
  payload: { kind: "other", summary: "Check delivery" },
};
const result = {
  ok: true,
  code: "completed",
  sale_order_id: id,
  workflow_version: 1,
  event_id: id,
};
const read = {
  workflow: {
    sale_order_id: id,
    version: 0,
    fiscal: null,
    followup: { assignee_membership_id: null, assignee_name: null, follow_up_at: null, note: null },
    issues: [],
  },
  history: [],
  assignees: [],
  truncated: { history: false, issues: false },
  capabilities: { can_edit: true, can_verify: true, can_report_finance: true },
};
describe("sales workflow repository scope and fail closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries({
      INVENTORY_SALES_SCHEMA_READY: "1",
      INVENTORY_SALES_UI: "1",
      INVENTORY_SALES_COMMANDS: "1",
      INVENTORY_SALES_STORE_ALLOWLIST: store,
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("derives store and actor exclusively from authenticated actor", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    expect(await runInventorySalesWorkflowCommand(input, actor)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_inventory_sales_workflow_command", {
      p_store_id: store,
      p_actor_id: id,
      p_sale_order_id: id,
      p_expected_workflow_version: 0,
      p_idempotency_key: id,
      p_command: "issue.open",
      p_payload: input.payload,
    });
  });
  it("rejects sales fiscal verification and respects active store role", () => {
    expect(() =>
      assertInventorySalesWorkflowAccess(
        { ...actor, role: "sales" },
        { ...input, command: "fiscal.verify", payload: { expected_fiscal_revision: 1 } },
      ),
    ).toThrow();
    expect(() =>
      assertInventorySalesWorkflowAccess({ ...actor, role: "owner", storeRole: "viewer" }),
    ).toThrow();
  });
  it("feature disabled prevents RPC access", async () => {
    vi.stubEnv("INVENTORY_SALES_COMMANDS", "0");
    await expect(runInventorySalesWorkflowCommand(input, actor)).rejects.toMatchObject({
      status: 503,
      code: "feature_disabled",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["actor_forbidden", 403],
    ["not_found", 404],
    ["stale_version", 409],
    ["stale_fiscal_revision", 409],
    ["idempotency_conflict", 409],
    ["issue_not_open", 409],
    ["invalid_assignee", 400],
  ])("maps DB %s to %s", async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code }, error: null });
    await expect(runInventorySalesWorkflowCommand(input, actor)).rejects.toMatchObject({
      code,
      status,
    });
  });
  it.each([
    { data: null, error: { code: "PGRST202" } },
    { data: { ok: true }, error: null },
    { data: { ...result, workflow_version: "1" }, error: null },
  ])("fails closed on unavailable or malformed DB results %#", async (response) => {
    mocks.rpc.mockResolvedValue(response);
    await expect(runInventorySalesWorkflowCommand(input, actor)).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
    });
  });
  it("keeps DB capability restrictions and gates edits when commands are off", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, data: read }, error: null });
    vi.stubEnv("INVENTORY_SALES_COMMANDS", "0");
    expect((await readInventorySalesWorkflow({ sale_order_id: id }, actor)).capabilities).toEqual({
      can_edit: false,
      can_verify: false,
      can_report_finance: true,
    });
  });
  it("fails closed if report shape does not respect finance boundary", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, data: { finance: { collected_cents: 99 } } },
      error: null,
    });
    await expect(
      readInventorySalesWorkflowReport(
        { business_date: "2026-09-26", offset: 0, limit: 30 },
        actor,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
