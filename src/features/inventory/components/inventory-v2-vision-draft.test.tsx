import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  type AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";
import { AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS } from "@/features/ai-assistant/model/inventory-image";

const apiMocks = vi.hoisted(() => ({ runAiInventoryVisionRecognition: vi.fn() }));
const imageMocks = vi.hoisted(() => ({
  prepareAiInventoryImage: vi.fn(),
  cropPreparedAiInventoryImage: vi.fn(),
  aiInventoryImageBlobToDataUrl: vi.fn(),
  dispose: vi.fn(),
  disposeCrop: vi.fn(),
}));
const localMocks = vi.hoisted(() => ({ recognizeAiInventoryImageLocally: vi.fn() }));

vi.mock("@/lib/repairdesk/api", () => ({
  runAiInventoryVisionRecognition: apiMocks.runAiInventoryVisionRecognition,
}));
vi.mock("@/features/ai-assistant/model/inventory-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ai-assistant/model/inventory-image")>()),
  prepareAiInventoryImage: imageMocks.prepareAiInventoryImage,
  cropPreparedAiInventoryImage: imageMocks.cropPreparedAiInventoryImage,
  aiInventoryImageBlobToDataUrl: imageMocks.aiInventoryImageBlobToDataUrl,
}));
vi.mock("@/features/ai-assistant/model/inventory-local-recognition", () => ({
  recognizeAiInventoryImageLocally: localMocks.recognizeAiInventoryImageLocally,
}));

import { InventoryV2VisionDraftCard } from "./inventory-v2-vision-draft";

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  imageMocks.prepareAiInventoryImage.mockResolvedValue({
    blob: new Blob(["synthetic"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    byteLength: 9,
    width: 3,
    height: 2,
    previewUrl: "blob:synthetic-v2-label",
    dispose: imageMocks.dispose,
  });
  imageMocks.cropPreparedAiInventoryImage.mockResolvedValue({
    blob: new Blob(["safe-spec-crop"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    byteLength: 14,
    width: 2,
    height: 1,
    previewUrl: "blob:safe-spec-crop",
    dispose: imageMocks.disposeCrop,
  });
  imageMocks.aiInventoryImageBlobToDataUrl.mockResolvedValue("data:image/jpeg;base64,/9j/wAA=");
  apiMocks.runAiInventoryVisionRecognition.mockResolvedValue({
    request_id: "00000000-0000-4000-8000-000000000013",
    contract_version: AI_ASSISTANT_CONTRACT_VERSION,
    recognition: completeRecognition(false),
    provider: "fake",
    model_version: "fake-vision-test",
    generated_at: "2026-07-18T12:00:00.000Z",
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("InventoryV2VisionDraftCard local-first privacy boundary", () => {
  it("does not abort the active recognition when the prepared preview renders", async () => {
    let activeSignal: AbortSignal | undefined;
    let releaseLocal: ((recognition: AiInventoryRecognition) => void) | undefined;
    localMocks.recognizeAiInventoryImageLocally.mockImplementation(
      (_prepared: unknown, options: { signal?: AbortSignal }) => {
        activeSignal = options.signal;
        return new Promise<AiInventoryRecognition>((resolve) => {
          releaseLocal = resolve;
        });
      },
    );
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "delayed-local-label.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() => expect(screen.getByLabelText("删除照片")).toBeInTheDocument());
    expect(screen.getByText("第 2/2 步：正在本机读取规格、IMEI 和条码…")).toBeInTheDocument();
    expect(activeSignal?.aborted).toBe(false);
    releaseLocal?.(incompleteRecognition());
    expect(await screen.findByText(/请调整并预览只含规格的裁剪/)).toBeInTheDocument();
    expect(imageMocks.aiInventoryImageBlobToDataUrl).not.toHaveBeenCalled();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
  });

  it("ends the busy state at the whole-pipeline deadline and preserves manual fallback", async () => {
    vi.useFakeTimers();
    imageMocks.prepareAiInventoryImage.mockReturnValue(new Promise(() => {}));
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("选择图片"), {
      target: {
        files: [new File(["synthetic"], "hanging-label.jpg", { type: "image/jpeg" })],
      },
    });
    expect(screen.getByText("第 1/2 步：正在生成仅供本机使用的安全图片…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS);
    });

    expect(
      screen.getByText("图片处理超时，已安全停止。你可以重新选择图片，或直接下一步手工录入。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("选择图片")).not.toBeDisabled();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
  });

  it("ignores a cleared operation when its delayed local result arrives after a new file", async () => {
    let firstSignal: AbortSignal | undefined;
    let releaseFirst: ((recognition: AiInventoryRecognition) => void) | undefined;
    localMocks.recognizeAiInventoryImageLocally
      .mockImplementationOnce((_prepared: unknown, options: { signal?: AbortSignal }) => {
        firstSignal = options.signal;
        return new Promise<AiInventoryRecognition>((resolve) => {
          releaseFirst = resolve;
        });
      })
      .mockResolvedValueOnce(completeRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["first"], "first-label.jpg", { type: "image/jpeg" }),
    );
    await waitFor(() => expect(screen.getByLabelText("删除照片")).toBeInTheDocument());
    await user.click(screen.getByLabelText("删除照片"));
    expect(firstSignal?.aborted).toBe(true);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["second"], "second-label.jpg", { type: "image/jpeg" }),
    );
    expect(await screen.findByText(/完整标签未上传/)).toBeInTheDocument();
    await act(async () => {
      releaseFirst?.(completeRecognition());
      await Promise.resolve();
    });

    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
    expect(screen.getByText("型号：").parentElement).toHaveTextContent("A7 Pro");
  });

  it("shows an actionable error instead of an empty success when cloud fallback fails", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(emptyRecognition());
    apiMocks.runAiInventoryVisionRecognition.mockRejectedValue(
      new Error("private provider detail"),
    );
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "empty-local-label.jpg", { type: "image/jpeg" }),
    );
    expect(await screen.findByText(/请调整并预览只含规格的裁剪/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "生成发送预览" }));
    await user.click(await screen.findByLabelText(/我已检查/));
    await user.click(screen.getByRole("button", { name: "确认并识别规格" }));
    expect(
      await screen.findByText("图片识别未完成，请重新选择图片，或直接下一步手工录入。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(apiMocks.runAiInventoryVisionRecognition).toHaveBeenCalledOnce();
    expect(screen.queryByText("AI 仅生成候选，请取消不正确的项目后再确认应用。")).toBeNull();
  });

  it("keeps complete local recognition on-device without encoding or calling the server", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(completeRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "complete-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByText(/完整标签未上传/)).toBeInTheDocument();
    expect(screen.getByText("型号：").parentElement).toHaveTextContent("A7 Pro");
    expect(imageMocks.aiInventoryImageBlobToDataUrl).not.toHaveBeenCalled();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
  });

  it("uploads only the reviewed crop and exactly once after explicit confirmation", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(incompleteRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "incomplete-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByText(/请调整并预览只含规格的裁剪/)).toBeInTheDocument();
    expect(imageMocks.aiInventoryImageBlobToDataUrl).not.toHaveBeenCalled();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "生成发送预览" }));
    expect(await screen.findByAltText("将发送给 AI 的规格裁剪预览")).toBeInTheDocument();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText(/我已检查/));
    await user.click(screen.getByRole("button", { name: "确认并识别规格" }));

    await waitFor(() => expect(imageMocks.aiInventoryImageBlobToDataUrl).toHaveBeenCalledOnce());
    expect(imageMocks.aiInventoryImageBlobToDataUrl).toHaveBeenCalledWith(
      expect.objectContaining({ size: 14 }),
      expect.any(Object),
    );
    expect(apiMocks.runAiInventoryVisionRecognition).toHaveBeenCalledOnce();
  });

  it("revokes confirmation while a replacement crop preview is being generated", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(incompleteRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "replace-crop-label.jpg", { type: "image/jpeg" }),
    );
    await screen.findByText(/请调整并预览只含规格的裁剪/);
    await user.click(screen.getByRole("button", { name: "生成发送预览" }));
    await user.click(await screen.findByLabelText(/我已检查/));

    imageMocks.cropPreparedAiInventoryImage.mockReturnValueOnce(new Promise(() => undefined));
    await user.click(screen.getByRole("button", { name: "重新生成发送预览" }));

    expect(screen.queryByAltText("将发送给 AI 的规格裁剪预览")).toBeNull();
    expect(screen.queryByLabelText(/我已检查/)).toBeNull();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
  });

  it("masks local IMEI by default and applies it as the selected primary scan", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(completeRecognition());
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={onApply} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "complete-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByText(/•7518$/)).toBeInTheDocument();
    expect(screen.queryByText("490154203237518")).toBeNull();
    await user.click(screen.getByRole("button", { name: "确认并应用所选候选" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: [
          expect.objectContaining({
            kind: "imei1",
            value: "490154203237518",
            source: "scan",
            primary: true,
          }),
        ],
      }),
    );
  });

  it("prioritizes IMEI as the primary identifier when an EAN was recognized first", async () => {
    const recognition = completeRecognition();
    recognition.identifiers.unshift({
      type: "ean",
      value: "9900000000004",
      confidence: "high",
      evidence: "synthetic local EAN",
      source: "barcode",
      validation: "valid",
    });
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(recognition);
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={onApply} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "multi-code-label.jpg", { type: "image/jpeg" }),
    );
    await screen.findByText(/完整标签未上传/);
    await user.click(screen.getByRole("button", { name: "确认并应用所选候选" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: [
          expect.objectContaining({ kind: "imei1", primary: true }),
          expect.objectContaining({ kind: "ean", primary: false }),
        ],
      }),
    );
  });
});

function completeRecognition(includeIdentifier = true): AiInventoryRecognition {
  const field = (value: string) => ({
    value,
    confidence: "review" as const,
    evidence: "synthetic label",
    source: "ocr" as const,
  });
  return {
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields: {
      brand: field("Redmi"),
      model: field("A7 Pro"),
      color: field("Black"),
      ram_capacity: field("4 GB"),
      storage_capacity: field("64 GB"),
    },
    identifiers: includeIdentifier
      ? [
          {
            type: "imei1",
            value: "490154203237518",
            confidence: "high",
            evidence: "synthetic local IMEI",
            source: "barcode",
            validation: "valid",
          },
        ]
      : [],
    conflicts: [],
    warnings: ["synthetic local label"],
    label_claim_only: true,
  };
}

function incompleteRecognition(): AiInventoryRecognition {
  const missing = {
    value: null,
    confidence: "unknown" as const,
    evidence: null,
    source: "unknown" as const,
  };
  return {
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields: {
      brand: {
        value: "Redmi",
        confidence: "review",
        evidence: "synthetic local label",
        source: "ocr",
      },
      model: missing,
      color: missing,
      ram_capacity: missing,
      storage_capacity: missing,
    },
    identifiers: [],
    conflicts: [],
    warnings: ["synthetic incomplete local label"],
    label_claim_only: true,
  };
}

function emptyRecognition(): AiInventoryRecognition {
  const missing = {
    value: null,
    confidence: "unknown" as const,
    evidence: null,
    source: "unknown" as const,
  };
  return {
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields: {
      brand: missing,
      model: missing,
      color: missing,
      ram_capacity: missing,
      storage_capacity: missing,
    },
    identifiers: [],
    conflicts: [],
    warnings: ["synthetic empty local label"],
    label_claim_only: true,
  };
}
