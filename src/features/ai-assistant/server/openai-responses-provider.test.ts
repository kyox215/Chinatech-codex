import { describe, expect, it, vi } from "vitest";

import { AI_ASSISTANT_CONTRACT_VERSION } from "@/features/ai-assistant/model/contracts";
import { OpenAiResponsesProvider } from "./openai-responses-provider";
import { AiProviderRequestError } from "./provider";

const safetyIdentifier = `u1_${"a".repeat(43)}`;
const clientRequestId = "00000000-0000-4000-8000-000000000001";

describe("OpenAI Responses provider", () => {
  it("sends exactly one private strict function-call request for order planning", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(orderResponse()));
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125);
    const provider = createProvider(fetchMock, now);

    const result = await provider.planOrderQuery({
      message: "Please show active unpaid repairs",
      locale: "en",
      safetyIdentifier,
      signal: new AbortController().signal,
    });

    expect(result.toolCall).toMatchObject({
      name: "search_orders",
      arguments: {
        view: "active",
        paid: "unpaid",
        evidence: [{ field: "paid", quote: "unpaid" }],
      },
    });
    expect(result.metadata).toMatchObject({
      provider: "openai",
      model: "gpt-5-nano-2025-08-07",
      requestId: "req_test_order",
      attempts: 1,
      latencyMs: 25,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 10,
        cacheWriteTokens: 2,
        outputTokens: 20,
        reasoningTokens: 5,
        totalTokens: 120,
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (
      fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>
    )[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "gpt-5-nano-2025-08-07",
      store: false,
      safety_identifier: safetyIdentifier,
      max_output_tokens: 256,
      reasoning: { effort: "minimal" },
      tool_choice: "required",
      parallel_tool_calls: false,
    });
    expect(body).not.toHaveProperty("previous_response_id");
    expect(body).not.toHaveProperty("user");
    expect(body.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "search_orders", strict: true }),
        expect.objectContaining({ name: "get_order_summary", strict: true }),
        expect.objectContaining({ name: "clarify_order_query", strict: true }),
      ]),
    );
    const searchTool = (body.tools as Array<Record<string, unknown>>).find(
      (tool) => tool.name === "search_orders",
    );
    expect(searchTool).toMatchObject({
      description: expect.stringContaining("device_search"),
      parameters: expect.objectContaining({
        required: expect.arrayContaining(["device_search", "financial_review", "evidence"]),
      }),
    });
    expect(body.instructions).toEqual(
      expect.stringContaining("do not turn them into search keywords"),
    );
    expect(body.instructions).toEqual(expect.stringContaining("Never reduce a device phrase"));
    expect(body.instructions).toEqual(
      expect.stringContaining("Never emit an unconstrained search_orders"),
    );
    expect(body.instructions).toEqual(expect.stringContaining("shortest exact quote"));
  });

  it("sends one bounded image request and rejects cloud identifiers", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(visionResponse()));
    const provider = createProvider(fetchMock);
    const result = await provider.recognizeInventoryLabel({
      clientRequestId,
      imageDataUrl: "data:image/jpeg;base64,/9j/2Q==",
      mimeType: "image/jpeg",
      locale: "zh-CN",
      safetyIdentifier,
    });

    expect(result.recognition.fields).toMatchObject({
      brand: { value: "Redmi" },
      model: { value: "A7 Pro" },
      ram_capacity: { value: "4 GB" },
      storage_capacity: { value: "64 GB" },
    });
    expect(result.recognition.identifiers).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const visionCalls = fetchMock.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const body = JSON.parse(String(visionCalls[0]?.[1]?.body)) as {
      store: boolean;
      max_output_tokens: number;
      input: Array<{ content: Array<Record<string, unknown>> }>;
      text: { format: Record<string, unknown> };
    };
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(1024);
    expect(body.input[0]?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "input_image", detail: "high" })]),
    );
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: "repairdesk_inventory_label",
      strict: true,
    });
    expect(visionCalls[0]?.[1]?.headers).toMatchObject({
      "X-Client-Request-Id": clientRequestId,
    });
  });

  it.each([400, 401, 403, 404, 422])(
    "classifies provider HTTP %s as a non-retryable configuration failure after dispatch",
    async (status) => {
      const provider = createProvider(
        vi.fn(
          async () =>
            new Response('{"error":"redacted"}', {
              status,
              headers: { "content-type": "application/json" },
            }),
        ),
      );
      await expect(
        provider.recognizeInventoryLabel({
          clientRequestId,
          imageDataUrl: "data:image/jpeg;base64,/9j/2Q==",
          mimeType: "image/jpeg",
          locale: "zh-CN",
          safetyIdentifier,
        }),
      ).rejects.toMatchObject({
        category: "configuration",
        dispatchState: "sent_unknown",
        status,
      });
    },
  );

  it("marks HTTP and transport failures as sent-unknown without leaking the provider body", async () => {
    const httpProvider = createProvider(
      vi.fn(
        async () =>
          new Response('{"error":"SECRET upstream detail"}', {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    await expect(
      httpProvider.planOrderQuery({
        message: "show unpaid repairs",
        locale: "en",
        safetyIdentifier,
      }),
    ).rejects.toMatchObject({
      name: "AiProviderRequestError",
      category: "http",
      dispatchState: "sent_unknown",
      status: 429,
      message: "OpenAI request failed: http",
    });

    const timeout = new AbortController();
    timeout.abort(new DOMException("deadline", "TimeoutError"));
    const transportProvider = createProvider(
      vi.fn(async () => {
        throw new Error("SECRET transport detail");
      }),
    );
    await expect(
      transportProvider.planOrderQuery({
        message: "show unpaid repairs",
        locale: "en",
        safetyIdentifier,
        signal: timeout.signal,
      }),
    ).rejects.toMatchObject({ category: "timeout", dispatchState: "sent_unknown" });
  });

  it("fails before fetch when the privacy identifier is missing", async () => {
    const fetchMock = vi.fn();
    const provider = createProvider(fetchMock);
    await expect(
      provider.planOrderQuery({ message: "show unpaid repairs", locale: "en" }),
    ).rejects.toMatchObject({
      category: "configuration",
      dispatchState: "not_sent",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves usage for billable protocol failures", async () => {
    const response = orderResponse();
    response.output = [];
    const provider = createProvider(vi.fn(async () => jsonResponse(response)));
    let caught: unknown;
    try {
      await provider.planOrderQuery({
        message: "show unpaid repairs",
        locale: "en",
        safetyIdentifier,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AiProviderRequestError);
    expect(caught).toMatchObject({
      category: "protocol",
      dispatchState: "sent_unknown",
      metadata: expect.objectContaining({
        provider: "openai",
        attempts: 1,
        usage: expect.objectContaining({ inputTokens: 100, outputTokens: 20 }),
      }),
    });
  });
});

function createProvider(fetchMock: ReturnType<typeof vi.fn>, now?: () => number) {
  return new OpenAiResponsesProvider({
    apiKey: "test-only-openai-key-not-a-real-secret",
    apiBaseUrl: "https://api.openai.com/v1",
    orderModel: "gpt-5-nano-2025-08-07",
    visionModel: "gpt-4o-mini-2024-07-18",
    fetch: fetchMock as unknown as typeof fetch,
    ...(now ? { now } : {}),
  });
}

function orderResponse() {
  return {
    id: "resp_test_order",
    status: "completed",
    error: null,
    incomplete_details: null,
    model: "gpt-5-nano-2025-08-07",
    usage: usage(),
    output: [
      {
        type: "function_call",
        name: "search_orders",
        call_id: "call_test",
        arguments: JSON.stringify({
          search: null,
          device_search: null,
          view: "active",
          paid: "unpaid",
          overdue: null,
          queue_group: null,
          financial_review: null,
          date_filter: null,
          service_group: null,
          completed_only: false,
          parts_status: null,
          evidence: [{ field: "paid", quote: "unpaid" }],
          page_size: 8,
        }),
      },
    ],
  };
}

function visionResponse() {
  return {
    id: "resp_test_vision",
    status: "completed",
    error: null,
    incomplete_details: null,
    model: "gpt-4o-mini-2024-07-18",
    usage: usage(),
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              schema_version: AI_ASSISTANT_CONTRACT_VERSION,
              fields: {
                brand: field("Redmi"),
                model: field("A7 Pro"),
                color: field("Black"),
                ram_capacity: field("4 GB"),
                storage_capacity: field("64 GB"),
              },
              identifiers: [],
              conflicts: [],
              warnings: ["仅为标签声明"],
              label_claim_only: true,
            }),
          },
        ],
      },
    ],
  };
}

function usage() {
  return {
    input_tokens: 100,
    input_tokens_details: { cached_tokens: 10, cache_write_tokens: 2 },
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 5 },
    total_tokens: 120,
  };
}

function field(value: string) {
  return { value, confidence: "high", evidence: "visible label", source: "vision" };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": "req_test_order" },
  });
}
