import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderAttachment } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { getOrderDetailPhotoSlot, OrderDetailPhotoSlots } from "./order-detail-photo-slots";

afterEach(cleanup);

const attachment = (id: string, kind: OrderAttachment["kind"]): OrderAttachment => ({
  id,
  store_id: "store-1",
  order_id: "order-1",
  kind,
  file_name: `${id}.jpg`,
  mime_type: "image/jpeg",
  file_size: 100,
  storage_bucket: "orders",
  storage_path: `${id}.jpg`,
  public_url: `https://example.test/${id}.jpg`,
  created_at: "2026-09-02T08:15:00.000Z",
  updated_at: "2026-09-02T08:15:00.000Z",
});

describe("OrderDetailPhotoSlots", () => {
  it("maps fault, screen, and other photos into the other slot", () => {
    expect(getOrderDetailPhotoSlot("device_front")).toBe("front");
    expect(getOrderDetailPhotoSlot("device_back")).toBe("back");
    expect(getOrderDetailPhotoSlot("fault_photo")).toBe("other");
    expect(getOrderDetailPhotoSlot("screen_on")).toBe("other");
    expect(getOrderDetailPhotoSlot("signature")).toBe("other");
  });

  it("keeps each grouped image reachable and gives capture controls distinct names", () => {
    const onCapture = vi.fn();
    const onOpenAttachment = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <OrderDetailPhotoSlots
          attachments={[
            attachment("front-1", "device_front"),
            attachment("other-1", "fault_photo"),
            attachment("other-2", "screen_on"),
          ]}
          canUpload
          onCapture={onCapture}
          onOpenAttachment={onOpenAttachment}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: "Take photo Front" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take photo Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take photo Other photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Other photo 2: other-2.jpg" }));
    expect(onOpenAttachment).toHaveBeenCalledWith(expect.objectContaining({ id: "other-2" }));
    fireEvent.click(screen.getByRole("button", { name: "Take photo Other photo" }));
    expect(onCapture).toHaveBeenCalledWith("other", expect.any(HTMLButtonElement));
  });
});
