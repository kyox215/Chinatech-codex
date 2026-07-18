import { describe, expect, it, vi } from "vitest";

import { runAiUsageMaintenance } from "./ai-usage-maintenance";
import type { AiBudgetRpcInvoker } from "./supabase-provider-budget";

const enabledEnv = {
  AI_ASSISTANT_MAINTENANCE_ENABLED: "1",
  AI_ASSISTANT_USAGE_RETENTION_DAYS: "90",
} as const;

describe("AI usage maintenance", () => {
  it("settles stale reservations and deletes only through the bounded RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        ok: true,
        stale_settled_count: 2,
        request_deleted_count: 3,
        rate_bucket_deleted_count: 4,
      },
      error: null,
    }));

    await expect(
      runAiUsageMaintenance({
        rpc: rpc as AiBudgetRpcInvoker,
        env: enabledEnv,
        now: () => new Date("2026-07-18T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      staleSettledCount: 2,
      requestDeletedCount: 3,
      rateBucketDeletedCount: 4,
    });
    expect(rpc).toHaveBeenCalledWith("repairdesk_maintain_ai_usage", {
      p_stale_limit: 100,
      p_retention_before: "2026-04-19T12:00:00.000Z",
      p_delete_limit: 500,
    });
  });

  it("is default-off and enforces a bounded retention policy before any RPC", async () => {
    const rpc = vi.fn();
    await expect(runAiUsageMaintenance({ rpc, env: {} })).rejects.toThrow(/disabled/);
    for (const retention of ["29", "366", "90.5", "invalid"]) {
      await expect(
        runAiUsageMaintenance({
          rpc,
          env: {
            AI_ASSISTANT_MAINTENANCE_ENABLED: "1",
            AI_ASSISTANT_USAGE_RETENTION_DAYS: retention,
          },
        }),
      ).rejects.toThrow(/retention/);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed on RPC errors or malformed maintenance counters", async () => {
    const rpcError: AiBudgetRpcInvoker = async () => ({ data: null, error: { code: "db" } });
    await expect(runAiUsageMaintenance({ rpc: rpcError, env: enabledEnv })).rejects.toThrow(
      /unavailable/,
    );

    const malformed: AiBudgetRpcInvoker = async () => ({
      data: {
        ok: true,
        stale_settled_count: -1,
        request_deleted_count: 0,
        rate_bucket_deleted_count: 0,
      },
      error: null,
    });
    await expect(runAiUsageMaintenance({ rpc: malformed, env: enabledEnv })).rejects.toThrow(
      /invalid counts/,
    );
  });
});
