import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditActor } from "@/lib/repairdesk/types";
import { consumeSensitiveIdentifierRead } from "./inventory-sensitive-identifier-read";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc }) }));
const actor: AuditActor = {
  id: "synthetic-actor",
  activeMembershipId: "synthetic-member",
  storeId: "synthetic-store",
  role: "owner",
  displayName: "Synthetic",
};
describe("shared existing sensitive identifier limit", () => {
  beforeEach(() => rpc.mockReset());
  it("rejects a missing membership before consuming or returning identifiers", async () => {
    await expect(
      consumeSensitiveIdentifierRead(
        { ...actor, activeMembershipId: undefined },
        "synthetic-store",
      ),
    ).rejects.toMatchObject({ status: 403, code: "INVENTORY_IDENTIFIER_READ_FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("retains exactly the existing membership/store scope and shared read bucket", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    await consumeSensitiveIdentifierRead(actor, "synthetic-store");
    expect(rpc).toHaveBeenCalledWith("repairdesk_consume_authenticated_rate_limit_rpc", {
      p_scope_hash: createHash("sha256")
        .update("inventory-identifiers:synthetic-store:synthetic-member")
        .digest("hex"),
      p_bucket: "read",
    });
  });
  it.each([
    [{ allowed: false }, null, 429],
    [null, { message: "Synthetic unavailable" }, 503],
    [null, null, 429],
  ])("fails closed on denied/missing/error limit responses", async (data, error, status) => {
    rpc.mockResolvedValue({ data, error });
    await expect(consumeSensitiveIdentifierRead(actor, "synthetic-store")).rejects.toMatchObject({
      status,
    });
  });
});
