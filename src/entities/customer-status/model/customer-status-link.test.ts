import { describe, expect, it } from "vitest";

import { isCustomerStatusLinkCandidate, parseCustomerStatusLink } from "./customer-status-link";

const legacyToken = "L".repeat(43);
const stableToken = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;

describe("customer status QR links", () => {
  it("accepts legacy and stable links from either production host", () => {
    expect(
      parseCustomerStatusLink(`https://www.chinatech.in/r#${stableToken}`, "https://chinatech.in"),
    ).toEqual({ kind: "valid", token: stableToken, href: `/r#${stableToken}` });
    expect(parseCustomerStatusLink(`/r#${legacyToken}`, "https://www.chinatech.in")).toEqual({
      kind: "valid",
      token: legacyToken,
      href: `/r#${legacyToken}`,
    });
    expect(parseCustomerStatusLink(stableToken, "https://www.chinatech.in")).toEqual({
      kind: "valid",
      token: stableToken,
      href: `/r#${stableToken}`,
    });
    expect(parseCustomerStatusLink(legacyToken, "https://www.chinatech.in")).toEqual({
      kind: "valid",
      token: legacyToken,
      href: `/r#${legacyToken}`,
    });
  });

  it("masks lookalike or insecure repair links and rejects malformed tokens", () => {
    expect(
      parseCustomerStatusLink(
        `https://www.chinatech.in.evil.example/r#${stableToken}`,
        "https://www.chinatech.in",
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(
        `http://www.chinatech.in/r#${stableToken}`,
        "https://www.chinatech.in",
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(`//www.chinatech.in/r#${stableToken}`, "https://www.chinatech.in"),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(
        String.raw`\\evil.example\r#${stableToken}`,
        "https://www.chinatech.in",
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(
        `https://user@www.chinatech.in/r#${stableToken}`,
        "https://www.chinatech.in",
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(
        `https://www.chinatech.in:444/r#${stableToken}`,
        "https://www.chinatech.in",
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseCustomerStatusLink(`/r?next=/orders#${stableToken}`, "https://www.chinatech.in"),
    ).toEqual({ kind: "invalid" });
    expect(parseCustomerStatusLink("/r#invalid", "https://www.chinatech.in")).toEqual({
      kind: "invalid",
    });
  });

  it("fails closed when a valid bearer appears on a non-status path", () => {
    expect(parseCustomerStatusLink(`/r/extra#${stableToken}`, "https://www.chinatech.in")).toEqual({
      kind: "invalid",
    });
    expect(parseCustomerStatusLink(`/x/r#${legacyToken}`, "https://www.chinatech.in")).toEqual({
      kind: "invalid",
    });
  });

  it("recognizes historical search values that must be scrubbed", () => {
    expect(isCustomerStatusLinkCandidate(`https://www.chinatech.in/r#${stableToken}`)).toBe(true);
    expect(isCustomerStatusLinkCandidate(stableToken)).toBe(true);
    expect(isCustomerStatusLinkCandidate(legacyToken)).toBe(true);
    expect(isCustomerStatusLinkCandidate(`/orders#${stableToken}`)).toBe(true);
    expect(isCustomerStatusLinkCandidate(`https://evil.example/orders#${stableToken}`)).toBe(true);
    expect(isCustomerStatusLinkCandidate("https://example.com/orders/order-1")).toBe(false);
  });
});
