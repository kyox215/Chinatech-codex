import { describe, expect, it } from "vitest";

import {
  acceptStoreBoundTransientValue,
  valueForActiveStore,
} from "@/features/settings/model/store-bound-transient-state";

describe("store-bound transient settings values", () => {
  it("accepts a response when request, response, and current store match", () => {
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 3,
        value: "SECRET-CODE",
        expiresAt: "2026-07-13T00:00:00.000Z",
        now: new Date("2026-07-12T00:00:00.000Z").getTime(),
      }),
    ).toEqual({
      storeId: "store-a",
      value: "SECRET-CODE",
      expiresAt: "2026-07-13T00:00:00.000Z",
    });
  });

  it("rejects a response whose store does not match the requested store", () => {
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-b",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 3,
        value: "SECRET-CODE",
        expiresAt: "2099-07-13T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("rejects a late response after the active store has changed", () => {
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-b",
        requestEpoch: 3,
        currentEpoch: 4,
        value: "SECRET-CODE",
        expiresAt: "2099-07-13T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("rejects a response without a server-confirmed store identity or valid expiry", () => {
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 3,
        value: "SECRET-CODE",
      }),
    ).toBeNull();
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 3,
        value: "SECRET-CODE",
      }),
    ).toBeNull();
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 3,
        value: "SECRET-CODE",
        expiresAt: "invalid-date",
      }),
    ).toBeNull();
  });

  it("rejects a response from an earlier selection epoch even after returning to the store", () => {
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 3,
        currentEpoch: 5,
        value: "SECRET-CODE",
        expiresAt: "2099-07-13T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("never exposes a value outside its bound active store", () => {
    const state = {
      storeId: "store-a",
      value: "SECRET-CODE",
      expiresAt: "2099-07-13T00:00:00.000Z",
    };

    expect(valueForActiveStore(state, "store-a")).toBe("SECRET-CODE");
    expect(valueForActiveStore(state, "store-b")).toBeNull();
    expect(valueForActiveStore(state, undefined)).toBeNull();
  });

  it("rejects expired responses and stops exposing a value after expiry", () => {
    const expiresAt = "2026-07-12T01:00:00.000Z";
    expect(
      acceptStoreBoundTransientValue({
        requestedStoreId: "store-a",
        responseStoreId: "store-a",
        currentStoreId: "store-a",
        requestEpoch: 1,
        currentEpoch: 1,
        value: "SECRET-CODE",
        expiresAt,
        now: new Date("2026-07-12T02:00:00.000Z").getTime(),
      }),
    ).toBeNull();
    expect(
      valueForActiveStore(
        { storeId: "store-a", value: "SECRET-CODE", expiresAt },
        "store-a",
        new Date("2026-07-12T02:00:00.000Z").getTime(),
      ),
    ).toBeNull();
  });
});
