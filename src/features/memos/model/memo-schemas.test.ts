import { describe, expect, it } from "vitest";

import {
  memoCreateBodySchema,
  memoChecklistItemUpdateBodySchema,
  memoListBodySchema,
  memoTransitionBodySchema,
  memoUpdateBodySchema,
} from "@/server/api/repairdesk-schemas";

describe("memo API schemas", () => {
  it("accepts bounded list filters without leaking search into URL state", () => {
    expect(
      memoListBodySchema.parse({ view: "overdue", kind: "todo", search: "交班", page: 1 }),
    ).toMatchObject({ view: "overdue", kind: "todo", search: "交班" });
    expect(() => memoListBodySchema.parse({ pageSize: 51 })).toThrow();
  });

  it("enforces title/body limits and note/todo field discrimination", () => {
    expect(() =>
      memoCreateBodySchema.parse({
        input: {
          operationId: crypto.randomUUID(),
          kind: "note",
          title: "普通记录",
          content: "内容",
          dueAt: new Date().toISOString(),
        },
      }),
    ).toThrow("普通记录不能设置负责人或到期时间");
    expect(() =>
      memoCreateBodySchema.parse({
        input: {
          operationId: crypto.randomUUID(),
          kind: "todo",
          title: "",
          content: "x".repeat(4001),
        },
      }),
    ).toThrow();
  });

  it("accepts only explicit claim/complete/reopen transitions", () => {
    const base = {
      operationId: crypto.randomUUID(),
      id: crypto.randomUUID(),
      expectedVersion: 1,
    };
    expect(
      memoTransitionBodySchema.parse({ input: { ...base, transition: "claim" } }),
    ).toBeTruthy();
    expect(() =>
      memoTransitionBodySchema.parse({ input: { ...base, transition: "delete" } }),
    ).toThrow();
  });

  it("validates bounded canonical checklist items", () => {
    const operationId = crypto.randomUUID();
    const upperId = "ABCDEFAB-1234-4ABC-8ABC-ABCDEFABCDEF";
    const parsed = memoCreateBodySchema.parse({
      input: {
        operationId,
        kind: "todo",
        title: "Opening",
        content: "",
        checklist: [{ id: upperId, text: " Count till ", completed: false }],
      },
    });
    expect(parsed.input.checklist?.[0]).toMatchObject({
      id: upperId.toLowerCase(),
      text: "Count till",
    });
    expect(() =>
      memoUpdateBodySchema.parse({
        input: {
          operationId,
          id: crypto.randomUUID(),
          expectedVersion: 1,
          title: "Opening",
          content: "",
          checklist: [
            { id: upperId, text: "One", completed: false },
            { id: upperId.toLowerCase(), text: "Two", completed: false },
          ],
        },
      }),
    ).toThrow("清单项 id 不能重复");
    expect(
      memoCreateBodySchema.parse({
        input: {
          operationId,
          kind: "todo",
          title: "Emoji boundary",
          content: "",
          checklist: [{ id: crypto.randomUUID(), text: "😀".repeat(200), completed: false }],
        },
      }),
    ).toBeTruthy();
    expect(() =>
      memoCreateBodySchema.parse({
        input: {
          operationId,
          kind: "note",
          title: "Note",
          content: "",
          checklist: [{ id: crypto.randomUUID(), text: "No", completed: false }],
        },
      }),
    ).toThrow("普通记录不能设置清单");
    expect(() =>
      memoChecklistItemUpdateBodySchema.parse({
        input: {
          operationId,
          id: crypto.randomUUID(),
          expectedVersion: 1,
          itemId: crypto.randomUUID(),
          completed: "yes",
        },
      }),
    ).toThrow();
  });
});
