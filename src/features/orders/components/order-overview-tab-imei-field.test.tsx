import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ImeiField } from "./order-overview-tab";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

const zxingMocks = vi.hoisted(() => ({
  decodeFromConstraints: vi.fn(),
  decodeFromImageElement: vi.fn(),
}));

const imageInspectionMocks = vi.hoisted(() => ({
  inspectInventoryImage: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReaderMock() {
    return {
      decodeFromConstraints: zxingMocks.decodeFromConstraints,
      decodeFromImageElement: zxingMocks.decodeFromImageElement,
    };
  }),
}));

vi.mock("@/shared/lib/inventory-recognition/inventory-image", () => ({
  inspectInventoryImage: imageInspectionMocks.inspectInventoryImage,
}));

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
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

beforeEach(() => {
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
  toastMocks.warning.mockReset();
  zxingMocks.decodeFromConstraints.mockReset();
  zxingMocks.decodeFromImageElement.mockReset();
  imageInspectionMocks.inspectInventoryImage.mockReset();
  imageInspectionMocks.inspectInventoryImage.mockResolvedValue({
    mimeType: "image/png",
    width: 100,
    height: 100,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:order-detail-imei-photo"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImeiField", () => {
  it.each([
    ["zh-CN", "扫码录入 IMEI / 序列号", "扫描或输入 IMEI / 序列号", "取消", "保存 IMEI"],
    [
      "en",
      "Scan IMEI / serial number",
      "Scan or enter IMEI / serial number",
      "Cancel",
      "Save IMEI",
    ],
    [
      "it-IT",
      "Inserisci IMEI / numero di serie con scanner",
      "Scansiona o inserisci IMEI / numero di serie",
      "Annulla",
      "Salva IMEI",
    ],
  ] as const)(
    "localizes the detail popover in %s",
    async (locale, trigger, placeholder, cancel, save) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <ImeiField
            value="490154203237518"
            edit={null}
            quickPending={false}
            onQuickSave={vi.fn()}
          />
        </LocaleProvider>,
      );
      await userEvent.click(screen.getByRole("button", { name: trigger }));
      expect(screen.getByPlaceholderText(placeholder)).toBeVisible();
      expect(screen.getByRole("button", { name: cancel })).toBeVisible();
      expect(screen.getByRole("button", { name: save })).toBeVisible();
    },
  );
  it("preserves the legacy scanner entry copy and consumes a rejected quick save", async () => {
    const user = userEvent.setup();
    const onQuickSave = vi.fn().mockRejectedValue(new Error("SERVER_SENTINEL"));

    render(
      <ImeiField
        value="490154203237518"
        edit={null}
        onQuickSave={onQuickSave}
        quickPending={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "扫码录入 IMEI / 序列号" }));
    expect(screen.getByText("IMEI / 序列号")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("扫描或输入 IMEI / 序列号")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存 IMEI" }));

    await waitFor(() => expect(onQuickSave).toHaveBeenCalledWith("490154203237518"));
    expect(screen.getByRole("button", { name: "保存 IMEI" })).toBeInTheDocument();
    expect(screen.queryByText("SERVER_SENTINEL")).not.toBeInTheDocument();
  });

  it("saves a selected uploaded-image IMEI candidate from the read-only order detail popover", async () => {
    const user = userEvent.setup();
    const onQuickSave = vi.fn().mockResolvedValue(undefined);

    zxingMocks.decodeFromImageElement.mockResolvedValue({
      getText: () => "IMEI1: 490154203237518 IMEI2: 356938035643809",
    });

    render(<ImeiField value="" edit={null} onQuickSave={onQuickSave} quickPending={false} />);

    await user.click(screen.getByRole("button", { name: "扫码录入 IMEI / 序列号" }));
    await user.click(await screen.findByRole("button", { name: "摄像头扫码录入 IMEI" }));

    const captureDialog = await screen.findByRole("dialog", { name: "扫描 IMEI" });
    expect(captureDialog).toBeInTheDocument();

    const fileInput = captureDialog.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput!, new File(["image"], "imei.png", { type: "image/png" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
    );
    await user.click(screen.getByRole("button", { name: /IMEI2.*3809/ }));
    await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "扫描 IMEI" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "保存 IMEI" }));

    await waitFor(() => expect(onQuickSave).toHaveBeenCalledWith("356938035643809"));
  });
});
