import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ runAiOrderAssistantTurn: vi.fn() }));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  runAiOrderAssistantTurn: apiMocks.runAiOrderAssistantTurn,
}));

import type { AiOrderAssistantResponse } from "@/features/ai-assistant/model/contracts";
import { AiAssistantSheet } from "./ai-assistant-sheet";
import { mergeVoiceInputValue } from "./use-ai-assistant-voice-input";

const capabilities = {
  canUseOrderAssistant: true,
  canUseVisionIntake: false,
  canApplyInventoryDraft: false,
} as const;

describe("AiAssistantSheet", () => {
  beforeEach(() => {
    apiMocks.runAiOrderAssistantTurn.mockReset();
    FakeSpeechRecognition.instances = [];
    clearSpeechRecognition();
    setOnline(true);
  });

  afterEach(() => {
    cleanup();
    clearSpeechRecognition();
    setOnline(true);
  });

  it("submits a bounded question and renders the minimal order card", async () => {
    apiMocks.runAiOrderAssistantTurn.mockResolvedValue(response("R2026001", "order-1"));
    renderSheet();

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
    });
    expect(request.client_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(options.signal).toMatchObject({ aborted: false });
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
        canUseVisionIntake: false,
        canApplyInventoryDraft: false,
        reason: "permission_denied",
      },
    });

    expect(screen.getByText("当前账号没有使用权限")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入工单查询问题" })).toBeDisabled();
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
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof AiAssistantSheet>> = {}) {
  return render(sheetElement(overrides));
}

function sheetElement(overrides: Partial<React.ComponentProps<typeof AiAssistantSheet>> = {}) {
  return (
    <AiAssistantSheet
      open
      onOpenChange={vi.fn()}
      capabilities={capabilities}
      capabilitiesLoading={false}
      capabilitiesError={false}
      onRetryCapabilities={vi.fn()}
      storeKey="store-1"
      {...overrides}
    />
  );
}

function response(publicNo: string, id: string): AiOrderAssistantResponse {
  return {
    request_id: "00000000-0000-4000-8000-000000000001",
    contract_version: "ai-assistant-v1",
    kind: "search_results",
    message: "RepairDesk 找到 1 条符合条件的工单。",
    cards: [
      {
        id,
        public_no: publicNo,
        customer_hint: "M*** R***",
        device_label: "Redmi A7 Pro",
        status: "intake",
        status_label: "接待",
        updated_at: "2026-07-18T12:00:00.000Z",
        href: `/orders/${id}`,
      },
    ],
    total: 1,
    result_truncated: false,
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
