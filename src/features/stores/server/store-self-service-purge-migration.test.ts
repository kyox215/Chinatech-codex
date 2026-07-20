import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260720211230_store_self_service_purge_safety.sql",
  "utf8",
);

describe("self-service store purge safety migration", () => {
  it("requires a cooling period and distinct first and final AAL2 challenges", () => {
    expect(migration).toContain("cooling_until >= requested_at + interval '24 hours'");
    expect(migration).toContain("challenge.operation_kind = 'request_purge'");
    expect(migration).toContain("challenge.operation_kind = 'confirm_purge'");
    expect(migration).toContain("v_export.state <> 'restore_verified'");
  });

  it("keeps approval material server-derived", () => {
    expect(migration).toContain("'request_purge_v1'");
    expect(migration).toContain("'confirm_purge_v1'");
    expect(migration).not.toContain("p_approval_ref_hash");
  });

  it("keeps the transient purge request out of the recovery artifact", () => {
    expect(migration).toContain("'store_purge_requests'");
    expect(migration).toContain(
      "create or replace function public.repairdesk_store_data_catalog()",
    );
  });

  it("binds writer-fence bypass to a live leased purge job", () => {
    expect(migration).toContain("repairdesk.purge_job_id");
    expect(migration).toContain("job.lease_expires_at > now()");
    expect(migration).toContain("job.destructive_step_started");
    expect(migration).toContain("request.jwt.claim.role");
    expect(migration).toContain("repairdesk_complete_store_purge_v3_rpc");
  });

  it("allows cancellation only before the destructive step", () => {
    expect(migration).toContain("v_job.destructive_step_started");
    expect(migration).toContain("STORE_PURGE_IRREVERSIBLE");
    expect(migration).toContain("'store.purge_cancelled'");
  });
});
