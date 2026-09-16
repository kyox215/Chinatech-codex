import { mockTouchKeyboardDevice } from "@/shared/lib/virtual-keyboard-device.test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_RECOGNITION_CONTRACT_VERSION,
  type InventoryRecognition,
} from "@/shared/lib/inventory-recognition/contracts";

const apiMocks = vi.hoisted(() => ({
  createInventoryIntake: vi.fn(),
  runInventoryVisionRecognition: vi.fn(),
}));
const imageMocks = vi.hoisted(() => ({
  prepareInventoryImage: vi.fn(),
  inventoryImageBlobToDataUrl: vi.fn(),
  dispose: vi.fn(),
}));
const recognitionMocks = vi.hoisted(() => ({ recognizeInventoryImageLocally: vi.fn() }));
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/repairdesk/api", () => ({
  createInventoryIntake: apiMocks.createInventoryIntake,
  runInventoryVisionRecognition: apiMocks.runInventoryVisionRecognition,
}));
vi.mock("@/shared/lib/inventory-recognition/inventory-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/inventory-recognition/inventory-image")>()),
  prepareInventoryImage: imageMocks.prepareInventoryImage,
  inventoryImageBlobToDataUrl: imageMocks.inventoryImageBlobToDataUrl,
}));
vi.mock("@/shared/lib/inventory-recognition/inventory-local-recognition", () => ({
  recognizeInventoryImageLocally: recognitionMocks.recognizeInventoryImageLocally,
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

import { InventoryIntakeDialog } from "./inventory-intake-dialog";

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  apiMocks.createInventoryIntake.mockResolvedValue({ id: "inventory-1" });
  imageMocks.inventoryImageBlobToDataUrl.mockResolvedValue("data:image/jpeg;base64,/9j/wAA=");
  imageMocks.prepareInventoryImage.mockResolvedValue({
    blob: new Blob(["synthetic"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    byteLength: 9,
    width: 3,
    height: 2,
    previewUrl: "blob:synthetic-label",
    dispose: imageMocks.dispose,
  });
  recognitionMocks.recognizeInventoryImageLocally.mockResolvedValue(sampleRecognition());
  apiMocks.runInventoryVisionRecognition.mockResolvedValue({
    request_id: "00000000-0000-4000-8000-000000000003",
    contract_version: INVENTORY_RECOGNITION_CONTRACT_VERSION,
    recognition: sampleRecognition(),
    provider: "fake",
    model_version: "fake-vision-test",
    generated_at: "2026-07-18T12:00:00.000Z",
  });
});

afterEach(() => cleanup());

describe("InventoryIntakeDialog AI review", () => {
  it("keeps the compact legacy numeric keypad scoped and Done/Escape separate from save", async () => {
    mockTouchKeyboardDevice();
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      const user = userEvent.setup();
      const close = vi.fn();
      renderDialog({ canUsePhotoIntake: false, onOpenChange: close });
      const dialog = screen.getByRole("dialog", { name: "新增库存商品" });
      expect(dialog).toHaveFocus();
      const amount = screen.getByRole("button", { name: "入库成本" });
      await user.click(amount);
      expect(
        dialog.querySelector("[data-virtual-keyboard-host] [data-numeric-keypad]"),
      ).not.toBeNull();
      await user.click(screen.getByRole("button", { name: "1" }));
      await user.click(screen.getByRole("button", { name: "完成" }));
      expect(amount).toHaveFocus();
      expect(close).not.toHaveBeenCalled();
      expect(apiMocks.createInventoryIntake).not.toHaveBeenCalled();
      await user.click(amount);
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await waitFor(() => expect(dialog.querySelector("[data-numeric-keypad]")).toBeNull());
      expect(dialog).toBeVisible();
      expect(amount).toHaveFocus();
      expect(screen.getByRole("button", { name: "保存商品" })).toBeVisible();
      expect(close).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });

  it("applies only confirmed fields to the controlled form and saves only on 保存商品", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderDialog({ onDone });

    await user.click(screen.getByRole("button", { name: "拍照识别" }));
    await user.upload(
      screen.getByLabelText("从相册选择设备标签照片"),
      new File(["synthetic"], "synthetic-redmi-a7-pro-box.jpg", { type: "image/jpeg" }),
    );
    expect(await screen.findByLabelText("品牌识别值")).toHaveValue("Redmi");

    await user.click(screen.getByRole("button", { name: "品牌：接受建议" }));
    await user.click(screen.getByRole("button", { name: "型号：接受建议" }));
    await user.click(screen.getByRole("button", { name: "颜色：接受建议" }));
    await user.click(screen.getByRole("button", { name: "存储容量：接受建议" }));
    await user.click(screen.getByRole("button", { name: "IMEI 1：接受建议" }));
    await user.click(screen.getByRole("radio", { name: "作为当前表单的主 IMEI / 序列号" }));
    await user.click(screen.getByRole("button", { name: /应用 \d+ 个确认字段/ }));

    expect(apiMocks.createInventoryIntake).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/品牌/)).toHaveValue("Redmi");
    expect(screen.getByLabelText(/型号/)).toHaveValue("A7 Pro");
    expect(screen.getByLabelText("容量")).toHaveValue("64 GB");
    expect(screen.getByLabelText("IMEI/序列号")).toHaveValue("990000000000002");
    expect(screen.getByText("识别草稿已回到当前表单，尚未保存")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存商品" }));
    await waitFor(() => expect(apiMocks.createInventoryIntake).toHaveBeenCalledOnce());
    expect(apiMocks.createInventoryIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: "Redmi",
        model: "A7 Pro",
        color: "Black",
        storage_capacity: "64 GB",
        serial_or_imei: "990000000000002",
        buyback_price: undefined,
        list_price: undefined,
      }),
      expect.any(Object),
    );
    expect(apiMocks.createInventoryIntake.mock.calls[0]?.[0]).not.toHaveProperty("ram_capacity");
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("inventory-1"));
  });

  it("supports shadow review while keeping draft application and save side effects separate", async () => {
    const user = userEvent.setup();
    renderDialog({ canApplyInventoryDraft: false });

    await user.click(screen.getByRole("button", { name: "拍照识别" }));
    await user.upload(
      screen.getByLabelText("从相册选择设备标签照片"),
      new File(["synthetic"], "synthetic-redmi-a7-pro-box.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByLabelText("型号识别值")).toHaveValue("A7 Pro");
    expect(screen.getByRole("button", { name: "影子模式：不可应用" })).toBeDisabled();
    expect(apiMocks.createInventoryIntake).not.toHaveBeenCalled();
  });

  it("keeps a complete local label on-device and skips the cloud request", async () => {
    recognitionMocks.recognizeInventoryImageLocally.mockResolvedValue(sampleRecognition());
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "拍照识别" }));
    await user.upload(
      screen.getByLabelText("从相册选择设备标签照片"),
      new File(["synthetic"], "clear-local-label.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByLabelText("型号识别值")).toHaveValue("A7 Pro");
    expect(screen.getByText(/图片仅在本机处理/)).toBeInTheDocument();
    expect(apiMocks.runInventoryVisionRecognition).not.toHaveBeenCalled();
    expect(imageMocks.inventoryImageBlobToDataUrl).not.toHaveBeenCalled();
    expect(apiMocks.createInventoryIntake).not.toHaveBeenCalled();
  });

  it("requires a real field decision, focuses edit input, and announces recognition completion", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "拍照识别" }));
    await user.upload(
      screen.getByLabelText("从相册选择设备标签照片"),
      new File(["synthetic"], "synthetic-redmi-a7-pro-box.jpg", { type: "image/jpeg" }),
    );

    const summary = await screen.findByText(/识别完成：发现 \d+ 个候选/);
    await waitFor(() => expect(summary).toHaveFocus());
    const applyButton = screen.getByRole("button", { name: "请先确认至少一个字段" });
    expect(applyButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "品牌：编辑识别值" }));
    const input = screen.getByLabelText("品牌识别值");
    expect(input).toHaveFocus();
    expect(applyButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Redmi edited");
    expect(screen.getByRole("button", { name: "应用 1 个确认字段" })).toBeEnabled();
  });

  it("confirms before discarding a dirty unsaved draft", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderDialog({ onOpenChange });

    await user.type(screen.getByLabelText(/品牌/), "Manual brand");
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/品牌/)).toHaveValue("Manual brand");

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/品牌/)).toHaveValue("");
  });

  it("cleans the ephemeral preview and closes when store authority changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = renderDialog({ onOpenChange, authorityKey: "store-1:owner" });

    await user.click(screen.getByRole("button", { name: "拍照识别" }));
    await user.upload(
      screen.getByLabelText("从相册选择设备标签照片"),
      new File(["synthetic"], "synthetic-redmi-a7-pro-box.jpg", { type: "image/jpeg" }),
    );
    await screen.findByAltText("待识别的设备标签预览");

    view.rerender(wrapper(component({ onOpenChange, authorityKey: "store-2:manager" })));

    await waitFor(() => expect(imageMocks.dispose).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not queue or process sensitive photos while offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "拍照识别" }));

    expect(screen.getByText(/当前离线，不会排队上传敏感照片/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拍摄标签" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "选择照片" })).toBeDisabled();
    expect(imageMocks.prepareInventoryImage).not.toHaveBeenCalled();
  });
});

function renderDialog(overrides: Partial<React.ComponentProps<typeof InventoryIntakeDialog>> = {}) {
  return render(wrapper(component(overrides)));
}

function component(overrides: Partial<React.ComponentProps<typeof InventoryIntakeDialog>> = {}) {
  return (
    <InventoryIntakeDialog
      open
      defaultWarrantyMonths={12}
      canUsePhotoIntake
      canApplyInventoryDraft
      authorityKey="store-1:owner"
      onOpenChange={vi.fn()}
      onDone={vi.fn()}
      {...overrides}
    />
  );
}

function wrapper(node: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;
}

function sampleRecognition(): InventoryRecognition {
  const field = (value: string) => ({
    value,
    confidence: "review" as const,
    evidence: "synthetic label",
    source: "vision" as const,
  });
  return {
    schema_version: INVENTORY_RECOGNITION_CONTRACT_VERSION,
    fields: {
      brand: field("Redmi"),
      model: field("A7 Pro"),
      color: field("Black"),
      ram_capacity: field("4 GB"),
      storage_capacity: field("64 GB"),
    },
    identifiers: [
      {
        type: "imei1",
        value: "990000000000002",
        confidence: "high",
        evidence: "synthetic barcode",
        source: "barcode",
        validation: "valid",
      },
    ],
    conflicts: [],
    warnings: ["仅为合成包装标签声明"],
    label_claim_only: true,
  };
}

function emptyRecognition(): InventoryRecognition {
  const field = {
    value: null,
    confidence: "unknown" as const,
    evidence: null,
    source: "unknown" as const,
  };
  return {
    schema_version: INVENTORY_RECOGNITION_CONTRACT_VERSION,
    fields: {
      brand: field,
      model: field,
      color: field,
      ram_capacity: field,
      storage_capacity: field,
    },
    identifiers: [],
    conflicts: [],
    warnings: ["synthetic local empty"],
    label_claim_only: true,
  };
}
