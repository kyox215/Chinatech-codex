import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertStorePurgeContractVersion,
  createSupabaseStorePurgeAdapter,
  runSupabaseStorePurgeWorker,
} from "./store-purge-supabase-adapter";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  storageList: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
    from: vi.fn(),
    storage: { from: mocks.storageFrom },
  }),
}));

describe("store purge contract guard", () => {
  beforeEach(() => {
    vi.stubEnv("STORE_LIFECYCLE_PURGE_WORKER_ENABLED", "1");
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: 2, error: null });
    mocks.storageFrom.mockReset();
    mocks.storageFrom.mockReturnValue({ list: mocks.storageList, remove: mocks.storageRemove });
    mocks.storageList.mockReset();
    mocks.storageRemove.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects unsupported versions before the worker can claim or queue a job", async () => {
    await expect(runSupabaseStorePurgeWorker("worker-1")).rejects.toThrow(
      "STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_store_lifecycle_contract_version");
  });

  it("keeps the adapter fail-closed when called without the worker entrypoint", async () => {
    const adapter = createSupabaseStorePurgeAdapter();

    await expect(adapter.claimJob("worker-1")).rejects.toThrow(
      "STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_store_lifecycle_contract_version", {});
  });

  it("accepts only contract version four or newer", () => {
    expect(() => assertStorePurgeContractVersion(3)).toThrow(
      "STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED",
    );
    expect(() => assertStorePurgeContractVersion(4)).not.toThrow();
    expect(() => assertStorePurgeContractVersion(2)).toThrow(
      "STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED",
    );
    expect(() => assertStorePurgeContractVersion(undefined)).toThrow(
      "STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED",
    );
  });

  it("does not call Storage remove when a destructive method sees contract three", async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null });
    const adapter = createSupabaseStorePurgeAdapter();

    await expect(
      adapter.deleteStorageBatch(
        {
          id: "00000000-0000-4000-8000-000000000101",
          storeId: "00000000-0000-4000-8000-000000000102",
          exportJobId: "00000000-0000-4000-8000-000000000103",
          operationId: "00000000-0000-4000-8000-000000000104",
        },
        10,
      ),
    ).rejects.toThrow("STORE_PURGE_CONTRACT_VERSION_UNSUPPORTED");
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });
});
