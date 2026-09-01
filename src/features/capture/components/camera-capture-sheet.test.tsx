import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CameraCaptureSheet } from "@/features/capture/components/camera-capture-sheet";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

function LocaleControl() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("it-IT")}>
      switch locale
    </button>
  );
}

describe("CameraCaptureSheet", () => {
  beforeEach(() => {
    toastMocks.dismiss.mockReset();
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("accepts an image file as an album fallback", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
    });
    const onCapture = vi.fn();
    const onOpenChange = vi.fn();
    render(<CameraCaptureSheet open onOpenChange={onOpenChange} onCapture={onCapture} />);

    fireEvent.click(screen.getByRole("button", { name: "相册" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["image"], "device.jpg", { type: "image/jpeg" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        kind: "fault_photo",
        name: "device.jpg",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stops stream tracks when the sheet closes", async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const view = render(<CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));

    view.rerender(<CameraCaptureSheet open={false} onOpenChange={vi.fn()} onCapture={vi.fn()} />);

    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it("keeps the camera copy truthful for local drafts and order attachments", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    });
    const { rerender } = render(
      <CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("本地附件草稿"));

    rerender(
      <CameraCaptureSheet
        open
        purpose="order-attachment"
        onOpenChange={vi.fn()}
        onCapture={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("当前工单附件");
  });

  it("shows one safe active error and ignores a late rejection after cleanup", async () => {
    const activeGetUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("camera unavailable", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: activeGetUserMedia },
    });
    const activeView = render(
      <StrictMode>
        <CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />
      </StrictMode>,
    );

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledTimes(1));
    expect(toastMocks.error).toHaveBeenCalledWith(expect.any(String), {
      id: "repairdesk-camera-capture-error",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("摄像头权限被拒绝");
    activeView.unmount();
    expect(toastMocks.dismiss).toHaveBeenCalledWith("repairdesk-camera-capture-error");

    let rejectPending!: (reason: unknown) => void;
    const pendingGetUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((_, reject) => {
          rejectPending = reject;
        }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: pendingGetUserMedia },
    });
    const view = render(<CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />);
    await waitFor(() => expect(pendingGetUserMedia).toHaveBeenCalledTimes(1));
    view.rerender(<CameraCaptureSheet open={false} onOpenChange={vi.fn()} onCapture={vi.fn()} />);

    rejectPending(new DOMException("camera unavailable", "NotAllowedError"));
    await Promise.resolve();
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("dismisses the stable error toast when restarting or closing", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("camera unavailable", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const onOpenChange = vi.fn();
    const view = render(
      <CameraCaptureSheet open onOpenChange={onOpenChange} onCapture={vi.fn()} />,
    );

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "重新启动" }));
    expect(toastMocks.dismiss).toHaveBeenCalledWith("repairdesk-camera-capture-error");

    view.rerender(
      <CameraCaptureSheet open={false} onOpenChange={onOpenChange} onCapture={vi.fn()} />,
    );
    expect(toastMocks.dismiss).toHaveBeenCalledWith("repairdesk-camera-capture-error");
  });

  it("preserves camera state and does not restart media across locale changes", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    render(
      <LocaleProvider initialLocale="zh-CN">
        <LocaleControl />
        <CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("switch locale", { exact: true }));

    expect(
      screen.getByText("Dopo la conferma verrà salvata nella bozza allegati locale."),
    ).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("preserves a captured preview while the locale changes", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({ drawImage: vi.fn() }),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) => callback(new Blob(["photo"], { type: "image/jpeg" })),
    });

    render(
      <LocaleProvider initialLocale="zh-CN">
        <LocaleControl />
        <CameraCaptureSheet open onOpenChange={vi.fn()} onCapture={vi.fn()} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "拍照" }));
    await screen.findByAltText("已拍照片预览");

    fireEvent.click(screen.getByText("switch locale", { exact: true }));

    expect(screen.getByAltText("Anteprima della foto scattata")).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("notifies the owner when the camera sheet is dismissed outside", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    const onOutsideDismiss = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    render(
      <CameraCaptureSheet
        open
        onOpenChange={vi.fn()}
        onCapture={vi.fn()}
        onOutsideDismiss={onOutsideDismiss}
      />,
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    const overlay = document.querySelector<HTMLElement>("div.fixed.inset-0");
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!);

    await waitFor(() => expect(onOutsideDismiss).toHaveBeenCalledTimes(1));
  });

  it("captures a preview, supports retake, and confirms the local attachment draft", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    const onCapture = vi.fn();
    const onOpenChange = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({ drawImage: vi.fn() }),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) => callback(new Blob(["photo"], { type: "image/jpeg" })),
    });

    render(<CameraCaptureSheet open onOpenChange={onOpenChange} onCapture={onCapture} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "拍照" }));
    await screen.findByAltText("已拍照片预览");
    fireEvent.click(screen.getByRole("button", { name: "重拍" }));
    expect(screen.getByLabelText("摄像头画面预览")).toBeInTheDocument();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "拍照" }));
    await screen.findByAltText("已拍照片预览");
    fireEvent.click(screen.getByRole("button", { name: "使用照片" }));

    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "fault_photo", mimeType: "image/jpeg" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
