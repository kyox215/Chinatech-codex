import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));

import {
  readCostCurrencySettingsRepository,
  replaceCostCurrencySettingsRepository,
} from "./cost-currency.repository";

const storeId = "00000000-0000-4000-8000-000000000001";
const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
  storeId,
  storeRole: "owner",
};
const result = {
  ok: true,
  version: 2,
  items: [
    {
      currency_code: "EUR",
      enabled: true,
      rate_to_eur: 1,
      rate_at: "2026-07-18T10:00:00.000Z",
      rate_source: "store_base",
      revision: 2,
      stale: false,
    },
    {
      currency_code: "USD",
      enabled: true,
      rate_to_eur: 0.92,
      rate_at: "2026-07-18T10:00:00.000Z",
      rate_source: "owner_manual",
      revision: 2,
      stale: false,
    },
  ],
};

beforeEach(() => mocks.rpc.mockReset());

describe("cost currency repository", () => {
  it("maps the service-role settings RPC without widening values", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    await expect(readCostCurrencySettingsRepository(storeId, actor, "settings")).resolves.toEqual({
      version: 2,
      items: [
        expect.objectContaining({ currency_code: "EUR", rate_to_eur: 1 }),
        expect.objectContaining({ currency_code: "USD", rate_to_eur: 0.92 }),
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_read_cost_currency_settings_rpc", {
      p_store_id: storeId,
      p_actor_id: actor.id,
    });
  });

  it("uses optimistic replacement then re-reads authoritative snapshots", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { ok: true, code: "updated", version: 2 }, error: null })
      .mockResolvedValueOnce({ data: result, error: null });
    const input = {
      expected_store_id: storeId,
      expected_version: 1,
      items: [
        {
          currency_code: "EUR" as const,
          enabled: true,
          rate_to_eur: 1,
          rate_at: "2026-07-18T10:00:00.000Z",
        },
        {
          currency_code: "USD" as const,
          enabled: true,
          rate_to_eur: 0.92,
          rate_at: "2026-07-18T10:00:00.000Z",
        },
        { currency_code: "GBP" as const, enabled: false, rate_to_eur: null },
        { currency_code: "CNY" as const, enabled: false, rate_to_eur: null },
        { currency_code: "CHF" as const, enabled: false, rate_to_eur: null },
      ],
    };
    await expect(replaceCostCurrencySettingsRepository(input, actor)).resolves.toMatchObject({
      version: 2,
    });
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("repairdesk_replace_cost_currency_settings_rpc");
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_expected_version: 1,
      p_items: input.items,
    });
  });

  it("maps an optimistic conflict to a bounded operation error", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "version_conflict" }, error: null });
    await expect(
      readCostCurrencySettingsRepository(storeId, actor, "options"),
    ).rejects.toMatchObject({
      code: "version_conflict",
      status: 409,
    });
  });
});
