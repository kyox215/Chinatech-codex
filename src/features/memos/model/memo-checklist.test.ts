import { describe, expect, it } from "vitest";

import { checklistItemsFromLines, checklistStatus, validateChecklist } from "./memo-checklist";

describe("memo checklist domain", () => {
  it("turns nonblank pasted lines into stable ordered items", () => {
    let sequence = 0;
    expect(checklistItemsFromLines(" Open\n\nCount till\r\n ", () => `id-${++sequence}`)).toEqual([
      { id: "id-1", text: "Open", completed: false },
      { id: "id-2", text: "Count till", completed: false },
    ]);
  });

  it("derives completion only for a nonempty all-checked checklist", () => {
    expect(checklistStatus([], "completed")).toBe("completed");
    expect(checklistStatus([{ id: "a", text: "A", completed: false }], "completed")).toBe(
      "pending",
    );
    expect(checklistStatus([{ id: "a", text: "A", completed: true }], "pending")).toBe("completed");
  });

  it("rejects duplicate ids, blank text and overflow without truncating", () => {
    expect(
      validateChecklist([
        { id: "same", text: "A", completed: false },
        { id: "same", text: "B", completed: false },
      ]),
    ).toBe("duplicate_id");
    expect(validateChecklist([{ id: "a", text: " ", completed: false }])).toBe("invalid_text");
    expect(validateChecklist([{ id: "a", text: "A".repeat(201), completed: false }])).toBe(
      "invalid_text",
    );
    expect(validateChecklist([{ id: "a", text: "😀".repeat(200), completed: false }])).toBeNull();
  });
});
