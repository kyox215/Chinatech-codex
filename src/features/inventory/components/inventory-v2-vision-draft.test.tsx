import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  type AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";

const apiMocks = vi.hoisted(() => ({ runAiInventoryVisionRecognition: vi.fn() }));
const imageMocks = vi.hoisted(() => ({
  prepareAiInventoryImage: vi.fn(),
  aiInventoryImageBlobToDataUrl: vi.fn(),
  dispose: vi.fn(),
}));
const localMocks = vi.hoisted(() => ({ recognizeAiInventoryImageLocally: vi.fn() }));

vi.mock("@/lib/repairdesk/api", () => ({
  runAiInventoryVisionRecognition: apiMocks.runAiInventoryVisionRecognition,
}));
vi.mock("@/features/ai-assistant/model/inventory-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ai-assistant/model/inventory-image")>()),
  prepareAiInventoryImage: imageMocks.prepareAiInventoryImage,
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
  imageMocks.aiInventoryImageBlobToDataUrl.mockResolvedValue("data:image/jpeg;base64,/9j/wAA=");
  apiMocks.runAiInventoryVisionRecognition.mockResolvedValue({
    request_id: "00000000-0000-4000-8000-000000000013",
    contract_version: AI_ASSISTANT_CONTRACT_VERSION,
    recognition: completeRecognition(),
    provider: "fake",
    model_version: "fake-vision-test",
    generated_at: "2026-07-18T12:00:00.000Z",
  });
});

afterEach(() => cleanup());

describe("InventoryV2VisionDraftCard local-first privacy boundary", () => {
  it("keeps complete local recognition on-device without encoding or calling the server", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(completeRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "complete-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByText(/本次未上传至云端视觉服务/)).toBeInTheDocument();
    expect(screen.getByText("型号：").parentElement).toHaveTextContent("A7 Pro");
    expect(imageMocks.aiInventoryImageBlobToDataUrl).not.toHaveBeenCalled();
    expect(apiMocks.runAiInventoryVisionRecognition).not.toHaveBeenCalled();
  });

  it("uses exactly one cloud fallback when local recognition is incomplete", async () => {
    localMocks.recognizeAiInventoryImageLocally.mockResolvedValue(incompleteRecognition());
    const user = userEvent.setup();
    render(<InventoryV2VisionDraftCard enabled onApply={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("选择图片"),
      new File(["synthetic"], "incomplete-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(
      await screen.findByText("AI 仅生成候选，请取消不正确的项目后再确认应用。"),
    ).toBeInTheDocument();
    await waitFor(() => expect(imageMocks.aiInventoryImageBlobToDataUrl).toHaveBeenCalledOnce());
    expect(apiMocks.runAiInventoryVisionRecognition).toHaveBeenCalledOnce();
  });
});

function completeRecognition(): AiInventoryRecognition {
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
    identifiers: [],
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
