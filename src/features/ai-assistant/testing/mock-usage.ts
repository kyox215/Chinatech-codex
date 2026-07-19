import type { AiAssistantUsageSummary } from "@/features/ai-assistant/model/contracts";

export function getMockAiAssistantUsageSummary(now = new Date()): AiAssistantUsageSummary {
  return {
    generated_at: now.toISOString(),
    window_start_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000).toISOString(),
    timezone: "Europe/Rome",
    today: {
      provider_request_count: 7,
      input_token_count: 4_890,
      cached_input_token_count: 640,
      output_token_count: 720,
      settled_cost_microusd: 1_840,
      reserved_cost_microusd: 0,
    },
    last_30_days: {
      provider_request_count: 83,
      input_token_count: 72_480,
      cached_input_token_count: 12_300,
      output_token_count: 10_920,
      settled_cost_microusd: 26_420,
      reserved_cost_microusd: 0,
    },
    today_by_kind: {
      order_text: {
        provider_request_count: 6,
        input_token_count: 3_940,
        cached_input_token_count: 640,
        output_token_count: 590,
        settled_cost_microusd: 1_210,
        reserved_cost_microusd: 0,
        request_limit: 50,
      },
      inventory_vision: {
        provider_request_count: 1,
        input_token_count: 950,
        cached_input_token_count: 0,
        output_token_count: 130,
        settled_cost_microusd: 630,
        reserved_cost_microusd: 0,
        request_limit: 5,
      },
    },
    source: "repairdesk_usage_ledger",
  };
}
