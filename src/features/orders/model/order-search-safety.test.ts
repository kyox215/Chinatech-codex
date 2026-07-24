import { describe, expect, it } from "vitest";

import {
  sanitizeOrderSearchDraft,
  sanitizeOrderSearchInput,
  sanitizeOrderSearchValue,
} from "./order-search-safety";

const stableToken = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
const legacyToken = "L".repeat(43);

describe("order search bearer safety", () => {
  it.each([
    stableToken,
    legacyToken,
    `/r#${stableToken}`,
    `/orders#${stableToken}`,
    `https://evil.example/orders#${stableToken}`,
  ])("removes a customer-status bearer before query construction: %s", (search) => {
    expect(sanitizeOrderSearchValue(search)).toBeUndefined();
    expect(sanitizeOrderSearchDraft(search)).toBe("");
    expect(
      sanitizeOrderSearchInput({ search, searchScope: "archive_exact" as const, page: 4 }),
    ).toEqual({ search: undefined, searchScope: "current", page: 4 });
  });

  it("leaves ordinary order searches unchanged", () => {
    const input = { search: "R2027029", searchScope: "current" as const };
    expect(sanitizeOrderSearchInput(input)).toBe(input);
    expect(sanitizeOrderSearchDraft(input.search)).toBe(input.search);
  });
});
