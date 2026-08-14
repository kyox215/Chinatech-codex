import { describe, expect, it } from "vitest";

import {
  classifyInventoryOperationError,
  inventorySafeOperationMessage,
} from "./inventory-operation-error";

describe("classifyInventoryOperationError", () => {
  it("routes 409 to the structured conflict contract", () => {
    expect(classifyInventoryOperationError({ status: 409, code: "stale_version" })).toBeNull();
  });

  it("classifies structured validation and authorization failures without message text", () => {
    expect(
      classifyInventoryOperationError({ status: 422, code: "invalid_input", message: "秘密" }),
    ).toMatchObject({ kind: "rejected", subtype: "validation" });
    expect(classifyInventoryOperationError({ status: 403, code: "forbidden" })).toMatchObject({
      kind: "authorization",
      subtype: "authorization",
    });
  });

  it("treats timeout, server, and unstructured failures as outcome unknown", () => {
    expect(
      classifyInventoryOperationError({ name: "RepairDeskRequestTimeoutError" }),
    ).toMatchObject({ kind: "outcome-unknown", subtype: "connectivity" });
    expect(classifyInventoryOperationError({ status: 503, code: "upstream" })).toMatchObject({
      kind: "outcome-unknown",
      subtype: "server",
    });
    expect(classifyInventoryOperationError(new Error("localized private message"))).toMatchObject({
      kind: "outcome-unknown",
      subtype: "generic",
    });
  });

  it("never forwards raw API diagnostics from the safe copy helper", () => {
    const raw = "email=owner@example.test; DROP TABLE inventory; token=secret-sentinel";
    expect(inventorySafeOperationMessage(new Error(raw), "安全的默认错误")).toBe("安全的默认错误");
    expect(
      inventorySafeOperationMessage(
        { status: 403, code: "forbidden", message: raw },
        "安全的默认错误",
      ),
    ).not.toContain(raw);
  });
});
