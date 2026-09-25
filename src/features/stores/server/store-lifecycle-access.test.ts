import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import { assertStoreLifecycleActive, readStoreLifecyclePhase } from "./store-lifecycle-access";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

describe("store lifecycle access gate", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "0");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["closing", "archived", "purge_scheduled", "purging", "purge_failed", "purged"])(
    "blocks mutations for %s",
    async (phase) => {
      mocks.from.mockReturnValue(query({ phase }));
      await expect(readStoreLifecyclePhase("store_1")).resolves.toBe(phase);
      await expect(assertStoreLifecycleActive("store_1")).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each([{ phase: "active" }, null, { phase: "unknown" }])(
    "preserves the active rollout default for %j",
    async (data) => {
      mocks.from.mockReturnValue(query(data));
      await expect(assertStoreLifecycleActive("store_1")).resolves.toBeUndefined();
    },
  );

  it.each(["42P01", "PGRST205"])(
    "fails closed on missing lifecycle storage after enforcement: %s",
    async (code) => {
      vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
      mocks.from.mockReturnValue(query(null, { code, message: "store_lifecycles missing" }));
      await expect(readStoreLifecyclePhase("store_1")).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("blocks writes as soon as the store enters closing", async () => {
    mocks.from.mockReturnValue(query({ phase: "closing" }));
    await expect(assertStoreLifecycleActive("store_1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps expand-before-code rollout compatible when the table is not yet visible", async () => {
    mocks.from.mockReturnValue(
      query(null, {
        code: "PGRST205",
        message: "Could not find the table public.store_lifecycles in the schema cache",
      }),
    );
    await expect(readStoreLifecyclePhase("store_1")).resolves.toBe("active");
  });

  it("does not fail open on unrelated database errors", async () => {
    mocks.from.mockReturnValue(query(null, { code: "42501", message: "permission denied" }));
    await expect(readStoreLifecyclePhase("store_1")).rejects.toThrow("读取店铺生命周期失败");
  });
});

function query(data: unknown, error: { code?: string; message: string } | null = null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}
