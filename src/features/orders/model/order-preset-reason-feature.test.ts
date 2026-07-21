import { describe, expect, it } from "vitest";

import { isOrderPresetReasonUiEnabled } from "./order-preset-reason-feature";

describe("order preset reason UI flag", () => {
  it("requires exact value 1 outside tests", () => {
    expect(isOrderPresetReasonUiEnabled(undefined, "production")).toBe(false);
    expect(isOrderPresetReasonUiEnabled("true", "production")).toBe(false);
    expect(isOrderPresetReasonUiEnabled("0", "production")).toBe(false);
    expect(isOrderPresetReasonUiEnabled("1", "production")).toBe(true);
  });
});
