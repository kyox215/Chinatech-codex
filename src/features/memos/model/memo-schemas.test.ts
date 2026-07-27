import { describe, expect, it } from "vitest";

import {
  memoCreateBodySchema,
  memoListBodySchema,
  memoTransitionBodySchema,
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
});
