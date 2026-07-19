import { describe, expect, it } from "vitest";

import { resolveAiAssistantLocale } from "./locale";

describe("AI assistant locale resolution", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-Hant", "zh-CN"],
    ["it", "it-IT"],
    ["it_IT", "it-IT"],
    ["en-US", "en"],
    ["en", "en"],
    ["", "zh-CN"],
    ["fr-FR", "zh-CN"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(resolveAiAssistantLocale(input)).toBe(expected);
  });
});
