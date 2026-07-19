import { describe, expect, it } from "vitest";

import {
  aiOrderSearchArgumentsSchema,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { extractTrustedOrderSearchConstraints } from "@/features/ai-assistant/server/order-intent-router";
import { compileEvidenceBackedProviderConstraints } from "@/features/ai-assistant/server/order-query-evidence";
import {
  AI_ORDER_QUERY_EVAL_CORPUS_VERSION,
  aiOrderQueryEvalCorpus,
} from "./order-query-eval-corpus";

describe(`AI order query evaluation gate ${AI_ORDER_QUERY_EVAL_CORPUS_VERSION}`, () => {
  it("contains a unique, balanced, versioned corpus of at least 300 cases", () => {
    const ids = new Set(aiOrderQueryEvalCorpus.map((entry) => entry.id));
    const localeCounts = new Map<string, number>();
    for (const entry of aiOrderQueryEvalCorpus) {
      localeCounts.set(entry.locale, (localeCounts.get(entry.locale) ?? 0) + 1);
      expect(entry.id.startsWith(`${AI_ORDER_QUERY_EVAL_CORPUS_VERSION}:`)).toBe(true);
    }

    expect(aiOrderQueryEvalCorpus.length).toBeGreaterThanOrEqual(300);
    expect(ids.size).toBe(aiOrderQueryEvalCorpus.length);
    expect(localeCounts.get("zh-CN")).toBeGreaterThanOrEqual(100);
    expect(localeCounts.get("it-IT")).toBeGreaterThanOrEqual(100);
    expect(localeCounts.get("en")).toBeGreaterThanOrEqual(100);
  });

  it("compiles every local device/date case without substituting either constraint", () => {
    const cases = aiOrderQueryEvalCorpus.filter((entry) => entry.kind === "local");
    expect(cases.length).toBeGreaterThanOrEqual(200);

    for (const entry of cases) {
      const constraints = extractTrustedOrderSearchConstraints(entry.message);
      expect(constraints.device_search, entry.id).toBe(entry.expected.device_search);
      expect(constraints.date_filter, entry.id).toEqual(entry.expected.date_filter);
      expect(constraints.view, entry.id).toBe("all");
    }
  });

  it("accepts every controlled three-language evidence synonym", () => {
    const cases = aiOrderQueryEvalCorpus.filter((entry) => entry.kind === "provider_evidence");
    expect(cases.length).toBeGreaterThanOrEqual(150);

    for (const entry of cases) {
      const result = compileEvidenceBackedProviderConstraints(
        entry.message,
        searchArgs(entry.candidate),
      );
      expect(result.constraints, entry.id).toMatchObject(entry.expected);
      expect(result.rejectedFields, entry.id).toEqual([]);
    }
  });

  it("rejects every prompt-injection candidate as unsupported evidence", () => {
    const cases = aiOrderQueryEvalCorpus.filter((entry) => entry.kind === "negative");
    expect(cases.length).toBeGreaterThanOrEqual(12);

    for (const entry of cases) {
      const result = compileEvidenceBackedProviderConstraints(
        entry.message,
        searchArgs(entry.candidate),
      );
      expect(result.constraints, entry.id).toEqual({});
      expect(result.rejectedFields.length, entry.id).toBeGreaterThan(0);
    }
  });
});

type SearchArguments = Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"];

function searchArgs(overrides: Partial<SearchArguments>) {
  return aiOrderSearchArgumentsSchema.parse({
    search: null,
    device_search: null,
    view: "active",
    paid: "all",
    overdue: null,
    queue_group: null,
    financial_review: null,
    date_filter: null,
    service_group: null,
    completed_only: false,
    parts_status: null,
    page_size: 8,
    ...overrides,
  });
}
