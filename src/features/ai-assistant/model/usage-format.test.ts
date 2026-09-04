import { describe, expect, it } from "vitest";

import { formatAiUsageInteger, formatAiUsageMicroUsd } from "./usage-format";

describe("AI usage presentation formatting", () => {
  it.each([
    ["zh-CN", "12,345"],
    ["it-IT", "12.345"],
    ["en", "12,345"],
  ] as const)(
    "formats counters in %s without changing canonical cost units",
    (locale, expected) => {
      expect(formatAiUsageInteger(12_345, locale)).toBe(expected);
      expect(formatAiUsageMicroUsd(12_345)).toBe("$0.0123");
    },
  );
});
