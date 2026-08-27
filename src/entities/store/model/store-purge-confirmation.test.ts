import { describe, expect, it } from "vitest";

import {
  getStorePurgeConfirmationPhrase,
  matchesStorePurgeConfirmationPhrase,
} from "./store-purge-confirmation";

const storeId = "8b0b8834-98db-47cb-9d6d-c9b9410afd9b";

describe("store purge confirmation phrase", () => {
  it("derives different deterministic phrases for request and final confirmation", () => {
    expect(getStorePurgeConfirmationPhrase(storeId, "request_purge")).toBe("申请永久删除 410AFD9B");
    expect(getStorePurgeConfirmationPhrase(storeId, "confirm_purge")).toBe(
      "最终确认永久删除 410AFD9B",
    );
    expect(getStorePurgeConfirmationPhrase(storeId, "request_purge")).not.toBe(
      getStorePurgeConfirmationPhrase(storeId, "confirm_purge"),
    );
  });

  it("requires exact characters without trimming or case normalization", () => {
    const expected = getStorePurgeConfirmationPhrase(storeId, "request_purge");
    expect(matchesStorePurgeConfirmationPhrase(expected, storeId, "request_purge")).toBe(true);
    expect(matchesStorePurgeConfirmationPhrase(`${expected} `, storeId, "request_purge")).toBe(
      false,
    );
    expect(
      matchesStorePurgeConfirmationPhrase("申请永久删除 410afd9b", storeId, "request_purge"),
    ).toBe(false);
    expect(matchesStorePurgeConfirmationPhrase(expected, storeId, "confirm_purge")).toBe(false);
  });
});
