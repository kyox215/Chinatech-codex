import type { AuditActor, UpdateCostCurrencySettingsInput } from "@/lib/repairdesk/types";

import { assertCostCurrencyAccess } from "./cost-currency-feature";
import {
  readCostCurrencySettingsRepository,
  replaceCostCurrencySettingsRepository,
} from "./cost-currency.repository";

export async function readCostCurrencySettings(
  input: { expected_store_id: string; mode?: "settings" | "options" },
  actor: AuditActor,
) {
  assertCostCurrencyAccess(
    actor,
    input.expected_store_id,
    input.mode === "settings" ? "manage" : "read",
  );
  return readCostCurrencySettingsRepository(
    input.expected_store_id,
    actor,
    input.mode ?? "options",
  );
}

export async function replaceCostCurrencySettings(
  input: UpdateCostCurrencySettingsInput,
  actor: AuditActor,
) {
  assertCostCurrencyAccess(actor, input.expected_store_id, "manage");
  // The database RPC writes the mutation and its metadata-only audit atomically.
  return replaceCostCurrencySettingsRepository(input, actor);
}
