import { describe, expect, it } from "vitest";

import { isInventoryAttachmentStorageScoped } from "@/features/inventory/server/inventory.repository";

const scopedInventoryAttachment = {
  store_id: "store_1",
  item_id: "item_1",
  storage_bucket: "repairdesk-inventory-attachments",
  storage_path: "store_1/item_1/photo.jpg",
};

describe("inventory repository tenant storage boundaries", () => {
  it("allows signing only for the active store and inventory item path", () => {
    expect(isInventoryAttachmentStorageScoped(scopedInventoryAttachment, "store_1", "item_1")).toBe(
      true,
    );
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_path: "store_2/item_1/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another inventory item or bucket", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          item_id: "item_2",
          storage_path: "store_1/item_2/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });
});
