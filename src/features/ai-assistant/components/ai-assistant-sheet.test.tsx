import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  runAiOrderAssistantTurn: vi.fn(),
  runAiOrderInlineAction: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  runAiOrderAssistantTurn: apiMocks.runAiOrderAssistantTurn,
  runAiOrderInlineAction: apiMocks.runAiOrderInlineAction,
}));

import type { AiOrderAssistantResponse } from "@/features/ai-assistant/model/contracts";
import { getMockAiAssistantUsageSummary } from "@/features/ai-assistant/testing/mock-usage";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { AiAssistantSheet } from "./ai-assistant-sheet";
import { mergeVoiceInputValue } from "./use-ai-assistant-voice-input";

const capabilities = {
  canUseOrderAssistant: true,
  canUseOrderModel: true,
  canUseOrderInlineActions: false,
  canUseVisionIntake: false,
  canApplyInventoryDraft: false,
} as const;

describe("AiAssistantSheet", () => {
  beforeEach(() => {
    apiMocks.runAiOrderAssistantTurn.mockReset();
    apiMocks.runAiOrderInlineAction.mockReset();
    FakeSpeechRecognition.instances = [];
    clearSpeechRecognition();
    setOnline(true);
    document.documentElement.lang = "zh-CN";
  });

  afterEach(() => {
    cleanup();
    clearSpeechRecognition();
    setOnline(true);
    document.documentElement.lang = "zh-CN";
  });

  it("submits a bounded question and renders the minimal order card", async () => {
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(response("R2026001", "order-1"));
    const onModelUsageChanged = vi.fn();
    renderSheet({ onModelUsageChanged });

    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "请列出仍在处理且未付款的工单" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("R2026001")).toBeInTheDocument();
    expect(screen.getByText("M*** R***")).toBeInTheDocument();
    expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledOnce();
    const [request, options] = apiMocks.runAiOrderAssistantTurn.mock.calls[0]!;
    expect(request).toMatchObject({
      message: "请列出仍在处理且未付款的工单",
      locale: "zh-CN",
      processing_mode: "local",
    });
    expect(request.client_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(options.signal).toMatchObject({ aborted: false });
    expect(onModelUsageChanged).not.toHaveBeenCalled();
  });

  it("uses the current interface language for the query", async () => {
    document.documentElement.lang = "it-IT";
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(response("R-IT", "order-it"));
    renderSheet();

    expect(screen.getByRole("button", { name: "Chiudi assistente AI" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Inserisci una domanda sugli ordini" }), {
      target: { value: "mostra iPhone 15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invia" }));

    await screen.findByText("R-IT");
    expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "it-IT" }),
      expect.any(Object),
    );
  });

  it("continues loading in place without replacing earlier cards or changing model usage", async () => {
    const first = response("R-PAGE-1", "order-page-1");
    first.total = 2;
    first.result_truncated = true;
    first.has_more = true;
    first.continuation_token = "continuation-token-with-more-than-32-characters";
    const second = response("R-PAGE-2", "order-page-2");
    second.request_id = "00000000-0000-4000-8000-000000000002";
    second.total = 2;
    second.page = 2;
    second.has_more = false;
    second.continuation_token = null;
    apiMocks.runAiOrderAssistantTurn.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onModelUsageChanged = vi.fn();
    renderSheet({ onModelUsageChanged });

    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "苹果15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    fireEvent.click(await screen.findByRole("button", { name: /继续加载/ }));

    expect(await screen.findByText("R-PAGE-2")).toBeInTheDocument();
    expect(screen.getByText("R-PAGE-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /继续加载/ })).not.toBeInTheDocument();
    expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledTimes(2);
    const firstRequest = apiMocks.runAiOrderAssistantTurn.mock.calls[0]![0];
    const secondRequest = apiMocks.runAiOrderAssistantTurn.mock.calls[1]![0];
    expect(secondRequest).toMatchObject({
      message: "苹果15",
      locale: "zh-CN",
      processing_mode: "local",
      page: 2,
      continuation_token: first.continuation_token,
    });
    expect(secondRequest.client_request_id).not.toBe(firstRequest.client_request_id);
    expect(onModelUsageChanged).not.toHaveBeenCalled();
  });

  it("keeps the card body in place and navigates only from the explicit order link", async () => {
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(response("R-NAV", "order-nav"));
    const onOpenChange = vi.fn();
    renderSheet({ onOpenChange });
    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "苹果15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    fireEvent.click(await screen.findByText("R-NAV"));
    expect(onOpenChange).not.toHaveBeenCalled();
    const orderLink = screen.getByRole("link", { name: "打开订单 R-NAV" });
    orderLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(orderLink);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps confirmed result scope compact and opens corrected scope for review", async () => {
    const confirmed = response("R-CONFIRMED", "order-confirmed");
    apiMocks.runAiOrderAssistantTurn.mockResolvedValueOnce(confirmed);
    const view = renderSheet();
    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "苹果15" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByRole("button", { name: "展开查询范围" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByRole("region", { name: "系统实际采用的查询条件" }),
    ).not.toBeInTheDocument();

    const corrected = response("R-CORRECTED", "order-corrected");
    corrected.request_id = "00000000-0000-4000-8000-000000000002";
    corrected.interpretation_status = "corrected";
    corrected.applied_filters[0]!.source = "server_derived";
    apiMocks.runAiOrderAssistantTurn.mockResolvedValueOnce(corrected);
    fireEvent.change(input, { target: { value: "检查半年内所有的苹果15系列" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("已按原句修正模型偏差")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起查询范围" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(/系统核对/)).toBeInTheDocument();
    view.unmount();
  });

  it("requires explicit confirmation before a server-authorized inline action", async () => {
    const actionable = response("R-ACTION", "order-action");
    actionable.cards[0]!.parts_status = "needed";
    actionable.cards[0]!.allowed_actions = [
      {
        action: "mark_parts_ordered",
        label: "标记已订件",
        description: "仅在已向供应商完成下单后记录状态。",
        requires_confirmation: true,
      },
    ];
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(actionable);
    apiMocks.runAiOrderInlineAction.mockResolvedValue({
      ok: true,
      action: "mark_parts_ordered",
      message: "已记录为配件已订。此操作不会向供应商下单、付款或分配库存。",
      card: {
        ...actionable.cards[0]!,
        status: "parts",
        status_label: "配件",
        parts_status: "ordered",
        updated_at: "2026-07-19T12:00:00.000Z",
        allowed_actions: [],
      },
    });
    renderSheet({ capabilities: { ...capabilities, canUseOrderInlineActions: true } });
    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "今天有哪些待订配件" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    fireEvent.click(await screen.findByRole("button", { name: "标记已订件" }));
    expect(apiMocks.runAiOrderInlineAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("不会创建供应商订单");
    fireEvent.click(screen.getByRole("button", { name: "确认标记已订件" }));

    expect(await screen.findByText(/已记录为配件已订/)).toBeInTheDocument();
    expect(apiMocks.runAiOrderInlineAction).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "order-action",
        action: "mark_parts_ordered",
        confirm_public_no: "R-ACTION",
        expected_updated_at: "2026-07-18T12:00:00.000Z",
        idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }),
    );
  });

  it("lets the user explicitly choose model understanding for the next query", async () => {
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(response("R-MODEL", "order-model"));
    const onModelUsageChanged = vi.fn();
    renderSheet({ onModelUsageChanged });

    const processingTrigger = screen.getByRole("button", { name: "展开处理方式和用量" });
    expect(processingTrigger).toHaveAttribute("aria-expanded", "false");
    expect(processingTrigger).toHaveAttribute("aria-controls");
    fireEvent.click(processingTrigger);
    expect(screen.getByRole("radio", { name: "使用本地处理" })).toHaveAttribute("data-state", "on");
    fireEvent.click(screen.getByRole("radio", { name: "使用大模型辅助" }));
    expect(screen.getByText(/本次文字会.*发送至/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "帮我综合判断最近要优先处理什么" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("R-MODEL")).toBeInTheDocument();
    expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ processing_mode: "model" }),
      expect.any(Object),
    );
    expect(onModelUsageChanged).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "展开处理方式和用量" })).toHaveTextContent(
      "大模型辅助发送至 OpenAI",
    );
  });

  it("keeps one combined processing and usage control collapsed by default", () => {
    renderSheet({
      canReadUsage: true,
      usage: getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z")),
    });

    const trigger = screen.getByRole("button", { name: "展开处理方式和用量" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
    expect(trigger).toHaveTextContent("本地处理本次不计入 · 今日 6/50");
    expect(screen.queryByRole("button", { name: "展开今日大模型用量" })).not.toBeInTheDocument();
    expect(screen.queryByText("请求 / 上限")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "使用本地处理" })).not.toBeInTheDocument();
  });

  it("shows the current-store chat usage details when aggregate finance is allowed", () => {
    renderSheet({
      canReadUsage: true,
      usage: getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z")),
    });

    fireEvent.click(screen.getByRole("button", { name: "展开处理方式和用量" }));
    expect(screen.getByText("6 / 50")).toBeVisible();
    expect(screen.getByText("4,530")).toBeVisible();
    expect(screen.getByText("$0.001210")).toBeVisible();
    expect(screen.getByText("本地处理不计入")).toBeVisible();
  });

  it("does not expose usage when aggregate finance is not allowed", () => {
    renderSheet({
      canReadUsage: false,
      usage: getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z")),
    });

    expect(screen.queryByText("请求 / 上限")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.001210")).not.toBeInTheDocument();
  });

  it("keeps chat usable when the usage summary fails and allows a retry", async () => {
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(
      response("R-USAGE-ERROR", "order-usage-error"),
    );
    const onRetryUsage = vi.fn();
    renderSheet({ canReadUsage: true, usageError: true, onRetryUsage });

    const trigger = screen.getByRole("button", { name: "展开处理方式和用量" });
    expect(trigger).toHaveTextContent("用量暂不可用");
    fireEvent.click(trigger);
    expect(screen.getByText("今日用量暂时无法读取")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(onRetryUsage).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole("textbox", { name: "输入工单查询问题" }), {
      target: { value: "查找未付款工单" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByText("R-USAGE-ERROR")).toBeInTheDocument();
  });

  it("reuses the same client request id for an explicit error retry", async () => {
    apiMocks.runAiOrderAssistantTurn
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(response("R-RETRY", "order-retry"));
    renderSheet();
    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "查找未付款工单" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    fireEvent.click(await screen.findByRole("button", { name: "重试查询" }));
    expect(await screen.findByText("R-RETRY")).toBeInTheDocument();

    const firstRequest = apiMocks.runAiOrderAssistantTurn.mock.calls[0]?.[0];
    const retryRequest = apiMocks.runAiOrderAssistantTurn.mock.calls[1]?.[0];
    expect(firstRequest?.client_request_id).toBeTruthy();
    expect(retryRequest?.client_request_id).toBe(firstRequest?.client_request_id);
  });

  it("does not queue a request while offline and keeps the manual input visible", () => {
    setOnline(false);
    renderSheet();

    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "离线时保留的查询" } });

    expect(screen.getByText("当前离线")).toBeInTheDocument();
    expect(input).toHaveValue("离线时保留的查询");
    expect(screen.getByRole("button", { name: "查找未付款工单" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
  });

  it("aborts the previous request and only renders the latest intent", async () => {
    let firstSignal: AbortSignal | undefined;
    apiMocks.runAiOrderAssistantTurn
      .mockImplementationOnce(
        (_input, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            firstSignal = options.signal;
            options.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      )
      .mockResolvedValueOnce(response("R-LATEST", "order-latest"));
    renderSheet();
    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });

    fireEvent.change(input, { target: { value: "第一个问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: "第二个问题" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("R-LATEST")).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByText("第一个问题")).not.toBeInTheDocument();
    expect(screen.getByText("第二个问题")).toBeInTheDocument();
  });

  it("cancels an in-flight request and preserves the current input", async () => {
    apiMocks.runAiOrderAssistantTurn.mockImplementationOnce(
      (_input, options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    renderSheet();
    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "保留这段查询内容" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(apiMocks.runAiOrderAssistantTurn).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(
      await screen.findByText("已取消本次查询。输入内容仍保留，可修改后重新发送。"),
    ).toBeInTheDocument();
    expect(input).toHaveValue("保留这段查询内容");
  });

  it("shows permission denial without enabling the composer", () => {
    renderSheet({
      capabilities: {
        canUseOrderAssistant: false,
        canUseOrderModel: false,
        canUseOrderInlineActions: false,
        canUseVisionIntake: false,
        canApplyInventoryDraft: false,
        reason: "permission_denied",
      },
    });

    expect(screen.getByText("当前账号没有使用权限")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入工单查询问题" })).toBeDisabled();
    const processingTrigger = screen.getByRole("button", { name: "展开处理方式和用量" });
    expect(processingTrigger).toHaveTextContent("当前不可用");
    fireEvent.click(processingTrigger);
    expect(screen.getByRole("radio", { name: "使用本地处理" })).toBeDisabled();
    expect(screen.queryByRole("radio", { name: "使用大模型辅助" })).not.toBeInTheDocument();
  });

  it("fills the composer from voice without automatically sending a query", async () => {
    installFakeSpeechRecognition();
    renderSheet();

    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "请" } });
    const microphone = await screen.findByRole("button", { name: "开始语音输入" });
    await waitFor(() => expect(microphone).toBeEnabled());
    fireEvent.click(microphone);

    expect(await screen.findByText("正在听…说完后点击麦克风停止。")).toBeInTheDocument();
    act(() => FakeSpeechRecognition.latest().emitResult("查找未付款工单"));

    expect(input).toHaveValue("请 查找未付款工单");
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "停止语音输入" }));
    expect(await screen.findByText("语音已填入，可编辑后再发送。")).toBeInTheDocument();
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
  });

  it("shows an actionable message when microphone permission is denied", async () => {
    installFakeSpeechRecognition();
    renderSheet();

    const microphone = await screen.findByRole("button", { name: "开始语音输入" });
    await waitFor(() => expect(microphone).toBeEnabled());
    fireEvent.click(microphone);
    act(() => FakeSpeechRecognition.latest().emitError("not-allowed"));

    expect(
      await screen.findByText(
        "未获得麦克风或语音服务权限，请在浏览器设置中允许麦克风，并确认 Siri/听写已开启。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入工单查询问题" })).toBeEnabled();
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
  });

  it("aborts active recognition when the assistant sheet closes", async () => {
    installFakeSpeechRecognition();
    const view = renderSheet();
    const microphone = await screen.findByRole("button", { name: "开始语音输入" });
    await waitFor(() => expect(microphone).toBeEnabled());
    fireEvent.click(microphone);
    const recognition = FakeSpeechRecognition.latest();

    view.rerender(sheetElement({ open: false }));

    await waitFor(() => expect(recognition.aborted).toBe(true));
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
  });

  it("keeps unsupported browsers on the keyboard fallback", async () => {
    renderSheet();

    expect(await screen.findByRole("button", { name: "当前浏览器不支持语音输入" })).toBeDisabled();
    expect(screen.getByText("当前浏览器不支持语音输入，请使用键盘输入。")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入工单查询问题" })).toBeEnabled();
  });

  it("caps appended voice text at the existing 800 character boundary", () => {
    const merged = mergeVoiceInputValue("a".repeat(799), "测试", 800);

    expect(merged.value).toHaveLength(800);
    expect(merged.truncated).toBe(true);
  });

  it("localizes client chrome while preserving the active draft without a business action", () => {
    render(
      <LocaleProvider initialLocale="zh-CN">
        <LocaleCapture />
        {sheetBody()}
      </LocaleProvider>,
    );

    const input = screen.getByRole("textbox", { name: "输入工单查询问题" });
    fireEvent.change(input, { target: { value: "DYNAMIC-设备-42" } });
    act(() => setTestLocale("it-IT"));

    expect(screen.getByRole("textbox", { name: "Inserisci una domanda sugli ordini" })).toHaveValue(
      "DYNAMIC-设备-42",
    );
    expect(apiMocks.runAiOrderAssistantTurn).not.toHaveBeenCalled();
    expect(apiMocks.runAiOrderInlineAction).not.toHaveBeenCalled();
  });
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof AiAssistantSheet>> = {}) {
  return render(sheetElement(overrides));
}

function sheetElement(overrides: Partial<React.ComponentProps<typeof AiAssistantSheet>> = {}) {
  const locale = document.documentElement.lang as AppLocale;
  return (
    <LocaleProvider initialLocale={locale === "it-IT" || locale === "en" ? locale : "zh-CN"}>
      {sheetBody(overrides)}
    </LocaleProvider>
  );
}

function sheetBody(overrides: Partial<React.ComponentProps<typeof AiAssistantSheet>> = {}) {
  return (
    <AiAssistantSheet
      open
      onOpenChange={vi.fn()}
      capabilities={capabilities}
      capabilitiesLoading={false}
      capabilitiesError={false}
      onRetryCapabilities={vi.fn()}
      canReadUsage={false}
      usageLoading={false}
      usageError={false}
      onRetryUsage={vi.fn()}
      onModelUsageChanged={vi.fn()}
      storeKey="store-1"
      {...overrides}
    />
  );
}

let setTestLocale: (locale: AppLocale) => void = () => undefined;

function LocaleCapture() {
  const { setLocale } = useLocale();
  setTestLocale = setLocale;
  return null;
}

function response(publicNo: string, id: string): AiOrderAssistantResponse {
  return {
    request_id: "00000000-0000-4000-8000-000000000001",
    contract_version: "ai-order-assistant-v4",
    kind: "search_results",
    message: "RepairDesk 找到 1 条符合条件的工单。",
    interpretation_status: "confirmed",
    applied_filters: [
      {
        key: "device",
        label: "设备",
        value: "Redmi A7 Pro",
        evidence: "exact",
        source: "user_explicit",
      },
    ],
    cards: [
      {
        id,
        public_no: publicNo,
        customer_hint: "M*** R***",
        device_label: "Redmi A7 Pro",
        status: "intake",
        status_label: "接待",
        updated_at: "2026-07-18T12:00:00.000Z",
        completed_at: null,
        parts_status: null,
        matched_reasons: ["Redmi A7 Pro"],
        allowed_actions: [],
        href: `/orders/${id}`,
      },
    ],
    total: 1,
    result_truncated: false,
    page: 1,
    page_size: 8,
    has_more: false,
    continuation_token: null,
    generated_at: "2026-07-18T12:00:00.000Z",
    source: "repairdesk",
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

type FakeRecognitionAlternative = { transcript: string };
type FakeRecognitionResult = {
  0: FakeRecognitionAlternative;
  length: 1;
  isFinal: true;
  item: (index: number) => FakeRecognitionAlternative | null;
};
type FakeRecognitionResultList = {
  0: FakeRecognitionResult;
  length: 1;
  item: (index: number) => FakeRecognitionResult | null;
};

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  aborted = false;
  onstart: ((event: Event) => void) | null = null;
  onresult:
    | ((event: Event & { resultIndex: number; results: FakeRecognitionResultList }) => void)
    | null = null;
  onerror: ((event: Event & { error: string }) => void) | null = null;
  onend: ((event: Event) => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  static latest() {
    const recognition = FakeSpeechRecognition.instances.at(-1);
    if (!recognition) throw new Error("Expected a speech recognition instance");
    return recognition;
  }

  start() {
    this.onstart?.(new Event("start"));
  }

  stop() {
    this.onend?.(new Event("end"));
  }

  abort() {
    this.aborted = true;
    this.onend?.(new Event("end"));
  }

  emitResult(transcript: string) {
    const alternative = { transcript };
    const result: FakeRecognitionResult = {
      0: alternative,
      length: 1,
      isFinal: true,
      item: (index) => (index === 0 ? alternative : null),
    };
    const results: FakeRecognitionResultList = {
      0: result,
      length: 1,
      item: (index) => (index === 0 ? result : null),
    };
    this.onresult?.(Object.assign(new Event("result"), { resultIndex: 0, results }));
  }

  emitError(error: string) {
    this.onerror?.(Object.assign(new Event("error"), { error }));
    this.onend?.(new Event("end"));
  }
}

function installFakeSpeechRecognition() {
  Object.defineProperty(window, "webkitSpeechRecognition", {
    configurable: true,
    value: FakeSpeechRecognition,
  });
}

function clearSpeechRecognition() {
  const speechWindow = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  delete speechWindow.SpeechRecognition;
  delete speechWindow.webkitSpeechRecognition;
}
