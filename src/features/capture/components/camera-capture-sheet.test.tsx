import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CameraCaptureSheet } from "@/features/capture/components/camera-capture-sheet";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

describe("CameraCaptureSheet", () => {
  beforeEach(() => {
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
});
