import { describe, expect, it } from "vitest";

import { getStorePurgeConfirmationPhrase } from "@/entities/store/model/store-purge-confirmation";

import {
  storeLifecycleChallengeBodySchema,
  storePurgeCancelBodySchema,
  storePurgeConfirmBodySchema,
  storePurgeRequestBodySchema,
} from "./repairdesk-schemas";

const storeId = "8b0b8834-98db-47cb-9d6d-c9b9410afd9b";
const requestId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";
const snapshotHash = "a".repeat(64);

describe("store purge API schemas", () => {
  it("binds both purge challenges to a preflight hash", () => {
    for (const operationKind of ["request_purge", "confirm_purge"] as const) {
      expect(
        storeLifecycleChallengeBodySchema.safeParse({
          expectedStoreId: storeId,
          expectedRevision: 1,
          operationKind,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts exact-target request and final confirmation payloads", () => {
    const request = {
      expectedStoreId: storeId,
      expectedRevision: 1,
      reauthChallengeId: challengeId,
      preflightSnapshotHash: snapshotHash,
      confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
    };
    expect(storePurgeRequestBodySchema.parse(request)).toEqual(request);
    expect(storePurgeConfirmBodySchema.parse({ ...request, requestId }).requestId).toBe(requestId);
  });

  it("rejects browser-provided approval hashes, purge times, and the legacy split fields", () => {
    expect(
      storePurgeRequestBodySchema.safeParse({
        expectedStoreId: storeId,
        expectedRevision: 1,
        reauthChallengeId: challengeId,
        preflightSnapshotHash: snapshotHash,
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
        confirmationStoreName: "Chinatech siracusa",
        confirmationStoreIdSuffix: "410afd9b",
        approvalRefHash: "b".repeat(64),
        purgeAfter: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });

  it("rejects control characters and overlong confirmation phrases without normalizing them", () => {
    const base = {
      expectedStoreId: storeId,
      expectedRevision: 1,
      reauthChallengeId: challengeId,
      preflightSnapshotHash: snapshotHash,
    };
    expect(
      storePurgeRequestBodySchema.safeParse({
        ...base,
        confirmationPhrase: `${getStorePurgeConfirmationPhrase(storeId, "request_purge")} `,
      }).success,
    ).toBe(true);
    expect(
      storePurgeRequestBodySchema.safeParse({
        ...base,
        confirmationPhrase: `${getStorePurgeConfirmationPhrase(storeId, "request_purge")}\n`,
      }).success,
    ).toBe(false);
    expect(
      storePurgeRequestBodySchema.safeParse({
        ...base,
        confirmationPhrase: "x".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("requires an exact request UUID to cancel", () => {
    expect(storePurgeCancelBodySchema.parse({ expectedStoreId: storeId, requestId })).toEqual({
      expectedStoreId: storeId,
      requestId,
    });
  });
});
