import { describe, expect, it } from "vitest";

import { CACHE_TIMES } from "@/lib/query-performance";
import { aiAssistantKeys } from "./query-keys";
import { aiAssistantCapabilitiesQueryOptions } from "./query-options";

describe("AI assistant query options", () => {
  it("scopes capability cache state to the active store", () => {
    const options = aiAssistantCapabilitiesQueryOptions("store-1");

    expect(options.queryKey).toEqual(aiAssistantKeys.capabilities("store-1"));
    expect(options.staleTime).toBe(CACHE_TIMES.options);
  });
});
