import { describe, expect, it } from "vitest";

import { canRunExactArchiveOrderSearch, classifyOrderSearchQuery } from "./order-search-query";

describe("classifyOrderSearchQuery", () => {
  it.each([
    ["", "empty"],
    ["R2027029", "public_no"],
    ["+39 333-5719865", "phone"],
    ["3335719865", "phone"],
    ["ABC3335719865", "serial"],
    ["abc9865", "serial"],
    ["Alessio", "text"],
    ["333", "text"],
  ] as const)("classifies %s as %s", (query, kind) => {
    expect(classifyOrderSearchQuery(query)).toBe(kind);
  });

  it("never treats mixed letters and digits as a phone query", () => {
    expect(classifyOrderSearchQuery("abc9865")).not.toBe("phone");
    expect(classifyOrderSearchQuery("ABC3335719865")).not.toBe("phone");
  });

  it("only offers exact archive search for specific identifiers", () => {
    expect(canRunExactArchiveOrderSearch("+39 333 5719865")).toBe(true);
    expect(canRunExactArchiveOrderSearch("R2027029")).toBe(true);
    expect(canRunExactArchiveOrderSearch("Alessio")).toBe(false);
  });
});
