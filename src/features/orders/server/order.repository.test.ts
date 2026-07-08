import { describe, expect, it } from "vitest";

import { isOrderAttachmentStorageScoped } from "@/features/orders/server/order.repository";

const scopedOrderAttachment = {
  store_id: "store_1",
  order_id: "ord_1",
  storage_bucket: "repairdesk-order-attachments",
  storage_path: "store_1/ord_1/photo.jpg",
};

describe("order repository tenant storage boundaries", () => {
  it("allows signing only for the active store and order path", () => {
    expect(isOrderAttachmentStorageScoped(scopedOrderAttachment, "store_1", "ord_1")).toBe(true);
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_path: "store_2/ord_1/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another order or bucket", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          order_id: "ord_2",
          storage_path: "store_1/ord_2/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });
});
