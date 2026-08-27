import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStorePurgeConfirmationPhrase } from "@/entities/store/model/store-purge-confirmation";
import type { AuditActor } from "@/lib/repairdesk/types";

import {
  advanceMockPurgeRequestForTest,
  handleRepairDeskPost,
  resetMockPurgeRequestsForTest,
} from "./repairdesk-router";

const storeId = "00000000-0000-4000-8000-000000000099";
const actor: AuditActor = {
  id: "mock_user_owner",
  email: "owner@repairdesk.local",
  displayName: "Owner",
  storeId: "00000000-0000-0000-0000-000000000001",
  storeRole: "owner",
  activeStoreExplicit: true,
};

describe("store purge direct API", () => {
  beforeEach(() => {
    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    vi.stubEnv("REPAIRDESK_E2E_STORE_PURGE_DEMO", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");
    resetMockPurgeRequestsForTest();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts the phrase-only payload and keeps the mock operation non-destructive", async () => {
    const response = await handleRepairDeskPost(
      "stores/lifecycle/request-purge",
      {
        expectedStoreId: storeId,
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
      },
      actor,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      request_id: expect.any(String),
      store_id: storeId,
      state: "cooling",
    });
    expect(body.data).not.toHaveProperty("confirmationStoreName");
    expect(body.data).not.toHaveProperty("confirmationStoreIdSuffix");
  });

  it("rejects legacy split confirmation fields at the direct API boundary", async () => {
    const response = await handleRepairDeskPost(
      "stores/lifecycle/request-purge",
      {
        expectedStoreId: storeId,
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationStoreName: "Demo Archived Store",
        confirmationStoreIdSuffix: "00000099",
      },
      actor,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("请求参数错误") });
  });

  it("keeps status and mutations scoped to the archived recovery owner", async () => {
    const activeStatus = await handleRepairDeskPost(
      "stores/lifecycle/purge-request",
      { expectedStoreId: actor.storeId },
      actor,
    );
    expect(activeStatus.status).toBe(403);

    const nonOwnerStatus = await handleRepairDeskPost(
      "stores/lifecycle/purge-request",
      { expectedStoreId: storeId },
      {
        ...actor,
        id: "mock_user_manager",
        email: "manager@repairdesk.local",
        storeRole: "manager",
      },
    );
    expect(nonOwnerStatus.status).toBe(403);

    const crossStoreRequest = await handleRepairDeskPost(
      "stores/lifecycle/request-purge",
      {
        expectedStoreId: "00000000-0000-4000-8000-000000000088",
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationPhrase: getStorePurgeConfirmationPhrase(
          "00000000-0000-4000-8000-000000000088",
          "request_purge",
        ),
      },
      actor,
    );
    expect(crossStoreRequest.status).toBe(403);
  });

  it("keeps the first request in cooling and requires the test-only transition before confirm", async () => {
    const requestResponse = await handleRepairDeskPost(
      "stores/lifecycle/request-purge",
      {
        expectedStoreId: storeId,
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
      },
      actor,
    );
    const requestBody = await requestResponse.json();
    const requestId = requestBody.data.request_id as string;

    const coolingConfirm = await handleRepairDeskPost(
      "stores/lifecycle/confirm-purge",
      {
        expectedStoreId: storeId,
        requestId,
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "confirm_purge"),
      },
      actor,
    );
    expect(coolingConfirm.status).toBe(403);

    advanceMockPurgeRequestForTest(storeId);
    const confirmed = await handleRepairDeskPost(
      "stores/lifecycle/confirm-purge",
      {
        expectedStoreId: storeId,
        requestId,
        expectedRevision: 1,
        reauthChallengeId: "00000000-0000-4000-8000-000000000101",
        preflightSnapshotHash: "0".repeat(64),
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "confirm_purge"),
      },
      actor,
    );
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).data).toMatchObject({ state: "scheduled" });
  });

  it("rejects another request while an existing request remains open", async () => {
    const request = {
      expectedStoreId: storeId,
      expectedRevision: 1,
      reauthChallengeId: "00000000-0000-4000-8000-000000000101",
      preflightSnapshotHash: "0".repeat(64),
      confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
    };
    expect(
      (await handleRepairDeskPost("stores/lifecycle/request-purge", request, actor)).status,
    ).toBe(200);
    const duplicate = await handleRepairDeskPost("stores/lifecycle/request-purge", request, actor);
    expect(duplicate.status).toBe(403);
    expect(await duplicate.json()).toMatchObject({
      error: expect.stringContaining("已有永久删除申请"),
    });
  });
});
