import { describe, expect, it } from "vitest";

import {
  isOrderPresetReasonWorkflowEnabledForStore,
  isOrderReasonPersistenceV2EnabledForStore,
} from "./order-preset-reason-feature";

describe("order preset reason server rollout gate", () => {
  const storeId = "store-a";

  it("fails closed unless the master flag and exact store allowlist both match", () => {
    expect(isOrderPresetReasonWorkflowEnabledForStore(storeId, {})).toBe(false);
    expect(
      isOrderPresetReasonWorkflowEnabledForStore(storeId, {
        ORDER_PRESET_REASON_WORKFLOW_ENABLED: "true",
        ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST: storeId,
      }),
    ).toBe(false);
    expect(
      isOrderPresetReasonWorkflowEnabledForStore(storeId, {
        ORDER_PRESET_REASON_WORKFLOW_ENABLED: "1",
        ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST: "store-b",
      }),
    ).toBe(false);
    expect(
      isOrderPresetReasonWorkflowEnabledForStore(storeId, {
        ORDER_PRESET_REASON_WORKFLOW_ENABLED: "1",
        ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST: `store-b, ${storeId}`,
      }),
    ).toBe(true);
  });

  it("allows only the non-production business E2E system actor without a store", () => {
    expect(
      isOrderPresetReasonWorkflowEnabledForStore(undefined, {
        NODE_ENV: "test",
        REPAIRDESK_E2E_BUSINESS_DESKTOP: "1",
        ORDER_PRESET_REASON_WORKFLOW_ENABLED: "1",
      }),
    ).toBe(true);
    expect(
      isOrderPresetReasonWorkflowEnabledForStore(undefined, {
        NODE_ENV: "production",
        REPAIRDESK_E2E_BUSINESS_DESKTOP: "1",
        ORDER_PRESET_REASON_WORKFLOW_ENABLED: "1",
      }),
    ).toBe(false);
  });

  it("keeps structured database persistence behind a second fail-closed gate", () => {
    const base = {
      ORDER_PRESET_REASON_WORKFLOW_ENABLED: "1",
      ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST: storeId,
    };
    expect(isOrderReasonPersistenceV2EnabledForStore(storeId, base)).toBe(false);
    expect(
      isOrderReasonPersistenceV2EnabledForStore(storeId, {
        ...base,
        ORDER_REASON_PERSISTENCE_V2_ENABLED: "true",
      }),
    ).toBe(false);
    expect(
      isOrderReasonPersistenceV2EnabledForStore(storeId, {
        ...base,
        ORDER_REASON_PERSISTENCE_V2_ENABLED: "1",
      }),
    ).toBe(true);
  });
});
